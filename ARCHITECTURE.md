# ArchSim architecture

ArchSim is a **static single-page app** (React + Vite). There is no backend: every simulation, score and lesson runs in the visitor's browser. That is a design choice, and it sets the limits listed at the end.

## Data flow

```
templates.js ──► nodes + edges + rps ──► sim.js (queueing / saturation model)
user edits    ┘                        ├─► health.js, advisor.js   findings and fixes
share.js / integrity.js ─ ingress ─────┤─► faults.js, crash.js     chaos and failure spread
versions.js ─ local history ───────────┤─► slo.js, montecarlo.js   SLOs and reliability simulation
                                       └─► pricing.js, clouds.js, roi.js   cost and revenue
```

Everything downstream derives from three values: `nodes`, `edges`, `rps`. Nothing keeps a second copy of the design.

## Module map

| Area | Files | Role |
|---|---|---|
| Design model | `catalog.js` (116 component types), `templates.js` (110 templates) | What can be drawn, and the starting designs |
| Simulation | `sim.js`, `des.js`, `faults.js`, `crash.js`, `montecarlo.js` | Load, saturation, failure injection, seeded reliability runs |
| Analysis | `health.js`, `advisor.js`, `slo.js`, `scaling-*.js`, `future.js` | Bottlenecks, fixes, scale ladders, SLO checks |
| Money | `pricing.js`, `clouds.js`, `roi.js` | Cloud cost per provider, revenue per million requests |
| Teaching | `mastery.js`, `learn*.js`, `interview*.js`, `incidents.js`, `acronyms.js`, `breakdown-*.js` | Curriculum, drills, interviewer, incident drills, written breakdowns |
| Ingress / egress | `integrity.js`, `share.js`, `dac.js`, `exporters.js`, `codegen.js` | Validate every incoming design; export JSON, Mermaid, Excalidraw, docs, code |
| History | `versions.js` | Browser-local named snapshots, diff, restore |
| Business | `license.js` | Signed Pro keys, free-tier gating |
| UI | `App.jsx`, `styles.css`, `tour.js` | Canvas, tabs, panels |

## Rules the code keeps

1. **Every design that enters passes `integrity.validateDesign`.** It repairs and reports; it never crashes or silently drops.
2. **Pure modules, no DOM.** Data and simulation files are plain ESM, so the suite can import and test them directly.
3. **Seeded randomness.** Same seed, same result. A simulator that wobbles teaches nothing.
4. **Each template has companions** keyed by its name: `breakdown-h.js`, `scaling-f.js`, `roi.js`. Add all of them together.
5. **Claims are checked.** Counts, tables and copy are pinned by `scripts/verify.mjs`. Fix the content, never weaken the check.

## What a static site cannot do (and how the code handles it)

| Wanted | Why not in-browser | What ArchSim does instead |
|---|---|---|
| Real load testing, real failover | No servers to hit | A queueing-model simulation, labelled as a model |
| Live metrics / traces | No telemetry source | Simulated telemetry from the model; real stacks belong in a backend |
| Shared team workspaces, accounts | No server | Share links and JSON export; history is per-browser |
| Real payments, billing | Needs a ledger and a database | Separate tested repos: `bharat-pay-core`, `billing-engine` |
| Paid licence enforcement | Client code is inspectable | Signed keys; treat as honour-based, not DRM |
