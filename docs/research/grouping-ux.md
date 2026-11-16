# Grouping UX: a more direct Groups page

Status: research and proposal, nothing built. Written 2026-11-16 for branch `v0.2-group-pills`.
Read with [../architecture.md](../architecture.md) (the breaks, solo, noPill, centerParts model)
and `lib/Groups.js` (the `rows()` view the page draws from).

## 1. The problem

The Groups page today is one long column: every widget is a row with a Shared / Own / None
choice, most rows also carry a "New pill starts here" switch, and each pill's first row adds a
"Move pill N to Left / Center / Right" row. With about 20 widgets that is about 20 button groups,
18 switches and several move rows, over 1,100 px of scrolling. The pill shape itself is only hinted
by a fill on every other row. You cannot see the bar you are editing, and the page has no keyboard
path (its `ButtonGroup`s are `focusable: false`, and the panel's key catcher only drives the
Widgets page, `Panel.qml` around line 1218).

## 2. How others do it

Sources are linked per row. Where a search came back unconfirmed, the cell says so. The
"many items" column is my own assessment unless a source is named.

| Product | Interaction | Split and join | How state shows | Keyboard | With many items |
|---|---|---|---|---|---|
| Omarchy bar (our host) | Drag widgets on the live bar; press and hold 200 ms or move 4 px starts a drag (`Bar.qml` 2489 to 2523, plugin README) | No groups; order only | The bar itself, a ghost shows the drop room | None for reorder; `omarchy bar move` from scripts | Fine, it is the real bar |
| Bartender 5 | Settings window shows Shown, Hidden, Always Hidden strips; drag icons between them. Groups: drag a "group" lozenge into a strip, then drag items into it ([podfeet](https://www.podfeet.com/blog/2023/11/bartender-5/), [TechRadar](https://www.techradar.com/how-to/organise-mac-menu-bar-icons-using-bartender)) | Drag in or out of a group | Strips are pictures of the bar | Hotkeys show sections; no keyboard arranging found | Strips wrap; icons only, no names, so similar icons get confused |
| Ice | Drag and drop layout of visible, hidden, always hidden sections; Cmd drag in the real bar ([GitHub](https://github.com/jordanbaird/Ice)) | Item groups listed as a feature, not confirmed | Same strips | Hotkeys toggle sections; no keyboard arranging documented | Not documented |
| Hidden Bar | Cmd drag icons across one arrow divider in the real bar ([GitHub](https://github.com/dwarvesf/hidden), [9to5Mac](https://9to5mac.com/2024/06/07/hidden-bar-bartender-alternative/)) | One divider is the whole model | The divider position | None | Which side hides differs between versions (sources disagree) |
| macOS Control Center | A list; per item a "show in menu bar" choice: always, when active, never ([Apple](https://support.apple.com/guide/mac-help/change-dock-menu-bar-preferences-mchlp1119/12.0/mac), [askdavetaylor](https://www.askdavetaylor.com/?p=46455)) | n/a | Popup per row | Standard form keys | A long form, no picture: the same problem we have |
| Touch Bar / Control Strip | "Customize" mode: drag buttons from a palette on screen onto the strip, drag off to remove, drag along it to reorder ([Apple](https://support.apple.com/guide/mac-help/mchl5a63b060)) | n/a | The real strip | None | Strip is short by design |
| Windows 11 tray | Settings list of on/off switches per icon, plus drag icons between tray and overflow ([ghacks](https://www.ghacks.net/2021/11/28/how-to-display-all-system-tray-icons-in-windows-11/), [ElevenForum](https://www.elevenforum.com/t/hide-or-show-icons-in-taskbar-corner-overflow-menu-in-windows-11.415/)) | Two buckets only | Switch per row, or the real tray | Form keys in Settings | Long switch list with no picture of the tray |
| KDE Plasma 6 panel | Edit mode: drag widgets on the real panel, spacers are items; 6.1 redesign keeps the toolbar visible ([Marco Martin](https://notmart.org/blog/2024/05/new-plasma-edit-mode-in-6-1/)) | Spacers act as splits | The real panel in edit mode | Not found | Thin or zero width spacers are invisible and hard to grab ([KDE 478772](https://bugs.kde.org/show_bug.cgi?id=478772), [478773](https://bugs.kde.org/show_bug.cgi?id=478773)) |
| Dash to Panel | Settings list to show, hide and position elements ([GitHub](https://github.com/home-sweet-gnome/dash-to-panel)) | Reorder list not confirmed | List | Not found | Users report missing per item placement ([Reddit thread](https://www.reddit.com/r/gnome/comments/1jsxo07/how_to_adjust_margin_of_items_in_panel/)) |
| Waybar tools | Wabago is a TUI with per section add, remove, reorder ([GitHub](https://github.com/jprando/wabago)); vsWaybar Studio is a live preview editor ([AUR](https://aur.archlinux.org/packages/vswaybar-studio)) | Waybar `group/*` modules, by text | Text or preview | TUI keys | Drag in GUIs not confirmed |
| iOS folders and stacks | Jiggle mode; drop an app on an app makes a folder; drop a widget on a same size widget makes a stack; dragging all out deletes it ([Apple folders](https://support.apple.com/HT200290), [Apple widgets](https://support.apple.com/en-us/ht207122)) | Drop on to join, drag out to split | The real screen | VoiceOver actions | Folders hide contents; nesting not allowed |
| Android Quick Settings | Edit mode: drag tiles; TalkBack gets a "Move tile" action that announces "Move tile X to position Y" ([AOSP mirror](https://android.googlesource.com/platform/frameworks/base/+/7a5e333%5E%21/), [Google](https://support.google.com/accessibility/android/answer/12637487)) | n/a | The real grid | Accessible move action instead of drag | Grid pages |
| Stream Deck | Right click a key, Create Folder; drag an action and hover on a folder to open it and drop inside ([Elgato](https://help.elgato.com/hc/articles/360027957912-Elgato-Stream-Deck-Creating-a-Folder)) | Drag in, drag out | The key grid | None | Hover to open is slow with many folders |
| Chrome tab groups | Tab menu: "Add tab to new group", "Add tab to group", "Remove tab from group"; Ctrl+Left / Right moves a tab or a whole group ([Google](https://support.google.com/chrome/answer/10483214?hl=en)) | Menu, or drag a tab in or out | Colored band and label over the tabs | Full keyboard path | Bands stay readable; tabs shrink |
| Arc | Drag a tab into the window to split; folders in the sidebar; right click "Separate All Tabs" ([Arc help](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once)) | Drag to join, menu to split | Sidebar rows | Not confirmed | n/a |
| Figma | Select layers, Shift+A wraps them in one auto layout frame; Ctrl+G groups ([Figma help](https://help.figma.com/hc/en-us/articles/360040451373)) | Select a range, then wrap; ungroup to split | Frame outline on canvas | Full | Selection of a range scales well |
| Raycast | Favorites reorder with "Move Favorite Up / Down" actions (Cmd+Up / Down) ([manual](https://manual.raycast.com/action-panel)) | n/a | List | Full; shortcut may clash with section jump | Fine, it is a list |

## 3. What makes it feel direct

1. **Edit a picture of the thing.** Every product that feels good (Omarchy bar, Touch Bar, Plasma
   edit mode, Bartender strips, Chrome bands) shows the strip itself. Long forms (Control Center,
   Windows tray, our page) are where people get lost.
2. **The group is a visible band, not a number.** Chrome's colored band over tabs reads at a
   glance; our "pill 3" chip does not.
3. **A split is a place, not a property of an item.** Hidden Bar's one divider and Plasma's spacer
   put the split between items. Our "new pill starts here" switch hangs it on an item, which is
   the same data but harder to think about.
4. **Small targets fail.** Plasma's thin spacers are its most reported pain. A seam must have a hit
   area much wider than its drawn line.
5. **Drag is never the only path.** Chrome (menu plus Ctrl+arrows), Android (accessible move
   action) and Raycast (move up / down actions) all pair drag with a keyboard or menu route.

## 4. Constraints for OmaBar

- Card is about 400 px wide. Parts available: `ButtonGroup`, `ToggleSwitch`, `Dropdown`,
  `PanelToolTip`, `PanelSectionHeader` from Omarchy's `Ui`, plus plain `Rectangle`, `Text`,
  `MouseArea`, `Flow`. There is no context menu part; `PopupCard` is a `PopupWindow` anchored to a
  bar, so menus inside the card should be inline rows, not popups.
- Keys arrive through the panel's `PanelKeyCatcher`: arrows and h j k l move, Space and Enter
  activate, Ctrl+Up / Down asks to reorder (when `reorderable`), x is delete, other letters come
  as `textKey`.
- Every write already exists: `panel.toggleBreak(area, id)`, `panel.setWidgetPillMode(id, mode)`,
  `panel.setCenterParts(on)`, `panel.movePill(area, pill, target)`. Moves run CLI commands under
  `panel.busy`, and `Presets.movePillPlan` already refuses a move that breaks the `centerAnchor`
  rule (FINDINGS.md). No design below changes the store format.
- `Groups.rows()` gives, per widget: `startsPill`, `pill` (0 means no pill), `first`, `repeat`,
  `mode`, `forced`, `forcedBy` (`own`, `none`, `centerPart`). Each design must draw all of them.

## 5. Design A: the mini bar with seams (recommended)

```
 LEFT
 .--------------.  .---.  .------------.
 ( #  @  %  &   )|( W )|(  ~  ^  *  !  )      ( ) = a pill band
 '--------------'  '---'  '------------'      |   = seam, click to split or join
          ^ cursor                            :   = join seam, faint
 CENTER
  [ws1 ws2 ws3]  .---------.                  [ ] = None, dashed outline, no band
                 ( =  CLK  )
                 '---------'
 RIGHT
 .--------------------------------------
 ( a : b : c : d : e : f : g : h : i :     a band that wraps keeps a flat end,
 --------------------------------------.   then continues on the next line
   j : k  )
 ---------'
 -------------------------------------------------------------
  [glyph] Volume                 [ Shared | Own | None ]
  This pill                      [ Left | Center | Right ]
```

One strip per section, wrapping with `Flow`. Each widget is a glyph chip (24 px). Between two
chips is a seam with a 12 px hit area and a 2 px drawn line. Under the three strips sits one
detail row for the selected widget, reusing today's two `ButtonGroup`s (mode and move pill).

**Interactions**
- Click a seam: split there, or join if it is already a split. Hover shows "Split here" or
  "Join" in a `PanelToolTip`.
- Click a chip: select it; the detail row shows its name and its Shared / Own / None and the
  pill's Left / Center / Right. Hover shows the widget's name.
- The band is drawn per chip: a chip paints its piece of the band plus the gap to the next chip
  when the next chip is in the same pill; the first chip of a pill rounds its left end, the last
  rounds its right end. At a wrap the piece just ends flat, so a long pill reads as one band
  across two lines without any line measuring.

**Mapping to the model**
| On screen | Data | Call |
|---|---|---|
| Seam before chip X is a split | `rows[X].startsPill` | `toggleBreak(area, X.id)` |
| No seam before the first chip | `first` | none |
| Locked split seam, lock glyph, tooltip names the reason ("Volume is Own") | `forced` with `forcedBy` own or none | clicking selects the widget that causes it, so the detail row offers Shared |
| Locked split seam with a small "center part" tick | `forcedBy: "centerPart"` | the "Split the center into three pills" switch stays above the strips |
| Disabled seam, tooltip "Same widget appears earlier" | `repeat` | none |
| Chip with its own short band | `mode: "solo"` | `setWidgetPillMode(id, "solo")` |
| Chip with a dashed outline and no band | `mode: "none"`, `pill: 0` | `setWidgetPillMode(id, "none")` |
| Detail row Left / Center / Right | the selected chip's `pill` and area | `movePill(area, pill, target)` |

**Keyboard** (all through the existing key catcher, page owns a cursor like the Widgets page)
- Left / Right (h / l): walk the stops of a section in order: chip, seam, chip, seam.
- Up / Down (k / j): go to the nearest stop in the section above or below, then into the detail
  row's two groups.
- Space or Enter on a seam: split or join. On a chip: select it (detail row follows).
- s, o, n: set the cursor's widget to Shared, Own, None (`textKey`).
- Ctrl+Up / Ctrl+Down: move the cursor's pill to the section above or below (`reorderRequested`,
  turned on with `reorderable` while this page shows).
- The cursor is a visible ring; a seam under the cursor draws at full width so it is easy to see.

**Accessibility.** Every chip and seam gets `Accessible.name` ("Volume", "Seam between Volume
and Battery, joined") and `Accessible.role` button. Seam state never depends on color alone: a
split is a gap plus a line, a lock glyph marks forced splits, None is a dashed outline.

**Effort.** About 2 days. New `panel/GroupStrip.qml` (one section, about 150 lines),
`panel/GroupChip.qml` (chip, band piece, seam, about 100 lines), a slimmer `GroupsPage.qml`
(intro text, center switch, three strips, detail row). `GroupRow.qml` goes; `PillMoveRow.qml`
can be reused in the detail row. `Groups.js` gains one pure helper, `endsPill` per row (the next
row starts a pill, has pill 0, or is the last), with a test in `test/groups-test.js`. Panel.qml
gains a Groups cursor and routes `moveRequested`, `activateRequested`, `textKey` and
`reorderRequested` by page (about 40 lines). No store or write changes.

**Risks**
- Glyph only chips: two widgets with similar or empty glyphs are hard to tell apart (the
  Bartender problem). Mitigation: names on hover and in the detail row; a widget without a glyph
  shows its first two letters.
- Fidelity: `rows()` lists widgets the bar hides (zero size), so the mini bar can show a chip the
  real bar does not draw (`shortcut:` already noted in `Groups.js`). Keep the existing note line.
- Very large sections wrap to three lines at 20 or more widgets; still about one fifth of today's
  height.
- The per chip band piece must line up with `Flow` spacing; keep the gap inside the chip's own
  width so `Flow` spacing is 0.

**Later, phase 2: drag a pill.** A small grip at each band's left end. Press and hold 200 ms or
move 4 px, the same feel as Omarchy's own bar, then drop on another section's strip. Drop targets
dim while `panel.busy` and when the plan would fail; the call is the same `movePill`. Only after
the buttons and keys above work, so drag is never the only path.

## 6. Design B: compact list with seams

```
 LEFT
 .-------------------------------------.
 | [#] Workspaces              Shared v |
 |- - - - - - - - - - - - - - - - - - -|   faint dashed seam: click to split
 | [@] Clock                   Shared v |
 '-------------------------------------'
 ============ split, click to join ======
 .-------------------------------------.
 | [W] Weather                    Own v |  :: grip  Move: L C R
 '-------------------------------------'
```

Keeps names visible, which the strip cannot. Rows shrink to 24 px; the seam between two rows is
an 8 px strip (12 px hit area) that draws as a dashed line when joined and a gap with a solid
label when split. Each pill is a real rounded frame around its rows. Mode is one `Dropdown`
per row instead of three buttons; move pill sits on the frame's first row.

Mapping is the same as A: seam = `toggleBreak`, dropdown = `setWidgetPillMode`, frame row =
`movePill`, forced and repeat seams locked with a tooltip. Keyboard: Up / Down walk rows and
seams, Space toggles a seam or opens the dropdown, s / o / n set mode, Ctrl+Up / Down move the
pill. Effort about 1 day, lowest risk. Downside: still a long column (about 20 x 32 px, around
650 px) and still not a picture of the bar, so it fixes clutter but not "where is this on my bar".

## 7. Design C: select a range, then act

```
 RIGHT   a  b [c  d  e] f  g  h
                  ^ shift click from c to e
 [ Make one pill ]  [ Own each ]  [ No pill ]  [ Move to: L C R ]
```

The Figma and Chrome model: click a chip, Shift+click another in the same section, then press
an action. "Make one pill" ensures a break at the first chip and after the last, and removes the
breaks inside. Needs a new pure `Groups.setRange(breaks, area, rows, from, to)` plus tests;
"Own each" and "No pill" loop `setWidgetPillMode`, which writes the store once per widget, so a
batch write helper would be wanted. Effort about 2 to 3 days. Good for big regroupings, but a
single split takes two clicks plus a button, and it still needs a strip to select from, so it is
best seen as a later add on to A, not a separate page.

## 8. Recommendation

Build **Design A**. It is the only one that shows the bar you are editing, it turns the 18
switches into seams you click where the split actually is (lesson 3), it fits about 20 widgets in
about 230 px of height on a 400 px card, and it is a new view over the same `rows()` data and the
same four panel calls, so the store, `GroupLayout.js` and the painter do not change. It also gives
the page its first keyboard path. Ship the click and key version first, then add the pill grip
drag (phase 2) and, if people ask for it, range select from Design C on the same strip. If time is
short, Design B is a safe one day stopgap but should not be the end state.

Open questions for the owner: should the strip also highlight the matching widget on the real bar
while hovering (nice, but needs the painter to listen to the panel, a new channel); and is a
first two letters fallback acceptable for widgets with no glyph.
