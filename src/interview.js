// A mock system-design interview, grounded in the loaded template's own
// breakdown rather than in a language model.
//
// Being honest about what this is: it is a rubric. It knows what a good answer
// to *this* design contains because the breakdown already says so, it detects
// which of those things you actually said, and it probes the ones you missed.
// It cannot follow an arbitrary tangent, and it should never pretend otherwise
// — an interviewer that nods along to anything teaches nothing.

// ── extracting what a good answer contains ──────────────────────────────────

const STOP = new Set(('the a an and or of to in for on with by is are be that this it as at from we you i not but if then '
  + 'so do does can will would should could may might have has had was were their there them they our your its').split(' '))

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Singular/plural and the handful of endings that matter here. Deliberately
// crude: an aggressive stemmer produces false matches, which is worse than
// missing one, because a candidate credited for something they did not say
// gets no feedback about it.
const stem = w => w
  .replace(/ies$/, 'y').replace(/([^s])s$/, '$1')
  .replace(/ing$/, '').replace(/ed$/, '')

const words = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w)).map(stem)

// Concepts every system-design answer is expected to touch, whatever the
// system. Terms are alternatives — any one of them counts as a hit.
export const UNIVERSAL = [
  { id: 'scoping-out', label: 'States what is out of scope', stage: 'requirements', weight: 3,
    terms: ['out of scope', 'not building', 'leave out', 'leaving out', 'exclude', 'excluding', 'we will not', 'not going to', 'ignore', 'assume away'] },
  { id: 'functional', label: 'Functional requirements', stage: 'requirements', weight: 3,
    terms: ['functional', 'the user can', 'users can', 'should be able', 'requirement', 'feature', 'we need to support'] },
  { id: 'nonfunctional', label: 'Non-functional requirements', stage: 'requirements', weight: 2,
    terms: ['non functional', 'nonfunctional', 'availability', 'latency', 'durability', 'sla', 'uptime', 'p99', 'consistency'] },
  { id: 'scale-numbers', label: 'Concrete numbers', stage: 'estimation', weight: 3,
    terms: ['rps', 'qps', 'per second', 'requests per', 'million', 'billion', 'terabyte', 'gigabyte', 'petabyte', 'daily active', 'dau', 'throughput'] },
  { id: 'read-write-ratio', label: 'Read/write ratio', stage: 'estimation', weight: 2,
    terms: ['read heavy', 'write heavy', 'read write ratio', 'reads to writes', 'ratio of read', 'mostly read', 'mostly write'] },
  { id: 'storage-estimate', label: 'Storage estimate', stage: 'estimation', weight: 2,
    terms: ['storage', 'disk', 'how much data', 'data volume', 'retention', 'per year', 'per day'] },
  { id: 'bottleneck', label: 'Names the bottleneck', stage: 'high-level', weight: 3,
    terms: ['bottleneck', 'saturate', 'hot spot', 'hotspot', 'contention', 'limiting factor', 'chokepoint'] },
  { id: 'caching', label: 'Caching', stage: 'high-level', weight: 2,
    terms: ['cache', 'caching', 'cdn', 'memcache', 'redis', 'invalidation', 'ttl'] },
  { id: 'partitioning', label: 'Partitioning / sharding', stage: 'high-level', weight: 3,
    terms: ['shard', 'sharding', 'partition', 'partitioning', 'consistent hashing', 'split the data'] },
  { id: 'replication', label: 'Replication', stage: 'high-level', weight: 2,
    terms: ['replica', 'replication', 'follower', 'leader', 'failover', 'standby'] },
  { id: 'consistency', label: 'Consistency model', stage: 'deep-dives', weight: 3,
    terms: ['consistency', 'consistent', 'eventual', 'linearizable', 'stale', 'isolation', 'transaction', 'acid', 'quorum'] },
  { id: 'failure', label: 'Failure handling', stage: 'deep-dives', weight: 3,
    terms: ['fail', 'failure', 'crash', 'retry', 'idempotent', 'timeout', 'outage', 'degrade', 'fallback', 'circuit breaker'] },
  { id: 'tradeoff', label: 'States a trade-off', stage: 'deep-dives', weight: 3,
    terms: ['trade off', 'tradeoff', 'in exchange', 'at the cost', 'the downside', 'we give up', 'in return', 'versus', 'instead of', 'cheaper but', 'faster but'] },
  { id: 'next-order', label: 'What breaks at 10×', stage: 'wrap', weight: 3,
    terms: ['ten times', '10x', '10 times', 'order of magnitude', 'next order', 'an order of', 'as it grows', 'at that scale'] },
  { id: 'wrap-limit', label: 'Names what fails first', stage: 'wrap', weight: 3,
    terms: ['break', 'breaks', 'fall over', 'saturate', 'run out', 'limit', 'first thing', 'would fail'] },
  { id: 'wrap-change', label: 'Names the change to make', stage: 'wrap', weight: 2,
    terms: ['i would', 'we would', 'migrate', 'move to', 'introduce', 'split', 'add a', 'switch to', 'rewrite'] },
  { id: 'async', label: 'Async / queueing', stage: 'high-level', weight: 2,
    terms: ['queue', 'async', 'asynchronous', 'background', 'worker', 'event', 'kafka', 'stream', 'buffer'] },
]

// Terms pulled out of the loaded design, so the interview is about this system
// and not a generic one.
export function conceptsFromTemplate(template, breakdown) {
  const out = []
  const sec = id => breakdown?.sections?.find(s => s.id === id)
  // Block payloads are sometimes arrays and sometimes objects such as
  // { core: [...], out: [...] }. Walking both was the difference between
  // extracting the requirements and silently extracting nothing.
  const strings = (v, acc = []) => {
    if (typeof v === 'string') acc.push(v)
    else if (Array.isArray(v)) v.forEach(x => strings(x, acc))
    else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, acc))
    return acc
  }
  const textOf = s => (s?.blocks || []).flatMap(b => strings(b[1]))

  for (const item of (template.checklist || []).slice(0, 6)) {
    const w = words(item).slice(0, 4)
    if (w.length) out.push({ id: 'chk:' + w[0], label: item, stage: 'high-level', weight: 2, terms: [w.join(' '), ...w.slice(0, 2)] })
  }
  for (const id of ['functional-requirements', 'non-functional-requirements']) {
    for (const line of textOf(sec(id)).slice(0, 5)) {
      const w = words(line).slice(0, 3)
      if (w.length >= 2) out.push({ id: 'req:' + w[0], label: line.slice(0, 90), stage: 'requirements', weight: 2, terms: [w.join(' '), w[0]] })
    }
  }
  for (const d of (breakdown?.sections || []).filter(s => /^dd-/.test(s.id))) {
    const title = d.title.replace(/^\d+\)\s*/, '')
    const w = words(title).slice(0, 4)
    if (w.length) out.push({ id: 'dd:' + d.id, label: title, stage: 'deep-dives', weight: 3, terms: [w.join(' '), ...w.slice(0, 3)] })
  }
  // de-dupe on id, keeping the first
  const seen = new Set()
  return out.filter(c => !seen.has(c.id) && seen.add(c.id))
}

// ── the interview itself ────────────────────────────────────────────────────

export const STAGES = [
  { id: 'requirements', title: 'Requirements',
    ask: d => `Let's design ${d}. Before you draw anything — what are we actually building? Tell me the functional requirements, and what you are deliberately leaving out.`,
    probe: 'What is explicitly out of scope? Naming what you are not building is part of the answer.' },
  { id: 'estimation', title: 'Scale',
    ask: () => 'Good. Now put numbers on it. How much traffic, how much data, and what is the read to write ratio?',
    probe: 'Give me a rough number rather than a category — even an order of magnitude changes the design.' },
  { id: 'high-level', title: 'High-level design',
    ask: () => 'Walk me through the design. Start at the client and follow one request all the way to storage and back.',
    probe: 'Which component saturates first as traffic grows?' },
  { id: 'deep-dives', title: 'Deep dive',
    ask: (d, dd) => dd ? `Let's go deeper on one thing: ${dd}. How do you handle it?` : 'Pick the hardest part of this design and go deep on it.',
    probe: 'What does that cost you? Every choice here gives something up.' },
  { id: 'wrap', title: 'Wrap-up',
    ask: () => 'Last one. What would break first at ten times this load, and what would you change?',
    probe: null },
]

export function buildInterview(template, breakdown) {
  const concepts = [...UNIVERSAL, ...conceptsFromTemplate(template, breakdown)]
  const dd = (breakdown?.sections || []).filter(s => /^dd-/.test(s.id)).map(s => s.title.replace(/^\d+\)\s*/, ''))
  return {
    design: template.name,
    stages: STAGES.map(s => ({
      ...s,
      question: s.ask(template.name, dd[0]),
      concepts: concepts.filter(c => c.stage === s.id),
    })),
    concepts,
  }
}

// ── scoring an answer ───────────────────────────────────────────────────────

export function matchConcepts(answer, concepts) {
  const hay = ' ' + words(answer).join(' ') + ' '
  const raw = ' ' + norm(answer) + ' '
  const hit = [], missed = []
  for (const c of concepts) {
    const found = c.terms.some(t => {
      const nt = norm(t)
      if (nt.includes(' ')) return raw.includes(' ' + nt + ' ') || raw.includes(' ' + nt)
      return hay.includes(' ' + stem(nt) + ' ')
    })
    ;(found ? hit : missed).push(c)
  }
  return { hit, missed }
}

// Signals about *how* it was said, not what. Interviewers weigh these heavily
// and candidates almost never get told about them.
export function communicationSignals(answers) {
  const all = answers.join(' ')
  const wc = norm(all).split(' ').filter(Boolean).length
  const asked = answers.filter(a => /\?/.test(a)).length
  const hedges = (norm(all).match(/\b(maybe|probably|i guess|not sure|kind of|sort of|i think)\b/g) || []).length
  const structure = (norm(all).match(/\b(first|second|third|then|next|finally|because|so that|the reason)\b/g) || []).length
  return {
    words: wc,
    tooShort: wc < 120,
    clarifyingQuestions: asked,
    hedgeRate: wc ? hedges / (wc / 100) : 0,
    structureMarkers: structure,
  }
}

// ── the report ──────────────────────────────────────────────────────────────

const BANDS = [
  { min: 0,    band: 'Below mid-level', gist: 'The shape of an answer is there, but the specifics that make it a design are missing.' },
  { min: 0.35, band: 'Mid-level',       gist: 'Covers the standard components and gets a working design out. Light on numbers and on why.' },
  { min: 0.6,  band: 'Senior',          gist: 'Names the bottleneck, justifies the choices, and volunteers what each one costs.' },
  { min: 0.82, band: 'Staff+',          gist: 'Scopes the problem, quantifies it, and argues the trade-offs without being asked.' },
]

export const bandFor = score => [...BANDS].reverse().find(b => score >= b.min) || BANDS[0]

export function report(interview, transcript) {
  const byStage = {}
  for (const st of interview.stages) {
    const answers = transcript.filter(t => t.stage === st.id && t.role === 'candidate').map(t => t.text)
    const { hit, missed } = matchConcepts(answers.join(' \n '), st.concepts)
    const total = st.concepts.reduce((a, c) => a + c.weight, 0)
    const got = hit.reduce((a, c) => a + c.weight, 0)
    byStage[st.id] = {
      title: st.title,
      score: total ? got / total : 0,
      hit, missed,
      answered: answers.length > 0,
      scorable: st.concepts.length > 0,
      words: norm(answers.join(' ')).split(' ').filter(Boolean).length,
    }
  }

  const weights = { requirements: 1, estimation: 1, 'high-level': 1.4, 'deep-dives': 1.6, wrap: 0.8 }
  let num = 0, den = 0
  for (const [id, s] of Object.entries(byStage)) {
    // A stage with nothing to listen for cannot be scored. Averaging a
    // guaranteed zero into the total would penalise the candidate for a gap in
    // the rubric rather than in their answer.
    if (!s.scorable) continue
    num += s.score * (weights[id] || 1); den += (weights[id] || 1)
  }
  const overall = den ? num / den : 0

  const comms = communicationSignals(transcript.filter(t => t.role === 'candidate').map(t => t.text))

  const strengths = Object.values(byStage).filter(s => s.score >= 0.6)
    .map(s => `${s.title}: covered ${s.hit.length} of ${s.hit.length + s.missed.length} of the things I was listening for.`)

  const improve = []
  for (const [id, s] of Object.entries(byStage)) {
    if (!s.scorable || s.score >= 0.6 || !s.missed.length) continue
    improve.push({
      area: s.title,
      severity: s.score < 0.3 ? 'high' : 'medium',
      missed: s.missed.slice(0, 4).map(c => c.label),
      advice: ADVICE[id] || 'Go back to the Breakdown tab for this design and read the section of the same name.',
    })
  }
  if (comms.tooShort) improve.push({ area: 'Depth of answer', severity: 'high', missed: [],
    advice: `About ${comms.words} words across the whole interview. A real answer to any one of these stages is longer than that. Say the reasoning out loud rather than only the conclusion.` })
  if (comms.clarifyingQuestions === 0) improve.push({ area: 'Clarifying questions', severity: 'medium', missed: [],
    advice: 'You asked none. Interviewers give marks for narrowing an ambiguous problem before designing, and deliberately leave the brief vague to see whether you will.' })
  if (comms.hedgeRate > 4) improve.push({ area: 'Conviction', severity: 'low', missed: [],
    advice: 'A lot of hedging ("maybe", "I think"). Commit to a choice and name its cost — that reads as judgement. Hedging reads as not knowing.' })
  if (comms.structureMarkers < 3) improve.push({ area: 'Signposting', severity: 'low', missed: [],
    advice: 'Signpost the structure: "first… then… the reason is…". It is the cheapest way to sound organised, and it stops the interviewer losing the thread.' })

  return { overall, band: bandFor(overall), byStage, comms, strengths, improve }
}

const ADVICE = {
  requirements: 'Start by narrowing. State what is in, state what is out, and get agreement before designing. Most weak interviews are lost here, not in the deep dive.',
  estimation: 'Do the arithmetic out loud. Requests per second, bytes per record, total storage. The numbers are what tell you whether one machine will do.',
  'high-level': 'Follow one request end to end and name the component that saturates first. A diagram without a bottleneck is a drawing, not a design.',
  'deep-dives': 'Pick the part that is genuinely hard and stay there. Say what your approach gives up — an answer with no cost stated reads as one you have not thought through.',
  wrap: 'Have a rehearsed answer for what breaks at ten times the load. It is asked in almost every interview.',
}
