import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Map, { MapRef, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Info, Map as MapIcon, Sun, Zap, Loader2, AlertCircle } from 'lucide-react';
import * as GeoTIFF from 'geotiff';

interface GlobeSlideProps {
  onZoomComplete: () => void;
  onBack?: () => void;
}

const getMapStyle = () => ({
  version: 8,
  sources: {
    base: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© ESRI'
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
});

export function GlobeSlide({ onZoomComplete, onBack }: GlobeSlideProps) {
  const mapRef = useRef<MapRef>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tiffError, setTiffError] = useState<string | null>(null);
  const [tiffData, setTiffData] = useState<{ url: string, coordinates: number[][] } | null>(null);
  const [rasterData, setRasterData] = useState<{ rasters: any, bbox: number[], width: number, height: number } | null>(null);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadTiff = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/world/PVOUT_1.tif');
        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load TIFF file`);
        
        const arrayBuffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox();
        const origWidth = image.getWidth();
        const origHeight = image.getHeight();

        // Sample the image to 2048px max dimension to prevent OOM
        const maxDim = 2048;
        const scale = Math.min(maxDim / origWidth, maxDim / origHeight, 1);
        const width = Math.floor(origWidth * scale);
        const height = Math.floor(origHeight * scale);
        
        const rasters = await image.readRasters({ width, height });
        if (!isMounted) return;

        const dataArr = rasters[0] as Float32Array | Uint16Array | Uint8Array;
        
        // Create a canvas to render the TIFF
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);

        // Color scale for PVOUT (roughly 1.0 to 7.0 kWh/kWp/day)
        const getColor = (val: number) => {
          // No-data values check (common in TIFFs: 0, -32768, NaN, etc.)
          if (val <= 0 || val > 100 || isNaN(val)) return [0, 0, 0, 0];
          
          // Normalized between 1.0 and 7.0
          const t = Math.max(0, Math.min(1, (val - 1.0) / 6.0));
          
          // Vibrant Solar Palette: Purple -> Blue -> Yellow -> Orange -> Deep Red
          if (t < 0.25) { // Purple to Blue
            const f = t / 0.25;
            return [76 + (30 - 76) * f, 29 + (64 - 29) * f, 149 + (175 - 149) * f, 200];
          } else if (t < 0.5) { // Blue to Yellow
            const f = (t - 0.25) / 0.25;
            return [30 + (234 - 30) * f, 64 + (179 - 64) * f, 175 + (8 - 175) * f, 200];
          } else if (t < 0.75) { // Yellow to Orange
            const f = (t - 0.5) / 0.25;
            return [234 + (234 - 234) * f, 179 + (88 - 179) * f, 8 + (12 - 8) * f, 200];
          } else { // Orange to Red
            const f = (t - 0.75) / 0.25;
            return [234 + (153 - 234) * f, 88 + (27 - 88) * f, 12 + (27 - 12) * f, 200];
          }
        };

        for (let i = 0; i < dataArr.length; i++) {
          const color = getColor(dataArr[i]);
          const base = i * 4;
          imageData.data[base] = color[0];
          imageData.data[base + 1] = color[1];
          imageData.data[base + 2] = color[2];
          imageData.data[base + 3] = color[3];
        }

        ctx.putImageData(imageData, 0, 0);

        setTiffData({
          url: canvas.toDataURL(),
          coordinates: [
            [bbox[0], bbox[3]], // Top-left
            [bbox[2], bbox[3]], // Top-right
            [bbox[2], bbox[1]], // Bottom-right
            [bbox[0], bbox[1]]  // Bottom-left
          ]
        });

        setRasterData({ rasters, bbox, width, height });
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading TIFF:', err);
        if (isMounted) {
          setTiffError(err?.message || 'Failed to load global solar atlas data.');
          setIsLoading(false);
        }
      }
    };

    loadTiff();
    return () => { isMounted = false; };
  }, []);

  const handleMapClick = (e: any) => {
    if (!rasterData || !e.lngLat) return;
    const { lng, lat } = e.lngLat;
    const { rasters, bbox, width, height } = rasterData;
    const dataArr = rasters[0] as Float32Array | Uint16Array | Uint8Array;

    // Map latitude/longitude to pixel coordinates on the resampled raster
    const x = Math.floor((lng - bbox[0]) / (bbox[2] - bbox[0]) * width);
    const y = Math.floor((bbox[3] - lat) / (bbox[3] - bbox[1]) * height);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = y * width + x;
      const val = dataArr[idx];
      if (val > 0 && val < 99 && !isNaN(val)) {
        setSelectedData({
          lat: lat.toFixed(4),
          lng: lng.toFixed(4),
          dailyPvout: val,
          yearlyPvout: Math.round(val * 365),
          isIraq: (lng > 38 && lng < 49 && lat > 29 && lat < 38)
        });
        setIsPanelOpen(true);
      } else {
        setIsPanelOpen(false);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans z-10 bg-gray-950">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-2xl text-white">
          <Loader2 className="w-16 h-16 text-amber-500 animate-spin mb-6" />
          <h2 className="text-3xl font-light tracking-[0.2em] uppercase">INITIALIZING ATLAS</h2>
          <p className="text-gray-500 mt-3 text-sm font-medium">Processing global satellite data...</p>
        </div>
      )}

      {tiffError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-2xl text-white p-8 text-center">
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-lg">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-3 uppercase tracking-wide">Data Load Failed</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">{tiffError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all shadow-xl shadow-red-600/20"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none">
        {onBack && (
          <button 
            onClick={onBack}
            className="pointer-events-auto text-sm text-gray-400 hover:text-white mb-4 flex items-center transition-all bg-gray-900/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5"
          >
            &larr; Return to National Atlas
          </button>
        )}
      </header>

      {/* Legend */}
      <div className="absolute bottom-10 left-10 z-10 bg-gray-900/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 pointer-events-auto shadow-2xl text-white w-64">
        <h3 className="text-gray-300 font-bold mb-4 text-xs tracking-[0.15em] uppercase flex items-center gap-3">
          <Sun className="w-4 h-4 text-amber-500" /> PVOUT Intensity
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-full h-4 rounded-full bg-gradient-to-r from-[#4c1d95] via-[#1e40af] via-[#eab308] via-[#ea580c] to-[#991b1b]"></div>
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 font-mono font-bold tracking-widest">
          <span>LOW</span>
          <span>MED</span>
          <span>HIGH+</span>
        </div>
        <p className="mt-4 text-[9px] text-gray-500 leading-tight uppercase tracking-wider font-semibold">
          Daily Specific Yield (kWh/kWp)
        </p>
      </div>

      {/* Map Container */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="w-full h-full"
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 25,
            latitude: 25,
            zoom: 2.5
          }}
          mapStyle={getMapStyle() as any}
          onClick={handleMapClick}
        >
          <NavigationControl position="top-right" />
          
          {tiffData && (
            <Source type="image" url={tiffData.url} coordinates={tiffData.coordinates as any}>
              <Layer
                id="global-pvout-layer"
                type="raster"
                paint={{
                  'raster-opacity': 0.85,
                  'raster-fade-duration': 800
                }}
              />
            </Source>
          )}
        </Map>
      </motion.div>

      {/* Floating Panel */}
      {isPanelOpen && selectedData && (
        <motion.div 
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          className="lg:w-80 w-full lg:h-auto lg:absolute lg:right-10 lg:top-1/2 lg:-translate-y-1/2 bg-gray-900/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl p-6 z-30 max-h-[85vh] overflow-y-auto m-6 lg:m-0 text-white"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase mb-2">Location Profile</div>
              <h2 className="text-2xl font-black tracking-tight">SOLAR ANALYSIS</h2>
              <p className="text-gray-500 text-xs mt-1 font-mono">{selectedData.lat}°, {selectedData.lng}°</p>
            </div>
            <button 
              onClick={() => setIsPanelOpen(false)}
              className="text-gray-500 hover:text-white bg-white/5 rounded-full p-2 transition-all hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-amber-500/5 transition-transform group-hover:scale-110 duration-1000">
                <Sun className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-amber-500/80 mb-2">
                  <Zap className="w-4 h-4" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.1em]">Specific Photovoltaic Yield</h3>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tighter">{selectedData.dailyPvout.toFixed(2)}</span>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">kWh/kWp/day</span>
                  </div>
                  <div className="h-px bg-white/5 w-full my-1"></div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-amber-400/90">{selectedData.yearlyPvout.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">kWh/kWp/year</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-500/60 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-200/50 leading-relaxed font-semibold uppercase tracking-wide">
                Values represent theoretical energy yield based on GSA v2025 satellite datasets.
              </p>
            </div>

            <button 
              onClick={() => onZoomComplete()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-600/20 uppercase tracking-[0.15em]"
            >
              <MapIcon className="w-4 h-4" />
              {selectedData.isIraq ? "Enter Iraq Atlas" : "View Detailed Atlas"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Explore Button */}
      {!isPanelOpen && !isLoading && (
        <div className="absolute bottom-10 right-10 z-10">
          <button 
            onClick={() => onZoomComplete()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/30 text-xs"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
