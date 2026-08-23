#!/usr/bin/env node
// Mint an ArchSim Pro license key after a payment arrives.
//
//   node scripts/genkey.mjs lifetime
//   node scripts/genkey.mjs yearly
//   node scripts/genkey.mjs monthly
//   node scripts/genkey.mjs monthly 5     (mint five)
//
// Same code path as the in-app validator (src/license.js), so a minted key
// can never drift from what the app accepts. Send the key to the customer,
// they paste it into the Pro dialog, done.
import { makeKey, validateKey } from '../src/license.js'

const plan = process.argv[2]
const count = Math.max(1, Math.min(50, parseInt(process.argv[3] || '1', 10) || 1))
if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
  console.error('usage: node scripts/genkey.mjs <monthly|yearly|lifetime> [count]')
  process.exit(1)
}
for (let i = 0; i < count; i++) {
  const key = makeKey(plan)
  const v = validateKey(key)
  if (!v.ok) { console.error('self-check failed for', key, v.reason); process.exit(1) }
  console.log(key, v.lifetime ? '(lifetime)' : `(expires ${v.expires})`)
}
