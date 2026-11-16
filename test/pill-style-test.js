// node test/pill-style-test.js
var assert = require("assert")
var P = require("../lib/PillStyle.js")
var tests = []
function test(name, fn) { tests.push([name, fn]) }

test("defaults for empty input", function() {
  var n = P.normalize(undefined)
  assert.deepStrictEqual(n.style, P.DEFAULTS)
  assert.deepStrictEqual(n.warnings, [])
  assert.strictEqual(n.style.enabled, false)
})
test("clamps every ranged number", function() {
  var s = P.normalize({ fillOpacity: 5, borderOpacity: -1, borderWidth: 9, radius: 5000, padding: -3, gap: 99, inset: 50 }).style
  assert.deepStrictEqual([s.fillOpacity, s.borderOpacity, s.borderWidth, s.radius, s.padding, s.gap, s.inset], [1, 0, 4, 999, 0, 32, 12])
})
test("wrong types fall back with one warning each", function() {
  var n = P.normalize({ gap: "wide", enabled: "yes", color: "teal", radius: NaN })
  assert.strictEqual(n.warnings.length, 4)
  assert.strictEqual(n.style.gap, 8)
  assert.strictEqual(n.style.enabled, false)
  assert.strictEqual(n.style.color, "background")
  assert.strictEqual(n.style.radius, 999)
  assert.ok(n.warnings.some(function(w) { return w.indexOf("style.gap") >= 0 }))
})
test("LIMITS cover every number default and radiusFollowsWindows is a boolean", function() {
  Object.keys(P.DEFAULTS).forEach(function(k) {
    if (typeof P.DEFAULTS[k] === "number") assert.ok(P.LIMITS[k], k)
  })
  assert.strictEqual(P.DEFAULTS.radiusFollowsWindows, false)
  assert.strictEqual(P.normalize({ radiusFollowsWindows: true }).style.radiusFollowsWindows, true)
  var n = P.normalize({ radiusFollowsWindows: "yes" })
  assert.strictEqual(n.style.radiusFollowsWindows, false)
  assert.strictEqual(n.warnings.length, 1)
})
test("valid values are kept", function() {
  var s = P.normalize({ enabled: true, color: "#112233", borderColor: "accent", gap: 4 }).style
  assert.deepStrictEqual([s.enabled, s.color, s.borderColor, s.gap], [true, "#112233", "accent", 4])
})
test("resolveColor: role, hex, #aarrggbb, fallback", function() {
  var pal = { background: "#80102030", foreground: "#ffffff", accent: "#abcdef" }
  assert.strictEqual(P.resolveColor("accent", pal, "#000000"), "#abcdef")
  assert.strictEqual(P.resolveColor("background", pal, "#000000"), "#102030")
  assert.strictEqual(P.resolveColor("#AABBCC", pal, "#000000"), "#aabbcc")
  assert.strictEqual(P.resolveColor("urgent", pal, "#123456"), "#123456")
  assert.strictEqual(P.resolveColor("nope", pal, "#123456"), "#123456")
  assert.strictEqual(P.resolveColor("#12", pal, "#123456"), "#123456")
  assert.strictEqual(P.resolveColor(5, null, "#123456"), "#123456")
})
test("readStore: empty text", function() {
  var r = P.readStore("")
  assert.strictEqual(r.version, 2)
  assert.deepStrictEqual(r.hidden, [])
  assert.deepStrictEqual(r.style, P.DEFAULTS)
  assert.deepStrictEqual(r.groups, { breaks: { left: [], center: [], right: [] } })
  assert.deepStrictEqual(r.warnings, [])
})
test("readStore: v1 migration keeps hidden", function() {
  var r = P.readStore(JSON.stringify({ version: 1, hidden: [{ id: "a" }, "b"] }))
  assert.strictEqual(r.version, 2)
  assert.deepStrictEqual(r.hidden, [{ id: "a" }, "b"])
  assert.deepStrictEqual(r.style, P.DEFAULTS)
})
test("readStore: broken JSON and non-objects never throw", function() {
  ;["{not json", "[1,2]", "null", "42"].forEach(function(t) {
    var r = P.readStore(t)
    assert.deepStrictEqual(r.hidden, [])
    assert.strictEqual(r.warnings.length, 1)
  })
})
test("readStore: bad style key warns, bad hidden is empty", function() {
  var r = P.readStore(JSON.stringify({ hidden: "x", style: { gap: "no" } }))
  assert.deepStrictEqual(r.hidden, [])
  assert.strictEqual(r.warnings.length, 1)
})
test("breaks keep only string ids per area", function() {
  var r = P.readStore(JSON.stringify({ groups: { breaks: { left: ["a", 3, null, "", "b"], center: "x", up: ["z"] } } }))
  assert.deepStrictEqual(r.groups.breaks, { left: ["a", "b"], center: [], right: [] })
})
test("writeStore keeps unknown top keys and sets version 2", function() {
  var out = P.writeStore(JSON.stringify({ version: 1, future: { a: 1 }, hidden: [] }), { hidden: ["x"] })
  var o = JSON.parse(out)
  assert.deepStrictEqual(o.future, { a: 1 })
  assert.deepStrictEqual(o.hidden, ["x"])
  assert.strictEqual(o.version, 2)
  assert.ok(out.endsWith("}\n"))
})
test("round trip: style survives hidden write, hidden survives style write", function() {
  var t = P.writeStore("", { style: { enabled: true, gap: 3 }, groups: { breaks: { left: ["a"] } } })
  t = P.writeStore(t, { hidden: [{ id: "h" }] })
  var r = P.readStore(t)
  assert.strictEqual(r.style.enabled, true)
  assert.strictEqual(r.style.gap, 3)
  assert.deepStrictEqual(r.groups.breaks.left, ["a"])
  t = P.writeStore(t, { style: { enabled: false } })
  r = P.readStore(t)
  assert.deepStrictEqual(r.hidden, [{ id: "h" }])
  assert.strictEqual(r.style.enabled, false)
})
test("writeStore survives broken previous text and bad patch", function() {
  assert.deepStrictEqual(JSON.parse(P.writeStore("{oops", { hidden: [] })), { hidden: [], version: 2 })
  assert.deepStrictEqual(JSON.parse(P.writeStore("", null)), { version: 2 })
})
test("patchStore keeps unknown style and groups keys, writes no defaults", function() {
  var prev = JSON.stringify({ style: { gap: 3, future: 1 }, groups: { breaks: { left: ["a"] }, mode: "x" }, hidden: ["h"] })
  var o = JSON.parse(P.patchStore(prev, "style", { enabled: true }))
  assert.deepStrictEqual(o.style, { gap: 3, future: 1, enabled: true })
  assert.deepStrictEqual(o.hidden, ["h"])
  assert.strictEqual(o.version, 2)
  o = JSON.parse(P.patchStore(prev, "groups", { breaks: { right: ["b"] } }))
  assert.deepStrictEqual(o.groups, { breaks: { left: ["a"], right: ["b"] }, mode: "x" })
  assert.deepStrictEqual(JSON.parse(P.patchStore("", "style", { gap: 2 })).style, { gap: 2 })
})
test("undo: absent or bad is null, good one round trips, patches keep it, null clears it", function() {
  assert.strictEqual(P.readStore("").undo, null)
  assert.strictEqual(P.readStore(JSON.stringify({ undo: "x" })).undo, null)
  assert.strictEqual(P.readStore(JSON.stringify({ undo: { layout: [] } })).undo, null)
  var u = { layout: { left: ["a"], right: [{ id: "b", x: 1 }] }, breaks: { left: ["a", 3] }, label: "Moved a pill", at: "2026-11-16T10:00:00.000Z" }
  var t = P.writeStore(JSON.stringify({ hidden: [{ id: "h" }] }), { undo: u })
  var r = P.readStore(t)
  assert.deepStrictEqual(r.undo.layout, u.layout)
  assert.deepStrictEqual(r.undo.breaks, { left: ["a"], center: [], right: [] })
  assert.strictEqual(r.undo.label, "Moved a pill")
  assert.strictEqual(r.undo.at, u.at)
  assert.deepStrictEqual(r.hidden, [{ id: "h" }])
  t = P.patchStore(t, "style", { enabled: true })
  t = P.patchStore(t, "groups", { breaks: { right: ["b"] } })
  t = P.writeStore(t, { hidden: [] })
  assert.deepStrictEqual(P.readStore(t).undo.layout, u.layout)
  var loose = P.readStore(JSON.stringify({ undo: { layout: {}, label: 5 } })).undo
  assert.deepStrictEqual([loose.label, loose.at, loose.breaks], ["", "", null])
  t = P.writeStore(t, { undo: null })
  assert.strictEqual("undo" in JSON.parse(t), false)
  assert.strictEqual(P.readStore(t).undo, null)
  assert.strictEqual(P.readStore(t).style.enabled, true)
})
test("patchStore round trip with hidden", function() {
  var t = P.writeStore("", { hidden: [{ id: "h" }] })
  t = P.patchStore(t, "style", { enabled: true })
  var r = P.readStore(t)
  assert.deepStrictEqual(r.hidden, [{ id: "h" }])
  assert.strictEqual(r.style.enabled, true)
  assert.strictEqual(r.style.gap, 8)
})

var failed = 0
tests.forEach(function(p) {
  try { p[1](); console.log("ok   " + p[0]) }
  catch (e) { failed++; console.log("FAIL " + p[0] + "\n       " + e.message) }
})
console.log("\n" + (tests.length - failed) + "/" + tests.length + " passed")
process.exit(failed ? 1 : 0)
