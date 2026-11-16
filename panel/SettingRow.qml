import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/SettingsSpec.js" as SettingsSpec

// One setting drawn from its spec entry. Holds no store logic: the page passes
// the current value in and takes the new one from `changed`.
ColumnLayout {
  id: row

  property var setting: ({})
  property var value: null
  property bool rowEnabled: true
  property string reason: ""
  property var range: ({ min: 0, max: 1, step: 1 })
  property color foreground: Commons.Color.foreground
  property color accent: Commons.Color.accent
  property string fontFamily: Style.font.family

  signal changed(var newValue)

  readonly property color dim: Qt.darker(foreground, 1.6)
  readonly property bool isHexValue: SettingsSpec.isHex(row.value)

  Layout.fillWidth: true
  spacing: Style.space(4)
  opacity: row.rowEnabled ? 1 : 0.5

  RowLayout {
    Layout.fillWidth: true
    Text {
      Layout.fillWidth: true
      textFormat: Text.PlainText
      text: row.setting.label || ""
      color: row.foreground
      font.family: row.fontFamily
      font.pixelSize: Style.font.body
      font.bold: true
      elide: Text.ElideRight
    }
    ToggleSwitch {
      visible: row.setting.type === "toggle"
      checked: row.value === true
      interactive: row.rowEnabled
      foreground: row.foreground
      accent: row.accent
      onToggled: row.changed(!(row.value === true))
    }
    Text {
      visible: row.setting.type === "number"
      textFormat: Text.PlainText
      text: row.value + (row.setting.unit ? " " + row.setting.unit : "")
      color: row.dim
      font.family: row.fontFamily
      font.pixelSize: Style.font.caption
    }
  }

  PanelSlider {
    visible: row.setting.type === "number"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    value: typeof row.value === "number" ? row.value : row.range.min
    minimum: row.range.min
    maximum: row.range.max
    step: row.range.step
    onReleased: function (v) { row.changed(v) }
  }

  ButtonGroup {
    visible: row.setting.type === "choice" || row.setting.type === "color"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    options: SettingsSpec.choiceOptions(row.setting)
    value: row.isHexValue ? "" : String(row.value)
    foreground: row.foreground
    accent: row.accent
    fontFamily: row.fontFamily
    onChanged: function (v) { row.changed(v) }
  }

  TextField {
    visible: row.setting.type === "color"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    placeholderText: "#rrggbb"
    text: row.isHexValue ? String(row.value) : ""
    validator: RegularExpressionValidator { regularExpression: /^#[0-9a-fA-F]{0,6}$/ }
    foreground: row.foreground
    accent: row.accent
    onEditingFinished: if (SettingsSpec.isHex(text) && text !== row.value) row.changed(text.toLowerCase())
  }

  Text {
    visible: !!row.setting.help
    Layout.fillWidth: true
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: row.setting.help || ""
    color: row.dim
    font.family: row.fontFamily
    font.pixelSize: Style.font.caption
  }

  Text {
    visible: !row.rowEnabled && row.reason !== ""
    Layout.fillWidth: true
    textFormat: Text.PlainText
    wrapMode: Text.WordWrap
    text: row.reason
    color: row.dim
    font.family: row.fontFamily
    font.pixelSize: Style.font.caption
    font.italic: true
  }
}
