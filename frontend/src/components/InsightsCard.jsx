/**
 * InsightsCard.jsx
 * Natural Language Expense Assistant — chat-style UI.
 *
 * - 5-turn session history (useState, cleared on page refresh, never persisted)
 * - Voice input via VoiceRecorder in transcript-only mode
 * - Suggestion chips for quick starts
 * - "How I interpreted" collapsible disclosure under each answer
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import VoiceRecorder from './VoiceRecorder'
import { askAssistant, getCategories } from '../api'

const MAX_HISTORY = 5

const SUGGESTIONS = [
  'is hafte kitna kharch hua?',
  'last month transport total',
  'biggest expense this month',
  'Food pe average kitna?',
  'KFC pe total spend',
]

const PLACEHOLDERS = [
  'is hafte KFC pe kitna hua?',
  'biggest expense in June…',
  'how much on transport last month?',
  'Food pe kitni baar gaye?',
]

function IntentDisclosure({ intent }) {
  const [open, setOpen] = useState(false)
  if (!intent) return null

  const parts = [
    intent.aggregation,
    intent.category   ? `category: ${intent.category}` : null,
    intent.vendor     ? `vendor: ${intent.vendor}`     : null,
    intent.dateRange?.type?.replace(/_/g, ' '),
  ].filter(Boolean).join(' · ')

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs transition"
        style={{ color: '#9CA3AF' }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        how I interpreted this
      </button>
      {open && (
        <p className="mt-1 text-xs rounded-md px-2 py-1.5 font-mono"
           style={{ background: '#F7F8FC', color: '#6B7280' }}>
          {parts}
        </p>
      )}
    </div>
  )
}

function TurnBubble({ turn }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Question */}
      <div className="flex justify-end">
        <div
          className="max-w-xs rounded-2xl rounded-br-sm px-3.5 py-2 text-sm"
          style={{ background: '#2563EB', color: '#fff' }}
        >
          {turn.q}
        </div>
      </div>

      {/* Answer */}
      <div className="flex justify-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: '#EFF6FF' }}
        >
          <Sparkles size={11} color="#2563EB" />
        </div>
        <div className="flex-1 min-w-0">
          {turn.error ? (
            <p className="text-sm rounded-2xl rounded-bl-sm px-3.5 py-2 card"
               style={{ color: '#E85D2F' }}>
              {turn.error}
            </p>
          ) : (
            <div
              className="text-sm rounded-2xl rounded-bl-sm px-3.5 py-2"
              style={{ background: '#F7F8FC', color: '#0F1117' }}
            >
              {turn.a}
              <IntentDisclosure intent={turn.intent} />
            </div>
          )}
          <p className="text-xs mt-1 ml-1" style={{ color: '#9CA3AF' }}>
            {new Date(turn.ts).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function InsightsCard({ workspaceId, categories: propCategories = [], autoFocus, onClearAutoFocus }) {
  const [history,  setHistory]  = useState([])
  const [input,    setInput]    = useState('')
  const [status,   setStatus]   = useState('idle')   // idle | thinking | error
  const [phIdx,    setPhIdx]    = useState(0)
  const [categories, setCategories] = useState(propCategories)
  const inputRef   = useRef(null)
  const bottomRef  = useRef(null)

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories)
    } else if (workspaceId) {
      getCategories(workspaceId)
        .then(res => setCategories(res.data || []))
        .catch(() => {})
    }
  }, [propCategories, workspaceId])

  const categoryNames = categories.map(c => c.name || c)

  // Rotate placeholder
  useEffect(() => {
    const id = setInterval(() =>
      setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3500)
    return () => clearInterval(id)
  }, [])

  // Scroll to bottom on new turn
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // Handle Command Palette autoFocus trigger
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        onClearAutoFocus?.()
      }, 100)
    }
  }, [autoFocus])

  const isGroqMissing = false  // backend returns 503 if key missing — handled in submit

  const submit = async (question) => {
    const q = (question || input).trim()
    if (!q || status === 'thinking') return

    setInput('')
    setStatus('thinking')

    const optimisticTurn = { id: Date.now(), q, a: null, intent: null, error: null, ts: Date.now() }
    setHistory(h => [...h, optimisticTurn].slice(-MAX_HISTORY))

    try {
      const res = await askAssistant(q, workspaceId, categoryNames)
      setHistory(h => h.map(t =>
        t.id === optimisticTurn.id
          ? { ...t, a: res.answer, intent: res.intent }
          : t
      ))
    } catch (err) {
      setHistory(h => h.map(t =>
        t.id === optimisticTurn.id
          ? { ...t, error: err.message || 'Something went wrong. Please try again.' }
          : t
      ))
    } finally {
      setStatus('idle')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleVoice = (data) => {
    if (data?.transcript) {
      setInput(data.transcript)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={14} color="#2563EB" strokeWidth={2.5} />
        <span className="section-label">Smart Insights</span>
        <span
          className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#EFF6FF', color: '#2563EB' }}
        >
          AI
        </span>
      </div>

      {/* History */}
      {history.length > 0 ? (
        <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
          {history.map(turn => (
            <TurnBubble key={turn.id} turn={turn} />
          ))}
          {/* Thinking indicator */}
          {status === 'thinking' && (
            <div className="flex items-center gap-2 pl-8">
              <Loader2 size={13} className="animate-spin" style={{ color: '#2563EB' }} />
              <span className="text-xs" style={{ color: '#6B7280' }}>Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-xl px-4 py-5 text-center"
             style={{ background: '#F7F8FC' }}>
          <Sparkles size={20} color="#2563EB" className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold" style={{ color: '#0F1117' }}>
            Ask about your spending
          </p>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Type or speak a question in English or Roman Urdu
          </p>
        </div>
      )}

      {/* Suggestion chips — only when history is empty */}
      {history.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={status === 'thinking'}
              className="text-xs rounded-full border px-2.5 py-1 transition
                         hover:border-accent hover:text-accent disabled:opacity-40"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'thinking'}
            placeholder={status === 'thinking' ? 'Thinking…' : PLACEHOLDERS[phIdx]}
            className="w-full rounded-xl border px-3.5 py-2 text-sm transition
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: '#E5E7EB',
              color:       '#0F1117',
              background:  '#fff',
              outline:     'none',
            }}
            onFocus={e => (e.target.style.boxShadow = '0 0 0 2px #2563EB40')}
            onBlur={e  => (e.target.style.boxShadow = 'none')}
          />
        </div>

        {/* Voice button — transcript mode only */}
        <VoiceRecorder
          mode="transcript"
          categories={categoryNames}
          onScan={handleVoice}
          onError={() => {}}
        />

        {/* Send */}
        <button
          onClick={() => submit()}
          disabled={!input.trim() || status === 'thinking'}
          title="Send"
          className="w-9 h-9 rounded-xl flex items-center justify-center
                     text-white transition active:scale-95 disabled:opacity-40"
          style={{ background: '#2563EB' }}
        >
          {status === 'thinking'
            ? <Loader2 size={14} className="animate-spin" />
            : <Send size={14} />
          }
        </button>
      </div>
    </div>
  )
}
