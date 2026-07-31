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

let fail = 0
const bad = m => { console.log('FAIL', m); fail++ }
const build = t => ({
  nodes: t.nodes.map(n => ({ id:n[0], type:n[1], label:n[2], x:n[3], y:n[4], replicas:n[5]??1, weight:n[6] })),
  edges: t.edges.map(([f,to],i) => ({ id:'e'+i, from:f, to })),
})

for (const t of TEMPLATES) {
  const { nodes, edges } = build(t)
  const ids = new Set(nodes.map(n => n.id))
  for (const n of nodes) if (!CATALOG[n.type]) bad(`${t.name}: unknown type ${n.type}`)
  for (const e of edges) if (!ids.has(e.from) || !ids.has(e.to)) bad(`${t.name}: dangling edge`)

  const sim = simulate(nodes, edges, t.rps, new Set(), null)
  for (const n of nodes) { const s = sim.stats[n.id]; if (s && s.util >= 0.95) bad(`${t.name}: ${n.label} at ${(s.util*100).toFixed(0)}%`) }
  if (!(sim.p95 >= sim.p50 && sim.p99 >= sim.p95)) bad(`${t.name}: percentile order`)

  let N = nodes, E = edges
  for (let i = 0; i < 6; i++) { const f = review(N, E, simulate(N,E,t.rps,new Set(),null), t.rps); if (!f.length) break; const r = applyAll(f, N, E); N = r.nodes; E = r.edges }
  if (review(N, E, simulate(N,E,t.rps,new Set(),null), t.rps).length) bad(`${t.name}: advisor did not converge`)

  const laid = autoArrange(nodes, edges)
  for (let i=0;i<laid.length;i++) for (let j=i+1;j<laid.length;j++) {
    const a=laid[i], b=laid[j]
    if (Math.abs(a.x-b.x) < LAYOUT_CONST.NODE_W && Math.abs(a.y-b.y) < LAYOUT_CONST.NODE_H) bad(`${t.name}: overlap ${a.label}/${b.label}`)
  }

  for (const c of t.checklist) {
    const eff = requirementEffect(c, nodes, t.rps)
    if (!eff) { bad(`${t.name}: no effect for "${c}"`); continue }
    const on = applyRequirement(eff, nodes, edges, t.rps)
    const off = undoRequirement(eff, on.nodes, on.edges, on.rps)
    if (off.nodes.length !== nodes.length || off.edges.length !== edges.length || off.rps !== t.rps) bad(`${t.name}: requirement "${c}" did not round-trip`)
  }

  for (const f of FAULTS) {
    const tgt = pickTarget(f, nodes, sim, edges)
    const fx = compileFaults([{ fault: f, target: tgt }], nodes, edges)
    const s = simulate(nodes, edges, t.rps, new Set(fx.down || []), fx)
    const moved = Math.abs(s.successRate - sim.successRate) > 1e-9 || Math.abs(s.p99 - sim.p99) > 1e-9 || Math.abs(s.sysAvail - sim.sysAvail) > 1e-9
    if (!moved) bad(`${t.name}: fault ${f.id} inert`)
  }
  const healed = simulate(nodes, edges, t.rps, new Set(), null)
  if (Math.abs(healed.successRate - sim.successRate) > 1e-9) bad(`${t.name}: did not heal`)

  const cost = costReport(nodes, sim, 1)
  if (!isFinite(cost.total) || cost.total <= 0) bad(`${t.name}: bad cost`)
  const plan = rightSizePlan(nodes, sim, 1)
  for (const p of (plan.rows || plan || [])) if (p && p.to != null && p.to < 2) bad(`${t.name}: right-size to ${p.to}`)

  const d = describeArchitecture({ nodes, edges, rps: t.rps, sim, findings: review(nodes,edges,sim,t.rps), active: [], name: t.name, currency: 'USD', cloud: 'aws' })
  if (/undefined|NaN|Infinity/.test(d.markdown)) bad(`${t.name}: brief has undefined/NaN`)

  for (const n of nodes) for (let c=0;c<CLOUDS.length-1;c++) if (!CLOUD_MAP[n.type] || !CLOUD_MAP[n.type][c]) bad(`${t.name}: ${n.type} unmapped on cloud ${c}`)
}

const atxt = ABOUT.flatMap(s => s.lines).join(' ')
if (/undefined|NaN/.test(atxt)) bad('about: bad text')
if (ABOUT.length !== 5) bad('about: section count')
for (const r of ABOUT_COMPARE.rows) if (r.length !== ABOUT_COMPARE.cols.length + 1) bad('about: compare row width')

console.log(fail ? `\n${fail} FAILURES` : `\nALL GREEN — ${TEMPLATES.length} templates x ${FAULTS.length} faults = ${TEMPLATES.length*FAULTS.length} chaos checks, advisor converges, layouts clean, requirements reversible, briefs clean, ${CLOUDS.length-1} clouds mapped, About verified`)
