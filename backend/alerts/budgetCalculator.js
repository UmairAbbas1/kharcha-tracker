/**
 * budgetCalculator.js
 * Fetches budget + spend data from Supabase, computes which thresholds
 * have been crossed and (via alertLogger) haven't been notified yet.
 */

import { hasBeenSent } from './alertLogger.js'

const THRESHOLDS = [80, 90, 100]

/**
 * Calculate budget status and return newly-crossed thresholds.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string}      workspaceId
 * @param {string|null} categoryId   - null = workspace-level budget
 * @param {string}      month        - "YYYY-MM"
 * @returns {Promise<{
 *   budget:          number,
 *   spent:           number,
 *   percent:         number,
 *   newThresholds:   number[],
 *   workspaceName:   string,
 *   categoryName:    string,
 * } | null>}
 */
export async function getThresholdsCrossed(adminClient, workspaceId, categoryId, month) {
  try {
    // ── 1. Fetch the budget row ───────────────────────────────
    const budgetQuery = adminClient
      .from('budgets')
      .select('amount')
      .eq('workspace_id', workspaceId)
      .eq('month', month)

    if (categoryId === null) {
      budgetQuery.is('category_id', null)
    } else {
      budgetQuery.eq('category_id', categoryId)
    }

    const { data: budgetRow, error: budgetErr } = await budgetQuery.maybeSingle()

    if (budgetErr) {
      console.error('[budgetCalculator] budget fetch error:', budgetErr.message)
      return null
    }

    // No budget configured for this scope — nothing to evaluate
    if (!budgetRow) return null

    const budgetAmount = Number(budgetRow.amount)

    // ── 2. Sum active expenses for scope + month ──────────────
    const startDate = `${month}-01`
    const endDate   = `${month}-31`   // PostgreSQL date comparison is safe here

    const expenseQuery = adminClient
      .from('expenses')
      .select('amount')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate)
      .lte('date', endDate)
      .is('deleted_at', null)

    if (categoryId !== null) {
      expenseQuery.eq('category_id', categoryId)
    }
    // if categoryId === null → workspace-level: sum ALL categories

    const { data: expenses, error: expErr } = await expenseQuery

    if (expErr) {
      console.error('[budgetCalculator] expense fetch error:', expErr.message)
      return null
    }

    const spent   = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0)
    const percent = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0

    // ── 3. Workspace name ─────────────────────────────────────
    const { data: ws } = await adminClient
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    const workspaceName = ws?.name || 'Your Workspace'

    // ── 4. Category name ──────────────────────────────────────
    let categoryName = 'Total Workspace Budget'
    if (categoryId !== null) {
      const { data: cat } = await adminClient
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single()
      categoryName = cat?.name || 'Unknown Category'
    }

    // ── 5. Find newly-crossed thresholds ─────────────────────
    const newThresholds = []

    for (const t of THRESHOLDS) {
      if (percent >= t) {
        const alreadySent = await hasBeenSent(
          adminClient, workspaceId, categoryId, month, t
        )
        if (!alreadySent) {
          newThresholds.push(t)
        }
      }
    }

    return {
      budget:        budgetAmount,
      spent,
      percent,
      newThresholds,
      workspaceName,
      categoryName,
    }
  } catch (err) {
    console.error('[budgetCalculator] unexpected error:', err)
    return null
  }
}
