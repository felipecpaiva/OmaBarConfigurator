Updated the plugin id and display name before listing, since the id is permanent once it lands.

- id: `felipe.bar-configurator` → `io.github.felipecpaiva.omabarconfigurator`
- name: `Bar Configurator` → `OmaBar Configurator`

`felipe.` validated fine, but it is a first name rather than anything globally unique, and
SUBMISSION.md prefers the `io.github.yourname.plugin-name` form. Better to change it now than to
have it fixed to a name that cannot be reused.

Also added a root `preview.png`, so the earlier "no supported root preview detected" note is
resolved and the card will not need the fallback.

Everything else is unchanged: still `kinds: ["panel"]`, still MIT, same three written paths, and it
still never writes `shell.json` itself. Please re-run validation against the current commit.
