# Marketplace submission

Submit at **https://github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml**

The form is short. Only four things go in it, and one of them has a hard limit.

## Repository URL

```
https://github.com/felipecpaiva/OmaBarConfigurator
```

**Prerequisite: the repo does not exist yet.** It is local-only. Create and push it before submitting,
or the form will point at a 404:

```bash
cd ~/Work/OmaBarConfigurator
gh repo create felipecpaiva/OmaBarConfigurator --public --source=. --push
```

## Category

**Appearance**

The nine options are Appearance, Desktop, Developer Tools, Hardware, Kids, Productivity, System,
Widgets, Other. `Widgets` is the near-miss: it reads as "this plugin *is* a widget", and this one is
a panel that configures other widgets. What the user changes is how their bar looks, so Appearance.

## Tags — pick exactly three

**`Bar`**, **`Quickshell`**, **`System`**

The form's own words: *"Select one to three reusable tags. Submissions with more than three are
rejected."* So three is the ceiling, not a target to exceed.

`Bar` is the subject. `Quickshell` is what it is built on. `System` covers the settings-panel role.
`Hyprland` was the other candidate and was dropped: every Omarchy plugin runs on Hyprland, so it
does not narrow anything for someone browsing.

## Maintainer notes

> Panel-only plugin — `kinds: ["panel"]`, no bar widget. It installs a desktop entry and opens from
> Super+Space → Apps, so it never takes a slot on the bar it configures.
>
> It does not write `shell.json` itself. Every change shells out to `omarchy plugin enable/disable`
> and `omarchy bar`, so the layout stays whatever Omarchy's own tooling produces.
>
> Two behaviours worth knowing before review:
>
> - Hiding a widget records its slot **and its inline settings**, because `plugin disable` splices
>   the whole entry and nothing else keeps a copy. Restoring replays both.
> - Hiding a clone takes two commands. `restoreCloneSource` rewrites the clone's slot to the source
>   id in place rather than removing it, so disabling only the clone leaves the source sitting there.
>
> Known limits, stated up front: the panel refuses to hide the widget named by `bar.centerAnchor`,
> because nothing in `bin/` can write that key and unpinning it silently slides the whole centre
> section. Rows show "Not drawing" when a widget is on the bar but painting nothing — a
> soft-blocked bluetooth radio leaves BlueZ with no adapter, and `visible: adapter !== null` means
> the widget renders nothing whether or not it is in the layout.

---

## Screenshots

Both are in `docs/shots/`, cropped to the subject with no desktop, terminal or personal content.

| File | What it shows |
|---|---|
| `01-bar-before-after.png` | the right end of the bar, before and after hiding four widgets |
| `02-panel-hidden.png` | the panel itself, four widgets toggled off, one row marked `Pinned` and two marked `Not drawing` |

The form does not ask for images and states no size or format rules. Add them to the issue body by
dragging them in, or put them in the README so the listing links to something visual.

## Manifest check

All eight required fields are present and validated (`omarchy plugin validate` exits 0):

| Field | Value |
|---|---|
| `schemaVersion` | `1` |
| `id` | `felipe.bar-configurator` |
| `name` | `Bar Configurator` |
| `version` | `0.1.0` |
| `author` | `felipecpaiva` |
| `description` | Show, hide and reorder Omarchy bar widgets from one panel. Launches from the Applications list, and never takes a slot on the bar itself. |
| `kinds` | `["panel"]` |
| `entryPoints` | `{"panel": "Panel.qml"}` |

One line from the publish page worth reading before submitting, verbatim: *"The marketplace
validates listings, not plugin security. Plugins run unsandboxed."*


---

## Submission checklist — how each one is covered

The form makes all five required. None is a formality; here is what backs each.

**The repository is public and contains installation and removal instructions.**
Public at `github.com/felipecpaiva/OmaBarConfigurator`. README has an `## Install`
section and a separate `## Removal` section, each with the command and a table of
every path touched.

**I have documented the plugin license and any external dependencies.**
`LICENSE` is MIT. README `## License and credits` states it and records that
Omarchy's `qs.Ui` / `qs.Commons` components are **imported at runtime, not
vendored** — no Omarchy source is copied into the repo. README
`## Requirements and dependencies` lists the only external command, `jq`, which
Omarchy's own plugin CLI already requires. No bundled libraries, no network
access, no build step.

**I confirm that I own or have permission to submit this plugin and its preview assets.**
All code is original. The two screenshots in `docs/shots/` were taken on the
author's own machine and cropped to the panel and the bar — no desktop, terminal
or third-party content in frame.

**The plugin does not overwrite user configuration without explicit consent.**
The strongest of the five, and worth reading in full rather than ticking:

- `install.sh` writes three paths, all listed in the README. An existing desktop
  entry that this plugin did not write is moved to a timestamped `.bak` rather
  than overwritten, and `uninstall.sh` only deletes one carrying
  `X-OmaBarConfigurator-Managed=true`.
- The plugin **never writes `shell.json` itself**. Every change shells out to
  `omarchy plugin enable/disable` and `omarchy bar`, so the file is only ever
  written by Omarchy's own tooling.
- Changing the bar is the user's own click, one widget at a time. There is no
  bulk action that runs unprompted, and no reset-to-defaults button — that was
  considered for the header and rejected, because `omarchy bar defaults` wipes
  the whole layout and should not sit one unconfirmed click away.
- Hiding a widget stores its slot **and its inline settings** so restoring
  returns them. Nothing is silently discarded.
- The panel refuses to hide the widget named by `bar.centerAnchor`, because
  nothing in Omarchy's `bin/` can rewrite that key and unpinning it slides the
  whole centre section.

**I understand that approval is for listing and is not a security review.**
Understood. The publish page states it plainly: *"The marketplace validates
listings, not plugin security. Plugins run unsandboxed."* This plugin runs
unsandboxed like any other, shells out to Omarchy's CLI, and reads and writes
only the three paths named above.
