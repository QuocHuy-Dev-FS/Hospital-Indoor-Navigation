"""
test_beacon_setup.py — Kiểm thử tự động cho validate_beacons và summarize_calibration.

Chạy từ thư mục gốc repo:
    python -m unittest tools/beacon_setup/test_beacon_setup.py -v

Dùng UUID giả "aaaa0000-0000-0000-0000-000000000000" (không phải UUID dự án thật).
"""

import csv
import io
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

# Thêm thư mục beacon_setup vào path để import được
sys.path.insert(0, str(Path(__file__).parent))

from validate_beacons import validate
from summarize_calibration import _iqr_filter, _regression, _parse_csv


FAKE_UUID = "aaaa0000-0000-0000-0000-000000000000"  # UUID giả, không phải của dự án


def _make_beacon(
    bid="F1_B01", floor="F1", major=1, minor=1,
    uuid=FAKE_UUID, x=1.0, z=2.0, status="planned"
) -> dict:
    return {
        "id": bid, "floorId": floor, "major": major, "minor": minor,
        "uuid": uuid, "x": x, "z": z, "status": status,
    }


# ─── validate_beacons ────────────────────────────────────────────────────────

class TestValidateBeaconsOk(unittest.TestCase):
    def test_single_valid_beacon(self):
        errors = validate([_make_beacon()])
        self.assertEqual(errors, [])

    def test_two_valid_beacons(self):
        b1 = _make_beacon("F1_B01", "F1", 1, 1)
        b2 = _make_beacon("F1_B02", "F1", 1, 2)
        self.assertEqual(validate([b1, b2]), [])

    def test_different_floors(self):
        b1 = _make_beacon("F1_B01", "F1", 1, 1)
        b2 = _make_beacon("F2_B01", "F2", 2, 1)
        self.assertEqual(validate([b1, b2]), [])

    def test_valid_statuses(self):
        for status in ("planned", "installed", "active", "inactive", "deprecated"):
            with self.subTest(status=status):
                self.assertEqual(validate([_make_beacon(status=status)]), [])

    def test_empty_list(self):
        self.assertEqual(validate([]), [])


class TestValidateBeaconsErrors(unittest.TestCase):
    def test_duplicate_minor(self):
        b1 = _make_beacon("F1_B01", "F1", 1, 1)
        b2 = _make_beacon("F1_B02", "F1", 1, 1)   # minor trùng
        errors = validate([b1, b2])
        self.assertTrue(any("trùng" in e.lower() for e in errors), errors)

    def test_wrong_major(self):
        b = _make_beacon("F1_B01", "F1", major=2, minor=1)  # major ≠ tầng
        errors = validate([b])
        self.assertTrue(any("major" in e for e in errors), errors)

    def test_bad_uuid_format(self):
        b = _make_beacon(uuid="not-a-uuid")
        errors = validate([b])
        self.assertTrue(any("uuid" in e.lower() for e in errors), errors)

    def test_bad_id_pattern(self):
        b = _make_beacon(bid="B01")   # thiếu tầng
        errors = validate([b])
        self.assertTrue(any("id" in e.lower() for e in errors), errors)

    def test_different_uuids(self):
        b1 = _make_beacon("F1_B01", "F1", 1, 1, uuid="aaaa0000-0000-0000-0000-000000000000")
        b2 = _make_beacon("F1_B02", "F1", 1, 2, uuid="bbbb0000-0000-0000-0000-000000000000")
        errors = validate([b1, b2])
        self.assertTrue(any("uuid" in e.lower() for e in errors), errors)

    def test_wrong_floor_id(self):
        b = _make_beacon("F1_B01", floor="F2", major=1, minor=1)
        errors = validate([b])
        self.assertTrue(any("floorid" in e.lower() for e in errors), errors)

    def test_invalid_status(self):
        b = _make_beacon(status="unknown_status")
        errors = validate([b])
        self.assertTrue(any("status" in e.lower() for e in errors), errors)

    def test_x_not_number(self):
        b = _make_beacon()
        b["x"] = "abc"
        errors = validate([b])
        self.assertTrue(any("'x'" in e for e in errors), errors)


# ─── summarize_calibration ───────────────────────────────────────────────────

class TestIQRFilter(unittest.TestCase):
    def test_removes_outliers(self):
        values = [-70.0] * 20 + [-40.0]   # -40 là outlier cao
        filtered = _iqr_filter(values)
        self.assertNotIn(-40.0, filtered)

    def test_keeps_normal_values(self):
        values = list(range(-80, -50))
        filtered = _iqr_filter(values)
        self.assertGreater(len(filtered), len(values) // 2)

    def test_too_short(self):
        values = [-70.0, -72.0]
        self.assertEqual(_iqr_filter(values), values)


class TestRegression(unittest.TestCase):
    def _synth_points(self, A=-60.0, n=2.0, distances=(1, 2, 4, 8)):
        """Sinh điểm không nhiễu từ A và n đã biết."""
        import math
        return [(d, A - 10 * n * math.log10(d)) for d in distances]

    def test_known_A_n(self):
        A_true, n_true = -60.0, 2.0
        pts = self._synth_points(A_true, n_true)
        A, n, r2 = _regression(pts)
        self.assertAlmostEqual(A, A_true, delta=0.5, msg=f"A={A:.2f} vs {A_true}")
        self.assertAlmostEqual(n, n_true, delta=0.1, msg=f"n={n:.3f} vs {n_true}")
        self.assertGreater(r2, 0.99, msg=f"R²={r2:.4f}")

    def test_noisy_data(self):
        """Với nhiễu Gaussian nhỏ, ước lượng phải gần đúng (delta lớn hơn)."""
        import random
        rng = random.Random(42)
        A_true, n_true = -65.0, 2.5
        pts = [
            (d, A_true - 10 * n_true * math.log10(d) + rng.gauss(0, 3))
            for d in [0.5, 1, 1.5, 2, 3, 4, 6, 8] * 4
        ]
        A, n, r2 = _regression(pts)
        self.assertAlmostEqual(A, A_true, delta=5.0, msg=f"A={A:.1f} vs {A_true}")
        self.assertAlmostEqual(n, n_true, delta=0.5, msg=f"n={n:.2f} vs {n_true}")
        self.assertGreater(r2, 0.7, msg=f"R²={r2:.4f}")

    def test_single_point(self):
        A, n, r2 = _regression([(1.0, -60.0)])
        self.assertTrue(math.isnan(A))

    def test_empty(self):
        A, n, r2 = _regression([])
        self.assertTrue(math.isnan(A))


class TestParseCSV(unittest.TestCase):
    def _write_csv(self, rows: list[dict]) -> Path:
        f = tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        )
        writer = csv.DictWriter(
            f,
            fieldnames=["beaconRef","distance_m","condition","sampleIndex","rssi_dBm","timestamp","notes"]
        )
        writer.writeheader()
        writer.writerows(rows)
        f.close()
        return Path(f.name)

    def test_valid_rows(self):
        path = self._write_csv([
            {"beaconRef":"B01","distance_m":"1.0","condition":"test","sampleIndex":"1","rssi_dBm":"-70","timestamp":"0","notes":""},
            {"beaconRef":"B01","distance_m":"2.0","condition":"test","sampleIndex":"1","rssi_dBm":"-76","timestamp":"0","notes":""},
        ])
        rows = _parse_csv(path)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["distance_m"], 1.0)
        self.assertEqual(rows[0]["rssi_dBm"], -70.0)
        path.unlink()

    def test_skips_empty_rssi(self):
        path = self._write_csv([
            {"beaconRef":"B01","distance_m":"1.0","condition":"test","sampleIndex":"1","rssi_dBm":"","timestamp":"0","notes":""},
        ])
        rows = _parse_csv(path)
        self.assertEqual(len(rows), 0)
        path.unlink()


# ─── new_project_uuid.ps1 (kiểm thử bằng subprocess) ────────────────────────

class TestNewProjectUuid(unittest.TestCase):
    def test_creates_file_from_example(self):
        """Script tạo file mới từ example khi chưa có."""
        import shutil
        import subprocess
        import tempfile

        tmpdir = Path(tempfile.mkdtemp())
        try:
            # Chuẩn bị: tạo cấu trúc thư mục như repo nhỏ
            data_dir    = tmpdir / "data"
            setup_dir   = tmpdir / "tools" / "beacon_setup"
            data_dir.mkdir(parents=True)
            setup_dir.mkdir(parents=True)

            # Sao chép file example
            real_example = Path(__file__).resolve().parents[2] / "data" / "beacons.local.example.json"
            shutil.copy(real_example, data_dir / "beacons.local.example.json")

            # Sao chép script (trỏ $PSScriptRoot đúng)
            script_src = Path(__file__).resolve().parent / "new_project_uuid.ps1"
            script_dst = setup_dir / "new_project_uuid.ps1"
            shutil.copy(script_src, script_dst)

            target = data_dir / "beacons.local.json"
            self.assertFalse(target.exists(), "Trước khi chạy: file chưa được tạo")

            result = subprocess.run(
                ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_dst)],
                capture_output=True, cwd=str(tmpdir)
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertTrue(target.exists(), "File nên được tạo sau khi chạy script")

            content = json.loads(target.read_text(encoding="utf-8-sig"))
            self.assertIsInstance(content, list)
            beacons = [b for b in content if "_comment" not in b]
            self.assertGreater(len(beacons), 0)

            # Kiểm tra UUID không còn là placeholder
            for b in beacons:
                self.assertNotEqual(
                    b.get("uuid", ""), "00000000-0000-0000-0000-000000000000",
                    "UUID phải được thay bằng giá trị mới"
                )

        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_no_overwrite_existing(self):
        """Script thoát nếu file đã tồn tại."""
        import shutil
        import subprocess
        import tempfile

        tmpdir = Path(tempfile.mkdtemp())
        try:
            data_dir  = tmpdir / "data"
            setup_dir = tmpdir / "tools" / "beacon_setup"
            data_dir.mkdir(parents=True)
            setup_dir.mkdir(parents=True)

            real_example = Path(__file__).resolve().parents[2] / "data" / "beacons.local.example.json"
            shutil.copy(real_example, data_dir / "beacons.local.example.json")

            # Tạo sẵn file đích với nội dung khác
            existing_content = '{"existing": true}'
            target = data_dir / "beacons.local.json"
            target.write_text(existing_content, encoding="utf-8")

            script_src = Path(__file__).resolve().parent / "new_project_uuid.ps1"
            script_dst = setup_dir / "new_project_uuid.ps1"
            shutil.copy(script_src, script_dst)

            result = subprocess.run(
                ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_dst)],
                capture_output=True, cwd=str(tmpdir)
            )
            self.assertEqual(result.returncode, 0)
            # Nội dung không đổi
            self.assertEqual(
                target.read_text(encoding="utf-8"), existing_content,
                "File không được ghi đè khi đã tồn tại"
            )

        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    import math  # noqa: F811 (needed inside test methods)
    unittest.main(verbosity=2)
