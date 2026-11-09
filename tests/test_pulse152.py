import importlib.machinery
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_152', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)


class ThemeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "home"
        self.system = Path(self.tmp.name) / "usr/share/omarchy/themes"
        pulse._theme_cache.clear()

    def tearDown(self):
        self.tmp.cleanup()

    def theme(self, d, text):
        d.mkdir(parents=True)
        (d / "colors.toml").write_text(text)

    def test_named_colours_fill_the_numbered_ones(self):
        c = pulse.theme_colors({"accent": "#82bc7a", "magenta": "#aa77cc", "green": "#00ff00", "color1": "#ff0000", "red": "#990000", "x": 3})
        self.assertEqual(c["color5"], "#aa77cc")
        self.assertEqual(c["color2"], "#00ff00")
        self.assertEqual(c["color1"], "#ff0000")   # a numbered colour the theme has wins
        self.assertNotIn("x", c)

    def test_state_and_system_themes(self):
        state = self.home / ".local/state/omarchy"
        state.mkdir(parents=True)
        (state / "current").mkdir()
        (state / "current/theme.name").write_text("micro-forest")
        self.theme(self.system / "micro-forest", 'accent = "#82bc7a"\nmagenta = "#b48ead"\n')
        with mock.patch.multiple(pulse, HOME=self.home, SYSTEM_THEMES=self.system):
            t = pulse.read_theme()
        self.assertEqual(t["name"], "micro-forest")
        self.assertEqual(t["colors"]["color5"], "#b48ead")
        pulse._theme_cache.clear()
        self.theme(state / "current/theme", 'accent = "#123456"\n')
        with mock.patch.multiple(pulse, HOME=self.home, SYSTEM_THEMES=self.system):
            self.assertEqual(pulse.read_theme()["colors"]["accent"], "#123456")   # the live state comes first


class DefaultSceneTests(unittest.TestCase):
    def test_no_scene_line_means_the_sphere(self):
        hub = pulse.Hub.__new__(pulse.Hub)
        hub.cfg = {"pulse": {}}
        hub.demo = False
        hub.scene_override = ""
        self.assertEqual(hub.scene_kind(), "sphere")   # 1.5.3: as the docs say since 1.1
        hub.cfg = {"pulse": {"scene": "skyline"}}
        self.assertEqual(hub.scene_kind(), "skyline")


class GpuTests(unittest.TestCase):
    def test_offload(self):
        self.assertEqual(pulse.gpu_offload_env("auto", True), {})
        nv = pulse.gpu_offload_env("discrete", True)
        self.assertEqual(nv["__NV_PRIME_RENDER_OFFLOAD"], "1")
        self.assertEqual(nv["__GLX_VENDOR_LIBRARY_NAME"], "nvidia")
        self.assertEqual(pulse.gpu_offload_env("discrete", False), {"DRI_PRIME": "1"})


if __name__ == "__main__":
    unittest.main()
