import { CATALOG } from './catalog.js'

// Propagate RPS from client nodes through the directed graph and compute
// per-node utilization, drops, latency and an end-to-end estimate.
export function simulate(nodes, edges, totalRps, downSet = new Set()) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const out = {}, incoming = {}
  for (const n of nodes) { out[n.id] = []; incoming[n.id] = 0 }
  for (const e of edges) if (byId[e.from] && byId[e.to]) out[e.from].push(e.to)

  const sources = nodes.filter(n => CATALOG[n.type]?.source)
  const wSum = sources.reduce((a, s) => a + (s.weight ?? 1), 0) || 1
  for (const s of sources) incoming[s.id] = totalRps * (s.weight ?? 1) / wSum

  // topo-ish propagation with cycle guard (Kahn on reachable subgraph, fall back to N passes)
  const stats = {}
  const order = topoOrder(nodes, edges)
  const flowOnEdge = {}

  for (const id of order) {
    const n = byId[id]
    const spec = CATALOG[n.type]
    if (!spec) continue
    const inRps = incoming[id]
    const isDown = downSet.has(id)
    const replicas = isDown ? Math.max(0, (n.replicas || 1) - 1) : (n.replicas || 1)
    const capacity = spec.source ? Infinity : spec.cap * Math.max(replicas, 0)
    const processed = Math.min(inRps, capacity)
    const dropped = inRps - processed
    const util = capacity === Infinity ? 0 : capacity === 0 ? (inRps > 0 ? 999 : 0) : inRps / capacity
    // M/M/1-flavoured queueing delay
    const qFactor = util >= 1 ? 20 : 1 / Math.max(0.05, 1 - util)
    const latency = spec.lat * Math.min(qFactor, 20)
    const availOne = spec.avail ?? 0.999
    const avail = replicas <= 0 ? 0 : 1 - Math.pow(1 - availOne, replicas)
    stats[id] = { in: inRps, processed, dropped, util, latency, avail, replicas, down: isDown }

    // forward: caches/CDN only forward misses
    let fwd = processed
    if (spec.cacheHit && out[id].length) fwd = processed * (1 - spec.cacheHit)
    const targets = out[id]
    if (targets.length) {
      const share = fwd / targets.length
      for (const t of targets) {
        incoming[t] += share
        flowOnEdge[`${id}->${t}`] = share
      }
    }
  }

  // end-to-end estimate: longest latency path from any source (on DAG part)
  const memo = {}
  const pathLat = (id, seen) => {
    if (memo[id] !== undefined) return memo[id]
    if (seen.has(id)) return 0
    seen.add(id)
    const own = stats[id]?.latency || 0
    let best = 0
    for (const t of out[id] || []) best = Math.max(best, pathLat(t, seen))
    seen.delete(id)
    return (memo[id] = own + best)
  }
  let p50 = 0
  for (const s of sources) p50 = Math.max(p50, pathLat(s.id, new Set()))
  const p99 = p50 * 3

  // availability along the critical (max-latency) chain: product of node avail
  let sysAvail = 1
  for (const n of nodes) {
    if (CATALOG[n.type]?.source) continue
    if ((stats[n.id]?.in ?? 0) > 0) sysAvail *= stats[n.id].avail
  }

  const totalIn = sources.length ? totalRps : 0
  const totalDropped = Object.values(stats).reduce((a, s) => a + s.dropped, 0)
  const successRate = totalIn ? Math.max(0, 1 - totalDropped / totalIn) : 1

  return { stats, flowOnEdge, p50, p99, sysAvail, totalDropped, successRate }
}

function topoOrder(nodes, edges) {
  const indeg = {}, adj = {}
  for (const n of nodes) { indeg[n.id] = 0; adj[n.id] = [] }
  for (const e of edges) {
    if (adj[e.from] && indeg[e.to] !== undefined) { adj[e.from].push(e.to); indeg[e.to]++ }
  }
  const q = nodes.filter(n => indeg[n.id] === 0).map(n => n.id)
  const order = []
  while (q.length) {
    const id = q.shift()
    order.push(id)
    for (const t of adj[id]) if (--indeg[t] === 0) q.push(t)
  }
  // cycle leftovers appended (processed once, good enough for viz)
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id)
  return order
}

// Capacity report with bottleneck detection
export function capacityReport(nodes, sim) {
  const rows = nodes
    .filter(n => !CATALOG[n.type]?.source)
    .map(n => {
      const s = sim.stats[n.id] || { in: 0, util: 0, replicas: n.replicas || 1 }
      const spec = CATALOG[n.type]
      const needed = spec.cap ? Math.ceil(s.in / spec.cap) : 1
      return { id: n.id, label: n.label, type: spec.name, in: s.in, util: s.util, replicas: s.replicas, needed, down: s.down }
    })
    .sort((a, b) => b.util - a.util)
  const bottlenecks = rows.filter(r => r.util > 0.8)
  return { rows, bottlenecks }
}
