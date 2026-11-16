import QtQuick
import qs.Commons
import qs.Ui

// One widget on the bar, with the section header riding on the first row of
// each region (`modelData.title`, set by Panel's `rows`). Glyph, name, and a
// switch the row itself owns: the switch is presentation, so the whole row is
// a single target for the mouse and the keyboard cursor alike.
Item {
  id: item

  required property var modelData
  required property int index
  // The Panel root: isLocked(), notDrawingIds, cursorActive, cursorIndex, toggleAt(),
  // widgetGlyph(), widgetGlyphFamily(), widgetName(), busy, foreground, dim,
  // hoverFill, selectedFill, fontFamily.
  property var panel: null

  readonly property bool shown: modelData.visible
  readonly property bool locked: panel.isLocked(modelData)
  // On the bar and painting nothing: the entry is there, the widget has nothing to draw.
  readonly property bool blank: modelData.visible && panel.notDrawingIds[modelData.id] === true

  width: ListView.view ? ListView.view.width : 0
  height: column.implicitHeight

  Column {
    id: column
    width: parent.width
    spacing: Style.space(4)

    PanelSectionHeader {
      visible: item.modelData.title !== ""
      // The base topPadding protects the Nerd Font overshoot from the list's
      // clip; the rest is the gap after the last row of the previous section.
      topPadding: Math.ceil(fontSize * 0.15) + (item.index === 0 ? 0 : Style.space(8))
      height: visible ? implicitHeight : 0
      text: item.modelData.title
      foreground: item.panel.foreground
      fontFamily: item.panel.fontFamily
    }

    CursorSurface {
      id: surface
      width: parent.width
      hasCursor: item.panel.cursorActive && item.panel.cursorIndex === item.index
      // The raised fill is the anchor row's and nothing else on the list spends
      // it, the slot the network panel keeps for the network it is on.
      current: item.locked
      foreground: item.panel.foreground
      fill: item.panel.hoverFill
      currentFill: item.panel.selectedFill
      implicitHeight: rowBody.implicitHeight
      // Never dim the anchor row: it is pinned, not broken. Only a command in flight dims.
      opacity: item.panel.busy ? 0.6 : 1.0

      MouseArea {
        id: rowMouse
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton
        cursorShape: item.locked ? Qt.ArrowCursor : Qt.PointingHandCursor

        // Entering moves the cursor here; leaving does not clear it, so j/k
        // picks up from wherever the mouse last was.
        onContainsMouseChanged: if (containsMouse) {
          item.panel.cursorActive = true
          item.panel.cursorIndex = item.index
        }
        onClicked: item.panel.toggleAt(item.index)
      }

      PanelToolTip {
        visible: item.locked && rowMouse.containsMouse
        text: "The centre section is pinned to this widget"
        fontFamily: item.panel.fontFamily
      }

      Item {
        id: rowBody
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: Style.space(10)
        // 6, not 10: the kit's header switch sits 6 inside the same rail (its
        // cursor-ring pad), so every switch lands on one axis.
        anchors.rightMargin: Style.space(6)
        implicitHeight: Math.max(rowGlyph.height, rowLabel.implicitHeight, rowSwitch.implicitHeight)
          + Style.spacing.rowPaddingX

        OpticalGlyph {
          id: rowGlyph
          width: Style.space(18)
          height: Style.space(18)
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: item.panel.widgetGlyph(item.modelData.id)
          fontFamily: item.panel.widgetGlyphFamily(item.modelData.id)
          fontSize: Style.font.title
          color: item.shown ? item.panel.foreground : item.panel.dim
        }

        // The kit's switch, unmodified: `interactive: false` hands the click to
        // the row's own MouseArea and drops the cursor ring. ON takes the title
        // token and OFF drops a tier, so the state reads in the right direction.
        ToggleSwitch {
          id: rowSwitch
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          checked: item.shown
          interactive: false
          foreground: item.panel.foreground
        }

        // Trailing state marker, sentence case at row rank (not the small caps
        // of the section headers). "Pinned" and "Not drawing" can both be true,
        // so both get said rather than one hiding the other.
        Text {
          id: rowState
          textFormat: Text.PlainText
          visible: text !== ""
          text: item.locked
            ? (item.blank ? "Pinned, not drawing" : "Pinned")
            : (item.blank ? "Not drawing" : "")
          anchors.right: rowSwitch.left
          anchors.rightMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          color: item.panel.dim
          font.family: item.panel.fontFamily
          font.pixelSize: Style.font.caption
        }

        // One line, always: a second line made the anchor row taller than its
        // neighbours and broke the list's pitch.
        Text {
          id: rowLabel
          textFormat: Text.PlainText
          anchors.left: rowGlyph.right
          anchors.leftMargin: Style.space(10)
          anchors.right: rowState.visible ? rowState.left : rowSwitch.left
          anchors.rightMargin: Style.space(10)
          anchors.verticalCenter: parent.verticalCenter
          text: item.panel.widgetName(item.modelData.id)
          color: item.shown ? item.panel.foreground : item.panel.dim
          font.family: item.panel.fontFamily
          font.pixelSize: Style.font.body
          elide: Text.ElideRight
        }
      }
    }
  }
}
