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
import { simulate } from './sim.js'
import { costReport } from './pricing.js'
import { cloudById } from './clouds.js'

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
  if (/scale|billion|grow/.test(q)) {
    return [template
      ? `Open the **Scale** tab — this design (${template.name}) has a full playbook: the binding constraint, a four-rung ladder to massive scale, the levers (each spotlights the components it touches), and the wall you cannot scale away.`
      : 'Open the **Scale** tab for the scaling ladder. Rule of thumb on any canvas: cache reads first, split stateless tiers second, shard state last — and identify the one constraint that binds before touching anything.']
  }
  if (/explain|describe|walk|flow|how does|what is this/.test(q)) {
    return [`This is ${template ? `**${template.name}**` : 'a custom design'}: ${nodes.length} components handling ${fmt(rps)} rps.`,
      'Press **🧭 Explain** in the toolbar for the hop-by-hop walkthrough — it highlights each connection in request order and narrates what happens there (and can read it aloud).',
      'The **Brief** tab writes the whole design up in prose you can export.']
  }
  // What-if: push 10x / 100x / any Nx through the real simulator
  if (/\b(10x|100x|\d+x)\b|spike|survive|handle more/.test(q)) {
    const mult = parseInt((q.match(/(\d+)\s*x/) || [])[1] || '10', 10)
    const target = Math.min(rps * mult, 2e8)
    const s2 = simulate(nodes, edges, target, new Set())
    const flowing = Object.values(s2.stats || {}).some(st => (st.in || 0) > 0)
    if (!flowing) return ['The design has no traffic source wired in — add a Client from the palette and connect it, then I can push ' + fmt(target) + ' rps through it.']
    const hot2 = nodes.map(n => ({ n, u: s2.stats?.[n.id]?.util || 0 })).filter(x => x.u >= 1).sort((a, b) => b.u - a.u)
    const out = [`At **${fmt(target)} rps** (${mult}× current), the simulator says: success rate **${(s2.successRate * 100).toFixed(1)}%**, p99 **${Math.round(s2.p99)}ms**.`]
    if (hot2.length) out.push('First to saturate: ' + hot2.slice(0, 3).map(x => `**${x.n.label}** (${Math.round(x.u * 100)}%)`).join(', ') + ' — that is where the next replicas or a cache go.')
    else out.push('Nothing saturates — this design absorbs it. Drag the traffic slider there and watch it live.')
    return out
  }
  if (/how many replicas|right.?siz|replica count|capacity plan/.test(q)) {
    if (!simOn) return ['Turn on **▶ Simulate** first — replica math needs the live per-component traffic.']
    const plans = nodes.map(n => {
      const st = sim.stats?.[n.id]; if (!st || !st.in) return null
      const cap = CATALOG[n.type]?.cap || 1000
      const need = Math.ceil(st.in / (cap * 0.7))
      const have = Math.max(1, n.replicas || 1)
      return need > have ? `**${n.label}**: ${have} → ${need} replicas (targets 70% at its ${fmt(st.in)} rps)` : null
    }).filter(Boolean)
    return plans.length
      ? ['Sizing every component to run at ~70% utilization:', ...plans.map(p => '• ' + p), 'Select a component and edit replicas in the inspector — the Capacity tab shows the same math continuously.']
      : ['Every component already has headroom at ~70% target utilization. Raise the traffic slider to find the next sizing decision.']
  }
  if (/secur|attack|hack|vulnerab|auth\b/.test(q)) {
    const has = t => nodes.some(n => n.type === t)
    const out = []
    if (!has('gateway') && !has('waf')) out.push('• No **API gateway or WAF** — nothing enforces auth, rate limits or input rules at the front door.')
    if (nodes.some(n => ['llm', 'gemini3', 'gemini2', 'gemmaos'].includes(n.type)) && !has('guard')) out.push('• An LLM without **Guardrails** — prompt injection in, PII out, nothing scanning either direction.')
    if (has('sql') && !has('pii') && !has('crypto')) out.push('• User data in SQL with no **tokenization vault or envelope encryption** in sight.')
    if (!has('iam') && !has('secrets')) out.push('• No **IAM/secrets management** on the canvas — worth showing where credentials live.')
    if (!has('audit') && !has('siem')) out.push('• No **audit log or SIEM** — after an incident, this design cannot answer "who did what".')
    return out.length
      ? ['A security read of this canvas:', ...out, 'Each of these is a drag-and-drop component from the Security palette group — add one and re-ask.']
      : ['The usual boxes are ticked here: gateway/guarding, secrets, and audit surfaces are present. Next step: inject the security-flavored chaos faults (token expiry, cert rotation) and see what degrades.']
  }
  if (/availab|uptime|nines|downtime/.test(q)) {
    if (!simOn) return ['Turn on **▶ Simulate** — availability composes from every component on the path, and the simulator does that math live.']
    const weak = nodes.map(n => ({ n, a: CATALOG[n.type]?.avail ?? 1, r: Math.max(1, n.replicas || 1) })).sort((x, y) => (x.a ** 1) - (y.a ** 1)).slice(0, 3)
    return [`System availability is **${(sim.sysAvail * 100).toFixed(3)}%** right now — about ${Math.round((1 - sim.sysAvail) * 525600)} minutes of downtime a year.`,
      'Weakest links by component class: ' + weak.map(w => `**${w.n.label}** (${(w.a * 100).toFixed(2)}%${w.r === 1 ? ', single replica' : ''})`).join(', ') + '.',
      'Replicas multiply the nines: the same component at 2+ replicas only fails when all copies do. The Chaos tab lets you rehearse exactly that.']
  }
  if (/interview|present|walk.?through|whiteboard/.test(q)) {
    return [template
      ? `For **${template.name}**, the **Breakdown** tab is the interview script: requirements → entities → API → the two deep dives — and the Mid/Senior/Staff bar at the bottom tells you what each level is expected to cover.`
      : 'Structure it the way the Breakdown tab structures every template: 2 minutes of requirements, 1 minute of entities and API, then spend your time on two deep dives where the hard trade-offs live.',
      'Then run **🎤 Interview** mode — it plays the interviewer, probes your answers stage by stage, and grades what you actually said.']
  }
  const GLOSSARY = {
    'cap theorem': 'Under a network partition, a distributed store chooses: refuse some requests (consistency) or serve possibly-stale data (availability). Not a menu of three — partitions happen, so you are picking C or A for partition time.',
    'idempoten': 'An operation safe to apply twice: retries collapse to one effect. Achieved with client-supplied keys the server dedupes on. Every money write and every queue consumer in this studio leans on it.',
    'cache-aside': 'The app reads the cache, misses to the store, writes the result back with a TTL. Simple and everywhere — its sharp edges are stampedes on hot-key expiry (fix: jittered TTLs, request coalescing).',
    'lost in the middle': 'The empirical finding that LLMs privilege the start and end of a long context and under-use the middle. Practical RAG consequence: put the strongest evidence first and last, and shrink k before you grow it.',
    'llm judge': 'Using a model to grade model outputs - pairwise with a written rubric works best. Known biases: position (randomize order), verbosity, and self-preference. Calibrate against a sampled human eval before trusting it with a launch decision.',
    'semantic cache': 'Cache keyed by embedding similarity, not exact text: paraphrased repeats hit. In LLM systems it is the rare lever that improves cost, latency AND hallucination at once - repeats get a verified past answer.',
        'settlement': 'Where money actually moves. Authorization holds funds in milliseconds and promises nothing; settlement clears the batch - captures netted per counterparty, posted to the ledger, T+1. Most payment outages are auth; most payment disasters are settlement drift found on day three.',
    'double-entry': 'Every money movement is two balanced rows - one debit, one credit, summing to zero - and nothing is ever UPDATEd. Balances are projections over entries; corrections are reversing entries. The history IS the audit. See the Ledger component.',
    'tokenization': 'Swap the card number for a stand-in at the edge: the PAN goes to the HSM and never returns, everything downstream carries tokens, and PCI scope collapses from your whole fleet to one hardware vault.',
        'graphql': 'A query language where the client shapes the response: one round-trip fetches exactly the fields needed. Wins for product frontends with deep object graphs; loses REST\'s cacheability and adds server-side query-cost policing. Public APIs lean REST, in-house frontends earn GraphQL.',
    'write-back': 'Cache write policies: write-THROUGH lands in cache and store before OK (safe, slower); write-BACK returns from cache and flushes later (fast, a loss window until flushed); write-AROUND skips the cache so only reads warm it (good for write-heavy, rarely-read data). Flip them live on any cache node\'s inspector.',
    'vector clock': 'A per-node counter map attached to each write. Comparing two clocks tells you which write happened-after the other - or that neither did, which IS the conflict detection. LWW hides that conflict; vector clocks surface it; CRDTs make the merge automatic.',
    'active-active': 'Redundancy shapes: active-ACTIVE serves from every replica, so failure is invisible and capacity adds up; active-PASSIVE keeps a warm standby and pays a failover pause. The SLO and the data layer\'s tolerance for concurrent writers decide which you can afford.',
    'sharding': 'Splitting one dataset across machines by a key. The key choice is the whole game: it decides your hot spots (Discord shards by guild, Uber by city geography) and what queries stay single-shard.',
    'backpressure': 'Slowing the producer when the consumer falls behind, instead of buffering to death. Queues make it visible; the alternative is unbounded memory and a worse crash later.',
    'exactly-once': 'The delivery guarantee that is really at-least-once plus idempotent processing plus transactional sinks. See the Ad Click Aggregator template — there it is the bill.',
    'fan-out': 'One event, many recipients. On write (precompute feeds) or on read (query time) — the trade is storage vs latency, and celebrities break whichever you pick first.',
    'hot partition': 'One shard taking disproportionate load because the key concentrates (one viral stream, one celebrity). Fixes: better keys, salting, or isolating the hot tenant deliberately.',
    'p99': 'The latency 99% of requests beat — the tail your busiest users live in. Means are lies at scale: one slow dependency in a 100-call fan-out makes p99 the common case.',
    'load shedding': 'Refusing work you cannot serve well, early and cheaply, so the work you accept stays fast. A 429 at the gateway beats a timeout at the database.',
    'circuit breaker': 'Stop calling a failing dependency for a cooldown after errors cross a threshold — fail fast, recover probe by probe. Turns a slow outage into a clean one.',
    'consistent hashing': 'A hash ring where adding a node moves only ~1/N of keys instead of reshuffling everything. How caches and stores scale membership without a stampede.',
    'quorum': 'Requiring R reads + W writes to overlap (R+W > N) so a read always sees the newest write. The dial between latency and consistency in replicated stores.',
    'saga': 'A distributed transaction as a sequence of local commits, each with a compensation to undo it. Order the irreversible steps last — you cannot un-send an email.',
    'cqrs': 'Split the write model from the read model and let reads denormalize freely. Pairs with event sourcing; the cost is eventual consistency between the two sides.',
    'wal': 'Write-ahead log: append the intent durably before applying it, replay after a crash. The primitive under databases, queues and every "how is this durable?" answer.',
  }
  const g = Object.keys(GLOSSARY).find(k => q.includes(k))
  if (g && /what is|what's|define|mean|explain/.test(q)) {
    return [GLOSSARY[g], nodes.length ? 'Want it applied? Name a component on your canvas and I will connect it.' : 'Load a template and I can point at where this shows up in a real design.']
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
