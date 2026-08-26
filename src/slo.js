// SLO & error budget math plus a Production Readiness Review derived from
// the live graph. The vocabulary is deliberately the industry's (SRE
// workbook): an SLO target buys a monthly error budget; the live failure
// rate burns it at a multiple; fast burn pages a human. The PRR is the
// checklist a Staff+ review runs before a launch gets a green light.

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
    { ok: spofs.length === 0, t: 'No single point of failure on the hot path', d: spofs.length ? `${spofs.map(n => n.label).join(', ')} run${spofs.length === 1 ? 's' : ''} one replica with live traffic — one crash is an outage.` : 'Every component taking traffic has a second replica to fail over to.' },
    { ok: has('gateway') || has('lb'), t: 'A managed front door', d: has('gateway') || has('lb') ? 'Traffic enters through a gateway or balancer — one place for limits, auth and shedding.' : 'Clients hit services directly: no seam for rate limits, auth or load shedding when it matters.' },
    { ok: has('monitor') || has('otel') || has('tsdb'), t: 'Observability exists', d: has('monitor') || has('otel') || has('tsdb') ? 'Metrics/traces are collected — an incident can be seen, not just felt.' : 'Nothing collects metrics or traces: the first alert will be a customer.' },
    { ok: avail >= target, t: 'Architecture can meet the target at all', d: avail >= target ? `Composed availability ${(avail * 100).toFixed(3)}% clears the ${(target * 100).toFixed(2)}% target structurally.` : `Composed availability ${(avail * 100).toFixed(3)}% cannot reach ${(target * 100).toFixed(2)}% no matter how well it is operated — add redundancy where it is thinnest.` },
    { ok: burn <= 1, t: 'Error budget is not burning', d: burn <= 1 ? 'At current traffic the failure rate spends within budget.' : `Burning at ${burn.toFixed(1)}× — the month's budget lasts ~${exhaustDays.toFixed(1)} days at this rate.` },
    { ok: p99 > 0 && p99 < 2000, t: 'Tail latency is sane', d: p99 > 0 && p99 < 2000 ? `p99 ~${Math.round(p99)}ms leaves headroom under a 2s user ceiling.` : p99 >= 2000 ? `p99 ~${Math.round(p99)}ms — past the point users call it down.` : 'Run the simulation to measure the tail.' },
  ]
  const ready = prr.every(x => x.ok)
  return { target, budgetMin, avail, success, burn, exhaustDays, prr, ready, spofCount: spofs.length }
}
