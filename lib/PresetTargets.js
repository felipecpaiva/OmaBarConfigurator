// PresetTargets.js: where each preset puts the widgets, and what happens to the breaks.
// Pure, never throws, no QML imports (node tests it, QML imports it). QML JS files cannot
// import each other, so the panel passes this module to Presets.presetPlan as `targets`.
var SECTIONS = ["left", "centerBegin", "center", "centerEnd", "right", "tray"]
var AREAS = { left: ["left"], center: ["centerBegin", "center", "centerEnd"], right: ["right"] }
// Mirrors Presets.SELF_ID; the test checks it.
var SELF_ID = "io.github.felipecpaiva.omabarconfigurator"

function copy(v) { try { var c = JSON.parse(JSON.stringify(v)); return c && typeof c === "object" ? c : null } catch (e) { return null } }
function isList(v) { return !!v && typeof v === "object" && typeof v.length === "number" }
function idOf(entry) {
  if (typeof entry === "string") return entry
  if (entry && typeof entry === "object" && entry.id !== undefined && entry.id !== null) return String(entry.id)
  return ""
}
function strList(v) { var out = []; if (isList(v)) for (var i = 0; i < v.length; i++) if (typeof v[i] === "string" && v[i]) out.push(v[i]); return out }
function roleOf(roles, key, dflt) {
  var v = roles && typeof roles === "object" ? roles[key] : undefined
  return typeof v === "string" && (v || dflt === "") ? v : dflt
}
function areaOf(s) { return Object.keys(AREAS).filter(function (a) { return AREAS[a].indexOf(s) >= 0 })[0] || "" }

// The widget that keeps `center`: the anchor when it is there, else the only clock there, else "".
function centerPin(lay, roles) {
  var c = isList(lay.center) ? Array.prototype.map.call(lay.center, idOf) : [], a = roleOf(roles, "centerAnchor", "")
  var clocks = c.filter(function (id) { return id.slice(id.lastIndexOf(".") + 1) === "clock" })
  return a && c.indexOf(a) >= 0 ? a : clocks.length === 1 ? clocks[0] : ""
}

// Where a widget in section s goes, per preset (the tray stays; Grouped may empty `center` round the clock). The section walk in
// presetTarget gives the order: left before centerBegin, centerEnd before right.
var DESTS = {
  denial: function (roles) {
    var ws = strList(roles && roles.workspaces), anchor = roleOf(roles, "centerAnchor", "")
    return function (id, s) { return ws.indexOf(id) >= 0 || (anchor && id === anchor && s === "center") ? "center" : "right" } },
  grouped: function (roles, lay) { // other center widgets go before the clock, so it stays alone in `center`
    var pin = centerPin(lay, roles)
    return function (id, s) { return s === "center" && pin && id !== pin ? "centerBegin" : { left: "centerBegin", right: "centerEnd" }[s] || s } },
  spread: function () { return function (id, s) { return { centerBegin: "left", centerEnd: "right" }[s] || s } }
}
// The layout a preset wants. The painter, entries with no id and the tray drawer stay put.
// Denial: workspaces (and the center anchor) in `center`, everything else on the right.
// `from` (optional) gets, per target section, the section each entry came from.
function presetTarget(lay, roles, dest, from) {
  var self = roleOf(roles, "selfId", SELF_ID)
  var out = {}; from = from || {}; SECTIONS.forEach(function (s) { from[s] = []; if (s !== "tray") out[s] = [] })
  Object.keys(lay).forEach(function (k) { out[k] = SECTIONS.indexOf(k) >= 0 && k !== "tray" ? [] : lay[k] })
  SECTIONS.forEach(function (s) {
    if (s === "tray" || !isList(lay[s])) return
    lay[s].forEach(function (e) {
      var id = idOf(e), to = id === self || id === "" ? s : dest(id, s)
      out[to].push(e); from[to].push(s)
    })
  })
  return out
}

// Omarchy default: each entry of roles.defaultLayout, in order, takes the bar's widget with that id or
// one of roles.aliases[id]. Widgets that match nothing keep their section, after the placed ones.
// Default entries with no widget on the bar are skipped. The painter, entries with no id and the tray stay.
function omarchyTarget(lay, roles, from) {
  var self = roleOf(roles, "selfId", SELF_ID), def = copy(roles && roles.defaultLayout) || {}, al = copy(roles && roles.aliases) || {}
  var out = {}, used = {}, pool = []
  SECTIONS.forEach(function (s) { from[s] = []; out[s] = [] })
  Object.keys(lay).forEach(function (k) { if (SECTIONS.indexOf(k) < 0) out[k] = lay[k] })
  out.tray = isList(lay.tray) ? Array.prototype.slice.call(lay.tray) : []
  SECTIONS.forEach(function (s) {
    if (s !== "tray" && isList(lay[s])) for (var i = 0; i < lay[s].length; i++) pool.push({ e: lay[s][i], s: s, id: idOf(lay[s][i]) })
  })
  pool.forEach(function (w) { w.keep = w.id === "" || w.id === self })
  SECTIONS.forEach(function (S) {
    if (S === "tray" || !isList(def[S])) return
    for (var i = 0; i < def[S].length; i++) {
      var d = idOf(def[S][i]), names = [d].concat(strList(al[d]))
      var w = d ? pool.filter(function (x, k) { return !x.keep && !used[k] && names.indexOf(x.id) >= 0 })[0] : null
      if (w) { used[pool.indexOf(w)] = true; out[S].push(w.e); from[S].push(w.s) }
    }
  })
  pool.forEach(function (w, k) { if (!used[k]) { out[w.s].push(w.e); from[w.s].push(w.s) } })
  return out
}

// The target layout for a preset id, filling `from` (see presetTarget), or null for an unknown preset.
function targetFor(presetId, roles, lay, from) {
  if (typeof presetId !== "string" || !DESTS.hasOwnProperty(presetId) && presetId !== "omarchy") return null
  return presetId === "omarchy" ? omarchyTarget(lay, roles, from) : presetTarget(lay, roles, DESTS[presetId](roles, lay), from)
}

// The breaks after a preset. Denial drops the break of each widget that changed area, so a
// stale break cannot come back later. Grouped and Spread carry it to the new area (it still
// splits the same widgets) and add one where the area a widget came from changes between
// neighbours, so the groups that meet stay separate pills.
function presetBreaks(brk, target, from, self, carry) {
  var moved = {}, seen = {}, firsts = {}, out = {}
  Object.keys(AREAS).forEach(function (a) {
    var prev = ""
    AREAS[a].forEach(function (s) {
      target[s].forEach(function (e, i) {
        var id = idOf(e), o = areaOf(from[s][i]); if (id === "" || id === self) return
        if (o !== a) moved[id] = a
        if (prev && o !== prev && !seen[id]) (firsts[a] = firsts[a] || []).push(id)
        prev = o; seen[id] = true
      })
    })
  })
  Object.keys(AREAS).forEach(function (a) { out[a] = brk[a].filter(function (id) { return !moved[id] }) })
  var add = function (a, id) { if (out[a].indexOf(id) < 0) out[a].push(id) }
  if (carry) Object.keys(AREAS).forEach(function (a) {
    brk[a].forEach(function (id) { if (moved[id]) add(moved[id], id) })
    ;(firsts[a] || []).forEach(function (id) { add(a, id) })
  })
  return out
}

if (typeof module !== "undefined") {
  module.exports = { SELF_ID: SELF_ID, targetFor: targetFor, presetBreaks: presetBreaks }
}
