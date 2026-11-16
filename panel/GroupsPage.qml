import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// Groups page: a mini bar per section (GroupStrip) where a click between two icons
// splits or joins a pill, and a detail row (GroupDetail) for the selected widget.
// Rows, cursor and selection live on the panel (panel.groupRows, panel.groupSelected).
Column {
  id: page

  // The Panel root, passed by Panel.qml through setSource.
  property var panel: null

  readonly property var groups: panel && panel.storeData ? panel.storeData.groups : null
  readonly property bool centerParts: !!(page.groups && page.groups.centerParts)
  readonly property bool pillsOn: !!(panel && panel.storeData && panel.storeData.style && panel.storeData.style.enabled)
  readonly property color foreground: panel ? panel.foreground : Commons.Color.foreground
  readonly property color dim: panel ? panel.dim : Qt.darker(Commons.Color.foreground, 1.5)
  readonly property string fontFamily: panel ? panel.fontFamily : Style.font.family

  width: parent ? parent.width : 0
  spacing: Style.space(4)

  Repeater {
    model: [
      { show: !page.pillsOn, text: "Pills are off. Turn them on in Pills to see groups on the bar." },
      { show: true, text: "By default each section is one pill. Click between two icons to split or join." },
      { show: true, text: "Own gives a widget a pill of its own. None draws no pill, for widgets with their own background." },
      { show: true, text: "Keys: arrows move, Space splits or joins, S O N set Shared, Own, None, Ctrl+Up or Down moves the pill." }
    ]

    Text {
      required property var modelData
      visible: modelData.show
      width: page.width
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      text: modelData.text
      color: page.dim
      font.family: page.fontFamily
      font.pixelSize: Style.font.caption
    }
  }

  Item {
    width: parent.width
    height: Math.max(centerLabel.implicitHeight, centerSwitch.implicitHeight)
    Text {
      id: centerLabel
      anchors.left: parent.left
      anchors.right: centerSwitch.left
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      text: "Split the center into three pills"
      color: page.foreground
      font.family: page.fontFamily
      font.pixelSize: Style.font.body
    }
    ToggleSwitch {
      id: centerSwitch
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      enabled: !!page.panel && !page.panel.busy
      opacity: enabled ? 1 : 0.4
      checked: page.centerParts
      foreground: page.foreground
      onToggled: page.panel.setCenterParts(!page.centerParts)
    }
  }

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "The widgets before the clock, the clock group, and the widgets after the clock each get their own pill. Off by default."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Text {
    visible: text !== ""
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: page.panel ? page.panel.layoutError : ""
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Repeater {
    model: ["left", "center", "right"]

    GroupStrip {
      required property string modelData
      panel: page.panel
      area: modelData
      width: page.width
      foreground: page.foreground
      dim: page.dim
      fontFamily: page.fontFamily
    }
  }

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "A widget that is hidden on the bar still shows here."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Rectangle {
    width: parent.width
    height: 1
    color: page.dim
    opacity: 0.4
  }

  GroupDetail {
    width: parent.width
    panel: page.panel
    foreground: page.foreground
    dim: page.dim
    fontFamily: page.fontFamily
  }
}
