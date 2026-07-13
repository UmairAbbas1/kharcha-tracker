/**
 * VoiceRecorder.jsx
 * Microphone button with full state machine:
 *   IDLE → REQUESTING → RECORDING → TRANSCRIBING → IDLE
 *                  ↓
 *              DENIED (stays until user retries)
 *
 * No new npm dependencies — uses native MediaRecorder + fetch.
 */

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, Loader2 } from 'lucide-react'
import { scanVoice, transcribeOnly } from '../api'

const STATES = {
  IDLE:          'IDLE',
  REQUESTING:    'REQUESTING',
  RECORDING:     'RECORDING',
  TRANSCRIBING:  'TRANSCRIBING',
  DENIED:        'DENIED',
}

const MAX_DURATION_MS = 60_000

/**
 * @param {{
 *   categories: string[],
 *   mode:       'expense'|'transcript',  — default 'expense'
 *   onScan:    (data) => void,  — expense mode: full data; transcript mode: { transcript }
 *   onError:   (msg: string) => void,
 * }} props
 */
export default function VoiceRecorder({ categories = [], mode = 'expense', onScan, onError }) {
  const [state,     setState]     = useState(STATES.IDLE)
  const [seconds,   setSeconds]   = useState(0)
  const [errorMsg,  setErrorMsg]  = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const autoStopRef      = useRef(null)
  const streamRef        = useRef(null)

  // Check browser support once on mount
  const isSupported = typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(autoStopRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const showError = (msg) => {
    setErrorMsg(msg)
    onError?.(msg)
    setTimeout(() => setErrorMsg(''), 5000)
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const startRecording = async () => {
    if (!isSupported) return

    setState(STATES.REQUESTING)
    setErrorMsg('')

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setState(STATES.DENIED)
        setErrorMsg('Microphone access denied. Please allow microphone access in your browser settings.')
      } else {
        setState(STATES.IDLE)
        showError('Could not access microphone. Please check your device.')
      }
      return
    }

    streamRef.current = stream
    chunksRef.current = []

    // Pick the best supported MIME type
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      .find(t => MediaRecorder.isTypeSupported(t)) || ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      clearInterval(timerRef.current)
      clearTimeout(autoStopRef.current)
      stopStream()

      const finalMime = recorder.mimeType || mimeType || 'audio/webm'
      const blob      = new Blob(chunksRef.current, { type: finalMime })

      if (blob.size < 1000) {
        setState(STATES.IDLE)
        showError('No speech detected. Please try again.')
        return
      }

      setState(STATES.TRANSCRIBING)
      try {
        let result
        if (mode === 'transcript') {
          result = await transcribeOnly(blob)
        } else {
          result = await scanVoice(blob, categories)
        }
        setState(STATES.IDLE)
        setSeconds(0)
        onScan?.(result)
      } catch (err) {
        setState(STATES.IDLE)
        setSeconds(0)
        showError(err.message || 'Transcription failed. Please try again or fill in manually.')
      }
    }

    recorder.start(250)   // collect data every 250 ms
    setState(STATES.RECORDING)
    setSeconds(0)

    // Live timer
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)

    // Auto-stop after 60 s
    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, MAX_DURATION_MS)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleClick = () => {
    if (state === STATES.IDLE || state === STATES.DENIED) {
      startRecording()
    } else if (state === STATES.RECORDING) {
      stopRecording()
    }
    // REQUESTING / TRANSCRIBING — button is disabled, no action
  }

  // Derived display values
  const mm = String(Math.floor(seconds / 60)).padStart(1, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const timer = `${mm}:${ss}`

  // If not supported, render nothing
  if (!isSupported) return null

  const isDisabled = state === STATES.REQUESTING || state === STATES.TRANSCRIBING

  const buttonStyle = {
    background: state === STATES.RECORDING ? '#ef4444' : '#4169E1',
    opacity:    isDisabled ? 0.6 : 1,
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">

        {/* Recording indicator */}
        {state === STATES.RECORDING && (
          <div className="flex items-center gap-1.5">
            {/* Pulsing dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-mono text-red-500 font-bold tabular-nums">
              {timer}
            </span>
          </div>
        )}

        {/* Transcribing indicator */}
        {state === STATES.TRANSCRIBING && (
          <span className="text-xs text-gray-400 italic">Transcribing…</span>
        )}

        {/* Main button */}
        <button
          type="button"
          onClick={handleClick}
          disabled={isDisabled}
          title={
            state === STATES.RECORDING    ? 'Stop recording'   :
            state === STATES.DENIED       ? 'Microphone denied' :
            state === STATES.TRANSCRIBING ? 'Transcribing…'    :
            'Record expense'
          }
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold
                     text-white transition active:scale-95 disabled:cursor-not-allowed"
          style={buttonStyle}
        >
          {state === STATES.IDLE || state === STATES.DENIED
            ? <Mic       size={13} />
            : state === STATES.RECORDING
            ? <Square    size={13} />
            : <Loader2   size={13} className="animate-spin" />
          }
          {state === STATES.IDLE          ? 'Voice'         :
           state === STATES.REQUESTING    ? 'Starting…'     :
           state === STATES.RECORDING     ? 'Stop'          :
           state === STATES.TRANSCRIBING  ? 'Processing…'   :
           /* DENIED */                    'Mic Denied'
          }
        </button>
      </div>

      {/* Inline error / permission message */}
      {errorMsg && (
        <p className="text-xs text-red-500 text-right max-w-xs leading-tight">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
