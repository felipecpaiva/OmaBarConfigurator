import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// One widget on the Groups page: pill number, glyph, name, a Shared / Own / None
// choice, and (shared rows that are not first) the "new pill starts here" switch.
// `row` is a Groups.rows entry. Writes go through panel.setWidgetPillMode and panel.toggleBreak.
Rectangle {
  id: band

  property var panel: null
  property string area: ""
  property var row: ({})
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  readonly property bool shared: band.row.mode === "shared"
  readonly property bool showSwitch: band.shared && !band.row.first
  readonly property bool ready: !!band.panel && !band.panel.busy

  readonly property bool forced: !!band.row.forced
  readonly property var reasons: ({
    none: "Starts a pill because the widget before it has no pill",
    own: "Starts a pill because the widget before it is Own",
    centerPart: "Starts a pill because the center is split"
  })
  readonly property string switchText: band.forced ? (band.reasons[band.row.forcedBy] || "Starts a pill by a rule")
    : (band.row.repeat ? "Same widget appears earlier; split there" : "New pill starts here")
  // The switch band follows the switch's own height, so it never overhangs.
  readonly property real bandHeight: band.showSwitch ? Math.max(startSwitch.implicitHeight, switchLabel.implicitHeight) + Style.space(4) : 0

  height: Style.space(32) + band.bandHeight
  radius: Style.space(6)
  color: band.row.pill > 0 && band.row.pill % 2 === 0 && band.panel ? band.panel.selectedFill : "transparent"

  Rectangle {
    id: chip
    anchors.left: parent.left
    anchors.leftMargin: Style.space(8)
    y: (Style.space(32) - height) / 2
    width: Style.space(20)
    height: width
    radius: width / 2
    color: "transparent"
    border.width: band.row.pill > 0 ? 1 : 0
    border.color: band.dim
    Text {
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: band.row.pill > 0 ? String(band.row.pill) : ""
      color: band.foreground
      font.family: band.fontFamily
      font.pixelSize: Style.font.caption
    }
  }

  Text {
    id: glyph
    anchors.left: chip.right
    anchors.leftMargin: Style.space(10)
    y: (Style.space(32) - height) / 2
    width: Style.space(20)
    horizontalAlignment: Text.AlignHCenter
    textFormat: Text.PlainText
    text: band.panel ? band.panel.widgetGlyph(band.row.id) : ""
    color: band.foreground
    font.family: band.panel ? band.panel.widgetGlyphFamily(band.row.id) : band.fontFamily
    font.pixelSize: Style.font.title
  }

  Text {
    anchors.left: glyph.right
    anchors.leftMargin: Style.space(8)
    anchors.right: modes.left
    anchors.rightMargin: Style.space(8)
    y: (Style.space(32) - height) / 2
    textFormat: Text.PlainText
    elide: Text.ElideRight
    text: band.panel ? band.panel.widgetName(band.row.id) : ""
    color: band.foreground
    font.family: band.fontFamily
    font.pixelSize: Style.font.body
  }

  ButtonGroup {
    id: modes
    anchors.right: parent.right
    anchors.rightMargin: Style.space(8)
    y: (Style.space(32) - height) / 2
    spacing: Style.space(4)
    focusable: false
    enabled: band.ready
    opacity: enabled ? 1 : 0.4
    options: [
      { value: "shared", label: "Shared", tooltip: "Share a pill with the widgets next to it" },
      { value: "solo", label: "Own", tooltip: "Give this widget a pill of its own" },
      { value: "none", label: "None", tooltip: "Draw no pill behind this widget" }
    ]
    value: band.row.mode
    foreground: band.foreground
    fontFamily: band.fontFamily
    fontSize: Style.font.caption
    onChanged: function(target) { if (target !== band.row.mode) band.panel.setWidgetPillMode(band.row.id, target) }
  }

  Text {
    id: switchLabel
    visible: band.showSwitch
    anchors.left: parent.left
    anchors.leftMargin: Style.space(38)
    anchors.right: startSwitch.left
    anchors.rightMargin: Style.space(8)
    y: Style.space(32) + (band.bandHeight - height) / 2
    horizontalAlignment: Text.AlignRight
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: band.switchText
    color: band.dim
    opacity: band.forced ? 0.7 : 1
    font.family: band.fontFamily
    font.pixelSize: Style.font.caption
  }

  ToggleSwitch {
    id: startSwitch
    visible: band.showSwitch
    anchors.right: parent.right
    anchors.rightMargin: Style.space(8)
    y: Style.space(32) + (band.bandHeight - height) / 2
    enabled: !band.row.repeat && !band.forced && band.ready
    opacity: enabled ? 1 : 0.4
    checked: band.row.startsPill
    foreground: band.foreground
    onToggled: band.panel.toggleBreak(band.area, band.row.id)
  }
}
