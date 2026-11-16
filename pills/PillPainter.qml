import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "BarAdapter.js" as BarAdapter
import "../lib/GroupLayout.js" as GroupLayout
import "../lib/PillStyle.js" as PillStyle

// The OmaBar pills bar entry. Invisible and zero sized; on its bar surface it
// draws pills behind the widget groups set up in the OmaBar panel. With pills
// off it creates nothing. If the bar's internals moved, it draws nothing and
// logs one warning (BarAdapter.locate).
BarWidget {
  id: root

  visible: false
  implicitWidth: 0
  implicitHeight: 0

  property string storeText: ""
  readonly property var store: PillStyle.readStore(storeText)
  readonly property var style: store.style
  readonly property bool active: style.enabled && bar !== null

  // Found once per surface; the bar rebuilds the surface, and this widget
  // with it, when the bar turns vertical or a monitor comes and goes.
  property var located: null
  property bool warned: false // failures only
  property bool warnedSoft: false // unknown region: still draws

  readonly property var themeColors: ({
    background: String(Commons.Color.background),
    foreground: String(Commons.Color.foreground),
    accent: String(Commons.Color.accent),
    urgent: String(Commons.Color.urgent),
    muted: String(Commons.Color.muted)
  })
  readonly property var look: ({
    vertical: root.vertical,
    animate: style.animate,
    inset: style.inset,
    // Style.cornerRadius mirrors Hyprland's decoration:rounding and refreshes on configreloaded (no Process or timer here).
    cornerRadius: style.radiusFollowsWindows ? Style.cornerRadius : style.radius,
    fillColor: PillStyle.resolveColor(style.color, themeColors, themeColors.background),
    fillOpacity: style.fillOpacity,
    edgeColor: PillStyle.resolveColor(style.borderColor, themeColors, themeColors.foreground),
    edgeOpacity: style.borderOpacity,
    edgeWidth: style.borderWidth,
    // Matches the stock bar's own color fade.
    fadeDuration: Style.duration(250),
    fadeCurve: Style.easeOut
  })

  // One binding per area: a change in one section recomputes only that area.
  readonly property var leftPills: pillsOf("left")
  readonly property var centerPills: pillsOf("center")
  readonly property var rightPills: pillsOf("right")

  // Created pills per area. They live under the bar's own items, not under
  // this widget, so they are destroyed by hand (spike finding).
  property var shapes: ({ left: [], center: [], right: [] })

  function pillsOf(area) {
    if (!located) return []
    var areas = {}
    areas[area] = BarAdapter.areaSlots(located, area, vertical)
    var parent = located.parents[area]
    var extent = parent ? (vertical ? parent.height : parent.width) : Infinity
    var pills = GroupLayout.pills(areas, store.groups.breaks, {
      padding: style.padding, gap: style.gap, min: style.inset, max: extent - style.inset,
      solo: store.groups.solo, noPill: store.groups.noPill, centerParts: store.groups.centerParts
    })[area]
    // Square edges: the outermost pill runs to the screen edge, in the parent's coordinates.
    if (style.squareEdges && parent && pills.length && area !== "center") {
      var top = parent
      while (top.parent) top = top.parent
      var before = BarAdapter.offsetIn(parent, null, vertical)
      if (area === "left") pills[0].start = -before
      else pills[pills.length - 1].end = (vertical ? top.height : top.width) - before
    }
    return pills
  }

  // soft: the adapter can still draw, so it has its own flag and never hides a failure.
  function warnOnce(message, soft) {
    if (soft) {
      if (warnedSoft) return
      warnedSoft = true
      console.warn("OmaBar pills: " + message)
      return
    }
    if (warned) return
    warned = true
    console.warn("OmaBar pills: " + message + "; drawing no pills")
  }

  function scan() {
    located = active ? BarAdapter.locate(root, warnOnce) : null
  }

  // Same count and parent: move the pills in place. Otherwise rebuild the area.
  function syncArea(area, pills) {
    var have = shapes[area]
    var parent = located ? located.parents[area] : null
    if (!parent || have.length !== pills.length || (have.length && have[0].parent !== parent)) {
      clearArea(area)
      for (var i = 0; i < pills.length; i++) {
        var made = shapeComponent.createObject(parent, look)
        if (made) have.push(made)
      }
    }
    // Same count: match shapes by first widget id, so a pill whose members
    // changed does not glide to another group. Only a clean match reorders.
    var byKey = {}, ordered = []
    for (var k = 0; k < have.length; k++) byKey[have[k].key] = have[k]
    for (var m = 0; m < pills.length; m++) {
      var hit = byKey[pills[m].ids[0]]
      if (!hit) break
      ordered.push(hit)
      delete byKey[pills[m].ids[0]]
    }
    if (ordered.length === have.length) for (var o = 0; o < have.length; o++) have[o] = ordered[o]
    var square = style.squareEdges
    for (var j = 0; j < have.length; j++) {
      // Only the outermost pills touch a screen edge: left's first, right's last.
      have[j].squareStart = square && area === "left" && j === 0
      have[j].squareEnd = square && area === "right" && j === have.length - 1
      have[j].key = pills[j].ids[0]
      have[j].aim(pills[j].start, pills[j].end)
    }
  }

  function clearArea(area) {
    var have = shapes[area]
    // The bar may have destroyed a parent first, taking the pill with it.
    while (have.length) { var s = have.pop(); if (s) s.destroy() }
  }

  function restyle() {
    var all = shapes.left.concat(shapes.center, shapes.right)
    for (var i = 0; i < all.length; i++) for (var key in look) all[i][key] = look[key]
  }

  onActiveChanged: Qt.callLater(scan)
  onLeftPillsChanged: syncArea("left", leftPills)
  onCenterPillsChanged: syncArea("center", centerPills)
  onRightPillsChanged: syncArea("right", rightPills)
  onLookChanged: restyle()
  onStyleChanged: { syncArea("left", leftPills); syncArea("right", rightPills) }
  Component.onCompleted: Qt.callLater(scan)
  Component.onDestruction: { clearArea("left"); clearArea("center"); clearArea("right") }

  FileView {
    path: Quickshell.env("HOME") + "/.config/omarchy/oma-bar-configurator.json"
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.storeText = text()
    onLoadFailed: root.storeText = ""
  }

  // The file changes often: each distinct store warning is logged once per painter.
  property var seenWarnings: ({})
  onStoreChanged: {
    for (var i = 0; i < store.warnings.length; i++) {
      var w = store.warnings[i]
      if (seenWarnings[w]) continue
      seenWarnings[w] = true
      console.warn("OmaBar pills: " + w)
    }
  }

  Component {
    id: shapeComponent
    PillShape {}
  }
}
