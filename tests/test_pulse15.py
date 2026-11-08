import calendar
import importlib.machinery
import importlib.util
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

path = Path(__file__).resolve().parents[1] / 'extras/pulse/omarchy-pulse'
loader = importlib.machinery.SourceFileLoader('pulse_15', str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)
ha_path = Path(__file__).resolve().parents[1] / 'community/homeassistant/pulse-homeassistant'
ha_loader = importlib.machinery.SourceFileLoader('pulse_ha', str(ha_path))
ha_spec = importlib.util.spec_from_loader(ha_loader.name, ha_loader)
ha = importlib.util.module_from_spec(ha_spec)
ha_loader.exec_module(ha)


def ts(y, mo, d, h=0, mi=0, s=0):
    return float(calendar.timegm((y, mo, d, h, mi, s)))


class EclipseTests(unittest.TestCase):
    # known eclipses (NASA): times to a few minutes, sizes to a few percent, as the docs say
    def test_luxor_2027_is_total_at_the_right_time(self):
        ev = [e for e in pulse.eclipses(25.69, 32.64, ts(2027, 7, 25), 20) if e['kind'] == 'solar']
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]['type'], 'total')
        self.assertLess(abs(ev[0]['max'] - ts(2027, 8, 2, 10, 7)), 5 * 60)

    def test_dallas_2024_almost_all_covered(self):
        e = [e for e in pulse.eclipses(32.78, -96.80, ts(2024, 4, 1), 20) if e['kind'] == 'solar'][0]
        self.assertGreater(e['obsc'], 0.97)
        self.assertLess(abs(e['max'] - ts(2024, 4, 8, 18, 42)), 6 * 60)

    def test_lunar_eclipses(self):
        ev = {(e['kind'], e['type']): e for e in pulse.eclipses(44.91, 8.61, ts(2025, 9, 1), 365)}
        tot = ev[('lunar', 'total')]
        self.assertLess(abs(tot['max'] - ts(2025, 9, 7, 18, 12)), 6 * 60)
        self.assertAlmostEqual(tot['mag'], 1.36, delta=0.08)
        part = ev[('lunar', 'partial')]   # 28 August 2026, umbral magnitude 0.93
        self.assertAlmostEqual(part['mag'], 0.93, delta=0.04)

    def test_no_eclipse_seen_from_the_wrong_side(self):
        self.assertEqual([e for e in pulse.eclipses(-33.9, 151.2, ts(2027, 7, 25), 20) if e['kind'] == 'solar'], [])

    def test_disc_overlap(self):
        self.assertEqual(pulse.disc_overlap(3, 1, 1), 0)
        self.assertEqual(pulse.disc_overlap(0, 1, 1.05), 1)
        self.assertAlmostEqual(pulse.disc_overlap(0, 1, 0.5), 0.25)
        self.assertTrue(0 < pulse.disc_overlap(1, 1, 1) < 0.5)


class SeasonTests(unittest.TestCase):
    def hub(self, cfg=None):
        h = pulse.Hub.__new__(pulse.Hub)
        h.cfg = {"festive": cfg or {}}
        h.weather = {"temp": 1}
        h.eclipse_list = []
        h.location = (45.0, 8.6)
        h.conf = lambda *k, default=None: pulse.Hub.conf(h, *k, default=default)
        return h

    def test_christmas_lights_and_new_year(self):
        h = self.hub()
        st = h.season_state(time.mktime((2026, 12, 24, 21, 0, 0, 0, 0, -1)))
        self.assertTrue(st['xmas']['day'])
        self.assertTrue(st['xmas']['snow'])
        self.assertNotIn('xmas', h.season_state(time.mktime((2026, 11, 20, 12, 0, 0, 0, 0, -1))))
        st = h.season_state(time.mktime((2026, 12, 31, 23, 59, 50, 0, 0, -1)))
        self.assertAlmostEqual(st['newYear']['left'], 10, delta=0.1)
        self.assertEqual(st['newYear']['year'], 2027)
        st = h.season_state(time.mktime((2027, 1, 1, 0, 3, 0, 0, 0, -1)))
        self.assertTrue(st['newYear']['party'])
        self.assertIn('xmas', st)   # the lights stay until 6 January

    def test_off(self):
        h = self.hub({"enabled": False})
        self.assertEqual(h.season_state(time.mktime((2026, 12, 31, 23, 59, 50, 0, 0, -1))), {})


class ExpiryTests(unittest.TestCase):
    def test_whois_dates(self):
        self.assertEqual(pulse.whois_date("Registry Expiry Date: 2027-03-05T12:00:00Z"), ts(2027, 3, 5, 12))
        self.assertEqual(pulse.whois_date("Expire Date:      2027-06-11"), ts(2027, 6, 11))
        self.assertEqual(pulse.whois_date("paid-till: 2027.01.31"), ts(2027, 1, 31))
        self.assertIsNone(pulse.whois_date("nothing here"))

    def test_candles(self):
        now = ts(2026, 11, 8)
        v = pulse.expiry_view([{"name": "a", "at": now + 40 * 86400}, {"name": "b", "at": now + 10 * 86400},
                               {"name": "c", "at": now + 2 * 86400}, {"name": "d", "at": now + 90 * 86400, "valid": False}], now)
        lv = {x["name"]: x["level"] for x in v}
        self.assertEqual(lv, {"a": "ok", "b": "warn", "c": "crit", "d": "crit"})
        self.assertEqual(v[0]["name"], "c")

    def test_der_date(self):
        der = b"\x30\x82" + b"\x17\x0d" + b"260101000000Z" + b"\x17\x0d" + b"270305120000Z"
        self.assertEqual(pulse.der_not_after(der), ts(2027, 3, 5, 12))


class HomeAssistantTests(unittest.TestCase):
    def iso(self, t):
        return time.strftime('%Y-%m-%dT%H:%M:%S.123+00:00', time.gmtime(t))

    def test_last_reported_wins_over_last_updated(self):
        now = time.time()
        e = {"entity_id": "binary_sensor.door", "state": "off", "attributes": {"device_class": "door"},
             "last_updated": self.iso(now - 5 * 86400), "last_reported": self.iso(now - 60)}
        self.assertEqual(ha.tile(e, 7200, now)["level"], "ok")

    def test_stale_and_unavailable(self):
        now = time.time()
        t = ha.tile({"entity_id": "sensor.t", "state": "21", "attributes": {}, "last_updated": self.iso(now - 3 * 3600)}, 900, now)
        self.assertEqual(t["level"], "warn")
        self.assertIn("stale 3h", t["text"])
        self.assertEqual(ha.tile({"entity_id": "sensor.x", "state": "unavailable", "attributes": {}}, 900, now)["level"], "crit")
        self.assertEqual(ha.age_secs("15m"), 900)

    def test_timezones(self):
        self.assertEqual(ha.iso_epoch("2026-11-08T08:00:00+01:00"), ha.iso_epoch("2026-11-08T07:00:00Z"))


class SceneTests(unittest.TestCase):
    def test_names_and_paths(self):
        self.assertIsNone(pulse.scene_path("sphere"))
        self.assertIsNone(pulse.scene_path("../etc/passwd"))
        self.assertIsNone(pulse.scene_path("Pond"))
        self.assertTrue(str(pulse.scene_path("pond")).endswith("web/scenes/pond.js"))

    def test_page_is_sandboxed_and_has_no_token(self):
        page = pulse.scene_page("pond").decode()
        self.assertIn("PulseScene.register", page)
        self.assertIn("sandbox allow-scripts", pulse.SCENE_CSP)
        self.assertIn("default-src 'none'", pulse.SCENE_CSP)
        self.assertNotEqual(pulse.scene_ticket("secret"), "secret")
        self.assertNotIn("secret", pulse.scene_ticket("secret"))

    def test_checks(self):
        self.assertEqual(pulse.scene_check(pulse.scene_path("pond").read_text())[0][0], "ok")
        bad = pulse.scene_check("fetch('http://x'); localStorage.x = 1")
        self.assertEqual(bad[0][0], "crit")
        self.assertTrue(any("network" in m for _, m in bad))

    def test_template_is_a_valid_scene(self):
        src = pulse.SCENE_TEMPLATE.replace("NAME", "mine")
        self.assertIn('PulseScene.register("mine"', src)
        self.assertEqual(pulse.scene_check(src)[0][0], "ok")


class NetTests(unittest.TestCase):
    def test_snmp_and_a_switch(self):
        walks = {k: pulse.snmp_parse(out, pulse.IF_OIDS[k]) for k, out in {
            "type": ".1.3.6.1.2.1.2.2.1.3.1 6\n.1.3.6.1.2.1.2.2.1.3.2 6\n.1.3.6.1.2.1.2.2.1.3.3 24",
            "oper": ".1.3.6.1.2.1.2.2.1.8.1 1\n.1.3.6.1.2.1.2.2.1.8.2 2",
            "descr": '.1.3.6.1.2.1.2.2.1.2.1 "ge-0/0/1"',
            "inerr": ".1.3.6.1.2.1.2.2.1.14.1 5\n.1.3.6.1.2.1.2.2.1.14.2 0",
            "in": ".1.3.6.1.2.1.31.1.1.1.6.1 2000000000", "out": ".1.3.6.1.2.1.31.1.1.1.10.1 0",
            "speed": ".1.3.6.1.2.1.31.1.1.1.15.1 1000"}.items()}
        walks["lldp"] = pulse.snmp_parse(".1.0.8802.1.1.2.1.4.1.1.9.0.1.1 access-1", pulse.LLDP_REM_NAME)
        prev = {"_raw": {"1": (2, 1000000000, 0)}, "_t": 100.0}
        v = pulse.switch_view("core", walks, prev, 110.0)
        self.assertEqual(len(v["ports"]), 2)   # the loopback (type 24) is not a port
        p1 = v["ports"][0]
        self.assertTrue(p1["up"] and p1["err"])
        self.assertEqual(p1["peer"], "access-1")
        self.assertTrue(p1["jam"])   # 1 GB in 10 s on a 1 Gb/s port: saturated
        self.assertFalse(v["ports"][1]["up"])

    def test_attacks_come_from_their_country(self):
        berlin = (52.52, 13.40)
        self.assertAlmostEqual(pulse.attack_az("China", "1.2.3.4", berlin), 60, delta=15)
        self.assertAlmostEqual(pulse.attack_az("US", "", berlin), 300, delta=25)
        self.assertEqual(pulse.attack_az("", "8.8.8.8", berlin), pulse.attack_az("", "8.8.8.8", berlin))
        ev = pulse.fortigate_events({"results": [{"action": "deny", "srccountry": "Russian Federation", "srcip": "5.5.5.5", "eventtime": 1794120000},
                                                 {"action": "accept", "srccountry": "Italy"}]}, berlin)
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["country"], "RU")

    def test_syslog_and_traps(self):
        e = pulse.syslog_parse("<187>Nov  8 09:00:00 access-1 %LINK-3-UPDOWN: Interface Gi1/0/6, changed state to down", "10.0.0.8")
        self.assertEqual(e["sev"], 3)
        self.assertEqual(e["host"], "access-1")
        t = pulse.trap_parse("access-1\nUDP: [10.0.0.8]:161->[10.0.0.42]:162\nIF-MIB::linkDown ifIndex.6 = 6")
        self.assertEqual(t["addr"], "10.0.0.8")
        self.assertLessEqual(t["sev"], 2)

    def test_wifi(self):
        u = pulse.unifi_wifi([{"mac": "aa", "ap_mac": "m1", "signal": -61}, {"mac": "bb", "is_wired": True}],
                             [{"type": "uap", "mac": "m1", "name": "ap-hall"}])
        self.assertEqual(u["aps"], ["ap-hall"])
        self.assertEqual(len(u["clients"]), 1)
        self.assertNotIn("aa", json.dumps(u))   # no MAC addresses on the page
        m = pulse.mikrotik_wifi([{"mac-address": "cc", "interface": "wifi1", "signal": "-55@HT"}])
        self.assertEqual(m["clients"][0]["signal"], -55)
        o = pulse.openwrt_wifi({"phy0-ap0": {"clients": {"dd": {"signal": -70}}}})
        self.assertEqual(o["clients"][0]["signal"], -70)

    def test_datacenter_and_migrations(self):
        res = [{"type": "node", "node": "pve-1", "status": "online"}, {"type": "node", "node": "pve-2", "status": "online"},
               {"type": "qemu", "node": "pve-1", "vmid": 100, "name": "web", "status": "running"}]
        a = pulse.proxmox_view(res)
        res[2]["node"] = "pve-2"
        b = pulse.proxmox_view(res)
        mv = pulse.dc_moves(a, b)
        self.assertEqual((mv[0]["from"], mv[0]["to"]), ("pve-1", "pve-2"))

    def test_backups(self):
        now = ts(2026, 11, 8, 12)
        self.assertEqual(pulse.backup_state("nas", "restic", [{"time": "2026-11-08T02:00:00.5+01:00"}], 26 * 3600, now)["state"], "ok")
        self.assertEqual(pulse.backup_state("nas", "restic", [{"time": "2026-11-05T02:00:00Z"}], 26 * 3600, now)["state"], "late")
        self.assertEqual(pulse.backup_state("v", "veeam", {"lastResult": "Failed", "lastRun": "2026-11-08T01:00:00Z"}, 86400, now)["state"], "failed")
        self.assertEqual(pulse.backup_state("v", "veeam", {"status": "Running", "lastResult": "Success"}, 86400, now)["state"], "running")
        self.assertEqual(pulse.parse_age("26h"), 26 * 3600)

    def test_intruders(self):
        w = pulse.wazuh_alerts({"hits": {"hits": [{"_source": {"rule": {"level": 12, "description": "ssh brute force"}, "agent": {"name": "web"},
                                                               "timestamp": "2026-11-08T09:00:00.000+0000"}},
                                                  {"_source": {"rule": {"level": 3}}}]}})
        self.assertEqual(len(w), 1)
        self.assertEqual(w[0]["level"], "crit")
        c = pulse.crowdsec_alerts([{"scenario": "crowdsecurity/ssh-bf", "decisions": [{}], "machine_id": "web", "created_at": "2026-11-08T09:00:00Z"}])
        self.assertEqual(c[0]["target"], "web")


class HubTests(unittest.TestCase):
    """The real HTTP server: scene pages, the ticket, NOC, the terminal and traps."""
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ["XDG_CONFIG_HOME"] = cls.tmp.name
        os.environ["XDG_STATE_HOME"] = cls.tmp.name
        cls.p = mock.patch.multiple(pulse, CONF_DIR=Path(cls.tmp.name) / "omarchy-pulse", TOKEN_FILE=Path(cls.tmp.name) / "omarchy-pulse/token",
                                    STATE_DIR=Path(cls.tmp.name) / "state")
        cls.p.start()
        pulse.CONF_DIR.mkdir(parents=True, exist_ok=True)
        cls.hub = pulse.Hub()
        cls.hub.demo = True
        cls.tok = pulse.token()
        cls.port = 47999
        cls.srv = pulse.serve(cls.hub, cls.port)

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.p.stop()
        cls.tmp.cleanup()

    def req(self, path, data=None, token=True):
        u = f"http://127.0.0.1:{self.port}{path}"
        r = urllib.request.Request(u, data=data, method="POST" if data is not None else "GET",
                                   headers={"X-Pulse-Token": self.tok} if token else {})
        try:
            with urllib.request.urlopen(r, timeout=5) as resp:
                return resp.status, resp.read(), resp.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers

    def test_scene_page_needs_its_ticket_and_is_sandboxed(self):
        self.assertEqual(self.req("/scene/pond?ticket=wrong", token=False)[0], 401)
        st, body, h = self.req(f"/scene/pond?ticket={pulse.scene_ticket(self.tok)}", token=False)
        self.assertEqual(st, 200)
        self.assertIn("sandbox allow-scripts", h["Content-Security-Policy"])
        self.assertNotIn(self.tok.encode(), body)
        self.assertEqual(self.req(f"/scene/sphere?ticket={pulse.scene_ticket(self.tok)}", token=False)[0], 404)

    def test_lab_api(self):
        st, body, _ = self.req("/api/scenes")
        self.assertIn("pond", json.loads(body)["scenes"])
        st, body, _ = self.req("/api/scene-src?name=pond")
        self.assertEqual(json.loads(body)["checks"][0][0], "ok")
        st, body, _ = self.req("/api/scene-state")
        s = json.loads(body)
        for k in ("agents", "sys", "git", "theme", "ui", "season"):
            self.assertIn(k, s)
        self.assertNotIn("lan", s)
        self.assertNotIn("calendar", s)

    def test_noc_term_and_trap(self):
        self.req("/api/noc?do=on", b"")
        self.req("/api/trap", b"access-1\nUDP: [10.0.0.8]:161\nIF-MIB::linkDown ifIndex 6")
        st = self.hub.state()
        self.assertTrue(st["noc"]["on"])
        self.assertTrue(st["noc"]["incident"])
        self.req("/api/noc?do=ack", b"")
        self.assertIsNone(self.hub.state()["noc"]["incident"])
        self.req("/api/term", json.dumps({"lines": ["> scan", "core 10.0.0.2"]}).encode())
        self.assertEqual(self.hub.state()["term"][-1]["text"], "core 10.0.0.2")
        self.hub.privacy_manual = True
        self.assertEqual(self.hub.state()["term"], [])
        self.hub.privacy_manual = None
        self.req("/api/noc?do=off", b"")

    def test_ack_needs_its_source(self):
        st, body, _ = self.req("/api/ack/zabbix", b"")
        self.assertFalse(json.loads(body)["ok"])


if __name__ == "__main__":
    unittest.main()
