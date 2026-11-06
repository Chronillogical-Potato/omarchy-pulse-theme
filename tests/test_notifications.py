import importlib.machinery
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)

class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = mock.patch.dict(os.environ, {'XDG_STATE_HOME': self.tmp.name})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.store = Path(self.tmp.name) / 'omarchy/notifications'
        self.store.mkdir(parents=True)

    def write(self, name, data):
        (self.store / name).write_text(json.dumps(data))

    def test_merges_live_and_history_most_recent_first(self):
        self.write('live.json', [{'key': 'a', 'ts': 3, 'summary': 'new', 'body': 'hello', 'app': 'test'},
                                 {'key': 'b', 'ts': 4, 'summary': 'latest'}])
        self.write('history.json', [{'key': 'a', 'ts': 3, 'summary': 'old duplicate'},
                                    {'key': 'c', 'ts': 2, 'summary': 'older'}])
        items = pulse.notification_history()
        self.assertEqual([i['title'] for i in items], ['latest', 'new', 'older'])
        self.assertEqual(items[1]['text'], 'hello')
        self.assertEqual(items[1]['right'], 'test')

    def test_malformed_file_does_not_hide_valid_history(self):
        (self.store / 'live.json').write_text('{')
        self.write('history.json', [{'key': 'a', 'ts': 1, 'summary': 'saved'}])
        self.assertEqual(pulse.notification_history()[0]['title'], 'saved')

    def test_empty_omarchy_store_does_not_show_stale_mako(self):
        self.write('history.json', [])
        with mock.patch.object(pulse, 'mako_history', side_effect=AssertionError('unexpected fallback')):
            self.assertEqual(pulse.notification_history(), [])

    def test_mako_fallback_when_omarchy_store_absent(self):
        with mock.patch.object(pulse.shutil, 'which', return_value='/usr/bin/makoctl'), \
             mock.patch.object(pulse, 'mako_history', return_value=[{'title': 'mako'}]):
            self.assertEqual(pulse.notification_history(), [{'title': 'mako'}])

    def test_bounds_and_ignores_non_objects(self):
        self.write('history.json', [None, 'bad'] + [
            {'key': str(i), 'ts': i, 'summary': 's' * 200, 'body': 'b' * 300}
            for i in range(8)])
        items = pulse.notification_history()
        self.assertEqual(len(items), 5)
        self.assertEqual(len(items[0]['title']), 120)
        self.assertEqual(len(items[0]['text']), 160)

if __name__ == '__main__':
    unittest.main()
