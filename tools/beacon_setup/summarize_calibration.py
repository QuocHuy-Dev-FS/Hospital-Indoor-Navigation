"""
summarize_calibration.py — Tóm tắt thống kê và hồi quy từ CSV đo RSSI.

Định dạng CSV đầu vào (header bắt buộc):
    beaconRef,distance_m,condition,sampleIndex,rssi_dBm,timestamp,notes

Kết quả in ra stdout:
  - Mỗi khoảng cách: n mẫu (sau lọc IQR), RSSI trung bình, trung vị, độ lệch chuẩn.
  - Hồi quy mô hình log-distance: RSSI = A − 10·n·log10(d)
    → Báo A (RSSI tại 1 m = Measured Power), n (path-loss exponent), R².
  - Cảnh báo khi số mẫu < 30, σ bất thường, RSSI không giảm theo d.
  - Đề xuất giá trị Measured Power để điền vào beacon (không tự sửa file).

Sử dụng:
    python tools/beacon_setup/summarize_calibration.py bench/measurements/<file>.csv
    python tools/beacon_setup/summarize_calibration.py bench/measurements/<file>.csv --condition "Hành lang trống"
"""

import argparse
import csv
import math
import statistics
import sys
from pathlib import Path

MIN_SAMPLES    = 30
IQR_FENCE      = 1.5    # hệ số IQR để lọc ngoại lai
WARN_STD_HIGH  = 8.0    # dBm — cảnh báo nếu σ vượt ngưỡng này


# ─── Đọc CSV ─────────────────────────────────────────────────────────────────

def _parse_csv(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rssi_str = row.get("rssi_dBm", "").strip()
            dist_str = row.get("distance_m", "").strip()
            if not rssi_str or not dist_str:
                continue
            try:
                rows.append({
                    "beaconRef":  row.get("beaconRef", "").strip(),
                    "distance_m": float(dist_str),
                    "condition":  row.get("condition", "").strip(),
                    "rssi_dBm":   float(rssi_str),
                })
            except ValueError:
                continue
    return rows


# ─── Lọc IQR ────────────────────────────────────────────────────────────────

def _iqr_filter(values: list[float]) -> list[float]:
    if len(values) < 4:
        return values
    q1 = statistics.quantiles(values, n=4)[0]
    q3 = statistics.quantiles(values, n=4)[2]
    iqr = q3 - q1
    lo  = q1 - IQR_FENCE * iqr
    hi  = q3 + IQR_FENCE * iqr
    return [v for v in values if lo <= v <= hi]


# ─── Hồi quy log-distance ────────────────────────────────────────────────────
# Mô hình: RSSI(d) = A − 10·n·log10(d)
# Đặt x = log10(d), y = RSSI → hồi quy tuyến tính y = b + m·x
#   b = A  (RSSI tại d=1 m),  m = −10·n

def _regression(points: list[tuple[float, float]]) -> tuple[float, float, float]:
    """OLS đơn biến. Trả về (A, n, R²). `points` là [(d, rssi), ...]."""
    if len(points) < 2:
        return (float("nan"), float("nan"), float("nan"))

    xs = [math.log10(d) for d, _ in points]
    ys = [r for _, r in points]

    n  = len(xs)
    sx = sum(xs);  sy = sum(ys)
    sx2 = sum(xi * xi for xi in xs)
    sxy = sum(xi * yi for xi, yi in zip(xs, ys))

    denom = n * sx2 - sx * sx
    if abs(denom) < 1e-12:
        return (float("nan"), float("nan"), float("nan"))

    m_coeff = (n * sxy - sx * sy) / denom
    b_coeff = (sy - m_coeff * sx) / n

    # R²
    y_mean = sy / n
    ss_tot = sum((yi - y_mean) ** 2 for yi in ys)
    ss_res = sum((yi - (b_coeff + m_coeff * xi)) ** 2 for xi, yi in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-12 else float("nan")

    A = b_coeff
    n_exp = -m_coeff / 10.0
    return (A, n_exp, r2)


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tóm tắt thống kê và hồi quy từ CSV đo RSSI."
    )
    parser.add_argument("csv_file", type=Path, help="Đường dẫn file CSV đo RSSI")
    parser.add_argument(
        "--condition", default=None,
        help="Lọc theo điều kiện đo (ví dụ: 'Hành lang trống'). Mặc định: gộp tất cả."
    )
    args = parser.parse_args()

    if not args.csv_file.exists():
        print(f"LỖI: Không tìm thấy file: {args.csv_file}", file=sys.stderr)
        return 1

    rows = _parse_csv(args.csv_file)
    if not rows:
        print("LỖI: Không có dữ liệu hợp lệ trong CSV.", file=sys.stderr)
        return 1

    if args.condition:
        rows = [r for r in rows if r["condition"] == args.condition]
        if not rows:
            print(f"LỖI: Không có dữ liệu cho condition={args.condition!r}", file=sys.stderr)
            return 1

    # Nhóm theo khoảng cách
    by_dist: dict[float, list[float]] = {}
    for r in rows:
        d = r["distance_m"]
        by_dist.setdefault(d, []).append(r["rssi_dBm"])

    distances = sorted(by_dist.keys())

    cond_label = args.condition or "(tất cả điều kiện)"
    beacon_refs = sorted({r["beaconRef"] for r in rows if r["beaconRef"]})
    print("=" * 64)
    print(f"TỔNG HỢP HIỆU CHỈNH RSSI")
    print(f"  File:      {args.csv_file.name}")
    print(f"  Điều kiện: {cond_label}")
    print(f"  Beacon:    {', '.join(beacon_refs) if beacon_refs else '(không rõ)'}")
    print(f"  Tổng mẫu:  {len(rows)} (trước lọc IQR)")
    print("=" * 64)

    warnings: list[str] = []
    filtered_stats: dict[float, dict] = {}

    print(f"\n{'Khoảng cách':>12}  {'n':>5}  {'mean':>7}  {'median':>7}  {'σ':>6}  {'min':>7}  {'max':>7}")
    print("-" * 60)

    for d in distances:
        raw    = by_dist[d]
        clean  = _iqr_filter(raw)
        n      = len(clean)
        if n < 2:
            print(f"  {d:>9.1f} m  {n:>5}  (không đủ mẫu sau lọc IQR)")
            continue

        mu     = statistics.mean(clean)
        med    = statistics.median(clean)
        sigma  = statistics.stdev(clean)
        lo     = min(clean)
        hi     = max(clean)
        outliers = len(raw) - n

        flag = ""
        if n < MIN_SAMPLES:
            warnings.append(f"d={d} m: chỉ có {n} mẫu (kỳ vọng ≥{MIN_SAMPLES}).")
            flag = " ⚠️"
        if sigma > WARN_STD_HIGH:
            warnings.append(f"d={d} m: σ={sigma:.1f} dBm quá cao (>{WARN_STD_HIGH} dBm).")
            flag += " ⚠️"

        print(
            f"  {d:>9.1f} m  {n:>5}  {mu:>7.1f}  {med:>7.1f}  {sigma:>6.1f}  {lo:>7.1f}  {hi:>7.1f}"
            + (f"  (loại {outliers} ngoại lai)" if outliers else "") + flag
        )
        filtered_stats[d] = {"mean": mu, "n": n}

    # ── Cảnh báo RSSI không giảm theo d ─────────────────────────────────────
    prev_mean: float | None = None
    prev_d:    float | None = None
    for d in distances:
        s = filtered_stats.get(d)
        if s is None:
            continue
        if prev_mean is not None and s["mean"] > prev_mean + 2.0:
            warnings.append(
                f"RSSI tại d={d} m ({s['mean']:.1f} dBm) cao hơn "
                f"d={prev_d} m ({prev_mean:.1f} dBm) — tín hiệu KHÔNG giảm đúng."
            )
        prev_mean = s["mean"]
        prev_d    = d

    # ── Hồi quy ─────────────────────────────────────────────────────────────
    reg_points = [
        (d, st["mean"])
        for d, st in filtered_stats.items()
        if d > 0
    ]
    A, n_exp, r2 = _regression(reg_points)

    print("\n" + "-" * 64)
    print("HỒI QUY  RSSI(d) = A − 10·n·log10(d)")
    if math.isnan(A):
        print("  Không đủ điểm dữ liệu để hồi quy.")
    else:
        print(f"  A (RSSI tại 1 m = Measured Power đề xuất) : {A:.1f} dBm")
        print(f"  n (path-loss exponent)                     : {n_exp:.3f}")
        print(f"  R²                                         : {r2:.4f}")
        if r2 < 0.85:
            warnings.append(
                f"R²={r2:.3f} thấp (<0.85) — mô hình log-distance khớp kém "
                f"với dữ liệu đo. Kiểm tra lại điều kiện đo."
            )

    # ── Cảnh báo ─────────────────────────────────────────────────────────────
    if warnings:
        print("\n⚠️  CẢNH BÁO:")
        for w in warnings:
            print(f"  - {w}")

    # ── Đề xuất ──────────────────────────────────────────────────────────────
    print("\n📌 ĐỀ XUẤT:")
    if not math.isnan(A):
        print(f"  Measured Power (txPower_dBm / rssiAt1m): {A:.0f} dBm")
        print(
            "  Điền vào beacon trong beacons.local.json: "
            f'"rssiAt1m": {A:.0f}'
        )
    else:
        print("  Không tính được — thiếu dữ liệu.")
    print("  (Script không tự sửa file nào.)")

    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
