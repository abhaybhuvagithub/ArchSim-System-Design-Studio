// Optional GA4 hook — ships DISABLED. Paste your Measurement ID (G-XXXXXXX)
// to turn it on and redeploy; with the ID empty, nothing loads, nothing
// phones home, and the app stays tracker-free. Keywords come from Google
// Search Console, not GA — see ADMIN.md for both setups.
export const GA_MEASUREMENT_ID = ''

export function initAnalytics() {
  if (!GA_MEASUREMENT_ID) return   // disabled until an ID exists — no silent tracking
  if (document.getElementById('ga4-loader')) return
  const s = document.createElement('script')
  s.id = 'ga4-loader'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true })
}
