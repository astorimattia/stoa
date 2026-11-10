// Access-request capture: the request is stored in Neon, then an alert email
// goes to Mattia. A request is confirmed to the visitor only after the row is
// stored AND the email provider accepts the alert; otherwise the visitor gets
// an honest error. Every approval is Mattia's own later action - nothing here
// grants access.

import { getSql, ensureSchema } from './_stoa-db.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body = req.body || {}
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  const email = (body.email || '').toString().trim().slice(0, 200)
  const role = (body.role || '').toString().slice(0, 50)
  const piece = body.piece ? body.piece.toString().slice(0, 300) : null

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const sql = getSql()
  const resendKey = process.env.RESEND_API_KEY
  if (!sql || !resendKey) {
    console.error('[stoa] request capture not configured:', { db: !!sql, resend: !!resendKey })
    return res.status(503).json({ error: 'Request capture is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    await sql`insert into stoa_requests (email, role, piece) values (${email}, ${role || null}, ${piece})`
  } catch (err) {
    console.error('[stoa] failed to store request:', err)
    return res.status(502).json({ error: 'Could not save the request' })
  }

  const subject = `Stoa access request: ${email}`
  const text = [
    'New access request on stoacap.com',
    '',
    `Email: ${email}`,
    `Role: ${role || '-'}`,
    `Piece: ${piece || '(general access)'}`,
  ].join('\n')

  let accepted = false
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Stoa Requests <alerts@astori.vc>',
        to: [process.env.NOTIFICATION_EMAIL || 'mattia@astori.vc'],
        subject,
        text,
      }),
    })
    accepted = resp.ok
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error(`[stoa] resend rejected alert: ${resp.status} ${detail.slice(0, 300)}`)
    }
  } catch (err) {
    console.error('[stoa] alert email failed:', err)
  }

  if (!accepted) {
    return res.status(502).json({ error: 'Could not send the request' })
  }

  return res.status(200).json({ ok: true })
}
