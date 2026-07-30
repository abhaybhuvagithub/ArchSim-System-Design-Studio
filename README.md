# ArchSim — System Design Studio

An interactive system design canvas that goes beyond drawing: it **simulates** your architecture.

**Live demo:** https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

## Features

- **29-component canvas editor** — drag components (LBs, caches, queues, DBs, workers, BFFs, service mesh, saga orchestrators…) onto an infinite pan/zoom canvas and wire them with directed edges.
- **Hover to inspect** — hovering a node glows it, highlights its connected edges, dims everything else, and shows a detail card with capacity, base latency and live utilization.
- **Live traffic simulation** — set traffic (100 rps → 1M rps) and watch requests flow. Per-node utilization bars, queueing latency (M/M/1-style), drops when over capacity, p50/p99 estimates, success rate and system availability.
- **Chaos monkey** — randomly kills instances while simulating; they auto-recover in 6 s. See whether your redundancy actually holds.
- **Capacity report** — live bottleneck detection with the replica count each tier actually needs at current traffic.
- **Template library — 20 pre-wired designs**, each with its own requirements checklist:
  - *Product designs:* Bitly, Ticketmaster, Uber, YouTube, WhatsApp, Web Crawler, Google Docs, Twitter feed, Dropbox, Rate Limiter, Yelp, Leaderboard, Notifications, Payments, Autocomplete.
  - *Microservice architecture patterns:* E-commerce with Saga / database-per-service, CQRS + Event Sourcing, BFF + service-mesh platform, event-driven choreography with DLQ, and Strangler-fig monolith migration with CDC.
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
