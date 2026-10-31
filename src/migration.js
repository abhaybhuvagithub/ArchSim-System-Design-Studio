// ── Middleware upgrade lab ───────────────────────────────────────────────────
// "Upgrade a shared library used by 100 services" as a model you can run:
//   1. a fleet of consumers, each declaring which v1 features it uses
//   2. a v2 change list (removed / renamed / behaviour / added)
//   3. a contract check: which consumers break, per change
//   4. migration recommendations derived from that check
//   5. a progressive canary rollout with an SLO guard and automatic rollback
//
// Honesty: the fleet and the rollout metrics are a SEEDED MODEL, not measured
// production data. What is real is the logic - the compatibility check is exact
// over the declared usage, and the rollout/guard rules are the ones a real
// pipeline applies. Same seed, same result. Replace the fleet with your own
// service inventory to get your own answer.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// What v1 of the shared middleware exposes, and how widely it is used.
export const V1_FEATURES = [
  { id: 'client.send', label: 'Client.send()', adoption: 1.0 },
  { id: 'auth.verifyToken', label: 'Auth.verifyToken(token)', adoption: 0.9 },
  { id: 'metrics.record', label: 'Metrics.record()', adoption: 0.85 },
  { id: 'config.load', label: 'Config.load(path)', adoption: 0.8 },
  { id: 'tenant.context', label: 'TenantContext.current()', adoption: 0.7 },
  { id: 'retry.policy', label: 'Retry default policy', adoption: 0.6 },
  { id: 'legacy.xmlCodec', label: 'XmlCodec (legacy)', adoption: 0.25 },
]

// Candidate v2 changes. `breaking` is a property of the change, not an opinion.
export const V2_CHANGES = [
  { id: 'rm-xml', kind: 'removed', feature: 'legacy.xmlCodec', breaking: true,
    title: 'Remove XmlCodec', fix: 'Keep a deprecated shim for one release, publish a JSON migration guide, then remove.' },
  { id: 'rn-config', kind: 'renamed', feature: 'config.load', breaking: true,
    title: 'Rename Config.load() to Config.read()', fix: 'Ship an automated codemod and keep the old name as a deprecated alias for one major version.' },
  { id: 'req-aud', kind: 'signature', feature: 'auth.verifyToken', breaking: true,
    title: 'verifyToken now requires an audience argument', fix: 'Make the argument optional with a safe default first; require it only in the next major version.' },
  { id: 'beh-retry', kind: 'behaviour', feature: 'retry.policy', breaking: true,
    title: 'Default retries lowered from 3 to 0', fix: 'Silent behaviour changes break without a compile error - keep the old default behind a flag and announce it loudly.' },
  { id: 'add-tenant', kind: 'added', feature: 'tenant.context', breaking: false,
    title: 'Add TenantContext.withTenant() (optional)', fix: 'Additive and safe - no action needed for existing consumers.' },
]

const RUNTIMES = ['Java', 'Go', 'Node.js']

export function buildFleet(size = 100, seed = 7) {
  const r = rng(seed)
  return Array.from({ length: size }, (_, i) => ({
    id: `svc-${String(i + 1).padStart(3, '0')}`,
    runtime: RUNTIMES[Math.floor(r() * RUNTIMES.length)],
    uses: V1_FEATURES.filter(f => f.adoption >= 1 || r() < f.adoption).map(f => f.id),
    // traffic weight, heavy-tailed: a few services carry most requests
    weight: Math.round(1 + Math.pow(r(), 3) * 40),
  }))
}

// Exact contract check over declared usage.
export function checkCompatibility(fleet, changeIds) {
  const picked = V2_CHANGES.filter(c => changeIds.includes(c.id))
  const perChange = picked.map(c => ({
    ...c, affected: fleet.filter(s => s.uses.includes(c.feature)).map(s => s.id),
  }))
  const brokenBy = new Map()
  for (const c of perChange) if (c.breaking) for (const id of c.affected) {
    if (!brokenBy.has(id)) brokenBy.set(id, [])
    brokenBy.get(id).push(c.id)
  }
  const broken = [...brokenBy.keys()]
  const recommendations = perChange
    .filter(c => c.breaking && c.affected.length)
    .sort((a, b) => b.affected.length - a.affected.length)
    .map(c => ({ change: c.id, title: c.title, consumers: c.affected.length, action: c.fix }))
  return {
    total: fleet.length, broken: broken.length, safe: fleet.length - broken.length,
    brokenBy, perChange, recommendations,
    verdict: !picked.some(c => c.breaking) ? 'additive' : broken.length ? 'breaking' : 'no-consumer-impact',
  }
}

export const STAGES = [1, 5, 25, 50, 100]

// Progressive rollout. Each stage moves a larger cohort to v2, measures the
// canary cohort against the v1 baseline, and rolls back if an SLO is breached.
export function simulateRollout(fleet, {
  changeIds = [], consumersMigrated = false, regression = { latencyMul: 1, errorAdd: 0 },
  slo = { maxErrorRate: 0.01, maxP99Ms: 250 }, seed = 11,
} = {}) {
  const r = rng(seed)
  const compat = checkCompatibility(fleet, changeIds)
  // random cohort order (a real rollout picks pilots deliberately; random is the unbiased model)
  const order = fleet.map(s => ({ s, k: r() })).sort((a, b) => a.k - b.k).map(x => x.s)
  const stages = []
  let outcome = 'completed', rolledBackAt = null
  for (const pct of STAGES) {
    const n = Math.max(1, Math.round(fleet.length * pct / 100))
    const cohort = order.slice(0, n)
    let reqs = 0, errs = 0, p99w = 0
    for (const s of cohort) {
      const breaks = consumersMigrated ? 0 : (compat.brokenBy.get(s.id) || []).length
      const err = Math.min(0.9, 0.001 + breaks * 0.04 + regression.errorAdd + (r() - 0.5) * 0.0004)
      const p99 = 120 * regression.latencyMul * (1 + (r() - 0.5) * 0.1) + breaks * 15
      reqs += s.weight; errs += s.weight * err; p99w += s.weight * p99
    }
    const errorRate = errs / reqs, p99 = p99w / reqs
    const breach = errorRate > slo.maxErrorRate ? `error rate ${(errorRate * 100).toFixed(2)}% > ${(slo.maxErrorRate * 100).toFixed(1)}%`
      : p99 > slo.maxP99Ms ? `p99 ${Math.round(p99)}ms > ${slo.maxP99Ms}ms` : null
    stages.push({ pct, services: n, errorRate, p99, breach })
    if (breach) { outcome = 'rolled-back'; rolledBackAt = pct; break }
  }
  return { compat, stages, outcome, rolledBackAt, slo, consumersMigrated }
}
