// ── Terraform: layers, trade-off hints, and the step-by-step build plan ──────
// The design on the canvas implies an ORDER: state and network first, data
// stores before the services that call them, edge last, observability before
// real traffic. This module derives that order and the trade-off behind each
// step from the canvas itself, so the plan changes when the design does.
//
// Honest scope: this is a plan and a skeleton, not a production stack. The
// trade-offs are the general engineering ones for each kind of component; the
// counts, names and which steps appear come from YOUR design.
import { CATALOG } from './catalog.js'
import { serviceName } from './clouds.js'

export const slugOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'svc'

const L = {
  foundation: ['iam', 'secrets', 'tls', 'crypto', 'hsm', 'bastion', 'containerreg', 'config', 'registry', 'pii', 'sign', 'digest', 'hash', 'e2ee'],
  data: ['sql', 'nosql', 'cache', 'search', 'blob', 'vector', 'lake', 'warehouse', 'graph', 'tsdb', 'featurestore', 'ledger', 'backup', 'zk'],
  messaging: ['queue', 'kafka', 'mq', 'stream', 'cdc', 'etl', 'esb', 'mft'],
  edge: ['dns', 'cdn', 'lb', 'gateway', 'k8sgw', 'grpcgw', 'ratelimiter', 'waf', 'gslb', 'edge', 'mesh'],
  ops: ['monitor', 'tracing', 'otel', 'logs', 'slo', 'alert', 'synthetic', 'apm', 'llmobs', 'siem', 'audit'],
}
const LAYER_OF = {}
for (const [layer, types] of Object.entries(L)) for (const t of types) LAYER_OF[t] = layer
export const layerOf = type => LAYER_OF[type] || 'compute'
export const LAYER_RANK = { foundation: 0, data: 1, messaging: 2, compute: 3, edge: 4, ops: 5 }

// Trade-off hints. Specific component first, then the layer as a fallback.
export const TYPE_HINTS = {
  sql: 'Managed relational DB: multi-AZ roughly doubles the instance cost but turns a zone outage into a short failover instead of an outage. Read replicas scale reads, not writes.',
  nosql: 'Easier horizontal scale and flexible schema, but you give up joins and ad-hoc queries - model your access patterns first or you will pay later.',
  cache: 'A cache buys latency and offloads the database, but adds stale data and a cold-start stampede risk. Set TTLs deliberately and size for the hot set, not everything.',
  search: 'A search cluster is a second copy of your data that you must keep in sync; it is eventually consistent. Do not make it your source of truth.',
  blob: 'Object storage is cheap and durable but slow per request: great for big files, wrong for small hot reads. Lifecycle rules control the bill.',
  vector: 'Vector search trades exactness for speed (approximate nearest neighbour). Index type and recall target set both cost and quality.',
  queue: 'A queue decouples producer from consumer and absorbs spikes, at the price of eventual results and the need for idempotent consumers and a dead-letter queue.',
  kafka: 'A log gives replay and many consumers, but is real operational weight (partitions, ordering per key, rebalances). Use a simple queue if you do not need replay.',
  lb: 'A load balancer removes a single server as a single point of failure, but is itself a dependency - run it across zones and health-check honestly.',
  gateway: 'A gateway centralises auth, rate limits and routing, at the cost of a shared choke point and extra latency. Keep business logic out of it.',
  cdn: 'A CDN cuts latency and origin load, but stale content is the price: choose TTLs and an invalidation path before launch.',
  waf: 'Blocks common attacks at the edge, but false positives block real users - start in count/monitor mode, then enforce.',
  dns: 'DNS with health checks and low TTLs gives you the cutover and failover lever; very low TTLs raise query cost and resolver load.',
  k8s: 'Kubernetes gives uniform scheduling and scaling, but a cluster is a product you now operate. A managed control plane trades money for fewer 3 a.m. pages.',
  worker: 'Workers scale independently of the web tier and can run on cheaper capacity, but need backpressure and a visibility timeout so a slow job is not lost or doubled.',
  app: 'Stateless services scale by adding replicas. Keep state in the data tier, set CPU/memory requests honestly, and scale on the metric that actually saturates.',
  micro: 'Separate services scale and deploy independently but add network calls, partial failure and operational overhead. Split on real team or scaling boundaries, not on fashion.',
  secrets: 'A secrets manager removes credentials from code and config, and adds a runtime dependency: cache with care and plan for its outage.',
  iam: 'Least privilege costs setup time now and prevents a breach spreading later. Prefer roles over long-lived keys.',
}
export const LAYER_HINTS = {
  foundation: 'Shared foundations cost effort up front but make every later step safer and repeatable.',
  data: 'Stateful components are the hardest to change later: decide durability, backups and failover before anything depends on them.',
  messaging: 'Asynchronous links add resilience and delay: define retries, ordering and what happens to a poison message.',
  compute: 'Compute is the easiest layer to scale and replace; keep it stateless so that stays true.',
  edge: 'The edge is the first thing users hit and the first thing to fail loudly: spend on redundancy and health checks here.',
  ops: 'Observability is cheap before launch and impossible to retrofit during an incident.',
}
export const hintFor = type => TYPE_HINTS[type] || LAYER_HINTS[layerOf(type)]

// Managed-service-bearing nodes only (no traffic sources).
const real = nodes => nodes.filter(n => !CATALOG[n.type]?.source)

export function implementationPlan(nodes, edges = [], cloud = 'aws') {
  const cn = cloud === 'generic' ? 'your cloud' : String(cloud).toUpperCase()
  const ns = real(nodes)
  if (!ns.length) return []
  const by = {}
  for (const n of ns) (by[layerOf(n.type)] ||= []).push(n)
  const names = list => list.map(n => n.label)
  const mod = n => 'module.' + slugOf(n.label).replace(/-/g, '_')
  const targets = list => list.slice(0, 4).map(n => `-target=${mod(n)}`).join(' ') + (list.length > 4 ? ' …' : '')
  const svc = n => serviceName(n.type, cloud)
  const steps = []
  const add = s => steps.push({ n: steps.length + 1, ...s })

  add({
    phase: 'Foundation', title: 'State, accounts and network',
    components: names(by.foundation || []),
    do: `Create the remote state backend with locking, separate environments (dev / staging / prod), and the network (private subnets across at least two zones) on ${cn}. Put identities, keys and secrets in place here: everything later references them.`,
    commands: ['terraform init', 'terraform workspace new staging', 'terraform plan -out=foundation.plan', 'terraform apply foundation.plan'],
    tradeoff: 'One account with workspaces is cheapest and simplest; an account per environment limits blast radius and is worth it once real data exists. NAT gateways and cross-zone traffic are quiet cost lines - budget for them now.',
    verify: 'State is stored remotely and locked; staging and prod cannot see each other.',
  })

  if (by.data?.length) {
    const d = by.data, single = d.filter(n => (n.replicas || 1) < 2 && ['sql', 'nosql', 'cache'].includes(n.type))
    add({
      phase: 'Data', title: 'Stateful stores first',
      components: names(d),
      do: `Provision ${names(d).join(', ')} (${[...new Set(d.map(svc).filter(Boolean))].join(', ') || 'managed stores'}) before anything that calls them. Turn on backups and point-in-time recovery, encryption at rest, and subnet-only access.`,
      commands: ['terraform plan ' + targets(d), 'terraform apply ' + targets(d)],
      tradeoff: single.length
        ? `${names(single).join(', ')} ${single.length === 1 ? 'has' : 'have'} one replica on your canvas: that is a single point of failure. Two or more costs roughly that much more but survives a zone loss. Decide it now - changing durability later is a migration.`
        : 'Replicas are set on the canvas: zone failure is survivable, at the price of paying for the standby. Managed services cost more than self-hosting and save the operating team.',
      verify: 'Restore a backup into a scratch environment once. An untested backup is a hope, not a backup.',
    })
  }
  if (by.messaging?.length) add({
    phase: 'Messaging', title: 'Queues and streams',
    components: names(by.messaging),
    do: `Provision ${names(by.messaging).join(', ')} with a dead-letter path, retention and access policy. Create the topics or queues the services will use, with names agreed in advance.`,
    commands: ['terraform plan ' + targets(by.messaging), 'terraform apply ' + targets(by.messaging)],
    tradeoff: hintFor(by.messaging[0].type),
    verify: 'Send a poison message and confirm it lands in the dead-letter queue instead of looping.',
  })
  if (by.compute?.length) add({
    phase: 'Compute', title: 'Services and workers',
    components: names(by.compute),
    do: `Deploy ${names(by.compute).join(', ')} with the replica counts from the canvas (${by.compute.map(n => `${n.label} × ${n.replicas || 1}`).slice(0, 5).join(', ')}${by.compute.length > 5 ? ', …' : ''}). Set CPU and memory requests honestly, health checks, and an autoscaling signal that matches what saturates first.`,
    commands: ['terraform plan ' + targets(by.compute), 'terraform apply ' + targets(by.compute)],
    tradeoff: hintFor(by.compute[0].type) + ' Fewer, larger replicas are cheaper per request but fail bigger; many small ones fail small and cost more to run.',
    verify: 'Kill one replica and confirm traffic continues; check the autoscaler reacts to a load test.',
  })
  if (by.edge?.length) add({
    phase: 'Edge', title: 'Entry points and traffic management',
    components: names(by.edge),
    do: `Provision ${names(by.edge).join(', ')} last, so nothing public exists before the services behind it do. Start with a restrictive rate limit, health checks across zones, and TLS everywhere.`,
    commands: ['terraform plan ' + targets(by.edge), 'terraform apply ' + targets(by.edge)],
    tradeoff: hintFor(by.edge.find(n => TYPE_HINTS[n.type])?.type || by.edge[0].type),
    verify: 'Hit the public endpoint end to end; confirm an unhealthy backend is removed from rotation.',
  })
  if (by.ops?.length) add({
    phase: 'Observability', title: 'See it before users do',
    components: names(by.ops),
    do: `Provision ${names(by.ops).join(', ')}: dashboards for the golden signals, alerts on user-facing symptoms (error rate, latency), and tracing across every hop. Do this before real traffic.`,
    commands: ['terraform plan ' + targets(by.ops), 'terraform apply ' + targets(by.ops)],
    tradeoff: LAYER_HINTS.ops + ' Alert on symptoms, not causes, or you page people for noise.',
    verify: 'Trigger a test failure and confirm the alert fires and points at the right service.',
  })
  add({
    phase: 'Cutover', title: 'Prove it, then shift traffic',
    components: [],
    do: 'Run a load test at the traffic this design was sized for, then a failure test (take out one zone or one dependency). Shift real traffic gradually with weighted DNS or a canary, watching error rate and latency, with a one-step rollback.',
    commands: ['terraform plan', 'terraform apply', 'terraform output'],
    tradeoff: 'A gradual shift costs days and some duplicate running cost, and it is the cheapest insurance you can buy. A big-bang cutover is faster and puts the whole business behind one mistake.',
    verify: 'Error rate and p99 hold at each step; you have rolled back once in rehearsal.',
  })
  return steps
}

// The dependency a module should declare: callee in a strictly earlier layer
// than the caller, so the graph can never contain a cycle.
export function moduleDeps(node, nodes, edges) {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const rank = n => LAYER_RANK[layerOf(n.type)]
  const out = []
  for (const e of edges) {
    if (e.from !== node.id) continue
    const to = byId.get(e.to)
    if (to && !CATALOG[to.type]?.source && rank(to) < rank(node)) out.push(to)
  }
  return out
}
