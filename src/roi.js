// ROI: the business view of a design. Infra cost comes from the live cost
// report; the revenue side is an honestly-labeled model — authored per
// template where the business is well known, archetype-derived otherwise.
// Everything is order-of-magnitude by design (same contract as the rest of
// the studio: right dynamics, banded numbers).
//
// The unit that makes everything computable: REVENUE PER MILLION REQUESTS.
// Subscriptions, ads and take-rates all reduce to it once you assume how
// many requests a paying unit generates — the basis string states exactly
// that assumption so it can be argued with.

const M = 1e6
const SEC_MONTH = 30 * 24 * 3600

// Authored monetization for marquee designs: $ revenue per 1M requests.
const AUTHORED = {
  'Netflix': { revPerM: 220, model: 'subscription', basis: 'ARPU ~$12/mo; a heavy streamer drives ~50k API+segment requests a month -> ~$220 per 1M requests.' },
  'Video Platform (YouTube)': { revPerM: 30, model: 'ads', basis: 'Roughly one ad per 8 requests at a ~$8 effective CPM, creator share paid out -> ~$30 per 1M requests.' },
  'News Feed (Twitter/X)': { revPerM: 12, model: 'ads', basis: 'Feed ARPU ~$3-4/quarter over ~1M feed requests per active user -> ~$12 per 1M.' },
  'News Feed (Instagram)': { revPerM: 25, model: 'ads', basis: 'Higher-value visual ad load: ~1 impression per 4 requests at strong CPMs.' },
  'Meta (Facebook)': { revPerM: 15, model: 'ads', basis: 'Global blended ARPU ~$40/yr against ~250k requests per user-month.' },
  'Chat (WhatsApp)': { revPerM: 2, model: 'usage', basis: 'Consumer chat is nearly free; Business API conversations monetize a thin slice -> ~$2 per 1M messages.' },
  'Payment System (Stripe-lite)': { revPerM: 60000, model: 'take-rate', basis: '~2.9% + 30c on a ~$50 charge; ~1 charge per 25 API requests -> ~$60k per 1M requests. Payments monetize the transaction, not the traffic.' },
  'Ramp': { revPerM: 35000, model: 'interchange', basis: '~1.5% interchange share on ~$80 average swipes; one auth per ~30 requests including dashboards.' },
  'CRED': { revPerM: 8000, model: 'take-rate + lending', basis: 'Bill-pay economics plus cross-sell; a paying action per ~100 requests at tens of rupees margin.' },
  'Zerodha (Kite)': { revPerM: 4000, model: 'per-order fee', basis: 'Rs 20/order on derivatives; one order per ~500 requests (ticker traffic dominates and earns nothing directly).' },
  'Online Auction (eBay)': { revPerM: 12000, model: 'final-value fee', basis: '~12% of a ~$40 item; one sale per ~400 requests of browsing and bidding.' },
  'Zepto (10-min delivery)': { revPerM: 18000, model: 'gross margin', basis: '~Rs 60 contribution per ~Rs 400 basket; one order per ~150 requests.' },
  'Zomato': { revPerM: 15000, model: 'commission', basis: '~20% commission on a ~Rs 350 order; one order per ~200 requests of browsing.' },
  'Ride Sharing (Uber)': { revPerM: 20000, model: 'take-rate', basis: '~25% of a ~$12 ride; one ride per ~150 requests including live tracking.' },
  'Dream11': { revPerM: 25000, model: 'contest rake', basis: '~15% rake on entry fees; one paid join per ~80 requests during match windows.' },
  'GitHub Actions': { revPerM: 900, model: 'usage minutes', basis: 'Paid runner minutes beyond free tier; ~$0.008/min with most requests being free reads.' },
  'Postman': { revPerM: 450, model: 'seats', basis: '~$14/seat-month against heavy sync traffic; requests vastly outnumber paying seats.' },
  'Vercel': { revPerM: 350, model: 'usage + seats', basis: 'Pro seats plus bandwidth/function overages; edge hits are cheap, so margin lives in the hit ratio.' },
  'Notion': { revPerM: 500, model: 'seats', basis: '~$10/seat-month; a busy seat drives ~20k block requests a month.' },
  'Plaid': { revPerM: 5000, model: 'per-item API', basis: 'Per-connected-account and per-call pricing to partners; the cache serves most reads at near-zero marginal cost.' },
  'Discord': { revPerM: 8, model: 'subscription slice', basis: 'Nitro converts a small single-digit % of an enormous free message volume.' },
  'GenAI: RAG Assistant': { revPerM: 15000, model: 'per-seat AI', basis: '~$20/seat-month; a seat asks ~1.3k questions -> ~$15 per 1k answers, with inference the dominant COST line to watch.' },
  'ChatGPT': { revPerM: 12000, model: 'subscription + API', basis: 'Plus subscriptions and API tokens against expensive inference; margin is a race between pricing and GPU cost per token.' },
  'Online Chess': { revPerM: 25, model: 'freemium', basis: 'A few % convert to ~$5/mo memberships against millions of free moves.' },
  'LeetCode (Online Judge)': { revPerM: 400, model: 'premium', basis: '~$35/mo premium; judging is the cost center, browsing is the funnel.' },
  'Strava': { revPerM: 120, model: 'subscription', basis: '~$12/mo from a ~10% payer base; uploads and feeds are mostly free-tier traffic.' },
  'Ad Click Aggregator': { revPerM: 50000, model: 'platform take', basis: 'The counted clicks ARE the billing: platform margin on ad spend per thousand clicks dwarfs infra by orders of magnitude.' },
  'FB Live Comments': { revPerM: 5, model: 'engagement', basis: 'Comments monetize indirectly through watch time and gifting slices.' },
  'Price Tracker': { revPerM: 800, model: 'affiliate', basis: '~4% affiliate commission when an alert converts; one purchase per ~5k tracked-price requests.' },
  'Object Storage (S3)': { revPerM: 25, model: 'usage-metered storage', basis: 'GET requests bill ~$0.40 per million - near-free by design. The business is the storage annuity (GB-months) that request traffic advertises; the request path is a loss-leader for data gravity.' },
  'Serverless Platform (Lambda)': { revPerM: 8, model: 'per-ms compute', basis: '$0.20 per million requests plus GB-seconds lands near $8 per million typical invokes. Margin is warm-pool prediction: an idle sandbox is pure cost, a cold start is a refund risk.' },
  'CDN (Edge Network)': { revPerM: 4, model: 'per-GB egress', basis: 'Small objects at cents per GB make ~$4 per million requests; flat-rate plans push it lower. The real economics: every point of hit ratio is origin egress the customer stops buying - retention sells the ratio, not the requests.' },
  'UPI Switch (NPCI)': { revPerM: 800, model: 'public infrastructure (per-txn fee)', basis: 'UPI runs near-free by design - switch economics are fractions of a rupee per transaction, and much of it waived as public-infrastructure policy. The honest framing is national throughput per unit cost: the value is the fifteen billion monthly transactions the rail carries, not the fee line. Treat this ROI as cost-recovery arithmetic, not a business case.' },
  'Card Payments (Auth + Settlement)': { revPerM: 45000, model: 'gateway + interchange share', basis: 'Payment economics are basis points on volume: at a ~Rs.3,000 ($40) average ticket, gateway fees plus interchange share land near $40-50K per million transactions - and every auth-minute of downtime is checkout abandoned at exactly that rate. The margin story is settlement accuracy: recon drift is negative revenue with a lawyer attached.' },
  'Fraud Detection (Real-time)': { revPerM: 60000, model: 'loss prevented (cost avoidance)', basis: 'Fraud systems are priced in losses that never happened: at ~10bps attempted fraud on a $40 ticket with ~80% catch rate, a million scored transactions prevent roughly $60K in direct losses - before chargeback fees and network fines. The counterweight is false positives: each point of over-blocking burns real sales, which is why the threshold is a CFO decision wearing an ML costume.' },
    'LLM API Platform (FastAPI)': { revPerM: 15000, model: 'usage-priced tokens', basis: 'Platform pricing lands near $10-20 per 1M requests at typical token counts - but COGS is the story: provider tokens are the dominant cost line, so gross margin is a race between your pricing and their rate card. The queue architecture is what keeps the margin from leaking into retries.' },
  'Agentic Workflow (Tools)': { revPerM: 180000, model: 'per-task value', basis: 'Agents price per completed task, not per request - tens of cents to dollars each against 3-15 model calls of COGS. Margin lives in loop efficiency (fewer wasted steps) and cheap-model routing for easy turns; the approval gate caps the downside of the expensive failures.' },
  'URL Shortener (Bitly)': { revPerM: 100, model: 'SaaS plans', basis: 'Paid plans sell analytics and custom domains; redirects themselves are a loss-leader served from cache.' },
}

// Group archetypes when no bespoke entry exists.
const ARCHETYPES = [
  { test: /payment|fintech|bank|upi|trading|broker|lending|insur/i, revPerM: 8000, model: 'take-rate', basis: 'Fintech archetype: monetizes a transaction slice, not traffic — one paying event per hundreds of requests.' },
  { test: /commerce|delivery|market|shop|food|travel|book|ticket|auction|cab|ride/i, revPerM: 10000, model: 'commission', basis: 'Commerce archetype: commission or contribution margin on orders; one order per 100-300 requests of browsing.' },
  { test: /ads|feed|social|video|stream|media|news|consumer|chat|game/i, revPerM: 15, model: 'ads / freemium', basis: 'Consumer archetype: ad impressions or thin freemium conversion against very large free volume.' },
  { test: /devtools|saas|b2b|platform|api|cloud|enterprise|unicorn/i, revPerM: 300, model: 'seats / usage', basis: 'B2B SaaS archetype: seat or usage pricing; requests vastly outnumber paying units.' },
  { test: /ai|ml|llm|gen/i, revPerM: 8000, model: 'per-seat AI', basis: 'AI product archetype: premium seat pricing with inference as the dominant cost line.' },
]

const INTERNAL = /rate limiter|redis|distributed cache|scheduler|crawler|observab|golden|notification|search autocomplete|leaderboard|lakehouse|cdc|feature flag|secrets|ci\/cd|service mesh|api gateway|dns|logging|monitor/i

export function roiFor(template, cost, rps) {
  if (!template) return null
  const reqsMonth = (rps || 0) * SEC_MONTH
  const infra = cost?.total || 0
  const costPerM = reqsMonth > 0 ? infra / (reqsMonth / M) : 0

  if (INTERNAL.test(template.name)) {
    return {
      internal: true, infra, reqsMonth, costPerM,
      basis: 'This is an internal capability, not a product: it has no revenue line of its own. Its ROI is the outages it prevents and the engineering time it saves — measure it in cost per million requests and reliability, and hold that cost against the blast radius of not having it.',
    }
  }

  let m = AUTHORED[template.name]
  let cls = 'authored'
  if (!m) {
    const hay = template.name + ' ' + (template.group || '') + ' ' + (template.tagline || '')
    m = ARCHETYPES.find(a => a.test.test(hay)) || { revPerM: 200, model: 'modeled', basis: 'Generic product archetype — replace with your own unit economics before believing anything downstream.' }
    cls = 'archetype'
  }
  const revenue = (reqsMonth / M) * m.revPerM
  const margin = revenue - infra
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
  // Both sides scale ~linearly with traffic in this model, so margin% is
  // scale-invariant: the honest comparison is $ per million requests earned
  // vs spent, not a break-even rps that does not exist.
  return {
    internal: false, cls, model: m.model, basis: m.basis,
    infra, reqsMonth, costPerM, revPerM: m.revPerM, revenue, margin, marginPct,
    infraShare: revenue > 0 ? (infra / revenue) * 100 : null,
  }
}
