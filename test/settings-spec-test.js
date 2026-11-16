// node test/settings-spec-test.js
var assert = require("assert")
var fs = require("fs")
var path = require("path")
var S = require("../lib/SettingsSpec.js")
var P = require("../lib/PillStyle.js")

var spec = JSON.parse(fs.readFileSync(path.join(__dirname, "../settings/spec.json"), "utf8"))
assert.ok(P.LIMITS, "lib/PillStyle.js must export LIMITS ({key: {min, max}}); the lead integrates it")
assert.ok("radiusFollowsWindows" in P.DEFAULTS, "PillStyle.DEFAULTS needs radiusFollowsWindows")

// the real spec against the real defaults
assert.deepStrictEqual(S.validate(spec, Object.keys(P.DEFAULTS), P.LIMITS), [])

// validate catches each defect
var keys = ["enabled", "a"]
var lim = { a: { min: 0, max: 1 } }
function mk(rows, extra) { return { groups: [Object.assign({ id: "g", settings: rows }, extra || {})] } }
var en = { id: "style.enabled", target: "style", key: "enabled", type: "toggle", label: "L", help: "h" }
var a = { id: "style.a", target: "style", key: "a", type: "number", label: "L", help: "h", needs: "style.enabled" }
function has(sp, text, k, l) {
  var p = S.validate(sp, k || keys, l || lim).join("|")
  assert.ok(p.indexOf(text) >= 0, "expected '" + text + "' in: " + p)
}
assert.deepStrictEqual(S.validate(mk([en, a]), keys, lim), [])
has(mk([en, a, Object.assign({}, a, { type: "slider" })]), "unknown type")
has(mk([en, a, a]), "duplicate id")
has(mk([en, Object.assign({}, a, { key: "zzz" })]), "not in DEFAULTS")
has(mk([en]), "DEFAULTS key a has no row")
has(mk([en, Object.assign({}, a, { needs: "nope" })]), "missing id")
has(mk([en, Object.assign({}, a, { disabledBy: "style.a" })]), "not a toggle")
has(mk([en, a], { page: "x" }), "page and settings are both set")
has(mk([en, a]), "LIMITS has no entry", keys, {})

// visibleSettings
var adv = Object.assign({}, a, { id: "style.b", advanced: true })
var grp = { settings: [en, a, adv] }
assert.strictEqual(S.visibleSettings(grp, false).length, 2)
assert.strictEqual(S.visibleSettings(grp, true).length, 3)
assert.deepStrictEqual(S.visibleSettings({ page: "x" }, true), [])
assert.strictEqual(S.hasAdvanced(grp), true)
assert.strictEqual(S.hasAdvanced({ settings: [en] }), false)

// rowState
assert.deepStrictEqual(S.rowState(en, {}), { enabled: true, reason: "" })
assert.strictEqual(S.rowState(a, { "style.enabled": false }).enabled, false)
assert.ok(S.rowState(a, {}, { "style.enabled": "Show pills" }).reason.indexOf("Show pills") >= 0)
assert.strictEqual(S.rowState(a, { "style.enabled": true }).enabled, true)
var d = Object.assign({}, a, { disabledBy: "style.f" })
assert.strictEqual(S.rowState(d, { "style.enabled": true, "style.f": true }).enabled, false)
assert.strictEqual(S.rowState(d, { "style.enabled": true, "style.f": false }).enabled, true)

// numberRange
assert.deepStrictEqual(S.numberRange(Object.assign({}, a, { step: 0.05 }), lim), { min: 0, max: 1, step: 0.05 })
assert.strictEqual(S.numberRange(a, lim).step, 1)

// pageRows: header only on the first row of a subgroup
var rows = S.pageRows({ settings: [Object.assign({ subgroup: "X" }, en), Object.assign({ subgroup: "X" }, a), Object.assign({ subgroup: "Y" }, adv)] }, true, { "style.enabled": true })
assert.deepStrictEqual(rows.map(function (r) { return r.header }), ["X", "", "Y"])

// choiceOptions and isHex
assert.deepStrictEqual(S.choiceOptions({ values: ["a", "b"], names: { a: "A" } }), [{ value: "a", label: "A" }, { value: "b", label: "b" }])
assert.ok(S.isHex("#a1B2c3") && !S.isHex("#abc") && !S.isHex("red"))

console.log("settings-spec-test OK")
