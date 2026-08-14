// Authored breakdowns, part 5 — AI systems. Shape documented in breakdown.js.

export default {

'ChatGPT (conversational AI)': {
  meta: 'AI / ML · hard · a consumer product on a GPU fleet',
  overview: 'A conversational assistant used by hundreds of millions of people, where every message is an expensive GPU operation and the perceived speed is decided in the first two hundred milliseconds.',
  scope: 'Conversation state, safety and the economics of inference are the interview. Model training and the model itself are below the line — you are designing the product around a model you are given.',
  planning: 'Establish that inference dominates both cost and latency, then note that conversation history makes each turn progressively more expensive. Those two facts drive prompt caching, history windowing and model routing, which is where most of the engineering lives.',
  fr: {
    core: ['Send a message and receive a streamed reply', 'Continue a conversation with prior context', 'Upload files and images', 'Let the model call tools and browse'],
    out: ['Model training and fine-tuning', 'Custom model hosting', 'Enterprise admin tooling'],
  },
  nfr: {
    core: ['First token within a few hundred milliseconds', 'Conversation history never lost', 'Safety applied to input and output', 'Usage metered exactly for billing'],
    out: ['Deterministic responses', 'Guaranteed factual accuracy'],
  },
  nums: [['~20K/s', 'messages at peak'], ['~1K tokens', 'growing context per turn'], ['100× variance', 'in cost per request'], ['GPU-bound', 'the binding constraint']],
  entities: [
    ['Conversation', 'an ordered list of turns belonging to a user'],
    ['Turn', 'one user message and one assistant reply, with token counts'],
    ['Memory', 'facts carried across conversations, retrieved rather than resent'],
    ['UsageRecord', 'exact input and output tokens — this is billing'],
  ],
  apiIntro: 'One streaming endpoint carries the product. Streaming is not a nicety here: generation takes seconds and only time-to-first-token is perceived.',
  api: [
    { dir: '→', name: 'POST /conversations/{id}/messages', body: '{ content, attachments[] }\n→ SSE stream of tokens, then { messageId, usage }' },
    { dir: '→', name: 'GET /conversations', body: '→ { conversations[], nextCursor }' },
    { dir: '←', name: 'event: tool_call', body: '{ name, arguments } — mid-stream, resumes after the result' },
  ],
  dives: [
    {
      title: 'Conversation history makes every turn more expensive', focus: ['conv', 'hist', 'mem'],
      blocks: [
        ['p', 'Naively resending the whole conversation means turn twenty costs twenty times turn one. Cost and latency grow with conversation length, which is exactly backwards from what users expect.'],
        ['bul', [
          '**Window** the recent turns verbatim — the last few are what the model actually needs.',
          '**Summarise** everything older into a compact running summary, regenerated occasionally rather than per turn.',
          '**Retrieve** long-term memory rather than carrying it: store facts separately and pull only what is relevant.',
        ]],
        ['note', 'This is retrieval applied to your own conversation. The same reasoning that makes RAG work makes long conversations affordable.'],
      ],
    },
    {
      title: 'Making it feel fast when it is not', focus: ['router', 'cache', 'llm'],
      blocks: [
        ['p', 'Generation takes seconds and you cannot make it instant. You can make it *feel* immediate.'],
        ['p', 'Stream tokens as they are produced, so the user starts reading while the model is still working. Cache the shared system prefix so its attention state is not recomputed on every request — with a long system prompt this is one of the largest savings available. And route by difficulty: most messages do not need your largest model, and a classifier in front changes the economics more than any infrastructure tuning.'],
        ['warn', 'Safety checks on input and output are additional inference. They are non-negotiable in a consumer product, so budget them into the latency and cost model rather than discovering them later.'],
      ],
    },
    {
      title: 'Tool calls turn one request into several', focus: ['tools', 'llm', 'gout'],
      blocks: [
        ['p', 'When the model calls a tool the request becomes a loop: generate, call, feed the result back, generate again. Each iteration is another full inference, and a browsing call adds network latency on top.'],
        ['p', 'Cap the iterations, run tools in parallel where they are independent, and stream intermediate state so the user can see that something is happening rather than watching a spinner.'],
        ['note', 'Tools are untrusted endpoints executing on the model\'s instruction. Sandbox them and treat their output as untrusted input to the next turn — prompt injection arrives through exactly this door.'],
      ],
    },
  ],
  bar: {
    mid: 'A working conversation flow with streaming, persistence, and awareness that safety runs on both sides.',
    senior: 'Handle growing context with windowing and summarisation, and design prompt caching and model routing.',
    staff: 'Cover the tool-call loop and its injection surface, admission control when GPUs are scarce, and exact metering as a durability requirement.',
  },
},

'LangChain (agent framework)': {
  meta: 'AI / ML · hard · an unbounded loop by construction',
  overview: 'A framework where a model decides which tools to call and in what order. The power and the danger are the same property: the loop has no natural termination.',
  scope: 'The agent loop, tool safety and observability are the interview. The models themselves and specific tool implementations are below the line.',
  planning: 'Lead with the fact that an agent run is non-deterministic and unbounded. Everything else — iteration caps, sandboxing, tracing, evals — follows from taking that seriously rather than treating it as an edge case.',
  fr: {
    core: ['Run an agent that plans and calls tools', 'Retrieve context from a vector store', 'Maintain scratchpad memory across steps', 'Trace every run for debugging'],
    out: ['Model hosting', 'Building the individual tools', 'Prompt authoring UI'],
  },
  nfr: {
    core: ['A run always terminates — by success, cap or timeout', 'Untrusted tool code cannot escape its sandbox', 'Every run fully reconstructable from its trace', 'Token spend per run is bounded'],
    out: ['Deterministic agent behaviour'],
  },
  nums: [['~800/s', 'agent runs at peak'], ['3–15', 'LLM calls per run'], ['~10', 'iteration cap before forced stop'], ['100×', 'cost variance between runs']],
  entities: [
    ['Run', 'one agent invocation with its full step history'],
    ['Step', 'a thought, a tool call, and its observation'],
    ['Tool', 'a callable capability with a schema — untrusted by default'],
    ['Trace', 'the durable record that makes a failed run explicable'],
  ],
  apiIntro: 'The SDK is the interface. What matters architecturally is that a run is a durable, resumable object rather than a function call that either returns or does not.',
  api: [
    { dir: '→', name: 'POST /runs', body: '{ agent, input, maxSteps, budgetTokens }\n→ { runId } — streams steps as they happen' },
    { dir: '→', name: 'GET /runs/{id}', body: '→ { status, steps: [{thought, tool, observation}], usage }' },
    { dir: '↔', name: 'tool: invoke', body: '{ name, args } → { result } — sandboxed, hard timeout' },
  ],
  dives: [
    {
      title: 'The loop does not terminate on its own', focus: ['orch', 'llm', 'mem'],
      blocks: [
        ['p', 'A model that can call tools can loop forever: retrying a failing tool, oscillating between two approaches, or pursuing a goal it cannot reach. There is no natural stopping condition.'],
        ['bul', [
          'Cap iterations — ten steps is generous for most agents.',
          'Cap wall-clock time independently, because one slow tool can consume the budget in a single step.',
          'Cap token spend, since cost is what actually hurts and it is not proportional to step count.',
          'Detect repetition: the same tool with the same arguments twice usually means the agent is stuck.',
        ]],
        ['warn', 'All four caps are needed. Each of them alone has a failure mode the others cover.'],
      ],
    },
    {
      title: 'Every tool is an attack surface', focus: ['tools', 'sandbox', 'guard'],
      blocks: [
        ['p', 'The model decides what to call and with what arguments, and that decision is influenced by content it retrieved — which may be adversarial. Prompt injection is not hypothetical here; it is the expected case for any agent that reads the open web.'],
        ['p', 'Sandbox code execution with no network, strict resource limits and a hard timeout. Give each tool the narrowest possible permission, and never let a retrieved document escalate what a tool may do.'],
        ['note', 'Treat tool output as untrusted input to the next model call, exactly as you would treat user input. It is the same trust boundary.'],
      ],
    },
    {
      title: 'A failed run is incomprehensible without a trace', focus: ['trace', 'eval'],
      blocks: [
        ['p', 'When an agent produces a wrong answer, the answer tells you almost nothing. You need every thought, every tool call, every observation and every prompt actually sent — including the ones assembled by the framework rather than by you.'],
        ['p', 'Tracing is therefore load-bearing infrastructure, not an add-on. Pair it with continuous evals: prompt and model changes regress agent behaviour silently, and no conventional test suite catches it.'],
        ['calc', 'Semantic caching on the whole agent input saves far more than caching individual LLM calls, because a cache hit skips the entire multi-step run rather than one step of it.'],
      ],
    },
  ],
  bar: {
    mid: 'An agent loop with tools and memory, and an understanding that it needs a stopping condition.',
    senior: 'Design all four caps, sandbox tool execution, and make tracing a first-class component.',
    staff: 'Cover prompt injection through retrieved content, evals as a continuous pipeline, and caching at the run level rather than the call level.',
  },
},

'Multi-Agent Orchestration Platform': {
  meta: 'AI / ML · hard · coordination between agents is the whole problem',
  overview: 'One agent decomposes a task and hands pieces of it to specialist agents built for narrower jobs — research, coding, writing — running concurrently. The single-agent problems (unbounded loops, untrusted tools) do not go away; a new one is added on top: agents now need to see a consistent shared picture of a task that several of them are changing at once.',
  scope: 'Task decomposition, shared state between agents, and where human approval gates sit are the interview. The internal implementation of any one specialist agent is below the line — that part is just the single-agent problem, already solved.',
  planning: 'Start from the failure mode that is unique to this design: two agents racing on shared state, or a downstream agent starting before an upstream one has posted what it found. That is what makes a blackboard, not private per-agent memory, the right call, and it is what determines where tracing and approval gates need to sit.',
  fr: {
    core: ['Decompose an incoming task into sub-tasks and route each to the right specialist agent', 'Let sub-agents run concurrently against a shared view of task state', 'Pause for human approval before an agent takes an irreversible or high-cost action', 'Produce one trace covering the supervisor and every sub-agent for a given run'],
    out: ['The internal reasoning loop of any individual specialist agent', 'A general-purpose agent marketplace or plugin ecosystem'],
  },
  nfr: {
    core: ['A sub-agent never acts on stale state from before another sub-agent posted its result', 'An irreversible action always waits for approval, with no bypass', 'Total run cost and wall-clock time are bounded at the supervisor level, not just per sub-agent', 'A failed sub-agent does not silently stall the whole run'],
    out: ['Deterministic decomposition — the same task may split differently on different runs'],
  },
  nums: [['~600/s', 'tasks at peak'], ['2-6', 'sub-agents typically active per task'], ['10x', 'blowup in LLM calls versus a single-agent run for the same task'], ['seconds to minutes', 'time added by a human approval gate']],
  entities: [
    ['Task', 'the top-level request, owned by the Supervisor Agent'],
    ['Sub-task', 'one unit of decomposed work, assigned to one specialist agent'],
    ['Blackboard Entry', 'a fact or result posted by one agent that others can read'],
    ['Approval', 'a paused, high-risk action awaiting a human decision before it proceeds'],
  ],
  apiIntro: 'A task is a durable, resumable run, the same as a single agent — but its status now includes the state of every sub-agent working on it, not just one step sequence.',
  api: [
    { dir: '→', name: 'POST /tasks', body: '{ goal, budgetTokens, maxSubAgents } → { taskId } — streams sub-agent activity as it happens' },
    { dir: '→', name: 'GET /tasks/{id}', body: '→ { status, subAgents: [{agent, status, steps}], blackboard, pendingApprovals }' },
    { dir: '→', name: 'POST /approvals/{id}', body: '{ decision: approve | reject } → resumes or aborts the waiting agent' },
  ],
  dives: [
    {
      title: 'A blackboard, not each agent\'s private memory', focus: ['board', 'sup', 'queue'],
      blocks: [
        ['p', 'If the coding agent and the research agent each kept their own private scratchpad, the coding agent could start writing code before the research agent has posted what it found — or worse, act on a stale copy of a fact the research agent has since corrected. A shared blackboard that every agent reads from and writes to is what keeps them working off the same picture of the task.'],
        ['warn', 'A blackboard introduces its own race: two agents can both read a state, both act on it, and both write conflicting updates. Version the entries, or make writes append-only and let the supervisor resolve conflicts explicitly rather than silently overwriting.'],
      ],
    },
    {
      title: 'Autonomy stops where the blast radius gets large', focus: ['sandbox', 'hitl', 'guard'],
      blocks: [
        ['p', 'A coding agent editing a scratch file is low risk; the same agent force-pushing to a shared branch, or a research agent sending an email on the user\'s behalf, is not. The human-in-the-loop gate is not a blanket slowdown — it triggers specifically on the class of action where a wrong autonomous decision is expensive or hard to undo.'],
        ['p', 'Guardrails and the approval gate are different layers doing different jobs: guardrails block content that should never happen at all (a secret in a tool call, a prompt-injected instruction). The approval gate is for content that is legitimate but consequential enough to want a human to see it first.'],
      ],
    },
    {
      title: 'One trace, not three separate logs', focus: ['trace', 'sup'],
      blocks: [
        ['p', 'When a multi-agent run produces a bad outcome, the useful question is rarely "what did the coding agent do" in isolation — it is "what did the coding agent do given what the research agent had posted at that point." A single trace tree rooted at the supervisor, with every sub-agent\'s steps nested under it in the order they actually happened, is what makes that reconstructable.'],
        ['calc', 'Multi-agent runs cost meaningfully more than single-agent ones for the same task, because decomposition itself takes model calls and specialist agents duplicate some context-gathering work. Budget accordingly rather than assuming linear scaling with task complexity.'],
      ],
    },
  ],
  bar: {
    mid: 'A supervisor that routes sub-tasks to specialist agents, with some shared state between them.',
    senior: 'Design the blackboard\'s conflict handling, place the human approval gate correctly, and unify tracing across all agents in a run.',
    staff: 'Cover cost blowup from decomposition overhead, graceful handling of a stalled or failed sub-agent without stalling the whole run, and where autonomy should structurally stop rather than just be discouraged.',
  },
},

'Autonomous Coding Agent': {
  meta: 'AI / ML · hard · verification and human review, not just generation',
  overview: 'An agent that plans a code change, executes it in an isolated sandbox with a real shell and test runner, verifies the result against the test suite, and only then hands a diff to a human reviewer. The interesting design problems are not "generate code" — they are surviving a run that takes minutes, verifying a change actually works before claiming it does, and stopping an agent from running a destructive command.',
  scope: 'The plan-execute-verify loop, sandbox isolation, checkpointing for long-running tasks, and the human review gate are the interview. The code-generation model itself and IDE integration details are below the line.',
  planning: 'Start from run duration: this is not a sub-second request, it is a task that can run for minutes with real side effects along the way (files changed, commands run, a test suite executed). That single fact is what forces checkpointing, sandbox isolation and a verify step before anything reaches a human — a fast single-shot design does not survive contact with a task like this.',
  fr: {
    core: ['Take a task description and produce a code change', 'Execute and test that change in an isolated environment before proposing it', 'Resume a long-running task from its last checkpoint after a failure', 'Route every change through a human review gate before it can merge'],
    out: ['The code-generation model architecture itself', 'IDE-native editing UX'],
  },
  nfr: {
    core: ['A generated command that could delete data or force-push never executes unreviewed', 'A crashed or restarted run resumes without redoing completed work', 'A change that fails its own test suite never reaches a human as if it passed', 'Sandbox resource limits (CPU, memory, network) are hard, not advisory'],
    out: ['Guaranteed-correct code on the first attempt'],
  },
  nums: [['~400/s', 'tasks at peak'], ['minutes', 'typical task duration'], ['1', 'sandbox per task, torn down after'], ['0', 'unreviewed merges, by design']],
  entities: [
    ['Task', 'the top-level coding request, tracked through plan, execute and verify phases'],
    ['Checkpoint', 'a durable snapshot of task state, enabling resume after a crash or pause'],
    ['Change', 'a diff produced by the agent, tied to its test results'],
    ['Review', 'a human decision — approve, request changes, or reject — gating merge'],
  ],
  apiIntro: 'A task is a durable, resumable object exactly like a single agent run, but its state now includes sandbox handle, checkpoint history and test results, not just a step log.',
  api: [
    { dir: '→', name: 'POST /tasks', body: '{ repo, description, budgetMinutes } → { taskId } — streams plan/execute/verify progress' },
    { dir: '→', name: 'GET /tasks/{id}', body: '→ { status, plan, diff, testResults, checkpoints }' },
    { dir: '→', name: 'POST /reviews/{taskId}', body: '{ decision: approve | request_changes | reject, comment }' },
  ],
  dives: [
    {
      title: 'Verify before claiming done', focus: ['sandbox', 'test', 'tools'],
      blocks: [
        ['p', 'A change is not "done" because the model produced a diff — it is done when the sandbox actually runs the test suite against it and the tests pass. Skipping this step and handing raw model output to a human turns the reviewer into the test suite, which is slower and less reliable than an actual one.'],
        ['note', 'A failing test result goes back into the loop as feedback for another attempt, not out to the human as a finished proposal.'],
      ],
    },
    {
      title: 'A twenty-minute task has to survive a crash', focus: ['ckpt', 'planner'],
      blocks: [
        ['p', 'Anything that runs long enough will occasionally get interrupted — a deploy, a timeout, an infra blip. Without checkpointing, that means redoing the entire task from scratch, which is expensive and, for anything with side effects already applied in the sandbox, potentially inconsistent.'],
        ['p', 'Checkpoint after each meaningful phase (plan committed, change applied, tests run) so a resume picks up from the last completed phase rather than replaying work that already succeeded.'],
      ],
    },
    {
      title: 'Guardrails block the command, not just flag it', focus: ['guard', 'llm'],
      blocks: [
        ['p', 'A generated shell command sits between the model and the sandbox. Pattern-match for destructive operations — recursive deletes, force-pushes, credential exfiltration attempts — and block execution outright rather than logging a warning and letting it run anyway.'],
        ['warn', 'Passing every test is necessary but not sufficient for a merge. The human review gate exists precisely for the class of problem tests do not catch: a technically-correct change that is the wrong approach.'],
      ],
    },
  ],
  bar: {
    mid: 'A plan-execute-verify loop running in a sandbox with a test runner and a human review step before merge.',
    senior: 'Design checkpointing for long-running tasks and place guardrails as hard blocks in front of the sandbox, not advisory warnings after.',
    staff: 'Cover resumability semantics precisely (what a resume actually replays versus skips), and treat "tests passed" as necessary but not sufficient for merge.',
  },
},

'AI Code Assistant (Copilot)': {
  meta: 'AI / ML · hard · inference inside a typing loop',
  overview: 'Inline code completion as the developer types. The model is the easy part; fitting inference into the gap between keystrokes is not.',
  scope: 'Latency, context selection and cancellation are the interview. Model training and IDE plumbing are below the line.',
  planning: 'State the budget first — a completion that arrives after the developer has typed past it is worthless, so this is a latency problem with a model attached. Then note that context selection beats model size, which is the counterintuitive part.',
  fr: {
    core: ['Return a completion at the cursor', 'Use surrounding file and repository context', 'Filter secrets and licensed code', 'Report acceptance for evaluation'],
    out: ['Model training', 'Chat-based coding assistance', 'IDE extension internals'],
  },
  nfr: {
    core: ['Completion within a couple of hundred milliseconds', 'In-flight requests cancelled as typing continues', 'Never emit a secret or verbatim licensed code', 'Repository context never leaks across organisations'],
    out: ['Guaranteed compilable output'],
  },
  nums: [['~30K/s', 'completion requests at peak'], ['~200ms', 'the entire budget'], ['~2K tokens', 'of selected context'], ['~30%', 'acceptance rate is healthy']],
  entities: [
    ['Completion', 'a suggestion at a cursor position, accepted or not'],
    ['Context', 'the selected slice of the repository sent with the request'],
    ['RepoIndex', 'symbols and embeddings for one repository, isolated per org'],
    ['AcceptanceEvent', 'the only signal that tells you whether any of this works'],
  ],
  apiIntro: 'One low-latency endpoint, plus telemetry. The request carries a cancellation token because most requests are abandoned before they finish.',
  api: [
    { dir: '→', name: 'POST /completions', body: '{ prefix, suffix, language, repoId }\n→ streamed completion; cancellable' },
    { dir: '→', name: 'POST /telemetry', body: '{ completionId, accepted, latencyMs, model }' },
  ],
  apiNote: 'Note the **suffix**. The cursor almost always has code after it, so this is fill-in-the-middle rather than prefix continuation — and a model prompted only with the prefix will confidently duplicate what already follows.',
  dives: [
    {
      title: 'Two hundred milliseconds, end to end', focus: ['edge', 'cache', 'llm'],
      blocks: [
        ['p', 'The budget covers network, context assembly, inference and filtering. Nothing gets a comfortable share.'],
        ['bul', [
          '**Edge presence** — a cross-continent round trip spends most of the budget before you compute anything.',
          '**Exact-prefix caching** — developers retype and undo constantly, so the same request recurs more than you would expect.',
          '**Small models, close to the user** — a smaller model that answers in time beats a better one that does not.',
          '**Speculative decoding** — worth naming as the technique that buys throughput without a smaller model.',
        ]],
      ],
    },
    {
      title: 'Cancellation matters as much as speed', focus: ['gw', 'ctx', 'router'],
      blocks: [
        ['p', 'The developer keeps typing. Every keystroke invalidates the in-flight request, and most requests are abandoned before they complete.'],
        ['p', 'Without propagated cancellation you burn GPU on completions nobody will ever see — at this request rate that is most of your fleet. Cancellation must reach the inference tier, not just the gateway.'],
        ['calc', 'With debouncing and cancellation, the fraction of requests that reach the model can fall by well over half with no perceptible change for the user.'],
      ],
    },
    {
      title: 'Context selection beats model size', focus: ['ctx', 'idx', 'vec'],
      blocks: [
        ['p', 'The right two thousand tokens of repository context outperform a substantially larger model given the wrong context. Open tabs, recently edited files, imported symbols and nearby definitions are all stronger signals than raw file proximity.'],
        ['warn', 'Repository context is the isolation boundary that matters. One organisation\'s code appearing in another\'s completion is the failure that ends the product, so index and retrieval must be partitioned per organisation with no shared path.'],
        ['p', 'Filtering runs after generation: secrets and verbatim licensed code must never reach the editor, and that check is on the critical path.'],
      ],
    },
  ],
  bar: {
    mid: 'A completion endpoint with repository context and an understanding of the latency budget.',
    senior: 'Design cancellation and caching, use fill-in-the-middle, and treat context selection as the main lever.',
    staff: 'Cover per-organisation isolation, acceptance rate as the only real metric, and speculative decoding or edge model placement.',
  },
},

'AI Search (Perplexity)': {
  meta: 'AI / ML · hard · retrieval quality caps everything',
  overview: 'Answer a question by searching the live web, reranking what comes back, and synthesising a cited answer. Freshness is the reason it exists and the reason it is hard.',
  scope: 'Retrieval, reranking and citation integrity are the interview. Crawling infrastructure and the model are below the line.',
  planning: 'Establish that no model rescues bad passages, so retrieval quality is the ceiling on answer quality. Then handle the tension between freshness, which requires live fetching, and latency, which forbids it.',
  fr: {
    core: ['Answer a natural-language question', 'Retrieve relevant live sources', 'Synthesise an answer with citations', 'Support follow-up questions in context'],
    out: ['Operating a web crawler', 'Model training', 'Ad placement'],
  },
  nfr: {
    core: ['First token within a couple of seconds', 'Every claim traceable to a retrieved passage', 'Sources fresh enough for current events', 'Degrade to fewer sources rather than fail'],
    out: ['Guaranteed factual correctness'],
  },
  nums: [['~5K/s', 'queries at peak'], ['~10', 'sources fetched per query'], ['~1s', 'hard timeout per provider'], ['~4K tokens', 'of passages into synthesis']],
  entities: [
    ['Query', 'the question, plus the plan derived from it'],
    ['Source', 'a fetched page with extracted passages'],
    ['Passage', 'the retrievable unit, reranked and cited'],
    ['Answer', 'generated text with a citation for each claim'],
  ],
  apiIntro: 'One streaming endpoint. Citations arrive alongside the text rather than after it, so the interface can attach them as the answer forms.',
  api: [
    { dir: '→', name: 'POST /ask', body: '{ question, conversationId? }\n→ SSE: sources, then tokens, then citations' },
    { dir: '→', name: 'GET /sources/{id}', body: '→ the cached passage a citation points at' },
  ],
  dives: [
    {
      title: 'Fan-out to slow providers you do not control', focus: ['plan', 'srch', 'prov', 'fetch'],
      blocks: [
        ['p', 'A query becomes several provider calls and a handful of live page fetches, each of which can be slow or fail. Waiting for all of them means waiting for the worst of them.'],
        ['p', 'Set a hard deadline and synthesise from whatever has arrived. Eight good sources produce a better answer sooner than ten sources including two that took four seconds.'],
        ['note', 'Per-provider circuit breakers matter because a degraded provider otherwise consumes your latency budget on every single query, not just its own.'],
      ],
    },
    {
      title: 'Reranking is where quality comes from', focus: ['rank', 'vec', 'llm'],
      blocks: [
        ['p', 'Search providers return relevance to a *query*; you need relevance to a *question*. A cross-encoder reranker over the retrieved candidates is consistently the highest-leverage component in this design.'],
        ['p', 'Only the top passages go into synthesis. Sending everything wastes context, dilutes attention and costs more — the model does worse with more material, not better.'],
        ['calc', 'Retrieve broadly, rerank aggressively, synthesise narrowly. Roughly fifty candidates down to eight passages is a reasonable shape.'],
      ],
    },
    {
      title: 'Citations have to be real', focus: ['cite', 'llm'],
      blocks: [
        ['p', 'A model asked to cite will happily invent a plausible attribution. The citation must be constructed from the passage that actually grounded the claim, not generated as text.'],
        ['warn', 'Verify after generation: every citation must resolve to a passage that was genuinely retrieved. An unverifiable citation is worse than none, because it looks like evidence.'],
        ['p', 'Answer caching is delicate here in a way it is not elsewhere — the same question a day later may deserve a different answer, so cache keys need a freshness dimension.'],
      ],
    },
  ],
  bar: {
    mid: 'Retrieve, synthesise, cite — and know why grounding matters.',
    senior: 'Design timeouts with partial results, add a reranking stage, and verify citations rather than trusting them.',
    staff: 'Cover freshness-aware caching, per-provider isolation, and the retrieve-broadly-rerank-aggressively shape with its cost reasoning.',
  },
},

'Image Generation (Diffusion)': {
  meta: 'AI / ML · medium · a job queue in front of GPUs',
  overview: 'Turn a prompt into an image in tens of seconds. Long enough that it cannot be a request, expensive enough that GPU utilisation is the whole economics.',
  scope: 'The async job pattern, GPU scheduling and moderation on both sides are the interview. Diffusion internals are below the line.',
  planning: 'Recognise this as the long-running-task pattern with an unusually expensive worker. Accept the job, return an id, stream progress. Then everything interesting is about keeping the GPUs packed and the outputs safe.',
  fr: {
    core: ['Submit a prompt and receive an image', 'Show progress while it generates', 'Moderate prompts and outputs', 'Charge credits per generation'],
    out: ['Model training', 'Image editing and inpainting', 'Community gallery features'],
  },
  nfr: {
    core: ['Accepted immediately, generated within about 30 seconds', 'GPUs kept near full utilisation', 'No unsafe image ever delivered', 'A failed generation never costs the user credits'],
    out: ['Sub-second generation'],
  },
  nums: [['~2K/s', 'submissions at peak'], ['~20–40s', 'per generation'], ['~40', 'GPU workers in this model'], ['~2 MB', 'per output image']],
  entities: [
    ['Job', 'a prompt plus parameters and a state machine'],
    ['Credit', 'reserved on submit, settled on completion'],
    ['Image', 'immutable output, content-addressed'],
    ['Batch', 'what the GPU actually processes — several jobs at once'],
  ],
  apiIntro: 'Submit returns immediately with an id; progress arrives over a subscription. Holding an HTTP request open for forty seconds is not a viable interface.',
  api: [
    { dir: '→', name: 'POST /generations', body: '{ prompt, size, seed? }\n→ 202 { jobId, estimatedSeconds }' },
    { dir: '←', name: 'ws: progress', body: '{ jobId, step, total, previewUrl? }' },
    { dir: '→', name: 'GET /generations/{id}', body: '→ { status, imageUrl? }' },
  ],
  dives: [
    {
      title: 'Keeping the GPUs packed', focus: ['sched', 'gpu', 'q'],
      blocks: [
        ['p', 'A GPU is either working or wasted, and idle accelerators are the largest avoidable cost in the system. The scheduler exists to keep them full.'],
        ['bul', [
          '**Batch** compatible jobs — same model, same resolution, same step count — into one forward pass.',
          '**Keep models resident**: loading weights takes tens of seconds, so route jobs to workers that already have the right model warm.',
          '**Preempt by priority** so a paid tier is not queued behind a free-tier backlog.',
        ]],
        ['note', 'Batching trades a little latency for a lot of throughput. At this generation time the added wait is imperceptible and the utilisation gain is large.'],
      ],
    },
    {
      title: 'Moderation on both sides', focus: ['mod', 'safety'],
      blocks: [
        ['p', 'Check the prompt before spending GPU time — rejecting early is orders of magnitude cheaper than generating and then discarding. But prompt filtering is bypassable, so the image must also be checked before delivery.'],
        ['warn', 'Both checks are required and they catch different things. Prompt filtering stops the obvious and cheap cases; output filtering stops the ones that got past you, which are the ones that matter.'],
      ],
    },
    {
      title: 'Credits and failure', focus: ['bill', 'k', 'meta'],
      blocks: [
        ['p', 'Reserve credits on submission so a user cannot queue a thousand jobs they cannot pay for, and settle only on successful completion. A failed generation must release the reservation.'],
        ['p', 'Make the whole path idempotent on job id. Workers crash mid-generation and jobs get retried, and a retry that double-charges is the complaint you will hear about.'],
        ['p', 'Outputs are immutable, so content-address them and cache at the edge indefinitely — delivery costs nothing after the first fetch.'],
      ],
    },
  ],
  bar: {
    mid: 'Async job submission, a queue, GPU workers, and progress updates.',
    senior: 'Design batching and model-affinity scheduling, and moderate both prompt and output.',
    staff: 'Cover credit reservation with idempotent settlement, preemption by tier, and warm-model routing as a utilisation strategy.',
  },
},

'LLM Fine-tuning Platform': {
  meta: 'AI / ML · hard · multi-day jobs that must not be lost',
  overview: 'Take a dataset, train a model on a GPU cluster for hours or days, evaluate it, and promote it to serving. Everything hard here is about failure over long timescales.',
  scope: 'Checkpointing, evaluation gating and lineage are the interview. Training algorithms and distributed-training internals are below the line.',
  planning: 'Frame it around duration: a job runs for days on expensive hardware that will fail during the run. That makes checkpointing, preemption and resumability structural rather than defensive.',
  fr: {
    core: ['Register and validate a dataset', 'Launch a training job on the cluster', 'Evaluate the resulting model', 'Promote a version to serving'],
    out: ['Model architecture design', 'Distributed training implementation', 'Inference optimisation'],
  },
  nfr: {
    core: ['A multi-day job survives node failure without restarting', 'No model reaches serving without passing evaluation', 'Full lineage from dataset to deployed version', 'GPU allocation is fair across teams'],
    out: ['Guaranteed training convergence'],
  },
  nums: [['hours to days', 'per training run'], ['~48', 'GPUs in this model'], ['every N steps', 'checkpoint cadence'], ['~100 GB', 'per checkpoint at scale']],
  entities: [
    ['Dataset', 'a validated, versioned, PII-scrubbed corpus'],
    ['Job', 'one training run with its configuration and checkpoints'],
    ['Checkpoint', 'resumable state — the thing that makes long runs survivable'],
    ['ModelVersion', 'an immutable registry entry with its evaluation results'],
  ],
  apiIntro: 'A control-plane API. Nothing here is latency-sensitive; what matters is that state is durable and every transition is recorded.',
  api: [
    { dir: '→', name: 'POST /datasets', body: '{ source, schema } → validated, scrubbed, versioned' },
    { dir: '→', name: 'POST /jobs', body: '{ baseModel, datasetVersion, hyperparams }\n→ { jobId, queuePosition }' },
    { dir: '→', name: 'POST /models/{v}/promote', body: '→ 409 unless evaluation gates have passed' },
  ],
  dives: [
    {
      title: 'The cluster will fail during your run', focus: ['train', 'ckpt', 'sched'],
      blocks: [
        ['p', 'Over a multi-day job across dozens of GPUs, node failure is expected rather than exceptional. Without checkpoints a failure at ninety percent loses everything, including the money already spent.'],
        ['p', 'Checkpoint every N steps to durable storage and make the job resumable from the last one. Then a failure costs the interval, not the run — and preemption becomes safe, which is what lets you run on cheaper capacity and reprioritise mid-flight.'],
        ['calc', 'Checkpointing has a real cost: writing a hundred gigabytes pauses training. The interval is a trade between that overhead and how much work a failure destroys.'],
      ],
    },
    {
      title: 'Data quality dominates outcome', focus: ['val', 'pii', 'lake'],
      blocks: [
        ['p', 'Far more runs are ruined by the dataset than by hyperparameters, and a bad dataset is only visible days later in the evaluation. Validate schema, detect duplicates and check distribution *before* the job is queued.'],
        ['warn', 'Scrub PII before training, not after. A model that memorised personal data cannot be un-trained — the only remedy is discarding the model and starting again.'],
      ],
    },
    {
      title: 'Evaluation gates promotion', focus: ['eval', 'reg', 'serve', 'audit'],
      blocks: [
        ['p', 'A falling loss curve does not mean a better model. Promotion must be gated on an evaluation suite covering both capability and regression, with the results attached immutably to the registry entry.'],
        ['p', 'Serving pins to a specific registry version, never to "latest". That single discipline is what makes rollback as easy as promotion, which matters because you will need it.'],
        ['note', 'Lineage from dataset version through job configuration to deployed model is a compliance requirement in most regulated settings, and the only way to answer "why did the model do that" months later.'],
      ],
    },
  ],
  bar: {
    mid: 'A job queue onto GPU workers, checkpoints, and an evaluation step.',
    senior: 'Design resumability and preemption, validate data before queueing, and gate promotion on evals.',
    staff: 'Cover checkpoint interval economics, full lineage for compliance, and fair GPU allocation across competing teams.',
  },
},

}
