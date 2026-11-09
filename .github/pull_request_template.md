<!-- Thanks! Keep the part that fits your pull request and delete the other one. One source or one scene per PR. -->

## A community source (`community/<name>/`)

- [ ] One source only, with `pulse-<name>`, `source.toml` and `README.md`
- [ ] The script is executable (`chmod +x`)
- [ ] No `curl | sh`, no download-and-execute, no `sudo`
- [ ] Contacts only the service declared in the README (no telemetry)
- [ ] No secrets in the files (tokens and passwords from `source.toml` or environment variables)
- [ ] Read-only: it shows data, it does not change the service
- [ ] Output is a Pulse format (number / text / JSON `items` | `rows` | `value`)
- [ ] Reasonable timeouts; no personal data in examples or screenshots
- [ ] MIT licence, same as the repo
- [ ] How I tested it: …

## A community scene (`community/scenes/<name>/`)

- [ ] One scene only: `<name>.pulse` exported from the editor (**Export .pulse**) or with `omarchy-pulse scene export <name>`
- [ ] I ran `python3 tools/scene-index.py` and committed `index.json` and the preview it wrote
- [ ] Optional `README.md`: what each shape means, which data it follows, which panel it needs (if any)
- [ ] Everything in it is mine, or its licence lets me share it (pictures included); no logos, characters or brands of others
- [ ] The licence in the package is MIT, CC0-1.0, CC-BY-4.0 or CC-BY-SA-4.0, and the author is me
- [ ] It makes sense with no data, with privacy on and with motion reduced (the editor's sliders)
- [ ] It is light enough (the editor says ✓ under 8 ms) and keeps the dashed zones (panels, clock) free
- [ ] Its actions ask for Pulse's effects sparingly (no fireworks every 10 seconds)
- [ ] What it shows: …
