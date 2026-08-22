import { COMPONENT_INTERNALS, getComponentInternals } from './component-internals.js'
import { CATALOG } from './catalog.js'

export function ComponentDetails({ nodeId, node, onClose }) {
  if (!node) return null

  const spec = CATALOG[node.type]
  const internals = getComponentInternals(node.type)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="component-glyph">{spec?.glyph}</span>
            <h2>{spec?.name} <span className="component-type">({node.type})</span></h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="details-section">
            <h3>📝 Description</h3>
            <p>{spec?.desc}</p>
          </div>

          <div className="details-section">
            <h3>⚙️ Core Algorithm</h3>
            <div className="details-box">
              <p><b>{internals.algorithm}</b></p>
            </div>
          </div>

          <div className="details-section">
            <h3>🗂️ Data Structure</h3>
            <div className="details-box">
              <p>{internals.dataStructure}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>🔄 Internal Working</h3>
            <div className="details-box">
              <p>{internals.internal}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>🔧 Queuing & Consistency Mechanism</h3>
            <div className="details-box">
              <p>{internals.mechanism}</p>
            </div>
          </div>

          <div className="details-section">
            <h3>📊 Performance Specs</h3>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-label">Capacity</span>
                <span className="spec-value">{spec?.cap?.toLocaleString()}/s</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Latency</span>
                <span className="spec-value">{spec?.lat}ms</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Availability</span>
                <span className="spec-value">{(spec?.avail * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="details-section">
            <h3>💡 Common Use Cases</h3>
            <ul>
              {node.type === 'cache' && (
                <>
                  <li>Session storage with TTL expiry</li>
                  <li>Rate limiting state (token buckets)</li>
                  <li>User-specific feature flags</li>
                  <li>Leaderboards (sorted sets)</li>
                </>
              )}
              {node.type === 'sql' && (
                <>
                  <li>Transactional business entities (orders, users)</li>
                  <li>ACID guarantees needed (payments)</li>
                  <li>Complex joins across tables</li>
                  <li>Strong consistency requirements</li>
                </>
              )}
              {node.type === 'nosql' && (
                <>
                  <li>Document storage (profiles, settings)</li>
                  <li>Time-series events</li>
                  <li>Massive write throughput (IoT)</li>
                  <li>Flexible schema evolution</li>
                </>
              )}
              {node.type === 'queue' && (
                <>
                  <li>Async job processing</li>
                  <li>Email/SMS delivery queues</li>
                  <li>Decoupling producers from consumers</li>
                  <li>Retry logic with exponential backoff</li>
                </>
              )}
              {node.type === 'llm' && (
                <>
                  <li>Text generation (chat, summaries)</li>
                  <li>Question answering with context</li>
                  <li>Code generation and completion</li>
                  <li>Embedding-based semantic search</li>
                </>
              )}
              {!node.type.match(/(cache|sql|nosql|queue|llm)/) && (
                <li>See component description for use cases</li>
              )}
            </ul>
          </div>

          <div className="details-section">
            <h3>⚠️ Common Pitfalls</h3>
            <ul>
              {node.type === 'cache' && (
                <>
                  <li><b>Cache stampede:</b> Multiple requests fetch same key simultaneously after expiry</li>
                  <li><b>Stale data:</b> TTL too long = outdated information served</li>
                  <li><b>Eviction under load:</b> LRU eviction storms if capacity too small</li>
                </>
              )}
              {node.type === 'sql' && (
                <>
                  <li><b>N+1 queries:</b> Loop fetches one row at a time instead of batch</li>
                  <li><b>Missing indexes:</b> Full table scans on common filters</li>
                  <li><b>Lock contention:</b> Multiple writes to same row block each other</li>
                </>
              )}
              {node.type === 'queue' && (
                <>
                  <li><b>Message loss:</b> Processing fails before ACK sent</li>
                  <li><b>Poison pills:</b> One bad message blocks queue consumers indefinitely</li>
                  <li><b>Visibility timeout too short:</b> Duplicate processing if worker crashes</li>
                </>
              )}
              {node.type === 'llm' && (
                <>
                  <li><b>Token limit overflow:</b> Context + prompt + generation exceeds max</li>
                  <li><b>Hallucination:</b> Model generates plausible-sounding false information</li>
                  <li><b>Unbounded latency:</b> Long sequence generation can timeout</li>
                </>
              )}
              {!node.type.match(/(cache|sql|queue|llm)/) && (
                <li>See performance monitoring for component-specific issues</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export const componentDetailsStyles = `
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; max-width: 600px; max-height: 85vh; 
  overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 16px; border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(127,140,160,.06), transparent);
  position: sticky; top: 0; z-index: 10;
}

.modal-title {
  display: flex; align-items: center; gap: 12px; flex: 1;
}

.component-glyph {
  font-size: 32px; line-height: 1;
}

.modal-title h2 {
  font-size: 20px; margin: 0; color: var(--text);
}

.component-type {
  font-size: 12px; opacity: 0.6; font-weight: normal;
}

.modal-close {
  background: none; border: none; font-size: 28px; cursor: pointer;
  color: var(--muted); padding: 0; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
}

.modal-close:hover { color: var(--text); }

.modal-body {
  padding: 16px;
}

.details-section {
  margin-bottom: 18px;
}

.details-section h3 {
  font-size: 13.6px; font-weight: 600; color: var(--text);
  margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;
}

.details-section p {
  font-size: 13.2px; line-height: 1.6; color: var(--muted); margin: 0;
}

.details-box {
  background: rgba(127,140,160,.06); padding: 10px 12px;
  border-radius: 4px; border-left: 2px solid var(--accent);
}

.details-box p {
  margin: 0; font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px; color: var(--text);
}

.details-section ul {
  list-style: none; padding: 0; margin: 0;
}

.details-section li {
  font-size: 13px; line-height: 1.5; color: var(--muted);
  margin-bottom: 6px; padding-left: 20px; position: relative;
}

.details-section li:before {
  content: '▪'; position: absolute; left: 8px; color: var(--accent);
}

.details-section li b { color: var(--text); font-weight: 600; }

.specs-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}

.spec-item {
  display: flex; flex-direction: column; padding: 8px;
  background: rgba(127,140,160,.06); border-radius: 4px; text-align: center;
}

.spec-label {
  font-size: 11px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase;
}

.spec-value {
  font-size: 14px; font-weight: 600; color: var(--accent);
}
`
