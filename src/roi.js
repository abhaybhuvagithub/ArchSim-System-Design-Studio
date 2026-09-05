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
  'Ayurveda Gyaan (Charak Samhita)': { revPerM: 12000, model: 'consult take + institutional licensing', basis: 'Gyaan access stays free by mission - the knowledge is a commons, and monetizing shloka reads would deserve the word cruel. Revenue rides consults (AYUSH teleconsult take, like Telemedicine at lower ticket) and institutional licensing (colleges, AYUSH programs, research access to the overlay and concordance APIs) - blended, a million front-door requests carries roughly $10-15K. The honest margin line: the costly asset is scholarly review throughput, and it is paid for because it IS the product.' },
  'Telemedicine (Practo)': { revPerM: 22000, model: 'per-consult marketplace take', basis: 'Consult platforms take a commission per completed consult (Rs.100-300 on a Rs.400-800 visit), but most front-door traffic is browse and booking - blended, a million requests carries on the order of $20-25K in consult take. The margin realities are healthcare-shaped: compliance capacity (audit storage, retention, residency) is a permanent COGS line, and one privacy incident erases years of take - the audit tier is cheap insurance priced against that.' },
  'UPI Switch (NPCI)': { revPerM: 800, model: 'public infrastructure (per-txn fee)', basis: 'UPI runs near-free by design - switch economics are fractions of a rupee per transaction, and much of it waived as public-infrastructure policy. The honest framing is national throughput per unit cost: the value is the fifteen billion monthly transactions the rail carries, not the fee line. Treat this ROI as cost-recovery arithmetic, not a business case.' },
  'Enterprise SSO (Entra/Okta)': { revPerM: 0, model: 'cost-avoidance and risk-reduction, not revenue', basis: 'SSO is infrastructure the business pays FOR, not a product it sells, so framing it by revenue-per-million-requests misses the point - its ROI is measured in breaches avoided, help-desk password resets eliminated (often the single largest IT ticket category), employee minutes not lost to re-logins across 500 apps, and audits passed. The honest number is the cost of its absence: an SSO outage is a company-wide work stoppage, and a deprovisioning failure is a breach headline. Buy or build for reliability and lifecycle rigor; the return is everything that does not go wrong.' },
  'Discovery Loop (Autonomous Research)': { revPerM: 0, model: 'discoveries and IP, not request revenue', basis: 'This is a research organization, not a SaaS product, so revenue-per-million-requests is the wrong lens entirely - the control plane is deliberately low-QPS and the value is created inside the loop, not at the API. The return is measured in discoveries: research breakthroughs, the intellectual property they create, and - reflexively, since the first target is ML research itself - improvements that compound back into the models and methods the whole field runs on. The dominant cost is unmissable and physical: the accelerator fleet, where idle or misallocated GPU-hours are the largest waste, which is exactly why expected-information-gain scheduling is not an optimization but the core economic engine. As a public-benefit corporation the honest ROI framing is progress-per-GPU-hour: how much genuine discovery each unit of scarce compute buys, held against a burn rate that only pays off if the loop actually learns.' },
  'SaaS AI Copilot (Multi-tenant RAG)': { revPerM: 40000, model: 'AI add-on seats + metered overage', basis: 'AI features in SaaS are sold as an add-on per seat plus metered overage on tokens; blended across browse and ask traffic, a million requests carries roughly $35-45K in AI-attributed revenue. The margin line is the LLM gateway bill - the semantic cache and model routing (cheap model first, expensive on the hard slice) are the difference between a feature and a business. Isolation failures cost the whole account, not the feature.' },
  'Pine Labs (Merchant POS + EMI)': { revPerM: 30000, model: 'MDR + EMI subvention share + device/SaaS fees', basis: 'Merchant acquiring earns on the merchant discount rate (a slice of each transaction), a share of EMI subvention and processing on financed sales, plus terminal rental and value-added software fees - blended, a million transactions carries roughly $25-35K, and EMI-heavy high-ticket retail (electronics, appliances) skews it up because financed baskets are large and subvention-rich. The margin lever is least-cost routing: shaving basis points off acquirer cost on millions of transactions is the difference between a thin and a healthy take. The honest cost line is the fleet - 600K terminals are capital, logistics and support, not just software.' },
  'Coinbase (Crypto Exchange)': { revPerM: 55000, model: 'trading fees (taker/maker) + custody + spread', basis: 'An exchange earns a fee on every trade (higher for takers who remove liquidity, lower for makers who add it), plus custody fees and spread on conversions - and because volume spikes with volatility, revenue is famously lumpy: enormous in a bull run, thin in a quiet market. Blended across a million requests, trading-heavy activity carries roughly $50-60K, but the honest framing is that this is a business whose top line swings with crypto sentiment more than with engineering. The dominant risk-cost is not compute but security: a single custody breach is irreversible and existential, so spend on cold storage, MPC and audits is the cost of staying in business, not overhead.' },
  'Databricks (Lakehouse Compute)': { revPerM: 42000, model: 'consumption-based compute (DBU-style) + platform', basis: 'The lakehouse bills by compute consumed - units per node-second of jobs and SQL - so revenue tracks the work customers run, and margin lives in the gap between what compute is sold for and what the underlying cloud VMs cost. Blended, heavy-processing usage carries roughly $35-45K per million operations. The economic point mirrors the architecture: because compute and storage are separate and compute is ephemeral, customers pay for bursts not idle clusters, which is cheaper for them and still profitable because the platform captures margin on every DBU across a huge fleet. Storage is a thin low-margin line; compute is the business.' },
  'Snowflake (Cloud Warehouse)': { revPerM: 45000, model: 'per-second compute credits + storage', basis: 'Snowflake charges credits per second of virtual-warehouse compute plus a separate storage fee - the separation of the two layers is also the separation of the two revenue lines. Blended, analytical query load carries roughly $40-50K per million queries, and the consumption model means revenue rises directly with usage, which is why the pricing model and the architecture are the same design. The margin lever and the customer-cost trap are identical: auto-suspend and right-sizing - the platform profits on compute credits, and the single biggest customer overspend is warehouses left running idle, which is pure margin for the vendor and pure waste for the buyer.' },
  'Nvidia (GPU Cloud Scheduler)': { revPerM: 0, model: 'GPU-hours sold; utilization IS the margin', basis: 'A GPU cloud sells accelerator time, so per-request revenue is the wrong lens - the unit is the GPU-hour, and the entire economics reduce to utilization: the cards are a vast capital expense that earns only while busy, so every idle or fragmented GPU is money burning. The scheduler that keeps the fleet packed with valuable work is not an optimization but the profit engine itself - a few points of utilization across thousands of cards is the difference between a thriving and a losing business. The honest ROI framing is revenue-per-GPU-hour against the amortized cost of the silicon, and the whole system exists to push the first number toward the ceiling the second sets.' },
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
