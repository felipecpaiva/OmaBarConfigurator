// SettingsSpec.js: pure helpers over settings/spec.json (the one file that
// lists every setting). No QML imports, so node can require() it for
// test/settings-spec-test.js. Default values are NOT here or in the spec:
// they live in PillStyle.DEFAULTS; numeric ranges in PillStyle.LIMITS.

var TYPES = ["toggle", "number", "choice", "color"]
var TARGETS = ["style", "bar"]
var HEX = /^#[0-9a-fA-F]{6}$/

function isHex(v) { return typeof v === "string" && HEX.test(v) }

function allSettings(spec) {
  var out = []
  var groups = (spec && spec.groups) || []
  for (var g = 0; g < groups.length; g++) {
    var list = groups[g].settings || []
    for (var i = 0; i < list.length; i++) out.push(list[i])
  }
  return out
}

// styleKeys: the keys of PillStyle.DEFAULTS. limits: PillStyle.LIMITS.
function validate(spec, styleKeys, limits) {
  var problems = []
  var seen = {}
  var byId = {}
  var all = allSettings(spec)
  var groups = (spec && spec.groups) || []
  var rowKeys = {}
  for (var g = 0; g < groups.length; g++)
    if (groups[g].page && groups[g].settings) problems.push("group " + groups[g].id + ": page and settings are both set")
  for (var i = 0; i < all.length; i++) {
    var s = all[i]
    if (seen[s.id]) problems.push("duplicate id " + s.id)
    seen[s.id] = true
    byId[s.id] = s
  }
  for (var j = 0; j < all.length; j++) {
    var r = all[j]
    if (TYPES.indexOf(r.type) < 0) problems.push(r.id + ": unknown type " + r.type)
    if (TARGETS.indexOf(r.target) < 0) problems.push(r.id + ": unknown target " + r.target)
    if (!r.label) problems.push(r.id + ": no label")
    if (!r.help) problems.push(r.id + ": no help")
    if ((r.type === "choice" || r.type === "color") && !(r.values && r.values.length)) problems.push(r.id + ": " + r.type + " needs values")
    if (r.target === "style") {
      rowKeys[r.key] = true
      if (styleKeys.indexOf(r.key) < 0) problems.push(r.id + ": style key " + r.key + " is not in DEFAULTS")
      if (r.key !== "enabled" && r.needs !== "style.enabled") problems.push(r.id + ": needs must be style.enabled")
      if (r.type === "number" && !(limits && limits[r.key])) problems.push(r.id + ": PillStyle.LIMITS has no entry for " + r.key)
    }
    var refs = ["needs", "disabledBy"]
    for (var k = 0; k < refs.length; k++) {
      var ref = r[refs[k]]
      if (!ref) continue
      if (!byId[ref]) problems.push(r.id + ": " + refs[k] + " points at missing id " + ref)
      else if (byId[ref].type !== "toggle") problems.push(r.id + ": " + refs[k] + " points at " + ref + ", which is not a toggle")
    }
  }
  for (var d = 0; d < styleKeys.length; d++)
    if (!rowKeys[styleKeys[d]]) problems.push("DEFAULTS key " + styleKeys[d] + " has no row")
  return problems
}

function visibleSettings(group, showAdvanced) {
  var list = (group && group.settings) || []
  return list.filter(function (s) { return showAdvanced || !s.advanced })
}

// values: { settingId: current value }. labels: optional { settingId: label } for the reason text.
function rowState(setting, values, labels) {
  var v = values || {}
  var name = function (id) { return (labels && labels[id]) || id }
  if (setting.needs && v[setting.needs] !== true) return { enabled: false, reason: "Turn on \"" + name(setting.needs) + "\" to use this." }
  if (setting.disabledBy && v[setting.disabledBy] === true) return { enabled: false, reason: "Not used while \"" + name(setting.disabledBy) + "\" is on." }
  return { enabled: true, reason: "" }
}

function numberRange(setting, limits) {
  var l = (limits && limits[setting.key]) || { min: 0, max: 1 }
  return { min: l.min, max: l.max, step: setting.step || 1 }
}

// What a page draws: one entry per visible row, with a header on the first row of each subgroup.
function pageRows(group, showAdvanced, values) {
  var labels = {}
  var list = (group && group.settings) || []
  for (var i = 0; i < list.length; i++) labels[list[i].id] = list[i].label
  var out = []
  var last = null
  var vis = visibleSettings(group, showAdvanced)
  for (var j = 0; j < vis.length; j++) {
    var s = vis[j]
    var st = rowState(s, values, labels)
    out.push({ setting: s, header: s.subgroup !== last ? (s.subgroup || "") : "", enabled: st.enabled, reason: st.reason })
    last = s.subgroup
  }
  return out
}

function hasAdvanced(group) {
  return ((group && group.settings) || []).some(function (s) { return !!s.advanced })
}

// Options for a ButtonGroup: [{ value, label }] using the spec's display names.
function choiceOptions(setting) {
  return (setting.values || []).map(function (v) {
    return { value: String(v), label: (setting.names && setting.names[v] !== undefined) ? setting.names[v] : String(v) }
  })
}

if (typeof module !== "undefined") {
  module.exports = {
    isHex: isHex, validate: validate, visibleSettings: visibleSettings, rowState: rowState,
    numberRange: numberRange, pageRows: pageRows, hasAdvanced: hasAdvanced, choiceOptions: choiceOptions,
    allSettings: allSettings
  }
}
