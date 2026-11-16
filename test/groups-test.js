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

// Seeded PRNG (mulberry32) so a failure replays.
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

tests.push(
  ["modes and pill numbers", function () {
    var r = Groups.rows(lay, {}, SELF, { solo: ["b"], noPill: ["d"] })
    assert.deepStrictEqual(r.left.map(function (x) { return x.mode }), ["shared", "solo", "shared", "none"])
    assert.deepStrictEqual(pills(r.left), [1, 2, 3, 0])
    assert.deepStrictEqual(r.left.map(function (x) { return x.startsPill }), [true, true, true, false])
    assert.strictEqual(Groups.pillCount(r).left, 3)
  }],
  ["no rules means every row is shared", function () {
    Groups.rows(lay, {}, SELF).left.forEach(function (x) { assert.strictEqual(x.mode, "shared") })
    Groups.rows(lay, {}, SELF, null)
  }],
  ["noPill closes the open pill, centerParts splits center", function () {
    var r = Groups.rows({ left: ["a", "n", "b"] }, {}, SELF, { noPill: ["n"] })
    assert.deepStrictEqual(pills(r.left), [1, 0, 2])
    r = Groups.rows({ centerBegin: ["a"], center: ["b"], centerEnd: ["c"] }, {}, SELF, { centerParts: true })
    assert.deepStrictEqual(pills(r.center), [1, 2, 3])
  }],
  ["setMode moves ids between lists and keeps other keys", function () {
    var g = { breaks: { left: [] }, solo: ["a"], noPill: ["b"], centerParts: true }
    var copy = JSON.stringify(g)
    var s = Groups.setMode(g, "b", "solo")
    assert.deepStrictEqual([s.solo, s.noPill], [["a", "b"], []])
    assert.deepStrictEqual([s.breaks, s.centerParts], [g.breaks, true])
    assert.deepStrictEqual(Groups.setMode(s, "a", "none").noPill, ["a"])
    assert.deepStrictEqual(Groups.setMode(s, "a", "none").solo, ["b"])
    var sh = Groups.setMode(s, "a", "shared")
    assert.deepStrictEqual([sh.solo, sh.noPill], [["b"], []])
    assert.strictEqual(JSON.stringify(g), copy)
    assert.deepStrictEqual(Groups.setMode(null, "a", "solo"), { solo: ["a"], noPill: [] })
    assert.deepStrictEqual(Groups.setMode({}, 5, "solo"), { solo: [], noPill: [] })
  }],
  ["random layouts and rules agree with GroupLayout", function () {
    var rand = rng(20261116)
    var pick = function (a) { return a[Math.floor(rand() * a.length)] }
    var pool = ["a", "b", "c", "d", "e", "f"]
    var subset = function () { return pool.filter(function () { return rand() < 0.3 }) }
    for (var n = 0; n < 400; n++) {
      var layout = {}
      ;["left", "centerBegin", "center", "centerEnd", "right"].forEach(function (key) {
        layout[key] = []
        for (var i = rand() * 5 | 0; i > 0; i--) layout[key].push(pick(pool.concat([SELF])))
      })
      var breaks = { left: subset(), center: subset(), right: subset() }
      var rules = { solo: subset(), noPill: subset(), centerParts: rand() < 0.5 }
      var r = Groups.rows(layout, breaks, SELF, rules)
      var slots = {}
      var want = {}
      Object.keys(r).forEach(function (area) {
        var parts = area === "center" ? ["centerBegin", "center", "centerEnd"] : [area]
        var at = 0
        slots[area] = []
        parts.forEach(function (key) {
          layout[key].forEach(function (id) {
            if (id === SELF) return
            slots[area].push({ id: id, part: key, start: at * 10, end: at * 10 + 10 }); at++
          })
        })
        want[area] = []
        r[area].forEach(function (w) { if (w.pill > 0) (want[area][w.pill - 1] = want[area][w.pill - 1] || []).push(w.id) })
      })
      var got = GL.pills(slots, breaks, { padding: 0, gap: 0, solo: rules.solo, noPill: rules.noPill, centerParts: rules.centerParts })
      Object.keys(r).forEach(function (area) {
        var msg = JSON.stringify({ layout: layout, breaks: breaks, rules: rules, area: area })
        assert.deepStrictEqual(got[area].map(function (p) { return p.ids }), want[area], msg)
        r[area].forEach(function (w) { assert.strictEqual(w.pill === 0, w.mode === "none", msg) })
      })
    }
  }]
)

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
