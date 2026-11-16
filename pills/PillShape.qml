import QtQuick

// One pill behind a group of bar widgets. Drawing only: PillPainter decides
// where it goes and how it looks. Edges sit on whole pixels.
Rectangle {
  id: pill

  // Along the bar, in the parent's coordinates.
  property real start: 0
  property real end: 0
  property bool vertical: false
  // The bar's thickness: the parent's real size across the bar, which can be
  // more than the bar size on a notched screen.
  property real cross: parent ? (vertical ? parent.width : parent.height) : 0
  // Space between the pill and the bar's edges, on both sides.
  property real inset: 0
  // 999 or more means fully round ends.
  property real cornerRadius: 0
  property color fillColor: "transparent"
  property real fillOpacity: 1
  property color edgeColor: "transparent"
  property real edgeOpacity: 1
  property real edgeWidth: 0
  // Color fade on a theme switch. The painter passes Style.duration() and
  // Style.easeOut, so `omarchy toggle animations` turns it off.
  property int fadeDuration: 0
  property var fadeCurve: [0, 0, 1, 1, 1, 1]

  readonly property real along: Math.max(0, Math.round(end) - Math.round(start))
  readonly property real across: Math.max(0, Math.round(cross - 2 * inset))

  x: vertical ? Math.round(inset) : Math.round(start)
  y: vertical ? Math.round(start) : Math.round(inset)
  width: vertical ? across : along
  height: vertical ? along : across
  radius: Math.min(cornerRadius, Math.min(width, height) / 2)
  color: Qt.rgba(fillColor.r, fillColor.g, fillColor.b, fillOpacity)
  border.width: edgeWidth
  border.color: Qt.rgba(edgeColor.r, edgeColor.g, edgeColor.b, edgeOpacity)
  // Behind the widgets of every section.
  z: -1

  // Theme switches fade like the stock bar background; geometry never
  // animates, so a pill never trails its widgets.
  Behavior on color {
    ColorAnimation { duration: pill.fadeDuration; easing.type: Easing.BezierSpline; easing.bezierCurve: pill.fadeCurve }
  }
}
