# Contributing to ArchSim

## Setup
```
npm install
npm run build
node scripts/verify.mjs      # the whole suite; must end with every check passing
```

## Rules
- **Real behaviour only.** No placeholder buttons, no mock results. If it needs a backend, say so and keep it out of the studio.
- **Don't weaken a check to pass it.** Fix the content or the code.
- **Small, tested increments.** Each change adds or updates checks in `scripts/verify.mjs`.
- **No jargon in the UI.** Prefer plain words ("Reliability Simulation").

## Adding a template
Add it to `src/templates.js`, then its companions keyed by the same name: `breakdown-h.js`, `scaling-f.js`, `roi.js`. The suite fails if one is missing.

## Adding Mastery content
Concepts and comparison tables live in `src/mastery.js`. Table rows need one value per column and no empty cells. Update the counts pinned in `scripts/verify.mjs`, `src/tour.js` and the Mastery tab tooltip.

## Releasing
Bump all three together: `package.json`, `src/version.js`, `CHANGELOG.md`. Then `bash scripts/deploy.sh` (needs `GH_TOKEN`).
