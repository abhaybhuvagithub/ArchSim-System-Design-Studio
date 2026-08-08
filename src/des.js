// A discrete-event simulation core.
//
// The existing simulator solves a steady state: given a traffic rate, what does
// each tier settle at. That answers "is this design big enough" and cannot
// answer "what happened to request 92837", "why did p99 spike at t=13.4s", or
// "what did the retry storm do" — because none of those exist in a steady
// state. They are sequences of events.
//
// This is the foundation those features consume, not a feature itself. It is
// deliberately free of any ArchSim concept: no nodes, no edges, no catalogue.
// It schedules events, advances a clock, and records what happened. Everything
// domain-specific is built on top, which is what stops tracing, time-travel and
// causal analysis from each growing their own private engine.

// Deterministic by construction. A simulation you cannot re-run exactly is not
// evidence of anything, and "it only happens sometimes" is the least useful
// bug report in existence.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5;  s >>>= 0
    return s / 4294967296
  }
}

// Exponential inter-arrival times — the standard model for independent arrivals,
// and the reason real traffic clusters rather than spacing itself evenly.
export const expDelay = (rand, meanMs) => -Math.log(1 - rand()) * meanMs

// A binary heap keyed on time. An array kept sorted would make scheduling O(n)
// and the whole engine quadratic on the runs that matter most.
class EventQueue {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(e) {
    const a = this.a
    a.push(e)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.before(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p } else break
    }
  }
  pop() {
    const a = this.a
    if (!a.length) return null
    const top = a[0], last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < a.length && this.before(a[l], a[m])) m = l
        if (r < a.length && this.before(a[r], a[m])) m = r
        if (m === i) break
        ;[a[i], a[m]] = [a[m], a[i]]; i = m
      }
    }
    return top
  }
  // Ties break on sequence, so two events at the same instant run in the order
  // they were scheduled rather than in whatever order the heap happens to give.
  before(x, y) { return x.at !== y.at ? x.at < y.at : x.seq < y.seq }
}

export class Sim {
  constructor({ seed = 1, until = Infinity, maxEvents = 200000 } = {}) {
    this.now = 0
    this.q = new EventQueue()
    this.seq = 0
    this.rand = rng(seed)
    this.until = until
    this.maxEvents = maxEvents
    this.log = []
    this.cancelled = new Set()
    this.handlers = new Map()
    this.stats = { scheduled: 0, ran: 0, cancelled: 0 }
  }

  on(kind, fn) { this.handlers.set(kind, fn); return this }

  // Negative delays would let an event schedule its own past, which is how a
  // simulation clock silently goes backwards.
  schedule(kind, delay, payload = {}) {
    const d = Number(delay)
    if (!Number.isFinite(d) || d < 0) throw new Error(`schedule("${kind}") needs a finite delay >= 0, got ${delay}`)
    const e = { id: ++this.seq, kind, at: this.now + d, seq: this.seq, payload }
    this.q.push(e)
    this.stats.scheduled++
    return e.id
  }

  cancel(id) { this.cancelled.add(id); this.stats.cancelled++ }

  // One step, so a caller can drive the clock by hand — which is what a
  // time-travel debugger needs and a run-to-completion loop cannot give.
  step() {
    for (;;) {
      const e = this.q.pop()
      if (!e) return null
      if (this.cancelled.has(e.id)) continue
      if (e.at > this.until) { this.now = this.until; return null }
      this.now = e.at
      this.stats.ran++
      this.log.push({ at: e.at, kind: e.kind, id: e.id, payload: e.payload })
      this.handlers.get(e.kind)?.(e.payload, this)
      return e
    }
  }

  run() {
    // A runaway feedback loop — a retry storm scheduling its own retries — is a
    // thing this engine is meant to model, so it has to stop rather than hang.
    while (this.stats.ran < this.maxEvents) if (!this.step()) return this
    this.exhausted = true
    return this
  }
}

// One request's journey, which is what a trace view and a causal chain both read.
export class Trace {
  constructor(id, startedAt = 0) {
    this.id = id
    this.startedAt = startedAt
    this.hops = []
    this.outcome = null
  }
  hop(node, ms, note) { this.hops.push({ node, ms: +ms.toFixed(3), note }); return this }
  finish(outcome, at) { this.outcome = outcome; this.endedAt = at; return this }
  get totalMs() { return +this.hops.reduce((a, h) => a + h.ms, 0).toFixed(3) }
  get path() { return this.hops.map(h => h.node) }
  // Attribution: where the time actually went, largest first. "The database is
  // slow" is a guess; this is the measurement that replaces it.
  get attribution() {
    const total = this.totalMs || 1
    const by = {}
    for (const h of this.hops) by[h.node] = (by[h.node] || 0) + h.ms
    return Object.entries(by)
      .map(([node, ms]) => ({ node, ms: +ms.toFixed(3), share: +(ms / total).toFixed(4) }))
      .sort((a, b) => b.ms - a.ms)
  }
}

// Percentiles from raw samples — nearest-rank, so p99 of 100 samples is the
// 99th, not an interpolation of something that never happened.
export function percentile(samples, p) {
  if (!samples.length) return 0
  const a = [...samples].sort((x, y) => x - y)
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1))
  return a[i]
}
