Bar: a way to put space between widgets (a `gap` key, or more than one spacer)

The bar puts every widget right next to the one before it. There is no setting for the space between two widgets,
and the one tool for it, `omarchy.spacer`, can only be added once from the CLI.

I build OmaBar (https://github.com/felipecpaiva/OmaBarConfigurator), a panel plugin that draws rounded pills behind
groups of bar widgets. Where two groups meet, there is no room between them. I measured it on my bar: 13 px
between the sun icon of Weather and the icon of Agents. With a 4 px gap between the two pills, that leaves 4.5
px on each side, against 12 at the outer ends. It looks cramped, and a plugin cannot fix it, because the
spacing comes from the bar.

## What I found

- `Bar.qml` places the widgets by hand, with no spacing between slots.
- `omarchy.spacer` is the only real gap. Its manifest says `allowMultiple: true`, but `omarchy bar put` returns
  early when the widget is already on the bar (`PluginRegistry.qml`, `putBarWidget`: `if (inBar(id)) return ""`).
  So the CLI can place one spacer per bar. Only a drag in the bar, or a hand edit of `shell.json`, makes a second
  one. And with two copies, #10914 shows that a drag can move the wrong one.

## Two options, smallest first

1. **Let `omarchy bar put` add another copy of an `allowMultiple` widget** (for example with a `--new` flag, so the
   current "already on the bar" behaviour stays the default). This matches what the spacer manifest already says.
   It needs #10914 fixed to be comfortable.
2. **A `gap` key on any bar entry**, read by the bar: space after that widget, in px, like
   `{ "id": "omarchy.weather", "gap": 12 }`, set with `omarchy bar set omarchy.weather gap 12`. No extra widgets,
   no copies to track, works for every widget and every plugin. Maybe also a `bar.spacing` default for all of them.

I would go with 2. It solves the problem where it lives, and it does not depend on multiple copies.

## Where I am now

For the moment OmaBar uses its own invisible bar entry as a second spacer (it has a `size` setting). It works, but
it is a workaround, and I would like to remove it.

Screenshot of the tight join and the spacer fix:
https://github.com/felipecpaiva/OmaBarConfigurator/blob/v0.2-group-pills/branding/demo/spacer.gif

Happy to send a PR for option 2 if it sounds right to you. What do you think?
