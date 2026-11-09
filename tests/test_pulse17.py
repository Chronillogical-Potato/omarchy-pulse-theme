"""Pulse 1.7 "Creator": pictures, actions, keyframes, packages (.pulse) and the Community gallery."""
import base64
import hashlib
import importlib.machinery
import importlib.util
import json
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_17', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
WEB = path.parent / 'web'

PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * 32).decode()
WEBP = "data:image/webp;base64," + base64.b64encode(b"RIFF\0\0\0\0WEBPVP8 " + b"\0" * 16).decode()


def svg(body):
    return "data:image/svg+xml;base64," + base64.b64encode(('<svg xmlns="http://www.w3.org/2000/svg">' + body + "</svg>").encode()).decode()


def design(**kw):
    d = {"sky": "none", "shapes": [{"id": "t1", "type": "image", "asset": "tower", "x": 0.5, "y": 0.6, "w": 0.1, "h": 0.2,
                                    "bind": [{"prop": "h", "src": "panel:power", "from": 0.1, "to": 0.4}]}],
         "assets": {"tower": PNG}, "actions": [{"id": "a1", "when": {"type": "above", "src": "panel:power", "value": 500}, "do": [{"type": "fx", "fx": "launch"}]}]}
    d.update(kw)
    return d


def package(**kw):
    p = {"format": "omarchy-pulse-scene", "v": 1, "name": "power-tower", "title": "Power tower", "author": "Someone",
         "license": "MIT", "description": "grows with the power", "kind": "design", "design": design(), "preview": WEBP, "tags": ["homelab"]}
    p.update(kw)
    return p


class AssetTests(unittest.TestCase):
    def test_pictures_are_checked_for_what_they_are(self):
        self.assertEqual(pulse.asset_clean(PNG), PNG)
        self.assertEqual(pulse.asset_clean(WEBP), WEBP)
        self.assertTrue(pulse.asset_clean(svg('<circle r="4"/>')))
        for bad in ("https://example.com/x.png", "data:image/gif;base64,R0lGOD", "data:image/png;base64," + base64.b64encode(b"GIF89a").decode(),
                    svg("<script>alert(1)</script>"), svg('<a href="https://evil.example">x</a>'), svg('<rect onload="x()"/>'),
                    svg("<foreignObject/>"), svg('<image href="//evil.example/p.png"/>'), "data:image/png;base64,***"):
            with self.assertRaises(ValueError, msg=bad[:60]):
                pulse.asset_clean(bad)

    def test_a_picture_has_a_size_limit(self):
        big = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * (pulse.ASSET_MAX + 1)).decode()
        with self.assertRaises(ValueError):
            pulse.asset_clean(big)


class DesignV2Tests(unittest.TestCase):
    def test_pictures_background_palette_and_actions_are_kept(self):
        d = pulse.design_clean(design(background={"asset": "tower", "fit": "contain", "dim": 3, "alpha": "x"},
                                      palette={"accent": "#ff0000", "evil": "#000000", "fg": "red"}))
        self.assertEqual(d["v"], 2)
        self.assertEqual(d["assets"], {"tower": PNG})
        self.assertEqual(d["background"], {"asset": "tower", "fit": "contain", "alpha": 1.0, "dim": 1.0, "y": 0.5})
        self.assertEqual(d["palette"], {"accent": "#ff0000"})
        self.assertEqual(len(d["actions"]), 1)

    def test_what_does_not_belong_is_dropped_or_refused(self):
        d = pulse.design_clean(design(background={"asset": "missing"}, actions=[{"when": "x", "do": []}, {"when": {}, "do": [{}]}, 3]))
        self.assertNotIn("background", d)
        self.assertEqual(len(d["actions"]), 1)
        for bad in ({"assets": {"../x": PNG}}, {"assets": {"a": "javascript:1"}}, {"assets": {str(i): PNG for i in range(41)}},
                    {"actions": [{"when": {}, "do": []}] * 41}):
            with self.assertRaises(ValueError):
                pulse.design_clean(design(**bad))

    def test_a_v1_design_still_opens(self):
        d = pulse.design_clean({"sky": "accent", "shapes": [{"type": "rect"}]})
        self.assertEqual((d["assets"], d["actions"]), ({}, []))

    def test_a_scene_with_pictures_fits(self):
        src = pulse.design_scene("power-tower", design())
        self.assertLessEqual(len(src.encode()), pulse.SCENE_MAX)
        self.assertEqual(pulse.design_of(src)["assets"]["tower"], PNG)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.p = mock.patch.object(pulse, "USER_SCENES", self.tmp / "scenes")
        self.p.start()

    def tearDown(self):
        self.p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_a_good_package_passes(self):
        checks, clean = pulse.package_check(package())
        self.assertTrue(clean, checks)
        self.assertEqual(checks[-1][0], "ok")
        self.assertEqual(clean["design"]["assets"]["tower"], PNG)

    def test_commands_and_scripts_have_no_place_in_a_package(self):
        for extra in ({"commands": ["rm -rf ~"]}, {"sources": [{"cmd": "x"}]}, {"script": "x"}, {"pulse.toml": "x"}):
            checks, clean = pulse.package_check(package(**extra))
            self.assertIsNone(clean, extra)
            self.assertTrue(any("not allowed" in m for lv, m in checks if lv == "crit"))

    def test_credits_and_a_licence_are_required(self):
        for bad in ({"author": ""}, {"license": "proprietary"}, {"license": ""}, {"name": "sphere"}, {"name": "../x"}, {"format": "zip"}):
            self.assertIsNone(pulse.package_check(package(**bad))[1], bad)

    def test_a_scene_in_code_is_checked_and_runs_in_the_sandbox(self):
        js = 'PulseScene.register("power-tower", { draw: function (g, t, s) { if (s.ui.motion) fetch("https://x"); } });'
        checks, clean = pulse.package_check(package(kind="js", design=None, js=js))
        self.assertTrue(clean)
        self.assertTrue(any(lv == "warn" and "network" in m for lv, m in checks))
        self.assertTrue(any(lv == "info" for lv, m in checks))

    def test_a_preview_must_be_a_picture(self):
        checks, clean = pulse.package_check(package(preview=svg("<circle/>")))
        self.assertTrue(clean)
        self.assertNotIn("preview", clean)
        self.assertTrue(any(lv == "warn" for lv, m in checks))

    def test_install_export_round_trip(self):
        res = pulse.package_install(package())
        self.assertEqual(res["name"], "power-tower", res)
        f = pulse.USER_SCENES / "power-tower.js"
        self.assertIn("by Someone (MIT)", f.read_text())
        self.assertEqual(pulse.scene_meta("power-tower")["author"], "Someone")
        self.assertEqual(pulse.package_install(package())["error"], "exists")
        self.assertIn("path", pulse.package_install(package(), force=True))
        with mock.patch.object(pulse, "scene_path", lambda n: pulse.USER_SCENES / f"{n}.js"):
            pkg = pulse.package_build("power-tower", {"tags": ["power"]}, WEBP)
        checks, clean = pulse.package_check(pkg)
        self.assertTrue(clean, checks)
        self.assertEqual((clean["author"], clean["license"], clean["kind"], clean["tags"]), ("Someone", "MIT", "design", ["power"]))
        self.assertEqual(clean["design"]["actions"][0]["do"][0]["fx"], "launch")

    def test_install_under_another_name_and_never_over_pulse_scenes(self):
        js = 'PulseScene.register("power-tower", { draw: function (g, t, s) { s.ui.motion; } });'
        res = pulse.package_install(package(kind="js", design=None, js=js), "my-copy")
        self.assertIn('PulseScene.register("my-copy"', (pulse.USER_SCENES / "my-copy.js").read_text())
        self.assertIn("error", pulse.package_install(package(), "pond"))
        self.assertIn("error", pulse.package_install(package(), "sphere"))
        self.assertEqual(res["name"], "my-copy")


class GalleryTests(unittest.TestCase):
    def setUp(self):
        pulse._gallery.update(t=0.0, items=[])

    def test_the_index_is_read_and_kept(self):
        calls = []
        idx = {"scenes": [{"name": "power-tower", "title": "x"}, {"name": "../bad"}, "x"]}
        fetch = lambda u: calls.append(u) or idx   # noqa: E731
        self.assertEqual([x["name"] for x in pulse.gallery_index(fetch)], ["power-tower"])
        pulse.gallery_index(fetch)
        self.assertEqual(len(calls), 1)

    def test_a_package_must_match_the_index(self):
        raw = json.dumps(package()).encode()
        good = [{"name": "power-tower", "sha256": hashlib.sha256(raw).hexdigest()}]
        self.assertEqual(pulse.gallery_package("power-tower", lambda u: raw, good)["name"], "power-tower")
        with self.assertRaises(ValueError):
            pulse.gallery_package("power-tower", lambda u: raw + b" ", good)
        with self.assertRaises(ValueError):
            pulse.gallery_package("other", lambda u: raw, good)


class StateTests(unittest.TestCase):
    def test_panels_give_numbers_only_and_never_private_ones(self):
        h = pulse.Hub.__new__(pulse.Hub)
        h.widgets = {"power": {"id": "power", "type": "stat", "data": {"value": 512.5, "unit": "W", "min": 0, "max": 2000}},
                     "secret": {"id": "secret", "type": "stat", "private": True, "data": {"value": 1}},
                     "news": {"id": "news", "type": "list", "data": {"items": ["a"]}},
                     "text": {"id": "text", "type": "stat", "data": {"value": "hello"}}}
        self.assertEqual(h.scene_panels(), {"power": {"value": 512.5, "unit": "W", "min": 0, "max": 2000}})

    def test_rows_of_a_panel_for_one_copy_each(self):
        h = pulse.Hub.__new__(pulse.Hub)
        h.widgets = {"proxmox": {"id": "proxmox", "type": "status", "data": {"items": [
                         {"title": "vm-web", "level": "ok", "note": "running", "text": "secret note"},
                         {"title": "vm-db", "level": "crit", "value": 3}, {"title": "x", "level": "bogus"}]}},
                     "docker": {"id": "docker", "type": "kv", "data": {"rows": [["immich", "Up 3 days"], ["n8n", "Exited (1)"],
                                                                             ["jelly", "Up 2h (unhealthy)"], ["x", "created"]]}},
                     "notifications": {"id": "notifications", "type": "list", "data": {"items": [{"title": "mail"}]}},
                     "car": {"id": "car", "type": "status", "data": {"items": [{"title": "battery"}]}},
                     "mine": {"id": "mine", "type": "list", "private": True, "data": {"items": [{"title": "a"}]}}}
        p = h.scene_panels()
        self.assertEqual(sorted(p), ["docker", "proxmox"])
        self.assertEqual(p["proxmox"]["rows"], [{"name": "vm-web", "level": "ok", "value": None}, {"name": "vm-db", "level": "crit", "value": 3},
                                                {"name": "x", "level": "", "value": None}])
        self.assertEqual([r["level"] for r in p["docker"]["rows"]], ["ok", "crit", "warn", ""])
        self.assertNotIn("secret", json.dumps(p))
        self.assertEqual({r["name"] for r in h.scene_panels(True)["proxmox"]["rows"]}, {""})

    def test_the_sky_hides_flights_when_private(self):
        h = pulse.Hub.__new__(pulse.Hub)
        h.night = {"sun": {"el": -20}, "moon": {"lit": 0.5}}
        h.sky = {"planes": [{"az": 10, "el": 30, "flight": "AZ123"}], "t": time.time()}
        h.starlink = {"sats": [{"el": 20}, {"el": -5}]}
        h.space = {"iss": {"el": 12}, "kp": 4, "launch": {"net": time.time() + 600}}
        s = h.scene_space(True)
        self.assertEqual((s["sun"], s["moon"], s["planes"], s["starlink"], s["iss"], s["kp"]), (-20, 50, 1, 1, 12, 4))
        self.assertEqual(s["list"][0]["flight"], "")
        self.assertTrue(590 <= s["launchIn"] <= 600)
        self.assertEqual(h.scene_space(False)["list"][0]["flight"], "AZ123")


ENGINE = r"""
const PD = require(process.argv[1]);
const out = {};
const st = (power, extra) => Object.assign({ time: { hour: 10 }, sys: { cpu: 10 }, panels: { power: { value: power, min: 0, max: 1000, unit: "W" } } }, extra || {});
const d = { shapes: [{ id: "t", type: "rect", keys: { start: "action", dur: 1, frames: [{ t: 0 }, { t: 1, dx: 0.1 }] } }],
            actions: [{ id: "a", when: { type: "above", src: "panel:power", value: 500 }, do: [{ type: "fx", fx: "launch", text: "{panel:power}" }, { type: "play", shape: "t" }], cooldown: 10 },
                      { id: "c", when: { type: "event", event: "click", shape: "t" }, do: [{ type: "fx", fx: "fireworks" }] },
                      { id: "e", when: { type: "event", event: "every", secs: 1 }, do: [{ type: "flash", shape: "t" }] },
                      { id: "x", when: { type: "event", event: "hour" }, do: [{ type: "fx", fx: "rm -rf" }] }] };
const mem = { hits: [] };
out.start = PD.react(d, st(100), mem, 0);
out.rise = PD.react(d, st(600), mem, 1);
out.stay = PD.react(d, st(700), mem, 2);
PD.react(d, st(100), mem, 3);
out.cool = PD.react(d, st(900), mem, 4);
PD.react(d, st(100), mem, 20);
out.again = PD.react(d, st(900), mem, 21);
out.played = mem.played.t;
out.mid = PD.keyed(d.shapes[0], 21.5, mem);
out.click = PD.react(d, st(900), mem, 22, "t");
out.otherClick = PD.react(d, st(900), mem, 40, "zz");
out.every = Object.keys(mem.every).length > 0 && mem.flash.t != null;
out.hour = PD.react(d, st(900, { time: { hour: 11 } }), mem, 50);
out.norm = PD.source("panel:power").get(st(250));
out.text = PD.text("{panel:power} {panel:nope} {cpu}%", st(250));
const rows = (lv) => ({ panels: { lab: { rows: [{ name: "a", level: "ok", value: 2 }, { name: "b", level: lv, value: 4 }] } }, time: { hour: 10 } });
const d2 = { shapes: [{ id: "f", type: "rect", repeat: { by: "panel", panel: "lab", stateColors: true } }],
             actions: [{ id: "r", when: { type: "event", event: "row-crit" }, do: [{ type: "fx", fx: "lightning" }] },
                       { id: "o", when: { type: "event", event: "row-ok" }, do: [{ type: "fx", fx: "shooting" }] }] };
const m2 = { hits: [] };
PD.react(d2, rows("ok"), m2, 0); PD.react(d2, rows("ok"), m2, 1);
out.rowCrit = PD.react(d2, rows("crit"), m2, 2).map(f => f.kind);
out.rowOk = PD.react(d2, rows("ok"), m2, 3).map(f => f.kind);
out.loop = PD.keyed({ id: "l", keys: { dur: 2, frames: [{ t: 0, alpha: 0 }, { t: 1, alpha: 1 }] } }, 1, {});
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node")
class EngineTests(unittest.TestCase):
    def test_actions_keyframes_and_panels(self):
        r = subprocess.run(["node", "-e", ENGINE, str(WEB / "scene-design.js")], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        o = json.loads(r.stdout)
        self.assertEqual(o["start"], [])
        self.assertEqual(o["rise"], [{"kind": "launch", "text": "600W"}])   # live values filled in
        self.assertEqual(o["stay"], [])                       # once, on the way across
        self.assertEqual(o["cool"], [])                       # the cooldown
        self.assertEqual(len(o["again"]), 1)
        self.assertEqual(o["played"], 21)
        self.assertAlmostEqual(o["mid"]["dx"], 0.05, places=3)
        self.assertEqual(o["click"], [{"kind": "fireworks", "text": ""}])
        self.assertEqual(o["otherClick"], [])
        self.assertTrue(o["every"])
        self.assertEqual(o["hour"], [])                       # an effect Pulse does not have is not asked for
        self.assertEqual(o["norm"], 250)
        self.assertEqual(o["text"], "250W – 10%")
        self.assertAlmostEqual(o["loop"]["alpha"], 0.5, places=3)
        self.assertEqual((o["rowCrit"], o["rowOk"]), (["lightning"], ["shooting"]))


class CommunityToolTests(unittest.TestCase):
    def load(self):
        lp = importlib.machinery.SourceFileLoader("scene_index", str(ROOT / "tools/scene-index.py"))
        sp = importlib.util.spec_from_loader(lp.name, lp)
        m = importlib.util.module_from_spec(sp)
        lp.exec_module(m)
        return m

    def test_the_index_is_built_and_checked(self):
        m = self.load()
        tmp = Path(tempfile.mkdtemp())
        try:
            d = tmp / "power-tower"
            d.mkdir()
            (d / "power-tower.pulse").write_text(json.dumps(package()))
            m.SCENES, m.INDEX = tmp, tmp / "index.json"
            self.assertEqual(m.build(True), 1)                # no index yet
            self.assertEqual(m.build(False), 0)
            self.assertEqual(m.build(True), 0)
            idx = json.loads(m.INDEX.read_text())
            self.assertEqual(idx["scenes"][0]["preview"], "power-tower/preview.webp")
            self.assertTrue((d / "preview.webp").exists())
            (d / "pulse-evil").write_text("#!/bin/sh\n")      # no scripts in a scene folder
            self.assertEqual(m.build(True), 1)
            (d / "pulse-evil").unlink()
            (d / "power-tower.pulse").write_text(json.dumps(package(commands=["x"])))
            self.assertEqual(m.build(True), 1)
            (d / "power-tower.pulse").write_text(json.dumps(package(name="other")))
            self.assertEqual(m.build(True), 1)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_the_repository_gallery_is_up_to_date(self):
        m = self.load()
        if m.SCENES.is_dir() and any(x.is_dir() for x in m.SCENES.iterdir()):
            self.assertEqual(m.build(True), 0)


class EditorTests(unittest.TestCase):
    def test_the_editor_has_the_creator_tools(self):
        html = (WEB / "editor.html").read_text()
        for needle in ('id="exportPkg"', 'id="import"', 'id="community"', 'id="addAct"', 'id="pics"', "/api/package-export", "/api/package-check",
                       "/api/gallery-install", "PD.react", "keysPanel"):
            self.assertIn(needle, html)


if __name__ == "__main__":
    unittest.main()
