// ── Request Anatomy ──────────────────────────────────────────────────────────
// The HLD artifact every course draws statically, computed live: the primary
// request path (traffic-weighted — the road most requests actually take),
// with per-hop modeled latency AT CURRENT UTILIZATION, a running budget,
// and async boundaries marked where the user stops waiting.
//
// Pure: (nodes, edges, sim) → { hops[], totalP50, totalP99, asyncTail[] }.

const ASYNC_TYPES = new Set(['kafka', 'queue', 'worker', 'stream', 'batch', 'etl'])

export function requestAnatomy(nodes, edges, sim) {
  if (!nodes?.length || !sim?.stats) return null
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const out = {}
  for (const e of edges) {
    const from = e.from ?? e[0], to = e.to ?? e[1]
    ;(out[from] = out[from] || []).push(to)
  }

  const start = nodes.find(n => n.type === 'client' || n.type === 'user') || nodes[0]
  const hops = []
  const asyncTail = []
  const visited = new Set([start.id])
  let cur = start.id
  let totalP50 = 0
  let crossedAsync = false

  for (let depth = 0; depth < 24; depth++) {
    const nexts = (out[cur] || []).filter(id => !visited.has(id) && byId[id])
    if (!nexts.length) break
    // traffic-weighted: follow where most requests actually go
    nexts.sort((a, b) => (sim.stats[b]?.in || 0) - (sim.stats[a]?.in || 0))
    const nid = nexts[0]
    const n = byId[nid]
    const st = sim.stats[nid] || {}
    const util = Math.min(st.util ?? 0, 1)
    const p50 = st.latency ?? 0
    const p99 = p50 * (2.4 + 2.6 * util) // same knee model the simulator documents
    const isAsync = ASYNC_TYPES.has(n.type)

    const hop = {
      id: nid, label: n.label, type: n.type,
      p50: Math.round(p50 * 10) / 10, p99: Math.round(p99 * 10) / 10,
      util: Math.round(util * 100),
      async: isAsync,
      // the alternative roads not taken, for the curious
      alt: nexts.slice(1).map(id => byId[id]?.label).filter(Boolean),
    }

    if (!crossedAsync && isAsync) {
      crossedAsync = true
      hop.note = 'async boundary — the user stops waiting here; work continues behind the log'
    }
    if (crossedAsync) asyncTail.push(hop)
    else { hops.push(hop); totalP50 += p50 }

    visited.add(nid)
    cur = nid
  }

  const worstUtil = Math.max(0, ...hops.map(h => h.util / 100))
  const totalP99 = totalP50 * (2.4 + 2.6 * worstUtil)
  return {
    start: start.label,
    hops,
    asyncTail,
    totalP50: Math.round(totalP50 * 10) / 10,
    totalP99: Math.round(totalP99 * 10) / 10,
    dominant: hops.reduce((a, b) => ((b?.p50 || 0) > (a?.p50 || 0) ? b : a), hops[0] || null),
  }
}
