// node test/model-test.js
//
// Fixtures copy the real shape of ~/.config/omarchy/shell.json as read on
// 2026-09-08 (google-calendar.clock as the centerAnchor carrying an inline
// `format`, felipe.tray carrying pinned/hidden/alwaysShow).

var assert = require("assert")
var M = require("../Model.js")

function live() {
  return {
    bar: {
      centerAnchor: "google-calendar.clock",
      layout: {
        left: [{ id: "omarchy.menu" }, { id: "omarchy.workspaces" }],
        center: [
          { id: "omarchy.indicators" },
          { id: "omarchy.keyboard-layout" },
          { id: "omarchy.weather" },
          { id: "google-calendar.clock", format: "HH:mm" },
          { id: "omarchy.system-update" }
        ],
        right: [
          { id: "felipe.tray", pinned: [], hidden: [], alwaysShow: true },
          { id: "omarchy.agents" },
          { id: "omarchy.bluetooth" },
          { id: "omarchy.network" },
          { id: "omarchy.audio" },
          { id: "omarchy.monitor" },
          { id: "omarchy.power" },
          { id: "jankeesvw.notification-center" }
        ]
      },
      position: "top",
      transparent: false
    },
    version: 1
  }
}

// Apply what the host does on `plugin disable`: splice the entry out.
function disable(config, id) {
  var sections = ["left", "center", "right"]
  for (var s = 0; s < sections.length; s++) {
    var entries = config.bar.layout[sections[s]]
    for (var i = 0; i < entries.length; i++) {
      if (M.entryId(entries[i]) === id) {
        entries.splice(i, 1)
        return
      }
    }
  }
  throw new Error("disable: " + id + " not in layout")
}

// Apply what the host does on `plugin enable <id> --section s <placement>`:
// insert a BARE `{ id }`, resolving --after/--before against the live layout.
function enable(config, argv) {
  assert.strictEqual(argv[0], "omarchy-plugin-enable")
  var id = argv[1]
  var flags = {}
  for (var i = 2; i < argv.length; i += 2) flags[argv[i]] = argv[i + 1]
  var section = flags["--section"]
  var entries = config.bar.layout[section]
  var index
  if (flags["--after"] !== undefined) {
    index = entries.map(M.entryId).indexOf(flags["--after"])
    assert.notStrictEqual(index, -1, "host could not resolve --after " + flags["--after"])
    index += 1
  } else if (flags["--before"] !== undefined) {
    index = entries.map(M.entryId).indexOf(flags["--before"])
    assert.notStrictEqual(index, -1, "host could not resolve --before " + flags["--before"])
  } else {
    index = Math.min(Number(flags["--index"]), entries.length)
  }
  entries.splice(index, 0, { id: id })
}

// Apply what the host does on `omarchy bar set <id> <key> <value> [--json]`.
function barSet(config, argv) {
  assert.strictEqual(argv[0], "omarchy-bar")
  assert.strictEqual(argv[1], "set")
  var id = argv[2], key = argv[3], raw = argv[4]
  var json = argv.indexOf("--json") === 5
  var sections = ["left", "center", "right"]
  for (var s = 0; s < sections.length; s++) {
    var entries = config.bar.layout[sections[s]]
    for (var i = 0; i < entries.length; i++) {
      if (M.entryId(entries[i]) !== id) continue
      assert.ok(entries[i] && typeof entries[i] === "object",
                "bar set on a bare-string entry would fail in the host")
      entries[i][key] = json ? JSON.parse(raw) : raw
      return
    }
  }
  throw new Error("bar set: could not find widget " + id)
}

function run(config, sequence) {
  sequence.forEach(function(argv) {
    if (argv[0] === "omarchy-plugin-enable") enable(config, argv)
    else if (argv[0] === "omarchy-bar") barSet(config, argv)
    else if (argv[0] === "omarchy-plugin-disable") disable(config, argv[1])
    else throw new Error("unknown command " + argv[0])
  })
}

var tests = []
function test(name, fn) { tests.push([name, fn]) }

// ------------------------------------------------------------------ catalogue

test("barCatalogue rows every layout entry, in region order, marking the anchor", function() {
  var rows = M.barCatalogue(live(), [])
  assert.strictEqual(rows.length, 15)
  assert.deepStrictEqual(rows[0], { id: "omarchy.menu", region: "left", index: 0, visible: true, isAnchor: false })
  assert.deepStrictEqual(rows.map(function(r) { return r.region }).slice(0, 3), ["left", "left", "center"])
  var anchors = rows.filter(function(r) { return r.isAnchor })
  assert.deepStrictEqual(anchors.map(function(r) { return r.id }), ["google-calendar.clock"])
  assert.ok(rows.every(function(r) { return r.visible }))
})

test("barCatalogue appends hidden rows with region null", function() {
  var config = live()
  var saved = M.captureEntry(config, "omarchy.weather")
  disable(config, "omarchy.weather")
  var rows = M.barCatalogue(config, [saved])
  var weather = rows.filter(function(r) { return r.id === "omarchy.weather" })
  assert.strictEqual(weather.length, 1)
  assert.deepStrictEqual(weather[0], { id: "omarchy.weather", region: null, index: null, visible: false, isAnchor: false })
  assert.strictEqual(rows.length, 15)
})

test("a saved id that is back in the layout is reported visible, not twice", function() {
  var saved = M.captureEntry(live(), "omarchy.weather")
  var rows = M.barCatalogue(live(), [saved])
  var weather = rows.filter(function(r) { return r.id === "omarchy.weather" })
  assert.strictEqual(weather.length, 1)
  assert.strictEqual(weather[0].visible, true)
  assert.strictEqual(weather[0].region, "center")
})

test("barCatalogue survives an empty and a malformed config", function() {
  assert.deepStrictEqual(M.barCatalogue({}, []), [])
  assert.deepStrictEqual(M.barCatalogue(null, null), [])
  assert.deepStrictEqual(M.barCatalogue(undefined, undefined), [])
  assert.deepStrictEqual(M.barCatalogue({ bar: { layout: "nonsense" } }, []), [])
  assert.deepStrictEqual(M.barCatalogue({ bar: { layout: { center: [{}, { id: "" }, null, 7] } } }, []), [])
  var rows = M.barCatalogue({ bar: { layout: { center: [{}, "omarchy.clock"] } } }, [])
  assert.deepStrictEqual(rows, [{ id: "omarchy.clock", region: "center", index: 1, visible: true, isAnchor: false }])
  // a section that is a string or a number is not a list of entries; treating
  // a string as one would row every character
  assert.deepStrictEqual(M.barCatalogue({ bar: { layout: { center: "omarchy.clock", left: 5 } } }, []), [])
  assert.deepStrictEqual(M.barCatalogue({ bar: { layout: { center: { 0: "omarchy.clock" } } } }, []), [])
  assert.strictEqual(M.captureEntry({ bar: { layout: { center: "omarchy.clock" } } }, "omarchy.clock"), null)
})

test("only the centre copy of a duplicated id can be the anchor", function() {
  var config = { bar: { centerAnchor: "omarchy.weather",
                        layout: { left: [], center: [{ id: "omarchy.weather" }],
                                  right: [{ id: "omarchy.weather" }] } } }
  var rows = M.barCatalogue(config, [])
  assert.deepStrictEqual(rows.map(function(r) { return [r.region, r.isAnchor] }),
                         [["center", true], ["right", false]])
})

test("barCatalogue accepts the bar subtree as well as the whole config", function() {
  var whole = M.barCatalogue(live(), [])
  var subtree = M.barCatalogue(live().bar, [])
  assert.deepStrictEqual(subtree, whole)
})

// -------------------------------------------------------------- round-tripping

test("hide/show round-trip restores an inline setting (the clock format)", function() {
  var config = live()
  var saved = M.captureEntry(config, "google-calendar.clock")
  assert.deepStrictEqual(saved.entry, { id: "google-calendar.clock", format: "HH:mm" })

  run(config, M.hideSequence("google-calendar.clock", ""))
  assert.strictEqual(M.captureEntry(config, "google-calendar.clock"), null)

  run(config, M.showSequence(saved, config))
  assert.deepStrictEqual(config.bar.layout.center, live().bar.layout.center)
})

test("hide/show round-trip restores non-string inline settings (felipe.tray)", function() {
  var config = live()
  var saved = M.captureEntry(config, "felipe.tray")
  // The clone case: disabling felipe.tray alone rewrites the slot to
  // omarchy.tray instead of removing it, so hideSequence emits two commands.
  var hide = M.hideSequence("felipe.tray", "omarchy.tray")
  assert.deepStrictEqual(hide, [["omarchy-plugin-disable", "felipe.tray"],
                                ["omarchy-plugin-disable", "omarchy.tray"]])

  disable(config, "felipe.tray") // the net effect of both commands
  run(config, M.showSequence(saved, config))
  var restored = config.bar.layout.right[0]
  assert.strictEqual(restored.id, "felipe.tray")
  assert.strictEqual(restored.alwaysShow, true, "must be boolean true, not the string \"true\"")
  // `hidden: []` and `pinned: []` do NOT come back, on purpose. The shell IPC
  // drops an empty argument, so `omarchy-bar set felipe.tray pinned [] --json`
  // fails with "Too few arguments provided" and loses the key anyway. Emitting
  // it only adds a WARN line. Absent and empty read the same to the widget, so
  // the restored state is equivalent. This assertion used to expect the arrays
  // back, and passed only because the fake never simulated the failing command
  // -- the test encoded the bug. A real click on the tray is what exposed it.
  assert.strictEqual("pinned" in restored, false, "an empty array is not restored")
  assert.strictEqual("hidden" in restored, false, "an empty array is not restored")
  assert.deepStrictEqual(Object.keys(restored).sort(), ["alwaysShow", "id"])
})

test("settings are pushed with --json for everything but strings", function() {
  var argv = M.restoreSettingsArgv({
    id: "x.y", section: "right",
    entry: { id: "x.y", s: "str", b: false, n: 3, a: [1], o: { k: 1 } }
  })
  assert.deepStrictEqual(argv, [
    ["omarchy-bar", "set", "x.y", "s", "str", "--section", "right"],
    ["omarchy-bar", "set", "x.y", "b", "false", "--json", "--section", "right"],
    ["omarchy-bar", "set", "x.y", "n", "3", "--json", "--section", "right"],
    ["omarchy-bar", "set", "x.y", "a", "[1]", "--json", "--section", "right"],
    ["omarchy-bar", "set", "x.y", "o", "{\"k\":1}", "--json", "--section", "right"]
  ])
})

test("a captured entry is a copy, not a live reference into shellConfig", function() {
  var config = live()
  var saved = M.captureEntry(config, "google-calendar.clock")
  config.bar.layout.center[3].format = "clobbered"
  assert.strictEqual(saved.entry.format, "HH:mm")
})

test("showSequence puts the enable before every bar set", function() {
  var saved = M.captureEntry(live(), "felipe.tray")
  var seq = M.showSequence(saved, live())
  assert.strictEqual(seq[0][0], "omarchy-plugin-enable")
  // enable + one `bar set` for alwaysShow. `hidden: []` and `pinned: []` are
  // skipped -- see the round-trip test above.
  assert.strictEqual(seq.length, 2)
  assert.ok(seq.slice(1).every(function(a) { return a[0] === "omarchy-bar" }))
})

// ---------------------------------------------------------- index vs neighbour

test("restore lands in the right slot after three other widgets were hidden", function() {
  var config = live()
  var saved = M.captureEntry(config, "google-calendar.clock")
  assert.strictEqual(saved.index, 3)
  assert.strictEqual(saved.prevId, "omarchy.weather")

  disable(config, "google-calendar.clock")
  disable(config, "omarchy.indicators")
  disable(config, "omarchy.keyboard-layout")
  // center is now [weather, system-update]; the stale index 3 would clamp to 2
  // and land the clock AFTER system-update.
  var argv = M.showArgv(saved, config)
  assert.deepStrictEqual(argv, ["omarchy-plugin-enable", "google-calendar.clock",
                                "--section", "center", "--after", "omarchy.weather"])
  run(config, [argv])
  assert.deepStrictEqual(config.bar.layout.center.map(M.entryId),
                         ["omarchy.weather", "google-calendar.clock", "omarchy.system-update"])
})

test("the left neighbour gone falls back to --before the right one", function() {
  var config = live()
  var saved = M.captureEntry(config, "google-calendar.clock")
  disable(config, "google-calendar.clock")
  disable(config, "omarchy.weather")
  var argv = M.showArgv(saved, config)
  assert.deepStrictEqual(argv.slice(4), ["--before", "omarchy.system-update"])
  run(config, [argv])
  assert.deepStrictEqual(config.bar.layout.center.map(M.entryId),
                         ["omarchy.indicators", "omarchy.keyboard-layout",
                          "google-calendar.clock", "omarchy.system-update"])
})

test("both neighbours gone falls back to a clamped index", function() {
  var config = live()
  var saved = M.captureEntry(config, "google-calendar.clock")
  config.bar.layout.center = []
  assert.deepStrictEqual(M.showArgv(saved, config).slice(4), ["--index", "0"])
})

test("the first entry in a section has no left neighbour and restores by --before", function() {
  var config = live()
  var saved = M.captureEntry(config, "omarchy.indicators")
  assert.strictEqual(saved.prevId, "")
  assert.strictEqual(saved.index, 0)
  disable(config, "omarchy.indicators")
  assert.deepStrictEqual(M.showArgv(saved, config).slice(4),
                         ["--before", "omarchy.keyboard-layout"])
  run(config, [M.showArgv(saved, config)])
  assert.strictEqual(M.entryId(config.bar.layout.center[0]), "omarchy.indicators")
})

test("showArgv without a config emits the plain section/index form", function() {
  var saved = M.captureEntry(live(), "google-calendar.clock")
  assert.deepStrictEqual(M.showArgv(saved), ["omarchy-plugin-enable", "google-calendar.clock",
                                             "--section", "center", "--index", "3"])
})

test("showArgv refuses garbage rather than emitting a broken command", function() {
  assert.strictEqual(M.showArgv(null), null)
  assert.strictEqual(M.showArgv({}), null)
  assert.strictEqual(M.showArgv({ id: "" }), null)
  // A saved record with a nonsense section and index still produces a command
  // the CLI will accept.
  assert.deepStrictEqual(M.showArgv({ id: "a.b", section: "middle", index: "x" }),
                         ["omarchy-plugin-enable", "a.b", "--section", "center", "--index", "0"])
  assert.deepStrictEqual(M.showArgv({ id: "a.b", section: "left", index: -5 }).slice(4),
                         ["--index", "0"])
})

// --------------------------------------------------------------- bare strings

test("a bare-string entry is captured, hidden and restored", function() {
  var config = { bar: { centerAnchor: "omarchy.clock",
                        layout: { left: [], center: ["omarchy.weather", "omarchy.clock"], right: [] } } }
  var saved = M.captureEntry(config, "omarchy.weather")
  assert.deepStrictEqual(saved, { id: "omarchy.weather", section: "center", index: 0,
                                  entry: "omarchy.weather", prevId: "", nextId: "omarchy.clock" })
  assert.deepStrictEqual(M.restoreSettingsArgv(saved), [], "a bare string has no inline settings")
  disable(config, "omarchy.weather")
  run(config, M.showSequence(saved, config))
  assert.deepStrictEqual(config.bar.layout.center.map(M.entryId), ["omarchy.weather", "omarchy.clock"])
  assert.strictEqual(M.isCenterAnchor(config, "omarchy.clock"), true)
})

test("captureEntry returns null for an id that is not in the layout", function() {
  assert.strictEqual(M.captureEntry(live(), "omarchy.media"), null)
  assert.strictEqual(M.captureEntry(live(), ""), null)
  assert.strictEqual(M.captureEntry(live(), null), null)
  assert.strictEqual(M.captureEntry({}, "omarchy.clock"), null)
  assert.strictEqual(M.captureEntry(null, "omarchy.clock"), null)
  // in plugins[] but not on the bar is still "not in the layout"
  var config = live()
  config.plugins = [{ id: "bobbynicholas.omaland" }]
  assert.strictEqual(M.captureEntry(config, "bobbynicholas.omaland"), null)
})

// -------------------------------------------------------------- anchor safety

test("isCenterAnchor is true only for the resolved center anchor", function() {
  assert.strictEqual(M.isCenterAnchor(live(), "google-calendar.clock"), true)
  assert.strictEqual(M.isCenterAnchor(live(), "omarchy.weather"), false)
  assert.strictEqual(M.isCenterAnchor(live(), ""), false)
  assert.strictEqual(M.isCenterAnchor({}, ""), false)
  assert.strictEqual(M.isCenterAnchor({ bar: { centerAnchor: "omarchy.clock", layout: {} } }, "omarchy.clock"), false)
})

test("isCenterAnchor follows the host's same-kind fallback for a stale pin", function() {
  // centerAnchor names a clock that is gone; the one surviving clock is the pin.
  var config = { bar: { centerAnchor: "omarchy.clock",
                        layout: { left: [], center: [{ id: "omarchy.weather" }, { id: "dhh.clock" }], right: [] } } }
  assert.strictEqual(M.isCenterAnchor(config, "dhh.clock"), true)
  assert.strictEqual(M.isCenterAnchor(config, "omarchy.clock"), false)
  // two of a kind is ambiguous, so neither wins
  config.bar.layout.center.push({ id: "acme.clock" })
  assert.strictEqual(M.isCenterAnchor(config, "dhh.clock"), false)
  assert.strictEqual(M.isCenterAnchor(config, "acme.clock"), false)
})

test("hiding a non-anchor leaves the pin alone", function() {
  assert.strictEqual(M.nextAnchorAfterHiding(live(), "omarchy.weather"), "google-calendar.clock")
  assert.strictEqual(M.nextAnchorAfterHiding(live(), "omarchy.menu"), "google-calendar.clock")
  assert.strictEqual(M.nextAnchorAfterHiding(live(), "omarchy.power"), "google-calendar.clock")
})

test("hiding the anchor re-points it at a surviving centre widget", function() {
  var config = live()
  var next = M.nextAnchorAfterHiding(config, "google-calendar.clock")
  assert.notStrictEqual(next, "", "a centre section with four survivors must keep a pin")
  assert.notStrictEqual(next, "google-calendar.clock", "must not name the widget being hidden")
  disable(config, "google-calendar.clock")
  assert.notStrictEqual(config.bar.layout.center.map(M.entryId).indexOf(next), -1,
                        "the new pin must be a widget that is still in the centre list")
  assert.strictEqual(next, "omarchy.weather") // survivors[2] of [indicators, keyboard-layout, weather, system-update]
})

test("hiding the anchor hands the pin to a surviving widget of the same kind", function() {
  var config = { bar: { centerAnchor: "google-calendar.clock",
                        layout: { left: [], center: [{ id: "omarchy.weather" },
                                                     { id: "google-calendar.clock" },
                                                     { id: "omarchy.clock" },
                                                     { id: "omarchy.system-update" }], right: [] } } }
  assert.strictEqual(M.nextAnchorAfterHiding(config, "google-calendar.clock"), "omarchy.clock")
})

test("hiding every centre widget turns anchoring off, one hide at a time", function() {
  var config = live()
  var order = ["google-calendar.clock", "omarchy.indicators", "omarchy.keyboard-layout",
               "omarchy.weather", "omarchy.system-update"]
  order.forEach(function(id, step) {
    var next = M.nextAnchorAfterHiding(config, id)
    disable(config, id)
    var survivors = config.bar.layout.center.map(M.entryId)
    if (survivors.length === 0) {
      assert.strictEqual(next, "", "the last centre widget must turn anchoring off")
    } else {
      assert.notStrictEqual(survivors.indexOf(next), -1,
                            "step " + step + ": pin " + next + " is not in " + survivors)
    }
    // whatever the pin is now, the invariant holds for the next hide too
    config.bar.centerAnchor = next
  })
  assert.deepStrictEqual(config.bar.layout.center, [])
  assert.strictEqual(M.nextAnchorAfterHiding(config, "anything"), "")
})

test("nextAnchorAfterHiding never returns a dangling id, over every single hide", function() {
  var base = live()
  var ids = M.barCatalogue(base, []).map(function(r) { return r.id })
  ids.forEach(function(id) {
    var config = live()
    var next = M.nextAnchorAfterHiding(config, id)
    disable(config, id)
    var survivors = config.bar.layout.center.map(M.entryId)
    if (next === "") assert.strictEqual(survivors.length, 0, id + ": unpinned a non-empty centre")
    else assert.notStrictEqual(survivors.indexOf(next), -1, id + ": dangling pin " + next)
  })
})

test("anchoring is off when there is no pin, or the pin names nothing on the bar", function() {
  assert.strictEqual(M.nextAnchorAfterHiding({}, "omarchy.clock"), "")
  assert.strictEqual(M.nextAnchorAfterHiding(live().bar.layout, "omarchy.clock"), "")
  var noPin = live(); delete noPin.bar.centerAnchor
  assert.strictEqual(M.nextAnchorAfterHiding(noPin, "omarchy.weather"), "")
  var stale = live(); stale.bar.centerAnchor = "acme.nothing"
  assert.strictEqual(M.nextAnchorAfterHiding(stale, "omarchy.weather"), "")
})

// ------------------------------------------------------------------- argv misc

test("hideArgv and hideSequence", function() {
  assert.deepStrictEqual(M.hideArgv("omarchy.weather"), ["omarchy-plugin-disable", "omarchy.weather"])
  assert.deepStrictEqual(M.hideSequence("omarchy.weather", ""), [["omarchy-plugin-disable", "omarchy.weather"]])
  assert.deepStrictEqual(M.hideSequence("omarchy.weather", null), [["omarchy-plugin-disable", "omarchy.weather"]])
  // a manifest that claims to be its own clone must not emit a duplicate
  assert.strictEqual(M.hideSequence("a.b", "a.b").length, 1)
})

test("every argv element is a string (execDetached will not marshal numbers)", function() {
  var saved = M.captureEntry(live(), "felipe.tray")
  var all = M.showSequence(saved, live()).concat(M.hideSequence("felipe.tray", "omarchy.tray"))
  all.forEach(function(argv) {
    argv.forEach(function(part) {
      assert.strictEqual(typeof part, "string", JSON.stringify(argv) + " has a non-string part")
    })
  })
})

// ------------------------------------------------- multi-hide / multi-restore

// The panel's own store semantics, so these drive the loop the user drives
// rather than a store written by hand: hideWidget captures from the LIVE
// config and replaces any record with the same id, showWidget KEEPS the record
// (it is what carries the hide order), and every placement is resolved against
// the config as it is by then.
function panel(config) {
  var store = []
  return {
    store: store,
    hide: function(id) {
      var captured = M.captureEntry(config, id)
      assert.ok(captured, "hide: " + id + " is not on the bar")
      for (var i = 0; i < store.length; i++)
        if (store[i].id === id) { store.splice(i, 1); break }
      store.push(captured)
      run(config, M.hideSequence(id, ""))
    },
    show: function(id) {
      var saved = null
      for (var i = 0; i < store.length; i++) if (store[i].id === id) saved = store[i]
      assert.ok(saved, "show: no record for " + id)
      run(config, M.showSequence(saved, config, store))
    }
  }
}

function rightIds(config) { return config.bar.layout.right.map(M.entryId) }

function permutations(list) {
  if (list.length <= 1) return [list.slice()]
  var out = []
  for (var i = 0; i < list.length; i++) {
    var rest = list.slice(0, i).concat(list.slice(i + 1))
    permutations(rest).forEach(function(tail) { out.push([list[i]].concat(tail)) })
  }
  return out
}

// The assertion the old behaviour fails. Hiding B after A means B inherits A's
// old neighbour, and the record must name a widget that is ON THE BAR at that
// instant -- a capture taken from a config that still lists A would write
// prevId: A, and the restore then emits `--after A`, which the host cannot
// resolve.
test("a recorded neighbour is on the bar at the moment of the hide", function() {
  var config = live()
  var p = panel(config)
  p.hide("omarchy.network")
  p.hide("omarchy.audio") // its left-hand neighbour WAS omarchy.network

  var audio = p.store[1]
  assert.strictEqual(audio.id, "omarchy.audio")
  assert.strictEqual(audio.prevId, "omarchy.bluetooth",
                     "prevId must be the surviving neighbour, not the one just hidden")
  assert.strictEqual(audio.nextId, "omarchy.monitor")
  p.store.forEach(function(record) {
    if (record.prevId)
      assert.ok(M.captureEntry(config, record.prevId) || record.prevId === "omarchy.network",
                record.id + " recorded a prevId that was not on the bar: " + record.prevId)
  })
})

test("hide A, hide its neighbour B, restore B then A: byte-identical layout", function() {
  var before = rightIds(live())
  var config = live()
  var p = panel(config)
  p.hide("omarchy.network")
  p.hide("omarchy.audio")
  p.show("omarchy.audio")
  p.show("omarchy.network")
  assert.deepStrictEqual(rightIds(config), before)
})

// Four hidden out of one run, restored in every possible order. The reversal
// bug (all three inheriting the same prevId and stacking `--after` it) shows up
// in 18 of these 24 and in none of the two-widget cases, which is why hiding a
// single widget always looked fine.
test("four hidden widgets restore to the original layout in all 24 orders", function() {
  var hideOrder = ["omarchy.network", "omarchy.audio", "omarchy.monitor", "omarchy.bluetooth"]
  var before = rightIds(live())
  permutations(hideOrder).forEach(function(order) {
    var config = live()
    var p = panel(config)
    hideOrder.forEach(p.hide)
    assert.deepStrictEqual(rightIds(config),
                           ["felipe.tray", "omarchy.agents", "omarchy.power",
                            "jankeesvw.notification-center"])
    order.forEach(p.show)
    assert.deepStrictEqual(rightIds(config), before,
                           "restore order " + order.join(",") + " landed wrong")
  })
})

// Hiding in a different order records a different set of neighbours, so the
// ordering rule has to hold for the hide side too.
test("the restore is exact whatever order the four were hidden in", function() {
  var widgets = ["omarchy.bluetooth", "omarchy.network", "omarchy.audio", "omarchy.monitor"]
  var before = rightIds(live())
  permutations(widgets).forEach(function(hideOrder) {
    var config = live()
    var p = panel(config)
    hideOrder.forEach(p.hide)
    hideOrder.slice().reverse().forEach(p.show)
    assert.deepStrictEqual(rightIds(config), before,
                           "hide order " + hideOrder.join(",") + " landed wrong")
    var config2 = live()
    var p2 = panel(config2)
    hideOrder.forEach(p2.hide)
    widgets.forEach(p2.show) // top-down, the order the panel lists them
    assert.deepStrictEqual(rightIds(config2), before,
                           "hide order " + hideOrder.join(",") + " + top-down restore landed wrong")
  })
})

// The whole section hidden and brought back: every neighbour is gone, so this
// is the case that falls through to --index.
test("hiding an entire section and restoring it comes back in order", function() {
  var before = rightIds(live())
  var config = live()
  var p = panel(config)
  before.forEach(p.hide)
  assert.deepStrictEqual(rightIds(config), [])
  before.forEach(p.show)
  assert.deepStrictEqual(rightIds(config), before)
})

test("showArgv never names a neighbour that is not in the section", function() {
  var config = live()
  var p = panel(config)
  p.hide("omarchy.network")
  p.hide("omarchy.audio")
  p.hide("omarchy.bluetooth")
  var ids = rightIds(config)
  p.store.forEach(function(saved) {
    var argv = M.showArgv(saved, config, p.store)
    var at = argv.indexOf("--after")
    var before = argv.indexOf("--before")
    if (at !== -1) assert.ok(ids.indexOf(argv[at + 1]) !== -1, "--after " + argv[at + 1] + " is not on the bar")
    if (before !== -1) assert.ok(ids.indexOf(argv[before + 1]) !== -1, "--before " + argv[before + 1] + " is not on the bar")
  })
})

// An empty array setting must emit no `bar set` command. The shell IPC drops an
// empty argument, so the command fails with "Too few arguments provided", logs
// a WARN, and loses the key regardless. Absent and empty mean the same thing to
// every widget that reads one. Found by a real click on felipe.tray, which
// carries `hidden: []` and `pinned: []`, after five automated rounds missed it.
//
// This block used to sit BELOW process.exit(), where it could not run and could
// not fail; it referenced two names that do not exist in this file and nothing
// noticed.
test("an empty-array setting emits no bar set command", function() {
  var savedTray = {
    id: "felipe.tray", section: "right", index: 0,
    entry: { id: "felipe.tray", alwaysShow: true, hidden: [], pinned: [] }
  }
  var argvs = M.restoreSettingsArgv(savedTray)
  assert.deepStrictEqual(argvs.map(function(a) { return a[3] }), ["alwaysShow"])
  assert.ok(JSON.stringify(argvs).indexOf("[]") === -1, "no argv carries an empty-array literal")

  var savedPinned = {
    id: "felipe.tray", section: "right", index: 0,
    entry: { id: "felipe.tray", pinned: ["a.desktop"] }
  }
  assert.deepStrictEqual(M.restoreSettingsArgv(savedPinned).map(function(a) { return a[3] }),
                         ["pinned"], "a non-empty array is still restored")
})

// ------------------------------------------------------------------------ run

var failed = 0
tests.forEach(function(pair) {
  try {
    pair[1]()
    console.log("ok   " + pair[0])
  } catch (e) {
    failed++
    console.log("FAIL " + pair[0])
    console.log("       " + (e && e.message ? String(e.message).split("\n").join("\n       ") : e))
  }
})
console.log("\n" + (tests.length - failed) + "/" + tests.length + " passed")
process.exit(failed ? 1 : 0)
