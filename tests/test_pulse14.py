import datetime as dt
import importlib.machinery
import importlib.util
import json
import math
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_14', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
UTC = dt.timezone.utc


def ts(*a):
    return dt.datetime(*a, tzinfo=UTC).timestamp()


class SkyTests(unittest.TestCase):
    def test_polaris_stands_as_high_as_your_latitude(self):
        for lat in (45.0, 52.5, 30.0):
            az, el = pulse.altaz(37.95, 89.26, lat, 8.6, pulse.julian(ts(2026, 11, 7, 21)))
            self.assertAlmostEqual(el, lat, delta=1.0)

    def test_the_sun_at_the_equinox_and_at_noon(self):
        ra, dec = pulse.sun_radec(pulse.julian(ts(2026, 3, 20, 12)))
        self.assertAlmostEqual(dec, 0, delta=0.6)
        ra, dec = pulse.sun_radec(pulse.julian(ts(2026, 6, 21, 12)))
        self.assertAlmostEqual(dec, 23.44, delta=0.3)
        az, el = pulse.altaz(*pulse.sun_radec(pulse.julian(ts(2026, 6, 21, 11, 26))), 45.0, 8.6, pulse.julian(ts(2026, 6, 21, 11, 26)))
        self.assertAlmostEqual(el, 90 - 45 + 23.44, delta=1.0)   # at noon, due south
        self.assertAlmostEqual(az, 180, delta=6)

    def test_moon_phases(self):
        self.assertGreater(pulse.moon_phase(pulse.julian(ts(2026, 10, 26, 4)))['lit'], 0.97)   # full moon
        p = pulse.moon_phase(pulse.julian(ts(2026, 11, 9, 7)))
        self.assertLess(p['lit'], 0.03)   # new moon
        self.assertTrue(pulse.moon_phase(pulse.julian(ts(2026, 11, 13, 12)))['waxing'])

    def test_planets_where_they_are(self):
        jd = pulse.julian(ts(2026, 11, 7, 21))
        ra, dec = pulse.planet_radec('saturn', jd)
        self.assertTrue(ra < 20 or ra > 350, ra)   # Saturn in Pisces in autumn 2026
        ra, dec = pulse.planet_radec('jupiter', jd)
        self.assertTrue(130 < ra < 160, ra)        # Jupiter in Cancer / Leo
        sun = pulse.sun_radec(jd)[0]
        v = pulse.planet_radec('venus', jd)[0]
        self.assertLess(abs((v - sun + 180) % 360 - 180), 47)   # Venus never far from the Sun

    def test_the_whole_sky_and_the_showers(self):
        s = pulse.night_sky(45.0, 8.6, ts(2026, 11, 7, 21))
        self.assertLess(s['sun']['el'], -18)
        self.assertGreater(len(s['stars']), 20)
        for a, b in s['lines']:
            self.assertLess(max(a, b), len(s['stars']))
        self.assertIn('PEGASUS', [n['n'] for n in s['names']])
        self.assertEqual(pulse.meteor_shower(ts(2026, 8, 12, 23))['name'], 'Perseids')
        self.assertEqual(pulse.meteor_shower(ts(2026, 12, 14, 2))['name'], 'Geminids')
        self.assertIsNone(pulse.meteor_shower(ts(2026, 9, 1)))


OMM = [{'OBJECT_NAME': f'STARLINK-{i}', 'OBJECT_ID': f'2026-246{chr(65 + i)}', 'EPOCH': '2026-11-07T06:00:00.000',
        'MEAN_MOTION': 15.8, 'ECCENTRICITY': 0.0002, 'INCLINATION': 43.0, 'RA_OF_ASC_NODE': 120.0 + i * 0.01,
        'ARG_OF_PERICENTER': 90.0, 'MEAN_ANOMALY': 10.0 + i * 0.4, 'MEAN_MOTION_DOT': 0.001} for i in range(8)]


class StarlinkTests(unittest.TestCase):
    def test_groups_and_a_look(self):
        rows = OMM + [{'OBJECT_NAME': 'FALCON 9 DEB', 'OBJECT_ID': '2026-246Z'}]
        g = pulse.starlink_groups(rows)
        self.assertEqual(list(g), ['2026-246'])
        self.assertEqual(len(g['2026-246']), 8)
        az, el, lit = pulse.sat_look(dict(OMM[0]), 45.0, 8.6, ts(2026, 11, 7, 18))
        self.assertTrue(0 <= az < 360 and -90 <= el <= 90)
        x, y, z = pulse.sat_eci(dict(OMM[0]), ts(2026, 11, 7, 18))
        self.assertAlmostEqual(math.sqrt(x * x + y * y + z * z), 6378 + 330, delta=60)   # about 330 km up

    def test_passes_are_dark_lit_and_high(self):
        g = pulse.starlink_groups(OMM)
        for p in pulse.starlink_passes(g, 45.0, 8.6, ts(2026, 11, 7, 12), 24, 60):
            self.assertGreaterEqual(p['max_el'], 10)
            mid = (p['start'] + p['end']) / 2
            self.assertLess(pulse.altaz(*pulse.sun_radec(pulse.julian(mid)), 45.0, 8.6, pulse.julian(mid))[1], -6)


class AirStormTests(unittest.TestCase):
    def test_air_levels_and_pollen(self):
        a = pulse.air_view({'european_aqi': 72, 'pm2_5': 31, 'grass_pollen': 80, 'birch_pollen': 3})
        self.assertEqual((a['level'], a['pollen'], a['pollenLevel']), ('poor', 'grass', 'high'))
        self.assertEqual(pulse.air_view({'european_aqi': 12})['level'], 'good')
        self.assertIsNone(pulse.air_view({})['level'])

    def test_ring_points(self):
        la, lo = pulse.ring_point(45.0, 8.6, 90, 30)
        self.assertAlmostEqual(la, 45.0, delta=0.02)
        self.assertGreater(lo, 8.6)
        self.assertEqual(pulse.compass(260), 'west')


class LightsTests(unittest.TestCase):
    def test_an_effect_puts_every_light_back(self):
        hub = pulse.Hub()
        hub.cfg = {'lights': {'enabled': True, 'lights': ['light.a', 'light.b']}}
        states = {'light.a': {'on': True, 'bri': 120, 'rgb': [255, 200, 150], 'mired': None},
                  'light.b': {'on': False, 'bri': None, 'rgb': None, 'mired': None}}
        calls = []
        with mock.patch.object(hub, 'light_get', side_effect=lambda e: dict(states[e])), \
             mock.patch.object(hub, 'light_set', side_effect=lambda e, *a, **k: calls.append((e, a, k))), \
             mock.patch.object(pulse.time, 'sleep'):
            hub.room_effect('doorbell')
            for _ in range(50):
                if not hub.room_lock.locked():
                    break
                time.sleep(0.02)
        self.assertTrue(calls)
        self.assertTrue(all(c[0] == 'light.a' for c in calls))   # the light that was off stays off
        self.assertEqual(calls[-1][2].get('back'), states['light.a'])

    def test_hue_colour(self):
        x, y = pulse.rgb_to_xy((255, 255, 255))
        self.assertAlmostEqual(x, 0.3127, delta=0.002)
        self.assertAlmostEqual(y, 0.329, delta=0.002)

    def test_alexa_says_it(self):
        hub = pulse.Hub()
        with mock.patch.object(hub, 'ha') as ha:
            hub.speakers_say('Someone is at the door.', ['notify.alexa_media_echo'], {})
        ha.assert_called_with('/api/services/notify/alexa_media_echo', {'message': 'Someone is at the door.', 'data': {'type': 'announce'}})


class SoundWrappedTests(unittest.TestCase):
    def test_sound_is_off_unless_asked_and_quiet_in_meetings(self):
        self.assertIsNone(pulse.sound_conf({}))
        self.assertEqual(pulse.sound_conf({'enabled': True, 'quiet': ''}, meeting=True)['volume'], 0)
        self.assertEqual(pulse.sound_conf({'enabled': True, 'quiet': '', 'volume': 3})['volume'], 1.0)

    def test_stats_and_cards(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(pulse, 'STATE_DIR', Path(d)):
            hub = pulse.Hub()
            for _ in range(3):
                hub.stat('planes', unique='abc123')
            hub.stat('planes', unique='def456')
            hub.stat('focus')
            st = pulse.year_stats(time.strftime('%Y'))
            self.assertEqual(st['planes'], 2)
            self.assertNotIn('_planes', st)
            cards = pulse.wrapped_cards('2026', {'focus': 120, 'focus_min': 3000, 'planes': 4210, 'quakes': 3}, {'n': 120, 'best': 21})
            self.assertTrue(cards[0].startswith('YOUR 2026'))
            self.assertTrue(any('4,210 planes' in c for c in cards))
            self.assertTrue(cards[-1].endswith('2027'))



class PhoneVoiceTests(unittest.TestCase):
    def test_phone_push_is_json_and_respects_details(self):
        hub = pulse.Hub()
        hub.cfg = {'phone': {'enabled': True, 'topic': 'pulse-secret', 'details': False}}
        sent = []
        class T:
            def __init__(self, target, daemon): self.t = target
            def start(self): self.t()
        with mock.patch.object(pulse.threading, 'Thread', T), \
             mock.patch.object(pulse.urllib.request, 'urlopen', side_effect=lambda req, timeout: sent.append(req) or mock.MagicMock()):
            hub.phone('calendar', 'In 5 minutes', 'board meeting', 'calendar', private_text=True)
            hub.phone('weather', 'not an event')
        self.assertEqual(len(sent), 1)
        body = json.loads(sent[0].data)
        self.assertEqual((body['topic'], body['title']), ('pulse-secret', 'In 5 minutes'))
        self.assertNotIn('board', body['message'])   # details = false: no titles on the phone

    def test_ask_the_moon_and_your_year(self):
        hub = pulse.Hub()
        hub.night = pulse.night_sky(45.0, 8.6, ts(2026, 11, 15, 17, 30))
        self.assertIn('waxing crescent', hub.voice_command('hey sphere, how is the moon?'))
        self.assertIn('crescente', hub.voice_command('ehi sfera, com\'è la luna?'))
        self.assertIn('focus sessions', hub.voice_command('hey sphere, my year'))



class RobotTests(unittest.TestCase):
    def test_containers_and_bots_walk(self):
        out = '{"ID":"a1","Names":"postgres","Status":"Up 2 hours (healthy)"}\n{"ID":"b2","Names":"web","Status":"Up 1 minute (unhealthy)"}\n' \
              '{"ID":"c3","Names":"old","Status":"Exited (0) 3 days ago"}'
        r = pulse.containers(out)
        self.assertEqual([(x['name'], x['health']) for x in r], [('postgres', 'ok'), ('web', 'bad')])
        self.assertEqual(pulse.containers('[{"Id":"x","Names":["n8n"],"State":"running"}]')[0]['name'], 'n8n')   # podman
        hub = pulse.Hub()
        hub.robots = r
        hub.set_bot('grok-bot', 'working')
        allr = hub.all_robots()
        self.assertTrue(allr[0]['bot'] and allr[0]['busy'])
        hub.set_bot('grok-bot', 'gone')
        self.assertEqual(len(hub.all_robots()), 2)



class BannerTests(unittest.TestCase):
    def test_a_new_omarchy_flies_by(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(pulse, 'STATE_DIR', Path(d)):
            hub = pulse.Hub()
            hub.omarchy_release('v4.5.0')            # the first look only remembers it
            self.assertFalse(any(f['kind'] == 'banner' for f in hub.fx))
            hub.omarchy_release('v4.6.0')
            self.assertEqual(hub.fx[-1]['kind'], 'banner')
            self.assertEqual(hub.fx[-1]['text'], 'OMARCHY 4.6.0 IS OUT')
            self.assertTrue((pulse.WEB / 'omarchy.png').is_file())
            self.assertIn('WE CAN FIX EVERYTHING', hub.state()['ui']['banner'])


if __name__ == '__main__':
    unittest.main()
