// Chaos engineering fault library.
// Each fault compiles to simulator effects:
//   capMul  — multiplies effective capacity (1 = untouched, 0 = dead)
//   latMul  — multiplies service latency
//   drop    — fraction of arriving traffic lost outright
//   noCache — collapses a cache's hit ratio to zero
//   cut     — severs edges (network partitions, port blocks, DNS/TLS failure)
//   rpsMul  — multiplies the traffic entering the whole system
import { CATALOG } from './catalog.js'

const STORAGE = ['sql', 'nosql', 'blob', 'lake', 'warehouse', 'search', 'cache', 'backup']
const COMPUTE = ['web', 'app', 'micro', 'ws', 'worker', 'bff', 'saga', 'k8s', 'etl', 'ml', 'llm']
const NET = ['lb', 'gateway', 'cdn', 'gslb', 'waf', 'edge', 'mesh', 'graphql', 'tenant', 'dns']

export const FAULTS = [
  // ───────────── Infrastructure ─────────────
  { id: 'az', icon: '🧱', name: 'Availability Zone', group: 'Infrastructure', scope: 'global', secs: 20,
    desc: 'One AZ goes dark. Every multi-replica tier loses roughly a third of its instances at once.',
    hint: 'An availability zone is gone. Spread replicas across at least three zones so losing one costs a third, not everything.',
    fix: { kind: 'scale' },
    effect: () => ({ all: { capMul: 0.66 } }) },
  { id: 'dc', icon: '🏢', name: 'Data Center', group: 'Infrastructure', scope: 'global', secs: 25,
    desc: 'A whole region/data centre is lost. Half of all capacity disappears and what remains queues.',
    hint: 'A whole region is down. Size the surviving region to carry the load, or fail traffic over to it.',
    fix: { kind: 'scale' },
    effect: () => ({ all: { capMul: 0.5, latMul: 1.6 } }) },
  { id: 'crash', icon: '💥', name: 'Instance Crash', group: 'Infrastructure', scope: 'node', secs: 12,
    desc: 'One instance of the target dies. Survivors absorb its share until it restarts.',
    hint: 'Instances die routinely. Run enough replicas that losing one is absorbed by the rest.',
    fix: { kind: 'scale' },
    effect: n => ({ node: { capMul: Math.max(0, ((n.replicas || 1) - 1) / (n.replicas || 1)) } }) },
  { id: 'slow', icon: '🐢', name: 'Instance Slow', group: 'Infrastructure', scope: 'node', secs: 18,
    desc: 'A grey failure: the instance still answers health checks but responds 5× slower, so it also serves far less traffic.',
    hint: 'A grey failure still passes health checks. Add headroom, and make the check measure latency so it ejects the slow instance.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { latMul: 5, capMul: 0.6 } }) },
  { id: 'disk', icon: '💾', name: 'Disk Failure', group: 'Infrastructure', scope: 'node', prefer: STORAGE, secs: 20,
    desc: 'A volume dies. Throughput halves and every read pays a rebuild penalty.',
    hint: 'Volume failure halves throughput. Add replicas, and make sure a backup exists before you need it.',
    fix: { kind: 'attach', type: 'backup' },
    effect: () => ({ node: { capMul: 0.5, latMul: 2.5 } }) },
  { id: 'corrupt', icon: '🧬', name: 'Disk Corruption', group: 'Infrastructure', scope: 'node', prefer: STORAGE, secs: 20,
    desc: 'Silent bit rot: a slice of reads returns garbage and is rejected downstream.',
    hint: 'Corrupt reads need checksums and a restore path — attach backup and archive.',
    fix: { kind: 'attach', type: 'backup' },
    effect: () => ({ node: { drop: 0.08, latMul: 1.4 } }) },
  { id: 'iops', icon: '📉', name: 'Storage IOPS', group: 'Infrastructure', scope: 'node', prefer: STORAGE, secs: 20,
    desc: 'Burst credits exhausted — IOPS throttled to a fraction of provisioned.',
    hint: 'IOPS is throttled. Move the hot reads into a cache rather than buying more disk.',
    fix: { kind: 'insert', type: 'cache' },
    effect: () => ({ node: { capMul: 0.3, latMul: 3 } }) },
  { id: 'fs', icon: '🔒', name: 'File System', group: 'Infrastructure', scope: 'node', secs: 15,
    desc: 'Filesystem remounted read-only. Writes fail; reads limp on.',
    hint: 'The filesystem is read-only. Replicas let you eject the bad instance and keep writing.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.6, drop: 0.15 } }) },
  { id: 'cpu', icon: '🔥', name: 'VM CPU', group: 'Infrastructure', scope: 'node', prefer: COMPUTE, secs: 18,
    desc: 'CPU pinned at 100% — noisy neighbour or a runaway loop.',
    hint: 'CPU is saturated. Scale out — you cannot make a single instance faster.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.35, latMul: 3 } }) },
  { id: 'host', icon: '🛠️', name: 'Host Hardware', group: 'Infrastructure', scope: 'node', secs: 22,
    desc: 'The underlying host fails and takes several co-located instances with it.',
    hint: 'A host took several instances with it. Spread across hosts and add replicas.',
    fix: { kind: 'scale' },
    effect: n => ({ node: { capMul: Math.max(0, ((n.replicas || 1) - 2) / (n.replicas || 1)) } }) },

  // ───────────── Network ─────────────
  { id: 'partition', icon: '🌊', name: 'Network Partition', group: 'Network', scope: 'node', secs: 18, needsOutbound: true,
    desc: 'One node is cut off downstream: it can no longer reach anything it depends on.',
    hint: 'The link is severed. Restore it, then design a retry and a fallback path for next time.',
    fix: { kind: 'restore' },
    effect: () => ({ node: {}, cutFrom: true }) },
  { id: 'region', icon: '🪐', name: 'Cross-Region Loss', group: 'Network', scope: 'global', secs: 20,
    desc: 'The long-haul links go: the longest connections in the design are severed and traffic strands.',
    hint: 'Long-haul links dropped. Restore them and keep a regional copy so cross-region is never on the hot path.',
    fix: { kind: 'restore' },
    effect: () => ({ cutLongFrac: 0.35, all: { latMul: 1.4 } }) },
  { id: 'packet', icon: '📦', name: 'Packet Loss', group: 'Network', scope: 'global', secs: 18,
    desc: '5% packet loss everywhere. Retries hide some of it and inflate the rest.',
    hint: 'Packet loss inflates retries. Add headroom so the retries do not tip the tier over.',
    fix: { kind: 'scale' },
    effect: () => ({ all: { drop: 0.05, latMul: 1.5 } }) },
  { id: 'latency', icon: '⏳', name: 'High Latency', group: 'Network', scope: 'global', secs: 18,
    desc: 'Every hop gains latency. Watch p99 go before capacity does.',
    hint: 'Every hop got slower. Cut hops with a cache rather than adding capacity.',
    fix: { kind: 'insert', type: 'cache' },
    effect: () => ({ all: { latMul: 4 } }) },
  { id: 'bandwidth', icon: '📡', name: 'Bandwidth Throttle', group: 'Network', scope: 'global', secs: 18,
    desc: 'Links throttled — effective throughput halves across the network tier.',
    hint: 'Throughput is throttled. Cache closer to the user so fewer bytes cross the link.',
    fix: { kind: 'insert', type: 'cache' },
    effect: () => ({ types: NET, capMul: 0.45, latMul: 2 }) },
  { id: 'flap', icon: '⚖️', name: 'Connection Flap', group: 'Network', scope: 'node', secs: 20,
    desc: 'Connections drop and re-establish repeatedly; a third of requests die mid-flight.',
    hint: 'Connections keep dropping. Add replicas and make clients retry idempotently.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { drop: 0.33, latMul: 1.8 } }) },
  { id: 'lbfail', icon: '⚓', name: 'Load Balancer', group: 'Network', scope: 'node', prefer: ['lb', 'gslb', 'gateway'], secs: 18,
    desc: 'The balancer degrades — uneven distribution and a third of capacity unusable.',
    hint: 'The balancer is degraded. Run more than one — a single balancer is a single point of failure.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.35, latMul: 2 } }) },
  { id: 'port', icon: '🔌', name: 'Backend Port', group: 'Network', scope: 'node', secs: 16, needsOutbound: true,
    desc: 'A security-group change blocks the port to one downstream dependency.',
    hint: 'A port is blocked to a dependency. Restore the link and alert on connectivity, not just health.',
    fix: { kind: 'restore' },
    effect: () => ({ cutOne: true }) },
  { id: 'health', icon: '🩺', name: 'Health Check', group: 'Network', scope: 'node', secs: 18,
    desc: 'Health checks wrongly mark healthy instances down, then flap them back in.',
    hint: 'Health checks are ejecting good instances. Add headroom while you fix the check thresholds.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.4, drop: 0.1 } }) },
  { id: 'tls', icon: '🔐', name: 'TLS Certificate', group: 'Network', scope: 'node', prefer: [...NET], secs: 15,
    desc: 'The certificate expired. Every handshake at this hop fails — the classic self-inflicted outage.',
    hint: 'The certificate expired. Restore the path, then probe from outside so you find this before users do.',
    fix: { kind: 'attach', type: 'synthetic' },
    effect: () => ({ node: { drop: 1 } }) },
  { id: 'dns', icon: '🌐', name: 'DNS Resolution', group: 'Network', scope: 'global', secs: 15,
    desc: 'Resolution fails. Most clients cannot find you at all, cached entries carry the rest.',
    hint: 'Resolution failed. Probe from outside your network and keep TTLs short enough to fail over.',
    fix: { kind: 'attach', type: 'synthetic' },
    effect: () => ({ entry: { drop: 0.7 } }) },

  // ───────────── Application ─────────────
  { id: 'leak', icon: '🧠', name: 'Memory Leak', group: 'Application', scope: 'node', prefer: COMPUTE, secs: 22,
    desc: 'Heap creeping up: GC pressure eats throughput and adds latency until restart.',
    hint: 'A leak means restarts. Add replicas so a rolling restart is invisible to users.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.5, latMul: 2.5 } }) },
  { id: 'oom', icon: '💀', name: 'Out of Memory', group: 'Application', scope: 'node', prefer: COMPUTE, secs: 14,
    desc: 'OOM killer fires. The instance is gone until the scheduler brings it back.',
    hint: 'The OOM killer fired. Add replicas and cap memory per instance so one request cannot take the process.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.2, drop: 0.25 } }) },
  { id: 'threads', icon: '🧵', name: 'Thread Pool', group: 'Application', scope: 'node', prefer: COMPUTE, secs: 18,
    desc: 'Pool exhausted — requests queue for a worker that never frees up.',
    hint: 'The pool is exhausted. More replicas, and bound the queue so it sheds load instead of stalling.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.25, latMul: 4 } }) },
  { id: 'deadlock', icon: '🔗', name: 'Deadlock', group: 'Application', scope: 'node', secs: 16,
    desc: 'Two transactions hold what the other needs. Throughput collapses to almost nothing.',
    hint: 'Deadlock collapses throughput. Replicas are a stopgap; the real fix is consistent lock ordering.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { capMul: 0.08, latMul: 8 } }) },
  { id: 'stampede', icon: '▦', name: 'Cache Stampede', group: 'Application', scope: 'node', prefer: ['cache', 'cdn'], secs: 18,
    desc: 'Keys expire together, hit ratio drops to zero and the full load lands on the origin while the cache itself thrashes.',
    hint: 'Keys expired together. More cache replicas, and coalesce concurrent misses into one origin fetch.',
    fix: { kind: 'scale' },
    effect: () => ({ node: { noCache: true, latMul: 2, capMul: 0.6 } }) },
  { id: 'errors', icon: '⚡', name: 'Error Storm', group: 'Application', scope: 'node', secs: 16,
    desc: 'A bad deploy: half the responses are 5xx and clients retry, making it worse.',
    hint: 'A 5xx storm plus client retries is self-amplifying. Put a rate limiter in front of it.',
    fix: { kind: 'insert', type: 'ratelimiter' },
    effect: () => ({ node: { drop: 0.5 }, rpsMul: 1.3 }) },

  // ───────────── Global ─────────────
  { id: 'surge', icon: '☀️', name: 'Traffic Surge', group: 'Global', scope: 'global', secs: 20,
    desc: 'A campaign, a flash sale or a celebrity link: incoming traffic jumps 5×.',
    hint: 'Traffic jumped. Right-size for the surge, or shed load at the edge before it reaches you.',
    fix: { kind: 'scale' },
    effect: () => ({ rpsMul: 5 }) },

  // ───────────── Distributed systems ─────────────
  // These leave the node running, which is what makes them hard: a timeout
  // cannot tell a paused process from a dead one.
  { id: 'splitbrain', icon: '🪓', name: 'Split Brain', group: 'Distributed', scope: 'global', secs: 25,
    desc: 'The network splits in two. Both halves stay healthy and each believes the other has died.',
    hint: 'Both halves are up and cannot see each other. With a leader, both may promote one. Decide in advance which side stops accepting writes.',
    fix: { kind: 'none' },
    effect: () => ({ all: { capMul: 0.5, drop: 0.12 } }) },
  { id: 'clockskew', icon: '🕰️', name: 'Clock Skew', group: 'Distributed', scope: 'node', secs: 30,
    desc: 'One node clock drifts ahead of the others. Nothing looks broken.',
    hint: 'Any last-write-wins scheme now silently prefers the node with the fast clock, whatever actually happened first. Do not order events by wall clock.',
    fix: { kind: 'none' },
    effect: () => ({ node: { latMul: 1.05 } }) },
  { id: 'pause', icon: '⏸️', name: 'Process Pause', group: 'Distributed', scope: 'node', secs: 15,
    desc: 'A node freezes for seconds — garbage collection, a hypervisor pause — then resumes as if nothing happened.',
    hint: 'Its lease or lock may have expired while it was frozen. It wakes still believing it holds them, and writes into a world that moved on.',
    fix: { kind: 'none' },
    effect: () => ({ node: { latMul: 8, drop: 0.4 } }) },
  { id: 'asymmetric', icon: '⇥', name: 'One-Way Link Failure', group: 'Distributed', scope: 'node', secs: 20,
    desc: 'A can reach B, but B cannot reach A. Failure detectors disagree about who is alive.',
    hint: 'A timeout cannot tell this apart from a slow node. Anything that votes on liveness can reach two different answers at once.',
    fix: { kind: 'none' },
    effect: () => ({ node: { drop: 0.5 } }) },
]

export const FAULT_GROUPS = ['Infrastructure', 'Network', 'Distributed', 'Application', 'Global']
export const faultById = id => FAULTS.find(f => f.id === id)

// Which active fault is hurting this node, if any — a fault aimed at it wins over
// a system-wide one, so the hint points at the specific problem.
export function faultOnNode(active, nodeId) {
  const aimed = active.find(a => a.targetId === nodeId)
  if (aimed) return faultById(aimed.faultId)
  const global = active.find(a => !a.targetId)
  return global ? faultById(global.faultId) : null
}

// Choose a sensible victim when the user has not selected one.
export function pickTarget(fault, nodes, sim, edges = []) {
  if (!nodes.length) return null
  let usable = nodes.filter(n => !CATALOG[n.type]?.source)
  // faults that sever links are meaningless on a node with nothing downstream
  if (fault.needsOutbound) {
    const withOut = usable.filter(n => edges.some(e => e.from === n.id))
    if (withOut.length) usable = withOut
  }
  if (!usable.length) return null
  const pool = fault.prefer ? usable.filter(n => fault.prefer.includes(n.type)) : usable
  const list = pool.length ? pool : usable
  // busiest first — failing an idle node teaches you nothing
  return list.slice().sort((a, b) => (sim?.stats?.[b.id]?.in || 0) - (sim?.stats?.[a.id]?.in || 0))[0]
}

// Compile the active faults into the effect bundle the simulator understands.
export function compileFaults(active, nodes, edges) {
  const node = {}
  const cut = new Set()
  let rpsMul = 1
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const merge = (id, e) => {
    const cur = node[id] || { capMul: 1, latMul: 1, drop: 0, noCache: false }
    node[id] = {
      capMul: cur.capMul * (e.capMul ?? 1),
      latMul: cur.latMul * (e.latMul ?? 1),
      drop: 1 - (1 - cur.drop) * (1 - (e.drop ?? 0)),
      noCache: cur.noCache || !!e.noCache,
    }
  }

  for (const a of active) {
    const f = faultById(a.faultId)
    if (!f) continue
    const target = a.targetId ? byId[a.targetId] : null
    const eff = f.effect(target || {})

    if (eff.rpsMul) rpsMul *= eff.rpsMul
    if (eff.all) for (const n of nodes) if (!CATALOG[n.type]?.source) merge(n.id, eff.all)
    if (eff.types) {
      const hit = nodes.filter(n => eff.types.includes(n.type))
      // no networking components in this design? the throttle still hits every link
      const victims = hit.length ? hit : nodes.filter(n => !CATALOG[n.type]?.source)
      for (const n of victims) merge(n.id, eff)
    }
    if (eff.entry) {
      for (const e of edges) if (CATALOG[byId[e.from]?.type]?.source) merge(e.to, eff.entry)
    }
    if (eff.cutLongFrac) {
      const measured = edges
        .map(e => {
          const a2 = byId[e.from], b2 = byId[e.to]
          return a2 && b2 ? { id: e.id, d: Math.hypot(b2.x - a2.x, b2.y - a2.y) } : null
        })
        .filter(Boolean)
        .sort((p, q) => q.d - p.d)
      const n = Math.max(1, Math.round(measured.length * eff.cutLongFrac))
      for (const m of measured.slice(0, n)) cut.add(m.id)
    }
    if (target) {
      if (eff.node) merge(target.id, eff.node)
      if (eff.cutFrom) for (const e of edges) if (e.from === target.id) cut.add(e.id)
      if (eff.cutOne) {
        const out = edges.find(e => e.from === target.id)
        if (out) cut.add(out.id)
      }
    }
  }
  return { node, cut, rpsMul }
}

// One actionable line for a fault on a node: what to do, right now, on the
// canvas. Derived from the fault's structured fix so hints can never drift
// from what Improve actually applies.
export function fixSummary(fault, node, catalogName = t => t) {
  if (!fault) return ''
  const label = node?.label || 'the target'
  const r = Math.max(1, node?.replicas || 1)
  const k = fault.fix?.kind
  if (k === 'scale') {
    return r === 1
      ? `${label} runs a single replica — a SPOF. Fix: select it and raise replicas so losing one is absorbed.`
      : `${label} has ${r} replicas; survivors absorb the hit. If p99 climbs, one more replica buys headroom.`
  }
  if (k === 'attach') return `Fix: attach a ${catalogName(fault.fix.type)} to ${label} — ✨ Improve has it as one click.`
  if (k === 'insert') return `Fix: put a ${catalogName(fault.fix.type)} in front of ${label} — ✨ Improve has it as one click.`
  return fault.hint || ''
}
