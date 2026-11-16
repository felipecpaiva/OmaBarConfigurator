# OmaBar engineering standards

Three rules always apply, to every batch and every agent brief: **flexibility, scalability, code
standards per language.** A batch is not done until it meets all three. Agent briefs quote this
file.

## Product principles

- **Installing changes nothing you can see.** Pills are off until turned on in the panel.
- **One settings place.** Every option is in the panel, with its default stated. The store file
  can hold every option the panel shows, and nothing the panel cannot show.
- **Follows Omarchy.** Colors from `Color.*`, sizes from `Style.*` or settings, motion from
  `Style.duration()`.
- **Never breaks the bar.** Any failure in OmaBar falls back to the stock look.

## Flexibility

- Behaviour is a setting with a safe default. Defaults live in one place, `lib/PillStyle.js`.
- The store file is versioned (`version`). Unknown keys are kept; unknown values fall back to the
  default and are logged once.
- Private Omarchy internals are read in one file only, `pills/BarAdapter.js`.
- No hard coded paths, colors or sizes.

## Scalability

- Zero idle cost: no timers, no polling, no processes while nothing changes.
- Work per layout change is bounded by the widgets in one section.
- Any feature that adds per frame or per tick work (blur, animation) records measured numbers in
  `docs/research/` before it ships.

## Code standards per language

| Language | Standard | Check |
|---|---|---|
| QML | One component per new file, PascalCase file names, camelCase ids and properties, bindings over imperative code, no logic in delegates, no hard coded colors, `textFormat: Text.PlainText` on every text. | `qmllint`, `qmlformat` (`/usr/lib/qt6/bin`) |
| JavaScript | Pure functions in `.pragma library` files so Node can test them, `const` first, no side effects at import, no `Array.isArray` on host values (see FINDINGS.md). | `node test/*.js` |
| Shell | `#!/usr/bin/env bash`, `set -euo pipefail`, quote everything. | `shellcheck` when installed, else SKIP |
| Markdown | Plain hyphens and commas, no em or en dashes, no private data. | scrub check |

A missing linter prints `SKIP <tool>`, never a silent pass. A skip is listed in the batch log.

## Definition of done for a batch

1. The plan row names the files and the test.
2. Pure logic has node tests; anything visible has a screenshot or a hand check.
3. Linters pass or are logged as SKIP.
4. `bash test/run-all.sh` passes.
5. The fail safe still holds: with pills off, the bar is byte for byte the stock look.
6. The batch is written in `docs/batch-log.md` with what was checked and how.
