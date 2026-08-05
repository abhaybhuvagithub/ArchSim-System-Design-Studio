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
// Most of these speak the OpenAI wire format, so one adapter covers them. A
// base URL is hard-coded only where the provider publishes one; where it does
// not, it is asked for. Guessing would produce a provider that fails against a
// host that may not exist, which is worse than not offering it.
const oai = (label, base, models, extra = {}) => ({
  label,
  base,                        // null → the user supplies it
  needsBaseUrl: !base,
  model: models[0],
  models,
  url: b => String(b || base || '').replace(/\/+$/, '') + '/chat/completions',
  headers: key => ({ 'content-type': 'application/json', authorization: 'Bearer ' + key }),
  body: (model, system, messages) => JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'system', content: system }, ...messages] }),
  text: j => (j?.choices?.[0]?.message?.content || '').trim(),
  ...extra,
})

export const PROVIDERS = {
  // Anthropic is not OpenAI-shaped: system is a top-level field, and calling it
  // from a browser needs an explicit opt-in header.
  anthropic: {
    label: 'Anthropic — Claude',
    base: 'https://api.anthropic.com/v1',
    needsBaseUrl: false,
    model: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: key => ({
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (model, system, messages) => JSON.stringify({ model, max_tokens: 700, system, messages }),
    text: j => (j?.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim(),
  },

  openai: oai('OpenAI — GPT', 'https://api.openai.com/v1',
    ['gpt-4o', 'gpt-4o-mini', 'o3-mini']),

  google: oai('Google — Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai',
    ['gemini-2.5-pro', 'gemini-2.5-flash'],
    { note: 'Uses Gemini\u2019s OpenAI-compatible endpoint with a Google AI Studio key. That endpoint is still beta and covers only part of the OpenAI surface.' }),

  deepseek: oai('DeepSeek', 'https://api.deepseek.com/v1',
    ['deepseek-chat', 'deepseek-reasoner']),

  qwen: oai('Qwen (Alibaba)', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    { note: 'Alibaba Model Studio\u2019s OpenAI-compatible endpoint. This is the international host; mainland China and the per-region hosts use different base URLs, so override it above if yours differs.' }),

  kimi: oai('Kimi (Moonshot AI)', 'https://api.moonshot.ai/v1',
    ['kimi-k2.5', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    { note: 'Moonshot\u2019s OpenAI-compatible endpoint. The .ai host is the international one; api.moonshot.cn serves mainland China.' }),


  custom: oai('Self-hosted / other (OpenAI-compatible)', null,
    ['llama-3.3-70b-instruct'],
    { note: 'For anything you run or subscribe to yourself \u2014 Llama on Bedrock, Groq, Together or vLLM, a CoRover BharatGPT tenant, or AI4Bharat and BharatGen weights you are serving. Paste the base URL and any model name it accepts.' }),

  sarvam: oai('Sarvam AI', 'https://api.sarvam.ai/v1',
    ['sarvam-m', 'sarvam-30b', 'sarvam-105b'],
    { note: 'Indic-first models from Bengaluru. The endpoint also accepts its own api-subscription-key header; the OpenAI-compatible bearer form is used here.' }),

  krutrim: oai('Krutrim (Ola)', 'https://cloud.olakrutrim.com/v1',
    ['krutrim-1']),



}

// Kept as a separate export because the UI reads it directly.
export const MODEL_CHOICES = Object.fromEntries(
  Object.entries(PROVIDERS).map(([k, p]) => [k, p.models]))

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
  let res
  try {
    res = await f(url, { method: 'POST', headers: p.headers(key), body: p.body(model || p.model, system, msgs) })
  } catch (e) {
    // A cross-origin block surfaces as a bare TypeError with no status, which
    // reads as a mystery unless it is named.
    throw new Error('Could not reach ' + url + '. If the provider does not allow browser requests this will always fail from a web page, and the request has to go through a server you control.')
  }
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
