/**
 * AnalyticsPage.jsx — Category trends over time + spend summary.
 *
 * Scope verification:
 *   useAuth ✓  useWorkspace ✓  useExpenses ✓  getCategories ✓
 *   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
 *   ResponsiveContainer ✓ (all from recharts)
 *   BarChart2, TrendingUp ✓ (lucide-react)
 *
 * Supabase join safety:
 *   No queries in this file. Uses useExpenses cache + getCategories.
 *   useExpenses join (categories(name,icon,color)) is a safe LEFT join.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getCategories } from '../api'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="font-semibold mb-1" style={{ color: '#0F1117' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.color }}>
          {p.name}: {pkr(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const { expenses }        = useExpenses(activeWorkspace?.id)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (!activeWorkspace) return
    getCategories(activeWorkspace.id)
      .then(r => setCategories(r.data || []))
      .catch(() => {})
  }, [activeWorkspace])

  // Build last 6 months list
  const months = useMemo(() => {
    const list = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      list.push(d.toISOString().slice(0, 7))
    }
    return list
  }, [])

  const monthLabels = useMemo(() => months.map(m =>
    new Date(`${m}-15`).toLocaleString('en-PK', { month: 'short' })
  ), [months])

  // Build chart data: [{month: 'Jul', Food: 1200, Transport: 800, ...}]
  const chartData = useMemo(() => {
    return months.map((m, i) => {
      const row = { month: monthLabels[i] }
      const monthExp = expenses.filter(e => e.date?.slice(0, 7) === m)
      categories.forEach(cat => {
        const total = monthExp
          .filter(e => e.category_id === cat.id)
          .reduce((s, e) => s + Number(e.amount), 0)
        row[cat.name] = total
      })
      return row
    })
  }, [months, monthLabels, expenses, categories])

  // Month-over-month totals
  const currentMonth  = months[months.length - 1]
  const previousMonth = months[months.length - 2]
  const currTotal     = expenses.filter(e => e.date?.slice(0, 7) === currentMonth)
    .reduce((s, e) => s + Number(e.amount), 0)
  const prevTotal     = expenses.filter(e => e.date?.slice(0, 7) === previousMonth)
    .reduce((s, e) => s + Number(e.amount), 0)
  const momChange = prevTotal > 0
    ? Math.round(((currTotal - prevTotal) / prevTotal) * 100)
    : null

  const MomIcon  = momChange === null ? Minus : momChange > 0 ? TrendingUp : TrendingDown
  const momColor = momChange === null ? '#9CA3AF' : momChange > 0 ? '#E85D2F' : '#22C55E'

  // Top category this month
  const catTotals = categories.map(cat => ({
    name:  cat.name,
    color: cat.color,
    total: expenses.filter(e => e.date?.slice(0,7) === currentMonth && e.category_id === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0),
  })).sort((a, b) => b.total - a.total)

  const hasData = expenses.some(e => months.includes(e.date?.slice(0, 7)))

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={18} color="#2563EB" />
          <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Analytics</h1>
        </div>

        {!hasData ? (
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-sm font-semibold" style={{ color: '#0F1117' }}>
              Not enough data yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Add expenses across multiple months to see trends here.
            </p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="card p-4">
                <p className="section-label mb-1">This Month</p>
                <p className="font-mono text-xl font-bold" style={{ color: '#0F1117' }}>
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
                <p className="text-sm font-bold mt-1" style={{ color: '#0F1117' }}>
                  {catTotals[0]?.name || '—'}
                </p>
                {catTotals[0] && (
                  <p className="font-mono text-xs mt-0.5" style={{ color: '#6B7280' }}>
                    {pkr(catTotals[0].total)}
                  </p>
                )}
              </div>
            </div>

            {/* Trend chart */}
            <div className="card p-5 mb-6">
              <p className="section-label mb-4">Category Trends — Last 6 Months</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="month"
                    tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Plus Jakarta Sans' }}
                    axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'Plus Jakarta Sans' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#F3F4F6', strokeWidth: 2 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
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

            {/* Category breakdown table */}
            <div className="card p-5">
              <p className="section-label mb-4">This Month by Category</p>
              {catTotals.filter(c => c.total > 0).length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: '#9CA3AF' }}>
                  No expenses this month.
                </p>
              ) : (
                <div className="space-y-2">
                  {catTotals.filter(c => c.total > 0).map(cat => {
                    const pct = currTotal > 0 ? Math.round((cat.total / currTotal) * 100) : 0
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                             style={{ background: cat.color || '#94a3b8' }} />
                        <span className="text-sm flex-1" style={{ color: '#0F1117' }}>{cat.name}</span>
                        <span className="font-mono text-xs mr-2" style={{ color: '#6B7280' }}>
                          {pct}%
                        </span>
                        <div className="w-24 h-1.5 rounded-full overflow-hidden"
                             style={{ background: '#F3F4F6' }}>
                          <div style={{ width: `${pct}%`, background: cat.color || '#94a3b8',
                                        height: '100%', borderRadius: '9999px' }} />
                        </div>
                        <span className="font-mono text-sm font-semibold ml-2 w-28 text-right"
                              style={{ color: '#0F1117' }}>
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

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
