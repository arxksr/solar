import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Map, { Marker, NavigationControl, MapRef, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sun, Zap, ThermometerSun, MapPin, Users, X, Info } from 'lucide-react';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysInMonth = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const BASE_PATH = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

// Exact monthly PVOUT data (total kWh/kWp per month) extracted from public/PVOUT_xx.tif for each city
const cityMonthlyData: Record<string, number[]> = {
  "Degala": [101.31, 107.46, 141.55, 143.37, 160.27, 172.95, 175.77, 175.68, 167.19, 138.88, 117.09, 101.18],
  "Zirguz": [96.63, 103.25, 134.85, 138.15, 155.19, 169.44, 171.68, 171.99, 163.83, 131.75, 110.31, 94.39],
  "Daratu": [100.01, 107.46, 138.94, 141.99, 159.4, 172.71, 176.02, 176.3, 167.67, 136.4, 114.63, 98.11],
  "Bekhme": [99.42, 106.56, 138.66, 143.58, 163.59, 178.08, 182.09, 181.66, 171.72, 139.31, 116.25, 99.6],
  "Atrush": [96.5, 104.41, 137.02, 143.49, 165.76, 177.81, 181.63, 181.13, 172.26, 140.27, 114.96, 96.91],
  "Ashkafta": [89.87, 98.14, 131.81, 139.02, 164.73, 178.77, 182.59, 181.78, 172.23, 137.95, 112.47, 94.24],
  "Gare": [85.31, 95.63, 130.76, 137.43, 166.04, 181.5, 186.09, 185.23, 174.96, 139.87, 112.89, 92.81],
  "Mizuri Jeri": [92.1, 101.14, 135.41, 141.51, 163.9, 175.35, 179.18, 179.4, 170.25, 136.46, 111.15, 91.36],
  "Gare 2": [84.26, 94.83, 128.25, 135.84, 162.63, 178.8, 182.25, 180.82, 168.09, 133.42, 107.01, 87.79],
  "Dedawan": [104.35, 111.64, 145.05, 145.17, 159.59, 171.3, 174.10, 174.25, 166.02, 138.54, 117.63, 102.33],
  "Sulaymaniyah Suburbs": [104.84, 109.5, 142.66, 142.32, 158.66, 173.43, 175.99, 176.85, 168.99, 140.96, 116.55, 102.33],
  "Darbandikhan": [109.43, 110.8, 143.93, 143.55, 157.76, 172.11, 173.41, 174.65, 166.98, 141.08, 118.5, 105.52],
  "Kalar": [112.34, 114.41, 144.55, 140.91, 153.11, 166.71, 167.46, 169.07, 162.99, 138.01, 119.58, 107.2],
  "Puka": [112.56, 115.06, 146.63, 143.43, 154.04, 166.65, 167.74, 168.86, 162.81, 137.55, 119.43, 106.83],
  "Kalar 2": [111.85, 114.92, 146.29, 143.07, 153.39, 166.29, 167.24, 168.24, 162, 137.02, 118.92, 106.24],
  "Pesh Xabur": [99.67, 105.32, 140.24, 143.88, 163.93, 173.55, 179.49, 178.53, 170.1, 137.95, 115.35, 96.04]
};

const markers = [
  { id: 1, name: "Degala", region: "Erbil", coordinates: [44.498525, 36.121055], area: "76.38 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 2, name: "Zirguz", region: "Erbil", coordinates: [44.110194, 36.533453], area: "162.33 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 3, name: "Daratu", region: "Erbil", coordinates: [43.873083, 36.594092], area: "162.44 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 4, name: "Bekhme", region: "Erbil", coordinates: [44.172406, 36.717706], area: "45.06 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 5, name: "Atrush", region: "Erbil", coordinates: [43.505339, 36.848319], area: "30.46 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 6, name: "Ashkafta", region: "Erbil", coordinates: [43.558394, 36.900661], area: "36.76 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 7, name: "Gare", region: "Erbil", coordinates: [43.461294, 36.964583], area: "57.03 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 8, name: "Mizuri Jeri", region: "Erbil", coordinates: [43.198031, 36.864325], area: "71.03 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 9, name: "Gare 2", region: "Erbil", coordinates: [43.742822, 36.970889], area: "39.28 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 10, name: "Dedawan", region: "Erbil", coordinates: [44.278842, 35.965478], area: "180.9 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 11, name: "Sulaymaniyah Suburbs", region: "Sulaymaniyah", coordinates: [45.710128, 35.431708], area: "53.49 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 12, name: "Darbandikhan", region: "Sulaymaniyah", coordinates: [45.533603, 35.088264], area: "96.14 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 13, name: "Kalar", region: "Sulaymaniyah", coordinates: [45.642083, 34.848997], area: "60.12 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 14, name: "Puka", region: "Sulaymaniyah", coordinates: [45.260650, 34.791131], area: "24.64 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 15, name: "Kalar 2", region: "Sulaymaniyah", coordinates: [45.180361, 34.763967], area: "36.56 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" },
  { id: 16, name: "Pesh Xabur", region: "Duhok", coordinates: [42.535139, 37.088969], area: "11.21 km²", desc: "Solar Site", pop: "-", projects: "Solar Site" }
];

const mapStyle = {
  version: 8,
  sources: {
    base: {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'],
      tileSize: 256,
      attribution: '© Google Maps'
    }
  },
  layers: [
    {
      id: 'base-layer',
      type: 'raster',
      source: 'base',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

export function AtlasSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  const [allMarkers, setAllMarkers] = useState<any[]>(markers);
  const [activeMarker, setActiveMarker] = useState<any>(markers[0]);
  const [showPanel, setShowPanel] = useState(true);
  const mapRef = useRef<MapRef>(null);

  React.useEffect(() => {
    fetch(`${BASE_PATH}/mcda_zones.geojson`)
      .then(r => r.json())
      .then(data => {
        const newMarkers = data.features.map((f: any, idx: number) => ({
          id: `mcda-${idx}`,
          name: f.properties.zone_id,
          region: f.properties.governorate,
          coordinates: [f.properties.centroid_lon, f.properties.centroid_lat],
          area: `${f.properties.area_km2} km²`,
          desc: `MCDA Optimal Site (Score: ${f.properties.score_100?.toFixed(1)}%)`,
          pop: "-",
          projects: "Optimal MCDA Zone",
          val_pvout: f.properties.val_pvout
        }));
        setAllMarkers([...markers, ...newMarkers]);
      })
      .catch(e => console.error("Could not load MCDA zones", e));
  }, []);

  const handleMarkerClick = (marker: any) => {
    setActiveMarker(marker);
    setShowPanel(true);
    mapRef.current?.flyTo({
      center: [marker.coordinates[0], marker.coordinates[1]],
      zoom: 11,
      duration: 1500
    });
  };

  // Prepare chart data for the active city
  const { chartData, yearlyTotal, dailyAvg } = React.useMemo(() => {
    if (!activeMarker) return { chartData: [], yearlyTotal: "0", dailyAvg: "0" };
    
    if (cityMonthlyData[activeMarker.name]) {
       const cd = monthNames.map((month, i) => ({
         month,
         kwh: Number((cityMonthlyData[activeMarker.name][i] / daysInMonth[i]).toFixed(2))
       }));
       const yt = cityMonthlyData[activeMarker.name].reduce((a, b) => a + b, 0);
       return { 
         chartData: cd, 
         yearlyTotal: yt.toFixed(0), 
         dailyAvg: (yt / 365.25).toFixed(2) 
       };
    } else if (activeMarker.val_pvout) {
       // Estimate monthly curve for MCDA zones (sums perfectly to 1.0)
       const baseCurve = [0.06, 0.065, 0.08, 0.085, 0.095, 0.105, 0.105, 0.105, 0.10, 0.08, 0.065, 0.055]; 
       const yearly = activeMarker.val_pvout;
       const cd = monthNames.map((month, i) => ({
         month,
         kwh: Number(((yearly * baseCurve[i]) / daysInMonth[i]).toFixed(2))
       }));
       return {
         chartData: cd,
         yearlyTotal: yearly.toFixed(0),
         dailyAvg: (yearly / 365.25).toFixed(2)
       };
    }
    
    return { chartData: [], yearlyTotal: "0", dailyAvg: "0" };
  }, [activeMarker]);

  // Calculate total area from all markers
  const totalArea = allMarkers.reduce((sum, m) => {
    const areaMatch = m.area?.match(/([\d.]+)/);
    return sum + (areaMatch ? parseFloat(areaMatch[1]) : 0);
  }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 z-10 font-sans">
      {/* Map: Full Screen */}
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 45.5,
          latitude: 35.5,
          zoom: 6.2,
          pitch: 0
        }}
        mapStyle={mapStyle as any}
        style={{ width: '100%', height: '100%' }}
        onClick={() => setShowPanel(false)}
      >
        <NavigationControl position="bottom-right" />

        <Source id="solar-sites" type="geojson" data={`${BASE_PATH}/sites/MESO_Solar.geojson`}>
          <Layer 
            id="solar-sites-fill" 
            type="fill" 
            paint={{
              'fill-color': '#fb8500',
              'fill-opacity': 0.4
            }} 
          />
          <Layer 
            id="solar-sites-line" 
            type="line" 
            paint={{
              'line-color': '#fb8500',
              'line-width': 2
            }} 
          />
        </Source>

        <Source id="mcda-zones" type="geojson" data={`${BASE_PATH}/mcda_zones.geojson`}>
          <Layer 
            id="mcda-zones-fill" 
            type="fill" 
            paint={{
              'fill-color': '#2563eb',
              'fill-opacity': 0.4
            }} 
          />
          <Layer 
            id="mcda-zones-line" 
            type="line" 
            paint={{
              'line-color': '#2563eb',
              'line-width': 2
            }} 
          />
        </Source>

        {allMarkers.map((marker) => (
          <Marker 
            key={marker.id} 
            longitude={marker.coordinates[0]} 
            latitude={marker.coordinates[1]}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(marker);
            }}
          >
            <div className="flex flex-col items-center cursor-pointer group">
              <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold mb-1 shadow-lg transition-all border border-white/20 backdrop-blur-md ${
                activeMarker?.id === marker.id 
                  ? 'bg-amber-500 text-white scale-110' 
                  : (marker.id.toString().startsWith('mcda') 
                     ? 'bg-blue-600/90 text-white group-hover:bg-blue-600' 
                     : 'bg-white/90 text-gray-900 group-hover:bg-white')
              }`}>
                {marker.name}
              </div>
              <div className={`p-1.5 rounded-full shadow-lg border-2 transition-all ${
                activeMarker?.id === marker.id 
                  ? 'bg-amber-500 border-white scale-125' 
                  : (marker.id.toString().startsWith('mcda')
                     ? 'bg-blue-600 border-white group-hover:scale-110 shadow-blue-500/20'
                     : 'bg-white border-amber-500 group-hover:scale-110 shadow-amber-500/20')
              }`}>
                <Sun size={activeMarker?.id === marker.id ? 14 : 12} className={activeMarker?.id === marker.id ? 'text-white' : (marker.id.toString().startsWith('mcda') ? 'text-white' : 'text-amber-500')} />
              </div>
            </div>
          </Marker>
        ))}

        <Source id="kurdistan-region" type="geojson" data={`${BASE_PATH}/sites/Kurdistan-Governorates.geojson`}>
          <Layer 
            id="kurdistan-region-fill" 
            type="fill" 
            paint={{
              'fill-color': '#000000',
              'fill-opacity': 0.1
            }} 
          />
          <Layer 
            id="kurdistan-region-line" 
            type="line" 
            paint={{
              'line-color': '#000000',
              'line-width': 2.5
            }} 
          />
        </Source>
      </Map>

      {/* Floating Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <button 
          onClick={onBack}
          className="text-sm font-bold text-gray-700 hover:text-gray-900 flex items-center transition-all bg-white/80 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-white/50 hover:scale-105 active:scale-95"
        >
          &larr; Back
        </button>
      </div>

      {/* Total Area Box - Bottom Left */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="bg-white/80 backdrop-blur-xl px-4 py-3 rounded-xl shadow-lg border border-white/50 flex flex-col gap-0.5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider leading-none">Total Site Portfolio</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900">{totalArea}</span>
            <span className="text-sm font-bold text-amber-600">km²</span>
          </div>
        </div>
      </div>

      {/* Floating Detail Panel */}
      <AnimatePresence>
        {showPanel && activeMarker && (
          <motion.div 
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute lg:top-12 lg:right-4 lg:bottom-12 w-full lg:w-84 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl p-4 z-30 lg:overflow-y-auto"
          >
{/* Panel Header */}
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 bg-amber-500 rounded-xl text-white">
                    <MapPin size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight leading-none">{activeMarker.name}</h3>
                </div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-7">{activeMarker.region}</p>
              </div>
              <button 
                onClick={() => setShowPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 custom-scrollbar">
              {/* Area */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1.5 text-gray-400">
                  <MapPin size={14} />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Area</span>
                </div>
                <div className="text-sm font-bold text-gray-900">{activeMarker.area}</div>
              </div>

              {/* Solar Chart */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ThermometerSun size={14} className="text-amber-500" />
                    Monthly Solar Yield
                  </h4>
                  <div className="bg-amber-100 px-2.5 py-1 rounded-lg">
                    <span className="text-amber-700 font-bold text-xs">{dailyAvg} kWh/kWp/day</span>
                  </div>
                </div>
                
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorKwhAtlas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fb8500" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#fb8500" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10}
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ color: '#fb8500', fontWeight: 900, fontSize: '12px' }}
                        formatter={(val: number) => [val + " kWh/kWp/day", "Daily Yield"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="kwh" 
                        stroke="#fb8500" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorKwhAtlas)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Yearly Potential</span>
                  <span className="text-sm font-bold text-gray-900">{yearlyTotal} kWh/kWp/yr</span>
                </div>
              </div>

              {/* Next Slide Button */}
              <button 
                onClick={onNext}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg tracking-wider group"
              >
                Site Rankings
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  &rarr;
                </motion.span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show Panel Trigger (if closed) */}
      {!showPanel && activeMarker && (
        <div className="absolute top-1/2 right-0 -translate-y-1/2 z-20">
          <button 
            onClick={() => setShowPanel(true)}
            className="bg-white/80 backdrop-blur-xl p-2.5 rounded-l-lg border-y border-l border-white/50 shadow-lg text-gray-400 hover:text-amber-500 transition-all group"
          >
            <Info size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
