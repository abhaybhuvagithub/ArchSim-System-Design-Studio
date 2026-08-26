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

}
