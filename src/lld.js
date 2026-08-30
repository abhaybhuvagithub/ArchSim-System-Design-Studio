// Authored low-level design: data model, the critical flow as a sequence, and
// a state machine where the entity actually has one.
//
// Templates without an entry here still get a Low-Level Design section — the
// sequence is derived from the graph's primary path and the data model is
// sketched from the authored core entities. This file is for the designs where
// the detail is the point.
//
//   schema: [{ name, columns: [[col, type, note]], idx: [...] }]
//   flow:   { title, actors: [[id, label]], steps: [{ from, to, label, ret }] }
//   state:  { title, states: [...], transitions: [[from, to, label]] }

export default {

'URL Shortener (Bitly)': {
  intro: 'Two tables and one hot read. The whole design is a key-value lookup, so the low-level detail is about the key, not the query.',
  schema: [
    {
      name: 'links',
      columns: [
        ['short_code', 'varchar(8)', 'PK — base62 of a permuted counter'],
        ['long_url', 'text', 'the destination, immutable'],
        ['owner_id', 'bigint', 'nullable; anonymous links have none'],
        ['created_at', 'timestamptz', ''],
        ['expires_at', 'timestamptz', 'nullable; TTL-swept'],
      ],
      idx: ['PRIMARY KEY (short_code) — the only access path on the hot read',
        'UNIQUE (short_code) is what makes custom aliases safe under concurrency',
        'partial index on expires_at WHERE expires_at IS NOT NULL, for the sweeper'],
    },
    {
      name: 'counter_blocks',
      columns: [
        ['instance_id', 'uuid', 'PK'],
        ['block_start', 'bigint', 'first id in this instance\'s allocation'],
        ['block_end', 'bigint', 'exclusive'],
        ['leased_at', 'timestamptz', ''],
      ],
      idx: ['one row per live instance; a crash simply abandons its block'],
    },
  ],
  flow: {
    title: 'Following a short link',
    actors: [['b', 'Browser'], ['cdn', 'CDN'], ['svc', 'Redirect Svc'], ['c', 'Cache'], ['db', 'KV Store']],
    steps: [
      { from: 'b', to: 'cdn', label: 'GET /abc123' },
      { from: 'cdn', to: 'b', label: '302 (edge hit, most requests stop here)', ret: true },
      { from: 'cdn', to: 'svc', label: 'miss' },
      { from: 'svc', to: 'c', label: 'GET link:abc123' },
      { from: 'c', to: 'svc', label: 'hit → long_url', ret: true },
      { from: 'svc', to: 'db', label: 'miss only: SELECT by short_code' },
      { from: 'svc', to: 'b', label: '302 Location: <long_url>', ret: true },
    ],
  },
  notes: [
    ['note', 'Note what is absent: no write, no counter increment, no analytics call. Anything added to this path is paid for on every redirect in the world.'],
  ],
},

'Chat (WhatsApp)': {
  intro: 'The inbox table is the whole trick. It is what turns an at-most-once realtime path into an at-least-once delivery guarantee.',
  schema: [
    {
      name: 'chat_participants',
      columns: [
        ['chat_id', 'uuid', 'PK part 1 — partition key'],
        ['user_id', 'uuid', 'PK part 2 — sort key'],
        ['joined_at', 'timestamptz', ''],
      ],
      idx: ['PK (chat_id, user_id) answers "who is in this chat"',
        'GSI (user_id, chat_id) answers "what chats am I in" — both are hot'],
    },
    {
      name: 'messages',
      columns: [
        ['chat_id', 'uuid', 'partition key'],
        ['message_id', 'ulid', 'sort key — server receive time is embedded'],
        ['sender_id', 'uuid', ''],
        ['body', 'bytes', 'ciphertext; the server cannot read it'],
        ['attachments', 'text[]', 'opaque blob URLs'],
        ['ttl', 'number', '30 days, swept automatically'],
      ],
      idx: ['range scan on (chat_id, message_id) is the history read'],
    },
    {
      name: 'inbox',
      columns: [
        ['client_id', 'uuid', 'partition key — per device, not per user'],
        ['message_id', 'ulid', 'sort key'],
        ['chat_id', 'uuid', ''],
        ['ttl', 'number', ''],
      ],
      idx: ['a row exists only while undelivered — the ack deletes it',
        'per-client, so one device acking never clears another'],
    },
  ],
  flow: {
    title: 'Sending a message to an offline recipient',
    actors: [['a', 'Sender'], ['s1', 'Chat Svc'], ['db', 'Message + Inbox'], ['ps', 'Pub/Sub'], ['s2', 'Chat Svc B'], ['b', 'Recipient']],
    steps: [
      { from: 'a', to: 's1', label: 'sendMessage' },
      { from: 's1', to: 'db', label: 'write message + inbox row per client' },
      { from: 's1', to: 'a', label: 'SUCCESS (durable — this is the guarantee)', ret: true },
      { from: 's1', to: 'ps', label: 'publish to channel:userB (best effort)' },
      { from: 'ps', to: 's2', label: 'no subscriber — dropped' },
      { from: 'b', to: 's2', label: '… later: connect' },
      { from: 's2', to: 'db', label: 'read inbox for this client' },
      { from: 's2', to: 'b', label: 'newMessage', ret: true },
      { from: 'b', to: 's2', label: 'ack → delete inbox row' },
    ],
  },
  state: {
    title: 'Message lifecycle — the tick machine',
    states: ['COMPOSED', 'QUEUED_ON_DEVICE', 'SENT (✓)', 'DELIVERED (✓✓)', 'READ (blue ✓✓)', 'FAILED'],
    transitions: [
      ['COMPOSED', 'QUEUED_ON_DEVICE', 'send tapped — the message is durable on the phone BEFORE any network exists'],
      ['QUEUED_ON_DEVICE', 'SENT (✓)', 'server acked and persisted; one tick is a promise from the server, not the recipient'],
      ['SENT (✓)', 'DELIVERED (✓✓)', 'recipient device acked — store-and-forward held it while they were offline'],
      ['DELIVERED (✓✓)', 'READ (blue ✓✓)', 'read receipt, if the recipient allows it — a privacy toggle, not a protocol truth'],
      ['QUEUED_ON_DEVICE', 'FAILED', 'retries exhausted — shown honestly, retried on reconnect'],
      ['SENT (✓)', 'SENT (✓)', 'recipient offline: the server holds it (the queue IS the product)'],
    ],
  },
  notes: [
    ['warn', 'The ordering matters more than any single component. Durable write, then acknowledge, then publish. Invert those and a Pub/Sub drop becomes a lost message.'],
  ],
},

'Ticketmaster': {
  intro: 'A seat has a lifecycle, and every hard problem in this design is a transition in it.',
  schema: [
    {
      name: 'seats',
      columns: [
        ['event_id', 'uuid', 'PK part 1 — the shard key'],
        ['seat_id', 'varchar', 'PK part 2 — section/row/number'],
        ['status', 'enum', 'AVAILABLE | HELD | SOLD'],
        ['price_cents', 'int', ''],
        ['version', 'int', 'optimistic-lock guard on confirm'],
      ],
      idx: ['PK (event_id, seat_id) — every query is scoped to one event',
        'partial index WHERE status = AVAILABLE, for the seat map'],
    },
    {
      name: 'holds',
      columns: [
        ['hold_id', 'uuid', 'PK'],
        ['event_id', 'uuid', ''],
        ['seat_ids', 'varchar[]', ''],
        ['user_id', 'uuid', ''],
        ['expires_at', 'timestamptz', 'the TTL that releases abandoned carts'],
      ],
      idx: ['mirrored in Redis as SET seat:{event}:{seat} NX EX 600 — Redis is the gate, this table is the record'],
    },
    {
      name: 'bookings',
      columns: [
        ['booking_id', 'uuid', 'PK'],
        ['event_id', 'uuid', ''],
        ['seat_ids', 'varchar[]', ''],
        ['payment_ref', 'varchar', 'idempotency key from the processor'],
        ['status', 'enum', 'PENDING | PAID | CONFIRMED | REFUNDED'],
      ],
      idx: ['UNIQUE (event_id, seat_id) via a join table is the last line of defence against double-selling'],
    },
  ],
  flow: {
    title: 'Reserve, pay, confirm',
    actors: [['u', 'Buyer'], ['q', 'Waiting Room'], ['bk', 'Booking Svc'], ['r', 'Redis Locks'], ['db', 'Bookings DB'], ['p', 'Payment']],
    steps: [
      { from: 'u', to: 'q', label: 'enter on-sale' },
      { from: 'q', to: 'u', label: 'admission token', ret: true },
      { from: 'u', to: 'bk', label: 'reserve(seats, token)' },
      { from: 'bk', to: 'r', label: 'SET NX EX 600 per seat' },
      { from: 'r', to: 'bk', label: 'acquired (or 409 to the loser)', ret: true },
      { from: 'bk', to: 'u', label: 'holdId, expiresAt', ret: true },
      { from: 'u', to: 'p', label: 'pay (seconds — no DB transaction is open)' },
      { from: 'u', to: 'bk', label: 'confirm(holdId, paymentToken)' },
      { from: 'bk', to: 'db', label: 'TX: re-check hold, mark SOLD, insert booking' },
      { from: 'bk', to: 'r', label: 'release lock' },
    ],
  },
  state: {
    title: 'Seat lifecycle',
    states: ['AVAILABLE', 'HELD', 'SOLD'],
    transitions: [
      ['AVAILABLE', 'HELD', 'reserve — SET NX'],
      ['HELD', 'AVAILABLE', 'TTL expiry / abandon'],
      ['HELD', 'SOLD', 'confirm — inside the transaction'],
      ['SOLD', 'AVAILABLE', 'refund / release'],
    ],
  },
},

'Ride Sharing (Uber)': {
  intro: 'Two stores with opposite characters: an in-memory index that is allowed to be lost, and a trip table that is not.',
  schema: [
    {
      name: 'driver_location  (Redis, not a table)',
      columns: [
        ['key', 'geo:{h3_cell}', 'a sorted set per H3 cell'],
        ['member', 'driver_id', ''],
        ['score', 'last_ping_epoch', 'staleness check comes free'],
        ['ttl', '15s', 'a driver who stops pinging leaves the pool'],
      ],
      idx: ['rebuildable by construction — drivers repopulate it within seconds of a flush'],
    },
    {
      name: 'trips',
      columns: [
        ['trip_id', 'uuid', 'PK'],
        ['rider_id', 'uuid', ''],
        ['driver_id', 'uuid', 'null until matched'],
        ['status', 'enum', 'the state machine below'],
        ['pickup', 'point', ''],
        ['dropoff', 'point', ''],
        ['fare_cents', 'int', 'null until completed'],
        ['city_id', 'int', 'the shard key — trips never cross cities'],
      ],
      idx: ['PK (trip_id); index (driver_id, status) enforces one active trip per driver'],
    },
  ],
  flow: {
    title: 'Matching a rider to a driver',
    actors: [['r', 'Rider'], ['m', 'Match Svc'], ['g', 'Geo Index'], ['l', 'Claim Lock'], ['d', 'Driver'], ['t', 'Trips DB']],
    steps: [
      { from: 'r', to: 'm', label: 'requestRide(pickup)' },
      { from: 'm', to: 'g', label: 'ZRANGE cell + ring of neighbours' },
      { from: 'g', to: 'm', label: 'candidate driver ids', ret: true },
      { from: 'm', to: 'l', label: 'SET driver:{id} NX EX 30' },
      { from: 'm', to: 'd', label: 'offer (expires in 15s)' },
      { from: 'd', to: 'm', label: 'accept' },
      { from: 'm', to: 't', label: 'INSERT trip, status = MATCHED' },
      { from: 'm', to: 'r', label: 'driver, ETA', ret: true },
    ],
  },
  state: {
    title: 'Trip lifecycle',
    states: ['REQUESTED', 'MATCHED', 'ARRIVING', 'IN_TRIP', 'COMPLETED', 'CANCELLED'],
    transitions: [
      ['REQUESTED', 'MATCHED', 'driver accepts'],
      ['REQUESTED', 'CANCELLED', 'no driver / rider cancels'],
      ['MATCHED', 'ARRIVING', 'driver en route'],
      ['MATCHED', 'CANCELLED', 'driver cancels → re-match'],
      ['ARRIVING', 'IN_TRIP', 'rider picked up'],
      ['IN_TRIP', 'COMPLETED', 'dropoff'],
    ],
  },
},

'Amazon (marketplace)': {
  intro: 'The join that never happens at request time: catalogue, offers and per-warehouse inventory are three different stores with three different consistency needs.',
  schema: [
    {
      name: 'products',
      columns: [
        ['product_id', 'uuid', 'PK'],
        ['title', 'text', ''],
        ['attributes', 'jsonb', 'seller-supplied, no schema you control'],
        ['media', 'text[]', 'CDN keys'],
      ],
      idx: ['near-immutable and cached everywhere — this store is rarely read directly'],
    },
    {
      name: 'offers',
      columns: [
        ['offer_id', 'uuid', 'PK'],
        ['product_id', 'uuid', 'many offers per product'],
        ['seller_id', 'uuid', ''],
        ['price_cents', 'int', ''],
        ['condition', 'enum', 'NEW | USED'],
      ],
      idx: ['index (product_id, price_cents) picks the buy-box winner'],
    },
    {
      name: 'inventory',
      columns: [
        ['fc_id', 'int', 'PK part 1 — fulfilment centre, the shard key'],
        ['offer_id', 'uuid', 'PK part 2'],
        ['qty', 'int', 'CHECK (qty >= 0) — the last guard against overselling'],
      ],
      idx: ['sharded by fc_id because stock is physical and lives in one building',
        'conditional UPDATE … WHERE qty >= :n is the reservation'],
    },
  ],
  flow: {
    title: 'Rendering a product page with a delivery date',
    actors: [['u', 'Shopper'], ['p', 'Product Svc'], ['c', 'Cache'], ['pr', 'Promise Svc'], ['i', 'Inventory']],
    steps: [
      { from: 'u', to: 'p', label: 'GET /products/{id}' },
      { from: 'p', to: 'c', label: 'product + offers (near-always a hit)' },
      { from: 'c', to: 'p', label: 'cached payload', ret: true },
      { from: 'p', to: 'pr', label: 'promise(region, offerId)' },
      { from: 'pr', to: 'pr', label: 'lookup precomputed reachable FCs' },
      { from: 'pr', to: 'i', label: 'qty > 0 in any reachable FC?' },
      { from: 'pr', to: 'p', label: '"arrives Tuesday"', ret: true },
      { from: 'p', to: 'u', label: 'page (recommendations dropped if slow)', ret: true },
    ],
  },
  notes: [
    ['note', 'Availability here is a hint and may be stale. The conditional decrement at checkout is the only place the number has to be true.'],
  ],
},

'Payment System (Stripe-lite)': {
  intro: 'Nothing is ever updated. Balances are a fold over immutable entries, which is what makes every discrepancy explicable.',
  schema: [
    {
      name: 'idempotency_keys',
      columns: [
        ['key', 'varchar(64)', 'PK — client-generated, before the first attempt'],
        ['merchant_id', 'uuid', 'scoped, so keys cannot collide across merchants'],
        ['response', 'jsonb', 'the stored reply, replayed verbatim on retry'],
        ['created_at', 'timestamptz', 'TTL 24h'],
      ],
      idx: ['UNIQUE (merchant_id, key) — the insert itself is the lock'],
    },
    {
      name: 'ledger_entries',
      columns: [
        ['entry_id', 'bigserial', 'PK — append only, never updated'],
        ['txn_id', 'uuid', 'groups the debit and credit of one movement'],
        ['account_id', 'uuid', ''],
        ['direction', 'enum', 'DEBIT | CREDIT'],
        ['amount_cents', 'bigint', 'always positive; direction carries the sign'],
      ],
      idx: ['index (account_id, entry_id) for balance folds',
        'every txn_id must sum to zero — assert it in a nightly job'],
    },
    {
      name: 'outbox',
      columns: [
        ['id', 'bigserial', 'PK'],
        ['topic', 'varchar', ''],
        ['payload', 'jsonb', ''],
        ['published_at', 'timestamptz', 'null until a worker ships it'],
      ],
      idx: ['written in the same transaction as the ledger entry — that is the whole point'],
    },
  ],
  flow: {
    title: 'A charge, with the client retrying',
    actors: [['m', 'Merchant'], ['gw', 'Gateway'], ['idem', 'Idem Store'], ['led', 'Ledger'], ['ob', 'Outbox'], ['psp', 'Processor']],
    steps: [
      { from: 'm', to: 'gw', label: 'POST /payments  Idempotency-Key: k1' },
      { from: 'gw', to: 'idem', label: 'INSERT k1 … ON CONFLICT DO NOTHING' },
      { from: 'gw', to: 'led', label: 'TX: ledger entries + outbox row' },
      { from: 'gw', to: 'ob', label: '(same transaction — atomic)' },
      { from: 'gw', to: 'm', label: '201 { paymentId }', ret: true },
      { from: 'ob', to: 'psp', label: 'worker publishes → charge' },
      { from: 'm', to: 'gw', label: 'timeout → retry with the same k1' },
      { from: 'gw', to: 'idem', label: 'conflict → replay stored response' },
      { from: 'gw', to: 'm', label: 'same 201, no second charge', ret: true },
    ],
  },
  state: {
    title: 'Payment lifecycle',
    states: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'],
    transitions: [
      ['PENDING', 'AUTHORIZED', 'processor accepts'],
      ['PENDING', 'FAILED', 'declined / timeout resolved as failed'],
      ['AUTHORIZED', 'CAPTURED', 'capture'],
      ['AUTHORIZED', 'FAILED', 'void before capture'],
      ['CAPTURED', 'REFUNDED', 'refund — a new entry, never an update'],
    ],
  },
},

}
