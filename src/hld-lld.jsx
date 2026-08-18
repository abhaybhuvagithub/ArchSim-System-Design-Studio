import { CATALOG } from './catalog.js'

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()

export function HLD({ template, nodes, edges, sim }) {
  if (!template) return <section><h3>High-Level Design</h3><p className="muted">Load a design first.</p></section>
  const nodesByType = {}
  nodes.forEach(n => {
    const type = n.type
    if (!nodesByType[type]) nodesByType[type] = []
    nodesByType[type].push(n)
  })
  return (
    <section>
      <h3>High-Level Design (HLD)</h3>
      
      <div className="hld-section">
        <h4>📋 Problem Statement</h4>
        <p>{template.tagline}</p>
        <p className="muted">{template.checklist[0]}</p>
      </div>

      <div className="hld-section">
        <h4>✓ Functional Requirements</h4>
        <ul style={{ marginLeft: 16 }}>
          <li>Handle {template.rps >= 1000 ? (template.rps/1000).toFixed(1)+'k' : template.rps} requests per second at peak</li>
          <li>{nodes.length} core services: {Object.keys(nodesByType).map(t => CATALOG[t]?.name).filter(Boolean).slice(0,5).join(', ')}</li>
          <li>Request flow across {edges.length} integration points</li>
          <li>Support graceful degradation and circuit breaking</li>
        </ul>
      </div>

      <div className="hld-section">
        <h4>⚡ Non-Functional Requirements</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Latency:</b> p50 &lt; {Math.round(sim.p50)}ms, p99 &lt; {Math.round(sim.p99)}ms</li>
          <li><b>Availability:</b> {(sim.sysAvail * 100).toFixed(3)}% uptime with fault tolerance</li>
          <li><b>Throughput:</b> {fmt(template.rps)}/s sustained traffic</li>
          <li><b>Consistency:</b> Eventual for most data, strong for money/auth</li>
          <li><b>Cost:</b> Optimized cloud spend with right-sizing</li>
        </ul>
      </div>

      <div className="hld-section">
        <h4>🏗️ Architecture Layers</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Edge:</b> CDN, GSLB, rate limiting (entry points)</li>
          <li><b>API:</b> Gateways, load balancers, auth (orchestration)</li>
          <li><b>Application:</b> Microservices, workers, stateless processes (logic)</li>
          <li><b>Data:</b> Caches, databases, queues, blob stores (persistence)</li>
          <li><b>Observability:</b> Tracing, metrics, logs, alerts (visibility)</li>
        </ul>
      </div>

      <div className="hld-section">
        <h4>🔄 Data Flow (Happy Path)</h4>
        <p className="muted">Request → API Gateway → Service Logic → Data Store → Response → Client</p>
        <p>Caching layer intercepts reads. Async queues decouple heavy writes. Message brokers handle events.</p>
      </div>

      <div className="hld-section">
        <h4>🛡️ Failure Modes & Mitigations</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Service down:</b> Circuit breaker + retry with backoff + fallback</li>
          <li><b>Database slow:</b> Read replicas + cache + async reads</li>
          <li><b>Cascading failure:</b> Bulkheads (separate pools per tenant/tier) + timeouts</li>
          <li><b>Traffic spike:</b> Rate limiting + queue shedding + graceful degradation</li>
        </ul>
      </div>

      <div className="hld-section">
        <h4>📈 Scalability Strategy</h4>
        <p><b>Horizontal:</b> Replicate stateless services. Shard data by region/customer.</p>
        <p><b>Vertical:</b> Upgrade cache nodes, database instances. Add replicas as load grows.</p>
        <p><b>Smart:</b> CDN for static assets. Batch async work. Pre-compute expensive queries.</p>
      </div>
    </section>
  )
}

export function LLD({ template, nodes, edges, sim }) {
  if (!template) return <section><h3>Low-Level Design</h3><p className="muted">Load a design first.</p></section>
  return (
    <section>
      <h3>Low-Level Design (LLD)</h3>

      <div className="lld-section">
        <h4>🔧 Core Components & Responsibilities</h4>
        {nodes.slice(0,8).map(n => {
          const spec = CATALOG[n.type]
          const s = sim.stats[n.id]
          return (
            <div key={n.id} className="lld-component">
              <div className="comp-name">{spec.glyph} <b>{n.label || spec.name}</b> ({n.type})</div>
              <ul style={{ marginLeft: 20, fontSize: '13px' }}>
                <li><b>Throughput:</b> {fmt(s?.in || 0)}/s incoming, {fmt(s?.processed || 0)}/s processed</li>
                <li><b>Latency:</b> {s?.latency.toFixed(1)}ms queuing + {spec.lat}ms processing = {(s?.latency + spec.lat).toFixed(1)}ms total</li>
                <li><b>Replicas:</b> {n.replicas || 1} instances (util {(s?.util * 100).toFixed(0)}%)</li>
                <li><b>Circuit break at:</b> {(spec.cap * 1.15).toFixed(0)}/s (115% capacity)</li>
              </ul>
            </div>
          )
        })}
        {nodes.length > 8 && <p className="muted">...and {nodes.length - 8} more components</p>}
      </div>

      <div className="lld-section">
        <h4>🗄️ Data Model & Storage</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Hot data:</b> In-memory cache (Redis, Memcached) — sub-ms reads</li>
          <li><b>Warm data:</b> SQL database (write-optimized for transactions) — milliseconds</li>
          <li><b>Cold data:</b> Blob storage + archive (read-optimized, cost-effective) — seconds</li>
          <li><b>Sharding:</b> By user_id, region, or timestamp to spread load</li>
          <li><b>Replication:</b> Write to primary, read from replicas (lag: {sim.p50}ms p50)</li>
        </ul>
      </div>

      <div className="lld-section">
        <h4>💻 Algorithms & Patterns</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Load balancing:</b> Least connections (stateless) or consistent hash (stateful)</li>
          <li><b>Caching:</b> LRU eviction, TTL-based invalidation, write-through for consistency</li>
          <li><b>Rate limiting:</b> Token bucket per tenant + sliding window counter</li>
          <li><b>Queueing:</b> FIFO + priority queue for critical requests</li>
          <li><b>Retries:</b> Exponential backoff with jitter: 100ms, 400ms, 1.6s, 6.4s...</li>
        </ul>
      </div>

      <div className="lld-section">
        <h4>🚨 Error Handling & Edge Cases</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Idempotency:</b> Use request IDs; replay safe for retries</li>
          <li><b>Timeouts:</b> Gateway 30s, service-to-service 5s, database 2s</li>
          <li><b>Duplicate requests:</b> Deduplicate by ID within 24h window</li>
          <li><b>Cascading failures:</b> Stop propagating if downstream 50% failing</li>
          <li><b>Stale data:</b> Serve stale-while-revalidate for read-heavy paths</li>
        </ul>
      </div>

      <div className="lld-section">
        <h4>⚙️ API Contracts (REST + gRPC)</h4>
        <p className="muted" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
          POST /api/request {'{'}  user_id, action, idempotency_key {'}'} → 202 Accepted (queued)<br/>
          GET /api/request/:id → 200 with result once processed<br/>
          gRPC for internal service-to-service (protobuf, binary, 10x faster)
        </p>
      </div>

      <div className="lld-section">
        <h4>🔍 Observability: Traces, Metrics, Logs</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Distributed tracing:</b> Every request gets a trace ID flowing through all services</li>
          <li><b>Metrics:</b> Per-node: throughput, latency, errors, utilization (Prometheus)</li>
          <li><b>Logs:</b> Structured JSON with trace ID for correlation (ELK or CloudWatch)</li>
          <li><b>Alerts:</b> Error rate &gt;1%, latency p99&gt;{Math.round(sim.p99)*1.5}ms, availability &lt;{(sim.sysAvail*100).toFixed(1)}%</li>
        </ul>
      </div>

      <div className="lld-section">
        <h4>🧪 Testing Strategy</h4>
        <ul style={{ marginLeft: 16 }}>
          <li><b>Unit:</b> Business logic, data transformations</li>
          <li><b>Integration:</b> Service ↔ database, service ↔ cache contracts</li>
          <li><b>End-to-end:</b> Full request flow in staging (mirror production traffic)</li>
          <li><b>Load test:</b> Gradual ramp to {fmt(template.rps)} rps, measure p99 latency</li>
          <li><b>Chaos:</b> Kill random pods, degrade network, trigger faults</li>
        </ul>
      </div>
    </section>
  )
}
