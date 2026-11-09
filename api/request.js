// Access-request capture backed by email only. A request is confirmed to the
// visitor only after the email provider accepts the alert for delivery; if
// the provider rejects or is unreachable, the visitor gets an honest error.
// There is no database: the alert email is the record.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = (body.email || '').toString().trim().slice(0, 200);
  const role = (body.role || '').toString().slice(0, 50);
  const piece = body.piece ? body.piece.toString().slice(0, 300) : null;

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('[stoa] RESEND_API_KEY not configured; refusing to confirm request');
    return res.status(503).json({ error: 'Request capture is not configured yet' });
  }

  const subject = `Stoa access request: ${email}`;
  const text = [
    'New access request on stoacap.com',
    '',
    `Email: ${email}`,
    `Role: ${role || '-'}`,
    `Piece: ${piece || '(general access)'}`,
  ].join('\n');

  let accepted = false;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Stoa Requests <alerts@astori.vc>',
        to: [process.env.NOTIFICATION_EMAIL || 'mattiastori@gmail.com'],
        subject,
        text,
      }),
    });
    accepted = resp.ok;
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error(`[stoa] resend rejected alert: ${resp.status} ${detail.slice(0, 300)}`);
    }
  } catch (err) {
    console.error('[stoa] alert email failed:', err);
  }

  if (!accepted) {
    return res.status(502).json({ error: 'Could not send the request' });
  }

  return res.status(200).json({ ok: true });
}
