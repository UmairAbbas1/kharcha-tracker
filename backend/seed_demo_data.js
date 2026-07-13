import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.backend') })

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Supabase URL or Service Role Key missing in .env.backend.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  console.log('=== Seeding Premium Demo Data for Kharcha Tracker ===')

  // 1. Fetch active workspace
  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('*').limit(1)
  if (wsErr || !workspaces || workspaces.length === 0) {
    console.error('No workspace found. Please log in or create a workspace first.')
    return
  }

  const ws = workspaces[0]
  console.log(`Target Workspace: "${ws.name}" (${ws.id})`)

  // 2. Fetch or seed categories
  console.log('Seeding categories...')
  const defaultCats = [
    { name: 'Food', color: '#EF4444', icon: 'utensils' },
    { name: 'Transport', color: '#3B82F6', icon: 'car' },
    { name: 'Rent', color: '#10B981', icon: 'home' },
    { name: 'Fun', color: '#F59E0B', icon: 'film' },
    { name: 'Utilities', color: '#8B5CF6', icon: 'bolt' }
  ]

  const categories = []
  for (const dc of defaultCats) {
    const { data: existing } = await supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('name', dc.name)
      .maybeSingle()

    if (existing) {
      categories.push(existing)
    } else {
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ workspace_id: ws.id, ...dc })
        .select()
        .single()
      if (error) {
        console.warn(`Failed to seed category ${dc.name}:`, error.message)
      } else {
        categories.push(created)
      }
    }
  }
  console.log(`Categories ready: ${categories.length} total.`)

  // 3. Get workspace members
  const { data: members } = await supabase.from('workspace_members').select('*').eq('workspace_id', ws.id)
  const memberIds = (members || []).map(m => m.user_id)
  if (memberIds.length === 0) {
    console.warn('No members found in workspace. Seeding might skip splits.')
  } else {
    console.log(`Workspace members found: ${memberIds.length}`)
  }

  // 4. Generate expenses history (last 3 months)
  console.log('Seeding historical expenses...')
  const months = ['2026-05', '2026-06', '2026-07']
  const foodItems = ['KFC Dinner', 'McDonalds Lunch', 'Savour Foods Biryani', 'Metro Groceries', 'Tehzeeb Bakers', 'Coffee Cafe']
  const transItems = ['Uber Ride', 'Petrol Refuel', 'Careem Ride', 'InDrive Bike', 'Car Tuning']
  const utilItems = ['Electricity Bill', 'PTCL Internet', 'Sui Gas Bill', 'Mobile Topup']
  const funItems = ['Cinepax Movie', 'Bowling Alley', 'Steam Games Purchase', 'Book Store']

  // Cleanup old expenses first
  await supabase.from('expenses').delete().eq('workspace_id', ws.id)

  const seededExpenses = []
  for (const m of months) {
    const days = [3, 8, 12, 18, 22, 27]
    for (const d of days) {
      const dateStr = `${m}-${String(d).padStart(2, '0')}`
      // Food
      const foodTitle = foodItems[Math.floor(Math.random() * foodItems.length)]
      const foodAmt = Math.floor(Math.random() * 1500) + 300
      const foodCat = categories.find(c => c.name === 'Food')
      const { data: fExp } = await supabase
        .from('expenses')
        .insert({
          workspace_id: ws.id,
          title: foodTitle,
          amount: foodAmt,
          category_id: foodCat?.id,
          date: dateStr,
          created_by: memberIds[0] || null
        })
        .select()
        .single()
      if (fExp) seededExpenses.push(fExp)

      // Transport
      const transTitle = transItems[Math.floor(Math.random() * transItems.length)]
      const transAmt = Math.floor(Math.random() * 1200) + 200
      const transCat = categories.find(c => c.name === 'Transport')
      const { data: tExp } = await supabase
        .from('expenses')
        .insert({
          workspace_id: ws.id,
          title: transTitle,
          amount: transAmt,
          category_id: transCat?.id,
          date: dateStr,
          created_by: memberIds[0] || null
        })
        .select()
        .single()
      if (tExp) seededExpenses.push(tExp)
    }

    // Rent & Utilities (Once per month)
    const rentCat = categories.find(c => c.name === 'Rent')
    const { data: rExp } = await supabase
      .from('expenses')
      .insert({
        workspace_id: ws.id,
        title: 'Monthly House Rent',
        amount: 25000,
        category_id: rentCat?.id,
        date: `${m}-05`,
        created_by: memberIds[0] || null
      })
      .select()
      .single()
    if (rExp) seededExpenses.push(rExp)

    const utilCat = categories.find(c => c.name === 'Utilities')
    const utilTitle = utilItems[Math.floor(Math.random() * utilItems.length)]
    const utilAmt = Math.floor(Math.random() * 8000) + 3000
    const { data: uExp } = await supabase
      .from('expenses')
      .insert({
        workspace_id: ws.id,
        title: utilTitle,
        amount: utilAmt,
        category_id: utilCat?.id,
        date: `${m}-10`,
        created_by: memberIds[0] || null
      })
      .select()
      .single()
    if (uExp) seededExpenses.push(uExp)
  }
  console.log(`Seeded ${seededExpenses.length} expenses successfully!`)

  // 5. Seed Budgets
  console.log('Seeding budgets...')
  await supabase.from('budgets').delete().eq('workspace_id', ws.id)
  const budgetMonths = ['2026-06', '2026-07']
  for (const bm of budgetMonths) {
    // Total Workspace Budget
    await supabase.from('budgets').insert({
      workspace_id: ws.id,
      category_id: null,
      month: bm,
      amount: 60000
    })

    // Food Category Budget
    const foodCat = categories.find(c => c.name === 'Food')
    if (foodCat) {
      await supabase.from('budgets').insert({
        workspace_id: ws.id,
        category_id: foodCat.id,
        month: bm,
        amount: 10000
      })
    }
  }
  console.log('Budgets seeded successfully!')

  // 6. Seed splits if table exists
  if (memberIds.length > 1) {
    console.log('Seeding expense splits...')
    const splitExpenses = seededExpenses.slice(0, 5)
    for (const exp of splitExpenses) {
      const share = Number((Number(exp.amount) / memberIds.length).toFixed(2))
      const splitRecords = memberIds.map(mid => ({
        expense_id: exp.id,
        member_id: mid,
        share_amount: share,
        settled: false
      }))

      const { error: splitErr } = await supabase.from('expense_splits').insert(splitRecords)
      if (splitErr) {
        console.warn('Splits seed skipped (table expense_splits may not exist yet).')
        break;
      }
    }
    console.log('Expense splits seeded (or checked).')
  }

  // 7. Seed Alert logs if table exists
  console.log('Checking alert logs...')
  const foodCat = categories.find(c => c.name === 'Food')
  const alertLogsRecords = [
    {
      workspace_id: ws.id,
      category_id: foodCat?.id || null,
      month: '2026-07',
      threshold: 80,
      sent_at: new Date().toISOString(),
      channels: ['email']
    },
    {
      workspace_id: ws.id,
      category_id: null,
      month: '2026-07',
      threshold: 90,
      sent_at: new Date().toISOString(),
      channels: ['email']
    }
  ]
  const { error: alertErr } = await supabase.from('alert_logs').insert(alertLogsRecords)
  if (alertErr) {
    console.log('Alert logs seed skipped (table alert_logs might be empty or missing).')
  } else {
    console.log('Alert logs seeded successfully!')
  }

  // 8. Seed Activity logs if table exists
  console.log('Checking activity logs...')
  const activityLogsRecords = [
    {
      workspace_id: ws.id,
      user_id: memberIds[0] || null,
      action: 'create',
      table_name: 'budgets',
      record_id: ws.id,
      message: 'system seeded budget for 2026-07 (Rs 60,000)',
      created_at: new Date().toISOString()
    },
    {
      workspace_id: ws.id,
      user_id: memberIds[0] || null,
      action: 'create',
      table_name: 'expenses',
      record_id: ws.id,
      message: 'system seeded initial demo expenses for presentation',
      created_at: new Date().toISOString()
    }
  ]
  const { error: actErr } = await supabase.from('activity_logs').insert(activityLogsRecords)
  if (actErr) {
    console.log('Activity logs seed skipped (table activity_logs may not exist yet).')
  } else {
    console.log('Activity logs seeded successfully!')
  }

  console.log('\n=== Database Seeding Complete! Enjoy presenting! ===')
}

run()
