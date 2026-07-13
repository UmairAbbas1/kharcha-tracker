/**
 * AddForm.jsx
 * Add-expense form with photo OCR, voice scanner, and SMS parsing.
 * Supports splitting expenses among workspace members.
 */

import { useState, useEffect, useRef } from 'react'
import { PlusCircle, MessageSquare, X, Loader2, Users } from 'lucide-react'
import ReceiptScanner from './ReceiptScanner'
import VoiceRecorder  from './VoiceRecorder'
import { scanSms, getWorkspaceMembers, splitExpense } from '../api'

const TRANSCRIPT_MAX = 80
const SMS_PLACEHOLDER = `Paste your bank SMS here.
e.g. MCB: Rs.2,500 debited from A/C **1234 at KFC DHA on 07-Jul-26. Avl Bal: Rs.18,750`
const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

export default function AddForm({ categories = [], onAdd, loading, prefill, onClearPrefill, workspaceId }) {
  const [title,         setTitle]         = useState('')
  const [amount,        setAmount]        = useState('')
  const [catId,         setCatId]         = useState('')
  const [date,          setDate]          = useState(new Date().toISOString().split('T')[0])
  const [receiptUrl,    setReceiptUrl]    = useState(null)
  const [error,         setError]         = useState('')
  const [scanned,       setScanned]       = useState(false)
  const [transcript,    setTranscript]    = useState(null)
  const [extractMethod, setExtractMethod] = useState(null)   // 'regex' | 'llm' | null

  // ── SMS panel state ───────────────────────────────────────
  const [smsMode,    setSmsMode]    = useState(false)
  const [smsText,    setSmsText]    = useState('')
  const [smsLoading, setSmsLoading] = useState(false)
  const smsRef = useRef()

  // ── Split Expense State ───────────────────────────────────
  const [members, setMembers] = useState([])
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [checkedMembers, setCheckedMembers] = useState([])

  // Load workspace members for splits
  useEffect(() => {
    if (!workspaceId) return
    getWorkspaceMembers(workspaceId)
      .then(res => {
        setMembers(res.data || [])
        setCheckedMembers((res.data || []).map(m => m.user_id))
      })
      .catch(err => console.warn('[AddForm] failed to load workspace members:', err))
  }, [workspaceId])

  // Focus textarea when SMS panel opens
  useEffect(() => {
    if (smsMode) setTimeout(() => smsRef.current?.focus(), 50)
  }, [smsMode])

  // ── Apply prefill (receipt / voice / external) ────────────
  useEffect(() => {
    if (!prefill) return
    if (prefill.vendor)   setTitle(prefill.vendor)
    if (prefill.amount)   setAmount(String(prefill.amount))
    if (prefill.date)     setDate(prefill.date)
    if (prefill.receipt_url) setReceiptUrl(prefill.receipt_url)
    if (prefill.category) {
      const match = categories.find(
        c => c.name.toLowerCase() === prefill.category.toLowerCase()
      )
      if (match) setCatId(match.id)
    }
    setScanned(true)
    setError('')
  }, [prefill])

  const activeCatId = catId || categories[0]?.id || ''
  const categoryNames = categories.map(c => c.name)

  // ── Shared result handler ─────────────────────────────────
  const handleScanResult = (data, method = null) => {
    if (data.vendor)   setTitle(data.vendor)
    if (data.amount)   setAmount(String(data.amount))
    if (data.date)     setDate(data.date)
    if (data.receipt_url) setReceiptUrl(data.receipt_url)
    if (data.category) {
      const match = categories.find(
        c => c.name.toLowerCase() === data.category.toLowerCase()
      )
      if (match) setCatId(match.id)
    }
    setScanned(true)
    setExtractMethod(method)
    setError('')
  }

  const handleReceiptScan = (data) => {
    setTranscript(null)
    handleScanResult(data, null)
  }

  const handleVoiceScan = (data) => {
    setTranscript(data.transcript || null)
    handleScanResult(data, null)
  }

  // ── SMS extract ───────────────────────────────────────────
  const handleSmsExtract = async () => {
    if (smsText.trim().length < 10) return
    setSmsLoading(true)
    setError('')
    try {
      const result = await scanSms(smsText.trim(), categoryNames)
      setTranscript(null)
      handleScanResult(result, result.method)
      setSmsMode(false)
      setSmsText('')
    } catch (err) {
      setError(err.message || 'Could not extract from SMS. Please fill in manually.')
    } finally {
      setSmsLoading(false)
    }
  }

  const cancelSms = () => {
    setSmsMode(false)
    setSmsText('')
    setError('')
  }

  // ── Form submit ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim())
      return setError('Please enter a title.')
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return setError('Enter a valid amount.')
    if (!activeCatId)
      return setError('No category available.')
    if (splitEnabled && checkedMembers.length === 0)
      return setError('Please select at least one member to split with.')

    try {
      const res = await onAdd({
        title:       title.trim(),
        amount:      Number(amount),
        category_id: activeCatId,
        date,
        receipt_url: receiptUrl,
      })

      if (splitEnabled && res?.data?.id) {
        const share = Number(amount) / checkedMembers.length
        const splits = checkedMembers.map(mid => ({
          member_id: mid,
          share_amount: Number(share.toFixed(2))
        }))
        await splitExpense(res.data.id, splits)
      }

      setTitle('')
      setAmount('')
      setReceiptUrl(null)
      setScanned(false)
      setTranscript(null)
      setExtractMethod(null)
      setSplitEnabled(false)
      if (members.length > 0) {
        setCheckedMembers(members.map(m => m.user_id))
      }
      onClearPrefill?.()
    } catch (err) {
      setError(err.message || 'Failed to add expense.')
    }
  }

  // Truncate transcript
  const transcriptDisplay = transcript
    ? transcript.length > TRANSCRIPT_MAX
      ? transcript.slice(0, TRANSCRIPT_MAX) + '…'
      : transcript
    : null

  const methodLabel = extractMethod === 'regex' ? 'pattern match' : extractMethod === 'llm' ? 'AI' : null

  return (
    <div className="card p-6">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <h2 className="text-sm font-bold text-gray-600 dark:text-gray-200 flex items-center gap-2
                       uppercase tracking-wider pt-1 flex-shrink-0">
          <PlusCircle size={15} color="#2563EB" />
          Add Expense
        </h2>

        <div className="flex flex-wrap justify-end gap-2">
          <ReceiptScanner
            workspaceId={workspaceId}
            categories={categoryNames}
            onScan={handleReceiptScan}
            onError={(msg) => setError(msg)}
          />
          <VoiceRecorder
            categories={categoryNames}
            onScan={handleVoiceScan}
            onError={(msg) => setError(msg)}
          />
          {/* SMS button — toggles the inline panel */}
          <button
            type="button"
            onClick={() => smsMode ? cancelSms() : setSmsMode(true)}
            title="Paste bank SMS"
            className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold
                        border transition active:scale-95
                        ${smsMode
                          ? 'bg-blue-50 border-accent text-accent'
                          : 'bg-white/60 border-blue-100 text-accent hover:bg-blue-50'}`}
          >
            <MessageSquare size={13} />
            Paste SMS
          </button>
        </div>
      </div>

      {/* ── SMS inline panel ── */}
      {smsMode && (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3 flex flex-col gap-2">
          <textarea
            ref={smsRef}
            value={smsText}
            onChange={e => setSmsText(e.target.value)}
            placeholder={SMS_PLACEHOLDER}
            rows={4}
            maxLength={1000}
            disabled={smsLoading}
            className="w-full rounded-xl border border-blue-100 bg-white/80 px-3 py-2
                       text-xs text-gray-700 placeholder-gray-400 resize-none
                       focus:outline-none focus:ring-2 focus:ring-royal/20
                       disabled:opacity-50 leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400 tabular-nums">
              {smsText.length} / 1000
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelSms}
                disabled={smsLoading}
                className="flex items-center gap-1 rounded-xl border border-blue-100
                           bg-white/80 px-3 py-1.5 text-xs font-bold text-gray-500
                           hover:text-gray-700 transition disabled:opacity-50"
              >
                <X size={11} />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSmsExtract}
                disabled={smsText.trim().length < 10 || smsLoading}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs
                           font-bold text-white transition active:scale-95 disabled:opacity-50"
                style={{ background: '#2563EB' }}
              >
                {smsLoading
                  ? <><Loader2 size={11} className="animate-spin" /> Extracting…</>
                  : 'Extract'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Verify hint — shown after any scan ── */}
      {scanned && (
        <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200
                        px-3 py-2 text-xs text-amber-700 font-medium">
          <div className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Please verify details before saving.</span>
          </div>
          {transcriptDisplay && (
            <div className="mt-1 pl-5 text-amber-600 italic">
              Heard: &ldquo;{transcriptDisplay}&rdquo;
            </div>
          )}
          {methodLabel && (
            <div className="mt-1 pl-5 text-amber-600">
              Extracted via: <span className="font-semibold">{methodLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Main form — hidden while SMS panel is open ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">

        {!smsMode && (
          <>
            {/* Title */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Biryani, Careem, Utility Bill…"
              className="w-full rounded-2xl border border-blue-100 bg-white/60 px-4 py-2.5
                         text-sm text-gray-700 placeholder-gray-400 transition"
              required
            />

            {/* Amount + Category */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                  Rs
                </span>
                <input
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  className={`w-full rounded-2xl border bg-white/60 pl-9 pr-3 py-2.5
                              text-sm text-gray-700 placeholder-gray-400 transition
                              ${scanned ? 'border-amber-300 ring-1 ring-amber-200' : 'border-blue-100'}`}
                  required
                />
              </div>

              <select
                value={activeCatId}
                onChange={e => setCatId(e.target.value)}
                className="rounded-2xl border border-blue-100 bg-white/60 px-3 py-2.5
                           text-sm text-gray-700 cursor-pointer transition"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full rounded-2xl border bg-white/60 px-4 py-2.5
                          text-sm text-gray-700 transition
                          ${scanned ? 'border-amber-300 ring-1 ring-amber-200' : 'border-blue-100'}`}
              required
            />

            {/* Split Toggle */}
            {members.length > 1 && (
              <div className="mt-2 border-t pt-3 border-blue-50">
                <label className="flex items-center gap-2 cursor-pointer mb-2 select-none">
                  <input
                    type="checkbox"
                    checked={splitEnabled}
                    onChange={e => setSplitEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Split this expense among workspace members
                  </span>
                </label>

                {splitEnabled && (
                  <div className="pl-6 flex flex-col gap-2 bg-blue-50/20 dark:bg-gray-800/10 p-3 rounded-xl border border-blue-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      Select Members (Portion: {pkr((Number(amount || 0) / (checkedMembers.length || 1)).toFixed(2))} each)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {members.map(m => {
                        const isChecked = checkedMembers.includes(m.user_id)
                        return (
                          <label key={m.user_id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setCheckedMembers(prev => 
                                  isChecked 
                                    ? prev.filter(uid => uid !== m.user_id)
                                    : [...prev, m.user_id]
                                )
                              }}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="truncate" title={m.email}>{m.email.split('@')[0]}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 -mt-1 pl-1">{error}</p>
        )}

        {/* Submit — always visible so user can save after SMS fills fields */}
        {!smsMode && (
          <button
            type="submit"
            disabled={loading || categories.length === 0}
            className="w-full rounded-2xl py-2.5 text-sm font-bold text-white
                       flex items-center justify-center gap-2 shadow-md
                       transition-all active:scale-95 disabled:opacity-60"
            style={{ background: '#2563EB' }}
          >
            <PlusCircle size={15} />
            {loading ? 'Adding…' : 'Add Kharcha'}
          </button>
        )}
      </form>
    </div>
  )
}
