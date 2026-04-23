import { useState, useRef, useCallback, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const BASE_PATH = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

interface NodeRect {
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

type PathStyle = 'org' | 'map';

interface SvgPath {
  d: string;
  style: PathStyle;
  arrow: boolean;
}

function OrgNode({
  label,
  sublabel,
  variant = 'default',
  innerRef,
}: {
  label: string;
  sublabel?: string;
  variant?: 'primary' | 'default' | 'gold' | 'blue';
  innerRef: React.RefObject<HTMLDivElement>;
}) {
  const themes = {
    primary: { bg: '#1e293b', border: '#1e293b', text: '#ffffff' },
    default: { bg: '#ffffff', border: '#d1d5db', text: '#0f172a' },
    gold:    { bg: '#ffffff', border: '#f59e0b', text: '#0f172a' },
    blue:    { bg: '#ffffff', border: '#3b82f6', text: '#0f172a' },
  };
  const t = themes[variant];

  return (
    <div
      ref={innerRef}
      style={{
        background: t.bg,
        border: `1.5px solid ${t.border}`,
        borderRadius: 8,
        padding: '5px 8px',
        textAlign: 'center',
        userSelect: 'none',
        minWidth: 90,
        maxWidth: 140,
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
    >
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: t.text,
        fontFamily: '"Inter", system-ui, sans-serif',
        lineHeight: 1.3,
      }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          fontSize: 6,
          fontWeight: 600,
          color: '#94a3b8',
          letterSpacing: '1px',
          marginTop: 2,
          textTransform: 'uppercase',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

export function StructureSlide({ onBack = () => {}, onNext = () => {} }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  const pmRef    = useRef<HTMLDivElement>(null);
  const cosRef   = useRef<HTMLDivElement>(null);
  const ibkRef   = useRef<HTMLDivElement>(null);
  const dcosRef  = useRef<HTMLDivElement>(null);
  const moeRef   = useRef<HTMLDivElement>(null);
  const runakiRef = useRef<HTMLDivElement>(null);

  const dpmRef = useRef<HTMLDivElement>(null);
  const caRef  = useRef<HTMLDivElement>(null);
  const ibsRef = useRef<HTMLDivElement>(null);

  const erbilDotRef = useRef<HTMLDivElement>(null);
  const duhokDotRef = useRef<HTMLDivElement>(null);
  const sulayDotRef = useRef<HTMLDivElement>(null);
  const koyaDotRef  = useRef<HTMLDivElement>(null);
  const koyaBoxRef = useRef<HTMLDivElement>(null);

  const [svgPaths, setSvgPaths] = useState<SvgPath[]>([]);
  const [svgDims, setSvgDims]   = useState({ w: 0, h: 0 });

  const compute = useCallback(() => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    setSvgDims({ w: cr.width, h: cr.height });

    const rel = (ref: React.RefObject<HTMLDivElement>): NodeRect | null => {
      if (!ref.current) return null;
      const r = ref.current.getBoundingClientRect();
      return {
        top:    r.top    - cr.top,
        bottom: r.bottom - cr.top,
        cx:     (r.left + r.right) / 2 - cr.left,
        cy:     (r.top + r.bottom) / 2 - cr.top,
      };
    };

    const paths: SvgPath[] = [];

    const scurve = (
      x1: number, y1: number,
      x2: number, y2: number,
      style: PathStyle,
      arrow: boolean
    ) => {
      const midY = (y1 + y2) / 2;
      paths.push({ d: `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`, style, arrow });
    };

    const vline = (x: number, y1: number, y2: number, arrow: boolean) =>
      paths.push({ d: `M${x},${y1} L${x},${y2}`, style: 'org', arrow });

    const hline = (x1: number, x2: number, y: number) =>
      paths.push({ d: `M${x1},${y} L${x2},${y}`, style: 'org', arrow: false });

    const pm  = rel(pmRef);
    const cos = rel(cosRef);
    if (pm && cos) scurve(pm.cx, pm.bottom, cos.cx, cos.top, 'org', true);

    const ibk  = rel(ibkRef);
    const dcos = rel(dcosRef);
    const moe  = rel(moeRef);
    if (cos && ibk && dcos && moe) {
      const junctionY = (cos.bottom + Math.min(ibk.top, dcos.top, moe.top)) / 2;
      vline(cos.cx, cos.bottom, junctionY, false);
      hline(ibk.cx, moe.cx, junctionY);
      vline(ibk.cx,  junctionY, ibk.top,  true);
      vline(dcos.cx, junctionY, dcos.top, true);
      vline(moe.cx,  junctionY, moe.top,  true);
    }

    const runaki = rel(runakiRef);
    if (dcos && runaki) vline(dcos.cx, dcos.bottom, runaki.top, true);

    const dpm = rel(dpmRef);
    const ca  = rel(caRef);
    if (dpm && ca) scurve(dpm.cx, dpm.bottom, ca.cx, ca.top, 'org', true);

    const ibs = rel(ibsRef);
    if (ca && ibs) scurve(ca.cx, ca.bottom, ibs.cx, ibs.top, 'org', true);

    const erbil = rel(erbilDotRef);
    const duhok = rel(duhokDotRef);
    const sulay = rel(sulayDotRef);
    const koya = rel(koyaDotRef);
    const koyaBox = rel(koyaBoxRef);
    if (pm && erbil) scurve(pm.cx, pm.top, erbil.cx, erbil.cy, 'map', true);
    if (pm && duhok) scurve(pm.cx, pm.top, duhok.cx, duhok.cy, 'map', true);
    if (dpm && sulay) scurve(dpm.cx, dpm.top, sulay.cx, sulay.cy, 'map', true);

    setSvgPaths(paths);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const id = setTimeout(compute, 150);
    return () => clearTimeout(id);
  }, [mapReady, compute]);

  useEffect(() => {
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [compute]);

  const CITIES = [
    { name: 'Erbil',         lon: 44.0092, lat: 36.1911, dotRef: erbilDotRef, color: '#64748b' },
    { name: 'Duhok',         lon: 42.9888, lat: 36.8665, dotRef: duhokDotRef, color: '#64748b' },
    { name: 'Sulaymaniyah',  lon: 45.4338, lat: 35.5617, dotRef: sulayDotRef, color: '#64748b' },
    { name: 'Koysinjaq',     lon: 45.35, lat: 36.10, dotRef: koyaDotRef, color: '#64748b' },
    { name: 'Halabja',       lon: 45.9536, lat: 35.2078, dotRef: undefined, color: '#64748b' },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        position: 'relative',
        padding: '18px 22px',
        boxSizing: 'border-box',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '1px', padding: 0, marginBottom: 6, display: 'block' }}
          >
            ← BACK
          </button>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Regional Administration
          </h2>
          
        </div>

        <button
          onClick={onNext}
          style={{ background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          Next →
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: '500px', paddingBottom: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <Map
          initialViewState={{ longitude: 44.2, latitude: 36.0, zoom: 6.0 }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          dragPan={false} scrollZoom={false} boxZoom={false}
          doubleClickZoom={false} dragRotate={false} touchZoomRotate={false}
          onLoad={() => setMapReady(true)}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <Source id="kurdistan-boundary" type="geojson" data={`${BASE_PATH}/sites/Kurdistan Region-Governorates.geojson`}>
            <Layer id="boundary-fill" type="fill" paint={{ 'fill-color': ['match', ['get', 'name'],
              'Erbil Governorate', '#f59e0b',
              'Duhok Governorate', '#f59e0b',
              'Sulaimaniya Governorate', '#10b981',
              'Halabja Governorate', '#10b981',
              '#3b82f6'], 'fill-opacity': 0.3 }} />
            <Layer id="boundary-line" type="line" paint={{ 'line-color': '#94a3b8', 'line-width': 1.5 }} />
          </Source>

          <Source id="koya-boundary" type="geojson" data={`${BASE_PATH}/koya.geojson`}>
            <Layer id="koya-fill" type="fill" paint={{ 'fill-color': '#e2e8f0', 'fill-opacity': 0.8 }} />
            <Layer id="koya-line" type="line" paint={{ 'line-color': '#94a3b8', 'line-width': 1.5, 'line-dasharray': [4, 4] }} />
          </Source>

          {CITIES.map(city => (
            <Marker key={city.name} longitude={city.lon} latitude={city.lat} anchor="bottom">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: city.name === 'Koysinjaq' ? '#e2e8f0' : '#0f172a', color: city.name === 'Koysinjaq' ? '#64748b' : '#fff', padding: '3px 8px', borderRadius: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.4px', whiteSpace: 'nowrap', border: city.name === 'Koysinjaq' ? '2px dashed #94a3b8' : 'none' }}>
                  {city.name}
                </div>
                <div
                  ref={city.dotRef}
                  style={{ width: 10, height: 10, background: city.color, borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', marginTop: 3 }}
                />
              </div>
            </Marker>
          ))}

          <Marker longitude={44.72} latitude={36.07} anchor="bottom-left">
            <div ref={koyaBoxRef} style={{ background: '#ffffff', border: '1px solid #94a3b8', borderRadius: 6, padding: '4px 8px', fontSize: 8, fontWeight: 700, color: '#64748b', textAlign: 'center', lineHeight: 1.3, maxWidth: 120, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              PUK affiliated · Erbil mgmt
            </div>
          </Marker>
        </Map>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 35%, rgba(248,250,252,0.4) 70%, rgba(248,250,252,0.85) 100%)',
          pointerEvents: 'none',
        }} />
        </div>

        <div style={{ position: 'absolute', top: 250, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', gap: 20, pointerEvents: 'none' }}>
          
          <div style={{ marginLeft: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, pointerEvents: 'auto' }}>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: '#3b82f6', letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 4 }}>
              Branch A · Erbil / Duhok
            </div>
            <OrgNode innerRef={pmRef} label="Prime Minister" sublabel="PM" variant="primary" />
            <OrgNode innerRef={cosRef} label="Chief of Staff" variant="default" />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <OrgNode innerRef={ibkRef} label="Investment Board" sublabel="Kurdistan" variant="gold" />
              <OrgNode innerRef={dcosRef} label="Deputy COS" variant="default" />
              <OrgNode innerRef={moeRef} label="Minister of Electricity" variant="blue" />
            </div>
            <OrgNode innerRef={runakiRef} label="Runaki" sublabel="Energy Office" variant="gold" />
          </div>
          <div style={{ marginRight: 60, marginLeft: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, pointerEvents: 'auto' }}>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: '#d97706', letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 4 }}>
              Branch B · Sulaymaniyah
            </div>
            <OrgNode innerRef={dpmRef} label="Deputy Prime Minister" sublabel="DPM" variant="primary" />
            <OrgNode innerRef={caRef} label="Chief Advisor" variant="default" />
            <OrgNode innerRef={ibsRef} label="Investment Board" sublabel="Sulaymaniyah" variant="gold" />
          </div>
        </div>
      </div>

      {svgDims.w > 0 && (
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={svgDims.w}
          height={svgDims.h}
        >
          <defs>
            <marker id="arr-org" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#94a3b8" />
            </marker>
            <marker id="arr-map" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#2563eb" />
            </marker>
          </defs>

          {svgPaths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.style === 'map' ? '#2563eb' : '#94a3b8'}
              strokeWidth={1.5}
              strokeDasharray={p.style === 'map' ? '5,3' : undefined}
              strokeLinecap="round"
              strokeOpacity={p.style === 'map' ? 0.6 : 0.75}
              markerEnd={p.arrow ? `url(#arr-${p.style === 'map' ? 'map' : 'org'})` : undefined}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export default StructureSlide;