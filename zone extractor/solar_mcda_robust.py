"""
Solar MCDA — Robust Zone Extractor (Kurdistan Region)
=====================================================
PURPOSE:
    End-to-end Multi-Criteria Decision Analysis pipeline that:
    1. Reads raw .bin data files directly (no intermediate TIF)
    2. Resamples all layers to a common 1000x909 EPSG:4326 grid
    3. Applies fuzzy-linear scoring per variable (thresholds from variables.txt)
    4. Equal-weight (1/N) MCDA weighted overlay
    5. Clips to Kurdistan Region via governorate mask
    6. Scales composite score to 0-100
    7. Classifies into 5 suitability tiers
    8. Vectorises suitable zones -> polygons
    9. Per-governorate selection with constraint-tier fallback
   10. Exports CSV / GeoJSON / Shapefile / PNG map

VARIABLES (11 active - water proximity excluded):
    temperature, ghi, dni, gti, pvout, elevation, slope,
    landclass, soiltype, dustsoiling, gridaccess

LANDCOVER (ESA WorldCover via Iraq_Landcover_ESA.bin):
    Included: Grassland (30, score=0.6), Shrubland (50, score=0.7), Bare (60, score=1.0)
    Excluded (score=0, hard exclusion): Trees, Cropland, Forest, Wetlands, Water, Urban

USAGE:
    python solar_mcda_robust.py

REQUIREMENTS:
    pip install numpy rasterio geopandas shapely matplotlib pandas pyproj scipy
"""

import os
import sys
import json
import struct
import warnings
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.crs import CRS
from rasterio.transform import Affine
from rasterio.features import shapes as rasterio_shapes
import rasterio.features
import rasterio.warp
import geopandas as gpd
from shapely.geometry import shape
from shapely.ops import unary_union
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import pandas as pd
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════════════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════════════════════
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(SCRIPT_DIR, "..", "public")
OUTPUT_DIR = SCRIPT_DIR

# ═══════════════════════════════════════════════════════════════════════════════
# REFERENCE GRID — all layers resampled to this (EPSG:4326, 1000×909)
# ═══════════════════════════════════════════════════════════════════════════════
REF_BBOX = [38.0, 28.0, 49.0, 38.0]
REF_WIDTH = 1000
REF_HEIGHT = 909
PIXEL_W = (REF_BBOX[2] - REF_BBOX[0]) / REF_WIDTH
PIXEL_H = (REF_BBOX[3] - REF_BBOX[1]) / REF_HEIGHT
REF_CRS = CRS.from_epsg(4326)
REF_TRANSFORM = Affine(PIXEL_W, 0.0, REF_BBOX[0], 0.0, -PIXEL_H, REF_BBOX[3])

# Pixel size in metres (at Kurdish latitude ~35.5°)
AVG_DEG_PER_PX = (PIXEL_W + abs(PIXEL_H)) / 2.0
M_PER_DEG = 111_320.0 * np.cos(np.radians(35.5))
PX_SIZE_M = AVG_DEG_PER_PX * M_PER_DEG

# Dust files (raw float32, no JSON header)
DUST_COLS, DUST_ROWS = 438, 371
DUST_BBOX = [38.78476239186034, 29.06049944126652, 48.6213147529691, 37.39237370147508]

# ═══════════════════════════════════════════════════════════════════════════════
# ZONE EXTRACTION CONFIG
# ═══════════════════════════════════════════════════════════════════════════════
MIN_ZONE_AREA_KM2 = 3.0   # 300 hectares
MAX_ZONE_AREA_KM2 = 100.0
MIN_ZONES_PER_GOV = 3   # guarantee at least N zones per governorate

# Maximum distance to 132kV grid lines (zones beyond this are excluded)
MAX_GRID_DISTANCE_M = 30_000  # 30 km

# Minimum distance from cities/urban centres (zones closer than this are excluded)
MIN_CITY_DISTANCE_M = 10_000  # 10 km

# Minimum safe distance from international borders / disputed territories
MIN_BORDER_DISTANCE_M = 20_000  # 20 km

GOVERNORATE_COMBINE = {
    "Sulaimaniya Governorate": "Sulaimaniya+Halabja",
    "Halabja Governorate": "Sulaimaniya+Halabja",
    "Duhok Governorate": "Duhok",
    "Erbil Governorate": "Erbil",
}

KEEP_CLASSES = [2, 3, 4, 5]  # Include Marginal+ to find zones in all governorates

# ═══════════════════════════════════════════════════════════════════════════════
# VARIABLE DEFINITIONS — equal weight, thresholds from variables.txt
# ═══════════════════════════════════════════════════════════════════════════════
# SOIL_TO_SCORE: maps ESA WRB2014 soil codes -> normalized 0-10 score
# Scale aligns with SUITABILITY_THRESHOLDS["soiltype"] = (opt_min=7, opt_max=10, hard_min=4, hard_max=10)
# Best soils (loamy, silty) -> 9-10; poor soils (sandy, rocky) -> 4-5; unusable -> NaN
SOIL_TO_SCORE = {
    0:  np.nan,  # nodata
    3:  4.0,     # Leptosols (shallow, rocky)       — marginal
    6:  9.5,     # Cambisols (loamy, moderate depth) — excellent
    7:  8.5,     # Kastanozems (dry steppe)          — good
    9:  5.5,     # Calcisols (calcareous)            — moderate
    10: 5.0,     # Gypsisols (gypsum-rich)           — moderate
    11: 4.5,     # Solonetz (salt-affected)          — marginal
    14: 4.0,     # Regosols (coarse)                 — marginal
    15: 4.0,     # Arenosols (sandy)                 — marginal
    16: 4.0,     # Anthrosols (human-modified)       — marginal
}

# Suitability threshold ranges: (optimal_min, optimal_max, hard_min, hard_max)
SUITABILITY_THRESHOLDS = {
    "temperature": (15, 25, 0, 38),  # PV efficiency drops >25C. Penalise hot plains.
    "ghi":         (1900, 2100, 1500, 2400),
    "dni":         (1850, 2150, 1400, 2400),
    "gti":         (2100, 2200, 1600, 2500),
    "pvout":       (1600, 1740, 1200, 2000),
    "elevation":   (650, 1200, 400, 1800),
    "slope":       (0, 5, 0, 20),
    "soiltype":    (7, 10, 4, 10),
    "dustsoiling": (0.0, 0.5, 0.0, 5.0),
    "gridaccess":  (0, 10000, 0, 30000),
}

INVERT_VARS = {"slope", "dustsoiling", "gridaccess"}
# EXCLUSION_VARS: score=0 for these vars hard-excludes the pixel from composite.
# Note 1: gridaccess is NOT here — it is already inverted+scored to 0 beyond 30km
# Note 2: landclass is here AND is numerically scored (0.6-1.0). This means a
# usable pixel (e.g. bare land) both passes the exclusion gate AND contributes
# its native class score to the average. This effectively weights landcover twice,
# but it heavily favours ideal bare land over mediocre shrubland.
EXCLUSION_VARS = {"slope", "temperature", "landclass"}

NODATA = -9999.0

SUITABILITY_CLASSES = {
    5: ("Highly Suitable", "#1a9850"),
    4: ("Suitable", "#91cf60"),
    3: ("Moderate", "#fee08b"),
    2: ("Marginal", "#fc8d59"),
    1: ("Not Suitable", "#d73027"),
}


# ═══════════════════════════════════════════════════════════════════════════════
# BINARY FILE UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════
def read_bin_file(filepath):
    """Read a solar atlas .bin file with JSON metadata header."""
    with open(filepath, "rb") as f:
        meta_len = struct.unpack("<I", f.read(4))[0]
        meta = json.loads(f.read(meta_len).decode("utf-8"))
        pad = (4 - (4 + meta_len) % 4) % 4
        f.read(pad)
        buf = f.read()
        data = np.frombuffer(buf, dtype=np.float32).copy()
    data = data.reshape(meta["height"], meta["width"])
    if meta.get("isFlipped", False):
        data = np.flipud(data)
    return meta, data


def bbox_to_transform(bbox, w, h):
    pw = (bbox[2] - bbox[0]) / w
    ph = (bbox[3] - bbox[1]) / h
    return Affine(pw, 0.0, bbox[0], 0.0, -ph, bbox[3])


def resample_to_ref(data, src_transform, src_crs, resampling=Resampling.bilinear):
    """Resample any array to the reference 1000×909 grid."""
    dst = np.zeros((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
    rasterio.warp.reproject(
        source=data.astype(np.float32),
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=REF_TRANSFORM,
        dst_crs=REF_CRS,
        resampling=resampling,
    )
    return dst


def clean_array(arr):
    arr = np.where(np.isnan(arr), NODATA, arr)
    arr = np.where(np.isinf(arr), NODATA, arr)
    return arr.astype(np.float32)


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════════
def load_all_layers():
    """Load and resample all variable layers into the reference grid."""
    layers = {}
    skipped = []

    # ── GHI, DNI, GTI — native 1000×909 ─────────────────────────────────────
    for name, fname in [("ghi", "GHI.bin"), ("dni", "DNI.bin"), ("gti", "GTI.bin")]:
        path = os.path.join(PUBLIC_DIR, fname)
        if not os.path.exists(path):
            print(f"  [SKIP] {name}: {fname} not found"); skipped.append(name); continue
        meta, data = read_bin_file(path)
        layers[name] = clean_array(data)
        print(f"  [OK]   {name}: {data.shape}  [{np.nanmin(data):.1f}, {np.nanmax(data):.1f}]")

    # ── Temperature — TEMP.bin → resample ────────────────────────────────────
    path = os.path.join(PUBLIC_DIR, "TEMP.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["temperature"] = clean_array(resample_to_ref(data, tform, REF_CRS))
        print(f"  [RS]   temperature: {data.shape} → {layers['temperature'].shape}")
    else:
        print("  [SKIP] temperature"); skipped.append("temperature")

    # ── PVOUT ────────────────────────────────────────────────────────────────
    path = os.path.join(PUBLIC_DIR, "Iraq_PVOUT_Yearly_EPSG4326.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["pvout"] = clean_array(resample_to_ref(data, tform, REF_CRS))
        print(f"  [RS]   pvout: {data.shape} → {layers['pvout'].shape}")
    else:
        print("  [SKIP] pvout"); skipped.append("pvout")

    # ── Elevation — GSA_Iraq_Environmental.bin (same as SatelliteSlide) ──────
    path = os.path.join(PUBLIC_DIR, "GSA_Iraq_Environmental.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["elevation"] = clean_array(resample_to_ref(data, tform, REF_CRS))
        print(f"  [RS]   elevation: {data.shape} → {layers['elevation'].shape}  "
              f"[{np.nanmin(data):.0f}, {np.nanmax(data):.0f}]")
    else:
        print("  [SKIP] elevation"); skipped.append("elevation")

    # ── Slope ────────────────────────────────────────────────────────────────
    path = os.path.join(PUBLIC_DIR, "slope", "Iraq_Slope_100m_EPSG4326.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        # Bilinear (mean) resampling gives the average slope across the pixel
        # footprint rather than the worst-case maximum. This is more representative
        # of buildable terrain — a site with one cliff pixel but otherwise flat
        # land should not be hard-excluded because of a single max pixel.
        layers["slope"] = clean_array(resample_to_ref(data, tform, REF_CRS, Resampling.bilinear))
        print(f"  [RS]   slope: {data.shape} -> {layers['slope'].shape}")
    else:
        print("  [SKIP] slope"); skipped.append("slope")


    # ── Landcover — Iraq_Landcover_ESA.bin ─────────────────────────────────────
    # ESA WorldCover classes:
    #   10 = Trees          → EXCLUDED
    #   20 = Cropland        → EXCLUDED
    #   30 = Grassland       → INCLUDED (score 0.6)
    #   40 = Forest          → EXCLUDED
    #   50 = Shrubland       → INCLUDED (score 0.7)
    #   60 = Bare/Barren     → INCLUDED (score 1.0)
    #   80 = Wetlands        → EXCLUDED
    #   90 = Water           → EXCLUDED
    #   0  = NoData/Urban    → EXCLUDED
    # ONLY classes 30, 50, 60 are suitable for solar panels.
    path = os.path.join(PUBLIC_DIR, "landcover", "Iraq_Landcover_ESA.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        LU_MAP = {30: 0.6, 50: 0.7, 60: 1.0}  # grassland + shrubland + bare
        remapped = np.zeros_like(data, dtype=np.float32)  # default 0 = excluded
        for code, score in LU_MAP.items():
            remapped[data == code] = score
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["landclass"] = resample_to_ref(remapped, tform, REF_CRS, Resampling.nearest)
        # Ensure clean: anything ≤ 0 after resampling = excluded
        layers["landclass"] = np.where(
            layers["landclass"] > 0.01, layers["landclass"], 0.0
        ).astype(np.float32)
        # Store original ESA classes for percentage computation
        tform_orig = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["_landclass_orig"] = resample_to_ref(
            data.astype(np.float32), tform_orig, REF_CRS, Resampling.nearest
        )
        suitable_px = int((layers["landclass"] > 0).sum())
        total_px = REF_HEIGHT * REF_WIDTH
        # Print per-class stats
        for code, label in [(30, 'Grassland'), (50, 'Shrubland'), (60, 'Bare')]:
            cnt = int((data == code).sum())
            print(f"         {label} (ESA {code}): {cnt:,} source pixels")
        print(f"  [OK]   landclass: ESA .bin -> {suitable_px:,}/{total_px:,} suitable "
              f"({100*suitable_px/total_px:.1f}%) | Grassland/Shrubland/Bare allowed")
    else:
        print("  [SKIP] landclass: Iraq_Landcover_ESA.bin not found")
        skipped.append("landclass")

    # ── Soil ─────────────────────────────────────────────────────────────────
    path = os.path.join(PUBLIC_DIR, "soil", "Iraq_WRB2014.bin")
    if os.path.exists(path):
        meta, data = read_bin_file(path)
        remapped = np.full_like(data, NODATA, dtype=np.float32)
        for code, score in SOIL_TO_SCORE.items():
            mask = data == code
            if mask.any():
                remapped[mask] = score if not np.isnan(score) else NODATA
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        # Soil is categorical — MUST use nearest neighbor resampling
        layers["soiltype"] = clean_array(resample_to_ref(remapped, tform, REF_CRS, Resampling.nearest))
        print(f"  [RS]   soiltype: {data.shape} -> {layers['soiltype'].shape}")
    else:
        print("  [SKIP] soiltype"); skipped.append("soiltype")

    # ── Dust — average monthly Dust_*.bin ────────────────────────────────────
    dust_dir = os.path.join(PUBLIC_DIR, "dust")
    if os.path.exists(dust_dir):
        dust_files = sorted([
            os.path.join(dust_dir, f) for f in os.listdir(dust_dir)
            if f.startswith("Dust_") and f.endswith(".bin")
        ])
        if dust_files:
            accum = np.zeros((DUST_ROWS, DUST_COLS), dtype=np.float64)
            valid_counts = np.zeros((DUST_ROWS, DUST_COLS), dtype=np.float64)
            for fp in dust_files:
                d = np.fromfile(fp, dtype=np.float32).reshape(DUST_ROWS, DUST_COLS)
                valid = ~np.isnan(d)
                accum[valid] += d[valid].astype(np.float64)
                valid_counts[valid] += 1
            
            mean_dust = np.divide(accum, valid_counts, out=np.zeros_like(accum), where=valid_counts > 0)
            dust_tform = bbox_to_transform(DUST_BBOX, DUST_COLS, DUST_ROWS)
            layers["dustsoiling"] = clean_array(
                resample_to_ref(mean_dust.astype(np.float32), dust_tform, REF_CRS)
            )
            print(f"  [RS]   dustsoiling: avg {len(dust_files)} files → {layers['dustsoiling'].shape}")
        else:
            print("  [SKIP] dustsoiling"); skipped.append("dustsoiling")
    else:
        print("  [SKIP] dustsoiling"); skipped.append("dustsoiling")

    # ── Grid access — rasterise 132kV lines → distance in metres ─────────────
    grid_json = os.path.join(PUBLIC_DIR, "kurdistan_132kv.geojson")
    if os.path.exists(grid_json):
        with open(grid_json) as f:
            geojson = json.load(f)
        all_geoms = []
        for feat in geojson.get("features", []):
            g = feat.get("geometry")
            if g is None: continue
            if g["type"] == "LineString":
                all_geoms.append(g)
            elif g["type"] == "MultiLineString":
                for line in g["coordinates"]:
                    all_geoms.append({"type": "LineString", "coordinates": line})
        grid_mask = rasterio.features.rasterize(
            [(g, 1) for g in all_geoms],
            out_shape=(REF_HEIGHT, REF_WIDTH),
            transform=REF_TRANSFORM,
            dtype=np.uint8,
        )
        # Distance from grid lines in metres
        dist = distance_transform_edt(1 - grid_mask).astype(np.float32) * PX_SIZE_M
        dist = np.clip(dist, 0, 99999)
        layers["gridaccess"] = clean_array(dist)
        print(f"  [OK]   gridaccess: {int(grid_mask.sum())} line pixels, max={dist.max():.0f}m")
    else:
        print("  [SKIP] gridaccess"); skipped.append("gridaccess")

    # ── Urban / City mask — using Night Lights + Population for exclusion ────
    # Night Lights: brighter pixels = urban/built-up areas
    # METHOD CAVEAT: Bright industry sites (e.g. oil/gas separation plants) are also
    # excluded by this. This restricts zones to true undeveloped land, but may inadvertently
    # exclude valid industrial land near existing infrastructure.
    # We also combine with the landcover ESA class 0 (urban/built-up) from above
    night_bin = os.path.join(PUBLIC_DIR, "Night_Lights.bin")
    urban_mask = np.zeros((REF_HEIGHT, REF_WIDTH), dtype=np.uint8)

    if os.path.exists(night_bin):
        meta, data = read_bin_file(night_bin)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        nl_ref = resample_to_ref(data, tform, REF_CRS)
        # Night light values: higher = more urbanized
        # Use a threshold to identify cities/towns
        nl_valid = nl_ref[nl_ref > 0]
        if len(nl_valid) > 0:
            # nl_valid only contains lit pixels (>0). We take the 85th percentile
            # of *already lit* pixels, effectively targeting the brightest 15% (urban cores).
            nl_threshold = max(np.percentile(nl_valid, 85), 5.0)
        else:
            nl_threshold = 5.0
        urban_mask |= (nl_ref >= nl_threshold).astype(np.uint8)
        print(f"  [OK]   night lights: threshold={nl_threshold:.1f}, "
              f"{int((nl_ref >= nl_threshold).sum()):,} urban pixels")
    else:
        print("  [INFO] Night_Lights.bin not found")

    # Also use population data if available
    pop_bin = os.path.join(PUBLIC_DIR, "irq_pop_100m.bin")
    if os.path.exists(pop_bin):
        meta, data = read_bin_file(pop_bin)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        pop_ref = resample_to_ref(data, tform, REF_CRS)
        pop_valid = pop_ref[pop_ref > 0]
        if len(pop_valid) > 0:
            pop_threshold = max(np.percentile(pop_valid, 85), 50)
        else:
            pop_threshold = 50
        urban_mask |= (pop_ref >= pop_threshold).astype(np.uint8)
        print(f"  [OK]   population: threshold={pop_threshold:.0f}, "
              f"combined urban={int(urban_mask.sum()):,} pixels")

    # Also treat landcover class 10 (trees/urban) and 90 (water) from ESA as city/exclusion
    # This is already handled by landclass exclusion, but add water bodies to urban mask
    # to ensure distance from lakes/rivers
    if os.path.exists(os.path.join(PUBLIC_DIR, "landcover", "Iraq_Landcover_ESA.bin")):
        meta, data = read_bin_file(os.path.join(PUBLIC_DIR, "landcover", "Iraq_Landcover_ESA.bin"))
        water_mask_src = ((data == 90) | (data == 80)).astype(np.float32)  # water + wetlands
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        water_ref = resample_to_ref(water_mask_src, tform, REF_CRS, Resampling.nearest)
        water_px = int((water_ref > 0.5).sum())
        # Add water as exclusion zone (treat like urban)
        urban_mask |= (water_ref > 0.5).astype(np.uint8)
        print(f"  [OK]   water bodies: {water_px:,} water/wetland pixels added to exclusion")

    if urban_mask.sum() > 0:
        city_dist = distance_transform_edt(1 - urban_mask).astype(np.float32) * PX_SIZE_M
        layers["_city_distance"] = city_dist
        total_urban = int(urban_mask.sum())
        print(f"  [OK]   city/water exclusion: {total_urban:,} total exclusion pixels, "
              f"min_dist={city_dist[city_dist>0].min():.0f}m")
    else:
        print("  [WARN] No urban/water data — city distance filter disabled")

    # ── Border exclusion — minimum safe distance from borders ────────────────
    gov_path = os.path.join(SCRIPT_DIR, "Kurdistan Region-Governorates.geojson")
    if os.path.exists(gov_path):
        with open(gov_path) as f:
            geojson = json.load(f)
        all_geoms = [shape(feat["geometry"]) for feat in geojson.get("features", [])
                     if feat.get("geometry")]
        if all_geoms:
            gov_union = unary_union(all_geoms)
            border_line = gov_union.boundary  # this IS the international border + internal admin lines
            
            border_mask = rasterio.features.rasterize(
                [(border_line, 1)],
                out_shape=(REF_HEIGHT, REF_WIDTH),
                transform=REF_TRANSFORM,
                dtype=np.uint8,
            )
            border_dist = distance_transform_edt(1 - border_mask).astype(np.float32) * PX_SIZE_M
            
            layers["_border_distance"] = border_dist
            too_close = int((border_dist < MIN_BORDER_DISTANCE_M).sum())
            print(f"  [OK]   border distance: {too_close:,} pixels within {MIN_BORDER_DISTANCE_M/1000:.0f}km exclusion zone")
    else:
        print("  [WARN] Kurdistan Region-Governorates.geojson not found — border filter disabled")

    return layers, skipped


# ═══════════════════════════════════════════════════════════════════════════════
# FUZZY LINEAR SCORING
# ═══════════════════════════════════════════════════════════════════════════════
def fuzzy_linear_score(arr, opt_min, opt_max, hard_min, hard_max, invert=False):
    valid = arr > NODATA + 1

    if invert:
        flipped = np.where(valid, -arr, NODATA)
        return fuzzy_linear_score(flipped, -opt_max, -opt_min, -hard_max, -hard_min, False)

    score = np.zeros_like(arr, dtype=np.float32)
    optimal = valid & (arr >= opt_min) & (arr <= opt_max)
    score[optimal] = 1.0

    if hard_min < opt_min:
        rising = valid & (arr >= hard_min) & (arr < opt_min)
        score[rising] = (arr[rising] - hard_min) / (opt_min - hard_min)

    if opt_max < hard_max:
        falling = valid & (arr > opt_max) & (arr <= hard_max)
        score[falling] = 1.0 - (arr[falling] - opt_max) / (hard_max - opt_max)

    return score


# ═══════════════════════════════════════════════════════════════════════════════
# MCDA WEIGHTED OVERLAY
# ═══════════════════════════════════════════════════════════════════════════════
def run_mcda(layers, skipped):
    scored = {}
    active_vars = []

    for name, arr in layers.items():
        if name.startswith("_") or name in skipped:
            continue

        # Landclass: already a 0/1 mask from the RGBA TIF
        if name == "landclass":
            scored[name] = np.clip(arr, 0, 1).astype(np.float32)
            active_vars.append(name)
            print(f"  [SCORE] {name} — binary mask from RGBA TIF")
            continue

        th = SUITABILITY_THRESHOLDS.get(name)
        if th is None:
            continue

        opt_min, opt_max, hard_min, hard_max = th
        invert = name in INVERT_VARS
        scored[name] = fuzzy_linear_score(arr, opt_min, opt_max, hard_min, hard_max, invert)
        active_vars.append(name)
        nz = scored[name] > 0
        mean_s = scored[name][nz].mean() if nz.any() else 0
        print(f"  [SCORE] {name} — invert={invert}  mean_nz={mean_s:.3f}")

    n = len(active_vars)
    if n == 0:
        print("  ERROR: No variables!"); sys.exit(1)

    weight = 1.0 / n
    print(f"\n  Active: {n} vars  |  Weight: {weight:.4f} each")

    composite = np.zeros((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
    for var in active_vars:
        composite += scored[var] * weight

    # Exclusion mask
    exclusion = np.ones((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
    for var in EXCLUSION_VARS:
        if var in scored:
            exclusion[scored[var] == 0.0] = 0.0
    composite *= exclusion

    # City exclusion: zero out pixels too close to urban areas
    if "_city_distance" in layers:
        too_close = layers["_city_distance"] < MIN_CITY_DISTANCE_M
        composite[too_close] = 0.0
        print(f"  City exclusion: zeroed {int(too_close.sum()):,} pixels within "
              f"{MIN_CITY_DISTANCE_M/1000:.0f}km of urban areas")

    # Border exclusion: zero out pixels too close to international boundaries
    if "_border_distance" in layers:
        too_close_border = layers["_border_distance"] < MIN_BORDER_DISTANCE_M
        composite[too_close_border] = 0.0
        print(f"  Border exclusion: zeroed {int(too_close_border.sum()):,} pixels within "
              f"{MIN_BORDER_DISTANCE_M/1000:.0f}km of borders/boundaries")

    # Kurdistan mask
    gov_path = os.path.join(SCRIPT_DIR, "Kurdistan Region-Governorates.geojson")
    if os.path.exists(gov_path):
        with open(gov_path) as f:
            geojson = json.load(f)
        all_geoms = [shape(feat["geometry"]) for feat in geojson["features"]
                     if feat.get("geometry")]
        if all_geoms:
            k_mask = rasterio.features.rasterize(
                [(unary_union(all_geoms), 1)],
                out_shape=(REF_HEIGHT, REF_WIDTH),
                transform=REF_TRANSFORM,
                dtype=np.uint8,
            ).astype(np.float32)
            inside = int((k_mask > 0).sum())
            print(f"  Kurdistan mask: {inside:,} pixels inside")
            composite *= k_mask

    # Scale to 0–100
    composite_100 = (composite * 100.0).clip(0, 100)

    # Classify
    classified = np.zeros_like(composite_100, dtype=np.uint8)
    classified[composite_100 >= 80] = 5
    classified[(composite_100 >= 65) & (composite_100 < 80)] = 4
    classified[(composite_100 >= 50) & (composite_100 < 65)] = 3
    classified[(composite_100 >= 35) & (composite_100 < 50)] = 2
    classified[composite_100 < 35] = 1
    classified[composite_100 == 0] = 0

    # Summary
    total = int((composite_100 > 0).sum())
    print(f"\n  {'SUITABILITY SUMMARY':─^55}")
    for cls in [5, 4, 3, 2, 1]:
        cnt = int((classified == cls).sum())
        pct = 100 * cnt / total if total > 0 else 0
        print(f"  {SUITABILITY_CLASSES[cls][0]:25s}: {cnt:>8,} px  ({pct:5.1f}%)")
    if total > 0:
        print(f"  {'Mean score':25s}: {composite_100[composite_100 > 0].mean():.1f}/100")
        print(f"  {'Max score':25s}: {composite_100.max():.1f}/100")

    return composite_100, classified


# ═══════════════════════════════════════════════════════════════════════════════
# ZONE EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════
def extract_zones(composite_100, classified, layers):
    """Vectorise, filter, assign attributes."""
    mask = np.isin(classified, KEEP_CLASSES).astype(np.uint8)
    polys = []
    for geom, val in rasterio_shapes(classified, mask=mask, transform=REF_TRANSFORM):
        polys.append({
            "geometry": shape(geom),
            "suitability_class": int(val),
            "class_label": SUITABILITY_CLASSES.get(int(val), ("?", "#ccc"))[0],
        })
    print(f"  Raw polygons: {len(polys):,}")
    if not polys:
        return None

    gdf = gpd.GeoDataFrame(polys, crs=REF_CRS)

    # Area
    gdf_m = gdf.to_crs(epsg=32638)
    gdf["area_km2"] = (gdf_m.geometry.area / 1_000_000).round(4)
    gdf = gdf[(gdf["area_km2"] >= MIN_ZONE_AREA_KM2) &
              (gdf["area_km2"] <= MAX_ZONE_AREA_KM2)].copy().reset_index(drop=True)
    print(f"  Zones [{MIN_ZONE_AREA_KM2}–{MAX_ZONE_AREA_KM2}] km²: {len(gdf):,}")
    if len(gdf) == 0:
        return None

    gdf["zone_id"] = [f"Z{i+1:04d}" for i in range(len(gdf))]

    # Centroids
    centroids_wgs = gdf.to_crs(epsg=4326).geometry.centroid
    gdf["centroid_lon"] = centroids_wgs.x.round(6)
    gdf["centroid_lat"] = centroids_wgs.y.round(6)
    bounds = gdf.to_crs(epsg=4326).geometry.bounds
    gdf["bbox_min_lon"] = bounds["minx"].round(6)
    gdf["bbox_min_lat"] = bounds["miny"].round(6)
    gdf["bbox_max_lon"] = bounds["maxx"].round(6)
    gdf["bbox_max_lat"] = bounds["maxy"].round(6)

    # Governorates
    # Use centroids in EPSG:4326 for the spatial join to ensure exact 1:1 mapping
    # This avoids border slivers where a zone intersects multiple governorates.
    gov_path = os.path.join(SCRIPT_DIR, "Kurdistan Region-Governorates.geojson")
    gov_gdf = gpd.read_file(gov_path).to_crs(epsg=4326)
    for col in ["name", "ADM1_EN"]:
        if col in gov_gdf.columns:
            gov_gdf["region_name"] = gov_gdf[col].map(
                lambda n: GOVERNORATE_COMBINE.get(n, n))
            break
    else:
        gov_gdf["region_name"] = gov_gdf.iloc[:, 0].map(
            lambda n: GOVERNORATE_COMBINE.get(n, n))

    centroids_gdf = gpd.GeoDataFrame(geometry=centroids_wgs, crs=4326)
    joined = gpd.sjoin(centroids_gdf, gov_gdf[["region_name", "geometry"]],
                       how="left", predicate="within")
    
    joined = joined.rename(columns={"region_name": "governorate"})
    gdf["governorate"] = joined["governorate"].fillna("Unknown").values

    # Score at centroid
    gdf["score_100"] = _sample_at_centroids(gdf, composite_100)

    # Sample raw variable values
    sample_vars = {k: v for k, v in layers.items() if not k.startswith("_")}
    print(f"  DEBUG: gdf columns before sampling = {list(gdf.columns)}")
    print(f"  DEBUG: gdf has bbox_min_lon = {'bbox_min_lon' in gdf.columns}")
    for var_name, arr in sample_vars.items():
        col = f"val_{var_name}"
        gdf[col] = _sample_at_centroids(gdf, arr)
        gdf[f"min_{var_name}"], gdf[f"max_{var_name}"] = _compute_zone_ranges(gdf, arr)
        n = gdf[col].notna().sum()
        print(f"    {var_name}: {n}/{len(gdf)}")

    # Landclass percentages (if original ESA data available)
    if "_landclass_orig" in layers:
        gdf = _compute_landclass_pct(gdf, layers["_landclass_orig"])
        # Overwrite single-pixel centroid val_landclass with area-weighted score
        # so the MCDA ranking reflects actual zone composition.
        # Scoring: Bare=1.0, Shrubland=0.7, Grassland=0.6, everything else=0.0
        for idx in range(len(gdf)):
            bare  = gdf.iloc[idx].get("pct_bare", 0) or 0
            shrub = gdf.iloc[idx].get("pct_shrubland", 0) or 0
            grass = gdf.iloc[idx].get("pct_grassland", 0) or 0
            gdf.at[gdf.index[idx], "val_landclass"] = round(
                bare / 100.0 * 1.0 + shrub / 100.0 * 0.7 + grass / 100.0 * 0.6, 4
            )
        print(f"  Landclass: overridden with area-weighted scores from pct_*")


    # Sample city distance for reporting (do not hard-filter globally)
    if "_city_distance" in layers:
        gdf["city_distance_m"] = _sample_at_centroids(gdf, layers["_city_distance"])

    # Border distance filter (hard global filter)
    if "_border_distance" in layers:
        border_vals = _sample_at_centroids(gdf, layers["_border_distance"])
        gdf["border_distance_m"] = border_vals
        before = len(gdf)
        gdf = gdf[gdf["border_distance_m"].notna() &
                  (gdf["border_distance_m"] >= MIN_BORDER_DISTANCE_M)].copy()
        print(f"  Border filter (≥{MIN_BORDER_DISTANCE_M/1000:.0f}km): "
              f"kept {len(gdf)}, dropped {before - len(gdf)}")

    if len(gdf) == 0:
        print("  No zones remaining after border filter.")
        return None

    # ── Per-governorate smart selection with constraint-tier fallback ──────────
    # For each governorate, try progressively relaxed constraints until we get
    # at least MIN_ZONES_PER_GOV zones. This guarantees coverage for Duhok/Erbil
    # even if they have limited bare land near the 132kV grid.
    CONSTRAINT_TIERS = [
        # (max_grid_m,  min_city_m,  label)
        (MAX_GRID_DISTANCE_M, MIN_CITY_DISTANCE_M, "strict 30km/10km"),
        (50_000,              5_000,                "relaxed 50km/5km"),
        (75_000,              2_000,                "fallback 75km/2km"),
        (999_999,             0,                    "no distance constraint"),
    ]

    def apply_tier(df, max_grid, min_city):
        r = df.copy()
        if "val_gridaccess" in r.columns:
            r = r[r["val_gridaccess"].notna() & (r["val_gridaccess"] <= max_grid)]
        if "city_distance_m" in r.columns and min_city > 0:
            r = r[r["city_distance_m"].notna() & (r["city_distance_m"] >= min_city)]
        return r.sort_values("score_100", ascending=False)

    all_govs = sorted(gdf["governorate"].unique())
    known_govs = [g for g in all_govs if g != "Unknown"]
    selected = []

    for gov in known_govs:
        pool = gdf[gdf["governorate"] == gov]
        chosen = pd.DataFrame()
        for max_grid, min_city, label in CONSTRAINT_TIERS:
            tier = apply_tier(pool, max_grid, min_city)
            if len(tier) >= MIN_ZONES_PER_GOV:
                chosen = tier.head(10)
                print(f"  {gov}: {len(chosen)} zones [{label}] "
                      f"best={chosen['score_100'].iloc[0]:.1f} "
                      f"grid={chosen['val_gridaccess'].iloc[0]/1000:.1f}km")
                break
            elif len(tier) > 0:
                chosen = tier  # partial — use what we have
        if len(chosen) == 0:
            print(f"  {gov}: *** NO ZONES at any constraint tier ***")
        else:
            selected.append(chosen)

    # Unknown-governorate zones at strict constraints
    unknown_pool = gdf[gdf["governorate"] == "Unknown"]
    if len(unknown_pool) > 0:
        u_zones = apply_tier(unknown_pool, MAX_GRID_DISTANCE_M, MIN_CITY_DISTANCE_M)
        if len(u_zones) > 0:
            selected.append(u_zones.head(5))

    if not selected:
        print("  No zones remaining after per-governorate selection.")
        return None

    gdf = pd.concat(selected, ignore_index=True)
    gdf = gdf.sort_values("score_100", ascending=False).reset_index(drop=True)
    gdf["zone_id"] = [f"Z{i+1:04d}" for i in range(len(gdf))]

    return gdf


def _sample_at_centroids(gdf, raster_arr):
    """Sample a 2D raster array at each zone's centroid pixel.

    Uses the affine transform (REF_TRANSFORM) to convert lon/lat -> pixel index.
    Forward transform: lon = c + col*a,  lat = f + row*e  (e is negative)
    Inverse:          col = (lon - c) / a,  row = (lat - f) / e
    """
    a = REF_TRANSFORM.a   # pixel width  (degrees/pixel)
    c = REF_TRANSFORM.c   # x (lon) origin
    e = REF_TRANSFORM.e   # pixel height (negative degrees/pixel)
    f_ = REF_TRANSFORM.f  # y (lat) origin
    h, w = raster_arr.shape
    values = []
    for _, row in gdf.iterrows():
        lon, lat = row["centroid_lon"], row["centroid_lat"]
        col_idx = int(round((lon - c) / a))
        row_idx = int(round((lat - f_) / e))
        if 0 <= row_idx < h and 0 <= col_idx < w:
            val = float(raster_arr[row_idx, col_idx])
            if val > NODATA + 1 and not np.isnan(val):
                values.append(round(val, 4))
            else:
                values.append(None)
        else:
            values.append(None)
    return values


def _sample_bbox_mean(gdf, raster_arr):
    """Compute the mean raster value within each zone's bounding box.

    More representative than centroid sampling for large legacy-site areas.
    Requires 'bbox_min_lon', 'bbox_max_lon', 'bbox_min_lat', 'bbox_max_lat'
    columns in *gdf*.  Falls back to centroid sampling if bbox columns are absent.
    """
    a = REF_TRANSFORM.a
    c = REF_TRANSFORM.c
    e = REF_TRANSFORM.e
    f_ = REF_TRANSFORM.f
    h, w = raster_arr.shape

    has_bbox = all(col in gdf.columns
                   for col in ("bbox_min_lon", "bbox_max_lon",
                               "bbox_min_lat", "bbox_max_lat"))
    if not has_bbox:
        return _sample_at_centroids(gdf, raster_arr)

    values = []
    for _, row in gdf.iterrows():
        minx = row["bbox_min_lon"]; maxx = row["bbox_max_lon"]
        miny = row["bbox_min_lat"]; maxy = row["bbox_max_lat"]

        col_min = max(0, int(round((minx - c) / a)))
        col_max = min(w - 1, int(round((maxx - c) / a)))
        row_min = max(0, int(round((maxy - f_) / e)))
        row_max = min(h - 1, int(round((miny - f_) / e)))

        if row_min <= row_max and col_min <= col_max:
            window = raster_arr[row_min:row_max + 1, col_min:col_max + 1]
            valid = window[(window > NODATA + 1) & (~np.isnan(window))]
            if len(valid) > 0:
                values.append(round(float(valid.mean()), 4))
            else:
                values.append(None)
        else:
            values.append(None)
    return values




def _compute_zone_ranges(gdf, raster_arr):
    """Compute min and max values within each zone polygon."""
    a = REF_TRANSFORM.a
    c = REF_TRANSFORM.c
    e = REF_TRANSFORM.e
    f_ = REF_TRANSFORM.f
    h, w = raster_arr.shape
    
    min_vals = []
    max_vals = []
    
    for _, row in gdf.iterrows():
        minx = row["bbox_min_lon"]
        maxx = row["bbox_max_lon"]
        miny = row["bbox_min_lat"]
        maxy = row["bbox_max_lat"]
        
        col_min = max(0, int(round((minx - c) / a)))
        col_max = min(w - 1, int(round((maxx - c) / a)))
        # Note: e is negative (latitude decreases northward), so swap row indices
        row_min = max(0, int(round((maxy - f_) / e)))  # southernmost = higher row index
        row_max = min(h - 1, int(round((miny - f_) / e)))  # northernmost = lower row index
        
        if row_min <= row_max and col_min <= col_max:
            window = raster_arr[row_min:row_max+1, col_min:col_max+1]
            valid = window[(window > NODATA) & (~np.isnan(window))]
            if len(valid) > 0:
                min_vals.append(round(float(valid.min()), 2))
                max_vals.append(round(float(valid.max()), 2))
            else:
                min_vals.append(None)
                max_vals.append(None)
        else:
            min_vals.append(None)
            max_vals.append(None)
    
    return min_vals, max_vals


# ESA WorldCover class labels
LANDCLASS_NAMES = {
    0: "NoData",
    10: "Trees",
    20: "Cropland",
    30: "Grassland",
    40: "Forest",
    50: "Shrubland",
    60: "Bare",
    80: "Wetlands",
    90: "Water",
}


def _compute_landclass_pct(gdf, landclass_arr):
    """Compute percentage of all 11 ESA land classes within each zone, with summary string."""
    a = REF_TRANSFORM.a
    c = REF_TRANSFORM.c
    e = REF_TRANSFORM.e
    f_ = REF_TRANSFORM.f
    h, w = landclass_arr.shape

    # All 11 classes
    all_pcts = {code: [] for code in LANDCLASS_NAMES.keys()}

    for _, row in gdf.iterrows():
        minx = row["bbox_min_lon"]
        maxx = row["bbox_max_lon"]
        miny = row["bbox_min_lat"]
        maxy = row["bbox_max_lat"]

        col_min = max(0, int(round((minx - c) / a)))
        col_max = min(w - 1, int(round((maxx - c) / a)))
        row_min = max(0, int(round((maxy - f_) / e)))
        row_max = min(h - 1, int(round((miny - f_) / e)))

        if row_min <= row_max and col_min <= col_max:
            window = landclass_arr[row_min:row_max+1, col_min:col_max+1]
            total = window.size
            for code in LANDCLASS_NAMES.keys():
                cnt = int((window == code).sum())
                all_pcts[code].append(round(100 * cnt / total, 1) if total > 0 else None)
        else:
            for code in LANDCLASS_NAMES.keys():
                all_pcts[code].append(None)

    # Add each class as a column
    for code, name in LANDCLASS_NAMES.items():
        col_name = f"pct_{name.lower()}"
        gdf[col_name] = all_pcts[code]

    # Create summary string: "Bare 40%, Grass 30%, Water 20%, ..."
    summaries = []
    for idx, (i, row) in enumerate(gdf.iterrows()):
        parts = []
        for code, name in LANDCLASS_NAMES.items():
            val = all_pcts[code][idx]
            if val and val > 0:
                parts.append((val, f"{name} {val}%"))
        parts.sort(reverse=True)
        summary_parts = [p[1] for p in parts[:4]]
        if len(parts) > 4:
            other = sum(p[0] for p in parts[4:])
            if other > 0:
                summary_parts.append(f"Other {other}%")
        summaries.append(", ".join(summary_parts) if summary_parts else "Unknown")

    gdf["landclass_summary"] = summaries

    valid = (gdf["pct_bare"].notna() | gdf["pct_grassland"].notna())
    print(f"  Landcover percentages: {valid.sum()}/{len(gdf)} zones computed")

    return gdf


# ═══════════════════════════════════════════════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════════════════════════════════════════════════
def export_all(gdf, composite_100, classified):
    """Export rasters, vectors, and map."""

    # Rasters
    profile = dict(
        driver="GTiff", height=REF_HEIGHT, width=REF_WIDTH, count=1,
        dtype=rasterio.float32, crs=REF_CRS, transform=REF_TRANSFORM,
        compress="lzw", nodata=0,
    )
    with rasterio.open(os.path.join(OUTPUT_DIR, "mcda_suitability_score.tif"), "w", **profile) as dst:
        dst.write(composite_100.astype(np.float32), 1)
    with rasterio.open(os.path.join(OUTPUT_DIR, "mcda_classified.tif"), "w",
                       **dict(profile, dtype=rasterio.uint8)) as dst:
        dst.write(classified.astype(np.uint8), 1)
    print("  [SAVED] mcda_suitability_score.tif & mcda_classified.tif")

    if gdf is None or len(gdf) == 0:
        print("  No zones to export."); return

    gdf_wgs = gdf.to_crs(epsg=4326)

    # CSV - include min/max columns and landcover percentages
    var_cols = [c for c in gdf.columns if c.startswith("val_")]
    min_cols = [c for c in gdf.columns if c.startswith("min_")]
    max_cols = [c for c in gdf.columns if c.startswith("max_")]
    pct_cols = [f"pct_{name.lower()}" for name in LANDCLASS_NAMES.values()] + ["landclass_summary"]
    csv_cols = ["zone_id", "governorate", "suitability_class", "class_label",
                "score_100", "area_km2", "centroid_lat", "centroid_lon"] + var_cols + min_cols + max_cols + pct_cols
    csv_cols = [c for c in csv_cols if c in gdf.columns]
    gdf_wgs[csv_cols].to_csv(os.path.join(OUTPUT_DIR, "mcda_zones.csv"), index=False)
    print("  [SAVED] mcda_zones.csv")

    # GeoJSON
    gdf_wgs.to_file(os.path.join(OUTPUT_DIR, "mcda_zones.geojson"), driver="GeoJSON")
    print("  [SAVED] mcda_zones.geojson")

    # Shapefile
    gdf_wgs.to_file(os.path.join(OUTPUT_DIR, "mcda_zones.shp"))
    print("  [SAVED] mcda_zones.shp")

    # Summary
    total_area = gdf["area_km2"].sum()
    print(f"\n  {'ZONE SUMMARY':─^55}")
    for gov in sorted(gdf["governorate"].unique()):
        sub = gdf[gdf["governorate"] == gov]
        print(f"  {gov:<24} {len(sub):>4} zones | {sub['area_km2'].sum():>8.2f} km²  "
              f"avg={sub['score_100'].mean():.1f}")
    print(f"  {'TOTAL':<24} {len(gdf):>4} zones | {total_area:>8.2f} km²  "
          f"avg={gdf['score_100'].mean():.1f}")

    # Map
    fig, axes = plt.subplots(1, 2, figsize=(18, 9))
    fig.suptitle("Solar Suitability MCDA — Kurdistan Region\n"
                 f"Equal Weights | Score 0–100 | ≤{MAX_GRID_DISTANCE_M/1000:.0f}km grid | "
                 f"≥{MIN_CITY_DISTANCE_M/1000:.0f}km cities",
                 fontsize=13, fontweight="bold")

    ax1 = axes[0]
    for cls in sorted(SUITABILITY_CLASSES.keys(), reverse=True):
        label, color = SUITABILITY_CLASSES[cls]
        sub = gdf_wgs[gdf_wgs["suitability_class"] == cls]
        if len(sub):
            sub.plot(ax=ax1, color=color, edgecolor="white", linewidth=0.3,
                     label=f"{label} (n={len(sub)})")
    for _, row in gdf_wgs.iterrows():
        cx, cy = row.geometry.centroid.x, row.geometry.centroid.y
        ax1.annotate(f"{row['score_100']:.0f}", xy=(cx, cy), ha="center", va="center",
                     fontsize=5, color="#111",
                     bbox=dict(boxstyle="round,pad=0.15", fc="white", alpha=0.6, ec="none"))
    ax1.set_title(f"{len(gdf_wgs)} zones | {total_area:.1f} km²")
    ax1.legend(loc="lower right", fontsize=8)
    ax1.grid(True, linestyle="--", alpha=0.3)

    ax2 = axes[1]
    gdf_wgs.plot(column="score_100", ax=ax2, cmap="RdYlGn", legend=True,
                 edgecolor="grey", linewidth=0.2,
                 legend_kwds={"label": "Score (0–100)"})
    ax2.set_title("Score Distribution")
    ax2.grid(True, linestyle="--", alpha=0.3)

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "mcda_map.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("  [SAVED] mcda_map.png")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 65)
    print("  Solar MCDA — Robust Zone Extractor (Kurdistan Region)")
    print("  Equal weights | Score 0–100 | ≤30km grid | ≥10km cities")
    print("=" * 65)

    print("\n[1] Loading layers from .bin files...")
    layers, skipped = load_all_layers()
    print(f"\n  Loaded: {[k for k in layers if not k.startswith('_')]}")
    if skipped: print(f"  Skipped: {skipped}")

    print("\n[2] MCDA scoring + overlay...")
    composite_100, classified = run_mcda(layers, skipped)

    print("\n[3] Extracting zones...")
    gdf = extract_zones(composite_100, classified, layers)

    print("\n[4] Exporting...")
    export_all(gdf, composite_100, classified)

    print("\n" + "=" * 65)
    print("  [DONE]")
    print("=" * 65)

    if gdf is not None and len(gdf) > 0:
        top = gdf.iloc[0]
        print(f"\n  Top zone: {top['zone_id']} ({top['governorate']})")
        print(f"    Score: {top['score_100']:.1f}/100  Area: {top['area_km2']:.2f} km²")
        print(f"    Location: {top['centroid_lat']:.4f}°N, {top['centroid_lon']:.4f}°E")


if __name__ == "__main__":
    main()
