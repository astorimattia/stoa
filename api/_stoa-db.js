// Shared Neon access + idempotent schema bootstrap for the Stoa request
// flow. Article content lives in a sensitive env var, not in the database.
// DATABASE_URL is set on the project by the Vercel Neon integration
// (sensitive env - never readable via API, only at runtime here).

import { neon } from '@neondatabase/serverless'

let schemaReady = null

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

export function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`create table if not exists stoa_requests (
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
      await sql`alter table stoa_requests add column if not exists token_hash text unique`
      // Admin endpoint abuse control + audit. No secrets or tokens in either.
      await sql`create table if not exists stoa_admin_throttle (
        ip text primary key,
        fails integer not null default 0,
        first_fail_at timestamptz,
        locked_until timestamptz
      )`
      await sql`create table if not exists stoa_admin_audit (
        id bigint generated always as identity primary key,
        at timestamptz not null default now(),
        ip text,
        action text not null,
        target text,
        ok boolean not null
      )`
      // Readers: one row per person, one reading link (stored as a hash)
      // that opens every gated piece. stoa_requests stays the inbox of
      // incoming requests (pending -> handled) and the legacy per-piece link
      // store. (A stoa_grants table from the earlier tiered model may still
      // exist in the database; it is no longer read or written.)
      await sql`create table if not exists stoa_readers (
        email text primary key,
        role text,
        status text not null default 'approved',
        token_hash text unique,
        approved_at timestamptz,
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      )`
      await sql`create table if not exists stoa_migrations (
        name text primary key,
        ran_at timestamptz not null default now()
      )`
      await migrateReaders(sql)
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
  const done = await sql`select 1 from stoa_migrations where name = ${name} limit 1`
  if (done.length) return
  // Old test rows (cleanup approved by Mattia).
  await sql`delete from stoa_requests where lower(email) = 'stoa-test-20261115@example.com'`
  await sql`
    insert into stoa_readers (email, role, status, token_hash, approved_at, expires_at, revoked_at, created_at)
    select distinct on (lower(email))
      lower(email), role, 'approved', token_hash, approved_at, expires_at, null, created_at
    from stoa_requests
    where status = 'approved' and revoked_at is null and token_hash is not null
      and (expires_at is null or expires_at > now())
    order by lower(email), expires_at desc nulls first, approved_at desc
    on conflict do nothing
  `
  await sql`insert into stoa_migrations (name) values (${name}) on conflict do nothing`
}
