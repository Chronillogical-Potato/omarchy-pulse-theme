import importlib.machinery
import importlib.util
import json
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_151', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)

PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")


class WallpaperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_a_picture(self):
        f = self.home / "city.png"
        f.write_bytes(PNG)
        self.assertEqual(pulse.wallpaper_path(str(f)), f)
        self.assertIsNone(pulse.wallpaper_path(str(self.home / "nope.png")))
        (self.home / "notes.txt").write_text("x")
        self.assertIsNone(pulse.wallpaper_path(str(self.home / "notes.txt")))   # only pictures
        self.assertIsNone(pulse.wallpaper_path(""))

    def test_the_omarchy_background_follows_the_theme(self):
        bg = self.home / ".config/omarchy/backgrounds/a.png"
        bg.parent.mkdir(parents=True)
        bg.write_bytes(PNG)
        link = self.home / ".config/omarchy/current/background"
        link.parent.mkdir(parents=True)
        link.symlink_to(bg)
        with mock.patch.object(pulse, "HOME", self.home):
            self.assertEqual(pulse.wallpaper_path("omarchy"), bg)

    def test_the_hub_serves_it_with_the_token_only(self):
        f = self.home / "city.png"
        f.write_bytes(PNG)
        conf = self.home / "omarchy-pulse"
        conf.mkdir()
        with mock.patch.multiple(pulse, CONF_DIR=conf, TOKEN_FILE=conf / "token", STATE_DIR=self.home / "state"):
            hub = pulse.Hub()
            hub.demo = True
            hub.cfg = {"pulse": {"wallpaper": str(f), "wallpaper_mode": "panels", "wallpaper_dim": 2}}
            ui = hub.wallpaper_ui()
            self.assertEqual(ui["mode"], "panels")
            self.assertEqual(ui["dim"], 0.9)
            srv = pulse.serve(hub, 47998)
            try:
                tok = pulse.token()
                with urllib.request.urlopen(f"http://127.0.0.1:47998/api/wallpaper?token={tok}", timeout=5) as r:
                    self.assertEqual(r.read(), PNG)
                    self.assertEqual(r.headers["Content-Type"], "image/png")
                with self.assertRaises(urllib.error.HTTPError):
                    urllib.request.urlopen("http://127.0.0.1:47998/api/wallpaper", timeout=5)
                hub.cfg = {"pulse": {}}
                self.assertIsNone(hub.wallpaper_ui())
            finally:
                srv.shutdown()


if __name__ == "__main__":
    unittest.main()
