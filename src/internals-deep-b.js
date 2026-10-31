// Deep internals, tranche B: data stores and messaging.
export const DEEP_B = {
  cache: {
    why: 'Keep the hot subset of data in memory so most reads avoid the slower, more expensive store behind it.',
    lifecycle: [
      'The application computes a key and sends GET key (cache-aside pattern).',
      'The server hashes the key to a slot, finds the entry in its hash table and checks the expiry time. Expired entries are treated as missing.',
      'Hit: return the value in well under a millisecond and update recency or frequency metadata used for eviction.',
      'Miss: the application reads the database, then SETs the value with a TTL so the next reader hits.',
      'When memory reaches its limit, the eviction policy removes entries to make room for the new write.',
      'A write to the source of truth must also invalidate or update the cache entry, otherwise readers see stale data until the TTL ends.',
      'In a cluster, the key\'s hash slot decides which shard owns it; replicas follow their primary asynchronously for failover.',
    ],
    algorithms: [
      { name: 'LRU', how: 'Evict the entry unused for the longest time. Exact LRU needs a linked list; Redis uses approximated LRU by sampling a few keys and evicting the oldest of the sample.', cost: 'O(1) exact with hash map + doubly linked list; approximation avoids the list overhead.' },
      { name: 'LFU', how: 'Evict the least frequently used, using a small decaying counter per key, which resists scans that pollute LRU.', cost: 'O(1) update, few bits per key.' },
      { name: 'TTL expiry (lazy + active)', how: 'Check expiry when a key is read, and periodically sample keys with TTLs and delete expired ones so memory is reclaimed without scanning everything.', cost: 'Bounded background CPU.' },
      { name: 'Hash slots / consistent hashing', how: 'Redis Cluster maps a key to one of 16,384 slots via CRC16; slots are assigned to nodes and can be migrated.', cost: 'O(1) routing; resharding moves slots.' },
    ],
    structures: [
      { name: 'Hash table with incremental rehashing', why: 'O(1) lookup; resizing is spread across operations so no single request stalls.' },
      { name: 'Specialised encodings (ziplist/listpack, skiplist, intset)', why: 'Small collections are packed contiguously to save memory; large sorted sets use a skip list for O(log n) range queries.' },
      { name: 'Expiry index', why: 'Find soon-to-expire keys without a full scan.' },
    ],
    failures: [
      { mode: 'Cache stampede', what: 'A hot key expires and thousands of requests miss at once, all hitting the database.', fix: 'Request coalescing (single flight), jittered TTLs, early refresh, or serving stale while refreshing.' },
      { mode: 'Cold start', what: 'After a restart or failover the cache is empty and the database takes the full load.', fix: 'Warm up gradually, persistence snapshots, capacity-plan the database for a cold cache.' },
      { mode: 'Stale data', what: 'Writes bypass or race with invalidation.', fix: 'Invalidate after commit, short TTLs, or write-through for critical data.' },
      { mode: 'Hot key', what: 'One key receives disproportionate traffic and saturates one shard.', fix: 'Local in-process cache in front, key replication with suffixes.' },
      { mode: 'Async replication loss', what: 'Failover loses the last few writes.', fix: 'Treat the cache as disposable, never the only copy.' },
    ],
    knobs: [
      { name: 'maxmemory and eviction policy', effect: 'allkeys-lru for a pure cache; noeviction would refuse writes when full.' },
      { name: 'TTL per key class', effect: 'Hit ratio and database load vs staleness.' },
      { name: 'Persistence (none, snapshot, append log)', effect: 'Faster warm restart vs write overhead.' },
    ],
    pitfalls: [
      'Caching without a plan for invalidation.',
      'Storing huge values, which block the single-threaded command loop.',
      'Using the cache as the primary store.',
      'Sizing for the whole dataset instead of the hot set.',
    ],
    model: 'ArchSim models the cache as a fast, high-capacity tier that absorbs a share of reads; the miss traffic reaches the database. Stampede and staleness are described here, not simulated.',
  },

  sql: {
    why: 'Store related data with strong guarantees: transactions (ACID), constraints, joins and a declarative query language.',
    lifecycle: [
      'The client sends SQL over a pooled connection. The server parses it into a tree.',
      'The planner rewrites the query and chooses an execution plan from table statistics: which indexes, which join order, which join algorithm. It estimates the cost of alternatives and picks the cheapest.',
      'The executor runs the plan: index lookups, scans, joins, sorts, aggregation, reading pages through the buffer cache (memory) and the disk on a miss.',
      'For a write, the change is first appended to the write-ahead log (WAL) and flushed to durable storage; only then is the commit acknowledged. Data pages are written back later.',
      'Concurrency control keeps transactions from interfering: MVCC gives each reader a consistent snapshot while writers create new row versions; row locks serialise conflicting writers.',
      'Replicas receive the WAL stream and replay it; reads from replicas may lag behind the primary.',
      'Background processes clean up dead row versions (vacuum) and refresh statistics.',
    ],
    algorithms: [
      { name: 'B-tree index', how: 'A balanced tree of pages; lookups and range scans descend from root to leaf in O(log n) page reads, typically 3 to 4 levels for hundreds of millions of rows.', cost: 'Read O(log n); writes must also update every index on the table.' },
      { name: 'Join algorithms', how: 'Nested loop (good with an index on the inner side), hash join (build a hash table of the smaller input), merge join (both sides sorted).', cost: 'Nested loop O(n x log m) with index; hash join O(n + m) with enough memory.' },
      { name: 'Write-ahead logging + group commit', how: 'Log before data; several commits share one disk flush.', cost: 'Durability costs one flush per commit group; this bounds write latency.' },
      { name: 'MVCC', how: 'Rows carry creation and deletion transaction ids; a snapshot sees rows visible as of its start.', cost: 'Readers never block writers; old versions need cleanup.' },
    ],
    structures: [
      { name: 'Heap pages / clustered index', why: 'Where rows live.' },
      { name: 'WAL (append-only log)', why: 'Crash recovery and replication source.' },
      { name: 'Buffer cache', why: 'Hot pages in memory; the working set versus RAM decides latency.' },
      { name: 'Statistics (histograms, distinct counts)', why: 'Drive the planner\'s estimates; stale statistics yield bad plans.' },
    ],
    failures: [
      { mode: 'Connection exhaustion', what: 'Each connection costs memory; thousands of app connections exceed limits.', fix: 'A connection pooler (PgBouncer style); size pools to what the database can run in parallel (roughly cores x 2 to 4).' },
      { mode: 'Replication lag', what: 'A replica read returns data older than a just-completed write.', fix: 'Read your own writes from the primary, or wait for the replica to reach the write\'s log position.' },
      { mode: 'Lock contention and deadlock', what: 'Transactions wait on each other; the engine aborts one.', fix: 'Short transactions, consistent lock order, retry on deadlock.' },
      { mode: 'Bad plan after data growth', what: 'The planner chooses a scan over an index.', fix: 'Refresh statistics, add the right index, inspect with EXPLAIN.' },
      { mode: 'Primary failure', what: 'Writes stop until failover completes.', fix: 'Synchronous or semi-synchronous standby, automated failover, tested runbooks.' },
    ],
    knobs: [
      { name: 'Isolation level', effect: 'Read committed vs repeatable read vs serializable: anomalies prevented vs conflicts and retries.' },
      { name: 'synchronous_commit / durability settings', effect: 'Latency vs the chance of losing the last commits on a crash.' },
      { name: 'Memory (shared buffers, work memory)', effect: 'Cache hit ratio and whether sorts spill to disk.' },
      { name: 'Index set', effect: 'Each index speeds reads and slows every write.' },
    ],
    pitfalls: [
      'Adding replicas to fix a write bottleneck: replicas scale reads only.',
      'An index on every column.',
      'SELECT * and N+1 query patterns.',
      'Long transactions that hold locks and block cleanup.',
    ],
    model: 'ArchSim models the relational store as limited-capacity primary writes with replicas adding read capacity. It does not simulate query plans, locks or lag.',
  },

  nosql: {
    why: 'Scale writes and storage horizontally by partitioning data across many nodes, trading joins and rich transactions for predictable performance at scale.',
    lifecycle: [
      'The client sends a request with a partition key (and a sort key for range access).',
      'The key is hashed; the hash decides the partition and the node holding the primary copy for that range.',
      'A write goes to the commit log, then an in-memory table; the coordinator replicates it to N replicas (commonly 3) and waits for W acknowledgements.',
      'A read asks R replicas and returns the newest version; if R + W > N the read set overlaps the write set (quorum).',
      'In the background the in-memory table is flushed to immutable sorted files; compaction merges files to keep reads cheap and discard overwritten or deleted data.',
      'Anti-entropy repairs replicas that missed writes (read repair, hinted handoff, background Merkle tree comparison).',
      'Adding a node moves a share of partitions to it.',
    ],
    algorithms: [
      { name: 'Consistent hashing with virtual nodes', how: 'Partitions map onto a ring; nodes own many small ranges so load and rebalancing are even.', cost: 'Adding a node moves about 1/N of data.' },
      { name: 'Quorum reads and writes', how: 'With N replicas, requiring R + W > N guarantees reads see the latest acknowledged write.', cost: 'Higher R or W increases latency and reduces availability under failures.' },
      { name: 'LSM tree', how: 'Writes are sequential appends to a log and memtable, flushed as sorted immutable files and merged by compaction. Reads may check several files, helped by Bloom filters.', cost: 'Fast writes, read and space amplification managed by compaction.' },
      { name: 'Bloom filter', how: 'A compact probabilistic set that says definitely-not-present or maybe-present for a file.', cost: 'Skips most files for missing keys; small false-positive rate.' },
    ],
    structures: [
      { name: 'Commit log', why: 'Durability for the memtable.' },
      { name: 'Memtable + SSTables', why: 'Sorted in-memory and on-disk structures from the LSM tree.' },
      { name: 'Partition map / token ring', why: 'Records which node owns which key range, kept in sync by gossip or a coordinator.' },
      { name: 'Vector clocks or timestamps', why: 'Order concurrent versions; last-write-wins is simple and can silently lose updates.' },
    ],
    failures: [
      { mode: 'Hot partition', what: 'One key or range receives most traffic and exceeds a single partition\'s throughput.', fix: 'Choose a high-cardinality key, add a salt, split hot keys.' },
      { mode: 'Replica down', what: 'Quorum still holds with N=3 and one failure; writes are hinted and replayed.', fix: 'Monitor repair backlogs.' },
      { mode: 'Conflicting writes', what: 'Concurrent updates in different regions.', fix: 'Choose a conflict policy: last-write-wins, CRDTs, or application merge.' },
      { mode: 'Compaction pressure', what: 'Disk and CPU spikes degrade latency.', fix: 'Choose compaction strategy for the workload, provision headroom.' },
    ],
    knobs: [
      { name: 'Replication factor and consistency level', effect: 'Durability and availability vs latency and cost.' },
      { name: 'Partition key design', effect: 'The single biggest determinant of scalability.' },
      { name: 'Compaction strategy', effect: 'Write amplification vs read performance.' },
    ],
    pitfalls: [
      'Designing the schema from entities instead of from queries.',
      'Secondary indexes and scatter-gather queries across all partitions.',
      'Assuming eventual consistency is "usually fine" without checking what a stale read costs the business.',
    ],
    model: 'ArchSim models the store as a horizontally scalable tier whose capacity grows with replicas; partition skew and consistency level are described here, not simulated.',
  },

  search: {
    why: 'Find documents by words and relevance, with filters and facets, far faster than scanning a database.',
    lifecycle: [
      'Indexing: a document is analysed. The analyser splits text into tokens, lowercases, removes stop words, and stems words so "running" matches "run".',
      'For each term, the index appends the document id to that term\'s posting list (term to document ids, with positions and frequencies). This is the inverted index.',
      'Documents are written to in-memory buffers and periodically flushed to immutable segments; searches see new data after a refresh (about a second by default), so search is near-real-time, not instant.',
      'Query: the query string is analysed the same way; for each term the engine fetches its posting list.',
      'Boolean combinations intersect or union the lists (using skip pointers to leap over non-matches).',
      'Matching documents are scored, usually with BM25: a term counts more if it is rare across the corpus and frequent in this document, with length normalisation.',
      'In a cluster, the query is sent to one copy of every shard, each returns its top K, and the coordinator merges them into the global top results.',
      'Segments are merged in the background; deletions are marked and removed at merge.',
    ],
    algorithms: [
      { name: 'Inverted index', how: 'Maps each term to the sorted list of documents containing it.', cost: 'Query cost proportional to posting list lengths, not corpus size.' },
      { name: 'BM25 scoring', how: 'score = sum over terms of IDF x (tf x (k1+1)) / (tf + k1 x (1 - b + b x len/avglen)).', cost: 'Computed only for matching documents.' },
      { name: 'Scatter-gather top-K', how: 'Each shard returns its best K; the coordinator merges. Deep paging (page 10,000) is expensive because each shard must produce offset+K results.', cost: 'O(shards x (offset + K)).' },
      { name: 'Posting list compression', how: 'Store deltas between sorted ids with variable-byte or bit packing.', cost: 'Much smaller index, faster scans.' },
    ],
    structures: [
      { name: 'Segments (immutable)', why: 'Lock-free reads; updates write new segments.' },
      { name: 'Term dictionary (FST)', why: 'Compact term lookup with prefix queries.' },
      { name: 'Doc values / columnar store', why: 'Sorting and aggregations without loading documents.' },
    ],
    failures: [
      { mode: 'Index lags the database', what: 'A just-saved record does not appear in search.', fix: 'Accept near-real-time, or fall back to the database for the writer\'s own view.' },
      { mode: 'Shard imbalance or too many shards', what: 'Overhead per shard grows; hot shards.', fix: 'Size shards to tens of GB, plan shard count up front (changing it needs reindexing).' },
      { mode: 'Mapping explosion', what: 'Dynamic fields create thousands of field mappings.', fix: 'Explicit mappings.' },
      { mode: 'Memory pressure', what: 'Large aggregations or heap exhaustion.', fix: 'Limit result sizes, use doc values, size heap and page cache.' },
    ],
    knobs: [
      { name: 'Refresh interval', effect: 'Freshness vs indexing throughput.' },
      { name: 'Analyzers per field', effect: 'Recall and precision of matching.' },
      { name: 'Shards and replicas', effect: 'Write parallelism and read capacity.' },
    ],
    pitfalls: [
      'Using search as the system of record.',
      'Deep pagination; use search-after cursors.',
      'Changing analyzers without reindexing.',
    ],
    model: 'ArchSim models search as a read-scaled tier; indexing delay and relevance are not simulated.',
  },

  blob: {
    why: 'Store very large amounts of unstructured data (images, video, backups) cheaply and durably, addressed by key rather than queried.',
    lifecycle: [
      'A PUT request is authenticated and routed by bucket and key to a front-end node.',
      'For large files the client uses multipart upload: parts are uploaded in parallel and then committed as one object.',
      'The object is split or encoded for durability: either replicated (for example 3 copies) or erasure coded (data shards plus parity shards) across devices and facilities.',
      'Metadata (key, size, checksum, version, storage class) is written to a separate index; the write is acknowledged once enough copies are durable.',
      'A GET looks up the key in the index, fetches the pieces, verifies checksums and streams the bytes. Range requests read just part.',
      'Background scrubbing re-reads data, detects bit rot via checksums and repairs from redundancy.',
      'Lifecycle rules move objects to colder, cheaper classes or delete them after a time.',
    ],
    algorithms: [
      { name: 'Erasure coding (Reed-Solomon)', how: 'Split an object into k data shards and compute m parity shards; any k of the k+m shards reconstruct the data.', cost: 'About (k+m)/k storage overhead (for example 1.5x) instead of 3x for replication, with more CPU and slower repair.' },
      { name: 'Content checksums', how: 'Store a hash with every object or part; verify on read and during scrubbing.', cost: 'Detects silent corruption.' },
      { name: 'Multipart upload', how: 'Split a large file into parts uploaded in parallel and committed as one object; a failed part is retried alone.', cost: 'Faster and recoverable for big files; each part has a minimum size.' },
    ],
    structures: [
      { name: 'Metadata index (key to location, version)', why: 'Separate from data so listing and lookups scale independently.' },
      { name: 'Immutable objects with versions', why: 'An overwrite is a new object; this enables versioning and simple consistency.' },
    ],
    failures: [
      { mode: 'High request rate to one prefix', what: 'Partition hot spots throttle requests.', fix: 'Spread keys, avoid sequential names, add caching or a CDN.' },
      { mode: 'Egress cost', what: 'Reading lots of data out is expensive.', fix: 'CDN, keep compute near data.' },
      { mode: 'Eventual list consistency in some systems', what: 'A new object may not appear in a listing immediately.', fix: 'Do not rely on listing for correctness; keep your own index.' },
      { mode: 'Accidental deletion', what: 'Data lost by mistake or attack.', fix: 'Versioning, object lock, cross-region replication.' },
    ],
    knobs: [
      { name: 'Storage class', effect: 'Cost per GB vs retrieval time and fee.' },
      { name: 'Replication across regions', effect: 'Disaster recovery vs doubled storage and egress.' },
      { name: 'Part size', effect: 'Throughput vs overhead.' },
    ],
    pitfalls: [
      'Treating object storage as a file system with cheap renames; a rename is copy plus delete.',
      'Many tiny objects, which multiply per-request overhead and cost.',
      'Public buckets by mistake.',
    ],
    model: 'ArchSim models blob storage as extremely durable and high-throughput with higher per-request latency; durability mechanics are described here.',
  },

  vector: {
    why: 'Find the items whose meaning is nearest to a query, by comparing embedding vectors, without scanning every one.',
    lifecycle: [
      'Content is turned into an embedding (a vector of, say, 768 to 3,072 numbers) by an embedding model and stored with an id and metadata.',
      'The vector is inserted into an index structure that makes nearest-neighbour search sub-linear.',
      'At query time, the query text is embedded with the same model.',
      'The index returns approximate nearest neighbours by a distance measure (cosine, dot product or Euclidean), optionally filtered by metadata.',
      'The top K ids are returned with scores; the application fetches the content, often reranking with a stronger model.',
      'Updates and deletes mark entries and rebuild or compact the index over time.',
    ],
    algorithms: [
      { name: 'HNSW', how: 'A layered proximity graph: sparse upper layers for long jumps, dense bottom layer for precision. Search starts at the top, greedily moves toward the query, descends, and explores a candidate list of size ef.', cost: 'Roughly O(log n) search; high recall; memory heavy because it stores graph links plus vectors.' },
      { name: 'IVF (inverted file)', how: 'Cluster vectors with k-means; at query time search only the nearest few clusters (nprobe).', cost: 'Searches a fraction of the data; recall depends on nprobe.' },
      { name: 'Product quantization', how: 'Split vectors into sub-vectors and replace each with a small codebook index, compressing 10 to 50x.', cost: 'Big memory savings at some recall loss.' },
      { name: 'Brute-force (flat)', how: 'Compare the query against every stored vector, computing the exact distance to each.', cost: 'O(n x d); exact; fine up to about a million vectors on good hardware.' },
    ],
    structures: [
      { name: 'Graph adjacency lists (HNSW)', why: 'Each node lists its neighbours so search can hop toward the query.' },
      { name: 'Centroids and posting lists (IVF)', why: 'Find the nearest clusters, then scan only their members.' },
      { name: 'Codebooks (PQ)', why: 'Compressed distance computation.' },
    ],
    failures: [
      { mode: 'Low recall', what: 'True nearest neighbours missed, so relevant content never reaches the model.', fix: 'Raise ef or nprobe, measure recall against a flat index on a sample.' },
      { mode: 'Filtering breaks search', what: 'A restrictive metadata filter applied after retrieval returns too few results.', fix: 'Filter-aware indexes or pre-filtering.' },
      { mode: 'Embedding model change', what: 'Vectors from different models are not comparable.', fix: 'Re-embed everything and version the index.' },
      { mode: 'Memory exhaustion', what: 'Index must fit in RAM for speed.', fix: 'Quantise, shard, or use disk-based indexes.' },
    ],
    knobs: [
      { name: 'HNSW M and ef_construction / ef_search', effect: 'Recall and latency vs memory and build time.' },
      { name: 'nlist / nprobe (IVF)', effect: 'Speed vs recall.' },
      { name: 'Quantisation level', effect: 'Memory vs accuracy.' },
    ],
    pitfalls: [
      'Assuming the nearest vector is the most useful answer; semantic similarity is not relevance.',
      'No evaluation set for retrieval quality.',
      'Mixing embeddings from different models or versions.',
    ],
    model: 'ArchSim models the vector store as a read tier with latency and capacity; recall and index tuning are described here, not simulated.',
  },

  queue: {
    why: 'Decouple producers from consumers: absorb bursts, let work proceed at the consumer\'s pace, and retry failures without blocking the sender.',
    lifecycle: [
      'A producer sends a message; the broker persists it (to disk or replicated memory) and acknowledges.',
      'A consumer receives the message. The broker hides it for a visibility timeout so other consumers do not take it too.',
      'The consumer processes it and explicitly acknowledges; the broker deletes it.',
      'If the consumer crashes or times out, the message becomes visible again and is delivered to another consumer (at-least-once delivery).',
      'After a configured number of failed deliveries the message moves to a dead-letter queue.',
      'Optional features: delays, priorities, FIFO ordering within a group, and long polling to avoid empty requests.',
    ],
    algorithms: [
      { name: 'Visibility timeout lease', how: 'Receive grants a time-limited lease; ack ends it; expiry returns the message.', cost: 'Gives crash tolerance without distributed locks.' },
      { name: 'Backpressure by queue depth and age', how: 'Alert and scale on how many messages wait and how old the oldest is.', cost: 'Age is the direct measure of delay users feel.' },
      { name: 'FIFO with message groups', how: 'Strict order per group id; parallelism across groups.', cost: 'Lower throughput than standard queues.' },
    ],
    structures: [
      { name: 'Replicated message store', why: 'Survive broker failure.' },
      { name: 'In-flight set with deadlines', why: 'Tracks which messages are leased and when each lease expires.' },
      { name: 'Dead-letter queue', why: 'Isolate poison messages.' },
    ],
    failures: [
      { mode: 'Duplicate delivery', what: 'A slow consumer\'s lease expires and another gets the message.', fix: 'Idempotent consumers.' },
      { mode: 'Unbounded backlog', what: 'Producers outpace consumers; latency and storage grow.', fix: 'Scale consumers, limit producers, shed load.' },
      { mode: 'Poison message', what: 'A message that always fails to process is redelivered forever.', fix: 'Max receive count and dead-letter queue.' },
    ],
    knobs: [
      { name: 'Visibility timeout', effect: 'Must exceed processing time.' },
      { name: 'Retention', effect: 'How long a backlog can be recovered.' },
      { name: 'Max receive count', effect: 'Retries before dead-lettering.' },
    ],
    pitfalls: [
      'Expecting exactly-once delivery.',
      'Large payloads in the queue; send a pointer to blob storage instead.',
      'No monitoring of queue age.',
    ],
    model: 'ArchSim models the queue as a durable buffer that decouples tiers; backlog dynamics over time are not simulated.',
  },

  kafka: {
    why: 'A durable, ordered, replayable log of events that many independent consumers can read at their own pace, at very high throughput.',
    lifecycle: [
      'A producer sends a record to a topic. The partitioner picks a partition: by hashing the key (same key, same partition, so per-key order) or round robin if there is no key.',
      'The leader broker for that partition appends the record to the end of the partition\'s log file (sequential disk write, the reason it is fast) and assigns the next offset.',
      'Follower brokers fetch from the leader to stay in sync. The in-sync replica set (ISR) is those fully caught up. With acks=all, the producer is acknowledged only when all ISR members have the record (and min.insync.replicas is met).',
      'Consumers in a consumer group each own a subset of partitions; a partition is read by exactly one consumer in the group at a time. They fetch batches starting from their committed offset.',
      'The consumer processes records and commits its offset (to an internal topic). After a restart it resumes from the last committed offset.',
      'Records are retained by time or size (or compacted to keep the latest value per key), not deleted on consumption, so a new consumer can replay from the start.',
      'If a broker fails, a new leader is elected from the ISR; if a consumer joins or leaves, the group rebalances partition assignments.',
    ],
    algorithms: [
      { name: 'Partitioning by key hash', how: 'partition = hash(key) mod numPartitions, so the same key always lands in the same partition and keeps its order.', cost: 'Ordering only within a partition; changing partition count changes the mapping.' },
      { name: 'Append-only log with sparse index', how: 'Records are appended to segment files; an offset index maps offsets to file positions; lookups binary-search the index then scan a little.', cost: 'O(1) append, O(log n) seek; relies on OS page cache and sequential I/O.' },
      { name: 'ISR replication', how: 'Leader tracks which followers are caught up; the high watermark is the offset committed to all ISR.', cost: 'Durability vs latency chosen via acks.' },
      { name: 'Consumer group rebalancing', how: 'A coordinator assigns partitions to members (range, round robin, sticky or cooperative strategies).', cost: 'Processing pauses during eager rebalances.' },
      { name: 'Idempotent producer and transactions', how: 'Producer id and sequence numbers let the broker discard duplicates; transactions write to several partitions atomically.', cost: 'Exactly-once within Kafka; end-to-end needs idempotent or transactional sinks.' },
    ],
    structures: [
      { name: 'Partition log (segments + offset and time indexes)', why: 'The core storage unit.' },
      { name: 'Consumer offset topic', why: 'Durable position of every group.' },
      { name: 'Cluster metadata (KRaft or ZooKeeper)', why: 'Leaders, ISR, topic config.' },
    ],
    failures: [
      { mode: 'Hot partition', what: 'A skewed key sends most records to one partition, capping throughput and ordering parallelism.', fix: 'Better key, salting, more partitions (with the ordering caveat).' },
      { mode: 'Consumer lag', what: 'Consumers fall behind the head of the log.', fix: 'More consumers up to the partition count, faster processing, alert on lag.' },
      { mode: 'Rebalance storm', what: 'Slow processing exceeds max poll interval, so the group kicks a member and repeats.', fix: 'Tune poll settings, use cooperative rebalancing, keep processing short.' },
      { mode: 'Unclean leader election', what: 'Data loss when an out-of-sync replica becomes leader.', fix: 'Keep it disabled; use replication factor 3 and min.insync.replicas 2.' },
      { mode: 'Poison record', what: 'A record the consumer can never process blocks the partition.', fix: 'Dead-letter topic with skip.' },
    ],
    knobs: [
      { name: 'acks, replication factor, min.insync.replicas', effect: 'Durability vs latency and availability.' },
      { name: 'Partition count', effect: 'Maximum consumer parallelism; hard to reduce; affects ordering.' },
      { name: 'Retention and compaction', effect: 'Replay window vs disk cost.' },
      { name: 'Batching (linger.ms, batch.size) and compression', effect: 'Throughput vs latency.' },
    ],
    pitfalls: [
      'Assuming global ordering; it is per partition only.',
      'Committing the offset before processing finishes, or processing before commit without idempotency.',
      'Too many small topics or partitions.',
      'Using Kafka as a work queue with per-message ack and retry semantics it does not have.',
    ],
    model: 'ArchSim models Kafka as a very high-throughput, durable tier; partition skew, lag and rebalances are described here, not simulated.',
  },

  warehouse: {
    why: 'Answer analytical questions over huge history quickly by storing data by column and spreading scans across many workers.',
    lifecycle: [
      'Data is loaded in batches or micro-batches (from files, streams or change feeds) and written as compressed columnar files, partitioned (often by date) and sometimes clustered by a sort key.',
      'A query is parsed and optimised; the planner uses partition and column metadata to decide which files and columns to read at all (pruning).',
      'Workers read only the needed columns, in parallel, using min/max statistics inside each file to skip blocks that cannot match the filter.',
      'Operators run on vectorised batches: filter, project, partial aggregate on each worker.',
      'Intermediate results are shuffled by key across workers to complete joins and group-bys, then merged by a coordinator.',
      'Results are returned and may be cached; the same query on unchanged data can return instantly.',
    ],
    algorithms: [
      { name: 'Columnar storage with encoding', how: 'Each column stored separately with dictionary, run-length and delta encoding plus compression.', cost: 'Reads only needed columns; 5 to 10x compression is common.' },
      { name: 'Partition and block pruning', how: 'Skip whole partitions and blocks by metadata.', cost: 'Turns scans of terabytes into gigabytes.' },
      { name: 'Distributed hash join and aggregation', how: 'Repartition both sides by join key (shuffle) or broadcast the small side to every worker.', cost: 'Shuffle is the main cost; broadcast joins avoid it when one side is small.' },
      { name: 'Vectorised execution', how: 'Process thousands of values per operator call to use CPU caches and SIMD.', cost: 'Large constant-factor speedup.' },
    ],
    structures: [
      { name: 'Columnar files with footers (min/max, counts)', why: 'Lets the planner skip files and blocks without reading them.' },
      { name: 'Catalog / metadata store', why: 'Table schema, partitions, file lists, statistics.' },
    ],
    failures: [
      { mode: 'Data skew', what: 'One join or group key holds most rows, so one worker does most of the work.', fix: 'Salting, pre-aggregation, broadcast.' },
      { mode: 'Small files problem', what: 'Thousands of tiny files slow planning and reading.', fix: 'Compact into larger files on a schedule.' },
      { mode: 'Runaway query cost', what: 'A full scan on a pay-per-byte engine.', fix: 'Partition filters required, cost guards, quotas.' },
      { mode: 'Stale data', what: 'Analytics lags the source by the load interval.', fix: 'State the freshness SLA.' },
    ],
    knobs: [
      { name: 'Partition and cluster keys', effect: 'Largest lever on query cost.' },
      { name: 'Compute size / concurrency', effect: 'Speed and concurrency vs spend.' },
      { name: 'Materialised views and aggregates', effect: 'Fast dashboards vs maintenance and storage.' },
    ],
    pitfalls: [
      'Using a warehouse for single-row lookups or high-frequency writes.',
      'SELECT * on wide tables.',
      'No partition filter on large fact tables.',
    ],
    model: 'ArchSim models the warehouse as a batch/analytical sink with high throughput and high per-query latency; it is not a serving store.',
  },

  lake: {
    why: 'Keep raw data of any shape cheaply in open formats on object storage, so many engines can process it later.',
    lifecycle: [
      'Sources land raw files (JSON, CSV, Avro, Parquet, logs) in a landing zone on object storage.',
      'Jobs clean and convert to columnar formats, partitioned by date or key, into curated zones (raw, cleaned, curated).',
      'A table format (Iceberg, Delta, Hudi) adds a metadata layer: a transaction log of which files make up each table version, enabling atomic commits, schema evolution and time travel on plain object storage.',
      'A catalog registers tables so engines (Spark, Trino, warehouses) find them.',
      'Readers plan from the table metadata, prune files, and read only the needed columns.',
      'Maintenance jobs compact small files, expire old snapshots and remove orphaned files.',
    ],
    algorithms: [
      { name: 'Optimistic concurrency on a metadata log', how: 'A writer prepares new files, then atomically commits a new table version; conflicts are detected and retried.', cost: 'ACID on object storage without a database.' },
      { name: 'File compaction', how: 'Merge many small files into larger ones (hundreds of MB).', cost: 'Rewrites data but speeds every read.' },
      { name: 'Z-ordering / clustering', how: 'Co-locate related values to improve pruning on multiple columns.', cost: 'Extra write cost.' },
    ],
    structures: [
      { name: 'Parquet/ORC files', why: 'Columnar storage.' },
      { name: 'Table metadata (manifests, snapshots)', why: 'Defines a consistent table version.' },
    ],
    failures: [
      { mode: 'Data swamp', what: 'No catalog, ownership or quality checks, so nobody trusts it.', fix: 'Catalog, schemas, data contracts, ownership.' },
      { mode: 'Small files', what: 'Streaming writers produce many tiny files.', fix: 'Compact into larger files on a schedule.' },
      { mode: 'Schema drift', what: 'Upstream changes break downstream jobs.', fix: 'Schema evolution rules and contracts.' },
    ],
    knobs: [
      { name: 'Partitioning scheme', effect: 'Query pruning vs too many partitions.' },
      { name: 'File size target', effect: 'Scan efficiency vs write latency.' },
      { name: 'Snapshot retention', effect: 'Time travel window vs storage.' },
    ],
    pitfalls: [
      'Dumping data without a catalog or schema.',
      'Treating raw as the source of truth for access control (sensitive columns spread everywhere).',
    ],
    model: 'ArchSim treats the lake as a cheap, durable batch storage tier for analytics; table-format mechanics are described here.',
  },

  zk: {
    why: 'A small, strongly consistent coordination service for configuration, leader election and locks that other distributed systems depend on.',
    lifecycle: [
      'Clients connect to any server in an ensemble (3 or 5 nodes) and keep a session alive with heartbeats.',
      'Reads are served by the local server (fast, possibly slightly stale unless you sync first).',
      'Writes are forwarded to the leader, which proposes them; a majority of servers must accept before commit, using an atomic broadcast protocol (ZAB; Raft in similar systems).',
      'Every change gets a global, ordered transaction id so all servers apply the same sequence.',
      'Data lives in a tree of small nodes (znodes). Ephemeral nodes disappear when their session ends, which is how liveness and leader election work; watches notify clients when a node changes.',
      'If the leader fails, the remaining majority elects a new one; the ensemble is unavailable for writes during the election (usually well under a few seconds) and unavailable entirely without a majority.',
    ],
    algorithms: [
      { name: 'Consensus (ZAB / Raft)', how: 'A leader orders updates and commits once a majority acknowledges; elections choose the most up-to-date node.', cost: 'Write latency is one round trip to a majority plus a disk flush; throughput is limited to a few tens of thousands of writes per second.' },
      { name: 'Leader election with ephemeral sequential nodes', how: 'Each candidate creates an ephemeral sequential node; the lowest sequence number is leader; others watch their predecessor.', cost: 'Avoids a herd effect on failure.' },
      { name: 'Fencing tokens', how: 'Each lock grant carries an increasing number that storage rejects if stale.', cost: 'Protects against a paused ex-leader still acting.' },
    ],
    structures: [
      { name: 'Replicated transaction log + snapshots', why: 'Durability and recovery.' },
      { name: 'In-memory tree of znodes', why: 'Fast reads; the whole dataset must fit in memory, so it holds small coordination data only.' },
    ],
    failures: [
      { mode: 'Loss of majority', what: 'Writes and consistent operations stop.', fix: 'Spread nodes across failure domains; odd sizes; never an even split across two sites.' },
      { mode: 'Session expiry during a pause', what: 'A long GC pause expires the session while the client still believes it holds the lock.', fix: 'Fencing tokens and checking the session before acting.' },
      { mode: 'Overload from watches or large data', what: 'Treating it like a database overloads the ensemble with data and watches.', fix: 'Keep data tiny; move heavy state elsewhere.' },
    ],
    knobs: [
      { name: 'Ensemble size', effect: '3 tolerates 1 failure, 5 tolerates 2; bigger slows writes.' },
      { name: 'Session timeout', effect: 'Failure detection speed vs false expiries.' },
    ],
    pitfalls: [
      'Using it as a general-purpose database or queue.',
      'Assuming a lock is held after a pause without fencing.',
    ],
    model: 'ArchSim treats it as a small coordination dependency whose loss halts the systems relying on it; consensus rounds are not simulated.',
  },
}
