# Batch log

## Batch 0: test runner (no plugin behaviour change)

Added:
- `test/run-all.sh`: runs every `test/*.js` with node, `qmllint` on every `*.qml`, `shellcheck` on
  every `*.sh`, then `test/scrub.sh`. Exits non-zero if any step fails. New files are picked up by
  glob (tracked plus untracked-not-ignored).
- `test/scrub.sh`: fails on em or en dashes in `*.md`, and on private data (pattern list in one
  array at the top) in any text file. Binary files are skipped.

qmllint policy: Quickshell types do not resolve outside the shell, so `[unqualified]` warnings (116
on Panel.qml, all `Style.*`) are allowed. One `[missing-property]` (Panel.qml:1211, `parent.cellWidth`)
is allowed as the recorded baseline. Any other warning, and any error, fails.

Run (2026-11-16): node 20/20 contract names and 36/36 model tests passed; qmllint OK on Panel.qml;
shellcheck SKIP; scrub FAIL, because existing markdown files contain dashes (see below). No private
data found.

SKIPs:
- `shellcheck`: not installed on this machine, prints `SKIP shellcheck`.

Open failures in existing files (not edited): em or en dashes in `FINDINGS.md` (lines 1, 34, 38, 72,
102, 115), `README.md` (95, 103, 115), `docs/SUBMISSION.md` (29, 42, 54, 68, 106, 118, 125, 139).
Batch 0 is "done" only once these are fixed or waived.

Fix (2026-11-16, lead): the long dashes in `FINDINGS.md`, `README.md` and `docs/SUBMISSION.md`
were replaced with colons in headings and commas in text (17 lines, wording otherwise unchanged;
one README sentence split in two). Rerun: node tests OK, qmllint OK, shellcheck SKIP, scrub OK,
RESULT: OK. Batch 0 is done.

## Batch 1: painter spike (2026-11-16)

Throwaway plugin `io.github.felipecpaiva.omabarspike` installed live with Felipe's go ahead, then
removed (moved to trash). `shell.json` checked identical to the pre-test backup afterwards.
Results and evidence: architecture.md section 9. Passed: reach every section, pills drawn, zero
space (0 pixels differ), cleanup on disable. Not tested: second monitor, vertical bar. Found: the
shell caches plugin QML until a full restart; an `Instantiator` leaks reparented pills. Stop rule
not triggered: batch 2 may start.

## Batch 2: painter, group layout, style store (2026-11-16)

Built in three parallel streams (GroupLayout, PillStyle and store, adapter and painter), then an
independent adversarial review. Commits 24e025c, d014654.

Tests: group layout 19/19, pill style 13/13, model 37/37, bar adapter OK (fail safe once per
private name), contract 21 names, no timers, private names only in BarAdapter.js, qualified Color,
qmllint, scrub. shellcheck SKIP.

Review fixes: unqualified `Color` (Qt 6.12 hides `qs.Commons` Color, colors would be undefined)
now `Commons.Color` with a runner guard; uninstall repeats disable (one call removes one
reference); outer pills clamped to the surface edge.

Live check on Felipe's laptop (Omarchy 4.5.0, scale 2, top bar, theme White), Felipe ran the
enable and restart himself:
- No QML errors in `journalctl --user`.
- One pill each for left, center and right; the three center lists draw one pill.
- Pill inset measured 5 px top and bottom (10 device px at scale 2), outer ends 6 px from the
  screen edge.
- Center widgets at the same device pixel columns as before pills (coffee icon 1121-1144,
  gamepad end 1480 in both). Clock centering unchanged.
- Store watch after an atomic replace: pills turned off and on again by rewriting the store
  (temp file plus rename); the bar followed within 2 s both ways; on-again equals the first
  pills-on shot with 0 differing pixels.

Not checked yet: theme switch recolor, second monitor, vertical bar, idle CPU and memory numbers
(quality bar section 2), fractional scale rounding (review S5, recorded as a known limit: shapes
round to logical pixels).

Seen: `tornikegomareli.spaces` paints its own workspace tiles, taller than the pill (box inside a
pill, architecture risk table). Open design point for Felipe: touching widgets leave no room for
the full 12 px inner padding or the 8 px gap at a split (review S1).

## Batch 3: settings by topic, groups page, bar background (2026-11-16)

Built in four parallel streams (panel topics shell, settings spec and rows, groups page, style
limits and window corners), then an independent review, then three parallel fixers. Commit
cc3668d plus the fix commit.

Design: one spec file `settings/spec.json` defines every setting by topic (Widgets, Pills, Groups,
Bar), subgroup, label, help and advanced flag, like omahop. Defaults and limits stay in
`lib/PillStyle.js` only. "Match window corners" reuses Omarchy's `Style.cornerRadius`, which
already follows Hyprland's `decoration:rounding` and refreshes on config reload (no timer).

Lint: qmllint now gets a temp `qs` link to Omarchy's shell folder, so `qs.*` resolves for real.
Allowed blind spots: [unqualified], and [missing-property] on the generic types QObject (nested
Style groups) and QQuickItem (`parent.x`). Proven by a planted file with misspelled properties on
`ToggleSwitch` and `Rectangle`: the runner failed on both.

Review findings fixed: sliders did not snap (fractional px written, a blocker); the page rebuilt
every row on every write; the mouse wheel changed sliders instead of scrolling; slider colors were
hard coded; radius 0 to 999 on a slider (now a number field); color chips too wide (now a
dropdown); help texts must name their default (tested); store writes dropped unknown nested keys
and froze every default into the file (now `PillStyle.patchStore`, only changed keys written);
async writes could be undone by a stale reload (`blockWrites`, `onSaveFailed`); the header
transparency switch now follows `bar.background` and remembers Glass; a minor painter warning
could hide the fatal one; repeated widget ids get a disabled switch with a reason; one SELF_ID.

Tests: group layout 19/19, groups 15/15, model 38/38, pill style 16/16, settings spec OK, bar
adapter OK, contract 21 names, no timers, qualified Color, private names, qmllint (7 files),
scrub. shellcheck SKIP.

Not checked yet: everything live (the panel has never been opened with this code).

Live check (2026-11-16, Felipe restarted the shell himself): the panel opens with no OmaBar error
in the full Quickshell log; topic switcher shows Widgets, Pills, Groups, Bar; the Widgets page is
unchanged and does not list the painter; the Pills page renders subgroups Basics, Shape, Color,
help texts with defaults, radius as a number field, whole-number slider labels, the color
dropdown fits. Groups and Bar pages confirmed fine by Felipe. Not tested live: saving from a
control (no slider dragged, no switch changed), mouse wheel over a slider.

Found (from v0.1, not batch 3): the Widgets page lists only left, center and right, so widgets in
`centerBegin` and `centerEnd` are missing from it (Model.js REGIONS). Planned as a fix in batch 4.

## Batch 4: Denial preset, move a whole pill, Undo (2026-11-16)

Three parallel streams (move logic with a simulator of `omarchy-bar move`, the Widgets list fix
for centerBegin and centerEnd, panel wiring and the Layout topic), an independent review, three
parallel fixers. Commits c2db0bf plus the fix commit.

Review: no blocker. The reviewer ported Omarchy's `moveBarEntry` and `barTarget` and replayed
40,000 random layouts through the planner: 0 mismatches, every Denial and every move then Undo
returns the original. On a copy of the real bar Denial is 7 moves and Undo restores it with
inline settings. Moves use exact addressing, so anchor defaults, before/after and clones never
apply, and a stale plan fails instead of moving the wrong widget. The real `barTarget` clamps
any index to the section length (PluginRegistry.qml barTarget), so "end of section" moves are safe.

Fixed: closing the panel mid run (records `running` in the undo record, warns on next open,
and blocks new changes until Undo); Undo and every run now verify the live layout against the
target before clearing or writing anything; Denial refuses when no workspaces widget is found;
the painter is never moved (2000 seeded random layouts); no false refusal from key order;
Denial drops stale breaks; the resolved center anchor is used; switches locked and buttons dimmed
while a run is in progress. keepLoaded was considered and rejected: not free while idle.

Tests: presets 30/30, pill style 18/18, model 41/41, groups 15/15, group layout 19/19, settings
spec, bar adapter, contract, no timers, qualified Color, private names, qmllint, scrub.

Not checked yet: the live run on Felipe's bar (supervised, with a shell.json backup).

Live check (2026-11-16, supervised; Felipe restarted the shell, applied Denial and pressed Undo
from the Layout topic): `shell.json` was rewritten by the runs (modified 12:25:48, after the
12:22 backup) and is **byte identical** to the backup afterwards (`cmp`). The undo record was
cleared at 12:25:49, which the panel only does after verifying the live layout equals the
snapshot. No OmaBar warnings in the journal. Batch 4 is done.

## Batch 4.5: Grouped and Spread, group rules, smooth pills (2026-11-16)

Five parallel streams (group rules logic, Grouped and Spread presets, Groups page controls,
research on spacing and the Spaces widget, impasto animation study plus the pill glide), an
independent review, then four parallel fixers.

Review verdict was "adds options, does not yet give the look"; fixed: Move pill now uses the same
pill numbers as the Groups page (rules aware, refuses on stale rows; 2000 seeded random layouts);
Grouped gives three pills around the clock and keeps the clock alone in center; Spread keeps the
old center groups apart; a None widget no longer has pill ends under it (pills stop half a gap
from it); forced splits show a disabled switch with a reason; the hint suggests None for a
workspaces switcher; pills only move on whole pixel changes, so ticking text does not run the
animation; pills follow their group instead of their index.

Applied for Felipe (with a backup): Spaces settings iconHighlight=dot, showApps=active,
pillBackground=false, pillBorder=false, activeStyle=subtle. The active workspace keeps a full
height tile (no setting removes it), so the look test uses OmaBar None on Spaces.

Known debt: lib/Presets.js is 295 lines (cap 250); split into Presets.js and PresetTargets.js with
a coordinated Panel change. Grouped, then Spread, then Grouped again carries breaks back and can
give five center pills instead of three. Panel.qml is about 1700 lines (legacy v0.1 file).

Tests: presets 47/47, group layout 33/33, groups 21/21, pill style, model, settings spec, bar
adapter, contract, no timers, qualified Color, private names, qmllint, scrub.

Even pills live check (2026-11-16, after Felipe restarted the shell): the same six scenarios
(default, Spaces Own, Spaces None, Bluetooth Own, clock Own, split center) were applied through
the store only and screenshotted. Split pills are now even: the Bluetooth Own pill is centered on
its icon and its neighbours have equal ends; the clock Own and split center pills are even on both
sides. A pixel-scan measurement was tried and dropped (text and the Spaces tile break the scan
row); judged on zoomed screenshots instead. Remaining: the Spaces widget's own active tile is
taller than a pill (a widget-level limit, not OmaBar). Store restored after the test.
