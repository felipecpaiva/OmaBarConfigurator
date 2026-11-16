import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/SettingsSpec.js" as SettingsSpec
import "../lib/PillStyle.js" as PillStyle

// A spec group drawn as rows under subgroup headers. All data comes from the
// spec; values and writes go through the Panel root.
ColumnLayout {
  id: page

  property var panel: null
  property var group: ({})
  property bool showAdvanced: false
  property color foreground: Commons.Color.foreground
  property color accent: Commons.Color.accent
  property string fontFamily: Style.font.family

  // Rebinds whenever the panel's values change, because settingValue reads them.
  readonly property var values: {
    var v = {}
    var list = (page.group && page.group.settings) || []
    for (var i = 0; i < list.length; i++) v[list[i].id] = page.panel ? page.panel.settingValue(list[i]) : null
    return v
  }
  // Stable until the group or the advanced switch changes, so a write never rebuilds the rows.
  readonly property var settings: SettingsSpec.visibleSettings(page.group, page.showAdvanced)
  readonly property var labels: SettingsSpec.labelsOf(page.group)

  // The page sits in the panel's Flickable; a slider hands wheel turns here.
  function scrollBy(dy) {
    var p = page.parent
    while (p && !(p as Flickable)) p = p.parent
    var f = p as Flickable
    if (f) f.contentY = Math.max(0, Math.min(f.contentHeight - f.height, f.contentY - dy))
  }

  Layout.fillWidth: true
  spacing: Style.space(10)

  Repeater {
    model: page.settings
    delegate: ColumnLayout {
      id: item
      required property var modelData
      required property int index
      readonly property var state: SettingsSpec.rowState(modelData, page.values, page.labels)
      readonly property string header: SettingsSpec.subgroupHeader(page.settings, index)
      Layout.fillWidth: true
      spacing: Style.space(6)

      PanelSectionHeader {
        visible: item.header !== ""
        text: item.header
        foreground: page.foreground
        fontFamily: page.fontFamily
        topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
      }
      SettingRow {
        setting: item.modelData
        value: page.values[item.modelData.id]
        rowEnabled: item.state.enabled
        reason: item.state.reason
        range: SettingsSpec.numberRange(item.modelData, PillStyle.LIMITS)
        foreground: page.foreground
        accent: page.accent
        fontFamily: page.fontFamily
        onChanged: function (v) { page.panel.setSetting(item.modelData, v) }
        onScrolled: function (dy) { page.scrollBy(dy) }
      }
    }
  }

  RowLayout {
    visible: SettingsSpec.hasAdvanced(page.group)
    Layout.fillWidth: true
    Layout.topMargin: Style.space(8)
    Text {
      Layout.fillWidth: true
      textFormat: Text.PlainText
      text: "Show advanced"
      color: page.foreground
      font.family: page.fontFamily
      font.pixelSize: Style.font.body
    }
    ToggleSwitch {
      checked: page.showAdvanced
      foreground: page.foreground
      accent: page.accent
      onToggled: page.showAdvanced = !page.showAdvanced
    }
  }
}
