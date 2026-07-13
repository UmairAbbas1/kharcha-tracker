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
  console.log('=== Seeding Demo Data for bsai24077@itu.edu.pk ===')

  // 1. Authenticate user
  const email = 'bsai24077@itu.edu.pk'
  const password = 'Pasword si :12345678'.replace('Pasword si :', '').trim() // safe extraction: '12345678'
  
  console.log(`Authenticating as: ${email}...`)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authErr) {
    console.error('❌ Authentication failed:', authErr.message)
    return
  }

  const userId = authData.user.id
  console.log(`✓ Authenticated successfully. User ID: ${userId}`)

  // 2. Discover user workspace
  console.log('Discovering user workspaces...')
  const { data: memberships, error: memErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)

  if (memErr || !memberships || memberships.length === 0) {
    console.warn('⚠️ No workspaces found for this user in workspace_members.')
    
    // Look up any workspace to create membership if needed, or query workspaces
    const { data: workspaces } = await supabase.from('workspaces').select('id, name').limit(1)
    if (!workspaces || workspaces.length === 0) {
      console.error('❌ No workspaces exist in the system.')
      return
    }
    
    console.log(`Creating membership for workspace: "${workspaces[0].name}"...`)
    await supabase.from('workspace_members').insert({
      workspace_id: workspaces[0].id,
      user_id: userId,
      role: 'owner'
    })
    
    var workspaceId = workspaces[0].id
  } else {
    var workspaceId = memberships[0].workspace_id
  }

  const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
  console.log(`✓ Target Workspace: "${ws.name}" (${workspaceId})`)

  // 3. Fetch or seed categories
  console.log('Setting up workspace categories...')
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
      .eq('workspace_id', workspaceId)
      .eq('name', dc.name)
      .maybeSingle()

    if (existing) {
      categories.push(existing)
    } else {
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ workspace_id: workspaceId, ...dc })
        .select()
        .single()
      if (error) {
        console.warn(`Failed to seed category ${dc.name}:`, error.message)
      } else {
        categories.push(created)
      }
    }
  }

  // 4. Seeding historical expenses (spread over last 3 months)
  console.log('Populating expenses history...')
  const months = ['2026-05', '2026-06', '2026-07']
  const foodItems = ['KFC Dinner', 'McDonalds Lunch', 'Savour Foods Biryani', 'Metro Groceries', 'Tehzeeb Bakers', 'Coffee Cafe']
  const transItems = ['Uber Ride', 'Petrol Refuel', 'Careem Ride', 'InDrive Bike', 'Car Tuning']
  const utilItems = ['Electricity Bill', 'PTCL Internet', 'Sui Gas Bill', 'Mobile Topup']
  
  // Clean old expenses
  await supabase.from('expenses').delete().eq('workspace_id', workspaceId)

  const seededExpenses = []
  for (const m of months) {
    const days = [2, 7, 12, 16, 21, 26]
    for (const d of days) {
      const dateStr = `${m}-${String(d).padStart(2, '0')}`
      // Food
      const foodTitle = foodItems[Math.floor(Math.random() * foodItems.length)]
      const foodAmt = Math.floor(Math.random() * 1500) + 300
      const foodCat = categories.find(c => c.name === 'Food')
      const { data: fExp } = await supabase
        .from('expenses')
        .insert({
          workspace_id: workspaceId,
          title: foodTitle,
          amount: foodAmt,
          category_id: foodCat?.id,
          date: dateStr,
          created_by: userId
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
          workspace_id: workspaceId,
          title: transTitle,
          amount: transAmt,
          category_id: transCat?.id,
          date: dateStr,
          created_by: userId
        })
        .select()
        .single()
      if (tExp) seededExpenses.push(tExp)
    }

    // House Rent
    const rentCat = categories.find(c => c.name === 'Rent')
    const { data: rExp } = await supabase
      .from('expenses')
      .insert({
        workspace_id: workspaceId,
        title: 'Monthly House Rent',
        amount: 25000,
        category_id: rentCat?.id,
        date: `${m}-05`,
        created_by: userId
      })
      .select()
      .single()
    if (rExp) seededExpenses.push(rExp)

    // Utilities
    const utilCat = categories.find(c => c.name === 'Utilities')
    const utilTitle = utilItems[Math.floor(Math.random() * utilItems.length)]
    const utilAmt = Math.floor(Math.random() * 8000) + 3000
    const { data: uExp } = await supabase
      .from('expenses')
      .insert({
        workspace_id: workspaceId,
        title: utilTitle,
        amount: utilAmt,
        category_id: utilCat?.id,
        date: `${m}-10`,
        created_by: userId
      })
      .select()
      .single()
    if (uExp) seededExpenses.push(uExp)
  }
  console.log(`✓ Seeded ${seededExpenses.length} transactions successfully.`)

  // 5. Seed Budgets
  console.log('Setting up budgets limits...')
  await supabase.from('budgets').delete().eq('workspace_id', workspaceId)
  const budgetMonths = ['2026-06', '2026-07']
  for (const bm of budgetMonths) {
    await supabase.from('budgets').insert({
      workspace_id: workspaceId,
      category_id: null,
      month: bm,
      amount: 60000
    })

    const foodCat = categories.find(c => c.name === 'Food')
    if (foodCat) {
      await supabase.from('budgets').insert({
        workspace_id: workspaceId,
        category_id: foodCat.id,
        month: bm,
        amount: 12000
      })
    }
  }

  // 6. Seed alert logs
  console.log('Seeding alert threshold logs...')
  const foodCat = categories.find(c => c.name === 'Food')
  await supabase.from('alert_logs').delete().eq('workspace_id', workspaceId)
  await supabase.from('alert_logs').insert([
    {
      workspace_id: workspaceId,
      category_id: foodCat?.id || null,
      month: '2026-07',
      threshold: 80,
      sent_at: new Date().toISOString(),
      channels: ['email']
    },
    {
      workspace_id: workspaceId,
      category_id: null,
      month: '2026-07',
      threshold: 90,
      sent_at: new Date().toISOString(),
      channels: ['email']
    }
  ])

  console.log('\n=== Seeding Finished for bsai24077@itu.edu.pk! ===')
}

run()
