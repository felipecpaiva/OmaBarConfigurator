#!/usr/bin/env bash
# Installs the Bar Configurator as a panel plugin and puts it in the
# Applications list, so it never takes a slot on the bar. See README.md.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ID="felipe.bar-configurator"
PLUGIN_DEST="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
DESKTOP_SRC="$REPO_DIR/omabarconfigurator.desktop"
DESKTOP_DEST="$HOME/.local/share/applications/omabarconfigurator.desktop"
MARKER="X-OmaBarConfigurator-Managed=true"

echo "== 1/3: installing the plugin =="
shopt -s nullglob
rm -rf "$PLUGIN_DEST"
mkdir -p "$PLUGIN_DEST"
cp -f "$REPO_DIR/manifest.json" "$REPO_DIR"/*.qml "$REPO_DIR"/*.js "$PLUGIN_DEST/"
omarchy plugin validate "$PLUGIN_DEST"

echo
echo "== 2/3: enabling it =="
# kinds is ["panel"], so enabling adds a plugins[] entry and never touches
# bar.layout. omarchy-plugin-add's section prompt is bar-widget-only.
omarchy-shell -q shell rescanPlugins >/dev/null
for _ in {1..40}; do
  omarchy-plugin-list --json | jq -e --arg id "$PLUGIN_ID" 'any(.[]; .id == $id)' >/dev/null && break
  sleep 0.05
done
omarchy plugin enable "$PLUGIN_ID"

echo
echo "== 3/3: adding it to the Applications list =="
# The Apps submenu of the Super+Space menu is fed by desktop entries, so this
# file is what makes it launchable there. Anything already at that path that we
# did not write gets backed up rather than clobbered.
if [[ -f $DESKTOP_DEST ]] && ! grep -qF "$MARKER" "$DESKTOP_DEST"; then
  backup="$DESKTOP_DEST.bak.$(date +%Y%m%d%H%M%S)"
  mv "$DESKTOP_DEST" "$backup"
  echo "Backed up your existing entry to $backup"
fi
install -Dm644 "$DESKTOP_SRC" "$DESKTOP_DEST"

echo
echo "Done. Super+Space -> Apps -> Bar Configurator."
echo "Uninstall with: $REPO_DIR/uninstall.sh"
