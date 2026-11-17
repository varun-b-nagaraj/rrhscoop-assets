#!/usr/bin/env bash
set -euo pipefail
node -e "JSON.parse(require('fs').readFileSync('package.json')); JSON.parse(require('fs').readFileSync('vercel.json'))"
./ops/scripts/adr-index-check.sh
test -f .github/CODEOWNERS
test -f .github/workflows/ci.yml
test -f .github/workflows/promote-to-production.yml
