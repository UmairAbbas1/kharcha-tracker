import { useState } from 'react'
import { AlertTriangle, AlertOctagon, X } from 'lucide-react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

const CONFIG = {
  100: {
    icon:      AlertOctagon,
    bg:        'bg-red-50',
    border:    'border-red-300',
    text:      'text-red-700',
    iconColor: '#dc2626',
    label:     'Budget Exceeded',
  },
  90: {
    icon:      AlertTriangle,
    bg:        'bg-orange-50',
    border:    'border-orange-300',
    text:      'text-orange-700',
    iconColor: '#ea580c',
    label:     'Budget Critical',
  },
  80: {
    icon:      AlertTriangle,
    bg:        'bg-amber-50',
    border:    'border-amber-300',
    text:      'text-amber-700',
    iconColor: '#d97706',
    label:     'Budget Warning',
  },
}

function Banner({ log, onDismiss }) {
  const threshold = log.threshold
  const cfg       = CONFIG[threshold] || CONFIG[80]
  const Icon      = cfg.icon

  const catName   = log.categories?.name || 'Total Workspace Budget'
  const monthLabel = new Date(`${log.month}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3
                  ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <Icon size={16} color={cfg.iconColor} className="flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <span className="font-bold text-sm">{cfg.label} — {catName}</span>
        <span className="text-xs ml-2 opacity-75">
          {threshold}% of budget reached · {monthLabel}
        </span>
      </div>

      <button
        onClick={() => onDismiss(log.id)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/**
 * BudgetBanner
 * Shows ONE banner per category/scope — the highest threshold crossed.
 * Showing 80% + 90% + 100% simultaneously is noise; only the worst matters.
 *
 * @param {{ alertLogs: Array }} props
 */
export default function BudgetBanner({ alertLogs = [] }) {
  const [dismissed, setDismissed] = useState(new Set())

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]))

  // Group by scope key (category_id or 'workspace'), keep only highest threshold
  const topPerScope = Object.values(
    alertLogs.reduce((acc, log) => {
      const key = log.category_id ?? '__workspace__'
      if (!acc[key] || log.threshold > acc[key].threshold) {
        acc[key] = log
      }
      return acc
    }, {})
  )

  const visible = topPerScope
    .filter(l => !dismissed.has(l.id))
    // Highest threshold first (100 → 90 → 80)
    .sort((a, b) => b.threshold - a.threshold)

  if (!visible.length) return null

  return (
    <div className="flex flex-col gap-2">
      {visible.map(log => (
        <Banner key={log.id} log={log} onDismiss={dismiss} />
      ))}
    </div>
  )
}
