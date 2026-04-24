"""
Solar MCDA — Direct .bin Pipeline (No Intermediate .tif)
=========================================================
Reads raw .bin files, resamples in-memory to a common 1000×909 grid,
runs weighted overlay MCDA, then vectorises zones — all without
touching the filesystem between steps.

STEPS:
    1.  Read every .bin → NumPy array in RAM
    2.  Resample all layers to EPSG:4326 1000×909 reference grid
    3.  Apply fuzzy scoring & exclusion masks
    4.  Weighted overlay → composite suitability score
    5.  Classify → polygon zones → governorate assignment
    6.  Filter by area, sample centroid values, export CSV/GeoJSON/Shapefile

USAGE:
    python solar_mcda_bin.py

REQUIREMENTS:
    pip install numpy rasterio geopandas shapely matplotlib pandas pyproj rasterstats scipy fiona
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
import geopandas as gpd
from shapely.geometry import shape
from shapely.ops import unary_union
import matplotlib.pyplot as plt
import pandas as pd
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt

warnings.filterwarnings("ignore", category=UserWarning)

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
GRID_JSON = os.path.join(PUBLIC_DIR, "kurdistan_132kv.geojson")

# Reference grid: matches GHI/DNI/GTI native resolution (1000×909)
# Kurdistan mask applied later to clip output to Kurdistan Region only
REF_BBOX = [38.0, 28.0, 49.0, 38.0]
REF_WIDTH = 1000
REF_HEIGHT = 909
PIXEL_W = (REF_BBOX[2] - REF_BBOX[0]) / REF_WIDTH
PIXEL_H = (REF_BBOX[3] - REF_BBOX[1]) / REF_HEIGHT
REF_CRS = CRS.from_epsg(4326)
REF_TRANSFORM = Affine(PIXEL_W, 0.0, REF_BBOX[0], 0.0, -PIXEL_H, REF_BBOX[3])

# Kurdistan bounding box for clipping (larger region for processing)
KURDISTAN_BBOX = [42.3483, 34.4379241, 46.347062, 37.380245]

# Dust grid (438 cols × 371 rows, RAW float32 — no JSON header)
DUST_COLS, DUST_ROWS = 438, 371
DUST_BBOX = [38.78476239186034, 29.06049944126652, 48.6213147529691, 37.39237370147508]

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION  (same as zone_extractor.py — edit here)
# ─────────────────────────────────────────────────────────────────────────────
MIN_ZONE_AREA_KM2 = 5.0
MAX_ZONE_AREA_KM2 = 10.0
MAX_TOTAL_AREA_KM2 = None

MISSING_VARIABLES = ["waterproximity"]

VARIABLES = {
    "temperature": {"weight": 0.12, "label": "Air Temperature"},
    "ghi": {"weight": 0.15, "label": "GHI"},
    "dni": {"weight": 0.13, "label": "DNI"},
    "gti": {"weight": 0.10, "label": "GTI"},
    "pvout": {"weight": 0.10, "label": "PVOUT"},
    "elevation": {"weight": 0.08, "label": "Elevation"},
    "slope": {"weight": 0.08, "label": "Slope"},
    "landclass": {"weight": 0.09, "label": "Land Class"},
    "soiltype": {"weight": 0.06, "label": "Soil Type"},
    "dustsoiling": {"weight": 0.04, "label": "Dust Soiling"},
    "gridaccess": {"weight": 0.02, "label": "Grid Access"},
    "waterproximity": {"weight": 0.03, "label": "Water Proximity"},
}

SUITABILITY_THRESHOLDS = {
    "temperature": (20, 38, 0, 45),
    "ghi": (1900, 2100, 1500, 2400),
    "dni": (1850, 2150, 1400, 2400),
    "gti": (2100, 2200, 1600, 2500),
    "pvout": (1600, 1740, 1200, 2000),
    "elevation": (650, 1200, 400, 1800),
    "slope": (0, 5, 0, 20),
    "landclass": (1, 3, 1, 5),
    "soiltype": (7, 10, 4, 9),
    "dustsoiling": (0.0, 0.5, 0.0, 5.0),
    "gridaccess": (0, 10000, 0, 50000),
}

KEEP_CLASSES = [3, 4, 5]
GOVERNORATE_COMBINE = {
    "Sulaimaniya Governorate": "Sulaimaniya+Halabja",
    "Halabja Governorate": "Sulaimaniya+Halabja",
    "Duhok Governorate": "Duhok",
    "Erbil Governorate": "Erbil",
}

LU_TO_SCORE = {
    0: np.nan,
    10: np.nan,
    20: np.nan,
    30: np.nan,
    40: np.nan,
    50: np.nan,
    60: 1.0,
    80: np.nan,
    90: np.nan,
}

SOIL_TO_SCORE = {
    0: np.nan,
    3: 2,
    6: 9,
    7: 8,
    9: 5,
    10: 5,
    11: 4,
    14: 3,
    15: 3,
    16: 2,
}


# ─────────────────────────────────────────────────────────────────────────────
# BIN FILE READER  (same as bin_to_tif_converter.py)
# ─────────────────────────────────────────────────────────────────────────────
def read_bin_file(filepath):
    with open(filepath, "rb") as f:
        meta_len = struct.unpack("<I", f.read(4))[0]
        meta = json.loads(f.read(meta_len).decode("utf-8"))
        pad = (4 - (4 + meta_len) % 4) % 4
        f.read(pad)
        buf = f.read()
        data = np.frombuffer(buf, dtype=np.float32)
    data = data.reshape(meta["height"], meta["width"])
    if meta.get("isFlipped", False):
        data = np.flipud(data)
    return meta, data


def bbox_to_transform(bbox, w, h):
    pw = (bbox[2] - bbox[0]) / w
    ph = (bbox[3] - bbox[1]) / h
    return Affine(pw, 0.0, bbox[0], 0.0, -ph, bbox[3])


def resample_to_ref(
    data, src_transform, src_crs, dst_transform, dw, dh, resampling=Resampling.bilinear
):
    dst = np.zeros((dh, dw), dtype=np.float32)
    rasterio.warp.reproject(
        source=data,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=dst_transform,
        dst_crs=REF_CRS,
        resampling=resampling,
    )
    return dst


def nan_to_nodata(arr, nodata=-9999.0):
    arr = np.where(np.isnan(arr), nodata, arr)
    arr = np.where(np.isinf(arr), nodata, arr)
    return arr.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# FUZZY SCORING
# ─────────────────────────────────────────────────────────────────────────────
def fuzzy_linear_score(arr, opt_min, opt_max, hard_min, hard_max, invert=False):
    if invert:
        return fuzzy_linear_score(-arr, -opt_max, -opt_min, -hard_max, -hard_min)
    score = np.zeros_like(arr, dtype=np.float32)
    optimal = (arr >= opt_min) & (arr <= opt_max)
    score[optimal] = 1.0
    if hard_min < opt_min:
        rising = (arr >= hard_min) & (arr < opt_min)
        score[rising] = (arr[rising] - hard_min) / (opt_min - hard_min)
    if opt_max < hard_max:
        falling = (arr > opt_max) & (arr <= hard_max)
        score[falling] = 1.0 - (arr[falling] - opt_max) / (hard_max - opt_max)
    return score


# ─────────────────────────────────────────────────────────────────────────────
# WEIGHTED OVERLAY  (with strict Boolean exclusion mask)
# ─────────────────────────────────────────────────────────────────────────────
def weighted_overlay(scored_layers, variables):
    present = [v for v in scored_layers if v in variables]
    total_w = sum(variables[v]["weight"] for v in present)
    ref_shape = next(iter(scored_layers.values())).shape
    composite = np.zeros(ref_shape, dtype=np.float32)

    exclusion_mask = np.ones(ref_shape, dtype=np.float32)
    for var in ("slope", "temperature", "soiltype", "landclass"):
        if var in scored_layers:
            exclusion_mask[scored_layers[var] == 0.0] = 0.0

    for var_name in present:
        adj = variables[var_name]["weight"] / total_w
        composite += scored_layers[var_name] * adj

    composite *= exclusion_mask
    return composite


# ─────────────────────────────────────────────────────────────────────────────
# ZONE EXTRACTION HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def classify(composite):
    c = np.zeros_like(composite, dtype=np.uint8)
    c[composite >= 0.80] = 5
    c[(composite >= 0.65) & (composite < 0.80)] = 4
    c[(composite >= 0.50) & (composite < 0.65)] = 3
    c[(composite >= 0.35) & (composite < 0.50)] = 2
    c[composite < 0.35] = 1
    return c


def compute_pixel_area_km2(crs, transform, shape_):
    rows, cols = shape_
    c_lon, c_lat = transform * (cols // 2, rows // 2)
    utm_epsg = 32638 if c_lon >= 42 else 32637
    t = Transformer.from_crs(crs.to_epsg(), utm_epsg, always_xy=True)
    x0, y0 = t.transform(c_lon, c_lat)
    x1, y1 = t.transform(c_lon + abs(transform.a), c_lat)
    x2, y2 = t.transform(c_lon, c_lat + abs(transform.e))
    w_m = abs(x1 - x0)
    h_m = abs(y2 - y0)
    return w_m * h_m / 1_000_000


def raster_to_polygons(data, transform, crs, keep):
    mask = np.isin(data, keep).astype(np.uint8)
    polys = []
    for geom, val in rasterio_shapes(data, mask=mask, transform=transform):
        polys.append({"geometry": shape(geom), "suitability_class": int(val)})
    return gpd.GeoDataFrame(polys, crs=crs)


def load_governorates():
    path = os.path.join(OUTPUT_DIR, "Kurdistan Region-Governorates.geojson")
    gdf = gpd.read_file(path).to_crs(epsg=4326)
    for col in ["name", "ADM1_EN"]:
        if col in gdf.columns:
            gdf["region_name"] = gdf[col].map(lambda n: GOVERNORATE_COMBINE.get(n, n))
            break
    else:
        gdf["region_name"] = gdf.iloc[:, 0].map(lambda n: GOVERNORATE_COMBINE.get(n, n))
    return gdf


def assign_governorates(gdf, gov_gdf):
    gdf_m = gdf.to_crs(epsg=32638)
    gov_m = gov_gdf.to_crs(epsg=32638)
    joined = gpd.sjoin(
        gdf_m, gov_m[["region_name", "geometry"]], how="left", predicate="within"
    )
    for c in ["index_right", "zone_id_right"]:
        if c in joined.columns:
            joined = joined.drop(columns=c)
    joined = joined.rename(columns={"region_name": "governorate"})
    if "index_left" in joined.columns:
        joined = joined.drop(columns=["index_left"])
    gdf = joined.copy()
    gdf["governorate"] = gdf["governorate"].fillna("Unknown")
    return gdf


VARIABLE_TIFS = {
    "temperature": "temperature.tif",
    "ghi": "ghi.tif",
    "dni": "dni.tif",
    "gti": "gti.tif",
    "pvout": "pvout.tif",
    "slope": "slope.tif",
    "landclass": "landclass.tif",
    "soiltype": "soiltype.tif",
    "dustsoiling": "dustsoiling.tif",
    "gridaccess": "gridaccess.tif",
}


def sample_at_centroids(gdf, transform, crs):
    """Sample all 10 variable .tif files at zone centroids."""
    a, b, c, d, e, f_ = (
        transform.a,
        transform.b,
        transform.c,
        transform.d,
        transform.e,
        transform.f,
    )
    det = a * e - b * d
    for var_name, tif_name in VARIABLE_TIFS.items():
        path = os.path.join(OUTPUT_DIR, tif_name)
        col = f"val_{var_name}"
        if not os.path.exists(path):
            continue
        with rasterio.open(path) as src:
            values = []
            for _, row in gdf.iterrows():
                lon, lat = row["centroid_lon"], row["centroid_lat"]
                rcol = round((e * (lon - c) - b * (lat - f_)) / det)
                rrow = round((a * (lat - f_) - d * (lon - c)) / det)
                if 0 <= rrow < src.height and 0 <= rcol < src.width:
                    v = src.read(1)[rrow, rcol]
                    values.append(
                        round(float(v), 4)
                        if v != src.nodata and not np.isnan(v)
                        else None
                    )
                else:
                    values.append(None)
            gdf[col] = values
    return gdf


def latlon_to_utm(lat, lon):
    t = Transformer.from_crs("EPSG:4326", "EPSG:32638", always_xy=True)
    e, n = t.transform(lon, lat)
    return round(e, 2), round(n, 2)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 65)
    print("  Solar MCDA — Direct .bin Pipeline (In-Memory)")
    print("=" * 65)

    # ── Step 1: Read & resample all .bin layers in RAM ──────────────────────
    layers = {}

    # GHI, DNI, GTI — already 1000×909, skip resampling
    for name, fname in [("ghi", "GHI.bin"), ("dni", "DNI.bin"), ("gti", "GTI.bin")]:
        meta, data = read_bin_file(os.path.join(PUBLIC_DIR, fname))
        layers[name] = nan_to_nodata(data)
        print(
            f"  [OK] {name}: {data.shape}  min={data.min():.1f}  max={data.max():.1f}"
        )

    # TEMP — 1320×1200 → resample
    meta, data = read_bin_file(os.path.join(PUBLIC_DIR, "TEMP.bin"))
    tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
    layers["temperature"] = nan_to_nodata(
        resample_to_ref(data, tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT)
    )
    print(f"  [RS] temperature: {data.shape} → {layers['temperature'].shape}")

    # PVOUT — 1000×849 → resample
    meta, data = read_bin_file(
        os.path.join(PUBLIC_DIR, "Iraq_PVOUT_Yearly_EPSG4326.bin")
    )
    tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
    layers["pvout"] = nan_to_nodata(
        resample_to_ref(data, tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT)
    )
    print(f"  [RS] pvout: {data.shape} → {layers['pvout'].shape}")

    # Slope — 1000×849 → resample
    meta, data = read_bin_file(
        os.path.join(PUBLIC_DIR, "slope", "Iraq_Slope_100m_EPSG4326.bin")
    )
    tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
    layers["slope"] = nan_to_nodata(
        resample_to_ref(data, tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT)
    )
    print(f"  [RS] slope: {data.shape} → {layers['slope'].shape}")

    # Landcover — Iraq_Landcover_NoGrass_RGBA.tif
    # Non-zero pixels = bare land (suitable); zero/NULL pixels (not covered) = also suitable per user request
    # Result: all pixels are 1.0 (no land exclusion)
    landcover_path = os.path.join(OUTPUT_DIR, "Iraq_Landcover_NoGrass_RGBA.tif")
    if os.path.exists(landcover_path):
        with rasterio.open(landcover_path) as src:
            data = src.read(1).astype(np.float32)
            tform = src.transform
            src_crs = src.crs
            layers["landclass"] = resample_to_ref(
                data,
                tform,
                src_crs,
                REF_TRANSFORM,
                REF_WIDTH,
                REF_HEIGHT,
                resampling=Resampling.nearest,
            )
            layers["landclass"] = np.ones((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
        print(
            f"  [OK] landclass: Iraq_Landcover_NoGrass_RGBA.tif → {layers['landclass'].shape}  (all zones suitable)"
        )
    else:
        layers["landclass"] = np.ones((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
        MISSING_VARIABLES.append("landclass")
        print(f"  [FALLBACK] landclass: no TIF found — treating all as suitable (1.0)")

    # Soil — remap, then resample
    meta, data = read_bin_file(os.path.join(PUBLIC_DIR, "soil", "Iraq_WRB2014.bin"))
    remapped = np.empty_like(data, dtype=np.float32)
    for code, score in SOIL_TO_SCORE.items():
        remapped[data == code] = score if not np.isnan(score) else -9999.0
    remapped = np.where(np.isnan(data), -9999.0, remapped)
    remapped = nan_to_nodata(remapped)
    tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
    layers["soiltype"] = nan_to_nodata(
        resample_to_ref(remapped, tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT)
    )
    print(f"  [RS] soiltype: {data.shape} → {layers['soiltype'].shape}")

    # Dust — average all monthly files, then resample
    dust_files = sorted(
        [
            os.path.join(PUBLIC_DIR, "dust", f)
            for f in os.listdir(os.path.join(PUBLIC_DIR, "dust"))
            if f.startswith("Dust_") and f.endswith(".bin")
        ]
    )
    accum = None
    for fp in dust_files:
        data = np.fromfile(fp, dtype=np.float32).reshape(DUST_ROWS, DUST_COLS)
        data = np.where(np.isnan(data), 0.0, data.astype(np.float64))
        accum = (accum + data) if accum is not None else data
    accum /= len(dust_files)
    accum = nan_to_nodata(accum.astype(np.float32))
    dust_tform = bbox_to_transform(DUST_BBOX, DUST_COLS, DUST_ROWS)
    layers["dustsoiling"] = nan_to_nodata(
        resample_to_ref(
            accum, dust_tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT
        )
    )
    print(
        f"  [RS] dustsoiling: averaged {len(dust_files)} files → {layers['dustsoiling'].shape}"
    )

    # Grid access — rasterise 132kV lines + distance transform
    if os.path.exists(GRID_JSON):
        with open(GRID_JSON) as f:
            geojson = json.load(f)
        all_geoms = []
        for feat in geojson.get("features", []):
            g = feat.get("geometry")
            if g is None:
                continue
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
        avg_deg = (PIXEL_W + abs(PIXEL_H)) / 2.0
        m_per_deg = 111_320.0 * np.cos(np.radians(33.5))
        px_m = avg_deg * m_per_deg
        dist = distance_transform_edt(grid_mask).astype(np.float32) * px_m
        dist = np.where(dist > 99998, 99999.0, dist)
        layers["gridaccess"] = nan_to_nodata(dist)
        print(
            f"  [OK] gridaccess: {int(grid_mask.sum())} line pixels, dist max={dist.max():.0f}m"
        )
    else:
        print(f"  [SKIP] gridaccess: {GRID_JSON} not found")

    # Elevation — check if elevation.bin exists (from download_elevation.py output)
    elev_bin = os.path.join(PUBLIC_DIR, "elevation.bin")
    elev_tif = os.path.join(PUBLIC_DIR, "elevation.tif")
    elev_tif_out = os.path.join(OUTPUT_DIR, "elevation.tif")
    if os.path.exists(elev_bin):
        meta, data = read_bin_file(elev_bin)
        tform = bbox_to_transform(meta["bbox"], meta["width"], meta["height"])
        layers["elevation"] = nan_to_nodata(
            resample_to_ref(data, tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT)
        )
        print(f"  [OK] elevation: {data.shape} → {layers['elevation'].shape}")
    elif os.path.exists(elev_tif):
        with rasterio.open(elev_tif) as src:
            data = src.read(1).astype(np.float32)
            if src.profile.get("nodata") is not None:
                data[data == src.nodata] = -9999.0
            layers["elevation"] = nan_to_nodata(
                resample_to_ref(
                    data, src.transform, src.crs, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT
                )
            )
        print(f"  [OK] elevation: {data.shape} → {layers['elevation'].shape}")
    elif os.path.exists(elev_tif_out):
        with rasterio.open(elev_tif_out) as src:
            data = src.read(1).astype(np.float32)
            if src.profile.get("nodata") is not None:
                data[data == src.nodata] = -9999.0
            layers["elevation"] = nan_to_nodata(
                resample_to_ref(
                    data, src.transform, src.crs, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT
                )
            )
        print(f"  [OK] elevation: (from zone_extractor/elevation.tif)")
    else:
        print(
            f"  [SKIP] elevation: no .bin or .tif found — add elevation to MISSING_VARIABLES if needed"
        )
        MISSING_VARIABLES.append("elevation")

    print(f"\n  Layers loaded in RAM: {list(layers.keys())}")

    # ── Step 2: Score layers ─────────────────────────────────────────────────
    # Weight redistribution for missing variables
    for m in MISSING_VARIABLES:
        if m in VARIABLES:
            VARIABLES[m]["weight"] = 0.0
    present_w = sum(
        VARIABLES[v]["weight"] for v in VARIABLES if v not in MISSING_VARIABLES
    )
    for v in VARIABLES:
        if v not in MISSING_VARIABLES:
            VARIABLES[v]["weight"] = round(VARIABLES[v]["weight"] / present_w, 4)

    scored = {}
    for name, arr in layers.items():
        if name in MISSING_VARIABLES:
            continue
        unique = np.unique(arr[arr > -9999])
        is_binary = set(float(u) for u in unique if u > -9999).issubset({0.0, 1.0})
        if is_binary:
            scored[name] = np.clip(arr, 0, 1).astype(np.float32)
            print(f"  [BINARY] {name}")
        else:
            th = SUITABILITY_THRESHOLDS.get(name)
            if th is None:
                print(f"  [SKIP] {name}: no thresholds")
                continue
            opt_min, opt_max, hard_min, hard_max = th
            invert = name in ("dustsoiling", "gridaccess")
            scored[name] = fuzzy_linear_score(
                arr, opt_min, opt_max, hard_min, hard_max, invert
            )
            print(f"  [SCORED] {name}")

    # ── Step 2b: Create Kurdistan mask ───────────────────────────────────────
    kurdistan_mask = np.ones((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
    try:
        gov_path = os.path.join(OUTPUT_DIR, "Kurdistan Region-Governorates.geojson")
        with open(gov_path) as f:
            geojson = json.load(f)
        all_geoms = []
        for feat in geojson.get("features", []):
            g = feat.get("geometry")
            if g is None:
                continue
            all_geoms.append(shape(g))
        if all_geoms:
            union = unary_union(all_geoms)
            kurdistan_mask = rasterio.features.rasterize(
                [(union, 1)],
                out_shape=(REF_HEIGHT, REF_WIDTH),
                transform=REF_TRANSFORM,
                dtype=np.uint8,
            ).astype(np.float32)
        print(
            f"  [MASK] Kurdistan mask applied: {(kurdistan_mask > 0).sum():,} / {REF_HEIGHT * REF_WIDTH:,} px inside"
        )
    except Exception as e:
        print(f"  [WARN] Could not create Kurdistan mask: {e}")

    # ── Step 3: Weighted overlay ─────────────────────────────────────────────
    composite = weighted_overlay(scored, VARIABLES)
    composite *= kurdistan_mask
    classified = classify(composite)

    total_px = composite.size
    print(f"\n  SUITABILITY SUMMARY")
    print(
        f"  Highly Suitable (≥0.80): {(classified == 5).sum():>8,} px ({100 * (classified == 5).sum() / total_px:.1f}%)"
    )
    print(
        f"  Suitable (0.65–0.80):   {(classified == 4).sum():>8,} px ({100 * (classified == 4).sum() / total_px:.1f}%)"
    )
    print(
        f"  Moderate (0.50–0.65):   {(classified == 3).sum():>8,} px ({100 * (classified == 3).sum() / total_px:.1f}%)"
    )
    print(
        f"  Marginal (0.35–0.50):   {(classified == 2).sum():>8,} px ({100 * (classified == 2).sum() / total_px:.1f}%)"
    )
    print(
        f"  Not Suitable (<0.35):   {(classified == 1).sum():>8,} px ({100 * (classified == 1).sum() / total_px:.1f}%)"
    )
    print(f"  Mean score: {composite.mean():.4f}  Max: {composite.max():.4f}")

    # ── Step 4: Export in-memory score + classified rasters ──────────────────
    score_profile = dict(
        driver="GTiff",
        height=REF_HEIGHT,
        width=REF_WIDTH,
        count=1,
        dtype=rasterio.float32,
        crs=REF_CRS,
        transform=REF_TRANSFORM,
        compress="lzw",
        nodata=-9999,
    )
    with rasterio.open(
        os.path.join(OUTPUT_DIR, "suitability_score.tif"), "w", **score_profile
    ) as dst:
        dst.write(composite.astype(np.float32), 1)
    class_profile = dict(score_profile, dtype=rasterio.uint8, nodata=0)
    with rasterio.open(
        os.path.join(OUTPUT_DIR, "suitability_classified.tif"), "w", **class_profile
    ) as dst:
        dst.write(classified.astype(np.uint8), 1)
    print(f"\n  [SAVED] suitability_score.tif  &  suitability_classified.tif")

    # ── Step 5: Zone extraction ───────────────────────────────────────────────
    print("\n  ZONE EXTRACTION")
    gov_gdf = load_governorates()
    print(f"  Governorates: {gov_gdf['region_name'].unique().tolist()}")

    pixel_area_km2 = compute_pixel_area_km2(REF_CRS, REF_TRANSFORM, composite.shape)
    print(f"  Pixel area: {pixel_area_km2:.6f} km²")

    gdf = raster_to_polygons(classified, REF_TRANSFORM, REF_CRS, KEEP_CLASSES)
    print(f"  Raw polygons: {len(gdf):,}")

    # Area calculation
    gdf_m = gdf.to_crs(epsg=32638)
    gdf["area_km2"] = (gdf_m.geometry.area / 1_000_000).round(4)
    gdf = gdf[gdf["area_km2"] >= MIN_ZONE_AREA_KM2].copy().reset_index(drop=True)
    print(f"  Zones ≥ {MIN_ZONE_AREA_KM2} km²: {len(gdf):,}")
    if len(gdf) == 0:
        print("  No eligible zones.")
        return

    gdf["zone_id"] = [f"Z{i + 1:04d}" for i in range(len(gdf))]
    gdf = assign_governorates(gdf, gov_gdf)

    # Centroid coords
    centroids = gdf.to_crs(epsg=4326).geometry.centroid
    gdf["centroid_lon"] = centroids.x.round(6)
    gdf["centroid_lat"] = centroids.y.round(6)
    bounds_wgs = gdf.to_crs(epsg=4326).geometry.bounds
    gdf["bbox_min_lon"] = bounds_wgs["minx"].round(6)
    gdf["bbox_min_lat"] = bounds_wgs["miny"].round(6)
    gdf["bbox_max_lon"] = bounds_wgs["maxx"].round(6)
    gdf["bbox_max_lat"] = bounds_wgs["maxy"].round(6)

    # Mean suitability score via zonal stats
    score_path = os.path.join(OUTPUT_DIR, "suitability_score.tif")
    try:
        from rasterstats import zonal_stats

        stats = zonal_stats(gdf, score_path, stats=["mean", "max"], nodata=-9999)
        gdf["mean_score"] = [round(s["mean"] or 0, 4) for s in stats]
        gdf["max_score"] = [round(s["max"] or 0, 4) for s in stats]
    except ImportError:
        gdf["mean_score"] = gdf["suitability_class"] / 5.0
        gdf["max_score"] = gdf["suitability_class"] / 5.0

    # Area filter for final selection
    eligible = gdf[
        (gdf["area_km2"] >= MIN_ZONE_AREA_KM2) & (gdf["area_km2"] <= MAX_ZONE_AREA_KM2)
    ].copy()
    eligible = eligible.sort_values(
        ["mean_score", "area_km2"], ascending=[False, False]
    ).reset_index(drop=True)

    max_cap = float("inf") if MAX_TOTAL_AREA_KM2 is None else MAX_TOTAL_AREA_KM2
    selected_ids, cumulative = [], 0.0
    for _, zone in eligible.iterrows():
        if cumulative >= max_cap:
            break
        cumulative += zone["area_km2"]
        selected_ids.append(zone["zone_id"])

    selected = gdf[gdf["zone_id"].isin(selected_ids)].copy()
    rejected = gdf[~gdf["zone_id"].isin(selected_ids)].copy()
    print(f"\n  Eligible (within area range): {len(eligible):,}")
    print(f"  Selected: {len(selected):,} zones | {selected['area_km2'].sum():.2f} km²")

    # ── Step 6: Sample variable values at centroids ──────────────────────────
    all_gdf = pd.concat([selected, rejected], ignore_index=True)
    all_gdf = sample_at_centroids(all_gdf, REF_TRANSFORM, REF_CRS)
    selected = all_gdf[all_gdf["zone_id"].isin(selected["zone_id"])].copy()
    rejected = all_gdf[~all_gdf["zone_id"].isin(selected["zone_id"])].copy()

    # ── Step 7: Export results ────────────────────────────────────────────────
    SUITABILITY_CLASSES = {
        5: ("Highly Suitable", "#1a9850"),
        4: ("Suitable", "#91cf60"),
        3: ("Moderate", "#fee08b"),
        2: ("Marginal", "#fc8d59"),
        1: ("Not Suitable", "#d73027"),
    }
    gdf_wgs = selected.to_crs(epsg=4326)

    var_cols = [f"val_{v}" for v in VARIABLE_TIFS]
    present_var_cols = [c for c in var_cols if c in selected.columns]
    csv_base = [
        "zone_id",
        "governorate",
        "suitability_class",
        "class_label",
        "area_km2",
        "mean_score",
        "max_score",
        "centroid_lat",
        "centroid_lon",
        "bbox_min_lat",
        "bbox_min_lon",
        "bbox_max_lat",
        "bbox_max_lon",
    ] + present_var_cols

    gdf_out = gdf_wgs.copy()
    gdf_out["class_label"] = gdf_out["suitability_class"].map(
        lambda c: SUITABILITY_CLASSES.get(c, ("Unknown", "#ccc"))[0]
    )

    csv_path = os.path.join(OUTPUT_DIR, "suitable_zones.csv")
    gdf_out[csv_base].to_csv(csv_path, index=False)
    print(f"\n  [SAVED] suitable_zones.csv")

    geojson_path = os.path.join(OUTPUT_DIR, "suitable_zones.geojson")
    gdf_out.to_file(geojson_path, driver="GeoJSON")
    print(f"  [SAVED] suitable_zones.geojson")

    shp_path = os.path.join(OUTPUT_DIR, "suitable_zones.shp")
    gdf_out.to_file(shp_path)
    print(f"  [SAVED] suitable_zones.shp")

    # ── Selection summary ─────────────────────────────────────────────────────
    total = selected["area_km2"].sum()
    print(f"\n  SELECTION SUMMARY")
    for gov in sorted(selected["governorate"].unique()):
        sub = selected[selected["governorate"] == gov]
        print(f"  {gov:<24} {len(sub):>4} zones | {sub['area_km2'].sum():>8.2f} km²")
    print(f"  {'TOTAL':<24} {len(selected):>4} zones | {total:>8.2f} km²")

    # ── Map visualization ─────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(14, 10))
    for cls, (label, color) in sorted(SUITABILITY_CLASSES.items(), reverse=True):
        sub = gdf_wgs[gdf_wgs["suitability_class"] == cls]
        if len(sub):
            sub.plot(
                ax=ax,
                color=color,
                edgecolor="white",
                linewidth=0.3,
                label=f"{label} (n={len(sub)})",
            )
    for _, row in gdf_wgs.iterrows():
        cx, cy = row.geometry.centroid.x, row.geometry.centroid.y
        ax.annotate(
            f"{row['area_km2']:.1f}km²",
            xy=(cx, cy),
            ha="center",
            va="center",
            fontsize=6,
            color="#111",
            bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.6, ec="none"),
        )
    ax.set_title(
        f"Solar Suitability Zones — Kurdistan\n{len(gdf_wgs)} zones | {total:.1f} km² total | "
        f"{MIN_ZONE_AREA_KM2}–{MAX_ZONE_AREA_KM2} km² per zone",
        fontsize=12,
    )
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "zone_map.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  [SAVED] zone_map.png")

    if len(selected) > 0:
        sample_row = selected.sort_values("area_km2", ascending=False).iloc[0]
        lat, lon = sample_row["centroid_lat"], sample_row["centroid_lon"]
        e, n = latlon_to_utm(lat, lon)
        print(
            f"\n  Largest zone {sample_row['zone_id']} ({sample_row['governorate']}):"
        )
        print(f"    WGS84: {lat}, {lon}")
        print(f"    UTM38N: {e}, {n}")
        print(
            f"    Area: {sample_row['area_km2']} km²  Score: {sample_row['mean_score']:.4f}"
        )

    print("\n[DONE]\n")


if __name__ == "__main__":
    main()
