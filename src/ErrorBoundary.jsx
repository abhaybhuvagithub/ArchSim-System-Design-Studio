import React from 'react'
import { clearSavedState, describe } from './crash.js'

// Without this, any render error blanks the page — and if the cause is corrupt
// saved state, it blanks on every reload with no way back. So the fallback
// offers the one action that actually recovers from that.
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    // Kept in state rather than only logged, so the person can copy it into a
    // bug report instead of being asked to open the console.
    this.setState({ stack: (info && info.componentStack) || '' })
    if (typeof console !== 'undefined') console.error('ArchSim crashed:', error, info)
  }

  reset = (clearState) => {
    if (clearState) clearSavedState(localStorage)
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    const msg = describe(this.state.error)
    return (
      <div className="crash" role="alert">
        <div className="crash-box">
          <h1>Something in the studio broke.</h1>
          <p>
            The rest of the page stopped rather than showing you a blank screen. Your design is
            still in this tab's memory unless you reload.
          </p>
          <pre className="crash-msg">{msg}</pre>
          <div className="crash-btns">
            <button className="crash-primary" onClick={() => this.reset(false)}>Reload</button>
            <button onClick={() => this.reset(true)}>Reload and clear saved settings</button>
            <a href="https://github.com/abhaybhuvagithub/ArchSim-System-Design-Studio/issues/new"
               target="_blank" rel="noreferrer noopener">Report it</a>
          </div>
          <p className="crash-hint">
            If it breaks again immediately, the second button clears this site's saved
            settings — theme, panel sizes, tour state — which is the usual cause of a crash
            that repeats on every load.
          </p>
        </div>
      </div>
    )
  }
}
