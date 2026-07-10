/**
 * BottomSheet.jsx
 * Mobile slide-up panel — visible only on screens < 768px (md breakpoint).
 * Pure CSS transform animation, no third-party library.
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 *   children  — React node (AddForm goes here)
 */

import { useEffect, useRef } from 'react'

export default function BottomSheet({ open, onClose, children }) {
  const sheetRef  = useRef()
  const dragStart = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── Swipe-down to close ───────────────────────────────────
  const onTouchStart = (e) => {
    dragStart.current = e.touches[0].clientY
  }
  const onTouchEnd = (e) => {
    if (dragStart.current === null) return
    const delta = e.changedTouches[0].clientY - dragStart.current
    dragStart.current = null
    if (delta > 80) onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 md:hidden transition-opacity duration-300"
        style={{
          background:    'rgba(0,0,0,0.4)',
          opacity:       open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                   rounded-t-xl shadow-2xl overflow-hidden"
        style={{
          background:       '#FFFFFF',
          transform:        open ? 'translateY(0)' : 'translateY(100%)',
          transition:       open
            ? 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 300ms ease-in',
          maxHeight:        '90vh',
          overflowY:        'auto',
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Add expense"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Content */}
        <div className="px-4 pb-8 pt-2">
          {children}
        </div>
      </div>
    </>
  )
}
