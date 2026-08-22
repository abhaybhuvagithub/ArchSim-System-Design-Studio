// Authored breakdowns, part 7 — unicorn designs (India + USA). Shape documented in breakdown.js.
export default {

'Zerodha (Kite)': {
  meta: 'India · fintech · hard · two paths with opposite physics',
  overview: 'A discount stock broker. One path carries orders to the exchange with a risk check in the way and a latency budget in tens of milliseconds; the other fans one exchange feed out to a million open sockets. They share almost nothing, and treating them as one system is the classic mistake.',
  scope: 'The order path, pre-trade risk, ticker fan-out and settlement into the ledger. Charting, mutual funds and the back office are below the line.',
  fr: {
    core: ['Place, modify and cancel orders on the exchange', 'Run pre-trade risk (margin, position, circuit limits) before the exchange sees the order', 'Stream live market ticks to every open client', 'Settle fills into an accurate ledger'],
    out: ['Charting and indicators', 'Mutual funds and IPO flows', 'Back-office reconciliation with the exchange'],
  },
  nfr: {
    core: ['Order round-trip in tens of milliseconds — traders can see the exchange clock', 'Ticker fan-out to ~1M sockets without per-user exchange pulls', 'Settlement is exactly-once: a duplicated fill corrupts money', 'The ledger is consistent even when everything in front of it is not'],
    out: ['Global regions — Indian exchanges are in one place'],
  },
  nums: [['~2M', 'orders on a busy day'], ['~1M', 'concurrent ticker sockets'], ['tens of ms', 'the order-path budget'], ['1', 'exchange feed, however many subscribers']],
  entities: [
    ['Order', 'a state machine: placed → validated → sent → acked → filled/rejected'],
    ['Position', 'what a trader holds — the input to every margin check'],
    ['Tick', 'one instrument price update, fanned out to everyone watching it'],
    ['Ledger entry', 'an immutable money movement; the only truth that survives an audit'],
  ],
  apiIntro: 'REST for orders, WebSocket for ticks. The asymmetry is the design: orders are few and precious, ticks are many and disposable.',
  api: [
    { dir: '→', name: 'POST /orders', body: '{ symbol, qty, price, type }\n→ { orderId, status } — RMS has already said yes' },
    { dir: '→', name: 'DELETE /orders/{id}', body: '→ { status } — a cancel races the fill, and the fill can win' },
    { dir: '⇄', name: 'WS /ticker', body: 'subscribe { tokens[] } → tick frames, conflated under load' },
  ],
  dives: [
    {
      title: 'RMS on the hot path without owning the latency budget', focus: ['rms', 'ord'],
      blocks: [
        ['p', 'Every order must pass margin, position and circuit checks before the exchange sees it — the regulator says so. But the check sits inside a budget of tens of milliseconds, so it cannot touch a database.'],
        ['bul', [
          'Positions and margins live in memory, updated from the fill stream, checked with a read and a compare.',
          'Reference data (circuit limits, instrument bans) refreshes on a schedule, never per order.',
          'The check is deterministic: same inputs, same answer — which makes it replayable when a dispute arrives.',
        ]],
        ['warn', 'The in-memory position must converge with the ledger. Drift means approving orders against money that is not there — the one failure a broker cannot have.'],
      ],
    },
    {
      title: 'One feed, a million sockets', focus: ['tick', 'snap'],
      blocks: [
        ['p', 'The exchange sends one stream. A million clients each want a slice of it. The fan-out tier subscribes once, keeps the latest snapshot per instrument, and pushes deltas to whoever subscribed.'],
        ['bul', [
          'Conflate under pressure: if a socket falls behind, send it the latest tick, not every missed one.',
          'A new subscriber gets the snapshot first, then deltas — no waiting for the next trade to know the price.',
          'Sharding is by instrument, so a hot stock heats one shard, not the fleet.',
        ]],
        ['note', 'Ticks are disposable and orders are not. Dropping a tick is invisible; dropping an order ack is a support call.'],
      ],
    },
  ],
  bar: {
    mid: 'Separate the order path from the ticker path and cache market data.',
    senior: 'Put RMS in memory on the hot path, conflate the fan-out, and make settlement exactly-once into an ACID ledger.',
    staff: 'Cover position convergence between RMS and the ledger, cancel/fill races, and what degrades first on an expiry-day spike.',
  },
},

'Dream11': {
  meta: 'India · gaming · hard · the spike is the product',
  overview: 'Fantasy sports at Indian cricket scale. Nothing happens for hours, then 80% of contest joins arrive in the ten minutes before the match locks, and then every ball bowled recomputes millions of team scores. Both halves are spiky; neither looks like steady-state web traffic.',
  scope: 'Contest join with wallet debit, the score pipeline and live leaderboards. KYC, payments-in and social features are below the line.',
  fr: {
    core: ['Join a contest: debit the wallet and register the team atomically', 'Freeze team edits at match lock', 'Recompute team points as live scores arrive', 'Serve leaderboards that move within seconds of a wicket'],
    out: ['KYC and onboarding', 'Deposit and withdrawal rails', 'Chat and social'],
  },
  nfr: {
    core: ['Survive a 50× join spike in the final minutes before lock', 'A retried join must not debit twice — idempotency is money', 'Points computation keeps up with the ball-by-ball feed', 'Leaderboard reads are cheap: millions of reads per update'],
    out: ['Real-time joins after lock — the boundary is the feature'],
  },
  nums: [['~10M', 'teams in a big contest'], ['50×', 'the join spike before lock'], ['~1/ball', 'score events driving recompute'], ['seconds', 'from wicket to leaderboard movement']],
  entities: [
    ['Contest', 'an entry pool with a fee, a prize table and a hard lock time'],
    ['Team', 'eleven picks, frozen at lock — the unit being scored'],
    ['Wallet', 'ACID money; every join is a debit against it'],
    ['Leaderboard', 'a sorted view over millions of team scores, rebuilt continuously'],
  ],
  apiIntro: 'REST for joins, read-optimized endpoints for leaderboards. The join call is the one that must be idempotent to the rupee.',
  api: [
    { dir: '→', name: 'POST /contests/{id}/join', body: '{ teamId, idempotencyKey }\n→ { entryId } | 409 already joined | 402 insufficient balance' },
    { dir: '→', name: 'GET /contests/{id}/leaderboard?cursor=', body: '→ { entries[], myRank }' },
  ],
  dives: [
    {
      title: 'The join spike: ACID money under 50× load', focus: ['join', 'wal', 'con'],
      blocks: [
        ['p', 'The debit must be ACID and the spike is brutal, so the trick is to shrink what the transaction covers: debit wallet, write entry, done. Everything else — counters, notifications, analytics — leaves on a stream.'],
        ['bul', [
          'Idempotency keys on the join: a mobile retry on a flaky network is the common case, not the edge case.',
          'Shard wallets by user — joins from different users never contend.',
          'Contest fill counts are approximate live and exact at lock; nobody needs a perfect count mid-spike.',
        ]],
        ['warn', 'Do not put the leaderboard, the contest counter and the wallet in one transaction. The wallet is money; the rest is decoration that can lag.'],
      ],
    },
    {
      title: 'Every ball recomputes millions of teams', focus: ['k', 'pts', 'ldr'],
      blocks: [
        ['p', 'A wicket changes the points of every team holding that player. The only shape that survives is stream compute: score event in, per-player delta out, applied to team totals, leaderboards updated as sorted sets.'],
        ['steps', [
          'Score feed emits one event per ball to the stream.',
          'Workers map the event to affected players and compute point deltas.',
          'Team totals update by delta — never recompute a team from scratch mid-match.',
          'Leaderboard sorted sets absorb the new totals; reads never see the pipeline.',
        ]],
        ['note', 'Ranks can be approximate between updates. "Your rank moved within seconds" is the product; "your rank is transactionally exact" is not.'],
      ],
    },
  ],
  bar: {
    mid: 'A join flow with a wallet debit, and leaderboards in a cache.',
    senior: 'Idempotent joins with a minimal ACID core, stream-computed points, sorted-set leaderboards.',
    staff: 'Size the lock-minute spike, design the delta pipeline for a mega-contest, and say what is allowed to lag and why.',
  },
},

'CRED': {
  meta: 'India · fintech · medium · PCI scope as an architecture decision',
  overview: 'Credit-card bill payments with a rewards layer. The interesting constraint is regulatory: card numbers may exist in exactly one place, so the vault is not a component, it is the boundary that shapes everything else. Payments are ACID; rewards ride an event stream and may lag.',
  scope: 'Bill fetch and payment, the card vault, and the rewards pipeline. Lending, commerce and the club are below the line.',
  fr: {
    core: ['Store cards once, tokenize everywhere else', 'Fetch statements and dues from issuers', 'Pay a bill through the right biller rail', 'Credit rewards for every successful payment'],
    out: ['Lending products', 'In-app commerce', 'Credit-score coaching'],
  },
  nfr: {
    core: ['Nothing outside the vault ever sees a PAN — PCI scope stays one service wide', 'Payment state is ACID and survives a flaky biller rail', 'Rewards are exactly-once per payment, even under replay', 'Biller outages degrade one rail, not the app'],
    out: ['Real-time bureau data'],
  },
  nums: [['1', 'place a card number may live'], ['~30+', 'biller rails, each a snowflake'], ['minutes', 'acceptable rewards lag'], ['0', 'acceptable double-credits']],
  entities: [
    ['Card token', 'the stand-in for a PAN that the rest of the system is allowed to hold'],
    ['Payment', 'a state machine: initiated → sent → confirmed/failed — with the biller in the middle'],
    ['Reward event', 'one payment, one credit; replays must collapse to one'],
    ['Biller connector', 'an adapter around one rail\'s quirks, timeouts and downtime'],
  ],
  apiIntro: 'REST throughout. The payment call returns before the biller confirms — the state machine and notifications carry the rest.',
  api: [
    { dir: '→', name: 'POST /cards', body: '{ pan, expiry } → { cardToken } — the only call that ever carries a PAN' },
    { dir: '→', name: 'POST /payments', body: '{ cardToken, amount, billerId }\n→ { paymentId, status: initiated }' },
    { dir: '←', name: 'webhook biller/confirm', body: '{ paymentId, status } — arrives whenever the rail feels like it' },
  ],
  dives: [
    {
      title: 'The vault as a blast-radius decision', focus: ['vault', 'bp'],
      blocks: [
        ['p', 'Tokenize on entry: the PAN goes into the vault, a token comes out, and every other service — bill pay, rewards, analytics — handles tokens only. PCI scope collapses from the whole company to one hardened service.'],
        ['bul', [
          'The vault exposes exactly two operations: tokenize and (for the payment moment) detokenize into the biller call.',
          'Detokenized data lives in memory for the duration of one request and is never logged.',
          'Everything else can be breached without a card number leaking — that is the design working.',
        ]],
      ],
    },
    {
      title: 'ACID payments, eventual rewards', focus: ['pay', 'k', 'rw'],
      blocks: [
        ['p', 'The payment is money and gets a transactional state machine. The reward is a thank-you and gets a stream. Coupling them means biller flakiness breaks coin balances; separating them means rewards lag by minutes and nobody minds.'],
        ['bul', [
          'Every confirmed payment emits one event; the rewards engine consumes with an idempotency key of paymentId.',
          'Replays are guaranteed to happen — the dedup store is what makes them harmless.',
          'A rewards bug is fixed by replaying the stream; a payments bug is an incident. Keep them apart.',
        ]],
        ['warn', 'Never credit rewards from the request path "because it is faster". The first biller retry storm will double-credit half the city.'],
      ],
    },
  ],
  bar: {
    mid: 'A payment flow with tokenized cards and async rewards.',
    senior: 'Vault-shaped PCI scope, a payment state machine tolerant of biller flakiness, exactly-once rewards off the stream.',
    staff: 'Argue the scope boundary, design connector isolation per rail, and handle confirm webhooks that never arrive.',
  },
},

'Zepto (10-min delivery)': {
  meta: 'India · commerce · medium · the SLO is physical',
  overview: 'Quick commerce: groceries at your door in ten minutes. The architecture is hyperlocal by construction — every dark store is its own catalog, its own inventory and its own delivery radius — and the hard SLO is not request latency but pick-pack-and-ride time.',
  scope: 'Pin-code to store mapping, per-store inventory, ordering and rider dispatch. Procurement, pricing and warehousing upstream of the dark store are below the line.',
  fr: {
    core: ['Resolve a customer to the dark store that serves them', 'Show only what that store has on shelf right now', 'Decrement stock at order time; oversell rarely and apologize well', 'Dispatch a rider to make the 10-minute promise'],
    out: ['Procurement and supplier logistics', 'Dynamic pricing', 'Subscriptions'],
  },
  nfr: {
    core: ['p99 delivery time is the SLO the business runs on', 'Inventory reads are hot-path and served from memory', 'Store-level isolation: one dark store down is one neighborhood down', 'Demand forecasting is offline but decides tomorrow\'s shelves'],
    out: ['Cross-store fulfilment — the radius is the model'],
  },
  nums: [['10 min', 'the promise, door to door'], ['~2–3 min', 'of it available for pick and pack'], ['1', 'store per customer at any moment'], ['thousands', 'of SKUs per dark store']],
  entities: [
    ['Dark store', 'a micro-warehouse with a radius; the unit of inventory, staffing and failure'],
    ['SKU stock', 'per-store on-shelf count — the number the whole app is a view over'],
    ['Order', 'a pick list bound to one store and one rider'],
    ['Rider', 'a moving resource with a location and a current task'],
  ],
  apiIntro: 'REST, with the store resolved from the pin code up front — every later call is implicitly scoped to that store.',
  api: [
    { dir: '→', name: 'GET /catalog?pin=', body: '→ { storeId, items[] } — only what is on shelf there' },
    { dir: '→', name: 'POST /orders', body: '{ storeId, items[] }\n→ { orderId, eta } | 409 item just sold out' },
    { dir: '→', name: 'GET /orders/{id}/track', body: '→ { state, riderLocation, eta }' },
  ],
  dives: [
    {
      title: 'Inventory that is honest enough', focus: ['inv', 'ord', 'osql'],
      blocks: [
        ['p', 'On-shelf stock changes with every order and every restock, and the catalog reads it on every page. Serve it from a per-store in-memory count, decrement at order time, and reconcile to the store database continuously.'],
        ['bul', [
          'The cache count is allowed to be slightly generous; the store DB is the truth at reconciliation.',
          'Oversell resolves as a refund and a substitute offer — a product decision the architecture should make rare, not impossible.',
          'Shelf audits feed corrections back in; physical inventory drifts and software must expect it.',
        ]],
        ['note', 'Trying to make stock transactionally exact across app, shelf and picker turns every page view into a lock. Honest-enough plus reconciliation is the scalable truth.'],
      ],
    },
    {
      title: 'Dispatch against a countdown', focus: ['disp', 'geo', 'k'],
      blocks: [
        ['p', 'The order event starts a ten-minute clock. Picking consumes some of it; the dispatcher spends the rest choosing a rider from the geo index so that ride time fits what remains.'],
        ['steps', [
          'Order event lands on the stream; the store starts picking immediately.',
          'Dispatch queries riders near the store, ranked by ride time to the customer.',
          'Assignment considers the batch: one rider, two nearby drops, if both promises still hold.',
          'Falling behind triggers the honest path — an updated ETA beats a broken promise.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Per-store catalog and stock, an order flow, riders on a map.',
    senior: 'In-memory stock with reconciliation, event-driven dispatch against the time budget, store-level isolation.',
    staff: 'Defend honest-enough inventory, design batching under the SLO, and connect demand forecasting to physical shelf capacity.',
  },
},

'Postman': {
  meta: 'India · devtools · medium · user code runs on your servers',
  overview: 'The API development platform. Three products share one platform: collaborative collections synced live, cloud runs that execute user-written scripts, and mock servers that answer from saved examples. The second one is the security problem hiding in a productivity tool.',
  scope: 'Collection sync, sandboxed cloud runs and mocks. Monitoring schedules, governance and the public API network are below the line.',
  fr: {
    core: ['Sync collection edits live across a team', 'Run collections in the cloud, scripts included', 'Serve mock endpoints from saved examples', 'Scope everything to workspaces and roles'],
    out: ['Scheduled monitors', 'API governance and linting', 'The public API network'],
  },
  nfr: {
    core: ['Cloud runs are sandboxed — user scripts are untrusted code, full stop', 'Sync feels instant to a team editing together', 'Mocks are cheap and isolated: no user code on that path', 'Permission checks are on every read, so they must cost nearly nothing'],
    out: ['Offline-first desktop sync'],
  },
  nums: [['~30M', 'developers as the audience'], ['0', 'trust extended to a run script'], ['ms', 'the budget for a permission check'], ['1', 'sandbox per run, disposable']],
  entities: [
    ['Collection', 'a tree of requests, scripts and variables — a live document, not a file'],
    ['Run', 'one execution of a collection: queued, sandboxed, results archived'],
    ['Mock', 'a fake endpoint answering from examples, keyed by request shape'],
    ['Workspace', 'the permission boundary everything else hangs from'],
  ],
  apiIntro: 'REST for the platform, WebSocket for sync. Runs are async: submit, poll or be notified, fetch results from storage.',
  api: [
    { dir: '⇄', name: 'WS /sync', body: 'op frames: { collectionId, path, value, version } — last writer wins per field' },
    { dir: '→', name: 'POST /runs', body: '{ collectionId, environment }\n→ { runId, status: queued }' },
    { dir: '→', name: 'GET /runs/{id}', body: '→ { status, resultsUrl }' },
  ],
  dives: [
    {
      title: 'Executing hostile code politely', focus: ['run', 'q'],
      blocks: [
        ['p', 'A collection run executes pre-request and test scripts the user wrote. Assume they are hostile: the sandbox exists so that the worst script in the world costs one disposable container, not a platform incident.'],
        ['bul', [
          'One isolated sandbox per run: no shared filesystem, an egress allowlist, hard CPU/memory/time limits.',
          'The runner queue absorbs bursts; concurrency is capped per workspace so one team cannot starve the fleet.',
          'Results go straight to object storage — the sandbox never talks to the primary databases.',
        ]],
        ['warn', 'The sandbox boundary is a security control, not a resource control. Treat an escape as a critical vulnerability, not a noisy neighbor.'],
      ],
    },
    {
      title: 'Sync that a team can feel', focus: ['sync', 'col'],
      blocks: [
        ['p', 'Two people editing one collection must both feel instant. Full CRDT machinery is overkill for tree-structured config: ship field-level operations over the socket, apply last-writer-wins per field, version to detect the rare true conflict.'],
        ['bul', [
          'Ops are tiny (path + value), so fan-out to the team is cheap.',
          'The document tree means most concurrent edits touch different fields and never conflict at all.',
          'True conflicts surface to the user — silently merging two different auth configs is worse than asking.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'Collections in a store, runs on workers, mocks from examples.',
    senior: 'A real sandbox boundary for runs, op-based live sync, permission checks cheap enough for every read.',
    staff: 'Threat-model the runner, argue LWW-per-field against CRDTs for this shape of document, and isolate mock traffic from the platform.',
  },
},

'Discord': {
  meta: 'USA · consumer · hard · fan-out is per guild, not per user',
  overview: 'Chat for communities. One WebSocket per client carries everything — messages, presence, typing — and the unit of scale is the guild: a 500,000-member server is a hot-shard problem that no amount of average-load thinking prepares you for. Voice is a separate SFU plane.',
  scope: 'The gateway, message store, guild fan-out, presence and voice topology. Moderation tooling, search and Nitro are below the line.',
  fr: {
    core: ['Deliver a message to every online member of a channel', 'Track presence for millions of concurrent users', 'Enforce per-guild roles and permissions on every action', 'Carry voice channels at conversation latency'],
    out: ['Message search', 'Moderation and trust tooling', 'Streaming and video'],
  },
  nfr: {
    core: ['Fan-out cost scales with guild size — the design must survive mega-guilds', 'Presence is ephemeral: losing it costs a reconnect blip, not data', 'Message history is durable and read by channel + time', 'Voice adds one server hop, not a mixing farm'],
    out: ['Federation'],
  },
  nums: [['~10M+', 'concurrent gateway sockets'], ['500K+', 'members in the largest guilds'], ['1', 'socket per client for everything'], ['1 up / N down', 'the SFU stream shape']],
  entities: [
    ['Guild', 'a community — the sharding unit, the permission scope and the hot spot'],
    ['Channel', 'a message timeline inside a guild'],
    ['Session', 'one gateway socket with its subscriptions and presence'],
    ['Message', 'stored by (channel, time bucket), fanned out to live sessions'],
  ],
  apiIntro: 'Nearly everything rides the gateway socket; REST exists for history and management. The socket protocol is the product.',
  api: [
    { dir: '⇄', name: 'WS /gateway', body: 'IDENTIFY → READY; then DISPATCH frames: MESSAGE_CREATE, PRESENCE_UPDATE, TYPING…' },
    { dir: '→', name: 'GET /channels/{id}/messages?before=', body: '→ { messages[] } — history pages from the store' },
  ],
  dives: [
    {
      title: 'The mega-guild problem', focus: ['gws', 'k', 'perm'],
      blocks: [
        ['p', 'A message in a 500k-member guild is one write and up to half a million deliveries. Guild state lives on a home shard that knows which sessions subscribe; delivery walks sessions, not members — offline members cost nothing until they connect.'],
        ['bul', [
          'Shard by guild id so a hot guild heats one process you can isolate and provision for.',
          'Permission checks resolve from a cached, precomputed view — never a per-message database read.',
          'Lazy guild loading: clients get member lists on demand, not the whole roster at IDENTIFY.',
        ]],
        ['warn', 'Presence updates in a mega-guild can dwarf messages. Conflate them ruthlessly — nobody can perceive 10,000 status flickers.'],
      ],
    },
    {
      title: 'Voice as an SFU, never a mixer', focus: ['vg'],
      blocks: [
        ['p', 'Each speaker sends one stream up; the SFU forwards copies to listeners. No server-side mixing, so server cost is bandwidth, latency stays at one hop, and a voice server failure drops one set of channels, not the product.'],
        ['bul', [
          'Voice servers are regional; a channel picks the one nearest its members.',
          'The gateway carries signaling only — media never touches the chat plane.',
          'Reconnect is cheap by design: voice state is small and rebuilt on join.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A WebSocket gateway, a message store, presence in a cache.',
    senior: 'Guild-sharded fan-out with cached permissions, conflated presence, SFU voice.',
    staff: 'Design for the top-10 guilds explicitly: hot-shard isolation, lazy loading, and what conflates first under load.',
  },
},

'Notion': {
  meta: 'USA · productivity · medium · everything is a block',
  overview: 'Docs, wikis and databases built from one primitive: the block. A page is a block whose children are blocks, all the way down. That single decision makes rendering a tree walk, permissions an inheritance problem, and sync a stream of small block operations.',
  scope: 'The block model, permission resolution, live sync and search indexing. Databases-as-views, integrations and AI features are below the line.',
  fr: {
    core: ['Load a page as a subtree of blocks', 'Apply edits as block operations, synced live to collaborators', 'Resolve permissions inherited down the tree', 'Index content for workspace search'],
    out: ['Database views and formulas', 'Third-party integrations', 'Public site publishing'],
  },
  nfr: {
    core: ['Page load is an ancestor-path read, so the store must be shaped for subtrees', 'Permission checks run on every read and must be cache-cheap', 'Concurrent edits converge without merging prose across users', 'Indexing lags by seconds, never blocks a keystroke'],
    out: ['Full offline editing'],
  },
  nums: [['1', 'primitive: the block'], ['~10s–100s', 'of blocks loaded per page'], ['every read', 'runs a permission check'], ['seconds', 'of acceptable search lag']],
  entities: [
    ['Block', 'typed content with a parent and ordered children — the only primitive'],
    ['Page', 'a block whose subtree renders as a document'],
    ['Permission node', 'a grant attached to a block, inherited by descendants unless overridden'],
    ['Operation', 'one block mutation: set property, move, insert, delete'],
  ],
  apiIntro: 'REST for loads, WebSocket for the operation stream. Clients send ops, receive the team\'s ops, and converge.',
  api: [
    { dir: '→', name: 'GET /pages/{id}', body: '→ { blocks[] } — the subtree, permission-filtered' },
    { dir: '⇄', name: 'WS /sync', body: 'op frames: { blockId, op, args, version } — LWW per property' },
  ],
  dives: [
    {
      title: 'Permission inheritance without a tree walk per read', focus: ['perm', 'blk'],
      blocks: [
        ['p', 'A block\'s effective permissions are its ancestors\' grants merged top-down. Walking the tree on every read of every block is death by a thousand lookups — so effective permissions are precomputed and cached, invalidated when a grant changes.'],
        ['bul', [
          'Cache key: (block subtree, principal) → effective role; most reads hit it.',
          'A share change invalidates one subtree\'s entries, not the workspace.',
          'Moves are the sharp edge: a block moved under a stricter parent must drop visibility immediately.',
        ]],
        ['warn', 'Fail closed. A permission-cache miss that defaults to "visible" is a data leak with a caching excuse.'],
      ],
    },
    {
      title: 'Convergence without merging prose', focus: ['ws', 'blk'],
      blocks: [
        ['p', 'Block structure keeps concurrent editing tractable: two people usually touch different blocks, which never conflicts. Within one block, last-writer-wins per property is honest and predictable; ordered-children moves get versioned ops so the tree cannot fork.'],
        ['bul', [
          'Ops are tiny and idempotent; the server sequences them per block.',
          'Same-block same-property races resolve LWW — rare enough that predictability beats cleverness.',
          'The block granularity is what makes LWW acceptable; a whole-document LWW would eat paragraphs.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'A block tree in a store, edits over a socket, a search index behind a queue.',
    senior: 'Subtree-shaped reads, precomputed permission caching that fails closed, op-based sync converging per block.',
    staff: 'Handle moves across permission boundaries, argue block-level LWW against CRDTs, and keep the indexer off the write path.',
  },
},

'Plaid': {
  meta: 'USA · fintech · hard · ten thousand banks, ten thousand snowflakes',
  overview: 'The connective tissue between fintech apps and banks. Users grant access, credentials enter a vault and never leave, and a fleet of per-institution connectors does whatever each bank requires — modern OAuth for some, patience and screen-shaped adapters for the rest. The product surface is data and webhooks.',
  scope: 'Link (auth + consent), the credential vault, the connector fleet and webhook delivery. Payments initiation and identity products are below the line.',
  fr: {
    core: ['Link a user\'s bank account with explicit consent', 'Keep credentials in a vault; issue short-lived session material to connectors', 'Pull accounts and transactions per institution\'s quirks', 'Deliver change webhooks to partner apps reliably'],
    out: ['Payment initiation', 'Identity verification products', 'Credit risk scoring'],
  },
  nfr: {
    core: ['Credentials never leave the vault — connectors get ephemeral material only', 'One bank\'s outage is one connector\'s outage, never the platform\'s', 'Bank cores are slow and rate-limited: cache and schedule, never fetch live per request', 'Every data pull traces to a consent grant — audit is load-bearing'],
    out: ['Real-time balances from batch-era cores'],
  },
  nums: [['~10K+', 'institutions, each different'], ['0', 'times a credential leaves the vault'], ['hours', 'typical refresh cadence against slow cores'], ['at-least-once', 'webhook delivery, with dedup keys']],
  entities: [
    ['Item', 'one user\'s link to one institution — the consent and refresh unit'],
    ['Connector', 'the adapter around one bank\'s protocol, limits and failure modes'],
    ['Transaction set', 'cached account data, refreshed on schedule and diffed for changes'],
    ['Webhook', 'a change notification to a partner, retried until acknowledged'],
  ],
  apiIntro: 'REST for partners, webhooks for changes. Partners read the cache; the connector fleet fills it in the background.',
  api: [
    { dir: '→', name: 'POST /link/token', body: '{ products[] } → { linkToken } — starts the consent flow' },
    { dir: '→', name: 'GET /transactions?item=&cursor=', body: '→ { added[], modified[], removed[] } — from cache, cursor-diffed' },
    { dir: '←', name: 'webhook TRANSACTIONS_UPDATE', body: '{ itemId, newCount } — retried until 200, deduped by id' },
  ],
  dives: [
    {
      title: 'A fleet of snowflakes', focus: ['conn', 'core'],
      blocks: [
        ['p', 'There is no "the bank API". Each institution gets a connector encapsulating its protocol, its rate limits and its scheduled maintenance windows — deployed and broken independently, so Tuesday\'s outage at one bank is one dashboard tile, not a platform incident.'],
        ['bul', [
          'Per-institution circuit breakers and rate budgets; the fleet scheduler respects both.',
          'Connector health is public-facing status — partners plan around a named bank being down.',
          'New-institution onboarding is a factory process: template, certify, canary, fleet.',
        ]],
      ],
    },
    {
      title: 'Webhooks as the real product surface', focus: ['k', 'wh'],
      blocks: [
        ['p', 'Partners build on "tell me when something changes". Change detection diffs each refresh against the cache; deliveries are at-least-once with retries, backoff, per-event dedup ids and a dead-letter path a human watches.'],
        ['bul', [
          'Partner endpoints fail constantly — retry with backoff and cap, then dead-letter and alert the partner.',
          'Ordering is per item, not global; partners are told so, loudly, in the docs.',
          'A replay tool for the dead-letter queue is a support feature, not an admin hack.',
        ]],
        ['warn', 'Webhook delivery from the request path couples your latency to your slowest partner\'s server. It always goes through the stream.'],
      ],
    },
  ],
  bar: {
    mid: 'A link flow, a vault, connectors per bank, cached transactions.',
    senior: 'Ephemeral credential material, connector-level isolation with breakers, scheduled refresh with diff-based webhooks.',
    staff: 'Design the consent/audit chain end-to-end, the connector factory, and honest partner semantics for ordering and replay.',
  },
},

'Vercel': {
  meta: 'USA · devtools · medium · two planes, one product',
  overview: 'The frontend cloud. A data plane serves visitors from the edge — static from cache, dynamic from serverless functions — while a control plane turns git pushes into immutable deployments. The two meet at exactly one point: a deployment is a pointer, and shipping is swapping it.',
  scope: 'The edge router, function execution, the build pipeline and deploy/rollback. Databases, analytics products and the framework itself are below the line.',
  fr: {
    core: ['Serve static assets from the edge cache', 'Route dynamic paths to serverless functions', 'Build every git push into an immutable deployment', 'Ship and roll back by swapping the deployment pointer'],
    out: ['Managed databases and storage products', 'Web analytics', 'Framework internals'],
  },
  nfr: {
    core: ['Edge cache hit ratio is the economics of the whole platform', 'Rollback is instant because artifacts are immutable', 'Preview deployments are prod-shaped, per branch, disposable', 'Cold starts are the serverless tax — minimized, never denied'],
    out: ['Long-running compute'],
  },
  nums: [['every push', 'becomes an immutable deployment'], ['1 pointer swap', 'to ship or roll back'], ['~90%+', 'the edge hit ratio to fight for'], ['ms', 'of cold start budget per function']],
  entities: [
    ['Deployment', 'an immutable build output plus routing config, addressable forever'],
    ['Project', 'the pointer from a domain to its current production deployment'],
    ['Function', 'a small handler deployed close to users, billed by invocation'],
    ['Build', 'the pipeline run that turns a commit into a deployment'],
  ],
  apiIntro: 'The interesting API is git push. Platform REST exists for projects, domains and deployment management.',
  api: [
    { dir: '→', name: 'git push', body: '→ build → immutable deployment → preview URL' },
    { dir: '→', name: 'POST /projects/{id}/promote', body: '{ deploymentId } → production pointer swapped' },
    { dir: '→', name: 'POST /projects/{id}/rollback', body: '→ pointer swapped back — no rebuild, no redeploy' },
  ],
  dives: [
    {
      title: 'Immutability is the rollback strategy', focus: ['bld', 'art', 'cfg'],
      blocks: [
        ['p', 'Every build output is content-addressed and kept. Production is a pointer into that space, so shipping is a swap, rollback is the same swap backwards, and "what exactly is live" always has a one-word answer: that deployment.'],
        ['bul', [
          'Previews are the same mechanism at branch granularity — prod-shaped by construction.',
          'Builds are reproducible and cached per layer; most pushes rebuild only what changed.',
          'Nothing mutates in place, so there is no "half-deployed" state to reason about.',
        ]],
      ],
    },
    {
      title: 'The edge router earns the economics', focus: ['edge', 'kv', 'inv'],
      blocks: [
        ['p', 'Per request, the edge decides: cache, function, or origin artifact. Static must overwhelmingly hit the edge cache; invalidation rides deploy events and purges exactly the paths the new deployment changed.'],
        ['bul', [
          'Cache keys include the deployment id — a new deploy cannot serve stale mixed assets.',
          'ISR-style regeneration: serve stale, revalidate in the background, on a per-path policy.',
          'Function placement follows data: a function far from its database moves the latency, not removes it.',
        ]],
        ['warn', 'The cache hit ratio is a P&L line. A framework change that quietly makes pages uncacheable is a pricing incident wearing a performance costume.'],
      ],
    },
  ],
  bar: {
    mid: 'A CDN, functions, a build pipeline, deploys.',
    senior: 'Immutable deployments with pointer-swap ship/rollback, deployment-scoped cache keys, event-driven invalidation.',
    staff: 'Argue the two-plane split, design preview isolation and build caching, and treat hit ratio as an economic SLO.',
  },
},

'Ramp': {
  meta: 'USA · fintech · hard · two seconds to answer a swipe',
  overview: 'Corporate cards where the spend policy is enforced at authorization time. When an employee swipes, the card network gives you roughly two seconds to say yes or no; miss the deadline and the network decides for you. Everything on that path is built backwards from the deadline.',
  scope: 'The authorization path, policy evaluation, inline fraud scoring and the ledger. Bill pay, reimbursements and accounting integrations are below the line.',
  fr: {
    core: ['Answer network authorization requests within the deadline', 'Enforce limits, categories and vendor policies inline', 'Score fraud inline with a strict compute budget', 'Record holds and captures as distinct ledger events'],
    out: ['Bill pay and reimbursements', 'Accounting sync', 'Card issuance logistics'],
  },
  nfr: {
    core: ['The auth path never reads a database — everything it needs is already in memory', 'A missed deadline is a wrong answer: fall back to rules, never to silence', 'Auth-to-settlement matching survives amount changes and multi-day gaps', 'Analytics and alerts are downstream of the stream, never inline'],
    out: ['Real-time accounting entries'],
  },
  nums: [['~2s', 'the network deadline, all-in'], ['~50ms', 'a sane internal budget for the decision'], ['days', 'between a hold and its capture'], ['100%', 'of declines explainable after the fact']],
  entities: [
    ['Authorization', 'one swipe: request in, decision out, hold placed'],
    ['Policy', 'the rules a company sets — limits, categories, vendors — compiled for fast evaluation'],
    ['Hold / Capture', 'the two-phase life of card money, matched across days'],
    ['Decision record', 'inputs, rules fired and the verdict — the audit answer to "why declined?"'],
  ],
  apiIntro: 'The load-bearing interface is the network\'s ISO-shaped auth message. Partner-facing REST covers cards, policies and spend.',
  api: [
    { dir: '←', name: 'network AUTH_REQUEST', body: '{ card, amount, merchant, mcc } → APPROVE | DECLINE(reason) within the deadline' },
    { dir: '→', name: 'POST /policies', body: '{ limits, categories, vendors } → compiled and pushed to the decision tier' },
    { dir: '→', name: 'GET /spend?cursor=', body: '→ { transactions[] } — from the stream-fed analytics store' },
  ],
  dives: [
    {
      title: 'A decision path built backwards from a deadline', focus: ['dec', 'pol', 'fr'],
      blocks: [
        ['p', 'Fifty milliseconds of internal budget buys: policy evaluation from an in-memory compiled form, a fraud score with a hard timeout, a ledger hold, an answer. Anything that might block — a DB read, a partner call — is disqualified from the path by construction.'],
        ['bul', [
          'Policies compile to a decision structure on write and push to the auth tier — evaluation is lookups, not queries.',
          'The fraud model gets a strict budget; on timeout the rules-only verdict stands. Degraded beats late.',
          'Every decision records its inputs and fired rules — "why was this declined" must have an exact answer.',
        ]],
        ['warn', 'Late is a decision: past the deadline the network applies stand-in processing and you own the outcome anyway. The timeout fallback is the real spec.'],
      ],
    },
    {
      title: 'Holds are not spend yet', focus: ['led', 'k', 'an'],
      blocks: [
        ['p', 'Authorization places a hold; settlement arrives days later, often for a different amount — tips, currency, partial shipments. The ledger keeps them as separate events and matching is a first-class process with an exceptions queue, not a join that is assumed to work.'],
        ['bul', [
          'Match by network references with amount tolerance; the leftovers go to a human-visible exceptions queue.',
          'Available credit reflects holds immediately; spend reporting reflects captures.',
          'Expired holds release automatically — trapped credit is a support ticket generator.',
        ]],
      ],
    },
  ],
  bar: {
    mid: 'An auth endpoint checking limits, a transactions ledger.',
    senior: 'A no-database decision path with compiled policies, budgeted inline scoring and a fallback, hold/capture as distinct events.',
    staff: 'Own the deadline end-to-end including network stand-in behavior, design the matching exceptions process, and make every decline explainable.',
  },
},

}
