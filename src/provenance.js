// Where the numbers come from. Every component's capacity / latency /
// availability figure carries a provenance entry with one of three classes:
//
//   benchmark - anchored to widely published performance results
//   vendor    - anchored to vendor documentation, specs or SLA commitments
//   modeled   - an order-of-magnitude engineering estimate, chosen for
//               teaching consistency and honestly labeled as such
//
// The point is trust through honesty, not false precision: the simulator is
// a flight simulator, not the airplane. References use stable documentation
// roots rather than deep links that rot.
import { CATALOG } from './catalog.js'

const R = {
  redis: { label: 'Redis documentation & benchmarks', url: 'https://redis.io/docs/' },
  pg: { label: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/' },
  kafka: { label: 'Apache Kafka documentation', url: 'https://kafka.apache.org/documentation/' },
  nginx: { label: 'NGINX documentation', url: 'https://nginx.org/en/docs/' },
  es: { label: 'Elasticsearch documentation', url: 'https://www.elastic.co/docs' },
  cass: { label: 'Apache Cassandra documentation', url: 'https://cassandra.apache.org/doc/' },
  mongo: { label: 'MongoDB documentation', url: 'https://www.mongodb.com/docs/' },
  rabbit: { label: 'RabbitMQ documentation', url: 'https://www.rabbitmq.com/docs' },
  tfb: { label: 'TechEmpower Framework Benchmarks', url: 'https://www.techempower.com/benchmarks/' },
  awsec2: { label: 'AWS EC2 instance types', url: 'https://aws.amazon.com/ec2/instance-types/' },
  awssla: { label: 'AWS service level agreements', url: 'https://aws.amazon.com/legal/service-level-agreements/' },
  gcpsla: { label: 'Google Cloud SLAs', url: 'https://cloud.google.com/terms/sla' },
  cf: { label: 'Cloudflare docs (CDN / edge)', url: 'https://developers.cloudflare.com/' },
  k8s: { label: 'Kubernetes documentation', url: 'https://kubernetes.io/docs/' },
  prom: { label: 'Prometheus documentation', url: 'https://prometheus.io/docs/' },
  envoy: { label: 'Envoy proxy documentation', url: 'https://www.envoyproxy.io/docs' },
  etcd: { label: 'etcd documentation', url: 'https://etcd.io/docs/' },
  s3: { label: 'Amazon S3 documentation', url: 'https://docs.aws.amazon.com/s3/' },
  anthropic: { label: 'Anthropic API documentation', url: 'https://docs.anthropic.com/' },
  openai: { label: 'OpenAI platform documentation', url: 'https://platform.openai.com/docs/' },
  pinecone: { label: 'Pinecone documentation', url: 'https://docs.pinecone.io/' },
  firecracker: { label: 'Firecracker microVM project', url: 'https://firecracker-microvm.github.io/' },
  clickhouse: { label: 'ClickHouse documentation', url: 'https://clickhouse.com/docs' },
  flink: { label: 'Apache Flink documentation', url: 'https://flink.apache.org/' },
  spark: { label: 'Apache Spark documentation', url: 'https://spark.apache.org/docs/latest/' },
  fcm: { label: 'Firebase Cloud Messaging docs', url: 'https://firebase.google.com/docs/cloud-messaging' },
  airflow: { label: 'Apache Airflow documentation', url: 'https://airflow.apache.org/docs/' },
  vault: { label: 'HashiCorp Vault documentation', url: 'https://developer.hashicorp.com/vault/docs' },
  otel: { label: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
}

// Bespoke provenance for the components whose numbers anchor to public data.
const P = {
  cache: { cls: 'benchmark', refs: [R.redis], basis: 'A single Redis-class node sustains 100k+ simple GET/SET ops/s in published benchmarks; we model a deliberately conservative per-replica figure to account for larger values, pipelining limits and network overhead. Sub-millisecond latency is the documented norm for in-memory reads.' },
  sql: { cls: 'benchmark', refs: [R.pg, R.awsec2], basis: 'OLTP throughput on a well-tuned PostgreSQL-class primary lands in the low thousands of mixed transactions/s on mainstream cloud instances; latency reflects B-tree reads plus WAL-durable writes. Availability reflects a primary with automated failover, not a single box.' },
  nosql: { cls: 'benchmark', refs: [R.cass, R.mongo], basis: 'Partitioned wide-column / document stores scale writes horizontally; the per-replica figure models one partition owner at LOCAL_QUORUM-style consistency. Latency covers commit-log write plus memtable insert.' },
  kafka: { cls: 'benchmark', refs: [R.kafka], basis: 'Kafka-class brokers famously sustain hundreds of MB/s per broker; message-count throughput here assumes small events and acks=all durability. Latency is the produce round-trip, not end-to-end consumer lag.' },
  mq: { cls: 'benchmark', refs: [R.rabbit], basis: 'Classic broker queues (RabbitMQ-class) with persistent messages and publisher confirms land in the tens of thousands of msgs/s per node - an order below log-structured streams, reflecting per-message bookkeeping.' },
  queue: { cls: 'vendor', refs: [R.awssla], basis: 'Managed queues (SQS-class) are effectively unbounded via horizontal partitioning; the modeled cap reflects a single ordered-group hot key, which is where real designs actually bottleneck. Latency is the documented enqueue round-trip.' },
  lb: { cls: 'benchmark', refs: [R.nginx, R.envoy], basis: 'L7 proxies (NGINX/Envoy-class) forward tens of thousands of requests/s per core in published tests; we model a modest multi-core box. Added latency is connection handling plus header parsing - single-digit ms.' },
  cdn: { cls: 'vendor', refs: [R.cf], basis: 'CDN edges absorb traffic across thousands of PoPs; the per-node figure models one PoP serving a hot object from memory. Latency is an edge cache hit; misses pay origin cost, which the simulator routes through your origin nodes.' },
  gateway: { cls: 'benchmark', refs: [R.envoy, R.tfb], basis: 'API gateways add auth, routing and rate-limit checks per request; throughput models a gateway pod at the point where policy evaluation, not proxying, becomes the cost.' },
  app: { cls: 'benchmark', refs: [R.tfb, R.awsec2], basis: 'A business-logic service on a mainstream instance handles low thousands of requests/s when each request does real work (validation, a couple of downstream calls, serialization) - consistent with mid-table TechEmpower results for full-framework workloads.' },
  web: { cls: 'benchmark', refs: [R.tfb], basis: 'Template-rendering web tier; throughput mirrors framework benchmark results for server-rendered pages rather than JSON echoes.' },
  micro: { cls: 'benchmark', refs: [R.tfb], basis: 'A narrowly-scoped microservice does less per request than a monolith endpoint; the figure sits above the app tier accordingly. Latency is one focused operation plus serialization.' },
  worker: { cls: 'modeled', refs: [], basis: 'Background job throughput varies enormously with the job; we model a mid-weight task (a few downstream calls, some compute). Treat the number as a placeholder to overwrite mentally with your actual job cost.' },
  ws: { cls: 'benchmark', refs: [R.nginx], basis: 'Socket tiers are connection-bound, not request-bound: a tuned node holds tens of thousands of concurrent connections; the rps figure models message fan-in per node. Memory per connection, not CPU, is usually the real ceiling.' },
  search: { cls: 'benchmark', refs: [R.es], basis: 'Inverted-index queries on a warm Elasticsearch-class shard return in tens of ms; per-shard query throughput lands in the low thousands for realistic queries (filters + ranking, not term lookups).' },
  blob: { cls: 'vendor', refs: [R.s3], basis: 'Object stores document per-prefix request rates (thousands of GETs/s per prefix on S3) and eleven-nines durability; availability here models the read path SLA, not durability.' },
  vector: { cls: 'vendor', refs: [R.pinecone], basis: 'ANN queries over HNSW-class indexes serve single-digit-to-tens of ms at high recall; per-replica throughput reflects vendor guidance for mid-sized indexes. Insert-heavy workloads behave differently - this models query-side.' },
  llm: { cls: 'vendor', refs: [R.anthropic, R.openai], basis: 'Hosted LLM inference: latency is dominated by output tokens (hundreds of ms to seconds), throughput by provider rate limits rather than your architecture. The modeled cap reflects a production rate-limit tier; the latency a mid-length completion.' },
  embed: { cls: 'vendor', refs: [R.openai], basis: 'Embedding endpoints batch well and return in tens of ms; the cap models a documented requests-per-minute tier translated to steady-state rps.' },
  ml: { cls: 'modeled', refs: [], basis: 'A served classical/deep model at tens of ms per inference on CPU/small-GPU instances. Real numbers swing 100x with model size and hardware - calibrate to your model before trusting cost math.' },
  k8s: { cls: 'vendor', refs: [R.k8s], basis: 'The control-plane figure models API-server request handling and scheduler throughput per the scalability envelopes the Kubernetes project documents (nodes, pods, churn) - data-plane traffic never touches it.' },
  zk: { cls: 'vendor', refs: [R.etcd], basis: 'Consensus stores document write throughput in the low tens of thousands/s per cluster (quorum round-trips bound it) and reads much higher from any member. The figure models mixed coordination traffic.' },
  monitor: { cls: 'vendor', refs: [R.prom], basis: 'A Prometheus-class server documents comfortable ingestion of hundreds of thousands of samples/s per node; the modeled figure translates scrape-and-query load into request terms.' },
  otel: { cls: 'vendor', refs: [R.otel], basis: 'Collector pipelines process spans at high volume per core; the figure models a collector pod with batching and a busy export path.' },
  tsdb: { cls: 'vendor', refs: [R.prom, R.clickhouse], basis: 'Time-series ingestion is append-friendly: per-node sample ingestion in the hundreds of thousands/s is documented across the class; queries over compressed chunks return in tens of ms.' },
  analytics: { cls: 'benchmark', refs: [R.clickhouse], basis: 'Columnar OLAP engines scan billions of rows/s per node in published results; the modeled figure translates dashboard-style aggregate queries into request terms.' },
  stream: { cls: 'vendor', refs: [R.flink], basis: 'Stateful stream processors sustain very high per-core event rates with checkpointing overhead; the figure models a task slot doing keyed aggregation with RocksDB state.' },
  batch: { cls: 'vendor', refs: [R.spark], basis: 'Batch throughput is a cluster property, not a request property; the figure exists so cost math works and models one executor. Judge batch designs by job time, not rps.' },
  sandbox: { cls: 'vendor', refs: [R.firecracker], basis: 'MicroVM sandboxes (Firecracker-class) boot in ~125ms per published project figures; the cap models per-host job starts including image setup - the low number is the isolation tax, and it is the honest headline.' },
  push: { cls: 'vendor', refs: [R.fcm], basis: 'Platform push gateways (FCM/APNs) absorb enormous volume; the modeled cap reflects per-connection send throughput and provider batching guidance rather than any hard limit.' },
  scheduler: { cls: 'vendor', refs: [R.airflow], basis: 'Orchestrator scheduling loops (Airflow-class) documentedly handle task dispatch in the hundreds-to-thousands/s range per scheduler; the figure models dispatch, not the work itself.' },
  secrets: { cls: 'vendor', refs: [R.vault], basis: 'Secret reads from a Vault-class cluster serve in low ms from memory with documented per-node throughput in the thousands/s; unseal and audit-log costs bound writes lower.' },
  edge: { cls: 'vendor', refs: [R.cf], basis: 'Edge function platforms document sub-ms cold starts for isolates and very high per-PoP request rates; the figure models one PoP running light request-time compute.' },
}

const FAMILY_BASIS = {
  benchmarklike: null, // unused; kept for clarity of the three classes above
}

export function getProvenance(type) {
  if (P[type]) return P[type]
  const spec = CATALOG[type]
  return {
    cls: 'modeled',
    refs: [],
    basis: `Order-of-magnitude engineering estimate for a ${spec?.name || type} tier: the capacity, latency and availability figures are chosen to be internally consistent with the rest of the catalog and representative of the class of systems this component stands for, rather than anchored to one product's benchmark. Directionally sound for design reasoning; calibrate before using for real capacity planning.`,
  }
}

export const PROVENANCE_CLASSES = {
  benchmark: { label: 'Benchmark-anchored', hint: 'Tied to widely published performance results' },
  vendor: { label: 'Vendor-documented', hint: 'Tied to vendor docs, specs or SLA commitments' },
  modeled: { label: 'Modeled estimate', hint: 'Order-of-magnitude figure, honestly labeled' },
}
