/**
 * extractExpenseData.js
 * Shared LLM extraction module — used by both receiptScanner.js and voiceScanner.js.
 *
 * Takes a plain-text description (receipt OCR text or voice transcript) and
 * returns structured expense fields via Groq llama-4-scout with JSON mode.
 */

import Groq from 'groq-sdk'

// Lazy-init — dotenv must load before this is called
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

const TODAY = () => new Date().toISOString().slice(0, 10)         // YYYY-MM-DD
const YESTERDAY = () => {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Extract expense fields from any plain-text input.
 *
 * @param {string}   text        — transcript text or receipt description
 * @param {string[]} categories  — workspace category names (used as allowed list)
 * @returns {Promise<{
 *   amount:   number|null,
 *   category: string|null,
 *   vendor:   string|null,
 *   date:     string|null    // YYYY-MM-DD
 * }>}
 */
export async function extractExpenseData(text, categories = []) {
  if (!text || !text.trim()) {
    return { amount: null, category: null, vendor: null, date: null }
  }

  const categoryList = categories.length > 0
    ? categories.join(', ')
    : 'Food, Transport, Rent, Fun, Other'

  const todayStr     = TODAY()
  const yesterdayStr = YESTERDAY()

  const prompt = `You are an expense data extractor for a Pakistani expense tracker app.
Extract structured fields from the text below and return ONLY a valid JSON object.
No markdown, no code fences, no explanation.

Schema: {"amount": number|null, "category": string|null, "vendor": string|null, "date": "YYYY-MM-DD"|null}

Rules for amount:
- Return as a plain number (no currency symbols, no commas)
- Roman Urdu numbers: "ek so" = 100, "do so" = 200, "teen sau/so" = 300, "char so" = 400,
  "paanch so/sau" = 500, "chhe so" = 600, "saat so" = 700, "aath so" = 800, "nau so" = 900,
  "ek hazaar/hazar" = 1000, "do hazaar" = 2000, "paanch hazaar" = 5000, "das hazaar" = 10000
- Patterns like "1500 ka", "Rs 200", "PKR 450", "450 rupay/rupees" → extract the number
- If no amount found → null

Rules for category (pick CLOSEST from this list ONLY: ${categoryList}):
- Food/restaurant/khana/biryani/burger/chai → Food
- Transport/ride/Careem/Uber/petrol/fare/sawari → Transport
- Rent/kiraya/makaan/ghar ka kiraya → Rent
- Entertainment/cinema/fun/game/tamasha → Fun
- Everything else → Other
- Mobile wallet transfers (Easypaisa, JazzCash, send money) → Other

Rules for vendor:
- Extract the business/person/app name
- Strip suffixes: "Burns Road wala" → "Burns Road", "Careem se" → "Careem", "KFC mein" → "KFC"
- Max 60 characters

Rules for date:
- "aaj" or "today" → "${todayStr}"
- "kal" or "yesterday" → "${yesterdayStr}"
- If a specific date is mentioned, convert to YYYY-MM-DD
- If no date mentioned → null (do NOT default to today)

Input text:
"""
${text.trim()}
"""`.trim()

  const groq = getGroq()

  const response = await groq.chat.completions.create({
    model:           'meta-llama/llama-4-scout-17b-16e-instruct',
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens:      256,
    temperature:     0,
  })

  const raw = response.choices?.[0]?.message?.content?.trim()
  if (!raw) return { amount: null, category: null, vendor: null, date: null }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[extractExpenseData] non-JSON response:', raw)
    return { amount: null, category: null, vendor: null, date: null }
  }

  // ── Sanitize ──────────────────────────────────────────────
  const amount = typeof parsed.amount === 'number' && parsed.amount > 0
    ? Math.round(parsed.amount * 100) / 100
    : null

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
