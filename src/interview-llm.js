// Optional: drive the interviewer with a real model instead of the rubric.
//
// Read this before enabling it. The key you paste lives in this browser tab and
// is sent directly from your machine to the provider. It is never sent to this
// site, never stored on a server, and never written to a file — but on a public
// deployment anyone who opens the page and enables this can spend your money
// with your key. Session storage rather than local storage is deliberate: the
// key dies with the tab rather than sitting on disk until you remember it.

export const KEY_STORE = 'archsim.interview.key'
export const BASE_STORE = 'archsim.interview.base'
export const MODEL_STORE = 'archsim.interview.model'
// Offered as a starting point, not a whitelist — the field accepts anything,
// because model names change faster than this file will.
export const MODEL_CHOICES = {
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  bharatgpt: ['BharatGPT-3B-Indic'],
}

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    url: () => 'https://api.anthropic.com/v1/messages',
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
  bharatgpt: {
    label: 'BharatGPT (CoRover)',
    needsBaseUrl: true,
    model: 'BharatGPT-3B-Indic',
    // CoRover does not publish a public REST endpoint — access is granted per
    // tenant through builder.corover.ai. The open BharatGPT-3B-Indic weights
    // are on Hugging Face and can be served behind any OpenAI-compatible
    // endpoint. Either way the base URL is yours, so it is asked for rather
    // than invented: a hard-coded guess would fail silently.
    note: 'BharatGPT has no public API endpoint. Paste the OpenAI-compatible base URL for your CoRover tenant, or for wherever you are serving the open BharatGPT-3B-Indic weights.',
    url: base => String(base || '').replace(/\/+$/, '') + '/chat/completions',
    headers: key => ({ 'content-type': 'application/json', authorization: 'Bearer ' + key }),
    body: (model, system, messages) => JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'system', content: system }, ...messages] }),
    text: j => (j?.choices?.[0]?.message?.content || '').trim(),
  },
  openai: {
    label: 'OpenAI',
    url: () => 'https://api.openai.com/v1/chat/completions',
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
export async function ask({ provider = 'anthropic', key, baseUrl, model, system, messages, fetchImpl }) {
  const p = PROVIDERS[provider]
  if (!p) throw new Error('Unknown provider')
  if (!key) throw new Error('No API key')
  if (p.needsBaseUrl && !baseUrl) throw new Error('This provider needs a base URL — see the note under the provider picker.')
  const f = fetchImpl || fetch
  const url = p.url(baseUrl)
  const msgs = normaliseMessages(messages)
  if (!msgs.length) throw new Error('Nothing to send yet.')
  const res = await f(url, { method: 'POST', headers: p.headers(key), body: p.body(model || p.model, system, msgs) })
  if (!res.ok) {
    const status = res.status
    let detail = ''
    try {
      const body = await res.text()
      const j = (() => { try { return JSON.parse(body) } catch { return null } })()
      detail = j?.error?.message || j?.message || body.slice(0, 300)
    } catch { /* body already consumed or unreadable */ }
    const head = status === 401 ? 'The provider rejected that key.'
      : status === 429 ? 'Rate limited by the provider.'
      : status === 404 ? 'No such endpoint or model at that address.'
      : `The provider returned ${status}.`
    throw new Error(redact(detail ? head + ' ' + detail : head))
  }
  return p.text(await res.json())
}

// Redaction for anything that might get displayed or copied.
export const redact = s => String(s || '').replace(/\b(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,})\b/g, '[key redacted]')


export const getBase = () => { try { return sessionStorage.getItem(BASE_STORE) || '' } catch { return '' } }
export const setBase = v => { try { v ? sessionStorage.setItem(BASE_STORE, v) : sessionStorage.removeItem(BASE_STORE) } catch { /* blocked */ } }


// The 400. A transcript starts with the interviewer's opening question, which
// maps to an assistant message — and the Messages API requires the first
// message to come from the user, with roles alternating after that. Sending
// the transcript verbatim is rejected outright.
export function normaliseMessages(messages) {
  const out = []
  for (const m of messages || []) {
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : 'user'
    const content = String(m.content ?? '').trim()
    if (!content) continue
    if (!out.length && role === 'assistant') continue           // cannot open on the assistant
    const last = out[out.length - 1]
    if (last && last.role === role) last.content += '\n\n' + content   // no two in a row
    else out.push({ role, content })
  }
  while (out.length && out[out.length - 1].role === 'assistant') out.pop()  // must end on the user
  return out
}

export const getModel = () => { try { return sessionStorage.getItem(MODEL_STORE) || '' } catch { return '' } }
export const setModel = v => { try { v ? sessionStorage.setItem(MODEL_STORE, v) : sessionStorage.removeItem(MODEL_STORE) } catch { /* blocked */ } }
