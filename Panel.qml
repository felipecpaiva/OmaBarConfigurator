import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Bar widget picker: one row per widget on the bar, grouped by the section it
// sits in, each with a switch for shown/hidden. A hidden widget keeps its row
// so it can be brought back -- the entry it was spliced out of is saved here
// verbatim first, because `omarchy plugin disable` discards the entry object
// along with every inline setting it carried.
//
// Standalone `kinds: ["panel"]` plugin, the omarchy.wifiqr shape: the host
// injects `shell`, `manifest`, `pluginRegistry` and `barWidgetRegistry`, and
// hands out a scalar-only view of the bar (position, size, font) on
// `shell.bar`. There is no bar anchor to hang a popup off, so the card places
// itself against whichever edge the bar occupies -- the same placement the
// shared KeyboardPanel computes for an anchored one.
//
// Every widget decision -- what is on the bar, what a hide must save, what
// argv puts it back -- lives in Model.js. This file renders and dispatches.
Item {
  id: root

  // ---- host injections ------------------------------------------------
  property string omarchyPath: ""
  property var shell: null
  property var manifest: null
  property var pluginRegistry: null
  property var barWidgetRegistry: null

  // Never set on the panel entry point; declared so a host that does inject a
  // bar is honoured. It is a read-only facade either way -- probe every member
  // before touching it, because assigning to one throws.
  property var bar: null

  readonly property string pluginId: (manifest && manifest.id)
    ? String(manifest.id) : "felipe.bar-picker"

  // ---- bar state ------------------------------------------------------
  readonly property var barState: (shell && shell.bar) ? shell.bar : bar
  readonly property string barPosition: (barState && barState.position)
    ? String(barState.position) : "top"
  readonly property bool barIsHidden: !!(barState && barState.barHidden)
  readonly property int barExtent: barIsHidden
    ? 0 : Math.max(0, (barState && barState.barSize) ? barState.barSize : 0)
  readonly property string fontFamily: (barState && barState.fontFamily)
    ? String(barState.fontFamily) : Style.font.family

  readonly property color foreground: Color.popups.text
  readonly property color dim: Qt.darker(foreground, 1.5)
  readonly property color hoverFill: Style.hoverFillFor(foreground, Color.accent)
  readonly property color selectedFill: Style.selectedFillFor(foreground, Color.accent)

  // ---- config ---------------------------------------------------------
  // `shell.barConfig` is a detached copy of the `bar` object, refreshed by the
  // host whenever the plugin or widget registry changes. Model.js takes a
  // shell-config-shaped value, so wrap it when it arrives unwrapped.
  readonly property var shellConfig: {
    var raw = (shell && shell.barConfig) ? shell.barConfig : ({})
    // The round trip is not paranoia. The host hands `var` properties over as
    // QVariant-backed sequences, and `Array.isArray()` answers FALSE for one
    // of those even though it has a length and indexes fine -- so Model reads
    // every layout section as empty and the panel renders nothing, with no
    // error anywhere. Rebuilding the value here gives Model real arrays.
    var copy = ({})
    try {
      copy = JSON.parse(JSON.stringify(raw))
    } catch (e) {
      console.warn("bar-picker: bar config unreadable:", e)
    }
    return (copy && copy.bar !== undefined) ? copy : ({ bar: copy })
  }

  // Captured entries for everything this panel has hidden, newest last. The
  // whole entry, not the id: the splice destroys the only copy, so an id-only
  // record loses the widget's inline settings (the tray's pins, the clock's
  // format) on the way back.
  property var savedHidden: []
  property bool storeLoaded: false

  function savedRecord(id) {
    var key = String(id || "")
    for (var i = 0; i < savedHidden.length; i++)
      if (savedHidden[i] && String(savedHidden[i].id) === key) return savedHidden[i]
    return null
  }

  function savedSection(id) {
    var record = savedRecord(id)
    return record ? String(record.section || "") : ""
  }

  // A Model that throws must not take the whole panel down with it: a QML
  // exception aborts the rest of its enclosing function and surfaces only as a
  // journal WARN.
  readonly property var catalogue: {
    var cfg = root.shellConfig
    var saved = root.savedHidden
    try {
      var list = Model.barCatalogue(cfg, saved)
      return Array.isArray(list) ? list : []
    } catch (e) {
      console.warn("bar-picker: barCatalogue failed:", e)
      return []
    }
  }

  // The catalogue reports a hidden widget with `region: null` -- it is not in
  // the layout to have one. Its saved record still knows where it came from,
  // so the row goes back under that section header, at the index it will
  // return to, rather than into an orphan group at the bottom.
  readonly property var rows: {
    var rank = ({ left: 0, center: 1, right: 2 })
    var out = []
    for (var i = 0; i < catalogue.length; i++) {
      var entry = catalogue[i]
      var region = entry.region ? String(entry.region) : savedSection(entry.id)
      var index = entry.index
      if (index === null || index === undefined) {
        var record = savedRecord(entry.id)
        index = record ? Number(record.index) : 0
      }
      // Half a step early, so a hidden row sits where it will come BACK --
      // `showArgv` re-inserts it after its old left-hand neighbour, i.e. ahead
      // of whatever slid into its index while it was gone.
      var slot = isFinite(index) ? index : 0
      out.push({
        id: String(entry.id),
        region: region,
        index: entry.visible ? slot : slot - 0.5,
        rank: rank[region] !== undefined ? rank[region] : 3,
        seq: i,
        visible: !!entry.visible,
        isAnchor: entry.isAnchor === true
      })
    }
    out.sort(function(a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.index !== b.index) return a.index - b.index
      return a.seq - b.seq
    })
    return out
  }

  readonly property int shownCount: countVisible(true)
  readonly property int hiddenCount: countVisible(false)

  function countVisible(wanted) {
    var n = 0
    for (var i = 0; i < rows.length; i++)
      if (rows[i].visible === wanted) n++
    return n
  }

  function regionCount(region) {
    var n = 0
    for (var i = 0; i < rows.length; i++)
      if (rows[i].region === region && rows[i].visible) n++
    return n
  }

  readonly property string anchorName: {
    for (var i = 0; i < rows.length; i++)
      if (rows[i].isAnchor) return widgetName(rows[i].id)
    return "None"
  }

  // ---- plugin catalogue -------------------------------------------------
  // `omarchy plugin list --json` is the only place a clone's source id is
  // readable: the third-party registry facade is scoped to this plugin, and
  // shell.json does not carry it. It also names widgets that are currently
  // hidden, which the widget registry no longer holds.
  property var pluginInfo: ({})

  Process {
    id: catalogueProc
    command: ["bash", "-lc", 'exec "$@"', "bash", "omarchy-plugin-list", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.loadPluginInfo(text)
    }
  }

  function loadPluginInfo(raw) {
    var next = ({})
    try {
      var list = JSON.parse(String(raw || "") || "[]")
      for (var i = 0; i < list.length; i++) {
        var plugin = list[i]
        if (!plugin || !plugin.id) continue
        next[String(plugin.id)] = {
          name: String(plugin.name || ""),
          clonedFrom: String(plugin.clonedFrom || "")
        }
      }
    } catch (e) {
      console.warn("bar-picker: plugin list unreadable:", e)
      return
    }
    root.pluginInfo = next
  }

  function refreshPluginInfo() {
    if (!catalogueProc.running) catalogueProc.running = true
  }

  function clonedFrom(id) {
    var info = pluginInfo[String(id || "")]
    return info ? info.clonedFrom : ""
  }

  // ---- naming + glyphs -------------------------------------------------
  readonly property var glyphById: ({
    "omarchy.menu": "",
    "omarchy.workspaces": "󰎠",
    "omarchy.active-window": "󰘔",
    "omarchy.keyboard-layout": "󰌓",
    "omarchy.spacer": "󰓡",
    "omarchy.indicators": "󰇘",
    "omarchy.tray": "󰀻",
    "omarchy.system-update": "󰚰",
    "omarchy.clock": "󰥔",
    "omarchy.weather": "󰖐",
    "omarchy.audio": "󰕾",
    "omarchy.microphone": "󰍬",
    "omarchy.media": "󰝚",
    "omarchy.network": "󰤨",
    "omarchy.bluetooth": "󰂯",
    "omarchy.tailscale": "󰖂",
    "omarchy.monitor": "󰍹",
    "omarchy.power": "󰁹",
    "omarchy.agents": "󱚣",
    "omarchy.dropbox": "",
    "omarchy.notification-center": "󰂚",
    "omarchy.notifications": "󰂚"
  })

  readonly property var glyphByCategory: ({
    "Compositor": "󰘔",
    "Status": "󰀻",
    "Audio": "󰕾",
    "Network": "󰤨",
    "System": "󰒓",
    "Time": "󰥔",
    "Layout": "󰓡",
    "Media": "󰝚",
    "Info": "󰌕",
    "Files": "󰈔",
    "AI": "󱚣"
  })

  function widgetMeta(id) {
    if (!barWidgetRegistry || typeof barWidgetRegistry.metadataFor !== "function") return null
    return barWidgetRegistry.metadataFor(String(id || ""))
  }

  // A clone keeps the source widget's suffix ("felipe.tray",
  // "google-calendar.clock"), so falling back to the omarchy id of the same
  // name lands a clone on its original's glyph.
  function siblingId(id) {
    var parts = String(id || "").split(".")
    return parts.length > 1 ? "omarchy." + parts[parts.length - 1] : ""
  }

  function widgetGlyph(id) {
    var key = String(id || "")
    if (glyphById[key] !== undefined) return glyphById[key]
    var source = clonedFrom(key) || siblingId(key)
    if (source !== "" && glyphById[source] !== undefined) return glyphById[source]
    var meta = widgetMeta(key)
    var category = meta && meta.category ? String(meta.category) : ""
    if (glyphByCategory[category] !== undefined) return glyphByCategory[category]
    return "󰐱"
  }

  // The Omarchy mark is not in the icon font -- it is the "omarchy" family's
  // own private-use codepoint, drawn the way the bar's menu button draws it.
  function widgetGlyphFamily(id) {
    var key = String(id || "")
    return (key === "omarchy.menu" || siblingId(key) === "omarchy.menu")
      ? "omarchy" : root.fontFamily
  }

  function widgetName(id) {
    var key = String(id || "")
    var info = pluginInfo[key]
    if (info && info.name) return info.name
    var meta = widgetMeta(key)
    if (meta && meta.displayName) return String(meta.displayName)
    // Last resort, for an id the catalogue has never heard of:
    // "omarchy.keyboard-layout" -> "Keyboard layout".
    var tail = key.split(".").pop().replace(/[-_]/g, " ")
    if (tail === "") return key
    return tail.charAt(0).toUpperCase() + tail.slice(1)
  }

  function regionLabel(region) {
    return region === "" ? "HIDDEN" : String(region).toUpperCase()
  }

  // ---- lifecycle -------------------------------------------------------
  property bool opened: false
  property int cursorIndex: 0
  property bool cursorActive: false

  function open(payloadJson) {
    // No payload keys are defined yet; parse anyway so a caller passing one
    // cannot throw its way past the rest of this function.
    try { JSON.parse(payloadJson || "{}") } catch (e) {}
    store.reload()
    refreshPluginInfo()
    root.cursorActive = false
    root.cursorIndex = 0
    root.opened = true
    setCenterHoverRevealSuppressed(true)
    // The surface is not mapped yet when open() runs, so a `focus: true`
    // inside it has nothing to attach to.
    Qt.callLater(function() { if (root.opened) keyCatcher.forceActiveFocus() })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    root.opened = false
  }

  // Esc / outside click. Routed through the host so its open-panel set stays
  // consistent and `shell toggle` works on the next call.
  function dismiss() {
    if (shell && typeof shell.hide === "function") shell.hide(root.pluginId)
    else close()
  }

  // Summoning by hotkey moves no pointer, so a hover the bar was still holding
  // must not keep the center indicators revealed behind the panel. The panel
  // facade is scalar-only, so this is a no-op there -- probe, never assign
  // blind: writing to a facade property throws.
  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && typeof root.bar.setCenterHoverRevealSuppressed === "function")
      root.bar.setCenterHoverRevealSuppressed(value)
  }

  // ---- hidden-entry store ---------------------------------------------
  // Its own file, never shell.json: every bar mutation goes out as argv so the
  // CLI stays the only writer of the shell config.
  readonly property string storePath:
    Quickshell.env("HOME") + "/.config/omarchy/bar-picker.json"

  FileView {
    id: store
    path: root.storePath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadStore(text())
    // First run: no file yet. Without this branch the store never reports
    // loaded and the first hide would have nowhere to record its entry.
    onLoadFailed: root.loadStore("")
  }

  function loadStore(raw) {
    var next = []
    try {
      var parsed = JSON.parse(String(raw || "") || "{}")
      if (parsed && Array.isArray(parsed.hidden)) next = parsed.hidden
    } catch (e) {
      console.warn("bar-picker: hidden store unreadable, starting empty:", e)
    }
    root.savedHidden = next
    root.storeLoaded = true
  }

  function persistStore() {
    store.setText(JSON.stringify({ version: 1, hidden: root.savedHidden }, null, 2) + "\n")
  }

  Component.onCompleted: {
    store.reload()
    refreshPluginInfo()
  }

  // ---- sequential command runner ---------------------------------------
  // Model hands back an ORDERED list of argv vectors and they are not
  // independent: `bar set` fails if it lands before the `plugin enable` that
  // creates the slot, and a clone's source disable has to follow the clone's.
  // execDetached is fire-and-forget, so each step waits on the previous exit.
  //
  // `exec "$@"` keeps every argument literal while still going through a login
  // shell, which is what puts omarchy's bin on PATH.
  property var pending: []
  readonly property bool busy: runner.running || pending.length > 0

  Process {
    id: runner
    onExited: function(exitCode) {
      if (exitCode !== 0)
        console.warn("bar-picker: command failed (" + exitCode + "):",
                     JSON.stringify(runner.command))
      root.stepQueue()
    }
  }

  function runSequence(sequence) {
    if (!Array.isArray(sequence) || sequence.length === 0) return
    root.pending = root.pending.concat(sequence)
    stepQueue()
  }

  function stepQueue() {
    if (runner.running) return
    if (root.pending.length === 0) {
      // Widget names and clone sources change with what is enabled.
      refreshPluginInfo()
      return
    }
    var next = root.pending[0]
    root.pending = root.pending.slice(1)
    runner.command = ["bash", "-lc", 'exec "$@"', "bash"].concat(next)
    runner.running = true
  }

  // ---- actions ---------------------------------------------------------
  function rowAt(index) {
    return (index >= 0 && index < rows.length) ? rows[index] : null
  }

  // Hiding the widget the centre section is pinned to un-pins the section, and
  // no CLI verb writes bar.centerAnchor, so there is no safe way to re-point
  // it from here. The anchor row stays on.
  function isLocked(row) {
    if (!row || !row.visible) return false
    try {
      return Model.isCenterAnchor(root.shellConfig, row.id)
    } catch (e) {
      console.warn("bar-picker: isCenterAnchor failed:", e)
      return row.isAnchor === true
    }
  }

  function toggleAt(index) {
    var row = rowAt(index)
    if (!row || !root.storeLoaded || root.busy) return
    if (row.visible) hideWidget(row)
    else showWidget(row)
  }

  function hideWidget(row) {
    if (isLocked(row)) return
    var captured = null
    var sequence = null
    try {
      captured = Model.captureEntry(root.shellConfig, row.id)
      sequence = Model.hideSequence(row.id, root.clonedFrom(row.id))
    } catch (e) {
      console.warn("bar-picker: hide of", row.id, "failed:", e)
      return
    }
    if (!captured || !sequence || sequence.length === 0) {
      console.warn("bar-picker: nothing to capture for", row.id, "- refusing to hide")
      return
    }
    // Recorded before the commands run: the splice destroys the only copy of
    // the entry, so a hide that runs first and records second loses the
    // widget's settings for good.
    var next = []
    for (var i = 0; i < root.savedHidden.length; i++)
      if (String(root.savedHidden[i].id) !== row.id) next.push(root.savedHidden[i])
    next.push(captured)
    root.savedHidden = next
    persistStore()
    runSequence(sequence)
  }

  function showWidget(row) {
    var saved = savedRecord(row.id)
    var sequence = null
    try {
      sequence = Model.showSequence(saved, root.shellConfig)
    } catch (e) {
      console.warn("bar-picker: restore of", row.id, "failed:", e)
      return
    }
    if (!sequence || sequence.length === 0) {
      console.warn("bar-picker: no restore commands for", row.id)
      return
    }
    runSequence(sequence)
    var next = []
    for (var i = 0; i < root.savedHidden.length; i++)
      if (String(root.savedHidden[i].id) !== row.id) next.push(root.savedHidden[i])
    root.savedHidden = next
    persistStore()
  }

  // One pass over the hidden rows. Each show is appended to the same queue, so
  // they still apply one at a time and in order.
  function restoreAll() {
    if (root.busy) return
    var hidden = []
    for (var i = 0; i < rows.length; i++) if (!rows[i].visible) hidden.push(rows[i])
    for (var h = 0; h < hidden.length; h++) showWidget(hidden[h])
  }

  // ---- keyboard cursor -------------------------------------------------
  function moveCursor(delta) {
    if (rows.length === 0) return
    if (!root.cursorActive) {
      root.cursorActive = true
      if (delta >= 0) return
    }
    root.cursorIndex = Math.max(0, Math.min(rows.length - 1, root.cursorIndex + delta))
  }

  // ---- window ----------------------------------------------------------
  readonly property int gap: Style.gapsOut
  readonly property int margin: Style.gapsOut

  PanelWindow {
    id: win

    visible: root.opened || card.opacity > 0
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore

    WlrLayershell.namespace: "omarchy-bar-picker"
    WlrLayershell.layer: WlrLayer.Overlay
    // Focus follows the logical state, not `visible`: the surface stays mapped
    // through the fade so there is something to animate, but keyboard and
    // pointer ownership release the moment the panel closes.
    WlrLayershell.keyboardFocus: root.opened
      ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None

    anchors { top: true; bottom: true; left: true; right: true }

    readonly property bool horizontalBar: root.barPosition === "top" || root.barPosition === "bottom"
    readonly property int availableWidth: Math.max(Style.space(240),
      win.width - (win.horizontalBar ? root.margin * 2 : root.barExtent + root.gap + root.margin))
    readonly property int availableHeight: Math.max(Style.space(200),
      win.height - (win.horizontalBar ? root.barExtent + root.gap + root.margin : root.margin * 2))

    // Everything outside the card dismisses.
    MouseArea {
      anchors.fill: parent
      enabled: root.opened
      acceptedButtons: Qt.AllButtons
      onClicked: root.dismiss()
    }

    BorderSurface {
      id: card

      readonly property int verticalInset: card.contentTopInset + card.contentBottomInset

      width: Math.min(Style.space(400), win.availableWidth)
      height: Math.round(Math.min(content.implicitHeight + verticalInset, win.availableHeight))

      // Along the bar the card centres; away from it, it clears the bar edge by
      // one gap. Both axes swap when the bar is vertical.
      x: {
        if (root.barPosition === "left") return root.barExtent + root.gap
        if (root.barPosition === "right") return Math.round(win.width - root.barExtent - root.gap - width)
        return Math.round(win.width / 2 - width / 2)
      }
      y: {
        if (root.barPosition === "bottom") return Math.round(win.height - root.barExtent - root.gap - height)
        if (root.barPosition === "top") return root.barExtent + root.gap
        return Math.round(win.height / 2 - height / 2)
      }

      color: Color.popups.background
      borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Math.max(1, Style.space(2)))
      padding: Style.spacing.popupPadding
      radius: Style.cornerRadius
      opacity: root.opened ? 1.0 : 0

      Behavior on opacity {
        NumberAnimation { duration: 140; easing.type: Easing.OutCubic }
      }

      // Swallow clicks on the card so they never reach the dismissal area.
      MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.AllButtons
      }

      PanelKeyCatcher {
        id: keyCatcher
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset

        onMoveRequested: function(dx, dy) { if (dy !== 0) root.moveCursor(dy) }
        onActivateRequested: if (root.cursorActive) root.toggleAt(root.cursorIndex)
        onCloseRequested: root.dismiss()
        onTextKey: function(t) { if (t === "u" || t === "U") root.restoreAll() }

      Column {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(12)

        // Everything above the list. Its height is independent of the list's,
        // which is what lets the list cap itself against the space left over
        // without the two forming a binding loop.
        Column {
          id: headBlock
          width: parent.width
          spacing: Style.space(12)

          PanelHero {
            title: "Bar widgets"
            meta: root.busy
              ? "APPLYING CHANGES"
              : (root.shownCount + " shown, " + root.hiddenCount + " hidden")
            detail: root.barPosition
            foreground: root.foreground
            fontFamily: root.fontFamily

            iconComponent: Component {
              Text {
                textFormat: Text.PlainText
                text: "󱍕"
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
              }
            }

            trailingControl: Component {
              PanelActionButton {
                visible: root.hiddenCount > 0
                enabled: !root.busy
                iconText: "󰈈"
                tooltipText: "Show every hidden widget"
                foreground: root.foreground
                fontFamily: root.fontFamily
                onClicked: root.restoreAll()
              }
            }
          }

          GridLayout {
            width: parent.width
            columns: 4
            columnSpacing: Style.space(20)
            rowSpacing: Style.spacing.labelGap

            InfoLabel { text: "Left" }
            InfoValue { text: root.regionCount("left") }
            InfoLabel { text: "Center" }
            InfoValue { text: root.regionCount("center") }

            InfoLabel { text: "Right" }
            InfoValue { text: root.regionCount("right") }
            InfoLabel { text: "Hidden" }
            InfoValue {
              text: root.hiddenCount
              color: root.hiddenCount > 0 ? root.foreground : root.dim
            }

            InfoLabel { text: "Center anchor" }
            InfoValue {
              Layout.columnSpan: 3
              text: root.anchorName
            }
          }

          PanelSeparator { foreground: root.foreground }
        }

        // One flat list across all three sections: the section header rides on
        // the first row of each region, the way the network panel heads its
        // known / other groups. ListView rather than a Repeater so
        // positionViewAtIndex keeps the keyboard cursor on screen once the
        // list outgrows the card.
        ListView {
          id: widgetList
          width: parent.width
          // Two caps. The screen one is the hard limit; the 420 keeps a bar
          // with a lot of widgets from growing a card the height of the
          // display -- past that the list scrolls, which is what the partial
          // row at the bottom edge is telling you.
          height: Math.min(contentHeight, Style.space(420), Math.max(Style.space(120),
            win.availableHeight - card.verticalInset - headBlock.implicitHeight - content.spacing))
          spacing: Style.space(2)
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          interactive: contentHeight > height

          ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

          model: root.rows
          currentIndex: root.cursorIndex
          onCurrentIndexChanged: if (currentIndex >= 0) positionViewAtIndex(currentIndex, ListView.Contain)

          // The delegate context does not reach into a nested `component`
          // declaration, so the wrapper takes the required props and hands
          // them down explicitly.
          delegate: Item {
            required property var modelData
            required property int index

            readonly property string sectionTitle: {
              if (index === 0) return root.regionLabel(modelData.region)
              var prev = root.rows[index - 1]
              return (prev && prev.region === modelData.region)
                ? "" : root.regionLabel(modelData.region)
            }

            width: ListView.view.width
            height: delegateColumn.implicitHeight

            Column {
              id: delegateColumn
              width: parent.width
              spacing: Style.space(4)

              PanelSectionHeader {
                visible: sectionTitle !== ""
                // The base topPadding protects the Nerd Font overshoot from the
                // list's clip; the rest is the gap between one section and the
                // last row of the previous one.
                topPadding: Math.ceil(fontSize * 0.15) + (index === 0 ? 0 : Style.space(8))
                height: visible ? implicitHeight : 0
                text: sectionTitle
                foreground: root.foreground
                fontFamily: root.fontFamily
              }

              WidgetRow {
                width: parent.width
                row: modelData
                rowIndex: parent.parent.index
              }
            }
          }
        }
      }
      }
    }
  }

  // One widget on the bar. Glyph, name, and a switch the row itself owns --
  // the switch is presentation, so the whole row is a single target for the
  // mouse and the keyboard cursor alike.
  component WidgetRow: CursorSurface {
    id: widgetRow
    required property var row
    required property int rowIndex

    readonly property bool shown: row.visible
    readonly property bool locked: root.isLocked(row)
    readonly property string subLabel: locked ? "Center anchor" : (shown ? "" : "Hidden")

    hasCursor: root.cursorActive && root.cursorIndex === rowIndex
    foreground: root.foreground
    fill: root.hoverFill
    currentFill: root.selectedFill
    implicitHeight: rowBody.implicitHeight
    opacity: root.busy ? 0.6 : 1.0

    MouseArea {
      id: rowMouse
      anchors.fill: parent
      hoverEnabled: true
      acceptedButtons: Qt.LeftButton
      cursorShape: widgetRow.locked ? Qt.ArrowCursor : Qt.PointingHandCursor

      // Entering moves the cursor here; leaving does not clear it, so j/k
      // picks up from wherever the mouse last was.
      onContainsMouseChanged: if (containsMouse) {
        root.cursorActive = true
        root.cursorIndex = widgetRow.rowIndex
      }
      onClicked: root.toggleAt(widgetRow.rowIndex)
    }

    PanelToolTip {
      visible: widgetRow.locked && rowMouse.containsMouse
      text: "The centre section is pinned to this widget"
      fontFamily: root.fontFamily
    }

    Item {
      id: rowBody
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.leftMargin: Style.space(10)
      anchors.rightMargin: Style.space(10)
      implicitHeight: Math.max(rowGlyph.height, rowLabels.implicitHeight, rowSwitch.implicitHeight)
        + Style.spacing.rowPaddingX

      OpticalGlyph {
        id: rowGlyph
        width: Style.space(22)
        height: Style.space(22)
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: root.widgetGlyph(widgetRow.row.id)
        fontFamily: root.widgetGlyphFamily(widgetRow.row.id)
        fontSize: Style.font.title
        color: widgetRow.shown ? root.foreground : root.dim
      }

      ToggleSwitch {
        id: rowSwitch
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        checked: widgetRow.shown
        // The row owns the click, so the switch is presentation only.
        interactive: false
        cursorRing: false
        opacity: widgetRow.locked ? 0.45 : 1.0
        foreground: root.foreground
      }

      Column {
        id: rowLabels
        spacing: Style.space(1)
        anchors.left: rowGlyph.right
        anchors.leftMargin: Style.space(10)
        anchors.right: rowSwitch.left
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter

        Text {
          textFormat: Text.PlainText
          width: parent.width
          text: root.widgetName(widgetRow.row.id)
          color: widgetRow.shown ? root.foreground : root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          elide: Text.ElideRight
        }

        Text {
          textFormat: Text.PlainText
          visible: widgetRow.subLabel !== ""
          height: visible ? implicitHeight : 0
          width: parent.width
          text: widgetRow.subLabel
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          elide: Text.ElideRight
        }
      }
    }
  }

  component InfoLabel: Text {
    textFormat: Text.PlainText
    color: root.foreground
    opacity: 0.6
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  component InfoValue: Text {
    textFormat: Text.PlainText
    Layout.fillWidth: true
    horizontalAlignment: Text.AlignRight
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
    elide: Text.ElideRight
  }
}
