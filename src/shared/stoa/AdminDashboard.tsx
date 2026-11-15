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
}

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
    return data.requests.filter((r) => r.status === filter)
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
                    <th className="py-2.5 font-normal">Link expires</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-paper/8 last:border-b-0">
                      <td className="py-3 pr-4 text-paper/85">{r.email}</td>
                      <td className="py-3 pr-4 text-paper/55">{r.role || '—'}</td>
                      <td className="max-w-[220px] truncate py-3 pr-4 text-paper/55">{r.piece || 'Any piece'}</td>
                      <td className={`py-3 pr-4 capitalize ${statusTone(r.status)}`}>{r.status}</td>
                      <td className="py-3 pr-4 text-paper/55">{fmt(r.created_at)}</td>
                      <td className="py-3 text-paper/55">{r.status === 'approved' ? fmt(r.expires_at) : '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-paper/40">
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
