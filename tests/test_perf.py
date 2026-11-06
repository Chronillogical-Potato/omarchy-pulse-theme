import importlib.machinery
import importlib.util
import unittest
from unittest import mock
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_perf', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)


class DmabufTests(unittest.TestCase):
    def test_auto_is_off_only_on_nvidia(self):
        self.assertTrue(pulse.dmabuf_disabled('auto', True))
        self.assertFalse(pulse.dmabuf_disabled('auto', False))
        self.assertFalse(pulse.dmabuf_disabled('on', True))
        self.assertTrue(pulse.dmabuf_disabled('off', False))
        self.assertTrue(pulse.dmabuf_disabled(None, True))


class PerfTests(unittest.TestCase):
    def report(self, **kw):
        d = {'mon': '0,0', 'fps': 5.2, 'want': 30, 'cap': 3, 'draw': 7.5, 'gap': 180, 'maxGap': 260, 'bound': True,
             'w': 3840, 'h': 2160, 'scene': 'calm'}
        d.update(kw)
        return d

    def test_a_slow_monitor_is_logged_once_with_the_hint(self):
        hub = pulse.Hub()
        hub.mons = {'0,0': {'name': 'DP-1'}}
        with mock.patch.object(pulse, 'log') as log, mock.patch.object(pulse, 'nvidia', return_value=True):
            hub.set_perf(self.report())
            hub.set_perf(self.report())
        self.assertEqual(log.call_count, 1)
        msg = log.call_args[0][0]
        self.assertIn('DP-1 (3840x2160)', msg)
        self.assertIn('dmabuf = "on"', msg)
        self.assertEqual(hub.perf['0,0']['fps'], 5.2)

    def test_fine_monitors_and_bad_input_are_quiet(self):
        hub = pulse.Hub()
        with mock.patch.object(pulse, 'log') as log:
            hub.set_perf(self.report(bound=False))
            hub.set_perf({'mon': '<script>', 'fps': 'x'})
            hub.set_perf([1, 2])
        log.assert_not_called()
        self.assertNotIn('<script>', ''.join(hub.perf))

    def test_no_nvidia_hint_without_nvidia(self):
        with mock.patch.object(pulse, 'nvidia', return_value=False):
            self.assertNotIn('dmabuf', pulse.perf_hint(self.report(), 'auto'))


if __name__ == '__main__':
    unittest.main()
