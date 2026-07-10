/**
 * BudgetModal.jsx
 * Full-screen modal for managing monthly budgets.
 *
 * - One row per category + one row for "Total Workspace Budget" (category_id = null)
 * - Each row shows current spend progress vs budget
 * - Upsert on blur / Enter — no separate Save button per row
 * - Single "Close" button at bottom
 */

import { useState, useEffect, useRef } from 'react'
import { X, Wallet, Trash2 } from 'lucide-react'
import { getBudgets, upsertBudget, deleteBudget } from '../api'
import { categoryIcon } from './CategoryIcon'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

// ── Small progress bar — animated, color shifts with usage ───
function ProgressBar({ spent, budget }) {
  if (!budget || budget <= 0) return null

  const truePct  = Math.round((spent / budget) * 100)
  const barWidth = Math.min(truePct, 100)

  const color = truePct >= 100 ? '#ef4444'   // red — exceeded
              : truePct >= 80  ? '#f59e0b'   // amber — warning
              :                  '#22c55e'   // green — healthy

  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Spent: {pkr(spent)}</span>
        <span style={{ color, fontWeight: 700 }}>{truePct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          style={{
            width:      `${barWidth}%`,
            background: color,
            height:     '100%',
            borderRadius: '9999px',
            transition: 'width 600ms ease, background 300ms ease',
          }}
        />
      </div>
    </div>
  )
}

// ── Single budget row ─────────────────────────────────────────
function BudgetRow({ label, color, icon, spent, budget, onSave, onDelete }) {
  const [value,   setValue]   = useState(budget ? String(budget) : '')
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState(null) // 'ok' | 'err'
  const inputRef = useRef()

  // Sync if parent prop changes (e.g. after refetch)
  useEffect(() => {
    setValue(budget ? String(budget) : '')
  }, [budget])

  const commit = async () => {
    const num = Number(value)
    if (value === '' && !budget) return   // nothing to do
    if (value === String(budget)) return  // no change

    if (value === '' || num <= 0) {
      // Empty = delete budget
      if (budget) {
        setSaving(true)
        try {
          await onDelete()
          setFlash('ok')
        } catch { setFlash('err') }
        finally { setSaving(false); setTimeout(() => setFlash(null), 1500) }
      }
      return
    }

    setSaving(true)
    try {
      await onSave(num)
      setFlash('ok')
    } catch { setFlash('err') }
    finally { setSaving(false); setTimeout(() => setFlash(null), 1500) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
  }

  const ringColor = flash === 'ok'  ? '0 0 0 2px #22c55e'
                  : flash === 'err' ? '0 0 0 2px #ef4444'
                  : saving          ? '0 0 0 2px #2563EB33'
                  : undefined

  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface border border-border px-4 py-3 hover:bg-white transition">
      {/* Top row: label + input */}
      <div className="flex items-center gap-3">
        {/* Category dot / icon */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color ? `${color}22` : '#94a3b822' }}
        >
          {categoryIcon(icon, color || '#94a3b8', 15)}
        </div>

        {/* Label */}
        <span className="flex-1 text-sm font-semibold text-gray-700 truncate">
          {label}
        </span>

        {/* Amount input */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-bold">Rs</span>
          <input
            ref={inputRef}
            type="number"
            min="1"
            step="1"
            placeholder="No limit"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-28 rounded-2xl border border-border bg-white px-3 py-1.5
                       text-sm text-gray-700 placeholder-gray-300 text-right
                       disabled:opacity-50 transition"
            style={{ boxShadow: ringColor }}
          />

          {/* Delete budget button — only shown if a budget exists */}
          {budget > 0 && (
            <button
              onClick={async () => { setSaving(true); try { await onDelete() } finally { setSaving(false) } }}
              disabled={saving}
              title="Remove budget"
              className="text-gray-300 hover:text-red-400 transition disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar — only if budget is set */}
      {budget > 0 && <ProgressBar spent={spent} budget={budget} />}
    </div>
  )
}

// ── Month navigator ───────────────────────────────────────────
function MonthPicker({ value, onChange }) {
  // value = "YYYY-MM"
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
      <button
        onClick={() => shift(-1)}
        className="w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-royal transition"
      >
        ‹
      </button>
      <span className="text-sm font-bold text-gray-700 w-32 text-center">{label}</span>
      <button
        onClick={() => shift(1)}
        className="w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-royal transition"
      >
        ›
      </button>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────
export default function BudgetModal({ workspaceId, categories, expenses, onClose, onBudgetChanged }) {
  const [month,      setMonth]      = useState(new Date().toISOString().slice(0, 7))
  const [budgets,    setBudgets]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [dirty,      setDirty]      = useState(false)  // true if any budget was saved/deleted

  // Pre-compute spend per category for this month
  const spendMap = {}
  let totalSpend = 0
  expenses.forEach(e => {
    if (e.date?.slice(0, 7) !== month) return
    const cid = e.category_id
    spendMap[cid] = (spendMap[cid] || 0) + Number(e.amount)
    totalSpend   += Number(e.amount)
  })

  const fetchBudgets = async () => {
    setLoading(true)
    try {
      const res = await getBudgets(workspaceId, month)
      setBudgets(res.data || [])
    } catch (err) {
      console.error('[BudgetModal] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBudgets() }, [workspaceId, month])

  // Budget lookup helpers
  const budgetFor = (categoryId) => {
    const row = budgets.find(b =>
      categoryId === null
        ? b.category_id === null
        : b.category_id === categoryId
    )
    return row?.amount ? Number(row.amount) : 0
  }

  const handleSave = async (categoryId, amount) => {
    await upsertBudget(workspaceId, categoryId, month, amount)
    setDirty(true)
    await fetchBudgets()
  }

  const handleDelete = async (categoryId) => {
    await deleteBudget(workspaceId, categoryId, month)
    setDirty(true)
    await fetchBudgets()
  }

  // On close — notify parent to refresh alert logs if anything changed
  const handleClose = () => {
    if (dirty) onBudgetChanged?.()
    onClose()
  }

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) handleClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={handleBackdrop}
    >
      <div className="card-panel w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Wallet size={18} color="#2563EB" />
            <h2 className="text-base font-bold text-ink tracking-tight">
              Budget Settings
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <MonthPicker value={month} onChange={setMonth} />
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-700 transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">

          {loading ? (
            <div className="text-center py-10 text-sm text-gray-400">Loading…</div>
          ) : (
            <>
              {/* Workspace-level total budget */}
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">
                  Total Workspace Budget
                </p>
                <BudgetRow
                  label="All Categories Combined"
                  color="#2563EB"
                  icon="Wallet"
                  spent={totalSpend}
                  budget={budgetFor(null)}
                  onSave={(amount) => handleSave(null, amount)}
                  onDelete={() => handleDelete(null)}
                />
              </div>

              {/* Per-category budgets */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">
                  Per Category
                </p>
                <div className="space-y-2">
                  {categories.map(cat => (
                    <BudgetRow
                      key={cat.id}
                      label={cat.name}
                      color={cat.color}
                      icon={cat.icon}
                      spent={spendMap[cat.id] || 0}
                      budget={budgetFor(cat.id)}
                      onSave={(amount) => handleSave(cat.id, amount)}
                      onDelete={() => handleDelete(cat.id)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <p className="text-xs text-gray-400 text-center mb-3">
            Type an amount and press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Enter</kbd> or click away to save.
            Clear a field to remove the budget.
          </p>
          <button
            onClick={handleClose}
            className="w-full rounded-2xl py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95"
            style={{ background: '#2563EB' }}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  )
}
