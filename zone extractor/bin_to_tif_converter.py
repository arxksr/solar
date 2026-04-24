"""
Binary-to-Geotiff Converter — Kurdistan Solar MCDA
===================================================
PURPOSE:
    Reads raw .bin files (with JSON metadata header) and converts them
    to properly georeferenced EPSG:4326 GeoTIFF files, resampled to a
    common reference grid (1000 cols × 909 rows, matching GHI/DNI/GTI).

    Also rasterises the 132 kV grid network into a proximity distance
    raster (gridaccess.tif).

STEPS:
    1. Converts GHI, DNI, GTI, PVOUT, TEMP, slope, landcover, soiltype
    2. Averages ALL Dust monthly .bin files (2020-2025) → dustsoiling.tif
    3. Rasterises kurdistan_132kv.geojson → gridaccess.tif (metres to nearest line)

OUTPUT:
    All .tif files are written to the same directory as this script
    (zone extractor/), ready for solar_suitability_analysis.py

REQUIREMENTS:
    pip install rasterio numpy pyproj fiona

USAGE:
    python bin_to_tif_converter.py
"""

import os
import sys
import json
import struct
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.crs import CRS
from rasterio.transform import Affine
from pyproj import Transformer
from rasterio import features
from scipy.ndimage import distance_transform_edt

# ─────────────────────────────────────────────────────────────────────────────
# PATHS — edit these if your data lives elsewhere
# ─────────────────────────────────────────────────────────────────────────────

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
GRID_JSON = os.path.join(PUBLIC_DIR, "kurdistan_132kv.geojson")

# Reference grid: GHI / DNI / GTI / PVOUT grid dimensions
# All layers will be resampled to this grid (EPSG:4326)
REF_BBOX = [38.0, 28.0, 49.0, 38.0]  # [lon_min, lat_min, lon_max, lat_max]
REF_WIDTH = 1000
REF_HEIGHT = 909

# Pixel size in degrees
PIXEL_W = (REF_BBOX[2] - REF_BBOX[0]) / REF_WIDTH  # ~0.011
PIXEL_H = (REF_BBOX[3] - REF_BBOX[1]) / REF_HEIGHT  # ~0.011

REF_CRS = CRS.from_epsg(4326)
REF_TRANSFORM = Affine(PIXEL_W, 0.0, REF_BBOX[0], 0.0, -PIXEL_H, REF_BBOX[3])

# ─────────────────────────────────────────────────────────────────────────────
# BIN READING UTILITIES
# ─────────────────────────────────────────────────────────────────────────────


def read_bin_file(filepath):
    """
    Reads a Solar Atlas .bin file with JSON metadata header.
    Returns (meta_dict, data_numpy_array).
    """
    with open(filepath, "rb") as f:
        meta_len = struct.unpack("<I", f.read(4))[0]
        meta = json.loads(f.read(meta_len).decode("utf-8"))
        pad = (4 - (4 + meta_len) % 4) % 4
        f.read(pad)
        buf = f.read()
        data = np.frombuffer(buf, dtype=np.float32)
    w = meta["width"]
    h = meta["height"]
    data = data.reshape(h, w)
    if meta.get("isFlipped", False):
        data = np.flipud(data)
    return meta, data


def bbox_to_transform(bbox, width, height):
    """Build rasterio Affine from bbox metadata."""
    pixel_w = (bbox[2] - bbox[0]) / width
    pixel_h = (bbox[3] - bbox[1]) / height
    return Affine(pixel_w, 0.0, bbox[0], 0.0, -pixel_h, bbox[3])


def resample_to_ref(
    data,
    src_transform,
    src_crs,
    dst_transform,
    dst_width,
    dst_height,
    resampling=Resampling.bilinear,
):
    """
    Resamples a raster array to the reference grid.
    Args:
        resampling: rasterio Resampling method (default: bilinear)
    Returns the resampled numpy array.
    """
    src_height, src_width = data.shape

    dst_data = np.zeros((dst_height, dst_width), dtype=np.float32)

    reproject(
        source=data,
        destination=dst_data,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=dst_transform,
        dst_crs=REF_CRS,
        resampling=resampling,
    )
    return dst_data


def write_tif(
    array, output_path, transform, crs=REF_CRS, nodata=-9999.0, compress="lzw"
):
    """Writes a numpy array as a compressed GeoTIFF."""
    profile = {
        "driver": "GTiff",
        "height": array.shape[0],
        "width": array.shape[1],
        "count": 1,
        "dtype": "float32",
        "crs": crs,
        "transform": transform,
        "nodata": nodata,
        "compress": compress,
    }
    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(array, 1)
    print(
        f"  [SAVED] {os.path.basename(output_path)}  {array.shape}  "
        f"min={np.nanmin(array):.2f}  max={np.nanmax(array):.2f}"
    )


def nan_to_nodata(array, nodata=-9999.0):
    array = np.where(np.isnan(array), nodata, array)
    array = np.where(np.isinf(array), nodata, array)
    return array.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# PER-VARIABLE LAYER CONVERTERS
# ─────────────────────────────────────────────────────────────────────────────


def convert_ghi():
    path = os.path.join(PUBLIC_DIR, "GHI.bin")
    meta, data = read_bin_file(path)
    data = nan_to_nodata(data)
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "ghi.tif"), REF_TRANSFORM)


def convert_dni():
    path = os.path.join(PUBLIC_DIR, "DNI.bin")
    meta, data = read_bin_file(path)
    data = nan_to_nodata(data)
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "dni.tif"), REF_TRANSFORM)


def convert_gti():
    path = os.path.join(PUBLIC_DIR, "GTI.bin")
    meta, data = read_bin_file(path)
    data = nan_to_nodata(data)
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "gti.tif"), REF_TRANSFORM)


def convert_pvout():
    path = os.path.join(PUBLIC_DIR, "Iraq_PVOUT_Yearly_EPSG4326.bin")
    meta, data = read_bin_file(path)
    data = nan_to_nodata(data)
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "pvout.tif"), REF_TRANSFORM)


def convert_temperature():
    path = os.path.join(PUBLIC_DIR, "TEMP.bin")
    meta, data = read_bin_file(path)
    print(
        f"  TEMP raw: min={np.nanmin(data):.1f} max={np.nanmax(data):.1f} mean={np.nanmean(data):.1f}"
    )
    data = nan_to_nodata(data)
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "temperature.tif"), REF_TRANSFORM)


def convert_slope():
    path = os.path.join(PUBLIC_DIR, "slope", "Iraq_Slope_100m_EPSG4326.bin")
    meta, data = read_bin_file(path)
    data = nan_to_nodata(data)
    print(f"  Slope raw: min={np.nanmin(data):.1f} max={np.nanmax(data):.1f}")
    data = resample_to_ref(
        data,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(data, os.path.join(OUTPUT_DIR, "slope.tif"), REF_TRANSFORM)


def convert_landcover():
    from rasterio.enums import Resampling as RResampling

    LU_TO_SCORE = {
        0: np.nan,  # NoData
        10: np.nan,  # Urban — EXCLUDED
        20: np.nan,  # Cropland — EXCLUDED
        30: np.nan,  # Grassland — EXCLUDED
        40: np.nan,  # Forest — EXCLUDED
        50: np.nan,  # Shrubland — EXCLUDED
        60: 1.0,  # Bare/Barren — KEEP ONLY THIS
        80: np.nan,  # Wetlands — EXCLUDED
        90: np.nan,  # Water — EXCLUDED
    }
    path = os.path.join(PUBLIC_DIR, "landcover", "Iraq_Landcover_ESA.bin")
    meta, data = read_bin_file(path)
    remapped = np.empty_like(data, dtype=np.float32)
    for code, score in LU_TO_SCORE.items():
        remapped[data == code] = score if not np.isnan(score) else -9999.0
    remapped = np.where(np.isnan(data), -9999.0, remapped)
    remapped = nan_to_nodata(remapped)
    valid = remapped[remapped != -9999.0]
    excluded = remapped == -9999.0
    print(
        f"  Landcover remapped: valid scores={sorted(np.unique(valid).astype(int))}  "
        f"excluded (forest/urban/water/wetlands)={int(excluded.sum() / 1000):,} pixels"
    )
    remapped = resample_to_ref(
        remapped,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
        resampling=RResampling.nearest,  # nearest to preserve discrete class boundaries
    )
    write_tif(
        remapped,
        os.path.join(OUTPUT_DIR, "landclass.tif"),
        REF_TRANSFORM,
        nodata=-9999.0,
    )


def convert_soiltype():
    SOIL_TO_SCORE = {
        0: np.nan,  # NoData / Water / Urban
        3: 2,  # Fluvisol/Leptosol/Rocks
        6: 9,  # Durisols/Calcisols/Gypsisols (coarse, excellent drainage)
        7: 8,  # Kastanozems/Chernozems/Phaeozems (loam)
        9: 5,  # Ferralsols/Nitisols/Plinthosols
        10: 5,  # Anthrosols (human-made)
        11: 4,  # Luvisols/Acrisols/Podzols
        14: 3,  # Lixisols/Acrisols
        15: 3,  # Vertisols (heavy clay)
        16: 2,  # Podzols/Histosols
    }
    path = os.path.join(PUBLIC_DIR, "soil", "Iraq_WRB2014.bin")
    meta, data = read_bin_file(path)
    remapped = np.empty_like(data, dtype=np.float32)
    for code, score in SOIL_TO_SCORE.items():
        remapped[data == code] = score if not np.isnan(score) else -9999.0
    remapped = np.where(np.isnan(data), -9999.0, remapped)
    remapped = nan_to_nodata(remapped)
    valid = remapped[remapped != -9999.0]
    print(f"  Soil remapped: unique scores = {sorted(np.unique(valid).astype(int))}")
    remapped = resample_to_ref(
        remapped,
        bbox_to_transform(meta["bbox"], meta["width"], meta["height"]),
        REF_CRS,
        REF_TRANSFORM,
        REF_WIDTH,
        REF_HEIGHT,
    )
    write_tif(
        remapped,
        os.path.join(OUTPUT_DIR, "soiltype.tif"),
        REF_TRANSFORM,
        nodata=-9999.0,
    )


def convert_dustsoiling():
    """
    Averages ALL monthly Dust .bin files found in public/dust/ (2020-2025)
    into a single annual dustsoiling.tif.

    The dust .bin files are RAW float32 (no JSON header) at 438 cols × 371 rows.
    Georeference is inferred from the companion TIF:
      Iraq_Monthly_Max_Dust_2020_2026.tif  bbox=[38.78, 29.06, 48.62, 37.38]
    """
    dust_dir = os.path.join(PUBLIC_DIR, "dust")
    dust_tif = os.path.join(PUBLIC_DIR, "dust", "Iraq_Monthly_Max_Dust_2020_2026.tif")

    # Dust grid dimensions (438 cols × 371 rows)
    DUST_COLS, DUST_ROWS = 438, 371
    DUST_BBOX = [
        38.78476239186034,
        29.06049944126652,
        48.6213147529691,
        37.39237370147508,
    ]

    dust_files = sorted(
        [
            os.path.join(dust_dir, f)
            for f in os.listdir(dust_dir)
            if f.startswith("Dust_") and f.endswith(".bin")
        ]
    )
    if not dust_files:
        print("  [ERROR] No Dust .bin files found in public/dust/")
        return

    print(f"  Found {len(dust_files)} monthly dust .bin files")
    print(f"  Grid: {DUST_COLS}×{DUST_ROWS}  bbox={DUST_BBOX}")

    accum = None
    count = 0

    for fp in dust_files:
        data = np.fromfile(fp, dtype=np.float32)
        data = data.reshape(DUST_ROWS, DUST_COLS)
        if accum is None:
            accum = np.zeros_like(data, dtype=np.float64)
        data = np.where(np.isnan(data), 0.0, data.astype(np.float64))
        accum += data
        count += 1

    accum /= count
    accum = nan_to_nodata(accum.astype(np.float32))
    print(
        f"  Annual average (pre-resample): min={np.nanmin(accum):.3f}  "
        f"max={np.nanmax(accum):.3f}  mean={np.nanmean(accum):.3f}"
    )

    dust_tform = bbox_to_transform(DUST_BBOX, DUST_COLS, DUST_ROWS)

    print(f"  Resampling to reference grid ({REF_WIDTH}×{REF_HEIGHT})...")
    accum = resample_to_ref(
        accum, dust_tform, REF_CRS, REF_TRANSFORM, REF_WIDTH, REF_HEIGHT
    )
    write_tif(accum, os.path.join(OUTPUT_DIR, "dustsoiling.tif"), REF_TRANSFORM)


def convert_gridaccess():
    """
    Rasterises kurdistan_132kv.geojson (132 kV transmission lines) into a
    proximity distance raster: each pixel = distance in metres to nearest line.

    Uses json (stdlib) to read the geojson and rasterio.features.rasterize
    to burn LineString/MultiLineString geometries into a binary mask.
    """
    if not os.path.exists(GRID_JSON):
        print(f"  [ERROR] Grid file not found: {GRID_JSON}")
        return

    print("  Loading 132 kV grid lines from geojson...")
    with open(GRID_JSON) as f:
        geojson = json.load(f)

    all_geoms = []
    for feature in geojson.get("features", []):
        geom = feature.get("geometry")
        if geom is None:
            continue
        geom_type = geom.get("type")
        coords = geom.get("coordinates")
        if geom_type == "LineString":
            all_geoms.append({"type": "LineString", "coordinates": coords})
        elif geom_type == "MultiLineString":
            for line in coords:
                all_geoms.append({"type": "LineString", "coordinates": line})

    print(f"  {len(all_geoms)} line(s) loaded")

    out_shape = (REF_HEIGHT, REF_WIDTH)
    out_transform = REF_TRANSFORM

    print("  Rasterizing grid lines onto reference grid...")
    grid_mask = features.rasterize(
        [(geom, 1) for geom in all_geoms],
        out_shape=out_shape,
        transform=out_transform,
        dtype=np.uint8,
    )
    print(f"  Grid pixels: {int(grid_mask.sum()):,}")

    dist_m = compute_proximity_distance(grid_mask)
    dist_m = nan_to_nodata(dist_m)
    print(
        f"  Grid proximity: min={np.nanmin(dist_m):.0f}m  "
        f"max={np.nanmax(dist_m):.0f}m  mean={np.nanmean(dist_m):.0f}m"
    )

    write_tif(dist_m, os.path.join(OUTPUT_DIR, "gridaccess.tif"), REF_TRANSFORM)


def compute_proximity_distance(mask):
    """
    Computes distance in metres from every pixel to the nearest grid-line pixel.
    Uses scipy.ndimage.distance_transform_edt (C-accelerated exact Euclidean transform).
    Pixel size is averaged from the reference grid's lon/lat span → metres.
    """
    avg_deg_per_pixel = (PIXEL_W + abs(PIXEL_H)) / 2.0
    m_per_deg = 111_320.0 * np.cos(np.radians(33.5))
    pixel_size_m = avg_deg_per_pixel * m_per_deg

    dist_px = distance_transform_edt(mask).astype(np.float32)
    dist_m = dist_px * pixel_size_m
    dist_m = np.where(dist_m > 99998, 99999.0, dist_m)
    return dist_m


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    print("=" * 60)
    print("  Binary → Geotiff Converter")
    print(f"  Public dir : {PUBLIC_DIR}")
    print(f"  Output dir : {OUTPUT_DIR}")
    print(f"  Reference grid: {REF_WIDTH}×{REF_HEIGHT}  bbox={REF_BBOX}")
    print("=" * 60)

    print("\n[1/9] GHI...")
    convert_ghi()

    print("\n[2/9] DNI...")
    convert_dni()

    print("\n[3/9] GTI...")
    convert_gti()

    print("\n[4/9] PVOUT...")
    convert_pvout()

    print("\n[5/9] Temperature...")
    convert_temperature()

    print("\n[6/9] Slope...")
    convert_slope()

    print("\n[7/9] Landcover → landclass.tif...")
    convert_landcover()

    print("\n[8/9] Soil → soiltype.tif (WRB classification)...")
    convert_soiltype()

    print("\n[9/9] Dust (averaging all monthly files 2020-2025)...")
    convert_dustsoiling()

    print("\n[10/10] Grid access (132 kV lines → proximity distance)...")
    convert_gridaccess()

    print("\n[DONE] All TIFs written to:", OUTPUT_DIR)
    print("\nNext: python solar_suitability_analysis.py")
    print("Then: python zone_extractor.py")


if __name__ == "__main__":
    main()
