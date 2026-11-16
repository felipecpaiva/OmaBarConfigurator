import QtQuick
import qs.Commons
import qs.Ui

// Spike only. Zero size; finds every ModuleList on its bar surface and puts
// one pill behind the visible slots of each.
BarWidget {
  id: root
  visible: false
  implicitWidth: 0
  implicitHeight: 0

  property var lists: []

  function topOf(item) {
    var p = item
    while (p && p.parent) p = p.parent
    return p
  }

  function isList(it) {
    return it && ("listRows" in it) && ("keys" in it) && ("region" in it) && ("pool" in it)
  }

  function collect(item, out) {
    if (!item) return
    if (isList(item)) out.push(item)
    var kids = item.children
    for (var i = 0; i < kids.length; i++) collect(kids[i], out)
  }

  function scan() {
    var top = topOf(root)
    var out = []
    collect(top, out)
    var shown = out.filter(function (l) { return l.region !== "tray" })
    console.log("omabarspike: top=" + top + " lists=" + out.length + " used=" + shown.length +
      " regions=" + shown.map(function (l) { return l.region + ":" + l.keys.length }).join(","))
    lists = shown
  }

  Timer { interval: 1500; running: true; repeat: false; onTriggered: root.scan() }

  property bool showPills: true
  property var pills: []

  function clearPills() {
    for (var i = 0; i < pills.length; i++) if (pills[i]) pills[i].destroy()
    pills = []
  }

  function build() {
    clearPills()
    if (!showPills) return
    var made = []
    for (var i = 0; i < lists.length; i++) {
      var o = pillComponent.createObject(lists[i].parent, { list: lists[i] })
      if (o) made.push(o)
    }
    pills = made
  }

  onListsChanged: build()
  // Pills live under the bar's own items, not under this widget, so they
  // must be destroyed by hand or they outlive a reload.
  Component.onDestruction: { console.log("omabarspike: destroyed, pills=" + pills.length); clearPills() }
  Component.onCompleted: console.log("omabarspike: created showPills=" + showPills)

  Component {
    id: pillComponent
    Rectangle {
      property var list: null
      readonly property var slots: {
        if (!list) return []
        var dep = list.listRows
        var s = []
        var kids = list.children
        for (var i = 0; i < kids.length; i++) {
          var k = kids[i]
          if (("widgetKey" in k) && k.visible && k.width > 0) s.push(k)
        }
        return s
      }
      readonly property real startX: slots.length ? Math.min.apply(null, slots.map(function (k) { return k.x })) : 0
      readonly property real endX: slots.length ? Math.max.apply(null, slots.map(function (k) { return k.x + k.width })) : 0
      z: -1
      visible: slots.length > 0 && list.visible
      x: list.x + startX - 6
      width: endX - startX + 12
      y: list.y + 3
      height: Math.max(0, list.height - 6)
      radius: height / 2
      color: Qt.rgba(Color.background.r, Color.background.g, Color.background.b, 0.85)
      border.width: 1
      border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.12)
    }
  }
}
