# ArchSim — System Design Studio

An interactive system design canvas that goes beyond drawing: it **simulates** your architecture.

**Live demo:** https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

## Features

- **☁ Multi-cloud service map** — all 64 building blocks are mapped to their managed equivalent on **AWS, Google Cloud, Azure and Oracle Cloud**. Pick a cloud in the toolbar and the diagram relabels itself with concrete services (Load Balancer → *ALB / NLB*, NoSQL DB → *Cosmos DB*, LLM Inference → *Vertex AI (Gemini)*, SIEM → *Microsoft Sentinel*), the palette shows the service under each component, the inspector lists all four side by side, and the **cost estimate reprices** with that cloud's rough list-price factor — the same design comes out at $160k/mo on AWS, $152k on GCP, $163k on Azure and $115k on OCI. There's also a searchable full reference table under Learn → Clouds.
- **Component search** — filter the palette by component name, description or cloud service name (search "Bedrock" and you get the LLM and embedding blocks).
- **💵 Live cost estimate** — every component is priced on three levers: hourly rate per replica, monthly base (licence / managed fee / baseline storage), and cost per million requests. Because the per-request part is driven by the traffic the *simulation* routes through each node, the number moves the instant you drag the traffic slider or change a replica count. The Cost tab shows total $/month and $/hour, cost per million requests, the fixed-vs-usage split, a breakdown by area, and ranked line items (click one for its pricing assumption). Cost also appears per node in the inspector and on hover.
  - It tells you things a diagram can't: the Bitly design costs **$13.7k/mo at 1k rps but $1.33M/mo at 100k rps** because CDN egress dominates; the RAG assistant costs **$57 per million requests** — 10× anything else — because LLM generation is the whole bill; a mainframe line item alone is $12k/mo, which is why the advisor tells you to queue in front of it.
  - The advisor now also flags **over-provisioning**: a tier running 20× replicas at 3% utilization becomes "Scale API down to 2× — saves $1.3k/mo", with a one-click fix.
- **⧉ Arrange** — one-click auto-layout. Layered left-to-right (topological longest-path layering), then barycentre sweeps plus adjacent-swap hill climbing to minimise crossing lines, with each column vertically centred. It seeds from your current vertical order so the result still resembles what you drew, is stable when applied twice, and across the 25 built-in templates it produces **fewer crossings than the hand-drawn layouts** with no overlapping nodes.
- **🎓 Learn — a tutorial that grades your canvas.** Four sections in the side panel:
  - **Steps** — a 13-step design walkthrough (requirements → capacity math → edge tier → stateless compute → datastore → cache → async → simulate → remove bottlenecks → chaos → observability → hardening → narrate the flow). Each step explains *why* and **checks itself against your live diagram**, so the progress bar fills as you actually build rather than as you click "next".
  - **Compare** — 14 "difference between" tables for the trade-offs you get asked to justify: SQL vs NoSQL, queue vs event stream, cache-aside vs write-through, horizontal vs vertical scaling, strong vs eventual consistency, lake vs warehouse, ETL vs ELT, monolith vs microservices, orchestration vs choreography, L4 vs L7, REST/GraphQL vs gRPC, replication vs backup, metrics vs logs vs traces, latency vs throughput.
  - **Quiz** — 14 interview questions with instant right/wrong marking and an explanation for every answer (capacity math, queueing under load, CAP, idempotency, availability multiplication, geo indexes, fan-out, outbox, RAG bottlenecks, alerting practice).
  - **Numbers** — the cheat sheet: latency numbers, rough per-instance capacity, estimation shortcuts (1M/day ≈ 12 rps), and storage sizing.
- **Blank canvas or a starter scaffold** — begin from nothing, from a 3-tier skeleton, or from any template. The picker is grouped by category.
- **Light and dark mode** — Apple’s palette — #f5f5f7 grey and #1d1d1f near-black with the system blue, SF Pro type and pill controls — plus a fluorescent neon-green mode. One-click switch, remembered between visits, honoured by PNG export.
- **①②③ Steps** — number the connections in request order for a walkthrough-style diagram, and click any connection to label it ("cache miss", "write", "async").
- **64-component canvas editor** across 10 palette groups — drag components onto an infinite pan/zoom canvas and wire them with directed edges:
  - *Traffic:* client, DNS, global traffic manager (GSLB), WAF/DDoS, CDN, edge functions, load balancer, API gateway, GraphQL federation, rate limiter, BFF, tenant router
  - *Compute:* web, app, microservice, WebSocket, worker pool, scheduler, container platform (Kubernetes)
  - *Storage:* cache, SQL, NoSQL, search, object storage, backup & archive
  - *Async:* queue, event stream (Kafka), enterprise MQ, integration bus (ESB), saga orchestrator
  - *Data:* CDC, ETL/ELT, data lake, data warehouse, BI, analytics
  - *AI/ML:* ML service, embedding service, vector DB, LLM inference, guardrails
  - *Observability:* OTel collector, metrics & alerts, log pipeline, tracing, SLO/error budget, on-call paging, synthetic probes, RUM/client APM
  - *Security:* identity provider (SSO), secrets/KMS, tokenization vault, audit log, SIEM
  - *Enterprise:* ERP (SAP), CRM (Salesforce), mainframe core, managed file transfer/EDI, metering & billing, CI/CD
  - *Platform:* service registry, service mesh, config server, coordination (ZooKeeper/etcd)
- **✨ Improve — architecture advisor** — reviews your diagram against the current traffic and lists findings by severity. **Every finding has a ⚡ Quick fix** that edits the graph for you, and **Quick fix all** applies them in one go:
  - load balancer spliced onto a client→service link; cache spliced between a service and its database; queue in front of a synchronously-called worker; rate limiter ahead of the gateway
  - replicas scaled on tiers past 70% utilization; single-instance databases replicated (vendor cores like SAP or a mainframe are never "just scaled out" — they get shielded behind enterprise MQ instead)
  - service discovery, tracing and monitoring attached to the busiest components
  - **observability gaps:** alerts with no on-call route, metrics with no logs, no OTel collector funnelling telemetry, no SLO/error budget, no synthetic probing from outside the network
  - **enterprise hardening:** no WAF at the edge, no central identity provider behind the gateway, databases with no backup (replicas aren't backups), credentials not in a secrets store, no audit trail, security logs with no SIEM
  - a full data platform (CDC → lake → ELT → warehouse → BI) chained off your event stream, and BI repointed at the warehouse when it reads production directly
  - **auto-wiring:** unwired nodes and dead-end routing components are connected to the most plausible peer, chosen by component type and proximity — and if no suitable peer exists yet, the quick fix creates one (an orphaned SQL database gets an App Server in front, a dead-end queue gets a Worker Pool after it)
- **Hover to inspect** — hovering a node glows it, highlights its connected edges, dims everything else, and shows a detail card with capacity, base latency and live utilization.
- **Live traffic simulation** — set traffic (100 rps → 1M rps) and watch requests flow. Per-node utilization bars, queueing latency (M/M/1-style), drops when over capacity, p50/p99 estimates, success rate and system availability.
- **Chaos monkey** — randomly kills instances while simulating; they auto-recover in 6 s. See whether your redundancy actually holds.
- **Capacity report** — live bottleneck detection with the replica count each tier actually needs at current traffic.
- **Template library — 34 pre-wired designs**, each with its own requirements checklist:
  - *Product designs:* Bitly, Ticketmaster, Uber, YouTube, WhatsApp, Web Crawler, Google Docs, Twitter feed, Dropbox, Rate Limiter, Yelp, Leaderboard, Notifications, Payments, Autocomplete.
  - *Microservice architecture patterns:* E-commerce with Saga / database-per-service, CQRS + Event Sourcing, BFF + service-mesh platform, event-driven choreography with DLQ, and Strangler-fig monolith migration with CDC.
  - *Data platform:* medallion lakehouse — CDC + stream ingest → raw data lake → ELT → curated lake → data warehouse → BI and ML, with an orchestrator owning the DAGs.
  - *India · consumer:* **Rapido** (captain allocation, H3 geo index, OTP ride start, surge), **Zomato** (discovery vs ordering split, menu caching, rider assignment, ETA), **Swiggy + Instamart** (per-dark-store inventory reservation, 10-minute dispatch, order batching).
  - *India · fintech:* **Razorpay** (idempotency, double-entry ledger, outbox, smart routing across acquirers, webhooks, T+1 settlement), **BHIM/UPI** (HSM-bound UPI PIN, VPA directory, NPCI switch and bank legs, RRN idempotency), **Google Pay UPI** (multi-PSP bank routing on live health, inline fraud scoring, tokenization, rewards off the payment path).
  - *Travel & booking:* **Booking.com** (1000:1 search-to-book, supplier availability cache, no-oversell booking saga), **Goibibo** (GDS fan-out with hard timeouts, short-TTL fare cache, price-change-on-booking, goCash split tender), **IndiGo** (PSS mainframe core behind enterprise MQ, seat maps, check-in thundering herd, fare-scraping bots).
  - *Enterprise:* zero-trust regulated multi-tenant platform — GSLB → WAF → gateway + SSO → tenant router → services on Kubernetes, with secrets/KMS, tokenization, audit log, backups, and enterprise MQ + ESB fronting a mainframe core and SAP.
  - *Observability:* golden-signals stack — services, gateway and Kubernetes → OTel collector → metrics / logs / traces → SLO burn-rate and SIEM → on-call paging, plus synthetic probes and RUM.
  - *AI / ML:* GenAI RAG assistant (embedder, vector DB, semantic cache, LLM inference, in/out guardrails, eval traces) and a two-stage recommendation ranker (candidate generation → feature store → ranker, with a feedback loop and model registry).
- **Interview timer** — 35-minute countdown, turns red in the last 5 minutes.
- **Export** — PNG snapshot, JSON save/load.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
```

Deployed automatically to GitHub Pages on every push to `main` via GitHub Actions.
