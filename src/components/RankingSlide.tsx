import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, SlidersHorizontal, Trophy, MapPin, Activity, Filter } from 'lucide-react';
const BASE_PATH = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type Metric = 'val_ghi' | 'val_dni' | 'val_gti' | 'val_pvout' | 'val_elevation' | 'val_slope' | 'val_temperature' | 'val_dustsoiling' | 'val_gridaccess' | 'val_landclass' | 'landclass_summary' | 'val_soiltype' | 'area_km2';

const metricsInfo: Record<Metric, { label: string, type: 'higher' | 'lower' | 'range', desc: string, categorical?: { values: string[], order: string[] } }> = {
  val_pvout: { label: 'Specific PV Output', type: 'higher', desc: 'Energy generation potential' },
  val_ghi: { label: 'GHI', type: 'higher', desc: 'Global Horizontal Irradiance' },
  val_dni: { label: 'DNI', type: 'higher', desc: 'Direct Normal Irradiance' },
  val_gti: { label: 'GTI', type: 'higher', desc: 'Global Tilted Irradiance' },
  val_slope: { label: 'Slope', type: 'lower', desc: 'Flatter is better for construction' },
  val_temperature: { label: 'Temperature', type: 'lower', desc: 'Cooler is better for PV efficiency' },
  val_elevation: { label: 'Elevation', type: 'range', desc: 'Mid-altitude preferred (650-1200m optimal)' },
  val_dustsoiling: { label: 'Dust Intensity', type: 'lower', desc: 'Lower dust means less cleaning cost', categorical: { values: ['Low', 'Moderate', 'High', 'Very High'], order: ['Low', 'Moderate', 'High', 'Very High'] } },
  val_gridaccess: { label: 'Grid Distance', type: 'lower', desc: 'Closer to grid is better' },
  val_landclass: { label: 'Land Cover Score', type: 'higher', desc: 'ESA WorldCover: Bare=1.0, Shrubland=0.7, Grassland=0.6' },
  landclass_summary: { label: 'Land Cover', type: 'higher', desc: 'ESA WorldCover classes (display only)', categorical: { values: ['Bare', 'Grassland', 'Shrubland', 'Trees', 'Water', 'Other'], order: ['Bare', 'Grassland', 'Shrubland', 'Trees', 'Water', 'Other'] } },
  val_soiltype: { label: 'Soil Type', type: 'higher', desc: 'Loam is optimal, Clay/Silt is poor', categorical: { values: ['Loam (Very High)', 'Loam/Steppe (High)', 'Sandy Loam (Moderate)', 'Sandy (Low)', 'Clay/Silt (Very Low)'], order: ['Loam (Very High)', 'Loam/Steppe (High)', 'Sandy Loam (Moderate)', 'Sandy (Low)', 'Clay/Silt (Very Low)'] } },
  area_km2: { label: 'Area', type: 'higher', desc: 'Larger sites accommodate more capacity' }
};

const getSoilTypeLabel = (val: number): string => {
  if (val >= 9) return 'Loam (Very High)';
  if (val >= 8) return 'Loam/Steppe (High)';
  if (val >= 6) return 'Sandy Loam (Moderate)';
  if (val >= 4) return 'Sandy (Low)';
  return 'Clay/Silt (Very Low)';
};

const getDustLabel = (val: number): string => {
  if (val <= 0.5) return 'Low';
  if (val <= 2.0) return 'Moderate';
  if (val <= 3.5) return 'High';
  return 'Very High';
};

const getSoilTypeIndex = (val: number): number => {
  if (val >= 9) return 0;
  if (val >= 8) return 1;
  if (val >= 6) return 2;
  if (val >= 4) return 3;
  return 4;
};

const getDustIndex = (val: number): number => {
  if (val <= 0.5) return 0;
  if (val <= 2.0) return 1;
  if (val <= 3.5) return 2;
  return 3;
};

const parseLandclassSummary = (summary: string): { name: string; pct: number }[] => {
  if (!summary) return [];
  return summary.split(', ').map(part => {
    const match = part.match(/^(.+?)\s+([\d.]+)%$/);
    return match ? { name: match[1], pct: parseFloat(match[2]) } : null;
  }).filter(Boolean).sort((a, b) => b!.pct - a!.pct) as { name: string; pct: number }[];
};

type ThresholdConfig = {
  optimalMin: number;
  optimalMax: number;
  hardMin: number;
  hardMax: number;
};

const dualThresholds: Record<Metric, ThresholdConfig | null> = {
  val_pvout: { optimalMin: 1600, optimalMax: 1740, hardMin: 1200, hardMax: 2000 },
  val_ghi: { optimalMin: 1900, optimalMax: 2100, hardMin: 1500, hardMax: 2400 },
  val_dni: { optimalMin: 1850, optimalMax: 2150, hardMin: 1400, hardMax: 2400 },
  val_gti: { optimalMin: 2100, optimalMax: 2200, hardMin: 1600, hardMax: 2500 },
  val_slope: { optimalMin: 0, optimalMax: 5, hardMin: 0, hardMax: 20 },
  val_temperature: { optimalMin: 15, optimalMax: 25, hardMin: 0, hardMax: 38 },
  val_elevation: { optimalMin: 650, optimalMax: 1200, hardMin: 400, hardMax: 1800 },
  val_dustsoiling: { optimalMin: 0.0, optimalMax: 0.5, hardMin: 0.0, hardMax: 5.0 },
  val_gridaccess: { optimalMin: 0, optimalMax: 10000, hardMin: 0, hardMax: 30000 },
  val_landclass: { optimalMin: 1.0, optimalMax: 1.0, hardMin: 0.0, hardMax: 1.0 },
  landclass_summary: null,
  val_soiltype: { optimalMin: 7, optimalMax: 10, hardMin: 4, hardMax: 10 },
  area_km2: { optimalMin: 10, optimalMax: 100, hardMin: 1, hardMax: 200 }
};

const calculateDualThresholdScore = (val: number, info: Metric, thresholds: ThresholdConfig | null, type: 'higher' | 'lower' | 'range'): number => {
  if (!thresholds) return 0;
  
  const { optimalMin, optimalMax, hardMin, hardMax } = thresholds;
  
  if (type === 'range') {
    if (val >= optimalMin && val <= optimalMax) return 1;
    if (val < hardMin || val > hardMax) return 0;
    if (val < optimalMin) return (val - hardMin) / (optimalMin - hardMin);
    return (hardMax - val) / (hardMax - optimalMax);
  }
  
  const isHigher = type === 'higher';
  
  if (isHigher) {
    if (val >= optimalMin && val <= optimalMax) return 1;
    if (val < hardMin) return 0;
    if (val < optimalMin) return (val - hardMin) / (optimalMin - hardMin);
    if (val > optimalMax) return Math.max(0, 1 - (val - optimalMax) / (hardMax - optimalMax));
    return 1;
  } else {
    if (val >= optimalMin && val <= optimalMax) return 1;
    if (val > hardMax) return 0;
    if (val > optimalMax) return (hardMax - val) / (hardMax - optimalMax);
    if (val < optimalMin) return Math.max(0, 1 - (optimalMin - val) / (optimalMin - hardMin));
    return 1;
  }
};

export function RankingSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  const [siteRankings, setSiteRankings] = useState<any[]>([]);
  const [openLandclassDropdown, setOpenLandclassDropdown] = useState<string | null>(null);

  const closeDropdown = React.useCallback((e: MouseEvent) => {
    const dropdown = document.querySelector('.landclass-dropdown-content');
    const button = document.querySelector('.landclass-dropdown-button');
    if (dropdown && !(dropdown as HTMLElement).contains(e.target as Node) &&
        button && !(button as HTMLElement).contains(e.target as Node)) {
      setOpenLandclassDropdown(null);
    }
  }, []);

  React.useEffect(() => {
    if (openLandclassDropdown) {
      document.addEventListener('mousedown', closeDropdown);
      return () => document.removeEventListener('mousedown', closeDropdown);
    }
  }, [openLandclassDropdown, closeDropdown]);

  React.useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/mcda_zones.geojson`).then(r => r.json()).catch(() => ({ features: [] })),
      fetch(`${BASE_PATH}/legacy_sites.geojson`).then(r => r.json()).catch(() => ({ features: [] }))
    ]).then(([mcdaData, legacyData]) => {
      const allFeatures = [...(legacyData.features || []), ...(mcdaData.features || [])];
      const sites = allFeatures.map((f: any) => ({
        name: f.properties.zone_id,
        coordinates: [f.properties.centroid_lon, f.properties.centroid_lat],
        ...f.properties
      }));
      setSiteRankings(sites);
    }).catch(e => console.error(e));
  }, []);

  const [weights, setWeights] = useState<Record<Metric, number>>({
    val_pvout: 1,
    val_ghi: 1,
    val_dni: 1,
    val_gti: 1,
    val_slope: 1,
    val_temperature: 1,
    val_elevation: 1,
    val_dustsoiling: 1,
    val_gridaccess: 1,
    val_landclass: 1,
    val_soiltype: 1,
    area_km2: 1
  } as Record<Metric, number>);

  const [filterThresholds, setFilterThresholds] = useState<Record<Metric, number>>({
    val_pvout: 0,
    val_ghi: 0,
    val_dni: 0,
    val_gti: 0,
    val_slope: 0,
    val_temperature: 0,
    val_elevation: 0,
    val_dustsoiling: 0,
    val_gridaccess: 0,
    val_landclass: 0,
    val_soiltype: 0,
    area_km2: 0
  } as Record<Metric, number>);

  const handleWeightChange = (metric: Metric, value: number) => {
    setWeights(prev => ({ ...prev, [metric]: value }));
  };

  const { rankedSites, bounds } = useMemo(() => {
    if (siteRankings.length === 0) return { rankedSites: [], bounds: {} as Record<Metric, { min: number, max: number }> };
    const bounds = {} as Record<Metric, { min: number, max: number }>;
    const keys = Object.keys(metricsInfo) as Metric[];
    
    keys.forEach(k => {
      const vals = siteRankings.map((s: any) => s[k]).filter(v => v != null && !isNaN(v));
      bounds[k] = { 
        min: vals.length > 0 ? Math.min(...vals) : 0, 
        max: vals.length > 0 ? Math.max(...vals) : 100 
      };
    });

    const validSites = siteRankings.filter((site: any) => {
      let passes = true;
      keys.forEach(k => {
        const f = filterThresholds[k];
        if (f > 0 && bounds[k] && bounds[k].max > bounds[k].min) {
          const val = site[k];
          if (val === undefined || val === null) {
            passes = false;
            return;
          }
          const min = bounds[k].min;
          const max = bounds[k].max;
          const info = metricsInfo[k];
          if (info.categorical) {
            if (k !== 'landclass_summary') {
              const catIndex = f - 1;
              if (catIndex >= 0) {
                let siteCat = 0;
                if (k === 'val_dustsoiling') siteCat = getDustIndex(val);
                else if (k === 'val_soiltype') siteCat = getSoilTypeIndex(val);
                else siteCat = val <= 0.5 ? 0 : val <= 2.0 ? 1 : val <= 3.5 ? 2 : 3;
                if (siteCat > catIndex) passes = false;
              }
            }
          } else {
            const thresholds = dualThresholds[k];
            if (thresholds) {
              const score = calculateDualThresholdScore(val, k, thresholds, info.type);
              if (score < f / 100) passes = false;
            } else if (info.type === 'higher') {
              const threshold = min + (max - min) * (f / 100);
              if (val < threshold) passes = false;
            } else {
              const threshold = max - (max - min) * (f / 100);
              if (val > threshold) passes = false;
            }
          }
        }
      });
      return passes;
    });

    const ranked = validSites.map((site: any) => {
      let totalScore = 0;
      let totalWeight = 0;
      const breakdowns: Record<Metric, number> = {} as any;

      keys.forEach(k => {
        if (k === 'landclass_summary') return;
        const w = weights[k] || 0;
        const val = site[k];
        const info = metricsInfo[k];
        
        let score = 0;
        
        const thresholds = dualThresholds[k];
        if (thresholds) {
          score = calculateDualThresholdScore(val, k, thresholds, info.type);
        } else {
            const { min, max } = bounds[k];
            if (max > min && val !== undefined && val !== null) {
              if (info.type === 'higher') {
                score = (val - min) / (max - min);
              } else {
                score = (max - val) / (max - min);
              }
            } else if (val === undefined || val === null) {
              score = 0;
            } else {
              score = 1;
            }
          }
        
        breakdowns[k] = score;
        totalScore += score * w;
        totalWeight += w;
      });
      
      return {
        ...site,
        score: totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0,
        breakdowns
      };
    }).sort((a, b) => b.score - a.score);

    return { rankedSites: ranked, bounds };
  }, [weights, siteRankings, filterThresholds]);

  return (
    <div className="flex flex-col h-full w-full p-4 lg:p-6 relative z-10 overflow-y-auto custom-scrollbar bg-slate-50">
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
          <button 
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Site Rankings</h2>
        </div>
        <button 
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-blue-600/30 text-xs"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 shrink-0 min-h-[500px] max-h-[75vh] mb-4">
        {/* Left Sidebar - Sliders */}
        <div className="w-full lg:w-64 shrink-0 bg-white/60 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-xl flex flex-col overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="text-blue-600" size={18} />
            <h3 className="text-sm font-bold text-gray-900">Adjust Weights</h3>
          </div>
          
          <div className="space-y-4">
            {(Object.keys(metricsInfo) as Metric[])
              .filter(m => m !== 'landclass_summary')
              .map(metric => (
                <div key={metric} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-gray-900 block">{metricsInfo[metric].label}</label>
                    <span className="text-[9px] text-gray-500 block leading-tight">{metricsInfo[metric].desc}</span>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                    {weights[metric]}x
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="1" 
                  value={weights[metric]}
                  onChange={(e) => handleWeightChange(metric, Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Main Content - Ranked List */}
        <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-xl border border-white/60 p-4 rounded-2xl shadow-xl overflow-hidden relative">
          
          <div className="shrink-0 mb-3 bg-white/90 backdrop-blur-md pb-3 pt-1 border-b border-gray-100 flex items-center">
            <span className="text-xs font-bold text-gray-500">{rankedSites.length} Sites</span>
          </div>

          <div className="shrink-0 mb-4 p-3 bg-white/70 backdrop-blur rounded-xl border border-white/60 flex items-center gap-4 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-1 font-bold text-gray-700 shrink-0 text-xs">
              <Filter size={14} className="text-blue-500" /> Hard Filters
            </div>
            <div className="flex gap-4 items-center">
              {(Object.keys(metricsInfo) as Metric[])
                .filter(m => m !== 'landclass_summary')
                .map(metric => {
                  const info = metricsInfo[metric];
                const threshold = filterThresholds[metric];
                const b = bounds[metric];
                const isCategorical = !!info.categorical;

                if (isCategorical) {
                  const cats = info.categorical!;
                  return (
                    <div key={metric} className="min-w-[160px] shrink-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">{info.label}</span>
                        <span className={`text-[10px] font-black ${threshold > 0 ? "text-blue-600" : "text-gray-400"}`}>
                          {threshold > 0 ? cats.values[threshold - 1] || 'ALL' : 'ALL'}
                        </span>
                      </div>
                      <select
                        value={threshold}
                        onChange={(e) => setFilterThresholds(prev => ({...prev, [metric]: Number(e.target.value)}))}
                        className="w-full h-6 text-[10px] font-bold bg-gray-100 border border-gray-200 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={0}>All</option>
                        {cats.values.map((cat, i) => (
                          <option key={cat} value={i + 1}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

let valLabel = "--";
                if (b && b.max > b.min) {
                  const thresholds = dualThresholds[metric];
                  if (thresholds) {
                    const score = (threshold / 100);
                    valLabel = `Suitability Score ≥ ${(score*100).toFixed(0)}%`;
                  } else {
                    if (info.type === 'higher') {
                       valLabel = `≥ ${(b.min + (b.max - b.min) * (threshold / 100)).toFixed(1)}`;
                    } else if (info.type === 'range') {
                       valLabel = `Score ≥ ${threshold}%`;
                    } else {
                       valLabel = `≤ ${(b.max - (b.max - b.min) * (threshold / 100)).toFixed(1)}`;
                    }
                  }
                }

                return (
                  <div key={metric} className="min-w-[140px] shrink-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">{info.label}</span>
                      <span className={`text-[10px] font-black ${threshold > 0 ? "text-blue-600" : "text-gray-400"}`}>
                        {threshold > 0 ? valLabel : 'ALL'}
                      </span>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={threshold}
                      onChange={(e) => setFilterThresholds(prev => ({...prev, [metric]: Number(e.target.value)}))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            <AnimatePresence>
              {rankedSites.map((site, index) => (
                <motion.div
                  key={site.name}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                  className={`p-3 rounded-xl border transition-all ${
                    index === 0 ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10 shadow-lg' :
                    index === 1 ? 'bg-gray-400/10 border-gray-400/30 shadow-md' :
                    index === 2 ? 'bg-orange-600/10 border-orange-600/30 shadow-md' :
                    'bg-white/80 border-white hover:bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                        index === 0 ? 'bg-amber-500 text-white shadow-md shadow-amber-500/40' :
                        index === 1 ? 'bg-gray-400 text-white shadow-md' :
                        index === 2 ? 'bg-orange-500 text-white shadow-md' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{site.name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <MapPin size={10} /> {site.coordinates[1].toFixed(3)}, {site.coordinates[0].toFixed(3)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-0.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Match</span>
                        <span className="text-sm font-black text-blue-600">{site.score.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden flex">
                        {(Object.keys(metricsInfo) as Metric[]).filter(k => weights[k] > 0).map((metric, i) => {
                          const w = weights[metric];
                          const totalW = Object.values(weights).reduce((a,b) => a+b, 0);
                          const portion = (site.breakdowns[metric] * w) / totalW * 100;
                          return (
                            <div 
                              key={metric}
                              title={`${metricsInfo[metric].label}: ${(site.breakdowns[metric] * 100).toFixed(1)}%`}
                              className="h-full border-r border-white/20 last:border-0"
                              style={{ 
                                width: `${portion}%`, 
                                backgroundColor: `hsl(${210 + (i * 20)}, 80%, ${50 + (i * 5)}%)` 
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200/60 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-y-2 gap-x-1.5 relative">
{(Object.keys(metricsInfo) as Metric[]).map(metric => {
                        const val = site[metric];
                        const varName = metric.replace('val_', '');
                        const minVal = site[`min_${varName}`];
                        const maxVal = site[`max_${varName}`];
                        const hasRange = minVal !== undefined && maxVal !== undefined && minVal !== null && maxVal !== null && (minVal !== maxVal);
                        let displayVal = "--";
                        let unit = "";
                        let rangeDisplay = "";
                        
                        if (val !== undefined && val !== null) {
                           if (metric === 'area_km2') { displayVal = val.toFixed(1); unit = "km²"; }
                           else if (metric === 'val_gridaccess') { displayVal = (val / 1000).toFixed(1); unit = "km"; }
                           else if (metric === 'val_temperature') { displayVal = val.toFixed(1); unit = "°C"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(1)}-${maxVal.toFixed(1)}°C)` : ""; }
                           else if (metric === 'val_slope') { displayVal = val.toFixed(1); unit = "°"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(1)}-${maxVal.toFixed(1)}°)` : ""; }
else if (metric === 'val_pvout') { displayVal = val.toFixed(1); unit = "kWh/kWp"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(0)}-${maxVal.toFixed(0)})` : ""; }
else if (metric === 'val_elevation') { displayVal = val.toFixed(0); unit = "m"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(0)}-${maxVal.toFixed(0)}m)` : ""; }
                            else if (metric === 'landclass_summary') {
                              const parsed = parseLandclassSummary(val);
                              displayVal = parsed.length > 0 ? `${parsed[0].name} ${parsed[0].pct.toFixed(1)}%` : (val || '-');
                              unit = "";
                            }
                            else if (metric === 'val_soiltype') {
                              displayVal = getSoilTypeLabel(val); 
                              unit = ""; 
                            }
                            else if (metric === 'val_gti') { displayVal = val.toFixed(0); unit = "Wh/m²/day"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(0)}-${maxVal.toFixed(0)})` : ""; }
                            else if (metric === 'val_dni') { displayVal = val.toFixed(0); unit = "Wh/m²/day"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(0)}-${maxVal.toFixed(0)})` : ""; }
                            else if (metric === 'val_ghi') { displayVal = val.toFixed(0); unit = "Wh/m²/day"; rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(0)}-${maxVal.toFixed(0)})` : ""; }
                            else if (metric.includes('dust')) { 
                              displayVal = getDustLabel(val); 
                              unit = ""; 
                              rangeDisplay = minVal && maxVal ? ` (${minVal.toFixed(1)}-${maxVal.toFixed(1)})` : "";
                            }
                            else { displayVal = val.toFixed(1); }
                         }

return (
                            <div key={metric} className="flex flex-col relative">
                              <span className="text-[9px] uppercase font-bold text-gray-400 truncate pr-2" title={metricsInfo[metric].label}>
                                {metricsInfo[metric].label}
                              </span>
                              <span className="text-xs font-bold text-gray-900 flex flex-col">
                                {metric === 'landclass_summary' ? (
                                  <>
                                    <button
                                      className="landclass-dropdown-button text-left hover:text-blue-600 cursor-pointer"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setOpenLandclassDropdown(openLandclassDropdown === site.name ? null : site.name);
                                      }}
                                    >
                                      {displayVal}
                                    </button>
                                    {openLandclassDropdown === site.name && (
                                      <div
                                        className="landclass-dropdown-content fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
                                        style={{
                                          left: '50%',
                                          top: '100%',
                                          transform: 'translateX(-50%)'
                                        }}
                                      >
                                        {parseLandclassSummary(val).slice(1).map((item, i) => (
                                          <div key={i} className="px-3 py-1 text-xs hover:bg-gray-100">
                                            {item.name} {item.pct.toFixed(1)}%
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span>{displayVal} <span className="text-[9px] text-gray-500 font-bold">{unit}</span></span>
                                )}
                                {hasRange && metric !== 'landclass_summary' && <span className="text-[9px] text-gray-400">{rangeDisplay}</span>}
                              </span>
                            </div>
                         );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* MCDA Methodology Section */}
      <div className="mt-4 mb-4 p-4 bg-white/70 backdrop-blur-md rounded-xl border border-white/80 shadow-md shrink-0">
        <div className="flex items-center gap-2 mb-3 border-b border-gray-200/60 pb-2">
          <Activity className="text-blue-600" size={18} />
          <h3 className="text-sm font-black text-gray-900 tracking-tight">MCDA Methodology</h3>
        </div>
        
        <div className="space-y-4 text-xs text-gray-700 leading-relaxed max-w-5xl">
          <p>
            The <strong>Multi-Criteria Decision Analysis (MCDA)</strong> engine dynamically scores every geographical zone using a <em>Min-Max Feature Scaling</em> algorithm. This transforms raw geographical attributes with highly distinct units (e.g., °C, km, Dust Intensity) into dimensionless performance indexes perfectly scaled between 0 and 1.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">1. Dual-Threshold Fuzzy Normalisation</h4>
              <p className="mb-2">Rather than simple min-max scaling, the algorithm uses predefined <strong>Optimal</strong> and <strong>Hard Threshold</strong> ranges sourced from regional engineering constraints. This perfectly captures the non-linear physics of solar metrics:</p>
              
              <div className="bg-gray-900 text-gray-100 font-mono text-[11px] px-5 py-4 rounded-xl shadow-inner mb-3 leading-relaxed">
                <span className="text-emerald-400 font-bold">100% Score (1.0):</span> Value falls exactly within the Optimal Range (e.g., Temp 15°C–25°C)<br/>
                <span className="text-amber-400 font-bold">Linear Fade (0.9 to 0.1):</span> Value strays from Optimal towards the Hard Limit<br/>
                <span className="text-red-400 font-bold">0% Score (0.0):</span> Value breaches the Hard Limit (Excluded completely)
              </div>

              <p className="text-gray-500 italic text-[12px] mb-3">
                <strong>Example (Slope):</strong> Optimal 0°–5° = 100%, Hard limit 20° = 0%. A 10° slope scores <code>(20-10)/(20-5) = 0.67</code>. A 22° slope scores 0.0 and is excluded.
              </p>

              <div className="text-[11px] bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="font-bold text-emerald-800 mb-2">Active Threshold Configuration:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-emerald-700">
                  <span><strong>PV Output:</strong> 1600–1740 (opt) / 1200–2000 (hard)</span>
                  <span><strong>GHI:</strong> 1900–2100 / 1500–2400</span>
                  <span><strong>DNI:</strong> 1850–2150 / 1400–2400</span>
                  <span><strong>GTI:</strong> 2100–2200 / 1600–2500</span>
                  <span><strong>Slope:</strong> 0°–5° / 0°–20°</span>
                  <span><strong>Temp:</strong> 15°C–25°C / 5°C–38°C</span>
                  <span><strong>Elevation:</strong> 650–1200m / 400–1800m</span>
                  <span><strong>Grid:</strong> 0–10km / 0–30km</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">2. Physical Parameter Boundaries</h4>
              <ul className="space-y-3 text-[13px]">
                <li className="flex gap-2">
                  <span className="text-blue-500 font-bold shrink-0">Temperature:</span> 
                  <span>Solar panels lose ~0.38% efficiency for every 1°C over 25°C. Zones breaching 38°C peak summer heat drop rapidly in suitability, while mountainous regions naturally regain up to 3% output via passive cooling.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500 font-bold shrink-0">Irradiance:</span> 
                  <span>Optimal PV Output assumes <strong>1600–1740 kWh/kWp</strong>. Direct Irradiance (DNI) targets an optimal bound of <strong>1850–2150 kWh/m²</strong>, isolating strict high-energy yield vectors.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500 font-bold shrink-0">Soil Geology:</span> 
                  <span>Geostructural stability favors robust <em>Cambisols (Loam)</em> and <em>Kastanozems (Steppe)</em> (score 9-10). Unstable sandy or liquid-behaving clay regions receive massive penalties (score 2-4) due to mounting failure risks.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-500 font-bold shrink-0">Land Class:</span> 
                  <span>Sites must strictly belong to Bare, Shrubland, or Grassland classifications. Urban, Forest, Water, and Cropland are hard-excluded (0.0).</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-200/60 pt-6">
            <div>
              <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">3. Dynamic Weight Vector Interpolation</h4>
              <p className="mb-3">Once all metrics are geometrically projected to a unified `[0, 1]` index, your slider input assigns custom scalar weights (`wᵢ`). The overall site suitability acts as the weighted sum product against its dimensional mass:</p>
              <div className="bg-gray-900 text-gray-100 font-mono text-xs px-5 py-4 rounded-xl shadow-inner">
                OverallScore = ( Σ (Scoreᵢ × wᵢ) ) / ( Σ wᵢ ) × 100
              </div>
              <p className="mt-3 text-gray-500 italic text-[12px]">
                <strong>Example:</strong> If you assign Grid Distance a weight of 5 and PVOUT a weight of 1, the algorithm mathematically stretches the final percentage, heavily skewing outcomes towards sites directly tethered to the power grid while recalculating spatial hierarchies instantly.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">4. Boolean Hard Constraints (Active Filtration)</h4>
              <p className="mb-3">
                The absolute filters atop the ranking list operate as spatial eviction thresholds. Hard filters trigger a binary failure cascade on violating arrays.
              </p>
              <p className="text-gray-500 italic text-[12px]">
                <strong>Example:</strong> If a strict filter sets minimum acceptable Area to <code>≥ 50 km²</code>, any zone evaluating to <code>False</code> is mathematically purged from the geographical evaluation matrix entirely, guaranteeing that visual datasets contain only verified qualifying selections. This effectively performs live spatial exclusion over the raster boundaries.
              </p>
            </div>
          </div>

          {/* Variable Specifications */}
          <div className="mt-8 border-t border-gray-200/60 pt-6">
            <h4 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-[11px]">Variable Specifications</h4>
            <p className="text-sm text-gray-600 mb-4">Each variable is scored using fuzzy-linear normalization with optimal and hard thresholds. Inverted variables (marked *) score higher when the raw value is lower.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 pr-4 font-bold text-gray-700">Variable</th>
                    <th className="text-left py-2 pr-4 font-bold text-gray-700">Unit</th>
                    <th className="text-left py-2 pr-4 font-bold text-gray-700">Optimal Range</th>
                    <th className="text-left py-2 font-bold text-gray-700">Hard Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">temperature</td>
                    <td className="py-2 pr-4 text-gray-600">°C</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">15 – 25</td>
                    <td className="py-2 text-gray-500">0 – 38</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">ghi</td>
                    <td className="py-2 pr-4 text-gray-600">Wh/m²/day</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">1900 – 2100</td>
                    <td className="py-2 text-gray-500">1500 – 2400</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">dni</td>
                    <td className="py-2 pr-4 text-gray-600">Wh/m²/day</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">1850 – 2150</td>
                    <td className="py-2 text-gray-500">1400 – 2400</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">gti</td>
                    <td className="py-2 pr-4 text-gray-600">Wh/m²/day</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">2100 – 2200</td>
                    <td className="py-2 text-gray-500">1600 – 2500</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">pvout</td>
                    <td className="py-2 pr-4 text-gray-600">kWh/kWp</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">1600 – 1740</td>
                    <td className="py-2 text-gray-500">1200 – 2000</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">elevation</td>
                    <td className="py-2 pr-4 text-gray-600">m</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">650 – 1200</td>
                    <td className="py-2 text-gray-500">400 – 1800</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">slope*</td>
                    <td className="py-2 pr-4 text-gray-600">degrees</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">0 – 5</td>
                    <td className="py-2 text-gray-500">0 – 20</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">soiltype</td>
                    <td className="py-2 pr-4 text-gray-600">index</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">7 – 10</td>
                    <td className="py-2 text-gray-500">4 – 10</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">dustsoiling*</td>
                    <td className="py-2 pr-4 text-gray-600">Dust Index</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">0 – 0.5</td>
                    <td className="py-2 text-gray-500">0 – 5.0</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">gridaccess*</td>
                    <td className="py-2 pr-4 text-gray-600">km</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">0 – 10</td>
                    <td className="py-2 text-gray-500">0 – 30</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-gray-800">landclass</td>
                    <td className="py-2 pr-4 text-gray-600">class</td>
                    <td className="py-2 pr-4 text-emerald-600 font-medium">Bare/Shrub/Grass</td>
                    <td className="py-2 text-red-500">Excluded</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <p className="text-[11px] text-gray-500 mt-3 italic">* Inverted variables: lower raw values score higher (e.g., slope 0° is optimal, 20° is excluded)</p>
            
            {/* Calculation Details */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3">Calculation Details</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                <div className="space-y-2">
                  <div><span className="font-semibold text-gray-700">temperature:</span> Annual average temperature (°C), resampled to 1km reference grid</div>
                  <div><span className="font-semibold text-gray-700">ghi (Wh/m²/day):</span> Yearly total Global Horizontal Irradiance</div>
                  <div><span className="font-semibold text-gray-700">dni (Wh/m²/day):</span> Yearly total Direct Normal Irradiance</div>
                  <div><span className="font-semibold text-gray-700">gti (Wh/m²/day):</span> Yearly total Global Tilted Irradiance</div>
                  <div><span className="font-semibold text-gray-700">pvout (kWh/kWp):</span> Yearly PV energy yield</div>
                </div>
                <div className="space-y-2">
                  <div><span className="font-semibold text-gray-700">elevation (m):</span> Digital elevation model</div>
                  <div><span className="font-semibold text-gray-700">slope (degrees):</span> Terrain slope, calculated using max resampling to capture steepest terrain within each 1km pixel</div>
                  <div><span className="font-semibold text-gray-700">soiltype (index):</span> Soil classification mapped to suitability index (4-10), using nearest-neighbor resampling</div>
                  <div><span className="font-semibold text-gray-700">dustsoiling (Dust Index):</span> Mean of all available monthly dust files (2020-2025), representing average dust intensity from satellite observations</div>
                  <div><span className="font-semibold text-gray-700">gridaccess (km):</span> Euclidean distance to nearest 132kV transmission line, calculated via distance transform</div>
                  <div><span className="font-semibold text-gray-700">landclass (class):</span> Land use classification: Bare/Sparse (1.0), Shrubland (0.6), Grassland (0.5); Trees/Cropland/Forest/Water/Urban hard-excluded</div>
                </div>
              </div>
            </div>
            
            {/* Hard Constraints */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h5 className="font-bold text-amber-800 text-xs uppercase tracking-wider mb-2">Hard Spatial Constraints (Exclusion Filters)</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-amber-700">Grid Distance:</span>
                  <span className="text-gray-600 ml-1">≤ 30km from 132kV lines (hard limit)</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-700">Urban Exclusion:</span>
                  <span className="text-gray-600 ml-1">≥ 10km from cities/towns (night lights + population)</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-700">Border Buffer:</span>
                  <span className="text-gray-600 ml-1">≥ 20km from international borders</span>
                </div>
              </div>
            </div>
            
            {/* Scoring Formula */}
            <div className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-lg">
              <h5 className="font-bold text-xs uppercase tracking-wider mb-2">Fuzzy-Linear Scoring Formula</h5>
              <div className="font-mono text-[11px] leading-relaxed">
                <div><span className="text-emerald-400">if</span> opt_min ≤ value ≤ opt_max: <span className="text-emerald-400">score = 1.0</span></div>
                <div><span className="text-amber-400">elif</span> hard_min ≤ value &lt; opt_min: <span className="text-amber-400">score = (value - hard_min) / (opt_min - hard_min)</span></div>
                <div><span className="text-amber-400">elif</span> opt_max &lt; value ≤ hard_max: <span className="text-amber-400">score = 1.0 - (value - opt_max) / (hard_max - opt_max)</span></div>
                <div><span className="text-red-400">else</span>: <span className="text-red-400">score = 0.0</span> (excluded)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
