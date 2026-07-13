import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.backend') })

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  console.log('--- Checking expense_splits Table ---')
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*')
    .limit(1)

  if (error) {
    console.log('expense_splits table does not exist or error:', error.message)
  } else {
    console.log('expense_splits table exists! Sample:', data)
  }
}

run()
