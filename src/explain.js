// Walks the canvas hop by hop and says what each connection does, in the same
// ①②③ order as the step badges — so the numbers on the diagram and the story
// in the panel always agree. Also decides which connections are genuinely
// two-way, so the arrows can say so.
import { CATALOG } from './catalog.js'
import { classifyEdge } from './flow.js'

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const firstClause = s => String(s || '').split(/[.—]/)[0].trim()

// ── two-way detection ──────────────────────────────────────────────────────
// Direction on the canvas means "who initiates". Most hops are request/response
// but drawing every one two-headed would erase that reading, so only hops whose
// semantics are genuinely peer-to-peer get the second arrowhead:
//   • a WebSocket endpoint — the socket pushes both ways for its lifetime
//   • two stores or brokers of the same family — that link is replication
//   • an explicit reverse edge exists — the pair is a conversation
// An explicit e.bidir (true/false) set in the inspector overrides all of it.
const REPLICATION_FAMILIES = [
  new Set(['sql']), new Set(['nosql']), new Set(['cache']),
  new Set(['kafka', 'mq', 'queue']), new Set(['search']), new Set(['vector']),
]
const sameFamily = (a, b) => REPLICATION_FAMILIES.some(f => f.has(a) && f.has(b))

export function bidirReason(edge, edges, byId) {
  if (edge.bidir === true) return 'marked two-way in the inspector'
  if (edge.bidir === false) return null
  const from = byId[edge.from], to = byId[edge.to]
  if (!from || !to) return null
  if (from.type === 'ws' || to.type === 'ws') return 'a persistent socket — frames travel both directions for its lifetime'
  if (sameFamily(from.type, to.type)) return 'replication between peers — each side ships changes to the other'
  if (edges.some(x => x.from === edge.to && x.to === edge.from)) return 'a reverse connection exists — the pair is a two-way conversation'
  return null
}

export const isBidir = (edge, edges, byId) => !!bidirReason(edge, edges, byId)

// ── the walkthrough ────────────────────────────────────────────────────────
// One entry per connection, ordered by the same step numbers the badges show.
export function explainFlow(nodes, edges, stepMap, sim, simOn, rps) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const ordered = [...edges]
    .filter(e => byId[e.from] && byId[e.to])
    .sort((a, b) => (stepMap[a.id] || 999) - (stepMap[b.id] || 999))

  return ordered.map(e => {
    const from = byId[e.from], to = byId[e.to]
    const fromSpec = CATALOG[from.type] || {}, toSpec = CATALOG[to.type] || {}
    const cls = classifyEdge(e, byId)
    const flow = sim?.flowOnEdge?.[e.id] || 0
    const twoWay = bidirReason(e, edges, byId)
    const lines = []

    // What this hop is.
    if (fromSpec.source) {
      lines.push(`**${from.label}** is where traffic enters — ${fmt(rps || 0)} requests per second head toward **${to.label}**.`)
    } else {
      lines.push(`**${from.label}** hands the request to **${to.label}**.`)
    }
    // What the receiving side does with it.
    const doing = firstClause(toSpec.desc)
    if (doing) lines.push(`${toSpec.glyph || ''} ${to.label}: ${doing}.`)
    // The character of the traffic on this hop.
    if (cls === 'async') lines.push('This hop is **asynchronous** — the work leaves the request path here, and the caller does not wait for it.')
    else if (cls === 'read') lines.push('Mostly **reads** — replicas and caches on the far side raise the ceiling for this traffic.')
    else if (cls === 'write') lines.push('Mostly **writes** — consistency, ordering and durability are decided on this hop.')
    // Live numbers when the simulation is running.
    if (simOn && flow > 0) lines.push(`Right now **${fmt(flow)}/s** flows across this connection.`)
    // Two-way, and why.
    if (twoWay) lines.push(`⇆ Two-way: ${twoWay}.`)

    return {
      step: stepMap[e.id] || 0,
      edgeId: e.id,
      fromId: e.from,
      toId: e.to,
      title: `${from.label} → ${to.label}`,
      text: lines,
    }
  })
}
