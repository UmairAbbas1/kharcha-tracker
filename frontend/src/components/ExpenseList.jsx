import { useState } from 'react'
import { Trash2, Receipt, Download, Loader2 } from 'lucide-react'
import { categoryIcon } from './CategoryIcon'
import { exportCsv }   from '../api'

function dateLabel(dateStr) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return dateStr.slice(5).replace('-', '/')
}

function CatBadge({ name, color }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: color + '22', color }}
    >
      {name}
    </span>
  )
}

function ExpenseRow({ expense, onDelete }) {
  const cat   = expense.categories || {}
  const color = cat.color || '#94a3b8'
  const pkr   = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

  return (
    <div className="expense-row flex items-center gap-3 py-3 px-1 border-b border-blue-50 last:border-0">
      <div
        className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '1a' }}
      >
        {categoryIcon(cat.icon, color)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{expense.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <CatBadge name={cat.name || 'Other'} color={color} />
          <span className="text-xs text-gray-400">{dateLabel(expense.date)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-extrabold" style={{ color: '#4169E1' }}>
          {pkr(expense.amount)}
        </span>
        <button
          onClick={() => onDelete(expense.id)}
          className="del-btn w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
          title="Delete expense"
        >
          <Trash2 size={13} color="#f87171" />
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
    <div className="glass rounded-3xl p-6 shadow-lg">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={15} color="#4169E1" />
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
          Recent Expenses
        </h2>
        <span className="ml-auto text-xs font-semibold text-gray-400 bg-blue-50 rounded-full px-2 py-0.5 mr-1">
          {expenses.length}
        </span>

        {/* Export CSV button */}
        <button
          onClick={handleExport}
          disabled={exporting || expenses.length === 0}
          title={currentMonth ? `Export ${currentMonth} as CSV` : 'Export all as CSV'}
          className="flex items-center gap-1 rounded-xl border border-blue-100
                     bg-white/60 px-2.5 py-1 text-xs font-bold text-royal
                     hover:bg-blue-50 transition active:scale-95 disabled:opacity-40"
        >
          {exporting
            ? <Loader2 size={11} className="animate-spin" />
            : <Download size={11} />
          }
          {exporting ? 'Exporting…' : 'CSV'}
        </button>
      </div>

      {/* Export error */}
      {exportErr && (
        <p className="text-xs text-red-500 mb-2 pl-1">{exportErr}</p>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm animate-pulse">
          Loading…
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-4xl mb-2">🪙</div>
          No expenses yet. Add your first kharcha!
        </div>
      ) : (
        <div className="mt-2 max-h-80 overflow-y-auto pr-1">
          {expenses.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
