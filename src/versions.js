// ── Design version history (browser-local) ──────────────────────────────────
// Named snapshots of the canvas, a structural diff between any two, and
// restore. Everything lives in this browser's localStorage — there is no
// server, so history never leaves the page and cannot be shared across
// devices (export the ArchSim JSON for that). Oldest snapshots roll off at
// MAX_VERSIONS so storage stays bounded.
export const VERSIONS_KEY = 'archsim.versions.v1'
export const MAX_VERSIONS = 30

const clone = x => JSON.parse(JSON.stringify(x))

export function readVersions(store = globalThis.localStorage) {
  try {
    const v = JSON.parse(store.getItem(VERSIONS_KEY) || '[]')
    return Array.isArray(v) ? v.filter(s => s && Array.isArray(s.nodes) && Array.isArray(s.edges)) : []
  } catch { return [] }
}

function write(list, store) {
  try { store.setItem(VERSIONS_KEY, JSON.stringify(list)); return true } catch { return false }
}

// Returns { ok, list, snapshot } — ok:false when storage refused the write.
export function saveVersion({ name, nodes, edges, rps }, store = globalThis.localStorage, now = Date.now()) {
  const list = readVersions(store)
  const snapshot = {
    id: `v${now.toString(36)}${list.length}`,
    name: (String(name || '').trim() || `Version ${list.length + 1}`).slice(0, 60),
    at: now,
    rps: Number(rps) || 0,
    nodes: clone(nodes), // whole node objects: inspector state (replication, sharding…) survives restore
    edges: clone(edges),
  }
  const next = [...list, snapshot].slice(-MAX_VERSIONS)
  return { ok: write(next, store), list: next, snapshot }
}

export function deleteVersion(id, store = globalThis.localStorage) {
  const next = readVersions(store).filter(s => s.id !== id)
  write(next, store)
  return next
}

const ek = e => `${e.from}->${e.to}`

// Structural diff from `a` (older) to `b` (newer).
export function diffVersions(a, b) {
  const am = new Map(a.nodes.map(n => [n.id, n]))
  const bm = new Map(b.nodes.map(n => [n.id, n]))
  const addedNodes = b.nodes.filter(n => !am.has(n.id)).map(n => n.label || n.id)
  const removedNodes = a.nodes.filter(n => !bm.has(n.id)).map(n => n.label || n.id)
  const replicaChanges = []
  const retyped = []
  for (const n of b.nodes) {
    const o = am.get(n.id)
    if (!o) continue
    if ((o.replicas || 1) !== (n.replicas || 1)) replicaChanges.push({ label: n.label || n.id, from: o.replicas || 1, to: n.replicas || 1 })
    if (o.type !== n.type) retyped.push({ label: n.label || n.id, from: o.type, to: n.type })
  }
  const ae = new Set(a.edges.map(ek)), be = new Set(b.edges.map(ek))
  const label = id => (bm.get(id) || am.get(id))?.label || id
  const fmt = k => { const [f, t] = k.split('->'); return `${label(f)} → ${label(t)}` }
  const addedEdges = [...be].filter(k => !ae.has(k)).map(fmt)
  const removedEdges = [...ae].filter(k => !be.has(k)).map(fmt)
  const rps = (a.rps || 0) !== (b.rps || 0) ? { from: a.rps || 0, to: b.rps || 0 } : null
  const changes = addedNodes.length + removedNodes.length + replicaChanges.length + retyped.length + addedEdges.length + removedEdges.length + (rps ? 1 : 0)
  return { addedNodes, removedNodes, replicaChanges, retyped, addedEdges, removedEdges, rps, changes }
}

// Human-readable one-liners for the UI and for review notes.
export function describeDiff(d) {
  if (!d.changes) return ['No structural difference']
  const out = []
  d.addedNodes.forEach(n => out.push(`+ component ${n}`))
  d.removedNodes.forEach(n => out.push(`− component ${n}`))
  d.retyped.forEach(r => out.push(`~ ${r.label}: ${r.from} → ${r.to}`))
  d.replicaChanges.forEach(r => out.push(`~ ${r.label}: replicas ${r.from} → ${r.to}`))
  d.addedEdges.forEach(e => out.push(`+ link ${e}`))
  d.removedEdges.forEach(e => out.push(`− link ${e}`))
  if (d.rps) out.push(`~ traffic ${d.rps.from.toLocaleString('en-US')} → ${d.rps.to.toLocaleString('en-US')} req/s`)
  return out
}
