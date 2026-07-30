// Every building block mapped to its equivalent on the four major clouds,
// so a design drawn here can be read as a concrete deployment.
// `mult` is a rough list-price factor applied to the cost estimate.
export const CLOUDS = [
  { id: 'generic', name: 'Generic', short: 'Generic', mult: 1.00 },
  { id: 'aws',     name: 'AWS',     short: 'AWS',     mult: 1.00 },
  { id: 'gcp',     name: 'Google Cloud', short: 'GCP', mult: 0.95 },
  { id: 'azure',   name: 'Azure',   short: 'Azure',   mult: 1.02 },
  { id: 'oci',     name: 'Oracle Cloud', short: 'OCI', mult: 0.72 },
]
export const cloudById = id => CLOUDS.find(c => c.id === id) || CLOUDS[0]

// type: [AWS, GCP, Azure, OCI]
export const CLOUD_MAP = {
  client:      ['End user / device', 'End user / device', 'End user / device', 'End user / device'],
  // traffic & edge
  dns:         ['Route 53', 'Cloud DNS', 'Azure DNS', 'OCI DNS'],
  gslb:        ['Route 53 + Global Accelerator', 'Global Cloud Load Balancing', 'Front Door / Traffic Manager', 'Traffic Management Steering'],
  waf:         ['AWS WAF + Shield', 'Cloud Armor', 'Azure WAF + DDoS Protection', 'OCI WAF'],
  cdn:         ['CloudFront', 'Cloud CDN', 'Azure CDN / Front Door', 'OCI CDN'],
  edge:        ['CloudFront Functions / Lambda@Edge', 'Cloud Run + Cloud CDN', 'Front Door Rules Engine', 'OCI Functions + CDN'],
  lb:          ['ALB / NLB', 'Cloud Load Balancing', 'Load Balancer / App Gateway', 'OCI Load Balancer'],
  gateway:     ['API Gateway', 'API Gateway / Apigee', 'API Management', 'OCI API Gateway'],
  graphql:     ['AppSync', 'Apigee GraphQL', 'APIM GraphQL', 'Apollo on OCI Compute'],
  ratelimiter: ['API Gateway usage plans / WAF rules', 'Cloud Armor rate limiting', 'APIM rate-limit policy', 'API Gateway rate limiting'],
  bff:         ['ECS Fargate / Lambda', 'Cloud Run', 'App Service / Container Apps', 'OCI Container Instances'],
  tenant:      ['ALB host/path routing', 'Cloud LB URL maps', 'App Gateway routing rules', 'OCI LB routing policies'],
  // compute
  web:         ['EC2 / Elastic Beanstalk', 'Compute Engine / App Engine', 'Virtual Machines / App Service', 'OCI Compute'],
  app:         ['EC2 / ECS Fargate', 'Compute Engine / Cloud Run', 'App Service / Container Apps', 'OCI Compute'],
  micro:       ['ECS / EKS', 'GKE / Cloud Run', 'AKS / Container Apps', 'OKE'],
  ws:          ['API Gateway WebSockets', 'Cloud Run (WebSockets)', 'Web PubSub / SignalR', 'OCI Compute + LB'],
  worker:      ['ECS tasks / Lambda / Batch', 'Cloud Run jobs / Dataflow', 'Container Apps jobs / Functions', 'OCI Functions / Container Instances'],
  scheduler:   ['EventBridge Scheduler', 'Cloud Scheduler', 'Logic Apps / timer Functions', 'OCI Resource Scheduler'],
  k8s:         ['EKS', 'GKE', 'AKS', 'OKE'],
  saga:        ['Step Functions', 'Workflows', 'Durable Functions', 'OCI Functions + state store'],
  // storage
  cache:       ['ElastiCache for Redis', 'Memorystore', 'Azure Cache for Redis', 'OCI Cache with Redis'],
  sql:         ['RDS / Aurora', 'Cloud SQL / AlloyDB', 'Azure SQL / PostgreSQL', 'Autonomous DB / MySQL HeatWave'],
  nosql:       ['DynamoDB', 'Firestore / Bigtable', 'Cosmos DB', 'OCI NoSQL Database'],
  search:      ['OpenSearch Service', 'Vertex AI Search', 'Azure AI Search', 'OCI Search with OpenSearch'],
  blob:        ['S3', 'Cloud Storage', 'Blob Storage', 'OCI Object Storage'],
  backup:      ['AWS Backup', 'Backup and DR Service', 'Azure Backup', 'OCI Backup'],
  // async & integration
  queue:       ['SQS', 'Pub/Sub', 'Service Bus', 'OCI Queue'],
  kafka:       ['MSK / Kinesis Data Streams', 'Pub/Sub / Managed Kafka', 'Event Hubs', 'OCI Streaming'],
  mq:          ['Amazon MQ', 'Pub/Sub + partner MQ', 'Service Bus (transactional)', 'OCI Queue / partner MQ'],
  esb:         ['EventBridge + Step Functions', 'Application Integration', 'Logic Apps / Integration Services', 'OCI Integration Cloud'],
  // data
  cdc:         ['DMS', 'Datastream', 'Data Factory CDC', 'GoldenGate'],
  etl:         ['Glue / EMR', 'Dataflow / Dataproc', 'Data Factory / Synapse', 'OCI Data Integration'],
  lake:        ['S3 + Lake Formation', 'Cloud Storage + BigLake', 'Data Lake Storage Gen2', 'OCI Data Lake'],
  warehouse:   ['Redshift', 'BigQuery', 'Synapse / Fabric', 'Autonomous Data Warehouse'],
  bi:          ['QuickSight', 'Looker', 'Power BI', 'OCI Analytics Cloud'],
  analytics:   ['Managed Flink / EMR', 'Dataflow', 'Stream Analytics', 'GoldenGate Stream Analytics'],
  billing:     ['Marketplace Metering + custom', 'Cloud Billing API + custom', 'Metering API + custom', 'OCI Metering + custom'],
  // AI / ML
  ml:          ['SageMaker', 'Vertex AI', 'Azure Machine Learning', 'OCI Data Science'],
  embed:       ['Bedrock embeddings', 'Vertex AI Embeddings', 'Azure OpenAI embeddings', 'OCI Generative AI'],
  vector:      ['OpenSearch k-NN / Aurora pgvector', 'Vertex AI Vector Search', 'Azure AI Search vectors', 'Oracle 23ai AI Vector Search'],
  llm:         ['Bedrock', 'Vertex AI (Gemini)', 'Azure OpenAI', 'OCI Generative AI'],
  guard:       ['Bedrock Guardrails / Comprehend', 'Model Armor / Sensitive Data Protection', 'Azure AI Content Safety', 'OCI Language + policy'],
  // observability
  otel:        ['ADOT Collector', 'Ops Agent / OTel Collector', 'Azure Monitor OTel', 'OCI Monitoring agent'],
  monitor:     ['CloudWatch', 'Cloud Monitoring', 'Azure Monitor', 'OCI Monitoring'],
  logs:        ['CloudWatch Logs', 'Cloud Logging', 'Log Analytics', 'OCI Logging'],
  tracing:     ['X-Ray', 'Cloud Trace', 'Application Insights', 'OCI APM'],
  slo:         ['CloudWatch Application Signals', 'Cloud Monitoring SLOs', 'Azure Monitor SLO workbooks', 'OCI Monitoring alarms'],
  alert:       ['SNS + Incident Manager', 'Cloud Monitoring alerting', 'Azure Monitor alerts', 'OCI Notifications'],
  synthetic:   ['CloudWatch Synthetics', 'Uptime checks', 'App Insights availability tests', 'OCI APM synthetics'],
  apm:         ['CloudWatch RUM', 'Firebase Performance Monitoring', 'App Insights browser RUM', 'OCI APM RUM'],
  // security
  iam:         ['Cognito / IAM Identity Center', 'Identity Platform / Cloud Identity', 'Microsoft Entra ID', 'OCI IAM Identity Domains'],
  secrets:     ['Secrets Manager + KMS', 'Secret Manager + Cloud KMS', 'Key Vault', 'OCI Vault'],
  pii:         ['Macie + tokenization', 'Sensitive Data Protection (DLP)', 'Purview + Presidio', 'OCI Data Safe'],
  audit:       ['CloudTrail', 'Cloud Audit Logs', 'Azure Activity Log', 'OCI Audit'],
  siem:        ['Security Lake + OpenSearch', 'Google SecOps (Chronicle)', 'Microsoft Sentinel', 'OCI Logging Analytics'],
  // platform
  registry:    ['Cloud Map', 'Cloud Service Mesh directory', 'AKS DNS / Service Fabric naming', 'OCI Service Mesh discovery'],
  mesh:        ['App Mesh / Istio on EKS', 'Cloud Service Mesh', 'Istio add-on for AKS', 'OCI Service Mesh'],
  config:      ['AppConfig / Parameter Store', 'Runtime Config / Remote Config', 'App Configuration', 'OCI Vault + config store'],
  zk:          ['self-managed ZooKeeper / etcd', 'self-managed etcd', 'self-managed etcd', 'self-managed etcd'],
  cicd:        ['CodePipeline / CodeBuild', 'Cloud Build / Cloud Deploy', 'Azure DevOps / GitHub Actions', 'OCI DevOps'],
  // enterprise
  erp:         ['SAP on AWS (RISE)', 'SAP on Google Cloud', 'SAP on Azure', 'SAP on OCI'],
  crm:         ['Salesforce + AppFlow', 'Salesforce + Cortex Framework', 'Dynamics 365 / Power Platform', 'Salesforce + OCI Integration'],
  mainframe:   ['Mainframe Modernization', 'Dual Run / mainframe connectors', 'Host Integration Server', 'OCI Compute + partner'],
  mft:         ['AWS Transfer Family', 'Storage Transfer Service', 'Data Factory SFTP / Logic Apps', 'OCI Object Storage + MFT partner'],
  partner:     ['PrivateLink / partner API', 'Private Service Connect / partner API', 'Private Link / partner API', 'Private Endpoint / partner API'],
  hsm:         ['CloudHSM', 'Cloud HSM', 'Managed HSM / Dedicated HSM', 'OCI Key Management (HSM)'],
}

const IDX = { aws: 0, gcp: 1, azure: 2, oci: 3 }

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
