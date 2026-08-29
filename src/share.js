// Shareable designs: the whole canvas — nodes, edges, traffic — encoded into
// the URL hash. Send the link, and the studio opens on exactly your design:
// no account, no server, no expiry. The suite holds encode→decode to a
// lossless round trip.

const enc = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const dec = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeShare(nodes, edges, rps) {
  const payload = {
    v: 1,
    r: rps,
    // nodes are plain data already; keep them whole so inspector state
    // (write policy, balancing, replication…) travels with the link
    n: nodes,
    e: edges.map(e => [e.from ?? e[0], e.to ?? e[1]]),
  }
  return enc(JSON.stringify(payload))
}

export function decodeShare(hash) {
  const raw = (hash || '').replace(/^#?d=/, '')
  if (!raw) return null
  try {
    const p = JSON.parse(dec(raw))
    if (p.v !== 1 || !Array.isArray(p.n) || !Array.isArray(p.e)) return null
    return {
      rps: Number(p.r) || 100,
      nodes: p.n,
      edges: p.e.map(([from, to]) => ({ id: `${from}->${to}`, from, to, label: '' })),
    }
  } catch {
    return null
  }
}

export const hasSharedDesign = () =>
  typeof window !== 'undefined' && window.location.hash.startsWith('#d=')
