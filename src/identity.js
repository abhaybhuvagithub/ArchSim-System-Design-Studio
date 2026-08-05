// Who is this user, what have they paid for, and may they open this thing.
//
// The failure modes here are not exotic. They are: checking entitlement against
// the primary database on every request, putting MFA everywhere except the one
// path that needed it, and issuing tokens you have no way to withdraw. All
// three are invisible on a diagram, which is why they get modelled rather than
// drawn.

export const AUTH = {
  none:     { label: 'None', mfa: false, blurb: 'Anonymous. Correct for a public read path, and a finding anywhere else.' },
  password: { label: 'Password only', mfa: false, blurb: 'A shared secret and nothing else. Credential stuffing works against this at scale because people reuse passwords.' },
  totp:     { label: 'Password + TOTP', mfa: true, phishable: true, blurb: 'A six-digit code from an app. Stops credential stuffing outright; a convincing proxy page still captures the code and replays it inside the window.' },
  push:     { label: 'Password + push', mfa: true, phishable: true, blurb: 'Approve on your phone. Better usability than codes, and vulnerable to fatigue — approvals sent repeatedly until someone taps yes.' },
  webauthn: { label: 'Passkey / WebAuthn', mfa: true, phishable: false, blurb: 'The key is bound to the origin, so a proxy page cannot use it. The only widely deployed factor that resists phishing rather than slowing it down.' },
  mtls:     { label: 'Mutual TLS', mfa: false, blurb: 'For services rather than people. Identity is the certificate.' },
  sso:      { label: 'SSO (OIDC / SAML)', mfa: false, blurb: 'Delegates the question to an identity provider. Whatever factors they enforce become yours — including none.' },
}

export const SESSION = {
  stateless: { label: 'Stateless token (JWT)', revocable: false, blurb: 'No lookup on the hot path, which is the whole appeal. A token stays valid until it expires, so revocation needs something extra.' },
  server:    { label: 'Server-side session', revocable: true, blurb: 'A lookup per request, usually to a cache. Logging out actually logs the user out.' },
  hybrid:    { label: 'Short token + refresh', revocable: true, blurb: 'A short-lived access token with a revocable refresh token. The usual answer: the exposure window is the token lifetime, not forever.' },
}

export const ENTITLEMENT = {
  none:     { label: 'Not modelled', hotPath: false, blurb: 'Nothing says what this user is allowed to use.' },
  perRequest: { label: 'Database lookup per request', hotPath: true, blurb: 'Correct and current, and it puts your licence table on the critical path of every call — including reads that would otherwise never touch the primary.' },
  cached:   { label: 'Cached lookup', hotPath: false, blurb: 'A short TTL in front of the entitlement store. A downgrade takes effect a TTL late, which is almost always acceptable.' },
  claims:   { label: 'Claims in the token', hotPath: false, blurb: 'Entitlements travel with the request, so there is no lookup at all. They are also as stale as the token, which is why a revoked seat can keep working until it expires.' },
}

const PRIVILEGED = /admin|internal|ops|console|back ?office|management/i
const isEdge = n => ['gateway', 'lb', 'waf', 'web'].includes(n.type)
const isService = n => ['app', 'micro', 'web', 'worker'].includes(n.type)
const STORES = new Set(['sql', 'nosql'])

export function authOf(node) {
  const a = AUTH[node?.auth] ? node.auth : null
  return { method: a, ...(a ? AUTH[a] : {}), session: SESSION[node?.session] ? node.session : null }
}

// A token nobody can withdraw is only as safe as its lifetime.
export function revocationRisk(node) {
  const s = node?.session
  if (s !== 'stateless') return null
  const mins = Number(node?.tokenMinutes ?? 60)
  if (mins <= 15) return null
  return { minutes: mins, why: `A stateless token cannot be withdrawn, so a stolen or revoked session keeps working for up to ${mins} minutes.` }
}

export function identityFindings(nodes, edges) {
  const out = []
  const add = (severity, node, title, why, fix) =>
    out.push({ severity, nodeId: node?.id, title, why, fix, source: 'identity' })
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const sources = new Set(nodes.filter(n => n.type === 'client').map(n => n.id))

  for (const n of nodes) {
    const priv = PRIVILEGED.test(n.label || '')

    if (isEdge(n) && edges.some(e => sources.has(e.from) && e.to === n.id)) {
      if (!n.auth || n.auth === 'none') {
        add(priv ? 'bad' : 'warn', n, n.label + ' takes user traffic with no stated authentication',
          'This is the first thing users reach and nothing here says who they have to prove they are.',
          'State the method. If it is deliberately public, say so — an unanswered question and a considered decision look identical on a diagram.')
      } else if (priv && !AUTH[n.auth]?.mfa) {
        add('bad', n, n.label + ' is a privileged path without a second factor',
          'An administrative surface behind a single shared secret. This is the path worth protecting first and the one most often left on password alone.',
          'Require a second factor here specifically. Step-up on the privileged route beats blanket MFA everywhere, which trains people to approve without reading.')
      } else if (AUTH[n.auth]?.mfa && AUTH[n.auth]?.phishable && priv) {
        add('warn', n, n.label + ' uses a phishable second factor on a privileged path',
          'Codes and push approvals both survive a convincing proxy page — the attacker relays what the user types or waits for a tired approval.',
          'Use an origin-bound credential such as a passkey for administrative access. It is the difference between slowing phishing down and stopping it.')
      }
    }

    const rev = revocationRisk(n)
    if (rev && (isEdge(n) || isService(n))) {
      add(rev.minutes >= 240 ? 'bad' : 'warn', n, n.label + ' issues tokens it cannot withdraw',
        rev.why + ' Logging out, disabling an account and cancelling a subscription all become eventual rather than immediate.',
        'Shorten the access token and pair it with a revocable refresh token, or keep a deny list checked at the edge. Say which — "we use JWTs" is not a revocation story.')
    }

    if (isService(n) && n.entitlement === 'perRequest') {
      const store = edges.filter(e => e.from === n.id).map(e => byId[e.to]).find(t => t && STORES.has(t.type))
      add('warn', n, n.label + ' checks entitlement on every request',
        `Every call asks ${store ? store.label : 'the entitlement store'} what this user has paid for, which puts a licensing table on the critical path of traffic that would otherwise never touch it.`,
        'Cache it with a short TTL, or carry the entitlements as claims. A downgrade landing a minute late is almost always acceptable; a licence lookup in front of every read is not.')
    }

    if (isService(n) && n.entitlement === 'claims' && n.session === 'stateless' && (Number(n.tokenMinutes ?? 60) > 60)) {
      add('warn', n, n.label + ' carries entitlements in a long-lived token',
        'Entitlements in the token mean no lookup, and also that a cancelled or downgraded subscription keeps working until the token expires.',
        'Keep the token short if entitlements ride in it. The token lifetime is now your billing accuracy.')
    }
  }
  return out
}
