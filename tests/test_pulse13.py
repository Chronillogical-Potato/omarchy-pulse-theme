import importlib.machinery
import importlib.util
import json
import shutil
import tempfile
import time
import unittest
from unittest import mock
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_13', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
DAY = 86400


class GrowthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(pulse, 'STATE_DIR', Path(self.tmp.name))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_streak(self):
        now = time.time()
        self.assertEqual(pulse.growth_streak([now, now - DAY, now - 2 * DAY, now - 4 * DAY], now), 3)
        self.assertEqual(pulse.growth_streak([now - DAY, now - 2 * DAY], now), 2)   # today has none yet: still alive
        self.assertEqual(pulse.growth_streak([now - 3 * DAY], now), 0)

    def test_a_finished_focus_builds_and_a_week_makes_a_monument(self):
        hub = pulse.Hub()
        now = time.time()
        old = [{'t': int(now - k * DAY), 'm': 25, 'label': 'x'} for k in range(1, 7)]
        (Path(self.tmp.name) / 'city.json').write_text(json.dumps({'buildings': old, 'best': 6}))
        hub.set_focus(25, 'write')
        hub.focus['start'], hub.focus['until'] = time.time() - 25 * 60 - 1, time.time() - 1   # 25 minutes, just ended
        with mock.patch.object(pulse.shutil, 'which', return_value=None):
            hub.check_focus()
        g = hub.growth_state()
        self.assertEqual((g['n'], g['streak'], g['best'], g['monuments'], g['lit']), (7, 7, 7, 1, True))
        self.assertIn('monument', hub.fx[-1]['text'])

    def test_short_or_stopped_focus_builds_nothing(self):
        hub = pulse.Hub()
        hub.grow(5, 'quick')
        hub.set_focus(25)
        hub.set_focus(0)   # stopped before the end
        self.assertEqual(hub.growth_state()['n'], 0)


class SkyTests(unittest.TestCase):
    def test_route_of_a_flight_kept_for_a_day(self):
        hub = pulse.Hub()
        fr = {'response': {'flightroute': {'airline': {'name': 'Some Air'},
              'origin': {'iata_code': 'FCO', 'municipality': 'Rome'}, 'destination': {'iata_code': 'LHR', 'municipality': 'London'}}}}
        with mock.patch.object(pulse, 'http_json', return_value=fr) as h:
            r = hub.flight_route('AZA614')
            self.assertEqual((r['from'], r['to'], r['toCity']), ('FCO', 'LHR', 'London'))
            self.assertEqual(hub.flight_route('AZA614'), r)
            self.assertEqual(h.call_count, 1)
            self.assertEqual(hub.flight_route('N123AB'), {})   # a private plane: no lookup
            self.assertEqual(h.call_count, 1)

    def test_planes_in_your_sky(self):
        raw = [{'hex': 'a', 'flight': 'AZA614 ', 'lat': 45.05, 'lon': 7.70, 'alt': 34000, 'gs': 460, 'track': 90},
               {'hex': 'b', 'flight': 'X', 'lat': 45.0, 'lon': 7.7, 'alt': 'ground', 'ground': True},
               {'hex': 'c', 'flight': 'FAR', 'lat': 46.5, 'lon': 9.5, 'alt': 3000}]   # below your horizon
        p = pulse.planes_over(45.07, 7.69, raw)
        self.assertEqual([x['flight'] for x in p], ['AZA614'])
        self.assertGreater(p[0]['el'], 60)

    def test_distance_and_bearing(self):
        d, b = pulse.distance_bearing(41.9, 12.5, 35.7, 139.7)   # Rome to Tokyo
        self.assertTrue(9700 < d < 10000)
        self.assertTrue(20 < b < 60)


class CalendarTests(unittest.TestCase):
    def ics(self, body):
        return "BEGIN:VCALENDAR\r\n" + body + "END:VCALENDAR\r\n"

    def test_events_repeats_and_what_is_skipped(self):
        import datetime as dt
        base = dt.datetime(2026, 11, 9, 9, 30)   # a Monday
        ts = lambda d: time.mktime(d.timetuple())
        text = self.ics(
            "BEGIN:VEVENT\r\nSUMMARY:Standup\r\nDTSTART:20261109T093000\r\nDTEND:20261109T094500\r\n"
            "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\nEXDATE:20261111T093000\r\nEND:VEVENT\r\n"
            "BEGIN:VEVENT\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261110\r\nEND:VEVENT\r\n"
            "BEGIN:VEVENT\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20261110T120000\r\nEND:VEVENT\r\n"
            "BEGIN:VEVENT\r\nSUMMARY:Call\\, with Luca\r\nDTSTART:20261110T130000Z\r\nEND:VEVENT\r\n")
        evs = pulse.ics_events(text, ts(base) - 60, ts(base + dt.timedelta(days=7)))
        titles = sorted((e['title'], time.strftime('%a', time.localtime(e['start']))) for e in evs)
        self.assertIn(('Standup', 'Mon'), titles)
        self.assertIn(('Standup', 'Fri'), titles)
        self.assertNotIn(('Standup', 'Wed'), titles)             # the exception date
        self.assertNotIn('Holiday', [t for t, _ in titles])      # all day: no train
        self.assertNotIn('Gone', [t for t, _ in titles])         # cancelled
        self.assertIn('Call, with Luca', [t for t, _ in titles])
        standup = next(e for e in evs if e['title'] == 'Standup')
        self.assertEqual(standup['end'] - standup['start'], 900)

    def test_a_command(self):
        evs = pulse.command_events('[{"title": "review", "start": "2026-11-07T15:00:00+01:00"}, {"nope": 1}]')
        self.assertEqual(len(evs), 1)
        self.assertEqual(evs[0]['end'] - evs[0]['start'], 1800)


class MeetingTests(unittest.TestCase):
    def test_privacy_while_a_meeting_runs(self):
        hub = pulse.Hub()
        self.assertFalse(hub.privacy())
        hub.in_meeting = True
        self.assertTrue(hub.privacy())
        hub.cfg = {'calendar': {'privacy': False}}
        self.assertFalse(hub.privacy())

    def test_the_day_summary(self):
        lt = time.localtime()
        d0 = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))
        evs = [{'start': d0 + 9 * 3600, 'end': d0 + 10 * 3600}, {'start': d0 + 9.5 * 3600, 'end': d0 + 10.5 * 3600},   # overlap
               {'start': d0 + 14 * 3600, 'end': d0 + 14 * 3600 + 1200}, {'start': d0 + 2 * 86400, 'end': d0 + 2 * 86400 + 600}]
        self.assertEqual(pulse.day_summary(evs, d0 + 20 * 3600), 'today: 3 meetings · 1 h 50 min')
        self.assertEqual(pulse.day_summary([], d0), '')


class HomeTests(unittest.TestCase):
    def test_a_light_click_toggles_only_configured_lights(self):
        hub = pulse.Hub()
        hub.home_lights = ['light.living', 'switch.fan']
        with mock.patch.object(hub, 'ha') as ha:
            self.assertTrue(hub.click('home', 1))
            ha.assert_called_once_with('/api/services/switch/toggle', {'entity_id': 'switch.fan'})
            self.assertFalse(hub.click('home', 5))

    def test_the_doorbell(self):
        hub = pulse.Hub()
        with mock.patch.object(pulse.shutil, 'which', return_value=None):
            hub.doorbell()
        self.assertTrue(hub.state()['ring'])
        self.assertEqual(hub.fx[-1]['kind'], 'doorbell')
        hub.privacy_manual = True
        self.assertFalse(hub.state()['ring'])   # no door camera while sharing the screen


class QuakeTests(unittest.TestCase):
    def test_fx_carries_only_numbers_it_knows(self):
        hub = pulse.Hub()
        hub.add_fx('quake', 'M6.6', mag=6.6, az=110, near=0, evil='x', other=3)
        f = hub.fx[-1]
        self.assertEqual((f['mag'], f['az'], f['near']), (6.6, 110, 0))
        self.assertNotIn('evil', f)
        self.assertNotIn('other', f)

    def test_tsunami_far_is_shown_near_is_a_red_alert(self):
        hub = pulse.Hub()
        with mock.patch.object(hub, 'say') as say, mock.patch.object(hub, 'raise_alert') as alert:
            hub.quake_event(7.4, 'off the coast of Japan', 9200, 40, tsunami=True)
            self.assertEqual(hub.fx[-1]['tsunami'], 1)
            self.assertIn('TSUNAMI', hub.fx[-1]['text'])
            alert.assert_not_called()
            self.assertIn('tsunami', say.call_args[0][0])
            hub.quake_event(6.9, 'Ionian Sea', 600, 120, tsunami=True)
            self.assertEqual(alert.call_args[0][0], 'tsunami')
            self.assertEqual(alert.call_args[0][3], 'crit')
            hub.quake_event(4.2, 'near you', 80, 200)
            self.assertEqual(alert.call_args[0][0], 'quake')
            self.assertEqual(hub.fx[-1]['tsunami'], 0)


class TimelapseTests(unittest.TestCase):
    def test_frames_and_video(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(pulse, 'STATE_DIR', Path(d)):
            hub = pulse.Hub()
            self.assertFalse(hub.timelapse_frame('0,0', b'not a jpeg'))
            hub.privacy_manual = True
            self.assertFalse(hub.timelapse_frame('0,0', b'\xff\xd8x'))
            hub.privacy_manual = None
            if not shutil.which('ffmpeg'):
                self.skipTest('no ffmpeg')
            import subprocess
            day = time.strftime('%Y-%m-%d')
            folder = Path(d) / 'timelapse' / day / '0,0'
            folder.mkdir(parents=True)
            for i in range(6):
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', f'color=c=0x{i}0{i}0a0:s=64x36', '-frames:v', '1',
                                str(folder / f'1200{i:02d}.jpg')], check=True)
            out = pulse.make_timelapse(day, {'dir': d + '/videos'}, keep=False)
            self.assertTrue(out and out.stat().st_size > 0)
            self.assertFalse(folder.exists())


class FixesTests(unittest.TestCase):
    def test_dmabuf_crashing_twice_turns_it_off(self):
        with tempfile.TemporaryDirectory() as d:
            st = Path(d)
            with mock.patch.object(pulse, 'log'):
                self.assertTrue(pulse.dmabuf_guard(True, st))    # first start
                self.assertTrue(pulse.dmabuf_guard(True, st))    # it died at once: try again
                self.assertFalse(pulse.dmabuf_guard(True, st))   # twice: off
                self.assertTrue((st / 'dmabuf-crash').exists())
                self.assertFalse(pulse.dmabuf_guard(True, st))   # and it stays off
            self.assertFalse(pulse.dmabuf_guard(False, st))

    def test_perf_probe(self):
        hub = pulse.Hub()
        hub.perf_probe = time.time() + 10
        self.assertTrue(hub.state()['perfProbe'])
        hub.set_perf({'mon': '0,0', 'fps': 30, 'gap': 33, 'draw': 4, 'probe': True, 'bound': False})
        self.assertIn('0,0', hub.perf['_probe'])


if __name__ == '__main__':
    unittest.main()


TESSIE = {'results': [{'vin': 'VIN1', 'is_active': True, 'last_state': {
    'display_name': 'Seneca',
    'charge_state': {'battery_level': 64, 'battery_range': 200.0, 'charging_state': 'Charging', 'charge_limit_soc': 80,
                     'minutes_to_full_charge': 95, 'charger_power': 11},
    'vehicle_state': {'locked': True}, 'climate_state': {'is_climate_on': False, 'inside_temp': 19.5},
    'drive_state': {'shift_state': 'P', 'latitude': 45.0, 'longitude': 8.0}}}]}


class CarTests(unittest.TestCase):
    def test_tessie_reads_the_car_never_its_position(self):
        hub = pulse.Hub()
        with mock.patch.object(hub, 'tessie', return_value=TESSIE):
            v = hub.car_read({'source': 'tessie'})
        self.assertEqual((v['battery'], v['state'], v['unit'], v['locked']), (64, 'Charging', 'km', True))
        self.assertAlmostEqual(v['range'], 321.8, places=1)   # Tesla gives miles
        self.assertNotIn('latitude', json.dumps(v))
        self.assertNotIn('VIN1', json.dumps(v))

    def test_charged_is_said_and_unlock_needs_your_ok(self):
        hub = pulse.Hub()
        a = pulse.car_view(70, 300, True, 'Charging', 80, 30, 11, True, False, 19, False)
        b = pulse.car_view(80, 340, True, 'Complete', 80, 0, 0, True, False, 19, False)
        with mock.patch.object(hub, 'say') as say:
            hub.car_events({**a, 'name': 'car'}, {**b, 'name': 'car'}, {})
        self.assertIn('charged', say.call_args[0][0])
        self.assertEqual(hub.fx[-1]['kind'], 'car')
        hub.cfg = {'car': {'enabled': True}}
        self.assertFalse(hub.car_command('unlock'))
        self.assertFalse(hub.car_command('rm -rf'))
        self.assertTrue(hub.car_allowed('start_charging'))
        hub.cfg = {}
        self.assertFalse(hub.car_allowed('start_charging'))   # no [car]: nothing is sent

    def test_widget_items_match_commands(self):
        hub = pulse.Hub()
        hub.car = {**pulse.car_view(64, 312, True, 'Charging', 80, 95, 11, False, True, 19, False), 'name': 'car'}
        hub.car_widget({})
        self.assertEqual(hub.car_cmds, ['', 'stop_charging', 'lock', 'stop_climate'])
        self.assertEqual(len(hub.widgets['car']['data']['items']), 4)

    def test_voice(self):
        hub = pulse.Hub()
        hub.car = {**pulse.car_view(64, 312, True, 'Charging', 80, 95, 11, True, False, 19, False), 'name': 'car'}
        self.assertIn('64 percent', hub.voice_command('hey sphere, how is my car?'))


class VoiceLanguageTests(unittest.TestCase):
    def test_every_phrase_in_every_language(self):
        for key, p in pulse.PHRASES.items():
            for lang in pulse.LANGS:
                self.assertIn(lang, p, key)
        self.assertEqual(pulse.phrase('door', 'it'), "C'è qualcuno alla porta.")
        self.assertEqual(pulse.phrase('door', 'xx'), 'Someone is at the door.')
        self.assertEqual(pulse.spoken_duration(200, 'it'), '3 ore 20 minuti')
        self.assertEqual(pulse.spoken_duration(61, 'en'), '1 hour 1 minute')
        self.assertEqual(pulse.spoken_duration(45, 'de'), '45 Minuten')

    def test_placeholders_match(self):
        import string
        for key, p in pulse.PHRASES.items():
            want = {f for _, f, _, _ in string.Formatter().parse(p['en']) if f}
            for lang in pulse.LANGS:
                self.assertEqual({f for _, f, _, _ in string.Formatter().parse(p[lang]) if f} - want, set(), (key, lang))

    def test_the_hub_speaks_your_language(self):
        hub = pulse.Hub()
        hub.cfg = {'voice': {'language': 'it'}}
        with mock.patch.object(hub, 'say') as say:
            hub.quake_event(6.8, 'off the coast of Japan', 9600, 40, tsunami=True)
        self.assertEqual(say.call_args[0][0], "Terremoto di magnitudo 6.8, off the coast of Japan. È stato emesso un avviso di tsunami.")
        self.assertEqual(pulse.day_totals([{'start': time.time() - 7200, 'end': time.time() - 3600}], time.time())[0], 1)

    def test_a_voice_of_your_language_first(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'piper').mkdir()
            for n in ('en_US-lessac-medium.onnx', 'it_IT-paola-medium.onnx'):
                (Path(d) / 'piper' / n).write_text('x')
            with mock.patch.dict(pulse.os.environ, {'XDG_DATA_HOME': d}):
                self.assertTrue(pulse.voice_model({'language': 'it'}).endswith('it_IT-paola-medium.onnx'))
                self.assertTrue(pulse.voice_model({}).endswith('en_US-lessac-medium.onnx'))
