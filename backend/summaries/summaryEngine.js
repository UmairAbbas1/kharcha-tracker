/**
 * summaryEngine.js
 * Orchestrates monthly AI spending summary generation for all workspaces.
 *
 * ── CRON SETUP (cron-job.org — free) ─────────────────────────────────────
 * URL:    POST https://your-render-url.onrender.com/api/generate-monthly-summary
 * Schedule: 0 4 1 * * (1st of every month at 04:00 UTC = 09:00 PKT)
 * Headers:  Authorization: Bearer <your CRON_SECRET from .env.backend>
 * Body:     {} (month defaults to previous calendar month)
 * ─────────────────────────────────────────────────────────────────────────
 */

import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { aggregate }          from './aggregator.js'
import { sendSummaryEmail }   from './summaryEmailer.js'

const SUMMARY_TIMEOUT_MS = 15_000

let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Returns the previous calendar month as "YYYY-MM".
 */
export function previousMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

/**
 * Builds the Groq prompt from aggregated metrics.
 * Expense titles are never included (REQ-AI-04).
 */
function buildPrompt(workspaceName, month, metrics) {
  const monthLabel = new Date(`${month}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })

  const catLines = metrics.topCategories
    .map((c, i) => `  ${i + 1}. ${c.name}: Rs ${c.amount.toLocaleString()}`)
    .join('\n')

  const momLine = metrics.momChange !== null
    ? `${metrics.momChange > 0 ? '+' : ''}${metrics.momChange}% vs last month`
    : 'first month on record'

  return `You are a friendly personal finance assistant for a Pakistani expense tracker app called Kharcha Tracker.

Write a SINGLE paragraph (80-120 words) summarising last month's spending for this workspace.
Use a casual, warm, conversational tone — a natural mix of Roman Urdu and English is encouraged.
Address the user as "aap" or "you". Do NOT use bullet points, markdown, or headers.
Output plain text only — one paragraph, nothing else.
Include: brief overview of total spend, top spending category, month-over-month change, and ONE actionable tip.

Workspace: ${workspaceName}
Month: ${monthLabel}
Total spend: Rs ${metrics.totalSpend.toLocaleString()}
Number of expenses: ${metrics.expenseCount}
Top categories:
${catLines}
Month-over-month change: ${momLine}

Write the summary paragraph now:`
}

/**
 * Generates an AI summary paragraph for one workspace.
 *
 * @param {string} workspaceName
 * @param {string} month
 * @param {object} metrics — from aggregator.aggregate()
 * @returns {Promise<string>}  — plain text paragraph
 */
async function generateSummaryText(workspaceName, month, metrics) {
  const groq   = getGroq()
  const prompt = buildPrompt(workspaceName, month, metrics)

  const response = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  200,
    temperature: 0.7,
  })

  const text = response.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Groq returned empty summary')
  return text
}

/**
 * Process a single workspace — aggregate, generate, store, email.
 * Returns a result status object.
 */
async function processWorkspace(workspace, month, admin) {
  const wid  = workspace.id
  const name = workspace.name

  // ── Dedup check ──────────────────────────────────────────
  const { data: existing } = await admin
    .from('monthly_summaries')
    .select('id')
    .eq('workspace_id', wid)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    return { workspace_id: wid, workspace: name, status: 'skipped', reason: 'already_exists' }
  }

  // ── Aggregate ────────────────────────────────────────────
  const metrics = await aggregate(wid, month)
  if (!metrics) {
    return { workspace_id: wid, workspace: name, status: 'skipped', reason: 'no_expenses' }
  }

  // ── Generate summary with timeout guard ──────────────────
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Summary generation timed out')), SUMMARY_TIMEOUT_MS)
  )

  const summaryText = await Promise.race([
    generateSummaryText(name, month, metrics),
    timeoutPromise,
  ])

  // ── Store in DB ──────────────────────────────────────────
  const { error: insertErr } = await admin
    .from('monthly_summaries')
    .insert({
      workspace_id: wid,
      month,
      summary_text: summaryText,
      total_spend:  metrics.totalSpend,
    })

  if (insertErr) throw insertErr

  // ── Fetch owner email ────────────────────────────────────
  const { data: ownerMembership } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', wid)
    .eq('role', 'owner')
    .maybeSingle()

  let ownerEmail = null
  if (ownerMembership?.user_id) {
    const { data: { user } } = await admin.auth.admin.getUserById(ownerMembership.user_id)
    ownerEmail = user?.email || null
  }

  // ── Send email (failure doesn't affect result) ───────────
  const emailResult = await sendSummaryEmail(
    ownerEmail, name, month, summaryText, metrics
  ).catch(err => {
    console.error(`[summaryEngine] email failed for ${name}:`, err.message)
    return { status: 'failed' }
  })

  console.log(`[summaryEngine] ✓ ${name} — email: ${emailResult.status}`)
  return { workspace_id: wid, workspace: name, status: 'generated' }
}

/**
 * Main entry point — runs for all workspaces sequentially.
 *
 * @param {string} month — "YYYY-MM", defaults to previous month
 * @returns {Promise<{ processed, skipped, failed, results }>}
 */
export async function run(month) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('GROQ_API_KEY not configured'), { status: 503 })
  }

  const targetMonth = month || previousMonth()
  const admin       = getAdmin()

  // Fetch all workspaces
  const { data: workspaces, error } = await admin
    .from('workspaces')
    .select('id, name')

  if (error) throw error
  if (!workspaces?.length) {
    return { processed: 0, skipped: 0, failed: 0, results: [] }
  }

  console.log(`[summaryEngine] running for month=${targetMonth}, workspaces=${workspaces.length}`)

  const results    = []
  let processed    = 0
  let skipped      = 0
  let failed       = 0

  // Sequential — avoid Groq rate limits
  for (const ws of workspaces) {
    try {
      const result = await processWorkspace(ws, targetMonth, admin)
      results.push(result)
      if (result.status === 'generated') processed++
      else skipped++
    } catch (err) {
      console.error(`[summaryEngine] failed for ${ws.name}:`, err.message)
      results.push({
        workspace_id: ws.id,
        workspace:    ws.name,
        status:       'failed',
        reason:       err.message,
      })
      failed++
    }
  }

  console.log(`[summaryEngine] done — processed=${processed} skipped=${skipped} failed=${failed}`)
  return { processed, skipped, failed, results }
}
