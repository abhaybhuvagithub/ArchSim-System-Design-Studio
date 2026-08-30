// Onboarding start screen: three quick choices instead of a cold canvas.
// Opens on every page load (by request — a hard refresh brings it back);
// Skip closes it for the session. It still runs before the guided tour and
// hands off to it explicitly; the once-ever flag now only governs the
// tour's own first-visit auto-start.
import React, { useState } from 'react'

export const ONBOARD_KEY = 'archsim.onboarded.v1'
export const seenOnboarding = () => {
  try { return !!localStorage.getItem(ONBOARD_KEY) } catch { return true }  // no storage → never nag
}
export const markOnboarded = () => {
  try { localStorage.setItem(ONBOARD_KEY, String(Date.now())) } catch { /* private mode */ }
}

const STARTS = [
  { id: 'upi', label: '🇮🇳 UPI (BHIM)', hint: 'Bharat\'s payment rail — the design the world studies now', tpl: 'BHIM (UPI)' },
  { id: 'zomato', label: '🛵 Zomato', hint: 'Dinner-rush traffic, live courier tracking — desi scale, honestly modeled', tpl: 'Zomato' },
  { id: 'rag', label: '🤖 AI / RAG system', hint: 'The architecture behind every "chat with your data" product', tpl: 'GenAI: RAG Assistant' },
  { id: 'url', label: '🔗 URL shortener', hint: 'The classic interview warm-up — read-heavy, cache-everything', tpl: 'URL Shortener (Bitly)' },
  { id: 'ramp', label: '💳 Fintech (Ramp)', hint: 'Two seconds to answer a card swipe — a real unicorn design', tpl: 'Ramp' },
  { id: 'blank', label: '⬜ Blank canvas', hint: 'Drag components in and wire them yourself', tpl: null },
]
const TRAFFICS = [
  { id: 'steady', label: '1k rps', hint: 'A healthy product', rps: 1000 },
  { id: 'busy', label: '50k rps', hint: 'A very good day', rps: 50000 },
  { id: 'viral', label: '1M rps', hint: 'The front page of the internet', rps: 1000000 },
]
const CLOUDS_PICK = [
  { id: 'generic', label: 'Generic', hint: 'Plain component names' },
  { id: 'aws', label: 'AWS', hint: 'Named AWS services + pricing' },
  { id: 'gcp', label: 'Google Cloud', hint: 'Named GCP services + pricing' },
  { id: 'azure', label: 'Azure', hint: 'Named Azure services + pricing' },
  { id: 'oci', label: 'Oracle Cloud', hint: 'Named OCI services — the budget option (~28% cheaper)' },
  { id: 'apple', label: 'Apple', hint: 'CloudKit-era mappings for app-first designs' },
]

export function Onboarding({ onApply, onTour, onNoTour, onClose }) {
  const [step, setStep] = useState(0)
  const [start, setStart] = useState('rag')
  const [traffic, setTraffic] = useState('viral')   // default: 1M rps
  const [cloudPick, setCloudPick] = useState('generic')

  const finish = (tour) => {
    markOnboarded()
    onApply({
      template: STARTS.find(s => s.id === start)?.tpl || null,
      rps: TRAFFICS.find(t => t.id === traffic)?.rps || 1000,
      cloud: cloudPick,
    })
    onClose()
    if (tour) onTour()
    else onNoTour?.()   // an explicit "Start building" means: no auto-tour either
  }
  const skip = () => { markOnboarded(); onClose() }

  const Choice = ({ items, value, onPick }) => (
    <div className="ob-choices" role="radiogroup">
      {items.map(it => (
        <button key={it.id} role="radio" aria-checked={value === it.id}
          className={`ob-choice ${value === it.id ? 'on' : ''}`} onClick={() => onPick(it.id)}>
          <span className="ob-choice-label">{it.label}</span>
          <span className="ob-choice-hint">{it.hint}</span>
        </button>
      ))}
    </div>
  )

  const steps = [
    { title: 'Welcome — what do you want to explore?', body: <Choice items={STARTS} value={start} onPick={setStart} /> },
    { title: 'How much traffic should it face?', body: <Choice items={TRAFFICS} value={traffic} onPick={setTraffic} /> },
    { title: 'Which cloud are you thinking in?', body: <Choice items={CLOUDS_PICK} value={cloudPick} onPick={setCloudPick} /> },
  ]
  const cur = steps[step]
  const last = step === steps.length - 1

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="Getting started">
      <div className="ob-card">
        <div className="ob-head">
          <b className="ob-title">{cur.title}</b>
          <span className="ob-count">{step + 1} / {steps.length}</span>
        </div>
        {cur.body}
        <div className="ob-nav">
          {step > 0 && <button className="btn" onClick={() => setStep(s => s - 1)}>← Back</button>}
          {!last && <button className="btn ob-primary" onClick={() => setStep(s => s + 1)}>Next →</button>}
          {last && <button className="btn ob-primary" onClick={() => finish(false)}>Start building</button>}
          {last && <button className="btn" onClick={() => finish(true)}>Start + 60-sec tour</button>}
        </div>
        <button className="ob-skip" onClick={skip}>Skip — just show me the studio</button>
        <p className="ob-note">Everything runs in your browser. Refresh brings this back any time; the ? Guide button replays the tour.</p>
      </div>
    </div>
  )
}
