import express    from 'express'
import cors       from 'cors'
import dotenv     from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.backend') })

// ── Supabase clients ──────────────────────────────────────────
const supabaseUrl     = process.env.SUPABASE_URL
const anonKey         = process.env.SUPABASE_ANON_KEY
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.backend')
  process.exit(1)
}

// Service role client — bypasses RLS, used for server-side-only operations
// (invitations, budget checks, admin tasks)
const adminClient = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null

// ── Express setup ─────────────────────────────────────────────
const app  = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

// ── Auth middleware ───────────────────────────────────────────
// Validates the Supabase JWT from the Authorization header
// Attaches supabase client scoped to the user to req.supabase
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing auth token' })
  }

  const token = authHeader.replace('Bearer ', '')

  // Create a user-scoped client (RLS will apply automatically)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Verify the token by fetching the user
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  req.user       = user
  req.supabase   = userClient
  req.adminSupabase = adminClient
  next()
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kharcha-tracker-api', version: '2.0.0' })
})

// ── Stats route (server-side aggregation) ────────────────────
// Kept on the backend to avoid exposing complex queries to the client
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const { data: workspaceMembers, error: wmErr } = await req.supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', req.user.id)

    if (wmErr) throw wmErr

    const workspaceIds = workspaceMembers.map(m => m.workspace_id)

    if (workspaceIds.length === 0) {
      return res.json({ success: true, data: { total: 0, count: 0, byCategory: [], byDay: [] } })
    }

    // Active workspace from query param (defaults to first)
    const workspaceId = req.query.workspace_id || workspaceIds[0]

    // Total + count
    const { data: expenses, error: expErr } = await req.supabase
      .from('expenses')
      .select('amount, date, categories(name, color)')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)

    if (expErr) throw expErr

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const count = expenses.length

    // By category
    const catMap = {}
    expenses.forEach(e => {
      const name = e.categories?.name || 'Other'
      const color = e.categories?.color || '#94a3b8'
      if (!catMap[name]) catMap[name] = { category: name, color, total: 0, count: 0 }
      catMap[name].total += Number(e.amount)
      catMap[name].count += 1
    })

    // By day (last 7 days)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 6)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const dayMap = {}
    expenses
      .filter(e => e.date >= cutoffStr)
      .forEach(e => { dayMap[e.date] = (dayMap[e.date] || 0) + Number(e.amount) })

    const byDay = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))

    res.json({
      success: true,
      data: {
        total,
        count,
        byCategory: Object.values(catMap),
        byDay,
      }
    })
  } catch (err) {
    console.error('[/api/stats]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Budget threshold check ────────────────────────────────────
app.get('/api/budget-status', requireAuth, async (req, res) => {
  const { workspace_id, month } = req.query
  if (!workspace_id || !month) {
    return res.status(400).json({ success: false, error: 'workspace_id and month required' })
  }

  try {
    // Get workspace-level budget for month
    const { data: budget } = await req.supabase
      .from('budgets')
      .select('amount')
      .eq('workspace_id', workspace_id)
      .eq('month', month)
      .is('category_id', null)
      .maybeSingle()

    if (!budget) {
      return res.json({ success: true, data: { status: 'no_budget', percent: null } })
    }

    // Get total spend for month
    const { data: expenses } = await req.supabase
      .from('expenses')
      .select('amount')
      .eq('workspace_id', workspace_id)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .is('deleted_at', null)

    const spent   = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
    const percent = Math.round((spent / Number(budget.amount)) * 100)
    const status  = percent >= 100 ? 'exceeded' : percent >= 80 ? 'warning' : 'ok'

    res.json({ success: true, data: { status, percent, spent, budget: Number(budget.amount) } })
  } catch (err) {
    console.error('[/api/budget-status]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Invite member ─────────────────────────────────────────────
app.post('/api/invite', requireAuth, async (req, res) => {
  const { workspace_id, email } = req.body

  if (!workspace_id || !email) {
    return res.status(400).json({ success: false, error: 'workspace_id and email required' })
  }

  if (!req.adminSupabase) {
    return res.status(503).json({ success: false, error: 'Admin client not configured (missing SERVICE_ROLE_KEY)' })
  }

  try {
    // Verify requester is owner
    const { data: membership } = await req.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (membership?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can invite members' })
    }

    // Check if user already exists
    const { data: existingUsers } = await req.adminSupabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Check not already a member
      const { data: alreadyMember } = await req.supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', existingUser.id)
        .maybeSingle()

      if (alreadyMember) {
        return res.status(409).json({ success: false, error: 'User is already a member' })
      }

      // Add directly
      const { error: insertErr } = await req.adminSupabase
        .from('workspace_members')
        .insert({ workspace_id, user_id: existingUser.id, role: 'member', invited_by: req.user.id })

      if (insertErr) throw insertErr

      return res.status(201).json({ success: true, message: 'Member added', userId: existingUser.id })
    }

    // New user — send invite email via Supabase Auth
    const { data: inviteData, error: inviteErr } = await req.adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_workspace: workspace_id, invited_by: req.user.id }
    })

    if (inviteErr) throw inviteErr

    res.status(201).json({ success: true, message: 'Invitation sent', email })
  } catch (err) {
    console.error('[/api/invite]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Guard: prevent last owner removal ────────────────────────
app.delete('/api/workspace/:workspaceId/members/:userId', requireAuth, async (req, res) => {
  const { workspaceId, userId } = req.params

  try {
    // Must be owner to remove anyone
    const { data: requesterMembership } = await req.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (requesterMembership?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can remove members' })
    }

    // Check last-owner guard
    const { data: targetMembership } = await req.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()

    if (targetMembership?.role === 'owner') {
      // Count other owners
      const { data: otherOwners } = await req.supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')
        .neq('user_id', userId)

      if (!otherOwners || otherOwners.length === 0) {
        return res.status(403).json({ success: false, error: 'Cannot remove the last owner of a workspace' })
      }
    }

    const { error: delErr } = await req.adminSupabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (delErr) throw delErr

    res.json({ success: true, message: 'Member removed' })
  } catch (err) {
    console.error('[DELETE /members]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Kharcha Tracker API v2 → http://localhost:${PORT}`)
  console.log(`   Supabase: ${supabaseUrl}`)
  console.log(`   Routes: /health  /api/stats  /api/budget-status  /api/invite`)
})
