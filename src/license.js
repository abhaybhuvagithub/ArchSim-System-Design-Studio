// Licensing for ArchSim Pro. Design constraints, honestly stated:
//
//   • No backend exists, so keys are validated client-side with a signature
//     scheme. A determined person can crack any client-side check; they were
//     never going to pay. The check keeps honest people honest and makes the
//     product sellable today at zero infrastructure cost.
//   • Plans and expiry are ENCODED IN THE KEY (AS1-<plan>-<expiry>-<rand>-<sig>)
//     so monthly/yearly keys expire without a server. Lifetime keys never do.
//   • Keys are minted with scripts/genkey.mjs (same code path as validation,
//     so they can never drift apart) and delivered manually after payment —
//     the right amount of machinery for customers #1–100. Razorpay webhooks
//     can replace the manual step later without changing the key format.

export const LICENSE_STORE = 'archsim.license.v1'

// ── pricing (single source of truth for the pricing modal) ─────────────────
export const PRICES = {
  monthly: { label: '1 Month', inr: 999, note: 'per month', keyPlan: 'M' },
  halfyear: { label: '6 Months', inr: 4999, note: '₹833/month — save 17%', keyPlan: 'H' },
  yearly: { label: '1 Year', inr: 7999, note: '₹667/month — save 33%', keyPlan: 'Y', highlight: true },
}
export const UPI_ID = 'abhay.bhuva@okhdfcbank'
export const UPI_NAME = 'Abhay Bhuva'
export const CONTACT_URL = 'https://www.linkedin.com/in/abhaybhuva/'

// ── the free tier ──────────────────────────────────────────────────────────
// Free stays genuinely useful: the full simulator, chaos, learning, and this
// set of templates — including everything the onboarding wizard and the tour
// can load. Everything else in the library is Pro.
export const FREE_TEMPLATES = new Set([
  'URL Shortener (Bitly)',        // wizard + the classic
  'GenAI: RAG Assistant',         // wizard
  'Ramp',                         // wizard
  'Ticketmaster',                 // tour
  'Chat (WhatsApp)',
  'Ride Sharing (Uber)',
  'Video Platform (YouTube)',
  'Rate Limiter (as a system)',
  'Redis (Distributed Cache)',
  'Notification System',
  'Web Crawler',
  'Zomato',
  'Netflix',
  'News Feed (Twitter/X)',
  'Payment System (Stripe-lite)',
])
export const isTemplateFree = name => FREE_TEMPLATES.has(name)

// ── key format & signature ─────────────────────────────────────────────────
// AS1-<P>-<YYYYMMDD|FOREVER>-<RAND4>-<SIG6>   e.g. AS1-L-FOREVER-K7Q2-3F9ZXC
const SALT = 'archsim-studio-2026-gift-city'

function sig(payload) {
  // djb2 over payload+salt, folded to 6 base36 chars. Not cryptography —
  // a tamper-evidence seal, per the constraints stated above.
  let h = 5381
  const s = payload + SALT
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  let h2 = 2166136261
  for (let i = s.length - 1; i >= 0; i--) h2 = Math.imul(h2 ^ s.charCodeAt(i), 16777619) >>> 0
  return (h.toString(36) + h2.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(6, 'X')
}

export function makeKey(plan, now = new Date()) {
  const p = { monthly: 'M', halfyear: 'H', yearly: 'Y', lifetime: 'L' }[plan]
  if (!p) throw new Error('plan must be monthly | halfyear | yearly | lifetime')
  let expiry = 'FOREVER'
  if (p !== 'L') {
    const d = new Date(now)
    d.setDate(d.getDate() + (p === 'M' ? 32 : p === 'H' ? 184 : 367))   // a couple of grace days
    expiry = d.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const rand = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
  const payload = `AS1-${p}-${expiry}-${rand}`
  return `${payload}-${sig(payload)}`
}

// Keys that leaked publicly get listed here and die on the next deploy —
// the no-backend answer to a shared key. Add the full key string, redeploy.
export const REVOKED_KEYS = new Set([
  'AS1-L-FOREVER-AKPH-1RE9I1',   // leaked in a public commit 2026-08-24 — rotated
])

export function validateKey(raw, now = new Date(), revoked = REVOKED_KEYS) {
  const key = String(raw || '').trim().toUpperCase()
  const m = key.match(/^(AS1-([MHYL])-(FOREVER|\d{8})-[A-Z0-9]{4})-([A-Z0-9]{6})$/)  // L stays accepted: issued lifetime keys are grandfathered
  if (!m) return { ok: false, reason: 'That does not look like an ArchSim key (AS1-…).' }
  if (sig(m[1]) !== m[4]) return { ok: false, reason: 'The key signature does not check out — copy it exactly as sent.' }
  if (revoked.has(key)) return { ok: false, revoked: true, reason: 'This key has been revoked. If you bought it, get in touch and a replacement is on the way.' }
  const plan = { M: 'monthly', H: 'halfyear', Y: 'yearly', L: 'lifetime' }[m[2]]
  if (m[3] !== 'FOREVER') {
    const exp = new Date(`${m[3].slice(0, 4)}-${m[3].slice(4, 6)}-${m[3].slice(6, 8)}T23:59:59Z`)
    if (now > exp) return { ok: false, reason: `This ${plan} key expired on ${exp.toISOString().slice(0, 10)} — renewing takes a minute.`, expired: true, plan }
    return { ok: true, plan, expires: exp.toISOString().slice(0, 10) }
  }
  return { ok: true, plan, lifetime: true }
}

// ── stored license ─────────────────────────────────────────────────────────
export function getLicense() {
  try {
    const k = localStorage.getItem(LICENSE_STORE)
    if (!k) return null
    const v = validateKey(k)   // re-validated every load: expiry and revocation both bite here
    return v.ok ? { key: k, ...v } : null
  } catch { return null }
}
export function setLicense(key) { try { localStorage.setItem(LICENSE_STORE, String(key).trim().toUpperCase()) } catch { /* private mode */ } }
export function clearLicense() { try { localStorage.removeItem(LICENSE_STORE) } catch { /* private mode */ } }
export const isPro = () => !!getLicense()

// UPI deep link for the India payment path (mobile opens the UPI app directly).
export function upiLink(amountInr, planLabel) {
  const p = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: String(amountInr), cu: 'INR', tn: `ArchSim ${planLabel}` })
  return 'upi://pay?' + p.toString()
}

// ── anti brute-force on the activation field ───────────────────────────────
// Five wrong keys arms a 60-second cooldown. This is UI throttling, not
// cryptography: with the salt necessarily in the bundle, the honest threat
// model is casual guessing and script kiddies, and this prices both out.
export const ATTEMPTS_STORE = 'archsim.license.attempts'
const MAX_MISSES = 5
const COOLDOWN_MS = 60_000

export function attemptState(now = Date.now(), store) {
  let raw
  try { raw = (store || localStorage).getItem(ATTEMPTS_STORE) } catch { return { blocked: false, misses: 0 } }
  let a = []
  try { a = JSON.parse(raw || '[]') } catch { a = [] }
  a = a.filter(t => now - t < COOLDOWN_MS)
  return { blocked: a.length >= MAX_MISSES, misses: a.length, retryInMs: a.length ? COOLDOWN_MS - (now - a[0]) : 0 }
}
export function recordMiss(now = Date.now(), store) {
  try {
    const st = store || localStorage
    let a = []
    try { a = JSON.parse(st.getItem(ATTEMPTS_STORE) || '[]') } catch { a = [] }
    a = a.filter(t => now - t < COOLDOWN_MS)
    a.push(now)
    st.setItem(ATTEMPTS_STORE, JSON.stringify(a))
  } catch { /* private mode */ }
}
export function clearMisses(store) { try { (store || localStorage).removeItem(ATTEMPTS_STORE) } catch { /* private mode */ } }
