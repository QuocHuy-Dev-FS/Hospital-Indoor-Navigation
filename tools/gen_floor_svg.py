"""
gen_floor_svg.py  –  Xuất SVG mặt bằng tầng để khoanh vị trí phòng khảo sát.
Mỗi phòng: viền + nhãn "ID – tên". Có thước tỉ lệ, mũi tên X/Z, tô màu
phòng landmark.

Dùng chỉ thư viện chuẩn Python (không cần cài thêm).

Usage:
    python tools/gen_floor_svg.py [--floor F1] [--floor F2]
    Mặc định: xuất cả F1 và F2 vào docs/survey/
"""
import json, argparse, pathlib, math, textwrap

# ── Cấu hình ──────────────────────────────────────────────────────────────────
ROOMS_FILE   = "data/rooms.json"
OUTPUT_DIR   = "docs/survey"
SCALE        = 18          # px / mét
MARGIN       = 60          # px xung quanh bản đồ
FONT_SIZE    = 9           # px nhãn phòng thường
FONT_SMALL   = 7
A4_W_PX      = 794         # A4 portrait 96dpi
A4_H_PX      = 1123

# Màu phòng theo type (fill)
TYPE_COLOR = {
    "elevator": "#b3d9ff",
    "stairs":   "#ffd9b3",
    "wc":       "#d9f0d9",
    "entrance": "#fff0b3",
    "office":   "#ede8f5",
    "clinic":   "#fce8e8",
    "lab":      "#e8f0fc",
    "pharmacy": "#e8fcf0",
    "storage":  "#f5f0e8",
    "corridor": "#f8f8f8",
    "other":    "#f0f0f0",
}
LANDMARK_STROKE = "#e53935"   # viền đỏ cho phòng đã xác định landmark
LANDMARK_FILL   = "#fff3e0"   # nền cam nhạt
DEFAULT_STROKE  = "#666"
DEFAULT_FILL    = "#f0f0f0"


def room_fill(room, landmark_ids):
    if room["id"] in landmark_ids:
        return LANDMARK_FILL
    return TYPE_COLOR.get(room["type"], DEFAULT_FILL)


def room_stroke(room, landmark_ids):
    if room["id"] in landmark_ids:
        return LANDMARK_STROKE
    return DEFAULT_STROKE


def trunc(text, maxlen=22):
    return text if len(text) <= maxlen else text[:maxlen - 1] + "…"


def make_svg(rooms, floor_id, landmark_ids, scale=SCALE, margin=MARGIN):
    """Tạo chuỗi SVG cho một tầng."""
    # Tính kích thước canvas
    xs1 = [r["bounds"]["x1"] for r in rooms]
    zs1 = [r["bounds"]["z1"] for r in rooms]
    xs2 = [r["bounds"]["x2"] for r in rooms]
    zs2 = [r["bounds"]["z2"] for r in rooms]
    min_x, max_x = min(xs1), max(xs2)
    min_z, max_z = min(zs1), max(zs2)
    floor_w = (max_x - min_x) * scale
    floor_h = (max_z - min_z) * scale

    title_area = 36
    legend_area = 28
    canvas_w = floor_w + 2 * margin
    canvas_h = floor_h + 2 * margin + title_area + legend_area

    def px(v_m, axis):
        if axis == "x":
            return margin + (v_m - min_x) * scale
        return margin + title_area + (v_m - min_z) * scale

    lines = []

    # ── SVG header ─────────────────────────────────────────────────────────
    lines.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{canvas_w:.0f}" height="{canvas_h:.0f}" '
        f'viewBox="0 0 {canvas_w:.0f} {canvas_h:.0f}" '
        f'style="font-family:Arial,Helvetica,sans-serif;background:#fff">'
    )

    # ── Tiêu đề ────────────────────────────────────────────────────────────
    lines.append(
        f'<text x="{canvas_w/2:.0f}" y="22" '
        f'font-size="14" font-weight="bold" text-anchor="middle" fill="#222">'
        f'Sơ đồ mặt bằng – {floor_id} (BV Quân y 7A – dữ liệu thử nghiệm)</text>'
    )

    # ── Phòng ──────────────────────────────────────────────────────────────
    for r in rooms:
        b = r["bounds"]
        rx = px(b["x1"], "x")
        ry = px(b["z1"], "z")
        rw = (b["x2"] - b["x1"]) * scale
        rh = (b["z2"] - b["z1"]) * scale
        fill   = room_fill(r, landmark_ids)
        stroke = room_stroke(r, landmark_ids)
        sw = 2 if r["id"] in landmark_ids else 0.8
        lines.append(
            f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        )
        # Nhãn: dòng 1 = ID, dòng 2 = tên (cắt ngắn)
        cx = rx + rw / 2
        cy = ry + rh / 2
        fs = FONT_SIZE if rw > 40 and rh > 20 else FONT_SMALL
        # chỉ in khi phòng đủ rộng
        if rw > 18 and rh > 12:
            id_str   = r["id"]
            name_str = trunc(r["name"], 20)
            lines.append(
                f'<text x="{cx:.1f}" y="{cy:.1f}" font-size="{fs}" '
                f'text-anchor="middle" dominant-baseline="middle" '
                f'fill="#111" font-weight="bold">{id_str}</text>'
            )
            if rh > 24:
                lines.append(
                    f'<text x="{cx:.1f}" y="{cy + fs + 2:.1f}" font-size="{fs-1}" '
                    f'text-anchor="middle" dominant-baseline="middle" '
                    f'fill="#444">{name_str}</text>'
                )

    # ── Mũi tên trục X (→ Đông) ────────────────────────────────────────────
    ax_y = px(max_z, "z") + 20
    ax_x0 = px(min_x, "x")
    ax_x1 = ax_x0 + 50
    lines.append(
        f'<line x1="{ax_x0:.0f}" y1="{ax_y:.0f}" x2="{ax_x1:.0f}" y2="{ax_y:.0f}" '
        f'stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>'
    )
    lines.append(
        f'<text x="{ax_x1+5:.0f}" y="{ax_y+4:.0f}" font-size="9" fill="#333">X (Đông)</text>'
    )

    # ── Mũi tên trục Z (↓ Nam) ────────────────────────────────────────────
    az_x = px(min_x, "x") - 20
    az_z0 = px(min_z, "z")
    az_z1 = az_z0 + 50
    lines.append(
        f'<line x1="{az_x:.0f}" y1="{az_z0:.0f}" x2="{az_x:.0f}" y2="{az_z1:.0f}" '
        f'stroke="#333" stroke-width="1.5" marker-end="url(#arrow)"/>'
    )
    lines.append(
        f'<text x="{az_x-4:.0f}" y="{az_z1+12:.0f}" font-size="9" fill="#333" '
        f'text-anchor="middle">Z (Nam)</text>'
    )

    # ── Thước tỉ lệ (5 m) ─────────────────────────────────────────────────
    sb_len = 5 * scale   # 5 mét
    sb_x0  = canvas_w - margin - sb_len
    sb_y   = canvas_h - legend_area + 12
    lines.append(
        f'<line x1="{sb_x0:.0f}" y1="{sb_y:.0f}" x2="{sb_x0+sb_len:.0f}" y2="{sb_y:.0f}" '
        f'stroke="#333" stroke-width="2"/>'
    )
    # ticks đầu và cuối
    for tx in [sb_x0, sb_x0 + sb_len]:
        lines.append(
            f'<line x1="{tx:.0f}" y1="{sb_y-4:.0f}" x2="{tx:.0f}" y2="{sb_y+4:.0f}" '
            f'stroke="#333" stroke-width="2"/>'
        )
    lines.append(
        f'<text x="{sb_x0+sb_len/2:.0f}" y="{sb_y+14:.0f}" '
        f'font-size="9" text-anchor="middle" fill="#333">5 m</text>'
    )

    # ── Legend landmark ────────────────────────────────────────────────────
    lx, ly = margin, canvas_h - legend_area + 8
    lines.append(
        f'<rect x="{lx}" y="{ly}" width="12" height="10" '
        f'fill="{LANDMARK_FILL}" stroke="{LANDMARK_STROKE}" stroke-width="1.5"/>'
    )
    lines.append(
        f'<text x="{lx+16}" y="{ly+9}" font-size="9" fill="#333">'
        f'Phòng đã xác định từ ảnh khảo sát</text>'
    )
    if landmark_ids:
        ids_str = ", ".join(sorted(landmark_ids))
        lines.append(
            f'<text x="{lx+16}" y="{ly+20}" font-size="8" fill="#888">'
            f'{ids_str}</text>'
        )

    # ── Arrow marker def ───────────────────────────────────────────────────
    lines.append(
        '<defs><marker id="arrow" markerWidth="8" markerHeight="8" '
        'refX="6" refY="3" orient="auto">'
        '<path d="M0,0 L0,6 L8,3 z" fill="#333"/>'
        '</marker></defs>'
    )

    lines.append("</svg>")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Xuất SVG mặt bằng tầng")
    parser.add_argument("--floor", action="append", default=None,
                        help="ID tầng cần xuất (mặc định: F1 và F2)")
    parser.add_argument("--rooms", default=ROOMS_FILE)
    parser.add_argument("--out", default=OUTPUT_DIR)
    args = parser.parse_args()

    floors = args.floor or ["F1", "F2"]
    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    rooms_all = json.loads(pathlib.Path(args.rooms).read_text(encoding="utf-8"))

    # Các phòng đã xác định qua ảnh (có roomId cụ thể)
    landmark_by_floor = {
        "F1": {"F1_R013"},          # cụm thang máy 3 cửa (PH_008)
        "F2": {"F2_R013"},          # ứng viên giếng trời (PH_010, PH_012)
    }

    results = {}
    for fid in floors:
        rooms = [r for r in rooms_all if r["floorId"] == fid]
        if not rooms:
            print(f"[WARN] Không tìm thấy phòng nào cho {fid}")
            continue
        landmarks = landmark_by_floor.get(fid, set())
        svg = make_svg(rooms, fid, landmarks)
        out_path = out_dir / f"{fid}.svg"
        out_path.write_text(svg, encoding="utf-8")
        results[fid] = {"rooms": len(rooms), "path": str(out_path)}
        print(f"[OK] {fid}: {len(rooms)} phòng → {out_path}")

    # Đếm nhãn để kiểm chứng
    for fid, info in results.items():
        content = pathlib.Path(info["path"]).read_text(encoding="utf-8")
        label_count = content.count("font-weight=\"bold\"") - 1  # trừ tiêu đề
        print(f"     {fid}: {label_count} nhãn đậm (trong {info['rooms']} phòng)")


if __name__ == "__main__":
    main()
