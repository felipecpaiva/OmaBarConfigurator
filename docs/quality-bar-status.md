# Quality bar status

Audit of every checklist line in [quality-bar.md](quality-bar.md), written 2026-11-16 on branch
`v0.2-group-pills`. Evidence comes from tests, [batch-log.md](batch-log.md), [research/cost.md](research/cost.md)
and the code. Nothing live was run for this audit.

Status words: **proven** (a test or a logged measurement covers the whole line), **partly**
(some of it is covered), **open** (nothing covers it yet), **open (lead, live)** (the lead is
running it now), **not testable here** (needs hardware this machine does not have).

`bash test/run-all.sh` ends `RESULT: OK` with the new `test/safety-test.js` (10 of 10). Only SKIP:
`shellcheck` (not installed).

## Summary

| Status | Count |
|---|---:|
| proven | 17 |
| partly | 13 |
| open | 7 |
| open (lead, live) | 3 |
| not testable here | 1 |
| Total lines | 41 |

## 1. Look

| Line | Status | Evidence | What is left |
|---|---|---|---|
| Default sizes (round ends, 12 px padding, 4 px gap, 3 px inset) | partly | Defaults and limits in `test/pill-style-test.js` ("defaults for empty input", "clamps every ranged number"). Batch 2 live: inset measured 5 px top and bottom at scale 2 (that was the older 5 px default). | No logged screenshot measurement of the current defaults at 1 px tolerance. 12 px padding cannot be fully met where widgets touch (batch 2 and 4.5 notes, plan decision 5). |
| Equal space at both ends of every pill | partly | Batch 4.5 "even pills live check": six scenarios judged on zoomed screenshots, ends equal. | Pixel scan was tried and dropped, so no number within 1 px. |
| Edges on whole pixels, scale 1 and own scale | partly | Batch 2 live at scale 2 (inset in device pixels). Pills move only on whole pixel changes (batch 4.5). Review S5: shapes round to logical pixels. | Scale 1 and fractional scale not checked. |
| Widget centered across pill height, within 1 px | partly | Batch 2 live: top and bottom inset equal (5 px). Batch 4.5: Spaces tile is taller than a pill (widget limit, not OmaBar). | No per widget measurement. |
| Clock exactly centered, painter on and off | proven | Batch 1 spike: 0 pixels differ. Batch 2 live: center widgets at the same device pixel columns before and after pills. | None. |
| Theme switch recolors with no restart | proven | Painter reads palette roles, never fixed colors (`test/safety-test.js` color check; `PillStyle.resolveColor` test). | Done live 2026-11-16: White, Catppuccin, Gruvbox, back to White; pills recolored at once, no errors. Note: on a solid dark bar (Catppuccin) pills nearly vanish (same color as the bar). |
| Light and dark both readable | partly | Batch 2 live on the White theme. | Dark theme screenshot and contrast check. |
| Vertical bars | proven | `test/group-layout-test.js` "vertical-style coordinates"; `test/bar-adapter-test.js` vertical surface. Batch 1: not tested live. | Done live 2026-11-16: bar moved left, pills drew along the vertical axis, moved back to top, no errors. Widget text (clock) can poke out of its pill sideways (widget's own layout). |
| Every monitor gets the same pills | not testable here | One painter instance per bar surface by design (architecture.md). | Needs a second monitor. Virtual monitors are not allowed on this machine. |
| Blind side by side with Islands Bar and Nyxiri | proven | Blind reviewer 2026-11-16: ours 28/30, Islands Bar 19, Nyxiri 15 (limits: different themes, sizes, widget counts). | Repeat before release with matched themes. |

## 2. Cost

| Line | Status | Evidence | What is left |
|---|---|---|---|
| Zero timers and zero polling in the painter | proven | `test/run-all.sh` step "no timers or polling in the painter" (grep of `pills/` and `lib/`). | None. |
| Idle CPU, on vs off, at most 0.1 point | partly | `docs/research/cost.md`: median difference -0.03 point (pass). Means are dominated by two outlier windows, so cost.md says it cannot prove 0.1 point. | Rerun on a quiet session, 10 or more windows per state. |
| RSS, at most 2 MB | partly | cost.md: settled windows +1.6 MB (pass); whole run inconclusive (100 MB drop unrelated to pills). | Same rerun. |
| A layout change recomputes only the section it touches | open | `PillPainter.qml` lines 67 to 71 build every area on each update; no test or measurement found. | Either show per section recompute or measure that the full recompute is cheap, then reword the line. |
| Blur, gradients and animations out of v0.2 unless they meet the numbers | proven | `grep -iE "blur|gradient|MultiEffect|ShaderEffect" pills lib` finds nothing. Only the glide and fade animations exist (`pills/PillShape.qml`), tied to `Style.duration`. | None. |

## 3. Safety

| Line | Status | Evidence | What is left |
|---|---|---|---|
| Pills off equals stock, pixel identical | partly | Batch 1: painter with zero space gives 0 pixels differ. Batch 2: off then on again equals the first on shot, 0 pixels differ. | The exact shot (pills off vs painter removed, clock masked) is not logged. Do it in the live pass. |
| Fail safe: missing private name gives nothing drawn, one warning | proven | `test/bar-adapter-test.js` "Fail safe": drops each private name in turn, asserts `locate` returns null and exactly one warning. `PillPainter.qml` `warnOnce` draws no pills after a fatal warning. | None for the adapter. The bar still working is shown by the spike cleanup, not by a new live fault injection. |
| Contract test fails loudly, naming the missing name | proven | `test/adapter-contract.js` prints `FAIL adapter-contract: <problem>` per missing name and exits 1; its self check feeds a broken `Bar.qml`. Batch 2: 21 names. | It exits 0 (skip) if Omarchy's `Bar.qml` is absent. |
| No OmaBar file writes `shell.json` | proven | New `test/safety-test.js`: the only write call in the code is `store.setText` on the plugin's own `oma-bar-configurator.json`; both `shell.json` FileViews are read only; every command is an `omarchy-*` CLI argv. | None. |
| Saving style never loses hidden or breaks, and the reverse | proven | `test/pill-style-test.js` "round trip: style survives hidden write, hidden survives style write", "patchStore round trip with hidden", "patchStore keeps unknown style and groups keys". | None. |
| Bad or hand edited store never breaks bar or panel, defaults, one warning | proven | New `test/safety-test.js`: broken JSON, wrong types, unknown keys; `readStore` never throws, gives defaults, one warning for unreadable text and one per bad key; `patchStore` and `writeStore` on garbage give valid JSON. `PillPainter.qml` and `Panel.qml` log each warning. | One warning per bad key, not one total, when many keys are bad. |
| Install then uninstall leaves `shell.json` the same | partly | New static test of both scripts (not run): install has `set -euo pipefail`, copies `lib pills panel settings`, validates before enable; uninstall loops `omarchy plugin disable` while the plugin is enabled (5 tries), deletes the desktop entry only with the marker, keeps the store file, disables before removing files. | Run it live with a `cmp` of `shell.json`. Findings below. |

Install and uninstall findings (read, not run):

- `uninstall.sh` ends with "Nothing of this plugin is left in shell.json" even if the loop gave up
  after 5 tries or `disable` failed (`|| break`). It never checks the result.
- The loop stops at 5. A bar with more than 5 references (re-installs without uninstall) would
  leave an entry. Install does not check that the plugin is already enabled before `enable`.
- Uninstall uses `set -uo pipefail` without `-e` on purpose (safe on a partial install), so one
  failed step does not stop it, but also hides the failure.
- `install.sh` runs `rm -rf` on the plugin folder before copying, which is safe (own folder only).
- Nothing else in either script touches `shell.json`; the difference after a clean cycle should
  only be key order.

## 4. Works with everything

| Line | Status | Evidence | What is left |
|---|---|---|---|
| Every widget on the bar keeps working inside a pill (tray drawer, spaces, gaming-console, elsewhen) | open | Batch 2 live saw center widgets in place; Spaces tile is taller than the pill (batch 2, 4.5). No per widget interaction check logged. | Live pass over each widget. |
| Drag to reorder in the stock editor, pills follow | open | Batch 4.5: pills follow their group, not their index (code change). | Live drag check. |
| Self hiding (zero size) widgets leave no empty pill or double gap | proven | `test/group-layout-test.js` "hidden and zero-size slots ignored"; `test/bar-adapter-test.js` "zero size and hidden are skipped". | None. |
| Painter position never changes layout or the clock | proven | Batch 2 live (clock columns unchanged); `test/presets-test.js` "Denial never moves the painter (2000 seeded layouts)" and "keeps the painter in its section and the anchor in center". | None. |
| Breaks survive reorder, hide and show | partly | `test/groups-test.js`, `test/model-test.js` hide and show round trips (byte identical, all 24 orders); batch 4.5 pills follow their group. | The live check named in the line. |
| Panel never offers to hide the painter | proven | `test/model-test.js` "barCatalogue never lists the painter's own entry". Batch 3 live: Widgets page does not list the painter. | None. |
| Move pill then Undo is byte identical, `centerAnchor` held | partly | `test/presets-test.js`: "move pill refuses to take the center anchor out", anchor checked at every step, 2000 seeded layouts, 40,000 replayed by the batch 4 reviewer. Batch 4 live proved Denial then Undo with `cmp`. | Live Move pill run (the line is marked live). |
| `omarchy toggle animations` off: no pill animates | partly | `PillShape.qml` uses `Style.duration()` and `Style.easeOut` (comment says it follows the toggle); the color fade defaults to 0 duration unless set by the painter. | Live toggle and a frame check. |
| Presets and Move pill: apply then Undo is byte identical, inline settings included | proven | `test/presets-test.js` "apply, undo, apply: byte identical, inline settings included". Batch 4 live: `cmp` identical after Denial and Undo. | None. |

## 5. Code

| Line | Status | Evidence | What is left |
|---|---|---|---|
| `bash test/run-all.sh` passes, every SKIP logged | proven | Run on 2026-11-16: `RESULT: OK`. The only SKIP, `shellcheck`, is in batch-log.md (batch 0). | Install shellcheck to remove the SKIP. |
| Every pure `.js` file has node tests for the cases in plan.md | partly | Each `lib/*.js` has a test (`group-layout`, `groups`, `pill-style`, `presets` covering `PresetTargets`, `settings-spec`), plus `Model.js` and `BarAdapter.js`. | Cases in plan.md not matched one by one. |
| Private bar names only in `pills/BarAdapter.js` | proven | `test/run-all.sh` step "private bar names" (grep for `widgetKey`, `widgetHolder`, `listRows`, `owner`). | None. |
| One component per QML file, QML under 200 lines, JS under 250 | partly | New files are within caps (largest `panel/GroupsPage.qml` 177, `lib/Presets.js` 236). | `Panel.qml` is 1261 lines (legacy v0.1 file, known debt in batch 4.5). No runner check enforces the caps. |
| No hard coded colors; every text is `Text.PlainText` | proven | New `test/safety-test.js` checks every `Text {` block and every QML file. `Qt.rgba` only applies opacity to theme colors. | None. |
| Every panel setting states its default in plain words | proven | `test/settings-spec-test.js`: every help must contain "default". | None. |
| Scrub check passes before every push | proven | `test/scrub.sh` is the last step of `run-all.sh`; passes. | Keep running it before each push. |

## 6. Release

| Line | Status | Evidence | What is left |
|---|---|---|---|
| README explains pills, install prompt, and credits Islands (PhyAMR), Islands Bar, Nyxiri, Denial | open | `grep -i "islands\|nyxiri\|denial\|PhyAMR" README.md` finds nothing. | Write the pills section and credits (plan batch 5). |
| GitHub release v0.2.0 with before and after screenshots | open | `docs/after-card.png`, `docs/shots/01-bar-before-after.png` exist. Release is gated on Felipe (plan batch 5). | Release after Felipe's go. |
| Marketplace verification form sent | open | `docs/SUBMISSION.md` draft exists. | Send it. |

## Open items, most important first

1. Live pass by the lead: theme switch recolor, vertical bar, animations off. Plus pills off vs
   painter removed pixel shot, and a light and dark readability look.
2. Cost numbers: rerun idle CPU and RSS on a quiet session, 10 or more windows per state. Today
   only the median passes. Also settle "recompute only the touched section": the painter rebuilds
   all areas on each update.
3. Every widget keeps working in a pill, drag reorder, breaks after reorder, live Move pill run.
4. Install then uninstall live, with `cmp` of `shell.json`. Make `uninstall.sh` check the result
   before it says nothing is left, and decide what to do with more than 5 stacked entries.
5. Look measurements on screenshots: current defaults at 1 px, scale 1 and fractional scale,
   widget centering.
6. Blind comparison with Islands Bar and Nyxiri.
7. Release items: README pills section and credits, v0.2.0 release with screenshots, marketplace
   form.
8. Not testable here: a second monitor (needs real hardware).
