// Behavioural interview prep built on Amazon's 16 Leadership Principles.
//
// The principle names are Amazon's published list. Everything else here —
// the plain-language meaning, what an interviewer listens for, the questions,
// the engineering angle — is our own wording. Amazon's FAQ page itself only
// links out to the principles, so nothing here claims to quote it.
//
// Honest limits: the story checker is a rubric on the *shape* of an answer
// (situation, your own actions, a measured result, what you learned). It
// cannot judge whether the story is true or impressive. Stories you write are
// kept only in this browser.

export const PRINCIPLES = [
  { id: 'customer', name: 'Customer Obsession',
    gist: 'Start from what the customer needs and work backwards; earn and keep their trust over short-term wins.',
    listenFor: ['A named customer problem, not an internal goal', 'You gathered evidence about what they needed', 'You changed course for them at some cost to you'],
    questions: ['Tell me about a time you went well beyond the brief to help a customer.', 'Describe a time a customer asked for something you thought was wrong. What did you do?', 'When did you make a decision that was worse for the team but better for the user?'],
    tech: 'Design from the user\'s latency and availability experience: pick SLOs from what users feel, not from what the servers report.',
    redFlag: 'Talking about stakeholders or managers when asked about customers.' },
  { id: 'ownership', name: 'Ownership',
    gist: 'Act like an owner of the whole outcome, think long term, and never say "that is not my job".',
    listenFor: ['You acted without being told', 'You fixed the cause, not only the symptom', 'You took on work outside your role because it was needed'],
    questions: ['Tell me about something you owned that was not strictly yours.', 'Describe a time you sacrificed a short-term result for a long-term one.', 'Tell me about a time you found a problem nobody had assigned to anyone.'],
    tech: 'On-call and post-incident work: the owner writes the runbook, fixes the class of bug and removes the pager noise.',
    redFlag: 'Blaming another team, or describing a task you were assigned as "ownership".' },
  { id: 'simplify', name: 'Invent and Simplify',
    gist: 'Look for new ways to do things and remove complexity rather than adding it; be comfortable being misunderstood for a while.',
    listenFor: ['A concrete simpler design than the obvious one', 'What you deleted', 'Measured effect of the simplification'],
    questions: ['Tell me about a time you simplified a complicated process or system.', 'Describe an invention of yours that others doubted at first.', 'When did you choose the boring solution over the clever one, and why?'],
    tech: 'Fewer moving parts: one queue instead of three, a managed service instead of a hand-run cluster, a monolith until a boundary is real.',
    redFlag: 'A story where the result was more components.' },
  { id: 'right', name: 'Are Right, A Lot',
    gist: 'Sound judgment from data and experience; seek views that disprove you and change your mind when you are wrong.',
    listenFor: ['You made a call with incomplete data', 'You looked for disconfirming evidence', 'You admit a call you got wrong and what changed'],
    questions: ['Tell me about a decision you made with incomplete data.', 'Describe a time you were wrong. How did you find out?', 'How did you decide between two designs that both looked fine?'],
    tech: 'Write down the prediction before the load test, then compare; keep a decision log with the assumptions.',
    redFlag: 'Never being wrong, or being wrong only in a harmless way.' },
  { id: 'learn', name: 'Learn and Be Curious',
    gist: 'Never finished learning; explore new possibilities and act on them.',
    listenFor: ['Self-directed learning with a concrete outcome', 'You applied it to real work', 'You taught it to others'],
    questions: ['Tell me about a time you taught yourself something quickly to deliver.', 'What is the last technical thing you learned on your own, and what did you do with it?', 'Describe when curiosity about a failure led you to a deeper cause.'],
    tech: 'Reading the source of a database you depend on, or reproducing a paper result, then changing a design because of it.',
    redFlag: 'Listing courses with no change in what you built.' },
  { id: 'hire', name: 'Hire and Develop the Best',
    gist: 'Raise the performance bar with every hire and promotion, recognise exceptional talent, and coach others to grow.',
    listenFor: ['You held a high bar when it was inconvenient', 'Specific coaching that changed someone\'s trajectory', 'You made the team better beyond your own output'],
    questions: ['Tell me about a time you mentored someone to a clear improvement.', 'Describe a hiring decision where you held out against pressure.', 'Tell me about giving hard feedback to a strong performer.'],
    tech: 'Design reviews and code review used as teaching; onboarding paths that get a new engineer to their first production change quickly.',
    redFlag: 'Describing yourself as the hero who did everyone\'s work.' },
  { id: 'standards', name: 'Insist on the Highest Standards',
    gist: 'Keep standards that others may think unreasonably high, and fix defects so they stay fixed.',
    listenFor: ['A specific standard you set and why', 'You refused to ship or you reworked something', 'Systemic prevention, not a one-off fix'],
    questions: ['Tell me about a time you refused to lower the quality bar.', 'Describe something you reworked even though it was already "good enough".', 'How did you stop a recurring defect permanently?'],
    tech: 'Automated checks in the pipeline, error budgets that really block releases, test coverage on the paths that lose money.',
    redFlag: 'Perfectionism with no regard for delivery, or no example of a cost you accepted.' },
  { id: 'big', name: 'Think Big',
    gist: 'Think beyond the incremental; communicate a bold direction that inspires results.',
    listenFor: ['A vision larger than the immediate ask', 'How you got others to follow it', 'First concrete steps, not only the dream'],
    questions: ['Tell me about the biggest idea you pushed for.', 'Describe a time you reframed a small request into a larger opportunity.', 'When did you design for ten times the current scale, and what did it cost?'],
    tech: 'Design for the next order of magnitude on the parts that are hard to change (data model, partitioning key), while shipping the simple version first.',
    redFlag: 'A grand idea that was never started.' },
  { id: 'action', name: 'Bias for Action',
    gist: 'Speed matters; many decisions are reversible and need not wait for perfect information; calculated risk is fine.',
    listenFor: ['You decided without full data and said why that was safe', 'The decision was reversible, or you made it so', 'You moved quickly and still checked the result'],
    questions: ['Tell me about a time you made a fast decision with limited information.', 'Describe when you shipped something small to learn instead of planning more.', 'When did waiting would have cost more than being wrong?'],
    tech: 'Feature flags, canary rollouts and rollbacks that make a risky change cheap to undo.',
    redFlag: 'Recklessness with no safety net, or endless analysis.' },
  { id: 'frugal', name: 'Frugality',
    gist: 'Accomplish more with less; constraints breed resourcefulness and invention.',
    listenFor: ['A real constraint (money, people, time)', 'A resourceful alternative', 'Cost or effort saved, in numbers'],
    questions: ['Tell me about a time you delivered with far fewer resources than planned.', 'Describe how you cut infrastructure cost without hurting users.', 'When did a constraint lead to a better design?'],
    tech: 'Right-sizing, caching to cut database load, tiered storage, turning off idle environments.',
    redFlag: 'Cheap choices that moved cost onto someone else or onto reliability.' },
  { id: 'trust', name: 'Earn Trust',
    gist: 'Listen carefully, speak candidly, treat others respectfully, admit mistakes, and judge yourself by a higher standard than others do.',
    listenFor: ['You told a hard truth early', 'You owned a mistake without being forced', 'You repaired a damaged relationship'],
    questions: ['Tell me about a mistake you made at work and how you handled it.', 'Describe a time you had to deliver bad news to a stakeholder.', 'Tell me about repairing trust with a colleague or team.'],
    tech: 'Blameless post-incident reviews, honest status updates during an outage, publishing the bad numbers.',
    redFlag: 'A mistake that was really someone else\'s.' },
  { id: 'dive', name: 'Dive Deep',
    gist: 'Stay connected to the details, audit often, and be sceptical when the numbers and the stories disagree.',
    listenFor: ['You went below the dashboard to the raw data', 'A specific technical finding', 'The anecdote that disagreed with the metric'],
    questions: ['Tell me about a time you dug into the data to find a root cause others missed.', 'Describe a metric that looked fine but felt wrong. What did you find?', 'When did you read the source, logs or packets rather than trust the abstraction?'],
    tech: 'Distributed debugging: follow one trace end to end, compare p50 with p99, check the sampling and the clock before believing the graph.',
    redFlag: 'A generic "I looked into it" with no finding.' },
  { id: 'backbone', name: 'Have Backbone; Disagree and Commit',
    gist: 'Challenge decisions respectfully when you disagree, even when it is uncomfortable; once decided, commit fully.',
    listenFor: ['You disagreed with evidence, not feelings', 'You voiced it to the right person', 'After the decision you fully supported it'],
    questions: ['Tell me about a time you disagreed with your manager or a senior engineer.', 'Describe when you lost an argument and still had to deliver the outcome.', 'When did you push back on a deadline or scope?'],
    tech: 'A design review where you argued for a different storage choice, then built the agreed one well.',
    redFlag: 'Never disagreeing, or quietly sandbagging after losing.' },
  { id: 'results', name: 'Deliver Results',
    gist: 'Focus on the key inputs, deliver on time with high quality, and rise to the occasion despite setbacks.',
    listenFor: ['A hard obstacle that was overcome', 'A measured outcome', 'You protected quality while hitting the date'],
    questions: ['Tell me about the most important goal you hit against the odds.', 'Describe a time a project was slipping. What did you do?', 'When did you deliver under a hard deadline without cutting corners?'],
    tech: 'Cutting scope, not quality: the thin vertical slice that meets the launch date and the plan to complete the rest.',
    redFlag: 'Effort described instead of an outcome.' },
  { id: 'employer', name: 'Strive to be Earth\'s Best Employer',
    gist: 'Create a safer, more productive, diverse and inclusive environment; lead with empathy and help people succeed.',
    listenFor: ['A concrete change that made work better for others', 'Empathy shown through action', 'Inclusion in practice, not slogans'],
    questions: ['Tell me about a time you made your team\'s working environment better.', 'Describe supporting a colleague through a difficult period.', 'How have you made your team more inclusive?'],
    tech: 'Sustainable on-call rotations, documentation that lets people sleep, fair distribution of unglamorous work.',
    redFlag: 'Perks and events instead of changes to how people work.' },
  { id: 'responsibility', name: 'Success and Scale Bring Broad Responsibility',
    gist: 'Your impact reaches beyond customers and the company; consider second-order effects and leave things better.',
    listenFor: ['You considered who else is affected', 'You accepted a cost to avoid harm', 'You reduced a risk before anyone forced you to'],
    questions: ['Tell me about a time you considered the wider impact of a decision.', 'Describe a change you made to reduce risk to people outside your team.', 'When did you raise an ethical or privacy concern about a design?'],
    tech: 'Privacy by design, abuse and misuse analysis, energy and cost of the system at scale, safe defaults.',
    redFlag: 'Treating compliance as someone else\'s department.' },
]

export const byId = Object.fromEntries(PRINCIPLES.map(p => [p.id, p]))

// Deterministic pick so a session's questions are reproducible and testable.
export function pickQuestions(ids, perPrinciple = 1, seed = 1) {
  let s = seed >>> 0
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const out = []
  for (const id of ids) {
    const p = byId[id]; if (!p) continue
    const pool = [...p.questions]
    for (let i = 0; i < Math.min(perPrinciple, pool.length); i++) {
      out.push({ principle: id, question: pool.splice(Math.floor(rnd() * pool.length), 1)[0] })
    }
  }
  return out
}

// ── checking the shape of a STAR answer ─────────────────────────────────────

const has = (t, re) => re.test(t)
const count = (t, re) => (t.match(re) || []).length

export function analyzeStar(text) {
  const t = String(text || '').trim()
  const lower = t.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean).length
  const i = count(lower, /\b(i|i'd|i'm|i've|i'll|my|me)\b/g)
  const we = count(lower, /\b(we|we're|we've|our|us|the team)\b/g)
  const situation = has(lower, /\b(when|while|at the time|last (year|quarter)|we were|the team was|our (system|service|product)|context|background)\b/)
  const task = has(lower, /\b(my (job|role|goal|task|responsibility)|i was (asked|responsible|tasked|accountable)|needed to|had to|the goal was|the problem was|we needed)\b/)
  const action = i >= 3 && has(lower, /\b(i (decided|built|wrote|designed|led|proposed|investigated|measured|changed|fixed|rolled|negotiated|set up|created|analysed|analyzed|traced|reviewed|escalated|persuaded|raised))\b/)
  const numbers = count(t, /\d[\d,.]*\s?(%|ms|s|x|k|m|million|billion|hours?|days?|weeks?|users?|rps|qps|cost|dollars|₹|\$|£|€)?/g)
  const result = has(lower, /\b(result|as a result|outcome|reduced|increased|improved|saved|cut|grew|launched|shipped|delivered|dropped|went from|down from|up from)\b/)
  const measured = result && numbers >= 1
  const reflection = has(lower, /\b(learned|learnt|lesson|next time|would do differently|in hindsight|since then|now i|i now)\b/)
  const ownershipRatio = i + we ? i / (i + we) : 0

  const notes = []
  if (words < 90) notes.push('Short: a behavioural answer usually needs 200 to 350 spoken words to carry situation, action and result.')
  if (words > 520) notes.push('Long: trim the setup; the action is the part the interviewer is scoring.')
  if (!situation) notes.push('Set the scene in one or two sentences: where, when, what was at stake.')
  if (!task) notes.push('State your specific responsibility, not the team\'s.')
  if (!action) notes.push('Say what YOU did, step by step, using "I decided / I built / I measured".')
  if (ownershipRatio < 0.45 && we > 2) notes.push('Mostly "we": the interviewer cannot tell what you personally did. Keep "we" for context and "I" for actions.')
  if (!measured) notes.push('Add a number: before and after, a percentage, a time, a cost, a count of users.')
  if (!reflection) notes.push('End with what you learned or would change. Bar-raisers listen for it.')

  const parts = { situation, task, action, result: measured, reflection }
  const score = (situation ? 1 : 0) + (task ? 1 : 0) + (action ? 2 : 0) + (result ? 1 : 0) + (measured ? 1 : 0) + (reflection ? 1 : 0)
  return { words, i, we, ownershipRatio, numbers, parts, score, max: 7, notes }
}

// Which principles do your saved stories cover, and where are the gaps?
export function coverage(stories) {
  const covered = {}
  for (const s of stories) for (const id of s.principles || []) (covered[id] ||= []).push(s.title || 'Untitled')
  const gaps = PRINCIPLES.filter(p => !covered[p.id]).map(p => p.id)
  return { covered, gaps, percent: Math.round(100 * (PRINCIPLES.length - gaps.length) / PRINCIPLES.length) }
}

// A few strong stories should cover many principles. Flag the stories that
// cover none (add tags) and the ones that carry too much weight.
export function storyAdvice(stories) {
  const out = []
  if (stories.length < 5) out.push('Aim for 5 to 7 distinct stories; each can serve three or four principles.')
  for (const s of stories) {
    if (!(s.principles || []).length) out.push(`"${s.title || 'Untitled'}" is not tagged to any principle yet.`)
  }
  const used = {}
  stories.forEach(s => (s.principles || []).forEach(id => { used[id] = (used[id] || 0) + 1 }))
  const thin = Object.entries(used).filter(([, n]) => n === 1).length
  if (stories.length >= 3 && thin > 8) out.push('Many principles rest on a single story. Prepare a second story for your most likely questions.')
  return out
}
