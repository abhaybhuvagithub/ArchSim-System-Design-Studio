# Changelog

## 1.22.0 — 2026-09-03
- 🕸️ Analytics area gains a 6th concept: **Data Mesh** — domains own their data as a versioned, contract-first product on async streams; the platform becomes the paved road (schema registry, catalog, lineage, QA, SLAs) not the ETL team; federated governance. The central-warehouse / sync-API / batch-lake alternatives are graded four ways, each failing a specific mesh principle. Scenario also lands in the Learn quiz

## 1.21.3 — 2026-09-03
- 🌪️ Chaos: the **Recover all** button now previews what it will heal before you click — a live line naming the active fault types, the components hit, and the metrics it restores (success rate, severed links, traffic inflation, p99, availability) — plus a hover tooltip

## 1.21.2 — 2026-09-03
- 🔊 Listen: voices limited to US English (en-US) — the picker collapses to a single flat list; a previously saved voice in another language falls back to the best US English voice, and a device with no US English voice still speaks rather than going silent

## 1.21.0 — 2026-09-02
- 🚨 **Incident Mode** (Chaos tab): six customer-voiced incidents on real designs with real injected faults — enterprise-bank p99 spike (retries amplifying a slow issuer), UPI duplicate debits (idempotency held; partner leg reversed), one-tenant-empty-answers (ingestion, not retrieval), dinner-rush consumer lag, OOMKilled-with-node-memory-free, and the expired-intermediate TLS asymmetry. Investigate the live sim, commit to a diagnosis from a lineup, get the fix, the RCA skeleton, and the same truth in **four voices** — engineer, EM, CTO, customer executive
- 🤝 Mastery gains its 18th area: **FDE & Customer Engineering** — discovery before design, the six doors into an enterprise, the works-on-my-machine debug ladder (DNS→route→port→TLS→auth→app), POC vs production, one-problem-four-rooms, and the deployment runbook as exit criteria
- ☸️ **Kubernetes view** in the Code tab: Deployments/Services/HPA with the resource philosophy stated — requests the scheduler reserves, limits the kernel enforces

## 1.20.0 — 2026-09-02
- 📊 Mastery gains its 17th area: **Analytics & Data Platform** — OLTP vs OLAP (rows for transactions, columns for questions), ETL vs ELT and pipelines that rerun, facts/dimensions/SCD2 (a customer moves cities; last year's orders stay put), one-metric-one-definition, A/B testing as a system (deterministic assignment, exposure at the decision point, SRM as the canary). New 📊 Data Analyst track with an honest link-out; +3 acronyms: ELT, SCD, BI

## 1.19.0 — 2026-09-02
- 🧪 Mastery gains its 16th area: **Testing & Quality** — the pyramid for distributed systems (the payments-microservices scenario graded four ways: the flake factory, green-but-drifting mocks, shift-left with contracts + ephemeral envs + canaries as **the answer**, customers-as-test-suite), consumer-driven contracts (Pact, can-i-deploy), test doubles and the lies they tell, ephemeral environments vs shared staging, flakiness as a reliability bug with a budget. Scenario also lands in the Learn quiz; Backend, DevOps, AI Data Scientist and Full-Stack tracks now include the area

## 1.18.0 — 2026-09-02
- 🗺️ **Tracks**: six roadmap.sh paths (Backend, DevOps, AI & Data Scientist, Network Engineer, Full Stack, AI Product Builder) mapped onto the studio as ordered stages with capstone designs — progress is your own mastery boxes, reorganized; honest link-outs for the halves that live outside a systems studio
- 🌐 Mastery gains its 15th area: **Networking** — DNS as TTL choreography, TCP vs UDP and why QUIC exists, the TLS handshake tax, HTTP/1.1 vs 2 vs 3, and OS limits (file descriptors, ephemeral ports, TIME_WAIT) · 🚀 Deploy & Migrate gains **Kubernetes requests & limits** (the OOM at 60% free) — 63 concepts, 48 tables

## 1.17.0 — 2026-09-01
- 🎯 **JD Planner** (in Mastery): paste any job description and get a deterministic practice plan — skill areas matched to designs and drills with one-click links, honest coverage %, seniority parsed, the acronyms to know cold. Nothing leaves the browser
- 🤖 **SaaS AI Copilot (Multi-tenant RAG)** — the 100th template: tenant isolation as a retrieval invariant (filter at the DB, canary documents), per-tenant token metering and semantic cache, versioned ingestion with deletion reaching the index, the embedding model as a schema; wall: the model is shared, the promises are not
- 🎓 LLM-prod drills +3: vector DB choice (Pinecone/Qdrant/Weaviate/Chroma/FAISS/pgvector), multi-tenant RAG isolation, LangChain vs LangGraph vs LlamaIndex vs no framework · 🔤 +3: FAISS, MLOps, SaaS

## 1.16.0 — 2026-09-01
- 🏛️ **Six pillars**, stated in About and built where they were missing: **Data Integrity** — every design entering from outside (share link, Mermaid, JSON) is validated: dangling edges dropped, unknown types coerced, duplicates renamed, every repair reported; **Built to Endure** — a golden share link from 1.x is pinned to decode forever, the codec version is a superset contract; **AI Ready** — a documented, versioned ArchSim JSON view in the Code tab, importable back (the import box now sniffs Mermaid vs JSON)

## 1.15.0 — 2026-09-01
- 🚀 Mastery gains its 14th area: **Deploy & Migrate** — blue-green vs canary vs rolling, zero-downtime schema migration (expand → migrate → contract) with the four cutover options graded in a table, feature flags (deploy is not release), backfills that do not take the primary down, dual-write vs CDC. The blue-green/JSON-column scenario is also a Learn quiz question

## 1.14.2 — 2026-08-31
- Guide/Tour: Chaos step names the 🔁 Retry Storm and its ledger demo; Capacity step names the ledger money controls

## 1.14.1 — 2026-08-31
- 🧭 Guide/Tour updated: two new steps (HLD/LLD computed live; diagrams-as-code in and out), refreshed copy for templates (Bharat first), Mastery (🎤 as-asked, 🚩 flags), ⌘K (header button, categories) and Acronyms (100+)

## 1.14.0 — 2026-08-31
- 🧩 **Diagrams-as-code interop**: export any design as **Mermaid** (READMEs on GitHub/Notion/Obsidian render it; async edges dashed; round-trips losslessly) or as an **Excalidraw** file (the interview whiteboard, pre-drawn); **import any Mermaid flowchart** — component types inferred from names (postgres→sql, redis→cache, kafka, load balancer, users…) — and it becomes a live simulation

## 1.13.1 — 2026-08-31
- About opens with "What this is" — the pitch first, the caveats after

## 1.13.0 — 2026-08-31
- ⌘ **Command palette in the header**: a ⌘ button beside Guide/Tour opens it for mouse users; the palette gains **categories** — ✦ All · 📦 Templates · 🧭 Tabs · 🎓 Practice chips that filter, grouped results with section headers, and template rows carrying their group (Bharat · fintech…) as a sub-label

## 1.12.3 — 2026-08-31
- About: sections trimmed to the studio essentials

## 1.12.1 — 2026-08-29
- 🇮🇳 **Bharat first, everywhere**: group labels renamed (Bharat · fintech, Bharat · consumer, Unicorns · Bharat), Bharat groups lead the template picker before anything else, the onboarding wizard opens with UPI and Zomato — and the suite pins the ordering so it can never quietly regress

## 1.12.0 — 2026-08-29
- 🕉️ **Ayurveda Gyaan (Charak Samhita)** — the inversion template: the corpus is eternal, the interpretation is layered. Canonical shloka addressing (sthana.chapter.verse) with a no-UPDATE canon, versioned overlays for commentary and translation, edition concordance so citations never silently lie, citation-forced RAG where "the text does not address this" is an honorable first-class answer, NAMASTE ↔ ICD-11 TM2 dual coding, formulation provenance on the ledger (its third vertical), and a wall for the ages: **authority does not shard — sampradaya queues behind scholars, not GPUs**
- 🔤 +4: AYUSH, ABDM, NAMASTE, TM2 · Ask-AI: prakriti, shloka addressing

## 1.11.0 — 2026-08-29
- 🏛️ **HLD tab rebuilt around live computation**: 🧭 Request Anatomy (traffic-weighted primary path, per-hop p50/p99 at current utilization, user-felt budget, async boundary marked), 🧮 Capacity Worksheet (per-tier headroom, the interview number), failure modes **derived from this graph** (real SPOFs listed by name) — the template-invariant filler is gone
- 🧱 **LLD tab rebuilt around authored + honest-derived**: the six flagship schema/flow/state entries now render in-tab with **live latencies on every sequence step**, authored API contracts pulled verbatim, per-type engineering notes that cite this design's own utilization, physics-matched testing section

## 1.10.3 — 2026-08-29
- 🎨 Playful pass: every tab wears an icon (📊 Capacity · 🌪️ Chaos · 💹 ROI · 🎓 Mastery · 🎙️ Interview…), 🧭 Guide/Tour, picker groups get flags-and-unicorns (🇮🇳 💳 🦄 🦅 🤖), palette groups iconed, DDIA verdicts badge themselves ✅/⚠️ via CSS, advisor findings flare 🔥/💡 by severity

## 1.10.2 — 2026-08-29
- 🔗 Entry deep-links: `?tpl=<name>&tab=<id>` opens the studio exactly where a pitch begins (a CFO on ROI, a student on Mastery), wizard suppressed — built for the outreach kit

## 1.10.1 — 2026-08-29

## 1.10.0 — 2026-08-29
- 🏥 **Telemedicine (Practo)** — healthcare enters the library with its defining inversion: reads are the sensitive operation (consent-gated, audit-on-read committed WITH the read), media-record separation (the note is the record, not the recording), e-prescriptions on the append-only ledger, break-the-glass as a designed and paged door; wall: regulation sets the floor forever — health data never cools
- 🔤 +5: EHR, PHI, HIPAA, DPDP, FHIR

## 1.9.1 — 2026-08-29
- 🎤 Every Mastery concept now carries its "as asked" line — the concept wearing its interview costume ("one celebrity just broke shard 7 — now what?"), 39 authored phrasings, suite-required

## 1.9.0 — 2026-08-29
- 🤖 Mastery gains its 13th area: **LLM Systems in Production** — the ten interview questions that test operating, not knowing (retrieval-vs-generation isolation, grounded hallucination, loop guards, cost-spike attribution, 1-GPU/1000-request design, RAG-vs-FT-vs-neither, evals without a gold answer, tool-selection debugging, injection defense, the hallucination-latency-cost triangle). Every drill answers in the required shape — diagnose → intervene → **prove** — and the suite enforces that a proof lives in every playbook table
- Ask-AI: lost-in-the-middle, LLM-as-judge, semantic cache

## 1.8.0 — 2026-08-29
- 🔁 New chaos fault: **Retry Storm** — duplicate delivery as real simulator physics (`dup` inflates demand at the target and cascades downstream)
- 📒 Money-movement controls on every ledger: **Idempotency** on/off and **Commit mode** (fsync-each vs batched) with live verdicts — a storm on an idempotency-off ledger shows phantom entries per second; batched commits price their loss window in entries at current traffic
- 🇮🇳 **UPI Switch (NPCI)** template — the switch's seat: debit/credit legs, the DEEMED state and reversal choreography, per-bank breakers, net settlement; wall: the slowest bank is the product ceiling

## 1.7.0 — 2026-08-29
- 💳 Fintech core: 📒 Ledger (Double-Entry) component — append-only, fsync-bound on purpose — plus two authored templates: **Card Payments (Auth + Settlement)** (auth is a promise in 150ms, settlement is money moving in T+1 netted batches, reconciliation as the immune system) and **Fraud Detection (Real-time)** (scoring inside a 50ms latency loan, model-plus-rules veto, chargeback labels weeks late, adversarial by nature)
- 🔤 Fintech acronym set: UPI, NPCI, IMPS, PCI DSS, PAN, KYC, AML, ISO 8583, T+1, DeFi — plus Ask-AI answers for settlement, double-entry, and tokenization

## 1.6.1 — 2026-08-29
- 🧮 Mastery grows its 12th area: Back-of-Envelope Math — the latency ladder, throughput rules of thumb quoted from this catalog (suite-enforced against drift), DAU→rps conversion anchors, and the nines as downtime minutes
- 🚩 One red-flag line per area: the classic way candidates fail it, named

## 1.6.0 — 2026-08-29
- 🎓 Mastery tab: the 80/20 interview curriculum — 11 areas, 35 tracked concepts, 20 inline ⇄ Compare tables, shuffled review, hide-mastered filter, ▶ Practice wired to live controls
- Live DDIA-style controls: cache **Write policy** (through/back/around with the loss-window warning) and LB **Balancing** (round-robin / least-connections / consistent-hash with per-tier resize math)
- 🚀 Future-ready: itemized Improve suggestions (front door, wired observability, SPOF elimination, guardrails on every AI tier, capacity headroom, 99.9% availability) — each gate one convergent click, proven across all 94 templates
- LLM Full-Stack additions: `fastapi` and `llmworker` components; **LLM API Platform (FastAPI)** and **Agentic Workflow (Tools)** templates with full breakdowns, scaling walls, and ROI
- Production polish: CI verification on every push, shareable design links, ⌘K command palette, OpenGraph cards, SIMULATOR.md
- Fixes: internals-modal scroll bleed (opaque sticky header), SLO door-fix edge-shape bug

## 1.5.0
- SLO tab: targets, error budgets, burn rate, production-readiness review with six gates and convergent ⚡ Quick fixes
- 💹 ROI tab: $/million-request economics, 30+ authored revenue models, board/CFO/CTO executive framings
- 🔤 Acronyms tab: 94 entries, searchable, categorized
- Trust layer: provenance on every component (benchmark/vendor/modeled with https-allowlisted references), ±40% honesty band, "how honest are the numbers" section

## 1.4.0
- Chaos coaching: every injected fault names its victim and hints the fix
- Cloud business templates (Object Storage, Serverless, CDN Edge), Astrotalk, and the Tinder template retired
- Visitor counter revived on a resilient dual-provider fetch

## 1.3.0
- Monetization lifecycle: license keys, pricing, anti-fraud throttles — currently in open-access mode
- Encrypted admin dashboard (PBKDF2 + AES-GCM, in-browser decryptor)

## 1.2.0
- DDIA inspectors: replication modes, quorum tuning with live verdicts, partitioning schemes, isolation levels
- Interview mode, Learn deck, seniority bars on every breakdown

## 1.1.0
- 90+ templates with authored breakdowns and scaling playbooks
- Capacity simulation, chaos engineering, multi-cloud pricing

## 1.0.0
- The canvas, the catalog, the simulator
