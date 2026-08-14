// Scaling playbooks, part 2 of 2. See scaling.js for the shape.

export default {

'Rapido': {
  constraint: 'Captain location writes per city, and allocation contention when demand spikes in one cell.',
  ladder: [
    ['10K riders', '~10 rps', 'One service, one database, nearest-captain by distance. Fine for a single city pilot.'],
    ['1M riders', '~1K rps', 'Live location out of the database into an H3 index in Redis. Allocation claims a captain atomically before offering.'],
    ['10M riders', '~12K rps', 'Kafka between location ingest and the index. Per-city sharding so Bengaluru and Delhi are independent systems.'],
    ['100M riders', '~100K rps', 'Regional cells with their own geo index, allocation and trip store. Surge as demand management per cell, not globally.'],
  ],
  levers: [
    { t: 'City is the shard key', d: 'Two-wheeler rides never cross cities, so nothing needs a global view. Per-city cells bound every failure and keep every query local.', n: ['geo', 'match', 'trip'] },
    { t: 'Location is soft state', d: 'A captain\'s position is worthless in ten seconds. Keep it in memory with a TTL; a captain who stops pinging simply drops out of the available set.', n: ['loc', 'geo'] },
    { t: 'Claim before offering', d: 'Two allocators finding the same captain is the defining race here. An atomic claim with a short TTL is cheap and prevents a whole class of double-assignment bugs.', n: ['match'] },
    { t: 'OTP verification off the hot path', d: 'Ride-start verification is a low-volume write. Keep it out of the allocation loop so it never adds latency to matching.', n: ['otp'] },
    { t: 'UPI is someone else\'s throughput', d: 'Payment settles asynchronously after the ride. Never block trip completion on a payment round trip to an external switch.', n: ['pay', 'upi'] },
  ],
  wall: { t: 'Captain supply', d: 'During monsoon or rush hour there are simply fewer captains than riders in a cell. No architecture fixes that; the system degrades to a queue plus a price signal, and honest ETAs matter more than throughput.' },
},

'Ola': {
  constraint: 'Category-filtered allocation across a mixed fleet, plus an EV range check that ordinary matching does not need.',
  ladder: [
    ['10K riders', '~15 rps', 'One allocation service, one geo index, category as a simple filter. Fine for a single city pilot.'],
    ['1M riders', '~1.5K rps', 'EV range service split out so a battery check never slows down a Mini or Auto match. Wallet debit becomes the default payment path.'],
    ['10M riders', '~16K rps', 'Kafka between location ingest and the geo index. Per-city sharding, same as any city-bound ride design.'],
    ['100M riders', '~150K rps', 'Regional cells with their own index, allocation service and wallet ledger shard. Charging-station data becomes its own service as the electric fleet grows.'],
  ],
  levers: [
    { t: 'One geo index, filtered by category', d: 'Mini, Sedan, Auto and electric riders all search the same city cell, so a shared index beats several smaller ones — filter by category before ranking rather than partitioning the index itself.', n: ['geo', 'match'] },
    { t: 'EV range is a pre-filter, not a retry', d: 'Checking battery level and charging-station proximity before an offer goes out is cheap. Discovering the range problem after acceptance costs a cancelled ride and a stranded rider.', n: ['ev', 'match'] },
    { t: 'Wallet debit is the hot path', d: 'A local ledger write is fast and fully within your control. Route every ride through it first and treat the UPI call as a background top-up, never a blocking one.', n: ['wallet', 'ledger'] },
    { t: 'City is still the shard key', d: 'Nothing about multiple categories or electric vehicles changes the fact that rides do not cross cities — the same per-city partition that works for a single-category design works here too.', n: ['geo', 'match', 'trip'] },
  ],
  wall: { t: 'Charging infrastructure', d: 'No amount of software makes a battery last longer or a charging station appear where none exists. At high electric-fleet share, the binding constraint stops being allocation logic and becomes physical charging capacity in the city.' },
},

'Zomato': {
  constraint: 'Discovery reads at lunch and dinner peaks — a spiky, heavily cacheable read workload sitting next to a small, contended order path.',
  ladder: [
    ['10K users', '~20 rps', 'One service serving both browse and order. Adequate and simple.'],
    ['1M users', '~2K rps', 'Split discovery from ordering. Menus are cached hard — they change daily, not per request.'],
    ['10M users', '~20K rps', 'CDN for images and menu payloads. Rider assignment behind a queue. Search moves to a geo index.'],
    ['100M users', '~200K rps at peak', 'City-level sharding, regional caches, predictive pre-scaling for the 12:00 and 20:00 spikes because they are entirely predictable.'],
  ],
  levers: [
    { t: 'Discovery and ordering are different systems', d: 'Browsing is read-heavy, cacheable and tolerant of staleness. Ordering is transactional and must not be. Splitting them lets each scale on its own terms.', n: ['disc', 'ord'] },
    { t: 'Cache menus aggressively', d: 'A menu changes daily but is fetched millions of times. It is the single most cacheable object in the system and should almost never reach the database.', n: ['menu', 'cat'] },
    { t: 'Pre-scale for meal times', d: 'The peaks are at fixed hours every day. Provisioning ahead of them is far cheaper and more reliable than reactive autoscaling that lags the spike.', n: ['gw', 'disc'] },
    { t: 'Assignment behind a queue', d: 'Rider allocation is CPU-heavy and bursty. Queueing it decouples order acceptance from assignment latency.', n: ['assign', 'k'] },
    { t: 'ETA is a prediction, not a query', d: 'Precompute travel-time estimates per area and serve them from cache. Calling a routing API per request is both slow and expensive.', n: ['eta', 'track'] },
  ],
  wall: { t: 'Restaurant and rider capacity', d: 'A kitchen produces a fixed number of meals an hour and a city has a fixed number of riders. Past a point the platform is allocating scarce physical capacity, and the right lever is demand shaping — surge fees, longer promised ETAs — not more servers.' },
},

'Swiggy + Instamart': {
  constraint: 'Per-dark-store inventory. It is a small, strongly-consistent, heavily-contended dataset with a ten-minute delivery promise on top.',
  ladder: [
    ['10K users', '~20 rps', 'One inventory table, one order service. Transactional decrements.'],
    ['1M users', '~3K rps', 'Availability reads cached per store. Orders still hit the inventory database transactionally — that part does not get to be eventually consistent.'],
    ['10M users', '~25K rps', 'Shard inventory by store. Dispatch and batching behind a queue. Search filtered by serviceable stores only.'],
    ['100M users', '~250K rps', 'Regional cells; each store is an independent inventory partition. Availability projected into a fast read store per geo cell.'],
  ],
  levers: [
    { t: 'Store id is the natural shard', d: 'Inventory is per dark store and never crosses stores, so sharding by store gives perfect isolation with no distributed transactions.', n: ['inv', 'invdb'] },
    { t: 'Availability is a hint; checkout is truth', d: 'Browse from a short-TTL cache and accept mild staleness. Re-validate with a conditional decrement inside one transaction at checkout — that is where overselling is actually prevented.', n: ['srch', 'inv'] },
    { t: 'Precompute serviceable areas', d: 'Which stores can reach an address in ten minutes changes slowly. Precompute cell-to-store mappings so a lookup is a hash, not a routing call.', n: ['geo', 'disp'] },
    { t: 'Sort rows to avoid deadlocks', d: 'Multi-item carts decrementing in different orders deadlock under load. Ordering line items by id is a one-line fix that matters enormously at peak.', n: ['invdb'] },
    { t: 'Batch dispatch', d: 'Combining nearby orders onto one rider is the main lever on delivery cost and on effective rider capacity.', n: ['disp', 'k'] },
  ],
  wall: { t: 'Physical stock', d: 'A dark store holds a finite number of units. Ten-minute delivery means you cannot restock reactively, so the binding constraint is demand forecasting and replenishment — an operations problem the architecture can only expose, not solve.' },
},

'Razorpay': {
  constraint: 'Correctness under retry, and the throughput your acquiring banks will accept.',
  ladder: [
    ['10K txn/day', '~1 rps', 'One service, one ACID ledger, one acquirer, synchronous calls.'],
    ['1M txn/day', '~50 rps', 'Idempotency keys throughout. Outbox pattern so ledger write and downstream publish are atomic. Webhooks with retries.'],
    ['10M txn/day', '~500 rps', 'Shard the ledger by merchant. Smart routing across multiple acquirers based on live success rates. Settlement becomes a batch pipeline.'],
    ['100M txn/day', '~4K rps', 'Regional processing, per-merchant capacity isolation, and reconciliation as a continuously-running system rather than a nightly job.'],
  ],
  levers: [
    { t: 'Idempotency at the edge', d: 'A merchant retrying a timed-out request must not create a second payment. The key is generated before the first attempt and checked at the gateway — the property everything else depends on.', n: ['idem', 'gw'] },
    { t: 'Route across acquirers', d: 'Your throughput ceiling is the sum of what your banks accept, and their success rates vary by hour and instrument. Routing on live health is both a scaling and a conversion lever.', n: ['rout', 'acq'] },
    { t: 'Outbox for webhooks', d: 'Merchants depend on webhooks being reliable. Writing them in the same transaction as the ledger entry, then publishing from the outbox, is what makes "we always notify" true.', n: ['out', 'hook'] },
    { t: 'Shard by merchant', d: 'Merchants are independent, so this partitions cleanly and lets you give a large merchant dedicated capacity during their sale.', n: ['led'] },
    { t: 'Continuous reconciliation', d: 'Compare against acquirer reports constantly, not nightly. At this volume a daily job finds problems too late to act on.', n: ['sett', 'aud'] },
  ],
  wall: { t: 'Bank capacity and downtime', d: 'Indian acquiring banks have real throughput limits and scheduled maintenance windows. You scale by adding acquirers and routing around failures — which multiplies your reconciliation surface. The constraint is external and permanent.' },
},

'BHIM (UPI)': {
  constraint: 'The NPCI switch and the issuing banks. Your own capacity is almost never the limit.',
  ladder: [
    ['10K users', '~5 rps', 'One service, HSM for PIN operations, direct calls to the switch.'],
    ['1M users', '~200 rps', 'VPA directory cached. RRN-based idempotency so a retry never double-debits. Async status polling for pending transactions.'],
    ['10M users', '~2K rps', 'Connection pooling to the switch. Circuit breakers per bank so one slow bank does not consume all your threads.'],
    ['100M users', '~20K rps', 'Queue-based smoothing towards the switch, per-bank concurrency budgets, and a reconciliation pipeline that assumes ambiguity is normal.'],
  ],
  levers: [
    { t: 'RRN as the idempotency key', d: 'The retrieval reference number is the transaction identity across every party. Every retry, status check and reconciliation keys off it — without that discipline you cannot tell a retry from a second payment.', n: ['upi', 'led'] },
    { t: 'Circuit-break per bank', d: 'One slow issuer will otherwise consume your entire thread pool and take down payments to healthy banks. Per-bank isolation is the highest-value resilience move here.', n: ['bank', 'npci'] },
    { t: 'HSM is a fixed resource', d: 'Hardware security modules have finite operations per second and cannot autoscale. Pool connections, batch where the protocol allows, and size them as a hard capacity constraint.', n: ['hsm'] },
    { t: 'Cache the VPA directory', d: 'Address resolution happens on every payment and changes rarely. Caching it removes a switch round trip from the hot path.', n: ['vpa'] },
    { t: 'Ambiguity is the normal case', d: 'Timeouts where you do not know the outcome are routine. A deterministic status-check and reconciliation flow matters more than raw throughput.', n: ['led', 'aud'] },
  ],
  wall: { t: 'NPCI throughput', d: 'You are one participant on a shared national switch with its own limits and its own outages. Scaling past your allocated TPS is a regulatory and commercial conversation, not an engineering one.' },
},

'Google Pay (UPI, India)': {
  constraint: 'Same external switch ceiling as any UPI app, plus fraud scoring that must run inline without adding latency.',
  ladder: [
    ['1M users', '~200 rps', 'Single PSP bank, synchronous fraud checks, direct switch integration.'],
    ['10M users', '~3K rps', 'Multiple PSP banks with routing on live health. Fraud scoring moves to a low-latency model served from a feature cache.'],
    ['100M users', '~30K rps', 'Tokenization for stored instruments. Rewards and offers moved entirely off the payment path.'],
    ['500M users', '~150K rps peak', 'Regional cells, per-PSP concurrency budgets, and predictive scaling for festival peaks which are entirely foreseeable.'],
  ],
  levers: [
    { t: 'Route across PSP banks', d: 'Being multi-PSP is the only real capacity lever available, since each sponsor bank has its own TPS allocation and its own downtime.', n: ['psp', 'npci'] },
    { t: 'Fraud inline but bounded', d: 'Scoring must complete within a few milliseconds against precomputed features. If the model is slow, fail open to a rules-based check rather than delaying the payment.', n: ['fraud'] },
    { t: 'Rewards off the payment path', d: 'Cashback and offers are asynchronous consumers of a completed-payment event. They must never be able to fail or slow a transaction.', n: ['rew', 'k'] },
    { t: 'Tokenize stored instruments', d: 'Keeping card and account data in a vault shrinks your compliance surface and lets the transaction path handle tokens, which are cheap to replicate.', n: ['tok'] },
    { t: 'Pre-scale for festivals', d: 'Diwali and sale events are known months ahead. Reactive autoscaling always lags a step change in traffic of this shape.', n: ['gslb', 'gw'] },
  ],
  wall: { t: 'Shared national infrastructure', d: 'When NPCI or a major bank degrades, every UPI app degrades together. The engineering response is graceful degradation and honest status messaging, because there is no capacity you can add to route around it.' },
},


'Continuous Testing Platform': {
  constraint: 'Test execution capacity and flakiness — both grow superlinearly with the size of the codebase.',
  ladder: [
    ['10 devs', 'a few builds/hr', 'One CI runner executing the full suite. Perfectly fine.'],
    ['100 devs', '~50 builds/hr', 'Parallel test shards. Ephemeral environments per PR. Service virtualization so tests do not hit real partner APIs.'],
    ['1000 devs', '~500 builds/hr', 'Test impact analysis — run only what the diff can affect. Managed test data. Quality gates that can actually fail a build.'],
    ['5000 devs', 'continuous', 'Distributed grid for UI tests, aggressive result caching, and flaky-test quarantine as an automated process.'],
  ],
  levers: [
    { t: 'Run only affected tests', d: 'A full suite on every commit stops being viable somewhere around a thousand engineers. Dependency-graph-based selection typically cuts execution by most of its volume with negligible risk.', n: ['ci', 'unit'] },
    { t: 'Virtualize partner APIs', d: 'Real third-party calls in tests are slow, rate-limited and flaky. Virtualization makes the suite deterministic and removes an external capacity limit.', n: ['mock'] },
    { t: 'Ephemeral environments', d: 'Shared staging is a queue and a source of interference. Per-PR environments parallelise cleanly and remove the contention.', n: ['env', 'sut'] },
    { t: 'Quarantine flaky tests automatically', d: 'Flakiness compounds: at a thousand tests with 0.1% flake each, most runs fail for no reason. Detect and quarantine automatically or the suite loses all credibility.', n: ['ops', 'mon'] },
    { t: 'Cache aggressively', d: 'Unchanged modules do not need rebuilding or retesting. Content-addressed build and test caching is often the single largest speedup available.', n: ['ci'] },
  ],
  wall: { t: 'Feedback latency', d: 'Beyond about ten minutes developers context-switch and the pipeline stops shaping behaviour. That budget is fixed by human attention, so past a point you must run less rather than run faster.' },
},

'Booking.com': {
  constraint: 'A 1000:1 search-to-book ratio against supplier availability you do not own.',
  ladder: [
    ['10K users', '~50 rps', 'Query suppliers live on every search. Slow but correct.'],
    ['1M users', '~5K rps', 'Cache availability and rates with short TTLs. Live supplier calls only at booking time.'],
    ['10M users', '~40K rps', 'Search served entirely from your own index. Ranking on a candidate set. Booking is a saga across supplier and payment.'],
    ['100M users', '~400K rps', 'Regional search clusters, per-supplier circuit breakers, and predictive cache warming for popular destinations and dates.'],
  ],
  levers: [
    { t: 'Never call suppliers on search', d: 'At a thousand searches per booking, live supplier calls are both impossibly slow and a good way to get your integration throttled. Cache availability and accept staleness.', n: ['rate', 'sup'] },
    { t: 'Price change at booking is a product decision', d: 'Cached rates will sometimes be wrong. Handling that gracefully at checkout — showing the new price and asking — is cheaper and more honest than trying to keep the cache perfect.', n: ['book', 'inv'] },
    { t: 'Rank a candidate set', d: 'Generate a few hundred properties cheaply, then apply expensive personalised ranking to those only.', n: ['rank', 'srch'] },
    { t: 'Circuit-break per supplier', d: 'Thousands of supplier integrations means several are always degraded. Per-supplier breakers and hard timeouts stop one bad integration consuming your search latency budget.', n: ['sup'] },
    { t: 'Book as a saga', d: 'Supplier confirmation and payment are separate systems that can each fail. Explicit compensation is required; there is no distributed transaction available.', n: ['book', 'pay', 'k'] },
  ],
  wall: { t: 'Supplier truth', d: 'You do not own the inventory. Overselling is ultimately the supplier\'s state diverging from your cache, and no amount of scaling fixes that — only shorter TTLs on hot inventory and a good compensation path.' },
},

'Goibibo': {
  constraint: 'GDS fan-out. Flight search means calling several slow external systems and waiting for the slowest.',
  ladder: [
    ['10K users', '~20 rps', 'Call the GDS per search. Multi-second latency, and you will be rate-limited quickly.'],
    ['1M users', '~2K rps', 'Short-TTL fare cache. Hard timeouts on GDS calls — return partial results rather than nothing.'],
    ['10M users', '~15K rps', 'Popular routes pre-fetched on a schedule. Search served from cache with live confirmation only at booking.'],
    ['100M users', '~150K rps', 'Regional caches, per-supplier concurrency budgets, and predictive warming for holiday booking windows.'],
  ],
  levers: [
    { t: 'Hard timeouts with partial results', d: 'One slow GDS must not hold the whole search. Return what you have at the deadline; a fast partial result beats a complete slow one every time.', n: ['gds', 'fs'] },
    { t: 'Short-TTL fare cache', d: 'Fares change but not every second. Even sixty seconds of caching removes most of your supplier call volume on popular routes.', n: ['fare'] },
    { t: 'Pre-fetch popular routes', d: 'A small number of city pairs are most of the traffic. Warming those on a schedule turns the common case into a cache hit.', n: ['fare', 'k'] },
    { t: 'Price change at booking', d: 'Cached fares go stale by design. Confirm live at booking and handle the change explicitly in the UI rather than pretending it will not happen.', n: ['book', 'pnr'] },
    { t: 'Wallet as a separate ledger', d: 'Split tender across wallet and card is a distributed transaction. Keep the wallet ledger append-only and idempotent so partial failures are recoverable.', n: ['wal', 'pay'] },
  ],
  wall: { t: 'GDS rate limits and latency', d: 'Amadeus and Sabre have contractual call limits and multi-second response times. Your search latency floor is set by systems you neither own nor can scale — which is why the entire design is a caching strategy.' },
},

'IndiGo (goindigo.in)': {
  constraint: 'The passenger service system. It is a mainframe-class dependency with fixed capacity and it owns the truth.',
  ladder: [
    ['100K pax', '~50 rps', 'Website calls the PSS directly for availability and booking.'],
    ['1M pax', '~800 rps', 'Availability and fares cached. Enterprise MQ in front of the PSS so bursts queue rather than fail.'],
    ['10M pax', '~8K rps', 'Seat maps cached with short TTLs. Check-in windows create predictable herds — pre-scale for them.'],
    ['50M pax', '~50K rps at sale', 'CDN and WAF absorbing bot traffic, read models fully decoupled from the PSS, and sale events as planned capacity exercises.'],
  ],
  levers: [
    { t: 'MQ in front of the PSS', d: 'The core cannot be scaled out and cannot be allowed to fall over. A queue converts a flash sale into a backlog you drain at the PSS\'s own pace.', n: ['mq', 'pss'] },
    { t: 'Cache availability, confirm on book', d: 'Browsing tolerates staleness; booking does not. This split keeps almost all read traffic away from the core.', n: ['avail', 'fare'] },
    { t: 'Bots are a real fraction of traffic', d: 'Fare-scraping aggregators can exceed human traffic. A WAF with bot management is capacity work, not just security work.', n: ['waf'] },
    { t: 'Pre-scale for check-in windows', d: 'T-48h check-in opening creates a predictable thundering herd on a known schedule. Provision ahead of it.', n: ['ci', 'gw'] },
    { t: 'Ancillaries are separate', d: 'Seat selection, meals and baggage are independent of the booking transaction and can be served from your own stores.', n: ['anc', 'seat'] },
  ],
  wall: { t: 'PSS transaction capacity', d: 'The passenger service system is licensed, fixed-capacity and vendor-operated. Every architectural decision here exists to keep traffic away from it, because you cannot add more of it.' },
},

'Meta (Facebook)': {
  constraint: 'The social graph read volume — orders of magnitude larger than writes, and every feed render fans out across it.',
  ladder: [
    ['1M users', '~1K rps', 'Web tier plus MySQL. A cache in front of the database.'],
    ['100M users', '~50K rps', 'A read-through graph cache becomes the primary datastore from the application\'s point of view. Sharded MySQL underneath.'],
    ['1B users', '~500K rps', 'Regional cache tiers with cross-region invalidation. Feed ranking on precomputed candidates. Photos in a purpose-built blob store.'],
    ['3B users', 'millions rps', 'Points of presence terminating connections close to users, full regional replicas, and cache warming as a first-class system.'],
  ],
  levers: [
    { t: 'The graph cache is the database', d: 'A read-through cache over sharded MySQL serves the overwhelming majority of graph reads. The relational store becomes durability and the cache becomes the serving layer.', n: ['tao', 'mc', 'db'] },
    { t: 'Regional cache tiers', d: 'Local caches per region with an invalidation stream keeps reads local. Cross-region consistency is deliberately eventual because the alternative is unaffordable latency.', n: ['mc', 'pop'] },
    { t: 'Purpose-built photo storage', d: 'General object stores waste metadata operations on billions of small immutable files. A dedicated store with compact indexing is what makes it economical.', n: ['haystack'] },
    { t: 'Rank a candidate set', d: 'Feed generation scores a few hundred candidates, not the corpus. Everything upstream exists to make that candidate set cheap to assemble.', n: ['feed', 'rank'] },
    { t: 'Terminate at the edge', d: 'PoPs handle TLS and connection setup near the user, then use warm long-haul connections to the datacentre — a large latency win independent of backend capacity.', n: ['pop', 'cdn'] },
  ],
  wall: { t: 'Cross-region consistency', d: 'At this size the speed of light means a globally consistent graph is impossible. You accept eventual consistency and design the product around it — occasionally seeing a stale comment count is the price of the architecture.' },
},

'Netflix': {
  constraint: 'Egress. Video bytes dwarf everything else, and at peak Netflix is a meaningful fraction of internet traffic.',
  ladder: [
    ['1M users', '~1K rps', 'Encode on upload, serve from a commercial CDN, one API tier.'],
    ['10M users', '~10K rps', 'Microservices behind a gateway with discovery. Caching tier for personalisation data.'],
    ['100M users', '~40K rps', 'Own CDN appliances placed inside ISP networks. Encoding pipeline runs per title across many renditions.'],
    ['300M users', '>95% from ISP caches', 'Predictive fill of edge appliances ahead of releases, regional failover, and degrade-don\'t-fail as an explicit design rule.'],
  ],
  levers: [
    { t: 'Put the CDN inside the ISP', d: 'Appliances in ISP datacentres mean video never crosses the public internet backbone. This is the whole scaling strategy — and it is a partnership programme as much as an engineering one.', n: ['oc'] },
    { t: 'Predictive fill', d: 'Push a new season to edge appliances overnight before launch. Cache misses at release are what you are engineering away.', n: ['oc', 'ing'] },
    { t: 'Degrade, never fail', d: 'If personalisation is down, serve a generic row. If the API tier struggles, shed non-essential calls. Playback must survive everything else being broken.', n: ['zuul', 'api', 'rec'] },
    { t: 'Cache tier for personalisation', d: 'An in-memory tier in front of the wide-column store absorbs the read volume of viewing history and profile data.', n: ['evc', 'cass'] },
    { t: 'Encode once, serve forever', d: 'Encoding is expensive but happens once per title. Amortised over hundreds of millions of streams it is negligible — the opposite of the cost profile of live traffic.', n: ['ing', 's3'] },
  ],
  wall: { t: 'Peering and physics', d: 'Beyond a certain share of a country\'s traffic you are limited by interconnect capacity and by how many appliances ISPs will host. Scaling becomes commercial negotiation and hardware logistics rather than software.' },
},

'Yahoo': {
  constraint: 'Serving several very different products behind one front door, each with its own scaling shape.',
  ladder: [
    ['1M users', '~1K rps', 'One portal, one mail backend, shared infrastructure.'],
    ['10M users', '~5K rps', 'Split the products. Mail gets its own storage tier; portal content gets a CDN.'],
    ['100M users', '~30K rps', 'Ad serving becomes latency-critical and gets isolated. Budget pacing prevents overspend on hot inventory.'],
    ['500M users', '~200K rps', 'Regional cells per product, independent scaling, and a shared identity layer that must be faster than everything it fronts.'],
  ],
  levers: [
    { t: 'Products scale independently', d: 'Mail is storage-bound, the portal is read-bound, ads are latency-bound. Sharing infrastructure across them means every product gets the worst of all three.', n: ['portal', 'mail', 'ads'] },
    { t: 'CDN the portal', d: 'Editorial content is the same for everyone in a region and changes on a schedule. It should almost never reach an origin server.', n: ['cdn', 'cms'] },
    { t: 'Budget pacing on hot inventory', d: 'A popular slot can exhaust an advertiser\'s daily budget in seconds. Distributed pacing with local budgets is the same pattern as a rate limiter.', n: ['budget', 'ads'] },
    { t: 'Mailboxes shard by user', d: 'No cross-user queries, so user id partitions cleanly and mailbox storage grows linearly with users rather than superlinearly.', n: ['mbox', 'idx'] },
    { t: 'Analytics off the serving path', d: 'Event streams feed the warehouse asynchronously. Nothing in the ad or portal path waits on analytics.', n: ['k', 'an', 'wh'] },
  ],
  wall: { t: 'Ad auction latency', d: 'The auction has roughly 100ms end to end including external bidders. That budget is fixed by the exchange protocol, so past a point you cut features from the auction rather than making it faster.' },
},

'Disney+ Hotstar': {
  constraint: 'Concurrency step changes. A cricket final can add tens of millions of viewers in minutes.',
  ladder: [
    ['1M users', '~5K rps', 'Single CDN, standard autoscaling. Adequate for on-demand content.'],
    ['10M users', '~50K rps', 'Multi-CDN with steering. Aggressive caching of playback manifests.'],
    ['25M concurrent', '~200K rps', 'Predictive autoscaling driven by the match schedule, not by observed load. A graceful-degradation ladder defined in advance.'],
    ['60M concurrent', 'record scale', 'Panic mode: shed everything non-essential — recommendations, personalised rails, chat — to protect playback.'],
  ],
  levers: [
    { t: 'Scale ahead of the event, not with it', d: 'Reactive autoscaling cannot follow a step change of ten million users in five minutes. Provisioning is driven by the fixture list — the traffic is scheduled, so the capacity should be too.', n: ['auto', 'gw'] },
    { t: 'A degradation ladder', d: 'Decide in advance what gets switched off and in what order. Rehearsed degradation is what turns a potential outage into slightly reduced functionality.', n: ['pers', 'chat'] },
    { t: 'Multi-CDN steering', d: 'No single CDN absorbs this. Real-time steering on measured performance across providers, with the ability to shift traffic mid-event.', n: ['cdn1', 'cdn2'] },
    { t: 'Panic mode is a real feature', d: 'A pre-built switch that serves a stripped-down experience to everyone. Building it during the incident is not an option.', n: ['play', 'cache'] },
    { t: 'Everyone watches the same thing', d: 'Unlike on-demand, live means one stream for tens of millions — cache hit rates approach 100%. That is the property that makes this possible at all.', n: ['cdn1', 'play'] },
  ],
  wall: { t: 'Simultaneity', d: 'Everyone reacts to the same wicket at the same instant. Load is perfectly correlated, so statistical smoothing does not help you — you must provision for the peak of the peak or degrade deliberately.' },
},

'News Feed (Instagram)': {
  constraint: 'Media egress plus feed fan-out — two hard problems in one product.',
  ladder: [
    ['1M users', '~1K rps', 'Upload through the app, serve images from storage, query feeds at read time.'],
    ['10M users', '~10K rps', 'Pre-signed uploads and a CDN for media. Precomputed timelines for the feed.'],
    ['100M users', '~50K rps', 'Hybrid fan-out for large accounts. Async transcode into multiple renditions. Stories with a TTL rather than a cleanup job.'],
    ['1B users', '~500K rps', 'Regional media caches, active-user-only fan-out, and ranking on precomputed candidates.'],
  ],
  levers: [
    { t: 'Media never touches app servers', d: 'Pre-signed upload and CDN delivery. Content-addressed images cache forever with no invalidation problem.', n: ['blob', 'cdn'] },
    { t: 'Hybrid fan-out', d: 'Push to followers for ordinary accounts, query live for the handful of huge accounts each user follows. Merge at read time.', n: ['fan', 'tl', 'tw'] },
    { t: 'Stories expire themselves', d: 'A 24-hour TTL in an in-memory store means no cleanup job, no tombstones, and a naturally bounded dataset.', n: ['q', 'meta'] },
    { t: 'Renditions per device', d: 'Generating several sizes on upload and letting clients choose saves far more bandwidth than any compression tuning.', n: ['blob', 'cdn'] },
    { t: 'Like counts are approximate', d: 'Buffer in memory and flush aggregated deltas. Keep the per-user like record durable so the UI stays correct for the individual.', n: ['post', 'k'] },
  ],
  wall: { t: 'Cold-start media latency', d: 'The first viewer in each region pays an origin fetch on a brand-new post — exactly when a viral post is spreading fastest. Pre-warming for large accounts helps; eliminating it entirely does not scale.' },
},

'Music Streaming (Spotify)': {
  constraint: 'Per-market licensing checks on every play, sitting in front of otherwise trivially cacheable immutable audio.',
  ladder: [
    ['1M users', '~1K rps', 'Serve audio from storage, check rights per play against the catalogue database.'],
    ['10M users', '~10K rps', 'Audio to CDN — it is immutable and perfectly cacheable. Rights cached per market with short TTLs.'],
    ['100M users', '~40K rps', 'Playlists and library sharded by user. Royalty events to a durable log that must never lose a message.'],
    ['500M users', '~300K rps', 'Regional catalogues reflecting local licensing, predictive caching of new releases, and offline sync as a first-class path.'],
  ],
  levers: [
    { t: 'Audio is immutable', d: 'A track file never changes, so it caches forever at the edge. Nearly all bytes should be served without touching your infrastructure.', n: ['audio', 'cdn'] },
    { t: 'Rights cached per market', d: 'A licensing check per play would make the catalogue database your bottleneck. Cache the per-market availability matrix and refresh it on a schedule.', n: ['cat', 'catdb'] },
    { t: 'Royalty events cannot be lost', d: 'Plays are money owed to rights holders. They go to a durable log with at-least-once delivery and idempotent aggregation — the one place in this system where you cannot be casual.', n: ['roy', 'k'] },
    { t: 'Library shards by user', d: 'Playlists and saved tracks have no cross-user queries, so user id is a clean partition.', n: ['lib'] },
    { t: 'Pre-position new releases', d: 'Friday releases have entirely predictable demand. Push them to edge caches before the demand arrives.', n: ['cdn', 'audio'] },
  ],
  wall: { t: 'Licensing geography', d: 'What is playable differs by market and changes by contract, so you cannot have one global catalogue. That fragmentation is a legal constraint the architecture must express, not one it can optimise away.' },
},

'Distributed File Storage (Drive)': {
  constraint: 'Permission evaluation on every access, over a hierarchy that inherits.',
  ladder: [
    ['100K users', '~100 rps', 'Metadata in one database, blobs in object storage, ACLs evaluated per request.'],
    ['1M users', '~1K rps', 'Chunk and dedupe blobs. Cache resolved permissions — walking an inheritance chain per request is expensive.'],
    ['10M users', '~15K rps', 'Shard metadata by owner. Change-log based sync. Search index respecting per-user visibility.'],
    ['1B users', 'exabytes', 'Regional metadata with global blob replication, and permission caches with careful invalidation on the sharing path.'],
  ],
  levers: [
    { t: 'Cache resolved ACLs', d: 'Inherited permissions mean walking up a folder tree on every access. Caching the resolved answer is essential — and invalidating it correctly when a parent folder is reshared is the hard part.', n: ['acl', 'aclc'] },
    { t: 'Content-addressed dedupe', d: 'The same attachment exists in thousands of accounts. Hashing chunks stores it once, which is a large fraction of your storage bill.', n: ['dedup', 'blk'] },
    { t: 'Shard metadata by owner', d: 'Most operations are within one user\'s or one organisation\'s tree, so owner is a natural partition with few cross-shard queries.', n: ['meta', 'mdb'] },
    { t: 'Change log for sync', d: 'A monotonic cursor per user makes reconnect a range read rather than a tree diff.', n: ['ws', 'k'] },
    { t: 'Search must respect visibility', d: 'Indexing everything and filtering after retrieval leaks existence and does not scale. Permissions belong in the index query itself.', n: ['srch'] },
  ],
  wall: { t: 'Sharing graph complexity', d: 'A file shared with a group inside an organisation with inherited folder permissions and link sharing produces an access check that is genuinely expensive. Correctness here bounds how aggressively you can cache, and getting it wrong leaks data.' },
},

'Slack': {
  constraint: 'Persistent connections multiplied by workspace count, with per-workspace tenancy isolation on top.',
  ladder: [
    ['10K users', '~50 rps', 'One WebSocket tier, one message store, channel fan-out in process.'],
    ['1M users', '~5K rps', 'Shard by workspace. Presence in a fast in-memory store. Message history paginated from a partitioned store.'],
    ['10M users', '~30K rps', 'Channel fan-out through pub/sub between connection servers. Search indexed per workspace with permission filtering.'],
    ['100M users', 'millions of sockets', 'Regional connection tiers, workspace-affinity routing, and large-workspace sharding within a tenant.'],
  ],
  levers: [
    { t: 'Workspace is the shard key', d: 'Nothing crosses workspaces, which makes this the cleanest multi-tenant partition in any of these designs. Large customers can get dedicated capacity.', n: ['ten', 'store'] },
    { t: 'Pub/sub per channel', d: 'A busy channel with thousands of members is a fan-out problem. Per-channel channels mean each connection server subscribes once regardless of how many local members it serves.', n: ['ws', 'msg', 'k'] },
    { t: 'Presence is ephemeral and huge', d: 'Typing indicators and online status are high-volume and worthless after a second. In-memory with TTL, never persisted, safe to drop under load.', n: ['pres'] },
    { t: 'Search per workspace', d: 'Indexes partitioned by workspace stay small, fast, and inherently isolated — and permission filtering happens within one tenant\'s index.', n: ['srch'] },
    { t: 'Files out of band', d: 'Uploads and downloads go direct to object storage. A connection server holding a million sockets must not proxy files.', n: ['files'] },
  ],
  wall: { t: 'The giant workspace', d: 'A single customer with 500,000 people in one channel breaks the per-workspace shard model. That case needs its own sharding within the tenant, and it is why enterprise Slack deployments look different from the default architecture.' },
},

'Microsoft 365': {
  constraint: 'Tenant isolation at enterprise scale, with compliance features that must run on every operation.',
  ladder: [
    ['1K tenants', '~100 rps', 'Shared services, tenant id on every row, one identity provider.'],
    ['100K tenants', '~2K rps', 'Per-tenant throttling so one customer cannot exhaust shared capacity. Sharded mailbox and file stores.'],
    ['1M tenants', '~25K rps', 'Regional data residency. DLP and eDiscovery scanning asynchronously off the write path.'],
    ['enterprise scale', '~200K rps', 'Tenant-affinity routing to regional cells, dedicated capacity for the largest customers.'],
  ],
  levers: [
    { t: 'Throttle per tenant', d: 'Without it, one customer\'s runaway integration degrades everyone. Per-tenant quotas are a multi-tenancy requirement, not a nice-to-have.', n: ['ten', 'graph'] },
    { t: 'Identity is the hottest path', d: 'Every request authenticates and authorises. Token validation must be local with cached signing keys, never a round trip to the identity provider.', n: ['entra'] },
    { t: 'Compliance scanning asynchronously', d: 'DLP and eDiscovery indexing consume an event stream. Putting them in the write path would double every operation\'s latency.', n: ['dlp', 'aud', 'k'] },
    { t: 'Data residency by region', d: 'Regulation forces tenant data to specific geographies. That is a hard routing constraint that shapes the whole topology.', n: ['gslb', 'ten'] },
    { t: 'Workload-specific stores', d: 'Mail, files and chat have genuinely different access patterns. One unified store would serve all three badly.', n: ['mbox', 'files', 'teams'] },
  ],
  wall: { t: 'Regulatory geography', d: 'Sovereignty rules mean you run separate regional stacks, sometimes operated by separate entities. Some optimisations available to a global service are simply not legal, and that caps how much you can consolidate.' },
},

'Outlook': {
  constraint: 'Untrusted inbound SMTP — an adversarial, unbounded write path you cannot rate-limit at the source.',
  ladder: [
    ['100K users', '~50 rps', 'MX receives, filters synchronously, writes to the mailbox store.'],
    ['1M users', '~2K rps', 'Filtering moves behind a queue. Mailbox store shards by user. Attachments to object storage.'],
    ['10M users', '~20K rps', 'Multi-stage filtering — cheap reputation checks before expensive content analysis. Per-user search indexes.'],
    ['100M users', '~200K rps', 'Regional MX with local filtering, tiered retention, and reputation systems as a shared platform.'],
  ],
  levers: [
    { t: 'Reject early and cheaply', d: 'IP reputation and rate limiting at connection time discard most spam before you parse a single message. The cheapest check must run first — this is the whole economics of mail.', n: ['smtp', 'mx', 'filter'] },
    { t: 'Shard mailboxes by user', d: 'No cross-user queries on the hot path, so this partitions perfectly and grows linearly.', n: ['mbox', 'mail'] },
    { t: 'Attachments out of the mail store', d: 'Large binaries in the mailbox store destroy its access patterns. Store them separately and keep references.', n: ['att'] },
    { t: 'Index per user, incrementally', d: 'Search is per mailbox, so indexes stay small and update on delivery rather than in bulk.', n: ['idx'] },
    { t: 'Retention as tiered storage', d: 'Mail is kept for years but read within days. Age it into cheaper tiers automatically.', n: ['ret'] },
  ],
  wall: { t: 'Adversarial load', d: 'Spammers adapt to whatever you deploy, so filtering cost rises over time regardless of user growth. You are scaling against an opponent, which is unlike every other system here.' },
},

'Gmail': {
  constraint: 'Search as the primary navigation, over a per-user corpus that only ever grows.',
  ladder: [
    ['1M users', '~1K rps', 'Mailbox store plus a per-user index. Spam filtering on the delivery path.'],
    ['10M users', '~10K rps', 'Threading and labels rather than folders — a message belongs to many labels, so model it as a graph not a tree.'],
    ['100M users', '~60K rps', 'Continuous spam model retraining. Index updates incremental on delivery.'],
    ['1B users', '~500K rps', 'Regional mailbox placement, tiered storage by age, and search served entirely from per-user indexes.'],
  ],
  levers: [
    { t: 'Labels, not folders', d: 'A message with many labels stored once with a label set is far cheaper than duplication, and it is what makes threading and search-first navigation work.', n: ['lbl', 'mbox'] },
    { t: 'Index on delivery', d: 'Incremental indexing at write time means search is always current and you never run a bulk reindex over a billion mailboxes.', n: ['idx', 'mail'] },
    { t: 'Spam filtering is a hot path', d: 'It runs on every inbound message and must be fast. Cheap signals first, expensive model only on the ambiguous remainder.', n: ['spam', 'abuse'] },
    { t: 'Threads are the unit', d: 'Users read conversations, not messages. Storing and fetching by thread matches the access pattern and cuts read amplification.', n: ['mbox'] },
    { t: 'Tier by age', d: 'Mail from five years ago is read almost never but must remain searchable. Cold storage with a warm index is the right split.', n: ['att', 'mbox'] },
  ],
  wall: { t: 'Storage grows monotonically', d: 'Nobody deletes email. Per-user storage only increases, so your fleet grows even with flat user numbers. The only real levers are deduplication of attachments and cheaper cold tiers.' },
},

'Anthropic Claude': {
  constraint: 'GPU capacity. Everything else in the diagram is a rounding error next to inference.',
  ladder: [
    ['1K developers', '~10 rps', 'API keys, rate limits, a single inference pool. Latency is seconds by nature.'],
    ['100K developers', '~300 rps', 'Token-based rate limiting rather than request-based — requests vary enormously in cost. Prompt caching for shared prefixes.'],
    ['1M developers', 'GPU-bound', 'Model routing, continuous batching, and a scheduler that packs the GPU fleet rather than round-robins it.'],
    ['at capacity', 'queue-shaped', 'Admission control by tier. When GPUs are the constraint, fairness and prioritisation matter more than throughput.'],
  ],
  levers: [
    { t: 'Rate limit on tokens, not requests', d: 'One request can be a hundred tokens or a hundred thousand. Request-based limits are meaningless here; tokens are the actual unit of capacity.', n: ['rl', 'keys'] },
    { t: 'Prompt caching', d: 'Long shared system prompts recomputed per request waste an enormous share of the fleet. Caching the KV state for common prefixes is one of the largest available savings.', n: ['cache'] },
    { t: 'Continuous batching', d: 'Naive per-request inference leaves GPUs idle between tokens. Continuous batching packs many sequences into the same forward pass and multiplies effective throughput.', n: ['gpu', 'llm'] },
    { t: 'Route by difficulty', d: 'Sending easy requests to a smaller model is the difference between viable and unaffordable unit economics at scale.', n: ['router'] },
    { t: 'Meter exactly', d: 'Billing is per token, so usage accounting must be exact and durable. This is the one part of the system that cannot be approximate.', n: ['bill', 'k'] },
  ],
  wall: { t: 'GPU supply', d: 'Unlike CPU capacity, accelerators are supply-constrained and have long lead times. You cannot autoscale your way out — which is why admission control, batching and caching matter far more here than in any other design.' },
},

'Simbe Tally (shelf-scanning robots)': {
  constraint: 'The store uplink. Robots generate gigabytes of imagery over a connection shared with the point-of-sale system.',
  ladder: [
    ['10 stores', 'a few robots', 'Upload everything raw, process centrally. Fine at pilot scale.'],
    ['500 stores', '~500 robots', 'On-robot inference so only detections and thumbnails leave the store. This is the change that makes the business viable.'],
    ['5K stores', '~8K rps', 'Scheduled uploads outside trading hours. Store-and-forward when the link is saturated or down.'],
    ['50K stores', 'petabytes/yr', 'Regional ingest, tiered image retention, and ANN product recognition across millions of SKUs served from a vector index.'],
  ],
  levers: [
    { t: 'Infer at the edge', d: 'Running detection on the robot means shipping kilobytes of results instead of gigabytes of raw imagery. Nothing else in this design matters as much.', n: ['edge', 'tally'] },
    { t: 'Respect the store\'s uplink', d: 'You are a guest on a network that runs the tills. Throttle, schedule uploads overnight, and back off aggressively — being a bad neighbour ends the contract.', n: ['up', 'ing'] },
    { t: 'Store and forward', d: 'Retail connectivity is unreliable. Buffer on the robot and replay; a scan delayed is fine, a scan lost is not.', n: ['edge', 'q'] },
    { t: 'ANN over millions of SKUs', d: 'Exact matching against a product catalogue of that size is impractical per detection. An approximate nearest-neighbour index over embeddings makes recognition constant-time.', n: ['vec', 'cat'] },
    { t: 'Images are write-once, read-rarely', d: 'Billions of shelf photos are almost never looked at again. Tier them into cold storage immediately and keep only derived detections hot.', n: ['img', 'det'] },
  ],
  wall: { t: 'Robots are physical', d: 'A store gets scanned as often as a robot can drive the aisles — a few times a day at best. Data freshness is bounded by wheels and battery life, not by anything in this diagram.' },
},

'Tesla Ecosystem': {
  constraint: 'On-vehicle compute and cellular uplink are both fixed and shared across everything the car does — Autopilot inference, telemetry, OTA downloads and remote commands all compete for the same limited pipe.',
  ladder: [
    ['1K vehicles', 'a few hundred rps', 'Upload most telemetry raw, train on whatever arrives. Fine at pilot fleet scale.'],
    ['100K vehicles', '~2K rps', 'On-vehicle shadow-mode inference becomes mandatory so only disagreements and rare scenes leave the car. This is the change that makes the training pipeline viable.'],
    ['1M vehicles', '~10K rps', 'Staged OTA rollouts by cohort and hardware version. Supercharger site service and trip planning split onto their own capacity plan, decoupled from the telemetry pipeline entirely.'],
    ['10M vehicles', '~100K rps', 'Regional ingest for telemetry, a dedicated training cluster (Dojo-style) running continuously on the curated clip archive, and charger-network capacity planning driven by real-time grid load, not just vehicle demand.'],
  ],
  levers: [
    { t: 'Infer on the vehicle first', d: 'Running Autopilot inference on the car and uploading only disagreements turns gigabytes of video per car per day into kilobytes of flagged clips. Nothing else in this design saves as much bandwidth.', n: ['edge', 'veh'] },
    { t: 'Treat training as a batch job, not a service', d: 'The training cluster does not sit in anyone\'s request path. It pulls from the curated clip archive on its own schedule and pushes a new model candidate out through the same OTA pipeline as any other update.', n: ['train', 'ota'] },
    { t: 'OTA is staged, not all-at-once', d: 'A canary cohort, a signed image, and telemetry-driven rollback criteria turn a fleet-wide firmware push from a single point of failure into a gradual, reversible rollout.', n: ['ota', 'img'] },
    { t: 'Money and telemetry never share a store', d: 'Charging-session state and billing need strong consistency and audit trails; vehicle telemetry needs throughput and can tolerate loss. Keeping them on separate systems means a telemetry outage never touches billing correctness.', n: ['sess', 'bill', 'tel'] },
    { t: 'Commands are push, not poll', d: 'A parked, sleeping car cannot afford to poll a server every few seconds for new commands — that drains the battery for no benefit. A persistent connection woken only when a command arrives is the only workable shape.', n: ['cmd'] },
  ],
  wall: { t: 'Physical charging capacity', d: 'No software change moves electrons faster. Once Supercharger sites run near their power-delivery ceiling, the binding constraint is grid connection and stall count at that physical site, not anything in the software stack.' },
},

}
