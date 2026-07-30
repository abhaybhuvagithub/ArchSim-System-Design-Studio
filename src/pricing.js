// Rough cloud cost model. Three levers per component:
//   hourly  — $ per instance-hour  → scales with replicas
//   base    — $ per instance-month (licence, managed fee, baseline storage)
//   perM    — $ per million requests that actually flow through the node
// So cost reacts live to both the replica count and the simulated traffic.
//
// Figures are order-of-magnitude on-demand US list prices, no reservations or
// committed-use discounts. They are for comparing designs, not for a quote.
import { CATALOG } from './catalog.js'

export const HOURS = 730                       // hours in an average month
export const SEC_PER_MONTH = HOURS * 3600      // 2,628,000
export const REQ_M_PER_RPS = SEC_PER_MONTH / 1e6 // millions of requests/month per 1 rps

export const RATES = {
  client:      { hourly: 0,     base: 0,    perM: 0,    note: 'traffic source — no infrastructure cost' },
  // edge / traffic
  dns:         { hourly: 0,     base: 0.5,  perM: 0.40, note: 'hosted zone + $0.40 per million queries' },
  gslb:        { hourly: 0,     base: 18,   perM: 0.60, note: 'traffic policies + health checks' },
  waf:         { hourly: 0,     base: 8,    perM: 0.60, note: 'web ACL + rules + per-request inspection' },
  cdn:         { hourly: 0,     base: 0,    perM: 5.00, note: 'requests + ~50 KB egress per request at $0.085/GB' },
  edge:        { hourly: 0,     base: 0,    perM: 0.50, note: 'edge function invocations' },
  lb:          { hourly: 0.03,  base: 0,    perM: 0.01, note: 'ALB hours + capacity units' },
  gateway:     { hourly: 0,     base: 0,    perM: 1.00, note: 'managed HTTP API at $1.00 per million calls' },
  graphql:     { hourly: 0.09,  base: 0,    perM: 0.10, note: 'self-hosted router instances' },
  ratelimiter: { hourly: 0.05,  base: 0,    perM: 0,    note: 'small always-on instances' },
  bff:         { hourly: 0.09,  base: 0,    perM: 0,    note: 'application instances' },
  tenant:      { hourly: 0.05,  base: 0,    perM: 0,    note: 'lightweight routing instances' },
  // compute
  web:         { hourly: 0.085, base: 0,    perM: 0,    note: 'general-purpose instance per replica' },
  app:         { hourly: 0.096, base: 0,    perM: 0,    note: 'general-purpose instance per replica' },
  micro:       { hourly: 0.08,  base: 0,    perM: 0,    note: 'container task per replica' },
  ws:          { hourly: 0.10,  base: 0,    perM: 0,    note: 'connection-heavy instance per replica' },
  worker:      { hourly: 0.10,  base: 0,    perM: 0,    note: 'batch/async compute per replica' },
  scheduler:   { hourly: 0.02,  base: 0,    perM: 0,    note: 'orchestrator instance' },
  k8s:         { hourly: 0.10,  base: 0,    perM: 0,    note: 'cluster control plane (nodes billed per service)' },
  saga:        { hourly: 0.09,  base: 0,    perM: 10.0, note: 'instances + managed state transitions' },
  // storage
  cache:       { hourly: 0.14,  base: 0,    perM: 0,    note: 'in-memory node per replica' },
  sql:         { hourly: 0.29,  base: 0,    perM: 0,    note: 'managed relational instance, HA pair' },
  nosql:       { hourly: 0,     base: 0,    perM: 1.25, note: 'on-demand read/write units' },
  search:      { hourly: 0.19,  base: 0,    perM: 0,    note: 'search cluster node per replica' },
  blob:        { hourly: 0,     base: 24,   perM: 0.40, note: '~1 TB stored at $0.023/GB + request cost' },
  backup:      { hourly: 0,     base: 12,   perM: 0,    note: 'snapshot + archive storage' },
  // async
  queue:       { hourly: 0,     base: 0,    perM: 0.40, note: '$0.40 per million messages' },
  kafka:       { hourly: 0.25,  base: 0,    perM: 0,    note: 'broker + attached storage per replica' },
  mq:          { hourly: 0.30,  base: 0,    perM: 0,    note: 'transactional broker instance' },
  esb:         { hourly: 0.40,  base: 250,  perM: 0,    note: 'iPaaS/ESB runtime plus licence' },
  // data
  cdc:         { hourly: 0.15,  base: 0,    perM: 0,    note: 'connector task per replica' },
  etl:         { hourly: 0.30,  base: 0,    perM: 0,    note: 'Spark/Glue worker per replica' },
  lake:        { hourly: 0,     base: 24,   perM: 0,    note: '~1 TB object storage per zone' },
  warehouse:   { hourly: 0.75,  base: 0,    perM: 0,    note: 'assumes the warehouse runs ~8h/day' },
  bi:          { hourly: 0,     base: 45,   perM: 0,    note: 'BI seats/licences per replica' },
  analytics:   { hourly: 0.30,  base: 0,    perM: 0,    note: 'stream/batch analytics compute' },
  billing:     { hourly: 0.15,  base: 0,    perM: 0,    note: 'metering service instances' },
  // AI / ML
  ml:          { hourly: 0.60,  base: 0,    perM: 0,    note: 'inference instance per replica' },
  embed:       { hourly: 0,     base: 0,    perM: 20,   note: '≈ $0.02 per 1k embedding calls' },
  vector:      { hourly: 0.30,  base: 0,    perM: 0,    note: 'vector index node per replica' },
  llm:         { hourly: 0,     base: 0,    perM: 1500, note: '≈ $0.0015 per generation — usually the whole bill' },
  guard:       { hourly: 0,     base: 0,    perM: 5.00, note: 'moderation/classifier calls' },
  // observability
  otel:        { hourly: 0.10,  base: 0,    perM: 0,    note: 'collector instances' },
  monitor:     { hourly: 0,     base: 45,   perM: 0.05, note: 'metrics platform per host + ingestion' },
  logs:        { hourly: 0,     base: 10,   perM: 2.00, note: '~4 KB of logs per request at $0.50/GB' },
  tracing:     { hourly: 0,     base: 10,   perM: 1.50, note: 'span ingestion (sample to cut this)' },
  slo:         { hourly: 0,     base: 20,   perM: 0,    note: 'SLO tooling' },
  alert:       { hourly: 0,     base: 21,   perM: 0,    note: 'on-call seats per responder' },
  synthetic:   { hourly: 0,     base: 15,   perM: 0,    note: 'probe checks per location' },
  apm:         { hourly: 0,     base: 15,   perM: 0.60, note: 'RUM sessions' },
  // security
  iam:         { hourly: 0,     base: 25,   perM: 0.05, note: 'identity platform tier' },
  secrets:     { hourly: 0,     base: 8,    perM: 0,    note: '~20 secrets at $0.40 each' },
  pii:         { hourly: 0,     base: 60,   perM: 5.00, note: 'tokenization vendor + per-call fee' },
  audit:       { hourly: 0,     base: 12,   perM: 0.50, note: 'immutable store + write cost' },
  siem:        { hourly: 0,     base: 150,  perM: 3.00, note: 'ingest-priced — the classic budget surprise' },
  // platform
  registry:    { hourly: 0.06,  base: 0,    perM: 0,    note: 'discovery cluster node' },
  mesh:        { hourly: 0.06,  base: 0,    perM: 0,    note: 'sidecar + control plane overhead' },
  config:      { hourly: 0.04,  base: 0,    perM: 0,    note: 'config service node' },
  zk:          { hourly: 0.10,  base: 0,    perM: 0,    note: 'coordination ensemble node' },
  cicd:        { hourly: 0.05,  base: 40,   perM: 0,    note: 'runners plus platform seats' },
  // enterprise systems of record
  erp:         { hourly: 0,     base: 4000, perM: 0,    note: 'ERP licence + hosting, per environment' },
  crm:         { hourly: 0,     base: 1500, perM: 0,    note: 'CRM seats' },
  mainframe:   { hourly: 0,     base: 12000,perM: 0,    note: 'MIPS capacity + software licences' },
  mft:         { hourly: 0,     base: 400,  perM: 0,    note: 'MFT/EDI platform licence' },
}

const FALLBACK = { hourly: 0.08, base: 0, perM: 0, note: 'generic compute estimate' }
export const rateFor = type => RATES[type] || FALLBACK

const GROUP_OF = {
  client: 'Traffic', dns: 'Traffic', gslb: 'Traffic', waf: 'Traffic', cdn: 'Traffic', edge: 'Traffic',
  lb: 'Traffic', gateway: 'Traffic', graphql: 'Traffic', ratelimiter: 'Traffic', bff: 'Traffic', tenant: 'Traffic',
  web: 'Compute', app: 'Compute', micro: 'Compute', ws: 'Compute', worker: 'Compute', scheduler: 'Compute',
  k8s: 'Compute', saga: 'Compute',
  cache: 'Storage', sql: 'Storage', nosql: 'Storage', search: 'Storage', blob: 'Storage', backup: 'Storage',
  queue: 'Async', kafka: 'Async', mq: 'Async', esb: 'Async',
  cdc: 'Data', etl: 'Data', lake: 'Data', warehouse: 'Data', bi: 'Data', analytics: 'Data', billing: 'Data',
  ml: 'AI / ML', embed: 'AI / ML', vector: 'AI / ML', llm: 'AI / ML', guard: 'AI / ML',
  otel: 'Observability', monitor: 'Observability', logs: 'Observability', tracing: 'Observability',
  slo: 'Observability', alert: 'Observability', synthetic: 'Observability', apm: 'Observability',
  iam: 'Security', secrets: 'Security', pii: 'Security', audit: 'Security', siem: 'Security',
  registry: 'Platform', mesh: 'Platform', config: 'Platform', zk: 'Platform', cicd: 'Platform',
  erp: 'Enterprise', crm: 'Enterprise', mainframe: 'Enterprise', mft: 'Enterprise',
}

// Monthly cost for one node given how much traffic actually reaches it.
// `mult` is the selected cloud's rough list-price factor.
export function nodeCost(node, inRps = 0, mult = 1) {
  const r = rateFor(node.type)
  const replicas = Math.max(1, node.replicas || 1)
  const fixed = replicas * (r.hourly * HOURS + r.base) * mult
  const usage = Math.max(0, inRps) * REQ_M_PER_RPS * r.perM * mult
  return { fixed, usage, total: fixed + usage, rate: r }
}

export function costReport(nodes, sim, mult = 1) {
  const rows = nodes.map(n => {
    const inRps = sim?.stats?.[n.id]?.in || 0
    const c = nodeCost(n, inRps, mult)
    return {
      id: n.id, label: n.label, type: n.type, typeName: CATALOG[n.type]?.name || n.type,
      group: GROUP_OF[n.type] || 'Other', replicas: Math.max(1, n.replicas || 1),
      inRps, ...c,
    }
  }).sort((a, b) => b.total - a.total)

  const total = rows.reduce((s, r) => s + r.total, 0)
  const fixed = rows.reduce((s, r) => s + r.fixed, 0)
  const usage = rows.reduce((s, r) => s + r.usage, 0)

  const groups = {}
  for (const r of rows) groups[r.group] = (groups[r.group] || 0) + r.total
  const byGroup = Object.entries(groups).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

  // requests served per month = the traffic that entered the system
  const entry = nodes.filter(n => CATALOG[n.type]?.source)
    .reduce((s, n) => s + (sim?.stats?.[n.id]?.in || 0), 0)
  const reqMillions = entry * REQ_M_PER_RPS
  const perMillion = reqMillions > 0 ? total / reqMillions : 0

  return { rows, total, fixed, usage, byGroup, perMillion, reqMillions, hourly: total / HOURS }
}

export const money = v =>
  v >= 100000 ? '$' + (v / 1000).toFixed(0) + 'k'
  : v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k'
  : v >= 10 ? '$' + v.toFixed(0)
  : v > 0 ? '$' + v.toFixed(2)
  : '$0'
