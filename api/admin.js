// Approval administration for Stoa reading links. This is the ONLY way
// requests move from pending to approved: Mattia calls it over HTTPS with
// the admin secret; it can approve, revoke, expire or inspect a request.
// It cannot read or change article content, cannot send email, and only
// touches the allowlisted pieces in _stoa-pieces.js.
//
// Security properties:
// - Bearer secret compared constant-time via SHA-256 pre-hashing (length-
//   independent, no early-exit timing signal).
// - STOA_ADMIN_SECRET is a sensitive Vercel env var: write-only, never
//   readable via API, present only at runtime here. Never logged.
// - Failed auth is rate-limited per IP in the database (10 failures inside
//   10 minutes locks that IP for 15 minutes); all failures return the same
//   401, so nothing about the secret leaks.
// - Every call (success or failure) is written to a stoa_admin_audit table
//   with ip/action/target only - never secrets, tokens or content.
// - Reading-link tokens are 192-bit random, stored as SHA-256 hashes. The
//   raw token appears exactly once: in the approve response body.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getSql, ensureSchema } from './_stoa-db.js'
import { PIECES, DEFAULT_LINK_DAYS, MAX_LINK_DAYS } from './_stoa-pieces.js'

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

async function isLocked(sql, ip) {
  const rows = await sql`select locked_until from stoa_admin_throttle where ip = ${ip} limit 1`
  const r = rows[0]
  return r && r.locked_until && new Date(r.locked_until) > new Date()
}

async function recordFailure(sql, ip) {
  const rows = await sql`select fails, first_fail_at from stoa_admin_throttle where ip = ${ip} limit 1`
  const r = rows[0]
  const stale =
    !r || !r.first_fail_at || new Date(r.first_fail_at) < new Date(Date.now() - FAIL_WINDOW_MIN * 60000)
  const fails = stale ? 1 : r.fails + 1
  const lockedUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null
  await sql`
    insert into stoa_admin_throttle (ip, fails, first_fail_at, locked_until)
    values (${ip}, ${fails}, now(), ${lockedUntil})
    on conflict (ip) do update set fails = ${fails}, first_fail_at = now(), locked_until = ${lockedUntil}
  `
}

const audit = (sql, ip, action, target, ok) =>
  sql`insert into stoa_admin_audit (ip, action, target, ok) values (${ip}, ${action}, ${target}, ${ok})`.catch(
    () => {}
  )

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getSql()
  if (!sql) {
    return res.status(503).json({ error: 'Not configured' })
  }
  const ip = clientIp(req)

  try {
    await ensureSchema(sql)

    if (await isLocked(sql, ip)) {
      return res.status(429).json({ error: 'Too many failed attempts' })
    }
    if (!secretOk(req)) {
      await recordFailure(sql, ip)
      await audit(sql, ip, 'auth', null, false)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = req.body || {}
    const action = (body.action || '').toString()
    const pieceSlug = (body.piece || '').toString().slice(0, 100)
    const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200)
    const cfg = PIECES[pieceSlug]

    if (!['approve', 'revoke', 'expire', 'status'].includes(action) || !cfg || !/^\S+@\S+\.\S+$/.test(email)) {
      await audit(sql, ip, action || 'invalid', null, false)
      return res.status(400).json({ error: 'Unknown action, piece or email' })
    }

    const target = `${email} ${pieceSlug}`

    if (action === 'approve') {
      const days = Math.min(Math.max(parseInt(body.days, 10) || DEFAULT_LINK_DAYS, 1), MAX_LINK_DAYS)
      const token = randomBytes(24).toString('base64url')
      const rows = await sql`
        insert into stoa_requests (email, role, piece, status, token_hash, approved_at, expires_at, revoked_at)
        values (${email}, ${null}, ${cfg.title}, 'approved', ${hash(token)}, now(), now() + make_interval(days => ${days}), null)
        on conflict (token_hash) do nothing
        returning id
      `
      if (!rows[0]) {
        // vanishingly unlikely token collision - caller retries
        await audit(sql, ip, action, target, false)
        return res.status(500).json({ error: 'Please retry' })
      }
      await audit(sql, ip, action, target, true)
      return res.status(200).json({
        piece: pieceSlug,
        email,
        expiresInDays: days,
        url: `https://www.stoacap.com/research/${pieceSlug}?t=${token}`,
      })
    }

    if (action === 'status') {
      const rows = await sql`
        select status, approved_at, expires_at, revoked_at, created_at
        from stoa_requests
        where email = ${email} and piece = ${cfg.title}
        order by created_at desc
        limit 5
      `
      await audit(sql, ip, action, target, true)
      return res.status(200).json({ requests: rows })
    }

    // revoke / expire: affect only currently-approved rows for this email+piece
    const changed =
      action === 'revoke'
        ? await sql`
            update stoa_requests
            set status = 'revoked', revoked_at = now()
            where email = ${email} and piece = ${cfg.title} and status = 'approved'
            returning id
          `
        : await sql`
            update stoa_requests
            set expires_at = now()
            where email = ${email} and piece = ${cfg.title} and status = 'approved'
            returning id
          `
    await audit(sql, ip, action, target, true)
    return res.status(200).json({ action, email, piece: pieceSlug, changed: changed.length })
  } catch (err) {
    console.error('[stoa] admin failed:', err)
    return res.status(502).json({ error: 'Temporarily unavailable' })
  }
}
