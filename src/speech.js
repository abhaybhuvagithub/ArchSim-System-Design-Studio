// Reading the panels aloud.
//
// The interesting part is not calling speechSynthesis — it is everything
// around it. Written technical prose read verbatim by a screen reader voice is
// close to unlistenable: "p99" becomes "p ninety nine", "TTL" becomes a word,
// "→" is either skipped or announced, and a code block is noise. So the text
// is prepared before it is spoken, and the DOM is walked rather than dumped so
// diagrams, buttons and the contents rail are left out.

export const speechSupported = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof window.SpeechSynthesisUtterance === 'function'

// Elements whose text should never be read: they are navigation, decoration,
// or unlistenable by nature.
const SKIP_SELECTOR = [
  'svg', 'pre', 'code',
  '.bd-toc', '.bd-dia', '.bd-schema', '.tabs', '.panel-bar',
  'button', 'input', 'select', 'textarea',
  '[aria-hidden="true"]', '[data-no-speech]',
].join(',')

// Read as a block, in document order.
const BLOCK_SELECTOR = [
  'h3', 'h4', 'h5',
  'p', 'li', '.brief-h', '.bd-h1', '.bd-h2', '.bd-call',
  '.wt-p', '.sc-rung-r', '.sc-lever p', '.bd-ent', '.bd-num',
].join(',')

// Spoken out, not spelled. Anything not here is left alone.
const ABBREV = [
  [/\brps\b/gi, 'requests per second'],
  [/\bQPS\b/g, 'queries per second'],
  [/\bTPS\b/g, 'transactions per second'],
  [/\bDAU\b/g, 'daily active users'],
  [/\bMAU\b/g, 'monthly active users'],
  [/\bTTL\b/g, 'T T L'],
  [/\bCDN\b/g, 'C D N'],
  [/\bAPI\b/g, 'A P I'],
  [/\bSQL\b/g, 'sequel'],
  [/\bACID\b/g, 'acid'],
  [/\bCAP\b/g, 'cap'],
  [/\bLLM\b/g, 'L L M'],
  [/\bGPU(s?)\b/g, 'G P U$1'],
  [/\bCPU(s?)\b/g, 'C P U$1'],
  [/\bUPI\b/g, 'U P I'],
  [/\bNPCI\b/g, 'N P C I'],
  [/\bPSP(s?)\b/g, 'P S P$1'],
  [/\bPSS\b/g, 'P S S'],
  [/\bGDS\b/g, 'G D S'],
  [/\bSEO\b/g, 'S E O'],
  [/\bRFQ(s?)\b/g, 'R F Q$1'],
  [/\bCOD\b/g, 'cash on delivery'],
  [/\bOTP\b/g, 'O T P'],
  [/\bSLA(s?)\b/g, 'S L A$1'],
  [/\bSLO(s?)\b/g, 'S L O$1'],
  [/\bWAF\b/g, 'W A F'],
  [/\bGSLB\b/g, 'G S L B'],
  [/\bSSO\b/g, 'single sign-on'],
  [/\bHSM(s?)\b/g, 'H S M$1'],
  [/\bCDC\b/g, 'change data capture'],
  [/\bE?TL\b/g, m => (m === 'ETL' ? 'E T L' : m)],
  [/\bOLAP\b/g, 'O L A P'],
  [/\bANN\b/g, 'A N N'],
  [/\bFC(s?)\b/g, 'fulfilment centre$1'],
  [/\bLB\b/g, 'load balancer'],
  [/\bFIM\b/g, 'fill in the middle'],
  [/\bp(50|95|99)\b/g, 'p $1'],
]

// Symbols and shorthand that would otherwise be read literally, skipped, or
// turned into noise. Order matters — the comments mark where it does.
const SYMBOLS = [
  [/→/g, ' then '],
  [/←/g, ' back to '],
  [/↔/g, ' both ways '],
  [/[·•]/g, ', '],
  [/[—–]/g, ', '],
  [/…/g, '. '],
  [/−/g, '-'],
  [/\bµsvc\b/gi, 'microservice'],
  [/µ/g, 'micro'],
  [/(\d)ⁿ/g, '$1 to the power n'],
  [/[✓✔]/g, ' yes '],
  [/[✗✕✖]/g, ' no '],
  [/[⚠🧱📖↗⤢⤡⠿🎓💵✨🐒❙■▶↑]/gu, ' '],
  [/×/g, ' times '],
  [/≈/g, ' about '],
  [/≥/g, ' at least '],
  [/≤/g, ' at most '],

  // "~" is nearly always glued to a number here — ~2 TB, ~12K/s — so matching
  // only the space-separated form missed almost every real case.
  [/~\s*(?=[\d.])/g, 'about '],
  [/\s~\s/g, ' about '],

  [/\b24\/7\b/g, 'twenty-four seven'],   // before the a/b rule makes it "24 of 7"

  // magnitudes first, so "4B/day" is "4 billion" before the rate rule runs
  [/(\d)\s*K\b/g, '$1 thousand'],
  [/(\d)\s*M\b/g, '$1 million'],
  [/(\d)\s*B\b/g, '$1 billion'],

  // units glued to a digit have no word boundary, so \bms\b never matched 277ms
  [/(\d)\s*ms\b/g, '$1 milliseconds'],
  [/(\d)\s*TB\b/g, '$1 terabytes'],
  [/(\d)\s*GB\b/g, '$1 gigabytes'],
  [/(\d)\s*MB\b/g, '$1 megabytes'],
  [/(\d)\s*KB\b/g, '$1 kilobytes'],

  // rates, after magnitudes so "12 thousand/s" resolves
  [/\s*\/\s*s\b/g, ' per second'],
  [/\s*\/\s*day\b/gi, ' per day'],
  [/\s*\/\s*hr\b/gi, ' per hour'],
  [/\s*\/\s*min\b/gi, ' per minute'],
  [/\s*\/\s*mo\b/gi, ' per month'],
  [/\s*\/\s*user\b/gi, ' per user'],

  [/(\d)\s*:\s*(\d)/g, '$1 to $2'],      // 100:1, 1:1
  [/(\d)\s*\/\s*(\d)/g, '$1 of $2'],     // 2/13
  // "read/write", "L4/L7", "AI / ML" — engines announce the slash. A pause
  // reads better than "or", which would change the sense of "read/write ratio".
  // A slash that starts a path ("GET /users") is left alone: "slash" is right
  // there, which is why this only fires between two word characters.
  [/(\w)\s*\/\s*(\w)/g, '$1 $2'],

  [/&/g, ' and '],
  [/\^/g, ' to the power of '],
  [/[{}[\]]/g, ''],                      // GET /{shortCode} → GET /shortCode

  // and the standalone forms, for "50 TB" style with a space
  [/\bTB\b/g, ' terabytes'],
  [/\bGB\b/g, ' gigabytes'],
  [/\bMB\b/g, ' megabytes'],
  [/\bKB\b/g, ' kilobytes'],
  [/\bms\b/g, ' milliseconds'],
]

// Turn written technical prose into something worth listening to.
export function speakableText(input) {
  let s = String(input || '')
  s = s.replace(/\*\*(.+?)\*\*/g, '$1')          // markdown bold from RichLine
  s = s.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,;:!?)]|$)/g, '$1$2')  // single-star emphasis
  for (const [re, to] of SYMBOLS) s = s.replace(re, to)
  for (const [re, to] of ABBREV) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ').trim()
}

// Walk a container and pull out the blocks worth reading, each paired with the
// element it came from so the caller can highlight along.
export function extractSpeech(root) {
  if (!root) return []
  const out = []
  const seen = new Set()
  for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (el.closest(SKIP_SELECTOR)) continue
    // a nested match (a <p> inside an .sc-lever) should only be read once
    if ([...seen].some(prev => prev.contains(el))) continue
    const clone = el.cloneNode(true)
    for (const junk of clone.querySelectorAll(SKIP_SELECTOR)) junk.remove()
    const text = speakableText(clone.textContent)
    if (text.length < 2) continue
    seen.add(el)
    out.push({ el, text })
  }
  return out
}

// Long utterances are unreliable across engines, and a short one is also the
// simplest defence against Chrome's habit of stopping after ~15 seconds.
export function chunkText(text, max = 220) {
  const parts = []
  let buf = ''
  for (const sentence of String(text).split(/(?<=[.!?])\s+/)) {
    if (!sentence) continue
    if ((buf + ' ' + sentence).trim().length > max && buf) { parts.push(buf.trim()); buf = sentence }
    else buf = (buf ? buf + ' ' : '') + sentence
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts.length ? parts : [String(text)]
}

export const RATES = [0.8, 1, 1.25, 1.5, 2]
const RATE_KEY = 'archsim.speech.rate'

export function readRate() {
  const v = Number(typeof localStorage !== 'undefined' ? localStorage.getItem(RATE_KEY) : NaN)
  return RATES.includes(v) ? v : 1
}
export function saveRate(r) {
  try { localStorage.setItem(RATE_KEY, String(r)) } catch { /* private mode */ }
}

// Pick a reasonable English voice once the list has loaded. Chrome returns an
// empty array on the first call and fills it in later, hence the event.
export function pickVoice(synth) {
  const voices = synth.getVoices() || []
  if (!voices.length) return null
  return voices.find(v => /^en[-_]GB/i.test(v.lang) && v.localService)
    || voices.find(v => /^en[-_]/i.test(v.lang) && v.localService)
    || voices.find(v => /^en[-_]/i.test(v.lang))
    || voices[0]
}
