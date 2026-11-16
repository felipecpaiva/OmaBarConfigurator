// PillStyle.js — pure style defaults, validation and store (de)serialising for
// the group-pill painter. No QML imports, so node can require() it for
// test/pill-style-test.js. Defaults live HERE and nowhere else.

var DEFAULTS = { enabled: false, color: "background", fillOpacity: 0.85,
                 borderColor: "foreground", borderOpacity: 0.12, borderWidth: 1,
                 radius: 999, padding: 12, gap: 8, inset: 5,
                 radiusFollowsWindows: false }

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
    groups: { breaks: cleanBreaks(isObj(groups.breaks) ? groups.breaks : null) },
    warnings: warnings.concat(n.warnings)
  }
}

// Merge only the patch's own keys over the previous file; everything else,
// including keys this version does not know, is written back untouched.
function writeStore(prevText, patch) {
  var obj = parseText(prevText).obj
  var p = isObj(patch) ? patch : {}
  var keys = ["hidden", "style", "groups"]
  for (var i = 0; i < keys.length; i++)
    if (p[keys[i]] !== undefined) obj[keys[i]] = p[keys[i]]
  obj.version = 2
  return JSON.stringify(obj, null, 2) + "\n"
}

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULTS: DEFAULTS,
    LIMITS: LIMITS,
    normalize: normalize,
    resolveColor: resolveColor,
    readStore: readStore,
    writeStore: writeStore
  }
}
