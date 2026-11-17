#!/usr/bin/env bash
set -euo pipefail
patterns='(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Bearer [A-Za-z0-9_-]{40,}|(ghp|github_pat|sk_live|sk_test)_[A-Za-z0-9_-]{20,})'
if git grep -nEI "$patterns" -- ':!package-lock.json' ':!ops/scripts/secret-check.sh'; then
  echo 'Possible credential committed to source. Remove it and rotate it before continuing.' >&2
  exit 1
fi
