import React, { useRef, useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import Map, {
  Marker,
  NavigationControl,
  MapRef,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowRight,
  MapPin,
  Sun,
  Layers,
  Database,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  List,
  X,
  Crosshair,
  Zap,
  Mountain,
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import * as GeoTIFF from "geotiff";
import { loadForecastData, getForecastDelta, FORECAST_YEARS, MONTH_MAP, MONTHLY_TEMP_RANGE } from "../lib/forecastData";


function parseBinaryFile(arrayBuffer: ArrayBuffer): {
  meta: any;
  data: Float32Array;
} {
  const dv = new DataView(arrayBuffer);
  const metaLen = dv.getUint32(0, true);
  if (metaLen > arrayBuffer.byteLength - 4) {
    throw new Error(
      `Invalid binary file: metaLen (${metaLen}) exceeds buffer size`,
    );
  }
  const metaJson = new TextDecoder().decode(
    new Uint8Array(arrayBuffer, 4, metaLen),
  );
  const meta = JSON.parse(metaJson);
  const dataOffset = 4 + metaLen;
  const alignedOffset = Math.ceil(dataOffset / 4) * 4;
  const expectedBytes = meta.width * meta.height * 4;
  if (alignedOffset + expectedBytes > arrayBuffer.byteLength) {
    throw new Error(
      `Invalid binary file: data region exceeds buffer size (need ${alignedOffset + expectedBytes}, have ${arrayBuffer.byteLength})`,
    );
  }
  const data = new Float32Array(arrayBuffer, alignedOffset, meta.width * meta.height);
  return { meta, data };
}

export interface ZoneSite {
  name: string;
  coordinates: [number, number];
  desc: string;
  properties?: any;
}
type LayerType =
  | "GHI"
  | "DNI"
  | "DIF"
  | "GTI"
  | "OPTA"
  | "PVOUT_YEARLY"
  | "ELEVATION"
  | "TEMPERATURE"
  | "PVOUT_JAN"
  | "PVOUT_FEB"
  | "PVOUT_MAR"
  | "PVOUT_APR"
  | "PVOUT_MAY"
  | "PVOUT_JUN"
  | "PVOUT_JUL"
  | "PVOUT_AUG"
  | "PVOUT_SEP"
  | "PVOUT_OCT"
  | "PVOUT_NOV"
  | "PVOUT_DEC"
  | "CHIRPS_2018"
  | "CHIRPS_2019"
  | "CHIRPS_2020"
  | "CHIRPS_2021"
  | "CHIRPS_2022"
  | "CHIRPS_2023"
  | "CHIRPS_2024"
  | "CHIRPS_2025_JAN"
  | "CHIRPS_2025_FEB"
  | "CHIRPS_2025_MAR"
  | "CHIRPS_2025_APR"
  | "CHIRPS_2025_MAY"
  | "CHIRPS_2025_JUN"
  | "CHIRPS_2025_JUL"
  | "CHIRPS_2025_AUG"
  | "CHIRPS_2025_SEP"
  | "CHIRPS_2025_OCT"
  | "CHIRPS_2025_NOV"
  | "CHIRPS_2025_DEC"
  | "CHIRPS_2026_JAN"
  | "CHIRPS_2026_FEB"
  | "LANDCOVER"
  | "SOIL"
  | "SLOPE"
  | "TEMP_YEARLY"
  | "TEMP_ABS_2025_JAN"
  | "TEMP_ABS_2025_FEB"
  | "TEMP_ABS_2025_MAR"
  | "TEMP_ABS_2025_APR"
  | "TEMP_ABS_2025_MAY"
  | "TEMP_ABS_2025_JUN"
  | "TEMP_ABS_2025_JUL"
  | "TEMP_ABS_2025_AUG"
  | "TEMP_ABS_2025_SEP"
  | "TEMP_ABS_2025_OCT"
  | "TEMP_ABS_2025_NOV"
  | "TEMP_ABS_2025_DEC"
  | "TEMP_ABS_2026_JAN"
  | "TEMP_ABS_2026_FEB"
  | "TEMP_ABS_2026_MAR"
  | "TEMP_ABS_2026_APR"
  | "TEMP_ABS_2026_MAY"
  | "TEMP_ABS_2026_JUN"
  | "TEMP_ABS_2026_JUL"
  | "TEMP_ABS_2026_AUG"
  | "TEMP_ABS_2026_SEP"
  | "TEMP_ABS_2026_OCT"
  | "TEMP_ABS_2026_NOV"
  | "TEMP_ABS_2026_DEC"
  | `TEMP_ABS_${number}_${string}`
  | "DUST_2020_01"
  | "DUST_2020_02"
  | "DUST_2020_03"
  | "DUST_2020_04"
  | "DUST_2020_05"
  | "DUST_2020_06"
  | "DUST_2020_07"
  | "DUST_2020_08"
  | "DUST_2020_09"
  | "DUST_2020_10"
  | "DUST_2020_11"
  | "DUST_2020_12"
  | "DUST_2021_01"
  | "DUST_2021_02"
  | "DUST_2021_03"
  | "DUST_2021_04"
  | "DUST_2021_05"
  | "DUST_2021_06"
  | "DUST_2021_07"
  | "DUST_2021_08"
  | "DUST_2021_09"
  | "DUST_2021_10"
  | "DUST_2021_11"
  | "DUST_2021_12"
  | "DUST_2022_01"
  | "DUST_2022_02"
  | "DUST_2022_03"
  | "DUST_2022_04"
  | "DUST_2022_05"
  | "DUST_2022_06"
  | "DUST_2022_07"
  | "DUST_2022_08"
  | "DUST_2022_09"
  | "DUST_2022_10"
  | "DUST_2022_11"
  | "DUST_2022_12"
  | "DUST_2023_01"
  | "DUST_2023_02"
  | "DUST_2023_03"
  | "DUST_2023_04"
  | "DUST_2023_05"
  | "DUST_2023_06"
  | "DUST_2023_07"
  | "DUST_2023_08"
  | "DUST_2023_09"
  | "DUST_2023_10"
  | "DUST_2023_11"
  | "DUST_2023_12"
  | "DUST_2024_01"
  | "DUST_2024_02"
  | "DUST_2024_03"
  | "DUST_2024_04"
  | "DUST_2024_05"
  | "DUST_2024_06"
  | "DUST_2024_07"
  | "DUST_2024_08"
  | "DUST_2024_09"
  | "DUST_2024_10"
  | "DUST_2024_11"
  | "DUST_2024_12"
  | "DUST_2025_01"
  | "DUST_2025_02"
  | "DUST_2025_03"
  | "DUST_2025_04"
  | "DUST_2025_05"
  | "DUST_2025_06"
  | "DUST_2025_07"
  | "DUST_2025_08"
  | "DUST_2025_09"
  | "DUST_2025_10"
  | "DUST_2025_11"
  | "DUST_2025_12"
  | "CLOUD_YEARLY"
  | "CLOUD_2020_01"
  | "CLOUD_2020_02"
  | "CLOUD_2020_03"
  | "CLOUD_2020_04"
  | "CLOUD_2020_05"
  | "CLOUD_2020_06"
  | "CLOUD_2020_07"
  | "CLOUD_2020_08"
  | "CLOUD_2020_09"
  | "CLOUD_2020_10"
  | "CLOUD_2020_11"
  | "CLOUD_2020_12"
  | "CLOUD_2021_01"
  | "CLOUD_2021_02"
  | "CLOUD_2021_03"
  | "CLOUD_2021_04"
  | "CLOUD_2021_05"
  | "CLOUD_2021_06"
  | "CLOUD_2021_07"
  | "CLOUD_2021_08"
  | "CLOUD_2021_09"
  | "CLOUD_2021_10"
  | "CLOUD_2021_11"
  | "CLOUD_2021_12"
  | "CLOUD_2022_01"
  | "CLOUD_2022_02"
  | "CLOUD_2022_03"
  | "CLOUD_2022_04"
  | "CLOUD_2022_05"
  | "CLOUD_2022_06"
  | "CLOUD_2022_07"
  | "CLOUD_2022_08"
  | "CLOUD_2022_09"
  | "CLOUD_2022_10"
  | "CLOUD_2022_11"
  | "CLOUD_2022_12"
  | "CLOUD_2023_01"
  | "CLOUD_2023_02"
  | "CLOUD_2023_03"
  | "CLOUD_2023_04"
  | "CLOUD_2023_05"
  | "CLOUD_2023_06"
  | "CLOUD_2023_07"
  | "CLOUD_2023_08"
  | "CLOUD_2023_09"
  | "CLOUD_2023_10"
  | "CLOUD_2023_11"
  | "CLOUD_2023_12"
  | "CLOUD_2024_01"
  | "CLOUD_2024_02"
  | "CLOUD_2024_03"
  | "CLOUD_2024_04"
  | "CLOUD_2024_05"
  | "CLOUD_2024_06"
  | "CLOUD_2024_07"
  | "CLOUD_2024_08"
  | "CLOUD_2024_09"
  | "CLOUD_2024_10"
  | "CLOUD_2024_11"
  | "CLOUD_2024_12"
  | "CLOUD_2025_01"
  | "CLOUD_2025_02"
  | "CLOUD_2025_03"
  | "CLOUD_2025_04"
  | "CLOUD_2025_05"
  | "CLOUD_2025_06"
  | "CLOUD_2025_07"
  | "CLOUD_2025_08"
  | "CLOUD_2025_09"
  | "CLOUD_2025_10"
  | "CLOUD_2025_11"
  | "CLOUD_2025_12"
  | "CLOUD_2026_01"
  | "CLOUD_2026_02"
  | "CLOUD_2026_03"
  | "CLOUD_2026_04"
  | "NIGHT_LIGHTS"
  | "ELECTRIC_GRID"
  | "POPULATION";

const monthlyColors = [
  "rgba(255, 255, 150, 0.2)",
  "rgba(255, 220, 100, 0.4)",
  "rgba(255, 180, 50, 0.6)",
  "rgba(255, 140, 0, 0.8)",
  "rgba(255, 80, 0, 0.95)",
];

const startupLayers: LayerType[] = ["PVOUT_YEARLY"];

const CORE_PANEL_LAYERS: LayerType[] = [
  "PVOUT_YEARLY",
  "GHI",
  "DNI",
  "GTI",
  "DIF",
  "OPTA",
  "ELEVATION",
  "SLOPE",
  "POPULATION",
];

const PRECIPITATION_PANEL_LAYERS: LayerType[] = [
  "CHIRPS_2018",
  "CHIRPS_2019",
  "CHIRPS_2020",
  "CHIRPS_2021",
  "CHIRPS_2022",
  "CHIRPS_2023",
  "CHIRPS_2024",
  "CHIRPS_2025_JAN",
  "CHIRPS_2025_FEB",
  "CHIRPS_2025_MAR",
  "CHIRPS_2025_APR",
  "CHIRPS_2025_MAY",
  "CHIRPS_2025_JUN",
  "CHIRPS_2025_JUL",
  "CHIRPS_2025_AUG",
  "CHIRPS_2025_SEP",
  "CHIRPS_2025_OCT",
  "CHIRPS_2025_NOV",
  "CHIRPS_2025_DEC",
];

const TEMPERATURE_PANEL_LAYERS: LayerType[] = [
  "TEMP_ABS_2018_JAN",
  "TEMP_ABS_2018_FEB",
  "TEMP_ABS_2018_MAR",
  "TEMP_ABS_2018_APR",
  "TEMP_ABS_2018_MAY",
  "TEMP_ABS_2018_JUN",
  "TEMP_ABS_2018_JUL",
  "TEMP_ABS_2018_AUG",
  "TEMP_ABS_2018_SEP",
  "TEMP_ABS_2018_OCT",
  "TEMP_ABS_2018_NOV",
  "TEMP_ABS_2018_DEC",
  "TEMP_ABS_2019_JAN",
  "TEMP_ABS_2019_FEB",
  "TEMP_ABS_2019_MAR",
  "TEMP_ABS_2019_APR",
  "TEMP_ABS_2019_MAY",
  "TEMP_ABS_2019_JUN",
  "TEMP_ABS_2019_JUL",
  "TEMP_ABS_2019_AUG",
  "TEMP_ABS_2019_SEP",
  "TEMP_ABS_2019_OCT",
  "TEMP_ABS_2019_NOV",
  "TEMP_ABS_2019_DEC",
  "TEMP_ABS_2020_JAN",
  "TEMP_ABS_2020_FEB",
  "TEMP_ABS_2020_MAR",
  "TEMP_ABS_2020_APR",
  "TEMP_ABS_2020_MAY",
  "TEMP_ABS_2020_JUN",
  "TEMP_ABS_2020_JUL",
  "TEMP_ABS_2020_AUG",
  "TEMP_ABS_2020_SEP",
  "TEMP_ABS_2020_OCT",
  "TEMP_ABS_2020_NOV",
  "TEMP_ABS_2020_DEC",
  "TEMP_ABS_2021_JAN",
  "TEMP_ABS_2021_FEB",
  "TEMP_ABS_2021_MAR",
  "TEMP_ABS_2021_APR",
  "TEMP_ABS_2021_MAY",
  "TEMP_ABS_2021_JUN",
  "TEMP_ABS_2021_JUL",
  "TEMP_ABS_2021_AUG",
  "TEMP_ABS_2021_SEP",
  "TEMP_ABS_2021_OCT",
  "TEMP_ABS_2021_NOV",
  "TEMP_ABS_2021_DEC",
  "TEMP_ABS_2022_JAN",
  "TEMP_ABS_2022_FEB",
  "TEMP_ABS_2022_MAR",
  "TEMP_ABS_2022_APR",
  "TEMP_ABS_2022_MAY",
  "TEMP_ABS_2022_JUN",
  "TEMP_ABS_2022_JUL",
  "TEMP_ABS_2022_AUG",
  "TEMP_ABS_2022_SEP",
  "TEMP_ABS_2022_OCT",
  "TEMP_ABS_2022_NOV",
  "TEMP_ABS_2022_DEC",
  "TEMP_ABS_2023_JAN",
  "TEMP_ABS_2023_FEB",
  "TEMP_ABS_2023_MAR",
  "TEMP_ABS_2023_APR",
  "TEMP_ABS_2023_MAY",
  "TEMP_ABS_2023_JUN",
  "TEMP_ABS_2023_JUL",
  "TEMP_ABS_2023_AUG",
  "TEMP_ABS_2023_SEP",
  "TEMP_ABS_2023_OCT",
  "TEMP_ABS_2023_NOV",
  "TEMP_ABS_2023_DEC",
  "TEMP_ABS_2024_JAN",
  "TEMP_ABS_2024_FEB",
  "TEMP_ABS_2024_MAR",
  "TEMP_ABS_2024_APR",
  "TEMP_ABS_2024_MAY",
  "TEMP_ABS_2024_JUN",
  "TEMP_ABS_2024_JUL",
  "TEMP_ABS_2024_AUG",
  "TEMP_ABS_2024_SEP",
  "TEMP_ABS_2024_OCT",
  "TEMP_ABS_2024_NOV",
  "TEMP_ABS_2024_DEC",
  "TEMP_ABS_2025_JAN",
  "TEMP_ABS_2025_FEB",
  "TEMP_ABS_2025_MAR",
  "TEMP_ABS_2025_APR",
  "TEMP_ABS_2025_MAY",
  "TEMP_ABS_2025_JUN",
  "TEMP_ABS_2025_JUL",
  "TEMP_ABS_2025_AUG",
  "TEMP_ABS_2025_SEP",
  "TEMP_ABS_2025_OCT",
  "TEMP_ABS_2025_NOV",
  "TEMP_ABS_2025_DEC",
  "TEMP_ABS_2026_JAN",
  "TEMP_ABS_2026_FEB",
];

const BASE_PATH = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

interface LayerConfig {
  name: string;
  shortName: string;
  min: number;
  max: number;
  unit: string;
  colors: string[];
  file: string;
  wmsUrl?: string;
}

const layerConfigs: Record<LayerType, LayerConfig> = {
  GHI: {
    name: "Global Horizontal Irradiation (GHI)",
    shortName: "GHI",
    min: 1600,
    max: 2200,
    unit: "kWh/m²/year",
    colors: [
      "rgba(255, 255, 150, 0.2)",
      "rgba(255, 220, 100, 0.4)",
      "rgba(255, 180, 50, 0.6)",
      "rgba(255, 140, 0, 0.8)",
      "rgba(255, 80, 0, 0.95)",
    ],
    file: `${BASE_PATH}/GHI.bin`,
  },
  DNI: {
    name: "Direct Normal Irradiation (DNI)",
    shortName: "DNI",
    min: 1400,
    max: 2400,
    unit: "kWh/m²/year",
    colors: [
      "rgba(255, 255, 150, 0.2)",
      "rgba(255, 220, 100, 0.4)",
      "rgba(255, 180, 50, 0.6)",
      "rgba(255, 140, 0, 0.8)",
      "rgba(255, 80, 0, 0.95)",
    ],
    file: `${BASE_PATH}/DNI.bin`,
  },
  DIF: {
    name: "Diffuse Horizontal Irradiation (DIF)",
    shortName: "DIF",
    min: 600,
    max: 900,
    unit: "kWh/m²/year",
    colors: [
      "rgba(255, 255, 150, 0.2)",
      "rgba(255, 220, 100, 0.4)",
      "rgba(255, 180, 50, 0.6)",
      "rgba(255, 140, 0, 0.8)",
      "rgba(255, 80, 0, 0.95)",
    ],
    file: `${BASE_PATH}/DIF.bin`,
  },
  GTI: {
    name: "Global Tilted Irradiation (GTI)",
    shortName: "GTI",
    min: 1800,
    max: 2400,
    unit: "kWh/m²/year",
    colors: [
      "rgba(255, 255, 150, 0.2)",
      "rgba(255, 220, 100, 0.4)",
      "rgba(255, 180, 50, 0.6)",
      "rgba(255, 140, 0, 0.8)",
      "rgba(255, 80, 0, 0.95)",
    ],
    file: `${BASE_PATH}/GTI.bin`,
  },
  OPTA: {
    name: "Optimum Tilt of PV Modules (OPTA)",
    shortName: "OPTA",
    min: 0,
    max: 50,
    unit: "°",
    colors: [
      "rgba(200, 200, 255, 0.2)",
      "rgba(150, 150, 255, 0.4)",
      "rgba(100, 100, 255, 0.6)",
      "rgba(50, 50, 255, 0.8)",
      "rgba(0, 0, 255, 0.95)",
    ],
    file: `${BASE_PATH}/OPTA.bin`,
  },
  PVOUT_YEARLY: {
    name: "Specific Photovoltaic Power Output (PVOUT)",
    shortName: "PVOUT",
    min: 1400,
    max: 1800,
    unit: "kWh/kWp/year",
    colors: [
      "rgba(255, 255, 150, 0.2)",
      "rgba(255, 220, 100, 0.4)",
      "rgba(255, 180, 50, 0.6)",
      "rgba(255, 140, 0, 0.8)",
      "rgba(255, 80, 0, 0.95)",
    ],
    file: `${BASE_PATH}/Iraq_PVOUT_Yearly_EPSG4326.bin`,
  },
  ELEVATION: {
    name: "Elevation",
    shortName: "Elevation",
    min: 0,
    max: 3000,
    unit: "m",
    colors: [
      "rgba(160, 210, 160, 0.2)",
      "rgba(200, 200, 150, 0.4)",
      "rgba(220, 180, 120, 0.6)",
      "rgba(180, 120, 80, 0.8)",
      "rgba(240, 240, 240, 0.95)",
    ],
    file: `${BASE_PATH}/GSA_Iraq_Environmental.bin`,
  },
  TEMPERATURE: {
    name: "Air Temperature",
    shortName: "TEMP",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.2)",
      "rgba(100, 100, 255, 0.4)",
      "rgba(200, 200, 200, 0.6)",
      "rgba(255, 100, 100, 0.8)",
      "rgba(255, 0, 0, 0.95)",
    ],
    file: `${BASE_PATH}/TEMP.bin`,
  },
  SLOPE: {
    name: "Mountain Slope",
    shortName: "SLOPE",
    min: 0,
    max: 70,
    unit: "°",
    colors: [
      "rgba(210, 180, 140, 0.7)",
      "rgba(205, 133, 63, 0.75)",
      "rgba(188, 85, 45, 0.8)",
      "rgba(178, 34, 34, 0.85)",
      "rgba(139, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/slope/Iraq_Slope_100m_EPSG4326.bin`,
  },
  PVOUT_JAN: {
    name: "PVOUT - January",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_01.bin`,
  },
  PVOUT_FEB: {
    name: "PVOUT - February",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_02.bin`,
  },
  PVOUT_MAR: {
    name: "PVOUT - March",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_03.bin`,
  },
  PVOUT_APR: {
    name: "PVOUT - April",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_04.bin`,
  },
  PVOUT_MAY: {
    name: "PVOUT - May",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_05.bin`,
  },
  PVOUT_JUN: {
    name: "PVOUT - June",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_06.bin`,
  },
  PVOUT_JUL: {
    name: "PVOUT - July",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_07.bin`,
  },
  PVOUT_AUG: {
    name: "PVOUT - August",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_08.bin`,
  },
  PVOUT_SEP: {
    name: "PVOUT - September",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_09.bin`,
  },
  PVOUT_OCT: {
    name: "PVOUT - October",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_10.bin`,
  },
  PVOUT_NOV: {
    name: "PVOUT - November",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_11.bin`,
  },
  PVOUT_DEC: {
    name: "PVOUT - December",
    shortName: "PVOUT",
    min: 0,
    max: 210,
    unit: "kWh/kWp",
    colors: monthlyColors,
    file: `${BASE_PATH}/PVOUT_12.bin`,
  },
  CHIRPS_2018: {
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2018.bin`,
  },
  CHIRPS_2019: {
    name: "Precipitation - 2019",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2019.bin`,
  },
  CHIRPS_2020: {
    name: "Precipitation - 2020",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2020.bin`,
  },
  CHIRPS_2021: {
    name: "Precipitation - 2021",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2021.bin`,
  },
  CHIRPS_2022: {
    name: "Precipitation - 2022",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2022.bin`,
  },
  CHIRPS_2023: {
    name: "Precipitation - 2023",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2023.bin`,
  },
  CHIRPS_2024: {
    name: "Precipitation - 2024",
    shortName: "PREC",
    min: 0,
    max: 1800,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2024.bin`,
  },
  CHIRPS_2025_JAN: {
    name: "Precipitation - Jan 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-01.bin`,
  },
  CHIRPS_2025_FEB: {
    name: "Precipitation - Feb 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-02.bin`,
  },
  CHIRPS_2025_MAR: {
    name: "Precipitation - Mar 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-03.bin`,
  },
  CHIRPS_2025_APR: {
    name: "Precipitation - Apr 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-04.bin`,
  },
  CHIRPS_2025_MAY: {
    name: "Precipitation - May 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-05.bin`,
  },
  CHIRPS_2025_JUN: {
    name: "Precipitation - Jun 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-06.bin`,
  },
  CHIRPS_2025_JUL: {
    name: "Precipitation - Jul 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-07.bin`,
  },
  CHIRPS_2025_AUG: {
    name: "Precipitation - Aug 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-08.bin`,
  },
  CHIRPS_2025_SEP: {
    name: "Precipitation - Sep 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-09.bin`,
  },
  CHIRPS_2025_OCT: {
    name: "Precipitation - Oct 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-10.bin`,
  },
  CHIRPS_2025_NOV: {
    name: "Precipitation - Nov 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-11.bin`,
  },
  CHIRPS_2025_DEC: {
    name: "Precipitation - Dec 2025",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2025-12.bin`,
  },
  CHIRPS_2026_JAN: {
    name: "Precipitation - Jan 2026",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2026-01.bin`,
  },
  CHIRPS_2026_FEB: {
    name: "Precipitation - Feb 2026",
    shortName: "PREC",
    min: 0,
    max: 400,
    unit: "mm",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(0, 150, 255, 0.6)",
      "rgba(0, 100, 200, 0.8)",
      "rgba(0, 50, 150, 1)",
    ],
    file: `${BASE_PATH}/Precipitation/chirps-2026-02.bin`,
  },
  LANDCOVER: {
    name: "Land Cover (ESA WorldCover)",
    shortName: "LAND",
    min: 10,
    max: 100,
    unit: "class",
    colors: [
      "rgba(0, 100, 0, 230)",
      "rgba(255, 187, 34, 230)",
      "rgba(255, 255, 76, 230)",
      "rgba(240, 150, 255, 230)",
      "rgba(250, 0, 0, 230)",
      "rgba(180, 180, 180, 230)",
      "rgba(240, 240, 240, 230)",
      "rgba(0, 100, 200, 230)",
      "rgba(0, 150, 160, 230)",
      "rgba(0, 207, 117, 230)",
      "rgba(250, 230, 160, 230)",
    ],
    file: `${BASE_PATH}/landcover/Iraq_Landcover_ESA.bin`,
  },
  SOIL: {
    name: "Soil Texture (USDA)",
    shortName: "SOIL",
    min: 1,
    max: 12,
    unit: "class",
    colors: [
      "rgba(160, 82, 45, 230)",
      "rgba(205, 92, 92, 230)",
      "rgba(218, 165, 32, 230)",
      "rgba(184, 134, 11, 230)",
      "rgba(237, 201, 175, 230)",
      "rgba(244, 164, 96, 230)",
      "rgba(210, 180, 140, 230)",
      "rgba(139, 69, 19, 230)",
      "rgba(158, 163, 143, 230)",
      "rgba(128, 128, 128, 230)",
      "rgba(85, 107, 47, 230)",
      "rgba(72, 61, 139, 230)",
    ],
    file: `${BASE_PATH}/soil/Iraq_Soil_Texture_USDA_250m.bin`,
  },
  TEMP_ABS_2026_JAN: {
    name: "Temperature - Jan 2026",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2026-01.bin`,
  },
  TEMP_ABS_2026_FEB: {
    name: "Temperature - Feb 2026",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2026-02.bin`,
  },
  TEMP_ABS_2018_JAN: {
    name: "Temperature - Jan 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-01.bin`,
  },
  TEMP_ABS_2018_FEB: {
    name: "Temperature - Feb 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-02.bin`,
  },
  TEMP_ABS_2018_MAR: {
    name: "Temperature - Mar 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-03.bin`,
  },
  TEMP_ABS_2018_APR: {
    name: "Temperature - Apr 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-04.bin`,
  },
  TEMP_ABS_2018_MAY: {
    name: "Temperature - May 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-05.bin`,
  },
  TEMP_ABS_2018_JUN: {
    name: "Temperature - Jun 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-06.bin`,
  },
  TEMP_ABS_2018_JUL: {
    name: "Temperature - Jul 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-07.bin`,
  },
  TEMP_ABS_2018_AUG: {
    name: "Temperature - Aug 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-08.bin`,
  },
  TEMP_ABS_2018_SEP: {
    name: "Temperature - Sep 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-09.bin`,
  },
  TEMP_ABS_2018_OCT: {
    name: "Temperature - Oct 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-10.bin`,
  },
  TEMP_ABS_2018_NOV: {
    name: "Temperature - Nov 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-11.bin`,
  },
  TEMP_ABS_2018_DEC: {
    name: "Temperature - Dec 2018",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2018-12.bin`,
  },
  TEMP_ABS_2019_JAN: {
    name: "Temperature - Jan 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-01.bin`,
  },
  TEMP_ABS_2019_FEB: {
    name: "Temperature - Feb 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-02.bin`,
  },
  TEMP_ABS_2019_MAR: {
    name: "Temperature - Mar 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-03.bin`,
  },
  TEMP_ABS_2019_APR: {
    name: "Temperature - Apr 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-04.bin`,
  },
  TEMP_ABS_2019_MAY: {
    name: "Temperature - May 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-05.bin`,
  },
  TEMP_ABS_2019_JUN: {
    name: "Temperature - Jun 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-06.bin`,
  },
  TEMP_ABS_2019_JUL: {
    name: "Temperature - Jul 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-07.bin`,
  },
  TEMP_ABS_2019_AUG: {
    name: "Temperature - Aug 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-08.bin`,
  },
  TEMP_ABS_2019_SEP: {
    name: "Temperature - Sep 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-09.bin`,
  },
  TEMP_ABS_2019_OCT: {
    name: "Temperature - Oct 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-10.bin`,
  },
  TEMP_ABS_2019_NOV: {
    name: "Temperature - Nov 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-11.bin`,
  },
  TEMP_ABS_2019_DEC: {
    name: "Temperature - Dec 2019",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2019-12.bin`,
  },
  TEMP_ABS_2020_JAN: {
    name: "Temperature - Jan 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-01.bin`,
  },
  TEMP_ABS_2020_FEB: {
    name: "Temperature - Feb 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-02.bin`,
  },
  TEMP_ABS_2020_MAR: {
    name: "Temperature - Mar 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-03.bin`,
  },
  TEMP_ABS_2020_APR: {
    name: "Temperature - Apr 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-04.bin`,
  },
  TEMP_ABS_2020_MAY: {
    name: "Temperature - May 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-05.bin`,
  },
  TEMP_ABS_2020_JUN: {
    name: "Temperature - Jun 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-06.bin`,
  },
  TEMP_ABS_2020_JUL: {
    name: "Temperature - Jul 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-07.bin`,
  },
  TEMP_ABS_2020_AUG: {
    name: "Temperature - Aug 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-08.bin`,
  },
  TEMP_ABS_2020_SEP: {
    name: "Temperature - Sep 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-09.bin`,
  },
  TEMP_ABS_2020_OCT: {
    name: "Temperature - Oct 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-10.bin`,
  },
  TEMP_ABS_2020_NOV: {
    name: "Temperature - Nov 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-11.bin`,
  },
  TEMP_ABS_2020_DEC: {
    name: "Temperature - Dec 2020",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2020-12.bin`,
  },
  TEMP_ABS_2021_JAN: {
    name: "Temperature - Jan 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-01.bin`,
  },
  TEMP_ABS_2021_FEB: {
    name: "Temperature - Feb 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-02.bin`,
  },
  TEMP_ABS_2021_MAR: {
    name: "Temperature - Mar 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-03.bin`,
  },
  TEMP_ABS_2021_APR: {
    name: "Temperature - Apr 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-04.bin`,
  },
  TEMP_ABS_2021_MAY: {
    name: "Temperature - May 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-05.bin`,
  },
  TEMP_ABS_2021_JUN: {
    name: "Temperature - Jun 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-06.bin`,
  },
  TEMP_ABS_2021_JUL: {
    name: "Temperature - Jul 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-07.bin`,
  },
  TEMP_ABS_2021_AUG: {
    name: "Temperature - Aug 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-08.bin`,
  },
  TEMP_ABS_2021_SEP: {
    name: "Temperature - Sep 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-09.bin`,
  },
  TEMP_ABS_2021_OCT: {
    name: "Temperature - Oct 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-10.bin`,
  },
  TEMP_ABS_2021_NOV: {
    name: "Temperature - Nov 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-11.bin`,
  },
  TEMP_ABS_2021_DEC: {
    name: "Temperature - Dec 2021",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2021-12.bin`,
  },
  TEMP_ABS_2022_JAN: {
    name: "Temperature - Jan 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-01.bin`,
  },
  TEMP_ABS_2022_FEB: {
    name: "Temperature - Feb 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-02.bin`,
  },
  TEMP_ABS_2022_MAR: {
    name: "Temperature - Mar 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-03.bin`,
  },
  TEMP_ABS_2022_APR: {
    name: "Temperature - Apr 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-04.bin`,
  },
  TEMP_ABS_2022_MAY: {
    name: "Temperature - May 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-05.bin`,
  },
  TEMP_ABS_2022_JUN: {
    name: "Temperature - Jun 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-06.bin`,
  },
  TEMP_ABS_2022_JUL: {
    name: "Temperature - Jul 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-07.bin`,
  },
  TEMP_ABS_2022_AUG: {
    name: "Temperature - Aug 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-08.bin`,
  },
  TEMP_ABS_2022_SEP: {
    name: "Temperature - Sep 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-09.bin`,
  },
  TEMP_ABS_2022_OCT: {
    name: "Temperature - Oct 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-10.bin`,
  },
  TEMP_ABS_2022_NOV: {
    name: "Temperature - Nov 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-11.bin`,
  },
  TEMP_ABS_2022_DEC: {
    name: "Temperature - Dec 2022",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2022-12.bin`,
  },
  TEMP_ABS_2023_JAN: {
    name: "Temperature - Jan 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-01.bin`,
  },
  TEMP_ABS_2023_FEB: {
    name: "Temperature - Feb 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-02.bin`,
  },
  TEMP_ABS_2023_MAR: {
    name: "Temperature - Mar 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-03.bin`,
  },
  TEMP_ABS_2023_APR: {
    name: "Temperature - Apr 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-04.bin`,
  },
  TEMP_ABS_2023_MAY: {
    name: "Temperature - May 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-05.bin`,
  },
  TEMP_ABS_2023_JUN: {
    name: "Temperature - Jun 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-06.bin`,
  },
  TEMP_ABS_2023_JUL: {
    name: "Temperature - Jul 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-07.bin`,
  },
  TEMP_ABS_2023_AUG: {
    name: "Temperature - Aug 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-08.bin`,
  },
  TEMP_ABS_2023_SEP: {
    name: "Temperature - Sep 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-09.bin`,
  },
  TEMP_ABS_2023_OCT: {
    name: "Temperature - Oct 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-10.bin`,
  },
  TEMP_ABS_2023_NOV: {
    name: "Temperature - Nov 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-11.bin`,
  },
  TEMP_ABS_2023_DEC: {
    name: "Temperature - Dec 2023",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2023-12.bin`,
  },
  TEMP_ABS_2024_JAN: {
    name: "Temperature - Jan 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-01.bin`,
  },
  TEMP_ABS_2024_FEB: {
    name: "Temperature - Feb 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-02.bin`,
  },
  TEMP_ABS_2024_MAR: {
    name: "Temperature - Mar 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-03.bin`,
  },
  TEMP_ABS_2024_APR: {
    name: "Temperature - Apr 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-04.bin`,
  },
  TEMP_ABS_2024_MAY: {
    name: "Temperature - May 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-05.bin`,
  },
  TEMP_ABS_2024_JUN: {
    name: "Temperature - Jun 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-06.bin`,
  },
  TEMP_ABS_2024_JUL: {
    name: "Temperature - Jul 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-07.bin`,
  },
  TEMP_ABS_2024_AUG: {
    name: "Temperature - Aug 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-08.bin`,
  },
  TEMP_ABS_2024_SEP: {
    name: "Temperature - Sep 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-09.bin`,
  },
  TEMP_ABS_2024_OCT: {
    name: "Temperature - Oct 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-10.bin`,
  },
  TEMP_ABS_2024_NOV: {
    name: "Temperature - Nov 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-11.bin`,
  },
  TEMP_ABS_2024_DEC: {
    name: "Temperature - Dec 2024",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2024-12.bin`,
  },
  TEMP_ABS_2025_JAN: {
    name: "Temperature - Jan 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-01.bin`,
  },
  TEMP_ABS_2025_FEB: {
    name: "Temperature - Feb 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-02.bin`,
  },
  TEMP_ABS_2025_MAR: {
    name: "Temperature - Mar 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-03.bin`,
  },
  TEMP_ABS_2025_APR: {
    name: "Temperature - Apr 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-04.bin`,
  },
  TEMP_ABS_2025_MAY: {
    name: "Temperature - May 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-05.bin`,
  },
  TEMP_ABS_2025_JUN: {
    name: "Temperature - Jun 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-06.bin`,
  },
  TEMP_ABS_2025_JUL: {
    name: "Temperature - Jul 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-07.bin`,
  },
  TEMP_ABS_2025_AUG: {
    name: "Temperature - Aug 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-08.bin`,
  },
  TEMP_ABS_2025_SEP: {
    name: "Temperature - Sep 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-09.bin`,
  },
  TEMP_ABS_2025_OCT: {
    name: "Temperature - Oct 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-10.bin`,
  },
  TEMP_ABS_2025_NOV: {
    name: "Temperature - Nov 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-11.bin`,
  },
  TEMP_ABS_2025_DEC: {
    name: "Temperature - Dec 2025",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-absolute-2025-12.bin`,
  },
  TEMP_YEARLY: {
    name: "Temperature (Yearly Avg)",
    min: 0,
    max: 50,
    unit: "°C",
    colors: [
      "rgba(0, 0, 255, 0.8)",
      "rgba(100, 150, 255, 0.5)",
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.6)",
      "rgba(255, 0, 0, 0.9)",
    ],
    file: `${BASE_PATH}/temparature/temp-yearly-2026.bin`,
  },
  DUST_2020_01: {
    name: "Dust - Jan 2020",
    min: -0.97,
    max: 2.78,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_01.bin`,
  },
  DUST_2020_02: {
    name: "Dust - Feb 2020",
    min: -0.74,
    max: 1.79,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_02.bin`,
  },
  DUST_2020_03: {
    name: "Dust - Mar 2020",
    min: -0.69,
    max: 3.48,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_03.bin`,
  },
  DUST_2020_04: {
    name: "Dust - Apr 2020",
    min: -0.65,
    max: 3.9,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_04.bin`,
  },
  DUST_2020_05: {
    name: "Dust - May 2020",
    min: -0.66,
    max: 4.26,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_05.bin`,
  },
  DUST_2020_06: {
    name: "Dust - Jun 2020",
    min: -0.94,
    max: 5.34,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_06.bin`,
  },
  DUST_2020_07: {
    name: "Dust - Jul 2020",
    min: -1.02,
    max: 305.37,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_07.bin`,
  },
  DUST_2020_08: {
    name: "Dust - Aug 2020",
    min: -1.2,
    max: 3.43,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_08.bin`,
  },
  DUST_2020_09: {
    name: "Dust - Sep 2020",
    min: -1.11,
    max: 1.63,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_09.bin`,
  },
  DUST_2020_10: {
    name: "Dust - Oct 2020",
    min: -1.11,
    max: 4.33,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_10.bin`,
  },
  DUST_2020_11: {
    name: "Dust - Nov 2020",
    min: -0.82,
    max: 3.72,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_11.bin`,
  },
  DUST_2020_12: {
    name: "Dust - Dec 2020",
    min: -0.94,
    max: 3.46,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2020_12.bin`,
  },
  DUST_2021_01: {
    name: "Dust - Jan 2021",
    min: -0.99,
    max: 2.31,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_01.bin`,
  },
  DUST_2021_02: {
    name: "Dust - Feb 2021",
    min: -1.09,
    max: 1.52,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_02.bin`,
  },
  DUST_2021_03: {
    name: "Dust - Mar 2021",
    min: -0.66,
    max: 3.08,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_03.bin`,
  },
  DUST_2021_04: {
    name: "Dust - Apr 2021",
    min: -0.76,
    max: 2.79,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_04.bin`,
  },
  DUST_2021_05: {
    name: "Dust - May 2021",
    min: -1.02,
    max: 3.29,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_05.bin`,
  },
  DUST_2021_06: {
    name: "Dust - Jun 2021",
    min: -1.28,
    max: 4.08,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_06.bin`,
  },
  DUST_2021_07: {
    name: "Dust - Jul 2021",
    min: 0.52,
    max: 5.22,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_07.bin`,
  },
  DUST_2021_08: {
    name: "Dust - Aug 2021",
    min: 0.7,
    max: 4.47,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_08.bin`,
  },
  DUST_2021_09: {
    name: "Dust - Sep 2021",
    min: 0.46,
    max: 2.92,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_09.bin`,
  },
  DUST_2021_10: {
    name: "Dust - Oct 2021",
    min: 0.48,
    max: 3.05,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_10.bin`,
  },
  DUST_2021_11: {
    name: "Dust - Nov 2021",
    min: 0.63,
    max: 3.76,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_11.bin`,
  },
  DUST_2021_12: {
    name: "Dust - Dec 2021",
    min: 0.65,
    max: 3.32,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2021_12.bin`,
  },
  DUST_2022_01: {
    name: "Dust - Jan 2022",
    min: 0.38,
    max: 3.09,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_01.bin`,
  },
  DUST_2022_02: {
    name: "Dust - Feb 2022",
    min: 0.01,
    max: 2.8,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_02.bin`,
  },
  DUST_2022_03: {
    name: "Dust - Mar 2022",
    min: 0.76,
    max: 4.04,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_03.bin`,
  },
  DUST_2022_04: {
    name: "Dust - Apr 2022",
    min: 1.21,
    max: 6.52,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_04.bin`,
  },
  DUST_2022_05: {
    name: "Dust - May 2022",
    min: 1.21,
    max: 5.82,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_05.bin`,
  },
  DUST_2022_06: {
    name: "Dust - Jun 2022",
    min: 0.75,
    max: 6.77,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_06.bin`,
  },
  DUST_2022_07: {
    name: "Dust - Jul 2022",
    min: 0.81,
    max: 4.66,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_07.bin`,
  },
  DUST_2022_08: {
    name: "Dust - Aug 2022",
    min: 0.5,
    max: 3.92,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_08.bin`,
  },
  DUST_2022_09: {
    name: "Dust - Sep 2022",
    min: 0.33,
    max: 4.76,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_09.bin`,
  },
  DUST_2022_10: {
    name: "Dust - Oct 2022",
    min: 0.15,
    max: 4.07,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_10.bin`,
  },
  DUST_2022_11: {
    name: "Dust - Nov 2022",
    min: 0.26,
    max: 2.9,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_11.bin`,
  },
  DUST_2022_12: {
    name: "Dust - Dec 2022",
    min: 0.24,
    max: 2.6,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2022_12.bin`,
  },
  DUST_2023_01: {
    name: "Dust - Jan 2023",
    min: 0.09,
    max: 2.99,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_01.bin`,
  },
  DUST_2023_02: {
    name: "Dust - Feb 2023",
    min: 0.01,
    max: 3.16,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_02.bin`,
  },
  DUST_2023_03: {
    name: "Dust - Mar 2023",
    min: 0.37,
    max: 4.15,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_03.bin`,
  },
  DUST_2023_04: {
    name: "Dust - Apr 2023",
    min: 0.47,
    max: 4.08,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_04.bin`,
  },
  DUST_2023_05: {
    name: "Dust - May 2023",
    min: 0.47,
    max: 4.89,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_05.bin`,
  },
  DUST_2023_06: {
    name: "Dust - Jun 2023",
    min: 0.33,
    max: 5.87,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_06.bin`,
  },
  DUST_2023_07: {
    name: "Dust - Jul 2023",
    min: 0.32,
    max: 9.29,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_07.bin`,
  },
  DUST_2023_08: {
    name: "Dust - Aug 2023",
    min: 0.16,
    max: 3.91,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_08.bin`,
  },
  DUST_2023_09: {
    name: "Dust - Sep 2023",
    min: 0.26,
    max: 4.26,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_09.bin`,
  },
  DUST_2023_10: {
    name: "Dust - Oct 2023",
    min: 0.43,
    max: 3.47,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_10.bin`,
  },
  DUST_2023_11: {
    name: "Dust - Nov 2023",
    min: 0.25,
    max: 2.76,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_11.bin`,
  },
  DUST_2023_12: {
    name: "Dust - Dec 2023",
    min: 0.31,
    max: 2.55,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2023_12.bin`,
  },
  DUST_2024_01: {
    name: "Dust - Jan 2024",
    min: 0.02,
    max: 3.17,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_01.bin`,
  },
  DUST_2024_02: {
    name: "Dust - Feb 2024",
    min: -0.17,
    max: 2.82,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_02.bin`,
  },
  DUST_2024_03: {
    name: "Dust - Mar 2024",
    min: 0.08,
    max: 3.89,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_03.bin`,
  },
  DUST_2024_04: {
    name: "Dust - Apr 2024",
    min: 0.23,
    max: 4.64,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_04.bin`,
  },
  DUST_2024_05: {
    name: "Dust - May 2024",
    min: 0.37,
    max: 4.31,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_05.bin`,
  },
  DUST_2024_06: {
    name: "Dust - Jun 2024",
    min: 0.3,
    max: 5.59,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_06.bin`,
  },
  DUST_2024_07: {
    name: "Dust - Jul 2024",
    min: 0.28,
    max: 4.44,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_07.bin`,
  },
  DUST_2024_08: {
    name: "Dust - Aug 2024",
    min: -0.0,
    max: 4.62,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_08.bin`,
  },
  DUST_2024_09: {
    name: "Dust - Sep 2024",
    min: 0.24,
    max: 4.24,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_09.bin`,
  },
  DUST_2024_10: {
    name: "Dust - Oct 2024",
    min: 0.14,
    max: 3.64,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_10.bin`,
  },
  DUST_2024_11: {
    name: "Dust - Nov 2024",
    min: 0.11,
    max: 2.97,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_11.bin`,
  },
  DUST_2024_12: {
    name: "Dust - Dec 2024",
    min: 0.13,
    max: 3.45,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2024_12.bin`,
  },
  DUST_2025_01: {
    name: "Dust - Jan 2025",
    min: -0.17,
    max: 2.19,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_01.bin`,
  },
  DUST_2025_02: {
    name: "Dust - Feb 2025",
    min: 0.08,
    max: 3.66,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_02.bin`,
  },
  DUST_2025_03: {
    name: "Dust - Mar 2025",
    min: -0.1,
    max: 3.3,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_03.bin`,
  },
  DUST_2025_04: {
    name: "Dust - Apr 2025",
    min: 0.28,
    max: 5.66,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_04.bin`,
  },
  DUST_2025_05: {
    name: "Dust - May 2025",
    min: 0.35,
    max: 5.05,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_05.bin`,
  },
  DUST_2025_06: {
    name: "Dust - Jun 2025",
    min: 0.55,
    max: 5.87,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_06.bin`,
  },
  DUST_2025_07: {
    name: "Dust - Jul 2025",
    min: 0.48,
    max: 6.04,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_07.bin`,
  },
  DUST_2025_08: {
    name: "Dust - Aug 2025",
    min: 0.22,
    max: 4.74,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_08.bin`,
  },
  DUST_2025_09: {
    name: "Dust - Sep 2025",
    min: 0.26,
    max: 4.34,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_09.bin`,
  },
  DUST_2025_10: {
    name: "Dust - Oct 2025",
    min: 0.18,
    max: 3.16,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_10.bin`,
  },
  DUST_2025_11: {
    name: "Dust - Nov 2025",
    min: 0.09,
    max: 2.22,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_11.bin`,
  },
  DUST_2025_12: {
    name: "Dust - Dec 2025",
    min: 0.49,
    max: 5.28,
    unit: "index",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(255, 200, 100, 0.4)",
      "rgba(200, 100, 50, 0.6)",
      "rgba(180, 50, 20, 0.8)",
    ],
    file: `${BASE_PATH}/Dust_2025_12.bin`,
  },
  CLOUD_YEARLY: {
    name: "Cloud Cover (Yearly Avg)",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_01.bin`,
  },
  CLOUD_2020_01: {
    name: "Cloud Cover - Jan 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_01.bin`,
  },
  CLOUD_2020_02: {
    name: "Cloud Cover - Feb 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_02.bin`,
  },
  CLOUD_2020_03: {
    name: "Cloud Cover - Mar 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_03.bin`,
  },
  CLOUD_2020_04: {
    name: "Cloud Cover - Apr 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_04.bin`,
  },
  CLOUD_2020_05: {
    name: "Cloud Cover - May 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_05.bin`,
  },
  CLOUD_2020_06: {
    name: "Cloud Cover - Jun 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_06.bin`,
  },
  CLOUD_2020_07: {
    name: "Cloud Cover - Jul 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_07.bin`,
  },
  CLOUD_2020_08: {
    name: "Cloud Cover - Aug 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_08.bin`,
  },
  CLOUD_2020_09: {
    name: "Cloud Cover - Sep 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_09.bin`,
  },
  CLOUD_2020_10: {
    name: "Cloud Cover - Oct 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_10.bin`,
  },
  CLOUD_2020_11: {
    name: "Cloud Cover - Nov 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_11.bin`,
  },
  CLOUD_2020_12: {
    name: "Cloud Cover - Dec 2020",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2020_12.bin`,
  },
  CLOUD_2021_01: {
    name: "Cloud Cover - Jan 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_01.bin`,
  },
  CLOUD_2021_02: {
    name: "Cloud Cover - Feb 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_02.bin`,
  },
  CLOUD_2021_03: {
    name: "Cloud Cover - Mar 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_03.bin`,
  },
  CLOUD_2021_04: {
    name: "Cloud Cover - Apr 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_04.bin`,
  },
  CLOUD_2021_05: {
    name: "Cloud Cover - May 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_05.bin`,
  },
  CLOUD_2021_06: {
    name: "Cloud Cover - Jun 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_06.bin`,
  },
  CLOUD_2021_07: {
    name: "Cloud Cover - Jul 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_07.bin`,
  },
  CLOUD_2021_08: {
    name: "Cloud Cover - Aug 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_08.bin`,
  },
  CLOUD_2021_09: {
    name: "Cloud Cover - Sep 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_09.bin`,
  },
  CLOUD_2021_10: {
    name: "Cloud Cover - Oct 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_10.bin`,
  },
  CLOUD_2021_11: {
    name: "Cloud Cover - Nov 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_11.bin`,
  },
  CLOUD_2021_12: {
    name: "Cloud Cover - Dec 2021",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2021_12.bin`,
  },
  CLOUD_2022_01: {
    name: "Cloud Cover - Jan 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_01.bin`,
  },
  CLOUD_2022_02: {
    name: "Cloud Cover - Feb 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_02.bin`,
  },
  CLOUD_2022_03: {
    name: "Cloud Cover - Mar 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_03.bin`,
  },
  CLOUD_2022_04: {
    name: "Cloud Cover - Apr 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_04.bin`,
  },
  CLOUD_2022_05: {
    name: "Cloud Cover - May 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_05.bin`,
  },
  CLOUD_2022_06: {
    name: "Cloud Cover - Jun 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_06.bin`,
  },
  CLOUD_2022_07: {
    name: "Cloud Cover - Jul 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_07.bin`,
  },
  CLOUD_2022_08: {
    name: "Cloud Cover - Aug 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_08.bin`,
  },
  CLOUD_2022_09: {
    name: "Cloud Cover - Sep 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_09.bin`,
  },
  CLOUD_2022_10: {
    name: "Cloud Cover - Oct 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_10.bin`,
  },
  CLOUD_2022_11: {
    name: "Cloud Cover - Nov 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_11.bin`,
  },
  CLOUD_2022_12: {
    name: "Cloud Cover - Dec 2022",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2022_12.bin`,
  },
  CLOUD_2023_01: {
    name: "Cloud Cover - Jan 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_01.bin`,
  },
  CLOUD_2023_02: {
    name: "Cloud Cover - Feb 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_02.bin`,
  },
  CLOUD_2023_03: {
    name: "Cloud Cover - Mar 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_03.bin`,
  },
  CLOUD_2023_04: {
    name: "Cloud Cover - Apr 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_04.bin`,
  },
  CLOUD_2023_05: {
    name: "Cloud Cover - May 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_05.bin`,
  },
  CLOUD_2023_06: {
    name: "Cloud Cover - Jun 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_06.bin`,
  },
  CLOUD_2023_07: {
    name: "Cloud Cover - Jul 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_07.bin`,
  },
  CLOUD_2023_08: {
    name: "Cloud Cover - Aug 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_08.bin`,
  },
  CLOUD_2023_09: {
    name: "Cloud Cover - Sep 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_09.bin`,
  },
  CLOUD_2023_10: {
    name: "Cloud Cover - Oct 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_10.bin`,
  },
  CLOUD_2023_11: {
    name: "Cloud Cover - Nov 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_11.bin`,
  },
  CLOUD_2023_12: {
    name: "Cloud Cover - Dec 2023",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2023_12.bin`,
  },
  CLOUD_2024_01: {
    name: "Cloud Cover - Jan 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_01.bin`,
  },
  CLOUD_2024_02: {
    name: "Cloud Cover - Feb 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_02.bin`,
  },
  CLOUD_2024_03: {
    name: "Cloud Cover - Mar 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_03.bin`,
  },
  CLOUD_2024_04: {
    name: "Cloud Cover - Apr 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_04.bin`,
  },
  CLOUD_2024_05: {
    name: "Cloud Cover - May 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_05.bin`,
  },
  CLOUD_2024_06: {
    name: "Cloud Cover - Jun 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_06.bin`,
  },
  CLOUD_2024_07: {
    name: "Cloud Cover - Jul 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_07.bin`,
  },
  CLOUD_2024_08: {
    name: "Cloud Cover - Aug 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_08.bin`,
  },
  CLOUD_2024_09: {
    name: "Cloud Cover - Sep 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_09.bin`,
  },
  CLOUD_2024_10: {
    name: "Cloud Cover - Oct 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_10.bin`,
  },
  CLOUD_2024_11: {
    name: "Cloud Cover - Nov 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_11.bin`,
  },
  CLOUD_2024_12: {
    name: "Cloud Cover - Dec 2024",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2024_12.bin`,
  },
  CLOUD_2025_01: {
    name: "Cloud Cover - Jan 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_01.bin`,
  },
  CLOUD_2025_02: {
    name: "Cloud Cover - Feb 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_02.bin`,
  },
  CLOUD_2025_03: {
    name: "Cloud Cover - Mar 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_03.bin`,
  },
  CLOUD_2025_04: {
    name: "Cloud Cover - Apr 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_04.bin`,
  },
  CLOUD_2025_05: {
    name: "Cloud Cover - May 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_05.bin`,
  },
  CLOUD_2025_06: {
    name: "Cloud Cover - Jun 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_06.bin`,
  },
  CLOUD_2025_07: {
    name: "Cloud Cover - Jul 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_07.bin`,
  },
  CLOUD_2025_08: {
    name: "Cloud Cover - Aug 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_08.bin`,
  },
  CLOUD_2025_09: {
    name: "Cloud Cover - Sep 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_09.bin`,
  },
  CLOUD_2025_10: {
    name: "Cloud Cover - Oct 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_10.bin`,
  },
  CLOUD_2025_11: {
    name: "Cloud Cover - Nov 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_11.bin`,
  },
  CLOUD_2025_12: {
    name: "Cloud Cover - Dec 2025",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2025_12.bin`,
  },
  CLOUD_2026_01: {
    name: "Cloud Cover - Jan 2026",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2026_01.bin`,
  },
  CLOUD_2026_02: {
    name: "Cloud Cover - Feb 2026",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2026_02.bin`,
  },
  CLOUD_2026_03: {
    name: "Cloud Cover - Mar 2026",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2026_03.bin`,
  },
  CLOUD_2026_04: {
    name: "Cloud Cover - Apr 2026",
    min: 0,
    max: 100,
    unit: "%",
    colors: [
      "rgba(255, 255, 255, 0)",
      "rgba(200, 200, 200, 0.4)",
      "rgba(150, 150, 150, 0.6)",
      "rgba(100, 100, 100, 0.8)",
    ],
    file: `${BASE_PATH}/Cloud_2026_04.bin`,
  },
  NIGHT_LIGHTS: {
    name: "Night Lights (VIIRS)",
    shortName: "NIGHT",
    min: 0,
    max: 20,
    unit: "nW/cm²/sr",
    colors: [
      "rgba(0, 0, 0, 0)",
      "rgba(20, 0, 60, 0.3)",
      "rgba(60, 0, 120, 0.5)",
      "rgba(150, 50, 200, 0.7)",
      "rgba(255, 150, 50, 0.85)",
      "rgba(255, 255, 200, 0.95)",
    ],
    file: `${BASE_PATH}/Night_Lights.bin`,
  },
  ELECTRIC_GRID: {
    name: "Electric Grid",
    shortName: "GRID",
    min: 0,
    max: 1,
    unit: "",
    colors: [],
    file: `${BASE_PATH}/electric-network-iraq.geojson`,
  },
  POPULATION: {
    name: "Population Density",
    shortName: "Population Density",
    min: 0,
    max: 460,
    unit: "people/km²",
    colors: [
      "rgba(255, 255, 200, 0.3)",
      "rgba(255, 255, 100, 0.5)",
      "rgba(255, 220, 50, 0.7)",
      "rgba(255, 150, 0, 0.85)",
      "rgba(200, 50, 0, 0.95)",
    ],
    file: `${BASE_PATH}/irq_pop_100m.bin`,
  },
};

type CategoryType =
  | "GHI"
  | "DNI"
  | "DIF"
  | "GTI"
  | "OPTA"
  | "PVOUT"
  | "ELEVATION"
  | "PRECIPITATION"
  | "LANDCOVER"
  | "SOIL"
  | "SLOPE"
  | "AIR_TEMP_ABS"
  | "ATMOSPHERIC_DUST"
  | "CLOUD_COVER"
  | "NIGHT_LIGHTS"
  | "ELECTRIC_GRID"
  | "POPULATION";

const categories: Record<CategoryType, string> = {
  GHI: "Global Horizontal Irradiation (GHI)",
  DNI: "Direct Normal Irradiation (DNI)",
  DIF: "Diffuse Horizontal Irradiation (DIF)",
  GTI: "Global Tilted Irradiation (GTI)",
  OPTA: "Optimum Tilt of PV Modules (OPTA)",
  PVOUT: "Specific Photovoltaic Power Output (PVOUT)",
  ELEVATION: "Elevation",
  PRECIPITATION: "Precipitation (CHIRPS)",
  LANDCOVER: "Land Cover",
  SOIL: "Soil Texture",
  SLOPE: "Mountain Slope",
  AIR_TEMP_ABS: "Air Temperature (Absolute)",
  ATMOSPHERIC_DUST: "Dust Storms",
  CLOUD_COVER: "Cloud Cover",
  NIGHT_LIGHTS: "Night Lights (VIIRS)",
  ELECTRIC_GRID: "Electric Grid",
  POPULATION: "Population Density",
};

export function SatelliteSlide({
  onNext,
  onBack,
  tiffDataCache,
  setTiffDataCache,
  rasterDataCache,
  setRasterDataCache,
  rasterCacheRef,
}: {
  onNext: () => void;
  onBack?: () => void;
  tiffDataCache: Record<
    string,
    {
      url: string;
      coordinates: number[][];
      actual_min?: number;
      actual_max?: number;
    }
  >;
  setTiffDataCache: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        {
          url: string;
          coordinates: number[][];
          actual_min?: number;
          actual_max?: number;
        }
      >
    >
  >;
  rasterDataCache: Record<
    string,
    {
      rasters: any;
      bbox: number[];
      width: number;
      height: number;
      isFlipped?: boolean;
      actual_min?: number;
      actual_max?: number;
    }
  >;
  setRasterDataCache: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        {
          rasters: any;
          bbox: number[];
          width: number;
          height: number;
          isFlipped?: boolean;
          actual_min?: number;
          actual_max?: number;
        }
      >
    >
  >;
  rasterCacheRef: React.MutableRefObject<
    Record<
      string,
      {
        rasters: any;
        bbox: number[];
        width: number;
        height: number;
        isFlipped?: boolean;
        actual_min?: number;
        actual_max?: number;
      }
    >
  >;
}) {
  const mapRef = useRef<MapRef>(null);
  const [mountainCities, setMountainCities] = useState<ZoneSite[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/mcda_zones.geojson`).then(r => r.json()).catch(() => ({ features: [] })),
      fetch(`${BASE_PATH}/legacy_sites.geojson`).then(r => r.json()).catch(() => ({ features: [] }))
    ]).then(([mcdaData, legacyData]) => {
      const allFeatures = [...(legacyData.features || []), ...(mcdaData.features || [])];
      const zones = allFeatures.map((f: any) => ({
        name: f.properties.zone_id,
        coordinates: [f.properties.centroid_lon, f.properties.centroid_lat] as [number, number],
        desc: `Area: ${f.properties.area_km2} km² - ${f.properties.governorate} | MCDA Score: ${f.properties.score_100}%`,
        properties: f.properties
      }));
      setMountainCities(zones);
    }).catch(err => {
      console.error("Could not load zones:", err);
    });
  }, []);

  const [activeCity, setActiveCity] = useState<ZoneSite | null>(null);
  const [showSolar, setShowSolar] = useState(false);
  const [show400kv, setShow400kv] = useState(true);
  const [show132kv, setShow132kv] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryType>("PVOUT");
  const [activeMonth, setActiveMonth] = useState<string>("YEARLY");
  const [precipitationYear, setPrecipitationYear] = useState<number | null>(
    2025,
  );
  const [tempAnomalyYear, setTempAnomalyYear] = useState<number | null>(2025);
  const [tempAbsYear, setTempAbsYear] = useState<number | null>(2025);
  const [showCitiesOnly, setShowCitiesOnly] = useState(false);
  const [showCityDetails, setShowCityDetails] = useState(false);
  const [cityData, setCityData] = useState<Record<string, number>>({});
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showAllRainMonths, setShowAllRainMonths] = useState(false);
  const [showCityRainMonths, setShowCityRainMonths] = useState(false);
  const [showCityTempYears, setShowCityTempYears] = useState(false);
  const [showSelectedTempYears, setShowSelectedTempYears] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState(false);
  const [landCoverClass, setLandCoverClass] = useState<number | null>(null);
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "dark">("terrain");
  const [soilClass, setSoilClass] = useState<number | null>(null);
  const [slopeDegree, setSlopeDegree] = useState<number | null>(null);
  const [dustYear, setDustYear] = useState<number>(2025);
  const [dustMonth, setDustMonth] = useState<string>("05");
  const [dustIntensity, setDustIntensity] = useState<string | null>(null);
  const [cloudYear, setCloudYear] = useState<number>(2025);
  const [cloudMonth, setCloudMonth] = useState<string>("01");
  const [terrainExaggeration, setTerrainExaggeration] = useState(1);
  const [demoStep, setDemoStep] = useState(0);
  const [selectedLocationData, setSelectedLocationData] = useState<{
    lat: number;
    lng: number;
    data: Record<string, number>;
  } | null>(null);

  const [mapBounds, setMapBounds] = useState<{
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  } | null>(null);
  const [isLoadingTiff, setIsLoadingTiff] = useState(false);
  const [tiffError, setTiffError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isLoadingAllData, setIsLoadingAllData] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [iraqPolygon, setIraqPolygon] = useState<any>(null);
  const [iraqBounds, setIraqBounds] = useState<{
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  } | null>(null);
  const iraqPolygonRef = useRef<any>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/countries.geojson`)
      .then((r) => r.json())
      .then((geojson) => {
        const iraqFeature = geojson.features.find(
          (f: any) =>
            f.properties &&
            (f.properties.name === "Iraq" ||
              f.properties["ISO3166-1-Alpha-2"] === "IQ"),
        );
        if (iraqFeature) {
          const iraqGeojson = {
            type: "FeatureCollection",
            features: [iraqFeature],
          };
          iraqPolygonRef.current = iraqGeojson;
          setIraqPolygon(iraqGeojson);

          // Compute Iraq bounds
          let minLng = Infinity,
            maxLng = -Infinity,
            minLat = Infinity,
            maxLat = -Infinity;
          const coords = iraqFeature.geometry.coordinates;
          const processCoord = (c: any) => {
            if (typeof c[0] === "number") {
              minLng = Math.min(minLng, c[0]);
              maxLng = Math.max(maxLng, c[0]);
              minLat = Math.min(minLat, c[1]);
              maxLat = Math.max(maxLat, c[1]);
            } else {
              c.forEach(processCoord);
            }
          };
          coords.forEach((ring: any[]) => ring.forEach(processCoord));
          setIraqBounds({ minLng, maxLng, minLat, maxLat });
        }
    });
  }, []);

  useEffect(() => {
    loadForecastData().catch((e) => {
      console.error("Failed to load forecast data:", e);
    });
  }, []);

  const applyIraqClip = (
    ctx: CanvasRenderingContext2D,
    geojson: any,
    bbox: number[],
    width: number,
    height: number,
  ) => {
    const [minX, minY, maxX, maxY] = bbox;

    const toCanvasX = (lng: number) => ((lng - minX) / (maxX - minX)) * width;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);
    const toCanvasY = (lat: number) =>
      ((maxYMerc - mercatorY(lat)) / (maxYMerc - minYMerc)) * height;

    ctx.beginPath();
    for (const feature of geojson.features) {
      const geometries =
        feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates
          : [feature.geometry.coordinates];

      for (const polygon of geometries) {
        for (const ring of polygon) {
          ring.forEach(([lng, lat]: number[], i: number) => {
            const x = toCanvasX(lng);
            const y = toCanvasY(lat);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
    }
    ctx.clip();
  };

  const mapStyle = useMemo(
    () => ({
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles:
            mapType === "satellite"
              ? ["https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"]
              : mapType === "dark"
                ? ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"]
                : ["https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"],
          tileSize: 256,
          attribution: mapType === "dark" ? "© CartoDB" : "© Google",
        },
        terrain: {
          type: "raster-dem",
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
        },
      },
      layers: [
        {
          id: "base-layer",
          type: "raster",
          source: "base",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
      terrain: {
        source: "terrain",
        exaggeration: terrainExaggeration,
      },
    }),
    [mapType, terrainExaggeration],
  );

  const activeLayer: LayerType =
    activeCategory === "PVOUT"
      ? activeMonth === "YEARLY"
        ? "PVOUT_YEARLY"
        : (`PVOUT_${activeMonth}` as LayerType)
      : activeCategory === "PRECIPITATION"
        ? precipitationYear && precipitationYear >= 2025
          ? (`CHIRPS_${precipitationYear}_${activeMonth === "YEARLY" ? "JAN" : activeMonth}` as LayerType)
          : precipitationYear
            ? (`CHIRPS_${precipitationYear}` as LayerType)
            : "CHIRPS_2024"
        : activeCategory === "AIR_TEMP_ABS"
          ? (`TEMP_ABS_${tempAbsYear}_${activeMonth}` as LayerType)
          : activeCategory === "LANDCOVER"
            ? "LANDCOVER"
            : activeCategory === "SOIL"
              ? "SOIL"
              : activeCategory === "ATMOSPHERIC_DUST"
                ? (`DUST_${dustYear}_${dustMonth}` as LayerType)
                : activeCategory === "CLOUD_COVER"
                  ? (`CLOUD_${cloudYear}_${cloudMonth}` as LayerType)
                  : activeCategory === "NIGHT_LIGHTS"
                    ? "NIGHT_LIGHTS"
                    : activeCategory === "ELECTRIC_GRID"
                      ? "ELECTRIC_GRID"
                      : (activeCategory as LayerType);


  const loadLayer = async (layerKey: LayerType, force: boolean = false) => {
    let resolvedLayerKey = layerKey;
    let isForecastYear = false;
    let forecastAnomaly = 0;
    if (!layerConfigs[layerKey] && layerKey.startsWith("TEMP_ABS_") && FORECAST_YEARS.includes(parseInt(layerKey.split("_")[2]) as any)) {
      const year = parseInt(layerKey.split("_")[2]);
      const month = layerKey.split("_")[3];
      resolvedLayerKey = (`TEMP_ABS_2025_${month}` as LayerType);
      const monthNum = MONTH_MAP[month];
      if (monthNum) {
        forecastAnomaly = getForecastDelta(year, monthNum);
        isForecastYear = true;
      }
    }
    const config = layerConfigs[resolvedLayerKey];
    if (!config) {
      console.warn(`[loadLayer] No config found for layerKey: ${layerKey} (resolved: ${resolvedLayerKey})`);
      return null;
    }
    if (!force && tiffDataCache[layerKey]) return tiffDataCache[layerKey];

    const rasterInfo = await ensureRasterInfo(resolvedLayerKey);
    if (!rasterInfo) return null;

    const { rasters, bbox, width, height, isFlipped } = rasterInfo;
    const data = rasters[0] as Float32Array | Uint16Array | Uint8Array;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(width, height);

    // Compute actual min/max for normalization if it's a temperature layer
    const isTempLayer = layerKey.startsWith("TEMP_ABS_");
    let computedMin = config.min;
    let computedMax = config.max;

    if (isTempLayer) {
      computedMin = isForecastYear ? ((rasterInfo.actual_min ?? config.min) + forecastAnomaly) : (rasterInfo.actual_min ?? config.min);
      computedMax = isForecastYear ? ((rasterInfo.actual_max ?? config.max) + forecastAnomaly) : (rasterInfo.actual_max ?? config.max);
      let minVal = Infinity, maxVal = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v > -99 && v < 99999 && !isNaN(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      }
      if (minVal !== Infinity) {
        computedMin = minVal + (isForecastYear ? forecastAnomaly : 0);
        computedMax = maxVal + (isForecastYear ? forecastAnomaly : 0);
      }
    } else if (rasterInfo.actual_min !== undefined && rasterInfo.actual_max !== undefined) {
      computedMin = rasterInfo.actual_min;
      computedMax = rasterInfo.actual_max;
    }

    // Color normalization range: fixed for temperature, night lights, and population; dynamic for others
    const isFixedScale = isTempLayer || layerKey === "NIGHT_LIGHTS" || layerKey === "POPULATION";
    const normMin = isFixedScale ? config.min : computedMin;
    const normMax = isFixedScale ? config.max : computedMax;

    const parseColor = (c: string) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      return m
        ? [
            parseInt(m[1]),
            parseInt(m[2]),
            parseInt(m[3]),
            parseFloat(m[4]) * 255,
          ]
        : [0, 0, 0, 0];
    };
    const colors = config.colors.map(parseColor);

    const getColor = (val: number) => {
      if (val <= normMin) return colors[0];
      if (val >= normMax) return colors[colors.length - 1];
      const t = (normMax === normMin) ? 0 : (val - normMin) / (normMax - normMin);
      const scaledT = t * (colors.length - 1);
      const idx = Math.max(0, Math.min(Math.floor(scaledT), colors.length - 1));
      const frac = Math.min(scaledT - idx, 1);
      const c1 = colors[idx] || colors[0];
      const c2 = colors[idx + 1] || colors[colors.length - 1];
      return [
        c1[0] + (c2[0] - c1[0]) * frac,
        c1[1] + (c2[1] - c1[1]) * frac,
        c1[2] + (c2[2] - c1[2]) * frac,
        c1[3] + (c2[3] - c1[3]) * frac,
      ];
    };

    const isRainfall = layerKey.startsWith("CHIRPS_");
    const [minX, minY, maxX, maxY] = bbox;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);

    for (let py = 0; py < height; py++) {
      const mercY = maxYMerc - (py / height) * (maxYMerc - minYMerc);
      const lat =
        ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
      const tifY = Math.floor(((maxY - lat) / (maxY - minY)) * height);
      const readY = isFlipped ? height - 1 - tifY : tifY;
      if (readY < 0 || readY >= height) continue;

      const rowOffset = readY * width;
      for (let px = 0; px < width; px++) {
        const i = py * width + px;
        let val = data[rowOffset + px];
        
        if (isForecastYear && forecastAnomaly !== 0) {
          if (val > -99 && val < 99999 && !isNaN(val)) {
            val = val + forecastAnomaly;
          }
        }

        if (val < -99 || val > 99999 || isNaN(val) || (isRainfall && val < 0)) {
          imageData.data[i * 4 + 3] = 0;
          continue;
        }
        const color = getColor(val);
        imageData.data[i * 4] = color[0];
        imageData.data[i * 4 + 1] = color[1];
        imageData.data[i * 4 + 2] = color[2];
        imageData.data[i * 4 + 3] = color[3];
      }
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

    const isAlreadyCropped = config.file.includes("Iraq");

    // Wait for polygon if needed
    if (!isAlreadyCropped && !iraqPolygonRef.current) {
      console.log(`Waiting for Iraq polygon for ${layerKey}...`);
      for (let i = 0; i < 20; i++) {
        if (iraqPolygonRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (!isAlreadyCropped && iraqPolygonRef.current) {
      ctx.save();
      applyIraqClip(ctx, iraqPolygonRef.current, bbox, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }

    const layerData = {
      url: canvas.toDataURL(),
      coordinates: [
        [bbox[0], bbox[3]],
        [bbox[2], bbox[3]],
        [bbox[2], bbox[1]],
        [bbox[0], bbox[1]],
      ] as number[][],
      actual_min: computedMin,
      actual_max: computedMax,
    };

    console.log(
      `[DEBUG] ${layerKey}: isAlreadyCropped=${isAlreadyCropped}, bbox=[${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}], coords=`,
      layerData.coordinates,
      "url length:",
      layerData.url.length,
    );
    setTiffDataCache((prev) => ({ ...prev, [layerKey]: layerData }));
    return layerData;
  };

  const loadMultipleLayers = async (layers: LayerType[]) => {
    setIsLoadingTiff(true);
    setLoadingProgress({ current: 0, total: layers.length });

    const results = await Promise.all(
      layers.map((layer, i) =>
        loadLayer(layer).then((res) => {
          setLoadingProgress({ current: i + 1, total: layers.length });
          return res;
        })
      )
    );

    setIsLoadingTiff(false);
    setTimeout(() => setLoadingProgress(null), 1000);
    return results;
  };

  // Startup loading
  useEffect(() => {
    if (!showSolar) return;

    const init = async () => {
      await loadMultipleLayers(startupLayers);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    init();
  }, [showSolar]);

  // Handle active layer changes
  useEffect(() => {
    if (!showSolar) return;
    if (startupLayers.includes(activeLayer)) return;
    if (activeLayer === "LANDCOVER" || activeLayer === "SOIL" || activeLayer === "ELECTRIC_GRID") return;

    const fetchLayer = async () => {
      setIsLoadingTiff(true);
      await loadLayer(activeLayer);
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };
    fetchLayer();
  }, [activeLayer, showSolar]);

  // Load landcover on demand
  useEffect(() => {
    if (activeCategory !== "LANDCOVER") return;
    if (tiffDataCache["LANDCOVER"]) return;

    const loadLandcover = async () => {
      setIsLoadingTiff(true);
      try {
        const file = `${BASE_PATH}/landcover/Iraq_Landcover_ESA.bin`;
        let response = await fetch(file);

        let rasters, bbox, origWidth, origHeight, isFlipped;

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const { meta, data } = parseBinaryFile(arrayBuffer);
          rasters = [data];
          bbox = meta.bbox;
          origWidth = meta.width;
          origHeight = meta.height;
          isFlipped = meta.isFlipped;
        } else {
          const tifFile = `${BASE_PATH}/landcover/Iraq_Landcover_ESA.tif`;
          response = await fetch(tifFile);
          if (!response.ok) throw new Error("Failed to load landcover bin and tif");
          const arrayBuffer = await response.arrayBuffer();
          const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
          const image = await tiff.getImage();
          rasters = await image.readRasters();
          bbox = image.getBoundingBox();
          origWidth = image.getWidth();
          origHeight = image.getHeight();
          const resolution = image.getResolution();
          isFlipped = resolution && resolution[1] > 0;
        }

        const data = rasters[0] as any;

        const scale = Math.min(2000 / origWidth, 2000 / origHeight, 1);
        const width = Math.floor(origWidth * scale);
        const height = Math.floor(origHeight * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        const imageData = ctx.createImageData(width, height);

        const classColors: Record<number, number[]> = {
          10: [0, 100, 0, 230],
          20: [255, 187, 34, 230],
          30: [255, 255, 76, 230],
          40: [240, 150, 255, 230],
          50: [250, 0, 0, 230],
          60: [180, 180, 180, 230],
          70: [240, 240, 240, 230],
          80: [0, 100, 200, 230],
          90: [0, 150, 160, 230],
          95: [0, 207, 117, 230],
          100: [250, 230, 160, 230],
        };

        const [minX, minY, maxX, maxY] = bbox;
        const mercatorY = (lat: number) =>
          Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
        const minYMerc = mercatorY(minY);
        const maxYMerc = mercatorY(maxY);

        for (let y = 0; y < height; y++) {
          const mercY = maxYMerc - (y / height) * (maxYMerc - minYMerc);
          const lat =
            ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
          const calculatedOrigY = Math.floor(
            ((maxY - lat) / (maxY - minY)) * origHeight,
          );
          const origY = isFlipped
            ? origHeight - 1 - calculatedOrigY
            : calculatedOrigY;
          if (origY < 0 || origY >= origHeight) continue;

          const rowOffset = origY * origWidth;
          for (let x = 0; x < width; x++) {
            const origX = Math.floor(x / scale);
            const idx = rowOffset + origX;
            const val = data[idx];
            const color = classColors[Math.round(val)] || [0, 0, 0, 0];
            const i = (y * width + x) * 4;
            imageData.data[i] = color[0];
            imageData.data[i + 1] = color[1];
            imageData.data[i + 2] = color[2];
            imageData.data[i + 3] = color[3];
          }
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

        if (iraqPolygonRef.current) {
          ctx.save();
          applyIraqClip(ctx, iraqPolygonRef.current, bbox, width, height);
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(tempCanvas, 0, 0);
        }

        setTiffDataCache((prev) => ({
          ...prev,
          ["LANDCOVER"]: {
            url: canvas.toDataURL(),
            coordinates: [
              [minX, maxY],
              [maxX, maxY],
              [maxX, minY],
              [minX, minY],
            ],
          },
        }));

        rasterCacheRef.current = {
          ...rasterCacheRef.current,
          [file]: {
            rasters,
            bbox: [minX, minY, maxX, maxY],
            width: origWidth,
            height: origHeight,
            isFlipped,
          },
        };
        setRasterDataCache((prev: any) => ({
          ...prev,
          [file]: {
            rasters,
            bbox: [minX, minY, maxX, maxY],
            width: origWidth,
            height: origHeight,
            isFlipped,
          },
        }));
      } catch (e) {
        console.error("Failed to load landcover:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadLandcover();
  }, [activeCategory]);

  // Load soil on demand
  useEffect(() => {
    if (activeCategory !== "SOIL") return;
    if (tiffDataCache["SOIL"]) return;

    const loadSoil = async () => {
      setIsLoadingTiff(true);
      try {
        const file = `${BASE_PATH}/soil/Iraq_Soil_Texture_USDA_250m.bin`;
        let response = await fetch(file);

        let rasters, bbox, origWidth, origHeight, isFlipped;

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const { meta, data } = parseBinaryFile(arrayBuffer);
          rasters = [data];
          bbox = meta.bbox;
          origWidth = meta.width;
          origHeight = meta.height;
          isFlipped = meta.isFlipped;
        } else {
          const tifFile = `${BASE_PATH}/soil/Iraq_Soil_Texture_USDA_250m.tif`;
          response = await fetch(tifFile);
          if (!response.ok) throw new Error("Failed to load soil bin and tif");
          const arrayBuffer = await response.arrayBuffer();
          const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
          const image = await tiff.getImage();
          rasters = await image.readRasters();
          bbox = image.getBoundingBox();
          origWidth = image.getWidth();
          origHeight = image.getHeight();
          const resolution = image.getResolution();
          isFlipped = resolution && resolution[1] > 0;
        }

        const data = rasters[0] as any;

        const scale = Math.min(2000 / origWidth, 2000 / origHeight, 1);
        const width = Math.floor(origWidth * scale);
        const height = Math.floor(origHeight * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        const imageData = ctx.createImageData(width, height);

        const classColors: Record<number, number[]> = {
          1: [160, 82, 45, 230],
          2: [205, 92, 92, 230],
          3: [218, 165, 32, 230],
          4: [184, 134, 11, 230],
          5: [237, 201, 175, 230],
          6: [244, 164, 96, 230],
          7: [210, 180, 140, 230],
          8: [139, 69, 19, 230],
          9: [158, 163, 143, 230],
          10: [128, 128, 128, 230],
          11: [85, 107, 47, 230],
          12: [72, 61, 139, 230],
        };

        const [minX, minY, maxX, maxY] = bbox;
        const mercatorY = (lat: number) =>
          Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
        const minYMerc = mercatorY(minY);
        const maxYMerc = mercatorY(maxY);

        for (let y = 0; y < height; y++) {
          const mercY = maxYMerc - (y / height) * (maxYMerc - minYMerc);
          const lat =
            ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
          const calculatedOrigY = Math.floor(
            ((maxY - lat) / (maxY - minY)) * origHeight,
          );
          const origY = isFlipped
            ? origHeight - 1 - calculatedOrigY
            : calculatedOrigY;
          if (origY < 0 || origY >= origHeight) continue;

          const rowOffset = origY * origWidth;
          for (let x = 0; x < width; x++) {
            const origX = Math.floor(x / scale);
            const idx = rowOffset + origX;
            const val = data[idx];
            const color = classColors[Math.round(val)] || [0, 0, 0, 0];
            const i = (y * width + x) * 4;
            imageData.data[i] = color[0];
            imageData.data[i + 1] = color[1];
            imageData.data[i + 2] = color[2];
            imageData.data[i + 3] = color[3];
          }
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

        if (iraqPolygonRef.current) {
          ctx.save();
          applyIraqClip(ctx, iraqPolygonRef.current, bbox, width, height);
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(tempCanvas, 0, 0);
        }

        setTiffDataCache((prev) => ({
          ...prev,
          ["SOIL"]: {
            url: canvas.toDataURL(),
            coordinates: [
              [minX, maxY],
              [maxX, maxY],
              [maxX, minY],
              [minX, minY],
            ],
          },
        }));

        rasterCacheRef.current = {
          ...rasterCacheRef.current,
          [file]: {
            rasters,
            bbox: [minX, minY, maxX, maxY],
            width: origWidth,
            height: origHeight,
            isFlipped,
          },
        };
        setRasterDataCache((prev: any) => ({
          ...prev,
          [file]: {
            rasters,
            bbox: [minX, minY, maxX, maxY],
            width: origWidth,
            height: origHeight,
            isFlipped,
          },
        }));
      } catch (e) {
        console.error("Failed to load soil:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadSoil();
  }, [activeCategory]);

  // Load dust storms on demand
  useEffect(() => {
    if (activeCategory !== "ATMOSPHERIC_DUST") return;
    const layerKey = `DUST_${dustYear}_${dustMonth}` as LayerType;
    if (tiffDataCache[layerKey]) return;

    const loadDust = async () => {
      setIsLoadingTiff(true);
      try {
        const layerData = await loadLayer(layerKey);
        if (layerData) {
          setTiffDataCache((prev) => ({ ...prev, [layerKey]: layerData }));
        }
      } catch (e) {
        console.error("Failed to load dust layer:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadDust();
  }, [activeCategory, dustYear, dustMonth]);

  // Re-render dust when intensity filter changes
  useEffect(() => {
    if (activeCategory !== "ATMOSPHERIC_DUST") return;
    const layerKey = `DUST_${dustYear}_${dustMonth}` as LayerType;
    const config = layerConfigs[layerKey];
    if (!config) return;

    const rasterInfo = rasterDataCache[config.file];
    if (!rasterInfo) return;

    const { rasters, bbox, width, height, isFlipped } = rasterInfo;
    const data = rasters[0] as Float32Array;

    const min = config.min;
    const max = config.max;

    const scale = Math.min(1, 2000 / width, 2000 / height);
    const displayWidth = Math.floor(width * scale);
    const displayHeight = Math.floor(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(displayWidth, displayHeight);

    const parseColor = (c: string) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      return m
        ? [
            parseInt(m[1]),
            parseInt(m[2]),
            parseInt(m[3]),
            parseFloat(m[4]) * 255,
          ]
        : [0, 0, 0, 0];
    };
    const colors = config.colors.map(parseColor);

    const getColor = (val: number) => {
      if (val <= min) return colors[0];
      if (val >= max) return colors[colors.length - 1];
      const t = (val - min) / (max - min);
      const scaledT = t * (colors.length - 1);
      const idx = Math.floor(scaledT);
      const frac = scaledT - idx;
      const c1 = colors[idx];
      const c2 = colors[idx + 1];
      return [
        c1[0] + (c2[0] - c1[0]) * frac,
        c1[1] + (c2[1] - c1[1]) * frac,
        c1[2] + (c2[2] - c1[2]) * frac,
        c1[3] + (c2[3] - c1[3]) * frac,
      ];
    };

    const intensityThresholds: Record<string, { min: number; max: number }> = {
      light: { min: -10, max: 1.0 },
      moderate: { min: 1.0, max: 1.5 },
      heavy: { min: 1.5, max: 2.5 },
      severe: { min: 2.5, max: Infinity },
    };

    const [minX, minY, maxX, maxY] = bbox;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);

    for (let y = 0; y < displayHeight; y++) {
      const mercY = maxYMerc - (y / displayHeight) * (maxYMerc - minYMerc);
      const lat =
        ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
      const tifY = Math.floor(((maxY - lat) / (maxY - minY)) * height);
      const readY = isFlipped ? height - 1 - tifY : tifY;
      if (readY < 0 || readY >= height) continue;

      for (let x = 0; x < displayWidth; x++) {
        const lng = minX + (x / displayWidth) * (maxX - minX);
        const tifX = Math.floor(((lng - minX) / (maxX - minX)) * width);
        if (tifX < 0 || tifX >= width) continue;

        const val = data[readY * width + tifX];
        const i = y * displayWidth + x;

        if (val < -99 || val > 99999 || isNaN(val)) {
          imageData.data[i * 4 + 3] = 0;
          continue;
        }

        if (dustIntensity && dustIntensity !== "all") {
          const threshold = intensityThresholds[dustIntensity];
          if (val < threshold.min || val > threshold.max) {
            imageData.data[i * 4 + 3] = 0;
            continue;
          }
        }

        const color = getColor(val);
        imageData.data[i * 4] = color[0];
        imageData.data[i * 4 + 1] = color[1];
        imageData.data[i * 4 + 2] = color[2];
        imageData.data[i * 4 + 3] = color[3];
      }
    }

    ctx.putImageData(imageData, 0, 0);

    setTiffDataCache((prev) => ({
      ...prev,
      [layerKey]: {
        url: canvas.toDataURL(),
        coordinates: [
          [minX, maxY],
          [maxX, maxY],
          [maxX, minY],
          [minX, minY],
        ],
      },
    }));
  }, [dustIntensity, activeCategory, dustYear, dustMonth]);

  // Load cloud cover on demand
  useEffect(() => {
    if (activeCategory !== "CLOUD_COVER") return;
    const layerKey = `CLOUD_${cloudYear}_${cloudMonth}` as LayerType;
    if (tiffDataCache[layerKey]) return;

    const loadCloud = async () => {
      setIsLoadingTiff(true);
      try {
        const layerData = await loadLayer(layerKey);
        if (layerData) {
          setTiffDataCache((prev) => ({ ...prev, [layerKey]: layerData }));
        }
      } catch (e) {
        console.error("Failed to load cloud layer:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadCloud();
  }, [activeCategory, cloudYear, cloudMonth]);

  // Load night lights on demand
  useEffect(() => {
    if (activeCategory !== "NIGHT_LIGHTS") return;
    if (tiffDataCache["NIGHT_LIGHTS"]) return;

    const loadNightLights = async () => {
      setIsLoadingTiff(true);
      try {
        const layerData = await loadLayer("NIGHT_LIGHTS");
        if (layerData) {
          setTiffDataCache((prev) => ({ ...prev, NIGHT_LIGHTS: layerData }));
        }
      } catch (e) {
        console.error("Failed to load night lights layer:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadNightLights();
  }, [activeCategory]);

  // Load population density on demand
  useEffect(() => {
    if (activeCategory !== "POPULATION") return;
    if (tiffDataCache["POPULATION"]) return;

    const loadPopulation = async () => {
      setIsLoadingTiff(true);
      try {
        const layerData = await loadLayer("POPULATION");
        if (layerData) {
          setTiffDataCache((prev) => ({ ...prev, POPULATION: layerData }));
        }
      } catch (e) {
        console.error("Failed to load population layer:", e);
      }
      setIsLoadingTiff(false);
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    };

    loadPopulation();
  }, [activeCategory]);

  // Auto-switch to dark map when Night Lights, Population, or Electric Grid is selected, revert when deselected
  useEffect(() => {
    if (activeCategory === "NIGHT_LIGHTS" || activeCategory === "POPULATION" || activeCategory === "ELECTRIC_GRID") {
      setMapType("dark");
    } else if (mapType === "dark") {
      setMapType("terrain");
    }
  }, [activeCategory]);

  // Re-render landcover when filter changes
  useEffect(() => {
    if (activeCategory !== "LANDCOVER") return;
    const file = `${BASE_PATH}/landcover/Iraq_Landcover_ESA.bin`;
    const rasterInfo = rasterDataCache[file] || rasterDataCache["LANDCOVER"];
    if (!rasterInfo) return;

    const { rasters, bbox, width, height, isFlipped } = rasterInfo;
    const data = rasters[0] as Uint8Array;

    const scale = Math.min(1, 2000 / width, 2000 / height);
    const displayWidth = Math.floor(width * scale);
    const displayHeight = Math.floor(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(displayWidth, displayHeight);

    const classColors: Record<number, number[]> = {
      10: [0, 100, 0, 230],
      20: [255, 187, 34, 230],
      30: [255, 255, 76, 230],
      40: [240, 150, 255, 230],
      50: [250, 0, 0, 230],
      60: [180, 180, 180, 230],
      70: [240, 240, 240, 230],
      80: [0, 100, 200, 230],
      90: [0, 150, 160, 230],
      95: [0, 207, 117, 230],
      100: [250, 230, 160, 230],
    };

    const [minX, minY, maxX, maxY] = bbox;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);

    for (let y = 0; y < displayHeight; y++) {
      const mercY = maxYMerc - (y / displayHeight) * (maxYMerc - minYMerc);
      const lat =
        ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
      const calculatedOrigY = Math.floor(
        ((maxY - lat) / (maxY - minY)) * height,
      );
      const origY = isFlipped ? height - 1 - calculatedOrigY : calculatedOrigY;
      if (origY < 0 || origY >= height) continue;

      const rowOffset = origY * width;
      for (let x = 0; x < displayWidth; x++) {
        const origX = Math.floor(x / scale);
        const idx = rowOffset + origX;
        const val = data[idx];

        let color;
        const roundedVal = Math.round(val);
        if (
          landCoverClass !== null &&
          Math.abs(roundedVal - landCoverClass) > 1
        ) {
          color = [200, 200, 200, 50];
        } else {
          color = classColors[roundedVal] || [0, 0, 0, 0];
        }

        const i = (y * displayWidth + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
      }
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

    if (iraqPolygonRef.current) {
      ctx.save();
      applyIraqClip(
        ctx,
        iraqPolygonRef.current,
        bbox,
        displayWidth,
        displayHeight,
      );
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }

    setTiffDataCache((prev) => ({
      ...prev,
      ["LANDCOVER"]: {
        url: canvas.toDataURL(),
        coordinates: [
          [bbox[0], bbox[3]],
          [bbox[2], bbox[3]],
          [bbox[2], bbox[1]],
          [bbox[0], bbox[1]],
        ],
      },
    }));
  }, [landCoverClass, activeCategory, rasterDataCache]);

  // Re-render soil when filter changes
  useEffect(() => {
    if (activeCategory !== "SOIL") return;
    const file = `${BASE_PATH}/soil/Iraq_Soil_Texture_USDA_250m.bin`;
    const rasterInfo = rasterDataCache[file] || rasterDataCache["SOIL"];
    if (!rasterInfo) return;

    const { rasters, bbox, width, height, isFlipped } = rasterInfo;
    const data = rasters[0] as Uint8Array;

    const scale = Math.min(1, 2000 / width, 2000 / height);
    const displayWidth = Math.floor(width * scale);
    const displayHeight = Math.floor(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(displayWidth, displayHeight);

    const classColors: Record<number, number[]> = {
      1: [160, 82, 45, 230],
      2: [205, 92, 92, 230],
      3: [218, 165, 32, 230],
      4: [184, 134, 11, 230],
      5: [237, 201, 175, 230],
      6: [244, 164, 96, 230],
      7: [210, 180, 140, 230],
      8: [139, 69, 19, 230],
      9: [158, 163, 143, 230],
      10: [128, 128, 128, 230],
      11: [85, 107, 47, 230],
      12: [72, 61, 139, 230],
    };

    const [minX, minY, maxX, maxY] = bbox;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);

    for (let y = 0; y < displayHeight; y++) {
      const mercY = maxYMerc - (y / displayHeight) * (maxYMerc - minYMerc);
      const lat =
        ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
      const calculatedOrigY = Math.floor(
        ((maxY - lat) / (maxY - minY)) * height,
      );
      const origY = isFlipped ? height - 1 - calculatedOrigY : calculatedOrigY;
      if (origY < 0 || origY >= height) continue;

      const rowOffset = origY * width;
      for (let x = 0; x < displayWidth; x++) {
        const origX = Math.floor(x / scale);
        const idx = rowOffset + origX;
        const val = data[idx];

        let color;
        const roundedVal = Math.round(val);
        if (soilClass !== null && roundedVal !== soilClass) {
          color = [200, 200, 200, 50];
        } else {
          color = classColors[roundedVal] || [0, 0, 0, 0];
        }

        const i = (y * displayWidth + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
      }
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

    if (iraqPolygonRef.current) {
      ctx.save();
      applyIraqClip(
        ctx,
        iraqPolygonRef.current,
        bbox,
        displayWidth,
        displayHeight,
      );
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }

    setTiffDataCache((prev) => ({
      ...prev,
      ["SOIL"]: {
        url: canvas.toDataURL(),
        coordinates: [
          [bbox[0], bbox[3]],
          [bbox[2], bbox[3]],
          [bbox[2], bbox[1]],
          [bbox[0], bbox[1]],
        ],
      },
    }));
  }, [soilClass, activeCategory, rasterDataCache]);

  // Re-render slope when filter changes
  useEffect(() => {
    if (activeCategory !== "SLOPE") return;
    const file = layerConfigs["SLOPE"].file;
    const rasterInfo = rasterDataCache[file];
    if (!rasterInfo) return;

    const { rasters, bbox, width, height, isFlipped } = rasterInfo;
    const data = rasters[0] as Float32Array | Uint16Array;

    const scale = Math.min(1, 2000 / width, 2000 / height);
    const displayWidth = Math.floor(width * scale);
    const displayHeight = Math.floor(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(displayWidth, displayHeight);

    const colors = [
      [210, 180, 140, 180],
      [205, 133, 63, 190],
      [188, 85, 45, 200],
      [178, 34, 34, 210],
      [139, 0, 0, 220],
    ];
    const min = 0;
    const max = 70;

    const getColor = (val: number) => {
      if (val <= min) return colors[0];
      if (val >= max) return colors[colors.length - 1];
      const t = (val - min) / (max - min);
      const scaledT = t * (colors.length - 1);
      const idx = Math.floor(scaledT);
      const frac = scaledT - idx;
      const c1 = colors[idx];
      const c2 = colors[idx + 1];
      return [
        c1[0] + (c2[0] - c1[0]) * frac,
        c1[1] + (c2[1] - c1[1]) * frac,
        c1[2] + (c2[2] - c1[2]) * frac,
        c1[3] + (c2[3] - c1[3]) * frac,
      ];
    };

    const [minX, minY, maxX, maxY] = bbox;
    const mercatorY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
    const minYMerc = mercatorY(minY);
    const maxYMerc = mercatorY(maxY);

    for (let y = 0; y < displayHeight; y++) {
      const mercY = maxYMerc - (y / displayHeight) * (maxYMerc - minYMerc);
      const lat =
        ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
      const calculatedOrigY = Math.floor(
        ((maxY - lat) / (maxY - minY)) * height,
      );
      const origY = isFlipped ? height - 1 - calculatedOrigY : calculatedOrigY;
      if (origY < 0 || origY >= height) continue;

      const rowOffset = origY * width;
      for (let x = 0; x < displayWidth; x++) {
        const origX = Math.floor(x / scale);
        const idx = rowOffset + origX;
        const val = data[idx];

        let color;
        if (val < -99 || isNaN(val)) {
          color = [0, 0, 0, 0];
        } else if (slopeDegree !== null) {
          const getRangeForSlope = (degree: number): [number, number] => {
            switch (degree) {
              case 0:
                return [0, 5];
              case 5:
                return [5, 10];
              case 10:
                return [10, 15];
              case 15:
                return [15, 20];
              case 20:
                return [20, 30];
              case 30:
                return [30, 45];
              case 45:
                return [45, 70];
              default:
                return [0, 70];
            }
          };
          const [minRange, maxRange] = getRangeForSlope(slopeDegree);
          const inRange = val >= minRange && val < maxRange;
          if (!inRange) {
            color = [200, 200, 200, 50];
          } else {
            color = getColor(val);
          }
        } else {
          color = getColor(val);
        }

        const i = (y * displayWidth + x) * 4;
        imageData.data[i] = color[0];
        imageData.data[i + 1] = color[1];
        imageData.data[i + 2] = color[2];
        imageData.data[i + 3] = color[3];
      }
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    tempCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

    if (iraqPolygonRef.current) {
      ctx.save();
      applyIraqClip(
        ctx,
        iraqPolygonRef.current,
        bbox,
        displayWidth,
        displayHeight,
      );
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }

    setTiffDataCache((prev) => ({
      ...prev,
      ["SLOPE"]: {
        url: canvas.toDataURL(),
        coordinates: [
          [bbox[0], bbox[3]],
          [bbox[2], bbox[3]],
          [bbox[2], bbox[1]],
          [bbox[0], bbox[1]],
        ],
      },
    }));
  }, [slopeDegree, activeCategory, rasterDataCache]);

  const handleMoveEnd = () => {
    if (mapRef.current) {
      const b = mapRef.current.getBounds();
      setMapBounds({
        minLng: b.getWest(),
        maxLng: b.getEast(),
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
      });
    }
  };

  const ensureRasterInfo = async (layerKey: LayerType) => {
    const config = layerConfigs[layerKey];
    if (!config) return null;

    let fileDataInfo = rasterCacheRef.current[config.file];
    if (!fileDataInfo && layerKey === "LANDCOVER")
      fileDataInfo = rasterCacheRef.current["LANDCOVER"];
    if (!fileDataInfo && layerKey === "SOIL")
      fileDataInfo = rasterCacheRef.current["SOIL"];

    if (fileDataInfo) return fileDataInfo;

    try {
      const fileUrl = config.file;
      if (!fileUrl.endsWith(".tif") && !fileUrl.endsWith(".bin")) {
        return null;
      }
      const response = await fetch(fileUrl);
      if (!response.ok) return null;

      if (fileUrl.endsWith(".tif")) {
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox();
        const rasters = await image.readRasters();
        const width = image.getWidth();
        const height = image.getHeight();
        const res = image.getResolution();
        const isFlipped = res && res[1] > 0;

        // Calculate actual min/max
        const data = rasters[0] as any;
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (v !== undefined && !isNaN(v) && v > -999 && v < 99999) {
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
        }

        fileDataInfo = {
          rasters,
          bbox,
          width,
          height,
          isFlipped,
          actual_min: minVal,
          actual_max: maxVal,
        };
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const { meta, data: dataArr } = parseBinaryFile(arrayBuffer);

        // Calculate actual min/max if not in meta
        let minVal = meta.actual_min;
        let maxVal = meta.actual_max;
        if (minVal === undefined || maxVal === undefined) {
          minVal = Infinity;
          maxVal = -Infinity;
          for (let i = 0; i < dataArr.length; i++) {
            const v = dataArr[i];
            if (v !== undefined && !isNaN(v) && v > -999 && v < 99999) {
              if (v < minVal) minVal = v;
              if (v > maxVal) maxVal = v;
            }
          }
        }

        fileDataInfo = {
          rasters: [dataArr],
          ...meta,
          actual_min: minVal,
          actual_max: maxVal,
        };
      }

      rasterCacheRef.current[config.file] = fileDataInfo;
      setRasterDataCache((prev) => ({ ...prev, [config.file]: fileDataInfo }));
      // Also update tiffDataCache partially just for the min/max if not already there
      setTiffDataCache((prev) => ({
        ...prev,
        [layerKey]: {
          ...(prev[layerKey] || { url: "", coordinates: [] }),
          actual_min: fileDataInfo.actual_min,
          actual_max: fileDataInfo.actual_max,
        },
      }));
      return fileDataInfo;
    } catch (e) {
      console.error(`Failed to ensure raster info for ${layerKey}:`, e);
      return null;
    }
  };

  const updateLocationData = async (
    lat: number,
    lng: number,
    keys: LayerType[] = CORE_PANEL_LAYERS,
  ) => {
    console.log("[DEBUG] updateLocationData called:", lat, lng, "keys:", keys.length);
    const data: Record<string, number> = {};

    // Ensure forecast data is loaded before computing forecasts
    const needsForecast = keys.some((k) => k.startsWith("TEMP_ABS_2025_"));
    if (needsForecast) {
      await loadForecastData();
    }

    await Promise.all(
      keys.map(async (layerKey) => {
        const fileDataInfo = await ensureRasterInfo(layerKey);
        if (fileDataInfo) {
          const { rasters, bbox, width, height } = fileDataInfo;
          const dataArr = rasters[0] as Float32Array | Uint16Array | Uint8Array;

          const x = Math.floor(((lng - bbox[0]) / (bbox[2] - bbox[0])) * width);
          const y = Math.floor(((bbox[3] - lat) / (bbox[3] - bbox[1])) * height);
          const idx = y * width + x;

          if (
            x >= 0 &&
            x < width &&
            y >= 0 &&
            y < height &&
            !isNaN(x) &&
            !isNaN(y)
          ) {
            const val = dataArr[idx];
            if (val > -999 && val < 99999 && !isNaN(val)) {
              data[layerKey] = val;
            }
          }
        }
      }),
    );

    // Add forecast data based on 2025 baseline and anomalies if temperature layers were requested
    if (keys.some((k) => k.startsWith("TEMP_ABS_2025_"))) {
      for (const year of FORECAST_YEARS) {
        let yearlySum = 0;
        let yearlyCount = 0;
        for (const month of Object.keys(MONTH_MAP)) {
          const layerKey = `TEMP_ABS_${year}_${month}`;
          if (data[layerKey] !== undefined) continue;

          const baseLayerKey = `TEMP_ABS_2025_${month}` as LayerType;
          const baselineVal = data[baseLayerKey];
          if (baselineVal !== undefined) {
            const anomaly = getForecastDelta(year, MONTH_MAP[month]);
            data[layerKey] = baselineVal + anomaly;
            yearlySum += data[layerKey];
            yearlyCount++;
          }
        }
        if (yearlyCount > 0) {
          data[`TEMP_MEAN_${year}`] = yearlySum / yearlyCount;
        }
      }
    }

    // Compute historical min/max from actual raster years (2018–2025)
      const historicalYears = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
      const months = Object.keys(MONTH_MAP);

      let absMin = Infinity;
      let absMax = -Infinity;
      let absMinLabel = "";
      let absMaxLabel = "";

      for (const year of historicalYears) {
        let yearlySum = 0;
        let yearlyCount = 0;
        let yearMin = Infinity;
        let yearMax = -Infinity;
        let yearMinLabel = "";
        let yearMaxLabel = "";

        for (const month of months) {
          const val = data[`TEMP_ABS_${year}_${month}`];
          if (val === undefined) continue;
          
          const monthMax = val;
          const monthMean = monthMax;

          yearlySum += monthMean;
          yearlyCount++;

          if (monthMax < absMin) { absMin = monthMax; absMinLabel = `${month} ${year}`; }
          if (monthMax > absMax) { absMax = monthMax; absMaxLabel = `${month} ${year}`; }

          if (monthMax < yearMin) { yearMin = monthMax; yearMinLabel = month; }
          if (monthMax > yearMax) { yearMax = monthMax; yearMaxLabel = month; }
        }

        if (yearlyCount > 0) {
          data[`TEMP_MEAN_${year}`] = yearlySum / yearlyCount;
        }
        if (yearMin !== Infinity) { data[`TEMP_${year}_MIN`] = yearMin; data[`TEMP_${year}_MIN_LABEL`] = yearMinLabel; }
        if (yearMax !== -Infinity) { data[`TEMP_${year}_MAX`] = yearMax; data[`TEMP_${year}_MAX_LABEL`] = yearMaxLabel; }
      }

      if (absMin !== Infinity) data["TEMP_HIST_MIN"] = absMin;
      if (absMax !== -Infinity) data["TEMP_HIST_MAX"] = absMax;
      data["TEMP_HIST_MIN_LABEL"] = absMinLabel;
      data["TEMP_HIST_MAX_LABEL"] = absMaxLabel;

    console.log("[DEBUG] updateLocationData returning data keys:", Object.keys(data).length);
    return data;
  };

  const handleCityClick = async (city: ZoneSite) => {
    setActiveCity(city);
    setShowCityDetails(true);
    setCityData({});
    mapRef.current?.flyTo({
      center: [city.coordinates[0], city.coordinates[1]],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      duration: 3000,
    });

    const data = await updateLocationData(
      city.coordinates[1],
      city.coordinates[0],
      CORE_PANEL_LAYERS
    );
    setCityData(data);
    // Pre-load temperature and precipitation data for panels
    updateLocationData(city.coordinates[1], city.coordinates[0], PRECIPITATION_PANEL_LAYERS)
      .then(newData => setCityData(prev => ({ ...prev, ...newData })));
    updateLocationData(city.coordinates[1], city.coordinates[0], TEMPERATURE_PANEL_LAYERS)
      .then(newData => setCityData(prev => ({ ...prev, ...newData })));
    console.log("[DEBUG] cityData set:", data);
  };

  const extractLocationData = async (lat: number, lng: number) => {
    console.log("[DEBUG] extractLocationData called:", lat, lng);
    const data = await updateLocationData(lat, lng, CORE_PANEL_LAYERS);
    console.log("[DEBUG] extractLocationData data:", data);
    setShowCityDetails(false);
    setSelectedLocationData({ lat, lng, data });
    updateLocationData(lat, lng, TEMPERATURE_PANEL_LAYERS)
      .then(newData => setSelectedLocationData(prev => prev ? ({ ...prev, data: { ...prev.data, ...newData } }) : null));
  };

  // Fetch extra panel data on demand (City Details)
  useEffect(() => {
    if (showCityRainMonths && activeCity) {
      updateLocationData(activeCity.coordinates[1], activeCity.coordinates[0], PRECIPITATION_PANEL_LAYERS)
        .then(newData => setCityData(prev => ({ ...prev, ...newData })));
    }
  }, [showCityRainMonths, activeCity]);

  useEffect(() => {
    if (showCityTempYears && activeCity) {
      updateLocationData(activeCity.coordinates[1], activeCity.coordinates[0], TEMPERATURE_PANEL_LAYERS)
        .then(newData => setCityData(prev => ({ ...prev, ...newData })));
    }
  }, [showCityTempYears, activeCity]);

  // Fetch extra panel data on demand (Selected Location)
  useEffect(() => {
    if (showAllRainMonths && selectedLocationData) {
      updateLocationData(selectedLocationData.lat, selectedLocationData.lng, PRECIPITATION_PANEL_LAYERS)
        .then(newData => setSelectedLocationData(prev => prev ? ({ ...prev, data: { ...prev.data, ...newData } }) : null));
    }
  }, [showAllRainMonths, selectedLocationData?.lat, selectedLocationData?.lng]);

  useEffect(() => {
    if (showSelectedTempYears && selectedLocationData) {
      updateLocationData(selectedLocationData.lat, selectedLocationData.lng, TEMPERATURE_PANEL_LAYERS)
        .then(newData => setSelectedLocationData(prev => prev ? ({ ...prev, data: { ...prev.data, ...newData } }) : null));
    }
  }, [showSelectedTempYears]);

  const goToDemoStep = (step: number) => {
    const targetStep = Math.max(0, Math.min(5, step));
    setDemoStep(targetStep);

    if (targetStep === 0) {
      // Step 0: Initial MENA view
      mapRef.current?.flyTo({
        center: [35.0, 28.0],
        zoom: 3.5,
        pitch: 0,
        bearing: 0,
        duration: 2500,
      });
      setMapType("terrain");
      setTerrainExaggeration(1);
      setShowSolar(false);
    } else if (targetStep === 1) {
      // Step 1: Iraq view, zoom out more, North-up
      mapRef.current?.flyTo({
        center: [43.5, 34.0],
        zoom: 4.5,
        pitch: 0,
        bearing: 0,
        duration: 2500,
      });
      setMapType("terrain");
      setTerrainExaggeration(1);
      setShowSolar(false);
    } else if (targetStep === 2) {
      // Step 2: Kurdistan Region (borders appear), North-up, zoomed out
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 2500,
      });
      setMapType("terrain");
      setTerrainExaggeration(1);
      setShowSolar(false);
    } else if (targetStep === 3) {
      // Step 3: 3D View, satellite mode, 3x exaggeration, 2D flat view (no tilt)
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 2500,
      });
      setMapType("satellite");
      setTerrainExaggeration(3);
      setShowSolar(false);
    } else if (targetStep === 4) {
      // Step 4: PVOUT Data Layers, keep Kurdistan view
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 2000,
      });
      setShowSolar(true);
      setActiveCategory("PVOUT");
      setActiveMonth("YEARLY");
    } else if (targetStep === 5) {
      // Step 5: Show sites (cities), maintain Kurdistan view
      mapRef.current?.flyTo({
        center: [44.4, 36.0],
        zoom: 6.2,
        pitch: 0,
        bearing: 0,
        duration: 2000,
      });
      setShowCitiesOnly(true);
    }
  };

  const handleNextDemo = () => {
    const next = demoStep >= 5 ? 0 : demoStep + 1;
    goToDemoStep(next);
  };

  const handlePrevDemo = () => {
    const prev = demoStep <= 0 ? 5 : demoStep - 1;
    goToDemoStep(prev);
  };

  const demoStepLabels = ["Tour", "Iraq", "Kurdistan", "3D View", "PVOUT", "Sites"];

  const monthNamesMap: Record<string, string> = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
    "JAN": "Jan",
    "FEB": "Feb",
    "MAR": "Mar",
    "APR": "Apr",
    "MAY": "May",
    "JUN": "Jun",
    "JUL": "Jul",
    "AUG": "Aug",
    "SEP": "Sep",
    "OCT": "Oct",
    "NOV": "Nov",
    "DEC": "Dec",
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden relative z-10">
      {/* Left Panel & Controls */}
      <div className="lg:absolute lg:left-20 lg:top-1/2 lg:-translate-y-1/2 z-20 flex flex-col gap-4 m-4 lg:m-0">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="lg:w-80 w-full lg:max-h-[80vh] bg-white/90 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl p-3 flex flex-col items-center overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
            {onBack && (
              <button
                onClick={onBack}
                className="text-xs text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors gap-2"
              >
                &larr; Back to World View
              </button>
            )}
            {showCitiesOnly ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLocationPickerMode(!locationPickerMode)}
                      className={`p-1.5 rounded-lg shadow-sm transition-all border border-white/60 ${
                        locationPickerMode
                          ? "bg-amber-500 text-white"
                          : "bg-white/50 text-gray-700 hover:bg-white/80"
                      }`}
                      title="Select location on map"
                    >
                      <Crosshair size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        setIsLoadingAllData(true);
                        setLoadAllProgress({
                          current: 0,
                          total: Object.keys(layerConfigs).filter(
                            (k) =>
                              !k.startsWith("PVOUT_") &&
                              !k.startsWith("CHIRPS_") &&
                              !k.startsWith("TEMP_ABS_") &&
                              k !== "LANDCOVER" &&
                              k !== "SOIL",
                          ).length,
                        });
                        const files = Object.keys(layerConfigs).filter(
                          (k) =>
                            !k.startsWith("PVOUT_") &&
                            !k.startsWith("CHIRPS_") &&
                            !k.startsWith("TEMP_ABS_") &&
                            k !== "LANDCOVER" &&
                            k !== "SOIL",
                        );
                        let count = 0;
                        for (const file of files) {
                          const config = layerConfigs[file as LayerType];
                          if (!rasterCacheRef.current[config.file]) {
                            try {
                              const binFile = config.file.replace(
                                ".bin",
                                ".bin",
                              );
                              const response = await fetch(binFile);
                              if (response.ok) {
                                const arrayBuffer =
                                  await response.arrayBuffer();
                                const { meta, data } = parseBinaryFile(arrayBuffer);
                                rasterCacheRef.current[config.file] = {
                                  rasters: [data],
                                  ...meta,
                                };
                              }
                            } catch (e) {}
                          }
                          count++;
                          setLoadAllProgress({
                            current: count,
                            total: files.length,
                          });
                        }
                        setIsLoadingAllData(false);
                        setTimeout(() => setLoadAllProgress(null), 1000);
                      }}
                      disabled={isLoadingAllData}
                      className={`p-2 rounded-lg shadow-sm transition-all border border-white/60 ${
                        isLoadingAllData
                          ? "bg-amber-100 text-amber-600"
                          : "bg-white/50 text-gray-700 hover:bg-white/80"
                      }`}
                      title="Load all data"
                    >
                      {isLoadingAllData ? (
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Database size={16} />
                      )}
                    </button>
                    <div className="flex bg-white/50 rounded-lg p-0.5 border border-white/60 shadow-sm overflow-hidden">
                      <button
                        onClick={handlePrevDemo}
                        className="p-1.5 hover:bg-white/80 transition-colors text-gray-700 border-r border-white/60"
                        title="Previous Step"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={handleNextDemo}
                        className={`px-2 py-1 flex items-center gap-1 text-[9px] font-bold transition-all ${
                          demoStep > 0
                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                            : "hover:bg-white/80 text-gray-700"
                        }`}
                        title={demoStep > 0 ? demoStepLabels[demoStep] : "Start Tour"}
                      >
                        {demoStep === 0 ? (
                          <Play size={10} fill="currentColor" />
                        ) : (
                          <span>{demoStep}/5</span>
                        )}
                        <span className="max-w-[60px] truncate">
                          {demoStepLabels[demoStep]}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  {loadAllProgress && (
                    <div className="text-xs text-amber-600 font-medium">
                      {Math.round(
                        (loadAllProgress.current / loadAllProgress.total) * 100,
                      )}
                      %
                    </div>
                  )}
                  <button
                    onClick={() => setShowCitiesOnly(false)}
                    className="p-1.5 rounded-lg bg-white/50 hover:bg-white/80 transition-colors border border-white/60"
                    title="Show Config"
                  >
                    <List className="text-emerald-600" size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {mountainCities.map((city, index) => (
                    <div
                      key={index}
                      onClick={() => handleCityClick(city)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all duration-300 ${
                        activeCity?.name === city.name
                          ? "bg-white/80 border-emerald-500 shadow-lg shadow-emerald-500/20"
                          : "bg-white/40 border-white/60 hover:bg-white/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin
                          className={
                            activeCity?.name === city.name
                              ? "text-emerald-600"
                              : "text-gray-500"
                          }
                          size={14}
                        />
                        <h3 className="text-xs font-bold text-gray-900">
                          {city.name}
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLocationPickerMode(!locationPickerMode)}
                      className={`p-1.5 rounded-lg shadow-sm transition-all border border-white/60 ${
                        locationPickerMode
                          ? "bg-amber-500 text-white"
                          : "bg-white/50 text-gray-700 hover:bg-white/80"
                      }`}
                      title="Select location on map"
                    >
                      <Crosshair size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        setIsLoadingAllData(true);
                        setLoadAllProgress({
                          current: 0,
                          total: Object.keys(layerConfigs).filter(
                            (k) =>
                              !k.startsWith("PVOUT_") &&
                              !k.startsWith("CHIRPS_") &&
                              !k.startsWith("TEMP_ABS_") &&
                              k !== "LANDCOVER" &&
                              k !== "SOIL",
                          ).length,
                        });
                        const files = Object.keys(layerConfigs).filter(
                          (k) =>
                            !k.startsWith("PVOUT_") &&
                            !k.startsWith("CHIRPS_") &&
                            !k.startsWith("TEMP_ABS_") &&
                            k !== "LANDCOVER" &&
                            k !== "SOIL",
                        );
                        let count = 0;
                        for (const file of files) {
                          const config = layerConfigs[file as LayerType];
                          if (!rasterCacheRef.current[config.file]) {
                            try {
                              const binFile = config.file.replace(
                                ".bin",
                                ".bin",
                              );
                              const response = await fetch(binFile);
                              if (response.ok) {
                                const arrayBuffer =
                                  await response.arrayBuffer();
                                const { meta, data } = parseBinaryFile(arrayBuffer);
                                rasterCacheRef.current[config.file] = {
                                  rasters: [data],
                                  ...meta,
                                };
                              }
                            } catch (e) {}
                          }
                          count++;
                          setLoadAllProgress({
                            current: count,
                            total: files.length,
                          });
                        }
                        setIsLoadingAllData(false);
                        setTimeout(() => setLoadAllProgress(null), 1000);
                      }}
                      disabled={isLoadingAllData}
                      className={`p-2 rounded-lg shadow-sm transition-all border border-white/60 ${
                        isLoadingAllData
                          ? "bg-amber-100 text-amber-600"
                          : "bg-white/50 text-gray-700 hover:bg-white/80"
                      }`}
                      title="Load all data"
                    >
                      {isLoadingAllData ? (
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Database size={16} />
                      )}
                    </button>
                    <div className="flex bg-white/50 rounded-lg p-0.5 border border-white/60 shadow-sm overflow-hidden">
                      <button
                        onClick={handlePrevDemo}
                        className="p-1.5 hover:bg-white/80 transition-colors text-gray-700 border-r border-white/60"
                        title="Previous Step"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={handleNextDemo}
                        className={`px-2 py-1 flex items-center gap-1 text-[9px] font-bold transition-all ${
                          demoStep > 0
                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                            : "hover:bg-white/80 text-gray-700"
                        }`}
                        title={demoStep > 0 ? demoStepLabels[demoStep] : "Start Tour"}
                      >
                        {demoStep === 0 ? (
                          <Play size={10} fill="currentColor" />
                        ) : (
                          <span>{demoStep}/5</span>
                        )}
                        <span className="max-w-[60px] truncate">
                          {demoStepLabels[demoStep]}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  {loadAllProgress && (
                    <div className="text-xs text-amber-600 font-medium">
                      {Math.round(
                        (loadAllProgress.current / loadAllProgress.total) * 100,
                      )}
                      %
                    </div>
                  )}
                  <button
                    onClick={() => setShowCitiesOnly(true)}
                    className="p-1.5 rounded-lg bg-white/50 hover:bg-white/80 transition-colors border border-white/60"
                    title="Show Cities List"
                  >
                    <List className="text-emerald-600" size={18} />
                  </button>
                </div>

                <div className="mb-2 p-2 bg-white/50 rounded-xl border border-white/60 shadow-sm">
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-white/70 transition-colors rounded-lg p-2 -m-2"
                    onClick={() => demoStep !== 0 && setShowSolar(!showSolar)}
                  >
                    <div className="flex items-center gap-3">
                      <Sun
                        className={`size-5 ${showSolar ? "text-amber-500" : "text-gray-500"}`}
                      />
                      <span className="text-[10px] font-bold text-gray-900">
                      </span>
                    </div>
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showSolar ? "bg-amber-500" : "bg-gray-300"} ${demoStep === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSolar ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                      Base Map
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setMapType("satellite")}
                        className={`py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
                          mapType === "satellite"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Satellite
                      </button>
                      <button
                        onClick={() => setMapType("terrain")}
                        className={`py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
                          mapType === "terrain"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Terrain
                      </button>
                      <button
                        onClick={() => setMapType("dark")}
                        className={`py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
                          mapType === "dark"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                        <Mountain size={14} /> Terrain Exaggeration
                      </label>
                      <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        {terrainExaggeration.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={terrainExaggeration}
                      onChange={(e) =>
                        setTerrainExaggeration(parseFloat(e.target.value))
                      }
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>Realistic (1x)</span>
                      <span>Dramatic (4x)</span>
                    </div>
                  </div>

                  {showSolar && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {loadingProgress &&
                        loadingProgress.current < loadingProgress.total && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-xs text-amber-600 font-medium mb-1">
                              <span className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />{" "}
                                Loading data...
                              </span>
                              <span>
                                {loadingProgress.current}/
                                {loadingProgress.total}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      {isLoadingTiff && !loadingProgress && (
                        <div className="mb-4 flex items-center gap-2 text-xs text-amber-600 font-medium">
                          <Loader2 size={14} className="animate-spin" /> Loading
                          data...
                        </div>
                      )}
                      {tiffError && (
                        <div className="mb-4 flex items-start gap-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded-md border border-red-100">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{tiffError}</span>
                        </div>
                      )}

                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Layers size={14} /> Select Data Layer
                      </label>
                      <select
                        value={activeCategory}
                        onChange={(e) => {
                          const newCat = e.target.value as CategoryType;
                          if (newCat === "PRECIPITATION" || newCat === "AIR_TEMP_ABS") {
                            setActiveMonth("JAN");
                            if (newCat === "PRECIPITATION") setPrecipitationYear(2025);
                            if (newCat === "AIR_TEMP_ABS") setTempAbsYear(2025);
                          }
                          setActiveCategory(newCat);
                          setShowSolar(true); // Force showSolar to true when a category is explicitly selected
                        }}
                        className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-1.5 shadow-sm"
                      >
                        {Object.entries(categories).map(([key, name]) => (
                          <option key={key} value={key}>
                            {name}
                          </option>
                        ))}
                      </select>

                      {activeCategory === "PVOUT" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Time Period
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            <button
                              onClick={() => setActiveMonth("YEARLY")}
                              className={`col-span-4 py-1.5 text-xs font-bold rounded-md border transition-colors ${activeMonth === "YEARLY" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                            >
                              Yearly Average
                            </button>
                            {[
                              "JAN",
                              "FEB",
                              "MAR",
                              "APR",
                              "MAY",
                              "JUN",
                              "JUL",
                              "AUG",
                              "SEP",
                              "OCT",
                              "NOV",
                              "DEC",
                            ].map((month) => (
                              <button
                                key={month}
                                onClick={() => setActiveMonth(month)}
                                className={`text-[10px] font-bold rounded-md border transition-colors ${activeMonth === month ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                              >
                                {monthNamesMap[month]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCategory === "PRECIPITATION" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Year
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
                              2026,
                            ].map((year) => (
                              <button
                                key={year}
                                onClick={() => {
                                  setPrecipitationYear(year);
                                  if (year >= 2025) {
                                    setActiveMonth("JAN");
                                  } else {
                                    setActiveMonth("YEARLY");
                                  }
                                }}
                                className={`text-[10px] font-bold rounded-md border transition-colors ${precipitationYear === year ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                              >
                                {year}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCategory === "AIR_TEMP_ABS" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Year
                          </label>
                          <select
                            value={tempAbsYear ?? 2018}
                            onChange={(e) => setTempAbsYear(Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs font-bold rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, ...FORECAST_YEARS].map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block mt-3">
                            Month
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((month) => (
                              <button
                                key={month}
                                onClick={() => setActiveMonth(month)}
                                className={`text-[10px] font-bold rounded-md border transition-colors ${activeMonth === month ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                              >
                                {monthNamesMap[month]}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                              Air Temperature {tempAbsYear}
                            </label>
                            {tiffDataCache[activeLayer]?.actual_min !==
                              undefined && (
                              <div className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                {tiffDataCache[activeLayer].actual_min.toFixed(
                                  1,
                                )}
                                °C to{" "}
                                {tiffDataCache[activeLayer].actual_max.toFixed(
                                  1,
                                )}
                                °C
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {precipitationYear !== null &&
                        precipitationYear >= 2025 &&
                        activeCategory === "PRECIPITATION" && (
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                              Month ({precipitationYear})
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                "JAN",
                                "FEB",
                                "MAR",
                                "APR",
                                "MAY",
                                "JUN",
                                "JUL",
                                "AUG",
                                "SEP",
                                "OCT",
                                "NOV",
                                "DEC",
                              ]
                                .filter(
                                  (m) =>
                                    precipitationYear === 2025 ||
                                    m === "JAN" ||
                                    m === "FEB",
                                )
                                .map((month) => (
                                  <button
                                    key={month}
                                    onClick={() => setActiveMonth(month)}
                                    className={`text-[10px] font-bold rounded-md border transition-colors ${activeMonth === month ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                  >
                                    {monthNamesMap[month]}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                      {activeCategory === "ATMOSPHERIC_DUST" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Year ({dustYear})
                          </label>
                          <select
                            value={dustYear}
                            onChange={(e) =>
                              setDustYear(Number(e.target.value))
                            }
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-1.5 mb-2 shadow-sm"
                          >
                            <option value={2020}>2020</option>
                            <option value={2021}>2021</option>
                            <option value={2022}>2022</option>
                            <option value={2023}>2023</option>
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                          </select>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Month
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              "01",
                              "02",
                              "03",
                              "04",
                              "05",
                              "06",
                              "07",
                              "08",
                              "09",
                              "10",
                              "11",
                              "12",
                            ].map((month) => (
                              <button
                                key={month}
                                onClick={() => setDustMonth(month)}
                                className={`text-[10px] font-bold rounded-md border transition-colors ${
                                  dustMonth === month
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                {monthNamesMap[month]}
                              </button>
                            ))}
                          </div>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block mt-3">
                            Filter by Intensity
                          </label>
                          <select
                            value={
                              dustIntensity === null ? "all" : dustIntensity
                            }
                            onChange={(e) =>
                              setDustIntensity(
                                e.target.value === "all"
                                  ? null
                                  : e.target.value,
                              )
                            }
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-1.5 shadow-sm"
                          >
                            <option value="all">All Intensities</option>
                            <option value="light">Light (0 - 1.0)</option>
                            <option value="moderate">
                              Moderate (1.0 - 1.5)
                            </option>
                            <option value="heavy">Heavy (1.5 - 2.5)</option>
                            <option value="severe">Severe (2.5+)</option>
                          </select>
                        </div>
                      )}

                      {activeCategory === "CLOUD_COVER" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Year ({cloudYear})
                          </label>
                          <select
                            value={cloudYear}
                            onChange={(e) => {
                              setCloudYear(Number(e.target.value));
                              if (Number(e.target.value) === 2026 && parseInt(cloudMonth) > 4) {
                                setCloudMonth("04");
                              }
                            }}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 mb-2 shadow-sm"
                          >
                            <option value={2020}>2020</option>
                            <option value={2021}>2021</option>
                            <option value={2022}>2022</option>
                            <option value={2023}>2023</option>
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                          </select>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Month
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {(cloudYear === 2026
                              ? ["01", "02", "03", "04"]
                              : [
                                  "01",
                                  "02",
                                  "03",
                                  "04",
                                  "05",
                                  "06",
                                  "07",
                                  "08",
                                  "09",
                                  "10",
                                  "11",
                                  "12",
                                ]
).map((month) => (
                              <button
                                key={month}
                                onClick={() => setCloudMonth(month)}
                                className={`text-[10px] font-bold rounded-md border transition-colors ${cloudMonth === month ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                              >
                                {monthNamesMap[month]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCategory === "LANDCOVER" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Filter by Class
                          </label>
                          <select
                            value={
                              landCoverClass === null ? "all" : landCoverClass
                            }
                            onChange={(e) =>
                              setLandCoverClass(
                                e.target.value === "all"
                                  ? null
                                  : parseInt(e.target.value),
                              )
                            }
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-green-500 focus:border-green-500 block p-1.5 shadow-sm"
                          >
<option value="all">All Classes</option>
                            <option value="10">Tree Cover</option>
                            <option value="20">Shrubland</option>
                            <option value="30">Grassland</option>
                            <option value="40">Cropland</option>
                            <option value="50">Built-up</option>
                            <option value="60">Bare/Sparse</option>
                            <option value="70">Snow/Ice</option>
                            <option value="80">Water</option>
                            <option value="90">Wetland</option>
                            <option value="95">Mangroves</option>
                            <option value="100">Moss/Lichen</option>
                          </select>
                          <div className="mt-2 flex flex-wrap gap-1 justify-center">
                            {[
                              { val: 10, color: "#006400" },
                              { val: 20, color: "#FFBB22" },
                              { val: 30, color: "#FFFF4C" },
                              { val: 40, color: "#F096FF" },
                              { val: 50, color: "#FA0000" },
                              { val: 60, color: "#B4B4B4" },
                              { val: 70, color: "#F0F0F0" },
                              { val: 80, color: "#0064C8" },
                              { val: 90, color: "#0096A0" },
                              { val: 95, color: "#00CF75" },
                              { val: 100, color: "#FAE6A0" },
                            ].map((c) => (
                              <button
                                key={c.val}
                                onClick={() =>
                                  setLandCoverClass(
                                    landCoverClass === c.val ? null : c.val,
                                  )
                                }
                                className={`w-5 h-5 rounded cursor-pointer transition-transform hover:scale-110 ${landCoverClass === c.val ? "ring-2 ring-offset-1 ring-emerald-500" : ""}`}
                                style={{
                                  backgroundColor: c.color,
                                }}
                                title={
                                  c.val === 10 ? "Tree Cover" :
                                  c.val === 20 ? "Shrubland" :
                                  c.val === 30 ? "Grassland" :
                                  c.val === 40 ? "Cropland" :
                                  c.val === 50 ? "Built-up" :
                                  c.val === 60 ? "Bare/Sparse" :
                                  c.val === 70 ? "Snow/Ice" :
                                  c.val === 80 ? "Water" :
                                  c.val === 90 ? "Wetland" :
                                  c.val === 95 ? "Mangroves" :
                                  c.val === 100 ? "Moss/Lichen" :
                                  "Class " + c.val
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCategory === "SOIL" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Filter by Class
                          </label>
                          <select
                            value={soilClass === null ? "all" : soilClass}
                            onChange={(e) =>
                              setSoilClass(
                                e.target.value === "all"
                                  ? null
                                  : parseInt(e.target.value),
                              )
                            }
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-green-500 focus:border-green-500 block p-1.5 shadow-sm"
                          >
                            <option value="all">All Classes</option>
                            <option value="1">Clay</option>
                            <option value="2">Sandy Clay</option>
                            <option value="3">Silty Clay</option>
                            <option value="4">Clay Loam</option>
                            <option value="5">Sand</option>
                            <option value="6">Loamy Sand</option>
                            <option value="7">Sandy Loam</option>
                            <option value="8">Loam</option>
                            <option value="9">Silt Loam</option>
                            <option value="10">Silt</option>
                            <option value="11">Silty Clay Loam</option>
                            <option value="12">Sandy Clay Loam</option>
                          </select>
                          <div className="mt-2 flex flex-wrap gap-1 justify-center">
                            {[
                              { val: 1, color: "#A0522D" },
                              { val: 2, color: "#CD5C5C" },
                              { val: 3, color: "#DAA520" },
                              { val: 4, color: "#B8860B" },
                              { val: 5, color: "#EDCFBF" },
                              { val: 6, color: "#F4A460" },
                              { val: 7, color: "#D2B48C" },
                              { val: 8, color: "#8B4513" },
                              { val: 9, color: "#9EA38F" },
                              { val: 10, color: "#808080" },
                              { val: 11, color: "#556B2F" },
                              { val: 12, color: "#483D8B" },
                            ].map((c) => (
                              <button
                                key={c.val}
                                onClick={() =>
                                  setSoilClass(
                                    soilClass === c.val ? null : c.val,
                                  )
                                }
                                className={`w-5 h-5 rounded cursor-pointer transition-transform hover:scale-110 ${soilClass === c.val ? "ring-2 ring-offset-1 ring-emerald-500" : ""}`}
                                style={{ backgroundColor: c.color }}
                                title={
                                  [
                                    "Clay",
                                    "Sandy Clay",
                                    "Silty Clay",
                                    "Clay Loam",
                                    "Sand",
                                    "Loamy Sand",
                                    "Sandy Loam",
                                    "Loam",
                                    "Silt Loam",
                                    "Silt",
                                    "Silty Clay Loam",
                                    "Sandy Clay Loam",
                                  ][c.val - 1]
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCategory === "SLOPE" && (
                        <div className="mt-3">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                            Filter by Slope Degree
                          </label>
                          <select
                            value={slopeDegree === null ? "all" : slopeDegree}
                            onChange={(e) =>
                              setSlopeDegree(
                                e.target.value === "all"
                                  ? null
                                  : parseInt(e.target.value),
                              )
                            }
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-green-500 focus:border-green-500 block p-1.5 shadow-sm"
                          >
                            <option value="all">All Degrees</option>
                            <option value="0">0° - 5° (Flat)</option>
                            <option value="5">5° - 10° (Gentle)</option>
                            <option value="10">10° - 15° (Moderate)</option>
                            <option value="15">15° - 20° (Steep)</option>
                            <option value="20">20° - 30° (Very Steep)</option>
                            <option value="30">30° - 45° (Extreme)</option>
                            <option value="45">45° - 70° (Severe)</option>
                          </select>
                        </div>
                      )}

                      {activeCategory === "ELECTRIC_GRID" && (
                        <div className="mt-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                          <label className="text-[10px] font-bold text-amber-900/60 uppercase tracking-widest mb-3 block">
                            Grid Filtration
                          </label>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              onClick={() => setShow400kv(!show400kv)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                show400kv
                                  ? "bg-amber-700 text-white border-amber-800 shadow-sm"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-amber-300"
                              }`}
                            >
                              <span>400 kV</span>
                              <div className={`w-2 h-2 rounded-full ${show400kv ? "bg-amber-200 animate-pulse" : "bg-gray-300"}`} />
                            </button>
                            <button
                              onClick={() => setShow132kv(!show132kv)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                show132kv
                                  ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"
                              }`}
                            >
                              <span>132 kV</span>
                              <div className={`w-2 h-2 rounded-full ${show132kv ? "bg-white animate-pulse" : "bg-gray-300"}`} />
                            </button>
                          </div>
                        </div>
                      )}

                      {(layerConfigs[activeLayer] || (activeCategory === "AIR_TEMP_ABS" && layerConfigs[`TEMP_ABS_2025_${activeMonth}` as LayerType])) &&
                        activeCategory !== "ATMOSPHERIC_DUST" && activeCategory !== "LANDCOVER" && activeCategory !== "SOIL" && activeCategory !== "ELECTRIC_GRID" && (
                          <>
                            {(() => {
                              const config = layerConfigs[activeLayer] || layerConfigs[`TEMP_ABS_2025_${activeMonth}` as LayerType];
                              return (
                                <>
                                  <div className="mt-2 flex justify-between text-[10px] text-gray-500 font-mono">
                                    <span>
                                      {config.min} {config.unit}
                                    </span>
                                    <span>
                                      {config.max} {config.unit}
                                    </span>
                                  </div>
                                  <div
                                    className="w-full h-2 rounded-full mt-1"
                                    style={{
                                      background: `linear-gradient(to right, ${config.colors.join(", ")})`,
                                    }}
                                  />
                                </>
                              );
                            })()}
                          </>
                        )}

                      {activeCategory === "ATMOSPHERIC_DUST" && (
                        <React.Fragment></React.Fragment>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={onNext}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
                >
                  Explore Sites <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Map */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        className="w-full h-full relative bg-gray-900"
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 35.0,
            latitude: 28.0,
            zoom: 3.8,
            pitch: 0,
            bearing: 0,
          }}
          mapStyle={mapStyle as any}
          style={{ width: "100%", height: "100%" }}
          maxPitch={85}
          onMoveEnd={handleMoveEnd}
          onLoad={handleMoveEnd}
          onClick={(e) => {
            if (locationPickerMode && e.lngLat) {
              const { lng, lat } = e.lngLat;
              extractLocationData(lat, lng);
            }
          }}
          cursor={locationPickerMode ? "crosshair" : "grab"}
        >
          <NavigationControl position="top-right" />

          {locationPickerMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg z-10 flex items-center gap-2">
              <Crosshair size={18} />
              <span className="text-xs font-medium">
                Click on map to select location
              </span>
              <button
                onClick={() => setLocationPickerMode(false)}
                className="ml-2 hover:bg-amber-600 rounded px-2"
              >
                ✕
              </button>
            </div>
          )}

          {showSolar && tiffDataCache[activeLayer]?.coordinates?.length === 4 && (
            <>
              <Source
                id="solar-geotiff-source"
                type="image"
                url={tiffDataCache[activeLayer].url}
                coordinates={tiffDataCache[activeLayer].coordinates as any}
              >
                <Layer
                  id="solar-geotiff-layer"
                  type="raster"
                  beforeId="kurdistan-region-line"
                  paint={{
                    "raster-opacity": 0.95,
                    "raster-fade-duration": 300,
                  }}
                />
              </Source>
            </>
          )}

          {activeCategory === "ELECTRIC_GRID" && (
            <>
              <Source
                id="electric-grid"
                type="geojson"
                data={`${BASE_PATH}/electric-network-iraq.geojson`}
              >
                <Layer
                  id="electric-grid-lines-400"
                  type="line"
                  filter={["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "transmissionPower"], 400]]}
                  layout={{
                    visibility: show400kv ? "visible" : "none"
                  }}
                  paint={{
                    "line-color": "#8B4513",
                    "line-width": 4,
                    "line-opacity": 0.9,
                  }}
                />
                <Layer
                  id="electric-grid-lines-other"
                  type="line"
                  filter={["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "transmissionPower"], 400]]}
                  paint={{
                    "line-color": "#999999",
                    "line-width": 4,
                    "line-opacity": 0.5,
                  }}
                />
                <Layer
                  id="electric-grid-nodes-all"
                  type="circle"
                  filter={["==", ["geometry-type"], "Point"]}
                  paint={{
                    "circle-color": "#888888",
                    "circle-radius": 4,
                    "circle-opacity": 0.9,
                  }}
                />
              </Source>

              <Source
                id="electric-grid-132"
                type="geojson"
                data={`${BASE_PATH}/kurdistan_132kv.geojson`}
              >
                <Layer
                  id="electric-grid-lines-132"
                  type="line"
                  layout={{
                    visibility: show132kv ? "visible" : "none"
                  }}
                  paint={{
                    "line-color": "#FFA500",
                    "line-width": 2.5,
                    "line-opacity": 0.9,
                  }}
                />
              </Source>
            </>
          )}

          <Source
            id="kurdistan-region"
            type="geojson"
            data={`${BASE_PATH}/sites/Kurdistan Region-Governorates.geojson`}
          >
            <Layer
              id="kurdistan-region-line"
              type="line"
              paint={{
                "line-color": mapType === "dark" ? "#FFFFFF" : "#000000",
                "line-width": 2.5,
                "line-opacity": demoStep >= 2 ? 1 : 0,
              }}
            />
            <Layer
              id="governorate-labels"
              type="symbol"
              layout={{
                "text-field": ["get", "name_en"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 12,
              }}
              paint={{
                "text-color": "#ffffff",
                "text-halo-color": mapType === "dark" ? "#000000" : "#000000",
                "text-halo-width": 1,
                "text-opacity": demoStep >= 2 ? 1 : 0,
              }}
            />
          </Source>

          {demoStep >= 5 && mountainCities.map((city, i) => (
            <Marker
              key={i}
              longitude={city.coordinates[0]}
              latitude={city.coordinates[1]}
              anchor="bottom"
            >
              <div
                className="flex flex-col items-center cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCityClick(city);
                }}
              >
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold mb-1 shadow-lg transition-colors ${
                    activeCity?.name === city.name
                      ? "bg-emerald-500 text-white"
                      : "bg-white/80 text-gray-900 group-hover:bg-white"
                  }`}
                >
                  {city.name}
                </div>
                <MapPin
                  size={32}
                  className={`drop-shadow-lg transition-colors ${
                    activeCity?.name === city.name
                      ? "text-emerald-500"
                      : "text-white group-hover:text-emerald-400"
                  }`}
                  fill={
                    activeCity?.name === city.name ? "currentColor" : "none"
                  }
                />
              </div>
            </Marker>
          ))}
        </Map>

        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />

        {/* ✅ City Details Panel — independent conditional */}
        {showCityDetails && (
          <div className="lg:w-80 w-full lg:h-auto lg:absolute lg:right-4 lg:top-12 lg:bottom-12 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl p-4 z-50 max-h-[80vh] overflow-y-auto m-4 lg:m-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-900">
                {activeCity?.name}
              </h3>
              <button
                onClick={() => setShowCityDetails(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
                {Object.keys(layerConfigs)
                .filter(
                  (k) =>
                    k === "PVOUT_YEARLY" ||
                    k === "GHI" ||
                    k === "DNI" ||
                    k === "GTI" ||
                    k === "DIF" ||
                    k === "OPTA" ||
                    k === "ELEVATION" ||
                    k === "SLOPE" ||
                    k === "POPULATION",
                )
                .map((layerKey) => {
                  const config = layerConfigs[layerKey as LayerType];
                  const value = cityData[layerKey];

                  return (
                    <div key={layerKey} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {config.shortName}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">
                          {value !== undefined ? value.toFixed(2) : "--"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {config.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Yearly Rainfall */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <button
                  onClick={() => setShowCityRainMonths(!showCityRainMonths)}
                  className="w-full flex justify-between items-center"
                >
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    Precipitation
                  </span>
                  <span className="text-sm text-blue-600">
                    {showCityRainMonths ? "▲" : "▼"}
                  </span>
                </button>
                {showCityRainMonths && (
                  <div className="mt-3 space-y-1.5">
                    {/* Yearly precipitation data */}
                    {[
                      "CHIRPS_2018",
                      "CHIRPS_2019",
                      "CHIRPS_2020",
                      "CHIRPS_2021",
                      "CHIRPS_2022",
                      "CHIRPS_2023",
                      "CHIRPS_2024",
                    ].map((layerKey) => {
                      const value = cityData[layerKey];
                      const year = layerKey.replace("CHIRPS_", "");
                      return (
                        <div
                          key={layerKey}
                          className="flex justify-between items-center py-1.5 border-b border-blue-100 last:border-0"
                        >
                          <span className="text-sm text-gray-600">{year}</span>
                          <span className="text-sm font-bold text-gray-900">
                            {value !== undefined
                              ? `${value.toFixed(1)} mm`
                              : "--"}
                          </span>
                        </div>
                      );
                    })}
                    {/* 2025 Total (calculated from monthly data) */}
                    {(() => {
                      const months2025 = [
                        "JAN",
                        "FEB",
                        "MAR",
                        "APR",
                        "MAY",
                        "JUN",
                        "JUL",
                        "AUG",
                        "SEP",
                        "OCT",
                        "NOV",
                        "DEC",
                      ];
                      const values2025 = months2025
                        .map((m) => cityData[`CHIRPS_2025_${m}`])
                        .filter((v) => v !== undefined);
                      const total2025 =
                        values2025.length > 0
                          ? values2025.reduce((a, b) => a + b, 0)
                          : undefined;
                      return (
                        <div className="flex justify-between items-center py-1 border-b border-blue-200 last:border-0 bg-blue-100/50 -mx-2 px-2 rounded">
                          <span className="text-xs font-bold text-blue-700">
                            2025
                          </span>
                          <span className="text-xs font-bold text-blue-700">
                            {total2025 !== undefined
                              ? `${total2025.toFixed(1)} mm`
                              : "--"}
                          </span>
                        </div>
                      );
})()}
                  </div>
                )}
              </div>

              {/* Temperature History - Average Monthly Temperature */}
              <div className="p-2 bg-orange-50 rounded-lg">
                <button
                  onClick={() => setShowCityTempYears(!showCityTempYears)}
                  className="w-full flex justify-between items-center"
                >
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Temperature (Average)
                  </span>
                  <span className="text-xs text-orange-600">
                    {showCityTempYears ? "▲" : "▼"}
                  </span>
                </button>
                {showCityTempYears && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center py-1 border-b border-orange-100">
                      <span className="text-xs text-gray-600">Historical Min (Average)</span>
                      <span className="text-xs font-bold text-gray-900">
                        {cityData["TEMP_HIST_MIN"] !== undefined
                          ? `${cityData["TEMP_HIST_MIN"].toFixed(1)}°C`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-orange-100">
                      <span className="text-xs text-gray-600">Historical Max (Average)</span>
                      <span className="text-xs font-bold text-gray-900">
                        {cityData["TEMP_HIST_MAX"] !== undefined
                          ? `${cityData["TEMP_HIST_MAX"].toFixed(1)}°C`
                          : "--"}
                      </span>
                    </div>
                    {cityData["TEMP_HIST_MIN_LABEL"] && (
                      <div className="text-[10px] text-gray-500 text-right">
                        Min: {cityData["TEMP_HIST_MIN_LABEL"]}
                      </div>
                    )}
                    {cityData["TEMP_HIST_MAX_LABEL"] && (
                      <div className="text-[10px] text-gray-500 text-right">
                        Max: {cityData["TEMP_HIST_MAX_LABEL"]}
                      </div>
                    )}
                  </div>
                )}
              </div>

               
            </div>
          </div>
        )}

        {/* ✅ Selected Location Panel — independent conditional, no longer nested inside showCityDetails */}
        {selectedLocationData && !showCityDetails && (
          <div className="lg:w-80 w-full lg:h-auto lg:absolute lg:right-4 lg:top-12 lg:bottom-12 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl p-4 z-40 max-h-[80vh] overflow-y-auto m-4 lg:m-0">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Selected Location
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedLocationData.lat.toFixed(4)},{" "}
                  {selectedLocationData.lng.toFixed(4)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLocationData(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              {Object.keys(layerConfigs)
                .filter(
                  (k) =>
                    k === "PVOUT_YEARLY" ||
                    k === "GHI" ||
                    k === "DNI" ||
                    k === "GTI" ||
                    k === "DIF" ||
                    k === "OPTA" ||
                    k === "ELEVATION" ||
                    k === "SLOPE" ||
                    k === "POPULATION",
                )
                .map((layerKey) => {
                  const config = layerConfigs[layerKey as LayerType];
                  const value = selectedLocationData.data[layerKey];

                  return (
                    <div key={layerKey} className="p-2 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {config.shortName}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-900">
                          {value !== undefined ? value.toFixed(2) : "--"}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {config.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Active Layer Display */}
              {activeLayer && layerConfigs[activeLayer] && selectedLocationData.data[activeLayer] !== undefined && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                    {layerConfigs[activeLayer].shortName}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">
                      {selectedLocationData.data[activeLayer].toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {layerConfigs[activeLayer].unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Yearly Rainfall */}
              <div className="p-2 bg-blue-50 rounded-lg">
                <button
                  onClick={() => setShowAllRainMonths(!showAllRainMonths)}
                  className="w-full flex justify-between items-center"
                >
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    Precipitation
                  </span>
                  <span className="text-xs text-blue-600">
                    {showAllRainMonths ? "▲" : "▼"}
                  </span>
                </button>
                {showAllRainMonths && (
                  <div className="mt-2 space-y-1">
                    {/* Yearly precipitation data */}
                    {[
                      "CHIRPS_2018",
                      "CHIRPS_2019",
                      "CHIRPS_2020",
                      "CHIRPS_2021",
                      "CHIRPS_2022",
                      "CHIRPS_2023",
                      "CHIRPS_2024",
                    ].map((layerKey) => {
                      const value = selectedLocationData.data[layerKey];
                      const year = layerKey.replace("CHIRPS_", "");
                      return (
                        <div
                          key={layerKey}
                          className="flex justify-between items-center py-1 border-b border-blue-100 last:border-0"
                        >
                          <span className="text-xs text-gray-600">{year}</span>
                          <span className="text-xs font-bold text-gray-900">
                            {value !== undefined
                              ? `${value.toFixed(1)} mm`
                              : "--"}
                          </span>
                        </div>
                      );
                    })}
                    {/* 2025 Total (calculated from monthly data) */}
                    {(() => {
                      const months2025 = [
                        "JAN",
                        "FEB",
                        "MAR",
                        "APR",
                        "MAY",
                        "JUN",
                        "JUL",
                        "AUG",
                        "SEP",
                        "OCT",
                        "NOV",
                        "DEC",
                      ];
                      const values2025 = months2025
                        .map(
                          (m) => selectedLocationData.data[`CHIRPS_2025_${m}`],
                        )
                        .filter((v) => v !== undefined);
                      const total2025 =
                        values2025.length > 0
                          ? values2025.reduce((a, b) => a + b, 0)
                          : undefined;
                      return (
                        <div className="flex justify-between items-center py-1 border-b border-blue-200 last:border-0 bg-blue-100/50 -mx-2 px-2 rounded">
                          <span className="text-xs font-bold text-blue-700">
                            2025
                          </span>
                          <span className="text-xs font-bold text-blue-700">
                            {total2025 !== undefined
                              ? `${total2025.toFixed(1)} mm`
                              : "--"}
                          </span>
                        </div>
                      );
})()}
                  </div>
                )}
              </div>

              {/* Temperature History - Average Monthly Temperature */}
              <div className="p-2 bg-orange-50 rounded-lg">
                <button
                  onClick={() => setShowSelectedTempYears(!showSelectedTempYears)}
                  className="w-full flex justify-between items-center"
                >
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Temperature (Average)
                  </span>
                  <span className="text-xs text-orange-600">
                    {showSelectedTempYears ? "▲" : "▼"}
                  </span>
                </button>
                {showSelectedTempYears && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center py-1 border-b border-orange-100">
                      <span className="text-xs text-gray-600">Historical Min (Average)</span>
                      <span className="text-xs font-bold text-gray-900">
                        {selectedLocationData.data["TEMP_HIST_MIN"] !== undefined
                          ? `${selectedLocationData.data["TEMP_HIST_MIN"].toFixed(1)}°C`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-orange-100">
                      <span className="text-xs text-gray-600">Historical Max (Average)</span>
                      <span className="text-xs font-bold text-gray-900">
                        {selectedLocationData.data["TEMP_HIST_MAX"] !== undefined
                          ? `${selectedLocationData.data["TEMP_HIST_MAX"].toFixed(1)}°C`
                          : "--"}
                      </span>
                    </div>
                    {selectedLocationData.data["TEMP_HIST_MIN_LABEL"] && (
                      <div className="text-[10px] text-gray-500 text-right">
                        Min: {selectedLocationData.data["TEMP_HIST_MIN_LABEL"]}
                      </div>
                    )}
                    {selectedLocationData.data["TEMP_HIST_MAX_LABEL"] && (
                      <div className="text-[10px] text-gray-500 text-right">
                        Max: {selectedLocationData.data["TEMP_HIST_MAX_LABEL"]}
                      </div>
                    )}
                  </div>
                )}
              </div>

             
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
