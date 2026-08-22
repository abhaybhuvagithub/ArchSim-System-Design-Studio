import { COMPONENT_INTERNALS, getComponentInternals } from './component-internals.js'
import { CATALOG } from './catalog.js'

const COMPONENT_DIAGRAMS = {
  cache: `
    REQUEST → HASH LOOKUP (O(1), 2μs) → HIT? 
    ├─ YES: Read LRU list head → return value
    └─ NO: Query DB → Insert into hash + LRU head
    
    TTL EXPIRY: Background thread every 100ms scans expired entries
    
    MEMORY PRESSURE: LRU tail evicted when full
  `,
  sql: `
    WRITE: Query → WAL (disk sync) → Memtable (in-memory) → Commit ✓
    
    READ: Query → B-tree index scan → Read set of rows → MVCC snapshot
    
    CONFLICT: Multiple writes to same row → Locking → Rollback via undo log
  `,
  nosql: `
    WRITE (LSM): In-memory memtable (fast) → Full? → Flush to SSTable (sorted)
    
    READ: Check memtable → Scan SSTables (Bloom filter skips non-matches)
    
    COMPACT: Merge overlapping SSTables in background (reduces read amp)
  `,
  queue: `
    PRODUCE: Append → Tail pointer ↑ → Return 200 ✓
    
    CONSUME: Read head → Lock (visibility timeout 30s) → Process → ACK
    
    FAILURE: Timeout → Unlock → Re-queue (retry counter ↑)
  `,
  llm: `
    TOKEN N: Read KV cache (prev tokens) → Compute attention → Next token
    
    TOKEN N+1: Cache K,V matrices → Avoid re-computing 1..N ✓
    
    BATCH: 10 requests → Queue up → GPU inference (all at once)
  `,
  cdn: `
    REQUEST → EDGE LOCATION → Cache hit? → Return (2ms latency)
    
    CACHE MISS → Origin pull → Store locally → Return + Cache
    
    PURGE: New version deployed → Propagate to 200+ edges (5min)
  `,
  lb: `
    NEW REQUEST → Connection count map → Pick instance with fewest → Forward
    
    HEALTH CHECK (5s) → Instance down? → Remove from pool
    
    DRAIN: Old instance marked "draining" → No new requests → Wait existing
  `,
  app: `
    REQUEST → Parse → Check cache (hit?) → Query DB → Apply logic → Response
    
    FAIL: Exponential backoff (100ms, 400ms, 1.6s) → Circuit breaker opens
    
    RECOVERY: Test endpoint → Success → Close breaker
  `,
  kafka: `
    PRODUCE: Append to partition log (sequential I/O) → Leader ACK → Replicas pull
    
    CONSUME: Start at offset → Read messages → Advance consumer offset
    
    REBALANCE: Consumer fails → Re-assign partitions to remaining consumers
  `,
  ratelimiter: `
    TOKEN BUCKET (per tenant):
    Tokens = min(capacity, tokens + (rate × time_elapsed))
    
    REQUEST: tokens ≥ 1? → tokens -= 1 → Allow | Deny
    
    REFILL: Background every second (or event-driven)
  `,
  web: `
    REQUEST → Match route → Render template with data → Static assets from CDN
    
    SESSION: Stored in distributed cache (Redis) → Hash by user_id
    
    ETAG: If-None-Match header → Return 304 Not Modified (saves bandwidth)
  `,
  backup: `
    FULL SNAPSHOT: All blocks → Hash → Store in archive (S3, GCS)
    
    INCREMENTAL: Hash each block → Store only new/changed → Dedup
    
    RECOVERY: Find backup → Restore blocks in parallel → Verify checksums
  `,
  search: `
    INDEX: Text → Tokenize → Inverted index (term → doc_ids)
    
    QUERY: Parse → Lookup posting lists → Merge by rank (BM25)
    
    RANKING: freq(term in doc) × log(N / docs_with_term)
  `,
  gateway: `
    REQUEST → Parse path/method → Route table (trie match) → Add auth headers
    
    → Inject trace_id → Forward to backend → Timeout gate (30s)
    
    RESPONSE: Success → 2xx. Timeout → 504. Backend error → 502.
  `,
  mq: `
    PUBLISH: Enlist message in transaction → Subscribers added to scope
    
    COMMIT: All-or-nothing → All subscribers consume or all fail
    
    DEADLETTER: Failed subscriptions after 3 retries → Routed to DLQ
  `,
  worker: `
    POLL: Fetch job from queue (lock: visibility timeout 5min)
    
    EXECUTE: Run task (email, transcode, aggregate)
    
    ACK/RETRY: Success → Remove from queue. Fail → Retry counter ↑
  `,
  llm: `
    TOKEN N: Input (context window check) → Embedding lookup → Self-attention → FFN layer
    
    KV CACHE: Store K,V matrices for tokens 1..N → Token N+1 only computes attention on new token
    
    BATCH: Collect requests → Pad to same length → Forward on GPU → Softmax → Sample next token
  `,
  embed: `
    TEXT → Tokenize (subword BPE) → Token embeddings + position embeddings → Transformer layers
    
    OUTPUT: Extract [CLS] token (or mean pooling) → 768-dim vector → L2 normalize
    
    CACHE: Store (text_hash → vector) for repeated queries (e.g., product descriptions)
  `,
  vector: `
    INDEX: HNSW graph — every node connects to M neighbors (small-world network)
    
    QUERY: Start at entry point → Navigate via nearest neighbors → epsilon-search in local region
    
    RECALL: Adjust beam width (20-100) vs search speed trade-off. ANN ≈ 98% exact NN distance.
  `,
  guard: `
    INPUT: Prompt → Tokenize → Scan for prompt injection patterns → Check PII regex → Score risk
    
    OUTPUT: Model response → Redact PII (mask email/SSN) → Filter for safety violations → Return or flag
    
    ALLOWLIST: Use semantic similarity to approved outputs or hard rules (no SQL keywords, no exec())
  `,
}

export function ComponentDetails({ nodeId, node, onClose }) {
  if (!node) return null

  const spec = CATALOG[node.type]
  const internals = getComponentInternals(node.type)
  const diagram = COMPONENT_DIAGRAMS[node.type]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="component-glyph">{spec?.glyph}</span>
            <h2>{spec?.name} <span className="component-type">({node.type})</span></h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="details-section">
            <h3>📝 Description</h3>
            <p>{spec?.desc}</p>
          </div>

          {diagram && (
            <div className="details-section">
              <h3>📊 Diagram (Data Flow)</h3>
              <div className="diagram-box">
                <pre>{diagram.trim()}</pre>
              </div>
            </div>
          )}

          <div className="details-section">
            <h3>⚙️ Core Algorithm</h3>
            <div className="details-box">
              <p><b>{internals.algorithm}</b></p>
            </div>
          </div>

          <div className="details-section">
            <h3>🗂️ Data Structure</h3>
            <div className="details-box">
              <p>{internals.dataStructure}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>🔄 Internal Working</h3>
            <div className="details-box">
              <p>{internals.internal}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>🔧 Queuing & Consistency Mechanism</h3>
            <div className="details-box">
              <p>{internals.mechanism}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>📊 Performance Specs</h3>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-label">Capacity</span>
                <span className="spec-value">{spec?.cap?.toLocaleString()}/s</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Latency</span>
                <span className="spec-value">{spec?.lat}ms</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Availability</span>
                <span className="spec-value">{(spec?.avail * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="details-section">
            <h3>💡 Common Use Cases</h3>
            <ul>
              {node.type === 'cache' && (
                <>
                  <li>Session storage with TTL expiry</li>
                  <li>Rate limiting state (token buckets)</li>
                  <li>User-specific feature flags</li>
                  <li>Leaderboards (sorted sets)</li>
                </>
              )}
              {node.type === 'sql' && (
                <>
                  <li>Transactional business entities (orders, users)</li>
                  <li>ACID guarantees needed (payments)</li>
                  <li>Complex joins across tables</li>
                  <li>Strong consistency requirements</li>
                </>
              )}
              {node.type === 'nosql' && (
                <>
                  <li>Document storage (profiles, settings)</li>
                  <li>Time-series events</li>
                  <li>Massive write throughput (IoT)</li>
                  <li>Flexible schema evolution</li>
                </>
              )}
              {node.type === 'queue' && (
                <>
                  <li>Async job processing</li>
                  <li>Email/SMS delivery queues</li>
                  <li>Decoupling producers from consumers</li>
                  <li>Retry logic with exponential backoff</li>
                </>
              )}
              {node.type === 'llm' && (
                <>
                  <li>Text generation (chat, summaries)</li>
                  <li>Question answering with context</li>
                  <li>Code generation and completion</li>
                  <li>Embedding-based semantic search</li>
                </>
              )}
              {!node.type.match(/(cache|sql|nosql|queue|llm)/) && (
                <li>See component description for use cases</li>
              )}
            </ul>
          </div>

          <div className="details-section">
            <h3>⚠️ Common Pitfalls</h3>
            <ul>
              {node.type === 'cache' && (
                <>
                  <li><b>Cache stampede:</b> Multiple requests fetch same key simultaneously after expiry</li>
                  <li><b>Stale data:</b> TTL too long = outdated information served</li>
                  <li><b>Eviction under load:</b> LRU eviction storms if capacity too small</li>
                </>
              )}
              {node.type === 'sql' && (
                <>
                  <li><b>N+1 queries:</b> Loop fetches one row at a time instead of batch</li>
                  <li><b>Missing indexes:</b> Full table scans on common filters</li>
                  <li><b>Lock contention:</b> Multiple writes to same row block each other</li>
                </>
              )}
              {node.type === 'queue' && (
                <>
                  <li><b>Message loss:</b> Processing fails before ACK sent</li>
                  <li><b>Poison pills:</b> One bad message blocks queue consumers indefinitely</li>
                  <li><b>Visibility timeout too short:</b> Duplicate processing if worker crashes</li>
                </>
              )}
              {node.type === 'llm' && (
                <>
                  <li><b>Token limit overflow:</b> Context + prompt + generation exceeds max</li>
                  <li><b>Hallucination:</b> Model generates plausible-sounding false information</li>
                  <li><b>Unbounded latency:</b> Long sequence generation can timeout</li>
                </>
              )}
              {!node.type.match(/(cache|sql|queue|llm)/) && (
                <li>See performance monitoring for component-specific issues</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

