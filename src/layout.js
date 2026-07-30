// Layered left-to-right graph layout (Sugiyama-style, trimmed down):
//   1. layer assignment  — longest path from the traffic sources
//   2. ordering          — barycentre sweeps to cut edge crossings
//   3. coordinates       — even spacing, each column centred on the tallest one
import { CATALOG } from './catalog.js'

const NODE_W = 118, NODE_H = 46
const GAP_X = 48, GAP_Y = 24
const ORIGIN_X = 40, ORIGIN_Y = 40

export function autoArrange(nodes, edges) {
  if (!nodes.length) return nodes
  const ids = nodes.map(n => n.id)
  const idSet = new Set(ids)
  const clean = edges.filter(e => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to)

  const outAdj = {}, inAdj = {}
  for (const id of ids) { outAdj[id] = []; inAdj[id] = [] }
  for (const e of clean) { outAdj[e.from].push(e.to); inAdj[e.to].push(e.from) }

  // ---- 1. layers: topological order, then longest path ----
  const indeg = {}
  for (const id of ids) indeg[id] = inAdj[id].length
  const roots = ids.filter(id => indeg[id] === 0)
  const isSource = id => !!CATALOG[nodes.find(n => n.id === id)?.type]?.source
  roots.sort((a, b) => (isSource(b) ? 1 : 0) - (isSource(a) ? 1 : 0))

  const q = [...roots], topo = []
  while (q.length) {
    const id = q.shift()
    topo.push(id)
    for (const t of outAdj[id]) if (--indeg[t] === 0) q.push(t)
  }
  const inTopo = new Set(topo)
  const order0 = [...topo, ...ids.filter(id => !inTopo.has(id))] // cycle members last

  const layer = {}
  for (const id of order0) {
    const preds = inAdj[id].filter(p => layer[p] !== undefined)
    layer[id] = preds.length ? Math.max(...preds.map(p => layer[p])) + 1 : 0
  }
  const maxLayer = Math.max(...ids.map(id => layer[id]))

  // ---- 2. ordering within each layer ----
  let columns = []
  for (let l = 0; l <= maxLayer; l++) columns[l] = ids.filter(id => layer[id] === l)
  // seed from the current vertical order so the result still resembles what you drew
  const yOf = Object.fromEntries(nodes.map(n => [n.id, n.y]))
  for (const col of columns) col.sort((a, b) => yOf[a] - yOf[b])

  const indexMap = cols => {
    const p = {}
    cols.forEach(col => col.forEach((id, i) => { p[id] = i }))
    return p
  }
  // crossings between consecutive layers, from the ordering alone
  const crossings = cols => {
    const p = indexMap(cols)
    let total = 0
    for (let l = 0; l < cols.length - 1; l++) {
      const es = clean.filter(e => layer[e.from] === l && layer[e.to] === l + 1)
      for (let i = 0; i < es.length; i++)
        for (let j = i + 1; j < es.length; j++) {
          const a = es[i], b = es[j]
          if ((p[a.from] - p[b.from]) * (p[a.to] - p[b.to]) < 0) total++
        }
    }
    return total
  }

  let best = columns.map(c => [...c]), bestScore = crossings(columns)
  for (let pass = 0; pass < 12 && bestScore > 0; pass++) {
    const downward = pass % 2 === 0
    const sweep = downward ? columns.map((_, i) => i) : columns.map((_, i) => i).reverse()
    for (const l of sweep) {
      const p = indexMap(columns)
      const adj = downward ? inAdj : outAdj
      const scored = columns[l].map((id, i) => {
        const ns = adj[id].filter(n => p[n] !== undefined)
        return { id, b: ns.length ? ns.reduce((s, n) => s + p[n], 0) / ns.length : i, i }
      })
      scored.sort((a, b) => a.b - b.b || a.i - b.i)
      columns[l] = scored.map(s => s.id)
    }
    const score = crossings(columns)
    if (score < bestScore) { bestScore = score; best = columns.map(c => [...c]) }
  }
  columns = best

  // polish: adjacent swaps kept only when they reduce crossings
  let improving = true
  while (improving && bestScore > 0) {
    improving = false
    for (let l = 0; l < columns.length; l++) {
      for (let i = 0; i + 1 < columns[l].length; i++) {
        const trial = columns.map(c => [...c])
        ;[trial[l][i], trial[l][i + 1]] = [trial[l][i + 1], trial[l][i]]
        const score = crossings(trial)
        if (score < bestScore) { columns = trial; bestScore = score; improving = true }
      }
    }
  }

  // ---- 3. coordinates ----
  const tallest = Math.max(...columns.map(c => c.length))
  const laidOut = {}
  columns.forEach((col, l) => {
    const colHeight = col.length * NODE_H + (col.length - 1) * GAP_Y
    const fullHeight = tallest * NODE_H + (tallest - 1) * GAP_Y
    const offsetY = ORIGIN_Y + (fullHeight - colHeight) / 2
    col.forEach((id, i) => {
      laidOut[id] = {
        x: Math.round(ORIGIN_X + l * (NODE_W + GAP_X)),
        y: Math.round(offsetY + i * (NODE_H + GAP_Y)),
      }
    })
  })

  return nodes.map(n => ({ ...n, ...laidOut[n.id] }))
}

// How many edge pairs cross — used to prove the layout actually helps.
export function countCrossings(nodes, edges) {
  const at = Object.fromEntries(nodes.map(n => [n.id, n]))
  const segs = edges
    .filter(e => at[e.from] && at[e.to])
    .map(e => ({
      x1: at[e.from].x + NODE_W, y1: at[e.from].y + NODE_H / 2,
      x2: at[e.to].x, y2: at[e.to].y + NODE_H / 2,
      from: e.from, to: e.to,
    }))
  let n = 0
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i], b = segs[j]
      if (a.from === b.from || a.to === b.to || a.from === b.to || a.to === b.from) continue
      if (intersects(a, b)) n++
    }
  return n
}
const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
const intersects = (a, b) =>
  ccw(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2) !== ccw(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2) &&
  ccw(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) !== ccw(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)

export const LAYOUT_CONST = { NODE_W, NODE_H, GAP_X, GAP_Y }
