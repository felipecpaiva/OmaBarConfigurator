#!/usr/bin/env bash
# Public-repo scrub: no em/en dashes in markdown, no private data anywhere.
# Scans tracked plus untracked-not-ignored files, so new files are checked before they are added.
set -euo pipefail
cd "$(dirname "$0")/.."

PRIVATE=('192\.168\.' '/home/felipe' 'Z13P' 'X1C' 'MbpM5Max' 'iFelipeM2Max-Pro' 'DESKTOP-DBG1JBK' 'pi5paiva')
EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
SELF="test/scrub.sh"

fail=0
pattern=$(IFS='|'; echo "${PRIVATE[*]}")
while IFS= read -r -d '' f; do
  [[ "$f" == "$SELF" || ! -f "$f" ]] && continue
  grep -Iq . "$f" 2>/dev/null || continue  # skips binary and empty files
  if grep -InE "$pattern" "$f" | sed "s|^|$f:|"; then fail=1; fi
  if grep -InoE "$EMAIL" "$f" | grep -viE 'noreply' | sed "s|^|$f:|" | grep .; then fail=1; fi
  if [[ "$f" == *.md ]] && grep -In $'\xe2\x80\x94\|\xe2\x80\x93' "$f" | sed "s|^|$f:dash:|"; then fail=1; fi
done < <(git ls-files -z --cached --others --exclude-standard)

if (( fail )); then echo "FAIL scrub"; exit 1; fi
echo "OK scrub"
