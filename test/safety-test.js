// node test/safety-test.js
// Quality bar section 3 and 5 lines that need no live shell: hand edited store files,
// "no OmaBar file writes shell.json", install/uninstall script shape, Text and color rules.
var assert = require("assert")
var fs = require("fs")
var path = require("path")
var P = require("../lib/PillStyle.js")
var root = path.join(__dirname, "..")
var read = function (f) { return fs.readFileSync(path.join(root, f), "utf8") }
var tests = []
function test(name, fn) { tests.push([name, fn]) }

// ---- bad or hand edited store -------------------------------------------
var BAD = [
  "", "{not json", "[1,2]", "null", "42", "\"text\"", "{\"style\":", "\u0000\u0001",
  JSON.stringify({ hidden: 5, style: [], groups: "x", undo: 7, version: "two" }),
  JSON.stringify({ hidden: {}, style: { gap: null, radius: "big", color: 7, enabled: 1, animate: "no" },
                   groups: { breaks: [], solo: "a", noPill: [1, null, {}], centerParts: "yes" }, undo: [] }),
  JSON.stringify({ style: { gap: 4, madeUp: true }, groups: { madeUp: 1 }, future: { a: 1 } })
]
test("readStore never throws and always returns a usable store", function () {
  BAD.forEach(function (t) {
    var r = P.readStore(t)
    ;["hidden", "style", "groups", "warnings"].forEach(function (k) { assert.ok(r[k] !== undefined, k + " for " + t) })
    assert.ok(Array.isArray(r.warnings))
    assert.ok(Array.isArray(r.groups.solo) && Array.isArray(r.groups.noPill))
    ;["left", "center", "right"].forEach(function (a) { assert.ok(Array.isArray(r.groups.breaks[a])) })
    assert.strictEqual(r.groups.centerParts, false)
    assert.strictEqual(r.undo, null)
    Object.keys(P.DEFAULTS).forEach(function (k) { assert.strictEqual(typeof r.style[k], typeof P.DEFAULTS[k], k) })
  })
})
test("broken JSON gives defaults and exactly one warning", function () {
  ;["{not json", "[1,2]", "null", "42", "{\"style\":"].forEach(function (t) {
    var r = P.readStore(t)
    assert.deepStrictEqual(r.style, P.DEFAULTS)
    assert.strictEqual(r.style.enabled, false)
    assert.strictEqual(r.warnings.length, 1, t)
  })
})
test("wrong typed style keys fall back to defaults, one warning per key, named", function () {
  var r = P.readStore(BAD[9])
  assert.strictEqual(r.style.gap, P.DEFAULTS.gap)
  assert.strictEqual(r.style.radius, P.DEFAULTS.radius)
  assert.strictEqual(r.style.color, P.DEFAULTS.color)
  assert.strictEqual(r.style.enabled, false)
  assert.strictEqual(r.style.animate, true)
  assert.strictEqual(r.warnings.length, 5)
  assert.ok(r.warnings.every(function (w) { return /^style\./.test(w) }))
  assert.deepStrictEqual(r.hidden, [])
  assert.deepStrictEqual(r.groups.noPill, [])
})
test("unknown keys are ignored on read and survive a patch on write", function () {
  var r = P.readStore(BAD[10])
  assert.strictEqual(r.style.gap, 4)
  assert.deepStrictEqual(r.warnings, [])
  var out = JSON.parse(P.patchStore(BAD[10], "style", { inset: 5 }))
  assert.strictEqual(out.style.madeUp, true)
  assert.strictEqual(out.groups.madeUp, 1)
  assert.deepStrictEqual(out.future, { a: 1 })
  assert.strictEqual(out.style.inset, 5)
})
test("patchStore and writeStore on garbage text give valid JSON, never throw", function () {
  BAD.forEach(function (t) {
    var a = JSON.parse(P.patchStore(t, "style", { gap: 6 }))
    assert.strictEqual(a.style.gap, 6)
    assert.strictEqual(a.version, 2)
    var b = JSON.parse(P.patchStore(t, "groups", { breaks: { left: ["x"] }, solo: ["y"] }))
    assert.deepStrictEqual(b.groups.breaks.left, ["x"])
    var c = JSON.parse(P.writeStore(t, { hidden: ["z"] }))
    assert.deepStrictEqual(c.hidden, ["z"])
    assert.doesNotThrow(function () { P.patchStore(t, "style", null); P.writeStore(t, undefined) })
  })
})

// ---- no OmaBar file writes shell.json -----------------------------------
function codeFiles() {
  var out = ["Panel.qml", "Model.js"]
  ;["pills", "panel", "lib", "settings"].forEach(function (d) {
    fs.readdirSync(path.join(root, d)).forEach(function (f) { out.push(d + "/" + f) })
  })
  return out.filter(function (f) { return /\.(qml|js|json)$/.test(f) })
}
test("the only file the plugin writes is its own store, never shell.json", function () {
  var panel = read("Panel.qml")
  var writes = []
  codeFiles().forEach(function (f) {
    read(f).split("\n").forEach(function (l, i) {
      if (/^\s*\/\//.test(l)) return
      if (/\.setText\(|writeAdapter|\bwritable\b|\.write\(|writeFile|writeFileSync/.test(l)) writes.push(f + ":" + (i + 1) + " " + l.trim())
    })
  })
  assert.deepStrictEqual(writes, ["Panel.qml:" + (panel.split("\n").findIndex(function (l) { return /store\.setText\(text\)/.test(l) }) + 1) + " store.setText(text)"])
  assert.ok(/id: store[\s\S]{0,80}path: root\.storePath/.test(panel), "store.setText must target storePath")
  assert.ok(/storePath:[\s\S]{0,120}oma-bar-configurator\.json/.test(panel), "storePath is the plugin's own json")
  // every FileView that points at shell.json is read only
  var re = /FileView \{[^}]*?shell\.json[^}]*?\}/g, m, n = 0
  while ((m = re.exec(panel)) !== null) { n++; assert.ok(!/setText|writable/.test(m[0]), "shell.json FileView must be read only") }
  assert.ok(n >= 1)
})
test("every shell command goes through runSequence as an omarchy CLI argv", function () {
  var panel = read("Panel.qml")
  var bash = panel.split("\n").filter(function (l) { return /command:\s*\[/.test(l) || /runner\.command\s*=/.test(l) })
  bash.forEach(function (l) {
    assert.ok(/omarchy-plugin-list|omarchy-shell|bash", "-lc", 'exec "\$@"', "bash"\]\.concat\(next\)/.test(l), "unexpected command: " + l.trim())
  })
  var lib = read("Model.js") + read("lib/Presets.js") + read("lib/PresetTargets.js")
  var heads = lib.match(/\["omarchy[-a-z]*"/g) || []
  assert.ok(heads.length >= 4)
  heads.forEach(function (h) { assert.ok(/^\["omarchy-(bar|plugin-enable|plugin-disable)"$/.test(h), h) })
  assert.ok(!/\b(sed|tee|jq)\b[^\n]*shell\.json|>\s*[^\n]*shell\.json/.test(panel + lib), "no shell redirect into shell.json")
})

// ---- install.sh and uninstall.sh (read, never run) ------------------------
var inst = read("install.sh"), uninst = read("uninstall.sh")
test("install.sh: strict mode, copies lib pills panel settings, validates, marker desktop entry", function () {
  assert.ok(/^set -euo pipefail$/m.test(inst))
  assert.ok(/for dir in lib pills panel settings; do/.test(inst))
  assert.ok(/manifest\.json.*\*\.qml.*\*\.js/.test(inst))
  assert.ok(inst.indexOf("omarchy plugin validate") < inst.indexOf("omarchy plugin enable"))
  assert.ok(/X-OmaBarConfigurator-Managed=true/.test(inst) && /X-OmaBarConfigurator-Managed=true/.test(read("omabarconfigurator.desktop")))
  assert.ok(!/shell\.json/.test(inst.replace(/^#.*$/gm, "")), "install never touches shell.json directly")
})
test("uninstall.sh: repeats disable, removes the desktop entry only when marked, keeps the store", function () {
  assert.ok(/^set -uo pipefail$/m.test(uninst))
  assert.ok(/for _ in 1 2 3 4 5; do[\s\S]*omarchy plugin disable[\s\S]*done/.test(uninst))
  assert.ok(/\.enabled == true/.test(uninst), "loop ends when the plugin is no longer enabled")
  assert.ok(/-f \$DESKTOP_DEST \]\] && grep -qF "\$MARKER"[^\n]*\n\s*rm -f "\$DESKTOP_DEST"/.test(uninst))
  var code = uninst.replace(/^\s*#.*$/gm, "")
  var removes = code.split("\n").filter(function (l) { return /\brm\b/.test(l) })
  assert.deepStrictEqual(removes.map(function (l) { return l.trim() }), ['rm -f "$DESKTOP_DEST"', 'rm -rf "$PLUGIN_DEST"'])
  assert.ok(!/oma-bar-configurator\.json/.test(code), "the style store is kept")
  assert.ok(uninst.indexOf("omarchy plugin disable") < uninst.indexOf('rm -rf "$PLUGIN_DEST"'), "disable before removing files")
})

// ---- code rules ------------------------------------------------------------
test("every Text has textFormat PlainText and no QML file hard codes a color", function () {
  var qml = ["Panel.qml"]
  ;["pills", "panel"].forEach(function (d) { fs.readdirSync(path.join(root, d)).forEach(function (f) { if (/\.qml$/.test(f)) qml.push(d + "/" + f) }) })
  qml.forEach(function (f) {
    var s = read(f), lines = s.split("\n")
    lines.forEach(function (l, i) {
      if (/^\s*Text \{/.test(l)) {
        var j = i + 1, depth = 1, body = ""
        for (; j < lines.length && depth > 0; j++) { body += lines[j] + "\n"; depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length }
        assert.ok(/textFormat: Text\.PlainText/.test(body), f + ":" + (i + 1) + " Text without PlainText")
      }
    })
    var noComments = s.replace(/\/\/.*$/gm, "")
    assert.ok(!/#[0-9a-fA-F]{6,8}\b|Qt\.rgba?\(\s*[0-9]|"(white|black|red|green|blue)"/.test(noComments), f + " hard codes a color")
  })
})

var failed = 0
tests.forEach(function (t) {
  try { t[1](); console.log("ok   " + t[0]) } catch (e) { failed++; console.log("FAIL " + t[0] + "\n  " + e.message) }
})
console.log((tests.length - failed) + "/" + tests.length + " passed")
process.exit(failed ? 1 : 0)
