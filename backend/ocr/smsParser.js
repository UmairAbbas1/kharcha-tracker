/**
 * smsParser.js
 * Hybrid SMS expense extractor for Pakistani bank messages.
 *
 * Fast path  — pure regex, synchronous, <5ms, no API call.
 * Slow path  — Groq LLM fallback via shared extractExpenseData module.
 *
 * SMS text is never logged in full (may contain account numbers).
 * Only extracted fields are logged.
 */

import { extractExpenseData } from './extractExpenseData.js'

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT PATTERNS
// Tried in order — first non-null match wins.
// ─────────────────────────────────────────────────────────────────────────────
const AMOUNT_PATTERNS = [
  // "Rs.2,500"  "Rs 2500"  "Rs.1,000/-"  "PKR 2,500"  "Rs.1000.00"
  /(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/\-)?/i,

  // "Amount: Rs 500"  "Total Amount Rs.1000"  "Total Amount: 1000"
  /(?:total\s+)?amount(?:\s+of)?[:\s]+(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d{1,2})?)/i,

  // "amount of Rs.750"
  /amount\s+of\s+(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d{1,2})?)/i,

  // "debited 2500"  "credited 1000.00"  "sent 450"  "paid 200"  "charged 350"
  /(?:debited|credited|sent|paid|charged)[^\d]+([\d,]+(?:\.\d{1,2})?)/i,
]

// ─────────────────────────────────────────────────────────────────────────────
// DATE PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function monthNum(str) {
  return MONTHS[str.toLowerCase().slice(0, 3)] || null
}

function twoToFour(yy) {
  const n = parseInt(yy, 10)
  return n < 100 ? (n >= 50 ? 1900 + n : 2000 + n) : n
}

const DATE_PATTERNS = [
  {
    // "07-Jul-26"  "07-Jul-2026"
    re: /\b(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\b/,
    parse: (m) => {
      const mon = monthNum(m[2]); if (!mon) return null
      return `${twoToFour(m[3])}-${mon}-${m[1].padStart(2, '0')}`
    },
  },
  {
    // "Jul 07, 2026"  "Jul 7 2026"
    re: /\b([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})\b/,
    parse: (m) => {
      const mon = monthNum(m[1]); if (!mon) return null
      return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`
    },
  },
  {
    // "07/07/2026"
    re: /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
    parse: (m) => `${m[3]}-${m[2]}-${m[1]}`,
  },
  {
    // "07-07-2026"
    re: /\b(\d{2})-(\d{2})-(\d{4})\b/,
    parse: (m) => `${m[3]}-${m[2]}-${m[1]}`,
  },
  {
    // "2026-07-07" (ISO already)
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    parse: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const VENDOR_PATTERNS = [
  // "at KFC DHA on"  "at KFC."  "at Burns Road"
  /\bat\s+([A-Za-z0-9 &'\-\.]{2,40}?)(?:\s+on\b|\s*[,\.]\s*|\s+\d|$)/i,

  // "to HUSNAIN ALI"  "to Careem"  — capital-first words only to avoid false matches
  /\bto\s+([A-Z][A-Za-z0-9 &'\-\.]{1,39}?)(?:\s*[,\.]\s*|\s+\d|$)/,

  // "Merchant: Careem"  "merchant name: KFC"
  /\bmerchant(?:\s+name)?[:\s]+([A-Za-z0-9 &'\-\.]{2,40}?)(?:\s*[,\.]\s*|\s+\d|$)/i,

  // "paid to Foodpanda"
  /\bpaid\s+to\s+([A-Za-z0-9 &'\-\.]{2,40}?)(?:\s*[,\.]\s*|\s+\d|$)/i,
]

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY KEYWORD MAP
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = [
  { cat: 'Food',      re: /kfc|mcdonald|foodpanda|biryani|restaurant|cafe|eatery|pizza|burger|food|khana|dhabba|bakery|sweets|mithai/i },
  { cat: 'Transport', re: /careem|uber|indriver|bykea|petrol|fuel|parking|toll|bus|metro|railway|sawari|ride/i },
  { cat: 'Rent',      re: /rent|kiraya|property|makaan|lease|housing|apartment/i },
  { cat: 'Fun',       re: /cinema|movie|game|netflix|youtube|entertainment|tamasha|ticket/i },
  // Wallet transfers default to Other — detected below
]

function inferCategory(text, categories) {
  const lower = text.toLowerCase()

  // Wallet / transfer keywords → Other
  if (/easypaisa|jazzcash|transfer|send\s+money|disbursement|raast|ibft/i.test(lower)) {
    return categories.includes('Other') ? 'Other' : null
  }

  for (const { cat, re } of CATEGORY_KEYWORDS) {
    if (re.test(lower)) {
      return categories.includes(cat) ? cat : null
    }
  }

  return categories.includes('Other') ? 'Other' : null
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: parseWithRegex — pure sync, no I/O
// ─────────────────────────────────────────────────────────────────────────────
export function parseWithRegex(smsText) {
  const text = smsText || ''

  // ── Amount ──────────────────────────────────────────────
  let amount = null
  for (const pattern of AMOUNT_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      const raw = m[1].replace(/,/g, '')
      const num = parseFloat(raw)
      if (!isNaN(num) && num > 0) {
        amount = Math.round(num * 100) / 100
        break
      }
    }
  }

  // ── Date ────────────────────────────────────────────────
  let date = null
  for (const { re, parse } of DATE_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const parsed = parse(m)
      if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
        date = parsed
        break
      }
    }
  }

  // ── Vendor ──────────────────────────────────────────────
  let vendor = null
  for (const pattern of VENDOR_PATTERNS) {
    const m = text.match(pattern)
    if (m?.[1]) {
      vendor = m[1].trim().replace(/\s+/g, ' ').slice(0, 60)
      if (vendor.length >= 2) break
      vendor = null
    }
  }

  return {
    amount,
    date,
    vendor,
    category:  null,   // filled in by caller with categories list
    confident: amount !== null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: parseAndExtract — hybrid, async
// ─────────────────────────────────────────────────────────────────────────────
export async function parseAndExtract(smsText, categories = []) {
  // ── Fast path ────────────────────────────────────────────
  const regex = parseWithRegex(smsText)

  if (regex.confident) {
    const category = inferCategory(smsText, categories)
    const result = {
      amount:   regex.amount,
      vendor:   regex.vendor,
      date:     regex.date,
      category: regex.category ?? category,
      method:   'regex',
    }
    console.log('[smsParser] regex extracted:', result)
    return result
  }

  // ── Slow path — LLM fallback ─────────────────────────────
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(
      new Error('Could not extract amount from this SMS. Please enter the expense manually.'),
      { status: 422 }
    )
  }

  console.log('[smsParser] regex found no amount — falling back to LLM')

  const llm = await extractExpenseData(smsText, categories)

  if (!llm.amount) {
    throw Object.assign(
      new Error('Could not extract amount from this SMS. Please enter the expense manually.'),
      { status: 422 }
    )
  }

  const result = { ...llm, method: 'llm' }
  console.log('[smsParser] LLM extracted:', result)
  return result
}
