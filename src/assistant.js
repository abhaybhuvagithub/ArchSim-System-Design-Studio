// The studio's assistant. Two modes, one contract:
//   • with an API key (shared with the Interview tab) an LLM answers, primed
//     with a live snapshot of the canvas — components, wiring, simulation
//     numbers, cost and open findings;
//   • without a key, an offline engine answers from the same snapshot using
//     the studio's own analyses. Less conversational, never wrong about your
//     own design, and free.
// Either way the assistant reasons about THIS canvas, not architecture in
// the abstract — that is the entire point of putting it inside the studio.
import { CATALOG } from './catalog.js'
import { getComponentInternals } from './component-internals.js'

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

// ── the snapshot both modes share ──────────────────────────────────────────
export function buildContext({ nodes = [], edges = [], sim, cost, sugs = [], faults = [], rps, cloud, template }) {
  if (!nodes.length) return 'The canvas is empty.'
  const L = []
  L.push(`Design: ${template?.name || 'custom'} — ${nodes.length} components, ${edges.length} connections, ${fmt(rps || 0)} rps, cloud: ${cloud || 'generic'}.`)
  L.push('Components: ' + nodes.map(n => `${n.label} (${CATALOG[n.type]?.name || n.type}${(n.replicas || 1) > 1 ? ' ×' + n.replicas : ''})`).join(', '))
  L.push('Wiring: ' + edges.map(e => {
    const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to)
    return f && t ? `${f.label}→${t.label}` : null
  }).filter(Boolean).join(', '))
  if (sim) {
    L.push(`Live simulation: p50 ${Math.round(sim.p50)}ms, p95 ${Math.round(sim.p95)}ms, p99 ${Math.round(sim.p99)}ms, success ${(sim.successRate * 100).toFixed(2)}%, availability ${(sim.sysAvail * 100).toFixed(3)}%.`)
    const hot = nodes.map(n => ({ n, u: sim.stats?.[n.id]?.util || 0 })).filter(x => x.u > 0.6).sort((a, b) => b.u - a.u)
    if (hot.length) L.push('Hot components: ' + hot.map(x => `${x.n.label} at ${Math.round(x.u * 100)}%`).join(', '))
  }
  if (cost?.rows?.length) {
    L.push(`Monthly cost ≈ $${fmt(cost.total)} — top: ` + cost.rows.slice(0, 3).map(r => `${r.label} $${fmt(r.total)}`).join(', '))
  }
  if (sugs.length) L.push('Open advisor findings: ' + sugs.slice(0, 6).map(s => s.title).join('; '))
  if (faults.length) L.push('Active chaos faults: ' + faults.length)
  return L.join('\n')
}

export function assistantSystemPrompt(ctx) {
  return 'You are the assistant inside ArchSim, a system-design studio where the user is editing a live architecture diagram. '
    + 'Ground every answer in the design snapshot below; name their actual components. Be concise and concrete: '
    + 'say what to change on the canvas and why, with numbers when the simulation provides them. '
    + 'If a question is unrelated to system design, gently steer back.\n\n'
    + '--- CURRENT DESIGN ---\n' + ctx
}

// ── the offline engine ─────────────────────────────────────────────────────
// Keyword routing into the studio's own analyses. Every answer names real
// components from the user's canvas.
export function offlineAnswer(question, { nodes = [], edges = [], sim, cost, sugs = [], faults = [], rps, simOn, template }) {
  const q = String(question || '').toLowerCase()
  if (!nodes.length) {
    return ['The canvas is empty — load a template from the picker (78 to choose from) or drag components in from the left, and I can analyse the design with you.']
  }
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const utils = nodes.map(n => ({ n, u: sim?.stats?.[n.id]?.util || 0 })).sort((a, b) => b.u - a.u)
  const hottest = utils[0]

  if (/bottleneck|slow|latency|p99|p95|utili[sz]/.test(q)) {
    if (!simOn) return ['Press **▶ Simulate** first — then I can read real utilization and latency instead of guessing.',
      'From the wiring alone: the deepest request path is where latency accrues, and any single-replica stateful component is the first suspect.']
    const out = [`Your hottest component is **${hottest.n.label}** at ${Math.round(hottest.u * 100)}% utilization.`]
    if (hottest.u > 0.7) out.push('Past ~70% the queueing curve turns: latency climbs steeply long before requests drop. Add replicas to it (select it → replicas), or take load off it with a cache or a queue upstream.')
    else out.push('Nothing is saturated right now — p99 is ' + Math.round(sim.p99) + 'ms. Raise the traffic slider to find where it breaks.')
    const next = utils[1]
    if (next && next.u > 0.5) out.push(`Next in line: **${next.n.label}** at ${Math.round(next.u * 100)}% — fixing the first bottleneck usually promotes this one.`)
    return out
  }
  if (/cost|price|bill|cheap|expensive|money|budget/.test(q)) {
    if (!cost?.rows?.length) return ['Turn the simulation on and open the **Cost** tab — cost is driven by the traffic actually flowing through each component.']
    const top = cost.rows.slice(0, 3)
    const out = [`This design runs about **$${fmt(cost.total)}/month** at ${fmt(rps)} rps.`]
    out.push('The bill concentrates in: ' + top.map(r => `**${r.label}** ($${fmt(r.total)})`).join(', ') + '.')
    const llmRow = cost.rows.find(r => ['llm', 'gemini3', 'gemini2', 'veo', 'imagen'].includes(r.type))
    if (llmRow) out.push(`**${llmRow.label}** bills per call — caching repeated prompts and trimming context are worth more than any instance rightsizing.`)
    else out.push('Cheapest wins first: raise cache hit ratios (fewer store reads), then right-size replicas in the Capacity tab.')
    return out
  }
  if (/improve|suggest|fix|better|advice|recommend/.test(q)) {
    if (!sugs.length) return ['The advisor has no open findings on this design — it looks structurally sound. Push the traffic slider up or inject a chaos fault to find the next weakness.']
    return [`The advisor has ${sugs.length} open finding${sugs.length > 1 ? 's' : ''}:`,
      ...sugs.slice(0, 5).map(s => '• ' + s.title),
      'Each has a one-click fix in the **✨ Improve** tab — apply one and the diagram (and the Code tab) update together.']
  }
  if (/chaos|fail|break|outage|resilien|fault/.test(q)) {
    if (faults.length) return [`${faults.length} chaos fault${faults.length > 1 ? 's are' : ' is'} active right now — success rate is ${(sim.successRate * 100).toFixed(1)}%. The **Chaos** tab shows each fault's blast radius and a suggested mitigation.`]
    const spofs = nodes.filter(n => (n.replicas || 1) === 1 && !CATALOG[n.type]?.source && edges.some(e => e.from === n.id || e.to === n.id))
    const out = ['Nothing is failing right now. To find out what breaks first, toggle **Chaos ON** or inject a specific fault from the Chaos tab.']
    if (spofs.length) out.push('Single points of failure on this canvas (one replica each): ' + spofs.slice(0, 4).map(n => `**${n.label}**`).join(', ') + ' — any one of these going down takes its whole path with it.')
    return out
  }
  if (/scale|billion|grow|10x|100x/.test(q)) {
    return [template
      ? `Open the **Scale** tab — this design (${template.name}) has a full playbook: the binding constraint, a four-rung ladder to massive scale, the levers (each spotlights the components it touches), and the wall you cannot scale away.`
      : 'Open the **Scale** tab for the scaling ladder. Rule of thumb on any canvas: cache reads first, split stateless tiers second, shard state last — and identify the one constraint that binds before touching anything.']
  }
  if (/explain|describe|walk|flow|how does|what is this/.test(q)) {
    return [`This is ${template ? `**${template.name}**` : 'a custom design'}: ${nodes.length} components handling ${fmt(rps)} rps.`,
      'Press **🧭 Explain** in the toolbar for the hop-by-hop walkthrough — it highlights each connection in request order and narrates what happens there (and can read it aloud).',
      'The **Brief** tab writes the whole design up in prose you can export.']
  }
  const compHit = nodes.find(n => q.includes(n.label.toLowerCase())) || nodes.find(n => q.includes((CATALOG[n.type]?.name || '').toLowerCase()))
  if (compHit) {
    const i = getComponentInternals(compHit.type)
    return [`**${compHit.label}** (${CATALOG[compHit.type]?.name}): ${CATALOG[compHit.type]?.desc}`,
      `Under the hood — ${i.algorithm}. ${i.mechanism}`,
      'Click the component and hit 🔍 for the full internals with a data-flow diagram.']
  }
  return [`I can analyse this design with you — ${nodes.length} components at ${fmt(rps)} rps${simOn ? `, p99 currently ${Math.round(sim.p99)}ms` : ''}. Try asking:`,
    '• "Where is my bottleneck?"  • "How do I cut the cost?"',
    '• "What breaks first?"  • "How does this scale?"',
    '• Or name any component on the canvas to get its internals.',
    'For open-ended conversation, add an API key below and your own LLM takes over with this design as context.']
}
