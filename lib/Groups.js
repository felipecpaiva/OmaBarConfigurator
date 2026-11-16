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
        if (begins) pill++
        open = !isNone
        prevSolo = isSolo
        // repeat: a later copy of an id seen earlier in this area; its switch is disabled
        out.push({ id: id, startsPill: begins, pill: isNone ? 0 : pill, first: first, repeat: !!repeated[id],
                   mode: isNone ? "none" : isSolo ? "solo" : "shared" })
        repeated[id] = true
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

function pillCount(r) {
  var out = {}
  AREAS.forEach(function (a) {
    var list = r && r[a] ? items(r[a]) : []
    out[a] = 0
    list.forEach(function (w) { if (w && w.pill > out[a]) out[a] = w.pill }) // a trailing noPill row has pill 0
  })
  return out
}

if (typeof module !== "undefined") {
  module.exports = { rows: rows, toggleBreak: toggleBreak, setMode: setMode, pillCount: pillCount }
}
