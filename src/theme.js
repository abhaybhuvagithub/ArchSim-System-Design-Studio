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

export const readTheme = () => {
  try { const v = localStorage.getItem('archsim.theme'); if (v === 'light' || v === 'dark') return v } catch {}
  try { if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' } catch {}
  return 'dark'
}
export const saveTheme = v => { try { localStorage.setItem('archsim.theme', v) } catch {} }
