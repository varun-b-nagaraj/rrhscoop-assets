#!/usr/bin/env bash
set -euo pipefail
while IFS= read -r file; do node --check "$file"; done < <(git ls-files --cached --others --exclude-standard '*.js' '*.cjs' '*.mjs')
