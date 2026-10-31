// Deep internals, tranche C: AI serving, identity and trust, money, and stream/geo.
export const DEEP_C = {
  llm: {
    why: 'Turn a prompt into generated text by running a large neural network on GPUs. It is the slowest and most expensive step in an AI request, so most design effort goes into batching, caching and routing around it.',
    lifecycle: [
      'The request arrives with a prompt; the text is split into tokens (sub-word pieces, roughly 3 to 4 characters each) by a tokenizer.',
      'Prefill: the whole prompt is processed in one parallel pass through the transformer layers. This is compute-bound and its time grows with prompt length; it determines time to first token.',
      'The attention keys and values computed for every prompt token are stored in the KV cache in GPU memory so they are never recomputed.',
      'Decode: the model generates one token at a time. Each step reads all model weights and the KV cache from GPU memory, so decode is memory-bandwidth-bound, not compute-bound.',
      'A sampler picks the next token from the probability distribution (temperature, top-p, top-k control randomness); the token is appended and fed back in.',
      'Generation stops at an end-of-sequence token or the maximum length. Tokens are streamed to the client as they are produced.',
      'The scheduler batches many requests together each step (continuous batching): finished sequences leave and new ones join without waiting for the whole batch, keeping the GPU busy.',
    ],
    algorithms: [
      { name: 'Self-attention', how: 'Each token computes a weighted mix of all earlier tokens\' values, with weights from query-key similarity (softmax of Q x K^T / sqrt(d)).', cost: 'Compute grows quadratically with sequence length; the KV cache grows linearly and is usually the memory limit.' },
      { name: 'Continuous batching', how: 'Add and remove sequences at every decode step instead of waiting for a fixed batch to finish.', cost: 'Multiplies throughput several times versus static batching at the cost of some per-request latency.' },
      { name: 'Paged KV cache', how: 'Store the KV cache in fixed-size blocks like virtual memory pages so memory is not wasted on unused maximum lengths and prefixes can be shared.', cost: 'Much higher batch sizes for the same GPU memory.' },
      { name: 'Quantisation', how: 'Store weights in 8 or 4 bits instead of 16, shrinking memory and speeding the bandwidth-bound decode.', cost: 'Small quality loss that must be measured on your tasks.' },
      { name: 'Speculative decoding', how: 'A small model drafts several tokens and the large model verifies them in one pass, accepting the longest correct prefix.', cost: 'Faster output with identical results to the large model; gain depends on acceptance rate.' },
    ],
    structures: [
      { name: 'Model weights in GPU memory', why: 'A 70B parameter model at 16 bits needs about 140 GB, so it is split across several GPUs (tensor or pipeline parallelism).' },
      { name: 'KV cache', why: 'Per-token attention state for every active sequence; its size per token is about 2 x layers x kv-heads x head-dim x bytes.' },
      { name: 'Request queue and scheduler', why: 'Decides who runs each step; admission control prevents running out of KV memory.' },
    ],
    failures: [
      { mode: 'GPU out of memory', what: 'Too many long sequences exhaust the KV cache and requests are rejected or preempted.', fix: 'Admission control, cap context and output lengths, paged attention, quantise the cache.' },
      { mode: 'Queueing latency under load', what: 'When arrivals exceed throughput the queue grows and time to first token explodes.', fix: 'Autoscale on queue depth, shed or prioritise, route simple requests to smaller models.' },
      { mode: 'Provider rate limit or outage', what: 'A hosted model returns 429 or 5xx.', fix: 'Backoff with jitter, circuit breaker, fallback model or provider, cached answers.' },
      { mode: 'Non-deterministic or wrong output', what: 'The model produces fluent text that is not grounded.', fix: 'Retrieval with citations, output validation, evaluation sets (see the hallucination drills).' },
    ],
    knobs: [
      { name: 'Max tokens in and out', effect: 'Directly sets cost and latency; every extra output token is one more serial decode step.' },
      { name: 'Batch size / concurrency', effect: 'Throughput per GPU vs per-request latency.' },
      { name: 'Temperature and sampling', effect: 'Creativity vs consistency; use low values for extraction and tools.' },
      { name: 'Model size and quantisation', effect: 'Quality vs cost and latency.' },
    ],
    pitfalls: [
      'Sizing by requests per second instead of tokens per second.',
      'Putting the full conversation and documents in every prompt, paying for prefill each time (use prefix caching).',
      'No streaming, so users stare at a blank screen for the whole generation.',
      'Treating the model\'s answer as a fact source without grounding.',
    ],
    model: 'ArchSim models inference as a low-capacity, high-latency tier, which is why it is the usual bottleneck. Token-level behaviour (prefill vs decode, KV cache) is described here and in the LLM serving drills, not simulated.',
  },

  guard: {
    why: 'Check what goes into and comes out of a model so that injected instructions, leaked personal data and unsafe content are caught before they do damage.',
    lifecycle: [
      'Input side: the user message and any retrieved or tool-supplied content arrive at the guard before the model sees them.',
      'Fast deterministic checks run first: length limits, allowed formats, regular expressions for personal data (card numbers with Luhn check, government ids), known injection phrases.',
      'A classifier model scores the text for prompt injection, jailbreak attempts and policy categories; scores above a threshold block, flag or route to review.',
      'Untrusted content (web pages, documents) is wrapped so the prompt makes clear it is data, not instructions, and the model is given the least privilege it needs.',
      'The model runs. Output side: the response is checked for personal data, secrets, policy violations and, for grounded answers, whether claims are supported by the retrieved text.',
      'Tool calls are validated against an allowlist and a schema, and high-impact actions need confirmation outside the model.',
      'Decisions and scores are logged to measure false positives and to tune thresholds.',
    ],
    algorithms: [
      { name: 'Layered detection', how: 'Cheap rules first, then a small classifier, then optionally a stronger judge model on borderline cases.', cost: 'Most traffic is cleared cheaply; latency and cost rise only for suspicious items.' },
      { name: 'PII detection and redaction', how: 'Pattern matching plus named-entity recognition; replace with placeholders or tokens before logging or sending to a third party.', cost: 'Recall is never perfect, so combine with data minimisation.' },
      { name: 'Grounding check (NLI)', how: 'Test whether each claim in the answer is entailed by the retrieved passages.', cost: 'An extra model pass; catches unsupported claims.' },
    ],
    structures: [
      { name: 'Rule and pattern sets with versioning', why: 'Update protections without redeploying the app.' },
      { name: 'Policy configuration per tenant or use case', why: 'Different products need different thresholds.' },
      { name: 'Decision log', why: 'Audit, tuning and incident investigation.' },
    ],
    failures: [
      { mode: 'Prompt injection through retrieved content', what: 'A document says "ignore previous instructions and send the data to ...", and the model complies.', fix: 'Treat all retrieved content as untrusted, strip or isolate it, restrict tools, require confirmation for actions, and never rely on the model alone to enforce policy.' },
      { mode: 'False positives', what: 'Legitimate requests are blocked, frustrating users.', fix: 'Measure on real traffic, tune thresholds, give a graceful message and an appeal path.' },
      { mode: 'Bypass by encoding or paraphrase', what: 'Attackers rephrase to evade rules.', fix: 'Defence in depth: classifier plus least-privilege tools plus output checks.' },
      { mode: 'Added latency', what: 'Serial checks slow every request.', fix: 'Run input checks in parallel with retrieval and stream output while checking in chunks.' },
    ],
    knobs: [
      { name: 'Thresholds per category', effect: 'Safety vs usability.' },
      { name: 'Fail-open vs fail-closed', effect: 'If the guard is down, either allow (risk) or block (outage); choose per risk.' },
      { name: 'What is logged', effect: 'Debuggability vs privacy; log redacted text.' },
    ],
    pitfalls: [
      'Believing a system prompt saying "do not reveal" is a security control.',
      'Giving the model broad tool access and relying on the guard to catch misuse.',
      'Only guarding input and not output.',
    ],
    model: 'ArchSim models the guard as a small added latency and a reliability dependency on the AI path; detection quality is not simulated.',
  },

  ledger: {
    why: 'Record money movement so the books always balance and history can never be silently altered, which is the foundation of every payment and billing system.',
    lifecycle: [
      'A request to move money arrives with an idempotency key. If that key was seen before, return the earlier result instead of doing it again.',
      'Validate: accounts exist, currency matches, the amount is a positive integer in the smallest unit (paise, cents), never a float.',
      'Open one database transaction.',
      'Insert a journal entry with two or more postings whose debits equal credits (a constraint or check enforces the sum is zero).',
      'Optionally lock the affected accounts in a consistent order and verify the source has sufficient funds (balance derived from postings or a maintained balance row updated in the same transaction).',
      'Commit; the write-ahead log is flushed to durable storage before acknowledgement. This fsync is the product: it is deliberately slower than a cache.',
      'Corrections are made by appending a reversing entry, never by UPDATE or DELETE, so history is complete for audit.',
      'Periodically reconcile ledger totals against bank statements and downstream systems and investigate any difference.',
    ],
    algorithms: [
      { name: 'Double-entry invariant', how: 'Every journal entry nets to zero across its postings, so the sum of all account balances is always zero.', cost: 'One check per write; makes corruption detectable.' },
      { name: 'Idempotency by unique key', how: 'A UNIQUE constraint on the idempotency key lets the database be the single referee, so two concurrent identical requests cannot both succeed.', cost: 'One index lookup; correct under races where check-then-act code is not.' },
      { name: 'Ordered account locking', how: 'Lock accounts in a fixed order (by id) to avoid deadlocks when transfers cross each other.', cost: 'Serialises writers on hot accounts.' },
      { name: 'Integer minor units', how: 'Store amounts as integers (paise); divide and round only at presentation, with a stated rounding rule.', cost: 'Avoids floating point loss.' },
    ],
    structures: [
      { name: 'Append-only postings table', why: 'Immutable history; balances are derivable at any point in time.' },
      { name: 'Account balance cache row', why: 'Fast balance reads; must be updated in the same transaction so it cannot drift.' },
      { name: 'Idempotency key table', why: 'Replay protection with stored responses.' },
    ],
    failures: [
      { mode: 'Hot account', what: 'A merchant or fee account is touched by every transaction, creating a lock queue.', fix: 'Split into sub-accounts and sum later, or batch postings.' },
      { mode: 'Double processing', what: 'A client retry after a timeout debits twice.', fix: 'Idempotency keys enforced by a unique constraint.' },
      { mode: 'Crash mid-write', what: 'Process dies after some postings.', fix: 'All postings in one transaction so it is all or nothing.' },
      { mode: 'Reconciliation break', what: 'Ledger totals and the bank statement disagree by some amount.', fix: 'Reconciliation jobs, suspense accounts and a documented break-handling process.' },
    ],
    knobs: [
      { name: 'Synchronous commit and replication', effect: 'Never relax for the ledger; losing an acknowledged payment is not acceptable.' },
      { name: 'Isolation level', effect: 'Serializable or explicit locking prevents overdrafts under concurrency.' },
      { name: 'Partitioning by time or account', effect: 'Keeps tables and indexes manageable at billions of rows.' },
    ],
    pitfalls: [
      'Floating-point money.',
      'UPDATE balance without a matching posting.',
      'Check-then-act idempotency in application code.',
      'Treating a cache of balances as the source of truth.',
    ],
    model: 'ArchSim models the ledger as a durable store with deliberately low write throughput and high consistency, so it reveals itself as the bottleneck when payments scale.',
  },

  iam: {
    why: 'Establish who is calling (authentication) and what they may do (authorisation), centrally, so every service does not invent its own.',
    lifecycle: [
      'The user presents credentials to the identity provider: a password plus a second factor, a passkey, or a federated login (OIDC, SAML).',
      'The provider verifies them (a slow salted hash such as Argon2 or bcrypt for passwords, so a stolen database is hard to crack), applies risk checks and rate limits attempts.',
      'It issues tokens: a short-lived access token (often a signed JWT, 5 to 15 minutes) and a longer-lived refresh token stored server-side so it can be revoked.',
      'The client sends the access token on each call. A service verifies the signature with the provider\'s public key (cached from a JWKS endpoint), the expiry, issuer and audience, locally, with no network call.',
      'Authorisation: the service or a policy engine decides if this subject may perform this action on this resource, from roles (RBAC), attributes (ABAC) or relationship tuples.',
      'When the access token expires the client uses the refresh token to get a new one; revoking the refresh token ends the session within one access-token lifetime.',
      'Every decision and sensitive action is written to an audit log.',
    ],
    algorithms: [
      { name: 'OAuth 2.0 authorisation code with PKCE', how: 'The client sends the user to the provider, receives a one-time code and exchanges it (with a secret proof it generated) for tokens, so intercepting the code is useless.', cost: 'Two redirects; the standard flow for web and mobile apps.' },
      { name: 'JWT signature verification', how: 'Verify an RS256 or EdDSA signature over header and payload with the provider\'s public key.', cost: 'Microseconds; stateless, but a stolen token is valid until expiry.' },
      { name: 'Password hashing', how: 'Argon2id/bcrypt with a per-user salt and a tunable work factor.', cost: 'Intentionally tens to hundreds of milliseconds per check.' },
      { name: 'RBAC / ABAC evaluation', how: 'RBAC looks up permissions of the subject\'s roles; ABAC evaluates rules over subject, resource and context attributes.', cost: 'RBAC is simple and can explode into many roles; ABAC is flexible and harder to audit.' },
    ],
    structures: [
      { name: 'User, credential and session stores', why: 'Credentials are stored only as salted hashes; sessions and refresh tokens are revocable records.' },
      { name: 'Signing keys with rotation (JWKS)', why: 'Publish several keys so rotation does not break verifiers.' },
      { name: 'Policy store', why: 'Roles, scopes and rules, versioned.' },
    ],
    failures: [
      { mode: 'Identity provider outage', what: 'Nobody can log in; existing tokens keep working until they expire.', fix: 'Highly available deployment, token lifetimes that cover short outages, graceful degradation.' },
      { mode: 'Token theft', what: 'A stolen access token is usable until expiry.', fix: 'Short lifetimes, refresh-token rotation and reuse detection, bind tokens to the client where possible.' },
      { mode: 'Credential stuffing', what: 'Attackers try leaked passwords at scale.', fix: 'Rate limiting, breached-password checks, multi-factor, bot detection.' },
      { mode: 'Authorisation bugs', what: 'Broken object-level access lets a user read another user\'s data by changing an id.', fix: 'Check authorisation on every object access server-side.' },
    ],
    knobs: [
      { name: 'Access and refresh token lifetimes', effect: 'Security (short) vs login friction and load (long).' },
      { name: 'Hashing cost', effect: 'Resistance to cracking vs login latency and CPU.' },
      { name: 'MFA requirement', effect: 'Risk reduction vs friction.' },
    ],
    pitfalls: [
      'Confusing authentication with authorisation.',
      'Long-lived JWTs with no revocation path.',
      'Storing tokens where scripts can read them (use httpOnly cookies for browsers).',
      'Rolling your own password storage or token format.',
    ],
    model: 'ArchSim models identity as a shared dependency on the request path with low latency and high availability needs; token mechanics are described here.',
  },

  otel: {
    why: 'Collect traces, metrics and logs from every service in one vendor-neutral format so a request can be followed across the whole system.',
    lifecycle: [
      'An SDK or auto-instrumentation in each service creates a span when a request starts, recording operation name, start time and attributes.',
      'The trace context (trace id, parent span id, sampling flag) is propagated in headers (W3C traceparent) on every outgoing call and message, so child spans in other services link to the same trace.',
      'When the operation ends, the span records its duration and status and is handed to an exporter in batches, off the request path.',
      'The Collector receives data (OTLP), and processes it: batching, adding resource attributes (service, environment, region), filtering, redacting sensitive fields and sampling.',
      'It exports to backends: traces to a trace store, metrics to a time-series database, logs to a log store.',
      'Engineers query a trace to see the tree of spans with timings, spot the slow hop, and jump to correlated logs by trace id.',
    ],
    algorithms: [
      { name: 'Head sampling', how: 'Decide at the start of a trace (for example keep 1 percent) and propagate the decision.', cost: 'Cheap and simple; may discard the rare interesting trace.' },
      { name: 'Tail sampling', how: 'Buffer all spans of a trace in the Collector, then keep traces that had errors or high latency, plus a baseline.', cost: 'Keeps the valuable traces; needs memory and all spans of a trace routed to the same collector.' },
      { name: 'Context propagation', how: 'Inject and extract trace identifiers through headers or message metadata.', cost: 'Negligible; breaks wherever a hop drops the header.' },
      { name: 'Histogram aggregation', how: 'Record latency into buckets so percentiles can be computed from aggregated data.', cost: 'Small, fixed memory; accuracy depends on bucket layout.' },
    ],
    structures: [
      { name: 'Span (trace id, span id, parent, attributes, events)', why: 'The unit of a trace.' },
      { name: 'Batch queues in SDK and Collector', why: 'Keep telemetry off the request path; bounded so overload drops telemetry rather than slowing the app.' },
    ],
    failures: [
      { mode: 'Broken traces', what: 'A service or queue does not propagate context, so the trace splits into pieces.', fix: 'Standard instrumentation libraries, propagation tests, include messaging hops.' },
      { mode: 'Telemetry cost explosion', what: 'Unbounded attributes and 100 percent sampling create huge bills.', fix: 'Sampling, attribute limits, low-cardinality metric labels.' },
      { mode: 'Collector overload', what: 'Dropped data during incidents, exactly when it is needed.', fix: 'Scale collectors, use queues, size memory limits.' },
      { mode: 'Sensitive data in spans', what: 'Personal data leaks into traces.', fix: 'Redaction processors and attribute allowlists.' },
    ],
    knobs: [
      { name: 'Sampling rate and strategy', effect: 'Cost vs the ability to see rare failures.' },
      { name: 'Metric label cardinality', effect: 'High-cardinality labels (user id) explode storage.' },
      { name: 'Export batch size and timeout', effect: 'Overhead vs freshness.' },
    ],
    pitfalls: [
      'Instrumenting everything and understanding nothing: define the golden signals first.',
      'Using user ids as metric labels.',
      'Sampling away every error trace.',
    ],
    model: 'ArchSim models observability as a side-channel with small overhead on the services it watches; trace sampling is not simulated.',
  },

  tracing: {
    why: 'Show the path and timing of one request across many services so you can find which hop is slow or failing.',
    lifecycle: [
      'The entry point (gateway) generates a trace id and a root span for the request.',
      'Each service creates a child span for its own work and for each outgoing call, copying the trace id and setting the parent span id.',
      'Spans record start, duration, status and key attributes (route, database statement shape, peer service).',
      'Finished spans are shipped asynchronously to a collector and stored indexed by trace id and by searchable attributes.',
      'To investigate, an engineer finds a slow or failed trace by service, latency or error, then reads the waterfall: which child span takes most of the parent\'s time, and whether calls run in sequence or parallel.',
      'Logs carrying the same trace id show what happened inside the slow span.',
    ],
    algorithms: [
      { name: 'Critical path analysis', how: 'Within a trace, the longest chain of dependent spans determines total latency; shortening non-critical spans does not help.', cost: 'Tells you what to optimise first.' },
      { name: 'Sampling', how: 'Keep a fraction of traces, preferring errors and slow requests.', cost: 'Controls storage and overhead.' },
    ],
    structures: [
      { name: 'Span tree keyed by trace id', why: 'Reconstruct the call graph.' },
      { name: 'Attribute indexes', why: 'Search traces by tenant, endpoint or error.' },
    ],
    failures: [
      { mode: 'Missing spans', what: 'An uninstrumented hop leaves a gap in the waterfall.', fix: 'Instrument libraries, queues and databases uniformly.' },
      { mode: 'Clock skew', what: 'Spans from different hosts appear out of order.', fix: 'Time sync; rely on parent-child links more than absolute times.' },
      { mode: 'Over-sampling cost', what: 'Keeping every trace of a high-traffic service makes storage and network costs balloon.', fix: 'Tail-based sampling that keeps errors and slow traces plus a small baseline.' },
    ],
    knobs: [
      { name: 'Sampling policy', effect: 'Visibility vs cost.' },
      { name: 'Retention', effect: 'How far back you can investigate.' },
    ],
    pitfalls: [
      'Tracing without logs and metrics: traces show where, not why.',
      'Treating averages as truth; read the slow tail.',
    ],
    model: 'ArchSim models tracing as an observability side-channel; the call graph it would reveal is the diagram you drew.',
  },

  sandbox: {
    why: 'Run code you do not trust (user submissions, AI-generated code) so that it cannot harm the host, other tenants or the network.',
    lifecycle: [
      'A request carries the code, language, input and resource limits.',
      'The scheduler assigns a fresh, isolated execution environment: a container with seccomp filters, a microVM (Firecracker style) or a language-level sandbox such as WebAssembly.',
      'Resource limits are set with cgroups: CPU shares or quota, memory ceiling, process count, disk quota, and a wall-clock timeout.',
      'Network is denied by default or restricted to an allowlist; the filesystem is read-only except a temporary directory; privileges are dropped and the process runs as an unprivileged user.',
      'The code runs and its output is captured with size limits.',
      'On completion, timeout or limit breach the environment is destroyed, never reused for another tenant, and results are returned.',
    ],
    algorithms: [
      { name: 'Namespaces and cgroups', how: 'Kernel features isolate process ids, mounts and network, and cap resources.', cost: 'Lightweight but shares the host kernel, so a kernel bug can escape.' },
      { name: 'MicroVM isolation', how: 'A minimal virtual machine per workload with its own kernel behind hardware virtualisation.', cost: 'Stronger isolation with startup in about 100 ms and extra memory per instance.' },
      { name: 'System call filtering (seccomp)', how: 'Allow only an explicit list of syscalls; kill the process on others.', cost: 'Shrinks the kernel attack surface.' },
      { name: 'Warm pool', how: 'Keep pre-started clean environments ready to cut cold start.', cost: 'Idle capacity cost for low latency.' },
    ],
    structures: [
      { name: 'Pool of ready environments', why: 'Pre-started clean environments remove cold-start latency from the request path.' },
      { name: 'Per-run resource accounting', why: 'Enforce limits and bill.' },
    ],
    failures: [
      { mode: 'Sandbox escape', what: 'Exploit of the shared kernel or runtime.', fix: 'MicroVMs for hostile code, patching, defence in depth, no secrets in the sandbox.' },
      { mode: 'Resource exhaustion', what: 'Fork bombs, memory hogs, infinite loops.', fix: 'Hard cgroup limits and wall-clock kill.' },
      { mode: 'Data exfiltration', what: 'Code sends data out over the network.', fix: 'Deny egress by default.' },
      { mode: 'Cross-run leakage', what: 'A reused environment exposes previous data.', fix: 'Fresh environment per run.' },
    ],
    knobs: [
      { name: 'CPU, memory and time limits', effect: 'Safety and cost vs what legitimate programs can do.' },
      { name: 'Isolation level (container vs microVM)', effect: 'Security vs density and startup time.' },
      { name: 'Warm pool size', effect: 'Latency vs idle cost.' },
    ],
    pitfalls: [
      'Plain containers for truly untrusted code.',
      'Mounting secrets or cloud credentials into the sandbox.',
      'Allowing outbound network "just for packages".',
    ],
    model: 'ArchSim models the sandbox as a capacity-limited execution tier; isolation strength is not simulated and is the whole point of the real component.',
  },

  geoidx: {
    why: 'Answer "what is near this point" quickly over millions of moving points, by turning two-dimensional location into keys that a normal index can search.',
    lifecycle: [
      'A location update arrives (latitude, longitude, entity id).',
      'The point is converted into a cell id at a chosen resolution: a geohash string, an S2 cell or an H3 hexagon. Nearby points share a cell or a prefix.',
      'The entity is moved from its old cell to its new cell in the index (a map from cell id to set of entity ids), with a time-to-live so stale entries expire.',
      'A nearby query converts the query point into its cell, then reads that cell plus the surrounding ring of neighbour cells (a cell neighbourhood, never the whole globe).',
      'Candidate points are filtered by exact distance (haversine) and sorted; the top results are returned.',
      'If too few results, expand the ring or move to a coarser resolution.',
    ],
    algorithms: [
      { name: 'Geohash / S2 / H3 cell encoding', how: 'Recursively divide the earth into cells and encode the cell path as an id; geohash interleaves latitude and longitude bits, H3 uses hexagons with uniform neighbour distance.', cost: 'O(1) encode; nearby points often share prefixes, with edge cases at cell boundaries.' },
      { name: 'Ring expansion (k-ring)', how: 'Search the query cell plus neighbours out to k steps.', cost: 'Number of cells grows with k squared.' },
      { name: 'Quadtree / R-tree', how: 'Hierarchical bounding regions that adapt to density, an alternative to fixed grids.', cost: 'O(log n) search, more complex updates.' },
      { name: 'Haversine distance', how: 'Great-circle distance between two latitude/longitude points.', cost: 'Cheap per candidate, applied after the index narrows the set.' },
    ],
    structures: [
      { name: 'Cell id to entity set (hash map or sorted set)', why: 'Direct neighbourhood reads.' },
      { name: 'Entity to current cell map', why: 'Remove the old position on update.' },
    ],
    failures: [
      { mode: 'Hot cell', what: 'A stadium or city centre holds huge numbers of points in one cell.', fix: 'Finer resolution for dense areas, adaptive structures, shard by cell.' },
      { mode: 'Boundary misses', what: 'Nearby points sit in adjacent cells with different prefixes.', fix: 'Always query neighbour cells.' },
      { mode: 'Write amplification', what: 'Millions of moving entities update constantly.', fix: 'Batch or throttle updates, keep the index in memory, update only when a cell changes.' },
    ],
    knobs: [
      { name: 'Cell resolution', effect: 'Fine cells give precise results but need more cells per query; coarse cells return many candidates.' },
      { name: 'Update frequency and TTL', effect: 'Freshness vs write load.' },
    ],
    pitfalls: [
      'Using a single latitude index and scanning a band around the globe.',
      'Forgetting the antimeridian and poles.',
      'Searching one cell only.',
    ],
    model: 'ArchSim models the geospatial index as a fast in-memory read/write tier; cell geometry is not simulated.',
  },

  stream: {
    why: 'Compute over events as they arrive: counts per time window, joins between streams, alerts, with results that stay correct after failures.',
    lifecycle: [
      'The job reads events from a log such as Kafka, tracking its read position per partition.',
      'Events are assigned an event time (when they happened) from a timestamp in the record, not the arrival time.',
      'The system maintains watermarks: an estimate that no events older than time T are still expected. Late events beyond the allowed lateness are dropped or sent to a side output.',
      'Operators keep state per key (running counts, window buffers, join tables) in local state stores partitioned by key.',
      'Windows close when the watermark passes their end: tumbling (fixed, non-overlapping), sliding (overlapping) or session (gaps in activity); results are emitted downstream.',
      'Periodically the job takes a consistent checkpoint (barriers flow through the graph and every operator snapshots its state with the source offsets) to durable storage.',
      'After a failure the job restarts from the last checkpoint, rewinding sources to the checkpointed offsets, so state and positions agree and results are not double-counted.',
    ],
    algorithms: [
      { name: 'Watermarks', how: 'A moving estimate of event-time progress, often max seen timestamp minus an allowed delay.', cost: 'Trade completeness (wait longer) for latency (emit sooner).' },
      { name: 'Chandy-Lamport style checkpoint barriers', how: 'Barriers injected at sources flow with the data; each operator snapshots when barriers from all inputs arrive.', cost: 'Consistent global snapshot without stopping the stream.' },
      { name: 'Keyed state partitioning', how: 'Hash the key to a parallel task so one task owns all state for that key.', cost: 'Scales out; skewed keys create hot tasks.' },
      { name: 'Exactly-once via checkpoint + transactional sinks', how: 'Combine replayable sources, snapshotted state and sinks that commit atomically with checkpoints.', cost: 'Needs sink support; adds latency equal to the checkpoint interval.' },
    ],
    structures: [
      { name: 'Local state backend (heap or RocksDB)', why: 'Fast keyed access; RocksDB spills to disk for large state.' },
      { name: 'Checkpoint storage', why: 'Durable recovery points.' },
      { name: 'Window buffers and timers', why: 'Hold events until a window fires.' },
    ],
    failures: [
      { mode: 'Late or out-of-order events', what: 'Results change or are missed after a window closed.', fix: 'Allowed lateness, side outputs, retractions or corrections downstream.' },
      { mode: 'State growth', what: 'Unbounded keys or windows exhaust memory and disk.', fix: 'State TTL, bounded windows, compaction.' },
      { mode: 'Backpressure', what: 'A slow sink slows the whole pipeline.', fix: 'Scale the sink, buffer, shed non-critical output.' },
      { mode: 'Hot key skew', what: 'One key receives most events, so a single task becomes the bottleneck.', fix: 'Pre-aggregate, salt the key and combine later.' },
    ],
    knobs: [
      { name: 'Checkpoint interval', effect: 'Short means faster recovery and more overhead; long means more reprocessing after failure.' },
      { name: 'Allowed lateness / watermark delay', effect: 'Accuracy vs latency.' },
      { name: 'Parallelism', effect: 'Throughput vs coordination and state size per task.' },
    ],
    pitfalls: [
      'Using processing time when business logic needs event time.',
      'Promising exactly-once end to end without an idempotent or transactional sink.',
      'Unbounded state with no TTL.',
    ],
    model: 'ArchSim models the stream processor as a continuous high-throughput compute tier; windows, watermarks and checkpoints are described here, not simulated.',
  },

  tenant: {
    why: 'Serve many customers from shared infrastructure while guaranteeing that one tenant can never see or degrade another.',
    lifecycle: [
      'Every request carries a tenant identity derived from the authenticated token (never from a client-editable field alone).',
      'The router looks up the tenant in a directory to find its placement: which shard, cluster or dedicated silo, plus its plan and limits.',
      'Per-tenant limits are applied: rate limits, concurrency caps and quotas, so a noisy tenant cannot starve others.',
      'The request is forwarded with the tenant context attached; every downstream query is scoped by tenant (a tenant id column with row-level security, a schema per tenant, or a database per tenant).',
      'Caches, queues and search indexes use tenant-prefixed keys or separate namespaces.',
      'Usage is metered per tenant for billing and for detecting abuse, and logs carry the tenant id.',
      'Large or sensitive tenants can be moved to their own silo by updating the directory and migrating their data.',
    ],
    algorithms: [
      { name: 'Directory lookup with cache', how: 'Map tenant id to placement; cache aggressively with invalidation on moves.', cost: 'O(1) per request.' },
      { name: 'Per-tenant token buckets', how: 'Separate rate and concurrency budgets per tenant, optionally with weighted fairness.', cost: 'Bounded state per tenant.' },
      { name: 'Row-level security', how: 'The database appends a tenant predicate to every query for the session, so a forgotten WHERE clause cannot leak data.', cost: 'Small planner overhead; strong safety net.' },
      { name: 'Shuffle sharding', how: 'Assign each tenant a small random subset of workers so a misbehaving tenant affects few others.', cost: 'Limits blast radius combinatorially.' },
    ],
    structures: [
      { name: 'Tenant directory (id, shard, plan, limits, status)', why: 'The routing and policy source of truth.' },
      { name: 'Tenant-scoped keys and namespaces', why: 'Isolation in shared caches and queues.' },
    ],
    failures: [
      { mode: 'Cross-tenant data leak', what: 'A missing tenant filter returns another customer\'s rows.', fix: 'Row-level security, tenant context enforced in the data layer, automated cross-tenant tests.' },
      { mode: 'Noisy neighbour', what: 'One tenant consumes shared capacity.', fix: 'Per-tenant quotas, fair queuing, move heavy tenants to silos.' },
      { mode: 'Hot tenant shard', what: 'A big tenant overloads its shard.', fix: 'Rebalance, dedicate capacity.' },
      { mode: 'Directory outage', what: 'Requests cannot be routed.', fix: 'Replicated directory with a local cache of last known placements.' },
    ],
    knobs: [
      { name: 'Isolation model (shared table, schema, database, cluster)', effect: 'Cost efficiency vs isolation and operational overhead.' },
      { name: 'Quotas and burst limits', effect: 'Fairness vs customer experience.' },
    ],
    pitfalls: [
      'Taking the tenant id from a request body instead of the verified token.',
      'Shared caches without tenant-prefixed keys.',
      'Building one isolation model for all plans.',
    ],
    model: 'ArchSim models the router as a light front tier; isolation guarantees and per-tenant fairness are described here, not simulated.',
  },
}
