import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import QtQml

// One saved layout on the Layout page: an editable name, the time, then Apply and Delete.
// `entry` is a PillStyle.cleanSaved item; actions go through the Panel root.
Item {
  id: row

  property var panel: null
  property var entry: ({})
  property color foreground: Commons.Color.foreground
  property color dim: Qt.darker(Commons.Color.foreground, 1.5)
  property string fontFamily: Style.font.family

  readonly property bool ready: !!row.panel && !row.panel.busy
  readonly property string when: row.entry.at ? Qt.formatDateTime(new Date(row.entry.at), "d MMM, hh:mm") : ""

  implicitHeight: Math.max(label.implicitHeight, applyButton.implicitHeight)

  // The name is a field: click it, type a label, press Enter. Blank names are ignored.
  TextField {
    id: label
    anchors.left: parent.left
    anchors.right: when.left
    anchors.rightMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    enabled: row.ready
    maximumLength: 40
    foreground: row.foreground
    onEditingFinished: if (text.trim() !== "" && text.trim() !== row.entry.name) row.panel.renameSavedLayout(row.entry.id, text)
  }

  // A plain `text:` binding breaks once the user types; Binding re-applies it on a rename.
  Binding {
    target: label
    property: "text"
    value: row.entry.name
    restoreMode: Binding.RestoreNone
  }

  Text {
    id: when
    anchors.right: applyButton.left
    anchors.rightMargin: Style.space(8)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: row.when
    color: row.dim
    font.family: row.fontFamily
    font.pixelSize: Style.font.caption
  }

  Button {
    id: applyButton
    anchors.right: deleteButton.left
    anchors.rightMargin: Style.space(6)
    anchors.verticalCenter: parent.verticalCenter
    text: "Apply"
    tooltipText: "Put the bar, its pills and their look back as saved"
    fontSize: Style.font.bodySmall
    fontFamily: row.fontFamily
    foreground: row.foreground
    bordered: true
    enabled: row.ready
    opacity: enabled ? 1 : 0.4
    onClicked: row.panel.applySavedLayout(row.entry.id)
  }

  Button {
    id: deleteButton
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    text: "Delete"
    tooltipText: "Remove this saved layout. The bar does not change."
    fontSize: Style.font.bodySmall
    fontFamily: row.fontFamily
    foreground: row.foreground
    bordered: true
    enabled: row.ready
    opacity: enabled ? 1 : 0.4
    onClicked: row.panel.deleteSavedLayout(row.entry.id)
  }
}
