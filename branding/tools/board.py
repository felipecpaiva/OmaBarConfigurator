#!/usr/bin/env python3
"""Build the brand comparison board: branding/board.html and branding/board.png.
Each variation folder (vN-name) needs icon.svg, icon-mono.svg and concept.png. Optional: wordmark.svg, lockup.svg.
Local reference marks (the Omarchy icon, the Magnet icon) are shown only if they exist in branding/.refs/, which is
git-ignored: Magnet's icon is its makers' trademark and must not be committed to this public repo.
Usage: python3 branding/tools/board.py"""
import glob, html, os, subprocess, sys
os.environ["XDG_CACHE_HOME"] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache")
os.environ["XDG_CONFIG_HOME"] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".browser-config")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
variants = sorted(d for d in glob.glob(os.path.join(ROOT, "explorations", "v[0-9]-*")) if os.path.isdir(d))
refs = {n: os.path.join(ROOT, ".refs", f) for n, f in (("Omarchy icon", "omarchy-icon.png"), ("Magnet icon", "magnet-icon.png")) if os.path.exists(os.path.join(ROOT, ".refs", f))}

def rel(p): return os.path.relpath(p, ROOT)
def notes(d):
    p = os.path.join(d, "notes.md")
    return html.escape(open(p).read().strip()).replace("\n", "<br>") if os.path.exists(p) else ""

css = """
body{margin:0;background:#f4f3f0;color:#15171c;font:15px/1.45 'JetBrainsMono Nerd Font','JetBrains Mono',monospace}
h1{font-size:26px;margin:28px 32px 4px} .sub{margin:0 32px 20px;color:#555}
.grid{display:grid;grid-template-columns:repeat(%d,1fr);gap:22px;padding:0 32px 32px}
.card{background:#fff;border:1px solid #ddd;border-radius:14px;padding:18px}
.card h2{margin:0 0 2px;font-size:19px} .card .tag{color:#666;margin-bottom:12px;font-size:13px}
.row{display:flex;gap:14px;align-items:flex-end;margin:10px 0;flex-wrap:wrap}
.cap{font-size:11px;color:#777;margin-top:3px}
.bg-d{background:#12141a;border-radius:10px;padding:14px} .bg-l{background:#f7f6f3;border:1px solid #e3e1db;border-radius:10px;padding:14px}
img{display:block;image-rendering:auto} .px img{image-rendering:pixelated}
.notes{font-size:12px;color:#444;margin-top:12px;border-top:1px solid #eee;padding-top:10px}
.refs{margin:0 32px 28px;padding:16px;background:#fff;border:1px solid #ddd;border-radius:14px}
""" % max(1, len(variants))
out = [f"<!doctype html><meta charset=utf-8><title>OmaBar brand variations</title><style>{css}</style>",
       "<h1>OmaBar: brand variations</h1><p class=sub>Each card: the vector concept sheet, the vector icon at 512, 128, 64, 32 and 16 pixels, and the one-colour stencil on light and dark.</p><div class=grid>"]
for d in variants:
    name = os.path.basename(d)
    card = [f"<div class=card><h2>{html.escape(name)}</h2><div class=tag>concept picture, then the real vector icon</div>"]
    card.append(f"<div class=row><div><img src='{rel(d)}/concept.png' width=230><div class=cap>concept (vector render)</div></div><div><img src='{rel(d)}/icon.svg' width=230><div class=cap>icon.svg (vector)</div></div></div>")
    sizes = "".join(f"<div><img src='{rel(d)}/icon.svg' width={s} height={s}><div class=cap>{s}px</div></div>" for s in (128, 64, 32, 16))
    card.append(f"<div class='row'>{sizes}</div>")
    mono = lambda bg, label: f"<div class={bg}><img src='{rel(d)}/icon-mono.svg' width=64 height=64 style=\"{'filter:invert(1)' if bg=='bg-d' else ''}\"><div class=cap>{label}</div></div>"
    card.append(f"<div class=row>{mono('bg-l','stencil on light')}{mono('bg-d','stencil on dark')}</div>")
    for base, label in (("wordmark", "wordmark"), ("lockup", "lockup")):
        if os.path.exists(os.path.join(d, base + ".svg")):
            card.append(f"<div class=row><div class=bg-l><img src='{rel(d)}/{base}-light.svg' height=48><div class=cap>{label} on light</div></div><div class=bg-d><img src='{rel(d)}/{base}.svg' height=48><div class=cap>{label} on dark</div></div></div>")
    card.append(f"<div class=notes>{notes(d)}</div></div>")
    out.append("".join(card))
out.append("</div>")
if refs:
    out.append("<div class=refs><b>Not confusable?</b> The existing marks, for comparison only (local board, never committed)<div class=row>")
    for n, p in refs.items():
        out.append(f"<div><img src='{rel(p)}' width=128><div class=cap>{n}</div></div>")
    for d in variants:
        out.append(f"<div><img src='{rel(d)}/icon.svg' width=128><div class=cap>{os.path.basename(d)}</div></div>")
    out.append("</div></div>")
open(os.path.join(ROOT, "board.html"), "w").write("\n".join(out))
png = os.path.join(ROOT, "board.png")
result = subprocess.run(["chromium", "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--user-data-dir=" + os.path.join(ROOT, ".chromium-profile"), "--disable-crash-reporter", "--window-size=%d,2250" % max(1200, 620 * len(variants)), f"--screenshot={png}", "file://" + os.path.join(ROOT, "board.html")], capture_output=True)
if result.returncode != 0:
    from board_fallback import render
    render()
    print("Chromium blocked; rendered PNG with librsvg fallback.")
print("board:", rel(os.path.join(ROOT, "board.html")), "and", rel(png) if os.path.exists(png) else "(no png: chromium failed)")
