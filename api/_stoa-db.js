// Shared Neon access + idempotent schema bootstrap for the Stoa request
// flow. Article content lives in a sensitive env var, not in the database.
// DATABASE_URL is set on the project by the Vercel Neon integration
// (sensitive env - never readable via API, only at runtime here).

import { neon } from '@neondatabase/serverless'
import { PIECES, defaultMode } from './_stoa-pieces.js'

const pieceSeedRows = () =>
  Object.entries(PIECES).map(([slug, cfg]) => ({ slug, title: cfg.title, mode: defaultMode(cfg) }))

let schemaReady = null

export function getSql() {
  const url = databaseURL()
  if (!url) return null
  return neon(url)
}

// Identifier interpolation for table names. The name is always a literal
// from this codebase - never request input.
export const T = (sql, name) => sql.unsafe(name)

export function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`create table if not exists ${T(sql, 'stoa_requests')} (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        role text,
        piece text,
        status text not null default 'pending',
        token text unique,
        approved_at timestamptz,
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      )`
      // Reading links are stored as hashes only: a database read never
      // exposes a usable link. Raw tokens leave the server exactly once,
      // in the approval response to Mattia.
      await sql`alter table ${T(sql, 'stoa_requests')} add column if not exists token_hash text unique`
      await sql`alter table stoa_requests add column if not exists note text`
      await sql`alter table stoa_requests add column if not exists source text`
      await sql`alter table stoa_requests add column if not exists team_note text`
      await sql`create table if not exists stoa_reading_events(id bigint generated always as identity primary key,email text not null,piece text not null,opened_at timestamptz not null default now())`
      // Admin endpoint abuse control + audit. No secrets or tokens in either.
      await sql`create table if not exists ${T(sql, 'stoa_admin_throttle')} (
        ip text primary key,
        fails integer not null default 0,
        first_fail_at timestamptz,
        locked_until timestamptz
      )`
      await sql`create table if not exists ${T(sql, 'stoa_admin_audit')} (
        id bigint generated always as identity primary key,
        at timestamptz not null default now(),
        ip text,
        action text not null,
        target text,
        ok boolean not null
      )`
      // Readers: one row per person, one reading link (stored as a hash).
      // access_mode scopes the library for this reader:
      // - all:      every piece whose mode is 'readers'.
      // - except:   those pieces minus stoa_exclusions rows.
      // - selected: only stoa_grants rows.
      // A piece in 'selected' mode additionally needs an explicit
      // stoa_grants row whatever the reader's mode.
      await sql`create table if not exists ${T(sql, 'stoa_readers')} (
        email text primary key,
        role text,
        status text not null default 'approved',
        access_mode text not null default 'all',
        token_hash text unique,
        approved_at timestamptz,
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      )`
      await sql`alter table ${T(sql, 'stoa_readers')} add column if not exists access_mode text not null default 'all'`
      await sql`create table if not exists ${T(sql, 'stoa_grants')} (
        email text not null,
        piece text not null,
        created_at timestamptz not null default now(),
        primary key (email, piece)
      )`
      await sql`create table if not exists ${T(sql, 'stoa_exclusions')} (
        email text not null,
        piece text not null,
        created_at timestamptz not null default now(),
        primary key (email, piece)
      )`
      // Every registered piece with its live access mode
      // (open / readers / selected). Seeded from the code registry;
      // Mattia changes modes from the dashboard.
      await sql`create table if not exists ${T(sql, 'stoa_pieces')} (
        slug text primary key,
        title text not null,
        mode text not null default 'readers',
        created_at timestamptz not null default now()
      )`
      for (const row of pieceSeedRows()) {
        await sql`
          insert into ${T(sql, 'stoa_pieces')} (slug, title, mode)
          values (${row.slug}, ${row.title}, ${row.mode})
          on conflict (slug) do nothing
        `
      }
      await sql`create table if not exists ${T(sql, 'stoa_migrations')} (
        name text primary key,
        ran_at timestamptz not null default now()
      )`
      await migrateReaders(sql)
      await migrateReaderSubscriptions(sql)
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

// One-time move from per-piece approvals to readers. Every approved,
// unexpired, unrevoked stoa_requests row becomes a reader with the SAME
// token hash and expiry, so existing links keep working unchanged and now
// open every gated piece.
// Guarded by a marker row so later admin changes are never overwritten.
async function migrateReaders(sql) {
  const name = 'readers-v1'
  const done = await sql`select 1 from ${T(sql, 'stoa_migrations')} where name = ${name} limit 1`
  if (done.length) return
  // Every existing row is preserved exactly as-is; this migration only adds
  // reader rows for links that are already approved and active.
  await sql`
    insert into ${T(sql, 'stoa_readers')} (email, role, status, token_hash, approved_at, expires_at, revoked_at, created_at)
    select distinct on (lower(email))
      lower(email), role, 'approved', token_hash, approved_at, expires_at, null, created_at
    from ${T(sql, 'stoa_requests')}
    where status = 'approved' and revoked_at is null and token_hash is not null
      and (expires_at is null or expires_at > now())
    order by lower(email), expires_at desc nulls first, approved_at desc
    on conflict do nothing
  `
  await sql`insert into ${T(sql, 'stoa_migrations')} (name) values (${name}) on conflict do nothing`
}

// Every approved reader is a new-piece email subscriber. This one-time
// backfill subscribes approved, active readers who have no subscription
// row yet; a row already on file - including an explicit unsubscribe - is
// never touched. Guarded by a marker row so later unsubscribe choices are
// never reset. New approvals subscribe through the approve action itself.
async function migrateReaderSubscriptions(sql) {
  const name = 'readers-subscribe-v1'
  const done = await sql`select 1 from ${T(sql, 'stoa_migrations')} where name = ${name} limit 1`
  if (done.length) return
  await sql`create table if not exists ${T(sql, 'stoa_subscriptions')} (email text primary key, subscribed_at timestamptz not null default now(), unsubscribed_at timestamptz)`
  await sql`
    insert into ${T(sql, 'stoa_subscriptions')} (email)
    select email from ${T(sql, 'stoa_readers')}
    where status = 'approved' and revoked_at is null and (expires_at is null or expires_at > now())
    on conflict (email) do nothing
  `
  await sql`insert into ${T(sql, 'stoa_migrations')} (name) values (${name}) on conflict do nothing`
}

// The piece access modes, from the table, falling back to the registry
// defaults for any piece with no row yet. Returns { slug: mode }.
export async function pieceModes(sql, prefix = 'stoa_') {
  const rows = await sql`select slug, mode from ${T(sql, prefix + 'pieces')}`
  const modes = {}
  for (const r of rows) modes[r.slug] = r.mode
  return modes
}

// Can this reader row open this piece? mode is the piece's live mode;
// grants/exclusions are Sets of slugs for this reader.
export function readerCanRead(reader, slug, mode, grants, exclusions) {
  if (mode === 'open') return true
  if (mode === 'selected') return grants.has(slug)
  // 'readers'
  if (reader.access_mode === 'selected') return grants.has(slug)
  if (reader.access_mode === 'except') return !exclusions.has(slug)
  return true
}

// Auth preparation shares the selected database, never a separate fallback.
export const databaseURL = () => {
  if(process.env.STOA_ISOLATED_MAIL_TEST==='1'){
    const url=process.env.STOA_ISOLATED_DATABASE_URL
    if(!url||!process.env.STOA_ISOLATED_DATABASE_HOST||new URL(url).hostname!==process.env.STOA_ISOLATED_DATABASE_HOST)throw Error('Explicit isolated database identity required')
    return url
  }
  return process.env.DATABASE_URL
}
