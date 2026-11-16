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
