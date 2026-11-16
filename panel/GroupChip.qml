import QtQuick
import QtQuick.Shapes
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/Groups.js" as Groups

// One widget in a GroupStrip: the glyph chip, its piece of the pill band, and the
// seam after it when a next row exists. Every width stays inside this item so the
// strip's Flow can keep spacing 0 and the band pieces meet edge to edge.
Item {
  id: chip

  required property var modelData
  required property int index
  property var panel: null
  property string area: ""
  property var rows: []
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  readonly property var row: chip.modelData
  readonly property bool hasNext: chip.index < chip.rows.length - 1
  readonly property var seam: chip.hasNext ? Groups.seam(chip.rows, chip.index + 1) : ({ state: "off", reason: "", cause: -1 })
  readonly property real chipSize: Style.space(24)
  readonly property real seamWidth: chip.hasNext ? Style.space(12) : 0
  readonly property real radius: chip.height / 2
  readonly property var cursor: chip.panel ? chip.panel.groupCursor : null
  readonly property bool cursorHere: !!chip.cursor && chip.cursor.area === chip.area && chip.cursor.index === chip.index && chip.cursor.kind === "chip"
  readonly property bool cursorOnSeam: !!chip.cursor && chip.cursor.area === chip.area && chip.cursor.index === chip.index + 1 && chip.cursor.kind === "seam"
  readonly property var selected: chip.panel ? chip.panel.groupSelected : null
  readonly property bool isSelected: !!chip.selected && chip.selected.area === chip.area && chip.selected.index === chip.index
  readonly property bool busy: !!chip.panel && chip.panel.busy
  readonly property string name: chip.panel ? chip.panel.widgetName(chip.row.id) : ""
  readonly property string nextName: chip.panel && chip.hasNext ? chip.panel.widgetName(chip.rows[chip.index + 1].id) : ""
  readonly property bool fallback: !!chip.panel && chip.panel.widgetGlyph(chip.row.id) === chip.panel.fallbackGlyph
  readonly property string seamTip: {
    var s = chip.seam
    if (s.state === "join") return "Split here"
    if (s.state === "split") return "Join"
    if (s.reason === "centerPart") return "The center is split into three"
    if (s.reason === "repeat") return "Same widget appears earlier"
    var who = s.cause >= 0 && chip.panel ? chip.panel.widgetName(chip.rows[s.cause].id) : ""
    return s.reason === "own" ? who + " is Own" : s.reason === "none" ? who + " has no pill" : ""
  }

  width: chip.chipSize + chip.seamWidth
  height: Style.space(28)

  // The band piece. The clip cuts the rounded rectangle flat on a side that
  // continues into the next or previous chip; one fill keeps the alpha even.
  Item {
    visible: chip.row.pill > 0
    clip: true
    width: chip.chipSize + (chip.row.endsPill ? 0 : chip.seamWidth)
    height: parent.height
    Rectangle {
      x: chip.row.startsPill ? 0 : -chip.radius
      width: parent.width - x + (chip.row.endsPill ? 0 : chip.radius)
      height: parent.height
      radius: chip.radius
      color: Qt.rgba(chip.foreground.r, chip.foreground.g, chip.foreground.b, 0.10)
    }
  }

  // None: no band, a dashed outline instead, so the mode never rests on color.
  Shape {
    visible: chip.row.mode === "none"
    width: chip.chipSize
    height: parent.height
    ShapePath {
      strokeColor: chip.dim
      strokeWidth: 1
      strokeStyle: ShapePath.DashLine
      dashPattern: [2, 2]
      fillColor: "transparent"
      startX: 0.5; startY: 0.5
      PathLine { x: chip.chipSize - 0.5; y: 0.5 }
      PathLine { x: chip.chipSize - 0.5; y: chip.height - 0.5 }
      PathLine { x: 0.5; y: chip.height - 0.5 }
      PathLine { x: 0.5; y: 0.5 }
    }
  }

  Rectangle {
    id: face
    width: chip.chipSize
    height: chip.chipSize
    anchors.verticalCenter: parent.verticalCenter
    radius: width / 2
    color: chip.isSelected && chip.panel ? chip.panel.selectedFill : "transparent"
    border.width: chip.cursorHere ? 2 : 0
    border.color: Commons.Color.accent
    opacity: chip.busy ? 0.6 : 1

    Text {
      anchors.centerIn: parent
      textFormat: Text.PlainText
      // A widget without its own glyph shows its first two letters instead.
      text: chip.fallback ? chip.name.slice(0, 2) : (chip.panel ? chip.panel.widgetGlyph(chip.row.id) : "")
      color: chip.foreground
      font.family: chip.fallback || !chip.panel ? chip.fontFamily : chip.panel.widgetGlyphFamily(chip.row.id)
      font.pixelSize: chip.fallback ? Style.font.caption : Style.font.body
    }

    MouseArea {
      id: faceMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: chip.busy ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (!chip.busy && chip.panel) chip.panel.selectGroupChip(chip.area, chip.index)
    }
    PanelToolTip {
      visible: faceMouse.containsMouse
      text: chip.name
      fontFamily: chip.fontFamily
    }
    Accessible.role: Accessible.Button
    Accessible.name: chip.name
  }

  Item {
    id: seamItem
    visible: chip.hasNext
    x: chip.chipSize
    width: chip.seamWidth
    height: parent.height
    opacity: chip.busy ? 0.4 : 1
    readonly property bool strong: chip.cursorOnSeam || seamMouse.containsMouse
    readonly property string word: ({ split: "split", join: "joined", locked: "locked", off: "cannot split" })[chip.seam.state]

    // Split: a 2 px line in the gap. Join: a faint 1 px line, full on hover or cursor.
    Rectangle {
      visible: chip.seam.state === "split" || chip.seam.state === "join"
      anchors.centerIn: parent
      width: chip.seam.state === "split" || seamItem.strong ? 2 : 1
      height: parent.height * 0.6
      color: seamItem.strong ? chip.foreground : chip.dim
      opacity: chip.seam.state === "join" && !seamItem.strong ? 0.35 : 1
    }
    // Locked: a dotted line, so a forced split reads apart from a chosen one.
    Column {
      visible: chip.seam.state === "locked"
      anchors.centerIn: parent
      spacing: 2
      Repeater {
        model: 4
        Rectangle { width: 2; height: 2; radius: 1; color: seamItem.strong ? chip.foreground : chip.dim }
      }
    }
    Rectangle {
      visible: chip.cursorOnSeam
      anchors.fill: parent
      radius: Style.space(4)
      color: "transparent"
      border.width: 2
      border.color: Commons.Color.accent
    }
    MouseArea {
      id: seamMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: chip.seam.state === "off" || chip.busy ? Qt.ArrowCursor : Qt.PointingHandCursor
      onClicked: if (chip.seam.state !== "off" && !chip.busy && chip.panel) chip.panel.clickGroupSeam(chip.area, chip.index + 1)
    }
    PanelToolTip {
      visible: seamMouse.containsMouse && chip.seamTip !== ""
      text: chip.seamTip
      fontFamily: chip.fontFamily
    }
    Accessible.role: Accessible.Button
    Accessible.name: "Seam between " + chip.name + " and " + chip.nextName + ", " + seamItem.word
  }
}
