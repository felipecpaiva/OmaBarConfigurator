#!/usr/bin/env python3
"""Record OmaBar demo GIFs without touching the keyboard or mouse.

Each scene opens the OmaBar panel on a topic (IPC), then changes the store and the bar layout with the same
commands the panel runs, while grim captures the top of the screen. The bar and the panel both show the change.
shell.json and the OmaBar store are backed up first and put back after every scene.

Usage: python3 branding/tools/demo.py <scene> [<scene> ...]    scenes: see SCENES at the bottom.
Do not touch the keyboard or mouse while it runs. Needs grim, ffmpeg, Hyprland, the OmaBar plugin installed."""
import glob, json, os, shutil, subprocess, sys, tempfile, threading, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gifkit

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "branding", "demo")
HOME = os.path.expanduser("~")
STORE = os.path.join(HOME, ".config/omarchy/oma-bar-configurator.json")
SHELL = os.path.join(HOME, ".config/omarchy/shell.json")
PLUGIN = "io.github.felipecpaiva.omabarconfigurator"
# Logical pixels (the screen is scaled): the bar plus the panel card under its middle.
# Logical pixels: the whole bar and the panel card under its middle. Frames come out at 2x.
REGION = "0,0 1280x600"
# Physical pixels inside a frame: the panel area, and the default bar strip shown zoomed above it.
# Narrow enough to leave out notification cards, which stack on the right.
PANEL_CROP = (760, 0, 1040, 1200)
STRIP = (440, 1680)  # x and width of the bar strip: the pills from end to end on this bar
OUT_W = 1100


def env():
    e = dict(os.environ)
    sigs = sorted(glob.glob("/run/user/1000/hypr/*/"), key=os.path.getmtime)
    if sigs: e["HYPRLAND_INSTANCE_SIGNATURE"] = os.path.basename(sigs[-1].rstrip("/"))
    return e


def run(*cmd):
    return subprocess.run(list(cmd), capture_output=True, text=True, env=env())


def panel_open():
    return PLUGIN.split(".")[-1] in run("hyprctl", "layers").stdout


def open_panel(topic):
    if panel_open(): run("omarchy-shell", "shell", "toggle", PLUGIN)
    time.sleep(0.4)
    run("omarchy-shell", "shell", "toggle", PLUGIN, json.dumps({"topic": topic}))
    time.sleep(0.8)
    if not panel_open():
        run("omarchy-shell", "shell", "toggle", PLUGIN, json.dumps({"topic": topic}))
        time.sleep(0.8)


def close_panel():
    if panel_open(): run("omarchy-shell", "shell", "toggle", PLUGIN)


def store():
    return json.load(open(STORE))


def write_store(d):
    tmp = STORE + ".tmp"
    open(tmp, "w").write(json.dumps(d, indent=2) + "\n")
    os.replace(tmp, STORE)


def patch(section, **kw):
    d = store()
    d.setdefault(section, {}).update(kw)
    write_store(d)


def bar(*args):
    r = run("omarchy-bar", *args)
    if r.returncode: print("bar", args, r.stderr.strip())


class Recorder:
    """grim in a loop; frames carry their own time so slow captures keep real timing."""
    def __init__(self, region=None):
        self.region = region or REGION
        self.dir = tempfile.mkdtemp(prefix="omabar-frames-")
        self.frames, self.marks, self.stop, self.t0 = [], [], False, None

    def start(self):
        self.t0 = time.time()
        def loop():
            k = 0
            while not self.stop:
                p = os.path.join(self.dir, f"f{k:05d}.jpg")
                t = time.time() - self.t0
                run("grim", "-g", self.region, "-t", "jpeg", "-q", "88", p)
                if os.path.exists(p): self.frames.append((t, p)); k += 1
        self.th = threading.Thread(target=loop); self.th.start()

    def mark(self, caption):
        self.marks.append((time.time() - self.t0, caption))

    def finish(self, name, strip=None, compose=None, width=None, panel=None):
        """The bar strip (zoomed, physical pixels) over the panel, both scaled to OUT_W."""
        self.stop = True; self.th.join()
        total = time.time() - self.t0
        sx, sw = strip or STRIP
        px, py, pw, ph = panel or PANEL_CROP
        compose = compose or (f"split[s][m];[s]crop={sw}:48:{sx}:0,scale={OUT_W}:-1:flags=lanczos,pad=iw:ih+16:0:8:color=#16181d[s2];"
                   f"[m]crop={pw}:{ph}:{px}:{py},scale={OUT_W}:-1:flags=lanczos[m2];[s2][m2]vstack")
        w = width or OUT_W
        gifkit.build(self.frames, total, self.marks, OUT, name, width=w, mp4_width=w, fontsize=30, compose=compose)
        print("wrote", os.path.join(OUT, name + ".gif"), f"{len(self.frames)} frames in {total:.1f} s")


def focus(ws):
    # Omarchy's Hyprland takes Lua dispatches.
    run("hyprctl", "dispatch", 'hl.dsp.focus({ workspace = "%s" })' % ws)


def indicator_items():
    for sec in json.load(open(SHELL))["bar"]["layout"].values():
        for e in sec:
            if isinstance(e, dict) and e.get("id") == "omarchy.indicators": return e.get("items")
    return None


def scene(fn):
    """Run on an empty workspace (nothing private behind the panel), then put everything back.
    The OmaBar store is ours, so it is restored as a file. Bar settings go back through the CLI:
    the shell keeps its own copy of shell.json and would write a file restore back over."""
    def wrapped():
        bak = tempfile.mkdtemp(prefix="omabar-demo-bak-")
        shutil.copy(STORE, bak)
        items = indicator_items()
        ws = json.loads(run("hyprctl", "activeworkspace", "-j").stdout or "{}").get("id", 1)
        # Do not disturb while recording, so no new notification lands in a frame.
        dnd = run("omarchy-shell", "notifications", "isDnd").stdout.strip()
        run("omarchy-shell", "notifications", "setDnd", "on")
        focus("8")
        time.sleep(0.6)
        try:
            fn()
        finally:
            close_panel()
            shutil.copy(os.path.join(bak, os.path.basename(STORE)), STORE + ".tmp"); os.replace(STORE + ".tmp", STORE)
            if indicator_items() != items and items is not None:
                bar("set", "omarchy.indicators", "items", json.dumps(items), "--json")
            focus(str(ws))
            run("omarchy-shell", "notifications", "setDnd", dnd if dnd in ("on", "off") else "off")
            print("restored from", bak)
    return wrapped


def beat(rec, caption, seconds, action=None):
    # The caption goes up first, so it names the change while it happens (a theme takes a moment).
    rec.mark(caption)
    t = time.time()
    if action: action()
    time.sleep(max(0.4, seconds - (time.time() - t)))


@scene
def pills():
    patch("style", enabled=False)
    open_panel("pills")
    rec = Recorder(); rec.start(); time.sleep(0.6)
    beat(rec, "Pills off: the stock bar", 2.0)
    beat(rec, "Show pills", 2.2, lambda: patch("style", enabled=True))
    beat(rec, "Square corners", 2.0, lambda: patch("style", radius=4))
    beat(rec, "Round again", 1.6, lambda: patch("style", radius=999))
    beat(rec, "Accent fill", 2.2, lambda: patch("style", color="accent", fillOpacity=0.35))
    beat(rec, "Back to the theme background", 1.8, lambda: patch("style", color="background", fillOpacity=0.85))
    beat(rec, "Docked at the screen edge", 2.4, lambda: patch("style", squareEdges=True))
    rec.finish("pills")


@scene
def groups():
    d = store(); g = d.setdefault("groups", {}); g.update(breaks={"left": [], "center": [], "right": []}, solo=[], noPill=[])
    write_store(d)
    open_panel("groups")
    rec = Recorder(); rec.start(); time.sleep(0.6)
    beat(rec, "One pill per section", 2.0)
    beat(rec, "Click a seam: split", 2.2, lambda: patch("groups", breaks={"left": [], "center": ["omarchy.indicators"], "right": []}))
    beat(rec, "Split again", 2.2, lambda: patch("groups", breaks={"left": [], "center": ["omarchy.indicators", "omarchy.agents"], "right": []}))
    beat(rec, "Own: a pill of its own", 2.4, lambda: patch("groups", solo=["google-calendar.clock"]))
    beat(rec, "None: no pill behind it", 2.4, lambda: patch("groups", solo=[], noPill=["tornikegomareli.spaces"]))
    beat(rec, "Join everything back", 2.0, lambda: patch("groups", noPill=[], breaks={"left": [], "center": [], "right": []}))
    rec.finish("groups")


@scene
def themes():
    open_panel("pills")
    cur = run("omarchy", "theme", "current").stdout.strip()
    rec = Recorder(); rec.start(); time.sleep(0.6)
    beat(rec, "Pills follow the theme: " + cur, 1.8)
    for name in [n for n in ["Catppuccin Latte", "Gruvbox", "Rose Pine", "Tokyo Night"] if n != cur]:
        beat(rec, "Pills follow the theme: " + name, 2.4, lambda n=name: run("omarchy", "theme", "set", n))
    beat(rec, "", 1.0, lambda: run("omarchy", "theme", "set", cur))
    rec.finish("themes")


@scene
def indicators():
    full = ["PasswordlessSudo", "ScreenRecording", "RemoteSession", "Reminder", "NightLight", "Dnd", "StayAwake"]
    bar("set", "omarchy.indicators", "items", json.dumps(full), "--json")
    open_panel("widgets")
    rec = Recorder(); rec.start(); time.sleep(0.8)
    beat(rec, "Each indicator, one by one", 2.2)
    beat(rec, "Hide Reminder", 2.2, lambda: bar("set", "omarchy.indicators", "items", json.dumps([x for x in full if x != "Reminder"]), "--json"))
    beat(rec, "Hide Night light", 2.2, lambda: bar("set", "omarchy.indicators", "items", json.dumps([x for x in full if x not in ("Reminder", "NightLight")]), "--json"))
    beat(rec, "Hide Do not disturb", 2.4, lambda: bar("set", "omarchy.indicators", "items", json.dumps([x for x in full if x not in ("Reminder", "NightLight", "Dnd")]), "--json"))
    rec.finish("indicators")


TOOLS = os.path.dirname(os.path.abspath(__file__))


def plan(*args):
    return json.loads(subprocess.run(["node", os.path.join(TOOLS, "plan.js"), *args], capture_output=True, text=True).stdout or "{}")


def run_argv(argv):
    for a in argv:
        r = run(*a)
        if r.returncode: print("step failed", a, r.stderr.strip())


def layout_now():
    return json.load(open(SHELL))["bar"]["layout"]


def back_to(layout):
    tmp = tempfile.mktemp(suffix=".json"); json.dump(layout, open(tmp, "w"))
    run_argv(plan("to", tmp).get("argv", []))


def preset(pid):
    p = plan("preset", pid)
    run_argv(p.get("argv", []))
    if p.get("breaks"): patch("groups", breaks=p["breaks"])


@scene
def presets():
    start = layout_now()
    open_panel("presets")
    rec = Recorder(); rec.start(); time.sleep(0.8)
    try:
        beat(rec, "Layout presets", 1.8)
        beat(rec, "Spread: groups at both edges", 3.2, lambda: preset("spread"))
        beat(rec, "Denial: workspaces centered, the rest right", 3.4, lambda: preset("denial"))
        beat(rec, "Grouped: everything beside the clock", 3.4, lambda: preset("grouped"))
        beat(rec, "Undo: back exactly as it was", 3.0, lambda: back_to(start))
        rec.finish("presets")
    finally:
        back_to(start)


@scene
def saved():
    start = layout_now()
    d = store()
    entry = {"id": str(int(time.time() * 1000)), "name": "Layout 1", "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "layout": start, "groups": d.get("groups", {}), "style": d.get("style", {}), "background": json.load(open(SHELL))["bar"].get("background", "")}
    patch_top(saved=[])  # start from an empty list; the wrapper puts the user's own list back
    open_panel("presets")
    rec = Recorder(region="0,0 1280x800"); rec.start(); time.sleep(0.8)
    try:
        beat(rec, "Save the bar as it is now", 2.4, lambda: patch_top(saved=[entry]))
        beat(rec, "Give it a name", 2.2, lambda: patch_top(saved=[dict(entry, name="My daily bar")]))
        beat(rec, "Experiment: another layout", 3.0, lambda: preset("spread"))
        beat(rec, "Experiment: another look", 2.4, lambda: patch("style", radius=4, color="accent", fillOpacity=0.35))
        def apply():
            back_to(entry["layout"])
            d2 = store(); d2["groups"] = entry["groups"]; d2["style"] = entry["style"]; write_store(d2)
        beat(rec, "Apply My daily bar: all of it comes back", 3.4, apply)
        # The saved layouts sit below the presets: show the lower part of the card.
        rec.finish("saved", panel=(760, 640, 1040, 900))
    finally:
        back_to(start)


def patch_top(**kw):
    d = store(); d.update(kw); write_store(d)


def spacer_size():
    for sec in layout_now().values():
        for e in sec:
            if isinstance(e, dict) and e.get("id") == "omarchy.spacer": return e.get("size")
    return None


@scene
def spacer():
    size = spacer_size()
    if size is None: print("no spacer on the bar, skipping"); return
    open_panel("pills")
    rec = Recorder(); rec.start(); time.sleep(0.8)
    try:
        beat(rec, "Where two pills meet, Omarchy leaves no room", 3.0, lambda: bar("set", "omarchy.spacer", "size", "0", "--json"))
        beat(rec, "One Omarchy spacer: real room between pills", 3.4, lambda: bar("set", "omarchy.spacer", "size", "12", "--json"))
        rec.finish("spacer", strip=(1040, 900))
    finally:
        bar("set", "omarchy.spacer", "size", json.dumps(size), "--json")


@scene
def vertical():
    pos = json.load(open(SHELL))["bar"].get("position", "top")
    rec = Recorder(region="0,0 1280x800"); rec.start(); time.sleep(0.6)
    try:
        beat(rec, "Top bar", 2.0)
        beat(rec, "Left: the pills turn with the bar", 3.6, lambda: bar("position", "left"))
        beat(rec, "Square corners at the top and bottom", 2.8, lambda: patch("style", squareEdges=True))
        beat(rec, "Back on top", 2.6, lambda: bar("position", pos))
        # The top left corner of the screen, where both the top bar and the left bar show.
        # Two strips: the top bar, and the left bar turned on its side, so both read the same way.
        rec.finish("vertical", compose="split[a][b];[a]crop=1600:56:0:0[t];[b]crop=56:1600:0:0,transpose=2[l];"
                   "[t]pad=iw:ih+24:0:12:color=#16181d[t2];[l]pad=iw:ih+24:0:12:color=#16181d[l2];[t2][l2]vstack,"
                   "scale=1100:-1:flags=lanczos,pad=iw:ih+120:0:0:color=#16181d")
    finally:
        bar("position", pos)


SCENES = {"pills": pills, "groups": groups, "themes": themes, "indicators": indicators,
          "presets": presets, "saved": saved, "spacer": spacer, "vertical": vertical}

if __name__ == "__main__":
    for s in sys.argv[1:] or list(SCENES):
        SCENES[s]()
