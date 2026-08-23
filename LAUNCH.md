# Launch Kit

## The one-liner
**ArchSim runs your architecture instead of just drawing it.** Place components, push traffic through, watch p99 climb and the bill move — then generate the actual code.

## 60-second demo script (record this)
1. **(0-8s)** Open the studio → onboarding wizard → pick "AI / RAG system", 50k rps, GCP. Canvas loads, already labelled with real GCP services.
2. **(8-18s)** Hit **▶ Simulate**. Point at the utilization bars filling, the p99 chip, the live cost. Say: "every box has capacity, latency and a price."
3. **(18-30s)** Drag the traffic slider up until something turns red and starts dropping. "A diagram can't be wrong. This can."
4. **(30-42s)** Open **✨ Improve** → apply the cache suggestion with the **Code tab open** in the panel. The diagram gains a cache AND `server.js` visibly switches from direct queries to cache-aside. This is the money shot — nothing else in the category does it.
5. **(42-52s)** Hit **🧭 Explain** → two hops with the highlight following, then tap 🔈 so it narrates one hop aloud.
6. **(52-60s)** End on the Scale tab wall for Ramp: "two seconds to answer a card swipe — and the ceiling never moves." URL on screen.

## Reddit post (r/ExperiencedDevs, r/systemdesign, r/developersIndia)
**Title:** I built a system design simulator where the diagram can actually be wrong — and it generates the code

**Body:** Diagramming tools happily render one load balancer in front of forty services. I wanted the version that turns red, drops traffic, and shows the p99 going with it — so I built ArchSim.

You place components (each with real capacity, latency, availability and a price), wire them, and push traffic through. 78 pre-built designs including Indian and US unicorns (Zerodha's order path vs ticker fan-out, Ramp's 2-second card-auth deadline, Discord's mega-guild problem). 28 chaos faults. A guided walkthrough that narrates the request path hop by hop. And the part I'm most proud of: apply an "Improve" suggestion and the generated code — docker-compose, Terraform, an actual Express server with cache-aside — changes with the diagram, because it's derived from it.

Free, no account, runs entirely in your browser: [link]

It's a learning/interview tool, not a benchmark — the models are order-of-magnitude on purpose. Tear it apart; there's a feedback template in the repo and I ship fixes daily.

## LinkedIn post
Interview prep tools show you architectures. None of them let you break one.

I built ArchSim: draw a system, simulate real traffic through it, watch the p99 and the monthly bill react, inject failures, and — when you apply a fix — watch the generated code evolve with the diagram.

78 designs including the systems behind Zerodha, Dream11, CRED, Zepto, Discord, Plaid, Vercel and Ramp, each with a scaling playbook down to "the wall you cannot scale away."

Free, in-browser, no signup: [link]. Built for engineers preparing for design interviews and teams sketching real systems. Feedback very welcome.

## Where to post, in order
1. r/developersIndia (unicorn templates are the hook) — Tue/Wed morning IST
2. LinkedIn with the 60s video
3. r/ExperiencedDevs (lead with the "diagram can be wrong" thesis, be humble about model accuracy)
4. Hacker News "Show HN: ArchSim – a system design studio that simulates your diagram" — only after the first two rounds of feedback are fixed

## What to watch in week one
- Do people get past the wizard and press Simulate? (That's the aha.)
- Which tab do they open second? (Tells you what to deepen.)
- Mobile complaints (the known blind spot — fix fast, reply publicly.)
