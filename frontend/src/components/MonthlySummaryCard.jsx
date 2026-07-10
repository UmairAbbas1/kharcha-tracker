/**
 * MonthlySummaryCard.jsx
 * Dismissible card showing the previous month's AI-generated spending summary.
 * Dismissal is persisted in localStorage — won't reappear after refresh.
 */

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import KharchaLogo from './KharchaLogo'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function dismissKey(workspaceId, month) {
  return `dismissed_summary_${workspaceId}_${month}`
}

/**
 * @param {{
 *   summary: {
 *     workspace_id: string,
 *     month:        string,
 *     summary_text: string,
 *     total_spend:  number,
 *   },
 *   momChange: number | null,
 * }} props
 */
export default function MonthlySummaryCard({ summary, momChange }) {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(dismissKey(summary.workspace_id, summary.month))
  )

  if (dismissed) return null

  const monthLabel = new Date(`${summary.month}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })

  const handleDismiss = () => {
    localStorage.setItem(dismissKey(summary.workspace_id, summary.month), '1')
    setDismissed(true)
  }

  // MoM indicator
  const MomIcon = momChange === null ? Minus
                : momChange > 0      ? TrendingUp
                :                      TrendingDown
  const momColor = momChange === null ? 'text-gray-400'
                 : momChange > 0      ? 'text-red-500'
                 :                      'text-green-600'
  const momText = momChange === null
    ? 'First month on record'
    : `${momChange > 0 ? '+' : ''}${momChange}% vs last month`

  return (
    <div className="card overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-border">
        <div className="flex items-center gap-2.5">
          <KharchaLogo size={22} color="#2563EB" />
          <div>
            <p className="text-xs font-bold text-accent uppercase tracking-wider">
              Monthly Summary
            </p>
            <p className="text-sm font-bold text-ink -mt-0.5">
              {monthLabel}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          title="Dismiss"
          className="text-slate hover:text-ink transition p-1 rounded-lg
                     hover:bg-surface"
        >
          <X size={15} />
        </button>
      </div>

      {/* Summary text */}
      <div className="px-4 py-3">
        <p className="text-sm text-ink leading-relaxed">
          {summary.summary_text}
        </p>
      </div>

      {/* Metrics footer */}
      <div className="px-4 py-2.5 border-t border-border bg-surface
                      flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate">Total spend:</span>
          <span className="text-xs font-bold text-accent">
            {pkr(summary.total_spend)}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${momColor}`}>
          <MomIcon size={12} />
          <span>{momText}</span>
        </div>
      </div>

    </div>
  )
}
