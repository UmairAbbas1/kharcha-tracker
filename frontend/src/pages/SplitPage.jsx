/**
 * SplitPage.jsx — Split & Group expenses between workspace members.
 */

import { useState, useEffect, useMemo } from 'react'
import { Users, CheckCircle, X, Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getWorkspaceMembers, getSplitsBalances, settleBalance } from '../api'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

export default function SplitPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const { expenses }        = useExpenses(activeWorkspace?.id)

  const [members, setMembers] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    setError('')
    try {
      const [memsRes, balsRes] = await Promise.all([
        getWorkspaceMembers(activeWorkspace.id),
        getSplitsBalances(activeWorkspace.id),
      ])
      setMembers(memsRes.data || [])
      setBalances(balsRes.balances || [])
    } catch (e) {
      console.error('[SplitPage] Load failed:', e)
      setError('Failed to load workspace split balances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeWorkspace])

  const handleSettleUp = async (debtorId, creditorId) => {
    const debtorEmail = members.find(m => m.user_id === debtorId)?.email || debtorId
    const creditorEmail = members.find(m => m.user_id === creditorId)?.email || creditorId
    
    if (!window.confirm(`Settle all balances between ${debtorEmail} and ${creditorEmail}?`)) {
      return
    }

    const settleKey = `${debtorId}-${creditorId}`
    setSettling(settleKey)
    try {
      await settleBalance(activeWorkspace.id, debtorId, creditorId)
      await load()
    } catch (e) {
      console.error(e)
      alert(e.message || 'Failed to settle balance')
    } finally {
      setSettling(null)
    }
  }

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} color="#2563EB" />
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>Split & Group</h1>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center gap-2 text-sm bg-orange-50 border-orange-200 text-orange-700">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="card p-10 text-center animate-pulse text-sm" style={{ color: 'var(--color-slate)' }}>
            Loading split balances…
          </div>
        ) : balances.length === 0 ? (
          <div className="card p-12 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
              No active splits or balances
            </p>
            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              Mark an expense as split when adding or editing transactions.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Balance Summary Card */}
            <div className="card p-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Active Balances
              </h2>

              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {balances.map((b, idx) => {
                  const isSettling = settling === `${b.debtor_id}-${b.creditor_id}`
                  return (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between py-4 first:pt-0 last:pb-0 gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                          <span className="text-red-500 font-bold">{b.debtor_email.split('@')[0]}</span>
                          <span className="text-gray-400 font-medium"> owes </span>
                          <span className="text-green-500 font-bold">{b.creditor_email.split('@')[0]}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {b.debtor_email} → {b.creditor_email}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 justify-between md:justify-end">
                        <span className="font-mono text-sm font-bold text-orange-500">
                          {pkr(b.amount)}
                        </span>

                        <button
                          onClick={() => handleSettleUp(b.debtor_id, b.creditor_id)}
                          disabled={isSettling}
                          className="flex items-center gap-1 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-50"
                        >
                          {isSettling ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle size={12} />
                          )}
                          Settle Up
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Workspace Members list */}
            <div className="card p-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Workspace Group Members
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map(m => (
                  <div key={m.user_id} className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block" style={{ color: 'var(--color-ink)' }}>
                        {m.email.split('@')[0]}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-slate)' }}>{m.email}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: 'var(--color-slate)' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
