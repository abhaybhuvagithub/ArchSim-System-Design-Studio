// The first-run guided tour.
//
// Steps are data, and the geometry is a pure function, so both can be tested
// without a browser. The one thing that actually rots a tour is a selector
// that stops matching after a refactor — the tour then silently skips a step
// and nobody notices. `data-tour` attributes exist for exactly that reason,
// and there is a test asserting every step still finds its target.

import { TEMPLATES } from './templates.js'

export const TOUR_KEY = 'archsim.tour.v1'

// A curated slice of recognisable names for the marquee on the templates
// step — text wordmarks, not brand artwork. Kept separate from TEMPLATES
// itself since many entries there (patterns, generic designs) aren't
// company names and wouldn't read as one in a logo-strip-style scroll.
export const TOUR_MARQUEE = [
  'WhatsApp', 'Uber', 'Netflix', 'YouTube', 'Ticketmaster', 'ChatGPT',
  'Dropbox', 'Spotify', 'Instagram', 'Amazon', 'Anthropic Claude', 'Redis',
  'Tesla', 'Razorpay', 'Zomato', 'Ola', 'Rapido', 'BHIM (UPI)', 'Google Docs', 'Yelp',
]

// `tab` switches the Analysis panel before the step is shown, so the target
// exists by the time we measure it. `load` pulls in a template on the first
// step that needs something on the canvas — an empty canvas makes most of
// this tour meaningless.
export const TOUR_STEPS = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to ArchSim',
    body: 'A system design canvas that actually runs. You draw an architecture, push traffic through it, and watch where it breaks — capacity, cost, correctness and all. This tour takes about two minutes, and the button that started it replays it any time.',
  },
  {
    id: 'templates',
    target: '[data-tour="templates"]',
    title: 'Start from a real design',
    body: `${TEMPLATES.length} worked designs live here — WhatsApp, Uber, Ticketmaster, ChatGPT, UPI, and more. Pick one to study it, or start from a blank canvas. Loading one now so the rest of the tour has something to show.`,
    load: 'Ticketmaster',
    marquee: true,
  },
  {
    id: 'canvas',
    target: '[data-tour="canvas"]',
    title: 'The canvas',
    body: 'Drag boxes to move them. Drag from the blue port on a box to another box to wire them up. Click a connection to label it, scroll to zoom, and press Delete to remove what you have selected.',
  },
  {
    id: 'palette',
    target: '[data-tour="palette"]',
    title: 'Components',
    body: 'Every building block you can add — load balancers, caches, queues, databases, CDNs, ML services. Drag one onto the canvas. Each carries real capacity and latency numbers, which is what makes the simulation mean anything.',
  },
  {
    id: 'traffic',
    target: '[data-tour="traffic"]',
    title: 'Turn up the traffic',
    body: 'Set the request rate the design has to survive, from 100 rps to a million. Most designs look fine until you move this slider.',
  },
  {
    id: 'simulate',
    target: '[data-tour="simulate"]',
    title: 'Run it',
    body: 'Press Simulate and traffic flows through the diagram. Saturated tiers turn red, queues back up, and latency climbs. This is the difference between a drawing and a model.',
  },
  {
    id: 'analysis',
    target: '[data-tour="analysis"]',
    title: 'The analysis panel',
    body: 'Everything the simulator knows about your design, one tab at a time. The next few steps walk through the ones worth knowing.',
    tab: 'capacity',
  },
  {
    id: 'capacity',
    target: '[data-tour="tab-capacity"]',
    title: 'Capacity — and what each store guarantees',
    body: 'Click any node to inspect it: replicas, throughput, and where the bottleneck is. Datastores carry replication mode, quorum, isolation and partitioning; caches expose their write policy (through, back, around — with the loss-window warning live); balancers expose their algorithm, and consistent hashing computes the resize math for that exact tier.',
    tab: 'capacity',
  },
  {
    id: 'improve',
    target: '[data-tour="improve"]',
    title: 'Improve',
    body: 'An advisor reads your design and tells you what is missing — a cache in front of a hot store, a queue where a spike will drop writes. The 🚀 Future-ready items go further: front door, wired observability, no SPOFs, guardrails on every AI tier, headroom, 99.9% availability — each with a one-click fix that iterates against the real simulator until its gate passes.',
  },
  {
    id: 'chaos',
    target: '[data-tour="chaos"]',
    title: 'Chaos',
    body: 'Break things on purpose. Kill a node, sever a link, skew a clock, pause a process. The distributed faults are the interesting ones: they leave the node running, which is exactly why they are hard — a timeout cannot tell a paused process from a dead one.',
  },
  {
    id: 'cost',
    target: '[data-tour="tab-cost"]',
    title: 'Cost',
    body: 'What this design costs per month, priced against real cloud list prices. Switch cloud and currency in the toolbar and every figure follows.',
    tab: 'cost',
  },
  {
    id: 'breakdown',
    target: '[data-tour="tab-breakdown"]',
    title: 'Breakdown',
    body: 'The full interview-style write-up for the loaded design: requirements, core entities, the API, high-level design, and deep dives — with diagrams that evolve stage by stage.',
    tab: 'breakdown',
  },
  {
    id: 'scale',
    target: '[data-tour="tab-scale"]',
    title: 'Scale',
    body: 'How this design gets from its first users to a billion — the constraint that bites at each rung, and the specific lever that clears it.',
    tab: 'scale',
  },
  {
    id: 'slo',
    target: '[data-tour="tab-slo"]',
    title: 'SLO — the verdict',
    body: 'Pick a target and the design gets judged like production: error budget in real minutes, burn rate, and a six-gate readiness review. Every failing gate carries a ⚡ fix that discloses its plan first, then converges against the simulator until that gate passes.',
    tab: 'slo',
  },
  {
    id: 'roi',
    target: '[data-tour="tab-roi"]',
    title: 'ROI — the business floor',
    body: 'What a million requests earn against what they cost, with authored revenue models per archetype — a payments stack and a CDN have opposite economics. Executive framings included: one sentence for the board, a P&L for the CFO, risk for the CTO. Internal systems get honest cost-avoidance, not fantasy revenue.',
    tab: 'roi',
  },
  {
    id: 'learn',
    target: '[data-tour="tab-learn"]',
    title: 'Learn',
    body: 'A guided track with comparisons, a quiz and the numbers worth memorising. The Consistency section covers replication, partitioning and isolation, and every step asks you to change something on the canvas.',
    tab: 'learn',
  },
  {
    id: 'mastery',
    target: '[data-tour="tab-mastery"]',
    title: 'Mastery — the 80/20',
    body: 'The eleven areas that carry most system design interviews, itemized into 35 tracked concepts — each with a teaching line, an inline ⇄ Compare table where the concept is a trade-off, and a ▶ Practice button that lands on the exact template and control. Shuffled every visit, because positional memory is the enemy of review.',
    tab: 'mastery',
  },
  {
    id: 'acronyms',
    target: '[data-tour="tab-acr"]',
    title: 'Acronyms',
    body: 'Every abbreviation the studio uses — nearly a hundred — expanded once, searchable, and categorised. The tax on jargon, paid in full.',
    tab: 'acr',
  },
  {
    id: 'share',
    target: '[data-tour="share"]',
    title: 'The URL is the design',
    body: 'Share encodes the whole canvas — nodes, wiring, traffic, even inspector settings — into the link itself. Send it and they open exactly this, no account, no server, no expiry.',
  },
  {
    id: 'cmdk',
    target: null,
    title: '⌘K — one keystroke to anywhere',
    body: 'Ctrl+K or ⌘K opens the command palette: load any template, jump to any tab, or open a mastery concept where it is practiced. The fastest way around nineteen tabs.',
  },
  {
    id: 'arrange',
    target: '[data-tour="view"]',
    title: 'Tidy up',
    body: 'The View menu holds Arrange, which lays the diagram out in clean left-to-right layers with as few crossing lines as it can manage. Fit brings everything back into view, and ①②③ numbers the connections in request order.',
  },
  {
    id: 'export',
    target: '[data-tour="design"]',
    title: 'Take it with you',
    body: 'The Design menu exports a full architecture document as PDF or Word — every table, finding and figure on screen — or just the diagram as PNG. Design JSON round-trips, so you can save and reload your work.',
  },
  {
    id: 'a11y',
    target: '[data-tour="view"]',
    title: 'Built to be readable',
    body: 'Screen-reader mode, also under View, adds a text equivalent of the diagram, stronger focus outlines and no motion. The Brief, Breakdown and About tabs can also be read aloud.',
  },
  {
    id: 'done',
    target: '[data-tour="help"]',
    title: 'That is the guide',
    body: 'Press this button any time to run it again. Now load a design you care about and turn the traffic up until something goes red.',
  },
]

// Where to put the tooltip so it stays on screen and does not cover the thing
// it is pointing at. Pure geometry — no DOM — so the edge cases are testable.
export function placeTooltip(target, tip, vp, gap = 14) {
  // No target: centre it, which is what the welcome and closing steps want.
  if (!target) {
    return {
      placement: 'center',
      x: Math.round((vp.w - tip.w) / 2),
      y: Math.round((vp.h - tip.h) / 2),
    }
  }

  const room = {
    bottom: vp.h - (target.y + target.h),
    top: target.y,
    right: vp.w - (target.x + target.w),
    left: target.x,
  }

  // Prefer below, then above, then the side with more room. Whatever we pick,
  // the clamp below guarantees the tooltip is fully on screen.
  let placement
  if (room.bottom >= tip.h + gap) placement = 'bottom'
  else if (room.top >= tip.h + gap) placement = 'top'
  else if (room.right >= tip.w + gap) placement = 'right'
  else if (room.left >= tip.w + gap) placement = 'left'
  else placement = room.bottom >= room.top ? 'bottom' : 'top'

  let x, y
  if (placement === 'bottom' || placement === 'top') {
    x = target.x + target.w / 2 - tip.w / 2
    y = placement === 'bottom' ? target.y + target.h + gap : target.y - tip.h - gap
  } else {
    x = placement === 'right' ? target.x + target.w + gap : target.x - tip.w - gap
    y = target.y + target.h / 2 - tip.h / 2
  }

  return {
    placement,
    x: Math.round(clamp(x, gap, Math.max(gap, vp.w - tip.w - gap))),
    y: Math.round(clamp(y, gap, Math.max(gap, vp.h - tip.h - gap))),
  }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

// A step whose target is not on screen — a panel collapsed into a drawer on a
// narrow window, say — is skipped rather than shown pointing at nothing.
export function stepsFor(doc, steps = TOUR_STEPS) {
  return steps.filter(s => !s.target || doc.querySelector(s.target))
}

export function shouldAutoStart(storage) {
  try { return !storage.getItem(TOUR_KEY) } catch { return false }
}

export function markSeen(storage) {
  try { storage.setItem(TOUR_KEY, String(Date.now())) } catch { /* private mode */ }
}
