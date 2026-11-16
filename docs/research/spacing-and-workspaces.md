# Spacing, workspaces and bar size: what Omarchy 4.5 lets us control

Read-only research, 2026-11-16. Plan row 16 and batch 4.5. `OM` = the Omarchy install
(`$OMARCHY_PATH`, `/usr/share/omarchy`). `SP` = the installed `tornikegomareli.spaces` 1.8.0 plugin
folder. Nothing was changed on the machine to get these answers.

## 1. Spacing between widgets

### The bar has no gap setting
- Every section is a `GridLayout` with `rowSpacing: 0` and `columnSpacing: 0`
  (`OM/shell/plugins/bar/Bar.qml:2593-2595`). No bar-wide or per-widget gap key exists in the layout
  entry, in `shell.json`, or in the bar manifest.
- Widget padding is inside each widget. `WidgetButton` has `horizontalMargin: 8.5` and
  `verticalPadding: 6` (`OM/shell/Ui/WidgetButton.qml:15-16`). They are `property`s of the widget
  source, not settings. A widget author can change them, a user cannot.
- Theme `shell.toml` has `[spacing] scale` (default 1.0, shown in `OM/default/themed/shell.toml.tpl`)
  and per-token overrides (`xxs` to `huge`, `control-gap`, `row-gap`, `panel-gap` and so on). They
  scale shared margins and controls, and `Style.space()` (`OM/shell/Commons/Style.qml:221`) feeds
  them to widgets. That moves WidgetButton padding together with everything else in the shell
  (popups, panels, controls). It is a global scale, not a gap between two named widgets. Not usable
  as a spacing feature for OmaBar.

### `omarchy.spacer` is the only real gap
- Manifest: `allowMultiple: true`, `settingsForm: "spacerSettings"`, category Layout
  (`OM/shell/plugins/bar/widgets/Spacer.manifest.json:15-19`).
- Setting name is `size`, in px, default 12 (`Spacer.qml:8`). The widget is `size` wide on a
  horizontal bar and `visible: span > 0` (`Spacer.qml:10-12`), so `0` hides it. No clamp in the QML.
- No range is declared anywhere. The manifest has no `schema`, and the form name `spacerSettings`
  is not defined in any shipped QML or JS (grep of the shell and of the whole disk finds only the
  manifest lines). Treat 0 to about 64 as the sane range and clamp in OmaBar ourselves.
- The README example uses `{ "id": "omarchy.spacer", "size": 12 }` (`OM/shell/plugins/bar/README.md:32`),
  confirming the key.
- A spacer is a normal bar widget, so the layout sees it as a widget. In the pill painter it would
  be a slot like any other; it can sit inside a group and push the next widget away.

### How many copies can the CLI add: one
- `omarchy bar put` asks the shell `putBarWidget`, which returns at once when the widget is already
  on the bar (`PluginRegistry.qml:339-340` `if (inBar(id)) return ""`; CLI prints "is on the bar",
  `OM/bin/omarchy-bar:390-393`). So a second `put` is a no-op.
- `omarchy plugin enable` goes to `setEnabled`. For a bar widget already on the bar, `onBar` is
  true, so the insert branch is skipped (`PluginRegistry.qml:560-575`). With a placement it only
  calls `moveBarEntry`, which moves the existing first copy (`:325-337`, `:524`). Enable does not
  add a second copy for `allowMultiple` widgets either.
- `allowMultiple` is read once, into widget metadata (`OM/shell/shell.qml:1470`). No code in the
  bar or the registry checks it when placing. Only the user's own drag and drop in the bar, or
  hand edits of `shell.json`, make a second copy. `omarchy bar move` moves an existing entry; it
  cannot create one.
- Conclusion: through the supported CLI we can place exactly one `omarchy.spacer`. A single spacer
  cannot separate several widget pairs. The only way to get N spacers from OmaBar is to write
  `shell.json` ourselves, which FINDINGS.md rules out (panel plugins use the CLI).

### Addressing one copy for `set`
- `omarchy bar set <id> <key> <value> --section S --index I` works on a chosen copy: the shell
  takes the entry at `S[I]`, checks its id matches, and writes the key
  (`PluginRegistry.qml:360-395`). Without `--index` it takes the first match in `S`. The value is
  a string unless `--json` (`omarchy-bar:cmd_set`); `Spacer.qml` wraps it in `Number()`, so `"16"`
  works.
- `move` can also pick a copy: `--from-section` and `--from-index` (`PluginRegistry.qml:300-312`).
- Entries must be objects; a bare string entry gives "widget entry must be an object". Our own
  layouts write objects, so fine.

### Presets and Undo
- A spacer entry is a plain `{id, size}` object in `bar.layout`, same as any widget. A preset that
  records the layout (id plus settings per entry) can carry it, and Undo that restores a saved
  layout would too. What presets cannot do is re-create extra copies, because replaying a preset
  goes through `put`/`move`/`set` (inference from the CLI facts above, not tested). A preset with
  two spacers would end up with one.

### Recommended design for row 16
1. Do not promise real spacing between every pair. Offer exactly one **"Gap" spacer per bar**, set
   with `set omarchy.spacer size N` (0 removes it), placed with `put ... --after <id>` once and
   `move` afterwards. Good fit: the split between a left cluster and the next one, or the gap
   between two pills when "Own" pill mode (separate capsule per widget group) is not enough.
2. Inside a pill, use what the pill painter owns: its own `padding` and `gap` style fields (plan
   row 2) draw the capsule around widgets, but they cannot push two touching widgets apart,
   because the widgets already lay out with 0 spacing. The real fix for "widgets touch" is the
   "Own" pill mode: one capsule per widget gives 8 px outer gap with each widget's internal 8.5 px
   padding, which is close to impasto's 8 px padding.
3. Treat any wish for 16 px between icons inside one pill as out of reach with the CLI. State it
   in the UI as a known limit. If it matters later: a third-party widget can ship its own
   `gap` setting (Spaces has `density`), or propose an upstream `spacing` entry key to Omarchy.
4. Clamp `size` to 0..64 in OmaBar and write it as `--json` number to avoid the string form.

## 2. Workspaces (`tornikegomareli.spaces`)

Every manifest setting (`SP/manifest.json`, schema block). Key, values, default, effect:

| Key | Values (default first) | Draws |
|-----|------------------------|-------|
| showIcons | true / false | app icons in the pills |
| showApps | **hover**, all, active, hoverOnly | which pills show icons (`Model.showsApps`, `Model.js:151`) |
| iconStyle | **color**, mono | icon tint |
| activeStyle | **subtle**, solid, accent | active pill fill: 18 percent foreground, foreground, accent (`Spaces.qml:66-70`) |
| iconHighlight | **tile**, dot | focused app: tinted tile, or a dock dot (`Spaces.qml:1245-1285`) |
| pillBackground | **true** / false | idle pill fill (6 percent occupied, 12 percent hover) (`:1155`) |
| pillBorder | true / **false** | 1 px outline, only on pills showing icons (`:1162`) |
| labelStyle | **number**, glyph, none | the workspace label |
| iconSize | 12..24, **16** | icon px |
| density | compact, **normal**, roomy | gap 2/4/7, pad 5/7/10, icon gap 1/3/5 (`Model.js:157-161`) |
| pillHeight / pillPadding | 0..64 / 0..24, **0 = auto** | pill thickness, inner padding (`Model.js:166-204`) |
| pillShape | **auto**, oval | radius |
| maxIcons, groupApps, dimUnfocused, focusedTitle, titleLength, hideEmpty, perMonitor, persistentWorkspaces | see manifest | content |
| scrollSwitch, activeClick, activeIconClick, middleClickClose, movePointer, keepScratchpad | | behavior |
| animations, animationSpeed, tooltips, urgentHighlight, settingsButton | | motion and chrome |
| previews, previewActive, previewSize, previewLive | | hover previews |
| agentStatus, agentIcons, chromiumFavicons, activeIcon, wsIcon1..10 | | extras and custom glyphs |

### The box inside a box, explained
- The active workspace pill is filled (`activeStyle`, 18 percent foreground for the default).
- Inside it, the focused app gets a second tile, `Util.alpha(pill.textColor, 0.18)` with radius 5
  (`Spaces.qml:1278-1284`), but only when the pill holds more than one icon (`highlightFocused`,
  `:1243`). Two filled shapes, one inside the other: the complaint.

### Cleanest small marker with settings only
`iconHighlight = dot` removes the inner tile (`flat`, `:1245`); the focused app gets a dock dot, 5 px
by 2 px under the icon, accent colored on `subtle` (`:1273-1284`). Add `showApps = active` (or
`hoverOnly`) so only the active pill carries icons, `pillBackground = false` so idle pills have no
fill, `pillBorder = false`. The active pill still keeps its `activeStyle` fill (`:1152-1154` the
active branch comes first), so `subtle` is the least heavy.
This is closer to impasto but not the same: the marker is 5x2 under the focused app, not impasto's
22x6 dash under the workspace, and no setting draws a workspace-level dash. `showApps = hoverOnly`
with `labelStyle = none` is the quietest variant (no tile at all, just numbers and a fill).

### Clone and upkeep
- `omarchy plugin clone` refuses third-party widgets. It selects only `firstParty` entries and
  otherwise fails with "unknown built-in plugin" (`OM/bin/omarchy-plugin-clone:120-125`). So no
  CLI clone of Spaces. A manual copy of its folder into our own plugin would work but is a fork.
- A fork is 3.6k lines (Spaces.qml 1827, SpacesSettings.qml 869, Model.js 900) plus Hyprland IPC,
  previews and agent hooks. Upkeep: re-merge on every upstream release (it is already at 1.8.0 with
  frequent changes) and own all bug fixes. Not worth it for a marker style.

### Recommendation
Use **settings changes** first: one "Workspaces: quiet" preset entry that sets `iconHighlight=dot`,
`showApps=active`, `pillBackground=false`, `pillBorder=false`, `activeStyle=subtle` through
`omarchy bar set tornikegomareli.spaces <key> <value>`. Booleans need `--json true/false` or they
are stored as strings. Pair it with the "Own" pill mode so workspaces sit in their own capsule as in
impasto. Skip a clone. If the 22x6 dash is wanted later, ask upstream for a `dash` value of
`iconHighlight` rather than forking.

## 3. Bar-wide size from the theme

`[bar]` in `shell.toml` (`OM/default/themed/shell.toml.tpl`; read in `OM/shell/Commons/Style.qml:343-358`):

| Key | Default | Effect |
|-----|---------|--------|
| size-horizontal | 26 | bar height. Impasto is 32. |
| size-vertical | 28 | bar width on left/right bars |
| icon-size | 12 (max is icon-canvas) | glyph size. Impasto is 14. |
| icon-canvas | 16 | icon canvas, caps icon-size |
| icon-slot, status-slot | 27, 21 | button extent |
| scale-with-font | true | all of the above times font base-size / 12 |

- All values pass through `barToken` (`Style.qml:298-304`): rounded, floored at 1, multiplied by the
  font scale when `scale-with-font` is on. So 32 px and 14 px icons are reachable: `size-horizontal = 32`,
  `icon-size = 14` (canvas 16 allows it).
- The install's own `~/.config/omarchy/shell.toml` today holds only `[font] base-size = 12` (a
  partial file). Whether a partial user file merges with the generated defaults or replaces them
  was not tested. The template header says a theme `shell.toml` "replace[s] this generated file",
  so assume replacement and write a complete `[bar]` block.
- Widget padding (8 px) has no key. Only the global `[spacing] scale` (default 1.0) and tokens move
  shared padding, and WidgetButton's 8.5 comes from `Style.spaceReal` (`WidgetButton.qml:68`), so a
  scale of about 0.94 gives 8, with side effects on every popup and panel. Not recommended.
- This is a file edit of the theme, not a CLI call. OmaBar panel plugins may only change
  `shell.json` through the omarchy CLI, so a "match impasto sizes" option would have to be a
  documented manual step or a theme shipped by the user, not a panel button. Open question for
  the plan: whether editing the user `shell.toml` counts as allowed.

## Summary table

| Wish | Possible with CLI | How |
|------|-------------------|-----|
| One gap between two groups | yes | single `omarchy.spacer`, `size` |
| Gap between every widget | no | one copy max |
| Padding inside a pill | partly | pill painter style, "Own" mode |
| Quiet active marker | yes, approx. | Spaces settings (dot, active, no fill) |
| 22x6 dash | no | upstream request or fork |
| 32 px bar, 14 px icons | outside CLI | theme `shell.toml` `[bar]` |
