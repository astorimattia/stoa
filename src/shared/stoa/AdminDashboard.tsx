import { useCallback, useEffect, useMemo, useState } from 'react'

type StoaRequest = {
  email: string
  role: string | null
  piece: string | null
  status: string
  created_at: string
  approved_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

type DashboardData = {
  totals: {
    requests: number
    readers: number
    byStatus: Record<string, number>
    byPiece: { piece: string; count: number }[]
  }
  requests: StoaRequest[]
  pieces?: { slug: string; title: string; public: boolean }[]
  linkDays?: { default: number; max: number }
}

type Piece = { slug: string; title: string; public: boolean }

// What the console shows: an approved link past its expiry reads as expired.
function viewStatus(r: StoaRequest): string {
  if (r.status === 'approved' && r.expires_at && new Date(r.expires_at) <= new Date()) return 'expired'
  return r.status
}

function slugFor(piece: string | null, pieces: Piece[]): string {
  if (!piece) return ''
  const hit = pieces.find((p) => p.title === piece || p.slug === piece)
  return hit ? hit.slug : ''
}

type ApproveTarget = { email: string; slug: string }
type IssuedLink = { email: string; piece: string; url: string; days: number }

const SECRET_KEY = 'stoa_admin_secret'

function fmt(ts: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusTone(status: string): string {
  if (status === 'approved') return 'text-emerald-300'
  if (status === 'pending') return 'text-amber-300'
  return 'text-paper/45'
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState(() =>
    typeof window === 'undefined' ? '' : sessionStorage.getItem(SECRET_KEY) || ''
  )
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [approving, setApproving] = useState<ApproveTarget | null>(null)
  const [days, setDays] = useState<number>(30)
  const [busy, setBusy] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssuedLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const pieces: Piece[] = data?.pieces || []
  const defaultDays = data?.linkDays?.default || 30
  const maxDays = data?.linkDays?.max || 365

  // Calls api/admin.js with the session secret. The response (which can
  // carry a one-time reading link) is held in memory only, never stored.
  const act = useCallback(
    async (action: 'approve' | 'revoke' | 'expire', email: string, piece: string, linkDays?: number) => {
      setBusy(`${action}:${email}:${piece}`)
      setNotice(null)
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, email, piece, days: linkDays }),
        })
        if (res.status === 401) {
          sessionStorage.removeItem(SECRET_KEY)
          setSecret('')
          setData(null)
          setError('That secret was not accepted.')
          return
        }
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setNotice(body.error || `That didn't work (${res.status}).`)
          return
        }
        if (action === 'approve') {
          setIssued({ email: body.email, piece: body.piece, url: body.url, days: body.expiresInDays })
          setCopied(false)
          setApproving(null)
        } else {
          setNotice(
            body.changed ? `${action === 'revoke' ? 'Revoked' : 'Expired'} ${email}.` : `Nothing active to ${action} for ${email}.`
          )
        }
        await load(secret)
      } catch {
        setNotice('The admin API is temporarily unavailable.')
      } finally {
        setBusy(null)
      }
    },
    [secret]
  )

  const load = useCallback(async (s: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${s}` },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(SECRET_KEY)
        setSecret('')
        setError('That secret was not accepted.')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
    } catch {
      setError('The dashboard is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (secret) load(secret)
  }, [secret, load])

  const rows = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.requests
    return data.requests.filter((r) => viewStatus(r) === filter)
  }, [data, filter])

  if (!secret) {
    return (
      <div className="flex min-h-full flex-col bg-ink font-sans text-paper">
        <div className="flex flex-1 items-center justify-center px-6">
          <form
            className="w-full max-w-sm"
            onSubmit={(e) => {
              e.preventDefault()
              if (!draft) return
              sessionStorage.setItem(SECRET_KEY, draft)
              setSecret(draft)
            }}
          >
            <h1 className="font-serif text-3xl font-light tracking-tight">Stoa admin</h1>
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Admin secret"
              className="mt-6 w-full border-b border-paper/25 bg-transparent py-2.5 text-sm text-paper outline-none transition-colors placeholder:text-paper/35 hover:border-paper/45 focus:border-paper"
            />
            <button
              type="submit"
              className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper/90"
            >
              Open dashboard
            </button>
            {error && <p className="mt-3 text-sm text-accent">{error}</p>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-ink font-sans text-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 px-5 py-4 sm:px-8">
        <div>
          <h1 className="font-serif text-2xl font-light tracking-tight">Stoa admin</h1>
          <p className="mt-0.5 text-xs text-paper/45">Access requests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load(secret)}
            className="border border-paper/20 px-3 py-1.5 text-xs text-paper/70 transition-colors hover:border-paper/50 hover:text-paper"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem(SECRET_KEY)
              setSecret('')
              setData(null)
            }}
            className="text-xs text-paper/45 transition-colors hover:text-paper"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {error && <p className="text-sm text-accent">{error}</p>}
        {notice && <p className="mb-4 text-sm text-paper/70">{notice}</p>}

        {issued && (
          <div className="mb-8 border border-emerald-300/30 px-4 py-4">
            <p className="text-sm text-paper/85">
              Reading link for {issued.email} ({issued.piece}), valid {issued.days} days. It is shown once: copy it now.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input readOnly value={issued.url} onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 border border-paper/20 bg-transparent px-2 py-1.5 font-mono text-xs text-paper/85" />
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(issued.url); setCopied(true) } catch { setCopied(false) }
                }}
                className="bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper/90"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button onClick={() => setIssued(null)} className="px-2 py-1.5 text-xs text-paper/45 hover:text-paper">
                Done
              </button>
            </div>
          </div>
        )}

        {approving && (
          <form
            className="mb-8 border border-paper/20 px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (approving.slug) act('approve', approving.email, approving.slug, days)
            }}
          >
            <p className="text-sm text-paper/85">Approve {approving.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-paper/60">
              <label className="flex items-center gap-2">
                Piece
                <select value={approving.slug} onChange={(e) => setApproving({ ...approving, slug: e.target.value })}
                  className="border border-paper/20 bg-ink px-2 py-1 text-paper">
                  {pieces.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.title}{p.public ? ' (public)' : ''}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                Link valid for
                <input type="number" min={1} max={maxDays} value={days}
                  onChange={(e) => setDays(Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), maxDays))}
                  className="w-20 border border-paper/20 bg-transparent px-2 py-1 text-paper" />
                days (max {maxDays})
              </label>
              <button type="submit" disabled={!!busy || !approving.slug}
                className="bg-paper px-3 py-1.5 font-medium text-ink hover:bg-paper/90 disabled:opacity-50">
                {busy ? 'Approving…' : 'Approve and create link'}
              </button>
              <button type="button" onClick={() => setApproving(null)} className="text-paper/45 hover:text-paper">
                Cancel
              </button>
            </div>
          </form>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Requests" value={data.totals.requests} />
              <Stat label="Requesters" value={data.totals.readers} />
              <Stat label="Pending" value={data.totals.byStatus.pending || 0} />
              <Stat label="Approved" value={data.totals.byStatus.approved || 0} />
            </div>

            {data.totals.byPiece.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs uppercase tracking-[0.14em] text-paper/40">By piece</h2>
                <ul className="mt-3 space-y-1.5">
                  {data.totals.byPiece.map((p) => (
                    <li key={p.piece} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate text-paper/75">{p.piece}</span>
                      <span className="shrink-0 text-paper/45">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-2">
              {['all', 'pending', 'approved', 'revoked', 'expired'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs capitalize transition-colors ${
                    filter === f ? 'bg-paper text-ink' : 'border border-paper/20 text-paper/60 hover:text-paper'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paper/15 text-xs uppercase tracking-[0.12em] text-paper/40">
                    <th className="py-2.5 pr-4 font-normal">Email</th>
                    <th className="py-2.5 pr-4 font-normal">Role</th>
                    <th className="py-2.5 pr-4 font-normal">Piece</th>
                    <th className="py-2.5 pr-4 font-normal">Status</th>
                    <th className="py-2.5 pr-4 font-normal">Requested</th>
                    <th className="py-2.5 pr-4 font-normal">Link expires</th>
                    <th className="py-2.5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-paper/8 last:border-b-0">
                      <td className="py-3 pr-4 text-paper/85">{r.email}</td>
                      <td className="py-3 pr-4 text-paper/55">{r.role || '—'}</td>
                      <td className="max-w-[220px] truncate py-3 pr-4 text-paper/55">{r.piece || 'Any piece'}</td>
                      <td className={`py-3 pr-4 capitalize ${statusTone(viewStatus(r))}`}>{viewStatus(r)}</td>
                      <td className="py-3 pr-4 text-paper/55">{fmt(r.created_at)}</td>
                      <td className="py-3 pr-4 text-paper/55">{r.status === 'approved' ? fmt(r.expires_at) : '—'}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <RowActions
                          r={r}
                          slug={slugFor(r.piece, pieces)}
                          busy={busy}
                          onApprove={(slug) => {
                            setApproving({ email: r.email, slug: slug || pieces.find((p) => !p.public)?.slug || pieces[0]?.slug || '' })
                            setDays(defaultDays)
                          }}
                          onRevoke={(slug) => {
                            if (window.confirm(`Revoke ${r.email}'s reading link for ${r.piece || slug}? The link stops working immediately.`))
                              act('revoke', r.email, slug)
                          }}
                          onExpire={(slug) => {
                            if (window.confirm(`Expire ${r.email}'s reading link for ${r.piece || slug} now?`))
                              act('expire', r.email, slug)
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-paper/40">
                        No requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-paper/10 px-4 py-4">
      <p className="font-serif text-3xl font-light">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-paper/40">{label}</p>
    </div>
  )
}

function RowActions({
  r,
  slug,
  busy,
  onApprove,
  onRevoke,
  onExpire,
}: {
  r: StoaRequest
  slug: string
  busy: string | null
  onApprove: (slug: string) => void
  onRevoke: (slug: string) => void
  onExpire: (slug: string) => void
}) {
  const v = viewStatus(r)
  const btn =
    'ml-2 border border-paper/20 px-2.5 py-1 text-xs text-paper/70 transition-colors hover:border-paper/50 hover:text-paper disabled:opacity-40'
  if (v === 'pending') {
    return (
      <button className={btn} disabled={!!busy} onClick={() => onApprove(slug)}>
        Approve
      </button>
    )
  }
  if (v === 'approved' && slug) {
    return (
      <>
        <button className={btn} disabled={!!busy} onClick={() => onExpire(slug)}>
          Expire
        </button>
        <button className={btn} disabled={!!busy} onClick={() => onRevoke(slug)}>
          Revoke
        </button>
      </>
    )
  }
  return <span className="text-xs text-paper/30">—</span>
}
