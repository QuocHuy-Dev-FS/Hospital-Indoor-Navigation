"""
Pipeline orchestrator.

Usage:
    tools/.venv/Scripts/python tools/floorplan/run_pipeline.py <image_path> --floor F1

Reads:
    data/sample/F1/overrides.json  (optional, label overrides)

Writes:
    data/sample/F1/rooms.json, nodes.json, edges.json, connectors.json,
    geometry.json, floors.json, building.json, review.json
    data/sample/manifest.json
    data/sample/coordinate_system.json
    assets/floorplans/F1.meta.json
    assets/models/sample/F1.glb
    assets/floorplans/_debug/F1_*.jpg
"""
import argparse
import json
import sys
import os
import cv2
from pathlib import Path
from datetime import datetime, timezone

# Allow running as `python tools/floorplan/run_pipeline.py` from project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.floorplan.config import PipelineConfig
from tools.floorplan.extract import extract
from tools.floorplan.scale import compute_scale
from tools.floorplan.geometry import (
    build_walls, build_rooms, build_doors,
    build_graph_geometry, build_connectors,
)
from tools.floorplan.build_graph import connect_doors_to_rooms, assign_connector_nodes, build_review_items
from tools.floorplan.overlay import draw_overlay, save_overlays
from tools.floorplan.build_glb import build_glb, export_glb, verify_glb


# ── I/O helpers ───────────────────────────────────────────────────────────────

def _write_json(path: str, data, indent=2):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
    print(f"  wrote {path}")


def _load_overrides(floor_id: str) -> dict:
    path = f"data/sample/{floor_id}/overrides.json"
    if Path(path).exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _create_default_overrides(floor_id: str, out_dir: str):
    """Create starter overrides.json with the 8 labelled rooms from prompt."""
    overrides = {
        "_comment": "anchorPx: pixel [x,y] inside the room (approximate). Update after running pipeline.",
        "rooms": [
            {"anchorPx": [1147, 62],  "name": "WC Nam",               "nameAscii": "wc nam",               "type": "wc"},
            {"anchorPx": [1150, 210], "name": "WC Nữ",                "nameAscii": "wc nu",                "type": "wc"},
            {"anchorPx": [855, 148],  "name": "Phòng Trưởng ban",     "nameAscii": "phong truong ban",     "type": "office"},
            {"anchorPx": [1005, 148], "name": "Phòng kỹ thuật",       "nameAscii": "phong ky thuat",       "type": "office"},
            {"anchorPx": [700, 561],  "name": "Phòng Hành chính",     "nameAscii": "phong hanh chinh",     "type": "office"},
            {"anchorPx": [1080, 561], "name": "Phòng Điều hành",      "nameAscii": "phong dieu hanh",      "type": "office"},
            {"anchorPx": [165, 1748], "name": "Trung Tâm dữ liệu",    "nameAscii": "trung tam du lieu",    "type": "other"},
            {"anchorPx": [398, 1785], "name": "Kho",                  "nameAscii": "kho",                  "type": "storage"},
        ]
    }
    _write_json(f"{out_dir}/overrides.json", overrides)


# ── main pipeline ─────────────────────────────────────────────────────────────

def run(image_path: str, floor_id: str):
    cfg = PipelineConfig(floor_id=floor_id)
    out_dir = cfg.output_dir

    print(f"\n=== Pipeline F1 · {image_path} ===")

    # 0. Load image
    if not Path(image_path).exists():
        print(f"ERROR: ảnh không tồn tại: {image_path}")
        sys.exit(1)

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        print(f"ERROR: không đọc được ảnh: {image_path}")
        sys.exit(1)
    h, w = img_bgr.shape[:2]
    print(f"  ảnh {w}×{h} px")

    # 1. Extraction
    print("1. Trích xuất...")
    raw = extract(img_bgr, cfg)
    print(f"   tường: {len(raw.wall_segments)}, junctions: {len(raw.junction_pts)}, endpoints: {len(raw.endpoint_pts)}")
    print(f"   door arcs: {len(raw.door_arcs)}, stairs: {len(raw.stair_regions)}, elevators: {len(raw.elev_regions)}")

    # 2. Scale
    print("2. Tỉ lệ...")
    scale_result = compute_scale(raw.door_radii_px, raw.stair_pitches_px, cfg)
    px_per_m = scale_result["px_per_m"]
    img_w_m = round(w / px_per_m, 3)
    img_h_m = round(h / px_per_m, 3)
    print(f"   px_per_m={px_per_m:.2f} (method={scale_result['method']}), kích thước ~{img_w_m}m × {img_h_m}m")
    for warn in scale_result.get("warnings", []):
        print(f"   WARN: {warn}")

    # 3. Overrides
    if not Path(f"{out_dir}/overrides.json").exists():
        print("3. Tạo overrides.json mặc định...")
        _create_default_overrides(floor_id, out_dir)
    overrides = _load_overrides(floor_id)

    # 4. Geometry
    print("4. Hình học...")
    walls = build_walls(raw, px_per_m, cfg)
    rooms, room_review = build_rooms(raw, px_per_m, cfg, overrides)
    doors = build_doors(raw, px_per_m, cfg)
    nodes, edges = build_graph_geometry(raw, px_per_m, cfg, doors)
    connectors = build_connectors(raw, cfg)
    print(f"   tường: {len(walls)}, phòng: {len(rooms)}, cửa: {len(doors)}, nút: {len(nodes)}, cạnh: {len(edges)}, connector: {len(connectors)}")

    # 5. Graph completion
    print("5. Đồ thị...")
    connect_doors_to_rooms(rooms, nodes, edges, doors, cfg)
    assign_connector_nodes(connectors, nodes, edges, cfg)

    # 6. Review items
    review_items = list(room_review)
    review_items += build_review_items(rooms, doors, connectors, nodes, edges)

    # Scale warnings → review
    for warn in scale_result.get("warnings", []):
        review_items.append({"type": "scale_warning", "message": warn})

    # Prompt's "Cần xác nhận" items
    review_items += [
        {"type": "need_confirm", "item": "scale.confirmed", "message": "Cần xác nhận: tỉ lệ thực tế (đo tại hiện trường)"},
        {"type": "need_confirm", "item": "floor_number",    "message": "Cần xác nhận: đây là tầng mấy, tổng số tầng"},
        {"type": "need_confirm", "item": "floor_height_m",  "message": "Cần xác nhận: chiều cao tầng/trần thực tế"},
        {"type": "need_confirm", "item": "room_names",      "message": "Cần xác nhận: tên và loại của phần lớn các phòng"},
        {"type": "need_confirm", "item": "blue_path",       "message": "Cần xác nhận: đường xanh có phải tuyến đi công cộng không"},
        {"type": "need_confirm", "item": "elevators",       "message": "Cần xác nhận: ô gạch chéo là thang máy hay giếng/ống kỹ thuật"},
        {"type": "need_confirm", "item": "stair_directions","message": "Cần xác nhận: hướng và tầng đích của 3 cầu thang"},
        {"type": "need_confirm", "item": "entrance",        "message": "Cần xác nhận: lối vào chính/sảnh"},
        {"type": "need_confirm", "item": "wall_thickness",  "message": "Cần xác nhận: độ dày tường, độ rộng cửa thực tế"},
        {"type": "need_confirm", "item": "real_doors",      "message": "Cần xác nhận: phòng nào thực sự có cửa (nhiều phòng không thấy ký hiệu cửa)"},
        {"type": "need_confirm", "item": "left_block",      "message": "Cần xác nhận: khối chữ nhật lớn bên trái (~x20–317) là gì"},
        {"type": "need_confirm", "item": "north_angle",     "message": "Cần xác nhận: hướng Bắc"},
        {"type": "need_confirm", "item": "image_crop",      "message": "Cần xác nhận: ảnh có bị cắt mép không"},
    ]

    # 7. Debug overlay (max 3 rounds – run once here)
    print("7. Overlay debug...")
    layers = draw_overlay(img_bgr, raw, rooms, doors, nodes, edges, px_per_m, cfg)
    written_overlays = save_overlays(layers, cfg.debug_dir, floor_id)
    print(f"   {len(written_overlays)} overlay ảnh → {cfg.debug_dir}/")

    # 8. Write data files
    print("8. Ghi dữ liệu...")

    # building.json
    building = {
        "id": "B1",
        "name": "Bệnh viện Quân y 7A",
        "version": "0.1.0-sample",
        "coordinateSystem": {
            "origin": {"x": 0, "y": 0, "z": 0},
            "northAngleDeg": cfg.north_angle_deg,
            "unit": "m",
            "note": "Gốc tạm = góc trên-trái ảnh; Cần xác nhận"
        },
        "floors": [floor_id]
    }
    _write_json(f"{out_dir}/../building.json", building)

    # floors.json
    floors = [{
        "id": floor_id,
        "buildingId": "B1",
        "level": 1,
        "name": "Tầng 1 (tạm)",
        "elevation_m": cfg.floor_elevation_m,
        "height_m": cfg.wall_height_m,
        "modelFile": f"assets/models/sample/{floor_id}.glb",
        "note": "Tầng tạm – Cần xác nhận số tầng và chiều cao thực tế"
    }]
    _write_json(f"{out_dir}/floors.json", floors)

    # rooms.json – strip internal fields
    rooms_out = []
    for r in rooms:
        ro = {k: v for k, v in r.items() if k not in ("polygon_m",)}
        rooms_out.append(ro)
    _write_json(f"{out_dir}/rooms.json", rooms_out)

    # geometry.json
    geo = {
        "floorId": floor_id,
        "walls": walls,
        "room_polygons": [
            {"roomId": r["id"], "polygon_m": r.get("polygon_m", [])} for r in rooms
        ],
        "doors": doors,
    }
    _write_json(f"{out_dir}/geometry.json", geo)

    # nodes.json
    _write_json(f"{out_dir}/nodes.json", nodes)

    # edges.json
    _write_json(f"{out_dir}/edges.json", edges)

    # connectors.json
    _write_json(f"{out_dir}/connectors.json", connectors)

    # review.json
    _write_json(f"{out_dir}/review.json", review_items)

    # coordinate_system.json
    coord_sys = {
        "origin": "top-left corner of floorplan image",
        "x_axis": "right (east, pixel +X)",
        "z_axis": "toward viewer / south (pixel +Y)",
        "y_axis": "up",
        "unit": "m",
        "northAngleDeg": cfg.north_angle_deg,
        "note": "Cần xác nhận hướng Bắc và gốc tọa độ tuyệt đối"
    }
    _write_json(cfg.coord_system_out, coord_sys)

    # manifest.json
    manifest = {
        "version": "0.1.0-sample",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "buildingId": "B1",
        "floorId": floor_id,
        "files": {
            "building": "building.json",
            "floors": f"{floor_id}/floors.json",
            "rooms": f"{floor_id}/rooms.json",
            "nodes": f"{floor_id}/nodes.json",
            "edges": f"{floor_id}/edges.json",
            "connectors": f"{floor_id}/connectors.json",
            "geometry": f"{floor_id}/geometry.json",
            "review": f"{floor_id}/review.json",
        }
    }
    _write_json(f"{out_dir}/../manifest.json", manifest)

    # F1.meta.json
    meta = {
        "floorId": floor_id,
        "sourceImage": str(Path(image_path).name),
        "capturedDate": "Cần xác nhận",
        "imageWidth_px": w,
        "imageHeight_px": h,
        "px_per_m": px_per_m,
        "scale": {
            "confirmed": False,
            "method": scale_result["method"],
            "door_px_per_m": scale_result["door_px_per_m"],
            "stair_px_per_m": scale_result["stair_px_per_m"],
            "mismatch": scale_result["mismatch"],
            "note": "Cần đo khoảng cách thực tế để xác nhận"
        },
        "wall_height_m": cfg.wall_height_m,
        "wall_thickness_m": cfg.wall_thickness_m,
        "floor_elevation_m": cfg.floor_elevation_m,
        "northAngleDeg": cfg.north_angle_deg,
        "scaleNote": "Cần xác nhận",
        "wallNote": "Cần xác nhận",
        "northNote": "Cần xác nhận",
    }
    _write_json(cfg.meta_out, meta)

    # 9. GLB
    print("9. Dựng GLB...")
    scene = build_glb(walls, rooms, doors, connectors, cfg, img_w_m, img_h_m)
    glb_size = export_glb(scene, cfg.model_out)
    print(f"   GLB: {cfg.model_out} ({glb_size/1024:.1f} KB)")

    # Verify GLB
    glb_check = verify_glb(cfg.model_out, rooms)
    if glb_check["errors"]:
        for e in glb_check["errors"]:
            print(f"   ERROR GLB: {e}")
    else:
        print(f"   GLB OK: {len(glb_check['geom_names'])} geometries, Y-axis up verified")

    # 10. Summary
    print("\n=== TÓM TẮT ===")
    print(f"  Phòng: {len(rooms)}, Tường: {len(walls)}, Cửa: {len(doors)}, Nút: {len(nodes)}, Cạnh: {len(edges)}, Connector: {len(connectors)}")
    print(f"  Mục Cần xác nhận: {len(review_items)}")
    print(f"  GLB: {glb_size/1024:.1f} KB")
    warn_count = len([x for x in review_items if x.get("severity") == "warning"])
    err_count  = len([x for x in review_items if x.get("severity") == "error"])
    print(f"  Review: {err_count} lỗi, {warn_count} cảnh báo, {len(review_items) - err_count - warn_count} mục cần xác nhận")
    print(f"  GLB errors: {len(glb_check['errors'])}")

    return {
        "rooms": len(rooms), "walls": len(walls), "doors": len(doors),
        "nodes": len(nodes), "edges": len(edges), "connectors": len(connectors),
        "glb_size_bytes": glb_size, "review_items": len(review_items),
        "glb_errors": glb_check["errors"],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="Path to floorplan image")
    parser.add_argument("--floor", default="F1", help="Floor ID (default: F1)")
    args = parser.parse_args()
    run(args.image, args.floor)
