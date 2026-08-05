// What "Senior" actually means, and what an interview at that bar looks for.
//
// Deliberately no compensation figures. Levels.fyi's value is its salary
// dataset — that is theirs, it sits behind their terms, and reproducing it here
// would be both a licensing problem and a maintenance one, since it changes
// monthly and would rot in a static file. What is fair to use is the public
// fact that ladders differ by company, which is why "Senior" is a title and not
// a standard. LinkedIn is personal profile data behind its own terms and is not
// used at all.

export const LADDER = [
  {
    band: 'Mid-level',
    titles: 'Google L4 · Meta E4 · Amazon SDE II · Microsoft 61–62 · Apple ICT3',
    india: 'SDE II at most Indian product companies; 3–6 years is the usual range, though years are the weakest signal on this list.',
    scope: 'Owns a service or a well-defined slice of one. Given a problem, produces a working design.',
  },
  {
    band: 'Senior',
    titles: 'Google L5 · Meta E5 · Amazon SDE III · Microsoft 63–64 · Apple ICT4',
    india: 'SDE III or Senior/Lead Engineer. The band most Indian product companies hire hardest into.',
    scope: 'Owns a system across teams. Given an ambiguous problem, narrows it first, then designs, and can say what the design gives up.',
  },
  {
    band: 'Staff+',
    titles: 'Google L6+ · Meta E6+ · Amazon Principal · Microsoft 65+ · Apple ICT5+',
    india: 'Staff, Principal or Architect. Comparatively few seats, and the interview is materially different rather than just harder.',
    scope: 'Owns a problem area rather than a system. Decides which problem is worth solving, and the design follows from that judgement.',
  },
]

// What separates the bands in a system design interview specifically. These are
// the differences interviewers actually write on the feedback form.
export const SIGNALS = {
  'Mid-level': {
    does: [
      'Names the standard components and wires them together correctly.',
      'Gets to a design that would work at the stated scale.',
      'Answers the question that was asked.',
    ],
    missing: [
      'Starts drawing before narrowing the problem.',
      'States choices without their cost — everything sounds equally good.',
      'Numbers appear only when asked for, and then as categories rather than figures.',
    ],
    next: 'Do the arithmetic out loud before drawing, and finish every choice with what it gives up. That single habit is most of the gap to Senior.',
  },
  Senior: {
    does: [
      'Narrows an ambiguous brief and states what is out of scope before designing.',
      'Names the bottleneck without being asked, and defends the choice around it.',
      'Volunteers the trade-off rather than conceding it under questioning.',
      'Goes deep on the hard part instead of covering everything evenly.',
    ],
    missing: [
      'Treats the requirements as given rather than as something to challenge.',
      'One design, presented as the answer, with no alternative considered and dismissed.',
      'Operational reality — migration, rollout, what happens at 3am — goes unmentioned.',
    ],
    next: 'Argue why this problem is worth solving this way, name the option you rejected and why, and say how it gets deployed and operated. That is the Staff conversation.',
  },
  'Staff+': {
    does: [
      'Questions the framing — sometimes the right answer is a smaller system, or none.',
      'Names an alternative, then rejects it for a stated reason.',
      'Covers migration from what exists today, not just the end state.',
      'Talks about the failure mode nobody asked about, and what it costs the business.',
    ],
    missing: [
      'Depth without judgement: a technically strong design for the wrong problem.',
    ],
    next: 'At this band the interview is about judgement rather than recall. Practise on problems where the correct answer is to build less.',
  },
}

export const bandNames = () => LADDER.map(l => l.band)
export const ladderFor = band => LADDER.find(l => l.band === band) || null
export const signalsFor = band => SIGNALS[band] || null

// The interview report produces a band; this turns it into "and here is the
// next one, and what it needs".
export function nextBand(band) {
  const i = LADDER.findIndex(l => l.band === band)
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1].band : null
}
