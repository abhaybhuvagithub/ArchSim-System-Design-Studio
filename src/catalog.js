// Component catalog: 23 building blocks.
// cap = requests/sec one instance handles, lat = base latency ms, avail = single-instance availability.
// Availability figures. Where a provider publishes an SLA for the service, that
// number is used; where they do not, it is an estimate in the same family and
// is not dressed up as anything more. Checked against the pages below on
// SLA_AT — the same discipline as pricing, for the same reason: a figure with
// no date behind it looks certain long after it stops being true.
export const SLA_AT = '2026-08-08'
export const SLA_SOURCES = [
  { label: 'AWS service SLAs', url: 'https://aws.amazon.com/legal/service-level-agreements/' },
  { label: 'API Gateway SLA', url: 'https://aws.amazon.com/api-gateway/sla/' },
  { label: 'Amazon RDS SLA', url: 'https://aws.amazon.com/rds/sla/' },
  { label: 'Amazon Route 53 SLA', url: 'https://aws.amazon.com/route53/sla/' },
]
export const SLA_NOTES = {"dns": "Route 53 publishes a 100% SLA; modelled at four nines because DNS resolvers and TTLs are the real limit", "cdn": "CloudFront: 99.9%", "lb": "ELB / ALB: 99.99%", "gateway": "API Gateway: 99.95%", "web": "EC2 in a region: 99.99%", "app": "EC2 in a region: 99.99%", "micro": "EKS control plane: 99.95%", "sql": "RDS Multi-AZ: 99.95%", "nosql": "DynamoDB single region: 99.99%", "cache": "ElastiCache single-AZ: 99.9%", "blob": "S3 Standard availability SLA: 99.9%. Durability is eleven nines and a different thing", "queue": "SQS: 99.9%", "kafka": "MSK: 99.9%", "search": "OpenSearch single-AZ: 99.9%", "worker": "Lambda / ECS: 99.95%"}

export const CATALOG = {
  client:      { name: 'Client',         glyph: '👤', color: '#64748b', cap: Infinity, lat: 0,   avail: 1,      source: true,  desc: 'Traffic source (users, mobile apps, browsers).' },
  dns:         { name: 'DNS',            glyph: '🌐', color: '#0ea5e9', cap: 500000,   lat: 1,   avail: 0.9999, desc: 'Resolves names to IPs, geo-routing.' },
  cdn:         { name: 'CDN',            glyph: '⚡', color: '#f59e0b', cap: 200000,   lat: 5,   avail: 0.999, cacheHit: 0.9, desc: 'Edge cache for static content. 90% hit ratio.' },
  lb:          { name: 'Load Balancer',  glyph: '⚖️', color: '#8b5cf6', cap: 100000,  lat: 1,   avail: 0.9999, desc: 'Distributes traffic (L4/L7, round-robin, least-conn).' },
  gateway:     { name: 'API Gateway',    glyph: '🚪', color: '#8b5cf6', cap: 50000,   lat: 3,   avail: 0.9995,  desc: 'Auth, routing, throttling, request shaping.' },
  k8sgw:       { name: 'Kubernetes Gateway API', glyph: '🛣️', color: '#8b5cf6', cap: 55000, lat: 3, avail: 0.9995, desc: 'Cloud-native successor to Ingress — protocol-aware routing (HTTP, gRPC, TCP), native weighted traffic splitting for canary rollouts, role-split between infra and app teams.' },
  grpcgw:      { name: 'gRPC-JSON Transcoder', glyph: '🔁', color: '#8b5cf6', cap: 40000, lat: 5, avail: 0.9995, desc: 'Envoy / grpc-gateway plugin at the edge — accepts REST/JSON from external clients, calls internal gRPC services, translates the response back to JSON.' },
  ratelimiter: { name: 'Rate Limiter',   glyph: '🚦', color: '#ef4444', cap: 80000,   lat: 1,   avail: 0.999,  desc: 'Token bucket / sliding window request limiting.' },
  web:         { name: 'Web Server',     glyph: '🖥️', color: '#3b82f6', cap: 5000,    lat: 10,  avail: 0.9999,  desc: 'Serves HTTP, static assets, SSR.' },
  app:         { name: 'App Server',     glyph: '⚙️', color: '#3b82f6', cap: 2000,    lat: 25,  avail: 0.9999,  desc: 'Business logic tier (stateless service).' },
  micro:       { name: 'Microservice',   glyph: '🧩', color: '#06b6d4', cap: 3000,    lat: 15,  avail: 0.9995,  desc: 'Single-purpose stateless service.' },
  grpc:        { name: 'gRPC Service',   glyph: '📶', color: '#06b6d4', cap: 6000,    lat: 8,   avail: 0.9995,  desc: 'Internal binary RPC over HTTP/2 — protobuf payloads, multiplexed streams, typed contracts between services.' },
  ws:          { name: 'WebSocket Srv',  glyph: '🔌', color: '#06b6d4', cap: 50000,   lat: 5,   avail: 0.999,  desc: 'Persistent connections for realtime push.' },
  cache:       { name: 'Cache (Redis)',  glyph: '🧠', color: '#ef4444', cap: 100000,  lat: 1,   avail: 0.999,  cacheHit: 0.8, desc: 'In-memory KV store. 80% hit ratio.' },
  sql:         { name: 'SQL Database',   glyph: '🗄️', color: '#10b981', cap: 5000,    lat: 10,  avail: 0.9995,  desc: 'Relational store (Postgres/MySQL). ACID.' },
  nosql:       { name: 'NoSQL DB',       glyph: '📦', color: '#10b981', cap: 20000,   lat: 5,   avail: 0.9999, desc: 'DynamoDB/Cassandra. Partitioned, eventually consistent.' },
  search:      { name: 'Search Index',   glyph: '🔍', color: '#f97316', cap: 8000,    lat: 20,  avail: 0.999,  desc: 'Elasticsearch — inverted index, full-text & geo.' },
  queue:       { name: 'Message Queue',  glyph: '📨', color: '#eab308', cap: 50000,   lat: 3,   avail: 0.999, desc: 'SQS/RabbitMQ — buffering, async decoupling.' },
  kafka:       { name: 'Event Stream',   glyph: '🌊', color: '#eab308', cap: 200000,  lat: 3,   avail: 0.999, desc: 'Kafka — partitioned log, replayable events.' },
  worker:      { name: 'Worker Pool',    glyph: '🛠️', color: '#3b82f6', cap: 1000,    lat: 50,  avail: 0.9995,  desc: 'Async consumers for jobs (encode, fan-out, email).' },
  scheduler:   { name: 'Scheduler',      glyph: '⏰', color: '#a855f7', cap: 1000,    lat: 5,   avail: 0.999,  desc: 'Cron / delayed job orchestration.' },
  blob:        { name: 'Object Storage', glyph: '🪣', color: '#10b981', cap: 30000,   lat: 30,  avail: 0.999,desc: 'S3/GCS — blobs, videos, images. 11 nines durability.' },
  zk:          { name: 'Coordination',   glyph: '🐘', color: '#a855f7', cap: 10000,   lat: 2,   avail: 0.9999, desc: 'ZooKeeper/etcd — leader election, config, locks.' },
  analytics:   { name: 'Analytics/OLAP', glyph: '📊', color: '#f97316', cap: 2000,    lat: 100, avail: 0.999,  desc: 'Warehouse / stream analytics (Flink, BigQuery).' },
  ml:          { name: 'ML Service',     glyph: '🤖', color: '#ec4899', cap: 500,     lat: 80,  avail: 0.999,  desc: 'Ranking / recommendation / embedding inference.' },
  monitor:     { name: 'Metrics & Alerts',glyph: '🩺', color: '#64748b', cap: 100000, lat: 1,   avail: 0.999,  desc: 'Prometheus/Datadog — RED & USE metrics, dashboards, alert rules.' },
  // --- microservice platform primitives ---
  bff:         { name: 'BFF',            glyph: '🎭', color: '#8b5cf6', cap: 8000,    lat: 8,   avail: 0.999,  desc: 'Backend-for-frontend: per-client aggregation layer.' },
  registry:    { name: 'Service Registry', glyph: '📖', color: '#a855f7', cap: 40000, lat: 2,   avail: 0.9999, desc: 'Consul/Eureka — service discovery and health checks.' },
  mesh:        { name: 'Service Mesh',   glyph: '🕸️', color: '#a855f7', cap: 40000,   lat: 2,   avail: 0.9995, desc: 'Envoy sidecars — mTLS, retries, circuit breaking, traffic splitting.' },
  saga:        { name: 'Saga Orchestrator', glyph: '🎬', color: '#ec4899', cap: 4000, lat: 20,  avail: 0.999,  desc: 'Coordinates distributed transactions via compensating actions.' },
  config:      { name: 'Config Server',  glyph: '🎛️', color: '#a855f7', cap: 20000,   lat: 2,   avail: 0.9995, desc: 'Centralised config and feature flags with hot reload.' },
  tracing:     { name: 'Tracing',        glyph: '🧵', color: '#64748b', cap: 100000,  lat: 1,   avail: 0.999,  desc: 'Jaeger/OpenTelemetry — distributed traces across service hops.' },
  // --- data platform ---
  cdc:         { name: 'CDC Connector',  glyph: '🔗', color: '#eab308', cap: 20000,   lat: 5,   avail: 0.9995, desc: 'Debezium — streams DB changes out without touching app code.' },
  etl:         { name: 'ETL / ELT Job',  glyph: '🧪', color: '#eab308', cap: 2000,    lat: 60,  avail: 0.999,  desc: 'Batch or streaming transform: clean, dedupe, conform to schema.' },
  lake:        { name: 'Data Lake',      glyph: '🏞️', color: '#0ea5e9', cap: 50000,   lat: 40,  avail: 0.9999, desc: 'S3/ADLS raw zone — immutable landing area, schema-on-read, cheap at PB scale.' },
  warehouse:   { name: 'Data Warehouse', glyph: '🏛️', color: '#0ea5e9', cap: 3000,    lat: 120, avail: 0.999,  desc: 'Snowflake/BigQuery/Redshift — modelled columnar store for SQL analytics.' },
  bi:          { name: 'BI / Dashboards',glyph: '📈', color: '#f97316', cap: 1000,    lat: 150, avail: 0.999,  desc: 'Looker/Tableau/Superset — queries the warehouse, never production DBs.' },
  // --- AI / GenAI ---
  vector:      { name: 'Vector DB',      glyph: '🧭', color: '#ec4899', cap: 4000,    lat: 25,  avail: 0.999,  desc: 'Pinecone/pgvector/Milvus — ANN search over embeddings for retrieval.' },
  embed:       { name: 'Embedding Svc',  glyph: '🔢', color: '#ec4899', cap: 800,     lat: 40,  avail: 0.999,  desc: 'Turns text/images into vectors; used at index time and query time.' },
  llm:         { name: 'LLM Inference',  glyph: '🧠', color: '#ec4899', cap: 60,      lat: 900, avail: 0.999,  desc: 'GPU-served generation. Expensive, slow, and the usual bottleneck — batch and stream.' },
  guard:       { name: 'Guardrails',     glyph: '🛟', color: '#ef4444', cap: 5000,    lat: 20,  avail: 0.999,  desc: 'Prompt-injection, PII and safety filtering on input and output.' },

  // ─── observability ───
  otel:        { name: 'OTel Collector', glyph: '📥', color: '#64748b', cap: 120000,  lat: 1,   avail: 0.9995, desc: 'OpenTelemetry collector — one pipeline for metrics, logs and traces; batching, sampling, redaction.' },
  logs:        { name: 'Log Pipeline',   glyph: '🧾', color: '#64748b', cap: 60000,   lat: 2,   avail: 0.999,  desc: 'ELK/Loki/Splunk — structured logs, retention tiers, correlation by trace id.' },
  slo:         { name: 'SLO / Error Budget', glyph: '🎯', color: '#64748b', cap: 20000, lat: 5,  avail: 0.999,  desc: 'Service level objectives, burn-rate alerts, error budget policy.' },
  alert:       { name: 'On-call / Paging', glyph: '📟', color: '#f59e0b', cap: 5000,   lat: 2,   avail: 0.9999, desc: 'PagerDuty/Opsgenie — routing, escalation, runbooks, incident timeline.' },
  synthetic:   { name: 'Synthetic Probes', glyph: '📡', color: '#64748b', cap: 20000,  lat: 5,   avail: 0.9999, desc: 'Black-box checks from outside your network — catches what internal metrics miss.' },
  apm:         { name: 'RUM / Client APM', glyph: '🖱️', color: '#64748b', cap: 80000,  lat: 2,   avail: 0.999,  desc: 'Real user monitoring — actual client latency, errors and web vitals.' },

  // ─── security & governance ───
  waf:         { name: 'WAF / DDoS',     glyph: '🛡️', color: '#ef4444', cap: 200000,  lat: 3,   avail: 0.9999, desc: 'Edge filtering: OWASP rules, bot and volumetric attack mitigation.' },
  iam:         { name: 'Identity (SSO)', glyph: '🔑', color: '#ef4444', cap: 25000,   lat: 15,  avail: 0.9999, desc: 'OIDC/SAML provider — SSO, MFA, token issuance, RBAC claims.' },
  secrets:     { name: 'Secrets / KMS',  glyph: '🔐', color: '#ef4444', cap: 30000,   lat: 5,   avail: 0.9999, desc: 'Vault/KMS — dynamic credentials, rotation, envelope encryption.' },
  pii:         { name: 'Tokenization Vault', glyph: '🎫', color: '#ef4444', cap: 15000, lat: 12, avail: 0.9995, desc: 'Swaps PII/PAN for tokens so downstream systems stay out of scope (PCI/GDPR).' },
  audit:       { name: 'Audit Log',      glyph: '📜', color: '#ef4444', cap: 40000,   lat: 5,   avail: 0.9999, desc: 'Append-only, tamper-evident record of who did what — retained for compliance.' },
  siem:        { name: 'SIEM',           glyph: '🕵️', color: '#ef4444', cap: 60000,   lat: 10,  avail: 0.999,  desc: 'Security analytics over logs and audit trails; detections and threat hunting.' },

  // ─── enterprise platform & integration ───
  gslb:        { name: 'Global Traffic Mgr', glyph: '🌍', color: '#0ea5e9', cap: 500000, lat: 2, avail: 0.99999, desc: 'Anycast/GSLB — geo routing, health-based failover between regions.' },
  edge:        { name: 'Edge Functions', glyph: '🛰️', color: '#f59e0b', cap: 50000,   lat: 4,   avail: 0.9999, desc: 'Compute at the PoP — auth checks, A/B, personalisation without an origin hop.' },
  graphql:     { name: 'GraphQL Federation', glyph: '🔷', color: '#8b5cf6', cap: 6000, lat: 12,  avail: 0.999,  desc: 'One typed graph over many subgraphs; solves client over-fetching, adds a planner hop.' },
  tenant:      { name: 'Tenant Router',  glyph: '🏷️', color: '#8b5cf6', cap: 60000,   lat: 2,   avail: 0.9995, desc: 'Multi-tenancy: routes by tenant to the right shard/silo, enforces isolation.' },
  k8s:         { name: 'Container Platform', glyph: '☸️', color: '#3b82f6', cap: 90000, lat: 2,  avail: 0.9995, desc: 'Kubernetes — scheduling, autoscaling, rollouts, self-healing for the service fleet.' },
  cicd:        { name: 'CI/CD Pipeline', glyph: '🚀', color: '#a855f7', cap: 500,     lat: 30,  avail: 0.999,  desc: 'Build, test, scan, progressive delivery (canary/blue-green) and rollback.' },
  esb:         { name: 'Integration Bus', glyph: '🔀', color: '#eab308', cap: 9000,   lat: 25,  avail: 0.999,  desc: 'ESB/iPaaS — protocol and schema mediation between modern services and legacy systems.' },
  mq:          { name: 'Enterprise MQ',  glyph: '📬', color: '#eab308', cap: 30000,   lat: 5,   avail: 0.9995, desc: 'IBM MQ/JMS — transactional, guaranteed-delivery messaging with XA semantics.' },
  erp:         { name: 'ERP (SAP)',      glyph: '🏢', color: '#10b981', cap: 900,     lat: 120, avail: 0.999,  desc: 'System of record for finance/supply chain. Low QPS ceiling — always front it with a cache or queue.' },
  crm:         { name: 'CRM (Salesforce)', glyph: '🤝', color: '#10b981', cap: 1200,  lat: 100, avail: 0.999,  desc: 'Customer system of record; hard API limits make it a throttling risk.' },
  mainframe:   { name: 'Mainframe Core', glyph: '🖲️', color: '#10b981', cap: 1500,    lat: 60,  avail: 0.99999, desc: 'CICS/COBOL core banking. Extremely reliable, expensive per call, cannot be scaled out.' },
  mft:         { name: 'File Transfer / EDI', glyph: '📤', color: '#eab308', cap: 2000, lat: 40, avail: 0.999,  desc: 'Managed file transfer and B2B EDI batches — still how most partners integrate.' },
  partner:     { name: 'Partner / Bank API', glyph: '⛓️', color: '#10b981', cap: 2000, lat: 250, avail: 0.995, desc: 'Third-party dependency you do not control — bank, acquirer, NPCI switch, GDS, supplier. Rate-limited, slow, and the least available thing in your design.' },
  hsm:         { name: 'HSM (PIN / Keys)', glyph: '🔏', color: '#ef4444', cap: 8000, lat: 15, avail: 0.9999, desc: 'Hardware security module — PIN block translation, key custody, signing. Mandated for card and UPI flows.' },

  // ─── quality & testing ───
  e2e:         { name: 'UI Test Automation', glyph: '🕹️', color: '#8b5cf6', cap: 200,   lat: 400, avail: 0.99,   desc: 'Selenium/Playwright/Cypress. Slowest and flakiest layer — keep it thin and reserve it for critical journeys.' },
  apitest:     { name: 'API Test Suite',   glyph: '🔬', color: '#8b5cf6', cap: 2000,  lat: 50,  avail: 0.999,  desc: 'REST Assured / Postman-Newman / pytest. The workhorse layer: fast, stable, and where most coverage should live.' },
  load:        { name: 'Load & Perf Test', glyph: '🏋️', color: '#f59e0b', cap: 50000, lat: 10,  avail: 0.999,  desc: 'JMeter / k6 / Gatling / Locust — generates the traffic this simulator only models. Run it against a production-like environment or it lies.' },
  contract:    { name: 'Contract Testing', glyph: '📋', color: '#06b6d4', cap: 3000,  lat: 20,  avail: 0.999,  desc: 'Pact-style consumer-driven contracts — catches a breaking API change at build time instead of in production.' },
  mock:        { name: 'Service Virtualization', glyph: '🪞', color: '#06b6d4', cap: 20000, lat: 5, avail: 0.999, desc: 'WireMock/MockServer — stands in for a partner or an unavailable dependency so tests are deterministic and free.' },
  testdata:    { name: 'Test Data Mgmt',   glyph: '🗃️', color: '#10b981', cap: 5000,  lat: 30,  avail: 0.999,  desc: 'Seeded, masked, reproducible data sets. Shared mutable test data is the most common source of flaky suites.' },
  qgate:       { name: 'Quality Gate (SAST)', glyph: '✅', color: '#a855f7', cap: 500, lat: 120, avail: 0.999, desc: 'SonarQube-style static analysis, coverage and lint thresholds that can fail the build.' },
  dast:        { name: 'Security Testing (DAST)', glyph: '🔎', color: '#ef4444', cap: 200, lat: 300, avail: 0.999, desc: 'OWASP ZAP-style dynamic scanning against a running build, plus dependency and secret scanning.' },
  devicefarm:  { name: 'Device / Browser Grid', glyph: '📱', color: '#8b5cf6', cap: 300, lat: 800, avail: 0.99, desc: 'Real devices and browser matrix — the long pole in any UI suite, so parallelise and shard.' },
  testops:     { name: 'Test Reporting',   glyph: '🧰', color: '#f97316', cap: 10000, lat: 20,  avail: 0.999,  desc: 'Allure/TestRail/Xray — results, history, flake tracking. A red build nobody can interpret is a build nobody fixes.' },
  billing:     { name: 'Metering & Billing', glyph: '🧮', color: '#10b981', cap: 4000, lat: 30,  avail: 0.999,  desc: 'Usage metering, rating and invoicing. Must never lose or double-count an event.' },
  backup:      { name: 'Backup & Archive', glyph: '💾', color: '#10b981', cap: 6000,  lat: 200, avail: 0.99999, desc: 'PITR snapshots and archival with a tested restore path — replication is not backup.' },
  // ---- cryptography ----
  tls:      { name: 'TLS Termination',   glyph: '🔒', color: '#14b8a6', cap: 180000, lat: 2,  avail: 0.99995, desc: 'TLS 1.3 handshake and record layer — ECDHE key exchange, AES-128-GCM or ChaCha20-Poly1305, session resumption and OCSP stapling. Offloads crypto from the app tier.' },
  crypto:   { name: 'Encryption Service', glyph: '🔐', color: '#14b8a6', cap: 45000,  lat: 4,  avail: 0.9999,  desc: 'Envelope encryption at rest — AES-256-GCM data keys wrapped by a KEK in KMS. One KMS call per key, then bulk encryption locally.' },
  hash:     { name: 'Password Hashing',  glyph: '🧂', color: '#14b8a6', cap: 900,    lat: 120, avail: 0.9999,  desc: 'Argon2id (or bcrypt / scrypt) with a per-user salt. Deliberately slow — the cost that stops offline cracking is the same cost you pay per login, so it caps out early.' },
  digest:   { name: 'Hashing / Checksum', glyph: '#️⃣', color: '#14b8a6', cap: 250000, lat: 1,  avail: 0.99995, desc: 'SHA-256, SHA-3 or BLAKE3 for integrity, dedup keys and content addressing. Fast and collision-resistant — never for passwords.' },
  sign:     { name: 'Signing / JWT',     glyph: '✍️', color: '#14b8a6', cap: 60000,  lat: 3,  avail: 0.9999,  desc: 'Issues and verifies signatures — Ed25519 or ECDSA P-256 for tokens and webhooks, HMAC-SHA256 where both sides share a secret. Verification is far cheaper than signing.' },
  e2ee:     { name: 'End-to-End Crypto', glyph: '🕵️‍♀️', color: '#14b8a6', cap: 35000, lat: 6, avail: 0.9995, desc: 'Client-held keys — X3DH agreement plus the Double Ratchet for forward secrecy. The server relays ciphertext it cannot read, so search and moderation move to the device.' },
  graph:        { name: 'Graph Database', glyph: '🕸️', color: '#10b981', cap: 6000, lat: 12, avail: 0.9995, desc: 'Neo4j-style. Traversals over relationships that would be recursive joins in SQL.' },
  tsdb:         { name: 'Time-Series DB', glyph: '📈', color: '#f97316', cap: 60000, lat: 4, avail: 0.999, desc: 'Prometheus/Influx. Append-only metrics with downsampling and retention built in.' },
  featureflag:  { name: 'Feature Flags', glyph: '🚩', color: '#8b5cf6', cap: 80000, lat: 1, avail: 0.9999, desc: 'LaunchDarkly-style. Evaluated locally from a cached ruleset — never a network call per request.' },
  featurestore: { name: 'Feature Store', glyph: '🗂️', color: '#ec4899', cap: 20000, lat: 8, avail: 0.999, desc: 'Serves the same features to training and inference, which is what stops training/serving skew.' },
  stream:       { name: 'Stream Processor', glyph: '🌀', color: '#eab308', cap: 40000, lat: 15, avail: 0.999, desc: 'Flink-style. Windowed aggregation over an event stream with checkpointed state.' },
  batch:        { name: 'Batch Processor', glyph: '🧮', color: '#f97316', cap: 3000, lat: 300, avail: 0.999, desc: 'Spark-style. Hours of compute over the whole dataset, restartable and idempotent by design.' },
  transcode:    { name: 'Media Transcoder', glyph: '🎬', color: '#3b82f6', cap: 400, lat: 900, avail: 0.999, desc: 'Encodes one upload into a ladder of bitrates. CPU-bound, long-running, and always async.' },
  sandbox:      { name: 'Code Sandbox', glyph: '📦', color: '#ef4444', cap: 300, lat: 400, avail: 0.999, desc: 'Runs untrusted code under a hard CPU, memory and network limit. Isolation is the whole feature.' },
  geoidx:       { name: 'Geospatial Index', glyph: '🧭', color: '#06b6d4', cap: 30000, lat: 6, avail: 0.9995, desc: 'H3 or geohash cells over moving points. Nearby lookups read a cell neighbourhood, never the globe.' },
  push:         { name: 'Push / SMS / Email', glyph: '📮', color: '#eab308', cap: 20000, lat: 120, avail: 0.999, desc: 'Third-party delivery. Rate-limited by the provider, and every send needs an idempotency key.' },
  containerreg: { name: 'Container Registry', glyph: '🐳', color: '#64748b', cap: 5000, lat: 20, avail: 0.9999, desc: 'Image storage on the deploy path. Rarely the bottleneck until every node pulls at once.' },
  bastion:      { name: 'Bastion / Jump Host', glyph: '🚪', color: '#a855f7', cap: 500, lat: 10, avail: 0.999, desc: 'The single audited way into a private network. Every session recorded.' },
}

export const PALETTE_GROUPS = [
  { label: 'Traffic',       types: ['client', 'dns', 'gslb', 'waf', 'cdn', 'edge', 'lb', 'gateway', 'k8sgw', 'grpcgw', 'graphql', 'ratelimiter', 'bff', 'tenant'] },
  { label: 'Compute',       types: ['sandbox', 'transcode', 'web', 'app', 'micro', 'grpc', 'ws', 'worker', 'scheduler', 'k8s'] },
  { label: 'Storage',       types: ['geoidx', 'graph', 'cache', 'sql', 'nosql', 'search', 'blob', 'backup'] },
  { label: 'Async',         types: ['push', 'queue', 'kafka', 'mq', 'esb', 'saga'] },
  { label: 'Data',          types: ['batch', 'stream', 'cdc', 'etl', 'lake', 'warehouse', 'bi', 'analytics'] },
  { label: 'AI / ML',       types: ['featurestore', 'ml', 'embed', 'vector', 'llm', 'guard'] },
  { label: 'Observability', types: ['tsdb', 'otel', 'monitor', 'logs', 'tracing', 'slo', 'alert', 'synthetic', 'apm'] },
  { label: 'Security',      types: ['bastion', 'iam', 'secrets', 'hsm', 'pii', 'audit', 'siem'] },
  { label: 'Cryptography',  types: ['tls', 'crypto', 'hash', 'digest', 'sign', 'e2ee'] },
  { label: 'Enterprise',    types: ['partner', 'erp', 'crm', 'mainframe', 'mft', 'billing', 'cicd'] },
  { label: 'Quality',       types: ['apitest', 'e2e', 'contract', 'load', 'mock', 'testdata', 'qgate', 'dast', 'devicefarm', 'testops'] },
  { label: 'Platform',      types: ['containerreg', 'featureflag', 'registry', 'mesh', 'config', 'zk'] },
]
