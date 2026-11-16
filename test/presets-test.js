// node test/presets-test.js
var assert = require("assert")
var P = require("../lib/Presets.js")
var Groups = require("../lib/Groups.js")
var GroupLayout = require("../lib/GroupLayout.js")
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
var SEC = ["left", "centerBegin", "center", "centerEnd", "right"]
// The real bar, with the full right group.
function real2() {
  var lay = real()
  lay.right = ["omarchy.keyboard-layout", { id: "felipe.tray", alwaysShow: true }, { id: SELF }, { id: "io.github.felipecpaiva.omagnet" },
    { id: "omarchy.elsewhen", cities: ["Lisbon", "Toronto"] }, "esemczak.theme-modes", "omarchy.agents", "omarchy.bluetooth", "omarchy.network",
    "omarchy.audio", "omarchy.monitor", "omarchy.power"]
  lay.tray = []
  return lay
}
var ROLES = { workspaces: ["tornikegomareli.spaces"], selfId: SELF, centerAnchor: "" }
var j = JSON.stringify
var ANCHORED = { workspaces: ["tornikegomareli.spaces"], selfId: SELF, centerAnchor: "google-calendar.clock" }
// Pills as the painter draws them: each widget 10 px wide, painter left out.
function drawn(lay, breaks, rules) {
  var areas = {}, x = 0, AR = { left: ["left"], center: ["centerBegin", "center", "centerEnd"], right: ["right"] }
  Object.keys(AR).forEach(function (a) {
    areas[a] = []
    AR[a].forEach(function (s) { ids(lay[s]).forEach(function (id) { if (id !== SELF) { areas[a].push({ id: id, part: s, start: x, end: x + 10 }); x += 10 } }) })
  })
  var out = GroupLayout.pills(areas, breaks, rules || {})
  Object.keys(out).forEach(function (a) { out[a] = out[a].map(function (p) { return p.ids }) })
  return out
}
function movedIds(plan) { return plan.argv.map(function (a) { return a[2] }) }

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
    lay.left.push({ noId: true }) // the CLI cannot move an entry with no id; the plan never needs to
    var noId = P.presetPlan(lay, "denial", ROLES)
    assert.strictEqual(noId.error, "")
    assert.deepStrictEqual(P.applyMoves(lay, noId.argv).left, [{ id: SELF }, { noId: true }])
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
  ["Denial refuses when no workspaces widget is on the bar", function () {
    var lay = shaped({ left: ["a", "b"], right: [{ id: SELF }] })
    var plan = P.presetPlan(lay, "denial", { workspaces: ["omarchy.workspaces"], selfId: SELF }, { left: ["b"] })
    assert.deepStrictEqual(plan.argv, [])
    assert.strictEqual(plan.error, "No workspaces widget found on the bar, so the Denial preset has nothing to put in the center.")
    assert.deepStrictEqual(plan.breaks.left, ["b"])
    assert.ok(P.presetPlan(lay, "denial", {}).error)
  }],
  ["Denial never moves the painter (2000 seeded layouts) and reaches the target", function () {
    var seed = 12345
    function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 2147483648 * n) }
    var secs = ["left", "centerBegin", "center", "centerEnd", "right"]
    for (var n = 0; n < 2000; n++) {
      var pool = ["w", SELF, "a", "b", "c", "d", "e"].sort(function () { return rnd(3) - 1 }), lay = shaped({})
      pool.slice(0, 2 + rnd(6)).forEach(function (id) { lay[secs[rnd(5)]].push(id) })
      if (rnd(2)) lay.tray.push("t")
      var plan = P.presetPlan(lay, "denial", { workspaces: ["w"], selfId: SELF })
      var hasW = JSON.stringify(lay).indexOf('"w"') >= 0
      if (!hasW) { assert.ok(plan.error); continue }
      assert.strictEqual(plan.error, "", j(lay))
      plan.argv.forEach(function (a) { assert.notStrictEqual(a[2], SELF, j(lay)) })
      var want = shaped({ tray: lay.tray })
      secs.forEach(function (s) {
        lay[s].forEach(function (id) { want[id === SELF ? s : id === "w" ? "center" : "right"].push(id) })
      })
      assert.strictEqual(j(P.applyMoves(lay, plan.argv)), j(want), j(lay) + j(plan.argv))
    }
  }],
  ["undo plan ignores key order and missing sections", function () {
    var cur = { right: ["a"], left: ["b"] }, snap = { left: ["b"], right: ["a"], tray: [] }
    assert.deepStrictEqual(P.undoPlan(cur, snap), { argv: [], error: "" })
    var swapped = P.undoPlan({ right: ["a", "b"] }, { tray: [], left: ["a"], right: ["b"] })
    assert.strictEqual(swapped.error, "")
    assert.deepStrictEqual(P.applyMoves({ right: ["a", "b"] }, swapped.argv).left, ["a"])
  }],
  ["Denial returns breaks without the moved widgets", function () {
    var lay = real(), brk = { left: ["tornikegomareli.spaces", "x"], center: ["omarchy.weather"], right: ["omarchy.battery"], extra: ["no"] }
    var plan = P.presetPlan(lay, "denial", ROLES, brk)
    assert.deepStrictEqual(plan.breaks, { left: ["x"], center: [], right: ["omarchy.battery"] })
    assert.deepStrictEqual(brk.left, ["tornikegomareli.spaces", "x"])
    assert.deepStrictEqual(P.presetPlan(lay, "denial", ROLES).breaks, { left: [], center: [], right: [] })
    assert.deepStrictEqual(P.presetPlan(lay, "nope", ROLES, brk).breaks.left, brk.left)
  }],
  ["grouped: left and right gather round center, painter stays", function () {
    var lay = real2(), plan = P.presetPlan(lay, "grouped", ROLES, {}), out = P.applyMoves(lay, plan.argv)
    assert.strictEqual(plan.error, "")
    assert.deepStrictEqual(out.left, [])
    assert.deepStrictEqual(ids(out.centerBegin), ["omarchy.menu", "tornikegomareli.spaces", "omarchy.indicators"])
    assert.deepStrictEqual(out.center, lay.center)
    assert.deepStrictEqual(ids(out.centerEnd), ["omarchy.weather", "io.github.jcarcinogen.gaming-console", "omarchy.system-update"].concat(ids(lay.right).filter(function (x) { return x !== SELF })))
    assert.deepStrictEqual(out.right, [{ id: SELF }])
    assert.deepStrictEqual(out.tray, lay.tray)
    assert.ok(out.centerEnd.some(function (e) { return j(e) === j({ id: "omarchy.elsewhen", cities: ["Lisbon", "Toronto"] }) }))
  }],
  ["spread: edges get the groups, center stays alone", function () {
    var lay = real2(), plan = P.presetPlan(lay, "spread", ROLES, {}), out = P.applyMoves(lay, plan.argv)
    assert.strictEqual(plan.error, "")
    assert.deepStrictEqual(ids(out.left), ["omarchy.menu", "tornikegomareli.spaces", "omarchy.indicators"])
    assert.deepStrictEqual(out.centerBegin.concat(out.centerEnd), [])
    assert.deepStrictEqual(out.center, lay.center)
    assert.deepStrictEqual(ids(out.right), ["omarchy.weather", "io.github.jcarcinogen.gaming-console", "omarchy.system-update"].concat(ids(lay.right)))
  }],
  ["grouped then spread then Undo is byte identical", function () {
    var lay = real2(), a = P.applyMoves(lay, P.presetPlan(lay, "grouped", ROLES, {}).argv)
    var b = P.applyMoves(a, P.presetPlan(a, "spread", ROLES, {}).argv), u = P.undoPlan(b, lay)
    assert.strictEqual(u.error, "")
    assert.strictEqual(j(P.applyMoves(b, u.argv)), j(lay))
    assert.strictEqual(j(P.applyMoves(a, P.undoPlan(a, lay).argv)), j(lay))
  }],
  ["grouped and spread are idempotent", function () {
    ["grouped", "spread"].forEach(function (id) {
      var once = P.applyMoves(real2(), P.presetPlan(real2(), id, ROLES, {}).argv)
      assert.deepStrictEqual(P.presetPlan(once, id, ROLES, {}), { argv: [], breaks: { left: [], center: [], right: [] }, error: "" })
    })
  }],
  ["painter stays put even when its section empties around it", function () {
    var lay = shaped({ left: ["a", { id: SELF }, "b"], centerBegin: ["c"], center: ["clock"], centerEnd: ["d"], right: ["e"] })
    var g = P.presetPlan(lay, "grouped", ROLES, {}), out = P.applyMoves(lay, g.argv)
    assert.strictEqual(g.error, "")
    assert.deepStrictEqual(out.left, [{ id: SELF }])
    assert.deepStrictEqual(ids(out.centerBegin), ["a", "b", "c"])
    assert.deepStrictEqual(ids(out.centerEnd), ["d", "e"])
  }],
  ["painter never appears in argv on seeded random layouts", function () {
    var seed = 7, rnd = function (n) { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n }
    for (var run = 0; run < 150; run++) {
      var lay = shaped({}), n = 0
      SEC.forEach(function (s) { for (var k = rnd(4); k > 0; k--) lay[s].push(rnd(4) ? "w" + n++ : { id: "w" + n++, v: rnd(9) }) })
      var home = SEC[rnd(5)]; lay[home].splice(rnd(lay[home].length + 1), 0, { id: SELF })
      ;["grouped", "spread"].forEach(function (id) {
        var plan = P.presetPlan(lay, id, ROLES, {}), out = P.applyMoves(lay, plan.argv)
        assert.strictEqual(plan.error, "", id + " " + j(lay))
        assert.ok(plan.argv.every(function (a) { return a[2] !== SELF }), id + " " + j(lay))
        assert.ok(ids(out[home]).indexOf(SELF) >= 0, id + " " + j(lay))
        assert.deepStrictEqual(out.center.filter(function (e) { return e.id !== SELF }), lay.center.filter(function (e) { return e.id !== SELF }))
      })
    }
  }],
  ["the center anchor never leaves the center", function () {
    var roles = { workspaces: ["tornikegomareli.spaces"], selfId: SELF, centerAnchor: "google-calendar.clock" }
    ;["grouped", "spread"].forEach(function (id) {
      var lay = real2(), out = P.applyMoves(lay, P.presetPlan(lay, id, roles, {}).argv)
      assert.strictEqual(ids(out.center)[0], "google-calendar.clock")
    })
  }],
  ["grouped and spread carry the breaks of widgets that changed area, and split where groups meet", function () {
    var lay = real2(), brk = { left: ["tornikegomareli.spaces", "omarchy.menu"], center: ["omarchy.weather", "omarchy.indicators"], right: ["omarchy.audio", SELF] }
    // grouped moves left and right widgets into the center area; the painter stays in right
    assert.deepStrictEqual(P.presetPlan(lay, "grouped", ROLES, brk).breaks, { left: [], right: [SELF],
      center: ["omarchy.weather", "omarchy.indicators", "tornikegomareli.spaces", "omarchy.menu", "omarchy.keyboard-layout", "omarchy.audio"] })
    // spread moves centerBegin/centerEnd widgets out of the center area
    assert.deepStrictEqual(P.presetPlan(lay, "spread", ROLES, brk).breaks, { center: [],
      left: ["tornikegomareli.spaces", "omarchy.menu", "omarchy.indicators"], right: ["omarchy.audio", SELF, "omarchy.weather", "omarchy.keyboard-layout"] })
    assert.deepStrictEqual(brk.left, ["tornikegomareli.spaces", "omarchy.menu"])
  }],
  ["unknown preset names and prototype keys are refused", function () {
    ;["constructor", "toString", "__proto__", "", 5, null].forEach(function (id) { assert.ok(P.presetPlan(real2(), id, ROLES, {}).error) })
  }],
  ["preset list has grouped and spread, plain words", function () {
    assert.deepStrictEqual(P.PRESETS.map(function (p) { return p.id }), ["denial", "grouped", "spread"])
    P.PRESETS.forEach(function (p) { assert.ok(p.label && p.help && !/[\u2013\u2014]/.test(p.label + p.help)) })
  }],
  ["move pill with rows: numbers follow the Groups page (Own, None)", function () {
    var lay = shaped({ left: ["ws", "A", "B", "C"], right: ["r"] }), brk = { left: ["C"] }, rules = { solo: ["ws"] }
    var plan = P.movePillPlan(lay, brk, "left", 2, "right", ROLES, Groups.rows(lay, brk, SELF, rules))
    assert.deepStrictEqual(movedIds(plan), ["A", "B"])
    assert.deepStrictEqual(ids(P.applyMoves(lay, plan.argv).right), ["r", "A", "B"])
    lay = shaped({ left: ["A", "N", "B"] }); rules = { noPill: ["N"] }
    var rows = Groups.rows(lay, {}, SELF, rules)
    assert.deepStrictEqual(movedIds(P.movePillPlan(lay, {}, "left", 2, "right", ROLES, rows)), ["B"])
    assert.deepStrictEqual(movedIds(P.movePillPlan(lay, {}, "left", 1, "right", ROLES, rows)), ["A"])
    assert.ok(P.movePillPlan(lay, {}, "left", 0, "right", ROLES, rows).error) // a None row is in no pill
  }],
  ["move pill with rows: the neighbours of a moved solo pill stay apart", function () {
    var lay = shaped({ left: ["A", "S", "C"] }), rules = { solo: ["S"] }
    var plan = P.movePillPlan(lay, {}, "left", 2, "right", ROLES, Groups.rows(lay, {}, SELF, rules))
    assert.deepStrictEqual(movedIds(plan), ["S"])
    assert.deepStrictEqual(plan.breaks.left, ["C"])
    var after = Groups.rows(P.applyMoves(lay, plan.argv), plan.breaks, SELF, rules)
    assert.deepStrictEqual(after.left.map(function (r) { return r.id + r.pill }), ["A1", "C2"])
  }],
  ["move pill with rows that do not match the bar is refused", function () {
    var lay = shaped({ left: ["A", "B"] }), rows = Groups.rows(shaped({ left: ["B", "A"] }), {}, SELF)
    assert.deepStrictEqual(P.movePillPlan(lay, {}, "left", 1, "right", ROLES, rows).argv, [])
    assert.ok(P.movePillPlan(lay, {}, "left", 1, "right", ROLES, rows).error)
    assert.ok(P.movePillPlan(lay, {}, "left", 1, "right", ROLES, { left: "x" }).error)
  }],
  ["move pill with rows moves exactly that pill (2000 seeded layouts and rules)", function () {
    var seed = 99, rnd = function (n) { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor(seed / 65536) % n }
    var areas = ["left", "center", "right"], AR = { left: ["left"], center: ["centerBegin", "center", "centerEnd"], right: ["right"] }
    var groupsOf = function (list) { // the remaining pills as lists of ids
      var g = {}; list.forEach(function (r) { if (r.pill) (g[r.pill] = g[r.pill] || []).push(r.id) })
      return Object.keys(g).map(function (k) { return g[k].join(",") })
    }
    for (var run = 0; run < 2000; run++) {
      var lay = shaped({}), all = [], brk = { left: [], center: [], right: [] }, rules = { solo: [], noPill: [], centerParts: !!rnd(2) }
      SEC.forEach(function (s) { for (var k = rnd(5); k > 0; k--) { var id = "w" + all.length; all.push(id); lay[s].push(rnd(3) ? id : { id: id }) } })
      if (rnd(2)) lay[SEC[rnd(5)]].push({ id: SELF })
      all.forEach(function (id) {
        var k = rnd(6); if (k === 0) rules.solo.push(id); if (k === 1) rules.noPill.push(id)
        if (rnd(3) === 0) areas.forEach(function (a) { brk[a].push(id) })
      })
      var rows = Groups.rows(lay, brk, SELF, rules), from = areas[rnd(3)], to = areas[(areas.indexOf(from) + 1 + rnd(2)) % 3]
      var count = Math.max.apply(null, [0].concat(rows[from].map(function (r) { return r.pill }))); if (!count) continue
      var n = 1 + rnd(count), want = rows[from].filter(function (r) { return r.pill === n }).map(function (r) { return r.id })
      var plan = P.movePillPlan(lay, brk, from, n, to, ROLES, rows), ctx = j(lay) + j(brk) + j(rules) + " " + from + n + to
      assert.strictEqual(plan.error, "", ctx)
      assert.deepStrictEqual(movedIds(plan), want, ctx)
      var out = P.applyMoves(lay, plan.argv), after = Groups.rows(out, plan.breaks, SELF, rules)
      var srcIds = [].concat.apply([], AR[from].map(function (s) { return ids(out[s]) }))
      assert.deepStrictEqual(srcIds, [].concat.apply([], AR[from].map(function (s) { return ids(lay[s]) })).filter(function (id) { return want.indexOf(id) < 0 }), ctx)
      assert.deepStrictEqual(ids(out[AR[to][to === "center" ? 1 : 0]]).slice(-want.length), want, ctx)
      // The other pills of the source area are unchanged, and the moved pill is one pill in the target.
      assert.deepStrictEqual(groupsOf(after[from]), groupsOf(rows[from].filter(function (r) { return want.indexOf(r.id) < 0 })), ctx)
      assert.ok(groupsOf(after[to]).indexOf(want.join(",")) >= 0, ctx + j(after[to]))
    }
  }],
  ["Grouped on the real bar: three pills round the clock, no breaks needed before", function () {
    var lay = real2(), plan = P.presetPlan(lay, "grouped", ROLES, {}), out = P.applyMoves(lay, plan.argv)
    assert.strictEqual(plan.error, "")
    assert.ok(plan.argv.every(function (a) { return a[2] !== SELF }))
    assert.deepStrictEqual(plan.breaks.center, ["omarchy.indicators", "omarchy.keyboard-layout"])
    assert.deepStrictEqual(drawn(out, plan.breaks), { left: [], right: [], center: [
      ["omarchy.menu", "tornikegomareli.spaces"],
      ["omarchy.indicators", "google-calendar.clock", "omarchy.weather", "io.github.jcarcinogen.gaming-console", "omarchy.system-update"],
      ["omarchy.keyboard-layout", "felipe.tray", "io.github.felipecpaiva.omagnet", "omarchy.elsewhen", "esemczak.theme-modes", "omarchy.agents",
        "omarchy.bluetooth", "omarchy.network", "omarchy.audio", "omarchy.monitor", "omarchy.power"]] })
    // Spread then takes them back to the edges and keeps them apart.
    var back = P.presetPlan(out, "spread", ROLES, plan.breaks), spread = P.applyMoves(out, back.argv)
    assert.deepStrictEqual(drawn(spread, back.breaks), { center: [["google-calendar.clock"]],
      left: [["omarchy.menu", "tornikegomareli.spaces"], ["omarchy.indicators"]],
      right: [["omarchy.weather", "io.github.jcarcinogen.gaming-console", "omarchy.system-update"], ["omarchy.keyboard-layout", "felipe.tray",
        "io.github.felipecpaiva.omagnet", "omarchy.elsewhen", "esemczak.theme-modes", "omarchy.agents", "omarchy.bluetooth", "omarchy.network",
        "omarchy.audio", "omarchy.monitor", "omarchy.power"]] })
  }],
  ["Denial then Grouped keeps the clock alone in center", function () {
    var lay = real2(), d = P.applyMoves(lay, P.presetPlan(lay, "denial", ANCHORED, {}).argv)
    assert.deepStrictEqual(ids(d.center), ["tornikegomareli.spaces", "google-calendar.clock"])
    ;[ANCHORED, ROLES].forEach(function (roles) { // with no anchor role, the only clock in center is the anchor
      var g = P.presetPlan(d, "grouped", roles, {}), out = P.applyMoves(d, g.argv)
      assert.deepStrictEqual(ids(out.center), ["google-calendar.clock"])
      assert.deepStrictEqual(ids(out.centerBegin), ["tornikegomareli.spaces"])
      assert.deepStrictEqual(drawn(out, g.breaks).center.length, 2)
    })
    var twoClocks = shaped({ center: ["a.clock", "x", "b.clock"] }) // no anchor can be found: center stays as is
    assert.deepStrictEqual(P.presetPlan(twoClocks, "grouped", ROLES, {}).argv, [])
  }],
  ["Grouped then Spread then Undo is byte identical, anchored, painter never moved", function () {
    var lay = real2(), g = P.presetPlan(lay, "grouped", ANCHORED, {}), a = P.applyMoves(lay, g.argv)
    var s = P.presetPlan(a, "spread", ANCHORED, g.breaks), b = P.applyMoves(a, s.argv), u = P.undoPlan(b, lay)
    assert.ok(g.argv.concat(s.argv, u.argv).every(function (x) { return x[2] !== SELF }))
    assert.strictEqual(j(P.applyMoves(b, u.argv)), j(lay))
  }],
  ["garbage never throws", function () {
    var junk = [undefined, null, 0, "x", [], {}, { left: "nope" }, { left: [null, 5, {}] }, [[1, 2]]]
    junk.forEach(function (a) {
      junk.forEach(function (b) {
        P.snapshot(a); P.applyMoves(a, b); P.presetPlan(a, "denial", b); P.presetPlan(a, b, b)
        P.movePillPlan(a, b, "left", 1, "right", b, a); P.movePillPlan(a, b, "left", 1, "right", b, b); P.movePillPlan(a, b, b, b, b, b, b); P.undoPlan(a, b)
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
