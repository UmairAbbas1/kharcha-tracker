/**
 * AnalyticsPage.jsx — Category trends over time + spend summary.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { BarChart2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { getCategories, getAnalyticsTrends } from '../api'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-xs shadow-modal bg-white border border-gray-100">
      <p className="font-semibold mb-1 text-gray-800">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-mono text-gray-700">
          {p.name}: <span className="font-semibold">{pkr(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const [categories, setCategories] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    setError('')
    try {
      const [catRes, trendRes] = await Promise.all([
        getCategories(activeWorkspace.id),
        getAnalyticsTrends(activeWorkspace.id, 6)
      ])
      setCategories(catRes.data || [])
      setTrendData(trendRes.data || [])
    } catch (err) {
      console.error('[AnalyticsPage] Load failed:', err)
      setError('Failed to fetch category trend data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeWorkspace])

  // Format month labels for Recharts (e.g. "2026-07" -> "Jul")
  const formattedChartData = useMemo(() => {
    return trendData.map(d => {
      let label = d.month
      try {
        label = new Date(`${d.month}-15`).toLocaleString('en-PK', { month: 'short' })
      } catch (ex) {}
      return {
        ...d,
        month: label
      }
    })
  }, [trendData])

  // Calculate stats from trend array
  const currRow = trendData[trendData.length - 1] || {}
  const prevRow = trendData[trendData.length - 2] || {}

  const currTotal = useMemo(() => {
    return Object.keys(currRow)
      .filter(k => k !== 'month')
      .reduce((s, k) => s + Number(currRow[k] || 0), 0)
  }, [currRow])

  const prevTotal = useMemo(() => {
    return Object.keys(prevRow)
      .filter(k => k !== 'month')
      .reduce((s, k) => s + Number(prevRow[k] || 0), 0)
  }, [prevRow])

  const momChange = prevTotal > 0
    ? Math.round(((currTotal - prevTotal) / prevTotal) * 100)
    : null

  const MomIcon  = momChange === null ? Minus : momChange > 0 ? TrendingUp : TrendingDown
  const momColor = momChange === null ? '#9CA3AF' : momChange > 0 ? '#E85D2F' : '#22C55E'

  // Top category this month
  const catTotals = useMemo(() => {
    return categories.map(cat => ({
      name:  cat.name,
      color: cat.color,
      total: Number(currRow[cat.name] || 0)
    })).sort((a, b) => b.total - a.total)
  }, [categories, currRow])

  // Check if we have non-zero spending to display
  const hasData = trendData.some(d => 
    Object.keys(d)
      .filter(k => k !== 'month')
      .some(k => Number(d[k]) > 0)
  )

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} color="#2563EB" />
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>Analytics</h1>
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

        {loading ? (
          <div className="card p-10 text-center animate-pulse text-sm" style={{ color: 'var(--color-slate)' }}>
            Loading trends data…
          </div>
        ) : !hasData ? (
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Not enough spend history
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
              Add expenses across multiple categories to visualize trends here.
            </p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="card p-4">
                <p className="section-label mb-1">This Month</p>
                <p className="font-mono text-xl font-bold" style={{ color: 'var(--color-ink)' }}>
                  {pkr(currTotal)}
                </p>
              </div>
              <div className="card p-4">
                <p className="section-label mb-1">vs Last Month</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <MomIcon size={16} style={{ color: momColor }} />
                  <span className="font-mono text-xl font-bold" style={{ color: momColor }}>
                    {momChange !== null ? `${momChange > 0 ? '+' : ''}${momChange}%` : '—'}
                  </span>
                </div>
              </div>
              <div className="card p-4">
                <p className="section-label mb-1">Top Category</p>
                <p className="text-sm font-bold mt-1 truncate" style={{ color: 'var(--color-ink)' }}>
                  {catTotals[0]?.name || '—'}
                </p>
                {catTotals[0] && catTotals[0].total > 0 && (
                  <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                    {pkr(catTotals[0].total)}
                  </p>
                )}
              </div>
            </div>

            {/* Trend chart */}
            <div className="card p-5 mb-6">
              <p className="section-label mb-4">Category Trends — Last 6 Months</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedChartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month"
                      tick={{ fontSize: 11, fill: 'var(--color-slate)', fontFamily: 'Plus Jakarta Sans' }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--color-slate)', fontFamily: 'Plus Jakarta Sans' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 2 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', color: 'var(--color-ink)' }} />
                    {categories.map(cat => (
                      <Line
                        key={cat.id}
                        type="monotone"
                        dataKey={cat.name}
                        stroke={cat.color || '#94a3b8'}
                        strokeWidth={2}
                        dot={{ r: 3, fill: cat.color || '#94a3b8' }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category breakdown table */}
            <div className="card p-5">
              <p className="section-label mb-4">This Month by Category</p>
              {catTotals.filter(c => c.total > 0).length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-slate)' }}>
                  No expenses this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {catTotals.filter(c => c.total > 0).map(cat => {
                    const pct = currTotal > 0 ? Math.round((cat.total / currTotal) * 100) : 0
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                             style={{ background: cat.color || '#94a3b8' }} />
                        <span className="text-sm flex-1 font-medium" style={{ color: 'var(--color-ink)' }}>{cat.name}</span>
                        <span className="font-mono text-xs mr-2" style={{ color: 'var(--color-slate)' }}>
                          {pct}%
                        </span>
                        <div className="w-24 h-1.5 rounded-full overflow-hidden"
                             style={{ background: 'var(--color-surface)' }}>
                          <div style={{ width: `${pct}%`, background: cat.color || '#94a3b8',
                                        height: '100%', borderRadius: '9999px' }} />
                        </div>
                        <span className="font-mono text-sm font-semibold ml-2 w-28 text-right"
                              style={{ color: 'var(--color-ink)' }}>
                          {pkr(cat.total)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: 'var(--color-slate)' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
