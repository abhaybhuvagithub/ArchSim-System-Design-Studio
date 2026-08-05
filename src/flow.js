// Filtering the canvas down to one kind of traffic.
//
// "Show me only the write path" is how you actually reason about consistency,
// and it is the question the diagram is worst at answering — every line looks
// the same. Since each connection already carries a read/write mix, the
// classification comes from the design rather than from a label someone
// remembered to set.

import { readFractionOf } from './ddia2.js'

export const FLOW_MODES = [
  { id: 'all',   label: 'All',   hint: 'Every connection.' },
  { id: 'read',  label: 'Read',  hint: 'The path a read takes. Caches and replicas matter here; the write path may vanish entirely.' },
  { id: 'write', label: 'Write', hint: 'The path a write takes. This is where consistency, ordering and durability are decided.' },
  { id: 'async', label: 'Async', hint: 'Work that happens off the request path — queues, streams and the consumers behind them.' },
]

const ASYNC_TYPES = new Set(['queue', 'kafka', 'worker', 'scheduler'])

// An edge is async if either end is queue-like, or it is marked so explicitly.
// Async is a property of the hop, not of the read/write mix, so it is checked
// first — a write into a queue is async, and calling it a write hides that.
export function classifyEdge(edge, byId) {
  if (edge?.async === true) return 'async'
  const from = byId[edge?.from], to = byId[edge?.to]
  if (ASYNC_TYPES.has(from?.type) || ASYNC_TYPES.has(to?.type)) return 'async'
  const r = readFractionOf(edge)
  if (r >= 0.6) return 'read'
  if (r <= 0.4) return 'write'
  return 'mixed'
}

export function edgeMatches(edge, byId, mode) {
  if (mode === 'all') return true
  const c = classifyEdge(edge, byId)
  if (c === 'async') return mode === 'async'
  if (mode === 'async') return false
  // A mixed link carries both, so it belongs to both paths rather than neither.
  return c === mode || c === 'mixed'
}

// Nodes are kept if a surviving edge touches them. An isolated node is kept in
// every mode — hiding something with no connections tells the reader nothing
// and looks like a bug.
export function flowSubset(nodes, edges, mode) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  if (mode === 'all') return { edges: new Set(edges.map(e => e.id)), nodes: new Set(nodes.map(n => n.id)), mode }
  const keptEdges = new Set(), keptNodes = new Set()
  for (const e of edges) {
    if (!edgeMatches(e, byId, mode)) continue
    keptEdges.add(e.id); keptNodes.add(e.from); keptNodes.add(e.to)
  }
  const touched = new Set(edges.flatMap(e => [e.from, e.to]))
  for (const n of nodes) if (!touched.has(n.id)) keptNodes.add(n.id)
  return { edges: keptEdges, nodes: keptNodes, mode }
}

// What the filter is actually hiding, said plainly rather than left to be
// inferred from a dimmed diagram.
export function flowSummary(nodes, edges, mode) {
  const s = flowSubset(nodes, edges, mode)
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  // A connection with no declared mix is genuinely both, so it shows in both
  // views. Guessing from the component type would be wrong often enough to
  // mislead — a lock written into a cache is a write, whatever the cache is.
  const unclassified = edges.filter(e =>
    classifyEdge(e, byId) === 'mixed' && !Number.isFinite(Number(e?.readFrac))).length
  return {
    mode,
    shownEdges: s.edges.size,
    totalEdges: edges.length,
    hiddenEdges: edges.length - s.edges.size,
    shownNodes: s.nodes.size,
    totalNodes: nodes.length,
    unclassified,
  }
}
