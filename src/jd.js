// ── JD Planner ──────────────────────────────────────────────────────────────
// Paste a job description; get a deterministic practice plan: which of the
// studio's designs and drills cover each skill the JD names, with deep links.
// No model in the loop - a JD is a list of nouns, and nouns match patterns.
// Pure, suite-tested; the UI renders what this returns.

export const JD_SKILLS = [
  { id: 'rag', label: 'RAG pipelines', rx: /\b(rag|retrieval[- ]augmented|semantic (search|retrieval)|knowledge retrieval|embeddings?)\b/i,
    tpls: ['GenAI: RAG Assistant', 'SaaS AI Copilot (Multi-tenant RAG)'], concepts: ['rag-diagnose', 'grounded-halluc', 'rag-vs-ft'], acr: ['RAG'] },
  { id: 'vector', label: 'Vector databases', rx: /\b(vector (db|database|store)s?|pinecone|chroma(db)?|qdrant|faiss|weaviate|pgvector|milvus)\b/i,
    tpls: ['SaaS AI Copilot (Multi-tenant RAG)', 'GenAI: RAG Assistant'], concepts: ['vector-db-choice'], acr: ['HNSW', 'ANN', 'FAISS'] },
  { id: 'llm-api', label: 'LLM APIs & serving', rx: /\b(llms?|large language|generative ai|genai|openai|anthropic|azure openai|hugging ?face|inference)\b/i,
    tpls: ['LLM API Platform (FastAPI)'], concepts: ['one-gpu', 'cost-spike', 'halluc-triangle'], acr: ['LLM'] },
  { id: 'agents', label: 'Agents & orchestration', rx: /\b(agents?|agentic|langchain|langgraph|llamaindex|orchestration|tool[- ]calling|function calling)\b/i,
    tpls: ['Agentic Workflow (Tools)'], concepts: ['agent-loops', 'tool-select', 'orchestration-frameworks', 'prompt-injection'], acr: [] },
  { id: 'fastapi', label: 'Python services (FastAPI)', rx: /\b(fastapi|flask|django|python (backend|services?)|rest apis?|microservices?)\b/i,
    tpls: ['LLM API Platform (FastAPI)', 'µsvc: E-commerce (Saga)'], concepts: ['rate-limiting', 'rest-graphql', 'versioning'], acr: ['REST'] },
  { id: 'saas', label: 'SaaS & multi-tenancy', rx: /\b(saas|multi[- ]?tenant|tenants?|b2b product)\b/i,
    tpls: ['SaaS AI Copilot (Multi-tenant RAG)'], concepts: ['tenant-isolation', 'feature-flags'], acr: [] },
  { id: 'evals', label: 'Evaluation & monitoring', rx: /\b(evals?|evaluation|monitoring|observability|testing|quality)\b/i,
    tpls: ['AI Search (Perplexity)'], concepts: ['llm-evals', 'metrics', 'tracing'], acr: ['SLO'] },
  { id: 'prompting', label: 'Prompt engineering & safety', rx: /\b(prompt engineering|prompts?|guardrails?|safety|injection)\b/i,
    tpls: ['Agentic Workflow (Tools)'], concepts: ['prompt-injection', 'grounded-halluc'], acr: [] },
  { id: 'finetune', label: 'Fine-tuning & inference optimization', rx: /\b(fine[- ]?tun(e|ing)|lora|quantiz|inference optimi[sz]ation|distill)\b/i,
    tpls: ['LLM API Platform (FastAPI)'], concepts: ['rag-vs-ft', 'one-gpu'], acr: [] },
  { id: 'streams', label: 'Streaming & async', rx: /\b(kafka|streaming|event[- ]driven|message queues?|pub\/?sub|async)\b/i,
    tpls: ['Chat (WhatsApp)'], concepts: ['brokers', 'event-driven', 'task-queues'], acr: [] },
  { id: 'cloud', label: 'Cloud & containers', rx: /\b(aws|azure|gcp|google cloud|kubernetes|k8s|docker|containers?)\b/i,
    tpls: ['Cloud-Native Gateway API Platform'], concepts: ['horizontal', 'redundancy'], acr: [] },
  { id: 'cicd', label: 'CI/CD & MLOps', rx: /\b(ci\/?cd|mlops|deployment|deploy|release|pipelines?)\b/i,
    tpls: [], concepts: ['release-strategies', 'feature-flags', 'expand-contract'], acr: ['MLOps'] },
  { id: 'data', label: 'Distributed systems & data', rx: /\b(distributed systems?|scalab(le|ility)|databases?|sql|nosql|caching|cache)\b/i,
    tpls: ['Amazon (marketplace)'], concepts: ['partitioning', 'consistency', 'cache-strategies', 'cap'], acr: [] },
  { id: 'docs', label: 'Document processing & NLP', rx: /\b(document processing|ocr|nlp|natural language|text extraction|parsing)\b/i,
    tpls: ['SaaS AI Copilot (Multi-tenant RAG)'], concepts: ['grounded-halluc'], acr: [] },
  { id: 'vision', label: 'Computer vision', rx: /\b(computer vision|image (recognition|classification)|cv\b|video analysis)\b/i,
    tpls: ['News Feed (Instagram)'], concepts: [], acr: [] },
  { id: 'payments', label: 'Payments & fintech', rx: /\b(payments?|fintech|ledger|upi|banking|cards?)\b/i,
    tpls: ['Card Payments (Auth + Settlement)', 'UPI Switch (NPCI)'], concepts: ['consistency'], acr: ['UPI', 'PCI DSS'] },
]

// tplExists / conceptExists let the plan stay honest if content is renamed.
export function planFromJD(text, { templateNames = null, conceptIds = null } = {}) {
  const t = (text || '').trim()
  if (t.length < 40) return null
  const matched = []
  for (const sk of JD_SKILLS) {
    const hits = t.match(new RegExp(sk.rx.source, 'gi')) || []
    if (!hits.length) continue
    const tpls = sk.tpls.filter(n => !templateNames || templateNames.includes(n))
    const concepts = sk.concepts.filter(c => !conceptIds || conceptIds.includes(c))
    matched.push({ ...sk, hits: hits.length, evidence: [...new Set(hits.map(h => h.toLowerCase()))].slice(0, 4), tpls, concepts })
  }
  matched.sort((a, b) => b.hits - a.hits)
  const tplSet = [...new Set(matched.flatMap(m => m.tpls))]
  const conceptSet = [...new Set(matched.flatMap(m => m.concepts))]
  const acrSet = [...new Set(matched.flatMap(m => m.acr))]
  const years = t.match(/(\d+)\s*[-–to]+\s*(\d+)\s*years?/i) || t.match(/(\d+)\+?\s*years?/i)
  return {
    matched,
    templates: tplSet,
    concepts: conceptSet,
    acronyms: acrSet,
    seniority: years ? years[0] : null,
    coverage: matched.length ? Math.round((matched.filter(m => m.tpls.length || m.concepts.length).length / matched.length) * 100) : 0,
  }
}
