// SLO & error budget math plus a Production Readiness Review derived from
// the live graph. The vocabulary is deliberately the industry's (SRE
// workbook): an SLO target buys a monthly error budget; the live failure
// rate burns it at a multiple; fast burn pages a human. The PRR is the
// checklist a Staff+ review runs before a launch gets a green light.

import { CATALOG } from './catalog.js'

const MONTH_MIN = 30 * 24 * 60   // 43,200 minutes

export const SLO_TARGETS = [0.999, 0.9995, 0.9999]

export function sloReport(nodes, edges, sim, target = 0.999) {
  const budgetMin = (1 - target) * MONTH_MIN
  const avail = sim?.sysAvail ?? 1              // structural: composed replica math
  const success = sim?.successRate ?? 1          // live: this traffic, right now
  const failRate = Math.max(0, 1 - success)
  const burn = failRate / (1 - target)           // 1.0 = spending exactly the budget
  const exhaustDays = burn > 0 ? 30 / burn : null

  const has = t => nodes.some(n => n.type === t)
  const hot = id => (sim?.stats?.[id]?.in || 0) > 0
  const spofs = nodes.filter(n => !['client', 'cdn', 'blob', 'dns'].includes(n.type) && (n.replicas || 1) === 1 && hot(n.id))
  const p99 = sim?.p99 ?? 0

  const prr = [
    { id: 'spof', ok: spofs.length === 0, t: 'No single point of failure on the hot path', d: spofs.length ? `${spofs.map(n => n.label).join(', ')} run${spofs.length === 1 ? 's' : ''} one replica with live traffic — one crash is an outage.` : 'Every component taking traffic has a second replica to fail over to.' },
    { id: 'door', ok: has('gateway') || has('lb'), t: 'A managed front door', d: has('gateway') || has('lb') ? 'Traffic enters through a gateway or balancer — one place for limits, auth and shedding.' : 'Clients hit services directly: no seam for rate limits, auth or load shedding when it matters.' },
    { id: 'obs', ok: has('monitor') || has('otel') || has('tsdb'), t: 'Observability exists', d: has('monitor') || has('otel') || has('tsdb') ? 'Metrics/traces are collected — an incident can be seen, not just felt.' : 'Nothing collects metrics or traces: the first alert will be a customer.' },
    { id: 'struct', ok: avail >= target, t: 'Architecture can meet the target at all', d: avail >= target ? `Composed availability ${(avail * 100).toFixed(3)}% clears the ${(target * 100).toFixed(2)}% target structurally.` : `Composed availability ${(avail * 100).toFixed(3)}% cannot reach ${(target * 100).toFixed(2)}% no matter how well it is operated — add redundancy where it is thinnest.` },
    { id: 'burn', ok: burn <= 1, t: 'Error budget is not burning', d: burn <= 1 ? 'At current traffic the failure rate spends within budget.' : `Burning at ${burn.toFixed(1)}× — the month's budget lasts ~${exhaustDays.toFixed(1)} days at this rate.` },
    { id: 'tail', ok: p99 > 0 && p99 < 2000, t: 'Tail latency is sane', d: p99 > 0 && p99 < 2000 ? `p99 ~${Math.round(p99)}ms leaves headroom under a 2s user ceiling.` : p99 >= 2000 ? `p99 ~${Math.round(p99)}ms — past the point users call it down.` : 'Run the simulation to measure the tail.' },
  ]
  const ready = prr.every(x => x.ok)
  return { target, budgetMin, avail, success, burn, exhaustDays, prr, ready, spofCount: spofs.length }
}

// ── one-click remediations ─────────────────────────────────────────────────
// Each failing gate maps to a real canvas mutation. Returns { nodes, note }
// or null when no automatic fix makes sense for this graph. The sim then
// recomputes and the review re-evaluates live - the fix must EARN the green.
const nodeAvail = (n) => 1 - Math.pow(1 - (CATALOG[n.type]?.avail ?? 0.999), n.replicas || 1)

// Human preview of a mutation: exact replica deltas and any added nodes, so
// the button can say precisely what one click will do before it is clicked.
function planFor(before, afterNodes) {
  const prev = new Map(before.map(n => [n.id, n]))
  const parts = []
  for (const n of afterNodes) {
    const p = prev.get(n.id)
    if (!p) parts.push(`+ ${n.label}`)
    else if ((n.replicas || 1) !== (p.replicas || 1)) parts.push(`${n.label} ${p.replicas || 1}→${n.replicas || 1}`)
  }
  return parts.join(', ')
}

export function sloQuickFix(id, nodes, edges, sim, target = 0.999, resim = null) {
  const hot = (nid) => (sim?.stats?.[nid]?.in || 0) > 0
  const bump = (pred, extra = 1) => nodes.map(n => pred(n) ? { ...n, replicas: (n.replicas || 1) + extra } : n)

  if (id === 'spof') {
    const spofs = nodes.filter(n => !['client', 'cdn', 'blob', 'dns'].includes(n.type) && (n.replicas || 1) === 1 && hot(n.id))
    if (!spofs.length) return null
    const ids = new Set(spofs.map(n => n.id))
    const fixed = bump(n => ids.has(n.id))
    return { nodes: fixed, plan: `Will add a failover replica: ${planFor(nodes, fixed)}`, note: `⚡ Added a failover replica to ${spofs.map(n => n.label).join(', ')} — no more single points of failure.` }
  }
  if (id === 'door') {
    const clients = nodes.filter(n => n.type === 'client')
    if (!clients.length) return null
    const cx = Math.round(clients.reduce((a, n) => a + n.x, 0) / clients.length) + 120
    const cy = Math.round(clients.reduce((a, n) => a + n.y, 0) / clients.length)
    const lb = { id: 'lb-fix', type: 'lb', label: 'LB (added)', x: cx, y: cy, replicas: 2 }
    const cids = new Set(clients.map(n => n.id))
    const rewired = edges.map(e => cids.has(e[0]) ? [lb.id, e[1]] : e)
    const inbound = clients.map(c => [c.id, lb.id])
    return { nodes: [...nodes, lb], edges: [...inbound, ...rewired.filter(e => e[0] !== e[1])], plan: 'Will insert an LB behind the clients and route their traffic through it', note: '⚡ Inserted a load balancer behind the clients — one front door for limits, auth and shedding.' }
  }
  if (id === 'obs') {
    const y = Math.max(...nodes.map(n => n.y), 200) + 90
    return { nodes: [...nodes, { id: 'mon-fix', type: 'monitor', label: 'Monitoring (added)', x: 160, y, replicas: 1 }], plan: 'Will add a monitoring tier node (wire services in as you grow)', note: '⚡ Added a monitoring tier — wire your services to it as they grow; the next incident should be seen, not felt.' }
  }
  if (id === 'struct') {
    let ns = nodes.map(n => ({ ...n }))
    for (let i = 0; i < 32; i++) {
      const engineOk = resim ? (resim(ns).sysAvail ?? 1) >= target : null
      const takers = ns.filter(n => hot(n.id) && !['client'].includes(n.type))
      if (!takers.length) return null
      const composed = takers.reduce((a, n) => a * nodeAvail(n), 1)
      if (engineOk === true || (engineOk === null && composed >= target)) break
      const weakest = takers.reduce((w, n) => nodeAvail(n) < nodeAvail(w) ? n : w)
      ns = ns.map(n => n.id === weakest.id ? { ...n, replicas: (n.replicas || 1) + 1 } : n)
    }
    return { nodes: ns, plan: `Will raise replicas where thinnest: ${planFor(nodes, ns)}`, note: '⚡ Raised replicas where availability was thinnest until the architecture clears the target structurally.' }
  }
  if (id === 'burn' || id === 'tail') {
    // Convergent by construction: sizing today's hotspot moves the load to
    // the next tier, so a single pass leaves the gate red and the button
    // begging for more clicks. Instead, iterate against the real simulator
    // (resim) until THIS gate passes — one click, however many rounds.
    let ns = nodes.map(n => ({ ...n }))
    let cur = sim
    const touched = new Map()
    const passes = (s2) => id === 'tail'
      ? (s2.p99 > 0 && s2.p99 < 2000)
      : (Math.max(0, 1 - (s2.successRate ?? 1)) / (1 - target) <= 1)
    // The trap this loop must beat: while an upstream tier is choked, every
    // downstream node reports a small, throttled inflow — sizing to that
    // number chases a mirage one tier per click. So: size multiplicatively
    // wherever util is saturated (the observed inflow is a floor, not the
    // demand), re-simulate, and only stop on the gate passing or a genuine
    // stall — never on one flat round.
    let stall = 0
    let best = id === 'tail' ? (cur?.p99 ?? Infinity) : -(cur?.successRate ?? 0)
    const FIXABLE = n => n.type !== 'client'   // everything server-side is legitimately scalable
    for (let round = 0; round < 48 && resim; round++) {
      if (passes(cur)) break
      const stats = cur?.stats || {}
      const sat = ns.filter(n => FIXABLE(n) && (stats[n.id]?.util || 0) > 0.85)
      const targets = sat.length ? sat : [ns.filter(n => stats[n.id] && FIXABLE(n)).sort((a, b) => (stats[b.id]?.util || 0) - (stats[a.id]?.util || 0))[0]].filter(Boolean)
      if (!targets.length) break
      const tset = new Set(targets.map(n => n.id))
      ns = ns.map(n => {
        if (!tset.has(n.id)) return n
        const st = stats[n.id]
        const cap = CATALOG[n.type]?.cap || 1000
        const r = n.replicas || 1
        const need = Math.max(r + 1, st ? Math.ceil(st.in / (cap * 0.7)) : r + 1, (st?.util || 0) >= 1 ? r * 2 : 0)
        touched.set(n.id, n.label)
        return { ...n, replicas: need }
      })
      cur = resim(ns)
      const metric = id === 'tail' ? cur.p99 : -(cur.successRate ?? 0)
      if (metric < best - Math.abs(best) * 0.005) { best = metric; stall = 0 } else { stall++ }
      if (stall >= 3) break   // three flat rounds: replicas genuinely stopped helping
    }
    if (!resim) {
      // no simulator handed in (older caller): fall back to one honest pass
      const stats = sim?.stats || {}
      const sat = nodes.filter(n => (stats[n.id]?.util || 0) > 0.85)
      if (!sat.length) return null
      const tset = new Set(sat.map(n => n.id))
      const sized = nodes.map(n => tset.has(n.id) ? { ...n, replicas: Math.max((n.replicas || 1) + 1, Math.ceil((stats[n.id]?.in || 0) / ((CATALOG[n.type]?.cap || 1000) * 0.7))) } : n)
      return { nodes: sized, plan: `Will resize: ${planFor(nodes, sized)}`, note: `⚡ Sized ${sat.map(n => n.label).join(', ')} toward ~70% utilization.` }
    }
    if (!touched.size) return null
    const names = [...touched.values()].join(', ')
    const done = passes(cur)
    const delta = planFor(nodes, ns)
    return { nodes: ns, plan: done
      ? `Will resize for the load: ${delta}`
      : `Will resize as far as replicas help (${delta}) — ~${Math.round(cur.p99)}ms of chain depth will remain`,
      note: done
      ? `⚡ Sized ${names} until the gate cleared (~70% utilization targets) — queueing delay is what was eating the tail.`
      : `⚡ Sized ${names} as far as replicas help — the remaining latency lives in chain depth (${Math.round(cur.p99)}ms across the hops), which is a design conversation, not a slider.` }
  }
  return null
}
