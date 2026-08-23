#!/usr/bin/env node
// Mint an ArchSim Pro license key after a payment arrives.
//
//   node scripts/genkey.mjs lifetime
//   node scripts/genkey.mjs yearly
//   node scripts/genkey.mjs monthly
//   node scripts/genkey.mjs monthly 5     (mint five)
//
// Same code path as the in-app validator (src/license.js), so a minted key
// can never drift from what the app accepts.
//
// Every minted key is appended to scripts/issued-keys.log (GITIGNORED — the
// repo is public and this file holds customer keys). The ledger does two
// jobs: it makes duplicate issuance impossible (a fresh mint that collides
// with any previously issued key is discarded and re-rolled), and it is the
// sales record your accountant will thank you for.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeKey, validateKey } from '../src/license.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const LEDGER = path.join(here, 'issued-keys.log')

const plan = process.argv[2]
const count = Math.max(1, Math.min(50, parseInt(process.argv[3] || '1', 10) || 1))
if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
  console.error('usage: node scripts/genkey.mjs <monthly|yearly|lifetime> [count]')
  process.exit(1)
}

const issued = new Set(
  fs.existsSync(LEDGER)
    ? fs.readFileSync(LEDGER, 'utf8').split('\n').map(l => l.split('\t')[0]).filter(Boolean)
    : []
)

for (let i = 0; i < count; i++) {
  let key, tries = 0
  do {
    key = makeKey(plan)
    if (++tries > 100) { console.error('could not mint a unique key — ledger anomaly?'); process.exit(1) }
  } while (issued.has(key))
  const v = validateKey(key)
  if (!v.ok) { console.error('self-check failed for', key, v.reason); process.exit(1) }
  issued.add(key)
  fs.appendFileSync(LEDGER, `${key}\t${plan}\t${new Date().toISOString()}\n`)
  console.log(key, v.lifetime ? '(lifetime)' : `(expires ${v.expires})`)
}
console.error(`ledger: ${LEDGER} now holds ${issued.size} issued keys (gitignored)`)
