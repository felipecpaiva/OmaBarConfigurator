#!/usr/bin/env python3
"""Build the OmaBar logo set (the v1-pills mark) into branding/logo/: app icon on a graphite tile, a small-size icon,
transparent glyphs for dark and light grounds, one-colour stencils, PNG exports and favicon.ico.
Usage: python3 branding/tools/logo.py   (needs rsvg-convert, ImageMagick and fontTools)"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wordmark import C, LOGO, mark, svg, png

os.makedirs(LOGO, exist_ok=True)
def write(name, text): open(os.path.join(LOGO, name), "w").write(text)
tile = f'<rect width="16" height="16" rx="3.5" fill="{C["ground"]}"/>'

# large icon: the mark inset to 75% so it breathes inside the tile
write("icon.svg", svg(tile + f'<g transform="translate(2 2) scale(0.75)">{mark(C["ink"], C["mint"])}</g>', 512, 512, "0 0 16 16"))
# small icon: the mark on its native 16 grid, so every edge lands on a pixel at 16, 32 and 48 px
write("icon-small.svg", svg(tile + mark(C["ink"], C["mint"]), 512, 512, "0 0 16 16"))
write("glyph.svg", svg(mark(C["ink"], C["mint"]), 512, 512, "0 0 16 16"))                 # on dark grounds
write("glyph-light.svg", svg(mark(C["ground"], C["mint_deep"]), 512, 512, "0 0 16 16"))   # on light grounds
write("stencil.svg", svg(mark(C["ground"], C["ground"]), 512, 512, "0 0 16 16"))          # one colour, for light grounds
write("stencil-white.svg", svg(mark(C["ink"], C["ink"]), 512, 512, "0 0 16 16"))          # one colour, for dark grounds

p = lambda n: os.path.join(LOGO, n)
for s in (1024, 512, 256, 192, 180, 128, 64):
    png(p("icon.svg"), p(f"icon-{s}.png"), s, s)
for s in (48, 32, 16):
    png(p("icon-small.svg"), p(f"icon-{s}.png"), s, s)
for n in ("glyph", "glyph-light", "stencil", "stencil-white"):
    png(p(f"{n}.svg"), p(f"{n}-512.png"), 512, 512)
subprocess.run(["magick", p("icon-16.png"), p("icon-32.png"), p("icon-48.png"), p("favicon.ico")], check=True)
print("logo set written to logo/")
