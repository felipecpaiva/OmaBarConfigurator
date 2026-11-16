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
  // The wheel moved over a slider; the page scrolls instead of the slider.
  signal scrolled(real dy)

  readonly property color dim: Qt.darker(foreground, 1.6)
  readonly property bool isSlider: row.setting.type === "number" && SettingsSpec.control(row.setting) === "slider"
  readonly property bool isField: row.setting.type === "number" && SettingsSpec.control(row.setting) === "field"
  // The two properties PanelSlider reads from its `bar`.
  readonly property QtObject sliderColors: QtObject {
    readonly property color foreground: row.foreground
    readonly property color background: Commons.Color.background
  }
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
      visible: row.isSlider
      textFormat: Text.PlainText
      text: SettingsSpec.formatValue(slider.liveValue, row.range.step, row.setting.unit)
      color: row.dim
      font.family: row.fontFamily
      font.pixelSize: Style.font.caption
    }
  }

  PanelSlider {
    id: slider
    visible: row.isSlider
    Layout.fillWidth: true
    enabled: row.rowEnabled
    bar: row.sliderColors
    trackColor: Style.selectedFillFor(row.foreground, row.accent)
    value: typeof row.value === "number" ? row.value : row.range.min
    minimum: row.range.min
    maximum: row.range.max
    step: row.range.step
    integer: row.range.step >= 1
    onReleased: function (v) { row.changed(SettingsSpec.snap(v, row.range.step)) }

    // Sits above the stock wheel handler so the wheel never edits the value.
    // No buttons, so presses and drags still reach the slider below.
    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.NoButton
      onWheel: function (wheel) { wheel.accepted = true; row.scrolled(wheel.angleDelta.y) }
    }
  }

  NumberField {
    visible: row.isField
    enabled: row.rowEnabled
    value: typeof row.value === "number" ? row.value : row.range.min
    from: row.range.min
    to: row.range.max
    foreground: row.foreground
    accent: row.accent
    fontFamily: row.fontFamily
    onModified: function (v) { row.changed(v) }
  }

  ButtonGroup {
    visible: row.setting.type === "choice"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    options: SettingsSpec.choiceOptions(row.setting)
    value: String(row.value)
    foreground: row.foreground
    accent: row.accent
    fontFamily: row.fontFamily
    onChanged: function (v) { row.changed(v) }
  }

  Dropdown {
    visible: row.setting.type === "color"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    options: SettingsSpec.colorOptions(row.setting)
    value: row.isHexValue ? "" : String(row.value)
    accent: row.accent
    fontFamily: row.fontFamily
    onChanged: function (v) { if (v !== "") row.changed(v) }
  }

  TextField {
    id: hexField
    visible: row.setting.type === "color"
    Layout.fillWidth: true
    enabled: row.rowEnabled
    placeholderText: "#rrggbb"
    validator: RegularExpressionValidator { regularExpression: /^#[0-9a-fA-F]{0,6}$/ }
    foreground: row.foreground
    accent: row.accent
    onEditingFinished: if (SettingsSpec.isHex(text) && text !== row.value) row.changed(text.toLowerCase())
  }

  // A plain `text:` binding breaks once the user types; Binding re-applies it
  // whenever the stored value changes.
  Binding {
    target: hexField
    property: "text"
    value: row.isHexValue ? String(row.value) : ""
    restoreMode: Binding.RestoreNone
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
