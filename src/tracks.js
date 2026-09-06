// ── Tracks ──────────────────────────────────────────────────────────────────
// roadmap.sh tells you WHAT to learn; the studio is WHERE to practice it.
// Each track is an ordered route through existing Mastery areas with a
// capstone design per stage - and honest link-outs for the halves that live
// outside a systems studio (frontend, visual design). Progress is computed
// from the same mastered-set the checkboxes own; a track invents nothing.

export const TRACKS = [
  {
    id: 'backend', icon: '🛠️', title: 'Backend', href: 'https://roadmap.sh/backend',
    blurb: 'The classic path: internet fundamentals through data, async and scale.',
    stages: [
      { t: 'Internet & networking', areas: ['networking'], tpl: 'URL Shortener (Bitly)' },
      { t: 'Data: stores, caching, search', areas: ['storage', 'caching', 'search'], tpl: 'News Feed (Instagram)' },
      { t: 'APIs & traffic', areas: ['api', 'lb', 'cdn'], tpl: 'Cloud-Native Gateway API Platform' },
      { t: 'Async & scale', areas: ['async', 'rw'], tpl: 'Chat (WhatsApp)' },
      { t: 'Reliability & operations', areas: ['reliability', 'obs-sec', 'deploy', 'testing', 'iam'], tpl: 'Flipkart (Big Billion Days)' },
      { t: 'The arithmetic', areas: ['envelope'] },
    ],
  },
  {
    id: 'devops', icon: '⚙️', title: 'DevOps', href: 'https://roadmap.sh/devops',
    blurb: 'Linux, networks, containers, releases, observability - the operating half.',
    stages: [
      { t: 'Linux & networking', areas: ['networking'] },
      { t: 'Releases & migrations', areas: ['deploy', 'testing'], tpl: 'Card Payments (Auth + Settlement)' },
      { t: 'Reliability engineering', areas: ['reliability'], tpl: 'Netflix' },
      { t: 'Observability & security', areas: ['obs-sec', 'iam'] },
      { t: 'Capacity thinking', areas: ['envelope', 'lb'] },
    ],
    out: 'IaC tooling and pipeline syntax live on roadmap.sh; the failure physics they must survive live here.',
  },
  {
    id: 'ai-data-scientist', icon: '📊', title: 'AI & Data Scientist', href: 'https://roadmap.sh/ai-data-scientist',
    blurb: 'From data plumbing to models in production.',
    stages: [
      { t: 'Data foundations', areas: ['storage', 'async'], tpl: 'Ride Sharing (Uber)' },
      { t: 'Serving & retrieval', areas: ['search', 'caching'], tpl: 'GenAI: RAG Assistant' },
      { t: 'LLM systems in production', areas: ['llm-prod'], tpl: 'SaaS AI Copilot (Multi-tenant RAG)' },
      { t: 'Ship it like software', areas: ['deploy', 'testing'] },
    ],
    out: 'Statistics, notebooks and model math live on roadmap.sh; what happens to a model at 3am in production lives here.',
  },
  {
    id: 'network-engineer', icon: '🌐', title: 'Network Engineer', href: 'https://roadmap.sh/network-engineer',
    blurb: 'The wire up: protocols, name resolution, delivery.',
    stages: [
      { t: 'Protocols & the handshake tax', areas: ['networking'], tpl: 'Netflix' },
      { t: 'Delivery at the edge', areas: ['cdn', 'lb'], tpl: 'Disney+ Hotstar' },
      { t: 'When the network partitions', areas: ['distributed', 'reliability'], tpl: 'UPI Switch (NPCI)' },
    ],
    out: 'Routing tables, VLANs and vendor CLIs live on roadmap.sh; what a partition does to a payment lives here.',
  },
  {
    id: 'full-stack', icon: '🧰', title: 'Full Stack', href: 'https://roadmap.sh/full-stack',
    blurb: 'The backend half, taken seriously.',
    stages: [
      { t: 'The request path end to end', areas: ['networking', 'api'], tpl: 'URL Shortener (Bitly)' },
      { t: 'Data & caching', areas: ['storage', 'caching'], tpl: 'News Feed (Instagram)' },
      { t: 'Realtime & async', areas: ['async'], tpl: 'Chat (WhatsApp)' },
      { t: 'Ship & operate', areas: ['deploy', 'reliability', 'testing'] },
    ],
    out: 'The frontend half (frameworks, CSS, accessibility) lives on roadmap.sh/frontend and /design-system - this studio owns everything after the request leaves the browser.',
  },
  {
    id: 'ai-product-builder', icon: '🤖', title: 'AI Product Builder', href: 'https://roadmap.sh/ai-product-builder',
    blurb: 'From prompt to product: build, evaluate, meter, ship.',
    stages: [
      { t: 'The AI core', areas: ['llm-prod'], tpl: 'Agentic Workflow (Tools)' },
      { t: 'Product plumbing', areas: ['api', 'caching'], tpl: 'SaaS AI Copilot (Multi-tenant RAG)' },
      { t: 'Ship, meter, iterate', areas: ['deploy'], tpl: 'LLM API Platform (FastAPI)' },
    ],
    out: 'UX research and product discovery live on roadmap.sh (/ux-design, /product-design); the systems that keep the product honest live here.',
  },
  {
    id: 'data-analyst', icon: '📊', title: 'Data Analyst', href: 'https://roadmap.sh/data-analyst',
    blurb: 'The systems half of the analyst craft: where the data lives, how it moves, and why the dashboard is fast and the metric is trustworthy.',
    stages: [
      { t: 'Rows vs columns', areas: ['storage', 'analytics'], tpl: 'Data Platform (Lakehouse)' },
      { t: 'Pipelines that rerun', areas: ['async', 'analytics', 'data-eng'] },
      { t: 'Metrics & serving', areas: ['analytics', 'caching'], tpl: 'Flipkart (Big Billion Days)' },
      { t: 'Experimentation', areas: ['analytics'], tpl: 'News Feed (Instagram)' },
    ],
    out: 'Excel, chart craft, Tableau and the statistics live on roadmap.sh/data-analyst; what makes the dashboard fast, the pipeline rerunnable and the metric trustworthy is practiced here.',
  },
]

export function trackProgress(track, areasById, doneSet) {
  const ids = track.stages.flatMap(st => st.areas.flatMap(aid => (areasById[aid]?.items || []).map(x => x.id)))
  const uniq = [...new Set(ids)]
  const done = uniq.filter(id => doneSet.has(id)).length
  return { done, total: uniq.length, pct: uniq.length ? Math.round((done / uniq.length) * 100) : 0 }
}
