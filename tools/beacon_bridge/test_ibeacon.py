"""
test_ibeacon.py — Unit tests cho ibeacon.py
Chạy: python -m pytest test_ibeacon.py -v
Hoặc: python -m unittest test_ibeacon -v
Không cần bleak, không cần Bluetooth.
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import unittest
from ibeacon import decode_ibeacon, build_key, mask_key, IBeaconParseError, APPLE_COMPANY_ID


# ─── Helpers ────────────────────────────────────────────────────────────────

SAMPLE_UUID_HEX = "00000001000000000000000000000000"
SAMPLE_UUID_STR = "00000001-0000-0000-0000-000000000000"

def make_payload(
    uuid_hex: str = SAMPLE_UUID_HEX,
    major: int = 1,
    minor: int = 1,
    tx_power: int = -59,
    prefix: bytes = bytes([0x02, 0x15]),
) -> bytes:
    """Tạo payload iBeacon 23 byte (sau khi đã bỏ 2 byte company ID)."""
    uuid_bytes = bytes.fromhex(uuid_hex)
    tx_byte = tx_power if tx_power >= 0 else tx_power + 256
    return (
        prefix
        + uuid_bytes
        + bytes([(major >> 8) & 0xFF, major & 0xFF])
        + bytes([(minor >> 8) & 0xFF, minor & 0xFF])
        + bytes([tx_byte])
    )

def make_mfr(payload: bytes) -> dict:
    return {APPLE_COMPANY_ID: payload}


# ─── Test cases ─────────────────────────────────────────────────────────────

class TestDecodeIBeacon(unittest.TestCase):

    def test_valid_packet_basic(self):
        """Gói hợp lệ: key, uuid, major, minor, tx_power đúng."""
        payload = make_payload(major=1, minor=2, tx_power=-59)
        result = decode_ibeacon(make_mfr(payload))

        self.assertEqual(result["uuid"], SAMPLE_UUID_STR)
        self.assertEqual(result["major"], 1)
        self.assertEqual(result["minor"], 2)
        self.assertEqual(result["tx_power"], -59)
        self.assertEqual(result["key"], f"{SAMPLE_UUID_STR}-1-2")

    def test_key_matches_js_ibeacon_key(self):
        """Key Python phải khớp iBeaconKey() JS: uuid-lowercase-major-minor."""
        payload = make_payload(
            uuid_hex="fef3b5fd123456789abcdef012345678",
            major=3, minor=7
        )
        result = decode_ibeacon(make_mfr(payload))
        self.assertEqual(
            result["key"],
            "fef3b5fd-1234-5678-9abc-def012345678-3-7"
        )

    def test_tx_power_negative(self):
        """TxPower âm: byte 0xC5 → -59 dBm (int8 có dấu)."""
        payload = make_payload(tx_power=-59)
        self.assertEqual(payload[-1], 0xC5)  # xác nhận byte đúng
        result = decode_ibeacon(make_mfr(payload))
        self.assertEqual(result["tx_power"], -59)

    def test_tx_power_positive(self):
        """TxPower dương: byte 0x00 → 0 dBm."""
        payload = make_payload(tx_power=0)
        result = decode_ibeacon(make_mfr(payload))
        self.assertEqual(result["tx_power"], 0)

    def test_wrong_company_id(self):
        """Company ID không phải Apple → IBeaconParseError."""
        mfr = {0x0059: make_payload()}  # Nordic Semiconductor
        with self.assertRaises(IBeaconParseError):
            decode_ibeacon(mfr)

    def test_wrong_prefix(self):
        """Byte đầu không phải 0x02 0x15 → IBeaconParseError."""
        payload = make_payload(prefix=bytes([0x03, 0x15]))
        with self.assertRaises(IBeaconParseError):
            decode_ibeacon(make_mfr(payload))

    def test_payload_too_short(self):
        """Payload < 23 byte → IBeaconParseError."""
        payload = make_payload()[:10]
        with self.assertRaises(IBeaconParseError):
            decode_ibeacon(make_mfr(payload))

    def test_empty_manufacturer_data(self):
        """Dict rỗng → IBeaconParseError."""
        with self.assertRaises(IBeaconParseError):
            decode_ibeacon({})

    def test_major_minor_boundary(self):
        """Major=65535, Minor=65535 (giá trị tối đa uint16)."""
        payload = make_payload(major=0xFFFF, minor=0xFFFF)
        result = decode_ibeacon(make_mfr(payload))
        self.assertEqual(result["major"], 65535)
        self.assertEqual(result["minor"], 65535)


class TestBuildKey(unittest.TestCase):

    def test_lowercase(self):
        """build_key luôn trả về lowercase."""
        k = build_key("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", 1, 1)
        self.assertEqual(k, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-1-1")

    def test_format(self):
        k = build_key("00000001-0000-0000-0000-000000000000", 2, 3)
        self.assertEqual(k, "00000001-0000-0000-0000-000000000000-2-3")


class TestMaskKey(unittest.TestCase):

    def test_only_shows_first_8_chars(self):
        key = "fef3b5fd-1234-5678-9abc-def012345678-1-2"
        masked = mask_key(key)
        self.assertIn("fef3b5fd", masked)
        self.assertNotIn("1234-5678", masked)
        self.assertIn("****", masked)

    def test_ends_with_major_minor(self):
        key = "fef3b5fd-1234-5678-9abc-def012345678-5-12"
        masked = mask_key(key)
        self.assertTrue(masked.endswith("-5-12"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
