# Launch posts — ready to paste

Three versions, tuned per platform. The rule everywhere: no hype words,
lead with the thing that is genuinely different (the diagram runs), and
ask for critique, not applause. Engineers reward honesty and punish marketing.

---

## Reddit — r/ExperiencedDevs or r/softwarearchitecture

**Title:**
I built a system design studio where the diagram actually runs — push traffic
through it, break it on purpose, and it generates the code. Free, no signup.
Tear it apart.

**Body:**

I got tired of system design prep being "draw boxes, say the magic words."
A diagram can't be wrong, which is why diagrams teach nothing.

So I built ArchSim. You place components, wire them, set a traffic level —
and every box becomes a thing with capacity, latency and an availability
figure. Push 100k rps through it and you get p50/p95/p99, per-tier
utilization, dropped requests and a monthly bill that moves as you edit.

Things it does that I haven't seen elsewhere:

- 28 named chaos faults (AZ loss, cache stampede, retry storm, expired TLS)
  compiled into real capacity/latency effects, each with a one-click fix
- Cost wired to simulated traffic — the URL shortener costs $13.7k/mo at
  1k rps and $1.33M at 100k, because CDN egress dominates, and it shows you
- A "🧭 Explain" button that walks the request path hop by hop (with voice)
- Generated code that follows the diagram: docker-compose, Terraform,
  OpenAPI, and full Express services — splice a cache in via the advisor
  and the data layer switches to cache-aside in front of you
- 78 templates with scaling playbooks, including Zerodha, Dream11, Zepto,
  Discord, Plaid, Ramp — each with the wall you can't scale away
- Traffic slider goes to 100M rps so you can watch exactly which tier dies

Runs entirely in the browser. No account, no backend, nothing leaves the page.

Link: https://abhaybhuvagithub.github.io/ArchSim-System-Design-Studio/

What I want from you: the first thing that felt wrong, confusing, or
dishonest about the model. File it here or as a GitHub issue — I ship fixes
same-day.

---

## LinkedIn

I scanned 342 Indian AI engineering JDs. RAG appears in 89% of them.
So I built the RAG architecture into a simulator where you can actually
run it.

ArchSim is a system design studio where the diagram executes: components
have real capacity, latency and cost, chaos faults break them the way
production does, and the design generates its own code — compose files,
Terraform, working Express services with cache-aside and dead-letter
queues where the diagram says they belong.

It now includes a job-ready AI Engineering track: ten lesson steps, one per
most-demanded skill (RAG, LangChain, vector DBs, LangGraph, LoRA,
observability), each grading itself against the architecture you build.

Free, in the browser, no signup: [link]

Built with Claude. Feedback — especially the harsh kind — genuinely wanted.

#SystemDesign #AIEngineering #SoftwareArchitecture

---

## Show HN

**Title:** Show HN: ArchSim – a system design studio where the diagram
actually runs

**Text:**

Diagramming tools happily render a single load balancer in front of forty
services. ArchSim turns it red at 100% utilization, drops traffic, and the
p99 goes with it — the feedback is the point.

Everything derives from the live canvas: an M/M/1-flavoured queueing model
for latency, availability multiplied across the path, per-request pricing
driven by simulated flow, 28 chaos faults with mitigations, and code
generation (compose/Terraform/OpenAPI/Express services) that re-derives on
every edit, so applying an advisor fix visibly rewrites the data layer.

All client-side, no accounts, MIT-adjacent hobby project. The model is
order-of-magnitude by design — it exists to make trade-offs visible, not to
size a purchase order, and the About page says so.

I'd value critique of the queueing model and the cost figures most.
