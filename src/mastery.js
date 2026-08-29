// The 80/20 curriculum: the eleven areas that carry most system design
// interviews, itemized. Each item is one crisp teaching line plus a concrete
// exercise wired to the exact place in the studio where the concept is live -
// a template to load, a tab to open, a thing to actually do. Mastery is a
// checkbox you earn, persisted locally.

export const MASTERY_STORE = 'archsim.mastery.v1'

export const MASTERY = [
  {
    id: 'storage', icon: '🗄️', title: 'Scalable Data Storage',
    flag: "Choosing the database before the queries - \"we will use Mongo\" with no access pattern named is the classic opening blunder.",
    items: [
      { id: 'sql-nosql', t: 'Relational vs NoSQL', asks: "Design Instagram's data layer - what stores what, and why won't one database do?", d: 'SQL buys transactions and joins at the cost of a scaling ceiling; NoSQL buys horizontal writes at the cost of your query flexibility. The workload decides, never fashion.', go: { tpl: 'News Feed (Twitter/X)', tab: 'capacity', do: 'Select the SQL and NoSQL nodes - read each 🔍 internals and compare what each store promises.' } },
      { id: 'partitioning', t: 'Partitioning & sharding', asks: "Your users table hit 2 TB and writes are timing out - walk me through splitting it.", d: 'Split data across machines by a key; the key choice decides your hot spots and which queries stay single-shard.', go: { tpl: 'Chat (WhatsApp)', tab: 'capacity', do: 'Select a datastore and switch its Partitioning control - watch what each scheme costs.' } },
      { id: 'indexing', t: 'Indexing', asks: "This query scans 40M rows. Fix it - and tell me what your fix cost the write path.", d: 'A primary index locates the row; secondary and covering indexes answer queries without touching it - every index taxes every write.', go: { tpl: 'FB Post Search', tab: 'breakdown', do: 'Read the inverted-index dive: an index is a precomputed answer to one question shape.' } },
      { id: 'consistency', t: 'Consistency models', asks: "A user posts a comment, refreshes, and it's gone - then it reappears three seconds later. Explain, and decide whether that's a bug.", d: 'Strong reads see the last write; eventual reads converge later; causal keeps cause before effect. Weaker models are cheaper and often enough.', go: { tpl: 'Chat (WhatsApp)', tab: 'capacity', do: 'Set a datastore to leaderless and tune the w/r quorum inputs until the verdict flips.' } },
    ],
  },
  {
    id: 'caching', icon: '⚡', title: 'Caching',
    flag: "A cache with no invalidation story. If you cannot say when entries die, you designed stale data, not speed.",
    items: [
      { id: 'cache-where', t: 'Client vs server vs edge', asks: "Pages load in 800ms globally. Where do you put caches, and what breaks first when you do?", d: 'Cache as close to the reader as truth allows: browser for the user, CDN for the crowd, Redis for the fleet - each layer answers before the one behind it.', go: { tpl: 'Netflix', tab: 'capacity', do: 'Trace a read: CDN hit, cache hit, origin. Kill the cache with chaos ⚡ and watch the DB inherit the traffic.' } },
      { id: 'cache-strategies', t: 'Write-through / write-back / write-around', asks: "Prices update hourly but a cart must never show a stale total - design the caching.", d: 'Through writes both places (safe, slower); back writes cache first and flushes later (fast, riskier); around skips the cache so reads warm it (good for write-heavy, rarely-read data).', go: { tpl: 'Redis (Distributed Cache)', tab: 'capacity', do: 'Select the cache node and flip its Write policy control - write-back shows you the loss-window warning live.' } },
      { id: 'cache-distributed', t: 'Distributed cache', asks: "Your Redis hit ratio fell from 95% to 60% overnight. Diagnose it.", d: 'Redis-class memory over consistent hashing: sub-ms reads, a slab of RAM as a service, and a stampede waiting behind every hot key expiry.', go: { tpl: 'Redis (Distributed Cache)', tab: 'scale', do: 'Read the stampede lever - request coalescing is the same defense the CDN shield uses.' } },
      { id: 'cache-eviction', t: 'Eviction policies', asks: "The cache is full and a batch job just scanned the whole catalog - what got evicted, and who screams?", d: 'LRU drops the longest-untouched, LFU the least-popular; both are bets about the future shaped like the past.', go: { tpl: 'Redis (Distributed Cache)', tab: 'capacity', do: 'Open the cache node 🔍 internals - the data structure section shows the LRU machinery.' } },
    ],
  },
  {
    id: 'lb', icon: '⚖️', title: 'Load Balancing',
    flag: "Saying \"add a load balancer\" as if it were the scaling - the LB spreads load; replicas absorb it.",
    items: [
      { id: 'horizontal', t: 'Horizontal scaling', asks: "Traffic doubles every quarter. When does the bigger-box strategy die, and what replaces it?", d: 'More replicas behind a balancer beats a bigger box: linear-ish capacity, failure becomes a blip, and the queueing knee moves right.', go: { tpl: 'Ride Sharing (Uber)', tab: 'capacity', do: 'Drag the traffic slider up until a tier saturates, then + replicas and watch p99 fall off the knee.' } },
      { id: 'lb-techniques', t: 'Round-robin vs consistent hashing', asks: "User sessions keep breaking every deploy. The LB is round-robin - connect those two facts.", d: 'Round-robin spreads load evenly; consistent hashing keeps a key on the same node so caches stay warm and shards stay stable when the fleet changes.', go: { tpl: 'URL Shortener (Bitly)', tab: 'capacity', do: 'Select the LB and switch Balancing to consistent hashing - the verdict computes the resize math for this exact tier.' } },
      { id: 'reverse-proxy', t: 'Reverse proxy', asks: "Why does every architecture diagram start with nginx? What is it actually doing all day?", d: 'NGINX/Envoy-class front door: terminates TLS, parses HTTP, shields services - tens of thousands of requests per second per box of pure forwarding.', go: { tpl: 'URL Shortener (Bitly)', tab: 'capacity', do: 'Open the LB 🔍 internals - the mechanism section is the reverse-proxy job description.' } },
    ],
  },
  {
    id: 'async', icon: '📨', title: 'Asynchronous Processing',
    flag: "\"Just use Kafka\" with no ordering, replay, or consumer-group story - reaching for the log without saying why a log.",
    items: [
      { id: 'brokers', t: 'Queues vs streams', asks: "Order events must be processed exactly once by billing AND replayed by analytics - queue or stream? Defend it.", d: 'A queue hands each message to one consumer and forgets; a stream (Kafka-class) is a replayable log many consumers read at their own pace. Delete-on-ack vs retained history is the whole difference.', go: { tpl: 'Ad Click Aggregator', tab: 'breakdown', do: 'Read why the click path is a stream, not a queue - replay is the audit trail.' } },
      { id: 'event-driven', t: 'Event-driven architecture', asks: "Checkout calls six services synchronously and p99 is four seconds. Redesign it without touching the six services.", d: 'Services publish facts instead of calling each other: producers never wait, consumers never block producers, and new consumers arrive without anyone changing.', go: { tpl: 'Payment System (Stripe-lite)', tab: 'breakdown', do: 'Follow the ledger events dive - the saga is choreography over a log.' } },
      { id: 'task-queues', t: 'Task queues, retries, DLQs', asks: "A poison message is crashing your consumer in a loop - what should the design have had?", d: 'Slow work goes behind a queue with idempotent consumers, exponential backoff, and a dead-letter queue so one poison job cannot stall the world.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'breakdown', do: 'Read accept-fast-answer-slow - the queue is the architecture, not an optimization.' } },
    ],
  },
  {
    id: 'rw', icon: '📖', title: 'Database Read & Write Scaling',
    flag: "Quoting CAP, then designing as if partitions never happen. The theorem is a constraint, not a slide.",
    items: [
      { id: 'read-scaling', t: 'Read replicas', asks: "Reads are 50x writes and the primary sits at 90% CPU - what do you do, and what must the product team be told?", d: 'The leader takes writes, followers serve reads: read capacity multiplies, at the price of replication lag your product must be honest about.', go: { tpl: 'Zomato', tab: 'capacity', do: 'Select the SQL node, set replication to leader-follower, and read the lag warning it surfaces.' } },
      { id: 'write-scaling', t: 'Write scaling & leader election', asks: "You sharded by user_id and one celebrity just broke shard 7 - now what?", d: 'Writes shard by key when one leader saturates; each shard elects its own leader, and the election itself needs consensus.', go: { tpl: 'Online Chess', tab: 'breakdown', do: 'Read the game-shard dive: one game, one authority - sharding by the unit of consistency.' } },
      { id: 'cap', t: 'CAP theorem', asks: "A network partition hits mid-sale: should the cart keep accepting adds? Defend either answer.", d: 'When the network partitions you keep consistency or availability, not both. Everything else in distributed data is negotiating that sentence.', go: { tpl: 'Chat (WhatsApp)', tab: 'acr', do: 'Look up CAP, then BASE, then ACID - the three form one argument.' } },
    ],
  },
  {
    id: 'distributed', icon: '🤝', title: 'Distributed Systems Concepts',
    flag: "Hand-waving \"we will use consensus\" for data that needed none - Raft is for coordination, not your feed.",
    items: [
      { id: 'consensus', t: 'Consensus (Paxos/Raft)', asks: "Why can't two config servers just agree between themselves? Why does everyone insist on three or five?", d: 'A quorum of nodes agreeing on one value despite crashes: majority rounds, a leader with a term, and a log everyone replays identically.', go: { tpl: 'Online Chess', tab: 'capacity', do: 'Open the coordination node 🔍 internals - Raft terms and quorum writes are the mechanism section.' } },
      { id: 'conflict', t: 'Conflict resolution', asks: "Two offline devices edited the same note, then synced. Walk me through every resolution strategy and what each one loses.", d: 'Concurrent writes need a rule: last-write-wins loses data quietly, vector clocks detect the conflict, CRDTs make merging automatic by construction.', go: { tpl: 'Chat (WhatsApp)', tab: 'acr', do: 'Look up CRDT - then ask the AI when LWW is genuinely fine (more often than purists admit).' } },
    ],
  },
  {
    id: 'reliability', icon: '🛡️', title: 'Reliability & Failover',
    flag: "Retries without backoff or a budget - the design that DDoSes itself the moment a dependency blinks.",
    items: [
      { id: 'redundancy', t: 'Active-active vs active-passive', asks: "The SLA says 99.95% - is active-passive enough? Show me the math, not the vibes.", d: 'Active-active serves from every replica and absorbs failure invisibly; active-passive keeps a warm standby and pays a failover pause. The SLO decides which you can afford.', go: { tpl: 'Zerodha (Kite)', tab: 'slo', do: 'Read the SPOF gate, then ⚡ inject a fault and watch the burn card price the difference.' } },
      { id: 'health-checks', t: 'Health checks', asks: "The instance passes every health check and returns garbage - what kind of check catches that?", d: 'The balancer only routes around what it can detect: shallow checks catch dead processes, deep checks catch lying ones.', go: { tpl: 'Ride Sharing (Uber)', tab: 'chaos', do: 'Kill a replicated node and watch survivors absorb it - that reroute IS the health check working.' } },
      { id: 'circuit-breakers', t: 'Retries & circuit breakers', asks: "Your payment provider slowed to 8-second responses and the whole site went down. Reconstruct the cascade, then stop it.", d: 'Retries with backoff heal blips; a circuit breaker opens after repeated failure so a dying dependency cannot recruit your whole fleet into a retry storm.', go: { tpl: 'Ramp', tab: 'capacity', do: 'Open any app node 🔍 internals - the mechanism line gives the exact backoff and breaker numbers.' } },
    ],
  },
  {
    id: 'cdn', icon: '🌐', title: 'CDNs',
    flag: "CDN as decoration: naming it without saying what is cacheable, for how long, and how purge works.",
    items: [
      { id: 'cdn-static', t: 'Static content delivery', asks: "The origin egress bill tripled this month. What's your first question, and the first graph you pull?", d: 'Bytes served from a PoP near the user: origin traffic drops ~90%, p50 drops with the speed of light saved, and the origin stops feeling weather.', go: { tpl: 'CDN (Edge Network)', tab: 'breakdown', do: 'Read the shield dive - a thousand cold PoPs cost the origin exactly one fetch.' } },
      { id: 'cdn-edge', t: 'Caching at the edge', asks: "You purged the CDN but users still see the old logo - list every place it could be hiding.", d: 'Hit ratio is the product: every point of it is origin egress the customer never buys, and purge is a global broadcast racing staleness.', go: { tpl: 'CDN (Edge Network)', tab: 'roi', do: 'Open ROI - the whole business is a ratio, priced per million requests.' } },
    ],
  },
  {
    id: 'api', icon: '🔌', title: 'API Design & Rate Management',
    flag: "Offset pagination on a moving feed - page 2 that repeats page 1 is a bug you shipped on purpose.",
    items: [
      { id: 'rest-graphql', t: 'REST vs GraphQL', asks: "Mobile says the API is too chatty; platform says GraphQL is a caching nightmare. Arbitrate.", d: 'REST models resources and caches beautifully; GraphQL lets clients shape responses and saves round-trips at the cost of server complexity and cache pain. Public APIs lean REST; product frontends earn GraphQL.', go: { tpl: 'News Feed (Instagram)', tab: 'breakdown', do: 'Read the API section, then redesign one endpoint as a GraphQL query in your head - what got easier, what got worse?' } },
      { id: 'pagination', t: 'Pagination & filtering', asks: "Users report seeing the same post twice while scrolling - find the bug in the API design.", d: 'Offset pagination breaks under inserts; cursor pagination (keyset) is stable, index-friendly, and what every feed actually uses.', go: { tpl: 'News Feed (Twitter/X)', tab: 'breakdown', do: 'Find the cursor in the feed API - note what the cursor encodes and why offset would lie.' } },
      { id: 'versioning', t: 'API versioning', asks: "You have to rename a field forty clients depend on. Plan the next twelve months.", d: 'Version in the path, add fields freely, never change meaning: an API is a promise, and deprecation is a migration you run for other people.', go: { tpl: 'Postman', tab: 'breakdown', do: 'Read the API-contract framing - the product IS versioned promises.' } },
      { id: 'rate-limiting', t: 'Rate limiting (token/leaky bucket)', asks: "A partner's integration retries in a tight loop at 2am every night - protect yourself without breaking them.", d: 'Token bucket allows bursts up to capacity and refills at rate; leaky bucket smooths everything to a constant drain. Both turn abuse into a 429 instead of an outage.', go: { tpl: 'Rate Limiter (as a system)', tab: 'breakdown', do: 'Read the algorithms dive - then check the sliding-window trade-off the design chose.' } },
    ],
  },
  {
    id: 'search', icon: '🔍', title: 'Search Systems',
    flag: "\"Elasticsearch handles it\" with no analyzer, index, or ranking story - search is a pipeline, not a checkbox.",
    items: [
      { id: 'search-indexing', t: 'Inverted indexes', asks: "Search must reflect a new post within one second - what does that requirement cost the write path?", d: 'Map every term to the documents containing it: a search becomes set intersection instead of a scan, built at write time so reads are cheap.', go: { tpl: 'FB Post Search', tab: 'breakdown', do: 'Read the ingest dive - the index IS the write path.' } },
      { id: 'search-engines', t: 'Full-text engines', asks: "Search p99 spiked the week you added twenty languages - where do you look first?", d: 'Elasticsearch-class shards: analyzers tokenize, per-shard queries fan out, results merge - tens of ms over warm shards for real queries.', go: { tpl: 'Local Search (Yelp)', tab: 'capacity', do: 'Open the search node 🔍 internals - the fan-out-and-merge mechanism is the whole engine.' } },
      { id: 'search-ranking', t: 'Ranking & relevance', asks: "Best-match search returns exact-title matches below popular garbage - who decides relevance, and how do you tune it?", d: 'Scoring blends term rarity (TF-IDF/BM25) with signals like freshness and popularity - relevance is a product decision wearing math.', go: { tpl: 'Search Autocomplete', tab: 'breakdown', do: 'Read the ranking dive - note where popularity beats textual match, on purpose.' } },
    ],
  },
  {
    id: 'obs-sec', icon: '🩺', title: 'Monitoring, Observability & Security',
    flag: "Alerting on causes instead of symptoms - paging on CPU while users watch errors. And JWTs you can never revoke.",
    items: [
      { id: 'metrics', t: 'Metrics & golden signals', asks: "You get ONE dashboard for the whole system - four graphs. Which four, and why those?", d: 'Latency, traffic, errors, saturation: four numbers that describe any service - collected by Prometheus-class scrapers, judged against SLOs.', go: { tpl: 'Observability: Golden Signals', tab: 'breakdown', do: 'Read why these four - then open SLO on any design and watch them become a verdict.' } },
      { id: 'tracing', t: 'Distributed tracing', asks: "The request took 800ms and every service swears it's not them - end the argument.", d: 'One request, one trace id, a span per hop: the only way to answer where did the 800ms go in a system with twelve services.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'capacity', do: 'Open the telemetry node 🔍 internals - spans, batching, and the export path.' } },
      { id: 'authn', t: 'AuthN & AuthZ (OAuth, JWT)', asks: "Sessions or JWTs for this web app? - and the interviewer keeps repeating 'but what about revocation?'", d: 'OAuth delegates who you are; JWT carries it as a signed claim; authorization decides what that identity may do - three different questions, always kept separate.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'breakdown', do: 'Find where the JWT is validated and where quota is enforced - note they are different layers.' } },
      { id: 'encryption', t: 'Encryption in transit & at rest', asks: "The auditor asks: is customer data encrypted? Give the answer that survives the follow-ups.", d: 'TLS on every hop, AES on every disk, keys in a KMS you can rotate and audit - table stakes, and the interview answer is knowing where each applies.', go: { tpl: 'Payment System (Stripe-lite)', tab: 'acr', do: 'Look up mTLS, KMS and E2EE - three layers, three threat models.' } },
    ],
  },
  {
    id: 'envelope', icon: '🧮', title: 'Back-of-Envelope Math',
    flag: "Numbers pulled from vibes - sizing a fleet without stating the per-box assumption you divided by.",
    items: [
      { id: 'latency-ladder', t: 'The latency ladder', asks: "Ballpark it: how much slower is a cross-region call than a cache hit - and why does everyone memorize these?", d: 'Systems intuition is these numbers, cold: each rung sits one to three orders of magnitude above the last, and every architecture decision is really a decision about which rungs a request is allowed to touch.', go: { tpl: 'CDN (Edge Network)', tab: 'capacity', do: 'Find the cross-region milliseconds hiding in the latency chips - then note how the edge exists purely to stop paying them.' } },
      { id: 'throughput-rules', t: 'Throughput rules of thumb', asks: "A 50K-rps checkout flow - how many app servers? Show me the division.", d: 'One box of anything sustains a knowable order of magnitude - these are this studio\'s own catalog numbers, provenance and all. Fleet sizing is division: demand over per-box, padded to ~70% utilization.', go: { tpl: 'URL Shortener (Bitly)', tab: 'capacity', do: 'Cover the panel, size every tier for 50K rps by division alone - then check yourself against the simulator.' } },
      { id: 'dau-to-rps', t: 'DAU → rps in your head', asks: "Ten million DAU photo app: estimate QPS and a year of storage, on the whiteboard, out loud.", d: 'The conversion every interview opens with: a day is 86,400 seconds - call it 10^5. Daily volume over 10^5 is average rps; peak is 3-10x that; storage is objects x size x days x ~3 for replicas and indexes.', go: { tpl: 'News Feed (Twitter/X)', tab: 'capacity', do: 'Estimate this template\'s rps from a DAU story before looking at the slider - then compare with what it loads at.' } },
      { id: 'nines', t: 'The nines, in minutes', asks: "The PM wants five nines. Translate that into minutes - and into money - before you agree to anything.", d: 'Availability talk is only honest as a downtime budget: each nine divides the allowance by ten. Know the monthly numbers cold and every SLO negotiation becomes arithmetic instead of vibes.', go: { tpl: 'Zerodha (Kite)', tab: 'slo', do: 'Set a target and watch these same minutes appear as your error budget - then spend some of it with chaos.' } },
    ],
  },
  {
    id: 'llm-prod', icon: '🤖', title: 'LLM Systems in Production',
    flag: "Reciting components when the question asked for a procedure. The answer shape is diagnose -> intervene -> PROVE - candidates who skip the proof step fail with perfect knowledge.",
    items: [
      { id: 'rag-diagnose', t: '95% recall, 60% accuracy - retrieval or generation?', d: 'Split the pipeline and grade each half alone: retrieval recall against labeled query-doc pairs, then generation faithfulness GIVEN gold context fed by hand. The half that fails while the other is held perfect is the culprit - and a 95/60 gap is already pointing at generation.', go: { tpl: 'GenAI: RAG Assistant', tab: 'breakdown', do: 'Read the retrieval dive, then say the two-column isolation out loud - test each half with the other held perfect.' } },
      { id: 'grounded-halluc', t: 'Right document retrieved, LLM still hallucinates', d: 'Retrieval succeeded; grounding failed. Check where the doc sat in the context (lost-in-the-middle), whether the chunk contains the ANSWER or merely matches the query, whether neighboring chunks contradict it, and whether the prompt even permits saying not-in-context.', go: { tpl: 'GenAI: RAG Assistant', tab: 'capacity', do: 'Select the vector store, open 🔍 internals, and note what a chunk actually is - topical match is not answer coverage.' } },
      { id: 'agent-loops', t: 'Preventing infinite tool-calling loops', d: 'A loop is a missing exit, not a model flaw. Budgets on steps, tokens, spend and wall-clock; a repeat-call detector (same tool, same args: twice is a nudge, three times ends the task honestly); observation hashing so the agent cannot chase its own tail.', go: { tpl: 'Agentic Workflow (Tools)', tab: 'breakdown', do: 'Read the loop-with-a-budget dive - the caps ARE the product working, then find the loop-detection bullet.' } },
      { id: 'cost-spike', t: 'LLM bill suddenly 3x - find it, fix it', d: 'Cost is requests x tokens-per-request x price-per-token - attribute the 3x to ONE factor before touching anything. The usual suspects: context bloat (k crept up, history replayed whole), retry storms double-billing, a router quietly drifting traffic to the expensive model, or a semantic cache that stopped hitting.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'roi', do: 'Open ROI and find the COGS line - then name which of the three factors each fix attacks.' } },
      { id: 'one-gpu', t: '1 GPU, 1,000 simultaneous requests', d: 'You do not serve a thousand at once - you admission-control to what the GPU sustains and make everyone else wait honestly. Token-bucket at the door with 429 + retry-after, a bounded queue, continuous batching on the GPU, streaming so waits feel alive, and a degrade ladder: semantic cache first, smaller model, shorter max_tokens.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'capacity', do: 'Drag traffic past the worker ceiling, then inject a 🔁 Retry Storm - watch why admission control beats heroics.' } },
      { id: 'rag-vs-ft', t: 'RAG vs fine-tuning vs neither', d: 'RAG for knowledge that changes or must be cited; fine-tuning for style, format and skills the base model lacks; NEITHER - prompting plus few-shot - whenever the capability is already latent, because the cheapest baseline that works is the right answer in production.', go: { tpl: 'GenAI: RAG Assistant', tab: 'scale', do: 'Read the wall, then argue when you would rip this RAG out for few-shot prompting - and what evidence would justify it.' } },
      { id: 'llm-evals', t: 'Evaluating when there is no single correct answer', d: 'Grade properties and preferences, not string equality: pairwise LLM-as-judge with a written rubric (randomize order - judges have position bias), golden references with semantic scoring, sampled human eval to calibrate the judge, and hard property checks that never lie: citations resolve, JSON parses, no PII.', go: { tpl: 'AI Search (Perplexity)', tab: 'breakdown', do: 'Find what the design promises per answer - every promise is a property check you can automate.' } },
      { id: 'tool-select', t: 'Agent picks the wrong tool 20% of the time', d: 'Build the confusion matrix per tool pair first - wrong-tool errors cluster, they do not spread evenly. The fixes in order of cheapness: rewrite overlapping descriptions so tools stop competing, add few-shot exemplars for the confused pairs, narrow schemas with enums, and shrink the menu - a router that exposes five tools beats a flat list of forty.', go: { tpl: 'Agentic Workflow (Tools)', tab: 'capacity', do: 'Open the Tool Registry 🔍 internals - the schema IS the selection signal. Prove fixes on a labeled turn set before shipping.' } },
      { id: 'prompt-injection', t: 'Detecting injection in an agent with real-world actions', d: 'Treat every tool observation as untrusted input - a scraped page can carry instructions aimed at the loop. Defense in depth: delimit data from instructions, classifiers on the way in AND out, privilege separation (the agent holds capabilities, never credentials), a fail-closed approval gate on anything irreversible, and a red-team suite that runs in CI like any other regression.', go: { tpl: 'Agentic Workflow (Tools)', tab: 'breakdown', do: 'Find the bullet that names observations as untrusted input - then list which of this design\'s actions would sit behind the approval gate.' } },
      { id: 'halluc-triangle', t: 'Low hallucination + low latency + low cost - design it', d: 'The triangle is managed by routing, caching and abstention - never by one big model. Semantic cache so repeats cost zero, a cheap model with an escalation path, retrieve-then-cite with citations forced, an NLI grounding check on the way out, and an abstain path: not-in-context is an ANSWER, and it is the cheapest, fastest, most honest one.', go: { tpl: 'GenAI: RAG Assistant', tab: 'roi', do: 'Price the design per million requests, then say which lever you would pull first and what metric proves it did not hurt quality.' } },
    ],
  },
]

export const MASTERY_TOTAL = MASTERY.reduce((n, a) => n + a.items.length, 0)

export function readMastery() {
  try { return new Set(JSON.parse(localStorage.getItem(MASTERY_STORE) || '[]')) } catch { return new Set() }
}
export function writeMastery(set) {
  try { localStorage.setItem(MASTERY_STORE, JSON.stringify([...set])) } catch { /* private mode */ }
}

// ── inline comparisons ─────────────────────────────────────────────────────
// The concepts above are mostly A-vs-B decisions; the table IS the mastery.
// Keyed by item id; first column is the dimension, the rest are the options.
export const MASTERY_CMP = {
  'sql-nosql': { cols: ['SQL (relational)', 'NoSQL (partitioned)'], rows: [
    ['Data model', 'Tables, joins, schema up front', 'Documents / wide rows, schema per item'],
    ['Transactions', 'ACID across rows and tables', 'Usually per-item; cross-item is your problem'],
    ['Write scaling', 'One leader - a ceiling you feel', 'Horizontal by partition key, near-linear'],
    ['Query flexibility', 'Ask anything, add an index later', 'Design queries first; the key layout IS the API'],
    ['Reach for it when', 'Money, inventory, anything relational', 'Feeds, events, profiles at large scale'],
  ]},
  'partitioning': { cols: ['Vertical (by column/service)', 'Horizontal (sharding)'], rows: [
    ['Splits', 'Different data to different stores', 'Same data across many nodes by key'],
    ['Buys you', 'Isolation, right store per job', 'Write and storage scale without ceiling'],
    ['Costs you', 'Cross-store joins are gone', 'Hot keys, resharding, scatter-gather queries'],
    ['Ceiling', 'The busiest single table remains', 'The hottest single key remains'],
  ]},
  'indexing': { cols: ['Primary', 'Secondary', 'Covering'], rows: [
    ['Locates', 'The row itself (physical order)', 'Row pointers by another column', 'The answer - no row visit at all'],
    ['Write cost', 'Free - it IS the table', 'One extra structure per write', 'Largest: index carries the columns'],
    ['Serves', 'Key lookups and ranges', 'Filters on non-key columns', 'Hot queries worth precomputing fully'],
  ]},
  'consistency': { cols: ['Strong', 'Causal', 'Eventual'], rows: [
    ['A read sees', 'The latest write, always', 'Everything that caused what it sees', 'Some recent-enough state'],
    ['Price', 'Coordination on the write path', 'Session/vector bookkeeping', 'Nearly free'],
    ['Feels wrong when', 'Never - just slower', 'Rarely - replies precede posts, never', 'Your own write vanishes for a moment'],
    ['Fits', 'Balances, inventory, auth', 'Chats, comments, feeds', 'Counters, likes, presence'],
  ]},
  'cache-where': { cols: ['Client (browser)', 'Edge (CDN)', 'Server (Redis)'], rows: [
    ['Serves', 'One user', 'Everyone near a PoP', 'Your whole fleet'],
    ['Latency saved', 'All of it - zero network', 'The ocean crossing', 'The database query'],
    ['Invalidation', 'Cache-Control and prayer', 'Purge broadcast in seconds', 'Delete the key - instant'],
    ['Holds', 'Static assets, API responses briefly', 'Public, shared content', 'Hot rows, sessions, computed views'],
  ]},
  'cache-strategies': { cols: ['Write-through', 'Write-back', 'Write-around'], rows: [
    ['Write path', 'Cache + store, then OK', 'Cache only; store later', 'Store only; cache untouched'],
    ['Write latency', 'Both hops', 'Memory speed', 'Store speed'],
    ['Crash loses', 'Nothing', 'The unflushed window', 'Nothing'],
    ['First read after write', 'Hit', 'Hit', 'Miss - by design'],
    ['Fits', 'The safe default', 'Write-heavy + tolerance for loss', 'Written often, read rarely'],
  ]},
  'cache-eviction': { cols: ['LRU', 'LFU'], rows: [
    ['Drops', 'Longest untouched', 'Least popular overall'],
    ['Bet', 'Recent past predicts near future', 'Popularity is stable'],
    ['Wins on', 'Bursty, shifting workloads', 'Stable hot sets with scans mixed in'],
    ['Fails on', 'One big scan evicts everything hot', 'Yesterday\'s star hogs space today'],
  ]},
  'horizontal': { cols: ['Vertical (bigger box)', 'Horizontal (more boxes)'], rows: [
    ['Cost curve', 'Steepens - big iron is priced like it', 'Near-linear in replicas'],
    ['Ceiling', 'The biggest machine money buys', 'Coordination, not hardware'],
    ['Failure', 'The box IS the outage', 'One replica is a blip'],
    ['Needs', 'Nothing - it just works', 'Stateless services or partitioned state'],
  ]},
  'lb-techniques': { cols: ['Round-robin', 'Least connections', 'Consistent hashing'], rows: [
    ['Sends traffic', 'Next in the circle', 'To the least busy replica', 'Where the key hashes - always'],
    ['Great at', 'Uniform, cheap requests', 'Mixed light/heavy workloads', 'Cache warmth, sessions, shards'],
    ['Blind to', 'Request weight', 'Key affinity', 'Load imbalance between keys'],
    ['On resize', 'Nothing to move', 'Nothing to move', 'Only ~1/N of keys remap'],
  ]},
  'brokers': { cols: ['Queue (SQS/RabbitMQ)', 'Stream (Kafka)'], rows: [
    ['A message is', 'Handed to one consumer, then gone', 'Appended to a log, retained'],
    ['Replay', 'No - ack means delete', 'Yes - rewind any consumer group'],
    ['Consumers', 'Compete for work', 'Each group reads independently'],
    ['Ordering', 'Per queue/group, loosely', 'Strict within a partition'],
    ['Fits', 'Jobs, tasks, one-shot work', 'Events, audit, fan-out, pipelines'],
  ]},
  'cap': { cols: ['Choose C (consistency)', 'Choose A (availability)'], rows: [
    ['During a partition', 'Minority side refuses writes', 'Every side keeps answering'],
    ['You get', 'One truth, always', 'Uptime, always'],
    ['You accept', 'Errors/timeouts for some users', 'Conflicts to reconcile later'],
    ['Lives here', 'Ledgers, inventory, locks', 'Carts, likes, presence, DNS'],
  ]},
  'consensus': { cols: ['Paxos', 'Raft'], rows: [
    ['Famous for', 'Being correct and unteachable', 'Being understandable on purpose'],
    ['Structure', 'Proposers/acceptors, subtle roles', 'One leader with a term + a log'],
    ['You will meet it in', 'Papers and Spanner lore', 'etcd, Consul, everything modern'],
  ]},
  'conflict': { cols: ['Last-write-wins', 'Vector clocks', 'CRDTs'], rows: [
    ['Concurrent writes', 'One silently vanishes', 'Detected - both surface', 'Merge automatically'],
    ['Cost', 'A timestamp', 'A counter map per write', 'Constrained data types'],
    ['Honest use', 'Data you can afford to lose', 'When someone must decide', 'Counters, sets, collaborative docs'],
  ]},
  'redundancy': { cols: ['Active-active', 'Active-passive'], rows: [
    ['Failure looks like', 'Nothing - survivors absorb', 'A pause, then failover'],
    ['Capacity', 'Every replica serves', 'Standby burns money idle'],
    ['Data layer must', 'Tolerate concurrent writers', 'Only replicate one way'],
    ['Fits', 'Stateless tiers, read fleets', 'Single-leader databases'],
  ]},
  'rest-graphql': { cols: ['REST', 'GraphQL'], rows: [
    ['Shape', 'Server decides per endpoint', 'Client asks for exact fields'],
    ['Round-trips', 'One per resource - N+1 lurks', 'One, whatever the depth'],
    ['Caching', 'HTTP/CDN native - a superpower', 'Bring your own, per query'],
    ['Versioning', '/v2 and discipline', 'Deprecate fields in one living schema'],
    ['Fits', 'Public APIs, simple resources', 'Product frontends over deep graphs'],
  ]},
  'pagination': { cols: ['Offset (page=7)', 'Cursor (after=id)'], rows: [
    ['Under inserts', 'Rows shift - duplicates and skips', 'Stable - the cursor pins position'],
    ['DB cost', 'Scans and discards offset rows', 'Index seek, constant-ish'],
    ['Jump to page N', 'Trivial', 'Not really - and feeds never need it'],
  ]},
  'rate-limiting': { cols: ['Token bucket', 'Leaky bucket'], rows: [
    ['Bursts', 'Allowed up to bucket size', 'Smoothed to the drain rate'],
    ['Output', 'Spiky but capped on average', 'Metronome-steady'],
    ['State', 'Tokens + last-refill timestamp', 'A queue with a fixed drain'],
    ['Fits', 'APIs - real traffic is bursty', 'Protecting steady-rate downstreams'],
  ]},
  'authn': { cols: ['Session cookie', 'JWT', 'OAuth 2.0'], rows: [
    ['What it is', 'A pointer to server state', 'A signed, self-contained claim', 'A protocol for delegating access'],
    ['Server keeps', 'The session store', 'Nothing - the token carries it', 'The authorization server does'],
    ['Revocation', 'Delete the row - instant', 'Awkward - expiry or denylist', 'Refresh-token revoke'],
    ['Fits', 'First-party web apps', 'Service-to-service, short-lived', 'Sign in with Google, API grants'],
  ]},
  'metrics': { cols: ['Metrics', 'Traces', 'Logs'], rows: [
    ['Answers', 'Is it healthy? How much?', 'Where did the 800ms go?', 'What exactly happened here?'],
    ['Shape', 'Numbers over time, cheap', 'One tree per request, sampled', 'Text per event, voluminous'],
    ['First reach for', 'Alerts and dashboards', 'Latency archaeology', 'The weird single failure'],
  ]},
  'rag-diagnose': { cols: ['Isolate retrieval', 'Isolate generation'], rows: [
    ['The test', 'Recall@k on labeled query-doc pairs', 'Feed GOLD context by hand, grade faithfulness'],
    ['Failure looks like', 'Right doc absent from top-k', 'Right doc present, answer still wrong'],
    ['Usual culprits', 'Chunking, embedding domain gap, query phrasing', 'Lost-in-the-middle, contradictions, prompt permits guessing'],
    ['Cheapest fixes', 'Hybrid BM25+dense, query rewrite, chunk overlap', 'Reorder context, cite-then-answer, shrink k'],
    ['Prove it worked', 'Recall@k up on a held-out set', 'Faithfulness up at FIXED retrieval - isolate the variable'],
  ]},
  'grounded-halluc': { cols: ['The tell', 'The fix'], rows: [
    ['Position in context', 'Correct doc buried mid-context - models privilege the edges', 'Reorder: strongest evidence first and last'],
    ['Chunk vs answer', 'The chunk MATCHES the query but does not CONTAIN the answer', 'Rechunk around answers; test answer coverage, not similarity'],
    ['Neighbor contradiction', 'Another retrieved chunk disagrees; the model split the difference', 'Dedupe and recency-filter before the prompt'],
    ['Refusal permission', 'The prompt never allowed "not in the context" - so it guessed', 'Make abstention an explicit, rewarded option'],
    ['Format pressure', 'Forced JSON/short schemas manufacture confident guesses', 'Add an explicit unknown field to the schema'],
    ['Prove the fix', 'Faithfulness score on the SAME retrieved contexts, before/after', 'Retrieval held fixed - only generation-side variables moved'],
  ]},
  'agent-loops': { cols: ['Mechanism', 'Prove it holds'], rows: [
    ['Step budget', 'Hard cap per task - the loop exits with its best answer, honestly', 'p100 of steps-per-task pinned in dashboards'],
    ['Spend budget', 'Tokens and currency per task; a runaway dies at its cap', 'Max task cost bounded in the billing export'],
    ['Repeat detector', 'Same tool + args: twice is a nudge, three times ends the task', 'Loop-terminated tasks logged with the repeated call'],
    ['Observation hashing', 'Identical observations collapse - no chasing its own tail', 'Duplicate-observation rate trends to zero'],
    ['Fail-closed exit', 'Exhaustion returns a partial answer + trace, never a hang', 'Zero tasks in RUNNING beyond wall-clock cap'],
  ]},
  'cost-spike': { cols: ['How to check', 'Common cause', 'Fix'], rows: [
    ['Request volume', 'Requests/day vs last week, by client', 'A retry storm - every timeout double-bills', 'Retry budgets + idempotent job ids'],
    ['Tokens in', 'Mean prompt tokens per request, trended', 'Context bloat: k crept up, history replayed whole', 'Retrieval-shaped memory, cap k, trim history'],
    ['Tokens out', 'Mean completion tokens, trended', 'Verbosity drift, no max_tokens discipline', 'Tight max_tokens, terse system prompts'],
    ['Model mix', 'Requests per model per day', 'Router quietly drifting to the expensive tier', 'Routing rules + per-model alerts'],
    ['Cache hit rate', 'Hits over lookups, trended', 'Semantic cache silently stopped matching', 'Alert on hit rate - it is revenue in reverse'],
    ['Prove the fix', 'Cost per 1M requests, trended back to baseline', 'The ONE factor you named moves; the others hold', 'Quality evals flat - savings that cost accuracy are a regression'],
  ]},
  'one-gpu': { cols: ['Design', 'The number you quote'], rows: [
    ['Admission', 'Token bucket at the door: 429 + retry-after beats a silent hang', 'Sustained rps = GPU tokens/s over mean tokens per request'],
    ['Queue', 'Bounded, priority-tiered, wait time shown honestly', 'Wait = depth / drain rate - arithmetic, not vibes'],
    ['GPU serving', 'Continuous batching + paged KV cache (vLLM-class)', '2-4x throughput vs naive static batching'],
    ['Streaming', 'First token early makes the wait feel alive', 'Time-to-first-token becomes the felt latency'],
    ['Degrade ladder', 'Cache, then smaller model, then shorter max_tokens - in order', 'Each rung priced in quality evals BEFORE the incident'],
    ['Prove the design', 'Load test at 1,000 concurrent: p50 wait matches queue arithmetic', 'Zero silent hangs - every rejection is a 429 with retry-after'],
  ]},
  'rag-vs-ft': { cols: ['RAG', 'Fine-tuning', 'Neither (prompt + few-shot)'], rows: [
    ['Choose when', 'Knowledge is fresh, private, or must be cited', 'Style, format, or a skill the base model lacks', 'The capability is already latent'],
    ['Data needed', 'A corpus and labeled retrieval pairs', 'Hundreds+ of quality examples', 'A handful of exemplars'],
    ['Update cost', 'Reindex - minutes', 'Retrain - days and regression risk', 'Edit a prompt - seconds'],
    ['Failure mode', 'Retrieval miss = confident nonsense', 'Catastrophic forgetting; knowledge goes stale anyway', 'Context-window ceiling'],
    ['Prove the choice', 'Groundedness evals vs the prompt baseline', 'Held-out task metric vs the prompt baseline', 'It IS the baseline - beat it or ship it'],
  ]},
  'llm-evals': { cols: ['Use it when', 'Watch out for'], rows: [
    ['Pairwise LLM-as-judge', 'Open-ended quality, A vs B with a written rubric', 'Position bias and self-preference - randomize order, calibrate on humans'],
    ['Golden refs + semantic score', 'Answers cluster around known truths', 'Rewards paraphrase, misses subtle wrongness'],
    ['Sampled human eval', 'Calibrating the judge, high-stakes calls', 'Expensive - sample, never census'],
    ['Property checks', 'Always - citations resolve, JSON parses, no PII', 'Necessary, not sufficient - they catch breakage, not quality'],
    ['Online A/B', 'The metric that matters exists in production', 'Slow, confounded, and users are not a rubric'],
  ]},
  'tool-select': { cols: ['How', 'Prove it'], rows: [
    ['Confusion matrix per tool pair', 'Errors cluster on pairs - fix pairs, not everything', 'Accuracy on a labeled turn set, per pair'],
    ['De-overlap the descriptions', 'Competing descriptions confuse selection; rewrite for contrast', 'The confused pair\'s error rate, before/after'],
    ['Few-shot the confused pairs', 'Two exemplars per ambiguous pair beat a longer system prompt', 'Same labeled set, shadow-run before shipping'],
    ['Narrow the schemas', 'Enums and required fields are selection signals, not just validation', 'Invalid-call rate drops alongside wrong-tool rate'],
    ['Shrink the menu', 'A router exposing 5 beats a flat list of 40', 'Selection accuracy vs menu size - plot it once, cite it forever'],
  ]},
  'prompt-injection': { cols: ['Defense', 'Prove it'], rows: [
    ['Data vs instructions', 'Delimit tool output as untrusted - a scraped page can address the loop directly', 'Canary instructions in test pages never execute'],
    ['Classifiers both ways', 'Injection screens on input, action screens on output', 'Detection rate on a maintained injection corpus'],
    ['Privilege separation', 'The agent holds capabilities, never credentials', 'Compromised-agent tabletop: blast radius stays one sandbox'],
    ['Approval gate', 'Irreversible actions stop for a human; expiry denies - fail closed', 'Zero irreversible actions without an approval record'],
    ['Red-team in CI', 'Known injections run as regressions on every change', 'The suite fails the build when a defense regresses'],
  ]},
  'halluc-triangle': { cols: ['Quality gain', 'What it costs'], rows: [
    ['Semantic cache', 'Repeats answered from a verified past', 'Near zero - it SAVES latency and money'],
    ['Route cheap, escalate', 'Small model screens, big model takes the hard slice', 'Router complexity + a hardness signal'],
    ['Retrieve-then-cite, forced', 'Every claim chained to a source', 'One retrieval hop of latency'],
    ['Grounding check (NLI)', 'Unsupported claims caught on the way out', 'A small model call per answer'],
    ['Abstain path', '"Not in context" replaces the worst hallucinations', 'Product courage - it must count as an answer'],
    ['Prove the triangle', 'Hallucination eval + p95 + cost per 1M on ONE dashboard', 'A lever that moves one without hurting the others is measured, not assumed'],
  ]},
  'latency-ladder': { cols: ['Time', 'What it means'], rows: [
    ['L1 cache reference', '~0.5 ns', 'the speed of thought'],
    ['Main memory read', '~100 ns', '200x L1 - still invisible'],
    ['SSD random read', '~100 us', '1,000x RAM - where \"fast storage\" lives'],
    ['Same-DC round trip', '~0.5 ms', 'the floor under every microservice hop'],
    ['HDD seek', '~10 ms', 'why spinning disks left the hot path'],
    ['Cross-region RTT (US-EU)', '~80 ms', 'physics - no vendor sells around it'],
    ['Cross-region RTT (US-India)', '~200 ms', 'why reads replicate near users'],
  ]},
  'throughput-rules': { cols: ['Per replica', 'The catch'], rows: [
    ['Load balancer', '~100,000 rps', 'pure forwarding - it spreads load, never absorbs it'],
    ['App server', '~2,000 rps', 'CPU-bound work halves it'],
    ['FastAPI (async)', '~2,200 rps', 'IO-bound awaits, not threads - CPU work still halves it'],
    ['Redis cache', '~100,000 rps', 'per node; hot keys concentrate on one'],
    ['SQL database', '~5,000 rps', 'the write ceiling arrives first'],
    ['NoSQL node', '~20,000 rps', 'assumes the key layout was designed for it'],
    ['Kafka partition', '~200,000 msg/s', 'ordering lives inside one partition only'],
    ['LLM worker', '~55 rps', 'rate-limit math, not CPU - the provider is the ceiling'],
  ]},
  'dau-to-rps': { cols: ['Rule', 'Worked example'], rows: [
    ['Seconds per day', '86,400 - call it 10^5', '10M requests/day / 10^5 = ~100 rps average'],
    ['Peak factor', '3-10x average', '100 rps average - provision for ~1,000'],
    ['The anchor number', '1M DAU x 10 actions = ~115 rps', 'memorize this one; scale everything from it'],
    ['Storage per year', 'objects x size x 365 x ~3', '1M photos/day x 2 MB = ~2 TB/day before replicas'],
    ['Read:write ratio', 'often 100:1', 'the entire reason caches exist'],
  ]},
  'nines': { cols: ['Per month', 'Per year'], rows: [
    ['99% (two nines)', '~7.3 hours', '~3.65 days'],
    ['99.9%', '43.2 minutes', '~8.8 hours'],
    ['99.95%', '21.6 minutes', '~4.4 hours'],
    ['99.99%', '4.32 minutes', '~53 minutes'],
    ['99.999%', '~26 seconds', '~5.3 minutes'],
  ]},
  'encryption': { cols: ['In transit (TLS/mTLS)', 'At rest (AES + KMS)'], rows: [
    ['Protects against', 'Eavesdroppers on the wire', 'Stolen disks, leaked snapshots'],
    ['Mechanism', 'Handshake per connection', 'Encrypt on write, keys in a KMS'],
    ['The real question', 'Every hop, or just the edge?', 'Who can touch the keys, and is it audited?'],
  ]},
}

// ── study-session helpers ──────────────────────────────────────────────────
// Shuffled review beats positional memory: a permutation of areas and of the
// items inside each, nothing lost, nothing duplicated (the suite holds us to
// that). UI preferences persist so a study setup survives the tab switch.
export const MASTERY_UI_STORE = 'archsim.mastery.ui.v1'

function fyShuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function shuffleMastery() {
  return fyShuffle(MASTERY).map(area => ({ ...area, items: fyShuffle(area.items) }))
}

export function readMasteryUI() {
  try { return { order: 'shuffle', quiz: false, hideMastered: false, ...JSON.parse(localStorage.getItem(MASTERY_UI_STORE) || '{}') } }
  catch { return { order: 'shuffle', quiz: false, hideMastered: false } }
}
export function writeMasteryUI(ui) {
  try { localStorage.setItem(MASTERY_UI_STORE, JSON.stringify(ui)) } catch { /* private mode */ }
}
