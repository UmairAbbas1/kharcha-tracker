import { useState, useEffect, useCallback } from 'react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getCategories, getAlertLogs, getMonthlySummary } from '../api'
import BalanceCard        from '../components/BalanceCard'
import AddForm            from '../components/AddForm'
import SpendPie           from '../components/SpendPie'
import SpendBar           from '../components/SpendBar'
import ExpenseList        from '../components/ExpenseList'
import BudgetBanner       from '../components/BudgetBanner'
import BudgetModal        from '../components/BudgetModal'
import BottomSheet        from '../components/BottomSheet'
import KharchaLogo        from '../components/KharchaLogo'
import MonthlySummaryCard from '../components/MonthlySummaryCard'
import { LogOut, Wallet, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { signOut, user }                          = useAuth()
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace()

  const [categories,      setCategories]      = useState([])
  const [alertLogs,       setAlertLogs]       = useState([])
  const [monthlySummary,  setMonthlySummary]  = useState(null)
  const [catLoading,      setCatLoading]      = useState(true)
  const [error,           setError]           = useState(null)
  const [budgetOpen,      setBudgetOpen]      = useState(false)
  const [sheetOpen,       setSheetOpen]       = useState(false)
  const [prefill,         setPrefill]         = useState(null)

  // For testing: fetch current month summary (July 2026)
  // In production this would be prevMonth to show last month's complete data
  const prevMonth = new Date().toISOString().slice(0, 7)

  const currentMonth = new Date().toISOString().slice(0, 7)

  // ── TanStack Query for expenses ───────────────────────────
  const {
    expenses,
    isLoading:   expLoading,
    addExpense,
    isAdding,
    addError,
    resetAddError,
    removeExpense,
  } = useExpenses(activeWorkspace?.id)

  // ── Categories + alert logs (existing pattern) ────────────
  const fetchSupporting = useCallback(async () => {
    if (!activeWorkspace) return
    try {
      setCatLoading(true)
      setError(null)
      const catRes = await getCategories(activeWorkspace.id)
      setCategories(catRes.data)
      // Fire alert logs and monthly summary fetches in parallel (non-blocking)
      getAlertLogs(activeWorkspace.id, currentMonth)
        .then(r => setAlertLogs(r.data || []))
        .catch(() => {})
      getMonthlySummary(activeWorkspace.id, prevMonth)
        .then(r => setMonthlySummary(r.data || null))
        .catch(() => {})
    } catch (err) {
      console.error('[DashboardPage] fetch error:', err)
      setError('Failed to load data.')
    } finally {
      setCatLoading(false)
    }
  }, [activeWorkspace])

  useEffect(() => { fetchSupporting() }, [fetchSupporting])

  // Refresh alert logs 2 s after an expense is added (alert engine latency)
  const refreshAlertLogs = () => {
    if (!activeWorkspace) return
    setTimeout(() => {
      getAlertLogs(activeWorkspace.id, currentMonth)
        .then(r => setAlertLogs(r.data || []))
        .catch(() => {})
    }, 2000)
  }

  const handleAdd = async (data) => {
    await new Promise((resolve, reject) => {
      addExpense(data, {
        onSuccess: () => { setSheetOpen(false); setPrefill(null); refreshAlertLogs(); resolve() },
        onError:   (err) => reject(err),
      })
    })
  }

  const total   = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const loading = expLoading || catLoading

  const addFormProps = {
    categories,
    onAdd:          handleAdd,
    loading:        isAdding,
    prefill,
    onClearPrefill: () => setPrefill(null),
  }

  return (
    <>
      {/* Ambient blobs */}
      <div className="blob w-96 h-96 bg-royal"    style={{ top: '-80px',  left: '-80px'  }} />
      <div className="blob w-80 h-80 bg-blush"    style={{ bottom: '-60px', right: '-60px' }} />
      <div className="blob w-60 h-60 bg-indigo-300" style={{ top: '40%', left: '55%' }} />

      <div className="relative z-10 min-h-screen px-4 py-8 md:py-12">

        {/* ── Header ── */}
        <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KharchaLogo size={36} />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight"
                  style={{ color: '#4169E1' }}>
                Kharcha Tracker
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeWorkspace?.name || 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {workspaces.length > 1 && (
              <select
                value={activeWorkspace?.id || ''}
                onChange={e => switchWorkspace(e.target.value)}
                className="text-xs bg-white/60 border border-blue-100 rounded-xl px-3 py-2 text-gray-700 cursor-pointer"
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setBudgetOpen(true)}
              className="text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-xl
                         border border-blue-100 bg-white/60 text-royal hover:bg-blue-50 transition"
              title="Set budgets"
            >
              <Wallet size={13} />
              Budgets
            </button>

            <button
              onClick={signOut}
              className="text-xs text-gray-500 hover:text-red-600 transition flex items-center gap-1.5"
              title="Sign out"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </header>

        {/* ── Error banner ── */}
        {(error || addError) && (
          <div className="max-w-4xl mx-auto mb-5 bg-red-50 border border-red-200 text-red-600
                          text-sm rounded-2xl px-5 py-3 flex items-center justify-between gap-3">
            <span>⚠️ {error || addError?.message}</span>
            <button
              onClick={() => { setError(null); resetAddError?.() }}
              className="text-xs font-bold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-5">
          <BudgetBanner alertLogs={alertLogs} />

          {/* Monthly AI summary card — previous month, dismissible */}
          {monthlySummary && (
            <MonthlySummaryCard
              summary={monthlySummary}
              momChange={null}
            />
          )}

          <BalanceCard total={total} count={expenses.length} loading={loading} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left — AddForm desktop only */}
            <div className="flex flex-col gap-5">
              <div className="hidden md:block">
                <AddForm {...addFormProps} />
              </div>
              <SpendPie expenses={expenses} />
            </div>

            {/* Right */}
            <div className="flex flex-col gap-5">
              <SpendBar expenses={expenses} />
              <ExpenseList
                expenses={expenses}
                onDelete={removeExpense}
                loading={loading}
              />
            </div>
          </div>
        </div>

        <footer className="max-w-4xl mx-auto text-center mt-10 text-xs text-gray-400">
          Signed in as {user?.email} — Data secured with Supabase RLS
        </footer>
      </div>

      {/* ── Mobile FAB — hidden on desktop ── */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 z-30 md:hidden w-14 h-14 rounded-full
                   shadow-xl flex items-center justify-center text-white
                   active:scale-95 transition-transform"
        style={{ background: '#4169E1' }}
        title="Add expense"
        aria-label="Add expense"
      >
        <Plus size={24} />
      </button>

      {/* ── Mobile Bottom Sheet ── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <AddForm {...addFormProps} />
      </BottomSheet>

      {/* ── Budget Settings Modal ── */}
      {budgetOpen && (
        <BudgetModal
          workspaceId={activeWorkspace.id}
          categories={categories}
          expenses={expenses}
          onClose={() => setBudgetOpen(false)}
          onBudgetChanged={() => {
            // Budget was saved — DB has already cleared stale alert_logs via upsertBudget.
            // Refresh in-memory alertLogs immediately so banners disappear right away.
            getAlertLogs(activeWorkspace.id, currentMonth)
              .then(r => setAlertLogs(r.data || []))
              .catch(() => {})
          }}
        />
      )}
    </>
  )
}
