/**
 * SpendBar.jsx — Daily spend for last 7 days.
 * Recharts re-themed:
 *   - No CartesianGrid vertical lines
 *   - Horizontal-only hairline rules at #F3F4F6
 *   - Accent-blue bars with 4px top radius
 *   - Rupee-orange top-cap on the max-spend day
 *   - Custom tooltip — card style, no default border
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { BarChart2 } from 'lucide-react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="text-slate font-medium mb-0.5">{label}</p>
      <p className="font-mono font-semibold" style={{ color: '#2563EB' }}>
        {pkr(payload[0].value)}
      </p>
    </div>
  )
}

export default function SpendBar({ expenses }) {
  const cutoff    = new Date()
  cutoff.setDate(cutoff.getDate() - 6)
  const cutStr    = cutoff.toISOString().split('T')[0]

  const dayMap = {}
  expenses
    .filter(e => e.date >= cutStr)
    .forEach(e => { dayMap[e.date] = (dayMap[e.date] || 0) + Number(e.amount) })

  const data = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date:   date.slice(5).replace('-', '/'),
      amount,
    }))

  if (!data.length) return null

  const maxAmt = Math.max(...data.map(d => d.amount))

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={14} color="#2563EB" strokeWidth={2.5} />
        <span className="section-label">7-Day Spend</span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Plus Jakarta Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'Plus Jakarta Sans' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: '#F7F8FC' }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.amount === maxAmt ? '#E85D2F' : '#2563EB'}
                fillOpacity={entry.amount === maxAmt ? 1 : 0.82}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
        <span style={{ color: '#E85D2F' }}>■</span> Highest spend day
      </p>
    </div>
  )
}
