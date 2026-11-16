import QtQuick
import qs.Commons
import qs.Ui

// The topic switcher: one equal-width chip per spec group, built like the bar
// position row so any number of topics fits the card. Hidden with one topic,
// so a spec-less install looks as before. Clicks go to panel.selectCategory. The last
// button pins the panel open.
Row {
  id: bar

  // The Panel root: categories, currentGroup, selectCategory(), foreground, fontFamily.
  property var panel: null

  readonly property var categories: panel ? panel.categories : []
  readonly property real pinWidth: Style.space(34)
  readonly property real cellWidth:
    (width - pinWidth - spacing * categories.length) / Math.max(1, categories.length)

  visible: true
  spacing: Style.space(6)

  Repeater {
    model: bar.categories

    delegate: Button {
      required property var modelData
      width: bar.cellWidth
      text: String(modelData.title || modelData.id)
      tooltipText: "Tab and Shift+Tab switch topics"
      fontSize: Style.font.bodySmall
      fontFamily: bar.panel.fontFamily
      foreground: bar.panel.foreground
      horizontalPadding: Style.spacing.controlPaddingX
      verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
      bordered: true
      active: bar.panel.currentGroup.id === modelData.id
      onClicked: bar.panel.selectCategory(modelData.id)
    }
  }

  // Keeps the panel open while you test on the bar and in other windows.
  Button {
    width: bar.pinWidth
    text: "󰐃"
    tooltipText: bar.panel && bar.panel.pinned ? "Unpin: close the panel on an outside click again" : "Pin: keep the panel open while you use other windows"
    fontSize: Style.font.bodySmall
    fontFamily: bar.panel.fontFamily
    foreground: bar.panel.foreground
    horizontalPadding: 0
    verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
    bordered: true
    active: !!(bar.panel && bar.panel.pinned)
    onClicked: bar.panel.pinned = !bar.panel.pinned
  }
}
