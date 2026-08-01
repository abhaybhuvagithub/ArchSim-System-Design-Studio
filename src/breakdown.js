// Problem breakdowns for the Breakdown tab — one for every template.
//
// Authored content lives in breakdown-a…d.js and covers the parts that need
// judgement: requirements, entities, API, deep dives, the bar at each level.
//
// The High-Level Design sections are NOT authored. They are derived from the
// template's own nodes and edges using the same primary-path walk the
// Architecture Brief uses, so the written design can never drift from the
// diagram it describes. A template can still override with an authored `hld`
// when the story is more interesting than the graph (WhatsApp does).
//
// Block shorthand (first element is the type):
//   ['p', text]                           paragraph, supports **bold**
//   ['steps', [...]] / ['bul', [...]]     numbered / bulleted list
//   ['reqs', { core: [], out: [] }]       requirements with "below the line"
//   ['nums', [[value, label], ...]]       back-of-envelope cards
//   ['ent',  [[name, description], ...]]  core entities
//   ['api',  [{ dir, name, body }, ...]]  commands / endpoints
//   ['note'|'warn'|'calc', text]          callouts
//   ['code', text]                        preformatted block
//   ['opts', [{ rating, title, approach, challenges, best }]]

import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import A from './breakdown-a.js'
import B from './breakdown-b.js'
import C from './breakdown-c.js'
import D from './breakdown-d.js'

const AUTHORED = { ...A, ...B, ...C, ...D }

const groupOf = type => PALETTE_GROUPS.find(g => g.types.includes(type))?.label || 'Other'
const nameOf = n => CATALOG[n.type]?.name || n.type

// ── deriving the high-level design from the graph ───────────────────────────

// Longest forward walk from the busiest traffic source: the request path.
function primaryPath(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const source = nodes.find(n => CATALOG[n.type]?.source)
  if (!source) return []
  const path = [source]
  const seen = new Set([source.id])
  let cur = source
  for (let i = 0; i < 24; i++) {
    const outs = edges.filter(e => e.from === cur.id && byId[e.to] && !seen.has(e.to))
    if (!outs.length) break
    // prefer the branch that leads furthest, so we describe the spine not a stub
    outs.sort((a, b) => reach(b.to) - reach(a.to))
    cur = byId[outs[0].to]
    seen.add(cur.id)
    path.push(cur)
  }
  return path

  function reach(id, depth = 0, guard = new Set()) {
    if (depth > 8 || guard.has(id)) return depth
    guard.add(id)
    const outs = edges.filter(e => e.from === id)
    if (!outs.length) return depth
    return Math.max(...outs.map(e => reach(e.to, depth + 1, guard)))
  }
}

function sentenceFor(n, i, path, edges) {
  const cat = CATALOG[n.type] || {}
  const next = path[i + 1]
  const edge = next && edges.find(e => e.from === n.id && e.to === next.id)
  const label = edge && edge.label ? ` (${edge.label})` : ''
  const desc = (cat.desc || '').replace(/\.$/, '')
  const replicas = (n.replicas || 1) > 1 ? ` Runs ${n.replicas}× so no single instance is load-bearing.` : ''
  if (i === 0) return `**${n.label}** — ${desc}. Every request in this design starts here.`
  if (!next) return `**${n.label}** — ${desc}. This is where the path terminates${label}.${replicas}`
  return `**${n.label}** — ${desc}. Hands off to ${next.label}${label}.${replicas}`
}

function deriveHld(template) {
  const { nodes, edges } = template
  const path = primaryPath(nodes, edges)
  const onPath = new Set(path.map(n => n.id))
  const sections = []

  if (path.length > 1) {
    sections.push({
      id: 'hld-path', h: 2, title: '1) The request path',
      focus: path.map(n => n.id),
      blocks: [
        ['p', `Follow one request end to end. The spine of this design is ${path.length} components deep: ${path.map(n => n.label).join(' → ')}.`],
        ['bul', path.map((n, i) => sentenceFor(n, i, path, edges))],
      ],
    })
  }

  // storage tier
  const storage = nodes.filter(n => groupOf(n.type) === 'Storage' && !onPath.has(n.id))
  const allStorage = nodes.filter(n => groupOf(n.type) === 'Storage')
  if (allStorage.length) {
    sections.push({
      id: 'hld-state', h: 2, title: `${sections.length + 1}) Where state lives`,
      focus: allStorage.map(n => n.id),
      blocks: [
        ['p', `Everything above is replaceable; this is the part that is not. ${allStorage.length === 1 ? 'One store holds' : `${allStorage.length} stores hold`} the state, and the choice of each is driven by its access pattern rather than by preference.`],
        ['bul', allStorage.map(n =>
          `**${n.label}** (${nameOf(n)}) — ${(CATALOG[n.type]?.desc || '').replace(/\.$/, '')}.` +
          ((n.replicas || 1) > 1 ? ` ${n.replicas} replicas.` : ' Single instance — replicate it before you call this production-ready.')
        )],
        storage.length ? ['note', `${storage.map(n => n.label).join(', ')} ${storage.length === 1 ? 'sits' : 'sit'} off the main request path — reached on a miss, a write, or asynchronously. That is deliberate: the hot path should touch as few stores as possible.`] : null,
      ].filter(Boolean),
    })
  }

  // async tier
  const async_ = nodes.filter(n => groupOf(n.type) === 'Async' || n.type === 'worker' || n.type === 'scheduler')
  if (async_.length) {
    sections.push({
      id: 'hld-async', h: 2, title: `${sections.length + 1}) What happens off the request path`,
      focus: async_.map(n => n.id),
      blocks: [
        ['p', 'Work that does not have to finish before the user gets an answer belongs here, where it can be retried, batched and scaled independently.'],
        ['bul', async_.map(n => `**${n.label}** (${nameOf(n)}) — ${(CATALOG[n.type]?.desc || '').replace(/\.$/, '')}.`)],
        ['note', 'The contract for everything in this tier is at-least-once delivery, which means every consumer must be safe to run twice on the same input.'],
      ],
    })
  }

  // edge / resilience tier
  const edgeTier = nodes.filter(n => ['cdn', 'gslb', 'waf', 'lb', 'gateway', 'ratelimiter', 'edge', 'dns'].includes(n.type))
  if (edgeTier.length) {
    sections.push({
      id: 'hld-edge', h: 2, title: `${sections.length + 1}) The edge`,
      focus: edgeTier.map(n => n.id),
      blocks: [
        ['p', 'The tier that exists so the ones behind it can be simple: absorb what should never reach an origin, spread what does, and reject what should not be served at all.'],
        ['bul', edgeTier.map(n => `**${n.label}** (${nameOf(n)}) — ${(CATALOG[n.type]?.desc || '').replace(/\.$/, '')}.`)],
      ],
    })
  }

  return sections
}

// ── shared level expectations ───────────────────────────────────────────────

export const LEVELS = {
  mid: 'Roughly 80% breadth, 20% depth. Land a design that meets the functional requirements you defined; several components can be abstractions you know only at surface level. Expect the interviewer to probe the basics of anything you place on the board, and to take the wheel in the later stages.',
  senior: 'Roughly 60% breadth, 40% depth. Move through the high-level design quickly so there is real time for the deep dives. State trade-offs explicitly rather than just choosing, and find your own bottlenecks before the interviewer points at them.',
  staff: 'Roughly 40% breadth, 60% depth. You may not have built this exact system but you have built enough to reason from experience. Go two or three levels into failure modes, and treat the interviewer as someone who should only need to focus you, never steer you.',
}

// ── assembly ────────────────────────────────────────────────────────────────

function build(template) {
  const a = AUTHORED[template.name]
  if (!a) return null

  const sections = []
  const push = (id, h, title, blocks, extra) =>
    sections.push({ id, h, title, blocks: (blocks || []).filter(Boolean), ...extra })

  push('understanding', 1, 'Understanding the Problem', [
    ['p', a.scope],
  ])
  push('functional-requirements', 2, 'Functional Requirements', [
    ['reqs', a.fr],
  ])
  push('non-functional-requirements', 2, 'Non-Functional Requirements', [
    ['reqs', a.nfr],
    a.nums ? ['nums', a.nums] : null,
  ])

  push('the-set-up', 1, 'The Set Up', [])
  // Some problems warrant an explicit strategy paragraph; others go straight
  // to entities. Omit `planning` and the section disappears.
  if (a.planning) push('planning-the-approach', 2, 'Planning the Approach', [['p', a.planning]])
  push('core-entities', 2, 'Defining the Core Entities', [
    ['p', 'The nouns worth naming before you draw anything — they give you the language for the API and the data model.'],
    ['ent', a.entities],
  ])
  push('api', 2, a.apiTitle || 'API or System Interface', [
    a.apiIntro ? ['p', a.apiIntro] : null,
    ['api', a.api],
    a.apiNote ? ['note', a.apiNote] : null,
  ])

  push('high-level-design', 1, 'High-Level Design', [
    ['p', a.hld
      ? 'Walk the requirements one at a time, solving each as simply as it can be solved.'
      : 'Read straight off the diagram on the canvas. Change the design and this section changes with it.'],
  ])
  // `options` and `after` are authoring conveniences — fold them into blocks
  // so the renderer only ever deals with one stream.
  const flatten = s => {
    const blocks = [...(s.blocks || [])]
    if (s.options) blocks.push(['opts', s.options])
    if (s.after) blocks.push(...s.after)
    return { ...s, blocks, options: undefined, after: undefined }
  }

  for (const s of (a.hld || deriveHld(template))) sections.push(flatten(s))

  push('deep-dives', 1, 'Potential Deep Dives', [
    ['p', 'With the functional requirements met, this is where the non-functional ones get paid for — and where seniority shows.'],
  ])
  ;(a.dives || []).forEach((d, i) => {
    sections.push(flatten({ ...d, id: 'dd-' + (i + 1), h: 2, title: `${i + 1}) ${d.title}` }))
  })

  // Optional: assemble everything back into one picture before the level bars.
  if (a.finalDesign) {
    sections.push(flatten({
      id: 'final-design', h: 1, title: 'Final Design',
      focus: a.finalDesign.focus,
      blocks: a.finalDesign.blocks,
    }))
  }

  push('levels', 1, 'What is Expected at Each Level?', [
    ['p', 'How much of the above is actually required of you depends on the level you are interviewing at.'],
  ])
  push('level-mid', 2, 'Mid-level', [['p', LEVELS.mid], a.bar?.mid ? ['note', '**The bar here:** ' + a.bar.mid] : null])
  push('level-senior', 2, 'Senior', [['p', LEVELS.senior], a.bar?.senior ? ['note', '**The bar here:** ' + a.bar.senior] : null])
  push('level-staff', 2, 'Staff+', [['p', LEVELS.staff], a.bar?.staff ? ['note', '**The bar here:** ' + a.bar.staff] : null])

  return { title: a.title || template.name, meta: a.meta, intro: a.overview, sections }
}

const cache = new Map()

export function breakdownFor(template) {
  if (!template || !AUTHORED[template.name]) return null
  if (!cache.has(template.name)) cache.set(template.name, build(template))
  return cache.get(template.name)
}

export const BREAKDOWN_NAMES = Object.keys(AUTHORED)
export const BREAKDOWNS = AUTHORED
