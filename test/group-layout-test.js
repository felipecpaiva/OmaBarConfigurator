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
  ["ink: padding counts from visible content, not the widget box", function () {
    // a: box 0-40, icon 2-38 (drawn at its edges); b: box 40-100, icon 60-80 (wide margins)
    var slots = { left: [{ id: "a", start: 0, end: 40, inkStart: 2, inkEnd: 38 }, { id: "b", start: 40, end: 100, inkStart: 60, inkEnd: 80 }] }
    var one = G.pills(slots, {}, { padding: 10, gap: 4 }).left
    assert.deepStrictEqual([one[0].start, one[0].end], [-8, 90])
    var two = G.pills(slots, { left: ["b"] }, { padding: 10, gap: 4 }).left
    // the split sits mid way between the icons (38 and 60): 49, half a gap each side
    assert.ok(Math.abs(two[0].end - 47) < 1e-9 && Math.abs(two[1].start - 51) < 1e-9)
    // even pills, measured from the icons: a has 9 px on its right, so 9 on its left too
    assert.ok(Math.abs(two[0].start - (2 - 9)) < 1e-9)
    assert.ok(Math.abs(two[1].end - (80 + 9)) < 1e-9)
  }],
  ["ink outside the box or empty falls back to the box", function () {
    var slots = { left: [{ id: "a", start: 0, end: 40, inkStart: 30, inkEnd: 20 }, { id: "b", start: 40, end: 80, inkStart: -50, inkEnd: 200 }] }
    var p = G.pills(slots, {}, { padding: 5, gap: 4 }).left
    assert.deepStrictEqual([p[0].start, p[0].end], [-5, 85])
  }],
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
    assert.deepStrictEqual([r[0].start, r[0].end], [-2, 22]) // even: left pad cut to the 2 px the split leaves
    assert.deepStrictEqual([r[1].start, r[1].end], [26, 50])
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
    assert.deepStrictEqual([r[0].start, r[0].end, r[1].start, r[1].end], [3, 29, 31, 53])
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
    assert.deepStrictEqual([r.left[0].start, r.left[0].end], [5, 43])
    assert.deepStrictEqual([r.right[0].start, r.right[0].end], [1197, 1275])
    var free = G.pills({ left: [{ id: "a", start: 8, end: 40 }] }, {}, { padding: 12 })
    assert.strictEqual(free.left[0].start, -4)
  }]
]

function groupsOf(r) { return r.map(function (p) { return p.ids.join("") }) }
function withOpts(extra) { return Object.assign({ padding: 0, gap: 0 }, extra) }
function P(id, part, start) { return { id: id, part: part, start: start, end: start + 10 } }

tests.push(
  ["solo in the middle", function () {
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ solo: ["b"] }))), ["a", "b", "cd"])
    assert.deepStrictEqual(run(row, [], withOpts({ solo: ["b"] }))[1], { start: 10, end: 20, ids: ["b"] })
  }],
  ["solo at the ends and everywhere", function () {
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ solo: ["a"] }))), ["a", "bcd"])
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ solo: ["d"] }))), ["abc", "d"])
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ solo: ["a", "b", "c", "d"] }))), ["a", "b", "c", "d"])
  }],
  ["solo gets the gap and the bounds like any split", function () {
    var r = run(row, [], { padding: 4, gap: 6, min: 2, solo: ["b"] })
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[3, 7], [13, 17], [23, 37]])
  }],
  ["noPill splits and draws nothing", function () {
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ noPill: ["b"] }))), ["a", "cd"])
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ noPill: ["b", "c"] }))), ["a", "d"])
  }],
  ["noPill at the edges and alone", function () {
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ noPill: ["a"] }))), ["bcd"])
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ noPill: ["d"] }))), ["abc"])
    assert.deepStrictEqual(run(row, [], withOpts({ noPill: ["a", "b", "c", "d"] })), [])
  }],
  ["noPill wins over solo", function () {
    assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ noPill: ["b"], solo: ["b"] }))), ["a", "cd"])
  }],
  ["noPill keeps the gap rule between its neighbours", function () {
    var r = run(row, [], { padding: 12, gap: 8, noPill: ["b"] })
    assert.deepStrictEqual([r[0].end, r[1].start], [6, 24]) // half a gap from the None slot (10-20)
  }],
  ["centerParts splits the center area into three", function () {
    var c = [P("a", "centerBegin", 0), P("b", "center", 10), P("c", "center", 20), P("d", "centerEnd", 30)]
    assert.deepStrictEqual(groupsOf(run(c, [], withOpts({ centerParts: true }), "center")), ["a", "bc", "d"])
    assert.deepStrictEqual(groupsOf(run(c, [], withOpts({}), "center")), ["abcd"])
    assert.deepStrictEqual(groupsOf(run(c, [], withOpts({ centerParts: false }), "center")), ["abcd"])
  }],
  ["centerParts with each part empty", function () {
    var go = function (c) { return groupsOf(run(c, [], withOpts({ centerParts: true }), "center")) }
    assert.deepStrictEqual(go([P("b", "center", 10), P("d", "centerEnd", 30)]), ["b", "d"])
    assert.deepStrictEqual(go([P("a", "centerBegin", 0), P("d", "centerEnd", 30)]), ["a", "d"])
    assert.deepStrictEqual(go([P("a", "centerBegin", 0), P("b", "center", 10)]), ["a", "b"])
    assert.deepStrictEqual(go([P("b", "center", 10), P("c", "center", 20)]), ["bc"])
    assert.deepStrictEqual(go([P("d", "centerEnd", 30)]), ["d"])
    assert.deepStrictEqual(go([]), [])
  }],
  ["centerParts only touches the center area", function () {
    var l = [P("a", "centerBegin", 0), P("b", "center", 10), P("d", "centerEnd", 30)]
    assert.deepStrictEqual(groupsOf(run(l, [], withOpts({ centerParts: true }), "left")), ["abd"])
  }],
  ["rules combine with breaks and repeated ids", function () {
    var c = [P("a", "centerBegin", 0), P("b", "center", 10), P("x", "center", 20), P("c", "center", 30), P("x", "centerEnd", 40), P("e", "centerEnd", 50)]
    var r = run(c, ["x"], withOpts({ centerParts: true, solo: ["c"], noPill: ["e"] }), "center")
    assert.deepStrictEqual(groupsOf(r), ["a", "b", "x", "c", "x"])
    r = run(c, [], withOpts({ solo: ["x"] }), "center")
    assert.deepStrictEqual(groupsOf(r), ["ab", "x", "c", "x", "e"])
  }],
  ["None widget: neighbour pills stop at it", function () {
    var l = [S("a", 0, 100), S("ws", 100, 300), S("b", 300, 400)]
    var o = function (gap) { return { padding: 12, gap: gap, noPill: ["ws"] } }
    var r = run(l, [], o(0))
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[0, 100], [300, 400]]) // even: the free end shrinks to match the None end
    r = run(l, [], o(8)) // half a gap of air on each side
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[4, 96], [304, 396]])
    r = run(l.slice(0, 2), [], o(0)) // None at the area edge, one pill before
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[0, 100]])
    r = run(l.slice(1), [], o(0)) // None at the area edge, one pill after
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[300, 400]])
  }],
  ["None widget: a pill that would collapse keeps its slot bounds", function () {
    var r = run([S("n", 0, 10), S("a", 10, 20)], [], { padding: 0, gap: 40, noPill: ["n"] })
    assert.deepStrictEqual(r, [{ start: 10, end: 20, ids: ["a"] }])
  }],
  ["bad rule values never throw", function () {
    [null, 3, "s", {}, { length: "x" }, [1, null]].forEach(function (v) {
      assert.deepStrictEqual(groupsOf(run(row, [], withOpts({ solo: v, noPill: v, centerParts: v }))), ["abcd"])
    })
  }]
)

function pads(p, slots) {
  var f = slots.filter(function (s) { return p.ids.indexOf(s.id) >= 0 })
  return [f[0].start - p.start, p.end - f[f.length - 1].end]
}
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-9, a + " vs " + b) }
var O = { padding: 12, gap: 4 }

tests.push(
  ["even pills: a break gives both pills equal pads of -gap/2", function () {
    var r = run(row, ["c"], O)
    pads(r[0], row).forEach(function (v, i) { near(v, i === 0 ? -2 : -2) })
    pads(r[1], row).forEach(function (v) { near(v, -2) })
    assert.deepStrictEqual([r[0].end, r[1].start], [18, 22])
  }],
  ["even pills: solo in the middle is centred, pads match its neighbours' facing pads", function () {
    var r = run(row, [], { padding: 12, gap: 4, solo: ["b"] })
    pads(r[1], row).forEach(function (v) { near(v, -2) })
    near((r[1].start + r[1].end) / 2, 15)
    near(pads(r[0], row)[1], -2)
    near(pads(r[2], row)[0], -2)
  }],
  ["even pills: a single free pill keeps full padding on both ends", function () {
    assert.deepStrictEqual(run(row, [], O), [{ start: -12, end: 52, ids: ["a", "b", "c", "d"] }])
  }],
  ["even pills: min clamp makes both ends equal", function () {
    var r = run(row, [], { padding: 12, gap: 4, min: -5 })
    assert.deepStrictEqual([r[0].start, r[0].end], [-5, 45])
    var m = G.pills({ right: [S("z", 100, 140)] }, {}, { padding: 12, max: 150 }).right
    assert.deepStrictEqual([m[0].start, m[0].end], [90, 150])
  }],
  ["even pills: None neighbour", function () {
    var l = [S("a", 0, 100), S("ws", 100, 300), S("b", 300, 400)]
    var r = run(l, [], { padding: 12, gap: 4, noPill: ["ws"] })
    assert.deepStrictEqual(r.map(function (p) { return [p.start, p.end] }), [[2, 98], [302, 398]])
  }],
  ["even pills: random layouts have equal pads and no overlap", function () {
    var seed = 12345
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    for (var t = 0; t < 400; t++) {
      var n = 1 + Math.floor(rnd() * 8), x = Math.floor(rnd() * 20), slots = [], ids = []
      for (var i = 0; i < n; i++) {
        var w = 4 + Math.floor(rnd() * 40)
        slots.push(S("w" + i, x, x + w)); ids.push("w" + i); x += w + (rnd() < 0.3 ? Math.floor(rnd() * 15) : 0)
      }
      var pick = function (q) { return ids.filter(function () { return rnd() < q }) }
      var o = { padding: Math.floor(rnd() * 16), gap: Math.floor(rnd() * 12), solo: pick(0.2), noPill: pick(0.15) }
      if (rnd() < 0.4) o.min = Math.floor(rnd() * 20) - 10
      if (rnd() < 0.4) o.max = x + Math.floor(rnd() * 20) - 10
      var r = run(slots, pick(0.3), o), none = slots.filter(function (s) { return o.noPill.indexOf(s.id) >= 0 })
      r.forEach(function (p, k) {
        var pd = pads(p, slots)
        if (p.end - p.start > 1 + 1e-9 && pd[0] !== 0) near(pd[0], pd[1])
        if (k) assert.ok(p.start >= r[k - 1].end - 1e-9, "overlap " + JSON.stringify(r))
        none.forEach(function (s) { if (pd[0] !== 0 || pd[1] !== 0) assert.ok(p.end <= s.start + 1e-9 || p.start >= s.end - 1e-9, "hits None") })
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
