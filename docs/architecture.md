# OmaBar architecture (v0.2, group pills)

Status: design, not built. Written 2026-11-16 on Omarchy 4.5.0. Revised 2026-11-16 (one hidden
painter). Read with [plan.md](plan.md) and [engineering-standards.md](engineering-standards.md).

## 1. What we are adding

OmaBar today is a **panel** plugin: it shows, hides and reorders bar widgets by driving the
`omarchy` CLI. v0.2 adds **pills**: rounded shapes drawn behind groups of widgets, on a clear
bar, so the wallpaper shows between the pills. Groups are defined in the panel, not in the bar.

Sources of ideas (no code copied): Islands Bar (raavail-lasso), Nyxiri (Deoxizn), Denial
(denialwm). The build method, a widget that draws into the stock bar instead of a copied bar,
comes from Islands (PhyAMR). All four are MIT except Denial (GPL-3.0); from Denial we take only
sizes and looks.

## 2. Key decisions

### 2.1 A painter widget, not a copied bar

| | Painter widget (chosen) | Copied bar (`kind: "bar"`) |
|---|---|---|
| Code we own | about 300 lines | about 3,200 lines copied from Omarchy |
| Omarchy fixes to the bar | arrive by themselves | merged by hand after each update |
| Widgets that use a service | keep working | render empty (omacom/omarchy#11713, open) |
| What it depends on | a few internal property names of the stock bar | the whole bar file |

One of the current bar widgets (`io.github.jcarcinogen.gaming-console`) calls `serviceFor()`, so a
copied bar would blank it today. That settles the choice.

### 2.2 One hidden painter, not many markers (decided 2026-11-16)

The first design put many *Group* markers in the bar, one per pill. It does not work, because of
two facts found on Omarchy 4.5.0:

1. **Omarchy has no supported way to add a second copy of a third-party bar widget.**
   `omarchy bar put` is a no-op once one copy exists, and `omarchy plugin enable` adds at most one.
   Only hand editing `shell.json` works, and OmaBar never writes `shell.json`.
2. **For a third-party plugin, "enabled equals present".** If every bar entry of the plugin is
   removed, the plugin, panel included, stops loading. `omarchy plugin disable` removes one bar
   entry per call.

So the design uses exactly **one** bar entry, which is the thing `enable` already gives us:

- The entry is the **OmaBar pills** widget (`pills/PillPainter.qml`). It is invisible and takes
  zero space. Its position in the bar does not matter, `center` included.
- On each bar surface (one instance per monitor) it walks from its own slot up to the bar surface
  and finds every section's `ModuleList`. It draws the pills behind the slots of all sections.
  The stock bar stays the stock bar.
- Groups live in the panel and in the store file (section 5), not in `bar.layout`.
- It never sits in the user's way. Uninstall removes it (repeat `omarchy plugin disable` until
  none is left).

**Default.** When pills are on, each section is one pill (panel mode: one unified background per
section, like Nyxiri's island mode). `centerBegin`, `center` and `centerEnd` form one center area
for pill purposes. The user splits a section in the panel by marking "a new pill starts at widget
X". That mark is a **break**: a list of widget ids per section. Widgets added later join their
neighbour's pill automatically.

**Limit (documented, `shortcut:` in code).** Widget ids are unique in practice. For a repeated
id, the first match wins.

## 3. Code ownership

Three owners. Each file has exactly one.

| Owner | What | Rule |
|---|---|---|
| **Omarchy** | the bar (`$OMARCHY_PATH/shell/plugins/bar/`), `qs.Commons`, `qs.Ui`, the `omarchy` CLI, `shell.json` format | never copied, never edited, imported at runtime |
| **OmaBar** | every file in this repo, the store file `~/.config/omarchy/oma-bar-configurator.json`, and the one painter entry in `bar.layout` | we create them, we clean them up on uninstall |
| **The user** | `shell.json` as a whole, theme files, the order of their widgets | changed only through the `omarchy` CLI, never written by hand |

## 4. Module map

```
manifest.json            kinds: ["panel", "bar-widget"]; panel + barWidget entry points
settings/spec.json       every setting, grouped by topic (Widgets, Pills, Groups, Bar) with
                         subgroup, label, help and advanced flag; holds NO default values
Panel.qml                panel shell: topic switcher, the Widgets page (v0.1 list), store
                         reader and writer, the CLI runner, and the API the pages call
                         (settingValue, setSetting, writeStyle, writeBreaks, toggleBreak)
Model.js                 pure: layout reading, hide and show argv; never lists SELF_ID
panel/SettingsPage.qml   renders any spec topic: subgroup headers, Show advanced
panel/SettingRow.qml     one setting row: label, help, control by type
panel/GroupsPage.qml     Left, Center, Right lists with "New pill starts here" switches
panel/PresetsPage.qml    batch 4: presets and move pill (UI only)
lib/PillStyle.js         pure: DEFAULTS and LIMITS (the one place), normalize, colors,
                         store read, write and patch
lib/SettingsSpec.js      pure: spec validation against DEFAULTS and LIMITS, row state
lib/Groups.js            pure: rows and break toggling for the Groups page; agrees with
                         GroupLayout (tested)
lib/GroupLayout.js       pure: slots per area + breaks -> pill bounds
lib/Presets.js           batch 4, pure: presets AND move-pill argv, layout snapshot for Undo
pills/PillPainter.qml    the bar widget; thin wiring of the parts below
pills/BarAdapter.js      the ONLY file with private bar names; finds the bar surface and all
                         ModuleLists
pills/PillShape.qml      one Rectangle, drawing only
test/*.js                node tests for every pure file, plus the adapter contract check
```

### Responsibilities, one line each

- **PillStyle.js** turns whatever is in the store into a valid style, or the defaults. Knows
  nothing about QML.
- **GroupLayout.js** answers: given the slots of each section in visual order and the breaks,
  where does each pill start and end? Knows nothing about Omarchy.
- **BarAdapter.js** answers: from this painter, where is my slot, my bar surface, and every
  section's slots? The only place that reads private names of the stock bar. If a name is
  missing, it returns `null` and logs one warning.
- **PillPainter.qml** connects adapter output to GroupLayout and passes bounds to PillShape.
- **PillShape.qml** draws. No decisions.
- **Presets.js** turns a preset or a "move this pill" request into an ordered list of
  `omarchy bar move` argv, and builds the snapshot Undo restores.
- **StylePage / GroupsPage / PresetsPage** show controls and call the store writer or the CLI
  runner that Panel.qml already has. No business logic in delegates.

## 5. Data flow

```
Panel (Style, Groups tabs) ──writes──▶ oma-bar-configurator.json
                                       { "version": 2, "hidden": [...], "style": {...},
                                         "groups": { "breaks": { "<section>": ["<widget id>", ...] } } }
                                   │ FileView, watchChanges
                                   ▼
PillPainter ──▶ PillStyle.normalize ──▶ PillShape (color, radius, padding, ...)
PillPainter ──▶ BarAdapter.sections ──▶ GroupLayout.bounds(slots, breaks) ──▶ PillShape (x, width)
Panel (Presets, Groups tabs) ──▶ Presets.js argv ──▶ omarchy bar move (existing runner)
```

**Single writer.** Only the panel writes the store file. The painter only reads it. The panel
never writes `shell.json`; layout changes go through `omarchy bar` and `omarchy plugin` (see
FINDINGS.md: a panel plugin cannot mutate bar config directly).

**Store today and the change.** v0.1 writes `{ "version": 1, "hidden": [...] }` and rewrites the
whole file (`Panel.qml`, store `setText`). v0.2 bumps to `version: 2`, adds `style` and `groups`,
and the writer keeps every key it does not own, so one write never drops another key. A v1 file
reads as v2 with default style and no breaks.

**Why a store file and not inline widget settings.** Style and breaks are global in v1. Inline
settings live in `shell.json`, which only the CLI may write, and the CLI stores JSON arrays as
strings (FINDINGS.md, Omarchy bug). The store file already exists and already belongs to us.

**Move a whole pill (plan row 15).** From the panel, a pill moves to left, center or right. The
panel moves every widget of that pill, in order, with exact copy addressing:
`omarchy bar move <id> --from-section S --from-index N --section T ...` (`--from-section` and
`--from-index` are given together). It then moves the pill's break in the store. It must obey the
`centerAnchor` rule in FINDINGS.md: never leave the center without its anchor, re-point the anchor
in the same change. Undo uses the same layout snapshot as presets.

## 6. Contract with Omarchy

Public, safe to use: `BarWidget` (`setting()`, `bar`, `vertical`, `barSize`, `moduleName`),
`Color.*` (`background`, `foreground`, `accent`, `urgent`, `muted`, `bar.*`), `Style.duration()`,
`Style.cornerRadius`, the `omarchy bar` and `omarchy plugin` CLI, the manifest schema.

Private, used only in `pills/BarAdapter.js`, checked by `test/adapter-contract.js` against the
installed `Bar.qml`. Read from Omarchy 4.5.0 source, to be confirmed live in batch 1:

- A widget is loaded inside a `WidgetHost`. `WidgetHost.owner` is the `ModuleSlot` showing it
  (null while it waits in the pool). Walking up from the painter to the first item with `owner`
  and `pool` finds the host; `owner` gives the slot as a binding. This beats the 2 s timer
  PhyAMR uses to find its slot.
- `ModuleSlot` has `region`, `widgetKey`, `entry`, `moduleName`, `activeItem`, `widgetHolder`.
  Its parent is the section's `ModuleList`, a `GridLayout` (flow top to bottom on a vertical
  bar). The ModuleList's children also include its `Repeater` and drag spacers, so slots are
  found by filtering for items that have `widgetKey`.
- Chain from a loaded widget: widget -> `registryLoader` -> `WidgetHost` -> (placed) `holder` ->
  `widgetArea` -> `ModuleSlot` -> `ModuleList`. Confirmed in Bar.qml source by
  `test/adapter-contract.js` (2026-11-16).
- **New in the painter design:** from the painter's `ModuleList`, go up to the bar surface, then
  down to every other section's `ModuleList`. Batch 1 proves this from one instance.

**What `omarchy plugin enable` does.** For a plugin with `bar-widget`, enable places one entry on
the bar in the default section (`PluginRegistry.qml`, the `!onBar && isBarWidget` branch). That
is now the design: `install.sh` puts the one painter on the bar. The README line "never writes
`bar.layout`" must change to say this.

**Panel lifecycle.** If the user removes the painter entry, the plugin turns off, panel included
(section 2.2, fact 2). Recovery: `omarchy plugin enable io.github.felipecpaiva.omabarconfigurator`.
Documented in the README (batch 5). The panel's own widget list must not offer to hide its own
painter entry.

**Fail safe.** If the contract breaks after an Omarchy update, the painter draws nothing and takes
zero width. The bar looks stock, every widget still works, one warning lands in
`journalctl --user`. The contract test fails, which tells us which name moved. A broken OmaBar
must never break the bar.

## 7. Rules that keep it light

- **Zero idle cost.** No timers, no polling. Pills move only through bindings when a slot's
  position or size changes. (Islands by PhyAMR polls every 2 s for its icon swap; we do not ship
  that feature.)
- **Bounded work.** Layout work is O(widgets in one section) per change, about 15.
- **Off by default.** After install, the painter draws nothing and takes no space until the user
  turns pills on in the panel. Zero width is not proven invisible (a Row can add spacing), so
  batch 1 compares screenshots with and without the painter, clock masked.
- **Position never matters.** The painter's slot, `center` included, never changes the layout or
  the clock position.
- **Motion** follows the Omarchy plugin rules: `Style.duration()`, ease out, under 300 ms, so
  `omarchy toggle animations` turns it off.
- **Theme first.** Colors come from `Color.*` roles or a hex the user picks. No own palette.

## 8. Known risks

| Risk | Effect | Handling |
|---|---|---|
| Omarchy renames a bar internal | no pills | fail safe (section 6), contract test, fix in one file |
| The painter reaches all sections, not only its own | more coupling to bar internals than one slot | still one file (`BarAdapter.js`); the contract test names each private name |
| User removes the painter entry | plugin and panel stop loading | recovery command in README (batch 5); panel never offers to hide it |
| Widget paints its own background | box inside a pill | per-pill "no pill" option, later |
| `bar-widget` kind makes `omarchy plugin add` ask for a bar section | one prompt on install | Esc skips the prompt; README says so; the painter draws nothing while pills are off |
| Marketplace may object to a widget that draws into the bar's own tree | update not verified | no written rule found in `SUBMISSION.md` or `SECURITY.md` (checked 2026-11-16); PhyAMR's plugin is not listed, so there is no precedent. Ask in the verification form before release |
| Marketplace listing is commit bound | the update needs the verification form | done in the release batch |
| Plugin removed while the painter is in the layout | unknown id left in `shell.json` | `uninstall.sh` repeats `omarchy plugin disable` until none is left; checked in the release batch |
| Repeated widget id in one section | break lands on the first match | documented `shortcut:` limit |

## 9. Spike results (batch 1)

Run 2026-11-16 on Omarchy 4.5.0, one laptop screen at scale 2, horizontal top bar. Code:
`docs/research/painter-spike/` (throwaway, not shipped). Evidence: screenshots compared with
Pillow, clock area masked, plus `journalctl --user` lines from the painter.

| Question | Result |
|---|---|
| Can one instance reach every section? | **Yes.** From its own item it walks up to the bar surface root and finds every `ModuleList` (duck typed: `listRows`, `keys`, `region`, `pool`). It found 8: `left`, `right`, `centerBegin`, `center`, `centerEnd`, plus 3 empty center lists. The tray drawer list is skipped by `region === "tray"`. |
| Do pills draw in the right place? | **Yes.** One `Rectangle` per list, created with `createObject(list.parent)` and `z: -1`, sits behind the widgets of left, center and right. The three center lists draw three overlapping pills, so the center area must be unified (batch 2). |
| Does the painter take space? | **No.** Painter present with pills hidden vs plugin disabled: **0 pixels differ** over the whole bar, same theme, same minute. A `visible: false` widget gives its slot 0 width and ModuleList spacing is 0. |
| Does cleanup work? | **Yes, when written by hand.** Pills are parented to the bar's own items, so they outlive the painter unless destroyed. `Component.onDestruction` that destroys every pill runs on `omarchy plugin disable` (logged). A first version that used an `Instantiator` left pills on screen after a reload. Rule: create pills with `createObject`, keep the list, destroy them on destruction. |
| Does editing the code reload it? | **No.** The shell logs "reloading" but keeps the cached component, even across disable and enable. New code loads only after `omarchy restart shell`. The dev loop is: edit, restart shell, screenshot. |
| One instance per monitor? | **Not tested.** Only one screen here, and adding virtual monitors is not allowed on this machine. To check on a second real screen before release. |
| Vertical bar? | **Not tested** in the spike. Batch 2 test list. |

Side effect seen: `omarchy restart shell` made the user's theme-modes plugin apply its scheduled
theme (it switched to a light theme). Every live test that restarts the shell must say so first.

Spike-only shortcuts not to ship: a one-shot `Timer` to wait for the bar to build (the real
painter rescans on a signal or binding), the `showPills` constant, hard coded sizes and colors.
