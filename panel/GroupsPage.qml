import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/Groups.js" as Groups
import "../Model.js" as Model

// Groups page: per area, the widgets in bar order, the pill each one sits in,
// and a switch to start a new pill at that widget. Logic lives in lib/Groups.js.
Column {
  id: page

  // The Panel root: storeData, liveLayout, writeBreaks(), widgetName(), widgetGlyph(),
  // widgetGlyphFamily(), foreground, dim, fontFamily, selectedFill.
  property var panel: null

  readonly property var breaks: panel && panel.storeData && panel.storeData.groups ? panel.storeData.groups.breaks : null
  readonly property bool pillsOn: !!(panel && panel.storeData && panel.storeData.style && panel.storeData.style.enabled)
  readonly property string selfId: Model.SELF_ID
  readonly property var areaRows: Groups.rows(panel ? panel.liveLayout : null, breaks, page.selfId)
  readonly property var areas: [
    { key: "left", title: "LEFT" },
    { key: "center", title: "CENTER" },
    { key: "right", title: "RIGHT" }
  ]
  readonly property color foreground: panel ? panel.foreground : Commons.Color.foreground
  readonly property color dim: panel ? panel.dim : Qt.darker(Commons.Color.foreground, 1.5)
  readonly property string fontFamily: panel ? panel.fontFamily : Style.font.family

  width: parent ? parent.width : 0
  spacing: Style.space(4)

  Text {
    visible: !page.pillsOn
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "Pills are off. Turn them on in Pills to see groups on the bar."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "By default each section is one pill. Split it where you want."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "A widget that is hidden on the bar cannot start a pill."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  Repeater {
    model: page.areas

    Column {
      id: section
      required property var modelData
      readonly property var widgets: page.areaRows[modelData.key]
      width: page.width
      spacing: Style.space(2)

      PanelSectionHeader {
        text: section.modelData.title
        topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
        foreground: page.foreground
        fontFamily: page.fontFamily
      }

      Repeater {
        model: section.widgets

        Rectangle {
          id: band
          required property var modelData
          width: section.width
          height: Style.space(32)
          radius: Style.space(6)
          color: modelData.pill % 2 === 0 ? page.panel.selectedFill : "transparent"

          Rectangle {
            id: chip
            anchors.left: parent.left
            anchors.leftMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            width: Style.space(20)
            height: width
            radius: width / 2
            color: "transparent"
            border.width: 1
            border.color: page.dim
            Text {
              anchors.centerIn: parent
              textFormat: Text.PlainText
              text: String(band.modelData.pill)
              color: page.foreground
              font.family: page.fontFamily
              font.pixelSize: Style.font.caption
            }
          }

          Text {
            id: glyph
            anchors.left: chip.right
            anchors.leftMargin: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            width: Style.space(20)
            horizontalAlignment: Text.AlignHCenter
            textFormat: Text.PlainText
            text: page.panel.widgetGlyph(band.modelData.id)
            color: page.foreground
            font.family: page.panel.widgetGlyphFamily(band.modelData.id)
            font.pixelSize: Style.font.title
          }

          Text {
            anchors.left: glyph.right
            anchors.leftMargin: Style.space(8)
            anchors.right: band.modelData.first ? parent.right : label.left
            anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            elide: Text.ElideRight
            text: page.panel.widgetName(band.modelData.id)
            color: page.foreground
            font.family: page.fontFamily
            font.pixelSize: Style.font.body
          }

          Text {
            id: label
            visible: !band.modelData.first
            anchors.right: startSwitch.left
            anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: band.modelData.repeat ? "Same widget appears earlier; split there" : "New pill starts here"
            color: page.dim
            font.family: page.fontFamily
            font.pixelSize: Style.font.caption
          }

          ToggleSwitch {
            id: startSwitch
            visible: !band.modelData.first
            anchors.right: parent.right
            anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            enabled: !band.modelData.repeat
            opacity: enabled ? 1 : 0.4
            checked: band.modelData.startsPill
            foreground: page.foreground
            onToggled: page.panel.toggleBreak(section.modelData.key, band.modelData.id)
          }
        }
      }
    }
  }
}
