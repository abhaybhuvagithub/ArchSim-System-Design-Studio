// Regions, availability zones, and the map they sit on.
//
// The reason this is worth having as more than decoration: distance is the one
// constraint you cannot engineer around. Light in fibre travels about 200,000
// km/s, so Mumbai to Virginia has a floor of roughly 130ms round trip before a
// single service does any work. A design that puts a synchronous dependency
// across that gap is already too slow, and no amount of caching fixes it.

export const REGIONS = [
  { id: 'us-east-1',      name: 'N. Virginia',   cloud: 'AWS',   lat: 38.95,  lon: -77.45, azs: 6 },
  { id: 'us-west-2',      name: 'Oregon',        cloud: 'AWS',   lat: 45.87,  lon: -119.69, azs: 4 },
  { id: 'sa-east-1',      name: 'São Paulo',     cloud: 'AWS',   lat: -23.55, lon: -46.63, azs: 3 },
  { id: 'eu-west-1',      name: 'Ireland',       cloud: 'AWS',   lat: 53.35,  lon: -6.26,  azs: 3 },
  { id: 'eu-central-1',   name: 'Frankfurt',     cloud: 'AWS',   lat: 50.11,  lon: 8.68,   azs: 3 },
  { id: 'me-south-1',     name: 'Bahrain',       cloud: 'AWS',   lat: 26.07,  lon: 50.55,  azs: 3 },
  { id: 'af-south-1',     name: 'Cape Town',     cloud: 'AWS',   lat: -33.93, lon: 18.42,  azs: 3 },
  { id: 'ap-south-1',     name: 'Mumbai',        cloud: 'AWS',   lat: 19.08,  lon: 72.88,  azs: 3 },
  { id: 'ap-south-2',     name: 'Hyderabad',     cloud: 'AWS',   lat: 17.39,  lon: 78.49,  azs: 3 },
  { id: 'ap-southeast-1', name: 'Singapore',     cloud: 'AWS',   lat: 1.35,   lon: 103.82, azs: 3 },
  { id: 'ap-northeast-1', name: 'Tokyo',         cloud: 'AWS',   lat: 35.68,  lon: 139.69, azs: 4 },
  { id: 'ap-southeast-2', name: 'Sydney',        cloud: 'AWS',   lat: -33.87, lon: 151.21, azs: 3 },
]

export const SITE_ROLES = {
  primary: { label: 'Primary', short: 'PRI', blurb: 'Takes writes. There is exactly one of these per dataset, or you are running multi-leader whether you meant to or not.' },
  replica: { label: 'Replica', short: 'REP', blurb: 'Serves reads and follows the primary. Its lag is the staleness your users see.' },
  backup:  { label: 'Backup',  short: 'BAK', blurb: 'Holds copies, serves no traffic. Untested restores are not backups.' },
  dr:      { label: 'DR',      short: 'DR',  blurb: 'Stands by to take over. The number that matters is how long a failover actually takes, not that it exists.' },
  edge:    { label: 'Edge',    short: 'EDG', blurb: 'Caches and terminates close to users. Cheap latency wins, no source of truth.' },
}

// Equirectangular. Crude for a world atlas and exactly right here, because
// what is being read off it is relative position, not area.
export function project(lat, lon, w, h) {
  return { x: (Number(lon) + 180) / 360 * w, y: (90 - Number(lat)) / 180 * h }
}

const R_EARTH = 6371
export function greatCircleKm(a, b) {
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Fibre is roughly two thirds of c, and cable routes are not straight — the
// 1.4 is the usual allowance for that. This is a floor, not a prediction.
const FIBRE_KM_PER_MS = 200
export function rttFloorMs(a, b, routeFactor = 1.4) {
  return (greatCircleKm(a, b) * routeFactor * 2) / FIBRE_KM_PER_MS
}

export const regionById = id => REGIONS.find(r => r.id === id) || null

// Sites are derived from the design rather than maintained separately, so the
// map cannot drift from the canvas.
export function sitesFor(nodes) {
  const byRegion = new Map()
  for (const n of nodes) {
    if (!n.region) continue
    const r = regionById(n.region)
    if (!r) continue
    if (!byRegion.has(r.id)) byRegion.set(r.id, { region: r, nodes: [], roles: new Set() })
    const site = byRegion.get(r.id)
    site.nodes.push(n)
    site.roles.add(n.siteRole || 'primary')
  }
  return [...byRegion.values()].map(s => ({
    ...s,
    role: ['primary', 'replica', 'dr', 'backup', 'edge'].find(r => s.roles.has(r)) || 'primary',
    services: s.nodes.length,
    // Instances, not services — a region running six copies of one thing is a
    // different proposition from one running six different things, and the map
    // showed neither.
    replicas: s.nodes.reduce((a2, n) => a2 + (n.replicas || 1), 0),
    azs: s.region.azs,
  }))
}

export function siteLinks(sites, edges, nodes) {
  const regionOf = Object.fromEntries(nodes.filter(n => n.region).map(n => [n.id, n.region]))
  const seen = new Map()
  for (const e of edges) {
    const a = regionOf[e.from], b = regionOf[e.to]
    if (!a || !b || a === b) continue
    const key = [a, b].sort().join('|')
    if (seen.has(key)) { seen.get(key).count++; continue }
    const ra = regionById(a), rb = regionById(b)
    seen.set(key, { from: a, to: b, count: 1, km: Math.round(greatCircleKm(ra, rb)), rttMs: Math.round(rttFloorMs(ra, rb)) })
  }
  return [...seen.values()]
}

// The finding worth surfacing: a synchronous hop between distant regions.
export function geoFindings(sites, links) {
  const out = []
  for (const l of links) {
    if (l.rttMs < 80) continue
    const a = regionById(l.from), b = regionById(l.to)
    out.push({
      severity: l.rttMs >= 200 ? 'bad' : 'warn',
      title: `${a.name} → ${b.name} costs at least ${l.rttMs}ms round trip`,
      why: `About ${l.km.toLocaleString()} km apart. That is the speed of light in fibre, before any service does work, so it cannot be tuned away.`,
      fix: 'Make this hop asynchronous, or put a replica on the near side and accept the staleness — those are the only two options at this distance.',
    })
  }
  const primaries = sites.filter(s => s.role === 'primary')
  if (primaries.length > 1) out.push({
    severity: 'bad',
    title: `${primaries.length} regions are marked primary`,
    why: 'Two regions taking writes for the same data is multi-leader replication, whether or not it was chosen deliberately.',
    fix: 'Either name one primary and make the rest replicas, or say how write conflicts are resolved.',
  })
  return out
}
