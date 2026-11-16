# OmaBar v0.2 plan

Status: approved direction (one hidden painter, option 1), not started. Written 2026-11-16, revised
the same day.
Architecture: [architecture.md](architecture.md). Rules: [engineering-standards.md](engineering-standards.md).

## Feature list and verdicts

Ranked by lowest resource cost first, then most customization. Verdicts approved by Felipe on
2026-11-16.

| # | Feature | From | Cost | Verdict | Batch |
|---|---|---|---|---|---|
| 1 | Pills: one per section by default, the user splits a section with breaks in the panel | Nyxiri, Islands (PhyAMR) | none | now | 2 |
| 2 | Pill style: color role or hex, fill and border opacity, border width, radius, padding, gap | Nyxiri | none | now | 3 |
| 3 | Every setting in the OmaBar panel | Nyxiri | none | now | 3 |
| 4 | Pills follow the theme on theme switch | Islands Bar, Nyxiri | none | now | 2 |
| 5 | Bar background clear, glassy or opaque from the panel | stock `omarchy bar background` | none | now | 3 |
| 6 | Layout presets, first one "Denial": widgets right, workspaces center | Denial | none | now | 4 |
| 7 | Radius can follow Hyprland window rounding | Islands Bar | none | now | 3 |
| 8 | One pill per widget as an option for a group | Islands Bar, Nyxiri | none | later | |
| 9 | Soft top lit gradient fill | Denial | none | later | |
| 10 | Blur behind pills | Denial | GPU | later, measure first | |
| 11 | Pills slide in when the bar starts | Denial | small | skip | |
| 12 | Different bar per monitor | Nyxiri | needs a copied bar | skip | |
| 13 | Indicators always shown, tray arrow only when needed | Islands Bar | needs copied widgets | skip | |
| 14 | CPU and GPU cards with charts | Denial | polling | skip, use an existing plugin | |
| 15 | Move a whole pill to left, center or right from the panel | Felipe | none | now | 4 |
| 16 | Real spacing between widgets, so padding and split gaps match Denial | Felipe | unknown | later, needs research | |
| 17 | "Grouped" preset: all groups centered together with gaps, each growing outward as it fills (impasto style); plus "Spread" to go back | Felipe, impasto | none | now | 4.5 |
| 18 | Smooth expanding animations for pills and groups, like impasto | Felipe, impasto | small, only while changing | now, measure | 4.5 |

## Batches

Each batch ends green on `bash test/run-all.sh` and is logged in `docs/batch-log.md`.

### Batch 0: setup
- `test/run-all.sh`: node tests, `qmllint`, `shellcheck` (prints SKIP when missing), scrub check.
- Branch `v0.2-group-pills`. `main` stays frozen until release.
- **Done when** the runner passes on the current code with no behaviour change.

### Batch 1: spike the painter
- Minimal `pills/PillPainter.qml`, throwaway, kept on the branch only. One invisible entry.
- Prove: one instance reaches every `ModuleList` on its bar surface; a zero-space entry leaves the
  bar pixel identical with the clock masked; one instance per monitor.
- Confirm the exact private names and the parent chain; write them in architecture.md section 9.
- Write `test/adapter-contract.js` against the installed `Bar.qml`.
- Check: the panel still opens with the painter in each section; `omarchy bar move` with
  `--from-section` and `--from-index` copies exactly.
- **Done when** a screenshot (grim) shows a rectangle behind slots in `left`, `center` and
  `right`, horizontal bar, the contract test passes, and the screenshot with the painter equals
  the one without it. No input injection; Felipe is asked before any live shell reload.
- **Stop rule.** If one instance cannot reach every section, or the entry changes the bar, stop
  and bring the choice back to Felipe. Do not start batch 2.

### Batch 2: painter, breaks, default pill per section (rows 1, 4)
- `lib/GroupLayout.js` with tests: one pill per section, breaks, empty section, hidden widgets,
  widget added after a break, repeated id (first match), center area as one, vertical bar.
- `pills/BarAdapter.js`, `pills/PillShape.qml`, the real `pills/PillPainter.qml`.
- `lib/PillStyle.js` with defaults and `enabled: false`; the painter reads the store.
- Manifest gains `bar-widget` with section default `right`, displayName "OmaBar pills".
- **Done when** tests pass, screenshots show one pill per section with the clock still centered, a
  theme switch recolors the pills, and turning pills off returns the stock look.

### Batch 3: style and groups pages in the panel (rows 2, 3, 5, 7)
- `panel/StylePage.qml` and `panel/GroupsPage.qml` (break toggles); the store write goes through
  one function in Panel.qml.
- Bar background buttons call `omarchy bar background <value>`.
- Store moves to `"version": 2` with `hidden`, `style`, `groups`; unknown keys kept, bad values
  fall back to defaults and log once.
- **Done when** every control changes the pills live, a hand edit of the store with bad values
  does not break the bar, and the store round trip test passes.

### Batch 4: presets and move pill (rows 6, 15)
- Fix from v0.1: the Widgets page must also list `centerBegin` and `centerEnd` (Model.js REGIONS).
- `lib/Presets.js`: preset to an ordered list of `omarchy bar move` argv; snapshot of the layout
  saved in the store before applying; one Undo button.
- Presets name widgets by role, never by fixed id: "the workspaces widget" matches
  `omarchy.workspaces` or any widget that declares itself as one (here `tornikegomareli.spaces`).
- Move pill (row 15): the panel moves every widget of the pill, in order, with
  `omarchy bar move <id> --from-section S --from-index N --section T`, then moves the pill's break
  in the store. Offered in `panel/GroupsPage.qml`.
- Presets and move pill follow the `centerAnchor` rule in FINDINGS.md: never leave the center
  without its anchor; re-point it in the same change.
- **Done when** applying "Denial" then Undo, and moving a pill then Undo, each give back a byte
  identical `bar.layout` (same proof style as FINDINGS.md), inline widget settings survive, and the
  anchor rule held.

### Batch 4.5: look and feel pass (requested by Felipe, 2026-11-16)
Before release, a visual pass judged on screenshots against Denial, Islands Bar and Nyxiri
(quality bar section 1, blind side by side). Known problems, from Felipe:
- **Workspaces widget inside a pill (top left).** The way `tornikegomareli.spaces` marks the
  active window and desktop (its own tall tiles) looks wrong inside a pill: a box inside a box,
  taller than the pill. Options to weigh: the widget's own style settings (`activeStyle`,
  `density`), a per-group "no pill" or "tight" option, or letting a widget that paints its own
  background opt out of the shared pill.
- **Spacing between widgets inside a group.** Splits and the space around widgets in a pill do not
  look right. Ties to row 16 (real spacing); research what control Omarchy gives before choosing.
- **Done when** Felipe approves before and after screenshots of the bar, and the blind comparison
  rates ours at least as clean as the two competitors.

### Batch 5: release v0.2.0
- **Gate (Felipe, 2026-11-16): no release until Felipe says the experience, quality and results are
  where he wants them.** Batches before it iterate as long as needed. Commit and push the working
  branch after every batch so nothing is lost.
- `uninstall.sh` repeats `omarchy plugin disable` until no painter entry is left.
- README: what pills are, the install prompt note, the corrected `bar.layout` line, the recovery
  command `omarchy plugin enable io.github.felipecpaiva.omabarconfigurator` if the painter entry is
  removed, screenshots, and credits to Islands (PhyAMR) for the painter idea, Islands Bar, Nyxiri and Denial.
- Version `0.2.0`, GitHub release with screenshots, marketplace "Plugin verification" form.
- **Done when** a clean install and uninstall leave `shell.json` as it was.

## Decisions

1. (2026-11-16) The bar entry is called **OmaBar pills**. It is invisible, one per bar.
2. (2026-11-16) Default style uses Denial's sizes: fully round radius, 12 px inner padding, 8 px
   gap between pills, 5 px space above and below.
3. (2026-11-16) **Option 1, one hidden painter**, replaces many Group markers. Reason: Omarchy
   cannot add a second copy of a third-party bar widget, and removing every entry turns the plugin
   off (architecture.md section 2.2). Groups live in the panel and the store; default is one pill
   per section; the user adds breaks.
4. (2026-11-16) Row 15, move a whole pill to left, center or right, ships in batch 4 with presets,
   with Undo through the same layout snapshot.
5. (2026-11-16) Spacing, option A: keep one pill per section as the look for now. Widgets touch,
   so splits overlap a few pixels and the outer padding is smaller than 12 px. Real spacing is a
   later setting (row 16).
6. (2026-11-16) Settings are grouped by topic, like omahop: one spec file (`settings/spec.json`)
   defines every setting with its topic, subgroup, help and advanced flag; the panel shows one
   topic at a time (Widgets, Pills, Groups, Bar) and a new topic needs no panel code. Defaults stay
   in `lib/PillStyle.js` only.
