#!/usr/bin/env python3
"""Shared drawing for the OmaBar kit: the v1-pills mark, the outlined JetBrains Mono Bold wordmark, the lockup, the pixel
alphabet for the terminal banner, the palette, and a headless Chromium screenshot helper. Imported by the other tools.
The geometry is copied from the approved explorations/v1-pills files; do not change it here without a new decision."""
import os, shutil, subprocess, tempfile
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "logo")
FONT = "/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf"

# ink is the approved mark colour (#f4f5f7 in every v1-pills file); paper is the light page ground
C = dict(ground="#16181d", ink="#f4f5f7", mint="#5cdbc0", paper="#f4f3f0",
         mint_deep="#0f7d68",   # mint for light grounds: the approved mint is only 1.5:1 on paper
         bar="#23262e", mute="#9a9eb0", mute_light="#5b5f6e", chip_light="#e4e2dd")

def mark(main, accent):
    """The approved v1-pills mark on a 16 by 16 grid: a short group, a long selected group, and the rail under them."""
    r = lambda x, y, w, h, rx, c: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}"/>'
    return r(1, 5, 5, 4, 2, main) + r(7, 5, 8, 4, 2, accent) + r(1, 10, 14, 1, 0.5, main)

def svg(body, w, h, view=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view or f"0 0 {w} {h}"}">{body}</svg>\n'

_font = TTFont(FONT); _glyphs = _font.getGlyphSet(); _cmap = _font.getBestCmap()

def lettering(text, x, baseline, size, fill):
    """Text as outlined paths from JetBrains Mono Bold, so no SVG needs the font installed."""
    scale = size / _font["head"].unitsPerEm
    paths = []
    for ch in text:
        g = _glyphs[_cmap[ord(ch)]]; pen = SVGPathPen(_glyphs); g.draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({x:g} {baseline:g}) scale({scale:g} {-scale:g})"/>')
        x += g.width * scale
    return f'<g fill="{fill}">' + "".join(paths) + "</g>"

def wordmark(fill):
    return svg(lettering("OmaBar", 8, 74, 84, fill), 320, 96)

def lockup(main, accent):
    return svg(f'<g transform="translate(0 0) scale(6)">{mark(main, accent)}</g>' + lettering("OmaBar", 116, 74, 84, main), 432, 96)

def png(src, out, w=None, h=None):
    subprocess.run(["rsvg-convert"] + (["-w", str(w)] if w else []) + (["-h", str(h)] if h else []) + [src, "-o", out], check=True)

def shot(html, out, w, h):
    """Screenshot an HTML string with headless Chromium at exactly w by h, using a throwaway profile."""
    tmp = tempfile.mkdtemp(prefix="omabar-kit-")
    try:
        page = os.path.join(tmp, "page.html")
        open(page, "w").write(html)
        subprocess.run(["chromium", "--headless", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--user-data-dir={tmp}/profile", f"--window-size={w},{h}", f"--screenshot={out}", "file://" + page],
                       check=True, capture_output=True, timeout=60)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

# Pixel letters for the terminal banner, 7 rows from cap height to baseline. Only the letters of the name exist.
PIX = {
 "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
 "m": [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
 "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
 "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
 "r": [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
}
