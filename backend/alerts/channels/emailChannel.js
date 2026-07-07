/**
 * emailChannel.js
 * Sends budget alert emails via Resend API.
 * Resend client is lazily initialised so dotenv is guaranteed to have loaded.
 */

import { Resend } from 'resend'

let _resend = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const THRESHOLD_LABELS = {
  80:  { emoji: '⚠️',  label: 'Warning',  color: '#f59e0b', bg: '#fffbeb' },
  90:  { emoji: '🔴',  label: 'Critical', color: '#ef4444', bg: '#fef2f2' },
  100: { emoji: '🚨',  label: 'Exceeded', color: '#dc2626', bg: '#fef2f2' },
}

function row(label, value) {
  return `
    <table width="100%" style="margin-bottom:12px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:#6b7280;font-weight:600;
                   text-transform:uppercase;letter-spacing:.05em;
                   width:40%;vertical-align:top;">${label}</td>
        <td style="font-size:14px;color:#111827;font-weight:500;">${value}</td>
      </tr>
    </table>`
}

function buildHtml(payload) {
  const {
    workspaceName, categoryName, spent, budget,
    percent, threshold, month,
  } = payload

  const tl        = THRESHOLD_LABELS[threshold] || THRESHOLD_LABELS[80]
  const appUrl    = process.env.APP_URL || 'http://localhost:5173'
  const monthLabel = new Date(`${month}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })
  const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Budget Alert — Kharcha Tracker</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FF;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FF;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:24px;overflow:hidden;
                      box-shadow:0 4px 32px rgba(65,105,225,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#4169E1;padding:32px 40px;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">&#x1F4B8;</div>
              <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">
                Kharcha Tracker
              </div>
              <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">
                Budget Alert Notification
              </div>
            </td>
          </tr>

          <!-- Alert badge -->
          <tr>
            <td style="padding:32px 40px 0;">
              <div style="display:inline-block;background:${tl.bg};color:${tl.color};
                          border:1px solid ${tl.color}33;border-radius:99px;
                          padding:6px 16px;font-size:13px;font-weight:700;">
                ${tl.emoji} ${tl.label} &mdash; ${threshold}% Reached
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Hi there,<br/><br/>
                A budget threshold has been reached in your workspace.
                Here are the details:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#F5F7FF;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    ${row('Workspace',    workspaceName)}
                    ${row('Category',     categoryName)}
                    ${row('Month',        monthLabel)}
                    ${row('Threshold',    `${threshold}% ${tl.label}`)}
                    ${row('Budget Limit', pkr(budget))}
                    ${row('Spent So Far', `<strong style="color:${tl.color};">${pkr(spent)}</strong> (${percent}%)`)}
                  </td>
                </tr>
              </table>

              <!-- Progress bar -->
              <div style="margin:24px 0 0;">
                <div style="display:flex;justify-content:space-between;
                            font-size:12px;color:#6b7280;margin-bottom:6px;">
                  <span>0</span>
                  <span>${pkr(budget)}</span>
                </div>
                <div style="background:#e5e7eb;border-radius:99px;height:10px;overflow:hidden;">
                  <div style="background:${tl.color};height:100%;
                              width:${Math.min(percent, 100)}%;
                              border-radius:99px;"></div>
                </div>
                <div style="text-align:right;font-size:12px;color:${tl.color};
                            font-weight:700;margin-top:4px;">${percent}% used</div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px;">
              <a href="${appUrl}"
                 style="display:inline-block;background:#4169E1;color:#ffffff;
                        text-decoration:none;font-weight:700;font-size:14px;
                        padding:12px 28px;border-radius:12px;">
                View Dashboard &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                You are receiving this because you are an <strong>Owner</strong>
                of the <em>${workspaceName}</em> workspace.<br/>
                Kharcha Tracker &middot; Powered by Supabase &amp; Resend
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildSubject(payload) {
  const { categoryName, threshold, workspaceName, month } = payload
  const tl = THRESHOLD_LABELS[threshold] || THRESHOLD_LABELS[80]
  const monthLabel = new Date(`${month}-15`).toLocaleString('en-PK', {
    month: 'short', year: 'numeric',
  })
  return `${tl.emoji} Budget Alert: ${categoryName} reached ${threshold}% — ${workspaceName} (${monthLabel})`
}

/**
 * Send budget alert email to all recipients.
 *
 * @param {Array<{email: string}>} recipients
 * @param {object} payload  { workspaceName, categoryName, spent, budget, percent, threshold, month }
 * @returns {Promise<{status: 'sent'|'skipped'|'failed', error?: string}>}
 */
export async function send(recipients, payload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[emailChannel] RESEND_API_KEY not set — skipping')
    return { status: 'skipped' }
  }

  if (!recipients || recipients.length === 0) {
    console.warn('[emailChannel] no recipients — skipping')
    return { status: 'skipped' }
  }

  try {
    const resend = getResend()
    const to     = recipients.map((r) => r.email)
    const from   = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: buildSubject(payload),
      html:    buildHtml(payload),
    })

    if (error) {
      console.error('[emailChannel] Resend error:', error)
      return { status: 'failed', error: error.message }
    }

    console.log(`[emailChannel] sent id=${data?.id} to ${to.join(', ')}`)
    return { status: 'sent' }
  } catch (err) {
    console.error('[emailChannel] unexpected error:', err)
    return { status: 'failed', error: err.message }
  }
}
