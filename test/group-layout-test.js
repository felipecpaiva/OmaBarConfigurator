// node test/group-layout-test.js
var assert = require("assert")
var G = require("../lib/GroupLayout.js")

function S(id, start, end) { return { id: id, start: start, end: end } }
function run(left, breaks, opts, area) {
  var areas = {}; areas[area || "left"] = left
  var b = {}; b[area || "left"] = breaks || []
  return G.pills(areas, b, opts || { padding: 0, gap: 0 })[area || "left"]
}
var row = [S("a", 0, 10), S("b", 10, 20), S("c", 20, 30), S("d", 30, 40)]

var tests = [
  ["one pill per area", function () {
    var r = G.pills({ left: row, center: [S("x", 0, 5)], right: [S("y", 0, 5)] }, {}, { padding: 0, gap: 0 })
    assert.deepStrictEqual(r.left, [{ start: 0, end: 40, ids: ["a", "b", "c", "d"] }])
    assert.strictEqual(r.center.length, 1)
    assert.strictEqual(r.right.length, 1)
  }],
  ["empty area gives no pills", function () {
    var r = G.pills({ left: [], right: row }, {}, {})
    assert.deepStrictEqual(r.left, [])
    assert.deepStrictEqual(r.center, [])
  }],
  ["hidden and zero-size slots ignored", function () {
    var r = run([S("h", 5, 5), S("a", 0, 10), S("n", NaN, 3), S("i", 1, Infinity), S("neg", 9, 4)])
    assert.deepStrictEqual(r, [{ start: 0, end: 10, ids: ["a"] }])
    assert.deepStrictEqual(run([S("h", 5, 5)]), [])
  }],
  ["unsorted input is sorted", function () {
    var r = run([row[2], row[0], row[3], row[1]])
    assert.deepStrictEqual(r[0].ids, ["a", "b", "c", "d"])
  }],
  ["one break", function () {
    var r = run(row, ["c"])
    assert.deepStrictEqual(r.map(function (p) { return p.ids.join("") }), ["ab", "cd"])
  }],
  ["several breaks", function () {
    var r = run(row, ["b", "d"])
    assert.deepStrictEqual(r.map(function (p) { return p.ids.join("") }), ["a", "bc", "d"])
  }],
  ["break on first slot is a no-op", function () {
    assert.strictEqual(run(row, ["a"]).length, 1)
  }],
  ["unknown break id is a no-op", function () {
    assert.strictEqual(run(row, ["zzz"]).length, 1)
  }],
  ["duplicate break ids count once", function () {
    assert.strictEqual(run(row, ["c", "c"]).length, 2)
  }],
  ["repeated widget id breaks at first match", function () {
    var r = run([S("a", 0, 10), S("t", 10, 20), S("b", 20, 30), S("t", 30, 40)], ["t"])
    assert.deepStrictEqual(r.map(function (p) { return p.ids.join("") }), ["a", "tbt"])
  }],
  ["widget added after a break joins the pill before the next break", function () {
    var before = run(row, ["c"])
    var after = run(row.slice(0, 2).concat([S("new", 20, 30), S("c", 30, 40), S("d", 40, 50)]), ["c"])
    assert.deepStrictEqual(before.map(function (p) { return p.ids.join("") }), ["ab", "cd"])
    assert.deepStrictEqual(after.map(function (p) { return p.ids.join("") }), ["abnew", "cd"])
  }],
  ["center area as one", function () {
    var r = G.pills({ center: [S("a", 100, 110), S("b", 110, 130), S("c", 300, 320)] }, {}, {})
    assert.strictEqual(r.center.length, 1)
    assert.deepStrictEqual([r.center[0].start, r.center[0].end], [100, 320])
  }],
  ["padding applied", function () {
    var r = run(row, [], { padding: 6, gap: 0 })
    assert.deepStrictEqual([r[0].start, r[0].end], [-6, 46])
  }],
  ["gap clamp between touching neighbours", function () {
    // content edges 8 apart (mid = 24): padded pills would overlap, so each backs off gap/2
    var r = run([S("a", 0, 20), S("b", 28, 48)], ["b"], { padding: 8, gap: 4 })
    assert.deepStrictEqual([r[0].start, r[0].end], [-8, 22])
    assert.deepStrictEqual([r[1].start, r[1].end], [26, 56])
  }],
  ["touching neighbours get exactly gap between pills", function () {
    var t = run(row, ["c"], { padding: 8, gap: 4 })
    assert.deepStrictEqual([t[0].end, t[1].start], [18, 22])
    assert.strictEqual(t[1].start - t[0].end, 4)
    // far apart: padding already leaves room, no clamp
    var w = run([S("a", 0, 10), S("b", 100, 110)], ["b"], { padding: 5, gap: 4 })
    assert.deepStrictEqual([w[0].end, w[1].start], [15, 95])
  }],
  ["pill never shorter than 1px", function () {
    // 0.5px-wide slots, big gap: clamp would invert both pills, so slot bounds are kept
    var r = run([S("a", 0, 0.5), S("b", 0.5, 1)], ["b"], { padding: 0, gap: 10 })
    assert.deepStrictEqual([r[0].start, r[0].end, r[1].start, r[1].end], [0, 0.5, 0.5, 1])
  }],
  ["vertical-style coordinates", function () {
    var r = run([S("a", 4, 28), S("b", 32, 52)], ["b"], { padding: 3, gap: 2 })
    assert.deepStrictEqual([r[0].start, r[0].end, r[1].start, r[1].end], [1, 29, 31, 55])
  }],
  ["garbage input never throws", function () {
    [undefined, null, 5, "x", [], {}].forEach(function (g) {
      var r = G.pills(g, g, g)
      assert.deepStrictEqual(r, { left: [], center: [], right: [] })
    })
    var r = G.pills({ left: "no", center: [null, 3, {}], right: row }, { right: "c" }, { padding: NaN, gap: -5 })
    assert.deepStrictEqual(r.left, [])
    assert.deepStrictEqual(r.center, [])
    assert.deepStrictEqual(r.right, [{ start: 0, end: 40, ids: ["a", "b", "c", "d"] }])
    var n = run(row, ["c"], { padding: -3, gap: -1 })
    assert.deepStrictEqual([n[0].start, n[0].end], [0, 20])
  }],
  ["outer pills stop at the min and max bounds", function () {
    var r = G.pills({ left: [{ id: "a", start: 8, end: 40 }], right: [{ id: "z", start: 1200, end: 1272 }] }, {},
      { padding: 12, gap: 8, min: 5, max: 1275 })
    assert.deepStrictEqual([r.left[0].start, r.left[0].end], [5, 52])
    assert.deepStrictEqual([r.right[0].start, r.right[0].end], [1188, 1275])
    var free = G.pills({ left: [{ id: "a", start: 8, end: 40 }] }, {}, { padding: 12 })
    assert.strictEqual(free.left[0].start, -4)
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
