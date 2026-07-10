/**
 * receiptScanner.js
 * Parses a receipt image using Groq Llama 4 Scout (vision).
 * JSON extraction is delegated to the shared extractExpenseData module.
 *
 * The image is processed in memory and never stored or logged.
 */

import Groq from 'groq-sdk'
import { extractExpenseData } from './extractExpenseData.js'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024   // 4 MB (Llama 4 Scout base64 limit)
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp']

// Lazy-init client so dotenv is loaded before construction
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

/**
 * Scan a receipt image and return structured expense data.
 *
 * @param {string}   dataUri    — Full data URI: "data:image/jpeg;base64,..."
 * @param {string[]} categories — Workspace category names
 * @returns {Promise<{ amount: number|null, category: string|null, vendor: string|null, date: string|null }>}
 */
export async function scanReceipt(dataUri, categories = []) {
  // ── Validate ──────────────────────────────────────────────
  if (!dataUri || typeof dataUri !== 'string') {
    throw Object.assign(new Error('No image provided'), { status: 400 })
  }

  const mimeMatch = dataUri.match(/^data:([^;]+);base64,/)
  if (!mimeMatch) {
    throw Object.assign(
      new Error('Invalid image format. Must be a base64 data URI.'),
      { status: 400 }
    )
  }

  const mimeType = mimeMatch[1].toLowerCase()
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw Object.assign(
      new Error('Unsupported image format. Use JPEG, PNG, or WEBP.'),
      { status: 400 }
    )
  }

  const base64Data  = dataUri.replace(/^data:[^;]+;base64,/, '')
  const approxBytes = Math.ceil(base64Data.length * 0.75)
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image exceeds 4MB limit'), { status: 400 })
  }

  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('GROQ_API_KEY not configured'), { status: 503 })
  }

  // ── Step 1: Ask vision model to describe the receipt as text ─
  const categoryList = categories.length > 0
    ? categories.join(', ')
    : 'Food, Transport, Rent, Fun, Other'

  const visionPrompt = `You are a receipt parser for a Pakistani expense tracker.
Describe the key financial fields from this receipt image as a plain text sentence.
Include: total amount paid, vendor/business name, transaction date, and type of purchase.
Be concise. Example: "Paid Rs 1000 to easypaisa on 26 June 2024 for money transfer."
Available categories: ${categoryList}`

  const groq = getGroq()

  const visionResponse = await groq.chat.completions.create({
    model:    'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role:    'user',
        content: [
          { type: 'text',      text: visionPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
    max_tokens:  256,
    temperature: 0,
  })

  const description = visionResponse.choices?.[0]?.message?.content?.trim()

  if (!description) {
    throw Object.assign(
      new Error('Could not extract expense data from this image. Please fill in manually.'),
      { status: 422 }
    )
  }

  console.log('[receiptScanner] vision description:', description)

  // ── Step 2: Extract structured fields via shared module ───
  return extractExpenseData(description, categories)
}
