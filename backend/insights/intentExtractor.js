/**
 * intentExtractor.js
 * Step 1 of 2 for POST /api/ask.
 * Calls Groq llama-3.3-70b-versatile in JSON mode to extract a structured
 * intent from a natural-language question about expenses.
 *
 * SECURITY: The LLM output is NEVER used to construct SQL or Supabase queries
 * directly. Only the validated intent object is passed to queryRunner.js which
 * selects a pre-written safe query function.
 */

import Groq from 'groq-sdk'

let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

const VALID_AGGREGATIONS = ['sum', 'count', 'max', 'avg', 'list']
const VALID_DATE_TYPES   = [
  'this_week', 'last_week', 'this_month', 'last_month',
  'specific_month', 'specific_year', 'all_time',
]

/**
 * Extract a structured intent from a natural-language expense question.
 *
 * @param {string}   question    — raw user question (English or Roman Urdu)
 * @param {string[]} categories  — workspace category names for resolution
 * @param {string}   todayStr    — "YYYY-MM-DD" (caller-provided, never from LLM)
 * @returns {Promise<IntentSchema>}
 * @throws  {{ status: 422, message: string }} on invalid/unparseable intent
 */
export async function extractIntent(question, categories = [], todayStr) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(
      new Error('AI assistant is not configured. Contact the workspace owner.'),
      { status: 503 }
    )
  }

  const catList = categories.length > 0 ? categories.join(', ') : 'Food, Transport, Rent, Fun, Other'

  const prompt = `Today is ${todayStr}.
Workspace expense categories: ${catList}.

Extract a structured query intent from the user's expense question.
Return ONLY valid JSON matching this exact schema. No markdown, no explanation.

Schema:
{
  "aggregation": "sum"|"count"|"max"|"avg"|"list",
  "category":    string|null,
  "vendor":      string|null,
  "dateRange": {
    "type":  "this_week"|"last_week"|"this_month"|"last_month"|"specific_month"|"specific_year"|"all_time",
    "month": "YYYY-MM"|null,
    "year":  "YYYY"|null
  },
  "limit": number|null
}

Rules:
- aggregation: "sum" for total/kitna kharch, "count" for how many/kitni baar, "max" for biggest/sabse zyada, "avg" for average, "list" for show me/list/batao
- category: match case-insensitively to one of the provided categories, null if not mentioned
- vendor: the vendor/place name exactly as mentioned, null if not mentioned
- dateRange.type: "is hafte"/"this week"→this_week, "pichle hafte"/"last week"→last_week, "is mahine"/"this month"→this_month, "pichle mahine"/"last month"→last_month, named month (June/July/etc.)→specific_month with month field set, a year→specific_year, no time mention→this_month
- dateRange.month: set only when type is specific_month, format YYYY-MM
- dateRange.year: set only when type is specific_year, format YYYY
- limit: for "list", default 5, max 10, null for other aggregations

Question: "${question.replace(/"/g, "'")}"
`

  const groq = getGroq()

  const response = await groq.chat.completions.create({
    model:           'llama-3.3-70b-versatile',
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens:      200,
    temperature:     0,
  })

  const raw = response.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    throw Object.assign(
      new Error('I could not understand that question. Try asking about a specific category or time period.'),
      { status: 422 }
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw Object.assign(
      new Error('I could not understand that question. Try asking about a specific category or time period.'),
      { status: 422 }
    )
  }

  // ── Validate required fields ──────────────────────────────
  if (!VALID_AGGREGATIONS.includes(parsed.aggregation)) {
    throw Object.assign(
      new Error('I could not understand that question. Try asking about a specific category or time period.'),
      { status: 422 }
    )
  }

  if (!parsed.dateRange || !VALID_DATE_TYPES.includes(parsed.dateRange?.type)) {
    // Default to this_month rather than failing completely
    parsed.dateRange = { type: 'this_month', month: null, year: null }
  }

  // Cap list limit
  if (parsed.aggregation === 'list') {
    parsed.limit = Math.min(Math.max(Number(parsed.limit) || 5, 1), 10)
  } else {
    parsed.limit = null
  }

  // Sanitize strings — only allow alphanumeric + spaces + basic punctuation
  if (parsed.category) {
    parsed.category = String(parsed.category).slice(0, 50).trim() || null
  }
  if (parsed.vendor) {
    parsed.vendor = String(parsed.vendor).replace(/[^\w\s\-\.]/g, '').slice(0, 60).trim() || null
  }
  if (parsed.dateRange.month && !/^\d{4}-\d{2}$/.test(parsed.dateRange.month)) {
    parsed.dateRange.month = null
  }
  if (parsed.dateRange.year && !/^\d{4}$/.test(String(parsed.dateRange.year))) {
    parsed.dateRange.year = null
  }

  console.log('[intentExtractor] intent:', parsed)
  return parsed
}
