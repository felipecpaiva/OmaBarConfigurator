#!/usr/bin/env python3
"""Render a matching comparison board when Chromium cannot start in the sandbox."""
import base64
import html
from pathlib import Path
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]

def render():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1860" height="2250"><rect width="1860" height="2250" fill="#f4f3f0"/>']
    def text(x,y,s,size=16,fill='#16181d'):
        parts.append(f'<text x="{x}" y="{y}" font-family="JetBrains Mono, monospace" font-size="{size}" fill="{fill}">{html.escape(s)}</text>')
    def rect(x,y,w,h,fill):
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}"/>')
    def img(p,x,y,w,h):
        mime='image/svg+xml' if p.suffix=='.svg' else 'image/png'
        data=base64.b64encode(p.read_bytes()).decode()
        parts.append(f'<image x="{x}" y="{y}" width="{w}" height="{h}" xlink:href="data:{mime};base64,{data}"/>')
    text(32,54,'OmaBar: brand variations',28)
    text(32,88,'Vector masters, native 16 px exports, light and dark stencils, and outlined wordmarks.',16)
    for i,d in enumerate(sorted((ROOT/'explorations').glob('v[0-9]-*'))):
        x=32+i*606
        rect(x,120,584,2070,'#ffffff')
        text(x+20,160,d.name,24)
        img(d/'concept.png',x+20,190,544,544)
        text(x+20,774,'VECTOR / DARK SURFACE',14)
        rect(x+20,795,544,240,'#16181d')
        img(d/'icon.svg',x+40,810,200,200)
        for s,offset in [(64,260),(32,360),(16,440)]:
            img(d/('icon-16.png' if s==16 else 'icon.svg'),x+offset,890,s,s)
            text(x+offset,994,f'{s} px',13,'#f4f5f7')
        text(x+20,1080,'ONE COLOUR / LIGHT + DARK',14)
        rect(x+20,1100,260,120,'#f4f3f0')
        rect(x+300,1100,264,120,'#16181d')
        img(d/'icon-mono.svg',x+100,1114,88,88)
        img(d/'icon-mono-dark.svg',x+380,1114,88,88)
        for suffix,bg,y in [('-light','#f4f3f0',1250),('','#16181d',1460)]:
            rect(x+20,y,544,190,bg)
            img(d/f'wordmark{suffix}.svg',x+40,y+20,250,75)
            img(d/f'lockup{suffix}.svg',x+40,y+105,360,80)
        y=1700
        for para in d.joinpath('notes.md').read_text().split('\n\n')[:5]:
            for line in textwrap.wrap(para.lstrip('# '),64):
                text(x+20,y,line,13)
                y+=20
            y+=12
    text(32,2230,'PNG rendered with librsvg because Chromium is blocked by the sandbox. HTML remains available.',13)
    parts.append('</svg>')
    p=ROOT/'board.svg'
    p.write_text(''.join(parts))
    subprocess.run(['rsvg-convert','-o',str(ROOT/'board.png'),str(p)],check=True)

if __name__ == '__main__':
    render()
