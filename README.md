# ArchSim — System Design Studio

An interactive system design canvas that goes beyond drawing: it **simulates** your architecture.

**Live demo:** https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

A visitor count is shown in the toolbar. It counts one visit per browser session via a free public counter service and caches the last known value; if no counter service is reachable the chip is simply hidden rather than showing an invented number.

## Features

> **Where this is now.** 60 worked designs, 94 components, and **748 automated checks** that run on every push. The tool no longer models only capacity — it models correctness, distance, identity and cost, and it says when it does not know something.

### Beyond capacity

- **Correctness is simulated, not annotated.** Every datastore carries a replication mode, a quorum, an isolation level and a partitioning strategy, and those feed the simulation. Choosing linearizable costs you throughput and latency on the canvas because that is what it costs in production. Isolation levels are shown by what they still *permit* — snapshot names the write-skew trap outright, because that is the double-booking bug in Ticketmaster.
- **Reads and writes are separate.** Every connection carries a read/write mix and stores have separate ceilings for each. It is the only way to show the most under-appreciated fact about single-leader replication: followers raise the read ceiling and do nothing at all for writes. A 3-replica store at 12k rps sits at 160% on a 50/50 workload and 96% at 90% reads.
- **Storage engines have consequences.** B-tree, LSM, in-memory and column, each with its write amplification and tail behaviour, feeding the same simulation.
- **Distance is modelled.** Place components in real cloud regions and every cross-region link is labelled with its round-trip floor — the speed of light in fibre, before any service does work. Mumbai to Virginia is about 180ms, and no amount of caching changes that.
- **Identity and entitlement.** Entry points carry an authentication method, sessions carry a revocation story, services say where entitlement comes from. The advisor flags a licence lookup on the hot path, a privileged route behind a single factor, and tokens you have no way to withdraw.
- **Flow filter** — view the canvas as All, Read, Write or Async. "Show me only the write path" is the question a diagram is worst at answering.

### Practice

- **Mock interview** — five stages on the loaded design, scored per stage against what the breakdown says a good answer contains, with the specific things you did not say and what the next level up expects. Answer by voice or by typing. Driven by a rubric that works offline and free, or by **Claude and eight other providers** with your own API key.
- **The thirty questions** under Learn → Questions, each answered here and most naming a design you can load, run and break.
- **Guided tour** — 18 steps with a spotlight overlay, replayable from **? Guide**.

### Honest numbers

- **Prices are dated and sourced.** Every cost shows the month it was priced and links the provider pricing pages it was checked against. Four rates are verified exactly; the rest are estimates and say so. **The build fails once the rates are more than six months old** — a static file cannot track live prices, but it can refuse to pretend it is current.
- **Availability figures are per service.** Fifteen carry their provider's published SLA rather than one placeholder repeated across the catalogue.
- **748 checks**, including a discrete-event simulation core, and a guard that fails any run shorter than the expected floor — because a crash that silently deletes checks used to report a clean pass.


- **☁ Multi-cloud service map** — all 94 building blocks are mapped to their managed equivalent on **AWS, Google Cloud, Azure, Oracle Cloud and Apple**. Pick a cloud in the toolbar and the diagram relabels itself with concrete services (Load Balancer → *ALB / NLB*, NoSQL DB → *Cosmos DB*, LLM Inference → *Vertex AI (Gemini)*, SIEM → *Microsoft Sentinel*), the palette shows the service under each component, the inspector lists all four side by side, and the **cost estimate reprices** with that cloud's rough list-price factor — the same design comes out at $160k/mo on AWS, $152k on GCP, $163k on Azure and $115k on OCI. There's also a searchable full reference table under Learn → Clouds.
- **Component search** — filter the palette by component name, description or cloud service name (search "Bedrock" and you get the LLM and embedding blocks).
- **💵 Live cost estimate** — every component is priced on three levers: hourly rate per replica, monthly base (licence / managed fee / baseline storage), and cost per million requests. Because the per-request part is driven by the traffic the *simulation* routes through each node, the number moves the instant you drag the traffic slider or change a replica count. The Cost tab shows total $/month and $/hour, cost per million requests, the fixed-vs-usage split, a breakdown by area, and ranked line items (click one for its pricing assumption). Cost also appears per node in the inspector and on hover.
  - **Scaling controls in the cost panel:** **⇅ Right-size** re-sizes every tier to ~55% utilization at the current traffic and shows the projected saving before you click (Meta: 11 tiers, saves $30.9k/mo). It never drops a live tier below 2 instances, so it cannot introduce the single points of failure the advisor warns about, and it is idempotent. Plus **Scale down ½× / Scale up 2×** for the whole design and **− / +** replica steppers on every line item — all of which move the simulation, so p99 and success rate react along with the bill.
  - It tells you things a diagram can't: the Bitly design costs **$13.7k/mo at 1k rps but $1.33M/mo at 100k rps** because CDN egress dominates; the RAG assistant costs **$57 per million requests** — 10× anything else — because LLM generation is the whole bill; a mainframe line item alone is $12k/mo, which is why the advisor tells you to queue in front of it.
  - The advisor now also flags **over-provisioning**: a tier running 20× replicas at 3% utilization becomes "Scale API down to 2× — saves $1.3k/mo", with a one-click fix.
- **⧉ Arrange** — one-click auto-layout. Layered left-to-right (topological longest-path layering), then barycentre sweeps plus adjacent-swap hill climbing to minimise crossing lines, with each column vertically centred. It seeds from your current vertical order so the result still resembles what you drew, is stable when applied twice, and across the built-in templates it produces **fewer crossings than the hand-drawn layouts** with no overlapping nodes.
- **🎓 Learn — a tutorial that grades your canvas.** Four sections in the side panel:
  - **Steps** — a 13-step design walkthrough (requirements → capacity math → edge tier → stateless compute → datastore → cache → async → simulate → remove bottlenecks → chaos → observability → hardening → narrate the flow). Each step explains *why* and **checks itself against your live diagram**, so the progress bar fills as you actually build rather than as you click "next".
  - **Compare** — 14 "difference between" tables for the trade-offs you get asked to justify: SQL vs NoSQL, queue vs event stream, cache-aside vs write-through, horizontal vs vertical scaling, strong vs eventual consistency, lake vs warehouse, ETL vs ELT, monolith vs microservices, orchestration vs choreography, L4 vs L7, REST/GraphQL vs gRPC, replication vs backup, metrics vs logs vs traces, latency vs throughput.
  - **Quiz** — 14 interview questions with instant right/wrong marking and an explanation for every answer (capacity math, queueing under load, CAP, idempotency, availability multiplication, geo indexes, fan-out, outbox, RAG bottlenecks, alerting practice).
  - **Numbers** — the cheat sheet: latency numbers, rough per-instance capacity, estimation shortcuts (1M/day ≈ 12 rps), and storage sizing.
- **Blank canvas or a starter scaffold** — begin from nothing, from a 3-tier skeleton, or from any template. The picker is grouped by category.
- **Light and dark mode** — Apple’s palette: #f5f5f7 grey and #1d1d1f near-black with the system blue, SF Pro type and pill controls. One-click switch, remembered between visits, honoured by PNG export.
- **①②③ Steps** — number the connections in request order for a walkthrough-style diagram, and click any connection to label it ("cache miss", "write", "async").
- **76-component canvas editor** across 11 palette groups — drag components onto an infinite pan/zoom canvas and wire them with directed edges:
  - *Traffic:* client, DNS, global traffic manager (GSLB), WAF/DDoS, CDN, edge functions, load balancer, API gateway, GraphQL federation, rate limiter, BFF, tenant router
  - *Compute:* web, app, microservice, WebSocket, worker pool, scheduler, container platform (Kubernetes)
  - *Storage:* cache, SQL, NoSQL, search, object storage, backup & archive
  - *Async:* queue, event stream (Kafka), enterprise MQ, integration bus (ESB), saga orchestrator
  - *Data:* CDC, ETL/ELT, data lake, data warehouse, BI, analytics
  - *AI/ML:* ML service, embedding service, vector DB, LLM inference, guardrails
  - *Observability:* OTel collector, metrics & alerts, log pipeline, tracing, SLO/error budget, on-call paging, synthetic probes, RUM/client APM
  - *Security:* identity provider (SSO), secrets/KMS, tokenization vault, audit log, SIEM
  - *Enterprise:* ERP (SAP), CRM (Salesforce), mainframe core, managed file transfer/EDI, metering & billing, CI/CD
  - *Quality:* API test suite, UI test automation, contract testing, load & perf testing, service virtualization, test data management, quality gate (SAST), security testing (DAST), device/browser grid, test reporting
  - *Platform:* service registry, service mesh, config server, coordination (ZooKeeper/etcd)
- **✨ Improve — architecture advisor** — reviews your diagram against the current traffic and lists findings by severity. **Every finding has a ⚡ Quick fix** that edits the graph for you, and **Quick fix all** applies them in one go:
  - load balancer spliced onto a client→service link; cache spliced between a service and its database; queue in front of a synchronously-called worker; rate limiter ahead of the gateway
  - replicas scaled on tiers past 70% utilization; single-instance databases replicated (vendor cores like SAP or a mainframe are never "just scaled out" — they get shielded behind enterprise MQ instead)
  - service discovery, tracing and monitoring attached to the busiest components
  - **observability gaps:** alerts with no on-call route, metrics with no logs, no OTel collector funnelling telemetry, no SLO/error budget, no synthetic probing from outside the network
  - **enterprise hardening:** no WAF at the edge, no central identity provider behind the gateway, databases with no backup (replicas aren't backups), credentials not in a secrets store, no audit trail, security logs with no SIEM
  - a full data platform (CDC → lake → ELT → warehouse → BI) chained off your event stream, and BI repointed at the warehouse when it reads production directly
  - **quality gaps** (only once the design declares a CI/CD pipeline, so it stays quiet otherwise): a pipeline with no test stage at all, no quality gate that can fail the build, no load testing behind a design modelled at N rps, no contract testing across independently deployed services, a partner API that tests call for real instead of virtualizing, and test results with nowhere to be read.
  - **auto-wiring:** unwired nodes and dead-end routing components are connected to the most plausible peer, chosen by component type and proximity — and if no suitable peer exists yet, the quick fix creates one (an orphaned SQL database gets an App Server in front, a dead-end queue gets a Worker Pool after it)
- **Hover to inspect** — hovering a node glows it, highlights its connected edges, dims everything else, and shows a detail card with capacity, base latency and live utilization.
- **Live traffic simulation** — set traffic (100 rps → 1M rps) and watch requests flow. Per-node utilization bars, queueing latency (M/M/1-style), drops when over capacity, **p50 / p95 / p99** estimates, success rate and system availability. The tail spread is load-dependent rather than a fixed multiple: the same design shows a p99/p50 ratio of 2.4× when idle and 4.4× when busy, because a loaded system has a much longer tail at the same median.
- **🔔 Notifications** — toasts for the things worth knowing: a fault injected or recovered, a quick fix applied, a right-size and what it saved, a template loaded, a requirement adding components, the diagram auto-arranged. Plus **threshold alerts** while simulating — it tells you when the design starts dropping traffic or a tier crosses 90%, and again when it recovers.
- **Currency** — costs display in USD, INR, EUR, GBP, JPY, AUD, CAD, SGD or AED, remembered between visits. Indian formatting uses lakh and crore, so the Bitly design reads **₹1.4 Cr/mo** rather than an unreadable string of digits. Rates are static approximations over USD list prices, not a live FX feed.
- **Chaos engineering — 28 named faults** across four categories, each compiled into real simulator effects (capacity/latency/drop multipliers, severed links, traffic multiplier) and each auto-healing after a few seconds:
  - *Infrastructure:* availability zone, data centre, instance crash, instance slow (grey failure), disk failure, disk corruption, storage IOPS throttle, read-only file system, VM CPU saturation, host hardware
  - *Network:* network partition, cross-region loss, packet loss, high latency, bandwidth throttle, connection flap, load balancer degradation, blocked backend port, health-check flapping, expired TLS certificate, DNS resolution failure
  - *Application:* memory leak, out of memory, thread-pool exhaustion, deadlock, cache stampede (hit ratio → 0, full load on the origin), error storm with retry amplification
  - *Global:* traffic surge (5×)
  - **Mitigation hints in the capacity report:** while a fault is running, any tier it is actually degrading grows an inline hint naming the fault, explaining what to do about it, and a **⚡ quick fix** that does it — add capacity sized for the *degraded* throughput, restore a severed link, splice in a cache or rate limiter, or attach backup/synthetic probes. Every one of the 28 faults carries its own mitigation, e.g. *"CPU is saturated. Scale out — you cannot make a single instance faster."*
  - Node faults aim at the selected component, or at the busiest sensible one. Live panel shows blast radius, countdown per fault, and success rate / p99 / availability while it burns. Verified: all **952 fault×template combinations** measurably change the simulation and recover to the exact baseline.
- **Capacity report** — live bottleneck detection with the replica count each tier actually needs at current traffic.
- **Template library — 50 pre-wired designs**, each with its own requirements checklist:
  - *Product designs:* **News Feed (Instagram)** (hybrid fan-out, media transcode pipeline, ranking on the hot path), **Music Streaming (Spotify)** (per-market licensing on every play, immutable audio, royalty events that cannot be lost), **Distributed File Storage (Drive)** (content-hashed chunk dedup, inherited ACLs with cache invalidation, change-log sync), Bitly, Ticketmaster, Uber, YouTube, WhatsApp, Web Crawler, Google Docs, Twitter feed, Dropbox, Rate Limiter, Yelp, Leaderboard, Notifications, Payments, Autocomplete.
  - *Microservice architecture patterns:* E-commerce with Saga / database-per-service, CQRS + Event Sourcing, BFF + service-mesh platform, event-driven choreography with DLQ, and Strangler-fig monolith migration with CDC.
  - *Data platform:* medallion lakehouse — CDC + stream ingest → raw data lake → ELT → curated lake → data warehouse → BI and ML, with an orchestrator owning the DAGs.
  - *Quality & testing:* **Continuous Testing Platform** — PR and nightly triggers into a pipeline with a quality gate, unit/API, contract, UI and DAST stages, service virtualization, managed test data, ephemeral per-PR environments, a device/browser grid, load testing and test reporting.
  - *Robotics & edge:* **Simbe Tally** — an autonomous shelf-scanning robot fleet: on-robot NVIDIA inference, constrained store uplink, billions of write-once shelf images, embedding + ANN product recognition across millions of SKUs, retailer planogram/POS integration, and a task engine that turns detections into "restock aisle 7" for associates.
  - *Workplace & email:* **Slack** (WebSocket fleet, workspace tenancy, channel fan-out, permission-aware search), **Microsoft 365** (Entra ID + Graph API over Exchange/SharePoint/Teams, per-tenant throttling, DLP and eDiscovery), **Outlook** (untrusted SMTP ingest, adversarial filtering, calendar scheduling, retention), **Gmail** (threads-and-labels model, continuous spam retraining, search as primary navigation).
  - *Big tech:* **Meta** (TAO read-through graph cache over sharded MySQL, feed ranking, Haystack photo store), **Netflix** (Open Connect CDN inside ISPs, Zuul + Eureka, EVCache/Cassandra, encoding pipeline, degrade-don't-fail), **Yahoo** (portal + mail + search + ad serving behind one front door, hot-key budget pacing), **Disney+ Hotstar** (record live-cricket concurrency, multi-CDN steering, predictive autoscaling, graceful-degradation ladder, panic mode).
  - *India · consumer:* **Rapido** (captain allocation, H3 geo index, OTP ride start, surge), **Ola** (multi-category fleet allocation, EV range and charging-aware dispatch, in-app wallet with UPI fallback), **Zomato** (discovery vs ordering split, menu caching, rider assignment, ETA), **Swiggy + Instamart** (per-dark-store inventory reservation, 10-minute dispatch, order batching).
  - *India · fintech:* **Razorpay** (idempotency, double-entry ledger, outbox, smart routing across acquirers, webhooks, T+1 settlement), **NHAI FASTag tolling** (sub-second barrier decision from a locally cached hotlist, store-and-forward when the switch link drops, duplicate-read dedupe, ANPR fallback, NETC/issuer legs and daily reconciliation), **BHIM/UPI** (HSM-bound UPI PIN, VPA directory, NPCI switch and bank legs, RRN idempotency), **Google Pay UPI** (multi-PSP bank routing on live health, inline fraud scoring, tokenization, rewards off the payment path).
  - *Travel & booking:* **Booking.com** (1000:1 search-to-book, supplier availability cache, no-oversell booking saga), **Goibibo** (GDS fan-out with hard timeouts, short-TTL fare cache, price-change-on-booking, goCash split tender), **IndiGo** (PSS mainframe core behind enterprise MQ, seat maps, check-in thundering herd, fare-scraping bots).
  - *Enterprise:* zero-trust regulated multi-tenant platform — GSLB → WAF → gateway + SSO → tenant router → services on Kubernetes, with secrets/KMS, tokenization, audit log, backups, and enterprise MQ + ESB fronting a mainframe core and SAP.
  - *Observability:* golden-signals stack — services, gateway and Kubernetes → OTel collector → metrics / logs / traces → SLO burn-rate and SIEM → on-call paging, plus synthetic probes and RUM.
  - *AI / ML:* **Anthropic Claude** (API keys and org auth, token-based rate limits, input/output safety, prompt cache, model router, GPU scheduler and inference fleet, tool use/MCP, exact usage metering — $184 per million requests, all of it inference), GenAI RAG assistant (embedder, vector DB, semantic cache, LLM inference, in/out guardrails, eval traces) and a two-stage recommendation ranker (candidate generation → feature store → ranker, with a feedback loop and model registry).
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
