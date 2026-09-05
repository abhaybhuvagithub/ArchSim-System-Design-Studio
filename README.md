# ArchSim — System Design Studio

[![verify](https://github.com/abhaybhuvagithub/ArchSim-System-Design-Studio/actions/workflows/verify.yml/badge.svg)](https://github.com/abhaybhuvagithub/ArchSim-System-Design-Studio/actions/workflows/verify.yml)

**Draw it. Simulate it. Break it. Defend it.**

**Live:** https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

ArchSim is an interactive studio for system design — the skill interviews grade and production punishes. You draw an architecture (or load one of **107 templates**, from URL shorteners to WhatsApp to an LLM API platform), and the studio simulates it live: capacity per tier, utilization, latency with honest tails, composed availability. Then you break it with chaos, judge it against SLOs, price it, and practice defending it.

## The tour

**Build & simulate** — a drag-and-drop canvas over **116 components** with real capacity math. Traffic slider to 100M rps. Every number carries provenance: benchmark, vendor doc, or modeled — with references, and a stated ±40% honesty band.

**Break & judge** — chaos engineering (kill nodes, degrade tiers, watch the blast radius), an **SLO tab** with error budgets, burn rates, and a production-readiness review whose failing gates each carry a one-click convergent fix. **⚡ Quick fixes** iterate against the real simulator until their gate passes — and say exactly what they'll do before you click.

**Learn & practice** — per-template **breakdowns** (requirements → API → deep dives → what each seniority bar sounds like), **scaling playbooks** (the ladder from 1K to 50M+ users, and the wall at the end), a **🎓 Mastery tab** covering the 80/20 interview curriculum with inline comparison tables and exercises wired to live controls, DDIA-style inspectors (replication, quorums, partitioning, cache write policies, balancing algorithms), an acronym glossary, and an interview mode that grades you.

**The business floor** — an **ROI tab** that prices designs per million requests with authored revenue models (a payments stack and a CDN have very different economics), cost breakdowns per cloud, and executive framings: one sentence for the board, a P&L for the CFO, risk for the CTO.

## Honest numbers, enforced

Every claim in the studio is held by a **971-check verification suite** that builds the real bundle, mounts it in a real DOM, and drives every tab, control, and contract — the same suite that gates every push (see the badge above). Capacity figures cite their sources; dead reference links fail the build; the simulator's math is documented in [SIMULATOR.md](./SIMULATOR.md).

## Run it locally

```bash
npm install
npm run dev        # local studio
npm run build      # production bundle
node scripts/verify.mjs   # the full 971-check suite against the built bundle
```

## Docs

- [SIMULATOR.md](./SIMULATOR.md) — how the capacity, latency, and availability math actually works
- [CHANGELOG.md](./CHANGELOG.md) — what shipped, in order

## Related

**[archsim-gate](https://github.com/abhaybhuvagithub/archsim-gate)** — the CI half of this thesis: fail the PR when the architecture can not keep its promises. Same physics, pointed at your Terraform plan, with the cheapest priced repair in the comment.

