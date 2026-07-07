/**
 * whatsappChannel.js
 * Sends budget alert WhatsApp messages via Meta Cloud API.
 *
 * ⚠️  FEATURE FLAG: WHATSAPP_ENABLED=false
 *
 * This channel is fully implemented but kept disabled until the
 * Meta message template "budget_alert" is approved.
 *
 * To enable:
 *   1. Get Meta template approved at developers.facebook.com
 *   2. Set in .env.backend:
 *        WHATSAPP_ENABLED=true
 *        META_WHATSAPP_TOKEN=<your_token>
 *        META_PHONE_NUMBER_ID=<your_phone_number_id>
 *        META_TEMPLATE_NAME=budget_alert
 *
 * Template variable mapping:
 *   {{1}} = workspaceName
 *   {{2}} = categoryName
 *   {{3}} = percent (e.g. "82")
 *   {{4}} = budget limit in PKR (e.g. "Rs 10,000")
 */

const META_API_VERSION = 'v19.0'
const META_API_BASE    = 'https://graph.facebook.com'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

/**
 * Send a WhatsApp template message.
 *
 * @param {Array<{whatsappNumber: string}>} recipients
 * @param {object} payload
 * @returns {Promise<{status: 'sent'|'skipped'|'failed', error?: string}>}
 */
export async function send(recipients, payload) {
  // ── Feature flag check ────────────────────────────────────
  const enabled = process.env.WHATSAPP_ENABLED === 'true'
  if (!enabled) {
    // Silently skip — flag is off, no log spam
    return { status: 'skipped' }
  }

  const token          = process.env.META_WHATSAPP_TOKEN
  const phoneNumberId  = process.env.META_PHONE_NUMBER_ID
  const templateName   = process.env.META_TEMPLATE_NAME || 'budget_alert'

  if (!token || !phoneNumberId) {
    console.warn('[whatsappChannel] META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID not set')
    return { status: 'skipped' }
  }

  const validRecipients = (recipients || []).filter(r => r.whatsappNumber)
  if (validRecipients.length === 0) {
    return { status: 'skipped' }
  }

  const { workspaceName, categoryName, percent, budget } = payload

  // Template parameter values
  const components = [{
    type: 'body',
    parameters: [
      { type: 'text', text: workspaceName },
      { type: 'text', text: categoryName },
      { type: 'text', text: String(percent) },
      { type: 'text', text: pkr(budget) },
    ]
  }]

  const url = `${META_API_BASE}/${META_API_VERSION}/${phoneNumberId}/messages`

  const results = await Promise.allSettled(
    validRecipients.map(async (r) => {
      const body = {
        messaging_product: 'whatsapp',
        to:                r.whatsappNumber.replace(/^\+/, ''), // Meta wants no leading +
        type:              'template',
        template: {
          name:       templateName,
          language:   { code: 'en' },
          components,
        },
      }

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`Meta API ${res.status}: ${errBody?.error?.message || 'unknown'}`)
      }

      const data = await res.json()
      console.log(`[whatsappChannel] sent to ${r.whatsappNumber}:`, data?.messages?.[0]?.id)
    })
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    failed.forEach(f => console.error('[whatsappChannel] send failed:', f.reason))
    return { status: 'failed', error: failed[0].reason?.message }
  }

  return { status: 'sent' }
}
