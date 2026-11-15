// Read-only admin dashboard data for stoacap.com/admin. Returns the request
// and reader picture from Neon: who asked for access, to which piece, and
// where each request stands. It can only read - approvals, revocations and
// expiries stay in admin.js - and it never returns tokens, article content
// or secrets. Same auth model as admin.js: the STOA_ADMIN_SECRET bearer,
// compared constant-time, with failed-auth throttling and audit.

import { createHash, timingSafeEqual } from 'node:crypto'
import { getSql, ensureSchema } from './_stoa-db.js'

const FAIL_WINDOW_MIN = 10
const MAX_FAILS = 10
const LOCK_MIN = 15

const hash = (s) => createHash('sha256').update(s).digest('hex')

function secretOk(req) {
  const secret = process.env.STOA_ADMIN_SECRET
  if (!secret) return false
  const header = req.headers.authorization || ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!presented) return false
  return timingSafeEqual(Buffer.from(hash(presented)), Buffer.from(hash(secret)))
}

const clientIp = (req) =>
  ((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim().slice(0, 64)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getSql()
  if (!sql) {
    return res.status(503).json({ error: 'Not configured' })
  }
  const ip = clientIp(req)

  try {
    await ensureSchema(sql)

    const lock = await sql`select locked_until from stoa_admin_throttle where ip = ${ip} limit 1`
    if (lock[0] && lock[0].locked_until && new Date(lock[0].locked_until) > new Date()) {
      return res.status(429).json({ error: 'Too many failed attempts' })
    }

    if (!secretOk(req)) {
      const prev = await sql`select fails, first_fail_at from stoa_admin_throttle where ip = ${ip} limit 1`
      const r = prev[0]
      const stale =
        !r || !r.first_fail_at || new Date(r.first_fail_at) < new Date(Date.now() - FAIL_WINDOW_MIN * 60000)
      const fails = stale ? 1 : r.fails + 1
      const lockedUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null
      await sql`
        insert into stoa_admin_throttle (ip, fails, first_fail_at, locked_until)
        values (${ip}, ${fails}, now(), ${lockedUntil})
        on conflict (ip) do update set fails = ${fails}, first_fail_at = now(), locked_until = ${lockedUntil}
      `
      await sql`insert into stoa_admin_audit (ip, action, target, ok) values (${ip}, 'dashboard', null, false)`.catch(() => {})
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const requests = await sql`
      select email, role, piece, status, created_at, approved_at, expires_at, revoked_at
      from stoa_requests
      order by created_at desc
      limit 500
    `
    const byStatus = await sql`
      select status, count(*)::int as count from stoa_requests group by status
    `
    const byPiece = await sql`
      select piece, count(*)::int as count from stoa_requests group by piece order by count desc
    `
    const totals = {
      requests: requests.length,
      readers: new Set(requests.map((r) => (r.email || '').toLowerCase()).filter(Boolean)).size,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      byPiece: byPiece.map((r) => ({ piece: r.piece || 'Any piece', count: r.count })),
    }

    await sql`insert into stoa_admin_audit (ip, action, target, ok) values (${ip}, 'dashboard', null, true)`.catch(() => {})
    return res.status(200).json({ totals, requests })
  } catch (err) {
    console.error('[stoa] dashboard failed:', err)
    return res.status(502).json({ error: 'Temporarily unavailable' })
  }
}
