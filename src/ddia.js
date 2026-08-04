// Consistency, replication, partitioning and isolation as modelled properties.
//
// The simulator has always modelled capacity and latency — how much a tier can
// take and how long it holds a request. It has never modelled *correctness*:
// whether a read can be stale, whether two writes can conflict, whether an
// isolation level permits the anomaly your design cannot tolerate. Those are
// the questions that decide whether a distributed design is right, and they are
// invisible on a diagram of boxes.
//
// This module adds them as properties of a datastore, and derives the
// consequences so the advisor can point at them.
//
// The concepts here are the standard vocabulary of distributed data systems —
// leader-based and leaderless replication, quorums, snapshot isolation, write
// skew, partition strategies. The explanations are written for this tool.

// ── replication ─────────────────────────────────────────────────────────────

export const REPLICATION = {
  none: {
    label: 'Single node',
    blurb: 'One copy. Simple and strongly consistent, and it is also a single point of failure and a hard ceiling on read throughput.',
    writesGoTo: 'the one node',
    survivesNodeLoss: false,
  },
  leader: {
    label: 'Single-leader',
    blurb: 'All writes go to one leader and replicate to followers. Reads can be served by followers, which is how you scale reads — and why those reads can be stale.',
    writesGoTo: 'the leader only',
    survivesNodeLoss: true,
  },
  multi: {
    label: 'Multi-leader',
    blurb: 'Several nodes accept writes, usually one per region. Local writes stay fast when a region is far away or offline, and the price is that two regions can write the same key concurrently.',
    writesGoTo: 'any leader',
    survivesNodeLoss: true,
  },
  leaderless: {
    label: 'Leaderless (quorum)',
    blurb: 'Clients write to several replicas and read from several. There is no failover step because there is no leader to fail, and consistency becomes arithmetic you have to get right.',
    writesGoTo: 'w replicas directly',
    survivesNodeLoss: true,
  },
}

// A read is guaranteed to see the latest committed write only when the read
// and write quorums overlap. This is the whole reason quorums work.
export function quorumOverlaps(n, w, r) {
  return Number(w) + Number(r) > Number(n)
}

// How many replicas may be lost while still accepting reads and writes.
export function quorumTolerance(n, w, r) {
  return { writes: Math.max(0, n - w), reads: Math.max(0, n - r) }
}

// What a given replication choice actually costs you, expressed so the advisor
// can say something specific rather than "consider consistency".
export function replicationEffects(node) {
  const mode = node.replication || (node.replicas > 1 ? 'leader' : 'none')
  const lag = Number(node.replicationLagMs ?? (mode === 'multi' ? 800 : 120))
  const n = Number(node.quorumN ?? node.replicas ?? 3)
  const w = Number(node.quorumW ?? Math.ceil(n / 2))
  const r = Number(node.quorumR ?? Math.ceil(n / 2))

  const out = {
    mode, lag, n, w, r,
    staleReads: false,
    readYourWrites: true,
    conflicts: false,
    linearizable: false,
    notes: [],
  }

  if (mode === 'none') {
    out.linearizable = true
    out.notes.push('One copy, so every read sees the last write. It also cannot survive losing the node, and every read competes with every write for the same resources.')
    return out
  }

  if (mode === 'leader') {
    out.staleReads = true
    out.readYourWrites = false
    out.notes.push('Followers trail the leader by roughly ' + lag + 'ms. A user who writes and immediately reads from a follower can see their own change missing.')
    out.notes.push('Read-your-writes needs either reading from the leader for a while after a write, or routing that user to one replica consistently.')
    out.notes.push('Failover is the dangerous moment: a promoted follower that had not caught up silently loses the writes it never received.')
    return out
  }

  if (mode === 'multi') {
    out.staleReads = true
    out.readYourWrites = false
    out.conflicts = true
    out.notes.push('Two regions can write the same key at the same time, and neither knows. Conflict resolution is not optional here — it is the design.')
    out.notes.push('Last-write-wins is the tempting answer and it silently discards data, because "last" is decided by clocks that disagree.')
    out.notes.push('The alternatives are merging in the application, or a data type that merges by construction.')
    return out
  }

  // leaderless
  out.linearizable = quorumOverlaps(n, w, r)
  if (!out.linearizable) {
    out.staleReads = true
    out.notes.push('w + r is ' + (w + r) + ', which does not exceed n = ' + n + '. The read and write sets can miss each other entirely, so a read can return a value older than a completed write.')
  } else {
    out.notes.push('w + r > n, so any read set overlaps any write set and a read can see the newest committed value.')
  }
  out.conflicts = true
  out.notes.push('Concurrent writes to one key still need versioning to detect — a quorum tells you a value was stored, not which of two concurrent values should win.')
  const tol = quorumTolerance(n, w, r)
  out.notes.push('Tolerates ' + tol.writes + ' replica(s) down for writes and ' + tol.reads + ' for reads.')
  return out
}

// ── transaction isolation ───────────────────────────────────────────────────
// Each level is defined by what it still lets happen, which is the only way to
// choose one honestly.

export const ANOMALIES = {
  dirtyRead: 'Dirty read — seeing another transaction\'s uncommitted write, which may then be rolled back.',
  dirtyWrite: 'Dirty write — overwriting another transaction\'s uncommitted write, leaving a mixture of both.',
  readSkew: 'Read skew — two reads in one transaction see the database in two different states.',
  lostUpdate: 'Lost update — two read-modify-write cycles run concurrently and one silently disappears.',
  writeSkew: 'Write skew — two transactions each check a condition, each sees it satisfied, and together they break it.',
  phantom: 'Phantom — a write changes the result of a search another transaction has already made a decision on.',
}

export const ISOLATION = {
  readUncommitted: { label: 'Read uncommitted', permits: ['dirtyRead', 'readSkew', 'lostUpdate', 'writeSkew', 'phantom'] },
  readCommitted:   { label: 'Read committed',   permits: ['readSkew', 'lostUpdate', 'writeSkew', 'phantom'] },
  snapshot:        { label: 'Snapshot / repeatable read', permits: ['lostUpdate', 'writeSkew', 'phantom'] },
  serializable:    { label: 'Serializable',     permits: [] },
}

export function isolationEffects(node) {
  const level = node.isolation || 'readCommitted'
  const def = ISOLATION[level] || ISOLATION.readCommitted
  return {
    level,
    label: def.label,
    permits: def.permits.map(k => ANOMALIES[k]),
    safeForMoney: level === 'serializable',
    // Snapshot isolation prevents read skew but not the two that actually bite
    // booking and inventory systems, which is the trap worth naming.
    trap: level === 'snapshot'
      ? 'Snapshot isolation stops reads seeing an inconsistent state, but two transactions can still each check "a seat is free" and both book it. That is write skew, and it is the classic double-booking bug.'
      : null,
  }
}

// ── partitioning ────────────────────────────────────────────────────────────

export const PARTITIONING = {
  none:   { label: 'Unpartitioned', blurb: 'One partition. Fine until the dataset or the write rate outgrows a single machine.' },
  range:  { label: 'By key range',  blurb: 'Keys stay in order, so range scans are cheap. Sequential keys — timestamps, auto-increment ids — all land on the same partition.' },
  hash:   { label: 'By hash of key', blurb: 'Spreads load evenly and destroys ordering, so a range scan becomes a scatter-gather across every partition.' },
  salted: { label: 'Hash + salt on hot keys', blurb: 'Splits a single hot key across partitions. Writes spread; reads must gather every shard of that key and add them up.' },
}

export function partitionEffects(node, opts = {}) {
  const strategy = node.partitioning || 'none'
  const skew = Number(opts.keySkew ?? node.keySkew ?? 0.2)   // 0 = uniform, 1 = one key is everything
  const parts = Number(node.partitions ?? node.replicas ?? 1)
  const out = { strategy, partitions: parts, hotspotFactor: 1, rangeScans: true, notes: [] }

  if (strategy === 'none') {
    out.hotspotFactor = 1
    out.notes.push('A single partition, so every key competes for the same machine. Sharding is a capacity decision you have not made yet.')
    return out
  }
  if (strategy === 'range') {
    // sequential keys concentrate on the newest partition
    out.hotspotFactor = 1 + skew * (parts - 1)
    out.notes.push('Range partitioning keeps scans efficient. If the key is a timestamp or a monotonic id, every new write goes to the same partition and the rest sit idle.')
    if (out.hotspotFactor > 2) out.notes.push('At this skew the busiest partition takes roughly ' + out.hotspotFactor.toFixed(1) + '× its fair share.')
    return out
  }
  if (strategy === 'hash') {
    out.rangeScans = false
    out.hotspotFactor = 1 + skew * 0.6
    out.notes.push('Hashing spreads writes evenly, but ordering is gone: any query for a range of keys has to ask every partition.')
    out.notes.push('A single very hot key still lands on one partition. Hashing fixes skewed key *distributions*, not one celebrity key.')
    return out
  }
  if (strategy === 'salted') {
    out.rangeScans = false
    out.hotspotFactor = 1.05
    out.notes.push('Salting spreads even one extremely hot key. Every read of that key now has to gather and combine each salted shard, so it costs you on the read side.')
    return out
  }
  // An unrecognised strategy must not fall through to the best case — a typo in
  // this field would otherwise silently claim the hotspot was solved.
  out.strategy = 'none'
  out.notes.push('Unknown partitioning strategy "' + strategy + '" — treated as unpartitioned.')
  return out
}

// ── secondary indexes ───────────────────────────────────────────────────────

export const SECONDARY_INDEX = {
  local:  { label: 'Local (partitioned by document)', read: 'scatter-gather', write: 'one partition' },
  global: { label: 'Global (partitioned by term)',    read: 'one partition',  write: 'several partitions' },
}

// ── advisor findings ────────────────────────────────────────────────────────
// Returned in the same shape the existing advisor uses, so these sit alongside
// the capacity findings rather than in a separate list.

const STORE_TYPES = new Set(['sql', 'nosql', 'cache', 'search', 'blob', 'warehouse', 'lake'])
const isStore = n => STORE_TYPES.has(n.type)

export function ddiaFindings(nodes, edges, rps) {
  const out = []
  const add = (sev, node, title, why, fix) =>
    out.push({ severity: sev, nodeId: node?.id, title, why, fix, source: 'consistency' })

  for (const n of nodes.filter(isStore)) {
    const rep = replicationEffects(n)

    if (rep.mode === 'none' && (n.replicas || 1) === 1) {
      add('warn', n, n.label + ' has a single copy',
        'One node holds the only copy, so losing it loses the data and every read competes with every write for it.',
        'Add followers and decide explicitly whether reads may be served by them.')
    }

    if (rep.mode === 'leader') {
      const servesReads = edges.some(e => e.to === n.id)
      if (servesReads && (n.replicas || 1) > 1) {
        add('info', n, n.label + ' can serve stale reads',
          'Followers trail the leader by about ' + rep.lag + 'ms. A user reading straight after their own write may not see it.',
          'Route a user to the leader for a short window after they write, or pin them to one replica.')
      }
    }

    if (rep.mode === 'multi') {
      add('warn', n, n.label + ' can accept conflicting writes',
        'Two leaders can take a write to the same key at the same time and neither sees the other.',
        'Choose the resolution deliberately: merge in the application, or use a data type that merges. Last-write-wins discards data.')
    }

    if (rep.mode === 'leaderless' && !quorumOverlaps(rep.n, rep.w, rep.r)) {
      add('bad', n, n.label + ' has a quorum that does not overlap',
        'w + r = ' + (rep.w + rep.r) + ' with n = ' + rep.n + '. A read set can entirely miss the replicas that took the write, so reads can go backwards.',
        'Raise w or r until w + r > n. The usual choice is w = r = ceil((n+1)/2).')
    }

    const iso = isolationEffects(n)
    if (n.type === 'sql' && iso.trap) {
      add('warn', n, n.label + ' permits write skew',
        iso.trap,
        'Use serializable isolation for the transactions that guard a constraint, or take an explicit lock on the rows the decision depends on.')
    }

    const part = partitionEffects(n)
    if (part.hotspotFactor > 2) {
      add('warn', n, n.label + ' will develop a hot partition',
        'With this partitioning the busiest partition takes about ' + part.hotspotFactor.toFixed(1) + '× its share, so it saturates long before the others.',
        'Hash the key, or salt the few keys that are genuinely hot and gather them on read.')
    }
  }

  // A cache in front of a store is a second copy of the truth, and nothing on
  // the diagram says how it is kept honest.
  for (const c of nodes.filter(n => n.type === 'cache')) {
    const backing = edges.filter(e => e.from === c.id).map(e => nodes.find(n => n.id === e.to)).filter(n => n && isStore(n) && n.type !== 'cache')
    if (backing.length) {
      add('info', c, c.label + ' is a second copy of the truth',
        'A cache in front of ' + backing.map(b => b.label).join(', ') + ' can serve a value the store has already changed.',
        'Decide the invalidation rule now: short TTL, write-through, or an invalidation event. "We will add caching later" usually means "we will debug staleness later".')
    }
  }

  return out
}

// ── faults from the distributed-systems chapter ─────────────────────────────
// The chaos engine kills and degrades nodes. These are the failures that are
// harder to reason about precisely because the node stays up.

export const DDIA_FAULTS = [
  {
    id: 'partition',
    label: 'Network partition',
    blurb: 'Two halves of the system stay up and healthy, and cannot reach each other. Each may believe the other has failed.',
    teaches: 'With a leader, both halves may promote one — split brain, and writes diverge. This is the moment CAP is actually about.',
  },
  {
    id: 'clockskew',
    label: 'Clock skew',
    blurb: 'One node\'s clock drifts ahead. Nothing looks broken.',
    teaches: 'Any last-write-wins scheme now silently prefers the node with the fast clock, and its writes win regardless of what actually happened first.',
  },
  {
    id: 'pause',
    label: 'Process pause',
    blurb: 'A node stops for seconds — garbage collection, a hypervisor pause — then resumes as if nothing happened.',
    teaches: 'Its lease or lock may have expired while it was frozen. It wakes up still believing it holds them, and writes into a world that has moved on.',
  },
  {
    id: 'asymmetric',
    label: 'One-way link failure',
    blurb: 'A can reach B, but B cannot reach A.',
    teaches: 'Failure detectors disagree about who is alive, and a system that votes can end up with two answers. Timeouts cannot distinguish this from a slow node.',
  },
]
