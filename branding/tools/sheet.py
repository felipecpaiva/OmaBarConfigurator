#!/usr/bin/env python3
"""Build branding/brand-sheet.html and brand-sheet.png (one page): mark, palette with computed WCAG contrast ratios, type,
spacing, do and do not. Run logo.py and kit.py first. Usage: python3 branding/tools/sheet.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wordmark import C, LOGO, ROOT, shot

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def cr(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True); return (x + 0.05) / (y + 0.05)
assert round(cr("#000000", "#ffffff"), 1) == 21.0 and round(cr("#777777", "#ffffff"), 2) == 4.48

G, P = C["ground"], C["paper"]
# name, hex, role, the ground it sits on
PAL = [("Graphite", G, "Dark ground, icon tile, ink on light", C["ink"]),
       ("Near white", C["ink"], "The mark and text on dark", G),
       ("Mint", C["mint"], "Selected pill on dark grounds", G),
       ("Muted", C["mute"], "Secondary text on dark", G),
       ("Paper", P, "Light ground", G),
       ("Graphite", G, "The mark and text on light", P),
       ("Mint deep", C["mint_deep"], "Selected pill on light grounds", P),
       ("Muted light", C["mute_light"], "Secondary text on light", P)]
MISUSE = [("Mint", C["mint"], P), ("Mint", C["mint"], "#ffffff")]   # shown so nobody puts light mint on paper

def grade(r):
    return "AAA" if r >= 7 else "AA" if r >= 4.5 else "graphics only, not body text" if r >= 3 else "fails, do not use"
def swatch(n, h, role, on):
    r = cr(h, on); ink = G if lum(h) > 0.18 else P
    return (f'<div class="sw"><div class="chip" style="background:{h};color:{ink}">{n}</div><b>{h}</b><span>{role}</span>'
            f'<i>{r:.2f}:1 on {on} ({grade(r)})</i></div>')
rd = lambda n: open(os.path.join(LOGO, n)).read()
img = lambda n: "file://" + os.path.join(LOGO, n)
misuse = "; ".join(f"{n} {h} on {on} is {cr(h, on):.2f}:1" for n, h, on in MISUSE)

def html(src):
    """src(name) gives the image URL: file:// for the screenshot, a relative path for the committed HTML."""
    return f"""<!doctype html><meta charset="utf-8"><title>OmaBar brand sheet</title><style>
*{{box-sizing:border-box;margin:0}} body{{width:1600px;background:{P};color:{G};font-family:'JetBrainsMono Nerd Font','JetBrains Mono',monospace;padding:64px;font-size:17px;line-height:1.5}}
h2{{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:{C['mute_light']};margin:44px 0 18px;border-top:2px solid {G};padding-top:14px}}
.top{{display:flex;align-items:center;justify-content:space-between;gap:48px}} .top svg{{height:110px;width:auto}} .top p{{max-width:640px;font-size:19px}}
.row{{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}} .tile{{border-radius:18px;padding:26px;display:flex;align-items:center;justify-content:center;width:252px;height:252px}}
.cap{{font-size:14px;color:{C['mute_light']};margin-top:8px;max-width:260px}}
.pal{{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}} .sw{{display:flex;flex-direction:column;gap:4px}} .sw .chip{{height:84px;border-radius:12px;padding:12px 14px;font-weight:700;border:1px solid #0002}}
.sw span{{font-size:14px;color:{C['mute_light']}}} .sw i{{font-size:13px;font-style:normal}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:48px}} ul{{padding-left:22px}} li{{margin:6px 0}} .do li::marker{{content:"+ ";color:#1f7a4f;font-weight:700}} .dont li::marker{{content:"x ";color:#b3261e;font-weight:700}}
code{{background:#0001;padding:1px 6px;border-radius:5px}}
</style>
<div class="top"><div>{rd('lockup-light.svg')}</div><p><b>OmaBar</b> shows, hides, reorders and groups the widgets on the Omarchy bar. The mark: two rounded groups of different lengths above a rail, the right one selected in mint. Order on the bar, small and calm.</p></div>

<h2>1. The mark</h2>
<div class="row">
 <div><div class="tile" style="background:{G}"><img src="{src('icon-256.png')}" width="200"></div><div class="cap">App icon on a graphite tile: icon.svg, icon-*.png</div></div>
 <div><div class="tile" style="background:{G}"><img src="{src('glyph-512.png')}" width="200"></div><div class="cap">Glyph on dark: glyph.svg</div></div>
 <div><div class="tile" style="background:#fff;border:1px solid #0002"><img src="{src('glyph-light-512.png')}" width="200"></div><div class="cap">Glyph on light, deep mint: glyph-light.svg</div></div>
 <div><div class="tile" style="background:#fff;border:1px solid #0002"><img src="{src('stencil-512.png')}" width="200"></div><div class="cap">One colour: stencil.svg, stencil-white.svg</div></div>
 <div><div class="tile" style="background:{G}"><img src="{src('icon-64.png')}" width="64"><img src="{src('icon-32.png')}" width="32" style="margin-left:16px"><img src="{src('icon-16.png')}" width="16" style="margin-left:16px"></div><div class="cap">64, 32, 16 px. At 48 px and below use icon-small.svg (mark on its native pixel grid)</div></div>
</div>

<h2>2. Palette and contrast (WCAG 2, computed from the hex values)</h2>
<div class="pal">{''.join(swatch(*p) for p in PAL)}</div>
<p class="cap" style="max-width:none">Text uses Near white, Graphite and the two Muted greys (AA or better). Mint and Mint deep are pill colours. The approved mint fails on light grounds ({misuse}), so light files use Mint deep. No gradients, shadows or glows in the mark.</p>

<h2>3. Type</h2>
<div class="two"><div><p style="font-size:34px;font-weight:700">JetBrains Mono</p><p>Bold for headings and the wordmark, regular for body. It is Omarchy's default font (SIL OFL licence), so OmaBar looks at home on the desktop it targets. Fallback: any monospace.</p></div>
<div><p>The wordmark <b>OmaBar</b> is JetBrains Mono Bold converted to outlines, one colour. One word, capital O and B. Say it "oh-ma-bar".</p><div style="margin-top:12px">{rd('wordmark-light.svg').replace('height="96"', 'height="64"').replace('width="320"', 'width="214"')}</div></div></div>

<h2>4. Spacing and shape</h2>
<ul><li>The mark lives on a 16 unit grid: pills 4 high with fully round ends, 1 unit gaps, a rail 1 high.</li><li>Base unit 8 px. Card padding 8% of the width, gaps 16 or 24 px.</li><li>Clear space around the mark: one pill height (4 grid units, a quarter of the icon) on every side.</li><li>Minimum size: 16 px for the icon (icon-small), 120 px wide for the lockup.</li><li>Rounded everywhere, like the pills: icon tile radius 22% of its width, pills fully round.</li></ul>

<h2>5. Do and do not</h2>
<div class="two">
<ul class="do"><li>Use the graphite tile icon for app, favicon and avatar slots, the glyph on flat grounds.</li><li>Use the light files (<code>*-light.*</code>, Mint deep) on light pages.</li><li>Write the name as OmaBar: one word, capital O and B.</li><li>Keep the not-affiliated line near any mention of Omarchy.</li><li>Keep text short and plain.</li></ul>
<ul class="dont"><li>Recolour, stretch or rotate the mark, or add a glow, shadow or gradient.</li><li>Put the light mint on a light ground, or set body text in either mint.</li><li>Use Omarchy's logo, or any styling that reads as an official Omarchy mark.</li><li>Write Omabar, OMABAR or Oma Bar.</li><li>Use an em dash or en dash in any text.</li></ul></div>
<p class="cap" style="max-width:none;margin-top:36px">Source: branding/tools (logo.py, kit.py, social.py, sheet.py, terminal.py). Artwork released with the project under MIT. Not affiliated with or endorsed by Omarchy. {len(PAL)} pairs checked.</p>"""

open(os.path.join(ROOT, "brand-sheet.html"), "w").write(html(lambda n: "logo/" + n))
shot(html(img), os.path.join(ROOT, "brand-sheet.png"), 1600, 2050)
print("brand-sheet written")
