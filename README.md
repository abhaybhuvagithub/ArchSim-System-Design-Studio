# ArchSim — System Design Studio

An interactive system design canvas that goes beyond drawing: it **simulates** your architecture.

**Live demo:** https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

## Features

- **23-component canvas editor** — drag components (LBs, caches, queues, DBs, workers…) onto an infinite pan/zoom canvas and wire them with directed edges.
- **Live traffic simulation** — set traffic (100 rps → 1M rps) and watch requests flow. Per-node utilization bars, queueing latency (M/M/1-style), drops when over capacity, p50/p99 estimates, success rate and system availability.
- **Chaos monkey** — randomly kills instances while simulating; they auto-recover in 6 s. See whether your redundancy actually holds.
- **Capacity report** — live bottleneck detection with the replica count each tier actually needs at current traffic.
- **Template library** — 16 pre-wired classic interview designs (Bitly, Ticketmaster, Uber, YouTube, WhatsApp, Web Crawler, Google Docs, Twitter feed, Dropbox, Rate Limiter, Yelp, Leaderboard, Notifications, Payments, Autocomplete…), each with its own requirements checklist.
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
