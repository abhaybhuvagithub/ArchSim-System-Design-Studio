// Deep internals: the long form behind the 🔍 Internals button. Authored in
// tranches (internals-deep-*.js) and merged here. Components not yet written
// fall back to the short four-field internals, never to a placeholder.
import { DEEP_A } from './internals-deep-a.js'
import { DEEP_B } from './internals-deep-b.js'
import { DEEP_C } from './internals-deep-c.js'

export const DEEP_INTERNALS = { ...DEEP_A, ...DEEP_B, ...DEEP_C }
export const getDeepInternals = type => DEEP_INTERNALS[type] || null
