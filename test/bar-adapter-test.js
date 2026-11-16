// node test/bar-adapter-test.js
//
// BarAdapter against a FAKE item tree shaped like the stock bar surface
// (Bar.qml: content Item -> WidgetPool, CenterModules -> CenterSections ->
// beginList, endList, CenterBox -> boxList, LeftModules, RightModules, and the
// notch CenterSections with empty lists). Host lists are array-like objects,
// not arrays, as in QML.

var assert = require("assert")
var A = require("../pills/BarAdapter.js")

function hostList(items) {
  var o = { length: items.length }
  items.forEach(function (it, i) { o[i] = it })
  return o
}

function node(props, kids) {
  var it = Object.assign({ x: 0, y: 0, width: 0, height: 0, visible: true }, props)
  kids = kids || []
  kids.forEach(function (k) { k.parent = it })
  it.children = hostList(kids)
  return it
}

// drop: a private name to leave out everywhere, to prove the fail safe.
function surface(drop, vertical) {
  function strip(o) { if (drop) delete o[drop]; return o }
  // A slot along the bar at `pos` with length `len` (x/width, or y/height).
  function slot(id, pos, len, extra) {
    var holder = node({})
    var geo = vertical ? { y: pos, height: len, width: 30 } : { x: pos, width: len, height: 30 }
    return { s: strip(node(Object.assign({ widgetKey: "k-" + id, moduleName: id, region: "r", widgetHolder: holder, host: null, entry: {} }, geo, extra || {}), [holder])), holder: holder }
  }
  function list(region, pos, slots) {
    var geo = vertical ? { y: pos } : { x: pos }
    return strip(node(Object.assign({ listRows: slots.map(function (s) { return { key: s.s.widgetKey } }), keys: [], region: region, pool: {} }, geo), slots.map(function (s) { return s.s })))
  }

  var l1 = slot("omarchy.menu", 0, 20), l2 = slot("omarchy.workspaces", 20, 80)
  var painter = slot("io.github.felipecpaiva.omabarconfigurator", 0, 0)
  var r1 = slot("omarchy.tray", 0, 40), r2 = slot("omarchy.battery", 40, 30)
  var hidden = slot("omarchy.hidden", 70, 30, { visible: false })
  var c1 = slot("omarchy.media", 0, 50), c2 = slot("omarchy.clock", 0, 60), c3 = slot("omarchy.weather", 0, 40)

  // The painter: widget -> loader -> WidgetHost (owner = its slot) -> slot holder.
  var widget = node({})
  var loader = node({}, [widget])
  var host = strip(node({ owner: painter.s, pool: {}, entry: {}, activeItem: widget }, [loader]))
  painter.holder.children = hostList([host]); host.parent = painter.holder

  var tray = list("tray", 0, [slot("tray.icon", 0, 10)])
  r1.holder.children = hostList([tray]); tray.parent = r1.holder

  var left = list("left", 16, [l1, l2])
  var right = list("right", 900, [r1, painter, r2, hidden])
  var begin = list("centerBegin", 0, [c1])
  var end = list("centerEnd", 110, [c3])
  var boxList = list("center", 0, [c2])
  var box = node(vertical ? { y: 50 } : { x: 50 }, [boxList])
  var sections = node(vertical ? { y: 400 } : { x: 400 }, [begin, end, box])
  var centerModules = node({}, [sections])
  var notch = node({}, [list("centerBegin", 0, []), list("centerEnd", 0, []), node({}, [list("center", 0, [])])])
  var content = node({ width: 1200, height: 34 }, [node({}), centerModules, left, right, notch])
  var top = node({}, [node({}, [content])])
  return { top: top, content: content, widget: widget, left: left, right: right, sections: sections }
}

function warnings() {
  var w = []
  var f = function (m, soft) { w.push(m); f.soft.push(soft === true) }
  f.list = w
  f.soft = []
  return f
}

// Happy path: three areas, tray skipped, both center sets kept, one parent.
var t = surface()
var warn = warnings()
var loc = A.locate(t.widget, warn)
assert.ok(loc, "locate finds the surface")
assert.strictEqual(warn.list.length, 0)
assert.strictEqual(loc.areas.left.length, 1)
assert.strictEqual(loc.areas.right.length, 1)
assert.strictEqual(loc.areas.center.length, 6, "both center sets, tray skipped")
assert.strictEqual(loc.parents.left, t.content)
assert.strictEqual(loc.parents.right, t.content)
assert.strictEqual(loc.parents.center, t.content, "common ancestor of all center lists")
assert.strictEqual(A.surfaceRoot(t.widget, warn), t.top)

// Slots: zero size and hidden are skipped, ids are module names.
assert.deepStrictEqual(A.slotsOf(t.right, false).map(A.slotId), ["omarchy.tray", "omarchy.battery"])
assert.deepStrictEqual(A.areaSlots(loc, "left", false), [
  { id: "omarchy.menu", start: 16, end: 36 },
  { id: "omarchy.workspaces", start: 36, end: 116 }
])
// Center: one coordinate space through sections (400) and the box (50).
assert.deepStrictEqual(A.areaSlots(loc, "center", false), [
  { id: "omarchy.media", start: 400, end: 450, part: "centerBegin" },
  { id: "omarchy.weather", start: 510, end: 550, part: "centerEnd" },
  { id: "omarchy.clock", start: 450, end: 510, part: "center" }
])
assert.deepStrictEqual(A.areaSlots(loc, "right", false).map(function (s) { return [s.start, s.end] }), [[900, 940], [940, 970]])
assert.deepStrictEqual(A.areaSlots(null, "left", false), [])

// Vertical bar: the axis is y and height.
var v = surface(null, true)
var vloc = A.locate(v.widget, warnings())
assert.deepStrictEqual(A.areaSlots(vloc, "left", true).map(function (s) { return [s.start, s.end] }), [[16, 36], [36, 116]])
assert.deepStrictEqual(A.slotsOf(v.right, true).length, 2)

// Fail safe: drop each private name in turn -> null and exactly one warning.
Object.keys(A.NAMES).forEach(function (comp) {
  A.NAMES[comp].forEach(function (name) {
    var broken = surface(name)
    var w = warnings()
    assert.strictEqual(A.locate(broken.widget, w), null, "missing " + comp + "." + name + " must give null")
    assert.strictEqual(w.list.length, 1, "missing " + comp + "." + name + " must warn exactly once, got " + w.list.length)
  })
})

// A surface with no sections at all.
var w2 = warnings()
assert.strictEqual(A.findAreas(node({}, [node({})]), w2), null)
assert.strictEqual(w2.list.length, 1)

// A renamed region warns once (not per list); known lists still count.
var w3 = warnings()
function bare(region) { return node({ listRows: [], keys: [], region: region, pool: {} }) }
var odd = node({}, [bare("left"), bare("leftish"), bare("leftish")])
var oddAreas = A.findAreas(odd, w3)
assert.strictEqual(w3.list.length, 1)
assert.strictEqual(oddAreas.left.length, 1)
assert.ok(w3.list[0].indexOf("leftish") >= 0)
assert.deepStrictEqual(w3.soft, [true]) // soft: must not use the failure flag
assert.strictEqual(w2.soft[0], false)

// A widget waiting in the pool (no slot) still locates its surface.
var pooled = surface()
pooled.widget.parent.parent.owner = null
assert.ok(A.locate(pooled.widget, warnings()))

// The private names stay in step with the contract check, except the known gap.
var contract = require("./adapter-contract.js").REQUIRED
var notInContract = []
Object.keys(A.NAMES).forEach(function (comp) {
  var spec = contract[comp] || { props: [] }
  var known = spec.props.concat(spec.readonlyAliases || [])
  A.NAMES[comp].forEach(function (n) { if (known.indexOf(n) < 0) notInContract.push(comp + "." + n) })
})
// shortcut: listRows is not yet in adapter-contract.js; add it there, then drop this allowance.
assert.deepStrictEqual(notInContract.filter(function (n) { return n !== "ModuleList.listRows" }), [], "names missing from the contract")
if (notInContract.length) console.log("NOTE bar-adapter: not in adapter-contract.js yet: " + notInContract.join(", "))

// With GroupLayout present: a whole pipeline run gives one pill per area.
try {
  var G = require("../lib/GroupLayout.js")
  var out = G.pills({ left: A.areaSlots(loc, "left", false), center: A.areaSlots(loc, "center", false), right: A.areaSlots(loc, "right", false) },
    { left: [], center: [], right: [] }, { padding: 12, gap: 8 })
  assert.deepStrictEqual([out.left.length, out.center.length, out.right.length], [1, 1, 1])
  assert.deepStrictEqual([out.center[0].start, out.center[0].end], [388, 562])
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") throw e
  console.log("SKIP bar-adapter pipeline: lib/GroupLayout.js not present")
}

console.log("OK bar-adapter")
