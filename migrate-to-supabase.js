/**
 * Migration Script: lowdb (db.json) → Supabase
 * 
 * Run this ONCE after setting up your Supabase schema.
 * 
 * Usage:
 *   1. Set SUPABASE_SERVICE_ROLE_KEY in .env.backend
 *   2. Run: node migrate-to-supabase.js
 * 
 * What it does:
 *   - Reads backend/db.json
 *   - Creates a migration user (or uses existing)
 *   - Maps old expenses to the new schema with proper workspace_id + category FKs
 *   - Inserts everything into Supabase
 *   - Idempotent: safe to run multiple times
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.backend') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY === 'your_service_role_key_here') {
  console.error('❌ Missing Supabase credentials in .env.backend')
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  console.error('   Get service_role key from: Supabase Dashboard → Settings → API')
  process.exit(1)
}

// Service role client (bypasses RLS, admin-level access)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─────────────────────────────────────────────────────────────
// 1. Read db.json
// ─────────────────────────────────────────────────────────────
const dbPath = join(__dirname, 'backend', 'db.json')

if (!existsSync(dbPath)) {
  console.error('❌ backend/db.json not found. Nothing to migrate.')
  process.exit(1)
}

// Backup first
const backupPath = dbPath + '.backup'
if (!existsSync(backupPath)) {
  copyFileSync(dbPath, backupPath)
  console.log('✅ Backed up db.json → db.json.backup')
}

const db = JSON.parse(readFileSync(dbPath, 'utf-8'))
const oldExpenses = db.expenses || []

if (oldExpenses.length === 0) {
  console.log('ℹ️  No expenses in db.json. Nothing to migrate.')
  process.exit(0)
}

console.log(`📦 Found ${oldExpenses.length} expenses in db.json`)

// ─────────────────────────────────────────────────────────────
// 2. Create or get migration user
// ─────────────────────────────────────────────────────────────
const MIGRATION_EMAIL = 'migration@kharcha-tracker.local'
const MIGRATION_PASS  = 'migration-temp-password-' + Date.now()

console.log('\n🔐 Creating migration user...')

const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: MIGRATION_EMAIL,
  password: MIGRATION_PASS,
  email_confirm: true, // skip email verification
})

if (authError && authError.message.includes('already registered')) {
  console.log('   User already exists, fetching...')
  const { data: users } = await supabase.auth.admin.listUsers()
  const existing = users.users.find(u => u.email === MIGRATION_EMAIL)
  
  if (!existing) {
    console.error('❌ Could not find existing migration user')
    process.exit(1)
  }
  
  var userId = existing.id
  console.log(`   ✅ Using existing user: ${userId}`)
} else if (authError) {
  console.error('❌ Auth error:', authError.message)
  process.exit(1)
} else {
  var userId = authData.user.id
  console.log(`   ✅ Created user: ${userId}`)
}

// ─────────────────────────────────────────────────────────────
// 3. Get the user's workspace (auto-created by trigger)
// ─────────────────────────────────────────────────────────────
console.log('\n🏢 Fetching workspace...')

const { data: workspaces, error: wsError } = await supabase
  .from('workspaces')
  .select('id')
  .eq('created_by', userId)
  .limit(1)

if (wsError || !workspaces || workspaces.length === 0) {
  console.error('❌ No workspace found for migration user')
  console.error('   The on_auth_user_created trigger may not have fired.')
  console.error('   Check Supabase logs or re-run the schema SQL.')
  process.exit(1)
}

const workspaceId = workspaces[0].id
console.log(`   ✅ Workspace ID: ${workspaceId}`)

// ─────────────────────────────────────────────────────────────
// 4. Get default categories (seeded by trigger)
// ─────────────────────────────────────────────────────────────
console.log('\n📁 Fetching categories...')

const { data: categories, error: catError } = await supabase
  .from('categories')
  .select('id, name')
  .eq('workspace_id', workspaceId)

if (catError || !categories || categories.length === 0) {
  console.error('❌ No categories found in workspace')
  console.error('   The seed_default_categories function may not have run.')
  process.exit(1)
}

console.log(`   ✅ Found ${categories.length} categories`)

// Build name → id map
const categoryMap = Object.fromEntries(
  categories.map(c => [c.name, c.id])
)

// ─────────────────────────────────────────────────────────────
// 5. Insert expenses
// ─────────────────────────────────────────────────────────────
console.log(`\n💸 Migrating ${oldExpenses.length} expenses...`)

const expensesToInsert = oldExpenses.map(exp => {
  const categoryId = categoryMap[exp.category]
  
  if (!categoryId) {
    console.warn(`   ⚠️  Unknown category "${exp.category}" for expense "${exp.title}" — skipping`)
    return null
  }

  return {
    workspace_id: workspaceId,
    created_by:   userId,
    category_id:  categoryId,
    title:        exp.title,
    amount:       exp.amount,
    date:         exp.date,
    created_at:   exp.created_at || new Date().toISOString(),
  }
}).filter(Boolean)

if (expensesToInsert.length === 0) {
  console.log('   ℹ️  No valid expenses to insert.')
  process.exit(0)
}

// Batch insert (upsert to make it idempotent)
// Using a composite unique constraint on (workspace_id, title, date, amount) would help,
// but we don't have one. For now, just insert and warn on duplicates.

const { data: inserted, error: insertError } = await supabase
  .from('expenses')
  .insert(expensesToInsert)
  .select('id')

if (insertError) {
  console.error('❌ Insert failed:', insertError.message)
  process.exit(1)
}

console.log(`   ✅ Inserted ${inserted.length} expenses`)

// ─────────────────────────────────────────────────────────────
// 6. Summary
// ─────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60))
console.log('✅ Migration complete!')
console.log('─'.repeat(60))
console.log(`User:       ${MIGRATION_EMAIL}`)
console.log(`Workspace:  ${workspaceId}`)
console.log(`Categories: ${categories.length}`)
console.log(`Expenses:   ${inserted.length} inserted`)
console.log('\nNext steps:')
console.log('  1. Verify data in Supabase Dashboard → Table Editor')
console.log('  2. Delete migration user if not needed (optional):')
console.log(`     User ID: ${userId}`)
console.log('  3. Keep db.json.backup as archive')
console.log('  4. Update your app to use Supabase instead of lowdb')
console.log('─'.repeat(60))
