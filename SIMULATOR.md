# How the simulator works

ArchSim's numbers come from a small, legible model — not a discrete-event
simulator, not a queueing-theory package, and not vibes. This page is the
whole model. Everything here corresponds line-for-line to `src/sim.js`, and
the verification suite drives the same code this document describes.

## Flow propagation

A design is a directed graph. Traffic enters at source nodes (clients) at the
slider's requests per second and propagates in topological order. At each
node with outgoing edges, **processed traffic splits evenly across them**.
Caches and CDNs are the exception: they forward only their **misses** —
`forwarded = processed × (1 − hitRatio)` — which is why killing a cache in
chaos mode sends the full stream crashing into whatever sat behind it.

## Capacity, reads, and writes

Each component type carries a per-replica capacity from the catalog (with a
provenance record: benchmark, vendor doc, or modeled). But reads and writes
have **separate ceilings**, combined by the read/write mix that actually
arrives at that node. This is what makes single-leader replication show its
true shape: adding followers raises the read ceiling and leaves the write
ceiling exactly where it was.

```
utilization = offered / capacity
```

A node processes `min(offered, capacity)`; the rest is dropped and reported.
System success rate is delivered traffic over offered traffic.

## Latency and the queueing knee

Per-node latency is the catalog's base latency inflated by an
**M/M/1-flavoured queueing factor**:

```
qFactor = 1 / (1 − utilization)     (capped at 20×, floor at util 0.95)
```

At 50% utilization work costs 2× its base; at 85% it costs ~6.7×; at 95%+
the cap holds it at 20×. That curve is the whole argument for capacity
headroom, and it's why the future-ready sizing pass targets ~70%.

End-to-end p50 is the **longest latency path** from any source through the
DAG — the serial chain is what the user feels, however wide the fan-out.

Tails widen with load, anchored to the busiest node in the system:

```
p95 = p50 × (1.5 + 0.8 × busiestUtil)
p99 = p50 × (2.4 + 2.6 × busiestUtil)
```

An idle system lands near the classic ~2.4× p99; a saturated one nears 5×.
This is a model of tail *behavior*, not a measurement — treat it as shape,
not gospel.

## Availability

Per node, replicas fail independently:

```
nodeAvail = 1 − (1 − availPerReplica) ^ replicas
```

One 99.9% box is three nines; two of them are six. System availability is
the **product across every node that carries traffic** — which is why a
single 99% component quietly caps an otherwise-gold design, and why the SLO
tab's structural gate exists.

## Chaos

Faults apply three effects, alone or combined: **drop** (a fraction of
arriving traffic lost before work happens, which also scales the node's
availability contribution), **capMul** (degraded capacity — brownouts),
and **noCache** (hit ratio forced to zero — the stampede). Killed nodes
leave the graph entirely; survivors inherit the flow.

## What it deliberately is not

No retry storms, no backpressure loops, no coordinated omission, no cold
starts, no GC pauses. Those are real and they are out of scope: this model
optimizes for being **explainable in one page** and **directionally honest**
— every capacity figure carries its source, latency chips state a ±40%
band, and the About tab says this out loud. The simulator is a flight
simulator: the physics are simplified, the instincts transfer.
