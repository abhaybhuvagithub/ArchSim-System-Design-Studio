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
      'It also models the things a diagram cannot show: whether a read can be stale, whether two writes can conflict, what a storage engine costs you in tail latency, how far apart your regions really are, and who is allowed to open what.',
    ],
  },
  {
    title: 'Six pillars',
    lines: [
      '**Strong Foundation** — the physics are real formulas (queueing knees, availability composition, fan-out multiplication), the numbers carry provenance, and over a thousand automated checks run on every build. Nothing here is a promise; it is a check that passes.',
      `**Modular Design** \u2014 ${components} components with one contract each, a catalog every template is composed from, and pure modules (simulation, anatomy, integrity, diagrams-as-code, sharing) that the interface merely renders. Add a component and the whole studio learns it.`,
      '**Data Integrity** — every design that enters from outside (a share link, a Mermaid paste, a JSON document) passes through validation: dangling edges dropped, unknown types coerced, duplicates renamed — and every repair is reported, never silent. Money-grade thinking, applied to your diagram.',
      `**Flexible and Scalable** \u2014 ${templates} pre-wired designs from a URL shortener to a national payments switch, a crypto exchange and an autonomous-research loop, entry deep-links that open exactly where a conversation begins, Mermaid in and out, and a picker that starts in Bharat and reaches the world.`,
      '**Built to Endure** — a share link minted on day one decodes forever; the codec version is a superset contract the suite pins, the changelog is public, and the check count only goes up.',
      '**AI Ready** \u2014 the design itself is a small, documented JSON document any agent can read and write; LLM systems are first-class components with honest capacities; and a production-LLM curriculum runs from RAG and multi-tenant isolation to autonomous research loops \u2014 teaching how to operate these systems, not just name them.',
    ],
  },
  {
    title: 'How honest are the numbers?',
    lines: [
      'This is a flight simulator, not the airplane. The dynamics are engineered to be right — queueing curves, fan-out multiplication, availability composition, cache economics — so the reflexes you build here transfer to real systems. The exact figures are not predictions.',
      'Every component now carries its receipts: open any 🔍 internals view and the "Where these numbers come from" section labels each figure as **benchmark-anchored**, **vendor-documented**, or a **modeled estimate** — with links where public sources exist.',
      'Read latencies as bands, not points (the ~ on every chip means roughly ±40%). What no closed-form model captures: GC pauses, retry storms, coordinated omission, the specific ways your code is slow. For real capacity planning, calibrate against your own metrics — for design reasoning and interviews, order-of-magnitude is exactly the right resolution.',
    ],
  },
  {
    title: 'Why it is different',
    lines: [
      'Where it sits among the tools: whiteboards and diagrams-as-code draw, C4 tools organise, IaC visualisers deploy, discovery tools reverse-engineer — ArchSim runs. And it speaks their formats: export any design as Mermaid (READMEs render it natively) or Excalidraw (the interview whiteboard), and paste any Mermaid flowchart back in to simulate it.',
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
      '**Not a production-ready reference architecture.** This is a learning and interview-prep tool. The templates are simplified for teaching trade-offs, not audited or battle-tested designs — a real system built for the same company would differ in ways this tool cannot capture: internal constraints, team structure, existing infrastructure, compliance requirements and years of incident-driven changes.',
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
  {
    title: 'Beyond capacity',
    lines: [
      '**Correctness, not just throughput.** Every datastore carries a replication mode, a quorum, an isolation level and a partitioning strategy — and those feed the simulation rather than sitting in a tooltip. Choosing linearizable costs you throughput and latency on the canvas, because that is what it costs in production.',
      '**Reads and writes are separate.** Each connection carries a read/write mix, and stores have separate ceilings for each. It is the only way to show the most under-appreciated fact about single-leader replication: followers raise the read ceiling and do nothing at all for writes.',
      '**Distance is modelled.** Place components in real cloud regions and every cross-region link is labelled with its round-trip floor — the speed of light in fibre, before any service does work. Mumbai to Virginia is about 180ms and no amount of caching changes that.',
      '**Identity and entitlement.** Entry points carry an authentication method, sessions carry a revocation story, and services say where entitlement comes from. The advisor flags a licence lookup on the hot path, a privileged route behind a single factor, and tokens you have no way to withdraw.',
      '**Where it runs.** Place components in real cloud regions and the map labels every cross-region link with its round-trip floor. Mumbai to Virginia is about 180ms before any service does work, which is a constraint you design around rather than tune away.',
      '**A mock interview.** Five stages on the design you have loaded, scored per stage against what the breakdown says a good answer contains, with the specific things you did not say and what the next level up expects. It can be driven by a rubric that works offline, or by Claude with your own API key.',
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
