// Scaling playbooks, part 4 — marketplaces. Shape documented in scaling.js.

export default {

'Amazon (marketplace)': {
  constraint: 'Catalogue read volume, and the delivery-promise computation that every one of those reads has to include.',
  ladder: [
    ['10K users', '~10 rps', 'One service, one database, availability read live. Entirely fine.'],
    ['1M users', '~1K rps', 'Cache the catalogue, split search into its own index, and stop computing the delivery promise per request.'],
    ['100M users', '~50K rps', 'Regional read replicas and caches, inventory sharded by fulfilment centre, checkout as a saga.'],
    ['1B users', '~500K rps', 'Multi-region with local catalogue serving. Inventory stays regional because stock is physical and does not replicate.'],
  ],
  levers: [
    { t: 'Precompute reachability', d: 'Which fulfilment centres can serve which region by when changes slowly. Precompute it and the delivery promise becomes a lookup plus a stock check instead of a routing calculation on the hot path.', n: ['prom', 'inv'] },
    { t: 'Cache the catalogue everywhere', d: 'Product data is near-immutable and read billions of times. It should almost never reach a database, and staleness of minutes is invisible.', n: ['pcache', 'cat', 'cdn'] },
    { t: 'Shard inventory by fulfilment centre', d: 'Stock lives in one physical place, so that is the natural partition — no cross-shard queries and no distributed transactions at checkout.', n: ['inv'] },
    { t: 'Degrade the page, never the checkout', d: 'Recommendations and personalised rows are optional; drop them under load. The buy button is not optional.', n: ['rec', 'prod'] },
    { t: 'Search is a separate index', d: 'Ranking signals come from behaviour and quality scoring, not from seller-supplied text. Keeping it out of the catalogue store lets each scale on its own curve.', n: ['srch'] },
  ],
  wall: { t: 'Stock is physical', d: 'Inventory cannot be replicated for read scale because it represents boxes in a building. You can cache the answer, but the decrement is always a write to one authoritative place, and no architecture changes that.' },
},

'Flipkart (Big Billion Days)': {
  constraint: 'A scheduled step change in traffic, against an inventory that is deliberately far smaller than demand.',
  ladder: [
    ['100K users', '~100 rps', 'Straightforward marketplace. The sale is small enough to absorb.'],
    ['10M users', '~6K rps', 'CDN, PDP caching, transactional inventory. Sale traffic starts to hurt and a queue appears.'],
    ['100M users', '~60K rps', 'Waiting room in front of checkout, provisioning driven by the sale calendar, PSP routing across payment rails.'],
    ['sale peak', '~600K rps', 'Everything upstream of the queue scales horizontally; everything behind it deliberately does not.'],
  ],
  levers: [
    { t: 'Provision from the calendar', d: 'The date is published weeks ahead. Reactive autoscaling cannot follow a 10× step change in two minutes, and the lag is the entire incident.', n: ['gw', 'pdp'] },
    { t: 'Admission control at unit granularity', d: 'A waiting room that admits at the rate checkout can serve turns a guaranteed outage into a visible, fair queue. This is the only thing that actually works.', n: ['q', 'ord'] },
    { t: 'Serviceability before everything', d: 'Precomputed pincode-to-warehouse mapping means an undeliverable product is never purchasable, which removes a whole class of failed order at the cheapest possible point.', n: ['pin', 'inv'] },
    { t: 'Route across payment rails', d: 'UPI and card acquirers have their own limits and outages. Multi-PSP routing on live health is both a capacity lever and a conversion one.', n: ['pay', 'upi'] },
    { t: 'Treat bots as capacity', d: 'Price scrapers can exceed human traffic during a sale. Every scraped request is capacity that did not sell anything, so the WAF belongs in the capacity plan.', n: ['waf', 'cdn'] },
  ],
  wall: { t: 'Ten thousand units', d: 'When demand exceeds supply by three orders of magnitude, almost every request must fail by construction. Past that point you are choosing a queuing discipline and a fairness policy, not scaling a system.' },
},

'IndiaMART (B2B leads)': {
  constraint: 'Lead quality and freshness. Throughput is modest; what degrades is the value of each lead as volume grows.',
  ladder: [
    ['10K suppliers', '~50 rps', 'Search, an enquiry form, an email to matching suppliers. Genuinely enough.'],
    ['1M suppliers', '~1K rps', 'Scoring before delivery, capped fan-out, notification behind a queue, SEO pages pre-rendered.'],
    ['10M suppliers', '~8K rps', 'Matching becomes a ranking problem. Reveal metering split from the leads store. CDN in front of the whole SEO surface.'],
    ['category leader', '~50K rps', 'Regional serving, incremental regeneration of millions of pages, feedback loops from supplier response into scoring.'],
  ],
  levers: [
    { t: 'Filter before delivering', d: 'A fake lead that reaches a supplier has already cost you their trust and their credit. Scoring must sit before fan-out, never after.', n: ['fraud', 'rfq'] },
    { t: 'Cap the fan-out', d: 'Sending one enquiry to fifty suppliers destroys its value for all of them and buries the buyer in calls. Five to ten, ranked by tier and fit, is worth more to everyone.', n: ['match', 'notif'] },
    { t: 'Pre-render the SEO surface', d: 'Millions of long-tail pages are the acquisition channel and are identical for every visitor. Generate on catalogue change and serve from the edge, never per request.', n: ['seo', 'cdn', 'cat'] },
    { t: 'Deliver in seconds', d: 'A lead is worth dramatically more in the first minute than the tenth. Notification is on the critical path even though nothing about it looks latency-sensitive.', n: ['k', 'notif'] },
    { t: 'Meter reveals exactly', d: 'Contact reveals decrement a paid balance, so that counter is billing. It is the one part of the system that cannot be approximate.', n: ['cred', 'sub'] },
  ],
  wall: { t: 'Supply of real buyers', d: 'You can index more suppliers indefinitely, but genuine enquiries are finite. Growth past that point dilutes leads per supplier and churns the paying side — the constraint is market demand, not infrastructure.' },
},

}
