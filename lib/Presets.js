// Presets.js: layout presets, move pill and Undo, as `omarchy-bar move` argv lists.
// Pure, never throws, no QML imports (node tests it, QML imports it). Every input is JSON
// copied first, so host arrays (they fail Array.isArray, FINDINGS.md) become plain data.
// applyMoves mirrors PluginRegistry.moveBarEntry and barTarget (Omarchy 4.5): remove first,
// then work out the target; a late index lands at the end.
// Util.barSections order, tray last.
var SECTIONS = ["left", "centerBegin", "center", "centerEnd", "right", "tray"]
var AREAS = { left: ["left"], center: ["centerBegin", "center", "centerEnd"], right: ["right"] }
var ANCHORS = { left: "omarchy.workspaces", centerEnd: "omarchy.weather", right: "omarchy.tray" }
// Mirrors Model.SELF_ID (QML libs cannot import each other); the test checks it.
var SELF_ID = "io.github.felipecpaiva.omabarconfigurator"
var UNDO_ERROR = "The bar changed since the snapshot; Undo is not possible."

var PRESETS = [
  { id: "denial", label: "Denial", help: "Puts your workspaces in the middle of the bar and every other widget on the right, in the order you see them now." },
  { id: "grouped", label: "Grouped", help: "Your groups gather beside the clock: the left group just left of it, the right group just right of it, and the tray moves with the right group. The clock stays centered; on a screen with a notch the cluster sits beside the notch. With \"Split the center into three pills\" on, the clock group splits further." },
  { id: "spread", label: "Spread", help: "The classic bar: your groups go back to the two edges and the clock stays alone in the middle." },
  { id: "omarchy", label: "Omarchy default", help: "Puts every widget back where a fresh Omarchy bar has it. Widgets Omarchy does not ship keep their section." }
]
function copy(v) { try { var c = JSON.parse(JSON.stringify(v)); return c && typeof c === "object" ? c : null } catch (e) { return null } }
function isList(v) { return !!v && typeof v === "object" && typeof v.length === "number" }
function idOf(entry) {
  if (typeof entry === "string") return entry
  if (entry && typeof entry === "object" && entry.id !== undefined && entry.id !== null) return String(entry.id)
  return ""
}
function keyOf(entry) { return JSON.stringify(entry) }
function layoutOf(v) { var c = copy(v); return c && !isList(c) ? c : {} }
function strList(v) { var out = []; if (isList(v)) for (var i = 0; i < v.length; i++) if (typeof v[i] === "string" && v[i]) out.push(v[i]); return out }
function roleOf(roles, key, dflt) {
  var v = roles && typeof roles === "object" ? roles[key] : undefined
  return typeof v === "string" && (v || dflt === "") ? v : dflt
}

function breaksOf(breaks) {
  var b = breaks && typeof breaks === "object" ? copy(breaks) || {} : {}, out = {}
  Object.keys(AREAS).forEach(function (a) { out[a] = strList(b[a]) }); return out
}

function snapshot(layout) { return layoutOf(layout) }
function ensureShape(lay) { SECTIONS.forEach(function (s) { if (!isList(lay[s])) lay[s] = [] }) }
function find(lay, id, only) {
  for (var s = 0; s < SECTIONS.length; s++) {
    if (only && SECTIONS[s] !== only) continue
    var list = lay[SECTIONS[s]]; if (!isList(list)) continue
    for (var i = 0; i < list.length; i++) if (idOf(list[i]) === id) return { section: SECTIONS[s], index: i }
  }
  return null
}

// One `omarchy-bar move` on `lay` (changed in place). Returns "" or the CLI's error text.
// shortcut: --before/--after ignore clones (activeCloneFor), upgrade if a preset ever uses them.
function moveOne(lay, argv) {
  var a = strList(argv); if (a[0] === "omarchy" && a[1] === "bar") a.shift()
  if (a[0] !== "omarchy-bar" || a[1] !== "move" || !a[2]) return "not an omarchy-bar move"
  var id = a[2], p = {}, i = 3
  var pos = a[i] !== undefined && a[i].indexOf("--") !== 0 ? a[i++] : ""
  if (pos && SECTIONS.indexOf(pos) < 0) return "bad section " + pos
  for (; i < a.length; i += 2) {
    var flag = a[i], val = a[i + 1]
    if (val === undefined) return "missing value for " + flag
    if (flag === "--section" || flag === "--from-section") {
      if (SECTIONS.indexOf(val) < 0) return "bad section " + val
      p[flag === "--section" ? "section" : "fromSection"] = val
    } else if (flag === "--index" || flag === "--from-index") {
      if (!/^[0-9]+$/.test(val)) return "index must be a non-negative integer"
      p[flag === "--index" ? "index" : "fromIndex"] = Number(val)
    } else if (flag === "--before" || flag === "--after") p[flag.slice(2)] = val
    else return "unknown option: " + flag
  }
  if (p.before && p.after) return "use only one of --before or --after"
  if (pos && (p.section || p.index !== undefined || p.before || p.after)) return "specify a section positionally or with flags, not both"
  if (pos) p.section = pos
  ensureShape(lay)
  var src
  if (p.fromIndex !== undefined) {
    if (!p.fromSection) return "from-index requires from-section"
    var list = lay[p.fromSection]
    if (p.fromIndex >= list.length) return "no widget at " + p.fromSection + "[" + p.fromIndex + "]"
    if (idOf(list[p.fromIndex]) !== id) return "widget at " + p.fromSection + "[" + p.fromIndex + "] is not " + id
    src = { section: p.fromSection, index: p.fromIndex }
  } else {
    src = find(lay, id, p.fromSection || "")
    if (!src) return "could not find widget " + id
  }
  var entry = lay[src.section].splice(src.index, 1)[0]
  var section = p.section || src.section, at
  if (id === "omarchy.tray" && section === "tray") at = { error: "the tray cannot go in its own drawer" }
  else if (p.before || p.after) {
    var rel = find(lay, p.before || p.after, p.section || "")
    if (!rel) at = { error: "could not find target widget " + (p.before || p.after) }
    else if (id === "omarchy.tray" && rel.section === "tray") at = { error: "the tray cannot go in its own drawer" }
    else at = { section: rel.section, index: rel.index + (p.after ? 1 : 0) }
  } else if (p.index !== undefined) {
    at = { section: section, index: Math.min(p.index, lay[section].length) }
  } else {
    var anchor = ANCHORS[section] ? find(lay, ANCHORS[section], section) : null
    at = { section: section, index: anchor ? anchor.index + 1 : lay[section].length }
  }
  if (at.error) { lay[src.section].splice(src.index, 0, entry); return at.error }
  lay[at.section].splice(at.index, 0, entry); return ""
}

// A move that fails leaves the layout as it was, like the CLI; later moves still run.
function applyMoves(layout, argvList) {
  var lay = layoutOf(layout), list = copy(argvList)
  if (isList(list)) for (var i = 0; i < list.length; i++) try { moveOne(lay, list[i]) } catch (e) {}
  return lay
}
function moveArgv(id, from, i, to, j) {
  return ["omarchy-bar", "move", id, "--from-section", from, "--from-index", String(i), "--section", to, "--index", String(j)]
}

// Moves that turn `layout` into `target`, one exact address each. Fills the target
// section by section, position by position, taking each wanted entry from a spot
// that is not filled yet (its own section first). Proved by replaying the moves.
// `fixed` (an id) is never moved: its slot in `target` is reached by pushing what sits
// in front of it to the end of its section and filling around it.
function planTo(layout, target, errorText, fixed) {
  var work = layoutOf(layout), goal = layoutOf(target), argv = [], fail = { argv: [], error: errorText }
  var shaped = layoutOf(work), have = [], want = []; ensureShape(shaped); ensureShape(goal)
  SECTIONS.forEach(function (s) {
    shaped[s].forEach(function (e) { have.push(keyOf(e)) }); goal[s].forEach(function (e) { want.push(keyOf(e)) })
  })
  if (have.sort().join("\n") !== want.sort().join("\n")) return fail
  var done = {}
  for (var t = 0; t < SECTIONS.length; t++) {
    var S = SECTIONS[t]
    for (var j = 0; j < goal[S].length; j++) {
      done[S] = j
      if (fixed && idOf(goal[S][j]) === fixed) {
        for (var g = work[S].length; g > 0 && j < work[S].length && idOf(work[S][j]) !== fixed; g--) {
          var sid = idOf(work[S][j]), sh = moveArgv(sid, S, j, S, 99999)
          if (!sid || moveOne(work, sh) !== "") return fail
          argv.push(sh)
        }
        continue
      }
      var wanted = keyOf(goal[S][j])
      if (isList(work[S]) && j < work[S].length && keyOf(work[S][j]) === wanted) continue
      var from = null, order = [S].concat(SECTIONS.filter(function (x) { return x !== S }))
      for (var o = 0; o < order.length && !from; o++) {
        var list = isList(work[order[o]]) ? work[order[o]] : []
        for (var i = done[order[o]] || 0; i < list.length; i++) if (keyOf(list[i]) === wanted) { from = { section: order[o], index: i }; break }
      }
      var id = from ? idOf(work[from.section][from.index]) : ""
      if (!id) return fail // shortcut: an entry with no id cannot be moved by the CLI, so the plan fails; the bar skips such entries anyway
      var step = moveArgv(id, from.section, from.index, S, j)
      if (moveOne(work, step) !== "") return fail
      argv.push(step)
    }
    done[S] = goal[S].length
  }
  // Section by section (a missing section is []), so key order never refuses a right plan.
  var check = applyMoves(layout, argv), want = layoutOf(target); ensureShape(check); ensureShape(want)
  var same = SECTIONS.every(function (s) { return check[s].length === want[s].length && check[s].every(function (e, i) { return keyOf(e) === keyOf(want[s][i]) }) })
  return same ? { argv: argv, error: "" } : fail
}
// The painter stays put when it can, so Undo does not move it more than it has to.
function undoPlan(currentLayout, snap) {
  try { var p = planTo(currentLayout, snap, UNDO_ERROR, SELF_ID); return p.error ? planTo(currentLayout, snap, UNDO_ERROR) : p } catch (e) { return { argv: [], error: UNDO_ERROR } }
}

// Returns { argv, error, breaks }. `targets` is the PresetTargets module (QML cannot import it from here).
function presetPlan(layout, presetId, roles, breaks, targets) {
  var brk = breaksOf(breaks)
  try {
    if (!targets || typeof targets.targetFor !== "function" || typeof targets.presetBreaks !== "function")
      return { argv: [], breaks: brk, error: "The preset module is missing (PresetTargets.js was not passed to presetPlan)." }
    var lay = layoutOf(layout), from = {}, target = PRESETS.some(function (p) { return p.id === presetId }) ? targets.targetFor(presetId, roles, lay, from) : null
    if (!target) return { argv: [], breaks: brk, error: "Unknown preset " + String(presetId) + "." }
    if (presetId === "denial" && !strList(roles && roles.workspaces).some(function (id) { return !!find(lay, id) }))
      return { argv: [], breaks: brk, error: "No workspaces widget found on the bar, so the Denial preset has nothing to put in the center." }
    var self = roleOf(roles, "selfId", SELF_ID)
    var plan = planTo(lay, target, "The preset could not be planned for this bar.", self)
    plan.breaks = plan.error ? brk : targets.presetBreaks(brk, target, from, self, presetId === "grouped" || presetId === "spread")
    return plan
  } catch (e) { return { argv: [], breaks: brk, error: "The preset could not be planned for this bar." } }
}
// Pill membership, same rule as Groups.rows: the first widget of an area starts
// pill 1, a later widget starts a new pill when its id is a break.
function pillMembers(lay, breaks, area, selfId) {
  var wanted = strList(breaks && breaks[area]), seen = {}, pill = 0, out = []
  AREAS[area].forEach(function (s) {
    (isList(lay[s]) ? lay[s] : []).forEach(function (e, i) {
      var id = idOf(e)
      if (id === "" || id === selfId) return
      var first = out.length === 0
      if (first || (!seen[id] && wanted.indexOf(id) >= 0)) pill++
      if (!first) seen[id] = true
      out.push({ id: id, section: s, index: i, pill: pill })
    })
  })
  return out
}

// roles is optional: { selfId, centerAnchor }, as in presetPlan. rows is optional: the
// Groups.rows result for this layout, so pill N is the pill the Groups page shows as N
// (solo, no pill and center parts included). Without it, pills come from breaks only.
var STALE = "The pill list is out of date; reopen the panel and try again."
function movePillPlan(layout, breaks, area, pillNumber, targetArea, roles, rows) {
  var brk = breaksOf(breaks)
  try {
    if (!AREAS[area] || !AREAS[targetArea]) return { argv: [], breaks: brk, error: "Unknown area." }
    var self = roleOf(roles, "selfId", SELF_ID), anchor = roleOf(roles, "centerAnchor", ""), lay = layoutOf(layout)
    var all = pillMembers(lay, brk, area, self), n = Number(pillNumber), r = null
    if (rows !== undefined && rows !== null) { // match by position: both skip the painter and entries with no id
      r = copy(rows); r = r && isList(r[area]) ? r[area] : null
      if (!r || r.length !== all.length || !all.every(function (m, i) { return r[i] && r[i].id === m.id })) return { argv: [], breaks: brk, error: STALE }
      all.forEach(function (m, i) { m.pill = r[i].pill })
    }
    var members = all.filter(function (m) { return n >= 1 && m.pill === n }) // a no pill row has pill 0
    if (!members.length) return { argv: [], breaks: brk, error: "There is no pill " + String(pillNumber) + " there." }
    if (area === targetArea) return { argv: [], breaks: brk, error: "" }
    var anchored = anchor && members.filter(function (m) { return m.id === anchor && m.section === "center" }).length
    if (anchored) return { argv: [], breaks: brk, error: "This would move the center anchor (" + anchor + ") out of the center; move it back first or pick another pill." }
    var T = targetArea
    var before = pillMembers(lay, brk, targetArea, self)
    var tail = before.filter(function (m) { return SECTIONS.indexOf(m.section) > SECTIONS.indexOf(T) })
    var argv = [], gone = {}, end = isList(lay[T]) ? lay[T].length : 0
    members.forEach(function (m, k) { argv.push(moveArgv(m.id, m.section, m.index - (gone[m.section] || 0), T, end + k)); gone[m.section] = (gone[m.section] || 0) + 1 })
    var ids = members.map(function (m) { return m.id }), keep = function (id) { return ids.indexOf(id) < 0 }
    brk[area] = brk[area].filter(keep); brk[targetArea] = brk[targetArea].filter(keep)
    // With rows, the neighbours of the pill stay apart (a solo pill was what split them).
    var at = all.indexOf(members[0]), prev = r && r[at - 1], next = r && r[at + members.length]
    if (prev && next && prev.pill > 0 && next.pill > 0 && !next.repeat && next.forcedBy !== "centerPart" && brk[area].indexOf(next.id) < 0) brk[area].push(next.id)
    // The pill stays its own pill: it starts one, and the widget after it (centerEnd) starts the next.
    if (before.length) brk[targetArea].push(ids[0])
    if (tail.length && brk[targetArea].indexOf(tail[0].id) < 0) brk[targetArea].push(tail[0].id)
    return { argv: argv, breaks: brk, error: "" }
  } catch (e) { return { argv: [], breaks: brk, error: "The pill could not be moved." } }
}

if (typeof module !== "undefined") {
  module.exports = { PRESETS: PRESETS, SELF_ID: SELF_ID, snapshot: snapshot, applyMoves: applyMoves, presetPlan: presetPlan, movePillPlan: movePillPlan, undoPlan: undoPlan }
}
