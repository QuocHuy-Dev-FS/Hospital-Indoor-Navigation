"""
Estimate px_per_m from visual indicators in the floorplan image.

Two independent calibration methods:
  1. Door-width heuristic: detected door arc radius → assumed 0.9 m
  2. Stair-riser heuristic: step pitch between parallel lines → assumed 0.275 m
If both estimates disagree by >threshold: report both, use door estimate as primary.
"""
import json
import math
import numpy as np
import cv2
from pathlib import Path
from .config import PipelineConfig


def _estimate_from_doors(door_radii_px: list[float], cfg: PipelineConfig) -> float | None:
    """Each detected door arc radius ≈ half the door width."""
    if not door_radii_px:
        return None
    median_r = float(np.median(door_radii_px))
    half_width_m = cfg.assumed_door_width_m / 2.0
    return median_r / half_width_m


def _estimate_from_stairs(stair_line_pitches_px: list[float], cfg: PipelineConfig) -> float | None:
    """Pitch between parallel stair risers → assumed 0.275 m per step."""
    if not stair_line_pitches_px:
        return None
    median_pitch = float(np.median(stair_line_pitches_px))
    return median_pitch / cfg.assumed_stair_riser_m


def compute_scale(
    door_radii_px: list[float],
    stair_pitches_px: list[float],
    cfg: PipelineConfig,
) -> dict:
    """
    Return a dict with:
      px_per_m      – chosen scale (float)
      method        – which method was used as primary
      door_px_per_m – estimate from doors (or null)
      stair_px_per_m– estimate from stairs (or null)
      mismatch      – absolute fractional difference (or null)
      confirmed     – always False (needs real measurement)
      warnings      – list of warning strings
    """
    door_est = _estimate_from_doors(door_radii_px, cfg)
    stair_est = _estimate_from_stairs(stair_pitches_px, cfg)
    warnings = []

    if door_est is None and stair_est is None:
        warnings.append("Không tìm được chỉ báo tỉ lệ nào; tỉ lệ tạm 100 px/m – Cần xác nhận")
        return {
            "px_per_m": 100.0,
            "method": "fallback",
            "door_px_per_m": None,
            "stair_px_per_m": None,
            "mismatch": None,
            "confirmed": False,
            "warnings": warnings,
        }

    if door_est is not None and stair_est is not None:
        mismatch = abs(door_est - stair_est) / max(door_est, stair_est)
        if mismatch > cfg.scale_mismatch_threshold:
            warnings.append(
                f"Hai chỉ báo lệch {mismatch:.1%} (door={door_est:.1f}, stair={stair_est:.1f} px/m) "
                f"– dùng door làm chính; Cần xác nhận"
            )
        chosen = door_est
        method = "door_primary"
    elif door_est is not None:
        chosen = door_est
        method = "door_only"
        warnings.append("Chỉ có chỉ báo cửa; Cần xác nhận tỉ lệ")
    else:
        chosen = stair_est
        method = "stair_only"
        warnings.append("Chỉ có chỉ báo cầu thang; Cần xác nhận tỉ lệ")

    mismatch_val = None
    if door_est is not None and stair_est is not None:
        mismatch_val = abs(door_est - stair_est) / max(door_est, stair_est)

    return {
        "px_per_m": float(chosen),
        "method": method,
        "door_px_per_m": float(door_est) if door_est is not None else None,
        "stair_px_per_m": float(stair_est) if stair_est is not None else None,
        "mismatch": float(mismatch_val) if mismatch_val is not None else None,
        "confirmed": False,
        "warnings": warnings,
    }
