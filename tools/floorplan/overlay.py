"""Generate debug overlay images onto the original floorplan."""
import cv2
import numpy as np
from pathlib import Path
from .extract import RawExtraction
from .config import PipelineConfig


def _color(hex_str: str) -> tuple:
    """#RRGGBB → (B, G, R) for OpenCV."""
    h = hex_str.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


def draw_overlay(
    img_bgr: np.ndarray,
    raw: RawExtraction,
    rooms: list,
    doors: list,
    nodes: list,
    edges: list,
    px_per_m: float,
    cfg: PipelineConfig,
) -> dict:
    """
    Draw multiple overlay layers. Returns dict of layer_name → annotated image.
    Writes nothing; caller saves via save_overlays().
    """
    layers = {}

    # --- 1. Blue-path skeleton + junctions + endpoints ---
    over_path = img_bgr.copy()
    if raw.blue_skeleton is not None:
        over_path[raw.blue_skeleton > 0] = _color("#00aaff")
    for px, py in raw.junction_pts:
        cv2.circle(over_path, (px, py), 5, _color("#ff4400"), -1)
    for px, py in raw.endpoint_pts:
        cv2.circle(over_path, (px, py), 4, _color("#ffaa00"), -1)
    layers["01_blue_path"] = over_path

    # --- 2. Wall segments ---
    over_walls = img_bgr.copy()
    for s in raw.wall_segments:
        cv2.line(over_walls, (s["x1"], s["y1"]), (s["x2"], s["y2"]), _color("#cc0000"), 2)
    layers["02_walls"] = over_walls

    # --- 3. Rooms + IDs ---
    over_rooms = img_bgr.copy()
    for room in rooms:
        cx = int(room["centroid"]["x"] * px_per_m)
        cz = int(room["centroid"]["z"] * px_per_m)
        cv2.circle(over_rooms, (cx, cz), 4, _color("#009900"), -1)
        cv2.putText(
            over_rooms, room["id"],
            (cx - 20, cz - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.35, _color("#005500"), 1, cv2.LINE_AA,
        )
        # bounding box
        poly = room.get("polygon_m", [])
        if poly:
            pts = [(int(p["x"] * px_per_m), int(p["z"] * px_per_m)) for p in poly]
            for i in range(len(pts)):
                cv2.line(over_rooms, pts[i], pts[(i + 1) % len(pts)], _color("#00bb00"), 1)
    layers["03_rooms"] = over_rooms

    # --- 4. Door arcs ---
    over_doors = img_bgr.copy()
    for arc in raw.door_arcs:
        cv2.circle(over_doors, (arc["cx"], arc["cy"]), arc["r"], _color("#9900cc"), 1)
        cv2.circle(over_doors, (arc["cx"], arc["cy"]), 2, _color("#9900cc"), -1)
    layers["04_doors"] = over_doors

    # --- 5. Graph nodes + edges ---
    over_graph = img_bgr.copy()
    node_pos = {}
    for n in nodes:
        nx = int(n["x"] * px_per_m)
        nz = int(n["z"] * px_per_m)
        node_pos[n["id"]] = (nx, nz)
        color = _color("#0044ff") if n["kind"] == "junction" else _color("#aabbff")
        cv2.circle(over_graph, (nx, nz), 3, color, -1)
    for e in edges:
        p0 = node_pos.get(e["from"])
        p1 = node_pos.get(e["to"])
        if p0 and p1:
            cv2.line(over_graph, p0, p1, _color("#0088ff"), 1)
    layers["05_graph"] = over_graph

    # --- 6. Stair / elevator regions ---
    over_conn = img_bgr.copy()
    for r in raw.stair_regions:
        x, y, w, h = r["bbox"]
        cv2.rectangle(over_conn, (x, y), (x + w, y + h), _color("#ff8800"), 2)
    for r in raw.elev_regions:
        x, y, w, h = r["bbox"]
        cv2.rectangle(over_conn, (x, y), (x + w, y + h), _color("#8800ff"), 2)
    layers["06_connectors"] = over_conn

    return layers


def save_overlays(layers: dict, debug_dir: str, floor_id: str) -> list:
    """Write overlay images to debug_dir. Returns list of written paths."""
    from pathlib import Path
    out_dir = Path(debug_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, img in layers.items():
        path = out_dir / f"{floor_id}_{name}.jpg"
        cv2.imwrite(str(path), img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        written.append(str(path))
    return written
