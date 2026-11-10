"""Pulse 1.8: the look (one light, a city with volume), the datacenter district, "describe your world"."""
import importlib.machinery
import importlib.util
import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_18', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
WEB = path.parent / 'web'

GOOD = {"shapes": [{"id": "t", "type": "tower", "x": 0.5, "y": 0.6, "w": 0.03, "h": 0.2, "color": "accent",
                    "bind": [{"prop": "level", "src": "cpu", "from": 0, "to": 1}, {"prop": "h", "src": "panel:power", "from": 0.1, "to": 0.4, "lo": 0, "hi": 5}],
                    "repeat": {"by": "panel", "panel": "docker", "spread": True}, "click": "{name}",
                    "keys": {"start": "action", "dur": 1, "frames": [{"t": 0}, {"t": 1, "dy": -0.1}]}}],
        "actions": [{"when": {"type": "event", "event": "ci-ok"}, "do": [{"type": "fx", "fx": "launch", "text": "ok"}, {"type": "play", "shape": "t"}]}]}
BAD = {"shapes": [{"type": "hexagon"}, {"type": "rect", "color": "#ff0000", "x": "left", "bind": [{"prop": "h", "src": "bitcoin", "from": 0, "to": 1}]},
                  {"type": "image", "asset": "nope"}, "x"],
       "actions": [{"when": {"type": "event", "event": "rm -rf"}, "do": [{"type": "fx", "fx": "shell"}]},
                   {"when": {"type": "event", "event": "start"}, "do": [{"type": "fx", "fx": "fireworks", "text": "hi"}, {"type": "run", "cmd": "x"}]},
                   {"when": {"type": "above", "src": "cpu", "value": 80}, "do": [{"type": "flash", "shape": "ghost"}]}],
       "commands": ["x"], "script": "x"}


class DescribeTests(unittest.TestCase):
    def test_the_design_is_found_in_a_reply(self):
        for txt in (json.dumps(GOOD), "Sure!\n```json\n" + json.dumps(GOOD) + "\n```\nEnjoy", "here {it is}: " + json.dumps({"design": GOOD}) + " bye"):
            if "{it is}" in txt:
                txt = txt.replace("here {it is}: ", "here: ")
            self.assertEqual(len(pulse.design_from_text(txt)["shapes"]), 1)
        for txt in ("sorry, I cannot", "{}", '{"shapes": 3}', "", "{not json}"):
            with self.assertRaises(ValueError):
                pulse.design_from_text(txt)

    def test_a_good_design_is_kept_as_it_is(self):
        d, notes = pulse.design_fix(GOOD)
        self.assertEqual(notes, [])
        self.assertEqual(len(d["shapes"][0]["bind"]), 2)
        self.assertEqual(d["shapes"][0]["keys"]["start"], "action")
        self.assertEqual(d["actions"][0]["do"][1], {"type": "play", "shape": "t"})
        self.assertEqual(pulse.design_clean(d)["v"], 2)

    def test_what_the_engine_does_not_know_is_left_out_and_said(self):
        d, notes = pulse.design_fix(BAD)
        self.assertEqual([s["type"] for s in d["shapes"]], ["rect"])
        self.assertEqual((d["shapes"][0]["color"], d["shapes"][0]["x"], d["shapes"][0]["bind"]), ("accent", 0.5, []))
        self.assertEqual(d["actions"], [{"id": "a2", "when": {"type": "event", "event": "start"}, "do": [{"type": "fx", "fx": "fireworks", "text": "hi"}], "cooldown": 10}])
        self.assertNotIn("commands", d)
        self.assertNotIn("script", d)
        self.assertGreaterEqual(len(notes), 5)
        with self.assertRaises(ValueError):
            pulse.design_fix({"shapes": [{"type": "nope"}]})

    def test_the_request_has_the_guide_the_panels_and_no_values(self):
        p = pulse.describe_prompt("a harbour\nwhere every container is a ship",
                                  {"power": {"value": 1234.5, "unit": "W", "min": 0, "max": 3000}, "docker": {"rows": [{"name": "immich", "level": "ok", "value": 7}]}})
        self.assertIn("how to write a scene", p)
        self.assertIn("`panel:power`: a number in W, from 0 to 3000", p)
        self.assertIn("`docker`: a list with 1 rows (immich", p)
        self.assertIn("> a harbour where every container is a ship", p)
        self.assertNotIn("1234.5", p)
        self.assertIn("(none", pulse.describe_prompt("x", {}))

    def test_your_agent_is_run_with_the_request_and_its_reply_is_checked(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            ag = tmp / "agent.sh"
            ag.write_text("#!/bin/sh\ngrep -q 'a lighthouse' && echo 'ok then:' && cat " + str(tmp / "reply.json") + "\n")
            ag.chmod(ag.stat().st_mode | stat.S_IEXEC)
            (tmp / "reply.json").write_text(json.dumps(BAD))
            d, notes = pulse.describe_run("a lighthouse", {}, str(ag))
            self.assertEqual(len(d["shapes"]), 1)
            self.assertTrue(notes)
            for cmd in (str(tmp / "missing"), "false"):
                with self.assertRaises(ValueError):
                    pulse.describe_run("x", {}, cmd)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_a_design_is_saved_only_as_one_of_your_scenes(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            with mock.patch.object(pulse, "USER_SCENES", tmp):
                d = pulse.design_clean(pulse.design_fix(GOOD)[0])
                self.assertIn("path", pulse.design_save("harbour", d))
                self.assertEqual(pulse.design_of((tmp / "harbour.js").read_text())["shapes"][0]["id"], "t")
                for bad in ("sphere", "pond", "../x", ""):
                    self.assertIn("error", pulse.design_save(bad, d))
                (tmp / "mine.js").write_text('PulseScene.register("mine", {});')
                self.assertEqual(pulse.design_save("mine", d)["code"], 409)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    @unittest.skipUnless(shutil.which("node"), "node")
    def test_the_guide_and_the_checks_know_what_the_engine_knows(self):
        js = ('const PD=require(process.argv[1]);console.log(JSON.stringify({src:Object.keys(PD.SOURCES),props:Object.keys(PD.PROPS),'
              'ev:Object.keys(PD.EVENTS),fx:Object.keys(PD.FX)}))')
        o = json.loads(subprocess.run(["node", "-e", js, str(WEB / "scene-design.js")], capture_output=True, text=True, timeout=30).stdout)
        self.assertEqual(sorted(o["src"]), sorted(pulse.DESIGN_SRC))
        self.assertEqual(sorted(o["props"]), sorted(pulse.DESIGN_PROPS))
        self.assertEqual(sorted(o["ev"]), sorted(pulse.DESIGN_EVENTS))
        self.assertEqual(sorted(o["fx"]), sorted(pulse.DESIGN_FX))
        guide = pulse.scene_guide()
        for word in list(pulse.DESIGN_SRC) + list(pulse.DESIGN_PROPS) + list(pulse.DESIGN_EVENTS) + list(pulse.DESIGN_FX) + list(pulse.DESIGN_TYPES):
            self.assertIn("`" + word + "`", guide, word)
        ex = guide[guide.rindex("```json") + 7:guide.rindex("```")]
        d, notes = pulse.design_fix(json.loads(ex))
        self.assertEqual(notes, [])


class DatacenterTests(unittest.TestCase):
    def hub(self, cfg, demo=False, priv=False):
        h = pulse.Hub.__new__(pulse.Hub)
        h.cfg, h.demo = cfg, demo
        h.privacy = lambda: priv
        h.widgets = {"proxmox": {"id": "proxmox", "title": "Proxmox", "type": "status", "data": {"items": [
                         {"title": "vm-web", "level": "ok", "note": "secret"}, {"title": "vm-db", "level": "crit", "value": 3}]}},
                     "docker": {"id": "docker", "type": "kv", "data": {"rows": [["immich", "Up 3 days"], ["n8n", "Exited (1)"]]}},
                     "mine": {"id": "mine", "type": "list", "private": True, "data": {"items": [{"title": "a"}]}},
                     "notifications": {"id": "notifications", "type": "list", "data": {"items": [{"title": "mail"}]}},
                     "power": {"id": "power", "type": "stat", "data": {"value": 3}}}
        return h

    def test_nothing_until_you_name_a_panel(self):
        self.assertEqual(self.hub({}).datacenter_state(), [])
        self.assertEqual(self.hub({"datacenter": {"panels": "proxmox"}}).datacenter_state(), [])

    def test_a_hall_for_every_row_of_the_panels_you_name(self):
        g = self.hub({"datacenter": {"panels": ["proxmox", "docker", "mine", "notifications", "power", "nope"]}}).datacenter_state()
        self.assertEqual([x["id"] for x in g], ["proxmox", "docker"])
        self.assertEqual(g[0]["title"], "Proxmox")
        self.assertEqual([r["level"] for r in g[0]["rows"] + g[1]["rows"]], ["ok", "crit", "ok", "crit"])
        self.assertNotIn("secret", json.dumps(g))

    def test_no_names_while_you_share_the_screen(self):
        g = self.hub({"datacenter": {"panels": ["proxmox"]}}, priv=True).datacenter_state()
        self.assertEqual((g[0]["title"], {r["name"] for r in g[0]["rows"]}), ("", {""}))


MONO = r"""
const fs = require("fs"), calls = { n: 0 }, fx = [];
const ctx = new Proxy({}, { get: (o, k) => k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : k in o ? o[k] : (...a) => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
let scene = null;
global.PulseScene = { register: (n, d) => { scene = d; scene._name = n; }, fx: (k, t) => fx.push([k, t]),
  rgba: (c, a) => "rgba(" + c.join(",") + "," + a + ")", mix: (a, b, k) => a.map((v, i) => v + (b[i] - v) * k) };
eval(fs.readFileSync(process.argv[1], "utf8"));
const box = { w: 1920, h: 1080, horizon: 804 }, out = { name: scene._name, q: [] };
const full = (o) => Object.assign({ t: 1000, time: { hour: 10 }, sys: { cpu: 40, cores: [10, 95, 50, 0], ram: 50, disk: 60, temp: 70, rx: 1e6, tx: 1e5 },
  agents: [{ name: "a", state: "working" }, { name: "b", state: "waiting" }, { name: "", state: "failed" }, { name: "d", state: "done" }],
  git: [{ name: "r1", week: 12, ci: "fail", dirty: 2 }, { name: "r2", week: 0, ci: "run" }], events: [{ kind: "commit", text: "r1: x", t: 999 }],
  panels: { docker: { rows: [{ name: "x", level: "ok" }, { name: "y", level: "ok" }] }, news: { rows: [{ name: "n", level: "" }] }, power: { value: 3 } },
  space: { sun: -20, kp: 5 }, focus: { start: 900, until: 1900 }, music: true, theme: {}, ui: { motion: "full", quality: "auto" } }, o || {});
scene.init(ctx, box);
[{}, full(), full({ ui: { motion: "reduced", quality: "half" } }), { sys: {} }].forEach((st, i) => { for (const q of [0, 1, 2, 3]) { scene.q = q; scene.draw(ctx, 5 + i, st, box); out.q.push(q); } });
out.services = scene.hit.length; scene.q = 2; scene.draw(ctx, 9, full(), box);
out.click = scene.click(960, scene.hit[scene.hit.length - 1][1]); out.hits = scene.hit.map(h => h[3]);
scene.update(full()); const later = full({ t: 1100, git: [{ name: "r1", week: 12, ci: "ok" }], agents: [{ name: "b", state: "waiting" }, { name: "c", state: "waiting" }],
  panels: { docker: { rows: [{ name: "x", level: "crit" }, { name: "y", level: "ok" }] } } });
scene.update(later); scene.update(later); out.fx = fx; out.calls = calls.n;
// a slow PC: every frame takes 10 ms -> it steps down to light; a fast one: 1 ms -> back up to ultra, but never past medium at half quality
let clock = 0, step = 10; global.performance = { now: () => (clock += step) };
scene.q = 3; scene.cost = []; scene.qAt = 0; for (let f = 0; f < 1200; f++) scene.draw(ctx, 100 + f / 10, full(), box); out.slow = scene.q;
step = 1; for (let f = 0; f < 6000; f++) scene.draw(ctx, 300 + f / 10, full(), box); out.fast = scene.q;
scene.q = 3; for (let f = 0; f < 400; f++) scene.draw(ctx, 1000 + f / 10, full({ ui: { motion: "full", quality: "half" } }), box); out.half = scene.q;
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node")
class MonolithTests(unittest.TestCase):
    def test_it_draws_at_every_quality_with_and_without_data_and_asks_for_effects_once(self):
        r = subprocess.run(["node", "-e", MONO, str(WEB / "scenes" / "monolith.js")], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr[-800:])
        o = json.loads(r.stdout)
        self.assertEqual((o["name"], len(o["q"])), ("monolith", 16))
        self.assertGreater(o["calls"], 500)
        self.assertIn("CPU 40%", o["click"])
        self.assertTrue(any(h.startswith("r1 · 12 commits") for h in o["hits"]))
        self.assertTrue(any(h.startswith("x · ok") for h in o["hits"]))
        self.assertFalse(any(h.startswith("n · ") for h in o["hits"]))          # a list of news is not a swarm
        self.assertEqual(sorted(k for k, t in o["fx"]), ["chime", "launch", "lightning"])   # once each, not at every update
        self.assertEqual((o["slow"], o["fast"], o["half"]), (0, 3, 1))                # it fits the PC

    def test_it_comes_with_pulse_and_passes_the_checks(self):
        src = (WEB / "scenes" / "monolith.js").read_text()
        self.assertFalse([c for c in pulse.scene_check(src) if c[0] == "crit"])
        self.assertIn("error", pulse.design_save("monolith", {"shapes": [{"type": "rect"}]}))


MARS = MONO.replace("out.click = scene.click(960, scene.hit[scene.hit.length - 1][1]);", "out.click = scene.hit.filter(h => /^CPU /.test(h[3]))[0][3];") \
    .replace("out.fx = fx;", "out.fx = fx; out.said = said; out.go = scene.go.slice(); scene.draw(ctx, 2000, later, box); out.lift = Object.keys(scene.lift);"
             " [{ space: { sun: 40 }, weather: { code: 63, rain: 3, wind: 50, cloud: 90 } }, { space: { sun: 1 }, weather: { code: 73 } }, { space: { sun: -30, kp: 7 } }]"
             ".forEach(o => { for (const q of [0, 1, 2, 3]) { scene.q = q; scene.draw(ctx, 2100, full(o), box); } });") \
    .replace("fx: (k, t) => fx.push([k, t]),", "fx: (k, t) => fx.push([k, t]), say: (t) => said.push(t),").replace("fx = [];", "fx = [], said = [];", 1)


@unittest.skipUnless(shutil.which("node"), "node")
class MarsTests(unittest.TestCase):
    def test_it_draws_at_every_hour_weather_and_quality_and_answers_with_its_own_effects(self):
        r = subprocess.run(["node", "-e", MARS, str(WEB / "scenes" / "mars.js")], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr[-800:])
        o = json.loads(r.stdout)
        self.assertEqual((o["name"], len(o["q"])), ("mars", 16))
        self.assertGreater(o["calls"], 500)
        self.assertIn("CPU 40%", o["click"])
        self.assertTrue(any(h.startswith("r1 · 12 commits") for h in o["hits"]))
        self.assertTrue(any(h.startswith("x · ok") for h in o["hits"]))
        self.assertTrue(any(h.startswith("a · working") for h in o["hits"]))
        self.assertTrue(any(h.startswith("RAM 50%") for h in o["hits"]))
        self.assertFalse(any(h.startswith("n · ") for h in o["hits"]))          # a list of news is not a village
        self.assertEqual(sorted(k for k, t in o["fx"]), ["chime", "chime"])       # a rover waits, a pod is down: once each
        self.assertEqual(o["said"], ["r1 is green · liftoff"])
        self.assertEqual((o["go"], o["lift"]), (["r1"], ["r1"]))                  # the build is green: its rocket leaves
        self.assertEqual((o["slow"], o["fast"], o["half"]), (0, 3, 1))            # it fits the PC

    def test_it_is_another_world_and_passes_the_checks(self):
        src = (WEB / "scenes" / "mars.js").read_text()
        self.assertFalse([c for c in pulse.scene_check(src) if c[0] == "crit"])
        self.assertNotIn("st.theme", src)                                         # its own sky and colours, not the theme's
        self.assertIn("error", pulse.design_save("mars", {"shapes": [{"type": "rect"}]}))


class LookTests(unittest.TestCase):
    def test_the_new_look_can_be_turned_off_and_keeps_the_old_one(self):
        js = (WEB / "pulse.js").read_text()
        self.assertIn("function polished()", js)
        self.assertIn("ui.polish !== false", js)
        self.assertIn('else for (i = 0; i < far.length; i++)', js)   # the plain far city is still there
        self.assertIn('"polish": self.conf("pulse", "polish", default=True) is not False', path.read_text())

    def test_the_editor_can_describe(self):
        html = (WEB / "editor.html").read_text()
        for needle in ('id="describe"', "/api/scene-describe", "/api/scene-from-text", "/api/scene-prompt"):
            self.assertIn(needle, html)


if __name__ == "__main__":
    unittest.main()
