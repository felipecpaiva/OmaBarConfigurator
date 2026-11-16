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
  readonly property var rows: SettingsSpec.pageRows(page.group, page.showAdvanced, page.values)

  Layout.fillWidth: true
  spacing: Style.space(10)

  Repeater {
    model: page.rows
    delegate: ColumnLayout {
      id: item
      required property var modelData
      Layout.fillWidth: true
      spacing: Style.space(6)

      PanelSectionHeader {
        visible: item.modelData.header !== ""
        text: item.modelData.header
        foreground: page.foreground
        fontFamily: page.fontFamily
        topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
      }
      SettingRow {
        setting: item.modelData.setting
        value: page.values[item.modelData.setting.id]
        rowEnabled: item.modelData.enabled
        reason: item.modelData.reason
        range: SettingsSpec.numberRange(item.modelData.setting, PillStyle.LIMITS)
        foreground: page.foreground
        accent: page.accent
        fontFamily: page.fontFamily
        onChanged: function (v) { page.panel.setSetting(item.modelData.setting, v) }
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
