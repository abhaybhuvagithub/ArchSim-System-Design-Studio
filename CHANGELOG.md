# Changelog

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
