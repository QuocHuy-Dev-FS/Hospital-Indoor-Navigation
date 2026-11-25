"""
diagnose_beacons.py — Chẩn đoán beacon bridge đang thấy gì.

Kết nối WebSocket tới cầu nối (ws://127.0.0.1:PORT), thu thập gói trong
N giây, so sánh với beacons.local.json và báo cáo:
  - Beacon KHỚP:  id, RSSI trung bình, số gói/giây.
  - Beacon LỆCH:  key thấy được nhưng uuid/major/minor không khớp cấu hình.
  - Beacon THIẾU: có trong file nhưng không thấy trong thời gian quan sát.

Yêu cầu:
  - Python stdlib + websockets (đã có trong tools/beacon_bridge/requirements.txt)
  - Cầu nối đang chạy: python tools/beacon_bridge/bridge.py ...

Sử dụng:
    python tools/beacon_setup/diagnose_beacons.py [--duration 10] [--port 8765]
                                                  [--file data/beacons.local.json]

Cần cầu nối đang chạy trên cổng chỉ định.
"""

import argparse
import asyncio
import json
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean

_REPO_ROOT = Path(__file__).resolve().parents[2]

UUID_PREFIX_LEN = 4  # chỉ hiện 4 ký tự đầu UUID


def _mask_key(key: str) -> str:
    """Hiện 4 ký tự đầu, che phần còn lại."""
    return key[:UUID_PREFIX_LEN] + "****-…"


def _key_from_beacon(b: dict) -> str | None:
    uuid  = b.get("uuid", "")
    major = b.get("major")
    minor = b.get("minor")
    if uuid and major is not None and minor is not None:
        return f"{uuid.lower()}-{major}-{minor}"
    return None


def _load_beacons(path: Path) -> dict:
    """Trả về dict key → beacon."""
    if not path.exists():
        print(f"[diagnose] LỖI: Không tìm thấy {path}", file=sys.stderr)
        sys.exit(1)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        print("[diagnose] LỖI: File phải là JSON array.", file=sys.stderr)
        sys.exit(1)
    result = {}
    for b in raw:
        if not isinstance(b, dict) or "_comment" in b:
            continue
        k = _key_from_beacon(b)
        if k:
            result[k] = b
    return result


async def _collect(port: int, duration: float) -> dict[str, list[float]]:
    """Thu thập RSSI theo key trong `duration` giây. Trả về {key: [rssi, ...]}."""
    try:
        import websockets
    except ImportError:
        print(
            "[diagnose] LỖI: Thiếu thư viện websockets.\n"
            "  Chạy: cd tools/beacon_bridge && .venv/Scripts/activate && pip install -r requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    data: dict[str, list[float]] = defaultdict(list)
    uri = f"ws://127.0.0.1:{port}"

    try:
        async with websockets.connect(uri, open_timeout=3) as ws:
            print(f"[diagnose] Đã kết nối {uri} — quan sát {duration}s…")
            try:
                async with asyncio.timeout(duration):
                    async for raw_msg in ws:
                        try:
                            msg = json.loads(raw_msg)
                        except json.JSONDecodeError:
                            continue
                        key  = msg.get("key", "")
                        rssi = msg.get("rssi")
                        if key and rssi is not None:
                            data[key].append(float(rssi))
            except TimeoutError:
                pass
    except OSError as exc:
        print(
            f"[diagnose] LỖI: Không kết nối được tới {uri}: {exc}\n"
            "  Kiểm tra cầu nối có đang chạy không: python tools/beacon_bridge/bridge.py",
            file=sys.stderr,
        )
        sys.exit(1)

    return dict(data)


def _report(
    observed: dict[str, list[float]],
    expected: dict[str, dict],
    duration: float,
) -> None:
    expected_keys = set(expected.keys())
    observed_keys = set(observed.keys())

    matched_keys  = expected_keys & observed_keys
    mismatch_keys = observed_keys - expected_keys
    missing_keys  = expected_keys - observed_keys

    print("\n" + "=" * 60)
    print(f"KẾT QUẢ CHẨN ĐOÁN  (quan sát {duration:.0f}s)")
    print("=" * 60)

    # ── Beacon khớp ──────────────────────────────────────────────────────────
    if matched_keys:
        print(f"\n✅ KHỚP ({len(matched_keys)} beacon):")
        for key in sorted(matched_keys):
            b     = expected[key]
            rssis = observed[key]
            pps   = len(rssis) / duration
            print(
                f"  {b.get('id', '?'):10}  "
                f"key={_mask_key(key)}  "
                f"RSSI_avg={mean(rssis):.1f} dBm  "
                f"n={len(rssis)}  "
                f"{pps:.1f} gói/s"
            )
    else:
        print("\n✅ KHỚP: (không có)")

    # ── Beacon lệch ──────────────────────────────────────────────────────────
    if mismatch_keys:
        print(f"\n⚠️  LỆCH ({len(mismatch_keys)} key thấy được nhưng không có trong file):")
        for key in sorted(mismatch_keys):
            rssis = observed[key]
            pps   = len(rssis) / duration
            print(
                f"  key={_mask_key(key)}  "
                f"RSSI_avg={mean(rssis):.1f} dBm  "
                f"n={len(rssis)}  "
                f"{pps:.1f} gói/s  "
                f"→ không có trong beacons.local.json"
            )
    else:
        print("\n⚠️  LỆCH: (không có)")

    # ── Beacon thiếu ─────────────────────────────────────────────────────────
    if missing_keys:
        print(f"\n❌ THIẾU ({len(missing_keys)} beacon trong file nhưng không thấy):")
        for key in sorted(missing_keys):
            b = expected[key]
            print(f"  {b.get('id', '?'):10}  key={_mask_key(key)}")
    else:
        print("\n❌ THIẾU: (không có)")

    print("=" * 60)
    if mismatch_keys:
        print(
            "ℹ️  Beacon lệch có thể do: cầu nối nhìn thấy beacon khác dự án,\n"
            "   hoặc UUID/Major/Minor trong beacons.local.json chưa đúng."
        )
    if missing_keys:
        print(
            "ℹ️  Beacon thiếu có thể do: tắt nguồn, nằm ngoài tầm, "
            "hoặc UUID không khớp với allowlist của cầu nối."
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Chẩn đoán beacon bridge so với beacons.local.json."
    )
    parser.add_argument(
        "--duration", type=float, default=10,
        help="Thời gian quan sát (giây, mặc định 10)"
    )
    parser.add_argument(
        "--port", type=int, default=8765,
        help="Cổng WebSocket của bridge (mặc định 8765)"
    )
    parser.add_argument(
        "--file", type=Path,
        default=_REPO_ROOT / "data" / "beacons.local.json",
        help="Đường dẫn beacons.local.json (mặc định: data/beacons.local.json)"
    )
    args = parser.parse_args()

    expected = _load_beacons(args.file)
    if not expected:
        print("[diagnose] CẢNH BÁO: Không có beacon nào trong file để so sánh.")

    observed = asyncio.run(_collect(args.port, args.duration))
    _report(observed, expected, args.duration)
    return 0


if __name__ == "__main__":
    sys.exit(main())
