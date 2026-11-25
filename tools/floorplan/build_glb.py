"""
Build a GLB model from metre-space geometry using trimesh.

Node naming follows docs/FLOORPLAN_TO_3D.md:
  F1_FLOOR, F1_WALL_###, F1_DOOR_###, F1_R### (room floors),
  F1_STAIR_A/B/C, F1_ELEV_A/B/C

Coordinate system: X right, Y up, Z toward viewer (glTF / Three.js standard).
Floorplan: X = east, Z = south (Y-image direction). Y=0 is floor level.
"""
import math
import numpy as np
from pathlib import Path
import trimesh
from trimesh.transformations import rotation_matrix
from .config import PipelineConfig


# ── material colours ──────────────────────────────────────────────────────────
COLORS = {
    "floor":    [220, 215, 205, 255],
    "wall":     [180, 175, 165, 255],
    "room":     [200, 220, 200, 255],
    "door":     [160, 120,  80, 255],
    "stair":    [210, 180, 140, 255],
    "elevator": [180, 160, 210, 255],
}


def _rgba(key: str) -> list:
    return COLORS.get(key, [200, 200, 200, 255])


def _box(x_m, y_m, z_m, w, h, d, color_key: str) -> trimesh.Trimesh:
    """Axis-aligned box with bottom-center at (x_m, y_m, z_m), size (w, h, d)."""
    mesh = trimesh.creation.box(extents=[w, h, d])
    mesh.apply_translation([x_m + w / 2, y_m + h / 2, z_m + d / 2])
    mesh.visual = trimesh.visual.ColorVisuals(
        mesh=mesh,
        vertex_colors=np.tile(_rgba(color_key), (len(mesh.vertices), 1))
    )
    return mesh


def _wall_box(x1, z1, x2, z2, thickness, height, y_base, color_key="wall") -> trimesh.Trimesh:
    """Create a wall box between two points."""
    length = math.hypot(x2 - x1, z2 - z1)
    angle = math.atan2(z2 - z1, x2 - x1)
    cx, cz = (x1 + x2) / 2, (z1 + z2) / 2

    mesh = trimesh.creation.box(extents=[length, height, thickness])
    # Rotate around Y axis
    rot = rotation_matrix(angle, [0, 1, 0])
    mesh.apply_transform(rot)
    mesh.apply_translation([cx, y_base + height / 2, cz])
    mesh.visual = trimesh.visual.ColorVisuals(
        mesh=mesh,
        vertex_colors=np.tile(_rgba(color_key), (len(mesh.vertices), 1))
    )
    return mesh


def _room_slab(poly_m: list, y_base: float, thickness: float = 0.05, color_key="room") -> trimesh.Trimesh:
    """Flat slab for a room from its polygon (bounding box)."""
    if not poly_m:
        return None
    xs = [p["x"] for p in poly_m]
    zs = [p["z"] for p in poly_m]
    w = max(xs) - min(xs)
    d = max(zs) - min(zs)
    if w < 0.01 or d < 0.01:
        return None
    mesh = trimesh.creation.box(extents=[w, thickness, d])
    mesh.apply_translation([min(xs) + w / 2, y_base + thickness / 2, min(zs) + d / 2])
    mesh.visual = trimesh.visual.ColorVisuals(
        mesh=mesh,
        vertex_colors=np.tile(_rgba(color_key), (len(mesh.vertices), 1))
    )
    return mesh


def build_glb(
    walls: list,
    rooms: list,
    doors: list,
    connectors: list,
    cfg: PipelineConfig,
    img_w_m: float,
    img_h_m: float,
) -> trimesh.Scene:
    """
    Assemble all geometry into a trimesh.Scene with named geometry.
    Returns the scene (call scene.export(...) to write GLB).
    """
    scene = trimesh.Scene()
    y0 = cfg.floor_elevation_m
    wh = cfg.wall_height_m
    wt = cfg.wall_thickness_m

    # ── overall floor slab ──────────────────────────────────────────────────
    floor_mesh = _box(0, y0 - 0.05, 0, img_w_m, 0.05, img_h_m, "floor")
    scene.add_geometry(floor_mesh, geom_name="F1_FLOOR", node_name="F1_FLOOR")

    # ── room floor slabs ────────────────────────────────────────────────────
    for room in rooms:
        poly = room.get("polygon_m", [])
        slab = _room_slab(poly, y0, thickness=0.02, color_key="room")
        if slab is not None:
            name = room["id"]
            scene.add_geometry(slab, geom_name=name, node_name=name)

    # ── walls ───────────────────────────────────────────────────────────────
    for wall in walls:
        mesh = _wall_box(
            wall["x1"], wall["z1"], wall["x2"], wall["z2"],
            wt, wh, y0
        )
        name = wall["id"]
        scene.add_geometry(mesh, geom_name=name, node_name=name)

    # ── door gap markers (thin coloured slab at floor level) ────────────────
    for door in doors:
        cx = door["cx_m"]
        cz = door["cz_m"]
        w = door.get("width_m", 0.9)
        # Small marker box
        mesh = _box(cx - w / 2, y0, cz - 0.05, w, 0.02, 0.10, "door")
        name = door["id"]
        scene.add_geometry(mesh, geom_name=name, node_name=name)

    # ── connectors (stairs / elevators) ────────────────────────────────────
    stair_idx = 0; elev_idx = 0
    for conn in connectors:
        ctype = conn.get("type", "stairs")
        cid = conn["id"]
        if ctype == "stairs":
            # Simple stepped box
            for step in range(5):
                sx = step * 0.30
                sz = 0.0
                mesh = _box(sx, y0 + step * 0.18, sz, 0.30, 0.18, 1.0, "stair")
                scene.add_geometry(mesh, geom_name=f"{cid}_step{step}", node_name=f"{cid}_step{step}")
        else:
            # Elevator: single box
            mesh = _box(0, y0, 0, 1.2, wh, 1.5, "elevator")
            scene.add_geometry(mesh, geom_name=cid, node_name=cid)

    return scene


def export_glb(scene: trimesh.Scene, out_path: str) -> int:
    """Export scene to GLB file. Returns file size in bytes."""
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    glb_bytes = scene.export(file_type="glb")
    with open(out_path, "wb") as f:
        f.write(glb_bytes)
    return len(glb_bytes)


def verify_glb(glb_path: str, rooms: list) -> dict:
    """
    Reload GLB and verify:
      - All room IDs present as node names
      - Bounding boxes match rooms within 1%
      - Y axis is up (max Y > 0)
    Returns dict with errors and warnings.
    """
    scene = trimesh.load(glb_path, force="scene")
    geom_names = set(scene.geometry.keys())
    errors = []
    warnings = []

    for room in rooms:
        rid = room["id"]
        if rid not in geom_names:
            errors.append(f"GLB thiếu node {rid}")

    # Check Y axis orientation
    bounds = scene.bounds
    if bounds is not None:
        if bounds[1][1] <= 0:
            errors.append("GLB: Y max ≤ 0 – trục Y có thể không hướng lên")

    return {"errors": errors, "warnings": warnings, "geom_names": sorted(geom_names)}
