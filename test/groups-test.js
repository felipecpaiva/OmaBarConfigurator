// node test/groups-test.js
var assert = require("assert")
var Groups = require("../lib/Groups.js")
var GL = require("../lib/GroupLayout.js")

var SELF = "io.github.felipecpaiva.omabarconfigurator"
function ids(rows) { return rows.map(function (r) { return r.id }) }
function pills(rows) { return rows.map(function (r) { return r.pill }) }
var lay = { left: [{ id: "a" }, "b", { id: "c" }, { id: "d" }] }

var tests = [
  ["empty layout", function () {
    assert.deepStrictEqual(Groups.rows({}, {}, SELF), { left: [], center: [], right: [] })
    assert.deepStrictEqual(Groups.pillCount(Groups.rows({}, {}, SELF)), { left: 0, center: 0, right: 0 })
  }],
  ["one area, no breaks is one pill", function () {
    var r = Groups.rows(lay, {}, SELF)
    assert.deepStrictEqual(ids(r.left), ["a", "b", "c", "d"])
    assert.deepStrictEqual(pills(r.left), [1, 1, 1, 1])
    assert.deepStrictEqual(r.left.map(function (x) { return x.first }), [true, false, false, false])
    assert.strictEqual(Groups.pillCount(r).left, 1)
  }],
  ["breaks split pills", function () {
    var r = Groups.rows(lay, { left: ["c", "d"] }, SELF)
    assert.deepStrictEqual(pills(r.left), [1, 1, 2, 3])
    assert.deepStrictEqual(r.left.map(function (x) { return x.startsPill }), [true, false, true, true])
    assert.strictEqual(Groups.pillCount(r).left, 3)
  }],
  ["break on the first widget is not a split", function () {
    var r = Groups.rows(lay, { left: ["a"] }, SELF)
    assert.deepStrictEqual(pills(r.left), [1, 1, 1, 1])
  }],
  ["unknown break id ignored", function () {
    assert.deepStrictEqual(pills(Groups.rows(lay, { left: ["zzz"] }, SELF).left), [1, 1, 1, 1])
  }],
  ["repeated id: only the first copy carries the break", function () {
    var r = Groups.rows({ left: ["a", "b", "x", "c", "x"] }, { left: ["x"] }, SELF)
    assert.deepStrictEqual(pills(r.left), [1, 1, 2, 2, 2])
    assert.deepStrictEqual(r.left.map(function (x) { return x.startsPill }), [true, false, true, false, false])
  }],
  ["later copies of an id are marked repeat", function () {
    var r = Groups.rows({ left: ["a", "x", "b", "x"] }, { left: ["x"] }, SELF)
    assert.deepStrictEqual(r.left.map(function (w) { return w.repeat }), [false, false, false, true])
  }],
  ["selfId and tray are skipped", function () {
    var r = Groups.rows({ left: [SELF, "a", "b"], tray: ["t"] }, { left: [SELF] }, SELF)
    assert.deepStrictEqual(ids(r.left), ["a", "b"])
    assert.strictEqual(r.left[0].first, true)
    assert.deepStrictEqual(r.right, [])
  }],
  ["center order is begin, center, end", function () {
    var r = Groups.rows({ centerBegin: ["b1"], center: ["c1", "c2"], centerEnd: ["e1"] }, { center: ["c2"] }, SELF)
    assert.deepStrictEqual(ids(r.center), ["b1", "c1", "c2", "e1"])
    assert.deepStrictEqual(pills(r.center), [1, 1, 2, 2])
  }],
  ["toggle on and off", function () {
    var on = Groups.toggleBreak({ left: ["x"] }, "left", "c")
    assert.deepStrictEqual(on, { left: ["x", "c"], center: [], right: [] })
    assert.deepStrictEqual(Groups.toggleBreak(on, "left", "c").left, ["x"])
  }],
  ["toggle does not mutate and normalizes", function () {
    var src = { left: ["a", "a", 5, ""], center: "oops" }
    var copy = JSON.stringify(src)
    var out = Groups.toggleBreak(src, "right", "z")
    assert.strictEqual(JSON.stringify(src), copy)
    assert.deepStrictEqual(out, { left: ["a"], center: [], right: ["z"] })
    assert.notStrictEqual(out.left, src.left)
  }],
  ["garbage input never throws", function () {
    [null, undefined, 3, "s", [], { left: 5 }, { left: { length: "x" } }, { left: [null, undefined, {}, 7] }].forEach(function (g) {
      Groups.rows(g, g, g); Groups.toggleBreak(g, g, g); Groups.pillCount(g)
    })
    assert.deepStrictEqual(Groups.toggleBreak(null, "nope", "a"), { left: [], center: [], right: [] })
  }],
  ["array-likes without Array.isArray are read", function () {
    var like = { length: 2, 0: "a", 1: "b" }
    assert.deepStrictEqual(ids(Groups.rows({ left: like }, { left: { length: 1, 0: "b" } }, SELF).left), ["a", "b"])
  }],
  ["agrees with GroupLayout.pills", function () {
    var layout = { left: ["a", "b", "x", "c", "x", "d"], centerBegin: ["m"], center: ["n", "o"], centerEnd: ["p"], right: ["r", SELF, "s"] }
    var breaks = { left: ["x", "a", "d"], center: ["o", "p"], right: ["s", "ghost"] }
    var r = Groups.rows(layout, breaks, SELF)
    var slots = {}
    Object.keys(r).forEach(function (area) {
      slots[area] = r[area].map(function (w, i) { return { id: w.id, start: i * 10, end: i * 10 + 10 } })
    })
    var got = GL.pills(slots, breaks, { padding: 0, gap: 0 })
    Object.keys(r).forEach(function (area) {
      var fromRows = []
      r[area].forEach(function (w) { (fromRows[w.pill - 1] = fromRows[w.pill - 1] || []).push(w.id) })
      assert.deepStrictEqual(got[area].map(function (p) { return p.ids }), fromRows, area)
    })
  }],
  ["agrees with GroupLayout when the first id repeats", function () {
    var breaks = { left: ["a"] }
    var r = Groups.rows({ left: ["a", "b", "a"] }, breaks, SELF)
    var slots = { left: r.left.map(function (w, i) { return { id: w.id, start: i * 10, end: i * 10 + 10 } }) }
    assert.deepStrictEqual(GL.pills(slots, breaks, { padding: 0, gap: 0 }).left.map(function (p) { return p.ids }), [["a", "b"], ["a"]])
    assert.deepStrictEqual(pills(r.left), [1, 1, 2])
  }]
]

var failed = 0
tests.forEach(function (pair) {
  try { pair[1]() } catch (e) {
    failed++
    console.log("FAIL " + pair[0])
    console.log("       " + (e && e.message ? String(e.message).split("\n").join("\n       ") : e))
  }
})
console.log("\n" + (tests.length - failed) + "/" + tests.length + " passed")
process.exit(failed ? 1 : 0)
