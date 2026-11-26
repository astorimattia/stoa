import {T} from './_stoa-db.js'
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
