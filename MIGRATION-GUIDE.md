# Migration Guide: lowdb → Supabase

This guide walks you through migrating your existing Kharcha Tracker from the local JSON file store (`db.json`) to Supabase (PostgreSQL with RLS).

---

## ✅ Prerequisites Checklist

Before starting, ensure you have:

- [x] Supabase project created at https://supabase.com
- [x] All schema SQL executed successfully (5 tables visible in Table Editor)
- [x] `.env.backend` file created with your Supabase credentials
- [x] `frontend/.env` file created with frontend credentials
- [x] Backend dependencies installed (`npm install` in `/backend`)

---

## Step 1 — Get Your Service Role Key

The migration script needs **admin-level access** to create users and bypass RLS.

1. Go to your Supabase Dashboard
2. Click **Project Settings** (gear icon) → **API**
3. Find **service_role key** (marked as "secret" — NOT the anon key)
4. Copy it
5. Open `.env.backend` and replace this line:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

with your actual service role key (starts with `eyJhbGc...`).

---

## Step 2 — Run the Migration Script

From the root of your project (`C:\kiro\kharcha-tracker`):

```powershell
node migrate-to-supabase.js
```

### What it does:

1. Reads your existing `backend/db.json`
2. Creates a backup (`db.json.backup`) — **don't delete this until you verify**
3. Creates a migration user: `migration@kharcha-tracker.local`
4. The `handle_new_user` trigger fires → workspace + 5 default categories are auto-created
5. Maps your old expenses to the new schema:
   - Old category names → new `category_id` FKs
   - Adds `workspace_id` to every expense
   - Sets `created_by` to the migration user
6. Inserts all expenses into Supabase

### Expected output:

```
📦 Found 6 expenses in db.json

🔐 Creating migration user...
   ✅ Created user: abc123-uuid-here

🏢 Fetching workspace...
   ✅ Workspace ID: def456-uuid-here

📁 Fetching categories...
   ✅ Found 5 categories

💸 Migrating 6 expenses...
   ✅ Inserted 6 expenses

────────────────────────────────────────────────────────────
✅ Migration complete!
────────────────────────────────────────────────────────────
User:       migration@kharcha-tracker.local
Workspace:  def456-uuid-here
Categories: 5
Expenses:   6 inserted
```

---

## Step 3 — Verify in Supabase

1. Go to **Table Editor** → `expenses`
2. You should see all 6 rows with:
   - `workspace_id` populated
   - `category_id` FKs pointing to valid categories
   - `deleted_at` = NULL (active)

---

## Step 4 — Start the New Backend

Old backend used `lowdb`. New backend uses Supabase directly.

```powershell
cd backend
npm start
```

You should see:

```
🚀 Kharcha Tracker API v2 → http://localhost:5000
   Supabase: https://oqgnpnmrhcgbrfjrkiop.supabase.co
   Routes: /health  /api/stats  /api/budget-status  /api/invite
```

### Test it:

```powershell
Invoke-RestMethod "http://localhost:5000/health"
```

Expected:

```json
{
  "status": "ok",
  "service": "kharcha-tracker-api",
  "version": "2.0.0"
}
```

---

## Step 5 — Update Frontend (Next Step)

The frontend still uses the old `axios` + `/api` proxy layer. In the next phase we'll:

1. Replace `axios` with `@supabase/supabase-js`
2. Add authentication (login/register screens)
3. Add workspace context
4. Adapt existing components to pull from Supabase

**This is covered in Step 4 (coming next).**

---

## Rollback Instructions

If something goes wrong and you want to revert:

1. Stop the new backend server (Ctrl+C)
2. Restore the old backend code:
   ```powershell
   git checkout backend/server.js backend/package.json
   ```
3. Your data is still safe in `db.json.backup` — just rename it back:
   ```powershell
   mv backend/db.json.backup backend/db.json
   ```
4. Reinstall old dependencies:
   ```powershell
   cd backend
   npm install
   ```
5. Start the old backend:
   ```powershell
   npm start
   ```

---

## Troubleshooting

### `❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY`

Check `.env.backend` exists and contains valid keys. Run `cat .env.backend` to verify.

### `❌ No workspace found for migration user`

The `handle_new_user` trigger didn't fire. Re-run the trigger SQL:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace_id uuid;
begin
    insert into public.workspaces (name, created_by)
    values (split_part(new.email, '@', 1) || '''s workspace', new.id)
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, new.id, 'owner');

    perform public.seed_default_categories(v_workspace_id);

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
```

Then delete the migration user from Supabase Dashboard → Auth → Users and re-run the migration script.

### `❌ No categories found in workspace`

The `seed_default_categories` function didn't run. Execute this manually in SQL Editor:

```sql
select public.seed_default_categories('<your-workspace-id-here>');
```

Replace `<your-workspace-id-here>` with the workspace UUID from the migration output.

---

## Next: Frontend + Auth

Ready for Step 4? Reply **"proceed to Step 4"** and I'll adapt the frontend to use Supabase auth + data layer.
