// Authored breakdowns, part 1 of 4. Shape documented in breakdown.js.
// High-Level Design is derived from the graph unless a template sets `hld`.

export default {

'URL Shortener (Bitly)': {
  meta: 'Scaling reads · easy · the classic warm-up',
  overview: 'A URL shortener takes a long URL and produces a short one that redirects to it. Bitly, TinyURL and the link shortener behind every social platform are the same system: a trivial write path and a read path that has to survive being one of the busiest endpoints on the internet.',
  scope: 'The problem is deceptively simple, so precision is what distinguishes a good answer from a passable one. Two functional requirements carry the whole interview, and the depth lives in three questions: how codes stay unique, how redirects stay fast, and what breaks at a billion URLs. Analytics, accounts and abuse scanning are below the line.',
  fr: {
    core: [
      'Users should be able to submit a long URL and receive a shortened version.',
      'Optionally, users should be able to specify a custom alias.',
      'Optionally, users should be able to specify an expiration date.',
      'Users should be able to access the original URL by using the shortened URL.',
    ],
    out: ['User accounts and dashboards', 'Click analytics and reporting', 'Link preview generation', 'Malware and abuse scanning'],
  },
  nfr: {
    core: [
      'Short codes must be unique — no two long URLs ever map to the same code.',
      'Redirects should resolve with low latency, around 200ms.',
      'The system should be highly available, 99.99%, favouring availability over consistency.',
      'Scale to support 1B shortened URLs and 100M daily active users.',
    ],
    out: ['Strong consistency between writing a link and it becoming redirectable'],
  },
  nums: [
    ['1B', 'shortened URLs stored'],
    ['100M', 'daily active users'],
    ['~100M/day', 'redirects ≈ 1,160/s average'],
    ['~1K/day', 'new URLs — writes are negligible'],
    ['~100:1', 'read to write ratio'],
    ['~500 GB', 'at 500 bytes per row for 1B URLs'],
  ],
  entities: [
    ['Original URL', 'the long URL a user submitted — the thing we are pointing at'],
    ['Short URL', 'the generated short code, plus its optional custom alias and expiry'],
    ['User', 'the creator of a link. Out of scope to manage, but named because aliases and expiry belong to someone'],
  ],
  apiTitle: 'The API',
  apiIntro: 'Two endpoints, matching the two functional requirements almost exactly. Writes are infrequent enough that plain REST is right, and the read is a single GET the browser issues on its own.',
  api: [
    { dir: '→', name: 'POST /urls', body: '{\n  "longUrl": "https://example.com/very/long/path",\n  "customAlias": "my-link",     // optional\n  "expirationDate": "2026-12-31" // optional\n}\n→ 201 { "shortUrl": "https://short.ly/my-link" }' },
    { dir: '→', name: 'GET /{shortCode}', body: '→ 302 Found\nLocation: https://example.com/very/long/path' },
  ],
  apiNote: 'Use **302 Found**, not 301 Moved Permanently. A 301 lets browsers cache the redirect indefinitely, which means you can never revoke a link, never change where it points, and never see the traffic. The small cost is that every redirect comes back to you — which is exactly what the rest of this design is built to absorb.',
  hld: [
    {
      id: 'hld-1', h: 2, title: '1) Users should be able to submit a long URL and receive a shortened version',
      focus: ['c', 'lb', 'app', 'db'],
      blocks: [
        ['p', 'Start with the simplest thing that satisfies the requirement: a client posts a long URL, a service generates a short code, and the pair is written to a database.'],
        ['steps', [
          'The client sends POST /urls with the long URL and any optional alias or expiry.',
          'The service validates the URL and, if a custom alias was supplied, checks it is not already taken.',
          'Otherwise the service generates a unique short code — how, exactly, is deep dive 1.',
          'The mapping is written to the database, keyed by short code.',
          'The service returns the full short URL.',
        ]],
        ['p', 'The database here is a simple key-value lookup: **shortCode → longUrl**, with created and expiry timestamps alongside. There are no relationships to traverse and no queries other than "give me the row for this code", which means almost any store works and the choice can be driven by operational preference rather than data modelling.'],
        ['note', 'Write volume is tiny. At 1,000 new URLs a day this path could run on a single modest instance forever. Resist the urge to scale it — every minute spent here is a minute not spent on the read path, which is where the system actually lives or dies.'],
      ],
    },
    {
      id: 'hld-2', h: 2, title: '2) Users should be able to access the original URL by using the shortened URL',
      focus: ['c', 'cdn', 'lb', 'app', 'db'],
      blocks: [
        ['p', 'The read path is the product. Someone clicks a short link, and the only acceptable outcome is arriving at the right page quickly.'],
        ['steps', [
          'The browser issues GET /{shortCode}.',
          'The service looks up the code and finds the long URL.',
          'It checks the link has not expired.',
          'It responds 302 with a Location header pointing at the original URL.',
          'The browser follows the redirect. Total work: one lookup.',
        ]],
        ['warn', 'A code that does not exist must return 404, not a redirect to somewhere plausible. Short codes are guessable enough that an open redirect here becomes a phishing tool pointed at your domain.'],
        ['p', 'This works, and at low traffic it works well. The two things that will break it — collisions on the write side and database load on the read side — are the deep dives.'],
      ],
    },
  ],
  dives: [
    {
      title: 'How can we ensure short urls are unique?',
      focus: ['app', 'db'],
      blocks: [
        ['p', 'Every short code must map to exactly one long URL, forever. Get this wrong and two users\' links collide, which silently sends someone to the wrong destination — arguably the worst failure this system can have.'],
        ['p', 'First, size the keyspace. Base62 uses [a-zA-Z0-9], so a code of length **n** gives 62ⁿ possibilities. Six characters is roughly 56 billion, comfortably more than the billion URLs we need. Seven gives 3.5 trillion and costs one extra character. Six or seven is the right answer; the interesting part is how you allocate within it.'],
      ],
      options: [
        {
          rating: 'Bad', title: 'Generate a random code and check for collisions',
          approach: 'Produce six random base62 characters, query the database to see whether the code exists, and retry if it does.',
          challenges: 'Every write now costs a read, and as the keyspace fills the retry rate climbs. Worse, the check-then-write is not atomic: two concurrent writers can both find a code free and both take it. You can fix that with a conditional insert, but you are now paying for a race you did not need to have.',
        },
        {
          rating: 'Good', title: 'Hash the long URL and truncate',
          approach: 'Take MD5 or SHA-256 of the long URL and use the first six or seven base62 characters. Deterministic, no coordination required, and the same URL naturally produces the same code.',
          challenges: 'Truncating a hash reintroduces collisions — you are compressing an enormous space into 56 billion slots, and the birthday paradox arrives sooner than intuition suggests. You still need a collision check on write. Determinism also fights the requirements: two users shortening the same URL get the same code, so they cannot have different aliases or different expiry dates.',
        },
        {
          rating: 'Great', title: 'Base62-encode a monotonic counter',
          approach: 'Keep a global counter. Each new URL takes the next value and encodes it to base62. Collisions become impossible by construction — no check, no retry, no race. To keep the counter off the hot path, hand each service instance a block of a thousand values from a coordination service, and let it allocate locally until the block runs out.',
          challenges: 'Codes come out sequential, so they are enumerable — anyone can walk your entire link corpus by counting. The fix is to permute the counter through a bijective function (a Feistel network or a simple XOR-and-multiply) before encoding: uniqueness is preserved exactly, ordering is destroyed. Block allocation also means a crashed instance leaves a gap of unused codes, which is harmless.',
          best: true,
        },
      ],
      after: [
        ['note', 'Custom aliases live in the same keyspace and are checked with a conditional insert on the short-code key. That single uniqueness constraint in the database is what makes both paths safe, and it is worth saying out loud — it is the one piece of consistency this system genuinely needs.'],
      ],
    },
    {
      title: 'How can we ensure that redirects are fast?',
      focus: ['cdn', 'cache', 'app'],
      blocks: [
        ['p', 'The target is around 200ms, and a database round trip on every redirect will not comfortably get you there once you are global — a user in Sydney hitting a database in Virginia has already spent most of the budget on physics.'],
        ['p', 'Two properties make this easy. Link popularity follows a savage power law: a tiny fraction of links absorb the overwhelming majority of clicks. And a mapping is effectively **immutable** — once created, a short code points at the same URL forever. Immutable, heavily-skewed data is the ideal caching workload.'],
        ['h', 'Cache the hot links in memory'],
        ['p', 'Put an in-memory cache in front of the database with an LRU eviction policy. The hot set is small and the access pattern concentrates it further, so hit rates well above 95% are normal. A hit costs about a millisecond; only misses reach the database.'],
        ['p', 'Cache invalidation, the usual hard problem, is nearly free here because the data does not change. Deletion and expiry are the only mutations, and a short TTL covers both without any invalidation protocol.'],
        ['h', 'Push the redirect to the edge'],
        ['p', 'A 302 response is a few hundred bytes and perfectly cacheable, so a CDN can serve it from a point of presence near the user without ever contacting your origin. That collapses the latency to whatever the user\'s distance to the nearest edge is, which is the best you can do.'],
        ['warn', 'Edge caching is the one thing that genuinely conflicts with revocation. Once a redirect is cached in a hundred locations you cannot pull a malicious link instantly. Keep the edge TTL short — sixty seconds is a reasonable compromise — and accept a bounded window rather than trying to purge globally.'],
        ['note', 'A third layer is worth mentioning if pushed: a small in-process LRU on each service instance holding the few thousand hottest codes. It removes even the cache network hop and costs a few megabytes. It is also what saves you when one link goes viral and concentrates on a single cache shard.'],
      ],
    },
    {
      title: 'How can we scale to support 1B shortened urls and 100M DAU?',
      focus: ['c', 'cdn', 'lb', 'app', 'cache', 'db'],
      blocks: [
        ['calc', 'Storage: 1B URLs × ~500 bytes ≈ 500GB. That fits on a single well-provisioned machine, so sharding is not required for capacity — a genuinely useful thing to notice out loud rather than reflexively sharding.'],
        ['calc', 'Throughput: 100M DAU generating roughly 100M redirects a day is about 1,160 requests/second on average, with peaks perhaps three to five times that. Writes stay near 1,000/day. The asymmetry is the whole story.'],
        ['h', 'Separate the read path from the write path'],
        ['p', 'They have opposite traffic profiles and opposite failure tolerances. A write outage means nobody can create a link for a while, which is an inconvenience. A read outage breaks every link ever shared, everywhere, permanently until fixed. Splitting them lets you scale the read fleet independently and give it a much stronger availability target.'],
        ['h', 'Scale the datastore'],
        ['p', 'Reads dominate, so add read replicas and serve redirects from them. The write path continues to talk to the primary. Replication lag is acceptable here: a link that is not redirectable for a second after creation is fine, which is exactly why we chose availability over consistency in the requirements.'],
        ['p', 'If you do reach the point of sharding, shard on the short code itself. It is the only access key, so every query touches exactly one shard and there is never a scatter-gather.'],
        ['h', 'Scale the cache'],
        ['p', 'A single cache node has finite memory and finite network. Shard by short code so the hot set spreads across nodes, and replicate hot keys so one viral link cannot saturate a single shard.'],
        ['h', 'What stays single'],
        ['p', 'The counter. At a thousand writes a day it needs no scaling at all, and block allocation means even a hundred times that volume would only produce one coordination call per thousand URLs. Keeping a single logical counter is what makes collision-free codes possible, and there is no pressure to give that up.'],
      ],
    },
  ],
  finalDesign: {
    focus: ['c', 'cdn', 'lb', 'app', 'cache', 'db'],
    blocks: [
      ['p', 'Putting it together, the finished system reads as two paths through the same components.'],
      ['h', 'Writing a link'],
      ['steps', [
        'POST /urls reaches the API through the load balancer.',
        'The service takes the next value from its locally-allocated counter block, permutes it and encodes to base62 — or validates the requested custom alias.',
        'The mapping is written to the primary with a uniqueness constraint on the short code.',
        'The short URL is returned. Roughly 1,000 of these happen per day.',
      ]],
      ['h', 'Following a link'],
      ['steps', [
        'The browser requests the short URL. Most of the time a CDN edge answers with a cached 302 and the origin never hears about it.',
        'On an edge miss, the request reaches a redirect service instance.',
        'The instance checks its in-process LRU, then the shared cache. Well over 95% of requests are answered here.',
        'Only on a cache miss does it read from a database replica, populate the cache, and respond.',
        'A 302 with the Location header sends the browser onward.',
      ]],
      ['note', 'The shape worth remembering: a write path that is deliberately boring and a read path with three layers of cache in front of a replicated store. The counter is the only piece of coordination in the entire design, and it is what buys collision-free codes with no checks and no races.'],
    ],
  },
  bar: {
    mid: 'Land both endpoints, a sensible short-code scheme you can defend, and a cache in front of the database. Expect to be asked why 302 rather than 301, and to justify your code length with the base62 arithmetic.',
    senior: 'Reach the counter scheme quickly and explain precisely why hashing and random-with-retry are worse. Split reads from writes without prompting, and raise the hot-key problem before the interviewer does.',
    staff: 'Cover counter block allocation and what happens when an instance dies mid-block, the permutation that makes sequential codes unguessable, multi-region read placement, and the revocation window that aggressive edge caching creates.',
  },
},

'Ticketmaster': {
  meta: 'Dealing with contention · medium · the booking problem',
  overview: 'Sell tickets to events where ten million people arrive the instant sales open. Browsing is a cacheable read problem; booking is a brutal contention problem where being wrong is unacceptable.',
  scope: 'Split the system in two on the first sentence: browsing and booking have opposite characteristics and should be discussed separately. Dynamic pricing and resale are below the line — booking correctness under load is the interview.',
  planning: 'Establish that seat state needs strong consistency and that payment is slow and external. Those two facts together force the two-phase reserve-then-confirm shape, and everything else — the waiting room, the lock TTL, the caching — follows from it.',
  fr: {
    core: ['Browse and search events', 'View a seat map with availability', 'Hold seats while the buyer completes checkout', 'Book and pay for specific seats'],
    out: ['Dynamic pricing', 'Resale marketplace', 'Venue and event management tooling'],
  },
  nfr: {
    core: ['No double-booking under any circumstances', 'Survive a ten-million-user on-sale spike', 'Browsing stays available when booking is saturated', 'Seat map fresh within a few seconds'],
    out: ['Globally consistent multi-region writes'],
  },
  nums: [['10M', 'users at the on-sale moment'], ['~50K', 'seats in a large venue'], ['1M+/s', 'seat-map reads if uncached'], ['~5K/s', 'actual booking attempts']],
  entities: [
    ['Event', 'performer, venue, datetime, on-sale time'],
    ['Seat', 'event + section + row + number, with a state'],
    ['Hold', 'a temporary claim on seats with a TTL'],
    ['Booking', 'user, seats, status, payment reference'],
  ],
  apiIntro: 'REST for browsing. Booking needs an explicit two-phase shape because payment takes seconds and you cannot hold a database transaction open that long.',
  api: [
    { dir: '→', name: 'GET /events/{id}/seats', body: '→ { sections: [{ seats: [{id, status, price}] }] }' },
    { dir: '→', name: 'POST /bookings/reserve', body: '{ eventId, seatIds[] }\n→ { holdId, expiresAt }' },
    { dir: '→', name: 'POST /bookings/confirm', body: '{ holdId, paymentToken }\n→ { bookingId, status }' },
  ],
  dives: [
    {
      title: 'Two people click the same seat', focus: ['book', 'lock', 'sql'],
      blocks: [['p', 'Only one may win, and the loser must find out immediately rather than after being charged.']],
      options: [
        { rating: 'Bad', title: 'Check availability, then write', approach: 'Read the seat status, show it as available, write the booking once the user pays.', challenges: 'A textbook race. Both users see "available", both pay, one gets a seat and the other gets an error after their card is charged.' },
        { rating: 'Good', title: 'Row lock for the whole checkout', approach: 'SELECT … FOR UPDATE on the seat rows and hold the transaction until payment returns.', challenges: 'Payment takes seconds and can hang. Holding a transaction across an external call exhausts the connection pool and blocks unrelated writes. Never do this.' },
        { rating: 'Great', title: 'Distributed hold with a TTL, transactional confirm', approach: 'SET NX with a ten-minute TTL claims the seat. The buyer pays while the hold ticks down. Confirm writes the booking in a transaction that re-validates the hold, then releases it. Abandonment is handled by expiry, for free.', challenges: 'Redis is now on the critical path and needs replication. A hold can expire mid-payment, so confirm must re-check and refund rather than double-sell.', best: true },
      ],
    },
    {
      title: 'Absorbing the on-sale spike', focus: ['cdn', 'q', 'gw'],
      blocks: [
        ['p', 'Ten million people want the same page in the same second. Two defences: cache everything readable at the edge, and refuse to let the herd reach the booking tier at all. A virtual waiting room admits buyers at the rate the booking tier can genuinely serve.'],
        ['note', 'The queue is a product decision as much as a technical one. It converts an outage into a visible position in a line, which users tolerate far better than errors.'],
      ],
    },
    {
      title: 'The hold expires while the card is being charged', focus: ['book', 'lock', 'sql'],
      blocks: [
        ['p', 'Confirm must re-validate the hold inside the same transaction that writes the booking. If the hold is gone and the seat was resold, you have already taken money: void or refund immediately and surface a clear error.'],
        ['warn', 'Extending the TTL when payment starts shrinks the window but never closes it. The compensating path is not optional — build it.'],
      ],
    },
  ],
  bar: {
    mid: 'Separate browse from book, use a lock with a TTL, and avoid the obvious double-booking race.',
    senior: 'Own the reserve/confirm split, explain why a transaction must never span a payment call, and design the waiting room unprompted.',
    staff: 'Go deep on expiry-during-payment compensation, Redis failover with held locks, and sharding by event so one on-sale cannot starve the rest of the platform.',
  },
},

'Ride Sharing (Uber)': {
  meta: 'Geospatial + realtime · hard · a write-heavy location pipeline',
  overview: 'Match riders to nearby drivers within seconds while millions of drivers stream GPS continuously. Matching is easy to describe and hard to scale; the location write volume is the real monster.',
  scope: 'Say early that this is two systems: very high-volume location ingestion, and lower-volume but contention-heavy matching. Payments and pooled rides are below the line. Estimate the location write rate before designing anything — that number forces every later decision.',
  planning: 'Do the arithmetic first: six million drivers pinging every four seconds is 1.5M writes per second. That immediately rules out a durable write per ping and points at an in-memory geospatial index. Then handle matching as a claim-and-offer problem rather than a query problem.',
  fr: {
    core: ['Rider requests a ride and sees a fare estimate', 'Drivers stream location and receive offers', 'Match a rider to a nearby available driver', 'Both parties track the trip live'],
    out: ['Payments and driver payouts', 'Pooled rides', 'Ratings and dispute handling'],
  },
  nfr: {
    core: ['Match within about 30 seconds', 'A driver is never assigned two rides', 'Ingest over a million location updates per second', 'Location fresh within roughly five seconds'],
    out: ['Perfect global ordering of location history'],
  },
  nums: [['6M', 'active drivers'], ['~1.5M/s', 'location writes at 4s intervals'], ['~100K/s', 'ride requests at peak'], ['~1 KB', 'per location update']],
  entities: [
    ['Driver', 'id, status (offline / available / on-trip), current position'],
    ['Rider', 'id, position, active trip'],
    ['Trip', 'rider, driver, route, state machine, fare'],
    ['Location', 'a timestamped point — enormous volume, negligible individual value'],
  ],
  apiIntro: 'Ride requests are ordinary REST. Location updates and trip tracking are high-frequency and belong on a persistent connection.',
  api: [
    { dir: '→', name: 'POST /rides', body: '{ pickup, destination }\n→ { rideId, etaSeconds, fareEstimate }' },
    { dir: '→', name: 'ws: locationUpdate', body: '{ driverId, lat, lng, heading, ts }' },
    { dir: '←', name: 'ws: rideOffer', body: '{ rideId, pickup, fare, expiresInSec }' },
    { dir: '→', name: 'POST /rides/{id}/accept', body: '→ { status: "MATCHED" | "TAKEN" }' },
  ],
  dives: [
    {
      title: 'Indexing millions of moving points', focus: ['loc', 'geo', 'k'],
      blocks: [['p', 'Finding drivers near a rider is a two-dimensional range query at enormous write volume. The index choice is the design.']],
      options: [
        { rating: 'Bad', title: 'Latitude and longitude columns with a B-tree', approach: 'Store coordinates in a relational table and query with a bounding box.', challenges: 'A B-tree indexes one dimension well and two badly. The database scans a wide range on one axis and filters the other, and it collapses under the write rate regardless.' },
        { rating: 'Good', title: 'Geohash or quadtree', approach: 'Encode each point to a geohash so a shared prefix means proximity; a prefix scan finds neighbours. Quadtrees adapt to density.', challenges: 'Geohash has edge artefacts — two points metres apart across a cell boundary share no prefix — so you must query neighbouring cells too.' },
        { rating: 'Great', title: 'H3 hexagonal cells in memory', approach: 'Index drivers into H3 cells in Redis. Hexagons have uniform neighbour distance, removing the boundary weirdness, and an in-memory index answers in well under a millisecond. Query the rider\'s cell plus its ring.', challenges: 'It is in-memory state, so it must be rebuildable rather than durable — which is fine, because drivers repopulate it within seconds.', best: true },
      ],
    },
    {
      title: 'Two matchers, one driver', focus: ['match', 'trip'],
      blocks: [
        ['p', 'Concurrent ride requests will find the same nearest driver. Claim the driver with an atomic set-if-absent before sending the offer, and release on decline or timeout. One round trip prevents an entire class of double-assignment bug.'],
        ['note', 'Rank candidates by ETA rather than straight-line distance. A driver 200 metres away across a river is useless.'],
      ],
    },
    {
      title: 'A driver drives into a tunnel', focus: ['loc', 'geo', 'trip'],
      blocks: [
        ['p', 'Treat position as soft state with a TTL: a driver whose last ping is older than about fifteen seconds leaves the available set and stops receiving offers, then reappears on reconnect.'],
        ['p', 'For a trip already in progress the client buffers points locally and flushes on reconnect, so the route is complete even though it was never live.'],
      ],
    },
  ],
  bar: {
    mid: 'Recognise that a B-tree cannot serve geospatial queries, reach for geohash or similar, and produce a working match flow.',
    senior: 'Estimate the write rate up front and let it drive the design. Handle double-assignment explicitly and rank on ETA.',
    staff: 'Go deep on index sharding and hot cells, the consistency model for driver state across matchers, and regional isolation so one city cannot degrade another.',
  },
},

'Video Platform (YouTube)': {
  meta: 'Large blobs + media pipeline · hard · async everything',
  overview: 'Accept uploads, transcode them into every format a client might need, and stream to a billion viewers. Three separate systems with queues between them, and the read path barely touches your infrastructure at all.',
  scope: 'Frame upload, processing and playback as independent problems. Recommendations and comments are below the line. The single most important framing to state early: viewers never fetch video bytes from your servers.',
  planning: 'Establish that video is a blob problem on the write side and a CDN problem on the read side, with a parallelisable pipeline in between. Once transcoding is behind a queue and playback is on the edge, the remaining conversation is about latency to watchable and about storage economics.',
  fr: {
    core: ['Upload a video', 'Transcode into multiple resolutions and bitrates', 'Stream with adaptive bitrate', 'Show metadata and view counts'],
    out: ['Recommendations and the home feed', 'Comments and community features', 'Monetisation and ad insertion'],
  },
  nfr: {
    core: ['Resumable uploads for multi-gigabyte files', 'Watchable within about ten minutes of upload', 'Playback starts in under two seconds and adapts to bandwidth', 'Read path serves a billion watch-hours a day'],
    out: ['Exact real-time view counts'],
  },
  nums: [['500 hrs', 'uploaded per minute'], ['~1 GB', 'per hour of source'], ['~5×', 'storage multiplier after all renditions'], ['>90%', 'of bytes served from edge']],
  entities: [
    ['Video', 'title, uploader, duration, processing status'],
    ['Rendition', 'one resolution and bitrate variant'],
    ['Segment', 'a few seconds of encoded video, independently cacheable'],
    ['View', 'a playback event — enormous volume, approximate is fine'],
  ],
  apiIntro: 'Uploads use pre-signed URLs. Playback is barely an API at all: the client fetches a manifest, then segments, straight from the CDN.',
  api: [
    { dir: '→', name: 'POST /videos', body: '{ title, description }\n→ { videoId, uploadUrl }' },
    { dir: '→', name: 'PUT <presigned url>', body: 'multipart upload of the source file' },
    { dir: '→', name: 'GET /videos/{id}', body: '→ { metadata, manifestUrl, status }' },
    { dir: '→', name: 'GET <cdn>/manifest.m3u8', body: '→ HLS manifest listing renditions and segments' },
  ],
  dives: [
    {
      title: 'Making transcoding fast enough', focus: ['q', 'w', 'out'],
      blocks: [
        ['p', 'Transcoding is embarrassingly parallel if you structure it correctly. Split the source into roughly ten-second segments, encode each independently across a large worker fleet, then stitch the manifests.'],
        ['steps', ['Split the source into segments.', 'Fan out — each worker encodes one segment into every target rendition.', 'Write encoded segments to blob storage.', 'When a rendition\'s segments are all present, publish its manifest and mark it ready.']],
        ['note', 'Model it as a DAG, not a line. Thumbnails, audio and subtitles are independent branches. Mark renditions ready individually so 720p is watchable while 4K is still encoding.'],
      ],
    },
    {
      title: 'Why segments make the CDN trivial', focus: ['cdn', 'out'],
      blocks: [
        ['p', 'Each segment is an immutable static file fetched by an ordinary GET, so the edge caches it with no invalidation problem and your origin sees almost nothing.'],
        ['p', 'Adaptive bitrate then falls out for free: the manifest lists every rendition, the player measures throughput and switches at the next segment boundary. No server involvement whatsoever.'],
      ],
    },
    {
      title: 'Storing every rendition forever is unaffordable', focus: ['blob', 'meta'],
      blocks: [
        ['p', 'Viewership is a savage power law. Keep all renditions hot for popular videos, drop rarely-watched renditions for cold ones and re-encode on demand, and move sources to archival tiers after processing.'],
        ['warn', 'Deleting the original entirely is tempting and blocks any future re-encode to a new codec. Archive it rather than discarding it.'],
      ],
    },
  ],
  bar: {
    mid: 'Async transcoding behind a queue, pre-signed uploads, CDN playback, and an understanding of what adaptive bitrate means.',
    senior: 'Structure transcoding as parallel segment encoding, and explain why segments make both encoding and edge caching easy.',
    staff: 'Cover rendition prioritisation, idempotent worker design, storage tiering economics, and multi-CDN with origin shielding.',
  },
},

'Web Crawler': {
  meta: 'Pipeline · hard · politeness and dedupe at scale',
  overview: 'Crawl ten billion pages and extract their text. The naive version is a breadth-first search; the real one is a throttled distributed pipeline that avoids being banned and avoids fetching the same content a thousand times.',
  scope: 'Lead with the URL frontier — politeness, prioritisation and dedupe all converge there, and it is what separates a real answer from a graph-traversal answer. Building a search index on top is below the line.',
  planning: 'State the politeness constraint before anything else, because it means your throughput is bounded by domains rather than by your own capacity. Then separate the IO-bound fetch from the CPU-bound parse, and treat deduplication as two distinct problems.',
  fr: {
    core: ['Crawl from seed URLs and discover new links', 'Extract and store page text', 'Respect robots.txt and per-domain rate limits', 'Recrawl based on observed change frequency'],
    out: ['Building a search index or ranking', 'Rendering JavaScript-heavy pages'],
  },
  nfr: {
    core: ['Ten billion pages in about a week', 'Never crawl identical content twice', 'Resume without losing progress after a failure', 'Be a good citizen — no domain should notice you'],
    out: ['Real-time freshness'],
  },
  nums: [['~16.5K/s', 'pages to hit 10B in a week'], ['~100 KB', 'per page → ~1 PB raw'], ['~2 KB', 'extracted text → ~20 TB'], ['~200M', 'distinct domains']],
  entities: [
    ['URL', 'the crawl unit, with priority and last-crawled time'],
    ['Page', 'raw HTML plus extracted text and a content hash'],
    ['Domain', 'robots rules, crawl delay, health'],
    ['Frontier', 'the prioritised set of URLs waiting to be fetched'],
  ],
  apiIntro: 'A crawler has no public API. What matters is the internal contract between frontier, fetchers and parsers — and that contract is a queue.',
  api: [
    { dir: '→', name: 'frontier.next(workerId)', body: '→ { url, domain }\n// only ever returns a URL you may fetch right now' },
    { dir: '→', name: 'frontier.add(urls[], priority)', body: '// dedupes against the seen-set before enqueueing' },
    { dir: '→', name: 'parser.emit(page)', body: '{ url, contentHash, text, outlinks[] }' },
  ],
  dives: [
    {
      title: 'A frontier that is polite by construction', focus: ['front', 'sched', 'dns'],
      blocks: [
        ['p', 'A single global FIFO will hammer whichever domain dominates it and get you banned within minutes. Restructure into per-domain queues plus a scheduler that only releases a URL once that domain\'s crawl delay has elapsed.'],
        ['steps', ['Front queues hold URLs by priority.', 'Back queues group URLs by domain, one queue each.', 'A heap of (nextAllowedTime, domain) says which domain is eligible.', 'A worker asking for work always receives something it may fetch immediately.']],
        ['note', 'Politeness becomes a property of the data structure rather than something every worker has to remember. Cache DNS and robots.txt aggressively — resolution is a surprising share of total latency.'],
      ],
    },
    {
      title: 'Two different deduplication problems', focus: ['dedup', 'parse'],
      blocks: [
        ['p', '**URL dedupe** asks whether you have queued this link before. Normalise first — lowercase the host, strip fragments and tracking parameters, sort query keys — then check a Bloom filter. An exact set of ten billion URLs is impractical; a false positive merely skips a page you could have crawled, which is an acceptable trade.'],
        ['p', '**Content dedupe** asks whether this page is the same as one you already have. Exact hashes catch mirrors; SimHash catches near-duplicates like the same article with different ads, which is most of the duplication on the web.'],
      ],
    },
    {
      title: 'Crawler traps', focus: ['front', 'sched', 'idx'],
      blocks: [
        ['p', 'Infinite calendars, session ids in URLs and deliberately generated link mazes can consume your whole budget on one domain. Defend with a maximum depth, a per-domain page cap, URL-pattern heuristics, and content-similarity checks that notice you are fetching the same page with a different id.'],
        ['note', 'A per-domain budget is the simplest effective guard and it costs nothing to implement.'],
      ],
    },
  ],
  bar: {
    mid: 'Recognise politeness as a hard requirement, use a Bloom filter for URL dedupe, and separate fetching from parsing.',
    senior: 'Design the two-level frontier properly, distinguish URL from content dedupe, and handle traps and retries.',
    staff: 'Cover adaptive recrawl policy, frontier partitioning by domain, near-duplicate detection, and the lifecycle of a petabyte of raw pages.',
  },
},

'Collab Docs (Google Docs)': {
  meta: 'Collaboration · hard · OT versus CRDT',
  overview: 'Several people type in the same document at once and everyone converges on the same result. The concurrency-control algorithm is the entire interview; everything else is comparatively routine.',
  scope: 'Get to the operational-transformation versus CRDT comparison quickly and justify a choice. Rich formatting internals and offline editing with long divergence are below the line.',
  planning: 'Start by demonstrating why the naive approach diverges — that framing earns the rest of the discussion. Then choose a concurrency model, accept the routing constraint it imposes, and finish on storage: an operation log with periodic snapshots.',
  fr: {
    core: ['Multiple users edit one document simultaneously', 'Edits appear to others in near real time', 'Collaborator cursors and presence', 'Documents persist and load quickly'],
    out: ['Rich formatting internals', 'Comments and suggestions', 'Long-lived offline editing'],
  },
  nfr: {
    core: ['Edits visible within about 100ms', 'All clients converge on identical content', 'No lost edits under concurrency', 'Around 100 concurrent editors per document'],
    out: ['Unlimited concurrent editors on one document'],
  },
  nums: [['~5/s', 'keystrokes per active editor'], ['~500/s', 'operations on a busy document'], ['~50 B', 'per operation'], ['~1 MB', 'typical document snapshot']],
  entities: [
    ['Document', 'content plus a monotonic revision number'],
    ['Operation', 'an insert or delete at a position, with author and base revision'],
    ['Session', 'a connected editor with a cursor'],
    ['Snapshot', 'materialised content at a revision, so loading is fast'],
  ],
  apiIntro: 'Everything meaningful flows over a socket. The critical detail is that each operation carries the revision it was based on — that is what lets the server transform it.',
  api: [
    { dir: '→', name: 'ws: operation', body: '{ docId, baseRevision, ops: [{insert|delete, pos, text}] }' },
    { dir: '←', name: 'ws: ack', body: '{ revision }  // your operation was applied' },
    { dir: '←', name: 'ws: remoteOperation', body: '{ revision, authorId, ops[] }  // already transformed' },
    { dir: '↔', name: 'ws: presence', body: '{ userId, cursorPos, selection }' },
  ],
  dives: [
    {
      title: 'Why naive syncing diverges', focus: ['ws', 'ot'],
      blocks: [
        ['p', 'Sending the whole document per keystroke is wasteful, and last-write-wins silently destroys the other person\'s work. Sending positions is closer but positions shift under concurrent edits.'],
        ['warn', 'A inserts at position 5 while B deletes at position 3. By the time A\'s operation reaches B, position 5 no longer means what A meant. Apply operations verbatim and the documents diverge permanently.'],
      ],
    },
    {
      title: 'Choosing a concurrency model', focus: ['ot', 'log'],
      blocks: [['p', 'Two established answers with a real trade-off between them.']],
      options: [
        { rating: 'Good', title: 'CRDTs', approach: 'Give every character a globally ordered unique identifier so operations commute. Any two replicas that have seen the same operations converge regardless of order, with no central authority.', challenges: 'Significant metadata per character, and tombstones for deletions accumulate and need collecting. Excellent for peer-to-peer and offline-first; heavier than necessary when everyone already connects to your server.' },
        { rating: 'Great', title: 'Operational transformation with a central sequencer', approach: 'One server owns each document and assigns a total order. An operation based on an older revision is transformed against the intervening ones before being applied — adjusting A\'s insert to account for B\'s delete.', challenges: 'Transform functions are notoriously fiddly for every operation pair, and correctness depends on a single authority per document, which means sticky routing and a failover story. In exchange the wire format stays tiny.', best: true },
      ],
    },
    {
      title: 'Losing the server that owns a document', focus: ['ot', 'log', 'db'],
      blocks: [
        ['p', 'The owning server holds authoritative in-memory state. Acknowledge an operation only once it is durably appended to the log, so a crash loses nothing that was acknowledged. Clients buffer unacked operations and resend on reconnect, deduplicated by client operation id.'],
        ['note', 'Ownership handover must go through a coordination service so two servers can never sequence the same document simultaneously.'],
      ],
    },
  ],
  bar: {
    mid: 'Explain why position-based sync diverges and know that OT or CRDT exists to solve it.',
    senior: 'Justify the choice with real trade-offs, design sticky routing, and separate ephemeral presence from durable operations.',
    staff: 'Cover failover and ownership handover, snapshot compaction, acknowledgement ordering, and what changes if genuine offline editing is required.',
  },
},

'News Feed (Twitter/X)': {
  meta: 'Fan-out · hard · the celebrity problem',
  overview: 'Show every user a ranked feed of posts from the accounts they follow. The entire difficulty is one question: do you do the work when someone posts, or when someone reads?',
  scope: 'Get to the fan-out-on-write versus fan-out-on-read comparison fast, then land on the hybrid — that is the expected answer and everything else builds on it. Ads and direct messages are below the line.',
  planning: 'Describe the read-time merge first even though it does not scale, because the hybrid reuses it. Then invert to write-time fan-out, hit the celebrity problem deliberately, and resolve it. Ranking comes last and only on a small candidate set.',
  fr: {
    core: ['Create posts', 'Follow and unfollow accounts', 'View a ranked feed', 'Paginate back through the feed'],
    out: ['Direct messages', 'Ads insertion', 'Trends and search'],
  },
  nfr: {
    core: ['Feed loads in under 500ms', 'New posts appear within about a minute', 'Handle accounts with 100M followers', 'Overwhelmingly read-heavy'],
    out: ['Strict chronological ordering'],
  },
  nums: [['~60K/s', 'feed loads at peak'], ['~1.2K/s', 'posts created'], ['~200', 'average followers'], ['100M+', 'followers on the largest accounts']],
  entities: [
    ['User', 'profile plus follower and following edges'],
    ['Post', 'author, content, media references, createdAt'],
    ['Follow', 'a directed edge from follower to followee'],
    ['FeedEntry', 'a precomputed (userId, postId, score) row'],
  ],
  apiIntro: 'Cursor-paginated REST. Offset pagination is wrong here — the feed shifts under the reader, so offsets duplicate and skip posts.',
  api: [
    { dir: '→', name: 'POST /posts', body: '{ content, mediaIds[] } → { postId }' },
    { dir: '→', name: 'GET /feed?cursor=&limit=20', body: '→ { posts[], nextCursor }' },
    { dir: '→', name: 'POST /users/{id}/follow', body: '→ { following: true }' },
  ],
  dives: [
    {
      title: 'Fan-out on write, on read, or both', focus: ['fan', 'tl', 'tlc', 'soc'],
      blocks: [['p', 'The defining decision. Both pure strategies fail, in opposite directions.']],
      options: [
        { rating: 'Bad', title: 'Pure fan-out on read', approach: 'On feed load, query recent posts from everyone the user follows, merge and rank.', challenges: 'A user following 500 accounts triggers 500 queries per load, at tens of thousands of loads per second. Always fresh, never fast enough.' },
        { rating: 'Bad', title: 'Pure fan-out on write', approach: 'On post, push the id into a precomputed list for every follower. Reads become one range read.', challenges: 'One post from a 100M-follower account becomes 100M writes. A handful of those saturate the fan-out fleet and delay everyone else\'s posts by minutes.' },
        { rating: 'Great', title: 'Hybrid', approach: 'Fan out on write for ordinary accounts, query live at read time for the handful of celebrities a user follows, and merge. Most accounts have few followers so writing is cheap; users follow few celebrities so reading them live is cheap.', challenges: 'You maintain two paths and a threshold that needs tuning against fan-out queue depth. Worth it — the two problems have opposite shapes and this is the only thing that exploits that.', best: true },
      ],
    },
    {
      title: 'Storing the graph so both directions are fast', focus: ['soc', 'fan'],
      blocks: [
        ['p', 'Store follows twice: sharded by follower to answer "who do I follow", and by followee to answer "who follows me". Fan-out needs the second and it cannot be a scatter-gather.'],
        ['note', 'Accounts with tens of millions of followers need their follower list paginated so fan-out workers can process it in parallel chunks.'],
      ],
    },
    {
      title: 'Not everyone deserves a precomputed feed', focus: ['fan', 'tlc'],
      blocks: [
        ['p', 'Maintaining timelines for hundreds of millions of dormant accounts is most of your fan-out volume for none of the benefit. Only precompute for users active in the last few days; rebuild on demand at next login.'],
        ['calc', 'This routinely cuts fan-out write volume by an order of magnitude, which is a larger win than any infrastructure change available elsewhere in the design.'],
      ],
    },
  ],
  bar: {
    mid: 'Compare the two fan-out strategies and identify the celebrity problem when prompted.',
    senior: 'Arrive at the hybrid unprompted, size the write volume, and shard the graph in both directions.',
    staff: 'Cover active-user-only fan-out, backfill on new follows, ranking candidate generation, and running this multi-region without cross-region fan-out storms.',
  },
},

'File Sync (Dropbox)': {
  meta: 'Handling large blobs · medium · the upload path is everything',
  overview: 'Store, sync and share files up to tens of gigabytes across a user\'s devices. The winning insight is that your servers should never touch the bytes — they handle metadata, and object storage handles data.',
  scope: 'Split control plane from data plane on the first diagram and everything follows. Collaborative editing of contents is below the line; chunking, resumability and sync are the interview.',
  planning: 'Describe the naive upload and demolish it yourself — it shows you understand why the real design looks unusual. Then introduce chunking, and point out that resumability, deduplication and delta sync all fall out of that one decision.',
  fr: {
    core: ['Upload and download files', 'Sync automatically across a user\'s devices', 'Share a file with another user'],
    out: ['Collaborative editing of file contents', 'Version history UI', 'Full-text search inside documents'],
  },
  nfr: {
    core: ['Files up to 50GB', 'Uploads resume after a network drop', 'Sync propagates within seconds', 'Never store the same bytes twice'],
    out: ['Sub-second global sync guarantees'],
  },
  nums: [['~4 MB', 'chunk size'], ['~12,800', 'chunks in a 50GB file'], ['~30%', 'typical dedupe saving'], ['~500/s', 'metadata operations at 1M users']],
  entities: [
    ['File', 'name, size, owner, ordered list of chunk hashes'],
    ['Chunk', 'a ~4MB block addressed by its content hash'],
    ['Device', 'a syncing client with a last-synced cursor'],
    ['Share', 'a grant of access from one user to another'],
  ],
  apiIntro: 'Deliberately metadata-only. Bytes move directly between client and object storage via pre-signed URLs — the single most important decision here.',
  api: [
    { dir: '→', name: 'POST /files/initiate', body: '{ name, size, chunkHashes[] }\n→ { fileId, missingChunks: [{hash, uploadUrl}] }' },
    { dir: '→', name: 'PUT <presigned url>', body: 'raw chunk bytes — never touches our servers' },
    { dir: '→', name: 'POST /files/{id}/commit', body: '{ chunkHashes[] } → { version }' },
    { dir: '←', name: 'ws: fileChanged', body: '{ fileId, version, changedChunks[] }' },
  ],
  dives: [
    {
      title: 'What chunking buys you', focus: ['blockp', 'blob', 'meta'],
      blocks: [
        ['p', 'Split files into roughly 4MB chunks client-side and hash each one. Store chunks keyed by content hash and keep the ordered hash list as metadata. One change, three benefits.'],
        ['bul', [
          '**Resumability** — only missing chunks are re-uploaded after a failure, so a 50GB file that dies at 99% does not start over.',
          '**Deduplication** — an identical chunk anywhere in the system is stored once, typically saving around 30% on a real corpus.',
          '**Delta sync** — editing one page of a document re-uploads one chunk, not the file.',
        ]],
        ['p', 'The upload becomes: hash locally, call initiate, receive pre-signed URLs for only the chunks the server lacks, upload those directly, commit.'],
      ],
    },
    {
      title: 'Two devices edit the same file offline', focus: ['meta', 'db', 'notif'],
      blocks: [
        ['p', 'Detect it with a version vector or a compare-and-set on the file version: the second commit sees a stale base and is rejected.'],
        ['note', 'The real answer is to keep both as a "conflicted copy" rather than attempting a merge. For opaque binaries there is no correct merge, and silently losing data is far worse than an extra file in the folder.'],
      ],
    },
    {
      title: 'Deduplication makes deletion hard', focus: ['blob', 'blockp'],
      blocks: [
        ['p', 'A chunk shared by a thousand files cannot be deleted when one of them is removed. You need reference counting or a periodic mark-and-sweep over the metadata store.'],
        ['warn', 'Reference counting is faster but races with concurrent uploads referencing a chunk you are about to collect. A grace period before deletion is a correctness requirement, not a tuning knob.'],
      ],
    },
  ],
  bar: {
    mid: 'Reach chunking and pre-signed URLs, and explain why application servers must not proxy bytes.',
    senior: 'Own resumability, dedupe and delta sync as consequences of one decision, and handle conflicts explicitly.',
    staff: 'Discuss content-defined chunking, chunk garbage collection at petabyte scale, cross-region replication, and encryption when bytes never touch your servers.',
  },
},

'Rate Limiter (as a system)': {
  meta: 'Infrastructure · medium · algorithms matter here',
  overview: 'Throttle requests per user, IP or API key across a fleet. It sits in the hot path of every request, so its own latency and availability bound the entire platform.',
  scope: 'Two decisions drive everything: which algorithm, and where the counters live. Billing and quota purchase are below the line. Interviewers expect the algorithm trade-offs cold.',
  planning: 'Place the limiter correctly first — gateway or sidecar, never application code. Then work the algorithm comparison, and finish on the two properties that matter operationally: atomicity and failing open.',
  fr: {
    core: ['Limit by user, IP or API key against configurable rules', 'Return 429 with Retry-After when limited', 'Change rules without a redeploy'],
    out: ['Billing and quota purchase flows', 'Per-endpoint cost weighting'],
  },
  nfr: {
    core: ['Adds under 3ms to request latency', 'Fail open — a limiter outage must not become a platform outage', 'Accurate enough: small over-admission is fine', 'Consistent across hundreds of servers'],
    out: ['Perfectly exact counting under partition'],
  },
  nums: [['~100K/s', 'requests through the gateway'], ['10M', 'distinct keys tracked'], ['~500 MB', 'counter memory'], ['<1 ms', 'Redis round-trip budget']],
  entities: [
    ['Rule', 'key pattern, limit, window, action'],
    ['Counter', 'per key and window bucket, with a TTL'],
    ['Client', 'the identity being limited — user, IP or key'],
  ],
  apiIntro: 'The limiter is middleware, not a public API. It exposes an internal check plus an admin surface for rules.',
  api: [
    { dir: '→', name: 'allow(key, cost)', body: '→ { allowed, remaining, resetAt }' },
    { dir: '→', name: 'PUT /rules/{id}', body: '{ pattern, limit, windowSec }' },
    { dir: '←', name: 'HTTP 429', body: 'Retry-After: <seconds>\nX-RateLimit-Remaining: 0' },
  ],
  dives: [
    {
      title: 'Which counter do you keep?', focus: ['rl', 'redis'],
      blocks: [['p', 'Counters must be shared across the fleet. What you store in them is the real decision.']],
      options: [
        { rating: 'Bad', title: 'Fixed window counter', approach: 'One counter per key per calendar minute; increment and compare.', challenges: 'Allows a 2× burst at the boundary — a client fires the full limit at 11:59:59 and again at 12:00:00. Trivial to build, genuinely broken at the edges.' },
        { rating: 'Good', title: 'Token bucket', approach: 'Tokens refill at a fixed rate; a request consumes one. Naturally permits controlled bursts, which is usually what an API wants.', challenges: 'Needs two values updated atomically, so a script or transaction. Tuning burst size against refill rate takes thought.' },
        { rating: 'Great', title: 'Sliding window counter', approach: 'Per-bucket counts, say every ten seconds, with a weighted sum across the trailing window. Smooths the boundary problem without storing every request timestamp.', challenges: 'Slightly approximate — it assumes uniform distribution within a bucket. The error is small and bounded, and it costs far less memory than a sliding log.', best: true },
      ],
    },
    {
      title: 'Concurrent servers over-admit', focus: ['rl', 'redis'],
      blocks: [
        ['p', 'Read-then-write from many servers races. The fix is to make the entire check atomic inside the store with a script: read counters, compute the weighted window, increment and return the decision in one round trip.'],
        ['note', 'This is also why you avoid any design needing two round trips per check — it doubles your added latency and reopens the race.'],
      ],
    },
    {
      title: 'What happens when Redis is down', focus: ['rl', 'rules', 'api'],
      blocks: [
        ['p', 'A limiter that fails closed converts a cache blip into a total outage. Fail open, alarm loudly, and fall back to a conservative local in-memory limit so you are not entirely defenceless.'],
        ['warn', 'Decide this deliberately and write it down. It is the single most consequential configuration choice in the system and it is usually made by accident.'],
      ],
    },
  ],
  bar: {
    mid: 'Place the limiter correctly, pick a reasonable algorithm, and explain why counters must be shared.',
    senior: 'Compare algorithms with their failure modes, insist on atomicity, and raise fail-open before being asked.',
    staff: 'Cover local-budget approximation for hot keys, multi-region limiting, and how rule changes propagate without a thundering herd.',
  },
},

'Local Search (Yelp)': {
  meta: 'Proximity search · medium · read-heavy and cacheable',
  overview: 'Find businesses near me, filtered by category and rating. Data changes slowly and reads dominate massively, which makes this an indexing and caching problem more than a scaling one.',
  scope: 'Be clear that the search index and the source of truth are different stores kept in sync asynchronously. Reservations and owner tooling are below the line.',
  planning: 'Separate the authoritative store from the query store immediately. Then explain how geo, attribute and text filtering combine in one index query, and finish on how the two stores stay in sync without dual writes.',
  fr: {
    core: ['Search businesses by location, category and rating', 'View a business page with reviews', 'Leave a review with a star rating'],
    out: ['Reservations and ordering', 'Business owner tooling', 'Photo moderation'],
  },
  nfr: {
    core: ['Search returns in under 500ms', 'Results fresh within minutes, not seconds', 'Roughly 100:1 read-heavy', 'A review write is never lost'],
    out: ['Real-time index updates'],
  },
  nums: [['100M', 'businesses'], ['~50K/s', 'searches at peak'], ['~500/s', 'review writes'], ['~2 KB', 'per business document']],
  entities: [
    ['Business', 'name, location, category, attributes, aggregate rating'],
    ['Review', 'author, business, stars, text, timestamp'],
    ['User', 'reviewer identity and history'],
  ],
  apiIntro: 'Straightforward REST. The search endpoint carries the interesting parameters, all of which must be applied in a single index query.',
  api: [
    { dir: '→', name: 'GET /search', body: '?lat=&lng=&radius=&category=&minRating=&sort=\n→ { results[], nextCursor }' },
    { dir: '→', name: 'GET /businesses/{id}', body: '→ { business, topReviews[] }' },
    { dir: '→', name: 'POST /businesses/{id}/reviews', body: '{ stars, text } → { reviewId }' },
  ],
  dives: [
    {
      title: 'Keeping the index in sync with the database', focus: ['biz', 'rev', 'geo'],
      blocks: [
        ['p', 'Never dual-write from application code — one call will fail and the two stores diverge silently, permanently, and undetectably. Read the database\'s change log instead and project changes into the index.'],
        ['steps', ['The review is written to the relational store and committed.', 'Change capture picks it up from the write-ahead log.', 'A consumer recomputes the business aggregate and updates the index document.']],
        ['note', 'This gives you an authoritative store, an eventually consistent index, and one ordered stream of truth between them. A few seconds of lag on a review count is invisible.'],
      ],
    },
    {
      title: 'Never aggregate reviews at query time', focus: ['biz', 'rev'],
      blocks: [
        ['p', 'A business with 50,000 reviews would make every search scan them. Keep a denormalised (sum, count) pair on the business row, updated in the same transaction as the review insert, and project the derived average into the index.'],
        ['calc', 'Recomputing from scratch then becomes a rare repair job rather than something on the hot path of every query.'],
      ],
    },
    {
      title: 'A radius query in a dense city', focus: ['geo', 'cache'],
      blocks: [
        ['p', 'A search in Manhattan can match tens of thousands of businesses. Push ranking into the index so it returns only the top N, shard geographically so dense regions get their own shards, and cap the radius.'],
        ['note', 'Cache keyed on a normalised query with location snapped to a grid cell. Two users fifty metres apart should share a cache entry — that alone turns a near-zero hit rate into a high one.'],
      ],
    },
  ],
  bar: {
    mid: 'Use a search index rather than the primary database, and denormalise the average rating.',
    senior: 'Insist on change capture over dual writes, explain the consistency implications, and design the cache key normalisation.',
    staff: 'Cover index sharding for dense regions, reindexing without downtime, and how personalised or A/B-tested ranking slots into the query path.',
  },
},

'Leaderboard (Top-K)': {
  meta: 'Big-data structures · hard · approximate then exact',
  overview: 'Report the thousand most-viewed items over sliding windows. Exact counting over billions of events is possible but slow; the interesting answer pairs a fast approximate layer with a slow exact one.',
  scope: 'Lead with the observation that you can neither keep an exact counter per item in memory nor scan the raw log at query time. That tension is what makes sketches the right answer.',
  planning: 'Kill the two obvious approaches first, then introduce the sketch, then windowing, then the batch reconciliation layer. Sizing the sketch from your own event rate is what turns this from recall into understanding.',
  fr: {
    core: ['Return the top K by count for a time window', 'Support hour, day and month windows', 'Support K up to a few thousand'],
    out: ['Personalised trending', 'Arbitrary ad-hoc analytics'],
  },
  nfr: {
    core: ['Query latency under 100ms', 'Results fresh within about a minute', 'Ingest 100K+ events/second', 'Approximate for the tail, exact for the head'],
    out: ['Exact counts for every item in the long tail'],
  },
  nums: [['~100K/s', 'view events'], ['~500M', 'distinct items'], ['1 min', 'bucket granularity'], ['~1 MB', 'per count-min sketch']],
  entities: [
    ['Event', 'an item id and a timestamp'],
    ['Bucket', 'counts for one minute of time'],
    ['Sketch', 'a probabilistic count structure for one bucket'],
    ['TopK', 'the materialised ranked list for a window'],
  ],
  apiIntro: 'One read endpoint and one write endpoint. Everything difficult sits behind them.',
  api: [
    { dir: '→', name: 'POST /events', body: '{ itemId }  // fire and forget' },
    { dir: '→', name: 'GET /topk', body: '?window=1h|1d|30d&k=100\n→ { items: [{itemId, count, rank}] }' },
  ],
  dives: [
    {
      title: 'Counting without a counter per item', focus: ['agg', 'k'],
      blocks: [
        ['p', 'A count-min sketch estimates any item\'s count in fixed memory: hash the item into several rows of counters, increment all of them, and read the minimum across rows. Collisions can only inflate a count, never deflate it, so the minimum is a tight upper bound.'],
        ['p', 'Pair it with a small heap of the top K seen so far. Memory stays around a megabyte regardless of how many distinct items exist.'],
        ['calc', 'Error is roughly e/width × total count, with confidence 1 − (1/e)^depth. At 100M events per minute, width 100K and depth 5 gives error in the low thousands — irrelevant against a head item with millions, and it fits in about 2MB.'],
      ],
    },
    {
      title: 'Windows are merges, not separate counts', focus: ['agg', 'z', 'read'],
      blocks: [
        ['p', 'Keep one sketch and heap per minute bucket. Sketches are additive, so any longer window is the element-wise merge of its buckets — which is exactly what makes this design work.'],
        ['steps', ['Maintain a sketch and heap for the current minute.', 'On rollover, freeze the bucket and store it.', 'An hourly query merges 60 buckets; a daily query merges 24 hourly rollups.', 'Precompute rollups so nothing ever merges more than a couple of dozen structures.']],
      ],
    },
    {
      title: 'Parallelising the count', focus: ['ing', 'k', 'agg'],
      blocks: [
        ['p', 'One operator cannot ingest 100K events per second. Partition the stream, keep a local sketch per partition, and merge at window close.'],
        ['warn', 'Merge the sketches and then re-query for the final ranking. Merging per-partition heaps alone is wrong: an item can sit just below the cut in every partition yet be globally top-K.'],
      ],
    },
  ],
  bar: {
    mid: 'Stream through a queue, aggregate in windows, and recognise that exact counting at this cardinality is impractical.',
    senior: 'Explain sketch mechanics and error bounds, design the bucketed windowing, and add the batch reconciliation layer.',
    staff: 'Size the sketch from first principles, handle partitioned merging and the boundary case it creates, and reconcile the two layers without disrupting live queries.',
  },
},

'Notification System': {
  meta: 'Multi-channel delivery · medium · you do not control the last hop',
  overview: 'Deliver alerts across push, email and SMS with preferences, deduplication and retries. Your throughput ceiling is set by third-party providers, not by your own capacity.',
  scope: 'The interesting parts are channel isolation, deduplication and honest handling of delivery you cannot observe. Template authoring and campaign tooling are below the line.',
  planning: 'Establish that channels have wildly different latency budgets and failure modes, which is what forces per-channel queues. Then handle deduplication and preferences, both of which sit on the hot path of every send.',
  fr: {
    core: ['Accept a notification request from any service', 'Respect per-user channel preferences and quiet hours', 'Deliver via push, email or SMS', 'Retry failures with backoff'],
    out: ['Template authoring UI', 'Marketing campaign scheduling'],
  },
  nfr: {
    core: ['Push delivered within seconds; email tolerates minutes', 'Never deliver the same notification twice', 'A slow channel must not delay the others', 'Survive provider outages without losing messages'],
    out: ['Guaranteed delivery confirmation from the device'],
  },
  nums: [['~20K/s', 'notifications at peak'], ['~1B/day', 'across all channels'], ['~3', 'channels per user on average'], ['burst 100×', 'when one event notifies everyone']],
  entities: [
    ['Notification', 'recipient, channel, payload, dedupe key'],
    ['Preference', 'per-user channel opt-ins, quiet hours, frequency caps'],
    ['Delivery', 'one attempt on one channel, with status'],
  ],
  apiIntro: 'A single internal endpoint that other services call. The channel decision belongs to the notification system, not the caller.',
  api: [
    { dir: '→', name: 'POST /notify', body: '{ userId, type, payload, dedupeKey }\n→ 202 { notificationId }' },
    { dir: '→', name: 'PUT /preferences/{userId}', body: '{ channels[], quietHours, frequencyCap }' },
    { dir: '←', name: 'webhook: deliveryStatus', body: '{ notificationId, channel, status }' },
  ],
  dives: [
    {
      title: 'One queue per channel, not one queue', focus: ['q', 'push', 'email', 'sms'],
      blocks: [
        ['p', 'Push must arrive in seconds; email tolerates minutes; SMS costs real money per message. Sharing one queue means a slow SMS provider delays every push notification behind it.'],
        ['note', 'Separate queues also let you scale, rate-limit and circuit-break each provider independently — which you will need, because they fail independently.'],
      ],
    },
    {
      title: 'Never send the same thing twice', focus: ['dedup', 'w'],
      blocks: [
        ['p', 'The same event often arrives from several producers. A dedupe key checked against a short-lived set is what stops a user receiving the same alert three times — the most visible failure mode this system has.'],
        ['warn', 'Deduplication must happen before the provider call, not after. Once the provider has it, you cannot take it back.'],
      ],
    },
    {
      title: 'Scaling by sending less', focus: ['pref', 'w'],
      blocks: [
        ['p', 'Above a threshold, batching notifications into a digest is both cheaper and a better product. Frequency caps and quiet hours belong on the hot path of every send, cached in memory.'],
        ['p', 'Provider quotas are a hard external limit, so your worker fleet must be rate-limited towards them. Exceeding the quota gets you throttled and you lose messages you believed were sent.'],
      ],
    },
  ],
  bar: {
    mid: 'Queue between producer and delivery, per-channel workers, and retries with backoff.',
    senior: 'Isolate channels properly, deduplicate before sending, and treat provider limits as a scheduling constraint.',
    staff: 'Cover digesting as a scaling lever, per-provider circuit breaking, and honest reconciliation between "sent" and "delivered".',
  },
},

}
