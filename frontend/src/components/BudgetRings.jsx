/**
 * BudgetRings.jsx
 * Signature dashboard component — segmented arc rings per budget category.
 *
 * Each ring:
 *   - SVG stroke-dasharray arc, fills clockwise on mount (600ms ease-out)
 *   - Color: accent-blue < 80%, rupee-orange 80-99%, red >= 100%
 *   - Center text: percentage
 *   - Respects prefers-reduced-motion
 *
 * Shows top 3 budgeted categories. Workspace-level total is the largest ring.
 */

import { useEffect, useRef, useState } from 'react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

const ACCENT = '#2563EB'
const RUPEE  = '#E85D2F'
const TRACK  = '#F3F4F6'

function arcColor(pct) {
  if (pct >= 80)  return RUPEE
  return ACCENT
}

function Arc({ spent, budget, label, size = 100, stroke = 9 }) {
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const pct        = budget > 0 ? Math.round((spent / budget) * 100) : 0
  const displayPct = Math.min(pct, 100)
  const color      = arcColor(pct)

  const r          = (size - stroke) / 2
  const circ       = 2 * Math.PI * r
  const cx         = size / 2
  const cy         = size / 2

  // Animate from 0 to target dashoffset
  const targetOffset = circ * (1 - displayPct / 100)
  const [offset, setOffset] = useState(circ)   // start at 0%
  const frameRef = useRef(null)

  useEffect(() => {
    if (reduced) { setOffset(targetOffset); return }
    const duration = 600
    const startOffset = circ
    const start = performance.now()

    const step = (now) => {
      const t       = Math.min((now - start) / duration, 1)
      const eased   = 1 - Math.pow(1 - t, 3)
      const current = startOffset + (targetOffset - startOffset) * eased
      setOffset(current)
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [targetOffset])

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Arc */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={TRACK}
            strokeWidth={stroke}
          />
          {/* Arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="budget-arc"
            style={{ transition: reduced ? 'none' : undefined }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-semibold leading-none"
            style={{ fontSize: size * 0.18, color }}
          >
            {budget > 0 ? `${Math.min(pct, 999)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs font-semibold text-ink truncate max-w-[80px]">{label}</p>
        {budget > 0 && (
          <p className="font-mono text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {pkr(spent)} <span className="opacity-50">/</span> {pkr(budget)}
          </p>
        )}
        {budget === 0 && (
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>No budget set</p>
        )}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   budgets:    Array<{ category_id: string|null, amount: number }>,
 *   categories: Array<{ id: string, name: string, color: string }>,
 *   expenses:   Array<{ category_id: string, amount: number, date: string }>,
 *   month:      string,  — "YYYY-MM"
 * }} props
 */
export default function BudgetRings({ budgets = [], categories = [], expenses = [], month }) {
  if (!budgets.length) return null

  // Compute spend per category for this month
  const spendMap = {}
  let totalSpend = 0
  expenses.forEach(e => {
    if (!month || e.date?.slice(0, 7) === month) {
      spendMap[e.category_id] = (spendMap[e.category_id] || 0) + Number(e.amount)
      totalSpend += Number(e.amount)
    }
  })

  // Workspace-level budget (category_id = null)
  const totalBudget = budgets.find(b => b.category_id === null)

  // Per-category budgets — top 3 by budget amount
  const catBudgets = budgets
    .filter(b => b.category_id !== null)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map(b => {
      const cat = categories.find(c => c.id === b.category_id)
      return {
        id:     b.category_id,
        name:   cat?.name || 'Category',
        budget: Number(b.amount),
        spent:  spendMap[b.category_id] || 0,
      }
    })

  if (!totalBudget && catBudgets.length === 0) return null

  // Place total-spend ring in the center of the category rings
  const elements = []
  if (catBudgets[0]) {
    elements.push(
      <Arc
        key={catBudgets[0].id}
        spent={catBudgets[0].spent}
        budget={catBudgets[0].budget}
        label={catBudgets[0].name}
        size={88}
        stroke={8}
      />
    )
  }
  if (catBudgets[1]) {
    elements.push(
      <Arc
        key={catBudgets[1].id}
        spent={catBudgets[1].spent}
        budget={catBudgets[1].budget}
        label={catBudgets[1].name}
        size={88}
        stroke={8}
      />
    )
  }

  // Total Spend in the middle
  if (totalBudget) {
    elements.push(
      <Arc
        key="total"
        spent={totalSpend}
        budget={Number(totalBudget.amount)}
        label="Total"
        size={110}
        stroke={10}
      />
    )
  }

  if (catBudgets[2]) {
    elements.push(
      <Arc
        key={catBudgets[2].id}
        spent={catBudgets[2].spent}
        budget={catBudgets[2].budget}
        label={catBudgets[2].name}
        size={88}
        stroke={8}
      />
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
        <span className="section-label">Budget Progress</span>
      </div>

      <div className="flex items-center justify-around flex-wrap gap-6">
        {elements}
      </div>
    </div>
  )
}
