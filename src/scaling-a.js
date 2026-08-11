// Scaling playbooks, part 1 of 2. See scaling.js for the shape and the
// shared principles. Node ids in `n` refer to the matching template so the
// Scale tab can spotlight the components a lever touches.

export default {

'URL Shortener (Bitly)': {
  constraint: 'Reads. Writes are a rounding error — the whole system is one hot key-value lookup repeated a few hundred thousand times a second.',
  ladder: [
    ['10K users', '~2 rps', 'One app server and one database. Genuinely enough; do not add a cache yet.'],
    ['1M users', '~250 rps', 'Split the redirect path from the write path so you can scale them separately, and put Redis in front of the database. Hit rate will exceed 95% because link popularity is a savage power law.'],
    ['100M users', '~25K rps', 'Redirects move to the CDN edge with a short TTL. Origin now sees only cache misses. Shard the KV store by short code; the counter moves to block allocation so it is off the hot path.'],
    ['1B users', '~250K rps', 'Multi-region read replicas with the edge serving nearly everything. Writes stay single-region — 100 writes/s does not need geo-distribution, and keeping one writer keeps code generation trivially collision-free.'],
  ],
  levers: [
    { t: 'Serve redirects from the edge', d: 'A 302 with a Location header is a few hundred bytes and perfectly cacheable. Pushing it to the CDN removes your origin from the critical path for most traffic. Keep the TTL short (60s) so revocation still works.', n: ['cdn'] },
    { t: 'Separate read and write services', d: 'They have opposite traffic profiles and opposite failure tolerances. A write outage is an inconvenience; a redirect outage breaks every link ever shared.', n: ['app'] },
    { t: 'In-process LRU on each redirect server', d: 'A few thousand hottest codes held in local memory removes even the Redis network hop. Costs a few megabytes and absorbs viral links without touching a shared shard.', n: ['app', 'cache'] },
    { t: 'Block-allocate the counter', d: 'Each instance takes 1,000 ids at a time from the counter service, so code generation costs one coordination call per thousand writes instead of one per write.', n: ['app', 'db'] },
    { t: 'Never write analytics inline', d: 'Emit the click to a queue and aggregate asynchronously. Approximate counts are fine; a synchronous counter write would triple your redirect latency.', n: ['db'] },
  ],
  wall: { t: 'Revocation latency', d: 'Once you cache aggressively at the edge you can no longer take a link down instantly. A malicious link stays live for the length of your TTL. The fix is a small, separately-replicated blocklist checked at the edge, not a shorter TTL on everything.' },
},

'Ticketmaster': {
  constraint: 'Contention on a few thousand seat rows during an on-sale, while ten million people read the same page.',
  ladder: [
    ['10K users', '~5 rps', 'One service, one relational database, row locks on booking. Correct and boring.'],
    ['1M users', '~500 rps', 'Cache event pages. Move seat holds out of the database into Redis with a TTL so payment never happens inside a transaction.'],
    ['100M users', '~30K rps', 'CDN for everything static. Shard the booking path by event so one on-sale cannot starve every other event. Add a virtual waiting room in front.'],
    ['1B users', '~200K rps at peak', 'The waiting room becomes the primary scaling mechanism: admit at the rate the booking tier can actually serve. Everything upstream of it scales horizontally; the booking tier deliberately does not.'],
  ],
  levers: [
    { t: 'Shard by event id', d: 'Every hot event gets its own booking capacity and its own lock namespace. This is the single most important move — without it a Taylor Swift on-sale takes down a regional theatre\'s Tuesday matinee.', n: ['book', 'sql'] },
    { t: 'Admission control, not scaling', d: 'You cannot scale a fixed inventory of 50,000 seats to serve 10M concurrent buyers. The queue converts an outage into a fair, visible wait — a product decision as much as a technical one.', n: ['q'] },
    { t: 'Holds in Redis, truth in SQL', d: 'A SET NX with a 10-minute TTL is your admission gate; the relational database remains the source of truth and re-validates at confirm time. Never hold a database transaction across a payment call.', n: ['lock', 'sql'] },
    { t: 'Serve the seat map stale', d: 'Browsing tolerates two seconds of staleness. Only the confirm step needs truth, so cache the map hard and let checkout be the arbiter.', n: ['cdn', 'search'] },
    { t: 'Read replicas for search', d: 'Event discovery is pure read traffic with no consistency requirement. Point it at replicas or a search index so it never competes with booking writes.', n: ['search'] },
  ],
  wall: { t: 'Inventory is finite', d: 'No architecture makes 50,000 seats satisfy 10M people. Past a point you are not scaling throughput, you are choosing a queuing discipline and a fairness policy. Be explicit about that rather than pretending more replicas help.' },
},

'Ride Sharing (Uber)': {
  constraint: 'Location writes. Six million drivers pinging every four seconds is 1.5M writes/second before a single ride is requested.',
  ladder: [
    ['10K users', '~10 rps', 'One service, Postgres with a lat/lng index. Works fine and will mislead you about what comes next.'],
    ['1M users', '~1K rps', 'Location writes stop fitting a relational database. Move the live index into Redis keyed by geohash or H3 cell; treat position as soft state with a TTL.'],
    ['100M users', '~100K rps', 'Locations flow through Kafka into an in-memory index. Adaptive ping rates cut volume: 4s when moving, far less when stationary. Batch several points per message.'],
    ['1B users', '~1.5M location writes/s', 'Shard the geo index by cell and run it per region. Matching stays regional — nobody in Delhi is matched to a driver in Mumbai, so there is no reason for a global index.'],
  ],
  levers: [
    { t: 'Never durably store live location', d: 'A position is worthless three seconds later. Keep the index in memory and rebuildable; archive the raw stream to cold storage for analytics on a path that can never block ingestion.', n: ['loc', 'geo'] },
    { t: 'Shard the geo index by cell', d: 'H3 cells partition naturally and hexagons avoid geohash edge artefacts. Hot cells — a stadium emptying — get subdivided dynamically.', n: ['geo'] },
    { t: 'Regional isolation', d: 'Cities are independent systems. Run matching, geo index and trip storage per region so a surge in one city cannot degrade another, and so no query crosses an ocean.', n: ['match', 'trip'] },
    { t: 'Adaptive ping rate', d: 'Cutting update frequency for stationary drivers removes a large fraction of writes for zero loss of match quality. The cheapest scaling lever here is sending less.', n: ['d', 'loc'] },
    { t: 'Claim the driver atomically', d: 'Two matchers can find the same nearest driver. A Redis SET NX claim before the offer is what stops double-assignment; it costs one round trip and prevents a class of bug you cannot fix later.', n: ['match'] },
    { t: 'Surge as load shedding', d: 'Pricing is a demand-management mechanism, not only a revenue one. When a cell is saturated, surge is what brings offered load back under capacity.', n: ['surge'] },
  ],
  wall: { t: 'Physical supply', d: 'When there are more riders than drivers in a cell, no amount of compute helps. The system degrades to a queue plus a price signal. Scaling the matcher past that point just makes you fail faster.' },
},

'Video Platform (YouTube)': {
  constraint: 'Egress bandwidth, then transcoding CPU. Neither is solved by adding application servers.',
  ladder: [
    ['10K users', '~20 rps', 'Upload to blob storage, transcode synchronously, serve from the bucket. Fine until someone uploads an hour of 4K.'],
    ['1M users', '~2K rps', 'Transcoding moves behind a queue. Playback moves to a CDN — this is the change that matters, because video bytes must never come from your origin.'],
    ['100M users', '~50K rps', 'Split the source into segments and encode them in parallel across a large worker fleet. Publish 720p first so the video is watchable while 4K is still encoding.'],
    ['1B users', '>90% of bytes from edge', 'Multi-CDN with origin shielding. Pre-warm edges for large channels. Storage tiering becomes a cost problem rather than a capacity one.'],
  ],
  levers: [
    { t: 'Segment-parallel transcoding', d: 'Ten-second segments encode independently, so a two-hour video finishes in the time one segment takes times the queue depth. It also makes retries cheap — a failure re-encodes one segment, not the film.', n: ['w', 'q'] },
    { t: 'CDN is the read architecture', d: 'HLS segments are immutable static files. Once they are on the edge your origin serves almost nothing, and playback scale becomes a contract negotiation rather than an engineering problem.', n: ['cdn'] },
    { t: 'Pre-signed direct upload', d: 'Multi-gigabyte files must never transit your application servers. Multipart upload straight to blob storage gives you parallelism and resumability for free.', n: ['up', 'upsvc', 'blob'] },
    { t: 'Prioritise renditions', d: 'Encode the most-watched rendition first and mark it ready independently. Perceived latency to "watchable" matters far more than time to all-renditions-complete.', n: ['w', 'out'] },
    { t: 'Approximate view counts', d: 'A write per playback is a write you cannot afford. Batch and aggregate; nobody needs the counter exact.', n: ['meta', 'q'] },
    { t: 'Tier cold storage', d: 'Viewership is a power law. Drop rarely-watched renditions and re-encode on demand; move sources to archival tiers after processing.', n: ['blob'] },
  ],
  wall: { t: 'Egress cost, not capacity', d: 'You can always buy more CDN. What you cannot do is make it cheap — at a billion watch-hours the bill is the constraint, which is why the real answer is peering and ISP-embedded caches rather than more origin servers.' },
},

'Chat (WhatsApp)': {
  constraint: 'Concurrent connections, and the routing problem they create once one server can no longer hold them all.',
  ladder: [
    ['10K users', '~10 rps', 'One WebSocket server with an in-memory map of user to socket. Delivery is a hash lookup.'],
    ['1M users', '~1K rps', 'Multiple chat servers, and now sender and recipient are on different hosts. Add a session registry and an inbox so offline delivery works.'],
    ['100M users', '~40K rps', 'Redis Pub/Sub between servers, partitioned by user id. Write to the inbox before publishing so an at-most-once drop is always recoverable.'],
    ['1B users', '200M concurrent sockets', 'Hundreds of servers at 1–2M connections each, sharded Redis, regional cells. Heartbeats plus per-user sequence numbers catch anything the realtime path loses.'],
  ],
  levers: [
    { t: 'Pub/Sub, not a topic per user', d: 'Kafka carries ~50KB of overhead per topic — 50TB just in metadata at a billion users. Redis Pub/Sub channels are in-memory pointers to subscribers with no persistence, which is exactly what a routing layer should be.', n: ['sess', 'ws'] },
    { t: 'Durability before realtime', d: 'Write the message and the inbox rows, acknowledge the sender, then publish best-effort. This ordering is what makes at-most-once delivery acceptable.', n: ['q', 'inbox'] },
    { t: 'Partition by user, not by chat', d: 'WhatsApp is dominated by 1:1 chats, so per-user channels mean one subscription per connected user instead of hundreds. Flip to per-chat only for groups above a threshold.', n: ['sess'] },
    { t: 'Heartbeats with a sequence number', d: 'A 10s ping with a 5s timeout bounds dead-connection detection at 15 seconds. Piggybacking the user\'s sequence on the ping turns the same message into missed-message detection for free.', n: ['ws'] },
    { t: 'Media never touches the socket', d: 'Pre-signed URLs move bytes directly to blob storage. A chat server holding a million sockets must not also be a file server.', n: ['media'] },
  ],
  wall: { t: 'Connections are memory, not CPU', d: 'At roughly 10KB of kernel and userspace state per socket, two million connections is tens of gigabytes before you have processed a single message. Past a point you are buying RAM and tuning file descriptors, not optimising code.' },
},

'Web Crawler': {
  constraint: 'Politeness. You are not limited by your own capacity but by how fast you are allowed to hit each domain.',
  ladder: [
    ['1M pages', '~10 pages/s', 'A single queue and a fetch loop. Works, and will get your IP banned the first time a large site dominates the frontier.'],
    ['100M pages', '~200 pages/s', 'Restructure the frontier into per-domain queues with a scheduler that respects crawl delay. Add a Bloom filter for URL dedupe.'],
    ['1B pages', '~2K pages/s', 'Separate fetching from parsing — one is IO-bound, the other CPU-bound. Aggressive DNS and robots.txt caching. Content hashing to catch mirrors.'],
    ['10B pages', '~16K pages/s', 'Partition the frontier by domain across many hosts so politeness state is local. Adaptive recrawl by observed change frequency; conditional GETs make unchanged pages nearly free.'],
  ],
  levers: [
    { t: 'Politeness as a data structure', d: 'A heap of (nextAllowedTime, domain) means a worker asking for work always receives a URL it is allowed to fetch right now. Politeness stops being something every worker has to remember.', n: ['front', 'sched'] },
    { t: 'Bloom filter for seen URLs', d: 'An exact set of 10B URLs is impractical. A Bloom filter trades a small false-positive rate — occasionally skipping a page — for a tiny memory footprint.', n: ['dedup'] },
    { t: 'Split fetch from parse', d: 'Fetchers do nothing but get bytes into blob storage. Parsers scale independently on CPU. Mixing them wastes whichever resource is not the bottleneck.', n: ['f', 'parse'] },
    { t: 'Partition by domain', d: 'All URLs for a domain must live on one host so its rate limit is enforceable locally. Partitioning any other way requires distributed coordination on every fetch.', n: ['front'] },
    { t: 'Adaptive recrawl', d: 'A news homepage changes hourly; an archived PDF never does. Tracking observed change frequency stops you spending most of your budget re-fetching static pages.', n: ['sched', 'idx'] },
  ],
  wall: { t: 'Other people\'s servers', d: 'Total throughput is bounded by the sum of what every domain permits. You scale by crawling more domains in parallel, never by crawling one domain harder. Traps — infinite calendars, session-id URLs — are the other hard limit, and they need budgets rather than capacity.' },
},

'Collab Docs (Google Docs)': {
  constraint: 'A single ordering authority per document. That is deliberate, and it caps per-document concurrency rather than total system size.',
  ladder: [
    ['10K users', '~10 rps', 'One server holding documents in memory, sequencing operations as they arrive.'],
    ['1M users', '~1K rps', 'Many document servers with sticky routing by document id. Operations append to a durable log; snapshots make loading fast.'],
    ['100M users', '~50K rps', 'Documents are independent, so this shards perfectly. Presence and cursors move to Redis with a short TTL — ephemeral data must never touch the oplog.'],
    ['1B users', 'millions of live docs', 'Regional placement by document owner, ownership handover through a coordination service, and snapshot compaction as a background fleet.'],
  ],
  levers: [
    { t: 'Documents shard perfectly', d: 'There is no cross-document consistency requirement, so total scale is just "more servers". All the difficulty is concentrated inside one document.', n: ['ws', 'ot'] },
    { t: 'Snapshot plus tail', d: 'Replaying millions of operations to open a document is too slow. Periodic snapshots mean loading reads one blob plus a short tail of operations.', n: ['log', 'db'] },
    { t: 'Presence is disposable', d: 'Cursors and selections go to Redis with a TTL and are never persisted. Losing a cursor update is invisible; losing an edit is a bug.', n: ['pres', 'cache'] },
    { t: 'Acknowledge after durability', d: 'Only ack an operation once it is appended to the log. Then a server crash loses nothing acknowledged, and clients resend their unacked buffer on reconnect.', n: ['log'] },
    { t: 'Sticky routing by doc id', d: 'The cost of choosing central-sequencer OT over CRDTs. Accept it deliberately and design the failover path — rebuild from snapshot plus log on a new owner.', n: ['lb', 'ot'] },
  ],
  wall: { t: 'Concurrent editors per document', d: 'One sequencer means one document\'s throughput is capped by one machine. Around a hundred simultaneous editors the transform cost and fan-out dominate. Google\'s answer is a hard participant limit, not a cleverer algorithm.' },
},

'News Feed (Twitter/X)': {
  constraint: 'Fan-out. One post from a large account is tens of millions of writes.',
  ladder: [
    ['10K users', '~10 rps', 'Query posts from everyone you follow at read time, merge, sort. Perfectly good.'],
    ['1M users', '~1K rps', 'Read-time merge across 500 follows is too slow. Precompute timelines: on post, push the id into each follower\'s cached list.'],
    ['100M users', '~30K rps', 'The celebrity problem arrives. Go hybrid — fan-out on write for ordinary accounts, live query at read time for the handful of huge accounts each user follows.'],
    ['1B users', '~200K rps', 'Only maintain timelines for recently-active users. Shard the graph both ways. Ranking runs on a small candidate set, never the corpus.'],
  ],
  levers: [
    { t: 'Hybrid fan-out', d: 'Most accounts have few followers so writing is cheap; users follow few celebrities so reading them live is cheap. The two problems have opposite shapes and the hybrid exploits that.', n: ['fan', 'tl'] },
    { t: 'Active users only', d: 'Precomputing timelines for dormant accounts can be most of your fan-out volume. Skip them and rebuild on next login — often an order-of-magnitude reduction.', n: ['fan', 'tlc'] },
    { t: 'Store the graph twice', d: 'Sharded by follower to answer "who do I follow", and by followee to answer "who follows me". Fan-out needs the second and it cannot be a scatter-gather.', n: ['soc'] },
    { t: 'Rank a candidate set', d: 'Pull a few hundred ids from the merged lists, score those, hydrate the top twenty. Scoring is affordable only because the candidate set is small.', n: ['rank'] },
    { t: 'Timelines hold ids, not posts', d: 'A cached list of a few hundred integers per user is cheap enough to keep in memory for hundreds of millions of users. Hydrate bodies in one batch read.', n: ['tlc', 'db'] },
  ],
  wall: { t: 'The 100M-follower post', d: 'No fan-out strategy makes that a write-time operation. It has to become a read-time merge, which means your read path must always be able to fall back to querying live — the hybrid is not an optimisation, it is structural.' },
},

'File Sync (Dropbox)': {
  constraint: 'Bytes. Everything else is metadata, and metadata is small.',
  ladder: [
    ['10K users', '~5 rps', 'Upload through the app server to storage. Fine until a 50GB file fails at 99%.'],
    ['1M users', '~500 rps', 'Chunk client-side, hash each chunk, upload only what is missing via pre-signed URLs. Resumability, dedupe and delta sync all fall out of this one change.'],
    ['100M users', '~20K rps', 'Metadata database shards by user. A notification service pushes change events; offline devices catch up from a version cursor.'],
    ['1B users', 'petabytes', 'CDN in front of shared downloads. Chunk garbage collection becomes a real subsystem. Cross-region replication for both metadata and blobs.'],
  ],
  levers: [
    { t: 'Bytes bypass your servers', d: 'Pre-signed URLs mean the data plane never touches application capacity. Your servers scale with metadata operations, which are thousands of times smaller.', n: ['blockp', 'blob'] },
    { t: 'Content-addressed chunks', d: 'Keying blocks by content hash gives global deduplication — typically around 30% saving on a real corpus — and makes re-upload after failure a diff rather than a restart.', n: ['blockp', 'blob'] },
    { t: 'Version cursor, not tree diff', d: 'A monotonic per-user cursor makes reconnect sync a range read. Diffing file trees on every reconnect does not scale and gets subtly wrong.', n: ['notif', 'db'] },
    { t: 'Shard metadata by user', d: 'There are no cross-user queries on the hot path, so user id is a clean partition key with no scatter-gather.', n: ['meta', 'db'] },
    { t: 'Async everything after commit', d: 'Virus scanning, thumbnailing and indexing are consumers of an upload event. None may block the user\'s upload from completing.', n: ['q'] },
  ],
  wall: { t: 'Dedupe makes deletion hard', d: 'A chunk shared by a thousand files cannot be deleted when one is removed. Reference counting or mark-and-sweep over petabytes is a permanent background cost, and the grace period it needs is a correctness requirement, not a tuning knob.' },
},

'Rate Limiter (as a system)': {
  constraint: 'It sits in front of every request, so its own latency and availability bound the whole platform.',
  ladder: [
    ['10K rps', 'in-process', 'A local token bucket per instance. No shared state, no network hop, slightly wrong under uneven load balancing.'],
    ['100K rps', 'shared Redis', 'Counters move to Redis so limits are global. Use a Lua script so read-compute-write is atomic — otherwise concurrent servers over-admit.'],
    ['1M rps', 'sharded', 'Shard Redis by key hash. Sliding-window counters rather than fixed windows to kill boundary bursts.'],
    ['10M rps', 'local budgets', 'Give each instance 1/N of the limit to spend locally, resynced periodically. You trade exactness for removing the network hop entirely.'],
  ],
  levers: [
    { t: 'One atomic round trip', d: 'A Lua script that reads counters, computes the weighted window, increments and returns the decision. Any design needing two round trips doubles your added latency and reintroduces the race.', n: ['redis', 'rl'] },
    { t: 'Fail open, always', d: 'A limiter that fails closed converts a Redis blip into a total platform outage. Fail open, alarm loudly, and fall back to a conservative local limit.', n: ['rl'] },
    { t: 'Local budget for hot keys', d: 'One abusive key can saturate a shard. Splitting the limit across instances and checking locally removes the shared bottleneck at the cost of some approximation at the boundary.', n: ['rl', 'redis'] },
    { t: 'Rules cached in memory', d: 'Rule lookups must never hit the network on the hot path. Push config changes to instances; never poll per request.', n: ['rules'] },
    { t: 'Limit per region', d: 'Global exactness would require cross-region coordination on every request. Per-region limits with a divided budget are almost always the right trade.', n: ['redis'] },
  ],
  wall: { t: 'Accuracy versus latency', d: 'Perfectly exact global counting requires consensus per request, which is far more expensive than the thing you are protecting. Every real limiter is approximate; the engineering is in choosing where the error lands.' },
},

'Redis (Distributed Cache)': {
  constraint: 'Everything lives in memory on a fixed number of shards, so total RAM across the cluster is the hard ceiling, not CPU or disk.',
  ladder: [
    ['10K ops/s', 'single instance', 'One Redis process, no cluster, no replica. Whatever fits in one box\'s memory is the whole capacity.'],
    ['100K ops/s', 'primary + replicas', 'Reads split to replicas, writes stay on the primary. Async replication means a failover can lose the last few writes.'],
    ['1M ops/s', 'clustered', 'Hash slots spread across many primaries, each with its own replicas. Hot keys now live on one shard and can still bottleneck it.'],
    ['10M ops/s', 'client-side caching', 'Push the hottest keys into an in-process cache on the app server itself, invalidated over the cluster bus, so the cluster only sees the misses.'],
  ],
  levers: [
    { t: 'Hash slots, not consistent hashing', d: 'Real Redis Cluster fixes 16384 slots and assigns ranges to shards, which makes resharding a matter of moving whole slot ranges rather than rehashing every key.', n: ['primary', 'gw'] },
    { t: 'Replication is async by default', d: 'A write is acknowledged before it reaches a replica. Losing a primary loses a small window of writes unless you pay the latency cost of WAIT.', n: ['primary', 'replica'] },
    { t: 'AOF and RDB are different trade-offs', d: 'RDB is a cheap periodic snapshot with a bigger loss window on crash; AOF logs every write and replays it on restart, at the cost of write overhead and a longer recovery.', n: ['persist'] },
    { t: 'One structure, several products', d: 'Strings back the cache, sorted sets back the leaderboard, and pub/sub backs live invalidation — the same cluster serves all of it, which is convenient until one workload starves another for memory.', n: ['cache', 'zset', 'sess'] },
    { t: 'Hot keys defeat sharding', d: 'A single celebrity key still lands on one shard no matter how many shards exist. Client-side caching or explicit key splitting is the only fix once that shard saturates.', n: ['primary'] },
  ],
  wall: { t: 'Memory is the whole budget', d: 'Every byte stored is a byte of RAM across the cluster, and RAM does not get cheaper the way disk does. At real scale the question stops being throughput and becomes what earns a place in memory at all, with everything else evicted or pushed to a cheaper store.' },
},

'Video Surveillance (VMS)': {
  constraint: 'Sustained write volume that never pauses, against reads that almost never happen. Storage grows whether or not anyone watches.',
  ladder: [
    ['10 cameras', '~0.3 TB/day', 'One recorder writing segments to local disk. Genuinely enough, and far simpler than what follows.'],
    ['1K cameras', '~27 TB/day', 'Edge recorders buffer locally so a network blip does not lose footage. Segments to object storage, detection on the live stream, events in an index.'],
    ['10K cameras', '~270 TB/day', 'Tier by age and drop bitrate after a few days. Shard the event index by camera group. Retention becomes the largest cost lever in the system.'],
    ['100K cameras', '~2.7 PB/day', 'Regional ingest and regional storage — moving this volume between regions costs more than storing it. Detection at the edge so only events cross the wire.'],
  ],
  levers: [
    { t: 'Buffer at the edge', d: 'A camera cannot retransmit what it did not keep. An edge recorder with hours of local buffer turns a network outage into a delayed upload instead of a permanent gap.', n: ['edge'] },
    { t: 'Tier and downsample by age', d: 'Yesterday needs full fidelity; last month rarely does. Dropping bitrate after a few days cuts the steady state far more than any compression choice.', n: ['blob', 'life'] },
    { t: 'Detect once, at ingest', d: 'Re-scanning the archive costs orders of magnitude more than analysing each frame as it arrives. Store the event, not the intention to look later.', n: ['det'] },
    { t: 'Index events, not frames', d: 'Every operator query should hit an index and come back with segment references. A query that scans video is the failure this architecture exists to prevent.', n: ['meta'] },
    { t: 'Retention as a scheduled path', d: 'Deletion has to be part of the system with its own monitoring. Retention that depends on someone remembering is unbounded growth with extra steps.', n: ['life'] },
  ],
  wall: { t: 'Cost per camera-day', d: 'Past a few thousand cameras the binding constraint is not throughput but the monthly bill, and the only real levers are retention period and bitrate. Every other optimisation is rounding error against those two.' },
},

'Job Scheduler (Airflow-like)': {
  constraint: 'Correctness under duplicate execution, not throughput. Scheduling 50,000 tasks is easy; making each safe to run twice is the work.',
  ladder: [
    ['10 DAGs', 'a few runs/hour', 'A single process with cron and a table. Genuinely enough, and far easier to reason about.'],
    ['1K DAGs', '~50K runs/day', 'Leader-elected scheduler, a queue, a worker pool. Leases and heartbeats so worker death is recoverable.'],
    ['10K DAGs', '~1M runs/day', 'Shard the scheduler by DAG group so one tick does not scan everything. Separate queues per priority so backfills cannot starve scheduled work.'],
    ['100K DAGs', '~10M runs/day', 'Run state outgrows one database — partition by DAG. Archive completed runs aggressively; run history grows faster than anything else here.'],
  ],
  levers: [
    { t: 'Elect one scheduler', d: 'Two schedulers reading the same table both enqueue the same due task. Leader election plus a uniqueness constraint on the attempt is what makes that harmless rather than rare.', n: ['sched', 'lock'] },
    { t: 'Leases with heartbeats', d: 'A worker that dies leaves a run marked running forever. An expiring lease turns that into a reclaimable task instead of a stuck one.', n: ['w', 'meta'] },
    { t: 'Separate the backfill queue', d: 'A year of backfill enqueued at once sits ahead of this morning\'s run. Different queues, or a priority the scheduler honours.', n: ['q'] },
    { t: 'Shard the scheduler tick', d: 'One loop scanning every DAG becomes the bottleneck long before the workers do. Partition by DAG group and give each its own tick.', n: ['sched'] },
    { t: 'Archive run history', d: 'Every task attempt writes a row and a log. History outgrows the operational data by an order of magnitude, so move it out on a schedule.', n: ['obs', 'res'] },
  ],
  wall: { t: 'Idempotency is not something you can add later', d: 'At scale every task will eventually run twice. Tasks written assuming single execution must each be rewritten, one at a time, by whoever owns them — which is why this is a founding constraint rather than an optimisation.' },
},

'OS Update Delivery (OTA)': {
  constraint: 'Blast radius. Bandwidth is a solved problem; a bad build reaching devices faster than anyone can react is not.',
  ladder: [
    ['10K devices', '~0.1 rps', 'A static manifest on object storage. Devices poll it. Genuinely enough.'],
    ['10M devices', '~1K rps', 'CDN for payloads, a check-in API in front of a cached manifest, and cohorts so a bad build hits 1% first.'],
    ['100M devices', '~12K rps', 'Deltas per source version. Automatic halt on telemetry. Jittered check-in windows so midnight local time is not a wall of traffic.'],
    ['1B devices', '~120K rps', 'Regional check-in so the call never crosses an ocean. Cohort state sharded by device hash. The failure detector becomes the most important service you run.'],
  ],
  levers: [
    { t: 'Jitter the check-in', d: 'A fixed daily interval means every device in a timezone wakes together. A random offset within the window turns a spike into a plateau and costs nothing.', n: ['dev', 'chk'] },
    { t: 'Answer no from cache', d: 'Almost every check-in is told there is nothing for it. That answer should come from a cached manifest and a cohort rule, never a per-device database read.', n: ['man', 'chk'] },
    { t: 'Deltas, not full images', d: 'A patch against the exact installed version is roughly a tenth of the size. The cost is generating and storing one payload per meaningful source version.', n: ['blob'] },
    { t: 'Halt without a human', d: 'A bad build reaches devices at line rate. If stopping requires someone to read an alert, you have already shipped it to millions.', n: ['halt', 'cohort'] },
    { t: 'Watch for silence', d: 'A device that fails to boot cannot report a failure. Alert on check-ins that stop arriving, because the worst outcome is the one that cannot tell you about itself.', n: ['tel', 'halt'] },
  ],
  wall: { t: 'You cannot reach a bricked device', d: 'Every other system in this library can be fixed by deploying again. Here the failure mode removes your ability to deploy at all, which is why staged rollout and automatic halt are the architecture rather than an operational practice.' },
},

'Local Search (Yelp)': {
  constraint: 'Query fan-out over a large document set with combined geo, attribute and relevance filtering.',
  ladder: [
    ['10K users', '~5 rps', 'Postgres with PostGIS. Genuinely sufficient, and simpler than what follows.'],
    ['1M users', '~500 rps', 'Move search to an inverted index with a geo field. Keep the relational store as the source of truth; never let search traffic hit it.'],
    ['100M users', '~25K rps', 'CDC pipeline keeps the index in sync — never dual-write. Cache results keyed by a normalised query with location snapped to a grid cell.'],
    ['1B users', '~100K rps', 'Shard the index geographically so dense regions get their own shards. Regional replicas so a query never crosses an ocean.'],
  ],
  levers: [
    { t: 'CDC, never dual writes', d: 'Writing to the database and the index from application code guarantees they diverge the first time one call fails. Reading the change log gives you one ordered stream of truth.', n: ['biz', 'rev'] },
    { t: 'Snap location to a grid', d: 'Two users fifty metres apart should share a cache entry. Rounding coordinates to a cell turns a near-zero hit rate into a high one.', n: ['cache'] },
    { t: 'Denormalise the rating', d: 'Aggregating 50,000 reviews at query time makes every search scan them. Keep (sum, count) on the business row and project the derived average into the index.', n: ['rev', 'biz'] },
    { t: 'Shard the index by geography', d: 'Manhattan needs its own shards; rural regions share one. Sharding by document id instead means every query fans out to every shard.', n: ['geo'] },
    { t: 'Search-after cursors', d: 'Deep offset pagination degrades badly on an inverted index. Cursor pagination stays constant-cost at any depth.', n: ['app'] },
  ],
  wall: { t: 'Index freshness versus cost', d: 'Reindexing 100M documents to change the ranking or the schema takes hours. That reindex cost, not query throughput, is what limits how fast you can iterate on relevance.' },
},

'Leaderboard (Top-K)': {
  constraint: 'Cardinality. You cannot keep an exact counter for hundreds of millions of items per time window.',
  ladder: [
    ['10K items', 'trivial', 'A sorted set in Redis. ZADD on write, ZREVRANGE on read. Done.'],
    ['1M items', '~1K events/s', 'Still a sorted set, but writes now need batching. Aggregate in the app before hitting Redis.'],
    ['100M items', '~100K events/s', 'Exact counters stop fitting memory. Move to a count-min sketch plus a heap per one-minute bucket; longer windows are merges of buckets.'],
    ['1B events/hr', '~300K events/s', 'Partition the stream, keep a sketch per partition, merge at window close. A nightly exact batch job corrects the settled windows.'],
  ],
  levers: [
    { t: 'Sketches instead of counters', d: 'A count-min sketch estimates any item\'s count in about a megabyte regardless of cardinality. Collisions only inflate, never deflate, so the minimum across rows is a tight upper bound — and error is irrelevant at the head of the distribution, which is all you report.', n: ['agg'] },
    { t: 'Bucket by minute, merge on read', d: 'Sketches are additive. One-minute buckets mean an hourly query merges 60 structures and a daily query merges 24 hourly rollups. Precompute the rollups so nothing merges more than a couple of dozen.', n: ['agg', 'z'] },
    { t: 'Partition then merge', d: 'One operator cannot ingest 100K events/s. Keep a local sketch per partition and merge at close — but re-query the merged sketch for the final ranking, because an item can be just below the cut in every partition yet globally top-K.', n: ['ing', 'k'] },
    { t: 'Serve from a tiny cache', d: 'The answer is a few hundred ids. Precompute it and the read path is one key lookup, independent of event volume.', n: ['read', 'z'] },
    { t: 'Batch layer for truth', d: 'Archive raw events and recompute exactly for closed windows. Fresh windows are fast and approximate; settled windows are exact.', n: ['db'] },
  ],
  wall: { t: 'The long tail is unknowable', d: 'Sketches are accurate for the head and meaningless for the tail. If someone asks for rank 900,000 you cannot answer from the sketch — that query requires the exact batch layer and a completely different latency budget.' },
},

'Notification System': {
  constraint: 'Third-party delivery providers, and the fan-out multiplier when one event notifies millions.',
  ladder: [
    ['10K users', '~5 rps', 'Send synchronously from the service. Fine, and it will bite you the first time the provider is slow.'],
    ['1M users', '~500 rps', 'Queue between the producer and delivery. Preference lookups and per-channel workers. Retries with backoff.'],
    ['100M users', '~20K rps', 'Separate queues per channel with independent scaling — email tolerates minutes, push does not. Deduplicate aggressively.'],
    ['1B users', 'burst to millions', 'Fan-out workers process follower lists in parallel chunks. Rate limits per provider become a scheduling problem; batching and digesting become product features.'],
  ],
  levers: [
    { t: 'A queue per channel', d: 'Push, email and SMS have wildly different latency budgets, costs and failure modes. One shared queue means a slow SMS provider delays every push notification.', n: ['q', 'push', 'email', 'sms'] },
    { t: 'Deduplicate before sending', d: 'The same event often arrives from several sources. A dedupe key with a short-lived set stops users receiving the same alert three times — the most visible failure mode in this system.', n: ['dedup'] },
    { t: 'Preferences on the hot path, cached', d: 'Every send checks quiet hours, channel opt-outs and frequency caps. Uncached, this becomes your busiest database.', n: ['pref'] },
    { t: 'Respect provider limits', d: 'APNs and FCM have their own quotas. Your worker fleet must be rate-limited towards them, or you get throttled and lose messages you believed you sent.', n: ['push', 'w'] },
    { t: 'Digest instead of deliver', d: 'Above a threshold, batching notifications into a digest is both cheaper and better product. Scaling by sending less is the strongest lever available.', n: ['w'] },
  ],
  wall: { t: 'You do not control delivery', d: 'Provider throughput, throttling and outages are outside your system. Beyond a point you can only queue, retry and degrade gracefully — and be honest that "sent" is not "delivered".' },
},

'Payment System (Stripe-lite)': {
  constraint: 'Correctness. This is the rare system where you scale by refusing to relax consistency.',
  ladder: [
    ['10K txn/day', '~1 rps', 'One service, one ACID database, synchronous calls to the processor.'],
    ['1M txn/day', '~50 rps', 'Idempotency keys on every mutating call. The ledger becomes append-only. An outbox makes the "charge then record" step atomic.'],
    ['100M txn/day', '~4K rps', 'Shard the ledger by merchant. Async reconciliation against processor reports. Webhooks with retry and signature verification.'],
    ['1B txn/day', '~40K rps', 'Regional processing with per-region ledgers. Smart routing across multiple acquirers. Settlement becomes its own batch pipeline.'],
  ],
  levers: [
    { t: 'Idempotency keys, client-generated', d: 'The key must exist before the first attempt or retries create duplicate charges. This is the single most important property in the system and it cannot be retrofitted.', n: ['idem', 'gw'] },
    { t: 'Append-only double-entry ledger', d: 'Never mutate a balance. Balances are derived from immutable entries, which makes every discrepancy explainable and every bug recoverable.', n: ['led'] },
    { t: 'Transactional outbox', d: 'You cannot atomically write to your database and call an external API. Write the intent in the same transaction, then let a worker publish it — this is what removes the lost-update window.', n: ['q', 'w'] },
    { t: 'Shard by merchant', d: 'Merchants are independent. Sharding by merchant id keeps every transaction local to one shard and avoids distributed transactions entirely.', n: ['led'] },
    { t: 'Reconcile continuously', d: 'The processor is the other source of truth. A daily diff that nobody reads is not reconciliation; make mismatches an alert with an owner.', n: ['rec', 'psp'] },
  ],
  wall: { t: 'The processor is the ceiling', d: 'Your throughput is whatever your acquirers will accept. Scaling means adding acquirers and routing across them, which multiplies your reconciliation surface — you are trading a throughput problem for a correctness problem.' },
},

'Search Autocomplete': {
  constraint: 'Latency. Every keystroke is a request, and above ~100ms the feature feels broken.',
  ladder: [
    ['10K users', '~50 rps', 'A trie in memory on one server. Rebuild nightly from query logs.'],
    ['1M users', '~5K rps', 'Cache the top completions per prefix. Most traffic is short prefixes, so a small cache covers a large share.'],
    ['100M users', '~45K rps', 'Push short-prefix results to the CDN edge — the first two characters cover most requests and change slowly.'],
    ['1B users', '~500K rps', 'Sharded trie by prefix range, regional replicas, streaming updates for trending queries rather than nightly rebuilds.'],
  ],
  levers: [
    { t: 'Cache short prefixes at the edge', d: 'Completions for "a" and "th" are identical for nearly everyone and change hourly at most. Serving them from the CDN removes the majority of requests from your origin.', n: ['cdn'] },
    { t: 'Precompute top-K per prefix', d: 'Store the answer, not the data to compute it. Each trie node holds its top ten completions so a lookup is a walk plus a read, never a sort.', n: ['trie'] },
    { t: 'Debounce on the client', d: 'Not every keystroke needs a request. A 50ms debounce cuts request volume substantially at zero perceptible cost — the cheapest scaling lever in the system.', n: ['c'] },
    { t: 'Shard by prefix range', d: 'Partitioning the trie by first characters keeps each shard independent and each query on one shard.', n: ['trie', 'ac'] },
    { t: 'Stream trending updates', d: 'Nightly rebuilds miss breaking news, which is exactly when autocomplete matters most. A streaming path for fast-rising queries layered over the stable index.', n: ['k', 'agg'] },
  ],
  wall: { t: 'Speed of light', d: 'A cross-continent round trip is 150ms before your service does anything. Below a certain latency the only remaining lever is physical proximity — regional replicas and edge presence, not faster code.' },
},

'µsvc: E-commerce (Saga)': {
  constraint: 'Distributed transactions. Every cross-service write is a consistency problem you chose to have.',
  ladder: [
    ['10K orders/day', '~1 rps', 'One service, one database, one transaction. If you can stay here, stay here.'],
    ['1M orders/day', '~50 rps', 'Split by bounded context with a database each. Orders now span services, so introduce sagas with explicit compensation.'],
    ['10M orders/day', '~500 rps', 'Orchestrated sagas with persisted state so an in-flight order survives a restart. Idempotent handlers everywhere.'],
    ['100M orders/day', '~6K rps', 'Shard each service independently. The saga orchestrator becomes a scaled, partitioned component in its own right.'],
  ],
  levers: [
    { t: 'Database per service, truly', d: 'A shared database means you have a distributed monolith with extra latency. The split only pays off when each service owns its schema outright.', n: ['odb', 'idb', 'pdb'] },
    { t: 'Orchestration over choreography at scale', d: 'Choreographed events are simpler to start with and become impossible to debug past a handful of steps. An orchestrator gives you one place that knows the state of an order.', n: ['saga'] },
    { t: 'Compensate, do not roll back', d: 'There is no distributed rollback. Every step needs an explicit inverse — refund, restock, cancel — and those inverses must be idempotent too.', n: ['saga', 'pay'] },
    { t: 'Inventory is the contended resource', d: 'It needs real transactions and conditional decrements. Do not make it eventually consistent to fit the pattern; reserve at checkout, not at add-to-cart.', n: ['inv', 'idb'] },
    { t: 'Persist saga state', d: 'An in-memory orchestrator loses in-flight orders on deploy. State in a store means a restart resumes rather than abandons.', n: ['saga', 'bus'] },
  ],
  wall: { t: 'Partial failure is permanent', d: 'At scale some sagas will get stuck with a charged card and no shipment. You cannot eliminate this — you can only make it detectable, bounded and automatically compensated. Budget for an operations surface, not just code.' },
},

'µsvc: CQRS + Event Sourcing': {
  constraint: 'Projection lag, and the cost of rebuilding read models from a very long event log.',
  ladder: [
    ['10K users', '~10 rps', 'Command side and query side in one service. Events give you audit and time travel; that alone can be worth it.'],
    ['1M users', '~1K rps', 'Split the deployments. Read models are separate stores shaped for their queries. Accept and surface eventual consistency in the UI.'],
    ['100M users', '~50K rps', 'Multiple independent read models, each scaled to its own load. Snapshots so aggregate rehydration does not replay from the beginning.'],
    ['1B users', 'billions of events', 'Partition the event store by aggregate id. Projection workers scale per read model. Rebuilds run in parallel against a shadow store.'],
  ],
  levers: [
    { t: 'Reads scale independently', d: 'The whole point: a read model can be replicated, cached or replaced without touching the write path, and each can use a different store.', n: ['rd1', 'rd2', 'qc'] },
    { t: 'Snapshot aggregates', d: 'Replaying 100,000 events to load one aggregate is not viable. Periodic snapshots plus a short tail keeps load time constant.', n: ['snap', 'es'] },
    { t: 'Partition by aggregate id', d: 'Ordering only matters within an aggregate. Partitioning by it gives you parallelism while preserving the only ordering guarantee that matters.', n: ['es'] },
    { t: 'Design for lag', d: 'The user who just wrote will read their own stale data. Either read-your-writes from the command side or make the UI honest about pending state — do not pretend the lag is not there.', n: ['proj', 'qry'] },
    { t: 'Rebuild into a shadow', d: 'Projection rebuilds are routine, not exceptional. Build into a parallel store and swap, so a rebuild never takes the read path down.', n: ['proj'] },
  ],
  wall: { t: 'The log is forever', d: 'Events are immutable, so a schema mistake is permanent and must be handled by upcasting on read for the life of the system. Rebuild time grows with history, and past a few billion events "just rebuild it" stops being an option you can exercise casually.' },
},

'µsvc: BFF + Mesh Platform': {
  constraint: 'Operational surface. The mesh scales fine; the number of moving parts is what bites.',
  ladder: [
    ['10K users', '~10 rps', 'One API for all clients. A BFF is premature here.'],
    ['1M users', '~1K rps', 'Web and mobile want genuinely different payloads. Split the BFFs; each team owns theirs.'],
    ['100M users', '~50K rps', 'Service mesh handles retries, timeouts, circuit breaking and mTLS uniformly rather than in every service in three languages.'],
    ['1B users', '~500K rps', 'Regional cells, each a full stack. The mesh control plane becomes a scaling concern of its own and must be regionalised too.'],
  ],
  levers: [
    { t: 'A BFF per client type', d: 'Mobile wants fewer, fatter responses; web wants many small ones. One shared API forces both into a compromise that suits neither and grows conditionals forever.', n: ['bffw', 'bffm'] },
    { t: 'Resilience in the sidecar', d: 'Retries, timeouts and circuit breakers implemented once in the mesh rather than per service. Crucially, it means retry budgets are enforceable globally.', n: ['mesh'] },
    { t: 'Cell-based regions', d: 'A full independent stack per region bounds the blast radius of any failure to one cell and gives you a natural deployment unit.', n: ['tr', 'reg'] },
    { t: 'Cache at the BFF', d: 'The BFF knows which fragments are shared across users. That is the right layer for response caching, above the per-service caches.', n: ['cache'] },
    { t: 'Config and discovery must be HA', d: 'The registry and config server are on the critical path for everything. They need higher availability than the services they serve, plus local caching so a blip is survivable.', n: ['reg', 'cfg'] },
  ],
  wall: { t: 'Retry amplification', d: 'Three services each retrying three times is 27 requests to the bottom tier. At scale a mesh makes a small failure into a self-inflicted denial of service unless you enforce retry budgets and deadline propagation — which is a policy problem, not a capacity one.' },
},

'µsvc: Event-Driven Orders': {
  constraint: 'The event bus becomes the system of record for coordination, and every consumer must tolerate replay.',
  ladder: [
    ['10K orders/day', '~1 rps', 'Direct synchronous calls between services. Simple and adequate.'],
    ['1M orders/day', '~50 rps', 'A bus decouples producers from consumers. Consumers scale independently; a slow one no longer blocks checkout.'],
    ['10M orders/day', '~500 rps', 'Partition topics by order id. Dead-letter queues with alerting so poison messages surface rather than silently vanish.'],
    ['100M orders/day', '~8K rps', 'Consumer groups scaled per topic, projections for read paths, replay tooling as a first-class operational capability.'],
  ],
  levers: [
    { t: 'Partition by order id', d: 'Ordering only matters within one order. That key gives you full parallelism while preserving the guarantee that matters.', n: ['bus'] },
    { t: 'Idempotent consumers', d: 'At-least-once delivery is the only realistic guarantee, so every handler must tolerate seeing the same event twice. Design it in from the first consumer.', n: ['pay', 'inv', 'notif'] },
    { t: 'Dead-letter with an owner', d: 'A DLQ nobody watches is a data loss mechanism with extra steps. Alert on depth and make replay a routine operation.', n: ['dlq'] },
    { t: 'Projections for reads', d: 'Never query the bus to answer a user question. Materialise read models from events and serve from those.', n: ['proj'] },
    { t: 'Schema versioning up front', d: 'Consumers deploy independently, so producers and consumers will run different schema versions simultaneously. Additive-only changes and a registry, from day one.', n: ['bus'] },
  ],
  wall: { t: 'Debuggability', d: 'Tracing one order across a dozen asynchronous hops is genuinely hard, and it gets harder with every consumer. The bus scales; your ability to reason about it does not. Distributed tracing with a correlation id is not optional at this size.' },
},

'µsvc: Strangler Migration': {
  constraint: 'The monolith\'s database. Until writes move, you have added a network hop and nothing else.',
  ladder: [
    ['start', 'all traffic to mono', 'Routing layer in front so traffic can be redirected per endpoint without clients noticing.'],
    ['first slice', '~10% extracted', 'One bounded context moves out, reading from a CDC-fed copy while the monolith still owns writes.'],
    ['halfway', '~50%', 'Extracted services own their writes. CDC now flows both ways, which is the most dangerous phase — plan to leave it quickly.'],
    ['done', '~100%', 'Monolith is read-only, then retired. The routing layer stays as your gateway.'],
  ],
  levers: [
    { t: 'Route per endpoint', d: 'The gateway is what makes incremental migration possible and reversible. Every slice can be rolled back by flipping a route.', n: ['gw', 'lb'] },
    { t: 'CDC before dual-write', d: 'Dual-writing from application code diverges the moment one write fails. Change data capture gives one ordered stream and no lost updates.', n: ['cdc', 'sync'] },
    { t: 'Extract by write ownership', d: 'A service that reads its own data but cannot write it has not been extracted. Sequence the work by which context can take ownership of its writes.', n: ['new1', 'ndb1'] },
    { t: 'Shadow traffic first', d: 'Send production reads to the new service and compare responses without serving them. Catches behavioural drift before any user sees it.', n: ['new2', 'ndb2'] },
    { t: 'Set an end date', d: 'Bidirectional sync is the riskiest state and teams live in it for years. Treat it as a migration phase with a deadline, not an architecture.', n: ['sync', 'mono'] },
  ],
  wall: { t: 'The shared database', d: 'Foreign keys and joins spanning the boundary are what actually block extraction. Breaking them means denormalising and accepting eventual consistency between contexts — a modelling problem no amount of infrastructure solves.' },
},

'Data Platform (Lakehouse)': {
  constraint: 'Not throughput — cost and freshness. You can always add compute; you cannot always justify it.',
  ladder: [
    ['GBs/day', 'nightly batch', 'Extract to a warehouse overnight. Perfectly adequate for most companies and far cheaper than what follows.'],
    ['TBs/day', 'hourly + CDC', 'CDC from operational stores into a raw lake. ELT transforms in the warehouse. An orchestrator owns the DAGs.'],
    ['100s TB/day', 'streaming ingest', 'Streaming into the raw layer with batch curation. Partitioning and file compaction become load-bearing.'],
    ['PBs', 'medallion at scale', 'Separate storage from compute so query clusters scale independently. Incremental models rather than full refreshes.'],
  ],
  levers: [
    { t: 'Separate storage from compute', d: 'The defining property of a lakehouse. Storage grows forever and cheaply; compute scales elastically with query load and is switched off when idle.', n: ['raw', 'cur', 'wh'] },
    { t: 'Partition and compact', d: 'Small-file proliferation destroys query performance more reliably than data volume ever will. Compaction is a permanent background job, not a one-off cleanup.', n: ['raw', 'cur'] },
    { t: 'Incremental models', d: 'Full-refresh transforms stop being viable somewhere in the terabytes. Incremental processing with watermarks is what keeps daily cost flat as history grows.', n: ['etl'] },
    { t: 'CDC, not bulk extracts', d: 'Nightly full table dumps put load on production and give you day-old data. Change capture gives you both lower impact and better freshness.', n: ['cdc', 'oltp'] },
    { t: 'Schema contracts', d: 'An upstream schema change silently breaking twenty downstream models is the characteristic failure of this system. A registry with enforcement turns it into a build failure.', n: ['sch'] },
  ],
  wall: { t: 'Query cost, not query capacity', d: 'A badly written query over a petabyte costs real money every time someone runs it. Past a point governance, quotas and cost attribution matter more than any infrastructure decision.' },
},

'GenAI: RAG Assistant': {
  constraint: 'GPU inference. It dominates latency and it dominates the bill by an order of magnitude.',
  ladder: [
    ['100 users', '~1 rps', 'One embedding model, one vector store, one LLM endpoint. Latency is seconds and that is fine.'],
    ['10K users', '~50 rps', 'Semantic caching for repeated questions. Batch embedding requests. Retrieval is not your bottleneck and will not be.'],
    ['100K users', '~400 rps', 'Model routing — small model for easy queries, large for hard ones. Prompt caching for shared system prefixes. This is where the cost curve bends.'],
    ['1M+ users', 'GPU-bound', 'Dedicated inference fleet with continuous batching, KV-cache reuse and a scheduler. Retrieval scales trivially by comparison.'],
  ],
  levers: [
    { t: 'Cache semantically, not exactly', d: 'Users ask the same question different ways. Embedding the query and matching against previous questions above a similarity threshold can eliminate a large share of generation calls — the single biggest cost lever here.', n: ['sem'] },
    { t: 'Route by difficulty', d: 'Most queries do not need your largest model. A classifier in front that sends easy queries to a small model changes the economics far more than any infrastructure tuning.', n: ['orch', 'llm'] },
    { t: 'Continuous batching on the GPU', d: 'Naive per-request inference leaves GPUs badly underutilised. Continuous batching can multiply effective throughput several times over on the same hardware.', n: ['llm'] },
    { t: 'Retrieval is the cheap part', d: 'Vector search at millions of documents is milliseconds and scales horizontally. Do not spend optimisation effort here — measure first and you will find it is a rounding error next to generation.', n: ['vec', 'qemb'] },
    { t: 'Stream the response', d: 'Time-to-first-token is what users perceive. Streaming makes a six-second generation feel responsive without making it faster.', n: ['gout'] },
  ],
  wall: { t: 'Cost per request', d: 'At roughly tens of dollars per million requests, generation is 10–100× anything else in this diagram. Scaling to a billion users is not a capacity question — it is whether the unit economics survive, which is why caching and routing matter more than replicas.' },
},

'ML: Recommendation Ranking': {
  constraint: 'Feature lookup latency at candidate-set size, and the training-serving skew that grows with both.',
  ladder: [
    ['10K users', '~10 rps', 'Rank everything with a simple model. At this catalogue size two-stage retrieval is overkill.'],
    ['1M users', '~2K rps', 'Two stages: cheap candidate generation to a few hundred items, expensive ranking on those only.'],
    ['100M users', '~20K rps', 'Feature store with a low-latency online tier. Batch feature fetches — one round trip for 500 candidates, not 500 round trips.'],
    ['1B users', '~200K rps', 'Precompute candidates offline for active users. Serve models from a dedicated inference tier. A/B infrastructure becomes load-bearing.'],
  ],
  levers: [
    { t: 'Two-stage retrieval', d: 'Never score the full catalogue. Cheap recall narrows millions to hundreds; expensive precision ranks those. This is the structural decision everything else depends on.', n: ['cand', 'rank'] },
    { t: 'Batch every feature fetch', d: 'Per-candidate lookups turn a 20ms budget into 500ms. One multi-get for the whole candidate set is the difference between viable and not.', n: ['feat'] },
    { t: 'Precompute for active users', d: 'Candidate generation offline, refreshed periodically, turns the online path into a lookup plus a rank. Most users are not online right now.', n: ['cand', 'rec'] },
    { t: 'One feature definition', d: 'Training-serving skew is the most common cause of a model that looks great offline and disappoints live. A shared feature store with the same computation on both paths is the fix.', n: ['feat', 'train'] },
    { t: 'A/B as infrastructure', d: 'At this scale you ship model changes weekly. Deterministic bucketing and metric pipelines need to be a platform, not a per-experiment effort.', n: ['ab', 'fb'] },
  ],
  wall: { t: 'The feedback loop', d: 'Recommendations shape the behaviour you train on, so the system drifts towards its own predictions. This is not a scaling problem you can engineer past — it needs deliberate exploration and off-policy correction, which cost you short-term metrics.' },
},

'Enterprise: Zero-Trust Platform': {
  constraint: 'The legacy core. Everything modern scales; the mainframe and the ERP do not.',
  ladder: [
    ['1K users', '~10 rps', 'Gateway, SSO, a handful of services. The core handles the load directly.'],
    ['100K users', '~1K rps', 'Per-tenant routing and isolation. Caching in front of the core because it cannot take the read volume.'],
    ['1M users', '~9K rps', 'Enterprise MQ in front of the core so bursts become queues rather than failures. Read models served entirely from your own stores.'],
    ['10M users', '~50K rps', 'Regional cells with tenant affinity. The core is reached only for the writes that genuinely require it — everything else is a projection.'],
  ],
  levers: [
    { t: 'Queue in front of the core', d: 'A mainframe or ERP has fixed, expensive capacity and cannot be scaled out. MQ converts a traffic spike into a backlog you can drain instead of an outage.', n: ['mq', 'core', 'erp'] },
    { t: 'Project reads out of the core', d: 'Maintain your own read models fed by CDC or events. Nearly all read traffic should never reach the legacy system.', n: ['esb', 'db'] },
    { t: 'Tenant sharding', d: 'Route by tenant so a large customer\'s load is isolated and can be given dedicated capacity. It also makes per-tenant compliance and data residency tractable.', n: ['ten'] },
    { t: 'Identity must be faster than everything', d: 'Every request authenticates. Token validation should be local with cached public keys — a round trip to the IdP per request makes it your bottleneck.', n: ['iam', 'gw'] },
    { t: 'Audit asynchronously', d: 'Compliance logging is mandatory but must not be synchronous. Write to a durable buffer and ship out of band.', n: ['aud'] },
  ],
  wall: { t: 'Licensed capacity', d: 'Vendor cores are often priced per core or per transaction, so "scale it out" is a procurement negotiation rather than a deployment. This is why the architecture is shaped around shielding the core rather than growing it.' },
},

'Observability: Golden Signals': {
  constraint: 'Cardinality, and the fact that telemetry volume grows faster than the system it observes.',
  ladder: [
    ['10 services', 'low volume', 'Metrics, logs and traces into managed backends. Do not over-engineer this.'],
    ['100 services', '~100K series', 'An OTel collector as a funnel so instrumentation is uniform and you can change backends without touching services. Sampling for traces.'],
    ['1000 services', 'millions of series', 'Cardinality controls become mandatory — drop or aggregate high-cardinality labels at the collector. Tiered log retention.'],
    ['10k services', 'TBs/day', 'Regional collectors with local aggregation, exemplar-based tracing, and metrics downsampled by age.'],
  ],
  levers: [
    { t: 'Kill cardinality at the collector', d: 'One label with a user id turns a hundred series into a hundred million. Drop or bucket high-cardinality labels before they reach storage — this is the single biggest cost lever in observability.', n: ['otel', 'met'] },
    { t: 'Tail-based sampling', d: 'Head sampling keeps 1% at random and loses the traces you actually need. Tail sampling decides after the fact, keeping errors and slow requests while discarding the boring majority.', n: ['tr', 'otel'] },
    { t: 'Tier log retention', d: 'Hot for days, warm for weeks, cold for compliance. Uniform retention over terabytes a day is unaffordable and nobody queries last quarter\'s debug logs.', n: ['log'] },
    { t: 'Alert on SLO burn rate', d: 'Per-metric threshold alerts at this size produce noise nobody reads. Multi-window burn-rate alerts on error budgets scale with service count in a way thresholds do not.', n: ['slo', 'page'] },
    { t: 'Collector as an abstraction', d: 'Services speak OTLP to a local collector; the collector decides where data goes. Backend migrations become config, not a thousand redeploys.', n: ['otel'] },
  ],
  wall: { t: 'Observing the observer', d: 'At some point telemetry costs a noticeable fraction of production itself, and the observability stack needs its own monitoring. The honest answer is sampling and aggregation — deciding what not to keep, which is a judgement call rather than an engineering one.' },
},

}
