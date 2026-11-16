import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui

// Widgets page: the head (hero, counts, bar position) and one row per widget
// on the bar. Every action goes through the Panel root (toggleAt, restoreAll,
// setBarPosition); widget logic lives in Model.js.
Column {
  id: page

  // The Panel root: rows, cursorIndex, pageRoom, widgetKeepY, toggleStarting,
  // plus everything WidgetsHead and WidgetListRow read.
  property var panel: null

  width: parent ? parent.width : 0
  spacing: Style.space(12)

  WidgetsHead {
    id: head
    width: parent.width
    panel: page.panel
  }

  // toggleAt is about to rebuild the list out from under itself: remember
  // where it was standing first. See restoreContentY.
  Connections {
    target: page.panel
    function onToggleStarting() { page.panel.widgetKeepY = list.contentY }
  }

  // One flat list across all sections. ListView rather than a Repeater so
  // positionViewAtIndex keeps the keyboard cursor on screen once the list
  // outgrows the card.
  ListView {
    id: list
    width: parent.width
    // Two caps. The screen one is the hard limit; the second keeps a bar with a
    // lot of widgets from growing a card the height of the display. Past that
    // the list scrolls.
    readonly property real capHeight: Math.min(contentHeight, Style.space(560),
      Math.max(Style.space(120), page.panel.pageRoom - head.implicitHeight - page.spacing))

    // Whatever the caps land on, the viewport ends on a row boundary: a row cut
    // through its middle reads as a clipping bug. Assigned, never bound:
    // capHeight does not depend on the viewport, so nothing feeds back.
    property real snappedHeight: 0
    height: snappedHeight > 0 ? snappedHeight : capHeight

    // `model` is a plain JS array, so every rebuild REPLACES it and a ListView
    // puts a replaced model back at the top. One toggle rebuilds it twice (our
    // store, then the host's config), so the position kept on the panel is put
    // back after each rebuild. Late (Qt.callLater) because the delegates and
    // contentHeight are not settled inside the model change itself.
    onModelChanged: Qt.callLater(restoreContentY)
    onMovementEnded: page.panel.widgetKeepY = contentY

    function restoreContentY() {
      var wanted = Math.max(0, Math.min(page.panel.widgetKeepY, Math.max(0, contentHeight - height)))
      if (Math.abs(contentY - wanted) > 0.5) contentY = wanted
    }

    // Snapping changes `height`, which re-clamps contentY, so the wanted
    // position is re-applied after it rather than before.
    onCapHeightChanged: Qt.callLater(resnapAndKeepPosition)
    onCountChanged: Qt.callLater(resnapAndKeepPosition)

    function resnapAndKeepPosition() { resnap(); restoreContentY() }

    function resnap() {
      if (capHeight >= contentHeight) { snappedHeight = 0; return }
      // The delegate straddling the cut. -1 means the cut already fell in the
      // gap between two rows, which is the thing we are aiming for.
      var i = indexAt(2, contentY + capHeight)
      if (i < 0) { snappedHeight = 0; return }
      var row = itemAtIndex(i)
      var top = row ? row.y - contentY : 0
      snappedHeight = top >= Style.space(120) ? top : 0
    }
    spacing: Style.space(2)
    clip: true
    boundsBehavior: Flickable.StopAtBounds
    interactive: contentHeight > height

    ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

    model: page.panel.rows
    currentIndex: page.panel.cursorIndex
    onCurrentIndexChanged: if (currentIndex >= 0) positionViewAtIndex(currentIndex, ListView.Contain)

    delegate: WidgetListRow { panel: page.panel }
  }
}
