/**
 * KharchaLogo.jsx
 * Abstract geometric SVG mark — a stylised ₨ ligature.
 *
 * Two elements:
 *   1. A heavy vertical bar (the R-stem of ₨)
 *   2. A diagonal stroke crossing it (the descender), terminating in a small disc
 *
 * Uses currentColor so it inherits from the parent's color property.
 * Works as favicon (16px), app header (32px), auth page (48px+).
 *
 * Props:
 *   size      — px (default 32)
 *   color     — explicit hex/rgb, or omit to use currentColor
 *   className — additional classes
 */
export default function KharchaLogo({ size = 32, color, className = '' }) {
  const c = color || 'currentColor'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kharcha Tracker"
      role="img"
    >
      {/* ── Vertical stem (R bar) ── */}
      <rect x="8" y="6" width="5" height="28" rx="2.5" fill={c} />

      {/* ── Top crossbar ── */}
      <rect x="8" y="6" width="16" height="5" rx="2.5" fill={c} />

      {/* ── Mid crossbar (shorter — creates the ₨ double-bar) ── */}
      <rect x="8" y="15" width="12" height="4" rx="2" fill={c} />

      {/* ── Diagonal leg — from mid-right, sweeps to bottom-right ── */}
      <path
        d="M 20 19 L 31 33"
        stroke={c}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* ── Terminal disc at bottom of diagonal ── */}
      <circle cx="31" cy="33" r="3" fill={c} />
    </svg>
  )
}
