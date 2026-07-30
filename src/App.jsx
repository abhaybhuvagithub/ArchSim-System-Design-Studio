import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import { TEMPLATES } from './templates.js'
import { simulate, capacityReport } from './sim.js'
import { review, applyAll } from './advisor.js'
import { THEMES, readTheme, saveTheme } from './theme.js'
import { LESSON, COMPARISONS, QUIZ, NUMBERS } from './learn.js'

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
  const [theme, setTheme] = useState(readTheme) // 'dark' | 'light'
  const [steps, setSteps] = useState(false)     // numbered request-flow badges
  const [chaosUsed, setChaosUsed] = useState(false)
  const T = THEMES[theme]

  useEffect(() => { document.documentElement.dataset.theme = theme; saveTheme(theme) }, [theme])
  const svgRef = useRef(null)
  const drag = useRef(null)

  const downSet = useMemo(() => new Set(Object.keys(down)), [down])
  const sim = useMemo(() => simulate(nodes, edges, rps, downSet), [nodes, edges, rps, downSet])
  const cap = useMemo(() => capacityReport(nodes, sim), [nodes, sim])
  const sugs = useMemo(() => review(nodes, edges, rps), [nodes, edges, rps])

  // context the guided lesson checks itself against
  const lessonCtx = useMemo(() => ({
    nodes, edges, rps, simOn, steps, chaosUsed,
    successRate: sim.successRate,
    maxUtil: Math.max(0, ...cap.rows.map(r => r.util)),
    has: t => nodes.some(n => n.type === t),
    any: ts => nodes.some(n => ts.includes(n.type)),
  }), [nodes, edges, rps, simOn, steps, chaosUsed, sim, cap])
  const doneSteps = useMemo(() => LESSON.map(s => { try { return !!s.check(lessonCtx) } catch { return false } }), [lessonCtx])

  const fitView = useCallback(ns => {
    if (!ns?.length || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const minX = Math.min(...ns.map(n => n.x)) - 40, maxX = Math.max(...ns.map(n => n.x)) + NODE_W + 40
    const minY = Math.min(...ns.map(n => n.y)) - 40, maxY = Math.max(...ns.map(n => n.y)) + NODE_H + 40
    const k = Math.min(1.2, Math.max(0.3, Math.min(r.width / (maxX - minX), r.height / (maxY - minY))))
    setView({ k, x: (r.width - (maxX - minX) * k) / 2 - minX * k, y: (r.height - (maxY - minY) * k) / 2 - minY * k })
  }, [])

  const applyOne = s => {
    const r = s.apply?.(nodes, edges)
    if (!r) return
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, s.id])
    if (r.focus) { setSel(r.focus); setHover(r.focus) }
    fitView(r.nodes)
  }
  const applyEvery = () => {
    const actionable = sugs.filter(s => s.apply)
    const r = applyAll(actionable, nodes, edges)
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, ...actionable.map(s => s.id)])
    if (r.focus) setSel(r.focus)
    fitView(r.nodes)
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
  const STARTER = {
    name: 'Starter scaffold', tagline: 'Minimal 3-tier skeleton to build on', rps: 5000,
    nodes: [
      { id: 's_c', type: 'client', label: 'Users', x: 80, y: 240, replicas: 1 },
      { id: 's_lb', type: 'lb', label: 'Load Balancer', x: 250, y: 240, replicas: 1 },
      { id: 's_app', type: 'app', label: 'App Service', x: 420, y: 240, replicas: 3 },
      { id: 's_db', type: 'sql', label: 'Primary DB', x: 590, y: 240, replicas: 2 },
    ],
    edges: [
      { id: 's_c->s_lb', from: 's_c', to: 's_lb', label: '' },
      { id: 's_lb->s_app', from: 's_lb', to: 's_app', label: '' },
      { id: 's_app->s_db', from: 's_app', to: 's_db', label: '' },
    ],
    checklist: [
      'Sketch functional requirements before adding components',
      'Do the back-of-envelope math: QPS, storage, bandwidth',
      'Add a cache once you know the read:write ratio',
      'Then run ▶ Simulate and ✨ Improve to find the gaps',
    ],
  }

  const blank = () => {
    setNodes([]); setEdges([]); setTemplate(null); setSel(null); setSelEdge(null)
    setDown({}); setApplied([]); setChecks({}); setChaosOn(false)
    setView({ x: 0, y: 0, k: 1 })
  }

  const loadTemplate = idx => {
    if (idx === '') return
    if (idx === 'blank') { blank(); return }
    if (idx === 'starter') {
      setNodes(STARTER.nodes.map(n => ({ ...n }))); setEdges(STARTER.edges.map(e => ({ ...e })))
      setTemplate(STARTER); setChecks({}); setSel(null); setDown({}); setApplied([])
      setRps(STARTER.rps); requestAnimationFrame(() => fitView(STARTER.nodes))
      return
    }
    const t = TEMPLATES[+idx]
    setNodes(t.nodes.map(n => ({ ...n })))
    setEdges(t.edges.map(e => ({ ...e })))
    setTemplate(t); setChecks({}); setSel(null); setDown({}); setApplied([])
    setRps(t.rps)
    requestAnimationFrame(() => fitView(t.nodes))
  }
  const clearAll = blank

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
      ctx.fillStyle = T.canvasBg; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0)
      dl(c.toDataURL('image/png'), 'archsim-design.png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)))
  }
  const dl = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

  const selNode = nodes.find(n => n.id === sel)
  const selEdgeObj = edges.find(e => e.id === selEdge)
  const hoverNode = nodes.find(n => n.id === hover)
  const dots = simOn ? edgeDots(edges, nodes, sim, tick) : []
  const stepMap = useMemo(() => (steps ? flowSteps(nodes, edges) : {}), [steps, nodes, edges])

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
          <option value="">📚 New / load template…</option>
          <optgroup label="Start from scratch">
            <option value="blank">＋ Blank canvas</option>
            <option value="starter">◻︎ Starter scaffold (client → LB → service → DB)</option>
          </optgroup>
          {[...new Set(TEMPLATES.map(t => t.group))].map(g => (
            <optgroup key={g} label={g}>
              {TEMPLATES.map((t, i) => t.group === g ? <option key={t.name} value={i}>{t.name}</option> : null)}
            </optgroup>
          ))}
        </select>
        <button className={`btn ${simOn ? 'active' : ''}`} onClick={() => setSimOn(s => !s)}>{simOn ? '⏸ Stop' : '▶ Simulate'}</button>
        <button className={`btn ${chaosOn ? 'danger' : ''}`} onClick={() => { setChaosOn(c => !c); setChaosUsed(true) }} title="Randomly kills nodes while simulating; they auto-recover in 6s">🐒 Chaos {chaosOn ? 'ON' : 'off'}</button>
        <button className={`btn ${tab === 'improve' ? 'active' : ''}`} onClick={() => { setTab(t => t === 'improve' ? 'capacity' : 'improve'); setSel(null) }}
          title="Review the design and suggest components to add, wired in automatically">
          ✨ Improve{sugs.length ? ` (${sugs.length})` : ''}
        </button>
        <div className="rps">
          <span>Traffic</span>
          <input type="range" min={2} max={6} step={0.05} value={Math.log10(rps)} onChange={e => setRps(Math.round(10 ** +e.target.value))} />
          <b>{fmt(rps)} rps</b>
        </div>
        <button className={`btn ${steps ? 'active' : ''}`} onClick={() => setSteps(s => !s)}
          title="Number the connections in request order, like a walkthrough diagram">①②③ Steps</button>
        <div className="spacer" />
        <button className="btn" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button className={`timer ${timer !== null && timer < 300 ? 'hot' : ''}`} onClick={() => setTimer(t => t === null ? 35 * 60 : null)} title="35-min interview timer">
          ⏱ {timer === null ? '35:00' : `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`}
        </button>
        <button className="btn" onClick={() => fitView(nodes)} title="Fit the whole diagram in view">⤢ Fit</button>
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
                <path d="M 0 0 L 10 5 L 0 10 z" fill={T.arrow} />
              </marker>
              <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={T.arrowHot} />
              </marker>
              <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={T.glow} floodOpacity="0.95" />
              </filter>
            </defs>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {edges.map(e => (
                <Edge key={e.id} e={e} nodes={nodes} sim={sim} simOn={simOn} t={T}
                  selected={selEdge === e.id}
                  step={steps ? stepMap[e.id] : null}
                  hot={hover ? e.from === hover || e.to === hover : false}
                  dimmed={hover ? !(e.from === hover || e.to === hover) : false}
                  onSelect={() => { setSelEdge(e.id); setSel(null); setTab('capacity') }} />
              ))}
              {drag.current?.kind === 'wire' && (() => {
                const f = nodes.find(n => n.id === drag.current.from)
                return f && <line x1={f.x + NODE_W} y1={f.y + NODE_H / 2} x2={drag.current.x} y2={drag.current.y} stroke={T.wire} strokeWidth="2" strokeDasharray="5 4" />
              })()}
              {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.drop ? 3.5 : 2.5} fill={d.drop ? T.dotDrop : T.dot} opacity="0.9" />)}
              {nodes.map(n => (
                <Node key={n.id} n={n} sim={sim} simOn={simOn} t={T}
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
          {nodes.length === 0 && <div className="hint">Blank canvas — drag components in from the left, wire them from a node's ● port, or pick a template ↑</div>}
          {nodes.length > 0 && <div className="hint">Drag ● port to connect · click a connection to label it · scroll to zoom · drag canvas to pan · Del removes selection</div>}
        </div>

        <div className="side">
          <div className="tabs">
            <button className={tab === 'capacity' ? 'on' : ''} onClick={() => setTab('capacity')}>Capacity</button>
            <button className={tab === 'improve' ? 'on' : ''} onClick={() => { setTab('improve'); setSel(null) }}>
              ✨ Improve{sugs.length ? ` (${sugs.length})` : ''}
            </button>
            <button className={tab === 'learn' ? 'on' : ''} onClick={() => { setTab('learn'); setSel(null) }}>
              🎓 Learn ({doneSteps.filter(Boolean).length}/{LESSON.length})
            </button>
          </div>

          {tab === 'learn' ? (
            <Learn done={doneSteps} />
          ) : tab === 'improve' ? (
            <Advisor sugs={sugs} applied={applied} onApply={applyOne} onApplyAll={applyEvery}
              onHover={setHover} empty={nodes.length === 0} />
          ) : selNode ? <Inspector n={selNode} sim={sim} setNodes={setNodes} />
            : selEdgeObj ? (
              <EdgeInspector e={selEdgeObj} nodes={nodes} sim={sim} step={stepMap[selEdgeObj.id]}
                setEdges={setEdges} onDelete={() => { setEdges(es => es.filter(x => x.id !== selEdgeObj.id)); setSelEdge(null) }} />
            ) : (
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

function Node({ n, sim, simOn, t, selected, hovered, dimmed, onDown, onPortDown, onEnter, onLeave }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const isDown = s?.down
  const util = s?.util || 0
  return (
    <g className={`node ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`} transform={`translate(${n.x},${n.y})`}
      onMouseDown={e => onDown(e, n)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ cursor: 'move', opacity: dimmed ? 0.32 : 1, transition: 'opacity .12s' }}>
      {hovered && <rect x="-4" y="-4" width={NODE_W + 8} height={NODE_H + 8} rx="13" fill="none" stroke={t.glow} strokeWidth="2" opacity="0.9" filter="url(#glow)" />}
      <rect className="body" width={NODE_W} height={NODE_H} rx="10"
        fill={isDown ? t.downFill : hovered ? t.nodeFillHover : t.nodeFill}
        stroke={isDown ? t.downStroke : hovered ? t.nodeStrokeHover : spec.color}
        strokeWidth={hovered ? 2 : 1.5} opacity={isDown ? 0.9 : 1} />
      <text x="10" y="20" fontSize="13">{spec.glyph}</text>
      <text x="30" y="19" fontSize="10.5" fill={t.nodeText} fontWeight="600">{trunc(n.label, 15)}</text>
      <text x="30" y="33" fontSize="9" fill={t.nodeSub}>
        {isDown ? 'CHAOS: instance lost' : `${n.replicas}× · ${spec.source ? 'source' : fmt(spec.cap * n.replicas) + ' rps cap'}`}
      </text>
      {simOn && !spec.source && (
        <>
          <rect x="8" y={NODE_H - 7} width={NODE_W - 16} height="4" rx="2" fill={t.barTrack} />
          <rect x="8" y={NODE_H - 7} width={(NODE_W - 16) * Math.min(1, util)} height="4" rx="2" fill={utilColor(util)} />
        </>
      )}
      {(n.replicas || 1) > 1 && <circle cx={NODE_W - 12} cy="12" r="8" fill={spec.color} opacity="0.9" />}
      {(n.replicas || 1) > 1 && <text x={NODE_W - 12} y="15" fontSize="9" textAnchor="middle" fill={t.badgeText} fontWeight="700">{n.replicas}</text>}
      <circle cx={NODE_W} cy={NODE_H / 2} r="6" fill={t.wire} stroke={t.nodeFill} strokeWidth="2"
        style={{ cursor: 'crosshair' }} onMouseDown={e => onPortDown(e, n)} />
    </g>
  )
}

function Edge({ e, nodes, sim, simOn, t, selected, hot, dimmed, step, onSelect }) {
  const f = nodes.find(n => n.id === e.from), tgt = nodes.find(n => n.id === e.to)
  if (!f || !tgt) return null
  const x1 = f.x + NODE_W, y1 = f.y + NODE_H / 2, x2 = tgt.x, y2 = tgt.y + NODE_H / 2
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const flow = sim.flowOnEdge[e.id] || 0
  const w = simOn ? Math.min(5, 1 + Math.log10(1 + flow) * 0.8) : 1.5
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  const stroke = selected ? t.selStroke : hot ? t.edgeHot : simOn && flow > 0 ? t.edgeActive : t.edge
  return (
    <g className="edge" onMouseDown={ev => { ev.stopPropagation(); onSelect() }}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.18 : 1, transition: 'opacity .12s' }}>
      <path d={d} stroke={stroke} strokeWidth={selected ? 3 : hot ? Math.max(2.5, w) : w}
        markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'} opacity={simOn && flow === 0 && !hot ? 0.4 : 0.85} />
      <path d={d} stroke="transparent" strokeWidth="12" />
      {e.label && <text x={mx} y={my + (simOn && flow > 0 ? 14 : 4)} fontSize="9.5" fill={t.nodeText} textAnchor="middle" fontWeight="600">{e.label}</text>}
      {simOn && flow > 0 && <text x={mx} y={my - 6} fontSize="9" fill={hot ? t.hotText : t.nodeSub} textAnchor="middle">{fmt(flow)}/s</text>}
      {step != null && (
        <>
          <circle cx={mx} cy={my - (simOn && flow > 0 ? 20 : 12)} r="8.5" fill={t.stepFill} stroke={t.stepStroke} strokeWidth="1.2" />
          <text x={mx} y={my - (simOn && flow > 0 ? 17 : 9)} fontSize="9" fontWeight="700" fill={t.stepText} textAnchor="middle">{step}</text>
        </>
      )}
    </g>
  )
}

function Learn({ done }) {
  const [sub, setSub] = useState('steps')
  const [answers, setAnswers] = useState({})
  const doneCount = done.filter(Boolean).length
  const score = Object.entries(answers).filter(([i, a]) => QUIZ[+i].answer === a).length
  return (
    <section>
      <div className="tabs sub">
        {[['steps', 'Steps'], ['compare', 'Compare'], ['quiz', 'Quiz'], ['numbers', 'Numbers']].map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>

      {sub === 'steps' && (
        <>
          <h3>Design walkthrough</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Twelve steps, checked against your canvas as you build. {doneCount}/{LESSON.length} done.
          </div>
          <div className="progress"><i style={{ width: `${(doneCount / LESSON.length) * 100}%` }} /></div>
          {LESSON.map((s, i) => (
            <div key={i} className={`lesson ${done[i] ? 'done' : ''}`}>
              <div className="lesson-t">
                <span className="lesson-n">{done[i] ? '✓' : i + 1}</span>
                <span>{s.title}</span>
              </div>
              <div className="lesson-do">→ {s.do}</div>
              <div className="lesson-why">{s.why}</div>
            </div>
          ))}
        </>
      )}

      {sub === 'compare' && (
        <>
          <h3>Difference between…</h3>
          <div className="muted" style={{ marginBottom: 8 }}>The trade-offs you get asked to justify.</div>
          {COMPARISONS.map(c => (
            <div key={c.title} className="cmp">
              <div className="cmp-t">{c.title}</div>
              <table>
                <thead><tr><th /><th>{c.left}</th><th>{c.right}</th></tr></thead>
                <tbody>
                  {c.rows.map((r, i) => <tr key={i}><td className="k">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {sub === 'quiz' && (
        <>
          <h3>Interview questions</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            {Object.keys(answers).length ? `Score ${score}/${Object.keys(answers).length} answered` : `${QUIZ.length} questions — pick an answer to see the explanation.`}
            {Object.keys(answers).length > 0 && <button className="btn" style={{ marginLeft: 8, padding: '2px 8px' }} onClick={() => setAnswers({})}>Reset</button>}
          </div>
          {QUIZ.map((q, i) => {
            const picked = answers[i]
            return (
              <div key={i} className="quiz">
                <div className="quiz-q"><b>Q{i + 1}.</b> {q.q}</div>
                {q.options.map((o, j) => {
                  const state = picked === undefined ? '' : j === q.answer ? 'right' : picked === j ? 'wrong' : ''
                  return (
                    <button key={j} className={`quiz-o ${state}`} disabled={picked !== undefined}
                      onClick={() => setAnswers(a => ({ ...a, [i]: j }))}>
                      {picked !== undefined && j === q.answer ? '✓ ' : picked === j ? '✗ ' : ''}{o}
                    </button>
                  )
                })}
                {picked !== undefined && <div className="quiz-why">{q.why}</div>}
              </div>
            )
          })}
        </>
      )}

      {sub === 'numbers' && (
        <>
          <h3>Numbers to know</h3>
          <div className="muted" style={{ marginBottom: 8 }}>Back-of-envelope math beats hand-waving.</div>
          {NUMBERS.map(g => (
            <div key={g.group} className="cmp">
              <div className="cmp-t">{g.group}</div>
              {g.rows.map((r, i) => <div key={i} className="row"><span>{r[0]}</span><span className="v">{r[1]}</span></div>)}
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function EdgeInspector({ e, nodes, sim, step, setEdges, onDelete }) {
  const from = nodes.find(n => n.id === e.from), to = nodes.find(n => n.id === e.to)
  const flow = sim.flowOnEdge[e.id] || 0
  const reverse = () => setEdges(es => es.map(x => x.id === e.id
    ? { ...x, id: `${x.to}->${x.from}`, from: x.to, to: x.from } : x))
  return (
    <section>
      <h3>🔗 Connection</h3>
      <div className="muted" style={{ marginBottom: 10 }}>
        {from?.label} → {to?.label}
      </div>
      <div className="field">
        <label>Label</label>
        <input value={e.label || ''} placeholder="e.g. cache miss, write"
          onChange={ev => setEdges(es => es.map(x => x.id === e.id ? { ...x, label: ev.target.value } : x))} />
      </div>
      <div className="row"><span>Flow</span><span className="v">{fmt(flow)}/s</span></div>
      {step != null && <div className="row"><span>Step</span><span className="v">#{step}</span></div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn" style={{ flex: 1 }} onClick={reverse}>⇄ Reverse</button>
        <button className="btn danger" style={{ flex: 1 }} onClick={onDelete}>Delete</button>
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>
        Labels render on the diagram and survive PNG/JSON export — useful for annotating a walkthrough.
      </div>
    </section>
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
            {sugs.length} finding{sugs.length > 1 ? 's' : ''}. Every one has a quick fix that drops the component in and wires it into the right place.
          </div>
          {actionable.length > 1 && (
            <button className="btn primary" style={{ width: '100%', marginBottom: 10 }} onClick={onApplyAll}>
              ⚡ Quick fix all {actionable.length}
            </button>
          )}
          {sugs.map(s => (
            <div key={s.id} className={`sug ${s.severity}`}>
              <div className="sug-t">
                <span>{s.icon} {s.title}</span>
                <span className={`pill ${s.severity === 'high' ? 'bad' : s.severity === 'med' ? 'warn' : 'ok'}`}>{s.severity}</span>
              </div>
              <div className="sug-d">{s.detail}</div>
              <button className="btn quick" style={{ marginTop: 7 }} onClick={() => onApply(s)}>
                ⚡ {applied.includes(s.id) ? 'Quick fix again' : 'Quick fix'}
              </button>
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

// Number the connections in request order (BFS from traffic sources) — the
// numbered-walkthrough style used in system design write-ups.
function flowSteps(nodes, edges) {
  const map = {}
  const outAdj = {}
  for (const e of edges) (outAdj[e.from] ||= []).push(e)
  const seen = new Set()
  let queue = nodes.filter(n => CATALOG[n.type]?.source).map(n => n.id)
  if (!queue.length && nodes.length) queue = [nodes[0].id]
  let step = 1
  while (queue.length) {
    const next = []
    for (const id of queue) {
      for (const e of (outAdj[id] || [])) {
        if (seen.has(e.id)) continue
        seen.add(e.id)
        map[e.id] = step++
        next.push(e.to)
      }
    }
    queue = [...new Set(next)]
  }
  for (const e of edges) if (!(e.id in map)) map[e.id] = step++
  return map
}
