// A guided track through consistency, replication, partitioning and isolation,
// each step tied to something you can do on the canvas.
//
// Written for this tool. It follows the standard progression these topics are
// usually taught in — replication, then partitioning, then transactions, then
// what goes wrong in a distributed system — because each layer depends on the
// one before it. Every step has a `try`, because reading about write skew and
// watching two bookings succeed are different kinds of knowing.

export const DDIA_TRACK = [
  {
    part: 'Replication',
    steps: [
      {
        title: 'One copy is a decision, not a default',
        idea: 'A single node is strongly consistent and always available — right up until it is not. Every read also competes with every write for the same disk and the same page cache.',
        try: 'Load any template, click its database, and set replicas to 1. Run Chaos and kill it. Watch the whole design fail, and notice the simulator cannot tell you anything about correctness — only that traffic stopped.',
        check: c => c.any(['sql', 'nosql']),
      },
      {
        title: 'Single-leader: how you scale reads, and where staleness comes from',
        idea: 'One node takes all writes and streams them to followers. Reads spread across the followers, which is the whole point — and the reason a user can write, refresh, and not see their own change.',
        try: 'Set your database to single-leader with 3 replicas. The advisor will now warn that reads can be stale. Raise the replication lag and read the warning again.',
        check: c => c.nodes.some(n => n.replication === 'leader'),
      },
      {
        title: 'Read-your-writes is a routing problem',
        idea: 'The fix for "I cannot see my own comment" is not stronger consistency everywhere. It is routing: send that user to the leader for a few seconds, or pin them to one replica.',
        try: 'Add a load balancer in front of the read replicas and label the edge "sticky by user". The point is that the fix lives in the request path, not in the database.',
      },
      {
        title: 'Failover is where writes get lost',
        idea: 'When a leader dies, a follower is promoted. Any write the old leader had accepted but not yet replicated is simply gone — and if the old leader comes back believing it is still leader, you have two.',
        try: 'Chaos → Network partition on a single-leader store. Both halves may promote a leader. That is split brain, and it is the concrete thing CAP is describing.',
      },
      {
        title: 'Multi-leader: conflicts become the design',
        idea: 'Accepting writes in several regions makes local writes fast and offline work possible. It also guarantees that two regions will eventually write the same key at the same moment.',
        try: 'Set a store to multi-leader. The advisor flags conflicting writes. Now decide the resolution — and notice that last-write-wins is the only option that needs no code and loses data.',
        check: c => c.nodes.some(n => n.replication === 'multi'),
      },
      {
        title: 'Leaderless: consistency as arithmetic',
        idea: 'Write to w replicas, read from r of n. If w + r > n the two sets must overlap, so a read sees the newest write. If they do not overlap, reads can go backwards.',
        try: 'Set a store to leaderless with n = 3, w = 1, r = 1. The advisor marks the quorum as broken. Raise w to 2 and r to 2 and watch it clear.',
        check: c => c.nodes.some(n => n.replication === 'leaderless'),
      },
    ],
  },
  {
    part: 'Partitioning',
    steps: [
      {
        title: 'Partition on something that never needs joining across',
        idea: 'A good key means every query touches one partition. User, tenant, city, merchant. A bad one means every query asks every partition and you have built a slower single machine.',
        try: 'Open the Scale tab on any template and read the sharding lever. Every design in the library names its key and why.',
      },
      {
        title: 'Key range is ordered and lopsided',
        idea: 'Range partitioning keeps scans cheap. If the key increases — a timestamp, an auto-increment id — then every new write lands on the newest partition while the others idle.',
        try: 'Set a store to range partitioning and raise the key skew. The advisor predicts the hot partition and tells you roughly how much of the load it takes.',
      },
      {
        title: 'Hashing spreads keys, not one hot key',
        idea: 'Hashing fixes a skewed distribution and destroys ordering, so range scans become scatter-gather. It does nothing for a single celebrity key, which still hashes to exactly one partition.',
        try: 'Switch to hash partitioning. The hot-partition warning drops but does not vanish — that residue is the one hot key.',
      },
      {
        title: 'Salting is the fix for the celebrity key, and it costs you reads',
        idea: 'Split one hot key into several by adding a salt. Writes spread across partitions; every read of that key now has to gather each shard and combine them.',
        try: 'Switch to hash + salt. The hotspot clears. Ask yourself what the read path now costs — that trade is the whole point.',
      },
      {
        title: 'Secondary indexes pick which side pays',
        idea: 'A local index is partitioned with the documents: writes touch one partition, reads ask them all. A global index is partitioned by the term: reads hit one partition, writes touch several.',
        try: 'On a search-heavy template — Yelp, IndiaMART — decide which you want and why. Read-heavy usually argues for global.',
      },
    ],
  },
  {
    part: 'Transactions',
    steps: [
      {
        title: 'An isolation level is defined by what it still permits',
        idea: 'Not by what it prevents. Read committed stops dirty reads and allows lost updates, write skew and phantoms. Choosing a level means choosing which anomalies you can live with.',
        try: 'Click a SQL store and set its isolation level. The inspector lists exactly what that level still allows.',
      },
      {
        title: 'Write skew is the one that books the seat twice',
        idea: 'Two transactions each check that a seat is free, each sees it free, and each books it. Neither read stale data. Snapshot isolation does not stop this, which surprises people at exactly the wrong moment.',
        try: 'Load Ticketmaster. Set the bookings database to snapshot isolation and read the advisor warning. Then read the Breakdown deep dive on double-booking and see the same problem described from the design side.',
        check: c => c.nodes.some(n => n.type === 'sql' && n.isolation === 'snapshot'),
      },
      {
        title: 'Serializable costs throughput, so scope it',
        idea: 'Serializable removes the whole class of anomaly and costs contention. The answer is rarely "serializable everywhere" — it is serializable on the few transactions that guard a constraint.',
        try: 'Set the booking transaction to serializable and leave catalogue reads at read committed. Two levels in one design is the normal, correct answer.',
      },
      {
        title: 'A distributed transaction is usually the wrong tool',
        idea: 'Two-phase commit across services turns independent failures into a shared one. Most systems are better served by a saga: local transactions plus explicit compensation.',
        try: 'Open the E-commerce Saga template and its Breakdown. Compare what it does with what a distributed transaction would have promised.',
      },
    ],
  },
  {
    part: 'What actually goes wrong',
    steps: [
      {
        title: 'You cannot tell a slow node from a dead one',
        idea: 'Every failure detector is a timeout, and a timeout cannot distinguish a crashed node from a slow network from a paused process. Every design decision downstream inherits that ambiguity.',
        try: 'Chaos → Process pause. The node is up the whole time, and the system treats it as gone.',
      },
      {
        title: 'Clocks disagree, so do not order events with them',
        idea: 'Wall-clock time drifts between machines. Anything that decides "which write was last" by timestamp is really deciding "which machine had the faster clock".',
        try: 'Chaos → Clock skew on a multi-leader store using last-write-wins. The skewed node wins every conflict, regardless of what happened first.',
      },
      {
        title: 'A lease can expire while you are frozen',
        idea: 'A node that pauses for ten seconds wakes up still believing it holds the lock it took eleven seconds ago. It then writes into a world that moved on without it.',
        try: 'Chaos → Process pause on a node holding a seat lock in Ticketmaster. This is why the confirm step re-validates inside the transaction rather than trusting the lock.',
      },
      {
        title: 'Partitions are not hypothetical, and neither halves knows',
        idea: 'When the network splits, both sides are healthy and each believes the other has failed. You choose in advance which side stops accepting writes — or you get two answers.',
        try: 'Chaos → Network partition. Then decide, before looking, which half of your design should refuse writes. That decision is the design.',
      },
    ],
  },
]

// Comparisons in the same shape the Learn tab already uses.
export const DDIA_COMPARISONS = [
  {
    title: 'Replication topologies',
    cols: ['Single-leader', 'Multi-leader', 'Leaderless'],
    rows: [
      ['Writes accepted at', 'One node', 'Several nodes', 'Any w replicas'],
      ['Write conflicts', 'Impossible', 'Guaranteed eventually', 'Possible, need versions'],
      ['Read staleness', 'On followers', 'Yes', 'Unless w + r > n'],
      ['Failover', 'Explicit, risky', 'None needed', 'None needed'],
      ['Best for', 'Most systems', 'Multi-region, offline clients', 'High availability, tolerant reads'],
      ['Bites you when', 'The leader dies mid-write', 'Two regions edit one key', 'Someone sets w = r = 1'],
    ],
    note: 'Single-leader is the default for good reason. The other two buy availability and pay for it in conflict handling.',
  },
  {
    title: 'What each isolation level still allows',
    cols: ['Read committed', 'Snapshot', 'Serializable'],
    rows: [
      ['Dirty read', 'No', 'No', 'No'],
      ['Read skew', 'Yes', 'No', 'No'],
      ['Lost update', 'Yes', 'Unless detected', 'No'],
      ['Write skew', 'Yes', 'Yes', 'No'],
      ['Phantoms', 'Yes', 'Yes', 'No'],
      ['Cost', 'Low', 'Moderate', 'Contention'],
    ],
    note: 'Write skew surviving snapshot isolation is the row worth remembering — it is the double-booking bug.',
  },
  {
    title: 'Partitioning strategies',
    cols: ['Key range', 'Hash', 'Hash + salt'],
    rows: [
      ['Range scans', 'Cheap', 'Scatter-gather', 'Scatter-gather'],
      ['Even load', 'Only if keys are', 'Yes', 'Yes'],
      ['One hot key', 'Hot partition', 'Still one partition', 'Spread'],
      ['Read cost of a hot key', 'Normal', 'Normal', 'Gather every shard'],
      ['Typical use', 'Time series you scan', 'User or tenant keyed', 'A known celebrity key'],
    ],
    note: 'Hashing fixes a skewed distribution. Salting fixes a single key. They solve different problems and are often confused.',
  },
]
