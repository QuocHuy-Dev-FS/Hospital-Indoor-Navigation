"""
Convert pixel-space extraction to metre-space geometry.

Produces:
  - walls: merged, snapped axis-aligned segments in metres
  - rooms: connected-component polygons in metres, with IDs
  - doors: candidate door nodes in metres (confirmed=False)
  - nodes / edges for the routing graph (blue-path skeleton)
  - connectors (stair / elevator placeholders)
"""
import math
import json
import numpy as np
import cv2
from typing import Optional
from .config import PipelineConfig
from .extract import RawExtraction


# ── coordinate conversion ─────────────────────────────────────────────────────

def px_to_m(px: float, py: float, px_per_m: float) -> tuple[float, float]:
    """Pixel → metre. Origin = top-left; X=right, Z=down (Y-up handled in GLB)."""
    return round(px / px_per_m, 4), round(py / px_per_m, 4)


# ── wall merging ──────────────────────────────────────────────────────────────

def _snap(v: float, grid: float) -> float:
    return round(round(v / grid) * grid, 6)


def _merge_collinear(segs: list, gap_m: float, grid_m: float) -> list:
    """Merge axis-aligned segments that are collinear and close."""
    horiz, vert = [], []
    for s in segs:
        if abs(s["z1"] - s["z2"]) < 1e-3:
            horiz.append(s)
        else:
            vert.append(s)

    def merge_group(group, axis_key, span_key1, span_key2):
        # Group by axis coordinate (snapped), then merge overlapping spans
        from collections import defaultdict
        buckets = defaultdict(list)
        for seg in group:
            key = round(_snap(seg[axis_key], grid_m) * 1000)  # mm precision
            a, b = seg[span_key1], seg[span_key2]
            buckets[key].append((min(a, b), max(a, b)))
        merged = []
        for ax_key, spans in buckets.items():
            spans.sort()
            cur_start, cur_end = spans[0]
            for s, e in spans[1:]:
                if s <= cur_end + gap_m:
                    cur_end = max(cur_end, e)
                else:
                    merged.append((ax_key / 1000.0, cur_start, cur_end))
                    cur_start, cur_end = s, e
            merged.append((ax_key / 1000.0, cur_start, cur_end))
        return merged

    result = []
    idx = [0]

    def make_id():
        i = idx[0]; idx[0] += 1
        return f"F1_WALL_{i:03d}"

    for ax, x1, x2 in merge_group(horiz, "z1", "x1", "x2"):
        result.append({"id": make_id(), "x1": x1, "z1": ax, "x2": x2, "z2": ax})
    for ax, z1, z2 in merge_group(vert, "x1", "z1", "z2"):
        result.append({"id": make_id(), "x1": ax, "z1": z1, "x2": ax, "z2": z2})
    return result


def build_walls(raw: RawExtraction, px_per_m: float, cfg: PipelineConfig) -> list:
    """Convert + snap + merge wall segments."""
    segs_m = []
    for s in raw.wall_segments:
        x1m, z1m = px_to_m(s["x1"], s["y1"], px_per_m)
        x2m, z2m = px_to_m(s["x2"], s["y2"], px_per_m)
        segs_m.append({
            "x1": _snap(x1m, cfg.wall_snap_grid_m),
            "z1": _snap(z1m, cfg.wall_snap_grid_m),
            "x2": _snap(x2m, cfg.wall_snap_grid_m),
            "z2": _snap(z2m, cfg.wall_snap_grid_m),
        })
    return _merge_collinear(segs_m, gap_m=cfg.wall_snap_grid_m * 2, grid_m=cfg.wall_snap_grid_m)


# ── room detection ────────────────────────────────────────────────────────────

def _is_near_edge(bbox, img_w, img_h, margin=5):
    x, y, w, h = bbox
    return x <= margin or y <= margin or (x + w) >= img_w - margin or (y + h) >= img_h - margin


def build_rooms(raw: RawExtraction, px_per_m: float, cfg: PipelineConfig,
                overrides: dict) -> tuple[list, list]:
    """
    Detect rooms via connected-components on the inverted binary image
    (enclosed areas between walls).

    Returns (rooms_list, review_items).
    """
    # Reconstruct binary wall image from raw segments
    canvas = np.zeros((raw.img_h, raw.img_w), np.uint8)
    for s in raw.wall_segments:
        cv2.line(canvas, (s["x1"], s["y1"]), (s["x2"], s["y2"]), 255, 2)

    # Also draw blue-path as thin borders so corridors are separated
    if raw.blue_skeleton is not None:
        canvas = cv2.bitwise_or(canvas, (raw.blue_skeleton > 0).astype(np.uint8) * 255)

    # Flood-fill enclosed regions
    _, labels, stats, centroids = cv2.connectedComponentsWithStats(
        cv2.bitwise_not(canvas), connectivity=8
    )

    total_area_px = raw.img_h * raw.img_w
    rooms = []
    review_items = []
    room_counter = [1]
    label_to_room = {}

    # Find largest region (corridor/open space) – skip it
    areas = stats[1:, cv2.CC_STAT_AREA]  # skip background label 0
    if len(areas) == 0:
        return [], []
    max_area = int(areas.max())

    for label_idx in range(1, len(stats)):
        area_px = stats[label_idx, cv2.CC_STAT_AREA]
        area_m2 = area_px / (px_per_m ** 2)
        if area_m2 < cfg.room_min_area_m2:
            continue
        # Heuristic: largest component is corridor
        if area_px == max_area:
            continue
        # Also skip if > corridor_area_fraction of total
        if area_px / total_area_px > cfg.room_corridor_area_fraction:
            continue

        x_px = stats[label_idx, cv2.CC_STAT_LEFT]
        y_px = stats[label_idx, cv2.CC_STAT_TOP]
        w_px = stats[label_idx, cv2.CC_STAT_WIDTH]
        h_px = stats[label_idx, cv2.CC_STAT_HEIGHT]
        cx_px, cy_px = centroids[label_idx]

        cx_m, cz_m = px_to_m(cx_px, cy_px, px_per_m)
        cropped = _is_near_edge((x_px, y_px, w_px, h_px), raw.img_w, raw.img_h)

        room_id = f"F1_R{room_counter[0]:03d}"
        room_counter[0] += 1

        # Override lookup: check if centroid pixel is inside any labelled area
        override = _find_override(overrides, cx_px, cy_px)
        name = override.get("name", f"Chưa đặt tên ({room_id})") if override else f"Chưa đặt tên ({room_id})"
        name_ascii = override.get("nameAscii", _to_ascii(name)) if override else _to_ascii(name)
        room_type = override.get("type", "other") if override else "other"
        dept = override.get("department", None) if override else None

        # Polygon (bounding box for now; non-rect rooms noted in review)
        poly = _bbox_poly_m(x_px, y_px, w_px, h_px, px_per_m)
        is_rect = True  # bounding-box approximation

        room = {
            "id": room_id,
            "floorId": cfg.floor_id,
            "name": name,
            "nameAscii": name_ascii,
            "type": room_type,
            "doorNodeId": None,   # assigned later
            "centroid": {"x": cx_m, "z": cz_m},
            "polygon_m": poly,
            "area_m2": round(area_m2, 2),
            "accessible": True,
            "status": "active",
            "cropped": cropped,
            "approxRect": is_rect,
        }
        if dept:
            room["department"] = dept

        rooms.append(room)
        label_to_room[label_idx] = room_id

        # Review items
        if cropped:
            review_items.append({
                "type": "room_cropped",
                "roomId": room_id,
                "message": f"Phòng {room_id} chạm mép ảnh – có thể bị cắt"
            })
        if not override:
            review_items.append({
                "type": "room_unnamed",
                "roomId": room_id,
                "message": f"Phòng {room_id} chưa có nhãn – Cần xác nhận tên và loại"
            })

    return rooms, review_items


def _find_override(overrides: dict, cx_px: float, cy_px: float) -> Optional[dict]:
    """Find override entry whose pixel anchor is closest to centroid (within 80px)."""
    if not overrides:
        return None
    best, best_dist = None, 80.0
    for entry in overrides.get("rooms", []):
        ax, ay = entry.get("anchorPx", [0, 0])
        d = math.hypot(cx_px - ax, cy_px - ay)
        if d < best_dist:
            best_dist = d
            best = entry
    return best


def _bbox_poly_m(x, y, w, h, px_per_m: float) -> list:
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    return [{"x": round(px / px_per_m, 4), "z": round(py / px_per_m, 4)} for px, py in corners]


def _to_ascii(s: str) -> str:
    import unicodedata
    s = s.lower()
    replacements = {"đ": "d", "ư": "u", "ơ": "o", "ă": "a", "â": "a", "ê": "e", "ô": "o"}
    for k, v in replacements.items():
        s = s.replace(k, v)
    nfkd = unicodedata.normalize("NFD", s)
    out = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(out.split())


# ── door candidates ───────────────────────────────────────────────────────────

def build_doors(raw: RawExtraction, px_per_m: float, cfg: PipelineConfig) -> list:
    doors = []
    for i, arc in enumerate(raw.door_arcs):
        cx_m, cz_m = px_to_m(arc["cx"], arc["cy"], px_per_m)
        width_m = round(arc["r"] * 2 / px_per_m, 3)
        doors.append({
            "id": f"F1_DOOR_{i:03d}",
            "cx_m": cx_m,
            "cz_m": cz_m,
            "width_m": width_m,
            "confirmed": False,
        })
    return doors


# ── blue-path graph nodes/edges ───────────────────────────────────────────────

def build_graph_geometry(raw: RawExtraction, px_per_m: float, cfg: PipelineConfig,
                         doors: list) -> tuple[list, list]:
    """
    Build nodes at: path junctions, path endpoints, projected door positions.
    Build edges along polyline segments.
    Returns (nodes, edges).
    """
    nodes = []
    edges = []
    n_idx = [0]
    e_idx = [0]

    def new_node(x, z, kind):
        nid = f"F1_N{n_idx[0]:03d}"
        n_idx[0] += 1
        nodes.append({"id": nid, "floorId": cfg.floor_id, "x": x, "z": z, "kind": kind})
        return nid

    # Junction and endpoint nodes
    pt_to_node = {}
    for px, py in raw.junction_pts:
        x, z = px_to_m(px, py, px_per_m)
        nid = new_node(x, z, "junction")
        pt_to_node[(px, py)] = nid
    for px, py in raw.endpoint_pts:
        x, z = px_to_m(px, py, px_per_m)
        nid = new_node(x, z, "corridor")
        pt_to_node[(px, py)] = nid

    # Door projection nodes: closest point on skeleton
    skel = raw.blue_skeleton
    for door in doors:
        cx_px = door["cx_m"] * px_per_m
        cz_px = door["cz_m"] * px_per_m
        ys, xs = np.where(skel > 0)
        if len(xs) == 0:
            continue
        dists = np.hypot(xs - cx_px, ys - cz_px)
        idx = int(np.argmin(dists))
        proj_px, proj_py = int(xs[idx]), int(ys[idx])
        proj_x, proj_z = px_to_m(proj_px, proj_py, px_per_m)
        door_nid = new_node(proj_x, proj_z, "door")
        door["nodeId"] = door_nid

    # Edges from polylines
    for poly in raw.polylines:
        if len(poly) < 2:
            continue
        # Simplify polyline to start→end segment for now
        p0 = poly[0]; p1 = poly[-1]
        # Find or create node at each end
        def get_or_create(px, py):
            key = (px, py)
            if key in pt_to_node:
                return pt_to_node[key]
            x, z = px_to_m(px, py, px_per_m)
            nid = new_node(x, z, "corridor")
            pt_to_node[key] = nid
            return nid

        nid0 = get_or_create(*p0)
        nid1 = get_or_create(*p1)
        if nid0 == nid1:
            continue

        x0, z0 = px_to_m(p0[0], p0[1], px_per_m)
        x1, z1 = px_to_m(p1[0], p1[1], px_per_m)
        length_m = round(math.hypot(x1 - x0, z1 - z0), 4)
        eid = f"F1_E{e_idx[0]:03d}"
        e_idx[0] += 1
        edges.append({
            "id": eid,
            "from": nid0,
            "to": nid1,
            "length_m": length_m,
            "weight": length_m,
            "bidirectional": True,
            "wheelchairOk": True,
            "type": "walk",
            "restricted": False,
            "widthMin_m": None,
        })

    return nodes, edges


# ── connector stubs ───────────────────────────────────────────────────────────

def build_connectors(raw: RawExtraction, cfg: PipelineConfig) -> list:
    """Create connector stubs for identified stair/elevator regions."""
    connectors = []
    # Three stair regions described in prompt
    stair_labels = ["STAIR_A", "STAIR_B", "STAIR_C"]
    for i, region in enumerate(raw.stair_regions[:3]):
        connectors.append({
            "id": stair_labels[i] if i < 3 else f"STAIR_{chr(65+i)}",
            "type": "stairs",
            "links": [{"floorId": cfg.floor_id, "nodeId": None}],
            "wheelchairOk": False,
            "restricted": False,
            "confirmed": False,
        })

    elev_labels = ["ELEV_A", "ELEV_B", "ELEV_C"]
    for i, region in enumerate(raw.elev_regions[:3]):
        connectors.append({
            "id": elev_labels[i] if i < 3 else f"ELEV_{chr(65+i)}",
            "type": "elevator",
            "links": [{"floorId": cfg.floor_id, "nodeId": None}],
            "wheelchairOk": False,   # unconfirmed → fail-safe false
            "restricted": False,
            "confirmed": False,
        })

    return connectors
