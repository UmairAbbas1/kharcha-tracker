/**
 * queryRunner.js
 * 5 safe read-only Supabase query functions for the NL assistant.
 *
 * SECURITY:
 *   - Only uses req.supabase (user-scoped, RLS active) — never adminClient
 *   - workspace_id + deleted_at IS NULL are mandatory on every query
 *   - vendor filter uses .ilike() — parameterized
 *   - Only .select() is ever called — no writes
 *
 * KEY DESIGN DECISIONS:
 *   - No join in the main query (categories join causes PostgREST inner join
 *     which silently drops expenses with missing category rows)
 *   - Category filter resolves name → ID via a separate safe lookup
 *   - runList builds its own query to avoid the await-then-chain bug
 */

// ── Date range resolver ───────────────────────────────────────────────
export function resolveDateRange(dateRangeIntent, todayStr) {
  const today = new Date(todayStr + 'T12:00:00')   // noon avoids DST edge cases
  const y     = today.getFullYear()
  const m     = today.getMonth()    // 0-indexed

  const pad  = (n) => String(n).padStart(2, '0')
  const iso  = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`

  const monday = (dt) => {
    const day  = dt.getDay()                      // 0=Sun, 1=Mon … 6=Sat
    const diff = day === 0 ? -6 : 1 - day         // steps back to Monday
    const d    = new Date(dt)
    d.setDate(dt.getDate() + diff)
    return d
  }

  switch (dateRangeIntent?.type) {
    case 'this_week':
      return { start: iso(monday(today)), end: todayStr }

    case 'last_week': {
      const thisMonday = monday(today)
      const lastMon    = new Date(thisMonday); lastMon.setDate(thisMonday.getDate() - 7)
      const lastSun    = new Date(thisMonday); lastSun.setDate(thisMonday.getDate() - 1)
      return { start: iso(lastMon), end: iso(lastSun) }
    }

    case 'this_month':
      return { start: `${y}-${pad(m + 1)}-01`, end: todayStr }

    case 'last_month': {
      const lm     = new Date(y, m - 1, 1)
      const lmStr  = `${lm.getFullYear()}-${pad(lm.getMonth() + 1)}`
      const last   = new Date(y, m, 0).getDate()
      return { start: `${lmStr}-01`, end: `${lmStr}-${pad(last)}` }
    }

    case 'specific_month': {
      const sm = dateRangeIntent.month
      if (!sm || !/^\d{4}-\d{2}$/.test(sm)) break
      const [sy, smn] = sm.split('-').map(Number)
      const last      = new Date(sy, smn, 0).getDate()
      return { start: `${sm}-01`, end: `${sm}-${pad(last)}` }
    }

    case 'specific_year': {
      const yr = dateRangeIntent.year || String(y)
      return { start: `${yr}-01-01`, end: `${yr}-12-31` }
    }

    case 'all_time':
      return { start: '1970-01-01', end: todayStr }
  }

  // Default fallback — this month
  return { start: `${y}-${pad(m + 1)}-01`, end: todayStr }
}

// ── Category ID lookup ────────────────────────────────────────────────
async function resolveCategoryId(sb, workspaceId, categoryName) {
  if (!categoryName) return null
  const { data } = await sb
    .from('categories')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .ilike('name', categoryName)
    .limit(1)
  return data?.[0]?.id || null
}

// ── Base query builder ────────────────────────────────────────────────
// No join — avoids PostgREST inner-join silently dropping rows
function baseFilters(sb, workspaceId, intent, dateRange, categoryId) {
  let q = sb
    .from('expenses')
    .select('amount, date, category_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)

  if (categoryId) q = q.eq('category_id', categoryId)
  if (intent.vendor) q = q.ilike('title', `%${intent.vendor}%`)

  return q
}

// ── Fetch category names map for display ─────────────────────────────
async function catNameMap(sb, workspaceId) {
  const { data } = await sb
    .from('categories')
    .select('id, name')
    .eq('workspace_id', workspaceId)
  const map = {}
  ;(data || []).forEach(c => { map[c.id] = c.name })
  return map
}

// ── The 5 safe query functions ────────────────────────────────────────

export async function runSum(sb, workspaceId, intent, dateRange) {
  const catId            = await resolveCategoryId(sb, workspaceId, intent.category)
  const { data, error }  = await baseFilters(sb, workspaceId, intent, dateRange, catId)
  if (error) throw error
  const value = (data || []).reduce((s, e) => s + Number(e.amount), 0)
  return { value: Math.round(value), count: data?.length || 0 }
}

export async function runCount(sb, workspaceId, intent, dateRange) {
  const catId            = await resolveCategoryId(sb, workspaceId, intent.category)
  const { data, error }  = await baseFilters(sb, workspaceId, intent, dateRange, catId)
  if (error) throw error
  return { value: data?.length || 0, count: data?.length || 0 }
}

export async function runMax(sb, workspaceId, intent, dateRange) {
  const catId            = await resolveCategoryId(sb, workspaceId, intent.category)
  const { data, error }  = await baseFilters(sb, workspaceId, intent, dateRange, catId)
  if (error) throw error
  if (!data?.length) return { value: null, count: 0 }

  const names = await catNameMap(sb, workspaceId)
  const max   = data.reduce((best, e) => Number(e.amount) > Number(best.amount) ? e : best)
  return {
    value: Math.round(Number(max.amount)),
    count: data.length,
    rows:  [{ date: max.date, amount: Math.round(Number(max.amount)), category: names[max.category_id] || 'Other' }],
  }
}

export async function runAvg(sb, workspaceId, intent, dateRange) {
  const catId            = await resolveCategoryId(sb, workspaceId, intent.category)
  const { data, error }  = await baseFilters(sb, workspaceId, intent, dateRange, catId)
  if (error) throw error
  if (!data?.length) return { value: null, count: 0 }
  const total = data.reduce((s, e) => s + Number(e.amount), 0)
  return { value: Math.round(total / data.length), count: data.length }
}

export async function runList(sb, workspaceId, intent, dateRange) {
  const limit  = Math.min(intent.limit || 5, 10)
  const catId  = await resolveCategoryId(sb, workspaceId, intent.category)
  const names  = await catNameMap(sb, workspaceId)

  // Build a fresh query — do NOT chain after an awaited builder
  let q = sb
    .from('expenses')
    .select('amount, date, category_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)

  if (catId)         q = q.eq('category_id', catId)
  if (intent.vendor) q = q.ilike('title', `%${intent.vendor}%`)

  const { data, error } = await q
    .order('amount', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows  = (data || []).map(e => ({
    date:     e.date,
    amount:   Math.round(Number(e.amount)),
    category: names[e.category_id] || 'Other',
  }))
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return { value: total, count: rows.length, rows }
}

// ── Main dispatcher ───────────────────────────────────────────────────
export async function runQuery(sb, workspaceId, intent, todayStr) {
  const dateRange = resolveDateRange(intent.dateRange, todayStr)
  console.log('[queryRunner]', intent.aggregation, dateRange)

  switch (intent.aggregation) {
    case 'sum':   return runSum(sb, workspaceId, intent, dateRange)
    case 'count': return runCount(sb, workspaceId, intent, dateRange)
    case 'max':   return runMax(sb, workspaceId, intent, dateRange)
    case 'avg':   return runAvg(sb, workspaceId, intent, dateRange)
    case 'list':  return runList(sb, workspaceId, intent, dateRange)
    default:
      throw Object.assign(new Error('Unknown aggregation type'), { status: 422 })
  }
}
