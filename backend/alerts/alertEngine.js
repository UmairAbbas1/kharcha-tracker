/**
 * alertEngine.js
 * Orchestrates the full alert evaluation pipeline.
 *
 * Called fire-and-forget after a successful expense insert.
 * Never throws — all errors are logged internally.
 *
 * Flow:
 *   evaluate(workspaceId, categoryId, month)
 *     → getThresholdsCrossed (category-level budget)
 *     → getThresholdsCrossed (workspace-level budget)
 *     → for each new threshold:
 *         fetch owners → Promise.allSettled([email, whatsapp])
 *         → record in alert_logs
 */

import { getThresholdsCrossed }  from './budgetCalculator.js'
import { record }                from './alertLogger.js'
import { send as sendEmail }     from './channels/emailChannel.js'
import { send as sendWhatsApp }  from './channels/whatsappChannel.js'

/**
 * Main entry point. Fire-and-forget — does not throw.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string}      workspaceId
 * @param {string}      categoryId   - the category of the just-inserted expense
 * @param {string}      month        - "YYYY-MM"
 */
export async function evaluate(adminClient, workspaceId, categoryId, month) {
  try {
    // Evaluate both scopes in parallel: category-level + workspace-level
    const [catResult, wsResult] = await Promise.all([
      getThresholdsCrossed(adminClient, workspaceId, categoryId, month),
      getThresholdsCrossed(adminClient, workspaceId, null, month),
    ])

    const scopes = [
      { result: catResult, scopeCategoryId: categoryId },
      { result: wsResult,  scopeCategoryId: null },
    ].filter(s => s.result !== null && s.result.newThresholds.length > 0)

    if (scopes.length === 0) return

    // Fetch workspace owners once (shared across all threshold dispatches)
    const owners = await fetchOwners(adminClient, workspaceId)
    if (owners.length === 0) {
      console.warn(`[alertEngine] no owners found for workspace ${workspaceId}`)
      return
    }

    // Dispatch each scope's new thresholds
    for (const { result, scopeCategoryId } of scopes) {
      for (const threshold of result.newThresholds) {
        await dispatchAlert(
          adminClient,
          workspaceId,
          scopeCategoryId,
          month,
          threshold,
          result,
          owners
        )
      }
    }
  } catch (err) {
    // Top-level safety net — alert failure must never affect the HTTP response
    console.error('[alertEngine] unexpected error:', err)
  }
}

/**
 * Dispatch one alert (one threshold crossing) to all channels.
 */
async function dispatchAlert(
  adminClient,
  workspaceId,
  categoryId,
  month,
  threshold,
  result,
  owners
) {
  const payload = {
    workspaceName: result.workspaceName,
    categoryName:  result.categoryName,
    spent:         result.spent,
    budget:        result.budget,
    percent:       result.percent,
    threshold,
    month,
  }

  console.log(
    `[alertEngine] dispatching alert — workspace=${workspaceId} ` +
    `category=${categoryId ?? 'workspace-level'} ` +
    `threshold=${threshold}% month=${month}`
  )

  // Email recipients: all owners
  const emailRecipients = owners
    .filter(o => o.email)
    .map(o => ({ email: o.email }))

  // WhatsApp recipients: owners who have a number in profiles
  const waRecipients = owners
    .filter(o => o.whatsappNumber)
    .map(o => ({ whatsappNumber: o.whatsappNumber }))

  // Send both channels in parallel, never let one failure block the other
  const [emailResult, waResult] = await Promise.allSettled([
    sendEmail(emailRecipients, payload),
    sendWhatsApp(waRecipients, payload),
  ])

  const channels = [
    {
      channel: 'email',
      status:  emailResult.status === 'fulfilled'
               ? emailResult.value.status
               : 'failed',
    },
    {
      channel: 'whatsapp',
      status:  waResult.status === 'fulfilled'
               ? waResult.value.status
               : 'failed',
    },
  ]

  if (emailResult.status === 'rejected') {
    console.error('[alertEngine] email channel threw:', emailResult.reason)
  }
  if (waResult.status === 'rejected') {
    console.error('[alertEngine] whatsapp channel threw:', waResult.reason)
  }

  // Always record in alert_logs, even if channels partially failed.
  // This prevents retry spam if a channel is consistently failing.
  await record(adminClient, workspaceId, categoryId, month, threshold, channels)

  console.log(`[alertEngine] alert logged — threshold=${threshold} channels=`, channels)
}

/**
 * Fetch all owners of a workspace with their email + WhatsApp number.
 * Uses admin client to access auth.users and profiles.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} workspaceId
 * @returns {Promise<Array<{userId: string, email: string, whatsappNumber: string|null}>>}
 */
async function fetchOwners(adminClient, workspaceId) {
  try {
    // Get owner user IDs
    const { data: members, error: memErr } = await adminClient
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')

    if (memErr || !members?.length) return []

    const ownerIds = members.map(m => m.user_id)

    // Fetch emails from auth.users via admin API
    const { data: usersData } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    })

    const authUsers = (usersData?.users || []).filter(u => ownerIds.includes(u.id))

    // Fetch WhatsApp numbers from profiles
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, whatsapp_number')
      .in('id', ownerIds)

    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p.whatsapp_number])
    )

    return authUsers.map(u => ({
      userId:         u.id,
      email:          u.email,
      whatsappNumber: profileMap[u.id] || null,
    }))
  } catch (err) {
    console.error('[alertEngine.fetchOwners] error:', err)
    return []
  }
}
