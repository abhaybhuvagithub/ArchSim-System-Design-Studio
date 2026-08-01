// Preparing the live canvas SVG for rasterisation.
//
// A cloned <svg> carries none of the page's CSS, so every rule the diagram
// relied on has to be written onto the clone as a presentation attribute.
// Miss `fill: none` on the connector paths and each curve fills solid black —
// which is exactly what a naive clone-and-serialise produces.
export const NODE_W = 118
export const NODE_H = 46
export const PAD = 56
const FONT = '-apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, sans-serif'

// Mutates the clone in place and returns the pixel size to rasterise at.
export function prepareSvgForExport(svg, nodes, { maxWidth = 1700, maxScale = 2.4 } = {}) {
  if (!svg || !nodes?.length) return null

  for (const p of [...svg.querySelectorAll('path')]) {
    // invisible fat paths exist only to catch clicks
    if (p.getAttribute('stroke') === 'transparent') { p.remove(); continue }
    if (!p.getAttribute('fill')) p.setAttribute('fill', 'none')
  }
  for (const r of svg.querySelectorAll('rect')) {
    if (r.getAttribute('class')?.includes('body') && !r.getAttribute('stroke-width')) {
      r.setAttribute('stroke-width', '1.5')
    }
  }
  for (const t of svg.querySelectorAll('text')) {
    if (!t.getAttribute('font-family')) t.setAttribute('font-family', FONT)
  }
  // circles and other shapes inherit their fill from attributes already, but a
  // stray unfilled element would also come out black
  for (const el of svg.querySelectorAll('circle, ellipse, polygon')) {
    if (!el.getAttribute('fill')) el.setAttribute('fill', 'none')
  }

  // frame the whole design rather than whatever happened to be in view
  const minX = Math.min(...nodes.map(n => n.x)) - PAD
  const minY = Math.min(...nodes.map(n => n.y)) - PAD
  const boxW = Math.max(...nodes.map(n => n.x)) + NODE_W + PAD - minX
  const boxH = Math.max(...nodes.map(n => n.y)) + NODE_H + PAD - minY

  const content = svg.querySelector('g')
  if (content) content.removeAttribute('transform')
  svg.setAttribute('viewBox', `${minX} ${minY} ${boxW} ${boxH}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const scale = Math.min(maxScale, Math.max(1, maxWidth / boxW))
  const width = Math.round(boxW * scale)
  const height = Math.round(boxH * scale)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  return { width, height, boxW, boxH }
}
