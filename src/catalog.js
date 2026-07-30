// Component catalog: 23 building blocks.
// cap = requests/sec one instance handles, lat = base latency ms, avail = single-instance availability.
export const CATALOG = {
  client:      { name: 'Client',         glyph: '👤', color: '#64748b', cap: Infinity, lat: 0,   avail: 1,      source: true,  desc: 'Traffic source (users, mobile apps, browsers).' },
  dns:         { name: 'DNS',            glyph: '🌐', color: '#0ea5e9', cap: 500000,   lat: 1,   avail: 0.9999, desc: 'Resolves names to IPs, geo-routing.' },
  cdn:         { name: 'CDN',            glyph: '⚡', color: '#f59e0b', cap: 200000,   lat: 5,   avail: 0.9999, cacheHit: 0.9, desc: 'Edge cache for static content. 90% hit ratio.' },
  lb:          { name: 'Load Balancer',  glyph: '⚖️', color: '#8b5cf6', cap: 100000,  lat: 1,   avail: 0.9995, desc: 'Distributes traffic (L4/L7, round-robin, least-conn).' },
  gateway:     { name: 'API Gateway',    glyph: '🚪', color: '#8b5cf6', cap: 50000,   lat: 3,   avail: 0.999,  desc: 'Auth, routing, throttling, request shaping.' },
  ratelimiter: { name: 'Rate Limiter',   glyph: '🚦', color: '#ef4444', cap: 80000,   lat: 1,   avail: 0.999,  desc: 'Token bucket / sliding window request limiting.' },
  web:         { name: 'Web Server',     glyph: '🖥️', color: '#3b82f6', cap: 5000,    lat: 10,  avail: 0.999,  desc: 'Serves HTTP, static assets, SSR.' },
  app:         { name: 'App Server',     glyph: '⚙️', color: '#3b82f6', cap: 2000,    lat: 25,  avail: 0.999,  desc: 'Business logic tier (stateless service).' },
  micro:       { name: 'Microservice',   glyph: '🧩', color: '#06b6d4', cap: 3000,    lat: 15,  avail: 0.999,  desc: 'Single-purpose stateless service.' },
  ws:          { name: 'WebSocket Srv',  glyph: '🔌', color: '#06b6d4', cap: 50000,   lat: 5,   avail: 0.999,  desc: 'Persistent connections for realtime push.' },
  cache:       { name: 'Cache (Redis)',  glyph: '🧠', color: '#ef4444', cap: 100000,  lat: 1,   avail: 0.999,  cacheHit: 0.8, desc: 'In-memory KV store. 80% hit ratio.' },
  sql:         { name: 'SQL Database',   glyph: '🗄️', color: '#10b981', cap: 5000,    lat: 10,  avail: 0.999,  desc: 'Relational store (Postgres/MySQL). ACID.' },
  nosql:       { name: 'NoSQL DB',       glyph: '📦', color: '#10b981', cap: 20000,   lat: 5,   avail: 0.9995, desc: 'DynamoDB/Cassandra. Partitioned, eventually consistent.' },
  search:      { name: 'Search Index',   glyph: '🔍', color: '#f97316', cap: 8000,    lat: 20,  avail: 0.999,  desc: 'Elasticsearch — inverted index, full-text & geo.' },
  queue:       { name: 'Message Queue',  glyph: '📨', color: '#eab308', cap: 50000,   lat: 3,   avail: 0.9995, desc: 'SQS/RabbitMQ — buffering, async decoupling.' },
  kafka:       { name: 'Event Stream',   glyph: '🌊', color: '#eab308', cap: 200000,  lat: 3,   avail: 0.9995, desc: 'Kafka — partitioned log, replayable events.' },
  worker:      { name: 'Worker Pool',    glyph: '🛠️', color: '#3b82f6', cap: 1000,    lat: 50,  avail: 0.999,  desc: 'Async consumers for jobs (encode, fan-out, email).' },
  scheduler:   { name: 'Scheduler',      glyph: '⏰', color: '#a855f7', cap: 1000,    lat: 5,   avail: 0.999,  desc: 'Cron / delayed job orchestration.' },
  blob:        { name: 'Object Storage', glyph: '🪣', color: '#10b981', cap: 30000,   lat: 30,  avail: 0.99999,desc: 'S3/GCS — blobs, videos, images. 11 nines durability.' },
  zk:          { name: 'Coordination',   glyph: '🐘', color: '#a855f7', cap: 10000,   lat: 2,   avail: 0.9999, desc: 'ZooKeeper/etcd — leader election, config, locks.' },
  analytics:   { name: 'Analytics/OLAP', glyph: '📊', color: '#f97316', cap: 2000,    lat: 100, avail: 0.999,  desc: 'Warehouse / stream analytics (Flink, BigQuery).' },
  ml:          { name: 'ML Service',     glyph: '🤖', color: '#ec4899', cap: 500,     lat: 80,  avail: 0.999,  desc: 'Ranking / recommendation / embedding inference.' },
  monitor:     { name: 'Monitoring',     glyph: '🩺', color: '#64748b', cap: 100000,  lat: 1,   avail: 0.999,  desc: 'Metrics, logs, traces, alerting.' },
  // --- microservice platform primitives ---
  bff:         { name: 'BFF',            glyph: '🎭', color: '#8b5cf6', cap: 8000,    lat: 8,   avail: 0.999,  desc: 'Backend-for-frontend: per-client aggregation layer.' },
  registry:    { name: 'Service Registry', glyph: '📖', color: '#a855f7', cap: 40000, lat: 2,   avail: 0.9999, desc: 'Consul/Eureka — service discovery and health checks.' },
  mesh:        { name: 'Service Mesh',   glyph: '🕸️', color: '#a855f7', cap: 40000,   lat: 2,   avail: 0.9995, desc: 'Envoy sidecars — mTLS, retries, circuit breaking, traffic splitting.' },
  saga:        { name: 'Saga Orchestrator', glyph: '🎬', color: '#ec4899', cap: 4000, lat: 20,  avail: 0.999,  desc: 'Coordinates distributed transactions via compensating actions.' },
  config:      { name: 'Config Server',  glyph: '🎛️', color: '#a855f7', cap: 20000,   lat: 2,   avail: 0.9995, desc: 'Centralised config and feature flags with hot reload.' },
  tracing:     { name: 'Tracing',        glyph: '🧵', color: '#64748b', cap: 100000,  lat: 1,   avail: 0.999,  desc: 'Jaeger/OpenTelemetry — distributed traces across service hops.' },
}

export const PALETTE_GROUPS = [
  { label: 'Traffic',  types: ['client', 'dns', 'cdn', 'lb', 'gateway', 'ratelimiter', 'bff'] },
  { label: 'Compute',  types: ['web', 'app', 'micro', 'ws', 'worker', 'scheduler'] },
  { label: 'Storage',  types: ['cache', 'sql', 'nosql', 'search', 'blob'] },
  { label: 'Async',    types: ['queue', 'kafka', 'saga'] },
  { label: 'Platform', types: ['registry', 'mesh', 'config', 'zk', 'analytics', 'ml', 'monitor', 'tracing'] },
]
