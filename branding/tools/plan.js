// node branding/tools/plan.js preset <id>      -> {"argv": [...], "breaks": {...}} for the bar as it is now
// node branding/tools/plan.js to <layout.json>  -> {"argv": [...]} back to a saved bar.layout (Undo's planner)
// The same lib/ code the panel runs (Presets.presetPlan, Presets.undoPlan), for the demo recorder.
var fs = require("fs"), path = require("path"), os = require("os")
var lib = path.join(__dirname, "..", "..")
var Presets = require(path.join(lib, "lib/Presets.js"))
var PresetTargets = require(path.join(lib, "lib/PresetTargets.js"))
var Model = require(path.join(lib, "Model.js"))

var shell = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/omarchy/shell.json"), "utf8"))
var store = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/omarchy/oma-bar-configurator.json"), "utf8"))
var layout = shell.bar.layout

function roles() {
  var ids = []
  ;["left", "centerBegin", "center", "centerEnd", "right"].forEach(function (k) {
    ;(layout[k] || []).forEach(function (e) { var id = typeof e === "string" ? e : e.id; if (id && ids.indexOf(id) < 0) ids.push(id) })
  })
  var workspaces = ids.filter(function (id) { return /workspaces$|\.spaces$/.test(id) })
  var anchor = Model.centerAnchorId({ bar: shell.bar })
  var clocks = anchor ? [anchor] : ids.filter(function (x) { return /clock$/.test(x) })
  var defaults = JSON.parse(fs.readFileSync(path.join(process.env.OMARCHY_PATH || "/usr/share/omarchy", "config/omarchy/shell.json"), "utf8"))
  return { workspaces: workspaces, selfId: Model.SELF_ID, centerAnchor: anchor, defaultLayout: defaults.bar.layout,
           aliases: { "omarchy.workspaces": workspaces, "omarchy.clock": clocks, "omarchy.tray": [] } }
}

var mode = process.argv[2], arg = process.argv[3], out
if (mode === "preset") out = Presets.presetPlan(layout, arg, roles(), (store.groups || {}).breaks || {}, PresetTargets)
else if (mode === "to") out = Presets.undoPlan(layout, JSON.parse(fs.readFileSync(arg, "utf8")))
else out = { error: "usage: plan.js preset <id> | to <layout.json>" }
process.stdout.write(JSON.stringify(out))
