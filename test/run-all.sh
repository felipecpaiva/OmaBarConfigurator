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

step "install.sh failure handling"
bash test/install-test.sh || failed=1

step "no timers or polling in the painter"
# Zero idle cost (docs/quality-bar.md, Cost): updates come only from bindings and signals.
if hits=$(grep -rnE '\bTimer\b|setInterval' pills lib 2>/dev/null); then
  echo "$hits"; echo "FAIL timers: Timer or setInterval found in pills/ or lib/"; failed=1
else
  echo "OK no timers"
fi

step "private bar names only in pills/BarAdapter.js"
# Qt 6.12 ships its own Color singleton that hides qs.Commons Color, so every
# use must be Commons.Color (commit af4ae61, omacom/omarchy#14553).
if hits=$(grep -nE '(^|[^.A-Za-z_])Color\.' pills/*.qml panel/*.qml Panel.qml); then
  echo "$hits"; echo "FAIL unqualified Color: use Commons.Color"; failed=1
else
  echo "OK qualified Color"
fi

# The distinctive private names of the stock bar (docs/architecture.md section 6).
if hits=$(grep -rnwE 'widgetKey|widgetHolder|listRows|owner' pills lib 2>/dev/null | grep -v '^pills/BarAdapter\.js:'); then
  echo "$hits"; echo "FAIL private names: use them only in pills/BarAdapter.js"; failed=1
else
  echo "OK private names"
fi

step "local component imports"
# qmllint does not catch a root file using a panel/ component without `import "panel"`
# (it broke the live panel once: "CategoryBar is not a type").
bad_imports=0
for f in *.qml; do
  for t in $(ls panel/*.qml 2>/dev/null | xargs -n1 basename | sed 's/[.]qml$//'); do
    if grep -qE "^[[:space:]]*$t[[:space:]]*[{]" "$f" && ! grep -qE '^import "panel"' "$f"; then
      echo "FAIL $f uses $t without import \"panel\""; bad_imports=1
    fi
  done
done
if [[ $bad_imports -eq 0 ]]; then echo "OK local component imports"; else failed=1; fi

step "qmllint"
if [[ ! -x "$QMLLINT" ]]; then
  echo "SKIP qmllint"
else
  # Quickshell maps the module name `qs` to Omarchy's shell folder, so a temp dir with a `qs`
  # link makes qs.Commons and qs.Ui resolve for real. Two blind spots remain and are allowed:
  # [unqualified] (shell singletons seen through the root scope) and [missing-property] on the
  # generic types "QObject" (Style.font.caption and other nested groups) and "QQuickItem"
  # (`parent.x` on an untyped parent). Everything else fails, including any misspelled property
  # on a concrete type.
  QS_ROOT=$(mktemp -d)
  trap 'rm -rf "$QS_ROOT"' EXIT
  ln -s "${OMARCHY_PATH:-/usr/share/omarchy}/shell" "$QS_ROOT/qs"
  while IFS= read -r -d '' f; do
    out=$("$QMLLINT" -I "$QS_ROOT" "$f" 2>&1) || { echo "$out"; echo "FAIL qmllint $f"; failed=1; continue; }
    bad=$(grep -E '^(Warning|Error)' <<<"$out" | grep -vE '\[unqualified\]' \
      | grep -vE 'not found on type "(QObject|QQuickItem)" \[missing-property\]' || true)
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
