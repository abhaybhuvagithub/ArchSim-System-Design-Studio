import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import { TEMPLATES } from './templates.js'
import { simulate, capacityReport } from './sim.js'
import { review, applyAll } from './advisor.js'

const NODE_W = 118, NODE_H = 46
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString()
const utilColor = u => u > 1 ? '#ef4444' : u > 0.8 ? '#f59e0b' : u > 0.5 ? '#eab308' : '#22c55e'
let idc = 0
const nid = t => `${t}_${Date.now().toString(36)}_${idc++}`

export default function App() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [sel, setSel] = useState(null)          // selected node id
  const [selEdge, setSelEdge] = useState(null)
  const [rps, setRps] = useState(10000)
  const [simOn, setSimOn] = useState(false)
  const [chaosOn, setChaosOn] = useState(false)
  const [down, setDown] = useState({})          // id -> recoverAt ms
  const [tick, setTick] = useState(0)
  const [hover, setHover] = useState(null)     // hovered node id
  const [template, setTemplate] = useState(null)
  const [checks, setChecks] = useState({})
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [timer, setTimer] = useState(null)      // seconds remaining or null
  const [tab, setTab] = useState('capacity')    // side panel: capacity | improve
  const [applied, setApplied] = useState([])    // ids of suggestions already applied
  const svgRef = useRef(null)
  const drag = useRef(null)

  const downSet = useMemo(() => new Set(Object.keys(down)), [down])
  const sim = useMemo(() => simulate(nodes, edges, rps, downSet), [nodes, edges, rps, downSet])
  const cap = useMemo(() => capacityReport(nodes, sim), [nodes, sim])
  const sugs = useMemo(() => review(nodes, edges, rps), [nodes, edges, rps])

  const applyOne = s => {
    const r = s.apply?.(nodes, edges)
    if (!r) return
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, s.id])
    if (r.focus) { setSel(r.focus); setHover(r.focus) }
  }
  const applyEvery = () => {
    const actionable = sugs.filter(s => s.apply)
    const r = applyAll(actionable, nodes, edges)
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, ...actionable.map(s => s.id)])
    if (r.focus) setSel(r.focus)
  }

  // animation + chaos + recovery loop
  useEffect(() => {
    if (!simOn) return
    const h = setInterval(() => {
      setTick(t => t + 1)
      setDown(d => {
        const now = Date.now()
        const nd = Object.fromEntries(Object.entries(d).filter(([, until]) => until > now))
        return Object.keys(nd).length === Object.keys(d).length ? d : nd
      })
    }, 50)
    return () => clearInterval(h)
  }, [simOn])

  useEffect(() => {
    if (!chaosOn || !simOn) return
    const h = setInterval(() => {
      setDown(d => {
        const candidates = nodes.filter(n => !CATALOG[n.type]?.source && !d[n.id])
        if (!candidates.length) return d
        const victim = candidates[Math.floor(Math.random() * candidates.length)]
        return { ...d, [victim.id]: Date.now() + 6000 }
      })
    }, 4000)
    return () => clearInterval(h)
  }, [chaosOn, simOn, nodes])

  // interview timer
  useEffect(() => {
    if (timer === null) return
    const h = setInterval(() => setTimer(t => (t !== null && t > 0 ? t - 1 : t)), 1000)
    return () => clearInterval(h)
  }, [timer !== null])

  // keyboard delete
  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel) { setNodes(ns => ns.filter(n => n.id !== sel)); setEdges(es => es.filter(e2 => e2.from !== sel && e2.to !== sel)); setSel(null) }
        else if (selEdge) { setEdges(es => es.filter(e2 => e2.id !== selEdge)); setSelEdge(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, selEdge])

  const toWorld = useCallback((cx, cy) => {
    const r = svgRef.current.getBoundingClientRect()
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }
  }, [view])

  // ---- palette drop ----
  const onDrop = e => {
    e.preventDefault()
    const type = e.dataTransfer.getData('type')
    if (!CATALOG[type]) return
    const p = toWorld(e.clientX, e.clientY)
    const id = nid(type)
    setNodes(ns => [...ns, { id, type, label: CATALOG[type].name, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, replicas: 1 }])
    setSel(id)
  }

  // ---- canvas interactions ----
  const onNodeDown = (e, n) => {
    e.stopPropagation()
    setSel(n.id); setSelEdge(null)
    const p = toWorld(e.clientX, e.clientY)
    drag.current = { kind: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y }
  }
  const onPortDown = (e, n) => {
    e.stopPropagation()
    const p = toWorld(e.clientX, e.clientY)
    drag.current = { kind: 'wire', from: n.id, x: p.x, y: p.y }
    setTick(t => t + 1)
  }
  const onCanvasDown = e => {
    setSel(null); setSelEdge(null)
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }
  }
  const onMove = e => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'node') {
      const p = toWorld(e.clientX, e.clientY)
      setNodes(ns => ns.map(n => n.id === d.id ? { ...n, x: p.x - d.dx, y: p.y - d.dy } : n))
    } else if (d.kind === 'pan') {
      setView(v => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }))
    } else if (d.kind === 'wire') {
      const p = toWorld(e.clientX, e.clientY)
      d.x = p.x; d.y = p.y
      setTick(t => t + 1)
    }
  }
  const onUp = e => {
    const d = drag.current
    if (d?.kind === 'wire') {
      const p = toWorld(e.clientX, e.clientY)
      const target = nodes.find(n => p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + NODE_H)
      if (target && target.id !== d.from && !edges.some(e2 => e2.from === d.from && e2.to === target.id)) {
        setEdges(es => [...es, { id: `${d.from}->${target.id}`, from: d.from, to: target.id, label: '' }])
      }
    }
    drag.current = null
    setTick(t => t + 1)
  }
  const onWheel = e => {
    const k = Math.min(2.5, Math.max(0.35, view.k * (e.deltaY > 0 ? 0.92 : 1.08)))
    const r = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    setView(v => ({ k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }))
  }

  // ---- templates ----
  const loadTemplate = idx => {
    if (idx === '') return
    const t = TEMPLATES[+idx]
    setNodes(t.nodes.map(n => ({ ...n })))
    setEdges(t.edges.map(e => ({ ...e })))
    setTemplate(t); setChecks({}); setSel(null); setDown({})
    setRps(t.rps); setView({ x: 20, y: 20, k: 1 })
  }
  const clearAll = () => { setNodes([]); setEdges([]); setTemplate(null); setSel(null); setDown({}) }

  // ---- export ----
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges, rps }, null, 2)], { type: 'application/json' })
    dl(URL.createObjectURL(blob), 'archsim-design.json')
  }
  const importJSON = e => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const d = JSON.parse(r.result)
        setNodes(d.nodes || []); setEdges(d.edges || []); if (d.rps) setRps(d.rps)
        setTemplate(null); setDown({})
      } catch { alert('Invalid JSON') }
    }
    r.readAsText(f)
    e.target.value = ''
  }
  const exportPNG = () => {
    const svg = svgRef.current.cloneNode(true)
    svg.setAttribute('width', 1600); svg.setAttribute('height', 1000)
    const s = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 1600; c.height = 1000
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0)
      dl(c.toDataURL('image/png'), 'archsim-design.png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)))
  }
  const dl = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

  const selNode = nodes.find(n => n.id === sel)
  const hoverNode = nodes.find(n => n.id === hover)
  const dots = simOn ? edgeDots(edges, nodes, sim, tick) : []

  // neighbours of the hovered node — used to dim everything else
  const neighbours = useMemo(() => {
    if (!hover) return null
    const s = new Set([hover])
    for (const e of edges) {
      if (e.from === hover) s.add(e.to)
      if (e.to === hover) s.add(e.from)
    }
    return s
  }, [hover, edges])

  return (
    <div className="app">
      <div className="toolbar">
        <div className="logo">Arch<span>Sim</span></div>
        <select className="btn" value="" onChange={e => loadTemplate(e.target.value)}>
          <option value="">📚 Load template…</option>
          {TEMPLATES.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
        </select>
        <button className={`btn ${simOn ? 'active' : ''}`} onClick={() => setSimOn(s => !s)}>{simOn ? '⏸ Stop' : '▶ Simulate'}</button>
        <button className={`btn ${chaosOn ? 'danger' : ''}`} onClick={() => setChaosOn(c => !c)} title="Randomly kills nodes while simulating; they auto-recover in 6s">🐒 Chaos {chaosOn ? 'ON' : 'off'}</button>
        <button className={`btn ${tab === 'improve' ? 'active' : ''}`} onClick={() => { setTab(t => t === 'improve' ? 'capacity' : 'improve'); setSel(null) }}
          title="Review the design and suggest components to add, wired in automatically">
          ✨ Improve{sugs.length ? ` (${sugs.length})` : ''}
        </button>
        <div className="rps">
          <span>Traffic</span>
          <input type="range" min={2} max={6} step={0.05} value={Math.log10(rps)} onChange={e => setRps(Math.round(10 ** +e.target.value))} />
          <b>{fmt(rps)} rps</b>
        </div>
        <div className="spacer" />
        <button className={`timer ${timer !== null && timer < 300 ? 'hot' : ''}`} onClick={() => setTimer(t => t === null ? 35 * 60 : null)} title="35-min interview timer">
          ⏱ {timer === null ? '35:00' : `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}
        </button>
        <button className="btn" onClick={exportPNG}>PNG</button>
        <button className="btn" onClick={exportJSON}>JSON ↓</button>
        <label className="btn">JSON ↑<input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} /></label>
        <button className="btn" onClick={clearAll}>Clear</button>
      </div>

      <div className="body">
        <div className="palette">
          {PALETTE_GROUPS.map(g => (
            <div key={g.label}>
              <h4>{g.label}</h4>
              {g.types.map(t => {
                const c = CATALOG[t]
                return (
                  <div key={t} className="pal-item" draggable
                    onDragStart={e => e.dataTransfer.setData('type', t)} title={c.desc}>
                    <div className="pal-glyph" style={{ background: c.color + '33', border: `1px solid ${c.color}` }}>{c.glyph}</div>
                    {c.name}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="canvas-wrap" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
          <svg ref={svgRef} onMouseDown={onCanvasDown} onMouseMove={onMove} onMouseUp={onUp} onWheel={onWheel}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a5578" />
              </marker>
              <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a5b4fc" />
              </marker>
              <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#818cf8" floodOpacity="0.95" />
              </filter>
            </defs>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {edges.map(e => (
                <Edge key={e.id} e={e} nodes={nodes} sim={sim} simOn={simOn}
                  selected={selEdge === e.id}
                  hot={hover ? e.from === hover || e.to === hover : false}
                  dimmed={hover ? !(e.from === hover || e.to === hover) : false}
                  onSelect={() => { setSelEdge(e.id); setSel(null) }} />
              ))}
              {drag.current?.kind === 'wire' && (() => {
                const f = nodes.find(n => n.id === drag.current.from)
                return f && <line x1={f.x + NODE_W} y1={f.y + NODE_H / 2} x2={drag.current.x} y2={drag.current.y} stroke="#6366f1" strokeWidth="2" strokeDasharray="5 4" />
              })()}
              {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.drop ? 3.5 : 2.5} fill={d.drop ? '#ef4444' : '#818cf8'} opacity="0.9" />)}
              {nodes.map(n => (
                <Node key={n.id} n={n} sim={sim} simOn={simOn}
                  selected={sel === n.id}
                  hovered={hover === n.id}
                  dimmed={neighbours ? !neighbours.has(n.id) : false}
                  onDown={onNodeDown} onPortDown={onPortDown}
                  onEnter={() => setHover(n.id)} onLeave={() => setHover(h => (h === n.id ? null : h))} />
              ))}
            </g>
          </svg>

          {hoverNode && !selNode && <HoverCard n={hoverNode} sim={sim} simOn={simOn} />}

          {simOn && (
            <div className="statbar">
              <div className="chip">p50 <b>{Math.round(sim.p50)} ms</b></div>
              <div className="chip">p99 <b>{Math.round(sim.p99)} ms</b></div>
              <div className={`chip ${sim.successRate < 0.99 ? 'bad' : 'ok'}`}>success <b>{(sim.successRate * 100).toFixed(2)}%</b></div>
              <div className="chip">availability <b>{(sim.sysAvail * 100).toFixed(3)}%</b></div>
              {sim.totalDropped > 1 && <div className="chip bad">dropping <b>{fmt(sim.totalDropped)}/s</b></div>}
              {Object.keys(down).length > 0 && <div className="chip bad">🐒 down: <b>{Object.keys(down).length}</b></div>}
            </div>
          )}
          {nodes.length === 0 && <div className="hint">Drag components from the left, wire them by dragging from a node's ● port, or load a template ↑</div>}
          {nodes.length > 0 && <div className="hint">Drag ● port to connect · scroll to zoom · drag canvas to pan · Del removes selection</div>}
        </div>

        <div className="side">
          <div className="tabs">
            <button className={tab === 'capacity' ? 'on' : ''} onClick={() => setTab('capacity')}>Capacity</button>
            <button className={tab === 'improve' ? 'on' : ''} onClick={() => { setTab('improve'); setSel(null) }}>
              ✨ Improve{sugs.length ? ` (${sugs.length})` : ''}
            </button>
          </div>

          {tab === 'improve' ? (
            <Advisor sugs={sugs} applied={applied} onApply={applyOne} onApplyAll={applyEvery}
              onHover={setHover} empty={nodes.length === 0} />
          ) : selNode ? <Inspector n={selNode} sim={sim} setNodes={setNodes} /> : (
            <section>
              <h3>Capacity report</h3>
              {cap.rows.length === 0 && <div className="empty">Nothing on the canvas yet. Load a template or drag components in, then hit ▶ Simulate.</div>}
              {cap.bottlenecks.length > 0 && (
                <div className="cap-row" style={{ background: '#3f1d1d', marginBottom: 10 }}>
                  ⚠️ <b>{cap.bottlenecks.length} bottleneck{cap.bottlenecks.length > 1 ? 's' : ''}</b> — {cap.bottlenecks.map(b => b.label).join(', ')}
                </div>
              )}
              {cap.rows.slice(0, 12).map(r => (
                <div key={r.id} className="cap-row">
                  <div className="t">
                    <span>{r.label}{r.down && <span className="pill bad">DOWN</span>}</span>
                    <span style={{ color: utilColor(r.util) }}>{(r.util * 100).toFixed(0)}%</span>
                  </div>
                  <div className="util-bar"><i style={{ width: `${Math.min(100, r.util * 100)}%`, background: utilColor(r.util) }} /></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {fmt(r.in)}/s in · {r.replicas}× replicas{r.needed > r.replicas ? ` · needs ${r.needed}×` : ''}
                  </div>
                </div>
              ))}
            </section>
          )}

          {template && (
            <section>
              <h3>{template.name} — requirements</h3>
              <div className="muted" style={{ marginBottom: 6 }}>{template.tagline}</div>
              {template.checklist.map((c, i) => (
                <label key={i} className="check">
                  <input type="checkbox" checked={!!checks[i]} onChange={() => setChecks(s => ({ ...s, [i]: !s[i] }))} />
                  <span>{c}</span>
                </label>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Node({ n, sim, simOn, selected, hovered, dimmed, onDown, onPortDown, onEnter, onLeave }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const isDown = s?.down
  const util = s?.util || 0
  return (
    <g className={`node ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`} transform={`translate(${n.x},${n.y})`}
      onMouseDown={e => onDown(e, n)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ cursor: 'move', opacity: dimmed ? 0.32 : 1, transition: 'opacity .12s' }}>
      {hovered && <rect x="-4" y="-4" width={NODE_W + 8} height={NODE_H + 8} rx="13" fill="none" stroke="#818cf8" strokeWidth="2" opacity="0.9" filter="url(#glow)" />}
      <rect className="body" width={NODE_W} height={NODE_H} rx="10"
        fill={isDown ? '#3f1d1d' : hovered ? '#1e2a4d' : '#161f3a'}
        stroke={isDown ? '#ef4444' : hovered ? '#a5b4fc' : spec.color}
        strokeWidth={hovered ? 2 : 1.5} opacity={isDown ? 0.9 : 1} />
      <text x="10" y="20" fontSize="13">{spec.glyph}</text>
      <text x="30" y="19" fontSize="10.5" fill="#e2e8f0" fontWeight="600">{trunc(n.label, 15)}</text>
      <text x="30" y="33" fontSize="9" fill="#8b96b5">
        {isDown ? 'CHAOS: instance lost' : `${n.replicas}× · ${spec.source ? 'source' : fmt(spec.cap * n.replicas) + ' rps cap'}`}
      </text>
      {simOn && !spec.source && (
        <>
          <rect x="8" y={NODE_H - 7} width={NODE_W - 16} height="4" rx="2" fill="#0b1020" />
          <rect x="8" y={NODE_H - 7} width={(NODE_W - 16) * Math.min(1, util)} height="4" rx="2" fill={utilColor(util)} />
        </>
      )}
      {(n.replicas || 1) > 1 && <circle cx={NODE_W - 12} cy="12" r="8" fill={spec.color} opacity="0.9" />}
      {(n.replicas || 1) > 1 && <text x={NODE_W - 12} y="15" fontSize="9" textAnchor="middle" fill="#fff" fontWeight="700">{n.replicas}</text>}
      <circle cx={NODE_W} cy={NODE_H / 2} r="6" fill="#6366f1" stroke="#0b1020" strokeWidth="2"
        style={{ cursor: 'crosshair' }} onMouseDown={e => onPortDown(e, n)} />
    </g>
  )
}

function Edge({ e, nodes, sim, simOn, selected, hot, dimmed, onSelect }) {
  const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to)
  if (!f || !t) return null
  const x1 = f.x + NODE_W, y1 = f.y + NODE_H / 2, x2 = t.x, y2 = t.y + NODE_H / 2
  const mx = (x1 + x2) / 2
  const flow = sim.flowOnEdge[e.id] || 0
  const w = simOn ? Math.min(5, 1 + Math.log10(1 + flow) * 0.8) : 1.5
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  const stroke = selected ? '#fff' : hot ? '#a5b4fc' : simOn && flow > 0 ? '#6366f1' : '#38436b'
  return (
    <g className="edge" onMouseDown={ev => { ev.stopPropagation(); onSelect() }}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.18 : 1, transition: 'opacity .12s' }}>
      <path d={d} stroke={stroke} strokeWidth={selected ? 3 : hot ? Math.max(2.5, w) : w}
        markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'} opacity={simOn && flow === 0 && !hot ? 0.4 : 0.85} />
      <path d={d} stroke="transparent" strokeWidth="12" />
      {simOn && flow > 0 && <text x={mx} y={(y1 + y2) / 2 - 6} fontSize="9" fill={hot ? '#c7d2fe' : '#8b96b5'} textAnchor="middle">{fmt(flow)}/s</text>}
    </g>
  )
}

function Advisor({ sugs, applied, onApply, onApplyAll, onHover, empty }) {
  const actionable = sugs.filter(s => s.apply)
  return (
    <section>
      <h3>Architecture review</h3>
      {empty ? (
        <div className="empty">Load a template or drop a few components in, then come back — the review looks at what is missing, what is saturated, and what has no redundancy at the current traffic level.</div>
      ) : sugs.length === 0 ? (
        <div className="empty">✅ Nothing to flag at {' '}this traffic level. Push the traffic slider higher to expose the next bottleneck.</div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>
            {sugs.length} finding{sugs.length > 1 ? 's' : ''}. Applying one drops the component in and wires it into the right place.
          </div>
          {actionable.length > 1 && (
            <button className="btn primary" style={{ width: '100%', marginBottom: 10 }} onClick={onApplyAll}>
              ✨ Apply all {actionable.length}
            </button>
          )}
          {sugs.map(s => (
            <div key={s.id} className={`sug ${s.severity}`}>
              <div className="sug-t">
                <span>{s.icon} {s.title}</span>
                <span className={`pill ${s.severity === 'high' ? 'bad' : s.severity === 'med' ? 'warn' : 'ok'}`}>{s.severity}</span>
              </div>
              <div className="sug-d">{s.detail}</div>
              {s.apply ? (
                <button className="btn" style={{ marginTop: 7 }} onClick={() => onApply(s)}>
                  {applied.includes(s.id) ? 'Apply again' : 'Apply'}
                </button>
              ) : <div className="sug-manual">manual fix</div>}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function HoverCard({ n, sim, simOn }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  return (
    <div className="hovercard">
      <div className="hc-title">{spec.glyph} {n.label}<span className="hc-type">{spec.name}</span></div>
      <div className="hc-desc">{spec.desc}</div>
      {!spec.source && (
        <div className="hc-stats">
          <span>{n.replicas || 1}× replicas</span>
          <span>{fmt(spec.cap * (n.replicas || 1))} rps capacity</span>
          <span>{spec.lat} ms base</span>
          {simOn && s && <span style={{ color: utilColor(s.util) }}>{(s.util * 100).toFixed(0)}% used</span>}
          {simOn && s?.dropped > 0 && <span style={{ color: '#ef4444' }}>dropping {fmt(s.dropped)}/s</span>}
        </div>
      )}
    </div>
  )
}

function Inspector({ n, sim, setNodes }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const setRepl = d => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, replicas: Math.max(1, Math.min(64, (x.replicas || 1) + d)) } : x))
  return (
    <section>
      <h3>{spec.glyph} {spec.name}</h3>
      <div className="muted" style={{ marginBottom: 10 }}>{spec.desc}</div>
      <div className="field">
        <label>Label</label>
        <input value={n.label} onChange={e => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, label: e.target.value } : x))} />
      </div>
      {!spec.source && (
        <div className="field">
          <label>Replicas</label>
          <div className="repl">
            <button onClick={() => setRepl(-1)}>−</button><b>{n.replicas || 1}</b><button onClick={() => setRepl(1)}>+</button>
          </div>
        </div>
      )}
      {s && !spec.source && (
        <>
          <div className="row"><span>Incoming</span><span className="v">{fmt(s.in)}/s</span></div>
          <div className="row"><span>Capacity</span><span className="v">{fmt(spec.cap * (s.replicas || 1))}/s</span></div>
          <div className="row"><span>Utilization</span><span className="v" style={{ color: utilColor(s.util) }}>{(s.util * 100).toFixed(0)}%</span></div>
          <div className="row"><span>Dropped</span><span className="v" style={{ color: s.dropped > 0 ? '#ef4444' : undefined }}>{fmt(s.dropped)}/s</span></div>
          <div className="row"><span>Latency (queued)</span><span className="v">{s.latency.toFixed(1)} ms</span></div>
          <div className="row"><span>Availability</span><span className="v">{(s.avail * 100).toFixed(3)}%</span></div>
        </>
      )}
      <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>Tip: press Delete to remove this node.</div>
    </section>
  )
}

// moving dots along active edges
function edgeDots(edges, nodes, sim, tick) {
  const dots = []
  for (const e of edges) {
    const flow = sim.flowOnEdge[e.id] || 0
    if (flow <= 0) continue
    const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to)
    if (!f || !t) continue
    const x1 = f.x + NODE_W, y1 = f.y + NODE_H / 2, x2 = t.x, y2 = t.y + NODE_H / 2
    const mx = (x1 + x2) / 2
    const count = Math.min(4, 1 + Math.floor(Math.log10(1 + flow)))
    const toStats = sim.stats[e.to]
    const dropping = toStats && toStats.dropped > 0
    for (let i = 0; i < count; i++) {
      const p = ((tick * 0.02) + i / count) % 1
      dots.push({ ...bezier(p, x1, y1, mx, x2, y2), drop: dropping && i === 0 })
    }
  }
  return dots
}
function bezier(t, x1, y1, mx, x2, y2) {
  const u = 1 - t
  // cubic with control points (mx,y1),(mx,y2)
  const x = u * u * u * x1 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x2
  const y = u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2
  return { x, y }
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
