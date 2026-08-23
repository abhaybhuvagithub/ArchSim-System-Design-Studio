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
//
// PUBLISH MODE — a real URL, safely:
//   node scripts/admin.mjs --publish --pass 'your strong passphrase'
// encrypts the dashboard (PBKDF2 200k + AES-GCM via WebCrypto) and writes
// public/admin-dashboard.html — ciphertext plus an in-browser decryptor.
// Committing and deploying THAT is safe: the public site serves only the
// ciphertext, and the passphrase never leaves your head. Then:
//   bash scripts/deploy.sh
// and the dashboard lives at /admin-dashboard.html behind your passphrase.
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

// ── publish mode: encrypted copy for the public site ───────────────────────
if (process.argv.includes('--publish')) {
  const pass = arg('pass', process.env.ADMIN_PASS || '')
  if (!pass || pass.length < 8) {
    console.error('publish needs --pass (8+ chars): the passphrase is the entire security of the public copy')
    process.exit(1)
  }
  const { webcrypto } = await import('node:crypto')
  const enc = new TextEncoder()
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const keyMat = await webcrypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  const key = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const cipher = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(html)))
  const b64 = (u8) => Buffer.from(u8).toString('base64')
  const PUB = arg('publish-out', path.join(here, '..', 'public', 'admin-dashboard.html'))
  const shell = `<!doctype html><html><head><meta charset="utf-8"><title>ArchSim — Admin</title>
<meta name="robots" content="noindex,nofollow"><style>
  body { font: 14px/1.5 system-ui, sans-serif; background: #0e1116; color: #e6e9ef; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .box { background: #161b24; border: 1px solid #2a3242; border-radius: 12px; padding: 26px; width: min(360px, 90vw); }
  h1 { font-size: 16px; margin: 0 0 10px; } input, button { font: inherit; width: 100%; box-sizing: border-box; border-radius: 8px; border: 1px solid #2a3242; padding: 9px 10px; }
  input { background: #0e1116; color: inherit; margin-bottom: 10px; } button { background: #5b8cff; color: #fff; border: 0; cursor: pointer; font-weight: 600; }
  .err { color: #ff6b6b; font-size: 12.5px; min-height: 1.2em; margin-top: 8px; } .muted { opacity: .55; font-size: 12px; margin-top: 10px; }
</style></head><body>
<div class="box"><h1>🔐 Admin dashboard</h1>
<input id="p" type="password" placeholder="Passphrase" autofocus>
<button id="go">Unlock</button><div class="err" id="e"></div>
<div class="muted">Encrypted at rest (PBKDF2·AES-GCM). Decryption happens only in this browser.</div></div>
<script>
const SALT='${b64(salt)}',IV='${b64(iv)}',DATA='${b64(cipher)}';
const un=(s)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function unlock(){
  const pass=document.getElementById('p').value; const e=document.getElementById('e'); e.textContent='';
  try{
    const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:un(SALT),iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un(IV)},k,un(DATA));
    document.open(); document.write(new TextDecoder().decode(plain)); document.close();
  }catch{ e.textContent='Wrong passphrase.'; }
}
document.getElementById('go').onclick=unlock;
document.getElementById('p').addEventListener('keydown',ev=>{if(ev.key==='Enter')unlock()});
</script></body></html>`
  fs.writeFileSync(PUB, shell)
  console.log('encrypted public copy →', PUB)
  console.log('deploy it: bash scripts/deploy.sh  → /admin-dashboard.html unlocks with your passphrase')
}
