// GroupLayout.js — pure pill geometry. Slots per area + breaks in, pill bounds
// out. No QML imports, no side effects at import, never throws on bad input.
// node requires it for test/group-layout-test.js; QML imports it as a module.
//
// Coordinates run along the bar axis (x on a horizontal bar, y on a vertical
// one). Work per call is O(widgets log widgets) (one sort per area).

var AREAS = ["left", "center", "right"]
// Omarchy's spacer draws nothing: it is real space between pills, never part of one.
var SPACER = "omarchy.spacer"

function num(v) {
  return typeof v === "number" && isFinite(v) && v > 0 ? v : 0
}

function list(v) {
  return Array.isArray(v) ? v : []
}

// Valid slots only (finite, positive size), sorted by start, stable on ties.
function cleanSlots(raw) {
  var out = []
  list(raw).forEach(function (s, i) {
    if (!s || typeof s !== "object" || String(s.id) === SPACER) return
    if (typeof s.start !== "number" || typeof s.end !== "number") return
    if (!isFinite(s.start) || !isFinite(s.end) || s.end - s.start <= 0) return
    // ink: the visible text and icons inside the slot, when measured; kept inside the slot.
    var ink = typeof s.inkStart === "number" && typeof s.inkEnd === "number" && isFinite(s.inkStart) && isFinite(s.inkEnd) &&
      s.inkEnd > s.inkStart
    var lo = ink ? Math.max(s.start, s.inkStart) : s.start, hi = ink ? Math.min(s.end, s.inkEnd) : s.end
    if (hi <= lo) { lo = s.start; hi = s.end }
    out.push({ id: String(s.id), part: String(s.part), start: s.start, end: s.end, lo: lo, hi: hi, n: i })
  })
  out.sort(function (a, b) { return a.start - b.start || a.n - b.n })
  return out
}

// Set of the string ids in a list (array or host list).
function idSet(v) {
  var out = {}
  if (v && typeof v === "object" && typeof v.length === "number")
    for (var i = 0; i < v.length; i++) if (typeof v[i] === "string") out[v[i]] = true
  return out
}

// rules: { solo, noPill (id sets), parts (true: split at the first slot of the center and centerEnd parts) }
function areaPills(rawSlots, rawBreaks, padding, gap, rules, min, max, even) {
  var slots = cleanSlots(rawSlots)
  if (slots.length === 0) return []

  // shortcut: repeated widget ids break at the first match, upgrade when Omarchy gives stable per-copy ids
  var breakAt = {}
  list(rawBreaks).forEach(function (id) {
    for (var i = 1; i < slots.length; i++) {
      if (slots[i].id === id) { breakAt[i] = true; break }
    }
  })

  // Implicit breaks at the first slot of a later center part, when something precedes it.
  var partSeen = {}
  slots.forEach(function (s, i) {
    if (!rules.parts || partSeen[s.part]) return
    partSeen[s.part] = true
    if (i > 0 && (s.part === "center" || s.part === "centerEnd")) breakAt[i] = true
  })

  // A group remembers the noPill slot right before and right after it, if any.
  var groups = []
  var cur = null
  var prevSolo = false
  var prevNone = null
  slots.forEach(function (s, i) {
    if (rules.noPill[s.id]) { // no pill, and none spans across it
      if (cur) cur.after = s
      cur = null; prevNone = s
      return
    }
    var solo = rules.solo[s.id] === true
    if (!cur || breakAt[i] || solo || prevSolo) {
      cur = { slots: [], before: cur ? null : prevNone, after: null }
      groups.push(cur)
    }
    prevNone = null
    prevSolo = solo
    cur.slots.push(s)
  })

  var pills = groups.map(function (grp) {
    var g = grp.slots
    return {
      first: g[0], last: g[g.length - 1], before: grp.before, after: grp.after,
      // Padding counts from what is visible (lo, hi), not from the widget's box, so a widget
      // that draws its icon at its edge gets the same room as one with inner margins.
      start: g[0].lo - padding, end: g[g.length - 1].hi + padding,
      ids: g.map(function (s) { return s.id })
    }
  })

  // Widgets in a section touch (the bar has 0 spacing), so padded neighbours
  // would overlap and a split section would look like one pill. Force `gap`
  // between them, centred on the midpoint of the touching edges. The gap wins
  // over content: pills are drawn BEHIND the widgets and slots carry their own
  // edge padding, so a widget overhangs its pill by up to gap/2 inside empty
  // padding and nothing is clipped. Guard: a pill is never shorter than 1 px;
  // if a clamp would collapse it, that pill keeps its slot bounds.
  for (var k = 0; k + 1 < pills.length; k++) {
    var a = pills[k], b = pills[k + 1]
    var mid = (a.last.hi + b.first.lo) / 2
    a.end = Math.min(a.end, mid - gap / 2)
    b.start = Math.max(b.start, mid + gap / 2)
  }
  // A None widget has no pill: a facing pill edge stops half a gap from it.
  pills.forEach(function (p) {
    if (p.before) p.start = Math.max(p.start, p.before.hi + gap / 2)
    if (p.after) p.end = Math.min(p.end, p.after.lo - gap / 2)
    // Surface bounds: an outer pill stops at the edge (kept only if it stays a pill).
    if (Math.min(p.end, max) > Math.max(p.start, min)) { p.start = Math.max(p.start, min); p.end = Math.min(p.end, max) }
    if (p.end < p.start + 1) { p.start = p.first.lo; p.end = p.last.hi }
    // Even pills: both ends get the smaller pad, so the content sits centred.
    // Edges only move inward, so a pill never grows into a neighbour.
    if (!even) return
    var pad = Math.min(p.first.lo - p.start, p.end - p.last.hi)
    var s = p.first.lo - pad, e = p.last.hi + pad
    if (e >= s + 1) { p.start = s; p.end = e } else { p.start = p.first.lo; p.end = p.last.hi }
  })

  return pills.map(function (p) { return { start: p.start, end: p.end, ids: p.ids } })
}

function pills(areas, breaks, opts) {
  var a = areas && typeof areas === "object" ? areas : {}
  var b = breaks && typeof breaks === "object" ? breaks : {}
  var o = opts && typeof opts === "object" ? opts : {}
  var padding = num(o.padding), gap = num(o.gap)
  var rules = { solo: idSet(o.solo), noPill: idSet(o.noPill), parts: o.centerParts === true }
  // Optional bounds along the bar axis: outer pills stop at the surface edge
  // instead of running past it (the side lists sit closer to the edge than
  // the default padding). The pill's other end then matches (even pills).
  var min = isFinite(o.min) ? Number(o.min) : -Infinity
  var max = isFinite(o.max) ? Number(o.max) : Infinity
  // even: false lets an end with room keep the full padding (default true).
  var even = o.even !== false
  var out = {}
  AREAS.forEach(function (name) {
    out[name] = areaPills(a[name], b[name], padding, gap, { solo: rules.solo, noPill: rules.noPill, parts: rules.parts && name === "center" }, min, max, even)
  })
  return out
}

if (typeof module !== "undefined") {
  module.exports = { pills: pills }
}
