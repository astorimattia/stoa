// Access-request capture: the request is stored in Neon first. Storing the
// row is what confirms a request - the visitor gets success only after the
// row exists. The alert email to Mattia is then attempted best-effort: a
// provider failure is logged for follow-up but never changes the visitor's
// confirmed request, and a retry after an alert failure never creates a
// duplicate row. Every approval is Mattia's own later action - nothing here
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

  const email = (body.email || '').toString().trim().slice(0, 200).toLowerCase()
  const role = (body.role || '').toString().slice(0, 50)
  const piece = body.piece ? body.piece.toString().slice(0, 300) : null

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] request capture not configured: no database')
    return res.status(503).json({ error: 'Request capture is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    // Idempotent: one row per email+piece, so a visitor retry never duplicates.
    const existing = await sql`select id from stoa_requests where email = ${email} and piece is not distinct from ${piece} limit 1`
    if (existing.length === 0) {
      await sql`insert into stoa_requests (email, role, piece) values (${email}, ${role || null}, ${piece})`
    } else if (role) {
      await sql`update stoa_requests set role = ${role} where id = ${existing[0].id}`
    }
  } catch (err) {
    console.error('[stoa] failed to store request:', err)
    return res.status(502).json({ error: 'Could not save the request' })
  }

  // The request is now durably stored. Alert Mattia best-effort; a failure
  // here is logged (Vercel function logs) and visible via admin status, but
  // it does not change the visitor's confirmed request.
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[stoa] RESEND_API_KEY not set; alert skipped for stored request from', email)
  } else {
    const subject = `Stoa access request: ${email}`
    const text = [
      'New access request on stoacap.com',
      '',
      `Email: ${email}`,
      `Role: ${role || '-'}`,
      `Piece: ${piece || '(general access)'}`,
    ].join('\n')
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
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '')
        console.error(`[stoa] resend rejected alert for stored request: ${resp.status} ${detail.slice(0, 300)}`)
      }
    } catch (err) {
      console.error('[stoa] alert email failed for stored request:', err)
    }
  }

  return res.status(200).json({ ok: true })
}
