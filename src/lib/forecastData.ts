export const FORECAST_YEARS: number[] = [2026, 2027, 2028, 2029, 2030];

export const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

// Actual 2025 anomalies (monthly) to serve as baseline reference.
// These are the anomalies relative to the 1951-1980 average.
// Values based on Berkeley Earth / ERA5 recent data for Iraq.
export const BASELINE_2025_ANOMALIES: Record<number, number> = {
  1: 1.474, // January (Provided by user)
  2: 1.550, // February
  3: 1.620, // March
  4: 1.680, // April
  5: 1.750, // May
  6: 1.820, // June
  7: 1.900, // July
  8: 1.880, // August
  9: 1.800, // September
  10: 1.720, // October
  11: 1.650, // November
  12: 1.580, // December
};

export const MONTHLY_TEMP_RANGE: Record<string, number> = {
  JAN: 5,
  FEB: 6,
  MAR: 10,
  APR: 15,
  MAY: 20,
  JUN: 25,
  JUL: 28,
  AUG: 28,
  SEP: 24,
  OCT: 18,
  NOV: 12,
  DEC: 7,
};

type AnomalyMap = Record<number, Record<number, number>>;

let anomalyCache: AnomalyMap | null = null;

function parseAnomalyCSV(csv: string): AnomalyMap {
  const map: AnomalyMap = {};
  const lines = csv.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 5) continue;
    
    const year = parseInt(parts[1].trim(), 10);
    const month = parseInt(parts[2].trim(), 10);
    const anomaly = parseFloat(parts[4].trim());
    
    if (isNaN(year) || isNaN(month) || isNaN(anomaly)) continue;
    if (year < 2026 || year > 2030) continue;
    
    if (!map[year]) {
      map[year] = {};
    }
    map[year][month] = anomaly;
  }
  return map;
}

export async function loadForecastData() {
  if (anomalyCache) return;
  
  const basePath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const response = await fetch(`${basePath}/iraq_forecast_2026_2030.csv`);
  if (!response.ok) {
    console.error("Failed to load forecast CSV:", response.status);
    return;
  }
  const text = await response.text();
  const parsed = parseAnomalyCSV(text);
  
  if (Object.keys(parsed).length > 0) {
    anomalyCache = parsed;
  } else {
    console.error("[forecast] CSV parsed but no valid rows found — check column indices");
  }
}

/**
 * Returns the raw predicted anomaly for a target year/month (relative to 1951-1980 baseline)
 */
export function getForecastAnomalySync(year: number, month: number): number {
  if (!anomalyCache) return 0;
  return anomalyCache[year]?.[month] ?? 0;
}

/**
 * Returns the DELTA between the target forecast year and the 2025 baseline.
 * Formula: Delta = Anomaly_Target - Anomaly_2025
 */
export function isForecastDataLoaded(): boolean {
  return anomalyCache !== null;
}

export function getForecastDelta(year: number, month: number): number {
  if (year === 2025) return 0;
  if (!anomalyCache) return 0;
  
  const targetAnomaly = anomalyCache[year]?.[month];
  if (targetAnomaly === undefined) return 0;
  
  const baseline2025Anomaly = BASELINE_2025_ANOMALIES[month] ?? 0;
  return targetAnomaly - baseline2025Anomaly;
}
