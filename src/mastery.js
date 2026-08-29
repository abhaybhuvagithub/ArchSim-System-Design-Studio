// The 80/20 curriculum: the eleven areas that carry most system design
// interviews, itemized. Each item is one crisp teaching line plus a concrete
// exercise wired to the exact place in the studio where the concept is live -
// a template to load, a tab to open, a thing to actually do. Mastery is a
// checkbox you earn, persisted locally.

export const MASTERY_STORE = 'archsim.mastery.v1'

export const MASTERY = [
  {
    id: 'storage', icon: '🗄️', title: 'Scalable Data Storage',
    items: [
      { id: 'sql-nosql', t: 'Relational vs NoSQL', d: 'SQL buys transactions and joins at the cost of a scaling ceiling; NoSQL buys horizontal writes at the cost of your query flexibility. The workload decides, never fashion.', go: { tpl: 'News Feed (Twitter/X)', tab: 'capacity', do: 'Select the SQL and NoSQL nodes - read each 🔍 internals and compare what each store promises.' } },
      { id: 'partitioning', t: 'Partitioning & sharding', d: 'Split data across machines by a key; the key choice decides your hot spots and which queries stay single-shard.', go: { tpl: 'Chat (WhatsApp)', tab: 'capacity', do: 'Select a datastore and switch its Partitioning control - watch what each scheme costs.' } },
      { id: 'indexing', t: 'Indexing', d: 'A primary index locates the row; secondary and covering indexes answer queries without touching it - every index taxes every write.', go: { tpl: 'FB Post Search', tab: 'breakdown', do: 'Read the inverted-index dive: an index is a precomputed answer to one question shape.' } },
      { id: 'consistency', t: 'Consistency models', d: 'Strong reads see the last write; eventual reads converge later; causal keeps cause before effect. Weaker models are cheaper and often enough.', go: { tpl: 'Chat (WhatsApp)', tab: 'capacity', do: 'Set a datastore to leaderless and tune the w/r quorum inputs until the verdict flips.' } },
    ],
  },
  {
    id: 'caching', icon: '⚡', title: 'Caching',
    items: [
      { id: 'cache-where', t: 'Client vs server vs edge', d: 'Cache as close to the reader as truth allows: browser for the user, CDN for the crowd, Redis for the fleet - each layer answers before the one behind it.', go: { tpl: 'Netflix', tab: 'capacity', do: 'Trace a read: CDN hit, cache hit, origin. Kill the cache with chaos ⚡ and watch the DB inherit the traffic.' } },
      { id: 'cache-strategies', t: 'Write-through / write-back / write-around', d: 'Through writes both places (safe, slower); back writes cache first and flushes later (fast, riskier); around skips the cache so reads warm it (good for write-heavy, rarely-read data).', go: { tpl: 'Redis (Distributed Cache)', tab: 'capacity', do: 'Select the cache node and flip its Write policy control - write-back shows you the loss-window warning live.' } },
      { id: 'cache-distributed', t: 'Distributed cache', d: 'Redis-class memory over consistent hashing: sub-ms reads, a slab of RAM as a service, and a stampede waiting behind every hot key expiry.', go: { tpl: 'Redis (Distributed Cache)', tab: 'scale', do: 'Read the stampede lever - request coalescing is the same defense the CDN shield uses.' } },
      { id: 'cache-eviction', t: 'Eviction policies', d: 'LRU drops the longest-untouched, LFU the least-popular; both are bets about the future shaped like the past.', go: { tpl: 'Redis (Distributed Cache)', tab: 'capacity', do: 'Open the cache node 🔍 internals - the data structure section shows the LRU machinery.' } },
    ],
  },
  {
    id: 'lb', icon: '⚖️', title: 'Load Balancing',
    items: [
      { id: 'horizontal', t: 'Horizontal scaling', d: 'More replicas behind a balancer beats a bigger box: linear-ish capacity, failure becomes a blip, and the queueing knee moves right.', go: { tpl: 'Ride Sharing (Uber)', tab: 'capacity', do: 'Drag the traffic slider up until a tier saturates, then + replicas and watch p99 fall off the knee.' } },
      { id: 'lb-techniques', t: 'Round-robin vs consistent hashing', d: 'Round-robin spreads load evenly; consistent hashing keeps a key on the same node so caches stay warm and shards stay stable when the fleet changes.', go: { tpl: 'URL Shortener (Bitly)', tab: 'capacity', do: 'Select the LB and switch Balancing to consistent hashing - the verdict computes the resize math for this exact tier.' } },
      { id: 'reverse-proxy', t: 'Reverse proxy', d: 'NGINX/Envoy-class front door: terminates TLS, parses HTTP, shields services - tens of thousands of requests per second per box of pure forwarding.', go: { tpl: 'URL Shortener (Bitly)', tab: 'capacity', do: 'Open the LB 🔍 internals - the mechanism section is the reverse-proxy job description.' } },
    ],
  },
  {
    id: 'async', icon: '📨', title: 'Asynchronous Processing',
    items: [
      { id: 'brokers', t: 'Queues vs streams', d: 'A queue hands each message to one consumer and forgets; a stream (Kafka-class) is a replayable log many consumers read at their own pace. Delete-on-ack vs retained history is the whole difference.', go: { tpl: 'Ad Click Aggregator', tab: 'breakdown', do: 'Read why the click path is a stream, not a queue - replay is the audit trail.' } },
      { id: 'event-driven', t: 'Event-driven architecture', d: 'Services publish facts instead of calling each other: producers never wait, consumers never block producers, and new consumers arrive without anyone changing.', go: { tpl: 'Payment System (Stripe-lite)', tab: 'breakdown', do: 'Follow the ledger events dive - the saga is choreography over a log.' } },
      { id: 'task-queues', t: 'Task queues, retries, DLQs', d: 'Slow work goes behind a queue with idempotent consumers, exponential backoff, and a dead-letter queue so one poison job cannot stall the world.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'breakdown', do: 'Read accept-fast-answer-slow - the queue is the architecture, not an optimization.' } },
    ],
  },
  {
    id: 'rw', icon: '📖', title: 'Database Read & Write Scaling',
    items: [
      { id: 'read-scaling', t: 'Read replicas', d: 'The leader takes writes, followers serve reads: read capacity multiplies, at the price of replication lag your product must be honest about.', go: { tpl: 'Zomato', tab: 'capacity', do: 'Select the SQL node, set replication to leader-follower, and read the lag warning it surfaces.' } },
      { id: 'write-scaling', t: 'Write scaling & leader election', d: 'Writes shard by key when one leader saturates; each shard elects its own leader, and the election itself needs consensus.', go: { tpl: 'Online Chess', tab: 'breakdown', do: 'Read the game-shard dive: one game, one authority - sharding by the unit of consistency.' } },
      { id: 'cap', t: 'CAP theorem', d: 'When the network partitions you keep consistency or availability, not both. Everything else in distributed data is negotiating that sentence.', go: { tpl: 'Chat (WhatsApp)', tab: 'acr', do: 'Look up CAP, then BASE, then ACID - the three form one argument.' } },
    ],
  },
  {
    id: 'distributed', icon: '🤝', title: 'Distributed Systems Concepts',
    items: [
      { id: 'consensus', t: 'Consensus (Paxos/Raft)', d: 'A quorum of nodes agreeing on one value despite crashes: majority rounds, a leader with a term, and a log everyone replays identically.', go: { tpl: 'Online Chess', tab: 'capacity', do: 'Open the coordination node 🔍 internals - Raft terms and quorum writes are the mechanism section.' } },
      { id: 'conflict', t: 'Conflict resolution', d: 'Concurrent writes need a rule: last-write-wins loses data quietly, vector clocks detect the conflict, CRDTs make merging automatic by construction.', go: { tpl: 'Chat (WhatsApp)', tab: 'acr', do: 'Look up CRDT - then ask the AI when LWW is genuinely fine (more often than purists admit).' } },
    ],
  },
  {
    id: 'reliability', icon: '🛡️', title: 'Reliability & Failover',
    items: [
      { id: 'redundancy', t: 'Active-active vs active-passive', d: 'Active-active serves from every replica and absorbs failure invisibly; active-passive keeps a warm standby and pays a failover pause. The SLO decides which you can afford.', go: { tpl: 'Zerodha (Kite)', tab: 'slo', do: 'Read the SPOF gate, then ⚡ inject a fault and watch the burn card price the difference.' } },
      { id: 'health-checks', t: 'Health checks', d: 'The balancer only routes around what it can detect: shallow checks catch dead processes, deep checks catch lying ones.', go: { tpl: 'Ride Sharing (Uber)', tab: 'chaos', do: 'Kill a replicated node and watch survivors absorb it - that reroute IS the health check working.' } },
      { id: 'circuit-breakers', t: 'Retries & circuit breakers', d: 'Retries with backoff heal blips; a circuit breaker opens after repeated failure so a dying dependency cannot recruit your whole fleet into a retry storm.', go: { tpl: 'Ramp', tab: 'capacity', do: 'Open any app node 🔍 internals - the mechanism line gives the exact backoff and breaker numbers.' } },
    ],
  },
  {
    id: 'cdn', icon: '🌐', title: 'CDNs',
    items: [
      { id: 'cdn-static', t: 'Static content delivery', d: 'Bytes served from a PoP near the user: origin traffic drops ~90%, p50 drops with the speed of light saved, and the origin stops feeling weather.', go: { tpl: 'CDN (Edge Network)', tab: 'breakdown', do: 'Read the shield dive - a thousand cold PoPs cost the origin exactly one fetch.' } },
      { id: 'cdn-edge', t: 'Caching at the edge', d: 'Hit ratio is the product: every point of it is origin egress the customer never buys, and purge is a global broadcast racing staleness.', go: { tpl: 'CDN (Edge Network)', tab: 'roi', do: 'Open ROI - the whole business is a ratio, priced per million requests.' } },
    ],
  },
  {
    id: 'api', icon: '🔌', title: 'API Design & Rate Management',
    items: [
      { id: 'rest-graphql', t: 'REST vs GraphQL', d: 'REST models resources and caches beautifully; GraphQL lets clients shape responses and saves round-trips at the cost of server complexity and cache pain. Public APIs lean REST; product frontends earn GraphQL.', go: { tpl: 'News Feed (Instagram)', tab: 'breakdown', do: 'Read the API section, then redesign one endpoint as a GraphQL query in your head - what got easier, what got worse?' } },
      { id: 'pagination', t: 'Pagination & filtering', d: 'Offset pagination breaks under inserts; cursor pagination (keyset) is stable, index-friendly, and what every feed actually uses.', go: { tpl: 'News Feed (Twitter/X)', tab: 'breakdown', do: 'Find the cursor in the feed API - note what the cursor encodes and why offset would lie.' } },
      { id: 'versioning', t: 'API versioning', d: 'Version in the path, add fields freely, never change meaning: an API is a promise, and deprecation is a migration you run for other people.', go: { tpl: 'Postman', tab: 'breakdown', do: 'Read the API-contract framing - the product IS versioned promises.' } },
      { id: 'rate-limiting', t: 'Rate limiting (token/leaky bucket)', d: 'Token bucket allows bursts up to capacity and refills at rate; leaky bucket smooths everything to a constant drain. Both turn abuse into a 429 instead of an outage.', go: { tpl: 'Rate Limiter (as a system)', tab: 'breakdown', do: 'Read the algorithms dive - then check the sliding-window trade-off the design chose.' } },
    ],
  },
  {
    id: 'search', icon: '🔍', title: 'Search Systems',
    items: [
      { id: 'search-indexing', t: 'Inverted indexes', d: 'Map every term to the documents containing it: a search becomes set intersection instead of a scan, built at write time so reads are cheap.', go: { tpl: 'FB Post Search', tab: 'breakdown', do: 'Read the ingest dive - the index IS the write path.' } },
      { id: 'search-engines', t: 'Full-text engines', d: 'Elasticsearch-class shards: analyzers tokenize, per-shard queries fan out, results merge - tens of ms over warm shards for real queries.', go: { tpl: 'Local Search (Yelp)', tab: 'capacity', do: 'Open the search node 🔍 internals - the fan-out-and-merge mechanism is the whole engine.' } },
      { id: 'search-ranking', t: 'Ranking & relevance', d: 'Scoring blends term rarity (TF-IDF/BM25) with signals like freshness and popularity - relevance is a product decision wearing math.', go: { tpl: 'Search Autocomplete', tab: 'breakdown', do: 'Read the ranking dive - note where popularity beats textual match, on purpose.' } },
    ],
  },
  {
    id: 'obs-sec', icon: '🩺', title: 'Monitoring, Observability & Security',
    items: [
      { id: 'metrics', t: 'Metrics & golden signals', d: 'Latency, traffic, errors, saturation: four numbers that describe any service - collected by Prometheus-class scrapers, judged against SLOs.', go: { tpl: 'Observability: Golden Signals', tab: 'breakdown', do: 'Read why these four - then open SLO on any design and watch them become a verdict.' } },
      { id: 'tracing', t: 'Distributed tracing', d: 'One request, one trace id, a span per hop: the only way to answer where did the 800ms go in a system with twelve services.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'capacity', do: 'Open the telemetry node 🔍 internals - spans, batching, and the export path.' } },
      { id: 'authn', t: 'AuthN & AuthZ (OAuth, JWT)', d: 'OAuth delegates who you are; JWT carries it as a signed claim; authorization decides what that identity may do - three different questions, always kept separate.', go: { tpl: 'LLM API Platform (FastAPI)', tab: 'breakdown', do: 'Find where the JWT is validated and where quota is enforced - note they are different layers.' } },
      { id: 'encryption', t: 'Encryption in transit & at rest', d: 'TLS on every hop, AES on every disk, keys in a KMS you can rotate and audit - table stakes, and the interview answer is knowing where each applies.', go: { tpl: 'Payment System (Stripe-lite)', tab: 'acr', do: 'Look up mTLS, KMS and E2EE - three layers, three threat models.' } },
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
