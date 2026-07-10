/**
 * KharchaLogo.jsx
 * Abstract geometric SVG mark — a stylised ₨ ligature.
 * Built from a vertical stroke crossed by a diagonal stroke ending in a small circle.
 * No rectangles or overlapping shapes.
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
      aria-label="Kharcha Tracker Logo"
      role="img"
    >
      {/* Vertical stroke */}
      <line
        x1="16"
        y1="6"
        x2="16"
        y2="34"
        stroke={c}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Diagonal stroke crossing it */}
      <line
        x1="7"
        y1="14"
        x2="29"
        y2="28"
        stroke={c}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Small circle at the end of the diagonal */}
      <circle
        cx="29"
        cy="28"
        r="4.5"
        fill={c}
      />
    </svg>
  )
}
