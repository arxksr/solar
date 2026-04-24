#!/usr/bin/env python3
"""
SRTM DEM Auto-Downloader — Kurdistan Region
==========================================
PURPOSE:
    Downloads SRTM 1-arc-second (≈30 m) elevation data for the study area
    bounding box [38°E, 28°N – 49°E, 38°N] from NASA's LP DAAC public CDN,
    mosaics the tiles, and exports a properly georeferenced elevation.tif
    to the zone extractor folder — ready for solar_suitability_analysis.py.

SRTM TILE NAMING:
    File format: N<lat>E<lon>.hgt.zip
    Each tile covers a 1°×1° cell.
    e.g. N37E038.zip covers lat 37°–38°N, lon 38°–39°E

COVERAGE CHECKED:
    Lat 28°N–38°N  → tiles N28, N29, N30, N31, N32, N33, N34, N35, N36, N37
    Lon 38°E–49°E  → tiles E038, E039, E040, E041, E042, E043, E044,
                      E045, E046, E047, E048, E049

TECHNICAL DETAILS:
    LP DAAC CDN: https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11/
    HGT file format: big-endian Int16, 3601×3601 samples per tile
    (1-arc-second → 1 pixel per 1/3600°)

USAGE:
    python download_elevation.py

REQUIREMENTS:
    pip install numpy rasterio requests

OUTPUT:
    ../zone extractor/elevation.tif  (EPSG:4326, 30m resolution)
"""

import os
import sys
import struct
import zipfile
import io
import tempfile
import shutil
import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.crs import CRS
import requests

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

BBOX = [38.0, 28.0, 49.0, 38.0]  # [lon_min, lat_min, lon_max, lat_max]
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "zone extractor", "elevation.tif"
)

SRTM_URL_BASE = "https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11"

# SRTM tile size
TILE_SIZE = 3601  # 1-arc-second × 1° = 3601 × 3601 samples

# USGS requires a user-agent so we identify ourselves
HEADERS = {
    "User-Agent": "SolarAtlas-Explorer/1.0 (geospatial analysis; educational use)",
    "Accept": "application/zip, application/x-hgt, */*",
}


# ─────────────────────────────────────────────────────────────────────────────
# TILE DISCOVERY
# ─────────────────────────────────────────────────────────────────────────────


def list_tiles_needed(bbox):
    """Return list of (lat_str, lon_str) tile identifiers covering the bbox."""
    lon_min, lat_min, lon_max, lat_max = bbox
    tiles = []
    for lat in range(int(lat_min), int(lat_max) + 1):
        lat_str = f"N{lat:02d}" if lat >= 0 else f"S{abs(lat):02d}"
        for lon in range(int(lon_min), int(lon_max) + 1):
            lon_str = f"E{lon:03d}" if lon >= 0 else f"W{abs(lon):03d}"
            tiles.append((lat_str, lon_str))
    return tiles


def tile_url(lat_str, lon_str):
    filename = f"{lat_str}{lon_str}.SRTMGL1.hgt.zip"
    return f"{SRTM_URL_BASE}/{filename}"


def tile_hgt_path(zip_path, lat_str, lon_str):
    return f"{lat_str}{lon_str}.hgt"


# ─────────────────────────────────────────────────────────────────────────────
# DOWNLOAD
# ─────────────────────────────────────────────────────────────────────────────


def download_tile(lat_str, lon_str, timeout=60):
    url = tile_url(lat_str, lon_str)
    filename = f"{lat_str}{lon_str}.SRTMGL1.hgt.zip"
    print(f"  Downloading {filename} ...", end="", flush=True)
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, stream=True)
        r.raise_for_status()
        data = r.content
        print(f" {len(data) / 1024:.0f} KB", flush=True)
        return data
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            print(f"  not found (tile may be ocean or unavailable)", flush=True)
            return None
        print(f"  HTTP error {e}", flush=True)
        return None
    except Exception as e:
        print(f"  error: {e}", flush=True)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# PARSE HGT
# ─────────────────────────────────────────────────────────────────────────────


def read_hgt_from_zip(zip_bytes, hgt_filename):
    """Read big-endian Int16 HGT data from a zip archive's HGT file."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        if hgt_filename not in zf.namelist():
            raise ValueError(f"{hgt_filename} not found in zip")
        with zf.open(hgt_filename) as f:
            data = f.read()
    arr = np.frombuffer(data, dtype=">i2").astype(np.int16)
    arr = arr.reshape(TILE_SIZE, TILE_SIZE)
    return arr


# ─────────────────────────────────────────────────────────────────────────────
# MOSAIC + CLIP TO BBOX
# ─────────────────────────────────────────────────────────────────────────────


def mosaic_tiles(tile_data_dict, bbox):
    """
    Mosaic multiple SRTM tiles into a single array covering the bbox.
    tile_data_dict: {(lat_str, lon_str): np.ndarray}
    Each tile is 3601×3601 at 1 arc-second.

    Returns (mosaic_array, mosaic_transform, mosaic_crs)
    """
    lon_min, lat_min, lon_max, lat_max = bbox
    n_lon = 3601  # samples per degree at 1-arc-second
    n_lat = 3601

    lon_samples = int((lon_max - lon_min) * n_lon)
    lat_samples = int((lat_max - lat_min) * n_lat)

    mosaic = np.full((lat_samples, lon_samples), -32768, dtype=np.int16)
    px_per_deg_lon = 3601 / 1.0
    px_per_deg_lat = 3601 / 1.0

    for (lat_str, lon_str), tile in tile_data_dict.items():
        lat_center = int(lat_str[1:3]) + 0.5
        lon_center = int(lon_str[1:4]) + 0.5

        lat_tile_min = lat_center - 0.5
        lat_tile_max = lat_center + 0.5
        lon_tile_min = lon_center - 0.5
        lon_tile_max = lon_center + 0.5

        col0 = max(0, int((lon_tile_min - lon_min) * px_per_deg_lon))
        col1 = min(lon_samples, int((lon_tile_max - lon_min) * px_per_deg_lon))
        row0 = max(0, int((lat_max - lat_tile_max) * px_per_deg_lat))
        row1 = min(lat_samples, int((lat_max - lat_tile_min) * px_per_deg_lat))

        tile_col0 = max(0, int((lon_min - lon_tile_min) * px_per_deg_lon))
        tile_row0 = max(0, int((lat_tile_max - lat_max) * px_per_deg_lat))

        h, w = tile.shape
        copy_w = min(col1 - col0, w - tile_col0)
        copy_h = min(row1 - row0, h - tile_row0)

        if copy_w <= 0 or copy_h <= 0:
            continue

        tile_crop = tile[tile_row0 : tile_row0 + copy_h, tile_col0 : tile_col0 + copy_w]
        nodata_mask = tile_crop == -32768
        mosaic[row0 : row0 + copy_h, col0 : col0 + copy_w] = tile_crop

    pixel_w = (lon_max - lon_min) / lon_samples
    pixel_h = (lat_max - lat_min) / lat_samples
    transform = Affine(pixel_w, 0.0, lon_min, 0.0, -pixel_h, lat_max)
    return mosaic, transform


# ─────────────────────────────────────────────────────────────────────────────
# RESAMPLE TO REFERENCE GRID
# ─────────────────────────────────────────────────────────────────────────────


def resample_to_reference(dem_array, dem_transform, ref_path=None):
    """
    Bilinear-resample DEM array to match the reference grid of the other TIFs.
    Reference: 1000 cols × 909 rows, bbox [38,28,49,38], EPSG:4326
    """
    from rasterio.warp import reproject, Resampling

    REF_BBOX = [38.0, 28.0, 49.0, 38.0]
    REF_WIDTH = 1000
    REF_HEIGHT = 909
    REF_CRS = CRS.from_epsg(4326)

    px = (REF_BBOX[2] - REF_BBOX[0]) / REF_WIDTH
    py = (REF_BBOX[3] - REF_BBOX[1]) / REF_HEIGHT
    ref_transform = Affine(px, 0.0, REF_BBOX[0], 0.0, -py, REF_BBOX[3])

    dem_data = dem_array.astype(np.float32)
    dem_data = np.where(dem_data == -32768, np.nan, dem_data)

    out = np.zeros((REF_HEIGHT, REF_WIDTH), dtype=np.float32)
    reproject(
        source=dem_data,
        destination=out,
        src_transform=dem_transform,
        src_crs=CRS.from_epsg(4326),
        dst_transform=ref_transform,
        dst_crs=REF_CRS,
        resampling=Resampling.bilinear,
    )
    out = np.where(np.isnan(out), -9999.0, out)
    return out.astype(np.float32), ref_transform


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
# IMPORT GATE
# ─────────────────────────────────────────────────────────────────────────────

try:
    import io
except ImportError:
    io = None  # Python 3 stdlib


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────


def main():
    tiles = list_tiles_needed(BBOX)
    print(f"SRTM DEM Downloader — Kurdistan Region")
    print(f"Bounding box: {BBOX}")
    print(f"Tiles needed: {len(tiles)}")
    print(f"URL base: {SRTM_URL_BASE}")
    print()

    tile_data = {}
    failed = []

    for lat_str, lon_str in tiles:
        zip_data = download_tile(lat_str, lon_str)
        if zip_data is None:
            failed.append((lat_str, lon_str))
            continue
        try:
            hgt_file = tile_hgt_path(zip_data, lat_str, lon_str)
            arr = read_hgt_from_zip(zip_data, hgt_file)
            tile_data[(lat_str, lon_str)] = arr
            print(
                f"    {lat_str}{lon_str}: shape={arr.shape}, "
                f"range={arr.min()} to {arr.max()}"
            )
        except Exception as e:
            print(f"    FAILED to parse {lat_str}{lon_str}: {e}")
            failed.append((lat_str, lon_str))

    if not tile_data:
        print("ERROR: No tiles downloaded. Check network connection.")
        sys.exit(1)

    print(f"\nMosaicking {len(tile_data)} tile(s)...")
    mosaic_arr, mosaic_transform = mosaic_tiles(tile_data, BBOX)
    print(
        f"  Mosaic shape: {mosaic_arr.shape}  "
        f"range: {mosaic_arr.min()} to {mosaic_arr.max()}"
    )

    print(f"\nResampling to reference grid (1000×909)...")
    dem_resampled, ref_transform = resample_to_reference(mosaic_arr, mosaic_transform)

    print(f"\nWriting elevation.tif...")
    write_tif(dem_resampled, ref_transform, OUTPUT_PATH)

    print(f"\n[DONE] Elevation data ready at: {OUTPUT_PATH}")
    if failed:
        print(f"Failed tiles: {failed}")
    print(
        "\nNext: python bin_to_tif_converter.py  → re-convert all bins with elevation added"
    )


if __name__ == "__main__":
    main()
