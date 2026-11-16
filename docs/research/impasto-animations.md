# How impasto animates things that grow

A closer look at expansion in impasto (andreumassanet/impasto, GPL-3.0), to decide how OmaBar
pills should follow their widgets. Ideas and numbers only, no code copied. Paths are under
`home/.config/quickshell/` in that repo; line numbers are from the clone read on 2026-11-16.
Durations and the motion presets are in [impasto-reference.md](impasto-reference.md) section 5.

## 1. What impasto animates, and how

**Plain eased tweens, no springs.** Every size and position change is a `Behavior` with a
`NumberAnimation` on the shell's curve (OutCubic by default). There is no `SpringAnimation` or
`SmoothedAnimation` anywhere in the shell. The "springy" feel is only the optional OutBack
preset (`theme/Theme.qml:566-598`).

**Which properties.** Width and height (island 380 ms, `bar/widgets/DynamicIsland.qml:416-423`),
radius (200 ms, `:424-427`), x and width of the workspace focus mark (200 ms,
`bar/widgets/WorkspacesWidget.qml:162-168`), a slot's preferred width (200 ms, `:218-220`),
opacity for anything that comes or goes (110 to 200 ms), color (140 ms). Never scale for
growth: scale appears only as a small shrink of a chip's icon while its value opens
(`bar/modules/ChipFace.qml:142`).

**One animated value, everything else derived.** This is the core trick. The island animates
its own width; the band around it, the side capsules and the fillets have no Behavior of their
own and read the island's live width every frame (`DynamicIsland.qml:412-415`,
`bar/Bar.qml:1108`). The comment there gives the reason: animating a sum whose other term
changes every frame restarts the animation on every change and settles late. Where a second
value must move with the first (the band blending from rest to island, `Bar.qml:179-182`), it
uses the same duration and curve so both land together, and clamps with `max()` so an
overshooting curve cannot open a gap (`Bar.qml:186-191`).

**Content and shape in sync.** Two ways:
- The shape follows the content. A capsule's width is just its chips' implicit width, with no
  Behavior (`bar/widgets/BarZone.qml:115-117`). When a chip opens its value on hover, the chip
  animates one `reveal` number from 0 to 1 (140 ms OutCubic, `bar/widgets/BarChip.qml:87-89`)
  and its width is computed from it (`ChipFace.qml:66-69`); the capsule grows with it for free.
- The content is clipped by the shape. The island has `clip: true` (`DynamicIsland.qml:394`),
  and inside it the old contents fade out in 110 ms while the new layer fades in (`:441-444`,
  `:477`, `:520-523`). The value text inside a chip is clipped too and only starts to fade in
  after 20 % of the reveal, so a half open chip never shows half a word (`ChipFace.qml:177-194`).

**When content changes size on its own** (a number gets wider, a chip appears): the capsule
snaps, because its width is bound straight to the content and the content snapped. Impasto only
smooths growth it causes itself (hover reveal, island layers, workspace slots).

**A highlight that slides between fixed content.** The workspace focus mark glides its x and
width in 200 ms on the shell curve (`WorkspacesWidget.qml:155-168`). The numbers under it do not
move on a focus change, and a slot that appears grows its own width over 200 ms (`:218-220`).
So impasto never lets a shape lag behind content that jumped: it owns the content, and a shape
derived from content gets no clock of its own (`DynamicIsland.qml:412-415`). The mark only
gives us a movement figure: 200 ms.

**First appearance.** The island keeps an `animated` flag false for the first frame and turns
it on when the component completes, so it does not grow out of nothing at startup
(`DynamicIsland.qml:177-179`, `:410`). Every geometry Behavior checks that flag.

**Stagger.** None. Things that move together are tied to one value instead of being timed
against each other.

**Idle cost and jank.** Nothing loops at rest; animations run only on a state change. The layer
surface is full screen and never resizes, since resizing it per frame jitters
(reference section 5). Hidden things use `visible: opacity > 0` so a faded item stops drawing.

## 2. What applies to OmaBar

Our pills sit behind stock widgets that we cannot animate, so impasto's way (shape bound to
content, content animated) is closed to us: the widgets always jump. Impasto's nearest answer
is snap, since its capsules follow their content with no Behavior. Gliding is our own design
call, from Felipe's ask and the plugin motion rule "keep a change from jumping", not something
impasto does.

**Recommendation: glide, short and front loaded.** A pill that snaps is correct but the jump
reads as a flicker of the whole group; a pill that glides shows where the group went. The cost
is a brief trail where a widget hangs past the pill edge while it grows. Keep that trail short
with a strong ease out: Omarchy's `Style.easeOut` ([0.23, 1, 0.32, 1]) at 160 ms puts the pill
40 % of the way after 16 ms, 78 % after 40 ms and 97 % after 80 ms. The setting lets anyone who
prefers snap turn it off.

| What | Duration | Curve | Why |
|---|---|---|---|
| Pill start and end | `Style.duration(160)` | `Style.easeOut` | Shorter than impasto's 200 ms mark because our trail is visible; under the 300 ms plugin rule |
| Pill color | the painter's `fadeDuration` (250 today) | `Style.easeOut` | Matches the stock bar background fade on a theme switch |
| First appearance | none | | Appears at its final place; no fade, see below |

Taken from impasto:
- Animate the two edges, never x and width. Each edge is one value; x and width are derived
  and rounded to whole pixels every frame, so both edges land together.
- An "only after placed" flag so a new pill never grows from zero.
- No spring, no bounce, no loop, no Timer: idle cost stays zero.

Left out on purpose:
- Fade in on creation. The painter rebuilds every pill of a section when the pill count
  changes, so a fade would blink the groups that did not change. If the painter later reuses
  shapes when the count changes, a 120 ms opacity fade for truly new pills would be worth adding.
- Radius animation. Radius follows the size and the setting; it never needs its own clock.
- Clip and content fades: we do not own the content.

One limit to know: when a group appears or disappears, the whole section is rebuilt and snaps.
Only changes that keep the pill count (a widget joining a group, a number getting wider, a
preset that moves widgets inside groups) glide.
