// Reader administration for Stoa. This is the ONLY way anyone gains access:
// Mattia calls it over HTTPS with the admin secret. Readers, not requests,
// are approved: one reading link per reader opens the research library.
// What that library contains for a reader is their access scope (all /
// except / selected) plus each piece's mode (open / readers / selected).
//
// Actions (POST JSON):
//   approve {email, days?, rotate?, accessMode?, grants?, exclusions?}
//            create or refresh a reader. A new reader gets a new link
//            (returned once). An existing active reader keeps their link
//            (expiry only ever extended) unless rotate:true. A revoked or
//            expired reader gets a fresh link. Marks all of the reader's
//            pending requests approved.
//   access {email, accessMode, grants?, exclusions?}
//            change only what a reader can read; never touches their link,
//            expiry or status.
//   setpiece {slug, mode}   change a piece's mode: open / readers / selected.
//   revoke {email} / expire {email}   kill all of the reader's access
//            (legacy per-piece links for that email too).
//   status {email}   reader and requests (never tokens).
//   purge {email}    delete reader, their grants/exclusions and requests
//            (tests/cleanup).
//
// It cannot read or change article content and cannot send email.
//
// Security properties:
// - Bearer secret compared constant-time via SHA-256 pre-hashing (length-
//   independent, no early-exit timing signal). In demo mode the demo
//   password also passes; it guards made-up data only.
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
import { getSql, ensureSchema, T } from './_stoa-db.js'
import { PIECES, PIECE_MODES, DEFAULT_LINK_DAYS, MAX_LINK_DAYS } from './_stoa-pieces.js'

const FAIL_WINDOW_MIN = 10
const MAX_FAILS = 10
const LOCK_MIN = 15

const hash = (s) => createHash('sha256').update(s).digest('hex')

function secretOk(req) {
  const header = req.headers.authorization || ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!presented) return false
  const secret = process.env.STOA_ADMIN_SECRET
  if (secret && timingSafeEqual(Buffer.from(hash(presented)), Buffer.from(hash(secret)))) return true
  return false
}

const clientIp = (req) =>
  ((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim().slice(0, 64)

async function isLocked(sql, ip) {
  const rows = await sql`select locked_until from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
  const r = rows[0]
  return r && r.locked_until && new Date(r.locked_until) > new Date()
}

async function recordFailure(sql, ip) {
  const rows = await sql`select fails, first_fail_at from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
  const r = rows[0]
  const stale =
    !r || !r.first_fail_at || new Date(r.first_fail_at) < new Date(Date.now() - FAIL_WINDOW_MIN * 60000)
  const fails = stale ? 1 : r.fails + 1
  const lockedUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null
  await sql`
    insert into ${T(sql, 'stoa_admin_throttle')} (ip, fails, first_fail_at, locked_until)
    values (${ip}, ${fails}, now(), ${lockedUntil})
    on conflict (ip) do update set fails = ${fails}, first_fail_at = now(), locked_until = ${lockedUntil}
  `
}

const audit = (sql, ip, action, target, ok) =>
  sql`insert into ${T(sql, 'stoa_admin_audit')} (ip, action, target, ok) values (${ip}, ${action}, ${target}, ${ok})`.catch(
    () => {}
  )

const ACTIONS = ['approve', 'access', 'setpiece', 'revoke', 'expire', 'status', 'purge']
const ACCESS_MODES = ['all', 'except']
const siteBase = () => 'https://www.stoacap.com'

const isActive = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

// Validate a piece slug list against the registry; unknown slugs dropped.
const cleanSlugs = (list) =>
  (Array.isArray(list) ? list : []).map((s) => String(s)).filter((s) => PIECES[s]).slice(0, 50)

async function setScope(sql, email, accessMode, grants, exclusions) {
  await sql`update ${T(sql, 'stoa_readers')} set access_mode = ${accessMode} where email = ${email}`
  await sql`delete from ${T(sql, 'stoa_grants')} where email = ${email}`
  await sql`delete from ${T(sql, 'stoa_exclusions')} where email = ${email}`
  if (accessMode === 'selected') {
    for (const slug of grants) {
      await sql`insert into ${T(sql, 'stoa_grants')} (email, piece) values (${email}, ${slug}) on conflict do nothing`
    }
  }
  if (accessMode === 'except') {
    for (const slug of exclusions) {
      await sql`insert into ${T(sql, 'stoa_exclusions')} (email, piece) values (${email}, ${slug}) on conflict do nothing`
    }
  }
  // Grants into 'selected'-mode pieces are meaningful whatever the reader's
  // library scope, so a grant list is stored in any mode when supplied.
  if (accessMode !== 'selected' && grants.length) {
    for (const slug of grants) {
      await sql`insert into ${T(sql, 'stoa_grants')} (email, piece) values (${email}, ${slug}) on conflict do nothing`
    }
  }
}

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

    let body = req.body || {}
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    const action = (body.action || '').toString()
    const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200)

    if (!ACTIONS.includes(action)) {
      await audit(sql, ip, action || 'invalid', null, false)
      return res.status(400).json({ error: 'Unknown action' })
    }

    if (action === 'setpiece') {
      const slug = (body.slug || '').toString()
      const mode = (body.mode || '').toString()
      if (!PIECES[slug] || !PIECE_MODES.includes(mode)) {
        await audit(sql, ip, action, slug || null, false)
        return res.status(400).json({ error: 'Unknown piece or mode' })
      }
      await sql`update ${T(sql, 'stoa_pieces')} set mode = ${mode} where slug = ${slug}`
      await audit(sql, ip, action, slug, true)
      return res.status(200).json({ slug, mode })
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      await audit(sql, ip, action, null, false)
      return res.status(400).json({ error: 'A valid email is required' })
    }

    const target = email
    const readerRows = await sql`
      select email, role, status, access_mode, expires_at, revoked_at from ${T(sql, 'stoa_readers')}
      where email = ${email} limit 1
    `
    const reader = readerRows[0] || null

    if (action === 'approve') {
      const days = Math.min(Math.max(parseInt(body.days, 10) || DEFAULT_LINK_DAYS, 1), MAX_LINK_DAYS)
      const rotate = body.rotate === true || !isActive(reader)
      let token = null

      // Role: keep the reader's, else take it from their latest request.
      const roleRows = await sql`
        select role from ${T(sql, 'stoa_requests')} where email = ${email} and role is not null order by created_at desc limit 1
      `
      const role = (reader && reader.role) || (roleRows[0] && roleRows[0].role) || null

      if (!reader) {
        token = randomBytes(24).toString('base64url')
        const ins = await sql`
          insert into ${T(sql, 'stoa_readers')} (email, role, status, token_hash, approved_at, expires_at)
          values (${email}, ${role}, 'approved', ${hash(token)}, now(), now() + make_interval(days => ${days}))
          on conflict do nothing
          returning email
        `
        if (!ins[0]) {
          // concurrent insert or vanishingly unlikely token collision
          await audit(sql, ip, action, target, false)
          return res.status(500).json({ error: 'Please retry' })
        }
      } else if (rotate) {
        token = randomBytes(24).toString('base64url')
        await sql`
          update ${T(sql, 'stoa_readers')}
          set status = 'approved', token_hash = ${hash(token)}, role = ${role}, approved_at = now(),
              expires_at = now() + make_interval(days => ${days}), revoked_at = null
          where email = ${email}
        `
      } else {
        // Active reader: keep their link; only ever extend the expiry.
        await sql`
          update ${T(sql, 'stoa_readers')}
          set expires_at = greatest(coalesce(expires_at, now()), now() + make_interval(days => ${days})),
              role = ${role}
          where email = ${email}
        `
      }

      // Access scope: only changed when the call says so - an approval on
      // its own never widens or narrows what an existing reader can read.
      if (body.accessMode && ACCESS_MODES.includes(body.accessMode)) {
        await setScope(sql, email, body.accessMode, cleanSlugs(body.grants), cleanSlugs(body.exclusions))
      }

      // Inbox: approving a reader answers all of their pending requests.
      const approvedRows = await sql`
        update ${T(sql, 'stoa_requests')} set status = 'approved'
        where lower(email) = ${email} and status = 'pending'
        returning id
      `

      // Every approved reader is a new-piece email subscriber. An explicit
      // unsubscribe already on file always wins over re-approval.
      await sql`create table if not exists ${T(sql, 'stoa_subscriptions')}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`
      await sql`insert into ${T(sql, 'stoa_subscriptions')}(email, unsubscribed_at) values (${email}, null) on conflict (email) do nothing`

      const fresh = await sql`select expires_at from ${T(sql, 'stoa_readers')} where email = ${email} limit 1`
      await audit(sql, ip, action, target, true)
      return res.status(200).json({
        email,
        expiresAt: fresh[0] ? fresh[0].expires_at : null,
        expiresInDays: days,
        rotated: !!token,
        approvedRequests: approvedRows.length,
        // The raw link leaves the server only here, and only when minted now.
        url: token ? `${siteBase()}/research?t=${token}` : null,
      })
    }

    if (action === 'access') {
      if (!reader) {
        await audit(sql, ip, action, target, false)
        return res.status(404).json({ error: 'No such reader' })
      }
      const accessMode = (body.accessMode || '').toString()
      if (!ACCESS_MODES.includes(accessMode)) {
        await audit(sql, ip, action, target, false)
        return res.status(400).json({ error: 'Unknown access mode' })
      }
      await setScope(sql, email, accessMode, cleanSlugs(body.grants), cleanSlugs(body.exclusions))
      await audit(sql, ip, action, target, true)
      return res.status(200).json({ email, accessMode })
    }

    if (action === 'status') {
      const requests = await sql`
        select role, piece, status, approved_at, expires_at, revoked_at, created_at
        from ${T(sql, 'stoa_requests')} where lower(email) = ${email} order by created_at desc limit 20
      `
      const grants = await sql`select piece from ${T(sql, 'stoa_grants')} where email = ${email}`
      const exclusions = await sql`select piece from ${T(sql, 'stoa_exclusions')} where email = ${email}`
      await audit(sql, ip, action, target, true)
      return res.status(200).json({
        reader,
        active: !!isActive(reader),
        grants: grants.map((r) => r.piece),
        exclusions: exclusions.map((r) => r.piece),
        requests,
      })
    }

    if (action === 'purge') {
      const r = await sql`delete from ${T(sql, 'stoa_readers')} where email = ${email} returning email`
      const q = await sql`delete from ${T(sql, 'stoa_requests')} where lower(email) = ${email} returning id`
      await sql`delete from ${T(sql, 'stoa_grants')} where email = ${email}`
      await sql`delete from ${T(sql, 'stoa_exclusions')} where email = ${email}`
      await audit(sql, ip, action, target, true)
      return res.status(200).json({ action, email, deleted: { readers: r.length, requests: q.length } })
    }

    // revoke / expire: the whole reader, plus any legacy per-piece links.
    const changed =
      action === 'revoke'
        ? await sql`
            update ${T(sql, 'stoa_readers')} set status = 'revoked', revoked_at = now()
            where email = ${email} and status = 'approved'
            returning email
          `
        : await sql`
            update ${T(sql, 'stoa_readers')} set expires_at = now()
            where email = ${email} and status = 'approved' and (expires_at is null or expires_at > now())
            returning email
          `
    const legacy =
      action === 'revoke'
        ? await sql`
            update ${T(sql, 'stoa_requests')} set status = 'revoked', revoked_at = now()
            where lower(email) = ${email} and status = 'approved'
            returning id
          `
        : await sql`
            update ${T(sql, 'stoa_requests')} set expires_at = now()
            where lower(email) = ${email} and status = 'approved' and (expires_at is null or expires_at > now())
            returning id
          `
    await audit(sql, ip, action, target, true)
    return res.status(200).json({ action, email, changed: changed.length + legacy.length })
  } catch (err) {
    console.error('[stoa] admin failed:', err && err.message ? err.message.slice(0, 200) : 'error')
    return res.status(502).json({ error: 'Temporarily unavailable' })
  }
}
