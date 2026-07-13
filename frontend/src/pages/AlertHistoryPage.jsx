/**
 * AlertHistoryPage.jsx — Read-only view of alert_logs.
 * Scope: useAuth ✓  useWorkspace ✓  getAlertLogs ✓  Bell ✓
 */
import { useState, useEffect, useMemo } from 'react'
import { Bell, AlertTriangle, AlertOctagon, CheckCircle } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { getAlertLogs } from '../api'

function getLast6Months() {
  const list = [{ value: '', label: 'All time' }]
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    list.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-PK', { month: 'long', year: 'numeric' }),
    })
  }
  return list
}

const THRESHOLD_CFG = {
  100: { Icon: AlertOctagon,  color: '#E85D2F', label: 'Exceeded'  },
  90:  { Icon: AlertTriangle, color: '#FB923C', label: 'Critical'  },
  80:  { Icon: AlertTriangle, color: '#F59E0B', label: 'Warning'   },
}

function AlertRow({ log }) {
  const cfg      = THRESHOLD_CFG[log.threshold] || THRESHOLD_CFG[80]
  const Icon     = cfg.Icon
  const catName  = log.categories?.name || 'Total Workspace Limit'
  const monthLabel = new Date(`${log.month}-15`).toLocaleString('en-PK', {
    month: 'short', year: 'numeric',
  })
  const sentAt = new Date(log.sent_at).toLocaleString('en-PK', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const channels = Array.isArray(log.channels)
    ? log.channels.map(c => c.channel || c).join(', ')
    : '—'

  return (
    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-3 pl-4 pr-2 w-8">
        <Icon size={14} style={{ color: cfg.color }} />
      </td>
      <td className="py-3 pr-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{catName}</p>
        <p className="text-xs" style={{ color: 'var(--color-slate)' }}>{monthLabel}</p>
      </td>
      <td className="py-3 pr-4">
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: cfg.color + '18', color: cfg.color }}>
          {log.threshold}% — {cfg.label}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs font-medium" style={{ color: 'var(--color-slate)' }}>{channels}</td>
      <td className="py-3 pr-4 text-xs font-mono text-right" style={{ color: 'var(--color-slate)' }}>{sentAt}</td>
    </tr>
  )
}

export default function AlertHistoryPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [month,   setMonth]   = useState('')
  const months = useMemo(getLast6Months, [])

  useEffect(() => {
    if (!activeWorkspace) return
    setLoading(true)
    getAlertLogs(activeWorkspace.id, month || undefined)
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [activeWorkspace, month])

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Bell size={18} color="#2563EB" />
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>Alert History</h1>
          </div>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-lg border text-sm px-2.5 py-1.5 cursor-pointer"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)', background: 'var(--color-card)' }}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="card p-10 text-center animate-pulse text-sm" style={{ color: 'var(--color-slate)' }}>
            Loading alerts…
          </div>
        ) : logs.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle size={32} className="mx-auto mb-3" style={{ color: '#22C55E' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              No budget alerts {month ? 'this period' : 'yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
              Alerts trigger when spending hits 80%, 90%, or 100% of a category or total budget.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="w-8 pl-4" />
                    <th className="py-3 pr-4 text-left"><span className="section-label">Category / Budget</span></th>
                    <th className="py-3 pr-4 text-left"><span className="section-label">Threshold Status</span></th>
                    <th className="py-3 pr-4 text-left"><span className="section-label">Alert Channels</span></th>
                    <th className="py-3 pr-4 text-right"><span className="section-label">Trigger Time</span></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => <AlertRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t text-xs font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-slate)' }}>
              {logs.length} alert{logs.length !== 1 ? 's' : ''} total
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
