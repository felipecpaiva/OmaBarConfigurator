import QtQuick
import qs.Commons

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
  // Glide edges and color to new values instead of jumping. The widgets
  // themselves move at once, so the pill trails them for a moment.
  property bool animate: true
  // False until the painter's first start and end are in, so a new pill
  // appears at its place instead of growing out of x = 0.
  property bool placed: false
  Component.onCompleted: Qt.callLater(() => pill.placed = true)

  // Last whole-pixel edges asked for through aim(), and the first widget id.
  // Reading start/end mid-glide gives the animated value, not the target.
  property real aimStart: NaN
  property real aimEnd: NaN
  property string key: ""

  // Sub-pixel changes draw the same pill, so they must not start the glide.
  function aim(s, e) {
    s = Math.round(s)
    e = Math.round(e)
    if (s !== aimStart) { aimStart = s; start = s }
    if (e !== aimEnd) { aimEnd = e; end = e }
  }

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

  // One animation per edge, never on x and width: those are derived, so both
  // edges land together and stay on whole pixels every frame.
  // 160 ms strong ease out: most of the distance in the first frames, so the
  // trail behind the widgets is short (docs/research/impasto-animations.md).
  Behavior on start {
    enabled: pill.animate && pill.placed
    NumberAnimation { duration: Style.duration(160); easing.type: Easing.BezierSpline; easing.bezierCurve: Style.easeOut }
  }
  Behavior on end {
    enabled: pill.animate && pill.placed
    NumberAnimation { duration: Style.duration(160); easing.type: Easing.BezierSpline; easing.bezierCurve: Style.easeOut }
  }
  // Theme switches fade like the stock bar background.
  Behavior on color {
    ColorAnimation { duration: pill.fadeDuration; easing.type: Easing.BezierSpline; easing.bezierCurve: pill.fadeCurve }
  }
}
