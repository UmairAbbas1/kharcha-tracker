import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { BarChart2 } from 'lucide-react'
import { pkr } from '../constants'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 border border-blue-100 rounded-2xl px-3 py-2 shadow-lg text-xs font-semibold">
      <div className="text-gray-400 mb-0.5">{label}</div>
      <div style={{ color: '#4169E1' }}>{pkr(payload[0].value)}</div>
    </div>
  )
}

export default function SpendBar({ expenses }) {
  // Build last-7-days map
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 6)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const dayMap = {}
  expenses
    .filter(e => e.date >= cutoffStr)
    .forEach(e => { dayMap[e.date] = (dayMap[e.date] || 0) + e.amount })

  const data = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: date.slice(5), amount })) // show MM-DD

  if (!data.length) return null

  return (
    <div className="glass rounded-3xl p-6 shadow-lg">
      <h2 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <BarChart2 size={15} color="#F7A8C4" />
        Daily Spend — last 7 days
      </h2>

      <ResponsiveContainer width="100%" height={195}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e0e7ff"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#4169E108' }} />
          <Bar
            dataKey="amount"
            fill="#4169E1"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
