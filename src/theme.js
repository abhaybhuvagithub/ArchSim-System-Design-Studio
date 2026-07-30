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

// Neon green #2CFF05 with Figma's "Alien Hues" supporting shades
// (#45CC2D, #45663F, #2B332A) plus its analogous and split-complementary accents.
THEMES.neon = {
  canvasBg: '#050a04',
  nodeFill: '#0b1209', nodeFillHover: '#17210f', nodeStrokeHover: '#2cff05',
  nodeText: '#eaffe6', nodeSub: '#7fcf6e',
  downFill: '#33052a', downStroke: '#ff05a9',
  edge: '#45663f', edgeActive: '#2cff05', edgeHot: '#a9ff05',
  arrow: '#45cc2d', arrowHot: '#a9ff05',
  dot: '#2cff05', dotDrop: '#ff05a9',
  glow: '#2cff05', hotText: '#bfffb4', wire: '#2cff05',
  selStroke: '#ffffff', barTrack: '#0b1209', badgeText: '#052b00',
  stepFill: '#093a00', stepText: '#2cff05', stepStroke: '#2cff05',
  neon: true,
}

// Ultra-bright variant of a component colour, used by the neon theme.
// Every hue is folded into the neon-green family (chartreuse → spring green)
// at full saturation, so the palette stays on-brand while the 66 component
// types remain visually distinguishable.
const NEON_HUE_MIN = 72, NEON_HUE_SPAN = 88   // #2CFF05 sits at 110.6°
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
  h = NEON_HUE_MIN + (h / 360) * NEON_HUE_SPAN   // fold into the neon-green band
  const S = 1, L = 0.55                          // full saturation, fluorescent

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
