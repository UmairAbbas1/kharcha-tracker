/**
 * DashboardPage.jsx — Redesigned layout.
 * Key changes:
 *   - Surface (#F7F8FC) page background, no blobs
 *   - Flat white cards, no glassmorphism
 *   - Plus Jakarta Sans throughout via Tailwind fontFamily
 *   - BudgetRings component wired with budgets + expenses
 *   - Header simplified: logo left, actions right
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getCategories, getAlertLogs, getMonthlySummary, getBudgets } from '../api'

import BalanceCard        from '../components/BalanceCard'
import AddForm            from '../components/AddForm'
import SpendPie           from '../components/SpendPie'
import SpendBar           from '../components/SpendBar'
import ExpenseList        from '../components/ExpenseList'
import BudgetBanner       from '../components/BudgetBanner'
import BudgetModal        from '../components/BudgetModal'
import BudgetRings        from '../components/BudgetRings'
import BottomSheet        from '../components/BottomSheet'
import MonthlySummaryCard from '../components/MonthlySummaryCard'
import InsightsCard       from '../components/InsightsCard'
import { Settings, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { user }                                         = useAuth()
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace()

  const [categories,     setCategories]     = useState([])
  const [alertLogs,      setAlertLogs]      = useState([])
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [budgets,        setBudgets]        = useState([])
  const [catLoading,     setCatLoading]     = useState(true)
  const [error,          setError]          = useState(null)
  const [budgetOpen,     setBudgetOpen]     = useState(false)
  const [sheetOpen,      setSheetOpen]      = useState(false)
  const [prefill,        setPrefill]        = useState(null)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth    = (() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()

  const {
    expenses, isLoading: expLoading,
    addExpense, isAdding, addError, resetAddError, removeExpense,
  } = useExpenses(activeWorkspace?.id)

  const fetchSupporting = useCallback(async () => {
    if (!activeWorkspace) return
    try {
      setCatLoading(true)
      setError(null)
      const catRes = await getCategories(activeWorkspace.id)
      setCategories(catRes.data)

      // parallel fetches — non-blocking
      getBudgets(activeWorkspace.id, currentMonth)
        .then(r => setBudgets(r.data || []))
        .catch(() => {})
      getAlertLogs(activeWorkspace.id, currentMonth)
        .then(r => setAlertLogs(r.data || []))
        .catch(() => {})
      getMonthlySummary(activeWorkspace.id, prevMonth)
        .then(r => setMonthlySummary(r.data || null))
        .catch(() => {})
    } catch (err) {
      console.error('[DashboardPage]', err)
      setError('Failed to load workspace data.')
    } finally {
      setCatLoading(false)
    }
  }, [activeWorkspace])

  useEffect(() => { fetchSupporting() }, [fetchSupporting])

  const refreshAlertLogs = () => {
    if (!activeWorkspace) return
    setTimeout(() => {
      getAlertLogs(activeWorkspace.id, currentMonth)
        .then(r => setAlertLogs(r.data || []))
        .catch(() => {})
    }, 2000)
  }

  const handleAdd = (data) =>
    new Promise((resolve, reject) => {
      addExpense(data, {
        onSuccess: () => { setSheetOpen(false); setPrefill(null); refreshAlertLogs(); resolve() },
        onError:   (err) => reject(err),
      })
    })

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
    <div className="min-h-screen" style={{ background: '#F7F8FC' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: '#0F1117' }}>
              Dashboard
            </h1>
            {activeWorkspace && (
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {activeWorkspace.name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {workspaces.length > 1 && (
              <select
                value={activeWorkspace?.id || ''}
                onChange={e => switchWorkspace(e.target.value)}
                className="text-xs rounded-lg border px-2.5 py-1.5 cursor-pointer"
                style={{ borderColor: '#E5E7EB', color: '#6B7280', background: '#fff' }}
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setBudgetOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5
                         text-xs font-semibold transition hover:bg-white"
              style={{ borderColor: '#E5E7EB', color: '#2563EB', background: '#fff' }}
              title="Budget settings"
            >
              <Settings size={13} strokeWidth={2} />
              Budgets
            </button>

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5
                         text-xs font-semibold transition hover:bg-red-50"
              style={{ borderColor: '#E5E7EB', color: '#6B7280', background: '#fff' }}
              title="Sign out"
            >
              <LogOut size={13} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </header>

        {/* ── Error state ── */}
        {(error || addError) && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center justify-between
                          text-sm gap-3 animate-entry"
               style={{ background: '#FFF7ED', borderColor: '#FDBA74', color: '#C2410C' }}>
            <span>{error || addError?.message}</span>
            <button
              onClick={() => { setError(null); resetAddError?.() }}
              className="text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Budget alert banners ── */}
        {alertLogs.length > 0 && (
          <div className="mb-6 animate-entry delay-100">
            <BudgetBanner alertLogs={alertLogs} />
          </div>
        )}

        {/* ── Monthly summary card ── */}
        {monthlySummary && (
          <div className="mb-6 animate-entry delay-100">
            <MonthlySummaryCard summary={monthlySummary} momChange={null} />
          </div>
        )}

        {/* ── Balance hero ── */}
        <div className="mb-6 animate-entry delay-100">
          <BalanceCard total={total} count={expenses.length} loading={loading} />
        </div>

        {/* ── Budget rings ── */}
        {budgets.length > 0 && (
          <div className="mb-6 animate-entry delay-200">
            <BudgetRings
              budgets={budgets}
              categories={categories}
              expenses={expenses}
              month={currentMonth}
            />
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 animate-entry delay-300">

          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Add form — desktop only */}
            <div className="hidden md:block">
              <AddForm {...addFormProps} />
            </div>
            <SpendPie expenses={expenses} />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            <SpendBar expenses={expenses} />
            <ExpenseList
              expenses={expenses}
              onDelete={removeExpense}
              loading={loading}
              workspaceId={activeWorkspace?.id}
              currentMonth={currentMonth}
            />
          </div>
        </div>

        {/* ── Smart Insights (AI assistant) — full width ── */}
        {activeWorkspace && (
          <div className="mb-5">
            <InsightsCard
              workspaceId={activeWorkspace.id}
              categories={categories}
            />
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="text-center mt-10 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
          <span className="mx-2 opacity-40">·</span>
          Secured with Supabase RLS
        </footer>
      </div>

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 z-30 md:hidden w-14 h-14 rounded-full
                   shadow-lg flex items-center justify-center text-white
                   active:scale-95 transition-transform"
        style={{ background: '#2563EB' }}
        aria-label="Add expense"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* ── Mobile Bottom Sheet ── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <AddForm {...addFormProps} />
      </BottomSheet>

      {/* ── Budget Modal ── */}
      {budgetOpen && (
        <BudgetModal
          workspaceId={activeWorkspace.id}
          categories={categories}
          expenses={expenses}
          onClose={() => setBudgetOpen(false)}
          onBudgetChanged={() => {
            getBudgets(activeWorkspace.id, currentMonth)
              .then(r => setBudgets(r.data || []))
              .catch(() => {})
            getAlertLogs(activeWorkspace.id, currentMonth)
              .then(r => setAlertLogs(r.data || []))
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
