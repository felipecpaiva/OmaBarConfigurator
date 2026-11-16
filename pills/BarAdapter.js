// BarAdapter.js — the ONLY file that reads private names of the stock Omarchy
// bar (docs/architecture.md section 6). Everything else asks this file.
// Plain functions, no QML imports, so node can test it with a fake item tree
// (test/bar-adapter-test.js). Host lists (children, keys) are not JS arrays:
// index loops only, never Array.isArray or .filter on them.
//
// Fail safe: if a name is missing, locate() returns null after exactly one
// call to warn(), and the painter draws nothing.

// Private names this file relies on. Keep in step with test/adapter-contract.js.
var NAMES = {
  WidgetHost: ["owner", "pool"],
  ModuleSlot: ["widgetKey", "moduleName", "widgetHolder", "region"],
  ModuleList: ["listRows", "keys", "region", "pool"]
}

// Section region -> pill area. The tray drawer list is not on the bar line.
var AREA_OF = { left: "left", centerBegin: "center", center: "center", centerEnd: "center", right: "right" }
var TRAY_REGION = "tray"

function hasAll(item, names) {
  if (!item) return false
  for (var i = 0; i < names.length; i++) if (!(names[i] in item)) return false
  return true
}

function isList(item) { return hasAll(item, NAMES.ModuleList) }

// From any item inside a bar widget up to the bar surface root. Checks the
// slot that holds the widget on the way, so a renamed slot name is caught here.
function surfaceRoot(item, warn) {
  var host = null
  var top = item
  for (var p = item; p; p = p.parent) {
    if (!host && hasAll(p, NAMES.WidgetHost)) host = p
    top = p
  }
  if (!host) { warn("bar widget host not found (" + NAMES.WidgetHost.join(", ") + ")"); return null }
  // A widget between two sections waits in the pool with no slot; nothing to check then.
  if (host.owner && !hasAll(host.owner, NAMES.ModuleSlot)) {
    warn("bar slot lacks one of: " + NAMES.ModuleSlot.join(", "))
    return null
  }
  return top
}

function collectLists(item, out) {
  if (!item) return
  if (isList(item)) { out.push(item); return } // a list's own subtree holds only the tray drawer
  var kids = item.children
  if (!kids) return
  for (var i = 0; i < kids.length; i++) collectLists(kids[i], out)
}

// { left: [lists], center: [lists], right: [lists] }, or null after one warning.
// The horizontal bar has two center sets (the notch one is empty); both are kept.
function findAreas(root, warn) {
  var found = []
  collectLists(root, found)
  var areas = { left: [], center: [], right: [] }
  var count = 0
  var unknown = []
  for (var i = 0; i < found.length; i++) {
    var region = found[i].region
    var area = AREA_OF[region]
    if (area) { areas[area].push(found[i]); count++ }
    else if (region !== TRAY_REGION && unknown.indexOf(String(region)) < 0) unknown.push(String(region))
  }
  // Omarchy may have renamed a region: say so once, the rest still draws.
  if (unknown.length) warn("unknown bar region " + unknown.join(", ") + " (expected " + Object.keys(AREA_OF).concat(TRAY_REGION).join(", ") + ")", true)
  if (!count) { warn("no bar sections found (" + NAMES.ModuleList.join(", ") + ")"); return null }
  return areas
}

function ancestors(item) {
  var out = []
  for (var p = item; p; p = p.parent) out.push(p)
  return out
}

// Where an area's pills live: the parent of its list, or for several lists
// the lowest common ancestor of their parents.
function commonParent(lists) {
  if (!lists.length) return null
  var chain = ancestors(lists[0].parent)
  for (var i = 1; i < lists.length; i++) {
    var mine = ancestors(lists[i].parent)
    chain = chain.filter(function (a) { return mine.indexOf(a) >= 0 }) // plain JS arrays here
  }
  return chain.length ? chain[0] : null
}

// Everything the painter needs, or null after exactly one warning.
function locate(item, warn) {
  var root = surfaceRoot(item, warn)
  if (!root) return null
  var areas = findAreas(root, warn)
  if (!areas) return null
  return {
    areas: areas,
    parents: { left: commonParent(areas.left), center: commonParent(areas.center), right: commonParent(areas.right) }
  }
}

function slotId(slot) { return String(slot.moduleName || "") }

// Visible slots of one list. Reading listRows and children makes a binding
// that calls this re-run when the section gains or loses a widget.
function slotsOf(list, vertical) {
  var out = []
  if (!list || !list.listRows) return out
  var kids = list.children
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i]
    if (k && ("widgetKey" in k) && k.visible && (vertical ? k.height : k.width) > 0) out.push(k)
  }
  return out
}

// Offset of item inside ancestor along the bar axis. Reads every x (or y) on
// the way, so a binding re-runs when any of them moves.
// shortcut: ignores scale and rotation (the bar uses none), switch to mapToItem if it ever does.
function offsetIn(item, ancestor, vertical) {
  var pos = 0
  for (var p = item; p && p !== ancestor; p = p.parent) pos += vertical ? p.y : p.x
  return pos
}

// Slots of one area as fresh JS arrays, all in the coordinate space of the
// area's pill parent: [{ id, start, end }] (center slots also carry part). Input for GroupLayout.pills.
function areaSlots(located, area, vertical) {
  var out = []
  if (!located) return out
  var parent = located.parents[area]
  var lists = located.areas[area]
  if (!parent || !lists) return out
  for (var i = 0; i < lists.length; i++) {
    var slots = slotsOf(lists[i], vertical)
    for (var j = 0; j < slots.length; j++) {
      var start = offsetIn(slots[j], parent, vertical)
      var slot = { id: slotId(slots[j]), start: start, end: start + (vertical ? slots[j].height : slots[j].width) }
      if (area === "center") slot.part = String(lists[i].region) // centerBegin | center | centerEnd, for the centerParts rule
      out.push(slot)
    }
  }
  return out
}

if (typeof module !== "undefined") {
  module.exports = {
    NAMES: NAMES,
    surfaceRoot: surfaceRoot,
    findAreas: findAreas,
    commonParent: commonParent,
    locate: locate,
    slotsOf: slotsOf,
    slotId: slotId,
    offsetIn: offsetIn,
    areaSlots: areaSlots
  }
}
