/**
 * summaryEmailer.js
 * Sends the monthly AI spending summary email via Resend.
 * Reuses the lazy Resend client pattern from emailChannel.js.
 * Never throws — all failures are returned as { status: 'failed' }.
 */

import { Resend } from 'resend'

let _resend = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

/**
 * @param {string} ownerEmail
 * @param {string} workspaceName
 * @param {string} month           — "YYYY-MM"
 * @param {string} summaryText     — AI paragraph
 * @param {{
 *   totalSpend:    number,
 *   topCategories: Array<{name: string, amount: number}>,
 *   momChange:     number | null,
 * }} metrics
 * @returns {Promise<{ status: 'sent'|'failed'|'skipped', error?: string }>}
 */
export async function sendSummaryEmail(ownerEmail, workspaceName, month, summaryText, metrics) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[summaryEmailer] RESEND_API_KEY not set — skipping')
    return { status: 'skipped' }
  }
  if (!ownerEmail) {
    console.warn('[summaryEmailer] no owner email — skipping')
    return { status: 'skipped' }
  }

  const monthLabel = new Date(`${month}-15`).toLocaleString('en-PK', {
    month: 'long', year: 'numeric',
  })

  const appUrl  = process.env.APP_URL || 'http://localhost:5173'
  const from    = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const subject = `📊 Your ${monthLabel} spending summary — ${workspaceName}`

  const momLine = metrics.momChange !== null
    ? metrics.momChange > 0
      ? `<span style="color:#ef4444;">▲ ${metrics.momChange}% vs last month</span>`
      : `<span style="color:#22c55e;">▼ ${Math.abs(metrics.momChange)}% vs last month</span>`
    : '<span style="color:#6b7280;">First month on record</span>'

  const catRows = (metrics.topCategories || []).map(c => `
    <tr>
      <td style="padding:6px 12px;font-size:13px;color:#374151;">${c.name}</td>
      <td style="padding:6px 12px;font-size:13px;color:#111827;font-weight:600;text-align:right;">
        ${pkr(c.amount)}
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Monthly Summary — Kharcha Tracker</title>
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
            <td style="background:linear-gradient(135deg,#4169E1,#6366f1);
                        padding:32px 40px;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">📊</div>
              <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">
                Kharcha Tracker
              </div>
              <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">
                Monthly Spending Summary
              </div>
            </td>
          </tr>

          <!-- Month badge -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="display:inline-block;background:#eef2ff;color:#4169E1;
                          border:1px solid #c7d2fe;border-radius:99px;
                          padding:6px 18px;font-size:13px;font-weight:700;">
                ${monthLabel}
              </div>
            </td>
          </tr>

          <!-- Summary paragraph -->
          <tr>
            <td style="padding:20px 40px 0;">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.75;
                         background:#f8faff;border-left:4px solid #4169E1;
                         padding:16px 20px;border-radius:0 12px 12px 0;">
                ${summaryText}
              </p>
            </td>
          </tr>

          <!-- Metrics row -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f5f7ff;border-radius:16px;overflow:hidden;">
                <tr style="background:#4169E1;">
                  <td style="padding:10px 12px;font-size:12px;color:#fff;font-weight:700;
                              text-transform:uppercase;letter-spacing:.05em;">Category</td>
                  <td style="padding:10px 12px;font-size:12px;color:#fff;font-weight:700;
                              text-transform:uppercase;letter-spacing:.05em;text-align:right;">Amount</td>
                </tr>
                ${catRows}
                <tr style="border-top:2px solid #e5e7eb;">
                  <td style="padding:10px 12px;font-size:14px;color:#111827;font-weight:700;">
                    Total Spend
                  </td>
                  <td style="padding:10px 12px;font-size:14px;color:#4169E1;
                              font-weight:800;text-align:right;">
                    ${pkr(metrics.totalSpend)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 12px;font-size:12px;color:#6b7280;">
                    Month-over-month
                  </td>
                  <td style="padding:6px 12px 12px;font-size:12px;text-align:right;">
                    ${momLine}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 40px;">
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
                Kharcha Tracker &middot; Powered by Supabase &amp; Groq &amp; Resend
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({ from, to: [ownerEmail], subject, html })
    if (error) {
      console.error('[summaryEmailer] Resend error:', error)
      return { status: 'failed', error: error.message }
    }
    console.log(`[summaryEmailer] sent id=${data?.id} to ${ownerEmail}`)
    return { status: 'sent' }
  } catch (err) {
    console.error('[summaryEmailer] unexpected error:', err)
    return { status: 'failed', error: err.message }
  }
}
