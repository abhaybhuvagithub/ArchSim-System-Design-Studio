// Internal working details for each component type
// Shows algorithms, data structures, queuing, consistency mechanisms, etc.

export const COMPONENT_INTERNALS = {
  // Traffic & Edge
  client: {
    algorithm: 'Request generation',
    dataStructure: 'Poisson process for inter-arrival times',
    internal: 'Generates traffic at RPS rate with exponential backoff for retries.',
    mechanism: 'No queuing. Each request either succeeds or fails immediately.',
  },
  gslb: {
    algorithm: 'Geo-routing + health checks',
    dataStructure: 'Route53 policy engine, health check history',
    internal: 'Evaluates latency, geo-location, and failover policies to direct requests to the optimal regional endpoint.',
    mechanism: 'Active health checks every 30s. Propagates to authoritative nameservers within ~60s.',
  },
  cdn: {
    algorithm: 'LRU cache + geo-replication',
    dataStructure: 'In-memory cache at edge locations, origin pull queue',
    internal: 'Stores frequently accessed objects across 200+ edge locations. On miss, pulls from origin and caches locally.',
    mechanism: 'Cache-Control headers set TTL. Purge takes up to 5 minutes to propagate.',
  },
  waf: {
    algorithm: 'Rule evaluation (regex + pattern matching)',
    dataStructure: 'Compiled WAF rules, IP blocklist, rate-limit counters',
    internal: 'Evaluates each request against 100+ rules (SQL injection, XSS, DDoS patterns). Blocks or logs based on rule action.',
    mechanism: 'Rules evaluated in order. First match wins. Blocked requests get 403 response.',
  },
  lb: {
    algorithm: 'Least Connections or Round Robin',
    dataStructure: 'Active connection map per backend, health status bitmap',
    internal: 'Tracks active connections and sends new requests to instance with fewest active connections. Unhealthy instances removed.',
    mechanism: 'Health checks every 5s. Connection draining on shutdown (max 30s wait).',
  },
  gateway: {
    algorithm: 'API routing + request transformation',
    dataStructure: 'Route table (trie for path matching), request context map',
    internal: 'Matches path/method to service. Adds auth headers, request ID, traces. Forwards to backend.',
    mechanism: 'Routes can be condition-based (header, query param). Timeouts enforced per route.',
  },
  ratelimiter: {
    algorithm: 'Token bucket (per-tenant)',
    dataStructure: 'Token bucket per tenant ID, sliding window counter for enforcement',
    internal: 'Refills `capacity` tokens per second per tenant. Each request costs 1 token. If no tokens left, request rejected.',
    mechanism: 'Refill happens in background. Sliding window de-amortizes bursts over time.',
  },

  // Compute
  app: {
    algorithm: 'Request handler + state machine',
    dataStructure: 'In-process cache, connection pools to databases, error queue',
    internal: 'Receives request, looks up data (cache → DB), applies business logic, returns response. Retries failed downstream calls.',
    mechanism: 'Exponential backoff for retries: 100ms, 400ms, 1.6s. Circuit breaker opens after 5 failures.',
  },
  web: {
    algorithm: 'Template rendering + asset serving',
    dataStructure: 'Template cache, static file metadata, session store',
    internal: 'Renders HTML from templates with user-specific data. Serves CSS/JS/images from CDN or disk.',
    mechanism: 'ETag-based caching for static assets. Sessions stored in shared cache (Redis) for horizontal scaling.',
  },
  worker: {
    algorithm: 'Queue consumer (FIFO or priority)',
    dataStructure: 'Job queue (SQS/Kafka), retry deadletter queue, job state map',
    internal: 'Polls queue for jobs. Executes each job (send email, resize image, run analytics). Acknowledges on success or re-queues on failure.',
    mechanism: 'Visibility timeout (job locked for 5 min). Max retries before deadletter. Exponential backoff between retries.',
  },
  micro: {
    algorithm: 'RPC handler (gRPC or REST)',
    dataStructure: 'Service registry (local), metrics emitter, tracing context',
    internal: 'Receives RPC call (decoded from Protobuf or JSON). Calls database/cache. Returns response (encoded).',
    mechanism: 'Tracing injected via context propagation. Metrics (latency, errors) emitted asynchronously.',
  },
  grpc: {
    algorithm: 'Binary RPC (HTTP/2 multiplexed)',
    dataStructure: 'Message schema (Protobuf), bidirectional stream state',
    internal: 'Marshals request to Protobuf binary. Sends over HTTP/2 stream. Unmarshals response. Multiplexing means many requests share one TCP connection.',
    mechanism: 'HTTP/2 flow control prevents send buffer overflow. Keepalive heartbeats every 30s.',
  },
  ws: {
    algorithm: 'WebSocket connection pool',
    dataStructure: 'Connection map (client ID → socket), message queue per connection, subscription registry',
    internal: 'Maintains persistent TCP connection per client. Receives subscriptions (e.g., "alerts for order ID 123"). Pushes matching events to subscribed clients.',
    mechanism: 'Broadcasting: when event occurs, iterate subscription map and send to matching clients. Backpressure if write buffer full.',
  },

  // Storage
  cache: {
    algorithm: 'LRU eviction + TTL expiry',
    dataStructure: 'Hash table for O(1) lookup, doubly-linked list for LRU order, TTL queue',
    internal: 'On GET: hash table lookup (≈2us). On SET: update hash table, move to head of LRU list. On eviction: remove LRU tail.',
    mechanism: 'TTL entries checked lazily (on access) or via background expiry thread every 100ms. Partial replication for HA.',
  },
  sql: {
    algorithm: 'B-tree indexes + MVCC (multi-version concurrency)',
    dataStructure: 'B-tree for indexes, write-ahead log (WAL), undo logs for MVCC',
    internal: 'Write: append to WAL (disk sync 10ms), update in-memory buffer. Commit when WAL written. Read: scan B-tree index or table scan depending on query plan.',
    mechanism: 'MVCC: reads see consistent snapshot at transaction start time. Conflicts detected at commit time. Rollback undoes via undo log.',
  },
  nosql: {
    algorithm: 'LSM tree (Log-Structured Merge)',
    dataStructure: 'In-memory tree (memtable), immutable SSTables on disk, Bloom filters',
    internal: 'Writes go to in-memory memtable (sequential I/O). When full, flush to disk as SSTable (sorted). Reads check memtable, then SSTables (using Bloom filters to skip non-matching files).',
    mechanism: 'Compaction merges SSTables in background to reduce read amplification. Tunable: write-optimized (fast writes) vs read-optimized (fast reads).',
  },
  search: {
    algorithm: 'Inverted index + BM25 ranking',
    dataStructure: 'Hash map: term → list of document IDs (posting lists), term frequency/doc frequency stats',
    internal: 'Index: tokenize document text, build posting lists. Query: tokenize query, lookup posting lists, rank by BM25 score (frequency + inverse-doc-frequency).',
    mechanism: 'Incremental indexing: new docs added to temporary segment, merged into main index hourly. Caching of common queries.',
  },
  blob: {
    algorithm: 'Content-hash sharding + erasure coding',
    dataStructure: 'Sharded key-value store (millions of objects per shard), replica metadata map',
    internal: 'Hash object key to shard (consistent hash). Store 3 replicas across zones. Metadata indexed by (bucket, key) for O(1) lookup.',
    mechanism: 'Durability: 3-way replication + async validation. On put, return 200 after 2 of 3 ACK. Async rebalance if replica lost.',
  },
  backup: {
    algorithm: 'Incremental snapshots + copy-on-write',
    dataStructure: 'Snapshot manifest (list of blocks), dedup index (hash → block ID)',
    internal: 'Full snapshot: copy all blocks to archive storage. Incremental: hash each block, store only new/changed blocks. Dedup reduces storage.',
    mechanism: 'Snapshots retained for 30 days (configurable). Cross-region replica kept for disaster recovery.',
  },

  // Async & Queues
  queue: {
    algorithm: 'Distributed FIFO queue',
    dataStructure: 'Queue head pointer, tail pointer, visibility timeout map, delivery count map',
    internal: 'Producer: append message to queue (atomic increment of tail). Consumer: read from head, lock message (visibility timeout 30s). Ack removes from queue.',
    mechanism: 'Duplicate detection (24h window): track message ID dedup set. Failed messages go to deadletter queue after 3 retries.',
  },
  kafka: {
    algorithm: 'Append-only log + partitioning',
    dataStructure: 'Per-partition log file (pages in sequence), offset index, consumer offset tracker',
    internal: 'Produce: append to partition log (all writes sequential). Consume: read from offset, track consumer group offset. Rebalancing: partition reassigned to consumer on failure.',
    mechanism: 'Replication: leader partition writes, replicas pull from leader. Commit when all in-sync replicas ACK.',
  },
  mq: {
    algorithm: 'Transactional publish-subscribe',
    dataStructure: 'Topic subscription map, transaction ledger, acknowledgment tracking',
    internal: 'Publish: enlist in transaction. Subscribers consume within transaction scope. Commit: all-or-nothing (two-phase commit).',
    mechanism: 'Dead-letter handling: failed subscriptions after retries sent to DLQ. Message ordering per partition guaranteed.',
  },

  // Data & Analytics
  cdc: {
    algorithm: 'Log tailing + transformation',
    dataStructure: 'WAL (write-ahead log) tail position, schema registry, transformation pipeline state',
    internal: 'Tail database WAL (captures all writes). Parse row changes. Apply transformation (schema mapping, filtering). Emit to downstream sink (Kafka, data warehouse).',
    mechanism: 'Exactly-once semantics: store processed offset in state store. Recover from that offset on restart.',
  },
  etl: {
    algorithm: 'Parallel batch processing (Spark)',
    dataStructure: 'RDD (Resilient Distributed Dataset) lineage, shuffle stage map',
    internal: 'Read source data (partitioned). Map: apply transformation per partition in parallel. Shuffle: redistribute by key. Reduce: aggregate across shuffled data.',
    mechanism: 'Fault tolerance via lineage: if partition lost, recompute from source. Spillover to disk if shuffle size exceeds memory.',
  },
  warehouse: {
    algorithm: 'Columnar storage + query optimization',
    dataStructure: 'Parquet files (columnar), query plan optimizer, query result cache',
    internal: 'Store data in columns (not rows) → better compression. Query: read only needed columns. Pushdown: filter pushes to storage layer to avoid scanning.',
    mechanism: 'Partitioning by date. Clustering by common query key. Stats (min/max per partition) prune unnecessary data.',
  },

  // AI / ML
  llm: {
    algorithm: 'Transformer with KV cache + quantization',
    dataStructure: 'Model weights (matrix), KV cache per request, attention mask',
    internal: 'Process tokens sequentially. Cache previous K and V matrices (KV cache) so re-computing at step N only does N, not 1..N. Quantization (int8) reduces memory footprint.',
    mechanism: 'Batch inference: process multiple requests in parallel (batch size tuned to GPU memory). Dynamic batching waits up to 10ms to fill batch.',
  },
  embed: {
    algorithm: 'Embedding projection + cosine similarity',
    dataStructure: 'Embedding matrix (vocab size × 768), L2-normalized cache',
    internal: 'Convert text to embedding via neural network (768-dim vector). L2-normalize. Store in cache. Similarity query: cosine product between query and document embeddings.',
    mechanism: 'Batched inference: embed multiple documents together. Caching common queries (e.g., product descriptions).',
  },
  vector: {
    algorithm: 'Approximate Nearest Neighbor (ANN) index',
    dataStructure: 'HNSW graph (navigable small-world), quantized vectors (int8 compressed)',
    internal: 'Index construction: insert vectors into HNSW graph (log(N) layers). Query: start at top layer, greedily search nearest neighbors, move to next layer. Return top-K.',
    mechanism: 'Recall tuning: ef_search parameter (larger = slower, more accurate). Dynamic re-indexing on new data.',
  },
  ml: {
    algorithm: 'Inference server (batching + caching)',
    dataStructure: 'Model registry, request queue, batch accumulator, cache of recent predictions',
    internal: 'Receive request, check prediction cache (hit = serve immediately). Accumulate requests into batch (10 requests, max 100ms wait). Run inference on GPU. Cache result.',
    mechanism: 'Model versioning: shadow traffic splits (10% new, 90% old) before rollout. A/B testing via request header.',
  },
  guard: {
    algorithm: 'Classifier ensemble + threshold',
    dataStructure: 'Model weights, feature extractors, prediction cache',
    internal: 'Extract features from input (text length, keywords, toxicity signals). Run 3 classifiers (bayes, NN, regex). Ensemble: majority vote. If score > threshold, block.',
    mechanism: 'Real-time feedback loop: flagged content reviewed by human, label fed back to training pipeline (retraining weekly).',
  },

  // Google AI & LLMs
  gemini3: {
    algorithm: 'Mixture of Experts (MoE) + multimodal attention',
    dataStructure: 'Model weights (Mixture of Experts layers), context cache per session, KV cache for tokens',
    internal: 'Process text/image/audio/video input → Tokenize each modality → Expert routing (select 5-10 experts per token) → FFN layers → Logits.',
    mechanism: 'Context caching: store first N tokens\' KV cache in GPU memory (reuse for follow-up queries). Batch multiple users\' requests (20-100) on same GPU. Dynamic quantization (fp8).',
  },
  gemini2: {
    algorithm: 'Transformer with deep reasoning layers',
    dataStructure: 'Model weights, reasoning traces, token embeddings, attention heads',
    internal: 'Input → Encoder stack → Reasoning module (multiple passes) → Decoder → Output. Reasoning adds chain-of-thought reasoning before output.',
    mechanism: 'Deep Think: user marks questions as "think hard" → allocates more compute (10-60s latency instead of 2s). Structured outputs: JSON schema provided, model respects shape.',
  },
  notebooklm: {
    algorithm: 'RAG with citation grounding',
    dataStructure: 'Document embeddings, citation index, memory store for session context',
    internal: 'User uploads PDF/Doc → Chunk into paragraphs → Embed each chunk → Store in vector index. Query: embed question → retrieve top-5 chunks → augment prompt → call Gemini → cite source.',
    mechanism: 'Multi-modal source support: PDFs, Google Docs, YouTube transcripts, web links. Audio notebook: generate podcast-style overview (text-to-speech). One-click study guide generation.',
  },
  antigravity: {
    algorithm: 'Agentic loop: plan → execute → verify',
    dataStructure: 'Task queue, action log, file system state, VSCode diff state, terminal output buffer',
    internal: 'User sets goal (e.g., "Add pagination to User list") → AI plans steps → Agent executes (writes code, runs tests, updates git) → Verifies output → Shows artifacts (screenshots, test results).',
    mechanism: 'Two interfaces: Editor (familiar VSCode + sidebar agent) and Manager (mission control for orchestration). Multi-agent parallelism: fetch data, write code, run tests concurrently. Requires confirmation for destructive ops (git push, rm -rf).',
  },
  vertexai: {
    algorithm: 'Orchestration platform for ML workflows',
    dataStructure: 'Model registry, pipeline DAG, experiment tracking, deployment configs',
    internal: 'Define pipeline (stages: preprocess → train → eval → deploy). Vertex runs each stage on GCP infrastructure. Logs metrics, model artifacts, predictions. Auto-scales compute.',
    mechanism: 'Model garden: one-click fine-tuning (upload dataset, select model, train, deploy). Duet AI: code generation suggestions. Agent builder: drag-drop no-code agent builder.',
  },
  imagen: {
    algorithm: 'Diffusion model with text-to-image guidance',
    dataStructure: 'UNet denoiser, CLIP text encoder, noise scheduler, latent diffusion space',
    internal: 'Start with Gaussian noise → Text prompt embedded with CLIP → Iterative denoising (50-100 steps) → Classifier-free guidance → RGB output.',
    mechanism: 'Image editing: inpainting (mask region, describe changes). Style control: style modifiers (oil painting, 3D render, cartoon). Prompt optimizer: rewrites prompts for better results.',
  },
  veo: {
    algorithm: 'Diffusion model over video tokens',
    dataStructure: 'Temporal attention layers, video token embeddings, keyframe predictions',
    internal: 'Encode video as sequence of tokens → Diffusion over temporal dimension → Generate one frame at a time while maintaining consistency with previous frames.',
    mechanism: 'Variable length (up to 5min). Frame consistency: uses optical flow to constrain motion between frames. Style preservation: apply same style to all frames. Runs on Google Cloud (high latency, high cost).',
  },
  astra: {
    algorithm: 'Real-time multimodal perception',
    dataStructure: 'Video stream buffer, frame encoder, tokenizer, working memory',
    internal: 'Capture camera/screen 10 fps → Extract key frames → Embed into vision tokens → Multimodal attention → Output (text, actions). Real-time streaming over WebRTC.',
    mechanism: 'Latency: 100-500ms (goal: <200ms). Runs on Gemini 3 on Google Cloud. Limited simultaneous sessions per quota. Works with device camera, desktop screen share, or uploaded images.',
  },
  mariner: {
    algorithm: 'Web automation via LLM plan + executor',
    dataStructure: 'Browser state snapshot, DOM tree cache, action sequence, memory of page structure',
    internal: 'User provides goal (e.g., "Log in and fetch email count") → LLM analyzes current page → Plans sequence of clicks/inputs → Executor fires actions → Screenshot/verify.',
    mechanism: 'Runs in headless Chrome on GCP. Supports: login automation, form filling, data extraction, multi-page workflows. Requires human approval before real-world execution on customer accounts.',
  },
  beam: {
    algorithm: 'Low-latency video codec + spatial audio mixing',
    dataStructure: 'Video frame buffer, audio sample queue, spatial position map, bitrate controller',
    internal: 'Capture participant video → Encode (AV1 or VP9) → 3D position mapping → Render spatial audio → Stream over WebRTC. Decode on receiver, render in 3D space.',
    mechanism: 'Latency: <100ms target. Spatial awareness: mute participants who are "behind" you. Screen sharing: transmit at 60fps, up to 1440p.',
  },
  gemmaos: {
    algorithm: 'Transformer LLM (2B, 7B, 27B variants)',
    dataStructure: 'Model weights (quantized int8), attention heads, feed-forward layers',
    internal: 'Standard decoder-only transformer. Smaller than Gemini (7B = 7 billion params). Runs on laptop (7B) or phone (2B). No external API call needed.',
    mechanism: 'On-device inference: uses quantization (int8), distillation, pruning. Latency: 100-500ms per token on M1 Mac. Perfect for privacy-sensitive tasks (no data leaves device).',
  },
  duetai: {
    algorithm: 'Prompt routing + service-specific adapters',
    dataStructure: 'Prompt templates per GCP service, model selection rules, context injection',
    internal: 'User types "/" in Cloud Console (Docs, SQL, Terraform) → Context captured → Routed to Gemini with service-specific prompt → Generated completion (code, config, schema).',
    mechanism: 'Context-aware: understands existing code/config files. Suggests fixes, generates YAML, builds SQL queries. Quality: trained on Google Cloud docs + customer code patterns.',
  },
  agentgraph: {
    algorithm: 'Stateful graph execution with cycles + checkpoints',
    dataStructure: 'Directed graph of agent nodes, shared state object, checkpoint store (per-thread), tool registry',
    internal: 'State enters the graph -> current node (planner/agent/tool) runs -> returns state delta + next-edge decision -> checkpoint persisted -> repeat until END node. Cycles are legal: reflect, retry, re-plan.',
    mechanism: 'Checkpointing makes runs resumable and debuggable: crash mid-graph, resume from the last node. Human-in-the-loop = a node that pauses the thread until input arrives. Parallel branches fan out and join on state merge.',
  },
  finetune: {
    algorithm: 'LoRA: low-rank adapter training on a frozen base',
    dataStructure: 'Frozen base weights, small rank-r adapter matrices (A x B) per attention layer, training dataset shards, optimizer state',
    internal: 'Base model loads frozen (optionally 4-bit quantized = QLoRA) -> only adapter matrices receive gradients -> train on task pairs -> save the adapter (MBs, not GBs).',
    mechanism: 'Serving: merge the adapter into the base, or hot-swap adapters per tenant on one shared base. Rank r trades quality vs size. QLoRA fits 70B-class training on a single GPU by quantizing the frozen weights.',
  },
  llmobs: {
    algorithm: 'Trace tree ingestion + eval scoring',
    dataStructure: 'Trace tree (root span -> chain steps -> LLM calls), token/cost counters per span, eval datasets, score tables',
    internal: 'SDK wraps each chain step -> emits spans with prompt, completion, tokens, latency, cost -> ingested async -> trace tree reassembled by id for the UI.',
    mechanism: 'Evals: run a dataset through the chain, score outputs (exact, LLM-as-judge, human) and diff across versions. Cost attribution rolls tokens up per user, feature and prompt version -- the bill finally has names.',
  },
  aiagent: {
    algorithm: 'Agentic loop with tool calling + RAG',
    dataStructure: 'Tool registry, execution graph, conversation memory, confidence scores',
    internal: 'User defines tools (API calls, data queries, external services) → Vertex Agent Builder chains them → Agent decides tool sequence via LLM reasoning → Executes with safety gates.',
    mechanism: 'Safety: tool definitions include preconditions/postconditions. Memory: retrieval-augmented context for each step. Multi-turn: maintains conversation state across steps. Monitoring: all tool calls logged for audit.',
  },

  // Observability
  otel: {
    algorithm: 'Span batching + sampling',
    dataStructure: 'Span queue (circular buffer), batch accumulator, sampling decision map',
    internal: 'Receive spans from SDKs. Batch into groups of 100 (or every 5s). Apply sampling (e.g., 1% of traces). Export to backend.',
    mechanism: 'Head-based sampling: SDKs decide if trace is sampled (1% by default). Tail-based sampling at collector: if error/slow, keep 100% of trace even if SDK sampled out.',
  },
  monitor: {
    algorithm: 'Time-series database + cardinality control',
    dataStructure: 'TSDB (time-series sharded by metric name), scrape config, relabeling rules',
    internal: 'Scrape target (/metrics endpoint) every 15s. Parse Prometheus text format. Compress & store in TSDB (one value per timestamp per label combo).',
    mechanism: 'Cardinality limits: warn if label combinations exceed 10k (runaway cardinality = memory explosion). Retention: keep 15 days (configurable).',
  },
  logs: {
    algorithm: 'Inverted index + full-text search',
    dataStructure: 'Log buffer (circular), index per time window, field tokenizer',
    internal: 'Receive JSON logs. Parse fields (timestamp, level, message, trace_id). Index by timestamp + trace_id. For query: lookup matching logs, return to user.',
    mechanism: 'Sampling on ingestion: high-volume services (1000+ logs/s) sampled at 10% to reduce cost. Structuring enforced (JSON only, no text blobs).',
  },
  tracing: {
    algorithm: 'Span deduplication + tail-based sampling',
    dataStructure: 'Span storage (indexed by trace_id), dependency graph (service → service calls)',
    internal: 'Receive span from SDK. If trace_id seen before, append span to trace. If tail span (no children), finalize trace. Store if sampled.',
    mechanism: 'Tail-based sampling: if trace has error/latency > threshold, keep 100% of trace. Otherwise sample at 1%. Dependency graph built from span parents.',
  },

  // Security
  iam: {
    algorithm: 'Role-based access control (RBAC) + attribute-based (ABAC)',
    dataStructure: 'User → role mapping, role → permission mapping, policy cache',
    internal: 'Check if user has role. If role has permission for action, allow. If attribute-based, evaluate condition (e.g., department == "eng" AND region == "us-west").',
    mechanism: 'Policy cache invalidated on role change (TTL 5 min). Audit log: all access decisions logged asynchronously.',
  },
  secrets: {
    algorithm: 'Encryption at rest + rotation',
    dataStructure: 'Secret store (encrypted), key encryption key (KEK), audit log',
    internal: 'Store secret: encrypt with KEK, store ciphertext. Retrieve: decrypt with KEK, return plaintext to caller (in-memory only).',
    mechanism: 'Rotation: generate new key, re-encrypt all secrets, update applications. TTL: secrets expire (TTL 90 days), apps notified to refresh.',
  },
  tls: {
    algorithm: 'TLS 1.3 + certificate pinning',
    dataStructure: 'Certificate store, trusted CA list, pinned certificate set',
    internal: 'TLS handshake: exchange certificates, derive session keys. All subsequent traffic encrypted with session key. Certificate pinning: only allow specific cert (not just any cert from trusted CA).',
    mechanism: 'Certificate rotation: new cert deployed 30 days before expiry. Old cert kept for backward compat during transition.',
  },

  // ── Full coverage: every remaining palette type ──
  dns: {
    algorithm: 'Hierarchical resolution with aggressive TTL caching',
    dataStructure: 'Zone files, resource-record sets (A/AAAA/CNAME/NS), resolver cache keyed by (name, type)',
    internal: 'Resolver walks root -> TLD -> authoritative, caching each answer for its TTL. Anycast puts the same IP in many cities; BGP routes each client to the nearest instance.',
    mechanism: 'Weighted/latency/geo routing policies pick among record sets. Health checks pull dead endpoints out of answers. Low TTL = fast failover but more query load.',
  },
  k8sgw: {
    algorithm: 'Envoy xDS: dynamic config push to data-plane proxies',
    dataStructure: 'Gateway/HTTPRoute custom resources, Envoy route tables, cluster + endpoint sets',
    internal: 'Controller watches Gateway API resources -> compiles them to Envoy config -> pushes over xDS streams. Requests hit Envoy pods which route by host/path/header to Services.',
    mechanism: 'Config is eventually consistent across proxies (seconds). Filters chain per route: authn, rate limit, rewrite. Canary = weighted backend refs on one HTTPRoute.',
  },
  grpcgw: {
    algorithm: 'Protocol transcoding: HTTP/JSON <-> gRPC/protobuf',
    dataStructure: 'Compiled proto descriptors, method routing table, HTTP annotation map (google.api.http)',
    internal: 'Incoming REST call matches an annotated route -> JSON body maps onto the request message by field name -> gRPC call upstream -> response message serialized back to JSON.',
    mechanism: 'Streaming maps to chunked responses or websockets. Errors translate status codes (NOT_FOUND -> 404). The proto file is the contract; drift between it and clients is the classic outage.',
  },
  scheduler: {
    algorithm: 'Priority queue over cron expressions + distributed locking',
    dataStructure: 'Min-heap ordered by next-fire-time, cron parse trees, lease/lock records per job',
    internal: 'Tick: pop everything due from the heap, acquire a per-job lock (so replicas don\'t double-fire), enqueue the work, compute next fire time, push back.',
    mechanism: 'Misfire policy decides what happens after downtime: fire-once-now, skip, or catch-up-all. Jitter spreads thundering herds of :00 jobs. The lock TTL must outlive slow job dispatch.',
  },
  zk: {
    algorithm: 'ZAB atomic broadcast over a replicated tree',
    dataStructure: 'In-memory znode tree (path -> data + version), write-ahead log, watch registrations per path',
    internal: 'Writes go to the leader, which broadcasts proposals; a quorum of followers acks before commit. Reads are served locally by any member (possibly slightly stale).',
    mechanism: 'Ephemeral znodes vanish when their session dies — that is how locks and membership work. Watches fire once per change and must be re-armed; missing that re-arm is the classic bug.',
  },
  analytics: {
    algorithm: 'Streaming aggregation over tumbling/sliding windows',
    dataStructure: 'Windowed state stores (per key), watermark tracker, pre-aggregated rollup tables',
    internal: 'Events partition by key -> each worker maintains window state -> watermark passes window end -> emit aggregate, drop state. Late events either merge (if allowed lateness) or count separately.',
    mechanism: 'Exactly-once via checkpointed offsets + idempotent sinks. Rollups cascade: 1s -> 1m -> 1h tables so dashboards never scan raw events.',
  },
  bff: {
    algorithm: 'Per-client aggregation: one round trip fans into many',
    dataStructure: 'Endpoint-to-backend call graph, response shape per client (mobile vs web), partial-failure policy per field',
    internal: 'Client asks for a screen -> BFF fans out to the services that own each fragment in parallel -> merges into exactly the shape that screen renders -> one response.',
    mechanism: 'Timeout budget splits across the fan-out; slow optional fragments degrade to null rather than failing the screen. The BFF owns client versioning so services don\'t.',
  },
  registry: {
    algorithm: 'Heartbeat-based membership with client-side caching',
    dataStructure: 'Service -> instance list with health state, lease table, client-side cache with delta fetch',
    internal: 'Instances register and heartbeat on an interval; miss N beats and you are evicted. Clients pull the instance list, cache it, and refresh with deltas.',
    mechanism: 'Self-preservation: if too many instances vanish at once, assume a network partition and stop evicting — a registry that empties itself takes the platform with it.',
  },
  mesh: {
    algorithm: 'Sidecar interception: mTLS + policy at every hop',
    dataStructure: 'Envoy sidecar per pod, xDS-pushed route/cluster config, certificate chain per workload identity',
    internal: 'All pod traffic redirects through the sidecar (iptables). Sidecars mutually authenticate with workload certs, apply retry/timeout/circuit policy, and emit uniform telemetry.',
    mechanism: 'The mesh moves reliability policy out of application code into config. Cost: one proxy hop each way (~1-3ms) and a control plane that must scale with the fleet.',
  },
  saga: {
    algorithm: 'Orchestrated sequence of local transactions + compensations',
    dataStructure: 'Saga state machine per instance (step, status), compensation registry, durable event log',
    internal: 'Each step commits locally then reports; on failure the orchestrator runs the compensations for completed steps in reverse order (refund, release, cancel).',
    mechanism: 'Compensations must be idempotent and always-possible — you cannot un-send an email, so order steps so the irreversible ones go last. State survives restarts via the log.',
  },
  config: {
    algorithm: 'Versioned key-value with watch-based push',
    dataStructure: 'Namespaced config tree, version history per key, client watch sessions, environment overlays',
    internal: 'Clients fetch at startup and register watches; a change bumps the version and pushes to watchers, who hot-reload without restart.',
    mechanism: 'Overlays layer: default -> environment -> instance. Every change is versioned for instant rollback. Typed schemas catch a string where a number should be before it ships.',
  },
  lake: {
    algorithm: 'Immutable object storage + table format metadata',
    dataStructure: 'Parquet/ORC files in object storage, table-format manifests (Iceberg/Delta) tracking file membership + schema',
    internal: 'Writers add data files then commit a new manifest atomically — readers always see a consistent snapshot. Time travel = read an old manifest.',
    mechanism: 'Partitioning + file statistics let engines skip most files per query. Compaction merges small files; schema evolution edits metadata, never rewrites data.',
  },
  bi: {
    algorithm: 'Query pushdown over a semantic layer',
    dataStructure: 'Semantic model (dimensions, measures, joins), generated SQL per visual, extract caches',
    internal: 'A chart declares dimensions + measures -> the semantic layer generates SQL against the warehouse -> results cache per (query, filters) with a TTL.',
    mechanism: 'Extracts trade freshness for speed: scheduled imports serve dashboards without hitting the warehouse. Row-level security filters inject into every generated query.',
  },
  slo: {
    algorithm: 'Error-budget accounting over rolling windows',
    dataStructure: 'SLI time series (good/total counts), budget ledger per window, multi-rate burn alerts',
    internal: 'SLO 99.9% over 30d = a budget of 0.1% bad events. Burn rate = how fast you spend it; alerts pair a fast window (page: 14x burn over 1h) with a slow one (ticket: 1x over 3d).',
    mechanism: 'The budget is a spending decision: budget left = ship faster; budget gone = freeze and fix. Multi-window alerting kills both false pages and slow leaks.',
  },
  alert: {
    algorithm: 'Rule evaluation -> dedup -> escalation state machine',
    dataStructure: 'Alert rules over metric queries, incident records with ack state, escalation policies, on-call schedule calendar',
    internal: 'Rule breaches -> alert fires -> dedup against open incidents -> notify per policy -> unacked after N minutes escalates to the next tier.',
    mechanism: 'Grouping folds a 50-host outage into one page. Flap detection suppresses oscillating alerts. The schedule handles overrides and handoffs; the runbook link is part of the alert.',
  },
  synthetic: {
    algorithm: 'Scripted probes from outside your network',
    dataStructure: 'Probe scripts (HTTP flows, browser journeys), per-location schedules, baseline latency distributions',
    internal: 'Agents in N regions run each check on an interval, asserting status, content and timing. Failures from multiple locations at once = real outage, not a flaky vantage point.',
    mechanism: 'Synthetic catches what internal metrics cannot: DNS, TLS expiry, CDN misconfig, the login flow itself. Alert on M-of-N locations failing to filter local noise.',
  },
  apm: {
    algorithm: 'Client-side beaconing of real-user timings',
    dataStructure: 'Web-vitals samples (LCP, INP, CLS), session traces, error groups by stack fingerprint',
    internal: 'A JS agent observes performance entries and errors, batches them, and beacons on page-hide. Backend aggregates by page, geo, device and release.',
    mechanism: 'Sampling caps cost (e.g. 10% of sessions, 100% of errors). Release tagging turns \'slower this week\' into \'slower since deploy X\'. This is the only latency the user actually felt.',
  },
  pii: {
    algorithm: 'Format-preserving tokenization behind a hard boundary',
    dataStructure: 'Token vault (token <-> ciphertext), format-preserving encryption keys, per-field policies',
    internal: 'Sensitive value enters -> encrypted + stored -> a token in the same shape (looks like a card number, is not) flows everywhere else. Detokenization requires vault access + audit.',
    mechanism: 'Downstream systems fall out of compliance scope because they only ever hold tokens. Rotation re-encrypts the vault without changing tokens — nothing downstream notices.',
  },
  audit: {
    algorithm: 'Append-only log with hash chaining',
    dataStructure: 'Ordered event records, each carrying the previous record\'s hash; periodic signed checkpoints',
    internal: 'Every sensitive action appends who/what/when/where. Each record hashes its predecessor, so editing history breaks the chain visibly at the tamper point.',
    mechanism: 'Checkpoints anchor the chain externally (signed, or written to WORM storage). Retention is regulatory: the log outlives the data it describes.',
  },
  siem: {
    algorithm: 'Normalize -> correlate -> detect over security events',
    dataStructure: 'Parsed event store (common schema), correlation rule graph, entity behavior baselines',
    internal: 'Logs from everything normalize into one schema -> rules correlate across sources (failed logins here + new device there) -> detections open cases with the evidence attached.',
    mechanism: 'Ingest pricing makes filtering at the source an economic control. Baselines flag deviation per user/host; correlation windows catch the slow attack a single log line hides.',
  },
  edge: {
    algorithm: 'Request-time compute at the CDN PoP',
    dataStructure: 'Deployed function bundles per PoP, edge KV replicas, route -> function map',
    internal: 'The PoP terminates TLS, runs your function (isolate-per-request, ms cold start), which can rewrite, redirect, personalize, or assemble from cache + origin.',
    mechanism: 'State at the edge is read-mostly KV replicated globally (eventual). Heavy work still belongs at origin — the edge wins when the answer is small and latency-bound.',
  },
  graphql: {
    algorithm: 'Query parsing -> resolver graph execution',
    dataStructure: 'Typed schema (SDL), resolver map per field, dataloader batch caches per request',
    internal: 'One query names exactly the fields wanted -> executor walks the tree, calling resolvers; dataloaders batch the N+1s (100 author lookups become 1 IN query).',
    mechanism: 'Cost analysis rejects pathological queries before execution (depth, breadth, complexity points). Persisted queries pin clients to known shapes in production.',
  },
  tenant: {
    algorithm: 'Tenant resolution -> routing/isolation policy',
    dataStructure: 'Tenant registry (id, tier, shard/cell assignment), per-tenant limits, header/host extraction rules',
    internal: 'Every request resolves its tenant (subdomain, header, token claim) -> routing sends it to that tenant\'s cell or shard -> quotas and features apply per tenant.',
    mechanism: 'Isolation is a spectrum: shared tables with tenant_id -> schema-per-tenant -> cell-per-tenant. Noisy-neighbor control = per-tenant rate and concurrency budgets at this layer.',
  },
  k8s: {
    algorithm: 'Reconciliation loops toward declared state',
    dataStructure: 'etcd-backed object store (desired state), controller informers/watches, scheduler queue, kubelet pod state',
    internal: 'You declare desired state; controllers watch, diff against actual, and act (create pods, reschedule, scale). The scheduler places pods by resource fit + affinity.',
    mechanism: 'Everything self-heals by re-reconciling — a deleted pod just violates desired state and gets replaced. Rollouts are controlled reconciliation: surge up, verify, scale down.',
  },
  cicd: {
    algorithm: 'DAG pipeline execution with artifact promotion',
    dataStructure: 'Pipeline graph (stages, dependencies), immutable artifact registry refs, environment promotion gates',
    internal: 'Commit triggers the DAG: build once -> test stages fan out in parallel -> the same artifact promotes through environments (never rebuilt per env).',
    mechanism: 'Caching keys on lockfiles/layers cut build time. Gates mix automatic (tests, scans) and human (approval). The artifact digest is the thing deployed — reproducibility by construction.',
  },
  esb: {
    algorithm: 'Message mediation: transform + route between systems',
    dataStructure: 'Canonical message model, transformation maps per endpoint, routing rules, adapter connectors',
    internal: 'A message enters via one protocol adapter -> transforms to the canonical model -> content-based routing picks the destinations -> transforms again to each target\'s dialect.',
    mechanism: 'The ESB decouples N systems from N^2 point-to-point links, at the cost of becoming the choke point: version transformations carefully and keep business logic out of it.',
  },
  erp: {
    algorithm: 'Modular transactions over one shared relational core',
    dataStructure: 'Highly normalized shared schema (GL, inventory, orders), posting documents, batch job schedules',
    internal: 'Modules (finance, supply, HR) post documents into the shared core inside strict transactions; month-end batch runs reconcile, depreciate and close periods.',
    mechanism: 'Customization lives in extension points, not core edits — modified cores make upgrades multi-year projects. Integrations go through published interfaces (IDocs/BAPIs), never table writes.',
  },
  crm: {
    algorithm: 'Entity graph + workflow automation over customer records',
    dataStructure: 'Account/contact/opportunity object model, pipeline stage machines, automation rule sets, activity timeline',
    internal: 'Every interaction appends to the account timeline; opportunities move through pipeline stages, firing automations (assign, notify, score) on transitions.',
    mechanism: 'Deduplication and merge rules are the unglamorous core — duplicate accounts poison every report downstream. Field-level security gates who sees revenue vs contact data.',
  },
  mainframe: {
    algorithm: 'Transaction-monitor batch + OLTP on shared everything',
    dataStructure: 'VSAM/DB2 datasets, CICS transaction programs, JCL batch job definitions, MIPS capacity budget',
    internal: 'OLTP: CICS dispatches short COBOL transactions at extreme reliability. Batch: nightly JCL chains process the day\'s file sets in dependency order.',
    mechanism: 'Capacity is licensed in MIPS, so peak shaving is a budget activity. Integration is via MQ or file transfer at defined windows — surrounding systems adapt to the mainframe\'s clock, not vice versa.',
  },
  mft: {
    algorithm: 'Scheduled, checkpointed file transfer with delivery proof',
    dataStructure: 'Transfer job definitions, partner endpoint configs, checkpoint offsets, non-repudiation receipts',
    internal: 'Jobs pick up files on schedule or event -> encrypt -> transfer with checkpoint/restart (a 10GB file resumes, not restarts) -> receipt proves delivery.',
    mechanism: 'PGP at rest + TLS in motion; filename conventions carry routing metadata. The dashboard answering \'did partner X get the file?\' is the actual product.',
  },
  partner: {
    algorithm: 'Contract-first B2B exchange (EDI/AS2/API)',
    dataStructure: 'Partner profiles (formats, endpoints, certs), document type maps (850/856/810), acknowledgment tracking',
    internal: 'A partner document arrives via AS2/SFTP -> validates against the agreed format -> maps to internal schema -> functional acknowledgment returns; state tracks until acked.',
    mechanism: 'Onboarding a partner = configuration (profile + maps), not code. Ack timeouts drive re-send; the audit trail settles \'you never sent the invoice\' disputes.',
  },
  hsm: {
    algorithm: 'Keys generated and used inside tamper-resistant hardware',
    dataStructure: 'Key hierarchy (master keys wrapping working keys), PKCS#11 session state, quorum card sets',
    internal: 'Keys are born inside the device and never leave in plaintext; callers send data in, get ciphertext/signatures out. Tamper attempts zeroize the keys.',
    mechanism: 'Admin operations need a quorum (M-of-N smart cards). Throughput is bounded by the device, so working keys are wrapped and cached near compute while masters stay in the HSM.',
  },
  e2e: {
    algorithm: 'Browser automation asserting user journeys',
    dataStructure: 'Page-object locators, test scenario suites, browser/driver pool, failure artifacts (screenshot, trace, video)',
    internal: 'Each test drives a real browser through a journey (login -> act -> assert), waiting on conditions rather than sleeps. Failures capture the DOM, network and a video.',
    mechanism: 'Flake is the tax: auto-retry once, quarantine repeat offenders, and keep this suite small — E2E asserts the wiring, unit/API tests assert the logic.',
  },
  apitest: {
    algorithm: 'Contract + behavior assertions against HTTP APIs',
    dataStructure: 'Request collections with environments, JSON schema assertions, seeded fixture data',
    internal: 'Suites run request chains (create -> read -> mutate -> verify), asserting status, schema and values; environments swap base URLs and credentials.',
    mechanism: 'Fast enough to run on every commit — this layer catches most regressions at a fraction of E2E cost. Negative cases (401s, validation errors) are half the value.',
  },
  load: {
    algorithm: 'Open-model traffic generation with SLO assertions',
    dataStructure: 'Virtual-user scenarios, arrival-rate schedules, latency histograms (HDR), threshold rules',
    internal: 'Generators ramp arrival rate through stages (baseline -> stress -> soak), recording full latency distributions; thresholds fail the run if p99 or error rate breaches.',
    mechanism: 'Open model (arrival rate) beats closed (fixed VUs) for finding capacity — real users do not politely wait. Coordinated omission correction keeps the percentiles honest.',
  },
  contract: {
    algorithm: 'Consumer-driven contracts verified by providers',
    dataStructure: 'Pact files (expected interactions per consumer), broker with version matrix, verification results',
    internal: 'Consumers publish the interactions they rely on; provider CI replays them against the real service. The broker\'s matrix says which versions can safely deploy together.',
    mechanism: 'can-i-deploy queries gate releases: a provider change that breaks a consumer contract fails before production, replacing whole-system integration environments.',
  },
  mock: {
    algorithm: 'Recorded/declared stub responses at a service boundary',
    dataStructure: 'Stub mappings (matcher -> response), state scenarios, recorded traffic templates',
    internal: 'Requests match on method/path/headers/body patterns -> canned response returns, optionally stateful (first call 200, second 409) and with injected latency or faults.',
    mechanism: 'Mocks make the unhappy paths testable on demand: timeouts, 500s, malformed payloads. Drift is the risk — regenerate from contracts or recordings, not by hand.',
  },
  testdata: {
    algorithm: 'Subset + mask production-shaped data',
    dataStructure: 'Referentially-consistent subset rules, masking transforms per column class, seeded snapshot catalog',
    internal: 'A subset walks foreign keys so 1% of production stays internally consistent; masking transforms PII deterministically (same input -> same fake) so joins still work.',
    mechanism: 'Deterministic masking preserves analytics while destroying identity. Snapshots version with schema migrations so old branches still get loadable data.',
  },
  qgate: {
    algorithm: 'Static analysis + coverage thresholds as a merge gate',
    dataStructure: 'AST-derived issue database, quality profiles (rule sets), new-code coverage deltas',
    internal: 'Every build analyzes the diff: bugs, vulnerabilities, smells and coverage on new code compare against the gate; breach blocks the merge.',
    mechanism: 'Gating on new code only (\'clean as you code\') makes legacy debt tractable — the old mess is frozen, the new code is held to standard.',
  },
  dast: {
    algorithm: 'Crawl + attack the running application',
    dataStructure: 'Crawl graph of discovered surfaces, attack payload library (OWASP), authenticated session state',
    internal: 'The scanner crawls the deployed app (logged in), then replays each input with attack payloads — injection, XSS, IDOR probes — and flags responses that indicate a hit.',
    mechanism: 'DAST finds what static analysis cannot: misconfig, auth gaps, real exploitability. Runs against staging on a schedule; findings triage into the same backlog as bugs.',
  },
  devicefarm: {
    algorithm: 'Real device/browser grid with session brokering',
    dataStructure: 'Device inventory (model, OS, state), session queue, video/log capture per run',
    internal: 'A test requests a capability set -> broker allocates a matching real device -> commands stream over the wire -> artifacts (video, logs, perf) attach to the result.',
    mechanism: 'Real devices catch what emulators cannot: vendor skins, throttling, notch layouts. Fleet hygiene (reset between sessions) is what keeps results reproducible.',
  },
  testops: {
    algorithm: 'Aggregation + analytics over all test results',
    dataStructure: 'Run history per suite/test, flake scores, requirement-to-test traceability map',
    internal: 'Every CI run reports results centrally; per-test history computes pass rates and flake scores; dashboards slice by suite, team and release.',
    mechanism: 'Flake scoring drives quarantine automatically. Traceability answers the release question — which requirements have passing coverage — without a spreadsheet.',
  },
  billing: {
    algorithm: 'Metered usage -> rating -> invoice pipeline',
    dataStructure: 'Usage event ledger (idempotent), price book (plans, tiers, proration rules), invoice state machine',
    internal: 'Usage events dedupe into the ledger -> rating applies the price book (tiers, minimums, proration) -> invoice drafts -> finalizes -> collects, with dunning on failure.',
    mechanism: 'Idempotency everywhere: replayed events must not double-bill. Proration and mid-cycle changes are where the bugs live; the ledger is append-only so every invoice is re-derivable.',
  },
  crypto: {
    algorithm: 'Envelope encryption with key hierarchy',
    dataStructure: 'Data keys (per object), key-encryption keys (per tenant/purpose), wrapped-key metadata alongside ciphertext',
    internal: 'Encrypt: generate a fresh data key, encrypt the payload, wrap the data key with the KEK, store both. Decrypt: unwrap, decrypt, discard the plaintext key.',
    mechanism: 'Rotation re-wraps data keys without touching payloads. Crypto-shredding: destroy the KEK and every object under it becomes noise — deletion at scale as a key operation.',
  },
  hash: {
    algorithm: 'Salted, memory-hard password hashing',
    dataStructure: 'Per-password random salt, cost parameters (memory, iterations, parallelism), versioned hash strings',
    internal: 'Verify: recompute with the stored salt + parameters, compare constant-time. The algorithm is deliberately slow and memory-hungry to price out GPU cracking.',
    mechanism: 'Cost parameters tune to ~100ms and ratchet up over time; the version prefix lets old hashes upgrade on next login. Never truncate, never reuse salts.',
  },
  digest: {
    algorithm: 'Content addressing via cryptographic digests',
    dataStructure: 'Digest -> content map, Merkle trees over chunked data, manifest lists',
    internal: 'Content hashes to its address; identical data dedupes to one copy automatically. Trees of digests (manifests) address composite objects — change a chunk, only its path re-hashes.',
    mechanism: 'Verification is free: re-hash what you received and compare. This is how registries, git and CAS stores get integrity + dedup from one primitive.',
  },
  sign: {
    algorithm: 'Detached signatures + verification chains',
    dataStructure: 'Signing key pairs, signature envelopes (payload digest, cert chain, timestamp), trust root set',
    internal: 'Sign: hash the artifact, sign the hash, attach the certificate chain and a timestamp. Verify: check the chain to a trusted root, the timestamp validity, then the signature.',
    mechanism: 'Timestamping keeps signatures valid after cert expiry. Transparency logs make issuance publicly auditable — a stolen key can sign, but not invisibly.',
  },
  e2ee: {
    algorithm: 'Double-ratchet session encryption between endpoints',
    dataStructure: 'Identity keys, per-session ratchet state (root/chain keys), prekey bundles on the server',
    internal: 'Clients establish a session via X3DH using server-stored prekeys; every message advances the ratchet so each has a fresh key. The server relays ciphertext it cannot read.',
    mechanism: 'Forward secrecy: leaking today\'s key exposes nothing prior. Multi-device means per-device sessions; safety numbers let users verify no middlebox swapped keys.',
  },
  graph: {
    algorithm: 'Index-free adjacency traversal',
    dataStructure: 'Node/edge stores with direct pointers, adjacency lists, property indexes for entry points',
    internal: 'A query finds entry nodes via a property index, then hops pointer-to-pointer — cost scales with edges touched, not with table size, unlike relational joins.',
    mechanism: 'Wins at depth: 4+ hop queries (fraud rings, recommendations) that would be join explosions. Loses at scans; supernodes (celebrity vertices) need relationship-type partitioning.',
  },
  tsdb: {
    algorithm: 'Time-partitioned columnar storage + downsampling',
    dataStructure: 'Series identified by label sets, time-window chunks (compressed), inverted label index',
    internal: 'Samples append to in-memory chunks per series -> seal + compress by time window -> label index finds series, time index finds chunks. Old windows drop wholesale.',
    mechanism: 'Delta-of-delta + XOR compression gets ~1-2 bytes per sample. Downsampling cascades resolution (raw -> 5m -> 1h) so year-long queries stay cheap. Cardinality is the real capacity limit.',
  },
  featureflag: {
    algorithm: 'Deterministic bucketing + targeting rules',
    dataStructure: 'Flag rule sets (segments, percentages), hash-based bucket assignment, local SDK caches with streaming updates',
    internal: 'SDK hashes (user, flag) into a bucket -> rules evaluate locally in microseconds -> streaming updates push rule changes in seconds. Same user always lands in the same bucket.',
    mechanism: 'Kill switches are flags with ops on the trigger. Percentage rollouts ramp safely; stale flags are debt — expiry dates and cleanup are part of the discipline.',
  },
  featurestore: {
    algorithm: 'Dual-path features: offline training, online serving',
    dataStructure: 'Offline store (point-in-time correct history), online store (latest value per entity, low-latency KV), feature definitions as code',
    internal: 'One definition materializes twice: batch jobs backfill history for training; streaming updates keep the online KV fresh for inference. Both serve the same named feature.',
    mechanism: 'Point-in-time joins prevent label leakage in training sets. Train/serve skew — the same feature computed two ways — is the failure this component exists to kill.',
  },
  stream: {
    algorithm: 'Stateful stream processing with checkpointed exactly-once',
    dataStructure: 'Keyed partition state (RocksDB), aligned checkpoint barriers, watermarks, source offsets',
    internal: 'Events flow through an operator DAG; state lives with the key\'s partition; barriers snapshot the whole pipeline consistently so recovery replays from the last checkpoint.',
    mechanism: 'Watermarks bound lateness so windows can close. Backpressure propagates upstream naturally. Exactly-once = checkpointed offsets + transactional/idempotent sinks.',
  },
  batch: {
    algorithm: 'Shuffle-based distributed computation over partitions',
    dataStructure: 'Partitioned datasets, DAG of stages split at shuffle boundaries, speculative task tracker',
    internal: 'A job compiles to stages; narrow transforms pipeline within a stage, shuffles redistribute by key between stages; failed tasks re-run from their inputs.',
    mechanism: 'Skewed keys make one straggler own the job — salt hot keys or split them. Speculative execution races slow tasks. Output commits atomically so reruns are safe.',
  },
  transcode: {
    algorithm: 'Segment-parallel encode into an ABR ladder',
    dataStructure: 'Source mezzanine, segment work units (2-6s), rendition ladder specs, packaging manifests',
    internal: 'Split source into segments -> encode each segment x each rendition in parallel across the worker pool -> stitch -> package HLS/DASH manifests + segments.',
    mechanism: 'Per-title encoding tunes the ladder to content complexity (cartoons need fewer bits than confetti). Segment parallelism turns a 2-hour movie into minutes of wall-clock.',
  },
  sandbox: {
    algorithm: 'MicroVM/isolate execution of untrusted code',
    dataStructure: 'Pool of pre-warmed micro-VMs, per-run resource limits, syscall/egress allowlists',
    internal: 'A run claims a pre-warmed sandbox -> code executes with hard CPU/memory/time caps and filtered syscalls/network -> outputs extracted -> sandbox destroyed, never reused.',
    mechanism: 'The boundary is the security model: one kernel-level isolation layer (Firecracker/gVisor), not process users. Pre-warming hides the cold start; destruction hides the compromise.',
  },
  geoidx: {
    algorithm: 'Hierarchical cell hashing for spatial queries',
    dataStructure: 'Geohash/H3 cell -> member sets, multi-resolution cell hierarchy, moving-object position updates',
    internal: 'Points map to cells at a chosen resolution; \'near me\' fetches the query cell + neighbors, then exact-distance filters the candidates. Coarser cells answer bigger radii.',
    mechanism: 'Cell size tunes precision vs candidate count. Moving objects update cheaply (remove from old cell, add to new). Edge case: query points near cell borders always need the neighbor ring.',
  },
  push: {
    algorithm: 'Token-based fan-out through platform gateways',
    dataStructure: 'Device token registry per user, platform credentials (APNs/FCM), collapse keys, delivery receipts',
    internal: 'A notification resolves the user\'s device tokens -> batches to APNs/FCM with priority + collapse key -> platforms deliver; feedback prunes dead tokens.',
    mechanism: 'Collapse keys replace stale notifications instead of stacking them. Token churn is constant — feedback-driven pruning keeps the registry honest. Silent pushes have strict platform budgets.',
  },
  containerreg: {
    algorithm: 'Content-addressed layer storage with manifest indexes',
    dataStructure: 'Blob store keyed by digest, image manifests (layer lists), tag -> digest pointers',
    internal: 'Push uploads only layers the registry lacks (digest check) then writes a manifest; pull fetches the manifest and any missing layers. Tags are movable pointers; digests are truth.',
    mechanism: 'Layer dedup across images makes storage sublinear. Deploy by digest, not tag — tags move, digests cannot. Garbage collection sweeps unreferenced blobs.',
  },
  bastion: {
    algorithm: 'Brokered, recorded access to private networks',
    dataStructure: 'Short-lived certificates, session recordings, per-target access policies, identity-provider bindings',
    internal: 'An operator authenticates (SSO + MFA) -> the bastion checks policy, mints a short-lived credential, opens the tunnel and records the session keystroke-for-keystroke.',
    mechanism: 'No standing credentials on targets: certificates expire in hours. Recordings make audits answerable. The bastion is the one door, so it gets the hardest hardening and the loudest alerts.',
  },
}

export function getComponentInternals(componentType) {
  return COMPONENT_INTERNALS[componentType] || {
    algorithm: 'Custom component',
    dataStructure: 'User-defined',
    internal: 'No standard internals documented for this component type.',
    mechanism: 'Depends on implementation.',
  }
}
