// Every building block mapped to its equivalent on the four major clouds,
// so a design drawn here can be read as a concrete deployment.
// `mult` is a rough list-price factor applied to the cost estimate.
export const CLOUDS = [
  { id: 'generic', name: 'Generic', short: 'Generic', mult: 1.00 },
  { id: 'aws',     name: 'AWS',     short: 'AWS',     mult: 1.00 },
  { id: 'gcp',     name: 'Google Cloud', short: 'GCP', mult: 0.95 },
  { id: 'azure',   name: 'Azure',   short: 'Azure',   mult: 1.02 },
  { id: 'oci',     name: 'Oracle Cloud', short: 'OCI', mult: 0.72 },
  { id: 'apple',   name: 'Apple', short: 'Apple', mult: 0.85 },
]
export const cloudById = id => CLOUDS.find(c => c.id === id) || CLOUDS[0]

// type: [AWS, GCP, Azure, OCI]
export const CLOUD_MAP = {
  client: ['End user / device', 'End user / device', 'End user / device', 'End user / device', 'Apple device / Safari'],
  // traffic & edge
  dns: ['Route 53', 'Cloud DNS', 'Azure DNS', 'OCI DNS', 'iCloud Private Relay DNS'],
  gslb: ['Route 53 + Global Accelerator', 'Global Cloud Load Balancing', 'Front Door / Traffic Manager', 'Traffic Management Steering', 'Apple edge / Anycast (internal)'],
  waf: ['AWS WAF + Shield', 'Cloud Armor', 'Azure WAF + DDoS Protection', 'OCI WAF', 'Apple edge protection (internal)'],
  cdn: ['CloudFront', 'Cloud CDN', 'Azure CDN / Front Door', 'OCI CDN', 'Apple Edge Cache'],
  edge: ['CloudFront Functions / Lambda@Edge', 'Cloud Run + Cloud CDN', 'Front Door Rules Engine', 'OCI Functions + CDN', 'Apple Edge Cache logic (internal)'],
  lb: ['ALB / NLB', 'Cloud Load Balancing', 'Load Balancer / App Gateway', 'OCI Load Balancer', 'Apple front-end LB (internal)'],
  gateway: ['API Gateway', 'API Gateway / Apigee', 'API Management', 'OCI API Gateway', 'CloudKit Web Services API'],
  k8sgw: ['EKS Gateway API (Envoy Gateway/Istio)', 'GKE Gateway API', 'AKS Application Gateway for Containers', 'OKE Gateway API add-on', 'no public equivalent'],
  grpcgw: ['API Gateway (gRPC HTTP integration)', 'Cloud Endpoints ESPv2', 'APIM with gRPC pass-through', 'OCI API Gateway gRPC', 'no public equivalent'],
  graphql: ['AppSync', 'Apigee GraphQL', 'APIM GraphQL', 'Apollo on OCI Compute', 'no public equivalent'],
  ratelimiter: ['API Gateway usage plans / WAF rules', 'Cloud Armor rate limiting', 'APIM rate-limit policy', 'API Gateway rate limiting', 'CloudKit request quotas'],
  bff: ['ECS Fargate / Lambda', 'Cloud Run', 'App Service / Container Apps', 'OCI Container Instances', 'App-side logic / Swift server'],
  tenant: ['ALB host/path routing', 'Cloud LB URL maps', 'App Gateway routing rules', 'OCI LB routing policies', 'CloudKit container'],
  // compute
  web: ['EC2 / Elastic Beanstalk', 'Compute Engine / App Engine', 'Virtual Machines / App Service', 'OCI Compute', 'Swift on Server (Vapor)'],
  app: ['EC2 / ECS Fargate', 'Compute Engine / Cloud Run', 'App Service / Container Apps', 'OCI Compute', 'Swift on Server (Vapor)'],
  micro: ['ECS / EKS', 'GKE / Cloud Run', 'AKS / Container Apps', 'OKE', 'Swift on Server (Vapor)'],
  grpc: ['ECS / EKS with App Mesh', 'GKE with Traffic Director', 'AKS with Dapr/Envoy sidecar', 'OKE with Service Mesh', 'Swift gRPC on Server (Vapor)'],
  ws: ['API Gateway WebSockets', 'Cloud Run (WebSockets)', 'Web PubSub / SignalR', 'OCI Compute + LB', 'APNs persistent channel'],
  worker: ['ECS tasks / Lambda / Batch', 'Cloud Run jobs / Dataflow', 'Container Apps jobs / Functions', 'OCI Functions / Container Instances', 'Background Tasks / server-side Swift'],
  scheduler: ['EventBridge Scheduler', 'Cloud Scheduler', 'Logic Apps / timer Functions', 'OCI Resource Scheduler', 'BGTaskScheduler / cron'],
  k8s: ['EKS', 'GKE', 'AKS', 'OKE', 'no public equivalent'],
  saga: ['Step Functions', 'Workflows', 'Durable Functions', 'OCI Functions + state store', 'app-orchestrated (no managed service)'],
  // storage
  cache: ['ElastiCache for Redis', 'Memorystore', 'Azure Cache for Redis', 'OCI Cache with Redis', 'NSCache / on-device + edge cache'],
  sql: ['RDS / Aurora', 'Cloud SQL / AlloyDB', 'Azure SQL / PostgreSQL', 'Autonomous DB / MySQL HeatWave', 'Core Data + CloudKit sync'],
  nosql: ['DynamoDB', 'Firestore / Bigtable', 'Cosmos DB', 'OCI NoSQL Database', 'CloudKit Database (public/private)'],
  search: ['OpenSearch Service', 'Vertex AI Search', 'Azure AI Search', 'OCI Search with OpenSearch', 'Core Spotlight / CloudKit query'],
  blob: ['S3', 'Cloud Storage', 'Blob Storage', 'OCI Object Storage', 'CloudKit Assets / iCloud Drive'],
  backup: ['AWS Backup', 'Backup and DR Service', 'Azure Backup', 'OCI Backup', 'iCloud Backup'],
  // async & integration
  queue: ['SQS', 'Pub/Sub', 'Service Bus', 'OCI Queue', 'no public equivalent'],
  kafka: ['MSK / Kinesis Data Streams', 'Pub/Sub / Managed Kafka', 'Event Hubs', 'OCI Streaming', 'no public equivalent'],
  mq: ['Amazon MQ', 'Pub/Sub + partner MQ', 'Service Bus (transactional)', 'OCI Queue / partner MQ', 'no public equivalent'],
  esb: ['EventBridge + Step Functions', 'Application Integration', 'Logic Apps / Integration Services', 'OCI Integration Cloud', 'no public equivalent'],
  // data
  cdc: ['DMS', 'Datastream', 'Data Factory CDC', 'GoldenGate', 'CloudKit change tokens'],
  etl: ['Glue / EMR', 'Dataflow / Dataproc', 'Data Factory / Synapse', 'OCI Data Integration', 'no public equivalent'],
  lake: ['S3 + Lake Formation', 'Cloud Storage + BigLake', 'Data Lake Storage Gen2', 'OCI Data Lake', 'no public equivalent'],
  warehouse: ['Redshift', 'BigQuery', 'Synapse / Fabric', 'Autonomous Data Warehouse', 'no public equivalent'],
  bi: ['QuickSight', 'Looker', 'Power BI', 'OCI Analytics Cloud', 'App Store Connect Analytics'],
  analytics: ['Managed Flink / EMR', 'Dataflow', 'Stream Analytics', 'GoldenGate Stream Analytics', 'App Analytics / MetricKit'],
  billing: ['Marketplace Metering + custom', 'Cloud Billing API + custom', 'Metering API + custom', 'OCI Metering + custom', 'StoreKit 2 / In-App Purchase'],
  // AI / ML
  ml: ['SageMaker', 'Vertex AI', 'Azure Machine Learning', 'OCI Data Science', 'Core ML / Create ML'],
  embed: ['Bedrock embeddings', 'Vertex AI Embeddings', 'Azure OpenAI embeddings', 'OCI Generative AI', 'Natural Language embeddings'],
  vector: ['OpenSearch k-NN / Aurora pgvector', 'Vertex AI Vector Search', 'Azure AI Search vectors', 'Oracle 23ai AI Vector Search', 'Core ML vector index (on-device)'],
  llm: ['Bedrock', 'Vertex AI (Gemini)', 'Azure OpenAI', 'OCI Generative AI', 'Apple Intelligence / Foundation Models'],
  guard: ['Bedrock Guardrails / Comprehend', 'Model Armor / Sensitive Data Protection', 'Azure AI Content Safety', 'OCI Language + policy', 'Apple Intelligence safety filters'],
  // observability
  otel: ['ADOT Collector', 'Ops Agent / OTel Collector', 'Azure Monitor OTel', 'OCI Monitoring agent', 'MetricKit / os_signpost'],
  monitor: ['CloudWatch', 'Cloud Monitoring', 'Azure Monitor', 'OCI Monitoring', 'Xcode Organizer / MetricKit'],
  logs: ['CloudWatch Logs', 'Cloud Logging', 'Log Analytics', 'OCI Logging', 'Unified Logging (OSLog)'],
  tracing: ['X-Ray', 'Cloud Trace', 'Application Insights', 'OCI APM', 'os_signpost / Instruments'],
  slo: ['CloudWatch Application Signals', 'Cloud Monitoring SLOs', 'Azure Monitor SLO workbooks', 'OCI Monitoring alarms', 'no public equivalent'],
  alert: ['SNS + Incident Manager', 'Cloud Monitoring alerting', 'Azure Monitor alerts', 'OCI Notifications', 'no public equivalent'],
  synthetic: ['CloudWatch Synthetics', 'Uptime checks', 'App Insights availability tests', 'OCI APM synthetics', 'no public equivalent'],
  apm: ['CloudWatch RUM', 'Firebase Performance Monitoring', 'App Insights browser RUM', 'OCI APM RUM', 'MetricKit + Xcode Organizer'],
  // security
  iam: ['Cognito / IAM Identity Center', 'Identity Platform / Cloud Identity', 'Microsoft Entra ID', 'OCI IAM Identity Domains', 'Sign in with Apple'],
  secrets: ['Secrets Manager + KMS', 'Secret Manager + Cloud KMS', 'Key Vault', 'OCI Vault', 'Keychain + Secure Enclave'],
  pii: ['Macie + tokenization', 'Sensitive Data Protection (DLP)', 'Purview + Presidio', 'OCI Data Safe', 'Private Cloud Compute / Data Vault'],
  audit: ['CloudTrail', 'Cloud Audit Logs', 'Azure Activity Log', 'OCI Audit', 'no public equivalent'],
  siem: ['Security Lake + OpenSearch', 'Google SecOps (Chronicle)', 'Microsoft Sentinel', 'OCI Logging Analytics', 'no public equivalent'],
  // platform
  registry: ['Cloud Map', 'Cloud Service Mesh directory', 'AKS DNS / Service Fabric naming', 'OCI Service Mesh discovery', 'Bonjour / mDNS'],
  mesh: ['App Mesh / Istio on EKS', 'Cloud Service Mesh', 'Istio add-on for AKS', 'OCI Service Mesh', 'no public equivalent'],
  config: ['AppConfig / Parameter Store', 'Runtime Config / Remote Config', 'App Configuration', 'OCI Vault + config store', 'CloudKit records / Remote Config pattern'],
  zk: ['self-managed ZooKeeper / etcd', 'self-managed etcd', 'self-managed etcd', 'self-managed etcd', 'no public equivalent'],
  cicd: ['CodePipeline / CodeBuild', 'Cloud Build / Cloud Deploy', 'Azure DevOps / GitHub Actions', 'OCI DevOps', 'Xcode Cloud'],
  // enterprise
  erp: ['SAP on AWS (RISE)', 'SAP on Google Cloud', 'SAP on Azure', 'SAP on OCI', 'no public equivalent'],
  crm: ['Salesforce + AppFlow', 'Salesforce + Cortex Framework', 'Dynamics 365 / Power Platform', 'Salesforce + OCI Integration', 'no public equivalent'],
  mainframe: ['Mainframe Modernization', 'Dual Run / mainframe connectors', 'Host Integration Server', 'OCI Compute + partner', 'no public equivalent'],
  mft: ['AWS Transfer Family', 'Storage Transfer Service', 'Data Factory SFTP / Logic Apps', 'OCI Object Storage + MFT partner', 'iCloud Drive / CloudKit Assets'],
  partner: ['PrivateLink / partner API', 'Private Service Connect / partner API', 'Private Link / partner API', 'Private Endpoint / partner API', 'Apple Pay / third-party API'],
  hsm: ['CloudHSM', 'Cloud HSM', 'Managed HSM / Dedicated HSM', 'OCI Key Management (HSM)', 'Secure Enclave / HSM-backed keys'],
  tls: ['ACM on ALB / CloudFront', 'Certificate Manager on Cloud LB', 'App Gateway / Front Door TLS', 'OCI Certificates on LB', 'Apple edge TLS termination'],
  crypto: ['KMS envelope encryption', 'Cloud KMS + Tink', 'Key Vault / Managed HSM keys', 'OCI Vault (AES-256)', 'CryptoKit + Data Protection classes'],
  hash: ['Cognito / app-side Argon2id', 'Identity Platform / app-side Argon2id', 'Entra ID / app-side Argon2id', 'IDCS / app-side Argon2id', 'Secure Enclave-backed SRP'],
  digest: ['Application SHA-256 / S3 checksums', 'Application SHA-256 / GCS CRC32C', 'Application SHA-256 / Blob MD5', 'Application SHA-256 / OCI checksums', 'CryptoKit SHA-256'],
  sign: ['KMS asymmetric sign / SigV4', 'Cloud KMS asymmetric sign', 'Key Vault signing keys', 'OCI Vault signing keys', 'App Attest / DeviceCheck'],
  e2ee: ['Wickr / client-side libsodium', 'client-side Tink + Cloud KMS', 'client-side MSAL + Key Vault', 'client-side libsodium + OCI Vault', 'iMessage / Advanced Data Protection'],
  graph: ['Neptune', 'Spanner Graph', 'Cosmos DB Gremlin', 'Oracle Graph', '—'],
  tsdb: ['Amazon Timestream', 'Cloud Monitoring', 'Azure Data Explorer', 'Oracle TimesTen', '—'],
  featureflag: ['AWS AppConfig', 'Firebase Remote Config', 'Azure App Configuration', 'OCI Config', '—'],
  featurestore: ['SageMaker Feature Store', 'Vertex AI Feature Store', 'Azure ML feature store', 'OCI Data Science', '—'],
  stream: ['Kinesis Data Analytics', 'Dataflow', 'Azure Stream Analytics', 'OCI GoldenGate Stream', '—'],
  batch: ['EMR', 'Dataproc', 'Azure HDInsight', 'OCI Data Flow', '—'],
  transcode: ['MediaConvert', 'Transcoder API', 'Azure Media Services', 'OCI Media Flow', '—'],
  sandbox: ['Firecracker on EC2', 'gVisor on GKE', 'Azure Container Instances', 'OCI Container Instances', '—'],
  geoidx: ['ElastiCache + H3', 'Redis Geo on Memorystore', 'Azure Cache geo', 'OCI Cache', '—'],
  push: ['SNS / SES / Pinpoint', 'Firebase Cloud Messaging', 'Azure Notification Hubs', 'OCI Notifications', 'APNs'],
  containerreg: ['ECR', 'Artifact Registry', 'Azure Container Registry', 'OCI Registry', '—'],
  bastion: ['EC2 bastion / SSM', 'IAP TCP forwarding', 'Azure Bastion', 'OCI Bastion', '—'],
  // quality & testing
  e2e:        ['CodeBuild + Selenium Grid', 'Cloud Build + Playwright', 'Azure Pipelines + Playwright', 'OCI DevOps + Selenium', 'XCTest / Xcode Cloud'],
  apitest:    ['CodeBuild + Newman', 'Cloud Build + Newman', 'Azure Pipelines + REST Assured', 'OCI DevOps + Newman', 'XCTest network tests'],
  load:       ['Distributed Load Testing on AWS', 'k6 / JMeter on GKE', 'Azure Load Testing', 'k6 / JMeter on OCI Compute', 'no public equivalent'],
  contract:   ['Pact Broker on ECS', 'Pact Broker on Cloud Run', 'Pact Broker on Container Apps', 'Pact Broker on OKE', 'no public equivalent'],
  mock:       ['API Gateway mock integrations', 'Apigee mock targets', 'APIM mock policies', 'OCI API Gateway stock responses', 'no public equivalent'],
  testdata:   ['RDS snapshots + Glue masking', 'Cloud SQL clones + DLP masking', 'Azure SQL copy + Purview masking', 'Autonomous DB clone + Data Safe', 'no public equivalent'],
  qgate:      ['CodeGuru + SonarQube', 'Cloud Build + SonarQube', 'Azure DevOps code analysis', 'OCI DevOps + SonarQube', 'Xcode static analyzer'],
  dast:       ['Inspector + OWASP ZAP', 'Web Security Scanner', 'Defender for Cloud DAST', 'OCI Vulnerability Scanning', 'no public equivalent'],
  devicefarm: ['AWS Device Farm', 'Firebase Test Lab', 'Azure Test Plans + BrowserStack', 'BrowserStack on OCI', 'Xcode Cloud test devices'],
  testops:    ['CodeBuild test reports', 'Cloud Build + Looker', 'Azure Test Plans', 'OCI DevOps reports', 'Xcode Cloud test reports'],
  // Google AI & LLMs
  gemini3:    ['Bedrock / Claude API', 'Gemini 3 Pro (native)', 'OpenAI API / Azure OpenAI', 'Bedrock Claude on OCI', 'no public equivalent'],
  gemini2:    ['Bedrock / Claude API', 'Gemini 2.5 (native)', 'OpenAI GPT-4 / Azure OpenAI', 'Bedrock on OCI', 'no public equivalent'],
  notebooklm: ['no equivalent', 'NotebookLM (native)', 'Azure AI Document Intelligence', 'no equivalent', 'no public equivalent'],
  antigravity:['no equivalent', 'Antigravity IDE (native, Nov 2025)', 'GitHub Copilot Workspace', 'no equivalent', 'no public equivalent'],
  vertexai:   ['SageMaker', 'Vertex AI (native)', 'Azure ML', 'OCI Data Science', 'no public equivalent'],
  imagen:     ['Bedrock Titan Image', 'Imagen 4 (native)', 'Azure OpenAI DALL-E-3', 'no equivalent', 'no public equivalent'],
  veo:        ['Bedrock (limited)', 'Veo 3 (native)', 'no equivalent', 'no equivalent', 'no public equivalent'],
  astra:      ['no equivalent', 'Project Astra / Gemini Live (native)', 'no equivalent', 'no equivalent', 'no public equivalent'],
  mariner:    ['no equivalent', 'Project Mariner / Agent Mode (native)', 'no equivalent', 'no equivalent', 'no public equivalent'],
  beam:       ['no equivalent', 'Google Beam (native)', 'Azure Spaces / Teams Premium', 'no equivalent', 'no public equivalent'],
  gemmaos:    ['no equivalent', 'Gemma (native open-source)', 'Phi on-device', 'no equivalent', 'no public equivalent'],
  duetai:     ['CodeWhisperer in console', 'Duet AI in Console (native)', 'GitHub Copilot in Azure Portal', 'no equivalent', 'no public equivalent'],
  aiagent:    ['SageMaker Agent', 'Vertex AI Agent Builder (native)', 'Azure AI Orchestration', 'OCI Generative AI Agents', 'no public equivalent'],
  agentgraph: ['Bedrock Agents / LangGraph on ECS', 'Vertex Agent Builder / LangGraph on GKE', 'Azure AI Agent Service', 'LangGraph on OKE', 'no public equivalent'],
  finetune:   ['SageMaker Training (LoRA)', 'Vertex AI Tuning', 'Azure ML Fine-tuning', 'OCI Data Science Jobs', 'MLX fine-tuning on Apple silicon'],
  llmobs:     ['Langfuse on ECS / Bedrock traces', 'Langfuse on GKE / Vertex eval', 'Azure AI Foundry tracing', 'Langfuse on OKE', 'no public equivalent'],
}

const IDX = { aws: 0, gcp: 1, azure: 2, oci: 3, apple: 4 }

// Concrete service name for a component type on the selected cloud ('' when generic)
export function serviceName(type, cloudId) {
  if (!cloudId || cloudId === 'generic') return ''
  const row = CLOUD_MAP[type]
  if (!row) return ''
  return row[IDX[cloudId]] || ''
}

export const readCloud = () => {
  try { const v = localStorage.getItem('archsim.cloud'); if (CLOUDS.some(c => c.id === v)) return v } catch {}
  return 'generic'
}
export const saveCloud = v => { try { localStorage.setItem('archsim.cloud', v) } catch {} }
