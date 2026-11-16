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
REGION = os.environ.get("OMABAR_DEMO_REGION", "240,0 800x600")


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
    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="omabar-frames-")
        self.frames, self.marks, self.stop, self.t0 = [], [], False, None

    def start(self):
        self.t0 = time.time()
        def loop():
            k = 0
            while not self.stop:
                p = os.path.join(self.dir, f"f{k:05d}.jpg")
                t = time.time() - self.t0
                run("grim", "-g", REGION, "-t", "jpeg", "-q", "88", p)
                if os.path.exists(p): self.frames.append((t, p)); k += 1
        self.th = threading.Thread(target=loop); self.th.start()

    def mark(self, caption):
        self.marks.append((time.time() - self.t0, caption))

    def finish(self, name, width=800):
        self.stop = True; self.th.join()
        total = time.time() - self.t0
        gifkit.build(self.frames, total, self.marks, OUT, name, width=width, fontsize=30)
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


SCENES = {"pills": pills, "groups": groups, "themes": themes, "indicators": indicators}

if __name__ == "__main__":
    for s in sys.argv[1:] or list(SCENES):
        SCENES[s]()
