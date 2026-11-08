import importlib.machinery
import importlib.util
import tempfile
import unittest
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "extras/pulse/omarchy-pulse"
loader = importlib.machinery.SourceFileLoader("pulse_temp", str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
pulse = importlib.util.module_from_spec(spec)
loader.exec_module(pulse)


def write_temp(hw: Path, n: int, milli: int, label: str | None = None, fault: str | None = None):
    (hw / f"temp{n}_input").write_text(str(milli))
    if label is not None:
        (hw / f"temp{n}_label").write_text(label)
    if fault is not None:
        (hw / f"temp{n}_fault").write_text(fault)


class CpuTempTests(unittest.TestCase):
    def test_a_lone_core_far_above_the_package_is_dropped(self):
        # Core Ultra 9 285H: one input near 100 °C, package and the other cores near 52.
        self.assertEqual(pulse._cpu_temp(52.0, [52, 51, 53, 100]), 53.0)

    def test_real_heat_is_kept(self):
        self.assertEqual(pulse._cpu_temp(96.0, [94, 95, 95, 97]), 97.0)

    def test_a_hot_package_with_cool_cores_is_kept(self):
        self.assertEqual(pulse._cpu_temp(100.0, [50, 51, 52]), 100.0)

    def test_no_package_still_drops_the_outlier(self):
        self.assertEqual(pulse._cpu_temp(None, [50, 51, 52, 100]), 52.0)

    def test_package_alone(self):
        self.assertEqual(pulse._cpu_temp(88.0, []), 88.0)
        self.assertIsNone(pulse._cpu_temp(None, []))

    def test_hwmon_uses_the_package_and_skips_a_fault_and_a_bogus_zone(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cpu = root / "hwmon0"
            cpu.mkdir()
            (cpu / "name").write_text("coretemp\n")
            write_temp(cpu, 1, 52000, "Package id 0")
            write_temp(cpu, 2, 51000, "Core 0")
            write_temp(cpu, 3, 53000, "Core 1")
            write_temp(cpu, 4, 100000, "Core 2")
            write_temp(cpu, 5, 100000, "Core 3", fault="1")
            zone = root / "hwmon1"
            zone.mkdir()
            (zone / "name").write_text("acpitz\n")
            write_temp(zone, 1, -273300)
            self.assertEqual(pulse._read_hwmon_temp(root), 53.0)

    def test_acpitz_is_only_a_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            zone = root / "hwmon0"
            zone.mkdir()
            (zone / "name").write_text("acpitz\n")
            write_temp(zone, 1, 61000)
            self.assertEqual(pulse._read_hwmon_temp(root), 61.0)

    def test_one_hot_sample_does_not_alert_and_two_do(self):
        hub = pulse.Hub()
        hub._edges = {}
        hub.cfg = {"pulse": {"temp_crit": 90}}
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(100), "100 °C")
        self.assertEqual(len(hub.alerts), 0)
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(100), "100 °C")
        self.assertEqual(len(hub.alerts), 1)
        self.assertEqual(hub.alerts[0]["text"], "100 °C")
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(100), "100 °C")
        self.assertEqual(len(hub.alerts), 1)   # still hot: no second edge
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(40), "40 °C")
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(95), "95 °C")
        self.assertEqual(len(hub.alerts), 1)   # cooled, then only one hot sample
        hub.edge_alert("temp", "CPU temperature", hub._temp_hot(95), "95 °C")
        self.assertEqual(len(hub.alerts), 2)


if __name__ == "__main__":
    unittest.main()
