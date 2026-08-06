// Colours used inside the SVG canvas. Kept in JS (not CSS variables) so that
// PNG export — which serialises a detached clone with no stylesheet — still
// rasterises with the right colours.
// Apple's system palette: #000/#1d1d1f surfaces in dark, #f5f5f7/#fff in light,
// with the system blue (#2997ff dark, #0066cc light) as the only accent.
export const THEMES = {
  dark: {
    canvasBg: '#000000',
    nodeFill: '#1d1d1f', nodeFillHover: '#2c2c2e', nodeStrokeHover: '#2997ff',
    nodeText: '#f5f5f7', nodeSub: '#86868b',
    downFill: '#3b1d1c', downStroke: '#ff453a',
    edge: '#424245', edgeActive: '#2997ff', edgeHot: '#64d2ff',
    arrow: '#6e6e73', arrowHot: '#64d2ff',
    dot: '#2997ff', dotDrop: '#ff453a',
    glow: '#2997ff', hotText: '#a3d8ff', wire: '#2997ff',
    selStroke: '#ffffff', barTrack: '#000000', badgeText: '#ffffff',
    stepFill: '#12325c', stepText: '#a3d8ff', stepStroke: '#2997ff',
  },
  light: {
    canvasBg: '#f5f5f7',
    nodeFill: '#ffffff', nodeFillHover: '#eef5ff', nodeStrokeHover: '#0066cc',
    nodeText: '#1d1d1f', nodeSub: '#6e6e73',
    downFill: '#ffe5e3', downStroke: '#d70015',
    edge: '#d2d2d7', edgeActive: '#0066cc', edgeHot: '#0071e3',
    arrow: '#a1a1a6', arrowHot: '#0071e3',
    dot: '#0066cc', dotDrop: '#d70015',
    glow: '#0066cc', hotText: '#0071e3', wire: '#0066cc',
    selStroke: '#1d1d1f', barTrack: '#e8e8ed', badgeText: '#ffffff',
    stepFill: '#e8f2ff', stepText: '#0066cc', stepStroke: '#0066cc',
  },
  // Taken from the author's own Periodic Table of C# 14 — violet accent on a
  // near-white editorial surface. Kept in step with the CSS block of the same
  // name; PNG export reads this copy, so the two drifting apart shows up as a
  // diagram that does not match the screen.
  neural: {
    canvasBg: '#f5f6f8',
    nodeFill: '#ffffff', nodeFillHover: '#f3eeff', nodeStrokeHover: '#a679ff',
    nodeText: '#141820', nodeSub: '#566273',
    downFill: '#ffe7e5', downStroke: '#f6685e',
    edge: '#d8dce4', edgeActive: '#a679ff', edgeHot: '#2dd4bf',
    arrow: '#9aa4b2', arrowHot: '#2dd4bf',
    dot: '#a679ff', dotDrop: '#f6685e',
    glow: '#a679ff', hotText: '#7c4dff', wire: '#a679ff',
    selStroke: '#141820', barTrack: '#e6e8ee', badgeText: '#ffffff',
    stepFill: '#efe7ff', stepText: '#7c4dff', stepStroke: '#a679ff',
  },
}


export const THEME_ORDER = ['dark', 'light', 'neural']
export const THEME_LABEL = { dark: '🌙 Dark', light: '☀️ Light', neural: '🟣 Neural' }

export const readTheme = () => {
  try { const v = localStorage.getItem('archsim.theme'); if (THEME_ORDER.includes(v)) return v } catch {}
  try { if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' } catch {}
  return 'dark'
}
export const saveTheme = v => { try { localStorage.setItem('archsim.theme', v) } catch {} }
