/**
 * aggregator.js
 * Aggregates workspace expenses for a given month.
 * Returns metrics needed for AI summary generation.
 *
 * Note: expense titles are intentionally excluded from all returned
 * data structures — they must never flow into the Groq prompt (REQ-AI-04).
 */

import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Returns the first and last day of a YYYY-MM month as ISO date strings.
 */
function monthBounds(month) {
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(year, mon - 1, 1)
  const last  = new Date(year, mon, 0)   // day 0 of next month = last day of this month
  return {
    start: first.toISOString().slice(0, 10),
    end:   last.toISOString().slice(0, 10),
  }
}

/**
 * Returns the YYYY-MM string for the month before the given month.
 */
function prevMonth(month) {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 2, 1)
  return d.toISOString().slice(0, 7)
}

/**
 * Aggregate expenses for one workspace for one month.
 *
 * @param {string} workspaceId
 * @param {string} month        — "YYYY-MM"
 * @returns {Promise<{
 *   totalSpend:     number,
 *   expenseCount:   number,
 *   topCategories:  Array<{ name: string, amount: number }>,
 *   biggestExpense: { amount: number, category: string } | null,
 *   momChange:      number | null,
 *   prevMonthSpend: number,
 * } | null>}  — null means zero expenses → skip
 */
export async function aggregate(workspaceId, month) {
  const admin = getAdmin()
  const { start, end } = monthBounds(month)

  // ── Fetch current month expenses with category names ──────
  const { data: expenses, error } = await admin
    .from('expenses')
    .select('amount, category_id, categories(name)')
    .eq('workspace_id', workspaceId)
    .gte('date', start)
    .lte('date', end)
    .is('deleted_at', null)

  if (error) throw error
  if (!expenses || expenses.length === 0) return null

  const totalSpend   = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const expenseCount = expenses.length

  // ── Per-category totals ───────────────────────────────────
  const catMap = {}
  let biggest = null

  for (const e of expenses) {
    const name   = e.categories?.name || 'Other'
    const amount = Number(e.amount)

    catMap[name] = (catMap[name] || 0) + amount

    if (!biggest || amount > biggest.amount) {
      biggest = { amount, category: name }
    }
  }

  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))

  // ── Previous month spend for MoM delta ───────────────────
  const prev                = prevMonth(month)
  const { start: ps, end: pe } = monthBounds(prev)

  const { data: prevExp } = await admin
    .from('expenses')
    .select('amount')
    .eq('workspace_id', workspaceId)
    .gte('date', ps)
    .lte('date', pe)
    .is('deleted_at', null)

  const prevMonthSpend = (prevExp || []).reduce((s, e) => s + Number(e.amount), 0)

  const momChange = prevMonthSpend > 0
    ? Math.round(((totalSpend - prevMonthSpend) / prevMonthSpend) * 100)
    : null

  return {
    totalSpend:     Math.round(totalSpend),
    expenseCount,
    topCategories,
    biggestExpense: biggest,
    momChange,
    prevMonthSpend: Math.round(prevMonthSpend),
  }
}
