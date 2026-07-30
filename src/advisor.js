// Architecture advisor: reviews the graph and returns suggestions.
// Every suggestion carries apply(nodes, edges) -> {nodes, edges, focus} | null.
// apply() only closes over ids, never over graph objects, so suggestions can be
// folded one after another (Apply all) without going stale.
import { CATALOG } from './catalog.js'
import { simulate, capacityReport } from './sim.js'

const NODE_W = 118, NODE_H = 46
let seq = 0
const nid = t => `${t}_adv${(seq++).toString(36)}${Date.now().toString(36).slice(-3)}`

const COMPUTE = ['web', 'app', 'micro', 'ws', 'bff', 'worker', 'saga']
const EDGEY = ['cdn', 'lb', 'gateway', 'ratelimiter', 'mesh']
const DBS = ['sql', 'nosql']
const RANK = { high: 0, med: 1, low: 2 }
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// ---------- graph helpers ----------
function freeSpot(nodes, x, y) {
  let nx = Math.round(x), ny = Math.round(y), guard = 0
  const clash = () => nodes.some(n => Math.abs(n.x - nx) < NODE_W + 14 && Math.abs(n.y - ny) < NODE_H + 14)
  while (clash() && guard++ < 60) { ny += NODE_H + 24; if (guard % 8 === 0) { nx += 26; ny -= (NODE_H + 24) * 8 } }
  return { x: nx, y: ny }
}

// Splice a new node onto an existing edge: from -> NEW -> to
function insertOnEdge(nodes, edges, fromId, toId, type, label, replicas = 1) {
  const f = nodes.find(n => n.id === fromId), t = nodes.find(n => n.id === toId)
  if (!f || !t) return null
  if (!edges.some(e => e.from === fromId && e.to === toId)) return null
  const pos = freeSpot(nodes, (f.x + t.x) / 2, (f.y + t.y) / 2)
  const id = nid(type)
  const node = { id, type, label: label || CATALOG[type].name, x: pos.x, y: pos.y, replicas }
  const next = edges.filter(e => !(e.from === fromId && e.to === toId))
  next.push({ id: `${fromId}->${id}`, from: fromId, to: id, label: '' })
  next.push({ id: `${id}->${toId}`, from: id, to: toId, label: '' })
  return { nodes: [...nodes, node], edges: next, focus: id }
}

// Attach a brand-new node, wired from `fromIds` and into `toIds`
function attach(nodes, edges, { type, label, replicas = 1, x, y, fromIds = [], toIds = [] }) {
  if (![...fromIds, ...toIds].every(id => nodes.some(n => n.id === id))) return null
  const pos = freeSpot(nodes, x, y)
  const id = nid(type)
  const node = { id, type, label: label || CATALOG[type].name, x: pos.x, y: pos.y, replicas }
  const next = [...edges]
  for (const f of fromIds) if (!next.some(e => e.from === f && e.to === id)) next.push({ id: `${f}->${id}`, from: f, to: id, label: '' })
  for (const t of toIds) if (!next.some(e => e.from === id && e.to === t)) next.push({ id: `${id}->${t}`, from: id, to: t, label: '' })
  return { nodes: [...nodes, node], edges: next, focus: id }
}

// Attach a chain of nodes, each wired to the previous one
function attachChain(nodes, edges, fromId, specs) {
  if (fromId && !nodes.some(n => n.id === fromId)) return null
  let ns = nodes, es = edges, prev = fromId, focus = null
  for (const s of specs) {
    const r = attach(ns, es, { ...s, fromIds: prev ? [prev] : [] })
    if (!r) return null
    ns = r.nodes; es = r.edges; prev = r.focus; focus = focus || r.focus
  }
  return { nodes: ns, edges: es, focus }
}

function scaleTo(nodes, edges, id, replicas) {
  if (!nodes.some(n => n.id === id)) return null
  return { nodes: nodes.map(n => n.id === id ? { ...n, replicas } : n), edges, focus: id }
}

function connect(nodes, edges, fromId, toId) {
  if (fromId === toId) return edges
  if (!nodes.some(n => n.id === fromId) || !nodes.some(n => n.id === toId)) return edges
  if (edges.some(e => e.from === fromId && e.to === toId)) return edges
  return [...edges, { id: `${fromId}->${toId}`, from: fromId, to: toId, label: '' }]
}

// ---------- wiring intelligence ----------
// Who should normally call a component of this type, best candidate first.
const UPSTREAM = {
  dns: ['client'], cdn: ['client', 'dns'], lb: ['cdn', 'dns', 'client'],
  ratelimiter: ['lb', 'cdn', 'client', 'gateway'], gateway: ['ratelimiter', 'lb', 'cdn', 'client'],
  bff: ['cdn', 'lb', 'client'], mesh: ['gateway', 'bff', 'lb'],
  web: ['lb', 'cdn', 'gateway', 'client'], app: ['lb', 'gateway', 'mesh', 'bff', 'client'],
  micro: ['mesh', 'gateway', 'bff', 'saga', 'lb', 'client'], ws: ['lb', 'gateway', 'client'],
  worker: ['queue', 'kafka', 'scheduler', 'app', 'micro'], saga: ['gateway', 'bff', 'lb', 'app'],
  cache: ['app', 'micro', 'web', 'bff', 'ws', 'worker', 'saga', 'gateway'],
  sql: ['app', 'micro', 'web', 'worker', 'saga', 'etl'],
  nosql: ['app', 'micro', 'web', 'ws', 'worker', 'saga', 'etl'],
  search: ['app', 'micro', 'web', 'worker', 'etl'],
  blob: ['app', 'micro', 'web', 'ws', 'worker'],
  queue: ['app', 'micro', 'web', 'gateway', 'saga', 'scheduler'],
  kafka: ['app', 'micro', 'web', 'ws', 'gateway', 'saga', 'cdc'],
  cdc: ['sql', 'nosql'], etl: ['lake', 'kafka', 'queue', 'cdc', 'scheduler'],
  lake: ['etl', 'kafka', 'queue', 'cdc', 'worker'], warehouse: ['etl', 'lake', 'kafka'],
  bi: ['warehouse', 'lake', 'analytics'], analytics: ['kafka', 'queue', 'warehouse', 'lake'],
  ml: ['warehouse', 'lake', 'kafka', 'app', 'micro', 'gateway'],
  registry: ['mesh', 'micro', 'bff', 'gateway', 'app'], config: ['mesh', 'micro', 'app'],
  zk: ['micro', 'app', 'kafka'], monitor: ['app', 'micro', 'web', 'worker', 'gateway'],
  tracing: ['mesh', 'micro', 'app', 'gateway'],
}
// What a component of this type should normally call.
const DOWNSTREAM = {
  dns: ['cdn', 'lb', 'gateway'], cdn: ['lb', 'gateway', 'bff', 'web', 'app'],
  lb: ['gateway', 'ratelimiter', 'bff', 'web', 'app', 'micro', 'ws'],
  ratelimiter: ['gateway', 'app', 'micro', 'web'],
  gateway: ['mesh', 'saga', 'app', 'micro', 'web', 'ws'],
  bff: ['mesh', 'micro', 'app'], mesh: ['micro', 'app'],
  web: ['cache', 'app', 'sql', 'nosql', 'blob'],
  app: ['cache', 'sql', 'nosql', 'search', 'queue', 'kafka', 'blob'],
  micro: ['cache', 'sql', 'nosql', 'queue', 'kafka', 'search'],
  ws: ['cache', 'kafka', 'queue', 'nosql'],
  saga: ['micro', 'queue', 'kafka'], scheduler: ['worker', 'etl'],
  queue: ['worker', 'micro', 'app'], kafka: ['worker', 'micro', 'lake', 'etl', 'analytics'],
  worker: ['blob', 'sql', 'nosql', 'lake', 'cache'],
  cdc: ['kafka', 'queue', 'lake', 'etl'], etl: ['warehouse', 'lake'],
  lake: ['etl', 'warehouse', 'analytics', 'ml'], warehouse: ['bi', 'ml', 'analytics'],
  cache: ['sql', 'nosql', 'search'],
}
// Types that are wrong as a dead end — they exist to route traffic onward.
const PASSTHROUGH = ['dns', 'cdn', 'lb', 'ratelimiter', 'gateway', 'bff', 'mesh', 'saga', 'queue', 'kafka', 'cdc', 'etl', 'scheduler']
// When nothing suitable exists yet, create this instead of the first routing hop
// (prefer a component that actually does work over another indirection layer).
const CREATE_DOWN = {
  dns: 'cdn', cdn: 'lb', lb: 'app', ratelimiter: 'gateway', gateway: 'app', bff: 'micro',
  mesh: 'micro', saga: 'micro', queue: 'worker', kafka: 'worker', cdc: 'kafka',
  etl: 'warehouse', scheduler: 'worker',
}
const article = name => (/^[AEIOU]/i.test(name) ? 'an' : 'a')

function pickNearest(nodes, types, target, side) {
  let best = null, bestScore = Infinity
  types.forEach((t, rank) => {
    for (const n of nodes) {
      if (n.type !== t || n.id === target.id) continue
      const dx = n.x - target.x, dy = n.y - target.y
      let score = Math.abs(dx) + Math.abs(dy) * 0.6 + rank * 240
      if (side === 'left' && dx > 0) score += 300
      if (side === 'right' && dx < 0) score += 300
      if (score < bestScore) { bestScore = score; best = n }
    }
  })
  return best
}

// Decide how to wire `target` in. Returns a plan describing existing peers to use
// and, when there is no sensible peer at all, the component type to create.
export function planWiring(nodes, edges, target, want = 'both') {
  const outbound = edges.filter(e => e.from === target.id)
  const inbound = edges.filter(e => e.to === target.id)
  const isSource = !!CATALOG[target.type]?.source
  const plan = { from: null, to: null, createFrom: null, createTo: null }

  if ((want === 'both' || want === 'in') && !inbound.length && !isSource) {
    const cands = UPSTREAM[target.type] || []
    plan.from = pickNearest(nodes, cands, target, 'left')
    if (!plan.from && cands.length) plan.createFrom = cands[0]
  }
  if ((want === 'both' || want === 'out') && !outbound.length && PASSTHROUGH.includes(target.type)) {
    const cands = DOWNSTREAM[target.type] || []
    plan.to = pickNearest(nodes, cands, target, 'right')
    if (!plan.to && cands.length) plan.createTo = CREATE_DOWN[target.type] || cands[0]
  }
  return plan
}

function describe(plan) {
  const bits = []
  if (plan.from) bits.push(`wires ${plan.from.label} → it`)
  else if (plan.createFrom) bits.push(`adds ${article(CATALOG[plan.createFrom].name)} ${CATALOG[plan.createFrom].name} in front of it`)
  if (plan.to) bits.push(`wires it → ${plan.to.label}`)
  else if (plan.createTo) bits.push(`adds ${article(CATALOG[plan.createTo].name)} ${CATALOG[plan.createTo].name} after it`)
  return bits.join(' and ')
}

// Execute a wiring plan (re-resolved against the live graph by id/type)
function runPlan(nodes, edges, targetId, want) {
  const target = nodes.find(n => n.id === targetId)
  if (!target) return null
  const plan = planWiring(nodes, edges, target, want)
  let ns = nodes, es = edges, focus = targetId
  if (plan.createFrom) {
    const r = attach(ns, es, { type: plan.createFrom, x: target.x - NODE_W - 60, y: target.y, toIds: [targetId] })
    if (r) { ns = r.nodes; es = r.edges; focus = r.focus }
  } else if (plan.from) es = connect(ns, es, plan.from.id, targetId)
  if (plan.createTo) {
    const r = attach(ns, es, { type: plan.createTo, x: target.x + NODE_W + 60, y: target.y, fromIds: [targetId] })
    if (r) { ns = r.nodes; es = r.edges; focus = focus === targetId ? r.focus : focus }
  } else if (plan.to) es = connect(ns, es, targetId, plan.to.id)
  if (ns === nodes && es === edges) return null
  return { nodes: ns, edges: es, focus }
}

// ---------- the rules ----------
export function review(nodes, edges, rps) {
  const out = []
  if (!nodes.length) return out

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const has = t => nodes.some(n => n.type === t)
  const all = t => nodes.filter(n => n.type === t)
  const outOf = id => edges.filter(e => e.from === id)
  const into = id => edges.filter(e => e.to === id)
  const typeOf = id => byId[id]?.type
  const sim = simulate(nodes, edges, rps)
  const cap = capacityReport(nodes, sim)
  const flow = id => sim.stats[id]?.in || 0
  const push = s => out.push(s)
  const rightOf = () => Math.max(...nodes.map(n => n.x)) + NODE_W + 60
  const bottomOf = () => Math.max(...nodes.map(n => n.y)) + NODE_H + 40
  const sources = nodes.filter(n => CATALOG[n.type]?.source)

  // 1. client hitting compute with no load balancer anywhere
  if (!has('lb')) {
    for (const e of edges) {
      if (!CATALOG[typeOf(e.from)]?.source) continue
      if (!COMPUTE.includes(typeOf(e.to)) && typeOf(e.to) !== 'gateway') continue
      const t = byId[e.to]
      push({
        id: 'lb:' + e.id, icon: '⚖️', severity: 'high',
        title: `Put a load balancer in front of ${t.label}`,
        detail: `${byId[e.from].label} talks straight to ${t.label}, so there is no way to spread traffic, drain an instance, or survive one dying. Inserts a Load Balancer on that link.`,
        apply: (ns, es) => insertOnEdge(ns, es, e.from, e.to, 'lb', 'Load Balancer'),
      })
      break
    }
  }

  // 2. no CDN at the edge for a user-facing read path
  if (!has('cdn') && sources.length && (has('web') || has('blob') || has('app'))) {
    const e = edges.find(e2 => CATALOG[typeOf(e2.from)]?.source)
    if (e) push({
      id: 'cdn:' + e.id, icon: '⚡', severity: 'med',
      title: 'Add a CDN at the edge',
      detail: 'Every byte is served from origin today. A CDN absorbs static and cacheable traffic near the user — typically ~90% of reads never reach your servers, and p50 drops sharply.',
      apply: (ns, es) => insertOnEdge(ns, es, e.from, e.to, 'cdn', 'CDN'),
    })
  }

  // 3. compute reading a database with no cache on that path
  for (const e of edges) {
    if (!COMPUTE.includes(typeOf(e.from)) || !DBS.includes(typeOf(e.to))) continue
    const cached = outOf(e.from).some(x => typeOf(x.to) === 'cache')
    if (cached) continue
    const db = byId[e.to], util = sim.stats[e.to]?.util || 0
    push({
      id: 'cache:' + e.id, icon: '🧠', severity: util > 0.4 ? 'high' : 'med',
      title: `Cache reads in front of ${db.label}`,
      detail: `${byId[e.from].label} queries ${db.label} directly at ${fmt(flow(e.to))}/s${util > 0.4 ? ` (${(util * 100).toFixed(0)}% of its capacity)` : ''}. A Redis layer at an 80% hit ratio cuts that to roughly a fifth. Inserts the cache on that edge.`,
      apply: (ns, es) => insertOnEdge(ns, es, e.from, e.to, 'cache', 'Cache: ' + db.label),
    })
  }

  // 4. saturated tiers → scale out
  for (const r of cap.rows) {
    if (r.util <= 0.7 || r.down) continue
    const spec = CATALOG[byId[r.id]?.type]
    if (!spec) continue
    const target = Math.max(r.replicas + 1, Math.ceil(r.in / (spec.cap * 0.55)))
    push({
      id: 'scale:' + r.id, icon: '📶', severity: r.util >= 1 ? 'high' : 'med',
      title: `Scale ${r.label} to ${target}× replicas`,
      detail: `${r.label} is at ${(r.util * 100).toFixed(0)}% with ${r.replicas}× today${r.util >= 1 ? ` and dropping ${fmt(sim.stats[r.id].dropped)}/s` : ''}. Queueing delay climbs steeply past ~70% utilization, so this sets it to ${target}× for headroom.`,
      apply: (ns, es) => scaleTo(ns, es, r.id, target),
    })
  }

  // 5. single-instance stateful store = SPOF
  for (const n of nodes) {
    if (!DBS.includes(n.type) || (n.replicas || 1) > 1 || flow(n.id) <= 0) continue
    if (out.some(s => s.id === 'scale:' + n.id)) continue
    push({
      id: 'spof:' + n.id, icon: '🛡️', severity: 'med',
      title: `Replicate ${n.label} (single instance)`,
      detail: `${n.label} is a single instance on a live path — one failure takes the whole flow down and there is nowhere to send read traffic. Sets 3× (primary + 2 replicas).`,
      apply: (ns, es) => scaleTo(ns, es, n.id, 3),
    })
  }

  // 6. workers driven synchronously instead of from a queue
  for (const w of all('worker')) {
    const inb = into(w.id)
    if (!inb.length) continue
    if (inb.some(e => ['queue', 'kafka'].includes(typeOf(e.from)))) continue
    const e = inb[0]
    push({
      id: 'queue:' + w.id, icon: '📨', severity: 'high',
      title: `Buffer ${w.label} behind a queue`,
      detail: `${w.label} is called synchronously by ${byId[e.from].label}, so a spike or a slow job becomes caller latency and then dropped requests. A queue decouples them and gives you retries. Inserts it on that link.`,
      apply: (ns, es) => insertOnEdge(ns, es, e.from, w.id, 'queue', 'Job Queue'),
    })
  }

  // 7. gateway with no rate limiting
  if (has('gateway') && !has('ratelimiter')) {
    const gw = all('gateway')[0]
    const inb = into(gw.id)[0]
    if (inb) push({
      id: 'rl:' + gw.id, icon: '🚦', severity: 'med',
      title: 'Add a rate limiter ahead of the gateway',
      detail: 'Nothing bounds a single noisy tenant or a retry storm today — one client can consume the whole tier. Inserts a token-bucket limiter in front of the gateway.',
      apply: (ns, es) => insertOnEdge(ns, es, inb.from, gw.id, 'ratelimiter', 'Rate Limiter'),
    })
  }

  // 8. no async path at all
  if (!has('queue') && !has('kafka') && nodes.length >= 5) {
    const busy = cap.rows.find(r => COMPUTE.includes(typeOf(r.id)))
    if (busy) push({
      id: 'bus:' + busy.id, icon: '🌊', severity: 'low',
      title: 'Introduce an event stream for async work',
      detail: 'Everything here is request/response, so every downstream slowdown is felt by the user and nothing is replayable. Attaches a Kafka-style log off ' + busy.label + ' for fan-out, retries and audit.',
      apply: (ns, es) => attach(ns, es, { type: 'kafka', label: 'Event Stream', x: byId[busy.id].x, y: bottomOf(), fromIds: [busy.id] }),
    })
  }

  // 9. no analytics platform — data lake / warehouse / BI
  if (!has('lake') && !has('warehouse')) {
    const src = all('kafka')[0] || all('queue')[0] || nodes.find(n => DBS.includes(n.type))
    if (src && nodes.length >= 4) {
      const viaDb = DBS.includes(src.type)
      push({
        id: 'dataplat:' + src.id, icon: '🏞️', severity: 'low',
        title: 'Add a data platform (lake → warehouse → BI)',
        detail: `Analytics has nowhere to live, so reporting queries end up on ${src.label} and compete with production. Adds ${viaDb ? 'a CDC connector, ' : ''}a raw Data Lake, an ELT job, a Data Warehouse and a BI layer, wired as a chain off ${src.label}.`,
        apply: (ns, es) => attachChain(ns, es, src.id, [
          ...(viaDb ? [{ type: 'cdc', label: 'CDC Connector', x: rightOf(), y: bottomOf(), replicas: 2 }] : []),
          { type: 'lake', label: 'Data Lake (raw)', x: rightOf(), y: bottomOf(), replicas: 2 },
          { type: 'etl', label: 'ELT Transform', x: rightOf() + 150, y: bottomOf(), replicas: 4 },
          { type: 'warehouse', label: 'Data Warehouse', x: rightOf() + 300, y: bottomOf(), replicas: 3 },
          { type: 'bi', label: 'BI / Dashboards', x: rightOf() + 450, y: bottomOf(), replicas: 2 },
        ]),
      })
    }
  }

  // 9b. partial data platform
  if (has('lake') && !has('warehouse')) {
    const lake = all('lake')[0]
    push({
      id: 'wh:' + lake.id, icon: '🏛️', severity: 'low',
      title: 'Add a warehouse on top of the lake',
      detail: `${lake.label} is schema-on-read, which is wrong for repeatable BI queries. Adds an ELT job into a modelled columnar Data Warehouse.`,
      apply: (ns, es) => attachChain(ns, es, lake.id, [
        { type: 'etl', label: 'ELT Transform', x: lake.x + 150, y: lake.y, replicas: 4 },
        { type: 'warehouse', label: 'Data Warehouse', x: lake.x + 300, y: lake.y, replicas: 3 },
      ]),
    })
  }
  if (has('warehouse') && !has('bi')) {
    const wh = all('warehouse')[0]
    push({
      id: 'bi:' + wh.id, icon: '📈', severity: 'low',
      title: 'Add a BI layer on the warehouse',
      detail: `Nothing consumes ${wh.label} yet. Attaches a BI/dashboard tier so analysts query the warehouse instead of production stores.`,
      apply: (ns, es) => attach(ns, es, { type: 'bi', label: 'BI / Dashboards', replicas: 2, x: wh.x + 150, y: wh.y, fromIds: [wh.id] }),
    })
  }
  // 9c. reporting hitting the OLTP database directly
  if (has('warehouse')) {
    for (const n of nodes) {
      if (!['bi', 'analytics'].includes(n.type)) continue
      const bad = into(n.id).find(e => DBS.includes(typeOf(e.from)))
      if (!bad) continue
      const wh = all('warehouse')[0]
      push({
        id: 'olap:' + n.id, icon: '🚧', severity: 'med',
        title: `Route ${n.label} through the warehouse`,
        detail: `${n.label} reads ${byId[bad.from].label} directly — one heavy analytical scan can stall production traffic. Repoints it at ${wh.label}.`,
        apply: (ns, es) => {
          if (!ns.some(x => x.id === n.id) || !ns.some(x => x.id === wh.id)) return null
          const es2 = es.filter(e => !(e.from === bad.from && e.to === n.id))
          if (!es2.some(e => e.from === wh.id && e.to === n.id)) es2.push({ id: `${wh.id}->${n.id}`, from: wh.id, to: n.id, label: '' })
          return { nodes: ns, edges: es2, focus: n.id }
        },
      })
    }
  }

  // 10. microservice platform gaps
  const microCount = all('micro').length + all('bff').length
  if (microCount >= 3 && !has('registry') && !has('mesh')) {
    const anchor = all('micro')[0]
    push({
      id: 'reg:' + anchor.id, icon: '📖', severity: 'med',
      title: 'Add service discovery',
      detail: `${microCount} services with no registry means hard-coded hosts and no health-based routing. Attaches a Consul/Eureka-style registry.`,
      apply: (ns, es) => attach(ns, es, { type: 'registry', label: 'Service Registry', x: anchor.x, y: bottomOf(), toIds: [anchor.id] }),
    })
  }
  if (microCount >= 3 && !has('tracing')) {
    const anchor = all('mesh')[0] || all('micro')[0]
    push({
      id: 'trace:' + anchor.id, icon: '🧵', severity: 'low',
      title: 'Add distributed tracing',
      detail: 'With this many hops a single slow request is unattributable without spans. Attaches an OpenTelemetry/Jaeger tier.',
      apply: (ns, es) => attach(ns, es, { type: 'tracing', label: 'Tracing', x: anchor.x + 160, y: bottomOf(), fromIds: [anchor.id] }),
    })
  }

  // 11. no monitoring anywhere
  if (!has('monitor') && nodes.length >= 4) {
    const anchors = cap.rows.slice(0, 3).map(r => r.id).filter(id => byId[id])
    if (anchors.length) push({
      id: 'mon:all', icon: '🩺', severity: 'med',
      title: 'Add monitoring and alerting',
      detail: `Nothing collects metrics, logs or alerts here — you would learn about an outage from users. Attaches a monitoring tier fed by your ${anchors.length} busiest components.`,
      apply: (ns, es) => attach(ns, es, { type: 'monitor', label: 'Monitoring', x: rightOf(), y: bottomOf(), fromIds: anchors.filter(id => ns.some(n => n.id === id)) }),
    })
  }

  // 12. orphans — nothing routes to it, so it carries no traffic
  for (const n of nodes) {
    if (CATALOG[n.type]?.source || n.type === 'scheduler') continue  // cron triggers itself
    if (into(n.id).length) continue
    const plan = planWiring(nodes, edges, n, 'in')
    if (!plan.from && !plan.createFrom) continue
    push({
      id: 'orphan:' + n.id, icon: '🔌', severity: 'med',
      title: `Wire up ${n.label}`,
      detail: `Nothing routes to ${n.label}, so it sits at 0 rps and contributes nothing to latency or availability. Quick fix ${describe(plan)}.`,
      apply: (ns, es) => runPlan(ns, es, n.id, 'in'),
    })
  }

  // 13. dead ends — a routing component that forwards nowhere
  for (const n of nodes) {
    if (!PASSTHROUGH.includes(n.type) || outOf(n.id).length) continue
    const plan = planWiring(nodes, edges, n, 'out')
    if (!plan.to && !plan.createTo) continue
    push({
      id: 'deadend:' + n.id, icon: '🚧', severity: 'med',
      title: `${n.label} forwards nowhere`,
      detail: `${n.label} is a ${CATALOG[n.type].name} with no downstream, so traffic reaching it is a dead end. Quick fix ${describe(plan)}.`,
      apply: (ns, es) => runPlan(ns, es, n.id, 'out'),
    })
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.title.localeCompare(b.title))
}

// Fold every applicable suggestion into one graph
export function applyAll(suggestions, nodes, edges) {
  let g = { nodes, edges, focus: null }
  for (const s of suggestions) {
    if (!s.apply) continue
    const r = s.apply(g.nodes, g.edges)
    if (r) g = { ...r, focus: g.focus || r.focus }
  }
  return g
}
