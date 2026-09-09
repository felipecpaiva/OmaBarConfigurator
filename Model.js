// Model.js — the pure-JS core of the bar picker. No QML imports, so node can
// require() it for test/model-test.js.
//
// Every function here is pure: (shellConfig, our own saved state) in, plain
// data out. Nothing writes shell.json — a panel plugin cannot (FINDINGS.md,
// "A third-party PANEL plugin cannot write bar.layout") — so the output is
// argv arrays for the caller to hand to Quickshell.execDetached / Process.
//
// `shellConfig` may be the whole shell.json object OR just its `bar:` subtree
// (which is what Bar.qml is handed). Both are accepted; see barConfig().

var REGIONS = ["left", "center", "right"]

// ---------------------------------------------------------------- host mirrors
//
// entryId / entrySettings / widgetKind / resolveCenterAnchor mirror the host's
// shell/plugins/bar/BarModel.js. Duplicated rather than imported: a
// third-party plugin has no stable relative path into the host shell tree, and
// anchor resolution in particular has to agree with the bar that draws it — if
// ours disagrees, "is this the anchor?" is wrong and the safety is worthless.

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

// Entries can be bare strings ("omarchy.clock") as well as objects.
function entryId(entry) {
  if (typeof entry === "string") return entry
  if (isPlainObject(entry)) {
    var id = entry["id"]
    if (id !== undefined && id !== null && String(id) !== "") return String(id)
  }
  return ""
}

// Everything on the entry except the id — the inline settings that
// `plugin disable` splices away and nothing stores.
function entrySettings(entry) {
  if (!isPlainObject(entry)) return {}
  var copy = {}
  for (var key in entry) {
    if (key === "id") continue
    copy[key] = entry[key]
  }
  return copy
}

function widgetKind(id) {
  var value = String(id || "")
  var dot = value.lastIndexOf(".")
  return dot === -1 ? value : value.slice(dot + 1)
}

// Host copy: exact id wins; otherwise the single center widget of the same
// kind is the pin (a clone or a swapped-in clock); two of a kind is ambiguous
// so the stale name is left as-is.
function resolveCenterAnchor(entries, name) {
  var anchor = String(name || "")
  if (!anchor) return ""
  if (indexOfId(entries, anchor) !== -1) return anchor
  if (!Array.isArray(entries)) return anchor

  var kind = widgetKind(anchor)
  if (!kind) return anchor

  var match = ""
  for (var i = 0; i < entries.length; i++) {
    var id = entryId(entries[i])
    if (!id || widgetKind(id) !== kind) continue
    if (match) return anchor
    match = id
  }
  return match || anchor
}

// ---------------------------------------------------------------- config reads

function barConfig(shellConfig) {
  if (!isPlainObject(shellConfig)) return {}
  if (isPlainObject(shellConfig.bar)) return shellConfig.bar
  return shellConfig // already the `bar:` subtree
}

function sectionEntries(shellConfig, section) {
  var layout = barConfig(shellConfig).layout
  var entries = isPlainObject(layout) ? layout[section] : null
  return Array.isArray(entries) ? entries : []
}

function indexOfId(entries, id) {
  if (!Array.isArray(entries)) return -1
  var key = String(id || "")
  if (!key) return -1
  for (var i = 0; i < entries.length; i++) {
    if (entryId(entries[i]) === key) return i
  }
  return -1
}

function centerAnchorId(shellConfig) {
  return resolveCenterAnchor(sectionEntries(shellConfig, "center"),
                             barConfig(shellConfig).centerAnchor)
}

// ------------------------------------------------------------------- catalogue

// One row per widget the user could show or hide: every entry currently in the
// layout, then every id we have saved as hidden. A saved id that is back in
// the layout (re-enabled out of band, from the CLI) is reported visible — the
// layout is the truth, our saved list is only a memory of settings.
function barCatalogue(shellConfig, savedHidden) {
  var rows = []
  var anchor = centerAnchorId(shellConfig)
  var seen = {}

  for (var r = 0; r < REGIONS.length; r++) {
    var entries = sectionEntries(shellConfig, REGIONS[r])
    for (var i = 0; i < entries.length; i++) {
      var id = entryId(entries[i])
      if (!id) continue // an entry with no id draws nothing, so there is nothing to toggle
      seen[id] = true
      rows.push({
        id: id,
        region: REGIONS[r],
        index: i,
        visible: true,
        isAnchor: REGIONS[r] === "center" && id === anchor
      })
    }
  }

  var saved = Array.isArray(savedHidden) ? savedHidden : []
  for (var s = 0; s < saved.length; s++) {
    var record = saved[s]
    var savedId = isPlainObject(record) ? String(record.id || "") : String(record || "")
    if (!savedId || seen[savedId]) continue
    seen[savedId] = true
    rows.push({ id: savedId, region: null, index: null, visible: false, isAnchor: false })
  }

  return rows
}

// --------------------------------------------------------------------- capture

// Everything needed to put a widget back exactly where it was, including its
// inline settings. null when the id is not in the layout.
//
// `entry` is deep-copied: the caller persists this and the host mutates its
// live config in place.
//
// prevId/nextId are additions to the agreed shape. They are what makes the
// restore survive other widgets moving — see showArgv().
function captureEntry(shellConfig, id) {
  var key = String(id || "")
  if (!key) return null

  for (var r = 0; r < REGIONS.length; r++) {
    var entries = sectionEntries(shellConfig, REGIONS[r])
    var index = indexOfId(entries, key)
    if (index === -1) continue
    var entry = entries[index]
    return {
      id: key,
      section: REGIONS[r],
      index: index,
      entry: isPlainObject(entry) ? JSON.parse(JSON.stringify(entry)) : entry,
      prevId: index > 0 ? entryId(entries[index - 1]) : "",
      nextId: index + 1 < entries.length ? entryId(entries[index + 1]) : ""
    }
  }
  return null
}

// ------------------------------------------------------------------ argv build

function hideArgv(id) {
  return ["omarchy-plugin-disable", String(id || "")]
}

// Restore placement: by NEIGHBOUR, falling back to index.
//
// A captured index is stale the moment anything else in the same section is
// hidden — hide three widgets left of the clock and its index 3 now points
// three slots too far right. `omarchy plugin enable --after <id>` is resolved
// by the host against the CURRENT layout (PluginRegistry.barTarget ->
// findRelativeBarLocation), so a neighbour that is still on the bar always
// lands the widget in the right place.
//
// The neighbour is checked against `shellConfig` here rather than left to the
// host, because a placement the host cannot resolve is a hard CLI failure and
// execDetached gives the caller no exit code to recover from. Fall back in
// this order:
//   1. --after prevId   (the widget that was to its left)
//   2. --before nextId  (the widget that was to its right)
//   3. --index          (clamped to the section length, as the host clamps it)
// Both neighbours gone means everything around it was hidden too, and the
// index is then as good an answer as exists.
//
// Called with no shellConfig it emits the plain --section/--index form.
function showArgv(saved, shellConfig) {
  if (!isPlainObject(saved) || !String(saved.id || "")) return null
  var section = REGIONS.indexOf(saved.section) !== -1 ? saved.section : "center"
  var argv = ["omarchy-plugin-enable", String(saved.id), "--section", section]
  var entries = shellConfig === undefined || shellConfig === null
    ? null : sectionEntries(shellConfig, section)

  if (entries) {
    if (saved.prevId && indexOfId(entries, saved.prevId) !== -1)
      return argv.concat(["--after", String(saved.prevId)])
    if (saved.nextId && indexOfId(entries, saved.nextId) !== -1)
      return argv.concat(["--before", String(saved.nextId)])
  }

  var index = Math.floor(Number(saved.index))
  if (!isFinite(index) || index < 0) index = 0
  if (entries) index = Math.min(index, entries.length)
  return argv.concat(["--index", String(index)])
}

// `plugin enable` re-inserts a bare `{ id: key }` (PluginRegistry.setEnabled),
// so every inline setting has to be pushed back one key at a time with
// `omarchy bar set <id> <key> <value> [--json]`. Non-strings go through --json
// because cmd_set otherwise quotes the value as a string — `alwaysShow true`
// would store the string "true".
function restoreSettingsArgv(saved) {
  if (!isPlainObject(saved)) return []
  var id = String(saved.id || "")
  if (!id) return []
  var section = REGIONS.indexOf(saved.section) !== -1 ? saved.section : ""
  var settings = entrySettings(saved.entry)
  var out = []
  for (var key in settings) {
    var value = settings[key]
    var argv = ["omarchy-bar", "set", id, String(key)]
    if (typeof value === "string") argv.push(value)
    else argv.push(JSON.stringify(value), "--json")
    // --section only (no --index): setBarWidget locates by id inside the
    // section, which is immune to the index having shifted between the enable
    // and this call.
    if (section) argv.push("--section", section)
    out.push(argv)
  }
  return out
}

// The commands a hide needs, in order. One command normally.
//
// Two for a CLONE widget (a manifest with omarchy.clonedFrom, e.g. felipe.tray
// cloned from omarchy.tray): disabling a clone does not remove its slot, it
// rewrites the slot to the source id (PluginRegistry.restoreCloneSource), so
// the widget visibly stays. Disabling the source afterwards splices the slot
// out for real. The caller passes clonedFrom from the plugin catalogue —
// shellConfig does not carry it.
//
// ponytail: assumes the source is not separately on the bar. If it is,
// disabling the clone first drags it into the clone's slot and the second
// command removes it from there, losing the source's own placement. Needs the
// source's own captureEntry to fix, which needs the catalogue in this module.
function hideSequence(id, clonedFrom) {
  var argv = [hideArgv(id)]
  if (clonedFrom && String(clonedFrom) !== String(id)) argv.push(hideArgv(clonedFrom))
  return argv
}

// The commands a show needs, IN ORDER — placement first, then one `bar set`
// per inline setting. These must run sequentially: `bar set` fails with
// "could not find widget" if it lands before the enable. Quickshell's
// execDetached is fire-and-forget, so the caller must drive these with a
// Process and step on `exited`, not fire them all at once.
function showSequence(saved, shellConfig) {
  var placement = showArgv(saved, shellConfig)
  if (!placement) return []
  return [placement].concat(restoreSettingsArgv(saved))
}

// -------------------------------------------------------------- anchor safety

// True when hiding `id` would un-pin the centre section. That requires the
// resolved anchor to actually BE in the centre list: a pin naming a widget
// that is not there is already unresolved, and hiding anything cannot make it
// worse. Same test as nextAnchorAfterHiding, so the two always agree.
function isCenterAnchor(shellConfig, id) {
  var center = sectionEntries(shellConfig, "center")
  var anchor = resolveCenterAnchor(center, barConfig(shellConfig).centerAnchor)
  if (!anchor || indexOfId(center, anchor) === -1) return false
  return anchor === String(id || "")
}

// What bar.centerAnchor should name once `id` is hidden. "" means anchoring
// off. The return value is always "" or an id that is still in the center list
// after the hide — never dangling.
//
// Hiding a non-anchor returns the RESOLVED anchor rather than the raw config
// string, so a pin that was already stale gets repaired rather than carried.
function nextAnchorAfterHiding(shellConfig, id) {
  var key = String(id || "")
  var center = sectionEntries(shellConfig, "center")
  var anchor = resolveCenterAnchor(center, barConfig(shellConfig).centerAnchor)
  if (!anchor) return ""
  if (indexOfId(center, anchor) === -1) return "" // named nothing on the bar
  if (anchor !== key) return anchor

  var survivors = []
  for (var i = 0; i < center.length; i++) {
    var cid = entryId(center[i])
    if (cid && cid !== key) survivors.push(cid)
  }
  if (survivors.length === 0) return ""

  // Same kind first — this is how the host itself recovers a stale pin
  // (resolveCenterAnchor's kind fallback), so a second clock takes over the
  // pin. Two of a kind is ambiguous there, and guessing here would disagree.
  var kind = widgetKind(anchor)
  var match = ""
  for (var j = 0; j < survivors.length; j++) {
    if (widgetKind(survivors[j]) !== kind) continue
    if (match) { match = ""; break }
    match = survivors[j]
  }
  if (match) return match

  // Otherwise pin the middle survivor: it keeps the center group closest to
  // where it already sat. Any other pick is a bigger jump. An even count has
  // no middle, so take the later of the two.
  return survivors[Math.floor(survivors.length / 2)]
}

if (typeof module !== "undefined") {
  module.exports = {
    barCatalogue: barCatalogue,
    captureEntry: captureEntry,
    hideArgv: hideArgv,
    hideSequence: hideSequence,
    showArgv: showArgv,
    restoreSettingsArgv: restoreSettingsArgv,
    showSequence: showSequence,
    isCenterAnchor: isCenterAnchor,
    nextAnchorAfterHiding: nextAnchorAfterHiding,
    // exported for the tests and for Panel.qml's own row rendering
    entryId: entryId,
    entrySettings: entrySettings,
    widgetKind: widgetKind
  }
}
