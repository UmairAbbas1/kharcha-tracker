/**
 * RecurringBanner.jsx
 * Banner displayed at the top of pages prompting users to confirm pending recurring draft expenses.
 */

import { useState } from 'react'
import { Calendar, Check, Loader2, RefreshCw, X } from 'lucide-react'

export default function RecurringBanner({ drafts = [], onConfirm, onDismiss }) {
  const [confirmingId, setConfirmingId] = useState(null)

  const handleConfirm = async (draft) => {
    setConfirmingId(draft.id)
    try {
      await onConfirm(draft)
    } catch (err) {
      console.error('[RecurringBanner] Confirm failed:', err)
    } finally {
      setConfirmingId(null)
    }
  }

  if (drafts.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {drafts.map(draft => (
        <div
          key={draft.id}
          className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm animate-entry"
          style={{
            background: '#EFF6FF', // Light blue background
            borderColor: '#BFDBFE',
            color: '#1E40AF',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <RefreshCw size={14} className={confirmingId === draft.id ? 'animate-spin' : ''} />
            </div>
            <div>
              <p className="font-semibold text-blue-900 leading-tight">
                Expected Recurring Expense
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                <strong>{draft.vendor}</strong> (Rs {Number(draft.amount).toLocaleString('en-PK')}) is expected on {draft.next_expected_date}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onDismiss(draft.id)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
              style={{ color: '#1E40AF' }}
              disabled={confirmingId !== null}
            >
              Skip
            </button>
            <button
              onClick={() => handleConfirm(draft)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: '#2563EB' }}
              disabled={confirmingId !== null}
            >
              {confirmingId === draft.id ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check size={12} strokeWidth={2.5} />
                  Confirm & Save
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
