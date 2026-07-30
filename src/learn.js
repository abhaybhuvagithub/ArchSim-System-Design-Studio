// Teaching content: a step-by-step lesson that checks itself against your canvas,
// "difference between" tables, an interview quiz, and the numbers worth memorising.

// Each step's check receives a context built from the live graph, so the lesson
// ticks itself off as you build rather than asking you to self-report.
export const LESSON = [
  {
    title: 'Nail the requirements first',
    do: 'Pick a template (or Blank canvas) and read the requirements checklist under the Capacity tab.',
    why: 'Every strong design interview starts by narrowing scope: which features are in, which are explicitly out, and what the read:write ratio looks like. Drawing boxes before this is the classic mistake.',
    check: c => c.nodes.length > 0,
  },
  {
    title: 'Set the traffic you must survive',
    do: 'Move the Traffic slider to your estimated peak requests per second.',
    why: 'Capacity math comes before components. 100M requests/day ÷ 86,400 ≈ 1,150 rps average, and peak is usually 2–3× that. Design for peak, not average.',
    check: c => c.rps > 0,
  },
  {
    title: 'Add the traffic source and an edge tier',
    do: 'Place a Client, then a CDN, Load Balancer or API Gateway in front of your services.',
    why: 'Clients must never address a service directly: you lose the ability to add instances, drain one for deploys, or survive a single failure. The edge tier is also where TLS, caching and routing belong.',
    check: c => c.has('client') && c.any(['cdn', 'lb', 'gateway', 'gslb', 'waf', 'bff']),
  },
  {
    title: 'Keep the compute tier stateless',
    do: 'Add a Web/App/Microservice tier behind the edge and set its replicas above 1.',
    why: 'Stateless services can be cloned, autoscaled and killed freely. The moment a service holds session state in memory you have made it a pet, and load balancing gets sticky and fragile.',
    check: c => c.any(['web', 'app', 'micro', 'ws']) &&
      c.nodes.some(n => ['web', 'app', 'micro', 'ws'].includes(n.type) && (n.replicas || 1) > 1),
  },
  {
    title: 'Choose a datastore deliberately',
    do: 'Add a SQL or NoSQL store (or object storage) and wire your service to it.',
    why: 'Pick for the access pattern, not for fashion: relational for transactions and joins, partitioned NoSQL for huge key-based reads, object storage for blobs. See the Compare tab for the trade-offs.',
    check: c => c.any(['sql', 'nosql', 'blob']),
  },
  {
    title: 'Cache the hot read path',
    do: 'Add a Cache between the service and the database — or let ✨ Improve insert it for you.',
    why: 'Most systems are read-heavy by 10:1 or more. An 80% hit ratio removes four-fifths of database load. Then decide the pattern (cache-aside vs write-through) and the eviction policy.',
    check: c => c.has('cache'),
  },
  {
    title: 'Make slow work asynchronous',
    do: 'Add a Queue or Event Stream and put a Worker Pool behind it.',
    why: 'Anything slow, bursty or retryable — transcoding, email, fan-out, third-party calls — belongs off the request path. The queue absorbs spikes that would otherwise become dropped requests.',
    check: c => c.any(['queue', 'kafka', 'mq']) && c.any(['worker', 'micro']),
  },
  {
    title: 'Run the simulation and read the numbers',
    do: 'Press ▶ Simulate and watch p50, p99, success rate and per-node utilization.',
    why: 'A diagram cannot be wrong, which is why diagrams teach you nothing. Numbers can be wrong. Queueing delay rises sharply past ~70% utilization — that is why p99 explodes long before a tier hits 100%.',
    check: c => c.simOn,
  },
  {
    title: 'Remove every bottleneck',
    do: 'Scale the saturated tiers until no component is above 80% and success rate is 100%.',
    why: 'Utilization above ~80% means requests queue; above 100% they are dropped. Headroom is not waste, it is what absorbs the next traffic spike and the loss of an instance.',
    check: c => c.nodes.length >= 4 && c.maxUtil > 0 && c.maxUtil < 0.8 && c.successRate > 0.999,
  },
  {
    title: 'Break it on purpose',
    do: 'Turn on 🐒 Chaos while simulating and watch what the failure does to success rate.',
    why: 'Redundancy you have never tested is a guess. If losing one instance moves your numbers, you found a single point of failure before production did.',
    check: c => c.chaosUsed,
  },
  {
    title: 'Make it observable',
    do: 'Add Metrics & Alerts (plus an OTel Collector, logs and tracing) and route alerts to on-call.',
    why: 'An outage you learn about from users is an outage you handled badly. Metrics say something is wrong, logs say what, traces say where — and only paging says someone is on it.',
    check: c => c.any(['monitor', 'otel', 'logs', 'tracing']),
  },
  {
    title: 'Harden it for production',
    do: 'Add a WAF, an identity provider, a secrets store and a backup for your datastore.',
    why: 'These are the things reviewers ask about after the happy path: who can call this, where credentials live, what filters hostile traffic, and how you recover from a bad migration. Replicas are not backups.',
    check: c => c.any(['waf', 'iam', 'secrets', 'backup', 'audit']),
  },
  {
    title: 'Narrate the request flow',
    do: 'Turn on ①②③ Steps, label a few connections, then export a PNG.',
    why: 'In an interview you talk through one request end to end. Numbered hops and labelled edges ("cache miss", "async") turn a static picture into a story you can walk someone through.',
    check: c => c.steps || c.edges.some(e => e.label),
  },
]

export const COMPARISONS = [
  {
    title: 'SQL vs NoSQL', left: 'SQL (relational)', right: 'NoSQL (partitioned)',
    rows: [
      ['Schema', 'Fixed, enforced, migrations', 'Flexible, per-item'],
      ['Joins', 'Native, powerful', 'Denormalise instead'],
      ['Transactions', 'ACID, multi-row', 'Usually single-item'],
      ['Scaling', 'Vertical first, then shard', 'Horizontal by design'],
      ['Best for', 'Money, orders, anything relational', 'Huge key-based reads, feeds, events'],
    ],
  },
  {
    title: 'Queue vs Event stream', left: 'Queue (SQS/Rabbit)', right: 'Log (Kafka)',
    rows: [
      ['Message life', 'Deleted after ack', 'Retained for a window'],
      ['Consumers', 'Usually one takes each job', 'Many independent groups'],
      ['Replay', 'No', 'Yes — reset the offset'],
      ['Ordering', 'Best-effort', 'Per partition key'],
      ['Best for', 'Task/job dispatch', 'Event history, fan-out, analytics'],
    ],
  },
  {
    title: 'Cache-aside vs Write-through', left: 'Cache-aside', right: 'Write-through',
    rows: [
      ['Reads', 'Miss → DB → populate', 'Always warm'],
      ['Writes', 'Write DB, invalidate key', 'Write cache and DB together'],
      ['Staleness', 'Possible between the two ops', 'Low'],
      ['Write cost', 'Cheap', 'Higher latency per write'],
      ['Best for', 'Read-heavy, tolerant of a stale ms', 'Read-after-write correctness'],
    ],
  },
  {
    title: 'Horizontal vs Vertical scaling', left: 'Horizontal (scale out)', right: 'Vertical (scale up)',
    rows: [
      ['Method', 'More instances', 'Bigger instance'],
      ['Ceiling', 'Effectively none', 'Largest machine available'],
      ['Complexity', 'LB, statelessness, coordination', 'Almost none'],
      ['Failure', 'Lose one of many', 'Lose everything'],
      ['Best for', 'Stateless tiers', 'Single-writer databases, legacy'],
    ],
  },
  {
    title: 'Strong vs Eventual consistency', left: 'Strong', right: 'Eventual',
    rows: [
      ['Read after write', 'Always sees the write', 'May see stale data briefly'],
      ['Latency', 'Higher (coordination)', 'Lower'],
      ['Availability under partition', 'Reduced (CP)', 'Maintained (AP)'],
      ['Best for', 'Balances, inventory, bookings', 'Likes, feeds, view counts'],
    ],
  },
  {
    title: 'Data lake vs Data warehouse', left: 'Data lake', right: 'Data warehouse',
    rows: [
      ['Schema', 'On read', 'On write, modelled'],
      ['Data', 'Raw, any format', 'Cleaned, conformed'],
      ['Cost', 'Very cheap per TB', 'Expensive per TB'],
      ['Query speed', 'Slower, engine-dependent', 'Fast, columnar'],
      ['Best for', 'Landing zone, ML, exploration', 'BI, dashboards, finance reporting'],
    ],
  },
  {
    title: 'ETL vs ELT', left: 'ETL', right: 'ELT',
    rows: [
      ['Transform where', 'Before load, in a pipeline', 'After load, inside the warehouse'],
      ['Raw data kept', 'Often not', 'Yes — reprocess anytime'],
      ['Compute', 'Separate cluster', 'Warehouse engine'],
      ['Best for', 'Strict schemas, PII stripping first', 'Cloud warehouses, evolving models'],
    ],
  },
  {
    title: 'Monolith vs Microservices', left: 'Monolith', right: 'Microservices',
    rows: [
      ['Deploy', 'One artifact', 'Independently per service'],
      ['Data', 'One shared schema', 'Database per service'],
      ['Calls', 'In-process, fast', 'Network — retries, timeouts, tracing'],
      ['Team fit', 'Small teams', 'Many teams owning domains'],
      ['Cost', 'Low ops overhead', 'Real platform investment'],
    ],
  },
  {
    title: 'Orchestration vs Choreography', left: 'Orchestration (saga)', right: 'Choreography (events)',
    rows: [
      ['Flow lives', 'In a coordinator', 'Spread across consumers'],
      ['Visibility', 'Easy to see and debug', 'Hard to trace end to end'],
      ['Coupling', 'Coordinator knows everyone', 'Services only know events'],
      ['Best for', 'Regulated, ordered workflows', 'Loose, extensible reactions'],
    ],
  },
  {
    title: 'L4 vs L7 load balancing', left: 'L4 (transport)', right: 'L7 (application)',
    rows: [
      ['Decides on', 'IP and port', 'Path, header, cookie'],
      ['Overhead', 'Very low', 'Higher — parses the request'],
      ['Features', 'Fast passthrough', 'Routing, TLS, rewrite, sticky'],
      ['Best for', 'Raw throughput, TCP', 'HTTP APIs, canaries, A/B'],
    ],
  },
  {
    title: 'REST vs GraphQL vs gRPC', left: 'REST / GraphQL', right: 'gRPC',
    rows: [
      ['Shape', 'Resources / one typed graph', 'Typed RPC methods'],
      ['Over-fetching', 'Common in REST, solved by GraphQL', 'Not an issue'],
      ['Payload', 'JSON', 'Protobuf, binary'],
      ['Best for', 'Public and client-facing APIs', 'Internal service-to-service'],
    ],
  },
  {
    title: 'Replication vs Backup', left: 'Replication', right: 'Backup',
    rows: [
      ['Protects against', 'Hardware and node failure', 'Bad writes, bugs, ransomware'],
      ['Bad data', 'Replicates it instantly', 'Restore to a point in time'],
      ['Recovery', 'Failover in seconds', 'Minutes to hours'],
      ['Rule', 'Both. Neither replaces the other.', 'Untested restore = no backup'],
    ],
  },
  {
    title: 'Metrics vs Logs vs Traces', left: 'Metrics', right: 'Logs & traces',
    rows: [
      ['Answers', 'Is something wrong?', 'What and where exactly?'],
      ['Shape', 'Numeric time series', 'Events / spans per request'],
      ['Cost driver', 'Label cardinality', 'Volume and retention'],
      ['Use in an incident', 'Detect and alert', 'Diagnose the failing hop'],
    ],
  },
  {
    title: 'Latency vs Throughput', left: 'Latency', right: 'Throughput',
    rows: [
      ['Measures', 'Time for one request', 'Requests per second'],
      ['Improved by', 'Caching, fewer hops, closer PoPs', 'More replicas, batching, async'],
      ['Trap', 'Averages hide the tail — use p99', 'High throughput can still feel slow'],
      ['Relationship', 'Rises sharply as utilization → 100%', 'Caps at the slowest tier'],
    ],
  },
]

export const QUIZ = [
  {
    q: '100 million requests per day. Roughly what average QPS should you design around?',
    options: ['~120 QPS', '~1,150 QPS', '~11,500 QPS', '~100,000 QPS'],
    answer: 1,
    why: '100,000,000 ÷ 86,400 s ≈ 1,157 QPS average. Then size for peak, typically 2–3× that.',
  },
  {
    q: 'A service tier sits at 95% utilization. What happens to p99 latency?',
    options: ['Unchanged until 100%', 'Rises slightly', 'Rises sharply from queueing', 'Falls — the CPU is efficient'],
    answer: 2,
    why: 'Queueing delay scales roughly with 1/(1−utilization), so it climbs steeply well before saturation. Keep tiers near 50–70%.',
  },
  {
    q: 'Read:write ratio is 100:1. Which single change helps most?',
    options: ['Shard the database', 'Add a cache on the read path', 'Add more app replicas', 'Switch to NoSQL'],
    answer: 1,
    why: 'A cache at an 80% hit ratio removes most of the read load for a fraction of the effort of resharding.',
  },
  {
    q: 'Under CAP, a network partition forces you to choose between:',
    options: ['Consistency and availability', 'Latency and throughput', 'Cost and durability', 'Reads and writes'],
    answer: 0,
    why: 'Partition tolerance is not optional in a distributed system, so the real choice is CP (reject requests) or AP (serve possibly stale data).',
  },
  {
    q: 'Why must a queue consumer be idempotent?',
    options: ['To process faster', 'Because delivery is at-least-once, so duplicates happen', 'To preserve ordering', 'To reduce storage'],
    answer: 1,
    why: 'Retries and redeliveries are normal. Dedupe on a message or business key so replaying an event cannot double-charge anyone.',
  },
  {
    q: 'Three replicas at 99.9% availability each, in parallel. Combined availability?',
    options: ['99.9%', '~99.7%', '~99.9999999%', '33.3%'],
    answer: 2,
    why: '1 − (0.001)³ = 99.9999999%, assuming truly independent failures. Shared dependencies destroy that assumption — that is why correlated failure matters.',
  },
  {
    q: 'Best structure for "restaurants within 2 km of me"?',
    options: ['B-tree on lat and lng', 'Geohash or quadtree index', 'Full table scan with a distance function', 'Inverted text index'],
    answer: 1,
    why: 'Geospatial indexes (geohash, quadtree, H3, S2) turn a 2-D proximity search into a prefix or cell lookup.',
  },
  {
    q: 'Fan-out on write breaks down for which users?',
    options: ['Brand new users', 'Inactive users', 'Celebrities with millions of followers', 'Users on mobile'],
    answer: 2,
    why: 'One celebrity post would mean millions of timeline writes. Hybrid designs fan out normal users on write and merge celebrity posts on read.',
  },
  {
    q: 'What does a 301 redirect cost you in a URL shortener?',
    options: ['Nothing', 'Analytics — browsers cache it and stop calling you', 'Extra database load', 'SEO ranking'],
    answer: 1,
    why: '301 is permanent and cacheable, so it is fast but invisible to you. 302 keeps every click observable at the cost of more traffic.',
  },
  {
    q: 'The outbox pattern exists to prevent:',
    options: ['Slow queries', 'A dual-write where the DB commits but the event publish fails', 'Cache stampedes', 'Hot partitions'],
    answer: 1,
    why: 'Write the event into the same transaction as the state change, then publish it asynchronously — so the two can never diverge.',
  },
  {
    q: 'Which is NOT protection against a bad migration wiping data?',
    options: ['Point-in-time backups', 'Read replicas', 'Snapshots with tested restores', 'Archive with retention'],
    answer: 1,
    why: 'Replicas apply the destructive change faithfully within milliseconds. Replication is availability, not recovery.',
  },
  {
    q: 'In a RAG system, which component is almost always the bottleneck?',
    options: ['Vector database', 'Embedding service', 'LLM inference', 'API gateway'],
    answer: 2,
    why: 'Generation is orders of magnitude slower and costlier than retrieval — hundreds of ms to seconds. Batch, stream tokens, cap output, and cache semantically.',
  },
  {
    q: 'You should alert on:',
    options: ['Every CPU spike', 'Symptoms and SLO burn rate', 'Each individual host going unhealthy', 'Every error in the logs'],
    answer: 1,
    why: 'Cause-based alerts create pager fatigue and get muted. Page on user-visible symptoms and error-budget burn; keep causes on dashboards.',
  },
  {
    q: 'Why front SAP or a mainframe with a queue instead of adding replicas?',
    options: ['Queues are cheaper', 'They cannot be scaled out, so load must be absorbed', 'To improve latency', 'For better logging'],
    answer: 1,
    why: 'Vendor and legacy cores have hard throughput ceilings and licence limits. Async buffering smooths bursts instead of rejecting them.',
  },
]

export const NUMBERS = [
  { group: 'Latency worth memorising', rows: [
    ['L1 cache reference', '~1 ns'],
    ['Main memory reference', '~100 ns'],
    ['SSD random read', '~100 µs'],
    ['Round trip in the same datacenter', '~0.5 ms'],
    ['Disk seek (spinning)', '~10 ms'],
    ['Round trip California ↔ Netherlands', '~150 ms'],
  ]},
  { group: 'Rough capacity per instance', rows: [
    ['App server (business logic)', '~1–2k rps'],
    ['Redis / in-memory cache', '~100k rps'],
    ['SQL database (mixed)', '~5k rps'],
    ['Kafka broker', '~100k+ msg/s'],
    ['LLM inference (GPU)', '~10s of rps'],
    ['ERP / mainframe core', '~1k rps, cannot scale out'],
  ]},
  { group: 'Estimation shortcuts', rows: [
    ['1 million/day', '≈ 12 rps'],
    ['100 million/day', '≈ 1.2k rps'],
    ['1 billion/day', '≈ 12k rps'],
    ['Peak vs average', '2–3× average'],
    ['Availability 99.9%', '≈ 43 min downtime/month'],
    ['Availability 99.99%', '≈ 4.3 min downtime/month'],
  ]},
  { group: 'Storage sizing', rows: [
    ['1 KB × 1M rows', '1 GB'],
    ['1 KB/s written', '≈ 86 MB/day, ≈ 31 GB/year'],
    ['UUID / short id', '16 B / ~7 B'],
    ['Typical web page', '~2 MB'],
    ['1 min of 1080p video', '~50–100 MB'],
    ['Replication factor 3', '3× raw storage cost'],
  ]},
]
