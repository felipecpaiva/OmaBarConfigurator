// node test/presets-test.js
var assert = require("assert")
var P = require("../lib/Presets.js")
var Groups = require("../lib/Groups.js")
var Model = require("../Model.js")

var SELF = Model.SELF_ID
function mv(id, from, i, to, j) {
  return ["omarchy-bar", "move", id, "--from-section", from, "--from-index", String(i), "--section", to, "--index", String(j)]
}
function ids(list) { return list.map(function (e) { return typeof e === "string" ? e : e.id }) }
function shaped(over) {
  var lay = { left: [], centerBegin: [], center: [], centerEnd: [], right: [], tray: [] }
  Object.keys(over).forEach(function (k) { lay[k] = over[k] })
  return lay
}
// Shaped like Felipe's bar on 2026-11-16, inline settings included.
function real() {
  return shaped({
    left: ["omarchy.menu", { id: "tornikegomareli.spaces" }],
    centerBegin: [{ id: "omarchy.indicators" }],
    center: [{ id: "google-calendar.clock", format: "HH:mm" }],
    centerEnd: ["omarchy.weather", { id: "io.github.jcarcinogen.gaming-console" }, "omarchy.system-update"],
    right: ["omarchy.keyboard-layout", { id: "felipe.tray", alwaysShow: true }, { id: SELF },
      { id: "io.github.felipecpaiva.omagnet" }, { id: "omarchy.elsewhen", cities: ["Lisbon", "Toronto"] }, "omarchy.battery"],
    tray: [{ id: "omarchy.bluetooth" }]
  })
}
var ROLES = { workspaces: ["tornikegomareli.spaces"], selfId: SELF, centerAnchor: "" }
var j = JSON.stringify

var tests = [
  ["SELF_ID mirrors Model.js", function () { assert.strictEqual(P.SELF_ID, Model.SELF_ID) }],
  ["preset list shape", function () {
    assert.strictEqual(P.PRESETS[0].id, "denial")
    assert.ok(P.PRESETS[0].label && P.PRESETS[0].help && !/[\u2013\u2014]/.test(P.PRESETS[0].help))
  }],
  ["snapshot is a deep copy", function () {
    var lay = real(), snap = P.snapshot(lay)
    snap.right[1].alwaysShow = false
    assert.strictEqual(lay.right[1].alwaysShow, true)
    assert.deepStrictEqual(P.snapshot(null), {})
  }],
  ["move within a section, forwards: removal first, then insert", function () {
    var out = P.applyMoves(shaped({ left: ["a", "b", "c", "d"] }), [mv("a", "left", 0, "left", 2)])
    assert.deepStrictEqual(out.left, ["b", "c", "a", "d"])
  }],
  ["move within a section, backwards", function () {
    var out = P.applyMoves(shaped({ left: ["a", "b", "c", "d"] }), [mv("d", "left", 3, "left", 1)])
    assert.deepStrictEqual(out.left, ["a", "d", "b", "c"])
  }],
  ["move across sections keeps inline settings", function () {
    var out = P.applyMoves(shaped({ left: [{ id: "a", x: 1 }, "b"], right: ["c"] }), [mv("a", "left", 0, "right", 1)])
    assert.deepStrictEqual(out.left, ["b"])
    assert.deepStrictEqual(out.right, ["c", { id: "a", x: 1 }])
  }],
  ["index past the end lands at the end", function () {
    var out = P.applyMoves(shaped({ left: ["a", "b"], right: ["c"] }), [mv("a", "left", 0, "right", 99)])
    assert.deepStrictEqual(out.right, ["c", "a"])
  }],
  ["no from-index: first match in section order", function () {
    var out = P.applyMoves(shaped({ left: ["x"], right: ["x", "y"] }), [["omarchy-bar", "move", "x", "--section", "center", "--index", "0"]])
    assert.deepStrictEqual(out.left, [])
    assert.deepStrictEqual(out.center, ["x"])
  }],
  ["no index: after the section anchor, else the end", function () {
    var out = P.applyMoves(shaped({ left: ["a", "omarchy.workspaces", "b"], right: ["c"] }), [["omarchy-bar", "move", "c", "left"]])
    assert.deepStrictEqual(out.left, ["a", "omarchy.workspaces", "c", "b"])
    out = P.applyMoves(shaped({ left: ["a"], center: ["z"] }), [["omarchy-bar", "move", "a", "--section", "center"]])
    assert.deepStrictEqual(out.center, ["z", "a"])
  }],
  ["no section: stays in the source section", function () {
    var out = P.applyMoves(shaped({ right: ["a", "b", "c"] }), [["omarchy-bar", "move", "c", "--index", "0"]])
    assert.deepStrictEqual(out.right, ["c", "a", "b"])
  }],
  ["--before / --after", function () {
    var out = P.applyMoves(shaped({ left: ["a", "b"], right: ["c", "d"] }), [["omarchy-bar", "move", "a", "--after", "c"]])
    assert.deepStrictEqual(out.right, ["c", "a", "d"])
  }],
  ["failed moves change nothing", function () {
    var lay = shaped({ left: ["a", "b"] })
    assert.strictEqual(j(P.applyMoves(lay, [mv("b", "left", 0, "right", 0)])), j(lay)) // wrong id at index
    assert.strictEqual(j(P.applyMoves(lay, [["omarchy-bar", "move", "a", "--from-index", "0", "--section", "right"]])), j(lay))
    assert.strictEqual(j(P.applyMoves(lay, [["omarchy-bar", "move", "omarchy.tray", "tray"]])), j(lay))
  }],
  ["missing sections are added like ensureConfigShape", function () {
    var out = P.applyMoves({ left: ["a"] }, [mv("a", "left", 0, "right", 0)])
    assert.deepStrictEqual(Object.keys(out), ["left", "centerBegin", "center", "centerEnd", "right", "tray"])
  }],
  ["Denial on the real layout", function () {
    var lay = real(), plan = P.presetPlan(lay, "denial", ROLES)
    assert.strictEqual(plan.error, "")
    var out = P.applyMoves(lay, plan.argv)
    assert.deepStrictEqual(ids(out.left), [])
    assert.deepStrictEqual(ids(out.centerBegin), [])
    assert.deepStrictEqual(ids(out.center), ["tornikegomareli.spaces"])
    assert.deepStrictEqual(ids(out.centerEnd), [])
    assert.deepStrictEqual(ids(out.right), ["omarchy.menu", "omarchy.indicators", "google-calendar.clock", "omarchy.weather",
      "io.github.jcarcinogen.gaming-console", "omarchy.system-update", "omarchy.keyboard-layout", "felipe.tray", SELF,
      "io.github.felipecpaiva.omagnet", "omarchy.elsewhen", "omarchy.battery"])
    assert.strictEqual(j(out.tray), j(lay.tray))
    assert.deepStrictEqual(out.right[7], { id: "felipe.tray", alwaysShow: true })
    plan.argv.forEach(function (a) { assert.strictEqual(a.length, 11); assert.strictEqual(a[3], "--from-section") })
  }],
  ["Denial keeps the painter in its section and the anchor in center", function () {
    var lay = real()
    lay.left.push({ id: SELF }); lay.right.splice(2, 1)
    var argv = P.presetPlan(lay, "denial", { workspaces: ["tornikegomareli.spaces"], selfId: SELF, centerAnchor: "google-calendar.clock" }).argv
    assert.ok(argv.length > 0)
    argv.forEach(function (a, n) { // the center never lacks its anchor, at any step
      assert.ok(ids(P.applyMoves(lay, argv.slice(0, n + 1)).center).indexOf("google-calendar.clock") >= 0)
    })
    var out = P.applyMoves(lay, argv)
    assert.deepStrictEqual(ids(out.left), [SELF])
    lay.left.push({ noId: true }) // the CLI cannot move an entry with no id, so the plan fails cleanly
    assert.deepStrictEqual(P.presetPlan(lay, "denial", ROLES).argv, [])
    assert.ok(P.presetPlan(lay, "denial", ROLES).error)
    assert.deepStrictEqual(ids(out.center), ["tornikegomareli.spaces", "google-calendar.clock"])
  }],
  ["apply, undo, apply: byte identical, inline settings included", function () {
    var lay = real(), snap = P.snapshot(lay)
    var applied = P.applyMoves(lay, P.presetPlan(lay, "denial", ROLES).argv)
    var undo = P.undoPlan(applied, snap)
    assert.strictEqual(undo.error, "")
    var back = P.applyMoves(applied, undo.argv)
    assert.strictEqual(j(back), j(snap))
    assert.strictEqual(j(P.applyMoves(back, P.presetPlan(back, "denial", ROLES).argv)), j(applied))
    assert.deepStrictEqual(P.undoPlan(snap, snap), { argv: [], error: "" })
  }],
  ["undo works from a snapshot without empty sections", function () {
    var lay = real(); delete lay.tray; delete lay.centerBegin; lay.center.unshift({ id: "omarchy.indicators" })
    var snap = P.snapshot(lay), applied = P.applyMoves(lay, P.presetPlan(lay, "denial", ROLES).argv)
    var undo = P.undoPlan(applied, snap)
    assert.strictEqual(undo.error, "")
    var back = P.applyMoves(applied, undo.argv)
    delete back.tray; delete back.centerBegin // empty keys Omarchy adds on its first move
    assert.strictEqual(j(back), j(snap))
  }],
  ["positional section is checked like the CLI", function () {
    var lay = shaped({ left: ["a"] })
    assert.strictEqual(j(P.applyMoves(lay, [["omarchy-bar", "move", "a", "right", "--index", "0"]])), j(lay))
    assert.deepStrictEqual(P.applyMoves(lay, [["omarchy-bar", "move", "a", "right"]]).right, ["a"])
  }],
  ["undo refuses after a widget was added or its settings changed", function () {
    var lay = real(), snap = P.snapshot(lay), now = P.snapshot(lay)
    now.right.push("omarchy.new")
    assert.deepStrictEqual(P.undoPlan(now, snap), { argv: [], error: "The bar changed since the snapshot; Undo is not possible." })
    now = P.snapshot(lay); now.right[1].alwaysShow = false
    assert.strictEqual(P.undoPlan(now, snap).error, "The bar changed since the snapshot; Undo is not possible.")
  }],
  ["move pill left to right, breaks updated, undo byte identical", function () {
    var lay = shaped({ left: ["a", { id: "b", k: 1 }, "c", "d"], right: ["r1", { id: SELF }, "r2"] })
    var brk = { left: ["b", "d"], center: [], right: [] }
    var plan = P.movePillPlan(lay, brk, "left", 2, "right")
    assert.strictEqual(plan.error, "")
    assert.deepStrictEqual(plan.argv, [mv("b", "left", 1, "right", 3), mv("c", "left", 1, "right", 4)])
    var out = P.applyMoves(lay, plan.argv)
    assert.deepStrictEqual(ids(out.left), ["a", "d"])
    assert.deepStrictEqual(ids(out.right), ["r1", SELF, "r2", "b", "c"])
    assert.deepStrictEqual(plan.breaks, { left: ["d"], center: [], right: ["b"] })
    var rows = Groups.rows(out, plan.breaks, SELF)
    assert.deepStrictEqual(rows.right.map(function (r) { return r.pill }), [1, 1, 2, 2])
    assert.strictEqual(j(P.applyMoves(out, P.undoPlan(out, P.snapshot(lay)).argv)), j(lay))
  }],
  ["move pill right to left: into an empty area needs no break", function () {
    var lay = shaped({ right: ["r1", "r2", "r3"] })
    var plan = P.movePillPlan(lay, { right: ["r2"] }, "right", 2, "left")
    assert.deepStrictEqual(ids(P.applyMoves(lay, plan.argv).left), ["r2", "r3"])
    assert.deepStrictEqual(plan.breaks, { left: [], center: [], right: [] })
  }],
  ["move pill to center lands in `center`, before centerEnd, as its own pill", function () {
    var lay = shaped({ left: ["a", "b"], centerBegin: ["cb"], center: ["c"], centerEnd: ["ce1", "ce2"] })
    var plan = P.movePillPlan(lay, { left: ["b"] }, "left", 2, "center")
    var out = P.applyMoves(lay, plan.argv)
    assert.deepStrictEqual(ids(out.center), ["c", "b"])
    var rows = Groups.rows(out, plan.breaks, SELF)
    assert.deepStrictEqual(rows.center.map(function (r) { return r.id + r.pill }), ["cb1", "c1", "b2", "ce13", "ce23"])
  }],
  ["move pill from center: widgets across centerBegin/center/centerEnd, in order", function () {
    var lay = shaped({ centerBegin: ["x"], center: ["y"], centerEnd: ["z"], right: ["r"] })
    var out = P.applyMoves(lay, P.movePillPlan(lay, {}, "center", 1, "right").argv)
    assert.deepStrictEqual(ids(out.right), ["r", "x", "y", "z"])
  }],
  ["move pill refuses to take the center anchor out", function () {
    var lay = shaped({ center: ["clock"], right: ["r"] })
    var plan = P.movePillPlan(lay, {}, "center", 1, "left", { centerAnchor: "clock" })
    assert.deepStrictEqual(plan.argv, [])
    assert.strictEqual(plan.error, "This would move the center anchor (clock) out of the center; move it back first or pick another pill.")
  }],
  ["move pill: same area and missing pill", function () {
    var lay = shaped({ left: ["a"] })
    assert.deepStrictEqual(P.movePillPlan(lay, {}, "left", 1, "left").argv, [])
    assert.ok(P.movePillPlan(lay, {}, "left", 5, "right").error)
  }],
  ["garbage never throws", function () {
    var junk = [undefined, null, 0, "x", [], {}, { left: "nope" }, { left: [null, 5, {}] }, [[1, 2]]]
    junk.forEach(function (a) {
      junk.forEach(function (b) {
        P.snapshot(a); P.applyMoves(a, b); P.presetPlan(a, "denial", b); P.presetPlan(a, b, b)
        P.movePillPlan(a, b, "left", 1, "right", b); P.movePillPlan(a, b, b, b, b); P.undoPlan(a, b)
      })
    })
    P.applyMoves(shaped({ left: ["a"] }), [["omarchy-bar", "move", "a", "bogus"]])
    P.applyMoves({ left: { length: 1, 0: "a" } }, [mv("a", "left", 0, "right", 0)])
    var cyc = {}; cyc.self = cyc
    assert.deepStrictEqual(P.snapshot(cyc), {})
  }]
]

var failed = 0
tests.forEach(function (t) {
  try { t[1](); console.log("ok   " + t[0]) } catch (e) { failed++; console.log("FAIL " + t[0] + "\n     " + e.message) }
})
console.log((tests.length - failed) + "/" + tests.length + " passed")
process.exit(failed ? 1 : 0)
