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
