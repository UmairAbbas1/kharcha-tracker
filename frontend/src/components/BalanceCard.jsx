/**
 * BalanceCard.jsx
 * Hero summary card. Uses:
 *   - IBM Plex Mono for the figure (precision signal)
 *   - count-up animation on the total (smooth, respects prefers-reduced-motion)
 *   - Flat accent-blue background — no gradient, no glass
 */

import { useEffect, useRef, useState } from 'react'
import { TrendingUp } from 'lucide-react'

function useCountUp(target, duration = 800) {
  const [value, setValue]   = useState(0)
  const frameRef            = useRef(null)
  const reduced             = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) { setValue(target); return }
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    const start   = performance.now()
    const from    = 0

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)   // ease-out cubic
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target])

  return value
}

export default function BalanceCard({ total, count, loading }) {
  const displayed = useCountUp(loading ? 0 : total)
  const formatted = displayed.toLocaleString('en-PK')

  return (
    <div
      className="rounded-xl px-6 py-7 text-white relative overflow-hidden"
      style={{ background: '#2563EB' }}
    >
      <div className="relative">
        {/* Label */}
        <p className="section-label text-white/60 mb-3">
          Total Spend This Month
        </p>

        {/* Amount — IBM Plex Mono */}
        <div className="flex items-end gap-2 mb-4">
          <span className="text-white/70 font-mono text-xl font-medium leading-none">
            Rs
          </span>
          {loading ? (
            <span className="font-mono text-5xl md:text-6xl font-semibold tracking-tight leading-none opacity-30 animate-pulse">
              —
            </span>
          ) : (
            <span className="font-mono text-5xl md:text-6xl font-semibold tracking-tight leading-none fade-slide-up">
              {formatted}
            </span>
          )}
        </div>

        {/* Transaction count pill */}
        <div className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5"
             style={{ background: 'rgba(255,255,255,0.12)' }}>
          <TrendingUp size={13} strokeWidth={2.5} />
          <span className="text-xs font-semibold tracking-wide">
            {count} transaction{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
