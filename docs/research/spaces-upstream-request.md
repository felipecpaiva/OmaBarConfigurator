Title: activeStyle value that marks the active workspace with a short dash

Hi, and thanks for Spaces. It is the best workspace widget I have used on Omarchy.

I have a request about how the active workspace is drawn.

Right now the active workspace is a filled tile. The tile is almost as tall as the bar.
That is fine when Spaces sits alone on the bar.

It looks odd when Spaces sits inside a pill. I use a plugin that draws a rounded pill behind each bar widget. Then the tile is a box inside a box.
It is also taller than the marks of the other widgets.

I found `pillHeight` (#33). It helps a bit, but it shrinks the whole pill, and the icons and the number need that room. So I cannot get a small mark that way.

What I would like is a new `activeStyle` value, for example `"dash"` (or a new setting if you prefer).
With it, the active workspace gets no filled tile. It gets a short rounded dash instead. The dash would sit at the bottom edge of the pill. The look is about 22 px wide and 6 px high, with a 6 px gap to the pill edge.

It would be nice if the height and width of the dash were settings. A tile that is only shorter, with a configurable height, would also work for me.

Existing options near this: `iconHighlight: "dot"` and the pill background toggle (#46) already do something like this for app icons. I did not find an issue for the active workspace itself. If I missed one, please point me to it.

I looked at `Spaces.qml` in v1.8.0. As far as I can tell, the fill is the `Rectangle` that sets `color: pill.active ? root.activeFill() ...` at around line 1151. Its height comes from `implicitHeight: ... root.pillThickness` at line 1126. A `"dash"` style could keep that box for layout and draw a smaller rectangle in `activeFill()` colour instead of filling it.

I am not sure about vertical bars. I have only looked at the horizontal case.

I am happy to send a PR for this. Do you want one, and do you prefer a new `activeStyle` value or a separate setting?
