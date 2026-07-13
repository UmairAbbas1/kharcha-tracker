import express    from 'express'
import cors       from 'cors'
import dotenv     from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { evaluate }             from './alerts/alertEngine.js'
import { scanReceipt }          from './ocr/receiptScanner.js'
import { transcribeAndExtract, transcribeOnly } from './ocr/voiceScanner.js'
import { parseAndExtract }      from './ocr/smsParser.js'
import { run as runSummaries, previousMonth } from './summaries/summaryEngine.js'
import { getActiveProvider }    from './ocr/providerFactory.js'
import { extractIntent }        from './insights/intentExtractor.js'
import { runQuery }             from './insights/queryRunner.js'
import { generateAnswer }       from './insights/answerGenerator.js'
import ExcelJS                  from 'exceljs'
import multer from 'multer'

// multer — memory storage, 10 MB limit, audio files only
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true)
    cb(new Error('Only audio files are accepted'), false)
  },
})

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

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return cb(null, true)
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      process.env.FRONTEND_URL,           // set this on Render once you have Vercel URL
    ].filter(Boolean)
    // Also allow any *.vercel.app subdomain
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true)
    }
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))  // large enough for base64 receipt images

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

// ── GET /api/workspace/:workspaceId/members — get workspace members with emails ──
app.get('/api/workspace/:workspaceId/members', requireAuth, async (req, res) => {
  const { workspaceId } = req.params

  try {
    const { data: members, error: memErr } = await req.supabase
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', workspaceId)

    if (memErr) throw memErr

    let emailMap = new Map()
    if (adminClient) {
      const { data: userData } = await adminClient.auth.admin.listUsers()
      if (userData?.users) {
        userData.users.forEach(u => emailMap.set(u.id, u.email))
      }
    }

    const processed = (members || []).map(m => ({
      ...m,
      email: emailMap.get(m.user_id) || 'Unknown User'
    }))

    res.json({ success: true, data: processed })
  } catch (err) {
    console.error('[GET /api/workspace/:workspaceId/members]', err)
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

// ── POST /api/generate-monthly-summary — cron-triggered ─────
app.post('/api/generate-monthly-summary', async (req, res) => {
  // Authenticate via shared CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
  const secret     = process.env.CRON_SECRET

  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ success: false, error: 'GROQ_API_KEY not configured' })
  }

  // Validate optional month param
  const { month } = req.body
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, error: 'month must be YYYY-MM' })
  }

  try {
    const targetMonth = month || previousMonth()
    const result      = await runSummaries(targetMonth)
    res.json({ success: true, month: targetMonth, ...result })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/generate-monthly-summary]', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── GET /api/monthly-summary — fetch one workspace's summary ─
app.get('/api/monthly-summary', requireAuth, async (req, res) => {
  const { workspace_id, month } = req.query

  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id required' })
  }

  // Validate user is a member of this workspace
  const { data: membership } = await req.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', req.user.id)
    .maybeSingle()

  if (!membership) {
    return res.status(403).json({ success: false, error: 'Not a member of this workspace' })
  }

  // Default to previous month if not specified
  const targetMonth = month || previousMonth()

  const { data, error } = await req.supabase
    .from('monthly_summaries')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('month', targetMonth)
    .maybeSingle()

  if (error) {
    console.error('[GET /api/monthly-summary]', error)
    return res.status(500).json({ success: false, error: error.message })
  }

  res.json({ success: true, data: data || null })
})

// ── POST /api/scan-sms — hybrid SMS expense extraction ───────
app.post('/api/scan-sms', requireAuth, async (req, res) => {
  const { smsText, categories } = req.body

  if (!smsText || typeof smsText !== 'string' || !smsText.trim()) {
    return res.status(400).json({
      success: false,
      error: 'smsText is required and must be under 1,000 characters',
    })
  }

  if (smsText.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'smsText is required and must be under 1,000 characters',
    })
  }

  try {
    const result = await parseAndExtract(smsText.trim(), categories || [])
    res.json({
      success: true,
      data: {
        amount:   result.amount,
        category: result.category,
        vendor:   result.vendor,
        date:     result.date,
      },
      method: result.method,
      hint:   'Please verify before saving',
    })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/scan-sms]', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── POST /api/scan-voice — transcribe audio + extract expense ─
app.post('/api/scan-voice', requireAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio file received' })
  }

  let categories = []
  try {
    categories = req.body.categories ? JSON.parse(req.body.categories) : []
  } catch { /* ignore parse error, default to [] */ }

  try {
    const result = await transcribeAndExtract(
      req.file.buffer,
      req.file.mimetype,
      categories
    )
    console.log('[scan-voice] extracted:', result)
    res.json({
      success:    true,
      transcript: result.transcript,
      data: {
        amount:   result.amount,
        category: result.category,
        vendor:   result.vendor,
        date:     result.date,
      },
      hint: 'Please verify before saving',
    })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/scan-voice]', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── POST /api/scan-receipt — OCR a receipt image (provider-agnostic) ─
app.post('/api/scan-receipt', requireAuth, async (req, res) => {
  const { image, categories } = req.body

  if (!image)
    return res.status(400).json({ success: false, error: 'No image provided' })

  try {
    const provider = getActiveProvider()
    const data     = await provider.scan(image, categories || [])
    console.log('[scan-receipt] extracted:', data)
    res.json({ success: true, data, hint: 'Please verify before saving' })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/scan-receipt] error:', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── GET /api/expenses — search, filter, sort, and paginate expenses ──
app.get('/api/expenses', requireAuth, async (req, res) => {
  const { workspace_id, search, category_id, start_date, end_date, sort_by, sort_dir, limit, offset } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    let dbQuery = req.supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)

    if (search) {
      dbQuery = dbQuery.ilike('title', `%${search.trim()}%`)
    }
    if (category_id) {
      dbQuery = dbQuery.eq('category_id', category_id)
    }
    if (start_date) {
      dbQuery = dbQuery.gte('date', start_date)
    }
    if (end_date) {
      dbQuery = dbQuery.lte('date', end_date)
    }

    const sCol = sort_by || 'date'
    const sDir = sort_dir || 'desc'
    dbQuery = dbQuery.order(sCol, { ascending: sDir === 'asc' })

    if (sCol !== 'id') {
      dbQuery = dbQuery.order('id', { ascending: false })
    }

    const pLimit = parseInt(limit) || 25
    const pOffset = parseInt(offset) || 0
    dbQuery = dbQuery.range(pOffset, pOffset + pLimit - 1)

    const { data: expenses, count, error } = await dbQuery
    if (error) throw error

    // Compute total sum of matching expenses for filters
    let totalSumQuery = req.supabase
      .from('expenses')
      .select('amount')
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)

    if (search) {
      totalSumQuery = totalSumQuery.ilike('title', `%${search.trim()}%`)
    }
    if (category_id) {
      totalSumQuery = totalSumQuery.eq('category_id', category_id)
    }
    if (start_date) {
      totalSumQuery = totalSumQuery.gte('date', start_date)
    }
    if (end_date) {
      totalSumQuery = totalSumQuery.lte('date', end_date)
    }

    const { data: sumData, error: sumError } = await totalSumQuery
    if (sumError) throw sumError
    const totalSum = (sumData || []).reduce((acc, curr) => acc + Number(curr.amount), 0)

    // Safe separate category lookup to satisfy implicit join drop safeguard (REQ-EXP-24)
    const { data: categories, error: catError } = await req.supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', workspace_id)

    if (catError) throw catError

    const catMap = new Map(categories.map(c => [c.id, c]))
    const processed = (expenses || []).map(e => ({
      ...e,
      categories: catMap.get(e.category_id) || null
    }))

    res.json({
      success: true,
      data: processed,
      count: count || 0,
      totalSum,
    })
  } catch (err) {
    console.error('[GET /api/expenses]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── PATCH /api/expenses/:id — update an expense ─────────────────────
app.patch('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { title, amount, category_id, date } = req.body

  try {
    const { data: expense, error: fetchErr } = await req.supabase
      .from('expenses')
      .select('id, workspace_id, title')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' })

    const updates = {}
    if (title !== undefined) updates.title = title.trim()
    if (amount !== undefined) {
      if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' })
      }
      updates.amount = Number(amount)
    }
    if (category_id !== undefined) updates.category_id = category_id || null
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Date must be in YYYY-MM-DD format' })
      }
      updates.date = date
    }

    const { data, error } = await req.supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    let category = null
    if (data.category_id) {
      const { data: cat } = await req.supabase
        .from('categories')
        .select('*')
        .eq('id', data.category_id)
        .maybeSingle()
      category = cat
    }

    res.json({
      success: true,
      data: {
        ...data,
        categories: category
      }
    })
  } catch (err) {
    console.error('[PATCH /api/expenses/:id]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── DELETE /api/expenses/:id — soft-delete an expense ───────
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  const { id } = req.params

  if (!id) return res.status(400).json({ success: false, error: 'Expense ID required' })

  try {
    // Verify the expense belongs to a workspace the user is a member of
    const { data: expense, error: fetchErr } = await req.supabase
      .from('expenses')
      .select('id, workspace_id, receipt_url')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' })

    // Use admin client for the actual update to bypass created_by RLS restriction
    if (!adminClient)
      return res.status(503).json({ success: false, error: 'Admin client not configured' })

    // Delete associated receipt image from storage if present
    if (expense.receipt_url) {
      try {
        const parts = expense.receipt_url.split('/receipts/')
        if (parts.length > 1) {
          const filePath = decodeURIComponent(parts[1])
          await adminClient.storage.from('receipts').remove([filePath])
          console.log(`[DELETE expense] deleted storage file: ${filePath}`)
        }
      } catch (err) {
        console.warn('[DELETE expense] failed to delete storage file:', err.message)
      }
    }

    const { error: updateErr } = await adminClient
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) throw updateErr

    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/expenses/:id]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /api/expenses/:id/split — save expense split portion records ──
app.post('/api/expenses/:id/split', requireAuth, async (req, res) => {
  const { id } = req.params
  const { splits } = req.body // [{ member_id, share_amount }]

  if (!splits || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ success: false, error: 'splits array is required' })
  }

  try {
    const { data: expense, error: fetchErr } = await req.supabase
      .from('expenses')
      .select('id, workspace_id, amount')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' })

    const sum = splits.reduce((acc, curr) => acc + Number(curr.share_amount), 0)
    if (Math.abs(sum - Number(expense.amount)) > 0.05) {
      return res.status(400).json({
        success: false,
        error: `Split sum (${sum}) must equal expense amount (${expense.amount})`
      })
    }

    const { error: deleteErr } = await req.supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', id)

    if (deleteErr) throw deleteErr

    const records = splits.map(s => ({
      expense_id:   id,
      member_id:    s.member_id,
      share_amount: Number(s.share_amount),
      settled:      false
    }))

    const { data, error: insertErr } = await req.supabase
      .from('expense_splits')
      .insert(records)
      .select()

    if (insertErr) throw insertErr

    res.json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/expenses/:id/split]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/splits/balances — calculate who-owes-whom unsettled debts ─
app.get('/api/splits/balances', requireAuth, async (req, res) => {
  const { workspace_id } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const { data: expenses, error: expErr } = await req.supabase
      .from('expenses')
      .select('id, created_by, title')
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)

    if (expErr) throw expErr

    if (!expenses || expenses.length === 0) {
      return res.json({ success: true, balances: [] })
    }

    const expenseIds = expenses.map(e => e.id)
    const expenseMap = new Map(expenses.map(e => [e.id, e]))

    const { data: splits, error: splitErr } = await req.supabase
      .from('expense_splits')
      .select('*')
      .in('expense_id', expenseIds)
      .eq('settled', false)

    if (splitErr) throw splitErr

    const debts = {}

    for (const split of splits) {
      const exp = expenseMap.get(split.expense_id)
      if (!exp) continue

      const payerId = exp.created_by
      const debtorId = split.member_id

      if (debtorId !== payerId) {
        if (!debts[debtorId]) debts[debtorId] = {}
        debts[debtorId][payerId] = (debts[debtorId][payerId] || 0) + Number(split.share_amount)
      }
    }

    const userIds = new Set()
    for (const debtorId in debts) {
      userIds.add(debtorId)
      for (const creditorId in debts[debtorId]) {
        userIds.add(creditorId)
      }
    }

    const simplified = []
    const usersArr = Array.from(userIds)
    const netBalances = {}
    usersArr.forEach(uid => { netBalances[uid] = 0 })

    for (const debtorId in debts) {
      for (const creditorId in debts[debtorId]) {
        const amt = debts[debtorId][creditorId]
        netBalances[debtorId] -= amt
        netBalances[creditorId] += amt
      }
    }

    const debtors = []
    const creditors = []
    for (const uid of usersArr) {
      const bal = netBalances[uid]
      if (bal < -0.01) {
        debtors.push({ id: uid, amount: -bal })
      } else if (bal > 0.01) {
        creditors.push({ id: uid, amount: bal })
      }
    }

    let debtorIdx = 0
    let creditorIdx = 0
    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const d = debtors[debtorIdx]
      const c = creditors[creditorIdx]

      const settleAmt = Math.min(d.amount, c.amount)
      simplified.push({
        debtor_id: d.id,
        creditor_id: c.id,
        amount: settleAmt
      })

      d.amount -= settleAmt
      c.amount -= settleAmt

      if (d.amount < 0.01) debtorIdx++
      if (c.amount < 0.01) creditorIdx++
    }

    let emailMap = new Map()
    if (adminClient) {
      const { data: userData } = await adminClient.auth.admin.listUsers()
      if (userData?.users) {
        userData.users.forEach(u => emailMap.set(u.id, u.email))
      }
    }

    const balances = simplified.map(b => ({
      ...b,
      debtor_email: emailMap.get(b.debtor_id) || 'Unknown User',
      creditor_email: emailMap.get(b.creditor_id) || 'Unknown User'
    }))

    res.json({ success: true, balances })
  } catch (err) {
    console.error('[GET /api/splits/balances]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /api/splits/settle — zero out balance between members ────────
app.post('/api/splits/settle', requireAuth, async (req, res) => {
  const { workspace_id, debtor_id, creditor_id } = req.body

  if (!workspace_id || !debtor_id || !creditor_id) {
    return res.status(400).json({ success: false, error: 'workspace_id, debtor_id, and creditor_id are required' })
  }

  try {
    const { data: expenses, error: expErr } = await req.supabase
      .from('expenses')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('created_by', creditor_id)
      .is('deleted_at', null)

    if (expErr) throw expErr

    if (expenses && expenses.length > 0) {
      const expenseIds = expenses.map(e => e.id)
      await req.supabase
        .from('expense_splits')
        .update({ settled: true })
        .in('expense_id', expenseIds)
        .eq('member_id', debtor_id)
        .eq('settled', false)
    }

    const { data: expensesRev } = await req.supabase
      .from('expenses')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('created_by', debtor_id)
      .is('deleted_at', null)

    if (expensesRev && expensesRev.length > 0) {
      const expenseIdsRev = expensesRev.map(e => e.id)
      await req.supabase
        .from('expense_splits')
        .update({ settled: true })
        .in('expense_id', expenseIdsRev)
        .eq('member_id', creditor_id)
        .eq('settled', false)
    }

    res.json({ success: true, message: 'Settlement completed' })
  } catch (err) {
    console.error('[POST /api/splits/settle]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/analytics/trends — aggregate trends by category/month ────
app.get('/api/analytics/trends', requireAuth, async (req, res) => {
  const { workspace_id, months } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  const numMonths = parseInt(months) || 6
  try {
    const { data: categories, error: catErr } = await req.supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', workspace_id)

    if (catErr) throw catErr

    const monthList = []
    const now = new Date()
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthList.push(d.toISOString().slice(0, 7))
    }

    const startDate = `${monthList[0]}-01`

    const { data: expenses, error: expErr } = await req.supabase
      .from('expenses')
      .select('*')
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)
      .gte('date', startDate)

    if (expErr) throw expErr

    const catMap = new Map(categories.map(c => [c.id, c.name]))

    const trendMap = new Map()
    monthList.forEach(m => {
      const initRow = { month: m }
      categories.forEach(cat => {
        initRow[cat.name] = 0
      })
      trendMap.set(m, initRow)
    })

    if (expenses) {
      for (const exp of expenses) {
        const m = exp.date?.slice(0, 7)
        if (trendMap.has(m)) {
          const row = trendMap.get(m)
          const catName = catMap.get(exp.category_id) || 'Other'
          row[catName] = (row[catName] || 0) + Number(exp.amount)
        }
      }
    }

    const trends = Array.from(trendMap.values())

    res.json({
      success: true,
      data: trends
    })
  } catch (err) {
    console.error('[GET /api/analytics/trends]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/budgets — fetch budgets for a workspace/month ───────────
app.get('/api/budgets', requireAuth, async (req, res) => {
  const { workspace_id, month } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    let query = req.supabase
      .from('budgets')
      .select('*')
      .eq('workspace_id', workspace_id)

    if (month) {
      query = query.eq('month', month)
    }

    const { data, error } = await query
    if (error) throw error

    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/budgets]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /api/budgets — create new budget ────────────────────────────
app.post('/api/budgets', requireAuth, async (req, res) => {
  const { workspace_id, category_id, month, amount } = req.body

  if (!workspace_id) return res.status(400).json({ success: false, error: 'workspace_id is required' })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, error: 'month must be YYYY-MM' })
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' })
  }

  try {
    let checkQuery = req.supabase
      .from('budgets')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('month', month)

    if (category_id === null || category_id === undefined) {
      checkQuery = checkQuery.is('category_id', null)
    } else {
      checkQuery = checkQuery.eq('category_id', category_id)
    }

    const { data: existing, error: checkError } = await checkQuery.maybeSingle()
    if (checkError) throw checkError
    if (existing) {
      return res.status(409).json({ success: false, error: 'A budget already exists for this category and month.' })
    }

    const { data, error } = await req.supabase
      .from('budgets')
      .insert({
        workspace_id,
        category_id: category_id || null,
        month,
        amount: Number(amount)
      })
      .select()
      .single()

    if (error) throw error

    if (adminClient) {
      await adminClient
        .from('alert_logs')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('month', month)
    }

    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/budgets]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── PATCH /api/budgets/:id — update budget amount ────────────────────
app.patch('/api/budgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { amount } = req.body

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' })
  }

  try {
    const { data: budget, error: fetchErr } = await req.supabase
      .from('budgets')
      .select('workspace_id, month')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!budget) return res.status(404).json({ success: false, error: 'Budget not found' })

    const { data, error } = await req.supabase
      .from('budgets')
      .update({ amount: Number(amount) })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (adminClient) {
      await adminClient
        .from('alert_logs')
        .delete()
        .eq('workspace_id', budget.workspace_id)
        .eq('month', budget.month)
    }

    res.json({ success: true, data })
  } catch (err) {
    console.error('[PATCH /api/budgets/:id]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── DELETE /api/budgets/:id — delete budget ──────────────────────────
app.delete('/api/budgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params

  try {
    const { data: budget, error: fetchErr } = await req.supabase
      .from('budgets')
      .select('workspace_id, month')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!budget) return res.status(404).json({ success: false, error: 'Budget not found' })

    const { error } = await req.supabase
      .from('budgets')
      .delete()
      .eq('id', id)

    if (error) throw error

    if (adminClient) {
      await adminClient
        .from('alert_logs')
        .delete()
        .eq('workspace_id', budget.workspace_id)
        .eq('month', budget.month)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/budgets/:id]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /api/expenses — create expense + fire alert engine ──
app.post('/api/expenses', requireAuth, async (req, res) => {
  const { workspace_id, category_id, title, amount, date, receipt_url } = req.body

  // Validation
  if (!workspace_id)
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  if (!category_id)
    return res.status(400).json({ success: false, error: 'category_id is required' })
  if (!title?.trim())
    return res.status(400).json({ success: false, error: 'Title is required' })
  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, error: 'Amount must be a positive number' })
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' })

  try {
    // Insert via user-scoped client so RLS applies (workspace membership check)
    const { data, error } = await req.supabase
      .from('expenses')
      .insert({
        workspace_id,
        created_by:  req.user.id,
        category_id,
        title:       title.trim(),
        amount:      Number(amount),
        date,
        receipt_url: receipt_url || null,
      })
      .select('*, categories(name, icon, color)')
      .single()

    if (error) throw error

    // ── Respond immediately — do NOT await the alert engine ──
    res.status(201).json({ success: true, data })

    // ── Fire-and-forget alert evaluation ─────────────────────
    const month = date.slice(0, 7) // "YYYY-MM"
    if (adminClient) {
      // setImmediate ensures the response is flushed before evaluation starts
      setImmediate(() => {
        evaluate(adminClient, workspace_id, category_id, month)
          .catch(err => console.error('[server] alert evaluation error:', err))
      })
    }
  } catch (err) {
    console.error('[POST /api/expenses]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── DELETE /api/alert-logs — clear stale logs when budget is updated ─
app.delete('/api/alert-logs', requireAuth, async (req, res) => {
  const { workspace_id, category_id, month } = req.body

  if (!workspace_id || !month)
    return res.status(400).json({ success: false, error: 'workspace_id and month required' })

  try {
    // Verify requester is a member of this workspace
    const { data: membership } = await req.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!membership)
      return res.status(403).json({ success: false, error: 'Not a member of this workspace' })

    // Use admin client to bypass RLS on alert_logs
    if (!req.adminSupabase)
      return res.status(503).json({ success: false, error: 'Admin client not configured' })

    const query = req.adminSupabase
      .from('alert_logs')
      .delete()
      .eq('workspace_id', workspace_id)
      .eq('month', month)

    // category_id === null means workspace-level; omitting it means clear all
    if (category_id === null) {
      query.is('category_id', null)
    } else if (category_id !== undefined) {
      query.eq('category_id', category_id)
    }
    // if category_id is omitted from body → clears all logs for workspace+month

    const { error } = await query

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/alert-logs]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/alert-logs — fetch alert history for a workspace ─
app.get('/api/alert-logs', requireAuth, async (req, res) => {
  const { workspace_id, month } = req.query

  if (!workspace_id)
    return res.status(400).json({ success: false, error: 'workspace_id is required' })

  try {
    const query = req.supabase
      .from('alert_logs')
      .select('*, categories(name, color)')
      .eq('workspace_id', workspace_id)
      .order('sent_at', { ascending: false })

    if (month) query.eq('month', month)

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/alert-logs]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── GET /api/export — styled Excel (.xlsx) download ──────────
app.get('/api/export', requireAuth, async (req, res) => {
  const { workspace_id, month } = req.query

  if (!workspace_id)
    return res.status(400).json({ success: false, error: 'workspace_id is required' })

  if (month && !/^\d{4}-\d{2}$/.test(month))
    return res.status(400).json({ success: false, error: 'month must be YYYY-MM' })

  try {
    // ── Fetch expenses ──────────────────────────────────────
    let query = req.supabase
      .from('expenses')
      .select('date, title, amount, categories(name, color)')
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })

    if (month) {
      const [y, m]  = month.split('-')
      const lastDay = new Date(Number(y), Number(m), 0).getDate()
      query = query
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
    }

    const { data: expenses, error: expErr } = await query
    if (expErr) throw expErr

    // ── Workspace name for filename ─────────────────────────
    const { data: ws } = await req.supabase
      .from('workspaces').select('name').eq('id', workspace_id).maybeSingle()

    const wName   = (ws?.name || 'workspace').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const suffix  = month || 'all'
    const filename = `kharcha-${wName}-${suffix}.xlsx`

    // ── Build Excel workbook with ExcelJS ───────────────────
    const wb      = new ExcelJS.Workbook()
    wb.creator    = 'Kharcha Tracker'
    wb.created    = new Date()

    const ws2 = wb.addWorksheet('Expenses', {
      pageSetup: { fitToPage: true, orientation: 'portrait' },
      views:     [{ state: 'frozen', ySplit: 1 }],   // freeze header row
    })

    // ── Column definitions ──────────────────────────────────
    ws2.columns = [
      { header: 'Date',           key: 'date',     width: 14 },
      { header: 'Title',          key: 'title',    width: 32 },
      { header: 'Category',       key: 'category', width: 16 },
      { header: 'Amount (PKR)',   key: 'amount',   width: 16 },
    ]

    // ── Header row styling (royal blue) ────────────────────
    const ROYAL    = '4169E1'
    const PINK     = 'F7A8C4'
    const LIGHT_BG = 'EEF2FF'
    const STRIPE   = 'F5F7FF'

    const headerRow = ws2.getRow(1)
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ROYAL}` } }
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: `FF${ROYAL}` } },
      }
    })
    headerRow.height = 24

    // ── Data rows ───────────────────────────────────────────
    const rows = (expenses || [])
    let totalAmount = 0

    rows.forEach((e, idx) => {
      const row = ws2.addRow({
        date:     e.date,             // will format below
        title:    e.title,
        category: e.categories?.name || 'Other',
        amount:   Number(e.amount),
      })

      totalAmount += Number(e.amount)

      // Alternating row background
      const bg = idx % 2 === 0 ? `FF${LIGHT_BG}` : `FF${STRIPE}`
      row.eachCell(cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.font      = { size: 11, name: 'Calibri' }
        cell.alignment = { vertical: 'middle' }
        cell.border    = {
          bottom: { style: 'hair', color: { argb: 'FFD0D8F0' } },
        }
      })

      // Date cell — proper date format, no ######
      const dateCell = row.getCell('date')
      dateCell.value       = new Date(e.date + 'T00:00:00')
      dateCell.numFmt      = 'DD-MMM-YYYY'
      dateCell.alignment   = { horizontal: 'center', vertical: 'middle' }

      // Amount cell — number format with comma separator
      const amtCell = row.getCell('amount')
      amtCell.numFmt    = '#,##0'
      amtCell.alignment = { horizontal: 'right', vertical: 'middle' }
      amtCell.font      = { bold: true, color: { argb: `FF${ROYAL}` }, size: 11, name: 'Calibri' }

      // Category cell — centered
      row.getCell('category').alignment = { horizontal: 'center', vertical: 'middle' }

      row.height = 20
    })

    // ── Total row ───────────────────────────────────────────
    if (rows.length > 0) {
      ws2.addRow({})  // blank spacer

      const totalRow = ws2.addRow({
        date:     '',
        title:    `Total — ${rows.length} expense${rows.length !== 1 ? 's' : ''}`,
        category: '',
        amount:   totalAmount,
      })
      totalRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PINK}` } }
        cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1E1E32' } }
        cell.alignment = { vertical: 'middle' }
      })
      const totalAmt = totalRow.getCell('amount')
      totalAmt.numFmt   = '#,##0'
      totalAmt.alignment = { horizontal: 'right', vertical: 'middle' }
      totalRow.getCell('title').alignment = { horizontal: 'left', vertical: 'middle' }
      totalRow.height = 22
    }

    // ── Branding row at bottom ──────────────────────────────
    ws2.addRow({})
    const brandRow = ws2.addRow({ title: 'Generated by Kharcha Tracker · kharcha-tracker.vercel.app' })
    brandRow.getCell('title').font = {
      italic: true, color: { argb: 'FF9CA3AF' }, size: 10, name: 'Calibri'
    }

    // ── Stream response ─────────────────────────────────────
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await wb.xlsx.write(res)
    res.end()

  } catch (err) {
    console.error('[GET /api/export]', err)
    // Only send JSON error if headers not yet sent
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
})

// ── POST /api/transcribe — Whisper transcript only (no expense extraction) ─
// Used by InsightsCard voice input — returns plain transcript, no LLM extraction
app.post('/api/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio file received' })
  }
  try {
    const result = await transcribeOnly(req.file.buffer, req.file.mimetype)
    res.json({ success: true, transcript: result.transcript })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/transcribe]', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── POST /api/ask — Natural Language Expense Assistant ────────────────
app.post('/api/ask', requireAuth, async (req, res) => {
  const { question, workspaceId, categories } = req.body

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ success: false, error: 'question is required' })
  }
  if (question.length > 500) {
    return res.status(400).json({ success: false, error: 'question must be under 500 characters' })
  }
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspaceId is required' })
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ success: false, error: 'AI assistant is not configured. Contact the workspace owner.' })
  }

  try {
    // Verify workspace membership (RLS backstop, explicit check for clarity)
    const { data: membership } = await req.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!membership) {
      return res.status(403).json({ success: false, error: 'Not a member of this workspace' })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // Step 1 — Extract intent (Groq call 1)
    const intent = await extractIntent(question.trim(), categories || [], todayStr)

    // Step 2a — Execute safe read-only query (req.supabase = user-scoped, RLS active)
    const result = await runQuery(req.supabase, workspaceId, intent, todayStr)

    // Step 2b — Generate conversational answer (Groq call 2)
    const answer = await generateAnswer(question.trim(), intent, result)

    console.log('[/api/ask] answered:', { aggregation: intent.aggregation, count: result.count })

    res.json({
      success: true,
      answer,
      intent,
      result: {
        value: result.value,
        count: result.count,
        ...(result.rows ? { rows: result.rows } : {}),
      },
    })
  } catch (err) {
    const status = err.status || 500
    console.error('[POST /api/ask]', err.message)
    res.status(status).json({ success: false, error: err.message })
  }
})

// ── Notifications Endpoints ──────────────────────────────────────────
// Fetch recent notifications for user in workspace
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { workspace_id } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const { data, error } = await req.supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/notifications]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' })
  }
})

// Mark single notification as read
app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await req.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[PUT /api/notifications/:id/read]', err)
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' })
  }
})

// Mark all notifications as read for user in workspace
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  const { workspace_id } = req.body
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const { data, error } = await req.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('workspace_id', workspace_id)
      .is('read_at', null)
      .select()

    if (error) throw error
    res.json({ success: true, count: data?.length || 0 })
  } catch (err) {
    console.error('[POST /api/notifications/read-all]', err)
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' })
  }
})

// ── Helper: Detect Recurring Candidate Expenses ─────────────────────
function detectRecurringCandidates(expenses) {
  const groups = {}
  expenses.forEach(e => {
    if (!e.title) return
    const vendor = e.title.trim().toLowerCase()
    if (!groups[vendor]) groups[vendor] = []
    groups[vendor].push(e)
  })

  const candidates = []

  Object.keys(groups).forEach(vendor => {
    const list = groups[vendor]
    if (list.length < 3) return

    list.sort((a, b) => new Date(a.date) - new Date(b.date))

    const entries = list.map(e => ({
      month: e.date.slice(0, 7),
      year: parseInt(e.date.slice(0, 4)),
      monthVal: parseInt(e.date.slice(5, 7)),
      amount: Number(e.amount),
      raw: e,
    }))

    // Find sets of 3 consecutive months
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        for (let k = j + 1; k < entries.length; k++) {
          const e1 = entries[i]
          const e2 = entries[j]
          const e3 = entries[k]

          const diff12 = (e2.year - e1.year) * 12 + (e2.monthVal - e1.monthVal)
          const diff23 = (e3.year - e2.year) * 12 + (e3.monthVal - e2.monthVal)

          if (diff12 === 1 && diff23 === 1) {
            const minAmt = Math.min(e1.amount, e2.amount, e3.amount)
            const maxAmt = Math.max(e1.amount, e2.amount, e3.amount)
            
            if (maxAmt > 0 && (maxAmt - minAmt) / maxAmt <= 0.10) {
              const avgAmount = Math.round((e1.amount + e2.amount + e3.amount) / 3)
              
              if (!candidates.some(c => c.vendor.toLowerCase() === vendor)) {
                candidates.push({
                  vendor: e3.raw.title,
                  amount: avgAmount,
                  category_id: e3.raw.category_id,
                  next_expected_date: calculateNextExpectedDate(e3.raw.date),
                })
              }
            }
          }
        }
      }
    }
  })

  return candidates
}

function calculateNextExpectedDate(lastDateStr) {
  try {
    const lastDate = new Date(lastDateStr)
    lastDate.setMonth(lastDate.getMonth() + 1)
    return lastDate.toISOString().split('T')[0]
  } catch (err) {
    return new Date().toISOString().split('T')[0]
  }
}

// ── Recurring Expenses Endpoints ─────────────────────────────────────
// Fetch recurring candidates and active configurations
app.get('/api/recurring', requireAuth, async (req, res) => {
  const { workspace_id } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const { data: dbItems, error: dbError } = await req.supabase
      .from('recurring_expenses')
      .select('*')
      .eq('workspace_id', workspace_id)

    if (dbError) throw dbError

    const { data: expenses, error: expError } = await req.supabase
      .from('expenses')
      .select('*')
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)

    if (expError) throw expError

    const detected = detectRecurringCandidates(expenses)

    const existingMap = new Map(dbItems.map(item => [item.vendor.trim().toLowerCase(), item]))
    const candidates = detected.filter(c => {
      const key = c.vendor.trim().toLowerCase()
      return !existingMap.has(key)
    })

    const confirmed = dbItems.filter(item => item.status === 'confirmed')
    const dismissed = dbItems.filter(item => item.status === 'dismissed')

    res.json({
      success: true,
      candidates,
      confirmed,
      dismissed,
    })
  } catch (err) {
    console.error('[GET /api/recurring]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch recurring expenses' })
  }
})

// Create / Confirm recurring configuration
app.post('/api/recurring', requireAuth, async (req, res) => {
  const { workspace_id, vendor, amount, category_id, status, next_expected_date } = req.body
  if (!workspace_id || !vendor || !amount || !status || !next_expected_date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' })
  }

  try {
    const { data, error } = await req.supabase
      .from('recurring_expenses')
      .insert({
        workspace_id,
        vendor,
        amount: Number(amount),
        category_id: category_id || null,
        status,
        next_expected_date,
      })
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[POST /api/recurring]', err)
    res.status(500).json({ success: false, error: 'Failed to save recurring expense' })
  }
})

// Update recurring configuration
app.put('/api/recurring/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { status, next_expected_date, amount, category_id } = req.body

  try {
    const updates = {}
    if (status) updates.status = status
    if (next_expected_date) updates.next_expected_date = next_expected_date
    if (amount !== undefined) updates.amount = Number(amount)
    if (category_id !== undefined) updates.category_id = category_id || null

    const { data, error } = await req.supabase
      .from('recurring_expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[PUT /api/recurring/:id]', err)
    res.status(500).json({ success: false, error: 'Failed to update recurring expense' })
  }
})

// Fetch draft / pending recurring expenses (due within 3 days)
app.get('/api/recurring/drafts', requireAuth, async (req, res) => {
  const { workspace_id } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const today = new Date()
    const thresholdDate = new Date()
    thresholdDate.setDate(today.getDate() + 3)
    const thresholdStr = thresholdDate.toISOString().split('T')[0]

    const { data, error } = await req.supabase
      .from('recurring_expenses')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('status', 'confirmed')
      .lte('next_expected_date', thresholdStr)

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/recurring/drafts]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch recurring drafts' })
  }
})

// ── Activity Log Endpoints ──────────────────────────────────────────
// Fetch recent activity logs for a workspace
app.get('/api/activity-logs', requireAuth, async (req, res) => {
  const { workspace_id } = req.query
  if (!workspace_id) {
    return res.status(400).json({ success: false, error: 'workspace_id is required' })
  }

  try {
    const { data, error } = await req.supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/activity-logs]', err)
    res.status(500).json({ success: false, error: 'Failed to fetch activity logs' })
  }
})

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Kharcha Tracker API v2 → http://localhost:${PORT}`)
  console.log(`   Supabase: ${supabaseUrl}`)
  console.log(`   Routes: /health  /api/expenses  /api/scan-receipt  /api/stats  /api/budget-status  /api/alert-logs  /api/invite`)
  console.log(`   Alert engine: email=ON  whatsapp=${process.env.WHATSAPP_ENABLED === 'true' ? 'ON' : 'OFF (flagged)'}`)
})
