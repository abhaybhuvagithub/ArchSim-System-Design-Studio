// Why a tier is red, orange or offline — and the single edit that fixes it.
// The capacity report, the hover card and the exported document all read from
// here, so the diagnosis is worded the same everywhere.
import { CATALOG } from './catalog.js'

// Utilisation the fix aims for. 55% leaves room for a spike without paying
// for headroom nobody uses.
const TARGET = 0.55
const MAX_REPLICAS = 64

// Replicas needed to sit at TARGET, allowing for capacity a fault has taken away.
export function replicasFor(node, inRps, capMul = 1) {
  const spec = CATALOG[node.type]
  if (!spec?.cap) return node.replicas || 1
  const effective = spec.cap * Math.max(capMul, 0.15)
  return Math.max((node.replicas || 1) + 1, Math.min(MAX_REPLICAS, Math.ceil(inRps / (effective * TARGET))))
}

// One tier's diagnosis, or null when it is healthy.
// row comes from capacityReport(); fx is the compiled chaos effect set.
export function diagnose(row, node, sim, fx = null, faults = []) {
  if (!row || !node) return null
  const spec = CATALOG[node.type] || {}
  if (spec.source) return null

  const st = sim?.stats?.[node.id] || {}
  const util = row.util ?? st.util ?? 0
  const inRps = row.in ?? st.in ?? 0
  const replicas = row.replicas ?? node.replicas ?? 1
  const capMul = fx?.node?.[node.id]?.capMul ?? 1
  const hitByChaos = capMul < 1 || (fx?.node?.[node.id]?.drop ?? 0) > 0 || faults.some(f => f.targetId === node.id)
  const chaosNote = hitByChaos ? ' A chaos fault is taking capacity away from it right now, so it needs more instances than usual to stand up.' : ''
  const want = replicasFor(node, inRps, capMul)

  // capMul at (or near) zero means the fault has taken all of its capacity —
  // no replica count divides into that, so treat it as offline rather than
  // quoting a scale target that cannot work.
  const dead = capMul <= 0.02

  if (row.down || dead) {
    return {
      level: 'down',
      icon: '⛔',
      title: `${row.label} is ${row.down ? 'offline' : 'serving nothing'}`,
      why: `Every request routed through ${row.label} is being dropped, and anything downstream of it is starved. `
        + (hitByChaos
          ? 'A chaos fault has taken its capacity to zero — scaling cannot divide into nothing, so this is either ridden out or designed around.'
          : 'The traffic has nowhere else to go because nothing else serves this role.')
        + (replicas < 2 ? ' It is also running a single instance, which is why one failure took the whole tier with it.' : ''),
      fix: replicas < 2
        ? { kind: 'scale', to: 2, label: 'Run a second instance so one loss is survivable' }
        : { kind: 'recover', label: 'Bring it back' },
    }
  }

  if (util >= 1) {
    const shed = st.dropped || 0
    return {
      level: 'critical',
      icon: '🔴',
      title: `${row.label} is over capacity`,
      why: `It is taking ${fmtRps(inRps)} against ${fmtRps(spec.cap * replicas * capMul)} of capacity across ${replicas} instance${replicas > 1 ? 's' : ''}. `
        + `${shed > 0 ? `Roughly ${fmtRps(shed)} is being shed outright` : 'The queue never drains'}, and latency past 100% utilisation is unbounded — this is what a p99 blow-up looks like before the errors start.${chaosNote}`,
      fix: { kind: 'scale', to: want, label: `Scale to ${want}× instances` },
    }
  }

  if (util > 0.8) {
    return {
      level: 'warn',
      icon: '🟠',
      title: `${row.label} is a bottleneck`,
      why: `At ${(util * 100).toFixed(0)}% utilisation the queue is already the dominant part of its response time — the 1/(1−utilisation) curve means the next 10% of traffic costs far more latency than the last 10% did. `
        + `p99 degrades here long before anything is dropped.${chaosNote}`,
      fix: { kind: 'scale', to: want, label: `Scale to ${want}× instances` },
    }
  }

  if (replicas === 1 && inRps > 0 && spec.avail != null) {
    return {
      level: 'spof',
      icon: '⚠️',
      title: `${row.label} is a single point of failure`,
      why: `It has headroom, but there is exactly one of it on a live path. Losing that instance takes ${(100 - (spec.avail * 100)).toFixed(1)}% of the month with it — a second instance turns the outage into a blip.`,
      fix: { kind: 'scale', to: 2, label: 'Run a second instance' },
    }
  }

  return null
}

// Every unhealthy tier, worst first.
export function diagnoseAll(cap, nodes, sim, fx = null, faults = []) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const order = { down: 0, critical: 1, warn: 2, spof: 3 }
  return (cap?.rows || [])
    .map(r => {
      const d = diagnose(r, byId[r.id], sim, fx, faults)
      return d ? { ...d, id: r.id, row: r } : null
    })
    .filter(Boolean)
    .sort((a, b) => order[a.level] - order[b.level] || b.row.util - a.row.util)
}

// Short form for the hover card — one line, no prose.
export function healthChip(d) {
  if (!d) return null
  return {
    down: 'Offline — traffic through it is being dropped',
    critical: 'Over capacity — requests are queueing and being shed',
    warn: 'Bottleneck — queueing dominates its response time',
    spof: 'Single instance — no redundancy on a live path',
  }[d.level]
}

function fmtRps(n) {
  if (!isFinite(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M rps'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k rps'
  return n.toFixed(n >= 10 ? 0 : 1) + ' rps'
}
