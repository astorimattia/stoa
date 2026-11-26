// Compatibility only. A token is not an identity, never enrolls a reader and is
// never sent to third-party services. New credentials still use verified auth.
export async function legacyHeaders(): Promise<HeadersInit> {
  try {
    const config = await (await fetch('/api/auth-config')).json()
    if (!config.legacyBridge) return {}
    const url = new URL(location.href)
    const incoming = url.searchParams.get('t')
    const old = incoming || localStorage.getItem('stoa_reader_token')
    if (!old || old.length < 16 || old.length > 200) return {}
    if (incoming) {
      localStorage.setItem('stoa_reader_token', old)
      url.searchParams.delete('t')
      history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    }
    return {'X-Stoa-Legacy-Token': old}
  } catch { return {} }
}
