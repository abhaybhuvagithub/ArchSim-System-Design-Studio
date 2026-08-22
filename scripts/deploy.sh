#!/usr/bin/env bash
# Deploy the current build to gh-pages — correctly.
#
# The trap this script exists to avoid: dist/ used to be committed on gh-pages,
# so `git checkout gh-pages` silently replaced the fresh (gitignored) dist/
# with the previous deploy's copy, and every deploy shipped the build before
# the one you thought you were shipping. The fix is to stage the build outside
# the repo before switching branches.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
node scripts/verify.mjs > /dev/null || { echo "verify failed — not deploying"; exit 1; }

STAGE=$(mktemp -d)
cp -r dist/* "$STAGE"/

git checkout gh-pages
rm -rf assets
cp -r "$STAGE"/* .
rm -rf "$STAGE"
git add -A
git commit -m "Deploy: $(git log main -1 --pretty=%s)"
# Push with $GH_TOKEN when set (CI / sandboxes with no stored credentials).
if [ -n "${GH_TOKEN:-}" ]; then
  git push "https://x-access-token:${GH_TOKEN}@github.com/abhaybhuvagithub/ArchSim-System-Design-Studio.git" gh-pages
else
  git push origin gh-pages
fi
git checkout main
echo "✓ deployed $(grep -o 'index-[^\"]*\.js' index.html 2>/dev/null || echo '')"
