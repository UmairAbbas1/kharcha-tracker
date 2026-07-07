/**
 * alertLogger.js
 * Handles deduplication checks and audit trail writes for alert_logs table.
 * Always uses the service-role admin client to bypass RLS.
 */

/**
 * Check if an alert has already been sent for this exact combination.
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string}      workspaceId
 * @param {string|null} categoryId   - null = workspace-level budget
 * @param {string}      month        - "YYYY-MM"
 * @param {number}      threshold    - 80 | 90 | 100
 * @returns {Promise<boolean>}
 */
export async function hasBeenSent(adminClient, workspaceId, categoryId, month, threshold) {
  try {
    const query = adminClient
      .from('alert_logs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('month', month)
      .eq('threshold', threshold)

    // category_id can be null (workspace-level) — handle both cases
    if (categoryId === null) {
      query.is('category_id', null)
    } else {
      query.eq('category_id', categoryId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('[alertLogger.hasBeenSent] query error:', error.message)
      // Fail safe: treat as already sent to avoid spam on DB errors
      return true
    }

    return data !== null
  } catch (err) {
    console.error('[alertLogger.hasBeenSent] unexpected error:', err)
    return true
  }
}

/**
 * Record a sent alert in alert_logs.
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string}      workspaceId
 * @param {string|null} categoryId
 * @param {string}      month
 * @param {number}      threshold
 * @param {Array<{channel: string, status: string}>} channels
 * @returns {Promise<void>}
 */
export async function record(adminClient, workspaceId, categoryId, month, threshold, channels) {
  try {
    const { error } = await adminClient
      .from('alert_logs')
      .insert({
        workspace_id: workspaceId,
        category_id:  categoryId ?? null,
        month,
        threshold,
        channels,
      })

    if (error) {
      // Unique constraint violation = already logged (race condition) — safe to ignore
      if (error.code === '23505') return
      console.error('[alertLogger.record] insert error:', error.message)
    }
  } catch (err) {
    console.error('[alertLogger.record] unexpected error:', err)
  }
}
