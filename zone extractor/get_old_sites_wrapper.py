import json
import math
import os
import numpy as np
import geopandas as gpd
from shapely.geometry import Point

# Import extraction logic identically mimicking robust execution pipeline.
from solar_mcda_robust import (
    load_all_layers, run_mcda, _sample_at_centroids, _sample_bbox_mean,
    _compute_zone_ranges, _compute_landclass_pct
)

# Fix #10 -> Removed duplicates by appending "B"
mountainCities = [
  {"name": "Degala", "coordinates": [44.498525, 36.121055], "area_km2": 76.38},
  {"name": "Zirguz", "coordinates": [44.110194, 36.533453], "area_km2": 162.33},
  {"name": "Daratu", "coordinates": [43.873083, 36.594092], "area_km2": 162.44},
  {"name": "Bekhme", "coordinates": [44.172406, 36.717706], "area_km2": 45.06},
  {"name": "Atrush", "coordinates": [43.505339, 36.848319], "area_km2": 30.46},
  {"name": "Ashkafta", "coordinates": [43.558394, 36.900661], "area_km2": 36.76},
  {"name": "Gare", "coordinates": [43.461294, 36.964583], "area_km2": 57.03},
  {"name": "Mizuri Jeri", "coordinates": [43.198031, 36.864325], "area_km2": 71.03},
  {"name": "Gare B", "coordinates": [43.742822, 36.970889], "area_km2": 39.28},
  {"name": "Dedawan", "coordinates": [44.278842, 35.965478], "area_km2": 180.9},
  {"name": "Sulaymaniyah Suburbs", "coordinates": [45.710128, 35.431708], "area_km2": 53.49},
  {"name": "Darbandikhan", "coordinates": [45.533603, 35.088264], "area_km2": 96.14},
  {"name": "Kalar", "coordinates": [45.642083, 34.848997], "area_km2": 60.12},
  {"name": "Puka", "coordinates": [45.26065, 34.791131], "area_km2": 24.64},
  {"name": "Kalar B", "coordinates": [45.180361, 34.763967], "area_km2": 36.56},
  {"name": "Pesh Xabur", "coordinates": [42.535139, 37.088969], "area_km2": 11.21}
]


def _compute_bbox_from_area(lon, lat, area_km2):
    """Create a synthetic bounding box centred on (lon, lat) from area_km2.

    Assumes a square footprint.  At ~36°N latitude one degree of longitude
    ≈ 90 km and one degree of latitude ≈ 111 km, so we compute the half-
    widths in degrees accordingly.
    """
    side_km = math.sqrt(area_km2)
    half_km = side_km / 2.0
    deg_per_km_lat = 1.0 / 111.0
    deg_per_km_lon = 1.0 / (111.0 * math.cos(math.radians(lat)))
    dlat = half_km * deg_per_km_lat
    dlon = half_km * deg_per_km_lon
    return (
        round(lon - dlon, 6),   # bbox_min_lon
        round(lat - dlat, 6),   # bbox_min_lat
        round(lon + dlon, 6),   # bbox_max_lon
        round(lat + dlat, 6),   # bbox_max_lat
    )


def _derive_landclass_from_pct(row):
    """Derive val_landclass as an area-weighted score from pct_* fields.

    ESA WorldCover scoring used in the MCDA:
        Bare (60)       → 1.0
        Shrubland (50)  → 0.7
        Grassland (30)  → 0.6
        Everything else → 0.0

    The weighted score = sum(pct_class/100 × score_class).
    """
    bare  = row.get("pct_bare", 0) or 0
    shrub = row.get("pct_shrubland", 0) or 0
    grass = row.get("pct_grassland", 0) or 0
    return round(bare / 100.0 * 1.0 + shrub / 100.0 * 0.7 + grass / 100.0 * 0.6, 4)


def map_legacy_sites():
    print("Loading MCDA layers from robust pipeline...")
    layers, skipped = load_all_layers()

    print("Generating MCDA composite score...")
    composite_100, classified = run_mcda(layers, skipped)

    print("Building GeoDataFrame for legacy sites...")
    features = []
    points = []
    for city in mountainCities:
        lon, lat = city["coordinates"]
        bbox = _compute_bbox_from_area(lon, lat, city["area_km2"])
        points.append(Point(lon, lat))
        features.append({
            "zone_id":      city["name"],
            "area_km2":     city["area_km2"],
            "centroid_lon":  lon,
            "centroid_lat":  lat,
            "bbox_min_lon":  bbox[0],
            "bbox_min_lat":  bbox[1],
            "bbox_max_lon":  bbox[2],
            "bbox_max_lat":  bbox[3],
            "governorate":  "Legacy Selected",
            "is_legacy":     True,
        })

    gdf = gpd.GeoDataFrame(features, geometry=points, crs="EPSG:4326")

    # --- Sample all variable values as area-weighted bbox means ---
    # Use _sample_bbox_mean instead of _sample_at_centroids so that each
    # variable reflects the average across the full site footprint rather than
    # a single (potentially unrepresentative) centroid pixel.
    print("Sampling variables as bbox means...")
    sample_vars = {k: v for k, v in layers.items() if not k.startswith("_")}
    for var_name, arr in sample_vars.items():
        col = f"val_{var_name}"
        gdf[col] = _sample_bbox_mean(gdf, arr)
        # Compute min/max over the bounding-box window
        gdf[f"min_{var_name}"], gdf[f"max_{var_name}"] = _compute_zone_ranges(gdf, arr)

    # Sample MCDA Score (centroid is fine — it is the composite result)
    gdf["score_100"] = _sample_at_centroids(gdf, composite_100)

    # --- Land-cover percentages from original ESA raster ---
    if "_landclass_orig" in layers:
        print("Computing landclass percentages over site areas...")
        gdf = _compute_landclass_pct(gdf, layers["_landclass_orig"])

    # --- Derive val_landclass from area-weighted pct_* ---
    # Overwrite the single-pixel centroid value with the proper area-weighted
    # score so the MCDA ranking reflects actual site composition.
    print("Deriving area-weighted val_landclass from pct_* fields...")
    for idx in range(len(gdf)):
        row_dict = gdf.iloc[idx].to_dict()
        gdf.at[gdf.index[idx], "val_landclass"] = _derive_landclass_from_pct(row_dict)

    # --- Remove synthetic bbox columns from output (not needed in GeoJSON) ---
    drop_cols = ["bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat"]
    gdf = gdf.drop(columns=[c for c in drop_cols if c in gdf.columns])

    # --- Build GeoJSON ---
    final_features = []
    for _, row in gdf.iterrows():
        props = row.drop("geometry").to_dict()
        props = {k: (None if (isinstance(v, float) and math.isnan(v)) else v)
                 for k, v in props.items()}

        lon, lat = row.geometry.x, row.geometry.y
        if not (38 <= lon <= 49 and 28 <= lat <= 38):
            print(f"Warning: Site {props['zone_id']} exceeds geographic "
                  f"reference box. Skipping.")
            continue

        final_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })

    out_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "public",
        "legacy_sites.geojson",
    )
    with open(out_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": final_features},
                  f, indent=2)
    print(f"Saved {out_path}")


if __name__ == "__main__":
    map_legacy_sites()
