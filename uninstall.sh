#!/usr/bin/env bash
# Reverses install.sh. Safe to run even if install only partially completed.
set -uo pipefail

PLUGIN_ID="io.github.felipecpaiva.omabarconfigurator"
PLUGIN_DEST="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
DESKTOP_DEST="$HOME/.local/share/applications/omabarconfigurator.desktop"
MARKER="X-OmaBarConfigurator-Managed=true"

echo "== 1/3: removing it from the Applications list =="
# Only ever delete the file we wrote, identified by its marker key.
if [[ -f $DESKTOP_DEST ]] && grep -qF "$MARKER" "$DESKTOP_DEST"; then
  rm -f "$DESKTOP_DEST"
else
  echo "No managed entry at $DESKTOP_DEST; leaving it alone."
fi

echo "== 2/3: disabling the plugin =="
omarchy plugin disable "$PLUGIN_ID" 2>/dev/null || true

echo "== 3/3: removing the plugin =="
rm -rf "$PLUGIN_DEST"
omarchy-shell -q shell rescanPlugins >/dev/null

echo
echo "Done. Nothing of this plugin is left in shell.json or the Apps list."
echo "If you also added the optional omarchy-menu.jsonc row from the README,"
echo "remove that line yourself, install.sh never wrote it."
