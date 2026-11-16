// One reading link per reader: the token from any link is kept on this
// device so it can open every other piece the reader has access to. It is
// only ever sent to /api/article; the server decides what it opens.


const KEY = 'stoa_reader_token'

export function getReaderToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Store a ?t= token from the address bar, then drop it from the URL so it
 *  is not left visible in the address bar or browser history. */
export function captureReaderToken(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const t = url.searchParams.get('t')
  if (!t) return getReaderToken()
  try {
    window.localStorage.setItem(KEY, t)
    url.searchParams.delete('t')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    // storage unavailable: leave the token in the URL so this page still opens
  }
  return t
}

/** Slugs this device's reading link opens, or [] when none / no link. */
export async function fetchAccessibleSlugs(): Promise<string[]> {
  const t = getReaderToken()
  if (!t) return []
  try {
    const res = await fetch(`/api/article?access=1&t=${encodeURIComponent(t)}`)
    if (!res.ok) return []
    const body = await res.json()
    return Array.isArray(body.pieces) ? body.pieces : []
  } catch {
    return []
  }
}
