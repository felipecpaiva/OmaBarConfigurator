#!/usr/bin/env python3
"""Build the wordmark and lockups (SVG and PNG) into branding/logo/. Same geometry as explorations/v1-pills.
Usage: python3 branding/tools/kit.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wordmark import C, LOGO, wordmark, lockup, png

os.makedirs(LOGO, exist_ok=True)
files = {
    "wordmark.svg": wordmark(C["ink"]),                       # for dark grounds
    "wordmark-light.svg": wordmark(C["ground"]),              # for light grounds
    "lockup.svg": lockup(C["ink"], C["mint"]),                # for dark grounds
    "lockup-light.svg": lockup(C["ground"], C["mint_deep"]),  # for light grounds
}
for name, text in files.items():
    src = os.path.join(LOGO, name)
    open(src, "w").write(text)
    png(src, src[:-4] + ".png", h=256 if "lockup" in name else 192)
print("wordmark and lockups written to logo/")
