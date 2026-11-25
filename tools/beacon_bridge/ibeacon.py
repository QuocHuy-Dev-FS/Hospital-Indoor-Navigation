"""
ibeacon.py — Giải mã gói quảng bá iBeacon từ bleak manufacturer_data.

Không phụ thuộc thư viện bên ngoài; chạy được cả trong venv lẫn
trong unit test thuần Python.

Key format khớp chính xác với iBeaconKey() trong bench/packet-parser.js:
  "{uuid-lowercase}-{major}-{minor}"
Ví dụ: "fef3b5fd-1234-5678-9abc-def012345678-1-2"
"""

APPLE_COMPANY_ID = 0x004C  # Company ID Apple (little-endian trong BLE)
IBEACON_TYPE    = 0x02
IBEACON_LEN     = 0x15
PAYLOAD_MIN_LEN = 23       # type(1) + len(1) + uuid(16) + major(2) + minor(2) + txPower(1)


class IBeaconParseError(ValueError):
    """Dữ liệu không phải iBeacon hợp lệ."""


def _uuid_bytes_to_str(b: bytes) -> str:
    """Chuyển 16 byte → chuỗi UUID 8-4-4-4-12 (chữ thường).
    Khớp với bytesToUUID() trong bench/packet-parser.js.
    """
    h = b.hex()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def build_key(uuid_str: str, major: int, minor: int) -> str:
    """Tạo beacon key khớp định dạng iBeaconKey() trong JS."""
    return f"{uuid_str.lower()}-{major}-{minor}"


def mask_key(key: str) -> str:
    """Che UUID trong log: chỉ giữ 8 ký tự đầu."""
    parts = key.split("-")
    if len(parts) >= 2:
        return f"{parts[0]}-****-****-****-****-{parts[-2]}-{parts[-1]}"
    return "****"


def decode_ibeacon(manufacturer_data: dict) -> dict:
    """Giải mã gói iBeacon từ manufacturer_data của bleak.

    Args:
        manufacturer_data: dict {company_id (int): bytes}
                           (bleak trả về kiểu này cho AdvertisementData)

    Returns:
        dict với các key: key (str), uuid (str), major (int),
                         minor (int), tx_power (int, dBm có dấu)

    Raises:
        IBeaconParseError: nếu không phải iBeacon hợp lệ
    """
    if APPLE_COMPANY_ID not in manufacturer_data:
        raise IBeaconParseError(f"Không có company ID Apple (0x{APPLE_COMPANY_ID:04X})")

    payload = manufacturer_data[APPLE_COMPANY_ID]
    if isinstance(payload, (bytes, bytearray)):
        b = bytes(payload)
    else:
        raise IBeaconParseError("manufacturer_data value phải là bytes")

    if len(b) < PAYLOAD_MIN_LEN:
        raise IBeaconParseError(
            f"Payload ngắn hơn {PAYLOAD_MIN_LEN} byte (có {len(b)} byte)"
        )

    if b[0] != IBEACON_TYPE or b[1] != IBEACON_LEN:
        raise IBeaconParseError(
            f"Không phải iBeacon (byte[0]={b[0]:#04x}, byte[1]={b[1]:#04x})"
        )

    uuid_str = _uuid_bytes_to_str(b[2:18])
    major    = (b[18] << 8) | b[19]
    minor    = (b[20] << 8) | b[21]
    tx_power = b[22] if b[22] <= 127 else b[22] - 256  # int8 có dấu

    return {
        "key":      build_key(uuid_str, major, minor),
        "uuid":     uuid_str,
        "major":    major,
        "minor":    minor,
        "tx_power": tx_power,
    }
