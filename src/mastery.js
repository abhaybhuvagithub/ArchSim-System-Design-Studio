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
      { id: 'vector-db-choice', t: 'Pinecone, Qdrant, Weaviate, Chroma or FAISS - pick, and defend it', d: 'Start from the shape of the problem, not the logo: FAISS is a library for one process and one machine, Chroma is a developer-loop store, Qdrant and Weaviate are self-hosted engines with filters and hybrid search, Pinecone is the managed service you pay to not operate. The questions that decide: filter-heavy or not, tenant isolation model, ops appetite, and whether recall at your scale has been MEASURED rather than assumed.', go: { tpl: 'SaaS AI Copilot (Multi-tenant RAG)', tab: 'capacity', do: 'Select the vector store, open its 🔍 internals and cloud mappings - then say which product you would run at 10 tenants and which at 50,000.' } },
      { id: 'tenant-isolation', t: 'Multi-tenant RAG: one index, zero leakage', d: 'Tenant identity comes from the credential and never from the request body; every vector query carries tenant_id as a database-level filter - namespace or predicate - so foreign chunks are unreachable, not down-ranked. The semantic cache keys on tenant too, deletions propagate to vectors, and a planted canary document per tenant proves nightly that nobody else can retrieve it.', go: { tpl: 'SaaS AI Copilot (Multi-tenant RAG)', tab: 'breakdown', do: 'Read the isolation dive, then find the warn about the cache - the breach nobody expects.' } },
      { id: 'orchestration-frameworks', t: 'LangChain, LangGraph, LlamaIndex - or no framework at all', d: 'Frameworks buy you connectors and a vocabulary; they cost you control over prompts, retries and token accounting. Chains suit linear retrieve-then-answer; graphs (LangGraph-class) suit loops with state and budgets; index-centric libraries suit document-heavy retrieval. The senior answer names the abstraction you need and admits when a hundred lines of plain Python beats a dependency you cannot debug at 3am.', go: { tpl: 'Agentic Workflow (Tools)', tab: 'breakdown', do: 'Map the loop-with-a-budget dive onto a graph framework: which parts are the framework\'s and which must stay yours (budgets, tracing, tool schemas).' } },
      { id: 'autonomous-loops', t: 'Autonomous research: a loop that learns faster than it spends', d: 'When an AI proposes, runs and analyzes its own experiments (the Discovery Loop pattern), the trap is a loop that runs faster than it learns: thousands of experiments in flight, the GPU pool saturated, dashboards green - and the frontier not moving, because results are not feeding back to sharpen the next proposals. Two metrics, tracked separately: utilization proves the machine is busy; convergence proves it is discovering. Optimize the first alone and you have built a very expensive random search. The scheduler must rank by expected information gain per GPU-hour and preempt with checkpoints; the safety gate must bound compute and blast radius upstream of execution; and provenance must pin code, data, seed and parent so any result is reproducible - because when no human watched the run, the pinned trail is the only reason to believe it.', go: { tpl: 'Discovery Loop (Autonomous Research)', tab: 'breakdown', do: 'Read the "loop must converge, not wander" dive, then find the warn about high utilization with no convergence - the failure that looks like success.' } },
      { id: 'halluc-triangle', t: 'Low hallucination + low latency + low cost - design it', d: 'The triangle is managed by routing, caching and abstention - never by one big model. Semantic cache so repeats cost zero, a cheap model with an escalation path, retrieve-then-cite with citations forced, an NLI grounding check on the way out, and an abstain path: not-in-context is an ANSWER, and it is the cheapest, fastest, most honest one.', go: { tpl: 'GenAI: RAG Assistant', tab: 'roi', do: 'Price the design per million requests, then say which lever you would pull first and what metric proves it did not hurt quality.' } },
    ],
  },
  {
    id: 'deploy', icon: '🚀', title: 'Deploy & Migrate',
    flag: "'We will do the migration in the maintenance window' - a system doing thousands of orders a second has no window. And dual-write as a reflex: two writes without a transaction is drift with a schedule.",
    items: [
      { id: 'release-strategies', t: 'Blue-green vs canary vs rolling', asks: "Your release needs zero downtime and a fast rollback - which strategy, and what does it cost you in infrastructure?", d: 'Blue-green runs two full environments and flips a switch: instant cutover, instant rollback, double the capacity bill, and BOTH versions must work against one database at once. Canary sends a slice of real traffic to the new version behind metrics gates - the cheapest honest signal. Rolling replaces instances in place: no second fleet, slowest rollback.', go: { tpl: 'Amazon (marketplace)', tab: 'capacity', do: 'Count the replicas on the app tier - a rolling deploy takes one out at a time; a blue-green needs that many again, idle.' } },
      { id: 'expand-contract', t: 'Zero-downtime schema migration: expand, migrate, contract', asks: "v2 splits a heavy JSON column into a normalized child table with new indexed columns, on a single Postgres primary serving thousands of orders a second - blue-green, zero downtime, no data loss. Walk me through it.", d: 'Expand first: additive, backward-compatible changes only - new tables, nullable columns, indexes built CONCURRENTLY so nothing blocks. Deploy code that reads both shapes behind a feature flag. Backfill in the background, idempotently and throttled. Flip the flag. Contract weeks later, when nothing reads the old column. One source of truth the entire time - that is why the other options lose.', go: { tpl: 'Amazon (marketplace)', tab: 'capacity', do: 'Select the primary store and open its replication controls - now say why a schema-divergent replica cannot be your cutover target.' } },
      { id: 'feature-flags', t: 'Feature flags: deploy is not release', asks: "Why did you ship code that isn't turned on yet?", d: 'Deployment moves bytes; release moves users - flags separate the two. They are what let blue and green coexist on one schema, they turn rollback into a switch flip instead of a redeploy, and they carry debt: every flag needs an owner and an expiry, or the codebase becomes a museum of if-statements.', go: { tpl: 'µsvc: E-commerce (Saga)', tab: 'breakdown', do: 'Find where a compensating step could be flagged off in production without a deploy - that is the operational value of a flag.' } },
      { id: 'backfills', t: 'Backfills that do not take the primary down', asks: "The backfill touches 400 million rows and the primary is serving live traffic - how do you run it?", d: 'Never one UPDATE. Chunk by key range (thousands of rows a batch), throttle on replica lag and CPU, make every batch idempotent so a crash resumes from a checkpoint instead of restarting, and verify with row counts plus sampled diffs before anyone flips a flag. The proof is a flat replica-lag graph across the entire run.', go: { tpl: 'Flipkart (Big Billion Days)', tab: 'capacity', do: 'Note the primary\'s utilization at peak - the backfill must fit in the headroom that is left, not in the headroom you wish you had.' } },
      { id: 'k8s-resources', t: 'Kubernetes resources: requests, limits, and the OOM at 60%', asks: "The pod gets OOM-killed while the node shows 60% memory free - explain, then set requests and limits like you mean them.", d: 'Requests are what the scheduler reserves; limits are where the kernel kills. A pod dies at ITS limit regardless of node headroom - the 60%-free OOM is a per-pod ceiling, not a node problem. CPU limits throttle instead of kill (watch throttle metrics, not just usage), memory limits kill without mercy, and the HPA scales on requests-relative utilization - so wrong requests make autoscaling confidently wrong. Set requests from observed p95, limits with honest headroom, and treat a limit hit as a signal, never a mystery.', go: { tpl: 'Cloud-Native Gateway API Platform', tab: 'capacity', do: 'Replicas here are pods - say what requests/limits you would set from this tier\'s live utilization, and what the HPA target should be.' } },
      { id: 'dual-write', t: 'Dual-write and CDC: the trap and the tool', asks: "Can't we just have the app write to both the old and the new table?", d: 'Two writes from application code cannot be atomic across two shapes: the first succeeds, the second fails, and now you reconcile forever. When two stores must agree, one is the truth and the other follows it - change data capture or the outbox pattern replays committed changes in order. Dual-write is the reflex; CDC is the discipline.', go: { tpl: 'µsvc: E-commerce (Saga)', tab: 'breakdown', do: 'Read how the saga keeps stores consistent without a distributed transaction - the same reason CDC beats dual-write.' } },
    ],
  },
  {
    id: 'networking', icon: '🌐', title: 'Networking',
    flag: "Treating the network as invisible until it is not. Every remote call is a DNS lookup, a handshake, and a congestion-controlled stream wearing a function call's costume - and the tail latency you cannot explain usually lives in one of those three.",
    items: [
      { id: 'dns', t: 'DNS: the first hop of every request', asks: "Your service migrated to new IPs an hour ago and half the traffic is still hitting the old ones - explain, and tell me what you should have done last week.", d: 'Resolution walks root -> TLD -> authoritative, but almost every answer comes from a resolver cache governed by TTL - DNS is a distributed cache wearing a phone book\'s costume. Migrations are TTL choreography: lower it days ahead, move, restore. And DNS is a failover tool with honest limits: clients and resolvers cache beyond your TTL, so it steers new connections, never in-flight ones.', go: { tpl: 'URL Shortener (Bitly)', tab: 'hld', do: 'Look at the request anatomy - hop zero (the lookup) happens before your first box, and its cache is not yours to flush.' } },
      { id: 'tcp-udp', t: 'TCP vs UDP - and why QUIC exists', asks: "Voice calls stutter on TCP but file downloads corrupt on UDP - reconcile those, then tell me what HTTP/3 chose and why.", d: 'TCP sells ordered, reliable bytes and charges for it: handshakes, retransmits, and head-of-line blocking where one lost packet stalls everything behind it. UDP sells nothing and charges nothing - perfect when late data is worthless (voice, games) and the application brings its own recovery. QUIC is the synthesis: reliability per-stream over UDP, so one lost packet stalls one stream, not the connection - which is why HTTP/3 lives on it.', go: { tpl: 'Chat (WhatsApp)', tab: 'breakdown', do: 'Find where ordering matters per conversation but not across them - the same per-stream insight QUIC ships in the transport.' } },
      { id: 'tls', t: 'TLS: the handshake you pay for', asks: "p99 to a cold region is 300ms before a byte of payload moves - account for every round trip, then remove some.", d: 'A fresh TLS 1.3 connection costs one round trip after TCP\'s one (older stacks paid more), and cross-region that is real money: 2 x RTT before hello. The levers: keep connections alive and pooled, resume sessions (0-RTT for idempotent requests), and terminate TLS where it helps - at the edge for user latency, re-encrypted inside for zero-trust. mTLS adds client certificates so services prove themselves both ways; the mesh usually carries the certificates so application code never does.', go: { tpl: 'Netflix', tab: 'scale', do: 'The CDN lever is also a TLS lever - termination at the edge turns a cross-ocean handshake into a metro one.' } },
      { id: 'http-versions', t: 'HTTP/1.1 vs 2 vs 3 - what actually changed', asks: "The frontend team says upgrading to HTTP/2 made the API faster without touching the API - what did they actually buy, and where does it stop helping?", d: 'HTTP/1.1 pays one request at a time per connection (browsers hack around it with six parallel sockets). HTTP/2 multiplexes many streams over one TCP connection - the win the frontend felt - but inherits TCP head-of-line: one lost packet stalls every stream. HTTP/3 moves the streams onto QUIC so loss stalls only its own stream. Server-to-server, gRPC rides HTTP/2 for the same multiplexing; the version you speak is a latency decision, not a fashion one.', go: { tpl: 'AI Search (Perplexity)', tab: 'breakdown', do: 'Streamed answers are chunked responses - say which HTTP feature carries them and what a proxy must not do to the stream.' } },
      { id: 'os-limits', t: 'OS limits: file descriptors, ports, and TIME_WAIT', asks: "At 30,000 concurrent connections the service starts throwing 'too many open files', and an hour later 'cannot assign requested address' - two different walls; name both and raise them.", d: 'Every socket is a file descriptor, and the default ulimit (often 1024) was set for a gentler internet - the first wall is per-process fd limits, raised in systemd and sysctl. The second is client-side: an outbound connection consumes an ephemeral port per (src, dst) pair, closed sockets linger in TIME_WAIT, and a chatty non-pooled client exhausts ~28K ports in minutes - the fix is connection pooling and keep-alive, not a bigger port range alone. Linux is part of the design; the roadmap was right.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'capacity', do: 'Every held connection during a slow LLM call is one fd and one worker - connect this concept to the one-GPU admission-control drill.' } },
    ],
  },
  {
    id: 'testing', icon: '🧪', title: 'Testing & Quality',
    flag: "'We test everything in staging before deploy' - a shared staging for dozens of teams is a queue with opinions, and a suite that is green-but-flaky trains engineers to click retry, which is exactly how the real break ships.",
    items: [
      { id: 'testing-pyramid', t: 'The pyramid, for a distributed system', asks: "Dozens of payment microservices, async events plus HTTP, teams need fast CI and no downstream surprises - full e2e against shared staging is slow and flaky. Pick the testing strategy and defend it.", d: 'The pyramid is a statement about feedback latency versus realism. Fast unit and component tests answer in seconds; consumer-driven contracts verify every service seam without booting the neighbours; ephemeral environments make true end-to-end a periodic, owned exercise instead of a per-merge lottery; and canaries with real observability catch the class of failure no pre-production test can. The gate is layered - not one giant flaky door.', go: { tpl: 'µsvc: E-commerce (Saga)', tab: 'breakdown', do: 'Count the service seams in the saga - each arrow is a contract that can drift; that number is why e2e-everything cannot be the gate.' } },
      { id: 'contract-testing', t: 'Consumer-driven contracts (Pact)', asks: "How do you know your change will not break a downstream consumer - without running all of them?", d: 'The consumer writes down exactly what it needs from the provider - endpoints, fields, event shapes - and that expectation file is verified in the PROVIDER\'s CI on every change. A broker records which versions are compatible, and can-i-deploy becomes a query instead of a prayer. Async events get the same discipline as message contracts. The seam is tested; the neighbours stay off.', go: { tpl: 'UPI Switch (NPCI)', tab: 'breakdown', do: 'Every bank integration on this switch is a contract surface - imagine verifying a bank change without the bank in the room; that is the broker\'s job.' } },
      { id: 'test-doubles', t: 'Mocks, stubs, fakes - and when they lie', asks: "The suite is green and production is down. What did the mocks hide?", d: 'A double encodes an assumption, and assumptions drift. Mocks that assert call shapes test your imagination of the dependency; prefer fakes - real in-memory implementations - for stores and queues, and pin every double to a contract or a recorded interaction so drift fails a build instead of a customer. The rule: a double may simplify reality, never contradict it.', go: { tpl: 'Card Payments (Auth + Settlement)', tab: 'breakdown', do: 'Find the stand-in path - production itself runs a controlled double when the issuer is slow; the test double must match that contract, not a happy-path fantasy.' } },
      { id: 'ephemeral-envs', t: 'Ephemeral environments beat shared staging', asks: "Staging has been broken for three days and nobody knows whose change did it. What now?", d: 'That is not an incident, it is the architecture: a shared environment is a contended singleton with unowned state. Spin environments per branch - namespaced, seeded, torn down on a TTL - so every team debugs its own reality. Keep one long-lived environment only for what genuinely cannot be duplicated (third-party sandboxes), and treat its breakage as a paged incident with an owner.', go: { tpl: 'Cloud-Native Gateway API Platform', tab: 'capacity', do: 'Read the platform tiers and ask: which of these could a per-branch namespace stamp out in five minutes, and which is the one shared sandbox worth an on-call?' } },
      { id: 'flaky-tests', t: 'Flakiness is a reliability bug, not a nuisance', asks: "The suite is only 2% flaky - why are you treating it as an emergency?", d: 'Two percent per test compounds: fifty flaky tests make most runs red for no reason, engineers learn to click retry, and the one honest red ships to production inside the noise. Run a quarantine lane with a burn-down, budget flakes like errors, and hunt the classic sources - wall clocks, shared ports, test order, sleeps standing in for synchronization. Determinism is a feature you build.', go: { tpl: 'Chat (WhatsApp)', tab: 'chaos', do: 'Inject latency and watch ordering wobble - every nondeterminism you can inject here is one your tests must either control or tolerate.' } },
    ],
  },
  {
    id: 'analytics', icon: '📊', title: 'Analytics & Data Platform',
    flag: "'Point the BI tool at the production replica' - the analyst's full-table scan and the checkout query must not share a fate. And a metric defined in four dashboards is four metrics wearing one name.",
    items: [
      { id: 'oltp-olap', t: 'OLTP vs OLAP: rows for transactions, columns for questions', asks: "The CFO's dashboard is timing out against the orders database. Walk me through what you change - and what you refuse to change.", d: 'Row stores serve transactions: fetch one order, all its fields, guarded by indexes. Analytics asks the opposite - two columns across a billion rows - and a columnar store reads exactly those two, compressed, in parallel. The design is not either/or: OLTP keeps the writes, a pipeline replicates into the columnar side, and the refusal is the point - BI never queries the primary, however urgent the CFO sounds.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'breakdown', do: 'Find where the row world hands off to the column world - that boundary is the whole answer to the dashboard question.' } },
      { id: 'pipelines-elt', t: 'ETL vs ELT, and pipelines that rerun', asks: "Yesterday's load double-counted revenue after a retry. Fix the pipeline, not the number.", d: 'A pipeline that cannot rerun is a pipeline that lies under failure. Load raw first (ELT), transform inside the warehouse with versioned SQL, and make every load idempotent - merge on natural keys or overwrite whole partitions, so a retry lands the same rows once. Late data gets a window and a rule, and a backfill is just a rerun over an older range, never a hand-patched UPDATE.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'scale', do: 'Read the ladder for where transform moved into the warehouse - then say which loads must be partition-overwrites and why a retry is now boring.' } },
      { id: 'warehouse-modeling', t: 'Facts, dimensions, and slowly changing truth', asks: "A customer moved cities in March. Do last year's orders move with them?", d: 'No - and the schema must make that impossible to get wrong. Facts are immutable events at a declared grain; dimensions describe the world and change slowly. SCD Type 2 keeps every version of the customer with validity ranges, so last year\'s orders join to last year\'s city and this quarter\'s join to the new one. Declare the grain first; every modeling argument afterwards is really an argument about the grain.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'breakdown', do: 'Locate the dimension tables in the model and ask each one: what happens here when the truth changes on Tuesday?' } },
      { id: 'metrics-layer', t: 'One metric, one definition', asks: "Two dashboards disagree on yesterday's revenue. Which one is right?", d: 'Both - each faithfully computes a different definition, and that is the disease. A metrics layer defines revenue once - filters, grain, currency, timezone - and every dashboard, notebook and API queries THAT, not its own SQL. Definitions change by review like code, with version history, so when the number moves the first question is which definition moved, answered in one place.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'roi', do: 'The ROI panel is a metric with a stated basis - notice how much of its trustworthiness is the definition being written down next to the number.' } },
      { id: 'data-mesh', t: 'Data Mesh: domains own their data as a product', asks: "Sales, Billing and Marketing all wait on one central nightly ETL - stale data, a queue of requests, pipelines that fail unpredictably. Redesign it so it scales as domains onboard, without building a new bottleneck.", d: 'The central warehouse is not a technology problem, it is an org chart problem wearing a pipeline: one team is the write path for everyone, so it is the queue and the outage for everyone. Data Mesh inverts ownership - each domain publishes its own data as a versioned, contract-first PRODUCT on an async stream, and consumers subscribe to the stable contract instead of filing a ticket. The platform stays central but changes job: it stops being the ETL team and becomes the paved road - stream infra, a schema registry, the metadata catalog, lineage, automated quality gates, and the SLAs that make a data product trustworthy. Governance goes federated: global rules (PII, retention, interoperability) enforced by the platform, local decisions (schema, grain, semantics) owned by the domain. The trap the pattern must not become: a mesh with no platform is just data chaos with a manifesto, and a platform that reviews every publish is the central bottleneck with extra steps.', go: { tpl: 'µsvc: Event-Driven Orders', tab: 'breakdown', do: 'Read how producers and consumers decouple through the log - a data product is that same contract, versioned and owned by the domain instead of the platform.' } },
      { id: 'experiments', t: 'A/B testing as a system', asks: "Design the experimentation platform - and tell me what SRM is before I have to ask.", d: 'Assignment is deterministic - hash(unit id, experiment salt) - so a user sees one arm forever with no coordination. Exposure is logged at the decision point, because intent-to-treat starts there, not at login. Sample-ratio mismatch is the canary: if the split is 50/50 by design and 52/48 by count, the experiment is invalid before any stats run. The stats engine joins exposures to metrics from the SAME metrics layer - an experiment platform with its own revenue definition is two experiments.', go: { tpl: 'News Feed (Instagram)', tab: 'breakdown', do: 'Pick one ranking change on this feed and narrate its experiment: unit, assignment, exposure point, guardrail metrics - in that order.' } },
    ],
  },
  {
    id: 'fde', icon: '🤝', title: 'FDE & Customer Engineering',
    flag: "'I will tell engineering to build it' - the FDE owns the outcome: understand the business requirement, exhaust configuration and integration, then carry a documented case to product. And never blame another team in front of the customer.",
    items: [
      { id: 'customer-discovery', t: 'Discovery before design', asks: "'We need your platform integrated with our HR system.' What do you ask before you draw a single box?", d: 'The amateur draws Kafka; the FDE asks questions until the shape of the problem appears. Business outcome first - who consumes this and why. Then traffic (batch or realtime, peak not average), data (schema, size, PII, retention), the integration surface they can actually offer, the security regime you must live inside, and the reliability numbers they will sign. Every answer removes an architecture; what survives is the design.', go: { tpl: 'SaaS AI Copilot (Multi-tenant RAG)', tab: 'breakdown', do: 'Read the scope and NFRs as discovery ANSWERS - then reconstruct the questions that must have produced them.' } },
      { id: 'integration-surfaces', t: 'The six doors into an enterprise', asks: "The customer offers a nightly SFTP drop and a webhook. Which do you build first - and how does each stay honest?", d: 'Enterprises expose what they have: REST when there is an API team, webhooks when they can push, SFTP when there is a mainframe in the story, database pulls when there is nothing else, and an event bus when you are lucky. Build the surface that unblocks value soonest (usually the drop), design the contract for the one you want long-term, and give every surface the same honesty kit: schema validation at the door, idempotent ingestion, a dead-letter path, and per-source lag metrics.', go: { tpl: 'UPI Switch (NPCI)', tab: 'breakdown', do: 'Count the integration contracts this switch holds with banks - then name the honesty kit each one carries.' } },
      { id: 'env-debug-ladder', t: 'Works on my machine, fails in theirs', asks: "Your service works from your environment but cannot reach the customer's database. Go.", d: 'Climb in order and say each rung out loud: DNS resolves to what you expect? A route exists and the firewall permits it? The security group opens that port from YOUR subnet? TLS completes - full chain, right SNI? Credentials authenticate? THEN the application. Each rung has a two-line check and rules out a family of causes; skipping rungs is how engineers spend a day inside the wrong layer. Works-from-Postman-on-their-laptop proves their side of the wall, not yours.', go: { tpl: 'Cloud-Native Gateway API Platform', tab: 'chaos', do: 'Run the TLS incident in 🚨 Incident Mode - the mobile-vs-browser asymmetry is this ladder, rung four.' } },
      { id: 'poc-vs-production', t: 'The POC and what it must never pretend', asks: "The POC wowed them. What changes before it takes production traffic - and what must not change?", d: 'A POC exists to answer one question fast, and over-engineering it is a failure. What must not change is the truth of the demo: real integration shape, real data shapes, honest limits stated. What must change for production: identity (SSO, not a shared key), secrets out of configs, deployment repeatable from zero, observability before traffic, and the load and failure tests the POC skipped on purpose. The FDE names that gap in the demo itself - it builds trust and books the next meeting.', go: { tpl: 'GenAI: RAG Assistant', tab: 'scale', do: 'The ladder IS the POC-to-production story - read rung one as the demo and rung three as the contract.' } },
      { id: 'comms-levels', t: 'One problem, four rooms', asks: "Explain the same Kafka consumer lag to the engineer, the engineering manager, the CTO, and the customer executive.", d: 'Same truth, different resolution. Engineer: partitions, drain rate, the command to run. EM: scope, owner, ETA, customer impact. CTO: the architectural cause and the prevention that makes it structural. Executive: what it means for their business, what we did, why it will not recur - zero jargon, zero blame. The discipline is that all four are TRUE simultaneously; the failure is telling the executive the engineer version, or the engineer the executive version.', go: { tpl: 'Zomato', tab: 'chaos', do: 'Run the dinner-rush incident in 🚨 Incident Mode and read its four comms tabs - then write the fifth: the support-team version.' } },
      { id: 'deployment-runbook', t: 'The customer deployment runbook', asks: "Walk me through your customer deployment runbook - the artifact, not the vibes.", d: 'A runbook is a sequence of exit criteria, not a to-do list. Discovery exits with signed requirements and SLOs; security review exits with an approved data-flow diagram; network validation exits with the debug ladder green from THEIR environment; integration exits with contract tests passing both directions; load and SLO validation exits with the simulator numbers reproduced in staging; cutover exits with rollback rehearsed, not described; handover exits when their on-call closes an injected incident without you. Each stage owns its evidence.', go: { tpl: 'Card Payments (Auth + Settlement)', tab: 'slo', do: 'The SLO tab is stage five of the runbook - decide what number would let you sign the exit criterion.' } },
    ],
  },
  {
    id: 'iam', icon: '🔐', title: 'Identity & Access (IAM)',
    flag: "'The token is valid, so the user is allowed' - authentication is not authorization, and the day you conflate them is the day a logged-in intern reaches payroll. And the leaver nobody deprovisioned is a breach with a start date.",
    items: [
      { id: 'authn-authz', t: 'AuthN vs AuthZ: two questions, two owners', asks: "A logged-in user hits an endpoint they should not reach. Whose bug is it - the login system's or the app's?", d: 'The app\'s. Authentication answers "who are you" and belongs to the identity provider; authorization answers "what can you do" and belongs to the application reading the claims. The token is the contract between them: the IdP signs identity in, the app decides access out. Conflating them - trusting that a valid token implies permission - is the root of a whole family of access bugs, because a perfectly authenticated user can still be authorized for nothing.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'breakdown', do: 'Read the AuthN/AuthZ dive - note which side owns the token and which side owns the decision.' } },
      { id: 'oauth-oidc', t: 'OAuth is authorization; OIDC is login', asks: "Can I just use OAuth 2.0 to log users in?", d: 'Not on its own. OAuth 2.0 is a delegated-authorization framework - it answers "can this app access that resource" and hands back an access token, with no standard notion of who the user is. OIDC is the identity layer built on top: it adds an ID token (a JWT with iss, sub, aud, exp) that answers "who logged in". Using a raw OAuth access token as proof of identity is the classic mistake - the token was minted to open an API, not to attest a person, and treating it as login is how confused-deputy bugs slip in.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'breakdown', do: 'Find the ID-token-vs-access-token split and say which one an API should trust for identity, and which for access.' } },
      { id: 'saml-oidc', t: 'SAML vs OIDC: bridging two eras', asks: "Half our apps are modern and half are 15-year-old enterprise SaaS. One identity for both - how?", d: 'A broker that speaks both. OIDC is JSON/JWT, modern, simple, great for web/mobile/API; SAML is XML assertions, older, and still everywhere in enterprise SaaS. You do not force the business to wait for a vendor to modernize - the IdP federates to new apps by OIDC and to legacy apps by SAML from the same identity, and the employee never knows which protocol carried their login. Both are excellent at browser SSO; the difference is format and era, not capability.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'breakdown', do: 'Locate the federation broker in the design - one identity, two protocols out.' } },
      { id: 'token-validation', t: 'Validating tokens: local JWT vs introspection', asks: "Does your API call the identity provider on every request to check the token? Defend your answer.", d: 'No - it validates the signature locally against the IdP\'s public keys (JWKS), cached, on the hot path. Calling the IdP to introspect every token makes identity a latency tax and an availability dependency on every single request. The trade is revocation immediacy: a locally-validated JWT stays valid until it expires, so you keep lifetimes short and lean on refresh tokens as the real revocation lever. Introspection is the deliberate exception, reserved for the narrow flows where a token must die the instant it is revoked.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'capacity', do: 'Select the signing-keys and gateway tiers and argue why local validation, not a call home, is what lets this survive its own request volume.' } },
      { id: 'zero-trust', t: 'Conditional access: login as a decision', asks: "Design login so a password from an unmanaged device in a new country does not just sail through.", d: 'Make authentication a decision, not a gate. Conditional access weighs identity plus context - who, what device, what location, what risk score, which app - and returns allow, step-up MFA, or block. This is the mechanics of zero trust: never a trusted network perimeter, always identity-plus-context-plus-policy evaluated every time. MFA lives at the IdP so every federated app inherits it, and step-up asks for the second factor only when the signal warrants, so the safe common case stays fast and the risky case gets friction.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'breakdown', do: 'Read the conditional-access dive and trace one risky sign-in to its step-up-MFA outcome.' } },
      { id: 'sso-at-scale', t: 'Enterprise SSO for a million employees', asks: "Build SSO for 1M employees across 500 apps: OIDC, SAML, MFA, RBAC, zero-trust - and it can never be the reason work stops.", d: 'This is the load-bearing wall: one identity per human, 500 relying parties, and an availability target worthy of the company\'s most concentrated dependency. The moving parts: a broker fronting OIDC and SAML; MFA and conditional access at the IdP; tokens validated locally against rotating JWKS; PKCE on public clients; SCIM provisioning AND deprovisioning; immutable sign-in audit. And the questions that separate senior from staff: where tokens live, how logout and revocation actually work across 500 apps, how keys rotate without dropping a login, what happens the instant a user is disabled, and how the front door itself stays up - because when SSO is the single point of failure, its resilience is the enterprise\'s resilience.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'scale', do: 'Walk the ladder to 1M and name the wall - why the single front door is also the single point of failure, and what that demands.' } },
    ],
  },
  {
    id: 'data-eng', icon: '🔧', title: 'Data Engineering Toolkit',
    flag: "'We use Spark for everything' - reaching for a distributed cluster to process a gigabyte is as wrong as reaching for Pandas to process a petabyte. The skill is not knowing tools, it is knowing which combination fits the data's size, shape and freshness.",
    items: [
      { id: 'processing-engine', t: 'Pandas, Spark, or streaming: sizing the engine to the data', asks: "A job processes a few GB today and will hit multiple TB next year. What do you run it on now, and what changes when it grows?", d: 'The engine is chosen by data size and latency need, not by fashion. A few gigabytes fit in memory on one machine - Pandas is faster and simpler, and a Spark cluster would spend more time coordinating than computing. At tens of gigabytes to petabytes, no single machine holds the data, so PySpark distributes it across a cluster. When the data never stops arriving, batch gives way to streaming (Spark Structured Streaming, Flink). The senior move is matching the tool to the workload and knowing the thresholds where you graduate from one to the next - Pandas to Spark to streaming.', go: { tpl: 'Databricks (Lakehouse Compute)', tab: 'breakdown', do: 'Read the driver/executor dive - that is what PySpark buys you over Pandas, and the shuffle is what it costs.' } },
      { id: 'batch-vs-stream', t: 'Batch vs streaming, and the pipelines that rerun', asks: "The business wants 'real-time' dashboards. When is that worth a streaming pipeline, and when is a scheduled batch job the right call?", d: 'Batch processes bounded chunks on a schedule (Airflow triggering Spark or SQL): simple, cheap, easy to reprocess, minutes-to-hours fresh. Streaming processes unbounded data as it arrives (Kafka + Spark Streaming or Flink): complex and always-on, but seconds fresh. Most "real-time" requirements are actually "fresher than nightly" and a frequent batch is the honest, cheaper answer; true streaming is for when seconds genuinely matter. Either way the pipeline must be idempotent and rerunnable - a job that cannot be safely re-run is a job that lies under failure.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'scale', do: 'Find on the ladder where batch transforms move into the warehouse - then decide which of your loads truly need streaming, not just frequent batch.' } },
      { id: 'orchestration', t: 'Orchestration: turning scripts into pipelines', asks: "You have ten scripts that must run in order, some in parallel, with retries and alerting. What turns that from cron chaos into a pipeline?", d: 'An orchestrator (Apache Airflow the canonical one) models work as a DAG - a directed graph of tasks with dependencies - so it runs steps in the right order, parallelizes what it can, retries failures, backfills history, and alerts when something breaks. Python defines the DAG; Airflow schedules and monitors it. Cron runs a command at a time; an orchestrator runs a dependency graph with observability, which is the difference between a pipeline and a pile of scripts that mysteriously stopped last Tuesday.', go: { tpl: 'Data Platform (Lakehouse)', tab: 'breakdown', do: 'Trace the pipeline stages and read each dependency edge as a DAG edge an orchestrator would enforce and retry.' } },
      { id: 'cdc-ingestion', t: 'Getting data in: CDC and ELT ingestion', asks: "You need a source database's changes in the warehouse continuously, without hammering the source or writing brittle dual-writes. How?", d: 'Two patterns move data in. Change Data Capture (Kafka + Debezium) taps the source database\'s write-ahead log and streams every insert/update/delete downstream - the source barely notices, and it is the disciplined alternative to dual-writes. ELT ingestion (Airbyte into Snowflake) extracts from many sources and loads raw first, transforming inside the warehouse afterward. CDC is for low-latency change streams off transactional stores; ELT connectors are for bulk syncing many sources - and both beat the reflex of application code writing to two places and reconciling forever.', go: { tpl: 'Snowflake (Cloud Warehouse)', tab: 'breakdown', do: 'The warehouse is the load target - picture Airbyte landing raw tables here and dbt transforming them in place (ELT), versus CDC streaming changes in continuously.' } },
      { id: 'lakehouse-formats', t: 'Table formats: making a data lake behave', asks: "Your data is cheap files in object storage, but analysts need transactions and time travel. What turns a lake into a lakehouse?", d: 'Raw files in a bucket (S3) have no transactions - concurrent writes corrupt each other and there is no schema police. An open table format (Delta Lake, Apache Iceberg) adds a transaction log over those files, giving the cheap lake ACID transactions, time travel, schema evolution and safe concurrent writes - warehouse guarantees at lake prices. Spark or a warehouse engine reads and writes the format; the format is what makes S3 + Iceberg a real table rather than a folder of parquet you hope nobody writes to twice at once.', go: { tpl: 'Databricks (Lakehouse Compute)', tab: 'breakdown', do: 'Read the transaction-log dive - Delta and Iceberg are that same idea, and it is the whole difference between a lake and a lakehouse.' } },
      { id: 'analytics-engineering', t: 'Analytics engineering: dbt, SQL, and version control', asks: "Your warehouse transformations are a pile of hand-run SQL nobody can reproduce or review. How do you make analytics behave like software?", d: 'Analytics engineering brings software discipline to warehouse SQL. dbt turns transformations into version-controlled, tested, documented SQL models with dependency graphs - SQL + dbt for the transformations, Git + dbt so every change is reviewed and reproducible, Airflow + dbt so they run on schedule. The result: a transformation you can diff, test, roll back and trace, instead of a query someone ran once in a console and cannot recreate. It is the metrics-layer discipline applied to the whole transformation pipeline - defined once, in code, reviewed like code.', go: { tpl: 'Snowflake (Cloud Warehouse)', tab: 'breakdown', do: 'The warehouse runs these models - picture dbt as versioned SQL transforming the shared tables, reviewed in Git before it ever runs.' } },
    ],
  },
  {
    id: 'eng-lead', icon: '🎖️', title: 'Engineering Leadership (Technical)',
    flag: "'I made a hundred decisions this quarter' - decision velocity is not judgment. The score is whether the IRREVERSIBLE calls were right, and whether anyone but you knows why any of them were made.",
    items: [
      { id: 'one-way-doors', t: 'Reversible vs irreversible decisions (two-way vs one-way doors)', asks: "How do you decide how much rigor and how many people a technical decision deserves before you make it?", d: 'The most important judgment skill is sorting decisions by reversibility. A two-way door is cheap to undo - a feature flag, a cache policy, a retryable job - so decide fast, delegate freely, and correct later if wrong; agonizing over it is its own waste. A one-way door is expensive or impossible to reverse - a data model, a public API contract, a core dependency, a security posture, an on-chain transfer - so slow down, pull in the right people, and get it right, because there is no cheap undo. Senior engineers and EMs are not judged on how many decisions they made but on whether they applied the right rigor to the right ones: fast where it is safe, careful where it is forever.', go: { tpl: 'Coinbase (Crypto Exchange)', tab: 'breakdown', do: 'Read the custody dive - an on-chain transfer is the ultimate one-way door, and the whole design bends to its irreversibility.' } },
      { id: 'build-buy-adopt', t: 'Build vs buy vs adopt', asks: "A vendor sells what you were about to build, and an open-source project does most of it too. How do you choose?", d: 'The rule is: build only your differentiator, buy or adopt everything else. Build when the thing IS your competitive moat and you need full control - and accept you own the code and the operations forever. Buy a vendor for undifferentiated heavy lifting you do not want to run, accepting a bill that scales and some lock-in. Adopt open source for a common need you can actually operate, accepting that you own the operational burden even though the code is free. The two classic mistakes: pouring engineering into undifferentiated infrastructure someone would have sold you, and adopting a framework or system you cannot evaluate or run at 3am - a dependency you cannot debug is not a decision, it is a liability.', go: { tpl: 'Enterprise SSO (Entra/Okta)', tab: 'breakdown', do: 'This template builds identity in-house; ask what it would take to buy it instead, and when consuming an IdP is the right call over rolling your own auth.' } },
      { id: 'technical-risk', t: 'Pre-mortems and blocker removal', asks: "How do you manage technical risk on a project so it surfaces as an assumption to test, not an incident in production?", d: 'Amateurs manage risk reactively - they find out what was fragile when it breaks in production. The senior move is the pre-mortem: assume the project already failed, and work backwards to why, so the riskiest assumption is named and tested FIRST instead of discovered last. The corollary is unblocking: a leader\'s job is to see the blockers coming and clear them ahead of the team, not to watch the team stall and then react. Identify the one thing most likely to sink the project, prove or disprove it early, and remove obstacles before they cost a sprint - risk you tested is cheap, risk you discovered is an incident.', go: { tpl: 'Card Payments (Auth + Settlement)', tab: 'chaos', do: 'Open Incident Mode here - a pre-mortem is exactly this: running the failure that would hurt most, before a customer does.' } },
      { id: 'disagree-commit', t: 'Disagree and commit; deciding with incomplete information', asks: "Your team is split on an architecture, you cannot get consensus, and a call has to be made now. What do you do?", d: 'Consensus is wonderful when the decision is reversible and there is time to align - and a trap when it becomes analysis paralysis on a call that must be made. When the team is genuinely split and waiting costs more than deciding, the leader makes the call, owns it, and asks even those who disagreed to commit fully to executing it - because a team that half-executes the decision it lost guarantees the decision fails. The discipline that makes this safe: document why (so it can be revisited with evidence, not re-litigated by memory), and where you can, shape the decision to be a two-way door so being wrong is cheap. Deciding with incomplete information is the job; refusing to decide is the failure.', go: { tpl: 'PostgreSQL at Scale (Primary + Replicas)', tab: 'scale', do: 'The "second primary vs shard" call has no clean consensus - it is exactly a disagree-and-commit moment: pick, document why, and move.' } },
      { id: 'adrs', t: 'Decision records: making the "why" outlive you', asks: "Six months from now, how does the team remember WHY it chose this architecture - after the people who chose it have moved on?", d: 'Every architecture carries decisions whose reasons evaporate the moment the person who made them leaves, and a team that cannot remember why it did something re-litigates settled questions forever and fears changing anything it does not understand. An Architecture Decision Record fixes this cheaply: a short, versioned document capturing the context, the decision, its status, and its consequences - so a new hire reads the trail instead of re-opening the debate, and a future change is made with eyes open. It is the same append-only-trust-chain shape this studio uses for money and for experiment provenance, pointed now at decisions: the reasoning is an artifact, not folklore.', go: { tpl: 'Discovery Loop (Autonomous Research)', tab: 'breakdown', do: 'Read the provenance dive - it pins why each experiment ran; an ADR does exactly that for an architecture decision.' } },
      { id: 'depth-breadth', t: 'Technical depth vs breadth as you grow', asks: "Moving from senior IC to Staff or EM, how technical should you stay, and what changes about how you use it?", d: 'The IC-to-leader transition trades hands-on depth for architectural judgment and leverage: a senior IC is valued for solving the hard problem personally, a Staff engineer or EM for asking the question that unlocks the team and making the calls no one else can. But the trap on each side is real - an IC who never scales beyond their own hands caps their impact, while a leader who loses the depth to actually evaluate a hard technical decision becomes a non-technical technical leader, rubber-stamping choices they cannot judge. The target is enough depth to make and evaluate the irreversible calls, spent on breadth and leverage rather than on being the one whose hands are on every keyboard.', go: { tpl: 'Amazon (marketplace)', tab: 'breakdown', do: 'Skim the entire breakdown - a technical leader must be able to judge all of this soundly without having personally built each piece.' } },
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
  'vector-db-choice': { cols: ['Best when', 'Watch out for', 'Prove the choice'], rows: [
    ['FAISS (library)', 'One process, one machine, offline or research', 'No server, no filters, no persistence story', 'Recall@k on your data vs a hosted engine'],
    ['Chroma', 'Developer loop, prototypes, small corpora', 'Scale and multi-tenant story are thin', 'Latency and recall at 10x your current corpus'],
    ['Qdrant / Weaviate (self-hosted)', 'Filter-heavy retrieval, hybrid search, own your data', 'You operate it: upgrades, backups, shard rebalancing', 'p99 under filters at production tenant counts'],
    ['Pinecone (managed)', 'Ops appetite is zero and the bill is acceptable', 'Vendor lock and per-vector pricing at scale', 'Cost per million queries vs a self-hosted equivalent'],
    ['Postgres pgvector', 'Vectors live next to the rows they describe', 'HNSW index build time and memory on the primary', 'Recall and QPS with the filter your product actually uses'],
  ]},
  'tenant-isolation': { cols: ['Enforcement', 'Prove it'], rows: [
    ['Identity', 'Tenant from the credential at the gateway - never from the body', 'A request that spoofs tenant_id in the body is ignored, logged, alarmed'],
    ['Retrieval', 'tenant_id as a database-level filter: namespace or predicate', 'Canary document per tenant; nightly cross-tenant query returns silence'],
    ['Cache', 'Semantic cache keyed by tenant', 'Same question from two tenants yields two cache entries'],
    ['Deletion', 'Erasure removes chunks, vectors AND cache entries', 'Deleted canary unretrievable within the erasure SLA'],
    ['Budget', 'Per-tenant token buckets before the shared gateway', 'One tenant at 100x load leaves others\' p99 unchanged'],
  ]},
  'orchestration-frameworks': { cols: ['Reach for it when', 'It costs you'], rows: [
    ['LangChain (chains)', 'Linear retrieve-then-answer with many connectors', 'Prompt opacity; retries and token accounting hidden in layers'],
    ['LangGraph (graphs)', 'Loops with state, branching, budgets, human-in-the-loop', 'Graph complexity that must still be traced and evaluated'],
    ['LlamaIndex', 'Document-heavy retrieval with many index types', 'Its abstractions shape your chunking whether you noticed or not'],
    ['Plain Python', 'You need full control of prompts, retries, cost and tracing', 'You write the connectors - and own them forever'],
    ['Prove the choice', 'Same eval set and cost per answer before and after adopting it', 'A framework that cannot be evaluated is a dependency, not a decision'],
  ]},
  'autonomous-loops': { cols: ['Measures', 'The trap it hides'], rows: [
    ['GPU utilization', 'The cluster is busy', 'Busy with low-value experiments = expensive random search'],
    ['Convergence rate', 'The frontier is actually moving', 'The only metric that proves discovery, not just motion'],
    ['Info-gain per GPU-hour', 'Scheduling by expected value', 'FIFO scheduling wastes the scarce resource on arrival order'],
    ['Checkpoint/resume coverage', 'Long runs survive preemption', 'No resume = the scheduler cannot preempt = utilization collapses'],
    ['Provenance completeness', 'Every result is reproducible', 'One unpinned variable makes an autonomous result unbelievable'],
  ]},
  'halluc-triangle': { cols: ['Quality gain', 'What it costs'], rows: [
    ['Semantic cache', 'Repeats answered from a verified past', 'Near zero - it SAVES latency and money'],
    ['Route cheap, escalate', 'Small model screens, big model takes the hard slice', 'Router complexity + a hardness signal'],
    ['Retrieve-then-cite, forced', 'Every claim chained to a source', 'One retrieval hop of latency'],
    ['Grounding check (NLI)', 'Unsupported claims caught on the way out', 'A small model call per answer'],
    ['Abstain path', '"Not in context" replaces the worst hallucinations', 'Product courage - it must count as an answer'],
    ['Prove the triangle', 'Hallucination eval + p95 + cost per 1M on ONE dashboard', 'A lever that moves one without hurting the others is measured, not assumed'],
  ]},
  'customer-discovery': { cols: ['Ask', 'Why it changes the design'], rows: [
    ['What business outcome, for whom?', 'Decides what "working" means', 'A dashboard nobody reads is a successful deploy and a failed engagement'],
    ['Traffic: batch or realtime? Peak?', 'Sync vs async is decided here', 'An SFTP nightly and a 50K-rps stream are different products'],
    ['Data: schema, size, PII, retention', 'Storage, residency, erasure design', 'PII discovered late reopens the security review'],
    ['Which surfaces can you offer?', 'You integrate with what exists', 'The beautiful API they do not have loses to the ugly drop they do'],
    ['Security regime: SSO, mTLS, allowlists', 'Sets the identity architecture', 'A shared API key in an enterprise is a finding, not a feature'],
    ['Reliability: SLO, RTO, RPO - signed', 'Sizes redundancy and the bill', 'Unsigned nines become renegotiated nines during the first incident'],
  ]},
  'integration-surfaces': { cols: ['When it is the right door', 'The honesty kit it needs'], rows: [
    ['REST pull', 'They have an API team and rate limits', 'Pagination cursors, backoff, idempotent upserts, lag metric per source'],
    ['Webhook push', 'They can call you on change', 'Signature verification, replay tolerance, dead-letter path, ack fast + process async'],
    ['SFTP / file drop', 'A mainframe or vendor export is upstream', 'Schema validation at the door, checksum + row counts, idempotent re-ingest of the same file'],
    ['Database pull', 'Nothing else exists and they grant a replica', 'Read the REPLICA, watermark columns, never their primary, schema-drift alarms'],
    ['Event bus', 'They already publish domain events', 'Consumer-group lag SLO, schema registry, poison-message quarantine'],
    ['Prove any of them', 'Same discipline regardless of door', 'Contract test both directions; reconciliation counts match at day end'],
  ]},
  'env-debug-ladder': { cols: ['Two-line check', 'What it rules out'], rows: [
    ['DNS', 'Resolve the name from THEIR network; compare answers', 'Split-horizon DNS, stale records, wrong environment entirely'],
    ['Route + firewall', 'Trace the path; does anything answer on that IP?', 'Missing peering, VPN down, corporate firewall egress rules'],
    ['Security group / port', 'Open a raw TCP connection to the port from your subnet', 'The rule that allows their office but not your cluster'],
    ['TLS', 'Handshake with a STRICT client; inspect the full chain and SNI', 'Expired intermediates browsers forgive and mobile stacks refuse'],
    ['Credentials', 'Authenticate with the same principal the service uses', 'The human account that works vs the service account that was never granted'],
    ['Application', 'Only now read the app logs', 'Everything above - which is why it is the LAST rung, not the first'],
  ]},
  'poc-vs-production': { cols: ['The POC keeps it', 'Production demands'], rows: [
    ['Scope', 'One flow, end to end, honestly', 'Every flow, or a signed statement of what is out'],
    ['Identity', 'A named test user', 'SSO/OIDC, service accounts, least privilege'],
    ['Data', 'A representative sample, real shapes', 'Full volume, PII controls, retention and erasure'],
    ['Deploy', 'One environment, hand-built is fine', 'Reproducible from zero: IaC, pipeline, rollback rehearsed'],
    ['Observability', 'Console logs are acceptable', 'Structured logs, metrics, traces, alerts - before traffic, not after'],
    ['Failure', 'Skipped, and SAID so in the demo', 'Load tested to the signed SLO; chaos on the critical path'],
  ]},
  'comms-levels': { cols: ['Audience', 'The sentence that lands'], rows: [
    ['Engineer', 'Facts + the command', 'Partition 7 is hot; one consumer down; scale to N+2 and drain oldest-first - lag-minutes, not depth'],
    ['Eng manager', 'Scope, owner, ETA', 'Contained to assignment; payments unaffected; backlog clears ~12 min after scale-up; I own it'],
    ['CTO', 'Cause + structural prevention', 'Depth alarms hid a drain-rate problem; we are alarming on lag-minutes and setting a peak consumer floor'],
    ['Customer executive', 'Business meaning, zero jargon, zero blame', 'Orders and payments were never at risk; matching fell behind and is cleared; it now pages us before customers feel it'],
    ['The rule', 'All four are true at once', 'Never the engineer version to the executive - and never blame another team in front of the customer'],
  ]},
  'deployment-runbook': { cols: ['Stage', 'Exit criterion - the evidence'], rows: [
    ['Discovery', 'Requirements and SLOs written and SIGNED', 'Unsigned nines get renegotiated mid-incident'],
    ['Security review', 'Data-flow diagram approved; identities and secrets named', 'PII path and residency on one page'],
    ['Network validation', 'Debug ladder green FROM THEIR ENVIRONMENT', 'Screenshots of each rung, dated'],
    ['Integration', 'Contract tests passing in both directions', 'can-i-deploy green; reconciliation counts match'],
    ['Load + SLO validation', 'Simulator numbers reproduced in staging at signed rps', 'p99 and error budget within SLO on the dashboard'],
    ['Cutover', 'Rollback REHEARSED, not described', 'The rollback ran in staging this week, timed'],
    ['Handover', 'Their on-call closes an injected incident without you', 'The incident report they wrote, not you'],
  ]},
  'authn-authz': { cols: ['AuthN - "who are you"', 'AuthZ - "what can you do"'], rows: [
    ['Owner', 'The identity provider', 'The application'],
    ['Artifact', 'A signed token proving identity', 'A policy check on the token\'s claims'],
    ['When it runs', 'Once at login (then SSO session)', 'On every protected action'],
    ['Failure looks like', 'Cannot log in', 'Logged in but reaches too much - the quiet one'],
    ['Prove it', 'A valid token is issued', 'That token, at the wrong endpoint, is refused'],
  ]},
  'oauth-oidc': { cols: ['OAuth 2.0', 'OIDC'], rows: [
    ['Purpose', 'Delegated authorization', 'Authentication (identity)'],
    ['Main artifact', 'Access token', 'ID token (a JWT)'],
    ['Answers', 'What can this app access?', 'Who logged in?'],
    ['Use it for', 'Reaching an API on the user\'s behalf', 'Logging the user in'],
    ['The trap', 'Treating an access token as proof of identity', 'Skipping it and hand-rolling login on OAuth'],
  ]},
  'saml-oidc': { cols: ['SAML', 'OIDC'], rows: [
    ['Format', 'XML assertions', 'JSON / JWT'],
    ['Era', 'Older enterprise standard', 'Modern'],
    ['Best at', 'Legacy enterprise SaaS SSO', 'Web, mobile, API'],
    ['Complexity', 'Higher', 'Generally simpler'],
    ['Prove it', 'A signed assertion logs into legacy SaaS', 'An ID token logs into the new app - same identity'],
  ]},
  'token-validation': { cols: ['Local JWT validation', 'Introspection (call the IdP)'], rows: [
    ['Latency', 'Microseconds, on the box', 'A network round trip per check'],
    ['Availability', 'App survives an IdP blip', 'Every request depends on the IdP'],
    ['Revocation', 'Only at token expiry', 'Immediate'],
    ['Use it as', 'The default hot path', 'The exception for revocation-critical flows'],
    ['Bound the risk', 'Short lifetimes + refresh tokens', 'Cache introspection results carefully'],
  ]},
  'zero-trust': { cols: ['Signal', 'What the policy does with it'], rows: [
    ['Identity', 'Establishes who is asking', 'The baseline for every decision'],
    ['Device', 'Managed and compliant, or unknown?', 'Unknown device -> step-up or block'],
    ['Location / network', 'Expected, or a new country?', 'Impossible travel -> block'],
    ['Risk score', 'Behavioral and threat signals', 'High risk -> require MFA'],
    ['Outcome', 'allow | step-up MFA | block', 'Evaluated every time, not once at the perimeter'],
  ]},
  'sso-at-scale': { cols: ['Concern', 'The design answer'], rows: [
    ['Token storage', 'Short-lived access + revocable refresh; never in localStorage for sensitive apps', 'httpOnly, scoped, expiring'],
    ['Logout across 500 apps', 'IdP session ended + best-effort single logout; local sessions expire fast', 'Single logout has hard edges - short sessions cover them'],
    ['Key rotation', 'Overlap: publish next key, then sign, then retire old', 'No login ever drops'],
    ['A user is disabled', 'SCIM deprovisions + refresh tokens revoked within a bounded window', 'The leaver is provably locked out'],
    ['The front door fails', 'Regional redundancy, cached-session grace, a break-glass path', 'SPOF resilience = enterprise resilience'],
  ]},
  'processing-engine': { cols: ['Best when', 'Why', 'The combo'], rows: [
    ['Pandas', 'Data fits in one machine\'s memory (up to a few GB)', 'In-memory, single-node - faster and simpler than a cluster at this size', 'Python + Pandas'],
    ['PySpark', 'Data exceeds one machine (tens of GB to PB)', 'Distributes work across a cluster; the driver plans, executors crunch', 'Python + PySpark'],
    ['Spark + Delta/Iceberg', 'Big data that must persist as reliable tables', 'Distributed compute over a transactional lake format', 'Spark + Delta Lake'],
    ['Spark Streaming / Flink', 'Data never stops arriving; seconds matter', 'Processes unbounded streams continuously, not bounded batches', 'Kafka + Spark Streaming'],
    ['The trap', 'Spark for a gigabyte', 'A cluster spends more time coordinating than computing on small data', 'Right-size or waste'],
  ]},
  'batch-vs-stream': { cols: ['Batch', 'Streaming'], rows: [
    ['Data shape', 'Bounded chunks on a schedule', 'Unbounded, processed as it arrives'],
    ['Freshness', 'Minutes to hours', 'Seconds'],
    ['Complexity & cost', 'Simple, cheap, easy to reprocess', 'Complex, always-on, harder to reason about'],
    ['Typical stack', 'Airflow + Spark/SQL', 'Kafka + Spark Streaming or Flink'],
    ['Choose it when', '"Fresher than nightly" - most real requirements', 'Seconds genuinely matter - fraud, live ops'],
  ]},
  'orchestration': { cols: ['Cron', 'An orchestrator (Airflow)'], rows: [
    ['Unit', 'A command at a time', 'A DAG of tasks with dependencies'],
    ['Ordering', 'You hope the timing lines up', 'Runs in dependency order, parallelizes what it can'],
    ['Failure', 'Silent - it just did not run', 'Retries, alerts, and a visible failed task'],
    ['History', 'Gone', 'Backfill re-runs any past window'],
    ['The combo', 'crontab', 'Python + Airflow; Airflow + dbt for analytics pipelines'],
  ]},
  'cdc-ingestion': { cols: ['CDC (Kafka + Debezium)', 'ELT ingestion (Airbyte + Snowflake)'], rows: [
    ['What it moves', 'Every change off a source DB\'s WAL', 'Bulk data from many sources, loaded raw'],
    ['Latency', 'Low - a continuous change stream', 'Scheduled or frequent syncs'],
    ['Source impact', 'Minimal - reads the log, not the tables', 'Periodic extract load on the source'],
    ['Best for', 'Low-latency change capture off transactional stores', 'Syncing many sources into the warehouse'],
    ['Both beat', 'Dual-writes from application code', 'The reflex that reconciles forever'],
  ]},
  'lakehouse-formats': { cols: ['Raw files in a bucket', 'Open table format (Delta / Iceberg)'], rows: [
    ['Transactions', 'None - concurrent writes corrupt', 'ACID over the same files via a transaction log'],
    ['Time travel', 'No history', 'Query or roll back to a past version'],
    ['Schema', 'No enforcement - bad writes absorbed', 'Schema evolution and enforcement'],
    ['Concurrent writes', 'Last-writer-corrupts', 'Safe, isolated concurrent writes'],
    ['The combo', 'S3 alone', 'S3 + Apache Iceberg; Spark + Delta Lake'],
  ]},
  'analytics-engineering': { cols: ['Hand-run SQL', 'Analytics engineering (dbt)'], rows: [
    ['Reproducible', 'No - ran once in a console', 'Versioned SQL models, re-runnable'],
    ['Reviewed', 'No', 'Git pull requests - reviewed like code'],
    ['Tested', 'You find out in the dashboard', 'Data tests run before it ships'],
    ['Dependencies', 'Implicit and fragile', 'A model DAG dbt resolves and runs in order'],
    ['The combo', 'A query someone wrote once', 'SQL + dbt, Git + dbt, Airflow + dbt'],
  ]},
  'one-way-doors': { cols: ['Two-way door (reversible)', 'One-way door (irreversible)'], rows: [
    ['Decision speed', 'Decide fast, low process', 'Slow down, get it right'],
    ['Examples', 'A feature flag, a config, a retryable job', 'Data model, public API, core dependency, security posture'],
    ['Cost of being wrong', 'Cheap - flip it back', 'Expensive or impossible to undo'],
    ['Who decides', 'Delegate freely', 'The senior call, with the right people'],
    ['In this studio', 'Cache write policy, LB algorithm', 'The ledger\'s no-UPDATE, an on-chain transfer, a schema split'],
  ]},
  'build-buy-adopt': { cols: ['Build', 'Buy (vendor)', 'Adopt (open source)'], rows: [
    ['Right when', 'It is your core differentiator', 'Undifferentiated heavy lifting', 'A common need you can run'],
    ['You own', 'The code and the operations, forever', 'Little - the vendor runs it', 'The operational burden, not the code'],
    ['Cost shape', 'Engineering time, indefinitely', 'A bill that scales with use', 'Free license, real ops cost'],
    ['The trap', 'Building undifferentiated infra', 'Lock-in and the bill at scale', 'Adopting what you cannot evaluate or run'],
    ['Prove the choice', 'It is a moat, not plumbing', 'Total cost vs build over three years', 'A team that can operate it at 3am'],
  ]},
  'technical-risk': { cols: ['Reactive (firefighting)', 'Proactive (pre-mortem)'], rows: [
    ['When risk surfaces', 'As an incident, in production', 'As an assumption, before you build'],
    ['The question', 'What broke?', 'Assume it failed - why?'],
    ['The riskiest part', 'Discovered last', 'Named and tested first'],
    ['The team', 'Stalled, then reacting', 'Unblocked - obstacles cleared ahead'],
    ['In this studio', 'Read it off the chaos blast radius', 'Inject the fault before a customer does'],
  ]},
  'disagree-commit': { cols: ['Consensus-seeking', 'Disagree and commit'], rows: [
    ['Fits when', 'Reversible, low-stakes, time to align', 'Team split, a call must be made now'],
    ['The decision', 'Wait for everyone to agree', 'Make it, own it, document why'],
    ['Those who disagreed', 'Blocked until convinced', 'Commit fully - execution over ego'],
    ['The risk', 'Analysis paralysis', 'A wrong call - so make it a two-way door if you can'],
    ['The record', 'In people\'s heads', 'An ADR: context, decision, consequences'],
  ]},
  'adrs': { cols: ['Tribal knowledge', 'Architecture Decision Record'], rows: [
    ['Where the "why" lives', 'In the head of whoever left', 'In a short, versioned document'],
    ['Six months later', '"Why did we do this?" - nobody knows', 'Read the ADR: context and consequences'],
    ['A new hire', 'Re-litigates settled decisions', 'Reads the trail and moves on'],
    ['Format', 'A Slack thread, maybe', 'Context, decision, status, consequences'],
    ['Same shape as', 'Undocumented folklore', 'The provenance a payment or an experiment carries'],
  ]},
  'depth-breadth': { cols: ['Senior IC', 'Staff / EM'], rows: [
    ['Primary value', 'Deep hands-on execution', 'Architectural judgment and leverage'],
    ['Technical depth', 'The point', 'Enough to make and evaluate the hard calls'],
    ['A hard problem', 'Solve it yourself', 'Ask the question that unlocks the team'],
    ['The trap', 'Never scaling beyond your own hands', 'Losing the depth to judge - a non-technical technical leader'],
    ['Measured by', 'What you build', 'What the team builds, and the calls you got right'],
  ]},
  'oltp-olap': { cols: ['OLTP (row store)', 'OLAP (column store)'], rows: [
    ['Unit of work', 'One entity, all its fields', 'Few columns, a billion rows'],
    ['Layout', 'Rows together - fetch is one seek', 'Columns together - scan reads only what the question names'],
    ['Speedup source', 'Indexes finding the needle', 'Compression + vectorized scans skipping the haystack'],
    ['Writes', 'The whole point', 'Batched, appended, replicated in'],
    ['Prove it', 'Checkout p99 flat during month-end reporting', 'The 2-column scan touches 5% of the bytes a row store would'],
  ]},
  'pipelines-elt': { cols: ['ETL (transform first)', 'ELT (load raw, transform inside)'], rows: [
    ['Where logic lives', 'In pipeline code outside the warehouse', 'In versioned SQL the warehouse runs'],
    ['Rerun a bad day', 'Re-execute custom code and pray it matched', 'Overwrite the partition; same rows land once'],
    ['Late data', 'Awkward - transform already happened', 'A window and a rule; reprocess the slice'],
    ['Debugging', 'Raw truth was never kept', 'Raw layer is the evidence locker'],
    ['Prove it', 'Two runs, identical outputs, documented', 'Retry a load twice; row counts do not move'],
  ]},
  'warehouse-modeling': { cols: ['Why it matters', 'The trap it prevents'], rows: [
    ['Declare the grain first', 'Every join and rollup is defined by it', 'Half-aggregated facts that double-count on join'],
    ['Facts immutable; corrections as new rows', 'The past is evidence, not a draft', 'History rewritten under a dashboard mid-quarter'],
    ['SCD2 dimensions with validity ranges', 'Truth changes on Tuesday; history should not', "Last year's orders teleporting to this year's city"],
    ['Surrogate keys to dimension versions', 'A fact points at the version that was true', 'Natural keys silently spanning two truths'],
    ['Prove it', 'Rerun last quarter today', 'If the numbers drift from the March board deck, the model leaks'],
  ]},
  'metrics-layer': { cols: ['Every dashboard its own SQL', 'One metrics layer'], rows: [
    ['Definitions of revenue', 'As many as there are dashboards', 'One, with filters, grain, currency stated'],
    ['A definition changes', 'Silently, in one chart, on a Tuesday', 'By review, versioned, announced'],
    ['Two numbers disagree', 'A week of archaeology', 'Impossible by construction - same query path'],
    ['New surface (notebook, API)', 'Copy-paste the SQL, fork the truth', 'Query the layer; inherit the truth'],
    ['Prove it', 'You cannot - the definitions live in charts', 'grep the codebase: revenue is defined once'],
  ]},
  'data-mesh': { cols: ['Domain ownership', 'Latency', 'New bottleneck?', 'Verdict'], rows: [
    ['Central warehouse, one team owns all ETL', 'None - the central team is the write path', 'Batch - nightly at best', 'The same team, still the queue and the outage', 'Keeps the bottleneck the redesign was meant to remove'],
    ['Domains expose sync read APIs for analytics', 'Real per domain, but not analytical ownership', 'Live - if the transactional system is up', 'No central team, but analytics now rides transactional availability', 'Couples analytics to OLTP uptime; variable load and latency'],
    ['True mesh: contract-first products on async streams + self-serve platform', 'Each domain owns its product; platform owns the paved road', 'Low - subscribe to the stream, read materialized views', 'No - platform enables, domains publish, governance is federated', 'The answer - decoupled, observable, scales per domain'],
    ['Batch files into a shared lake, central team normalizes', 'Loosely with the domain, tightly with the central jobs', 'Batch - scheduled normalization', 'Yes - the central team just moved into the lake', 'Relocates the bottleneck; does not remove it'],
  ]},
  'experiments': { cols: ['Contract', 'Prove it'], rows: [
    ['Assignment: hash(unit, salt)', 'Same user, same arm, forever - no lookup table', 'Replay a month of assignments; zero flips'],
    ['Exposure logged at the decision point', 'Intent-to-treat starts where the fork happens', 'Exposure count = users who reached the fork, not logins'],
    ['SRM as the canary', 'A 52/48 on a designed 50/50 invalidates before stats', 'Automated chi-square gate; failed SRM blocks readout'],
    ['Metrics from the shared layer', 'The experiment and the CFO see one revenue', 'Experiment readout query names the metrics layer'],
    ['Stats engine last', 'No peeking; fixed horizon or sequential by design', 'Readout page shows the pre-registered stop rule'],
  ]},
  'testing-pyramid': { cols: ['Feedback speed', 'Catches integration drift?', 'Flakiness and cost', 'Verdict'], rows: [
    ['Full e2e against shared staging as the merge gate', 'Hours - a queue of teams', 'Yes, along with everyone else\'s noise', 'Maximal on both counts', 'The flake factory - realism paid for in trust'],
    ['Unit tests + mocks + periodic manual checks', 'Seconds', 'No - mocks agree with themselves while the seam drifts', 'Low cost, hidden risk', 'Green dashboards, production surprises'],
    ['Shift left: units + contracts + ephemeral e2e + canary with observability', 'Seconds for the gate, hours for the periodic sweep', 'Yes - at the seam by contract, in the large by schedule, in production by canary', 'Low flake by construction; envs cost compute, not trust', 'The answer - layered gates, each honest about what it can see'],
    ['Unit-only CI, validate in production with monitoring and rollbacks', 'Instant', 'Only after customers do', 'Cheap until the first incident review', 'Customers as the test suite'],
  ]},
  'contract-testing': { cols: ['Unit + mocks', 'Shared-staging e2e', 'Consumer-driven contracts'], rows: [
    ['What it verifies', 'Your imagination of the dependency', 'Everything at once, indistinctly', 'The exact seam each consumer relies on'],
    ['Feedback speed', 'Seconds', 'Hours, plus the queue', 'Seconds, in the provider\'s own CI'],
    ['Who must be running', 'Nobody', 'Everybody', 'Nobody - the broker holds the expectations'],
    ['Async events', 'Untested shapes', 'Timing-dependent flake', 'Message pacts: schema plus example, verified'],
    ['Prove it', 'You cannot - green is self-referential', 'A passing run you cannot reproduce', 'can-i-deploy: a recorded compatibility matrix'],
  ]},
  'test-doubles': { cols: ['Use it for', 'The lie it can tell'], rows: [
    ['Stub (canned answers)', 'Simple reads a test needs in place', 'The shape changed upstream and the stub kept smiling'],
    ['Mock (asserts calls)', 'Verifying a protocol really happened', 'Tests your call script, not the dependency\'s behavior'],
    ['Fake (working in-memory impl)', 'Stores and queues in component tests', 'Semantics drift - no fsync, no contention, no limits'],
    ['Recorded/replayed traffic', 'Realistic shapes without the neighbour', 'The recording ages while the API moves on'],
    ['Prove the double', 'Pin it to a contract or a fresh recording', 'A double nobody verifies is fiction with a green check'],
  ]},
  'ephemeral-envs': { cols: ['Shared staging', 'Ephemeral per branch', 'Production canary'], rows: [
    ['Isolation', 'None - a contended singleton', 'Total - your branch, your universe', 'Real users, tiny slice'],
    ['State ownership', 'Unowned, drifting, mysterious', 'Seeded fresh, torn down on TTL', 'The real thing'],
    ['Realism', 'Stale-real', 'As real as your seeds and stamps', 'Perfect'],
    ['Cost shape', 'Cheap in compute, expensive in trust', 'Compute per branch - budget it, cap it', 'Cheap - the fleet already runs'],
    ['Prove it', 'You cannot - too many hands', 'Env stamps out in minutes, green twice', 'Canary metrics vs control on one dashboard'],
  ]},
  'flaky-tests': { cols: ['Fix', 'Prove it'], rows: [
    ['Wall-clock time in tests', 'Inject a fake clock; never sleep as sync', 'Zero sleeps in the suite; time-travel tests pass at any speed'],
    ['Shared ports, files, state', 'Randomize and namespace per test run', 'Full suite passes run in parallel with itself'],
    ['Order dependence', 'Shuffle test order in CI', 'Green under a shuffled seed, seed printed on failure'],
    ['Retry culture', 'Quarantine lane with a burn-down and an owner', 'Quarantine count trends to zero; retries need a linked issue'],
    ['The budget', 'Treat flake rate like an error budget', 'Suite-level flake % on a dashboard, with an alert'],
  ]},
  'release-strategies': { cols: ['Blue-green', 'Canary', 'Rolling'], rows: [
    ['Rollback', 'Instant - flip the switch back', 'Fast - route the slice away', 'Slow - redeploy the old build'],
    ['Extra capacity', 'A whole second fleet, idle most of the time', 'A few percent', 'None'],
    ['Blast radius', 'Everyone, at the moment of the flip', 'The slice - the honest signal', 'Grows with each instance replaced'],
    ['Schema constraint', 'Both versions live on ONE database', 'Both versions live on ONE database', 'Both versions live on ONE database'],
    ['Prove it', 'Error budget flat across the flip', 'Slice vs control on the same SLO dashboard', 'Per-instance health as each one turns'],
  ]},
  'expand-contract': { cols: ['Availability', 'Data-loss risk', 'Complexity', 'Verdict'], rows: [
    ['Blocking migration at the cutover', 'Down for the whole migration', 'Low - if it finishes', 'Low', 'Fails zero-downtime by definition'],
    ['Dual-write in the app', 'Up', 'Drift: two writes, no atomicity', 'High, plus reconciliation forever', 'The classic trap'],
    ['Expand -> flags -> backfill -> contract', 'Up throughout', 'None - one source of truth the whole way', 'Moderate, well-trodden', 'The answer'],
    ['Separate green DB via replication', 'Lag window at the switch', 'A schema-divergent replica breaks the changed table', 'High', 'Cutover gap - and two truths'],
  ]},
  'feature-flags': { cols: ['Use it for', 'Retire it when'], rows: [
    ['Release flag', 'Turning new code paths on for slices of users', 'The feature is at 100% and stable for a release'],
    ['Ops kill switch', 'Shedding load or disabling a dependency mid-incident', 'Never - but review its owner quarterly'],
    ['Migration flag', 'Reading the new schema shape while both exist', 'The contract step lands and the old shape is gone'],
    ['Experiment flag', 'A/B tests with a metric and an end date', 'The end date - written down on day one'],
    ['Prove it', 'Flag flips visible on the SLO dashboard as annotations', 'A flag inventory with zero orphans'],
  ]},
  'backfills': { cols: ['Why', 'The number to watch'], rows: [
    ['Chunk by key range', 'Small batches keep locks short and let the primary breathe between them', 'Lock wait time per batch stays in milliseconds'],
    ['Throttle on replica lag', 'Lag is the primary telling you it is drowning - listen before users do', 'Replica lag under your read-path tolerance, always'],
    ['Idempotent batches', 'A crash resumes from a checkpoint instead of starting the 400 million over', 'Rows processed is monotonic across restarts'],
    ['Verify before the flip', 'Row counts plus sampled diffs - the flag waits for the proof', 'Count parity and a zero-diff sample'],
    ['Prove it worked', 'The live path never noticed', 'Replica lag flat and p99 unchanged for the whole run'],
  ]},
  'dual-write': { cols: ['App dual-write', 'CDC / outbox'], rows: [
    ['Atomicity', 'None across two shapes - first write lands, second fails', 'Changes leave the commit log already committed'],
    ['Failure mode', 'Silent drift, reconciled forever', 'Lag - visible, measurable, catches up'],
    ['Ordering', 'Whatever the app threads did', 'Commit order, replayable'],
    ['Who owns truth', 'Unclear - two writers, two stories', 'One source, one follower, by construction'],
    ['Prove it', 'You cannot - reconciliation reports are the confession', 'Consumer offset lag plus a periodic checksum'],
  ]},
  'dns': { cols: ['What it is', 'The operational move'], rows: [
    ['Resolution path', 'Root -> TLD -> authoritative, cached at every hop', 'Know WHOSE cache answered - dig +trace vs your resolver'],
    ['TTL', 'How long any cache may keep the answer', 'Lower it days BEFORE a migration; restore after'],
    ['Failover via DNS', 'Steers new connections only', 'Pair with health checks; never promise sub-TTL failover'],
    ['Negative caching', 'NXDOMAIN is cached too', 'A typo\'d record hurts for its own TTL - test before you publish'],
    ['Prove it', 'Traffic actually moved', 'Old-IP traffic decays on the resolver-TTL curve you predicted'],
  ]},
  'tcp-udp': { cols: ['TCP', 'UDP', 'QUIC'], rows: [
    ['Guarantee', 'Ordered, reliable byte stream', 'None - datagrams, best effort', 'Reliable per stream, over UDP'],
    ['Loss behavior', 'Head-of-line: one loss stalls all', 'Late data simply dies', 'One loss stalls ONE stream'],
    ['Handshake', 'SYN/ACK before data', 'None', '1-RTT with TLS built in; 0-RTT resumption'],
    ['Reach for it', 'Anything that must be complete', 'Voice, games, telemetry - late equals worthless', 'HTTP/3, mobile networks that roam'],
    ['Prove the choice', 'Retransmit and RTT graphs', 'Application-level recovery you can demo', 'p99 under induced 1% loss vs HTTP/2'],
  ]},
  'tls': { cols: ['Cost', 'Lever'], rows: [
    ['Fresh handshake', '1 RTT (TLS 1.3) after TCP\'s 1 - doubled across oceans', 'Connection pooling and keep-alive make it rare'],
    ['Resumption', 'Session tickets skip the full ceremony', '0-RTT for idempotent requests only - replay is real'],
    ['Termination point', 'Edge termination cuts user RTTs', 'Re-encrypt inside if the network is not trusted'],
    ['mTLS', 'Both sides prove identity', 'Mesh-issued certs so app code never touches keys'],
    ['Prove it', 'Where the milliseconds went', 'Handshake time as its own histogram, per region'],
  ]},
  'http-versions': { cols: ['HTTP/1.1', 'HTTP/2', 'HTTP/3'], rows: [
    ['Parallelism', 'One request per connection (6 sockets as a hack)', 'Many streams, one TCP connection', 'Many streams, one QUIC connection'],
    ['Head-of-line', 'At the request level', 'Gone at HTTP, alive in TCP below', 'Gone - loss stalls only its stream'],
    ['Transport', 'TCP', 'TCP', 'UDP (QUIC), TLS built in'],
    ['Shines when', 'Simplicity, proxies everywhere', 'Many small assets, gRPC between services', 'Lossy or roaming networks, mobile'],
    ['Prove the upgrade', 'Baseline waterfall', 'Fewer connections, same assets, lower p95', 'p99 on 4G-class loss profiles'],
  ]},
  'os-limits': { cols: ['The wall', 'The fix'], rows: [
    ['File descriptors', "'Too many open files' - every socket is an fd, default ulimit ~1024", 'Raise LimitNOFILE/systemd + fs.file-max; alert at 80%'],
    ['Ephemeral ports', "'Cannot assign requested address' - one port per outbound (src,dst)", 'Pool and keep-alive connections; widen ip_local_port_range as relief, not cure'],
    ['TIME_WAIT', 'Closed sockets linger ~60s holding their port', 'Reuse via pooling; tw_reuse for clients - never blind tw_recycle'],
    ['Conntrack', 'The NAT/firewall table fills silently under fan-out', 'Size nf_conntrack_max; watch drops as a first-class metric'],
    ['Prove it', 'The limits are known before they are hit', 'fd count, port usage and conntrack fill on the same dashboard as rps'],
  ]},
  'k8s-resources': { cols: ['Requests', 'Limits'], rows: [
    ['What it means', 'What the scheduler RESERVES for the pod', 'Where the kernel enforces the ceiling'],
    ['Memory behavior', 'Placement math only', 'Exceed it and the OOM killer acts - node headroom is irrelevant'],
    ['CPU behavior', 'Placement + HPA baseline', 'Throttling, not killing - watch throttle seconds'],
    ['Set from', 'Observed p95 usage', 'p95 plus honest burst headroom'],
    ['Prove it', 'HPA scales at the utilization you intended', 'Zero OOMKilled events at steady state; throttling near zero'],
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
