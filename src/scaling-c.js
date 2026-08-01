// Scaling playbooks, part 3 — AI systems. Shape documented in scaling.js.

export default {

'ChatGPT (conversational AI)': {
  constraint: 'GPU inference, and the fact that conversation history makes every subsequent turn of the same conversation more expensive than the last.',
  ladder: [
    ['10K users', '~5 rps', 'One inference pool, full history resent each turn. Works, and the cost curve is already wrong.'],
    ['1M users', '~500 rps', 'Prompt caching on the shared system prefix. Window recent turns and summarise the rest instead of resending everything.'],
    ['100M users', '~20K rps', 'Model routing by difficulty, continuous batching on the fleet, long-term memory retrieved rather than carried in context.'],
    ['500M users', 'GPU-bound', 'Regional inference pools, admission control by plan tier, and capacity planned against accelerator procurement rather than autoscaling.'],
  ],
  levers: [
    { t: 'Cache the shared prefix', d: 'Every request carries the same long system prompt. Caching its attention state rather than recomputing it is the largest single saving available, and it grows as the prompt does.', n: ['cache', 'router'] },
    { t: 'Stop resending history', d: 'Naive context growth makes turn twenty cost twenty times turn one. Window the recent turns, summarise older ones, and retrieve long-term memory only when relevant.', n: ['conv', 'hist', 'mem'] },
    { t: 'Route by difficulty', d: 'Most messages do not need the largest model. A cheap classifier in front changes unit economics more than any infrastructure work.', n: ['router', 'llm'] },
    { t: 'Continuous batching', d: 'Per-request inference leaves GPUs idle between tokens. Packing many sequences into the same forward pass multiplies throughput on identical hardware.', n: ['llm'] },
    { t: 'Budget the safety passes', d: 'Input and output guards are additional inference on every request. They are non-negotiable, so size the fleet for three model calls per message rather than one.', n: ['gin', 'gout'] },
  ],
  wall: { t: 'Accelerator supply', d: 'GPUs have long procurement lead times, so at capacity the system becomes queue-shaped rather than slow. Past that point the levers are admission control, tier prioritisation and caching — not more instances.' },
},

'LangChain (agent framework)': {
  constraint: 'Cost variance per run. One agent invocation might be three LLM calls or thirty, and you cannot tell which in advance.',
  ladder: [
    ['100 runs/day', 'negligible', 'Run the loop inline. No caps, no tracing. Fine while you are still learning what the agent does.'],
    ['10K runs/day', '~1 rps', 'Iteration, time and token caps. Tracing on every run, because you now have failures you cannot explain.'],
    ['1M runs/day', '~50 rps', 'Semantic caching at the run level, sandboxed tool execution on its own fleet, evals in CI.'],
    ['100M runs/day', '~800 rps', 'Runs become durable resumable jobs rather than in-process loops. Tool execution scales independently of orchestration.'],
  ],
  levers: [
    { t: 'Cache whole runs, not calls', d: 'A run-level semantic cache skips every step at once. Caching individual LLM calls inside a run saves a fraction of the same work for much more bookkeeping.', n: ['cache', 'orch'] },
    { t: 'Cap four different ways', d: 'Iterations, wall-clock, tokens and repetition detection. Each has a failure mode the others miss, and without all four a single run can consume unbounded budget.', n: ['orch'] },
    { t: 'Separate tool execution', d: 'Sandboxed tools are CPU and IO bound while orchestration is IO bound waiting on models. Different scaling curves, so give them separate fleets.', n: ['sandbox', 'tools'] },
    { t: 'Make runs resumable', d: 'A multi-step run that dies on deploy should not restart from the beginning. Persist step state and the orchestrator becomes stateless and freely scalable.', n: ['orch', 'mem'] },
    { t: 'Sample tracing above a threshold', d: 'Full traces on every run become the largest storage cost in the system. Keep all failures and slow runs, sample the successful ones.', n: ['trace', 'eval'] },
  ],
  wall: { t: 'Non-determinism', d: 'The same input can take a different path on every run, so capacity planning is statistical rather than exact and a p99 run may cost fifty times the median. You size for a distribution you do not control, which is why caps matter more than throughput.' },
},

'AI Code Assistant (Copilot)': {
  constraint: 'A two-hundred-millisecond budget that includes network, context assembly, inference and filtering.',
  ladder: [
    ['1K developers', '~50 rps', 'One region, one model, whole-file context. Latency is tolerable because nobody is far away yet.'],
    ['100K developers', '~3K rps', 'Edge presence, prefix caching, and debouncing plus cancellation so abandoned requests stop reaching the model.'],
    ['1M developers', '~30K rps', 'Per-organisation repository indexes, context selection by relevance rather than proximity, smaller models placed close to users.'],
    ['10M developers', '~300K rps', 'Regional inference with model affinity, speculative decoding, and acceptance rate driving which model serves which cohort.'],
  ],
  levers: [
    { t: 'Cancel aggressively', d: 'Most requests are abandoned as the developer keeps typing. Propagating cancellation all the way to the inference tier removes a large share of GPU work with no user-visible change.', n: ['gw', 'router', 'llm'] },
    { t: 'Get close to the user', d: 'A cross-continent round trip spends most of the budget before any computation. Edge presence is worth more here than a faster model.', n: ['edge'] },
    { t: 'Cache exact prefixes', d: 'Developers retype, undo and redo constantly, so identical requests recur far more than intuition suggests. An exact-match cache is cheap and hits often.', n: ['cache'] },
    { t: 'Select context, do not grow it', d: 'The right two thousand tokens beat a bigger model with the wrong context. Open tabs, recent edits and imported symbols outperform raw file proximity.', n: ['ctx', 'idx', 'vec'] },
    { t: 'Smaller models, closer', d: 'A smaller model that answers within the budget is strictly better than a stronger one that misses it. Optimise for completions actually seen, not completions generated.', n: ['llm', 'router'] },
  ],
  wall: { t: 'Human typing speed', d: 'The budget is set by how long a developer pauses, not by anything you control. Past a point you cannot go faster, only choose better context and accept more of what you generate.' },
},

'AI Search (Perplexity)': {
  constraint: 'Fan-out to external providers you neither own nor can scale, on the hot path of every query.',
  ladder: [
    ['10K queries/day', '~1 rps', 'Call providers live per query, synthesise, return. Multi-second latency and immediately rate-limited.'],
    ['1M queries/day', '~50 rps', 'Hard timeouts with partial results. Answer caching with a freshness dimension. A reranking stage before synthesis.'],
    ['100M queries/day', '~5K rps', 'Own index for the head of the query distribution, live fetching only for the tail. Per-provider circuit breakers.'],
    ['1B queries/day', '~50K rps', 'Regional retrieval and synthesis, aggressive passage caching, and streaming that hides the remaining latency.'],
  ],
  levers: [
    { t: 'Deadline, then synthesise', d: 'Eight sources at one second beat ten at four. Return partial results rather than waiting for the slowest provider, and let the answer be slightly thinner.', n: ['plan', 'fetch', 'prov'] },
    { t: 'Retrieve broadly, rerank hard', d: 'Fifty candidates down to eight passages. Sending everything into synthesis costs more and produces worse answers — attention dilutes.', n: ['rank', 'vec'] },
    { t: 'Freshness-aware caching', d: 'The same question deserves a different answer next week. Cache keyed on query plus a freshness bucket, with news-shaped queries getting a much shorter life.', n: ['cache'] },
    { t: 'Own the head of the distribution', d: 'A small set of queries is most of the traffic. Indexing those yourself removes provider calls from the majority of requests.', n: ['srch', 'idx'] },
    { t: 'Circuit-break per provider', d: 'One degraded provider otherwise consumes the latency budget of every query, not only the ones it serves.', n: ['prov', 'fetch'] },
  ],
  wall: { t: 'The open web', d: 'You depend on other people\'s servers, rate limits and robots policies. Freshness is bounded by what you are allowed to fetch and how fast, and no amount of capacity changes that.' },
},

'Image Generation (Diffusion)': {
  constraint: 'GPU seconds. Every image is tens of seconds of dedicated accelerator time and nothing else comes close.',
  ladder: [
    ['1K images/day', 'one worker', 'A queue and a single GPU. Entirely adequate, and the queue is the part worth keeping.'],
    ['1M images/day', '~12 rps', 'Worker fleet with a scheduler. Batch compatible jobs. Progress streaming so the wait is tolerable.'],
    ['10M images/day', '~120 rps', 'Model-affinity routing so weights stay resident, priority tiers with preemption, output caching at the edge.'],
    ['100M images/day', '~2K rps', 'Regional GPU pools, spot capacity with checkpointing, and admission control when the queue outgrows the fleet.'],
  ],
  levers: [
    { t: 'Batch compatible jobs', d: 'Same model, same resolution, same step count into one forward pass. Costs a little latency, multiplies throughput — and at thirty-second generations nobody notices the extra wait.', n: ['sched', 'gpu'] },
    { t: 'Keep models warm', d: 'Loading weights takes tens of seconds, comparable to a whole generation. Route jobs to workers that already hold the right model rather than to whichever is free.', n: ['sched', 'gpu'] },
    { t: 'Reject before you generate', d: 'Prompt moderation costs milliseconds; generating and discarding costs thirty GPU-seconds. Order the checks by cost.', n: ['mod', 'safety'] },
    { t: 'Preempt by tier', d: 'A paid request queued behind a free-tier backlog is a churn event. Priority queues with preemption at checkpoint boundaries.', n: ['q', 'sched'] },
    { t: 'Immutable outputs cache forever', d: 'Content-addressed images never change, so edge delivery costs nothing after the first fetch and the origin sees almost no read traffic.', n: ['blob', 'cdn2'] },
  ],
  wall: { t: 'GPU-seconds per image', d: 'Diffusion has an irreducible compute cost per image at a given quality. You can batch and schedule around it but you cannot avoid it, so scale is a straight function of fleet size and therefore of budget.' },
},

'LLM Fine-tuning Platform': {
  constraint: 'Cluster time. Jobs run for days on scarce hardware, and a failure late in a run destroys everything spent so far.',
  ladder: [
    ['a few jobs/week', 'one node', 'Single-node training, manual evaluation. Perfectly reasonable and much simpler than what follows.'],
    ['dozens/week', 'small cluster', 'A scheduler and a queue. Checkpointing so a node failure costs an interval rather than the run.'],
    ['hundreds/week', 'multi-tenant', 'Fair-share allocation across teams, preemption at checkpoints, evaluation gating promotion.'],
    ['continuous', 'large fleet', 'Spot and reserved capacity mixed, resumable everywhere, lineage tracked end to end for compliance.'],
  ],
  levers: [
    { t: 'Checkpoint on an interval you have reasoned about', d: 'Writing a hundred gigabytes pauses training, but a failure without checkpoints loses days. The interval is an explicit trade, not a default to leave alone.', n: ['ckpt', 'train'] },
    { t: 'Resumability unlocks cheap capacity', d: 'Once a job resumes cleanly you can run on preemptible hardware and reprioritise mid-flight. This is the single largest cost lever on the platform.', n: ['train', 'sched'] },
    { t: 'Validate before queueing', d: 'A dataset problem surfaces days later as a bad evaluation, having consumed the whole run. Schema, duplicate and distribution checks are cheap and run first.', n: ['val', 'pii', 'lake'] },
    { t: 'Fair-share the cluster', d: 'Without quotas one team submits fifty jobs and everyone else waits a week. Allocation policy matters more than raw capacity once the platform is shared.', n: ['sched'] },
    { t: 'Pin serving to a version', d: 'Never serve "latest". Pinning to an immutable registry entry makes rollback as cheap as promotion, which you will need.', n: ['reg', 'serve'] },
  ],
  wall: { t: 'Wall-clock time', d: 'A training run takes as long as it takes; more GPUs help sublinearly and eventually communication overhead dominates. Iteration speed is bounded by physics and by budget, not by platform engineering.' },
},

}
