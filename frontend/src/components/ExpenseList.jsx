import { Trash2, Receipt } from 'lucide-react'
import { CAT_COLORS, CAT_BG, pkr } from '../constants'
import { categoryIcon } from './CategoryIcon'

function dateLabel(dateStr) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return dateStr.slice(5).replace('-', '/')
}

function CatBadge({ cat }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: CAT_BG[cat], color: CAT_COLORS[cat] }}
    >
      {cat}
    </span>
  )
}

function ExpenseRow({ expense, onDelete }) {
  return (
    <div className="expense-row flex items-center gap-3 py-3 px-1 border-b border-blue-50 last:border-0">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: CAT_BG[expense.category] }}
      >
        {categoryIcon(expense.category, CAT_COLORS[expense.category])}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{expense.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <CatBadge cat={expense.category} />
          <span className="text-xs text-gray-400">{dateLabel(expense.date)}</span>
        </div>
      </div>

      {/* Amount + Delete */}
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

export default function ExpenseList({ expenses, onDelete, loading }) {
  const sorted = [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  )

  return (
    <div className="glass rounded-3xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={15} color="#4169E1" />
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
          Recent Expenses
        </h2>
        <span className="ml-auto text-xs font-semibold text-gray-400 bg-blue-50 rounded-full px-2 py-0.5">
          {expenses.length}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm animate-pulse">
          Loading…
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-4xl mb-2">🪙</div>
          No expenses yet. Add your first kharcha!
        </div>
      ) : (
        <div className="mt-2 max-h-80 overflow-y-auto pr-1">
          {sorted.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
