// Colours used inside the SVG canvas. Kept in JS (not CSS variables) so that
// PNG export — which serialises a detached clone with no stylesheet — still
// rasterises with the right colours.
export const THEMES = {
  dark: {
    canvasBg: '#0e1618',
    nodeFill: '#18242a', nodeFillHover: '#1f3038', nodeStrokeHover: '#2dd4bf',
    nodeText: '#e7eef0', nodeSub: '#8ba3ab',
    downFill: '#3a1f20', downStroke: '#f4645f',
    edge: '#33474e', edgeActive: '#14b8a6', edgeHot: '#5eead4',
    arrow: '#4a636b', arrowHot: '#5eead4',
    dot: '#2dd4bf', dotDrop: '#f4645f',
    glow: '#14b8a6', hotText: '#99f6e4', wire: '#14b8a6',
    selStroke: '#ffffff', barTrack: '#0e1618', badgeText: '#04211e',
    stepFill: '#134e4a', stepText: '#ccfbf1', stepStroke: '#2dd4bf',
  },
  light: {
    canvasBg: '#f7f9fa',
    nodeFill: '#ffffff', nodeFillHover: '#effcfa', nodeStrokeHover: '#0d9488',
    nodeText: '#16262c', nodeSub: '#5b6f79',
    downFill: '#fee2e2', downStroke: '#dc2626',
    edge: '#aebcc2', edgeActive: '#0d9488', edgeHot: '#0f766e',
    arrow: '#8ba0a8', arrowHot: '#0f766e',
    dot: '#0d9488', dotDrop: '#dc2626',
    glow: '#0d9488', hotText: '#0f766e', wire: '#0d9488',
    selStroke: '#16262c', barTrack: '#e2eaec', badgeText: '#ffffff',
    stepFill: '#ccfbf1', stepText: '#0f766e', stepStroke: '#0d9488',
  },
}

THEMES.neon = {
  canvasBg: '#04050b',
  nodeFill: '#0b0f1e', nodeFillHover: '#141a33', nodeStrokeHover: '#00ffd5',
  nodeText: '#f2ffff', nodeSub: '#6ff5ff',
  downFill: '#3d0016', downStroke: '#ff1e6b',
  edge: '#2b3a6b', edgeActive: '#00ffd5', edgeHot: '#ff00e0',
  arrow: '#00e0ff', arrowHot: '#ff00e0',
  dot: '#ccff00', dotDrop: '#ff1e6b',
  glow: '#00ffd5', hotText: '#ff8df5', wire: '#00ffd5',
  selStroke: '#ffffff', barTrack: '#0b0f1e', badgeText: '#04050b',
  stepFill: '#12103a', stepText: '#ccff00', stepStroke: '#00ffd5',
  neon: true,
}

// Ultra-bright variant of a component colour, used by the neon theme.
// Pushes saturation to the ceiling and lightness into the fluorescent band.
const cache = {}
export function neonize(hex) {
  if (cache[hex]) return cache[hex]
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  let [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2, d = max - min
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  h = (h * 60 + 360) % 360
  const S = 1, L = 0.62                       // max saturation, bright but not white
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = L - c / 2
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6]
  const out = '#' + seg.map(v => Math.round((v + mm) * 255).toString(16).padStart(2, '0')).join('')
  return (cache[hex] = out)
}
export const themeColor = (hex, theme) => (theme === 'neon' ? neonize(hex) : hex)

export const THEME_ORDER = ['dark', 'light', 'neon']
export const THEME_LABEL = { dark: '🌙 Dark', light: '☀️ Light', neon: '⚡ Neon' }

export const readTheme = () => {
  try { const v = localStorage.getItem('archsim.theme'); if (THEME_ORDER.includes(v)) return v } catch {}
  try { if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' } catch {}
  return 'dark'
}
export const saveTheme = v => { try { localStorage.setItem('archsim.theme', v) } catch {} }
