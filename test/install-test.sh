#!/usr/bin/env bash
# install.sh must never leave the user without a plugin: run it against a fake
# HOME with stubbed omarchy commands, once to update and once with a failure.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/bin"
ID=io.github.felipecpaiva.omabarconfigurator
cat > "$T/bin/omarchy" <<'STUB'
#!/usr/bin/env bash
[[ ${STUB_FAIL:-} == "$2" ]] && exit 1
exit 0
STUB
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/omarchy-shell"
printf '#!/usr/bin/env bash\necho %s\n' "'[{\"id\":\"$ID\"}]'" > "$T/bin/omarchy-plugin-list"
chmod +x "$T/bin/"*
export HOME="$T/home" PATH="$T/bin:$PATH"
DEST="$HOME/.config/omarchy/plugins/$ID"
mkdir -p "$DEST"; echo old > "$DEST/OLD"
fail() { echo "FAIL install-test: $*"; exit 1; }

STUB_FAIL=validate bash "$REPO/install.sh" >/dev/null 2>&1 && fail "bad validation should fail"
[[ -f $DEST/OLD ]] || fail "old plugin lost after failed validation"
STUB_FAIL=enable bash "$REPO/install.sh" >/dev/null 2>&1 && fail "failed enable should fail"
[[ -f $DEST/OLD && ! -e $DEST/manifest.json ]] || fail "old plugin not restored after failed enable"
bash "$REPO/install.sh" >/dev/null 2>&1 || fail "good install failed"
[[ -f $DEST/manifest.json && ! -e $DEST/OLD ]] || fail "new plugin not in place"
[[ -z $(ls -A "$(dirname "$DEST")" | grep -v "^$ID\$") ]] || fail "staging or backup dir left behind"
echo "OK install keeps the old plugin on failure"
