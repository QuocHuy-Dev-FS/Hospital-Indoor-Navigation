"""
bridge.py — Cầu nối BLE Beacon → WebSocket (laptop Windows → trình duyệt)

Sử dụng:
    python bridge.py [--port PORT] [--allowlist FILE]

Mặc định:
    --port      8765
    --allowlist allowlist.json  (cùng thư mục với script)

Cài gói (một lần, trong venv riêng):
    python -m venv .venv
    .venv/Scripts/activate
    pip install -r requirements.txt

Định dạng allowlist.json: JSON array các beacon key
    ["uuid-lowercase-major-minor", "uuid-lowercase-major-minor", ...]

Hoặc dùng --beacons để tự tạo allowlist từ data/beacons.local.json:
    python bridge.py --beacons ../../data/beacons.local.json

Định dạng message gửi qua WebSocket (JSON, một dòng):
    {"key": "...", "rssi": -68, "txPower": -59, "timestamp": 1730000000000, "source": "laptop"}
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# bleak và websockets được import trong main() sau khi parse args
# để lỗi ImportError xuất hiện với thông báo rõ ràng.

THROTTLE_INTERVAL_S = 0.2   # = 5 msg/giây/beacon
DEFAULT_PORT        = 8765
BT_RETRY_INTERVAL_S = 5
BT_MAX_RETRIES      = 5

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")

# ─── State module-level (được khởi tạo trong main()) ─────────────────────────
_clients: set       = set()
_last_sent: dict    = {}      # key → time.monotonic()
_allowlist: set     = set()
_adv_queue          = None    # asyncio.Queue, gán trong main()
_loop               = None    # event loop, gán trong main()


# ─── Allowlist ───────────────────────────────────────────────────────────────

def load_allowlist(path: Path) -> set:
    if not path.exists():
        log.error("Không tìm thấy allowlist: %s", path)
        log.error("Sao chép allowlist.json.example → allowlist.json và điền key thật.")
        log.error("Hoặc dùng --beacons data/beacons.local.json để tự tạo allowlist.")
        sys.exit(1)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log.error("allowlist.json không phải JSON hợp lệ: %s", exc)
        sys.exit(1)
    if not isinstance(data, list):
        log.error("allowlist.json phải là JSON array.")
        sys.exit(1)
    return {k.lower() for k in data if isinstance(k, str)}


def load_allowlist_from_beacons(path: Path) -> set:
    """Tạo allowlist từ beacons.local.json (uuid_lower-major-minor cho mỗi beacon)."""
    if not path.exists():
        log.error("Không tìm thấy file beacon: %s", path)
        log.error("Tạo file bằng: powershell -File tools\\beacon_setup\\new_project_uuid.ps1")
        sys.exit(1)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log.error("File beacon không phải JSON hợp lệ: %s", exc)
        sys.exit(1)
    if not isinstance(data, list):
        log.error("File beacon phải là JSON array.")
        sys.exit(1)
    keys: set = set()
    for b in data:
        if not isinstance(b, dict) or "_comment" in b:
            continue
        uuid  = b.get("uuid", "")
        major = b.get("major")
        minor = b.get("minor")
        if uuid and major is not None and minor is not None:
            keys.add(f"{uuid.lower()}-{major}-{minor}")
    if not keys:
        log.error("Không tạo được beacon key nào từ %s (thiếu uuid/major/minor?)", path)
        sys.exit(1)
    return keys


# ─── BLE detection callback ──────────────────────────────────────────────────

def _detection_callback(device, adv_data):
    """Được gọi từ WinRT thread; chuyển sang asyncio queue."""
    if _loop is not None and _adv_queue is not None:
        _loop.call_soon_threadsafe(_adv_queue.put_nowait, (device, adv_data))


# ─── Advertisement processing ────────────────────────────────────────────────

async def _process_adv_queue():
    from ibeacon import decode_ibeacon, mask_key, IBeaconParseError

    while True:
        device, adv_data = await _adv_queue.get()
        try:
            mfr = dict(adv_data.manufacturer_data)
            parsed = decode_ibeacon(mfr)
        except IBeaconParseError:
            continue

        key = parsed["key"]

        if key not in _allowlist:
            continue

        now = time.monotonic()
        if now - _last_sent.get(key, 0.0) < THROTTLE_INTERVAL_S:
            continue
        _last_sent[key] = now

        msg = json.dumps({
            "key":       key,
            "rssi":      adv_data.rssi,
            "txPower":   parsed["tx_power"],
            "timestamp": int(time.time() * 1000),
            "source":    "laptop",
        })
        log.debug("→ %s  rssi=%d", mask_key(key), adv_data.rssi)
        await _broadcast(msg)


async def _broadcast(msg: str):
    if not _clients:
        return
    dead = set()
    results = await asyncio.gather(
        *[c.send(msg) for c in _clients],
        return_exceptions=True,
    )
    for client, result in zip(list(_clients), results):
        if isinstance(result, Exception):
            dead.add(client)
    _clients.difference_update(dead)


# ─── WebSocket handler ───────────────────────────────────────────────────────

async def _ws_handler(websocket):
    _clients.add(websocket)
    log.info("Client kết nối (%d client đang hoạt động)", len(_clients))
    try:
        async for _ in websocket:
            pass  # không cần xử lý tin nhắn từ client
    finally:
        _clients.discard(websocket)
        log.info("Client ngắt kết nối (%d client còn lại)", len(_clients))


# ─── BLE scanner với retry ───────────────────────────────────────────────────

async def _start_scanner_with_retry(BleakScanner, BleakError):
    for attempt in range(1, BT_MAX_RETRIES + 1):
        try:
            scanner = BleakScanner(detection_callback=_detection_callback)
            await scanner.start()
            log.info("BLE scanner đã bắt đầu (lần thử %d/%d)", attempt, BT_MAX_RETRIES)
            return scanner
        except BleakError as exc:
            log.warning("Bluetooth lỗi (lần %d/%d): %s", attempt, BT_MAX_RETRIES, exc)
            if attempt < BT_MAX_RETRIES:
                log.info("Thử lại sau %ds…", BT_RETRY_INTERVAL_S)
                await asyncio.sleep(BT_RETRY_INTERVAL_S)
    log.error("Không thể khởi động BLE scanner sau %d lần thử.", BT_MAX_RETRIES)
    sys.exit(1)


# ─── Main ────────────────────────────────────────────────────────────────────

async def _run(port: int, allowlist_path: Path, beacons_path: Path | None = None):
    global _adv_queue, _loop, _allowlist

    # Import có thể thất bại nếu chưa cài gói — hiện thông báo rõ
    try:
        from bleak import BleakScanner
        from bleak.exc import BleakError
        import websockets
    except ImportError as exc:
        log.error(
            "Thiếu gói: %s\n"
            "  Chạy: .venv/Scripts/activate && pip install -r requirements.txt",
            exc,
        )
        sys.exit(1)

    if beacons_path is not None:
        _allowlist = load_allowlist_from_beacons(beacons_path)
        log.info("Allowlist từ beacons file: %d key(s) đã nạp", len(_allowlist))
    else:
        _allowlist = load_allowlist(allowlist_path)
        log.info("Allowlist: %d beacon key(s) đã nạp", len(_allowlist))

    _loop = asyncio.get_running_loop()
    _adv_queue = asyncio.Queue()

    scanner = await _start_scanner_with_retry(BleakScanner, BleakError)

    async with websockets.serve(_ws_handler, "127.0.0.1", port):
        log.info("WebSocket server: ws://127.0.0.1:%d", port)
        log.info("Đang lắng nghe iBeacon… (Ctrl+C để dừng)")
        proc_task = asyncio.create_task(_process_adv_queue())
        try:
            await asyncio.Future()  # chạy mãi
        except asyncio.CancelledError:
            pass
        finally:
            proc_task.cancel()
            await scanner.stop()
            log.info("Đã dừng scanner và WebSocket server.")


def main():
    parser = argparse.ArgumentParser(
        description="Cầu nối BLE iBeacon → WebSocket cho trang quản trị beacon."
    )
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT,
        help=f"Cổng WebSocket (mặc định: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--allowlist", type=Path,
        default=Path(__file__).parent / "allowlist.json",
        help="Đường dẫn đến allowlist.json (mặc định: allowlist.json cùng thư mục)"
    )
    parser.add_argument(
        "--beacons", type=Path, default=None,
        help=(
            "Đường dẫn đến beacons.local.json để tự tạo allowlist "
            "(thay cho --allowlist; ví dụ: ../../data/beacons.local.json)"
        ),
    )
    args = parser.parse_args()

    try:
        asyncio.run(_run(args.port, args.allowlist, args.beacons))
    except KeyboardInterrupt:
        log.info("Đã nhận Ctrl+C — dừng bridge.")


if __name__ == "__main__":
    main()
