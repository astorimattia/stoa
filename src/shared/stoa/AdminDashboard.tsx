import { useCallback, useEffect, useMemo, useState } from 'react'

type Access = 'open' | 'gated'

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

type Reader = {
  email: string
  role: string | null
  status: string
  active: boolean
  approved_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

type Piece = { slug: string; title: string; access: Access; public: boolean }

type DashboardData = {
  totals: {
    requests: number
    pending?: number
    readers: number
    activeReaders?: number
    byStatus: Record<string, number>
    byPiece: { piece: string; count: number }[]
  }
  requests: StoaRequest[]
  readers?: Reader[]
  pieces?: Piece[]
  linkDays?: { default: number; max: number }
}

type Action = 'approve' | 'revoke' | 'expire'
type ApproveTarget = { email: string; rotate: boolean }
type IssuedLink = { email: string; url: string; expiresAt: string | null }

const SECRET_KEY = 'stoa_admin_secret'

function fmt(ts: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function readerStatus(r: Reader): string {
  if (r.status === 'revoked') return 'revoked'
  if (!r.active) return 'expired'
  return 'approved'
}

// What the inbox shows: an approved legacy link past its expiry reads as expired.
function requestStatus(r: StoaRequest): string {
  if (r.status === 'approved' && r.expires_at && new Date(r.expires_at) <= new Date()) return 'expired'
  return r.status
}

function statusTone(status: string): string {
  if (status === 'approved') return 'text-emerald-300'
  if (status === 'pending') return 'text-amber-300'
  return 'text-paper/45'
}

function AccessTag({ access }: { access: Access | undefined }) {
  if (!access) return null
  const tone = access === 'open' ? 'border-emerald-300/30 text-emerald-300/80' : 'border-paper/20 text-paper/55'
  return <span className={`ml-2 inline-block border px-1.5 py-px text-[10px] uppercase tracking-[0.12em] ${tone}`}>{access}</span>
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
  const readers: Reader[] = data?.readers || []
  const defaultDays = data?.linkDays?.default || 30
  const maxDays = data?.linkDays?.max || 365

  const pieceFor = useCallback(
    (label: string | null) => (label ? pieces.find((p) => p.title === label || p.slug === label) : undefined),
    [pieces]
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

  // Calls api/admin.js with the session secret. A response that carries a
  // one-time reading link is held in memory only, never stored.
  const act = useCallback(
    async (action: Action, payload: { email: string; days?: number; rotate?: boolean }) => {
      setBusy(`${action}:${payload.email}`)
      setNotice(null)
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
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
          setApproving(null)
          if (body.url) {
            setIssued({ email: body.email, url: body.url, expiresAt: body.expiresAt })
            setCopied(false)
          } else {
            setNotice(`${body.email} keeps their existing link; access runs to ${fmt(body.expiresAt)}.`)
          }
        } else {
          setNotice(
            body.changed
              ? `${action === 'revoke' ? 'Revoked' : 'Expired'} all access for ${payload.email}.`
              : `Nothing active to ${action} for ${payload.email}.`
          )
        }
        await load(secret)
      } catch {
        setNotice('The admin API is temporarily unavailable.')
      } finally {
        setBusy(null)
      }
    },
    [secret, load]
  )

  useEffect(() => {
    if (secret) load(secret)
  }, [secret, load])

  const pending = useMemo(() => (data ? data.requests.filter((r) => r.status === 'pending') : []), [data])
  const history = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.requests
    return data.requests.filter((r) => requestStatus(r) === filter)
  }, [data, filter])

  const startApprove = (email: string, rotate = false) => {
    setApproving({ email, rotate })
    setDays(defaultDays)
  }

  const btn =
    'ml-2 border border-paper/20 px-2.5 py-1 text-xs text-paper/70 transition-colors hover:border-paper/50 hover:text-paper disabled:opacity-40'

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
          <p className="mt-0.5 text-xs text-paper/45">Readers and access requests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => startApprove('')}
            className="border border-paper/20 px-3 py-1.5 text-xs text-paper/70 transition-colors hover:border-paper/50 hover:text-paper"
          >
            Add reader
          </button>
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
              Reading link for {issued.email}, valid until {fmt(issued.expiresAt)}. It opens every piece they have access
              to. It is shown once: copy it now.
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
              if (!approving.email) return
              act('approve', {
                email: approving.email,
                days,
                rotate: approving.rotate || undefined,
              })
            }}
          >
            <p className="text-sm text-paper/85">Approve a reader</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-paper/60">
              <input
                type="email"
                required
                value={approving.email}
                onChange={(e) => setApproving({ ...approving, email: e.target.value })}
                placeholder="reader@company.com"
                className="w-64 border border-paper/20 bg-transparent px-2 py-1 text-paper"
              />
              <label className="flex items-center gap-2">
                Valid for
                <input type="number" min={1} max={maxDays} value={days}
                  onChange={(e) => setDays(Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), maxDays))}
                  className="w-20 border border-paper/20 bg-transparent px-2 py-1 text-paper" />
                days (max {maxDays})
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={approving.rotate}
                  onChange={(e) => setApproving({ ...approving, rotate: e.target.checked })} />
                New link (old one stops working)
              </label>
              <button type="submit" disabled={!!busy || !approving.email}
                className="bg-paper px-3 py-1.5 font-medium text-ink hover:bg-paper/90 disabled:opacity-50">
                {busy ? 'Approving…' : 'Approve'}
              </button>
              <button type="button" onClick={() => setApproving(null)} className="text-paper/45 hover:text-paper">
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-paper/40">
              One link opens every gated piece. An active reader keeps their link and only gets more time.
            </p>
          </form>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Pending requests" value={data.totals.pending ?? pending.length} />
              <Stat label="Active readers" value={data.totals.activeReaders ?? readers.filter((r) => r.active).length} />
              <Stat label="Readers" value={readers.length} />
              <Stat label="Requests" value={data.totals.requests} />
            </div>

            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-[0.14em] text-paper/40">Pieces</h2>
              <ul className="mt-3 space-y-1.5">
                {pieces.map((p) => (
                  <li key={p.slug} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate text-paper/75">
                      {p.title}
                      <AccessTag access={p.access} />
                    </span>
                    <span className="shrink-0 text-paper/45">
                      {data.totals.byPiece.find((b) => b.piece === p.title)?.count || 0} requests
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Section title={`Pending requests (${pending.length})`}>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paper/15 text-xs uppercase tracking-[0.12em] text-paper/40">
                    <th className="py-2.5 pr-4 font-normal">Email</th>
                    <th className="py-2.5 pr-4 font-normal">Role</th>
                    <th className="py-2.5 pr-4 font-normal">Requested piece</th>
                    <th className="py-2.5 pr-4 font-normal">Requested</th>
                    <th className="py-2.5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r, i) => {
                    const p = pieceFor(r.piece)
                    return (
                      <tr key={i} className="border-b border-paper/8 last:border-b-0">
                        <td className="py-3 pr-4 text-paper/85">{r.email}</td>
                        <td className="py-3 pr-4 text-paper/55">{r.role || '—'}</td>
                        <td className="max-w-[300px] truncate py-3 pr-4 text-paper/55">
                          {r.piece || 'Any piece'}
                          <AccessTag access={p?.access} />
                        </td>
                        <td className="py-3 pr-4 text-paper/55">{fmt(r.created_at)}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button className={btn} disabled={!!busy}
                            onClick={() => startApprove(r.email)}>
                            Approve
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {pending.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-paper/40">No pending requests.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section title={`Readers (${readers.length})`}>
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paper/15 text-xs uppercase tracking-[0.12em] text-paper/40">
                    <th className="py-2.5 pr-4 font-normal">Email</th>
                    <th className="py-2.5 pr-4 font-normal">Role</th>
                    <th className="py-2.5 pr-4 font-normal">Status</th>
                    <th className="py-2.5 pr-4 font-normal">Access until</th>
                    <th className="py-2.5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {readers.map((r) => {
                    const v = readerStatus(r)
                    return (
                      <tr key={r.email} className="border-b border-paper/8 last:border-b-0">
                        <td className="py-3 pr-4 text-paper/85">{r.email}</td>
                        <td className="py-3 pr-4 text-paper/55">{r.role || '—'}</td>
                        <td className={`py-3 pr-4 capitalize ${statusTone(v)}`}>{v}</td>
                        <td className="py-3 pr-4 text-paper/55">{v === 'revoked' ? '—' : fmt(r.expires_at)}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button className={btn} disabled={!!busy} onClick={() => startApprove(r.email, v === 'revoked')}>
                            {v === 'approved' ? 'Extend' : 'Approve'}
                          </button>
                          {v === 'approved' && (
                            <>
                              <button className={btn} disabled={!!busy}
                                onClick={() => window.confirm(`Expire all of ${r.email}'s access now?`) && act('expire', { email: r.email })}>
                                Expire
                              </button>
                              <button className={btn} disabled={!!busy}
                                onClick={() => window.confirm(`Revoke ${r.email}'s reading link? It stops working immediately for every piece.`) && act('revoke', { email: r.email })}>
                                Revoke
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {readers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-paper/40">No readers yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section title="All requests">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {['all', 'pending', 'handled', 'approved', 'revoked', 'expired'].map((f) => (
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
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paper/15 text-xs uppercase tracking-[0.12em] text-paper/40">
                    <th className="py-2.5 pr-4 font-normal">Email</th>
                    <th className="py-2.5 pr-4 font-normal">Role</th>
                    <th className="py-2.5 pr-4 font-normal">Piece</th>
                    <th className="py-2.5 pr-4 font-normal">Status</th>
                    <th className="py-2.5 pr-4 font-normal">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="border-b border-paper/8 last:border-b-0">
                      <td className="py-3 pr-4 text-paper/85">{r.email}</td>
                      <td className="py-3 pr-4 text-paper/55">{r.role || '—'}</td>
                      <td className="max-w-[300px] truncate py-3 pr-4 text-paper/55">
                        {r.piece || 'Any piece'}
                        <AccessTag access={pieceFor(r.piece)?.access} />
                      </td>
                      <td className={`py-3 pr-4 capitalize ${statusTone(requestStatus(r))}`}>{requestStatus(r)}</td>
                      <td className="py-3 pr-4 text-paper/55">{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-paper/40">No requests.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-[0.14em] text-paper/40">{title}</h2>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
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
