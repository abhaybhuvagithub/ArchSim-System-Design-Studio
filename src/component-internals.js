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
}

export function getComponentInternals(componentType) {
  return COMPONENT_INTERNALS[componentType] || {
    algorithm: 'Custom component',
    dataStructure: 'User-defined',
    internal: 'No standard internals documented for this component type.',
    mechanism: 'Depends on implementation.',
  }
}
