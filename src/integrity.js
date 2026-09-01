// ── Design integrity + the machine interface ────────────────────────────────
// Every design that enters the studio from outside — a share link, a Mermaid
// paste, a JSON document from an agent — passes through validateDesign first.
// It never crashes and never silently drops a design: it repairs what it can,
// coerces what it must, and REPORTS every repair so the person knows.
//
// The JSON shape is the AI-facing contract: small, flat, documented in the
// document itself, stable under a version field. Agents read it, write it,
// and the studio simulates what they wrote.
import { CATALOG } from './catalog.js'

export const DESIGN_SCHEMA = 'archsim-design/v1'

const sid = (s, i) => {
  const v = String(s ?? '').trim()
  return v ? v.slice(0, 40) : `n${i + 1}`
}

export function validateDesign(input) {
  const issues = []
  const src = input || {}
  const rawNodes = Array.isArray(src.nodes) ? src.nodes : []
  const rawEdges = Array.isArray(src.edges) ? src.edges : []

  // nodes: unique ids, known types, finite positions, sane replicas
  const seen = new Set()
  const nodes = []
  rawNodes.forEach((n, i) => {
    if (!n || typeof n !== 'object') { issues.push(`node #${i + 1} was not an object — dropped`); return }
    let id = sid(n.id, i)
    if (seen.has(id)) { const base = id; let k = 2; while (seen.has(`${base}_${k}`)) k++; id = `${base}_${k}`; issues.push(`duplicate node id "${base}" renamed to "${id}"`) }
    seen.add(id)
    let type = typeof n.type === 'string' ? n.type : ''
    if (!CATALOG[type]) { issues.push(`node "${id}" had unknown type "${type || '∅'}" — shown as a service`); type = 'app' }
    const spec = CATALOG[type]
    const out = { ...n, id, type, label: String(n.label ?? spec.name ?? id).slice(0, 60) }
    out.x = Number.isFinite(Number(n.x)) ? Number(n.x) : 60 + (i % 6) * 150
    out.y = Number.isFinite(Number(n.y)) ? Number(n.y) : 60 + Math.floor(i / 6) * 100
    if (spec.cap && type !== 'client') {
      const r = Math.round(Number(n.replicas))
      out.replicas = Number.isFinite(r) && r >= 1 ? Math.min(r, 10000) : 1
      if (out.replicas !== n.replicas && n.replicas !== undefined) issues.push(`node "${id}" replicas "${n.replicas}" coerced to ${out.replicas}`)
    } else if ('replicas' in out) {
      // sources and sinks may carry a replica count (templates store 1) — keep valid values, drop only nonsense
      const r = Math.round(Number(n.replicas))
      if (Number.isFinite(r) && r >= 1) out.replicas = r
      else { delete out.replicas; issues.push(`node "${id}" replicas "${n.replicas}" removed — not a number`) }
    }
    nodes.push(out)
  })

  // edges: both ends must exist, no self-loops, no duplicates
  const ids = new Set(nodes.map(n => n.id))
  const edgeSeen = new Set()
  const edges = []
  rawEdges.forEach((e, i) => {
    const from = Array.isArray(e) ? e[0] : e?.from
    const to = Array.isArray(e) ? e[1] : e?.to
    if (!ids.has(from) || !ids.has(to)) { issues.push(`edge #${i + 1} (${from ?? '?'} → ${to ?? '?'}) pointed at a missing node — dropped`); return }
    if (from === to) { issues.push(`edge #${i + 1} looped ${from} onto itself — dropped`); return }
    const key = `${from}->${to}`
    if (edgeSeen.has(key)) { issues.push(`duplicate edge ${key} collapsed`); return }
    edgeSeen.add(key)
    edges.push({ id: key, from, to, label: typeof e?.label === 'string' ? e.label.slice(0, 40) : '' })
  })

  const rps = Number(src.rps)
  const cleanRps = Number.isFinite(rps) && rps >= 1 ? Math.min(Math.round(rps), 5_000_000) : 100
  if (src.rps !== undefined && cleanRps !== src.rps) issues.push(`traffic "${src.rps}" coerced to ${cleanRps} rps`)

  return { ok: nodes.length >= 1, nodes, edges, rps: cleanRps, issues }
}

// ── the JSON document agents speak ──────────────────────────────────────────
export function toDesignJSON(nodes, edges, rps) {
  const doc = {
    $schema: DESIGN_SCHEMA,
    _readme: 'An ArchSim design. Paste this back into the Code tab (Import) to simulate it. Node types are the studio catalog keys (lb, gateway, app, micro, sql, nosql, cache, kafka, queue, worker, cdn, blob, search, vector, llm, guard, ledger, …); replicas scale capacity linearly; edges carry request flow from → to.',
    rps,
    nodes: nodes.map(n => {
      const o = { id: n.id, type: n.type, label: n.label }
      if (n.replicas) o.replicas = n.replicas
      o.x = Math.round(n.x); o.y = Math.round(n.y)
      // inspector state travels too — replication, write policy, idempotency…
      for (const k of ['replication', 'isolation', 'partition', 'writePolicy', 'lbAlgo', 'idem', 'ledgerCommit', 'quorum']) if (n[k] !== undefined) o[k] = n[k]
      return o
    }),
    edges: edges.map(e => ({ from: e.from ?? e[0], to: e.to ?? e[1] })),
  }
  return JSON.stringify(doc, null, 2)
}

export function fromDesignJSON(text) {
  let doc
  try { doc = JSON.parse(text) } catch { return null }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.nodes)) return null
  if (doc.$schema && !String(doc.$schema).startsWith('archsim-design/')) return null
  return validateDesign(doc)
}

// Sniff which machine format a pasted text is.
export function detectFormat(text) {
  const t = (text || '').trim()
  if (!t) return null
  if (t.startsWith('{')) return 'json'
  if (/\b(flowchart|graph)\b/i.test(t)) return 'mermaid'
  return null
}
