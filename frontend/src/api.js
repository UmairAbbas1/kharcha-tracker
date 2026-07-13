import { supabase } from './lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

// Helper: get current session token for backend calls
// Uses refreshSession to ensure the token is never stale
async function getToken() {
  // Try to get existing session first
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  // If token expires in less than 60 seconds, refresh it proactively
  const expiresAt  = session.expires_at * 1000   // convert to ms
  const nowMs      = Date.now()
  const secsLeft   = (expiresAt - nowMs) / 1000

  if (secsLeft < 60) {
    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error || !refreshed.session) throw new Error('Session expired. Please sign in again.')
    return refreshed.session.access_token
  }

  return session.access_token
}

// ── Expenses ──────────────────────────────────────────────────────────
export async function getExpenses(workspaceId, filters = {}) {
  const token = await getToken()
  const params = new URLSearchParams({ workspace_id: workspaceId })

  if (filters.search) params.set('search', filters.search)
  if (filters.category_id) params.set('category_id', filters.category_id)
  if (filters.start_date) params.set('start_date', filters.start_date)
  if (filters.end_date) params.set('end_date', filters.end_date)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir)
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const res = await fetch(`${BACKEND}/api/expenses?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to fetch expenses')
  return json
}

export async function updateExpense(id, updates) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/expenses/${id}`, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to update expense')
  return json
}

// Routes through backend so the alert engine can fire after insert
export async function createExpense(workspaceId, expense) {
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/expenses`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      ...expense,
    }),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to create expense')
  return json
}

export async function deleteExpense(id) {
  // Route through backend so the service-role client bypasses RLS.
  // Direct Supabase client soft-delete fails when created_by != auth.uid()
  // (e.g. migrated expenses or expenses added by other workspace members).
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/expenses/${id}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to delete expense')
  return { success: true }
}

// ── Categories ────────────────────────────────────────────────────────
export async function getCategories(workspaceId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) throw error
  return { success: true, data }
}

export async function createCategory(workspaceId, category) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ workspace_id: workspaceId, ...category })
    .select()
    .single()

  if (error) throw error
  return { success: true, data }
}

// ── Stats (via backend for complex aggregation) ───────────────────────
export async function getStats(workspaceId) {
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/stats?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to fetch stats')
  }

  return res.json()
}

// ── Receipt OCR ───────────────────────────────────────────────────────
export async function scanReceipt(dataUri, categories = []) {
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/scan-receipt`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ image: dataUri, categories }),
  })

  // Guard against HTML error pages (e.g. body too large, server down)
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      res.status === 413
        ? 'Image too large. Please use a smaller photo.'
        : `Scan failed (server error ${res.status}). Is the backend running?`
    )
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Scan failed')
  return json.data
}

// ── Voice OCR ─────────────────────────────────────────────────────────
/**
 * Send an audio Blob to POST /api/scan-voice.
 * Returns { amount, category, vendor, date, transcript }.
 *
 * Uses FormData (not JSON) because the payload is a binary file.
 */
export async function scanVoice(audioBlob, categories = []) {
  const token = await getToken()

  const form = new FormData()
  form.append('audio',      audioBlob, 'recording.webm')
  form.append('categories', JSON.stringify(categories))

  const res = await fetch(`${BACKEND}/api/scan-voice`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    // Do NOT set Content-Type — browser sets it with correct boundary for FormData
    body: form,
  })

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      res.status === 413
        ? 'Recording too large. Please try a shorter recording.'
        : `Voice scan failed (server error ${res.status}). Is the backend running?`
    )
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Voice scan failed')
  return { ...json.data, transcript: json.transcript }
}

// ── SMS Parsing ───────────────────────────────────────────────────────
/**
 * Send raw SMS text to POST /api/scan-sms.
 * Returns { amount, category, vendor, date, method }.
 * method = 'regex' | 'llm'
 */
export async function scanSms(smsText, categories = []) {
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/scan-sms`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ smsText, categories }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `SMS scan failed (server error ${res.status}). Is the backend running?`
    )
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'SMS scan failed')
  return { ...json.data, method: json.method }
}

// ── Budgets ───────────────────────────────────────────────────────────

export async function getBudgets(workspaceId, month) {
  const query = supabase
    .from('budgets')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (month) query.eq('month', month)

  const { data, error } = await query
  if (error) throw error
  return { success: true, data }
}

/**
 * Insert or update a budget row.
 * Clears alert_logs for the workspace+month so stale banners don't reappear
 * after any budget amount changes.
 */
export async function upsertBudget(workspaceId, categoryId, month, amount) {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        workspace_id: workspaceId,
        category_id:  categoryId ?? null,
        month,
        amount:       Number(amount),
      },
      { onConflict: 'workspace_id,category_id,month' }
    )
    .select()
    .single()

  if (error) throw error

  // Clear stale alert_logs so the engine re-evaluates against the new amount
  // and banners don't show old threshold crossings that no longer apply.
  const token = await getToken()
  await fetch(`${BACKEND}/api/alert-logs`, {
    method:  'DELETE',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      month,
    }),
  }).catch(err => console.warn('[upsertBudget] failed to clear alert logs:', err))

  return { success: true, data }
}

export async function deleteBudget(workspaceId, categoryId, month) {
  const query = supabase
    .from('budgets')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('month', month)

  if (categoryId === null) {
    query.is('category_id', null)
  } else {
    query.eq('category_id', categoryId)
  }

  const { error } = await query
  if (error) throw error
  return { success: true }
}

// ── Alert logs (budget warning banners) ───────────────────────────────
export async function getAlertLogs(workspaceId, month) {
  const token = await getToken()

  const params = new URLSearchParams({ workspace_id: workspaceId })
  if (month) params.set('month', month)

  const res = await fetch(`${BACKEND}/api/alert-logs?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to fetch alert logs')
  }

  return res.json()
}

// ── Monthly Summary ───────────────────────────────────────────────────
/**
 * Fetch the monthly AI summary for a workspace.
 * Defaults to previous month on the backend if month is omitted.
 *
 * @param {string} workspaceId
 * @param {string} month  — "YYYY-MM" (optional)
 * @returns {Promise<{ success: boolean, data: object|null }>}
 */
export async function getMonthlySummary(workspaceId, month) {
  const token = await getToken()

  const params = new URLSearchParams({ workspace_id: workspaceId })
  if (month) params.set('month', month)

  const res = await fetch(`${BACKEND}/api/monthly-summary?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to fetch monthly summary')
  }

  return res.json()
}

// ── CSV Export ────────────────────────────────────────────────────────
/**
 * Downloads a CSV of expenses for a workspace.
 * Triggers a file download directly in the browser — no data returned.
 *
 * @param {string} workspaceId
 * @param {string} [month]  — "YYYY-MM" (optional, omit for all expenses)
 * @param {string} [filename] — override the suggested filename
 */
export async function exportCsv(workspaceId, month, filename) {
  const token = await getToken()

  const params = new URLSearchParams({ workspace_id: workspaceId })
  if (month) params.set('month', month)

  const res = await fetch(`${BACKEND}/api/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Export failed (${res.status}): ${text.slice(0, 100)}`)
  }

  // Get suggested filename from Content-Disposition, fall back to param
  const disposition = res.headers.get('content-disposition') || ''
  const match       = disposition.match(/filename="([^"]+)"/)
  const dlName      = filename || match?.[1] || `kharcha-export-${month || 'all'}.xlsx`

  // Trigger browser download without navigation
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = dlName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Natural Language Expense Assistant ───────────────────────────────

/**
 * Ask a natural-language question about expenses.
 * @param {string}   question     — e.g. "is hafte transport pe kitna hua"
 * @param {string}   workspaceId
 * @param {string[]} categories   — workspace category names for intent resolution
 * @returns {Promise<{ answer: string, intent: object, result: object }>}
 */
export async function askAssistant(question, workspaceId, categories = []) {
  const token = await getToken()

  const res = await fetch(`${BACKEND}/api/ask`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ question, workspaceId, categories }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Assistant request failed')
  return json
}

/**
 * Transcribe audio to text only — no expense extraction.
 * Used by InsightsCard voice input in 'transcript' mode.
 * @param {Blob} audioBlob
 * @returns {Promise<{ transcript: string }>}
 */
export async function transcribeOnly(audioBlob) {
  const token = await getToken()

  const form = new FormData()
  form.append('audio', audioBlob, 'question.webm')

  const res = await fetch(`${BACKEND}/api/transcribe`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Transcription failed')
  return { transcript: json.transcript }
}

// ── Notifications ─────────────────────────────────────────────────────
export async function getNotifications(workspaceId) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/notifications?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to fetch notifications')
  return json
}

export async function markNotificationRead(id) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/notifications/${id}/read`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to mark notification as read')
  return json
}

export async function markAllNotificationsRead(workspaceId) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/notifications/read-all`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to mark all notifications as read')
  return json
}

// ── Recurring Expenses ────────────────────────────────────────────────
export async function getRecurringExpenses(workspaceId) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/recurring?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to fetch recurring expenses')
  return json
}

export async function saveRecurringExpense(config) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/recurring`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(config),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to save recurring expense')
  return json
}

export async function updateRecurringExpense(id, updates) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/recurring/${id}`, {
    method:  'PUT',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to update recurring expense')
  return json
}

export async function getRecurringDrafts(workspaceId) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/recurring/drafts?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to fetch recurring drafts')
  return json
}

// ── Activity Logs ────────────────────────────────────────────────────
export async function getActivityLogs(workspaceId) {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/api/activity-logs?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to fetch activity logs')
  return json
}
