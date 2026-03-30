// Plain data file — no "use client", safe to import from server and client components alike

export type CalcMeta = {
  slug: string;
  label: string;
  subtitle: string;
  htmlFile: string;       // served statically from /public
  category: string;
  spec: string;
  status: "ready" | "wip" | "planned";
  group?: string;         // optional — calcs sharing a group are rendered as one expandable card
};

export const CALCS: CalcMeta[] = [
  // ── Wind / Loads ─────────────────────────────────────────────
  {
    slug: "mwfrs-wind",
    label: "MWFRS Wind Pressure",
    subtitle: "Main wind-force resisting system — Directional Procedure, all heights, story shears, parapet",
    htmlFile: "/Calcs/asce716_mwfrs_calculator.html",
    category: "Wind / Loads",
    spec: "ASCE 7-16 Ch.27 Pt.1",
    status: "ready",
  },
  {
    slug: "cc-wind",
    label: "C&C Wind Pressure",
    subtitle: "Components & cladding design pressures — all 6 ASCE 7-16 figures, log-linear GCp interpolation",
    htmlFile: "/Calcs/asce716_cc_wind_calculator.html",
    category: "Wind / Loads",
    spec: "ASCE 7-16 Ch.30",
    status: "ready",
  },
  // ── Connections ──────────────────────────────────────────────
  {
    slug: "base-plate",
    label: "Single Base Plate",
    subtitle: "Axial · shear · moment · anchor bolt concrete checks (DG1 Ex. 4.4 & 4.10)",
    htmlFile: "/Calcs/column_base_plate_v3.html",
    category: "Connections",
    spec: "AISC DG1",
    status: "ready",
    group: "Base Plate Designers",
  },
  {
    slug: "base-plate-v1",
    label: "RISA Table Import",
    subtitle: "Multi-member table format — paste RISA export to check all columns at once",
    htmlFile: "/Calcs/column_base_plate_calculator.html",
    category: "Connections",
    spec: "AISC DG1",
    status: "ready",
    group: "Base Plate Designers",
  },
  {
    slug: "gusset",
    label: "HSS Brace Gusset",
    subtitle: "Whitmore · buckling · weld · bolt group",
    htmlFile: "/Calcs/HSS_column_brace_gusset_calculator.html",
    category: "Connections",
    spec: "AISC 360-22",
    status: "ready",
  },
  {
    slug: "brace-connection",
    label: "Channel Brace Connection",
    subtitle: "Channel brace bolted to gusset — shear + tension",
    htmlFile: "/Calcs/channel_brace_connection_calculator.html",
    category: "Connections",
    spec: "AISC 360-22",
    status: "ready",
  },
  // ── Members ──────────────────────────────────────────────────
  {
    slug: "joist-bearing",
    label: "Channel Joist Bearing",
    subtitle: "Web yielding · crippling · bearing plate",
    htmlFile: "/Calcs/channel_joist_bearing_calculator.html",
    category: "Members",
    spec: "AISC 360-22",
    status: "ready",
  },
  {
    slug: "unistrut",
    label: "Unistrut P1000HS",
    subtitle: "Load capacity and span check",
    htmlFile: "/Calcs/unistrut_p1000hs_calculator.html",
    category: "Members",
    spec: "Unistrut Tables",
    status: "ready",
  },
  // ── Members ──────────────────────────────────────────────────
  {
    slug: "stacked-headers",
    label: "Stacked Headers & Studs",
    subtitle: "Accumulates DL · LL · Snow jamb loads floor-by-floor at stacked openings",
    htmlFile: "/Calcs/stacked_headers_studs_calculator.html",
    category: "Members",
    spec: "ASCE 7-22",
    status: "ready",
  },
  {
    slug: "stacked-shearwall",
    label: "Stacked Shearwall Designer",
    subtitle: "Perforated shear wall method · multi-story uplift · sheathing capacity · hold-downs",
    htmlFile: "/Calcs/stacked_shearwall_calculator.html",
    category: "Members",
    spec: "SDPWS 2021",
    status: "ready",
  },
  // ── Masonry ──────────────────────────────────────────────────
  {
    slug: "masonry-bearing-uplift",
    label: "Masonry Bearing & Uplift",
    subtitle: "Effective bearing area (layouts A/B/C) · bearing stress · headed stud uplift (ASD)",
    htmlFile: "/Calcs/masonry_bearing_uplift_calculator.html",
    category: "Masonry",
    spec: "TMS 402-22 / MDG REK-07/09",
    status: "ready",
  },
  {
    slug: "masonry-anchor-bolt",
    label: "Masonry Anchor Bolt (Shear Connection)",
    subtitle: "Headed bolt SD — tension, shear (all 4 modes) & interaction per Eq. 9-8",
    htmlFile: "/Calcs/masonry_anchor_bolt_calculator.html",
    category: "Masonry",
    spec: "TMS 402-22 SD / MDG REK-08",
    status: "ready",
  },
  {
    slug: "masonry-lap-length",
    label: "Masonry Development & Lap Splice",
    subtitle: "Deformed bar development length & Class A lap splice per Eq. 6-2",
    htmlFile: "/Calcs/masonry_lap_length_calculator.html",
    category: "Masonry",
    spec: "TMS 402-22 / MDG REK-10",
    status: "ready",
  },
  // ── Foundations ──────────────────────────────────────────────
  {
    slug: "holdown-footing",
    label: "Shearwall Holdown Footing",
    subtitle: "Spread footing for shearwall uplift",
    htmlFile: "/Calcs/SW_HoldownFooting_Calculator.html",
    category: "Foundations",
    spec: "ACI 318-19",
    status: "ready",
  },
  {
    slug: "wri-stiffened-slab",
    label: "WRI Stiffened Slab Foundation",
    subtitle: "Ribbed slab-on-ground · WRI Design Guide · beam depth, flexure & deflection",
    htmlFile: "/Calcs/wri_stiffened_slab_calculator.html",
    category: "Foundations",
    spec: "WRI / ACI 318-19",
    status: "ready",
  },
];
