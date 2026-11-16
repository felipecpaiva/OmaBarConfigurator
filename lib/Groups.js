// Groups.js — pure helpers for the Groups page: which pill each widget is in,
// and the breaks list after a toggle. No QML imports, never throws, O(widgets).
// node requires it for test/groups-test.js; QML imports it as a module.
//
// shortcut: the page cannot see widget sizes, so a hidden (zero size) widget is listed
// here though the bar draws no break for it, upgrade when the painter reports sizes to the page.
// Grouping rule mirrors lib/GroupLayout.js: a break id means "a new pill starts
// at this widget", the first widget of an area is always the start of pill 1.

var AREAS = ["left", "center", "right"]
// Center is drawn as centerBegin + center + centerEnd, in that order.
var SOURCES = { left: ["left"], center: ["centerBegin", "center", "centerEnd"], right: ["right"] }

// Host arrays fail Array.isArray (FINDINGS.md), so read by length and index.
function items(v) {
  var out = []
  if (!v || typeof v !== "object" || typeof v.length !== "number") return out
  for (var i = 0; i < v.length; i++) out.push(v[i])
  return out
}

function idOf(entry) {
  if (typeof entry === "string") return entry
  if (entry && typeof entry === "object" && entry.id !== undefined && entry.id !== null) return String(entry.id)
  return ""
}

function ids(v) {
  var seen = {}, out = []
  items(v).forEach(function (e) {
    if (typeof e === "string" && e !== "" && !seen[e]) { seen[e] = true; out.push(e) }
  })
  return out
}

function idSet(v) {
  var out = {}
  ids(v).forEach(function (id) { out[id] = true })
  return out
}

// rules: { solo: [ids], noPill: [ids], centerParts: bool }. Mirrors GroupLayout.pills:
// noPill wins over solo; a noPill widget has pill 0 and closes the open pill.
function rows(layout, breaks, selfId, rules) {
  var rl = rules && typeof rules === "object" ? rules : {}
  var solo = idSet(rl.solo), none = idSet(rl.noPill)
  var lay = layout && typeof layout === "object" ? layout : {}
  var brk = breaks && typeof breaks === "object" ? breaks : {}
  var result = {}
  AREAS.forEach(function (area) {
    var wanted = {}
    ids(brk[area]).forEach(function (id) { wanted[id] = true })
    var seen = {}, repeated = {}, pill = 0, out = []
    var open = false, prevSolo = false
    SOURCES[area].forEach(function (key) {
      var firstOfPart = true
      items(lay[key]).forEach(function (entry) {
        var id = idOf(entry)
        if (id === "" || id === selfId) return
        var first = out.length === 0
        var partBreak = rl.centerParts === true && area === "center" && firstOfPart && !first && key !== "centerBegin"
        firstOfPart = false
        // shortcut: repeated ids carry a break on the first copy only, upgrade when Omarchy gives stable per-copy ids
        var starts = !first && !seen[id] && wanted[id] === true
        if (!first) seen[id] = true // GroupLayout searches from the second widget on
        var isNone = none[id] === true, isSolo = !isNone && solo[id] === true
        var begins = !isNone && (!open || starts || partBreak || isSolo || prevSolo)
        // a rule, not the user's choice, starts this pill (first-row start is not forced)
        var forcedBy = isNone || first ? "" : (isSolo || prevSolo) ? "own" : !open ? "none" : partBreak ? "centerPart" : ""
        if (begins) pill++
        open = !isNone
        prevSolo = isSolo
        // repeat: a later copy of an id seen earlier in this area; its switch is disabled
        out.push({ id: id, startsPill: begins, pill: isNone ? 0 : pill, first: first, repeat: !!repeated[id],
                   mode: isNone ? "none" : isSolo ? "solo" : "shared",
                   forced: forcedBy !== "", forcedBy: forcedBy })
        repeated[id] = true
      })
    })
    // endsPill: the next widget is in another pill (or there is none); None rows never end one.
    out.forEach(function (r, i) { r.endsPill = r.pill > 0 && (i === out.length - 1 || out[i + 1].pill !== r.pill) })
    result[area] = out
  })
  return result
}

// The seam before row i (i >= 1) of one area's rows.
// state: "split" | "join" (click toggles), "locked" (a rule decides), "off" (cannot split here).
// reason: "" | "own" | "none" | "centerPart" | "repeat". cause: index of the row whose
// setting forces the seam, or -1. The next row's mode wins over the previous row's.
function seam(areaRows, i) {
  var list = items(areaRows), r = list[i], p = list[i - 1]
  if (!r || !p || i < 1) return { state: "off", reason: "", cause: -1 }
  if (r.mode === "none" || r.mode === "solo") return { state: "locked", reason: r.mode === "solo" ? "own" : "none", cause: i }
  if (p.mode === "none" || p.mode === "solo") return { state: "locked", reason: p.mode === "solo" ? "own" : "none", cause: i - 1 }
  if (r.repeat) return { state: "off", reason: "repeat", cause: -1 }
  if (r.forcedBy === "centerPart") return { state: "locked", reason: "centerPart", cause: -1 }
  return { state: r.startsPill ? "split" : "join", reason: "", cause: -1 }
}

// Keyboard stops in bar order: per area chip, seam, chip, seam, chip. A seam stop's
// index is the row after it, so seam(rows[area], index) describes it.
function stops(areaRows) {
  var out = []
  var all = areaRows && typeof areaRows === "object" ? areaRows : {}
  AREAS.forEach(function (area) {
    items(all[area]).forEach(function (r, i) {
      if (i > 0) out.push({ area: area, kind: "seam", index: i })
      out.push({ area: area, kind: "chip", index: i })
    })
  })
  return out
}

// The stop after a key press. dx walks inside the area and stops at its ends; dy jumps to
// the next area with widgets, same position or its last stop. at < 0 or out of range gives 0.
function step(stopList, at, dx, dy) {
  var list = items(stopList)
  if (list.length === 0) return -1
  if (typeof at !== "number" || at < 0 || at >= list.length) return 0
  var area = list[at].area, lo = at, hi = at
  while (lo > 0 && list[lo - 1].area === area) lo--
  while (hi < list.length - 1 && list[hi + 1].area === area) hi++
  if (dy === 0) return Math.max(lo, Math.min(hi, at + (dx > 0 ? 1 : dx < 0 ? -1 : 0)))
  var start = dy > 0 ? hi + 1 : lo - 1
  if (start < 0 || start >= list.length) return at
  var other = list[start].area, olo = start, ohi = start
  while (olo > 0 && list[olo - 1].area === other) olo--
  while (ohi < list.length - 1 && list[ohi + 1].area === other) ohi++
  return Math.min(ohi, olo + (at - lo))
}

// Where a widget is now: the same area first, then any area; first copy wins. null if gone.
function locate(areaRows, area, id) {
  var all = areaRows && typeof areaRows === "object" ? areaRows : {}
  var order = [area].concat(AREAS.filter(function (a) { return a !== area }))
  for (var k = 0; k < order.length; k++) {
    var list = items(all[order[k]])
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return { area: order[k], index: i }
  }
  return null
}

// A new breaks object with `id` added to or removed from `area`; input untouched.
function toggleBreak(breaks, area, id) {
  var brk = breaks && typeof breaks === "object" ? breaks : {}
  var out = {}
  AREAS.forEach(function (a) { out[a] = ids(brk[a]) })
  if (AREAS.indexOf(area) < 0 || typeof id !== "string" || id === "") return out
  var at = out[area].indexOf(id)
  if (at >= 0) out[area].splice(at, 1)
  else out[area].push(id)
  return out
}

// A new groups object with `id` moved to mode "shared" | "solo" | "none"; other keys kept.
function setMode(groups, id, mode) {
  var g = groups && typeof groups === "object" ? groups : {}
  var out = {}
  for (var k in g) out[k] = g[k]
  out.solo = ids(g.solo).filter(function (x) { return x !== id })
  out.noPill = ids(g.noPill).filter(function (x) { return x !== id })
  if (typeof id === "string" && id !== "") {
    if (mode === "solo") out.solo.push(id)
    else if (mode === "none") out.noPill.push(id)
  }
  return out
}

if (typeof module !== "undefined") {
  module.exports = { rows: rows, toggleBreak: toggleBreak, setMode: setMode, seam: seam, stops: stops, step: step, locate: locate }
}
