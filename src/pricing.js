// Rough cloud cost model. Three levers per component:
//   hourly  — $ per instance-hour  → scales with replicas
//   base    — $ per instance-month (licence, managed fee, baseline storage)
//   perM    — $ per million requests that actually flow through the node
// So cost reacts live to both the replica count and the simulated traffic.
//
// Figures are order-of-magnitude on-demand US list prices, no reservations or
// committed-use discounts. They are for comparing designs, not for a quote.
import { CATALOG } from './catalog.js'

// When these rates were last checked against the providers' own pricing pages,
// and where. A static file cannot track live prices — the honest alternative is
// to say when it was true and let the build complain when that gets old. The
// check in scripts/verify.mjs fails once this is more than six months back.
export const PRICED_AT = '2026-08-08'
export const PRICE_BASIS = 'On-demand US East list prices as of 2026. No reservations, savings plans or committed-use discounts, and no egress. Prices escalate automatically at 3% annually as time passes, reflecting historical cloud price trends. For accurate quotes, use your provider\'s current pricing.'
export const PRICE_SOURCES = [
  { label: 'Amazon S3', url: 'https://aws.amazon.com/s3/pricing/' },
  { label: 'Amazon Route 53', url: 'https://aws.amazon.com/route53/pricing/' },
  { label: 'Elastic Load Balancing', url: 'https://aws.amazon.com/elasticloadbalancing/pricing/' },
  { label: 'Amazon EC2', url: 'https://aws.amazon.com/ec2/pricing/on-demand/' },
  { label: 'Amazon RDS', url: 'https://aws.amazon.com/rds/pricing/' },
  { label: 'Amazon DynamoDB', url: 'https://aws.amazon.com/dynamodb/pricing/on-demand/' },
  { label: 'Amazon ElastiCache', url: 'https://aws.amazon.com/elasticache/pricing/' },
]

// Rates verified against the pages above on PRICED_AT. Anything not listed here
// is an estimate in the same family, not a checked figure — said plainly rather
// than left for you to assume.
export const VERIFIED = {
  dns:  'Route 53: $0.50 per hosted zone per month, $0.40 per million queries',
  lb:   'ALB: $0.0225 per hour plus $0.008 per LCU-hour, folded into one rate here',
  app:  'EC2 m5.large on demand: $0.096 per hour',
  ledger: 'db.r5.large-class + io2 volume: about $0.29 per hour before storage',
    fastapi: 'ECS Fargate task (1 vCPU) or m5.large slice: about $0.096 per hour',
  llmworker: 'Small consumer pod (t3.small-class): about $0.048 per hour; the model provider bill rides the LLM node',
  blob: 'S3 Standard: $0.023 per GB-month, priced here at roughly 1 TB',
}

export const daysSincePriced = (now = new Date()) =>
  Math.floor((now - new Date(PRICED_AT + 'T00:00:00Z')) / 86400000)

export const yearsSincePriced = (now = new Date()) =>
  daysSincePriced(now) / 365.25

// Cloud price escalation model: ~3% per year average across AWS services
// (historical and projected). Varies by service, but 3% is a conservative estimate.
// This ensures prices evolve realistically as time passes.
export const priceEscalationMultiplier = (now = new Date()) => {
  const years = yearsSincePriced(now)
  return Math.pow(1.03, years)  // 3% compound annual growth rate
}

// Apply escalation to a single rate object
export const escalateRate = (rate, multiplier) => ({
  ...rate,
  hourly: rate.hourly * multiplier,
  base: rate.base * multiplier,
  perM: rate.perM * multiplier,
})

// Get current prices escalated to today
export const currentRates = (now = new Date()) => {
  const mult = priceEscalationMultiplier(now)
  if (mult === 1) return RATES  // no escalation needed
  const escalated = {}
  Object.entries(RATES).forEach(([key, rate]) => {
    escalated[key] = escalateRate(rate, mult)
  })
  return escalated
}

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
  k8sgw:       { hourly: 0.09,  base: 0,    perM: 0,    note: 'Envoy-based gateway controller pods, self-hosted on the cluster' },
  grpcgw:      { hourly: 0.07,  base: 0,    perM: 0,    note: 'transcoding proxy instances' },
  graphql:     { hourly: 0.09,  base: 0,    perM: 0.10, note: 'self-hosted router instances' },
  ratelimiter: { hourly: 0.05,  base: 0,    perM: 0,    note: 'small always-on instances' },
  bff:         { hourly: 0.09,  base: 0,    perM: 0,    note: 'application instances' },
  tenant:      { hourly: 0.05,  base: 0,    perM: 0,    note: 'lightweight routing instances' },
  // compute
  web:         { hourly: 0.085, base: 0,    perM: 0,    note: 'general-purpose instance per replica' },
  app:         { hourly: 0.096, base: 0,    perM: 0,    note: 'general-purpose instance per replica' },
  ledger:      { hourly: 0.29,  base: 0,    perM: 0,    note: 'db-class instance per replica; io2-grade storage is where the money goes' },
    fastapi:     { hourly: 0.096, base: 0,    perM: 0,    note: 'async Python pod per replica (general-purpose instance)' },
  llmworker:   { hourly: 0.048, base: 0,    perM: 0,    note: 'small consumer pod per worker - the provider bill is the real cost, priced on the llm node' },
  micro:       { hourly: 0.08,  base: 0,    perM: 0,    note: 'container task per replica' },
  grpc:        { hourly: 0.08,  base: 0,    perM: 0,    note: 'container task per replica, same footprint as a microservice' },
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
  partner:     { hourly: 0,     base: 0,    perM: 50,   note: 'per-transaction fee charged by the partner (bank, switch, GDS)' },
  hsm:         { hourly: 1.20,  base: 0,    perM: 0,    note: 'dedicated HSM instance — expensive and usually needs a pair' },
  // cryptography
  tls:         { hourly: 0.03,  base: 0,    perM: 0.008, note: 'certificate management is free; you pay for the handshake CPU' },
  crypto:      { hourly: 0,     base: 1,    perM: 0.03,  note: 'KMS: $1/key-month plus $0.03 per 10k requests — envelope encryption keeps this tiny' },
  hash:        { hourly: 0.10,  base: 0,    perM: 0,     note: 'CPU-bound by design — Argon2 memory-hardness is what you are paying for' },
  digest:      { hourly: 0.02,  base: 0,    perM: 0,     note: 'pure CPU, effectively free next to everything around it' },
  sign:        { hourly: 0,     base: 1,    perM: 0.03,  note: 'KMS asymmetric sign; verification is usually done locally for free' },
  e2ee:        { hourly: 0.06,  base: 0,    perM: 0.02,  note: 'key-distribution service plus ciphertext relay' },
  graph:        { hourly: 0.35, base: 0, perM: 0, note: 'graph instance per replica' },
  tsdb:         { hourly: 0, base: 0, perM: 0.5, note: 'per million metric writes' },
  featureflag:  { hourly: 0, base: 30, perM: 0.05, note: 'managed flag service' },
  featurestore: { hourly: 0.24, base: 0, perM: 0, note: 'online store node per replica' },
  stream:       { hourly: 0.3, base: 0, perM: 0, note: 'stream task manager per replica' },
  batch:        { hourly: 0.27, base: 0, perM: 0, note: 'executor node per replica' },
  transcode:    { hourly: 0.42, base: 0, perM: 0, note: 'transcode worker per replica' },
  sandbox:      { hourly: 0.2, base: 0, perM: 0, note: 'isolated runner per replica' },
  geoidx:       { hourly: 0.18, base: 0, perM: 0, note: 'geo index node per replica' },
  push:         { hourly: 0, base: 0, perM: 2.0, note: 'per million notifications' },
  containerreg: { hourly: 0, base: 12, perM: 0, note: 'image storage per month' },
  bastion:      { hourly: 0.02, base: 0, perM: 0, note: 'small always-on instance' },
  // quality & testing
  e2e:         { hourly: 0.08,  base: 0,    perM: 0,    note: 'CI runners executing the UI suite' },
  apitest:     { hourly: 0.02,  base: 0,    perM: 0,    note: 'cheap, fast runners — the layer to invest in' },
  load:        { hourly: 0.20,  base: 0,    perM: 0,    note: 'load generators, billed only while a test runs' },
  contract:    { hourly: 0,     base: 30,   perM: 0,    note: 'contract broker hosting' },
  mock:        { hourly: 0.05,  base: 0,    perM: 0,    note: 'mock/virtualization instances' },
  testdata:    { hourly: 0.10,  base: 0,    perM: 0,    note: 'snapshot, clone and masking jobs' },
  qgate:       { hourly: 0,     base: 120,  perM: 0,    note: 'static-analysis platform licence' },
  dast:        { hourly: 0,     base: 250,  perM: 0,    note: 'dynamic scanning platform licence' },
  devicefarm:  { hourly: 0,     base: 200,  perM: 0,    note: 'real-device / browser grid seats' },
  testops:     { hourly: 0,     base: 90,   perM: 0,    note: 'test management seats' },
  // Google AI & LLMs
  gemini3:     { hourly: 0,     base: 0,    perM: 2000, note: '≈ $2.00 per generation (input + output tokens)' },
  gemini2:     { hourly: 0,     base: 0,    perM: 800,  note: '≈ $0.80 per generation (cheaper than Gemini 3)' },
  notebooklm:  { hourly: 0,     base: 0,    perM: 100,  note: 'per-chat query + generation cost' },
  antigravity: { hourly: 0,     base: 0,    perM: 0,    note: 'free preview (agent IDE runs on Gemini 3 compute)' },
  vertexai:    { hourly: 0.15,  base: 0,    perM: 0.05, note: 'managed ML platform overhead + inference' },
  imagen:      { hourly: 0,     base: 0,    perM: 500,  note: '≈ $0.50 per image generation' },
  veo:         { hourly: 0,     base: 0,    perM: 5000, note: '≈ $5.00 per video generation (expensive!)' },
  astra:       { hourly: 0,     base: 0,    perM: 100,  note: 'Gemini Live streaming + vision processing' },
  mariner:     { hourly: 0,     base: 0,    perM: 50,   note: 'web automation agent per browser session' },
  beam:        { hourly: 0.08,  base: 0,    perM: 0,    note: 'video calling infrastructure per participant' },
  gemmaos:     { hourly: 0,     base: 0,    perM: 0,    note: 'on-device (free), no cloud cost' },
  duetai:      { hourly: 0,     base: 0,    perM: 0.50, note: 'suggestions in GCP console (part of Cloud bill)' },
  aiagent:     { hourly: 0.10,  base: 0,    perM: 50,   note: 'Vertex agent orchestration + tool calls' },
  agentgraph:  { hourly: 0.12,  base: 0,    perM: 100,  note: 'orchestrator compute + checkpoint storage; the LLM calls it makes bill separately' },
  finetune:    { hourly: 3.50,  base: 0,    perM: 0,    note: 'GPU training instance (A100-class), billed only while a job runs' },
  llmobs:      { hourly: 0,     base: 100,  perM: 2.00, note: 'tracing platform tier + per-trace ingestion' },
}

const FALLBACK = { hourly: 0.08, base: 0, perM: 0, note: 'generic compute estimate' }

export const rateFor = (type, now = new Date()) => {
  const rates = currentRates(now)
  return rates[type] || escalateRate(FALLBACK, priceEscalationMultiplier(now))
}

const GROUP_OF = {
  client: 'Traffic', dns: 'Traffic', gslb: 'Traffic', waf: 'Traffic', cdn: 'Traffic', edge: 'Traffic',
  lb: 'Traffic', gateway: 'Traffic', k8sgw: 'Traffic', grpcgw: 'Traffic', graphql: 'Traffic', ratelimiter: 'Traffic', bff: 'Traffic', tenant: 'Traffic',
  web: 'Compute', app: 'Compute', micro: 'Compute', grpc: 'Compute', ws: 'Compute', worker: 'Compute', scheduler: 'Compute',
  k8s: 'Compute', saga: 'Compute',
  cache: 'Storage', sql: 'Storage', nosql: 'Storage', search: 'Storage', blob: 'Storage', backup: 'Storage',
  queue: 'Async', kafka: 'Async', mq: 'Async', esb: 'Async',
  cdc: 'Data', etl: 'Data', lake: 'Data', warehouse: 'Data', bi: 'Data', analytics: 'Data', billing: 'Data',
  ml: 'AI / ML', embed: 'AI / ML', vector: 'AI / ML', llm: 'AI / ML', guard: 'AI / ML',
  otel: 'Observability', monitor: 'Observability', logs: 'Observability', tracing: 'Observability',
  slo: 'Observability', alert: 'Observability', synthetic: 'Observability', apm: 'Observability',
  iam: 'Security', secrets: 'Security', pii: 'Security', audit: 'Security', siem: 'Security', hsm: 'Security',
  tls: 'Security', crypto: 'Security', hash: 'Security', digest: 'Security', sign: 'Security', e2ee: 'Security',
  partner: 'Enterprise',
  e2e: 'Quality', apitest: 'Quality', load: 'Quality', contract: 'Quality', mock: 'Quality',
  testdata: 'Quality', qgate: 'Quality', dast: 'Quality', devicefarm: 'Quality', testops: 'Quality',
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

// ---- scaling helpers used by the cost panel ----

// Replica count that puts a node at `target` utilization for the traffic it sees.
// Never drops a live tier below 2 — a single instance is a single point of failure,
// which is exactly what the advisor tells you off for.
export function rightSizeReplicas(node, inRps, target = 0.55) {
  const spec = CATALOG[node.type]
  if (!spec || spec.source || !spec.cap) return node.replicas || 1
  if (inRps <= 0) return Math.min(node.replicas || 1, 2)
  const floor = 2
  return Math.max(floor, Math.min(64, Math.ceil(inRps / (spec.cap * target))))
}

// Plan a right-size across the whole design: what changes, and what it saves.
export function rightSizePlan(nodes, sim, mult = 1, target = 0.55) {
  const changes = []
  let before = 0, after = 0
  for (const n of nodes) {
    if (CATALOG[n.type]?.source) continue
    const inRps = sim?.stats?.[n.id]?.in || 0
    const to = rightSizeReplicas(n, inRps, target)
    const from = n.replicas || 1
    before += nodeCost(n, inRps, mult).total
    after += nodeCost({ ...n, replicas: to }, inRps, mult).total
    if (to !== from) changes.push({ id: n.id, label: n.label, from, to })
  }
  return { changes, before, after, delta: after - before }
}

// Multiply every non-source tier's replicas, keeping at least one instance.
export function scaleAll(nodes, factor) {
  return nodes.map(n => {
    if (CATALOG[n.type]?.source) return n
    const cur = n.replicas || 1
    const next = factor >= 1 ? Math.ceil(cur * factor) : Math.floor(cur * factor)
    return { ...n, replicas: Math.max(1, Math.min(64, next)) }
  })
}

// ---- currency ----
// Rates are static approximations, refreshed by hand. The underlying model is
// priced in USD; this is a display conversion, not a live FX feed.
export const CURRENCIES = [
  { code: 'USD', symbol: '$',   rate: 1 },
  { code: 'INR', symbol: '₹',   rate: 88 },
  { code: 'EUR', symbol: '€',   rate: 0.92 },
  { code: 'GBP', symbol: '£',   rate: 0.78 },
  { code: 'JPY', symbol: '¥',   rate: 155 },
  { code: 'AUD', symbol: 'A$',  rate: 1.52 },
  { code: 'CAD', symbol: 'C$',  rate: 1.38 },
  { code: 'SGD', symbol: 'S$',  rate: 1.34 },
  { code: 'AED', symbol: 'AED ', rate: 3.67 },
]
export const currencyByCode = c => CURRENCIES.find(x => x.code === c) || CURRENCIES[0]

let ACTIVE = CURRENCIES[0]
export const setCurrency = code => { ACTIVE = currencyByCode(code) }
export const activeCurrency = () => ACTIVE
export const readCurrency = () => {
  try { const v = localStorage.getItem('archsim.currency'); if (CURRENCIES.some(c => c.code === v)) return v } catch {}
  return 'USD'
}
export const saveCurrency = v => { try { localStorage.setItem('archsim.currency', v) } catch {} }

// Formats a USD amount in the active currency. Indian users get lakh/crore.
export const money = (usd, code) => {
  const c = code ? currencyByCode(code) : ACTIVE
  const v = usd * c.rate
  const s = c.symbol
  if (c.code === 'INR') {
    return v >= 1e7 ? s + (v / 1e7).toFixed(v >= 1e8 ? 0 : 1) + ' Cr'
      : v >= 1e5 ? s + (v / 1e5).toFixed(1) + ' L'
      : v >= 1000 ? s + (v / 1000).toFixed(1) + 'k'
      : v >= 10 ? s + v.toFixed(0)
      : v > 0 ? s + v.toFixed(2) : s + '0'
  }
  return v >= 1e9 ? s + (v / 1e9).toFixed(1) + 'B'
    : v >= 1e6 ? s + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M'
    : v >= 100000 ? s + (v / 1000).toFixed(0) + 'k'
    : v >= 1000 ? s + (v / 1000).toFixed(1) + 'k'
    : v >= 10 ? s + v.toFixed(0)
    : v > 0 ? s + v.toFixed(2)
    : s + '0'
}
