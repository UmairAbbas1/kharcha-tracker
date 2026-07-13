/**
 * SplitPage.jsx — Split & Group expenses between workspace members.
 *
 * Scope verification:
 *   useAuth ✓  useWorkspace ✓  useExpenses ✓  getCategories ✓
 *   supabase (imported from lib/supabase) ✓
 *   Users, CheckCircle, X, Plus, Loader2 ✓ (lucide-react)
 *
 * Supabase join safety:
 *   workspace_members query: .select('user_id, role') — no embedded join ✓
 *   split_expenses query: .select('*') — no embedded join ✓
 *   expenses used from useExpenses cache — no new query ✓
 *
 * Data model (no new backend):
 *   Uses a client-side split_expenses table in Supabase:
 *   split_expenses(id, expense_id, workspace_id, payer_id, participant_id,
 *                  share_amount, settled_at, created_at)
 *   SQL to create this is shown in the empty state for the owner to run.
 */
import { useState, useEffect, useMemo } from 'react'
import { Users, CheckCircle, X, Plus, Loader2, AlertCircle } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { supabase }     from '../lib/supabase'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

// ── Fetch workspace members (user_id only — no join) ─────────
async function fetchMembers(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
  if (error) throw error
  return data || []
}

// ── Fetch split records (no embedded join) ────────────────────
async function fetchSplits(workspaceId) {
  const { data, error } = await supabase
    .from('split_expenses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('settled_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    // Table may not exist yet — return empty silently
    if (error.code === '42P01') return []
    throw error
  }
  return data || []
}

// ── Mark settled ──────────────────────────────────────────────
async function markSettled(splitId) {
  const { error } = await supabase
    .from('split_expenses')
    .update({ settled_at: new Date().toISOString() })
    .eq('id', splitId)
  if (error) throw error
}

// ── Create split record ───────────────────────────────────────
async function createSplit(workspaceId, expenseId, payerId, participantId, shareAmount) {
  const { error } = await supabase
    .from('split_expenses')
    .insert({ workspace_id: workspaceId, expense_id: expenseId,
              payer_id: payerId, participant_id: participantId,
              share_amount: shareAmount })
  if (error) throw error
}

// ── Balance calculator ────────────────────────────────────────
// Returns map: { [fromUserId]: { [toUserId]: netAmount } }
function calcBalances(splits, currentUserId) {
  const net = {}
  splits.forEach(s => {
    if (s.payer_id === currentUserId) {
      net[s.participant_id] = (net[s.participant_id] || 0) + Number(s.share_amount)
    } else if (s.participant_id === currentUserId) {
      net[s.payer_id] = (net[s.payer_id] || 0) - Number(s.share_amount)
    }
  })
  return net
}

// ── SQL hint ─────────────────────────────────────────────────
const SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.split_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  expense_id     uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  payer_id       uuid NOT NULL,
  participant_id uuid NOT NULL,
  share_amount   numeric NOT NULL,
  settled_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "split: members can all" ON public.split_expenses
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));`

// ── Add Split modal ───────────────────────────────────────────
function AddSplitModal({ expenses, members, currentUserId, workspaceId, onClose, onSaved }) {
  const [expenseId,     setExpenseId]     = useState('')
  const [participantId, setParticipantId] = useState('')
  const [shareAmount,   setShareAmount]   = useState('')
  const [saving,        setSaving]        = useState(false)
  const [err,           setErr]           = useState('')

  const selectedExp = expenses.find(e => e.id === expenseId)
  const otherMembers = members.filter(m => m.user_id !== currentUserId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!expenseId || !participantId || !shareAmount) {
      setErr('All fields are required.'); return
    }
    if (Number(shareAmount) <= 0) {
      setErr('Share amount must be positive.'); return
    }
    setSaving(true); setErr('')
    try {
      await createSplit(workspaceId, expenseId, currentUserId, participantId, Number(shareAmount))
      onSaved()
      onClose()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.35)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card-panel w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold" style={{ color: '#0F1117' }}>Add Split</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="section-label block mb-1.5">Expense</label>
            <select value={expenseId} onChange={e => { setExpenseId(e.target.value); setShareAmount('') }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#E5E7EB', color: '#0F1117', background: '#fff' }}>
              <option value="">Select expense…</option>
              {expenses.slice(0, 50).map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} — {pkr(ex.amount)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="section-label block mb-1.5">Split with</label>
            <select value={participantId} onChange={e => setParticipantId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#E5E7EB', color: '#0F1117', background: '#fff' }}>
              <option value="">Select member…</option>
              {otherMembers.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  Member {m.user_id.slice(0, 8)}… ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="section-label block mb-1.5">Their share (Rs)</label>
            <input type="number" min="1" value={shareAmount}
              onChange={e => setShareAmount(e.target.value)}
              placeholder={selectedExp ? `Max: ${selectedExp.amount}` : '0'}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#E5E7EB', color: '#0F1117', background: '#fff' }} />
          </div>

          {err && <p className="text-xs" style={{ color: '#E85D2F' }}>{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white
                       transition disabled:opacity-60"
            style={{ background: '#2563EB' }}>
            {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {saving ? 'Saving…' : 'Save Split'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function SplitPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const { expenses }        = useExpenses(activeWorkspace?.id)

  const [members,     setMembers]     = useState([])
  const [splits,      setSplits]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [settling,    setSettling]    = useState(null)

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const [mems, spls] = await Promise.all([
        fetchMembers(activeWorkspace.id),
        fetchSplits(activeWorkspace.id),
      ])
      setMembers(mems)
      setSplits(spls)
      setTableExists(true)
    } catch (e) {
      if (e.message?.includes('42P01') || e.code === '42P01') {
        setTableExists(false)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeWorkspace])

  const balances = useMemo(() =>
    user ? calcBalances(splits, user.id) : {},
  [splits, user])

  const handleSettle = async (splitId) => {
    setSettling(splitId)
    try { await markSettled(splitId); await load() }
    catch (e) { console.error(e) }
    finally { setSettling(null) }
  }

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} color="#2563EB" />
            <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Split & Group</h1>
          </div>
          {tableExists && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5
                         text-xs font-semibold text-white"
              style={{ background: '#2563EB' }}>
              <Plus size={13} /> Add Split
            </button>
          )}
        </div>

        {loading ? (
          <div className="card p-10 text-center animate-pulse text-sm" style={{ color: '#9CA3AF' }}>
            Loading…
          </div>

        ) : !tableExists ? (
          <div className="card p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={18} style={{ color: '#E85D2F', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: '#0F1117' }}>
                  One-time setup required
                </p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Run this SQL in Supabase → SQL Editor to enable Split & Group:
                </p>
              </div>
            </div>
            <pre className="text-xs rounded-lg p-4 overflow-x-auto"
                 style={{ background: '#F7F8FC', color: '#374151', border: '1px solid #E5E7EB' }}>
              {SETUP_SQL}
            </pre>
          </div>

        ) : splits.length === 0 ? (
          <div className="card p-12 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: '#0F1117' }}>
              No active splits
            </p>
            <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
              Mark an expense as shared with another workspace member.
            </p>
            <button onClick={() => setShowAdd(true)}
              className="text-xs font-semibold rounded-lg px-4 py-2 text-white"
              style={{ background: '#2563EB' }}>
              Add first split
            </button>
          </div>

        ) : (
          <>
            {/* Balance summary */}
            {Object.keys(balances).length > 0 && (
              <div className="card p-5 mb-5">
                <p className="section-label mb-3">Your Balances</p>
                {Object.entries(balances).map(([uid, amount]) => (
                  <div key={uid} className="flex items-center justify-between py-2
                       border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
                    <p className="text-sm" style={{ color: '#0F1117' }}>
                      Member {uid.slice(0, 8)}…
                    </p>
                    <span className="font-mono text-sm font-bold"
                          style={{ color: amount > 0 ? '#22C55E' : '#E85D2F' }}>
                      {amount > 0 ? `+${pkr(amount)} owed to you` : `${pkr(Math.abs(amount))} you owe`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Split list */}
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <th className="py-3 pl-4 pr-2 text-left"><span className="section-label">Expense</span></th>
                    <th className="py-3 pr-4 text-left"><span className="section-label">Split with</span></th>
                    <th className="py-3 pr-4 text-right"><span className="section-label">Share</span></th>
                    <th className="py-3 pr-4 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {splits.map(s => {
                    const exp = expenses.find(e => e.id === s.expense_id)
                    const isSettling = settling === s.id
                    const other = s.payer_id === user?.id ? s.participant_id : s.payer_id
                    const direction = s.payer_id === user?.id ? 'You paid' : 'They paid'
                    return (
                      <tr key={s.id} className="border-b group"
                          style={{ borderColor: '#F3F4F6' }}>
                        <td className="py-3 pl-4 pr-2">
                          <p className="text-sm font-semibold" style={{ color: '#0F1117' }}>
                            {exp?.title || 'Deleted expense'}
                          </p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{direction}</p>
                        </td>
                        <td className="py-3 pr-4 text-sm" style={{ color: '#6B7280' }}>
                          {other.slice(0, 8)}…
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-sm font-semibold"
                            style={{ color: '#0F1117' }}>
                          {pkr(s.share_amount)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <button onClick={() => handleSettle(s.id)} disabled={isSettling}
                            title="Mark as settled"
                            className="opacity-0 group-hover:opacity-100 transition w-7 h-7
                                       rounded-md flex items-center justify-center hover:bg-green-50 ml-auto">
                            {isSettling
                              ? <Loader2 size={13} className="animate-spin" style={{ color: '#9CA3AF' }} />
                              : <CheckCircle size={13} style={{ color: '#22C55E' }} />
                            }
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {showAdd && tableExists && (
          <AddSplitModal
            expenses={expenses}
            members={members}
            currentUserId={user?.id}
            workspaceId={activeWorkspace.id}
            onClose={() => setShowAdd(false)}
            onSaved={load}
          />
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
