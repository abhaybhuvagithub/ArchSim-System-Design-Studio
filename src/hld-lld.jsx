import { CATALOG } from './catalog.js'
import { requestAnatomy } from './anatomy.js'
import LLD_DATA from './lld.js'
import { BREAKDOWNS } from './breakdown.js'

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const pct = u => Math.round((u || 0) * 100) + '%'

// ── HLD: the quantitative altitude, computed live from THIS design ──────────
export function HLD({ template, nodes, edges, sim }) {
  if (!template) return <section><h3>High-Level Design</h3><p className="muted">Load a design first.</p></section>
  const anatomy = requestAnatomy(nodes, edges, sim)
  const tiers = nodes
    .filter(n => !CATALOG[n.type]?.source)
    .map(n => ({ n, s: sim.stats[n.id] || {} }))
    .sort((a, b) => (b.s.in || 0) - (a.s.in || 0))
  const spofs = tiers.filter(({ n }) => (n.replicas || 1) < 2 && CATALOG[n.type]?.cap)
  const has = t => nodes.some(n => n.type === t)
  const fanIn = {}
  edges.forEach(e => { const to = e.to ?? e[1]; fanIn[to] = (fanIn[to] || 0) + 1 })
  const converge = Object.entries(fanIn).filter(([, c]) => c >= 2).map(([id]) => nodes.find(n => n.id === id)).filter(Boolean)

  return (
    <section>
      <h3>High-Level Design (HLD)</h3>

      <div className="hld-section">
        <h4>📋 Problem Statement</h4>
        <p>{template.tagline}</p>
      </div>

      <div className="hld-section">
        <h4>✅ Functional Requirements — what this design actually promises</h4>
        <ul style={{ marginLeft: 16 }}>
          {template.checklist.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      <div className="hld-section">
        <h4>⚡ Non-Functional Requirements — measured on the live simulation</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Latency:</b> p50 {Math.round(sim.p50)}ms · p95 {Math.round(sim.p95)}ms · p99 {Math.round(sim.p99)}ms at {fmt(template.rps)} rps</li>
          <li><b>Availability:</b> {(sim.sysAvail * 100).toFixed(3)}% composed across every tier on the serving path</li>
          <li><b>Success under load:</b> {(sim.successRate * 100).toFixed(1)}% of requests complete right now{sim.totalDropped > 0 ? ` — ${fmt(sim.totalDropped)}/s shed` : ''}</li>
          <li><b>Consistency:</b> per-store — open any datastore's inspector; replication and quorum are set there, not in prose</li>
        </ul>
      </div>

      {anatomy && anatomy.hops.length > 0 && (
        <div className="hld-section anatomy">
          <h4>🧭 Request Anatomy — the road most requests take, timed live</h4>
          <p className="muted">Traffic-weighted primary path from <b>{anatomy.start}</b>. Latencies are modeled at each tier's <i>current</i> utilization — drag the traffic slider and watch the budget move.</p>
          <table className="anatomy-t">
            <thead><tr><th>#</th><th>hop</th><th>p50</th><th>p99</th><th>busy</th><th>roads not taken</th></tr></thead>
            <tbody>
              {anatomy.hops.map((h, i) => (
                <tr key={h.id} className="anatomy-hop">
                  <td>{i + 1}</td>
                  <td>{CATALOG[h.type]?.glyph} {h.label}{h.note && <div className="muted" style={{ fontSize: 12 }}>{h.note}</div>}</td>
                  <td>{h.p50}ms</td><td>{h.p99}ms</td><td>{h.util}%</td>
                  <td className="muted">{h.alt.length ? h.alt.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><b>User-felt budget:</b> p50 ≈ {anatomy.totalP50}ms · p99 ≈ {anatomy.totalP99.toFixed(1)}ms{anatomy.dominant ? <> — dominated by <b>{anatomy.dominant.label}</b> ({anatomy.dominant.p50}ms)</> : null}.</p>
          {anatomy.asyncTail.length > 0 && (
            <p className="muted">⤳ Behind the async boundary (user is gone, work continues): {anatomy.asyncTail.map(h => h.label).join(' → ')}</p>
          )}
        </div>
      )}

      <div className="hld-section">
        <h4>🧮 Capacity Worksheet — the busiest tiers, right now</h4>
        <table className="anatomy-t">
          <thead><tr><th>tier</th><th>replicas</th><th>cap/replica</th><th>in/s</th><th>busy</th><th>headroom</th></tr></thead>
          <tbody>
            {tiers.slice(0, 6).map(({ n, s }) => {
              const cap = CATALOG[n.type]?.cap || 0
              const total = cap * (n.replicas || 1)
              const head = s.in > 0 ? (total / s.in) : Infinity
              return (
                <tr key={n.id} className="cap-row">
                  <td>{CATALOG[n.type]?.glyph} {n.label}</td>
                  <td>{n.replicas || 1}</td><td>{fmt(cap)}/s</td><td>{fmt(s.in || 0)}</td>
                  <td>{pct(s.util)}</td>
                  <td>{head === Infinity ? '∞' : head >= 10 ? '≥10×' : head.toFixed(1) + '×'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="muted">Headroom is total capacity over current demand — the interview number: "we run at {pct((tiers[0]?.s.util) || 0)} on the hottest tier with {(() => { const t = tiers[0]; if (!t) return '—'; const h = (CATALOG[t.n.type]?.cap || 0) * (t.n.replicas || 1) / Math.max(1, t.s.in || 1); return h >= 10 ? '≥10×' : h.toFixed(1) + '×' })()} to the ceiling."</p>
      </div>

      <div className="hld-section">
        <h4>🛡️ Failure Modes — read from this graph, not from a checklist</h4>
        <ul style={{ marginLeft: 16 }}>
          {spofs.length > 0
            ? <li><b>Single points of failure:</b> {spofs.map(({ n }) => n.label).join(', ')} run at 1 replica — each is a full outage waiting for a reboot. (✨ Improve prices the fix.)</li>
            : <li><b>Single points of failure:</b> none — every capacity-bearing tier runs ≥2 replicas.</li>}
          {converge.length > 0 && <li><b>Convergence points:</b> {converge.slice(0, 3).map(n => n.label).join(', ')} take fan-in from multiple upstreams — timeouts and breakers belong on the callers of these, because a slowdown here holds everyone's threads (ρ = λ·E[hold]/c).</li>}
          {has('cache') && <li><b>Cache stampede:</b> a cold or flushed cache forwards its full read load downstream at once — singleflight per key and jittered TTLs are the standard armor.</li>}
          {(has('kafka') || has('queue')) && <li><b>Backlog debt:</b> the async tier absorbs spikes by borrowing time — consumer lag is the loan statement; alert on lag age, not queue depth.</li>}
          {has('ledger') && <li><b>Money correctness:</b> the ledger's idempotency and commit-mode controls are live in its inspector — a 🔁 Retry Storm in Chaos demonstrates exactly what each setting is worth.</li>}
        </ul>
      </div>

      <div className="hld-section">
        <h4>📈 Scaling</h4>
        <p className="muted">The authored ladder for this exact design — 1× to 1000×, with the wall it eventually hits — lives in the 📈 Scale tab. This page stays at today's numbers on purpose.</p>
      </div>
    </section>
  )
}

// ── per-type engineering notes: honest because they're conditional ──────────
const TYPE_LLD = {
  cache: (n, s) => `LRU + per-key TTL with jitter; stampede armor = singleflight per key. This design's ${n.label} runs ${pct(s?.util)} busy — eviction pressure starts mattering past ~80%.`,
  kafka: (n) => `Consumer groups own offsets; rebalance is the outage nobody monitors. Partitions on ${n.label} set max parallelism — keys must spread or one partition becomes the system.`,
  queue: (n) => `${n.label}: at-least-once + idempotent consumers = effectively-once; DLQ after N attempts with replay as an admin verb, never a hope.`,
  ws: (n) => `${n.label}: heartbeat + jittered reconnect; sticky routing by connection, not by user — a reconnect storm after a deploy is the load test you didn't schedule.`,
  ledger: (n) => `${n.label}: append-only double-entry, idempotency key checked before insert — retried money lands on its existing entries. The inspector's controls are live; the math is in the verdicts.`,
  sql: (n, s) => `${n.label}: reads ride replicas (lag is a feature you budget), writes serialize on the primary; the index that saves the read costs every write — at ${pct(s?.util)} busy that trade is ${(s?.util || 0) > 0.6 ? 'already being paid' : 'still cheap'}.`,
  lb: (n) => `${n.label}: least-connections for stateless pools, consistent-hash when state sticks; health-eject fast, readmit slow.`,
  gateway: (n) => `${n.label}: authn, rate limit (token bucket per key), request-id minting — the trace is born here or nowhere.`,
  ml: (n) => `${n.label}: batch requests to feed the accelerator, version every model artifact, and keep a shadow path — the rollback story IS the deploy story.`,
  vector: (n) => `${n.label}: ANN (HNSW-class) trades a point of recall for 100× speed; filters BEFORE search or your top-k is garbage post-filter.`,
  hsm: (n) => `${n.label}: keys never leave; operations queue at the door — capacity is a compliance number, not a scaling knob.`,
  worker: (n) => `${n.label}: idempotent by job-id, checkpoint long work, crash-restart must resume not restart — the queue remembers so the worker doesn't have to.`,
  cdn: (n) => `${n.label}: cache-key discipline (path + the FEW headers that matter); purge is eventual everywhere — version URLs instead of trusting purges.`,
  search: (n) => `${n.label}: index refresh interval is the honesty knob between write cost and read freshness; relevance tuning is a product decision wearing a query DSL.`,
}

// ── LLD: authored where it matters, honest everywhere else ──────────────────
export function LLD({ template, nodes, edges, sim }) {
  if (!template) return <section><h3>Low-Level Design</h3><p className="muted">Load a design first.</p></section>
  const authored = LLD_DATA[template.name]
  const bd = BREAKDOWNS[template.name]
  const typed = [...new Set(nodes.map(n => n.type))]
    .filter(t => TYPE_LLD[t])
    .map(t => ({ t, n: nodes.find(n => n.type === t) }))

  return (
    <section>
      <h3>Low-Level Design (LLD)</h3>

      {authored ? (
        <div className="lld-section">
          <h4>🧱 The detail that is the point — authored for this design</h4>
          <p>{authored.intro}</p>
          {authored.schema && <SchemaTablesLite tables={authored.schema} />}
          {authored.flow && <FlowLite flow={authored.flow} sim={sim} nodes={nodes} />}
          {authored.state && <StateLite state={authored.state} />}
          {authored.notes?.length > 0 && (
            <ul style={{ marginLeft: 16, fontSize: 13 }}>
              {authored.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <div className="lld-section">
          <h4>🧱 Data model — sketched from this design's core entities</h4>
          {bd?.entities?.length
            ? <ul style={{ marginLeft: 16 }}>{bd.entities.map(([name, note]) => <li key={name}><b>{name}</b> — {note}</li>)}</ul>
            : <p className="muted">No authored entity model yet — the six flagship designs (URL Shortener, WhatsApp, Ticketmaster, Uber, Amazon, Stripe-lite) carry full schema + sequence + state machines; this one teaches at the component level below.</p>}
        </div>
      )}

      {bd?.api?.length > 0 && (
        <div className="lld-section">
          <h4>⚙️ API Contract — authored, verbatim from the breakdown</h4>
          {bd.api.map((a, i) => (
            <p key={i} className="muted" style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{a.dir} {a.name}{'\n'}{a.body}</p>
          ))}
        </div>
      )}

      <div className="lld-section">
        <h4>🔧 Component Engineering — live numbers, per tier</h4>
        {nodes.filter(n => !CATALOG[n.type]?.source).slice(0, 8).map(n => {
          const spec = CATALOG[n.type]
          const s = sim.stats[n.id]
          return (
            <div key={n.id} className="lld-component">
              <div className="comp-name">{spec.glyph} <b>{n.label || spec.name}</b> · {n.replicas || 1}× · {pct(s?.util)} busy</div>
              <ul style={{ marginLeft: 20, fontSize: '13px' }}>
                <li><b>Flow:</b> {fmt(s?.in || 0)}/s in → {fmt(s?.processed || 0)}/s processed{(s?.dropped || 0) > 0.5 ? <b> · {fmt(s.dropped)}/s shed</b> : ''}</li>
                <li><b>Latency now:</b> {s?.latency?.toFixed(1)}ms at this utilization (base {spec.lat}ms — queueing is the difference)</li>
                <li><b>Ceiling:</b> {fmt(spec.cap * (n.replicas || 1))}/s total · shed past it, don't queue forever</li>
              </ul>
            </div>
          )
        })}
      </div>

      {typed.length > 0 && (
        <div className="lld-section">
          <h4>💻 Patterns in THIS design — one honest line per component class present</h4>
          <ul style={{ marginLeft: 16 }}>
            {typed.map(({ t, n }) => <li key={t}><b>{CATALOG[t].name}:</b> {TYPE_LLD[t](n, sim.stats[n.id])}</li>)}
          </ul>
        </div>
      )}

      <div className="lld-section">
        <h4>🔍 Observability contract</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Trace:</b> request-id born at the front door, propagated through every hop the 🧭 anatomy shows</li>
          <li><b>Golden signals per tier:</b> rate, errors, duration, saturation — the capacity worksheet is the saturation dashboard, live</li>
          <li><b>Alerts tied to this design:</b> p99 &gt; {Math.round(sim.p99 * 1.5)}ms · availability &lt; {(sim.sysAvail * 100).toFixed(2)}% · any tier past 85% busy</li>
        </ul>
      </div>

      <div className="lld-section">
        <h4>🧪 Testing that matches the physics</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Load:</b> ramp to {fmt(template.rps)} rps and past it — the shed point should match the worksheet, not surprise you</li>
          <li><b>Chaos:</b> every fault in the 🌪️ Chaos tab is a test case; the 🔁 Retry Storm belongs in CI for anything with money on the path</li>
          <li><b>Contract:</b> the API block above is the spec — consumer-driven tests pin it</li>
        </ul>
      </div>
    </section>
  )
}

// ── lite renderers (tab-local; the breakdown keeps its richer SVG versions) ──
function SchemaTablesLite({ tables }) {
  return tables.map(t => (
    <div key={t.name} style={{ margin: '10px 0' }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>🗄️ {t.name}</div>
      <table className="anatomy-t"><tbody>
        {t.columns.map(([c, ty, note]) => <tr key={c}><td style={{ fontFamily: 'monospace' }}>{c}</td><td className="muted">{ty}</td><td className="muted">{note}</td></tr>)}
        {t.idx?.length ? <tr><td style={{ fontFamily: 'monospace' }}>idx</td><td className="muted" colSpan={2}>{t.idx.join(' · ')}</td></tr> : null}
      </tbody></table>
    </div>
  ))
}

function FlowLite({ flow, sim, nodes }) {
  const latFor = label => {
    const n = nodes.find(x => x.label === label || x.id === label)
    return n ? sim.stats[n.id]?.latency : null
  }
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>🔄 {flow.title}</div>
      <ol style={{ marginLeft: 18, fontSize: 13 }}>
        {flow.steps.map((st, i) => {
          const ms = latFor(st.to)
          return <li key={i}>{st.from} → <b>{st.to}</b>: {st.label}{st.ret ? <span className="muted"> ⇢ {st.ret}</span> : null}{ms != null ? <span className="muted"> · ~{ms.toFixed(1)}ms live</span> : null}</li>
        })}
      </ol>
    </div>
  )
}

function StateLite({ state }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>🎰 {state.title}</div>
      <table className="anatomy-t">
        <thead><tr><th>from</th><th>to</th><th>on</th></tr></thead>
        <tbody>{state.transitions.map(([f, t, l], i) => <tr key={i}><td>{f}</td><td>{t}</td><td className="muted">{l}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
