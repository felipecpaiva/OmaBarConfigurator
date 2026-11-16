# OmaBar branding

**Chosen direction: [v1-pills](explorations/v1-pills/), picked on 2026-11-16.** Two rounded groups of different lengths
above a short rail, the right group selected in mint. The kit below is built from it; the mark is unchanged from the
exploration. Read [BRIEF.md](BRIEF.md) for what the brand must say.

## The kit

| Folder or file | What is in it | Made by |
|----------------|---------------|---------|
| `logo/` | `icon.svg` (master: the mark on a graphite tile) and `icon-{1024,512,256,192,180,128,64}.png`; `icon-small.svg` (the mark on its native 16 grid) and `icon-{48,32,16}.png`; `favicon.ico` (16, 32, 48); `glyph.svg` and `glyph-light.svg` (transparent, for dark and light grounds) with 512 PNGs; `stencil.svg` and `stencil-white.svg` (one colour) with 512 PNGs | `tools/logo.py` |
| `logo/` | `wordmark.svg`, `wordmark-light.svg`, `lockup.svg` (dark grounds), `lockup-light.svg`, and a PNG of each | `tools/kit.py` |
| `social/` | `github-social-preview.png` (1280 by 640), `banner-dark.png` and `banner-light.png` (1600 by 400, README banner), `card-wide.png` and `card-wide-light.png` (1200 by 630), `card-square.png` (1080), `card-x.png` (1600 by 900), `card-linkedin.png` (1200 by 627), `avatar-400.png` | `tools/social.py` |
| `../preview.png` | Marketplace preview, 1280 by 720 (same size as before): lockup, tagline and a pill bar | `tools/social.py` |
| `terminal/` | `banner.txt` (plain half-block "OmaBar") and `banner.ansi` (the "B" in mint) | `tools/terminal.py` |
| `brand-sheet.html`, `brand-sheet.png` | Palette with computed WCAG contrast ratios, type, spacing, do and do not | `tools/sheet.py` |

Tagline: **Your Omarchy bar, in tidy pills.** Sub line: Show, hide, reorder and group bar widgets. Save layouts. Undo anything.

Palette: graphite `#16181d`, near white `#f4f5f7` (the mark), mint `#5cdbc0` (on dark), paper `#f4f3f0` (light ground),
and **mint deep `#0f7d68`** for light grounds, added because the approved mint is only 1.53:1 on paper. Mint deep is
4.56:1 on paper. All ratios are on the brand sheet.

### Rebuild

```
python3 branding/tools/logo.py      # logo set and favicon (rsvg-convert, ImageMagick)
python3 branding/tools/kit.py       # wordmark and lockups
python3 branding/tools/social.py    # social images and ../preview.png (headless Chromium)
python3 branding/tools/sheet.py     # brand sheet (headless Chromium)
python3 branding/tools/terminal.py  # terminal banners
```

`tools/wordmark.py` holds the shared parts: the mark geometry, the palette, the outlined JetBrains Mono Bold lettering
(fontTools, so no SVG needs the font), the pixel letters and the Chromium helper. The tools were copied from omagnet's
kit and adapted. Social images and the brand sheet are headless Chromium screenshots, using a throwaway profile in a
temp folder. Needs `rsvg-convert`, `magick`, `chromium`, Python with fontTools, and JetBrains Mono Nerd Font installed.

## The three explorations (record)

Three logo directions made on 2026-11-16.

| Folder | Idea |
|--------|------|
| [v1-pills](explorations/v1-pills/) | Two rounded groups of different lengths above a short rail, with a mint selection. Order on the bar. |
| [v2-seam](explorations/v2-seam/) | A single capsule divided once, with an amber right segment. The split and join action. |
| [v3-monogram](explorations/v3-monogram/) | A rounded B with two stacked pill counters and a blue lower bowl. The bar in an initial. |

Each folder contains `icon.svg` (real vector master), `icon-mono.svg`, `icon-512.png`, `icon-32.png`, `icon-16.png`, a 1024 px `concept.png` and its vector source, outlined `wordmark.svg` and `wordmark-light.svg`, `lockup.svg` and `lockup-light.svg`, and `notes.md`.

The `-light` files use graphite lettering on light backgrounds. Standard wordmarks and lockups use near white lettering on dark backgrounds. Icons have transparent backgrounds. `icon-light.svg` provides the colour icon for light surfaces; `icon-mono-dark.svg` provides the near white one-colour stencil for dark surfaces. `icon-mono.svg` is graphite for light surfaces.

### How they were made

- Original icons drawn as paths and rounded shapes on a 16 by 16 coordinate grid. No raster images are embedded in the icon masters.
- JetBrains Mono Bold wordmarks converted into actual vector paths with fontTools. SVGs need no installed font.
- `python3 branding/tools/build.py` recreates vectors and PNGs with fontTools and `rsvg-convert`. The installed source font is recorded in that script.
- Concept sheets use the actual vectors, with palette swatches and one-colour previews. Image generation was omitted: the built-in image tool saves under `$CODEX_HOME` outside `branding/`, which conflicts with this task's write boundary. No `codex-concept.png` files are claimed.
- `tools/board.py` was copied from omagnet's kit and adapted for OmaBar. Run `python3 branding/tools/board.py` for [board.html](board.html) and [board.png](board.png). Chromium cannot start here because a sandbox restriction blocks its Crashpad socket operation. The script therefore renders the PNG using `tools/board_fallback.py` and librsvg. The PNG is a comparison board, not a Chromium screenshot.
- Browser cache and profile paths are contained in `branding/`. No commits or pushes were made.

### Review

Every SVG was rendered with `rsvg-convert`. Native 16 px exports and enlarged pixel views were visually checked. One-colour previews preserve gaps, seam and counters. [pixel-check.png](pixel-check.png) shows the colour silhouettes at native size and enlarged without smoothing. No text file under `branding/` contains U+2014 or U+2013.

## Licence

Original artwork made for this project and released under the project's MIT licence unless the maintainer chooses otherwise. OmaBar is not affiliated with or endorsed by Omarchy. JetBrains Mono is an open-source typeface under the SIL Open Font License; the wordmarks contain outlines only.
