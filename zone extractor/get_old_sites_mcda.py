import json
import rasterio
import os
import numpy as np
from pyproj import Transformer

mountainCities = [
  {"name": "Degala", "coordinates": [44.498525, 36.121055], "area_km2": 76.38},
  {"name": "Zirguz", "coordinates": [44.110194, 36.533453], "area_km2": 162.33},
  {"name": "Daratu", "coordinates": [43.873083, 36.594092], "area_km2": 162.44},
  {"name": "Bekhme", "coordinates": [44.172406, 36.717706], "area_km2": 45.06},
  {"name": "Atrush", "coordinates": [43.505339, 36.848319], "area_km2": 30.46},
  {"name": "Ashkafta", "coordinates": [43.558394, 36.900661], "area_km2": 36.76},
  {"name": "Gare", "coordinates": [43.461294, 36.964583], "area_km2": 57.03},
  {"name": "Mizuri Jeri", "coordinates": [43.198031, 36.864325], "area_km2": 71.03},
  {"name": "Gare 2", "coordinates": [43.742822, 36.970889], "area_km2": 39.28},
  {"name": "Dedawan", "coordinates": [44.278842, 35.965478], "area_km2": 180.9},
  {"name": "Sulaymaniyah Suburbs", "coordinates": [45.710128, 35.431708], "area_km2": 53.49},
  {"name": "Darbandikhan", "coordinates": [45.533603, 35.088264], "area_km2": 96.14},
  {"name": "Kalar", "coordinates": [45.642083, 34.848997], "area_km2": 60.12},
  {"name": "Puka", "coordinates": [45.26065, 34.791131], "area_km2": 24.64},
  {"name": "Kalar 2", "coordinates": [45.180361, 34.763967], "area_km2": 36.56},
  {"name": "Pesh Xabur", "coordinates": [42.535139, 37.088969], "area_km2": 11.21}
]

tif_files = {
    "val_ghi": "ghi.tif",
    "val_dni": "dni.tif",
    "val_gti": "gti.tif",
    "val_pvout": "pvout.tif",
    "val_slope": "slope.tif",
    "val_temperature": "temperature.tif",
    "val_dustsoiling": "dustsoiling.tif",
    "val_gridaccess": "gridaccess.tif",
    "score_100": "mcda_suitability_score.tif",
    "val_elevation": "elevation.tif",
    "val_landclass": "landclass.tif",
    "val_soiltype": "soiltype.tif"
}

def sample_tif(tif_path, coords_4326):
    if not os.path.exists(tif_path):
        print(f"Warning: {tif_path} not found")
        return [None] * len(coords_4326)
    with rasterio.open(tif_path) as src:
        # Check CRS and transform if necessary to avoid silent wrong values
        crs = src.crs
        coords_transformed = coords_4326
        if crs and crs.to_epsg() != 4326:
            transformer = Transformer.from_crs("epsg:4326", crs, always_xy=True)
            coords_transformed = [transformer.transform(x, y) for x, y in coords_4326]

        nodata = src.nodata
        pts = list(src.sample(coords_transformed))
        
        res = []
        for p in pts:
            val = p[0]
            # Precise nodata handling (never default to 0.0)
            if nodata is not None and val == nodata:
                res.append(None)
            elif np.isnan(val) or val <= -9000:
                res.append(None)
            else:
                res.append(float(val))
        return res

coords_4326 = [(c["coordinates"][0], c["coordinates"][1]) for c in mountainCities]

features = []
for i, city in enumerate(mountainCities):
    features.append({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": city["coordinates"]
        },
        "properties": {
            "zone_id": city["name"],
            "area_km2": city["area_km2"],
            "centroid_lon": city["coordinates"][0],
            "centroid_lat": city["coordinates"][1],
            "governorate": "Legacy Selected",
            "is_legacy": True
        }
    })

for key, fname in tif_files.items():
    vals = sample_tif(fname, coords_4326)
    for i, val in enumerate(vals):
        features[i]["properties"][key] = val

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "legacy_sites.geojson")
geojson = {
    "type": "FeatureCollection",
    "features": features
}

with open(out_path, "w") as f:
    json.dump(geojson, f, indent=2)

print(f"Saved {out_path}")
