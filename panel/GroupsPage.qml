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
  // widgetGlyphFamily(), movePill(), busy, foreground, dim, fontFamily, selectedFill.
  property var panel: null

  readonly property var breaks: panel && panel.storeData && panel.storeData.groups ? panel.storeData.groups.breaks : null
  readonly property var rules: {
    var g = panel && panel.storeData ? panel.storeData.groups : null
    return { solo: g ? g.solo : [], noPill: g ? g.noPill : [], centerParts: !!(g && g.centerParts) }
  }
  readonly property bool pillsOn: !!(panel && panel.storeData && panel.storeData.style && panel.storeData.style.enabled)
  readonly property string selfId: Model.SELF_ID
  readonly property var areaRows: Groups.rows(panel ? panel.liveLayout : null, breaks, page.selfId, rules)
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

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "Own gives a widget a pill of its own, for example the workspaces. None draws no pill behind it, for widgets that paint their own background."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
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
      checked: page.rules.centerParts
      foreground: page.foreground
      onToggled: page.panel.setCenterParts(!page.rules.centerParts)
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

        Column {
          id: entry
          required property var modelData
          width: section.width
          spacing: Style.space(2)

          PillMoveRow {
            visible: entry.modelData.startsPill
            width: parent.width
            panel: page.panel
            area: section.modelData.key
            pill: entry.modelData.pill
            foreground: page.foreground
            dim: page.dim
            fontFamily: page.fontFamily
          }

          GroupRow {
            width: parent.width
            panel: page.panel
            area: section.modelData.key
            row: entry.modelData
            foreground: page.foreground
            dim: page.dim
            fontFamily: page.fontFamily
          }
        }
      }
    }
  }
}
