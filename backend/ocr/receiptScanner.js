/**
 * receiptScanner.js
 * Parses a receipt image using Groq's llama-3.2-90b-vision-preview model.
 * Returns structured expense data: { amount, category, vendor, date }
 *
 * The image is processed in memory and never stored or logged.
 */

import Groq from 'groq-sdk'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB (Llama 4 Scout base64 limit)
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp']

// Lazy-init client so dotenv loads first
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

/**
 * Extract expense data from a base64 receipt image.
 *
 * @param {string}   dataUri    - Full data URI: "data:image/jpeg;base64,..."
 * @param {string[]} categories - Workspace category names for category mapping
 * @returns {Promise<{ amount: number|null, category: string|null, vendor: string|null, date: string|null }>}
 */
export async function scanReceipt(dataUri, categories = []) {
  // ── Validate ──────────────────────────────────────────────
  if (!dataUri || typeof dataUri !== 'string') {
    throw Object.assign(new Error('No image provided'), { status: 400 })
  }

  const mimeMatch = dataUri.match(/^data:([^;]+);base64,/)
  if (!mimeMatch) {
    throw Object.assign(new Error('Invalid image format. Must be a base64 data URI.'), { status: 400 })
  }

  const mimeType = mimeMatch[1].toLowerCase()
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw Object.assign(
      new Error(`Unsupported image format. Use JPEG, PNG, or WEBP.`),
      { status: 400 }
    )
  }

  // Check size (base64 is ~4/3 of raw bytes)
  const base64Data  = dataUri.replace(/^data:[^;]+;base64,/, '')
  const approxBytes = Math.ceil(base64Data.length * 0.75)
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image exceeds 5MB limit'), { status: 400 })
  }

  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('GROQ_API_KEY not configured'), { status: 503 })
  }

  // ── Build prompt ──────────────────────────────────────────
  const categoryList = categories.length > 0
    ? categories.join(', ')
    : 'Food, Transport, Rent, Fun, Other'

  const systemPrompt = `You are a receipt and transaction parser for a Pakistani expense tracker.
Extract expense data from the image and return ONLY a valid JSON object.
No markdown, no code fences, no explanation — raw JSON only.

Schema: {"amount": number|null, "category": string|null, "vendor": string|null, "date": "YYYY-MM-DD"|null}

Rules:
- amount: the final total paid as a plain number (e.g. 1000, not "Rs.1000" or "1,000")
  Look for: "Total Amount", "Grand Total", "Amount", "Rs.", "PKR"
  For mobile wallet receipts (Easypaisa, JazzCash, etc): use the "Total Amount" or "Amount" field
- category: pick the CLOSEST match from this list ONLY: ${categoryList}
  Mobile money transfers → Other
  Food/restaurants → Food
  Transport/ride-hailing → Transport
  Utilities/bills → Other
  Rent/property → Rent
  Entertainment → Fun
- vendor: the business or app name (e.g. "easypaisa", "KFC", "Careem")
- date: transaction date in YYYY-MM-DD format (convert "26 June 2024" → "2024-06-26")
- Use null for any field that is truly absent — never fabricate data`

  // ── Call Groq with JSON mode ───────────────────────────────
  const groq = getGroq()

  const response = await groq.chat.completions.create({
    model:    'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role:    'user',
        content: [
          { type: 'text',      text: systemPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
    response_format: { type: 'json_object' },  // forces valid JSON output
    max_tokens:      512,
    temperature:     0,
  })

  const raw = response.choices?.[0]?.message?.content?.trim()

  if (!raw) {
    throw Object.assign(
      new Error('Could not extract expense data from this image. Please fill in manually.'),
      { status: 422 }
    )
  }

  // ── Parse JSON safely ─────────────────────────────────────
  let parsed
  try {
    // Strip any accidental markdown fences the model might add despite instructions
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[receiptScanner] Groq returned non-JSON:', raw)
    throw Object.assign(
      new Error('Could not extract expense data from this image. Please fill in manually.'),
      { status: 422 }
    )
  }

  // ── Sanitize fields ───────────────────────────────────────
  const amount = typeof parsed.amount === 'number' && parsed.amount > 0
    ? Math.round(parsed.amount * 100) / 100
    : null

  // Only accept category if it's in the provided list (case-insensitive match)
  const catMatch = categories.find(
    c => c.toLowerCase() === String(parsed.category || '').toLowerCase()
  )
  const category = catMatch ?? (categories.includes('Other') ? 'Other' : null)

  const vendor = parsed.vendor && typeof parsed.vendor === 'string'
    ? parsed.vendor.trim().slice(0, 100)
    : null

  const dateValid = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
  const date = dateValid ? parsed.date : null

  return { amount, category, vendor, date }
}
