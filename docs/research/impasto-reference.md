# impasto: reference for the look and feel pass

Written 2026-11-16 for plan.md Batch 4.5. Source: andreumassanet/impasto (GPL-3.0), an Arch +
Hyprland shell on Quickshell 0.3. It is a whole shell, not an Omarchy plugin, so it owns every
widget it draws. OmaBar only draws shapes behind stock widgets.

**License rule.** Nothing below is code to copy. These are ideas, numbers and behaviour, written
in our own words. File references are relative to `home/.config/quickshell/` in that repo, so a
builder can check the reasoning. How verified: read the QML and the palette script, and looked at
`.github/assets/bar-styles.jpg` and `liquid-glass.jpg`. Nothing was run.

## 0. The three lessons that matter most for OmaBar

1. **Padding belongs to the item, not to the capsule.** An impasto capsule adds only 4 px at
   each end; each chip carries 8 px of its own on both sides. So glyph to glyph is 16 px and
   capsule edge to glyph is 12 px, and the rhythm is even everywhere (section 2).
2. **The active workspace is a short shape inside a tall capsule.** At the default 32 px bar the
   active mark is a 22 x 6 px pill (dots) or a 20 px tall pill (numbers). Nothing inside the
   strip comes closer than 6 px to the capsule's top or bottom edge (section 3).
3. **The workspace strip and the tray never share a capsule.** They always get one of their
   own; everything else shares until a split (section 1).

## 1. Bar styles

Four styles, one layout (`bar/Bar.qml:24-31`, list and notes at `services/SettingsService.qml:194-199`).
The layout is two lists, left and right of the island; the style only decides how they are drawn,
so switching style keeps the layout. Defaults: left is the workspaces, right is tray,
notifications, network, bluetooth, volume, battery (`SettingsService.qml:206-209`).

- **Grouped (default).** The island (clock) sits at screen centre. Each side is a row of capsules
  whose inner end is anchored to the island's edge plus an 8 px gap (`Bar.qml:1106-1108`,
  `1130-1132`). Because they hang off the island's animated edges, they slide aside when the
  island widens, with no animation of their own (`Bar.qml:1069-1072`). When a full panel opens,
  the sides fade out; for a module detail they only move aside (`Bar.qml:211-219`).
- **Spread.** Same capsules, but the left row starts at the side margin (18 px) and the right
  row ends at it (`Bar.qml:1107`, `1131`). The island stays centred between. Sides only fade if a
  panel is wider than the room between them (`Bar.qml:113-122`).
- **One island.** One black band, a capsule tall, holds both sides and the island. Capsules lose
  their fill and rim ("chromeless", `bar/widgets/BarZone.qml:29-30`, `209-211`). Each side is
  inset 12 px from the band end (`Bar.qml:136`) and the gap between groups widens from 8 to 14 px
  (`BarZone.qml:61`). **Both end slots are the width of the wider side** (`Bar.qml:138-141`), so
  the clock stays exactly centred on the screen however lopsided the two sides are.
- **Bezel.** The band runs edge to edge across the top; screen corners can be rounded to match;
  the island "drops" out of the band's middle with concave fillets (`Bar.qml:106-109`, `769-804`).

What decides grouping (`BarZone.qml:18-59`): walk the list; a `split` entry closes the current
capsule; `workspaces` and `tray` always close it and get their own; everything else joins the
open capsule. A capsule whose items are all absent on this machine (no battery) is not drawn
(`BarZone.qml:91-94`, `113-114`). A capsule with exactly one item takes the item's own shape:
no extra padding, a lone ring becomes the capsule, a lone button becomes a circle
(`BarZone.qml:96-110`, `bar/widgets/BarChip.qml:21-23`).

The screenshot (`bar-styles.jpg`) shows grouped as: workspace capsule, a lone circle button, a
two-icon capsule, then the island, then a five-item status capsule and a two-ring capsule.

## 2. Capsule geometry (default bar, all in logical px)

Everything derives from one number, `barHeight` (default 32, slider 24 to 48,
`SettingsService.qml:546-549`, `settings/BarSection.qml:124-131`). There is no scale factor of its
own; Wayland's output scale handles HiDPI. Tokens in `theme/Theme.qml:297-309`.

| What | Value at 32 px | Rule / source |
|---|---|---|
| Capsule height | 32 | `= barHeight` (`Theme.qml:299`) |
| Capsule radius | 16 (fully round) | `height / 2` (`BarZone.qml:208`) |
| Rim | 1 px, `#262626` on classic | `Theme.qml:76-79`, `BarZone.qml:210-211` |
| Distance from top edge | 16 | `barMargin`, slider 0 to 32 (`SettingsService.qml:550`) |
| Distance from side edge | 18 | `barSideMargin`, matches Hyprland `gaps_out` (`Bar.qml:93-95`) |
| Gap between capsules | 8 | `capsuleSpacing` (`Theme.qml:301`) |
| Gap between groups in one island | 14 | `BarZone.qml:61` |
| Capsule end padding | 4 (0 if alone or chromeless) | `BarZone.qml:110` |
| Chip side padding | 8 each side (11 if alone) | `bar/modules/ChipFace.qml:49` |
| Icon (glyph) size | 14 | `round(0.44 x height)` (`ChipFace.qml:48`) |
| Icon to its value text | 5 | `ChipFace.qml:50` |
| Value text | 11 px, DemiBold, tabular digits | `ChipFace.qml:197-201`, `Theme.qml:544` |
| Ring gauge | full capsule box, drawn at 0.85 when shared | `ChipFace.qml:37-39`, `142` |
| Hover / open highlight | pill 24 tall (height minus 8), chip width minus 4 | `BarChip.qml:101-110` |
| Exclusive zone | top margin + height = 48 | `Theme.qml:303-306` |

Reading of the spacing, which is Felipe's complaint:

- Glyph to glyph inside one capsule = 8 + 8 = **16 px**. Capsule edge to first glyph = 4 + 8 =
  **12 px**. Capsule to capsule = **8 px** of wallpaper. So the inner padding (12) is a little
  more than the outer gap (8), and widget spacing (16) is a little more than the padding.
- Because padding is per chip, the hover highlight (chip width minus 4) gets an even 2 px
  margin from its neighbours and fits inside the capsule with 4 px top and bottom.
- Value text uses tabular digits and a fixed max width, so a ticking number never shifts the
  capsule (`ChipFace.qml:23-24`).
- Vertical centring: every chip is the full capsule height and centres its content
  (`BarChip.qml:95`, `ChipFace.qml:78`).

## 3. Workspace strip

`bar/widgets/WorkspacesWidget.qml`. Seven styles: dots, bars, rings, and the number written as
numbers, roman, kanji or greek (`SettingsService.qml:323-331`). Default dots. Three states are
told apart by shape and weight only (`WorkspacesWidget.qml:20-30`): focused, occupied, empty.

Sizes (`WorkspacesWidget.qml:56-70`), at a 32 px bar:

- **Dots:** dot 6 x 6. Focused is a pill **22 wide x 6 tall**. Slot gap 8.
- **Bars:** 3 wide; height 14 focused, 9 occupied, 5 empty (`:231-234`).
- **Rings:** 7 px hollow ring with a 1.5 px line when empty; 9 px filled when focused; dim fill
  when occupied (`:250-261`).
- **Written:** each number in a slot at least 20 wide (number plus 6 px each side), slot gap 2.
  Focus is one accent pill, **height min(20, barHeight minus 10)**, that slides to the focused
  number and takes its width (`:146-169`). Text on it uses the palette's on-accent colour.
- Strip padding: 10 px each end for shapes, 6 px for written (`:133-134`). The strip is its own
  capsule with the same ground and rim as the others (`:135-139`).
- Optional: icons of the focused workspace's apps (max 4, icon 14 px, 5 px apart) inside or
  beside the active mark (`:64-70`, `:194-197`).
- Hit area: the whole slot including its gap, because a 6 px dot is too small to click (`:328`).

Colours: focused and hovered are the accent at full; occupied is the accent at 55 % opacity;
empty is a fixed dim grey (`#4d4d4d`), or white at 72 % when the strip sits straight on the
wallpaper (`:237-241`, `Theme.qml:139-143`, `215`).

Animation: slots exist for every workspace, shown or not, so arrivals and departures animate
their width instead of jumping (`:177-179`, `:210-220`). Slot width and the written pill's x and
width run 200 ms on the shared curve; colour and opacity 140 ms (`:162-168`, `:218-222`,
`:243-245`). Note: in dots style the dot's own width is not animated, only its slot's width, so
the active pill jumps to 22 px while the neighbours glide.

**Why this matters for the spaces widget complaint.** impasto's tallest active mark is 20 px in
a 32 px capsule (6 px clear above and below), and in dots style only 6 px. It never draws a box
the height of the capsule inside the capsule. A widget that paints its own full height tiles
inside one of our pills will always read as a box inside a box.

## 4. Colour and material

**Palette from the wallpaper** (`scripts/theme_manager.py:3890-3953`). The image is shrunk to
120 x 120 and quantised to 24 colours with ImageMagick. The accent is the most saturated
mid-tone (saturation over 0.2, luminance 0.2 to 0.85, score favours saturation and a luminance
near 0.55). Grounds are near black, nudged a few percent toward the accent. Text is fixed
near-white. On-accent text is dark if the accent's luminance is over 0.45, else white. Terminal
colours are pushed to WCAG contrast floors by moving lightness only (`:633-695`). In the shell,
every palette colour cross-fades over 260 ms on a change (`Theme.qml:283-293`).

**The capsules themselves are not tinted by the wallpaper.** The island and capsule ground is
pure black on classic (`Theme.qml:29-36`, `46`). Only the accent (workspace marks, toggles) and
the glass ground follow the palette. Status colours (battery low and so on) are fixed and never
follow the accent, so a warning always reads as one (`Theme.qml:212-219`).

**Materials** (`surfaceStyle`, default classic; `Theme.qml:38-80`, `97-165`):

- **Classic:** opaque black, 1 px `#262626` rim, hover veil `#1f1f1f`. No blur.
- **Glass:** ground is the accent scaled to 22 % at 90 % opacity (the terminal's own ground),
  white rim at 20 %. A compositor blur is switched on for the bar's layer namespace only while
  the ground is see-through (Hyprland layer rule, `blur` plus `ignore_alpha 0.12`,
  `services/CompositorService.qml:405-421`). Over it, `components/GlassSheen.qml` lays a top
  sheen (white 10 % fading over 48 px) and a "thick edge": four inset 1 px outlines at falling
  strength.
- **Liquid:** cool dark frost, rgba(0.06, 0.07, 0.09, 0.66), dense enough that muted text holds
  over a pale wallpaper. Rim is a trace (white 8 %), and the light comes from one side: a conical
  gradient mask makes the rim bright at top left and bottom right and faint elsewhere
  (`components/LitEdge.qml:18-81`), via a MultiEffect mask layer.
- **Bare sides:** icons straight on the wallpaper, each kept readable by a doubled drop shadow
  (`Bar.qml:1090-1095`, `1059-1065`).
- Optional bar shadow (off by default): a grown copy of the shape blurred with MultiEffect,
  reach about 8 px, spread 2 px, 50 % black, cut out under see-through grounds
  (`BarZone.qml:120-183`, `Theme.qml:485-507`).

Cost: classic is plain rectangles. Glass and liquid cost a compositor blur under the bar every
frame anything behind it changes, plus offscreen layers for the sheen mask (liquid) and the
shadow. A game mode turns all of it off at once (`Theme.qml:556-564`). No custom shaders are
used for the bar; the only ShaderEffect in the shell is a desktop spectrum widget.

## 5. Animations

Three durations and one user curve (`Theme.qml:566-598`): fast 140 ms (colour, hover, fades),
medium 200 ms (position, radius, workspace marks), morph 380 ms (island size). All are scaled by
a motion setting (presets: Smooth 100 % OutCubic, Snappy 70 % OutQuint, Springy 110 % OutBack,
None 0). Default is OutCubic at 100 %.

| What | Trigger | Duration, curve | Source |
|---|---|---|---|
| Island width and height | layer change (glance, detail, panel, toast) | 380, user curve | `bar/widgets/DynamicIsland.qml:412-423` |
| Island radius | same | 200 | `DynamicIsland.qml:424-427` |
| One-island band widens with island | same | 380, same clock | `Bar.qml:143-152`, `175-193` |
| Side capsules move aside | island width | none of their own, anchored | `Bar.qml:1069-1072` |
| Sides fade out or in | panel opens | 140 out in one-island, else 200 | `Bar.qml:1110-1118` |
| Whole bar fade | bar painted on this screen or not | 140 | `Bar.qml:476-480` |
| Bar slides up (autohide, zen) | pointer leaves top edge, 300 ms delay | 140 or 200 | `Bar.qml:482-487`, `304-305` |
| Chip value reveal on hover | pointer enters | 140, OutCubic | `BarChip.qml:86-89` |
| Hover highlight | pointer enters | 140 opacity | `BarChip.qml:107-109` |
| Hover card under a chip | rest 280 ms on it | 140 height grow | `BarChip.qml:78-84`, `Bar.qml:1220-1221` |
| Glance opens on island hover | rest 80 ms; 260 ms grace to close | morph | `DynamicIsland.qml:299-357` |
| Workspace mark move and resize | workspace change | 200 / 140 | section 3 |
| Palette change | new wallpaper | 260 colour fade | `Theme.qml:283-293` |
| Island rim appears | island takes the band | 200 colour | `Bar.qml:842-844` |

Engineering notes worth keeping: the bar's layer surface is full screen and never resizes,
because resizing it per frame makes the bar jitter; input is limited with a mask instead
(`Bar.qml:227-233`). One animated value per axis, never animate a sum (`DynamicIsland.qml:412-415`).
The value text fades in only after 20 % of the reveal so a half open chip never shows half a word
(`ChipFace.qml:176-194`).

Idle cost: at rest nothing loops. The only infinite animations near the bar are the recording
dot's 1.8 s breathing (only while recording, `bar/island/IslandRest.qml:178-184`) and the pet's
bob in its card. Everything else runs only on a state change.

## 6. What OmaBar could adopt, ranked

Tags: **(a)** possible behind stock widgets with today's painter; **(b)** needs the planned
row 16 spacing setting; **(c)** only by restyling a widget itself (its own settings, or a clone
via `omarchy plugin clone`); **(d)** out of scope. Idle cost: zero, small, or GPU.

1. **Keep the workspaces widget out of shared pills, by default.** impasto always gives the
   strip its own capsule. For OmaBar: a per-group "no pill" option, or auto-skip for widgets
   that paint their own background. (a), zero.
2. **Fix the tall active tiles at the source.** Use the spaces widget's own `activeStyle` and
   `density` settings to get a short active mark (dot or 20 px pill), or clone it and draw a
   22 x 6 px active pill with 6 px dots and 8 px gaps. The painter cannot shrink another
   widget's tiles. (c), zero.
3. **Spacing rule: padding per widget, not per pill.** Target 12 px pill edge to first glyph,
   16 px glyph to glyph, 8 px between pills. Today's default 12 / 8 matches the outside;
   the inside needs real spacing between widgets. (b), zero.
4. **Lone widget takes its own shape.** A pill with one widget gets no extra padding (11 px
   each side instead of 12, or a circle for an icon-only button). (a) for the circle and
   padding, zero.
5. **Clock stays centred in a one-pill center area:** make both end slots the width of the
   wider side, as impasto's one-island style does. Already a quality bar item; this is the
   method. (a), zero.
6. **Pill radius = height / 2, rim 1 px, near-black ground with a faint rim** (classic look).
   Matches our defaults; confirm `borderOpacity` gives about `#262626` on dark themes. (a), zero.
7. **Theme colour fade.** Animate pill fill and rim over about 260 ms when the theme changes
   instead of snapping. (a), zero at idle (runs only on a theme switch).
8. **Pills follow layout changes smoothly:** animate pill x and width over 200 ms, OutCubic,
   when widgets appear or hide. One value per axis, never a sum. (a), zero at idle; a few
   frames per change. Must still pass the cost bar.
9. **Gap between groups slightly wider when pills are flat** (14 vs 8 px in impasto's
   one-island style). Only if we add a "one pill" style. (b), zero.
10. **Hover highlight pill inside a pill** (capsule height minus 8, chip width minus 4).
    Needs per-widget hover, which stock widgets own. (c), zero.
11. **Glass sheen and thick edge** (top gradient plus 4 inset outlines). Paintable as plain
    rectangles behind widgets, but the look needs a compositor blur layer rule on the bar
    namespace, which is Omarchy's to own. (a) for the rectangles, GPU for the blur; v0.2 cost
    bar says no. Later.
12. **Liquid one-side lighting** (conical mask via MultiEffect). (a) technically, GPU
    (offscreen layer per pill). Out for v0.2.
13. **Per-pill drop shadow.** MultiEffect blur per pill. (a), GPU. Out for v0.2 by the cost bar.
14. **Island morph, hover cards, value reveal on hover, autohide.** These are widget and
    shell behaviour, not shapes. (d).
15. **Accent from the wallpaper.** Omarchy themes own the palette. (d).

Not checked: the impasto screenshots were judged by eye, not measured; the dot-width jump in
section 3 is from reading the code, not from running it.
