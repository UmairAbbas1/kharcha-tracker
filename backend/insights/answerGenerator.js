/**
 * answerGenerator.js
 * Step 2b of 2 for POST /api/ask.
 * Takes the structured query result and generates a conversational answer
 * via Groq llama-3.3-70b-versatile (plain text, not JSON mode).
 *
 * PRIVACY: Only amounts and dates are included in the prompt — never expense
 * titles or vendor names from the database, to avoid PII leakage to Groq.
 */

import Groq from 'groq-sdk'

let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

const pkr = (n) => n != null ? `Rs ${Number(n).toLocaleString('en-PK')}` : 'kuch nahi'

/**
 * @param {string}      question  — original user question
 * @param {object}      intent    — validated IntentSchema
 * @param {object}      result    — { value, count, rows? }
 * @returns {Promise<string>}     — 1-2 sentence plain text answer
 */
export async function generateAnswer(question, intent, result) {
  const groq = getGroq()

  // Build a privacy-safe result summary — amounts and dates only
  let resultSummary
  if (result.count === 0 || result.value === null) {
    resultSummary = 'No matching expenses found (count=0).'
  } else if (result.rows?.length) {
    const rowSummary = result.rows
      .map(r => `${pkr(r.amount)} on ${r.date} (${r.category})`)
      .join('; ')
    resultSummary = `${result.rows.length} entries: ${rowSummary}. Total: ${pkr(result.value)}.`
  } else {
    resultSummary = `value=${pkr(result.value)}, count=${result.count}`
  }

  const prompt = `You are a friendly expense assistant for Kharcha Tracker, a Pakistani personal finance app.

Write a SHORT answer (1-2 sentences only) in casual mixed Roman Urdu and English.
Be specific with amounts — always use "Rs" prefix. No markdown. No bullet points.
If result is zero/empty, say something like "Koi expense nahi mili is period mein."

User's question: "${question.replace(/"/g, "'")}"
Query type: ${intent.aggregation} on ${intent.category || 'all categories'} for ${intent.dateRange.type.replace(/_/g, ' ')}
Result: ${resultSummary}

Answer (1-2 sentences, casual Roman Urdu/English mix):`

  const response = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  150,
    temperature: 0.7,
  })

  const answer = response.choices?.[0]?.message?.content?.trim()
  if (!answer) {
    // Fallback — construct a plain answer without LLM
    if (result.count === 0) return 'Is period mein koi matching expense nahi mili.'
    if (intent.aggregation === 'sum')   return `${intent.category || 'Total'} pe ${pkr(result.value)} kharch hua — ${result.count} transactions.`
    if (intent.aggregation === 'count') return `${result.count} transactions mile ${intent.category || ''} mein.`
    if (intent.aggregation === 'max')   return `Sabse bara expense ${pkr(result.value)} tha.`
    if (intent.aggregation === 'avg')   return `Average expense ${pkr(result.value)} tha.`
    return `${result.count} results mile.`
  }

  return answer
}
