// ── Diagrams-as-Code interop ────────────────────────────────────────────────
// Every DaC tool renders text into a picture. ArchSim runs the picture.
// Mermaid out (READMEs render it natively), Mermaid in (a README flowchart
// becomes a live simulation, component types inferred), Excalidraw out
// (the interview whiteboard, pre-drawn). All pure; the suite round-trips it.
import { CATALOG } from './catalog.js'

const ASYNC = new Set(['kafka', 'queue', 'worker', 'stream', 'batch', 'etl'])
const mid = (s) => String(s).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, 'n$1') || 'n'

export function toMermaid(nodes, edges) {
  const ids = new Map()
  const used = new Set()
  for (const n of nodes) {
    let id = mid(n.id); let k = 2
    while (used.has(id)) id = mid(n.id) + '_' + k++
    used.add(id); ids.set(n.id, id)
  }
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const out = []
  out.push(`%% ArchSim — ${nodes.length} components, ${edges.length} edges. Paste back into ArchSim to simulate.`)
  out.push(`%% archsim:types ${nodes.map(n => `${ids.get(n.id)}=${n.type}${n.replicas ? '*' + n.replicas : ''}`).join(',')}`)
  out.push('flowchart LR')
  for (const n of nodes) {
    const spec = CATALOG[n.type] || {}
    const label = `${spec.glyph || ''} ${n.label || spec.name || n.id}`.trim().replace(/"/g, "'")
    out.push(`  ${ids.get(n.id)}["${label}"]`)
  }
  for (const e of edges) {
    const from = e.from ?? e[0], to = e.to ?? e[1]
    if (!ids.has(from) || !ids.has(to)) continue
    const async = ASYNC.has(byId[to]?.type)
    const lbl = e.label ? `|${String(e.label).replace(/\|/g, '/')}|` : ''
    out.push(`  ${ids.get(from)} ${async ? '-.->' : '-->'}${lbl} ${ids.get(to)}`)
  }
  return out.join('\n') + '\n'
}

// Type inference for diagrams that carry no ArchSim hints: names are data.
const INFER = [
  [/\b(user|users|client|clients|mobile|browser|customer|app users|seekers)\b/i, 'client'],
  [/\b(cdn|edge cache|cloudfront|fastly)\b/i, 'cdn'],
  [/\b(load ?balancer|\blb\b|alb|nlb|nginx|haproxy|envoy)\b/i, 'lb'],
  [/\b(gateway|api gw|apigw|kong|ingress)\b/i, 'gateway'],
  [/\b(redis|memcache|cache)\b/i, 'cache'],
  [/\b(kafka|kinesis|pulsar|event stream|stream)\b/i, 'kafka'],
  [/\b(queue|sqs|rabbit|rabbitmq|celery|jobs)\b/i, 'queue'],
  [/\b(worker|consumer|cron|batch|processor)\b/i, 'worker'],
  [/\b(vector|pinecone|weaviate|embedding|embeddings|milvus|qdrant)\b/i, 'vector'],
  [/\b(llm|gpt|claude|model|inference|openai)\b/i, 'llm'],
  [/\b(elastic|elasticsearch|opensearch|search|solr)\b/i, 'search'],
  [/\b(s3|blob|bucket|object storage|gcs|minio|files|storage)\b/i, 'blob'],
  [/\b(mongo|mongodb|dynamo|dynamodb|cassandra|nosql|document db|firestore)\b/i, 'nosql'],
  [/\b(postgres|postgresql|mysql|sql|database|\bdb\b|rds|oracle|maria)\b/i, 'sql'],
  [/\b(websocket|\bws\b|socket|realtime)\b/i, 'ws'],
  [/\b(ledger)\b/i, 'ledger'],
  [/\b(auth|sso|identity|iam|oauth)\b/i, 'iam'],
]
export function inferType(label) {
  for (const [rx, t] of INFER) if (rx.test(label) && CATALOG[t]) return t
  return 'app'
}

// A forgiving Mermaid flowchart reader: node defs in any bracket shape,
// chained edges, optional |labels|, and our own %% archsim:types hint.
export function fromMermaid(text) {
  if (!text || !/\b(flowchart|graph)\b/i.test(text)) return null
  const hints = {}
  const hm = text.match(/%%\s*archsim:types\s+([^\n]+)/)
  if (hm) for (const part of hm[1].split(',')) {
    const [id, rest] = part.trim().split('=')
    if (!id || !rest) continue
    const [type, rep] = rest.split('*')
    hints[id] = { type, replicas: rep ? parseInt(rep, 10) : undefined }
  }
  const labels = new Map()
  const order = []
  const seen = (id) => { if (!labels.has(id)) { labels.set(id, null); order.push(id) } }
  const NODE_DEF = /([A-Za-z_][\w-]*)\s*(?:\[\[?"?([^\]"]+?)"?\]?\]|\(\(?"?([^)"]+?)"?\)?\)|\{"?([^}"]+?)"?\}|>"?([^\]"]+?)"?\])/g
  const edgesOut = []
  for (let raw of text.split('\n')) {
    const line = raw.replace(/%%.*$/, '').trim()
    if (!line || /^(flowchart|graph)\b/i.test(line) || /^(subgraph|end|classDef|class|style|linkStyle|click)\b/i.test(line)) continue
    // collect labelled node definitions anywhere on the line
    let m
    NODE_DEF.lastIndex = 0
    while ((m = NODE_DEF.exec(line))) {
      const id = m[1]; const label = (m[2] || m[3] || m[4] || m[5] || '').trim()
      seen(id); if (label) labels.set(id, label)
    }
    // edges: split the line on arrow tokens, tolerating |labels|
    const parts = line.split(/\s*(?:-->|-\.->|==>|---|-\.-|===|-->>|<-->)\s*(?:\|[^|]*\|\s*)?/)
    if (parts.length > 1) {
      const idOf = (chunk) => { const mm = chunk.trim().match(/^([A-Za-z_][\w-]*)/); return mm ? mm[1] : null }
      for (let i = 0; i < parts.length - 1; i++) {
        const a = idOf(parts[i]), b = idOf(parts[i + 1])
        if (!a || !b) continue
        for (const x of parts[i].split('&')) { const xi = idOf(x); if (xi) seen(xi) }
        for (const y of parts[i + 1].split('&')) { const yi = idOf(y); if (yi) seen(yi) }
        const as = parts[i].split('&').map(idOf).filter(Boolean)
        const bs = parts[i + 1].split('&').map(idOf).filter(Boolean)
        for (const fa of as) for (const tb of bs) if (fa !== tb) edgesOut.push([fa, tb])
      }
    }
  }
  if (order.length < 2) return null
  // layered layout: BFS depth from sources, left to right
  const inbound = new Set(edgesOut.map(([, b]) => b))
  const depth = {}
  const roots = order.filter(id => !inbound.has(id))
  const queue = (roots.length ? roots : [order[0]]).map(id => [id, 0])
  while (queue.length) {
    const [id, d] = queue.shift()
    if (depth[id] !== undefined && depth[id] <= d) continue
    depth[id] = d
    for (const [a, b] of edgesOut) if (a === id) queue.push([b, d + 1])
  }
  for (const id of order) if (depth[id] === undefined) depth[id] = 0
  const perCol = {}
  const nodes = order.map((id) => {
    const label = (labels.get(id) || id).replace(/^\S+\s(?=[A-Za-z])/, (g) => /^[A-Za-z]/.test(g) ? g : '') // strip a leading glyph
    const clean = label.replace(/^[^\w(]+\s*/, '') || id
    const hint = hints[id]
    const type = hint?.type && CATALOG[hint.type] ? hint.type : inferType(`${id} ${clean}`)
    const col = depth[id]; perCol[col] = (perCol[col] || 0) + 1
    const spec = CATALOG[type] || {}
    const n = { id: mid(id), type, label: clean.slice(0, 40), x: 60 + col * 150, y: 60 + (perCol[col] - 1) * 95 }
    if (spec.cap && type !== 'client') n.replicas = hint?.replicas || 2
    return n
  })
  const idmap = Object.fromEntries(order.map(id => [id, mid(id)]))
  const edges = edgesOut.map(([a, b]) => ({ id: `${idmap[a]}->${idmap[b]}`, from: idmap[a], to: idmap[b], label: '' }))
    .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
  return { nodes, edges }
}

// Excalidraw scene: one rounded rectangle + bound text per node, one arrow per edge.
export function toExcalidraw(nodes, edges) {
  const S = 1.5, W = 170, H = 64
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280)
  const base = (type, x, y, w, h) => ({
    id: '', type, x, y, width: w, height: h, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
    fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null,
    roundness: null, seed: rnd(), version: 1, versionNonce: rnd(), isDeleted: false, boundElements: [], updated: 1, link: null, locked: false,
  })
  const els = []
  const rectOf = {}
  for (const n of nodes) {
    const spec = CATALOG[n.type] || {}
    const x = n.x * S, y = n.y * S
    const rect = { ...base('rectangle', x, y, W, H), id: `rect_${mid(n.id)}`, roundness: { type: 3 }, strokeColor: spec.color || '#1e1e1e', backgroundColor: '#ffffff' }
    const text = { ...base('text', x + 8, y + 18, W - 16, 28), id: `text_${mid(n.id)}`, text: `${spec.glyph || ''} ${n.label || spec.name || n.id}${n.replicas ? ` ×${n.replicas}` : ''}`.trim(),
      fontSize: 14, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', containerId: rect.id, originalText: '', lineHeight: 1.25 }
    text.originalText = text.text
    rect.boundElements = [{ id: text.id, type: 'text' }]
    rectOf[n.id] = rect
    els.push(rect, text)
  }
  for (const e of edges) {
    const from = e.from ?? e[0], to = e.to ?? e[1]
    const a = rectOf[from], b = rectOf[to]
    if (!a || !b) continue
    const ax = a.x + W, ay = a.y + H / 2, bx = b.x, by = b.y + H / 2
    const arrow = { ...base('arrow', ax, ay, Math.abs(bx - ax), Math.abs(by - ay)), id: `arrow_${mid(from)}_${mid(to)}`,
      points: [[0, 0], [bx - ax, by - ay]], startBinding: { elementId: a.id, focus: 0, gap: 4 }, endBinding: { elementId: b.id, focus: 0, gap: 4 },
      startArrowhead: null, endArrowhead: 'arrow', lastCommittedPoint: null, elbowed: false,
      strokeStyle: ASYNC.has(nodes.find(n => n.id === to)?.type) ? 'dashed' : 'solid' }
    a.boundElements.push({ id: arrow.id, type: 'arrow' }); b.boundElements.push({ id: arrow.id, type: 'arrow' })
    els.push(arrow)
  }
  return JSON.stringify({ type: 'excalidraw', version: 2, source: 'https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/', elements: els, appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {} }, null, 2)
}
