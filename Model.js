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

// A capture records the nearest VISIBLE neighbours, which is the only pair the
// layout can show — a widget already hidden is not in it to be seen. That is
// exact for one hide and wrong for a run of them: hide network, then audio,
// then monitor, and all three record `omarchy.bluetooth` as prevId, because
// each one inherited the survivor the one before it left behind.
//
// Restoring all three `--after omarchy.bluetooth` stacks them against the same
// wall, so they come back in reverse. Measured on this machine, hiding
// network/audio/monitor/bluetooth and restoring them top-down turned
//   bluetooth network audio monitor
// into
//   bluetooth monitor audio network
//
// The recovery is the hide ORDER, which `savedHidden` already carries: two
// records naming the same prevId cannot have had anything visible between
// them, and the one hidden FIRST is the left one — at the later hide it was
// already gone, which is exactly why the later one inherited its neighbour.
// So X follows the last same-prev record hidden before it that is back on the
// bar, and only failing that, prevId itself.
//
// The record has to be on the bar AND to the right of the shared neighbour to
// count. A leftover from an arrangement the bar no longer has must not drag
// the widget somewhere else; being to the right of prevId is the cheap check
// that it still describes the same stretch of bar.
//
// prevIndex is -1 both when prevId is empty (X was first in its section) and
// when prevId is itself still hidden. Either way it reads as "the start of the
// section", which is the right floor: a sibling that is back on the bar is
// still to X's left, and following it is still better than an index. That case
// is not exotic -- it is what hiding a whole section and restoring it is made
// of, where every record ends up with index 0 and no neighbours at all.
// The walk repeats, because a chain of hides leaves a chain of records: hide
// bluetooth, then audio, then network, and audio names network as its prevId
// while network names agents. Stepping once from agents to network and
// stopping would put monitor ahead of audio. Each step moves the anchor one
// widget right and looks again, until nothing else claims the new anchor.
function siblingAnchor(saved, entries, savedHidden) {
  var list = Array.isArray(savedHidden) ? savedHidden : []
  var key = String(saved.id || "")
  var section = String(saved.section || "")
  var anchor = String(saved.prevId || "")
  var floor = indexOfId(entries, anchor)

  for (var step = 0; step <= list.length; step++) {
    var found = ""
    for (var i = 0; i < list.length; i++) {
      var record = list[i]
      if (!isPlainObject(record)) continue
      if (String(record.id || "") === key) break // past here they were hidden AFTER X
      if (String(record.section || "") !== section) continue
      if (String(record.prevId || "") !== anchor) continue
      // Same prevId and hidden earlier means it sat between that neighbour and
      // X; the LAST such record is the rightmost of them, so it is the one X
      // has to follow. It must also still be on the bar and to the right of
      // where we are, or it is a leftover from an arrangement this bar no
      // longer has and following it would move the widget somewhere else.
      if (indexOfId(entries, record.id) > floor) found = String(record.id)
    }
    if (!found) break
    anchor = found
    floor = indexOfId(entries, anchor)
  }

  return indexOfId(entries, anchor) === -1 ? "" : anchor
}

// The mirror of the same problem on the right-hand side, used when X's own
// left neighbour is still hidden: follow nextId through the records that are
// also still hidden until one of them is on the bar. `--before` that widget
// puts X ahead of everything that was to its right, which is the correct slot
// however many of its neighbours are gone.
function chainedNextId(saved, entries, savedHidden) {
  var list = Array.isArray(savedHidden) ? savedHidden : []
  var id = String(saved.nextId || "")
  var seen = {}
  while (id && !seen[id]) {
    if (indexOfId(entries, id) !== -1) return id
    seen[id] = true
    var next = ""
    for (var i = 0; i < list.length; i++) {
      var record = list[i]
      if (isPlainObject(record) && String(record.id || "") === id) {
        next = String(record.nextId || "")
        break
      }
    }
    id = next
  }
  return ""
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
// host, because a placement the host cannot resolve is a hard CLI failure —
// `omarchy-plugin-enable: could not find target widget X`, exit 1 — and the
// widget then stays off the bar. `shellConfig` must therefore be the live
// on-disk layout, not a snapshot somebody handed us earlier. Fall back in
// this order:
//   1. --after  the sibling anchor, else prevId (the widget to its left)
//   2. --before the chained nextId            (the widget to its right)
//   3. --index                                (clamped, as the host clamps it)
// Both neighbours gone means everything around it was hidden too, and the
// index is then as good an answer as exists.
//
// Called with no shellConfig it emits the plain --section/--index form.
function showArgv(saved, shellConfig, savedHidden) {
  if (!isPlainObject(saved) || !String(saved.id || "")) return null
  var section = REGIONS.indexOf(saved.section) !== -1 ? saved.section : "center"
  var argv = ["omarchy-plugin-enable", String(saved.id), "--section", section]
  var entries = shellConfig === undefined || shellConfig === null
    ? null : sectionEntries(shellConfig, section)

  if (entries) {
    var after = siblingAnchor(saved, entries, savedHidden)
    if (!after && saved.prevId && indexOfId(entries, saved.prevId) !== -1)
      after = String(saved.prevId)
    if (after) return argv.concat(["--after", after])

    var before = chainedNextId(saved, entries, savedHidden)
    if (before) return argv.concat(["--before", before])
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
    // An empty array cannot be restored and does not need to be. `omarchy-bar
    // set <id> <key> [] --json` fails with "Too few arguments provided (4
    // required but 3 were provided)" because the shell IPC drops the empty
    // argument, so emitting it only logs a WARN and loses the key anyway. An
    // absent key and an empty array mean the same thing to every widget that
    // reads one, so skipping it restores the same state, quietly.
    if (Array.isArray(value) && value.length === 0) continue
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
function showSequence(saved, shellConfig, savedHidden) {
  var placement = showArgv(saved, shellConfig, savedHidden)
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
