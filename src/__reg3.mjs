import { CATALOG } from './catalog.js'
import { TEMPLATES } from './templates.js'
import { simulate } from './sim.js'
import { review, applyAll } from './advisor.js'
import { autoArrange, LAYOUT_CONST } from './layout.js'
import { FAULTS, compileFaults, pickTarget } from './faults.js'
import { costReport, rightSizePlan } from './pricing.js'
import { CLOUD_MAP, CLOUDS } from './clouds.js'
import { describeArchitecture } from './describe.js'
import { requirementEffect, applyRequirement, undoRequirement } from './requirements.js'
import { ABOUT, ABOUT_COMPARE } from './about.js'

let fail = 0, chaosChecks = 0
const bad = m => { console.log('FAIL', m); fail++ }
const clone = t => ({ nodes: t.nodes.map(n => ({ ...n })), edges: t.edges.map(e => ({ ...e })) })

for (const t of TEMPLATES) {
  const { nodes, edges } = clone(t)
  const ids = new Set(nodes.map(n => n.id))
  for (const n of nodes) if (!CATALOG[n.type]) bad(`${t.name}: unknown type ${n.type}`)
  for (const e of edges) if (!ids.has(e.from) || !ids.has(e.to)) bad(`${t.name}: dangling edge ${e.id}`)

  const sim = simulate(nodes, edges, t.rps)
  for (const n of nodes) { const s = sim.stats[n.id]; if (s && s.util >= 0.95) bad(`${t.name}: ${n.label} at ${(s.util*100).toFixed(0)}%`) }
  if (!(sim.p95 >= sim.p50 && sim.p99 >= sim.p95)) bad(`${t.name}: percentile order`)

  let N = nodes, E = edges
  for (let i = 0; i < 8; i++) { const f = review(N, E, t.rps); if (!f.length) break; const r = applyAll(f, N, E); N = r.nodes; E = r.edges }
  const left = review(N, E, t.rps)
  if (left.length) bad(`${t.name}: advisor did not converge (${left.length} left: ${left[0].title})`)

  const laid = autoArrange(nodes, edges)
  for (let i=0;i<laid.length;i++) for (let j=i+1;j<laid.length;j++) {
    const a=laid[i], b=laid[j]
    if (Math.abs(a.x-b.x) < LAYOUT_CONST.NODE_W && Math.abs(a.y-b.y) < LAYOUT_CONST.NODE_H) bad(`${t.name}: overlap ${a.label}/${b.label}`)
  }

  for (const c of t.checklist) {
    if (!requirementEffect(c, nodes, t.rps)) { bad(`${t.name}: no effect for "${c}"`); continue }
    const on = applyRequirement(nodes, edges, c, t.rps)
    if (!on) { bad(`${t.name}: apply failed "${c}"`); continue }
    const off = undoRequirement(on.nodes, on.edges, on)
    if (!off) { bad(`${t.name}: undo failed "${c}"`); continue }
    const rps = off.rps ?? t.rps
    if (off.nodes.length !== nodes.length || off.edges.length !== edges.length || rps !== t.rps) bad(`${t.name}: "${c}" did not round-trip`)
  }

  for (const f of FAULTS) {
    const tgt = pickTarget(f, nodes, sim, edges)
    const fx = compileFaults([{ faultId: f.id, targetId: tgt?.id || tgt || null }], nodes, edges)
    const s = simulate(nodes, edges, t.rps, new Set(fx.down || []), fx)
    chaosChecks++
    const moved = Math.abs(s.successRate - sim.successRate) > 1e-9 || Math.abs(s.p99 - sim.p99) > 1e-9 || Math.abs(s.sysAvail - sim.sysAvail) > 1e-9
    if (!moved) bad(`${t.name}: fault ${f.id} inert`)
  }
  const healed = simulate(nodes, edges, t.rps)
  if (Math.abs(healed.successRate - sim.successRate) > 1e-9) bad(`${t.name}: did not heal`)

  const cost = costReport(nodes, sim, 1)
  if (!isFinite(cost.total) || cost.total <= 0) bad(`${t.name}: bad cost`)
  const plan = rightSizePlan(nodes, sim, 1)
  for (const p of plan.changes) if (p.to < 2) bad(`${t.name}: right-size ${p.label} to ${p.to}`)
  const sized = nodes.map(n => { const c = plan.changes.find(x => x.id === n.id); return c ? { ...n, replicas: c.to } : n })
  if (rightSizePlan(sized, simulate(sized, edges, t.rps), 1).changes.length) bad(`${t.name}: right-size not idempotent`)

  const d = describeArchitecture({ nodes, edges, rps: t.rps, sim, cost, sugs: review(nodes,edges,t.rps), faults: [], fx: null, template: t, cloud: 'aws', simOn: true })
  if (/undefined|NaN|Infinity/.test(d.markdown)) bad(`${t.name}: brief has undefined/NaN`)

  for (const n of nodes) for (let c=0;c<CLOUDS.length-1;c++) if (!CLOUD_MAP[n.type] || !CLOUD_MAP[n.type][c]) bad(`${t.name}: ${n.type} unmapped on cloud ${c}`)
}

const atxt = ABOUT.flatMap(s => s.lines).join(' ')
if (/undefined|NaN/.test(atxt)) bad('about: bad text')
if (ABOUT.length !== 5) bad('about: section count')
for (const r of ABOUT_COMPARE.rows) if (r.length !== ABOUT_COMPARE.cols.length + 1) bad('about: compare row width')

console.log(fail ? `\n${fail} FAILURES` : `\nALL GREEN - ${TEMPLATES.length} templates, ${chaosChecks} chaos checks 0 inert, advisor converges, layouts clean, requirements reversible, right-size safe+idempotent, briefs clean, ${CLOUDS.length-1} clouds mapped, About verified`)
