// One structured description of the current design, rendered three ways
// (PDF, .docx, .doc). Everything the studio knows goes in here once, so the
// three exporters can never drift apart.
import { CATALOG } from './catalog.js'
import { CLOUD_MAP, CLOUDS } from './clouds.js'
import { money, setCurrency } from './pricing.js'
import { faultById } from './faults.js'
import { describeArchitecture } from './describe.js'
import { ABOUT } from './about.js'

const CLOUD_COLS = CLOUDS.filter(c => c.id !== 'generic')

const fmt = n => {
  if (!isFinite(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
  if (n >= 10) return n.toFixed(0)
  return n.toFixed(n >= 1 ? 1 : 2)
}
const pct = v => (v * 100).toFixed(v >= 0.1 ? 1 : 2) + '%'
const ms = v => (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ms'

// Turn a downtime fraction into something a human can act on.
const downtime = avail => {
  const mins = (1 - avail) * 43800
  if (mins >= 1440) return (mins / 1440).toFixed(1) + ' days/mo'
  if (mins >= 60) return (mins / 60).toFixed(1) + ' hours/mo'
  if (mins >= 1) return mins.toFixed(0) + ' min/mo'
  return (mins * 60).toFixed(0) + ' sec/mo'
}

// Strip the **bold** markers the on-screen brief uses.
export const plain = s => String(s).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')

const sec = (title, body) => ({ title, ...body })

export function buildReport(ctx) {
  const {
    nodes = [], edges = [], sim, baseSim, cap, cost, sugs = [], faults = [],
    rps = 0, template = null, cloud = 'generic', currency = 'USD', checks = {}, fx = null,
  } = ctx

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const cloudIdx = CLOUDS.findIndex(c => c.id === cloud) - 1   // -1 => generic
  const cloudName = CLOUDS.find(c => c.id === cloud)?.name || 'Generic'
  const svcFor = type => (cloudIdx >= 0 ? CLOUD_MAP[type]?.[cloudIdx] : null) || CATALOG[type]?.name || type
  const M = v => money(v, currency)
  // the brief formats money through the module-level active currency, so make
  // sure it matches what this report was asked for
  setCurrency(currency)
  const now = new Date()

  const sections = []

  // ---- 1. what this design is -------------------------------------------
  sections.push(sec('Design at a glance', {
    table: {
      cols: ['Property', 'Value'],
      rows: [
        ['Design', template ? template.name : 'Untitled design'],
        ['Summary', template ? template.tagline : `${nodes.length} components wired into ${edges.length} connections`],
        ['Modelled traffic', `${fmt(rps)} requests/second (${fmt(rps * 86400)} per day)`],
        ['Target platform', cloud === 'generic' ? 'Generic / vendor-neutral' : cloudName],
        ['Components', String(nodes.length)],
        ['Connections', String(edges.length)],
        ['Total instances', String(nodes.filter(n => !CATALOG[n.type]?.source).reduce((s, n) => s + (n.replicas || 1), 0))],
        ['Open advisor findings', String(sugs.length)],
        ['Chaos faults active', String(faults.length)],
        ['Generated', now.toLocaleString()],
      ],
    },
  }))

  // ---- 2. the numbers ----------------------------------------------------
  if (sim) {
    const dropped = sim.totalDropped || 0
    sections.push(sec('Simulated behaviour', {
      table: {
        cols: ['Metric', 'Value', 'What it means'],
        rows: [
          ['Median latency (p50)', ms(sim.p50), 'What a typical request feels'],
          ['95th percentile (p95)', ms(sim.p95), '1 request in 20 is slower than this'],
          ['99th percentile (p99)', ms(sim.p99), 'The tail your angriest users live in'],
          ['Success rate', pct(sim.successRate), dropped > 0 ? `${fmt(dropped)} rps is being shed` : 'Nothing is being dropped'],
          ['Modelled availability', pct(sim.sysAvail), `About ${downtime(sim.sysAvail)} of downtime`],
          ['Dropped traffic', dropped > 0 ? `${fmt(dropped)} rps` : 'none', dropped > 0 ? 'A tier is over capacity' : 'Every tier has headroom'],
          ...(cost?.total > 0 ? [
            ['Monthly cost', M(cost.total), `${M(cost.hourly)} per hour at this traffic`],
            ['Cost per million requests', M(cost.perMillion), `${fmt(cost.reqMillions)}M requests served per month`],
          ] : []),
        ],
      },
    }))
  }

  // ---- 3. the written brief ---------------------------------------------
  const brief = describeArchitecture({ nodes, edges, sim, baseSim, cap, cost, sugs, faults, fx, rps, template, cloud, simOn: true })
  for (const s of brief.sections) {
    sections.push(sec(s.title, { paras: s.lines.map(plain) }))
  }

  // ---- 4. every component ------------------------------------------------
  if (nodes.length) {
    sections.push(sec('Component inventory', {
      intro: cloud === 'generic'
        ? 'Every box on the canvas, with the per-instance figures the simulation uses.'
        : `Every box on the canvas, mapped to its ${cloudName} equivalent.`,
      table: {
        cols: ['Component', 'Kind', cloud === 'generic' ? 'Category' : `${cloudName} service`, 'Replicas', 'Traffic in', 'Utilisation', 'Capacity', 'Latency', 'Availability'],
        rows: nodes.map(n => {
          const spec = CATALOG[n.type] || {}
          const st = sim?.stats?.[n.id]
          return [
            n.label,
            spec.name || n.type,
            svcFor(n.type),
            String(n.replicas || 1),
            spec.source ? 'source' : `${fmt(st?.in || 0)} rps`,
            spec.source ? '—' : pct(st?.util || 0),
            spec.source || !isFinite(spec.cap) || !spec.cap ? '—' : `${fmt(spec.cap)} rps`,
            spec.lat != null ? ms(spec.lat) : '—',
            spec.avail != null ? pct(spec.avail) : '—',
          ]
        }),
      },
    }))
  }

  // ---- 5. how it is wired ------------------------------------------------
  if (edges.length) {
    sections.push(sec('Connections', {
      intro: 'The request path, in the order traffic flows through it.',
      table: {
        cols: ['#', 'From', 'To', 'Flow', 'Note'],
        rows: edges.map((e, i) => [
          String(i + 1),
          byId[e.from]?.label || e.from,
          byId[e.to]?.label || e.to,
          `${fmt(sim?.flowOnEdge?.[e.id] || 0)} rps`,
          e.label || '—',
        ]),
      },
    }))
  }

  // ---- 6. capacity -------------------------------------------------------
  if (cap?.rows?.length) {
    sections.push(sec('Capacity report', {
      intro: cap.bottlenecks.length
        ? `${cap.bottlenecks.length} tier${cap.bottlenecks.length > 1 ? 's are' : ' is'} past 80% utilisation: ${cap.bottlenecks.map(b => b.label).join(', ')}.`
        : 'No tier is past 80% utilisation at this traffic level.',
      table: {
        cols: ['Tier', 'Kind', 'Traffic in', 'Replicas', 'Utilisation', 'Replicas needed', 'Status'],
        rows: cap.rows.map(r => [
          r.label, r.type, `${fmt(r.in)} rps`, String(r.replicas), pct(r.util), String(Math.max(1, r.needed)),
          r.down ? 'DOWN' : r.util >= 1 ? 'Overloaded' : r.util > 0.8 ? 'Bottleneck' : r.util > 0.6 ? 'Busy' : 'Healthy',
        ]),
      },
    }))
  }

  // ---- 7. cost -----------------------------------------------------------
  if (cost?.rows?.length && cost.total > 0) {
    const live = cost.rows.filter(r => r.total > 0)
    sections.push(sec('Cost breakdown', {
      intro: `${M(cost.total)} per month at ${fmt(rps)} rps${cloud === 'generic' ? '' : ` on ${cloudName}`} — ${M(cost.fixed)} fixed and ${M(cost.usage)} driven by requests. On-demand list prices, no committed-use discounts.`,
      table: {
        cols: ['Line item', 'Kind', 'Replicas', 'Traffic', 'Fixed', 'Usage', 'Monthly', 'Share'],
        rows: live.map(r => [
          r.label, r.typeName, String(r.replicas), `${fmt(r.inRps)} rps`,
          M(r.fixed), M(r.usage), M(r.total), pct(r.total / cost.total),
        ]),
      },
      after: cost.byGroup?.length ? {
        cols: ['Area', 'Monthly', 'Share of bill'],
        rows: cost.byGroup.map(([g, v]) => [g, M(v), pct(v / cost.total)]),
      } : null,
    }))
  }

  // ---- 8. what the advisor thinks ----------------------------------------
  const rank = { high: 0, med: 1, low: 2 }
  const ordered = [...sugs].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))
  sections.push(sec('Architecture review', {
    intro: ordered.length
      ? `${ordered.length} outstanding finding${ordered.length > 1 ? 's' : ''}. Each one has a one-click fix inside ArchSim that edits the diagram for you.`
      : 'The advisor has no outstanding findings against this design.',
    table: ordered.length ? {
      cols: ['Priority', 'Finding', 'Why it matters'],
      rows: ordered.map(s => [
        s.severity === 'high' ? 'High' : s.severity === 'med' ? 'Medium' : 'Low',
        plain(s.title), plain(s.detail),
      ]),
    } : null,
  }))

  // ---- 9. chaos ----------------------------------------------------------
  if (faults.length) {
    const rows = faults.map(a => {
      const f = faultById(a.faultId)
      return f ? [f.name, f.group, a.targetId ? (byId[a.targetId]?.label || a.targetId) : 'System-wide', plain(f.desc), plain(f.hint)] : null
    }).filter(Boolean)
    const delta = baseSim && sim ? [
      ['Success rate', pct(baseSim.successRate), pct(sim.successRate)],
      ['p99 latency', ms(baseSim.p99), ms(sim.p99)],
      ['Availability', pct(baseSim.sysAvail), pct(sim.sysAvail)],
      ['Monthly cost', cost ? M(cost.total) : '—', cost ? M(cost.total) : '—'],
    ] : null
    sections.push(sec('Chaos in flight', {
      intro: `${faults.length} fault${faults.length > 1 ? 's are' : ' is'} active. The figures elsewhere in this document are the degraded numbers.`,
      table: { cols: ['Fault', 'Class', 'Target', 'What it does', 'How to mitigate'], rows },
      after: delta ? { cols: ['Metric', 'Healthy', 'Under chaos'], rows: delta } : null,
    }))
  }

  // ---- 10. requirements --------------------------------------------------
  if (template?.checklist?.length) {
    sections.push(sec('Requirements', {
      intro: 'The requirements this design was built against. Ticked items have been applied to the diagram.',
      table: {
        cols: ['Requirement', 'Applied'],
        rows: template.checklist.map((c, i) => [c, checks[i] ? 'Yes' : 'Not yet']),
      },
    }))
  }

  // ---- 11. multi-cloud ---------------------------------------------------
  const types = [...new Set(nodes.map(n => n.type))]
  if (types.length) {
    sections.push(sec('Managed service equivalents', {
      intro: 'The same design, named in each provider\'s vocabulary.',
      table: {
        cols: ['Component kind', ...CLOUD_COLS.map(c => c.name)],
        rows: types.map(t => [CATALOG[t]?.name || t, ...CLOUD_COLS.map((_, i) => CLOUD_MAP[t]?.[i] || '—')]),
      },
    }))
  }

  // ---- 12. how to read all this -----------------------------------------
  const how = ABOUT.find(s => s.title === 'How the model works')
  const not = ABOUT.find(s => s.title === 'What it is not')
  sections.push(sec('How these numbers were produced', {
    paras: [...(how?.lines || []).map(plain), ...(not?.lines || []).map(plain)],
  }))

  return {
    title: template ? template.name : 'Architecture design',
    subtitle: `Simulated at ${fmt(rps)} rps${cloud === 'generic' ? '' : ` on ${cloudName}`} · ${now.toLocaleDateString()} · costs in ${currency}`,
    footer: 'Generated by ArchSim — System Design Studio. Curated and built by Abhaykumar Bhuva. Built with Anthropic Claude.',
    sections,
  }
}
