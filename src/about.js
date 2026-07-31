// The About panel. Counts are read from the live modules so this page can never
// drift from what the product actually ships.
import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import { TEMPLATES } from './templates.js'
import { FAULTS } from './faults.js'
import { CLOUDS } from './clouds.js'
import { LESSON, COMPARISONS, QUIZ, TIPS } from './learn.js'

const components = Object.keys(CATALOG).length
const templates = TEMPLATES.length
const groups = [...new Set(TEMPLATES.map(t => t.group))].length
const faults = FAULTS.length
const clouds = CLOUDS.length - 1
const requirements = TEMPLATES.reduce((n, t) => n + t.checklist.length, 0)
const tips = TIPS.reduce((n, g) => n + g.items.length, 0)

export const ABOUT = [
  {
    title: 'What this is',
    lines: [
      '**ArchSim is a system design studio that runs your architecture instead of just drawing it.**',
      `You place components on a canvas, wire them up, set a traffic level — and every box becomes a thing with capacity, latency and an availability figure. Push traffic through and you get p50, p95 and p99, per-tier utilization, dropped requests, modelled availability and a monthly bill that moves as you edit.`,
      `Today it ships ${components} components across ${PALETTE_GROUPS.length} groups, ${templates} pre-wired designs in ${groups} categories, ${faults} named chaos faults, and cloud mappings for ${clouds} providers.`,
    ],
  },
  {
    title: 'Why it is different',
    lines: [
      '**A diagram cannot be wrong — which is why diagrams teach you nothing.** Draw a single load balancer in front of forty services in any other tool and it will happily render it. Here it turns red at 100% utilization, starts dropping traffic, and the p99 goes with it. The feedback is the point.',
      '**The advice is executable, not a checklist.** The advisor reads your actual graph and every finding carries a one-click fix that edits the diagram — splicing a cache between a service and its database, putting a queue in front of a synchronously-called worker, shielding a mainframe behind enterprise MQ. Nothing is a link to an article.',
      `**Chaos is a first-class mode, not a slide.** ${faults} named failures — availability zone, grey failure, cache stampede, expired TLS certificate, thread-pool exhaustion, retry storm — each compiled into real capacity, latency, drop and partition effects, each with a mitigation hint and a quick fix, each healing itself.`,
      '**Cost is wired to the simulation.** Per-request pricing is driven by the traffic actually routed through each node, so the bill reacts to the traffic slider and to every replica change. It tells you things a diagram cannot: that the URL shortener costs $13.7k/mo at 1k rps and $1.33M at 100k because CDN egress dominates, or that an LLM API is $184 per million requests and essentially all of it is inference.',
      `**It teaches while you build.** A ${LESSON.length}-step walkthrough that grades itself against your live canvas, ${tips} tips and tricks each with something to try on the canvas, ${COMPARISONS.length} "difference between" tables, ${QUIZ.length} interview questions with explanations, and ${requirements} requirement checkboxes across the template library — each of which edits the architecture when you tick it.`,
      `**Multi-cloud is concrete.** Every component maps to a named managed service on ${clouds} clouds, the diagram relabels itself, and the estimate reprices. Where a cloud genuinely has no equivalent it says "no public equivalent" rather than inventing one.`,
      '**It writes the design up for you.** The Brief tab narrates the architecture in prose — request path, live behaviour, chaos impact against a healthy baseline, outstanding findings, risk and cost — and exports as markdown.',
    ],
  },
  {
    title: 'How the model works',
    lines: [
      'Traffic propagates through the graph in topological order. Each component has a per-instance capacity and base latency; utilization is offered load over capacity × replicas.',
      'Queueing delay follows an M/M/1-flavoured curve — roughly 1/(1−utilization) — which is why latency climbs steeply past ~70% and p99 moves long before anything is dropped.',
      'The tail spread widens with load rather than being a fixed multiple, so the same design shows a p99/p50 ratio of about 2.4× when idle and 4.4× when busy.',
      'Availability multiplies across the components on a live path, with redundancy modelled as 1 − (1 − per-instance availability)^replicas.',
      'Caches and CDNs forward only their misses, which is why inserting one visibly unloads everything behind it.',
    ],
  },
  {
    title: 'What it is not',
    lines: [
      '**Not a benchmark.** These are order-of-magnitude models chosen to make trade-offs visible, not measurements of your workload. A real system has request-size variance, connection pools, GC pauses and correlated failures this does not model.',
      '**Not a quote.** Prices are on-demand US list rates with no reserved instances, committed-use discounts or negotiated pricing, and currency conversion uses static rates rather than a live FX feed.',
      '**Not a replacement for load testing.** It models the traffic; a real load test generates it. That is exactly why the component library includes one.',
      'Use it to compare two designs, to find the bottleneck before you build it, and to explain a decision to someone else. Do not use it to size a purchase order.',
    ],
  },
  {
    title: 'Credits',
    lines: [
      'Curated and built by **Abhaykumar Bhuva** — [linkedin.com/in/abhaybhuva](https://www.linkedin.com/in/abhaybhuva/)',
      'Built with **Anthropic Claude** — [anthropic.com/claude](https://www.anthropic.com/claude)',
      'Runs entirely in your browser. No account, no backend, nothing leaves the page — your designs are yours.',
    ],
  },
]

// Honest positioning against the tools people actually reach for instead.
export const ABOUT_COMPARE = {
  cols: ['ArchSim', 'Diagram', 'Pricing'],
  rows: [
    ['Draws the architecture', 'Yes', 'Yes', 'No'],
    ['Tells you it will fall over', 'Yes — utilization, drops, p99', 'No', 'No'],
    ['Costs it', 'Yes, driven by simulated traffic', 'No', 'Yes, from a form'],
    ['Fixes it for you', 'One-click quick fixes', 'No', 'No'],
    ['Fails it on purpose', `${faults} chaos faults`, 'No', 'No'],
    ['Teaches the reasoning', `Lesson, ${tips} tips, quiz`, 'No', 'No'],
    ['Ready-made designs', `${templates} templates`, 'Shape libraries', 'No'],
  ],
  note: 'Diagram = a drawing tool such as Lucidchart or draw.io. Pricing = a cloud pricing calculator.',
}
