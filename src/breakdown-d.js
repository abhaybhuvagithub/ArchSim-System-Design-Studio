// Authored breakdowns, part 4 of 4. Shape documented in breakdown.js.
// WhatsApp keeps an authored `hld` because the incremental story — single host,
// then offline, then media, then scale — is more instructive than the graph.

export default {

'Netflix': {
  meta: 'Big tech · hard · egress is the whole problem',
  overview: 'Stream video to hundreds of millions of subscribers. Bytes dwarf everything else, and the answer is to put your CDN inside the ISP rather than to scale your origin.',
  scope: 'Content delivery, the degradation ladder and the encoding pipeline are the interview. Recommendation modelling is below the line.',
  planning: 'Separate the control plane — browse, search, personalise — from the data plane, which is video bytes. The control plane is an ordinary microservice problem; the data plane is a physical distribution problem.',
  fr: {
    core: ['Browse and search the catalogue', 'Personalise rows per profile', 'Play video with adaptive bitrate', 'Resume across devices'],
    out: ['Recommendation model training', 'Content licensing workflows'],
  },
  nfr: {
    core: ['Playback starts in about two seconds', 'Playback survives any control-plane failure', 'Serve the overwhelming majority of bytes from inside ISPs', 'Degrade rather than fail'],
    out: ['Personalisation availability during an incident'],
  },
  nums: [['~40K/s', 'control-plane requests'], ['>95%', 'of bytes from ISP-embedded caches'], ['~5–8', 'renditions per title'], ['overnight', 'pre-fill window before a release']],
  entities: [
    ['Title', 'catalogue metadata and its encoded renditions'],
    ['Profile', 'a viewer within an account, with its own history'],
    ['PlaybackSession', 'a licence plus a manifest plus progress'],
    ['EdgeAppliance', 'a cache physically inside an ISP network'],
  ],
  apiIntro: 'The API tier serves metadata and a manifest. Video segments are fetched from an appliance that is often in the same building as the subscriber.',
  api: [
    { dir: '→', name: 'GET /browse', body: '→ personalised rows, degradable to generic' },
    { dir: '→', name: 'POST /playback/start', body: '{ titleId, profileId } → { manifestUrl, licence }' },
    { dir: '→', name: 'GET <appliance>/segment', body: 'served from inside the ISP' },
  ],
  dives: [
    {
      title: 'Put the CDN inside the ISP', focus: ['oc', 'gslb'],
      blocks: [
        ['p', 'Appliances in ISP datacentres mean video never crosses the public backbone. This is the entire scaling strategy, and it is as much a partnership programme as an engineering one.'],
        ['note', 'Predictive fill matters just as much: push a new season to appliances overnight before launch, because cache misses at release are precisely what you are engineering away.'],
      ],
    },
    {
      title: 'Degrade, never fail', focus: ['zuul', 'api', 'rec', 'evc'],
      blocks: [
        ['p', 'If personalisation is unavailable, serve a generic row. If the API tier is struggling, shed non-essential calls. Playback must survive everything else being broken.'],
        ['warn', 'This only works if it is rehearsed. A degradation path that has never been exercised will not work during the incident you built it for.'],
      ],
    },
    {
      title: 'Encode once, serve forever', focus: ['ing', 's3'],
      blocks: [
        ['p', 'Encoding is expensive but happens once per title, amortised over hundreds of millions of streams. It is the opposite cost profile to live traffic and should be optimised for quality rather than speed.'],
        ['p', 'The caching tier in front of the wide-column store absorbs viewing-history and profile reads, which are the busiest control-plane queries.'],
      ],
    },
  ],
  bar: {
    mid: 'CDN for video, microservices behind a gateway, adaptive bitrate.',
    senior: 'Own the ISP-embedded CDN argument and design the degradation ladder.',
    staff: 'Cover predictive fill, regional failover, and peering capacity as the actual ceiling.',
  },
},

'Yahoo': {
  meta: 'Big tech · medium · several products, one front door',
  overview: 'A portal, mail, search and advertising behind a single entry point, each with a completely different scaling shape.',
  scope: 'Product isolation and ad-auction latency are the interview. Individual product depth belongs in the dedicated designs.',
  planning: 'Make the case for isolation early: mail is storage-bound, the portal is read-bound, ads are latency-bound. Sharing infrastructure gives every product the worst characteristics of all three.',
  fr: {
    core: ['Serve portal content', 'Provide webmail', 'Run search', 'Serve advertising against all of it'],
    out: ['Content editorial workflow', 'Advertiser self-service tooling'],
  },
  nfr: {
    core: ['Portal cacheable and fast globally', 'Mail durable and per-user isolated', 'Ad auction within about 100ms', 'One product\'s incident does not take down another'],
    out: ['Shared session state across products'],
  },
  nums: [['~30K/s', 'combined'], ['~100ms', 'total ad auction budget'], ['per user', 'mailbox sharding'], ['scheduled', 'portal content changes']],
  entities: [
    ['Page', 'editorial content, identical for everyone in a region'],
    ['Mailbox', 'per-user storage with no cross-user queries'],
    ['AdRequest', 'an auction with a hard deadline'],
    ['Budget', 'an advertiser\'s spend, paced across inventory'],
  ],
  apiIntro: 'One front door routing to independent products. The only genuinely shared component is identity.',
  api: [
    { dir: '→', name: 'GET /', body: '→ portal, edge-cached by region' },
    { dir: '→', name: 'GET /mail/messages', body: '→ per-user, never cached at the edge' },
    { dir: '↔', name: 'auction: bid', body: 'hard deadline; late bidders are simply excluded' },
  ],
  dives: [
    {
      title: 'Products must scale independently', focus: ['portal', 'mail', 'ads'],
      blocks: [
        ['p', 'Mail needs durable per-user storage, the portal needs edge caching, ads need single-digit-millisecond lookups. One shared platform optimised for all three is optimised for none.'],
        ['note', 'The shared identity layer is the exception, and it must be faster and more available than anything it fronts.'],
      ],
    },
    {
      title: 'Budget pacing is a rate limiter', focus: ['budget', 'ads'],
      blocks: [
        ['p', 'A popular slot can exhaust an advertiser\'s daily budget in seconds. Distributed pacing with local budgets per server is exactly the rate-limiter pattern, including its accuracy trade-off.'],
        ['warn', 'Over-delivery is money you cannot bill. Under-delivery is a contractual failure. Both matter, so the approximation has to be bounded in both directions.'],
      ],
    },
    {
      title: 'The auction deadline is fixed', focus: ['ads', 'k'],
      blocks: [
        ['p', 'Around 100ms end to end including external bidders, set by the exchange protocol rather than by your infrastructure. Past a point you cut features from the auction rather than making it faster.'],
        ['p', 'Analytics runs entirely off the serving path — nothing in the ad or portal response waits on it.'],
      ],
    },
  ],
  bar: {
    mid: 'Separate the products and cache the portal.',
    senior: 'Design budget pacing and treat the auction deadline as fixed.',
    staff: 'Cover regional cells per product, shared identity availability, and hot-inventory pacing accuracy.',
  },
},

'Disney+ Hotstar': {
  meta: 'Big tech · hard · correlated load at record concurrency',
  overview: 'Live cricket to tens of millions of simultaneous viewers. Load arrives as a step change and every viewer reacts to the same moment at the same instant.',
  scope: 'Predictive scaling, multi-CDN steering and the degradation ladder are the interview. On-demand catalogue serving is comparatively routine.',
  planning: 'Lead with simultaneity — load is perfectly correlated, so statistical smoothing does not help. That means provisioning for the peak of the peak, or degrading deliberately, and you should design both.',
  fr: {
    core: ['Stream live and on-demand video', 'Handle authentication and entitlement', 'Serve personalised rails', 'Support live chat and reactions'],
    out: ['Content production workflow', 'Rights management'],
  },
  nfr: {
    core: ['Absorb tens of millions joining within minutes', 'Playback protected above everything else', 'Degrade to a stripped experience rather than fail', 'Handle a scheduled, known event calendar'],
    out: ['Personalisation during peak load'],
  },
  nums: [['~200K/s', 'at peak in this model'], ['tens of millions', 'concurrent viewers'], ['minutes', 'to full load from zero'], ['~100%', 'cache hit rate — everyone watches the same stream']],
  entities: [
    ['Stream', 'the live feed, identical for every viewer'],
    ['Entitlement', 'whether this account may watch this'],
    ['Rail', 'a personalised row — the first thing sacrificed'],
    ['PanicMode', 'a pre-built stripped-down experience'],
  ],
  apiIntro: 'The playback path is protected and minimal. Everything else is optional and can be switched off under load.',
  api: [
    { dir: '→', name: 'POST /playback', body: '{ streamId } → { manifestUrl, cdnHint }' },
    { dir: '→', name: 'GET /home', body: '→ personalised rails, degrades to static' },
    { dir: '←', name: 'ops: panicMode', body: 'a switch, not a deploy' },
  ],
  dives: [
    {
      title: 'Scale ahead of the event, not with it', focus: ['auto', 'gw', 'play'],
      blocks: [
        ['p', 'Reactive autoscaling cannot follow ten million users arriving in five minutes. Provisioning is driven by the fixture list — the traffic is scheduled, so the capacity should be too.'],
        ['calc', 'If autoscaling reacts in three minutes and the ramp is two minutes, the lag is the entire incident. There is no tuning that fixes this.'],
      ],
    },
    {
      title: 'A rehearsed degradation ladder', focus: ['pers', 'chat', 'cache'],
      blocks: [
        ['p', 'Decide in advance what gets switched off and in what order: personalised rails, then chat, then reactions, then panic mode. Rehearsed degradation turns a potential outage into slightly reduced functionality.'],
        ['warn', 'Panic mode has to be a switch that already exists. Building it during the match is not an option available to you.'],
      ],
    },
    {
      title: 'Everyone watches the same thing', focus: ['cdn1', 'cdn2'],
      blocks: [
        ['p', 'Unlike on-demand, live means one stream for tens of millions, so edge cache hit rates approach 100%. That property is what makes this possible at all.'],
        ['p', 'No single CDN absorbs this. Real-time steering across providers on measured performance, with the ability to shift traffic mid-event, is required rather than optional.'],
      ],
    },
  ],
  bar: {
    mid: 'CDN for video, autoscaling, and awareness that live is different from on-demand.',
    senior: 'Pre-scale from the schedule, design the degradation ladder, and use multi-CDN steering.',
    staff: 'Cover panic mode as a rehearsed capability, correlated load as an unsmoothable property, and capacity economics for a handful of annual peaks.',
  },
},

'News Feed (Instagram)': {
  meta: 'Product · medium · media and fan-out together',
  overview: 'Photo sharing with a followed feed and ephemeral stories. It combines the large-blob problem with the fan-out problem, and neither part should touch the other.',
  scope: 'Media handling and hybrid fan-out are the interview. Explore and recommendations are below the line.',
  planning: 'Handle media and feed as independent tracks. Media is a solved pattern — pre-signed upload, async processing, CDN delivery. Feed is the fan-out problem, slightly easier here than on a text network because posting rates are lower.',
  fr: {
    core: ['Post photos with captions', 'Follow accounts and view a feed', 'Post stories that expire after 24 hours', 'Like posts'],
    out: ['Direct messaging', 'Reels ranking', 'Explore'],
  },
  nfr: {
    core: ['Feed loads under 500ms', 'Images load fast globally', 'Posts reach followers within a minute', 'Stories expire reliably without a cleanup job'],
    out: ['Exact like counts in real time'],
  },
  nums: [['~50K/s', 'at peak'], ['~1.2K/s', 'posts created'], ['~5', 'renditions per photo'], ['24h', 'story TTL']],
  entities: [
    ['Post', 'author, media references, caption'],
    ['Media', 'the image and its generated renditions'],
    ['Story', 'a post with a TTL rather than a lifecycle'],
    ['FeedEntry', 'a precomputed timeline row holding ids only'],
  ],
  apiIntro: 'Pre-signed uploads for media, cursor-paginated REST for everything else.',
  api: [
    { dir: '→', name: 'POST /media/upload-url', body: '{ contentType } → { mediaId, uploadUrl }' },
    { dir: '→', name: 'POST /posts', body: '{ mediaIds[], caption } → { postId }' },
    { dir: '→', name: 'GET /feed?cursor=', body: '→ { posts[], nextCursor }' },
  ],
  dives: [
    {
      title: 'Media never touches your servers', focus: ['blob', 'cdn', 'q'],
      blocks: [
        ['p', 'Pre-signed upload straight to object storage, async rendition generation, CDN delivery. Content-addressed images cache forever with no invalidation problem.'],
        ['note', 'Generating several sizes on upload and letting the client pick saves far more bandwidth than any compression tuning would.'],
      ],
    },
    {
      title: 'Stories expire themselves', focus: ['meta', 'tl'],
      blocks: [
        ['p', 'A 24-hour TTL in an in-memory store means no cleanup job, no tombstones and a naturally bounded dataset. Stories are a much easier problem than posts and should be modelled as such.'],
        ['p', 'The story tray is assembled at read time from the accounts you follow, which is cheap because the set is small.'],
      ],
    },
    {
      title: 'A viral post in a new region', focus: ['cdn', 'fan', 'tl'],
      blocks: [
        ['p', 'The first viewer in each region pays an origin fetch — exactly when a post is spreading fastest. Pre-warm for large accounts; eliminating it entirely does not scale.'],
        ['warn', 'Like counts on a viral post are thousands of writes per second to one row. Buffer and flush aggregated deltas, but keep the per-user like record durable so the UI stays correct for the individual.'],
      ],
    },
  ],
  bar: {
    mid: 'Pre-signed uploads, CDN delivery, and a working feed.',
    senior: 'Hybrid fan-out, stories via TTL, and asynchronous like counts.',
    staff: 'Cover CDN pre-warming and origin shielding, rendition strategy versus storage cost, and regional feed cache placement.',
  },
},

'Music Streaming (Spotify)': {
  meta: 'Product · medium · licensing on every play',
  overview: 'Stream audio globally while checking per-market rights on every play and never losing a royalty event. The audio itself is trivially cacheable; the rights check is what sits in front of it.',
  scope: 'Rights caching, royalty durability and offline sync are the interview. Recommendation modelling is below the line.',
  planning: 'Note the tension: audio is immutable and perfectly cacheable, but a licensing check gates every play. Resolving that — cache the rights matrix per market — is the core move.',
  fr: {
    core: ['Search and browse a catalogue', 'Play a track with rights checked for the market', 'Manage playlists and a saved library', 'Download for offline listening'],
    out: ['Recommendation model training', 'Artist-facing analytics'],
  },
  nfr: {
    core: ['Playback starts under a second', 'Never play a track unlicensed in that market', 'Never lose a royalty event', 'Offline library syncs reliably'],
    out: ['Real-time catalogue consistency across markets'],
  },
  nums: [['~40K/s', 'at peak'], ['~3 MB', 'per track, immutable'], ['per market', 'licensing granularity'], ['Fridays', 'predictable release spikes']],
  entities: [
    ['Track', 'immutable audio plus metadata'],
    ['Market', 'a licensing territory with its own availability'],
    ['Play', 'a royalty-bearing event that must not be lost'],
    ['Library', 'a user\'s playlists and saved tracks'],
  ],
  apiIntro: 'Metadata and rights over REST; audio from the edge. The play event is emitted separately and durably.',
  api: [
    { dir: '→', name: 'GET /tracks/{id}/play', body: '→ { streamUrl, expiresAt } | 451 not licensed here' },
    { dir: '→', name: 'GET <cdn>/audio/{hash}', body: 'immutable, cached forever' },
    { dir: '←', name: 'event: play', body: '{ trackId, userId, ms } — at-least-once, deduplicated' },
  ],
  dives: [
    {
      title: 'Audio is immutable, rights are not', focus: ['audio', 'cdn', 'cat', 'catdb'],
      blocks: [
        ['p', 'A track file never changes, so it caches at the edge indefinitely. What changes is whether a given market may play it, so cache the per-market availability matrix and refresh on a schedule rather than checking the catalogue database per play.'],
        ['note', 'Pre-position Friday releases at the edge. Demand is entirely predictable and a cold cache on release day is a self-inflicted wound.'],
      ],
    },
    {
      title: 'Royalty events are money owed', focus: ['roy', 'k'],
      blocks: [
        ['p', 'Plays translate directly into payments to rights holders, so they go to a durable log with at-least-once delivery and idempotent aggregation. This is the one place in the system where you cannot be casual.'],
        ['warn', 'Offline playback complicates this: the client buffers play events and uploads later, so deduplication must work across a gap of days.'],
      ],
    },
    {
      title: 'Library sharding', focus: ['lib', 'srch'],
      blocks: [
        ['p', 'Playlists and saved tracks have no cross-user queries, so user id is a clean partition with no scatter-gather.'],
        ['p', 'Search is the exception — it spans the catalogue and belongs in an index sized for the market, not the user.'],
      ],
    },
  ],
  bar: {
    mid: 'CDN for audio, a catalogue service, and a play event.',
    senior: 'Cache rights per market, make royalty events durable, and shard the library by user.',
    staff: 'Cover offline sync deduplication, market fragmentation as a legal constraint, and predictive edge placement for releases.',
  },
},

'Distributed File Storage (Drive)': {
  meta: 'Product · medium · permissions are the hard part',
  overview: 'Store files, share them, and evaluate inherited permissions on every access. The storage is a solved problem; the access check is not.',
  scope: 'ACL evaluation and caching, chunk deduplication and change-log sync are the interview.',
  planning: 'Identify permission evaluation as the thing on every request that is genuinely expensive. Caching it is necessary and invalidating it correctly is where the difficulty concentrates.',
  fr: {
    core: ['Upload and download files', 'Organise into folders', 'Share with users, groups or a link', 'Search your accessible files'],
    out: ['Real-time collaborative editing', 'Version history UI'],
  },
  nfr: {
    core: ['Access checks under 10ms', 'Never show a file the user may not see', 'Sync within seconds of a change', 'Store identical content once'],
    out: ['Immediate global consistency of permission changes'],
  },
  nums: [['~15K/s', 'at peak'], ['~4 MB', 'chunk size'], ['inherited', 'folder-tree permissions'], ['~30%', 'dedupe saving']],
  entities: [
    ['File', 'metadata plus an ordered chunk list'],
    ['Folder', 'a node in the tree that permissions inherit through'],
    ['ACL', 'a grant to a user, group or link'],
    ['Chunk', 'content-addressed, shared across files'],
  ],
  apiIntro: 'Metadata over REST, bytes via pre-signed URLs, changes over a subscription.',
  api: [
    { dir: '→', name: 'GET /files/{id}', body: '→ metadata + downloadUrl | 403' },
    { dir: '→', name: 'POST /files/{id}/share', body: '{ principal, role } → invalidates ACL caches' },
    { dir: '←', name: 'ws: change', body: '{ fileId, version } — drives the sync cursor' },
  ],
  dives: [
    {
      title: 'Inherited permissions on every access', focus: ['acl', 'aclc'],
      blocks: [
        ['p', 'Resolving a permission means walking up the folder tree, which is far too expensive per request. Cache the resolved answer.'],
        ['warn', 'Invalidation is the hard part: resharing a parent folder changes the effective permission of everything beneath it. Get this wrong and you leak data, which is a categorically worse failure than being slow.'],
      ],
    },
    {
      title: 'Search must respect visibility', focus: ['srch', 'acl'],
      blocks: [
        ['p', 'Indexing everything and filtering results afterwards leaks the existence of documents and degrades badly as the filtered fraction grows. Permissions belong inside the index query.'],
        ['note', 'This constrains your index design significantly, which is why it has to be decided early rather than retrofitted.'],
      ],
    },
    {
      title: 'Dedupe and the change cursor', focus: ['dedup', 'blk', 'ws', 'k'],
      blocks: [
        ['p', 'Content-addressed chunks mean the same attachment across thousands of accounts is stored once — a large fraction of the storage bill.'],
        ['p', 'A monotonic per-user change cursor makes reconnect a range read rather than a tree diff, which is both faster and far less error-prone.'],
      ],
    },
  ],
  bar: {
    mid: 'Chunked storage, pre-signed URLs, and an ACL check on access.',
    senior: 'Cache resolved permissions with correct invalidation, and put visibility inside the search query.',
    staff: 'Cover the sharing-graph complexity that bounds caching, chunk garbage collection, and regional metadata with global blobs.',
  },
},

'Slack': {
  meta: 'Workplace · medium · connections times tenancy',
  overview: 'Team messaging with persistent connections, per-workspace isolation and permission-aware search. Workspace is an unusually clean shard key.',
  scope: 'Connection management, channel fan-out and tenancy are the interview. Apps and integrations are below the line.',
  planning: 'Point out that nothing crosses workspaces, which makes this the cleanest multi-tenant partition among these designs — then note the exception that breaks it, the enormous single workspace.',
  fr: {
    core: ['Send and receive channel messages in real time', 'Show presence and typing', 'Search history with permissions applied', 'Share files'],
    out: ['Third-party app platform', 'Huddles and calls'],
  },
  nfr: {
    core: ['Messages delivered in under a second', 'Workspaces fully isolated', 'History searchable within seconds of posting', 'Presence is best-effort and droppable'],
    out: ['Cross-workspace search'],
  },
  nums: [['~30K/s', 'at peak'], ['millions', 'of concurrent sockets'], ['per workspace', 'the shard key'], ['~10 KB', 'memory per connection']],
  entities: [
    ['Workspace', 'the tenancy and sharding boundary'],
    ['Channel', 'the fan-out unit'],
    ['Message', 'stored partitioned by channel, ordered by timestamp'],
    ['Presence', 'ephemeral, in-memory, never persisted'],
  ],
  apiIntro: 'A socket for realtime, REST for history and search. Files go direct to object storage.',
  api: [
    { dir: '↔', name: 'ws: message', body: '{ channelId, text } / { messageId, author, ts }' },
    { dir: '→', name: 'GET /channels/{id}/history', body: '?before= → paginated' },
    { dir: '→', name: 'GET /search', body: '?q= → scoped to the workspace and the user\'s channels' },
  ],
  dives: [
    {
      title: 'Pub/sub per channel, not per user', focus: ['ws', 'msg', 'k'],
      blocks: [
        ['p', 'A busy channel with thousands of members is a fan-out problem. Per-channel channels mean each connection server subscribes once regardless of how many of its local sockets are members.'],
        ['note', 'This is the opposite choice to a 1:1 messaging app, and for a good reason: here one user watches few channels while one channel has many users.'],
      ],
    },
    {
      title: 'Presence is huge and worthless', focus: ['pres'],
      blocks: [
        ['p', 'Typing indicators and online status are high-volume and meaningless a second later. Keep them in memory with a TTL, never persist them, and drop them first under load.'],
        ['p', 'Files go direct to object storage. A connection server holding a million sockets must not also proxy uploads.'],
      ],
    },
    {
      title: 'The giant workspace breaks the model', focus: ['ten', 'store', 'srch'],
      blocks: [
        ['p', 'A single customer with hundreds of thousands of people in one channel breaks per-workspace sharding. That case needs sharding within the tenant.'],
        ['warn', 'It is why enterprise deployments look different from the default architecture, and it is worth naming rather than pretending one shard key covers everything.'],
      ],
    },
  ],
  bar: {
    mid: 'Sockets for realtime, a message store, and workspace scoping.',
    senior: 'Partition by workspace, fan out per channel, and treat presence as disposable.',
    staff: 'Cover intra-tenant sharding for very large workspaces, regional connection tiers, and permission-aware search indexing.',
  },
},

'Microsoft 365': {
  meta: 'Workplace · medium · tenancy and compliance on every operation',
  overview: 'Mail, files and chat for enterprises, with identity, data residency and compliance scanning applying to everything.',
  scope: 'Per-tenant throttling, identity on the hot path and asynchronous compliance are the interview. Individual workload internals are below the line.',
  planning: 'Note that regulation, not scale, shapes the topology here. Data residency forces regional stacks and limits the consolidation a global service would otherwise enjoy.',
  fr: {
    core: ['Authenticate through a central identity provider', 'Serve mail, files and chat', 'Apply data-loss prevention', 'Support eDiscovery and audit'],
    out: ['Individual application features', 'Licensing and billing'],
  },
  nfr: {
    core: ['One tenant cannot exhaust shared capacity', 'Tenant data stays in its required geography', 'Compliance scanning never blocks a user operation', 'Identity faster than everything it fronts'],
    out: ['A single global data plane'],
  },
  nums: [['~25K/s', 'at peak'], ['per tenant', 'throttling granularity'], ['regional', 'data residency requirement'], ['years', 'audit retention']],
  entities: [
    ['Tenant', 'the isolation, capacity and residency boundary'],
    ['Principal', 'a user or service identity with claims'],
    ['Workload', 'mail, files or chat — separately stored'],
    ['Policy', 'DLP and retention rules applied per tenant'],
  ],
  apiIntro: 'A unified graph API over separately-stored workloads. Throttling is per tenant and visible to callers.',
  api: [
    { dir: '→', name: 'GET /v1/me/messages', body: 'Authorization: Bearer <token>\n→ 429 with Retry-After when the tenant is throttled' },
    { dir: '→', name: 'GET /v1/me/drive/items', body: '→ the same surface over a different store' },
    { dir: '←', name: 'audit: event', body: 'asynchronous, durable, tamper-evident' },
  ],
  dives: [
    {
      title: 'Throttle per tenant', focus: ['ten', 'graph'],
      blocks: [
        ['p', 'Without it, one customer\'s runaway integration degrades everyone. Per-tenant quotas are a multi-tenancy requirement rather than a nice-to-have, and they must be visible in the API so integrators can back off correctly.'],
        ['note', 'Return 429 with Retry-After. Silent throttling produces integrations that retry harder, which is precisely the wrong response.'],
      ],
    },
    {
      title: 'Compliance runs off the write path', focus: ['dlp', 'aud', 'k'],
      blocks: [
        ['p', 'DLP scanning and eDiscovery indexing consume an event stream. Putting them inline would roughly double the latency of every operation for a check that is rarely decisive.'],
        ['warn', 'The exception is blocking policies — if a tenant requires that a message never leaves, that check must be inline and must fail closed.'],
      ],
    },
    {
      title: 'Residency is a routing constraint', focus: ['gslb', 'ten', 'entra'],
      blocks: [
        ['p', 'Sovereignty rules mean separate regional stacks, sometimes operated by separate legal entities. Some optimisations available to a global service are simply not permitted.'],
        ['p', 'Workload-specific stores matter too: mail, files and chat have genuinely different access patterns and one unified store would serve all three badly.'],
      ],
    },
  ],
  bar: {
    mid: 'Central identity, tenant separation, and separate workload stores.',
    senior: 'Per-tenant throttling with correct signalling, and asynchronous compliance.',
    staff: 'Cover residency as topology, dedicated capacity for large tenants, and the limits regulation places on consolidation.',
  },
},

'Outlook': {
  meta: 'Workplace · medium · an adversarial write path',
  overview: 'Receive mail from anyone on the internet, filter it, store it and make it searchable. The inbound path is unbounded, untrusted and actively hostile.',
  scope: 'Filtering economics, mailbox sharding and retention are the interview. Calendar internals are below the line.',
  planning: 'Frame inbound SMTP as an adversarial write path you cannot rate-limit at the source. That makes cheap-checks-first the organising principle of the whole filter chain.',
  fr: {
    core: ['Receive mail over SMTP', 'Filter spam and malware', 'Store and index per mailbox', 'Send mail and manage calendar'],
    out: ['Client applications', 'Contact management'],
  },
  nfr: {
    core: ['Never lose a legitimate message', 'Reject most spam before parsing it', 'Search a mailbox in under a second', 'Retention enforced for years'],
    out: ['Zero false positives in filtering'],
  },
  nums: [['~20K/s', 'at peak'], ['majority', 'of inbound is spam'], ['per user', 'mailbox sharding'], ['years', 'retention requirement']],
  entities: [
    ['Message', 'headers, body and attachment references'],
    ['Mailbox', 'per-user storage and index'],
    ['Reputation', 'sender and IP signals driving cheap rejection'],
    ['RetentionPolicy', 'what is kept and for how long'],
  ],
  apiIntro: 'SMTP inbound, REST for clients. The filter chain is the part with the interesting contract.',
  api: [
    { dir: '→', name: 'smtp: MAIL FROM', body: '→ reputation check before DATA is even accepted' },
    { dir: '→', name: 'GET /messages', body: '?folder=&q= → paginated from the per-user index' },
    { dir: '→', name: 'POST /messages/send', body: '{ to[], subject, body }' },
  ],
  dives: [
    {
      title: 'Reject early and cheaply', focus: ['smtp', 'mx', 'filter'],
      blocks: [
        ['p', 'IP reputation and connection-level rate limiting discard most spam before you parse a single message. The cheapest check must run first — this is the entire economics of mail.'],
        ['calc', 'Rejecting at MAIL FROM costs microseconds; running a content model costs milliseconds. With the majority of traffic being spam, that ordering is the difference between viable and not.'],
      ],
    },
    {
      title: 'Attachments do not belong in the mail store', focus: ['att', 'mbox'],
      blocks: [
        ['p', 'Large binaries destroy the access patterns of a store optimised for many small records. Keep them separately and store references.'],
        ['note', 'Index per user and incrementally on delivery, so search is always current and you never run a bulk reindex across every mailbox.'],
      ],
    },
    {
      title: 'You are scaling against an opponent', focus: ['filter', 'ret'],
      blocks: [
        ['p', 'Spammers adapt to whatever you deploy, so filtering cost rises over time regardless of user growth. This is unlike every other system here, where load correlates with usage.'],
        ['p', 'Retention is tiered storage: mail is kept for years and read within days, so age it into cheaper tiers automatically.'],
      ],
    },
  ],
  bar: {
    mid: 'Receive, filter, store per user, and index for search.',
    senior: 'Order the filter chain by cost, separate attachments, and shard mailboxes.',
    staff: 'Cover adversarial cost growth, tiered retention economics, and reputation systems as shared infrastructure.',
  },
},

'Gmail': {
  meta: 'Workplace · medium · search is the navigation',
  overview: 'Mail where users navigate by searching rather than by filing, over a per-user corpus that only ever grows.',
  scope: 'The labels-and-threads model, incremental indexing and storage growth are the interview.',
  planning: 'Lead with the product insight — search replaces folders — because it dictates the data model. Labels rather than folders, threads rather than messages, and an index that is always current.',
  fr: {
    core: ['Receive and send mail', 'Organise by label, not folder', 'Group messages into threads', 'Search the whole mailbox instantly'],
    out: ['Client applications', 'Chat and meet integration'],
  },
  nfr: {
    core: ['Search returns in well under a second', 'Index current within seconds of delivery', 'Never lose a message', 'Storage growth economically sustainable'],
    out: ['Deleting old mail to reclaim space'],
  },
  nums: [['~60K/s', 'at peak'], ['per user', 'index granularity'], ['monotonic', 'storage growth'], ['~1', 'message belongs to many labels']],
  entities: [
    ['Message', 'stored once, referenced by many labels'],
    ['Thread', 'the unit users actually read'],
    ['Label', 'a tag, not a location'],
    ['Index', 'per-user, updated incrementally on delivery'],
  ],
  apiIntro: 'Search-first REST. The list endpoint is really a query endpoint.',
  api: [
    { dir: '→', name: 'GET /messages', body: '?q=from:x has:attachment → the primary navigation' },
    { dir: '→', name: 'POST /messages/{id}/modify', body: '{ addLabels[], removeLabels[] }' },
    { dir: '←', name: 'push: newMessage', body: 'notifies clients without polling' },
  ],
  dives: [
    {
      title: 'Labels, not folders', focus: ['lbl', 'mbox'],
      blocks: [
        ['p', 'A message with many labels stored once with a label set is far cheaper than duplication, and it is what makes threading and search-first navigation coherent.'],
        ['note', 'A folder model would force either duplication or a single location, and both break the product.'],
      ],
    },
    {
      title: 'Index on delivery, never in bulk', focus: ['idx', 'mail'],
      blocks: [
        ['p', 'Incremental indexing at write time means search is always current and you never face a bulk reindex over a billion mailboxes — an operation that would simply never finish.'],
        ['p', 'Threads are the read unit. Storing and fetching by thread matches how people actually read and cuts read amplification substantially.'],
      ],
    },
    {
      title: 'Storage only grows', focus: ['att', 'mbox', 'abuse'],
      blocks: [
        ['p', 'Nobody deletes email, so per-user storage increases monotonically and your fleet grows even with flat user numbers. The levers are attachment deduplication and cheaper cold tiers, not reclamation.'],
        ['warn', 'Spam filtering remains a hot path on every inbound message, and the model needs continuous retraining because the adversary adapts.'],
      ],
    },
  ],
  bar: {
    mid: 'Per-user storage with an index, and an understanding of why search matters here.',
    senior: 'Model labels and threads correctly, index incrementally, and keep filtering cheap.',
    staff: 'Cover monotonic storage growth as a capacity plan, tiered cold storage with a warm index, and continuous adversarial retraining.',
  },
},

'Anthropic Claude': {
  meta: 'AI / ML · hard · GPU capacity is the system',
  overview: 'An LLM API for developers. Everything in the diagram other than inference is a rounding error in both cost and latency.',
  scope: 'Token-based limiting, prompt caching, batching and exact metering are the interview. Model architecture is below the line.',
  planning: 'State that accelerators are supply-constrained with long lead times, so this cannot be autoscaled out of. That makes admission control, caching and batching the substance rather than the optimisation.',
  fr: {
    core: ['Authenticate an API key and enforce limits', 'Route a request to an appropriate model', 'Stream generated tokens back', 'Meter usage exactly for billing'],
    out: ['Model training', 'Fine-tuning workflows'],
  },
  nfr: {
    core: ['Time to first token in low hundreds of milliseconds', 'Fair allocation when capacity is scarce', 'Usage metering exact — it is billing', 'Safety checks on input and output'],
    out: ['Unbounded throughput on demand'],
  },
  nums: [['~300/s', 'requests in this model'], ['100× variance', 'in tokens per request'], ['GPU-bound', 'the binding constraint'], ['exact', 'metering requirement']],
  entities: [
    ['ApiKey', 'the identity, with an organisation and tier'],
    ['Request', 'a prompt plus parameters, measured in tokens'],
    ['Batch', 'the unit the GPU actually processes'],
    ['UsageRecord', 'exact token counts, durable, billable'],
  ],
  apiIntro: 'A streaming completion endpoint. Streaming is essential because generation takes seconds and time to first token is what users perceive.',
  api: [
    { dir: '→', name: 'POST /v1/messages', body: 'x-api-key: <key>\n{ model, messages[], max_tokens }\n→ SSE token stream' },
    { dir: '←', name: 'HTTP 429', body: 'token bucket exhausted — retry-after in seconds' },
    { dir: '←', name: 'usage: record', body: '{ inputTokens, outputTokens } — exact, durable' },
  ],
  dives: [
    {
      title: 'Rate limit on tokens, not requests', focus: ['rl', 'keys'],
      blocks: [
        ['p', 'One request can be a hundred tokens or a hundred thousand. Request-based limits are meaningless here because they do not correspond to capacity consumed.'],
        ['note', 'Limit input and output tokens separately — they have different costs, and output is the one that occupies the GPU for longer.'],
      ],
    },
    {
      title: 'Caching and batching are the economics', focus: ['cache', 'gpu', 'llm'],
      blocks: [
        ['p', 'Long shared system prompts recomputed per request waste an enormous share of the fleet; caching the attention state for common prefixes is one of the largest savings available.'],
        ['p', 'Continuous batching packs many sequences into the same forward pass rather than leaving the GPU idle between tokens, multiplying effective throughput on identical hardware.'],
      ],
    },
    {
      title: 'When you cannot add capacity', focus: ['router', 'gpu', 'bill'],
      blocks: [
        ['p', 'Accelerators have long procurement lead times, so at capacity the system becomes queue-shaped. Admission control by tier and fair scheduling matter more than throughput optimisation.'],
        ['warn', 'Metering must be exact because it is billing. This is the one part of the system where approximation is not acceptable, in contrast to almost every other design in the library.'],
      ],
    },
  ],
  bar: {
    mid: 'API keys, rate limits, an inference pool, and streaming responses.',
    senior: 'Token-based limiting, prompt caching, and continuous batching.',
    staff: 'Cover admission control under scarcity, model routing economics, and exact metering as a durability requirement.',
  },
},

'Simbe Tally (shelf-scanning robots)': {
  meta: 'Robotics & edge · hard · the store uplink is the constraint',
  overview: 'Robots scan supermarket shelves and turn imagery into restocking tasks. They generate gigabytes over a connection shared with the tills.',
  scope: 'Edge inference, connectivity tolerance and product recognition at catalogue scale are the interview. Robot navigation is below the line.',
  planning: 'Lead with the uplink: you are a guest on a network that runs the business. That single fact forces inference at the edge and store-and-forward, which is the whole architecture.',
  fr: {
    core: ['Scan shelves autonomously', 'Detect products and identify gaps', 'Recognise products against a large catalogue', 'Turn detections into associate tasks'],
    out: ['Robot navigation and safety', 'Store systems integration contracts'],
  },
  nfr: {
    core: ['Never saturate the store uplink', 'Survive hours of disconnection without data loss', 'Recognition accurate across millions of SKUs', 'Tasks reach associates while still actionable'],
    out: ['Real-time shelf state'],
  },
  nums: [['~8K/s', 'aggregate at scale'], ['GBs/robot/day', 'raw imagery'], ['millions', 'of SKUs'], ['a few/day', 'scans per aisle']],
  entities: [
    ['Robot', 'an edge device with on-board inference'],
    ['Scan', 'one pass down an aisle'],
    ['Detection', 'a product or gap identified, with an embedding'],
    ['Task', 'a restocking instruction for a store associate'],
  ],
  apiIntro: 'Robots upload detections, not images, on a schedule. Everything central is asynchronous.',
  api: [
    { dir: '→', name: 'POST /scans', body: '{ storeId, aisle, detections[] } — kilobytes, not gigabytes' },
    { dir: '→', name: 'PUT <presigned>', body: 'thumbnails only, scheduled off-peak' },
    { dir: '←', name: 'task: restock', body: '{ storeId, aisle, sku, priority } → associate app' },
  ],
  dives: [
    {
      title: 'Infer at the edge', focus: ['edge', 'tally', 'up'],
      blocks: [
        ['p', 'Running detection on the robot means shipping kilobytes of results instead of gigabytes of raw imagery. Nothing else in this design matters as much.'],
        ['calc', 'The ratio is roughly a thousand to one. No amount of central capacity compensates for getting this wrong.'],
      ],
    },
    {
      title: 'Be a good neighbour on the network', focus: ['up', 'ing', 'q'],
      blocks: [
        ['p', 'You share the uplink with the point-of-sale system. Throttle, schedule uploads overnight, and back off aggressively — being a bad neighbour ends the contract regardless of how good the product is.'],
        ['warn', 'Retail connectivity fails regularly. Buffer on the robot and replay: a scan delayed is fine, a scan lost is not.'],
      ],
    },
    {
      title: 'Recognition across millions of SKUs', focus: ['vec', 'cat', 'det'],
      blocks: [
        ['p', 'Exact matching per detection against a catalogue that size is impractical. An approximate nearest-neighbour index over embeddings makes recognition effectively constant-time.'],
        ['p', 'Images are write-once and read-rarely. Tier them into cold storage immediately and keep only derived detections hot.'],
      ],
    },
  ],
  bar: {
    mid: 'Upload scans, process centrally, and generate tasks.',
    senior: 'Move inference to the edge, design store-and-forward, and use an ANN index for recognition.',
    staff: 'Cover uplink etiquette as a contractual constraint, image lifecycle at petabyte scale, and freshness bounded by robot physics.',
  },
},

// ── WhatsApp keeps its authored high-level design ───────────────────────────
'Chat (WhatsApp)': {
  meta: 'Real-time updates · medium · ~35 minutes',
  overview: 'A messaging service that lets users send and receive messages from their phones and computers. Two distinct problems hide inside it: delivering messages durably, and delivering them in real time.',
  scope: 'Messaging apps have an enormous surface area and your interviewer does not want all of it. Calling, business accounts and registration are below the line. Offline delivery is the requirement worth arguing for — it is the most interesting part to design.',
  planning: 'Recognise that a 1:1 message is just a group chat with two participants, so solve the general case. Then note the design splits into durability and realtime. Walk the requirements solving each as simply as possible; the result will not scale, and the deep dives are where that gets fixed. For infrastructure problems, reason about a single node first.',
  fr: {
    core: [
      'Users can start group chats with multiple participants (limit 100).',
      'Users can send and receive messages.',
      'Users can receive messages sent while they were offline, up to 30 days.',
      'Users can send and receive media in their messages.',
    ],
    out: ['Audio and video calling', 'Interactions with businesses', 'Registration and profile management'],
  },
  nfr: {
    core: [
      'Messages delivered to available users in under 500ms.',
      'Guaranteed deliverability — a message must eventually arrive.',
      'Handle billions of users at high throughput.',
      'Messages stored centrally no longer than necessary.',
      'Resilient to failure of individual components.',
    ],
    out: ['Exhaustive treatment of end-to-end encryption internals', 'Spam and scraping prevention'],
  },
  nums: [
    ['200M', 'daily active users'],
    ['~40K/s', 'messages sent (≈ 4B/day)'],
    ['~100K/s', 'DB writes (message + inbox)'],
    ['200M', 'concurrent connections'],
    ['1–2M', 'connections per host'],
    ['30 days', 'inbox retention'],
  ],
  entities: [
    ['User', 'a person, owning one or more clients'],
    ['Chat', 'a conversation between 2–100 users'],
    ['Message', 'text plus attachment URLs, stamped with a server receive time'],
    ['Client', 'a single device — delivery is tracked per client, not per user'],
  ],
  apiIntro: 'A chat app has high-frequency updates in both directions, which rules out plain REST and points at a bi-directional socket. The client opens a WebSocket on launch and both sides exchange commands over it.',
  api: [
    { dir: '→', name: 'createChat', body: '{ participants: [], name: "" }\n→ { chatId }' },
    { dir: '→', name: 'sendMessage', body: '{ chatId, message, attachments: [] }\n→ { status, messageId }' },
    { dir: '→', name: 'getAttachmentTarget', body: '{ hash, size } → { uploadUrl, attachmentUrl }' },
    { dir: '←', name: 'newMessage', body: '{ chatId, userId, message, attachments }\n→ "RECEIVED"  (client ack)' },
    { dir: '↔', name: 'ping / pong', body: 'heartbeat carrying the user\'s sequence number' },
  ],
  apiNote: 'The client acknowledgement is non-obvious but crucial: it is what makes deleting from the inbox safe. Without acks you cannot distinguish delivered from lost.',
  hld: [
    {
      id: 'hld-1', h: 2, title: '1) Users can start group chats (limit 100)',
      focus: ['a', 'lb', 'ws', 'inbox'],
      blocks: [
        ['p', 'Start as simply as possible: one service behind an **L4 load balancer** writing chat metadata to a key/value store.'],
        ['steps', [
          'User connects and sends createChat.',
          'The service writes a Chat record plus one ChatParticipant record per member.',
          'The service returns the chatId.',
        ]],
        ['p', 'ChatParticipant needs two access patterns: all participants in a chat, and all chats for a user. A composite key of chatId + participantId serves the first; a secondary index keyed the other way serves the second.'],
        ['note', 'Why L4? We need none of L7\'s capabilities — no path routing, no spreading requests across servers behind one connection. L4 is sufficient and faster.'],
      ],
    },
    {
      id: 'hld-2', h: 2, title: '2) Users can send and receive messages',
      focus: ['a', 'b', 'lb', 'ws'],
      blocks: [
        ['p', 'Assume a single Chat Server host for now. When clients connect, record the connection in an in-memory map of userId to socket — that map is how you know who is online and how to reach them.'],
        ['steps', [
          'Sender sends sendMessage.',
          'The server looks up chat participants.',
          'It finds each participant\'s socket in its map and pushes newMessage.',
        ]],
        ['warn', 'This assumes every user is online and connected to this same host. Both are false — but the mechanics are right, which is what we needed first. Say so out loud before your interviewer does.'],
      ],
    },
    {
      id: 'hld-3', h: 2, title: '3) Offline delivery, held up to 30 days',
      focus: ['a', 'b', 'lb', 'ws', 'q', 'inbox', 'push'],
      blocks: [
        ['p', 'Give every user an **Inbox** of undelivered messages. Write there first, then attempt live delivery. This is also what makes delivery reliable rather than best-effort.'],
        ['steps', [
          'Write the message to the Message table and an Inbox entry per recipient.',
          'Return success to the sender.',
          'Push newMessage to any connected participant.',
          'On ack, delete that Inbox entry.',
        ]],
        ['p', 'On reconnect, read the user\'s Inbox, hydrate the message bodies, push them, and clear on ack. Set a TTL on both tables so old messages age out without a cleanup job.'],
        ['calc', '200M users × 20 messages/day ≈ 4B/day ≈ 40K messages/second. Each 1:1 message is one Message write plus one Inbox write, so around 100K writes/second with groups included.'],
      ],
    },
    {
      id: 'hld-4', h: 2, title: '4) Sending and receiving media',
      focus: ['a', 'b', 'ws', 'media'],
      blocks: [
        ['p', 'Media is bandwidth-intensive and exactly the wrong job for a server holding hundreds of thousands of sockets. Attachments go over a separate HTTP path, not the socket.'],
      ],
      options: [
        { rating: 'Bad', title: 'Keep attachments in the database', approach: 'The Chat Server accepts media over the socket and stores the blob.', challenges: 'Databases are not built for large binaries, and you cripple your chat servers\' bandwidth by making them do dumb storage.' },
        { rating: 'Good', title: 'Proxy through the chat server', approach: 'The server accepts the media then pushes it to blob storage with a 30-day TTL; recipients fetch via a pre-signed URL.', challenges: 'Chat servers still ingest and forward every byte — a wasted hop — and expiry once all recipients have it is unhandled.' },
        { rating: 'Great', title: 'Pre-signed URLs, both directions', approach: 'The client requests an upload target, uploads straight to blob storage, and sends the resulting URL as an opaque string. Recipients download directly. Bytes never touch your servers.', challenges: 'Still does not expire media once every recipient has it. A CDN buys little at a 100-participant cap.', best: true },
      ],
    },
  ],
  dives: [
    {
      title: 'How can we handle billions of simultaneous users?', focus: ['lb', 'ws', 'sess', 'q', 'inbox'],
      blocks: [
        ['p', 'With 1B users expect 200M connected at once. At 1–2M connections per host that is hundreds of chat servers — and now sender and recipient are on different hosts, which is a routing problem.'],
      ],
      options: [
        { rating: 'Bad', title: 'Just add hosts behind the load balancer', approach: 'Scale the chat tier horizontally and hope.', challenges: 'A server can accept a message but has no socket for most recipients. Messages are silently dropped.' },
        { rating: 'Bad', title: 'A Kafka topic per user', approach: 'Model the inbox as a per-user topic that chat servers subscribe to.', challenges: 'Kafka carries roughly 50KB of overhead per topic — 50TB of metadata at a billion users. It is not built for this.' },
        { rating: 'Good', title: 'Consistent hashing of chat servers', approach: 'Assign each user to a server by hashing their id, with the ring in a coordination service. To deliver, call the owning server directly.', challenges: 'Every server needs a connection to every other, and rebalancing requires careful connection draining plus dual publishing to avoid drops.' },
        { rating: 'Great', title: 'Offload to Pub/Sub', approach: 'On connect, the server subscribes to a channel for that user id. To send, publish to the recipient\'s channel and whichever server holds them delivers it.', challenges: 'At-most-once, so a transient failure loses that delivery — acceptable precisely because the inbox was written first. Adds a few milliseconds for the hop.', best: true },
      ],
      after: [
        ['p', '**Partition by user or by chat?** With 250 mostly-1:1 chats each, per-chat means 250 subscriptions per connected user against one for per-user. With one 100-person chat each, per-user means 99 publishes against one. WhatsApp is dominated by 1:1 chats and capped at 100 participants, so **partition by user**.'],
        ['note', 'Senior follow-up: adapt by size. Subscribe additionally to chat-level channels for chats above a threshold, publishing to both briefly during the transition.'],
      ],
    },
    {
      title: 'What about multiple clients per user?', focus: ['ws', 'sess', 'inbox'],
      blocks: [
        ['p', 'A user has a phone, a laptop, maybe a tablet. If the phone acked a message, that must not clear the laptop\'s copy — so a user-level inbox no longer works.'],
        ['bul', [
          'Add a Clients table keyed by user id.',
          'Expand each participant to their clients when resolving a chat.',
          'Make the Inbox **per client** rather than per user.',
          'Pub/Sub is unchanged — servers still subscribe by userId and fan out locally.',
        ]],
        ['note', 'Cap it at around three clients per account, or storage and throughput grow without bound.'],
      ],
    },
    {
      title: 'What if the WebSocket dies silently?', focus: ['ws', 'lb'],
      blocks: [
        ['p', 'A socket can be technically open and functionally severed. TCP keepalives take minutes to notice, which is far too slow for chat.'],
      ],
      options: [
        { rating: 'Bad', title: 'Rely on TCP timeouts', approach: 'Wait for the socket to close on its own.', challenges: 'Minutes of a user staring at a "connected" app that is dead, missing messages throughout.' },
        { rating: 'Good', title: 'ACK timeouts with retry', approach: 'No ack within 500–2000ms triggers a retry; after a few failures, close and force a reconnect.', challenges: 'Only detects failure while actively sending. A connection dying in a quiet period goes unnoticed.' },
        { rating: 'Great', title: 'Application-level heartbeats', approach: 'Ping every 10–30s; the client must pong within about 5s or the server closes the connection and the client resyncs from the inbox.', challenges: '200M connections on a 10s interval is 20M ping/pongs per second — fine in practice, and it buys a guaranteed 15-second detection bound.', best: true },
      ],
    },
    {
      title: 'What if Pub/Sub drops a message?', focus: ['sess', 'inbox', 'ws'],
      blocks: [
        ['p', 'At-most-once means a transient failure loses the realtime delivery. Durability is already handled, so the question is how a *connected* client notices quickly.'],
      ],
      options: [
        { rating: 'Good', title: 'Periodic polling', approach: 'Clients ask for missed messages every 30–60 seconds.', challenges: '200M clients polling every 30s is roughly 7M queries/second purely for sync checks.' },
        { rating: 'Good', title: 'Per-chat sequence numbers', approach: 'Clients detect a gap when they receive #5 having last seen #3.', challenges: 'Only fires when something does arrive. A quiet chat hides the gap indefinitely.' },
        { rating: 'Great', title: 'Sequence on the heartbeat', approach: 'Maintain one incrementing sequence per user and include it in every ping. A client behind the server\'s value requests a sync immediately.', challenges: 'Needs an atomic counter, but detection is within one heartbeat and costs nothing extra since the pings already exist.', best: true },
      ],
      after: [['p', 'Production systems combine all three: heartbeats catch dead sockets, sequences catch missed messages, polling is the backstop.']],
    },
    {
      title: 'How do we handle out-of-order messages?', focus: ['ws', 'q', 'inbox'],
      blocks: [
        ['p', 'We don\'t — at least not directly. Guaranteeing send-order processing needs a delay window plus a reordering mechanism, which is a great deal of complexity for something users do not want.'],
        ['p', 'Instead sync all chat servers over NTP, stamp each message with its server receive time, and display ordered by that. Ordering is then consistent across every client even when arrival order differs. Occasionally a message pops in above one sent later, and users find that acceptable.'],
      ],
    },
    {
      title: 'How would you add "last seen"?', focus: ['ws', 'sess'],
      blocks: [['p', 'We want something both efficient and scalable, and the naive version is neither.']],
      options: [
        { rating: 'Bad', title: 'Write on every heartbeat', approach: 'Update a lastSeen timestamp whenever the user does anything.', challenges: 'Millions of writes per second purely for presence, and the data is stale the instant it lands. You are buying consistency you do not need.' },
        { rating: 'Great', title: 'Exploit the connections you already have', approach: 'Store only the last *disconnect*, written once per disconnect with a conditional write so servers cannot race. Answer queries by racing the stored value against a live check on the target\'s channel.', challenges: 'The two responses can arrive slightly apart, so the client must merge them gracefully. One record per user, one write per disconnect.', best: true },
      ],
    },
  ],
  bar: {
    mid: 'Define the API clearly and land a functional high-level design. Your scaling story will have rough edges — know where they are.',
    senior: 'Speed through the high-level design to spend real time on scaling. The partition-by-user-or-chat discussion is exactly the kind of trade-off expected here.',
    staff: 'Two or three levels into failure modes: rebalancing chat servers, Redis sharding, regionalisation and cell-based architecture.',
  },
},

}
