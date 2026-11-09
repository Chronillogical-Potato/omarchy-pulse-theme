# Contributing

Two kinds of community contributions: **sources** (scripts that turn a service into a panel, below) and **scenes**
(worlds for the wallpaper, made in the scene editor: [Community scenes](#community-scenes)). One per pull request.
The maintainer reviews them with [docs/REVIEWING.md](docs/REVIEWING.md).

## Community sources

Community sources run on other people's PCs. Treat every script as code you would install on your own machine.

### How to add a source

1. Open one PR per source.
2. Add `community/<name>/` with exactly these three files:
   - `pulse-<name>` — executable bash or python3 script that prints [Pulse output](docs/GUIDE.md#5-what-a-source-can-print) (a number, text, or JSON `items` / `rows` / `value`)
   - `source.toml` — a `[[source]]` block to paste into `~/.config/omarchy-pulse/pulse.toml`
   - `README.md` — what it shows, packages/tokens/permissions, install steps (same wording as the other READMEs), optional screenshot with no personal data
3. License: MIT, same as the rest of this repository.

### Security rules

- **No `curl | sh`**, no download-and-execute of remote code, **no `sudo`**.
- Contact **only** the service declared in the README. **No telemetry**, no extra hosts.
- **No secrets in the files.** Tokens and passwords come from `source.toml` or environment variables, never hard-coded in the script.
- **Read-only.** A source shows data; it must not create, change or delete anything on the service.
- Output must match the Pulse formats in [docs/GUIDE.md §5](docs/GUIDE.md#5-what-a-source-can-print). Use reasonable timeouts. No personal data in examples or screenshots.
- One source per PR.

### Install wording (copy into every README)

```bash
cp community/<name>/pulse-<name> ~/.config/omarchy-pulse/sources/
chmod +x ~/.config/omarchy-pulse/sources/pulse-<name>
```

Then paste `source.toml` into `~/.config/omarchy-pulse/pulse.toml` (tokens and addresses go there or in environment variables, never inside the script).

### Checks

The `community-sources` GitHub Action on every PR verifies the three files, executable bit, `bash -n` / Python AST parse, and valid TOML. Run the same locally before you open the PR.

## Community scenes

A scene runs in Pulse's sandbox on other people's PCs, so it can be shared freely; it still has to be yours to share.

1. Make it in the scene editor (`omarchy-pulse scene editor`), then **Export .pulse** with your name and a licence
   (MIT, CC0-1.0, CC-BY-4.0 or CC-BY-SA-4.0).
2. Add `community/scenes/<name>/<name>.pulse` and, if you want, a `README.md` (what each shape means, which panel it
   follows).
3. Run `python3 tools/scene-index.py`: it checks the scene with Pulse's own rules, writes `preview.webp` and updates
   `index.json`. Commit all of it.
4. Open a pull request with one scene; tick the checklist in the template.

Rules: only your own pictures and art (or ones whose licence allows it), no logos or characters of others, no
personal data in the preview; it must make sense with no data, with privacy on and with motion reduced; light enough
(the editor shows ✓ under 8 ms); Pulse's effects used sparingly. A scene folder holds the package, the preview and
the README, nothing else. The `community-scenes` check runs the same tool and the tests on every pull request.
Everything about the format: [docs/PACKAGES.md](docs/PACKAGES.md).
