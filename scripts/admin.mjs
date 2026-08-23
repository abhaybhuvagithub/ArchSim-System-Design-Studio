#!/usr/bin/env node
// The admin dashboard. Run it, open the file it prints:
//
//   node scripts/admin.mjs
//
// It reads the two data sources this business actually has — the license
// ledger (users, plans, revenue) and the public visitor counter — and writes
// a self-contained admin-dashboard.html (GITIGNORED: it contains revenue and
// customer keys' plans; a public repo must never carry it).
//
// What a static site cannot know by itself: sessions, engagement, keywords,
// traffic sources. The dashboard says so and points at the GA4 + Search
// Console setup in ADMIN.md instead of inventing numbers.
//
// Flags (mainly for tests): --ledger <path> --out <path> --visitors <n>
//                           --now <iso date> --fees <pct>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateKey, PRICES } from '../src/license.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : dflt
}
const LEDGER = arg('ledger', path.join(here, 'issued-keys.log'))
const OUT = arg('out', path.join(here, '..', 'admin-dashboard.html'))
const NOW = new Date(arg('now', new Date().toISOString()))
const FEES_PCT = parseFloat(arg('fees', '2'))
const VISITORS_ARG = arg('visitors', null)

// ── ledger → the business ──────────────────────────────────────────────────
const FALLBACK_PRICE = { monthly: PRICES.monthly.inr, halfyear: PRICES.halfyear.inr, yearly: PRICES.yearly.inr, lifetime: 0 }
const rows = fs.existsSync(LEDGER)
  ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => {
      const c = l.split('\t')
      const [key, plan] = c
      const paid = c.length >= 4 ? parseFloat(c[2]) : (FALLBACK_PRICE[plan] ?? 0)
      const at = new Date(c[c.length - 1])
      const v = validateKey(key, NOW)
      return { key, plan, paid: Number.isFinite(paid) ? paid : 0, at, active: v.ok, expired: !!v.expired, lifetime: !!v.lifetime }
    })
  : []

const customers = rows.filter((r) => r.paid > 0)
const ownerKeys = rows.length - customers.length
const active = customers.filter((r) => r.active).length
const expired = customers.filter((r) => !r.active).length
const revenue = customers.reduce((s, r) => s + r.paid, 0)
const fees = revenue * (FEES_PCT / 100)
const profit = revenue - fees   // infra is genuinely ₹0/month on GitHub Pages

// MRR: active subscriptions normalized to a month at the price actually paid
const mrr = customers.filter((r) => r.active).reduce((s, r) =>
  s + (r.plan === 'monthly' ? r.paid : r.plan === 'halfyear' ? r.paid / 6 : r.plan === 'yearly' ? r.paid / 12 : 0), 0)
const arr = mrr * 12

// revenue by calendar month
const byMonth = {}
for (const r of customers) {
  const k = r.at.toISOString().slice(0, 7)
  byMonth[k] = (byMonth[k] || { n: 0, inr: 0 })
  byMonth[k].n++; byMonth[k].inr += r.paid
}
const months = Object.entries(byMonth).sort(([a], [b]) => (a < b ? 1 : -1))
const thisMonth = byMonth[NOW.toISOString().slice(0, 7)] || { n: 0, inr: 0 }
const planMix = ['monthly', 'halfyear', 'yearly'].map((p) => ({
  p, label: PRICES[p].label, n: customers.filter((r) => r.plan === p).length,
  inr: customers.filter((r) => r.plan === p).reduce((s, r) => s + r.paid, 0),
}))

// ── visitors (public counter; offline-safe) ────────────────────────────────
let visitors = VISITORS_ARG != null ? parseInt(VISITORS_ARG, 10) : null
if (visitors == null) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('https://abacus.jasoncameron.dev/get/archsim-system-design-studio/visits', { signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) visitors = (await res.json())?.value ?? null
  } catch { visitors = null }
}
const conversion = visitors > 0 && customers.length > 0 ? (customers.length / visitors) * 100 : null

// ── render ─────────────────────────────────────────────────────────────────
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
const card = (k, v, sub = '') => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`
const html = `<!doctype html><html><head><meta charset="utf-8"><title>ArchSim — Admin</title>
<meta name="robots" content="noindex"><style>
  body { font: 14px/1.5 system-ui, sans-serif; background: #0e1116; color: #e6e9ef; margin: 0; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 4px; } .muted { opacity: .65; font-size: 12.5px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 18px 0; }
  .card { background: #161b24; border: 1px solid #2a3242; border-radius: 10px; padding: 14px; }
  .k { font-size: 12px; opacity: .7; } .v { font-size: 24px; font-weight: 700; margin-top: 2px; } .s { font-size: 12px; opacity: .6; margin-top: 2px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 20px; } th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #2a3242; font-size: 13px; }
  h2 { font-size: 15px; margin: 22px 0 4px; } .note { background: #161b24; border: 1px solid #2a3242; border-left: 3px solid #5b8cff; border-radius: 8px; padding: 12px; font-size: 13px; }
</style></head><body>
<h1>ArchSim — Admin Dashboard</h1>
<div class="muted">Generated ${NOW.toISOString().slice(0, 16).replace('T', ' ')} · private file, gitignored · re-run <code>node scripts/admin.mjs</code> to refresh</div>

<h2>Business</h2>
<div class="grid">
${card('Visitors (all-time)', visitors != null ? visitors.toLocaleString() : 'counter unreachable', 'public counter')}
${card('Paying customers', customers.length, ownerKeys ? `+ ${ownerKeys} owner/₹0 keys` : '')}
${card('Active accounts', active, 'valid, unexpired keys')}
${card('Expired accounts', expired, 'renewal opportunities')}
${card('Conversion', conversion != null ? conversion.toFixed(2) + '%' : '—', 'customers / visitors')}
</div>

<h2>Revenue</h2>
<div class="grid">
${card('Total revenue', inr(revenue))}
${card('This month', inr(thisMonth.inr), thisMonth.n + ' sale' + (thisMonth.n === 1 ? '' : 's'))}
${card('MRR (normalized)', inr(mrr), 'active plans / month')}
${card('ARR run-rate', inr(arr))}
${card('Profit', inr(profit), `after ${FEES_PCT}% payment fees · infra ₹0`)}
</div>

<h2>Revenue by month</h2>
<table><tr><th>Month</th><th>Sales</th><th>Revenue</th></tr>
${months.map(([m, d]) => `<tr><td>${m}</td><td>${d.n}</td><td>${inr(d.inr)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No sales yet — the ledger fills as genkey.mjs mints paid keys.</td></tr>'}
</table>

<h2>Plan mix</h2>
<table><tr><th>Plan</th><th>Customers</th><th>Revenue</th></tr>
${planMix.map((x) => `<tr><td>${x.label}</td><td>${x.n}</td><td>${inr(x.inr)}</td></tr>`).join('')}
</table>

<h2>Web analytics — sessions, engagement, keywords</h2>
<div class="note">A static site collects none of this by itself, and this dashboard will not invent it.
To get the Google-Analytics view (users, new vs returning, sessions, engagement rate, conversions) create a free GA4
property, paste its Measurement ID into <code>src/analytics.js</code>, and redeploy — the loader is already wired and
ships disabled until an ID exists. For <b>keywords</b>, verify the site in Google Search Console: search queries live
there, not in GA. Full steps: <code>ADMIN.md</code>.</div>
</body></html>`

fs.writeFileSync(OUT, html)
console.log('admin dashboard →', OUT)
console.log(`customers ${customers.length} (active ${active} / expired ${expired}) · revenue ${inr(revenue)} · MRR ${inr(mrr)} · visitors ${visitors ?? 'n/a'}`)
