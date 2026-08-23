# Admin — seeing the whole business

## The dashboard
```
node scripts/admin.mjs
```
Open the `admin-dashboard.html` it writes (repo root, **gitignored** — it contains revenue).
Everything on it is real: customers, active vs expired accounts, total / this-month revenue,
MRR and ARR run-rate, profit after payment fees, plan mix, conversion against the public
visitor counter. It reads `scripts/issued-keys.log`, which `genkey.mjs` now writes with the
price paid — so mint keys only through genkey and the books keep themselves.

Owner-minted lifetime keys record ₹0 and are excluded from revenue (shown separately),
so gifting yourself or a reviewer a key never inflates the numbers.

## Web analytics (users, sessions, engagement)
A static site collects nothing by itself. To add the Google-Analytics view:
1. analytics.google.com → create a GA4 property for the site → copy the Measurement ID (G-…).
2. Paste it into `GA_MEASUREMENT_ID` in `src/analytics.js`.
3. `bash scripts/deploy.sh`. The loader is already wired and ships disabled until an ID exists.

## Keywords
Search queries live in **Google Search Console**, not GA:
search.google.com/search-console → add property → verify via DNS or the HTML-file method
(commit the verification file to the repo root; it deploys with the site). Within a few days
you get queries, impressions, clicks and position — the "keywords" report.

## What stays impossible without a server
Per-user accounts, login analytics, and true active-device counts need a backend.
The moment revenue justifies it: Razorpay webhooks + a small worker, same key format.
