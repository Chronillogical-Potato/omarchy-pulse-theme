# Reviewing community pull requests

For the maintainer: what to look at before merging a source or a scene. The checks on GitHub catch the format; this
list is for what only a person can judge. One source or one scene per pull request; ask for a split otherwise (the
`community-scenes` check enforces it, except for pull requests opened by the maintainers, such as a release that adds
several scenes).

## Every pull request

- [ ] It changes only its own folder (`community/<name>/` or `community/scenes/<name>/` and `community/scenes/index.json`).
      Anything else (the engine, the workflows, `tools/`, the docs) is reviewed as a change of its own, line by line.
- [ ] The checks are green (`community-sources` or `community-scenes`). A change to `.github/` or `tools/` in a
      community pull request is a reason to stop and ask why.
- [ ] No personal data in files, screenshots or previews (names, addresses, hostnames, IPs, faces, plates).
- [ ] The author can share what they send: no logos, brands, characters or photos of others.

## A source (`community/<name>/`, runs on people's PCs)

- [ ] Read the whole script. It does only what the README says.
- [ ] Network: only the service in the README. No other host, no telemetry, no `curl | sh`, no download-and-run,
      no `eval` of what it receives, no `sudo`.
- [ ] Read-only: no POST/PUT/DELETE that changes the service (Zabbix's opt-in acknowledge is the only exception, and
      it is off by default).
- [ ] Secrets come from `source.toml` or the environment, never written in the script; it never prints them.
- [ ] Timeouts on every request; it fails quietly (an error line) when the service is down.
- [ ] Output is a Pulse format; try it: `./pulse-<name>` with a test service, or read what it would print.
- [ ] The README uses the same install wording as the others and lists what it needs.

## A scene (`community/scenes/<name>/`, runs in the sandbox)

- [ ] `python3 tools/scene-index.py --check` passes (the workflow runs it): the package passes Pulse's checks, the
      folder has only `<name>.pulse`, the preview and `README.md`, the index is up to date.
- [ ] Try it: `omarchy-pulse scene import community/scenes/<name>/<name>.pulse --name review-<name>`, then
      `omarchy-pulse scene editor review-<name>` (or the scene lab for a scene in code):
  - [ ] with demo data, 0 agents, privacy on, motion reduced, rain and no rain: it still makes sense;
  - [ ] the frame time is "✓ light enough" (under 8 ms) and it keeps the dashed zones (panels, clock) clear;
  - [ ] it looks right in two or three Omarchy themes (unless it has its own palette on purpose).
- [ ] Pictures: they are the author's or under a licence that allows it; nothing offensive; an SVG was accepted by
      the checks (no scripts, no links), and is still worth a look in a text editor.
- [ ] Actions: Pulse's effects are used sparingly and mean something (a rocket when CI passes, not fireworks every
      minute); texts are short and not misleading (no fake alerts, nothing that looks like a system message).
- [ ] Click texts and descriptions: no links, no requests to run commands, nothing that asks for data.
- [ ] A scene in code (`kind: js`): read it. It runs in the sandbox, but it should not try to reach the network,
      storage or the parent page (the checks warn about these: a warning is a reason to ask).
- [ ] Credits: the author and licence are right; a scene made from another one names it and keeps a compatible licence.
- [ ] The README (optional) says which panel it follows, if any (`panel:power` needs a panel called `power`).

## After merging

- The gallery reads `community/scenes/index.json` from `main`: the scene is in everyone's **Community** tab within
  30 minutes.
- To take a scene down: remove its folder, run `python3 tools/scene-index.py`, commit. Installed copies stay with the
  people who installed them.
