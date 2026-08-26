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

export function sloQuickFix(id, nodes, edges, sim, target = 0.999) {
  const hot = (nid) => (sim?.stats?.[nid]?.in || 0) > 0
  const bump = (pred, extra = 1) => nodes.map(n => pred(n) ? { ...n, replicas: (n.replicas || 1) + extra } : n)

  if (id === 'spof') {
    const spofs = nodes.filter(n => !['client', 'cdn', 'blob', 'dns'].includes(n.type) && (n.replicas || 1) === 1 && hot(n.id))
    if (!spofs.length) return null
    const ids = new Set(spofs.map(n => n.id))
    return { nodes: bump(n => ids.has(n.id)), note: `⚡ Added a failover replica to ${spofs.map(n => n.label).join(', ')} — no more single points of failure.` }
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
    return { nodes: [...nodes, lb], edges: [...inbound, ...rewired.filter(e => e[0] !== e[1])], note: '⚡ Inserted a load balancer behind the clients — one front door for limits, auth and shedding.' }
  }
  if (id === 'obs') {
    const y = Math.max(...nodes.map(n => n.y), 200) + 90
    return { nodes: [...nodes, { id: 'mon-fix', type: 'monitor', label: 'Monitoring (added)', x: 160, y, replicas: 1 }], note: '⚡ Added a monitoring tier — wire your services to it as they grow; the next incident should be seen, not felt.' }
  }
  if (id === 'struct') {
    let ns = nodes.map(n => ({ ...n }))
    for (let i = 0; i < 24; i++) {
      const takers = ns.filter(n => hot(n.id) && !['client'].includes(n.type))
      if (!takers.length) return null
      const composed = takers.reduce((a, n) => a * nodeAvail(n), 1)
      if (composed >= target) break
      const weakest = takers.reduce((w, n) => nodeAvail(n) < nodeAvail(w) ? n : w)
      ns = ns.map(n => n.id === weakest.id ? { ...n, replicas: (n.replicas || 1) + 1 } : n)
    }
    return { nodes: ns, note: '⚡ Raised replicas where availability was thinnest until the architecture clears the target structurally.' }
  }
  if (id === 'burn' || id === 'tail') {
    const stats = sim?.stats || {}
    const sat = nodes.filter(n => (stats[n.id]?.util || 0) > 0.85)
    if (sat.length) {
      const ns = nodes.map(n => {
        const st = stats[n.id]
        if (!st || st.util <= 0.85) return n
        const cap = CATALOG[n.type]?.cap || 1000
        const need = Math.max((n.replicas || 1) + 1, Math.ceil(st.in / (cap * 0.7)))
        return { ...n, replicas: need }
      })
      return { nodes: ns, note: `⚡ Sized ${sat.map(n => n.label).join(', ')} for the load (targeting ~70% utilization) — queueing delay is what was eating the tail.` }
    }
    const hottest = nodes.filter(n => stats[n.id]).sort((a, b) => (stats[b.id]?.util || 0) - (stats[a.id]?.util || 0))[0]
    if (!hottest) return null
    return { nodes: bump(n => n.id === hottest.id), note: `⚡ Added a replica to ${hottest.label}, the hottest component — if p99 stays high, the latency now lives in chain depth, which is a design conversation, not a slider.` }
  }
  return null
}
