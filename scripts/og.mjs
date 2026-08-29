// Render the OpenGraph card (1200x630) from a branded SVG: dark studio look,
// a believable mini-architecture, the honest tagline.
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
const node = (x, y, glyph, label, c) => `
  <g>
    <rect x="${x - 54}" y="${y - 30}" width="108" height="60" rx="12" fill="#151b26" stroke="${c}" stroke-width="2"/>
    <text x="${x}" y="${y - 2}" font-size="24" text-anchor="middle">${glyph}</text>
    <text x="${x}" y="${y + 20}" font-size="13" text-anchor="middle" fill="#9aa7bd" font-family="system-ui">${label}</text>
  </g>`
const edge = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3b4a63" stroke-width="2.5"/>`
const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0b0f16"/>
  <rect width="1200" height="630" fill="url(#g)" opacity="0.5"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#12203a"/><stop offset="1" stop-color="#0b0f16"/>
  </linearGradient></defs>
  ${edge(210, 315, 330, 315)}${edge(438, 315, 550, 230)}${edge(438, 315, 550, 400)}
  ${edge(658, 230, 770, 230)}${edge(658, 400, 770, 400)}${edge(878, 400, 960, 315)}${edge(878, 230, 960, 315)}
  ${node(156, 315, '👥', 'Clients', '#5b8cff')}
  ${node(384, 315, '⚖️', 'LB', '#22c55e')}
  ${node(604, 230, '⚡', 'FastAPI ×3', '#14b8a6')}
  ${node(604, 400, '📨', 'Queue', '#eab308')}
  ${node(824, 230, '💾', 'Redis ×3', '#ef4444')}
  ${node(824, 400, '🦾', 'Workers ×24', '#d946ef')}
  ${node(1014, 315, '🧠', 'LLM', '#ec4899')}
  <text x="80" y="120" font-size="64" font-weight="800" fill="#e8edf6" font-family="system-ui">ArchSim — System Design Studio</text>
  <text x="80" y="172" font-size="30" fill="#9aa7bd" font-family="system-ui">Draw it. Simulate it. Break it. Defend it.</text>
  <text x="80" y="560" font-size="24" fill="#6b7a94" font-family="system-ui">94 templates · 115 components · live capacity, chaos, SLOs and ROI · honest numbers with receipts</text>
</svg>`
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
fs.writeFileSync('public/og.png', png)
console.log('og.png', (png.length / 1024).toFixed(0) + 'KB')
