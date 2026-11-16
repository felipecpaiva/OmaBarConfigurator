import QtQuick
import qs.Commons
import qs.Commons as Commons

// One count and the word it counts, kept together. The stat row sets `width`.
Row {
  id: cell

  property string label: ""
  property string value: ""
  property color foreground: Commons.Color.foreground
  property color valueColor: foreground
  property string fontFamily: Style.font.family

  spacing: Style.space(6)

  Text {
    textFormat: Text.PlainText
    text: cell.label
    color: cell.foreground
    opacity: 0.6
    font.family: cell.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  Text {
    textFormat: Text.PlainText
    text: cell.value
    color: cell.valueColor
    font.family: cell.fontFamily
    font.pixelSize: Style.font.bodySmall
  }
}
