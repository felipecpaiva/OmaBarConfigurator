// Groups.js — pure helpers for the Groups page: which pill each widget is in,
// and the breaks list after a toggle. No QML imports, never throws, O(widgets).
// node requires it for test/groups-test.js; QML imports it as a module.
//
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

function rows(layout, breaks, selfId) {
  var lay = layout && typeof layout === "object" ? layout : {}
  var brk = breaks && typeof breaks === "object" ? breaks : {}
  var result = {}
  AREAS.forEach(function (area) {
    var wanted = {}
    ids(brk[area]).forEach(function (id) { wanted[id] = true })
    var seen = {}, pill = 0, out = []
    SOURCES[area].forEach(function (key) {
      items(lay[key]).forEach(function (entry) {
        var id = idOf(entry)
        if (id === "" || id === selfId) return
        var first = out.length === 0
        // shortcut: repeated ids carry a break on the first copy only, upgrade when Omarchy gives stable per-copy ids
        var starts = !first && !seen[id] && wanted[id] === true
        if (!first) seen[id] = true // GroupLayout searches from the second widget on
        if (first || starts) pill++
        out.push({ id: id, startsPill: first || starts, pill: pill, first: first })
      })
    })
    result[area] = out
  })
  return result
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

function pillCount(r) {
  var out = {}
  AREAS.forEach(function (a) {
    var list = r && r[a] ? items(r[a]) : []
    out[a] = list.length ? list[list.length - 1].pill : 0
  })
  return out
}

if (typeof module !== "undefined") {
  module.exports = { rows: rows, toggleBreak: toggleBreak, pillCount: pillCount }
}
