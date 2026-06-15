// CalcIcon.tsx — presentational component, no "use client" needed
// Inline SVG structural schematics for each calc archetype.
// Props: icon (archetype key), size (px, default 48)
// All icons use viewBox="0 0 64 48", navy line-art + amber primary member + light fill secondary.

// Color constants (CSS var with fallback so it works in both Next context and static HTML)
// --are-navy      #1a2b5f  — outlines, structural lines
// --are-navy-mid  #2e4a8a  — secondary structure, text
// #fde68a (amber) — designed/primary member fill
// #dbe2f0         — secondary member fill
// --are-muted     #5c6a85  — soil, dims, supports, hatching

type CalcIconProps = {
  icon: string;
  size?: number;
};

export default function CalcIcon({ icon, size = 48 }: CalcIconProps) {
  const w = size;
  const h = Math.round(size * 0.75); // maintain 64:48 aspect ratio
  const svg = ICON_MAP[icon] ?? ICON_MAP["beam-udl"];

  return (
    <svg
      viewBox="0 0 64 48"
      width={w}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {svg}
    </svg>
  );
}

// ─── Shared defs (hatching pattern for soil/concrete) ───────────────────────
// Each icon is a JSX fragment of SVG elements only (no <svg> wrapper).

const ICON_MAP: Record<string, React.ReactNode> = {

  // ── beam-udl: simply-supported beam with uniform distributed load ──────────
  "beam-udl": (
    <>
      {/* Supports (triangles) */}
      <polygon points="8,36 14,36 11,30" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5" strokeLinejoin="round"/>
      <polygon points="50,36 56,36 53,30" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Ground lines */}
      <line x1="6" y1="36.5" x2="16" y2="36.5" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <line x1="48" y1="36.5" x2="58" y2="36.5" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Beam — amber fill */}
      <rect x="10" y="24" width="44" height="7" rx="0.5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* UDL arrows */}
      {[14,21,28,35,42,49].map((x,i) => (
        <line key={i} x1={x} y1="16" x2={x} y2="23" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2" markerEnd="url(#arr)"/>
      ))}
      <line x1="12" y1="16" x2="52" y2="16" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      <defs>
        <marker id="arr" markerWidth="4" markerHeight="4" refX="2" refY="3" orient="auto">
          <path d="M0,0 L4,0 L2,3.5 Z" fill="var(--are-navy,#1a2b5f)"/>
        </marker>
      </defs>
    </>
  ),

  // ── cantilever: cantilever beam with point load ────────────────────────────
  "cantilever": (
    <>
      {/* Wall (left) */}
      <rect x="4" y="16" width="6" height="20" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Hatch lines on wall */}
      {[18,22,26,30,34].map((y,i) => <line key={i} x1="4" y1={y} x2="10" y2={y-4} stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.5"/>)}
      {/* Beam — amber */}
      <rect x="9" y="23" width="42" height="7" rx="0.5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Point load arrow at tip */}
      <line x1="52" y1="10" x2="52" y2="22" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="49,21 55,21 52,24" fill="var(--are-navy,#1a2b5f)"/>
      {/* P label */}
      <text x="55" y="14" fontSize="7" fontFamily="Arial" fill="var(--are-navy,#1a2b5f)" fontWeight="700">P</text>
    </>
  ),

  // ── beam-cantilever: same as cantilever (alias) ────────────────────────────
  "beam-cantilever": (
    <>
      <rect x="4" y="16" width="6" height="20" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {[18,22,26,30,34].map((y,i) => <line key={i} x1="4" y1={y} x2="10" y2={y-4} stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.5"/>)}
      <rect x="9" y="23" width="42" height="7" rx="0.5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <line x1="52" y1="10" x2="52" y2="22" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="49,21 55,21 52,24" fill="var(--are-navy,#1a2b5f)"/>
      <text x="55" y="14" fontSize="7" fontFamily="Arial" fill="var(--are-navy,#1a2b5f)" fontWeight="700">P</text>
    </>
  ),

  // ── channel-bearing: channel section on bearing (joist end) ───────────────
  "channel-bearing": (
    <>
      {/* Bearing wall / support below */}
      <rect x="8" y="34" width="48" height="8" rx="0.5" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Bearing plate — amber */}
      <rect x="22" y="30" width="20" height="5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Channel web (vertical) */}
      <line x1="32" y1="10" x2="32" y2="30" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2.5"/>
      {/* Channel flanges */}
      <line x1="26" y1="10" x2="38" y2="10" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2.5"/>
      <line x1="26" y1="18" x2="38" y2="18" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2.5"/>
      {/* Load arrow */}
      <line x1="32" y1="3" x2="32" y2="9" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="29,8 35,8 32,11" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── base-plate: column + base plate + anchor bolts on pedestal ────────────
  "base-plate": (
    <>
      {/* Concrete pedestal */}
      <rect x="16" y="30" width="32" height="12" rx="0.5" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Base plate — amber */}
      <rect x="14" y="26" width="36" height="5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Column (W section stub) */}
      <rect x="28" y="6" width="8" height="21" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Column flanges */}
      <line x1="24" y1="6" x2="40" y2="6" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      <line x1="24" y1="14" x2="40" y2="14" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      {/* Anchor bolts */}
      <line x1="20" y1="25" x2="20" y2="40" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5" strokeDasharray="2,1.5"/>
      <line x1="44" y1="25" x2="44" y2="40" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5" strokeDasharray="2,1.5"/>
      <circle cx="20" cy="24" r="2" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      <circle cx="44" cy="24" r="2" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      {/* Axial load */}
      <line x1="32" y1="2" x2="32" y2="5" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="29,4 35,4 32,7" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── gusset-brace: diagonal brace meeting gusset at column ─────────────────
  "gusset-brace": (
    <>
      {/* Column */}
      <rect x="4" y="4" width="10" height="40" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Beam (horizontal) */}
      <rect x="14" y="4" width="46" height="10" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Gusset plate — amber */}
      <polygon points="14,14 38,14 14,36" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Brace line */}
      <line x1="38" y1="14" x2="58" y2="40" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2.5"/>
      {/* Bolts on gusset */}
      <circle cx="20" cy="20" r="2" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      <circle cx="22" cy="27" r="2" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
    </>
  ),

  // ── hss-joint: HSS branch connecting into HSS chord ───────────────────────
  "hss-joint": (
    <>
      {/* Chord (horizontal HSS) */}
      <rect x="4" y="18" width="56" height="12" rx="1" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Branch (vertical HSS) — amber */}
      <rect x="26" y="4" width="12" height="16" rx="1" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Weld symbol marks */}
      <line x1="26" y1="19" x2="24" y2="22" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      <line x1="38" y1="19" x2="40" y2="22" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      {/* Force arrows */}
      <line x1="32" y1="2" x2="32" y2="3" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="29,3 35,3 32,6" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── diaphragm: plan view rectangle with chord/shear arrows ────────────────
  "diaphragm": (
    <>
      {/* Diaphragm plan rectangle */}
      <rect x="8" y="10" width="48" height="28" fill="#fde68a" fillOpacity="0.35" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Shear walls (bold edges) */}
      <line x1="8" y1="10" x2="8" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="3.5"/>
      <line x1="56" y1="10" x2="56" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="3.5"/>
      {/* Chord lines (top/bottom — amber) */}
      <line x1="8" y1="10" x2="56" y2="10" stroke="#fde68a" strokeWidth="3"/>
      <line x1="8" y1="38" x2="56" y2="38" stroke="#fde68a" strokeWidth="3"/>
      {/* Outline over chord */}
      <line x1="8" y1="10" x2="56" y2="10" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <line x1="8" y1="38" x2="56" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Lateral load arrows */}
      <line x1="2" y1="20" x2="7" y2="20" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="5,18 8,20 5,22" fill="var(--are-muted,#5c6a85)"/>
      <line x1="2" y1="28" x2="7" y2="28" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="5,26 8,28 5,30" fill="var(--are-muted,#5c6a85)"/>
      {/* Diagonal shear pattern lines */}
      {[12,20,28,36,44,52].map((x,i) => <line key={i} x1={x} y1="10" x2={x-8} y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.6" opacity="0.25"/>)}
    </>
  ),

  // ── shearwall: wall panel with holddown and shear force ───────────────────
  "shearwall": (
    <>
      {/* Sill plate */}
      <rect x="8" y="39" width="48" height="5" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Wall panel — amber */}
      <rect x="10" y="10" width="44" height="30" fill="#fde68a" fillOpacity="0.4" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Sheathing diagonal */}
      <line x1="10" y1="40" x2="54" y2="10" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1" opacity="0.4"/>
      {/* Holddown (post + anchor) at corners */}
      <rect x="10" y="10" width="5" height="30" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <rect x="49" y="10" width="5" height="30" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Uplift arrow */}
      <line x1="12.5" y1="9" x2="12.5" y2="4" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="10,5 15,5 12.5,2" fill="var(--are-muted,#5c6a85)"/>
      {/* Lateral arrow */}
      <line x1="60" y1="20" x2="55" y2="20" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.5"/>
      <polygon points="57,18 54,20 57,22" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

  // ── wind-building: building elevation with wind pressure arrows ───────────
  "wind-building": (
    <>
      {/* Ground line */}
      <line x1="8" y1="40" x2="56" y2="40" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      {/* Building box */}
      <rect x="20" y="10" width="30" height="30" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Roof triangle — amber */}
      <polygon points="18,10 52,10 35,3" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Wind arrows (windward) */}
      {[15,22,29].map((y,i) => (
        <g key={i}>
          <line x1="6" y1={y} x2="18" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="1.2"/>
          <polygon points={`16,${y-2} 20,${y} 16,${y+2}`} fill="var(--are-muted,#5c6a85)"/>
        </g>
      ))}
      {/* Leeward suction arrows */}
      {[15,22,29].map((y,i) => (
        <g key={i}>
          <line x1="52" y1={y} x2="60" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="1.2"/>
          <polygon points={`54,${y-2} 50,${y} 54,${y+2}`} fill="var(--are-muted,#5c6a85)"/>
        </g>
      ))}
    </>
  ),

  // ── snow-roof: pitched roof with snow drift ────────────────────────────────
  "snow-roof": (
    <>
      {/* Building walls */}
      <rect x="12" y="26" width="40" height="16" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Roof plane — amber */}
      <polygon points="10,26 32,10 54,26" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Snow (filled polygon above roof, lighter) */}
      <polygon points="10,26 32,10 54,26 58,26 58,20 32,6 6,20 6,26" fill="white" fillOpacity="0.85" stroke="var(--are-muted,#5c6a85)" strokeWidth="1"/>
      {/* Snow fill */}
      <polygon points="10,26 32,10 54,26" fill="#dbe2f0" fillOpacity="0.7"/>
      {/* Drift hatch lines */}
      {[12,20,28,36,44,52].map((x,i) => (
        <line key={i} x1={x} y1="26" x2={x+1} y2="23" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.7" opacity="0.5"/>
      ))}
      {/* Snow depth arrow */}
      <line x1="58" y1="10" x2="58" y2="24" stroke="var(--are-muted,#5c6a85)" strokeWidth="1" strokeDasharray="2,1"/>
      {/* Ground line */}
      <line x1="8" y1="43" x2="56" y2="43" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
    </>
  ),

  // ── seismic-building: building with soft story / irregularity ─────────────
  "seismic-building": (
    <>
      {/* Ground line */}
      <line x1="8" y1="42" x2="56" y2="42" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.5"/>
      {/* Story 1 — wider / weak story highlighted amber */}
      <rect x="12" y="28" width="40" height="13" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Story 2 */}
      <rect x="15" y="16" width="34" height="13" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Story 3 */}
      <rect x="18" y="6" width="28" height="11" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Lateral arrows (seismic) */}
      <line x1="3" y1="34" x2="11" y2="34" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="9,32 13,34 9,36" fill="var(--are-muted,#5c6a85)"/>
      <line x1="3" y1="22" x2="14" y2="22" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.1"/>
      <polygon points="12,20 15,22 12,24" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

  // ── cmu-wall: CMU block courses with rebar ────────────────────────────────
  "cmu-wall": (
    <>
      {/* Block courses — 4 courses of 2 blocks */}
      {[10,19,28,37].map((y,row) => (
        <g key={row}>
          <rect x="8" y={y} width="22" height="8" rx="0.5" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
          <rect x="32" y={y} width="22" height="8" rx="0.5" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
        </g>
      ))}
      {/* Vertical rebar — amber */}
      <line x1="22" y1="8" x2="22" y2="46" stroke="#fde68a" strokeWidth="3" strokeLinecap="round"/>
      <line x1="22" y1="8" x2="22" y2="46" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Horizontal bond beam rebar */}
      <line x1="6" y1="27" x2="56" y2="27" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2" strokeDasharray="3,2"/>
      {/* Grout fill (hatching in one cell) */}
      <rect x="32" y="19" width="22" height="8" fill="#fde68a" fillOpacity="0.4" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Load arrow */}
      <line x1="32" y1="4" x2="32" y2="9" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="29,8 35,8 32,11" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── lintel-opening: masonry wall with opening and lintel beam ─────────────
  "lintel-opening": (
    <>
      {/* Wall segments left of opening */}
      <rect x="4" y="8" width="14" height="36" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Wall segments right of opening */}
      <rect x="46" y="8" width="14" height="36" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Lintel — amber */}
      <rect x="4" y="8" width="56" height="8" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Opening void */}
      <rect x="18" y="16" width="28" height="28" fill="white" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      {/* Jamb rebar (dashed) */}
      <line x1="16" y1="16" x2="16" y2="43" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3" strokeDasharray="2,2"/>
      <line x1="48" y1="16" x2="48" y2="43" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3" strokeDasharray="2,2"/>
      {/* Load arrows on lintel */}
      {[10,22,34,46,58].map((x,i) => (
        <line key={i} x1={x} y1="4" x2={x} y2="7" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      ))}
      <line x1="6" y1="4" x2="58" y2="4" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
    </>
  ),

  // ── anchor-masonry: anchor bolt in CMU wall section ───────────────────────
  "anchor-masonry": (
    <>
      {/* CMU wall (elevation) */}
      <rect x="4" y="4" width="56" height="40" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Block course lines */}
      <line x1="4" y1="18" x2="60" y2="18" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.5"/>
      <line x1="4" y1="30" x2="60" y2="30" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.5"/>
      {/* Mid-wall vertical line */}
      <line x1="32" y1="4" x2="32" y2="44" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.5"/>
      {/* Bearing ledger plate — amber */}
      <rect x="14" y="2" width="36" height="5" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Anchor bolt — amber fill */}
      <rect x="28" y="5" width="8" height="22" rx="1" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Nut / head */}
      <rect x="26" y="2" width="12" height="4" rx="0.5" fill="var(--are-navy,#1a2b5f)"/>
      {/* Projected breakout cone dashes */}
      <line x1="32" y1="5" x2="10" y2="35" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.9" strokeDasharray="3,2"/>
      <line x1="32" y1="5" x2="54" y2="35" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.9" strokeDasharray="3,2"/>
      {/* Tension arrow */}
      <line x1="32" y1="0" x2="32" y2="2" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="29,2 35,2 32,5" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── dev-lap-splice: reinforcing bar with lap splice zone ──────────────────
  "dev-lap-splice": (
    <>
      {/* Bar 1 — amber */}
      <rect x="4" y="20" width="38" height="8" rx="2" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Bar 2 — offset below */}
      <rect x="22" y="30" width="38" height="8" rx="2" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Splice zone bracket */}
      <line x1="22" y1="17" x2="22" y2="41" stroke="var(--are-muted,#5c6a85)" strokeWidth="1" strokeDasharray="2,1.5"/>
      <line x1="42" y1="17" x2="42" y2="41" stroke="var(--are-muted,#5c6a85)" strokeWidth="1" strokeDasharray="2,1.5"/>
      <line x1="22" y1="17" x2="42" y2="17" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.9"/>
      <line x1="22" y1="41" x2="42" y2="41" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.9"/>
      {/* "ls" label */}
      <text x="28" y="13" fontSize="7" fontFamily="Arial" fill="var(--are-muted,#5c6a85)" fontWeight="600">ls</text>
      {/* Development extension arrows */}
      <line x1="4" y1="24" x2="2" y2="24" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      <polygon points="4,22 0,24 4,26" fill="var(--are-navy,#1a2b5f)"/>
      <line x1="60" y1="34" x2="62" y2="34" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      <polygon points="60,32 64,34 60,36" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── steel-joist: open web steel joist ────────────────────────────────────
  "steel-joist": (
    <>
      {/* Top chord — amber */}
      <line x1="6" y1="14" x2="58" y2="14" stroke="#fde68a" strokeWidth="4" strokeLinecap="round"/>
      <line x1="6" y1="14" x2="58" y2="14" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Bottom chord */}
      <line x1="8" y1="36" x2="56" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      {/* Web diagonals (Warren pattern) */}
      {[0,1,2,3,4,5].map((i) => (
        <line key={i}
          x1={8 + i*8} y1={i%2===0 ? 14 : 36}
          x2={16 + i*8} y2={i%2===0 ? 36 : 14}
          stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      ))}
      {/* Verticals at ends */}
      <line x1="8" y1="14" x2="8" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.8"/>
      <line x1="56" y1="14" x2="56" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.8"/>
      {/* Support triangles */}
      <polygon points="4,37 12,37 8,42" fill="var(--are-muted,#5c6a85)" fillOpacity="0.5" stroke="var(--are-muted,#5c6a85)" strokeWidth="1"/>
      <polygon points="52,37 60,37 56,42" fill="var(--are-muted,#5c6a85)" fillOpacity="0.5" stroke="var(--are-muted,#5c6a85)" strokeWidth="1"/>
      {/* UDL */}
      <line x1="8" y1="10" x2="56" y2="10" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.9"/>
      {[14,24,34,44,54].map((x,i) => <line key={i} x1={x} y1="10" x2={x} y2="13" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.9"/>)}
    </>
  ),

  // ── web-opening: W-shape beam with a circular opening in web ─────────────
  "web-opening": (
    <>
      {/* Supports */}
      <polygon points="6,38 12,38 9,34" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="52,38 58,38 55,34" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <line x1="4" y1="38" x2="14" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <line x1="50" y1="38" x2="60" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Top flange */}
      <rect x="8" y="14" width="48" height="4" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Bottom flange */}
      <rect x="8" y="30" width="48" height="4" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Web — amber */}
      <rect x="10" y="18" width="44" height="12" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Circular opening */}
      <circle cx="32" cy="24" r="5" fill="white" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Reinforcing ring (optional dashed) */}
      <circle cx="32" cy="24" r="7" fill="none" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.8" strokeDasharray="2,2"/>
    </>
  ),

  // ── web-stiffener: I-beam with transverse stiffener plates ────────────────
  "web-stiffener": (
    <>
      {/* Top flange */}
      <rect x="8" y="12" width="48" height="4" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Bottom flange */}
      <rect x="8" y="32" width="48" height="4" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Web */}
      <rect x="10" y="16" width="44" height="16" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Stiffener plates — amber */}
      <rect x="27" y="12" width="4" height="24" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <rect x="33" y="12" width="4" height="24" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Concentrated load arrow */}
      <line x1="32" y1="5" x2="32" y2="11" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="29,10 35,10 32,13" fill="var(--are-navy,#1a2b5f)"/>
      {/* Reaction arrows */}
      <line x1="12" y1="42" x2="12" y2="36" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.2"/>
      <polygon points="9,38 15,38 12,35" fill="var(--are-muted,#5c6a85)"/>
      <line x1="52" y1="42" x2="52" y2="36" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.2"/>
      <polygon points="49,38 55,38 52,35" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

  // ── plate-bending: rectangular flat plate/bar in bending ──────────────────
  "plate-bending": (
    <>
      {/* Fixed wall left */}
      <rect x="4" y="12" width="6" height="26" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {[16,20,24,28,32,36].map((y,i) => <line key={i} x1="4" y1={y} x2="10" y2={y-4} stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" opacity="0.45"/>)}
      {/* Plate — amber, slightly curved top to suggest bending */}
      <path d="M10,22 Q36,18 58,28" stroke="#fde68a" strokeWidth="7" strokeLinecap="round" fill="none"/>
      <path d="M10,22 Q36,18 58,28" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Neutral axis (dashed) */}
      <path d="M10,25 Q36,22 58,31" stroke="var(--are-muted,#5c6a85)" strokeWidth="0.8" strokeDasharray="3,2" fill="none"/>
      {/* Load at tip */}
      <line x1="58" y1="18" x2="58" y2="27" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="55,26 61,26 58,29" fill="var(--are-navy,#1a2b5f)"/>
      <text x="60" y="16" fontSize="7" fontFamily="Arial" fill="var(--are-navy,#1a2b5f)" fontWeight="700">P</text>
    </>
  ),

  // ── retaining-wall: cantilever retaining wall with soil ───────────────────
  "retaining-wall": (
    <>
      {/* Soil (right of stem) — hatched fill */}
      <rect x="32" y="6" width="28" height="36" fill="var(--are-muted,#5c6a85)" fillOpacity="0.18"/>
      {[6,12,18,24,30,36].map((y,i) => (
        <line key={i} x1="32" y1={y} x2={60} y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="0.7" opacity="0.45"/>
      ))}
      {/* Footing — amber */}
      <rect x="10" y="36" width="50" height="8" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Stem */}
      <rect x="26" y="8" width="10" height="30" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Rebar in stem (dashed) */}
      <line x1="29" y1="8" x2="29" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3" strokeDasharray="2,2"/>
      <line x1="33" y1="8" x2="33" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3" strokeDasharray="2,2"/>
      {/* Active pressure arrow */}
      <line x1="26" y1="18" x2="20" y2="18" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="22,16 19,18 22,20" fill="var(--are-muted,#5c6a85)"/>
      <line x1="26" y1="28" x2="16" y2="28" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.6"/>
      <polygon points="18,26 15,28 18,30" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

  // ── straight-pier: straight shaft drilled pier in soil ────────────────────
  "straight-pier": (
    <>
      {/* Soil background */}
      <rect x="4" y="12" width="56" height="34" fill="var(--are-muted,#5c6a85)" fillOpacity="0.15"/>
      {/* Soil hatch */}
      {[14,20,26,32,38,44].map((y,i) => (
        <line key={i} x1="4" y1={y} x2="60" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="0.7" opacity="0.4"/>
      ))}
      {/* Grade line */}
      <line x1="4" y1="12" x2="60" y2="12" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.5"/>
      {/* Pier shaft — amber */}
      <rect x="24" y="8" width="16" height="36" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Rebar lines in shaft */}
      <line x1="27" y1="8" x2="27" y2="44" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1" strokeDasharray="2,2"/>
      <line x1="37" y1="8" x2="37" y2="44" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1" strokeDasharray="2,2"/>
      {/* Skin friction arrows (right side) */}
      {[18,24,30,36,42].map((y,i) => (
        <line key={i} x1="44" y1={y} x2="40" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="1"/>
      ))}
      {/* Load arrow */}
      <line x1="32" y1="2" x2="32" y2="7" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="29,6 35,6 32,9" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── belled-pier: drilled pier with bell end ───────────────────────────────
  "belled-pier": (
    <>
      {/* Soil */}
      <rect x="4" y="10" width="56" height="36" fill="var(--are-muted,#5c6a85)" fillOpacity="0.15"/>
      {[12,18,24,30,36].map((y,i) => (
        <line key={i} x1="4" y1={y} x2="60" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="0.7" opacity="0.4"/>
      ))}
      <line x1="4" y1="10" x2="60" y2="10" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.5"/>
      {/* Shaft — amber */}
      <rect x="26" y="6" width="12" height="28" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Bell — amber, wider trapezoid */}
      <polygon points="18,34 46,34 46,46 18,46" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Bell sides angled */}
      <polygon points="22,34 42,34 46,42 18,42" fill="#fde68a" fillOpacity="0.5"/>
      {/* Rebar dashes in shaft */}
      <line x1="29" y1="6" x2="29" y2="33" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1" strokeDasharray="2,2"/>
      <line x1="35" y1="6" x2="35" y2="33" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1" strokeDasharray="2,2"/>
      {/* Load */}
      <line x1="32" y1="1" x2="32" y2="5" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <polygon points="29,4 35,4 32,7" fill="var(--are-navy,#1a2b5f)"/>
    </>
  ),

  // ── slab-footing: spread footing / slab-on-grade ──────────────────────────
  "slab-footing": (
    <>
      {/* Soil below */}
      <rect x="4" y="28" width="56" height="18" fill="var(--are-muted,#5c6a85)" fillOpacity="0.18"/>
      {[30,35,40,45].map((y,i) => (
        <line key={i} x1="4" y1={y} x2="60" y2={y} stroke="var(--are-muted,#5c6a85)" strokeWidth="0.7" opacity="0.4"/>
      ))}
      {/* Footing (slab) — amber */}
      <rect x="8" y="22" width="48" height="10" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Rebar in slab (horizontal) */}
      <line x1="10" y1="27" x2="54" y2="27" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2" strokeDasharray="3,2"/>
      {/* Column stub */}
      <rect x="26" y="8" width="12" height="15" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Load */}
      <line x1="32" y1="3" x2="32" y2="7" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="29,6 35,6 32,9" fill="var(--are-navy,#1a2b5f)"/>
      {/* Bearing pressure arrows (downward from slab) */}
      {[12,22,32,42,52].map((x,i) => (
        <line key={i} x1={x} y1="33" x2={x} y2="37" stroke="var(--are-muted,#5c6a85)" strokeWidth="1"/>
      ))}
    </>
  ),

  // ── concrete-beam: rectangular concrete beam with rebar ───────────────────
  "concrete-beam": (
    <>
      {/* Supports */}
      <polygon points="6,38 12,38 9,34" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <polygon points="52,38 58,38 55,34" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <line x1="4" y1="38" x2="14" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      <line x1="50" y1="38" x2="60" y2="38" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Beam body — amber top third (compression zone) */}
      <rect x="8" y="14" width="48" height="22" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      <rect x="8" y="14" width="48" height="8" fill="#fde68a" stroke="none"/>
      <line x1="8" y1="22" x2="56" y2="22" stroke="var(--are-navy,#1a2b5f)" strokeWidth="0.8" strokeDasharray="3,2"/>
      {/* Rebar circles (tension) */}
      <circle cx="18" cy="32" r="2.5" fill="var(--are-navy,#1a2b5f)"/>
      <circle cx="32" cy="32" r="2.5" fill="var(--are-navy,#1a2b5f)"/>
      <circle cx="46" cy="32" r="2.5" fill="var(--are-navy,#1a2b5f)"/>
      {/* Stirrups */}
      <rect x="14" y="16" width="10" height="18" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      <rect x="40" y="16" width="10" height="18" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      {/* UDL */}
      <line x1="8" y1="10" x2="56" y2="10" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
      {[14,24,32,42,52].map((x,i) => <line key={i} x1={x} y1="10" x2={x} y2="13" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>)}
    </>
  ),

  // ── stud-wall: CFS stud wall framing (elevation) ──────────────────────────
  "stud-wall": (
    <>
      {/* Top track — amber */}
      <rect x="4" y="6" width="56" height="6" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Bottom track */}
      <rect x="4" y="38" width="56" height="6" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Studs */}
      {[10,22,34,46,58].map((x,i) => (
        <rect key={i} x={x-2} y="12" width="4" height="26" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
      ))}
      {/* Axial load arrows */}
      {[10,34,58].map((x,i) => (
        <g key={i}>
          <line x1={x} y1="2" x2={x} y2="5" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.2"/>
          <polygon points={`${x-2},4 ${x+2},4 ${x},7`} fill="var(--are-navy,#1a2b5f)"/>
        </g>
      ))}
      {/* Lateral load arrow */}
      <line x1="2" y1="25" x2="6" y2="25" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="4,23 7,25 4,27" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

  // ── cfs-weld: thin sheet with spot weld / screw symbol ────────────────────
  "cfs-weld": (
    <>
      {/* Two overlapping thin sheets */}
      {/* Bottom sheet */}
      <rect x="4" y="24" width="56" height="8" fill="#dbe2f0" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.3"/>
      {/* Top sheet — amber */}
      <rect x="4" y="16" width="56" height="8" fill="#fde68a" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
      {/* Weld spot symbols (X marks) */}
      {[18,32,46].map((x,i) => (
        <g key={i}>
          <line x1={x-3} y1="19" x2={x+3} y2="29" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
          <line x1={x+3} y1="19" x2={x-3} y2="29" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1.5"/>
          <circle cx={x} cy="24" r="4" fill="none" stroke="var(--are-navy,#1a2b5f)" strokeWidth="1"/>
        </g>
      ))}
      {/* Sheet edges / flanges (C-shapes) */}
      <line x1="4" y1="12" x2="4" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      <line x1="4" y1="12" x2="10" y2="12" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      <line x1="4" y1="36" x2="10" y2="36" stroke="var(--are-navy,#1a2b5f)" strokeWidth="2"/>
      {/* Shear arrows */}
      <line x1="58" y1="20" x2="62" y2="20" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="60,18 64,20 60,22" fill="var(--are-muted,#5c6a85)"/>
      <line x1="6" y1="28" x2="2" y2="28" stroke="var(--are-muted,#5c6a85)" strokeWidth="1.3"/>
      <polygon points="4,26 0,28 4,30" fill="var(--are-muted,#5c6a85)"/>
    </>
  ),

};
