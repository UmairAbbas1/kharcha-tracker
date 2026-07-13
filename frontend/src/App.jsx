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

  // Command palette related states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('')
  const [autoOpenAddExpense, setAutoOpenAddExpense] = useState(false) // can be true or prefill object
  const [autoFocusAiAssistant, setAutoFocusAiAssistant] = useState(false)

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
      case 'insights':  return <ComingSoon label="Smart Insights" />
      case 'analytics': return <AnalyticsPage />
      case 'split':     return <SplitPage />
      case 'export':    return <ExportPage />
      case 'alerts':    return <AlertHistoryPage />
      case 'guide':     return <GuidePage />
      case 'settings':  return <ComingSoon label="Settings" />
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
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {renderModule()}
      </main>

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
