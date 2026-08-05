// The recoverable part of a crash, kept out of the JSX so it can be tested.
//
// The case that matters: if corrupt saved state is what crashes the render,
// the app blanks on every reload and there is no way back from inside the UI.
// Clearing this app's own keys is that way back — and it must not touch keys
// belonging to anything else on the origin.

export const PREFIX = 'archsim.'

export function appKeys(storage) {
  const out = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(PREFIX)) out.push(k)
    }
  } catch { /* storage blocked */ }
  return out
}

export function clearSavedState(storage) {
  const keys = appKeys(storage)
  for (const k of keys) { try { storage.removeItem(k) } catch { /* ignore */ } }
  return keys.length
}

export function describe(error) {
  const msg = String(error?.message || error || 'Unknown error')
  return msg.length > 400 ? msg.slice(0, 400) + '…' : msg
}
