"""Pipeline configuration – all tunable parameters in one place."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PipelineConfig:
    floor_id: str = "F1"

    # --- Scale (tỉ lệ) ---
    assumed_door_width_m: float = 0.90   # chỉ báo 1: độ rộng cửa giả định
    assumed_stair_riser_m: float = 0.275  # chỉ báo 2: bước bậc thang trung bình
    scale_mismatch_threshold: float = 0.15  # >15% → cảnh báo

    # --- Wall (tường) ---
    wall_height_m: float = 3.0            # Cần xác nhận
    wall_thickness_m: float = 0.20        # Cần xác nhận
    wall_snap_grid_m: float = 0.05        # snap về lưới 5 cm
    wall_merge_gap_px: int = 8            # gộp đoạn thẳng hàng cách ≤ px này
    wall_min_length_px: int = 30          # đoạn ngắn hơn → bỏ
    hough_threshold: int = 60
    hough_min_line_length_px: int = 30
    hough_max_line_gap_px: int = 10

    # --- Blue path (đường xanh) ---
    blue_hsv_lower: list = field(default_factory=lambda: [90, 80, 60])
    blue_hsv_upper: list = field(default_factory=lambda: [130, 255, 255])
    blue_min_area_px: int = 50
    skeleton_junction_min_branch_px: int = 10  # nhánh cụt ngắn hơn → bỏ

    # --- Room detection ---
    room_min_area_m2: float = 0.5         # nhỏ hơn → bỏ (nhiễu)
    room_corridor_area_fraction: float = 0.20  # vùng lớn hơn X% tổng → hành lang

    # --- Door detection ---
    door_arc_min_radius_px: int = 8
    door_arc_max_radius_px: int = 60

    # --- GLB ---
    floor_elevation_m: float = 0.0
    north_angle_deg: Optional[float] = None   # Cần xác nhận

    # --- Paths ---
    debug_dir: str = "assets/floorplans/_debug"
    output_dir: str = "data/sample/F1"
    model_out: str = "assets/models/sample/F1.glb"
    meta_out: str = "assets/floorplans/F1.meta.json"
    coord_system_out: str = "data/sample/coordinate_system.json"
