// Scaling playbooks, part 6 — the interview classics. Shape documented in scaling.js.
export default {

'LeetCode (Online Judge)': {
  constraint: 'Verdicts must be fair - identical limits on identical hardware - which forbids the elastic tricks every other queue-based system reaches for under a contest spike.',
  ladder: [
    ['10K users', '~20 rps', 'A queue, a few runners, verdicts in a table. Fine.'],
    ['1M users', '~500 rps', 'Runner fleet grows fixed-size per language pool; sandboxes pre-warm; ranks fold from a verdict stream.'],
    ['10M users', '~3K rps', 'Contest spikes are scheduled - pre-scale the fleet to the calendar; queue admission per user stops submit-spam.'],
    ['50M users', '~10K rps', 'Regional judge farms with identical hardware SKUs; verdict determinism audited by replaying samples cross-region.'],
  ],
  levers: [
    { t: 'Keep the fleet fixed and fair, scale by calendar', d: 'Elastic runners on shared hosts make timing verdicts noisy. Contests are scheduled - capacity planning is reading the calendar, not reacting to the spike.', n: ['jr', 'q'] },
    { t: 'Pre-warm sandboxes per language', d: 'Sandbox creation is the latency; language images pre-warm in pools sized to the submission mix, so judging starts in milliseconds without reuse.', n: ['jr'] },
    { t: 'Fold ranks from the verdict stream', d: 'Ranking is a deterministic fold over events - replayable for disputes, shardable by contest, served from sorted sets.', n: ['k', 'rw', 'ldr'] },
    { t: 'Admit per user at the queue', d: 'Submit-spam during contests is a fairness attack. Per-user in-flight caps at admission keep the queue honest without touching the scheduler.', n: ['q'] },
  ],
  wall: { t: 'Fairness itself', d: 'Determinism pins judging to uniform hardware under uniform load - the one workload that cannot burst to whatever compute is lying around. The fleet scales in identical increments on a schedule, and its cost floor is set by the biggest contest you promise to hold, idle the rest of the week.' },
},

'Strava': {
  constraint: 'Every upload triggers a pipeline (map-match, segment match, leaderboards, feed) whose output is read a thousand times per compute - the design lives or dies on how cheap it makes the derived reads.',
  ladder: [
    ['100K athletes', '~50 rps', 'Synchronous processing on upload, segments scanned per activity. Fine, briefly.'],
    ['5M athletes', '~1K rps', 'Processing moves behind a stream; segment matching goes through the geo index; leaderboards become cached sorted sets.'],
    ['50M athletes', '~6K rps', 'Activities shard by athlete; segment backfills run as scheduled batch; feeds fan out on write.'],
    ['150M athletes', '~20K rps', 'Popular-segment leaderboards partition by section; heatmap aggregation is a lakehouse job; reprocessing (privacy edits, new segments) is a managed capacity budget.'],
  ],
  levers: [
    { t: 'Index segments, never scan them', d: 'Candidate segments come from cells the route touched; exact matching runs on that shortlist. Matching cost scales with route length, not the segment catalog.', n: ['proc', 'geo'] },
    { t: 'Serve leaderboards from memory, update from events', d: 'A KOM board is read millions of times between changes. Sorted sets absorb effort events; the store is for rebuilds, not reads.', n: ['ldr'] },
    { t: 'Scrub privacy at ingest, reprocess on edit', d: 'Zones apply before any derivation, and a zone edit queues reprocessing of history - retroactive privacy is a standing capacity line item, not an exception.', n: ['act', 'k'] },
    { t: 'Fan feeds out on write', d: 'An activity posts to followers\u0020lists at process time; reads are a cache page. Celebrity athletes get the hybrid path every feed system converges on.', n: ['feed', 'fcache'] },
  ],
  wall: { t: 'Reprocessing history', d: 'Segments get created, zones get edited, algorithms improve - and each change implies recomputing years of stored activities. The archive only grows, so the reprocessing bill grows with it forever; the wall is managed with tiering and selective backfills, never removed.' },
},

'Online Auction (eBay)': {
  constraint: 'Correctness lives on one row per auction - the current high - and the product concentrates all demand on that row in the final sixty seconds.',
  ladder: [
    ['10K users', '~20 rps', 'Bids in a transaction against the listing row, a page refresh to see prices. Fine.'],
    ['1M users', '~1K rps', 'Live prices move to sockets fed by bid events; close becomes a leased worker; listings cache.'],
    ['10M users', '~7K rps', 'Auctions shard by id (each is independent); hot auctions get isolated socket capacity; proxy bids resolve in-transaction.'],
    ['100M users', '~30K rps', 'The close scheduler partitions by end-time; ending-soon pages precompute; the bid path stays exactly as small as it started.'],
  ],
  levers: [
    { t: 'Serialize per auction and stop apologizing', d: 'The compare-and-set on the high row is the product. Auctions are independent, so throughput scales by having many auctions - never by weakening one auction\u0027s row.', n: ['bid', 'bdb'] },
    { t: 'Fan out prices from events, not from the bid path', d: 'A thousand watchers ride the event bus to sockets. The bid transaction knows nothing about them - its job ends at commit.', n: ['k', 'ws'] },
    { t: 'Close with leases, extend with policy', d: 'A leased, idempotent closing sequence survives worker crashes; anti-snipe extension is the same transition with a different trigger. Time-based correctness never hangs on one process staying alive.', n: ['cw'] },
    { t: 'Precompute ending-soon heat', d: 'The last-minute crowd reads the same few pages. Ending-soon lists and item pages precompute and cache; only the bid itself touches the row.', n: ['item', 'idb'] },
  ],
  wall: { t: 'The final minute of a hot auction', d: 'One row, one clock, everyone at once - the serialization that guarantees one winner also caps how many bids one auction can accept per second. Past socket fan-out and precomputed reads, the remaining ceiling is the row itself, and the honest levers are product-shaped: increments, extensions, sealed bids.' },
},

'FB Live Comments': {
  constraint: 'The hot object cannot be spread: one stream, one comment flow, a million readers of it. Everything scales except the thing everyone is looking at.',
  ladder: [
    ['10K viewers', '~100 rps', 'One socket tier broadcasting every comment to everyone. Fine.'],
    ['1M viewers', '~5K rps', 'Shard by stream; fan-out goes through workers batching per socket server; moderation moves inline pre-fan-out.'],
    ['10M viewers', '~30K rps', 'Viral streams get shard isolation (dedicated workers + socket capacity); per-viewer sampling activates under load.'],
    ['100M viewers', '~150K rps', 'Regional socket edges serve viewers locally off a replicated bus; the biggest stream is capacity-planned like a named tenant.'],
  ],
  levers: [
    { t: 'Batch per socket server, never per viewer', d: 'Delivery cost is (comments x socket servers), not (comments x viewers) - the fan-out workers send one batch per server holding subscribers. This single multiplication is the difference between possible and not.', n: ['fw', 'ws'] },
    { t: 'Sample per viewer under load', d: 'Above human reading speed, thin the flow per viewer: creator and friends always, the rest probabilistically. The bus keeps everything; the humans get what they can use.', n: ['ws'] },
    { t: 'Moderate before fan-out, on a budget', d: 'The filter sits between post and bus with a hard latency budget - amplification makes moderation irreversible, so it happens while the comment is still one copy.', n: ['mod', 'cs'] },
    { t: 'Isolate the viral stream', d: 'Detection on comment velocity promotes a stream to its own workers and socket pool. The platform\u0027s biggest moment stops sharing fate with everything else.', n: ['k', 'fw'] },
  ],
  wall: { t: 'One object, everyone watching', d: 'Sharding distributes many streams, but the biggest stream is still one partition, one fan-out group, one flood. Batching and sampling bend the cost curve; they do not remove the fact that a single object\u0027s audience has no upper bound and its capacity does.' },
},

'News Aggregator': {
  constraint: 'Freshness is bounded by politeness: the crawl budget per source is a hard external limit, and every scaling decision is really about spending that budget better.',
  ladder: [
    ['100K readers', '~50 rps', 'A crawler loop, exact-dup removal, a ranked list rebuilt on cron. Fine.'],
    ['5M readers', '~1K rps', 'Scheduler learns per-source velocity; clustering goes two-gear (fingerprints + embeddings); front pages cache.'],
    ['50M readers', '~8K rps', 'Crawl fleet partitions by source; clustering shards by entity/time window; editions (geo x language) precompute.'],
    ['500M readers', '~50K rps', 'Breaking-news mode re-allocates crawl budget in real time; ranking personalizes at the edge on top of shared clusters.'],
  ],
  levers: [
    { t: 'Spend crawl budget by velocity', d: 'A wire service earns per-minute fetches; a weekly blog does not. The scheduler is a budget allocator, and its allocation quality is the freshness of the whole product.', n: ['sched', 'cr'] },
    { t: 'Cluster in two gears', d: 'Cheap fingerprints kill the copies; embedding similarity catches the rewrites; only survivors pay for expensive comparison. Precision stays high because a wrong merge is the worst outcome.', n: ['dd'] },
    { t: 'Precompute the front page per edition', d: 'Readers overwhelmingly hit a few hundred edition pages. Ranking rebuilds them continuously; the read path is a cache fetch with personalization sprinkled on top.', n: ['rank', 'fcache'] },
    { t: 'Give breaking news a mode, not a hope', d: 'Cluster velocity triggers budget reallocation: related sources promote to fast cadence for a window. The pipeline has a war footing, entered automatically.', n: ['sched', 'k'] },
  ],
  wall: { t: 'Publisher rate limits', d: 'Freshness cannot exceed what sources allow you to fetch - robots and 429s are contractual physics. Past scheduler intelligence, the ceiling moves only through relationships: feeds, push arrangements, licensing. That is business development, not architecture.' },
},

'Price Tracker': {
  constraint: 'Every fetch spends an adversarial budget - scrape too fast and a whole site\u0027s coverage dies for everyone. Scale means demand-weighted allocation of a resource someone else controls.',
  ladder: [
    ['10K users', '~10 rps', 'A cron of scrapers, prices in a table, threshold emails. Fine.'],
    ['500K users', '~300 rps', 'Scheduler weights by watch-count and volatility; price history moves to a time-series store; drop detection gets baselines.'],
    ['5M users', '~2K rps', 'Scraper fleet partitions by site with per-site budgets and canary block-detection; alerts dedupe per (user, product, level).'],
    ['20M users', '~8K rps', 'Product-identity resolution unifies variants across sites; hot products share one fetch across all watchers; partnerships replace scraping where possible.'],
  ],
  levers: [
    { t: 'One fetch serves every watcher', d: 'A product with 10,000 watchers still costs one scrape. Demand concentrates - which means budget spent on the head covers most alerts, and the tail can be daily.', n: ['sched', 'sc'] },
    { t: 'Detect blocks before they detect you', d: 'Canary fetches and parser health checks catch defenses and page changes early; the response is backing off, because a blocked site is an outage no retry fixes.', n: ['sc', 'sites'] },
    { t: 'Alert on baselines, not ticks', d: 'Drop detection compares against smoothed history and variance - currency flickers and sale games filter out. Precision is retention; a false deal alert is churn.', n: ['pd', 'tsdb'] },
    { t: 'Store prices as the time series they are', d: 'History charts, baselines and detection all read one write-once series. Compression and downsampling keep years of ticks affordable.', n: ['tsdb'] },
  ],
  wall: { t: 'The sites do not want you there', d: 'Defenses improve, markup churns, legal gets involved - the scraping ceiling is set by the scraped. Past polite-fleet engineering, durable coverage comes from switching sides: affiliate feeds and data partnerships, at which point the scraper is a fallback, not the product.' },
},

'Ad Click Aggregator': {
  constraint: 'The aggregate is a bill. Exactly-once is not a nice-to-have property here - it is the contract, and it must hold at firehose rate through crashes, retries and replays.',
  ladder: [
    ['1K advertisers', '~1K rps', 'Ingest to a log, a windowed count job, a reporting table. Fine.'],
    ['50K advertisers', '~50K rps', 'Idempotent ingest with TTL dedup; checkpointed stream aggregation; transactional sinks keyed by (campaign, bucket).'],
    ['500K advertisers', '~300K rps', 'Partitioning by campaign hash; fraud scoring inline with a budget; daily reconciliation against the sealed log.'],
    ['5M advertisers', '~1M+ rps', 'Regional ingest with global merge; hot campaigns (superbowl ads) pre-declared and pre-partitioned; budget pacing reads aggregates in seconds.'],
  ],
  levers: [
    { t: 'Layer exactly-once, prove it daily', d: 'Idempotent ingest + checkpointed state + transactional sink - and a reconciliation job that re-counts the sealed log and must match the bill. The proof is part of the system, not an audit afterthought.', n: ['ing', 'agg', 'adb'] },
    { t: 'Size the dedup horizon to the retry window', d: 'The dedup cache only needs to outlive client retries - hours. The permanent log settles anything older. Right-sizing this cache is the difference between affordable and absurd.', n: ['dcache'] },
    { t: 'Filter fraud pre-billing, keep the evidence', d: 'Filtered clicks leave the invoice but stay in aggregates flagged, with the features that damned them - disputes replay, refunds do not happen because overbilling did not.', n: ['fr'] },
    { t: 'Pre-partition the hot campaign', d: 'A superbowl ad is a known future hot key. Declared campaigns get partition splits ahead of the spike instead of discovering skew live on the most expensive night of the year.', n: ['k', 'agg'] },
  ],
  wall: { t: 'Hot keys with contracts attached', d: 'One campaign can be a meaningful fraction of the firehose, and its count must still be exact. Partition splitting and pre-declaration push the ceiling out, but a single key\u0027s exactly-once throughput has a real limit - and unlike most systems, this one cannot round.' },
},

'FB Post Search': {
  constraint: 'Two heat sources concentrate on the same shards: writes are only recent, and queries skew recent - while every candidate must pass a per-searcher permission check inside the latency budget.',
  ladder: [
    ['1M users', '~500 rps', 'A stream-fed index, keyword retrieval, visibility checked per result. Fine.'],
    ['50M users', '~5K rps', 'Time x term sharding; audience descriptors in the index with query-time filtering; relationship sets cached per query.'],
    ['500M users', '~30K rps', 'Recent shards on premium hardware with extra replicas; early-terminating top-k; tombstoned deletes with synchronous cache purge.'],
    ['2B users', '~150K rps', 'Tiered age bands (hot/warm/cold) with different formats; coarse index-side visibility pruning; regional query fan-out with global merge only when needed.'],
  ],
  levers: [
    { t: 'Shard by time so heat has an address', d: 'Writes and queries both concentrate on now - so the newest shards get the hardware and the replicas, and last year compacts onto cold tiers. The skew becomes the plan.', n: ['iw', 'se'] },
    { t: 'Filter permissions at query time, hint in the index', d: 'Compact audience descriptors let the index prune coarsely; exact checks run on survivors against a per-query cached relationship set - fresh without reindexing on every unfriend.', n: ['qs', 'se'] },
    { t: 'Terminate top-k early', d: 'Social search wants the best twenty, not everything. Newest-first fan-out returns when the top stabilizes; deep history pages in only on request.', n: ['qs'] },
    { t: 'Make deletes a compliance path', d: 'Tombstones handle the index at merge; caches purge synchronously. A deleted post appearing in search is a legal event, so this path gets engineered like one.', n: ['iw', 'qcache'] },
  ],
  wall: { t: 'Per-viewer truth', d: 'Every searcher sees a different result set for the same query - permission filtering is per-viewer work that no shared cache fully absorbs. Descriptors compress it and pruning bounds it, but the check itself runs on every candidate for every query, forever; it can be made very cheap and never free.' },
},

'Online Chess': {
  constraint: 'Millions of tiny authoritative state machines with realtime clocks: the work per game is trivial, so the system scales on placement, checkpointing and reconnect - not compute.',
  ladder: [
    ['100K players', '~200 rps', 'Game servers holding boards in memory, a ratings table. Fine.'],
    ['5M players', '~1K rps', 'Per-move checkpointing makes crashes reconnects; matchmaking pools per time control; events stream to rating workers.'],
    ['50M players', '~5K rps', 'Games place by region for latency fairness; live-state cache shards by game id; the archive stores moves, compact forever.'],
    ['200M players', '~20K rps', 'Blitz pools pair in-region in seconds; spectator fan-out for big games splits from the player path; anti-cheat consumes the full event stream offline.'],
  ],
  levers: [
    { t: 'Checkpoint every move, own every crash', d: 'A kilobyte of state written per move means a dead server is a reconnect with a clock-grace adjustment, not a lost game. The recovery story is the reliability story.', n: ['gs', 'gcache'] },
    { t: 'Place games by region, pools by latency', d: 'Blitz fairness is latency fairness - pools partition by region and time control so both clocks tick equally for both players.', n: ['mm', 'ws'] },
    { t: 'Fold ratings from the event stream', d: 'Ratings are deterministic over the game log: replayable for disputes, shardable by player, and the same stream feeds anti-cheat and history.', n: ['k', 'ew', 'gdb'] },
    { t: 'Split spectators from players', d: 'A championship board has two players and a million watchers. Spectator delivery rides fan-out infrastructure; the game socket path stays two-person small.', n: ['ws'] },
  ],
  wall: { t: 'The speed of light in blitz', d: 'A one-second-per-move game across an ocean is unfair by physics - 150ms of RTT is a real handicap no architecture removes. Regional pools are the mitigation and the admission: global play at blitz speeds is bounded by geography, and the product (pools, time controls) absorbs what engineering cannot.' },
},

'GitHub Actions': {
  constraint: 'Every job is a fresh VM for hostile code: isolation sets a hard cost-and-latency floor per job, and the platform scales by hiding that floor (warm pools, caches) without ever trading it away.',
  ladder: [
    ['10K repos', '~50 rps', 'A queue, a static runner pool, logs to storage. Fine.'],
    ['1M repos', '~1K rps', 'Warm pools per image sized to the daily curve; repo-scoped content-addressed caches; live log streaming off an event bus.'],
    ['50M repos', '~10K rps', 'Per-org concurrency admission; regional runner farms; artifact/cache storage tiered by heat.'],
    ['300M repos', '~50K rps', 'Pool prediction by org-level patterns (merge trains, release days); log path engineered for 100k+ concurrent tails; hardware generations rotated under a uniform VM contract.'],
  ],
  levers: [
    { t: 'Pre-warm to the demand curve', d: 'VM boot is the queue-to-start latency. Pools per image size to the hour-of-day curve - CI demand is bursty but rhythmically so, and the rhythm is forecastable.', n: ['run', 'q'] },
    { t: 'Cache per repo, address by content', d: 'Dependency caches keyed on lockfile hashes turn 20-minute builds into 2 - the economics of hosted CI. Repo scoping contains poisoning; LRU keeps the bill bounded.', n: ['art'] },
    { t: 'Enforce fairness at admission', d: 'Per-org concurrency caps at the queue keep a monorepo from absorbing a region - the same cheap-at-admission lesson every multi-tenant queue converges on.', n: ['q'] },
    { t: 'Stream logs off the bus, replay from storage', d: 'The live tail is a socket fed by the event stream; finished runs replay from blob. One pipeline serves the watcher, the badge, and the audit.', n: ['k', 'ls'] },
  ],
  wall: { t: 'The isolation floor', d: 'One hostile job, one fresh VM, destroyed after - seconds of boot-and-teardown and a full OS of overhead per job that no pooling amortizes away, because reuse is the vulnerability. Efficiency work shaves the floor; only weakening the security model removes it, which is to say: it stays.' },
},


'Astrotalk': {
  constraint: 'Revenue is minutes on live sockets, and every minute must bill exactly once - the system scales sessions, but the astrologers themselves are scarce humans whose queues are the product.',
  ladder: [
    ['100K users', '~100 rps', 'Sessions on one broker, wallet in Postgres, presence polled. Fine.'],
    ['5M users', '~1K rps', 'Metering moves to server ticks on a stream with idempotent billing; presence goes heartbeat-driven in cache; kundli results cache by birth data.'],
    ['50M users', '~6K rps', 'Session brokers shard by astrologer (one claim point each); wallets shard by user; the socket tier scales on connections while ticks stay tiny.'],
    ['150M users', '~20K rps', 'Festival-day surges (eclipse, Diwali muhurat) are calendar-known - pre-scale brokers and billers; celebrity queues get fairness policies and price as the throttle.'],
  ],
  levers: [
    { t: 'Own the clock server-side, tick idempotently', d: 'One (sessionId, minuteIndex) tick per elapsed minute, deduped in the biller. Sockets can flap all they like - the meter and the money never notice.', n: ['sess', 'k', 'bw'] },
    { t: 'Reserve-then-settle against the wallet', d: 'Block a few minutes at start, debit per tick, release at hangup. The ACID surface stays one row per user while thousands of sessions run concurrently.', n: ['wal', 'sess'] },
    { t: 'Shard sessions by astrologer', d: 'Each astrologer is a single-consultation resource with a queue - making them the shard key gives every claim exactly one home and no cross-shard races.', n: ['sess', 'pres'] },
    { t: 'Cache kundli forever', d: 'Same birth data, same chart, every time. Deterministic compute means the engine mostly serves cache hits and the ephemeris tables load once.', n: ['kun', 'eph'] },
  ],
  wall: { t: 'The astrologers are human', d: 'Software scales sessions; it cannot scale the supply of trusted astrologers or the minutes in their day. Past matching efficiency and queue fairness, growth is recruiting and retaining the humans - marketplace operations, not architecture - and peak demand on a festival day meets a hard ceiling of available consultation hours.' },
},


'Object Storage (S3)': {
  constraint: 'Requests are the easy axis - the store must scale durability itself: more disks means more failures per hour, and the repair fleet has to outrun them forever.',
  ladder: [
    ['1 PB', '~1K rps', 'Metadata in one partitioned KV, k+m coding, a modest repair fleet. The math already matters.'],
    ['50 PB', '~10K rps', 'Placement goes heat-aware; hot prefixes get sharded key advice; scrubbers cycle cold data continuously.'],
    ['500 PB', '~40K rps', 'Metadata partitions split by range with per-prefix contracts enforced; repair fleet sized against fleet-wide disk mortality, not incidents.'],
    ['5 EB', '~200K rps', 'Cells: independent metadata+pod clusters behind one namespace, so blast radius and repair math stay per-cell while the API stays one bucket world.'],
  ],
  levers: [
    { t: 'Erasure-code, then defend the code with repair speed', d: 'k+m across failure domains sets the theoretical nines; shards-at-risk-minutes sets the real ones. Size repair for disk mortality at fleet scale.', n: ['pods', 'rep'] },
    { t: 'Partition metadata by key range, contract by prefix', d: 'LIST stays single-partition, and the throughput ceiling becomes a stated per-prefix contract customers can design around.', n: ['meta', 'fe'] },
    { t: 'Cache the head of the distribution', d: 'Object access is brutally skewed - a hot cache in front means pods serve the long tail while the top keys never touch disk.', n: ['cache'] },
    { t: 'Make mutations a stream', d: 'Every PUT/DELETE emits once onto the event stream; repair, lifecycle and replication become consumers instead of scanners.', n: ['k', 'rep'] },
  ],
  wall: { t: 'Physics and mortality', d: 'At exabyte scale the fleet loses disks every hour as a statistical certainty, and repair bandwidth competes with customer traffic on the same networks. Past cells and smarter placement, the wall is capital: durability is ultimately bought in racks, power and replacement drives - the arithmetic just decides how efficiently.' },
},

'Serverless Platform (Lambda)': {
  constraint: 'Every concurrent invoke is a live microVM - the platform scales by predicting arrivals well enough that the cold-start tax stays rare while idle sandboxes stay cheap.',
  ladder: [
    ['10K invokes/day', '~1 rps', 'A small warm pool per active function; cold starts common and tolerated.'],
    ['10M invokes/day', '~120 rps', 'Arrival-rate-driven pools; placement gets heat-aware; async and sync split priorities on one fleet.'],
    ['1B invokes/day', '~12K rps', 'Predictive pre-warming from schedules and traffic patterns; per-account fairness enforced; code distribution cached per host.'],
    ['100B invokes/day', '~1M rps', 'Cellular fleets per region; the scheduler itself shards by function hash; billing metering becomes its own exactly-once pipeline.'],
  ],
  levers: [
    { t: 'Size warm pools on p95 arrivals, not averages', d: 'Bursts arrive exactly when boots help least. Overshoot warm capacity slightly and let the async queue absorb the rest.', n: ['ctrl', 'wp', 'q'] },
    { t: 'One fleet, two priorities', d: 'Sync invokes preempt; async drains opportunistically. Utilization stays high without selling the latency SLO twice.', n: ['sbx', 'q'] },
    { t: 'Cache code per host', d: 'Deploy storms hit the blob store once per host, not once per sandbox - boots then pay only runtime init.', n: ['code', 'sbx'] },
    { t: 'Shard the scheduler by function', d: 'Placement state partitions cleanly on function hash, so the control plane scales the same way the data plane does.', n: ['ctrl'] },
  ],
  wall: { t: 'The cold start is irreducible', d: 'Warm pools amortize the boot tax; they cannot delete it. The first invoke after silence always pays ~125ms plus runtime init, and hardware-level isolation is the reason the product is sellable at all - past prediction and pre-warming, the remaining latency is the price of the trust boundary itself.' },
},

'CDN (Edge Network)': {
  constraint: 'The product is a ratio: hit rate against origin fetches. Scaling means more PoPs in more cities without the miss traffic, purge lag or config drift growing with them.',
  ladder: [
    ['1 city', '~1K rps', 'One PoP, one cache tier, TTLs doing the work. The origin still feels weather.'],
    ['20 PoPs', '~20K rps', 'Origin shield collapses misses; purge becomes a fanout stream; anycast handles PoP loss by withdrawal.'],
    ['100 PoPs', '~60K rps', 'Tiered fills between nearby PoPs; surrogate-key purging; config versions atomic per PoP.'],
    ['300+ PoPs', '~500K rps', 'Regional shield layers, capacity-aware anycast that spills load to neighbors, and PoP builds decided by hit-ratio economics per city.'],
  ],
  levers: [
    { t: 'Shield the origin, coalesce the storm', d: 'PoP misses collapse onto a shield near the origin; one in-flight fetch per key. A thousand cold PoPs cost the customer one fetch.', n: ['shield', 'pc'] },
    { t: 'Purge as a replayable log', d: 'Surrogate-key tombstones on a stream every PoP consumes - offline PoPs replay on rejoin, so correctness never depends on an RPC landing everywhere.', n: ['cfg', 'k', 'pop'] },
    { t: 'Let anycast be the failover', d: 'A sick PoP withdraws its route and the internet reroutes in seconds - no health-check choreography, no user-visible incident.', n: ['gslb', 'pop'] },
    { t: 'Spend capex where the ratio says', d: 'Each candidate city has a computable value: eyeballs times miss latency times egress saved. Build PoPs by that math, not by map aesthetics.', n: ['pop'] },
  ],
  wall: { t: 'Peering and the speed of light', d: 'Past enough PoPs, latency is set by physics and interconnection politics: you cannot cache your way around an ocean, and the next win is private backbone and peering agreements - negotiated infrastructure, not software. The marginal PoP eventually adds operational surface faster than it adds hit ratio.' },
},


'LLM API Platform (FastAPI)': {
  constraint: 'The provider is slow, expensive and rate-limited; users are none of those. Everything scales around that mismatch - the queue absorbs it, the workers meter it, Redis streams across it.',
  ladder: [
    ['1K req/day', '~1 rps', 'One FastAPI pod calling the provider directly. Fine until the first burst.'],
    ['100K req/day', '~10 rps', 'The queue arrives: accept-enqueue-stream, workers sized to the rate-limit tier, results through Redis.'],
    ['5M req/day', '~300 rps', 'Per-key quotas and fairness; provider tiers negotiated; token budgets enforced per request; usage pipeline exactly-once.'],
    ['50M req/day', '~1.5K rps', 'Multi-provider routing with failover, semantic caching in front of generation, and worker fleets per model class - the queue pattern unchanged.'],
  ],
  levers: [
    { t: 'Accept fast, answer through the queue', d: 'The API returns a handle in ms; the queue absorbs bursts; drain rate equals what the provider tier allows. Wait time becomes arithmetic you can show users.', n: ['api', 'q', 'lw'] },
    { t: 'Stream through Redis, not sockets to workers', d: 'Workers write tokens; any API replica serves any stream by replay-then-follow. Workers stay stateless and horizontal.', n: ['cache', 'api', 'lw'] },
    { t: 'Size the fleet from rate-limit math', d: 'Requests-per-minute and tokens-per-minute per tier, divided by per-request cost, times a safety factor. CPU graphs lie here.', n: ['lw', 'prov'] },
    { t: 'Budget every request', d: 'Max tokens, max wall clock, per-key quotas checked at accept - a runaway prompt dies at its cap, not on your invoice.', n: ['api', 'guard'] },
  ],
  wall: { t: 'The provider IS the ceiling', d: 'Past clean queueing and multi-provider routing, throughput is bought, not engineered: higher rate tiers, reserved capacity, or your own GPUs. The architecture above the model can be perfect and the tokens-per-second still belongs to someone else - the wall is a contract negotiation, then a capex decision.' },
},

'Agentic Workflow (Tools)': {
  constraint: 'Each task is a loop of expensive model calls with side effects - scaling means more concurrent loops without losing budget enforcement, auditability, or the human gate on irreversible actions.',
  ladder: [
    ['100 tasks/day', '~1 rps', 'One orchestrator, a handful of tools, approvals over chat. The schemas already matter.'],
    ['10K tasks/day', '~15 rps', 'Orchestrators shard by task; sandbox pool warms; memory becomes retrieval; loop caps and audit trails formalize.'],
    ['500K tasks/day', '~150 rps', 'Risk-tiered autonomy per tool; approval queues with SLAs; token spend per tenant metered; observation-injection defenses standard.'],
    ['5M tasks/day', '~1.5K rps', 'Fleets per task class, replayable audit at scale, and policy engines deciding autonomy grades - the loop itself never changed.'],
  ],
  levers: [
    { t: 'Shard by task, keep loops single-owner', d: 'A task lives on one orchestrator: no distributed loop state, clean audit, trivial replay. Scale is more orchestrators, not smarter ones.', n: ['agent'] },
    { t: 'Contracts before execution', d: 'JSON-schema validation turns hallucinated calls into correctable observations instead of executions - the cheapest safety in the design.', n: ['tools', 'agent'] },
    { t: 'Sandbox the creativity', d: 'Code tools get a disposable microVM with no credentials and an allowlisted network; the agent explores, the blast radius does not.', n: ['sbx'] },
    { t: 'Retrieve memory, never replay it', d: 'Embed observations, fetch what is relevant per step. Context windows are a budget; retrieval keeps long tasks affordable.', n: ['mem', 'agent'] },
  ],
  wall: { t: 'Trust grows slower than capability', d: 'Models improve monthly; the set of actions an organization will let them take unsupervised grows yearly. Past the engineering, scale is a governance problem: every widening of autonomy is a policy decision with an incident budget - and the approval gate, not the GPU, sets the real throughput of consequential work.' },
},


'Card Payments (Auth + Settlement)': {
  constraint: 'Auth scales like a read path with a hard deadline; settlement scales like a data pipeline with a hard deadline of a different kind - the clearing window. The ledger refuses to scale like either, on purpose.',
  ladder: [
    ['1K txns/day', '~0.1 rps', 'One gateway, one ledger table, manual recon in a spreadsheet. The double-entry discipline still applies.'],
    ['100K txns/day', '~5 rps', 'Tokenization moves to the HSM; capture goes through a log; recon becomes a daily job with an exceptions queue.'],
    ['10M txns/day', '~300 rps', 'Ledger partitions by account; netting per counterparty; stand-in rules negotiated; recon drift alerts in items, not rupees.'],
    ['500M txns/day', '~10K rps', 'Multi-region auth with regional ledgers and a global recon plane - UPI-scale territory, where the batch windows themselves become the bottleneck.'],
  ],
  levers: [
    { t: 'Tokenize at the edge', d: 'The PAN stops at the HSM; everything downstream carries tokens. PCI scope shrinks from the fleet to the vault, and every service audit gets lighter.', n: ['hsm', 'gw'] },
    { t: 'Capture through a log, settle in batches', d: 'Auth stays synchronous; money movement drains asynchronously into netted clearing files. The log absorbs spikes the batch window smooths.', n: ['k', 'settle'] },
    { t: 'Partition the ledger by account, never by time', d: 'Account-keyed partitions keep every balance projection single-shard; time-keyed ones scatter an account\'s history across the world.', n: ['led'] },
    { t: 'Reconcile continuously, not monthly', d: 'Daily three-way matching bounds drift to one day\'s blast radius. The exceptions queue is the real product of this lever.', n: ['recon'] },
  ],
  wall: { t: 'The clearing window is not yours', d: 'Past your own architecture, settlement speed belongs to networks, banking hours, and regulation. Real-time settlement exists (UPI proved it) but arrives by industry plumbing, not by your redesign - the wall is institutional, and the engineering answer is to make T+1 boringly, provably correct.' },
},

'Fraud Detection (Real-time)': {
  constraint: 'Latency is rented from the auth path, labels arrive weeks late, and the adversary adapts in days. Scale means more scores per second WITHOUT loosening any of those three screws.',
  ladder: [
    ['10K txns/day', '~0.5 rps', 'Hard rules only - velocity ceilings and blocklists. A model without labels is a coin flip with confidence.'],
    ['1M txns/day', '~30 rps', 'First model ships behind the rules; velocity counters move to Redis; chargebacks start flowing into a real label store.'],
    ['50M txns/day', '~1.5K rps', 'Feature store splits online/offline with parity tests; per-merchant thresholds; review queues sized to human capacity.'],
    ['1B txns/day', '~30K rps', 'Model tiers (cheap screen, expensive escalation), regional scoring, decay monitoring paging before precision falls - card-network scale.'],
  ],
  levers: [
    { t: 'Split feature freshness', d: 'Velocity in cache (seconds-fresh, write-heavy), profiles in the feature store (hours-fresh, read-only). One deadline, two supply chains.', n: ['vel', 'fs'] },
    { t: 'Rules hold the veto', d: 'Explainable declines for regulators, instant deploys against active attacks - the rules engine is the fast loop the model cannot be.', n: ['rules'] },
    { t: 'Tier the models', d: 'A cheap model screens everything; the expensive one runs on the suspicious slice. Budget spent where uncertainty lives.', n: ['ml'] },
    { t: 'Protect the feedback loop', d: 'Chargeback labels are the scarcest asset in the design - exactly-once into the label store, feature parity between train and serve, decay alarms on both.', n: ['k', 'train'] },
  ],
  wall: { t: 'The adversary retrains faster than you', d: 'Fraud is the one workload where the input distribution studies YOUR output. Every threshold leaks through probing; every model decays on contact; labels lag by weeks while attacks pivot in days. Past all architecture, the moat is loop speed - and the honest ceiling is that you are pricing fraud, not eliminating it: the steady state is basis points, chosen on purpose.' },
},


'UPI Switch (NPCI)': {
  constraint: 'Every transaction is two bank legs plus a possible reversal - the switch scales orchestration, but its ceiling is set by the slowest bank on the wire and the ambiguity it must carry meanwhile.',
  ladder: [
    ['100K txns/day', '~3 rps', 'A handful of banks, synchronous legs, reversals worked by hand. The DEEMED state already exists - it just has a phone number.'],
    ['10M txns/day', '~300 rps', 'Reversal queue and worker formalize; idempotent leg contract published; per-bank timeouts tuned by bank, not globally.'],
    ['500M txns/day', '~10K rps', 'Per-bank circuit breakers and fairness; status store partitioned by txn id; net settlement windows; festival peaks rehearsed like launches.'],
    ['15B txns/month', '~50K rps peak', 'Real-world UPI territory: bank-tier isolation, deemed-rate as a first-class SLO per bank, and settlement plumbing whose limits are institutional.'],
  ],
  levers: [
    { t: 'Idempotent legs by contract', d: 'The (txn id, leg) replay rule is the single interface promise that makes blind retries safe across two hundred banks - everything else stands on it.', n: ['orch', 'rem', 'ben'] },
    { t: 'Bound ambiguity, do not hide it', d: 'DEEMED with a public reversal SLA turns the scariest state into a bounded, honest one. The status store answers during the gap.', n: ['status', 'rq', 'rev'] },
    { t: 'Per-bank breakers and fairness', d: 'One slow bank must cost only its own transactions - breakers trip per bank, queues are fair-shared, and deemed-rate is tracked per participant.', n: ['orch'] },
    { t: 'Settle net on an append-only ledger', d: 'Millions of transactions, a handful of RBI transfers - netting keeps settlement sub-linear while the ledger keeps it auditable.', n: ['led', 'recon'] },
  ],
  wall: { t: 'The slowest bank is the product ceiling', d: 'Past every switch-side optimization, latency and deemed-rate are set by two hundred independently-operated core banking systems the switch does not control. The wall is federation itself: you can bound, isolate, and expose each participant honestly - you cannot make their mainframe faster. The engineering answer is the contract and the scoreboard, not the code.' },
},


'Telemedicine (Practo)': {
  constraint: 'Trust is the workload: every record read carries a consent check and an audit write, prescriptions are cryptographic records, and the regulator - not the architect - sets retention. Scale means more consults without ever loosening those screws.',
  ladder: [
    ['1K consults/day', '~1 rps', 'One clinic\'s worth. The consent table and audit log already exist - the disciplines are cheap at small scale, which is exactly when to install them.'],
    ['100K consults/day', '~30 rps', 'Slot locking formalizes, consent grants cache with instant revoke, the SFU fleet regionalizes, audit becomes its own provisioned store.'],
    ['2M consults/day', '~400 rps', 'EHR partitions by patient; audit partitions by time WITH per-patient index; e-Rx verification goes offline-capable for pharmacies; break-glass reviews staffed.'],
    ['20M consults/day', '~3K rps', 'National-platform territory: multi-region with data-residency walls, consent as its own service, and compliance capacity - auditors, retention, legal hold - planned like compute.'],
  ],
  levers: [
    { t: 'Provision the audit like a primary', d: 'One audit write per EHR read means the audit tier scales with READ traffic - the inversion this domain teaches. Under-provisioned audit is not slow; it is unexplainable access.', n: ['audit', 'ehr'] },
    { t: 'Cache consent, revoke instantly', d: 'Grants are read on every record access - cache hard, but revocation must invalidate in one hop, because one stale-grant read is a breach with a name attached.', n: ['consent'] },
    { t: 'Separate media from records', d: 'SFUs scale regionally on bandwidth economics and store nothing; the record path scales on database economics and stores everything that matters. Never let them share a fate.', n: ['sfu', 'sig', 'ehr'] },
    { t: 'Chain-verify prescriptions', d: 'Pharmacies verify signatures offline against the ledger chain - the verification load leaves your hot path entirely, and forgery becomes math instead of trust.', n: ['rx'] },
  ],
  wall: { t: 'Regulation sets the floor, forever', d: 'Past every architectural lever, healthcare data has a property nothing else in this studio has: it never cools. Retention laws keep records hot-accessible for years to decades, audit trails must survive longer than the systems that wrote them, and data-residency walls partition your architecture by jurisdiction, not by load. The wall is that compliance capacity - storage that cannot be tiered away, auditability that cannot be sampled, deletion that must be provable - is real capacity, purchased forever. The honest design treats the regulator as a permanent, non-negotiable tenant.' },
},


'Ayurveda Gyaan (Charak Samhita)': {
  constraint: 'The corpus is small and eternal; the load is interpretation. Scaling here means multiplying readers and questions against a canon that never grows - the opposite constraint of every feed and firehose in this library.',
  ladder: [
    ['1K seekers/day', '~0.05 rps', 'A digitized edition and a search box. The canonical ids and the no-UPDATE rule matter from day one - retrofitting immutability is archaeology.'],
    ['100K seekers/day', '~3 rps', 'Overlays formalize with versions; the concordance table arrives with the second edition; RAG ships citation-forced from its first answer.'],
    ['5M seekers/day', '~150 rps', 'Canon lives at the edge with infinite TTL; overlay materialization per (verse, lang); the guard\'s rule set becomes data with its own review workflow; consult volume brings Telemedicine-grade audit.'],
    ['50M seekers/day', '~1.5K rps', 'National-platform territory: AYUSH-grid interop, multilingual embeddings refreshed as scholarship grows, and the queue that matters is scholarly review throughput, not request throughput.'],
  ],
  levers: [
    { t: 'Cache the eternal at the edge', d: 'Immutable canon earns the rare infinite TTL and permanent ETags - serve shlokas like static assets because that is what a 2000-year-old text is.', n: ['corpus', 'gw'] },
    { t: 'Materialize overlays per (verse, lang)', d: 'The read shape is verse-plus-chosen-overlays; precompute the popular combinations and the corpus service becomes a CDN with a scholar\'s conscience.', n: ['corpus', 'srch'] },
    { t: 'Force citations, precompute the index', d: 'Citation checking at answer time needs verse-claim maps hot in memory - build the citation index at overlay publish time, not at question time.', n: ['guard', 'llm', 'vec'] },
    { t: 'Rules as reviewed data', d: 'Contraindication and interaction rules ship like overlays: versioned, attributed, reviewed - the guard is only as trustworthy as its editorial pipeline.', n: ['guard', 'prov'] },
  ],
  wall: { t: 'Authority does not shard', d: 'Past every cache and index, the binding constraint is scholarly: new commentaries, concordance disputes, terminology mappings and safety rules all require lineage-grade human consensus, and sampradaya does not autoscale. Compute multiplies; authority is validated one careful review at a time. The honest design accepts it - interpretation queues behind scholars, not GPUs - and the metric that matters at scale is review throughput with provenance, which is a governance system wearing an architecture.' },
},


'SaaS AI Copilot (Multi-tenant RAG)': {
  constraint: 'Every tenant shares the orchestrator, the gateway and the vector cluster, and none may share data, budget or latency. Scale means more tenants and more tokens with the isolation invariants holding at every rung.',
  ladder: [
    ['10 tenants', '~1 rps', 'One vector index with a tenant_id filter, one LLM key, metering in a table. The canary-document test exists from day one - retrofitting proof is harder than retrofitting code.'],
    ['1K tenants', '~50 rps', 'Namespaces or partitioned metadata; per-tenant token buckets; semantic cache keyed by tenant; ingestion workers autoscale on log lag.'],
    ['50K tenants', '~1K rps', 'Tiered isolation by plan (shared cluster for starter, dedicated namespaces for enterprise); LLM gateway with model routing and fallbacks; reindex tooling that walks tenants in batches.'],
    ['1M tenants', '~15K rps', 'Multi-region with data residency per tenant, embedding-model migrations as a months-long program, evals per tenant cohort - the platform is now an AI cloud with a product on top.'],
  ],
  levers: [
    { t: 'Enforce isolation where queries run', d: 'tenant_id as a database-level filter (namespace or predicate) makes leakage impossible rather than unlikely; the guard and the canary test verify it continuously.', n: ['vec', 'guard'] },
    { t: 'Meter and cap per tenant, before the answer', d: 'Token buckets per tenant at the API and usage records written pre-stream: budgets are enforced, bills are honest, and one tenant cannot starve another.', n: ['api', 'meter'] },
    { t: 'Cache semantically, per tenant', d: 'Repeated questions within a tenant cost nothing - and the cache key carries the tenant or the cache is a breach in waiting.', n: ['sc'] },
    { t: 'Treat the embedding model as a schema', d: 'Version every chunk by embedding model; upgrades are dual-read reindexes walked tenant by tenant, cut over deliberately - never a hotfix.', n: ['emb', 'vec'] },
  ],
  wall: { t: 'The model is shared; the promises are not', d: 'Past every namespace and bucket, one LLM gateway serves every tenant, and a provider incident, a model deprecation, or a price change lands on all of them at once. Isolation can be engineered at the data plane; it cannot be engineered at the model provider. The honest design multiplies providers behind the gateway, versions prompts per model, and tells enterprise tenants the truth in the SLA: their data is theirs alone, their model is everyone\'s.' },
},


'Enterprise SSO (Entra/Okta)': {
  constraint: 'The identity provider is the most concentrated dependency a company has: every employee, every app, every request touches it, and it must never be the reason work stops. Scaling is about staying available and fast as employees, apps and login rate all climb.',
  ladder: [
    ['1K employees, 10 apps', '~5 rps', 'One IdP tenant, OIDC for what supports it, SAML for what does not. Local token validation and SCIM deprovisioning matter from day one - a forgotten leaver is a risk at any size.'],
    ['50K employees, 100 apps', '~250 rps', 'Conditional access with real risk signals; MFA universal; JWKS cached at every app; the audit log becomes a stream, not a table.'],
    ['500K employees, 500 apps', '~2.5K rps', 'The broker fronts both protocols at scale; key rotation is a rehearsed program; session and single-logout semantics are designed across app families; regional token issuance cuts latency.'],
    ['1M+ employees, multi-cloud', '~15K rps', 'IdP-to-IdP federation (Okta trusting Entra or vice versa) presents one front door across acquisitions and clouds; availability engineering dominates - this is now critical national-scale infrastructure for the business.'],
  ],
  levers: [
    { t: 'Validate tokens at the edge, not at home', d: 'Apps verify signatures against cached JWKS locally; the IdP is not on the hot path of every API call. Introspection is reserved for revocation-critical flows only.', n: ['apps', 'keys', 'gw'] },
    { t: 'Make login a cached decision', d: 'The SSO session means the second, third and hundredth app login are invisible; conditional access re-evaluates on risk, not on every hop.', n: ['idp', 'sess', 'ca'] },
    { t: 'Rotate keys with overlap', d: 'Publish the next signing key in JWKS and trust it before signing with it; retire the old only after caches expire - rotation that drops a login was done wrong.', n: ['keys', 'idp'] },
    { t: 'Deprovision as fast as you provision', d: 'SCIM must remove access on exit within a bounded, audited window; short token lifetimes cap the exposure of anything the sync has not yet caught.', n: ['scim', 'dir'] },
  ],
  wall: { t: 'The single front door is the single point of failure', d: 'Every efficiency here - one identity, one login, one policy engine - concentrates risk into one system whose outage stops the entire company and whose compromise exposes all of it. Past a point the binding constraint is not throughput but blast radius: the IdP must be engineered like a power grid, with regional redundancy, graceful degradation (cached sessions surviving a brief control-plane blip), rehearsed key rotation, and a break-glass path for when identity itself is down. You cannot federate your way out of needing the front door to be the most reliable thing you run.' },
},


'Pine Labs (Merchant POS + EMI)': {
  constraint: 'The edge of this system is physical hardware in stores you do not control, on networks you cannot fix. Scaling means more terminals, more methods and more financing partners while the counter stays fast and no sale is ever lost.',
  ladder: [
    ['1K terminals', '~40 rps', 'Store-and-forward and idempotency from day one - retrofitting them after the first double-charge is painful. A single acquirer, a handful of EMI partners.'],
    ['50K terminals', '~400 rps', 'Least-cost routing across several acquirers; the EMI plan matrix is cached per partner; device fleet management (config, firmware) becomes its own service.'],
    ['600K terminals', '~4K rps', 'Routing weighs cost and live acquirer health; 200+ financing connectors behind a stable EMI contract; settlement nets per merchant at T+1 with three-way reconciliation; tamper and key rotation run as fleet programs.'],
    ['Multi-country, omnichannel', '~15K rps', 'The same orchestrator serves online (Plural-style) and in-store from one ledger; per-market acquirers and regulation; the fleet spans geographies and the edge-hardware logistics is itself a scaling constraint.'],
  ],
  levers: [
    { t: 'Capture at the edge, reconcile at the center', d: 'Terminals book offline and forward idempotently; the platform is never on the hot path of a sale that a blinking router would otherwise kill.', n: ['pos', 'store', 'ledger'] },
    { t: 'Cache the EMI matrix, answer in counter-time', d: 'Precompute eligible plans and subvention math per partner so the till answer is a fast lookup, not 200 bank calls.', n: ['emi', 'nbfc'] },
    { t: 'Route on cost and health together', d: 'Least-cost routing with live acquirer health and failover turns an acquirer outage into basis points, not declined sales.', n: ['route', 'acq'] },
    { t: 'Run the fleet like infrastructure', d: 'Config, key and firmware push, tamper and health signals across 600K devices - a terminal that cannot transact is a store that cannot earn.', n: ['fleet'] },
  ],
  wall: { t: 'The edge is hardware you cannot redeploy in an afternoon', d: 'Every other system in this studio scales its edge by changing a number; here the edge is 600,000 physical terminals in shops across the country, and a design decision - a new key scheme, a firmware dependency, an offline risk limit - is also a field-operations program with logistics, downtime and merchant impact. Past a point the binding constraint is not compute but the physical fleet: how fast you can safely push change to hardware you do not hold, without bricking a store\'s ability to take money. The honest design treats device management as a payments-grade system and accepts that the slowest, most physical part of the loop sets the pace.' },
},


'Discovery Loop (Autonomous Research)': {
  constraint: 'Ideas are cheap and compute is finite, so the system does not scale by serving more requests - it scales by extracting more discovery from more accelerators without the feedback loop breaking or the safety leash slipping. The binding resource is the GPU pool, and the binding risk is a loop that runs faster than it learns.',
  ladder: [
    ['1 campaign, tens of GPUs', 'a handful of concurrent runs', 'The loop, the scheduler and the provenance ledger all matter from day one - a research system without reproducibility is not cheaper, it is worthless. Expected-value scheduling can be simple, but it must exist.'],
    ['many campaigns, hundreds of GPUs', 'hundreds of concurrent runs', 'The scheduler becomes a real priority market in information-per-GPU-hour; checkpoint/resume is mandatory as run lengths grow; the prior store becomes the thing that makes cycles compound rather than repeat.'],
    ['a domain, thousands of GPUs', 'thousands of concurrent runs', 'Utilization AND convergence are tracked as separate first-class metrics; preemption is constant; the safety gate is a hardened, upstream service; hardware failure is designed-for as steady state with automatic run recovery.'],
    ['many domains, datacenter scale', 'the full accelerator fleet', 'The loop generalizes beyond ML research to engineering, medicine, materials, energy - each a new experiment-execution backend behind the same propose-schedule-analyze core; the meta-loop (the system improving its own methods) is now a governance and safety problem as much as a scaling one.'],
  ],
  levers: [
    { t: 'Schedule by information, not arrival', d: 'Rank the queue by expected information gain per GPU-hour and preempt low-value runs; the scarce resource must always be doing the most informative work available.', n: ['sched', 'queue'] },
    { t: 'Checkpoint everything, resume anything', d: 'Long runs stream checkpoints so preemption and the constant hardware failures at scale cost minutes, not days - without this, the scheduler cannot preempt and utilization collapses.', n: ['exec', 'store'] },
    { t: 'Make results compound as priors', d: 'Distill every outcome into the shared knowledge the hypothesis engine conditions on, so parallelism multiplies learning instead of multiplying random search.', n: ['eval', 'feat', 'hyp'] },
    { t: 'Bound the autonomy upstream', d: 'Cost, compute and blast-radius limits enforced before execution, per campaign - the leash scales with the loop, or the loop eventually outspends and outreaches it.', n: ['guard', 'sched'] },
  ],
  wall: { t: 'A loop that runs faster than it learns is a money fire', d: 'Every scaling lever adds compute and concurrency, and past a point the constraint is not throughput but the ratio of learning to spend. If results do not feed back fast and well enough to sharpen the next proposals, more GPUs simply buy a larger parallel random search - maximum utilization, zero convergence, an extraordinary burn rate with nothing discovered. The deeper wall is reflexive: the flagship campaign is automating ML research, so success means the system improves the very methods and models it runs on, and the safety, reproducibility and resource guarantees have to hold not against a fixed system but against one actively rewriting itself. You do not scale your way past needing the loop to learn faster than it spends, and needing the leash to hold as the thing on it gets smarter.' },
},

}
