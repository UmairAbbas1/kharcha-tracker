/**
 * RecurringPage.jsx
 * Section to manage detected candidate recurring expenses and active recurring configurations.
 */

import { useState, useEffect, useMemo } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  getRecurringExpenses, saveRecurringExpense, updateRecurringExpense,
  getCategories
} from '../api'
import { categoryIcon } from '../components/CategoryIcon'
import {
  Calendar, Check, X, Loader2, RefreshCw, AlertCircle, Sparkles, Trash2
} from 'lucide-react'

export default function RecurringPage() {
  const { activeWorkspace } = useWorkspace()
  const [candidates, setCandidates] = useState([])
  const [confirmed, setConfirmed] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [error, setError] = useState(null)

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]))
  }, [categories])

  const fetchRecurringData = async () => {
    if (!activeWorkspace?.id) return
    setLoading(true)
    setError(null)
    try {
      // Parallel fetches for speed and safety
      const [recRes, catRes] = await Promise.all([
        getRecurringExpenses(activeWorkspace.id),
        getCategories(activeWorkspace.id)
      ])
      
      setCandidates(recRes.candidates || [])
      setConfirmed(recRes.confirmed || [])
      setCategories(catRes.data || [])
    } catch (err) {
      console.error('[RecurringPage] Fetch error:', err)
      setError('Failed to load recurring expenses data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecurringData()
  }, [activeWorkspace?.id])

  const handleConfirmCandidate = async (cand, index) => {
    setActioningId(`cand-conf-${index}`)
    try {
      await saveRecurringExpense({
        workspace_id: activeWorkspace.id,
        vendor: cand.vendor,
        amount: cand.amount,
        category_id: cand.category_id,
        status: 'confirmed',
        next_expected_date: cand.next_expected_date,
      })
      await fetchRecurringData()
    } catch (err) {
      setError(err.message || 'Failed to confirm recurring expense.')
    } finally {
      setActioningId(null)
    }
  }

  const handleDismissCandidate = async (cand, index) => {
    setActioningId(`cand-dism-${index}`)
    try {
      await saveRecurringExpense({
        workspace_id: activeWorkspace.id,
        vendor: cand.vendor,
        amount: cand.amount,
        category_id: cand.category_id,
        status: 'dismissed',
        next_expected_date: cand.next_expected_date,
      })
      await fetchRecurringData()
    } catch (err) {
      setError(err.message || 'Failed to dismiss recurring candidate.')
    } finally {
      setActioningId(null)
    }
  }

  const handleDeleteConfirmed = async (id) => {
    if (!confirm('Are you sure you want to stop tracking this recurring expense?')) return
    setActioningId(`conf-del-${id}`)
    try {
      // Just mark it as dismissed in database so it doesn't prompt again
      await updateRecurringExpense(id, { status: 'dismissed' })
      await fetchRecurringData()
    } catch (err) {
      setError(err.message || 'Failed to delete recurring expense.')
    } finally {
      setActioningId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FC' }}>
        <div className="animate-pulse text-sm flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Loader2 size={16} className="animate-spin" />
          Loading recurring expenses…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: '#F7F8FC' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-lg font-bold leading-tight" style={{ color: '#0F1117' }}>
            Recurring Expenses
          </h1>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Auto-detect regular bills and subscriptions from your spending history.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center justify-between text-sm gap-3 bg-red-50 border-red-200 text-red-700 animate-entry">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Candidates Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: '#E5E7EB' }}>
              <Sparkles size={16} className="text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Detected Candidates</h2>
              <span className="text-xs rounded-full px-2 py-0.5 bg-yellow-50 text-yellow-600 font-bold ml-auto">
                {candidates.length} new
              </span>
            </div>

            {candidates.length === 0 ? (
              <div className="card p-8 text-center" style={{ background: '#FFFFFF' }}>
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-xs font-semibold" style={{ color: '#0F1117' }}>No new candidates detected</p>
                <p className="text-[11px] mt-1" style={{ color: '#6B7280' }}>
                  Candidates appear automatically when the same vendor with similar amounts shows up in 3 consecutive months.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {candidates.map((cand, idx) => {
                  const cat = categoryMap.get(cand.category_id) || {}
                  const color = cat.color || '#94A3B8'
                  const isActioning = actioningId === `cand-conf-${idx}` || actioningId === `cand-dism-${idx}`

                  return (
                    <div key={idx} className="card p-4 flex flex-col gap-3 animate-entry" style={{ background: '#FFFFFF' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
                            {categoryIcon(cat.icon, color, 14)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-800 truncate">{cand.vendor}</h3>
                            <p className="text-[10px]" style={{ color: '#6B7280' }}>
                              Expected next: {cand.next_expected_date}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-gray-900" style={{ color: '#E85D2F' }}>
                            Rs {Number(cand.amount).toLocaleString('en-PK')}
                          </span>
                          <p className="text-[9px] text-gray-400 mt-0.5">monthly average</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: '#F3F4F6' }}>
                        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>Is this a regular recurring expense?</p>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            onClick={() => handleDismissCandidate(cand, idx)}
                            disabled={isActioning}
                            className="px-2 py-1 rounded-md text-xs font-semibold border hover:bg-gray-50 text-gray-500 flex items-center gap-1 disabled:opacity-50"
                            style={{ borderColor: '#E5E7EB' }}
                          >
                            <X size={11} /> Dismiss
                          </button>
                          <button
                            onClick={() => handleConfirmCandidate(cand, idx)}
                            disabled={isActioning}
                            className="px-3 py-1 rounded-md text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
                            style={{ background: '#2563EB' }}
                          >
                            <Check size={11} strokeWidth={2.5} /> Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active Configured Column */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: '#E5E7EB' }}>
              <RefreshCw size={14} className="text-blue-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Active Subscriptions</h2>
              <span className="text-xs rounded-full px-2 py-0.5 bg-blue-50 text-blue-600 font-bold ml-auto">
                {confirmed.length} tracking
              </span>
            </div>

            {confirmed.length === 0 ? (
              <div className="card p-8 text-center" style={{ background: '#FFFFFF' }}>
                <p className="text-2xl mb-2">📅</p>
                <p className="text-xs font-semibold" style={{ color: '#0F1117' }}>No active recurring expenses</p>
                <p className="text-[11px] mt-1" style={{ color: '#6B7280' }}>
                  Confirmed recurring expenses will show up here, and you will be prompted to log them a few days before they are expected.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {confirmed.map(item => {
                  const cat = categoryMap.get(item.category_id) || {}
                  const color = cat.color || '#94A3B8'
                  const isActioning = actioningId === `conf-del-${item.id}`

                  return (
                    <div key={item.id} className="card p-4 flex items-center justify-between gap-3 animate-entry" style={{ background: '#FFFFFF' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
                          {categoryIcon(cat.icon, color, 14)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-gray-800 truncate">{item.vendor}</h3>
                          <p className="text-[10px]" style={{ color: '#6B7280' }}>
                            Next due: <span className="font-semibold text-blue-600">{item.next_expected_date}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-gray-900" style={{ color: '#E85D2F' }}>
                          Rs {Number(item.amount).toLocaleString('en-PK')}
                        </span>
                        <button
                          onClick={() => handleDeleteConfirmed(item.id)}
                          disabled={isActioning}
                          className="w-7 h-7 rounded-lg flex items-center justify-center border hover:bg-red-50 border-gray-200 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete subscription"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
