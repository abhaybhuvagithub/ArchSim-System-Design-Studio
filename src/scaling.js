// "How do we scale this to a billion users?" — a playbook per template.
//
// Each entry has four parts:
//   constraint  the one thing that actually binds. Everything else follows from it.
//   ladder      four rungs of scale: [users, throughput, what you do at that rung]
//   levers      the specific moves for THIS design, each naming the components
//               it touches so the Scale tab can spotlight them on the canvas
//   wall        what you cannot scale away, and why. Every system has one.
//
// The rungs are deliberately opinionated: at 10K users you should not have a
// cache, and saying so is more useful than listing every technique at once.

import A from './scaling-a.js'
import B from './scaling-b.js'
import C from './scaling-c.js'
import D from './scaling-d.js'
import E from './scaling-e.js'

export const SCALING = { ...A, ...B, ...C, ...D, ...E }

export const SCALING_NAMES = Object.keys(SCALING)

export function scalingFor(template) {
  return (template && SCALING[template.name]) || null
}

// Rules that hold across every design in the library. Shown at the foot of the
// Scale tab so the per-template playbook has something to sit against.
export const PRINCIPLES = [
  {
    t: 'Find the binding constraint before you optimise anything',
    d: 'Every system has exactly one thing that gives out first — connections, egress, a licensed core, a GPU fleet, a bank\'s TPS. Scaling work that does not move that constraint produces no improvement, however good it looks in a diagram.',
  },
  {
    t: 'Reads and writes scale differently, so separate them early',
    d: 'Read paths cache, replicate and move to the edge. Write paths need ordering, durability and often a single authority. Almost every design here gets easier the moment those two are separate services with separate capacity.',
  },
  {
    t: 'Push work to the edge, then to the client',
    d: 'The cheapest request is the one your origin never sees. CDN caching, client-side debouncing, batched uploads and local buffering routinely remove an order of magnitude more load than any backend tuning.',
  },
  {
    t: 'Shard on something that never needs to be joined across',
    d: 'User, tenant, city, workspace, merchant, event. A good partition key means no distributed transactions and no scatter-gather queries. A bad one means every scaling step gets harder than the last.',
  },
  {
    t: 'Make the expensive thing asynchronous',
    d: 'Transcoding, fan-out, indexing, scanning, settlement, analytics. If it does not have to finish before you answer the user, it belongs behind a queue — where it can be retried, batched and scaled on its own.',
  },
  {
    t: 'Precompute the answer, do not compute it per request',
    d: 'Timelines, top-K lists, recommendation candidates, serviceable-store maps, travel-time regions. Moving work from read time to write time trades storage for latency, and storage is nearly always the cheaper side of that trade.',
  },
  {
    t: 'Approximate wherever the user cannot tell',
    d: 'View counts, like counts, trending ranks, presence, availability while browsing. Exactness is expensive and usually invisible. Reserve strong consistency for money, inventory and bookings — the places where being wrong is actually wrong.',
  },
  {
    t: 'Hot keys break otherwise perfect sharding',
    d: 'One viral link, one Super Bowl ad, one celebrity account, one popular seat. Salting, per-key replication, local in-process caches and dynamic subdivision are the standard answers; assume you will need one of them.',
  },
  {
    t: 'Predictable peaks should be provisioned, not autoscaled',
    d: 'Ticket on-sales, cricket finals, meal times, market open, Friday releases, check-in windows. Reactive autoscaling always lags a step change. If you know the schedule, scale to it in advance.',
  },
  {
    t: 'Decide in advance what you will switch off',
    d: 'A rehearsed degradation ladder — drop personalisation, widen a cache TTL, sample the feed, enter panic mode — turns an outage into a slightly worse product. Systems that survive their peaks have usually planned exactly what they sacrifice.',
  },
  {
    t: 'Retries amplify failures unless you budget them',
    d: 'Three tiers each retrying three times is twenty-seven requests hitting a service that is already struggling. Retry budgets, exponential backoff with jitter and circuit breakers are load-bearing at scale, not defensive extras.',
  },
  {
    t: 'At some point the limit stops being technical',
    d: 'Egress cost, GPU supply, licensed mainframe capacity, an acquiring bank\'s TPS, how many seats exist. Recognising you have hit a commercial or physical wall — and switching to admission control, pricing or procurement — is a senior-level answer, not a cop-out.',
  },
]
