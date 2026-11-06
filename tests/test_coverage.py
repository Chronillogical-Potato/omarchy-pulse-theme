import importlib.machinery
import importlib.util
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

loader = importlib.machinery.SourceFileLoader('pulse', str(Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)


def mon(**changes):
    value = {'x': 100, 'y': -100, 'width': 2000, 'height': 1000, 'scale': 2,
             'reserved': [0, 20, 0, 0], 'transform': 0, 'activeWorkspace': {'id': 1},
             'specialWorkspace': {'id': 0}, 'dpmsStatus': True}
    value.update(changes)
    return value


def win(x, y, w, h, workspace=1, **changes):
    value = {'at': [x, y], 'size': [w, h], 'workspace': {'id': workspace}, 'mapped': True, 'hidden': False}
    value.update(changes)
    return value


class CoverageTests(unittest.TestCase):
    def test_empty_or_partially_covered_desktop_stays_visible(self):
        self.assertFalse(pulse.monitor_covered(mon(), []))
        self.assertFalse(pulse.monitor_covered(mon(), [win(100, -80, 400, 480)]))

    def test_tiled_windows_with_small_gaps_pause(self):
        self.assertTrue(pulse.monitor_covered(mon(), [win(105, -75, 490, 470), win(605, -75, 490, 470)]))

    def test_overlap_cannot_inflate_coverage(self):
        self.assertFalse(pulse.monitor_covered(mon(), [win(100, -80, 600, 480)] * 3))

    def test_hidden_and_other_workspace_windows_are_ignored(self):
        self.assertFalse(pulse.monitor_covered(mon(), [win(100, -80, 1000, 480, workspace=2),
                                                       win(100, -80, 1000, 480, hidden=True)]))
        self.assertTrue(pulse.monitor_covered(mon(specialWorkspace={'id': -99}), [win(100, -80, 1000, 480, workspace=-99)]))

    def test_monitor_off_or_unknown_geometry(self):
        self.assertTrue(pulse.monitor_covered(mon(dpmsStatus=False), []))
        self.assertFalse(pulse.monitor_covered(mon(scale=0), []))
        self.assertFalse(pulse.monitor_covered({}, []))

    def test_rotated_monitor_geometry(self):
        self.assertTrue(pulse.monitor_covered(mon(transform=1), [win(100, -80, 500, 980)]))

    def test_visibility_endpoint_requires_token_and_excludes_widget_data(self):
        hub = pulse.Hub()
        hub.mons = {'0,0': {'covered': True}}
        hub.widgets['private'] = {'title': 'must not appear'}
        srv = ThreadingHTTPServer(('127.0.0.1', 0), pulse.make_handler(hub, 'test-token', 0))
        port = srv.server_address[1]
        srv.RequestHandlerClass = pulse.make_handler(hub, 'test-token', port)
        worker = threading.Thread(target=srv.serve_forever, daemon=True)
        worker.start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        url = f'http://127.0.0.1:{port}/api/visibility'
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(url, timeout=3)
        self.assertEqual(error.exception.code, 401)
        error.exception.close()
        request = urllib.request.Request(url, headers={'X-Pulse-Token': 'test-token'})
        with urllib.request.urlopen(request, timeout=3) as response:
            data = json.load(response)
        self.assertTrue(data['mons']['0,0']['covered'])
        self.assertTrue(data['pause_when_covered'])
        self.assertNotIn('widgets', data)
        hub.cfg = {'pulse': {'pause_when_covered': False}}
        with urllib.request.urlopen(request, timeout=3) as response:
            self.assertFalse(json.load(response)['pause_when_covered'])

if __name__ == '__main__':
    unittest.main()
