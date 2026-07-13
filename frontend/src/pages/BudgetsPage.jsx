/**
 * BudgetsPage.jsx — Budget management module.
 *
 * Scope verification (signOut-style orphan bug prevention):
 *   useAuth ✓  useWorkspace ✓  useExpenses ✓  getBudgets ✓  upsertBudget ✓
 *   deleteBudget ✓  BudgetRings ✓  categoryIcon ✓  getCategories ✓
 *   All lucide icons declared ✓
 *
 * Supabase join safety:
 *   No embedded foreign table selects in any query in this file.
 *   getBudgets selects '*' from budgets only.
 *   getCategories selects '*' from categories only.
 *   useExpenses reuses the dashboard cache — no new query.
 */

import { useState, useEffect, useRef } from 'react'
import { PiggyBank, Trash2, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getBudgets, upsertBudget, deleteBudget, getCategories } from '../api'
import BudgetRings    from '../components/BudgetRings'
import { categoryIcon } from '../components/CategoryIcon'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

// ── Month picker ──────────────────────────────────────────────
function MonthPicker({ value, onChange }) {
  const label = new Date(`${value}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })
  const shift = (delta) => {
    const d = new Date(`${value}-15`)
    d.setMonth(d.getMonth() + delta)
    onChange(d.toISOString().slice(0, 7))
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)}
        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
        style={{ color: '#6B7280' }}>
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-bold w-36 text-center" style={{ color: '#0F1117' }}>
        {label}
      </span>
      <button onClick={() => shift(1)}
        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
        style={{ color: '#6B7280' }}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── Progress bar ─────────────────────────────────────────────
function ProgressBar({ spent, budget }) {
  if (!budget || budget <= 0) return null
  const pct   = Math.round((spent / budget) * 100)
  const width = Math.min(pct, 100)
  const color = pct >= 100 ? '#DC2626' : pct >= 80 ? '#E85D2F' : '#22C55E'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7280' }}>
        <span>{pkr(spent)} spent</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
        <div style={{ width: `${width}%`, background: color, height: '100%',
                      borderRadius: '9999px', transition: 'width 500ms ease' }} />
      </div>
    </div>
  )
}

// ── Single budget row ─────────────────────────────────────────
function BudgetRow({ label, color, icon, spent, budget, onSave, onDelete }) {
  const [value, setValue] = useState(budget ? String(budget) : '')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash]   = useState(null)
  const inputRef = useRef()

  useEffect(() => { setValue(budget ? String(budget) : '') }, [budget])

  const commit = async () => {
    const num = Number(value)
    if (value === '' && !budget) return
    if (value === String(budget)) return
    if (value === '' || num <= 0) {
      if (budget) {
        setSaving(true)
        try { await onDelete(); setFlash('ok') }
        catch { setFlash('err') }
        finally { setSaving(false); setTimeout(() => setFlash(null), 1200) }
      }
      return
    }
    setSaving(true)
    try { await onSave(num); setFlash('ok') }
    catch { setFlash('err') }
    finally { setSaving(false); setTimeout(() => setFlash(null), 1200) }
  }

  const ring = flash === 'ok'  ? '0 0 0 2px #22c55e'
             : flash === 'err' ? '0 0 0 2px #ef4444'
             : undefined

  return (
    <div className="rounded-xl border p-4 hover:bg-white/80 transition"
         style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: (color || '#94a3b8') + '18' }}>
          {categoryIcon(icon, color || '#94a3b8', 14)}
        </div>
        <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#0F1117' }}>
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Rs</span>
          <input
            ref={inputRef}
            type="number" min="1" step="1"
            placeholder="No limit"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
            disabled={saving}
            className="w-28 rounded-lg border text-right px-3 py-1.5 text-sm
                       placeholder-gray-300 disabled:opacity-50 transition"
            style={{ borderColor: '#E5E7EB', color: '#0F1117',
                     background: '#fff', boxShadow: ring }}
          />
          {budget > 0 && (
            <button onClick={async () => { setSaving(true); try { await onDelete() } finally { setSaving(false) } }}
                    disabled={saving} title="Remove budget"
                    className="text-gray-300 hover:text-red-400 transition">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {budget > 0 && <ProgressBar spent={spent} budget={budget} />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function BudgetsPage() {
  const { user }                  = useAuth()
  const { activeWorkspace }       = useWorkspace()
  const { expenses }              = useExpenses(activeWorkspace?.id)

  const [month,      setMonth]      = useState(new Date().toISOString().slice(0, 7))
  const [budgets,    setBudgets]    = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [dirty,      setDirty]      = useState(false)

  // Spend map for current month
  const spendMap = {}
  let totalSpend = 0
  expenses.forEach(e => {
    if (e.date?.slice(0, 7) !== month) return
    spendMap[e.category_id] = (spendMap[e.category_id] || 0) + Number(e.amount)
    totalSpend += Number(e.amount)
  })

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const [bRes, cRes] = await Promise.all([
        getBudgets(activeWorkspace.id, month),
        getCategories(activeWorkspace.id),
      ])
      setBudgets(bRes.data || [])
      setCategories(cRes.data || [])
    } catch (e) {
      console.error('[BudgetsPage]', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeWorkspace, month])

  const budgetFor = (categoryId) => {
    const row = budgets.find(b => categoryId === null
      ? b.category_id === null : b.category_id === categoryId)
    return row?.amount ? Number(row.amount) : 0
  }

  const handleSave = async (categoryId, amount) => {
    await upsertBudget(activeWorkspace.id, categoryId, month, amount)
    setDirty(true)
    await load()
  }

  const handleDelete = async (categoryId) => {
    await deleteBudget(activeWorkspace.id, categoryId, month)
    setDirty(true)
    await load()
  }

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} color="#2563EB" />
            <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Budgets</h1>
          </div>
          <MonthPicker value={month} onChange={setMonth} />
        </div>

        {/* Arc rings */}
        {budgets.length > 0 && (
          <div className="mb-6">
            <BudgetRings
              budgets={budgets}
              categories={categories}
              expenses={expenses}
              month={month}
            />
          </div>
        )}

        {loading ? (
          <div className="card p-10 text-center animate-pulse text-sm" style={{ color: '#9CA3AF' }}>
            Loading budgets…
          </div>
        ) : (
          <div className="card p-6">
            <div className="mb-5">
              <p className="section-label mb-3">Workspace Total</p>
              <BudgetRow
                label="All Categories Combined"
                color="#2563EB"
                icon="Wallet"
                spent={totalSpend}
                budget={budgetFor(null)}
                onSave={amount => handleSave(null, amount)}
                onDelete={() => handleDelete(null)}
              />
            </div>

            <div>
              <p className="section-label mb-3">Per Category</p>
              {categories.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>
                  No categories found.
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map(cat => (
                    <BudgetRow
                      key={cat.id}
                      label={cat.name}
                      color={cat.color}
                      icon={cat.icon}
                      spent={spendMap[cat.id] || 0}
                      budget={budgetFor(cat.id)}
                      onSave={amount => handleSave(cat.id, amount)}
                      onDelete={() => handleDelete(cat.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-xs mt-5" style={{ color: '#9CA3AF' }}>
              Type an amount and press <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> or
              click away to save. Clear a field to remove the budget.
            </p>
          </div>
        )}

        {budgets.length === 0 && !loading && (
          <div className="card p-10 text-center mt-4">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0F1117' }}>
              No budgets set for {new Date(`${month}-15`).toLocaleString('en-PK', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Enter a limit next to any category above to create one.
            </p>
          </div>
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
