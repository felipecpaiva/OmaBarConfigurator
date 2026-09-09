# OmaBar Configurator

Show, hide and reorder the widgets on your Omarchy bar from one panel.

It is a **panel** plugin, not a bar widget. Installing it does not ask you to
pick a bar section and does not add a fifteenth icon to the bar. It lands in
the **Applications** list instead, next to your other apps.

```
Super+Space -> Apps -> OmaBar Configurator
```

## Install

```bash
git clone https://github.com/felipecpaiva/OmaBarConfigurator.git
cd OmaBarConfigurator
./install.sh
```

No sudo. Re-running it is safe. Uninstall with `./uninstall.sh`.

What install.sh touches, and nothing else:

| Path | What lands there |
|---|---|
| `~/.config/omarchy/plugins/io.github.felipecpaiva.omabarconfigurator/` | the plugin itself |
| `~/.config/omarchy/shell.json` | one `plugins[]` entry, via `omarchy plugin enable` |
| `~/.local/share/applications/omabarconfigurator.desktop` | the Applications entry |

It never writes `bar.layout`, and it never edits your
`~/.config/omarchy/extensions/omarchy-menu.jsonc`. An existing file at the
desktop-entry path that this plugin did not write is moved to a timestamped
`.bak` rather than overwritten, and `uninstall.sh` only ever deletes an entry
carrying `X-OmaBarConfigurator-Managed=true`.

## Why it is in Apps and not on the bar

`omarchy plugin add` only offers the bar-section picker to plugins whose
manifest declares `bar-widget`
(`omarchy/bin/omarchy-plugin-add:45`). This one declares
`"kinds": ["panel"]`, so enabling it appends to `plugins[]` in `shell.json`
instead of splicing into `bar.layout`
(`omarchy/shell/services/PluginRegistry.qml:542`).

The Apps submenu of the Omarchy menu is fed by desktop entries. The `apps`
provider reads the shared `AppLibrary`, which is
`DesktopEntries.applications` (`omarchy/shell/plugins/menu/Menu.qml:290`,
`omarchy/shell/services/AppLibrary.qml:53`). So a `.desktop` file in
`~/.local/share/applications` is what puts it in that list. Selecting the row
runs its `Exec`:

```
omarchy-shell shell toggle io.github.felipecpaiva.omabarconfigurator
```

which is the same IPC surface the shipped menu uses for its own panels
(`omarchy/default/omarchy/omarchy-menu.jsonc:100`).

## Optional: a menu row as well

App rows are searchable but not routable, so `omarchy menu summon` cannot
reach one. If you want a keybindable route, add a static row under the same
submenu, which survives `omarchy update`:

```jsonc
// ~/.config/omarchy/extensions/omarchy-menu.jsonc
"apps.bar-configurator": {"icon":"󰍜","label":"OmaBar Configurator","action":"omarchy-shell shell toggle io.github.felipecpaiva.omabarconfigurator"},
```

Static children of `apps` survive every re-run of the apps provider, which
only replaces rows of kind `app`
(`omarchy/shell/plugins/menu/MenuModel.js:120`). Only whole-line `//`
comments are allowed in that file. An inline trailing comment breaks the
parse and silently drops **every** entry in it.

`install.sh` deliberately does not write this line, because that file is
yours to hand-edit. Remove it yourself if you uninstall.

## Removal

```bash
./uninstall.sh
```

It reverses the install and nothing more:

| Path | What happens |
|---|---|
| `~/.config/omarchy/plugins/io.github.felipecpaiva.omabarconfigurator/` | deleted |
| `~/.config/omarchy/shell.json` | the `plugins[]` entry removed, via `omarchy plugin disable` |
| `~/.local/share/applications/omabarconfigurator.desktop` | deleted **only** if it carries `X-OmaBarConfigurator-Managed=true` |
| `~/.config/omarchy/oma-bar-configurator.json` | left in place, so a reinstall still knows where your hidden widgets came from |

Your `bar.layout` is not touched. Anything you hid stays hidden — turn it back
on in the panel first if you want the bar restored before removing the plugin.
A `.bak` the installer made from a desktop entry it did not write is left alone.

## Requirements and dependencies

- **Omarchy** with the Quickshell desktop running. Check with
  `omarchy-shell shell ping`, which answers `ok`.
- **`jq`** — used by `install.sh` to poll the plugin registry. Already a
  dependency of Omarchy's own plugin CLI, so it is present on any Omarchy box.
- Omarchy's own commands: `omarchy plugin enable/disable/validate`,
  `omarchy bar`, `omarchy-shell`, `omarchy-plugin-list`.

Nothing else. No bundled libraries, no network access, no build step, no
runtime beyond what the shell already provides.

## License and credits

MIT, see [LICENSE](LICENSE).

The panel is built from Omarchy's own `qs.Ui` and `qs.Commons` components —
`Panel`, `PanelHero`, `PanelSectionHeader`, `ToggleSwitch`, `CursorSurface` and
friends. They are **imported at runtime, not vendored**: no Omarchy source is
copied into this repository. Omarchy is MIT-licensed by 37signals.

The screenshots in `docs/shots/` are original, taken on the author's machine.
