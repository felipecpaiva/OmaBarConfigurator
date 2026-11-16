#!/usr/bin/env python3
"""Build OmaBar vectors and raster exports. Writes only inside branding/."""
from pathlib import Path
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
FONT = Path('/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf')
font = TTFont(FONT)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
BG, WHITE = '#16181d', '#f4f5f7'

def svg(body, w, h, view=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view or f"0 0 {w} {h}"}">{body}</svg>\n'

def lettering(text, x, baseline, size, fill):
    scale = size / font['head'].unitsPerEm
    paths = []
    for char in text:
        g = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        g.draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({x:g} {baseline:g}) scale({scale:g} {-scale:g})"/>')
        x += g.width * scale
    return f'<g fill="{fill}">' + ''.join(paths) + '</g>'

def rect(x,y,w,h,r,c):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"/>'

def mark(kind, main, accent):
    if kind == 'pills':
        return ''.join(rect(x,5,w,4,2,c) for x,w,c in [(1,5,main),(7,8,accent)]) + rect(1,10,14,1,0.5,main)
    if kind == 'seam':
        return f'<path fill="{main}" d="M4 5H9V11H4A3 3 0 0 1 4 5Z"/><path fill="{accent}" d="M10 5H12A3 3 0 0 1 12 11H10Z"/>'
    # An original B silhouette with two horizontal, rounded counters.
    return f'<path fill="{main}" fill-rule="evenodd" d="M3 2H9C14 2 14 7 11 8C14 9 14 14 9 14H3Q2 14 2 13V3Q2 2 3 2ZM6 4A1 1 0 0 0 6 6H9A1 1 0 0 0 9 4ZM6 10A1 1 0 0 0 6 12H9A1 1 0 0 0 9 10Z"/>' + f'<path fill="{accent}" d="M3 8H11C14 9 14 14 9 14H3V12H9A1 1 0 0 0 9 10H3Z"/>'

DIRECTIONS = [
 ('v1-pills','pills','#5cdbc0','Pill rhythm','Two groups, one calm bar.',
  'Two rounded groups of different lengths sit above a short rail. The mint right group is the selected group. Clear one-pixel gaps preserve each group at 16 px.',
  'A low horizontal rhythm, not Omarchy\'s chunky pixel lettering or notched frame. Unlike omagnet\'s Snap Grid, it has no square ring, four quarters or snapping corner.'),
 ('v2-seam','seam','#ffbd66','Split / join','One bar. One deliberate seam.',
  'A single capsule is divided once, with a one-pixel vertical seam. The amber right section can be read as splitting away or joining the left. Shared outer curvature makes it one pill.',
  'A smooth horizontal capsule with one seam, unlike Omarchy\'s pixel construction. Unlike omagnet\'s Snap Grid, it uses two adjacent parts and no open square or four-part ring.'),
 ('v3-monogram','monogram','#80b6ff','The bar B','Two pill counters. One initial.',
  'A bold rounded B carries two stacked horizontal pill counters. A blue lower bowl makes the pair visible in colour, while the silhouette and both counters carry the idea in one colour.',
  'An asymmetric rounded initial, unlike Omarchy\'s pixel lettering and notched frame. Unlike omagnet\'s Snap Grid, it is a solid letter with stacked counters, not a square ring of four equal quarters.'),
]

for folder,kind,accent,title,tagline,idea,difference in DIRECTIONS:
    d = ROOT/'explorations'/folder
    d.mkdir(parents=True, exist_ok=True)
    for name,main,colour in [('icon',WHITE,accent),('icon-light',BG,accent),('icon-mono',BG,BG),('icon-mono-dark',WHITE,WHITE)]:
        (d/f'{name}.svg').write_text(svg(mark(kind,main,colour),512,512,'0 0 16 16'))
    for suffix,main in [('',WHITE),('-light',BG)]:
        (d/f'wordmark{suffix}.svg').write_text(svg(lettering('OmaBar',8,74,84,main),320,96))
        icon = f'<g transform="translate(0 0) scale(6)">{mark(kind,main,accent)}</g>'
        (d/f'lockup{suffix}.svg').write_text(svg(icon+lettering('OmaBar',116,74,84,main),432,96))
    for size in [16,32,512]:
        subprocess.run(['rsvg-convert','-w',str(size),'-h',str(size),'-o',str(d/f'icon-{size}.png'),str(d/'icon.svg')],check=True)
    # The sheet is a deterministic presentation of the master, never the master itself.
    sheet = rect(0,0,1024,1024,0,BG)
    sheet += lettering(folder.upper(),64,88,24,accent)
    sheet += f'<g transform="translate(272 100) scale(30)">{mark(kind,WHITE,accent)}</g>'
    sheet += lettering('OmaBar',64,650,108,WHITE)
    sheet += lettering(tagline,64,708,22,WHITE)
    sheet += rect(64,760,896,1,0,'#42464f')
    for x,colour,label in [(64,BG,'16181D'),(352,WHITE,'F4F5F7'),(640,accent,accent[1:].upper())]:
        sheet += rect(x,800,48,48,12,colour) + lettering(label,x+64,832,22,WHITE)
    sheet += rect(64,892,128,80,12,WHITE)
    sheet += f'<g transform="translate(96 900) scale(4)">{mark(kind,BG,BG)}</g>'
    sheet += f'<g transform="translate(224 900) scale(4)">{mark(kind,WHITE,WHITE)}</g>'
    sheet += lettering('ONE COLOUR / 16 PX READY',352,940,22,WHITE)
    (d/'concept.svg').write_text(svg(sheet,1024,1024))
    subprocess.run(['rsvg-convert','-o',str(d/'concept.png'),str(d/'concept.svg')],check=True)
    (d/'notes.md').write_text(f'''# {title}\n\n{idea}\n\nPalette: graphite {BG}; near white {WHITE}; accent {accent}. No gradients, shadows or glow.\n\nTypeface: JetBrains Mono Bold, outlined from the installed font into real SVG paths. The masters have no font dependency.\n\n{difference}\n\nSmall use: the master uses a 16 by 16 coordinate grid. Review icon-16.png at native size. The seam and gaps remain open without colour.\n\nDark surfaces: icon.svg, wordmark.svg and lockup.svg. Light surfaces: icon-light.svg, wordmark-light.svg and lockup-light.svg. One colour: icon-mono.svg is graphite; icon-mono-dark.svg is near white. All icon backgrounds are transparent.\n\nconcept.png is a 1024 px vector-rendered sheet. A generated codex-concept.png was omitted because the image tool saves outside branding/, contrary to the task's write boundary.\n\nOriginal artwork made for OmaBar, released under the project's MIT licence unless the maintainer chooses otherwise. Not affiliated with or endorsed by Omarchy.\n''')
print('Built three directions')
