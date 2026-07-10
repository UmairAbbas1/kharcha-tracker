import { supabase } from './lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

// Helper: get current session token for backend calls
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

// ── Expenses ──────────────────────────────────────────────────────────
export async function getExpenses(workspaceId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, categories(name, icon, color)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error
  return { success: true, data }
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
export async function scanVoice(audioBlob, categories = []) {  const token = await getToken()

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
