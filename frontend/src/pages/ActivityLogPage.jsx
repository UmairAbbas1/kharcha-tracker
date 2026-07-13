/**
 * ActivityLogPage.jsx
 * Displays a chronological feed of database changes (expenses/budgets created, updated, deleted).
 */

import { useState, useEffect, useMemo } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { getActivityLogs } from '../api'
import { 
  Plus, Edit, Trash2, Calendar, Loader2, RefreshCw, Clock, Filter
} from 'lucide-react'

// Helper: Format relative time
function formatRelativeTime(dateStr) {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDay === 1) return 'yesterday'
    if (diffDay < 7) return `${diffDay}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (err) {
    return dateStr
  }
}

export default function ActivityLogPage() {
  const { activeWorkspace } = useWorkspace()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = async () => {
    if (!activeWorkspace?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getActivityLogs(activeWorkspace.id)
      setLogs(res.data || [])
    } catch (err) {
      console.error('[ActivityLogPage] Fetch failed:', err)
      setError('Failed to fetch activity logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [activeWorkspace?.id])

  const filteredLogs = useMemo(() => {
    if (!actionFilter) return logs
    return logs.filter(log => log.action === actionFilter)
  }, [logs, actionFilter])

  const getActionStyles = (action) => {
    switch (action) {
      case 'create':
        return {
          icon: Plus,
          bg: '#EAFDF1', // soft green
          color: '#10B981',
          label: 'Added'
        }
      case 'update':
        return {
          icon: Edit,
          bg: '#EFF6FF', // soft blue
          color: '#3B82F6',
          label: 'Updated'
        }
      case 'delete':
        return {
          icon: Trash2,
          bg: '#FEF2F2', // soft red
          color: '#EF4444',
          label: 'Deleted'
        }
      default:
        return {
          icon: RefreshCw,
          bg: '#F3F4F6',
          color: '#9CA3AF',
          label: 'Activity'
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FC' }}>
        <div className="animate-pulse text-sm flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Loader2 size={16} className="animate-spin" />
          Loading activity log…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: '#F7F8FC' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-10">
        
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: '#0F1117' }}>
              Activity Log
            </h1>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              A real-time audit trail of actions made across your workspace.
            </p>
          </div>

          <button 
            onClick={fetchLogs} 
            className="p-2 bg-white border rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center"
            title="Refresh log"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center justify-between text-sm gap-3 bg-red-50 border-red-200 text-red-700 animate-entry">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Filters */}
        <div className="card p-3 mb-6 bg-white flex items-center gap-3">
          <Filter size={13} className="text-gray-400 ml-1" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter Actions:</span>
          <div className="flex items-center gap-1.5 ml-2">
            {[
              { id: '', label: 'All' },
              { id: 'create', label: 'Creations' },
              { id: 'update', label: 'Updates' },
              { id: 'delete', label: 'Deletions' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActionFilter(f.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                style={{
                  background: actionFilter === f.id ? '#0F1117' : 'transparent',
                  color: actionFilter === f.id ? '#FFFFFF' : '#6B7280'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Feed */}
        {filteredLogs.length === 0 ? (
          <div className="card p-12 text-center bg-white">
            <p className="text-2xl mb-2">📜</p>
            <h2 className="text-sm font-semibold" style={{ color: '#0F1117' }}>No activities recorded yet</h2>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Actions like logging an expense or updating budgets will create logs here.
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 pl-6 ml-4 flex flex-col gap-6" style={{ borderColor: '#E5E7EB' }}>
            {filteredLogs.map((log) => {
              const { icon: Icon, bg, color, label } = getActionStyles(log.action)
              
              return (
                <div key={log.id} className="relative group animate-entry">
                  {/* Timeline bullet icon */}
                  <span 
                    className="absolute -left-[35px] top-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm"
                    style={{ background: bg, color: color }}
                  >
                    <Icon size={11} strokeWidth={2.5} />
                  </span>

                  <div className="card p-4 hover:shadow-md transition duration-200" style={{ background: '#FFFFFF' }}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs text-gray-700 leading-relaxed font-semibold">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0 mt-0.5" title={new Date(log.created_at).toLocaleString()}>
                        <Clock size={10} />
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span 
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: bg, color: color }}
                      >
                        {label}
                      </span>
                      <span className="text-[9px] text-gray-400 capitalize">
                        in {log.table_name}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
