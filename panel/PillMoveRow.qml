import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// "Move pill N to Left / Center / Right", shown at a pill's first row on the
// Groups page. The current area is the active chip; a pick calls panel.movePill.
Item {
  id: row

  property var panel: null
  property string area: ""
  property int pill: 0
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  implicitHeight: Math.max(caption.implicitHeight, chips.implicitHeight)

  Text {
    id: caption
    anchors.left: parent.left
    anchors.leftMargin: Style.space(8)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: "Move pill " + row.pill + " to"
    color: row.dim
    font.family: row.fontFamily
    font.pixelSize: Style.font.caption
  }

  ButtonGroup {
    id: chips
    anchors.right: parent.right
    anchors.rightMargin: Style.space(8)
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(4)
    focusable: false
    enabled: !!(row.panel && !row.panel.busy)
    options: [
      { value: "left", label: "Left", tooltip: "Move every widget of this pill to the left section" },
      { value: "center", label: "Center", tooltip: "Move every widget of this pill to the center section" },
      { value: "right", label: "Right", tooltip: "Move every widget of this pill to the right section" }
    ]
    value: row.area
    foreground: row.foreground
    fontFamily: row.fontFamily
    fontSize: Style.font.caption
    onChanged: function(target) { if (target !== row.area) row.panel.movePill(row.area, row.pill, target) }
  }
}
