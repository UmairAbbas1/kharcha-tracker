# Kharcha Tracker

**Pakistan's first AI-native expense tracker.** Multi-tenant SaaS built entirely on free-tier infrastructure — Supabase, Groq, Resend, Vercel, Render.

> Built as an R&D project by **Umair Abbas** (AI Engineering Intern) using Kiro AI.

---

## What It Does

- Track expenses across multiple workspaces (personal, family, shared)
- Set per-category and workspace-level monthly budgets
- Get smart alerts at 80 / 90 / 100% spend — by email and WhatsApp
- Scan receipts with AI (Groq Llama 4 Scout vision)
- Log expenses by voice in English or Roman Urdu
- Paste a bank SMS (HBL, MCB, UBL, Easypaisa, JazzCash) — expense extracted automatically
- Monthly AI-generated spending summary delivered by email on the 1st of each month
- Export expenses as a styled `.xlsx` Excel file

---

## Live Demo

| Service | URL |
|---------|-----|
| Frontend | [kharcha-tracker.vercel.app](https://kharcha-tracker.vercel.app) |
| Backend API | [kharcha-tracker-backend.onrender.com](https://kharcha-tracker-backend.onrender.com) |

---

## Feature Overview

### Phase 1 — SaaS Foundation
- Supabase PostgreSQL with Row Level Security
- Email/password auth, JWT sessions
- Multi-workspace: Owner + Member roles
- Auto-provisioned workspace and default categories on sign-up

### Phase 2 — Budget Alert Engine
- Per-category and workspace-level budgets
- Event-driven threshold evaluation (80 / 90 / 100%) on every expense insert
- Deduplication via `alert_logs` table — each threshold fires once per month
- Email alerts via Resend (HTML template, non-blocking)
- WhatsApp alerts via Meta Cloud API (feature-flagged, pending template approval)
- In-app budget banner (highest threshold per category only)

### Phase 3 — AI Features & UI Polish
- Receipt OCR: Groq Llama 4 Scout (vision) → structured JSON
- Voice entry: Groq Whisper → transcript → expense fields (English + Roman Urdu)
- SMS parsing: regex fast path + Groq LLM fallback for HBL / MCB / UBL / Easypaisa / JazzCash
- Monthly AI summary: `llama-3.3-70b-versatile` generates a plain-language paragraph delivered by email
- TanStack Query optimistic updates on expenses list
- Mobile bottom-sheet with FAB for add-expense
- Budget arc rings: SVG `stroke-dashoffset` animation, color shifts blue → orange → red
- Excel export with styled `.xlsx` (ExcelJS — colored headers, alternating rows, proper date formatting)
- OCR provider abstraction (`OcrProvider` interface, `GroqProvider`, `providerFactory`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS, TanStack Query, Recharts, Lucide React |
| Fonts | Plus Jakarta Sans (UI), IBM Plex Mono (financial figures) |
| Backend | Node.js 22, Express 4 (ESM) |
| Database + Auth | Supabase PostgreSQL + Row Level Security |
| AI — OCR | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| AI — Voice | Groq `whisper-large-v3-turbo` |
| AI — Text | Groq `llama-3.3-70b-versatile` |
| Email | Resend SDK |
| WhatsApp | Meta Cloud API (flagged off) |
| Excel | ExcelJS |
| File upload | Multer (memory storage) |
| Frontend hosting | Vercel |
| Backend hosting | Render (free tier) |

---

## Project Structure

```
kharcha-tracker/
├── backend/
│   ├── alerts/
│   │   ├── alertEngine.js          orchestrator — fires on expense insert
│   │   ├── alertLogger.js          alert_logs read/write
│   │   ├── budgetCalculator.js     spend aggregation + threshold logic
│   │   └── channels/
│   │       ├── emailChannel.js     Resend HTML email
│   │       └── whatsappChannel.js  Meta Cloud API (flagged off)
│   ├── ocr/
│   │   ├── OcrProvider.js          interface base class
│   │   ├── extractExpenseData.js   shared LLM JSON extraction
│   │   ├── receiptScanner.js       image → vision description → extract
│   │   ├── voiceScanner.js         audio → Whisper → extract
│   │   ├── smsParser.js            regex fast path + LLM fallback
│   │   ├── providerFactory.js      OCR_PROVIDER env var selector
│   │   └── providers/
│   │       └── GroqProvider.js     Groq implementation
│   ├── summaries/
│   │   ├── aggregator.js           monthly spend metrics
│   │   ├── summaryEngine.js        orchestrator + Groq call
│   │   └── summaryEmailer.js       Resend summary email
│   ├── server.js                   Express app + all routes
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddForm.jsx         receipt + voice + SMS scan buttons
│   │   │   ├── BalanceCard.jsx     count-up animation hero card
│   │   │   ├── BottomSheet.jsx     mobile slide-up panel
│   │   │   ├── BudgetBanner.jsx    alert threshold banners
│   │   │   ├── BudgetModal.jsx     monthly budget settings
│   │   │   ├── BudgetRings.jsx     SVG arc progress rings (signature element)
│   │   │   ├── CategoryIcon.jsx    Lucide icon resolver
│   │   │   ├── ExpenseList.jsx     expense rows + Excel export
│   │   │   ├── KharchaLogo.jsx     geometric SVG mark
│   │   │   ├── MonthlySummaryCard.jsx  AI summary dismissible card
│   │   │   ├── ReceiptScanner.jsx  camera/file upload + OCR
│   │   │   ├── SpendBar.jsx        7-day bar chart
│   │   │   ├── SpendPie.jsx        category donut chart
│   │   │   └── VoiceRecorder.jsx   MediaRecorder state machine
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── WorkspaceContext.jsx
│   │   ├── hooks/
│   │   │   └── useExpenses.js      TanStack Query + optimistic mutations
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── api.js                  all backend + Supabase calls
│   │   └── lib/supabase.js
│   ├── tailwind.config.js          design tokens
│   └── package.json
├── docs/
│   ├── roadmap-v3.tex              Phase 4 R&D plan (LaTeX)
│   └── kharcha-tracker-phase4.pptx CEO presentation deck
├── .env.backend                    backend secrets (gitignored)
├── START HERE.bat                  Windows one-click launcher
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://console.groq.com) API key (free)
- A [Resend](https://resend.com) API key (free, 3,000 emails/month)

### 1. Clone and install

```bash
git clone https://github.com/UmairAbbas1/kharcha-tracker.git
cd kharcha-tracker

# Install both frontend and backend
npm run install:all
```

### 2. Configure environment

**Backend** — create `.env.backend` in the root:

```bash
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Server
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5173

# Email alerts
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL=onboarding@resend.dev

# AI features
GROQ_API_KEY=gsk_your_key

# OCR provider — "groq" is the only supported value currently
OCR_PROVIDER=groq

# Monthly summary cron (generate a random string for this)
CRON_SECRET=your_random_cron_secret

# WhatsApp (leave false until Meta template is approved)
WHATSAPP_ENABLED=false
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_TEMPLATE_NAME=budget_alert
```

**Frontend** — create `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_URL=http://localhost:5000
```

### 3. Set up Supabase

Run these SQL statements in **Supabase → SQL Editor** in order:

<details>
<summary>Click to expand — full schema SQL</summary>

```sql
-- Workspaces
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Workspace members
create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- Categories
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name         text not null,
  icon         text default 'MoreHorizontal',
  color        text default '#94a3b8',
  is_default   boolean default false
);

-- Expenses
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  category_id  uuid references public.categories(id),
  created_by   uuid references auth.users(id),
  title        text not null,
  amount       numeric not null,
  date         date not null,
  deleted_at   timestamptz,
  created_at   timestamptz default now()
);

-- Budgets
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  category_id  uuid references public.categories(id),
  month        char(7) not null,
  amount       numeric not null,
  unique nulls not distinct (workspace_id, category_id, month)
);

-- Alert logs (deduplication)
create table public.alert_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  category_id  uuid references public.categories(id),
  month        char(7) not null,
  threshold    integer not null check (threshold in (80, 90, 100)),
  channels     jsonb default '[]',
  sent_at      timestamptz default now(),
  unique nulls not distinct (workspace_id, category_id, month, threshold)
);

-- Profiles (WhatsApp numbers)
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text,
  updated_at      timestamptz default now()
);

-- Monthly AI summaries
create table public.monthly_summaries (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  month        char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  summary_text text not null,
  total_spend  numeric not null default 0,
  created_at   timestamptz default now(),
  unique (workspace_id, month)
);

-- Enable RLS on all tables (add your own policies)
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.categories        enable row level security;
alter table public.expenses          enable row level security;
alter table public.budgets           enable row level security;
alter table public.alert_logs        enable row level security;
alter table public.profiles          enable row level security;
alter table public.monthly_summaries enable row level security;
```

</details>

### 4. Start the app

**Windows (easiest):**
```
Double-click START HERE.bat
```

**Manual (two terminals):**

```bash
# Terminal 1
cd backend && node server.js

# Terminal 2
cd frontend && npm run dev
```

Open: **http://localhost:5173**

---

## API Reference

All routes except `/health` require `Authorization: Bearer <supabase_access_token>`.

### Core

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/api/stats` | Workspace spend stats |
| `GET` | `/api/budget-status` | Current budget utilization |

### Expenses

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/expenses` | Create expense + trigger alert engine |
| `DELETE` | `/api/expenses/:id` | Soft-delete expense |
| `GET` | `/api/export` | Download expenses as styled `.xlsx` |

Query params for export: `workspace_id` (required), `month` (optional, `YYYY-MM`).

### AI Features

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/scan-receipt` | Receipt image OCR → expense fields |
| `POST` | `/api/scan-voice` | Audio transcription → expense fields |
| `POST` | `/api/scan-sms` | Bank SMS parsing → expense fields |

### Alerts & Budgets

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/alert-logs` | Fetch alert history for workspace |
| `DELETE` | `/api/alert-logs` | Clear stale alerts after budget update |
| `GET` | `/api/monthly-summary` | Fetch AI summary for workspace + month |
| `POST` | `/api/generate-monthly-summary` | Cron trigger — generate summaries for all workspaces |

The cron endpoint requires `Authorization: Bearer <CRON_SECRET>` (not a Supabase token).

### Workspace

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/invite` | Invite member to workspace |
| `DELETE` | `/api/workspace/:id/members/:userId` | Remove member (owner-only) |

---

## Cron Setup (Monthly Summary)

Register a free job at [cron-job.org](https://cron-job.org):

| Setting | Value |
|---------|-------|
| URL | `POST https://your-render-url.onrender.com/api/generate-monthly-summary` |
| Schedule | `0 4 1 * *` (1st of month, 04:00 UTC = 09:00 PKT) |
| Header | `Authorization: Bearer your_CRON_SECRET` |
| Body | `{}` |

Also add a **keep-alive cron** to prevent Render cold starts:

| Setting | Value |
|---------|-------|
| URL | `GET https://your-render-url.onrender.com/health` |
| Schedule | `*/14 * * * *` (every 14 minutes) |

---

## Design System

The UI uses a deliberate, restrained design language — not AI-template defaults.

| Token | Value | Use |
|-------|-------|-----|
| `ink` | `#0F1117` | Primary text |
| `slate` | `#6B7280` | Secondary / labels |
| `surface` | `#F7F8FC` | Page background |
| `accent` | `#2563EB` | Primary action, charts |
| `rupee` | `#E85D2F` | Spend figures, budget alerts |

**Typefaces:** Plus Jakarta Sans (UI) · IBM Plex Mono (financial figures)

**Signature element:** Budget arc rings — SVG `stroke-dashoffset` animation, color shifts from `accent` → `rupee` → red as spend crosses 80% and 100%.

---

## Deployment

### Frontend → Vercel

1. Import repo at [vercel.com](https://vercel.com)
2. Root directory: `frontend`
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`

### Backend → Render

1. New Web Service at [render.com](https://render.com)
2. Root directory: `backend`
3. Build: `npm install` · Start: `node server.js`
4. Add all `.env.backend` variables in the Render environment tab

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend exits immediately | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.backend` |
| `EADDRINUSE :5000` | Another node process is running — run `taskkill /F /IM node.exe` in CMD |
| Export returns 401 | Session token expired — the app auto-refreshes tokens; sign out and back in |
| OCR returns 400 | Image must be JPEG/PNG/WEBP, under 4MB |
| Voice scan fails | Check `GROQ_API_KEY` is set; recording must be at least 1 second |
| SMS no amount found | Falls back to LLM — check `GROQ_API_KEY` is set |
| Summary not appearing | Run the cron endpoint manually for the target month |
| Invite returns 503 | `SUPABASE_SERVICE_ROLE_KEY` is missing |

---

## Security

- Never commit `.env.backend` or `frontend/.env` — both are in `.gitignore`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — only used server-side, never exposed to browser
- `GROQ_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET` — treat as secrets, rotate if leaked
- Keep `WHATSAPP_ENABLED=false` until Meta template is approved
- All user data access goes through Supabase RLS policies

---

## Repository

**GitHub:** [github.com/UmairAbbas1/kharcha-tracker](https://github.com/UmairAbbas1/kharcha-tracker)


