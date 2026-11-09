#!/usr/bin/env python3
"""Omarchy Pulse 1.7: the Community scenes, checked and indexed.

    tools/scene-index.py            check every scene in community/scenes and write index.json (+ preview pictures)
    tools/scene-index.py --check    only check, and fail if index.json is not up to date (what CI runs)

A scene in the gallery is a folder community/scenes/NAME/ with:
    NAME.pulse     the package, exported from the editor (Export .pulse) or with `omarchy-pulse scene export NAME`
    preview.webp   made from the package's preview by this tool (or preview.png / preview.jpg)
    README.md      optional: what it shows, which data it follows
Nothing else: no scripts, no commands. The checks are Pulse's own (the same ones as importing a .pulse file).
"""
import hashlib
import importlib.machinery
import importlib.util
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / "community" / "scenes"
INDEX = SCENES / "index.json"
ALLOWED = {"README.md", "preview.webp", "preview.png", "preview.jpg"}
FOLDER_MAX = 7 * 1024 * 1024


def hub():
    path = ROOT / "extras/pulse/omarchy-pulse"
    loader = importlib.machinery.SourceFileLoader("pulse_hub", str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


def check_folder(P, d: Path) -> tuple[list, dict | None, bytes | None]:
    """([problems], index entry or None, preview bytes or None)."""
    bad, name = [], d.name
    if not P.SCENE_NAME.match(name):
        return [f"{name}: a folder name is a-z, 0-9 and - (up to 32)"], None, None
    if name in P.BUILTIN_SCENES or (P.WEB / "scenes" / f"{name}.js").exists():
        bad.append(f"{name}: that name belongs to a scene that comes with Pulse")
    pf = d / f"{name}.pulse"
    if not pf.is_file():
        return bad + [f"{name}: no {name}.pulse in it"], None, None
    for f in d.rglob("*"):
        rel = f.relative_to(d).as_posix()
        if f.is_symlink():
            bad.append(f"{name}: no links ({rel})")
        elif f.is_dir():
            bad.append(f"{name}: no folders inside ({rel})")
        elif rel != f"{name}.pulse" and rel not in ALLOWED:
            bad.append(f"{name}: not allowed in a scene folder: {rel} (only {name}.pulse, preview.webp and README.md)")
    if sum(f.stat().st_size for f in d.rglob("*") if f.is_file()) > FOLDER_MAX:
        bad.append(f"{name}: the folder is bigger than {FOLDER_MAX // (1024 * 1024)} MB")
    try:
        raw = pf.read_bytes()
        pkg = json.loads(raw)
    except (OSError, ValueError) as e:
        return bad + [f"{name}: {name}.pulse is not JSON ({e})"], None, None
    checks, clean = P.package_check(pkg)
    for lv, msg in checks:
        if lv == "crit":
            bad.append(f"{name}: {msg}")
    if clean and clean["name"] != name:
        bad.append(f"{name}: the package is called {clean['name']!r}: the folder and the package need the same name")
    if not clean:
        return bad, None, None
    if not clean.get("preview"):
        bad.append(f"{name}: a preview picture (Export .pulse in the editor makes one)")
    prev = None
    m = re.match(r"^data:image/(webp|png|jpeg);base64,(.+)$", clean.get("preview") or "")
    ext = None
    if m:
        ext = {"webp": "webp", "png": "png", "jpeg": "jpg"}[m.group(1)]
        prev = base64.b64decode(m.group(2))
    entry = {"name": name, "title": clean["title"], "author": clean["author"], "license": clean["license"],
             "description": clean["description"], "tags": clean["tags"], "kind": clean["kind"], "pulse": clean["pulse"],
             "created": clean["created"], "size": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
             "preview": f"{name}/preview.{ext}" if ext else None,
             "actions": len((clean.get("design") or {}).get("actions") or []),
             "pictures": len((clean.get("design") or {}).get("assets") or {})}
    for lv, msg in checks:
        if lv == "warn":
            print(f"  ! {name}: {msg}")
    return bad, entry, prev


def build(only_check: bool) -> int:
    P = hub()
    problems, entries, previews = [], [], {}
    if SCENES.is_dir():
        for d in sorted(x for x in SCENES.iterdir() if x.is_dir() and not x.name.startswith(".")):
            bad, entry, prev = check_folder(P, d)
            problems += bad
            if entry:
                entries.append(entry)
                if prev:
                    previews[d / Path(entry["preview"]).name] = prev
            print(("✗ " if bad else "✓ ") + d.name)
    index = {"format": "omarchy-pulse-gallery", "v": 1, "scenes": entries}
    text = json.dumps(index, indent=1, ensure_ascii=False) + "\n"
    if only_check:
        if not INDEX.exists() or INDEX.read_text(encoding="utf-8") != text:
            problems.append("index.json is not up to date: run tools/scene-index.py and commit it")
        for f, b in previews.items():
            if not f.exists() or f.read_bytes() != b:
                problems.append(f"{f.parent.name}: {f.name} is not the package's preview: run tools/scene-index.py")
    else:
        SCENES.mkdir(parents=True, exist_ok=True)
        INDEX.write_text(text, encoding="utf-8")
        for f, b in previews.items():
            f.write_bytes(b)
        print(f"index.json: {len(entries)} scene(s)")
    for p in problems:
        print("✗ " + p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(build("--check" in sys.argv[1:]))
