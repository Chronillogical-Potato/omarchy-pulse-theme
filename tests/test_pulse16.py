import importlib.machinery
import importlib.util
import io
import json
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_16', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
WEB = path.parent / 'web'


def hub():
    h = pulse.Hub.__new__(pulse.Hub)
    h.lock = pulse.threading.RLock()
    h.agents, h.crew_agents, h.health, h.fx, h.alerts = {}, {}, {}, pulse.collections.deque(maxlen=50), pulse.collections.deque(maxlen=50)
    h.widgets, h.images, h.news_seen, h.cfg = {}, {}, {}, {}
    h.fx_seq = h.alert_seq = 0
    h.away = None
    h.conf = lambda *k, default=None: default
    for name in ('crew_send', 'note', 'say', 'noc_event', 'raise_alert', 'stat'):
        setattr(h, name, mock.Mock())
    h.T = lambda *a, **k: ''
    return h


class DesignTests(unittest.TestCase):
    def test_a_design_round_trips_and_cannot_break_out(self):
        d = {"sky": "accent", "shapes": [{"type": "text", "text": "*/ alert(1) </script> /*END*/", "x": 0.5}]}
        src = pulse.design_scene("my-world", d)
        self.assertNotIn("</script", src)
        self.assertEqual(src.count("/*END*/"), 1)
        back = pulse.design_of(src)
        self.assertEqual(back["shapes"][0]["text"], d["shapes"][0]["text"])
        self.assertEqual([c[0] for c in pulse.scene_check(src)], ["ok"])

    def test_not_a_design(self):
        self.assertIsNone(pulse.design_of("PulseScene.register('x', {})"))
        with self.assertRaises(ValueError):
            pulse.design_clean({"shapes": [{}] * 201})
        with self.assertRaises(ValueError):
            pulse.design_clean([1, 2])

    @unittest.skipUnless(shutil.which('node'), 'node')
    def test_the_engine_draws_every_shape(self):
        js = (WEB / 'scene-design.js').read_text() + r'''
var calls = 0, ctx = new Proxy({}, { get: function (o, k) {
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
  if (k in o) return o[k];
  return function () { calls++; }; }, set: function (o, k, v) { o[k] = v; return true; } });
var types = ["rect", "ellipse", "line", "star", "text", "ring", "bars", "tower", "wave", "particles"];
var design = { sky: "accent", shapes: types.map(function (t, i) { return { id: "s" + i, type: t, x: 0.5, y: 0.6, w: 0.1, h: 0.1, color: "accent", color2: "crit",
  glow: 0.5, anim: { kind: ["pulse", "spin", "bob", "sway", "blink", "breathe", "drift", "none"][i % 8], speed: 1 },
  bind: [{ prop: "heat", src: "cpu", from: 0, to: 1 }, { prop: "level", src: "item", from: 0, to: 1 }],
  repeat: { by: ["none", "agents", "repos", "cores", "count"][i % 5], n: 3, spread: i % 2 === 0, stateColors: true }, click: "{name} {cpu}%" }; }) };
var st = { sys: { cpu: 50, cores: [10, 90, 40], ram: 30, rx: 1e6, tx: 0 }, agents: [{ name: "claude", state: "working" }, { name: "codex", state: "failed" }],
  git: [{ name: "a", week: 3, ci: "fail" }], weather: { temp: 5, rain: 1 }, time: { hour: 21, minute: 5 }, theme: {}, ui: { motion: "full" } };
var mem = {};
[0, 1.3, 7.9].forEach(function (t) { PulseDesign.draw(ctx, t, st, { w: 1600, h: 900, horizon: 670 }, design, mem); });
st.ui.motion = "reduced"; st.privacy = true; st.agents[0].name = "";
PulseDesign.draw(ctx, 2, st, { w: 800, h: 450, horizon: 335 }, design, mem);
var said = PulseDesign.click(mem, mem.hits[0][0], mem.hits[0][1]);
console.log(JSON.stringify({ calls: calls > 100, hits: mem.hits.length, said: said, cpu: PulseDesign.text("{cpu}% {nope}", st) }));
'''
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertTrue(out['calls'])
        self.assertGreater(out['hits'], 10)
        self.assertEqual(out['cpu'], '50% {nope}')


class HelperTests(unittest.TestCase):
    def test_palette_and_theme(self):
        px = [(200, 30, 60)] * 300 + [(20, 80, 220)] * 100 + [(10, 10, 14)] * 600
        p = pulse.palette_from(px)
        self.assertEqual(len([k for k in p if k.startswith('color')]), 16)
        self.assertTrue(all(v.startswith('#') and len(v) == 7 for v in p.values()))
        r, g, b = (int(p['accent'][i:i + 2], 16) for i in (1, 3, 5))
        self.assertGreater(r, b)   # the biggest colour of the picture is the accent

    @unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg')
    def test_theme_from_a_picture_is_new_and_never_applied(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(pulse, 'HOME', Path(tmp)):
            pic = Path(tmp) / 'wall.png'
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x2266cc:s=64x36', '-frames:v', '1', str(pic)], check=True)
            d = pulse.theme_from_picture(str(pic), 'my-blue')
            self.assertTrue((d / 'colors.toml').read_text().count('= "#') >= 20)
            self.assertTrue((d / 'backgrounds' / '1-wall.png').exists())
            with self.assertRaises(ValueError):
                pulse.theme_from_picture(str(pic), 'my-blue')   # never overwrites
            with self.assertRaises(ValueError):
                pulse.theme_from_picture(str(pic), '../evil')

    def test_tips_from_hyprland_binds(self):
        tips = pulse.bind_tips([{"modmask": 64, "key": "SPACE", "description": "Launch apps"},
                                {"modmask": 64 | 1, "key": "w", "description": "Close all"},
                                {"modmask": 64, "key": "x", "description": ""}, {"modmask": 64, "key": "y", "description": "x", "submap": "resize"}])
        self.assertEqual(tips, ["SUPER + SHIFT + W · Close all", "SUPER + SPACE · Launch apps"])

    def test_arch_news_only_manual_intervention_and_recent(self):
        now = time.time()
        fmt = lambda t: time.strftime('%a, %d %b %Y %H:%M:%S +0000', time.gmtime(t))   # noqa: E731
        xml = ''.join(f'<item><title>{t}</title><link>https://archlinux.org/news/{i}/</link><pubDate>{fmt(d)}</pubDate></item>'
                      for i, (t, d) in enumerate([("glibc requires manual intervention", now - 86400), ("New mirror", now - 3600),
                                                  ("old: manual intervention", now - 90 * 86400)]))
        n = pulse.arch_news(xml, now=now)
        self.assertEqual([x['title'] for x in n], ["glibc requires manual intervention"])

    def test_workspaces_tower(self):
        f = pulse.hypr_floors([{"id": 2}, {"id": 1}, {"id": -98}], [{"workspace": {"id": 2}, "class": "Chromium", "title": "secret"},
                                                                    {"workspace": {"id": 9}, "class": "x"}], 2)
        self.assertEqual([x['id'] for x in f], [1, 2])
        self.assertEqual(f[1], {"id": 2, "active": True, "apps": ["chromium"]})   # the class, never the title

    def test_local_only(self):
        self.assertTrue(pulse.local_url("http://127.0.0.1:11434"))
        self.assertTrue(pulse.local_url("192.168.1.40"))
        self.assertTrue(pulse.local_url("http://wled-desk.local"))
        with mock.patch.object(pulse.socket, 'gethostbyname', return_value='8.8.8.8'):
            self.assertFalse(pulse.local_url("https://example.com"))

    def test_ollama_answer(self):
        sent = {}

        class R:
            def __init__(self, req): sent['url'], sent['body'] = req.full_url, json.loads(req.data)
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self, n=-1): return json.dumps({"response": "  All good.\n  Two agents work. "}).encode()
        with mock.patch.object(pulse.urllib.request, 'urlopen', side_effect=lambda req, timeout=0: R(req)):
            out = pulse.ollama_answer("http://127.0.0.1:11434/", "llama3.2", "how am I?", "Now: Monday.")
        self.assertEqual(out, "All good. Two agents work.")
        self.assertEqual(sent['url'], "http://127.0.0.1:11434/api/generate")
        self.assertEqual((sent['body']['model'], sent['body']['stream']), ("llama3.2", False))
        self.assertIn("Now: Monday.", sent['body']['prompt'])

    def test_wled_state(self):
        self.assertEqual(pulse.wled_state((1, 2, 3), "rainbow", 300), {"on": True, "bri": 255, "seg": [{"col": [[1, 2, 3]], "fx": 9, "sx": 160}]})

    def test_day_card_counts_only(self):
        self.assertEqual(pulse.day_card("2026-11-09", {"commits": 4, "planes": 0, "agents_done": 12}),
                         ["YOUR DAY · 2026-11-09", "4 commits", "12 agent tasks done"])


class AgentTests(unittest.TestCase):
    def run_hook(self, kind, payload, args=()):
        sent = []
        with mock.patch.object(pulse, 'quiet_client', side_effect=lambda p, b=b"": sent.append(p) or 0), \
             mock.patch.object(pulse.sys, 'stdin', io.StringIO(json.dumps(payload))), \
             mock.patch.object(pulse, 'agent_group', return_value='abcd1234'):
            pulse.agent_hook(kind, list(args))
        return sent

    def test_every_agent_is_understood(self):
        q = lambda s: dict(pulse.urllib.parse.parse_qsl(s.split('?', 1)[1]))   # noqa: E731
        self.assertEqual(q(self.run_hook('claude', {"hook_event_name": "PreToolUse", "tool_name": "Edit", "cwd": "/w/app"})[0]),
                         {"state": "working", "text": "editing", "group": "abcd1234"})
        self.assertIn('grok%20%C2%B7%20app', self.run_hook('grok', {"hookEventName": "Stop", "cwd": "/w/app"})[0])
        self.assertEqual(q(self.run_hook('copilot', {"cwd": "/w/app"}, ["agentStop"])[0])["state"], "done")
        self.assertEqual(q(self.run_hook('gemini', {"hook_event_name": "BeforeTool", "tool_name": "run_shell_command", "cwd": "/w"})[0])["text"], "running a command")
        h = q(self.run_hook('hermes', {"hook_event_name": "post_llm_call", "cwd": "/w"})[0])
        self.assertEqual((h["state"], h["settle"]), ("done", "5"))
        self.assertEqual(q(self.run_hook('opencode', {"cwd": "/w", "tool_name": "edit"}, ["working"])[0])["text"], "editing")
        self.assertEqual(self.run_hook('claude', {"hook_event_name": "Unknown"}), [])

    def test_health_and_groups(self):
        h = hub()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(pulse, 'STATE_DIR', Path(tmp)):
            for st in ("working", "done", "working", "failed", "working", "done"):
                h.set_agent("codex · app", st, group="abcd1234")
            self.assertEqual(h.agent_health("codex · other"), {"health": 0.67, "runs": 3})
            self.assertEqual(h.agents["codex · app"]["group"], "abcd1234")
            h.set_agent("x", "working", group="../../etc")
            self.assertNotIn("group", h.agents["x"])

    def test_settle_waits_for_silence(self):
        h = hub()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(pulse, 'STATE_DIR', Path(tmp)):
            h.set_agent("hermes · a", "working")
            h.set_agent("hermes · a", "done", settle=0.2)
            self.assertEqual(h.agents["hermes · a"]["state"], "working")
            time.sleep(0.4)
            self.assertEqual(h.agents["hermes · a"]["state"], "done")
            h.set_agent("hermes · a", "working")
            h.set_agent("hermes · a", "done", settle=0.3)
            time.sleep(0.05)
            h.set_agent("hermes · a", "working")   # it went on: not done
            time.sleep(0.4)
            self.assertEqual(h.agents["hermes · a"]["state"], "working")

    def test_agents_from_notifications(self):
        h = hub()
        h.conf = lambda *k, default=None: {"from_notifications": ["Claude Duet"]} if k == ("agents",) else default
        now = time.time()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(pulse, 'STATE_DIR', Path(tmp)):
            h.agents_from_notes([{"right": "Claude Duet", "title": "Needs your approval", "text": "", "t": now},
                                 {"right": "Mail", "title": "Claude Duet in the news", "t": now - 3600}])
            self.assertEqual(h.agents["claude duet"]["state"], "waiting")
            h.agents_from_notes([{"right": "Claude Duet", "title": "Task finished", "t": now + 1}])
            self.assertEqual(h.agents["claude duet"]["state"], "done")

    def test_hook_snippets_are_valid(self):
        for k in pulse.HOOK_SETUP:
            txt = pulse.hook_snippet(k)
            if k != "hermes":
                json.loads(txt.split("\n", 1)[1])
            self.assertIn(f"omarchy-pulse hook {k}", txt)


class NewsRuleTests(unittest.TestCase):
    def test_a_rule_fires_once_for_new_items_only(self):
        h = hub()
        h.conf = lambda *k, default=None: {"rule": [{"match": "CVE", "effect": "lightning"}, {"match": "[bad", "effect": "fireworks"}]} if k == ("news",) else default
        h.add_fx = mock.Mock()
        w = {"data": {"items": [{"title": "CVE-2026-1 old"}]}}
        h.news_rules("feed", w)          # what is there at start is not news
        h.add_fx.assert_not_called()
        w = {"data": {"items": [{"title": "Critical CVE-2026-2"}, {"title": "a [bad title"}, {"title": "CVE-2026-1 old"}]}}
        h.news_rules("feed", w)
        h.news_rules("feed", w)
        self.assertEqual([c.args for c in h.add_fx.call_args_list], [("lightning", "Critical CVE-2026-2"), ("fireworks", "a [bad title")])
        h.news_rules("notes", {"private": True, "data": {"items": [{"title": "CVE"}]}})
        self.assertEqual(h.add_fx.call_count, 2)


class StaticTests(unittest.TestCase):
    def test_version_and_files(self):
        self.assertEqual(pulse.VERSION, "1.6.0")
        for f in ("editor.html", "scene-design.js"):
            self.assertTrue((WEB / f).exists())
        self.assertTrue((path.parent / "agents/opencode-pulse.js").exists())
        self.assertTrue((path.parent / "agents/pi-pulse.ts").exists())

    def test_the_layout_bar_can_hide(self):
        # a display rule on #layoutbar would beat the [hidden] attribute: Save must make it go away
        self.assertIn("#layoutbar[hidden] { display: none; }", (WEB / "pulse.css").read_text())

    @unittest.skipUnless(shutil.which('node'), 'node')
    def test_the_ivy_really_flowers_after_a_week(self):
        # The flowers used to be six 4-pixel dots nobody could see. Now: real five-petal flowers, a dozen on the tower's
        # ivy and a few on the city's, opening over the six hours after the seventh day; none before a week.
        src = (WEB / "pulse.js").read_text()
        for f in ("flower", "bloomOpen"):
            self.assertIn("function " + f + "(", src)
        self.assertIn("for (var p = 0; p < 5; p++)", src)
        self.assertIn("op && i < 12", src)
        a = src.index("    function bloomOpen()")
        js = "var uptimeS = 0, reduced = false;\n" + src[a:src.index("\n    }\n", a) + 6] + r'''
var out = [];
[[2, false], [6.9, false], [7, false], [7.1, false], [7.25, false], [9, false], [7, true]].forEach(function (c) {
  uptimeS = c[0] * 86400; reduced = c[1]; out.push(Math.round(bloomOpen() * 100) / 100);
});
console.log(JSON.stringify(out));
'''
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        before2, before7, at7, mid, done, later, still = json.loads(r.stdout)
        self.assertEqual((before2, before7), (0, 0), "no flowers before a week")
        self.assertTrue(0 < at7 < mid < done, (at7, mid, done))
        self.assertEqual((done, later, still), (1, 1, 1), "open after six hours; reduced motion: open at once")

    @unittest.skipUnless(shutil.which('node'), 'node')
    def test_page_scripts_parse(self):
        for f in ("pulse.js", "scene-design.js"):
            r = subprocess.run(['node', '--check', str(WEB / f)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == '__main__':
    unittest.main()
