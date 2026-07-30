// Colours used inside the SVG canvas. Kept in JS (not CSS variables) so that
// PNG export — which serialises a detached clone with no stylesheet — still
// rasterises with the right colours.
export const THEMES = {
  dark: {
    canvasBg: '#0b1020',
    nodeFill: '#161f3a', nodeFillHover: '#1e2a4d', nodeStrokeHover: '#a5b4fc',
    nodeText: '#e2e8f0', nodeSub: '#8b96b5',
    downFill: '#3f1d1d', downStroke: '#ef4444',
    edge: '#38436b', edgeActive: '#6366f1', edgeHot: '#a5b4fc',
    arrow: '#4a5578', arrowHot: '#a5b4fc',
    dot: '#818cf8', dotDrop: '#ef4444',
    glow: '#818cf8', hotText: '#c7d2fe', wire: '#6366f1',
    selStroke: '#ffffff', barTrack: '#0b1020', badgeText: '#ffffff',
    stepFill: '#312e81', stepText: '#e0e7ff', stepStroke: '#818cf8',
  },
  light: {
    canvasBg: '#f7f9fc',
    nodeFill: '#ffffff', nodeFillHover: '#eef2ff', nodeStrokeHover: '#4338ca',
    nodeText: '#111827', nodeSub: '#5b6580',
    downFill: '#fee2e2', downStroke: '#dc2626',
    edge: '#aab4cc', edgeActive: '#4f46e5', edgeHot: '#3730a3',
    arrow: '#8b97b5', arrowHot: '#3730a3',
    dot: '#4f46e5', dotDrop: '#dc2626',
    glow: '#6366f1', hotText: '#3730a3', wire: '#4f46e5',
    selStroke: '#111827', barTrack: '#e3e8f2', badgeText: '#ffffff',
    stepFill: '#eef2ff', stepText: '#3730a3', stepStroke: '#6366f1',
  },
}

export const readTheme = () => {
  try { const v = localStorage.getItem('archsim.theme'); if (v === 'light' || v === 'dark') return v } catch {}
  try { if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light' } catch {}
  return 'dark'
}
export const saveTheme = v => { try { localStorage.setItem('archsim.theme', v) } catch {} }
