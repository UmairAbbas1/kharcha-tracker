/**
 * GuidePage.jsx — Static in-app help.
 * No API calls, no Supabase queries.
 * Scope: useAuth ✓  BookOpen ✓  all section content is static.
 */
import { BookOpen, Mic, MessageSquare, Camera, Sparkles,
         Receipt, PiggyBank, Bell, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  {
    icon:  Receipt,
    title: 'Expenses',
    body:  'The Expenses module is your full expense ledger. Use the search bar to find any expense instantly. Filter by category or month to focus on a specific period. Click any column header to sort. Use the Add Expense button to log a new expense — or use one of the three smart entry modes below.',
  },
  {
    icon:  Camera,
    title: 'Receipt Scan',
    body:  'Tap the "Scan Receipt" button in the Add Expense form. Take a photo or upload an image (JPEG, PNG, WEBP, max 4MB). The AI reads the amount, vendor, category, and date from the receipt and pre-fills the form. Always verify before saving — it pre-fills, it does not auto-save.',
  },
  {
    icon:  Mic,
    title: 'Voice Entry',
    body:  'Tap "Voice" in the Add Expense form and speak your expense in English or Roman Urdu. Example: "spent 450 rupees on biryani today" or "Careem pe 200 gaye kal." The app transcribes via Whisper and extracts the fields. Tap Stop when you are done — it won\'t process until you stop.',
  },
  {
    icon:  MessageSquare,
    title: 'SMS Paste',
    body:  'Received a transaction SMS from HBL, MCB, UBL, Easypaisa, or JazzCash? Tap "Paste SMS," paste the message, and click Extract. The system tries a fast regex match first — no AI call, instant result. If that fails, it falls back to the Groq text model. You\'ll see "Extracted via: pattern match" or "Extracted via: AI" so you know which path ran.',
  },
  {
    icon:  PiggyBank,
    title: 'Budgets',
    body:  'Go to the Budgets module to set monthly spending limits. You can set a workspace-level total budget and per-category limits. Navigate months with the ‹ › arrows. Type a limit and press Enter (or click away) to save. The arc rings on the dashboard and Budgets page fill as you spend — blue under 80%, orange at 80–99%, red at 100%+.',
  },
  {
    icon:  Bell,
    title: 'Budget Alerts',
    body:  'When your spending crosses 80%, 90%, or 100% of a budget, the system fires an alert email to the workspace owner. Each threshold fires at most once per month — no spam. You can see all past alerts in the Alert History module. WhatsApp alerts are built but currently disabled pending Meta template approval.',
  },
  {
    icon:  Sparkles,
    title: 'Smart Insights',
    body:  'The Smart Insights card on the Dashboard lets you ask natural-language questions about your spending. Try: "is hafte kitna hua", "biggest expense last month", "Food pe average kitna?", or "KFC total spend." You can also tap the microphone icon and speak your question. Answers are in mixed Roman Urdu and English.',
  },
  {
    icon:  Download,
    title: 'Export',
    body:  'The Export module downloads your expenses as a styled Excel (.xlsx) file. Pick a month or choose "All time." The file includes colored headers, alternating row shading, proper date formatting (no ######), and a totals row at the bottom.',
  },
]

function Section({ icon: Icon, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
           style={{ background: '#EFF6FF' }}>
        <Icon size={16} color="#2563EB" />
      </div>
      <div>
        <h2 className="text-sm font-bold mb-1.5" style={{ color: '#0F1117' }}>{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{body}</p>
      </div>
    </div>
  )
}

export default function GuidePage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={18} color="#2563EB" />
          <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Guide</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
          How to use every feature in Kharcha Tracker.
        </p>

        <div className="card p-6 space-y-8">
          {SECTIONS.map(s => <Section key={s.title} {...s} />)}
        </div>

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
