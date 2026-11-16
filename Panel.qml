import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Model.js" as Model
import "lib/PillStyle.js" as PillStyle
import "lib/Groups.js" as Groups
import "lib/Presets.js" as Presets
import "lib/PresetTargets.js" as PresetTargets
import "panel"

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
    ? String(manifest.id) : "io.github.felipecpaiva.omabarconfigurator"

  // ---- bar state ------------------------------------------------------
  readonly property var barState: (shell && shell.bar) ? shell.bar : bar
  readonly property string barPosition: (barState && barState.position)
    ? String(barState.position) : "top"
  readonly property bool barIsHidden: !!(barState && barState.barHidden)
  readonly property int barExtent: barIsHidden
    ? 0 : Math.max(0, (barState && barState.barSize) ? barState.barSize : 0)
  readonly property string fontFamily: (barState && barState.fontFamily)
    ? String(barState.fontFamily) : Style.font.family

  readonly property color foreground: Commons.Color.popups.text
  readonly property color dim: Qt.darker(foreground, 1.5)
  readonly property color hoverFill: Style.hoverFillFor(foreground, Commons.Color.accent)
  readonly property color selectedFill: Style.selectedFillFor(foreground, Commons.Color.accent)

  // The header's transparency switch is a view of bar.background ("none" means
  // clear), so it agrees with the Bar topic; `omarchy bar background` drops the
  // old bar.transparent key.
  readonly property bool barTransparent: root.barBackground === "none"

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
      console.warn("oma-bar-configurator: bar config unreadable:", e)
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
      console.warn("oma-bar-configurator: barCatalogue failed:", e)
      return []
    }
  }

  // The catalogue reports a hidden widget with `region: null` -- it is not in
  // the layout to have one. Its saved record still knows where it came from,
  // so the row goes back under that section header, at the index it will
  // return to, rather than into an orphan group at the bottom.
  readonly property var rows: {
    var rank = ({ left: 0, centerBegin: 1, center: 2, centerEnd: 3, right: 4 })
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
        rank: rank[region] !== undefined ? rank[region] : 5,
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
    // The section header rides on the first row of each region.
    for (var j = 0; j < out.length; j++)
      out[j].title = (j === 0 || out[j - 1].region !== out[j].region) ? regionLabel(out[j].region) : ""
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

  // The widget the centre section is pinned to. The stat grid already counts
  // what is where, so the eyebrow carries the one piece of bar state nothing
  // else on the card shows -- and it is what the ANCHOR row further down is
  // referring to.
  readonly property string anchorName: {
    for (var i = 0; i < rows.length; i++)
      if (rows[i].visible && root.isLocked(rows[i])) return root.widgetName(rows[i].id)
    return ""
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
      console.warn("oma-bar-configurator: plugin list unreadable:", e)
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

  // ---- bar geometry -----------------------------------------------------
  // A widget can be on the bar and paint nothing, and the two are impossible
  // to tell apart from the layout alone. `bluetooth/Panel.qml:500` is
  // `visible: adapter !== null`, so a soft-blocked radio leaves a perfectly
  // intact bar entry drawing zero pixels -- which reads as a restore that
  // failed, and cost a debugging cycle saying so. `felipe.tray` is width 0
  // today for the same class of reason.
  //
  // This is NOT readable in-process. A third-party plugin's `shell.bar` is
  // `services/PluginBarStateApi.qml` -- four scalars, no methods (assigned at
  // `shell.qml:593`). `debugBarGeometry()` lives on the real Bar
  // (`plugins/bar/Bar.qml:361`), which the facade deliberately never retains,
  // and `shell.serviceFor` is scoped to this plugin's own ids. So it goes out
  // over the same IPC the CLI uses, async, like every other command here.
  property var notDrawingIds: ({})

  Process {
    id: geometryProc
    command: ["bash", "-lc", 'exec "$@"', "bash", "omarchy-shell", "shell", "debugBarGeometry"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.loadGeometry(text)
    }
  }

  function loadGeometry(raw) {
    var next = ({})
    try {
      var list = JSON.parse(String(raw || "") || "[]")
      for (var i = 0; i < list.length; i++) {
        var slot = list[i]
        if (!slot || !slot.id) continue
        // Only a slot that reported itself and reported no size is known to be
        // blank. An id ABSENT from the list has no slot yet, which is not the
        // same claim -- marking it would be the guess this must not make.
        next[String(slot.id)] = slot.visible !== true
      }
    } catch (e) {
      console.warn("oma-bar-configurator: bar geometry unreadable:", e)
      return
    }
    root.notDrawingIds = next
  }

  function refreshGeometry() {
    if (!geometryProc.running) geometryProc.running = true
  }

  // The bar re-lays out after the CLI has written, and the write is only
  // guaranteed flushed at process exit -- so a read taken the instant the
  // queue drains still describes the old bar. One late re-read settles it,
  // which matters most here: a stale "Not drawing" on a widget that just came
  // back is the exact confusion this marker exists to remove.
  Timer {
    id: geometrySettle
    interval: 600
    onTriggered: root.refreshGeometry()
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
    "omarchy.notifications": "󰂚",
    // Plugin manifests carry no icon, so known third-party widgets are listed here.
    "omarchy.elsewhen": "󱉊",
    "io.github.jcarcinogen.gaming-console": "󰊗",
    "io.github.felipecpaiva.omagnet": "󰍇",
    "esemczak.theme-modes": "󰔎",
    "tornikegomareli.spaces": "󰕰"
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
    return root.fallbackGlyph
  }
  // A widget with only this glyph shows the first letters of its name instead.
  readonly property string fallbackGlyph: "󰐱"
  function widgetLetters(id) { return Model.letters(widgetName(id)) }

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
    if (region === "centerBegin") return "CENTER, BEFORE CLOCK"
    if (region === "centerEnd") return "CENTER, AFTER CLOCK"
    return region === "" ? "HIDDEN" : String(region).toUpperCase()
  }

  // ---- lifecycle -------------------------------------------------------
  property bool opened: false
  property int cursorIndex: 0
  property bool cursorActive: false
  // Widget list scroll position, kept here so it survives the list's rebuilds
  // and the page being reloaded. Emitted before a toggle so the page records it.
  property real widgetKeepY: 0
  signal toggleStarting()

  function open(payloadJson) {
    // Payload key `topic` opens on that topic id (for example "groups"); unknown ids are ignored.
    var payload = {}
    try { payload = JSON.parse(payloadJson || "{}") || {} } catch (e) {}
    root.layoutError = ""
    checkUnfinished()
    store.reload()
    refreshLive()
    refreshPluginInfo()
    refreshGeometry()
    root.cursorActive = false
    root.cursorIndex = 0
    root.widgetKeepY = 0
    root.groupCursorAt = -1
    root.groupSelected = null
    for (var i = 0; i < root.categories.length; i++)
      if (root.categories[i].id === payload.topic) root.categoryId = String(payload.topic)
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
    Quickshell.env("HOME") + "/.config/omarchy/oma-bar-configurator.json"

  FileView {
    id: store
    path: root.storePath
    watchChanges: true
    atomicWrites: true
    blockWrites: true // tiny file: the write finishes before the watch reload can read it
    printErrors: false
    onLoaded: root.loadStore(text())
    onFileChanged: reload()
    // Show what is really on disk, not the text we failed to write.
    onSaveFailed: function(error) {
      console.warn("oma-bar-configurator: saving the store failed:", error)
      reload()
    }
    // First run: no file yet. Without this branch the store never reports
    // loaded and the first hide would have nowhere to record its entry.
    onLoadFailed: root.loadStore("")
  }

  // Last raw store text: persistStore merges onto it so a hidden-list write
  // never drops the style, the groups or any key a newer version added.
  property string lastRawText: ""

  function loadStore(raw) {
    // Our own setText comes back through the watch with the text we already
    // hold; skipping it keeps a write from rebuilding the list a second time.
    if (root.storeLoaded && String(raw || "") === root.lastRawText) return
    root.lastRawText = String(raw || "")
    var parsed = PillStyle.readStore(root.lastRawText)
    for (var i = 0; i < parsed.warnings.length; i++)
      console.warn("oma-bar-configurator:", parsed.warnings[i])
    root.savedHidden = parsed.hidden
    root.storeLoaded = true
    checkUnfinished()
  }

  function persistStore() {
    persistPatch({ hidden: root.savedHidden })
  }

  function persistPatch(patch) {
    commitText(PillStyle.writeStore(root.lastRawText, patch))
  }

  function commitText(text) {
    root.lastRawText = text
    store.setText(text)
  }

  // ---- settings API (the pages under panel/ code against these) --------
  readonly property var storeData: PillStyle.readStore(root.lastRawText)

  // Refused before the store has loaded: merging onto an empty text would
  // write a file without the hidden list. Only the keys in `patch` reach the
  // file; defaults stay in PillStyle.DEFAULTS.
  function writeStyle(patch) {
    if (!root.storeLoaded || !patch) return
    commitText(PillStyle.patchStore(root.lastRawText, "style", patch))
  }

  function writeBreaks(area, ids) {
    var areas = ["left", "center", "right"]
    if (!root.storeLoaded || areas.indexOf(String(area)) < 0) return
    // Copied element by element: a host array fails Array.isArray (FINDINGS.md).
    var copy = []
    for (var j = 0; j < (ids || []).length; j++) copy.push(String(ids[j]))
    var breaks = ({})
    breaks[String(area)] = copy
    commitText(PillStyle.patchStore(root.lastRawText, "groups", { breaks: breaks }))
  }

  function toggleBreak(area, id) {
    var result = Groups.toggleBreak(root.storeData.groups.breaks, String(area), String(id))
    writeBreaks(area, result[String(area)])
  }

  // Own / None / Shared for one widget (the solo and noPill lists), and the three-pill center.
  function setWidgetPillMode(id, mode) {
    if (!root.storeLoaded || root.busy) return
    var g = Groups.setMode(root.storeData.groups, String(id), String(mode))
    var copy = function(list) { var out = []; for (var i = 0; i < (list || []).length; i++) out.push(String(list[i])); return out }
    commitText(PillStyle.patchStore(root.lastRawText, "groups", { solo: copy(g.solo), noPill: copy(g.noPill) }))
  }

  function setCenterParts(on) {
    if (!root.storeLoaded || root.busy) return
    commitText(PillStyle.patchStore(root.lastRawText, "groups", { centerParts: on === true }))
  }

  // ---- Groups page: rows, cursor and selection (logic in lib/Groups.js) ----
  // Lives here, not in the page, so keys work and a pill move keeps the selection.
  readonly property var groupRows: {
    var g = root.storeData.groups
    return Groups.rows(root.liveLayout, g.breaks, Model.SELF_ID, { solo: g.solo, noPill: g.noPill, centerParts: !!g.centerParts })
  }
  readonly property var groupStops: Groups.stops(root.groupRows)
  readonly property bool onGroupsPage: currentGroup.page === "GroupsPage"
  // Index into groupStops, or -1 before the first key press.
  property int groupCursorAt: -1
  // The cursor stop ({ area, kind, index }) while the keyboard drives the page, else null.
  readonly property var groupCursor: root.groupCursorAt >= 0 && root.groupCursorAt < root.groupStops.length
    ? root.groupStops[root.groupCursorAt] : null
  // The widget the detail row shows: { area, index, id }, or null.
  property var groupSelected: null

  function selectGroupChip(area, index) {
    var r = root.groupRows[String(area)][index]
    if (!r) return
    root.groupSelected = { area: String(area), index: index, id: r.id }
    for (var i = 0; i < root.groupStops.length; i++) {
      var s = root.groupStops[i]
      if (s.area === String(area) && s.kind === "chip" && s.index === index) { root.groupCursorAt = i; break }
    }
  }

  // A split or join seam toggles; a locked seam selects the widget whose setting
  // forces it, so the detail row offers the way out.
  function clickGroupSeam(area, index) {
    if (root.busy) return
    var list = root.groupRows[String(area)]
    var seam = Groups.seam(list, index)
    if (seam.state === "split" || seam.state === "join") toggleBreak(String(area), list[index].id)
    else if (seam.cause >= 0) selectGroupChip(area, seam.cause)
  }

  function moveGroupCursor(dx, dy) {
    root.groupCursorAt = Groups.step(root.groupStops, root.groupCursorAt, dx, dy)
    var s = root.groupCursor
    if (s && s.kind === "chip") selectGroupChip(s.area, s.index)
  }

  function activateGroupCursor() {
    var s = root.groupCursor
    if (!s) return
    if (s.kind === "seam") clickGroupSeam(s.area, s.index)
    else selectGroupChip(s.area, s.index)
  }

  // s / o / n on the selected widget. Nothing on a seam.
  function groupModeKey(t) {
    var mode = ({ s: "shared", o: "solo", n: "none" })[String(t).toLowerCase()]
    var s = root.groupCursor, sel = root.groupSelected
    if (!mode || !sel || (s && s.kind !== "chip")) return
    setWidgetPillMode(sel.id, mode)
  }

  // Ctrl+Up / Down: the selected widget's pill to the section above or below. Nothing for a None widget.
  function moveSelectedPill(dy) {
    var sel = root.groupSelected
    var r = sel ? root.groupRows[sel.area][sel.index] : null
    if (!r || r.pill === 0) return
    var order = ["left", "center", "right"]
    var to = order.indexOf(sel.area) + (dy > 0 ? 1 : -1)
    if (to < 0 || to >= order.length) return
    movePill(sel.area, r.pill, order[to])
  }

  // After any change the selection follows its widget, and the cursor follows the selection.
  onGroupRowsChanged: {
    var sel = root.groupSelected
    if (!sel) { if (root.groupCursorAt >= root.groupStops.length) root.groupCursorAt = root.groupStops.length - 1; return }
    var at = Groups.locate(root.groupRows, sel.area, sel.id)
    if (!at) { root.groupSelected = null; root.groupCursorAt = -1; return }
    var keyboard = root.groupCursorAt >= 0
    selectGroupChip(at.area, at.index)
    if (!keyboard) root.groupCursorAt = -1
  }

  // ---- layout API (presets, move pill, undo; logic lives in lib/Presets.js) --
  readonly property bool canUndo: root.storeData.undo !== null
  readonly property string undoLabel: root.canUndo ? root.storeData.undo.label : ""
  readonly property string undoAt: root.canUndo ? root.storeData.undo.at : ""
  // The last refusal or failed command, in plain words; cleared by the next run,
  // on open and on a topic switch.
  property string layoutError: ""
  // True while a layout run is in flight. When it ends with no failed step,
  // the bar is checked against layoutWant; afterLayout runs only on a match.
  property bool layoutRun: false
  property var afterLayout: null
  property var layoutWant: null
  property string layoutMismatch: ""

  // Closing the panel unloads it (shell.qml Loader `active`), which ends a run
  // between two moves. The undo record says `running` until the run ends, so
  // the next open can say so; Undo stays available.
  function checkUnfinished() {
    if (root.layoutRun || root.busy) return
    var u = root.storeData.undo
    if (u && u.running) root.layoutError = "The last change did not finish. Use Undo in Layout to go back."
  }

  // Widgets that count as "the workspaces widget" for presets: the stock one,
  // a clone of it, or a compositor widget whose own name or description says
  // workspace (tornikegomareli.spaces: "Workspace switcher ...").
  function isWorkspacesWidget(id) {
    var key = String(id || "")
    if (key === "omarchy.workspaces" || root.clonedFrom(key) === "omarchy.workspaces") return true
    var meta = root.widgetMeta(key)
    if (!meta || String(meta.category || "") !== "Compositor") return false
    return /\bworkspaces?\b/i.test(String(meta.displayName || "") + " " + String(meta.description || ""))
  }

  function layoutRoles() {
    var found = []
    var ids = []
    var keys = ["left", "centerBegin", "center", "centerEnd", "right"]
    for (var k = 0; k < keys.length; k++) {
      var list = root.liveLayout[keys[k]] || []
      for (var i = 0; i < list.length; i++) {
        var e = list[i]
        var id = typeof e === "string" ? e : (e && e.id !== undefined ? String(e.id) : "")
        if (id === "" || ids.indexOf(id) >= 0) continue
        ids.push(id)
        if (root.isWorkspacesWidget(id)) found.push(id)
      }
    }
    // The resolved anchor, the one the rest of the panel shows and locks.
    var anchor = Model.centerAnchorId({ bar: root.liveBar })
    var clocks = anchor !== "" ? [anchor] : ids.filter(function(x) {
      return root.clonedFrom(x) === "omarchy.clock" || /clock$/.test(x)
    })
    var trays = ids.filter(function(x) { return root.clonedFrom(x) === "omarchy.tray" })
    // aliases: a default-layout id -> the ids that play its role on this bar.
    return { workspaces: found, selfId: Model.SELF_ID, centerAnchor: anchor, defaultLayout: root.defaultLayout,
             aliases: { "omarchy.workspaces": found, "omarchy.clock": clocks, "omarchy.tray": trays } }
  }

  // Omarchy's own default bar.layout, for the "Omarchy default" preset. Read
  // once when the host injects omarchyPath; null on any failure, so the preset
  // refuses instead of guessing.
  property var defaultLayout: null

  FileView {
    id: defaultsFile
    path: root.omarchyPath !== "" ? root.omarchyPath + "/config/omarchy/shell.json" : ""
    watchChanges: false
    printErrors: false
    onLoaded: root.loadDefaultLayout(text())
    onLoadFailed: root.defaultLayout = null
  }

  function loadDefaultLayout(raw) {
    try {
      var parsed = JSON.parse(String(raw || "") || "{}")
      root.defaultLayout = (parsed && parsed.bar && parsed.bar.layout) ? parsed.bar.layout : null
    } catch (e) {
      console.warn("oma-bar-configurator: Omarchy default layout unreadable:", e)
      root.defaultLayout = null
    }
  }

  // Saved before any command runs, so a run that fails halfway can still be undone.
  function saveUndo(label) {
    persistPatch({ undo: { layout: Presets.snapshot(root.liveLayout), breaks: root.storeData.groups.breaks,
                           label: label, at: new Date().toISOString(), running: true } })
  }

  // `after(text)` returns the store text to commit once the bar matches `want`;
  // on a mismatch it is skipped and `mismatch` is shown instead.
  function runLayout(argv, want, after, mismatch) {
    root.layoutError = ""
    if (!argv || argv.length === 0) { if (after) commitText(after(root.lastRawText)); return }
    root.layoutRun = true
    root.layoutWant = want
    root.afterLayout = after || null
    root.layoutMismatch = mismatch
    runSequence(argv)
  }

  // Moves go over IPC (omarchy-bar cmd_move -> shell moveBarWidget), and the
  // shell writes shell.json with an async setText (userConfigFile has no
  // blockWrites, shell.qml:148), so the file can lag the last exit. The host
  // updates its config and pushes barConfig (syncPluginApis, shell.qml:904)
  // before it answers the IPC call, so `shellConfig` is the bar as it is now.
  function endLayout(after, want, mismatch) {
    var u = PillStyle.readStore(root.lastRawText).undo
    var text = root.lastRawText
    if (u && u.running) {
      u.running = false
      text = PillStyle.writeStore(text, { undo: u })
    }
    if (want !== null) {
      var live = root.shellConfig.bar ? root.shellConfig.bar.layout : null
      root.liveBar = root.shellConfig.bar || ({})
      var r = Presets.undoPlan(live, want)
      if (!r.error && r.argv.length === 0) { if (after) text = after(text) }
      else root.layoutError = mismatch
    }
    if (text !== root.lastRawText) commitText(text)
  }

  function writeBreaksText(text, breaks) {
    return breaks ? PillStyle.patchStore(text, "groups", { breaks: breaks }) : text
  }

  // Every planner refuses with a message rather than half a plan; a throw is
  // reported the same way so a lib bug never runs anything.
  function plan(fn) {
    try { return fn() } catch (e) {
      console.warn("oma-bar-configurator: layout plan failed:", e)
      return { error: "Could not plan this change: " + e }
    }
  }

  // An unfinished run keeps its snapshot; a new change would overwrite it with
  // the half-moved bar, so only Undo may run until it is resolved.
  function blockedByUnfinished() {
    var u = root.storeData.undo
    if (!u || u.running !== true) return false
    root.layoutError = "The last change did not finish. Use Undo in Layout first."
    return true
  }

  function applyPreset(id) {
    if (root.busy || !root.storeLoaded || blockedByUnfinished()) return
    refreshLive()
    var label = String(id)
    for (var i = 0; i < Presets.PRESETS.length; i++)
      if (Presets.PRESETS[i].id === label) label = Presets.PRESETS[i].label
    var p = plan(function() {
      return Presets.presetPlan(root.liveLayout, String(id), root.layoutRoles(), root.storeData.groups.breaks, PresetTargets)
    })
    if (p.error) { root.layoutError = String(p.error); return }
    if (!p.argv || p.argv.length === 0) { root.layoutError = "Nothing to move: the bar already looks like this."; return }
    saveUndo(label + " preset")
    runPlanned(p)
  }

  // Apply and Move: the bar must end up as the plan's own replay says.
  function runPlanned(p) {
    var breaks = p.breaks
    runLayout(p.argv, Presets.applyMoves(root.liveLayout, p.argv),
              function(text) { return root.writeBreaksText(text, breaks) },
              "The bar did not end up as planned. Use Undo to go back.")
  }

  function movePill(area, pillNumber, target) {
    if (root.busy || !root.storeLoaded || blockedByUnfinished()) return
    refreshLive()
    var g = root.storeData.groups
    var rows = Groups.rows(root.liveLayout, g.breaks, Model.SELF_ID, { solo: g.solo, noPill: g.noPill, centerParts: !!g.centerParts })
    var p = plan(function() {
      return Presets.movePillPlan(root.liveLayout, g.breaks, String(area), Number(pillNumber), String(target), root.layoutRoles(), rows)
    })
    if (p.error) { root.layoutError = String(p.error); return }
    if (!p.argv || p.argv.length === 0) { root.layoutError = "Nothing to move: the pill is already there."; return }
    saveUndo("Moved a pill")
    runPlanned(p)
  }

  // ---- saved layouts (store helpers in lib/PillStyle.js) ----------------
  readonly property var savedLayouts: root.storeData.saved

  // One raw section of the store file, so a save keeps defaults as defaults.
  function rawStoreSection(key) {
    try { var o = JSON.parse(root.lastRawText || "{}"); return o && typeof o[key] === "object" && o[key] ? o[key] : {} }
    catch (e) { return {} }
  }

  function saveCurrentLayout() {
    if (root.busy || !root.storeLoaded) return
    refreshLive()
    var e = PillStyle.makeSaved(root.lastRawText, Presets.snapshot(root.liveLayout), root.barBackground, new Date(), root.savedLayouts)
    if (!e) { root.layoutError = "You have " + PillStyle.MAX_SAVED + " saved layouts. Delete one first."; return }
    root.layoutError = ""
    persistPatch({ saved: root.savedLayouts.concat([e]) })
  }

  function renameSavedLayout(id, name) {
    if (root.busy) return
    persistPatch({ saved: PillStyle.renameSaved(root.savedLayouts, String(id), String(name)) })
    keyCatcher.forceActiveFocus()
  }

  function deleteSavedLayout(id) {
    if (root.busy) return
    persistPatch({ saved: root.savedLayouts.filter(function(e) { return e.id !== String(id) }) })
  }

  // Runs after the hides and shows of a layout change finish (stepQueue), then clears.
  property var afterVisibility: null

  // Which widgets to hide and show so the bar holds the same widgets as `target`.
  // { hide, show } or { error }. A widget can only be shown back from OmaBar's own
  // hidden record, and the center anchor is never hidden.
  function visibilityPlan(target, name) {
    var d = Presets.widgetDiff(root.liveLayout, target)
    var names = function(list) { return list.map(function(id) { return root.widgetName(id) }).join(", ") }
    var lost = d.missing.filter(function(id) { return !root.savedRecord(id) })
    if (lost.length)
      return { error: name + " has " + names(lost) + ", which is not on the bar and was not hidden here, so OmaBar cannot bring it back. Add it with Omarchy, then Apply again." }
    var anchor = d.extra.filter(function(id) { return root.isLocked({ id: id, visible: true }) })
    if (anchor.length)
      return { error: names(anchor) + " holds the center in place, so it cannot be hidden. Move it out of the center first." }
    return { hide: d.extra, show: d.missing }
  }

  // Hides run first (each records its entry), then shows one at a time, then `then`.
  function runVisibility(v, then) {
    if (v.hide.length === 0 && v.show.length === 0) { then(); return }
    root.afterVisibility = then
    root.restoreQueue = v.show.slice()
    for (var i = 0; i < v.hide.length; i++) hideWidget({ id: v.hide[i], visible: true })
    if (!root.busy) stepQueue()
  }

  // Moves to `target` once the widgets match, then runs `extra` commands (a background
  // change). The caller recorded Undo with running true; with nothing to run it ends here.
  function moveToTarget(target, extra, after, mismatch) {
    refreshLive()
    // Saved settings first (by id, so order does not matter), then the moves.
    var sp = plan(function() { return Presets.settingsPlan(root.liveLayout, target) })
    if (sp.error) { root.layoutError = mismatch; return }
    var p = plan(function() { return Presets.undoPlan(sp.layout, sp.target) })
    if (p.error) { root.layoutError = mismatch; return }
    var argv = sp.argv.concat(p.argv, extra)
    if (argv.length > 0) { runLayout(argv, sp.target, after, mismatch); return }
    var u = PillStyle.readStore(root.lastRawText).undo, text = root.lastRawText
    if (u && u.running) { u.running = false; text = PillStyle.writeStore(text, { undo: u }) }
    commitText(after(text))
  }

  // Bar layout, background, groups and style back to the saved entry. Undo first
  // records all four, so Undo puts the bar back as it was before the apply.
  function applySavedLayout(id) {
    if (root.busy || !root.storeLoaded || blockedByUnfinished()) return
    var e = null
    for (var i = 0; i < root.savedLayouts.length; i++) if (root.savedLayouts[i].id === String(id)) e = root.savedLayouts[i]
    if (!e) return
    refreshLive()
    var v = root.visibilityPlan(e.layout, e.name)
    if (v.error) { root.layoutError = v.error; return }
    var p = plan(function() { return Presets.undoPlan(root.liveLayout, e.layout) })
    var moves = v.hide.length + v.show.length > 0 || (!p.error && p.argv.length > 0)
    var groups = root.rawStoreSection("groups"), style = root.rawStoreSection("style")
    var newBackground = e.background !== "" && e.background !== root.barBackground
    if (!moves && !newBackground && JSON.stringify(groups) === JSON.stringify(e.groups) && JSON.stringify(style) === JSON.stringify(e.style)) {
      root.layoutError = "Nothing to change: the bar already looks like " + e.name + "."
      return
    }
    root.layoutError = ""
    persistPatch({ undo: { layout: Presets.snapshot(root.liveLayout), breaks: root.storeData.groups.breaks,
                           label: "Applied " + e.name, at: new Date().toISOString(), running: moves || newBackground,
                           groups: groups, style: style, background: root.barBackground } })
    root.runVisibility(v, function() {
      root.moveToTarget(e.layout, newBackground ? [["omarchy-bar", "background", e.background]] : [], function(text) {
        return PillStyle.writeStore(text, { groups: e.groups, style: e.style })
      }, "The bar did not end up as saved. Use Undo to go back.")
    })
  }

  // The record is cleared only once the bar is back at the saved layout.
  function undoLayout() {
    if (root.busy || !root.storeLoaded || !root.canUndo) return
    refreshLive()
    var undo = root.storeData.undo
    var v = root.visibilityPlan(undo.layout, "the Undo point")
    if (v.error) { root.layoutError = v.error; return }
    var newBackground = undo.background !== "" && undo.background !== root.barBackground
    persistPatch({ undo: { layout: undo.layout, breaks: undo.breaks, label: undo.label, at: undo.at, running: true,
                           groups: undo.groups, style: undo.style, background: undo.background } })
    root.runVisibility(v, function() {
      root.moveToTarget(undo.layout, newBackground ? [["omarchy-bar", "background", undo.background]] : [], root.undoAfter(undo), "Undo did not reach the saved layout. Try Undo again.")
    })
  }

  function undoAfter(undo) {
    return function(text) {
      text = PillStyle.writeStore(text, { undo: null })
      // After a saved layout: whole groups and style back; otherwise breaks only, as before.
      if (undo.groups || undo.style) return PillStyle.writeStore(text, { groups: undo.groups || undefined, style: undo.style || undefined })
      return root.writeBreaksText(text, undo.breaks)
    }
  }

  // The live `bar` object from shell.json, a plain JSON copy. Re-read on
  // open, when the host pushes a new barConfig, and after our own commands:
  // the host does not push one for a background change.
  property var liveBar: ({})
  readonly property var liveLayout: (liveBar && liveBar.layout) ? liveBar.layout : ({})
  readonly property var backgroundValues: ["opaque", "glassy", "none"]
  // Same fallback as `omarchy-bar`: an old config says transparent instead.
  readonly property string barBackground: {
    var value = liveBar ? String(liveBar.background || "") : ""
    if (backgroundValues.indexOf(value) >= 0) return value
    return (liveBar && liveBar.transparent === true) ? "none" : "opaque"
  }

  function refreshLive() {
    var cfg = root.liveConfig()
    root.liveBar = (cfg && cfg.bar) ? cfg.bar : ({})
  }

  onShellConfigChanged: refreshLive()

  function setBarBackground(value) {
    var v = String(value)
    if (root.busy || backgroundValues.indexOf(v) < 0 || v === root.barBackground) return
    runSequence([["omarchy-bar", "background", v]])
  }

  // One entry per bar-targeted setting.
  readonly property var barSettings: ({
    background: {
      get: function() { return root.barBackground },
      set: function(value) { root.setBarBackground(value) }
    },
    // The stock indicators widget's own alwaysShow option: off, it shows its inactive
    // icons while the pointer is on the bar, which widens it and pushes the pills.
    indicatorsAlwaysShow: {
      get: function() { return root.indicatorsSetting("alwaysShow") === true },
      set: function(value) {
        if (root.busy || root.indicatorsSetting("id") === undefined) return
        runSequence([["omarchy-bar", "set", "omarchy.indicators", "alwaysShow", value === true ? "true" : "false", "--json"]])
      }
    }
  })

  // A key of the first omarchy.indicators entry on the bar; undefined when it is not on the bar.
  function indicatorsSetting(key) {
    var lay = root.liveLayout
    for (var s in lay) {
      var list = lay[s]
      if (!list || typeof list.length !== "number") continue
      for (var i = 0; i < list.length; i++)
        if (list[i] && list[i].id === "omarchy.indicators") return list[i][key]
    }
    return undefined
  }

  function settingValue(setting) {
    if (!setting) return undefined
    var key = String(setting.key || "")
    if (setting.target === "style") return root.storeData.style[key]
    if (setting.target === "bar" && root.barSettings[key]) return root.barSettings[key].get()
    console.warn("oma-bar-configurator: unknown setting target:", setting.target, key)
    return undefined
  }

  function setSetting(setting, value) {
    if (!setting) return
    var key = String(setting.key || "")
    if (setting.target === "style") {
      var patch = ({})
      patch[key] = value
      writeStyle(patch)
    } else if (setting.target === "bar" && root.barSettings[key]) {
      root.barSettings[key].set(value)
    } else {
      console.warn("oma-bar-configurator: unknown setting target:", setting.target, key)
    }
  }

  // ---- categories (settings/spec.json) ----------------------------------
  // One topic shown at a time, in the spec's group order. A missing or bad
  // spec leaves the one Widgets topic, which is the panel as it was.
  readonly property var fallbackCategories: [{ id: "widgets", title: "Widgets", page: "widgets" }]
  property var categories: fallbackCategories
  property string categoryId: "widgets"
  readonly property var currentGroup: {
    for (var i = 0; i < categories.length; i++)
      if (categories[i].id === root.categoryId) return categories[i]
    return categories[0]
  }
  readonly property bool onWidgetsPage: currentGroup.page === "widgets"

  FileView {
    id: specFile
    path: {
      var url = String(Qt.resolvedUrl("settings/spec.json"))
      return url.indexOf("file://") === 0 ? decodeURIComponent(url.slice(7)) : ""
    }
    watchChanges: false
    printErrors: false
    onLoaded: root.loadSpec(text())
    onLoadFailed: root.loadSpec("")
  }

  function loadSpec(raw) {
    var groups = []
    try {
      var spec = JSON.parse(String(raw || "") || "{}")
      var list = (spec && spec.groups && typeof spec.groups.length === "number") ? spec.groups : []
      for (var i = 0; i < list.length; i++) {
        var g = list[i]
        if (!g || typeof g.id !== "string" || g.id === "") continue
        if (typeof g.page !== "string" && !(g.settings && typeof g.settings.length === "number")) continue
        groups.push(g)
      }
    } catch (e) {
      console.warn("oma-bar-configurator: settings/spec.json unreadable:", e)
    }
    if (groups.length === 0 && String(raw || "") !== "")
      console.warn("oma-bar-configurator: settings/spec.json has no usable groups, showing widgets only")
    root.categories = groups.length > 0 ? groups : root.fallbackCategories
  }

  function selectCategory(id) {
    root.categoryId = String(id)
    root.layoutError = ""
    checkUnfinished()
    root.cursorActive = false
    root.groupCursorAt = -1
    keyCatcher.forceActiveFocus()
  }

  function stepCategory(delta) {
    var n = categories.length
    if (n < 2) return
    var at = 0
    for (var i = 0; i < n; i++) if (categories[i].id === currentGroup.id) at = i
    selectCategory(categories[((at + delta) % n + n) % n].id)
  }

  // panel/<Name>.qml for a named page ("widgets" is panel/WidgetsPage.qml),
  // panel/SettingsPage.qml for a settings group. The name comes from a file, so it may only be a plain identifier.
  function pageUrl(group) {
    var name = typeof group.page === "string" ? group.page : "SettingsPage"
    if (name === "widgets") name = "WidgetsPage"
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      console.warn("oma-bar-configurator: bad page name in spec:", name)
      return ""
    }
    return Qt.resolvedUrl("panel/" + name + ".qml")
  }

  function loadPage() {
    var group = root.currentGroup
    if (!win.visible || !group) { pageLoader.source = ""; return }
    var url = pageUrl(group)
    if (url === "") { pageLoader.source = ""; return }
    var props = typeof group.page === "string" ? { panel: root } : { panel: root, group: group }
    // Cleared first: two settings groups share SettingsPage.qml, and a Loader
    // may keep the old item when the url has not changed.
    pageLoader.source = ""
    pageScroll.contentY = 0
    pageLoader.setSource(url, props)
  }

  onCurrentGroupChanged: loadPage()

  // ---- live config -----------------------------------------------------
  // `shell.barConfig` is fine to RENDER from and not safe to DECIDE from. It
  // is a copy the host pushes on its own schedule (shell.qml syncPluginApis,
  // driven by pluginsChanged), which is not our schedule: a capture taken from
  // a copy that still lists a widget records a neighbour that is not there any
  // more, and a restore resolved against one emits `--after <gone>`, which is
  // a hard CLI failure -- "could not find target widget", exit 1 -- that
  // leaves the widget off the bar entirely.
  //
  // So every hide and every show re-reads shell.json off disk at the moment it
  // runs. `blockAllReads` makes reload() + text() a synchronous round trip, so
  // the value is the file as it is now and not as it was when a signal last
  // fired. Measured: the CLI has flushed the file before its process exits, and
  // runSequence steps on `exited`, so this read is never ahead of the previous
  // command's write.
  FileView {
    id: liveConfigFile
    path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
    watchChanges: false
    blockLoading: true
    blockAllReads: true
    printErrors: false
  }

  function liveConfig() {
    try {
      liveConfigFile.reload()
      var parsed = JSON.parse(liveConfigFile.text() || "{}")
      // Same round trip as shellConfig, for the same reason: anything that
      // crossed a host `var` boundary fails Array.isArray. JSON.parse output
      // never did, but the fallback below has, so keep one shape for both.
      if (parsed && typeof parsed === "object" && parsed.bar) return parsed
    } catch (e) {
      console.warn("oma-bar-configurator: live shell.json unreadable, falling back:", e)
    }
    return root.shellConfig
  }

  Component.onCompleted: {
    store.reload()
    refreshLive()
    refreshPluginInfo()
    refreshGeometry()
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
    || restoreQueue.length > 0

  Process {
    id: runner
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        console.warn("oma-bar-configurator: command failed (" + exitCode + "):",
                     JSON.stringify(runner.command))
        // A layout run stops at the first failed step: the next moves were
        // planned against a bar this one did not produce.
        if (root.layoutRun || root.afterVisibility) {
          root.pending = []
          root.restoreQueue = []
          root.afterLayout = null
          root.afterVisibility = null
          root.layoutWant = null
          root.layoutError = "Stopped after a failed step. Use Undo to go back."
        }
      }
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
      // The previous command's write has landed by now, so the next restore in
      // a "show all" run resolves its neighbours against the bar it will
      // actually be inserted into.
      if (root.restoreQueue.length > 0) { stepRestoreQueue(); return }
      pruneRestoredStore()
      refreshLive()
      if (root.afterVisibility) {
        var then = root.afterVisibility
        root.afterVisibility = null
        then()
        return
      }
      if (root.layoutRun) {
        var after = root.afterLayout, want = root.layoutWant
        root.layoutRun = false
        root.afterLayout = null
        root.layoutWant = null
        root.endLayout(after, want, root.layoutMismatch)
      }
      // Widget names and clone sources change with what is enabled, and so
      // does which slots are drawing.
      refreshPluginInfo()
      geometrySettle.restart()
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
      console.warn("oma-bar-configurator: isCenterAnchor failed:", e)
      return row.isAnchor === true
    }
  }

  function setBarPosition(value) {
    if (root.busy || value === root.barPosition) return
    runSequence([["omarchy-bar", "position", String(value)]])
  }

  function setBarTransparent(value) {
    setBarBackground(value ? "none" : root.lastSolidBackground)
  }

  // The background before "none" was chosen, so the switch can go back to it.
  property string lastSolidBackground: "opaque"
  onBarBackgroundChanged: if (root.barBackground !== "none") root.lastSolidBackground = root.barBackground

  function toggleAt(index) {
    var row = rowAt(index)
    if (!row || !root.storeLoaded || root.busy) return
    // The list is about to be rebuilt out from under itself; the Widgets page
    // records where it was standing first (panel/WidgetsPage.qml).
    root.toggleStarting()
    if (row.visible) hideWidget(row)
    else showWidget(row)
  }

  function hideWidget(row) {
    if (isLocked(row)) return
    var captured = null
    var sequence = null
    try {
      captured = Model.captureEntry(root.liveConfig(), row.id)
      sequence = Model.hideSequence(row.id, root.clonedFrom(row.id))
    } catch (e) {
      console.warn("oma-bar-configurator: hide of", row.id, "failed:", e)
      return
    }
    if (!captured || !sequence || sequence.length === 0) {
      console.warn("oma-bar-configurator: nothing to capture for", row.id, "- refusing to hide")
      return
    }
    // Recorded BEFORE the commands run, and deliberately so: the splice
    // destroys the only copy of the entry, so a hide that runs first and
    // records second loses the widget's settings the one time the command
    // fails halfway. A record for a widget that is still on the bar costs
    // nothing -- barCatalogue believes the layout, not the store, so the row
    // just reads as shown -- while the reverse loses data.
    var next = []
    for (var i = 0; i < root.savedHidden.length; i++)
      if (String(root.savedHidden[i].id) !== row.id) next.push(root.savedHidden[i])
    next.push(captured)
    root.savedHidden = next
    persistStore()
    runSequence(sequence)
  }

  // The record is NOT dropped here. Two reasons, and they are the two bugs
  // this used to cause:
  //
  //  - Dropping it before the command succeeded meant a failed `plugin enable`
  //    left the widget off the bar AND its entry gone from the store, with
  //    nothing left to retry from. The whole point of the store is to survive
  //    exactly that.
  //  - showArgv needs the hide ORDER of the widgets already back on the bar to
  //    place the ones still hidden (see Model.siblingAnchor). Deleting a record
  //    on restore throws that order away mid-run, which is what let a
  //    four-widget restore come back reversed.
  //
  // The record for a widget that is on the bar is inert: barCatalogue reads the
  // layout as the truth, so the row shows as shown, and hiding it again
  // replaces the record. pruneRestoredStore() empties the store once the run is
  // over.
  function showWidget(row) {
    var saved = savedRecord(row.id)
    var sequence = null
    try {
      sequence = Model.showSequence(saved, root.liveConfig(), root.savedHidden)
    } catch (e) {
      console.warn("oma-bar-configurator: restore of", row.id, "failed:", e)
      return
    }
    if (!sequence || sequence.length === 0) {
      console.warn("oma-bar-configurator: no restore commands for", row.id)
      return
    }
    runSequence(sequence)
  }

  // Once every widget we hid is back, the records have nothing left to order
  // and the store empties itself. Keeping them past the end of the run would
  // let an arrangement from a week ago decide where today's restore lands.
  function pruneRestoredStore() {
    if (root.savedHidden.length === 0) return
    var cfg = root.liveConfig()
    for (var i = 0; i < root.savedHidden.length; i++) {
      try {
        if (!Model.captureEntry(cfg, root.savedHidden[i].id)) return // still hidden
      } catch (e) {
        return
      }
    }
    root.savedHidden = []
    persistStore()
  }

  // One at a time, each one resolved against the bar as it is by then. Queuing
  // every argv up front was the same stale-read bug in miniature: all of them
  // were built against the layout as it looked BEFORE the first one ran, so the
  // second widget onwards was placed against a bar that no longer existed.
  property var restoreQueue: []

  function restoreAll() {
    if (root.busy) return
    var ids = []
    for (var i = 0; i < rows.length; i++) if (!rows[i].visible) ids.push(rows[i].id)
    root.restoreQueue = ids
    stepRestoreQueue()
  }

  function stepRestoreQueue() {
    if (root.restoreQueue.length === 0) return
    var id = String(root.restoreQueue[0])
    root.restoreQueue = root.restoreQueue.slice(1)
    showWidget({ id: id })
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
  readonly property real categoryBarExtent: root.categories.length > 1 ? categoryBar.height + content.spacing : 0
  // Height a page may take before the card runs out of screen; pages size against it.
  readonly property real pageRoom: win.availableHeight - card.verticalInset - root.categoryBarExtent
  readonly property int margin: Style.gapsOut

  PanelWindow {
    id: win

    visible: root.opened || card.opacity > 0
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore

    // A page is built only while the card is on screen; zero cost when closed.
    onVisibleChanged: root.loadPage()

    WlrLayershell.namespace: "omabarconfigurator"
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

      color: Commons.Color.popups.background
      borderSpec: Border.surfaceSpec("popups", "border", Commons.Color.popups.border, Math.max(1, Style.space(2)))
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

        // The list keys act only while the list is the page on show; Tab
        // and Shift+Tab step through the topics.
        reorderable: root.onGroupsPage
        onMoveRequested: function(dx, dy) {
          if (root.onGroupsPage) root.moveGroupCursor(dx, dy)
          else if (dy !== 0 && root.onWidgetsPage) root.moveCursor(dy)
        }
        onReorderRequested: function(dy) { if (root.onGroupsPage) root.moveSelectedPill(dy) }
        onActivateRequested: {
          if (root.onGroupsPage) root.activateGroupCursor()
          else if (root.cursorActive && root.onWidgetsPage) root.toggleAt(root.cursorIndex)
        }
        onCloseRequested: root.dismiss()
        onTabRequested: function(direction) { root.stepCategory(direction) }
        onTextKey: function(t) {
          if ((t === "u" || t === "U") && root.onWidgetsPage) root.restoreAll()
          else if (root.onGroupsPage) root.groupModeKey(t)
        }

      Column {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(12)

        CategoryBar {
          id: categoryBar
          width: parent.width
          panel: root
        }

        // Every topic, Widgets included. The page takes its natural height;
        // past what the card has left, it scrolls here, so pages need not.
        Flickable {
          id: pageScroll
          width: parent.width
          contentHeight: pageLoader.height
          height: Math.min(contentHeight, Math.max(Style.space(120), root.pageRoom))
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          interactive: contentHeight > height

          ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

          Loader {
            id: pageLoader
            width: pageScroll.width
            onStatusChanged: if (status === Loader.Error)
              console.warn("oma-bar-configurator: page failed to load:", source)
          }
        }
      }
      }
    }
  }
}
