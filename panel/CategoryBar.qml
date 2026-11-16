import QtQuick
import qs.Commons
import qs.Ui

// The topic switcher: one equal-width chip per spec group, built like the bar
// position row so any number of topics fits the card. Hidden with one topic,
// so a spec-less install looks as before. Clicks go to panel.selectCategory.
Row {
  id: bar

  // The Panel root: categories, currentGroup, selectCategory(), foreground, fontFamily.
  property var panel: null

  readonly property var categories: panel ? panel.categories : []
  readonly property real cellWidth:
    (width - spacing * Math.max(0, categories.length - 1)) / Math.max(1, categories.length)

  visible: categories.length > 1
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
}
