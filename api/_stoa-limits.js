// Atomic fixed-window quotas shared across Worker instances. Keys are
// one-way hashes, never raw addresses. Used before issuing or checking
// login credentials and before recording access requests.
import { createHash } from 'node:crypto'
import { T } from './_stoa-db.js'
export async function takeLimit(sql, scope, value, max, minutes = 10) {
  const table = process.env.STOA_ACCOUNT_REVIEW === '1' ? 'stoa_test_flow_limits' : 'stoa_flow_limits'
  await sql`create table if not exists ${T(sql, table)} (
    key text not null, bucket bigint not null, hits integer not null,
    primary key (key, bucket)
  )`
  const key = createHash('sha256').update(`${scope}:${value}`).digest('hex')
  const bucket = Math.floor(Date.now() / (minutes * 60000))
  const rows = await sql`insert into ${T(sql, table)} (key, bucket, hits)
    values (${key}, ${bucket}, 1)
    on conflict (key, bucket) do update set hits = ${T(sql, table)}.hits + 1
    where ${T(sql, table)}.hits < ${max}
    returning hits`
  return rows.length === 1
}
