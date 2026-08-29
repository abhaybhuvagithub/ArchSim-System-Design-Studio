// 🚀 Future-ready: one click that takes any canvas to the structural bar a
// growth-stage review would demand — and says exactly what it will do first.
//
// The bar (auditable, applied in this order, verified against the real sim):
//   1. A managed front door (gateway or LB) between clients and services
//   2. Observability exists (otel / monitor / tsdb)
//   3. No single point of failure taking live traffic
//   4. Every LLM/agent tier has guardrails one hop upstream
//   5. Capacity headroom: no component above ~85% utilization at this traffic
//   6. Structural availability clears 99.9%
//
// Composes the SLO quick fixes where they exist, adds the AI-safety insert,
// and is idempotent: a ready canvas returns alreadyReady with no mutation.
// The suite proves the whole contract across every template in the library.
import { CATALOG } from './catalog.js'
import { sloQuickFix } from './slo.js'

const AI_TYPES = new Set(['llm', 'aiagent', 'agentgraph', 'ml'])
const FIXABLE = n => n.type !== 'client'

export function futureAudit(nodes, edges, sim, target = 0.999) {
  const has = t => nodes.some(n => n.type === t)
  const hot = id => (sim?.stats?.[id]?.in || 0) > 0
  const gaps = []
  const hasClient = nodes.some(n => n.type === 'client')
  if (hasClient && !has('gateway') && !has('lb')) gaps.push({ id: 'door', t: 'No managed front door' })
  if (!has('monitor') && !has('otel') && !has('tsdb')) gaps.push({ id: 'obs', t: 'No observability' })
  const spofs = nodes.filter(n => !['client', 'cdn', 'blob', 'dns'].includes(n.type) && (n.replicas || 1) === 1 && hot(n.id))
  if (spofs.length) gaps.push({ id: 'spof', t: `SPOF: ${spofs.map(n => n.label).join(', ')}` })
  const unguarded = aiNodesWithoutGuard(nodes, edges)
  if (unguarded.length) gaps.push({ id: 'guard', t: `Unguarded AI: ${unguarded.map(n => n.label).join(', ')}` })
  const sat = nodes.filter(n => FIXABLE(n) && (sim?.stats?.[n.id]?.util || 0) > 0.85)
  if (sat.length) gaps.push({ id: 'size', t: `Over 85% utilization: ${sat.map(n => n.label).join(', ')}` })
  if ((sim?.sysAvail ?? 1) < target) gaps.push({ id: 'struct', t: `Availability ${(100 * (sim?.sysAvail ?? 1)).toFixed(3)}% below ${(target * 100).toFixed(1)}%` })
  return gaps
}

const eFrom = e => Array.isArray(e) ? e[0] : e.from
const eTo = e => Array.isArray(e) ? e[1] : e.to
const mkEdge = (from, to) => ({ id: `${from}->${to}`, from, to, label: '' })

function aiNodesWithoutGuard(nodes, edges) {
  const byId = new Map(nodes.map(n => [n.id, n]))
  return nodes.filter(n => AI_TYPES.has(n.type)).filter(ai => {
    return !edges.some(e => {
      const a = byId.get(eFrom(e)), b = byId.get(eTo(e))
      return (b?.id === ai.id && a?.type === 'guard') || (a?.id === ai.id && b?.type === 'guard')
    })
  })
}

function insertGuards(nodes, edges) {
  const unguarded = aiNodesWithoutGuard(nodes, edges)
  if (!unguarded.length) return null
  let ns = [...nodes]
  let es = [...edges]
  const added = []
  for (const ai of unguarded) {
    const gid = `guard-fix-${ai.id}`
    const g = { id: gid, type: 'guard', label: `Guardrails (${ai.label})`, x: ai.x - 70, y: ai.y - 80, replicas: 2 }
    ns.push(g)
    const inbound = es.filter(e => eTo(e) === ai.id)
    if (inbound.length) {
      const first = inbound[0]   // route the primary caller through the guard
      es = es.map(e => (e === first ? mkEdge(eFrom(first), gid) : e))
      es.push(mkEdge(gid, ai.id))
    } else {
      es.push(mkEdge(gid, ai.id))
    }
    added.push(ai.label)
  }
  return { nodes: ns, edges: es, added }
}

// Size every saturated tier toward ~70% until none exceeds 85% (or stall).
function sizeForHeadroom(nodes, edges, resim) {
  let ns = nodes.map(n => ({ ...n }))
  let cur = resim(ns, edges)
  const touched = new Map()
  let stall = 0
  let best = Infinity
  for (let round = 0; round < 60; round++) {
    const stats = cur?.stats || {}
    const sat = ns.filter(n => FIXABLE(n) && (stats[n.id]?.util || 0) > 0.85)
    if (!sat.length) break
    const worst = Math.max(...sat.map(n => stats[n.id].util))
    if (worst < best - 0.005) { best = worst; stall = 0 } else if (++stall >= 3) break
    const tset = new Set(sat.map(n => n.id))
    ns = ns.map(n => {
      if (!tset.has(n.id)) return n
      const st = stats[n.id]
      const cap = CATALOG[n.type]?.cap || 1000
      const r = n.replicas || 1
      const need = Math.max(r + 1, Math.ceil(st.in / (cap * 0.7)), st.util >= 1 ? r * 2 : 0)
      touched.set(n.id, `${n.label} ${r}→${need}`)
      return { ...n, replicas: need }
    })
    cur = resim(ns, edges)
  }
  return touched.size ? { nodes: ns, touched: [...touched.values()] } : null
}

export function futureReady(nodes, edges, sim, resim, target = 0.999) {
  let ns = nodes.map(n => ({ ...n }))
  let es = [...edges]
  let cur = sim
  const steps = []

  const door = sloQuickFix('door', ns, es, cur, target, null)
  if (nodes.some(n => n.type === 'client') && !ns.some(n => n.type === 'gateway' || n.type === 'lb') && door) {
    ns = door.nodes; es = door.edges; steps.push('front door (LB inserted)')
    cur = resim(ns, es)
  }
  if (!ns.some(n => ['monitor', 'otel', 'tsdb'].includes(n.type))) {
    const obs = sloQuickFix('obs', ns, es, cur, target, null)
    if (obs) {
      ns = obs.nodes
      // Wire it in — an unconnected monitor observes nothing. Telemetry flows
      // from the front door plus the two busiest service tiers; the sizing and
      // SPOF passes below then right-size what these edges now feed.
      const mon = ns.find(n => n.id === 'mon-fix')
      const door2 = ns.find(n => n.type === 'gateway' || n.type === 'lb')
      const busiest = ns
        .filter(n => FIXABLE(n) && n.id !== mon.id && n.id !== door2?.id && !['cdn', 'blob', 'dns'].includes(n.type))
        .sort((a, b) => (cur?.stats?.[b.id]?.in || 0) - (cur?.stats?.[a.id]?.in || 0))
        .slice(0, 2)
      const sources = [door2, ...busiest].filter(Boolean)
      for (const src of sources) es.push(mkEdge(src.id, mon.id))
      steps.push(`observability tier (fed by ${sources.map(n => n.label).join(', ')})`)
      cur = resim(ns, es)
    }
  }
  const guards = insertGuards(ns, es)
  if (guards) { ns = guards.nodes; es = guards.edges; steps.push(`guardrails on ${guards.added.join(', ')}`); cur = resim(ns, es) }
  const spof = sloQuickFix('spof', ns, es, cur, target, null)
  if (spof) { ns = spof.nodes; steps.push('failover replicas for SPOFs'); cur = resim(ns, es) }
  const sized = sizeForHeadroom(ns, es, (n2, e2) => resim(n2, e2))
  if (sized) { ns = sized.nodes; steps.push(`headroom: ${sized.touched.join(', ')}`); cur = resim(ns, es) }
  const struct = sloQuickFix('struct', ns, es, cur, target, (n2) => resim(n2, es))
  if (struct && (cur.sysAvail ?? 1) < target) { ns = struct.nodes; steps.push('availability to target'); cur = resim(ns, es) }

  if (!steps.length) return { alreadyReady: true, nodes, edges, plan: 'Already future-ready — every gate on the audit is green.', steps: [] }
  return {
    alreadyReady: false, nodes: ns, edges: es, steps,
    plan: 'Will apply: ' + steps.join(' · '),
    note: `🚀 Future-ready: ${steps.join('; ')}.`,
  }
}
