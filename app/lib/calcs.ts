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
    slug: "diaphragm",
    label: "Rectangular Diaphragm Designer",
    subtitle: "Diaphragm unit shear · chord forces · shearwall reactions for rectangular diaphragms",
    htmlFile: "/Calcs/rectangular_diaphragm_calculator.html",
    category: "Wind / Loads",
    spec: "SDPWS 2021 / ASCE 7-16",
    status: "ready",
  },
  {
    slug: "wood-diaphragm",
    label: "Wood Diaphragm Designer",
    subtitle: "Blocked & unblocked WSP diaphragm — unit shear zones, chord forces, drag struts, deflection",
    htmlFile: "/Calcs/wood_diaphragm_designer.html",
    category: "Wind / Loads",
    spec: "SDPWS-21 §4.2 / ASCE 7-22",
    status: "ready",
  },
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
    slug: "unreinforced-cmu-wall",
    label: "Unreinforced CMU Bearing Wall",
    subtitle: "4\u2033 & 6\u2033 CMU \u2014 combined axial + wind flexure, net tension \u00B7 ASD unity check",
    htmlFile: "/Calcs/unreinforced_cmu_wall_asd_calculator.html",
    category: "Masonry",
    spec: "TMS 402-22 \u00A78.2 / MDG-2022",
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
  // ── Steel / Connections ───────────────────────────────────────
  {
    slug: "web-stiffener",
    label: "I-Shaped Member Stiffener Design",
    subtitle: "Proportioning limits · web shear & openings · transverse stiffener check · local web yielding",
    htmlFile: "/Calcs/web_stiffener_calculator.html",
    category: "Connections",
    spec: "AISC 360-22 §F13.2 / G2 / J10.2",
    status: "ready",
  },
  {
    slug: "column-bearing-plate-slab",
    label: "Column Bearing Plate on Slab",
    subtitle: "Bearing pressure · plate bending · two-way punching shear · one-way slab shear",
    htmlFile: "/Calcs/column_bearing_plate_slab_calculator.html",
    category: "Connections",
    spec: "AISC DG01 / ACI 318-19",
    status: "ready",
  },
  // ── Cold-Formed Steel (CFS) ───────────────────────────────────
  {
    slug: "cfs-weld",
    label: "CFS Weld Connection Designer",
    subtitle: "All 8 weld types — fillet, arc spot, arc seam, flare bevel, flare V-groove, groove butt · ASD + LRFD",
    htmlFile: "/Calcs/AISI_S100_16_Weld_Calculator.html",
    category: "CFS",
    spec: "AISI S100-16 Chapter J",
    status: "ready",
    group: "CFS Connections",
  },
  {
    slug: "cfs-screw",
    label: "CFS Screw Connection Designer",
    subtitle: "Tilting/bearing · pull-out · pull-over · screw tension · combined V+T interactions · ASD + LRFD",
    htmlFile: "/Calcs/AISI_S100_16_Screw_Calculator.html",
    category: "CFS",
    spec: "AISI S100-16 J4.3–J4.5 / J6",
    status: "ready",
    group: "CFS Connections",
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
