import { supabase } from './lib/supabase'

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

export async function createExpense(workspaceId, expense) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      workspace_id: workspaceId,
      created_by: user.id,
      ...expense,
    })
    .select('*, categories(name, icon, color)')
    .single()

  if (error) throw error
  return { success: true, data }
}

export async function deleteExpense(id) {
  // Soft delete — set deleted_at
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
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

// ── Stats (via backend for complex aggregation) ──────────────────────
export async function getStats(workspaceId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`http://localhost:5000/api/stats?workspace_id=${workspaceId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to fetch stats')
  }

  return res.json()
}
