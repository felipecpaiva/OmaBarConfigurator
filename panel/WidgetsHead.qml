import QtQuick
import qs.Commons
import qs.Ui

// Everything above the widget list: hero, stat row, bar position. Its height
// is independent of the list's, which is what lets the list cap itself against
// the space left over without the two forming a binding loop.
Column {
  id: head

  // The Panel root: busy, anchorName, hiddenCount, regionCount(), barTransparent,
  // barPosition, restoreAll(), setBarTransparent(), setBarPosition(), foreground, dim, fontFamily.
  property var panel: null

  spacing: Style.space(12)

  PanelHero {
    title: "Bar widgets"
    // The eyebrow must not restate the grid below it: the section counts and
    // the shown/hidden split are already there, and the bar position is on the
    // button group. What is left is which widget the centre is pinned to.
    // PanelHero upper-cases `meta` for us.
    meta: head.panel.busy
      ? "APPLYING CHANGES"
      : (head.panel.anchorName !== ""
         ? "PINNED TO " + head.panel.anchorName
         : "CENTRE UNPINNED")
    foreground: head.panel.foreground
    fontFamily: head.panel.fontFamily

    iconComponent: Component {
      Text {
        textFormat: Text.PlainText
        text: "󱍕"
        color: head.panel.foreground
        font.family: head.panel.fontFamily
        font.pixelSize: Style.font.display
      }
    }

    // The hero's trailing rail holds the two bar-wide verbs this panel owns.
    // The restore is present always rather than appearing only once something
    // is hidden (a control that is absent teaches nobody it exists), and the
    // switch reports a real bar setting rather than decorating.
    trailingControl: Component {
      Row {
        spacing: Style.space(8)

        PanelActionButton {
          anchors.verticalCenter: parent.verticalCenter
          enabled: head.panel.hiddenCount > 0 && !head.panel.busy
          iconText: "󰈈"
          tooltipText: head.panel.hiddenCount > 0
            ? "Show every hidden widget" : "Nothing is hidden"
          foreground: head.panel.foreground
          fontFamily: head.panel.fontFamily
          onClicked: head.panel.restoreAll()
        }

        ToggleSwitch {
          anchors.verticalCenter: parent.verticalCenter
          checked: head.panel.barTransparent
          busy: head.panel.busy
          foreground: head.panel.foreground
          onToggled: head.panel.setBarTransparent(!head.panel.barTransparent)
        }
      }
    }
  }

  // Four counts, one or two characters each. One row of tight label and value
  // pairs on four evenly spaced starts: the number sits against the word it
  // belongs to, and the four cell starts are the alignment. A two-column grid
  // put a single digit far from its label with no axis to read.
  Row {
    id: statRow
    width: parent.width
    spacing: Style.space(6)

    readonly property real cellWidth: (width - spacing * 3) / 4

    StatCell {
      width: statRow.cellWidth; label: "Left"; value: head.panel.regionCount("left")
      foreground: head.panel.foreground; fontFamily: head.panel.fontFamily
    }
    StatCell {
      width: statRow.cellWidth; label: "Center"
      value: head.panel.regionCount("centerBegin") + head.panel.regionCount("center") + head.panel.regionCount("centerEnd")
      foreground: head.panel.foreground; fontFamily: head.panel.fontFamily
    }
    StatCell {
      width: statRow.cellWidth; label: "Right"; value: head.panel.regionCount("right")
      foreground: head.panel.foreground; fontFamily: head.panel.fontFamily
    }
    StatCell {
      width: statRow.cellWidth; label: "Hidden"; value: head.panel.hiddenCount
      valueColor: head.panel.hiddenCount > 0 ? head.panel.foreground : head.panel.dim
      foreground: head.panel.foreground; fontFamily: head.panel.fontFamily
    }
  }

  PanelSeparator { foreground: head.panel.foreground }

  // `omarchy bar position <top|bottom|left|right>` is a supported verb and the
  // one bar-wide decision this card can honestly own; everything below it is
  // per-widget.
  Column {
    width: parent.width
    spacing: Style.space(4)

    PanelSectionHeader {
      text: "BAR POSITION"
      // Same construction as the list's section headers: overshoot guard, plus
      // the gap that separates it from what came before.
      topPadding: Math.ceil(fontSize * 0.15) + Style.space(8)
      foreground: head.panel.foreground
      fontFamily: head.panel.fontFamily
    }

    Row {
      id: positionRow
      width: parent.width
      spacing: Style.space(6)

      readonly property real cellWidth: (width - spacing * 3) / 4

      Repeater {
        model: ["top", "right", "bottom", "left"]

        delegate: Button {
          required property string modelData
          width: positionRow.cellWidth
          text: modelData.charAt(0).toUpperCase() + modelData.slice(1)
          tooltipText: "Move the bar to the " + modelData
          fontSize: Style.font.bodySmall
          fontFamily: head.panel.fontFamily
          foreground: head.panel.foreground
          horizontalPadding: Style.spacing.controlPaddingX
          verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
          bordered: true
          active: head.panel.barPosition === modelData
          enabled: !head.panel.busy
          onClicked: head.panel.setBarPosition(modelData)
        }
      }
    }
  }

  PanelSeparator { foreground: head.panel.foreground }
}
