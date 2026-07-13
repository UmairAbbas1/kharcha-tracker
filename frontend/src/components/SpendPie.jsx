/**
 * SpendPie.jsx — Category breakdown donut chart.
 * Rules:
 *   - Thinner donut (larger innerRadius)
 *   - Center label shows total
 *   - Inline % labels only for categories ≥ 5% of total
 *   - Categories < 5% listed in a compact legend below (no inline label)
 *   - Custom tooltip
 *   - No default Recharts legend
 */

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="font-semibold" style={{ color: p.color }}>{name}</p>
      <p className="font-mono text-ink mt-0.5">{pkr(value)}</p>
    </div>
  )
}

function CenterLabel({ cx, cy, total }) {
  return (
    <g>
      <text
        x={cx} y={cy - 8}
        textAnchor="middle"
        fill="var(--color-slate)"
        fontSize={10}
        fontFamily="Plus Jakarta Sans"
        fontWeight={600}
        letterSpacing="0.08em"
        textTransform="uppercase"
      >
        TOTAL
      </text>
      <text
        x={cx} y={cy + 12}
        textAnchor="middle"
        fill="var(--color-ink)"
        fontSize={15}
        fontFamily="IBM Plex Mono"
        fontWeight={600}
        letterSpacing="-0.02em"
      >
        {pkr(total)}
      </text>
    </g>
  )
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null   // hide labels for slices < 5%
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.35
  const x      = cx + radius * Math.cos(-midAngle * RADIAN)
  const y      = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x} y={y}
      fill="var(--color-slate)"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontFamily="Plus Jakarta Sans"
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function SpendPie({ expenses }) {
  const catMap = {}
  expenses.forEach(e => {
    const name  = e.categories?.name  || 'Other'
    const color = e.categories?.color || '#94a3b8'
    if (!catMap[name]) catMap[name] = { name, value: 0, color }
    catMap[name].value += Number(e.amount)
  })

  const data  = Object.values(catMap).sort((a, b) => b.value - a.value)
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) return null

  const bigSlices   = data.filter(d => d.value / total >= 0.05)
  const smallSlices = data.filter(d => d.value / total < 0.05)

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-2">
        <PieIcon size={14} color="#2563EB" strokeWidth={2.5} />
        <span className="section-label">By Category</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map(entry => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {/* Center label — uses foreignObject trick via recharts customized label */}
          <text
            x="50%" y="46%"
            textAnchor="middle"
            fill="#6B7280"
            fontSize={10}
            fontFamily="Plus Jakarta Sans"
            fontWeight={700}
            letterSpacing="0.08em"
          >
            TOTAL
          </text>
          <text
            x="50%" y="56%"
            textAnchor="middle"
            fill="#0F1117"
            fontSize={13}
            fontFamily="IBM Plex Mono"
            fontWeight={600}
          >
            {pkr(total)}
          </text>
        </PieChart>
      </ResponsiveContainer>

      {/* Legend — big slices inline, small slices in compact row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
        {bigSlices.map(({ name, color, value }) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs font-semibold text-ink">{name}</span>
            <span className="font-mono text-xs" style={{ color: '#6B7280' }}>{pkr(value)}</span>
          </div>
        ))}
      </div>

      {/* Small slices */}
      {smallSlices.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-border">
          {smallSlices.map(({ name, color, value }) => (
            <div key={name} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-slate">{name}</span>
              <span className="font-mono text-xs text-slate">{pkr(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
