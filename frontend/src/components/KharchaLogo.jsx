/**
 * KharchaLogo.jsx
 * Abstract geometric SVG logo for Kharcha Tracker.
 *
 * Design: Two overlapping tilted squares (rhombuses) in royal blue + pink,
 * with a small coin circle, forming a stylised "K" motif.
 * Works in light and dark mode.
 *
 * Props:
 *   size      — number (default 32), controls both width and height
 *   variant   — "color" (default) | "mono" (single royal blue)
 *   className — extra Tailwind/CSS classes
 */

export default function KharchaLogo({ size = 32, variant = 'color', className = '' }) {
  const royal = '#4169E1'
  const pink  = variant === 'color' ? '#F7A8C4' : royal
  const white = variant === 'color' ? '#ffffff'  : royal

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kharcha Tracker"
      role="img"
    >
      {/* Large royal blue rhombus — left/back */}
      <rect
        x="4"
        y="4"
        width="22"
        height="22"
        rx="4"
        fill={royal}
        transform="rotate(12 15 15)"
        opacity="0.95"
      />

      {/* Small pink rhombus — right/front overlap */}
      <rect
        x="22"
        y="18"
        width="18"
        height="18"
        rx="4"
        fill={pink}
        transform="rotate(-12 31 27)"
        opacity="0.90"
      />

      {/* Coin circle — accent, sits at intersection */}
      <circle
        cx="26"
        cy="20"
        r="6"
        fill={white}
        opacity="0.92"
      />

      {/* Rs symbol inside coin */}
      <text
        x="26"
        y="24"
        textAnchor="middle"
        fontSize="7"
        fontWeight="800"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill={royal}
      >
        ₨
      </text>
    </svg>
  )
}
