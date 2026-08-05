import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { CATALOG, PALETTE_GROUPS } from './catalog.js'
import { TEMPLATES } from './templates.js'
import { simulate, capacityReport } from './sim.js'
import { review, applyAll, addComponent, insertBefore } from './advisor.js'
import { THEMES, readTheme, saveTheme, THEME_ORDER, THEME_LABEL } from './theme.js'
import { applyRequirement, undoRequirement, requirementEffect } from './requirements.js'
import { LESSON, COMPARISONS, QUIZ, NUMBERS, TIPS } from './learn.js'
import { costReport, nodeCost, money, HOURS, rightSizePlan, scaleAll, rightSizeReplicas, CURRENCIES, setCurrency, readCurrency, saveCurrency } from './pricing.js'
import { autoArrange } from './layout.js'
import { CLOUDS, CLOUD_MAP, cloudById, serviceName, readCloud, saveCloud } from './clouds.js'
import { FAULTS, FAULT_GROUPS, faultById, faultOnNode, pickTarget, compileFaults } from './faults.js'
import { describeArchitecture } from './describe.js'
import { countVisit, formatVisitors } from './visitors.js'
import { ABOUT, ABOUT_COMPARE } from './about.js'
import { buildReport } from './report.js'
import { diagnoseAll, diagnose, healthChip } from './health.js'
import { prepareSvgForExport } from './svgexport.js'
import { speechSupported, extractSpeech, chunkText, RATES, readRate, saveRate, pickVoice, listVoices,
  voicesByLanguage, readVoiceName, saveVoiceName, PROSODY, BLOCK_PAUSE_MS } from './speech.js'
import { BREAKDOWNS, BREAKDOWN_NAMES, breakdownFor } from './breakdown.js'
import { SCALING_NAMES, scalingFor, PRINCIPLES } from './scaling.js'
import { REPLICATION, ISOLATION, PARTITIONING, replicationEffects, isolationEffects, partitionEffects, quorumOverlaps } from './ddia.js'
import { DDIA_TRACK, DDIA_COMPARISONS } from './learn-ddia.js'
import { TOUR_STEPS, placeTooltip, stepsFor, shouldAutoStart, markSeen } from './tour.js'
import { ENGINES, CONSISTENCY, ENCODINGS, MULTI_WRITE, DELIVERY, STREAM_ROLE, physicalEffects, readFractionOf } from './ddia2.js'
import { buildInterview, report as interviewReport, STAGES } from './interview.js'
import * as LLM from './interview-llm.js'
import { matchConcepts, pickProbe, respond as interviewRespond } from './interview.js'

const NODE_W = 118, NODE_H = 46
// Default docked widths, so "restore" has something definite to go back to.
const PANEL_DEFAULT = { left: 168, right: 280 }
// Text box inside a node: starts after the glyph, stops short of the right
// edge. The replica badge sits on the corner above the label's cap height, so
// the title gets the full width.
const TITLE_W = NODE_W - 30 - 6
const SUB_W = NODE_W - 30 - 8
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
  const [tab, setTab] = useState('capacity')    // side panel: capacity | improve
  const [spotlight, setSpotlight] = useState(null)   // Breakdown tab: { id, ids } to isolate on canvas
  const [applied, setApplied] = useState([])    // ids of suggestions already applied
  const [theme, setTheme] = useState(readTheme) // 'dark' | 'light'
  const [steps, setSteps] = useState(true)      // numbered request-flow badges, on by default
  const [chaosUsed, setChaosUsed] = useState(false)
  const [cloud, setCloud] = useState(readCloud)   // generic | aws | gcp | azure | oci
  const [palQ, setPalQ] = useState('')            // palette search
  const palRef = useRef(null)
  const sideBodyRef = useRef(null)
  const [sideScrolled, setSideScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('archsim.palette.collapsed') || '{}') } catch { return {} }
  })
  const toggleGroup = key => setCollapsed(c => {
    const next = { ...c, [key]: !c[key] }
    try { localStorage.setItem('archsim.palette.collapsed', JSON.stringify(next)) } catch { /* private mode */ }
    return next
  })
  const [reqLog, setReqLog] = useState({})        // checklist index -> what it added
  // panel geometry: docked width, or floating window position
  const [panelW, setPanelW] = useState({ ...PANEL_DEFAULT })
  const [tourAt, setTourAt] = useState(null)
  const [a11y, setA11y] = useState(() => {
    try { return localStorage.getItem('archsim.a11y') === '1' } catch (e) { return false }
  })
  const [announce, setAnnounce] = useState('')      // polite live-region text
  const [maxed, setMaxed] = useState(null)          // 'left' | 'right' | null
  const [floatPanel, setFloatPanel] = useState({ left: null, right: null }) // {x,y,w,h} when detached
  const [faults, setFaults] = useState([])       // [{key, faultId, targetId, until}]
  const [visitors, setVisitors] = useState(null)
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1400 : window.innerWidth))
  const [currency, setCur] = useState(readCurrency)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const alerted = useRef({ drop: false, hot: false })
  const [drawer, setDrawer] = useState(null)     // 'left' | 'right' | null on small screens
  const compact = vw < 1100        // tablet and below: panels become drawers
  const mobile = vw < 700
  const resizeRef = useRef(null)
  const cloudInfo = cloudById(cloud)
  setCurrency(currency)

  useEffect(() => { saveCloud(cloud) }, [cloud])
  useEffect(() => { setCurrency(currency); saveCurrency(currency) }, [currency])

  // ---- notifications ----
  const notify = useCallback((msg, kind = 'info') => {
    const id = ++toastId.current
    setToasts(t => [...t.slice(-3), { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])
  useEffect(() => { countVisit().then(v => { if (v != null) setVisitors(v) }) }, [])
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize) }
  }, [])
  const T = THEMES[theme]

  useEffect(() => {
    sideBodyRef.current?.scrollTo({ top: 0 })
    setSideScrolled(false)
  }, [tab])

  useEffect(() => {
    document.documentElement.classList.toggle('a11y', a11y)
    try { localStorage.setItem('archsim.a11y', a11y ? '1' : '0') } catch (e) { /* private mode */ }
  }, [a11y])

  useEffect(() => { document.documentElement.dataset.theme = theme; saveTheme(theme) }, [theme])

  // "/" jumps to the component search, the way it does in most tools
  useEffect(() => {
    const onKey = e => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      palRef.current?.focus()
      palRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const svgRef = useRef(null)
  const drag = useRef(null)

  const downSet = useMemo(() => new Set(Object.keys(down)), [down])
  const fx = useMemo(() => compileFaults(faults, nodes, edges), [faults, nodes, edges])
  const sim = useMemo(() => simulate(nodes, edges, rps, downSet, fx), [nodes, edges, rps, downSet, fx])
  const cap = useMemo(() => capacityReport(nodes, sim), [nodes, sim])
  const sugs = useMemo(() => review(nodes, edges, rps), [nodes, edges, rps])
  const cost = useMemo(() => costReport(nodes, sim, cloudInfo.mult), [nodes, sim, cloudInfo])
  const baseSim = useMemo(() => (faults.length ? simulate(nodes, edges, rps) : sim), [faults, nodes, edges, rps, sim])
  const brief = useMemo(() => describeArchitecture({
    nodes, edges, sim, baseSim, cap, cost, sugs, faults, fx, rps, template, cloud, simOn,
  }), [nodes, edges, sim, baseSim, cap, cost, sugs, faults, fx, rps, template, cloud, simOn])

  // Warn once when the design crosses a threshold, and once when it recovers.
  useEffect(() => {
    if (!simOn || !nodes.length) { alerted.current = { drop: false, hot: false }; return }
    const dropping = sim.successRate < 0.995
    if (dropping && !alerted.current.drop) {
      notify(`Dropping traffic — success rate ${(sim.successRate * 100).toFixed(1)}%`, 'bad')
      alerted.current.drop = true
    } else if (!dropping && alerted.current.drop) {
      notify('Success rate back to normal', 'ok')
      alerted.current.drop = false
    }
    const hot = cap.rows.filter(r => r.util > 0.9)
    if (hot.length && !alerted.current.hot) {
      notify(`${hot[0].label} at ${(hot[0].util * 100).toFixed(0)}% — needs ${hot[0].needed}× replicas`, 'warn')
      alerted.current.hot = true
    } else if (!hot.length && alerted.current.hot) {
      alerted.current.hot = false
    }
  }, [simOn, sim.successRate, cap, nodes.length, notify])

  // ---- palette derivations ----
  const palHits = useMemo(() => {
    const q = palQ.trim().toLowerCase()
    if (!q) return []
    return PALETTE_GROUPS.flatMap(g => g.types).filter(t => {
      const c = CATALOG[t]
      return `${c.name} ${c.desc} ${(CLOUD_MAP[t] || []).join(' ')}`.toLowerCase().includes(q)
    })
  }, [palQ])
  const palHitSet = useMemo(() => new Set(palHits), [palHits])
  const typeCounts = useMemo(() => {
    const m = {}
    for (const n of nodes) m[n.type] = (m[n.type] || 0) + 1
    return m
  }, [nodes])
  const onCanvasTypes = useMemo(
    () => Object.keys(typeCounts).filter(t => CATALOG[t]).sort((a, b) => typeCounts[b] - typeCounts[a]),
    [typeCounts])

  // ---- panel resize / detach ----
  const startResize = (side, e) => {
    e.preventDefault()
    setMaxed(m => (m === side ? null : m))    // dragging is an implicit restore
    resizeRef.current = { side, startX: e.clientX, startW: panelW[side] }
    const move = ev => {
      const r = resizeRef.current
      if (!r) return
      const delta = r.side === 'left' ? ev.clientX - r.startX : r.startX - ev.clientX
      setPanelW(w => ({ ...w, [r.side]: Math.max(120, Math.min(640, r.startW + delta)) }))
    }
    const up = () => { resizeRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const toggleMax = side => setMaxed(m => (m === side ? null : side))
  const resetPanel = side => {
    setMaxed(m => (m === side ? null : m))
    setPanelW(w => ({ ...w, [side]: PANEL_DEFAULT[side] }))
  }
  const detach = side => setFloatPanel(f => ({
    ...f,
    [side]: f[side] ? null : { x: side === 'left' ? 90 : window.innerWidth - 420, y: 110, w: panelW[side] + 60, h: 460 },
  }))
  const startDragPanel = (side, e) => {
    if (e.target.closest('input,button,select,label')) return
    e.preventDefault()
    const start = { mx: e.clientX, my: e.clientY, ...floatPanel[side] }
    const move = ev => setFloatPanel(f => ({
      ...f, [side]: { ...f[side], x: start.x + ev.clientX - start.mx, y: Math.max(0, start.y + ev.clientY - start.my) },
    }))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---- requirements drive the diagram ----
  const toggleRequirement = (i, text) => {
    if (checks[i]) {
      const undo = undoRequirement(nodes, edges, reqLog[i])
      if (undo) {
        setNodes(undo.nodes); setEdges(undo.edges)
        if (undo.rps !== undefined) setRps(undo.rps)
      }
      setChecks(s => ({ ...s, [i]: false }))
      setReqLog(l => { const n = { ...l }; delete n[i]; return n })
      return
    }
    const r = applyRequirement(nodes, edges, text, rps)
    setChecks(s => ({ ...s, [i]: true }))
    if (r) {
      setNodes(r.nodes); setEdges(r.edges)
      if (r.rps) setRps(r.rps)
      setReqLog(l => ({ ...l, [i]: { added: r.added, scaled: r.scaled, prevRps: r.prevRps } }))
      if (r.focus) { setSel(r.focus); setHover(r.focus) }
      fitView(r.nodes)
      const added = r.added?.length
      notify(added ? `Requirement applied — added ${added} component${added > 1 ? 's' : ''}`
        : r.rps ? `Traffic set to ${r.rps >= 1000 ? (r.rps / 1000).toFixed(1) + 'k' : r.rps} rps from the estimate`
        : 'Requirement applied — scaled a tier', 'ok')
    }
  }

  // ---- chaos ----
  const injectFault = f => {
    const target = f.scope === 'node' ? (nodes.find(n => n.id === sel) || pickTarget(f, nodes, sim, edges)) : null
    if (f.scope === 'node' && !target) return
    setSimOn(true); setChaosUsed(true)
    setFaults(fs => [...fs, {
      key: `${f.id}_${Date.now()}`, faultId: f.id, targetId: target?.id || null,
      until: Date.now() + f.secs * 1000,
    }])
    if (target) setHover(target.id)
    notify(`${f.icon} ${f.name} injected${target ? ` on ${target.label}` : ''} — heals in ${f.secs}s`, 'bad')
  }
  const clearFault = key => setFaults(fs => fs.filter(x => x.key !== key))
  const recoverAll = () => {
    if (faults.length) notify(`Recovered ${faults.length} fault${faults.length > 1 ? 's' : ''}`, 'ok')
    setFaults([]); setDown({}); setChaosOn(false)
  }

  // ---- capacity scaling from the cost panel ----
  const rightSize = () => {
    const plan = rightSizePlan(nodes, sim, cloudInfo.mult)
    if (!plan.changes.length) return
    const map = Object.fromEntries(plan.changes.map(c => [c.id, c.to]))
    setNodes(ns => ns.map(n => (map[n.id] ? { ...n, replicas: map[n.id] } : n)))
    notify(`Right-sized ${plan.changes.length} tier${plan.changes.length > 1 ? 's' : ''} · ${plan.delta < 0 ? 'saving ' + money(-plan.delta) : '+' + money(plan.delta)}/mo`, 'ok')
  }
  const scaleEverything = factor => {
    setNodes(ns => scaleAll(ns, factor))
    notify(factor >= 1 ? `Scaled every tier up ${factor}×` : `Scaled every tier down to ${Math.round(factor * 100)}%`, 'info')
  }
  const setReplicas = (id, next) =>
    setNodes(ns => ns.map(n => (n.id === id ? { ...n, replicas: Math.max(1, Math.min(64, next)) } : n)))

  // Every unhealthy tier, worst first — shared by the capacity panel, the
  // hover card and the exported document.
  const health = useMemo(() => diagnoseAll(cap, nodes, sim, fx, faults), [cap, nodes, sim, fx, faults])

  // The one-click fix for a diagnosis.
  const healFix = d => {
    const n = nodes.find(x => x.id === d.id)
    if (!n) return
    if (d.fix.kind === 'recover') {
      setFaults(fs => fs.filter(x => x.targetId !== d.id))
      setDown(dn => { const next = { ...dn }; delete next[d.id]; return next })
      notify(`${n.label} is back online`, 'ok')
      return
    }
    setNodes(ns => ns.map(x => (x.id === d.id ? { ...x, replicas: d.fix.to } : x)))
    notify(`${n.label} scaled ${n.replicas || 1}× → ${d.fix.to}× — ${d.level === 'spof' ? 'no longer a single point of failure' : 'back inside its capacity'}`, 'ok')
  }

  // Apply the fix a fault suggests, on the node it is hurting.
  const mitigate = (row, fault) => {
    const n = nodes.find(x => x.id === row.id)
    if (!n || !fault) return
    const f = fault.fix || { kind: 'scale' }
    if (f.kind === 'restore') {
      const gone = faults.filter(x => x.faultId === fault.id)
      setFaults(fs => fs.filter(x => x.faultId !== fault.id))
      notify(`Restored ${gone.length || 1} severed link${gone.length > 1 ? 's' : ''} — ${fault.name} cleared`, 'ok')
      return
    }
    if (f.kind === 'insert' || f.kind === 'attach') {
      const r = f.kind === 'insert'
        ? insertBefore(nodes, edges, n.id, f.type)
        : addComponent(nodes, edges, f.type, undefined)
      if (!r) return
      setNodes(r.nodes); setEdges(r.edges)
      if (r.focus) { setSel(r.focus); setHover(r.focus) }
      notify(`Added ${CATALOG[f.type].name} to mitigate ${fault.name}`, 'ok')
      return
    }
    // scale: size for the load it is actually seeing, degraded capacity included
    const spec = CATALOG[n.type]
    const degraded = (fx.node?.[n.id]?.capMul ?? 1) || 0.25
    const target = Math.max((n.replicas || 1) + 1,
      Math.min(64, Math.ceil((row.in || 0) / (spec.cap * 0.55 * Math.max(degraded, 0.15)))))
    setNodes(ns => ns.map(x => (x.id === n.id ? { ...x, replicas: target } : x)))
    notify(`${n.label} scaled to ${target}× to ride out ${fault.name}`, 'ok')
  }

  const arrange = () => {
    if (!nodes.length) return
    const laid = autoArrange(nodes, edges)
    setNodes(laid)
    requestAnimationFrame(() => fitView(laid))
    notify('Diagram auto-arranged into layers', 'info')
  }

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
    const fit = Math.min(r.width / (maxX - minX), r.height / (maxY - minY))
    // never shrink below a readable scale — pan instead of squinting
    const k = Math.min(1.2, Math.max(0.62, Math.min(fit, 1.2)))
    const cx = fit >= k ? (r.width - (maxX - minX) * k) / 2 : 0
    const cy = Math.max(0, (r.height - (maxY - minY) * k) / 2)
    setView({ k, x: cx - minX * k, y: cy - minY * k })
  }, [])

  const applyOne = s => {
    const r = s.apply?.(nodes, edges)
    if (!r) return
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, s.id])
    if (r.focus) { setSel(r.focus); setHover(r.focus) }
    fitView(r.nodes)
    notify(`⚡ ${s.title}`, 'ok')
  }
  const applyEvery = () => {
    const actionable = sugs.filter(s => s.apply)
    const r = applyAll(actionable, nodes, edges)
    setNodes(r.nodes); setEdges(r.edges)
    setApplied(a => [...a, ...actionable.map(s => s.id)])
    if (r.focus) setSel(r.focus)
    fitView(r.nodes)
    notify(`⚡ Applied ${actionable.length} quick fix${actionable.length > 1 ? 'es' : ''}`, 'ok')
  }

  // animation + chaos + recovery loop
  useEffect(() => {
    if (!simOn) return
    const h = setInterval(() => {
      setTick(t => t + 1)
      setFaults(fs => {
        const now = Date.now()
        const keep = fs.filter(f => f.until > now)
        return keep.length === fs.length ? fs : keep
      })
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

  // Touch devices can't use HTML5 drag — tapping a component drops it in the middle.
  const addAtCentre = type => {
    if (!CATALOG[type] || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const p = toWorld(r.left + r.width / 2, r.top + r.height / 2)
    const id = nid(type)
    setNodes(ns => [...ns, { id, type, label: CATALOG[type].name, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, replicas: 1 }])
    setSel(id)
    if (compact) setDrawer(null)
  }

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
  const pinch = useRef(null)
  const pointers = useRef(new Map())

  const onCanvasDown = e => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(p2.x - p1.x, p2.y - p1.y), k: view.k }
      drag.current = null
      return
    }
    setSel(null); setSelEdge(null)
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }
  }
  const onMove = e => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()]
      const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const k = Math.min(2.5, Math.max(0.3, pinch.current.k * (d2 / (pinch.current.d || 1))))
      const r = svgRef.current.getBoundingClientRect()
      const mx = (p1.x + p2.x) / 2 - r.left, my = (p1.y + p2.y) / 2 - r.top
      setView(v => ({ k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }))
      return
    }
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
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
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
    setSpotlight(null)
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
    notify(`Loaded ${t.name} — ${t.nodes.length} components at ${t.rps >= 1000 ? (t.rps / 1000).toFixed(1) + 'k' : t.rps} rps`, 'info')
    setAnnounce(`Loaded ${t.name}. ${t.nodes.length} components, ${t.edges.length} connections, simulating ${t.rps} requests per second.`)
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
  // Rasterise the canvas once; both the PNG export and the documents use it.
  // A cloned SVG carries no stylesheet, so anything the CSS was responsible for
  // has to be written onto the clone as presentation attributes — otherwise the
  // curved connectors default to fill:black and the export fills with blobs.
  const renderPNG = () => new Promise(resolve => {
    if (!svgRef.current || !nodes.length) return resolve(null)
    const svg = svgRef.current.cloneNode(true)
    const size = prepareSvgForExport(svg, nodes)
    if (!size) return resolve(null)
    const { width, height } = size

    const s = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = width; c.height = height
      const g = c.getContext('2d')
      g.fillStyle = T.canvasBg; g.fillRect(0, 0, width, height)
      g.drawImage(img, 0, 0, width, height)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)))
  })

  const exportPNG = async () => {
    const png = await renderPNG()
    if (png) dl(png, 'archsim-design.png')
  }

  // PDF / DOCX / DOC. The renderers are code-split, so nothing heavy loads
  // until someone actually asks for a document.
  const [exporting, setExporting] = useState(null)
  const exportDocument = async kind => {
    if (!nodes.length) { notify('Nothing to export yet — load a template or draw a design first', 'warn'); return }
    setExporting(kind)
    try {
      const report = buildReport({ nodes, edges, sim, baseSim, cap, cost, sugs, faults, fx, rps, template, cloud, currency, checks })
      const image = await renderPNG()
      const ex = await import('./exporters.js')
      if (kind === 'pdf') await ex.exportPdf(report, image)
      else if (kind === 'docx') await ex.exportDocx(report, image)
      else ex.exportDoc(report, image)
      notify(`${kind.toUpperCase()} exported — ${report.sections.length} sections, ${nodes.length} components`, 'ok')
    } catch (err) {
      notify(`Export failed: ${err.message}`, 'bad')
    } finally {
      setExporting(null)
    }
  }
  const onExportPick = e => {
    const v = e.target.value
    e.target.value = ''
    if (v === 'png') exportPNG()
    else if (v === 'json') exportJSON()
    else if (v) exportDocument(v)
  }
  const dl = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

  const selNode = nodes.find(n => n.id === sel)
  const selEdgeObj = edges.find(e => e.id === selEdge)
  const hoverNode = nodes.find(n => n.id === hover)
  const dots = simOn ? edgeDots(edges, nodes, sim, tick) : []
  const stepMap = useMemo(() => (steps ? flowSteps(nodes, edges) : {}), [steps, nodes, edges])

  // neighbours of the hovered node — used to dim everything else
  const neighbours = useMemo(() => {
    // spotlight from the Breakdown tab wins over hover
    if (spotlight) return new Set(spotlight.ids)
    if (!hover) return null
    const s = new Set([hover])
    for (const e of edges) {
      if (e.from === hover) s.add(e.to)
      if (e.to === hover) s.add(e.from)
    }
    return s
  }, [hover, edges, spotlight])

  return (
    <div className={`app ${compact ? 'compact' : ''} ${mobile ? 'mobile' : ''}`}>
      <a className="skip-link" href="#analysis">Skip to the written analysis</a>
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      <header className="toolbar" role="banner">
        <div className="logo">Arch<span>Sim</span></div>
        {compact && (
          <>
            <button className={`btn ${drawer === 'left' ? 'active' : ''}`} onClick={() => setDrawer(d => d === 'left' ? null : 'left')}>☰</button>
            <button className={`btn ${drawer === 'right' ? 'active' : ''}`} onClick={() => setDrawer(d => d === 'right' ? null : 'right')}>▤</button>
          </>
        )}
        <select className="btn" data-tour="templates" value="" onChange={e => loadTemplate(e.target.value)}>
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
        <button className={`btn ${simOn ? 'active' : ''}`} data-tour="simulate" onClick={() => setSimOn(s => !s)}>{simOn ? '⏸ Stop' : '▶ Simulate'}</button>
        <button className={`btn ${chaosOn ? 'danger' : ''}`} data-tour="chaos" onClick={() => { setChaosOn(c => !c); setChaosUsed(true) }} title="Randomly kills nodes while simulating; they auto-recover in 6s">Chaos {chaosOn ? 'ON' : 'off'}</button>
        <button className={`btn ${tab === 'improve' ? 'active' : ''}`} data-tour="improve" onClick={() => { setTab(t => t === 'improve' ? 'capacity' : 'improve'); setSel(null) }}
          title="Review the design and suggest components to add, wired in automatically">
          ✨ Improve{sugs.length ? ` (${sugs.length})` : ''}
        </button>
        <div className="rps" data-tour="traffic">
          <span>Traffic</span>
          <input type="range" min={2} max={6} step={0.05} value={Math.log10(rps)} onChange={e => setRps(Math.round(10 ** +e.target.value))} />
          <b>{fmt(rps)} rps</b>
        </div>
        <select className={`btn ${cloud !== 'generic' ? 'active' : ''}`} value={cloud} onChange={e => setCloud(e.target.value)}
          title="Show the equivalent managed service on each cloud, and price accordingly">
          {CLOUDS.map(c => <option key={c.id} value={c.id}>{c.id === 'generic' ? '☁ Generic' : '☁ ' + c.name}</option>)}
        </select>
        <select className="btn" value={currency} onChange={e => setCur(e.target.value)}
          title="Display costs in this currency (static conversion from USD list prices)">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol.trim()} {c.code}</option>)}
        </select>
        <button className={`btn ${steps ? 'active' : ''}`} onClick={() => setSteps(s => !s)}
          title="Number the connections in request order, like a walkthrough diagram">①②③ Steps</button>
        <div className="spacer" />
        {visitors != null && (
          <span className="visitors" title={`${visitors.toLocaleString()} visits to this studio`}>
            👥 {formatVisitors(visitors)}
          </span>
        )}
        <button className="btn"
          onClick={() => setTheme(t => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length])}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {THEME_LABEL[theme]}
        </button>
        <button className="btn" data-tour="arrange" onClick={arrange} title="Auto-arrange into clean left-to-right layers with fewer crossing lines">⧉ Arrange</button>
        <button className="btn" onClick={() => fitView(nodes)} title="Fit the whole diagram in view">⤢ Fit</button>
        <select className={`btn ${exporting ? 'active' : ''}`} data-tour="export" value="" onChange={onExportPick} disabled={!!exporting}
          title="Export the design — documents include every table, finding and figure on screen">
          <option value="">{exporting ? `⏳ Building ${exporting.toUpperCase()}…` : '⤓ Export…'}</option>
          <optgroup label="Full architecture document">
            <option value="pdf">📄 PDF report</option>
            <option value="docx">📝 Word document (.docx)</option>
            <option value="doc">📝 Word / Docs (.doc)</option>
          </optgroup>
          <optgroup label="Raw">
            <option value="png">🖼 Diagram (.png)</option>
            <option value="json">⌗ Design (.json)</option>
          </optgroup>
        </select>
        <label className="btn">JSON ↑<input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} /></label>
        <button className="btn" onClick={clearAll}>Clear</button>
        <button className="btn" data-tour="help" onClick={() => setTourAt(0)}
          title="Replay the guided tour of the app">? Tour</button>
        <button className={`btn ${a11y ? 'active' : ''}`} data-tour="a11y" onClick={() => setA11y(v => !v)}
          aria-pressed={a11y}
          title="Screen-reader mode: a text equivalent of the diagram, stronger focus outlines and no motion">
          ♿ {a11y ? 'A11y on' : 'A11y'}
        </button>
      </header>

      <Tour at={tourAt} setAt={setTourAt} setTab={setTab} loadTemplate={loadTemplate} />

      <div className="body">
        <nav aria-label="Components" data-tour="palette" className={`palette ${floatPanel.left ? 'floating' : ''} ${maxed === 'left' ? 'maxed' : ''} ${compact ? 'drawer left' : ''} ${compact && drawer === 'left' ? 'open' : ''}`}
          style={compact ? undefined : floatPanel.left
            ? { left: floatPanel.left.x, top: floatPanel.left.y, width: floatPanel.left.w, height: floatPanel.left.h }
            : maxed === 'left' ? undefined            // width comes from .maxed, so it stays responsive
            : { width: panelW.left }}>
          <div className="panel-bar" onPointerDown={e => floatPanel.left && startDragPanel('left', e)}>
            <span>⠿ Components</span>
            <span className="panel-bar-btns">
              {!compact && !floatPanel.left && (
                <button className="panel-max" onClick={() => toggleMax('left')}
                  onDoubleClick={() => resetPanel('left')}
                  title={maxed === 'left' ? 'Restore to the default width' : 'Maximise this panel'}>
                  {maxed === 'left' ? '⤡ Restore' : '⤢ Max'}
                </button>
              )}
              <button onClick={() => (compact ? setDrawer(null) : detach('left'))}
                title={compact ? 'Close' : floatPanel.left ? 'Dock panel' : 'Detach into a floating window'}>
                {compact ? '✕ Close' : floatPanel.left ? '⇤ Dock' : '⧉ Float'}
              </button>
            </span>
          </div>
          <div className="pal-search-row">
            <input className="pal-search" ref={palRef} value={palQ}
              onChange={e => setPalQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setPalQ(''); e.currentTarget.blur() }
                if (e.key === 'Enter' && palHits.length) { addAtCentre(palHits[0]); setPalQ('') }
              }}
              aria-label="Search components"
              placeholder={`Search ${Object.keys(CATALOG).length} components…  /`} />
            {palQ && (
              <button className="pal-clear" onClick={() => { setPalQ(''); palRef.current?.focus() }}
                aria-label="Clear search">✕</button>
            )}
          </div>
          {palQ && (
            <div className="pal-hint">
              {palHits.length
                ? <>{palHits.length} match{palHits.length === 1 ? '' : 'es'} · <b>Enter</b> adds {CATALOG[palHits[0]].name}</>
                : <>No component matches “{palQ}”</>}
            </div>
          )}

          {/* What is already on the canvas — the fastest way to add another one */}
          {!palQ && onCanvasTypes.length > 0 && (
            <div className="pal-group">
              <button className="pal-h" aria-expanded={!collapsed.__used}
                onClick={() => toggleGroup('__used')}>
                <span className="pal-caret">{collapsed.__used ? '▸' : '▾'}</span>
                On canvas
                <span className="pal-count">{onCanvasTypes.length}</span>
              </button>
              {!collapsed.__used && (
                <div className="pal-list">
                  {onCanvasTypes.map(t => (
                    <PalItem key={'u' + t} type={t} cloud={cloud} cloudInfo={cloudInfo}
                      onAdd={addAtCentre} count={typeCounts[t]} />
                  ))}
                </div>
              )}
            </div>
          )}

          {PALETTE_GROUPS.map(g => {
            const types = palQ ? g.types.filter(t => palHitSet.has(t)) : g.types
            if (!types.length) return null
            const open = palQ ? true : !collapsed[g.label]
            return (
              <div key={g.label} className="pal-group">
                <button className="pal-h" aria-expanded={open}
                  onClick={() => !palQ && toggleGroup(g.label)}>
                  <span className="pal-caret">{open ? '▾' : '▸'}</span>
                  {g.label}
                  <span className="pal-count">{types.length}</span>
                </button>
                {open && (
                  <div className="pal-list">
                    {types.map(t => (
                      <PalItem key={t} type={t} cloud={cloud} cloudInfo={cloudInfo}
                        onAdd={addAtCentre} count={typeCounts[t]} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        {!compact && !floatPanel.left && <div className="splitter" onPointerDown={e => startResize('left', e)} onDoubleClick={() => resetPanel('left')} title="Drag to resize · double-click to reset" />}

        <main id="canvas" className="canvas-wrap" aria-label="Architecture canvas" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
          {template && (
            <div className="tpl-header">
              <span className="tpl-header-name">{template.name}</span>
              {template.tagline && <span className="tpl-header-tag">{template.tagline}</span>}
              <span className="tpl-header-meta">
                {nodes.length} components · {rps >= 1000 ? (rps / 1000).toFixed(rps >= 10000 ? 0 : 1) + 'k' : rps} rps
              </span>
              <button className="tpl-header-x" title="Clear the canvas" onClick={blank}>✕</button>
            </div>
          )}
          <svg ref={svgRef} data-tour="canvas" onPointerDown={onCanvasDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} style={{ touchAction: 'none' }}>
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
                <Node key={n.id} n={n} sim={sim} simOn={simOn} t={T} cloud={cloud}
                  selected={sel === n.id}
                  hovered={hover === n.id}
                  dimmed={neighbours ? !neighbours.has(n.id) : false}
                  onDown={onNodeDown} onPortDown={onPortDown}
                  onEnter={() => setHover(n.id)} onLeave={() => setHover(h => (h === n.id ? null : h))} />
              ))}
            </g>
          </svg>

          {hoverNode && !selNode && (
            <HoverCard n={hoverNode} sim={sim} simOn={simOn} cloud={cloud} cloudName={cloudInfo.name}
              diag={health.find(h => h.id === hoverNode.id) || null} />
          )}

          {simOn && (
            <div className="statbar">
              <div className="chip">p50 <b>{Math.round(sim.p50)} ms</b></div>
              <div className="chip">p95 <b>{Math.round(sim.p95)} ms</b></div>
              <div className="chip">p99 <b>{Math.round(sim.p99)} ms</b></div>
              <div className={`chip ${sim.successRate < 0.99 ? 'bad' : 'ok'}`}>success <b>{(sim.successRate * 100).toFixed(2)}%</b></div>
              <div className="chip">availability <b>{(sim.sysAvail * 100).toFixed(3)}%</b></div>
              <div className="chip" title="Estimated monthly cloud cost at this traffic level">cost <b>{money(cost.total)}/mo</b></div>
              {sim.totalDropped > 1 && <div className="chip bad">dropping <b>{fmt(sim.totalDropped)}/s</b></div>}
              {Object.keys(down).length > 0 && <div className="chip bad">down: <b>{Object.keys(down).length}</b></div>}
              {faults.length > 0 && <div className="chip bad">faults <b>{faults.length}</b></div>}
            </div>
          )}
          {nodes.length === 0 && <div className="hint">Blank canvas — drag components in from the left, wire them from a node's ● port, or pick a template ↑</div>}
          {nodes.length > 0 && <div className="hint">Drag ● port to connect · click a connection to label it · scroll to zoom · drag canvas to pan · Del removes selection</div>}
          <CanvasDescription nodes={nodes} edges={edges} rps={rps} template={template} />
        </main>

        {!compact && !floatPanel.right && <div className="splitter" onPointerDown={e => startResize('right', e)} onDoubleClick={() => resetPanel('right')} title="Drag to resize · double-click to reset" />}

        <aside id="analysis" aria-label="Analysis" className={`side ${floatPanel.right ? 'floating' : ''} ${maxed === 'right' ? 'maxed' : ''} ${compact ? 'drawer right' : ''} ${compact && drawer === 'right' ? 'open' : ''}`}
          style={compact ? undefined : floatPanel.right
            ? { left: floatPanel.right.x, top: floatPanel.right.y, width: floatPanel.right.w, height: floatPanel.right.h }
            : maxed === 'right' ? undefined
            : { width: ['learn', 'breakdown', 'scale'].includes(tab) ? Math.max(panelW.right, 430) : panelW.right }}>
          <div className="panel-bar" onPointerDown={e => floatPanel.right && startDragPanel('right', e)}>
            <span>⠿ Analysis</span>
            <span className="panel-bar-btns">
              {!compact && !floatPanel.right && (
                <button className="panel-max" onClick={() => toggleMax('right')}
                  onDoubleClick={() => resetPanel('right')}
                  title={maxed === 'right' ? 'Restore to the default width' : 'Maximise this panel'}>
                  {maxed === 'right' ? '⤡ Restore' : '⤢ Max'}
                </button>
              )}
              <button onClick={() => (compact ? setDrawer(null) : detach('right'))}
                title={compact ? 'Close' : floatPanel.right ? 'Dock panel' : 'Detach into a floating window'}>
                {compact ? '✕ Close' : floatPanel.right ? '⇥ Dock' : '⧉ Float'}
              </button>
            </span>
          </div>
          <div className="tabs" role="tablist" aria-label="Analysis views" data-tour="analysis">
            {[
              ['brief', 'Brief', null, 'Written description of this architecture'],
              ['capacity', 'Capacity', null, 'Bottlenecks and the replicas each tier needs'],
              ['improve', 'Improve', sugs.length || null, 'Architecture advisor findings'],
              ['chaos', 'Chaos', faults.length || null, 'Inject faults and watch it degrade'],
              ['cost', 'Cost', money(cost.total), 'What this design costs to run'],
              ['scale', 'Scale', null, 'How this design scales to a billion users'],
              ['breakdown', 'Breakdown', null, 'Full written breakdown of the loaded design'],
              ['learn', 'Learn', `${doneSteps.filter(Boolean).length}/${LESSON.length}`, 'Guided lesson, comparisons and quiz'],
              ['interview', 'Interview', null, 'Mock system design interview on the loaded design'],
              ['about', 'About', null, 'What this simulator is and how it differs'],
            ].map(([key, label, badge, hint]) => (
              <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key}
                data-tour={`tab-${key}`}
                title={hint}
                className={`${tab === key ? 'on' : ''} ${key === 'chaos' && faults.length ? 'alarm' : ''}`}
                onClick={() => { setTab(key); if (key !== 'capacity' && key !== 'brief') setSel(null) }}>
                {label}
                {badge != null && <span className="tab-badge">{badge}</span>}
              </button>
            ))}
          </div>
          <div className="side-body" role="tabpanel" aria-labelledby={`tab-${tab}`}
            ref={sideBodyRef} onScroll={e => setSideScrolled(e.currentTarget.scrollTop > 240)}>
          {tab === 'scale' ? (
            <Scale template={template} focused={spotlight?.id || null}
              onFocus={setSpotlight} rps={rps} onSetRps={setRps}
              onLoadTemplate={name => {
                const i = TEMPLATES.findIndex(t => t.name === name)
                if (i >= 0) loadTemplate(String(i))
              }} />
          ) : tab === 'breakdown' ? (
            <Breakdown template={template} focused={spotlight?.id || null}
              onFocus={setSpotlight}
              onLoadTemplate={name => {
                const i = TEMPLATES.findIndex(t => t.name === name)
                if (i >= 0) loadTemplate(String(i))
              }} />
          ) : tab === 'about' ? (
            <About />
          ) : tab === 'brief' ? (
            <Brief brief={brief} />
          ) : tab === 'chaos' ? (
            <Chaos faults={faults} nodes={nodes} sel={sel} onInject={injectFault}
              onClear={clearFault} onRecoverAll={recoverAll} sim={sim} fx={fx} />
          ) : tab === 'cost' ? (
            <Cost cost={cost} onHover={setHover} empty={nodes.length === 0} cloud={cloudInfo}
              plan={rightSizePlan(nodes, sim, cloudInfo.mult)}
              onRightSize={rightSize} onScaleAll={scaleEverything} onSetReplicas={setReplicas} />
          ) : tab === 'interview' ? (
            <Interview template={template} />
          ) : tab === 'learn' ? (
            <Learn done={doneSteps} />
          ) : tab === 'improve' ? (
            <Advisor sugs={sugs} applied={applied} onApply={applyOne} onApplyAll={applyEvery}
              onHover={setHover} empty={nodes.length === 0} />
          ) : selNode ? <Inspector n={selNode} sim={sim} setNodes={setNodes} cloud={cloud} cloudMult={cloudInfo.mult} />
            : selEdgeObj ? (
              <EdgeInspector e={selEdgeObj} nodes={nodes} sim={sim} step={stepMap[selEdgeObj.id]}
                setEdges={setEdges} onDelete={() => { setEdges(es => es.filter(x => x.id !== selEdgeObj.id)); setSelEdge(null) }} />
            ) : (
            <section>
              <h3>Capacity report</h3>
              {cap.rows.length === 0 && <div className="empty">Nothing on the canvas yet. Load a template or drag components in, then hit ▶ Simulate.</div>}
              {cap.bottlenecks.length > 0 && (
                <div className="cap-alert">
                  ⚠️ <b>{cap.bottlenecks.length} bottleneck{cap.bottlenecks.length > 1 ? 's' : ''}</b> — {cap.bottlenecks.map(b => b.label).join(', ')}
                </div>
              )}
              {health.length > 0 && (
                <div className="health">
                  <div className="health-h">Needs attention ({health.length})</div>
                  {health.map(d => (
                    <div key={d.id} className={`diag ${d.level}`}
                      onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}>
                      <div className="diag-t">{d.icon} {d.title}</div>
                      <div className="diag-w">{d.why}</div>
                      <button className="btn quick" onClick={() => healFix(d)}>⚡ {d.fix.label}</button>
                    </div>
                  ))}
                </div>
              )}
              {cap.rows.slice(0, 12).map(r => {
                const rowFault = faults.length && (r.util > 0.75 || r.down || (sim.stats[r.id]?.dropped || 0) > 0.5 || faults.some(f => f.targetId === r.id))
                  ? faultOnNode(faults, r.id) : null
                return (
                <div key={r.id} className="cap-row">
                  <div className="t">
                    <span>{r.label}{r.down && <span className="pill bad">DOWN</span>}</span>
                    <span style={{ color: utilColor(r.util) }}>{(r.util * 100).toFixed(0)}%</span>
                  </div>
                  <div className="util-bar"><i style={{ width: `${Math.min(100, r.util * 100)}%`, background: utilColor(r.util) }} /></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {fmt(r.in)}/s in · {r.replicas}× replicas{r.needed > r.replicas ? ` · needs ${r.needed}×` : ''}
                  </div>
                  {rowFault && (
                    <div className="mitig">
                      <div className="mitig-t">{rowFault.icon} {rowFault.name} is hitting this</div>
                      <div className="mitig-h">{rowFault.hint}</div>
                      <button className="btn quick" onClick={() => mitigate(r, rowFault)}>
                        ⚡ {rowFault.fix.kind === 'restore' ? 'Restore the link'
                          : rowFault.fix.kind === 'scale' ? 'Add capacity'
                          : `Add ${CATALOG[rowFault.fix.type].name}`}
                      </button>
                    </div>
                  )}
                </div>
                )
              })}
            </section>
          )}

          {template && (
            <section>
              <h3>{template.name} — requirements</h3>
              <div className="muted" style={{ marginBottom: 6 }}>
                {template.tagline} — ticking a requirement adds the component it implies and wires it in.
              </div>
              {template.checklist.map((c, i) => {
                const eff = checks[i] ? null : requirementEffect(c, nodes, rps)
                return (
                  <label key={i} className="check">
                    <input type="checkbox" checked={!!checks[i]} onChange={() => toggleRequirement(i, c)} />
                    <span>
                      {c}
                      {eff && <em className="req-eff">{eff.hint || eff.label}</em>}
                      {checks[i] && reqLog[i] && <em className="req-eff done">✓ applied</em>}
                    </span>
                  </label>
                )
              })}
            </section>
          )}
          </div>
          {sideScrolled && (
            <button className="side-top" onClick={() => sideBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Back to top">↑ Top</button>
          )}
        </aside>
        {compact && drawer && <div className="scrim" onClick={() => setDrawer(null)} />}
      </div>

      <div className="toasts">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>

      <footer className="foot">
        <span>Curated &amp; built by <a href="https://www.linkedin.com/in/abhaybhuva/" target="_blank" rel="noopener noreferrer">Abhaykumar Bhuva ↗</a></span>
        <span className="foot-sep">·</span>
        <span>Built with <a href="https://www.anthropic.com/claude" target="_blank" rel="noopener noreferrer">Anthropic Claude ↗</a></span>
      </footer>
    </div>
  )
}

function Node({ n, sim, simOn, t, cloud, selected, hovered, dimmed, onDown, onPortDown, onEnter, onLeave }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const isDown = s?.down
  const util = s?.util || 0
  const svc = serviceName(n.type, cloud)
  const color = spec.color
  return (
    <g className={`node ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`} transform={`translate(${n.x},${n.y})`}
      onPointerDown={e => onDown(e, n)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ cursor: 'move', opacity: dimmed ? 0.32 : 1, transition: 'opacity .12s' }}>
      {hovered && <rect x="-4" y="-4" width={NODE_W + 8} height={NODE_H + 8} rx="13" fill="none" stroke={t.glow} strokeWidth="2" opacity="0.9" filter="url(#glow)" />}
      <rect className="body" width={NODE_W} height={NODE_H} rx="10"
        fill={isDown ? t.downFill : hovered ? t.nodeFillHover : t.nodeFill}
        stroke={isDown ? t.downStroke : hovered ? t.nodeStrokeHover : color}
        strokeWidth={hovered ? 2 : 1.5} opacity={isDown ? 0.9 : 1} />
      <text x="10" y="20" fontSize="13">{spec.glyph}</text>
      <text x="30" y="19" fontSize="10.5" fill={t.nodeText} fontWeight="600">{fit(n.label, TITLE_W, 10.5, true)}</text>
      <text x="30" y="33" fontSize="9" fill={t.nodeSub}>
        {fit(isDown ? 'CHAOS: instance lost'
          : `${n.replicas}× · ${svc || (spec.source ? 'source' : fmt(spec.cap * n.replicas) + ' rps cap')}`,
          SUB_W, 9)}
      </text>
      <title>{n.label} — {spec.name}{svc ? ` (${svc})` : ''}</title>
      {simOn && !spec.source && (
        <>
          <rect x="8" y={NODE_H - 7} width={NODE_W - 16} height="4" rx="2" fill={t.barTrack} />
          <rect x="8" y={NODE_H - 7} width={(NODE_W - 16) * Math.min(1, util)} height="4" rx="2" fill={utilColor(util)} />
        </>
      )}
      {(n.replicas || 1) > 1 && (
        <g>
          {/* sits on the corner rather than over the label, which it used to clip */}
          <circle cx={NODE_W - 4} cy="2" r="8.5" fill={t.nodeFill} />
          <circle cx={NODE_W - 4} cy="2" r="7.5" fill={color} />
          <text x={NODE_W - 4} y="5" fontSize="8.5" textAnchor="middle" fill={t.badgeText} fontWeight="700">{n.replicas}</text>
        </g>
      )}
      <circle cx={NODE_W} cy={NODE_H / 2} r="6" fill={t.wire} stroke={t.nodeFill} strokeWidth="2"
        style={{ cursor: 'crosshair' }} onPointerDown={e => onPortDown(e, n)} />
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
    <g className="edge" onPointerDown={ev => { ev.stopPropagation(); onSelect() }}
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

// Renders **bold** and [text](url) inside a generated line.
function RichLine({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return <>{parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p)
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]} ↗</a>
    return <span key={i}>{p}</span>
  })}</>
}

function About() {
  return (
    <section>
      <h3>About ArchSim</h3>
      <ReadAloud label="the about page">
      {ABOUT.map(sec => (
        <div key={sec.title} className="brief-sec">
          <div className="brief-h">{sec.title}</div>
          {sec.lines.map((l, i) => <p key={i} className="brief-p"><RichLine text={l} /></p>)}
        </div>
      ))}
      <div className="brief-sec">
        <div className="brief-h">Honestly compared</div>
        <div className="cmp about-cmp">
          <table>
            <thead><tr><th />{ABOUT_COMPARE.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {ABOUT_COMPARE.rows.map((r, i) => (
                <tr key={i}><td className="k">{r[0]}</td>{r.slice(1).map((v, j) => <td key={j}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {ABOUT_COMPARE.note && <div className="cmp-note">{ABOUT_COMPARE.note}</div>}
        </div>
      </div>
      </ReadAloud>
    </section>
  )
}

function Brief({ brief }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(brief.markdown); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }
  const download = () => {
    const blob = new Blob([brief.markdown], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'architecture-brief.md'; a.click()
  }
  return (
    <section>
      <h3>Architecture brief</h3>
      {brief.markdown && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={copy}>{copied ? '✓ Copied' : '⧉ Copy markdown'}</button>
          <button className="btn" onClick={download}>↓ .md</button>
        </div>
      )}
      <ReadAloud label="the architecture brief">
        {brief.sections.map(sec => (
          <div key={sec.title} className="brief-sec">
            <div className="brief-h">{sec.title}</div>
            {sec.lines.map((l, i) => <p key={i} className="brief-p"><RichLine text={l} /></p>)}
          </div>
        ))}
      </ReadAloud>
    </section>
  )
}

function Chaos({ faults, nodes, sel, onInject, onClear, onRecoverAll, sim, fx }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!faults.length) return
    const h = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(h)
  }, [faults.length])
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const selNode = nodes.find(n => n.id === sel)
  const blastRadius = Object.keys(fx.node || {}).length

  return (
    <section>
      <h3>Chaos engineering</h3>
      {!nodes.length ? (
        <div className="empty">Load a design first, then break it on purpose. Every fault runs for a
          few seconds and heals itself — watch success rate, p99 and availability while it does.</div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 8 }}>
            Node faults hit <b>{selNode ? selNode.label : 'the busiest sensible component'}</b>
            {!selNode && ' — select a node to aim them.'}
          </div>

          {faults.length > 0 && (
            <>
              <div className="chaos-live">
                <span>{faults.length} active · {blastRadius} component{blastRadius === 1 ? '' : 's'} affected</span>
                <button className="btn danger" onClick={onRecoverAll}>Recover all</button>
              </div>
              {faults.map(f => {
                const spec = faultById(f.faultId)
                const left = Math.max(0, Math.ceil((f.until - now) / 1000))
                return (
                  <div key={f.key} className="fault-live">
                    <span>{spec.icon} <b>{spec.name}</b>{f.targetId && byId[f.targetId] ? ` → ${byId[f.targetId].label}` : ''}</span>
                    <span className="fl-right">{left}s <button onClick={() => onClear(f.key)}>✕</button></span>
                  </div>
                )
              })}
              <div className="row" style={{ marginTop: 8 }}>
                <span>Success rate</span>
                <span className="v" style={{ color: sim.successRate < 0.99 ? 'var(--bad)' : 'var(--ok)' }}>
                  {(sim.successRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="row"><span>p95</span><span className="v">{Math.round(sim.p95)} ms</span></div>
              <div className="row"><span>p99</span><span className="v">{Math.round(sim.p99)} ms</span></div>
              <div className="row"><span>Availability</span><span className="v">{(sim.sysAvail * 100).toFixed(2)}%</span></div>
              {fx.cut?.size > 0 && <div className="row"><span>Severed links</span><span className="v">{fx.cut.size}</span></div>}
              {fx.rpsMul !== 1 && <div className="row"><span>Traffic multiplier</span><span className="v">{fx.rpsMul}×</span></div>}
            </>
          )}

          {FAULT_GROUPS.map(g => (
            <div key={g} style={{ marginTop: 14 }}>
              <h3>{g === 'Global' ? 'Global events' : `${g} chaos`}</h3>
              <div className="fault-grid">
                {FAULTS.filter(f => f.group === g).map(f => (
                  <button key={f.id} className="fault-btn" title={f.desc} onClick={() => onInject(f)}>
                    <span className="fb-ico">{f.icon}</span>
                    <span className="fb-name">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 10.5, marginTop: 12, lineHeight: 1.55 }}>
            Faults compile into capacity, latency and drop multipliers, severed links or a traffic
            multiplier, then feed straight back into the simulation. Everything auto-recovers.
          </div>
        </>
      )}
    </section>
  )
}

function Cost({ cost, onHover, empty, cloud, plan, onRightSize, onScaleAll, onSetReplicas }) {
  const [detail, setDetail] = useState(null)
  if (empty) return (
    <section>
      <h3>Running cost</h3>
      <div className="empty">Nothing to price yet. Add components and the estimate updates live — it reacts to both replica counts and the traffic actually flowing through each node.</div>
    </section>
  )
  const max = cost.rows[0]?.total || 1
  return (
    <section>
      <h3>Running cost</h3>
      <div className="cost-big">{money(cost.total)}<span>/month</span></div>
      <div className="cost-sub">
        {money(cost.hourly)}/hour · {money(cost.perMillion)} per million requests
        {cost.reqMillions > 0 && <> · {cost.reqMillions.toFixed(0)}M req/mo</>}
      </div>
      <div className="cost-split">
        <span>Fixed (instances, licences) <b>{money(cost.fixed)}</b></span>
        <span>Usage (per-request) <b>{money(cost.usage)}</b></span>
      </div>

      <h3 style={{ marginTop: 14 }}>Scale</h3>
      {plan?.changes?.length > 0 ? (
        <button className="btn primary" style={{ width: '100%', marginBottom: 6 }} onClick={onRightSize}>
          ⇅ Right-size {plan.changes.length} tier{plan.changes.length > 1 ? 's' : ''} ·{' '}
          {plan.delta < 0 ? `save ${money(-plan.delta)}/mo` : `+${money(plan.delta)}/mo`}
        </button>
      ) : (
        <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
          Every tier is already sized for about 55% utilization at this traffic.
        </div>
      )}
      {plan?.changes?.length > 0 && (
        <div className="muted" style={{ fontSize: 10.5, marginBottom: 8, lineHeight: 1.5 }}>
          {plan.changes.slice(0, 4).map(c => `${c.label} ${c.from}→${c.to}×`).join(' · ')}
          {plan.changes.length > 4 ? ` · +${plan.changes.length - 4} more` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => onScaleAll(0.5)}>▼ Scale down ½×</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => onScaleAll(2)}>▲ Scale up 2×</button>
      </div>
      <div className="muted" style={{ fontSize: 10.5, marginBottom: 4, lineHeight: 1.5 }}>
        Right-size targets ~55% utilization per tier — enough headroom for a spike and an instance loss.
        Scaling changes the simulation too, so watch p99 and success rate move with the bill.
      </div>

      <h3 style={{ marginTop: 14 }}>By area</h3>
      {cost.byGroup.map(([g, v]) => (
        <div key={g} className="row">
          <span>{g}</span>
          <span className="v">{money(v)} · {((v / cost.total) * 100).toFixed(0)}%</span>
        </div>
      ))}

      <h3 style={{ marginTop: 14 }}>Biggest line items</h3>
      {cost.rows.filter(r => r.total > 0).slice(0, 14).map(r => (
        <div key={r.id} className="cap-row" onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)}
          onClick={() => setDetail(detail === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
          <div className="t">
            <span>{r.label}</span>
            <span>{money(r.total)}</span>
          </div>
          <div className="util-bar"><i style={{ width: `${(r.total / max) * 100}%`, background: 'var(--accent)' }} /></div>
          <div className="cost-foot">
            <span>
              {r.typeName}
              {r.usage > 0 && <> · {money(r.fixed)} fixed + {money(r.usage)} usage</>}
            </span>
            {r.type !== 'client' && (
              <span className="repl" onClick={e => e.stopPropagation()}>
                <button title="Scale down" onClick={() => onSetReplicas(r.id, r.replicas - 1)}>−</button>
                <b>{r.replicas}×</b>
                <button title="Scale up" onClick={() => onSetReplicas(r.id, r.replicas + 1)}>+</button>
              </span>
            )}
          </div>
          {detail === r.id && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{r.rate.note}</div>}
        </div>
      ))}

      <div className="muted" style={{ fontSize: 10.5, marginTop: 10, lineHeight: 1.55 }}>
        Priced for <b>{cloud?.name || 'Generic'}</b>{cloud && cloud.mult !== 1 && <> (×{cloud.mult.toFixed(2)} vs AWS list)</>}.
        Order-of-magnitude on-demand US list prices, {HOURS} h/month, no reserved or committed-use discounts.
        Per-request costs scale with the traffic the simulation routes through each node, so raising the
        traffic slider or adding replicas moves this number immediately. Click a line item for its assumption.
      </div>
    </section>
  )
}

function Learn({ done }) {
  const [sub, setSub] = useState('steps')
  const [answers, setAnswers] = useState({})
  const [cq, setCq] = useState('')
  const doneCount = done.filter(Boolean).length
  const score = Object.entries(answers).filter(([i, a]) => QUIZ[+i].answer === a).length
  return (
    <section>
      <div className="tabs sub">
        {[['steps', 'Steps'], ['consistency', 'Consistency'], ['tips', 'Tips'], ['clouds', 'Clouds'], ['compare', 'Compare'], ['quiz', 'Quiz'], ['numbers', 'Numbers']].map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>

      {sub === 'steps' && (
        <>
          <h3>Design walkthrough</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            {LESSON.length} steps, checked against your canvas as you build. {doneCount}/{LESSON.length} done.
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

      {sub === 'consistency' && (
        <>
          <h3>Consistency, replication and partitioning</h3>
          <div className="muted" style={{ marginBottom: 10 }}>
            The simulator models how much a tier can take and how long it holds a request. It says nothing
            about whether a read can be stale or two writes can conflict — and those decide whether a
            distributed design is right. Each step here changes something on the canvas.
          </div>
          {DDIA_TRACK.map(part => (
            <div key={part.part} className="tip-g">
              <div className="tip-gh">{part.part}</div>
              {part.steps.map(st => (
                <div key={st.title} className="tip">
                  <div className="tip-t">{st.title}</div>
                  <div className="tip-w">{st.idea}</div>
                  <div className="tip-try">▸ {st.try}</div>
                </div>
              ))}
            </div>
          ))}
          {DDIA_COMPARISONS.map(c => (
            <div key={c.title} className="cmp">
              <div className="tip-gh">{c.title}</div>
              <table>
                <thead><tr><th />{c.cols.map(x => <th key={x}>{x}</th>)}</tr></thead>
                <tbody>
                  {c.rows.map((r, i) => (
                    <tr key={i}><td className="k">{r[0]}</td>{r.slice(1).map((v, j) => <td key={j}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {c.note && <div className="cmp-note">{c.note}</div>}
            </div>
          ))}
        </>
      )}

      {sub === 'tips' && (
        <>
          <h3>Popular tips &amp; tricks</h3>
          <div className="muted" style={{ marginBottom: 10 }}>
            {TIPS.reduce((n, g) => n + g.items.length, 0)} things that separate a design that reviews well from one that
            does not — each with something you can try on the canvas right now.
          </div>
          {TIPS.map(g => (
            <div key={g.group} className="tip-g">
              <div className="tip-gh">{g.group}</div>
              {g.items.map(t => (
                <div key={t.tip} className="tip">
                  <div className="tip-t">{t.tip}</div>
                  <div className="tip-w">{t.why}</div>
                  <div className="tip-try">▸ {t.try}</div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {sub === 'clouds' && (
        <>
          <h3>Multi-cloud service map</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Every building block and its managed equivalent on each cloud. Pick a cloud in the toolbar to
            label the diagram with these names and price it accordingly.
          </div>
          <input className="pal-search" style={{ marginBottom: 10 }} value={cq} onChange={e => setCq(e.target.value)}
            placeholder="Filter components or services…" />
          {PALETTE_GROUPS.map(g => {
            const q = cq.trim().toLowerCase()
            const types = g.types.filter(t => CLOUD_MAP[t] &&
              (!q || `${CATALOG[t].name} ${CLOUD_MAP[t].join(' ')}`.toLowerCase().includes(q)))
            if (!types.length) return null
            return (
              <div key={g.label} className="cmp">
                <div className="cmp-t">{g.label}</div>
                <table>
                  <thead><tr><th /><th>AWS</th><th>GCP</th><th>Azure</th><th>OCI</th></tr></thead>
                  <tbody>
                    {types.map(t => (
                      <tr key={t}>
                        <td className="k">{CATALOG[t].glyph} {CATALOG[t].name}</td>
                        {CLOUD_MAP[t].map((s, i) => <td key={i}>{s}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
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
      <div className="field">
        <label>Read / write mix</label>
        <input type="range" min="0" max="100" value={Math.round(readFractionOf(e) * 100)}
          onChange={ev => setEdges(es => es.map(x => x.id === e.id ? { ...x, readFrac: +ev.target.value / 100 } : x))} />
      </div>
      <div className="ddia-blurb">
        {Math.round(readFractionOf(e) * 100)}% reads, {100 - Math.round(readFractionOf(e) * 100)}% writes.
        Reads scale with replicas; writes only scale if there is more than one node accepting them.
      </div>

      <div className="field">
        <label>Encoding</label>
        <select value={e.encoding || ''} onChange={ev => setEdges(es => es.map(x => x.id === e.id ? { ...x, encoding: ev.target.value || undefined } : x))}>
          <option value="">Unspecified</option>
          {Object.keys(ENCODINGS).map(key => <option key={key} value={key}>{ENCODINGS[key].label}</option>)}
        </select>
      </div>
      {e.encoding && <div className="ddia-blurb">{ENCODINGS[e.encoding].blurb}</div>}
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

function HoverCard({ n, sim, simOn, cloud, cloudName, diag = null }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const svc = serviceName(n.type, cloud)
  return (
    <div className="hovercard">
      <div className="hc-title">{spec.glyph} {n.label}<span className="hc-type">{spec.name}</span></div>
      {svc && <div className="hc-svc">{cloudName}: <b>{svc}</b></div>}
      <div className="hc-desc">{spec.desc}</div>
      {!spec.source && (
        <div className="hc-stats">
          <span>{n.replicas || 1}× replicas</span>
          <span>{fmt(spec.cap * (n.replicas || 1))} rps capacity</span>
          <span>{spec.lat} ms base</span>
          {simOn && s && <span style={{ color: utilColor(s.util) }}>{(s.util * 100).toFixed(0)}% used</span>}
          <span>{money(nodeCost(n, s?.in || 0).total)}/mo</span>
          {simOn && s?.dropped > 0 && <span className="hc-drop">dropping {fmt(s.dropped)}/s</span>}
        </div>
      )}
      {diag && (
        <div className={`hc-diag ${diag.level}`}>
          <b>{diag.icon} {healthChip(diag)}</b>
          <span>Open the Capacity tab for the one-click fix: {diag.fix.label.toLowerCase()}.</span>
        </div>
      )}
    </div>
  )
}

function Inspector({ n, sim, setNodes, cloud, cloudMult = 1 }) {
  const spec = CATALOG[n.type]
  const s = sim.stats[n.id]
  const map = CLOUD_MAP[n.type]
  const setRepl = d => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, replicas: Math.max(1, Math.min(64, (x.replicas || 1) + d)) } : x))
  return (
    <section>
      <h3>{spec.glyph} {spec.name}</h3>
      <div className="muted" style={{ marginBottom: 10 }}>{spec.desc}</div>
      {map && (
        <div className="cloudmap">
          {['AWS', 'GCP', 'Azure', 'OCI'].map((c, i) => (
            <div key={c} className={`cm-row ${['aws', 'gcp', 'azure', 'oci'][i] === cloud ? 'on' : ''}`}>
              <span className="cm-k">{c}</span><span>{map[i]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="field">
        <label>Label</label>
        <input value={n.label} onChange={e => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, label: e.target.value } : x))} />
      </div>
      <ConsistencyFields n={n} setNodes={setNodes} />
      <ServiceFields n={n} set={patch => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, ...patch } : x))} />
      <StreamFields n={n} set={patch => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, ...patch } : x))} />
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
      {!spec.source && (() => {
        const c = nodeCost(n, s?.in || 0, cloudMult)
        return (
          <>
            <div className="row"><span>Cost</span><span className="v">{money(c.total)}/mo</span></div>
            <div className="muted" style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.5 }}>{c.rate.note}</div>
          </>
        )
      })()}
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

// Node labels are drawn into a fixed-width box, so trim by pixels rather than
// by character count — "WWW" and "iii" are not the same width.
const WIDE = new Set('MWmw@%'), NARROW = new Set('ijlt.,:;!|\'’ ()[]/')
const textWidth = (s, size, bold) => {
  let w = 0
  for (const ch of s) w += WIDE.has(ch) ? 0.86 : NARROW.has(ch) ? 0.30 : /[A-Z0-9]/.test(ch) ? 0.62 : 0.52
  return w * size * (bold ? 1.06 : 1)
}
const fit = (s, px, size, bold = false) => {
  s = String(s)
  if (textWidth(s, size, bold) <= px) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size, bold) > px) break
    out += ch
  }
  return out.trimEnd() + '…'
}

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

// One draggable component in the palette. Pulled out of the panel body so the
// row can carry its own affordances without making that JSX unreadable.
function PalItem({ type, cloud, cloudInfo, onAdd, count }) {
  const c = CATALOG[type]
  const svc = serviceName(type, cloud)
  return (
    <div className="pal-item" draggable role="button" tabIndex={0}
      onDragStart={e => e.dataTransfer.setData('type', type)}
      onClick={() => onAdd(type)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(type) } }}
      aria-label={`Add ${c.name}${count ? `, ${count} already on canvas` : ''}`}
      title={svc ? `${c.desc}\n\n${cloudInfo.name}: ${svc}` : c.desc}>
      <div className="pal-glyph" style={{ background: c.color + '33', border: `1px solid ${c.color}` }}>{c.glyph}</div>
      <div className="pal-txt">
        <span className="pal-name">{c.name}</span>
        {svc && <span className="pal-svc">{svc}</span>}
      </div>
      {count > 0 && <span className="pal-used" title={`${count} on the canvas`}>{count}</span>}
    </div>
  )
}

// A canvas is invisible to a screen reader — an SVG of boxes conveys nothing.
// This is the diagram as navigable text: what each component is, how many of
// it there are, and what it feeds. Always in the accessibility tree, never on
// screen.
function CanvasDescription({ nodes, edges, rps, template }) {
  if (!nodes.length) {
    return <div className="sr-only">The canvas is empty. Load a template from the toolbar, or add components from the Components list.</div>
  }
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const sources = nodes.filter(n => CATALOG[n.type]?.source)
  return (
    <div className="sr-only" role="region" aria-label="Diagram described as text">
      <h2>{template ? template.name : 'Current design'}, described</h2>
      <p>
        {nodes.length} components and {edges.length} connections, simulating {rps} requests per second.
        {sources.length ? ` Traffic enters at ${sources.map(n => n.label).join(', ')}.` : ''}
      </p>
      <h3>Components</h3>
      <ul>
        {nodes.map(n => {
          const c = CATALOG[n.type] || {}
          const feeds = edges.filter(e => e.from === n.id).map(e => byId[e.to]?.label).filter(Boolean)
          const fed = edges.filter(e => e.to === n.id).map(e => byId[e.from]?.label).filter(Boolean)
          return (
            <li key={n.id}>
              {n.label}, {c.name || n.type}
              {(n.replicas || 1) > 1 ? `, ${n.replicas} replicas` : ', single instance'}
              {fed.length ? `. Receives from ${fed.join(', ')}` : ''}
              {feeds.length ? `. Sends to ${feeds.join(', ')}` : '. Endpoint, sends to nothing'}.
            </li>
          )
        })}
      </ul>
      <h3>Connections</h3>
      <ul>
        {edges.map(e => (
          <li key={e.id}>{byId[e.from]?.label} to {byId[e.to]?.label}{e.label ? `, labelled ${e.label}` : ''}.</li>
        ))}
      </ul>
    </div>
  )
}

// Correctness, as editable properties. The simulator has always shown how much
// a store can take; this is where you say what it guarantees.
const STORE_TYPES = new Set(['sql', 'nosql', 'cache', 'search', 'blob', 'warehouse', 'lake'])

function ConsistencyFields({ n, setNodes }) {
  if (!STORE_TYPES.has(n.type)) return null
  const set = patch => setNodes(ns => ns.map(x => x.id === n.id ? { ...x, ...patch } : x))
  const rep = replicationEffects(n)
  const iso = isolationEffects(n)
  const part = partitionEffects(n)
  const quorumOk = rep.mode !== 'leaderless' || quorumOverlaps(rep.n, rep.w, rep.r)

  // .field is a flex row (label | control), so anything explanatory has to sit
  // outside it — inside, it gets squeezed into a third column one word wide.
  return (
    <>
      <div className="field">
        <label>Replication</label>
        <select value={rep.mode} onChange={e => set({ replication: e.target.value })}>
          {Object.keys(REPLICATION).map(k => <option key={k} value={k}>{REPLICATION[k].label}</option>)}
        </select>
      </div>
      <div className="ddia-blurb">{REPLICATION[rep.mode]?.blurb}</div>

      {rep.mode === 'leaderless' && (
        <>
          <div className="field">
            <label>Quorum — n / w / r</label>
            <div className="ddia-quorum">
              {[['quorumN', rep.n, 'n'], ['quorumW', rep.w, 'w'], ['quorumR', rep.r, 'r']].map(([k, v, lbl]) => (
                <label key={k}><span>{lbl}</span>
                  <input type="number" min="1" max="9" value={v}
                    onChange={e => set({ [k]: Math.max(1, Math.min(9, +e.target.value || 1)) })} />
                </label>
              ))}
            </div>
          </div>
          <div className={`ddia-verdict ${quorumOk ? 'good' : 'bad'}`}>
            {quorumOk
              ? `w + r = ${rep.w + rep.r} > n = ${rep.n}. Read and write sets overlap, so a read sees the newest write.`
              : `w + r = ${rep.w + rep.r}, not greater than n = ${rep.n}. A read can miss the write entirely and go backwards.`}
          </div>
        </>
      )}

      {(rep.mode === 'leader' || rep.mode === 'multi') && (
        <div className="field">
          <label>Replication lag (ms)</label>
          <input type="number" min="0" max="60000" value={rep.lag}
            onChange={e => set({ replicationLagMs: Math.max(0, +e.target.value || 0) })} />
        </div>
      )}

      {n.type === 'sql' && (
        <>
          <div className="field">
            <label>Isolation level</label>
            <select value={iso.level} onChange={e => set({ isolation: e.target.value })}>
              {Object.keys(ISOLATION).map(k => <option key={k} value={k}>{ISOLATION[k].label}</option>)}
            </select>
          </div>
          <div className="ddia-permits">
            {iso.permits.length === 0
              ? <div className="ddia-ok">Prevents every anomaly below. The cost is contention.</div>
              : <>
                  <div className="ddia-permits-h">Still permits</div>
                  <ul>{iso.permits.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </>}
          </div>
          {iso.trap && <div className="ddia-verdict bad">{iso.trap}</div>}
        </>
      )}

      <div className="field">
        <label>Partitioning</label>
        <select value={part.strategy} onChange={e => set({ partitioning: e.target.value })}>
          {Object.keys(PARTITIONING).map(k => <option key={k} value={k}>{PARTITIONING[k].label}</option>)}
        </select>
      </div>
      <div className="ddia-blurb">{PARTITIONING[part.strategy]?.blurb}</div>
      {part.strategy !== 'none' && (
        <>
          <div className="field">
            <label>Key skew</label>
            <input type="range" min="0" max="100" value={Math.round((n.keySkew ?? 0.2) * 100)}
              onChange={e => set({ keySkew: +e.target.value / 100 })} />
          </div>
          <div className={`ddia-verdict ${part.hotspotFactor > 2 ? 'bad' : 'good'}`}>
            Busiest partition takes about {part.hotspotFactor.toFixed(1)}× its fair share.
          </div>
        </>
      )}

      <PhysicalFields n={n} set={set} />

      {rep.notes.length > 0 && (
        <ul className="ddia-notes">{rep.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>
      )}
    </>
  )
}

// The first-run tour. A spotlight is just a hole in a dimmed overlay: an
// absolutely-positioned box with an enormous outset box-shadow. That avoids
// clip-path, which is patchy in older Safari.
function Tour({ at, setAt, setTab, loadTemplate }) {
  const steps = useMemo(() => (typeof document === 'undefined' ? TOUR_STEPS : stepsFor(document)), [at != null])
  const step = at == null ? null : steps[at]
  const tipRef = useRef(null)
  const [box, setBox] = useState(null)

  // Auto-start once, ever. Deliberately after a beat so the layout has settled
  // and we measure where things actually are, not where they start.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!shouldAutoStart(window.localStorage)) return
    const t = setTimeout(() => setAt(0), 600)
    return () => clearTimeout(t)
  }, [])

  // Side effects the step asks for, before we measure.
  useEffect(() => {
    if (!step) return
    if (step.tab) setTab(step.tab)
    if (step.load) loadTemplate(String(TEMPLATES.findIndex(t => t.name.includes(step.load))))
  }, [at])

  useEffect(() => {
    if (!step) return
    const measure = () => {
      const el = step.target && document.querySelector(step.target)
      const r = el?.getBoundingClientRect()
      const tip = tipRef.current?.getBoundingClientRect()
      const vp = { w: window.innerWidth, h: window.innerHeight }
      const t = r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      setBox({ target: t, ...placeTooltip(t, { w: tip?.width || 340, h: tip?.height || 190 }, vp) })
    }
    measure()
    const id = setTimeout(measure, 60)     // after the tab switch paints
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [at])

  const end = () => { markSeen(window.localStorage); setAt(null) }
  const next = () => (at >= steps.length - 1 ? end() : setAt(at + 1))
  const prev = () => setAt(Math.max(0, at - 1))

  useEffect(() => {
    if (at == null) return
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); end() }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    tipRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [at, steps.length])

  if (at == null || !step) return null
  const t = box?.target

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-scrim" onClick={end} />
      {t && (
        <div className="tour-hole" style={{ left: t.x - 6, top: t.y - 6, width: t.w + 12, height: t.h + 12 }} />
      )}
      <div ref={tipRef} tabIndex={-1}
        className={`tour-tip ${box?.placement || 'center'}`}
        style={{ left: box?.x ?? 0, top: box?.y ?? 0 }}>
        <div className="tour-count">Step {at + 1} of {steps.length}</div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => <span key={s.id} className={i === at ? 'on' : ''} />)}
        </div>
        <div className="tour-btns">
          <button className="tour-skip" onClick={end}>Skip tour</button>
          <span className="spacer" />
          {at > 0 && <button className="tour-back" onClick={prev}>Back</button>}
          <button className="tour-next" onClick={next}>{at >= steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}

// Storage engine and consistency guarantee — the two that move the simulated
// numbers rather than only the advice.
function PhysicalFields({ n, set }) {
  const ph = physicalEffects(n)
  const pct = v => (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%'
  return (
    <>
      <div className="field">
        <label>Storage engine</label>
        <select value={n.engine || ''} onChange={e => set({ engine: e.target.value || undefined })}>
          <option value="">Unspecified</option>
          {Object.keys(ENGINES).map(k => <option key={k} value={k}>{ENGINES[k].label}</option>)}
        </select>
      </div>
      {n.engine && (
        <>
          <div className="ddia-blurb">{ENGINES[n.engine].blurb}</div>
          <div className="ddia-blurb"><b>Write amplification.</b> {ENGINES[n.engine].writeAmp}</div>
        </>
      )}

      <div className="field">
        <label>Consistency</label>
        <select value={n.consistency || ''} onChange={e => set({ consistency: e.target.value || undefined })}>
          <option value="">Unspecified</option>
          {Object.keys(CONSISTENCY).map(k => <option key={k} value={k}>{CONSISTENCY[k].label}</option>)}
        </select>
      </div>
      {n.consistency && <div className="ddia-blurb">{CONSISTENCY[n.consistency].blurb}</div>}

      {(n.engine || n.consistency) && (
        <div className={`ddia-verdict ${ph.capMul < 0.9 || ph.latMul > 1.3 ? 'bad' : 'good'}`}>
          The simulator applies this: capacity {pct(ph.capMul)}, latency {pct(ph.latMul)}
          {ph.tailMul > 1.5 ? `, and p99 runs about ${ph.tailMul.toFixed(1)}× the median.` : '.'}
        </div>
      )}
    </>
  )
}

function ServiceFields({ n, set }) {
  if (!['app', 'micro', 'web', 'worker'].includes(n.type)) return null
  return (
    <>
      <div className="field">
        <label>Writes to several stores</label>
        <select value={n.multiWrite || 'none'} onChange={e => set({ multiWrite: e.target.value })}>
          {Object.keys(MULTI_WRITE).map(k => <option key={k} value={k}>{MULTI_WRITE[k].label}</option>)}
        </select>
      </div>
      <div className="ddia-blurb">{MULTI_WRITE[n.multiWrite || 'none'].blurb}</div>
    </>
  )
}

function StreamFields({ n, set }) {
  if (n.type !== 'queue' && n.type !== 'kafka') return null
  return (
    <>
      <div className="field">
        <label>Role</label>
        <select value={n.streamRole || 'none'} onChange={e => set({ streamRole: e.target.value })}>
          {Object.keys(STREAM_ROLE).map(k => <option key={k} value={k}>{STREAM_ROLE[k].label}</option>)}
        </select>
      </div>
      <div className="ddia-blurb">{STREAM_ROLE[n.streamRole || 'none'].blurb}</div>
      <div className="field">
        <label>Delivery</label>
        <select value={n.delivery || 'atLeastOnce'} onChange={e => set({ delivery: e.target.value })}>
          {Object.keys(DELIVERY).map(k => <option key={k} value={k}>{DELIVERY[k].label}</option>)}
        </select>
      </div>
      <div className="ddia-blurb">{DELIVERY[n.delivery || 'atLeastOnce'].blurb}</div>
      <div className="field">
        <label>Consumer is idempotent</label>
        <input type="checkbox" checked={!!n.idempotentConsumer}
          onChange={e => set({ idempotentConsumer: e.target.checked })} />
      </div>
    </>
  )
}

// A mock interview on the loaded design. The rubric engine is the default and
// needs nothing; a model is optional and needs a key the user supplies.
function Interview({ template }) {
  const [state, setState] = useState('idle')     // idle | running | done
  const [stageIdx, setStageIdx] = useState(0)
  const [turns, setTurns] = useState([])
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [baseUrl, setBaseUrl] = useState(() => LLM.getBase())
  const [model, setModelState] = useState(() => LLM.getModel())
  const [keyInput, setKeyInput] = useState('')
  const [provider, setProvider] = useState('anthropic')
  const [keySet, setKeySet] = useState(() => LLM.hasKey())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const recRef = useRef(null)

  const iv = useMemo(() => template ? buildInterview(template, breakdownFor(template)) : null, [template?.name])
  const speechOK = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  if (!template) return (
    <section className="iv">
      <h3>Mock interview</h3>
      <p className="muted">Load a design first — the interview is about a specific system, and the questions come from that design's breakdown.</p>
    </section>
  )

  const stage = iv.stages[stageIdx]

  const start = () => {
    setTurns([{ role: 'interviewer', stage: iv.stages[0].id, text: iv.stages[0].question }])
    setStageIdx(0); setState('running'); setErr(null)
  }

  const stopListening = () => {
    try { recRef.current?.stop() } catch { /* already stopped */ }
    recRef.current = null; setListening(false)
  }

  const listen = () => {
    if (listening) return stopListening()
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    let final = ''
    r.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '; else interim += t
      }
      setDraft((final + interim).trim())
    }
    r.onerror = ev => { setErr(ev.error === 'not-allowed' ? 'Microphone permission was refused. You can type instead.' : 'Speech recognition stopped: ' + ev.error); stopListening() }
    r.onend = () => setListening(false)
    recRef.current = r
    try { r.start(); setListening(true) } catch { setErr('Could not start the microphone.') }
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    stopListening()
    const next = [...turns, { role: 'candidate', stage: stage.id, text }]
    setTurns(next); setDraft(''); setErr(null)

    if (LLM.hasKey()) {
      setBusy(true)
      try {
        const reply = await LLM.ask({
          provider, key: LLM.getKey(), baseUrl: LLM.getBase(), model: LLM.getModel() || undefined,
          system: LLM.systemPrompt(iv.design, stage.title),
          messages: next.filter(t => t.role !== 'system').map(t => ({ role: t.role === 'candidate' ? 'user' : 'assistant', content: t.text })),
        })
        setTurns(t => [...t, { role: 'interviewer', stage: stage.id, text: reply, llm: true }])
      } catch (e) { setErr(LLM.redact(e.message)) } finally { setBusy(false) }
      return
    }

    // Rubric: react to what was actually said, then either push or move on.
    const askedHere = turns.filter(t => t.role === 'interviewer' && t.stage === stage.id && t.probe)
    const nextStage = stageIdx + 1 < iv.stages.length ? iv.stages[stageIdx + 1] : null
    const r = interviewRespond({
      stage, answer: text,
      turnIndex: turns.length,
      nextStage: askedHere.length < 2 ? nextStage : nextStage,
      askedProbes: askedHere.map(t => t.probe),
      ctx: { rps: template?.rps },
    })
    const forceMove = askedHere.length >= 2
    if (r.probe && !forceMove) {
      setTurns(t => [...t, { role: 'interviewer', stage: stage.id, text: r.text, probe: r.probe }])
      return
    }
    if (nextStage) {
      setStageIdx(stageIdx + 1)
      setTurns(t => [...t, { role: 'interviewer', stage: nextStage.id,
        text: forceMove && r.probe ? nextStage.question : r.text }])
    } else {
      setTurns(t => [...t, { role: 'interviewer', stage: stage.id, text: 'That is everything I wanted to cover. Here is how it went.' }])
      setState('done')
    }
  }

  const rep = state === 'done' ? interviewReport(iv, turns) : null

  return (
    <section className="iv" aria-label="Mock interview">
      <h3>Mock interview — {iv.design}</h3>

      {state === 'idle' && (
        <>
          <p className="muted">
            Five stages, the same ones a real interview follows, on the design you have loaded.
            At the end you get a rating per stage and the specific things you did not say.
          </p>

          <div className="iv-mode">
            <div className={`iv-engine ${keySet ? 'live' : ''}`}>
              {keySet
                ? <><b>{LLM.PROVIDERS[provider].label} is running this interview.</b> It will follow whatever you say, including tangents the built-in interviewer cannot.</>
                : <><b>Add a key and {LLM.PROVIDERS[provider].label} runs the interview.</b> Without one it falls back to the built-in interviewer, which works offline and free but only recognises the concepts it was written to listen for.</>}
            </div>

            <div className="field">
              <label>Provider</label>
              <select value={provider} onChange={e => { setProvider(e.target.value); setErr(null) }}>
                {Object.keys(LLM.PROVIDERS).map(k => <option key={k} value={k}>{LLM.PROVIDERS[k].label}</option>)}
              </select>
            </div>
            {LLM.PROVIDERS[provider].note && <div className="ddia-blurb">{LLM.PROVIDERS[provider].note}</div>}

            <div className="field">
              <label>Model</label>
              <input list={`models-${provider}`} value={model} placeholder={LLM.PROVIDERS[provider].model}
                onChange={e => { setModelState(e.target.value); LLM.setModel(e.target.value) }} />
              <datalist id={`models-${provider}`}>
                {(LLM.MODEL_CHOICES[provider] || []).map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="ddia-blurb">
              Pick one of the suggestions or type any model name the provider accepts. Left blank it uses {LLM.PROVIDERS[provider].model}.
            </div>

            {LLM.PROVIDERS[provider].needsBaseUrl && (
              <div className="field">
                <label>Base URL</label>
                <input type="text" value={baseUrl} placeholder="https://your-endpoint/v1"
                  onChange={e => { setBaseUrl(e.target.value); LLM.setBase(e.target.value) }} />
              </div>
            )}

            <div className="field">
              <label>API key</label>
              <input type="password" value={keyInput} placeholder={keySet ? 'a key is set for this tab' : 'paste here — optional'}
                onChange={e => { setKeyInput(e.target.value); LLM.setKey(e.target.value); setKeySet(!!e.target.value) }} />
            </div>
            <div className="ddia-verdict bad">{LLM.KEY_WARNING}</div>
            {keySet && <button className="iv-clearkey" onClick={() => { LLM.setKey(''); setKeyInput(''); setKeySet(false) }}>Forget the key</button>}
          </div>
          <button className="iv-start" onClick={start}>Start the interview</button>
          {!speechOK && <p className="muted iv-note">This browser has no speech recognition, so you will type your answers. Chrome and Edge support the microphone.</p>}
          {speechOK && <p className="muted iv-note">Answering by voice sends audio to your browser vendor's speech service. Type instead if you would rather it did not.</p>}
        </>
      )}

      {state !== 'idle' && (
        <ol className="iv-tape">
          {turns.map((t, i) => (
            <li key={i} className={`iv-turn ${t.role}`}>
              <span className="iv-who">{t.role === 'interviewer' ? (t.llm ? LLM.PROVIDERS[provider].label : 'Interviewer (built-in)') : 'You'}</span>
              <p>{t.text}</p>
            </li>
          ))}
        </ol>
      )}

      {state === 'running' && (
        <div className="iv-input">
          <div className="iv-stage">Stage {stageIdx + 1} of {iv.stages.length} — {stage.title}</div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
            placeholder="Answer out loud with the microphone, or type here…"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }} />
          <div className="iv-btns">
            {speechOK && (
              <button className={`iv-mic ${listening ? 'on' : ''}`} onClick={listen} aria-pressed={listening}>
                {listening ? '● Listening — stop' : '🎤 Answer by voice'}
              </button>
            )}
            <span className="spacer" />
            <button className="iv-skip" onClick={() => setState('done')}>End &amp; get feedback</button>
            <button className="iv-send" onClick={submit} disabled={!draft.trim() || busy}>{busy ? 'Thinking…' : 'Send'}</button>
          </div>
          {err && <div className="ddia-verdict bad">{err}</div>}
        </div>
      )}

      {state === 'done' && rep && (
        <div className="iv-report">
          <div className={`iv-band ${rep.overall >= 0.6 ? 'good' : 'bad'}`}>
            <b>{rep.band.band}</b> — {Math.round(rep.overall * 100)}%
            <p>{rep.band.gist}</p>
          </div>

          <h4>By stage</h4>
          <table className="iv-scores">
            <tbody>
              {Object.entries(rep.byStage).map(([id, st]) => (
                <tr key={id}>
                  <td className="k">{st.title}</td>
                  <td><div className="iv-bar"><span style={{ width: Math.round(st.score * 100) + '%' }} /></div></td>
                  <td className="n">{st.scorable ? Math.round(st.score * 100) + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {rep.strengths.length > 0 && (<><h4>What went well</h4>
            <ul className="iv-list">{rep.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}

          <h4>Areas to improve</h4>
          {rep.improve.length === 0
            ? <p className="muted">Nothing material. Run it again on a harder design.</p>
            : <ul className="iv-list">
                {rep.improve.map((x, i) => (
                  <li key={i} className={`sev-${x.severity}`}>
                    <b>{x.area}.</b> {x.advice}
                    {x.missed.length > 0 && <div className="iv-missed">Did not mention: {x.missed.join(' · ')}</div>}
                  </li>
                ))}
              </ul>}

          <button className="iv-start" onClick={() => { setTurns([]); setStageIdx(0); setState('idle') }}>Run it again</button>
        </div>
      )}
    </section>
  )
}

// small guard so a template with no extracted concepts cannot throw
function matchConceptsSafe(text, concepts) {
  try { return matchConcepts(text, concepts || []) } catch { return { hit: [], missed: [] } }
}

// ── Read aloud ───────────────────────────────────────────────────────────────
// Wraps any panel section and reads its prose, highlighting each block as it
// goes. Renders nothing at all where the browser has no speech synthesis,
// rather than offering a control that would do nothing.

// "Microsoft Sonia Online (Natural) - English (United Kingdom)" is unreadable in
// a 90px select. Keep the part that identifies the voice.
function shortVoice(name) {
  return String(name)
    .replace(/^(Microsoft|Google|Apple)\s+/i, '')
    .replace(/\s*-\s*English.*$/i, '')
    .replace(/\s*\((Natural|Neural|Premium|Enhanced|Online)\)/gi, ' ✦')
    .replace(/\s*Online\b/i, '')
    .replace(/English\s*\(?(United Kingdom|United States|India)\)?/i, m => m)
    .trim() || name
}

function ReadAloud({ children, label = 'this section' }) {
  const hostRef = useRef(null)
  const [supported] = useState(speechSupported)
  const [state, setState] = useState('idle')        // idle | playing | paused
  const [rate, setRate] = useState(readRate)
  const [voiceName, setVoiceName] = useState(readVoiceName)
  const [voices, setVoices] = useState([])
  const [voiceGroups, setVoiceGroups] = useState([])
  const [at, setAt] = useState(-1)                  // index of the block being read
  const blocksRef = useRef([])
  const idxRef = useRef(0)
  const stoppingRef = useRef(false)
  const keepAliveRef = useRef(null)

  const synth = supported ? window.speechSynthesis : null

  // Chrome returns an empty list on the first call and fills it in later, so
  // read it now and again when it changes.
  useEffect(() => {
    if (!synth) return
    const load = () => { setVoices(listVoices(synth)); setVoiceGroups(voicesByLanguage(synth)) }
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => synth.removeEventListener?.('voiceschanged', load)
  }, [synth])

  const clearHighlight = useCallback(() => {
    for (const b of blocksRef.current) b.el?.classList.remove('speaking')
  }, [])

  const stop = useCallback(() => {
    stoppingRef.current = true
    clearInterval(keepAliveRef.current)
    try { synth?.cancel() } catch { /* nothing to cancel */ }
    clearHighlight()
    setState('idle')
    setAt(-1)
    idxRef.current = 0
  }, [synth, clearHighlight])

  // Stop when the section unmounts or is swapped for another tab. Without this
  // it happily keeps reading a panel that is no longer on screen.
  useEffect(() => stop, [stop])

  const speakFrom = useCallback(i => {
    if (!synth) return
    const blocks = blocksRef.current
    if (i >= blocks.length) { stop(); return }

    clearHighlight()
    const block = blocks[i]
    block.el?.classList.add('speaking')
    block.el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    setAt(i)
    idxRef.current = i

    const parts = chunkText(block.text)
    let part = 0
    const next = () => {
      if (stoppingRef.current) return
      if (part >= parts.length) { setTimeout(() => speakFrom(i + 1), BLOCK_PAUSE_MS); return }
      const u = new window.SpeechSynthesisUtterance(parts[part++])
      u.rate = rate
      u.pitch = PROSODY.pitch
      u.volume = PROSODY.volume
      const v = pickVoice(synth, voiceName)
      // Set lang from the voice, not to a fixed value: a mismatch makes some
      // engines quietly ignore the voice and fall back to their default.
      if (v) { u.voice = v; if (v.lang) u.lang = v.lang }
      u.onend = next
      u.onerror = e => {
        // "interrupted" and "canceled" are what a deliberate stop looks like.
        if (e?.error === 'interrupted' || e?.error === 'canceled') return
        next()
      }
      synth.speak(u)
    }
    next()
  }, [synth, rate, voiceName, stop, clearHighlight])

  const play = () => {
    if (!synth) return
    const blocks = extractSpeech(hostRef.current)
    if (!blocks.length) return
    blocksRef.current = blocks
    stoppingRef.current = false
    try { synth.cancel() } catch { /* no-op */ }
    setState('playing')
    // Chrome pauses long sessions unless it is nudged. Harmless elsewhere.
    clearInterval(keepAliveRef.current)
    keepAliveRef.current = setInterval(() => {
      if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() }
    }, 10000)
    speakFrom(0)
  }

  const pause = () => { synth?.pause(); setState('paused') }
  const resume = () => { synth?.resume(); setState('playing') }

  const changeVoice = n => {
    setVoiceName(n); saveVoiceName(n)
    if (state !== 'idle') {
      stoppingRef.current = true
      try { synth.cancel() } catch { /* no-op */ }
      setTimeout(() => { stoppingRef.current = false; setState('playing'); speakFrom(idxRef.current) }, 60)
    }
  }

  const changeRate = r => {
    setRate(r); saveRate(r)
    if (state !== 'idle') {           // restart the current block at the new speed
      stoppingRef.current = true
      try { synth.cancel() } catch { /* no-op */ }
      setTimeout(() => { stoppingRef.current = false; setState('playing'); speakFrom(idxRef.current) }, 60)
    }
  }

  const total = blocksRef.current.length

  return (
    <>
      {supported && (
        <div className="readaloud" data-no-speech>
          {state === 'idle' ? (
            <button className="ra-play" onClick={play} aria-label={`Read ${label} aloud`}>▶ Listen</button>
          ) : (
            <>
              {state === 'playing'
                ? <button className="ra-play" onClick={pause} aria-label="Pause reading">❙❙ Pause</button>
                : <button className="ra-play" onClick={resume} aria-label="Resume reading">▶ Resume</button>}
              <button onClick={stop} aria-label="Stop reading">■ Stop</button>
              <span className="ra-prog" aria-hidden="true">{Math.min(at + 1, total)}/{total}</span>
            </>
          )}
          {voices.length > 1 && (
            <select className="ra-voice" value={voiceName || (voices[0]?.name ?? '')}
              onChange={e => changeVoice(e.target.value)} aria-label="Voice and language">
              {voiceGroups.map(([lang, list]) => (
                <optgroup key={lang} label={lang}>
                  {list.map(v => <option key={v.name} value={v.name}>{shortVoice(v.name)}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          <label className="ra-rate">
            <span className="sr-only">Reading speed</span>
            <select value={rate} onChange={e => changeRate(Number(e.target.value))}
              aria-label="Reading speed">
              {RATES.map(r => <option key={r} value={r}>{r}×</option>)}
            </select>
          </label>
          <span className="sr-only" role="status" aria-live="polite">
            {state === 'playing' ? `Reading ${label}, part ${at + 1} of ${total}`
              : state === 'paused' ? 'Reading paused' : ''}
          </span>
        </div>
      )}
      <div ref={hostRef}>{children}</div>
    </>
  )
}

// ── Breakdown diagrams ───────────────────────────────────────────────────────
// Inline SVG, no dependencies, themed through CSS variables so light and dark
// both work without passing a palette around.

const DIA_W = 400

// Miniature of the template's own architecture, scaled to fit the panel.
function ArchDiagram({ nodes, edges, focus }) {
  if (!nodes.length) return null
  const W = 118, H = 46
  const minX = Math.min(...nodes.map(n => n.x)), maxX = Math.max(...nodes.map(n => n.x + W))
  const minY = Math.min(...nodes.map(n => n.y)), maxY = Math.max(...nodes.map(n => n.y + H))
  const pad = 10
  const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2
  const height = Math.min(300, Math.max(140, (DIA_W * vh) / vw))
  const at = Object.fromEntries(nodes.map(n => [n.id, n]))
  const lit = new Set(focus || [])
  const dim = lit.size > 0

  return (
    <div className="bd-dia">
      <svg viewBox={`${minX - pad} ${minY - pad} ${vw} ${vh}`} width="100%" height={height}
        preserveAspectRatio="xMidYMid meet" role="img" aria-label="Architecture diagram">
        <defs>
          <marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="bd-dia-arrowhead" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const f = at[e.from], t = at[e.to]
          if (!f || !t) return null
          const x1 = f.x + W, y1 = f.y + H / 2, x2 = t.x, y2 = t.y + H / 2
          const mx = (x1 + x2) / 2
          const on = !dim || (lit.has(e.from) && lit.has(e.to))
          return (
            <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              className={`bd-dia-edge ${on ? '' : 'faint'}`} markerEnd="url(#bd-arrow)" />
          )
        })}
        {nodes.map(n => {
          const on = !dim || lit.has(n.id)
          return (
            <g key={n.id} className={`bd-dia-node g-${(n.group || 'other').toLowerCase().replace(/[^a-z]/g, '')} ${on ? '' : 'faint'}`}>
              <rect x={n.x} y={n.y} width={W} height={H} rx="7" />
              <text x={n.x + W / 2} y={n.y + H / 2 + 4} textAnchor="middle">
                {n.label.length > 17 ? n.label.slice(0, 16) + '…' : n.label}
              </text>
              {n.replicas > 1 && (
                <text x={n.x + W - 6} y={n.y + 12} textAnchor="end" className="bd-dia-rep">×{n.replicas}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Sequence diagram: actors as lifelines, steps as arrows down the page.
function SeqDiagram({ title, actors, steps }) {
  if (!actors?.length || !steps?.length) return null
  const colW = Math.max(78, Math.min(150, Math.floor((DIA_W + 120) / actors.length)))
  const W = colW * actors.length
  const top = 34, rowH = 30
  const H = top + steps.length * rowH + 16
  const cx = i => i * colW + colW / 2
  const idx = Object.fromEntries(actors.map(([id], i) => [id, i]))

  return (
    <div className="bd-dia bd-seq">
      {title && <div className="bd-dia-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title || 'Sequence diagram'}>
        <defs>
          <marker id="bd-seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="bd-dia-arrowhead" />
          </marker>
        </defs>
        {actors.map(([id, label], i) => (
          <g key={id} className="bd-seq-actor">
            <rect x={cx(i) - colW / 2 + 5} y="4" width={colW - 10} height="21" rx="5" />
            <text x={cx(i)} y="18" textAnchor="middle">
              {label.length > 14 ? label.slice(0, 13) + '…' : label}
            </text>
            <line x1={cx(i)} y1="27" x2={cx(i)} y2={H - 8} className="bd-seq-life" />
          </g>
        ))}
        {steps.map((s, i) => {
          const a = idx[s.from], b = idx[s.to]
          if (a === undefined || b === undefined) return null
          const y = top + i * rowH + 14
          if (a === b) {
            return (
              <g key={i} className="bd-seq-step self">
                <path d={`M ${cx(a)} ${y - 6} h 20 v 12 h -20`} className="bd-seq-line" markerEnd="url(#bd-seq-arrow)" />
                <text x={cx(a) + 26} y={y + 3}>{s.label}</text>
              </g>
            )
          }
          const dir = b > a ? 1 : -1
          const x1 = cx(a) + dir * 4, x2 = cx(b) - dir * 4
          return (
            <g key={i} className={`bd-seq-step ${s.ret ? 'ret' : ''}`}>
              <line x1={x1} y1={y} x2={x2} y2={y} className="bd-seq-line" markerEnd="url(#bd-seq-arrow)" />
              <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle">{s.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Data model: one card per table, columns with type and note.
function SchemaDiagram({ tables }) {
  if (!tables?.length) return null
  return (
    <div className="bd-schema">
      {tables.map((t, i) => (
        <div key={i} className="bd-table">
          <div className="bd-table-h">{t.name}</div>
          <table>
            <tbody>
              {t.columns.map(([col, type, note], j) => (
                <tr key={j}>
                  <td className="c">{col}</td>
                  <td className="t">{type}</td>
                  <td className="n">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.idx?.length > 0 && (
            <ul className="bd-table-idx">{t.idx.map((x, j) => <li key={j}>{x}</li>)}</ul>
          )}
        </div>
      ))}
    </div>
  )
}

// State machine: states in a row, transitions as labelled arcs.
function StateDiagram({ states, transitions }) {
  if (!states?.length) return null
  const boxW = 96, boxH = 26, gapX = 26
  const perRow = Math.max(1, Math.floor((DIA_W + gapX) / (boxW + gapX)))
  const rows = Math.ceil(states.length / perRow)
  const W = perRow * (boxW + gapX) - gapX
  const rowH = 74
  const H = rows * rowH + 20
  const at = {}
  states.forEach((s, i) => {
    const r = Math.floor(i / perRow), c = i % perRow
    at[s] = { x: c * (boxW + gapX), y: r * rowH + 8 }
  })

  return (
    <div className="bd-dia bd-state">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="State machine">
        <defs>
          <marker id="bd-st-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="bd-dia-arrowhead" />
          </marker>
        </defs>
        {transitions.map(([from, to, label], i) => {
          const a = at[from], b = at[to]
          if (!a || !b) return null
          const sameRow = a.y === b.y
          const x1 = a.x + boxW / 2, y1 = a.y + boxH
          const x2 = b.x + boxW / 2, y2 = b.y + boxH
          const dip = sameRow ? 26 + (i % 2) * 14 : 34
          const d = `M ${x1} ${y1} C ${x1} ${y1 + dip}, ${x2} ${y2 + dip}, ${x2} ${y2}`
          return (
            <g key={i} className="bd-st-tr">
              <path d={d} markerEnd="url(#bd-st-arrow)" />
              <text x={(x1 + x2) / 2} y={Math.max(y1, y2) + dip - 2} textAnchor="middle">{label}</text>
            </g>
          )
        })}
        {states.map(s => (
          <g key={s} className="bd-st-node">
            <rect x={at[s].x} y={at[s].y} width={boxW} height={boxH} rx="13" />
            <text x={at[s].x + boxW / 2} y={at[s].y + boxH / 2 + 3.5} textAnchor="middle">
              {s.length > 13 ? s.slice(0, 12) + '…' : s}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Breakdown ────────────────────────────────────────────────────────────────
// Long-form problem breakdown for the loaded template: requirements, set up,
// high-level design, deep dives, level expectations and references. The
// contents rail tracks scroll position, and sections that name components can
// spotlight them on the canvas.

function BdBlocks({ blocks }) {
  if (!blocks) return null
  return blocks.map((b, i) => {
    const [t, v] = b
    if (t === 'p') return <p key={i} className="bd-p"><RichLine text={v} /></p>
    if (t === 'steps') return <ol key={i} className="bd-steps">{v.map((s, j) => <li key={j}><RichLine text={s} /></li>)}</ol>
    if (t === 'bul') return <ul key={i} className="bd-bul">{v.map((s, j) => <li key={j}><RichLine text={s} /></li>)}</ul>
    if (t === 'note' || t === 'warn' || t === 'calc') return <div key={i} className={`bd-call ${t}`}><RichLine text={v} /></div>
    if (t === 'code') return <pre key={i} className="bd-code">{v}</pre>
    if (t === 'reqs') return (
      <div key={i}>
        <ol className="bd-steps">{v.core.map((r, j) => <li key={j}><RichLine text={r} /></li>)}</ol>
        <div className="bd-below">
          <span>Below the line</span>
          {v.out.map((r, j) => <em key={j}>{r}</em>)}
        </div>
      </div>
    )
    if (t === 'nums') return (
      <div key={i} className="bd-nums">
        {v.map(([val, lab], j) => <div key={j} className="bd-num"><b>{val}</b><span>{lab}</span></div>)}
      </div>
    )
    if (t === 'ent') return (
      <div key={i} className="bd-ents">
        {v.map(([n, d], j) => <div key={j} className="bd-ent"><b>{n}</b><span>{d}</span></div>)}
      </div>
    )
    if (t === 'api') return (
      <div key={i}>
        {v.map((c, j) => (
          <div key={j} className="bd-api">
            <div className="bd-api-h">
              <span className={`bd-dir ${c.dir === '←' ? 'in' : c.dir === '↔' ? 'both' : 'out'}`}>{c.dir}</span>
              <code>{c.name}</code>
            </div>
            <pre className="bd-code">{c.body}</pre>
          </div>
        ))}
      </div>
    )
    if (t === 'arch') return <ArchDiagram key={i} {...v} />
    if (t === 'seq') return <SeqDiagram key={i} {...v} />
    if (t === 'schema') return <SchemaDiagram key={i} tables={v} />
    if (t === 'state') return <StateDiagram key={i} {...v} />
    if (t === 'opts') return <BdOptions key={i} options={v} />
    return null
  })
}

function BdOptions({ options }) {
  const best = options.findIndex(o => o.best)
  const [open, setOpen] = useState(best >= 0 ? best : options.length - 1)
  return (
    <div className="bd-opts">
      {options.map((o, i) => (
        <div key={i} className={`bd-opt ${o.rating.toLowerCase()} ${open === i ? 'open' : ''}`}>
          <button className="bd-opt-h" onClick={() => setOpen(open === i ? -1 : i)}>
            <span className={`bd-rate ${o.rating.toLowerCase()}`}>{o.rating}</span>
            <span className="bd-opt-t">{o.title}</span>
            {o.best && <span className="bd-pick">pick this</span>}
            <span className="bd-chev">{open === i ? '−' : '+'}</span>
          </button>
          {open === i && (
            <div className="bd-opt-b">
              <div className="bd-sub">Approach</div>
              <p className="bd-p">{o.approach}</p>
              <div className="bd-sub">Challenges</div>
              <p className="bd-p">{o.challenges}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Breakdown({ template, onLoadTemplate, onFocus, focused }) {
  const bd = breakdownFor(template)
  const [active, setActive] = useState('')
  const [showToc, setShowToc] = useState(true)
  const rootRef = useRef(null)

  // Track which section is in view so the contents rail can follow along.
  useEffect(() => {
    if (!bd || typeof IntersectionObserver === 'undefined' || !rootRef.current) return
    const heads = [...rootRef.current.querySelectorAll('[data-bd-sec]')]
    if (!heads.length) return
    const io = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis.length) setActive(vis[0].target.dataset.bdSec)
    }, { rootMargin: '-8px 0px -70% 0px', threshold: 0 })
    heads.forEach(h => io.observe(h))
    return () => io.disconnect()
  }, [bd])

  if (!bd) {
    return (
      <section>
        <h3>Breakdown</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          A full written breakdown — requirements, core entities, API, high-level design read off your
          diagram, deep dives with Bad/Good/Great options and level expectations. Every template in the
          library has one. Load one to read it.
        </div>
        <div className="sc-grid">
          {BREAKDOWN_NAMES.map(n => (
            <button key={n} className="sc-pick" onClick={() => onLoadTemplate(n)}>{n}</button>
          ))}
        </div>
      </section>
    )
  }

  const jump = id => {
    const el = rootRef.current?.querySelector(`[data-bd-sec="${id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <section className="bd" ref={rootRef}>
      <h3>{bd.title}</h3>
      <div className="bd-meta">{bd.meta}</div>
      <p className="bd-p bd-intro"><RichLine text={bd.intro} /></p>

      <div className="bd-toc">
        <button className="bd-toc-h" onClick={() => setShowToc(s => !s)}>
          On this page <span>{showToc ? '−' : '+'}</span>
        </button>
        {showToc && (
          <div className="bd-toc-list">
            {bd.sections.map(s => (
              <button key={s.id}
                className={`bd-toc-i h${s.h} ${active === s.id ? 'on' : ''}`}
                onClick={() => jump(s.id)}>{s.title}</button>
            ))}
          </div>
        )}
      </div>

      <ReadAloud label={`the ${bd.title} breakdown`}>
      {bd.sections.map(s => (
        <div key={s.id} className={`bd-sec h${s.h}`}>
          {s.h === 1
            ? <h4 data-bd-sec={s.id} className="bd-h1">{s.title}</h4>
            : <h5 data-bd-sec={s.id} className="bd-h2">{s.title}</h5>}
          {s.focus && (
            <button className={`bd-focus ${focused === s.id ? 'on' : ''}`}
              onClick={() => onFocus(focused === s.id ? null : { id: s.id, types: s.focus })}>
              {focused === s.id ? '✕ Show whole diagram' : '◎ Spotlight on canvas'}
            </button>
          )}
          <BdBlocks blocks={s.blocks} />
        </div>
      ))}
      </ReadAloud>
    </section>
  )
}

// ── Scale ────────────────────────────────────────────────────────────────────
// "How do we take this to a billion users?" for the loaded template: the
// binding constraint, a rung-by-rung ladder, the specific levers (each able to
// spotlight the components it touches), and the wall you cannot scale past.

function Scale({ template, onLoadTemplate, onFocus, focused, rps, onSetRps }) {
  const sc = scalingFor(template)
  const [tab, setTab] = useState('ladder')

  if (!sc) {
    return (
      <section>
        <h3>Scale to a billion</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          Load a template and this shows what breaks first, what you change at each rung of
          growth, and the constraint you cannot engineer past.
        </div>
        <div className="sc-grid">
          {SCALING_NAMES.map(n => (
            <button key={n} className="sc-pick" onClick={() => onLoadTemplate(n)}>{n}</button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="sc">
      <h3>Scaling {template.name}</h3>

      <div className="sc-constraint">
        <span>Binding constraint</span>
        <p>{sc.constraint}</p>
      </div>

      <div className="tabs sub">
        {[['ladder', 'Ladder'], ['levers', `Levers (${sc.levers.length})`], ['wall', 'The wall'], ['rules', 'Rules']]
          .map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
      </div>

      {tab === 'ladder' && (
        <>
          <div className="muted" style={{ margin: '2px 0 10px' }}>
            What you actually build at each size. Earlier rungs are deliberately simpler than
            later ones — adding the last rung's machinery at the first is the classic mistake.
          </div>
          <div className="sc-ladder">
            {sc.ladder.map(([users, thru, move], i) => (
              <div key={i} className="sc-rung">
                <div className="sc-rung-l">
                  <b>{users}</b>
                  <span>{thru}</span>
                </div>
                <div className="sc-rung-r">{move}</div>
              </div>
            ))}
          </div>
          {typeof rps === 'number' && (
            <div className="sc-sim">
              Canvas is simulating <b>{rps >= 1000 ? (rps / 1000).toFixed(0) + 'k' : rps} rps</b>.
              {' '}Push it and watch which tier saturates first:
              <span className="sc-sim-btns">
                {[10000, 100000, 1000000].map(r => (
                  <button key={r} className="btn" onClick={() => onSetRps(r)}>
                    {r >= 1000000 ? '1M' : (r / 1000) + 'k'} rps
                  </button>
                ))}
              </span>
            </div>
          )}
        </>
      )}

      {tab === 'levers' && (
        <>
          <div className="muted" style={{ margin: '2px 0 10px' }}>
            The moves that matter for this design, most load-bearing first. Spotlight one to see
            which components it touches.
          </div>
          {sc.levers.map((l, i) => {
            const id = 'lever-' + i
            return (
              <div key={i} className={`sc-lever ${focused === id ? 'on' : ''}`}>
                <div className="sc-lever-h">
                  <b>{l.t}</b>
                  {l.n && l.n.length > 0 && (
                    <button className={`bd-focus ${focused === id ? 'on' : ''}`}
                      onClick={() => onFocus(focused === id ? null : { id, ids: l.n })}>
                      {focused === id ? '✕' : '◎'}
                    </button>
                  )}
                </div>
                <p>{l.d}</p>
              </div>
            )
          })}
        </>
      )}

      {tab === 'wall' && (
        <div className="sc-wall">
          <div className="sc-wall-t">🧱 {sc.wall.t}</div>
          <p>{sc.wall.d}</p>
          <div className="muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Naming the wall is the senior-level move. Every design in this library has one, and
            past it the answer stops being "add capacity" and becomes admission control, pricing,
            procurement or an honest conversation about scope.
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <>
          <div className="muted" style={{ margin: '2px 0 10px' }}>
            {PRINCIPLES.length} rules that hold across every design in the library.
          </div>
          {PRINCIPLES.map((p, i) => (
            <div key={i} className="sc-rule">
              <b><span className="sc-rule-n">{i + 1}</span>{p.t}</b>
              <p>{p.d}</p>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
