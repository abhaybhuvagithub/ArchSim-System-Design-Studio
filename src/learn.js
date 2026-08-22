// Teaching content: a step-by-step lesson that checks itself against your canvas,
// "difference between" tables, an interview quiz, and the numbers worth memorising.

// Each step's check receives a context built from the live graph, so the lesson
// ticks itself off as you build rather than asking you to self-report.
export const LESSON = [
  {
    title: 'Nail the requirements first',
    do: 'Pick a template (or Blank canvas) and read the requirements checklist under the Capacity tab.',
    why: 'Every strong design interview starts by narrowing scope: which features are in, which are explicitly out, and what the read:write ratio looks like. Drawing boxes before this is the classic mistake.',
    check: c => c.nodes.length > 0,
  },
  {
    title: 'Set the traffic you must survive',
    do: 'Move the Traffic slider to your estimated peak requests per second.',
    why: 'Capacity math comes before components. 100M requests/day ÷ 86,400 ≈ 1,150 rps average, and peak is usually 2–3× that. Design for peak, not average.',
    check: c => c.rps > 0,
  },
  {
    title: 'Add the traffic source and an edge tier',
    do: 'Place a Client, then a CDN, Load Balancer or API Gateway in front of your services.',
    why: 'Clients must never address a service directly: you lose the ability to add instances, drain one for deploys, or survive a single failure. The edge tier is also where TLS, caching and routing belong.',
    check: c => c.has('client') && c.any(['cdn', 'lb', 'gateway', 'gslb', 'waf', 'bff']),
  },
  {
    title: 'Keep the compute tier stateless',
    do: 'Add a Web/App/Microservice tier behind the edge and set its replicas above 1.',
    why: 'Stateless services can be cloned, autoscaled and killed freely. The moment a service holds session state in memory you have made it a pet, and load balancing gets sticky and fragile.',
    check: c => c.any(['web', 'app', 'micro', 'ws']) &&
      c.nodes.some(n => ['web', 'app', 'micro', 'ws'].includes(n.type) && (n.replicas || 1) > 1),
  },
  {
    title: 'Choose a datastore deliberately',
    do: 'Add a SQL or NoSQL store (or object storage) and wire your service to it.',
    why: 'Pick for the access pattern, not for fashion: relational for transactions and joins, partitioned NoSQL for huge key-based reads, object storage for blobs. See the Compare tab for the trade-offs.',
    check: c => c.any(['sql', 'nosql', 'blob']),
  },
  {
    title: 'Cache the hot read path',
    do: 'Add a Cache between the service and the database — or let ✨ Improve insert it for you.',
    why: 'Most systems are read-heavy by 10:1 or more. An 80% hit ratio removes four-fifths of database load. Then decide the pattern (cache-aside vs write-through) and the eviction policy.',
    check: c => c.has('cache'),
  },
  {
    title: 'Make slow work asynchronous',
    do: 'Add a Queue or Event Stream and put a Worker Pool behind it.',
    why: 'Anything slow, bursty or retryable — transcoding, email, fan-out, third-party calls — belongs off the request path. The queue absorbs spikes that would otherwise become dropped requests.',
    check: c => c.any(['queue', 'kafka', 'mq']) && c.any(['worker', 'micro']),
  },
  {
    title: 'Run the simulation and read the numbers',
    do: 'Press ▶ Simulate and watch p50, p95, p99, success rate and per-node utilization.',
    why: 'A diagram cannot be wrong, which is why diagrams teach you nothing. Numbers can be wrong. Queueing delay rises sharply past ~70% utilization — that is why p99 explodes long before a tier hits 100%.',
    check: c => c.simOn,
  },
  {
    title: 'Remove every bottleneck',
    do: 'Scale the saturated tiers until no component is above 80% and success rate is 100%.',
    why: 'Utilization above ~80% means requests queue; above 100% they are dropped. Headroom is not waste, it is what absorbs the next traffic spike and the loss of an instance.',
    check: c => c.nodes.length >= 4 && c.maxUtil > 0 && c.maxUtil < 0.8 && c.successRate > 0.999,
  },
  {
    title: 'Break it on purpose',
    do: 'Open the Chaos tab, inject a fault while simulating, and watch what it does to success rate.',
    why: 'Redundancy you have never tested is a guess. If losing one instance moves your numbers, you found a single point of failure before production did.',
    check: c => c.chaosUsed,
  },
  {
    title: 'Make it observable',
    do: 'Add Metrics & Alerts (plus an OTel Collector, logs and tracing) and route alerts to on-call.',
    why: 'An outage you learn about from users is an outage you handled badly. Metrics say something is wrong, logs say what, traces say where — and only paging says someone is on it.',
    check: c => c.any(['monitor', 'otel', 'logs', 'tracing']),
  },
  {
    title: 'Harden it for production',
    do: 'Add a WAF, an identity provider, a secrets store and a backup for your datastore.',
    why: 'These are the things reviewers ask about after the happy path: who can call this, where credentials live, what filters hostile traffic, and how you recover from a bad migration. Replicas are not backups.',
    check: c => c.any(['waf', 'iam', 'secrets', 'backup', 'audit']),
  },
  {
    title: 'Narrate the request flow',
    do: 'Turn on ①②③ Steps, label a few connections, then export a PNG.',
    why: 'In an interview you talk through one request end to end. Numbered hops and labelled edges ("cache miss", "async") turn a static picture into a story you can walk someone through.',
    check: c => c.steps || c.edges.some(e => e.label),
  },
  {
    title: 'Understand the component internals',
    do: 'Click 🔍 Internals on any component in the Inspector panel to see its algorithm, data structures, and failure modes.',
    why: 'Every component is a black box until you know its internals: LRU vs ARC for caches, B-tree vs LSM for databases, token bucket vs sliding window for rate limiting. Knowing the mechanism teaches you when it fails and how to recover.',
    check: c => c.internalsViewed,
  },
  {
    title: 'Know your wall',
    do: 'Open the Scale tab and scroll to "The Wall" section — this is the fundamental limit of your design.',
    why: 'Past the wall, throwing more money or capacity does not help. The wall is where design ends and business decisions (pricing, scope, admission control) begin. Every design here has a wall, and naming it is the senior move.',
    check: c => c.wallUnderstood,
  },
  // ── Pending: AI Ecosystem Exploration ────────────────────────────────────
  {
    title: '🚀 Integrate an LLM provider',
    do: 'Add a decision point in your design: which LLM? (OpenAI GPT, Claude, Gemini, Llama, Mistral, Cohere, Hugging Face, Ollama, vLLM)',
    why: 'LLM choice drives latency, cost, and capability. Some apps need local (Ollama, vLLM) for compliance; others lean on API providers. Understand token limits, context windows, and model sizes.',
    check: c => false,
  },
  {
    title: '🔗 Add embeddings and a vector store',
    do: 'Design semantic search: embeddings (OpenAI Embeddings, Voyage AI, Sentence Transformers, BGE) + vector DB (Pinecone, Weaviate, Qdrant, Chroma, pgvector, Elasticsearch, Redis, MongoDB Atlas).',
    why: 'RAG systems need embeddings to vectorize text and a store for fast similarity search. Hybrid search (keyword + semantic) often beats pure semantic.',
    check: c => false,
  },
  {
    title: '🎯 Choose a RAG framework',
    do: 'Explore LangChain, LlamaIndex, or Haystack for orchestrating retrieval + LLM chains.',
    why: 'RAG is a pattern, not a component. You orchestrate: fetch → augment → prompt → parse. Frameworks handle retries, caching, and token counting.',
    check: c => false,
  },
  {
    title: '🤖 Plan for agentic behavior',
    do: 'For reasoning loops: LangGraph, CrewAI, Microsoft AutoGen, or Semantic Kernel. Map out tool use and reward loops.',
    why: 'Agents are agentic because they call tools (search, API, code, exec) iteratively. Adds latency and cost but unlocks tasks pure completion cannot solve.',
    check: c => false,
  },
  {
    title: '📊 Add observability for LLM chains',
    do: 'Integrate LangSmith, Langfuse, Arize, or Weights & Biases to trace calls, prompt versions, latency, and cost.',
    why: 'LLM apps are opaque without observability. Traces show token usage, latency per hop, cache hits, and model hallucinations.',
    check: c => false,
  },
  {
    title: '🔐 Secure your prompts and APIs',
    do: 'Review prompt injection risks, API key management, output filtering (Guardrails AI, Microsoft Presidio), and PII detection.',
    why: 'LLMs can be tricked to ignore instructions, leak data, or be jailbroken. Treat prompts like SQL queries — sanitize, validate, and audit.',
    check: c => false,
  },
  {
    title: '💾 Design your LLM memory layers',
    do: 'Short-term: context window. Medium-term: Redis/cache. Long-term: vector DB for semantic memory or SQL for facts.',
    why: 'LLMs have fixed context windows. Everything outside — user history, preferences, learned facts — must live in backing stores.',
    check: c => false,
  },
  {
    title: '🏗️ Add model context protocol (MCP)',
    do: 'Consider MCP servers (FastMCP, MCP Registry) for standardizing tool use across LLM apps.',
    why: 'MCP is an open standard for connecting LLMs to data sources and tools. Reduces fragmentation and vendor lock-in.',
    check: c => false,
  },
  // ── Google AI Ecosystem (Nov 2025+) ────────────────────────────────────
  {
    title: '🚀 Choose your Google LLM: Gemini 3 vs Gemini 2.5',
    do: 'Evaluate Gemini 3 Pro (latest MoE, multimodal, agentic) vs Gemini 2.5 (reasoning, structured outputs).',
    why: 'Gemini 3 launched Nov 2025. It is faster and supports autonomous agents. Gemini 2.5 is better for step-by-step reasoning. Pick based on latency budget and reasoning needs.',
    check: c => false,
  },
  {
    title: '📖 Add NotebookLM for document understanding',
    do: 'Use NotebookLM alongside your LLM for RAG: upload PDFs/Docs, let Gemini answer questions with citations.',
    why: 'NotebookLM is Gemini\'s sibling for document understanding. Saves you from building embeddings + vector DB yourself. One-click study guides and podcast generation.',
    check: c => false,
  },
  {
    title: '🎨 Integrate Imagen 4 for image generation',
    do: 'For image-heavy features: use Imagen 4 (text→image, inpainting, style transfer) instead of DALL-E or Stable Diffusion.',
    why: 'Imagen 4 is Google\'s flagship image model (Nov 2025). Integrated into Workspace (Docs, Slides). Photorealistic quality, fast iteration. API or web UI.',
    check: c => false,
  },
  {
    title: '🎬 Add Veo 3 for video generation',
    do: 'For video content: Veo 3 (text→video, up to 5min, 1080p). Useful for tutorials, demos, marketing content.',
    why: 'Veo 3 is Google\'s video diffusion model. High quality but expensive and slow (minutes per generation). Plan workflow around async generation.',
    check: c => false,
  },
  {
    title: '👁️ Deploy Gemini Live (Project Astra) for real-time multimodal AI',
    do: 'Stream camera/screen to Gemini 3 Pro. Get real-time understanding and guidance (coding, debugging, tutoring).',
    why: 'Project Astra brings "see what I see" AI. 100-500ms latency. Works on device camera or screen share. Powerful for hands-on learning and support.',
    check: c => false,
  },
  {
    title: '🌐 Automate web tasks with Project Mariner (Agent Mode)',
    do: 'For data scraping or form automation: Mariner reads DOM, plans clicks, executes in headless Chrome. No code needed.',
    why: 'Mariner is Gemini controlling a browser. Useful for: login automation, data extraction, multi-page workflows. Requires human approval for real systems.',
    check: c => false,
  },
  {
    title: '🚀 Try Antigravity IDE for AI-native development',
    do: 'Download Antigravity (agent-first IDE, free preview). Let AI agents write code, run tests, commit changes. You review artifacts.',
    why: 'Antigravity (Nov 2025) flips the model: AI as executor, you as reviewer. Editor view (VS Code style) + Manager view (mission control). Risky on live systems but amazing for prototypes.',
    check: c => false,
  },
  {
    title: '🧠 Deploy on Vertex AI for managed ML at scale',
    do: 'Use Vertex AI Agent Builder to define tools + orchestration. Duet AI for code generation within GCP Console.',
    why: 'Vertex is Google\'s MLOps platform. Model garden (fine-tune any Gemini variant), pipelines (DAG workflows), canary deployments with auto-rollback. Enterprise safe.',
    check: c => false,
  },
  {
    title: '🌱 Use Gemma (open-source) for privacy-sensitive on-device AI',
    do: 'Gemma 2B/7B/27B runs on laptop or phone. No API calls, data stays local. Quantized and optimized.',
    why: 'Not every feature needs cloud AI. On-device inference + privacy + latency predictability. Perfect for embedded features, local RAG, offline support.',
    check: c => false,
  },
  {
    title: '⚙️ Add Duet AI for smart coding in Google Cloud Console',
    do: 'Type "/" in Cloud SQL console or Terraform editor. Duet suggests queries, infrastructure code, debugging steps.',
    why: 'Duet is Gemini embedded in GCP tools. Context-aware (reads your existing code/config). Saves time on boilerplate and catches mistakes.',
    check: c => false,
  },
  // ── AI Engineering, job-ready (from 342 Indian AI JDs, last 90 days) ────
  // Each step is one of the ten most-demanded skills, ordered by how many
  // job descriptions asked for it — and each grades itself against your
  // canvas, so working through the track builds the system that proves it.
  {
    title: '💼 #1 RAG — asked for in 89% of JDs',
    do: 'Build the retrieval loop on the canvas: a service tier wired to a Vector DB and an LLM (add an Embedding service for the full picture).',
    why: 'Retrieval-Augmented Generation tops every hiring list because it is how real products ground an LLM in their own data. If you canvas one architecture this year, canvas this one.',
    check: c => c.has('vector') && c.any(['llm', 'gemini3', 'gemini2', 'gemmaos']),
  },
  {
    title: '💼 #2 Chain framework (LangChain) — 82% of JDs',
    do: 'Complete the chain: Embeddings feeding the Vector DB alongside your LLM. That embed → retrieve → generate pipeline is what LangChain orchestrates.',
    why: 'Frameworks come and go; the chain shape they orchestrate does not. Interviewers probe whether you know what LangChain does under the hood — this canvas is the answer.',
    check: c => c.has('embed') && c.has('vector') && c.any(['llm', 'gemini3', 'gemini2', 'gemmaos']),
  },
  {
    title: '💼 #3 API service tier (FastAPI) — 76% of JDs',
    do: 'Put a service tier (App Server / Microservice / BFF) in front of your AI components — the LLM is never internet-facing directly.',
    why: 'FastAPI is the de-facto Python serving layer for AI endpoints. Architecturally it is your app tier: auth, validation, streaming responses, and the place your Code tab generates a real server for.',
    check: c => c.any(['app', 'micro', 'bff', 'web']),
  },
  {
    title: '💼 #4 Vector databases — 71% of JDs',
    do: 'Open the Vector DB\'s 🔍 internals: HNSW graph navigation, ef_search recall tuning, int8 quantization. Then check its cost at your traffic in the Cost tab.',
    why: 'Pinecone, FAISS, Chroma, Weaviate — different products, one data structure. Interviews ask how approximate nearest neighbor actually works, not which vendor you picked.',
    check: c => c.has('vector'),
  },
  {
    title: '💼 #5 Prompt engineering (+ guardrails) — 64% of JDs',
    do: 'Add a Guardrails component on your LLM path — injection scanning in, PII redaction out. That is prompt engineering\'s production half.',
    why: 'In a JD, "prompt engineering" means making model behavior reliable and safe, not clever wording. The architecture version is a guard tier on both directions of every prompt.',
    check: c => c.has('guard'),
  },
  {
    title: '💼 #6 Docker & containers — 61% of JDs',
    do: 'Open the Code tab → docker-compose: every component on your canvas is already containerized with images, healthchecks and replica counts. Run a microservice or K8s tier to go deeper.',
    why: 'AI systems ship as containers. The compose file the studio generates from your design is exactly the artifact these JDs expect you to be able to write and debug.',
    check: c => c.any(['micro', 'k8s', 'worker']),
  },
  {
    title: '💼 #7 AWS / GCP deployment — 58% of JDs',
    do: 'Switch the cloud picker off Generic: every component relabels to its managed service (SageMaker vs Vertex, ElastiCache vs Memorystore) and the bill reprices.',
    why: 'Deployment fluency means knowing what your boxes are called on a real cloud and what they cost there. The Terraform view in the Code tab turns the diagram into the deployment.',
    check: c => c.cloud && c.cloud !== 'generic',
  },
  {
    title: '💼 #8 Multi-agent systems (LangGraph) — 49% of JDs',
    do: 'Add an Agent Orchestrator and wire it to your LLM and tools. Open its 🔍 internals: stateful graph, cycles, checkpoints, human-in-the-loop.',
    why: 'The step past chains: agents that plan, call tools, reflect and retry as a graph with persisted state. Half of these JDs now ask for it — it is the fastest-growing skill on the list.',
    check: c => c.has('agentgraph'),
  },
  {
    title: '💼 #9 LoRA / QLoRA fine-tuning — 37% of JDs',
    do: 'Add the Fine-tuning component and read its internals: frozen base, rank-r adapters, 4-bit QLoRA — and why the artifact ships in megabytes.',
    why: 'When RAG is not enough, you tune. LoRA is the technique that made tuning affordable — one GPU for a 70B-class model — and hot-swappable adapters are how one base serves many tenants.',
    check: c => c.has('finetune'),
  },
  {
    title: '💼 #10 LLM observability (Langfuse) — 28% of JDs',
    do: 'Add the LLM Observability component downstream of your LLM. Its internals show trace trees, token-cost attribution and eval scoring.',
    why: 'Rarest on the list, which makes it the differentiator: candidates who can say how they would trace a chain, attribute token spend and eval prompt versions stand out immediately.',
    check: c => c.has('llmobs'),
  },
]

export const COMPARISONS = [
  {
    title: 'SQL vs NoSQL', left: 'SQL (relational)', right: 'NoSQL (partitioned)',
    rows: [
      ['Schema', 'Fixed, enforced, migrations', 'Flexible, per-item'],
      ['Joins', 'Native, powerful', 'Denormalise instead'],
      ['Transactions', 'ACID, multi-row', 'Usually single-item'],
      ['Scaling', 'Vertical first, then shard', 'Horizontal by design'],
      ['Best for', 'Money, orders, anything relational', 'Huge key-based reads, feeds, events'],
    ],
  },
  {
    title: 'Queue vs Event stream', left: 'Queue (SQS/Rabbit)', right: 'Log (Kafka)',
    rows: [
      ['Message life', 'Deleted after ack', 'Retained for a window'],
      ['Consumers', 'Usually one takes each job', 'Many independent groups'],
      ['Replay', 'No', 'Yes — reset the offset'],
      ['Ordering', 'Best-effort', 'Per partition key'],
      ['Best for', 'Task/job dispatch', 'Event history, fan-out, analytics'],
    ],
  },
  {
    title: 'Cache-aside vs Write-through', left: 'Cache-aside', right: 'Write-through',
    rows: [
      ['Reads', 'Miss → DB → populate', 'Always warm'],
      ['Writes', 'Write DB, invalidate key', 'Write cache and DB together'],
      ['Staleness', 'Possible between the two ops', 'Low'],
      ['Write cost', 'Cheap', 'Higher latency per write'],
      ['Best for', 'Read-heavy, tolerant of a stale ms', 'Read-after-write correctness'],
    ],
  },
  {
    title: 'Horizontal vs Vertical scaling', left: 'Horizontal (scale out)', right: 'Vertical (scale up)',
    rows: [
      ['Method', 'More instances', 'Bigger instance'],
      ['Ceiling', 'Effectively none', 'Largest machine available'],
      ['Complexity', 'LB, statelessness, coordination', 'Almost none'],
      ['Failure', 'Lose one of many', 'Lose everything'],
      ['Best for', 'Stateless tiers', 'Single-writer databases, legacy'],
    ],
  },
  {
    title: 'Strong vs Eventual consistency', left: 'Strong', right: 'Eventual',
    rows: [
      ['Read after write', 'Always sees the write', 'May see stale data briefly'],
      ['Latency', 'Higher (coordination)', 'Lower'],
      ['Availability under partition', 'Reduced (CP)', 'Maintained (AP)'],
      ['Best for', 'Balances, inventory, bookings', 'Likes, feeds, view counts'],
    ],
  },
  {
    title: 'Data lake vs Data warehouse', left: 'Data lake', right: 'Data warehouse',
    rows: [
      ['Schema', 'On read', 'On write, modelled'],
      ['Data', 'Raw, any format', 'Cleaned, conformed'],
      ['Cost', 'Very cheap per TB', 'Expensive per TB'],
      ['Query speed', 'Slower, engine-dependent', 'Fast, columnar'],
      ['Best for', 'Landing zone, ML, exploration', 'BI, dashboards, finance reporting'],
    ],
  },
  {
    title: 'ETL vs ELT', left: 'ETL', right: 'ELT',
    rows: [
      ['Transform where', 'Before load, in a pipeline', 'After load, inside the warehouse'],
      ['Raw data kept', 'Often not', 'Yes — reprocess anytime'],
      ['Compute', 'Separate cluster', 'Warehouse engine'],
      ['Best for', 'Strict schemas, PII stripping first', 'Cloud warehouses, evolving models'],
    ],
  },
  {
    title: 'Monolith vs Microservices', left: 'Monolith', right: 'Microservices',
    rows: [
      ['Deploy', 'One artifact', 'Independently per service'],
      ['Data', 'One shared schema', 'Database per service'],
      ['Calls', 'In-process, fast', 'Network — retries, timeouts, tracing'],
      ['Team fit', 'Small teams', 'Many teams owning domains'],
      ['Cost', 'Low ops overhead', 'Real platform investment'],
    ],
  },
  {
    title: 'Orchestration vs Choreography', left: 'Orchestration (saga)', right: 'Choreography (events)',
    rows: [
      ['Flow lives', 'In a coordinator', 'Spread across consumers'],
      ['Visibility', 'Easy to see and debug', 'Hard to trace end to end'],
      ['Coupling', 'Coordinator knows everyone', 'Services only know events'],
      ['Best for', 'Regulated, ordered workflows', 'Loose, extensible reactions'],
    ],
  },
  {
    title: 'L4 vs L7 load balancing', left: 'L4 (transport)', right: 'L7 (application)',
    rows: [
      ['Decides on', 'IP and port', 'Path, header, cookie'],
      ['Overhead', 'Very low', 'Higher — parses the request'],
      ['Features', 'Fast passthrough', 'Routing, TLS, rewrite, sticky'],
      ['Best for', 'Raw throughput, TCP', 'HTTP APIs, canaries, A/B'],
    ],
  },
  {
    title: 'REST vs GraphQL vs gRPC', left: 'REST / GraphQL', right: 'gRPC',
    rows: [
      ['Shape', 'Resources / one typed graph', 'Typed RPC methods'],
      ['Over-fetching', 'Common in REST, solved by GraphQL', 'Not an issue'],
      ['Payload', 'JSON', 'Protobuf, binary'],
      ['Best for', 'Public and client-facing APIs', 'Internal service-to-service'],
    ],
  },
  {
    title: 'Replication vs Backup', left: 'Replication', right: 'Backup',
    rows: [
      ['Protects against', 'Hardware and node failure', 'Bad writes, bugs, ransomware'],
      ['Bad data', 'Replicates it instantly', 'Restore to a point in time'],
      ['Recovery', 'Failover in seconds', 'Minutes to hours'],
      ['Rule', 'Both. Neither replaces the other.', 'Untested restore = no backup'],
    ],
  },
  {
    title: 'Metrics vs Logs vs Traces', left: 'Metrics', right: 'Logs & traces',
    rows: [
      ['Answers', 'Is something wrong?', 'What and where exactly?'],
      ['Shape', 'Numeric time series', 'Events / spans per request'],
      ['Cost driver', 'Label cardinality', 'Volume and retention'],
      ['Use in an incident', 'Detect and alert', 'Diagnose the failing hop'],
    ],
  },
  {
    title: 'Unit vs Integration vs E2E', left: 'Unit / API tests', right: 'End-to-end UI tests',
    rows: [
      ['Speed', 'Milliseconds to seconds', 'Minutes'],
      ['Stability', 'Deterministic', 'Flaky by nature — real browsers, real timing'],
      ['Scope', 'One unit or one endpoint', 'A whole user journey'],
      ['When it fails', 'Points at the change', 'Points at "something broke"'],
      ['How many', 'Thousands', 'Tens — critical journeys only'],
    ],
  },
  {
    title: 'Shift-left vs Shift-right', left: 'Shift left', right: 'Shift right',
    rows: [
      ['When', 'Before merge', 'After release'],
      ['Examples', 'Static analysis, unit, contract, API tests', 'Synthetic probes, RUM, canary, chaos'],
      ['Catches', 'Defects, regressions, breaking contracts', 'Reality: real data, real load, real users'],
      ['Cost of a find', 'Minutes', 'An incident'],
      ['Verdict', 'Do both — neither replaces the other', 'Do both'],
    ],
  },
  {
    title: 'Latency vs Throughput', left: 'Latency', right: 'Throughput',
    rows: [
      ['Measures', 'Time for one request', 'Requests per second'],
      ['Improved by', 'Caching, fewer hops, closer PoPs', 'More replicas, batching, async'],
      ['Trap', 'Averages hide the tail — use p99', 'High throughput can still feel slow'],
      ['Relationship', 'Rises sharply as utilization → 100%', 'Caps at the slowest tier'],
    ],
  },
]

export const QUIZ = [
  {
    q: '100 million requests per day. Roughly what average QPS should you design around?',
    options: ['~120 QPS', '~1,150 QPS', '~11,500 QPS', '~100,000 QPS'],
    answer: 1,
    why: '100,000,000 ÷ 86,400 s ≈ 1,157 QPS average. Then size for peak, typically 2–3× that.',
  },
  {
    q: 'A service tier sits at 95% utilization. What happens to p99 latency?',
    options: ['Unchanged until 100%', 'Rises slightly', 'Rises sharply from queueing', 'Falls — the CPU is efficient'],
    answer: 2,
    why: 'Queueing delay scales roughly with 1/(1−utilization), so it climbs steeply well before saturation. Keep tiers near 50–70%.',
  },
  {
    q: 'Read:write ratio is 100:1. Which single change helps most?',
    options: ['Shard the database', 'Add a cache on the read path', 'Add more app replicas', 'Switch to NoSQL'],
    answer: 1,
    why: 'A cache at an 80% hit ratio removes most of the read load for a fraction of the effort of resharding.',
  },
  {
    q: 'Under CAP, a network partition forces you to choose between:',
    options: ['Consistency and availability', 'Latency and throughput', 'Cost and durability', 'Reads and writes'],
    answer: 0,
    why: 'Partition tolerance is not optional in a distributed system, so the real choice is CP (reject requests) or AP (serve possibly stale data).',
  },
  {
    q: 'Why must a queue consumer be idempotent?',
    options: ['To process faster', 'Because delivery is at-least-once, so duplicates happen', 'To preserve ordering', 'To reduce storage'],
    answer: 1,
    why: 'Retries and redeliveries are normal. Dedupe on a message or business key so replaying an event cannot double-charge anyone.',
  },
  {
    q: 'Three replicas at 99.9% availability each, in parallel. Combined availability?',
    options: ['99.9%', '~99.7%', '~99.9999999%', '33.3%'],
    answer: 2,
    why: '1 − (0.001)³ = 99.9999999%, assuming truly independent failures. Shared dependencies destroy that assumption — that is why correlated failure matters.',
  },
  {
    q: 'Best structure for "restaurants within 2 km of me"?',
    options: ['B-tree on lat and lng', 'Geohash or quadtree index', 'Full table scan with a distance function', 'Inverted text index'],
    answer: 1,
    why: 'Geospatial indexes (geohash, quadtree, H3, S2) turn a 2-D proximity search into a prefix or cell lookup.',
  },
  {
    q: 'Fan-out on write breaks down for which users?',
    options: ['Brand new users', 'Inactive users', 'Celebrities with millions of followers', 'Users on mobile'],
    answer: 2,
    why: 'One celebrity post would mean millions of timeline writes. Hybrid designs fan out normal users on write and merge celebrity posts on read.',
  },
  {
    q: 'What does a 301 redirect cost you in a URL shortener?',
    options: ['Nothing', 'Analytics — browsers cache it and stop calling you', 'Extra database load', 'SEO ranking'],
    answer: 1,
    why: '301 is permanent and cacheable, so it is fast but invisible to you. 302 keeps every click observable at the cost of more traffic.',
  },
  {
    q: 'The outbox pattern exists to prevent:',
    options: ['Slow queries', 'A dual-write where the DB commits but the event publish fails', 'Cache stampedes', 'Hot partitions'],
    answer: 1,
    why: 'Write the event into the same transaction as the state change, then publish it asynchronously — so the two can never diverge.',
  },
  {
    q: 'Which is NOT protection against a bad migration wiping data?',
    options: ['Point-in-time backups', 'Read replicas', 'Snapshots with tested restores', 'Archive with retention'],
    answer: 1,
    why: 'Replicas apply the destructive change faithfully within milliseconds. Replication is availability, not recovery.',
  },
  {
    q: 'In a RAG system, which component is almost always the bottleneck?',
    options: ['Vector database', 'Embedding service', 'LLM inference', 'API gateway'],
    answer: 2,
    why: 'Generation is orders of magnitude slower and costlier than retrieval — hundreds of ms to seconds. Batch, stream tokens, cap output, and cache semantically.',
  },
  {
    q: 'You should alert on:',
    options: ['Every CPU spike', 'Symptoms and SLO burn rate', 'Each individual host going unhealthy', 'Every error in the logs'],
    answer: 1,
    why: 'Cause-based alerts create pager fatigue and get muted. Page on user-visible symptoms and error-budget burn; keep causes on dashboards.',
  },
  {
    q: 'Your suite is 80% UI tests and 20% API tests. What is wrong?',
    options: ['Nothing, coverage is coverage', 'It is an inverted pyramid — slow, flaky, and it points at "something broke"', 'UI tests are more accurate', 'You need more UI tests'],
    answer: 1,
    why: 'The ice-cream cone. UI tests are slow and flaky, so the suite gets re-run on red and eventually ignored. Push coverage down into fast API and unit tests and keep UI for critical journeys.',
  },
  {
    q: 'A test fails intermittently with no code change. The most common root cause is:',
    options: ['A real race condition in production code', 'Shared mutable test data or timing assumptions', 'A slow CI runner', 'A browser bug'],
    answer: 1,
    why: 'Shared fixtures and implicit waits dominate flake reports. Seed data per run and wait on conditions rather than sleeping — and track flake rate so bad tests get quarantined, not re-run.',
  },
  {
    q: 'Why front SAP or a mainframe with a queue instead of adding replicas?',
    options: ['Queues are cheaper', 'They cannot be scaled out, so load must be absorbed', 'To improve latency', 'For better logging'],
    answer: 1,
    why: 'Vendor and legacy cores have hard throughput ceilings and licence limits. Async buffering smooths bursts instead of rejecting them.',
  },
]

export const NUMBERS = [
  { group: 'Latency worth memorising', rows: [
    ['L1 cache reference', '~1 ns'],
    ['Main memory reference', '~100 ns'],
    ['SSD random read', '~100 µs'],
    ['Round trip in the same datacenter', '~0.5 ms'],
    ['Disk seek (spinning)', '~10 ms'],
    ['Round trip California ↔ Netherlands', '~150 ms'],
  ]},
  { group: 'Rough capacity per instance', rows: [
    ['App server (business logic)', '~1–2k rps'],
    ['Redis / in-memory cache', '~100k rps'],
    ['SQL database (mixed)', '~5k rps'],
    ['Kafka broker', '~100k+ msg/s'],
    ['LLM inference (GPU)', '~10s of rps'],
    ['ERP / mainframe core', '~1k rps, cannot scale out'],
  ]},
  { group: 'Estimation shortcuts', rows: [
    ['1 million/day', '≈ 12 rps'],
    ['100 million/day', '≈ 1.2k rps'],
    ['1 billion/day', '≈ 12k rps'],
    ['Peak vs average', '2–3× average'],
    ['Availability 99.9%', '≈ 43 min downtime/month'],
    ['Availability 99.99%', '≈ 4.3 min downtime/month'],
  ]},
  { group: 'Storage sizing', rows: [
    ['1 KB × 1M rows', '1 GB'],
    ['1 KB/s written', '≈ 86 MB/day, ≈ 31 GB/year'],
    ['UUID / short id', '16 B / ~7 B'],
    ['Typical web page', '~2 MB'],
    ['1 min of 1080p video', '~50–100 MB'],
    ['Replication factor 3', '3× raw storage cost'],
  ]},
]

// Popular tips and tricks. Interview-process advice reflects what hiring guides
// converge on; the engineering rules of thumb are the ones you can check right
// here on the canvas, which is why each carries a "try it" line.
export const TIPS = [
  {
    group: 'Before you draw anything',
    items: [
      {
        tip: 'Spend the first five minutes on requirements, not boxes',
        why: 'The most common failure in a design interview is designing before knowing what is being designed. "Design Twitter" is not a spec — read/write ratio, freshness tolerance and consistency needs are, and they decide almost every box you are about to draw.',
        try: 'Load a template and read its requirements list before looking at the diagram.',
      },
      {
        tip: 'Non-functional requirements pick your components, not features',
        why: 'Features tell you what to build; latency budget, availability target, traffic shape and consistency model tell you whether you need a cache, a queue, sharding or replication. Get these first and the architecture mostly falls out.',
        try: 'Change the traffic slider before adding anything — watch which tier turns orange first.',
      },
      {
        tip: 'Do the arithmetic out loud',
        why: 'Back-of-the-envelope numbers stop you designing a distributed system for 50 rps or a single box for 500k. Requests per second, bytes per request, storage per year, and reads versus writes — four numbers that settle most arguments.',
        try: 'Open Learn → Numbers for the figures worth memorising.',
      },
    ],
  },
  {
    group: 'While you design',
    items: [
      {
        tip: 'Narrate the trade-off, not the diagram',
        why: 'A finished diagram produced in silence scores badly. The interviewer is buying your reasoning, so say why the queue is there and what you gave up to have it — durability and back-pressure bought at the cost of end-to-end latency and an at-least-once contract.',
        try: 'Open the Brief tab — it narrates your design the way you should.',
      },
      {
        tip: 'Commit to a choice and defend it',
        why: '"It depends" is fine once. By the third time it reads as not knowing. Pick Postgres or Cassandra, say which property made you pick it, and name the condition that would change your mind.',
        try: 'Learn → Compare has the head-to-head tables for the usual pairs.',
      },
      {
        tip: 'Do not over-engineer for scale nobody asked for',
        why: 'Reaching for Kafka, a service mesh and multi-region at 100 rps signals poor judgement just as loudly as a single server at 100k rps does. Match the machinery to the number you were given.',
        try: 'Watch the cost tab as you add components — the bill is the honest reviewer.',
      },
      {
        tip: 'Cache the read path before you shard the write path',
        why: 'Most consumer systems are read-heavy by an order of magnitude. A cache at an 80% hit ratio removes four fifths of the load for a fraction of the effort of resharding, and it is reversible if you get it wrong.',
        try: 'Improve → "Cache reads in front of…" inserts one and you can watch the database load drop.',
      },
      {
        tip: 'Two of everything on the live path',
        why: 'A single instance is not a capacity decision, it is an availability decision. One box at 99.9% costs you about 43 minutes a month; two behind a load balancer costs seconds. This is the cheapest reliability you will ever buy.',
        try: 'The Capacity tab flags every single instance under "Needs attention".',
      },
    ],
  },
  {
    group: 'Numbers that keep you honest',
    items: [
      {
        tip: 'Latency goes vertical around 70–80% utilisation',
        why: 'Queueing delay follows roughly 1/(1−utilisation), so the last 20% of capacity costs more latency than the first 80% combined. Size for about 55% and you have somewhere to put a spike.',
        try: 'Push traffic until a tier passes 80% and watch p99 move long before anything is dropped.',
      },
      {
        tip: 'Design against p99, report p50',
        why: 'Averages hide the users who are leaving. If one page makes 20 backend calls, roughly one in five page loads hits your p95 — the tail is the typical experience for a fan-out request.',
        try: 'The stat bar shows p50, p95 and p99 side by side; compare their ratio at low and high load.',
      },
      {
        tip: 'Availability multiplies, redundancy exponentiates',
        why: 'Five components at 99.9% in series give you 99.5%, not 99.9%. Adding a second instance turns 1−a into (1−a)², which is why two mediocre replicas beat one excellent server.',
        try: 'Add a replica to your worst tier and watch the modelled availability move.',
      },
      {
        tip: 'Estimate the bill before the architecture review does',
        why: 'Cost is now an explicit interview criterion, not a bonus. Egress, per-request pricing and always-on instances are where designs quietly become unaffordable — CDN egress alone often dominates a read-heavy system.',
        try: 'Open the cost tab and sort by line item — the top row is rarely the one people guess.',
      },
    ],
  },
  {
    group: 'Before you call it done',
    items: [
      {
        tip: 'Kill something on purpose',
        why: 'Walking your own design through failure modes out loud is graded explicitly now. Name what happens when the cache dies cold, when a zone goes, when the queue backs up, and when a dependency gets slow rather than failing outright.',
        try: 'The Chaos tab has 28 named faults — grey failure and retry storm are the ones people forget.',
      },
      {
        tip: 'Slow is worse than dead',
        why: 'A dependency that fails fast sheds load; one that hangs holds your threads and takes the whole service with it. Timeouts, bulkheads and a circuit breaker are what separate a degraded feature from an outage.',
        try: 'Inject "Grey Failure" or "Thread Pool Exhaustion" and compare the p99 to a clean kill.',
      },
      {
        tip: 'Retries need jitter, or they become the outage',
        why: 'Synchronised retries after a blip are indistinguishable from a DDoS you built yourself. Exponential backoff with jitter, a retry budget, and never retrying a non-idempotent write.',
        try: 'Inject "Retry Storm" and watch traffic multiply against a tier that was already struggling.',
      },
      {
        tip: 'Say what you would build first',
        why: 'Closing with a phased plan — the smallest thing that works, then what you would add at 10× — shows judgement about sequencing, which is most of the job. It also gracefully covers anything you did not have time to design.',
        try: 'Untick every requirement, then re-tick them one at a time to see the design grow.',
      },
    ],
  },
]
