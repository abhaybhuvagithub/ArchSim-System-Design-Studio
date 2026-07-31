// Turns the live canvas + simulation into a written brief: what this design is,
// how a request flows, how it is behaving right now, what chaos is doing to it,
// what is still wrong, and what it costs.
import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import { serviceName, cloudById } from './clouds.js'
import { faultById } from './faults.js'
import { money } from './pricing.js'

const fmt = n =>
  n >= 1e12 ? (n / 1e12).toFixed(1) + 'T'
  : n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k'
  : Math.round(n).toString()
const pct = v => (v * 100).toFixed(v >= 0.999 ? 2 : 1) + '%'
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]
const downtime = mins =>
  mins >= 1440 ? `${(mins / 1440).toFixed(1)} days`
  : mins >= 60 ? `${(mins / 60).toFixed(1)} hours`
  : mins >= 1 ? `${Math.round(mins)} minutes`
  : `${Math.round(mins * 60)} seconds`
const groupOf = type => PALETTE_GROUPS.find(g => g.types.includes(type))?.label || 'Other'

// Follow the heaviest edge out of each source to get the primary request path.
function primaryPath(nodes, edges, sim) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const source = nodes.find(n => CATALOG[n.type]?.source)
  if (!source) return []
  const path = [source]
  const seen = new Set([source.id])
  let cur = source
  for (let i = 0; i < 24; i++) {
    const outs = edges.filter(e => e.from === cur.id && byId[e.to] && !seen.has(e.to))
    if (!outs.length) break
    outs.sort((a, b) => (sim.flowOnEdge[b.id] || 0) - (sim.flowOnEdge[a.id] || 0))
    cur = byId[outs[0].to]
    seen.add(cur.id)
    path.push(cur)
  }
  return path
}

export function describeArchitecture(ctx) {
  const { nodes, edges, sim, baseSim, cap, cost, sugs, faults, fx, rps, template, cloud, simOn } = ctx
  const S = []
  const add = (title, lines) => { if (lines.filter(Boolean).length) S.push({ title, lines: lines.filter(Boolean) }) }
  if (!nodes.length) {
    return { sections: [{ title: 'Nothing to describe yet', lines: ['The canvas is empty. Load a template or drag in a few components and this brief will write itself — request path, live numbers, chaos impact, outstanding fixes and cost.'] }], markdown: '' }
  }

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const cloudInfo = cloudById(cloud)
  const named = n => {
    const svc = serviceName(n.type, cloud)
    return svc && svc !== 'no public equivalent' ? `${n.label} (${svc})` : n.label
  }

  // ---------- 1. what this is ----------
  const counts = {}
  for (const n of nodes) counts[groupOf(n.type)] = (counts[groupOf(n.type)] || 0) + 1
  const mix = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${c} ${g.toLowerCase()}`)
  const replicas = nodes.reduce((s, n) => s + (CATALOG[n.type]?.source ? 0 : (n.replicas || 1)), 0)
  add('What this is', [
    template
      ? `**${template.name}** — ${template.tagline.toLowerCase()}.`
      : 'A custom design built on the canvas.',
    `${nodes.length} components and ${edges.length} connections, ${replicas} instances in total once replicas are counted.`,
    `The mix is ${list(mix)}.`,
    cloud !== 'generic' ? `Components are labelled with their **${cloudInfo.name}** equivalents and priced at that cloud's list rates.` : null,
  ])

  // ---------- 2. how a request flows ----------
  const path = primaryPath(nodes, edges, sim)
  const branchLines = []
  for (const n of path) {
    const outs = edges.filter(e => e.from === n.id).map(e => byId[e.to]).filter(Boolean)
    const offPath = outs.filter(t => !path.includes(t))
    if (offPath.length) branchLines.push(`From **${n.label}** traffic also reaches ${list(offPath.map(t => t.label))}.`)
  }
  const sources = nodes.filter(n => CATALOG[n.type]?.source)
  add('How a request flows', [
    `Traffic enters at ${list(sources.map(s => s.label))} at **${fmt(rps)} rps** — roughly ${fmt(rps * 2.628e6)} requests a month.`,
    path.length > 1 ? `The busiest path is ${path.map(named).join(' → ')}.` : null,
    ...branchLines.slice(0, 4),
    fx?.cut?.size ? `${fx.cut.size} connection${fx.cut.size > 1 ? 's are' : ' is'} currently severed by an injected fault, so part of this path is not carrying traffic.` : null,
  ])

  // ---------- 3. how it is behaving ----------
  const hot = cap.rows.filter(r => r.util > 0.7)
  const busiest = cap.rows[0]
  const slowest = nodes
    .filter(n => !CATALOG[n.type]?.source && sim.stats[n.id]?.in > 0)
    .sort((a, b) => (sim.stats[b.id]?.latency || 0) - (sim.stats[a.id]?.latency || 0))[0]
  add(simOn ? 'How it is behaving right now' : 'How it would behave', [
    `End to end this lands around **${Math.round(sim.p50)} ms at p50, ${Math.round(sim.p95)} ms at p95 and ${Math.round(sim.p99)} ms at p99**, with **${pct(sim.successRate)} of requests succeeding** and a modelled availability of **${pct(sim.sysAvail)}**.`,
    busiest ? `The busiest component is **${busiest.label}** at ${(busiest.util * 100).toFixed(0)}% of capacity, taking ${fmt(busiest.in)} rps across ${busiest.replicas} replicas.` : null,
    slowest ? `**${slowest.label}** contributes the most latency on the path at ${Math.round(sim.stats[slowest.id].latency)} ms.` : null,
    hot.length
      ? `⚠️ ${hot.length} tier${hot.length > 1 ? 's are' : ' is'} past 70% — ${list(hot.slice(0, 4).map(r => `${r.label} (${(r.util * 100).toFixed(0)}%, needs ${r.needed}×)`))}. Queueing delay climbs steeply from here, so p99 will move well before anything drops.`
      : 'No tier is above 70% utilization, so there is headroom for a spike and for losing an instance.',
    sim.totalDropped > 1 ? `**${fmt(sim.totalDropped)} rps is being dropped** — that is traffic arriving at a component with nowhere to go.` : null,
  ])

  // ---------- 4. chaos ----------
  if (faults?.length) {
    const lines = faults.map(f => {
      const spec = faultById(f.faultId)
      const target = f.targetId ? byId[f.targetId] : null
      return `**${spec.icon} ${spec.name}**${target ? ` on ${target.label}` : ' (system-wide)'} — ${spec.desc}`
    })
    const dSucc = baseSim ? sim.successRate - baseSim.successRate : 0
    const dP95 = baseSim ? sim.p95 - baseSim.p95 : 0
    const dP99 = baseSim ? sim.p99 - baseSim.p99 : 0
    const dAvail = baseSim ? sim.sysAvail - baseSim.sysAvail : 0
    const blast = Object.keys(fx?.node || {}).length
    add('Chaos in progress', [
      `${faults.length} fault${faults.length > 1 ? 's are' : ' is'} injected right now, touching ${blast} component${blast === 1 ? '' : 's'}.`,
      ...lines,
      baseSim ? `Against the healthy baseline that is **${dSucc < -0.0001 ? (dSucc * 100).toFixed(1) + ' points of success rate' : 'no measurable success-rate loss'}**, **p95 ${dP95 >= 0 ? '+' : ''}${Math.round(dP95)} ms, p99 ${dP99 >= 0 ? '+' : ''}${Math.round(dP99)} ms**, and **availability ${(dAvail * 100).toFixed(2)} points**.` : null,
      fx?.rpsMul !== 1 ? `Incoming traffic is multiplied **${fx.rpsMul}×** by the injected event.` : null,
      'Every fault heals itself when its timer runs out, or you can recover them all from the chaos panel.',
    ])
  }

  // ---------- 5. what is still wrong ----------
  if (sugs?.length) {
    const bySev = { high: [], med: [], low: [] }
    for (const s of sugs) bySev[s.severity]?.push(s)
    add('What the advisor still flags', [
      `${sugs.length} finding${sugs.length > 1 ? 's' : ''} — ${bySev.high.length} high, ${bySev.med.length} medium, ${bySev.low.length} low. Each has a one-click quick fix.`,
      ...[...bySev.high, ...bySev.med, ...bySev.low].slice(0, 6).map(s => `${s.icon} **${s.title}** — ${s.detail.split('. ')[0]}.`),
      sugs.length > 6 ? `…and ${sugs.length - 6} more in the Improve tab.` : null,
    ])
  } else {
    add('What the advisor still flags', ['Nothing. At this traffic level the design has no outstanding findings — raise the traffic slider to push it until something breaks.'])
  }

  // ---------- 6. resilience ----------
  const spof = nodes.filter(n => !CATALOG[n.type]?.source && (n.replicas || 1) === 1 && (sim.stats[n.id]?.in || 0) > 0)
  const has = t => nodes.some(n => n.type === t)
  const missing = [
    !has('monitor') && !has('otel') ? 'no monitoring' : null,
    !has('backup') && nodes.some(n => ['sql', 'nosql', 'blob'].includes(n.type)) ? 'no backups' : null,
    !has('waf') ? 'no WAF at the edge' : null,
    !has('iam') && (has('gateway') || has('bff')) ? 'no central identity provider' : null,
    !has('cache') ? 'no cache layer' : null,
  ].filter(Boolean)
  add('Resilience and risk', [
    spof.length
      ? `**${spof.length} single point${spof.length > 1 ? 's' : ''} of failure** on live paths: ${list(spof.slice(0, 5).map(n => n.label))}. One instance lost there takes the flow with it.`
      : 'Every component carrying traffic runs more than one instance, so no single instance loss is fatal.',
    missing.length ? `Gaps worth naming before anyone else does: ${list(missing)}.` : 'Monitoring, backups and edge protection are all present.',
    `Modelled availability of ${pct(sim.sysAvail)} works out to roughly ${downtime((1 - sim.sysAvail) * 43200)} of downtime a month.`,
  ])

  // ---------- 7. cost ----------
  if (cost?.total > 0) {
    const top = cost.rows.filter(r => r.total > 0).slice(0, 3)
    add('What it costs', [
      `About **${money(cost.total)} a month** (${money(cost.hourly)}/hour) at this traffic, or **${money(cost.perMillion)} per million requests**.`,
      `${money(cost.fixed)} of that is fixed — instances, licences and baseline storage — and ${money(cost.usage)} scales with requests.`,
      top.length ? `The biggest line items are ${list(top.map(r => `${r.label} at ${money(r.total)}`))}.` : null,
      cost.byGroup?.length ? `By area: ${list(cost.byGroup.slice(0, 3).map(([g, v]) => `${g.toLowerCase()} ${((v / cost.total) * 100).toFixed(0)}%`))}.` : null,
    ])
  }

  // markdown export
  const markdown = [
    `# ${template ? template.name : 'Architecture brief'}`,
    `_Generated by ArchSim at ${fmt(rps)} rps${cloud !== 'generic' ? ` · ${cloudInfo.name}` : ''}._`,
    '',
    ...S.flatMap(sec => [`## ${sec.title}`, ...sec.lines.map(l => `- ${l}`), '']),
  ].join('\n')

  return { sections: S, markdown }
}
