import QtQuick
import qs.Commons
import qs.Commons as Commons

// One bar section on the Groups page drawn as a mini bar: a caption, then the
// section's chips in a wrapping Flow. Spacing is 0 because each GroupChip
// carries its own seam, so the band pieces meet without a gap.
Column {
  id: strip

  property var panel: null
  property string area: ""
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  readonly property var rows: strip.panel && strip.panel.groupRows[strip.area] ? strip.panel.groupRows[strip.area] : []

  spacing: Style.space(4)

  Text {
    textFormat: Text.PlainText
    text: strip.area.toUpperCase()
    color: strip.dim
    font.family: strip.fontFamily
    font.pixelSize: Style.font.caption
  }

  Text {
    visible: strip.rows.length === 0
    textFormat: Text.PlainText
    text: "No widgets"
    color: strip.dim
    font.family: strip.fontFamily
    font.pixelSize: Style.font.caption
  }

  Flow {
    width: strip.width
    spacing: 0
    Repeater {
      model: strip.rows
      GroupChip {
        panel: strip.panel
        area: strip.area
        rows: strip.rows
        foreground: strip.foreground
        dim: strip.dim
        fontFamily: strip.fontFamily
      }
    }
  }
}
