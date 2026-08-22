import { CATALOG } from './catalog.js'
import { getComponentInternals } from './component-internals.js'

export function ComponentComparison({ selected = [] }) {
  if (selected.length < 2) {
    return (
      <section>
        <h3>Compare Components</h3>
        <p className="muted">Select 2–3 components in your canvas to compare their internals, specifications, and trade-offs side by side.</p>
      </section>
    )
  }

  const components = selected.map(type => ({
    type,
    spec: CATALOG[type],
    internals: getComponentInternals(type),
  }))

  return (
    <section>
      <h3>Component Comparison</h3>
      <div className="comparison-grid">
        <div className="comp-header">Characteristic</div>
        {components.map(c => (
          <div key={c.type} className="comp-header comp-col">
            <div className="comp-col-glyph">{c.spec.glyph}</div>
            <div className="comp-col-name">{c.spec.name}</div>
            <div className="comp-col-type">{c.type}</div>
          </div>
        ))}

        {/* Description */}
        <div className="comp-row-title">Description</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <p className="muted">{c.spec.desc}</p>
          </div>
        ))}

        {/* Algorithm */}
        <div className="comp-row-title">Core Algorithm</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <div className="comp-highlight">{c.internals.algorithm}</div>
          </div>
        ))}

        {/* Data Structure */}
        <div className="comp-row-title">Data Structure</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <p className="muted">{c.internals.dataStructure}</p>
          </div>
        ))}

        {/* Capacity */}
        <div className="comp-row-title">Capacity</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell comp-metric">
            <span className="metric-value">{(c.spec.cap / 1000).toFixed(1)}k</span>
            <span className="metric-label">/s</span>
          </div>
        ))}

        {/* Latency */}
        <div className="comp-row-title">Latency</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell comp-metric">
            <span className="metric-value">{c.spec.lat}</span>
            <span className="metric-label">ms</span>
          </div>
        ))}

        {/* Availability */}
        <div className="comp-row-title">Availability</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell comp-metric">
            <span className="metric-value">{(c.spec.avail * 100).toFixed(3)}</span>
            <span className="metric-label">%</span>
          </div>
        ))}

        {/* Internal Working */}
        <div className="comp-row-title">Internal Working</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <p className="muted">{c.internals.internal}</p>
          </div>
        ))}

        {/* Queuing & Mechanism */}
        <div className="comp-row-title">Queuing & Mechanism</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <p className="muted">{c.internals.mechanism}</p>
          </div>
        ))}

        {/* Use Case Summary */}
        <div className="comp-row-title">Best For</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <UseCaseSummary type={c.type} />
          </div>
        ))}

        {/* Pitfalls */}
        <div className="comp-row-title">Watch Out For</div>
        {components.map(c => (
          <div key={c.type} className="comp-cell">
            <PitfallsSummary type={c.type} />
          </div>
        ))}
      </div>

      <div className="comparison-footer">
        <h4>Trade-off Guide</h4>
        <TradeoffAnalysis components={components} />
      </div>
    </section>
  )
}

function UseCaseSummary({ type }) {
  const useCases = {
    cache: ['Hot reads', 'Rate limits', 'Sessions', 'Leaderboards'],
    sql: ['Transactions', 'ACID', 'Complex joins', 'Strong consistency'],
    nosql: ['Massive writes', 'Flexible schema', 'Time-series', 'Document storage'],
    queue: ['Async jobs', 'Decoupling', 'Retry logic', 'Bursty loads'],
    llm: ['Text generation', 'QA', 'Code generation', 'Semantic search'],
    cdn: ['Static assets', 'Global distribution', 'Latency reduction', 'Bandwidth savings'],
  }
  
  const cases = useCases[type] || ['See internals for use cases']
  
  return (
    <ul className="use-cases">
      {cases.map((uc, i) => <li key={i}>{uc}</li>)}
    </ul>
  )
}

function PitfallsSummary({ type }) {
  const pitfalls = {
    cache: ['Cache stampede', 'Stale data', 'Eviction storms', 'Thundering herd'],
    sql: ['N+1 queries', 'Missing indexes', 'Lock contention', 'Hot row conflicts'],
    nosql: ['Uncontrolled growth', 'Skewed partitions', 'Eventual consistency issues', 'Runaway storage'],
    queue: ['Message loss', 'Poison pills', 'Visibility timeout too short', 'Duplicate processing'],
    llm: ['Token overflow', 'Hallucination', 'Unbounded latency', 'Context confusion'],
  }
  
  const warnings = pitfalls[type] || ['See internals for pitfalls']
  
  return (
    <ul className="pitfalls">
      {warnings.map((pit, i) => <li key={i}>{pit}</li>)}
    </ul>
  )
}

function TradeoffAnalysis({ components }) {
  if (components.length < 2) return null

  return (
    <div className="tradeoff-matrix">
      {components.length === 2 && (
        <div className="tradeoff-row">
          <span className="tradeoff-label">Faster writes?</span>
          <span className="tradeoff-vs">{components[0].type}</span>
          <span className="tradeoff-vs">{components[1].type}</span>
          <CompareMetric left={components[0]} right={components[1]} metric="writes" />
        </div>
      )}
      
      {components.length === 2 && (
        <div className="tradeoff-row">
          <span className="tradeoff-label">Lower latency?</span>
          <span className="tradeoff-vs">{components[0].type}</span>
          <span className="tradeoff-vs">{components[1].type}</span>
          <CompareMetric left={components[0]} right={components[1]} metric="latency" />
        </div>
      )}

      {components.length === 2 && (
        <div className="tradeoff-row">
          <span className="tradeoff-label">Higher throughput?</span>
          <span className="tradeoff-vs">{components[0].type}</span>
          <span className="tradeoff-vs">{components[1].type}</span>
          <CompareMetric left={components[0]} right={components[1]} metric="capacity" />
        </div>
      )}
    </div>
  )
}

function CompareMetric({ left, right, metric }) {
  let leftVal, rightVal, unit = ''
  
  if (metric === 'latency') {
    leftVal = left.spec.lat
    rightVal = right.spec.lat
    unit = 'ms'
  } else if (metric === 'capacity') {
    leftVal = left.spec.cap
    rightVal = right.spec.cap
    unit = 'rps'
  } else if (metric === 'writes') {
    // LRU-based (cache, memory) typically faster than disk-based
    const fastWrites = new Set(['cache', 'kv', 'memory', 'redis'])
    leftVal = fastWrites.has(left.type) ? 100 : 50
    rightVal = fastWrites.has(right.type) ? 100 : 50
  }
  
  const winner = leftVal > rightVal ? 'left' : leftVal < rightVal ? 'right' : 'tie'
  
  return (
    <div className="tradeoff-result">
      <span className={`winner ${winner === 'left' ? 'active' : ''}`}>✓ {unit}</span>
      <span className={`winner ${winner === 'right' ? 'active' : ''}`}>✓ {unit}</span>
    </div>
  )
}

