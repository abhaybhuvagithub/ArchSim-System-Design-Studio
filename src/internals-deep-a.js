// Deep internals, tranche A: traffic, edge and compute.
// Each entry: why it exists, the request lifecycle step by step, the algorithms
// with their cost, the data structures and why, how it fails and what to do,
// the knobs that matter, the classic mistakes, and how ArchSim models it.
export const DEEP_A = {
  lb: {
    why: 'Spread requests over many identical servers so no single one is a bottleneck or single point of failure, and take unhealthy ones out of rotation without clients noticing.',
    lifecycle: [
      'The client connects to one virtual IP (or DNS name that resolves to several balancer nodes).',
      'The balancer accepts the connection. A layer-4 balancer routes by IP and port and never reads the payload; a layer-7 balancer terminates TLS, parses HTTP and can route on path, header or cookie.',
      'It asks its health table for the set of healthy backends in the pool.',
      'The chosen algorithm picks one backend (see below). A sticky rule (cookie or source-IP hash) can override the choice so a session returns to the same server.',
      'It forwards the request, adding headers such as X-Forwarded-For and a request id. With layer 4 it may rewrite packets and let the response return directly (direct server return).',
      'It records the outcome. A timeout or connection reset counts against that backend; passive health tracking can eject it after several failures.',
      'In the background, active health checks (an HTTP GET or TCP connect every few seconds) mark backends up or down after N consecutive results, so one blip does not flap the pool.',
      'On deploy or scale-in, the backend is put in "draining": it receives no new connections while existing ones finish, up to a timeout.',
    ],
    algorithms: [
      { name: 'Round robin', how: 'Cycle through backends in order. Weighted round robin repeats a backend in proportion to its weight.', cost: 'O(1) per request; ignores real load, so uneven request cost creates hot servers.' },
      { name: 'Least connections', how: 'Send to the backend with the fewest in-flight requests; weight by capacity. Good when request durations vary.', cost: 'O(log n) with a heap, O(n) if scanned.' },
      { name: 'Power of two choices', how: 'Pick two backends at random and send to the less loaded. Nearly as good as global least-connections with far less coordination, which matters across many balancer nodes.', cost: 'O(1); expected maximum load drops from log n / log log n to log log n.' },
      { name: 'Consistent hashing', how: 'Hash a key (client IP, session id, cache key) onto a ring; the next backend clockwise owns it. Adding or removing a backend moves only about 1/n of keys.', cost: 'O(log n) lookup with a sorted ring; use virtual nodes (100+ per backend) for even spread.' },
    ],
    structures: [
      { name: 'Backend table with health state and weights', why: 'Read on every request, written rarely; usually an immutable snapshot swapped atomically so the hot path takes no lock.' },
      { name: 'Per-backend active connection counter', why: 'Feeds least-connections and the draining logic; atomic increments on connect and close.' },
      { name: 'Hash ring (sorted array of virtual nodes)', why: 'Binary search finds the owning node; rebuilt only when membership changes.' },
    ],
    failures: [
      { mode: 'A backend dies', what: 'Requests to it fail until health checks notice, typically 10 to 30 seconds with default settings.', fix: 'Retry idempotent requests on another backend, add passive outlier ejection, and tune check interval against false-positive flapping.' },
      { mode: 'The balancer itself fails', what: 'Everything behind it is unreachable even though servers are healthy.', fix: 'Run several balancer nodes across zones behind anycast or DNS; never one.' },
      { mode: 'Thundering herd after recovery', what: 'A recovered backend with an empty cache or cold JIT gets full share instantly and falls over again.', fix: 'Slow start: ramp its weight up over a minute.' },
      { mode: 'Connection exhaustion', what: 'The balancer runs out of ephemeral ports or file descriptors to one backend.', fix: 'Connection pooling and keep-alive to backends, raise limits, add more balancer IPs.' },
    ],
    knobs: [
      { name: 'Health check interval, timeout, thresholds', effect: 'Faster detection vs more false ejections and more check traffic.' },
      { name: 'Idle and request timeouts', effect: 'Too short cuts long requests; too long holds resources for dead clients.' },
      { name: 'Draining timeout', effect: 'Longer protects in-flight work but slows deployments.' },
      { name: 'Sticky sessions', effect: 'Simplifies stateful apps but skews load and makes a failure drop a whole user cohort.' },
    ],
    pitfalls: [
      'Using round robin with highly uneven request cost, then blaming the servers for hot spots.',
      'Health checks that only test "port open" and so keep sending traffic to an app that is up but broken.',
      'Sticky sessions used to hide the fact the app keeps state locally.',
      'Retrying non-idempotent requests (a payment) on another backend and charging twice.',
    ],
    model: 'ArchSim treats the balancer as a high-capacity, low-latency tier with its own availability, spreading load evenly across the replicas behind it. It does not model uneven request cost or health-check delay.',
  },

  gateway: {
    why: 'One front door for many services: it authenticates, limits, routes and observes every external call so individual services do not each reimplement that.',
    lifecycle: [
      'TLS is terminated and the request parsed.',
      'The route table is matched on host, path and method. Path matching uses a trie or radix tree, not a linear scan, so thousands of routes stay fast.',
      'Authentication: validate an API key, or verify a JWT locally (signature plus expiry, with the signing keys cached from a JWKS endpoint) or call an introspection endpoint for opaque tokens.',
      'Authorisation and quota: check the caller\'s plan, scopes and rate limit (see rate limiter).',
      'Request shaping: add a request id and trace context, strip untrusted headers, optionally transform or validate the body against a schema.',
      'Pick an upstream instance (service discovery plus load balancing) and forward with a per-route timeout and bounded retries.',
      'Apply a circuit breaker: if the upstream has failed too often recently, fail fast or serve a fallback instead of queuing.',
      'Shape the response (headers, compression, caching if allowed) and emit metrics, logs and a trace span.',
    ],
    algorithms: [
      { name: 'Radix-tree route matching', how: 'Routes share prefixes in a tree; matching walks one path per URL segment, with parameter and wildcard nodes.', cost: 'O(length of path), independent of route count.' },
      { name: 'JWT verification', how: 'Split the token, verify the signature against a cached public key chosen by key id, check exp, nbf, issuer and audience.', cost: 'One signature check (microseconds for RSA verify or Ed25519); no network call on the hot path.' },
      { name: 'Circuit breaker', how: 'Closed counts failures in a rolling window; over the threshold it opens and rejects calls; after a cool-down it goes half-open and lets a few probes through.', cost: 'O(1) per call, with a few counters per upstream.' },
    ],
    structures: [
      { name: 'Route trie / radix tree', why: 'Fast prefix matching with parameters.' },
      { name: 'JWKS key cache with refresh', why: 'Avoids a network call per request; refreshed on unknown key id or on a timer.' },
      { name: 'Rolling-window counters per upstream', why: 'Drive breakers and outlier detection.' },
    ],
    failures: [
      { mode: 'Gateway overload', what: 'It is the shared choke point, so it saturates before the services do.', fix: 'Scale it horizontally and keep it stateless; push heavy work (transformations, large bodies) out.' },
      { mode: 'Auth provider outage', what: 'If every request needs a live call to an identity service, login-gated traffic stops.', fix: 'Verify tokens locally; cache introspection results briefly; define fail-open or fail-closed per route on purpose.' },
      { mode: 'Retry amplification', what: 'Gateway retries multiply load on an already struggling upstream.', fix: 'Retry budgets (for example at most 10 percent extra), jittered backoff, idempotent methods only.' },
      { mode: 'Stale routes', what: 'A deploy changes a service but the gateway config lags.', fix: 'Declarative config applied atomically with versioning and rollback.' },
    ],
    knobs: [
      { name: 'Per-route timeouts', effect: 'The outer timeout must exceed inner ones or you return errors for work that succeeded.' },
      { name: 'Retry count and budget', effect: 'Resilience against transient errors vs amplified load.' },
      { name: 'Body size limits', effect: 'Protects memory; too low breaks uploads.' },
      { name: 'Header and token cache TTLs', effect: 'Latency vs how quickly a revoked credential stops working.' },
    ],
    pitfalls: [
      'Putting business logic in the gateway until it becomes the monolith it was meant to protect against.',
      'Long-lived JWTs with no revocation path.',
      'One global timeout for every route.',
    ],
    model: 'ArchSim models the gateway as a stateless tier with a capacity per replica and a small added latency. Auth, routing rules and breakers are described here but not simulated individually.',
  },

  cdn: {
    why: 'Serve content from a location near the user and keep repeated reads away from the origin, cutting latency and origin load.',
    lifecycle: [
      'DNS or anycast steers the user to a nearby point of presence (PoP).',
      'The edge server computes a cache key from the URL (and chosen headers such as Accept-Encoding) and looks it up in memory, then on local disk.',
      'Hit: serve it, subject to freshness (Cache-Control max-age or s-maxage). If stale, revalidate with the origin using If-None-Match; a 304 renews it without re-sending the body.',
      'Miss: request coalescing holds duplicate misses for the same key so only one request goes to the origin.',
      'Many CDNs route that fetch through a regional "shield" cache first, so the origin sees one request per object per region instead of one per PoP.',
      'The response is stored if cacheable (status, Cache-Control, no private or no-store), then streamed to the user while being written to cache.',
      'Purges propagate to every PoP by key, tag or prefix; versioned URLs (app.3f2a.js) avoid needing purges.',
    ],
    algorithms: [
      { name: 'LRU / segmented LRU / TinyLFU eviction', how: 'Evict the least recently used object; modern CDNs add admission control (TinyLFU) so one-hit wonders do not displace popular objects.', cost: 'O(1) per access with a hash map plus list.' },
      { name: 'Request coalescing (collapsed forwarding)', how: 'The first miss becomes the leader; followers wait on its result.', cost: 'Turns N simultaneous misses into 1 origin fetch.' },
      { name: 'Stale-while-revalidate', how: 'Serve the stale copy immediately and refresh in the background.', cost: 'Hides origin latency; allows brief staleness.' },
    ],
    structures: [
      { name: 'In-memory hash index over disk-stored objects', why: 'Memory lookup then one disk read.' },
      { name: 'Cache key (URL plus Vary headers)', why: 'Decides what counts as the same object; getting it wrong either fragments the cache or serves the wrong variant.' },
    ],
    failures: [
      { mode: 'Origin outage', what: 'Cache misses fail; hits still work.', fix: 'stale-if-error and long TTLs for static content; a shield tier.' },
      { mode: 'Cache stampede on a hot expiry', what: 'Many PoPs refetch simultaneously.', fix: 'Coalescing, shield, jittered TTLs.' },
      { mode: 'Serving a private page to others', what: 'A personalised response cached without Vary or private.', fix: 'Cache-Control: private on personalised responses; test with two users.' },
    ],
    knobs: [
      { name: 'TTL per content type', effect: 'Hit ratio and origin load vs freshness.' },
      { name: 'Cache key composition', effect: 'Each extra key part (cookie, query string) lowers the hit ratio.' },
      { name: 'Compression and image formats at edge', effect: 'Bandwidth and CPU trade.' },
    ],
    pitfalls: [
      'Caching responses that include Set-Cookie.',
      'Putting an unbounded query string in the cache key so every request is a miss.',
      'Relying on purge for correctness instead of versioned URLs.',
    ],
    model: 'ArchSim models the CDN as a very high capacity tier that absorbs most read traffic. Hit ratio comes from the design, not from per-object cache behaviour.',
  },

  ratelimiter: {
    why: 'Stop one caller from consuming a shared resource, protect services from overload, and enforce plans and fairness.',
    lifecycle: [
      'Identify the subject: API key, user id, IP, tenant, or a combination, plus the route.',
      'Look up the limit for that subject (plan, route, global).',
      'Run the algorithm against a shared counter store (commonly Redis) so all gateway instances agree.',
      'Allowed: continue and attach headers (limit, remaining, reset). Denied: return 429 with Retry-After.',
      'Count the decision in metrics so you can see who is being limited.',
    ],
    algorithms: [
      { name: 'Token bucket', how: 'A bucket holds up to B tokens and refills at R per second; each request takes one. Allows bursts up to B while holding the long-run rate to R. Stored as (tokens, last_refill_time); on each request compute tokens = min(B, tokens + elapsed*R).', cost: 'O(1), two numbers per subject.' },
      { name: 'Leaky bucket', how: 'Requests enter a queue that drains at a fixed rate; overflow is dropped. Smooths output.', cost: 'O(1); adds queueing delay.' },
      { name: 'Fixed window counter', how: 'Count per calendar window (per minute). Simple but allows a 2x burst across the window boundary.', cost: 'O(1); but a 2x burst is possible at the window edge.' },
      { name: 'Sliding window log / counter', how: 'Log keeps timestamps (exact, memory heavy). Counter blends the current and previous window weighted by overlap (approximate, cheap).', cost: 'Log O(requests in window); counter O(1).' },
    ],
    structures: [
      { name: 'Key to (tokens, timestamp) in Redis', why: 'Shared across nodes; updated atomically with a Lua script or INCR so concurrent requests cannot both pass the last token.' },
      { name: 'Local pre-filter with periodic sync', why: 'Cuts Redis round trips at the cost of slight over-admission.' },
    ],
    failures: [
      { mode: 'Counter store down', what: 'The limiter cannot decide whether to admit a request.', fix: 'Choose fail-open (availability) or fail-closed (protection) deliberately, often with a local fallback limit.' },
      { mode: 'Race conditions', what: 'Read-then-write lets two requests spend one token.', fix: 'Atomic operations only.' },
      { mode: 'Hot key', what: 'One tenant\'s counter overloads one Redis shard.', fix: 'Shard the counter or use local approximate counting.' },
    ],
    knobs: [
      { name: 'Rate and burst size', effect: 'Burst absorbs legitimate spikes; too large defeats the protection.' },
      { name: 'Window length', effect: 'Short windows react quickly and are jumpy; long windows are smooth and slow to react.' },
      { name: 'Subject choice', effect: 'Per-IP punishes shared NATs; per-key is fair but needs authentication first.' },
    ],
    pitfalls: [
      'Limiting by IP behind a proxy and seeing only the proxy address.',
      'No Retry-After, so clients retry immediately and make it worse.',
      'Limiting only at the edge and leaving internal callers unbounded.',
    ],
    model: 'ArchSim does not simulate per-caller limits. It shows the effect indirectly: capacity caps in the model are what a limiter would enforce.',
  },

  app: {
    why: 'The stateless request-handling tier that holds business logic. Being stateless is what lets you add replicas to scale and replace them freely.',
    lifecycle: [
      'A worker thread (or event-loop callback) picks up the request from the connection.',
      'Middleware runs: authentication, request id, logging, input validation.',
      'The handler runs business logic, calling the cache first for reads (cache-aside) and the database on a miss or for writes.',
      'Outbound calls use a bounded connection pool with timeouts; waiting for a free connection is itself queueing time.',
      'The response is serialised and sent; metrics and a trace span are recorded.',
      'Under overload, the request queue grows; past a limit the server should shed load (return 503) rather than queue forever.',
    ],
    algorithms: [
      { name: 'Little\'s law for sizing', how: 'In-flight requests L = arrival rate x latency. At 1,000 rps and 50 ms, about 50 requests are in flight, so you need at least that much concurrency per fleet.', cost: 'Back-of-envelope; the basis of the capacity numbers.' },
      { name: 'Thread pool vs event loop', how: 'Thread-per-request is simple but costs memory per thread and context switches; an event loop handles many idle connections cheaply but one blocking call stalls everything.', cost: 'Threads: O(concurrent requests) memory. Event loop: O(1) per idle connection.' },
      { name: 'Load shedding', how: 'Reject the newest or lowest-priority work when the queue exceeds a latency budget.', cost: 'O(1); keeps latency bounded under overload.' },
    ],
    structures: [
      { name: 'Bounded request queue', why: 'An unbounded queue turns overload into minutes of latency and memory exhaustion.' },
      { name: 'Connection pools (DB, HTTP)', why: 'Reuse connections; the pool size caps concurrency to the dependency.' },
    ],
    failures: [
      { mode: 'Memory leak or GC pause', what: 'Latency spikes then restarts.', fix: 'Heap limits, GC tuning, restart policy, and per-instance health checks.' },
      { mode: 'Slow dependency', what: 'Threads pile up waiting; the tier looks overloaded though CPU is idle.', fix: 'Timeouts, bulkheads per dependency, circuit breakers.' },
      { mode: 'Deploy of a bad version', what: 'Errors or latency spikes appear across the whole fleet after a release.', fix: 'Canary rollout with automatic rollback on error-rate or latency breach.' },
    ],
    knobs: [
      { name: 'Thread/worker count and pool sizes', effect: 'Too few starves throughput; too many thrashes and floods the database.' },
      { name: 'Timeouts (client, pool wait, per call)', effect: 'Must nest: inner shorter than outer.' },
      { name: 'Autoscaling signal', effect: 'Scaling on CPU misses I/O-bound saturation; scale on queue depth or latency.' },
    ],
    pitfalls: [
      'Keeping session state in memory, which breaks scale-out and rolling deploys.',
      'Connection pool size times replicas exceeding the database connection limit.',
      'No timeout on an outbound call.',
    ],
    model: 'ArchSim treats app tiers as stateless replicas with a capacity per replica and a latency; adding replicas raises capacity linearly until a shared dependency saturates.',
  },

  micro: {
    why: 'Independently deployable services aligned to a business capability, so teams can ship and scale separately.',
    lifecycle: [
      'A caller resolves the service through discovery (DNS, a registry or the platform) to a healthy instance.',
      'The call goes over HTTP or gRPC with a deadline propagated from the original request, so downstream work stops when the user has already given up.',
      'The service validates, runs its logic against its own datastore (data is not shared with other services), and may publish an event.',
      'Calls to other services are wrapped in timeout, retry with backoff and jitter, and a circuit breaker.',
      'Cross-service changes use sagas or the outbox pattern rather than distributed transactions.',
      'Tracing context rides along on every hop so one request can be followed across services.',
    ],
    algorithms: [
      { name: 'Retry with exponential backoff and jitter', how: 'Wait base x 2^attempt, randomised, up to a cap and a retry budget.', cost: 'Bounded extra load; without jitter, clients retry in lockstep.' },
      { name: 'Deadline propagation', how: 'Pass the remaining time budget in a header; each hop subtracts its own time.', cost: 'O(1); prevents work nobody is waiting for.' },
      { name: 'Saga', how: 'A sequence of local transactions, each with a compensating action run in reverse if a later step fails.', cost: 'Eventual consistency; compensations must be idempotent.' },
    ],
    structures: [
      { name: 'Service registry / DNS records', why: 'Find instances; entries expire so dead ones disappear.' },
      { name: 'Outbox table', why: 'Write the business change and the event in one local transaction; a relay publishes it, so you never lose or invent an event.' },
    ],
    failures: [
      { mode: 'Cascading failure', what: 'One slow service makes callers hold threads until they fail too.', fix: 'Timeouts, bulkheads, circuit breakers, load shedding.' },
      { mode: 'Partial failure in a workflow', what: 'Step 3 of 5 fails after steps 1 and 2 committed.', fix: 'Saga compensation or forward recovery.' },
      { mode: 'Duplicate delivery', what: 'At-least-once messaging repeats a message.', fix: 'Idempotency keys and deduplication.' },
    ],
    knobs: [
      { name: 'Service granularity', effect: 'Too fine multiplies network calls and operational burden; too coarse recreates the monolith.' },
      { name: 'Sync vs async between services', effect: 'Sync is simpler to reason about and couples availability; async decouples and adds eventual consistency.' },
    ],
    pitfalls: [
      'A distributed monolith: services that must deploy together or share a database.',
      'Chatty calls that make one user request touch twenty services.',
      'No ownership: nobody on call for a service.',
    ],
    model: 'ArchSim models each service as a replicated tier with capacity and latency, and edges as calls that add latency and multiply failure probability along the path.',
  },

  ws: {
    why: 'Hold a long-lived two-way connection so the server can push messages immediately (chat, live updates) without the client polling.',
    lifecycle: [
      'The client sends an HTTP request with Upgrade: websocket; the server replies 101 and the TCP connection becomes a framed message channel.',
      'The connection is authenticated once at upgrade (token in the request or first message) and bound to a user id.',
      'The server records "user X is on this gateway node" in a shared presence map (for example Redis).',
      'To send to user X from anywhere, a service publishes to a pub/sub topic; the node holding X\'s connection receives it and writes the frame.',
      'Heartbeats (ping/pong) detect dead connections; idle ones are closed.',
      'On reconnect the client resumes from its last message id, so missed messages are replayed.',
    ],
    algorithms: [
      { name: 'Connection-to-node routing', how: 'A presence map from user to node, or consistent hashing of user id to node.', cost: 'O(1) lookup; changes on connect and disconnect.' },
      { name: 'Backpressure per connection', how: 'A bounded send buffer per client; if it fills, drop or disconnect the slow consumer.', cost: 'Bounded memory per connection.' },
      { name: 'Fan-out', how: 'One message to many recipients via topic subscriptions or per-room membership lists.', cost: 'O(recipients) per message.' },
    ],
    structures: [
      { name: 'Connection table (id to socket)', why: 'In-memory per node; each connection costs kilobytes, so a node holds tens to hundreds of thousands.' },
      { name: 'Presence map', why: 'Locate a user across nodes.' },
      { name: 'Per-connection outbound buffer', why: 'Absorbs bursts; its bound protects the node.' },
    ],
    failures: [
      { mode: 'Node crash', what: 'All its connections drop at once.', fix: 'Clients reconnect with jittered backoff to avoid a reconnect storm; resume from last id.' },
      { mode: 'Reconnect storm after a deploy', what: 'Every client reconnects simultaneously.', fix: 'Drain gradually, jitter, and rate-limit accepts.' },
      { mode: 'Slow consumer', what: 'Buffers grow and consume memory.', fix: 'Bounded buffers and disconnect.' },
    ],
    knobs: [
      { name: 'Max connections per node', effect: 'Bounded by memory and file descriptors, not CPU.' },
      { name: 'Heartbeat interval', effect: 'Shorter finds dead peers faster, costs battery and traffic.' },
      { name: 'Message size and rate limits', effect: 'Protects against abuse.' },
    ],
    pitfalls: [
      'Treating connection count as requests per second; it is a memory and descriptor problem.',
      'Sticky connections making load balancing uneven after a scale-out (existing connections do not move).',
      'No resume protocol, so any blip loses messages.',
    ],
    model: 'ArchSim models the tier by capacity and latency like other services; the long-lived connection memory limit is described here but not separately simulated.',
  },

  worker: {
    why: 'Run work outside the request path: slow, retryable or bursty jobs taken from a queue at the rate the worker can sustain.',
    lifecycle: [
      'The worker polls or subscribes to a queue and receives a message with a visibility timeout (SQS style) or an offset lease (Kafka style).',
      'The message is hidden from other consumers while this worker processes it.',
      'It runs the job. Because delivery is at-least-once, the job must be idempotent: check an idempotency key or make the effect safe to repeat.',
      'On success it acknowledges (deletes the message or commits the offset).',
      'On failure it does not acknowledge; the message reappears after the timeout and is retried with backoff.',
      'After N attempts the message moves to a dead-letter queue for inspection instead of retrying forever.',
    ],
    algorithms: [
      { name: 'At-least-once with idempotent handlers', how: 'Accept duplicates and make them harmless, rather than chase exactly-once delivery.', cost: 'A dedupe lookup per message.' },
      { name: 'Backoff with jitter and max attempts', how: 'Delay doubles each retry, randomised, then dead-letter.', cost: 'Bounded retries.' },
      { name: 'Autoscale on queue depth', how: 'Desired workers = backlog / (throughput per worker x acceptable drain time).', cost: 'Reacts to the real saturation signal.' },
    ],
    structures: [
      { name: 'Dead-letter queue', why: 'Parks poison messages so they do not block the line.' },
      { name: 'Idempotency store (key to result)', why: 'Lets a repeated message return the earlier result without redoing the effect.' },
    ],
    failures: [
      { mode: 'Poison message', what: 'A message that always fails blocks or loops.', fix: 'Max attempts then dead-letter, with an alert.' },
      { mode: 'Visibility timeout shorter than the job', what: 'The message reappears while still being processed, causing duplicate work.', fix: 'Set the timeout above the longest job or extend it while working.' },
      { mode: 'Backlog growth', what: 'Arrival rate exceeds processing rate.', fix: 'Scale workers, shed or prioritise, and watch queue age.' },
    ],
    knobs: [
      { name: 'Concurrency per worker', effect: 'Throughput vs memory and downstream load.' },
      { name: 'Batch size', effect: 'Higher throughput, larger retry unit when one item fails.' },
      { name: 'Max attempts and backoff', effect: 'Resilience vs time to surface a real failure.' },
    ],
    pitfalls: [
      'Non-idempotent handlers (sending an email twice, charging twice).',
      'Processing before the database commit, or acknowledging before the work finishes.',
      'No dead-letter queue, so one bad message stops everything.',
    ],
    model: 'ArchSim models workers by throughput capacity; the queue in front absorbs spikes in the design but backlog dynamics over time are not simulated.',
  },

  scheduler: {
    why: 'Run jobs at a time or interval reliably, once, across a fleet, surviving restarts and node failures.',
    lifecycle: [
      'Job definitions (cron expression or interval, payload, timeout) are stored durably.',
      'A scheduler loop finds jobs whose next-run time has passed, using a priority queue or an indexed query on next_run_at.',
      'To avoid two nodes running the same job, one acquires a lease or lock (database row lock, leader election, or a unique key per run).',
      'The job is dispatched to a worker queue and marked running with a heartbeat deadline.',
      'On completion the next_run_at is computed and stored; on missed heartbeat the run is considered failed and retried or alerted.',
      'Missed runs after downtime follow a policy: run once now, run all missed, or skip.',
    ],
    algorithms: [
      { name: 'Min-heap / timing wheel', how: 'Keep upcoming runs ordered by time; a timing wheel buckets them by tick for O(1) insertion at very large scale.', cost: 'Heap O(log n); wheel O(1) amortised.' },
      { name: 'Leader election or distributed lease', how: 'One node (or one per job) holds a time-limited lease and renews it; if it dies, the lease expires and another takes over.', cost: 'Failover delay equals the lease duration.' },
    ],
    structures: [
      { name: 'Job table indexed by next_run_at', why: 'Cheap "what is due" query.' },
      { name: 'Run history table', why: 'Audit, retries and idempotency per scheduled run id.' },
    ],
    failures: [
      { mode: 'Double execution', what: 'Two nodes both think they own a job.', fix: 'Fencing tokens or unique-run constraints; make jobs idempotent.' },
      { mode: 'Missed execution', what: 'Scheduler down at the due time.', fix: 'Catch-up policy and monitoring of "last successful run".' },
      { mode: 'Thundering herd at :00', what: 'Everything scheduled on the hour starts together and spikes load.', fix: 'Add random jitter to start times and spread schedules out.' },
    ],
    knobs: [
      { name: 'Lease duration', effect: 'Short fails over fast but risks false takeovers during pauses.' },
      { name: 'Catch-up policy', effect: 'Correctness for time-sensitive jobs vs a burst after downtime.' },
    ],
    pitfalls: [
      'Relying on cron on a single server as the only scheduler.',
      'Clock skew between nodes deciding "due".',
      'Jobs that run longer than their interval and overlap themselves.',
    ],
    model: 'ArchSim treats the scheduler as a light control-plane tier; exactly-once scheduling behaviour is described here, not simulated.',
  },

  k8s: {
    why: 'Declare the desired state of containers and have a control loop continually make reality match it: scheduling, restarts, scaling and rollouts.',
    lifecycle: [
      'You submit a desired state (a Deployment with 5 replicas) to the API server, which stores it in etcd.',
      'The Deployment controller creates a ReplicaSet, which creates Pod objects.',
      'The scheduler assigns each unscheduled Pod to a node: it filters nodes that cannot fit (resource requests, taints, affinity) and scores the rest.',
      'The kubelet on that node pulls the image and starts containers through the container runtime, then reports status.',
      'Probes decide life: readiness controls whether the Pod receives traffic from a Service; liveness restarts a stuck container.',
      'Controllers keep reconciling: a crashed Pod is replaced, a node loss reschedules its Pods, the HPA changes replica count from metrics.',
      'Rolling updates replace Pods gradually within maxSurge and maxUnavailable limits.',
    ],
    algorithms: [
      { name: 'Reconciliation (control loop)', how: 'Repeatedly compare desired and observed state and act to close the gap; level-triggered, so missed events self-heal.', cost: 'Eventual: converges rather than executes one command.' },
      { name: 'Filter-and-score scheduling', how: 'Drop infeasible nodes, score the rest (spread, bin-packing, affinity), pick the highest.', cost: 'O(pods x nodes) bounded by sampling in large clusters.' },
      { name: 'HPA', how: 'desiredReplicas = ceil(currentReplicas x currentMetric / targetMetric), with stabilisation windows to avoid flapping.', cost: 'Reacts on a minutes timescale, not seconds.' },
    ],
    structures: [
      { name: 'etcd (Raft-replicated key-value store)', why: 'The single source of truth; its health is the cluster\'s health.' },
      { name: 'Informer caches and work queues', why: 'Controllers read a local cache and process keys from a rate-limited queue.' },
    ],
    failures: [
      { mode: 'OOMKilled', what: 'A container exceeds its memory limit and is killed even if the node has free memory.', fix: 'Set requests and limits from measured usage; the limit is a hard ceiling.' },
      { mode: 'Node failure', what: 'Pods are evicted after a timeout (minutes) and rescheduled.', fix: 'Replicas across zones, PodDisruptionBudgets, shorter tolerations if appropriate.' },
      { mode: 'Control plane unavailable', what: 'Running Pods keep running but nothing changes.', fix: 'Managed or multi-master control plane.' },
    ],
    knobs: [
      { name: 'Resource requests and limits', effect: 'Requests drive scheduling and HPA; limits drive killing and CPU throttling.' },
      { name: 'Probes', effect: 'Bad probes cause restart loops or traffic to unready Pods.' },
      { name: 'maxSurge / maxUnavailable', effect: 'Rollout speed vs capacity during update.' },
    ],
    pitfalls: [
      'No requests set, so the scheduler overpacks nodes.',
      'A liveness probe that depends on a downstream, so an outage restarts every Pod.',
      'Running stateful workloads without understanding persistent volumes and ordering.',
    ],
    model: 'ArchSim models Kubernetes as a platform tier; it does not simulate scheduling, probes or rollouts, only the capacity and availability of what runs on it.',
  },

  mesh: {
    why: 'Move service-to-service networking concerns (mTLS, retries, timeouts, traffic shifting, telemetry) out of application code into a uniform proxy layer.',
    lifecycle: [
      'A sidecar proxy (for example Envoy) is injected next to each service; all inbound and outbound traffic is redirected through it.',
      'A control plane distributes configuration (routes, policies, certificates) to every proxy using a streaming API.',
      'The caller\'s proxy resolves the destination through service discovery and picks an endpoint with a load-balancing algorithm.',
      'It opens a mutual-TLS connection using a short-lived workload certificate, proving the caller\'s identity.',
      'It applies policy: timeout, retry, circuit breaking, rate limit, and optional traffic split (90 percent v1, 10 percent v2).',
      'The destination proxy checks authorisation policy, then hands the request to the local service.',
      'Both proxies emit metrics and trace spans, giving uniform telemetry without code changes.',
    ],
    algorithms: [
      { name: 'Weighted traffic splitting', how: 'Route by percentage or by header match to enable canary releases.', cost: 'O(1) per request.' },
      { name: 'Outlier detection', how: 'Eject an endpoint that returns consecutive errors for a period, then readmit.', cost: 'Counters per endpoint.' },
      { name: 'Certificate rotation', how: 'Workload certs live hours and are renewed automatically from the mesh CA.', cost: 'Limits the damage of a stolen credential.' },
    ],
    structures: [
      { name: 'xDS configuration snapshots in each proxy', why: 'Atomic config updates without restarting.' },
      { name: 'Per-endpoint stats', why: 'Feeds load balancing and ejection.' },
    ],
    failures: [
      { mode: 'Added latency', what: 'Each hop adds two proxy traversals (hundreds of microseconds to a few milliseconds).', fix: 'Measure; consider ambient or proxyless modes for latency-critical paths.' },
      { mode: 'Control plane outage', what: 'Existing proxies keep last config; changes and new workloads stall.', fix: 'Run it highly available and test the degraded mode.' },
      { mode: 'Misconfigured policy', what: 'A bad rule blocks real traffic everywhere at once.', fix: 'Staged rollout of mesh policy; dry-run modes.' },
    ],
    knobs: [
      { name: 'Retry and timeout defaults', effect: 'Mesh retries stack with application retries and amplify load.' },
      { name: 'mTLS mode (permissive vs strict)', effect: 'Permissive eases migration; strict gives real identity guarantees.' },
    ],
    pitfalls: [
      'Adopting a mesh for three services; the operational cost exceeds the benefit.',
      'Double retries in the mesh and the app.',
      'Treating the mesh as a substitute for application-level authorisation.',
    ],
    model: 'ArchSim models the mesh as small added latency per hop and a platform dependency; policy behaviour is not simulated.',
  },

  saga: {
    why: 'Complete a business process that spans several services without a distributed transaction, by sequencing local transactions and undoing them with compensations on failure.',
    lifecycle: [
      'A saga starts with an id and a state (for example PENDING) stored durably.',
      'Step 1 runs a local transaction in service A and emits an event or reply.',
      'The coordinator (orchestration) or the next service (choreography) triggers step 2, and so on.',
      'If every step succeeds the saga is marked COMPLETED.',
      'If step k fails, compensations for steps k-1 down to 1 run in reverse (refund the payment, release the stock).',
      'Every step and compensation must be idempotent because messages can repeat; state transitions are persisted before side effects.',
      'The saga ends in a terminal state; stuck sagas are detected by timeouts and alerted.',
    ],
    algorithms: [
      { name: 'Orchestration', how: 'A central coordinator holds the state machine and tells each participant what to do.', cost: 'Clear flow and easy to observe; the coordinator is a component to scale and keep available.' },
      { name: 'Choreography', how: 'Services react to each other\'s events with no central owner.', cost: 'Loose coupling; the flow is implicit and hard to follow as it grows.' },
      { name: 'Transactional outbox', how: 'Write the state change and the outgoing event in one local transaction; a relay publishes the outbox rows.', cost: 'Removes the dual-write problem.' },
    ],
    structures: [
      { name: 'Saga log / state table', why: 'The durable record that lets a crashed coordinator resume.' },
      { name: 'Idempotency keys per step', why: 'Make retries safe.' },
    ],
    failures: [
      { mode: 'Compensation fails', what: 'A step cannot be undone, leaving the process half-finished.', fix: 'Retry compensations until they succeed; design steps to be reversible; escalate to humans for the rest.' },
      { mode: 'Visible intermediate states', what: 'Other readers see the order paid but not yet reserved.', fix: 'Model states explicitly (PENDING) and expose them honestly.' },
      { mode: 'Lost event', what: 'The state changed but the event was never published.', fix: 'Use the transactional outbox so state and event commit together.' },
    ],
    knobs: [
      { name: 'Step timeouts', effect: 'Detect stuck sagas vs prematurely compensating something slow.' },
      { name: 'Ordering of steps', effect: 'Put the hardest-to-undo step last.' },
    ],
    pitfalls: [
      'Believing a saga gives isolation; it does not, only eventual consistency.',
      'Compensations that are not idempotent.',
      'No way to see where a given saga is stuck.',
    ],
    model: 'ArchSim treats the saga coordinator as a service tier; step-by-step compensation is explained here and in the distributed-transactions drills, not simulated.',
  },

  gslb: {
    why: 'Direct users to the best region (nearest, healthiest, or by policy) and fail over between regions.',
    lifecycle: [
      'The user\'s resolver asks for the service name.',
      'The global DNS or anycast layer evaluates a policy: latency-based, geographic, weighted, or failover priority.',
      'It consults health-check results for each regional endpoint, which are probed from several vantage points.',
      'It returns the address of the chosen region with a low TTL.',
      'If a region fails its health checks, it is dropped from answers; clients move after their cached TTL expires.',
    ],
    algorithms: [
      { name: 'Latency-based routing', how: 'Answer with the region having the lowest measured latency from the resolver\'s network.', cost: 'Measurement data per network; approximate because it keys on the resolver, not the user.' },
      { name: 'Weighted routing', how: 'Return endpoints in proportion to weights; used for gradual migration.', cost: 'O(1) per query; weights are shifted gradually.' },
      { name: 'Health-based failover', how: 'Consecutive failed checks from multiple probes mark an endpoint unhealthy.', cost: 'Detection time = interval x threshold.' },
    ],
    structures: [
      { name: 'Policy table (region, weight, health, priority)', why: 'Evaluated per query.' },
      { name: 'Health-check state with history', why: 'Prevents flapping.' },
    ],
    failures: [
      { mode: 'Slow failover', what: 'Resolvers and clients cache answers beyond the TTL; some users keep hitting the dead region.', fix: 'Low TTL, anycast, and client retry to a second address.' },
      { mode: 'Failover overload', what: 'All traffic lands on the surviving region.', fix: 'Capacity-plan for N+1 regions.' },
      { mode: 'Health check false positive', what: 'A probe problem drains a healthy region.', fix: 'Multiple vantage points and quorum.' },
    ],
    knobs: [
      { name: 'TTL', effect: 'Failover speed vs DNS query load and cost.' },
      { name: 'Check interval and threshold', effect: 'Detection speed vs flapping.' },
    ],
    pitfalls: [
      'Assuming DNS failover is instant.',
      'Routing to a region whose data is not replicated yet.',
    ],
    model: 'ArchSim treats global routing as a very reliable front tier; failover delay is not modelled.',
  },

  waf: {
    why: 'Inspect HTTP requests at the edge and block common attacks and abusive traffic before it reaches the application.',
    lifecycle: [
      'The request arrives at the edge after TLS termination.',
      'IP reputation and rate rules run first because they are cheapest.',
      'Managed rule groups inspect the URL, headers, query and body for SQL injection, cross-site scripting and known exploit signatures, normalising encodings first so tricks like double-encoding do not slip past.',
      'Each rule yields a score or an action: allow, block, count (log only) or challenge (CAPTCHA, JavaScript challenge).',
      'Custom rules for your application (block this path from outside, require a header) are evaluated in priority order.',
      'Allowed requests continue to the origin; decisions are logged for tuning.',
    ],
    algorithms: [
      { name: 'Signature and pattern matching', how: 'Compiled regular expressions or multi-pattern automata (Aho-Corasick) scan the normalised request.', cost: 'Roughly linear in request size.' },
      { name: 'Anomaly scoring', how: 'Each matched rule adds to a score; block above a threshold, so one weak signal does not block a user.', cost: 'Tunable sensitivity.' },
      { name: 'Rate-based rules', how: 'Count requests per IP in a window and block above a limit.', cost: 'Counter store per key.' },
    ],
    structures: [
      { name: 'Compiled rule set', why: 'Prepared once, evaluated per request.' },
      { name: 'IP reputation lists and counters', why: 'Cheap first-line filtering.' },
    ],
    failures: [
      { mode: 'False positives', what: 'Legitimate requests blocked (a post containing SQL-like text).', fix: 'Run in count mode first, review logs, add exceptions narrowly.' },
      { mode: 'Evasion', what: 'Attackers encode payloads to slip past signatures.', fix: 'Normalisation, defence in depth; a WAF is not a substitute for secure code.' },
      { mode: 'Added latency or inspection limit', what: 'Large bodies exceed the inspected size.', fix: 'Know the inspection size limit.' },
    ],
    knobs: [
      { name: 'Rule mode: count vs block', effect: 'Safety of rollout vs protection.' },
      { name: 'Sensitivity threshold', effect: 'Blocked attacks vs blocked customers.' },
    ],
    pitfalls: [
      'Switching to block mode on day one.',
      'Believing the WAF fixes an injectable endpoint.',
    ],
    model: 'ArchSim treats the WAF as a protective front tier with small latency and high availability; blocking behaviour is not simulated.',
  },
}
