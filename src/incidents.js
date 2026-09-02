// ── 🚨 Incident Mode ────────────────────────────────────────────────────────
// The FDE's hour: a customer describes symptoms, the studio has quietly
// injected the real fault, and the engineer must investigate the LIVE
// simulation, name the root cause from a lineup, and then say it four ways -
// to the engineer, the EM, the CTO, and the customer executive.
// Every incident references a real template, real fault ids, real node ids;
// the suite enforces all three, so an incident can never point at fiction.

export const INCIDENTS = [
  {
    id: 'inc-bank-p99',
    title: 'Checkout latency at an enterprise bank',
    customer: 'Meridian Bank (enterprise)',
    tpl: 'Card Payments (Auth + Settlement)', rps: 1500,
    faults: [{ faultId: 'latency', targetId: 'iss' }],
    symptom: '"Checkout p99 jumped from ~210ms to 2.8s at 10:14. Error rate is creeping up and our dashboards show retries climbing. Nothing was deployed on our side. Merchants are calling."',
    clues: [
      'Capacity tab: walk the tiers - whose latency moved first, and whose merely follows it?',
      'The retries the customer sees are a symptom multiplier: amplified load lands on the SAME slow dependency.',
      'The stand-in path exists for exactly this - check what the breakdown says happens when the issuer is slow.',
    ],
    lineup: [
      'The API gateway is undersized for the morning peak',
      'Issuer-connection latency spiked, and client retries are amplifying load onto the slow dependency',
      'The settlement worker is backed up and blocking authorizations',
      'A bad deploy on the auth service introduced a slow code path',
      'DNS resolution is failing intermittently for mobile clients',
    ],
    answer: 1,
    fix: 'Tighten the timeout and latency budget on issuer calls, cap retries with jitter (retry budget, not retry faith), open the per-issuer circuit breaker so the stand-in path absorbs within its risk limits - and only then talk about capacity.',
    comms: {
      engineer: 'Issuer p99 went from 40ms to 2.4s at 10:14; our retries multiplied offered load ~1.8x onto the same connection. Breaker for that issuer opens at the current thresholds in stand-in; cap client retries at 1 with jitter.',
      em: 'The bottleneck is an external issuer, not our fleet. Retries were amplifying it; we are containing with the breaker and the stand-in path, and merchant impact should fall within minutes.',
      cto: 'An upstream issuer degraded and our retry policy briefly amplified it. Containment is automatic (breaker + stand-in, within agreed risk limits); the fix on our side is a stricter retry budget, shipping today.',
      exec: 'A partner bank slowed down and our system initially pushed harder instead of easing off. We have switched to the designed fallback, customers can pay, and we are tightening the automatic behavior so this contains itself next time.',
    },
    rca: 'Trigger: issuer latency spike (external). Amplifier: client+gateway retries without a budget. Detection: p99 SLO burn at 10:16. Containment: per-issuer breaker + stand-in. Prevention: retry budget with jitter; issuer latency budget alarmed at p95, not p99.',
  },
  {
    id: 'inc-upi-duplicates',
    title: 'Customers report duplicate debits',
    customer: 'Regional bank on the UPI rails',
    tpl: 'UPI Switch (NPCI)', rps: 1200,
    faults: [{ faultId: 'retry', targetId: 'rem' }],
    symptom: '"Support tickets say customers were debited twice for the same payment during the evening spike. Our banking partner insists their systems are fine. Reconciliation is showing mismatches."',
    clues: [
      'Chaos tab: a retry storm is active - duplicates are inflating offered load on the remitter leg.',
      'Capacity tab: select the ledger and read the idempotency verdict - what does the switch itself guarantee?',
      'The breakdown is explicit about DEEMED state and reversal legs - whose books can disagree, and how is that reconciled?',
    ],
    lineup: [
      'The switch double-posted entries to its ledger under load',
      'A timing-out bank leg triggered retries; the switch ledger deduplicates by idempotency key, but the partner leg booked twice - reversal legs and reconciliation resolve it',
      'The reconciliation worker has a bug that fabricates mismatches',
      'Kafka delivered the settlement events twice and that is the whole story',
      'Clock skew between banks created phantom transactions',
    ],
    answer: 1,
    fix: 'Confirm the switch ledger shows single entries per idempotency key; issue reversal legs for the partner-side duplicates as new idempotent entries (never edits); share the per-transaction evidence trail; agree a retry-budget and idempotency-key contract with the partner leg.',
    comms: {
      engineer: 'Retry storm on the remitter leg during the spike. Our ledger dedupes on the idempotency key - single entries confirmed. Partner leg booked duplicates; reversal legs queued, recon report attached per txn id.',
      em: 'Money is safe and traceable: our books show one entry per payment; the duplicates are on the partner side and are being reversed with a full audit trail. Ticket volume should drop as reversals land.',
      cto: 'The event was a retry amplification during peak; our idempotency design held. The partner integration lacks the same key discipline - we are proposing a shared idempotency contract so reversals become unnecessary rather than routine.',
      exec: 'No customer will lose money: every duplicate is identified and being reversed with a receipt. Our system recorded each payment exactly once; we are working with the partner bank so their side matches that guarantee.',
    },
    rca: 'Trigger: partner-leg timeouts at peak. Amplifier: unbudgeted retries producing duplicate submissions. Our invariant: ledger idempotency held (single entries). Impact: partner-side double-booking. Containment: reversal legs + recon evidence. Prevention: shared idempotency-key contract; retry budget on the leg.',
  },
  {
    id: 'inc-copilot-tenant',
    title: 'One tenant gets empty answers',
    customer: 'B2B SaaS - two enterprise tenants',
    tpl: 'SaaS AI Copilot (Multi-tenant RAG)', rps: 900,
    faults: [{ faultId: 'errors', targetId: 'emb' }],
    symptom: '"Tenant Northwind works perfectly. Tenant Contoso, onboarded yesterday, gets \'the documents do not address this\' for everything - including questions their uploaded docs definitely answer. They think we shipped them a broken product."',
    clues: [
      'Capacity tab: the ingestion workers are throwing errors - what stops flowing when chunk-and-embed fails?',
      'Retrieval is tenant-filtered at the database: an empty namespace is not a bug in retrieval, it is honesty about an empty index.',
      'One tenant fine + one tenant empty is the signature of a per-tenant pipeline, not a shared-service outage.',
    ],
    lineup: [
      'The tenant filter is leaking - Contoso is querying the wrong namespace',
      'The LLM provider is down for half the requests',
      'Ingestion workers are erroring, so the new tenant\'s documents never reached the index - retrieval is correctly abstaining over an empty namespace',
      'The semantic cache is serving Northwind\'s entries to Contoso',
      'Contoso\'s users lack permissions in the product',
    ],
    answer: 2,
    fix: 'Fix the embed-worker failure, replay the ingestion log for the tenant (idempotent by doc version), verify chunk counts land, run the canary-document check for the tenant, then tell the customer exactly when their corpus became queryable.',
    comms: {
      engineer: 'Embed workers erroring since the onboarding batch; ingestion log has the docs, index namespace for the tenant is near-empty. Fix the worker, replay the log (idempotent on doc version), verify chunk counts + canary.',
      em: 'Scoped to the new tenant\'s ingestion pipeline - no cross-tenant issue, no data loss (the upload log holds everything). Replay after the worker fix; ETA for full corpus availability attached.',
      cto: 'The abstention behavior worked as designed - the system refused to invent answers over an empty index. The failure was in ingestion for one tenant; we are adding an onboarding gate that blocks "go-live" until the canary document retrieves.',
      exec: 'Your documents were received safely; a processing step failed before they became searchable, so the assistant honestly said it could not answer rather than guessing. Processing is being rerun now, and we are adding a check so onboarding cannot complete until search is verified working.',
    },
    rca: 'Trigger: embed-worker failure during onboarding batch. Impact: one tenant\'s namespace empty; abstention (correct) read as breakage. Detection gap: no onboarding gate on ingestion completion. Fix: worker + idempotent replay. Prevention: canary-doc retrieval as the onboarding exit criterion; ingestion-lag alarm per tenant.',
  },
  {
    id: 'inc-zomato-lag',
    title: 'Dinner rush: assignments falling behind',
    customer: 'Food delivery ops, Tier-1 city',
    tpl: 'Zomato', rps: 4000,
    faults: [{ faultId: 'crash', targetId: 'assign' }, { faultId: 'surge', targetId: null }],
    symptom: '"Orders are confirmed but riders are not being assigned for 4-6 minutes. Kitchens are stacking food. The consumer app looks fine - payments succeed - so customers think we cooked and forgot them."',
    clues: [
      'Chaos tab: a consumer replica is down while a surge multiplies offered load - lag = inflow minus drain.',
      'The queue between ordering and assignment is doing its job: absorbing. The question is whether drain can ever catch up.',
      'Orders succeed because the async boundary decouples payment from assignment - which is why the failure is invisible at checkout.',
    ],
    lineup: [
      'The payment gateway is slow, delaying order creation',
      'An assignment consumer replica crashed during a demand surge - drain rate fell below inflow and the backlog compounds until capacity returns',
      'The Kafka brokers are dropping messages',
      'The ETA model is mispredicting and holding assignments back',
      'Riders are declining orders at unusual rates',
    ],
    answer: 1,
    fix: 'Restore/scale the assignment consumers first (drain > inflow or the lag only grows), then work the backlog oldest-first with idempotent assignment, and alarm on consumer-lag-minutes - not on queue depth alone - so the next surge pages before kitchens notice.',
    comms: {
      engineer: 'assign consumer down one replica under a 1.6x surge; lag growing ~300 msgs/min. Scale consumers to N+2, drain oldest-first, assignments are idempotent on order id. Watch lag-minutes, not depth.',
      em: 'Root cause is assignment throughput, not ordering or payments. Backlog drains within ~12 minutes of scale-up; kitchen-stacking alerts to ops with affected order ids attached.',
      cto: 'The async design contained the blast radius - payments and ordering never degraded - but our alerting watched queue depth, not drain rate, so a consumer loss under surge went unpaged. We are alarming on lag-minutes and setting a consumer floor for peak windows.',
      exec: 'Orders and payments were never at risk; the delay was in matching riders, and it is cleared. The system now pages the team the moment matching falls behind demand, before kitchens feel it.',
    },
    rca: 'Trigger: consumer crash + demand surge. Physics: inflow > drain, lag compounds. Blast radius: contained to assignment by the async boundary. Detection gap: depth alarm without a drain-rate alarm. Prevention: lag-minutes SLO, consumer floor at peak, idempotent oldest-first drain runbook.',
  },
  {
    id: 'inc-llm-oom',
    title: 'Pods restarting every few minutes',
    customer: 'AI platform team on managed Kubernetes',
    tpl: 'LLM API Platform (FastAPI)', rps: 600,
    faults: [{ faultId: 'oom', targetId: 'api' }],
    symptom: '"API pods restart every few minutes under load - CrashLoopBackOff, then fine, then again. The node dashboard shows 40% memory free, so it cannot be memory. p99 looks like a sawtooth."',
    clues: [
      'The node has memory free; the CONTAINER has a limit - the kernel kills at the limit, not at node exhaustion.',
      'Sawtooth p99 is the restart signature: cold caches and connection re-establishment after every kill.',
      'CPU pressure throttles; memory pressure kills - which of the two matches restarts?',
    ],
    lineup: [
      'The node is out of memory and the dashboard is lying',
      'The container\'s memory limit sits below the real working set - the kernel OOM-kills at the limit while the node shows plenty free',
      'A liveness probe timeout is killing healthy pods',
      'The load balancer is recycling connections and crashing pods',
      'A memory leak in the OS is consuming the node',
    ],
    answer: 1,
    fix: 'Measure the true working set under load, set requests to the honest baseline and the limit with real headroom, re-run the load, and alarm on container-level OOM kills - node-level free memory is the wrong gauge for a namespaced death.',
    comms: {
      engineer: 'OOMKilled events on the api containers; limit 512Mi vs working set ~700Mi under load. Node free memory is irrelevant - the cgroup limit is the ceiling. Raise requests/limits to measured +30%, watch kubectl events, not the node graph.',
      em: 'The restarts are self-inflicted configuration: the container memory ceiling is below what the service genuinely needs at load. One values change plus a load re-test; no code fix required.',
      cto: 'Our resource model undersized the API tier - the scheduler placed pods the kernel then killed. We are moving limits to measured working sets and adding OOM-kill alerting at the container level, which the node dashboard cannot see.',
      exec: 'The service was repeatedly hitting a self-imposed memory ceiling and restarting. We have raised the ceiling to what the service actually needs and added monitoring at the right layer, so this failure mode is closed.',
    },
    rca: 'Trigger: working set > container limit under load. Confusion: node-level free memory masked cgroup kills. Signature: CrashLoop + sawtooth p99. Fix: measured requests/limits. Prevention: container OOM-kill alerts; load test gates on memory headroom, not just latency.',
  },
  {
    id: 'inc-gw-tls',
    title: 'Auth fails for every mobile client at once',
    customer: 'Platform customer, B2C mobile app',
    tpl: 'Cloud-Native Gateway API Platform', rps: 800,
    faults: [{ faultId: 'tls', targetId: 'gw' }],
    symptom: '"Since 09:00 every mobile user gets \'connection not secure\' or auth failures. The web app is fine. Nothing shipped. Our support queue is on fire."',
    clues: [
      'Everything-at-once, one client class, zero deploys - that is the signature of an expiring artifact, not a code path.',
      'Walk the ladder in order: DNS resolves? TCP connects? TLS handshake completes? - and only then look at tokens and apps.',
      'Web fine + mobile broken usually means chain validation differs: mobile stacks are stricter about an incomplete certificate chain.',
    ],
    lineup: [
      'The identity provider is down',
      'Mobile app store rollout broke the client',
      'The gateway\'s TLS certificate chain is invalid as of this morning - an expired intermediate the stricter mobile stacks reject and lenient browsers repair',
      'DNS failover moved mobile traffic to a dead region',
      'Rate limiting is blocking mobile IP ranges',
    ],
    answer: 2,
    fix: 'Reissue/deploy the full chain (leaf + intermediates) on the gateway, verify with an external handshake check from a mobile-class TLS stack, then fix the process: certificate expiry monitored as an SLO with a 30-day page, and chain validation in the deploy gate.',
    comms: {
      engineer: 'Intermediate in the gateway chain expired 08:59. Browsers AIA-fetch and repair; mobile stacks refuse. Deploy the full chain, verify the handshake externally against a strict client profile, confirm error rate falls to baseline.',
      em: 'Single artifact, single fix: the certificate chain on the edge. No app releases needed; recovery is immediate on deploy. Support can tell users no action is required on their side.',
      cto: 'An expired intermediate certificate - invisible to browsers, fatal to mobile clients. Fix is deployed; the durable change is treating certificate expiry as a monitored SLO with automated renewal and a chain-completeness check in the deploy gate.',
      exec: 'A security certificate quietly expired, and the strictest devices - phones - correctly refused to connect. It is fixed, users need to do nothing, and renewal is now automated and monitored so it cannot sneak up on us again.',
    },
    rca: 'Trigger: intermediate cert expiry. Asymmetry: lenient browser chain-repair vs strict mobile validation. Detection gap: no expiry monitoring on the full chain. Fix: full-chain redeploy + external strict-client verification. Prevention: cert expiry SLO with 30-day alerting; chain check in CI/CD.',
  },
]

export function incidentByTemplate(tplName) {
  return INCIDENTS.filter(i => i.tpl === tplName)
}
