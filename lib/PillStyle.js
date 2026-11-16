// PillStyle.js: pure style defaults, validation and store (de)serialising for
// the group-pill painter. No QML imports, so node can require() it for
// test/pill-style-test.js. Defaults live HERE and nowhere else.

var DEFAULTS = { enabled: false, color: "background", fillOpacity: 0.85,
                 borderColor: "foreground", borderOpacity: 0.12, borderWidth: 1,
                 radius: 999, padding: 12, gap: 8, inset: 5,
                 radiusFollowsWindows: false, animate: true }

// Group rules; all off. solo/noPill are widget ids (noPill wins if an id is in both).
var GROUP_DEFAULTS = { solo: [], noPill: [], centerParts: false }

var LIMITS = { fillOpacity: { min: 0, max: 1 }, borderOpacity: { min: 0, max: 1 },
               borderWidth: { min: 0, max: 4 }, radius: { min: 0, max: 999 },
               padding: { min: 0, max: 32 }, gap: { min: 0, max: 32 }, inset: { min: 0, max: 12 } }
var ROLES = ["background", "foreground", "accent", "urgent", "muted"]
var AREAS = ["left", "center", "right"]
var HEX = /^#[0-9a-fA-F]{6}$/

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v) }

function isColor(v) {
  return typeof v === "string" && (HEX.test(v) || ROLES.indexOf(v) >= 0)
}

// Every DEFAULTS key comes back valid; a bad one is replaced and named once.
function normalize(rawStyle) {
  var raw = isObj(rawStyle) ? rawStyle : {}
  var style = {}
  var warnings = []
  for (var key in DEFAULTS) {
    var v = raw[key]
    var d = DEFAULTS[key]
    if (v === undefined) { style[key] = d; continue }
    if (LIMITS[key]) {
      if (typeof v !== "number" || !isFinite(v)) {
        warnings.push("style." + key + " must be a number, using " + d)
        style[key] = d
      } else {
        style[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, v))
      }
    } else if (typeof d === "boolean") {
      if (typeof v !== "boolean") { warnings.push("style." + key + " must be true or false, using " + d); style[key] = d }
      else style[key] = v
    } else if (!isColor(v)) {
      warnings.push("style." + key + " must be a palette role or #rrggbb, using " + d)
      style[key] = d
    } else {
      style[key] = v
    }
  }
  return { style: style, warnings: warnings }
}

function resolveColor(nameOrHex, palette, fallback) {
  var p = isObj(palette) ? palette : {}
  var v = nameOrHex
  if (typeof v === "string" && ROLES.indexOf(v) >= 0) v = p[v]
  if (typeof v !== "string") return fallback
  if (HEX.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return ("#" + v.slice(3)).toLowerCase() // palette may carry #aarrggbb; alpha is a separate setting
  return fallback
}

function parseText(text) {
  try {
    var o = JSON.parse(String(text || "") || "{}")
    return isObj(o) ? { obj: o } : { obj: {}, error: "store is not a JSON object" }
  } catch (e) {
    return { obj: {}, error: "store unreadable (" + e + ")" }
  }
}

// Tolerant array check: host (QML) arrays fail Array.isArray.
function arrayLike(v) {
  return v !== null && typeof v === "object" && typeof v.length === "number"
}

function cleanBreaks(raw) {
  var out = { left: [], center: [], right: [] }
  var src = isObj(raw) ? raw : {}
  for (var a = 0; a < AREAS.length; a++) {
    var list = src[AREAS[a]]
    if (!arrayLike(list)) continue
    for (var i = 0; i < list.length; i++)
      if (typeof list[i] === "string" && list[i]) out[AREAS[a]].push(list[i])
  }
  return out
}

// Unique non-empty strings, in order; anything else is dropped.
function cleanIds(raw) {
  var out = []
  if (!arrayLike(raw)) return out
  for (var i = 0; i < raw.length; i++)
    if (typeof raw[i] === "string" && raw[i] && out.indexOf(raw[i]) < 0) out.push(raw[i])
  return out
}

// The last layout change, kept so Undo can put it back. Loose check: the
// layout itself is handed to lib/Presets.js, which validates what it reads.
function cleanUndo(raw) {
  if (!isObj(raw) || !isObj(raw.layout)) return null
  return { layout: raw.layout, breaks: isObj(raw.breaks) ? cleanBreaks(raw.breaks) : null,
           label: typeof raw.label === "string" ? raw.label : "",
           at: typeof raw.at === "string" ? raw.at : "",
           // True from before the first move until the run ends: still true on
           // open means the panel was closed mid run.
           running: raw.running === true }
}

function readStore(text) {
  var parsed = parseText(text)
  var o = parsed.obj
  var warnings = parsed.error ? [parsed.error + ", starting empty"] : []
  var n = normalize(o.style)
  var groups = isObj(o.groups) ? o.groups : {}
  return {
    version: 2,
    hidden: arrayLike(o.hidden) ? o.hidden : [],
    style: n.style,
    groups: { breaks: cleanBreaks(isObj(groups.breaks) ? groups.breaks : null),
              solo: cleanIds(groups.solo), noPill: cleanIds(groups.noPill),
              centerParts: groups.centerParts === true ? true : GROUP_DEFAULTS.centerParts },
    undo: cleanUndo(o.undo),
    warnings: warnings.concat(n.warnings)
  }
}

// Merge only the patch's own keys over the previous file; everything else,
// including keys this version does not know, is written back untouched.
// `undo: null` removes the undo record.
function writeStore(prevText, patch) {
  var obj = parseText(prevText).obj
  var p = isObj(patch) ? patch : {}
  var keys = ["hidden", "style", "groups", "undo"]
  for (var i = 0; i < keys.length; i++)
    if (p[keys[i]] !== undefined) obj[keys[i]] = p[keys[i]]
  if (p.undo === null) delete obj.undo
  obj.version = 2
  return JSON.stringify(obj, null, 2) + "\n"
}

// Merge `patch` into the RAW `section` ("style" or "groups") of the previous
// file. Unknown keys and untouched defaults are left alone. For groups the
// patch is {breaks: {area: [...]}}: breaks merges per area, so the areas the
// patch omits survive too. solo/noPill are cleaned to unique strings and
// centerParts is kept only when boolean; other group keys pass through.
function patchStore(prevText, section, patch) {
  var obj = parseText(prevText).obj
  var p = isObj(patch) ? patch : {}
  var cur = isObj(obj[section]) ? obj[section] : {}
  for (var k in p) {
    if (section === "groups" && k === "breaks" && isObj(p[k])) {
      var b = isObj(cur.breaks) ? cur.breaks : {}
      for (var a in p[k]) b[a] = p[k][a]
      cur.breaks = b
    } else if (section === "groups" && (k === "solo" || k === "noPill")) {
      if (arrayLike(p[k])) cur[k] = cleanIds(p[k])
    } else if (section === "groups" && k === "centerParts") {
      if (typeof p[k] === "boolean") cur[k] = p[k]
    } else {
      cur[k] = p[k]
    }
  }
  obj[section] = cur
  obj.version = 2
  return JSON.stringify(obj, null, 2) + "\n"
}

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULTS: DEFAULTS,
    GROUP_DEFAULTS: GROUP_DEFAULTS,
    LIMITS: LIMITS,
    normalize: normalize,
    resolveColor: resolveColor,
    readStore: readStore,
    writeStore: writeStore,
    patchStore: patchStore
  }
}
