/**
 * voiceScanner.js
 * Transcribes audio using Groq Whisper, then extracts expense fields
 * via the shared extractExpenseData module.
 *
 * Audio is processed entirely in memory — never written to disk.
 */

import Groq from 'groq-sdk'
import { extractExpenseData } from './extractExpenseData.js'

const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']

// Extension map for File constructor (Whisper needs a filename with extension)
const MIME_TO_EXT = {
  'audio/webm': 'webm',
  'audio/mp4':  'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav':  'wav',
  'audio/ogg':  'ogg',
}

// Lazy-init shared Groq client
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

/**
 * Transcribe audio buffer with Groq Whisper, then extract expense fields.
 *
 * @param {Buffer}   fileBuffer  — raw audio bytes from multer memoryStorage
 * @param {string}   mimeType    — MIME type of the uploaded audio
 * @param {string[]} categories  — workspace category names
 * @returns {Promise<{
 *   transcript: string,
 *   amount:     number|null,
 *   category:   string|null,
 *   vendor:     string|null,
 *   date:       string|null
 * }>}
 */
export async function transcribeAndExtract(fileBuffer, mimeType, categories = []) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(
      new Error('Voice transcription not configured'),
      { status: 503 }
    )
  }

  // Normalise mime — browsers sometimes send 'audio/webm;codecs=opus'
  const baseMime = mimeType?.split(';')[0].toLowerCase().trim()

  if (!ALLOWED_MIME_TYPES.includes(baseMime)) {
    throw Object.assign(
      new Error(`Unsupported audio format: ${baseMime}`),
      { status: 400 }
    )
  }

  const ext  = MIME_TO_EXT[baseMime] || 'webm'
  const file = new File([fileBuffer], `audio.${ext}`, { type: baseMime })

  // ── Step 1: Transcribe with Whisper ──────────────────────
  const groq = getGroq()

  let transcript
  try {
    const result = await groq.audio.transcriptions.create({
      model:           'whisper-large-v3-turbo',
      file,
      language:        'en',          // handles Roman Urdu within English pipeline
      response_format: 'text',
      // Seed vocabulary toward financial / Urdu terms
      prompt: 'Expense entry in English or Roman Urdu. ' +
              'Financial terms: rupees, Rs, amount, spent, kharcha, kharch, ' +
              'paisa, hazaar, hazar, so, sau, teen, char, paanch, ek, do.',
    })
    // Groq returns the transcript directly as a string when response_format='text'
    transcript = typeof result === 'string' ? result.trim() : result?.text?.trim() ?? ''
  } catch (err) {
    console.error('[voiceScanner] Whisper error:', err.message)
    throw Object.assign(
      new Error('Transcription failed. Please try again or fill in manually.'),
      { status: 422 }
    )
  }

  if (!transcript) {
    throw Object.assign(
      new Error('No speech detected. Please try again.'),
      { status: 422 }
    )
  }

  console.log('[voiceScanner] transcript:', transcript)

  // ── Step 2: Extract expense fields ───────────────────────
  const { amount, category, vendor, date } = await extractExpenseData(transcript, categories)

  return { transcript, amount, category, vendor, date }
}

/**
 * Transcribe audio to text only — no expense extraction.
 * Used by the Natural Language Expense Assistant voice input.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @returns {Promise<{ transcript: string }>}
 */
export async function transcribeOnly(fileBuffer, mimeType) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('Voice transcription not configured'), { status: 503 })
  }

  const baseMime = mimeType?.split(';')[0].toLowerCase().trim()
  const MIME_TO_EXT = {
    'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3',
    'audio/wav': 'wav', 'audio/ogg': 'ogg',
  }
  const ext  = MIME_TO_EXT[baseMime] || 'webm'
  const file = new File([fileBuffer], `audio.${ext}`, { type: baseMime })

  const groq = getGroq()
  let transcript
  try {
    const result = await groq.audio.transcriptions.create({
      model:           'whisper-large-v3-turbo',
      file,
      language:        'en',
      response_format: 'text',
      prompt:          'Expense question in English or Roman Urdu. Finance vocabulary: rupees, Rs, kharch, kitna, hafte, mahine, category, transport, food.',
    })
    transcript = typeof result === 'string' ? result.trim() : result?.text?.trim() ?? ''
  } catch (err) {
    throw Object.assign(
      new Error('Transcription failed. Please type your question instead.'),
      { status: 422 }
    )
  }

  if (!transcript) {
    throw Object.assign(new Error('No speech detected. Please try again.'), { status: 422 })
  }

  return { transcript }
}
