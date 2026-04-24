"""
Solar Suitability Zone Extractor — Kurdistan Region
==================================================
PURPOSE:
    Takes the output of solar_suitability_analysis.py and:
    1. Converts suitable pixels → polygon zones (vectorization)
    2. Calculates the actual area of each zone in km²
    3. Assigns each zone to a governorate (Sulaimaniya+Halabja combined)
    4. Filters zones by minimum and maximum area
    5. Globally selects highest-scoring zones up to MAX_TOTAL_AREA_KM2
    6. Extracts centroid coordinates (Lat/Lon) for each zone
    7. Samples all 10 input variable values at each zone centroid
    8. Exports results as:
        - suitable_zones.geojson   → open in QGIS / Google Earth / ArcGIS
        - suitable_zones.shp       → Shapefile for GIS software
        - suitable_zones.csv       → Spreadsheet with coords + area + all var values
        - zone_map.png            → Visual overview map

REQUIREMENTS:
    pip install rasterio numpy geopandas shapely matplotlib fiona pyproj rasterstats scipy

INPUT FILES (produced by solar_suitability_analysis.py):
    suitability_classified.tif    ← required
    suitability_score.tif       ← required (used for scoring zones)
    ghi.tif / dni.tif / gti.tif / pvout.tif / temperature.tif /
    slope.tif / landclass.tif / soiltype.tif / dustsoiling.tif /
    gridaccess.tif              ← required (all 10 input variable rasters)
    ../Kurdistan Region-Governorates.geojson  ← governorate boundaries

USAGE:
    python zone_extractor.py

CONFIGURATION (edit at top of file):
    MIN_ZONE_AREA_KM2  — minimum zone size (km²); default 5.0
    MAX_ZONE_AREA_KM2  — maximum zone size (km²); default 100.0 (no hard cap)
    MAX_TOTAL_AREA_KM2 — global cap on total selected area (km²); default 500.0
                          Set to None to disable the global cap.
"""

import os
import sys
import warnings
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.crs import CRS
import geopandas as gpd
from shapely.geometry import shape
import matplotlib.pyplot as plt
import pandas as pd
from pyproj import Transformer

warnings.filterwarnings("ignore", category=UserWarning)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

MIN_ZONE_AREA_KM2 = 5.0
MAX_ZONE_AREA_KM2 = 10.0
MAX_TOTAL_AREA_KM2 = None  # no global cap — all eligible zones within Kurdistan kept

SUITABILITY_CLASSES = {
    5: ("Highly Suitable", "#1a9850"),
    4: ("Suitable", "#91cf60"),
    3: ("Moderately Suitable", "#fee08b"),
    2: ("Marginal", "#fc8d59"),
    1: ("Not Suitable", "#d73027"),
}

KEEP_CLASSES = [3, 4, 5]

GOVERNORATE_COMBINE = {
    "Sulaimaniya Governorate": "Sulaimaniya+Halabja",
    "Halabja Governorate": "Sulaimaniya+Halabja",
    "Duhok Governorate": "Duhok",
    "Erbil Governorate": "Erbil",
}

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

VARIABLE_LABELS = {
    "temperature": "Temperature (°C)",
    "ghi": "GHI (kWh/m²/yr)",
    "dni": "DNI (kWh/m²/yr)",
    "gti": "GTI (kWh/m²/yr)",
    "pvout": "PVOUT (kWh/kWp/yr)",
    "slope": "Slope (°)",
    "landclass": "Land Class (1=bare,2=crop/grass/shrub)",
    "soiltype": "Soil Suitability Score (1-10)",
    "dustsoiling": "Dust Soiling AOD (lower=better)",
    "gridaccess": "Grid Distance (m)",
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────


def transform_from_latlon(crs):
    return Transformer.from_crs(crs.to_epsg(), 32638, always_xy=True)


def sample_raster_at_points(gdf, raster_path, col_name, transform, crs):
    """Sample a raster at zone centroid points. Returns (col_name, success)."""
    if not os.path.exists(raster_path):
        return col_name, False

    with rasterio.open(raster_path) as src:
        a, b, c, d, e, f_ = (
            src.transform.a,
            src.transform.b,
            src.transform.c,
            src.transform.d,
            src.transform.e,
            src.transform.f,
        )
        det = a * e - b * d
        values = []
        for _, row in gdf.iterrows():
            lon, lat = row["centroid_lon"], row["centroid_lat"]
            r_col = round((e * (lon - c) - b * (lat - f_)) / det)
            r_row = round((a * (lat - f_) - d * (lon - c)) / det)
            if 0 <= r_row < src.height and 0 <= r_col < src.width:
                val = src.read(1)[r_row, r_col]
                values.append(round(float(val), 4) if not np.isnan(val) else None)
            else:
                values.append(None)

    gdf[col_name] = values
    return col_name, True


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Load classified raster
# ─────────────────────────────────────────────────────────────────────────────


def load_classified_raster(script_dir):
    path = os.path.join(script_dir, "suitability_classified.tif")
    if not os.path.exists(path):
        print(f"\n  ERROR: {path} not found.")
        print("  Run solar_suitability_analysis.py first.")
        sys.exit(1)

    with rasterio.open(path) as src:
        data = src.read(1).astype(np.uint8)
        transf = src.transform
        crs = src.crs
        nodata = src.nodata or 0
        print(f"  CRS          : {crs}")
        print(f"  Shape        : {src.height} rows × {src.width} cols")
        print(f"  Pixel size   : {abs(src.res[0]):.4f}° × {abs(src.res[1]):.4f}°")

    return data, transf, crs, nodata


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Load governorates GeoJSON
# ─────────────────────────────────────────────────────────────────────────────


def load_governorates(script_dir):
    path = os.path.join(script_dir, "Kurdistan Region-Governorates.geojson")
    gdf = gpd.read_file(path).to_crs(epsg=4326)
    for col in ["name", "ADM1_EN"]:
        if col in gdf.columns:
            gdf["region_name"] = gdf[col].map(lambda n: GOVERNORATE_COMBINE.get(n, n))
            break
    else:
        gdf["region_name"] = gdf.iloc[:, 0].map(lambda n: GOVERNORATE_COMBINE.get(n, n))
    print(f"  Governorates: {gdf['region_name'].unique().tolist()}")
    return gdf


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Compute pixel area in km²
# ─────────────────────────────────────────────────────────────────────────────


def compute_pixel_area_km2(crs, transform, data_shape):
    rows, cols = data_shape
    centre_lon, centre_lat = transform * (cols // 2, rows // 2)
    utm_epsg = 32638 if centre_lon >= 42 else 32637
    t = Transformer.from_crs(crs.to_epsg(), utm_epsg, always_xy=True)
    x0, y0 = t.transform(centre_lon, centre_lat)
    x1, y1 = t.transform(centre_lon + abs(transform.a), centre_lat)
    x2, y2 = t.transform(centre_lon, centre_lat + abs(transform.e))
    w_m = abs(x1 - x0)
    h_m = abs(y2 - y0)
    area_m2 = w_m * h_m
    area_km2 = area_m2 / 1_000_000
    print(
        f"  Pixel area: {w_m:.1f}m × {h_m:.1f}m = {area_m2:.0f} m² = {area_km2:.6f} km²"
    )
    print(f"  → {MIN_ZONE_AREA_KM2} km² ≈ {MIN_ZONE_AREA_KM2 / area_km2:,.0f} pixels")
    return area_km2


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Vectorise raster → polygons
# ─────────────────────────────────────────────────────────────────────────────


def raster_to_polygons(data, transform, crs, keep_classes):
    mask = np.isin(data, keep_classes).astype(np.uint8)
    polys = []
    for geom, val in shapes(data, mask=mask, transform=transform):
        polys.append(
            {
                "geometry": shape(geom),
                "suitability_class": int(val),
                "class_label": SUITABILITY_CLASSES.get(int(val), ("Unknown", "#ccc"))[
                    0
                ],
            }
        )
    print(f"  Raw polygons: {len(polys):,}")
    return gpd.GeoDataFrame(polys, crs=crs)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Area + governorate assignment + centroid coords
# ─────────────────────────────────────────────────────────────────────────────


def calculate_area_and_governorates(gdf, governorates_gdf, pixel_area_km2):
    gdf_m = gdf.to_crs(epsg=32638)
    gdf["area_km2"] = (gdf_m.geometry.area / 1_000_000).round(4)

    gdf = gdf[gdf["area_km2"] >= MIN_ZONE_AREA_KM2].copy().reset_index(drop=True)
    print(f"  Zones ≥ {MIN_ZONE_AREA_KM2} km²: {len(gdf):,}")

    if len(gdf) == 0:
        return gdf

    gdf["zone_id"] = [f"Z{i + 1:04d}" for i in range(len(gdf))]

    gov_m = governorates_gdf.to_crs(epsg=32638)
    joined = gpd.sjoin(
        gdf, gov_m[["region_name", "geometry"]], how="left", predicate="within"
    )
    for c in ["index_right", "zone_id_right"]:
        if c in joined.columns:
            joined = joined.drop(columns=c)
    joined = joined.rename(columns={"region_name": "governorate"})
    if "index_left" in joined.columns:
        joined = joined.drop(columns=["index_left"])
    gdf = joined.copy()

    gdf["governorate"] = gdf["governorate"].fillna("Unknown")

    if gdf["governorate"].isna().all() or (gdf["governorate"] == "Unknown").all():
        bounds_g = governorates_gdf.to_crs(epsg=4326)
        assigned = []
        for _, row in gdf.iterrows():
            pt = row.geometry.centroid
            for _, gov in bounds_g.iterrows():
                if gov.geometry.contains(pt):
                    assigned.append(
                        GOVERNORATE_COMBINE.get(gov["region_name"], gov["region_name"])
                    )
                    break
            else:
                assigned.append("Unknown")
        gdf["governorate"] = assigned

    centroids_wgs = gdf.to_crs(epsg=4326).geometry.centroid
    gdf["centroid_lon"] = centroids_wgs.x.round(6)
    gdf["centroid_lat"] = centroids_wgs.y.round(6)

    bounds_wgs = gdf.to_crs(epsg=4326).geometry.bounds
    gdf["bbox_min_lon"] = bounds_wgs["minx"].round(6)
    gdf["bbox_min_lat"] = bounds_wgs["miny"].round(6)
    gdf["bbox_max_lon"] = bounds_wgs["maxx"].round(6)
    gdf["bbox_max_lat"] = bounds_wgs["maxy"].round(6)

    return gdf


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Attach mean suitability score
# ─────────────────────────────────────────────────────────────────────────────


def attach_score(gdf, script_dir):
    score_path = os.path.join(script_dir, "suitability_score.tif")
    if not os.path.exists(score_path):
        print("  suitability_score.tif not found — using class/5 as score proxy.")
        gdf["mean_score"] = gdf["suitability_class"] / 5.0
        return gdf

    try:
        from rasterstats import zonal_stats

        stats = zonal_stats(gdf, score_path, stats=["mean", "max"], nodata=-9999)
        gdf["mean_score"] = [round(s["mean"] or 0, 4) for s in stats]
        gdf["max_score"] = [round(s["max"] or 0, 4) for s in stats]
        print("  Mean/max suitability score attached (from suitability_score.tif)")
    except ImportError:
        gdf["mean_score"] = gdf["suitability_class"] / 5.0
        print("  rasterstats not available — using class/5 as score proxy.")

    return gdf


# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Sample all input variables at zone centroids
# ─────────────────────────────────────────────────────────────────────────────


def sample_variable_values(gdf, script_dir, transform, crs):
    """
    For each selected zone, sample the raw value of all 10 input variables
    at the zone centroid. Adds columns: temperature, ghi, dni, gti, pvout,
    slope, landclass, soiltype, dustsoiling, gridaccess.
    """
    print("\n[7] Sampling input variable values at zone centroids...")
    sampled = []

    for var_name, tif_name in VARIABLE_TIFS.items():
        path = os.path.join(script_dir, tif_name)
        col_name = f"val_{var_name}"
        label = VARIABLE_LABELS.get(var_name, var_name)

        if not os.path.exists(path):
            print(f"    {var_name}: {tif_name} not found — skipping")
            continue

        with rasterio.open(path) as src:
            a, b, c, d, e, f_ = (
                src.transform.a,
                src.transform.b,
                src.transform.c,
                src.transform.d,
                src.transform.e,
                src.transform.f,
            )
            det = a * e - b * d
            values = []
            for _, row in gdf.iterrows():
                lon, lat = row["centroid_lon"], row["centroid_lat"]
                rcol = round((e * (lon - c) - b * (lat - f_)) / det)
                rrow = round((a * (lat - f_) - d * (lon - c)) / det)
                if 0 <= rrow < src.height and 0 <= rcol < src.width:
                    val = src.read(1)[rrow, rcol]
                    values.append(round(float(val), 4) if not np.isnan(val) else None)
                else:
                    values.append(None)

        gdf[col_name] = values
        non_null = sum(1 for v in values if v is not None)
        print(f"    {var_name}: {non_null}/{len(values)} zones sampled")

    return gdf


# ─────────────────────────────────────────────────────────────────────────────
# STEP 8: Select zones globally (no per-governorate cap)
# ─────────────────────────────────────────────────────────────────────────────


def select_zones_global(gdf, max_total_km2):
    """
    Keep zones in [MIN_ZONE_AREA_KM2, MAX_ZONE_AREA_KM2].
    Sort globally by mean_score (desc), then area (desc).
    Greedily add largest zones until cumulative >= max_total_km2.
    """
    eligible = gdf[
        (gdf["area_km2"] >= MIN_ZONE_AREA_KM2) & (gdf["area_km2"] <= MAX_ZONE_AREA_KM2)
    ].copy()

    if max_total_km2 is None:
        max_total_km2 = float("inf")

    print(
        f"\n  Eligible zones ({MIN_ZONE_AREA_KM2}–{MAX_ZONE_AREA_KM2} km²): {len(eligible):,}"
    )
    print(
        f"  Global cap: {'unlimited' if max_total_km2 == float('inf') else f'{max_total_km2:.0f} km²'}"
    )

    eligible = eligible.sort_values(
        ["mean_score", "area_km2"], ascending=[False, False]
    ).reset_index(drop=True)

    selected_ids = []
    cumulative = 0.0
    for _, zone in eligible.iterrows():
        if cumulative >= max_total_km2:
            break
        cumulative += zone["area_km2"]
        selected_ids.append(zone["zone_id"])

    selected_mask = gdf["zone_id"].isin(selected_ids)
    selected_gdf = gdf[selected_mask].copy()
    rejected_gdf = gdf[~selected_mask].copy()

    print(
        f"\n  Selected: {len(selected_gdf)} zones | {selected_gdf['area_km2'].sum():.2f} km²"
    )
    return selected_gdf, rejected_gdf


# ─────────────────────────────────────────────────────────────────────────────
# STEP 9: Export results
# ─────────────────────────────────────────────────────────────────────────────


def export_results(selected_gdf, rejected_gdf, gdf_all, script_dir):
    out_dir = script_dir
    gdf_wgs = selected_gdf.to_crs(epsg=4326)

    var_cols = [f"val_{v}" for v in VARIABLE_TIFS]
    present_var_cols = [c for c in var_cols if c in selected_gdf.columns]

    csv_base = [
        "zone_id",
        "governorate",
        "suitability_class",
        "class_label",
        "area_km2",
        "mean_score",
        "centroid_lat",
        "centroid_lon",
        "bbox_min_lat",
        "bbox_min_lon",
        "bbox_max_lat",
        "bbox_max_lon",
    ] + present_var_cols

    csv_path = os.path.join(out_dir, "suitable_zones.csv")
    gdf_wgs[csv_base].to_csv(csv_path, index=False)
    print(f"\n  [SAVED] CSV → {csv_path}")

    geojson_path = os.path.join(out_dir, "suitable_zones.geojson")
    gdf_wgs.to_file(geojson_path, driver="GeoJSON")
    print(f"  [SAVED] GeoJSON → {geojson_path}")

    shp_path = os.path.join(out_dir, "suitable_zones.shp")
    short_cols = {
        "suitability_c": "suitab",
        "class_label": "class_l",
        "centroid_la": "cent_la",
        "centroid_lo": "cent_lo",
        "bbox_min_la": "bbox_min",
        "bbox_min_lo": "bbox_mi_1",
        "bbox_max_la": "bbox_ma",
        "bbox_max_lo": "bbox_ma_1",
    }
    shp_gdf = gdf_wgs.rename(columns=short_cols)
    shp_gdf.to_file(shp_path)
    print(f"  [SAVED] Shapefile → {shp_path}")

    total = selected_gdf["area_km2"].sum()
    print(f"\n  ─── SELECTION SUMMARY ───────────────────────────────────")
    for gov in sorted(selected_gdf["governorate"].unique()):
        sub = selected_gdf[selected_gdf["governorate"] == gov]
        print(f"  {gov:<24} {len(sub):>4} zones | {sub['area_km2'].sum():>8.2f} km²")
    print(f"  {'TOTAL':<24} {len(selected_gdf):>4} zones | {total:>8.2f} km²")
    print("  ──────────────────────────────────────────────────────────")

    print(f"\n  ─── ALL ELIGIBLE ZONES (not in selection) ───────────────")
    print(f"  {'ZoneID':<8} {'Governorate':<24} {'Area':>8} {'Score':>7}  Reason")
    print("  " + "-" * 60)
    for _, r in rejected_gdf.sort_values("area_km2", ascending=False).iterrows():
        reason = "max exceeded" if r["area_km2"] > MAX_ZONE_AREA_KM2 else "below min"
        print(
            f"  {r['zone_id']:<8} {r.get('governorate', '?'):<24} "
            f"{r['area_km2']:>8.4f} {r['mean_score']:>7.4f}  {reason}"
        )
    print("  ──────────────────────────────────────────────────────────")

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
        f"Solar Suitability Zones — Kurdistan\n"
        f"{len(gdf_wgs)} zones | {total:.1f} km² total | "
        f"{MIN_ZONE_AREA_KM2}–{MAX_ZONE_AREA_KM2} km² per zone",
        fontsize=12,
    )
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(True, linestyle="--", alpha=0.3)

    png_path = os.path.join(out_dir, "zone_map.png")
    plt.tight_layout()
    plt.savefig(png_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  [SAVED] Map PNG → {png_path}")


# ─────────────────────────────────────────────────────────────────────────────
# BONUS: Coordinate utilities
# ─────────────────────────────────────────────────────────────────────────────


def latlon_to_utm(lat, lon):
    t = Transformer.from_crs("EPSG:4326", "EPSG:32638", always_xy=True)
    e, n = t.transform(lon, lat)
    return round(e, 2), round(n, 2)


def utm_to_latlon(easting, northing, utm_epsg=32638):
    t = Transformer.from_crs(f"EPSG:{utm_epsg}", "EPSG:4326", always_xy=True)
    lon, lat = t.transform(easting, northing)
    return round(lat, 6), round(lon, 6)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    print("=" * 65)
    print("  Solar Zone Extractor — Kurdistan Region")
    print(f"  Zone range  : {MIN_ZONE_AREA_KM2}–{MAX_ZONE_AREA_KM2} km²")
    max_str = "unlimited (all eligible zones kept)"
    print(f"  Global cap : {max_str}")
    print("=" * 65)

    print("\n[1] Loading classified raster...")
    data, transform, crs, nodata = load_classified_raster(script_dir)

    print("\n[2] Loading governorates...")
    governorates_gdf = load_governorates(script_dir)

    print("\n[3] Computing pixel area...")
    pixel_area_km2 = compute_pixel_area_km2(crs, transform, data.shape)

    print(f"\n[4] Vectorising suitable zones (classes {KEEP_CLASSES})...")
    gdf = raster_to_polygons(data, transform, crs, KEEP_CLASSES)
    if len(gdf) == 0:
        print("  No suitable pixels found.")
        sys.exit(1)

    print("\n[5] Computing area and assigning governorates...")
    gdf = calculate_area_and_governorates(gdf, governorates_gdf, pixel_area_km2)
    if len(gdf) == 0:
        sys.exit(1)

    print("\n[6] Attaching suitability score...")
    gdf = attach_score(gdf, script_dir)

    max_cap = None if MAX_TOTAL_AREA_KM2 == 0 else MAX_TOTAL_AREA_KM2
    print(f"\n[7] Selecting zones (global, no per-governorate cap)...")
    selected_gdf, rejected_gdf = select_zones_global(gdf, max_cap)

    if len(selected_gdf) == 0:
        print("  No zones passed the filter.")
        sys.exit(1)

    print("\n[8] Sampling variable values at centroids...")
    gdf_all = pd.concat([selected_gdf, rejected_gdf], ignore_index=True)
    gdf_all = sample_variable_values(gdf_all, script_dir, transform, crs)
    selected_gdf = gdf_all[gdf_all["zone_id"].isin(selected_gdf["zone_id"])].copy()
    rejected_gdf = gdf_all[~gdf_all["zone_id"].isin(selected_gdf["zone_id"])].copy()

    print("\n[9] Exporting results...")
    export_results(selected_gdf, rejected_gdf, gdf_all, script_dir)

    print("\n[DONE] Zone extraction complete.\n")

    if len(selected_gdf) > 0:
        sample = selected_gdf.sort_values("area_km2", ascending=False).iloc[0]
        lat, lon = sample["centroid_lat"], sample["centroid_lon"]
        e, n = latlon_to_utm(lat, lon)
        print(f"  Largest zone {sample['zone_id']} ({sample['governorate']}):")
        print(f"    WGS84: {lat}, {lon}")
        print(f"    UTM38N: {e}, {n}")
        print(
            f"    Area: {sample['area_km2']} km²  Score: {sample['mean_score']:.4f}\n"
        )


if __name__ == "__main__":
    main()
