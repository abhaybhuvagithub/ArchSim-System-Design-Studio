// Authored breakdowns, part 3 of 4. Shape documented in breakdown.js.

export default {

'Rapido': {
  meta: 'India · consumer · geospatial allocation per city',
  overview: 'Two-wheeler ride hailing: match a rider to a nearby captain in seconds, verify the ride start with an OTP, and settle over UPI. Cities are independent systems, which makes the sharding unusually clean.',
  scope: 'Allocation and the location pipeline are the interview. Payments settle through an external switch and are below the line beyond "never block the ride on them".',
  planning: 'Establish that nothing crosses city boundaries, because that turns a global scaling problem into many independent regional ones. Then treat captain location as soft state and allocation as a claim problem.',
  fr: {
    core: ['Rider requests a ride and sees a fare', 'Captain streams location and receives offers', 'Allocate the nearest suitable captain', 'Verify ride start with an OTP'],
    out: ['Driver onboarding and KYC', 'Ratings and dispute resolution'],
  },
  nfr: {
    core: ['Allocation within about 30 seconds', 'A captain is never allocated two rides', 'Location fresh within a few seconds', 'A payment failure never blocks ride completion'],
    out: ['Cross-city matching'],
  },
  nums: [['~12K/s', 'requests at peak'], ['every 4s', 'captain location ping'], ['per city', 'the natural shard'], ['~1%', 'of rides need OTP retry']],
  entities: [
    ['Captain', 'id, status, current cell, service city'],
    ['Rider', 'id, pickup point, active ride'],
    ['Ride', 'the state machine from request through OTP to completion'],
    ['Cell', 'the H3 index unit that allocation queries'],
  ],
  apiIntro: 'REST for ride requests, a socket for location and offers. The OTP exchange is a low-volume write kept off the allocation path.',
  api: [
    { dir: '→', name: 'POST /rides', body: '{ pickup, drop } → { rideId, eta, fare }' },
    { dir: '→', name: 'ws: captainLocation', body: '{ captainId, lat, lng, ts }' },
    { dir: '←', name: 'ws: rideOffer', body: '{ rideId, pickup, fare, expiresIn }' },
    { dir: '→', name: 'POST /rides/{id}/start', body: '{ otp } → { status }' },
  ],
  dives: [
    {
      title: 'City as the shard key', focus: ['geo', 'match', 'trip'],
      blocks: [
        ['p', 'Rides never cross cities, so nothing needs a global view. Per-city cells bound every failure, keep every query local, and let you scale Bengaluru independently of a town with a tenth the demand.'],
        ['note', 'This is a cleaner partition than most geospatial systems get. Take advantage of it rather than building a global index you do not need.'],
      ],
    },
    {
      title: 'Two allocators find the same captain', focus: ['match', 'otp'],
      blocks: [
        ['p', 'Claim the captain atomically with a short TTL before sending the offer, and release on decline or timeout. Without it, two riders receive confirmation for the same captain and one of them is stranded.'],
        ['warn', 'Keep OTP verification off the allocation loop. It is a low-volume write and putting it inline adds latency to the one path that is genuinely time-sensitive.'],
      ],
    },
    {
      title: 'Payment is someone else\'s throughput', focus: ['pay', 'upi'],
      blocks: [
        ['p', 'UPI settles through an external switch with its own limits and its own outages. Complete the ride, then settle asynchronously — never make trip completion wait on a round trip you do not control.'],
        ['p', 'Reconciliation then becomes a background concern rather than a user-facing failure, which is the right place for it.'],
      ],
    },
  ],
  bar: {
    mid: 'A geo index rather than lat/lng columns, and a working allocation flow.',
    senior: 'Shard by city, claim captains atomically, and keep payment off the critical path.',
    staff: 'Cover hot cells during rush hour, surge as demand management, and honest degradation when captain supply runs out.',
  },
},

'Ola': {
  meta: 'India · consumer · multi-category fleet with EV and in-app wallet',
  overview: 'Ride hailing across several vehicle categories at once: Mini, Sedan, Auto and a growing electric fleet, all matched from one city-level geo index. A rider is quoted a fare per category before a driver is even searched for, an electric ride is only offered a driver whose battery can actually make the trip, and payment goes through the in-app wallet first with UPI as the slower fallback.',
  scope: 'Category-filtered allocation, the EV range check and the wallet-first payment path are the interview. Driver onboarding and advance-scheduled outstation or rental bookings are below the line.',
  planning: 'Establish that every category shares one geo index per city and is only filtered apart at ranking time, not partitioned into separate indexes. Then treat the wallet as the fast, local payment path and UPI as an external rail that must never block a ride.',
  fr: {
    core: ['Rider requests a ride in a chosen category and sees a fare', 'Driver streams location and battery state, and receives offers', 'Allocate the nearest suitable driver in that category, honouring EV range for electric rides', 'Pay from the in-app wallet, falling back to UPI when the balance is short'],
    out: ['Driver onboarding and KYC', 'Outstation and rental bookings, which are advance-scheduled rather than live-matched'],
  },
  nfr: {
    core: ['Allocation within about 20 to 30 seconds', 'A driver is never allocated two rides at once, across any category', 'An electric ride is never offered a driver who cannot reach pickup plus drop-off with margin', 'A wallet debit is atomic, or the ride never confirms'],
    out: ['Cross-city matching'],
  },
  nums: [['~16K/s', 'requests at peak'], ['every 4s', 'driver location ping'], ['per city', 'the natural shard'], ['~15%', 'of the fleet electric, and growing']],
  entities: [
    ['Driver', 'id, category (Mini, Sedan, Auto, electric), status, current cell, battery level where it applies'],
    ['Rider', 'id, pickup point, chosen category, active ride'],
    ['Ride', 'the state machine from request through allocation to completion'],
    ['Wallet', 'balance, ledger reference, linked UPI handle for top-up'],
  ],
  apiIntro: 'REST for the fare quote and ride request, a socket for driver location and offers. The wallet debit happens synchronously with ride confirmation; a UPI top-up is a separate, asynchronous flow.',
  api: [
    { dir: '→', name: 'POST /fare', body: '{ pickup, drop, category } → { fare, eta }' },
    { dir: '→', name: 'POST /rides', body: '{ pickup, drop, category } → { rideId, driverId, eta }' },
    { dir: '→', name: 'ws: driverLocation', body: '{ driverId, lat, lng, batteryPct, ts }' },
    { dir: '←', name: 'ws: rideOffer', body: '{ rideId, pickup, fare, expiresIn }' },
    { dir: '→', name: 'POST /wallet/topup', body: '{ amount } → { status, balance }' },
  ],
  dives: [
    {
      title: 'Category is a filter before allocation ever ranks anyone', focus: ['fare', 'match', 'geo'],
      blocks: [
        ['p', 'Mini, Sedan, Auto and electric each pull from a different slice of the same fleet. The geo index stays one shared structure per city; allocation filters by category first and only then ranks on distance and acceptance rate inside that slice.'],
        ['note', 'Fare is quoted from the category plus the current supply and demand in the cell before a driver is even searched for, so pricing and matching stay two separate concerns that can be built, tested and scaled independently.'],
      ],
    },
    {
      title: 'Electric rides need range, not just distance', focus: ['ev', 'match', 'geo'],
      blocks: [
        ['p', 'An electric driver five minutes away is no use if the battery cannot cover the pickup, the trip and a safety margin. The EV range service checks remaining range against the route and the nearest charging stations before that driver is ever offered the ride.'],
        ['warn', 'Do this check inside allocation, not after an offer goes out. Declining an accepted ride because the battery would not make it is a far worse experience than never offering it in the first place.'],
      ],
    },
    {
      title: 'Wallet is the fast path, UPI is the slow one', focus: ['wallet', 'ledger', 'upi'],
      blocks: [
        ['p', 'A wallet debit is a local, atomic write against the ledger and completes in milliseconds. Confirm the ride on that. UPI only enters when the wallet balance is short, and a top-up is a queued, retried call to an external partner that must never block a ride already in progress.'],
        ['p', 'Keep the wallet ledger and the trips database as separate systems of record, reconciled asynchronously. A ride can finish while a debit is still settling, and that is fine as long as reconciliation is real and monitored.'],
      ],
    },
  ],
  bar: {
    mid: 'Category-filtered allocation and a working fare-then-match flow.',
    senior: 'EV range checked before an offer goes out, and a wallet-first payment path with UPI as an asynchronous fallback.',
    staff: 'Per-city sharding, charging-station-aware EV dispatch, and reconciliation between the wallet ledger and the trips store that never blocks a ride.',
  },
},

'Zomato': {
  meta: 'India · consumer · spiky reads, contended writes',
  overview: 'Restaurant discovery and food ordering in one product. Browsing is a heavily cacheable read workload with sharp, entirely predictable peaks; ordering is a small transactional path that must not be affected by it.',
  scope: 'The split between discovery and ordering is the interview, along with pre-scaling for meal times. Rider logistics are worth naming but the depth belongs in the delivery-focused designs.',
  planning: 'Separate the two workloads on the first diagram. Then point out that the peaks are at fixed hours every day, which makes predictive provisioning the right answer rather than reactive autoscaling.',
  fr: {
    core: ['Discover restaurants by location and cuisine', 'View menus and prices', 'Place and track an order', 'Assign a delivery rider'],
    out: ['Restaurant onboarding', 'Dine-out reservations', 'Loyalty programmes'],
  },
  nfr: {
    core: ['Discovery under 300ms', 'Ordering unaffected by browse load', 'Menus fresh within minutes', 'Survive the 12:00 and 20:00 spikes'],
    out: ['Real-time inventory per dish'],
  },
  nums: [['~20K/s', 'at peak'], ['2×/day', 'sharp predictable spikes'], ['~100:1', 'browse to order'], ['daily', 'menu change frequency']],
  entities: [
    ['Restaurant', 'location, cuisine, rating, serviceability'],
    ['Menu', 'dishes and prices — changes daily, read constantly'],
    ['Order', 'items, restaurant, customer, state machine'],
    ['Assignment', 'the rider allocated to an order'],
  ],
  apiIntro: 'REST throughout. The discovery endpoints are the cacheable ones and should be designed as such from the start.',
  api: [
    { dir: '→', name: 'GET /discover', body: '?lat=&lng=&cuisine=\n→ { restaurants[], nextCursor }' },
    { dir: '→', name: 'GET /restaurants/{id}/menu', body: '→ heavily cached, short TTL' },
    { dir: '→', name: 'POST /orders', body: '{ restaurantId, items[] } → { orderId, eta }' },
  ],
  dives: [
    {
      title: 'Menus are the most cacheable object you have', focus: ['menu', 'cat', 'cdn'],
      blocks: [
        ['p', 'A menu changes perhaps daily and is fetched millions of times. It should almost never reach a database, and pushing it to the edge removes a large fraction of total traffic.'],
        ['note', 'Invalidate on publish rather than relying on a short TTL alone, so a restaurant correcting a price sees it reflected immediately.'],
      ],
    },
    {
      title: 'Pre-scale for meal times', focus: ['gw', 'disc'],
      blocks: [
        ['p', 'The peaks are at the same hours every single day. Provisioning ahead of them is cheaper and far more reliable than autoscaling that reacts after the spike has already caused errors.'],
        ['calc', 'Reactive autoscaling typically lags several minutes. At a 5× step change in two minutes, that lag is the entire incident.'],
      ],
    },
    {
      title: 'ETA is a prediction, not a query', focus: ['eta', 'track', 'assign'],
      blocks: [
        ['p', 'Calling a routing API per request is slow and expensive. Precompute travel-time estimates per area and serve them from cache, refreshing on a schedule.'],
        ['p', 'Rider assignment is CPU-heavy and bursty, so it belongs behind a queue — order acceptance should never wait on it.'],
      ],
    },
  ],
  bar: {
    mid: 'Separate discovery from ordering and cache menus.',
    senior: 'Pre-scale for known peaks, queue rider assignment, and precompute ETAs.',
    staff: 'Cover city-level sharding, demand shaping when kitchen or rider capacity binds, and graceful degradation of discovery to protect ordering.',
  },
},

'Swiggy + Instamart': {
  meta: 'India · consumer · inventory is the contended resource',
  overview: 'Ten-minute grocery delivery from dark stores. Availability is the intersection of stock and reachability, both of which change, and overselling is not acceptable.',
  scope: 'Per-store inventory and the availability-versus-truth split are the interview. Rider routing is below the line beyond batching.',
  planning: 'Establish that "available" is a property of an item *for a location at a time*, not of the item. That reframing is what makes the caching strategy and the transactional checkout obvious.',
  fr: {
    core: ['Show items available at the customer\'s address', 'Add to cart and check out', 'Reserve stock at a specific dark store', 'Dispatch and track delivery'],
    out: ['Warehouse replenishment', 'Rider onboarding'],
  },
  nfr: {
    core: ['Availability query under 100ms', 'Never sell an item that is out of stock', 'Availability accurate within a minute', 'Ten-minute delivery promise'],
    out: ['Exact real-time inventory display while browsing'],
  },
  nums: [['~25K/s', 'at peak'], ['~10K', 'SKUs per dark store'], ['~100:1', 'browse to order'], ['10 min', 'delivery window']],
  entities: [
    ['DarkStore', 'a micro-warehouse with a location and service area'],
    ['Inventory', '(store, item) → quantity — the contended row'],
    ['Order', 'items, store, customer, status'],
    ['ServiceArea', 'precomputed cells a store can reach in time'],
  ],
  apiIntro: 'The availability endpoint is the hot path. Checkout is a small transactional write that re-validates everything the browse path assumed.',
  api: [
    { dir: '→', name: 'GET /availability', body: '?lat=&lng=&category=\n→ { items: [{id, price, etaMinutes}] }' },
    { dir: '→', name: 'POST /orders', body: '{ items[], address }\n→ { orderId, eta } | 409 out of stock' },
  ],
  dives: [
    {
      title: 'Availability is a hint; checkout is truth', focus: ['srch', 'inv', 'invdb'],
      blocks: [
        ['p', 'Browse from a short-TTL cache and accept mild staleness — showing an item that sold out thirty seconds ago is a minor annoyance. Confirming an order for it is not.'],
        ['steps', ['Begin a transaction at checkout.', 'Conditionally decrement each line item where quantity ≥ requested.', 'Any failure rolls back everything and returns which item ran out.', 'All succeed → write the order and commit.']],
        ['note', 'Sort line items by id before decrementing. Concurrent multi-item carts locking in different orders deadlock, and this one line prevents it.'],
      ],
    },
    {
      title: 'Which stores can even reach this address', focus: ['geo', 'disp'],
      blocks: [
        ['p', 'Reachability is a travel-time question, not a distance one. Precompute each store\'s service region as a set of cells and reduce the customer lookup to a hash.'],
        ['warn', 'Calling a routing API per page load is both too slow and too expensive. Recompute regions in the background as traffic patterns change.'],
      ],
    },
    {
      title: 'One popular item, one store, a rush', focus: ['invdb', 'inv'],
      blocks: [
        ['p', 'A single contended row serialises every order containing that item. Shard the quantity into sub-rows decremented at random and summed for display — a slightly more complex read for far less lock contention.'],
        ['p', 'Keep the transaction as short as possible and never hold it across a payment call.'],
      ],
    },
  ],
  bar: {
    mid: 'Location-dependent availability, cached reads, transactional checkout.',
    senior: 'Precompute service regions, design the conditional decrement, and avoid deadlocks.',
    staff: 'Cover hot-row sharding, the cart-reservation trade-off, and demand forecasting as the actual binding constraint.',
  },
},

'Razorpay': {
  meta: 'India · fintech · correctness first, throughput second',
  overview: 'A payment gateway for merchants: accept a charge, route it to an acquiring bank, record it immutably, and tell the merchant reliably. Your throughput ceiling belongs to the banks.',
  scope: 'Idempotency, the ledger, webhooks and multi-acquirer routing are the interview. KYC and merchant onboarding are below the line.',
  planning: 'Start from the two external realities: merchants retry, and acquirers fail independently. The first forces idempotency, the second forces routing and reconciliation. Everything else is downstream of those.',
  fr: {
    core: ['Accept a payment from a merchant integration', 'Route to an acquiring bank', 'Record in an immutable ledger', 'Notify the merchant by webhook', 'Settle to the merchant account'],
    out: ['KYC and onboarding', 'Lending products'],
  },
  nfr: {
    core: ['No duplicate charges under retry', 'No lost transactions', 'Webhooks eventually delivered, always', 'Reconciled against acquirers continuously'],
    out: ['Sub-100ms authorisation — the bank sets that floor'],
  },
  nums: [['~4K/s', 'transactions at peak'], ['several', 'acquiring banks in rotation'], ['T+1', 'settlement'], ['~1%', 'of transactions end ambiguous']],
  entities: [
    ['Payment', 'amount, method, merchant, state machine'],
    ['IdempotencyKey', 'merchant-scoped, generated before the first attempt'],
    ['LedgerEntry', 'immutable double-entry record'],
    ['Webhook', 'an outbound notification with retries and a signature'],
  ],
  apiIntro: 'REST for merchants with a mandatory idempotency header, and signed webhooks outbound. Merchants integrate once and never want to think about it again.',
  api: [
    { dir: '→', name: 'POST /orders', body: 'Idempotency-Key: <uuid>\n{ amount, currency, receipt } → { orderId }' },
    { dir: '→', name: 'POST /payments/capture', body: '{ paymentId, amount } → { status }' },
    { dir: '←', name: 'webhook: payment.captured', body: 'HMAC-signed, retried with backoff until 2xx' },
  ],
  dives: [
    {
      title: 'Routing across acquiring banks', focus: ['rout', 'acq'],
      blocks: [
        ['p', 'Each bank has its own TPS allocation, its own maintenance windows and success rates that vary by hour and instrument. Being multi-acquirer is simultaneously a capacity lever and a conversion lever.'],
        ['warn', 'Every additional acquirer multiplies your reconciliation surface. You are trading a throughput problem for a correctness problem, and you must staff for the second.'],
      ],
    },
    {
      title: 'The outbox is what makes webhooks reliable', focus: ['out', 'hook', 'led'],
      blocks: [
        ['p', 'Write the webhook intent in the same transaction as the ledger entry, then publish from the outbox. Without it, a crash between "charged" and "notified" leaves the merchant permanently out of sync.'],
        ['note', 'Sign every webhook and make it idempotent on the merchant side too — you will retry, and they must handle it.'],
      ],
    },
    {
      title: 'Ambiguity is the normal case', focus: ['led', 'sett', 'aud'],
      blocks: [
        ['p', 'A timeout from an acquirer tells you nothing about whether the money moved. You need a deterministic status-check flow and continuous reconciliation rather than a nightly job that discovers problems too late to act on.'],
        ['p', 'Shard the ledger by merchant. Merchants are independent, which avoids distributed transactions entirely and lets you give a large one dedicated capacity during their sale.'],
      ],
    },
  ],
  bar: {
    mid: 'Idempotency keys, an immutable ledger, and reliable webhooks.',
    senior: 'Design the outbox, handle ambiguous acquirer responses, and shard by merchant.',
    staff: 'Cover multi-acquirer routing on live health, the reconciliation surface it creates, and settlement as its own pipeline.',
  },
},

'BHIM (UPI)': {
  meta: 'India · fintech · you are a participant on a shared switch',
  overview: 'A UPI payments app: resolve a VPA, authenticate with a PIN inside a hardware security module, and move money through the national switch. Almost nothing here is capacity you own.',
  scope: 'Idempotency via the retrieval reference number, HSM constraints and per-bank isolation are the interview. Regulatory certification is below the line.',
  planning: 'Establish immediately that the switch and the banks are the ceiling. That reframes the whole design as being about isolation, idempotency and graceful degradation rather than throughput.',
  fr: {
    core: ['Register and link a bank account', 'Resolve a VPA to an account', 'Authorise a payment with a UPI PIN', 'Show transaction status reliably'],
    out: ['Merchant onboarding', 'Regulatory certification workflows'],
  },
  nfr: {
    core: ['Never double-debit under retry', 'PIN never leaves the secure boundary', 'One slow bank does not affect payments to others', 'Every ambiguous transaction resolvable'],
    out: ['Throughput beyond the allocated switch TPS'],
  },
  nums: [['~6K/s', 'at peak'], ['fixed', 'HSM operations per second'], ['~1%', 'transactions end ambiguous'], ['RRN', 'the identity across all parties']],
  entities: [
    ['VPA', 'the virtual payment address, resolved to an account'],
    ['Transaction', 'identified everywhere by its retrieval reference number'],
    ['Mandate', 'a standing authorisation'],
    ['Bank', 'an external dependency with its own health'],
  ],
  apiIntro: 'A mobile client to your backend, and your backend to the national switch. The RRN threads through every hop and every retry.',
  api: [
    { dir: '→', name: 'POST /pay', body: '{ toVpa, amount, encryptedPin } → { rrn, status }' },
    { dir: '→', name: 'GET /status/{rrn}', body: '→ { status }  // the ambiguity resolver' },
    { dir: '↔', name: 'switch: payment', body: 'forwarded to NPCI, then to the issuing bank' },
  ],
  dives: [
    {
      title: 'The RRN is the idempotency key', focus: ['upi', 'led'],
      blocks: [
        ['p', 'The retrieval reference number is the transaction\'s identity across your system, the switch and both banks. Every retry, status check and reconciliation keys off it.'],
        ['warn', 'Without that discipline you cannot distinguish a retry from a second payment, and in a payments system that distinction is the whole game.'],
      ],
    },
    {
      title: 'One slow bank must not take you down', focus: ['bank', 'npci'],
      blocks: [
        ['p', 'A single slow issuer will otherwise consume your entire thread pool and break payments to healthy banks. Per-bank circuit breakers and concurrency budgets are the highest-value resilience move available here.'],
        ['note', 'Cache the VPA directory. Address resolution happens on every payment and changes rarely, so caching it removes a switch round trip from the hot path.'],
      ],
    },
    {
      title: 'The HSM is a fixed resource', focus: ['hsm', 'iam'],
      blocks: [
        ['p', 'Hardware security modules have finite operations per second and cannot be autoscaled. Pool connections, batch where the protocol permits, and treat their capacity as a hard planning constraint rather than something to optimise later.'],
        ['p', 'Ambiguous outcomes are routine, not exceptional. A deterministic status-check and reconciliation flow matters far more than raw throughput.'],
      ],
    },
  ],
  bar: {
    mid: 'A working payment flow with a clear understanding that the switch is external.',
    senior: 'Design RRN-based idempotency, per-bank circuit breaking, and the status-check flow.',
    staff: 'Cover HSM capacity planning, reconciliation as a continuous system, and honest degradation when national infrastructure is impaired.',
  },
},

'Google Pay (UPI, India)': {
  meta: 'India · fintech · multi-PSP with inline fraud',
  overview: 'A UPI app at hundreds of millions of users. Same external switch ceiling as any participant, plus fraud scoring that has to run inline without adding perceptible latency.',
  scope: 'Multi-PSP routing, inline fraud within a latency budget, and keeping rewards off the payment path are the interview.',
  planning: 'Note that being multi-PSP is the only genuine capacity lever available, since each sponsor bank has its own allocation. Then treat fraud as a latency-budgeted inline step and rewards as strictly asynchronous.',
  fr: {
    core: ['Link accounts across multiple sponsor banks', 'Pay to a VPA, phone number or merchant', 'Score every transaction for fraud', 'Apply rewards and offers'],
    out: ['Merchant lending', 'Regulatory certification'],
  },
  nfr: {
    core: ['Payment path under 500ms excluding the switch', 'Fraud scoring adds only a few milliseconds', 'Rewards never delay or fail a payment', 'Survive one PSP bank being down'],
    out: ['Guaranteed fraud detection'],
  },
  nums: [['~30K/s', 'at peak'], ['~150K/s', 'during festivals'], ['<5ms', 'fraud scoring budget'], ['several', 'PSP banks in rotation']],
  entities: [
    ['Account', 'a linked bank account behind a PSP'],
    ['Transaction', 'keyed by RRN, scored before authorisation'],
    ['Token', 'a vaulted reference to a stored instrument'],
    ['Reward', 'an asynchronous consumer of a completed payment'],
  ],
  apiIntro: 'Mobile client to backend to PSP to switch. The fraud call is inline and bounded; everything promotional happens after.',
  api: [
    { dir: '→', name: 'POST /pay', body: '{ to, amount, pinToken } → { rrn, status }' },
    { dir: '↔', name: 'fraud: score', body: '{ features } → { risk }  // hard 5ms deadline' },
    { dir: '←', name: 'event: paymentCompleted', body: 'consumed by rewards, notifications, analytics' },
  ],
  dives: [
    {
      title: 'Routing across PSP banks', focus: ['psp', 'npci'],
      blocks: [
        ['p', 'Each sponsor bank has its own TPS allocation and its own downtime. Routing on live health is the only real capacity lever, and it is what lets you survive one bank being impaired.'],
        ['note', 'Pre-scale for festivals. Diwali and major sale events are known months ahead, and reactive autoscaling cannot follow a step change of that shape.'],
      ],
    },
    {
      title: 'Fraud inline but bounded', focus: ['fraud', 'txn'],
      blocks: [
        ['p', 'Scoring must complete within a few milliseconds against precomputed features. If the model is slow or unavailable, fail open to a rules-based check rather than delaying the payment.'],
        ['warn', 'A fraud model that becomes a latency dependency will eventually become an availability dependency. Bound it explicitly and decide the fallback in advance.'],
      ],
    },
    {
      title: 'Rewards must never touch the payment path', focus: ['rew', 'k', 'notif'],
      blocks: [
        ['p', 'Cashback and offers are asynchronous consumers of a completed-payment event. They must not be able to fail, slow or roll back a transaction.'],
        ['p', 'Tokenizing stored instruments shrinks the compliance surface and lets the transaction path carry cheap, replicable tokens rather than sensitive data.'],
      ],
    },
  ],
  bar: {
    mid: 'A working payment path with an understanding that the switch is external.',
    senior: 'Multi-PSP routing, bounded inline fraud, and rewards strictly off the path.',
    staff: 'Cover per-PSP concurrency budgets, festival pre-scaling, and coordinated degradation when national infrastructure is impaired.',
  },
},


'Continuous Testing Platform': {
  meta: 'Quality & testing · medium · feedback latency is the constraint',
  overview: 'Run the right tests on every change, fast enough that developers still care about the result. Execution capacity and flakiness both grow superlinearly with codebase size.',
  scope: 'Test selection, environment provisioning and flakiness management are the interview. Writing the tests themselves is below the line.',
  planning: 'Anchor on the ten-minute feedback budget, because it is set by human attention rather than by infrastructure. That means past a point you must run *less*, not run faster.',
  fr: {
    core: ['Trigger on pull request and on a schedule', 'Run unit, contract, UI and security stages', 'Provision an isolated environment per change', 'Gate the merge on results'],
    out: ['Writing the tests', 'Production deployment'],
  },
  nfr: {
    core: ['Feedback within about ten minutes', 'Results deterministic — no flaky failures', 'One change cannot interfere with another', 'A failing gate is trusted, not routinely overridden'],
    out: ['Running the full suite on every commit at any size'],
  },
  nums: [['~500 builds/hr', 'at a thousand engineers'], ['~10 min', 'the attention budget'], ['0.1%', 'flake rate compounds fast'], ['~70%', 'of tests typically skippable per change']],
  entities: [
    ['Pipeline', 'the ordered stages a change passes through'],
    ['Environment', 'an ephemeral, isolated instance of the system'],
    ['TestImpact', 'the mapping from changed code to affected tests'],
    ['Quarantine', 'where flaky tests go until fixed'],
  ],
  apiIntro: 'Triggered by version control events. The contract that matters is the gate: a clear pass or fail the merge respects.',
  api: [
    { dir: '→', name: 'webhook: pull_request', body: '→ provision env, select tests, run stages' },
    { dir: '←', name: 'status: check', body: '{ stage, result, report } posted back to the PR' },
    { dir: '→', name: 'POST /quarantine', body: '{ testId, reason } // removes from the gate' },
  ],
  dives: [
    {
      title: 'Run only the tests the change can affect', focus: ['ci', 'unit', 'qgate'],
      blocks: [
        ['p', 'A full suite on every commit stops being viable somewhere around a thousand engineers. Dependency-graph-based selection typically removes most of the execution volume at negligible risk.'],
        ['note', 'Keep a full nightly run as the safety net so selection bugs surface within a day rather than at release.'],
      ],
    },
    {
      title: 'Flakiness compounds', focus: ['ops', 'mon', 'e2e'],
      blocks: [
        ['p', 'A thousand tests at 0.1% flake each means most runs fail for no reason. Once that happens developers stop reading results, and the suite has lost all value regardless of coverage.'],
        ['warn', 'Detect and quarantine automatically. Relying on people to notice and fix flakes does not work at any meaningful scale.'],
      ],
    },
    {
      title: 'Shared staging is a queue', focus: ['env', 'sut', 'mock'],
      blocks: [
        ['p', 'One shared environment serialises the whole organisation and produces interference that looks like test failures. Ephemeral per-change environments parallelise cleanly.'],
        ['p', 'Virtualize partner APIs. Real third-party calls are slow, rate-limited and flaky, and they impose an external capacity limit on your own pipeline.'],
      ],
    },
  ],
  bar: {
    mid: 'A pipeline with stages, a gate, and isolated environments.',
    senior: 'Test impact analysis, service virtualization, and automated flake quarantine.',
    staff: 'Cover caching strategy, the feedback-latency budget as the real constraint, and how you would migrate an organisation onto selective execution.',
  },
},

'Windy': {
  meta: 'Product designs · hard · pre-computation and geospatial indexing',
  overview: 'A real-time, interactive weather map where users pan and zoom into forecasts and alerts from a global model ensemble. The same data serves web maps, mobile apps, and an API for weather-dependent services. The hard part is not ingesting weather data — it is serving interactive map tiles fast while keeping the forecast fresh.',
  scope: 'The tile-caching and pre-render strategy, geospatial queries, and splitting the websocket map lane from the REST API lane are the interview. The weather-model internals and the specifics of which model or satellite data to ingest are below the line.',
  planning: 'Start from the constraint: you have a forecast grid that updates every hour, and millions of users panning maps that can render anything in a second or two. That single fact — pre-computation + caching — is what shapes everything. Then add the geospatial index so "weather at this location" is sub-millisecond.',
  fr: {
    core: ['Display global weather maps with current and forecast conditions', 'Serve that map interactively — pan, zoom, and render in under 500ms', 'Send weather alerts to users subscribed to a location', 'Provide an API for weather-dependent services to query forecasts and current conditions'],
    out: ['The internals of any specific weather model', 'Satellite imagery and raw radar data — only processed model output'],
  },
  nfr: {
    core: ['Map tiles render in under 500ms regardless of zoom level', 'A forecast update every hour without pausing the map', 'Alerts fire within seconds of a weather event crossing a subscribed boundary', 'Geospatial queries (weather at point X) in under 100ms'],
    out: ['Perfect forecast accuracy — that is meteorology, not infrastructure'],
  },
  nums: [['~8K/s', 'requests at peak'], ['~1 hour', 'forecast update cadence'], ['millions', 'of map tile combinations pre-rendered per update'], ['13 nodes', 'in the system design']],
  entities: [
    ['Forecast', 'temperature, wind, precipitation for a grid cell at a specific time'],
    ['Tile', 'a pre-rendered image at a specific zoom level and location'],
    ['Alert', 'a condition (rain above X mm/hr) subscribed by a user to a location'],
    ['H3 Cell', 'a hexagonal grid cell for efficient geospatial indexing'],
  ],
  apiIntro: 'Web and mobile apps consume tiles via HTTP and websockets; backend services use a REST API for point-in-time queries. Everything reads from the same forecast cache underneath.',
  api: [
    { dir: '→', name: 'GET /tiles/{z}/{x}/{y}', body: 'render weather at this tile coordinates → PNG or WebP' },
    { dir: '→', name: 'ws: /live', body: 'subscribe to live forecast updates at a region → streamed tile diffs' },
    { dir: '→', name: 'GET /forecast', body: '{ lat, lng, timestamp } → { conditions, alerts }' },
    { dir: '→', name: 'POST /alerts', body: '{ location, condition: "rain_gt_5mm" } → subscription created' },
  ],
  dives: [
    {
      title: 'Pre-render tiles every forecast cycle', focus: ['tiles', 'forecast', 'tile'],
      blocks: [
        ['p', 'Rendering weather tiles on-demand every time a user pans is tens or hundreds of milliseconds per tile across millions of pans per second. Instead, render the entire forecast grid once per hour into a matrix of tiles at every zoom level, store them, and serve cached static assets.'],
        ['calc', 'Pre-rendering all tiles for all zoom levels is an upfront cost every hour. Serving a tile is one cache hit. The tradeoff is worth it: serve 8K rps of tiles, not 1 tile per request-path computation.'],
      ],
    },
    {
      title: 'Geospatial grid for location queries', focus: ['geo', 'models', 'forecast'],
      blocks: [
        ['p', 'A query like "weather at latitude X, longitude Y" needs to find the nearest forecast grid cell instantly. Use an H3 hexagonal grid or a fixed geospatial index so every location maps to a cell ID in one step — never a distance calculation across millions of cells.'],
        ['note', 'The same index also makes "alert: notify everyone in this cell" tractable — subscribers are bucketed by cell, not scattered globally.'],
      ],
    },
    {
      title: 'WebSocket for maps, REST for APIs', focus: ['map', 'api', 'forecast'],
      blocks: [
        ['p', 'Interactive map users want every forecast update pushed to their viewport as they pan. API consumers want a single accurate snapshot at a point in time. These are opposite traffic shapes — push vs pull, many small updates vs few large queries — so they need separate lanes or one will starve the other.'],
        ['p', 'Both read from the same forecast cache underneath, but the gateway routes them separately and applies different SLOs.'],
      ],
    },
  ],
  bar: {
    mid: 'Pre-rendered tiles, geospatial indexing, and model aggregation on a fixed schedule.',
    senior: 'Split websocket and REST lanes, implement tile caching with per-hour invalidation, and handle model ensemble disagreement.',
    staff: 'Cover alert-subscription mechanics (how do you fire billions of location-based alerts?), tile storage cost vs pre-computation tradeoffs, and how forecasts stay in sync across multiple server instances.',
  },
},

'AccuWeather': {
  meta: 'Product designs · hard · monetization through quota and tiering',
  overview: 'A weather forecasting API where organizations pay for accuracy, volume and freshness. The same forecast engine serves free and enterprise tiers with completely different SLOs, and billing must be rock-solid because customers can see every API call on their bill. The hard part is enforcing quota and billing at 25K rps without those checks becoming the latency bottleneck.',
  scope: 'Quota enforcement off the critical path, the usage-metering pipeline, and the per-tier SLO differences are the interview. Historical forecast data retention policies and customer billing cycles are below the line.',
  planning: 'Start from monetization: different customers pay different amounts, so different SLOs. Then work outward — how do you enforce a quota on 25K rps without checking a database on every call? The answer (cache quota-remaining, update asynchronously) is what shapes the design.',
  fr: {
    core: ['Serve weather forecasts via API to thousands of paying customers', 'Enforce API quotas so a free-tier customer cannot access enterprise throughput', 'Generate accurate usage bills for every customer at the end of the month', 'Maintain an SLA that varies by subscription tier'],
    out: ['Customer support or dispute resolution', 'Historical forecast accuracy analysis'],
  },
  nfr: {
    core: ['API quota enforced with zero false negatives — never let a customer overshoot their limit', 'Usage metering accurate to the call — bills match API logs', 'Free-tier users never see enterprise latency at peak', 'Forecast freshness varies by tier but is monotonic'],
    out: ['Forecast accuracy — that is meteorology'],
  },
  nums: [['~25K/s', 'API calls at peak'], ['4', 'subscription tiers (Free, Starter, Pro, Enterprise)'], ['100K', 'API customers'], ['1 hour', 'forecast freshness']],
  entities: [
    ['API Key', 'identifies a customer and their tier'],
    ['Quota', 'calls-per-day limit for a tier'],
    ['Usage Event', 'a log of one API call, destined for billing'],
    ['Forecast', 'temperature, wind, precipitation for a point and time'],
  ],
  apiIntro: 'RESTful JSON API keyed by API key. Different endpoints for current conditions, forecasts, and alerts. Quota is checked at the gateway; billing is computed asynchronously from usage logs.',
  api: [
    { dir: '→', name: 'GET /current', body: '{ apiKey, lat, lng } → { conditions }' },
    { dir: '→', name: 'GET /forecast', body: '{ apiKey, lat, lng, days } → { hourly or daily forecast }' },
    { dir: '→', name: 'POST /alerts', body: '{ apiKey, location, condition } → subscription' },
    { dir: '→', name: 'GET /usage', body: '{ apiKey } → { usedToday, limit, percentUsed }' },
  ],
  dives: [
    {
      title: 'Quota checks never block the request', focus: ['auth', 'tier', 'usage'],
      blocks: [
        ['p', 'Checking "does this customer have quota left" against a SQL database for every API call adds unacceptable latency. Instead, maintain a cache of remaining-quota-per-customer, updated asynchronously as usage is processed. A gateway cache miss falls back to a default (deny), not a database query.'],
        ['warn', 'Zero false negatives on quota means occasionally denying a request even when the customer truly has quota left (if the cache lags a few seconds behind reality). That is better than sometimes allowing overage.'],
      ],
    },
    {
      title: 'Usage is fire-and-forget', focus: ['usage', 'sub', 'tier'],
      blocks: [
        ['p', 'Recording a usage event synchronously on every API call would double the latency. Instead, emit the event asynchronously (Kafka or a job queue) and process it in batches for billing and quota updates. The quota cache is updated from those batch results.'],
        ['p', 'Usage events are immutable once emitted — they become billing line items. Log them redundantly if needed, but once recorded, they are the source of truth for how much to charge.'],
      ],
    },
    {
      title: 'Tiers are SLO buckets, not just rate limits', focus: ['tier', 'auth', 'cache'],
      blocks: [
        ['p', 'A free customer and an enterprise customer should not compete for the same infrastructure. Free tier hits a standard queue; enterprise tier hits a separate, smaller queue with guaranteed capacity. When peak load arrives, free-tier latency degrades, but enterprise stays fast.'],
        ['p', 'Same API, different queueing disciplines — that is what enforcing a tier means at scale.'],
      ],
    },
  ],
  bar: {
    mid: 'An API with subscription tiers, quota enforcement, and usage metering for billing.',
    senior: 'Separate quota cache from request path, tier-aware queueing, and asynchronous usage processing.',
    staff: 'Cover billing accuracy (what happens to in-flight requests when UTC rolls over?), quota cache staleness (how long can the cache lag?), and how to handle subscription downgrades mid-billing cycle.',
  },
},

'Booking.com': {
  meta: 'Travel · hard · a thousand searches per booking',
  overview: 'Search accommodation across supplier inventory you do not own, then book without overselling. The search-to-book ratio is what shapes every decision.',
  scope: 'Caching supplier availability, ranking a candidate set, and the booking saga are the interview. Supplier integration protocols are below the line.',
  planning: 'Lead with the 1000:1 ratio, because it immediately rules out calling suppliers on search. Then accept that cached rates will sometimes be wrong and design the booking path to handle that honestly.',
  fr: {
    core: ['Search properties by destination and dates', 'Show availability and rates', 'Book a room and take payment', 'Confirm with the supplier'],
    out: ['Supplier onboarding', 'Reviews and content moderation'],
  },
  nfr: {
    core: ['Search under one second', 'Never confirm a booking a supplier cannot honour', 'Survive individual supplier degradation', 'Rates fresh enough that surprises are rare'],
    out: ['Real-time supplier availability on search'],
  },
  nums: [['~40K/s', 'searches at peak'], ['1000:1', 'search to book'], ['thousands', 'of supplier integrations'], ['~60s', 'typical rate cache TTL']],
  entities: [
    ['Property', 'the searchable unit with location and attributes'],
    ['RatePlan', 'price and conditions for a room and date range'],
    ['Availability', 'cached supplier state — a hint, not truth'],
    ['Booking', 'a saga across supplier confirmation and payment'],
  ],
  apiIntro: 'Search is served entirely from your own index and cache. Only the booking call reaches a supplier.',
  api: [
    { dir: '→', name: 'GET /search', body: '?dest=&checkIn=&checkOut=&guests=\n→ { properties[], nextCursor }' },
    { dir: '→', name: 'POST /bookings', body: '{ propertyId, ratePlanId, dates, guest }\n→ { bookingId, status } | 409 rate changed' },
  ],
  dives: [
    {
      title: 'Never call suppliers on search', focus: ['rate', 'sup', 'srch'],
      blocks: [
        ['p', 'At a thousand searches per booking, live supplier calls are impossibly slow and will get your integration throttled. Cache availability and rates, and accept staleness on the browse path.'],
        ['note', 'Per-supplier circuit breakers and hard timeouts matter because with thousands of integrations several are always degraded. One bad supplier must not consume your search latency budget.'],
      ],
    },
    {
      title: 'The price changed between search and book', focus: ['book', 'inv', 'bdb'],
      blocks: [
        ['p', 'This is inevitable with cached rates, so handle it as a product decision: confirm live at booking, show the new price and ask. That is cheaper and more honest than chasing a perfect cache.'],
        ['warn', 'Silently booking at the new price is the one thing you must not do. It generates disputes and destroys trust for a tiny conversion gain.'],
      ],
    },
    {
      title: 'Booking is a saga', focus: ['book', 'pay', 'k'],
      blocks: [
        ['p', 'Supplier confirmation and payment are separate systems that can each fail independently. There is no distributed transaction available, so explicit compensation is required.'],
        ['p', 'Rank a candidate set rather than the full result: generate a few hundred properties cheaply, then apply expensive personalised ranking to those only.'],
      ],
    },
  ],
  bar: {
    mid: 'Cache availability, serve search from your own index, confirm at booking.',
    senior: 'Design per-supplier isolation, handle price change explicitly, and treat booking as a saga.',
    staff: 'Cover predictive cache warming, overselling as supplier state divergence, and regional search clusters.',
  },
},

'Goibibo': {
  meta: 'Travel · medium · fan-out to slow external systems',
  overview: 'Flight and hotel search across global distribution systems. Every search fans out to several slow external systems and waits for the slowest.',
  scope: 'Timeouts with partial results, fare caching and split-tender payment are the interview. GDS protocol details are below the line.',
  planning: 'Establish that your latency floor is set by systems you do not own. That makes the design a caching and timeout strategy rather than a throughput exercise.',
  fr: {
    core: ['Search flights and hotels across suppliers', 'Show fares and availability', 'Book and issue a PNR', 'Pay with a card, wallet or a split of both'],
    out: ['Supplier contract management', 'Loyalty programme mechanics'],
  },
  nfr: {
    core: ['Search results within a few seconds', 'A slow supplier never blocks the whole search', 'Fares accurate enough that changes are rare', 'Split payment never leaves money stranded'],
    out: ['Guaranteed fare stability between search and book'],
  },
  nums: [['~15K/s', 'at peak'], ['multi-second', 'GDS response times'], ['~60s', 'fare cache TTL'], ['contractual', 'GDS call limits']],
  entities: [
    ['Itinerary', 'the searched journey with its segments'],
    ['Fare', 'a cached price with a short lifetime'],
    ['PNR', 'the booking reference from the supplier'],
    ['Wallet', 'an internal ledger used in split payments'],
  ],
  apiIntro: 'Search fans out internally and returns whatever is ready at the deadline. Booking confirms live.',
  api: [
    { dir: '→', name: 'GET /flights/search', body: '?from=&to=&date=\n→ { results[], partial: true|false }' },
    { dir: '→', name: 'POST /bookings', body: '{ itineraryId, passengers[], tender }\n→ { pnr } | 409 fare changed' },
  ],
  dives: [
    {
      title: 'Hard timeouts with partial results', focus: ['gds', 'fs', 'fare'],
      blocks: [
        ['p', 'One slow supplier must not hold the entire search. Return what you have at the deadline and mark the result partial.'],
        ['calc', 'A fast partial result beats a complete slow one on every conversion metric. Users abandon on latency long before they notice a missing airline.'],
      ],
    },
    {
      title: 'Cache fares even briefly', focus: ['fare', 'k'],
      blocks: [
        ['p', 'Fares change, but not every second. Even sixty seconds of caching removes most supplier call volume on popular routes — and a small number of city pairs are most of the traffic, so pre-fetching those on a schedule turns the common case into a cache hit.'],
        ['note', 'Confirm live at booking and handle the change explicitly, exactly as with accommodation.'],
      ],
    },
    {
      title: 'Split tender is a distributed transaction', focus: ['wal', 'pay'],
      blocks: [
        ['p', 'Paying partly from a wallet and partly by card means two systems must both succeed. Keep the wallet ledger append-only and idempotent so a partial failure is recoverable rather than leaving money stranded.'],
        ['warn', 'Debit the wallet last and release on failure. Debiting first and failing the card is the case that generates support tickets.'],
      ],
    },
  ],
  bar: {
    mid: 'Cache fares, set timeouts, and confirm at booking.',
    senior: 'Return partial results deliberately, pre-fetch popular routes, and design split-tender recovery.',
    staff: 'Cover per-supplier concurrency budgets, predictive warming for booking windows, and reconciliation across wallet and gateway.',
  },
},

'IndiGo (goindigo.in)': {
  meta: 'Travel · medium · shaped around a fixed-capacity core',
  overview: 'An airline booking site in front of a passenger service system that owns the truth and cannot be scaled out. Everything in the design exists to keep traffic away from it.',
  scope: 'Shielding the PSS, handling predictable herds and bot traffic are the interview. PSS internals are below the line and outside your control.',
  planning: 'Identify the PSS as the fixed-capacity dependency immediately. Then note that both flash sales and check-in openings are scheduled events, which makes them a provisioning problem rather than an autoscaling one.',
  fr: {
    core: ['Search flights and show fares', 'Select seats and ancillaries', 'Book and issue a PNR', 'Open check-in at a fixed time before departure'],
    out: ['Crew and fleet scheduling', 'Loyalty accrual'],
  },
  nfr: {
    core: ['The PSS is never overwhelmed', 'Search stays available during a sale', 'Check-in survives a scheduled thundering herd', 'Bot traffic does not consume real capacity'],
    out: ['Real-time seat availability while browsing'],
  },
  nums: [['~8K/s', 'normally'], ['~50K/s', 'during a flash sale'], ['T-48h', 'check-in herd'], ['often >50%', 'of traffic is scrapers']],
  entities: [
    ['Flight', 'schedule, aircraft, fare buckets'],
    ['Availability', 'cached seat counts by fare class'],
    ['PNR', 'the booking record owned by the PSS'],
    ['Ancillary', 'seats, meals and baggage — independent of the booking'],
  ],
  apiIntro: 'Read paths are served from your own stores. Only booking and check-in reach the core, and they queue.',
  api: [
    { dir: '→', name: 'GET /availability', body: '?from=&to=&date= → cached, short TTL' },
    { dir: '→', name: 'POST /bookings', body: '{ flight, passengers[] } → queued to the PSS' },
    { dir: '→', name: 'POST /checkin', body: '{ pnr } → { boardingPass }' },
  ],
  dives: [
    {
      title: 'A queue in front of the core', focus: ['mq', 'pss'],
      blocks: [
        ['p', 'The passenger service system cannot be scaled out and cannot be allowed to fall over. A queue converts a flash sale into a backlog you drain at its own pace.'],
        ['note', 'Cache availability and confirm only at booking. Browsing tolerates staleness; that split keeps nearly all read traffic away from the core.'],
      ],
    },
    {
      title: 'Check-in opens at a known time', focus: ['ci', 'gw'],
      blocks: [
        ['p', 'T-48h creates a predictable herd on a published schedule. Provision ahead of it rather than discovering it — this is free capacity planning that many teams skip.'],
        ['warn', 'Add jitter to client retry so a failed herd does not immediately re-form as a synchronised second wave.'],
      ],
    },
    {
      title: 'Scrapers are a capacity problem', focus: ['waf', 'cdn'],
      blocks: [
        ['p', 'Fare-comparison bots can exceed human traffic. A WAF with bot management is capacity work here, not just security work, because every scraped search is core capacity you did not sell a seat with.'],
        ['p', 'Ancillaries — seats, meals, baggage — are independent of the booking transaction and can be served entirely from your own stores.'],
      ],
    },
  ],
  bar: {
    mid: 'Cache reads, recognise the PSS as a bottleneck, and keep search off it.',
    senior: 'Queue in front of the core, pre-scale for check-in, and treat bots as a capacity issue.',
    staff: 'Cover read projections out of the core, sale events as planned exercises, and the licensing reality behind PSS capacity.',
  },
},

'Meta (Facebook)': {
  meta: 'Big tech · hard · the graph read volume',
  overview: 'A social graph serving hundreds of millions of feed renders, where reads outnumber writes by orders of magnitude and every render fans out across the graph.',
  scope: 'The graph cache as the effective datastore, feed ranking on candidates, and purpose-built photo storage are the interview.',
  planning: 'Establish the read:write asymmetry, then make the point that at this scale the cache is not an optimisation in front of the database — it is the serving layer, and the database is durability.',
  fr: {
    core: ['Read and write the social graph', 'Render a ranked feed', 'Store and serve photos', 'Message other users'],
    out: ['Ads auction mechanics', 'Content moderation'],
  },
  nfr: {
    core: ['Feed render under 500ms globally', 'Graph reads in single-digit milliseconds', 'Survive a region loss', 'Photos served from close to the user'],
    out: ['Globally consistent graph reads'],
  },
  nums: [['~60K/s', 'in this model; far higher in reality'], ['orders of magnitude', 'read:write ratio'], ['billions', 'of small immutable photos'], ['~hundreds', 'of graph reads per feed render']],
  entities: [
    ['Node', 'a user, page or post in the graph'],
    ['Edge', 'a typed relationship — friend, like, comment'],
    ['FeedCandidate', 'a post eligible for one user\'s feed'],
    ['Photo', 'an immutable blob with a compact index entry'],
  ],
  apiIntro: 'Internally the graph is the API. Everything above it is a composition of node and edge reads.',
  api: [
    { dir: '→', name: 'graph: get(nodeId)', body: '→ node with its attributes, read-through cached' },
    { dir: '→', name: 'graph: edges(nodeId, type)', body: '→ paginated edge list' },
    { dir: '→', name: 'GET /feed', body: '→ ranked posts, hydrated from graph reads' },
  ],
  dives: [
    {
      title: 'The cache is the database', focus: ['tao', 'mc', 'db'],
      blocks: [
        ['p', 'A read-through graph cache over sharded relational storage serves the overwhelming majority of reads. The application effectively talks to the cache; the database exists for durability and for the misses.'],
        ['note', 'This inverts the usual mental model, and it is the point of the design. Cache warming and invalidation become first-class systems rather than afterthoughts.'],
      ],
    },
    {
      title: 'Billions of small immutable files', focus: ['haystack', 'cdn', 'pop'],
      blocks: [
        ['p', 'General object stores spend most of their effort on metadata operations, which dominates when files are small and numerous. A purpose-built store with compact indexing is what makes photo serving economical at this count.'],
        ['p', 'Terminating connections at points of presence near users wins substantial latency independently of anything in the backend.'],
      ],
    },
    {
      title: 'Cross-region consistency is impossible', focus: ['mc', 'db', 'feed'],
      blocks: [
        ['p', 'At this scale the speed of light means a globally consistent graph cannot exist. You accept eventual consistency and design the product around it.'],
        ['warn', 'Occasionally seeing a stale comment count is the price of the architecture. Trying to eliminate it is how you end up with a system that is slower everywhere to be correct in a case nobody notices.'],
      ],
    },
  ],
  bar: {
    mid: 'A cache in front of a sharded database and a feed built from graph reads.',
    senior: 'Treat the cache as the serving layer, rank on candidates, and separate photo storage.',
    staff: 'Cover regional cache tiers with invalidation streams, the consistency model you are choosing, and edge termination as a latency strategy.',
  },
},

}
