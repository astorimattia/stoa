import {canonicalRequestAllowed} from './_canonical-request.js'
// The single entry box for Stoa reading requests (account-wide model):
//
// POST {email, note?, piece?, source?}: if the email is not an active
// reader, a pending access request is recorded (one pending row per
// email+piece) in isolated test tables. The optional note (<= 280 chars)
// is the reader's personal line, shown only on the admin dashboard; piece
// and source are demand signals - access is account-wide, never per piece.
// Active readers use the Sign in flow (email link / code, Google or
// passkey), which proves email possession fresh on every sign-in. The
// response is always the same neutral confirmation, so the box never
// reveals who is approved or who has asked.
//
// The legacy one-time bearer-link mint/rotate flow is removed: access now
// lives on accounts, and revoking a reader row blocks reading immediately,
// independent of any session.
//
// STOA_RECOVERY_ALLOW (comma-separated emails), when set, restricts the
// endpoint to those emails - used on preview deployments so a preview never
// emails or writes a real request. Unset in production.
//
// STOA_RECOVERY_TEST (shared secret, preview only): a request carrying
// test:<secret> runs against isolated test tables
// (stoa_test_readers / requests / grants / exclusions / audit) and captures
// alerts into stoa_test_mail instead of calling Resend, so the positive
// path is testable end-to-end without touching live readers or real mail.
// Test requests ignore the allowlist. Test-only actions: seed, mail, reader, requests, reset.

import isolationProof from './_isolation-proof.js'
import { deliverTemplate } from './_mail-delivery.js'
import { createHash } from 'node:crypto'
import { getSql, ensureSchema, T } from './_stoa-db.js'
import { PIECES } from './_stoa-pieces.js'
import { takeLimit } from './_stoa-limits.js'
import { requestReceived } from './_stoa-emails.js'

// A request's piece text may arrive as a slug or a title; resolve to the
// registered slug so entitlement checks and dedup speak one language.
function resolvePieceSlug(piece) {
  if (!piece) return null
  const p = piece.toString().trim().toLowerCase()
  for (const [slug, cfg] of Object.entries(PIECES)) {
    if (slug === p || (cfg.title || '').toLowerCase() === p) return slug
  }
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const hash = (s) => createHash('sha256').update(s).digest('hex')
const clientIp = (req) =>
  ((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim().slice(0, 64)

export default async function handler(req, res) {
  if(!canonicalRequestAllowed(req))return res.status(403).json({error:'Use the canonical Stoa website'})
  if(req.query?.isolationProof==='1')return isolationProof(req,res)
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body = req.body || {}
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] recovery not configured: no database')
    return res.status(503).json({ error: 'Recovery is not configured yet' })
  }

  // Test mode: isolated tables + mail capture, gated by the shared secret.
  const testSecret = process.env.STOA_RECOVERY_TEST || ''
  const secretTest = !!(testSecret && body.test === testSecret)
  // Review-site intake may accept test identities without exposing the
  // maintenance secret to the browser. Every maintenance action still
  // requires that secret; there is no real-data route in this build.
  const reviewIntake = process.env.STOA_ACCOUNT_REVIEW === '1' && process.env.STOA_MAIL_CAPTURE === '1' &&
    !body.action && !body.rt && /@stoa-test\.invalid$/i.test(String(body.email || ''))
  const test = secretTest || reviewIntake
  const readers = test ? 'stoa_test_readers' : 'stoa_readers'
  const auditTable = test ? 'stoa_test_audit' : 'stoa_admin_audit'
  const audit = (ip, action, target, ok) =>
    sql`insert into ${T(sql, auditTable)} (ip, action, target, ok) values (${ip}, ${action}, ${target}, ${ok})`.catch(
      () => {}
    )
  const ip = clientIp(req)

  try {
    await ensureSchema(sql)
    if (test) await ensureTestSchema(sql)

    // ---- test-only maintenance actions ------------------------------------
    if (test && body.action === 'seed') {
      const seedEmail = (body.seedEmail || 'reader@stoa-test.invalid').toString().trim().toLowerCase().slice(0, 200)
      if (!seedEmail.endsWith('@stoa-test.invalid')) {
        return res.status(400).json({ error: 'Test readers must use @stoa-test.invalid' })
      }
      const opts = body.seedOpts || {}
      const accessMode = ['all', 'except', 'selected'].includes(opts.accessMode) ? opts.accessMode : 'all'
      const expires = opts.expired ? 'now() - interval \'1 hour\'' : 'now() + interval \'30 days\''
      const revoked = opts.revoked === true
      const seedHash = hash('seed-token:' + seedEmail)
      await sql`insert into ${T(sql, readers)} (email, status, access_mode, token_hash, approved_at, expires_at, revoked_at)
        values (${seedEmail}, 'approved', ${accessMode}, ${seedHash}, now(),
          ${sql.unsafe(expires)}, ${revoked ? new Date().toISOString() : null})
        on conflict (email) do update set status = 'approved', access_mode = ${accessMode},
          token_hash = ${seedHash}, expires_at = ${sql.unsafe(expires)},
          revoked_at = ${revoked ? new Date().toISOString() : null}, recovery_hash = null, recovery_expires_at = null`
      await sql`delete from ${T(sql, 'stoa_test_grants')} where email = ${seedEmail}`
      await sql`delete from ${T(sql, 'stoa_test_exclusions')} where email = ${seedEmail}`
      for (const p of Array.isArray(opts.grants) ? opts.grants.slice(0, 20) : []) {
        await sql`insert into ${T(sql, 'stoa_test_grants')} (email, piece) values (${seedEmail}, ${p.toString().slice(0, 100)}) on conflict do nothing`
      }
      for (const p of Array.isArray(opts.exclusions) ? opts.exclusions.slice(0, 20) : []) {
        await sql`insert into ${T(sql, 'stoa_test_exclusions')} (email, piece) values (${seedEmail}, ${p.toString().slice(0, 100)}) on conflict do nothing`
      }
      return res.status(200).json({ seeded: seedEmail })
    }
    if (test && body.action === 'mail') {
      const rows = await sql`select at, to_addr, subject, body from ${T(sql, 'stoa_test_mail')} order by id`
      return res.status(200).json({ mail: rows })
    }
    if (test && body.action === 'reader') {
      const rows = await sql`select email, status, token_hash, recovery_hash, recovery_expires_at from ${T(sql, readers)}`
      return res.status(200).json({ readers: rows })
    }
    if (test && body.action === 'requests') {
      const rows = await sql`select email, role, piece, status, note, source from ${T(sql, 'stoa_test_requests')}`
      return res.status(200).json({ requests: rows })
    }
    if (test && body.action === 'reset') {
      await sql`delete from ${T(sql, 'stoa_test_readers')}`
      await sql`delete from ${T(sql, 'stoa_test_audit')}`
      await sql`delete from ${T(sql, 'stoa_test_mail')}`
      await sql`delete from ${T(sql, 'stoa_test_grants')}`
      await sql`delete from ${T(sql, 'stoa_test_exclusions')}`
      await sql`delete from ${T(sql, 'stoa_test_requests')}`
      return res.status(200).json({ reset: true })
    }

    // Legacy bearer-recovery is removed; sign-in proves email possession.
    if (body.rt) return res.status(410).json({ error: 'Please sign in with your email' })

    // ---- step 1: one entry box for everyone -------------------------------
    // Request intake is separate from sign-in. Every valid submission
    // gets the same response, regardless of approval or request history.
    const email = (body.email || '').toString().trim().slice(0, 200).toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }
    const role = (body.role || '').toString().slice(0, 50)
    const piece = body.piece ? body.piece.toString().slice(0, 300) : null
    // The personal line (<= 280 chars) and the surface the request came
    // from. Both are demand context for the dashboard, never scope.
    const note = (body.note || '').toString().trim().slice(0, 280) || null
    const SOURCES = ['home', 'issue-page', 'locked-piece', 'sign-in']
    const source = SOURCES.includes(body.source) ? body.source : null

    // Same response whether or not anything happens below.
    const done = () => res.status(200).json({ ok: true })

    if (!test && (process.env.STOA_ACCOUNT_REVIEW === '1' || process.env.STOA_ACCOUNT_LIVE !== '1')) return done()

    if (test && !email.endsWith('@stoa-test.invalid')) return done()

    if (!(await takeLimit(sql, 'request-ip', ip, 5, 60)) || !(await takeLimit(sql, 'request-email', email, 3, 60))) return done()

    const rows = await sql`
      select email, status, access_mode, expires_at, revoked_at, recovery_hash, recovery_expires_at
      from ${T(sql, readers)} where email = ${email} limit 1
    `
    const r = rows[0]
    const active =
      r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())
    if (!active) {
      // Not an active reader: make sure a pending request exists, alert
      // Mattia on a genuinely new one, and show the same confirmation.
      // A declined request never blocks a new one (MP: a repeat request
      // from a declined email is allowed); only a live pending row dedups.
      const requests = test ? 'stoa_test_requests' : 'stoa_requests'
      const pending = await upsertPendingRequest(sql, requests, {email, role, piece, note, source})
      if (pending.created) {
        // Acknowledgement to the requester. Test-captured on staging; the
        // real send stays off until the sender domain is verified and the
        // send itself is approved.
        if (test || process.env.STOA_TRANSACTIONAL_SEND==='1') {
          const tpl = requestReceived(email, piece && (PIECES[resolvePieceSlug(piece)] || {}).title)
          try{await sendMail(sql, test, email, tpl.subject, tpl.text)}catch{await audit(ip,'request-ack-not-accepted',email,false)}
        }
      }
      return done()
    }

    // An active reader already reads the whole locked library
    // (account-wide), so there is nothing to record - the neutral
    // confirmation below is unchanged.
    await audit(ip, 'recover-request', email, true)
    return done()
  } catch (err) {
    console.error('[stoa] recovery failed:', err)
    return res.status(502).json({ error: 'Recovery is temporarily unavailable' })
  }
}

// A transaction-scoped advisory lock serializes the exact pending key.
// Lock and mutation use separate statements so the second statement gets a
// fresh READ COMMITTED snapshot after a competing request commits. This
// avoids adding a unique index over existing historical production rows.
export async function upsertPendingRequest(sql, table, {email, role, piece, note, source}) {
  if (!['stoa_requests','stoa_test_requests'].includes(table)) throw Error('Invalid request table')
  const key = JSON.stringify([table,email,piece])
  const [,rows] = await sql.transaction([
    sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`,
    sql`with existing as (
      select id from ${T(sql,table)} where email=${email} and status='pending'
        and piece is not distinct from ${piece} order by created_at,id limit 1
    ), updated as (
      update ${T(sql,table)} set role=coalesce(${role||null},role),note=coalesce(${note},note),source=coalesce(${source},source)
      where id in (select id from existing) returning id
    ), inserted as (
      insert into ${T(sql,table)}(email,role,piece,note,source)
      select ${email},${role||null},${piece},${note},${source} where not exists(select 1 from existing)
      returning id
    ) select id,true as created from inserted union all select id,false as created from updated`
  ])
  return rows[0]
}

async function sendMail(sql, test, to, subject, text) {
  if (test) {
    await sql`insert into ${T(sql, 'stoa_test_mail')} (to_addr, subject, body) values (${to}, ${subject}, ${text})`
    return true
  }
  return (await deliverTemplate({sql,to,template:{subject,text,html:requestReceived().html},workflow:'request-received'})).accepted
}

export async function ensureTestSchema(sql) {
  await sql`create table if not exists ${T(sql, 'stoa_test_readers')} (
    email text primary key,
    status text not null default 'approved',
    access_mode text not null default 'all',
    token_hash text,
    approved_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    recovery_hash text,
    recovery_expires_at timestamptz,
    created_at timestamptz not null default now()
  )`
  // In case an earlier shape of the test table exists.
  await sql`alter table ${T(sql, 'stoa_test_readers')} add column if not exists access_mode text not null default 'all'`
  await sql`alter table ${T(sql, 'stoa_test_readers')} add column if not exists role text`
  await sql`create table if not exists ${T(sql, 'stoa_test_grants')} (
    email text not null,
    piece text not null,
    created_at timestamptz not null default now(),
    primary key (email, piece)
  )`
  await sql`create table if not exists ${T(sql, 'stoa_test_exclusions')} (
    email text not null,
    piece text not null,
    created_at timestamptz not null default now(),
    primary key (email, piece)
  )`
  await sql`create table if not exists ${T(sql, 'stoa_test_audit')} (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    ip text,
    action text not null,
    target text,
    ok boolean not null
  )`
  await sql`create table if not exists ${T(sql, 'stoa_test_mail')} (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    to_addr text not null,
    subject text not null,
    body text not null
  )`
  await sql`create table if not exists ${T(sql, 'stoa_test_requests')} (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    role text,
    piece text,
    status text not null default 'pending',
    created_at timestamptz not null default now()
  )`
  // Mirror the live request columns the admin paths read.
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists approved_at timestamptz`
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists expires_at timestamptz`
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists revoked_at timestamptz`
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists note text`
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists source text`
  await sql`alter table ${T(sql, 'stoa_test_requests')} add column if not exists team_note text`
  await sql`create table if not exists ${T(sql, 'stoa_test_reading_events')} (
    id bigint generated always as identity primary key, email text not null, piece text not null,
    opened_at timestamptz not null default now()
  )`
}
