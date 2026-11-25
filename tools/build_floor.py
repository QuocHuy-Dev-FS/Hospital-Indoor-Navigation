#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_floor.py v2 – Pipeline: sơ đồ mặt bằng → 3D GLB + 6 ảnh render
Dự án: Hospital Indoor Navigation – Bệnh viện Quân y 7A
Chạy:
  tools/.venv/Scripts/python.exe tools/build_floor.py --image assets/floorplans/sodobenhvienmau.jpg
"""
import argparse, os, sys, json, math, time
from pathlib import Path
import numpy as np
import cv2
from scipy.spatial import cKDTree
from shapely.geometry import LineString, Polygon, MultiPolygon, Point
from shapely.ops import unary_union, polygonize
import trimesh
import trimesh.transformations as tft
from PIL import Image, ImageDraw, ImageFont

# ─── Constants ────────────────────────────────────────────────────────────────
FLOOR_ID         = "F1"
WALL_H_DOLLHOUSE = 1.2
WALL_H_FULL      = 3.0
WALL_T           = 0.2
FLOOR_T          = 0.15
SKIRTING_H       = 0.06
PATH_STRIP_H     = 0.003
STAIR_STEPS      = 12   # ước lượng (Cần xác nhận)

# Màu phòng (R,G,B) – warm palette
ROOM_CLR = {
    "office":      (248, 235, 210),
    "tech":        (210, 225, 240),
    "wc":          (200, 235, 228),
    "data_center": (195, 210, 228),
    "storage":     (215, 222, 210),
    "stair":       (225, 218, 205),
    "shaft":       (200, 200, 208),
    "corridor":    (238, 243, 248),
    "unlabeled":   (232, 232, 228),
}
WALL_CLR       = (248, 250, 255)
WALL_CAP_CLR   = (228, 233, 245)
SLAB_CLR       = (182, 188, 196)
PATH_CLR       = (80,  175, 235)

# ─── Scaled seed coords (từ ~1750×2100 → 2129×2560) ──────────────────────────
_SX = 2129/1750; _SY = 2560/2100
def _s(px,py): return (px*_SX, py*_SY)

KNOWN_ROOMS = [
    {"id":"F1_R001","name":"Phòng Trưởng ban","type":"office",  "seed":_s(898,150)},
    {"id":"F1_R002","name":"Phòng kỹ thuật",  "type":"tech",   "seed":_s(1055,150)},
    {"id":"F1_R003","name":"WC Nam",           "type":"wc",     "seed":_s(1205,65)},
    {"id":"F1_R004","name":"WC Nữ",            "type":"wc",     "seed":_s(1205,230)},
    {"id":"F1_R005","name":"Phòng Hành chính", "type":"office", "seed":_s(737,590)},
    {"id":"F1_R006","name":"Phòng Điều hành",  "type":"office", "seed":_s(1135,590)},
    {"id":"F1_R007","name":"Trung Tâm dữ liệu","type":"data_center","seed":_s(170,1835)},
    {"id":"F1_R008","name":"Kho",              "type":"storage","seed":_s(420,1875)},
]
KNOWN_SHAFTS = [
    {"id":"F1_UNK_01","name":"unknown_shaft","type":"shaft","seed":_s(1135,1030)},
    {"id":"F1_UNK_02","name":"unknown_shaft","type":"shaft","seed":_s(1508,252)},
    {"id":"F1_UNK_03","name":"unknown_shaft","type":"shaft","seed":_s(1507,1847)},
]
KNOWN_STAIRS = [
    {"id":"F1_STAIR_01","name":"Cầu thang","type":"stair","seed":_s(775,1040)},
    {"id":"F1_STAIR_02","name":"Cầu thang","type":"stair","seed":_s(1665,170)},
    {"id":"F1_STAIR_03","name":"Cầu thang","type":"stair","seed":_s(1665,1885)},
]

# ─── Args ─────────────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--image", default="assets/floorplans/sodobenhvienmau.jpg")
    p.add_argument("--ref-px",  type=float, default=None)
    p.add_argument("--ref-m",   type=float, default=None)
    p.add_argument("--scale-m-per-px", type=float, default=None)
    p.add_argument("--paths-are-walls", action="store_true", default=False)
    p.add_argument("--out", default="tools/out")
    return p.parse_args()

# ─── Color helpers ─────────────────────────────────────────────────────────────
def clamp(c):
    return tuple(max(0,min(255,int(v))) for v in c)

def rgb01(c):
    """RGB 0-255 → RGBA 0-1 float list."""
    return [float(c[0])/255, float(c[1])/255, float(c[2])/255, 1.0]

def make_pbr(rgb, roughness=0.8, metallic=0.0):
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=rgb01(rgb), roughnessFactor=roughness, metallicFactor=metallic
    )

def set_pbr(mesh, rgb, roughness=0.8, metallic=0.0):
    mesh.visual = trimesh.visual.TextureVisuals(material=make_pbr(rgb, roughness, metallic))

# Global color registry – keyed by node name → (R,G,B)
_COLOR_REGISTRY: dict = {}

def add_to_scene(scene, mesh, name, rgb):
    """Add mesh to scene AND register its color."""
    scene.add_geometry(mesh, node_name=name)
    _COLOR_REGISTRY[name] = rgb

# ─── Step 1: Layer separation ──────────────────────────────────────────────────
def extract_masks(img_bgr):
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    # Blue #00AEEF: H≈98, S≈255, V≈239 in OpenCV
    blue_mask = cv2.inRange(hsv, np.array([83,100,100]), np.array([118,255,255]))
    k5 = np.ones((5,5),np.uint8)
    blue_mask = cv2.morphologyEx(blue_mask, cv2.MORPH_CLOSE, k5)
    blue_mask = cv2.dilate(blue_mask, k5, iterations=1)

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, wall_raw = cv2.threshold(gray, 115, 255, cv2.THRESH_BINARY_INV)
    wall_raw[blue_mask > 0] = 0
    wall_mask = cv2.morphologyEx(wall_raw, cv2.MORPH_CLOSE, np.ones((3,3),np.uint8), iterations=2)
    return blue_mask, wall_mask, wall_raw

# ─── Step 2: Scale ────────────────────────────────────────────────────────────
def calc_M(args, W):
    if args.scale_m_per_px: return args.scale_m_per_px
    if args.ref_px and args.ref_m: return args.ref_m / args.ref_px
    return 0.02 * (1746 / W)   # rescale từ baseline 0.02 @ 1746px

# ─── Step 3: Wall detection ────────────────────────────────────────────────────
def detect_walls(wall_raw, M, out_dir):
    prep = cv2.dilate(wall_raw, np.ones((3,3),np.uint8), iterations=1)
    min_len_px = max(15, int(0.4/M))   # ≥ 0.4 m
    gap_px     = max(5,  int(0.2/M))   # gap ≤ 0.2 m
    lines = cv2.HoughLinesP(prep, 1, np.pi/180, threshold=20,
                             minLineLength=min_len_px, maxLineGap=gap_px)
    walls = []
    if lines is None:
        return walls
    for i, l in enumerate(lines):
        seg = l[0] if l.ndim > 1 else l
        x1,y1,x2,y2 = int(seg[0]),int(seg[1]),int(seg[2]),int(seg[3])
        d = math.hypot((x2-x1)*M, (y2-y1)*M)
        if d < 0.3: continue
        walls.append({"id":f"F1_WALL_{i:04d}",
                       "x1":round(x1*M,4),"z1":round(y1*M,4),
                       "x2":round(x2*M,4),"z2":round(y2*M,4),
                       "length_m":round(d,4),"_draft":True})
    with open(os.path.join(out_dir,"walls.json"),"w",encoding="utf-8") as f:
        json.dump({"_note":"BẢN NHÁP","walls":walls},f,indent=2,ensure_ascii=False)
    print(f"  walls.json: {len(walls)} đoạn")
    return walls

# ─── Step 4: Door detection ────────────────────────────────────────────────────
def detect_doors(img_bgr, wall_raw, M, out_dir):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=2.0,
                                minDist=int(0.6/M), param1=80, param2=22,
                                minRadius=int(0.25/M), maxRadius=int(0.9/M))
    doors = []
    if circles is not None:
        circles = np.round(circles[0]).astype(int)
        for i,(cx,cy,r) in enumerate(circles):
            x0,y0 = max(0,cx-r-8), max(0,cy-r-8)
            x1_ = min(wall_raw.shape[1]-1,cx+r+8)
            y1_ = min(wall_raw.shape[0]-1,cy+r+8)
            region = wall_raw[y0:y1_, x0:x1_]
            if region.sum() < 255*8: continue  # quá ít điểm tường → bỏ
            doors.append({"id":f"F1_DOOR_{i:04d}",
                          "cx_m":round(cx*M,4),"cz_m":round(cy*M,4),
                          "radius_m":round(r*M,4),"_draft":True})
    with open(os.path.join(out_dir,"doors.json"),"w",encoding="utf-8") as f:
        json.dump({"_note":"BẢN NHÁP","doors":doors},f,indent=2,ensure_ascii=False)
    print(f"  doors.json: {len(doors)} cửa")
    return doors

# ─── Step 5: Path skeleton (không dùng ximgproc) ──────────────────────────────
def extract_paths(blue_mask, M, out_dir):
    """Dùng contours của blue_mask thay vì skeleton."""
    # Erode nhẹ để lấy centerline gần đúng
    eroded = cv2.erode(blue_mask, np.ones((7,7),np.uint8), iterations=5)
    contours, _ = cv2.findContours(eroded, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for i, cnt in enumerate(contours):
        if cv2.arcLength(cnt, False)*M < 0.5: continue
        approx = cv2.approxPolyDP(cnt, epsilon=5, closed=False)
        pts = [[round(float(p[0][0])*M,3), round(float(p[0][1])*M,3)] for p in approx]
        if len(pts) >= 2:
            paths.append({"id":f"F1_PATH_{i:04d}","points_m":pts,"_draft":True})
    with open(os.path.join(out_dir,"paths_draft.json"),"w",encoding="utf-8") as f:
        json.dump({"_note":"BẢN NHÁP - contour đường xanh","paths":paths},f,indent=2,ensure_ascii=False)
    print(f"  paths_draft.json: {len(paths)} path")
    return paths

# ─── Step 6: Room detection via flood-fill ─────────────────────────────────────
def detect_rooms(img_bgr, blue_mask, wall_raw, M, out_dir):
    """Flood-fill từ seed point mỗi phòng để tìm vùng phòng."""
    H, W = img_bgr.shape[:2]

    # Mask chướng ngại = tường (dark pixels) OR đường xanh
    obstacle = cv2.bitwise_or(wall_raw, blue_mask)
    # Dilate nhẹ để đóng khe hở nhỏ
    obstacle = cv2.dilate(obstacle, np.ones((5,5),np.uint8), iterations=2)
    # Floodable = trắng trong ảnh gốc VÀ không phải chướng ngại
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, light = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)   # pixel sáng
    floodable = cv2.bitwise_and(light, cv2.bitwise_not(obstacle))

    all_items = KNOWN_ROOMS + KNOWN_SHAFTS + KNOWN_STAIRS
    rooms_out = []
    used_px = set()  # pixels đã được gán

    for item in all_items:
        sx_f, sy_f = item["seed"]
        sx, sy = int(sx_f), int(sy_f)
        # Tìm điểm seed trong vùng floodable gần nhất
        found = False
        for r in range(0, 80, 2):
            if found: break
            for dx in range(-r, r+1):
                for dy in range(-r, r+1):
                    if abs(dx) != r and abs(dy) != r: continue
                    nx, ny = sx+dx, sy+dy
                    if 0 <= nx < W and 0 <= ny < H and floodable[ny,nx] > 0:
                        sx, sy = nx, ny
                        found = True
                        break

        if not found:
            # Dùng seed gốc, tính bbox tạm
            margin = int(2.0/M)
            bbox_m = {
                "x1": round(max(0,(sx_f-margin))*M,3),
                "z1": round(max(0,(sy_f-margin))*M,3),
                "x2": round(min(W,(sx_f+margin))*M,3),
                "z2": round(min(H,(sy_f+margin))*M,3),
            }
            rooms_out.append({
                "id": item["id"],"floorId":FLOOR_ID,
                "name": item["name"],"type": item["type"],
                "unlabeled": False,
                "centroid": {"x":round(sx_f*M,3),"z":round(sy_f*M,3)},
                "area_m2": 4.0, "bbox_m": bbox_m, "_draft":True, "_no_flood":True
            })
            continue

        # Flood fill
        ff_mask = np.zeros((H+2, W+2), dtype=np.uint8)
        flood_img = floodable.copy()
        # Xoá pixels đã dùng
        for (px2,py2) in list(used_px)[:5000]:
            if 0<=px2<W and 0<=py2<H: flood_img[py2,px2]=0
        retval, img_out, ff_mask2, rect = cv2.floodFill(
            flood_img, ff_mask, (sx,sy), 128,
            loDiff=20, upDiff=20,
            flags=cv2.FLOODFILL_MASK_ONLY | (128<<8)
        )
        region = (ff_mask2[1:-1,1:-1] == 128)
        if region.sum() < 100:
            # fallback bbox
            margin = int(1.5/M)
            bbox_m = {"x1":round(max(0,(sx_f-margin))*M,3),"z1":round(max(0,(sy_f-margin))*M,3),
                      "x2":round(min(W,(sx_f+margin))*M,3),"z2":round(min(H,(sy_f+margin))*M,3)}
            rooms_out.append({
                "id":item["id"],"floorId":FLOOR_ID,"name":item["name"],"type":item["type"],
                "unlabeled":False,
                "centroid":{"x":round(sx_f*M,3),"z":round(sy_f*M,3)},
                "area_m2":round(region.sum()*M*M,2),"bbox_m":bbox_m,"_draft":True
            })
            continue

        ys_r, xs_r = np.where(region)
        cx_px = float(xs_r.mean()); cy_px = float(ys_r.mean())
        x1_,x2_ = int(xs_r.min()), int(xs_r.max())
        y1_,y2_ = int(ys_r.min()), int(ys_r.max())
        # Đăng ký pixels đã dùng
        for (px2,py2) in zip(xs_r[::4], ys_r[::4]):
            used_px.add((int(px2),int(py2)))
        rooms_out.append({
            "id":item["id"],"floorId":FLOOR_ID,"name":item["name"],"type":item["type"],
            "unlabeled":False,
            "centroid":{"x":round(cx_px*M,3),"z":round(cy_px*M,3)},
            "area_m2":round(region.sum()*M*M,2),
            "bbox_m":{"x1":round(x1_*M,3),"z1":round(y1_*M,3),
                      "x2":round(x2_*M,3),"z2":round(y2_*M,3)},
            "_draft":True
        })

    # Phòng chưa nhãn = connected components lớn còn lại
    remaining = floodable.copy()
    for r in rooms_out:
        b = r["bbox_m"]
        x1p = max(0,int(b["x1"]/M)); y1p = max(0,int(b["z1"]/M))
        x2p = min(W,int(b["x2"]/M)); y2p = min(H,int(b["z2"]/M))
        remaining[y1p:y2p, x1p:x2p] = 0

    num_lbl, labels, stats, centroids = cv2.connectedComponentsWithStats(remaining, connectivity=8)
    unlabeled_idx = 900
    min_area = int((0.8/M)**2)
    for lbl in range(1, num_lbl):
        area_px = stats[lbl, cv2.CC_STAT_AREA]
        if area_px < min_area: continue
        cx_px2, cy_px2 = centroids[lbl]
        x_,y_,w_,h_ = (stats[lbl,cv2.CC_STAT_LEFT],stats[lbl,cv2.CC_STAT_TOP],
                        stats[lbl,cv2.CC_STAT_WIDTH],stats[lbl,cv2.CC_STAT_HEIGHT])
        rooms_out.append({
            "id":f"F1_R{unlabeled_idx}","floorId":FLOOR_ID,
            "name":"unlabeled","type":"unlabeled","unlabeled":True,
            "centroid":{"x":round(cx_px2*M,3),"z":round(cy_px2*M,3)},
            "area_m2":round(area_px*M*M,2),
            "bbox_m":{"x1":round(x_*M,3),"z1":round(y_*M,3),
                      "x2":round((x_+w_)*M,3),"z2":round((y_+h_)*M,3)},
            "_draft":True
        })
        unlabeled_idx += 1

    with open(os.path.join(out_dir,"rooms_draft.json"),"w",encoding="utf-8") as f:
        json.dump({"_note":"BẢN NHÁP","rooms":rooms_out},f,indent=2,ensure_ascii=False)
    labeled = sum(1 for r in rooms_out if not r.get("unlabeled"))
    print(f"  rooms_draft.json: {len(rooms_out)} phòng ({labeled} có nhãn)")
    return rooms_out

# ─── Step 7: Build 3D scene ────────────────────────────────────────────────────
def wall_box(x1, z1, x2, z2, height, t, rgb):
    dx,dz = x2-x1, z2-z1
    L = math.hypot(dx,dz)
    if L < 0.05: return None
    angle = math.atan2(dz,dx)
    box = trimesh.creation.box([L+t, height, t])
    T = tft.translation_matrix([(x1+x2)/2, height/2, (z1+z2)/2])
    R = tft.rotation_matrix(angle,[0,1,0])
    box.apply_transform(T@R)
    set_pbr(box, rgb, roughness=0.85)
    return box

def floor_box(room, rgb):
    b = room["bbox_m"]
    w = b["x2"]-b["x1"]; d = b["z2"]-b["z1"]
    if w<0.2 or d<0.2: return None
    box = trimesh.creation.box([w, FLOOR_T, d])
    T = tft.translation_matrix([(b["x1"]+b["x2"])/2, FLOOR_T/2, (b["z1"]+b["z2"])/2])
    box.apply_transform(T)
    set_pbr(box, rgb, roughness=0.75)
    return box

def stair_mesh(cx, cz, wall_h, steps=STAIR_STEPS, width=4.0, depth=4.5):
    meshes = []
    sh = min(wall_h, 2.5) / steps
    sd = depth / steps
    for i in range(steps):
        box = trimesh.creation.box([width, sh*(i+1), sd])
        T = tft.translation_matrix([cx, sh*(i+1)/2, cz - depth/2 + sd*(i+0.5)])
        box.apply_transform(T)
        set_pbr(box, ROOM_CLR["stair"], roughness=0.9)
        meshes.append(box)
    # Tay vịn
    for side in [-1,1]:
        rail = trimesh.creation.box([0.06, min(wall_h,2.5)*0.9, depth])
        T = tft.translation_matrix([cx + side*(width/2-0.03),
                                     min(wall_h,2.5)*0.9/2, cz])
        rail.apply_transform(T)
        set_pbr(rail, (160,155,150), roughness=0.8)
        meshes.append(rail)
    return meshes

def shaft_box(cx, cz, size, height, rgb):
    box = trimesh.creation.box([size, height*0.08, size])
    T = tft.translation_matrix([cx, FLOOR_T + height*0.04, cz])
    box.apply_transform(T)
    set_pbr(box, rgb, roughness=0.95)
    return box

def path_strip(pts, height=FLOOR_T, w=0.7):
    meshes = []
    for i in range(len(pts)-1):
        x1,z1=pts[i]; x2,z2=pts[i+1]
        L=math.hypot(x2-x1,z2-z1)
        if L<0.05: continue
        ang=math.atan2(z2-z1,x2-x1)
        box=trimesh.creation.box([L, PATH_STRIP_H, w])
        T=tft.translation_matrix([(x1+x2)/2, height+PATH_STRIP_H/2, (z1+z2)/2])
        R=tft.rotation_matrix(ang,[0,1,0])
        box.apply_transform(T@R)
        set_pbr(box, PATH_CLR, roughness=0.6)
        meshes.append(box)
    return meshes

def build_model(rooms, walls, paths, M, wall_height, glb_path):
    global _COLOR_REGISTRY
    _COLOR_REGISTRY = {}
    scene = trimesh.Scene()

    # Bounding box
    all_rooms = [r for r in rooms if r["area_m2"]>0.1]
    if all_rooms:
        ax1 = min(r["bbox_m"]["x1"] for r in all_rooms)
        az1 = min(r["bbox_m"]["z1"] for r in all_rooms)
        ax2 = max(r["bbox_m"]["x2"] for r in all_rooms)
        az2 = max(r["bbox_m"]["z2"] for r in all_rooms)
    else:
        ax1,az1,ax2,az2 = 0,0,35,42

    # Base slab (nền bê tông)
    base = trimesh.creation.box([ax2-ax1+2, FLOOR_T*0.5, az2-az1+2])
    base.apply_transform(tft.translation_matrix([(ax1+ax2)/2, -FLOOR_T*0.25, (az1+az2)/2]))
    set_pbr(base, SLAB_CLR, roughness=0.95)
    add_to_scene(scene, base, "F1_BASE_SLAB", SLAB_CLR)

    # Sàn phòng
    for room in rooms:
        rgb = ROOM_CLR.get(room["type"], ROOM_CLR["unlabeled"])
        fm = floor_box(room, rgb)
        if fm:
            add_to_scene(scene, fm, f"{room['id']}_FL", rgb)

    # Tường
    wi = 0
    for w in walls:
        bx = wall_box(w["x1"],w["z1"],w["x2"],w["z2"], wall_height, WALL_T, WALL_CLR)
        if bx:
            add_to_scene(scene, bx, f"F1_WALL_{wi:04d}", WALL_CLR); wi+=1

    # Cầu thang
    for st in KNOWN_STAIRS:
        cx_m,cz_m = st["seed"][0]*M, st["seed"][1]*M
        ww = 180*M*_SX; dw = 190*M*_SY  # kích thước ước lượng từ ảnh
        for j, m in enumerate(stair_mesh(cx_m, cz_m, wall_height, depth=dw, width=ww)):
            add_to_scene(scene, m, f"{st['id']}_s{j}", ROOM_CLR["stair"])

    # Unknown shafts
    for sh in KNOWN_SHAFTS:
        cx_m,cz_m = sh["seed"][0]*M, sh["seed"][1]*M
        sz = 200*M  # ~3.3m
        bx = shaft_box(cx_m, cz_m, sz, wall_height, ROOM_CLR["shaft"])
        add_to_scene(scene, bx, sh["id"], ROOM_CLR["shaft"])

    # Path strips (tối đa 30 segments)
    for pp in paths[:30]:
        pts = pp.get("points_m",[])
        if len(pts)<2: continue
        for j, m in enumerate(path_strip(pts)):
            add_to_scene(scene, m, f"{pp['id']}_s{j}", PATH_CLR)

    # Export
    p = Path(glb_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        ts = time.strftime("%H%M%S")
        p = p.with_stem(p.stem + f"_{ts}")
    scene.export(str(p))
    sz_kb = p.stat().st_size//1024
    n_mesh = len(scene.geometry)
    n_tri  = sum(len(g.faces) for g in scene.geometry.values() if hasattr(g,'faces'))
    print(f"  GLB: {p.name} | {sz_kb} KB | {n_mesh} mesh | {n_tri} tam giác")
    return str(p), scene, dict(_COLOR_REGISTRY)  # snapshot colors

# ─── Step 8: Isometric renderer ────────────────────────────────────────────────
def view_matrix(az_deg, el_deg):
    az,el = math.radians(az_deg), math.radians(el_deg)
    fwd = np.array([-math.cos(el)*math.sin(az), -math.sin(el), -math.cos(el)*math.cos(az)])
    w_up = np.array([0.,1.,0.])
    right = np.cross(fwd, w_up); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    return right, up, fwd

def project(pts, right, up, scale, cx, cy):
    xs = np.dot(pts, right)*scale + cx
    ys = -np.dot(pts, up)*scale   + cy
    return xs, ys

def lambert(base_rgb, n, L, ambient=0.35, diffuse=0.65):
    nd = float(np.dot(n, L))
    f = min(1.3, ambient + diffuse*max(0., nd))
    return clamp([float(c)*f for c in base_rgb])

def render_iso(geom_dict, color_reg,
               az, el, light_az, light_el,
               cw, ch, bg_top, bg_bot, superscale=2):
    W2, H2 = cw*superscale, ch*superscale
    L = np.array([math.cos(math.radians(light_el))*math.cos(math.radians(light_az)),
                   math.sin(math.radians(light_el)),
                   math.cos(math.radians(light_el))*math.sin(math.radians(light_az))], dtype=float)
    L /= np.linalg.norm(L)
    right, up, fwd = view_matrix(az, el)

    # ── Compute scene bounds → auto-center ──
    all_verts = []
    for mesh in geom_dict.values():
        if hasattr(mesh,'vertices') and len(mesh.vertices)>0:
            all_verts.append(mesh.vertices)
    if all_verts:
        all_v = np.vstack(all_verts)
        xs_all = np.dot(all_v, right)
        ys_all = -np.dot(all_v, up)
        xmn,xmx = xs_all.min(), xs_all.max()
        ymn,ymx = ys_all.min(), ys_all.max()
        model_w = xmx-xmn; model_h = ymx-ymn
        # Scale để model vừa canvas với 10% margin
        scale = min(W2*0.80/max(model_w,0.1), H2*0.75/max(model_h,0.1))
        cx = W2/2 - (xmn+xmx)/2*scale
        cy = H2*0.48 - (ymn+ymx)/2*scale  # trung tâm hơi trên giữa
    else:
        scale = W2/60; cx = W2/2; cy = H2/2

    # Background gradient
    arr = np.zeros((H2, W2, 3), np.uint8)
    for row in range(H2):
        t = row/H2
        arr[row] = [int(bg_top[i]*(1-t)+bg_bot[i]*t) for i in range(3)]
    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    # Collect + sort faces
    faces_list = []
    for name, mesh in geom_dict.items():
        if not hasattr(mesh,'vertices') or len(mesh.faces)==0: continue
        base_c = color_reg.get(name, (210,210,210))
        verts = np.array(mesh.vertices, float)
        norms = np.array(mesh.face_normals, float) if len(mesh.face_normals)==len(mesh.faces) else None
        for fi, face in enumerate(mesh.faces):
            fv = verts[face]
            n  = norms[fi] if norms is not None else np.array([0,1,0],float)
            color = lambert(base_c, n, L)
            depth = np.dot(fv.mean(0), -fwd)
            faces_list.append((depth, fv, color))

    faces_list.sort(key=lambda x: -x[0])  # far first

    for depth, fv, color in faces_list:
        xs, ys = project(fv, right, up, scale, cx, cy)
        poly = list(zip(xs.astype(int), ys.astype(int)))
        if len(poly)<3: continue
        try:
            draw.polygon(poly, fill=color)
            ec = clamp([c*0.68 for c in color])
            draw.line(poly+[poly[0]], fill=ec, width=max(1,superscale//2))
        except: pass

    if superscale>1:
        img = img.resize((cw,ch), Image.LANCZOS)
    return img

def add_decor(img, rooms, right, up, scale, cx, cy, note_text="BẢN TẠM – CHƯA XÁC NHẬN TỈ LỆ"):
    draw = ImageDraw.Draw(img); W,H = img.size
    font_big = font_sm = None
    for fp in ["C:/Windows/Fonts/segoeui.ttf","C:/Windows/Fonts/arial.ttf","C:/Windows/Fonts/tahoma.ttf"]:
        if os.path.exists(fp):
            try: font_big=ImageFont.truetype(fp,22); font_sm=ImageFont.truetype(fp,16); break
            except: pass
    if not font_big: font_big=font_sm=ImageFont.load_default()

    # Nhãn phòng
    for room in rooms:
        if room.get("unlabeled"): continue
        c = room["centroid"]
        pt = np.array([[c["x"], FLOOR_T+0.01, c["z"]]])
        xs,ys = project(pt, right, up, scale, cx, cy)
        sx,sy = int(xs[0]),int(ys[0])
        name = room["name"]
        bb = draw.textbbox((0,0),name,font=font_big)
        tw,th = bb[2]-bb[0],bb[3]-bb[1]
        # Nền bán trong suốt
        bx0,by0 = sx-tw//2-4, sy-th//2-3
        draw.rectangle([bx0,by0,bx0+tw+8,by0+th+6], fill=(255,255,255,200))
        draw.text((sx-tw//2,sy-th//2), name, font=font_big, fill=(20,45,100))

    # Ghi chú tạm
    draw.text((10,H-32), note_text, font=font_sm, fill=(180,0,0))
    # Thước tỉ lệ
    s5 = int(5*scale); sx0=30; sy0=H-55
    if s5 > 10:
        draw.rectangle([sx0,sy0,sx0+s5,sy0+7], fill=(40,40,40))
        draw.text((sx0,sy0-18),"0",font=font_sm,fill=(30,30,30))
        draw.text((sx0+s5-12,sy0-18),"5m",font=font_sm,fill=(30,30,30))
    # La bàn
    ccx,ccy,rc = W-55,55,28
    draw.ellipse([ccx-rc,ccy-rc,ccx+rc,ccy+rc],outline=(60,60,60),width=2)
    draw.polygon([(ccx,ccy-rc+4),(ccx-6,ccy),(ccx+6,ccy)],fill=(180,20,20))
    draw.text((ccx-7,ccy-rc-18),"N?",font=font_sm,fill=(120,20,20))
    return img

def render_topdown(geom_dict, color_reg, rooms, M, W=3000, H=3800):
    img = Image.new("RGB",(W,H),(245,248,252))
    draw = ImageDraw.Draw(img)
    # Auto scale
    all_x,all_z=[],[]
    for mesh in geom_dict.values():
        if hasattr(mesh,'vertices'):
            all_x.extend(mesh.vertices[:,0]); all_z.extend(mesh.vertices[:,2])
    if not all_x: return img
    xmn,xmx=min(all_x),max(all_x); zmn,zmx=min(all_z),max(all_z)
    sc=min(W*0.9/(xmx-xmn+0.1), H*0.9/(zmx-zmn+0.1))
    offx=W*0.05-xmn*sc; offz=H*0.05-zmn*sc

    for name, mesh in geom_dict.items():
        if not hasattr(mesh,'vertices') or len(mesh.faces)==0: continue
        rgb = color_reg.get(name,(200,200,200))
        v2d = np.column_stack([mesh.vertices[:,0]*sc+offx, mesh.vertices[:,2]*sc+offz])
        for face in mesh.faces:
            pts=[(int(v2d[i,0]),int(v2d[i,1])) for i in face]
            try: draw.polygon(pts,fill=rgb,outline=clamp([c*0.7 for c in rgb]))
            except: pass

    # Nhãn
    fnt=None
    for fp in ["C:/Windows/Fonts/segoeui.ttf","C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(fp):
            try: fnt=ImageFont.truetype(fp,24); break
            except: pass
    if not fnt: fnt=ImageFont.load_default()
    d2=ImageDraw.Draw(img)
    for room in rooms:
        if room.get("unlabeled"): continue
        sx=int(room["centroid"]["x"]*sc+offx); sy=int(room["centroid"]["z"]*sc+offz)
        name=room["name"]
        bb=d2.textbbox((0,0),name,font=fnt); tw,th=bb[2]-bb[0],bb[3]-bb[1]
        d2.rectangle([sx-tw//2-3,sy-th//2-2,sx+tw//2+3,sy+th//2+2],fill=(255,255,255,200))
        for dx2,dy2 in [(-1,0),(1,0),(0,-1),(0,1)]:
            d2.text((sx-tw//2+dx2,sy-th//2+dy2),name,font=fnt,fill=(255,255,255))
        d2.text((sx-tw//2,sy-th//2),name,font=fnt,fill=(20,45,110))
    d2.text((10,H-35),"BẢN TẠM – CHƯA XÁC NHẬN TỈ LỆ",font=fnt,fill=(180,0,0))
    return img

def render_overlay(orig_path, rooms, walls, M):
    orig = Image.open(orig_path).convert("RGBA")
    W0,H0=orig.size
    factor=max(1.0, 3000/max(W0,H0))
    if factor>1.0:
        W0,H0=int(W0*factor),int(H0*factor)
        orig=orig.resize((W0,H0),Image.LANCZOS)
    draw=ImageDraw.Draw(orig,"RGBA")

    for room in rooms:
        if room.get("unlabeled"): continue
        rgb=ROOM_CLR.get(room["type"],ROOM_CLR["unlabeled"])
        b=room["bbox_m"]
        x1p=int(b["x1"]/M*factor); y1p=int(b["z1"]/M*factor)
        x2p=int(b["x2"]/M*factor); y2p=int(b["z2"]/M*factor)
        draw.rectangle([x1p,y1p,x2p,y2p],fill=rgb+(80,),outline=(30,30,180,200),width=2)

    for w in walls[:300]:
        draw.line([int(w["x1"]/M*factor),int(w["z1"]/M*factor),
                   int(w["x2"]/M*factor),int(w["z2"]/M*factor)],
                  fill=(20,20,20,220),width=max(2,int(3*factor)))

    fnt=None
    for fp in ["C:/Windows/Fonts/segoeui.ttf","C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(fp):
            try: fnt=ImageFont.truetype(fp,int(26*factor)); break
            except: pass
    if not fnt: fnt=ImageFont.load_default()
    for room in rooms:
        if room.get("unlabeled"): continue
        sx=int(room["centroid"]["x"]/M*factor); sy=int(room["centroid"]["z"]/M*factor)
        name=room["name"]
        bb=draw.textbbox((0,0),name,font=fnt); tw,th=bb[2]-bb[0],bb[3]-bb[1]
        draw.rectangle([sx-tw//2-4,sy-th//2-3,sx+tw//2+4,sy+th//2+3],fill=(255,255,255,200))
        draw.text((sx-tw//2,sy-th//2),name,font=fnt,fill=(10,30,130,255))
    draw.text((10,H0-45),"BẢN TẠM – CHƯA XÁC NHẬN TỈ LỆ",font=fnt,fill=(200,0,0,230))
    return orig.convert("RGB")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    args = parse_args()
    t0 = time.time()
    root = Path(__file__).parent.parent
    img_path = root / args.image
    out_dir  = root / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== build_floor.py v2 – {FLOOR_ID} ===")
    if not img_path.exists():
        print(f"LỖI: không tìm thấy {img_path}"); sys.exit(1)

    img_bgr = cv2.imread(str(img_path))
    H_px, W_px = img_bgr.shape[:2]
    M = calc_M(args, W_px)
    print(f"  Ảnh: {W_px}×{H_px}  |  M={M:.5f} m/px (TẠM)")

    # [1] Masks
    print("\n[1] Tách lớp…")
    blue_mask, wall_mask, wall_raw = extract_masks(img_bgr)
    cv2.imwrite(str(out_dir/"F1_paths_mask.png"), blue_mask)
    cv2.imwrite(str(out_dir/"F1_walls_mask.png"), wall_mask)

    # [2] Coordinate system
    print("\n[2] Tọa độ…")
    cs_data = {
        "_note":"TẠM – CHƯA XÁC NHẬN. Scale suy từ cửa đôi ~1.2m.",
        "floorId":FLOOR_ID,"M_PER_PX":M,
        "IMG_W_PX":W_px,"IMG_H_PX":H_px,
        "building_width_m_est":round(W_px*M,2),
        "building_depth_m_est":round(H_px*M,2),
        "generatedAt":time.strftime("%Y-%m-%dT%H:%M:%S")
    }
    cs_prov = root/"data"/"coordinate_system_F1_provisional.json"
    with open(cs_prov,"w",encoding="utf-8") as f:
        json.dump(cs_data,f,indent=2,ensure_ascii=False)
    print(f"  → coordinate_system_F1_provisional.json")

    # [3] Walls
    print("\n[3] Tường…"); walls = detect_walls(wall_raw, M, str(out_dir))
    # [4] Doors
    print("\n[4] Cửa…");  doors  = detect_doors(img_bgr, wall_raw, M, str(out_dir))
    # [5] Paths
    print("\n[5] Đường xanh…"); paths  = extract_paths(blue_mask, M, str(out_dir))
    # [6] Rooms
    print("\n[6] Phòng (flood-fill)…"); rooms  = detect_rooms(img_bgr, blue_mask, wall_raw, M, str(out_dir))

    # [7] Build 3D
    print("\n[7] Dựng 3D…")
    model_dir = root/"assets"/"models"; model_dir.mkdir(parents=True, exist_ok=True)

    glb_doll, scene_doll, colors_doll = build_model(
        rooms, walls, paths, M, WALL_H_DOLLHOUSE,
        str(model_dir/"F1_dollhouse_provisional.glb"))
    glb_full, scene_full, colors_full = build_model(
        rooms, walls, paths, M, WALL_H_FULL,
        str(model_dir/"F1_full_provisional.glb"))

    # [8] Verify GLB
    print("\n[8] Verify GLB…")
    for glb_p in [glb_doll, glb_full]:
        m2 = trimesh.load(glb_p)
        geom2 = getattr(m2,'geometry',{}) if hasattr(m2,'geometry') else {}
        n_m = len(geom2)
        n_t  = sum(len(g.faces) for g in geom2.values() if hasattr(g,'faces'))
        sz   = os.path.getsize(glb_p)//1024
        print(f"  {Path(glb_p).name}: {n_m} mesh, {n_t} tri, {sz} KB")

    # [9] Render 6 ảnh
    print("\n[9] Render…")
    bg_sky=(218,232,248); bg_gnd=(195,212,228)
    laz,lel = 315,55  # ánh sáng từ tây-bắc, cao
    CANVAS=3200

    geom_doll = scene_doll.geometry
    geom_full = scene_full.geometry

    views = [
        ("F1_iso_dollhouse_NE.png", geom_doll, colors_doll,  45, 38, CANVAS, int(CANVAS*0.85)),
        ("F1_iso_dollhouse_NW.png", geom_doll, colors_doll, 135, 38, CANVAS, int(CANVAS*0.85)),
        ("F1_iso_dollhouse_SE.png", geom_doll, colors_doll, -45, 38, CANVAS, int(CANVAS*0.85)),
        ("F1_iso_full.png",         geom_full, colors_full,  45, 32, CANVAS, int(CANVAS*0.90)),
    ]
    png_paths = []
    for fname, geom, creg, az, el, cw, ch in views:
        print(f"  {fname}…")
        r2,u2,_ = view_matrix(az,el)
        img_r = render_iso(geom, creg, az, el, laz, lel, cw, ch, bg_sky, bg_gnd, superscale=2)
        # Tính scale để add_decor
        all_v2=[]; [all_v2.append(m.vertices) for m in geom.values() if hasattr(m,'vertices') and len(m.vertices)>0]
        if all_v2:
            av=np.vstack(all_v2)
            xs_s=np.dot(av,r2); ys_s=-np.dot(av,u2)
            sc=min(cw*0.80/((xs_s.max()-xs_s.min())+0.1), ch*0.75/((ys_s.max()-ys_s.min())+0.1))
            cxx=cw/2-(xs_s.min()+xs_s.max())/2*sc
            cyy=ch*0.48-(ys_s.min()+ys_s.max())/2*sc
        else:
            sc=cw/60; cxx=cw/2; cyy=ch/2
        img_r = add_decor(img_r, rooms, r2, u2, sc, cxx, cyy)
        op=str(out_dir/fname)
        img_r.save(op,quality=95); png_paths.append(op)
        print(f"    → {fname}  {img_r.width}×{img_r.height}")

    print("  F1_topdown.png…")
    td = render_topdown(geom_doll, colors_doll, rooms, M, W=3000, H=int(3000*H_px/W_px))
    td_p = str(out_dir/"F1_topdown.png"); td.save(td_p,quality=95); png_paths.append(td_p)

    print("  F1_overlay.png…")
    ov = render_overlay(str(img_path), rooms, walls, M)
    ov_p = str(out_dir/"F1_overlay.png"); ov.save(ov_p,quality=95); png_paths.append(ov_p)

    # [10] Tự đánh giá
    print("\n[10] Tự đánh giá (≥5 điểm):")
    issues = [
        "❶ Walls từ HoughLinesP đếm được ít (cross-hatch và cầu thang nhiễu nhiều segment ngắn bị lọc)",
        "❷ Sàn phòng dùng bbox hình chữ nhật → chồng lấn phòng liền kề",
        "❸ Cầu thang: kích thước và vị trí ước lượng từ seed pixel, chưa chính xác",
        "❹ Shader hệ số AO bake vào vertex colors chưa thực hiện (thiếu depth shadow chân tường)",
        "❺ Label đặt tại centroid bbox → một số phòng nhỏ label bị ra ngoài bounds",
        "❻ Hướng Bắc la bàn chưa được xác nhận từ chủ dự án",
        "❼ Path strips từ contour eroded → hình dạng không phản ánh đúng centerline hành lang",
    ]
    for iss in issues: print(f"  {iss}")

    # Tổng kết
    el = time.time()-t0
    print(f"\n=== XONG trong {el:.1f}s ===")
    print(f"  Tường:  {len(walls)} | Cửa: {len(doors)} | Phòng: {len(rooms)} | Paths: {len(paths)}")
    print(f"  GLB dollhouse: {Path(glb_doll).name}")
    print(f"  GLB full:      {Path(glb_full).name}")
    print(f"  PNG: {len(png_paths)} file → {out_dir}")
    print(f"  M_PER_PX: {M:.5f} m/px (TẠM – CHƯA XÁC NHẬN)")

if __name__=="__main__":
    main()
