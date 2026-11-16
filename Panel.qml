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
    refreshLive()
    refreshPluginInfo()
    refreshGeometry()
    root.cursorActive = false
    root.cursorIndex = 0
    widgetList.keepContentY = 0
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
    printErrors: false
    onLoaded: root.loadStore(text())
    onFileChanged: reload()
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
  }

  function persistStore() {
    persistPatch({ hidden: root.savedHidden })
  }

  function persistPatch(patch) {
    var text = PillStyle.writeStore(root.lastRawText, patch)
    root.lastRawText = text
    store.setText(text)
  }

  // ---- settings API (the pages under panel/ code against these) --------
  readonly property var storeData: PillStyle.readStore(root.lastRawText)

  // Refused before the store has loaded: merging onto an empty text would
  // write a file without the hidden list.
  function writeStyle(patch) {
    if (!root.storeLoaded || !patch) return
    var merged = ({})
    var current = root.storeData.style
    for (var k in current) merged[k] = current[k]
    for (var p in patch) merged[p] = patch[p]
    persistPatch({ style: merged })
  }

  function writeBreaks(area, ids) {
    var areas = ["left", "center", "right"]
    if (!root.storeLoaded || areas.indexOf(String(area)) < 0) return
    var breaks = ({})
    for (var i = 0; i < areas.length; i++) {
      var list = areas[i] === String(area) ? (ids || []) : root.storeData.groups.breaks[areas[i]]
      // Copied element by element: a host array fails Array.isArray (FINDINGS.md).
      var copy = []
      for (var j = 0; j < list.length; j++) copy.push(String(list[j]))
      breaks[areas[i]] = copy
    }
    persistPatch({ groups: { breaks: breaks } })
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

  function settingValue(setting) {
    if (!setting) return undefined
    var key = String(setting.key || "")
    if (setting.target === "style") return root.storeData.style[key]
    if (setting.target === "bar" && key === "background") return root.barBackground
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
    } else if (setting.target === "bar" && key === "background") {
      setBarBackground(value)
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
    root.cursorActive = false
    keyCatcher.forceActiveFocus()
  }

  function stepCategory(delta) {
    var n = categories.length
    if (n < 2) return
    var at = 0
    for (var i = 0; i < n; i++) if (categories[i].id === currentGroup.id) at = i
    selectCategory(categories[((at + delta) % n + n) % n].id)
  }

  // panel/<Name>.qml for a named page, panel/SettingsPage.qml for a settings
  // group. The name comes from a file, so it may only be a plain identifier.
  function pageUrl(group) {
    var name = typeof group.page === "string" ? group.page : "SettingsPage"
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      console.warn("oma-bar-configurator: bad page name in spec:", name)
      return ""
    }
    return Qt.resolvedUrl("panel/" + name + ".qml")
  }

  function loadPage() {
    var group = root.currentGroup
    if (!win.visible || !group || group.page === "widgets") { pageLoader.source = ""; return }
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
      if (exitCode !== 0)
        console.warn("oma-bar-configurator: command failed (" + exitCode + "):",
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
      // The previous command's write has landed by now, so the next restore in
      // a "show all" run resolves its neighbours against the bar it will
      // actually be inserted into.
      if (root.restoreQueue.length > 0) { stepRestoreQueue(); return }
      pruneRestoredStore()
      refreshLive()
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
    setBarBackground(value ? "none" : "opaque")
  }

  function toggleAt(index) {
    var row = rowAt(index)
    if (!row || !root.storeLoaded || root.busy) return
    // The list is about to be rebuilt out from under itself; remember where it
    // was standing first. See widgetList.keepContentY.
    widgetList.keepContentY = widgetList.contentY
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
        onMoveRequested: function(dx, dy) { if (dy !== 0 && root.onWidgetsPage) root.moveCursor(dy) }
        onActivateRequested: if (root.cursorActive && root.onWidgetsPage) root.toggleAt(root.cursorIndex)
        onCloseRequested: root.dismiss()
        onTabRequested: function(direction) { root.stepCategory(direction) }
        onTextKey: function(t) { if ((t === "u" || t === "U") && root.onWidgetsPage) root.restoreAll() }

      Column {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(12)

        // The topic switcher: one equal-width chip per spec group, built like
        // the bar position row so any number of topics fits the card. Hidden
        // with one topic, so a spec-less install looks as before.
        Row {
          id: categoryBar
          width: parent.width
          visible: root.categories.length > 1
          spacing: Style.space(6)

          readonly property real cellWidth:
            (width - spacing * Math.max(0, root.categories.length - 1)) / Math.max(1, root.categories.length)

          Repeater {
            model: root.categories

            delegate: Button {
              required property var modelData
              width: categoryBar.cellWidth
              text: String(modelData.title || modelData.id)
              tooltipText: "Tab and Shift+Tab switch topics"
              fontSize: Style.font.bodySmall
              fontFamily: root.fontFamily
              foreground: root.foreground
              horizontalPadding: Style.spacing.controlPaddingX
              verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
              bordered: true
              active: root.currentGroup.id === modelData.id
              onClicked: root.selectCategory(modelData.id)
            }
          }
        }

        // Everything above the list. Its height is independent of the list's,
        // which is what lets the list cap itself against the space left over
        // without the two forming a binding loop.
        Column {
          id: headBlock
          visible: root.onWidgetsPage
          width: parent.width
          spacing: Style.space(12)

          PanelHero {
            title: "Bar widgets"
            // The eyebrow must not restate the grid two rows below it: the
            // section counts and the shown/hidden split are already there, and
            // the bar position is on the button group. What is left, and what
            // nothing else on the card says, is which widget the centre is
            // pinned to. PanelHero upper-cases `meta` for us.
            meta: root.busy
              ? "APPLYING CHANGES"
              : (root.anchorName !== ""
                 ? "PINNED TO " + root.anchorName
                 : "CENTRE UNPINNED")
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

            // The hero's trailing rail, which was empty: 28% of the card's
            // width and 134px tall holding 133 lit pixels, while the reference
            // puts its action glyphs and a master toggle there. These two are
            // the bar-wide verbs this panel already owns. The restore is
            // present always now rather than appearing only once something is
            // hidden -- a control that is absent teaches nobody it exists --
            // and the switch reports a real bar setting rather than decorating.
            trailingControl: Component {
              Row {
                spacing: Style.space(8)

                PanelActionButton {
                  anchors.verticalCenter: parent.verticalCenter
                  enabled: root.hiddenCount > 0 && !root.busy
                  iconText: "󰈈"
                  tooltipText: root.hiddenCount > 0
                    ? "Show every hidden widget" : "Nothing is hidden"
                  foreground: root.foreground
                  fontFamily: root.fontFamily
                  onClicked: root.restoreAll()
                }

                ToggleSwitch {
                  anchors.verticalCenter: parent.verticalCenter
                  checked: root.barTransparent
                  busy: root.busy
                  foreground: root.foreground
                  onToggled: root.setBarTransparent(!root.barTransparent)
                }
              }
            }
          }

          // Four counts, one or two characters each, forever. They were in a
          // two-column right-aligned grid, which is the reference's shape but
          // not the reference's DATA: its values are 5-13 characters stacked
          // four deep, so its right axis accumulates into a column rule. Ours
          // put a single digit 175px from its label, four times, and with two
          // rows there was no axis to read. Fixed where the mismatch is -- the
          // values -- rather than by padding the grid with invented stats.
          //
          // One row of tight label+value pairs on four evenly spaced starts:
          // the number sits against the word it belongs to, the four cell
          // starts are the alignment, and the block gives a line of height
          // back to the head.
          Row {
            id: statRow
            width: parent.width
            spacing: Style.space(6)

            readonly property real cellWidth: (width - spacing * 3) / 4

            StatCell { label: "Left"; value: root.regionCount("left") }
            StatCell { label: "Center"; value: root.regionCount("center") }
            StatCell { label: "Right"; value: root.regionCount("right") }
            StatCell {
              label: "Hidden"
              value: root.hiddenCount
              valueColor: root.hiddenCount > 0 ? root.foreground : root.dim
            }
          }

          PanelSeparator { foreground: root.foreground }

          // The head's only control, on the axis the title row leaves empty.
          // `omarchy bar position <top|bottom|left|right>` is a supported verb
          // and it is the one bar-wide decision this card can honestly own --
          // everything below it is per-widget.
          Column {
            width: parent.width
            spacing: Style.space(4)

            PanelSectionHeader {
              text: "BAR POSITION"
              // Same construction as the list's section headers so this one
              // binds downward by the same amount: overshoot guard, plus the
              // gap that separates it from what came before.
              topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
              foreground: root.foreground
              fontFamily: root.fontFamily
            }

            Row {
              id: positionRow
              width: parent.width
              spacing: Style.space(6)

              readonly property real cellWidth: (width - spacing * 3) / 4

              Repeater {
                model: ["top", "right", "bottom", "left"]

                delegate: Button {
                  required property string modelData
                  width: positionRow.cellWidth
                  text: modelData.charAt(0).toUpperCase() + modelData.slice(1)
                  tooltipText: "Move the bar to the " + modelData
                  fontSize: Style.font.bodySmall
                  fontFamily: root.fontFamily
                  foreground: root.foreground
                  horizontalPadding: Style.spacing.controlPaddingX
                  verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
                  bordered: true
                  active: root.barPosition === modelData
                  enabled: !root.busy
                  onClicked: root.setBarPosition(modelData)
                }
              }
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
          visible: root.onWidgetsPage
          width: parent.width
          // Two caps. The screen one is the hard limit; the second keeps a bar
          // with a lot of widgets from growing a card the height of the
          // display -- past that the list scrolls. It was 420, which sliced
          // this machine's own bar four rows early while the screen still had
          // the room for them.
          readonly property real capHeight: Math.min(contentHeight, Style.space(560),
            Math.max(Style.space(120),
              win.availableHeight - card.verticalInset - headBlock.implicitHeight - content.spacing
                - root.categoryBarExtent))

          // Whatever the caps land on, the viewport ends on a row boundary. A
          // row cut through its own middle reads as a clipping bug, not as
          // "there is more below" -- and the scrollbar is already saying the
          // second part. Assigned, never bound: `capHeight` is a function of
          // contentHeight and the screen, neither of which depends on the
          // viewport, so nothing here can feed back into itself.
          property real snappedHeight: 0
          height: snappedHeight > 0 ? snappedHeight : capHeight

          // `model` is a plain JS array, so every rebuild REPLACES it and a
          // ListView puts a replaced model back at the top. One toggle rebuilds
          // it twice -- once when our own store changes, again when the host's
          // config catches up -- so hiding three widgets in a row used to throw
          // the user back to the top of a fifteen-row list twice.
          //
          // toggleAt records the position before it dispatches; every rebuild
          // after that puts it back. Assigned late (Qt.callLater) because the
          // delegates and contentHeight are not settled inside the model change
          // itself, and there is nothing to clamp against yet.
          property real keepContentY: 0
          onModelChanged: Qt.callLater(restoreContentY)
          onMovementEnded: keepContentY = contentY

          function restoreContentY() {
            var wanted = Math.max(0, Math.min(keepContentY, Math.max(0, contentHeight - height)))
            if (Math.abs(contentY - wanted) > 0.5) contentY = wanted
          }

          // Snapping changes `height`, which re-clamps contentY, so the wanted
          // position is re-applied after it rather than before.
          onCapHeightChanged: Qt.callLater(resnapAndKeepPosition)
          onCountChanged: Qt.callLater(resnapAndKeepPosition)

          function resnapAndKeepPosition() { resnap(); restoreContentY() }

          function resnap() {
            if (capHeight >= contentHeight) { snappedHeight = 0; return }
            // The delegate straddling the cut. -1 means the cut already fell in
            // the gap between two rows, which is the thing we are aiming for.
            var i = indexAt(2, contentY + capHeight)
            if (i < 0) { snappedHeight = 0; return }
            var item = itemAtIndex(i)
            var top = item ? item.y - contentY : 0
            snappedHeight = top >= Style.space(120) ? top : 0
          }
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

        // Every topic other than Widgets. The page takes its natural height;
        // past what the card has left, it scrolls here, so pages need not.
        Flickable {
          id: pageScroll
          visible: !root.onWidgetsPage
          width: parent.width
          contentHeight: pageLoader.height
          height: Math.min(contentHeight,
            Math.max(Style.space(120), win.availableHeight - card.verticalInset - root.categoryBarExtent))
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

  // One widget on the bar. Glyph, name, and a switch the row itself owns --
  // the switch is presentation, so the whole row is a single target for the
  // mouse and the keyboard cursor alike.
  component WidgetRow: CursorSurface {
    id: widgetRow
    required property var row
    required property int rowIndex

    readonly property bool shown: row.visible
    readonly property bool locked: root.isLocked(row)
    // On the bar and painting nothing. Its own truth, separate from `shown`:
    // the entry is there, the widget just has nothing to draw.
    readonly property bool blank: row.visible && root.notDrawingIds[row.id] === true

    hasCursor: root.cursorActive && root.cursorIndex === rowIndex
    // The raised fill is the anchor row's and nothing else on the list spends
    // it -- the same slot the network panel keeps for the network it is
    // connected to. Every other row sits on the popup ground. The band that
    // used to run under all of them measured 1.05:1 against that ground: 41.5%
    // of the card for a difference nothing can see, and it held the one fill
    // the anchor needed, which is why the anchor then wanted a rule AND a tag
    // before it could be found. CursorSurface already draws exactly this; the
    // explicit `color` that used to sit here was overriding it.
    current: widgetRow.locked
    foreground: root.foreground
    fill: root.hoverFill
    currentFill: root.selectedFill
    implicitHeight: rowBody.implicitHeight

    // Never dim the anchor row. It is pinned, not broken, and the dimmed
    // version read as a widget that had failed rather than one deliberately
    // held on. Only a command in flight dims anything.
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
      // Not the left margin's 10. The switch is the only thing anchored to this
      // edge, and the kit's header switch sits 6 inside the same rail (its
      // cursor-ring pad), so 6 here puts all fourteen switches on one axis
      // instead of leaving the thirteen list ones 4px short of it.
      anchors.rightMargin: Style.space(6)
      implicitHeight: Math.max(rowGlyph.height, rowLabel.implicitHeight, rowSwitch.implicitHeight)
        + Style.spacing.rowPaddingX

      OpticalGlyph {
        id: rowGlyph
        width: Style.space(18)
        height: Style.space(18)
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: root.widgetGlyph(widgetRow.row.id)
        fontFamily: root.widgetGlyphFamily(widgetRow.row.id)
        fontSize: Style.font.title
        color: widgetRow.shown ? root.foreground : root.dim
      }

      // The kit's switch, unmodified, exactly as `Toggle` parks it at the end
      // of a labeled row: `interactive: false` hands the click to the row's own
      // MouseArea and drops the cursor ring, so the item is the track and
      // nothing else and its right edge lands on the header switch's axis.
      //
      // This replaces an inlined copy that dimmed the ON knob to the sub-label
      // tier, out of a fear that thirteen knobs at full foreground would shout.
      // That inverted the semantics: the OFF knob came out brighter than the ON
      // one, so the rail read as thirteen disabled controls with the single
      // genuinely-off switch the loudest thing in it. The kit has it the right
      // way round -- ON takes the title token, the same value the reference
      // card spends on its one ON switch, and OFF drops a tier and picks up the
      // 1px border this card already gives every inactive segmented button.
      // Fourteen switches, one rule, and the state reads in the right
      // direction.
      ToggleSwitch {
        id: rowSwitch
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        checked: widgetRow.shown
        interactive: false
        foreground: root.foreground
      }

      // Trailing state marker, the slot the network panel keeps for its row
      // state. Sentence case, unbolded, untracked -- deliberately NOT the
      // small-caps of the LEFT / CENTER / RIGHT headers, which is what the
      // bolded and tracked "ANCHOR" was colliding with: a row-level fact drawn
      // at group-level rank. The reference writes "Connected" in this slot,
      // not "CONNECTED", for the same reason.
      //
      // "Not drawing" rides here too, at the same tier and in the same token:
      // it is a row-level fact, and it is information, not an alarm. Both can
      // be true at once, so both get said rather than one hiding the other.
      Text {
        id: rowState
        textFormat: Text.PlainText
        visible: text !== ""
        text: widgetRow.locked
          ? (widgetRow.blank ? "Pinned, not drawing" : "Pinned")
          : (widgetRow.blank ? "Not drawing" : "")
        anchors.right: rowSwitch.left
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }

      // One line, always. A second line under the name is what made the anchor
      // row 4px taller than its neighbours and put a visible stumble in the
      // list's pitch; the state it carried now rides beside the switch.
      Text {
        id: rowLabel
        textFormat: Text.PlainText
        anchors.left: rowGlyph.right
        anchors.leftMargin: Style.space(10)
        anchors.right: rowState.visible ? rowState.left : rowSwitch.left
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        text: root.widgetName(widgetRow.row.id)
        color: widgetRow.shown ? root.foreground : root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        elide: Text.ElideRight
      }
    }
  }

  // One count and the word it counts, kept together. `parent` is the stat row,
  // which owns the cell width -- an inline component cannot see an id declared
  // inside the tree below root.
  component StatCell: Row {
    property string label: ""
    property string value: ""
    property color valueColor: root.foreground

    width: parent ? parent.cellWidth : 0
    spacing: Style.space(6)

    InfoLabel { text: parent.label }
    InfoValue { text: parent.value; color: parent.valueColor }
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
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }
}
