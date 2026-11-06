import importlib.machinery
import importlib.util
import json
import tempfile
import time
import types
import unittest
from unittest import mock
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_presence', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)


class PresenceTests(unittest.TestCase):
    def setUp(self):
        self.hub = pulse.Hub()
        self.hub.cfg = {'presence': {'digest_after': 0, 'notify': False}}

    def test_digest_lists_what_happened(self):
        self.hub.set_away(True, 'locked')
        self.hub.raise_alert('nas', 'nas', 'disk 91%', 'warn')
        self.hub.raise_alert('nas', 'nas', 'disk 91%', 'warn')      # the same thing twice: once
        self.hub.set_agent('claude', 'working')
        self.hub.set_agent('claude', 'done')
        self.hub.set_away(False)
        lines = [x['text'] for x in self.hub.digest['lines']]
        self.assertEqual(lines, ['nas · disk 91%', 'claude finished'])

    def test_nothing_is_kept_while_you_are_here(self):
        self.hub.raise_alert('nas', 'nas', 'disk 91%', 'warn')
        self.assertIsNone(self.hub.away)
        self.hub.set_away(False)
        self.assertIsNone(self.hub.digest)

    def test_short_absence_has_no_digest(self):
        self.hub.cfg = {'presence': {'digest_after': 5}}
        self.hub.set_away(True)
        self.hub.set_away(False)
        self.assertIsNone(self.hub.digest)

    def test_news_and_private_notifications(self):
        self.hub.set_away(True)
        later = time.time() + 1
        self.hub.widgets['news'] = {'data': {'items': [{'title': 'Omarchy 4.6', 't': later}, {'title': 'old', 't': 1}]}}
        self.hub.widgets['notifications'] = {'data': {'items': [{'title': 'secret', 't': later}]}}
        self.hub.set_away(False)
        kinds = [x['kind'] for x in self.hub.digest['lines']]
        self.assertEqual(kinds, ['news', 'notifications'])
        self.assertIn('Omarchy 4.6', self.hub.digest['lines'][0]['text'])
        self.hub.privacy_manual = True
        self.assertEqual([x['kind'] for x in self.hub.public_digest()['lines']], ['news'])


class VoiceTests(unittest.TestCase):
    def hub(self, voice):
        h = pulse.Hub()
        h.cfg = {'voice': voice}
        return h

    def test_off_by_default(self):
        h = self.hub({})
        h.say('hello', 'alerts')
        self.assertTrue(h.voice_q.empty())

    def test_on_and_filtered(self):
        h = self.hub({'enabled': True, 'quiet': '', 'events': ['agents']})
        h.say('alert', 'alerts')
        h.say('claude finished', 'agents')
        self.assertEqual(h.voice_q.get_nowait(), 'claude finished')
        self.assertTrue(h.voice_q.empty())

    def test_silent_while_sharing_away_or_focus(self):
        h = self.hub({'enabled': True, 'quiet': ''})
        h.privacy_manual = True
        h.say('x', 'alerts', force=True)
        h.privacy_manual = None
        h.away = {'since': 0, 'events': []}
        h.say('x', 'alerts')
        h.away = None
        h.set_focus(5)
        h.say('x', 'alerts')
        self.assertTrue(h.voice_q.empty())

    def test_the_digest_is_spoken_short(self):
        h = self.hub({'enabled': True, 'quiet': ''})
        h.cfg['presence'] = {'digest_after': 0, 'notify': False}
        h.set_away(True)
        h.raise_alert('lan', 'new device on your network', '10.0.0.57', 'warn')
        h.set_agent('grok', 'done')
        self.assertTrue(h.voice_q.empty())          # nobody is there: nothing is said while away
        h.set_away(False)
        said = h.voice_q.get_nowait()
        self.assertTrue(said.startswith('Welcome back.'))
        self.assertIn('new device on your network; grok finished', said)
        self.assertNotIn('10.0.0.57', said)

    def test_quiet_hours(self):
        at = lambda hh, mm: time.mktime((2026, 11, 6, hh, mm, 0, 0, 0, -1))
        self.assertTrue(pulse.in_quiet_hours('23:00-08:00', at(2, 0)))
        self.assertFalse(pulse.in_quiet_hours('23:00-08:00', at(12, 0)))
        self.assertTrue(pulse.in_quiet_hours('13:00-14:00', at(13, 30)))
        self.assertFalse(pulse.in_quiet_hours('nonsense', at(13, 30)))


class LanTests(unittest.TestCase):
    def run_once(self, neigh, state_dir):
        def fake_run(cmd, **kw):
            out = {'route': [{'gateway': '192.168.1.1', 'dev': 'wlan0'}],
                   'addr': [{'addr_info': [{'local': '192.168.1.42', 'prefixlen': 24}]}],
                   'neigh': neigh}[cmd[3]]
            return types.SimpleNamespace(stdout=json.dumps(out).encode(), returncode=0)
        hub = pulse.Hub()
        hub.cfg = {'lan': {'scan': 'off', 'names': {'aa:aa:aa:aa:aa:05': 'nas'}}}
        with mock.patch.object(pulse, 'STATE_DIR', Path(state_dir)), \
             mock.patch.object(pulse.shutil, 'which', side_effect=lambda x: '/usr/bin/ip' if x == 'ip' else None), \
             mock.patch.object(pulse.subprocess, 'run', side_effect=fake_run), \
             mock.patch.object(pulse, 'reverse_name', return_value=''), \
             mock.patch.object(pulse.time, 'sleep', side_effect=StopIteration):
            with self.assertRaises(StopIteration):
                hub.loop_lan()
        return hub

    def test_first_look_is_the_baseline_then_new_devices_alert(self):
        base = [{'dst': '192.168.1.1', 'lladdr': 'aa:aa:aa:aa:aa:01', 'state': ['REACHABLE']},
                {'dst': '192.168.1.5', 'lladdr': 'aa:aa:aa:aa:aa:05', 'state': ['STALE']},
                {'dst': '192.168.1.9', 'lladdr': 'aa:aa:aa:aa:aa:09', 'state': ['FAILED']}]
        with tempfile.TemporaryDirectory() as d:
            hub = self.run_once(base, d)
            self.assertEqual([x['name'] for x in hub.lan['devices']], ['router', 'nas'])
            self.assertEqual(list(hub.alerts), [])
            hub = self.run_once(base + [{'dst': '192.168.1.77', 'lladdr': 'bb:bb:bb:bb:bb:77', 'state': ['REACHABLE']}], d)
            self.assertEqual(hub.alerts[-1]['title'], 'new device on your network')
            self.assertTrue(next(x for x in hub.lan['devices'] if x['ip'] == '192.168.1.77')['new'])
            self.assertFalse(next(x for x in hub.lan['devices'] if x['ip'] == '192.168.1.5')['new'])
            self.assertNotIn('aa:aa', json.dumps(hub.state()['lan']))   # MAC addresses stay in the hub

    def test_privacy_hides_names(self):
        hub = pulse.Hub()
        hub.lan = {'devices': [{'ip': '10.0.0.5', 'name': 'nas', 'new': False, 'id': 1}], 'net': ''}
        hub.privacy_manual = True
        self.assertEqual(hub.state()['lan'][0]['name'], '')


if __name__ == '__main__':
    unittest.main()
