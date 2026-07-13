/**
 * GuidePage.jsx — Static interactive in-app help.
 * Scope: useAuth ✓  BookOpen ✓
 */
import { useState } from 'react'
import { BookOpen, Mic, MessageSquare, Camera, Sparkles,
         Receipt, PiggyBank, Bell, Download, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  {
    icon:  Receipt,
    title: 'Expenses Ledger',
    body:  'The Expenses module is your full expense ledger. Use the search bar to find any expense instantly. Filter by category or month to focus on a specific period. Click any column header to sort. Use the Add Expense button to log a new expense — or use one of the three smart entry modes below.',
  },
  {
    icon:  Camera,
    title: 'Receipt Scan OCR',
    body:  'Tap the "Scan Receipt" button in the Add Expense form. Take a photo or upload an image (JPEG, PNG, WEBP, max 4MB). The AI reads the amount, vendor, category, and date from the receipt and pre-fills the form. Always verify before saving — it pre-fills, it does not auto-save.',
  },
  {
    icon:  Mic,
    title: 'Voice Entry transcription',
    body:  'Tap "Voice" in the Add Expense form and speak your expense in English or Roman Urdu. Example: "spent 450 rupees on biryani today" or "Careem pe 200 gaye kal." The app transcribes via Whisper and extracts the fields. Tap Stop when you are done — it won\'t process until you stop.',
  },
  {
    icon:  MessageSquare,
    title: 'SMS Paste Parser',
    body:  'Received a transaction SMS from HBL, MCB, UBL, Easypaisa, or JazzCash? Tap "Paste SMS," paste the message, and click Extract. The system tries a fast regex match first — no AI call, instant result. If that fails, it falls back to the Groq text model. You\'ll see "Extracted via: pattern match" or "Extracted via: AI" so you know which path ran.',
  },
  {
    icon:  PiggyBank,
    title: 'Budgets & Limits',
    body:  'Go to the Budgets module to set monthly spending limits. You can set a workspace-level total budget and per-category limits. Navigate months with the ‹ › arrows. Type a limit and press Enter (or click away) to save. The arc rings on the dashboard and Budgets page fill as you spend — blue under 80%, orange at 80–99%, red at 100%+.',
  },
  {
    icon:  Bell,
    title: 'Budget Alert Thresholds',
    body:  'When your spending crosses 80%, 90%, or 100% of a budget, the system fires an alert email to the workspace owner. Each threshold fires at most once per month — no spam. You can see all past alerts in the Alert History module. WhatsApp alerts are built but currently disabled pending Meta template approval.',
  },
  {
    icon:  Users,
    title: 'Split & Group',
    body:  'Collaborate with other workspace members. Toggle the "Split this expense" option when creating a transaction to divide the cost equally or proportionally. Head over to the "Split & Group" section to see computed who-owes-whom balances and settle outstanding debts with a single click.',
  },
  {
    icon:  Sparkles,
    title: 'Smart Insights Chatbot',
    body:  'The Smart Insights card on the Dashboard lets you ask natural-language questions about your spending. Try: "is hafte kitna hua", "biggest expense last month", "Food pe average kitna?", or "KFC total spend." You can also tap the microphone icon and speak your question. Answers are in mixed Roman Urdu and English.',
  },
  {
    icon:  Download,
    title: 'Export spreadsheet (.xlsx)',
    body:  'The Export module downloads your expenses as a styled Excel (.xlsx) file. Pick a month or choose "All time." The file includes colored headers, alternating row shading, proper date formatting (no ######), and a totals row at the bottom.',
  },
]

function SectionCard({ icon: Icon, title, body, isOpen, onToggle }) {
  return (
    <div 
      className="rounded-xl border transition-all duration-200 select-none overflow-hidden cursor-pointer"
      style={{ 
        borderColor: 'var(--color-border)', 
        background: 'var(--color-card)',
        boxShadow: isOpen ? '0 4px 12px rgba(0, 0, 0, 0.02)' : 'none'
      }}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-950/20 text-blue-600">
            <Icon size={15} />
          </div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{title}</h2>
        </div>
        <ChevronRight 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
        />
      </div>
      
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium">
            {body}
          </p>
        </div>
      )}
    </div>
  )
}

export default function GuidePage() {
  const { user } = useAuth()
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={18} color="#2563EB" />
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>Guide</h1>
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--color-slate)' }}>
          Interactive guide to mastering Kharcha Tracker's full potential.
        </p>

        <div className="flex flex-col gap-3">
          {SECTIONS.map((s, idx) => (
            <SectionCard 
              key={s.title} 
              {...s} 
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>

        <footer className="text-center mt-8 text-xs" style={{ color: 'var(--color-slate)' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
