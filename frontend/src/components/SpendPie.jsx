import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="bg-white/95 border border-blue-100 rounded-2xl px-3 py-2 shadow-lg text-xs font-semibold">
      <span style={{ color: p.color }}>{name}</span>
      <span className="ml-2 text-gray-500">{pkr(value)}</span>
    </div>
  )
}

export default function SpendPie({ expenses }) {
  // Group by category using joined data from Supabase
  const catMap = {}
  expenses.forEach(e => {
    const name  = e.categories?.name  || 'Other'
    const color = e.categories?.color || '#94a3b8'
    if (!catMap[name]) catMap[name] = { name, value: 0, color }
    catMap[name].value += Number(e.amount)
  })

  const data = Object.values(catMap)
  if (!data.length) return null

  return (
    <div className="glass rounded-3xl p-6 shadow-lg">
      <h2 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <PieIcon size={15} color="#4169E1" />
        Spend by Category
      </h2>

      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map(entry => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {data.map(({ name, value, color }) => (
          <div key={name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="font-semibold">{name}</span>
            <span className="text-gray-400">{pkr(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
