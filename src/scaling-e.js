// Scaling playbooks, part 5 — unicorn designs (India + USA). Shape documented in scaling.js.
export default {

'Zerodha (Kite)': {
  constraint: 'Two workloads with opposite physics share one brand: an order path measured in tens of milliseconds, and a ticker fan-out measured in sockets. Scaling one must never cost the other.',
  ladder: [
    ['10K users', '~200 rps', 'One order service, one ticker process reading the exchange feed, one Postgres. Fine.'],
    ['1M users', '~5K rps', 'Split the planes: dedicated ticker tier with the market snapshot in memory, RMS state moves fully in-memory, ledger writes go async off the fill stream.'],
    ['10M users', '~50K rps', 'Shard the ticker by instrument, shard RMS by account, add settlement workers consuming the trade stream exactly-once.'],
    ['100M users', '~200K rps', 'The exchange is still one venue: the order path stops scaling out and starts scaling down — kernel bypass, colocated gateways, and admission control on expiry days.'],
  ],
  levers: [
    { t: 'Keep RMS in memory, converged from fills', d: 'Margin checks on the hot path cannot read a database. Positions update from the fill stream and reconcile against the ledger continuously — drift here is approving trades against money that is not there.', n: ['rms', 'led'] },
    { t: 'Conflate the ticker under pressure', d: 'A slow socket gets the latest tick, not the backlog. Fan-out cost then scales with sockets, not with market volatility.', n: ['tick', 'snap'] },
    { t: 'Settle exactly-once off the stream', d: 'Fills land on the trade stream; settlement workers apply them with idempotency keys. The ledger stays ACID while everything in front of it goes fast and loose.', n: ['k', 'stl', 'led'] },
    { t: 'Shed load on expiry days, deliberately', d: 'Monthly expiry doubles order flow on a schedule you know in advance. Admission control that queues low-priority requests beats discovering the limit live with client money in flight.', n: ['gw', 'ord'] },
  ],
  wall: { t: 'The exchange', d: 'There is one matching venue with one clock, and no replica raises its throughput or moves it closer. Past a point you scale the order path by shaving microseconds and shedding load on expiry-day spikes, not by adding machines.' },
},

'Dream11': {
  constraint: 'Eighty percent of a match\'s joins arrive in the last ten minutes before lock, and every one of them is a real money debit. The spike is not an anomaly to absorb — it is the product\'s shape.',
  ladder: [
    ['10K users', '~50 rps', 'One service, wallet and contests in one Postgres, leaderboard as a SQL query. Fine.'],
    ['1M users', '~3K rps', 'Wallets shard by user, joins get idempotency keys, leaderboards move to in-memory sorted sets fed by score workers.'],
    ['100M users', '~30K rps steady, 50× at lock', 'Pre-scale for the fixture list — matches are scheduled, so capacity is too. Points computation becomes a partitioned stream job.'],
    ['500M users', '~150K rps peaks', 'Mega-contests get dedicated leaderboard partitions; join admission control protects the wallet tier; everything non-monetary degrades first, by design.'],
  ],
  levers: [
    { t: 'Shrink the ACID core to the debit', d: 'The transaction covers wallet debit + entry row. Counters, notifications and analytics leave on the stream. The spike then stresses a tiny, shardable surface.', n: ['join', 'wal'] },
    { t: 'Compute points as deltas, not totals', d: 'A wicket emits per-player deltas applied to team totals. Recomputing teams from scratch per ball multiplies work by squad size for nothing.', n: ['k', 'pts'] },
    { t: 'Serve ranks from sorted sets', d: 'Millions read the leaderboard between updates. Sorted sets in memory make reads O(log n) and updates cheap; exactness between ticks is not the product.', n: ['ldr'] },
    { t: 'Scale to the fixture list', d: 'The IPL schedule is published months out. Capacity planning here is calendar-driven pre-scaling, not autoscaling heroics at lock minus five.', n: ['join', 'gw'] },
  ],
  wall: { t: 'The lock moment', d: 'Every user wants the same ten minutes before the same match, and no architecture spreads that demand out — the boundary is the feature. You provision for the spike, shed the non-monetary work, and accept that peak capacity sits idle between matches.' },
},

'CRED': {
  constraint: 'Card numbers may live in exactly one place, and rewards must be exactly-once per payment. The vault boundary and the idempotent stream are the two invariants everything scales around.',
  ladder: [
    ['10K users', '~20 rps', 'One service plus the vault, payments in Postgres, rewards computed inline. Fine at this size, already wrong in shape.'],
    ['1M users', '~500 rps', 'Rewards leave the request path onto the stream with paymentId dedup. Biller connectors get per-rail isolation and breakers.'],
    ['10M users', '~3K rps', 'Payments shard by user; the vault scales reads with replicas but stays one write boundary; rewards workers scale by stream partition.'],
    ['50M users', '~10K rps', 'Bill-date clustering drives the real peaks — month-end pre-scaling, per-rail rate budgets, and a reconciliation pipeline that treats biller webhooks as unreliable by default.'],
  ],
  levers: [
    { t: 'Hold the vault boundary while scaling around it', d: 'The vault is the one component that cannot fan out freely — PCI scope follows it. Everything else scales; the vault stays small, hardened and boring.', n: ['vault'] },
    { t: 'Isolate every biller rail', d: 'Thirty rails means thirty independent failure domains. Breakers and per-rail queues turn a rail outage into delayed payments on one rail, not a checkout incident.', n: ['bc'] },
    { t: 'Make rewards a replayable stream job', d: 'Exactly-once via paymentId dedup means the rewards engine can crash, replay and rescale freely — the property lives in the data, not the process.', n: ['k', 'rw', 'rdb'] },
    { t: 'Pre-scale for the bill-date cluster', d: 'Card bills due on the 1st and 15th make the load calendar-shaped. Month-end capacity is planned from the statement calendar, not reacted to by an autoscaler mid-spike.', n: ['bp', 'pay'] },
  ],
  wall: { t: 'The billers', d: 'Their rails have fixed throughput, scheduled downtime and settlement windows you do not control. Past your own scaling, month-end peaks are managed by queueing against rail budgets — the money moves when the rail moves, and no replica changes that.' },
},

'Zepto (10-min delivery)': {
  constraint: 'The SLO is physical: pick, pack and ride inside ten minutes. Software scales in milliseconds; the binding resources are shelf stock, packers and riders per dark store.',
  ladder: [
    ['10K users', '~50 rps', 'A handful of stores, one database, dispatch by nearest rider. Fine.'],
    ['1M users', '~2K rps', 'Per-store in-memory stock with reconciliation; dispatch becomes a scored assignment on the rider geo index; demand forecasting starts deciding shelves.'],
    ['10M users', '~10K rps', 'Hundreds of stores as isolated cells — a store\'s stock, orders and dispatch never leave its shard. City-level batching tunes rider utilization against the promise.'],
    ['50M users', '~40K rps', 'Store networks per city with overflow radii; forecasting runs per store per hour; the app degrades to honest ETAs the moment physical capacity saturates.'],
  ],
  levers: [
    { t: 'Shard by dark store, because reality does', d: 'Stock is physical and local. Store-cell isolation means a store outage is a neighborhood apology, and there is nothing cross-shard to coordinate at order time.', n: ['inv', 'ord'] },
    { t: 'Keep stock honest-enough in memory', d: 'Decrement a per-store cache at order time, reconcile to the store DB and shelf audits continuously. Transactional shelf-exactness would put a lock on every page view.', n: ['inv', 'osql'] },
    { t: 'Batch riders against the countdown', d: 'One rider, two nearby drops — if both promises still hold. Utilization is won in the dispatcher\'s scoring, not by hiring more riders per order.', n: ['disp', 'geo'] },
    { t: 'Let forecasting do the capacity planning', d: 'Tomorrow\'s shelves are tonight\'s prediction. The demand model is the real autoscaler; the software just has to not waste the minutes it buys.', n: ['eta'] },
  ],
  wall: { t: 'Physics', d: 'Ten minutes buys a fixed radius at scooter speed, and a dark store holds finite stock and packers. Past software efficiency you scale by building stores — capex, not architecture — and the promise itself caps how far any single store can reach.' },
},

'Postman': {
  constraint: 'Cloud runs execute untrusted user code. The sandbox boundary is a security control with a per-run cost, and it must scale without ever being traded away for throughput.',
  ladder: [
    ['10K users', '~30 rps', 'Sync over websockets, runs on a small worker pool, mocks from examples. Fine.'],
    ['1M users', '~1K rps', 'Runner fleet with per-workspace concurrency caps behind the queue; sync fans out ops per collection; permission checks move behind a cache.'],
    ['10M users', '~8K rps', 'Sandbox pools pre-warmed by runtime; mocks split to a dedicated serving tier with zero user code; collections shard by workspace.'],
    ['30M users', '~25K rps', 'Regional runner fleets near users\' targets; noisy-tenant isolation by tier; the permission cache becomes the highest-QPS component in the platform.'],
  ],
  levers: [
    { t: 'Cap concurrency per workspace at the queue', d: 'One team\'s 10,000-iteration run must not starve the fleet. Fairness lives at admission, where it is cheap — not in the scheduler, where it is a research project.', n: ['q', 'run'] },
    { t: 'Pre-warm sandboxes, never share them', d: 'Cold isolation per run is the security model; pre-warmed pools recover the latency without recovering the risk. The boundary is non-negotiable at every scale.', n: ['run'] },
    { t: 'Serve mocks from a code-free tier', d: 'Mock traffic is high-volume and low-trust-need — saved examples in, responses out. Splitting it off keeps the dangerous tier (runners) small and the busy tier (mocks) cheap.', n: ['mk', 'ex'] },
    { t: 'Cache permission answers everywhere', d: 'Every read of every collection asks may-they. Precomputed workspace-role answers in a cache make the check a lookup — at scale it is the hottest query in the platform.', n: ['gw', 'col'] },
  ],
  wall: { t: 'The isolation tax', d: 'Every run pays for a fresh security boundary, and that cost floor does not amortize away with scale — it multiplies with it. Efficiency work shaves the per-sandbox price; nothing eliminates it without reopening the threat model.' },
},

'Discord': {
  constraint: 'Fan-out cost scales with guild size, and guild sizes follow a power law. The design is judged by its worst guild, not its average one.',
  ladder: [
    ['10K users', '~100 rps', 'One gateway tier, messages in Postgres, presence in Redis. Fine.'],
    ['1M users', '~5K rps', 'Shard by guild id; messages move to wide-column storage by (channel, bucket); permissions precompute into a cache.'],
    ['100M users', '~100K rps', 'Mega-guilds get isolated home shards and lazy member loading; presence conflation becomes mandatory; voice grows as regional SFU fleets.'],
    ['500M users', '~500K rps', 'The top guilds are hand-capacity-planned like tenants; fan-out uses per-shard session lists exclusively; everything ephemeral sheds first under load.'],
  ],
  levers: [
    { t: 'Shard by guild, isolate the hot ones', d: 'A 500k-member guild heats one addressable process. That process can be provisioned, moved and rate-limited individually — the power law becomes an ops dial instead of an outage.', n: ['gws'] },
    { t: 'Conflate presence ruthlessly', d: 'Status flickers in a mega-guild can dwarf message traffic. Coalescing updates per member per interval cuts fan-out volume by orders of magnitude and no human can tell.', n: ['pres', 'gws'] },
    { t: 'Store messages by (channel, time bucket)', d: 'Wide-column partitioning matches the read pattern — recent pages of one channel — and spreads hot channels across buckets instead of hot rows.', n: ['msg'] },
    { t: 'Grow voice as SFU fleets', d: 'One stream up, N forwarded down: server cost is bandwidth, so voice scales by adding regional SFUs, and a voice-server loss drops channels, not the product.', n: ['vg'] },
  ],
  wall: { t: 'The mega-guild', d: 'Delivery to half a million live sessions of one community is irreducible fan-out — shardable, conflatable, but never avoidable. The largest guilds are effectively named tenants with their own capacity plans, and each order of magnitude of community size reopens the same problem.' },
},

'Notion': {
  constraint: 'Every read of every block passes a permission check derived from its ancestors. The permission cache is therefore the highest-QPS component in the system, and it must fail closed.',
  ladder: [
    ['10K users', '~50 rps', 'Blocks in Postgres, permissions walked per read, ops over a socket. Fine.'],
    ['1M users', '~2K rps', 'Effective permissions precompute into a cache; block reads become subtree fetches; search indexing moves behind a queue.'],
    ['50M users', '~20K rps', 'Blocks shard by workspace; the permission cache scales as its own tier with subtree invalidation; sync fans out per page session.'],
    ['200M users', '~80K rps', 'Hot public pages get a rendered-read path; permission entries version to survive cross-shard moves; the indexer runs as a partitioned stream consumer.'],
  ],
  levers: [
    { t: 'Precompute permissions, invalidate by subtree', d: 'The tree walk happens once per grant change, not once per read. A share change invalidates one subtree\'s cache entries; everything else keeps its answer.', n: ['perm', 'blk'] },
    { t: 'Shape storage for subtree reads', d: 'Loading a page is loading a subtree. Keying blocks so an ancestor path fetches in one or two round trips is worth more than any downstream cache.', n: ['blk'] },
    { t: 'Keep the indexer off the write path', d: 'A keystroke enqueues; the indexer consumes. Search lags by seconds and the editing surface never learns the index had a bad day.', n: ['q', 'sw', 'se'] },
    { t: 'Fan sync out per page session', d: 'Ops broadcast to the people on that page, not the workspace. Session-scoped fan-out keeps live-edit cost proportional to actual collaboration, which is small even when companies are huge.', n: ['ws'] },
  ],
  wall: { t: 'Permission resolution itself', d: 'Inheritance means every read is context-dependent, so there is no shared render of a private page — caching helps per principal, never universally. The check can be made very cheap; it cannot be made free, and it runs on everything, forever.' },
},

'Plaid': {
  constraint: 'Bank cores set the pace: slow, rate-limited and scheduled around batch windows you do not control. The platform scales by scheduling against those budgets, never by fetching harder.',
  ladder: [
    ['10K items', '~10 rps', 'A few connectors, refresh on demand, transactions cached in one store. Fine.'],
    ['1M items', '~200 rps partner-facing', 'The connector fleet gets per-institution rate budgets and breakers; refresh becomes a scheduler\'s job; webhooks move to at-least-once delivery workers.'],
    ['100M items', '~5K rps', 'Refresh scheduling optimizes per bank window; transactions shard by item; webhook delivery scales by partner partition with dead-letter replay tooling.'],
    ['1B items', '~30K rps', 'Connector capacity is negotiated per institution like peering; change-detection diffs run as stream jobs; partner reads never touch anything but cache.'],
  ],
  levers: [
    { t: 'Schedule refreshes against bank budgets', d: 'Each institution has a request budget and a maintenance window. A global scheduler spending those budgets deliberately beats every connector fetching on its own clock.', n: ['conn', 'core'] },
    { t: 'Serve partners from cache, always', d: 'Partner reads hit the transaction store, full stop. Live fetch-through would let one popular app spend an entire bank\'s budget by lunch.', n: ['tx', 'gw'] },
    { t: 'Scale webhooks by partner partition', d: 'Delivery workers partition by partner so one dead endpoint backs up its own lane. Retries, dedup ids and a replayable dead-letter queue are the product\'s reliability story.', n: ['k', 'wh'] },
    { t: 'Onboard institutions as a factory', d: 'The connector fleet grows by process, not heroics: template, certify against the bank sandbox, canary with real items, then fleet. Growth rate is set by the factory throughput.', n: ['conn'] },
  ],
  wall: { t: 'The institutions', d: 'Ten thousand banks means ten thousand rate limits, maintenance windows and batch-era cores, and none of them scale because you grew. Data freshness is permanently bounded by the slowest rail that matters — the ceiling is contractual and physical, not architectural.' },
},

'Vercel': {
  constraint: 'The edge cache hit ratio is the economics of the platform: every point of hit ratio is margin, and every framework change that reduces cacheability is a pricing incident in disguise.',
  ladder: [
    ['10K sites', '~1K rps', 'A CDN, a function runtime, a build queue. Fine.'],
    ['1M sites', '~50K rps', 'Deployment-scoped cache keys; build caching per layer; functions place into a handful of regions; invalidation rides deploy events.'],
    ['10M sites', '~500K rps', 'Edge PoPs multiply; ISR-style revalidation becomes the default read path; build fleet scales by framework-aware caching; previews isolate per branch.'],
    ['100M sites', '~5M rps', 'The router is the busiest program in the company; function placement follows each site\'s data; multi-tenant isolation at the edge is the hard engineering.'],
  ],
  levers: [
    { t: 'Scope cache keys to the deployment', d: 'Keys include the deployment id, so a ship can never serve mixed assets and invalidation is enumerable: purge what the new deployment changed, keep the rest warm.', n: ['kv', 'inv', 'k'] },
    { t: 'Serve stale, revalidate behind', d: 'ISR turns dynamic pages into cache hits with background refresh. The hit ratio — and the margin — comes from making this the default, not the exception.', n: ['edge', 'kv'] },
    { t: 'Cache builds by layer', d: 'Most pushes change a few files. Framework-aware build caching turns the fleet\'s work from O(pushes × project size) into O(actual diffs).', n: ['bld', 'art'] },
    { t: 'Place functions near their data', d: 'A function at the edge calling a database across an ocean moved the latency, not removed it. Placement follows the data\'s region, and the router honors it.', n: ['fx', 'cfg'] },
  ],
  wall: { t: 'Other people\'s code', d: 'The platform cannot make an uncacheable app cacheable or a chatty function fast — customer framework choices set a floor under cost and latency that no PoP buildout lowers. The lever left is shaping defaults so the easy path is the economic one.' },
},

'Ramp': {
  constraint: 'The card network allows roughly two seconds per authorization, all-in, and applies its own stand-in decision if you miss it. The decision path is engineered backwards from that deadline at every scale.',
  ladder: [
    ['1K companies', '~20 rps', 'One decision service reading compiled policies from memory, holds in Postgres. Fine.'],
    ['100K companies', '~500 rps', 'Policy compilation on write with push to the auth tier; fraud scoring gets a hard budget and a rules fallback; matching becomes a stream job with an exceptions queue.'],
    ['1M companies', '~5K rps', 'Auth tier shards by card range and runs active-active; the ledger partitions by company; analytics reads split fully from the decision plane.'],
    ['10M companies', '~30K rps', 'Regional auth presence near network endpoints; decision records feed model retraining; every millisecond of the budget is owned by a named component.'],
  ],
  levers: [
    { t: 'Compile policies on write, not on read', d: 'Policy edits are rare; swipes are constant. Compiling rules into an in-memory decision structure moves all the expensive work to the write path where nobody is waiting.', n: ['pol', 'dec'] },
    { t: 'Budget the model, keep the fallback', d: 'Fraud scoring gets a hard timeout inside the decision budget; on breach, the rules-only verdict stands. A degraded answer in time beats a perfect answer late — late is the network deciding for you.', n: ['fr', 'dec'] },
    { t: 'Split the decision plane from everything', d: 'Dashboards, analytics and alerts consume the spend stream. Nothing user-facing shares a resource with the auth path — a marketing-dashboard query must be physically unable to slow a swipe.', n: ['k', 'an', 'dash'] },
    { t: 'Shard the auth tier by card range', d: 'Card BIN ranges partition naturally and the network routes by them, so active-active shards scale swipes linearly while each keeps its compiled policies fully in memory.', n: ['gw', 'dec'] },
  ],
  wall: { t: 'The network deadline', d: 'Two seconds is contractual and global — it does not grow with your cluster, and stand-in processing means missing it still produces a decision you own. Past regional presence and in-memory everything, the remaining work is shaving your own path, because the ceiling never moves.' },
},

}
