// Authored breakdowns, part 6 — marketplaces. Shape documented in breakdown.js.

export default {

'Amazon (marketplace)': {
  meta: 'Big tech · hard · catalogue reads, inventory writes',
  overview: 'A global marketplace where third parties list most of the catalogue, inventory sits in hundreds of physical warehouses, and the page has to promise a delivery date before you have bought anything.',
  scope: 'The catalogue read path, the delivery promise and inventory correctness are the interview. Advertising, Prime video and the retail supply chain itself are below the line.',
  planning: 'Split the design on a single axis: catalogue is read-heavy and effectively immutable, inventory is write-heavy and must be exact. Almost every decision follows from refusing to treat those two as the same problem.',
  fr: {
    core: ['Search and browse a catalogue of billions of items', 'View a product with price, availability and a delivery date', 'Add to cart and check out', 'Third parties list and manage their own products'],
    out: ['Advertising and sponsored placement', 'Warehouse robotics and supply chain', 'Reviews and Q&A'],
  },
  nfr: {
    core: ['Product page under 300ms globally', 'Never sell stock that is not there', 'A delivery date that is right, not optimistic', 'Catalogue stays available when checkout is degraded'],
    out: ['Real-time inventory accuracy while browsing'],
  },
  nums: [['~80K/s', 'requests at peak'], ['billions', 'of catalogue items'], ['~100:1', 'browse to buy'], ['hundreds', 'of fulfilment centres holding stock']],
  entities: [
    ['Product', 'a listing — mostly owned by a third-party seller, not by you'],
    ['Offer', 'a seller\'s price and condition for a product; several per product'],
    ['Inventory', '(fulfilment centre, item) → quantity, the contended resource'],
    ['Order', 'a saga across payment, inventory reservation and fulfilment'],
  ],
  apiIntro: 'REST for browse and cart. The interesting endpoint is the product page, because it quietly joins catalogue, pricing, inventory and logistics into one response with a hard latency budget.',
  api: [
    { dir: '→', name: 'GET /products/{id}', body: '→ { product, offers[], deliveryPromise, recommendations[] }' },
    { dir: '→', name: 'POST /cart/items', body: '{ offerId, qty } → { cart }' },
    { dir: '→', name: 'POST /orders', body: '{ cartId, address, payment }\n→ { orderId } | 409 an item went out of stock' },
  ],
  dives: [
    {
      title: 'The delivery promise is the hard read', focus: ['prom', 'inv', 'prod'],
      blocks: [
        ['p', '"Arrives Tuesday" is not a property of the product. It is a computation over which fulfilment centres hold the item, which of those can reach this address in time, cut-off times, and the shipping options available — and it has to happen inside a 300ms page render.'],
        ['p', 'Doing it live per request is impossible. Precompute the mapping from region to reachable fulfilment centres, keep it warm, and reduce the request-time work to a lookup plus a stock check.'],
        ['warn', 'A promise you miss is worse than a slower promise. Bias the computation pessimistic — the cost of an over-optimistic date is a refund and a lost customer, the cost of a conservative one is a slightly worse conversion rate.'],
      ],
    },
    {
      title: 'Catalogue and inventory pull in opposite directions', focus: ['cat', 'pcache', 'inv'],
      blocks: [
        ['p', 'A product description changes almost never and is read billions of times: cache it hard, everywhere, and serve it stale without concern.'],
        ['p', 'Inventory changes constantly, is read on every page, and must be exact at checkout. It cannot be cached the same way and it cannot be eventually consistent when money is involved.'],
        ['bul', [
          'Serve availability as a **hint** on the product page — cached, approximate, refreshed often.',
          'Re-validate transactionally at checkout with a conditional decrement scoped to a specific fulfilment centre.',
          'Shard inventory by fulfilment centre, because that is the unit that physically holds stock and never needs joining across.',
        ]],
      ],
    },
    {
      title: 'You do not own the catalogue', focus: ['seller', 'cat', 'srch'],
      blocks: [
        ['p', 'Most listings come from third-party sellers, which means no schema you control, duplicate products under different names, and quality that varies enormously. That is a data problem masquerading as a scale problem.'],
        ['p', 'You need matching to collapse duplicate listings onto one product page with competing offers, and a moderation pipeline that runs asynchronously so a slow check never blocks a seller from listing.'],
        ['note', 'This is also why search is a separate index rather than a query over the catalogue store — the ranking signals come from behaviour and quality scoring, not from the seller-supplied text.'],
      ],
    },
  ],
  bar: {
    mid: 'Separate browse from checkout, cache the catalogue, and validate inventory transactionally.',
    senior: 'Design the delivery promise as a precomputed lookup, shard inventory by fulfilment centre, and treat checkout as a saga.',
    staff: 'Cover third-party catalogue quality and matching, regional read placement, and why availability may be stale while checkout may not.',
  },
},

'Flipkart (Big Billion Days)': {
  meta: 'Bharat · consumer · hard · a stampede you can see coming',
  overview: 'An Indian marketplace whose defining engineering event is a scheduled sale where tens of millions of people arrive in the same minute for a few thousand units.',
  scope: 'The flash sale, payment rails and serviceability are the interview. Warehouse operations and seller onboarding are below the line.',
  planning: 'Say early that the peak is on a published date. That single fact moves the whole problem from autoscaling to provisioning and admission control — and admission control is the honest answer, because no architecture makes 10,000 units satisfy ten million people.',
  fr: {
    core: ['Browse and search products', 'Show a deliverable product for the buyer\'s pincode', 'Buy during a flash sale without overselling', 'Pay by UPI, card or cash on delivery'],
    out: ['Seller onboarding', 'Warehouse operations', 'Returns processing'],
  },
  nfr: {
    core: ['Survive a 10× step change in traffic at a known minute', 'Never oversell a flash-sale item', 'Work on a slow tier-2 mobile network', 'A payment-rail outage must not lose the order'],
    out: ['Uniform latency during a sale event'],
  },
  nums: [['~60K/s', 'normal peak'], ['10×+', 'during Big Billion Days'], ['~10K units', 'against millions of buyers in a flash sale'], ['~30%', 'of orders cash on delivery']],
  entities: [
    ['Product', 'catalogue entry with offers and a pincode-dependent delivery estimate'],
    ['SaleUnit', 'the scarce thing — a fixed quantity released at a fixed time'],
    ['Order', 'a state machine that, for COD, stays open until cash is collected'],
    ['Pincode', 'the serviceability key that decides whether any of this is purchasable'],
  ],
  apiIntro: 'REST, deliberately small payloads. During a sale the checkout endpoint sits behind a queue and returns an admission token rather than an order.',
  api: [
    { dir: '→', name: 'GET /p/{id}?pincode=', body: '→ { product, price, deliverable, eta }' },
    { dir: '→', name: 'POST /sale/enter', body: '→ { token, position } — waiting room, not a purchase' },
    { dir: '→', name: 'POST /orders', body: '{ token?, items[], tender }\n→ { orderId } | 409 sold out' },
  ],
  dives: [
    {
      title: 'A flash sale is admission control, not capacity', focus: ['q', 'inv', 'ord'],
      blocks: [
        ['p', 'Ten million people want ten thousand units. There is no amount of infrastructure that makes that succeed — 99.9% of those requests are going to fail by definition, and the only question is whether they fail politely.'],
        ['steps', [
          'A waiting room admits buyers at the rate the order path can genuinely serve.',
          'Admitted buyers get a short-lived token; everyone else sees an honest position in a queue.',
          'Inventory decrements atomically per unit, so the first N tokens convert and the rest are told immediately.',
          'Nothing behind the queue ever sees more load than it was provisioned for.',
        ]],
        ['note', 'This is a product decision as much as an engineering one. A visible queue converts an outage into a wait, and users tolerate a wait far better than a spinner that ends in an error.'],
      ],
    },
    {
      title: 'Cash on delivery breaks the order state machine', focus: ['ord', 'odb', 'cod'],
      blocks: [
        ['p', 'With a prepaid order, payment confirms intent. With COD the money arrives days later, at the door, and may never arrive at all — so the order is committed, stock is gone and the customer has risked nothing.'],
        ['bul', [
          'Verify the buyer before accepting COD — phone confirmation, address history, order-value caps.',
          'Model COD as an order that stays open until settlement, not one that completes at dispatch.',
          'Track return-to-origin rates per buyer and per pincode, because that is the actual cost centre.',
        ]],
        ['warn', 'COD fraud and refusal rates are a business risk expressed as a data problem. Treat the verification step as part of the design rather than an operations afterthought.'],
      ],
    },
    {
      title: 'The network is the constraint for most users', focus: ['cdn', 'pdp', 'cache'],
      blocks: [
        ['p', 'A large share of buyers are on constrained mobile networks. Payload size is a product feature: aggressive image optimisation, small JSON, and a page that renders something useful before everything has arrived.'],
        ['p', 'Bot traffic is the other side of this. Price scrapers can exceed human traffic during a sale, and every scraped request is capacity you did not sell an item with — so the WAF is capacity work, not only security work.'],
      ],
    },
  ],
  bar: {
    mid: 'Cache the catalogue, validate inventory transactionally, and recognise the sale as a spike.',
    senior: 'Design the waiting room, pre-scale from the published date, and handle COD as a distinct state machine.',
    staff: 'Cover per-item admission at unit granularity, PSP routing under rail outages, and bot traffic as a capacity problem.',
  },
},

'IndiaMART (B2B leads)': {
  meta: 'Bharat · consumer · medium · a two-sided market where nothing is sold',
  overview: 'A B2B marketplace where buyers post requirements and suppliers pay for the resulting leads. No cart, no checkout, no inventory — the unit of value is an enquiry and the customer is the seller.',
  scope: 'Lead matching, lead quality and the SEO surface are the interview. Payments and the inside-sales organisation are below the line.',
  planning: 'The first thing to establish is that this is not e-commerce. Buyers are free and suppliers pay, so the two sides need different SLAs and different treatment — and lead quality, not uptime, is what the paying side actually buys.',
  fr: {
    core: ['Buyers search suppliers and post a requirement', 'Match each enquiry to relevant suppliers', 'Notify suppliers immediately', 'Meter contact reveals against a subscription'],
    out: ['Payments and invoicing', 'The inside-sales organisation', 'Logistics of any kind'],
  },
  nfr: {
    core: ['Leads reach suppliers within seconds', 'Fake or duplicate enquiries filtered before delivery', 'Millions of SEO pages served fast and crawlable', 'Contact-reveal counting is exact — it is billing'],
    out: ['Real-time supplier availability'],
  },
  nums: [['~8K/s', 'at peak'], ['millions', 'of indexed SEO landing pages'], ['~5–10', 'suppliers per enquiry, capped'], ['seconds', 'the useful life of a hot lead']],
  entities: [
    ['Supplier', 'the paying customer, with a subscription tier and credit balance'],
    ['Buyer', 'free, unverified by default, and the source of all supply-side value'],
    ['Lead', 'an enquiry — the product being sold, priced by how fresh and real it is'],
    ['Reveal', 'a metered contact disclosure, decremented against a subscription'],
  ],
  apiIntro: 'REST plus a very large server-rendered surface. The SEO pages are not marketing — they are the acquisition channel and they carry most of the traffic.',
  api: [
    { dir: '→', name: 'GET /search?q=&city=', body: '→ { suppliers[], facets }' },
    { dir: '→', name: 'POST /enquiries', body: '{ product, qty, city, contact }\n→ { leadId } — fanned out to matched suppliers' },
    { dir: '→', name: 'POST /leads/{id}/reveal', body: '→ { contact } | 402 out of credits' },
  ],
  dives: [
    {
      title: 'Lead quality is the entire business', focus: ['fraud', 'rfq', 'match'],
      blocks: [
        ['p', 'Suppliers pay for enquiries. If a meaningful share are fake, duplicated or from buyers who never respond, they churn — and they churn faster over bad leads than over downtime, because bad leads waste their time and their money.'],
        ['bul', [
          'Score enquiries before delivery: phone verification, duplicate detection, behavioural signals, blocklists.',
          'Rate-limit per buyer so one person cannot flood the market.',
          'Feed supplier feedback back into scoring — a lead nobody could reach should reduce that buyer\'s future reach.',
        ]],
        ['warn', 'Filtering has to happen before delivery, not after. Once a supplier has spent a credit on a fake lead, refunding it does not repair the impression.'],
      ],
    },
    {
      title: 'Fan-out with a deliberate cap', focus: ['match', 'k', 'notif'],
      blocks: [
        ['p', 'Sending one enquiry to every plausible supplier looks like maximising value and destroys it: the buyer gets fifty calls, and each supplier\'s odds drop to nothing, so the lead they paid for is worth almost zero.'],
        ['p', 'Cap the fan-out — five to ten suppliers — and rank who receives it by subscription tier, category fit, location and past responsiveness. That cap is a pricing decision expressed in the matching service.'],
        ['note', 'Speed matters as much as fit. A lead delivered in thirty seconds converts far better than the same lead delivered in ten minutes, which is why notification sits on the critical path.'],
      ],
    },
    {
      title: 'The SEO surface is the acquisition channel', focus: ['seo', 'cdn', 'cat'],
      blocks: [
        ['p', 'Millions of long-tail landing pages — every product in every city — are how buyers arrive. They must be server-rendered, fast and crawlable, which makes page generation a genuine scale problem rather than a marketing concern.'],
        ['p', 'These pages are near-static and identical for every visitor, so they belong on a CDN with regeneration on catalogue change rather than being rendered per request.'],
        ['p', 'Contact reveal is the one thing that must be exact: it decrements a paid balance, so it is billing and cannot be approximate or eventually consistent.'],
      ],
    },
  ],
  bar: {
    mid: 'Search, an enquiry flow, and notification to suppliers.',
    senior: 'Design lead scoring before delivery, cap the fan-out deliberately, and treat reveals as metered billing.',
    staff: 'Cover the two-sided SLA split, feedback loops into lead scoring, and SEO page generation at millions of URLs.',
  },
},

}
