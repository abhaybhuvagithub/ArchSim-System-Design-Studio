// Physical storage, encoding, consistency cost and stream semantics.
//
// The point of this module, as distinct from ddia.js: these properties change
// the simulated numbers. Until now every consistency property was advisory —
// the simulator read only node type and replica count, so choosing
// linearizable cost you nothing on the canvas. That is exactly backwards: the
// whole reason these are hard choices is that they cost throughput and
// latency. `physicalEffects` returns the multipliers the simulator applies.

// ── storage engines (Ch 3) ──────────────────────────────────────────────────

export const ENGINES = {
  btree: {
    label: 'B-tree',
    blurb: 'Writes go to a write-ahead log and then in place, so every write touches the disk at least twice. Reads are a predictable handful of page lookups.',
    capMul: 1, latMul: 1, tailMul: 1,
    writeAmp: 'Roughly 2×: once to the log, once to the page.',
  },
  lsm: {
    label: 'LSM-tree',
    blurb: 'Writes land in memory and are flushed as sorted files, so sustained write throughput is much higher. Compaction runs in the background and occasionally steals the disk from a read.',
    capMul: 1.6, latMul: 1.1, tailMul: 2.2,
    writeAmp: 'Higher overall, but sequential — the same data is rewritten each time it is compacted.',
  },
  memory: {
    label: 'In-memory',
    blurb: 'No disk in the read path at all. Durability becomes a separate decision — a log, a replica, or an accepted loss.',
    capMul: 3, latMul: 0.25, tailMul: 1.1,
    writeAmp: 'None, until you add the log that makes it durable.',
  },
  column: {
    label: 'Column-oriented',
    blurb: 'Values from one column are stored together, so a scan reads only the columns it needs and compresses them well. Single-row writes are expensive.',
    capMul: 0.5, latMul: 1.6, tailMul: 1.3,
    writeAmp: 'Poor for row-at-a-time writes. Load in batches, or write to a row store first and merge.',
  },
}

// ── the cost of a consistency guarantee (Ch 9) ──────────────────────────────
// Linearizability is not free, and the price is the interesting part.

export const CONSISTENCY = {
  eventual: {
    label: 'Eventual',
    blurb: 'Replicas converge at some point. Cheapest, and the default for most caches and search indexes.',
    capMul: 1, latMul: 1,
  },
  causal: {
    label: 'Causal',
    blurb: 'Operations that depend on each other are seen in order; unrelated ones may not be. Enough for most user-facing feeds, and far cheaper than total order.',
    capMul: 0.9, latMul: 1.15,
  },
  linearizable: {
    label: 'Linearizable',
    blurb: 'Every read sees the most recent write, as if there were one copy. Requires coordination on the critical path, so it costs throughput and latency — and during a network partition it costs availability.',
    capMul: 0.6, latMul: 1.6,
  },
}

// What the simulator multiplies by. Engine and consistency compose.
export function physicalEffects(node) {
  const e = ENGINES[node?.engine] || null
  const c = CONSISTENCY[node?.consistency] || null
  return {
    engine: node?.engine || null,
    consistency: node?.consistency || null,
    capMul: (e?.capMul ?? 1) * (c?.capMul ?? 1),
    latMul: (e?.latMul ?? 1) * (c?.latMul ?? 1),
    tailMul: e?.tailMul ?? 1,
  }
}

// ── encoding and schema evolution (Ch 4) ────────────────────────────────────
// This belongs on the connection, not the node: it is a property of what two
// parties agreed to send each other.

export const ENCODINGS = {
  json:     { label: 'JSON',            schema: false, compact: false, blurb: 'Human-readable, self-describing, no schema to keep in step. Field names travel with every message and nothing stops a producer changing a type.' },
  protobuf: { label: 'Protocol Buffers', schema: true,  compact: true,  blurb: 'Field tags rather than names, so renaming a field is safe and removing a required one is not. Compact, and the schema is checkable.' },
  avro:     { label: 'Avro',            schema: true,  compact: true,  blurb: 'Writer and reader schemas are resolved at read time, which makes it the friendliest for data that is written once and read for years.' },
  custom:   { label: 'Custom / binary', schema: false, compact: true,  blurb: 'Compact and fast, and every change becomes a coordinated deploy. Usually a false economy outside a hot inner loop.' },
}

// Backward: new code reads old data. Forward: old code reads new data. A
// rolling upgrade needs both, because for a while both versions are running.
export function evolutionRisk(edge) {
  const enc = ENCODINGS[edge?.encoding] ? edge.encoding : null
  if (!enc) return { encoding: null, rolling: null, risk: null }
  const rolling = edge.rollingUpgrade !== false
  const risk = !ENCODINGS[enc].schema && rolling
    ? 'A rolling upgrade runs both versions at once, so this link needs to survive old code reading new data and new code reading old data. Without a schema, nothing checks that it does.'
    : null
  return { encoding: enc, schema: ENCODINGS[enc].schema, rolling, risk }
}

// ── writing to more than one store (Ch 9) ───────────────────────────────────

export const MULTI_WRITE = {
  none:  { label: 'Not decided',      blurb: 'Two stores written in sequence with no strategy. The second write can fail and leave the first standing.' },
  twopc: { label: 'Two-phase commit', blurb: 'Atomic across both, and it turns two independent failures into one shared one: a coordinator crash can leave locks held until it returns.' },
  saga:  { label: 'Saga',             blurb: 'Local transactions plus explicit compensation. No global lock, at the cost of a window where the system is visibly inconsistent.' },
  outbox:{ label: 'Transactional outbox', blurb: 'Write the event into the same transaction as the data, then publish from that table. The usual right answer for "update the database and tell someone".' },
}

// ── stream semantics (Ch 11) ────────────────────────────────────────────────

export const DELIVERY = {
  atMostOnce:  { label: 'At most once',  blurb: 'Fire and forget. Fastest, and a crash loses messages.' },
  atLeastOnce: { label: 'At least once', blurb: 'Retried until acknowledged, so duplicates are certain. The consumer must be idempotent — that is where this actually lives.' },
  effectivelyOnce: { label: 'Effectively once', blurb: 'At-least-once delivery plus deduplication or transactional offsets. There is no exactly-once network; there is only a consumer that can absorb a repeat.' },
}

export const STREAM_ROLE = {
  none:     { label: 'Plain queue',   blurb: 'Messages are consumed and gone. Fine for work dispatch, useless for rebuilding state.' },
  log:      { label: 'Partitioned log', blurb: 'Messages are retained and replayable, ordered within a partition. A new consumer can start from the beginning.' },
  cdc:      { label: 'Change data capture', blurb: 'The stream is the database changelog, so every derived store can be built from it without dual writes.' },
  sourcing: { label: 'Event sourcing', blurb: 'The event log is the source of truth and current state is a projection of it. State can be rebuilt, and old bugs can be replayed.' },
}

// ── findings ────────────────────────────────────────────────────────────────

const STORES = new Set(['sql', 'nosql', 'cache', 'search', 'blob', 'analytics'])
const isStore = n => STORES.has(n.type)
const isService = n => ['app', 'micro', 'web', 'worker'].includes(n.type)

export function physicalFindings(nodes, edges) {
  const out = []
  const add = (severity, node, title, why, fix) =>
    out.push({ severity, nodeId: node?.id, title, why, fix, source: 'physical' })
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

  for (const n of nodes.filter(isStore)) {
    const ph = physicalEffects(n)

    if (n.engine === 'lsm') {
      add('info', n, n.label + ' will have a lumpy tail',
        'Compaction competes with reads for the same disk, so p99 suffers even when the median looks fine. This is the classic LSM trade: high sustained write throughput, occasional slow reads.',
        'Watch the tail rather than the average, and give compaction its own I/O budget if the store supports it.')
    }
    if (n.engine === 'column' && n.type !== 'analytics') {
      add('warn', n, n.label + ' is column-oriented but serving live traffic',
        'Column stores earn their keep on scans over a few columns of many rows. Writing or reading one whole row at a time is the case they are worst at.',
        'Keep an OLTP row store in front and load this in batches, or move the analytical queries somewhere else entirely.')
    }
    if (n.engine === 'memory' && (n.replicas || 1) === 1 && n.type !== 'cache') {
      add('bad', n, n.label + ' holds the only copy in memory',
        'An in-memory store with one replica and no log loses everything on restart, and restarts are not rare.',
        'Add a replica, or an append-only log, or state plainly that this data is reconstructible from somewhere else.')
    }
    if (n.consistency === 'linearizable') {
      add('info', n, n.label + ' pays for linearizability',
        'Every read must coordinate, which is why throughput drops and latency rises here. During a network partition the minority side must refuse writes rather than serve stale ones.',
        'Keep linearizability for the few operations that guard a constraint — a uniqueness check, a lock, a leader election — and leave the rest causal or eventual.')
    }
  }

  // A service writing to two stores with no stated strategy.
  for (const s of nodes.filter(isService)) {
    const targets = edges.filter(e => e.from === s.id).map(e => byId[e.to]).filter(n => n && isStore(n) && n.type !== 'cache')
    if (targets.length >= 2 && (!s.multiWrite || s.multiWrite === 'none')) {
      add('warn', s, s.label + ' writes to ' + targets.length + ' stores with no stated strategy',
        'It writes to ' + targets.map(t => t.label).join(' and ') + '. The second write can fail after the first has committed, and nothing here says what happens then.',
        'Pick one deliberately: a transactional outbox is usually right for "write data, then tell someone". A saga if the steps are long-lived. Two-phase commit only if you can accept a coordinator becoming a shared point of failure.')
    }
  }

  // Schema evolution on links.
  for (const e of edges) {
    const ev = evolutionRisk(e)
    if (ev.risk) {
      const from = byId[e.from], to = byId[e.to]
      add('info', from, (from?.label || 'A link') + ' → ' + (to?.label || '?') + ' has no schema',
        ev.risk,
        'Use a schema-carrying format on links that survive a deploy, and treat backward and forward compatibility as a property you test, not one you hope for.')
    }
  }

  // Streams.
  for (const q of nodes.filter(n => n.type === 'queue' || n.type === 'kafka')) {
    if (q.delivery === 'atLeastOnce' && !q.idempotentConsumer) {
      add('warn', q, q.label + ' will deliver duplicates',
        'At-least-once means a message will eventually arrive twice — after a timeout, a rebalance or a redeploy. Nothing here says the consumer can absorb that.',
        'Make the consumer idempotent: a natural key, a dedupe table, or an upsert. "Exactly once" is this, not a delivery mode.')
    }
    if (q.streamRole === 'sourcing' && q.type === 'queue') {
      add('bad', q, q.label + ' cannot be an event source',
        'Event sourcing needs a retained, replayable, ordered log. A queue deletes a message once it is consumed, so state can never be rebuilt.',
        'Use a partitioned log for this, and keep the queue for work dispatch.')
    }
  }

  return out
}

// Tail latency compounds: a request that fans out to N services waits for the
// slowest of them, so the more you fan out the more the tail dominates. This
// is why p99 of a request path is worse than p99 of any tier in it.
export function tailAmplification(fanout, p99Fraction = 0.01) {
  const n = Math.max(0, Math.floor(fanout))
  return 1 - Math.pow(1 - p99Fraction, n)   // chance at least one call is in its own tail
}
