# OmaBar v0.2 quality bar

This is the bar every batch, every agent and every review is judged against. A batch that misses
one line here is not done. Agent briefs quote this file together with
[engineering-standards.md](engineering-standards.md).

**Goal in one sentence:** pills that look as clean as Denial, cost nothing while idle, and
can never break the stock bar.

Checks marked **(live)** touch the running shell or theme. They need Felipe's OK first, use
screenshots only (grim), and never inject keyboard or mouse input.

## 1. Look

Reference: Denial's bar (sizes in [plan.md](plan.md), Decisions). Islands Bar and Nyxiri are the
competitors to match or beat.

- [ ] Pills use the default sizes exactly: fully round ends, 12 px inner padding, 8 px gap,
  5 px space above and below. Measured on a screenshot, tolerance 1 px.
- [ ] Pill edges sit on whole pixels at scale 1 and at the machine's own scale. No blurry edges.
- [ ] Each widget sits centered across the pill's height, within 1 px.
- [ ] The clock stays exactly centered on the screen, with and without the painter. Measured, 0 px.
- [ ] Pills follow the theme: a theme switch recolors them with no restart. **(live)**
- [ ] Light and dark themes are both readable: text inside a pill keeps the contrast it has on
  the stock bar.
- [ ] Vertical bars (left, right) look as right as the top bar.
- [ ] Every monitor gets the same pills (one painter instance per monitor).
- [ ] A blind side by side of our bar, Islands Bar and Nyxiri screenshots: a reviewer agent that
  does not know which is ours rates ours at least as clean. Done once, before release.

## 2. Cost

Measured, not guessed. Numbers go in `docs/research/cost.md`.

- [ ] Zero timers and zero polling in the painter code. Checked by `grep` in the test runner.
- [ ] Idle CPU of the shell process over 60 s, pills on vs pills off: difference at most
  0.1 percentage point. **(live)**
- [ ] Memory (RSS) of the shell process, painter plus 5 breaks vs no painter: difference at most 2 MB. **(live)**
- [ ] A layout change (move, hide, show a widget) recomputes only the section it touches.
- [ ] Blur, gradients and animations stay out of v0.2 unless they meet the two numbers above.

## 3. Safety

- [ ] **Pills off equals stock.** With pills off, a screenshot of the bar is pixel identical to
  the bar with no painter at all, with the clock area masked (or both shots taken in the same
  minute). **(live)**
- [ ] **Fail safe.** If a private bar name is missing, the painter draws nothing, take no space, log
  one warning, and the bar keeps working. Proven by a test that feeds the adapter a fake tree
  with one name removed.
- [ ] The contract test fails loudly, naming the missing name, after an Omarchy change.
- [ ] No OmaBar file writes `shell.json`. Layout changes go only through the `omarchy` CLI.
- [ ] Saving the style never loses the hidden list or the breaks, and saving either never loses
  the style. Round trip test.
- [ ] A bad or hand edited store file never breaks the bar or the panel: defaults are used and
  one warning is logged. Test with broken JSON, wrong types, unknown keys.
- [ ] Install, then uninstall: `shell.json` is the same as before, except for the order of keys.
  `omarchy plugin disable` removes one bar entry per call, so uninstall repeats it until none is left.

## 4. Works with everything

- [ ] Every widget on Felipe's bar today keeps working inside a pill, including the tray drawer,
  `tornikegomareli.spaces`, `gaming-console` and `omarchy.elsewhen`. **(live)**
- [ ] Drag to reorder in the stock bar editor still works, and pills follow the new order.
- [ ] Widgets that hide themselves (zero size) do not leave an empty pill or a double gap.
- [ ] The painter's position, center included, never changes the layout or the clock position.
- [ ] Breaks survive reorder, hide and show of widgets (test line, and a live check).
- [ ] The panel's widget list never offers to hide the painter entry.
- [ ] Move pill (row 15): move a pill, then Undo gives a byte identical `bar.layout`; the
  `centerAnchor` rule held (the center never lacks its anchor at any step). **(live)**
- [ ] `omarchy toggle animations` off: no pill animates.
- [ ] Presets and move pill: apply then Undo gives back a byte identical `bar.layout`, inline settings included.

## 5. Code

- [ ] `bash test/run-all.sh` passes. Every SKIP is listed in `docs/batch-log.md`.
- [ ] Every pure `.js` file has node tests covering the cases named in plan.md.
- [ ] Private bar names appear in `pills/BarAdapter.js` only. The runner greps for the distinctive
  ones (`widgetKey`, `widgetHolder`, `owner`, `ModuleList`); common words like `entry` cannot be grepped.
- [ ] One component per new QML file. New files stay small: QML under 200 lines, JS under 250.
- [ ] No hard coded colors. Every displayed text uses `textFormat: Text.PlainText`.
- [ ] Every setting in the panel has its default stated, in plain words.
- [ ] The scrub check passes (no private data, no long dashes) before every push.

## 6. Release

- [ ] README explains pills, the install prompt, and credits Islands (PhyAMR), Islands Bar,
  Nyxiri and Denial.
- [ ] GitHub release v0.2.0 with before and after screenshots of the bar.
- [ ] Marketplace verification form sent, with the question about drawing in the bar's tree.

## How a batch is judged

1. The builder runs the checks for its batch and writes the evidence (output, numbers,
   screenshot paths) in `docs/batch-log.md`.
2. A separate reviewer agent, which did not write the code, checks the same lines and tries to
   break them. A reviewer that only agrees has not done its job.
3. Felipe does the **(live)** checks with the lead, or approves the lead doing them.
