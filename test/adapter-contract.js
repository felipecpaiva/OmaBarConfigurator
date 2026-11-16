// node test/adapter-contract.js
//
// Static check of the private Omarchy bar names BarAdapter.js relies on
// (docs/architecture.md section 6). Reads the installed Bar.qml only.

var assert = require("assert")
var fs = require("fs")
var path = require("path")

// One table: component -> properties it must declare, and ids it must contain.
// BarAdapter.js shares this list conceptually; keep them in step.
var REQUIRED = {
  WidgetHost: { props: ["owner", "pool", "entry", "activeItem", "key"], ids: ["registryLoader"] },
  ModuleSlot: { props: ["region", "widgetKey", "entry", "moduleName", "activeItem", "host", "pool"], ids: ["holder"], readonlyAliases: ["widgetHolder"] },
  WidgetPool: { props: ["hosts", "slots"], ids: [] },
  ModuleList: { props: ["region", "keys", "pool", "listRows"], ids: [] }
}

// Body of `component Name: Type {` up to the closing brace at the same indent.
// Bar.qml indents components by two spaces, so the first line that starts with
// "  }" ends the block. Returns null when the component is absent.
function componentBlock(src, name) {
  var lines = src.split("\n")
  var start = lines.findIndex(function (l) { return new RegExp("^  component " + name + ":").test(l) })
  if (start < 0) return null
  var end = lines.findIndex(function (l, i) { return i > start && /^  \}/.test(l) })
  return end < 0 ? null : lines.slice(start, end + 1).join("\n")
}

var hasProp = function (b, n) { return new RegExp("\\bproperty\\s+(?:var|string|real|bool|int|Item|\\w+)\\s+" + n + "\\b").test(b) }
var hasId = function (b, n) { return new RegExp("\\bid:\\s*" + n + "\\b").test(b) }

function check(src) {
  var problems = []
  var passes = []
  Object.keys(REQUIRED).forEach(function (comp) {
    var block = componentBlock(src, comp)
    var spec = REQUIRED[comp]
    if (!block) { problems.push("component " + comp + " not found in Bar.qml"); return }
    spec.props.concat(spec.readonlyAliases || []).forEach(function (n) {
      ;(hasProp(block, n) ? passes : problems).push(hasProp(block, n) ? comp + "." + n : "missing property '" + n + "' in component " + comp)
    })
    spec.ids.forEach(function (n) {
      ;(hasId(block, n) ? passes : problems).push(hasId(block, n) ? comp + " id:" + n : "missing id '" + n + "' in component " + comp)
    })
  })
  return { problems: problems, passes: passes }
}

if (require.main === module) {
  var file = path.join(process.env.OMARCHY_PATH || "/usr/share/omarchy", "shell/plugins/bar/Bar.qml")
  if (!fs.existsSync(file)) {
    console.log("SKIP adapter-contract: Omarchy bar not installed")
    process.exit(0)
  }
  var res = check(fs.readFileSync(file, "utf8"))
  res.passes.forEach(function (p) { console.log("PASS " + p) })
  if (res.problems.length) {
    res.problems.forEach(function (p) { console.error("FAIL adapter-contract: " + p) })
    process.exit(1)
  }
  // Self-check: the parser must flag a name that is not there.
  assert.ok(check("  component WidgetHost: Item {\n  }\n").problems.length > 0)
  console.log("OK adapter-contract: " + res.passes.length + " names")
}

module.exports = { REQUIRED: REQUIRED, check: check }
