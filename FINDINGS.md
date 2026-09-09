# Verified constraints — read before writing code

Established by experiment on 2026-09-08, not assumed. Do not re-litigate these; if you think one is
wrong, prove it with a command and say so.

## A third-party PANEL plugin cannot write bar.layout

`shell.qml:639` exposes `_mutateBarConfig`, but it is gated:

```
_mutateBarConfig: hasCurrentBarCapabilities() ? shell.mutatePluginBarConfig(mutator) : false
hasCurrentBarCapabilities()  -> barCapabilities && pluginHasBarCapabilities(currentManifest())
pluginHasBarCapabilities(m)  -> manifestHasKind(m, "bar")        # shell.qml:354-356
```

`kinds: ["bar"]` means a **full bar replacement**, not a panel. So the panel must not be designed
around mutating config directly.

## The mechanism that DOES work: drive the CLI

Proven end to end, including on a **built-in** widget:

```
omarchy plugin disable omarchy.weather                        # -> spliced out of bar.layout.center
omarchy plugin enable  omarchy.weather --section center --index 2   # -> back in the exact slot
```

Round-trip verified byte-identical against a pre-probe copy of shell.json. Call these the way the
rest of the shell shells out (`Quickshell.execDetached` / `Util.execArgv`), never a hand-rolled
shell.json write.

## Disable DISCARDS the entry, so inline settings are lost

`PluginRegistry.qml:556` is `config.bar.layout[section].splice(index, 1)` — the entry object goes
with it. Nothing stores it. Observed live: re-enabling `google-calendar.clock` brought it back
showing its alternate format, because its inline `format` never survived the splice.

**Consequence:** hiding must persist the whole entry — `{id, section, index, ...inline settings}` —
in our own plugin settings, and restore it verbatim. Persisting only the id is a data-loss bug.
Widgets that carry real inline state today include `felipe.tray` (`pinned`, `hidden`,
`alwaysShow`), the clock (`format`, `formatAlt`, `verticalFormat`) and `omarchy.indicators`.

## Do not create a dangling centerAnchor

Hiding the widget named by `bar.centerAnchor` un-pins the whole centre section: the list falls back
to group-centering and every centre widget slides when the indicators reveal on hover. Measured at
65px. Either refuse to hide the anchor widget, or re-point the anchor as part of the same change.

## Reading the journal is not optional

A QML exception aborts the rest of its enclosing function and surfaces **only** as a WARN line in
`journalctl --user`. No crash, no UI error. After every change:

```
journalctl --user --since "2 minutes ago" | grep -iE "qml|TypeError|WARN"
```

## Verification without a mouse

No click injection exists here (`ydotool`, `dotool`, `wlrctl`, `xdotool` absent; `/dev/uinput` is
root-only). Available instead:

```
qs -p /home/felipe/omarchy/shell/shell.qml ipc call <plugin-id> open    # close verb is `hide`
hyprctl dispatch 'hl.dsp.cursor.move({x=N, y=N})'                       # named args in a Lua table
grim -g "X,Y WxH" out.png                                               # logical in, physical out
omarchy-restart-shell                                                   # hot reload is unreliable
```

**Correction (verified 2026-09-08):** `omarchy-shell call <plugin-id> ...` fails because the
plugin is the ARGUMENT, not the target. The working form is `omarchy-shell shell summon <id>`
/ `hide <id>` / `toggle <id>` — target `shell`, method `summon`. Proven live:
`omarchy-shell shell summon omarchy.wifiqr` returns `ok`. `qs ... ipc call <id> open` also works
for widgets that register their own IPC target; both are valid, for different things.
Export `HYPRLAND_INSTANCE_SIGNATURE` and `WAYLAND_DISPLAY=wayland-1` first, and run these with the
sandbox off.

## The reference to beat

`omarchy.network`, opened over IPC and captured with grim. Its anatomy: glyph + bold title + a
small-caps tagline, trailing action glyphs and a master toggle on the header row; a two-column
stat grid; a small-caps section header over a 4-way button group; then stacked small-caps sections
of rows, each row a glyph + label with an optional sub-label and a trailing state glyph.

## Why installing a marketplace plugin always prompts for a bar location

`bin/omarchy-plugin-add:45` gates the prompt on the manifest:

```bash
jq -e '(.kinds // []) | (index("bar") | not) and (index("bar-widget") != null)' ... || return 0
gum choose --header="Place $id in which bar section?"
```

So the prompt fires for any plugin declaring `bar-widget`. A **panel-only** manifest is never asked,
and `PluginRegistry.qml:542` pushes it to `config.plugins` rather than `bar.layout`. This is the
root cause of the complaint that started this work, and it is why our manifest declares
`kinds: ["panel"]`.

## The Applications list is fed by desktop entries, not the menu extension

`omarchy-menu.jsonc:24` marks `apps` as `"provider":"apps"`; `Menu.qml:287-293` fills it from the
shared AppLibrary; `AppLibrary.qml:53` reads `DesktopEntries.applications` — the XDG scan of
`~/.local/share/applications`. A JSONC row parented under `apps` is a different mechanism: static,
routable by `omarchy menu summon`, but carrying no app icon or launch feedback. Desktop entries are
the opposite: real app rows, never routable.

Live precedent on this machine: `bobbynicholas.omaland`, a third-party `kinds:["panel","service"]`
plugin, ships `~/.local/share/applications/omaland.desktop` with
`Exec=omarchy-shell shell toggle bobbynicholas.omaland` and an `X-Omaland-Managed=true` marker.

## `Array.isArray()` is FALSE across the host's `var` property boundary

Reported by the panel builder, 2026-09-08, after it cost a debugging cycle. `shell.barConfig` has
the right content and indexes fine, but `Model.sectionEntries` read every section as empty, so the
panel rendered a hero over an empty list — **with no error anywhere**. The arrays arrive as
QML/JS-engine objects that fail `Array.isArray`.

Fix applied in `Panel.qml`: `JSON.parse(JSON.stringify(shell.barConfig))` before handing it to
`Model.js`. Model.js is not wrong. Anything else consuming a host `var` will hit this.

*Status: empirical, from the failure and the fix. Not independently re-derived.*

## Two settings-restore bugs in Omarchy itself

Both hit while restoring inline settings, both are silent data loss, and both are worth reporting
upstream separately from this plugin.

1. **`omarchy-shell` drops an empty-array argument.** `omarchy-bar set felipe.tray pinned [] --json`
   fails with `Too few arguments provided (4 required but 3 were provided.)`, and so does the direct
   IPC call. Harmless for `[]` specifically, since absent and empty mean the same thing here.
2. **A JSON array argument is stored as a string.** `omarchy bar set <id> <key> '["x"]' --json`
   wrote `"pinned": "demo.desktop"`. The CLI passes the JSON through correctly
   (`omarchy-bar:353`), so the coercion is inside `setBarWidget`/`PluginRegistry`. **This makes a
   restore of any non-empty array setting lossy.**

Probing (2) corrupted the live `felipe.tray` entry; it was restored from a pre-test backup and the
`bar` subtree verified clean afterwards. Do not probe it again on the live config.

## Nerd Font Material glyph names do not match modern MDI

Verified by rendering a contact sheet before use, which caught two wrong glyphs already shipped in
a first pass: `dock-top` (F0F49) draws a **pen**, and `keyboard` (F030B) draws a **wrench**. Always
render a glyph and look at it; never trust the name.
