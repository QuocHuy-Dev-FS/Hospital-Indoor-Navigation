"""
Image extraction: blue-path skeleton, wall segments, door arcs, stair regions.

Returns raw pixel-space data; scale.py converts to metres.
"""
import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional
from .config import PipelineConfig


@dataclass
class RawExtraction:
    img_h: int
    img_w: int
    blue_skeleton: np.ndarray          # uint8 binary skeleton image
    junction_pts: list                  # [(px, py), ...]
    endpoint_pts: list                  # [(px, py), ...]
    polylines: list                     # [[(px,py),...], ...]
    wall_segments: list                 # [{"x1","y1","x2","y2"}, ...]
    door_arcs: list                     # [{"cx","cy","r","angle_deg"}, ...]
    door_radii_px: list[float]
    stair_regions: list                 # [{"bbox":[x,y,w,h]}, ...]
    stair_pitches_px: list[float]
    elev_regions: list                  # [{"bbox":[x,y,w,h]}, ...]
    debug_layers: dict = field(default_factory=dict)  # name→image for overlay


# ── helpers ──────────────────────────────────────────────────────────────────

def _blue_mask(img_bgr: np.ndarray, cfg: PipelineConfig) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    lo = np.array(cfg.blue_hsv_lower, dtype=np.uint8)
    hi = np.array(cfg.blue_hsv_upper, dtype=np.uint8)
    mask = cv2.inRange(hsv, lo, hi)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask


def _skeletonize(binary: np.ndarray) -> np.ndarray:
    """Zhang-Suen thinning via repeated erosion+open."""
    skel = np.zeros_like(binary)
    elem = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    img = binary.copy()
    while True:
        eroded = cv2.erode(img, elem)
        temp = cv2.dilate(eroded, elem)
        temp = cv2.subtract(img, temp)
        skel = cv2.bitwise_or(skel, temp)
        img = eroded.copy()
        if cv2.countNonZero(img) == 0:
            break
    return skel


def _find_junctions_endpoints(skel: np.ndarray) -> tuple[list, list]:
    """Count 8-neighbours of each skeleton pixel → 1 neighbour=endpoint, ≥3=junction."""
    kernel = np.ones((3, 3), np.uint8)
    kernel[1, 1] = 0
    neighbour_count = cv2.filter2D(
        (skel > 0).astype(np.uint8), -1, kernel, borderType=cv2.BORDER_CONSTANT
    )
    skel_bool = skel > 0
    junctions = list(zip(*np.where(skel_bool & (neighbour_count >= 3))))
    endpoints = list(zip(*np.where(skel_bool & (neighbour_count == 1))))
    # convert (row,col) → (x,y)
    junctions = [(int(c), int(r)) for r, c in junctions]
    endpoints = [(int(c), int(r)) for r, c in endpoints]
    return junctions, endpoints


def _trace_polylines(skel: np.ndarray, junctions: list, endpoints: list) -> list:
    """Simple greedy DFS tracing of skeleton branches."""
    visited = np.zeros(skel.shape, bool)
    seeds = set(map(tuple, junctions)) | set(map(tuple, endpoints))
    polylines = []

    def neighbours(px, py):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = px + dx, py + dy
                if 0 <= ny < skel.shape[0] and 0 <= nx < skel.shape[1]:
                    if skel[ny, nx] > 0 and not visited[ny, nx]:
                        yield nx, ny

    for sx, sy in seeds:
        if visited[sy, sx]:
            continue
        for nx, ny in neighbours(sx, sy):
            if visited[ny, nx]:
                continue
            path = [(sx, sy), (nx, ny)]
            visited[ny, nx] = True
            cx, cy = nx, ny
            while True:
                nexts = [p for p in neighbours(cx, cy)]
                if not nexts or (cx, cy) in seeds and len(path) > 1:
                    break
                cx, cy = nexts[0]
                visited[cy, cx] = True
                path.append((cx, cy))
            if len(path) >= 3:
                polylines.append(path)
    return polylines


def _extract_walls(img_gray: np.ndarray, cfg: PipelineConfig) -> list:
    """Detect dark thin lines (walls) using binary thresholding + HoughLinesP."""
    _, bw = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # Remove thin features (text chars, small symbols) with morphological open
    open_k = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, open_k)

    lines = cv2.HoughLinesP(
        bw,
        rho=1,
        theta=np.pi / 180,
        threshold=cfg.hough_threshold,
        minLineLength=cfg.hough_min_line_length_px,
        maxLineGap=cfg.hough_max_line_gap_px,
    )
    if lines is None:
        return []
    segs = []
    for x1, y1, x2, y2 in lines[:, 0]:
        length = math.hypot(x2 - x1, y2 - y1)
        if length < cfg.wall_min_length_px:
            continue
        angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
        # Keep only near-horizontal (≤10°) and near-vertical (80–90°)
        is_horiz = angle <= 10 or angle >= 170
        is_vert = 80 <= angle <= 100
        if not (is_horiz or is_vert):
            continue
        segs.append({"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)})
    return segs


def _filter_stair_diagonal_regions(img_gray: np.ndarray) -> tuple[list, list]:
    """
    Detect regions dominated by ±45° diagonal lines → stairs / hatched areas.
    Returns (stair_regions, elev_regions).
    stair_regions: bounding boxes of stair-like areas (parallel horizontal lines w/ steps)
    elev_regions: bounding boxes of X-hatched areas (diagonal both ways)
    """
    _, bw = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    diag1 = cv2.morphologyEx(
        bw, cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
    )
    lines = cv2.HoughLinesP(diag1, 1, np.pi / 180, threshold=20, minLineLength=10, maxLineGap=4)
    stair_pts = []
    elev_pts_fwd = []
    elev_pts_bwd = []
    if lines is not None:
        for x1, y1, x2, y2 in lines[:, 0]:
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            if 30 <= angle <= 60:
                elev_pts_fwd.append((x1, y1))
            elif -60 <= angle <= -30:
                elev_pts_bwd.append((x1, y1))
            elif 75 <= abs(angle) <= 90:
                stair_pts.append((x1, y1, x2, y2))

    def _bbox_from_pts(pts):
        if not pts:
            return []
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        x, y = min(xs), min(ys)
        return [{"bbox": [x, y, max(xs) - x, max(ys) - y]}]

    stair_regions = _bbox_from_pts([(x1, y1) for x1, y1, x2, y2 in stair_pts])
    # Elevator: has BOTH forward and backward diagonals in same area
    if elev_pts_fwd and elev_pts_bwd:
        all_pts = elev_pts_fwd + elev_pts_bwd
        elev_regions = _bbox_from_pts(all_pts)
    else:
        elev_regions = []

    return stair_regions, elev_regions


def _detect_door_arcs(img_gray: np.ndarray, cfg: PipelineConfig) -> tuple[list, list[float]]:
    """Detect quarter-circle door arcs using Hough Circles."""
    blur = cv2.GaussianBlur(img_gray, (5, 5), 0)
    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=20,
        param1=50,
        param2=20,
        minRadius=cfg.door_arc_min_radius_px,
        maxRadius=cfg.door_arc_max_radius_px,
    )
    arcs = []
    radii = []
    if circles is not None:
        for cx, cy, r in np.round(circles[0]).astype(int):
            arcs.append({"cx": int(cx), "cy": int(cy), "r": int(r), "angle_deg": None})
            radii.append(float(r))
    return arcs, radii


def _estimate_stair_pitches(stair_regions: list, img_gray: np.ndarray, cfg: PipelineConfig) -> list[float]:
    """Within each stair bounding box, measure pitch between parallel horizontal lines."""
    pitches = []
    for region in stair_regions:
        x, y, w, h = region["bbox"]
        roi = img_gray[max(0, y):y + h, max(0, x):x + w]
        if roi.size == 0:
            continue
        _, bw = cv2.threshold(roi, 128, 255, cv2.THRESH_BINARY_INV)
        # Row sums → peaks = stair risers
        row_sums = bw.sum(axis=1).astype(float)
        if row_sums.max() == 0:
            continue
        row_sums /= row_sums.max()
        # Find peaks
        peaks = []
        for i in range(1, len(row_sums) - 1):
            if row_sums[i] > 0.4 and row_sums[i] >= row_sums[i - 1] and row_sums[i] >= row_sums[i + 1]:
                peaks.append(i)
        for i in range(1, len(peaks)):
            pitches.append(float(peaks[i] - peaks[i - 1]))
    return pitches


import math  # noqa: E402 (used in functions above)


def extract(img_bgr: np.ndarray, cfg: PipelineConfig) -> RawExtraction:
    """Main extraction entry point. Returns RawExtraction in pixel space."""
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = img_bgr.shape[:2]

    # 1. Blue path
    blue_mask = _blue_mask(img_bgr, cfg)
    skel = _skeletonize(blue_mask)
    junctions, endpoints = _find_junctions_endpoints(skel)
    polylines = _trace_polylines(skel, junctions, endpoints)

    # 2. Walls
    wall_segs = _extract_walls(img_gray, cfg)

    # 3. Stair / elevator regions
    stair_regions, elev_regions = _filter_stair_diagonal_regions(img_gray)
    stair_pitches = _estimate_stair_pitches(stair_regions, img_gray, cfg)

    # 4. Door arcs
    door_arcs, door_radii = _detect_door_arcs(img_gray, cfg)

    # Debug layers for overlay.py
    debug = {
        "blue_mask": blue_mask,
        "skeleton": skel,
    }

    return RawExtraction(
        img_h=h,
        img_w=w,
        blue_skeleton=skel,
        junction_pts=junctions,
        endpoint_pts=endpoints,
        polylines=polylines,
        wall_segments=wall_segs,
        door_arcs=door_arcs,
        door_radii_px=door_radii,
        stair_regions=stair_regions,
        stair_pitches_px=stair_pitches,
        elev_regions=elev_regions,
        debug_layers=debug,
    )
