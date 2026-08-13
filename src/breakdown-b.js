// Authored breakdowns, part 2 of 4. Shape documented in breakdown.js.

export default {

'Payment System (Stripe-lite)': {
  meta: 'Correctness under retry · hard · the one you cannot relax',
  overview: 'Accept a charge, move money, and never lose or duplicate a transaction. This is the rare design where you scale by refusing to relax consistency rather than by embracing eventual consistency.',
  scope: 'Idempotency, the ledger and reconciliation are the interview. Fraud scoring, chargebacks and payout scheduling are below the line — say so and spend the time on correctness.',
  planning: 'State the two facts that shape everything: retries are guaranteed, and the processor is an external system you cannot transact with. Those force idempotency keys and the outbox pattern respectively. Everything else follows.',
  fr: {
    core: ['Create a payment against a card or account', 'Handle retries without double-charging', 'Record every movement in a ledger', 'Notify the merchant of the outcome'],
    out: ['Fraud scoring', 'Chargeback and dispute workflows', 'Payout scheduling'],
  },
  nfr: {
    core: ['No duplicate charges, ever', 'No lost transactions, ever', 'Acknowledge in under 500ms', 'Every discrepancy explainable after the fact'],
    out: ['Sub-100ms authorisation'],
  },
  nums: [['~4K/s', 'transactions at peak'], ['~100M/day', 'at full scale'], ['~1 KB', 'per ledger entry'], ['T+1', 'settlement window']],
  entities: [
    ['Payment', 'amount, currency, method, state machine'],
    ['LedgerEntry', 'an immutable double-entry record — never mutated'],
    ['IdempotencyKey', 'client-generated, scoped to the merchant, with the stored response'],
    ['Settlement', 'the batch reconciling your ledger against the processor'],
  ],
  apiIntro: 'REST with a mandatory idempotency header on every mutating call. The header is not optional and not retrofittable.',
  api: [
    { dir: '→', name: 'POST /payments', body: 'Idempotency-Key: <uuid>\n{ amount, currency, method, merchantId }\n→ { paymentId, status }' },
    { dir: '→', name: 'GET /payments/{id}', body: '→ { status, attempts[], ledgerRefs[] }' },
    { dir: '←', name: 'webhook: payment.updated', body: 'signed payload, retried with backoff until acked' },
  ],
  dives: [
    {
      title: 'The client retries a request that already succeeded', focus: ['idem', 'gw', 'pay'],
      blocks: [
        ['p', 'A timeout tells you nothing about whether the charge happened. The client must generate an idempotency key *before* the first attempt; the gateway stores key → response and returns the original on any repeat.'],
        ['warn', 'This cannot be added later. Every mutating endpoint needs it from the first version, or you will spend the life of the system reconciling duplicates by hand.'],
      ],
    },
    {
      title: 'You cannot transact with an external processor', focus: ['led', 'q', 'w', 'psp'],
      blocks: [
        ['p', 'Writing to your database and calling the processor cannot be atomic. Write the intent to an outbox in the same transaction as the ledger entry, then let a worker publish it. The window where you have charged but not recorded disappears.'],
        ['note', 'The same pattern powers webhooks. Merchants depend on being notified, and the outbox is what makes "we always notify eventually" actually true.'],
      ],
    },
    {
      title: 'Balances are derived, never stored', focus: ['led', 'rec'],
      blocks: [
        ['p', 'Append-only double-entry means you never mutate a balance. Every balance is a fold over immutable entries, which makes discrepancies explainable and bugs recoverable rather than destructive.'],
        ['p', 'Reconcile against the processor continuously rather than nightly. At volume, a daily job finds problems long after you could have acted on them.'],
      ],
    },
  ],
  bar: {
    mid: 'Idempotency keys, an append-only ledger, and persisting before acknowledging.',
    senior: 'Own the outbox pattern, the payment state machine, and why balances must be derived.',
    staff: 'Cover multi-acquirer routing and the reconciliation surface it creates, ambiguous processor responses, and sharding the ledger by merchant.',
  },
},

'Search Autocomplete': {
  meta: 'Latency-bound · medium · every keystroke is a request',
  overview: 'Suggest completions as the user types. Above about 100ms the feature feels broken, so this is a latency problem first and a scale problem second.',
  scope: 'Precomputation and edge caching are the interview. Spelling correction and personalised ranking are below the line — mention them and move on.',
  planning: 'Establish the latency budget immediately, because it rules out anything that computes at request time. Then show that prefix distribution is heavily skewed, which is what makes edge caching so effective here.',
  fr: {
    core: ['Return top completions for a prefix', 'Rank by popularity and recency', 'Reflect trending queries quickly'],
    out: ['Spelling correction', 'Personalised suggestions'],
  },
  nfr: {
    core: ['Under 100ms end to end', 'Handle a request per keystroke', 'Trending queries appear within minutes', 'Degrade to no suggestions rather than a slow page'],
    out: ['Per-user suggestion history'],
  },
  nums: [['~45K/s', 'requests at peak'], ['~4', 'requests per search typed'], ['~10', 'completions per prefix'], ['~2 chars', 'covers most traffic']],
  entities: [
    ['Prefix', 'the typed string — the cache and index key'],
    ['Completion', 'a suggested query with a popularity score'],
    ['TrieNode', 'holds its own precomputed top-K'],
  ],
  apiIntro: 'A single GET. Everything about the design exists to make it fast.',
  api: [
    { dir: '→', name: 'GET /ac?q=<prefix>', body: '→ { suggestions: [{ text, score }] }\nCache-Control: public, max-age=300' },
    { dir: '→', name: 'POST /queries', body: '{ query }  // feeds the popularity aggregation' },
  ],
  dives: [
    {
      title: 'Store the answer, not the data to compute it', focus: ['trie', 'ac'],
      blocks: [
        ['p', 'Each trie node holds its own top ten completions, so a lookup is a walk plus a read and never a sort. Computing rankings at request time cannot meet the budget at any scale.'],
        ['note', 'Shard the trie by prefix range so each shard is independent and every query touches exactly one.'],
      ],
    },
    {
      title: 'Short prefixes are almost all the traffic', focus: ['cdn', 'ac'],
      blocks: [
        ['p', 'Completions for "a" or "th" are identical for nearly everyone and change hourly at most. Pushing them to the edge removes the majority of requests from your origin entirely.'],
        ['calc', 'Debouncing on the client by 50ms removes a further large fraction at zero perceptible cost — the cheapest scaling lever in the whole design.'],
      ],
    },
    {
      title: 'Trending queries versus a stable index', focus: ['k', 'agg', 'store'],
      blocks: [
        ['p', 'A nightly rebuild misses breaking news, which is precisely when autocomplete matters most. Layer a streaming path for fast-rising queries over the stable index, and merge at read time.'],
        ['warn', 'Guard it. A streaming path that ranks purely on velocity is trivially manipulated and will surface things you do not want suggested.'],
      ],
    },
  ],
  bar: {
    mid: 'A trie or prefix index with precomputed top-K and a cache in front.',
    senior: 'Push short prefixes to the edge, debounce on the client, and separate trending from stable ranking.',
    staff: 'Cover trie sharding, regional replicas for the latency floor, and abuse resistance in the trending path.',
  },
},

'µsvc: E-commerce (Saga)': {
  meta: 'Microservice patterns · hard · distributed transactions',
  overview: 'An order spans inventory, payment and shipping, each owning its own database. There is no distributed rollback, so every step needs an explicit inverse.',
  scope: 'The saga and its compensations are the interview. Catalogue browsing and recommendations are below the line. Be willing to say that a monolith would be simpler if the scale did not demand otherwise.',
  planning: 'Start by acknowledging that splitting services created this problem. Then work the order lifecycle as a state machine, choose orchestration over choreography and explain why, and finish on the failure modes that leave money in the wrong place.',
  fr: {
    core: ['Place an order across several services', 'Reserve inventory, take payment, arrange shipping', 'Cancel an order and unwind cleanly', 'Report order status'],
    out: ['Catalogue browsing and search', 'Recommendations', 'Returns processing'],
  },
  nfr: {
    core: ['Never charge without reserving stock', 'Never reserve stock without eventually charging or releasing', 'Order state survives any single service restart', 'Stuck orders are detectable and bounded'],
    out: ['Strict serialisability across services'],
  },
  nums: [['~6K/s', 'orders at peak'], ['~4', 'services per saga'], ['~2s', 'typical saga completion'], ['<0.1%', 'sagas needing manual intervention']],
  entities: [
    ['Order', 'the saga root, with an explicit state machine'],
    ['Reservation', 'a hold on inventory that expires if not confirmed'],
    ['Payment', 'an authorisation that can be captured or voided'],
    ['Compensation', 'the inverse of a completed step — refund, restock, cancel'],
  ],
  apiIntro: 'Public REST at the gateway; internal steps are commands and events. The orchestrator owns the sequence, not the caller.',
  api: [
    { dir: '→', name: 'POST /orders', body: '{ items[], paymentMethod, address }\n→ 202 { orderId, status: "PENDING" }' },
    { dir: '→', name: 'GET /orders/{id}', body: '→ { status, steps: [{name, state}] }' },
    { dir: '←', name: 'event: OrderStepCompleted', body: '{ orderId, step, outcome }' },
  ],
  dives: [
    {
      title: 'Orchestration or choreography', focus: ['saga', 'bus'],
      blocks: [['p', 'Both are viable and they fail in different ways.']],
      options: [
        { rating: 'Good', title: 'Choreography — services react to events', approach: 'Each service listens for the previous step\'s event and emits its own. No central coordinator.', challenges: 'Simple for three steps and impossible to debug at eight. No single place knows the state of an order, and the sequence is implicit in subscriptions scattered across repositories.' },
        { rating: 'Great', title: 'Orchestration — an explicit coordinator', approach: 'A saga orchestrator owns the sequence, issues commands, records each outcome and triggers compensations. One place knows the state of every order.', challenges: 'The orchestrator is a component you must scale and make highly available, and its state must be persisted or an in-flight order is lost on deploy.', best: true },
      ],
    },
    {
      title: 'There is no rollback', focus: ['saga', 'pay', 'inv'],
      blocks: [
        ['p', 'Once payment is captured you cannot undo it with a transaction — you issue a refund. Every step needs an explicit inverse, and those inverses must themselves be idempotent because they will be retried.'],
        ['warn', 'Compensations can fail too. Budget for a queue of sagas needing human attention; the goal is to bound and surface them, not to pretend they cannot happen.'],
      ],
    },
    {
      title: 'Inventory is the contended resource', focus: ['inv', 'idb'],
      blocks: [
        ['p', 'It needs real transactions and conditional decrements. Do not make it eventually consistent just to fit the pattern — reserve at checkout rather than at add-to-cart, and let the reservation expire.'],
        ['note', 'Sort line items by id before decrementing. Multi-item carts locking in different orders deadlock under load, and this is a one-line fix.'],
      ],
    },
  ],
  bar: {
    mid: 'Recognise that cross-service writes need a saga and that compensations replace rollback.',
    senior: 'Choose orchestration deliberately, persist saga state, and make every handler idempotent.',
    staff: 'Cover the operational surface for stuck sagas, inventory contention under load, and how you would shard each service independently.',
  },
},

'µsvc: CQRS + Event Sourcing': {
  meta: 'Microservice patterns · hard · the log is forever',
  overview: 'Writes append events; reads are served from projections shaped for their queries. You gain audit, time travel and independently scalable reads, and you pay in projection lag and permanent schema decisions.',
  scope: 'Be honest that this is the right pattern for a minority of systems. The interview is in projection management and in living with eventual consistency, not in the pattern\'s definition.',
  planning: 'Justify the pattern before applying it — audit requirements or a wildly asymmetric read/write ratio. Then treat projections as the operational reality: they lag, they get rebuilt, and both need designing for.',
  fr: {
    core: ['Accept commands that append events', 'Serve reads from purpose-shaped projections', 'Rebuild a projection from history', 'Query state as of a point in time'],
    out: ['Cross-aggregate transactions', 'Ad-hoc analytical queries over the log'],
  },
  nfr: {
    core: ['Projection lag under a second in normal operation', 'Rebuild a projection without downtime', 'Events immutable and never lost', 'Reads scale independently of writes'],
    out: ['Read-your-writes without explicit handling'],
  },
  nums: [['~9K/s', 'reads'], ['~500/s', 'commands'], ['~200 B', 'per event'], ['billions', 'events in the log at maturity']],
  entities: [
    ['Event', 'an immutable fact, ordered within its aggregate'],
    ['Aggregate', 'the consistency boundary — ordering only matters inside it'],
    ['Projection', 'a read model derived from the event stream'],
    ['Snapshot', 'materialised aggregate state so rehydration is bounded'],
  ],
  apiIntro: 'Commands and queries are separate endpoints and usually separate deployments. That separation is the entire point.',
  api: [
    { dir: '→', name: 'POST /commands/{type}', body: '{ aggregateId, payload, expectedVersion }\n→ 202 { eventId, version }' },
    { dir: '→', name: 'GET /views/{name}', body: '→ { data, asOfVersion }' },
    { dir: '←', name: 'event: appended', body: '{ aggregateId, version, type, payload }' },
  ],
  dives: [
    {
      title: 'Rehydrating an aggregate with 100,000 events', focus: ['es', 'snap'],
      blocks: [
        ['p', 'Replaying from the beginning stops being viable quickly. Snapshot periodically and load the snapshot plus a short tail, which keeps load time constant regardless of history length.'],
        ['note', 'Partition the event store by aggregate id. Ordering only matters within an aggregate, so that key gives full parallelism while preserving the only guarantee that matters.'],
      ],
    },
    {
      title: 'The user reads their own stale write', focus: ['proj', 'qry', 'qc'],
      blocks: [
        ['p', 'Projections lag, so the user who just submitted will often not see their change. Either serve read-your-writes from the command side, or make the UI honest about pending state.'],
        ['warn', 'Do not pretend the lag is not there. Designing around it explicitly is the difference between a system that feels broken and one that feels deliberate.'],
      ],
    },
    {
      title: 'Rebuilding a projection is routine', focus: ['proj', 'rd1', 'rd2'],
      blocks: [
        ['p', 'You will change a read model\'s shape regularly. Build into a shadow store and swap, so a rebuild never takes the read path down.'],
        ['p', 'Rebuild time grows with history. Past a few billion events "just rebuild it" stops being something you can do casually, which is an argument for aggressive snapshotting and for pruning what you can.'],
      ],
    },
  ],
  bar: {
    mid: 'Explain the pattern, the separation of command and query, and why projections are eventually consistent.',
    senior: 'Design snapshotting and partitioning, and handle read-your-writes explicitly.',
    staff: 'Cover shadow rebuilds, schema evolution via upcasting over an immutable log, and when you would advise against this pattern entirely.',
  },
},

'Cloud-Native Gateway API Platform': {
  meta: 'Microservice patterns · medium-hard · the 2020-2026 edge stack',
  overview: 'Two lanes on one platform. Ordinary product traffic comes in as REST, gets transcoded once at the edge into gRPC, and runs behind a service mesh that owns mTLS and retries. A separate AI-assistant lane carries its own token-aware rate limiter, its own guardrails and its own semantic cache in front of the one genuinely expensive resource on the platform: a GPU-served LLM. The Kubernetes Gateway API sits in front of both and is where every canary rollout actually happens.',
  scope: 'The interview is in why the platform is split into two lanes, where the gRPC-JSON translation happens exactly once, and why the AI lane is rate-limited and cached differently from everything else. Individual business-service logic and LLM fine-tuning are below the line.',
  planning: 'Start from the traffic shape: one lane is cheap and high-volume, the other is a small fraction of requests but the most expensive resource on the platform by far. Route them separately from the edge so each can be sized and protected on its own terms, then work outward — transcoding, mesh, cache, guardrails.',
  fr: {
    core: ['Route external REST/JSON traffic to internal gRPC services, and translate exactly once', 'Roll out a new service version to a percentage of traffic without a second pipeline', 'Rate-limit and cache the AI-assistant lane by token cost, not by request count', 'Encrypt and authenticate every service-to-service call automatically'],
    out: ['Business logic inside any individual service', 'Training or fine-tuning the LLM itself'],
  },
  nfr: {
    core: ['A canary rollout is a config change to the gateway, not a parallel deployment', 'No internal service ever parses JSON on the hot path', 'A GPU replica is only spun up for what the cache could not answer', 'A blocked prompt never reaches the cache or the model'],
    out: ['Zero latency added by the mesh or the transcoder'],
  },
  nums: [['~20K/s', 'requests at peak across both lanes'], ['~85/15', 'split between data-plane and AI-assistant traffic'], ['~80%', 'semantic cache hit rate on repeated-intent prompts'], ['12', 'GPU replicas sized to the AI lane alone, independent of the rest'],],
  entities: [
    ['Route', 'a Gateway API rule: match, weight, backend'],
    ['Service', 'an internal gRPC-only capability behind the mesh'],
    ['Prompt', 'the AI-lane request: checked by guardrails, then the cache, then the model'],
    ['Policy', 'mTLS, retry budget and circuit breaker configuration applied by the sidecar'],
  ],
  apiIntro: 'External clients only ever see REST/JSON, whichever lane they hit. Internal service-to-service calls are gRPC over mTLS, never JSON, and carry a deadline and a trace id propagated by the sidecar.',
  api: [
    { dir: '→', name: 'POST /orders', body: 'REST/JSON in → transcoded to a gRPC call, JSON back out' },
    { dir: '→', name: 'POST /assistant/ask', body: '{ prompt } → guardrail check, cache lookup, model call only on a miss' },
    { dir: '↔', name: 'internal: any gRPC call', body: 'protobuf payload, mTLS, x-request-id and deadline propagated by the sidecar' },
  ],
  dives: [
    {
      title: 'Transcode once, never twice', focus: ['tgw', 'mesh'],
      blocks: [
        ['p', 'External clients keep speaking REST and JSON indefinitely — that is a public contract and expensive to change. The gRPC-JSON transcoder is the single place that translation happens; every internal hop after it is protobuf over gRPC, which is smaller on the wire and faster to (de)serialize than repeatedly parsing JSON at every service.'],
        ['note', 'Put the transcoder at the edge, not inside each service. One correct implementation beats twenty inconsistent ones.'],
      ],
    },
    {
      title: 'Two lanes, two capacity plans', focus: ['gw', 'ai', 'llm'],
      blocks: [
        ['p', 'The data-plane lane and the AI-assistant lane have almost nothing in common in cost or shape: gRPC calls are cheap and fast, an LLM call is slow and GPU-bound. Routing them through separate entry points at the gateway means each can be rate-limited, cached and capacity-planned on its own curve instead of one setting compromising both.'],
        ['warn', 'Counting AI-lane requests instead of tokens under-protects the model — a single request can cost 50 times another depending on prompt and output length. Rate limit on tokens, not requests.'],
      ],
    },
    {
      title: 'Guardrails, then cache, then the model — in that order', focus: ['guard', 'sem', 'llm'],
      blocks: [
        ['p', 'Prompt-injection and PII filtering run before the semantic cache is even checked. If guardrails ran after the cache, a blocked prompt could still poison or be served from the cache; running first means a rejected prompt never gets that far.'],
        ['p', 'The semantic cache matches on intent, not exact text, so two differently-worded questions with the same meaning still hit — which is what makes an 80% hit rate realistic and keeps the GPU replica count an order of magnitude smaller than the request volume would otherwise demand.'],
      ],
    },
  ],
  bar: {
    mid: 'Explain why REST-to-gRPC translation happens once at the edge rather than per service.',
    senior: 'Split the AI-assistant lane from the data plane unprompted, and justify token-based rather than request-based rate limiting.',
    staff: 'Cover canary rollouts as a Gateway API config concern, GPU capacity as the real bottleneck no amount of mesh tuning fixes, and the ordering of guardrails before caching.',
  },
},

'µsvc: BFF + Mesh Platform': {
  meta: 'Microservice patterns · medium · operational surface',
  overview: 'Each client type gets its own backend-for-frontend, and cross-cutting resilience lives in a service mesh rather than in every service. The mesh scales fine; the number of moving parts is what bites.',
  scope: 'The interview is in why a BFF exists at all and in what the mesh takes over. Individual service design is below the line.',
  planning: 'Justify the BFF from client divergence rather than from fashion. Then explain what moves into the sidecar and — most importantly — why retry budgets become load-bearing once you have one.',
  fr: {
    core: ['Serve web and mobile clients with appropriate payloads', 'Route to internal services with discovery', 'Apply retries, timeouts and circuit breaking uniformly', 'Secure service-to-service traffic'],
    out: ['Individual service business logic', 'Client applications themselves'],
  },
  nfr: {
    core: ['A failing service degrades one feature, not the page', 'Uniform observability without per-service instrumentation', 'Config and discovery more available than what they front', 'No retry amplification under load'],
    out: ['Zero added latency from the sidecar'],
  },
  nums: [['~14K/s', 'requests at peak'], ['~1ms', 'sidecar overhead per hop'], ['~4', 'internal hops per request'], ['27×', 'amplification from 3 tiers × 3 retries']],
  entities: [
    ['BFF', 'a client-specific aggregation layer'],
    ['Service', 'a domain capability behind the mesh'],
    ['Sidecar', 'the proxy applying policy to every call'],
    ['Policy', 'timeout, retry budget, circuit breaker configuration'],
  ],
  apiIntro: 'Clients only ever see their own BFF. Internal calls carry a deadline and a correlation id — both propagated, not regenerated.',
  api: [
    { dir: '→', name: 'GET /bff/web/home', body: '→ one aggregated payload assembled from several services' },
    { dir: '→', name: 'GET /bff/mobile/home', body: '→ a smaller, flatter payload for the same screen' },
    { dir: '↔', name: 'internal: any service call', body: 'x-request-id, x-deadline propagated by the sidecar' },
  ],
  dives: [
    {
      title: 'Why one API for all clients fails', focus: ['bffw', 'bffm'],
      blocks: [
        ['p', 'Mobile wants fewer, fatter responses to save round trips on poor networks; web wants many small ones it can render progressively. A shared API forces a compromise that suits neither and accumulates conditionals forever.'],
        ['note', 'Each BFF is owned by the team that owns that client, which is as much an organisational win as a technical one.'],
      ],
    },
    {
      title: 'Retry amplification', focus: ['mesh', 'a', 'b', 'd'],
      blocks: [
        ['p', 'Three tiers each retrying three times is twenty-seven requests reaching the bottom service — which is already struggling, which is why the retries started.'],
        ['warn', 'A mesh makes retries trivial to enable and therefore trivial to weaponise against yourself. Retry budgets and deadline propagation are mandatory, not optional hardening.'],
      ],
    },
    {
      title: 'Config and discovery are on every critical path', focus: ['reg', 'cfg', 'mesh'],
      blocks: [
        ['p', 'They must be more available than the services they serve, with local caching so a control-plane blip is survivable rather than total.'],
        ['p', 'Cell-based regions bound the blast radius: a full independent stack per region gives you a natural deployment unit and a natural failure boundary.'],
      ],
    },
  ],
  bar: {
    mid: 'Explain what a BFF is for and what the mesh takes over from application code.',
    senior: 'Raise retry amplification unprompted and design deadline propagation.',
    staff: 'Cover cell-based regionalisation, control-plane availability, and the migration path from library-based resilience to a mesh.',
  },
},

'µsvc: Event-Driven Orders': {
  meta: 'Microservice patterns · medium · the bus becomes the contract',
  overview: 'Services communicate through an event bus rather than direct calls. Consumers scale independently and a slow one no longer blocks checkout — at the cost of every consumer needing to tolerate replay.',
  scope: 'Partitioning, idempotency and the dead-letter path are the interview. Schema registry mechanics are worth naming but not designing in depth.',
  planning: 'Establish at-least-once delivery as the only realistic guarantee, because that single fact dictates idempotent consumers, dedupe keys and replay tooling. Then handle ordering, which only matters within an order.',
  fr: {
    core: ['Accept an order and publish it', 'Payment, inventory and notification react independently', 'Failed messages are retried then quarantined', 'Serve order status from a read model'],
    out: ['Direct synchronous queries between services', 'Cross-service transactions'],
  },
  nfr: {
    core: ['A slow consumer never blocks order acceptance', 'No lost events', 'Events for one order processed in order', 'Poison messages surface rather than vanish'],
    out: ['Global ordering across all orders'],
  },
  nums: [['~8K/s', 'orders at peak'], ['~5', 'events per order'], ['~40K/s', 'total bus throughput'], ['3', 'retries before dead-lettering']],
  entities: [
    ['Event', 'an immutable fact with a key and a schema version'],
    ['Topic', 'partitioned by order id'],
    ['ConsumerGroup', 'an independently scaled set of workers'],
    ['DeadLetter', 'a message that failed its retries, awaiting a human'],
  ],
  apiIntro: 'One synchronous entry point; everything after it is asynchronous. Status is served from a projection, never by querying the bus.',
  api: [
    { dir: '→', name: 'POST /orders', body: '{ items[], customer } → 202 { orderId }' },
    { dir: '←', name: 'event: OrderPlaced', body: 'key=orderId  { orderId, items[], total }' },
    { dir: '→', name: 'GET /orders/{id}', body: '→ served from the projection, not the bus' },
  ],
  dives: [
    {
      title: 'Ordering only matters within one order', focus: ['bus'],
      blocks: [
        ['p', 'Partition by order id. That gives full parallelism across orders while preserving sequence within each — the only guarantee the domain actually needs.'],
        ['note', 'Global ordering would serialise the entire system for a guarantee nobody asked for. Resist it.'],
      ],
    },
    {
      title: 'Every consumer will see the same event twice', focus: ['pay', 'inv', 'notif'],
      blocks: [
        ['p', 'At-least-once is the realistic guarantee, so every handler must be safe to run again on the same input. Design this into the first consumer rather than discovering it during an incident.'],
        ['warn', 'The dangerous ones are side-effecting handlers: charging a card, sending an email, decrementing stock. Each needs a dedupe key checked before the effect, not after.'],
      ],
    },
    {
      title: 'A dead-letter queue nobody watches is data loss', focus: ['dlq', 'an'],
      blocks: [
        ['p', 'Alert on depth, assign an owner, and make replay a routine operation rather than an emergency script someone writes under pressure.'],
        ['p', 'Consumers deploy independently, so producers and consumers will run different schema versions simultaneously. Additive-only changes plus a registry turn that from an outage into a non-event.'],
      ],
    },
  ],
  bar: {
    mid: 'A bus between services, independent consumers, and retries with a dead-letter queue.',
    senior: 'Partition deliberately, make consumers idempotent, and design schema evolution.',
    staff: 'Cover replay tooling, distributed tracing across asynchronous hops, and the debuggability ceiling this architecture has.',
  },
},

'µsvc: Strangler Migration': {
  meta: 'Microservice patterns · hard · the database is the real obstacle',
  overview: 'Extract capabilities from a monolith incrementally while it keeps serving traffic. Until writes move, you have added a network hop and nothing else.',
  scope: 'Routing, change capture and the order of extraction are the interview. Rewriting business logic is below the line — the question is how you move it safely, not what it does.',
  planning: 'Put the routing layer in first, because it makes every subsequent step reversible. Then sequence extraction by write ownership rather than by what looks easiest, and set an explicit end date for the bidirectional-sync phase.',
  fr: {
    core: ['Route per endpoint between monolith and new services', 'Extract a bounded context without downtime', 'Keep data consistent during the transition', 'Roll back a slice that misbehaves'],
    out: ['Rewriting business logic', 'Changing the public API contract'],
  },
  nfr: {
    core: ['No downtime during any cut-over', 'No lost writes during dual operation', 'Any slice reversible by flipping a route', 'Behaviour identical before and after'],
    out: ['Immediate performance improvement'],
  },
  nums: [['~7K/s', 'total traffic'], ['5–10', 'slices in a typical migration'], ['weeks', 'per slice, realistically'], ['0', 'acceptable lost writes']],
  entities: [
    ['Slice', 'one bounded context being extracted'],
    ['Route', 'the mapping from endpoint to owner'],
    ['SyncStream', 'change capture keeping old and new in step'],
    ['Owner', 'which system currently owns writes for a context'],
  ],
  apiIntro: 'The public contract must not change. The gateway is what lets ownership move behind an unchanged surface.',
  api: [
    { dir: '→', name: 'ANY /api/*', body: '→ routed to monolith or extracted service by endpoint' },
    { dir: '↔', name: 'cdc: monolith → new', body: 'change stream from the legacy schema' },
    { dir: '↔', name: 'cdc: new → monolith', body: 'the reverse leg — the risky phase, keep it short' },
  ],
  dives: [
    {
      title: 'Change capture, never dual writes', focus: ['cdc', 'sync'],
      blocks: [
        ['p', 'Dual-writing from application code diverges the first time one write fails, and you will not notice for weeks. Reading the database change log gives one ordered stream and no lost updates.'],
        ['warn', 'Bidirectional sync is the most dangerous state in the migration and teams live in it for years. Treat it as a phase with a deadline, not as an architecture.'],
      ],
    },
    {
      title: 'Extract by write ownership', focus: ['new1', 'ndb1', 'new2', 'ndb2'],
      blocks: [
        ['p', 'A service that reads its own data but cannot write it has not been extracted. Sequence the work by which context can plausibly take ownership of its writes first.'],
        ['note', 'Shadow traffic before cutting over: send production reads to the new service, compare responses, serve the old one. It catches behavioural drift before any user sees it.'],
      ],
    },
    {
      title: 'The shared database is what actually blocks you', focus: ['mono', 'mdb'],
      blocks: [
        ['p', 'Foreign keys and joins spanning the intended boundary are the real obstacle. Breaking them means denormalising and accepting eventual consistency between contexts.'],
        ['p', 'That is a data modelling problem, and no amount of infrastructure solves it. Expect it to dominate the schedule.'],
      ],
    },
  ],
  bar: {
    mid: 'Put a routing layer in front and extract one slice behind it.',
    senior: 'Use change capture rather than dual writes, sequence by write ownership, and shadow before cutting over.',
    staff: 'Cover breaking cross-context joins, bounding the bidirectional phase, and the organisational sequencing this requires.',
  },
},

'Data Platform (Lakehouse)': {
  meta: 'Data platform · medium · cost is the constraint',
  overview: 'Land operational data, curate it, and serve analytics and machine learning from it. You can always add compute; the interesting limits are freshness and money.',
  scope: 'The medallion layering, change capture and incremental processing are the interview. Specific transformation logic is below the line.',
  planning: 'Separate storage from compute early, because it is the defining property. Then work through the layers, and be explicit that small-file proliferation and full-refresh transforms are what actually kill these platforms.',
  fr: {
    core: ['Ingest from operational stores continuously', 'Land raw data immutably', 'Transform into curated and warehouse layers', 'Serve BI and machine learning'],
    out: ['Specific business transformation logic', 'Dashboard authoring'],
  },
  nfr: {
    core: ['Freshness within minutes for curated data', 'Reprocess history without touching production', 'Schema changes fail the build, not the dashboard', 'Query cost attributable to a team'],
    out: ['Sub-second analytical queries'],
  },
  nums: [['TBs/day', 'ingest at scale'], ['~3K/s', 'CDC events'], ['3 layers', 'raw → curated → warehouse'], ['~30%', 'of cost is usually compaction and small files']],
  entities: [
    ['Source', 'an operational store emitting changes'],
    ['RawTable', 'append-only landing, never edited'],
    ['CuratedTable', 'cleaned, conformed, incrementally maintained'],
    ['Contract', 'the schema a downstream model depends on'],
  ],
  apiIntro: 'There is no request/response API. The contracts that matter are the table schemas and the orchestrator DAG.',
  api: [
    { dir: '→', name: 'cdc stream', body: 'ordered changes from each operational store' },
    { dir: '→', name: 'dag: curate', body: 'incremental model with a watermark, not a full refresh' },
    { dir: '←', name: 'contract check', body: 'schema violation fails the pipeline before publishing' },
  ],
  dives: [
    {
      title: 'Why full refreshes stop working', focus: ['etl', 'cur', 'raw'],
      blocks: [
        ['p', 'Rebuilding a table from all history is fine at gigabytes and ruinous at terabytes. Incremental models with watermarks keep daily cost flat as history grows.'],
        ['calc', 'The tell is a job whose runtime grows every week even though daily volume is constant. That is a full refresh and it will eventually miss its window.'],
      ],
    },
    {
      title: 'Small files destroy query performance', focus: ['raw', 'cur'],
      blocks: [
        ['p', 'Streaming ingest produces many tiny files, and query engines pay per file. Compaction is a permanent background job, not a one-off cleanup.'],
        ['note', 'Partitioning choices are equally load-bearing. Partition on what queries filter by, and resist the temptation to partition on something high-cardinality.'],
      ],
    },
    {
      title: 'An upstream schema change breaks twenty models', focus: ['sch', 'cdc'],
      blocks: [
        ['p', 'This is the characteristic failure of a data platform, and it usually surfaces as a wrong dashboard rather than an error. A schema registry with enforcement turns it into a build failure the producing team owns.'],
        ['p', 'Query cost is the other governance problem: one badly written query over a petabyte costs real money every time it runs. Quotas and attribution matter more than any infrastructure decision at this size.'],
      ],
    },
  ],
  bar: {
    mid: 'Layered ingestion into a lake, transforms into a warehouse, and an orchestrator owning the DAG.',
    senior: 'Use change capture over bulk extracts, design incremental models, and raise compaction.',
    staff: 'Cover schema contracts with enforcement, cost attribution and quotas, and separating storage from compute for independent scaling.',
  },
},

'GenAI: RAG Assistant': {
  meta: 'AI / ML · medium · inference dominates everything',
  overview: 'Answer questions over private documents by retrieving relevant context and generating a grounded response. Retrieval is the cheap part; generation is the entire cost and latency story.',
  scope: 'Chunking, retrieval quality, caching and guardrails are the interview. Model training and fine-tuning are below the line.',
  planning: 'Establish the cost asymmetry immediately — generation is orders of magnitude more expensive than retrieval — because it reorders every optimisation priority. Then work retrieval quality, which is what actually determines whether the product is good.',
  fr: {
    core: ['Ingest and index documents', 'Retrieve relevant context for a question', 'Generate a grounded answer with citations', 'Refuse or escalate when context is insufficient'],
    out: ['Model training and fine-tuning', 'Multi-turn agentic tool use'],
  },
  nfr: {
    core: ['First token within two seconds', 'Answers grounded in retrieved context, not invented', 'Cost per query economically viable', 'No leakage of documents a user cannot see'],
    out: ['Guaranteed factual correctness'],
  },
  nums: [['~400/s', 'queries at peak'], ['~1K tokens', 'retrieved context per query'], ['~500 tokens', 'generated per answer'], ['10–100×', 'generation cost versus retrieval']],
  entities: [
    ['Document', 'the source, with an owner and access control'],
    ['Chunk', 'a retrievable passage with its embedding'],
    ['Query', 'the question plus its embedding'],
    ['Answer', 'generated text plus the chunks that grounded it'],
  ],
  apiIntro: 'One streaming endpoint. Streaming is not a nicety — time to first token is what users perceive as speed.',
  api: [
    { dir: '→', name: 'POST /ask', body: '{ question, filters }\n→ SSE stream of tokens, then { citations[] }' },
    { dir: '→', name: 'POST /documents', body: '{ content, acl } → chunked, embedded, indexed' },
  ],
  dives: [
    {
      title: 'Cache semantically, not exactly', focus: ['sem', 'qemb'],
      blocks: [
        ['p', 'Users ask the same question in different words, so an exact-match cache almost never hits. Embed the query and match against previous questions above a similarity threshold instead.'],
        ['calc', 'This eliminates a large share of generation calls, which is the single biggest cost lever in the design — larger than any infrastructure tuning available.'],
      ],
    },
    {
      title: 'Retrieval quality is the product', focus: ['vec', 'ing', 'iemb'],
      blocks: [
        ['p', 'Bad retrieval cannot be rescued by a better model. Chunk size and overlap, hybrid keyword-plus-vector search, and reranking the top candidates matter far more than which model generates.'],
        ['warn', 'Permissions must be applied in the retrieval query, not by filtering afterwards. Filtering after retrieval leaks the existence of documents and scales badly.'],
      ],
    },
    {
      title: 'Route by difficulty', focus: ['orch', 'llm', 'rl'],
      blocks: [
        ['p', 'Most queries do not need your largest model. A classifier that sends easy questions to a smaller one changes the unit economics more than anything else you can do.'],
        ['p', 'Guardrails on input and output are not optional in a product context, but they are additional inference — budget for them in the latency and cost model rather than treating them as free.'],
      ],
    },
  ],
  bar: {
    mid: 'Embed, retrieve, generate, cite. Know why grounding matters.',
    senior: 'Design semantic caching and hybrid retrieval, and apply permissions inside the query.',
    staff: 'Cover model routing economics, continuous batching on the inference tier, and evaluation as a permanent pipeline rather than a launch task.',
  },
},

'ML: Recommendation Ranking': {
  meta: 'AI / ML · hard · two stages or nothing',
  overview: 'Pick a few dozen items to show from a catalogue of millions, in a few tens of milliseconds. The structural decision is that you never score the whole catalogue.',
  scope: 'Two-stage retrieval, feature serving and training-serving skew are the interview. Model architecture is below the line.',
  planning: 'State the latency budget and the catalogue size together, because their ratio is what forces two stages. Then treat the feature store as the thing that determines both latency and model quality.',
  fr: {
    core: ['Return ranked recommendations for a user', 'Incorporate recent behaviour', 'Support experimentation between models', 'Log outcomes for training'],
    out: ['Model architecture and training loops', 'Content moderation of recommended items'],
  },
  nfr: {
    core: ['Under 100ms end to end', 'Recent behaviour reflected within minutes', 'Consistent features between training and serving', 'Model changes shippable weekly'],
    out: ['Deterministic recommendations across sessions'],
  },
  nums: [['~20K/s', 'requests at peak'], ['millions', 'items in the catalogue'], ['~500', 'candidates after stage one'], ['~20', 'items returned']],
  entities: [
    ['User', 'identity plus behavioural features'],
    ['Item', 'catalogue entry plus item features'],
    ['Candidate', 'an item that survived retrieval'],
    ['Feature', 'a value used identically in training and serving'],
  ],
  apiIntro: 'One read endpoint plus a feedback path. The feedback path is not optional — without it the model cannot improve.',
  api: [
    { dir: '→', name: 'GET /recommendations', body: '?userId=&surface=&n=20\n→ { items[], experimentId }' },
    { dir: '→', name: 'POST /feedback', body: '{ userId, itemId, action, experimentId }' },
  ],
  dives: [
    {
      title: 'Two stages, not one', focus: ['cand', 'rank'],
      blocks: [
        ['p', 'Cheap recall narrows millions to hundreds; expensive precision ranks only those. This is the decision everything else depends on, and getting it wrong makes the latency budget unreachable at any cost.'],
        ['note', 'Precompute candidates offline for active users and the online path becomes a lookup plus a rank. Most users are not online at any given moment.'],
      ],
    },
    {
      title: 'Feature fetching is the latency killer', focus: ['feat', 'rec'],
      blocks: [
        ['p', 'Per-candidate lookups turn a 20ms budget into 500ms. One batched multi-get for the whole candidate set is the difference between viable and not.'],
        ['calc', '500 candidates × 1ms per lookup = 500ms. The same data in one round trip is 2ms. Nothing else in the design has that leverage.'],
      ],
    },
    {
      title: 'Training-serving skew', focus: ['feat', 'train', 'lake'],
      blocks: [
        ['p', 'The most common cause of a model that looks excellent offline and disappoints live is features computed differently in the two paths. One shared definition, computed by the same code, is the fix.'],
        ['warn', 'The feedback loop is the deeper problem: recommendations shape the behaviour you train on, so the system drifts towards its own predictions. Deliberate exploration costs short-term metrics and is not optional.'],
      ],
    },
  ],
  bar: {
    mid: 'Two-stage retrieval and an understanding of why you cannot score everything.',
    senior: 'Batch feature fetches, precompute candidates, and design A/B infrastructure.',
    staff: 'Cover training-serving skew, exploration versus exploitation, and the feedback loop as a systemic rather than technical problem.',
  },
},

'Enterprise: Zero-Trust Platform': {
  meta: 'Enterprise · medium · shaped around a core you cannot scale',
  overview: 'A multi-tenant regulated platform in front of legacy systems of record. Everything modern scales horizontally; the mainframe and the ERP do not, and the architecture exists to shield them.',
  scope: 'Tenancy, identity on the hot path, and shielding the core are the interview. The legacy systems\' internals are below the line and firmly out of your control.',
  planning: 'Identify the fixed-capacity dependency first, because every subsequent decision is about keeping traffic away from it. Then handle tenancy and identity, both of which touch every single request.',
  fr: {
    core: ['Authenticate and authorise every request', 'Isolate tenants from each other', 'Read and write through to systems of record', 'Produce a complete audit trail'],
    out: ['ERP and mainframe internals', 'Tenant onboarding workflows'],
  },
  nfr: {
    core: ['No request reaches a service unauthenticated', 'One tenant cannot exhaust another\'s capacity', 'The core is never overwhelmed by a traffic spike', 'Audit is complete and tamper-evident'],
    out: ['Sub-100ms end-to-end for core-backed writes'],
  },
  nums: [['~9K/s', 'requests at peak'], ['fixed', 'core transaction capacity'], ['~1ms', 'token validation budget'], ['7 years', 'typical audit retention']],
  entities: [
    ['Tenant', 'the isolation boundary for data, capacity and compliance'],
    ['Principal', 'an authenticated identity with claims'],
    ['SystemOfRecord', 'the legacy store that owns the truth'],
    ['AuditEvent', 'an immutable record of who did what'],
  ],
  apiIntro: 'Everything enters through one gateway that authenticates, routes by tenant, and enforces quota before anything else runs.',
  api: [
    { dir: '→', name: 'ANY /api/*', body: 'Authorization: Bearer <token>\nX-Tenant-Id resolved by the router' },
    { dir: '↔', name: 'mq: coreRequest', body: 'queued towards the mainframe, never called directly' },
    { dir: '←', name: 'audit: event', body: 'written asynchronously to durable, append-only storage' },
  ],
  dives: [
    {
      title: 'Queue in front of the core', focus: ['mq', 'core', 'erp'],
      blocks: [
        ['p', 'A mainframe or ERP has fixed, licensed capacity and cannot be scaled out on demand. A queue converts a traffic spike into a backlog you drain at the core\'s own pace rather than an outage.'],
        ['note', 'Project reads out of the core entirely. Maintain your own read models fed by change capture so nearly all read traffic never reaches the legacy system.'],
      ],
    },
    {
      title: 'Identity must be faster than everything it protects', focus: ['iam', 'gw'],
      blocks: [
        ['p', 'Every request authenticates. Token validation has to be local with cached signing keys — a round trip to the identity provider per request makes it your bottleneck and your single point of failure.'],
        ['warn', 'Key rotation must not cause a stampede. Fetch new keys ahead of expiry and overlap the validity window.'],
      ],
    },
    {
      title: 'Tenancy is a capacity boundary, not just a data one', focus: ['ten', 'db', 'pii'],
      blocks: [
        ['p', 'Routing by tenant lets you give a large customer dedicated capacity and stops a runaway integration degrading everyone. It also makes data residency and per-tenant compliance tractable rather than aspirational.'],
        ['p', 'Audit logging is mandatory but must never be synchronous. Write to a durable buffer and ship out of band.'],
      ],
    },
  ],
  bar: {
    mid: 'Gateway with SSO, tenant separation, and awareness that the legacy core has limits.',
    senior: 'Shield the core with a queue and read projections, and keep identity off the network per request.',
    staff: 'Cover per-tenant capacity isolation, data residency as a routing constraint, and the procurement reality of licensed core capacity.',
  },
},

'Observability: Golden Signals': {
  meta: 'Observability · medium · cardinality is the enemy',
  overview: 'Collect metrics, logs and traces from every service and turn them into alerts someone will act on. Telemetry volume grows faster than the system producing it.',
  scope: 'Cardinality control, sampling and alerting practice are the interview. Specific dashboards are below the line.',
  planning: 'Put a collector in the middle early — it is the abstraction that makes everything else changeable. Then treat cardinality and sampling as the two levers that decide whether this is affordable.',
  fr: {
    core: ['Collect metrics, logs and traces uniformly', 'Query across all three signals', 'Alert on service health', 'Route alerts to whoever is on call'],
    out: ['Business analytics', 'Log-based billing'],
  },
  nfr: {
    core: ['Telemetry loss never affects production', 'Alerts actionable, not noisy', 'Query recent data in seconds', 'Cost bounded as service count grows'],
    out: ['Retaining every log line indefinitely'],
  },
  nums: [['~12K/s', 'requests generating telemetry'], ['millions', 'active metric series'], ['TBs/day', 'log volume at scale'], ['~1%', 'of traces retained after sampling']],
  entities: [
    ['Signal', 'a metric, log line or span'],
    ['Series', 'a metric plus its label set — the cardinality unit'],
    ['Trace', 'a causally linked set of spans'],
    ['SLO', 'the target and error budget an alert burns against'],
  ],
  apiIntro: 'Services speak one protocol to a local collector. The collector decides where data goes, which is what makes backend changes config rather than a thousand redeploys.',
  api: [
    { dir: '→', name: 'otlp: export', body: 'metrics, logs and spans from every service' },
    { dir: '→', name: 'query: range', body: 'PromQL-style over metrics; trace lookup by id' },
    { dir: '←', name: 'alert: burnRate', body: 'multi-window SLO burn, routed to on-call' },
  ],
  dives: [
    {
      title: 'Kill cardinality at the collector', focus: ['otel', 'met'],
      blocks: [
        ['p', 'One label carrying a user id turns a hundred series into a hundred million. Drop or bucket high-cardinality labels before they reach storage.'],
        ['calc', 'This is the single biggest cost lever in observability, and it has to be enforced centrally — asking every team to be careful does not work.'],
      ],
    },
    {
      title: 'Head sampling loses the traces you need', focus: ['tr', 'otel'],
      blocks: [
        ['p', 'Keeping 1% at random discards almost every error and slow request — precisely the ones worth having. Tail-based sampling decides after the fact, keeping the interesting traces and discarding the boring majority.'],
        ['note', 'It costs buffering at the collector, which is a real trade-off, but the alternative is paying to store traces nobody will ever look at.'],
      ],
    },
    {
      title: 'Threshold alerts do not scale with service count', focus: ['slo', 'page', 'siem'],
      blocks: [
        ['p', 'Per-metric thresholds across a thousand services produce noise nobody reads, and an alert nobody reads is worse than no alert. Multi-window burn-rate alerts on error budgets scale in a way thresholds do not.'],
        ['warn', 'Every alert needs an owner and a runbook. An alert with neither will be silenced within a month.'],
      ],
    },
  ],
  bar: {
    mid: 'Three signals into backends, with a collector in between and basic alerting.',
    senior: 'Control cardinality, use tail sampling, and alert on SLO burn rather than thresholds.',
    staff: 'Cover tiered retention economics, the collector as an abstraction boundary, and monitoring the monitoring stack itself.',
  },
},

}
