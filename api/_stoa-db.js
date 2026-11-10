// Shared Neon access + idempotent schema bootstrap for the Stoa request
// flow. DATABASE_URL is set on the project by the Vercel Neon integration
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
      await sql`create table if not exists stoa_articles (
        piece text primary key,
        content jsonb not null
      )`
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}
