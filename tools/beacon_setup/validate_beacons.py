"""
validate_beacons.py — Kiểm tra tính hợp lệ của file cấu hình beacon.

Sử dụng:
    python tools/beacon_setup/validate_beacons.py [--file PATH]

Mặc định đọc data/beacons.local.json (từ thư mục gốc repo).
Chấp nhận cả file mẫu (beacons.local.example.json) khi debug.

Kiểm tra:
  - id đúng mẫu F<1-9>_B<NN>
  - major = số tầng trong id, minor = số thứ tự trong id
  - floorId khớp id (F1_B02 → floorId = F1)
  - Không trùng id, không trùng (major, minor)
  - Mọi beacon cùng UUID, UUID đúng định dạng UUID4
  - x, z là số
  - status ∈ tập hợp cho phép

Exit 0 nếu không có lỗi; exit 1 nếu có lỗi.
"""

import argparse
import json
import re
import sys
from pathlib import Path

UUID_RE   = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
ID_RE     = re.compile(r'^F([1-9])_B(\d{2})$')
VALID_STATUS = {"planned", "installed", "active", "inactive", "deprecated"}

_REPO_ROOT = Path(__file__).resolve().parents[2]


def _mask(uuid_str: str) -> str:
    """Hiển thị 4 ký tự đầu UUID, che phần còn lại."""
    if not uuid_str:
        return "<trống>"
    return uuid_str[:4] + "****-****-****-****-************"


def validate(beacons: list) -> list[str]:
    """Trả về danh sách lỗi (rỗng = hợp lệ)."""
    errors = []

    seen_ids:        dict[str, int] = {}
    seen_major_minor: dict[tuple, int] = {}
    uuids:           list[str] = []

    for i, b in enumerate(beacons):
        label = f"[{i}] id={b.get('id', '<thiếu>')!r}"

        # ── id ───────────────────────────────────────────────────────────────
        bid = b.get("id", "")
        m = ID_RE.match(str(bid))
        if not m:
            errors.append(f"{label}: id không đúng mẫu F<1-9>_B<NN> (nhận được {bid!r})")
            continue  # không thể kiểm tra major/minor nếu id sai

        floor_num = int(m.group(1))
        seq_num   = int(m.group(2))

        # ── major ────────────────────────────────────────────────────────────
        major = b.get("major")
        if major is None:
            errors.append(f"{label}: thiếu trường 'major'")
        elif not isinstance(major, int) or major != floor_num:
            errors.append(
                f"{label}: major={major} không khớp số tầng trong id (kỳ vọng {floor_num})"
            )

        # ── minor ────────────────────────────────────────────────────────────
        minor = b.get("minor")
        if minor is None:
            errors.append(f"{label}: thiếu trường 'minor'")
        elif not isinstance(minor, int) or minor != seq_num:
            errors.append(
                f"{label}: minor={minor} không khớp số thứ tự trong id (kỳ vọng {seq_num})"
            )

        # ── floorId ──────────────────────────────────────────────────────────
        expected_floor_id = f"F{floor_num}"
        floor_id = b.get("floorId", "")
        if floor_id != expected_floor_id:
            errors.append(
                f"{label}: floorId={floor_id!r} không khớp (kỳ vọng {expected_floor_id!r})"
            )

        # ── trùng id ─────────────────────────────────────────────────────────
        if bid in seen_ids:
            errors.append(
                f"{label}: id trùng với mục [{seen_ids[bid]}]"
            )
        else:
            seen_ids[bid] = i

        # ── trùng (major, minor) ─────────────────────────────────────────────
        if major is not None and minor is not None:
            key = (major, minor)
            if key in seen_major_minor:
                errors.append(
                    f"{label}: (major={major}, minor={minor}) trùng với mục [{seen_major_minor[key]}]"
                )
            else:
                seen_major_minor[key] = i

        # ── uuid ─────────────────────────────────────────────────────────────
        uuid = b.get("uuid", "")
        if not uuid:
            errors.append(f"{label}: thiếu hoặc rỗng trường 'uuid'")
        elif not UUID_RE.match(str(uuid).lower()):
            errors.append(f"{label}: uuid không đúng định dạng UUID ({_mask(str(uuid))})")
        else:
            uuids.append(str(uuid).lower())

        # ── x, z ─────────────────────────────────────────────────────────────
        for field in ("x", "z"):
            val = b.get(field)
            if val is None:
                errors.append(f"{label}: thiếu trường '{field}'")
            elif not isinstance(val, (int, float)):
                errors.append(f"{label}: '{field}' phải là số, nhận được {val!r}")

        # ── status ───────────────────────────────────────────────────────────
        status = b.get("status")
        if status is None:
            errors.append(f"{label}: thiếu trường 'status'")
        elif status not in VALID_STATUS:
            errors.append(
                f"{label}: status={status!r} không hợp lệ "
                f"(cho phép: {sorted(VALID_STATUS)})"
            )

    # ── Tất cả cùng UUID ─────────────────────────────────────────────────────
    unique_uuids = set(uuids)
    if len(unique_uuids) > 1:
        masked = [_mask(u) for u in sorted(unique_uuids)]
        errors.append(
            f"Không phải tất cả beacon cùng UUID. Tìm thấy {len(unique_uuids)} UUID khác nhau: "
            + ", ".join(masked)
        )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Kiểm tra file cấu hình beacon.")
    parser.add_argument(
        "--file",
        type=Path,
        default=_REPO_ROOT / "data" / "beacons.local.json",
        help="Đường dẫn file JSON cần kiểm tra (mặc định: data/beacons.local.json)",
    )
    args = parser.parse_args()

    path: Path = args.file
    if not path.is_absolute():
        path = Path.cwd() / path

    if not path.exists():
        print(f"[validate_beacons] LỖI: Không tìm thấy file: {path}", file=sys.stderr)
        print(
            "  Tạo file bằng: powershell -File tools\\beacon_setup\\new_project_uuid.ps1",
            file=sys.stderr,
        )
        return 1

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[validate_beacons] LỖI: File không phải JSON hợp lệ: {exc}", file=sys.stderr)
        return 1

    if not isinstance(raw, list):
        print("[validate_beacons] LỖI: File phải là JSON array.", file=sys.stderr)
        return 1

    # Bỏ qua các object có _comment (từ file example)
    beacons = [b for b in raw if isinstance(b, dict) and "_comment" not in b]

    if not beacons:
        print("[validate_beacons] CẢNH BÁO: Không có beacon nào để kiểm tra.")
        return 0

    errors = validate(beacons)

    if errors:
        print(f"[validate_beacons] {len(errors)} LỖI trong {path.name}:", file=sys.stderr)
        for e in errors:
            print(f"  ✗ {e}", file=sys.stderr)
        return 1

    print(
        f"[validate_beacons] OK — {len(beacons)} beacon hợp lệ trong {path.name}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
