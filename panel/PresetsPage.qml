import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/Presets.js" as Presets

// Layout page: one card per preset, saved layouts, then the one Undo. Every action goes
// through the Panel root (applyPreset, undoLayout); logic lives in lib/Presets.js.
Column {
  id: page

  // The Panel root: applyPreset(), undoLayout(), canUndo, undoLabel, undoAt,
  // layoutError, busy, foreground, dim, fontFamily.
  property var panel: null

  readonly property color foreground: panel ? panel.foreground : Commons.Color.foreground
  readonly property color dim: panel ? panel.dim : Qt.darker(Commons.Color.foreground, 1.5)
  readonly property string fontFamily: panel ? panel.fontFamily : Style.font.family
  readonly property bool busy: !!(panel && panel.busy)
  readonly property bool canUndo: !!(panel && panel.canUndo)
  readonly property string undoWhen: panel && panel.undoAt !== ""
    ? Qt.formatDateTime(new Date(panel.undoAt), "d MMM, hh:mm") : ""
  readonly property string undoText: page.canUndo
    ? panel.undoLabel + (page.undoWhen !== "" ? ", " + page.undoWhen : "")
    : "Nothing to undo yet. Applying a preset, a saved layout or moving a pill makes Undo available."

  width: parent ? parent.width : 0
  spacing: Style.space(6)

  Text {
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: "Presets move widgets with Omarchy's own commands. Undo puts them back exactly."
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }

  PanelSectionHeader {
    text: "PRESETS"
    topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
    foreground: page.foreground
    fontFamily: page.fontFamily
  }

  Repeater {
    model: Presets.PRESETS

    Rectangle {
      id: card
      required property var modelData
      width: page.width
      height: cardBody.implicitHeight + Style.space(20)
      radius: Style.space(8)
      color: "transparent"
      border.width: 1
      border.color: page.dim

      Column {
        id: cardBody
        anchors.left: parent.left
        anchors.right: applyButton.left
        anchors.verticalCenter: parent.verticalCenter
        anchors.leftMargin: Style.space(12)
        anchors.rightMargin: Style.space(10)
        spacing: Style.space(2)

        Text {
          width: parent.width
          textFormat: Text.PlainText
          elide: Text.ElideRight
          text: String(card.modelData.label)
          color: page.foreground
          font.family: page.fontFamily
          font.pixelSize: Style.font.body
        }
        Text {
          width: parent.width
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
          text: String(card.modelData.help)
          color: page.dim
          font.family: page.fontFamily
          font.pixelSize: Style.font.caption
        }
      }

      Button {
        id: applyButton
        anchors.right: parent.right
        anchors.rightMargin: Style.space(10)
        anchors.verticalCenter: parent.verticalCenter
        text: "Apply"
        tooltipText: "Move the widgets to match " + card.modelData.label
        fontSize: Style.font.bodySmall
        fontFamily: page.fontFamily
        foreground: page.foreground
        bordered: true
        enabled: !page.busy
        opacity: enabled ? 1 : 0.4
        onClicked: page.panel.applyPreset(card.modelData.id)
      }
    }
  }

  PanelSectionHeader {
    text: "SAVED LAYOUTS"
    topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
    foreground: page.foreground
    fontFamily: page.fontFamily
  }

  Item {
    width: parent.width
    height: Math.max(saveLine.implicitHeight, saveButton.implicitHeight)

    Text {
      id: saveLine
      anchors.left: parent.left
      anchors.right: saveButton.left
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      text: "Save the bar as it is now, then experiment. Apply brings it all back: widgets, pills and their look."
      color: page.dim
      font.family: page.fontFamily
      font.pixelSize: Style.font.caption
    }

    Button {
      id: saveButton
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      text: "Save current"
      tooltipText: "Save the widgets, pills and their look as they are now"
      fontSize: Style.font.bodySmall
      fontFamily: page.fontFamily
      foreground: page.foreground
      bordered: true
      enabled: !page.busy
      opacity: enabled ? 1 : 0.4
      onClicked: page.panel.saveCurrentLayout()
    }
  }

  Repeater {
    model: page.panel ? page.panel.savedLayouts : []

    SavedLayoutRow {
      required property var modelData
      width: page.width
      panel: page.panel
      entry: modelData
      foreground: page.foreground
      dim: page.dim
      fontFamily: page.fontFamily
    }
  }

  PanelSectionHeader {
    text: "UNDO"
    topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
    foreground: page.foreground
    fontFamily: page.fontFamily
  }

  Item {
    width: parent.width
    height: Math.max(undoLine.implicitHeight, undoButton.implicitHeight)

    Text {
      id: undoLine
      anchors.left: parent.left
      anchors.right: undoButton.left
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      text: page.undoText
      color: page.canUndo ? page.foreground : page.dim
      font.family: page.fontFamily
      font.pixelSize: Style.font.bodySmall
    }

    Button {
      id: undoButton
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      text: "Undo"
      tooltipText: page.canUndo ? "Put the widgets back where they were" : "Nothing to undo"
      fontSize: Style.font.bodySmall
      fontFamily: page.fontFamily
      foreground: page.foreground
      bordered: true
      enabled: page.canUndo && !page.busy
      opacity: enabled ? 1 : 0.4
      onClicked: page.panel.undoLayout()
    }
  }

  Text {
    visible: text !== ""
    width: parent.width
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: page.busy ? "Applying changes." : (page.panel ? page.panel.layoutError : "")
    color: page.dim
    font.family: page.fontFamily
    font.pixelSize: Style.font.caption
  }
}
