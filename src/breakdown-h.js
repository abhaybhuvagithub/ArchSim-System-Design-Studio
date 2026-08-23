// Authored breakdowns, part 8 — the interview classics. Shape documented in breakdown.js.
export default {

'Tinder': {
  meta: 'consumer - medium - the deck is precomputed, the match is a race',
  overview: 'Swipe-based matching. The read side is a deck of candidates that must feel instant and local; the write side is a firehose of swipes that only matter when two of them agree. The interesting engineering is that a match is a race between two people\'s writes.',
  scope: 'The recommendation deck, swipe ingestion, match detection and the match moment. Messaging after the match, payments and trust/safety review queues are below the line.',
  fr: {
    core: ['Serve a deck of nearby candidates matching preferences', 'Record swipes (like/pass) at high volume', 'Detect a mutual like and create a match', 'Notify both people within a second of the match'],
    out: ['Chat after matching', 'Boosts and payments', 'Manual review tooling'],
  },
  nfr: {
    core: ['Deck loads feel instant - candidates are precomputed, not queried live', 'Swipe writes are cheap and lossy-tolerant until they become a match', 'Match creation is exactly-once even when both swipes land in the same millisecond', 'Geo sharding keeps a city\'s traffic in its shard'],
    out: ['Global consistency of the deck - staleness of minutes is invisible'],
  },
  nums: [['~2B', 'swipes a day at full scale'], ['~1%', 'of swipes become matches'], ['<1s', 'from mutual like to both phones buzzing'], ['minutes', 'of acceptable deck staleness']],
  entities: [
    ['Profile', 'photos, bio, preferences - the thing being swiped on'],
    ['Deck', 'an ordered batch of candidate profiles, precomputed per user'],
    ['Swipe', 'one directed judgement: (from, to, like|pass, ts)'],
    ['Match', 'the mutual pair - transactional, pushed to both sides'],
  ],
  apiIntro: 'REST for decks and swipes. The swipe response is where the match surprise arrives.',
  api: [
    { dir: '->', name: 'GET /deck', body: '-> { candidates[] } - precomputed, geo-filtered, ranked' },
    { dir: '->', name: 'POST /swipe', body: '{ targetId, dir }\n-> { matched: false } | { matched: true, matchId }' },
  ],
  dives: [
    {
      title: 'Match detection as a race two writers can win once', focus: ['sw', 'scache', 'mw'],
      blocks: [
        ['p', 'When A likes B, the system asks one question: did B already like A? The swipe cache answers it in one read. If yes, create the match - but B\'s like may be landing on another node at the same instant, and both sides discovering mutuality must still produce exactly one match.'],
        ['bul', [
          'The match insert is idempotent on the ordered pair (min(A,B), max(A,B)) - two racing creators collapse to one row.',
          'Swipes stream to durable storage async; the cache is the hot mutual-check path.',
          'A lost pass is invisible; a lost like costs one potential match - tolerable. A doubled match is a product bug everyone screenshots.',
        ]],
      ],
    },
    {
      title: 'The deck: recommendation as a batch product', focus: ['rec', 'geo'],
      blocks: [
        ['p', 'Nothing about the deck is computed at request time. Geo shards hold candidates by cell; a ranking pass orders them by preference fit and activity; the deck endpoint pages through a precomputed list and filters already-swiped ids.'],
        ['bul', [
          'Geo sharding follows population, not geometry - Mumbai is many shards, Ladakh is a corner of one.',
          'Already-swiped filtering is a bloom-filter check per candidate, not a join.',
          'Deck exhaustion is a real state: widening radius and relaxing filters is a product policy the API must express.',
        ]],
        ['note', 'Staleness is fine; emptiness is not. A slightly old deck beats a spinner every time.'],
      ],
    },
  ],
  bar: {
    mid: 'A profile store, a swipe endpoint, mutual-like check, push on match.',
    senior: 'Precomputed geo decks, cache-first mutual detection, idempotent match creation under racing writes.',
    staff: 'Design the shard-per-city capacity model, the already-swiped filter at billions of pairs, and the failure story for a lost like vs a doubled match.',
  },
},

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

}
