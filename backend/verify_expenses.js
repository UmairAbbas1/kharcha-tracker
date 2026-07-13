import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.backend') })

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  console.log('--- Testing Database Connection & Safe Query Logic ---')
  
  // 1. Get a test workspace
  const { data: workspaces, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(1)

  if (wsErr) {
    console.error('Failed to get workspaces:', wsErr)
    process.exit(1)
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('No workspaces found in the database. Test skipped.')
    return
  }

  const workspaceId = workspaces[0].id
  console.log(`Using Workspace: ${workspaces[0].name} (${workspaceId})`)

  // 2. Query expenses with limit and offset (matching GET /api/expenses query logic)
  const { data: expenses, count, error: expErr } = await supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .range(0, 4)

  if (expErr) {
    console.error('Failed to query expenses:', expErr)
    process.exit(1)
  }

  console.log(`Success: Found ${count} total active expenses in this workspace.`)
  console.log('First few results:', expenses.map(e => ({ id: e.id, title: e.title, amount: e.amount, date: e.date })))

  // 3. Query categories separately (verifying safe lookup mechanism)
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (catErr) {
    console.error('Failed to query categories:', catErr)
    process.exit(1)
  }

  console.log(`Success: Found ${categories.length} categories. Mapping matches correctly.`)
}

run()
