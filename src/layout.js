// Layered left-to-right graph layout (Sugiyama).
//
//   1. layering     — longest path from the traffic sources, cycles broken
//   2. properness   — an edge spanning several layers becomes a chain of
//                     dummy nodes, one per intermediate layer
//   3. ordering     — median and barycentre sweeps plus transpose, minimising
//                     crossings between adjacent layers
//   4. coordinates  — priority-based median alignment, so edges run straight
//
// Step 2 is the one that matters most. Without dummies a long edge sweeps
// across every column it passes over — crossing whatever happens to be there
// — and, worse, the crossing counter never sees it, because counting only
// looks at adjacent layers. Making the graph proper first means the count is
// exact for the whole graph and long edges get a reserved lane to travel in.
import { CATALOG } from './catalog.js'

const NODE_W = 118, NODE_H = 46
const GAP_X = 48, GAP_Y = 24
const ORIGIN_X = 40, ORIGIN_Y = 40
const SLOT = NODE_H + GAP_Y          // vertical pitch of a real node
const DUMMY_SLOT = 16                // a lane for a long edge to pass through

// Applying the layout can change the vertical order it would seed from next
// time, so a single pass is not necessarily a fixed point. Iterate to one, so
// that pressing Arrange twice never moves anything the second time.
export function autoArrange(nodes, edges) {
  if (!nodes.length) return nodes
  let cur = arrangeOnce(nodes, edges)
  for (let i = 0; i < 5; i++) {
    const next = arrangeOnce(cur, edges)
    if (next.every((n, j) => n.x === cur[j].x && n.y === cur[j].y)) break
    cur = next
  }
  return cur
}

function arrangeOnce(nodes, edges) {
  const idSet = new Set(nodes.map(n => n.id))
  const clean = edges.filter(e => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to)
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

  // ---- 1. layering -----------------------------------------------------------
  const outAdj = {}, inAdj = {}
  for (const n of nodes) { outAdj[n.id] = []; inAdj[n.id] = [] }
  for (const e of clean) { outAdj[e.from].push(e.to); inAdj[e.to].push(e.from) }

  const indeg = Object.fromEntries(nodes.map(n => [n.id, inAdj[n.id].length]))
  const isSource = id => !!CATALOG[byId[id]?.type]?.source
  const q = nodes.filter(n => indeg[n.id] === 0).map(n => n.id)
    .sort((a, b) => (isSource(b) ? 1 : 0) - (isSource(a) ? 1 : 0))
  const topo = []
  const pending = { ...indeg }
  while (q.length) {
    const id = q.shift()
    topo.push(id)
    for (const t of outAdj[id]) if (--pending[t] === 0) q.push(t)
  }
  const seen = new Set(topo)
  const order0 = [...topo, ...nodes.map(n => n.id).filter(id => !seen.has(id))]

  const layer = {}
  for (const id of order0) {
    const preds = inAdj[id].filter(p => layer[p] !== undefined)
    layer[id] = preds.length ? Math.max(...preds.map(p => layer[p])) + 1 : 0
  }
  const maxLayer = Math.max(...Object.values(layer))

  // ---- 2. make the graph proper ---------------------------------------------
  // Every link below spans exactly one layer, real node or dummy.
  const links = []                       // { a, b } between consecutive layers
  const cols = Array.from({ length: maxLayer + 1 }, () => [])
  const isDummy = {}
  const yHint = {}
  // Seed from vertical *rank* rather than raw y, so the result still resembles
  // what you drew but arranging an already-arranged diagram is a fixed point.
  // Seeding from raw y is not: the second run sees different spacing, seeds the
  // dummy lanes differently, and drifts.
  const rank = {}
  ;[...nodes].sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1))
    .forEach((n, i) => { rank[n.id] = i })
  for (const n of nodes) { cols[layer[n.id]].push(n.id); isDummy[n.id] = false; yHint[n.id] = rank[n.id] }

  let dummySeq = 0
  for (const e of clean) {
    const la = layer[e.from], lb = layer[e.to]
    if (lb <= la) continue               // back edge or same layer: not orderable
    if (lb - la === 1) { links.push({ a: e.from, b: e.to }); continue }
    let prev = e.from
    for (let l = la + 1; l < lb; l++) {
      const d = `__d${dummySeq++}`
      isDummy[d] = true
      // sit the lane on the straight line between the two endpoints, in rank space
      yHint[d] = rank[e.from] + (rank[e.to] - rank[e.from]) * ((l - la) / (lb - la))
      cols[l].push(d)
      links.push({ a: prev, b: d })
      prev = d
    }
    links.push({ a: prev, b: e.to })
  }

  const linksByLayer = Array.from({ length: maxLayer + 1 }, () => [])
  for (const lk of links) linksByLayer[layer[lk.a] ?? layerOf(lk.a)].push(lk)
  function layerOf(key) {                // dummies are not in `layer`
    for (let l = 0; l <= maxLayer; l++) if (cols[l].includes(key)) return l
    return 0
  }
  // index dummies into `layer` so lookups downstream are cheap
  cols.forEach((col, l) => col.forEach(k => { if (layer[k] === undefined) layer[k] = l }))
  linksByLayer.forEach(a => (a.length = 0))
  for (const lk of links) linksByLayer[layer[lk.a]].push(lk)

  const nbrDown = {}, nbrUp = {}
  for (const col of cols) for (const k of col) { nbrDown[k] = []; nbrUp[k] = [] }
  for (const lk of links) { nbrDown[lk.a].push(lk.b); nbrUp[lk.b].push(lk.a) }

  // ---- 3. ordering -----------------------------------------------------------
  for (const col of cols) col.sort((a, b) => yHint[a] - yHint[b])

  const pos = {}
  const reindex = () => cols.forEach(col => col.forEach((k, i) => { pos[k] = i }))
  reindex()

  // crossings between layer l and l+1 — exact, because the graph is proper
  const crossAt = l => {
    const es = linksByLayer[l]
    let n = 0
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++) {
        const d = (pos[es[i].a] - pos[es[j].a]) * (pos[es[i].b] - pos[es[j].b])
        if (d < 0) n++
      }
    return n
  }
  const totalCross = () => {
    let n = 0
    for (let l = 0; l < maxLayer; l++) n += crossAt(l)
    return n
  }

  const snapshot = () => cols.map(c => [...c])
  const restore = s => { s.forEach((c, i) => { cols[i] = [...c] }); reindex() }

  let best = snapshot(), bestScore = totalCross()

  for (let pass = 0; pass < 24 && bestScore > 0; pass++) {
    const down = pass % 2 === 0
    const useMedian = pass % 4 < 2          // alternate median and barycentre
    const order = down
      ? cols.map((_, i) => i).slice(1)
      : cols.map((_, i) => i).slice(0, -1).reverse()

    for (const l of order) {
      const adj = down ? nbrUp : nbrDown
      const scored = cols[l].map((k, i) => {
        const ns = adj[k].map(x => pos[x]).filter(v => v !== undefined).sort((a, b) => a - b)
        let v = i
        if (ns.length) {
          v = useMedian
            ? (ns.length % 2 ? ns[(ns.length - 1) / 2] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2)
            : ns.reduce((s, x) => s + x, 0) / ns.length
        }
        return { k, v, i }
      })
      scored.sort((a, b) => a.v - b.v || a.i - b.i)
      cols[l] = scored.map(s => s.k)
      reindex()
    }

    transpose()
    const score = totalCross()
    if (score < bestScore) { bestScore = score; best = snapshot() }
  }
  restore(best)

  // adjacent swaps kept only when they reduce crossings on the two layer pairs
  // the swap can affect — local, so this stays cheap even on big graphs
  function transpose() {
    let improved = true, guard = 0
    while (improved && guard++ < 8) {
      improved = false
      for (let l = 0; l <= maxLayer; l++) {
        for (let i = 0; i + 1 < cols[l].length; i++) {
          const before = (l > 0 ? crossAt(l - 1) : 0) + (l < maxLayer ? crossAt(l) : 0)
          const c = cols[l]
          ;[c[i], c[i + 1]] = [c[i + 1], c[i]]
          pos[c[i]] = i; pos[c[i + 1]] = i + 1
          const after = (l > 0 ? crossAt(l - 1) : 0) + (l < maxLayer ? crossAt(l) : 0)
          if (after < before) improved = true
          else { [c[i], c[i + 1]] = [c[i + 1], c[i]]; pos[c[i]] = i; pos[c[i + 1]] = i + 1 }
        }
      }
    }
  }
  transpose()

  // ---- 4. coordinates --------------------------------------------------------
  // Start from evenly stacked columns, then repeatedly pull each node towards
  // the median of its neighbours and push overlaps apart. Dummy nodes are
  // pulled hardest, which is what straightens the long edges.
  const y = {}
  const height = k => (isDummy[k] ? DUMMY_SLOT : SLOT)
  for (const col of cols) {
    let cursor = 0
    for (const k of col) { y[k] = cursor + height(k) / 2; cursor += height(k) }
  }

  const priority = k => (isDummy[k] ? 1e6 : 1 + (nbrUp[k].length + nbrDown[k].length))

  for (let iter = 0; iter < 40; iter++) {
    const down = iter % 2 === 0
    const order = down ? cols.map((_, i) => i) : cols.map((_, i) => i).reverse()
    for (const l of order) {
      const adj = down ? nbrUp : nbrDown
      const want = new Map()
      for (const k of cols[l]) {
        const ns = adj[k].map(x => y[x]).filter(v => v !== undefined).sort((a, b) => a - b)
        if (!ns.length) continue
        const med = ns.length % 2 ? ns[(ns.length - 1) / 2] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2
        want.set(k, med)
      }
      // move towards the target, then restore separation in fixed order
      for (const k of cols[l]) if (want.has(k)) {
        const w = priority(k) / (priority(k) + 40)
        y[k] += (want.get(k) - y[k]) * w
      }
      separate(cols[l])
    }
  }

  function separate(col) {
    for (let i = 1; i < col.length; i++) {
      const min = y[col[i - 1]] + height(col[i - 1]) / 2 + height(col[i]) / 2
      if (y[col[i]] < min) y[col[i]] = min
    }
    for (let i = col.length - 2; i >= 0; i--) {
      const max = y[col[i + 1]] - height(col[i + 1]) / 2 - height(col[i]) / 2
      if (y[col[i]] > max) y[col[i]] = max
    }
  }

  // normalise so the drawing starts at the origin
  const realKeys = nodes.map(n => n.id)
  const minY = Math.min(...realKeys.map(k => y[k] - NODE_H / 2))
  const laidOut = {}
  for (const n of nodes) {
    laidOut[n.id] = {
      x: Math.round(ORIGIN_X + layer[n.id] * (NODE_W + GAP_X)),
      y: Math.round(ORIGIN_Y + y[n.id] - NODE_H / 2 - minY),
    }
  }
  let out = nodes.map(n => ({ ...n, ...laidOut[n.id] }))

  // ---- 5. geometric polish ---------------------------------------------------
  // Ordering minimises crossings under the assumption that a column is an
  // evenly stacked list. Straightening then moves nodes off those slots, which
  // can reintroduce a crossing the ordering counter cannot see, because it
  // counts permutations rather than actual line segments. So finish by
  // optimising what is actually drawn: swap adjacent nodes within a column and
  // keep the swap only if the real geometry improves.
  out = polish(out, clean)
  return out
}

// An edge crossing another edge is normal and readable; an edge running through
// a node's body is genuinely confusing, so it is weighted slightly higher. On
// the current template library the two weightings happen to reach the same
// layout, but the ordering is the one we would want if they ever diverge.
function score(ns, es) {
  return countCrossings(ns, es) * 2 + countNodeOverlaps(ns, es) * 3
}

function polish(nodesIn, edges) {
  let cur = nodesIn.map(n => ({ ...n }))
  let bestScore = score(cur, edges)
  if (!bestScore) return cur

  const columns = new Map()
  for (const n of cur) {
    if (!columns.has(n.x)) columns.set(n.x, [])
    columns.get(n.x).push(n.id)
  }
  for (const col of columns.values()) {
    col.sort((a, b) => cur.find(n => n.id === a).y - cur.find(n => n.id === b).y)
  }

  for (let round = 0; round < 6 && bestScore > 0; round++) {
    let improved = false
    for (const col of columns.values()) {
      for (let i = 0; i + 1 < col.length; i++) {
        const A = cur.find(n => n.id === col[i]), B = cur.find(n => n.id === col[i + 1])
        const trial = cur.map(n =>
          n.id === A.id ? { ...n, y: B.y } : n.id === B.id ? { ...n, y: A.y } : n)
        const s = score(trial, edges)
        if (s < bestScore) {
          bestScore = s
          cur = trial
          ;[col[i], col[i + 1]] = [col[i + 1], col[i]]
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return cur
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

// How many edges pass over the body of a node they are not attached to.
export function countNodeOverlaps(nodes, edges) {
  const at = Object.fromEntries(nodes.map(n => [n.id, n]))
  let n = 0
  for (const e of edges) {
    const f = at[e.from], t = at[e.to]
    if (!f || !t) continue
    const x1 = f.x + NODE_W, y1 = f.y + NODE_H / 2, x2 = t.x, y2 = t.y + NODE_H / 2
    for (const m of nodes) {
      if (m.id === e.from || m.id === e.to) continue
      if (segmentHitsBox(x1, y1, x2, y2, m.x, m.y, m.x + NODE_W, m.y + NODE_H)) { n++; break }
    }
  }
  return n
}

function segmentHitsBox(x1, y1, x2, y2, bx1, by1, bx2, by2) {
  if (Math.max(x1, x2) < bx1 || Math.min(x1, x2) > bx2) return false
  if (Math.max(y1, y2) < by1 || Math.min(y1, y2) > by2) return false
  const inside = (x, y) => x >= bx1 && x <= bx2 && y >= by1 && y <= by2
  if (inside(x1, y1) || inside(x2, y2)) return true
  const edgesOf = [[bx1, by1, bx2, by1], [bx2, by1, bx2, by2], [bx2, by2, bx1, by2], [bx1, by2, bx1, by1]]
  return edgesOf.some(([ax, ay, cx, cy]) =>
    intersects({ x1, y1, x2, y2 }, { x1: ax, y1: ay, x2: cx, y2: cy }))
}

const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)
const intersects = (a, b) =>
  ccw(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2) !== ccw(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2) &&
  ccw(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) !== ccw(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)

export const LAYOUT_CONST = { NODE_W, NODE_H, GAP_X, GAP_Y }
