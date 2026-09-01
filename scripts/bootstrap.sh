#!/usr/bin/env sh
set -eu
if [ -f package-lock.json ]; then
  npm ci
else
  echo "No package-lock.json found; generating one with npm install. Review and commit it before production."
  npm install
fi
npm run typecheck
npm test
npm run build
