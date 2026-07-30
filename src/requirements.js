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

// What ticking this requirement will do to the diagram.
export function requirementEffect(text, nodes) {
  for (const [re, type, label] of RULES) {
    if (!re.test(text)) continue
    if (type === 'SCALE') {
      const target = nodes.find(n => ['sql', 'nosql'].includes(n.type) && (n.replicas || 1) < 3)
      return target ? { kind: 'scale', id: target.id, label: `Replicate ${target.label}` } : null
    }
    if (!CATALOG[type]) return null
    if (nodes.some(n => n.type === type)) return null   // requirement already satisfied
    return { kind: 'add', type, label, hint: `+ ${CATALOG[type].name}` }
  }
  return null
}

// Apply it. Returns { nodes, edges, added, scaled } or null when nothing to do.
export function applyRequirement(nodes, edges, text) {
  const eff = requirementEffect(text, nodes)
  if (!eff) return null
  if (eff.kind === 'scale') {
    const before = nodes.find(n => n.id === eff.id)?.replicas || 1
    return {
      nodes: nodes.map(n => (n.id === eff.id ? { ...n, replicas: 3 } : n)),
      edges, added: [], scaled: { id: eff.id, from: before, to: 3 }, focus: eff.id,
    }
  }
  const r = addComponent(nodes, edges, eff.type, eff.label)
  if (!r) return null
  return { nodes: r.nodes, edges: r.edges, added: r.added || [], scaled: null, focus: r.focus }
}

// Undo: drop the nodes this requirement introduced (and any dangling edges),
// or put a scaled component back the way it was.
export function undoRequirement(nodes, edges, record) {
  if (!record) return null
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
