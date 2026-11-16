# OmaBar branding

Three logo directions made on 2026-11-16. Read [BRIEF.md](BRIEF.md) first.

| Folder | Idea |
|--------|------|
| [v1-pills](explorations/v1-pills/) | Two rounded groups of different lengths above a short rail, with a mint selection. Order on the bar. |
| [v2-seam](explorations/v2-seam/) | A single capsule divided once, with an amber right segment. The split and join action. |
| [v3-monogram](explorations/v3-monogram/) | A rounded B with two stacked pill counters and a blue lower bowl. The bar in an initial. |

Each folder contains `icon.svg` (real vector master), `icon-mono.svg`, `icon-512.png`, `icon-32.png`, `icon-16.png`, a 1024 px `concept.png` and its vector source, outlined `wordmark.svg` and `wordmark-light.svg`, `lockup.svg` and `lockup-light.svg`, and `notes.md`.

The `-light` files use graphite lettering on light backgrounds. Standard wordmarks and lockups use near white lettering on dark backgrounds. Icons have transparent backgrounds. `icon-light.svg` provides the colour icon for light surfaces; `icon-mono-dark.svg` provides the near white one-colour stencil for dark surfaces. `icon-mono.svg` is graphite for light surfaces.

## How they were made

- Original icons drawn as paths and rounded shapes on a 16 by 16 coordinate grid. No raster images are embedded in the icon masters.
- JetBrains Mono Bold wordmarks converted into actual vector paths with fontTools. SVGs need no installed font.
- `python3 branding/tools/build.py` recreates vectors and PNGs with fontTools and `rsvg-convert`. The installed source font is recorded in that script.
- Concept sheets use the actual vectors, with palette swatches and one-colour previews. Image generation was omitted: the built-in image tool saves under `$CODEX_HOME` outside `branding/`, which conflicts with this task's write boundary. No `codex-concept.png` files are claimed.
- `tools/board.py` was copied from omagnet's kit and adapted for OmaBar. Run `python3 branding/tools/board.py` for [board.html](board.html) and [board.png](board.png). Chromium cannot start here because a sandbox restriction blocks its Crashpad socket operation. The script therefore renders the PNG using `tools/board_fallback.py` and librsvg. The PNG is a comparison board, not a Chromium screenshot.
- Browser cache and profile paths are contained in `branding/`. No commits or pushes were made.

## Review

Every SVG was rendered with `rsvg-convert`. Native 16 px exports and enlarged pixel views were visually checked. One-colour previews preserve gaps, seam and counters. [pixel-check.png](pixel-check.png) shows the colour silhouettes at native size and enlarged without smoothing. No text file under `branding/` contains U+2014 or U+2013.

## Licence

Original artwork made for this project and released under the project's MIT licence unless the maintainer chooses otherwise. OmaBar is not affiliated with or endorsed by Omarchy. JetBrains Mono is an open-source typeface under the SIL Open Font License; the wordmarks contain outlines only.
