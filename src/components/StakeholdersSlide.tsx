const PAL: Record<string, string> = { "P/C": "#94a3b8", F: "#10b981", E: "#f59e0b" };

const NODES = [
  { id: "planning",  x: 30,  y: 30,  w: 150, h: 90,  letter: "P",  lc: "#475569", lb: "#f1f5f9", lines: ["Ministry of", "Planning"],     sub: "Strategic Oversight" },
  { id: "opm",       x: 375, y: 30,  w: 150, h: 90,  letter: "PM", lc: "#ffffff", lb: "#1e293b", lines: ["Office of", "the P.M."],        sub: "Executive Authority", border: "#1e293b", bw: 2 },
  { id: "finance",   x: 720, y: 30,  w: 150, h: 90,  letter: "F",  lc: "#475569", lb: "#f1f5f9", lines: ["Ministry of", "Finance"],       sub: "Budget & Treasury" },
  { id: "mnr",       x: 30,  y: 275, w: 150, h: 90,  letter: "NR", lc: "#475569", lb: "#f1f5f9", lines: ["Min. Natural", "Resources"],    sub: "Fuel & Resources" },
  { id: "moe",       x: 345, y: 220, w: 210, h: 220, letter: "E",  lc: "#1d4ed8", lb: "#dbeafe", lines: ["Ministry of", "Electricity"],   sub: "Sector Operations", border: "#3b82f6", bw: 2, sections: ["Generation", "Transmission", "Distribution"] },
  { id: "ipp",       x: 30,  y: 530, w: 150, h: 88,  letter: "I",  lc: "#475569", lb: "#f1f5f9", lines: ["IPP"],                          sub: "Private Generation" },
  { id: "customers", x: 720, y: 530, w: 150, h: 88,  letter: "C",  lc: "#475569", lb: "#f1f5f9", lines: ["Customers"],                    sub: "End Users" },
];

function pt(id: string, fx: number, fy: number): [number, number] {
  const n = NODES.find((n) => n.id === id);
  return [n!.x + n!.w * fx, n!.y + n!.h * fy];
}

function H([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, cx: mx, cy: my };
}

function V([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return { d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, cx: mx, cy: my };
}

function L([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return { d: `M${x1},${y1} L${x2},${y2}`, cx: mx, cy: my };
}

function makeEdge(pathData: { d: string; cx: number; cy: number }, type: string) {
  return { d: pathData.d, type, lx: pathData.cx, ly: pathData.cy };
}

const EDGES = [
  // OPM Horizontal Links
  makeEdge(L(pt("opm", 0, 0.35), pt("planning", 1, 0.35)), "P/C"),
  makeEdge(L(pt("opm", 1, 0.35), pt("finance", 0, 0.35)), "P/C"),
  
  // OPM Vertical Link
  makeEdge(V(pt("opm", 0.5, 1), pt("moe", 0.5, 0)), "P/C"),
  
  // Planning Connections
  makeEdge(L(pt("planning", 0.5, 1), pt("mnr", 0.5, 0)), "P/C"),
  makeEdge(V(pt("planning", 0.8, 1), pt("moe", 0.2, 0)), "P/C"),
  
  // Finance to IPP - E curve going below MOE
  { d: `M720,120 C720,580 210,580 180,574`, type: "E", lx: 450, ly: 530 },
  
  // MNR Connections - E goes from MOE main box to MNR
  makeEdge(H(pt("moe", 0, 0.5), pt("mnr", 1, 0.5)), "E"),
  makeEdge(L(pt("mnr", 0.5, 1), pt("ipp", 0.5, 0)), "F"),
  
  // MOE <-> IPP Loop - E goes from IPP to Transmission
  makeEdge(H(pt("ipp", 1, 0.3), pt("moe", 0.038, 0.66)), "E"),
  
  // Customers Connections - 0.962 touches Distribution
  makeEdge(H(pt("moe", 0.962, 0.86), pt("customers", 0, 0.7)), "E"),
  makeEdge(L(pt("customers", 0.5, 0), pt("finance", 0.5, 1)), "E"),
];

const CW = 900, CH = 650;
const FONT = `"Inter", system-ui, -apple-system, sans-serif`;

function NodeShape({ x, y, w, h, letter, lc, lb, lines, sub, border = "#d1d5db", bw = 1.5, sections }: { x: number; y: number; w: number; h: number; letter: string; lc: string; lb: string; lines: string[]; sub: string; border?: string; bw?: number; sections?: string[] }) {
  const hasSec = !!sections;
  const titleY = y + (hasSec ? 30 : lines.length > 1 ? 30 : 36);

  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={12} fill="rgba(0,0,0,0.06)" />
      <rect x={x} y={y} width={w} height={h} rx={12} fill="white" stroke={border} strokeWidth={bw} />

      {lines.map((line, i) => (
        <text
          key={i}
          x={x + w / 2} y={titleY + i * 14}
          textAnchor="middle" fontSize={11} fontWeight="700"
          fill="#0f172a" fontFamily={FONT}
        >{line}</text>
      ))}

      <text
        x={x + w / 2} y={titleY + lines.length * 14 + 6}
        textAnchor="middle" fontSize={7.5} fontWeight="600"
        fill="#94a3b8" fontFamily={FONT}
      >{sub.toUpperCase()}</text>

      {hasSec && (
        <line x1={x + 12} y1={y + 67} x2={x + w - 12} y2={y + 67} stroke="#e2e8ef" strokeWidth={1} />
      )}
      {hasSec && sections!.map((s, i) => {
        const ry = y + 73 + i * 43;
        return (
          <g key={s}>
            <rect x={x + 8} y={ry} width={w - 16} height={34} rx={6} fill="#f8fafc" stroke="#e2e8ef" strokeWidth={1} />
            <text
              x={x + w / 2} y={ry + 17}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8.5} fontWeight="800"
              fill="#475569" fontFamily={FONT}
              letterSpacing="1.5"
            >{s.toUpperCase()}</text>
          </g>
        );
      })}
    </g>
  );
}

function EdgePath({ d, type, lx, ly }: { d: string; type: string; lx: number; ly: number }) {
  const color = PAL[type];
  const markerId = type === "P/C" ? "mPC" : type === "F" ? "mF" : "mE";
  
  const isPC = type === "P/C";
  const isCommercial = type === "E";

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={isPC ? "6,4" : isCommercial ? "7,4" : "none"}
        markerEnd={`url(#${markerId})`}
        style={isCommercial ? { animation: "flowDash 1.4s linear infinite" } : undefined}
      />
      <rect x={lx - 12} y={ly - 9} width={24} height={18} rx={4} fill="white" stroke={color} strokeWidth={1.5} />
      <text
        x={lx} y={ly + 3.5}
        textAnchor="middle" fontSize={8.5} fontWeight="900"
        fill={color} fontFamily={FONT}
      >{type}</text>
    </g>
  );
}

export function StakeholdersSlide({ onBack = () => {}, onNext = () => {} }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#f8fafc", fontFamily: FONT,
      padding: "18px 22px", boxSizing: "border-box", gap: "12px",
    }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#94a3b8", padding: 0, marginBottom: 6, display: "block", letterSpacing: "1px" }}
          >← BACK</button>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Stakeholders Mapping
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 18, background: "white", border: "1px solid #e2e8ef", borderRadius: 12, padding: "9px 16px", alignItems: "center" }}>
            {[
              ["P/C", "Policy / Control", true, false],
              ["F",   "Fuel / Finance",   false, false],
              ["E",   "Commercial",       false, true],
            ].map(([type, label, dashed, animated]: [string, string, boolean, boolean]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="28" height="10" style={{ overflow: "visible" }}>
                  <line
                    x1="2" y1="5" x2="24" y2="5"
                    stroke={PAL[type as keyof typeof PAL]} strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={dashed ? "5,3" : animated ? "6,3" : "none"}
                  />
                  <polygon points="21,2 26,5 21,8" fill={PAL[type as keyof typeof PAL]} />
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onNext}
            style={{ background: "#f97316", color: "white", border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}
          >
            Next
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: "white", borderRadius: 16, border: "1px solid #e2e8ef", overflow: "hidden", minHeight: 0 }}>
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          width="100%" height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        >
          <defs>
            <style>{`
              @keyframes flowDash { to { stroke-dashoffset: -20; } }
            `}</style>

            <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" fill="#dde3ec" />
            </pattern>

            {[
              ["mPC",     PAL["P/C"]],
              ["mF",      PAL["F"]],
              ["mE",      PAL["E"]],
            ].map(([id, color]) => (
              <marker
                key={id} id={id}
                markerWidth="9" markerHeight="7"
                refX="8.5" refY="3.5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0.5 L0,6.5 L8.5,3.5 z" fill={color} />
              </marker>
            ))}
          </defs>

          <rect width={CW} height={CH} fill="url(#dots)" />

          {NODES.map((n) => (
            <NodeShape key={n.id} {...n} />
          ))}

          {EDGES.map((e, i) => (
            <EdgePath key={i} {...e} />
          ))}
        </svg>
      </div>

      
    </div>
  );
}

export default StakeholdersSlide;