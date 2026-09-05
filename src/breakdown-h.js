// Authored breakdowns, part 8 — the interview classics. Shape documented in breakdown.js.
export default {

'LeetCode (Online Judge)': {
  meta: 'devtools - medium - hostile code, fair verdicts, spiky contests',
  overview: 'An online judge: strangers submit code, the platform runs it against hidden tests and returns a verdict - and during a contest, a hundred thousand people do this in the same minute. Two hard problems share the design: executing untrusted code safely, and making verdicts fair enough to rank careers on.',
  scope: 'Submission, sandboxed judging, verdicts and contest ranking. Problem authoring, discussion forums and premium features are below the line.',
  fr: {
    core: ['Accept a submission in any supported language', 'Run it against hidden test cases under identical limits', 'Return a verdict (AC/WA/TLE/MLE/RE) with per-test detail', 'Rank contest participants live'],
    out: ['Problem authoring workflow', 'Forums and editorials', 'Plagiarism detection (offline job)'],
  },
  nfr: {
    core: ['Untrusted code never escapes its sandbox - no network, capped CPU/memory/time', 'Verdicts are deterministic: same code, same limits, same answer', 'Contest start absorbs a 100x submission spike via the queue', 'Ranks update within seconds of a verdict'],
    out: ['Sub-second judging - correctness beats latency here'],
  },
  nums: [['100x', 'the contest-start submission spike'], ['1', 'sandbox per run, destroyed after'], ['~seconds', 'from verdict to leaderboard movement'], ['0', 'network calls allowed inside a run']],
  entities: [
    ['Submission', 'code + language + problem, queued for judgment'],
    ['Run', 'one sandboxed execution across the test set'],
    ['Verdict', 'the outcome per test and overall - the record of record'],
    ['Contest ranking', 'a deterministic fold: solves, penalties, tie-breaks'],
  ],
  apiIntro: 'REST; submissions are async - poll or subscribe for the verdict.',
  api: [
    { dir: '->', name: 'POST /submissions', body: '{ problemId, lang, code }\n-> { submissionId, status: queued }' },
    { dir: '->', name: 'GET /submissions/{id}', body: '-> { status, verdict?, tests?: [{ id, result, ms, mb }] }' },
    { dir: '->', name: 'GET /contests/{id}/ranks?cursor=', body: '-> { rows[], myRank }' },
  ],
  dives: [
    {
      title: 'The sandbox is the product', focus: ['jr', 'q'],
      blocks: [
        ['p', 'Every run gets a disposable sandbox: no network, a read-only filesystem plus a scratch dir, hard caps on CPU seconds, memory and wall clock. Test cases mount inside; the code never learns where it is running.'],
        ['bul', [
          'Fairness = identical environments: same hardware class, same limits per language, warmed uniformly.',
          'The queue holds contest spikes; the runner fleet stays fixed-size and fully busy rather than elastic and unfair.',
          'Compile and run are separate limit domains - a slow compile is not a TLE.',
        ]],
        ['warn', 'Resource limits are the verdict. A noisy neighbor stealing CPU turns a correct solution into a TLE - and that is a fairness incident, not a performance blip.'],
      ],
    },
    {
      title: 'Ranking as a deterministic fold', focus: ['k', 'rw', 'ldr'],
      blocks: [
        ['p', 'Contest rank is pure function of the verdict stream: solves, time penalties, wrong-answer penalties, tie-breaks. Workers fold verdict events into per-user scores; sorted sets serve ranks from memory.'],
        ['bul', [
          'Determinism means replayability: rebuild any leaderboard from the event log after a dispute.',
          'Late verdicts (judge backlog) still order by submission time, not judgment time.',
          'The frozen last hour (ranks hidden) is a read-side flag, not a pipeline change.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A submission queue, isolated runners, verdicts stored, a leaderboard.',
    senior: 'A real sandbox spec (limits, no network, disposable), fixed fair fleet behind a queue, ranks as a replayable fold.',
    staff: 'Argue the fairness model end-to-end - hardware uniformity, limit calibration per language, dispute replay - and size the contest spike.',
  },
},

'Strava': {
  meta: 'consumer - medium - a GPS stream becomes a social object',
  overview: 'Activity tracking for athletes. An activity arrives as thousands of GPS points and becomes a map, splits, segment efforts and a feed story. The pipeline is the product: upload once, process async, then serve the derived views a million times.',
  scope: 'Activity upload, route processing, segment matching and leaderboards, and the feed. Live tracking, training plans and payments are below the line.',
  fr: {
    core: ['Upload an activity as a GPS point stream', 'Process into routes, splits and matched segments', 'Maintain segment leaderboards (KOM/QOM)', 'Serve a followers feed of activities'],
    out: ['Live beacon tracking', 'Training analytics', 'Route planning'],
  },
  nfr: {
    core: ['Processing is async - upload acks fast, derived data follows', 'Segment matching scales with activities, not points', 'Leaderboards read from memory; recomputes are event-driven', 'Privacy zones scrub coordinates before anything public exists'],
    out: ['Real-time processing - minutes of lag is fine'],
  },
  nums: [['~3k', 'GPS points in an hour ride'], ['seconds-minutes', 'upload to processed'], ['millions', 'of segment efforts on popular climbs'], ['1', 'chance to scrub privacy zones - before derivation']],
  entities: [
    ['Activity', 'the uploaded point stream plus metadata'],
    ['Segment', 'a community-defined stretch of road with a leaderboard'],
    ['Effort', 'one athlete\'s timed traversal of a segment'],
    ['Feed item', 'the social rendering of a processed activity'],
  ],
  apiIntro: 'REST upload; processing status is polled or pushed. Reads hit derived stores only.',
  api: [
    { dir: '->', name: 'POST /activities', body: '{ points[], meta }\n-> { activityId, status: processing }' },
    { dir: '->', name: 'GET /segments/{id}/leaderboard', body: '-> { efforts[], myBest }' },
    { dir: '->', name: 'GET /feed?cursor=', body: '-> { items[] }' },
  ],
  dives: [
    {
      title: 'Segment matching without touching every point twice', focus: ['proc', 'geo'],
      blocks: [
        ['p', 'Matching an activity against a million segments cannot be a per-point scan. The geo index holds segment bounding shapes by cell; an activity\'s route queries candidate segments once, then exact matching runs only against those candidates.'],
        ['bul', [
          'Candidate lookup is cells-touched-by-route -> segments-in-cells; exact match then validates direction and completeness.',
          'Map-matching first (snap GPS noise to roads) makes exact matching honest.',
          'New segments trigger a backfill job against historical activities - a batch product, not a request-time one.',
        ]],
      ],
    },
    {
      title: 'Privacy zones as a pipeline stage, not a display filter', focus: ['act', 'k'],
      blocks: [
        ['p', 'Home-address privacy cannot be a rendering choice - derived data (segments, heatmaps, feeds) would leak it. Scrubbing happens at ingest: points inside a privacy zone are redacted before any downstream consumer sees the stream.'],
        ['warn', 'Anything computed before scrubbing must be treated as contaminated. The order of pipeline stages is a privacy control here, and reordering it is an incident.'],
        ['bul', [
          'Zone edits trigger reprocessing of affected activities - retroactive privacy is part of the contract.',
          'Aggregates (heatmaps) apply k-anonymity thresholds on top of scrubbing.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Upload, async processing, activity store, a feed.',
    senior: 'Geo-indexed segment matching, event-driven leaderboards, privacy scrubbing as an ingest stage.',
    staff: 'Design the backfill story (new segments, edited zones), heatmap anonymity, and the cost model of reprocessing history.',
  },
},

'Online Auction (eBay)': {
  meta: 'commerce - medium - money and a clock in the same transaction',
  overview: 'Timed auctions: many bidders, one item, a deadline. The core is a conditional write racing a clock - a bid only exists if it beat the current high at the moment it landed, and the close must pick exactly one winner even as last-second bids are still in flight.',
  scope: 'Listings, bidding, live price updates and auction close. Search, payments capture and disputes are below the line.',
  fr: {
    core: ['List items with a start price and end time', 'Accept bids that must exceed the current high', 'Show watchers the price move live', 'Close on time with exactly one winner'],
    out: ['Search and discovery', 'Payment capture and escrow', 'Fraud and shill detection'],
  },
  nfr: {
    core: ['Bid acceptance is strongly consistent - highest-so-far is a fact, not a hint', 'Watchers see updates in under a second', 'Close is exactly-once and survives worker crashes', 'A hot auction (thousands watching one item) cannot degrade others'],
    out: ['Global ordering across auctions - each auction is its own world'],
  },
  nums: [['1', 'winner, no matter what'], ['<1s', 'bid-to-watcher latency'], ['last 60s', 'where most bids land'], ['1 row', 'the write contention hot spot: the current high']],
  entities: [
    ['Listing', 'item, start price, end time, state (open/closed)'],
    ['Bid', 'amount + bidder + server timestamp - accepted only if it beat the high'],
    ['High watermark', 'the current price - the row everyone fights over'],
    ['Close', 'the exactly-once transition picking the winner'],
  ],
  apiIntro: 'REST for bids; sockets for the live price. The bid response is authoritative immediately.',
  api: [
    { dir: '->', name: 'POST /auctions/{id}/bids', body: '{ amount, maxBid? }\n-> { accepted, currentHigh } | 409 outbid-already' },
    { dir: '<->', name: 'WS /auctions/{id}/live', body: 'price frames: { high, bidder, endsAt(extended?) }' },
  ],
  dives: [
    {
      title: 'The bid: a compare-and-set with money on it', focus: ['bid', 'bdb'],
      blocks: [
        ['p', 'Accepting a bid is one transaction: read current high, verify the new bid exceeds it (plus increment), write bid and new high. Two bids racing serialize on that row - one wins, one gets an honest 409 with the new price.'],
        ['bul', [
          'Per-auction serialization is the point, not a bottleneck to engineer away - correctness lives on that row.',
          'Proxy bids (max-bid) resolve inside the same transaction: the system bids the minimum needed up to the max.',
          'Server timestamps decide ties; client clocks decide nothing.',
        ]],
      ],
    },
    {
      title: 'Closing exactly once while bids are still landing', focus: ['cw', 'k'],
      blocks: [
        ['p', 'Close is a state transition, not a timer callback: the close worker leases the auction, flips state open->closing (rejecting new bids at the transaction layer), drains in-flight bids, then commits closed with the winner. A crashed worker\'s lease expires and another finishes the same idempotent sequence.'],
        ['bul', [
          'Anti-sniping is a policy inside close: bids in the final window extend endsAt - the same transition logic, different trigger.',
          'The winner notification and payment kick-off ride events after the commit, at-least-once with dedup.',
          'Hot auctions get their watchers on sockets fed by the event bus - the bid path never fans out itself.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Bids checked against a current high, live updates, a close job.',
    senior: 'Transactional compare-and-set bidding with proxy bids, lease-based exactly-once close, event-fed watchers.',
    staff: 'Design the closing state machine under crash and race, argue per-auction serialization, and handle the hot-auction fan-out without touching the bid path.',
  },
},

'FB Live Comments': {
  meta: 'consumer - medium - fan-in and fan-out on the same object',
  overview: 'Comments on a live video: a million viewers watching one stream, thousands commenting per second, everyone expecting to see the flow instantly. It is the hot-object problem in its purest form - fan-in (everyone writes to one stream) and fan-out (everyone reads it) simultaneously.',
  scope: 'Comment posting, moderation, fan-out to viewers and late-join catch-up. The video pipeline itself, reactions and gifting are below the line.',
  fr: {
    core: ['Post comments on a live stream', 'Filter toxicity before anyone sees it', 'Deliver the comment flow to every viewer live', 'Give late joiners recent context'],
    out: ['The video/audio pipeline', 'Reactions and gifts', 'Creator moderation tooling'],
  },
  nfr: {
    core: ['Delivery latency under ~2s post-to-screen', 'One viral stream cannot take down the platform - it owns a shard', 'Moderation is inline: pre-fan-out, with a strict latency budget', 'Per-viewer delivery is sampled - humans cannot read 10k/s anyway'],
    out: ['Total ordering - approximate order is invisible in a flood'],
  },
  nums: [['1M+', 'concurrent viewers on a big stream'], ['~10k/s', 'comment peaks on viral moments'], ['<2s', 'post-to-screen budget including moderation'], ['~10-20/s', 'what a human can actually perceive']],
  entities: [
    ['Stream', 'the live video - the sharding key and the hot spot'],
    ['Comment', 'author + text + ts, moderated before existence'],
    ['Viewer session', 'a socket subscribed to one stream\'s flow'],
    ['Sample policy', 'the per-viewer thinning that makes the flood readable'],
  ],
  apiIntro: 'One REST write, one socket read. Everything interesting is between them.',
  api: [
    { dir: '->', name: 'POST /streams/{id}/comments', body: '{ text } -> { accepted } (moderation may still drop silently)' },
    { dir: '<->', name: 'WS /streams/{id}/comments', body: 'comment frames, sampled per viewer under load' },
  ],
  dives: [
    {
      title: 'One stream = one hot shard, on purpose', focus: ['k', 'fw', 'ws'],
      blocks: [
        ['p', 'Sharding by stream id means the biggest stream concentrates on one partition and its fan-out workers. That is the honest shape of the problem: you cannot spread one object, you can only provision for it and isolate it.'],
        ['bul', [
          'Fan-out workers per shard push to the socket tier holding that stream\'s viewers, grouped by socket server.',
          'Delivery is per-socket-server batches, not per-viewer sends - the multiplier is servers, not people.',
          'A stream going viral triggers shard isolation: dedicated workers, dedicated socket capacity, watched like a tenant.',
        ]],
      ],
    },
    {
      title: 'Sampling: the flood nobody can read', focus: ['ws', 'ccache'],
      blocks: [
        ['p', 'At 10k comments/s, delivering everything to everyone is a bandwidth bill with no user benefit - a human tracks maybe 15/s. Under load, each viewer gets a sampled slice: friends and creator always, the rest probabilistically down to a readable rate.'],
        ['bul', [
          'Sampling is per-viewer at the socket tier - the bus still carries everything for moderation, analytics and replay.',
          'Late joiners read the recent-comments cache for context, then join the live tail.',
          'Own comments always echo back - seeing yourself is non-negotiable UX.',
        ]],
        ['note', 'The moderation filter runs before fan-out with a hard budget: a toxic comment shown to a million people cannot be unshown.'],
      ],
    },
  ],
  bar: {
    mid: 'A write path, a socket broadcast, a recent-comments cache.',
    senior: 'Stream-sharded fan-out via workers and socket-server batching, inline moderation, per-viewer sampling.',
    staff: 'Own the viral-stream playbook: shard isolation, sampling policy, and the fan-out arithmetic (servers x batches, never viewers x comments).',
  },
},

'News Aggregator': {
  meta: 'media - medium - a pipeline that never stops feeding a page that must load now',
  overview: 'Google-News-shaped: crawl thousands of publishers continuously, collapse fifty tellings of one story into one cluster, rank clusters for freshness and authority, serve a front page in milliseconds. Two planes - an always-running pipeline and a read path that only ever touches its output.',
  scope: 'Crawling, dedup/clustering, ranking and serving. Personalization models, publisher payments and comments are below the line.',
  fr: {
    core: ['Crawl publishers at a per-source cadence', 'Detect near-duplicates and cluster them into stories', 'Rank stories by freshness, authority and engagement', 'Serve front pages and topic feeds fast'],
    out: ['Deep personalization', 'Publisher revenue programs', 'Comments and community'],
  },
  nfr: {
    core: ['Freshness: minutes from publish to front page for breaking news', 'Crawl politeness: robots.txt and per-site budgets are hard limits', 'The read path never touches the pipeline - cache misses hit stores, not crawlers', 'Clustering precision: merging two different stories is worse than missing a duplicate'],
    out: ['Exactly-once crawling - re-fetching is cheap, missing is not'],
  },
  nums: [['1000s', 'of sources on independent cadences'], ['~50:1', 'articles-to-story collapse on big events'], ['minutes', 'publish-to-page for breaking news'], ['ms', 'front page from cache']],
  entities: [
    ['Source', 'a publisher with a crawl cadence, budget and authority score'],
    ['Article', 'one fetched telling: url, text, entities, embedding'],
    ['Story cluster', 'the deduped event - what users actually see'],
    ['Ranking', 'the ordered front page per edition/topic, rebuilt continuously'],
  ],
  apiIntro: 'The public API is reads only; the pipeline has no user-facing surface.',
  api: [
    { dir: '->', name: 'GET /front?edition=', body: '-> { clusters: [{ title, sources[], leadUrl }] } - from cache' },
    { dir: '->', name: 'GET /topics/{id}?cursor=', body: '-> { clusters[] }' },
    { dir: '->', name: 'GET /search?q=', body: '-> { clusters[] } - the article index, cluster-collapsed' },
  ],
  dives: [
    {
      title: 'Clustering fifty tellings into one story', focus: ['dd', 'ndb'],
      blocks: [
        ['p', 'Every wire story arrives dozens of times with different headlines. Near-duplicate detection runs in two gears: cheap fingerprints (shingled hashes) catch copies, embedding similarity catches rewrites; a cluster forms around the earliest authoritative telling.'],
        ['bul', [
          'Precision beats recall: a wrong merge shows users one story labeled as another - worse than a duplicate slipping through.',
          'Clusters are living objects: new articles join, the lead article can be replaced as better sourcing arrives.',
          'Entity extraction (people, places) feeds both clustering confidence and topic routing.',
        ]],
      ],
    },
    {
      title: 'Crawling on a thousand clocks', focus: ['sched', 'cr'],
      blocks: [
        ['p', 'A wire service publishes every minute, a local paper twice a day. The scheduler learns each source\'s velocity and spends its politeness budget accordingly - and shifts gears when a breaking story makes a slow source suddenly fast.'],
        ['bul', [
          'Sitemaps and feeds are hints, not truth - the scheduler verifies with cheap conditional fetches.',
          'Per-site budgets are hard: a 429 or robots change throttles the source immediately.',
          'Breaking-news mode: cluster velocity spikes promote related sources\' cadence for a window.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Crawlers, a dedup step, a ranked list, a cached front page.',
    senior: 'Two-gear near-dup clustering, velocity-adaptive polite crawling, cache-only read path.',
    staff: 'Argue the precision/recall trade in clustering, design breaking-news mode end to end, and keep publisher relations (robots, budgets) as architectural invariants.',
  },
},

'Price Tracker': {
  meta: 'consumer - medium - politely scraping people who do not want you there',
  overview: 'CamelCamelCamel-shaped: watch products across retail sites, record price history, alert on real drops. The scraping is adversarial (the sites change and defend), the detection is noisy (prices flicker), and the alert is perishable (a deal has a half-life of minutes).',
  scope: 'Watchlists, scheduled scraping, price history and drop alerts. Affiliate monetization, browser extensions and coupon logic are below the line.',
  fr: {
    core: ['Track products a user watches across sites', 'Scrape prices on demand-weighted schedules', 'Store history and render price charts', 'Alert on genuine drops within minutes'],
    out: ['Affiliate link routing', 'Extension overlay', 'Coupon aggregation'],
  },
  nfr: {
    core: ['Per-site politeness budgets are hard limits - getting blocked loses every user of that site', 'Scrape freshness follows demand: hot items hourly, tail daily', 'Drop detection filters noise: currency, A/B tests, cart-only prices', 'Alert delivery inside minutes of detection'],
    out: ['Real-time prices - this is a tracker, not a ticker'],
  },
  nums: [['100k+', 'products under watch'], ['hourly vs daily', 'hot vs tail scrape cadence'], ['minutes', 'drop-to-alert budget'], ['1 block', 'can cost a whole site\'s coverage']],
  entities: [
    ['Watch', 'user x product x target price'],
    ['Product identity', 'the mapping from a URL to a canonical product across variants'],
    ['Price point', 'site + product + price + ts - the time series atom'],
    ['Drop event', 'a filtered, genuine decrease worth waking someone for'],
  ],
  apiIntro: 'REST for watches and charts; the pipeline runs on its own schedule.',
  api: [
    { dir: '->', name: 'POST /watches', body: '{ productUrl, targetPrice? } -> { watchId, product }' },
    { dir: '->', name: 'GET /products/{id}/history?range=', body: '-> { points[] } - straight from the time series' },
  ],
  dives: [
    {
      title: 'Scraping as a diplomatic mission', focus: ['sc', 'sites', 'sched'],
      blocks: [
        ['p', 'Every fetch spends a per-site budget. The scheduler allocates that budget by demand (watch counts) and volatility (how often prices actually move), and the scraper fleet rotates identities and backs off at the first sign of defenses.'],
        ['bul', [
          'Parsers break weekly by design - selector health checks page a human before silent zeros poison history.',
          'A blocked site is a product outage: canary fetches detect blocks early, and the response is slow down, not push harder.',
          'Structured data (JSON-LD) beats DOM scraping wherever sites offer it - cheaper and sturdier.',
        ]],
      ],
    },
    {
      title: 'A drop worth waking someone for', focus: ['pd', 'tsdb', 'pn'],
      blocks: [
        ['p', 'Raw price feeds flicker: currency conversion, regional tests, sale-then-restore games. The detector compares against a smoothed baseline and recent variance - a genuine drop is sustained, significant and below the user\'s threshold.'],
        ['bul', [
          'Dedup per (user, product, price-level): one drop, one alert, however many scrapes confirm it.',
          'The alert races the deal: detection-to-push is a minutes budget, and the push includes the chart context.',
          'False alerts are churn: precision is the metric, and a missed marginal drop is the acceptable cost.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A scraper on a schedule, a history table, threshold alerts.',
    senior: 'Demand-weighted polite scheduling, parser health monitoring, baseline-based drop detection with dedup.',
    staff: 'Own the adversarial dynamics (blocks, defenses, identity rotation ethics), product-identity resolution across variants, and the precision economics of alerting.',
  },
},

'Ad Click Aggregator': {
  meta: 'adtech - hard - the count is the bill',
  overview: 'Count ad clicks at firehose scale and bill advertisers from the count. This is the exactly-once problem with money attached: every duplicate is overbilling, every loss is underbilling, and both are contract violations. Stream aggregation with dedup, fraud filtering and an OLAP serving layer.',
  scope: 'Click ingestion, dedup, windowed aggregation, fraud filtering and advertiser reporting. Ad serving/auctions and payment collection are below the line.',
  fr: {
    core: ['Ingest clicks at firehose rate', 'Deduplicate by click id across retries and replays', 'Aggregate into per-campaign time buckets', 'Serve advertiser reports and budgets from aggregates'],
    out: ['The ad auction itself', 'Invoicing and collection', 'Attribution modeling'],
  },
  nfr: {
    core: ['Billing-grade accuracy: exactly-once from click to aggregate', 'Ingest absorbs spikes without loss - backpressure, never drop', 'Fraud is filtered before billing but preserved as evidence', 'Reports lag seconds; invoices reconcile to the event log exactly'],
    out: ['Sub-second reporting - budget pacing needs seconds, not ms'],
  },
  nums: [['~1M/s', 'click peaks at platform scale'], ['0', 'tolerable double-bills'], ['minute', 'aggregation buckets'], ['seconds', 'of acceptable reporting lag']],
  entities: [
    ['Click', 'id + campaign + ts + context - the atom, idempotent by id'],
    ['Aggregate', 'campaign x minute counts and spend - what reports read'],
    ['Fraud verdict', 'billable or filtered, with the evidence retained'],
    ['Reconciliation', 'the proof that aggregates equal the deduped log'],
  ],
  apiIntro: 'The write side is a pixel/beacon endpoint; the read side is advertiser reporting.',
  api: [
    { dir: '->', name: 'POST /click', body: '{ clickId, campaignId, ctx } -> 204 (idempotent by clickId)' },
    { dir: '->', name: 'GET /campaigns/{id}/stats?window=', body: '-> { buckets: [{ ts, clicks, spend }] } - from OLAP' },
  ],
  dives: [
    {
      title: 'Exactly-once where it actually matters', focus: ['ing', 'dcache', 'agg'],
      blocks: [
        ['p', 'Browsers retry, networks replay, pipelines redeliver. Exactly-once is layered: ingest dedups by click id against a TTL cache sized to the retry horizon; the stream job checkpoints offsets with its state; the sink writes aggregates transactionally keyed by (campaign, bucket).'],
        ['bul', [
          'The dedup cache TTL only needs to outlive the retry window - hours, not forever; the log is the permanent truth.',
          'Aggregation state (counts per open bucket) snapshots with the offsets - crash recovery replays into identical results.',
          'Reconciliation jobs re-count the sealed log daily and must match billing aggregates to the click.',
        ]],
        ['warn', 'Every "at-least-once plus dedup somewhere later" shortcut becomes an overbilling dispute with logs as evidence. The layering is the contract.'],
      ],
    },
    {
      title: 'Fraud: filter the bill, keep the evidence', focus: ['fr', 'adb'],
      blocks: [
        ['p', 'Click farms and bots inflate spend. The fraud model scores clicks inline off the stream; filtered clicks leave the billable path but land in the aggregates flagged - advertisers see them as filtered, disputes replay them with the features that damned them.'],
        ['bul', [
          'Filtering is pre-billing, never post - clawing back invoiced money is a legal process, not an update.',
          'The model gets a strict compute budget; on overload, conservative rules hold the line.',
          'Filtered-rate anomalies alert both ways: a spike is an attack, a collapse is a broken model billing bots.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Ingest to a stream, windowed counts, a reporting store.',
    senior: 'Layered exactly-once (idempotent ingest, checkpointed aggregation, transactional sink), inline fraud with evidence.',
    staff: 'Design the reconciliation regime that proves the bill, the dedup horizon economics, and the dispute-replay story.',
  },
},

'FB Post Search': {
  meta: 'consumer - hard - index at write speed, search at permission time',
  overview: 'Search over a social feed: posts become searchable seconds after posting, and every result must respect who can see what at the moment of the query. The write side is a streaming indexing pipeline; the read side is retrieval + permission filtering + ranking under one latency budget.',
  scope: 'Post ingestion to index, sharded retrieval, permission-aware serving and ranking. Ads in search, media understanding and comment search are below the line.',
  fr: {
    core: ['Index new posts within seconds', 'Retrieve by keywords across shards', 'Filter every result by the searcher\'s visibility', 'Rank by relevance, recency and engagement'],
    out: ['Comment and media-content search', 'Search ads', 'Trending detection'],
  },
  nfr: {
    core: ['Freshness in seconds - stream indexing, never batch rebuilds', 'Visibility is evaluated at query time; the index never leaks through staleness', 'Recent shards absorb both write and query heat', 'One latency budget covers retrieve + filter + rank'],
    out: ['Global exhaustive recall - social search is top-k, not archive search'],
  },
  nums: [['seconds', 'post-to-searchable'], ['time + term', 'the two sharding axes'], ['100%', 'of results permission-checked at query time'], ['1 budget', 'for retrieve, filter, rank together']],
  entities: [
    ['Post document', 'tokenized text + author + audience descriptor + ts'],
    ['Index shard', 'a time-bounded term partition; recent = hot'],
    ['Audience descriptor', 'the compact visibility encoding filtered at query time'],
    ['Ranked result', 'relevance x recency x engagement, post-filter'],
  ],
  apiIntro: 'One query endpoint; the indexing pipeline is internal.',
  api: [
    { dir: '->', name: 'GET /search?q=&cursor=', body: '-> { results[], nextCursor } - filtered for the caller, ranked' },
  ],
  dives: [
    {
      title: 'Permissions at query time, hints in the index', focus: ['qs', 'se'],
      blocks: [
        ['p', 'Baking visibility into the index goes stale the moment someone unfriends or a post\'s audience changes. Instead the index stores a compact audience descriptor (public / friends-of-author / list id), and the query service filters candidates against the searcher\'s relationship set before ranking.'],
        ['bul', [
          'Coarse index-side pruning (public vs restricted) cuts candidates cheaply; exact checks run on the survivors.',
          'The searcher\'s relationship set loads once per query from cache, not per candidate.',
          'Fail closed: a permission-service timeout hides restricted candidates rather than gambling.',
        ]],
        ['warn', 'A leak here is not a bug, it is a headline. The filter is the one stage that never gets budget-cut under load.'],
      ],
    },
    {
      title: 'Time-sharded heat', focus: ['iw', 'se', 'k'],
      blocks: [
        ['p', 'Social queries skew overwhelmingly recent, and writes are only recent. Sharding by time bucket x term hash concentrates both on the newest shards - which therefore run on the best hardware with the most replicas, while older shards compact and cool.'],
        ['bul', [
          'Index writers consume the post stream per partition; a post is searchable when its segment flushes - seconds.',
          'Queries fan out newest-first and can return early when top-k stabilizes - deep history only pages in on demand.',
          'Edits and deletes are tombstones applied at merge; deletes also purge caches synchronously (legal, not optional).',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A stream-fed inverted index, keyword retrieval, some ranking.',
    senior: 'Time x term sharding with hot-recent tiers, query-time permission filtering that fails closed, early-terminating top-k.',
    staff: 'Design the audience-descriptor encoding and its staleness story, the delete/tombstone compliance path, and the budget split across retrieve/filter/rank.',
  },
},

'Online Chess': {
  meta: 'gaming - hard - authoritative state, tiny and precious',
  overview: 'Chess.com-shaped: millions of concurrent games, each a tiny state machine (board + clocks) where the server is the referee. Realtime moves over sockets, authoritative validation, rating updates and a complete archive - plus matchmaking that trades wait time against fairness.',
  scope: 'Live game serving, move validation, clocks, matchmaking, ratings and archive. Anti-cheat analysis, tournaments and streaming/spectator chat are below the line.',
  fr: {
    core: ['Pair players by rating via matchmaking', 'Validate every move server-side and relay it', 'Run authoritative clocks with increment rules', 'Update ratings and archive every game'],
    out: ['Engine-based cheat detection (offline)', 'Tournament brackets', 'Spectator chat'],
  },
  nfr: {
    core: ['Move relay latency low enough for blitz (~100ms budget)', 'A game server death is a reconnect, not a lost game', 'Clocks are server-authoritative; latency compensation is bounded policy', 'Ratings are deterministic from the game log'],
    out: ['Global single-region play - regional pools keep latency fair'],
  },
  nums: [['~10M', 'games a day at scale'], ['~KB', 'of state per live game'], ['~100ms', 'move relay budget for blitz'], ['2', 'clocks, both owned by the server']],
  entities: [
    ['Game', 'board, move list, clocks, result - tiny and authoritative'],
    ['Move', 'validated against rules and clock before relay'],
    ['Rating', 'Elo/Glicko per time control, updated from results'],
    ['Match ticket', 'a queued search: rating window widening over wait time'],
  ],
  apiIntro: 'Sockets for play; REST for everything at rest.',
  api: [
    { dir: '<->', name: 'WS /game/{id}', body: 'move { from, to, promo? } -> relay { move, clocks } | reject { reason }' },
    { dir: '->', name: 'POST /matchmaking', body: '{ timeControl } -> { ticketId } ... paired event on the socket' },
    { dir: '->', name: 'GET /players/{id}/games?cursor=', body: '-> { games[] } - moves, not board snapshots' },
  ],
  dives: [
    {
      title: 'The server is the referee', focus: ['gs', 'gcache'],
      blocks: [
        ['p', 'Clients render; the server rules. Every move validates against the authoritative board and the mover\'s clock; the relayed message carries updated clocks so both clients converge on the server\'s truth. Live state is a kilobyte in memory, checkpointed on every move.'],
        ['bul', [
          'A game server crash loses nothing: the checkpoint replays, clocks resume with a grace adjustment, sockets reconnect to the new home.',
          'Latency compensation is bounded policy (small per-move grace), never client-claimed timestamps.',
          'Disconnect handling is product policy the state machine encodes: grace window, abandonment, auto-loss.',
        ]],
      ],
    },
    {
      title: 'Matchmaking: fairness on a widening window', focus: ['mm'],
      blocks: [
        ['p', 'A ticket enters the pool for its time control; the matcher pairs within a rating window that widens as wait grows. Blitz pools are deep and pair in seconds; odd hours and extreme ratings wait longer or accept wider gaps - a curve, not a constant.'],
        ['bul', [
          'Pools partition by time control and region - latency fairness is part of match quality.',
          'Pairing is atomic: two tickets leave the pool exactly once, or a race gives one player two boards.',
          'Rematch and friend challenges bypass the pool but reuse the same game-creation transaction.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Socket relay, server-side validation, a ratings table.',
    senior: 'Checkpointed authoritative state with crash-safe reconnect, bounded latency compensation, widening-window matchmaking.',
    staff: 'Design the disconnect/abandonment state machine, regional pool partitioning, and deterministic rating replay from the archive.',
  },
},

'GitHub Actions': {
  meta: 'devtools - hard - a compute platform wearing a CI costume',
  overview: 'CI/CD as a product: strangers push YAML, the platform materializes clean VMs, runs their arbitrary code, streams the logs live and throws the machines away. Under the workflow surface it is a scheduling and isolation platform where caching is the economics and fairness is the SLA.',
  scope: 'Workflow triggering, job scheduling, ephemeral runners, log streaming, artifacts and caching. Marketplace actions review, self-hosted runner fleets and billing are below the line.',
  fr: {
    core: ['Trigger workflows from repo events', 'Schedule jobs onto ephemeral, isolated runners', 'Stream logs live during execution', 'Persist artifacts and restore caches across runs'],
    out: ['Actions marketplace curation', 'Self-hosted runner management', 'Usage billing'],
  },
  nfr: {
    core: ['Isolation is absolute: a fresh VM per job, destroyed after - secrets and neighbors are unreachable', 'Queue-to-start latency is the felt performance; pre-warmed pools hide VM boot', 'Per-org concurrency fairness - one monorepo cannot starve the region', 'Log streaming works for 100k concurrent jobs'],
    out: ['Bit-for-bit reproducible builds - that is the user\'s job; the platform gives clean rooms'],
  },
  nums: [['1 VM', 'per job, never reused'], ['seconds', 'of queue-to-start via warm pools'], ['GBs', 'of cache per repo deciding build speed'], ['100k+', 'concurrent log streams']],
  entities: [
    ['Workflow run', 'the DAG instance a push creates'],
    ['Job', 'the schedulable unit: one runner, steps in sequence'],
    ['Runner', 'a pre-warmed ephemeral VM claimed by exactly one job'],
    ['Cache entry', 'keyed restore data scoped to a repo - the economics'],
  ],
  apiIntro: 'Triggers come from git events; humans mostly watch. The socket is the log tail.',
  api: [
    { dir: '<-', name: 'webhook push/pr', body: '{ repo, ref, sha } -> workflow runs materialize from YAML' },
    { dir: '->', name: 'GET /runs/{id}', body: '-> { jobs: [{ status, runner?, startedAt }] }' },
    { dir: '<->', name: 'WS /jobs/{id}/logs', body: 'live log frames while running; replay from storage after' },
  ],
  dives: [
    {
      title: 'Ephemeral runners: isolation as the product', focus: ['run', 'q', 'reg'],
      blocks: [
        ['p', 'Every job executes code the platform must assume is hostile - including the dependencies it installs. One job, one fresh VM from a pre-warmed pool, destroyed on completion. Nothing survives to the next job: no filesystem, no processes, no secrets residue.'],
        ['bul', [
          'Warm pools per image (ubuntu-latest et al) hide the boot; pool sizing follows the demand curve by hour.',
          'Secrets inject at claim time, scoped to the job, and die with the VM.',
          'Claim is atomic: one runner, one job - a double-claim runs someone\'s deploy twice.',
        ]],
        ['warn', 'Runner reuse is the tempting optimization that becomes a cross-tenant compromise. The destroy step is the security model.'],
      ],
    },
    {
      title: 'Caching is the economics; fairness is the SLA', focus: ['art', 'k', 'sw'],
      blocks: [
        ['p', 'A cold dependency install turns a 2-minute build into 20 - caching keyed on lockfiles is what makes hosted CI viable, and it must be scoped per repo so a cache poisoning stays in its repo. Meanwhile per-org concurrency caps at the queue keep one hot monorepo from absorbing the fleet.'],
        ['bul', [
          'Cache keys: repo-scoped, content-addressed by lockfile hash, size-capped with LRU eviction.',
          'Fairness lives at admission (cheap) not the scheduler (research project) - same lesson every multi-tenant queue learns.',
          'Logs flow job -> event stream -> live socket tails, and to storage for replay; status fan-out (checks, badges) consumes the same stream.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A job queue, VMs that run steps, logs and artifacts stored.',
    senior: 'Warm-pooled ephemeral isolation with atomic claim, repo-scoped content-addressed caching, admission-level fairness.',
    staff: 'Threat-model the runner lifecycle (secrets, reuse, escape), design pool economics against the daily demand curve, and the 100k-stream log path.',
  },
},


'Astrotalk': {
  meta: 'India - consumer marketplace - medium - the product is a metered minute',
  overview: 'Astrology consultations over chat and call, billed per minute against a prepaid wallet. The interesting engineering is that the billable unit is time on a live socket: the session broker must meter minutes exactly once while the connection wobbles, the wallet drains, and the astrologer\'s queue of waiting seekers grows.',
  scope: 'Discovery and matching, presence and queues, the metered session with wallet billing, and kundli generation. Payments-in, live streaming events and the astrologer payout ledger are below the line.',
  fr: {
    core: ['Discover astrologers by skill, language, rating and price per minute', 'Show live availability and join a wait queue', 'Run chat/call sessions metered per minute against the wallet', 'Generate kundli (birth charts) from birth details'],
    out: ['Wallet top-up rails', 'Live streaming sessions', 'Astrologer payouts and settlements'],
  },
  nfr: {
    core: ['Billing ticks are exactly-once - a doubled minute is a refund and a review', 'Presence is honest: an offline astrologer never sells a session', 'A session survives a network blip without double-metering the gap', 'Kundli compute is deterministic and cached forever'],
    out: ['Video quality engineering - the call rides a standard RTC provider'],
  },
  nums: [['per minute', 'the billable unit'], ['~Rs 20-50', 'a typical per-minute rate'], ['1 queue', 'per astrologer - the marketplace scarcity'], ['0', 'tolerable double-billed minutes']],
  entities: [
    ['Astrologer', 'profile, skills, rate per minute, live status and a queue'],
    ['Session', 'one metered conversation: reserve -> tick -> settle'],
    ['Wallet', 'prepaid ACID balance; every tick debits it'],
    ['Kundli', 'a deterministic chart computed from birth data - cache key: the birth data itself'],
  ],
  apiIntro: 'REST for discovery and session control; the socket carries the conversation while billing ticks flow server-side.',
  api: [
    { dir: '->', name: 'GET /astrologers?skill=&lang=', body: '-> { list: [{ id, ratePerMin, status, queueLen }] }' },
    { dir: '->', name: 'POST /sessions', body: '{ astrologerId }\n-> { sessionId, reservedMins } | 402 low balance | 409 queue joined' },
    { dir: '<->', name: 'WS /sessions/{id}', body: 'chat frames + call signaling; server emits minute ticks and remaining balance' },
  ],
  dives: [
    {
      title: 'Metering a minute exactly once on a flaky socket', focus: ['sess', 'k', 'bw', 'wal'],
      blocks: [
        ['p', 'The broker owns the clock, never the client: session start reserves a few minutes of wallet balance, then a server-side timer emits one tick per elapsed minute onto the billing stream with (sessionId, minuteIndex) as the idempotency key. The biller debits each tick once; hangup settles - used minutes stay debited, the rest of the reserve releases.'],
        ['bul', [
          'A reconnect resumes the same session and the same minute counter - the gap was still consultation time, and the meter never depended on the socket.',
          'Ticks are exactly-once by key, not by hope: replays collapse in the biller, and the wallet row is the only ACID surface.',
          'Balance-exhausted mid-session is a product moment the state machine encodes: warn at two minutes, pause at zero, never overdraw.',
        ]],
        ['warn', 'Metering on the client clock, or on socket liveness, bills the network instead of the consultation. The server timer plus idempotent ticks is the entire trust model of the product.'],
      ],
    },
    {
      title: 'Presence and queues: selling scarcity honestly', focus: ['pres', 'disc'],
      blocks: [
        ['p', 'The marketplace sells access to a specific human, so the astrologer\'s live status and queue length are the inventory. Presence lives in a cache updated by heartbeats; a missed heartbeat flips status before a seeker can buy a session that cannot start.'],
        ['bul', [
          'Queues are per astrologer and position is visible - waiting is tolerable when it is honest, churn when it is not.',
          'One session at a time per astrologer: session start atomically claims the astrologer or joins the queue, never both.',
          'Discovery ranks by a blend of rating, response rate and availability - an online mediocre astrologer outranks an offline great one right now, by design.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Discovery, a session flow with wallet debits, chat over a socket.',
    senior: 'Server-owned metering with reserve-then-settle, idempotent minute ticks, heartbeat-honest presence with atomic claim-or-queue.',
    staff: 'Design the disconnect and balance-exhaustion state machine end to end, the refund and dispute path off the tick log, and queue fairness for celebrity astrologers.',
  },
},


'Object Storage (S3)': {
  meta: 'Cloud business - storage - hard - durability is arithmetic',
  overview: 'Design the bucket itself: a metadata store that maps keys to shard locations, a placement service that decides where bytes live, erasure-coded storage pods, and a repair loop that rebuilds lost shards before a second failure can land. The request path is boring on purpose; the durability math is the product.',
  scope: 'PUT/GET/LIST, metadata, placement, erasure coding, repair, and the per-prefix throughput contract. Multi-region replication, lifecycle tiering and billing are below the line.',
  fr: {
    core: ['PUT and GET objects by key with strong read-after-write on new keys', 'LIST by prefix, ordered', 'Survive disk, host and rack loss with no data loss', 'Emit an event per mutation'],
    out: ['Cross-region replication', 'Storage classes and lifecycle', 'Static website hosting'],
  },
  nfr: {
    core: ['Eleven nines of durability - engineered, then continuously re-earned by repair speed', 'Per-prefix request throughput is a stated contract, not a surprise', 'GET p99 in low tens of ms for hot metadata', 'The metadata tier survives being 1000x smaller than the data it indexes'],
    out: ['Sub-ms latency - that is the cache in front, not the store'],
  },
  nums: [['11 nines', 'durability target - about one object lost per 10M objects per 10K years'], ['k+m', 'erasure shards: any k of k+m rebuild the object'], ['per prefix', 'where the throughput contract lives'], ['minutes', 'repair budget after a disk dies']],
  entities: [
    ['ObjectMeta', 'key -> version, size, checksum, shard map - one point lookup per GET'],
    ['Shard', 'one erasure fragment on one pod; k of k+m reconstruct'],
    ['PlacementPolicy', 'spread shards across pods, racks and heat - space is easy, heat is the game'],
    ['RepairTask', 'a dead shard with a deadline - the durability promise made operational'],
  ],
  apiIntro: 'The S3 API is the de facto standard, so the interface is a given; the design freedom is entirely behind it.',
  api: [
    { dir: '->', name: 'PUT /{bucket}/{key}', body: 'bytes + checksum\n-> 200 { version, etag } after k+m shards land' },
    { dir: '->', name: 'GET /{bucket}/{key}', body: '-> bytes streamed from any k shards; metadata lookup first' },
    { dir: '->', name: 'GET /{bucket}?prefix=', body: '-> ordered keys - a range scan on the metadata KV' },
  ],
  dives: [
    {
      title: 'Durability as arithmetic: erasure coding plus a repair deadline', focus: ['pods', 'rep', 'plc'],
      blocks: [
        ['p', 'Replication triples your bill; erasure coding does not. Split an object into k data shards plus m parity shards - any k reconstruct it - and spread them across pods in different racks. Durability then has two knobs: how many simultaneous failures m tolerates, and how fast repair rebuilds a lost shard before the next failure arrives.'],
        ['bul', [
          'k=8, m=4 survives any four shard losses at 1.5x storage overhead - versus 3x for triple replication.',
          'The repair loop is the durability engine: a dead disk starts a countdown, and rebuild speed - not shard count - is what the nines actually rest on.',
          'Checksums travel with every shard; scrubbers read cold data on a schedule so bit rot is found while repair is still cheap.',
        ]],
        ['warn', 'Durability calculated at design time and never re-earned is fiction. Slow repair quietly converts eleven nines into five - the number to watch is shards-at-risk-minutes, and the SLO tab thinking applies to it directly.'],
      ],
    },
    {
      title: 'The metadata KV: tiny, and the entire hot path', focus: ['meta', 'fe', 'cache'],
      blocks: [
        ['p', 'Every GET is one metadata point-lookup then parallel shard reads; every LIST is a prefix range scan. So the metadata store is a partitioned, replicated KV holding key -> shard map, roughly a thousandth of the data size and a hundred percent of the latency budget.'],
        ['bul', [
          'Partition metadata by key range so LIST stays a single-partition scan; hot prefixes are the famous footgun - the per-prefix contract exists because a partition has a ceiling.',
          'New-key read-after-write falls out of writing metadata last: shards land, then the map, so a visible key always resolves.',
          'The hot object cache in front serves the skew: the head of the distribution never touches pods at all.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Key-value metadata plus replicated blobs behind an API.',
    senior: 'Erasure coding with placement across failure domains, repair as the durability engine, prefix-partitioned metadata with the throughput contract stated.',
    staff: 'Size the repair fleet against disk failure rates to defend the nines, design the hot-prefix mitigation story, and make the event stream exactly-once so downstream lifecycle and replication can trust it.',
  },
},

'Serverless Platform (Lambda)': {
  meta: 'Cloud business - compute - hard - selling milliseconds with nothing to manage',
  overview: 'Design the function runner: an invoke front that answers in milliseconds, a scheduler placing calls onto warm microVM sandboxes, a fleet that boots more when arrival rate says so, and strict per-invoke isolation because neighbors share hardware. The whole business is amortizing the cold-start tax across a warm pool.',
  scope: 'Sync and async invokes, scheduling, warm pools, the microVM fleet and code distribution. Runtimes catalogue, VPC networking and per-account limits are below the line.',
  fr: {
    core: ['Invoke a function synchronously and return its result', 'Queue async invokes with retries and a DLQ', 'Scale concurrency with arrival rate, to zero when idle', 'Bill per request and per ms of execution'],
    out: ['Long-running jobs - that is a different product', 'GPU functions', 'Cross-cloud portability'],
  },
  nfr: {
    core: ['Warm invoke overhead in single-digit ms; cold starts bounded and rare', 'Hard isolation between tenants sharing a host', 'A sandbox crash costs one invoke, never a neighbor', 'Honest concurrency limits per account - noisy neighbors stay theoretical'],
    out: ['Bare-metal latency - the microVM boundary is the price of the product'],
  },
  nums: [['~125ms', 'a microVM boot - the irreducible part of a cold start'], ['1 invoke', 'per sandbox at a time - concurrency = warm sandboxes'], ['ms', 'the billing grain'], ['0', 'acceptable cross-tenant memory sharing']],
  entities: [
    ['Function', 'code + config + limits; versions are immutable'],
    ['Sandbox', 'one microVM bound to one function version, warm between invokes'],
    ['Invoke', 'one request through one sandbox: placed, executed, billed'],
    ['WarmPool', 'per-function count of ready sandboxes - the cold-start amortizer'],
  ],
  apiIntro: 'One verb sells the product; everything else is management plane.',
  api: [
    { dir: '->', name: 'POST /functions/{name}/invoke', body: '{ payload }\n-> 200 result | 202 queued (async) | 429 concurrency limit' },
    { dir: '->', name: 'PUT /functions/{name}', body: '{ codeRef, memory, timeout } -> new immutable version' },
  ],
  dives: [
    {
      title: 'The cold-start ledger: warm pools as the whole business', focus: ['ctrl', 'wp', 'sbx'],
      blocks: [
        ['p', 'A cold start pays microVM boot plus runtime init plus code load; a warm invoke pays almost nothing. The scheduler therefore keeps a per-function warm pool sized by recent arrival rate: place onto warm first, boot on miss, retire idle sandboxes to zero. The margin of the platform is exactly how often it predicts arrivals correctly.'],
        ['bul', [
          'Placement is bin-packing with a heat term: fill hosts without correlating one customer\'s spike into another\'s latency.',
          'Scale-to-zero is the pricing promise and the engineering constraint - the first invoke after silence always pays the boot, so pre-warm on deploy and on schedule hints.',
          'Async invokes drain from the queue into the same fleet at lower priority - one capacity pool, two SLOs.',
        ]],
        ['warn', 'A warm pool sized on averages melts under bursts: arrival spikes are exactly when cold boots are slowest to help. Size on p95 arrival rate and let the queue absorb what the pool cannot.'],
      ],
    },
    {
      title: 'Isolation you can sell: one microVM per concurrent invoke', focus: ['sbx', 'code'],
      blocks: [
        ['p', 'Multi-tenant compute is only a business if the boundary is credible. Containers share a kernel; microVMs (Firecracker-class) give each concurrent invoke its own minimal virtual machine at ~125ms boot and tiny overhead - the sandbox capacity numbers in this canvas ARE that isolation tax, honestly priced.'],
        ['bul', [
          'One function version per sandbox, reused across invokes of the same function - warm state is a feature and a bounded risk.',
          'Code and layers pull from the blob store once per sandbox, then cache locally - deploy storms hit the code store, not the invoke path.',
          'The blast radius contract: a crash kills one invoke; an escape attempt meets a VM boundary, not a namespace.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'An API that runs code in containers with a queue for async.',
    senior: 'Warm-pool scheduling against arrival rate, microVM isolation with the cold-start tax stated, one fleet serving sync and async at different priorities.',
    staff: 'Design the predictive warm-pool policy and its failure under bursts, the per-account fairness system, and the billing pipeline that meters milliseconds exactly-once at platform scale.',
  },
},

'CDN (Edge Network)': {
  meta: 'Cloud business - network - medium - the hit ratio is the product',
  overview: 'Design the CDN itself: anycast steers every eyeball to the nearest PoP, two cache tiers keep misses off customer origins, and a purge system broadcasts invalidations to every PoP in seconds. The product is a ratio - every point of cache hit rate is origin traffic the customer never pays for.',
  scope: 'Anycast routing, PoP caching, origin shield, config and purge propagation. TLS termination details, WAF rules and video-specific delivery are below the line.',
  fr: {
    core: ['Serve cached content from the nearest PoP', 'Collapse PoP misses onto an origin shield before the customer origin', 'Propagate config changes and purges globally in seconds', 'Report hit ratio and egress per customer'],
    out: ['Edge compute - a sibling product on the same PoPs', 'DDoS scrubbing specifics', 'Private backbone economics'],
  },
  nfr: {
    core: ['A PoP failure reroutes by anycast withdrawal - users never see it', 'Purge lands globally in seconds, or stale content becomes a support ticket', 'Origin sees one fetch per object per shield, not one per PoP', 'PoPs run unattended in hostile colos - loss of any one is routine'],
    out: ['Strong consistency between PoPs - caches are eventual by nature and by design'],
  },
  nums: [['~95%+', 'a healthy hit ratio on static content'], ['1 fetch', 'per object per shield on a miss storm'], ['seconds', 'the purge propagation budget'], ['dozens-hundreds', 'of PoPs, each expendable']],
  entities: [
    ['PoP', 'an edge site: cache fleet + anycast announcement, disposable as a unit'],
    ['CacheEntry', 'object + headers + TTL + surrogate keys for purging'],
    ['CustomerConfig', 'origin, rules, cache keys - versioned and broadcast'],
    ['Purge', 'a surrogate-key tombstone racing user traffic to every PoP'],
  ],
  apiIntro: 'The data plane speaks plain HTTP; the control plane is where the API lives.',
  api: [
    { dir: '->', name: 'GET {any customer URL}', body: 'served by the nearest PoP; miss -> shield -> origin, then cached' },
    { dir: '->', name: 'POST /purge', body: '{ surrogateKeys | urls }\n-> 202, globally effective in seconds' },
    { dir: '->', name: 'PUT /config/{site}', body: 'versioned rules -> broadcast to all PoPs, atomic per version' },
  ],
  dives: [
    {
      title: 'Two tiers and a promise: shield economics', focus: ['pc', 'shield', 'orig'],
      blocks: [
        ['p', 'With hundreds of PoPs, a cold object would otherwise hit the customer origin hundreds of times - once per PoP. The origin shield is a designated mid-tier: PoP misses collapse onto it, it fetches once, and every PoP fills from that single copy. Request coalescing at both tiers turns a miss storm into one origin fetch.'],
        ['bul', [
          'Shield placement is a routing choice: pick a PoP near the origin so the long haul happens once, on the fat pipe.',
          'Coalescing (one in-flight fetch per key, everyone else waits on it) is the same cache-stampede defense the Redis template teaches - at planetary scale.',
          'Hit ratio is tiered honestly: edge hit, shield hit, origin fetch - customers pay for the third, so the dashboard leads with it.',
        ]],
      ],
    },
    {
      title: 'Purge: a broadcast racing the truth', focus: ['cfg', 'k', 'pop'],
      blocks: [
        ['p', 'A purge is a promise that stale content dies everywhere in seconds. Implement it as a tombstone on a fanout stream every PoP consumes: content is tagged with surrogate keys at fill time, and a purge publishes the key - each PoP invalidates locally, no central coordination on the hot path.'],
        ['bul', [
          'Soft purge (mark stale, revalidate on next hit) keeps serving during origin trouble; hard purge is for legal and secrets.',
          'A PoP that was offline replays the stream from its last offset on rejoin - purges are a log, not an RPC, precisely so absence is survivable.',
          'Config versions ride the same stream: a PoP is either fully on version N or N+1, never a mix of rules.',
        ]],
        ['warn', 'Purge by URL alone cannot invalidate variants (compressed, per-device, per-header). Surrogate keys attached at fill time are the only purge primitive that scales - retrofitting them later means a full cache flush per mistake.'],
      ],
    },
  ],
  bar: {
    mid: 'Geo-routed caches in front of origins with TTLs.',
    senior: 'Anycast PoPs, shield-tier collapse with request coalescing, purge as a replayable fanout log with surrogate keys.',
    staff: 'Design the anycast withdrawal and capacity-spill story for PoP loss, the purge SLO measurement itself, and the hit-ratio economics that decide where the next PoP gets built.',
  },
},


'LLM API Platform (FastAPI)': {
  meta: 'GenAI - platform - medium-hard - accept fast, answer slow',
  overview: 'The production shape of nearly every LLM product: an async Python API that validates and enqueues in milliseconds, a worker fleet that drains the queue against provider rate limits, and Redis carrying both results and rate state so tokens can stream back over SSE while the worker is still generating. The whole design exists because the provider is slow, expensive and rate-limited - and users are none of those things.',
  scope: 'The request lifecycle from validated input to streamed tokens, queue-worker sizing, rate limiting, guardrails and usage telemetry. Model choice, fine-tuning and RAG retrieval are separate templates.',
  fr: {
    core: ['Accept a completion request, validate it (Pydantic contract), return a stream handle fast', 'Stream tokens to the client over SSE as the worker produces them', 'Enforce per-key rate limits and quotas', 'Record token usage per request for billing and evals'],
    out: ['Retrieval (see the RAG template)', 'Fine-tuning pipelines', 'Multi-provider routing'],
  },
  nfr: {
    core: ['API p99 in tens of ms - the slow part happens behind the queue', 'No request lost between accept and answer: the queue is durable, the worker idempotent', 'Provider outages degrade to honest 503s with retry-after, never to silent hangs', 'A runaway prompt cannot exhaust the fleet - budgets per request, per key, per tenant'],
    out: ['Sub-second completions - physics and the provider own that'],
  },
  nums: [['ms', 'accept-to-handle at the API'], ['~1s+', 'first token, provider-dependent'], ['rate-limit tier', 'what actually sizes the worker fleet'], ['tokens', 'the billing and budgeting unit']],
  entities: [
    ['CompletionJob', 'validated prompt + params + owner key; idempotency key = job id'],
    ['StreamState', 'tokens so far + done flag in Redis - the bridge between worker and SSE'],
    ['ApiKey', 'identity, quota, rate state - checked at the edge, settled in telemetry'],
    ['UsageRecord', 'tokens in/out, model, latency - one per job, feeding billing and evals'],
  ],
  apiIntro: 'The contract is async by design: POST returns a handle immediately; the stream endpoint replays and then follows.',
  api: [
    { dir: '->', name: 'POST /v1/completions', body: '{ prompt, params }\n-> 202 { jobId, stream: /v1/stream/{jobId} } | 429 quota' },
    { dir: '<-', name: 'GET /v1/stream/{jobId} (SSE)', body: 'data: {token}\n... data: [DONE] - replays from Redis, then follows live' },
    { dir: '->', name: 'GET /v1/jobs/{jobId}', body: '-> { status, usage } - the non-streaming truth' },
  ],
  dives: [
    {
      title: 'Accept fast, answer slow: the queue is the product', focus: ['api', 'q', 'lw', 'cache'],
      blocks: [
        ['p', 'The API does three cheap things - validate, authorize, enqueue - and returns a handle. Workers drain the queue at exactly the rate the provider allows, writing tokens into Redis as they arrive; the SSE endpoint replays what exists and follows what comes. Client experience decouples from provider behavior: bursts queue instead of failing, and a provider hiccup shows as delay, not loss.'],
        ['bul', [
          'Backpressure is a number, not a vibe: queue depth over drain rate is your wait time - show it, and shed with 429 + retry-after past a threshold.',
          'Worker idempotency rides the job id: a retried job overwrites its own stream state, never doubles a completion or a bill.',
          'Streaming through Redis (not worker-to-client sockets) means workers stay stateless and any API replica can serve any stream.',
        ]],
        ['warn', 'Calling the provider synchronously from the API thread is the classic first version - it works until the first burst, then every slow completion holds an API worker hostage and p99 explodes. The queue is not an optimization; it is the architecture.'],
      ],
    },
    {
      title: 'Sizing by rate-limit arithmetic, guarding both directions', focus: ['lw', 'prov', 'guard'],
      blocks: [
        ['p', 'The worker fleet is sized by provider math, not CPU: tier limit in requests-per-minute and tokens-per-minute, divided by per-request cost, times a safety factor. CPU graphs will look idle while the real ceiling - the rate limit - is saturated.'],
        ['bul', [
          'Budget per request before it runs: max tokens, max tool depth, max wall clock - a runaway prompt dies at its cap, not at your invoice.',
          'Guardrails wrap both directions: prompt-injection and jailbreak screens on the way in, PII and policy filters on the way out - and the filter result lands in telemetry.',
          'Usage records are exactly-once by job id and reconciled daily against the provider bill - the platform that cannot explain its invoice has no margin.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'An API in front of an LLM with a queue somewhere.',
    senior: 'Accept-enqueue-stream with Redis as the token bridge, worker fleet sized from rate-limit arithmetic, budgets per request and key, guardrails both directions.',
    staff: 'Design the degraded modes (provider brownout, queue backlog, poison prompts), the exactly-once usage pipeline that survives retries, and the multi-tenant fairness story when one key floods the queue.',
  },
},

'Agentic Workflow (Tools)': {
  meta: 'GenAI - agents - hard - autonomy is graded, not granted',
  overview: 'An agent is a loop: the model proposes an action, typed tools execute it, observations return, repeat - under hard budgets for steps, tokens and time. The engineering is everything around the model: schema-validated tool calls, sandboxed execution for code, retrieval-shaped memory, and a human gate in front of anything irreversible.',
  scope: 'The plan-act-observe loop, tool registry and contracts, sandboxed execution, memory retrieval and approval flow. Model training and the tools own internals are out.',
  fr: {
    core: ['Run multi-step tasks: the model selects tools, the system executes and feeds back observations', 'Validate every tool call against its JSON schema before execution', 'Persist and retrieve task memory across steps', 'Route irreversible actions through human approval'],
    out: ['Multi-agent swarms', 'Tool marketplaces', 'Model choice and routing'],
  },
  nfr: {
    core: ['Bounded always: steps, tokens, wall clock and spend per task have hard caps', 'A malicious or hallucinated tool call cannot escape the schema or the sandbox', 'Every step is auditable: prompt, call, observation, decision - replayable end to end', 'Approval-gated actions fail closed when the human never answers'],
    out: ['Sub-second task completion - agents trade latency for capability by design'],
  },
  nums: [['3-15', 'typical tool-loop steps before answer or cap'], ['1 schema', 'per tool - the contract that makes calls executable'], ['~125ms', 'sandbox boot when a code tool fires'], ['100%', 'of irreversible actions behind the gate']],
  entities: [
    ['Task', 'goal + budgets + status; the unit of audit and billing'],
    ['Step', 'one loop turn: model output, validated call, observation'],
    ['Tool', 'name + JSON schema + executor + risk class (auto vs approval)'],
    ['Approval', 'a pending irreversible action awaiting a human - expiring, fail-closed'],
  ],
  apiIntro: 'Tasks are asynchronous conversations with an audit trail; the stream shows the loop thinking.',
  api: [
    { dir: '->', name: 'POST /tasks', body: '{ goal, budgets? }\n-> 202 { taskId, stream }' },
    { dir: '<-', name: 'GET /tasks/{id}/stream (SSE)', body: 'step events: plan, tool_call, observation, approval_needed, done' },
    { dir: '->', name: 'POST /approvals/{id}', body: '{ decision: approve | deny } - the human half of the loop' },
  ],
  dives: [
    {
      title: 'The loop with a budget: contracts before execution', focus: ['agent', 'llm', 'tools'],
      blocks: [
        ['p', 'The orchestrator owns the loop, the model only proposes. Each turn: assemble context (goal, recent steps, retrieved memory), get the models next action, validate it against the tools JSON schema, execute, append the observation. Budgets are checked every turn - steps, tokens, spend, clock - and the loop exits with its best answer when any cap trips.'],
        ['bul', [
          'Schema validation is the firewall: an unparseable or off-contract call becomes an error observation the model can correct - never an execution.',
          'The registry declares risk per tool: read-only tools auto-run; mutating ones log; irreversible ones stop the loop at the approval gate.',
          'Loop detection is cheap and vital: the same call with the same args twice is a nudge; three times ends the task honestly.',
        ]],
        ['warn', 'The failure mode is not the model going rogue - it is the loop with no exit: an agent burning tokens on a task it cannot finish. Budgets are not safety theater; they are the product working as designed.'],
      ],
    },
    {
      title: 'Blast radius engineering: sandbox, memory, and the human gate', focus: ['sbx', 'mem', 'hitl', 'guard'],
      blocks: [
        ['p', 'Code tools execute in microVM sandboxes - the agent can be creative because the blast radius is one disposable VM with no credentials and an allowlisted network. Memory is retrieval-shaped: embed and store observations, fetch only what is relevant to the current step, and never replay whole histories into the context window.'],
        ['bul', [
          'The sandbox boot (~125ms) is the price of trying arbitrary code safely - the same isolation tax the serverless template prices.',
          'Approvals fail closed: an expired request denies, a denied action returns to the loop as an observation the model must plan around.',
          'Guardrails screen the agents inputs and outputs like any LLM app - plus one more: tool observations are untrusted input too (a scraped page can carry an injection aimed at the loop).',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'An LLM that can call functions in a while loop.',
    senior: 'Schema-validated tools with risk classes, budget-bounded loop with detection, sandboxed code execution, retrieval memory, fail-closed approvals.',
    staff: 'Design the audit-and-replay system, the injection story for untrusted observations, and the graded-autonomy policy that decides which actions ever leave the approval gate.',
  },
},


'Card Payments (Auth + Settlement)': {
  meta: 'Fintech - payments core - hard - two phases, two truths',
  overview: 'Card payments are two systems wearing one API. Authorization is a real-time promise: in ~150ms the network asks the issuer whether funds exist and places a hold - nothing final happens. Settlement is the money actually moving: captures batched into clearing files, netted between banks, posted to an append-only ledger, and reconciled against what the network says happened. Most payment outages are auth problems; most payment disasters are settlement problems discovered on day three.',
  scope: 'The auth path (tokenization, network, issuer), the settlement pipeline (capture, clearing, netting, ledger, reconciliation), and idempotent money movement. Card-present EMV cryptography, disputes, and FX are out.',
  fr: {
    core: ['Authorize a payment in under 200ms with a hold on issuer funds', 'Capture and settle authorized payments in daily clearing cycles', 'Record every movement as balanced double-entry ledger rows', 'Reconcile internal ledger against network clearing files daily'],
    out: ['Chargebacks and disputes (a workflow system of its own)', 'FX and multi-currency settlement', 'Card issuing'],
  },
  nfr: {
    core: ['A retried request can never move money twice - idempotency keys on every mutation', 'The ledger is append-only: corrections are reversing entries, never edits', 'Auth availability is revenue: every minute down is checkout abandoned', 'PCI scope stays inside the vault - raw PANs never reach application servers'],
    out: ['Real-time settlement - T+1 batches are the industry floor, not a bug'],
  },
  nums: [['~150ms', 'auth round trip through network and issuer'], ['T+1', 'settlement cycle - money moves tomorrow'], ['2 rows', 'every movement: one debit, one credit, sum zero'], ['3-way', 'daily match: ledger vs network file vs bank statement']],
  entities: [
    ['Payment', 'the merchant-facing object: auth -> captured -> settled, with an idempotency key from birth'],
    ['Token', 'the HSM-issued stand-in for a PAN - what your systems are allowed to remember'],
    ['LedgerEntry', 'immutable debit or credit; balances are projections over these, never columns'],
    ['ClearingBatch', 'the day\'s captures, netted per counterparty, shipped as a file the network signs'],
  ],
  apiIntro: 'The API is honest about the two phases: auth returns fast with a hold, capture is the promise to settle, and status tells you which truth you are looking at.',
  api: [
    { dir: '->', name: 'POST /payments (Idempotency-Key: k)', body: '{ token, amount }\n-> 201 { id, status: authorized, hold } in ~150ms' },
    { dir: '->', name: 'POST /payments/{id}/capture', body: '-> 202 { status: capture_pending } - joins tonight\'s clearing batch' },
    { dir: '<-', name: 'GET /payments/{id}', body: '-> { status: authorized | captured | settled | reversed, ledger: [entries] }' },
  ],
  dives: [
    {
      title: 'The auth path: a promise in 150 milliseconds', focus: ['gw', 'auth', 'hsm', 'net', 'iss'],
      blocks: [
        ['p', 'The gateway tokenizes first: the PAN goes to the HSM and never returns - your services carry tokens, and PCI scope collapses from the whole fleet to one hardware vault. Auth then races the network: risk checks, issuer decisioning, and a funds hold, all inside the timeout a checkout page will tolerate.'],
        ['bul', [
          'Stand-in rules are the availability trick: when the issuer times out, the network can approve small amounts on its behalf - bounded risk traded for uptime.',
          'The hold is not money: it expires (usually 7 days), and capturing more than the hold is a different, slower conversation.',
          'Idempotency starts here: the same key replays the same auth result, so a merchant retry storm cannot double-hold a card.',
        ]],
      ],
    },
    {
      title: 'Settlement: where the money actually moves', focus: ['k', 'settle', 'led', 'recon'],
      blocks: [
        ['p', 'Captures stream onto a log; the settlement batch drains it nightly into clearing files. Netting is the quiet miracle - ten thousand transactions between two banks collapse into one transfer. Every movement lands in the ledger as a balanced pair, and reconciliation three-way-matches your ledger, the network file, and the bank statement every day.'],
        ['bul', [
          'Append-only is not a style choice: an UPDATEd balance has no history, and money without history is a lawsuit waiting for discovery.',
          'Recon drift is measured in items and paise - and it compounds silently, which is why it runs daily, not monthly.',
          'The batch is idempotent by batch-id: a rerun regenerates the same file, byte for byte, or refuses.',
        ]],
        ['warn', 'The classic disaster is not auth going down - everyone sees that in seconds. It is settlement drifting quietly: a mapping bug undercounting captures for three days, discovered when the bank statement disagrees. Reconciliation is not bookkeeping; it is the immune system.'],
      ],
    },
  ],
  bar: {
    mid: 'A gateway that calls a card network and saves transactions to a database.',
    senior: 'Tokenize at the edge, auth as a bounded promise with stand-in, capture through a log into netted T+1 clearing, append-only double-entry ledger, daily three-way reconciliation, idempotency on every mutation.',
    staff: 'Design the recon-drift detection and repair story, the batch idempotency and replay contract, the stand-in risk budget negotiation, and the migration path when a ledger schema must change under money that never stops moving.',
  },
},

'Fraud Detection (Real-time)': {
  meta: 'Fintech - risk/ML - hard - adversarial, inside someone else\'s latency budget',
  overview: 'A fraud system scores every transaction inside the authorization path - a ~50ms guest in someone else\'s 150ms budget. It blends features nobody can precompute (velocity: how many times has this card transacted in the last minute) with features nobody can compute live (spending profiles from the feature store), runs a model, and then lets a rules engine hold the veto, because regulators want declines a human can explain. And unlike every other ML system in this studio, the adversary reads your behavior and adapts.',
  scope: 'Real-time scoring in the auth path, velocity features, the model-plus-rules decision, case management, and the chargeback feedback loop. Model training internals and dispute workflows are out.',
  fr: {
    core: ['Score every transaction within the auth latency budget', 'Maintain per-card and per-merchant velocity counters updated on every event', 'Route suspicious transactions to declines, step-up auth, or manual review cases', 'Feed chargeback labels back into training'],
    out: ['Dispute resolution workflow', 'Identity verification (KYC) - upstream of this system'],
  },
  nfr: {
    core: ['p99 score latency under ~50ms - a slow yes is a lost sale', 'Fail open or fail closed is a POLICY decision per merchant tier, not an accident', 'Every decline carries an explainable reason code', 'Feature freshness measured in seconds for velocity, hours for profiles'],
    out: ['Perfect precision - blocking all fraud is trivial: decline everything. The business lives in the trade-off'],
  },
  nums: [['~50ms', 'the scoring budget inside the auth path'], ['seconds', 'velocity feature freshness'], ['weeks', 'label latency - chargebacks arrive that late'], ['bps', 'fraud is measured in basis points of volume']],
  entities: [
    ['ScoreRequest', 'transaction context + features assembled at decision time'],
    ['VelocityCounter', 'sliding-window counts per card/merchant/device - write-heavy cache rows'],
    ['Decision', 'approve | decline | review, with model score AND the rule that fired'],
    ['Label', 'the ground truth that arrives weeks late as a chargeback'],
  ],
  apiIntro: 'One synchronous call in the auth path; everything else is streams.',
  api: [
    { dir: '->', name: 'POST /score', body: '{ txn, card_token, merchant }\n-> 200 { decision, score, reason_code } in <50ms' },
    { dir: '<-', name: 'POST /labels (async)', body: '{ txn_id, outcome: chargeback | confirmed_good } - weeks later, via the feedback log' },
  ],
  dives: [
    {
      title: 'Features on a latency loan', focus: ['gw', 'vel', 'fs', 'ml'],
      blocks: [
        ['p', 'The scorer assembles two kinds of features under one deadline. Velocity counters live in Redis because they change on every event - transactions per card per minute is unknowable in advance and stale in seconds. Profile features (average ticket, home geography) come from the feature store, precomputed offline and served in single-digit milliseconds. The model sees both; the budget sees everything.'],
        ['bul', [
          'Velocity is write-heavy cache work: every transaction increments before anything reads - the counter tier sizes on writes, not reads.',
          'Feature parity is the silent killer: the training pipeline must compute EXACTLY what the online path computes, or the model is grading a different exam.',
          'Timeout policy is per-feature: a missing profile degrades the score; a missing velocity counter IS the signal something is flooding.',
        ]],
      ],
    },
    {
      title: 'The veto, the loop, and the adversary', focus: ['rules', 'case', 'k', 'train'],
      blocks: [
        ['p', 'The model suggests; the rule decides. Regulators and merchants both demand declines that can be explained, so hard rules (sanctioned country, impossible travel, velocity ceiling) hold the veto over any score. Everything flows onto the feedback log - decisions now, chargebacks weeks later - and the training pipeline rebuilds on that lagged truth.'],
        ['bul', [
          'Label latency is the moat and the trap: weeks-old ground truth means the model always fights the previous war - fast rules cover the gap.',
          'The threshold IS the business: each point of recall costs precision, and a false positive is an insulted customer plus a lost sale, forever.',
          'Case management is where review capacity meets queue theory - route only what humans can actually work, and let thresholds absorb the rest.',
        ]],
        ['warn', 'This is adversarial ML: fraudsters probe with small transactions, learn your thresholds, and adapt in days while your labels take weeks. A static model decays on contact. The defense is the loop speed - rules deploy in minutes, models retrain on schedule, and both watch for the decay.'],
      ],
    },
  ],
  bar: {
    mid: 'An ML model that flags suspicious transactions.',
    senior: 'Sub-50ms scoring with split feature freshness (velocity in cache, profiles in the store), model-plus-rules with the explainable veto, per-tier fail-open policy, chargeback feedback loop with feature parity between train and serve.',
    staff: 'Design for the adversary: threshold strategy as a business negotiation, decay detection and loop speed, review-capacity queueing, and the audit story when a regulator asks why THIS transaction was declined.',
  },
},


'UPI Switch (NPCI)': {
  meta: 'Fintech - India DPI - hard - two legs, one illusion',
  overview: 'From the app\'s seat, UPI is one tap. From the switch\'s seat, it is a distributed transaction across two banks that do not trust each other, over a network that times out - debit the remitter, credit the beneficiary, and survive every failure that lands between those two sentences. The design is famous for what happens in the gap: the DEEMED state, where money has verifiably left one account and not verifiably arrived in another, and a reversal choreography resolves it against bank truth.',
  scope: 'The switch itself: leg orchestration, timeout ambiguity and reversals, idempotent bank legs, status serving during ambiguity, and deferred net settlement between banks. PSP app UX, device binding, and PIN handling live in the BHIM template.',
  fr: {
    core: ['Orchestrate debit-then-credit across remitter and beneficiary banks in real time', 'Resolve credit-leg ambiguity: deemed status, verification, reversal or confirmation', 'Serve transaction status to PSPs during and after ambiguity', 'Net-settle inter-bank obligations on the switch ledger'],
    out: ['PSP-side UX and device binding (see BHIM)', 'Dispute adjudication beyond automated reversal'],
  },
  nfr: {
    core: ['A leg is retried, never repeated: idempotency by transaction id at every bank interface', 'Ambiguity is bounded: every DEEMED transaction reaches a terminal state within the reversal SLA', 'The switch survives one bank being slow without queueing every other bank behind it', 'Peak is the product: festival-night traffic is the design point, not the exception'],
    out: ['Gross real-time settlement between banks - netting is the point'],
  },
  nums: [['2 legs', 'debit and credit - the gap between them is the design'], ['DEEMED', 'the state where ambiguity lives, bounded by SLA'], ['net', 'millions of txns settle as a handful of RBI transfers'], ['24x7', 'no clearing hours - the reversal loop never sleeps']],
  entities: [
    ['Transaction', 'txn id + both legs + state machine: INITIATED -> DEBITED -> CREDITED | DEEMED -> REVERSED | CONFIRMED'],
    ['Leg', 'one bank-side operation, idempotent by (txn id, leg) - replay-safe by contract'],
    ['ReversalTask', 'a DEEMED transaction awaiting bank truth: verify, then reverse the debit or confirm the credit'],
    ['NetPosition', 'per bank-pair running obligation on the switch ledger - what actually settles'],
  ],
  apiIntro: 'PSPs speak to the switch; the switch speaks to banks. Status is a first-class endpoint because ambiguity is a first-class state.',
  api: [
    { dir: '->', name: 'POST /txn (id: t)', body: '{ remitter_vpa, beneficiary_vpa, amount }\n-> 200 { state: CREDITED } | 202 { state: DEEMED } - both are answers' },
    { dir: '->', name: 'POST /bank/{id}/debit|credit (idempotent by txn id)', body: 'the leg contract every bank implements - replays return the original result' },
    { dir: '<-', name: 'GET /txn/{id}', body: '-> { state, legs } - must answer DURING ambiguity, not after it resolves' },
  ],
  dives: [
    {
      title: 'The gap between the legs', focus: ['orch', 'rem', 'ben', 'status'],
      blocks: [
        ['p', 'The orchestrator debits first - money must exist before it moves - then credits. A debit failure is clean: nothing happened. A credit TIMEOUT is the interesting case: the beneficiary bank may have credited and lost the response, or never received the request. The switch cannot know, so it refuses to guess: the transaction goes DEEMED, the status store says so honestly, and resolution moves to the reversal loop.'],
        ['bul', [
          'Idempotency by (txn id, leg) is what makes the whole machine safe: the orchestrator can retry any leg blindly, because banks replay instead of repeat.',
          'Per-bank circuit breakers keep one slow bank from queueing the nation: its transactions go DEEMED faster; everyone else proceeds.',
          'The status store is deliberately boring technology serving the only question users ask - and it must answer during the gap, which is why it is written before the credit leg, not after.',
        ]],
        ['warn', 'The instinct to hide DEEMED behind a spinner is the real design failure. Money-left-my-account is survivable when the system says exactly that and bounds the resolution time; it becomes a trust crisis when the app pretends nothing happened.'],
      ],
    },
    {
      title: 'Reversal choreography and net settlement', focus: ['rq', 'rev', 'led', 'recon'],
      blocks: [
        ['p', 'The reversal worker drains DEEMED transactions against bank truth: query the beneficiary - if the credit landed, confirm; if not, reverse the debit. Both outcomes are idempotent legs like any other. Meanwhile the ledger tracks net positions per bank pair: the banks exchange a handful of RBI transfers for millions of transactions, and reconciliation matches the switch ledger against every bank\'s books daily.'],
        ['bul', [
          'Reversal is a NEW debit-side leg with its own idempotency, never an UPDATE to the old one - the ledger stays append-only all the way down.',
          'The reversal SLA is a public promise: ambiguity bounded in hours, automatically - the difference between an incident and a headline.',
          'Netting scales settlement sub-linearly with volume: transaction count grows, RBI transfer count barely moves.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A service that calls two bank APIs and marks the transaction complete.',
    senior: 'Debit-then-credit with a DEEMED state for credit ambiguity, idempotent legs by (txn id, leg), a reversal worker resolving against bank truth within an SLA, per-bank breakers, honest status during the gap, net settlement on an append-only ledger.',
    staff: 'Design the reversal-loop failure modes (what watches the watcher), the per-bank isolation and fairness story at festival peak, the settlement-dispute path when the switch and a bank disagree, and the migration of the leg contract across two hundred banks that deploy on their own schedules.',
  },
},


'Telemedicine (Practo)': {
  meta: 'Healthcare - India - hard - every read is a recorded event',
  overview: 'Telemedicine looks like a marketplace wearing a video call, but the system-design center of gravity is elsewhere: it is the first template in this studio where READS are the sensitive operation. A doctor opening a patient record is itself an event that must be consented, audited, and explainable years later - and prescriptions are money-grade records that must never be edited, only appended. Booking is inventory, video is plumbing; trust is the workload.',
  scope: 'Slot booking, the consult path (signaling vs media), consent-gated EHR access with audit-on-read, break-the-glass, e-prescriptions on an append-only ledger, and reports storage. Insurance claims, diagnostics logistics, and pharmacy fulfilment are their own systems.',
  fr: {
    core: ['Book a slot against real doctor availability, with locking', 'Run a video consult: signaling, media relay, encounter notes', 'Gate every EHR read through consent and write an audit row for it', 'Issue, verify, and revoke e-prescriptions as signed append-only entries'],
    out: ['Insurance and claims adjudication', 'Pharmacy inventory and delivery', 'Wearable/device data ingestion'],
  },
  nfr: {
    core: ['No EHR access without an audit row - the read and its record commit together', 'Media is never stored by default: the encounter note is the record, not the recording', 'Break-the-glass overrides consent in emergencies - allowed, and loudly paged', 'Rx integrity is cryptographic: pharmacies verify a signature chain, not a database row'],
    out: ['Real-time analytics on consult content - if it is wanted, it is a consented, separate pipeline'],
  },
  nums: [['1 row', 'of audit per EHR read - reads ARE writes here'], ['0', 'recordings stored by default - notes, not video'], ['years', 'retention the regulator sets, not the architect'], ['1 slot', 'equals one lock - a double-booked doctor is an outage with a waiting room']],
  entities: [
    ['Slot', 'doctor x time, lockable inventory; booking transitions it atomically'],
    ['Encounter', 'the clinical record of a consult: notes, vitals, diagnosis - append-preferred, versioned when edited'],
    ['ConsentGrant', 'patient -> doctor/purpose -> scope + expiry; checked before every read, cached with instant revoke'],
    ['Prescription', 'signed ledger entries: issue, dispense, revoke - each a new entry, the chain is the truth'],
    ['AuditRow', 'who read what, when, under which consent or break-glass reason - the row that makes the system defensible'],
  ],
  apiIntro: 'The API is honest about sensitivity: reads carry purpose, and the audit is not optional metadata - it is part of the read.',
  api: [
    { dir: '->', name: 'POST /slots/{id}/book', body: '{ patient }\n-> 201 | 409 slot_taken - the lock is the product' },
    { dir: '->', name: 'GET /ehr/{patient}?purpose=consult', body: 'consent checked -> 200 + audit row committed | 403 no_grant | 200(break_glass) + page' },
    { dir: '->', name: 'POST /rx (signed)', body: '{ encounter, drugs[] }\n-> ledger entry id; verification is chain-walk, not row-read' },
  ],
  dives: [
    {
      title: 'Audit-on-read: when reads are the sensitive operation', focus: ['consult', 'consent', 'ehr', 'audit'],
      blocks: [
        ['p', 'Every other template in this studio treats reads as cheap and writes as precious. Healthcare inverts it: opening a record is the act regulators, courts, and patients ask about. So the read path is a small transaction - check the consent grant, serve the record, and commit an audit row naming who, what, when, and under which purpose. The audit write is not telemetry riding alongside; it is part of the read\'s contract.'],
        ['bul', [
          'Sizing implication the diagram makes visible: the audit tier takes one write per EHR read - reads ARE writes here, and the audit log is provisioned like a primary store, not an afterthought.',
          'Consent checks sit on the hot path, so grants cache aggressively - with revocation as instant invalidation, because a revoked grant that serves one more read is a breach, not a staleness bug.',
          'Break-the-glass is a designed door, not a bypass: emergency access succeeds immediately, tags the audit row with the declared reason, and pages a human - allowed, and loud.',
        ]],
        ['warn', 'The tempting shortcut is async audit - queue the row, serve the read, reconcile later. The failure mode writes itself: the queue drops during an incident, and you now have unexplainable access to medical records during the exact window someone will ask about. Audit-on-read commits with the read, and the capacity plan pays for it honestly.'],
      ],
    },
    {
      title: 'Consults and prescriptions: plumbing vs records', focus: ['sig', 'sfu', 'rx', 'files'],
      blocks: [
        ['p', 'The video call is deliberately boring: WebSocket signaling negotiates the session, an SFU relays media, and none of it is stored - the clinical record is the encounter note the doctor writes, not the recording. Prescriptions take the opposite discipline: they are money-grade records on the append-only ledger, where issuing, dispensing, and revoking are each new signed entries and a pharmacy verifies the chain rather than trusting a row.'],
        ['bul', [
          'Media-record separation is the privacy architecture: the SFU sees packets, never PHI semantics; the EHR sees notes, never packets - a breach of one is not a breach of both.',
          'A revoked Rx is a new entry that supersedes, never an UPDATE that erases - the pharmacist who dispensed against the old entry has a defensible chain, and so do you.',
          'Reports and imaging live in object storage behind the same consent gate, served by short-lived signed URLs - the blob store never learns who is asking; the consent layer already answered that.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A booking system with video calls and a prescriptions table.',
    senior: 'Slot inventory with locking, consent-gated reads that commit their own audit rows, media-record separation with an SFU, e-Rx on an append-only signed ledger, break-the-glass as a designed and paged door.',
    staff: 'Design the retention and legal-hold story the regulator dictates, the consent-revocation propagation SLA, the audit tier\'s own durability (who audits the audit), and the incident narrative for the day a court asks exactly who read this record and why.',
  },
},


'Ayurveda Gyaan (Charak Samhita)': {
  meta: 'Knowledge systems - India - hard - the corpus is eternal, the interpretation is layered',
  overview: 'Every other template in this studio serves data that churns. This one serves a medical corpus that has been stable for two thousand years - and that inversion drives the whole design. The Charak Samhita is verse-addressable (sthana.chapter.shloka), its text is canon, and everything humans have added since - Chakrapani\'s commentary, translations into a dozen languages, modern clinical mappings - is an overlay that must never touch the source. Around that immutable core sits a modern platform: citation-forced RAG for vaidic gyaan, AYUSH-guideline teleconsults, NAMASTE-to-ICD-11 dual coding, and formulation provenance on an append-only ledger. The system\'s ethic is stated in its architecture: it is a librarian and a clerk, never the vaidya.',
  scope: 'The canonical corpus service with overlays, multilingual retrieval and citation-forced answers, prakriti assessment, AYUSH teleconsultation, terminology dual-coding, and formulation provenance. Herb farming/manufacturing operations, insurance, and modern-medicine diagnosis are out.',
  fr: {
    core: ['Serve any shloka by canonical address with chosen overlays (commentary, language)', 'Answer gyaan questions with mandatory shloka citations - or abstain honestly', 'Run AYUSH-guideline teleconsults with prakriti assessment as structured data', 'Record prescriptions of classical formulations with batch-level provenance', 'Map every clinical term NAMASTE <-> ICD-11 TM2 both directions'],
    out: ['Diagnosis or treatment advice from the AI itself - the guard exists to prevent exactly this', 'Manufacturing and supply-chain operations (the provenance chain is consumed, not produced, here)', 'Modern-medicine EHR (interop via codes, not ownership)'],
  },
  nfr: {
    core: ['Canon immutability is absolute: no write path exists to source verses - corrections are new overlay versions', 'No uncited clinical claim leaves the system: the guard enforces citation-or-abstain', 'Edition concordance: one verse, several numbering traditions - citations must resolve across all mapped editions', 'Health-grade privacy: consult reads are audited like the Telemedicine template - this is PHI with a Sanskrit vocabulary'],
    out: ['Real-time collaboration on commentaries (scholarly review is deliberately slow)'],
  },
  nums: [['120', 'chapters across 8 sthanas - the whole canon fits in memory; the load is interpretation'], ['1 id', 'sthana.chapter.verse - the primary key of a civilization-scale text'], ['2 codes', 'NAMASTE + ICD-11 TM2 on every clinical concept'], ['∞ TTL', 'the rare true forever-cache: immutable canon at the edge']],
  entities: [
    ['Shloka', 'canonical id + Devanagari + IAST transliteration; frozen - the one table with no UPDATE grant at all'],
    ['Overlay', 'commentary | translation | clinical-note, keyed (shlokaId, author, lang, version) - corrections append a version, never edit'],
    ['Concordance', 'edition A verse id <-> edition B verse id - the unglamorous table that keeps citations true across printings'],
    ['PrakritiProfile', 'structured assessment output (dosha weights + confidence), dual-coded, EHR-portable'],
    ['FormulationRx', 'classical formulation ref + batch chain on the ledger: herb lot -> preparation -> dispense'],
  ],
  apiIntro: 'The API is honest about what is eternal and what is layered: verses are GET-only forever; knowledge answers carry citations or an abstention; prescriptions carry chains.',
  api: [
    { dir: '->', name: 'GET /shloka/{sthana}/{ch}/{v}?overlays=chakrapani,gu,en', body: '-> canon + requested overlays; ETag is permanent - cache it until the sun cools' },
    { dir: '->', name: 'POST /gyaan', body: '{ question, lang }\n-> { answer, citations: [sthana.ch.v, ...] } | { abstain: true, reason: "the text does not address this" }' },
    { dir: '->', name: 'POST /rx', body: '{ consultId, formulation, batchId }\n-> ledger entry id - the provenance chain is walkable from the receipt' },
  ],
  dives: [
    {
      title: 'The immutable canon and its overlays', focus: ['corpus', 'scans', 'srch'],
      blocks: [
        ['p', 'The Shloka Registry is the quietest service in the studio and the most absolute: source verses have no write path - not admin-gated, absent. Everything alive happens in overlays, keyed by (shloka, author, language, version), so Chakrapani sits beside a 2024 Gujarati translation without either touching the text. Multilingual search indexes canon and overlays together but always RESOLVES to canonical ids, because the id - not the wording - is what two scholars can agree on.'],
        ['bul', [
          'The ledger discipline, applied to knowledge: a translation correction is a new overlay version with lineage - readers can diff interpretations across decades.',
          'The forever-cache is real here: immutable canon means edge caches with infinite TTL and permanent ETags - the rare system where cache invalidation is genuinely nobody\'s problem.',
          'Manuscript scans live in blob storage behind the same canonical addressing - the photograph of the palm leaf and its Unicode text share one id.',
        ]],
        ['warn', 'The trap is edition variance: Charak numbering differs across printed traditions, and a citation that silently assumes one edition points readers at the wrong verse in another. The Concordance table is unglamorous and non-optional - without it, the most careful citation system in the studio quietly lies.'],
      ],
    },
    {
      title: 'Gyaan without hallucination', focus: ['guard', 'llm', 'vec', 'consult', 'prov'],
      blocks: [
        ['p', 'The RAG path is deliberately strict. Retrieval returns shloka ids; generation must quote-and-cite from exactly those; the guard verifies every clinical claim maps to a citation and every formulation mention passes deterministic contraindication rules - rules, not model judgment. And abstention is designed in as an honorable exit: "the text does not address this" is rendered as a real answer with real typography, because in a scriptural and medical context, a confident paraphrase without a source is not a UX bug - it is cultural and medical harm.'],
        ['bul', [
          'Citation-forced means machine-checkable: the guard rejects any output sentence carrying a clinical claim whose citation set is empty - regeneration or abstention, never passage.',
          'The consult path stays human: prakriti assessment structures the questionnaire, dual codes make it portable, but the vaidya decides - the AI drafts nothing prescriptive.',
          'Prescriptions land on the provenance ledger: herb lot -> classical preparation -> dispense, append-only - the third vertical this studio\'s ledger has served, because trust chains are one shape.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A search box over translated texts with a chatbot on top.',
    senior: 'Canonical verse addressing with overlay versioning and edition concordance, citation-forced RAG with a deterministic safety guard and an honorable abstain, dual-coded assessments, provenance-chained prescriptions, audited consult reads.',
    staff: 'Design the scholarly governance: who may publish an overlay, how concordance disputes resolve, how ICD updates ripple through dual codes without rewriting history - and the ethical architecture that keeps the system a librarian as capability grows. Sampradaya - lineage consensus - does not shard; the design must queue interpretation behind scholars, not GPUs.',
  },
},


'SaaS AI Copilot (Multi-tenant RAG)': {
  meta: 'GenAI - SaaS integration - hard - many tenants, one model, zero leakage',
  overview: 'Adding AI to a SaaS product is not adding a chatbot; it is adding a second data plane that must respect every boundary the first one already enforces. Tenant A\'s documents become tenant A\'s vectors, tenant A\'s questions cost tenant A\'s budget, and tenant A\'s answers must be traceable to tenant A\'s sources - while every tenant shares the same orchestrator, the same LLM gateway, and the same vector cluster. The design lives in the enforcement points: where the tenant filter is applied, where tokens are metered, and how deletions reach an index that was never built to forget.',
  scope: 'Tenant-scoped ingestion (chunk, embed, version, delete), tenant-filtered retrieval, orchestration with budgets, LLM gateway with fallbacks, per-tenant metering and semantic caching, token-level observability. Model training, billing invoices, and the host SaaS product\'s own features are out.',
  fr: {
    core: ['Ingest tenant documents into tenant-scoped vectors with versioning and deletion', 'Answer questions from a tenant\'s own knowledge only, with citations', 'Meter tokens per tenant and enforce plan budgets', 'Orchestrate multi-step answers (retrieve, reason, call a tool) under a step and cost budget', 'Trace every answer: sources, tokens, model, latency'],
    out: ['Fine-tuning per tenant (a different product)', 'Cross-tenant benchmarking or shared knowledge', 'Billing and invoicing (metering feeds it; does not do it)'],
  },
  nfr: {
    core: ['Zero cross-tenant retrieval - enforced by the query filter, tested by canary documents', 'A deleted document is unretrievable within the erasure SLA - vectors included', 'One tenant\'s spike cannot exhaust another tenant\'s latency or budget', 'Embedding-model changes are planned reindexes with dual-read during migration', 'Every answer carries token counts and sources in its trace'],
    out: ['Real-time index freshness - seconds-to-minutes is the honest ingestion SLA'],
  },
  nums: [['1 filter', 'tenant_id on every vector query - at the DB, never in the prompt'], ['tokens', 'the unit of cost, metered per tenant before the answer'], ['1 canary', 'planted document per tenant that must never appear elsewhere'], ['reindex', 'what an embedding-model upgrade actually is']],
  entities: [
    ['Tenant', 'plan, token budget, embedding model version, erasure SLA - the row every other row points at'],
    ['Document', 'tenant-owned, versioned; supersede replaces its chunks, delete removes its vectors'],
    ['Chunk', 'text span + embedding + (tenant_id, doc_id, version) - the filterable unit'],
    ['Conversation', 'tenant-scoped turns with the sources and tokens each answer consumed'],
    ['UsageRecord', 'tokens in/out per request per tenant - metering is written before the response leaves'],
  ],
  apiIntro: 'Tenant identity arrives once, at the gateway, and travels as context - never as a parameter a client can set.',
  api: [
    { dir: '->', name: 'POST /v1/ask (tenant from auth)', body: '{ question, conversation_id }\n-> stream of tokens, then { sources: [chunk ids], usage: { in, out } }' },
    { dir: '->', name: 'POST /v1/documents (tenant from auth)', body: '{ file }\n-> 202 { doc_id, version } - chunks and vectors land asynchronously' },
    { dir: '->', name: 'DELETE /v1/documents/{id}', body: '-> 202 - vectors, chunks and cache entries purged within the erasure SLA' },
  ],
  dives: [
    {
      title: 'Isolation is a retrieval invariant', focus: ['gw', 'api', 'guard', 'vec'],
      blocks: [
        ['p', 'The gateway resolves the tenant from the credential and the API never accepts it from the body. Every vector query carries tenant_id as a hard filter in the database - a namespace or a metadata predicate - so the wrong documents are not merely down-ranked, they are unreachable. The guard checks the tenant on the way in AND on the way out: any retrieved chunk whose tenant does not match the request is a bug that pages someone, not a sentence in an answer.'],
        ['bul', [
          'Filter at the database, never in the prompt: "only answer from this tenant\'s documents" is a wish; a WHERE clause is a guarantee.',
          'Canary documents make the invariant testable: each tenant gets a planted secret sentence, and a nightly job asks every OTHER tenant for it - the correct result is silence.',
          'Namespaces per tenant simplify deletion and quotas; metadata filters scale to more tenants - the trade is operational, and the guard does not care which you chose.',
        ]],
        ['warn', 'The classic breach is not the vector store - it is the semantic cache. A per-tenant question answered from a global cache serves tenant A\'s answer to tenant B who asked the same words. The cache key includes tenant_id or the cache does not exist.'],
      ],
    },
    {
      title: 'Budgets, pipelines, and the schema nobody calls a schema', focus: ['orch', 'llm', 'meter', 'ing', 'emb'],
      blocks: [
        ['p', 'The orchestrator runs a graph - retrieve, reason, maybe call a tool - under a step budget and a token budget per tenant plan. Metering writes the usage record before the answer streams out, so a crash mid-stream still bills honestly. Ingestion is asynchronous: uploads land on a log, workers chunk and embed, and every chunk carries the embedding model version - because the embedding model IS a schema, and changing it means every vector in the tenant must be recomputed, dual-read during the migration, and cut over deliberately.'],
        ['bul', [
          'Noisy neighbours in AI SaaS are budget problems first: per-tenant token buckets at the API keep one tenant\'s runaway agent from consuming the gateway everyone shares.',
          'Deletion must reach the index: a DPDP or GDPR erasure that clears the row and leaves the vectors is a compliance incident with a similarity score.',
          'The semantic cache is where margin lives - the tenth identical question in a tenant costs nothing - and it inherits every isolation rule above.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A RAG chatbot with a tenant_id column.',
    senior: 'Tenant from credential only, filter enforced at the vector store with canary-document tests, per-tenant semantic cache and token metering written before the response, versioned ingestion with deletion propagating to vectors, embedding-model version as a schema with dual-read reindex, orchestration under step and cost budgets, token-level tracing.',
    staff: 'Design the tenant-tier isolation model (shared cluster vs dedicated namespaces vs dedicated indexes by plan), the reindex program across thousands of tenants when the embedding model changes, the erasure SLA proof a regulator accepts, and the eval program that catches quality regressions per tenant before customers do.',
  },
},


'Enterprise SSO (Entra/Okta)': {
  meta: 'Identity - enterprise - hard - one login, a million people, five hundred apps, zero trust',
  overview: 'Enterprise SSO is the load-bearing wall of a company: when it is down, nobody works, and when it is wrong, everybody is exposed. The job is to let a million employees authenticate once and reach five hundred applications - some modern and speaking OIDC, many legacy and speaking SAML - while every login is a risk decision, not a gate. The identity provider (Microsoft Entra ID or Okta) owns authentication; each application owns its own authorization; a broker bridges the protocol generations; and the whole thing must stay up when it is the single most concentrated dependency in the org chart.',
  scope: 'Federated authentication (OIDC + SAML), MFA and step-up, conditional access, token issuance and validation, signing-key rotation, session and logout, user lifecycle (SCIM provisioning/deprovisioning), and the audit trail. Fine-grained in-app authorization logic and the applications themselves are consumed here, not built.',
  fr: {
    core: ['Authenticate a user once and issue tokens the apps trust (SSO)', 'Federate to modern apps by OIDC and legacy apps by SAML from one identity', 'Enforce MFA and conditional access per policy and risk', 'Provision and DEPROVISION accounts across apps (SCIM) - joiners and, critically, leavers', 'Validate tokens, rotate signing keys, and support logout and revocation'],
    out: ['Each application\'s internal RBAC/ABAC rules (it receives claims and decides)', 'The business applications themselves', 'HR as the source of truth for who exists (SCIM consumes it)'],
  },
  nfr: {
    core: ['Availability is existential: SSO down means the whole company is down - this is the four-nines-or-better tier', 'Token validation must be fast: apps verify signatures locally against cached keys, not by calling home on every request', 'Deprovisioning must be prompt and provable: a disabled user loses access within a bounded, audited window', 'Every sign-in is logged immutably for security and compliance', 'Key rotation and policy change never cause a login outage'],
    out: ['Sub-second provisioning - lifecycle sync in minutes is the honest SLA'],
  },
  nums: [['1 identity', 'per human, across 500 apps - that is the entire point'], ['4-9s+', 'availability floor - SSO is the company\'s power grid'], ['~1 hour', 'access-token life; refresh tokens longer, revocable'], ['minutes', 'the honest deprovisioning and provisioning window']],
  entities: [
    ['User', 'the identity in the directory: credentials, factors, group memberships, lifecycle state (active/disabled)'],
    ['Application', 'a registered relying party: its protocol (OIDC or SAML), redirect URIs, and the claims it is trusted to receive'],
    ['Token', 'ID token (who logged in) and access token (what an API will honor) - signed, short-lived, audience-scoped'],
    ['Session', 'the SSO session at the IdP that makes the second app login invisible - separate from each app\'s local session'],
    ['Policy', 'a conditional-access rule: identity + context (device, location, risk) -> allow | step-up | block'],
  ],
  apiIntro: 'The protocols are the API: OIDC and SAML are how apps ask "who is this?" and the IdP answers with a signed assertion. Identity is asserted, never taken on the app\'s word.',
  api: [
    { dir: '->', name: 'GET /authorize (OIDC, Authorization Code + PKCE)', body: 'redirect to the IdP; user authenticates + consents; a one-time code comes back - PKCE stops a stolen code from being redeemed' },
    { dir: '->', name: 'POST /token', body: 'code + verifier -> { id_token, access_token, refresh_token } - the ID token proves the login, the access token opens APIs' },
    { dir: '->', name: 'GET /.well-known/jwks.json', body: 'the public signing keys apps cache to validate tokens locally; rotation publishes the next key here before it is used' },
  ],
  dives: [
    {
      title: 'AuthN, AuthZ, and the token between them', focus: ['idp', 'keys', 'gw', 'apps'],
      blocks: [
        ['p', 'Authentication and authorization are different questions with different owners, and the token is the contract between them. The IdP authenticates - password, passkey, MFA - and mints a signed, short-lived, audience-scoped token carrying identity claims. The application authorizes - it reads the claims and decides what this user may do - and it verifies the token by checking the signature against the IdP\'s published keys, cached locally, on every request. Calling the IdP to introspect each token would make identity a latency tax and a availability risk on every API hop; local validation is the default, and introspection is reserved for the narrow case where a token must be killable the instant it is revoked.'],
        ['bul', [
          'OAuth 2.0 is authorization, OIDC is authentication built on top of it - "can I use OAuth to log in?" earns the answer: OAuth authorizes access, OIDC is the identity layer, use OIDC for login.',
          'Local JWT validation trades instant revocation for speed and independence; short token lifetimes bound the risk, and refresh tokens are the revocation lever that actually matters.',
          'Signing keys rotate on an overlap schedule: the new key appears in JWKS and is trusted before anything is signed with it, and the old key retires only after every cached copy has aged out.',
        ]],
        ['warn', 'The most dangerous gap is the leaver: authentication is easy to demo and deprovisioning is easy to forget. A disabled employee whose refresh token still works, or whose SAML session lingers, is an open door - lifecycle deprovisioning (SCIM) and bounded token lifetimes are the difference between a policy and a breach.'],
      ],
    },
    {
      title: 'Federation, MFA, and login as a decision', focus: ['idp', 'fed', 'mfa', 'ca', 'risk'],
      blocks: [
        ['p', 'One identity has to serve two protocol generations, so a broker fronts both: modern apps get OIDC, legacy enterprise SaaS gets SAML, and the employee never knows which. On top of authentication sits conditional access, which turns login from a gate into a decision: the engine weighs who, on what device, from where, at what risk, for which app, and returns allow, step-up MFA, or block. This is the mechanics of zero trust - identity plus context plus policy, evaluated every time, rather than a trusted network perimeter.'],
        ['bul', [
          'PKCE protects the authorization-code flow for public clients (mobile, SPA): the code is useless without the verifier only the real client holds - a stolen code cannot be redeemed.',
          'MFA lives at the IdP so every federated app inherits it at once; step-up asks for a second factor only when the risk signal warrants, keeping the common path fast.',
          'Okta-to-Entra federation is the same pattern one level up: one IdP trusts another as an identity source, which is how acquisitions and multi-cloud estates present a single front door.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A login page and a shared user table.',
    senior: 'OIDC for new and SAML for legacy behind one broker, MFA and conditional access at the IdP, tokens validated locally against rotating JWKS with introspection reserved for revocation-critical paths, PKCE on public clients, SCIM provisioning AND deprovisioning, immutable sign-in audit, and an availability design worthy of the company\'s single most concentrated dependency.',
    staff: 'Design the org-wide trust fabric: session and logout semantics across 500 apps (including single logout\'s hard edges), the key-rotation program that never drops a login, the risk model behind conditional access, the deprovisioning guarantee a security auditor will accept, and the failure design for when the IdP itself degrades - because when SSO is the single point of failure, its resilience is the whole enterprise\'s resilience.',
  },
},


'Pine Labs (Merchant POS + EMI)': {
  meta: 'Fintech - Bharat - hard - merchant acquiring with a physical device fleet',
  overview: 'Most payment templates model the money rails; this one models the shop counter. Pine Labs is the merchant-acquiring side of payments: 600,000+ Android smart-POS terminals in physical stores, each of which must accept any method a shopper offers (chip, tap, QR, wallet, UPI), turn a card swipe into an EMI plan in the seconds a customer will stand at a till, route the transaction to whichever acquirer clears it cheapest and is healthy right now, and - critically - never refuse a sale because the store\'s network hiccuped. Around the terminal sits a payments-grade fleet-management problem (config, keys, firmware, tamper detection across hundreds of thousands of devices) and a settlement problem (net every merchant\'s captures to a T+1 payout, reconciled three ways). It is a distributed system whose edge nodes are hardware in someone else\'s building.',
  scope: 'The transaction path from terminal to acquirer/network, the real-time EMI/affordability engine across 200+ banks and NBFCs, least-cost acquirer routing, offline store-and-forward, device fleet management, and merchant settlement/reconciliation. Card issuing, the banks\' and NBFCs\' own lending decisions, and the merchant\'s retail ERP are consumed here, not built.',
  fr: {
    core: ['Accept a payment at the terminal by any method and get an authorization', 'Compute EMI eligibility and plans in real time across 200+ financing partners', 'Route each transaction to the cheapest healthy acquirer/network', 'Capture offline and forward when connectivity returns, without double-charging', 'Net captured transactions to a T+1 settlement per merchant, reconciled'],
    out: ['The issuing bank\'s auth decision and the NBFC\'s credit decision (consumed via connectors)', 'The merchant\'s point-of-sale billing/ERP software', 'Consumer-side card issuing'],
  },
  nfr: {
    core: ['A network blip must never lose a sale: local capture + idempotent forward is non-negotiable at the edge', 'EMI eligibility must answer in counter-time (a few seconds), not bank-call time', 'Money is exact: every capture is double-entry on the ledger, settlement reconciles three ways', 'The device fleet is payments infrastructure: a bricked or tampered terminal is a store that cannot transact', 'Acquirer failure degrades cost or method, never availability - routing fails over'],
    out: ['Sub-second global consistency of settlement - netting is a batched T+1 promise by design'],
  },
  nums: [['600K+', 'terminals in the field - the edge of this system is hardware'], ['~60s', 'to offer EMI at the counter across 200+ partners'], ['T+1', 'merchant settlement - a promise with a clock'], ['200+', 'bank and NBFC financing connectors behind one swipe']],
  entities: [
    ['Terminal', 'a registered Android POS device: config, signing keys, firmware version, health and tamper state'],
    ['Transaction', 'method, amount, merchant, terminal; carries an idempotency key so an offline replay books once'],
    ['EMIPlan', 'issuer/NBFC + tenure + subvention (no-cost-EMI) math, computed per card at the counter'],
    ['AcquirerRoute', 'the chosen network for a transaction: least cost among the healthy, with failover'],
    ['Settlement', 'the netted T+1 payout per merchant, reconciled against acquirer and bank truth'],
  ],
  apiIntro: 'The terminal talks to the platform over a link that may vanish, so the API is built around capture-now-reconcile-later and idempotency, not request-response optimism.',
  api: [
    { dir: '->', name: 'POST /txn (from terminal, idempotency-key)', body: '{ method, amount, merchant, terminal }\n-> auth result; if the link drops, the terminal queues and retries the SAME key - the ledger books it once' },
    { dir: '->', name: 'POST /emi/quote', body: '{ card_bin | pan_token, amount }\n-> plans across eligible banks/NBFCs with tenures and no-cost-EMI math, in counter-time' },
    { dir: '->', name: 'GET /settlement/{merchant}', body: '-> the T+1 netted payout with the transaction-level breakdown reconciliation is built from, not bolted onto' },
  ],
  dives: [
    {
      title: 'The terminal is a distributed node in a hostile network', focus: ['pos', 'store', 'gw', 'ledger'],
      blocks: [
        ['p', 'The hardest truth of merchant POS is that your edge nodes live in other people\'s buildings on other people\'s Wi-Fi, and the network drops mid-transaction as a matter of routine, not exception. So the terminal captures locally and forwards when the link returns, and the entire money path is built around that: every transaction carries an idempotency key, the ledger dedupes the inevitable replay, and a shopper never hears "try again" because the store\'s router blinked. This is store-and-forward as a first-class design, not an error handler bolted on.'],
        ['bul', [
          'Idempotency is the load-bearing invariant: the same offline transaction, retried three times when connectivity flaps, books exactly once - the ledger is the arbiter.',
          'Local capture has limits stated honestly: an offline auth carries risk the platform accepts within floor limits, because refusing every sale during an outage is its own kind of failure.',
          'The ledger is the source of truth and the dashboard is a view of it - the merchant sees what the ledger records, and reconciliation finds drift before the merchant does.',
        ]],
        ['warn', 'The trap is treating the terminal like a browser. A browser retries against a server that was probably up; a POS terminal retries against a link that was probably down, from a device holding money-movement intent. Without idempotency end-to-end, offline retries become double charges - and a double charge at a shop counter is a support call, a refund, and a lost merchant.'],
      ],
    },
    {
      title: 'EMI at the counter, routing behind it', focus: ['orch', 'emi', 'nbfc', 'route', 'acq'],
      blocks: [
        ['p', 'The product that made Pine Labs is EMI at the point of sale, and it is a real-time computation under a human-patience deadline: from a card BIN or a PAN, find the eligible plans across 200+ banks and NBFCs, apply no-cost-EMI subvention math, and present tenure options - all in the few seconds a shopper will wait at a till. Behind the accepted payment, least-cost routing picks the acquirer that clears cheapest and is healthy right now, because the merchant discount rate is the merchant\'s margin and a degraded acquirer must become a re-route, never a declined sale.'],
        ['bul', [
          'EMI eligibility is a hot-path lookup, not a batch job: the plan matrix is precomputed and cached per partner so the counter answer is fast and the bank call is avoided.',
          'Least-cost routing is cost AND health: the cheapest network that is currently clearing, with automatic failover, so an acquirer incident costs basis points, not sales.',
          'Cardless EMI extends the same engine to shoppers with no credit card via NBFC rails - PAN/Aadhaar eligibility at the terminal, the same counter-time budget.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A card machine that calls a payment API.',
    senior: 'Store-and-forward with end-to-end idempotency so a network blip never loses or doubles a sale, real-time EMI eligibility across 200+ partners in counter-time, least-cost acquirer routing with health-based failover, double-entry ledger with three-way settlement reconciliation, and fleet management (config, keys, firmware, tamper) treated as payments-grade infrastructure.',
    staff: 'Design the fleet and money guarantees at 600K terminals: the offline floor-limit risk model, the key-rotation and firmware program across hundreds of thousands of devices in the field, the reconciliation system that a finance auditor and a merchant both trust, and the routing economics that balance cost against acquirer health - because at this scale the edge is hardware you cannot redeploy in an afternoon, and every design choice is also a field-operations choice.',
  },
},


'Discovery Loop (Autonomous Research)': {
  meta: 'Frontier AI - autonomous science - very hard - the system that runs experiments so humans do not have to',
  overview: 'Almost every system in this studio serves a request and returns an answer. Discovery Loop does something categorically different: it runs the scientific method as a program. An AI proposes a hypothesis, designs an experiment to test it, executes that experiment on real compute, analyzes what came back, and folds the result into the next proposal - thousands of these cycles running in parallel, ideally with no human in the loop. Founded in 2026 by Jeff Dean, Sanjay Ghemawat, Quoc Le and Oriol Vinyals as a public-benefit corporation, its first target is the automation of machine-learning research itself - a system improving the very techniques it is built from. Architecturally this is not a chatbot with tools; it is a closed-loop optimizer whose inner iteration is "run a real experiment on a GPU cluster", whose currency is information gained per GPU-hour, and whose correctness criterion is that a discovery can be reproduced. The three forces that shape every decision: the loop must converge rather than wander, the finite compute must be allocated to the most informative experiments, and autonomous code that spends money and runs itself must be bounded and reproducible.',
  scope: 'The autonomous experimental loop end to end: hypothesis generation, experiment planning (design of experiments), a compute scheduler that allocates a finite accelerator pool by expected value, sandboxed execution of proposed experiments, results analysis that feeds back as priors, and a provenance system that makes every result reproducible. The foundation models being improved, the physical datacenter, and human peer review of the eventual findings are consumed or downstream, not built here.',
  fr: {
    core: ['Propose hypotheses conditioned on all prior results (not from a blank slate)', 'Plan experiments that maximize information per unit compute (design of experiments)', 'Schedule thousands of concurrent experiments across a finite accelerator pool by expected value', 'Execute each experiment sandboxed, resource-capped, and fully instrumented', 'Analyze results and update the shared prior that steers the next generation of hypotheses', 'Record every run reproducibly: code, data, seed, environment, parent hypothesis, outcome'],
    out: ['Training the base foundation models the hypothesis engine uses (a supplier, not this system)', 'Datacenter and accelerator hardware provisioning (consumed as a pool)', 'Human scientific peer review and publication of confirmed discoveries'],
  },
  nfr: {
    core: ['Convergence: the loop must trend toward discovery, so results must feed back fast enough to steer the next batch - a feedback lag longer than an experiment cycle turns the loop into parallel random search', 'Accelerator utilization is the primary efficiency metric: idle GPUs are the dominant waste, so the scheduler keeps the pool saturated with the highest-value work', 'Safety and cost containment: autonomous, self-executing code must be bounded in compute, blast radius and spend BEFORE it runs, not audited after', 'Reproducibility is absolute: any result can be re-derived from its pinned provenance, or it is not a scientific result', 'Fault tolerance across long runs: multi-hour/day experiments must checkpoint and resume, because at thousands of concurrent runs, hardware failure is constant, not exceptional'],
    out: ['Low-latency interactive response - this is a throughput-and-convergence system, not a request-response one; a cycle can take minutes to days'],
  },
  nums: [['1000s', 'experiments in flight at once - parallelism is the whole point'], ['info/GPU-hr', 'the true currency: expected information gain per unit of scarce compute'], ['1 loop', 'propose to execute to analyze to propose - the iteration that must converge'], ['100%', 'reproducible: every run pins code, data, seed, environment, parent']],
  entities: [
    ['Hypothesis', 'a proposed, testable claim conditioned on the prior; carries an expected-information-gain estimate the scheduler ranks by'],
    ['Experiment', 'the concrete plan to test a hypothesis: code, dataset, resource request, success metric; the schedulable unit of work'],
    ['Run', 'one execution of an experiment: pinned code+data+seed+env, a checkpoint stream, telemetry, and an outcome - the reproducible atom'],
    ['Result', 'the analyzed outcome of a run, distilled into a metric AND an update to the shared prior the hypothesis engine conditions on'],
    ['Prior / Knowledge', 'the accumulated, structured learning from all results so far - the thing that makes cycle N smarter than cycle 1'],
  ],
  apiIntro: 'The control plane is deliberately low-QPS and high-consequence: humans and agents submit research goals and guardrails, not per-request traffic. The heavy motion is internal - the loop scheduling itself against the compute pool.',
  api: [
    { dir: '->', name: 'POST /campaign', body: '{ goal, budget_gpu_hours, safety_bounds, success_metric }\n-> a research campaign the loop pursues autonomously within the bounds - the human sets the goal and the leash, not the steps' },
    { dir: '->', name: 'GET /campaign/{id}/frontier', body: '-> the current best results, the live hypotheses in flight, GPU-hours spent vs budget, and the provenance to reproduce any of it' },
    { dir: '<->', name: '(internal) scheduler.claim(gpu_pool)', body: 'the scheduler continuously ranks queued experiments by expected info-gain per GPU-hour, preempts low-value runs, and keeps the pool saturated' },
  ],
  dives: [
    {
      title: 'The loop must converge, not wander', focus: ['orch', 'hyp', 'plan', 'eval', 'feat'],
      blocks: [
        ['p', 'The defining risk of automated science is not that the AI cannot generate ideas - it is that it generates too many, untethered from what has already been learned, and burns a fortune in compute on a parallel random walk. So the loop is engineered as a closed feedback system with a memory. The hypothesis engine never proposes from a blank slate: it conditions on the accumulated prior, the structured distillation of every result so far. The planner turns a hypothesis into an experiment designed to maximize information - design of experiments, not one-variable-at-a-time - and after execution the analyzer does the load-bearing work of turning a raw outcome back into an update to that prior. The tighter and faster this feedback, the more the system compounds; the looser it is, the closer it slides to expensive brute force.'],
        ['bul', [
          'Conditioning on the prior is what separates discovery from search: each result must sharpen the next proposal, or the parallelism just multiplies waste.',
          'Design of experiments is the multiplier: an experiment chosen for expected information gain teaches more per GPU-hour than a dozen chosen at random.',
          'The analyzer is the quiet heart: distilling a noisy result into a reliable prior update is harder than proposing or running, and it is where convergence is won or lost.',
        ]],
        ['warn', 'The failure mode that looks like success: high GPU utilization with no convergence. The cluster is busy, the dashboards are green, thousands of experiments are running - and the frontier is not moving, because results are not feeding back fast or well enough to steer proposals. Utilization measures that the machine is working; only convergence measures that it is discovering. Optimizing the first while ignoring the second is how you build a very expensive space heater.'],
      ],
    },
    {
      title: 'The scheduler is the whole ballgame', focus: ['sched', 'queue', 'exec', 'guard', 'store'],
      blocks: [
        ['p', 'When ideas are cheap and compute is finite, the allocator of compute becomes the most important component in the system. The scheduler does not run experiments first-come-first-served; it continuously ranks the queue by expected information gain per GPU-hour, starts the most valuable work, and preempts runs whose value has fallen below what is waiting. This is a live, economic decision made thousands of times over: every accelerator-hour spent on a low-value experiment is one stolen from a discovery. Around it sits the reality of long-running work at scale - experiments that take hours or days must checkpoint continuously so a preemption or a hardware failure resumes rather than restarts, because across thousands of concurrent runs on real silicon, failure is the steady state, not the exception.'],
        ['bul', [
          'Expected-value scheduling, not FIFO: the queue is a priority market in information-per-GPU-hour, re-ranked as results arrive and estimates update.',
          'Preemption with checkpoints is mandatory: a day-long run that cannot resume is a day-long run you cannot afford to preempt, which cripples the scheduler.',
          'Saturation is the target and the trap: keep the pool full, but full of the RIGHT work - a saturated cluster running low-value experiments is worse than an idle one, because it hides the waste.',
        ]],
        ['warn', 'Autonomous code that requests its own compute is an agent that can spend your entire budget - and cause real damage - in an afternoon. The safety and resource gate is not optional and it sits UPSTREAM of the scheduler: every experiment is bounded in compute, cost and blast radius before a single accelerator spins, sandboxed from everything it should not touch. An automated scientist without a resource leash is an automated way to set money, and possibly more, on fire.'],
      ],
    },
    {
      title: 'Reproducibility is the definition, not a feature', focus: ['exec', 'prov', 'results', 'obs'],
      blocks: [
        ['p', 'A result that cannot be reproduced is not a scientific result, so provenance is architectural bedrock rather than an audit afterthought. Every run pins the exact code, dataset version, random seed, environment and the parent hypothesis that motivated it onto an append-only ledger, and its outcome is written beside them. This is what lets any claim on the frontier be re-derived on demand, any surprising result be trusted rather than suspected, and the whole campaign be audited - which for a public-benefit corporation automating science is not just engineering hygiene but the basis of scientific and institutional credibility. It is the same append-only-trust-chain shape this studio has used for money and for medical provenance, pointed now at knowledge itself.'],
        ['bul', [
          'Pin everything or reproduce nothing: code, data, seed, environment, parent - a single unpinned variable makes a result unrepeatable and therefore worthless.',
          'The ledger is append-only by design: results are historical facts, and a scientific record you can quietly edit is not a record.',
          'Provenance is what makes autonomy trustworthy: when no human watched the experiment run, the pinned, reproducible trail is the only thing that lets a human believe the result.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'An agent that calls tools in a loop.',
    senior: 'A closed feedback loop where results condition the next hypotheses (not blank-slate generation), an expected-information-gain scheduler that allocates a finite accelerator pool and preempts with checkpoints, a safety/resource gate upstream of all execution, sandboxed long-running experiments that checkpoint and resume through constant hardware failure, and append-only provenance that makes every result reproducible.',
    staff: 'Design the convergence guarantees and the economics: how the prior is represented so distilled results actually sharpen proposals, how the scheduler prices information-gain against GPU-hours under uncertainty, how safety bounds are expressed for code that writes and runs itself, the reproducibility standard that would satisfy external scientific scrutiny, and the failure design for a system whose inner loop is a real experiment on real silicon at massive concurrency - where the meta-risk is a system improving the very methods it runs on, and the guardrails have to hold as it does.',
  },
},


'Coinbase (Crypto Exchange)': {
  meta: 'Fintech - crypto - very hard - a matching engine over irreversible money',
  overview: 'A crypto exchange is two hard systems fused: a low-latency trading engine and a vault holding billions in bearer assets. The trading side must match orders in a single deterministic sequence at microsecond speed; the custody side must keep private keys safe against an adversary who, if they succeed once, takes the money forever. What makes it harder than a stock exchange is finality: a blockchain transfer has no chargeback, no settlement reversal, no regulator who can claw it back - a bug that moves coins wrong is simply a theft. Every design choice bends to that fact.',
  scope: 'The order-matching path (market data, pre-trade risk, matching, internal ledger), custody (hot/cold split, MPC key management), on-chain settlement and reconciliation, and the regulatory spine (KYC/AML, sanctioned-address screening, immutable audit). The blockchains themselves and the banking rails for fiat on-ramp are consumed, not built.',
  fr: {
    core: ['Match buy and sell orders by price-time priority in a deterministic sequence', 'Check pre-trade risk (balance, limits) faster than the match', 'Keep an internal balances ledger that is instant and always correct', 'Custody assets safely: cold storage for the bulk, a bounded hot float for withdrawals', 'Settle deposits and withdrawals on-chain and reconcile against the ledger', 'Screen identity (KYC/AML) and withdrawals (sanctioned addresses)'],
    out: ['The consensus of the underlying blockchains (consumed via nodes)', 'Fiat banking rails (integrated, not operated)', 'Lending, staking and other products layered on top'],
  },
  nfr: {
    core: ['Determinism: the order book must process one sequence - the same orders in the same order produce the same trades, always', 'Custody safety is existential: no single failure, key or insider can move funds, because on-chain transfers are irreversible', 'Matching latency in microseconds; market data fan-out to thousands without slowing the book', 'The internal ledger is exact and auditable to the satoshi; reconciliation with the chain is continuous', 'Availability under load spikes - crypto volume is bursty and correlated with volatility, exactly when everyone arrives at once'],
    out: ['Instant on-chain finality - confirmation takes a variable number of blocks and cannot be rushed'],
  },
  nums: [['1 sequence', 'the order book is single-threaded by design - determinism over throughput'], ['~95%+', 'of funds in cold storage offline; only a bounded float is hot'], ['irreversible', 'the property that shapes everything: no chargebacks on-chain'], ['N blocks', 'to real finality - internal balance is instant, settlement is not']],
  entities: [
    ['Order', 'side, price, size, account; enters the book only after pre-trade risk clears'],
    ['OrderBook', 'the in-memory price-time-priority structure per market; the single sequencer of truth for who traded'],
    ['Balance', 'the internal ledger entry - instantly correct, reconciled against on-chain reality continuously'],
    ['Wallet', 'hot (bounded float, online) or cold (bulk, offline); keys split by MPC so no one party can sign alone'],
    ['Settlement', 'an on-chain transaction for a deposit or withdrawal, final after N confirmations, matched back to the ledger'],
  ],
  apiIntro: 'The API separates the fast path (trading against internal balances) from the slow path (on-chain movement), because one is microseconds and the other is minutes, and confusing them is how exchanges lose money.',
  api: [
    { dir: '->', name: 'POST /orders (pre-trade risk, then match)', body: '{ market, side, price, size }\n-> fill(s) against the book, sequenced deterministically; balances update on the internal ledger instantly' },
    { dir: '->', name: 'POST /withdrawals', body: '{ asset, amount, address }\n-> screened (sanctions), signed from the hot wallet via MPC, broadcast; final after N confirmations' },
    { dir: '<->', name: 'WS /market-data', body: 'the order book streamed to thousands of clients from a read path that never touches or slows the matching sequencer' },
  ],
  dives: [
    {
      title: 'The matching engine is single-threaded on purpose', focus: ['match', 'risk', 'ledger', 'md'],
      blocks: [
        ['p', 'An order book enforces price-time priority: the best price wins, and at equal price the earliest order wins. That "earliest" is the trap - it requires a single, total ordering of events, which is why serious matching engines run as one deterministic in-memory sequencer per market rather than a distributed system. The instant you shard the book across machines for throughput, you have two structures that can disagree about who was first, and in a market that disagreement is a lawsuit. So throughput is bought other ways: keep the book in memory, do pre-trade risk before the sequencer, and fan market data out on a completely separate read path so a million spectators never slow the one writer.'],
        ['bul', [
          'Determinism is the product: replay the same order sequence and get identical trades - it is how you audit, recover, and prove fairness.',
          'Pre-trade risk sits upstream of the match and must be faster than it: a trade that violated a limit cannot be un-sequenced, so the check happens before the order reaches the book.',
          'Market data is a read fan-out, isolated from the write path: thousands of streaming clients read a projection of the book, never the book itself.',
        ]],
        ['warn', 'The tempting mistake is to scale the matching engine horizontally like a web service. It is the one component you must NOT distribute for throughput, because correctness here is a single total order. You scale it vertically and by market (one sequencer per trading pair), and you make everything around it fast instead.'],
      ],
    },
    {
      title: 'Custody: where a bug is a theft', focus: ['custody', 'chain', 'settle', 'kyc'],
      blocks: [
        ['p', 'On a blockchain, whoever holds the private key holds the money, and a transfer once broadcast is final. That single fact dictates custody: keep the overwhelming majority of assets in cold storage - keys offline, air-gapped, physically secured - and keep only a bounded float hot for day-to-day withdrawals, so a total compromise of the online system caps the loss. Modern custody splits keys with MPC (multi-party computation) so that signing requires several parties and no single machine, person or breach ever holds a whole key. Withdrawals are screened against sanctioned addresses before signing, because sending to the wrong address is not a support ticket - it is gone.'],
        ['bul', [
          'Hot/cold split bounds the blast radius: the online float is the most you can lose to an online attack, by design.',
          'MPC means no single key exists to steal: the signing authority is distributed, so one compromised component cannot move funds.',
          'The internal ledger is instant; on-chain settlement is eventual: a user sees their balance immediately, but the coins are only truly theirs after N confirmations, and the system reconciles the two continuously.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A database of balances with a buy button.',
    senior: 'A single-threaded deterministic matching engine per market with pre-trade risk upstream and market data on an isolated read path, an exact internal ledger reconciled continuously against chain, hot/cold custody with MPC key splitting and sanctioned-address screening, and the whole thing built around the irreversibility of on-chain settlement.',
    staff: 'Design the guarantees at exchange scale: the recovery model for the matching engine (deterministic replay from the log), the custody threshold scheme and its operational security, the reconciliation system that proves internal balances match on-chain reality to the satoshi, the surge design for volatility-correlated load, and the regulatory posture of a money transmitter operating in microseconds across dozens of jurisdictions.',
  },
},

'Databricks (Lakehouse Compute)': {
  meta: 'Data platform - very hard - separate compute from storage and make failure normal',
  overview: 'Databricks is built on one architectural bet: separate compute from storage completely. Data sits permanently and cheaply in object storage; compute is summoned on demand, does its work, and disappears. That lets a data engineer request a thousand machines, crunch a petabyte for a few minutes, and release them - paying for the work, not for an always-on cluster sized to the worst case. Layered on top is the lakehouse idea: a transaction log over the data lake that gives cheap object storage the ACID guarantees, schema enforcement and time travel of an expensive warehouse. It is Spark\'s distributed-compute model turned into a managed product, where losing a machine mid-job is expected rather than catastrophic.',
  scope: 'The control plane (job and cluster orchestration, catalog, governance) and the data plane (Spark driver/executor compute over object storage with a transaction log), plus SQL warehouse endpoints and the ML lifecycle. The object store, the underlying cloud VMs, and the analytics questions themselves are consumed or downstream.',
  fr: {
    core: ['Provision compute clusters on demand and release them when the job ends', 'Run distributed Spark jobs (driver plans, executors crunch) over lake data', 'Give the lake ACID transactions, schema enforcement and time travel via a transaction log', 'Serve SQL queries through warehouse endpoints over the same data', 'Govern schema, lineage and access centrally across workspaces (the catalog)'],
    out: ['The object storage service itself (consumed)', 'The cloud provider\'s VM provisioning (abstracted)', 'The business meaning of the data (the customer\'s)'],
  },
  nfr: {
    core: ['Elasticity: thousands of nodes acquired in minutes and released after, so cost tracks work not capacity', 'Fault tolerance as the norm: executors die (spot reclaims, hardware) constantly, and jobs must recover from lineage, not restart', 'Transactional correctness on object storage: concurrent writes to a table do not corrupt it', 'Shuffle efficiency: the network regrouping of data between stages is the usual bottleneck of large jobs', 'Governance at scale: lineage and access control across every workspace and dataset'],
    out: ['Low-latency single-row lookups - this is analytical batch and SQL, not an OLTP key-value store'],
  },
  nums: [['1000s', 'of nodes per job, acquired and released on demand'], ['compute != storage', 'the core split - scale and bill each independently'], ['ACID on a lake', 'what the Delta transaction log buys the cheap object store'], ['seconds', 'the billing granularity - pay for work, not idle clusters']],
  entities: [
    ['Job', 'a unit of work (a notebook, a pipeline) the orchestrator schedules onto a cluster it may create just for this'],
    ['Cluster', 'an ephemeral driver + executor fleet, sized per job, released when done'],
    ['DeltaTable', 'data files in object storage plus a transaction log giving ACID, time travel and schema enforcement'],
    ['ShuffleStage', 'the point where executors exchange data across the network to regroup it - where big jobs spend their time'],
    ['CatalogObject', 'the governed schema/lineage/ACL entry - one source of truth for who may read what, everywhere'],
  ],
  apiIntro: 'The control plane accepts work and manages compute lifecycle; the data plane does the crunching. Keeping them separate is what lets compute be disposable and storage be permanent.',
  api: [
    { dir: '->', name: 'POST /jobs/run', body: '{ notebook, cluster_spec }\n-> the orchestrator provisions a cluster (or reuses a pool), runs it, and tears it down; you are billed for the seconds it ran' },
    { dir: '->', name: 'MERGE INTO delta_table ...', body: 'an ACID transaction on object storage - concurrent writers do not corrupt the table, and the prior version is still queryable (time travel)' },
    { dir: '->', name: 'GET /sql/warehouse (endpoint)', body: 'SQL over the same lake tables from BI tools, on a warehouse that autoscales and parks when idle' },
  ],
  dives: [
    {
      title: 'Compute and storage, torn apart', focus: ['orch', 'pool', 'drv', 'exec', 'lake'],
      blocks: [
        ['p', 'In an old-school warehouse, compute and storage are welded together: you buy a big box, and to store more you also buy compute you may not need, and vice versa. Databricks breaks the weld. Data lives in object storage - effectively infinite, cheap, durable - and compute is summoned when a job runs. The orchestrator provisions a cluster (often from a warm pool to skip startup lag), the Spark driver plans the work and coordinates, executors do the parallel crunching against the lake, and when the job ends the whole cluster is released. The result is that a petabyte at rest costs storage prices, and the thousand-node burst to process it costs only the minutes it ran.'],
        ['bul', [
          'Elasticity is the payoff: capacity matches the job, not the worst-case, so a nightly monster and a tiny query cost proportionally.',
          'Warm pools hide cold-start: pre-provisioned nodes let a cluster form in seconds, because waiting minutes for VMs to boot kills the interactive experience.',
          'The shuffle is the cost center: regrouping data across executors over the network is where large jobs spend their time - a good query plan minimizes it, a bad one drowns in it.',
        ]],
        ['warn', 'The failure that surprises newcomers: treating executors as reliable. On ephemeral, often-spot compute, executors vanish mid-job as a matter of routine. If the job is not built to recompute lost partitions from lineage on the survivors, every reclaimed node restarts the whole thing - and at a thousand nodes, something is always being reclaimed.'],
      ],
    },
    {
      title: 'A lake that behaves like a warehouse', focus: ['meta', 'lake', 'cat', 'sql2'],
      blocks: [
        ['p', 'A raw data lake is just files in a bucket, and files in a bucket have no transactions - two writers can corrupt each other, a half-finished write is visible, and there is no schema police. The lakehouse fixes this with a transaction log: an ordered record of every change to a table, sitting beside the data files. That log is what gives object storage ACID transactions (readers see a consistent snapshot), time travel (query the table as of last Tuesday), and schema enforcement (a bad write is rejected, not silently absorbed). Over it, the catalog governs schema, lineage and access across every workspace, so at petabyte scale the answer to who-can-read-what lives in one place.'],
        ['bul', [
          'The transaction log is the trick: metadata, not a new storage system, turns a lake into something transactional.',
          'Time travel falls out for free: because the log records versions, querying or rolling back to a past state is a metadata operation.',
          'Governance is centralized deliberately: lineage and ACLs in one catalog make access a compliance-grade answer, not a per-bucket guess.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A managed Spark cluster you SSH into.',
    senior: 'Full compute-storage separation with on-demand ephemeral clusters from warm pools, Spark driver/executor jobs that recompute from lineage through constant executor loss, a transaction log giving the lake ACID/time-travel/schema-enforcement, shuffle-aware query planning, and a central catalog for governance.',
    staff: 'Design the platform economics and guarantees: the pooling strategy that hides cold-start without paying for idle, the multi-tenant isolation across thousands of customers sharing the control plane, the transaction-log design that keeps concurrent writers correct at scale, and the lineage-based recovery that makes a thousand-node job on spot instances actually finish.',
  },
},

'Snowflake (Cloud Warehouse)': {
  meta: 'Data platform - hard - the multi-cluster shared-data warehouse',
  overview: 'Snowflake\'s insight was to take the two things a data warehouse couples - the storage of data and the compute that queries it - and separate them into three independent layers: a brain (cloud services: auth, metadata, query planning), muscle (virtual warehouses: isolated compute clusters), and a single shared body of data (one storage layer every warehouse reads). The consequence is the thing analysts feel: marketing\'s dashboards and finance\'s month-end run on entirely separate compute over the exact same tables, so they never fight for resources, and each scales and is billed on its own. Add columnar micro-partitions that let the optimizer skip most of the data, per-second auto-suspending compute, and zero-copy cloning, and the pricing model and the architecture become the same thing.',
  scope: 'The three layers - cloud services, virtual warehouses, shared storage - plus the features that fall out of the separation: result caching, zero-copy cloning, time travel, and secure data sharing. The cloud object store underneath and the BI tools on top are consumed.',
  fr: {
    core: ['Run each workload on its own virtual warehouse over shared data', 'Store data as columnar micro-partitions with metadata for pruning', 'Plan and optimize queries centrally (cloud services layer)', 'Auto-suspend and auto-resume compute so idle costs nothing', 'Clone tables with zero copy and query historical versions (time travel)', 'Share live data across accounts without copying it'],
    out: ['The underlying cloud object storage (consumed)', 'BI and visualization tools (integrated)', 'The transactional systems that feed it (upstream)'],
  },
  nfr: {
    core: ['Workload isolation: one warehouse\'s load never affects another\'s, because they are separate compute over shared storage', 'Independent elasticity: storage and each compute cluster scale and bill separately', 'Pruning efficiency: a selective query scans only the micro-partitions it needs', 'Elastic economics: per-second billing with auto-suspend so cost tracks queries, not uptime', 'Consistency of the single shared copy across all warehouses reading it'],
    out: ['Sub-millisecond OLTP writes - this is an analytical warehouse, not a transactional store'],
  },
  nums: [['3 layers', 'services, compute, storage - separated so each scales alone'], ['N warehouses', 'independent compute clusters over 1 shared copy of the data'], ['per-second', 'billing with auto-suspend - idle compute is free'], ['prune', 'scan the micro-partitions the query needs, skip the rest']],
  entities: [
    ['VirtualWarehouse', 'an isolated compute cluster; sized and billed per workload, auto-suspends when idle'],
    ['Micropartition', 'a columnar storage unit with metadata (min/max, counts) the optimizer uses to skip data'],
    ['Query', 'planned by the cloud services layer, executed on a warehouse, possibly answered from the result cache'],
    ['Clone', 'a zero-copy pointer-level duplicate of a table that diverges only as written'],
    ['Share', 'live read access to data granted to another account with no copy made'],
  ],
  apiIntro: 'A query names which warehouse runs it, but all warehouses see the same data - the separation of who-computes from what-is-stored is the entire API surface.',
  api: [
    { dir: '->', name: 'USE WAREHOUSE finance_wh; SELECT ...', body: 'runs on the finance cluster over shared tables; marketing_wh could run the same query simultaneously without either slowing down' },
    { dir: '->', name: 'CREATE TABLE t_clone CLONE t', body: 'a zero-copy clone - metadata pointers, not bytes; a full-scale sandbox created instantly and for free' },
    { dir: '->', name: 'SELECT ... AT (OFFSET => -3600)', body: 'time travel: query the table as it was an hour ago, because storage keeps versioned micro-partitions' },
  ],
  dives: [
    {
      title: 'Three layers, and why teams stop fighting', focus: ['gw', 'opt', 'wh1', 'wh2', 'wh3', 'store'],
      blocks: [
        ['p', 'The classic warehouse pain is contention: one team\'s giant query starves everyone else\'s, because they all share one pool of compute welded to the storage. Snowflake separates compute into independent virtual warehouses that all read one shared storage layer, coordinated by a central cloud services brain. Marketing runs on its warehouse, finance on theirs, data science on a third - same tables, isolated muscle - so the month-end crunch and the live dashboard simply cannot touch each other. Each warehouse resizes on its own, and because storage is shared, none of this duplicates a single byte of data.'],
        ['bul', [
          'Isolation by construction: separate compute clusters mean cross-team contention is architecturally impossible, not merely managed.',
          'Independent scaling: storage grows on its own; each warehouse scales up for a heavy job and back down after, alone.',
          'One copy of truth: every warehouse reads the same shared storage, so there is no sync, no drift, no per-team extract.',
        ]],
        ['warn', 'The bill surprise is the flip side of the freedom: because spinning up another warehouse is trivial, costs scale with how many you run and how long they stay awake. The discipline is auto-suspend and right-sizing - a warehouse left running idle is the cloud-warehouse version of leaving the lights on, and it is the single most common Snowflake cost mistake.'],
      ],
    },
    {
      title: 'Pruning, caching, and cloning for free', focus: ['store', 'rescache', 'clone', 'meta'],
      blocks: [
        ['p', 'Speed and cost in an analytical warehouse come from not doing work. Data is stored as columnar micro-partitions, each carrying metadata like the min and max values it holds, so the optimizer can skip entire partitions a query cannot possibly need - a scan over one day of a ten-year table reads that day\'s partitions and ignores the rest. Repeated queries are served from a result cache without touching compute at all. And zero-copy cloning exploits the same metadata layer: duplicating a huge table copies pointers, not data, so every engineer gets a full-size sandbox instantly and for nothing, diverging from the original only as they write to it.'],
        ['bul', [
          'Pruning is the performance story: metadata-driven partition-skipping means you pay to scan what the question needs, not the table\'s size.',
          'The result cache is free reuse: an identical query returns from cache with zero compute cost.',
          'Zero-copy clone is a metadata trick: instant, free, full-scale copies for testing, because bytes are shared until written.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A hosted SQL database that scales up.',
    senior: 'Three separated layers (services, compute, storage) with isolated virtual warehouses over one shared copy, columnar micro-partitions with metadata pruning, per-second auto-suspending compute, result caching, and zero-copy cloning - with the pricing model treated as part of the architecture.',
    staff: 'Design the separations and their economics at scale: how the cloud services layer stays highly available as the coordination point for everything, how metadata pruning is kept effective as data grows, how multi-cluster warehouses handle concurrency bursts, and how the shared-storage consistency model holds while dozens of independent compute clusters read and write it.',
  },
},

'Nvidia (GPU Cloud Scheduler)': {
  meta: 'Infrastructure - very hard - scheduling the scarcest resource in computing',
  overview: 'When the most expensive thing in your datacenter is the accelerator, the product is not the GPU - it is the scheduler that keeps GPUs from sitting idle. A GPU cloud takes a fleet of scarce, costly cards and rents them as training and inference capacity, and every design decision serves one goal: maximum useful utilization of the fleet. That turns out to be a genuinely hard scheduling problem, because GPU jobs are not like web requests. A big training run needs hundreds of cards simultaneously or none of them; where the cards sit relative to each other changes how fast the job runs; a whole card is wasteful for a small inference model; and jobs run for days on hardware that fails constantly. The scheduler that solves all of that well is the entire business.',
  scope: 'The scheduling and lifecycle of GPU jobs: gang scheduling and bin-packing, quota and fair-share, topology-aware placement, MIG partitioning for sharing, checkpoint-enabled preemption, GPU health, and usage metering. The physical accelerators, the interconnect fabric, and the models being trained are the substrate and the payload, not this system.',
  fr: {
    core: ['Schedule jobs onto GPUs to maximize fleet utilization', 'Gang-schedule distributed training: all N GPUs at once or none', 'Place jobs topology-aware (NVLink within a node, fabric across nodes)', 'Partition GPUs (MIG) so small jobs share a card without interference', 'Preempt and resume long jobs via checkpoints for higher-priority work', 'Enforce quota/fair-share and meter usage for billing'],
    out: ['Manufacturing the accelerators (the substrate)', 'The interconnect fabric hardware (consumed as topology)', 'The ML work inside the jobs (the tenant\'s)'],
  },
  nfr: {
    core: ['Utilization is the primary metric: an idle GPU is the dominant, unacceptable waste', 'Gang-scheduling correctness: partial placement of a distributed job wastes held GPUs while it waits', 'Topology-awareness: placement quality can matter more to job speed than raw GPU count', 'Preemptibility: long jobs must checkpoint so the scheduler can reclaim and resume them', 'Fault tolerance: at thousands of cards, hardware failure is constant and must not fail whole jobs'],
    out: ['Low-latency interactive scheduling decisions - throughput and packing quality beat scheduler latency here'],
  },
  nums: [['idle = waste', 'the one metric that matters: keep every card busy'], ['all-or-none', 'gang scheduling - a 512-GPU job needs all 512 at once'], ['NVLink vs fabric', 'topology decides speed - close placement can beat more cards'], ['1 card, N tenants', 'MIG slices a GPU so small jobs share it']],
  entities: [
    ['Job', 'a training or inference workload with a GPU count, priority, and a checkpoint cadence'],
    ['GangRequest', 'an all-or-nothing claim on N GPUs that must be placed together or not at all'],
    ['Placement', 'the chosen set of GPUs for a job, scored by topology (co-located beats scattered)'],
    ['MIGSlice', 'a fraction of a physical GPU handed to a small job so a card serves several tenants'],
    ['Checkpoint', 'a saved job state that lets the scheduler preempt and later resume rather than restart'],
  ],
  apiIntro: 'The API is a request for capacity with a shape - how many GPUs, together or not, at what priority - and the scheduler\'s job is to satisfy that shape while wasting nothing.',
  api: [
    { dir: '->', name: 'POST /jobs (gpus: 512, gang: true, priority: high)', body: 'placed all-at-once and topology-close, preempting lower-priority checkpointed jobs if needed to assemble the 512' },
    { dir: '->', name: 'POST /jobs (gpus: 0.25, mig: true)', body: 'a small inference job gets a MIG slice of a shared card, isolated from the co-tenants on the same GPU' },
    { dir: '<->', name: 'scheduler.tick()', body: 'continuously re-packs the fleet: place queued gangs, preempt low-value runs to checkpoints, keep every card busy with the best available work' },
  ],
  dives: [
    {
      title: 'Gang scheduling and the topology map', focus: ['sched', 'queue', 'train', 'fabric'],
      blocks: [
        ['p', 'A distributed training job is atomic in a way web work never is: 512 GPUs computing one model must all start together, because they synchronize every step - 511 cards waiting on a 512th that never got placed is 511 cards of pure waste. So the scheduler gang-schedules: it places the whole job or none of it, and it bin-packs the fleet so these all-or-nothing blocks fit without stranding capacity. Then topology enters: GPUs inside one node share ultra-fast NVLink, while cards across nodes talk over slower fabric, and a synchronizing job is only as fast as its slowest link. Placing a job\'s workers physically close can matter more to its wall-clock time than which specific cards they are, so the scheduler is topology-aware or it silently makes every big job slow.'],
        ['bul', [
          'All-or-nothing placement: a partially-placed gang wastes the GPUs it holds while blocked, so the scheduler never half-commits.',
          'Bin-packing for the next job: leave contiguous room so the next 512-GPU request can be assembled, rather than fragmenting the fleet.',
          'Topology-aware or slow: co-locate a job\'s workers to keep them on fast interconnect, because the network between GPUs is often the real bottleneck.',
        ]],
        ['warn', 'Scheduling GPUs like CPU pods - one card to whoever asks, first-come-first-served - fragments the fleet and starves big jobs: enough scattered single-GPU jobs can make it impossible to ever assemble 512 contiguous cards, so the most valuable work can never run even though utilization looks fine.'],
      ],
    },
    {
      title: 'Sharing cards and surviving failure', focus: ['infer', 'health', 'ckpt', 'meter'],
      blocks: [
        ['p', 'Two more realities shape the scheduler. First, granularity: a small inference model that needs a tenth of a GPU should not be handed a whole one, so MIG partitioning slices a physical card into isolated instances that several tenants share without interfering - the same anti-waste principle as not leaving a card idle. Second, failure: training runs for days across thousands of cards, and at that scale something is always failing, so jobs checkpoint frequently. Checkpoints do double duty - they make the fleet resilient to hardware death, and they make jobs preemptible, so the scheduler can pause a lower-priority run, hand its GPUs to something urgent, and resume it later from its last checkpoint. That is what turns a rigid queue into a living market for compute.'],
        ['bul', [
          'MIG for small jobs: slicing a card to share it safely is the inference-side version of keeping GPUs busy.',
          'Checkpoints enable preemption: a job that can resume from a checkpoint can be paused for higher-value work instead of blocking it.',
          'Failure is the steady state: at thousands of cards, recovery-from-checkpoint is a routine event, not an incident.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A queue that hands out GPUs in order.',
    senior: 'Gang scheduling with bin-packing so distributed jobs are placed all-or-nothing, topology-aware placement across NVLink and fabric, MIG partitioning to share cards among small jobs, checkpoint-enabled preemption that turns the queue into a priority market, and utilization as the metric everything serves.',
    staff: 'Design the scheduling economics at fleet scale: the packing algorithm that maximizes utilization while keeping room for large gangs, the fair-share and preemption policy across competing tenants and priorities, the topology model that reflects real interconnect performance, and the checkpoint/recovery system that makes multi-day training on constantly-failing hardware both resilient and preemptible.',
  },
},


'PostgreSQL at Scale (Primary + Replicas)': {
  meta: 'Data infrastructure - hard - the single-primary relational database, scaled honestly',
  overview: 'PostgreSQL is the relational database most of the modern web is built on, and this template is about the shape every serious Postgres deployment converges to when one machine is no longer enough: a single primary that takes all writes, a fleet of read replicas that scale reads by replaying the primary\'s write-ahead log, and a connection pooler in front so the app\'s thousands of threads do not each become a database process. The single-primary model is not a flaw to engineer away - it is precisely what lets Postgres offer strong single-node consistency and real ACID transactions. The entire craft is understanding what that model gives you (correctness, simplicity) and what it costs you (a write ceiling, and replication lag on every read replica), and designing with both eyes open.',
  scope: 'The primary/replica topology, the write-ahead log as the spine of durability/replication/recovery, connection pooling, read/write routing and its lag pitfalls, point-in-time recovery, and logical decoding for CDC. Query and schema design, and sharding for write scale beyond one primary, are noted at the boundaries.',
  fr: {
    core: ['Take all writes on one primary with full ACID guarantees', 'Scale reads across replicas that replay the WAL', 'Pool connections so thousands of clients share a bounded set of backends', 'Route reads to replicas or the primary depending on freshness need', 'Recover to any point in time from base backups + archived WAL', 'Stream changes downstream via logical decoding (CDC)'],
    out: ['Multi-primary / active-active writes (a different, much harder consistency model)', 'Horizontal write sharding (the next step beyond one primary)', 'The application\'s query and schema design (the biggest performance lever, but the app\'s)'],
  },
  nfr: {
    core: ['Write correctness: one primary, one authority, real serializable-capable transactions', 'Read scalability: replicas absorb read load that would otherwise crush the primary', 'Bounded connections: a pooler keeps backend process count sane under thousands of clients', 'Durability: no committed write is lost - the WAL fsync is the guarantee', 'Recoverability: PITR to any instant, and a promotable replica for primary failure'],
    out: ['Zero replication lag - it is milliseconds, not zero, and the design must tolerate it'],
  },
  nums: [['1 primary', 'all writes, one authority - the source of the consistency model'], ['N replicas', 'read scaling by WAL replay; lag is small but never zero'], ['fsync', 'the commit is not real until the WAL hits disk - that is durability'], ['PITR', 'base backup + archived WAL restores to any moment']],
  entities: [
    ['Primary', 'the single node accepting writes; its WAL is the truth every replica and backup derives from'],
    ['Replica', 'a read-only node continuously replaying the primary\'s WAL, moments behind, promotable on failover'],
    ['WAL', 'the write-ahead log: fsync\'d before commit ack (durability), streamed to replicas (replication), archived (recovery), decoded (CDC)'],
    ['Pooler', 'PgBouncer or similar; multiplexes thousands of client connections onto a small pool of real backends'],
    ['Snapshot', 'the MVCC view a transaction reads - consistent as of its start, so readers never block writers'],
  ],
  apiIntro: 'There is no special API - it is SQL over the wire - but the routing decision (primary vs replica) is the design surface, because it is where consistency meets scale.',
  api: [
    { dir: '->', name: 'write: INSERT / UPDATE / DELETE -> primary', body: 'always the primary; committed only after the WAL is fsync\'d - the durability contract, paid in ≈10ms of disk latency' },
    { dir: '->', name: 'read (fresh): SELECT -> primary', body: 'route here when the read must reflect the caller\'s own just-made write - the read-your-writes case' },
    { dir: '->', name: 'read (lag-tolerant): SELECT -> replica', body: 'route the bulk of reads here to scale, accepting that the data is milliseconds-to-seconds behind the primary' },
  ],
  dives: [
    {
      title: 'One primary, and the lag on every replica', focus: ['primary', 'r1', 'r2', 'wal', 'router'],
      blocks: [
        ['p', 'The defining choice is a single primary for writes. It sounds like a bottleneck, but it is the thing that makes Postgres simple to reason about: one node decides the order of all writes, so there is one truth and no write conflicts to resolve. Reads scale out to replicas, each of which stays current by continuously replaying the primary\'s write-ahead log - and because that replay takes time, every replica is a few milliseconds behind. That replication lag is small, it is normal, and it is the source of the one bug everyone hits: read-your-writes. A user saves their profile (a write, to the primary) and immediately reloads it (a read, routed to a lagging replica) and sees the stale value. The fix is not to eliminate lag - you cannot - but to route reads that must be fresh to the primary, and send only the lag-tolerant majority to replicas.'],
        ['bul', [
          'Single primary = single source of write order: no conflicts to merge, which is exactly why the consistency model is easy.',
          'Replicas scale reads, not writes: adding replicas buys read throughput and nothing else - the write ceiling is unchanged.',
          'Route by freshness: fresh-required reads to the primary, lag-tolerant reads to replicas; getting this split right is the whole game.',
        ]],
        ['warn', 'The seductive wrong answer to a write bottleneck is a second primary (multi-primary / active-active). It trades your simple, correct single-node consistency for the hardest problem in databases - conflicting concurrent writes on two authorities - and most teams that reach for it did not actually need it. The real answers to a write ceiling are cheaper writes (batching, indexing, offloading) first, and sharding (many primaries, each owning a slice of the data, never the same rows) only when you genuinely must.'],
      ],
    },
    {
      title: 'The WAL does four jobs, and the pooler saves the primary', focus: ['wal', 'pool', 'backup', 'cdc'],
      blocks: [
        ['p', 'The write-ahead log is the most load-bearing idea in the system, because it is durability, replication, recovery and change-capture all at once. A commit is not acknowledged until its WAL record is fsync\'d to disk - that single fsync is what durability means, and it is why a commit costs milliseconds. That same log is streamed to replicas to keep them current, archived alongside periodic base backups so the database can be restored to any instant (point-in-time recovery), and decoded logically to feed change-data-capture pipelines downstream - the disciplined alternative to dual-writes. Separately but just as important: connections are expensive in Postgres, because each one is a real backend process holding real memory. Thousands of application threads opening direct connections will exhaust the database on connection count alone, before query load is even the issue - so a pooler like PgBouncer multiplexes them onto a small, bounded set of backends, and it is not optional at scale.'],
        ['bul', [
          'One log, four jobs: durability (fsync before ack), replication (stream to replicas), recovery (archive for PITR), and CDC (logical decoding).',
          'The fsync is the durability contract: commit latency is disk latency, and that is the price of never losing an acknowledged write.',
          'Pool or perish: each connection is a process; without PgBouncer, connection count - not throughput - is what takes the primary down.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A database with a backup.',
    senior: 'A single write primary with read replicas replaying the WAL, freshness-aware read/write routing that handles read-your-writes, connection pooling so backend process count stays bounded, WAL as the unified spine of durability/replication/PITR/CDC, and a clear-eyed account of the write ceiling and when (not whether) to reach for sharding.',
    staff: 'Design the operational guarantees: the failover procedure (replica promotion, fencing the old primary, and the data-loss window of async vs sync replication), the PITR strategy a real recovery would depend on, the connection-pooling topology across many services, the CDC design that keeps downstream systems consistent, and the honest sharding plan for the day one primary is genuinely not enough - including how the application changes when a query can no longer join across shards.',
  },
},

}
