# Cost of group pills: idle CPU and memory

Measured on one machine, Omarchy 4.5, with the real bar and widgets. Quality bar section 2 asks for
at most 0.1 percentage point of idle CPU and at most 2 MB of RSS between pills on and pills off.

## Method

- Process: the shell, `quickshell -n -p /usr/share/omarchy/shell`. Same PID for the whole run.
- CPU: utime + stime ticks from `/proc/<pid>/stat` over a 60 s window (100 ticks per second, so
  60 ticks = 1 percentage point of one core). RSS: `VmRSS` from `/proc/<pid>/status` at the end of
  each window.
- Before each window: change the store, wait 10 s warm-up. The store was written to a temp file
  and moved over the real one, like the panel does.
- States: off = `style.enabled` false. on = `style.enabled` true, default style, solo
  `["omarchy.menu"]`. solo = on, solo `["omarchy.bluetooth"]`, Smooth movement left at default.
- Order, to cancel drift: off, on, solo, off, on, solo, off, on, solo (9 windows, 3 per state).
- Shell was not restarted, the layout was not changed, no input was injected.

## Raw numbers

| Run | State | CPU ticks in 60 s | CPU % of one core | RSS (MB) | Load avg (1 min) |
|-----|-------|------------------:|------------------:|---------:|-----------------:|
| 1 | off | 240 | 4.00 | 1300.1 | 2.11 |
| 2 | on | 224 | 3.73 | 1303.7 | 1.44 |
| 3 | solo | 403 | 6.72 | 1348.3 | 1.73 |
| 4 | off | 643 | 10.72 | 1359.1 | 1.94 |
| 5 | on | 281 | 4.68 | 1251.1 | 2.03 |
| 6 | solo | 233 | 3.88 | 1248.2 | 1.88 |
| 7 | off | 237 | 3.95 | 1250.6 | 1.81 |
| 8 | on | 238 | 3.97 | 1252.2 | 1.72 |
| 9 | solo | 234 | 3.90 | 1248.4 | 1.45 |

(RSS in MiB, from kB / 1024.)

## Summary

| State | Mean CPU % | Median CPU % | Mean RSS (MB) | Last-run RSS (MB) |
|-------|-----------:|-------------:|--------------:|------------------:|
| off | 6.22 | 4.00 | 1303.4 | 1250.6 |
| on | 4.13 | 3.97 | 1269.0 | 1252.2 |
| solo | 4.83 | 3.90 | 1281.6 | 1248.4 |

Differences (on minus off):

- CPU, means: -2.09 points. CPU, medians: -0.03 points.
- RSS, means: -34 MB. RSS, last run of each state: +1.6 MB.
- solo minus off: median CPU -0.10 points, last-run RSS -2.2 MB.

## Verdict per quality-bar line

- Idle CPU, pills on vs off, at most 0.1 point: **PASS on the median** (-0.03), but **not
  proven by the means**, which are dominated by two outlier windows (run 3 at 6.7 percent and run 4
  at 10.7 percent). The five quiet windows of runs 5 to 9 sit between 3.88 and 4.68 percent with no
  link to the state. Pills do not add a measurable steady cost, but this run cannot show a 0.1 point
  difference through the noise.
- RSS, at most 2 MB: **PASS only for the settled windows** (runs 7, 8, 9: 1250.6, 1252.2 and
  1248.4 MB, spread 3.8 MB, on vs off +1.6 MB). Over the whole run it is **inconclusive**: RSS fell
  about 100 MB between run 4 and run 5 (a garbage collection or a trim in the shell), which is far
  larger than the 2 MB limit and has nothing to do with pills.

## Caveats

- This is not an idle machine. About 4 percent of one core is the shell's normal background work
  here, and the load average stayed between 1.4 and 2.1 on a 32 thread machine. Another process was
  also changing bar widgets (shell move commands were seen at the start), which may explain the
  outlier windows 3 and 4. Re-run on a quiet session for a clean number.
- Only 3 windows per state, one machine, one bar layout. The 0.1 point and 2 MB limits are below
  the observed window to window noise, so a firm pass needs more windows (10 or more per state) or
  the shell's own timers paused.
- Widgets: the clock shows HH:mm (minute text, no second tick). The keyboard layout widget polls
  every 10 s. I found no widget in the bar that updates every second. Other live widgets (weather,
  system monitor, network, tray) wake on their own timers in all states, so they are part of the
  baseline in both.
- Pills only change drawing, so the cost should show up as paint work when the layout changes, not
  as idle work. This test measures idle only.

## Rerun after ink padding (2026-11-16, evening)

Same method, 10 windows (off, on alternating, 60 s each after 10 s warm-up), with the painter
that now walks each widget's items for its visible content (BarAdapter.inkSpan), the spacer, square
edges and Always show indicators. Quiet machine: load 1.2 to 1.7, CPU 0.93 to 1.10 percent in every
window. Script: kept in the session scratchpad (`cost/run.py`), store backed up and restored
byte for byte.

| State | Median CPU % | Mean CPU % | RSS last window (MiB) | RSS median (MiB) |
|-------|-------------:|-----------:|----------------------:|-----------------:|
| off | 1.05 | 1.05 | 585.9 | 591.0 |
| on | 0.98 | 1.00 | 585.8 | 590.3 |

On minus off: CPU median -0.07 points, mean -0.05 points; RSS -0.1 MiB (last) and -0.7 MiB
(median). **PASS** on both quality-bar lines (at most +0.1 point, at most +2 MB): with pills on the
shell costs no more than with them off, within noise. Not measured: cost while the pointer moves
over the bar (needs input, not injected); inkSpan re-runs when any item in a widget changes, so a
hover animation re-runs it per frame for that area.

## Motion cost: workspace switch on battery (2026-11-16, late)

Felipe saw pills move slowly on a workspace switch on battery (power-saver). Method: 60 fps
gpu-screen-recorder of the bar while `hl.dsp.focus` switches workspaces 1 and 2 three times; per
switch, the span of frames where the bar changes and the share of frames that change (fps).
Recompute counts from a temporary counter in the installed copy only.

| Build | Frame rate during a switch | Switch span | Area recomputes |
|-------|---------------------------:|------------:|----------------:|
| Pills off | 60 fps | 350 to 417 ms | none |
| v0.2.0 | 38 to 43 fps | 567 to 650 ms | about 1,600 per second |
| + follow streams, ink cache (609ed0d) | 56 to 60 fps | 500 to 567 ms | not counted |
| + one recompute per frame (064aff6) | 55 to 60 fps | 367 to 417 ms | about 62 per second |

Causes, in order: (1) every slot that shifted re-ran the whole area binding (about 65 recomputes a
frame), (2) each recompute walked every widget's item tree for its ink, (3) each new target
restarted the 160 ms glide, so the pill chased the widget. Now the area binding only watches
positions and sizes and schedules one recompute with Qt.callLater; ink is measured again only for a
slot whose size changed; targets in a stream are followed frame by frame. With pills on, a switch
is now as fast and as smooth as with pills off.
