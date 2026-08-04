// Optional: drive the interviewer with a real model instead of the rubric.
//
// Read this before enabling it. The key you paste lives in this browser tab and
// is sent directly from your machine to the provider. It is never sent to this
// site, never stored on a server, and never written to a file — but on a public
// deployment anyone who opens the page and enables this can spend your money
// with your key. Session storage rather than local storage is deliberate: the
// key dies with the tab rather than sitting on disk until you remember it.

export const KEY_STORE = 'archsim.interview.key'
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-5',
    headers: key => ({
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (model, system, messages) => JSON.stringify({ model, max_tokens: 700, system, messages }),
    text: j => (j?.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim(),
  },
  openai: {
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    headers: key => ({ 'content-type': 'application/json', authorization: 'Bearer ' + key }),
    body: (model, system, messages) => JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'system', content: system }, ...messages] }),
    text: j => (j?.choices?.[0]?.message?.content || '').trim(),
  },
}

export const getKey = () => { try { return sessionStorage.getItem(KEY_STORE) || '' } catch { return '' } }
export const setKey = k => { try { k ? sessionStorage.setItem(KEY_STORE, k) : sessionStorage.removeItem(KEY_STORE) } catch { /* blocked */ } }
export const hasKey = () => !!getKey()

// Shown to the user rather than buried in a tooltip.
export const KEY_WARNING =
  'Your key is held in this browser tab only, sent straight to the provider, and cleared when the tab closes. ' +
  'It is never sent to this site. On a public page, anyone who opens it and enables this mode can spend it.'

export function systemPrompt(design, stage) {
  return [
    `You are a senior engineer conducting a system design interview about ${design}.`,
    `The current stage is "${stage}".`,
    'Ask one question at a time. Keep every reply under 70 words.',
    'Probe the specific thing the candidate left vague rather than moving on. If they state a design choice without a cost, ask what it gives up.',
    'Do not write the design for them and do not praise filler. If an answer is thin, say so plainly and ask again.',
  ].join(' ')
}

// Never logs the key, and never puts it in a URL.
export async function ask({ provider = 'anthropic', key, system, messages, fetchImpl }) {
  const p = PROVIDERS[provider]
  if (!p) throw new Error('Unknown provider')
  if (!key) throw new Error('No API key')
  const f = fetchImpl || fetch
  const res = await f(p.url, { method: 'POST', headers: p.headers(key), body: p.body(p.model, system, messages) })
  if (!res.ok) {
    const status = res.status
    throw new Error(status === 401 ? 'The provider rejected that key.'
      : status === 429 ? 'Rate limited by the provider.'
      : `The provider returned ${status}.`)
  }
  return p.text(await res.json())
}

// Redaction for anything that might get displayed or copied.
export const redact = s => String(s || '').replace(/\b(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,})\b/g, '[key redacted]')
