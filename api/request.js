import Redis from 'ioredis';

let redis;

function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 8000,
    commandTimeout: 4000,
    retryStrategy(times) {
      if (times > 2) return null;
      return Math.min(times * 50, 1500);
    },
  });
  return redis;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const email = (body.email || '').toString().trim().slice(0, 200);
  const role = (body.role || '').toString().slice(0, 50);
  const piece = body.piece ? body.piece.toString().slice(0, 300) : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const client = getRedis();
  if (!client) {
    console.error('[stoa] REDIS_URL not configured; refusing to confirm request');
    return res.status(503).json({ error: 'Request capture is not configured yet' });
  }

  const now = new Date();
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const record = JSON.stringify({
    id,
    email,
    role,
    piece,
    ts: now.toISOString(),
    country: req.headers['x-vercel-ip-country'] || null,
    ua: (req.headers['user-agent'] || '').slice(0, 300),
  });

  try {
    await client
      .pipeline()
      .lpush('stoa:access_requests', record)
      .set(`stoa:access_request:${id}`, record, 'EX', 90 * 24 * 60 * 60)
      .exec();
  } catch (err) {
    console.error('[stoa] redis write failed:', err);
    return res.status(502).json({ error: 'Could not store the request' });
  }

  // Best-effort email alert; the stored record above is the source of truth.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Stoa Requests <alerts@astori.vc>',
          to: [process.env.NOTIFICATION_EMAIL || 'mattiastori@gmail.com'],
          subject: `Stoa access request: ${email}`,
          text: [
            'New access request on stoacap.com',
            '',
            `Email: ${email}`,
            `Role: ${role || '-'}`,
            `Piece: ${piece || '(general access)'}`,
            `Time: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
            '',
            'Stored in Redis list stoa:access_requests.',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[stoa] alert email failed:', err);
    }
  }

  return res.status(200).json({ ok: true });
}
