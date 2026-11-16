Pills no longer slow down the bar while it animates. A workspace switch with pills on is now as fast and as smooth as with pills off.

## Fixed

- **Workspace switches were slow with pills on**, most visible on battery. The bar dropped to about 40 frames per second and a switch stretched from about 390 ms to about 600 ms. Three causes, all fixed:
  - Every widget that shifted by a pixel re-ran the whole pill calculation: about 65 times a frame. Now it runs once a frame.
  - Each run re-measured the icons of every widget in the section. Now only a widget whose size changed is measured again, so hovering never re-measures.
  - The pill restarted its glide on every frame of a widget's own animation and chased it. Now it follows the widget frame by frame, and only a single change after a quiet moment glides.
- **A pill ending on a box** (such as the active workspace in Spaces) now hugs it with the same space as above and below it, so the box sits evenly in the round end.

## Measured

60 fps recordings of the bar while switching workspaces, on battery (power-saver):

| Build | Frame rate | Switch |
|-------|-----------:|-------:|
| Pills off | 60 fps | 350 to 417 ms |
| v0.2.0 | 38 to 43 fps | 567 to 650 ms |
| v0.2.1 | 55 to 60 fps | 367 to 417 ms |

Details: [docs/research/cost.md](https://github.com/felipecpaiva/OmaBarConfigurator/blob/master/docs/research/cost.md).

## Update

`cd OmaBarConfigurator && git pull && ./install.sh`, then `omarchy restart shell`. Your settings are kept.
