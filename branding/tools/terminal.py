#!/usr/bin/env python3
"""Write branding/terminal/banner.txt (plain half-block "OmaBar") and banner.ansi (the "B" in mint) from the pixel letters.
Usage: python3 branding/tools/terminal.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wordmark import PIX, ROOT

MINT = "\x1b[38;2;92;219;192m"   # #5cdbc0 as truecolor
def render(color):
    cols = [[r + "." for r in PIX[ch]] for ch in "OmaBar"]
    rows = len(cols[0]); lines = []
    for y in range(0, rows, 2):
        line = ""
        for i, c in enumerate(cols):
            top, bot = c[y], (c[y + 1] if y + 1 < rows else "." * len(c[y]))
            s = "".join(" ▀▄█"[(t == "#") + 2 * (b == "#")] for t, b in zip(top, bot))
            line += f"{MINT}{s}\x1b[0m" if color and "OmaBar"[i] == "B" else s
        lines.append(line.rstrip())
    return "\n".join(lines) + "\n"

os.makedirs(os.path.join(ROOT, "terminal"), exist_ok=True)
open(os.path.join(ROOT, "terminal", "banner.txt"), "w").write(render(False))
open(os.path.join(ROOT, "terminal", "banner.ansi"), "w").write(render(True))
print(render(True))
