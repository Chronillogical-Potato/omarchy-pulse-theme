import importlib.machinery
import importlib.util
import json
import subprocess
import tempfile
import time
import unittest
from unittest import mock
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_12', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
JS = (Path(__file__).resolve().parents[1] / 'extras/pulse/web/pulse.js').read_text()


class CityTests(unittest.TestCase):
    def test_names_in_any_language(self):
        for name, key in [('Alessandria', 'alessandria'), ('Roma', 'rome'), ('New York', 'new-york'),
                          ('São Paulo', 'sao-paulo'), ('München', 'munich'), ('Torino', 'turin'), ('Atlantis', '')]:
            self.assertEqual(pulse.city_key(name), key)

    def test_every_city_has_a_drawing(self):
        for key in pulse.CITY_KEYS:
            self.assertIn(f'"{key}": [[', JS)
        self.assertGreaterEqual(len(pulse.CITY_KEYS), 90)

    def test_auto_follows_the_weather_but_not_while_sharing(self):
        hub = pulse.Hub()
        hub.weather = {'city': 'Milano'}
        self.assertEqual(hub.skyline(), 'milan')
        hub.privacy_manual = True
        self.assertEqual(hub.skyline(), '')
        hub.cfg = {'pulse': {'skyline': 'tokyo'}}
        self.assertEqual(hub.skyline(), 'tokyo')
        hub.cfg = {'pulse': {'skyline': 'off'}}
        self.assertEqual(hub.skyline(), '')


class GitTests(unittest.TestCase):
    def test_a_real_repository(self):
        with tempfile.TemporaryDirectory() as d:
            run = lambda *a: subprocess.run(['git', '-C', d, *a], capture_output=True, check=True)
            run('init', '-q')
            run('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'one')
            run('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'two')
            info = pulse.git_info(Path(d))
            self.assertEqual(info['week'], 2)
            self.assertEqual(info['up'], '')
            self.assertIsNone(pulse.git_info(Path(d) / 'nope'))

    def test_github_slug(self):
        self.assertEqual(pulse.github_slug('git@github.com:piermark/omarchytv.git'), 'piermark/omarchytv')
        self.assertEqual(pulse.github_slug('https://github.com/piermark/omarchy-pulse-theme'), 'piermark/omarchy-pulse-theme')
        self.assertEqual(pulse.github_slug('https://gitlab.com/a/b'), '')


class SpaceTests(unittest.TestCase):
    def test_straight_up_and_on_the_horizon(self):
        az, el = pulse.look_angles(45.0, 9.0, 45.0, 9.0, 420)
        self.assertGreater(el, 89)
        az, el = pulse.look_angles(45.0, 9.0, 45.0, 60.0, 420)   # far to the east, below the horizon
        self.assertLess(el, 0)
        self.assertTrue(60 < az < 120)

    def test_iss_between_two_points(self):
        track = [{'timestamp': 100, 'latitude': 0, 'longitude': 179, 'altitude': 400},
                 {'timestamp': 160, 'latitude': 2, 'longitude': -179, 'altitude': 410}]
        p = pulse.iss_at(track, 130)
        self.assertAlmostEqual(p['latitude'], 1)
        self.assertAlmostEqual(abs(p['longitude']), 180)   # across the date line, not the long way round
        self.assertIsNone(pulse.iss_at(track, 500))

    def test_kp_in_both_formats(self):
        self.assertEqual(pulse.latest_kp([{'time_tag': 't', 'Kp': 5.33}]), 5.33)
        self.assertEqual(pulse.latest_kp([['time_tag', 'Kp'], ['t', '2.67']]), 2.67)
        self.assertIsNone(pulse.latest_kp([]))


class HeartTests(unittest.TestCase):
    def test_values(self):
        self.assertEqual(pulse.heart_value('72'), 72)
        self.assertEqual(pulse.heart_value('{"state": "64.0"}'), 64)
        self.assertEqual(pulse.heart_value('{"a": {"bpm": 81}}', 'a.bpm'), 81)
        self.assertIsNone(pulse.heart_value('3'))

    def test_hidden_while_sharing_and_when_stale(self):
        hub = pulse.Hub()
        hub.heart = {'bpm': 70, 't': time.time()}
        self.assertEqual(hub.state()['heart'], 70)
        hub.privacy_manual = True
        self.assertIsNone(hub.state()['heart'])
        hub.privacy_manual = None
        hub.heart['t'] -= 300
        self.assertIsNone(hub.state()['heart'])


class CrewTests(unittest.TestCase):
    CODE = 'a-long-enough-crew-code'

    def test_sealed_and_tamper_proof(self):
        msg = pulse.crew_seal(self.CODE, {'ev': 'agent', 'state': 'done'})
        self.assertNotIn('done', msg)
        self.assertEqual(pulse.crew_open(self.CODE, msg)['state'], 'done')
        with self.assertRaises(ValueError):
            pulse.crew_open('another-crew-code-xx', msg)
        raw = bytearray(pulse.base64.urlsafe_b64decode(msg))
        raw[20] ^= 1
        with self.assertRaises(ValueError):
            pulse.crew_open(self.CODE, pulse.base64.urlsafe_b64encode(bytes(raw)).decode())

    def test_only_the_agent_kind_leaves_by_default(self):
        hub = pulse.Hub()
        hub.crew_code = self.CODE
        hub.cfg = {'crew': {'name': 'marco'}}
        hub.set_agent('claude · secret-project', 'working')
        hub.set_agent('claude · secret-project', 'working', 'still')
        self.assertEqual(hub.crew_q.qsize(), 1)
        code, payload = hub.crew_q.get_nowait()
        self.assertEqual((payload['agent'], payload['state'], payload['name']), ('claude', 'working', 'marco'))
        self.assertNotIn('secret', json.dumps(payload))

    def test_together_in_one_message(self):
        hub = pulse.Hub()
        code = 'a-long-enough-crew-code'
        for st in ('working', 'done'):
            hub.crew_q.put((code, {'v': 1, 'id': 'me', 'name': 'marco', 't': time.time(), 'ev': 'agent', 'agent': 'claude', 'state': st}))
        bodies = []
        with mock.patch.object(pulse.urllib.request, 'urlopen', side_effect=lambda req, timeout: bodies.append(req.data) or mock.Mock(read=lambda: b'')), \
             mock.patch.object(pulse.time, 'sleep', side_effect=[None, StopIteration]):
            with self.assertRaises(StopIteration):
                hub.loop_crew_send()
        self.assertEqual(len(bodies), 1)
        friend = pulse.Hub()
        friend.crew_receive(pulse.crew_open(code, bodies[0].decode()))
        self.assertEqual(friend.crew_agents['marco · claude']['state'], 'done')

    def test_the_relay_says_too_many_then_it_goes(self):
        hub = pulse.Hub()
        hub.crew_q.put(('a-long-enough-crew-code', {'ev': 'fx'}))
        calls = []

        def urlopen(req, timeout):
            calls.append(req)
            if len(calls) == 1:
                raise pulse.urllib.error.HTTPError(req.full_url, 429, 'Too Many Requests', {}, None)
            return mock.Mock(read=lambda: b'')
        with mock.patch.object(pulse.urllib.request, 'urlopen', side_effect=urlopen), \
             mock.patch.object(pulse.time, 'sleep', side_effect=[None, None, StopIteration]):
            with self.assertRaises(StopIteration):
                hub.loop_crew_send()
        self.assertEqual(len(calls), 2)

    def test_a_friend_lands_with_fireworks(self):
        hub = pulse.Hub()
        now = time.time()
        hub.crew_receive({'id': 'x', 'name': 'luca', 't': now, 'ev': 'agent', 'agent': 'claude', 'state': 'working'})
        hub.crew_receive({'id': 'x', 'name': 'luca', 't': now, 'ev': 'agent', 'agent': 'claude', 'state': 'done'})
        self.assertEqual(hub.crew_agents['luca · claude']['state'], 'done')
        self.assertEqual(hub.fx[-1]['kind'], 'fireworks')
        hub.crew_receive({'id': 'x', 'name': '<b>', 't': now - 900, 'ev': 'fx', 'text': 'old'})   # too old: ignored
        self.assertEqual(len(hub.fx), 1)
        hub.crew_receive({'id': hub.crew_id, 'name': 'me', 't': now, 'ev': 'fx', 'text': 'mine'})   # my own echo
        self.assertEqual(len(hub.fx), 1)


class LaunchTests(unittest.TestCase):
    def test_parse_and_countdown(self):
        x = pulse.parse_launch({'id': 'x', 'name': 'Falcon 9 Block 5 | Starlink 12-4', 'net': '2026-11-07T00:48:42Z',
                                'status': {'abbrev': 'Go'}})
        self.assertEqual((x['rocket'], x['mission'], x['status']), ('Falcon 9', 'Starlink 12-4', 'Go'))
        self.assertEqual(pulse.countdown(3725), 'T-1h 02m')
        self.assertEqual(pulse.countdown(65), 'T-1m 05s')
        self.assertEqual(pulse.countdown(-5), 'liftoff')
        self.assertIsNone(pulse.parse_launch({'name': 'x', 'net': 'soon'}))


class VoiceCommandTests(unittest.TestCase):
    def setUp(self):
        self.hub = pulse.Hub()

    def test_focus_in_two_languages(self):
        self.assertIn('25', self.hub.voice_command('Hey sphere, focus for 25 minutes'))
        self.assertEqual(round((self.hub.focus['until'] - self.hub.focus['start']) / 60), 25)
        self.assertIn('Focus', self.hub.voice_command('ehi sfera ferma il focus'))
        self.assertIsNone(self.hub.focus)
        self.assertIn('minuti', self.hub.voice_command('ehi sfera metti un focus di 10 minuti'))

    def test_status_and_privacy(self):
        self.hub.widgets = {'nas': {'id': 'nas', 'title': 'nas', 'level': 'crit'}, 'web': {'id': 'web', 'level': 'ok'}}
        self.assertIn('nas', self.hub.voice_command('how are my servers?'))
        self.hub.voice_command('privacy on')
        self.assertTrue(self.hub.privacy())
        self.hub.voice_command('privacy off')
        self.assertFalse(self.hub.privacy())

    def test_city_as_whisper_writes_it(self):
        self.assertIn('Tokyo', self.hub.voice_command('Hey, Sphere, City, Tokyo.'))
        self.assertEqual(self.hub.skyline(), 'tokyo')
        self.assertIn('Roma', self.hub.voice_command('Ehi sfera, città: Roma.'))
        self.assertEqual(self.hub.skyline(), 'rome')

    def test_unknown_is_never_run(self):
        with mock.patch.object(pulse.subprocess, 'run') as run:
            ans = self.hub.voice_command('delete all my files')
        run.assert_not_called()
        self.assertIn('I can', ans)


if __name__ == '__main__':
    unittest.main()
