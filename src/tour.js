// The first-run guided tour.
//
// Steps are data, and the geometry is a pure function, so both can be tested
// without a browser. The one thing that actually rots a tour is a selector
// that stops matching after a refactor — the tour then silently skips a step
// and nobody notices. `data-tour` attributes exist for exactly that reason,
// and there is a test asserting every step still finds its target.

export const TOUR_KEY = 'archsim.tour.v1'

// `tab` switches the Analysis panel before the step is shown, so the target
// exists by the time we measure it. `load` pulls in a template on the first
// step that needs something on the canvas — an empty canvas makes most of
// this tour meaningless.
export const TOUR_STEPS = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to ArchSim',
    body: 'A system design canvas that actually runs. You draw an architecture, push traffic through it, and watch where it breaks — capacity, cost, correctness and all. This tour takes about a minute.',
  },
  {
    id: 'templates',
    target: '[data-tour="templates"]',
    title: 'Start from a real design',
    body: '57 worked designs live here — WhatsApp, Uber, Ticketmaster, ChatGPT, UPI, and more. Pick one to study it, or start from a blank canvas. Loading one now so the rest of the tour has something to show.',
    load: 'Ticketmaster',
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
    body: 'Click any node to inspect it: replicas, throughput, and where the bottleneck is. Datastores also carry replication mode, quorum, isolation level and partitioning — so the model covers correctness, not just how much load a box can take.',
    tab: 'capacity',
  },
  {
    id: 'improve',
    target: '[data-tour="improve"]',
    title: 'Improve',
    body: 'An advisor reads your design and tells you what is missing — a cache in front of a hot store, a queue where a spike will drop writes, a single copy of data with no follower. It can wire the fix in for you.',
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
    id: 'learn',
    target: '[data-tour="tab-learn"]',
    title: 'Learn',
    body: 'A guided track with comparisons, a quiz and the numbers worth memorising. The Consistency section covers replication, partitioning and isolation, and every step asks you to change something on the canvas.',
    tab: 'learn',
  },
  {
    id: 'arrange',
    target: '[data-tour="arrange"]',
    title: 'Tidy up',
    body: 'Arrange lays the diagram out in clean left-to-right layers with as few crossing lines as it can manage. Fit brings everything back into view, and ①②③ numbers the connections in request order.',
  },
  {
    id: 'export',
    target: '[data-tour="export"]',
    title: 'Take it with you',
    body: 'Export a full architecture document as PDF or Word — every table, finding and figure on screen — or just the diagram as PNG. Design JSON round-trips, so you can save and reload your work.',
  },
  {
    id: 'a11y',
    target: '[data-tour="a11y"]',
    title: 'Built to be readable',
    body: 'A11y mode adds a text equivalent of the diagram for screen readers, stronger focus outlines and no motion. The Brief, Breakdown and About tabs can also be read aloud.',
  },
  {
    id: 'done',
    target: '[data-tour="help"]',
    title: 'That is the tour',
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
