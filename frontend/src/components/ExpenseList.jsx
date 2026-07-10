/**
 * ExpenseList.jsx — Redesigned expense rows.
 * Design choices:
 *   - 1px left border accent on each row (the only decorative element)
 *   - Delete button hover-reveals (not always visible — reduces clutter)
 *   - IBM Plex Mono for amounts
 *   - Category color dot replaces colored icon backgrounds
 *   - No rounded-full badges — cleaner, more editorial
 */

import { useState } from 'react'
import { Trash2, Download, Loader2 } from 'lucide-react'
import { categoryIcon } from './CategoryIcon'
import { exportCsv }    from '../api'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function dateLabel(dateStr) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}

function ExpenseRow({ expense, onDelete }) {
  const cat   = expense.categories || {}
  const color = cat.color || '#94a3b8'

  return (
    <div
      className="expense-row group flex items-center gap-3 py-3"
      style={{ borderBottom: '1px solid #F3F4F6' }}
    >
      {/* Left accent bar + icon */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div
          className="w-1 h-8 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: color + '15' }}
        >
          {categoryIcon(cat.icon, color, 14)}
        </div>
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate leading-tight">
          {expense.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
          <span style={{ color }}>{cat.name || 'Other'}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {dateLabel(expense.date)}
        </p>
      </div>

      {/* Amount + delete */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-sm font-semibold" style={{ color: '#0F1117' }}>
          {pkr(expense.amount)}
        </span>
        <button
          onClick={() => onDelete(expense.id)}
          className="del-btn w-6 h-6 rounded-md flex items-center justify-center
                     hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} color="#f87171" />
        </button>
      </div>
    </div>
  )
}

export default function ExpenseList({ expenses, onDelete, loading, workspaceId, currentMonth }) {
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState(null)

  const handleExport = async () => {
    if (!workspaceId) return
    setExporting(true)
    setExportErr(null)
    try {
      await exportCsv(workspaceId, currentMonth)
    } catch (err) {
      setExportErr(err.message)
      setTimeout(() => setExportErr(null), 4000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="section-label flex-1">Recent Expenses</span>
        <span
          className="font-mono text-xs font-medium px-2 py-0.5 rounded"
          style={{ background: '#F7F8FC', color: '#6B7280' }}
        >
          {expenses.length}
        </span>
        <button
          onClick={handleExport}
          disabled={exporting || expenses.length === 0}
          title="Export as Excel"
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1
                     text-xs font-semibold transition hover:bg-surface
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
        >
          {exporting
            ? <Loader2 size={11} className="animate-spin" />
            : <Download size={11} />
          }
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {exportErr && (
        <p className="text-xs mb-3" style={{ color: '#E85D2F' }}>{exportErr}</p>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm animate-pulse" style={{ color: '#6B7280' }}>
          Loading…
        </div>
      ) : expenses.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-2xl mb-2">🪙</p>
          <p className="text-sm" style={{ color: '#6B7280' }}>No expenses yet</p>
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {expenses.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
