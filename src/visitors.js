// Visitor counter for a static site. Counts one hit per browser session against a
// free public counter service; if none is reachable the chip simply does not render,
// because a made-up number is worse than no number.
const NS = 'archsim-system-design-studio'
const SESSION_KEY = 'archsim.counted'
const CACHE_KEY = 'archsim.visitors'

// A second "free counter" service used to sit in this list; it shut down in
// 2023 and every page load paid a timeout to a corpse until it was removed.
// One live service, or the chip hides.
// Abacus (abacus.jasoncameron.dev) is the open-source successor built to
// replace the free counter service that died in 2023; counterapi.dev stays as the fallback. Each
// provider gets 3.5s, first finite answer wins, all fail -> cached -> hidden.
const ENDPOINTS = [
  { url: `https://abacus.jasoncameron.dev/hit/${NS}/visits`, read: d => d?.value },
  { url: `https://api.counterapi.dev/v1/${NS}/visits/up`, read: d => d?.count },
]
const READ_ONLY = [
  { url: `https://abacus.jasoncameron.dev/get/${NS}/visits`, read: d => d?.value },
  { url: `https://api.counterapi.dev/v1/${NS}/visits/`, read: d => d?.count },
]

const cached = () => {
  try { const v = Number(localStorage.getItem(CACHE_KEY)); return Number.isFinite(v) && v > 0 ? v : null } catch { return null }
}
const remember = v => { try { localStorage.setItem(CACHE_KEY, String(v)) } catch {} }

async function tryAll(endpoints) {
  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 3500)
      const res = await fetch(ep.url, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) continue
      const v = ep.read(await res.json())
      if (Number.isFinite(v) && v > 0) return v
    } catch {}
  }
  return null
}

// Increments once per tab session, otherwise just reads the current total.
export async function countVisit() {
  let firstThisSession = false
  try {
    firstThisSession = !sessionStorage.getItem(SESSION_KEY)
    if (firstThisSession) sessionStorage.setItem(SESSION_KEY, '1')
  } catch { firstThisSession = true }

  const v = await tryAll(firstThisSession ? ENDPOINTS : READ_ONLY)
  if (v != null) { remember(v); return v }
  return cached()   // last known good, or null → chip stays hidden
}

export const formatVisitors = n =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k'
  : n.toLocaleString()
