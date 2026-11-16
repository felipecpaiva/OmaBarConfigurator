#!/usr/bin/env bash
# Runs every check in order; exits non-zero if any step fails. Missing linters print SKIP.
set -euo pipefail
cd "$(dirname "$0")/.."

QMLLINT=/usr/lib/qt6/bin/qmllint
failed=0
step() { echo "== $*"; }

step "node tests"
shopt -s nullglob
for t in test/*.js; do
  echo "-- $t"
  node "$t" || { echo "FAIL $t"; failed=1; }
done

step "no timers or polling in the painter"
# Zero idle cost (docs/quality-bar.md, Cost): updates come only from bindings and signals.
if hits=$(grep -rnE '\bTimer\b|setInterval' pills lib 2>/dev/null); then
  echo "$hits"; echo "FAIL timers: Timer or setInterval found in pills/ or lib/"; failed=1
else
  echo "OK no timers"
fi

step "private bar names only in pills/BarAdapter.js"
# The distinctive private names of the stock bar (docs/architecture.md section 6).
if hits=$(grep -rnwE 'widgetKey|widgetHolder|listRows|owner' pills lib 2>/dev/null | grep -v '^pills/BarAdapter\.js:'); then
  echo "$hits"; echo "FAIL private names: use them only in pills/BarAdapter.js"; failed=1
else
  echo "OK private names"
fi

step "qmllint"
if [[ ! -x "$QMLLINT" ]]; then
  echo "SKIP qmllint"
else
  # Quickshell types (qs.Commons, Style, ...) do not resolve outside the shell, so every
  # Style.* use reports [unqualified]: pure noise, allowed. [missing-property] is also allowed
  # as the Panel.qml:1211 `parent.cellWidth` baseline (dynamic property on parent).
  # Anything else, and every Error, fails. Tighten ALLOW when that baseline is fixed.
  ALLOW='unqualified|missing-property'
  while IFS= read -r -d '' f; do
    out=$("$QMLLINT" "$f" 2>&1) || { echo "$out"; echo "FAIL qmllint $f"; failed=1; continue; }
    bad=$(grep -E '^(Warning|Error)' <<<"$out" | grep -vE "\[($ALLOW)\]" || true)
    if [[ -n "$bad" ]]; then echo "$bad"; echo "FAIL qmllint $f"; failed=1; else echo "OK qmllint $f"; fi
  done < <(git ls-files -z --cached --others --exclude-standard '*.qml')
fi

step "shellcheck"
if ! command -v shellcheck >/dev/null; then
  echo "SKIP shellcheck"
else
  while IFS= read -r -d '' f; do
    shellcheck "$f" || { echo "FAIL shellcheck $f"; failed=1; }
  done < <(git ls-files -z --cached --others --exclude-standard '*.sh')
fi

step "scrub"
bash test/scrub.sh || failed=1

if (( failed )); then echo "RESULT: FAIL"; exit 1; fi
echo "RESULT: OK"
