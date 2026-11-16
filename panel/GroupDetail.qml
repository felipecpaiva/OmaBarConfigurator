import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// The selected widget on the Groups page: its name, its Shared / Own / None choice,
// and where its pill sits. Reads panel.groupSelected; writes go through the panel.
Column {
  id: detail

  property var panel: null
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  readonly property var sel: detail.panel ? detail.panel.groupSelected : null
  // The selection can briefly point past the rows while they rebuild, so guard the lookup.
  readonly property var row: {
    var list = detail.sel && detail.panel.groupRows ? detail.panel.groupRows[detail.sel.area] : null
    return list && list[detail.sel.index] ? list[detail.sel.index] : null
  }
  readonly property string name: detail.row ? detail.panel.widgetName(detail.row.id) : ""
  readonly property string rawGlyph: detail.row ? detail.panel.widgetGlyph(detail.row.id) : ""
  // A widget without its own glyph shows the first two letters of its name instead.
  readonly property bool lettered: !!detail.row && detail.rawGlyph === detail.panel.fallbackGlyph
  readonly property string glyph: detail.lettered ? detail.name.slice(0, 2) : detail.rawGlyph

  spacing: Style.space(4)

  Text {
    visible: !detail.row
    width: parent.width
    textFormat: Text.PlainText
    text: "Click an icon to see its options."
    color: detail.dim
    font.family: detail.fontFamily
    font.pixelSize: Style.font.caption
  }

  Item {
    visible: !!detail.row
    width: parent.width
    height: Math.max(Style.space(28), modes.implicitHeight)

    Text {
      id: glyphText
      anchors.left: parent.left
      anchors.leftMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      width: Style.space(20)
      horizontalAlignment: Text.AlignHCenter
      textFormat: Text.PlainText
      text: detail.glyph
      color: detail.foreground
      font.family: detail.row && !detail.lettered ? detail.panel.widgetGlyphFamily(detail.row.id) : detail.fontFamily
      font.pixelSize: detail.lettered ? Style.font.caption : Style.font.title
    }

    Text {
      anchors.left: glyphText.right
      anchors.leftMargin: Style.space(8)
      anchors.right: modes.left
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      elide: Text.ElideRight
      text: detail.name
      color: detail.foreground
      font.family: detail.fontFamily
      font.pixelSize: Style.font.body
    }

    ButtonGroup {
      id: modes
      anchors.right: parent.right
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(4)
      focusable: false
      enabled: !!detail.panel && !detail.panel.busy
      opacity: enabled ? 1 : 0.4
      options: [
        { value: "shared", label: "Shared", tooltip: "Share a pill with the widgets next to it" },
        { value: "solo", label: "Own", tooltip: "Give this widget a pill of its own" },
        { value: "none", label: "None", tooltip: "Draw no pill behind this widget" }
      ]
      value: detail.row ? detail.row.mode : ""
      foreground: detail.foreground
      fontFamily: detail.fontFamily
      fontSize: Style.font.caption
      onChanged: function(target) { if (detail.row && target !== detail.row.mode) detail.panel.setWidgetPillMode(detail.row.id, target) }
    }
  }

  PillMoveRow {
    visible: !!detail.row && detail.row.pill > 0
    width: parent.width
    panel: detail.panel
    area: detail.sel ? detail.sel.area : ""
    pill: detail.row ? detail.row.pill : 0
    foreground: detail.foreground
    dim: detail.dim
    fontFamily: detail.fontFamily
  }

  Text {
    visible: !!detail.row && detail.row.pill === 0
    width: parent.width
    leftPadding: Style.space(8)
    textFormat: Text.PlainText
    text: "No pill, so nothing to move."
    color: detail.dim
    font.family: detail.fontFamily
    font.pixelSize: Style.font.caption
  }
}
