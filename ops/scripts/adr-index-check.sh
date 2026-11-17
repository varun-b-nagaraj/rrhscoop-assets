#!/usr/bin/env bash
# ADR hygiene check (ADR 0000). Adapted from kaya5-app's ops/scripts/adr-index-check.sh.
#
# Fails when:
#   1. An ADR file is not linked from docs/adr/README.md. An ADR nobody can find is
#      the same as a decision nobody made.
#   2. An ADR's title or status line is not in the expected format. A check that
#      silently skips a file it cannot parse says it looked when it did not.
#   3. Numbers are reused or a file name does not start with a four-digit number.
#   4. An Accepted ADR names a repo file in backticks that does not exist. Delete the
#      code and the ADR describing it becomes something the next reader will believe.
#
# Deliberately not checked: paths in Superseded or Proposed ADRs. A superseded ADR is
# a historical record and is supposed to describe things that are gone.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 2
INDEX="docs/adr/README.md"
fail=0

[ -f "$INDEX" ] || { echo "adr-index-check: $INDEX missing"; exit 2; }

shopt -s nullglob
files=(docs/adr/[0-9]*.md)
[ "${#files[@]}" -gt 0 ] || { echo "adr-index-check: no ADRs in docs/adr"; exit 2; }

dupes="$(for f in "${files[@]}"; do basename "$f" | cut -c1-4; done | sort | uniq -d)"
if [ -n "$dupes" ]; then
  echo "✗ ADR number(s) used twice: $dupes"
  fail=1
fi

for f in "${files[@]}"; do
  base="$(basename "$f")"
  num="${base:0:4}"

  if ! printf '%s' "$base" | grep -qE '^[0-9]{4}-[a-z0-9-]+\.md$'; then
    echo "✗ $base: name must be NNNN-short-slug.md (lowercase, hyphens)"
    fail=1
  fi

  if ! grep -qF "($base)" "$INDEX"; then
    echo "✗ $base is not linked from $INDEX — an ADR nobody can find"
    fail=1
  fi

  if ! head -1 "$f" | grep -qE "^# ADR $num — "; then
    echo "✗ $base: line 1 must be '# ADR $num — Title'"
    fail=1
  fi

  status="$(sed -n 3p "$f")"
  if ! printf '%s' "$status" | grep -qE '^\*\*Status:\*\* (Accepted|Proposed|Superseded by [0-9]{4})'; then
    echo "✗ $base: line 3 must be '**Status:** Accepted|Proposed|Superseded by NNNN · YYYY-MM-DD'"
    echo "    The check cannot tell whether to verify its paths, so it fails rather than skipping."
    fail=1
    continue
  fi

  for section in "## Context" "## Decision" "## Consequences"; do
    grep -qxF "$section" "$f" || { echo "✗ $base: missing '$section'"; fail=1; }
  done

  case "$status" in
    *Accepted*) ;;
    *) continue ;;
  esac

  # Backtick-quoted repo paths with a source extension. URLs and domains are
  # skipped, and so are placeholders: an all-caps segment such as `NNNN-slug.md` or
  # `STAGING_ORIGIN/index.js` describes a pattern, not a claim that a file exists.
  while IFS= read -r p; do
    [ -e "$p" ] && continue
    echo "✗ $base is Accepted and names \`$p\`, which does not exist."
    echo "    Update the ADR, supersede it, or restore the file."
    fail=1
  done < <(grep -oE '`[A-Za-z0-9_./-]+\.(js|cjs|mjs|json|ya?ml|css|html|sh|md)`' "$f" \
             | tr -d '`' | grep -vE '^(https?:|/)|\.vercel\.app|\.org|\.site|NNNN|(^|/)[A-Z][A-Z_]+(/|$)' | sort -u)
done

if [ "$fail" -eq 0 ]; then
  echo "adr-index-check: ${#files[@]} ADRs indexed and well-formed; all Accepted paths exist."
fi
exit "$fail"
