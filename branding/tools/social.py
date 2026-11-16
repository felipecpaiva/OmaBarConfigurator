#!/usr/bin/env python3
"""Render the social images into branding/social/ and the marketplace preview.png at the repo root, with headless Chromium.
Run logo.py and kit.py first. Usage: python3 branding/tools/social.py"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wordmark import C, LOGO, ROOT, shot, lettering, png

S = os.path.join(ROOT, "social")
TAG = "Your Omarchy bar, in tidy pills"
SUB = "Show, hide, reorder and group bar widgets. Save layouts. Undo anything."
URL = "github.com/felipecpaiva/OmaBarConfigurator"
THEMES = {
  "dark":  dict(bg=C["ground"], fg=C["ink"], mute=C["mute"], lockup="lockup.svg",
                bar=C["bar"], pill="#33373f", dot="#9a9eb0", sel=C["mint"], seldot=C["ground"], txt=C["ink"]),
  "light": dict(bg=C["paper"], fg=C["ground"], mute=C["mute_light"], lockup="lockup-light.svg",
                bar=C["chip_light"], pill="#cfccc5", dot="#5b5f6e", sel=C["mint_deep"], seldot=C["paper"], txt=C["ground"]),
}

def pill_bar(t):
    """A small bar illustration: workspaces, a clock, and a selected (accent) group of tray icons, each in its own pill."""
    dots = lambda x0, n, fill, gap=22: "".join(f'<circle cx="{x0 + i*gap}" cy="32" r="6" fill="{fill}"/>' for i in range(n))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 64">'
            f'<rect width="640" height="64" rx="14" fill="{t["bar"]}"/>'
            f'<rect x="10" y="10" width="110" height="44" rx="22" fill="{t["pill"]}"/>'
            f'<circle cx="43" cy="32" r="6" fill="{t["sel"]}"/>' + dots(65, 2, t["dot"]) +
            f'<rect x="250" y="10" width="140" height="44" rx="22" fill="{t["pill"]}"/>'
            + lettering("21:04", 281, 41, 26, t["txt"]) +
            f'<rect x="466" y="10" width="164" height="44" rx="22" fill="{t["sel"]}"/>' + dots(504, 5, t["seldot"]) + "</svg>")

def page(w, h, th, layout):
    t = THEMES[th]
    lk = open(os.path.join(LOGO, t["lockup"])).read()
    k = {"wide": (0.20, 0.068, 0.036), "square": (0.13, 0.05, 0.028), "banner": (0.24, 0.085, 0.05)}[layout]
    bar = f'<div class="bar">{pill_bar(t)}</div>'
    url = "" if layout == "banner" else f'<div class="url">{URL}</div>'
    # the banner puts the bar beside the text, so the wide strip has no empty right half
    banner_css = ("<style>body{flex-direction:row!important;align-items:center;justify-content:space-between}"
                  ".bar{margin:0!important} .bar svg{width:420px!important} .sub{max-width:none!important;white-space:nowrap;font-size:19px!important}</style>")
    return f"""<!doctype html><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
body{{width:{w}px;height:{h}px;background:{t['bg']};color:{t['fg']};font-family:'JetBrainsMono Nerd Font','JetBrains Mono',monospace;
 display:flex;flex-direction:column;justify-content:center;padding:0 {int(w*0.08)}px;gap:{int(h*0.035)}px;overflow:hidden;position:relative}}
.lk svg{{height:{int(h*k[0])}px;width:auto;display:block;margin-bottom:{int(h*0.015)}px}}
.tag{{font-size:{int(h*k[1])}px;font-weight:700;line-height:1.2}}
.sub{{font-size:{int(h*k[2])}px;color:{t['mute']};line-height:1.4;max-width:{int(w*0.84)}px}}
.col{{display:flex;flex-direction:column;gap:{int(h*0.035)}px}} .bar{{margin-top:{int(h*0.03)}px}} .bar svg{{width:{int(min(w*0.6, 640))}px;display:block}}
.url{{position:absolute;right:{int(w*0.04)}px;bottom:{int(h*0.05)}px;font-size:{max(16, int(h*0.026))}px;color:{t['mute']}}}
</style>{banner_css if layout == "banner" else ""}<div class="col"><div class="lk">{lk}</div><div class="tag">{TAG}</div><div class="sub">{SUB}</div></div>{bar}{url}"""

def make(name, w, h, th, layout="wide"):
    shot(page(w, h, th, layout), os.path.join(S, name), w, h); print(name)

def preview(w=1280, h=720):
    """Marketplace preview: same size as the plugin's preview.png before it (1280 by 720), lockup over a large pill bar."""
    t = THEMES["dark"]; lk = open(os.path.join(LOGO, t["lockup"])).read()
    html = f"""<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box;margin:0}}
body{{width:{w}px;height:{h}px;background:{t['bg']};color:{t['fg']};font-family:'JetBrainsMono Nerd Font',monospace;
 display:flex;flex-direction:column;justify-content:center;padding:0 96px;gap:26px;overflow:hidden}}
.lk svg{{height:150px;width:auto;display:block}} .tag{{font-size:46px;font-weight:700;margin-top:12px}}
.sub{{font-size:24px;color:{t['mute']};line-height:1.5}} .bar svg{{width:{w-192}px;display:block;margin-top:36px}}</style>
<div class="lk">{lk}</div><div class="tag">{TAG}</div><div class="sub">{SUB}</div><div class="bar">{pill_bar(t)}</div>"""
    shot(html, os.path.join(os.path.dirname(ROOT), "preview.png"), w, h); print("preview.png (repo root)")

if __name__ == "__main__":
    os.makedirs(S, exist_ok=True)
    make("github-social-preview.png", 1280, 640, "dark")
    make("card-wide.png", 1200, 630, "dark")
    make("card-wide-light.png", 1200, 630, "light")
    make("card-square.png", 1080, 1080, "dark", "square")
    make("card-linkedin.png", 1200, 627, "dark")
    make("card-x.png", 1600, 900, "dark")
    make("banner-dark.png", 1600, 400, "dark", "banner")
    make("banner-light.png", 1600, 400, "light", "banner")
    png(os.path.join(LOGO, "icon.svg"), os.path.join(S, "avatar-400.png"), 400, 400); print("avatar-400.png")
    preview()
