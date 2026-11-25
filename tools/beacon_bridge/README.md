# Beacon Bridge — Cầu nối BLE iBeacon → WebSocket

Script Python chạy trên laptop Windows, quét tín hiệu BLE từ beacon DFRobot TEL0149
và phát dữ liệu ra WebSocket để trang quản trị (`beacon-admin.html`) nhận.

## Yêu cầu

- Python 3.9+
- Laptop Windows có Bluetooth adapter (hoặc USB dongle)
- Beacon DFRobot TEL0149 đã cấu hình iBeacon (Run-in-RAM hoặc Burned)

## Cài đặt (một lần)

```bash
# 1. Tạo venv riêng trong thư mục này
python -m venv .venv

# 2. Kích hoạt venv
.venv/Scripts/activate          # Windows CMD/PowerShell

# 3. Cài gói
pip install -r requirements.txt
```

> **Lưu ý:** đây là venv RIÊNG, không liên quan đến `tools/.venv`
> (dành cho build_floor.py).

## Cấu hình allowlist

```bash
# Sao chép mẫu
copy allowlist.json.example allowlist.json

# Mở allowlist.json, điền key thật của từng beacon:
# Key format: "{uuid-lowercase}-{major}-{minor}"
# Ví dụ: "fef3b5fd-0000-0000-0000-000000000001-1-1"
```

File `allowlist.json` đã được gitignore — KHÔNG commit để tránh lộ UUID thật.

## Chạy bridge

```bash
# Kích hoạt venv trước
.venv/Scripts/activate

# Chạy với cài đặt mặc định (port 8765)
python bridge.py

# Hoặc chỉ định port và allowlist khác
python bridge.py --port 8765 --allowlist allowlist.json
```

## Chạy tests logic giải mã (không cần Bluetooth)

```bash
python -m unittest test_ibeacon -v
```

## Message format (WebSocket)

Bridge gửi từng dòng JSON:

```json
{
  "key":       "uuid-lowercase-major-minor",
  "rssi":      -68,
  "txPower":   -59,
  "timestamp": 1730000000000,
  "source":    "laptop"
}
```

Chỉ gửi beacon có key trong `allowlist.json`, tối đa 5 lần/giây/beacon.
Server chỉ lắng nghe `127.0.0.1` — không mở ra mạng ngoài.
