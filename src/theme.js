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
}


export const THEME_ORDER = ['dark', 'light']
export const THEME_LABEL = { dark: '🌙 Dark', light: '☀️ Light' }

export const readTheme = () => {
  try { const v = localStorage.getItem('archsim.theme'); if (THEME_ORDER.includes(v)) return v } catch {}
  try { if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' } catch {}
  return 'dark'
}
export const saveTheme = v => { try { localStorage.setItem('archsim.theme', v) } catch {} }
