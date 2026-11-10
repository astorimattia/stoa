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
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}
