# Sharing scenes: .pulse files and the Community gallery

New in 1.7. A **.pulse file** is a whole scene in one file: its shapes, its pictures and background, its animations,
its actions, a preview, who made it and under which licence. You make one with **Export .pulse** in the scene editor,
you send it to anyone, they open it with **Import…** (or drop it on the editor) and it is theirs to use and change.

The **Community gallery** is the collection of scenes people shared in this repository (`community/scenes/`). The
editor's **Community** button shows it: a preview of each scene, who made it, and **Install** or **Install & edit**.

- [1. Export a scene](#1-export-a-scene)
- [2. Import one](#2-import-one)
- [3. The Community gallery](#3-the-community-gallery)
- [4. Put your scene in the gallery](#4-put-your-scene-in-the-gallery)
- [5. What is in a .pulse file, and what never is](#5-what-is-in-a-pulse-file-and-what-never-is)
- [6. Licences and credits](#6-licences-and-credits)
- [7. The format](#7-the-format)
- [8. Questions](#8-questions)

---

## 1. Export a scene

**In the editor**: **Export .pulse**. Give it a title, your name or handle, a licence, a few words on what it shows and
some tags, then **Export**. The editor saves the scene, makes a 640×360 preview from the stage (with the demo data,
or your live data if *my live data* is ticked), checks it like Pulse checks every package and downloads `NAME.pulse`.
Your name and licence are remembered for the next time.

**From a terminal**:

```bash
omarchy-pulse scene export my-world --author "Your Name" --license MIT --title "My world" -o my-world.pulse
```

`--description` adds the text, `--preview PICTURE.png` a preview (a PNG, WebP or JPEG: the scene lab exports one);
without `--author` and `--license` the export tells you what is missing. Scenes written in code (`omarchy-pulse scene
new`) can be exported too: the package carries the code, and it runs in the sandbox like any scene.

## 2. Import one

**In the editor**: **Import…**, or drop the `.pulse` file anywhere on the page. You see its preview, its credits and
Pulse's checks, then:

- **Open in the editor** (scenes made in the editor): it is on your stage, to look at, change and **Save** under the
  name you want. Keep the credits if you share it again (section 6).
- **Install**: it goes into `~/.config/omarchy-pulse/scenes/` under the name in *install as*; then `scene = "NAME"` in
  `[pulse]`, or open it and press *Try on wallpaper*. If you already have a scene with that name, Pulse asks before
  replacing it. Names of the scenes that come with Pulse cannot be used.

**From a terminal**:

```bash
omarchy-pulse scene import my-world.pulse [--name other-name] [--force]
```

A package that fails a check is not installed, and the import says why.

## 3. The Community gallery

**Community** in the editor, or `omarchy-pulse scene gallery` in a terminal (`omarchy-pulse scene get NAME` installs
one). The list comes from `community/scenes/index.json` on GitHub and is kept for 30 minutes; nothing else is sent
anywhere. Each package is checked against the index (its size and SHA-256) before it is installed: what you get is
what was reviewed and merged.

- **Install**: into your scenes, ready for `scene = "NAME"`.
- **Install & edit**: installs it and opens it in the editor, to make it yours.

Scenes made in code show *code* on their card: they install the same way and open in the scene lab.

## 4. Put your scene in the gallery

1. **Export .pulse** (section 1), with a licence that lets others use it.
2. In a fork of [piermark/omarchy-pulse-theme](https://github.com/piermark/omarchy-pulse-theme), add a folder
   `community/scenes/NAME/` with `NAME.pulse` (the same name as the scene) and, if you want, a `README.md`: what each
   shape means, which data it follows, which of your panels it needs.
3. Run `python3 tools/scene-index.py`. It checks every scene with Pulse's own rules, writes `preview.webp` from your
   package and updates `index.json`. Commit the three.
4. Open a pull request with **one scene**. The template has a short checklist; the `community-scenes` check runs the
   same tool and the tests.

The maintainer tries it with demo data and with privacy on and motion reduced, looks at its pictures and its actions,
and merges it ([REVIEWING.md](REVIEWING.md) is the list). After the merge it is in everyone's **Community** tab.

A scene folder holds `NAME.pulse`, `preview.webp` (or `.png` / `.jpg`) and `README.md`, nothing else: no scripts, no
links, no other folders. The check fails otherwise.

## 5. What is in a .pulse file, and what never is

**In it**: the design (shapes, how they follow your data, repeats, clicks), its pictures (PNG, JPEG, WebP, SVG, as
data inside the file), the background, its own palette, keyframe animations, actions, or the scene's code if it was
written by hand; a preview; the title, the author, the licence, a description and tags.

**Never in it**: commands, `[[source]]` scripts, `pulse.toml`, tokens, anything that runs on your computer. A package
with any other key is refused. Sources are shared on their own, as reviewed pull requests ([CONTRIBUTING.md](../CONTRIBUTING.md)).

**Why installing one is safe**:

- a scene runs in Pulse's sandbox: no network, no token, no access to your files, the page or Pulse's API, only a
  read-only copy of part of the state ([SCENES.md section 9](SCENES.md#9-safety-what-a-scene-cannot-do));
- a design is plain data that Pulse checks and writes again itself: it can never carry code;
- pictures are checked for what they are (the bytes, not only the name), 2 MB each and 3 MB together; an SVG with
  scripts, events or links out is refused; pictures you import in the editor are redrawn, so their metadata (GPS,
  camera) is not kept;
- actions can only change the scene itself (play an animation, flash, show, hide) and ask Pulse for its own effects
  (fireworks, a banner, a rocket, a chime...): an allowed list, at most one every 4 seconds and the same one every
  15, never while a window covers the desktop, only text with reduced motion;
- what a scene sees of your panels is their numbers and, for lists and tables, the names and states of their rows,
  never their notes or text; private panels and Pulse's own are never in it; flight numbers and names are empty
  while you share the screen.

## 6. Licences and credits

A package needs an author and one of these licences:

| Licence | Others can |
|---|---|
| `MIT` | use, change and share it, keeping your name and the licence |
| `CC0-1.0` | do anything with it, no conditions |
| `CC-BY-4.0` | use, change and share it, crediting you |
| `CC-BY-SA-4.0` | the same, and share what they make from it under the same licence |

Only put in a scene what you made, or what its own licence lets you share: no logos, characters, brands or photos of
others. When you change someone's scene and share it again, keep their name in the description ("from Homelab tower by
Marco Porro") and a licence their licence allows.

When a package is installed, its credits are kept next to the scene (`NAME.meta.json`) and on the first line of
`NAME.js`; exporting it again keeps them.

## 7. The format

A `.pulse` file is JSON:

```json
{
  "format": "omarchy-pulse-scene",
  "v": 1,
  "name": "homelab-tower",
  "title": "Homelab tower",
  "author": "Marco Porro",
  "license": "MIT",
  "description": "A server rack that grows with the power your homelab draws.",
  "tags": ["homelab", "power"],
  "pulse": "1.7.0",
  "created": "2026-11-09",
  "kind": "design",
  "design": { "v": 2, "sky": "none", "city": true, "shapes": [], "assets": {}, "actions": [] },
  "preview": "data:image/webp;base64,..."
}
```

- `kind` is `design` (with `design`, made in the editor) or `js` (with `js`, the scene's code as text);
- `name`: a-z, 0-9 and -, up to 32; `tags`: up to 6, a-z, 0-9 and -;
- the whole file at most 6 MB.

The design (version 2) is described in [SCENES.md section 12](SCENES.md#12-the-scene-editor-16-and-17); pictures are
in `design.assets` as `{ "id": "data:image/...;base64,..." }`.

`community/scenes/index.json`, written by `tools/scene-index.py`, lists the gallery:
`{ "format": "omarchy-pulse-gallery", "v": 1, "scenes": [{ name, title, author, license, description, tags, kind,
pulse, created, size, sha256, preview, actions, pictures }] }`. Set `PULSE_GALLERY` to another address to use a
gallery of your own (a folder with the same layout, served over HTTPS).

## 8. Questions

**"not a Pulse scene package"**: the file is not a `.pulse` file, or it was changed by hand and is not valid JSON.

**"not allowed in a package: ..."**: the file has keys that are not part of the format (commands, sources...). It is
refused on purpose.

**"a licence that lets others use it"** / **"who made it"**: export again with an author and one of the licences in
section 6.

**"an SVG with scripts, events or links out"**: save the SVG again without them (in Inkscape: *Save as → Optimized
SVG*), or as a PNG.

**The gallery is empty or "not reachable now"**: the PC is offline, or GitHub is. A `.pulse` file someone sent you
works without the gallery.

**"it does not match the gallery's index"**: the package changed after the index was made; try again later.
