"""
Solar Panel Suitability Analysis — Kurdistan Region of Iraq (KRI)
Multi-Criteria Decision Analysis (MCDA) using Weighted Overlay on Binary Raster Layers

USAGE:
    python solar_suitability_analysis.py

REQUIREMENTS:
    pip install rasterio numpy matplotlib geopandas

EXPECTED INPUT FILES (binary TIF — 1 = suitable, 0 = not suitable):
    Place all .tif files in the same folder as this script, named as:
        temperature.tif
        ghi.tif
        dni.tif
        gti.tif
        pvout.tif
        elevation.tif
        slope.tif
        landclass.tif
        soiltype.tif
        dustsoiling.tif
        waterproximity.tif
        gridaccess.tif

OUTPUT:
    suitability_map.tif     — composite raster (0.0–1.0 score)
    suitability_map.png     — rendered map
    suitability_report.csv  — per-pixel score summary (sampled)
"""

import os
import sys
import numpy as np
import rasterio
from rasterio.enums import Resampling

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors

    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    mcolors = None

# ─────────────────────────────────────────────────────────────────────────────
# 1.  VARIABLE DEFINITIONS WITH OPTIMAL VALUES (from Variables.docx)
# ─────────────────────────────────────────────────────────────────────────────

MISSING_VARIABLES = ["waterproximity"]

VARIABLES = {
    "temperature": {
        "label": "Air Temperature",
        "weight": 0.12,
        "notes": "Optimal: Annual avg < 20°C | July max: 35–38°C. Above 45°C = avoid.",
    },
    "ghi": {
        "label": "Global Horizontal Irradiation (GHI)",
        "weight": 0.15,
        "notes": "Optimal: 1,900–2,100 kWh/m²/year",
    },
    "dni": {
        "label": "Direct Normal Irradiation (DNI)",
        "weight": 0.13,
        "notes": "Optimal: 1,850–2,150 kWh/m²/year",
    },
    "gti": {
        "label": "Global Tilted Irradiation (GTI)",
        "weight": 0.10,
        "notes": "Optimal: 2,100–2,200 kWh/m²/year",
    },
    "pvout": {
        "label": "PV Power Output (PVOUT)",
        "weight": 0.10,
        "notes": "Optimal: 1,600–1,740 kWh/kWp/year",
    },
    "elevation": {
        "label": "Elevation",
        "weight": 0.08,
        "notes": "Good: 400–800m | Optimal: 650–1,200m (free cooling benefit)",
    },
    "slope": {
        "label": "Mountain Slope",
        "weight": 0.08,
        "notes": "Optimal: 0°–5° | Moderate: 5°–14° | Max feasible: 20°",
    },
    "landclass": {
        "label": "Land Use / Land Class",
        "weight": 0.09,
        "notes": "Preferred: Barren/Desert > Brownfield/Abandoned > Grassland",
    },
    "soiltype": {
        "label": "Soil Type",
        "weight": 0.06,
        "notes": "Best: Loam (10/10) > Sandy Loam (9/10) > Silt Loam (8/10). Avoid: Clay (1/10)",
    },
    "dustsoiling": {
        "label": "Al-Khamasin & Soiling Ratio",
        "weight": 0.04,
        "notes": "Low dust/soiling frequency preferred. Lower ratio = higher suitability.",
    },
    "waterproximity": {
        "label": "Proximity to Water (for cleaning)",
        "weight": 0.03,
        "notes": "Closer to water source = better (panel cleaning)",
    },
    "gridaccess": {
        "label": "Grid Access",
        "weight": 0.02,
        "notes": "Proximity to existing grid infrastructure preferred",
    },
}

missing_weight = sum(VARIABLES[m]["weight"] for m in MISSING_VARIABLES)
present_weight_total = sum(
    VARIABLES[v]["weight"] for v in VARIABLES if v not in MISSING_VARIABLES
)
for m in MISSING_VARIABLES:
    VARIABLES[m]["weight"] = 0.0
for v in VARIABLES:
    if v not in MISSING_VARIABLES:
        VARIABLES[v]["weight"] = round(VARIABLES[v]["weight"] / present_weight_total, 4)

# Validate weights sum to 1.0
total_weight = sum(v["weight"] for v in VARIABLES.values())
assert abs(total_weight - 1.0) < 1e-6, (
    f"Weights must sum to 1.0 (currently {total_weight:.4f})"
)

# ─────────────────────────────────────────────────────────────────────────────
# 2.  SUITABILITY THRESHOLDS (applied if using continuous TIF, not binary)
#     These define what value range in the raw TIF = "suitable" (score = 1)
# ─────────────────────────────────────────────────────────────────────────────

SUITABILITY_THRESHOLDS = {
    # variable_name: (optimal_min, optimal_max, hard_min, hard_max)
    # Values WITHIN [optimal_min, optimal_max] get score 1.0
    # Values between hard_min/hard_max and optimal range get partial score
    # Values outside hard range get score 0.0
    "temperature": (20, 38, 0, 45),  # °C annual avg
    "ghi": (1900, 2100, 1500, 2400),  # kWh/m²/yr
    "dni": (1850, 2150, 1400, 2400),
    "gti": (2100, 2200, 1600, 2500),
    "pvout": (1600, 1740, 1200, 2000),
    "elevation": (650, 1200, 400, 1800),  # meters
    "slope": (0, 5, 0, 20),  # degrees
    "landclass": (1, 3, 1, 5),  # class codes (see notes)
    "soiltype": (
        7,
        10,
        4,
        9,
    ),  # score 1–10; hard_max=9 since data max is 9 (score 10 not present)
    "dustsoiling": (
        0.0,
        0.5,
        0.0,
        5.0,
    ),  # AOD (lower = better); hard_max=5 matches real dust AOD range
    "gridaccess": (0, 10000, 0, 50000),  # metres to nearest grid line
}


# ─────────────────────────────────────────────────────────────────────────────
# 3.  HELPER: Score a continuous raster band using fuzzy linear membership
# ─────────────────────────────────────────────────────────────────────────────


def fuzzy_linear_score(array, opt_min, opt_max, hard_min, hard_max, invert=False):
    """
    Converts a continuous raster array into a 0–1 suitability score.
    - Values in [opt_min, opt_max]  → 1.0
    - Values between hard and opt   → linear interpolation
    - Values outside [hard_min, hard_max] → 0.0
    - invert=True: lower values are better (e.g. slope, dust, proximity)
    """
    score = np.zeros_like(array, dtype=np.float32)

    if invert:
        # Lower is better — flip the logic
        score = fuzzy_linear_score(-array, -opt_max, -opt_min, -hard_max, -hard_min)
        return score

    # Optimal zone
    optimal_mask = (array >= opt_min) & (array <= opt_max)
    score[optimal_mask] = 1.0

    # Rising edge (below optimal)
    if hard_min < opt_min:
        rising = (array >= hard_min) & (array < opt_min)
        score[rising] = (array[rising] - hard_min) / (opt_min - hard_min)

    # Falling edge (above optimal)
    if opt_max < hard_max:
        falling = (array > opt_max) & (array <= hard_max)
        score[falling] = 1.0 - (array[falling] - opt_max) / (hard_max - opt_max)

    return score


# ─────────────────────────────────────────────────────────────────────────────
# 4.  LOAD RASTER LAYERS
# ─────────────────────────────────────────────────────────────────────────────


def load_and_align_rasters(script_dir):
    """
    Loads all TIF files and resamples them to match the reference (first loaded) raster.
    Supports both binary TIFs (0/1) and continuous value TIFs.
    Returns dict of {variable_name: numpy_array} and the reference profile.
    """
    layers = {}
    reference_profile = None
    reference_shape = None

    for var_name in VARIABLES.keys():
        filepath = os.path.join(script_dir, f"{var_name}.tif")

        if not os.path.exists(filepath):
            if var_name in MISSING_VARIABLES:
                print(
                    f"  [SKIP ] {var_name}.tif — no data available (weight redistributed)"
                )
            else:
                print(f"  [WARNING] Missing: {filepath} — skipping this layer.")
            continue

        with rasterio.open(filepath) as src:
            if reference_profile is None:
                reference_profile = src.profile.copy()
                reference_shape = (src.height, src.width)
                data = src.read(1).astype(np.float32)
            else:
                # Resample to reference grid if needed
                data = src.read(
                    1, out_shape=reference_shape, resampling=Resampling.bilinear
                ).astype(np.float32)

            # Replace nodata with 0
            nodata = src.nodata
            if nodata is not None:
                data[data == nodata] = 0.0

        layers[var_name] = data
        print(
            f"  [OK] Loaded {var_name}.tif  shape={data.shape}  min={data.min():.2f}  max={data.max():.2f}"
        )

    return layers, reference_profile


# ─────────────────────────────────────────────────────────────────────────────
# 5.  SCORE EACH LAYER
# ─────────────────────────────────────────────────────────────────────────────


def score_layers(layers):
    """
    For each layer, determine if it's binary (0/1) or continuous.
    Binary layers are used directly. Continuous layers are scored via fuzzy membership.
    """
    scored = {}
    for var_name, array in layers.items():
        if var_name in MISSING_VARIABLES:
            continue
        unique_vals = np.unique(array[array > -9999])

        # Binary detection: only 0 and 1 present
        is_binary = set(unique_vals.tolist()).issubset({0.0, 1.0, 0, 1})

        if is_binary:
            scored[var_name] = array.clip(0, 1)
            print(f"  [BINARY] {var_name} — used directly as 0/1 mask")
        else:
            # Continuous raster — apply fuzzy scoring
            thresholds = SUITABILITY_THRESHOLDS.get(var_name)
            if thresholds is None:
                print(f"  [SKIP] No thresholds defined for {var_name}")
                continue
            opt_min, opt_max, hard_min, hard_max = thresholds
            # Proximity variables: lower = better
            invert = var_name in ("dustsoiling", "gridaccess")
            scored[var_name] = fuzzy_linear_score(
                array, opt_min, opt_max, hard_min, hard_max, invert=invert
            )
            print(f"  [SCORED] {var_name} — fuzzy linear scoring applied")

    return scored


# ─────────────────────────────────────────────────────────────────────────────
# 6.  WEIGHTED OVERLAY
# ─────────────────────────────────────────────────────────────────────────────


def weighted_overlay(scored_layers):
    """
    Combines scored layers into a single composite suitability index (0–1).
    Adjusts weights proportionally if some layers are missing.
    """
    present_vars = list(scored_layers.keys())
    total_w = sum(VARIABLES[v]["weight"] for v in present_vars if v in VARIABLES)

    # Reference shape from the first layer
    ref_shape = next(iter(scored_layers.values())).shape
    composite = np.zeros(ref_shape, dtype=np.float32)

    exclusion_mask = np.ones(ref_shape, dtype=np.float32)

    if "slope" in scored_layers:
        exclusion_mask[scored_layers["slope"] == 0.0] = 0.0
    if "temperature" in scored_layers:
        exclusion_mask[scored_layers["temperature"] == 0.0] = 0.0
    if "soiltype" in scored_layers:
        exclusion_mask[scored_layers["soiltype"] == 0.0] = 0.0
    if "landclass" in scored_layers:
        exclusion_mask[scored_layers["landclass"] == 0.0] = 0.0

    print("\n  Weighted Overlay:")
    for var_name, score_array in scored_layers.items():
        if var_name not in VARIABLES:
            continue
        adjusted_weight = VARIABLES[var_name]["weight"] / total_w
        composite += score_array * adjusted_weight
        print(
            f"    {var_name:20s}  weight={adjusted_weight:.4f}  contribution range: "
            f"{(score_array * adjusted_weight).min():.3f}–{(score_array * adjusted_weight).max():.3f}"
        )

    composite *= exclusion_mask

    return composite


# ─────────────────────────────────────────────────────────────────────────────
# 7.  SUITABILITY CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────


def classify_suitability(composite):
    """Classifies composite score into 5 categories."""
    classified = np.zeros_like(composite, dtype=np.uint8)
    classified[(composite >= 0.80)] = 5  # Highly Suitable
    classified[(composite >= 0.65) & (composite < 0.80)] = 4  # Suitable
    classified[(composite >= 0.50) & (composite < 0.65)] = 3  # Moderately Suitable
    classified[(composite >= 0.35) & (composite < 0.50)] = 2  # Marginally Suitable
    classified[(composite < 0.35)] = 1  # Not Suitable
    return classified


# ─────────────────────────────────────────────────────────────────────────────
# 8.  EXPORT RESULTS
# ─────────────────────────────────────────────────────────────────────────────


def export_results(composite, classified, profile, output_dir):
    """Exports composite score TIF, classified TIF, and PNG visualization."""

    # --- Export composite score raster ---
    score_path = os.path.join(output_dir, "suitability_score.tif")
    score_profile = profile.copy()
    score_profile.update(dtype=rasterio.float32, count=1, compress="lzw", nodata=-9999)
    with rasterio.open(score_path, "w", **score_profile) as dst:
        dst.write(composite, 1)
    print(f"\n  [SAVED] Composite score → {score_path}")

    # --- Export classified raster ---
    class_path = os.path.join(output_dir, "suitability_classified.tif")
    class_profile = profile.copy()
    class_profile.update(dtype=rasterio.uint8, count=1, compress="lzw", nodata=0)
    with rasterio.open(class_path, "w", **class_profile) as dst:
        dst.write(classified, 1)
    print(f"  [SAVED] Classified map → {class_path}")

    # --- Export PNG visualization ---
    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(16, 7))
        fig.suptitle(
            "Solar Panel Suitability Analysis — Kurdistan Region, Iraq",
            fontsize=14,
            fontweight="bold",
            y=1.01,
        )
        im1 = axes[0].imshow(composite, cmap="RdYlGn", vmin=0, vmax=1)
        axes[0].set_title("Composite Suitability Score (0–1)", fontsize=11)
        axes[0].axis("off")
        plt.colorbar(
            im1, ax=axes[0], fraction=0.046, pad=0.04, label="Suitability Score"
        )
        cmap = mcolors.ListedColormap(
            ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"]
        )
        bounds = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
        norm = mcolors.BoundaryNorm(bounds, cmap.N)
        im2 = axes[1].imshow(classified, cmap=cmap, norm=norm)
        axes[1].set_title("Suitability Classification", fontsize=11)
        axes[1].axis("off")
        cbar2 = plt.colorbar(
            im2, ax=axes[1], fraction=0.046, pad=0.04, ticks=[1, 2, 3, 4, 5]
        )
        cbar2.ax.set_yticklabels(
            ["Not Suitable", "Marginal", "Moderate", "Suitable", "Highly Suitable"]
        )
        plt.tight_layout()
        png_path = os.path.join(output_dir, "suitability_map.png")
        plt.savefig(png_path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"  [SAVED] Map visualization → {png_path}")
    else:
        print("  [SKIP] matplotlib not installed — PNG map not generated")

    # --- Summary statistics ---
    total_pixels = composite.size
    categories = {
        "Highly Suitable (≥0.80)": np.sum(classified == 5),
        "Suitable (0.65–0.80)": np.sum(classified == 4),
        "Moderate (0.50–0.65)": np.sum(classified == 3),
        "Marginal (0.35–0.50)": np.sum(classified == 2),
        "Not Suitable (<0.35)": np.sum(classified == 1),
    }
    print("\n  ─── SUITABILITY SUMMARY ───────────────────────────────")
    for label, count in categories.items():
        pct = 100.0 * count / total_pixels
        print(f"  {label:<35s}: {count:>8,d} px  ({pct:5.1f}%)")
    print(f"  {'Mean Score':<35s}: {composite.mean():.4f}")
    print(f"  {'Max Score':<35s}: {composite.max():.4f}")
    print(f"  {'Min Score':<35s}: {composite.min():.4f}")
    print("  ────────────────────────────────────────────────────────")


# ─────────────────────────────────────────────────────────────────────────────
# 9.  MAIN
# ─────────────────────────────────────────────────────────────────────────────


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = script_dir

    print("=" * 60)
    print("  Solar Panel Suitability Analysis — Kurdistan Region")
    print("=" * 60)

    print("\n[1] Loading raster layers...")
    layers, profile = load_and_align_rasters(script_dir)

    if not layers:
        print(
            "\n  ERROR: No TIF files found. Place .tif files in the same directory as this script."
        )
        sys.exit(1)

    print(f"\n  Loaded {len(layers)}/{len(VARIABLES)} layers.\n")

    print("[2] Scoring layers...")
    scored = score_layers(layers)

    print("\n[3] Running weighted overlay...")
    composite = weighted_overlay(scored)

    print("\n[4] Classifying suitability...")
    classified = classify_suitability(composite)

    print("\n[5] Exporting results...")
    export_results(composite, classified, profile, output_dir)

    print("\n[DONE] Analysis complete.\n")


if __name__ == "__main__":
    main()
