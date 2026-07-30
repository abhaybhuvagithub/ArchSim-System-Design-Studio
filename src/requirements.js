// Turns a requirement sentence into an architectural change.
// Ticking a checklist item works out which component that requirement implies,
// drops it on the canvas and wires it in; unticking removes what it added.
import { CATALOG } from './catalog.js'
import { addComponent } from './advisor.js'

// Ordered — first match wins, so put the specific phrases above the generic ones.
const RULES = [
  [/\bhsm\b|pin block|key custody|pin never/i,                    'hsm',        'HSM'],
  [/tokeni[sz]|\bpan\b|pci scope|pii/i,                           'pii',        'Tokenization Vault'],
  [/audit|tamper-evident|dispute trail|who did what/i,            'audit',      'Audit Log'],
  [/\bsiem\b|threat hunt|security analytics/i,                    'siem',       'SIEM'],
  [/\bwaf\b|bot |ddos|scraping|owasp/i,                           'waf',        'WAF / DDoS'],
  [/\bsso\b|identity provider|oidc|saml|device binding|\bmfa\b/i, 'iam',        'Identity (SSO)'],
  [/secret|credential rotation|\bkms\b|vault/i,                   'secrets',    'Secrets / KMS'],
  [/backup|point-in-time|restore|ransomware/i,                    'backup',     'Backup & Archive'],
  [/rate.?limit|throttl|noisy tenant|quota|tps cap/i,             'ratelimiter','Rate Limiter'],
  [/idempoten/i,                                                  'cache',      'Idempotency Keys'],
  [/\bcdn\b|edge cache|static asset|image/i,                      'cdn',        'CDN'],
  [/geo.?index|geohash|quadtree|\bh3\b|nearest|proximity/i,       'cache',      'Geo Index'],
  [/cache|hit ratio|read.?heavy|read:write/i,                     'cache',      'Cache'],
  [/outbox|dual-write/i,                                          'queue',      'Outbox'],
  [/dead.?letter|\bdlq\b|poison message/i,                        'queue',      'Dead Letter Queue'],
  [/event stream|kafka|replay|event log|partition key/i,          'kafka',      'Event Stream'],
  [/\bqueue\b|async|buffer|absorb (a )?(spike|burst)|decoupl/i,   'queue',      'Queue'],
  [/saga|compensating|distributed transaction/i,                  'saga',       'Saga Orchestrator'],
  [/\bmq\b|guaranteed delivery|transactional messaging/i,         'mq',         'Enterprise MQ'],
  [/\bcdc\b|debezium|change data capture/i,                       'cdc',        'CDC Connector'],
  [/warehouse|\bbi\b|reporting quer|analytic/i,                   'warehouse',  'Data Warehouse'],
  [/data lake|raw zone|bronze|schema-on-read/i,                   'lake',       'Data Lake'],
  [/\betl\b|\belt\b|transform/i,                                  'etl',        'ELT Transform'],
  [/search|elasticsearch|inverted index|full-text|discovery/i,    'search',     'Search Index'],
  [/vector|embedding|\bann\b|retriev/i,                           'vector',     'Vector DB'],
  [/\bllm\b|prompt|guardrail|token generation|text generation|hallucinat/i, 'llm', 'LLM Inference'],
  [/\bml\b|model|ranking|personalis|personaliz|\beta\b|fraud|recommend/i, 'ml', 'ML Service'],
  [/observab|metric|monitor|golden signal/i,                      'monitor',    'Metrics & Alerts'],
  [/\blog\b|logs |log retention|log pipeline/i,                   'logs',       'Log Pipeline'],
  [/trace|span|correlat/i,                                        'tracing',    'Tracing'],
  [/\bslo\b|error budget|burn rate/i,                             'slo',        'SLO / Error Budget'],
  [/alert|page |on-?call|pager/i,                                 'alert',      'On-call / Paging'],
  [/synthetic|probe|outside the network|uptime check/i,           'synthetic',  'Synthetic Probes'],
  [/load balanc|drain an instance|spread traffic/i,               'lb',         'Load Balancer'],
  [/object storage|blob|chunk|upload|media|\bs3\b/i,              'blob',       'Object Storage'],
  [/worker|transcode|batch job|background/i,                      'worker',     'Worker Pool'],
  [/websocket|persistent connection|live tracking|realtime push/i,'ws',         'WebSocket Svc'],
  [/service discovery|registry|hard-coded host/i,                 'registry',   'Service Registry'],
  [/service mesh|sidecar|mtls|circuit break/i,                    'mesh',       'Service Mesh'],
  [/config|feature flag/i,                                        'config',     'Config Server'],
  [/scheduler|cron|dag|orchestrator owns/i,                       'scheduler',  'Scheduler'],
  [/kubernetes|container platform|autoscal/i,                     'k8s',        'Container Platform'],
  [/partner|bank api|acquirer|\bgds\b|supplier|switch|third.?party|\bupi\b|\bnpci\b/i, 'partner', 'Partner API'],
  [/mainframe|\bpss\b|core banking|cobol/i,                       'mainframe',  'Mainframe Core'],
  [/\berp\b|\bsap\b/i,                                            'erp',        'ERP'],
  [/\bcrm\b|salesforce/i,                                         'crm',        'CRM'],
  [/replica|shard|single point of failure|spof|redundan/i,        'SCALE',      ''],
]

// Requirements that are really capacity estimates — these set the traffic level.
const RATE = /estimate|≈|\bqps\b|\brps\b|req(uests)?\/s|reads?\/s|writes?\/s|per (second|day|month)|tps\b/i

// Pull a requests-per-second figure out of a sentence like
// "100M new URLs/month ≈ 40 writes/s, 4k reads/s" → 4000.
export function parseRate(text) {
  const num = s => {
    const m = /^([\d.]+)\s*([kmb])?/i.exec(s.trim())
    if (!m) return null
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1
    return parseFloat(m[1]) * mult
  }
  let best = 0
  // explicit per-second rates
  for (const m of text.matchAll(/([\d.]+\s*[kmb]?)\s*(?:\+\s*)?(?:req(?:uests)?|reads?|writes?|fetch(?:es)?|msg|tps|qps|rps)?\s*(?:\/s\b|per second|\bqps\b|\brps\b|\btps\b)/gi)) {
    const v = num(m[1]); if (v) best = Math.max(best, v)
  }
  // volumes over a period
  for (const m of text.matchAll(/([\d.]+\s*[kmb]?)[^,;]{0,40}?\/\s*(day|month)|([\d.]+\s*[kmb]?)[^,;]{0,24}?per\s+(day|month)/gi)) {
    const v = num(m[1] || m[3] || '')
    const period = (m[2] || m[4] || '').toLowerCase()
    if (v) best = Math.max(best, v / (period === 'day' ? 86400 : 2628000))
  }
  if (!best) return null
  return Math.max(100, Math.min(1e6, Math.round(best)))
}

// Last resort: an unmatched functional requirement means "you need a service for this".
function serviceLabel(text) {
  const head = text.split(/[:—(-]/)[0].replace(/[^a-zA-Z0-9 /]/g, ' ').trim()
  const words = head.split(/\s+/).filter(Boolean).slice(0, 3)
  const name = words.map(w => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
  return (name.length > 20 ? name.slice(0, 19) + '…' : name) || 'Service'
}

const scaleEffect = (target, to) => ({
  kind: 'scale', id: target.id, to,
  hint: `⤴ ${target.label} → ${to}×`,
})

// What ticking this requirement will do to the diagram. Always returns something.
export function requirementEffect(text, nodes, rps = 0) {
  // 1. capacity estimates drive the traffic slider
  if (RATE.test(text)) {
    const v = parseRate(text)
    if (v && Math.abs(v - rps) > Math.max(50, rps * 0.02)) {
      return { kind: 'rps', value: v, hint: `⇢ traffic ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v} rps` }
    }
  }

  for (const [re, type, label] of RULES) {
    if (!re.test(text)) continue

    if (type === 'SCALE') {
      const target = nodes.find(n => ['sql', 'nosql'].includes(n.type) && (n.replicas || 1) < 3)
        || nodes.find(n => !CATALOG[n.type]?.source && (n.replicas || 1) < 3)
      if (target) return scaleEffect(target, 3)
      continue
    }
    if (!CATALOG[type]) continue

    // already present → reinforce it instead of doing nothing
    const existing = nodes.filter(n => n.type === type)
      .sort((a, b) => (a.replicas || 1) - (b.replicas || 1))[0]
    if (existing) {
      const to = Math.min(64, Math.max(2, (existing.replicas || 1) + 2))
      if (to > (existing.replicas || 1)) return scaleEffect(existing, to)
      continue
    }
    return { kind: 'add', type, label, hint: `+ ${CATALOG[type].name}` }
  }

  // 2. nothing matched — treat it as a capability that needs its own service
  const label = serviceLabel(text)
  if (nodes.some(n => n.label === label)) {
    const dup = nodes.find(n => n.label === label)
    const to = Math.min(64, (dup.replicas || 1) + 2)
    return to > (dup.replicas || 1) ? scaleEffect(dup, to) : null
  }
  return { kind: 'add', type: 'micro', label, hint: `+ ${label}` }
}

// Apply it. Returns { nodes, edges, added, scaled, rps, prevRps, focus }.
export function applyRequirement(nodes, edges, text, rps = 0) {
  const eff = requirementEffect(text, nodes, rps)
  if (!eff) return null

  if (eff.kind === 'rps') {
    return { nodes, edges, added: [], scaled: null, rps: eff.value, prevRps: rps, focus: null }
  }
  if (eff.kind === 'scale') {
    const before = nodes.find(n => n.id === eff.id)?.replicas || 1
    return {
      nodes: nodes.map(n => (n.id === eff.id ? { ...n, replicas: eff.to } : n)),
      edges, added: [], scaled: { id: eff.id, from: before, to: eff.to }, focus: eff.id,
    }
  }
  const r = addComponent(nodes, edges, eff.type, eff.label)
  if (!r) return null
  return { nodes: r.nodes, edges: r.edges, added: r.added || [], scaled: null, focus: r.focus }
}

// Undo: drop the nodes this requirement introduced (and any dangling edges),
// restore a scaled component, or put the traffic level back.
export function undoRequirement(nodes, edges, record) {
  if (!record) return null
  if (record.prevRps !== undefined && record.prevRps !== null) {
    return { nodes, edges, rps: record.prevRps }
  }
  if (record.scaled) {
    return {
      nodes: nodes.map(n => (n.id === record.scaled.id ? { ...n, replicas: record.scaled.from } : n)),
      edges,
    }
  }
  const drop = new Set(record.added || [])
  if (!drop.size) return null
  return {
    nodes: nodes.filter(n => !drop.has(n.id)),
    edges: edges.filter(e => !drop.has(e.from) && !drop.has(e.to)),
  }
}
