// ── Monte-Carlo reliability engine ──────────────────────────────────────────
// One simulate() call gives a single deterministic outcome. Reality is not one
// outcome: traffic varies, dependencies slow down, nodes occasionally drop.
// This runs the SAME simulator N times with inputs drawn from distributions and
// reports the DISTRIBUTION of results — the p50/p95/p99 across runs, and the
// probability an SLO is violated.
//
// Two honesty rules bake in:
//   1. Seeded RNG — same seed, same result, byte for byte. A reliability number
//      you cannot reproduce is not a reliability number. The seed is reported.
//   2. It never claims to be reality. It is a model over your inputs, and the
//      result carries its provenance (iterations, seed, what was varied) so it
//      can never be mistaken for a measured benchmark.
import { simulate } from './sim.js'

// Mulberry32 — a tiny, fast, seedable PRNG. Deterministic across machines.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller: a standard normal from two uniforms, clamped to sane bounds.
function normal(rand, mean, sd) {
  const u1 = Math.max(1e-9, rand()), u2 = rand()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * sd
}

const pct = (sorted, p) => {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

// variability presets: how much the world wobbles run to run.
export const MC_PROFILES = {
  calm:   { label: 'Calm', trafficSd: 0.10, latSd: 0.10, dropChance: 0.01, dropLat: 1.4 },
  normal: { label: 'Normal', trafficSd: 0.25, latSd: 0.20, dropChance: 0.03, dropLat: 1.8 },
  spiky:  { label: 'Spiky', trafficSd: 0.55, latSd: 0.40, dropChance: 0.08, dropLat: 2.6 },
}

/**
 * Run N Monte-Carlo iterations of a design.
 * @param nodes, edges, rps — the design under test
 * @param opts.iterations — number of runs (default 1000)
 * @param opts.seed — integer seed (default 42) — reported, for reproducibility
 * @param opts.profile — 'calm' | 'normal' | 'spiky' variability preset
 * @param opts.slo — { p99, availability, successRate } thresholds to score against (any subset)
 */
export function monteCarlo(nodes, edges, rps, opts = {}) {
  const iterations = Math.min(20000, Math.max(50, Math.round(opts.iterations || 1000)))
  const seed = Number.isFinite(opts.seed) ? (opts.seed >>> 0) : 42
  const prof = MC_PROFILES[opts.profile] || MC_PROFILES.normal
  const slo = opts.slo || {}
  const rand = rng(seed)

  const p50s = [], p95s = [], p99s = [], avails = [], successes = []
  let sloViolations = 0
  // per-node "how often was this the busiest tier" — a distributional bottleneck signal
  const hotCount = {}

  for (let i = 0; i < iterations; i++) {
    // draw this run's world: traffic multiplier, per-node latency multiplier,
    // and occasional per-node capacity dents (a dependency having a bad moment).
    const rpsMul = Math.max(0.05, normal(rand, 1, prof.trafficSd))
    const node = {}
    for (const n of nodes) {
      const latMul = Math.max(0.2, normal(rand, 1, prof.latSd))
      let capMul = 1
      if (rand() < prof.dropChance) capMul = Math.max(0.2, 1 - Math.abs(normal(rand, 0, 0.4)))
      if (latMul !== 1 || capMul !== 1) node[n.id] = { latMul, capMul }
    }
    const s = simulate(nodes, edges, rps, new Set(), { rpsMul, node })

    p50s.push(s.p50); p95s.push(s.p95); p99s.push(s.p99)
    avails.push(s.sysAvail); successes.push(s.successRate)

    // busiest tier this run
    let hot = null, hu = -1
    for (const [id, st] of Object.entries(s.stats)) if ((st.util || 0) > hu) { hu = st.util; hot = id }
    if (hot) hotCount[hot] = (hotCount[hot] || 0) + 1

    // SLO scoring: a run "violates" if it breaches ANY provided threshold
    let bad = false
    if (slo.p99 != null && s.p99 > slo.p99) bad = true
    if (slo.availability != null && s.sysAvail < slo.availability) bad = true
    if (slo.successRate != null && s.successRate < slo.successRate) bad = true
    if (bad) sloViolations++
  }

  const sortNum = a => a.slice().sort((x, y) => x - y)
  const P = arr => { const s = sortNum(arr); return { p50: pct(s, 50), p95: pct(s, 95), p99: pct(s, 99), min: s[0], max: s[s.length - 1] } }

  const topHot = Object.entries(hotCount).map(([id, c]) => ({ id, share: c / iterations }))
    .sort((a, b) => b.share - a.share).slice(0, 5)

  return {
    iterations, seed, profile: prof.label,
    varied: ['traffic (±' + Math.round(prof.trafficSd * 100) + '%)', 'per-tier latency (±' + Math.round(prof.latSd * 100) + '%)', 'occasional capacity dips'],
    latencyP99: P(p99s),   // distribution of the run-level p99
    latencyP50: P(p50s),
    availability: P(avails),
    successRate: P(successes),
    slo: (slo.p99 != null || slo.availability != null || slo.successRate != null)
      ? { ...slo, violationRate: sloViolations / iterations }
      : null,
    hotspots: topHot,
    // provenance line, so a screenshot can never be mistaken for measured reality
    provenance: `${iterations} runs · seed ${seed} · ${prof.label} variability · model estimate, not a measured benchmark`,
  }
}
