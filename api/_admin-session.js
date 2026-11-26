// Server-backed admin sessions. The browser keeps only a random session
// token in an HttpOnly cookie; the database keeps its hash, expiry and
// revocation state. Signing out revokes the server record, so copied tokens
// stop working too. Idle use extends the session to 7 days, capped at 30
// days from the original sign-in. Changing the admin secret invalidates all
// existing sessions through the stored secret fingerprint.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { T } from './_stoa-db.js'

export const ADMIN_SESSION_IDLE_DAYS = 7
export const ADMIN_SESSION_ABSOLUTE_DAYS = 30
const COOKIE = 'stoa_admin_session'
const IDLE_MS = ADMIN_SESSION_IDLE_DAYS * 86400e3
const ABSOLUTE_MS = ADMIN_SESSION_ABSOLUTE_DAYS * 86400e3
const b64u = bytes => Buffer.from(bytes).toString('base64url')
const tokenHash = token => createHash('sha256').update('stoa admin session token\n' + token).digest()
const secretFingerprint = () => {
  const secret = process.env.STOA_ADMIN_SECRET || ''
  return secret ? createHash('sha256').update('stoa admin secret\n' + secret).digest('hex') : null
}

export function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => {
    const i = c.indexOf('=')
    return i < 0 ? [c, ''] : [decodeURIComponent(c.slice(0, i)), decodeURIComponent(c.slice(i + 1))]
  }))
}
export const hasAdminSessionCookie = req => !!parseCookies(req)[COOKIE]

export function sameOriginAdminRequest(req) {
  try {
    const expected = new URL(process.env.BETTER_AUTH_URL || '').origin
    return !!expected && req.headers.origin === expected
  } catch {
    return false
  }
}

export async function ensureAdminSessionSchema(sql) {
  await sql`create table if not exists ${T(sql, 'stoa_admin_sessions')} (
    id text primary key,
    token_hash text not null,
    secret_fingerprint text not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    idle_expires_at timestamptz not null,
    absolute_expires_at timestamptz not null,
    revoked_at timestamptz,
    ip text
  )`
}

function cookie(value, maxAgeSeconds) {
  return COOKIE + '=' + value + '; Path=/; Max-Age=' + maxAgeSeconds + '; HttpOnly; Secure; SameSite=Strict'
}

export async function createAdminSession(sql, ip, now = Date.now()) {
  const fingerprint = secretFingerprint()
  if (!fingerprint) return null
  await ensureAdminSessionSchema(sql)
  const id = b64u(randomBytes(18))
  const token = b64u(randomBytes(32))
  const idleExpires = new Date(now + IDLE_MS)
  const absoluteExpires = new Date(now + ABSOLUTE_MS)
  await sql`insert into ${T(sql, 'stoa_admin_sessions')} (id, token_hash, secret_fingerprint, last_seen_at, idle_expires_at, absolute_expires_at, ip)
    values (${id}, ${tokenHash(token).toString('hex')}, ${fingerprint}, ${new Date(now)}, ${idleExpires}, ${absoluteExpires}, ${ip || null})`
  return cookie(id + '.' + token, Math.floor(ABSOLUTE_MS / 1000))
}

// Validates, revokes-on-demand, and slides the idle window. A token whose
// browser copy survives past server-side idle expiry is inert.
export async function readAdminSession(sql, req, now = Date.now()) {
  const fingerprint = secretFingerprint()
  const raw = parseCookies(req)[COOKIE]
  if (!fingerprint || !raw) return false
  const i = raw.indexOf('.')
  if (i < 1) return false
  const id = raw.slice(0, i), token = raw.slice(i + 1)
  await ensureAdminSessionSchema(sql)
  const rows = await sql`select id, token_hash, secret_fingerprint, idle_expires_at, absolute_expires_at, revoked_at from ${T(sql, 'stoa_admin_sessions')} where id = ${id} limit 1`
  const row = rows[0]
  if (!row || row.revoked_at || row.secret_fingerprint !== fingerprint) return false
  const expected = Buffer.from(row.token_hash, 'hex')
  const actual = tokenHash(token)
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) return false
  const nowDate = new Date(now)
  const absolute = new Date(row.absolute_expires_at)
  if (!(new Date(row.idle_expires_at) > nowDate) || !(absolute > nowDate)) return false
  const nextIdle = new Date(Math.min(now + IDLE_MS, absolute.getTime()))
  await sql`update ${T(sql, 'stoa_admin_sessions')} set last_seen_at = ${nowDate}, idle_expires_at = ${nextIdle} where id = ${id} and revoked_at is null`
  return true
}

export async function revokeAdminSession(sql, req) {
  const raw = parseCookies(req)[COOKIE]
  if (!raw) return
  const id = raw.split('.')[0]
  await ensureAdminSessionSchema(sql)
  await sql`update ${T(sql, 'stoa_admin_sessions')} set revoked_at = now() where id = ${id} and revoked_at is null`
}

export function clearAdminSession() {
  return COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'
}
