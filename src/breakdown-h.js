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

}
