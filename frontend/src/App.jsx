import { useState, useEffect } from 'react'
import { AuthProvider, useAuth }           from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import AuthPage           from './pages/AuthPage'
import DashboardPage      from './pages/DashboardPage'
import ExpensesPage       from './pages/ExpensesPage'
import BudgetsPage        from './pages/BudgetsPage'
import AnalyticsPage      from './pages/AnalyticsPage'
import SplitPage          from './pages/SplitPage'
import ExportPage         from './pages/ExportPage'
import AlertHistoryPage   from './pages/AlertHistoryPage'
import GuidePage          from './pages/GuidePage'
import Sidebar            from './components/Sidebar'
import CommandPalette     from './components/CommandPalette'
import NotificationsPanel from './components/NotificationsPanel'
import RecurringBanner    from './components/RecurringBanner'
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getRecurringDrafts, updateRecurringExpense, createExpense
} from './api'
import { supabase } from './lib/supabase'
import RecurringPage from './pages/RecurringPage'
import ReceiptVaultPage from './pages/ReceiptVaultPage'
import ActivityLogPage from './pages/ActivityLogPage'
import SettingsPage from './pages/SettingsPage'
import InsightsCard from './components/InsightsCard'

// ── Module placeholder component ─────────────────────────────────────
function ComingSoon({ label }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen"
         style={{ background: '#F7F8FC' }}>
      <div className="text-center card p-12 max-w-sm">
        <p className="text-2xl mb-3">🚧</p>
        <p className="text-base font-bold" style={{ color: '#0F1117' }}>{label}</p>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          This module is coming soon.
        </p>
      </div>
    </div>
  )
}

function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [activeModule, setActiveModule] = useState('dashboard')

  // Sidebar collapse state (shared)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Command palette related states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('')
  const [autoOpenAddExpense, setAutoOpenAddExpense] = useState(false) // can be true or prefill object
  const [autoFocusAiAssistant, setAutoFocusAiAssistant] = useState(false)

  // Notifications states
  const [notifications, setNotifications] = useState([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  // Recurring Expenses Draft states
  const [recurringDrafts, setRecurringDrafts] = useState([])

  // Dark Mode states
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('kharcha_theme')
    if (stored) return stored === 'dark'
    return false // default to light mode
  })

  // Sync dark mode class on root element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('kharcha_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Fetch notifications helper
  const fetchNotifications = async () => {
    if (!activeWorkspace?.id) return
    setNotifLoading(true)
    try {
      const res = await getNotifications(activeWorkspace.id)
      setNotifications(res.data || [])
    } catch (err) {
      console.error('[AppInner] fetchNotifications failed:', err)
    } finally {
      setNotifLoading(false)
    }
  }

  // Fetch recurring drafts
  const fetchDrafts = async () => {
    if (!activeWorkspace?.id) return
    try {
      const res = await getRecurringDrafts(activeWorkspace.id)
      setRecurringDrafts(res.data || [])
    } catch (err) {
      console.error('[AppInner] fetchDrafts failed:', err)
    }
  }

  const handleConfirmDraft = async (draft) => {
    await createExpense(activeWorkspace.id, {
      title: draft.vendor,
      amount: Number(draft.amount),
      category_id: draft.category_id,
      date: draft.next_expected_date,
    })

    const nextDate = new Date(draft.next_expected_date)
    nextDate.setMonth(nextDate.getMonth() + 1)
    const nextExpectedStr = nextDate.toISOString().split('T')[0]

    await updateRecurringExpense(draft.id, {
      next_expected_date: nextExpectedStr
    })

    fetchDrafts()
    fetchNotifications()
  }

  const handleDismissDraft = async (id) => {
    const draft = recurringDrafts.find(d => d.id === id)
    if (!draft) return

    const nextDate = new Date(draft.next_expected_date)
    nextDate.setMonth(nextDate.getMonth() + 1)
    const nextExpectedStr = nextDate.toISOString().split('T')[0]

    await updateRecurringExpense(id, {
      next_expected_date: nextExpectedStr
    })
    fetchDrafts()
  }

  // Real-time subscribe and fetch notifications
  useEffect(() => {
    if (!activeWorkspace?.id || !user?.id) return

    fetchNotifications()
    fetchDrafts()

    // Subscribe to INSERT events in public.notifications
    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeWorkspace?.id, user?.id])

  const handleMarkRead = async (id) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    )
    try {
      await markNotificationRead(id)
    } catch (err) {
      console.error('[AppInner] handleMarkRead failed:', err)
      fetchNotifications()
    }
  }

  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    )
    try {
      await markAllNotificationsRead(activeWorkspace.id)
    } catch (err) {
      console.error('[AppInner] handleMarkAllRead failed:', err)
      fetchNotifications()
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  // Listen for global shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    if (!user) return

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(open => !open)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [user])

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: '#F7F8FC' }}>
        <div className="animate-pulse text-sm" style={{ color: '#9CA3AF' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!user)            return <AuthPage />
  if (!activeWorkspace) return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: '#F7F8FC' }}>
      <div className="card p-8 text-center text-sm" style={{ color: '#6B7280' }}>
        No workspace found. Contact support.
      </div>
    </div>
  )

  const handleTriggerAddExpense = (prefillData) => {
    if (activeModule !== 'dashboard' && activeModule !== 'expenses') {
      setActiveModule('expenses')
    }
    setAutoOpenAddExpense(prefillData || true)
  }

  const handleTriggerAskAi = () => {
    setActiveModule('dashboard')
    setAutoFocusAiAssistant(true)
  }

  const handleSelectRecentExpense = (expense) => {
    setActiveModule('expenses')
    setExpenseSearchQuery(expense.title)
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return (
        <DashboardPage
          autoOpenAdd={autoOpenAddExpense}
          onClearAutoOpenAdd={() => setAutoOpenAddExpense(false)}
          autoFocusAi={autoFocusAiAssistant}
          onClearAutoFocusAi={() => setAutoFocusAiAssistant(false)}
        />
      )
      case 'expenses':  return (
        <ExpensesPage
          initialSearchQuery={expenseSearchQuery}
          onClearSearchQuery={() => setExpenseSearchQuery('')}
          autoOpenAdd={autoOpenAddExpense}
          onClearAutoOpenAdd={() => setAutoOpenAddExpense(false)}
        />
      )
      case 'budgets':   return <BudgetsPage />
      case 'recurring': return <RecurringPage />
      case 'vault':     return <ReceiptVaultPage />
      case 'activity':  return <ActivityLogPage />
      case 'insights':  return (
        <div className="min-h-screen py-8 md:py-10" style={{ background: 'var(--color-surface)' }}>
          <div className="max-w-3xl mx-auto px-4">
            <header className="mb-6">
              <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-ink)' }}>
                Smart Insights
              </h1>
              <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
                Ask questions in Urdu, English, or Roman Urdu about your spending history.
              </p>
            </header>
            <InsightsCard workspaceId={activeWorkspace?.id} autoFocus={true} />
          </div>
        </div>
      )
      case 'analytics': return <AnalyticsPage />
      case 'split':     return <SplitPage />
      case 'export':    return <ExportPage />
      case 'alerts':    return <AlertHistoryPage />
      case 'guide':     return <GuidePage />
      case 'settings':  return (
        <SettingsPage
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(d => !d)}
        />
      )
      default:          return <DashboardPage />
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#F7F8FC' }}>
      <Sidebar
        activeModule={activeModule}
        onNavigate={setActiveModule}
        workspaceName={activeWorkspace.name}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        unreadNotifCount={unreadCount}
        onToggleNotif={() => setIsNotifOpen(o => !o)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {recurringDrafts.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 pt-6 -mb-2">
            <RecurringBanner
              drafts={recurringDrafts}
              onConfirm={handleConfirmDraft}
              onDismiss={handleDismissDraft}
            />
          </div>
        )}
        {renderModule()}
      </main>

      {isNotifOpen && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setIsNotifOpen(false)}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          isLoading={notifLoading}
          positionLeft={sidebarCollapsed ? '74px' : '230px'}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        workspaceId={activeWorkspace?.id}
        activeModule={activeModule}
        onNavigate={setActiveModule}
        onTriggerAddExpense={handleTriggerAddExpense}
        onTriggerAskAi={handleTriggerAskAi}
        onSelectRecentExpense={handleSelectRecentExpense}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppInner />
      </WorkspaceProvider>
    </AuthProvider>
  )
}
