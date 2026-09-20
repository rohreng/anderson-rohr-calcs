/* =============================================================================
   WC engine — Wood Connection Schedule, NDS 2018 Chapter 11–12 dowel-type
   fasteners (bolts, lag screws, wood screws, nails). ASD, per-fastener demand.
   DOM-free.  window.WC.compute(state) -> result.   Spec:
   docs/superpowers/specs/2026-09-19-wood-connection-schedule-spec.md (v1).

   Code basis (every clause and table cell read from the AWC NDS 2018 PDF text,
   cited "printed page / PDF page"; not from memory):
     Table 11.3.1 (66/80)   Z' = Z·C_D·C_M·C_t·C_g·C_Δ·C_eg·C_di·C_tn;
                            W' = W·C_D·C_M·C_t·C_eg·C_tn; W'_H = W_H·C_D·C_M·C_t
     §11.3.2 / Table 2.3.2  C_D ≤ 1.6 on connections (0.9 / 1.0 / 1.15 / 1.25 / 1.6)
     Table 11.3.3 (67/81)   C_M by fabrication / in-service moisture, fn 2 (D < 1/4 → 0.7,
                            one fastener / one row / separate splice plates → 1.0)
     Table 11.3.4 (67/81)   C_t
     §11.3.6.1 Eq. 11.3-1 (68/82)  C_g; γ = 180,000·D^1.5 wood-wood, 270,000·D^1.5 wood-metal;
                            C_g = 1.0 for D < 1/4"; §11.3.6.3 gross areas, ⊥ member = t × group width
     Tables 11.3.6A / C (70–71/84–85)  C_g fixtures (D 1", s 4", E 1.4M, E_steel 30M)
     §12.1.3.2/.3 bolt holes and washers; §12.1.4.2/.3 lag lead holes; §12.1.5.2/.3 wood screw;
     §12.1.6.2 nail bored holes; §12.1.6.3 toe-nail 30° / L/3
     §12.1.4.6 lag p_min = 4D excluding tip E; §12.1.5.6 / §12.1.6.4 p_min = 6D incl. tip
     §12.2.1.1 Eq. 12.2-1 W = 1800·G^1.5·D^0.75 (lag); §12.2.1.2 p_t excludes the tip;
     §12.2.1.3 C_eg 0.75 lag withdrawal from end grain; §12.2.1.4 root-area tension per §11.2.3
     §12.2.2.1 Eq. 12.2-2 W = 2850·G²·D (wood screw); §12.2.2.3 no withdrawal from end grain
     §12.2.3.1 Eq. 12.2-3 W = 1380·G^2.5·D (nail); §12.2.3.3 no withdrawal from end grain
     §12.2.5.1 Eq. 12.2-6a/b head pull-through (82/96), Table 12.2F
     §12.3.1 (83/97) yield-limit method, preconditions (a)–(d)
     Table 12.3.1A (83/97) modes I_m, I_s, II, III_m, III_s, IV (single); I_m, I_s, III_s, IV (double)
     Table 12.3.1B (84/98) R_d: 4K_θ / 3.6K_θ / 3.2K_θ for 0.25 ≤ D ≤ 1; K_D for D < 0.25;
                            fn 1 nominal ≥ 0.25 with D_r < 0.25 → R_d = K_D·K_θ; K_θ = 1 + 0.25(θ/90)
     Table 12.3.3 (86/100) fn 2  F_e∥ = 11200G, F_e⊥ = 6100·G^1.45/√D, D < 1/4: 16600·G^1.84,
                            rounded to the nearest 50 psi; Table 12.3.3A (87/101) G by species
     §12.3.3.3 SCL F_e from the manufacturer / evaluation report (Custom species: typed F_e)
     §12.3.3.4 (84/98)  D ≥ 1/4" in end grain of the main member → F_e⊥ for F_em
     §12.3.4 Eq. 12.3-11 (84/98) Hankinson F_eθ = F_e∥F_e⊥/(F_e∥sin²θ + F_e⊥cos²θ) for 0 < θ < 90 (v1.1)
     §11.3.6.2 (68/82) staggered adjacent rows with g < offset/4 count as one row for C_g (Fig. 11B) (v1.1)
     Commentary C12.5.1.2 (263/277) end distance at an angle to grain linearly interpolated (v1.1)
     §12.3.5.3 (85/99)  l_m ≤ p − E/2 (E from Table L2 for lags, 2D for wood screws and nails)
     §12.3.7.1 (85/99)  D for nails and bolts; D_r for lags and wood screws in Tables 12.3.1A/B
     §12.3.10.2 (88/102) toe-nail l_s = min(t_s, L/3); Commentary C12.5.4 (266/280):
                            l_m = L·cos30° − L/3; withdrawal p_t = actual nail length in the member
     §12.4.1 Eq. 12.4-1 (89/103) lag / wood screw combined: Z'_α = W'p·Z' / (W'p·cos²α + Z'·sin²α)
     §12.4.2 Eq. 12.4-2 (89/103) nail combined: Z'_α = W'p·Z' / (W'p·cosα + Z'·sinα)
     §12.5.1 / Tables 12.5.1A–E (89–91/103–105)  C_Δ, hard minimums, 5" across-grain limit
     §12.5.2.2 C_eg = 0.67 lateral in end grain (all dowel types); §12.5.3 C_di = 1.1;
     §12.5.4 C_tn = 0.83 (Z) / 0.67 (W), C_M does not apply to toe-nail withdrawal
     Tables 12A/12B/12F/12G, 12J/12K, 12L/12M, 12N/12P, 12.2A–C, 12.2F  fixtures
     Table I1 (175/189) F_yb bands; Tables L1–L4 (180–182/194–196) fastener dimensions
     Steel F_e: Table 12B/12K fn 2 (A36 87,000), Table 12M/12P fn 2 (A653 Gr 33 61,850); App. I.2
     Commentary Tables C12.1.5.7 (254/268) wood screws and C12.1.6.6 (255/269) nails: recommended
                            minimum spacing for D < 1/4" (advisory; §12.1.5.7 / §12.1.6.5 give no
                            mandatory values below 1/4") (v1.2)

   Demands are ASD-level lb PER FASTENER (V lateral, T withdrawal) or, with demandBasis
   "total", per CONNECTION (V_total, T_total; divided by qty = n·rows). No load factors.
   ========================================================================== */
(function (root) {
  'use strict';

  // ── numeric helpers ────────────────────────────────────────────────────────
  // num(): blank / null / undefined -> null (never 0); anything else -> Number (may be NaN).
  function num(v) { if (v === null || v === undefined || v === '') return null; if (typeof v === 'boolean') return NaN; var n = Number(v); return n; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function near(a, b, tol) { return isNum(a) && Math.abs(a - b) <= tol + 1e-9; }
  function round50(x) { return Math.round(x / 50) * 50; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f3(v) { return isNum(v) ? v.toFixed(3) : String(v); }
  var COS30 = Math.cos(Math.PI / 6);

  // version = the state shape (the adapter gate); rev = the engine build.
  var ENGINE = { name: 'wood-connection-schedule', version: 1, rev: '2026-09-20 v1.2', codes: ['NDS 2018'] };

  // ── DATA (spec §4) ─────────────────────────────────────────────────────────
  var SPECIES = {
    DFL:  { key: 'DFL',  label: 'Douglas Fir-Larch',         G: 0.50, E: 1600000, hardwood: false },
    DFS:  { key: 'DFS',  label: 'Douglas Fir-South',         G: 0.46, E: 1200000, hardwood: false },
    HF:   { key: 'HF',   label: 'Hem-Fir',                   G: 0.43, E: 1300000, hardwood: false },
    SPF:  { key: 'SPF',  label: 'Spruce-Pine-Fir',           G: 0.42, E: 1400000, hardwood: false },
    SPFS: { key: 'SPFS', label: 'Spruce-Pine-Fir (South)',   G: 0.36, E: 1100000, hardwood: false },
    SP:   { key: 'SP',   label: 'Southern Pine',             G: 0.55, E: 1400000, hardwood: false }
  };
  // G: Table 12.3.3A p.87/101. E: Supplement Tables 4A/4B, No. 2 grade (editable via header.E_override).
  var STEEL = {
    A36:  { grade: 'A36',  label: 'ASTM A36 plate (t ≥ 1/4 in)',            Fe: 87000, cite: 'Table 12B/12K fn 2; App. I.2 p.173/187' },
    A653: { grade: 'A653', label: 'ASTM A653 SS Gr 33 (gauge, t < 1/4 in)', Fe: 61850, cite: 'Table 12K/12M/12P fn 2; App. I.2 p.173/187' },
    E: 30000000   // Table 11.3.6C header p.71/85
  };
  var GAUGES = { '20': 0.036, '18': 0.048, '16': 0.060, '14': 0.075, '12': 0.105, '11': 0.120, '10': 0.134, '7': 0.179, '3': 0.239 };  // Table 12P p.112/126
  // Table L4 p.182/196: D, L, H (head diameter). Tip E = 2D (fn 2). Sinker 6d (0.092) excluded: below the Table I1 band.
  var NAILS = {
    common: { '6d': { D: 0.113, L: 2,     H: 0.266 }, '7d': { D: 0.113, L: 2.25,  H: 0.266 }, '8d': { D: 0.131, L: 2.5,   H: 0.281 },
              '10d': { D: 0.148, L: 3,    H: 0.312 }, '12d': { D: 0.148, L: 3.25, H: 0.312 }, '16d': { D: 0.162, L: 3.5,  H: 0.344 }, '20d': { D: 0.192, L: 4,    H: 0.406 } },
    box:    { '6d': { D: 0.099, L: 2,     H: 0.266 }, '7d': { D: 0.099, L: 2.25,  H: 0.266 }, '8d': { D: 0.113, L: 2.5,   H: 0.297 },
              '10d': { D: 0.128, L: 3,    H: 0.312 }, '12d': { D: 0.128, L: 3.25, H: 0.312 }, '16d': { D: 0.135, L: 3.5,  H: 0.344 }, '20d': { D: 0.148, L: 4,    H: 0.375 } },
    sinker: { '7d': { D: 0.099, L: 2.125, H: 0.250 }, '8d': { D: 0.113, L: 2.375, H: 0.266 }, '10d': { D: 0.120, L: 2.875, H: 0.281 },
              '12d': { D: 0.135, L: 3.125, H: 0.312 }, '16d': { D: 0.148, L: 3.25, H: 0.344 }, '20d': { D: 0.177, L: 3.75, H: 0.375 } }
  };
  // Table L3 p.182/196: D, D_r, D_H. T = max(4D, 2L/3) (fn 2/3), tip E = 2D (fn 6).
  var WOOD_SCREWS = {
    '6': { no: 6, D: 0.138, Dr: 0.113, DH: 0.262 }, '7': { no: 7, D: 0.151, Dr: 0.122, DH: 0.287 }, '8': { no: 8, D: 0.164, Dr: 0.131, DH: 0.312 },
    '9': { no: 9, D: 0.177, Dr: 0.142, DH: 0.337 }, '10': { no: 10, D: 0.190, Dr: 0.152, DH: 0.363 }, '12': { no: 12, D: 0.216, Dr: 0.171, DH: 0.414 },
    '14': { no: 14, D: 0.242, Dr: 0.196, DH: 0.480 }
  };
  // Table L2 p.181/195: D -> D_r, tip E. Thread length T by L (min thread length); fn 2: T = min(6, L/2 + 1/2).
  var LAGS = [
    { D: 0.25,   Dr: 0.173, E: 5 / 32,  label: '1/4' }, { D: 0.3125, Dr: 0.227, E: 3 / 16,  label: '5/16' }, { D: 0.375, Dr: 0.265, E: 7 / 32,  label: '3/8' },
    { D: 0.4375, Dr: 0.328, E: 9 / 32,  label: '7/16' }, { D: 0.5,   Dr: 0.371, E: 5 / 16,  label: '1/2' },  { D: 0.625, Dr: 0.471, E: 13 / 32, label: '5/8' },
    { D: 0.75,   Dr: 0.579, E: 1 / 2,   label: '3/4' },  { D: 0.875, Dr: 0.683, E: 19 / 32, label: '7/8' },  { D: 1,     Dr: 0.780, E: 11 / 16, label: '1' }
  ];
  var LAG_T = { '1': 0.75, '1.5': 1.25, '2': 1.5, '2.5': 1.75, '3': 2, '4': 2.5, '5': 3, '6': 3.5, '7': 4, '8': 4.5, '9': 5, '10': 5.5, '11': 6, '12': 6 };
  var LAG_LENGTHS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  // Table L2 availability: L ≤ 1.5 → D ≤ 1/2; L 2–2.5 → D ≤ 5/8; L 3 → D ≤ 1; L ≥ 4 → all.
  function lagAvailable(D, L) { if (L <= 1.5) return D <= 0.5 + 1e-9; if (L <= 2.5) return D <= 0.625 + 1e-9; return D <= 1 + 1e-9; }
  var BOLTS = [0.5, 0.625, 0.75, 0.875, 1];   // Table L1 p.180/194, full-body D
  var BOLT_LABEL = { '0.5': '1/2', '0.625': '5/8', '0.75': '3/4', '0.875': '7/8', '1': '1' };
  // Table I1 p.175/189 (= Z-table fn 2), by nominal D.
  var FYB_BANDS = [[0.099, 0.142, 100000], [0.142, 0.177, 90000], [0.177, 0.236, 80000], [0.236, 0.273, 70000], [0.273, 0.344, 60000], [0.344, 0.375, 45000]];
  function fybBand(D) { for (var i = 0; i < FYB_BANDS.length; i++) { var b = FYB_BANDS[i]; if ((i === 0 ? D >= b[0] - 1e-9 : D > b[0] + 1e-9) && D <= b[1] + 1e-9) return b[2]; } return null; }
  function fybLag(D) { if (D < 0.3125 - 1e-9) return 70000; if (D < 0.375 - 1e-9) return 60000; return 45000; }
  var CD = { D: 0.9, L: 1.0, S: 1.15, Lr: 1.25, WE: 1.6 };   // Table 2.3.2; C_D ≤ 1.6 §11.3.2
  var CD_LABEL = { D: 'dead (permanent)', L: 'occupancy live (ten years)', S: 'snow (two months)', Lr: 'roof live / construction (seven days)', WE: 'wind / seismic (ten minutes)' };
  var CT = { T100: { dry: 1.0, wet: 1.0 }, T125: { dry: 0.8, wet: 0.7 }, T150: { dry: 0.7, wet: 0.5 } };   // Table 11.3.4 p.67/81
  var CONST = {
    Ceg_lateral: 0.67, Ceg_lag_withdrawal: 0.75, Cdi: 1.1, Ctn_Z: 0.83, Ctn_W: 0.67,
    gamma_wood: 180000, gamma_metal: 270000, spreadMax: 5, Dmax: 1, Gmin: 0.31, Gmax: 0.73
  };
  // Commentary Tables C12.1.5.7 (wood screws, p.254/268) and C12.1.6.6 (nails, p.255/269) — identical cell values —
  // recommended minimum spacing for D < 1/4 in, multiples of nominal D, by side-member material and [not prebored, prebored].
  // Advisory only: §12.1.5.7 / §12.1.6.5 require spacing "sufficient to prevent splitting" and give no numbers below 1/4 in.
  var SMALL_D_SPACING = {
    wood:  { edge: [2.5, 2.5], endTension: [15, 10], endCompression: [10, 5], rowPar: [15, 10], rowPerp: [10, 5], rowsInline: [5, 3], rowsStaggered: [2.5, 2.5] },
    steel: { edge: [2.5, 2.5], endTension: [10, 5],  endCompression: [5, 3],  rowPar: [10, 5],  rowPerp: [5, 2.5], rowsInline: [3, 2.5], rowsStaggered: [2.5, 2.5] },
    cite: { nail: 'Commentary Table C12.1.6.6', wood: 'Commentary Table C12.1.5.7' }
  };
  var DATA = {
    SPECIES: SPECIES, STEEL: STEEL, GAUGES: GAUGES, NAILS: NAILS, WOOD_SCREWS: WOOD_SCREWS, LAGS: LAGS, LAG_T: LAG_T,
    LAG_LENGTHS: LAG_LENGTHS, lagAvailable: lagAvailable, BOLTS: BOLTS, BOLT_LABEL: BOLT_LABEL, FYB_BANDS: FYB_BANDS,
    CD: CD, CD_LABEL: CD_LABEL, CT: CT, CONST: CONST, SMALL_D_SPACING: SMALL_D_SPACING,
    notes: [
      'Table L4 (PDF 196) lists head diameter H for every common, box and sinker size offered; box and sinker H are read directly, no substitution.',
      'Sinker 6d (D 0.092) is not offered: below the Table I1 F_yb band (0.099–0.375).',
      'Lag length: any L > 0 is accepted (Table L2 availability by D still enforced). T = Table L2 value for a listed length; for any other L, T = min(6, L/2 + 1/2) per Table L2 fn 2 and the row carries a warning.',
      'Steel side: gauge → Table 12P thickness with A653 Gr 33 (F_e 61,850); "plate" → typed t ≥ 1/4 in with A36 (F_e 87,000). header.steelGrade is echoed for display.',
      'Species E is the Supplement Table 4A/4B No. 2 reference E; header.E_override replaces it (C_g only).'
    ]
  };

  // ── C_M (Table 11.3.3 p.67/81) ─────────────────────────────────────────────
  function cmLateral(fab, svc, D, cmException) {
    if (svc === 'wet') return { v: 0.7, cite: 'Table 11.3.3: in-service > 19 % → 0.7' };
    if (fab === 'wet') {
      if (cmException) return { v: 1.0, cite: 'Table 11.3.3 fn 2: one fastener / single row ∥ grain / separate splice plates → 1.0' };
      if (D < 0.25) return { v: 0.7, cite: 'Table 11.3.3 fn 2: D < 1/4 in, fabricated > 19 %, in-service ≤ 19 % → 0.7' };
      return { v: 0.4, cite: 'Table 11.3.3: fabricated > 19 %, in-service ≤ 19 % → 0.4' };
    }
    return { v: 1.0, cite: 'Table 11.3.3: fabricated ≤ 19 %, in-service ≤ 19 % → 1.0' };
  }
  function cmWithdrawal(kind, fab, svc, toeNail) {
    if (kind === 'nail') {
      if (toeNail) return { v: 1.0, cite: '§12.5.4.1 / Table 11.3.1 fn 2: C_M does not apply to toe-nails in withdrawal' };
      if (fab === svc) return { v: 1.0, cite: 'Table 11.3.3 nails: ' + (fab === 'wet' ? '> 19 % / > 19 %' : '≤ 19 % / ≤ 19 %') + ' → 1.0' };
      return { v: 0.25, cite: 'Table 11.3.3 nails: mixed fabrication / in-service moisture → 0.25' };
    }
    if (svc === 'wet') return { v: 0.7, cite: 'Table 11.3.3 lag / wood screw withdrawal: in-service > 19 % → 0.7' };
    return { v: 1.0, cite: 'Table 11.3.3 lag / wood screw withdrawal: in-service ≤ 19 % → 1.0' };
  }
  function cmPullThrough(svc) {
    return svc === 'wet' ? { v: 0.7, cite: 'Table 11.3.3 pull-through: in-service > 19 % → 0.7' } : { v: 1.0, cite: 'Table 11.3.3 pull-through: in-service ≤ 19 % → 1.0' };
  }
  function ctFactor(temp, svc) { var t = CT[temp]; if (!t) return null; return t[svc === 'wet' ? 'wet' : 'dry']; }

  // ── dowel bearing strength, Table 12.3.3 fn 2 (rounded to 50 psi) ─────────
  function feWood(G, D) {
    if (D < 0.25) { var s = round50(16600 * Math.pow(G, 1.84)); return { small: s, par: s, perp: s }; }
    return { small: null, par: round50(11200 * G), perp: round50(6100 * Math.pow(G, 1.45) / Math.sqrt(D)) };
  }
  // Hankinson Eq. 12.3-11 between the Table 12.3.3 ∥ and ⊥ values (each already rounded to 50 psi); F_eθ used unrounded; exact at 0 / 90.
  function feAtAngle(par, perp, theta) {
    if (!(theta > 0)) return par; if (theta >= 90) return perp;
    var sn = Math.sin(theta * Math.PI / 180), cs = Math.cos(theta * Math.PI / 180);
    return par * perp / (par * sn * sn + perp * cs * cs);
  }
  function KD(Dy) { return Dy <= 0.17 + 1e-12 ? 2.2 : 10 * Dy + 0.5; }
  function Ktheta(theta) { return 1 + 0.25 * (theta / 90); }

  // ── yield limit equations, Table 12.3.1A/B ─────────────────────────────────
  // o = { D (yield diameter), lm, ls, Fem, Fes, Fyb, Rd:{I,II,III}, double }
  function yieldModes(o) {
    var D = o.D, lm = o.lm, ls = o.ls, Fem = o.Fem, Fes = o.Fes, Fyb = o.Fyb, Rd = o.Rd;
    var Re = Fem / Fes, Rt = lm / ls;
    var k1 = (Math.sqrt(Re + 2 * Re * Re * (1 + Rt + Rt * Rt) + Rt * Rt * Re * Re * Re) - Re * (1 + Rt)) / (1 + Re);
    var k2 = -1 + Math.sqrt(2 * (1 + Re) + 2 * Fyb * (1 + 2 * Re) * D * D / (3 * Fem * lm * lm));
    var k3 = -1 + Math.sqrt(2 * (1 + Re) / Re + 2 * Fyb * (2 + Re) * D * D / (3 * Fem * ls * ls));
    var modes;
    if (o.double) {
      modes = {
        Im: D * lm * Fem / Rd.I,                                // 12.3-7
        Is: 2 * D * ls * Fes / Rd.I,                            // 12.3-8
        II: null, IIIm: null,
        IIIs: 2 * k3 * D * ls * Fem / ((2 + Re) * Rd.III),      // 12.3-9
        IV: 2 * D * D / Rd.III * Math.sqrt(2 * Fem * Fyb / (3 * (1 + Re)))   // 12.3-10
      };
    } else {
      modes = {
        Im: D * lm * Fem / Rd.I,                                // 12.3-1
        Is: D * ls * Fes / Rd.I,                                // 12.3-2
        II: k1 * D * ls * Fes / Rd.II,                          // 12.3-3
        IIIm: k2 * D * lm * Fem / ((1 + 2 * Re) * Rd.III),      // 12.3-4
        IIIs: k3 * D * ls * Fem / ((2 + Re) * Rd.III),          // 12.3-5
        IV: D * D / Rd.III * Math.sqrt(2 * Fem * Fyb / (3 * (1 + Re)))   // 12.3-6
      };
    }
    var gov = null, Z = Infinity;
    ['Im', 'Is', 'II', 'IIIm', 'IIIs', 'IV'].forEach(function (k) { if (modes[k] !== null && modes[k] < Z) { Z = modes[k]; gov = k; } });
    return { Re: Re, Rt: Rt, k1: k1, k2: k2, k3: k3, modes: modes, Z: Z, governing: gov };
  }

  // ── group action factor, Eq. 11.3-1 ────────────────────────────────────────
  function groupAction(o) {   // { n, s, D, Em, Am, Es, As, metal }
    if (o.n <= 1) return { Cg: 1.0, n: o.n, note: 'n = 1 → C_g = 1.0' };
    var gamma = (o.metal ? CONST.gamma_metal : CONST.gamma_wood) * Math.pow(o.D, 1.5);
    var EmAm = o.Em * o.Am, EsAs = o.Es * o.As;
    var REA = Math.min(EsAs / EmAm, EmAm / EsAs);
    var u = 1 + gamma * (o.s / 2) * (1 / EmAm + 1 / EsAs);
    var m = u - Math.sqrt(u * u - 1);
    if (!isFinite(u) || !isFinite(m) || m >= 1 - 1e-12) {
      return { Cg: null, gamma: gamma, REA: REA, u: u, m: m, EmAm: EmAm, EsAs: EsAs, n: o.n,
               reason: !isFinite(u) ? 'Eq. 11.3-1 undefined: a member area or E·A is zero' : 'Eq. 11.3-1 undefined: s = 0 gives m = 1 (division by 1 − m)' };
    }
    var n = o.n, mn = Math.pow(m, n), m2n = Math.pow(m, 2 * n);
    var Cg = (m * (1 - m2n)) / (n * ((1 + REA * mn) * (1 + m) - 1 + m2n)) * ((1 + REA) / (1 - m));
    return { Cg: Cg, gamma: gamma, REA: REA, u: u, m: m, EmAm: EmAm, EsAs: EsAs, n: n };
  }

  // ── withdrawal (lb/in) and head pull-through (lb) ──────────────────────────
  function withdrawalUnit(kind, G, D) {
    if (kind === 'lag') return 1800 * Math.pow(G, 1.5) * Math.pow(D, 0.75);   // 12.2-1
    if (kind === 'wood') return 2850 * G * G * D;                              // 12.2-2
    if (kind === 'nail') return 1380 * Math.pow(G, 2.5) * D;                   // 12.2-3
    return null;
  }
  function pullThrough(DH, G, tns) {   // Eq. 12.2-6a / 12.2-6b
    if (tns <= 2.5 * DH + 1e-12) return { WH: 690 * Math.PI * DH * G * G * tns, eq: '12.2-6a (t_ns ≤ 2.5·D_H)' };
    return { WH: 1725 * Math.PI * DH * DH * G * G, eq: '12.2-6b (t_ns > 2.5·D_H)' };
  }
  // Combined lateral + withdrawal: Eq. 12.4-2 (nails, linear) / Eq. 12.4-1 (lags and wood screws, squared).
  function combined(kind, V, T, Zp, Wcap) {
    var alpha = Math.atan2(T, V), c = Math.cos(alpha), s = Math.sin(alpha), Za;
    if (kind === 'nail') Za = Wcap * Zp / (Wcap * c + Zp * s);
    else Za = Wcap * Zp / (Wcap * c * c + Zp * s * s);
    return { alpha: alpha * 180 / Math.PI, Zalpha: Za, dc: Math.sqrt(V * V + T * T) / Za, eq: kind === 'nail' ? 'Eq. 12.4-2' : 'Eq. 12.4-1' };
  }

  // ── defaults (spec §3 / §3.1) ──────────────────────────────────────────────
  function defaultState() {
    return {
      version: 1,
      header: {
        species: 'DFL', E_override: null,
        custom: { name: '', G: null, E: null, Fe_small: null, Fe_par: null, Fe_perp: null, hardwood: false, esr: '' },
        steelGrade: 'A36', mcFab: 'dry', mcService: 'dry', temp: 'T100'
      },
      bolts: [], nails: [], screws: [], rowCnt: 0
    };
  }
  // Table 12.5.1A end distance for C_Δ = 1.0 (full) and 0.5 (half) at any θ: the θ = 0 value (tension toward the end
  // 7D / 3.5D softwood, 5D / 2.5D hardwood; compression 4D / 2D) interpolated linearly to the θ = 90 value (4D / 2D)
  // by θ/90 (Commentary C12.5.1.2). Shared by compute() and geomDefaults().
  function endDistance(D, theta, towardEnd, hardwood) {
    var tt = Math.min(Math.max(Number(theta) || 0, 0), 90) / 90;
    var endFull0 = towardEnd ? (hardwood ? 5 : 7) * D : 4 * D, endHalf0 = towardEnd ? (hardwood ? 2.5 : 3.5) * D : 2 * D;
    return { full: endFull0 + (4 * D - endFull0) * tt, half: endHalf0 + (2 * D - endHalf0) * tt };
  }
  // geomDefaults(D, θ, towardEnd, hardwood): full-value defaults — s 4D, edge 1.5D, loaded edge 4D, end = interpolated full
  // (same helper as compute), g = 1.5D at θ = 0, else the ⊥ row-spacing full default 5D. Page probe GEOM_INTERP.
  // D < 1/4 (v1.2, spec §13.3): the Commentary Table C12.1.5.7 / C12.1.6.6 wood-side, not-prebored recommendations, so a fresh
  // nail / wood-screw row opens without advisory warnings — s 15D ∥ (10D at θ = 90), g 5D in-line, end 15D tension / 10D
  // compression, edge 2.5D.
  function geomDefaults(D, theta, towardEnd, hardwood) {
    var th = Number(theta) || 0;
    if (D < 0.25 - 1e-9) {
      var w = SMALL_D_SPACING.wood;
      return { s: (th >= 90 ? w.rowPerp[0] : w.rowPar[0]) * D, g: w.rowsInline[0] * D, endDist: (towardEnd !== false ? w.endTension[0] : w.endCompression[0]) * D, edgeDist: w.edge[0] * D, loadedEdgeDist: w.edge[0] * D };
    }
    return { s: 4 * D, g: th > 0 ? 5 * D : 1.5 * D, endDist: endDistance(D, th, towardEnd !== false, !!hardwood).full, edgeDist: 1.5 * D, loadedEdgeDist: 4 * D };
  }
  function kindOf(type) {
    var t = String(type || '').toLowerCase();
    if (t === 'bolt' || t === 'bolts') return 'bolt';
    if (t === 'nail' || t === 'nails') return 'nail';
    if (t === 'screw' || t === 'screws' || t === 'wood' || t === 'lag') return 'screw';
    return null;
  }
  // newRow(type, opts): type 'bolt'|'nail'|'screw' (or the table key); opts.id, opts.screwType ('wood'|'lag').
  function newRow(type, opts) {
    opts = opts || {};
    var kind = kindOf(type);
    if (!kind) throw new Error('WC.newRow: unknown type ' + type);
    var D = kind === 'bolt' ? 0.75 : kind === 'nail' ? NAILS.common['16d'].D : (opts.screwType === 'lag' ? 0.5 : WOOD_SCREWS['10'].D);
    var gd = geomDefaults(D, 0, true);
    var member = function (mat) {
      return { mat: mat, species: null, t: 1.5, w: 5.5, theta: 0, endGrain: false, towardEnd: true, endDist: gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist, gauge: 'plate' };
    };
    var main = member('wood'); delete main.mat;
    var row = {
      id: isNum(opts.id) ? opts.id : 0, desc: '', V: null, T: null, demandBasis: 'per', V_total: null, T_total: null, loadCase: 'L', cmException: false,
      main: main, side: member('wood'),
      n: 1, rows: 1, s: gd.s, g: gd.g, stagger: false, offset: null, prebored: false, shrinkDetail: false, Fyb_override: null, notes: ''
    };
    if (kind === 'bolt') { row.D = 0.75; row.shear = 'single'; row.mainSteel = false; }
    if (kind === 'nail') { row.nailType = 'common'; row.penny = '16d'; row.toeNail = false; row.diaphragm = false; }
    if (kind === 'screw') { row.screwType = opts.screwType === 'lag' ? 'lag' : 'wood'; row.no = 10; row.D = 0.5; row.L = row.screwType === 'lag' ? 4 : 3; }
    return row;
  }

  // ── header resolution ──────────────────────────────────────────────────────
  function resolveHeader(h) {
    h = h || {};
    var errs = [], out = {
      species: h.species || 'DFL', E_override: num(h.E_override), custom: h.custom || {},
      steelGrade: h.steelGrade === 'A653' ? 'A653' : 'A36',
      mcFab: h.mcFab === 'wet' ? 'wet' : 'dry', mcService: h.mcService === 'wet' ? 'wet' : 'dry',
      temp: CT[h.temp] ? h.temp : 'T100'
    };
    if (out.E_override !== null && !(isNum(out.E_override) && out.E_override > 0)) errs.push('header E_override must be a number > 0');
    out.speciesResolved = resolveSpecies(out, out.species);
    out.steel = { grade: out.steelGrade, Fe: STEEL[out.steelGrade].Fe, E: STEEL.E, cite: STEEL[out.steelGrade].cite };
    out.Ct = ctFactor(out.temp, out.mcService);
    out.errors = errs;
    return out;
  }
  // -> { ok, key, label, G, E, hardwood, custom, FeTyped:{small,par,perp}, esr, missing:[], errors:[] }
  function resolveSpecies(H, key) {
    var k = key === null || key === undefined || key === '' ? H.species : key;
    var r = { ok: true, key: k, missing: [], errors: [] };
    if (k === 'CUSTOM') {
      var c = H.custom || {};
      r.label = (c.name && String(c.name).trim()) || 'Custom (SCL)'; r.custom = true; r.hardwood = !!c.hardwood; r.esr = c.esr || '';
      r.G = num(c.G); r.E = num(c.E);
      r.FeTyped = { small: num(c.Fe_small), par: num(c.Fe_par), perp: num(c.Fe_perp) };
      if (r.G === null) r.missing.push('custom species G'); else if (!(isNum(r.G) && r.G >= CONST.Gmin && r.G <= CONST.Gmax)) r.errors.push('custom species G must be 0.31–0.73 (Table 12.2A–C range)');
      if (r.E === null) r.missing.push('custom species E'); else if (!(isNum(r.E) && r.E > 0)) r.errors.push('custom species E must be > 0');
    } else if (SPECIES[k]) {
      var s = SPECIES[k];
      r.label = s.label; r.custom = false; r.hardwood = s.hardwood; r.G = s.G; r.esr = '';
      r.E = (H.E_override !== null && isNum(H.E_override) && H.E_override > 0) ? H.E_override : s.E;
      r.FeTyped = null;
    } else { r.ok = false; r.errors.push('unknown species "' + k + '"'); }
    return r;
  }

  // ── per-row compute ────────────────────────────────────────────────────────
  function computeRow(row, kind, H) {
    var R = {
      id: row.id, type: kind, status: 'pass', flags: [], warnings: [], notes: [], cites: [], unresolved: 0,
      inputs: {}, members: { main: null, side: null }, lengths: null, yield: null, factors: null, capacity: null, demand: null, spacingReq: null
    };
    var errs = [], missing = [];
    var I = R.inputs;
    function invalid(msg) { errs.push(msg); }
    function needNum(label, v, o) {   // o: { pos, nonneg, int } ; returns the number or null
      o = o || {};
      var n = num(v);
      if (n === null) { missing.push(label); return null; }
      if (!isNum(n)) { invalid(label + ' is not a number'); return null; }
      if (n < 0) { invalid(label + ' must not be negative'); return null; }
      if (o.pos && !(n > 0)) { invalid(label + ' must be > 0'); return null; }
      if (o.int && (n !== Math.floor(n) || n < 1)) { invalid(label + ' must be a positive integer'); return null; }
      return n;
    }
    // optNum(): like needNum but blank is allowed (returns null without marking the row incomplete) — v1.2 D < 1/4 geometry
    // inputs, which only feed the advisory Commentary-table check and may be absent on older files.
    function optNum(label, v, o) { return num(v) === null ? null : needNum(label, v, o); }
    var main = row.main || {}, side = row.side || {};
    var desc = row.desc === null || row.desc === undefined ? '' : String(row.desc);
    if (desc.length > 120 || /[<>]/.test(desc)) { R.warnings.push('description truncated / angle brackets removed (≤ 120 chars, no < >)'); desc = desc.replace(/[<>]/g, '').slice(0, 120); }
    I.desc = desc;

    // load case
    var lc = row.loadCase || 'L';
    if (!CD.hasOwnProperty(lc)) { invalid('unsupported load case "' + lc + '"'); lc = 'L'; }
    I.loadCase = lc; I.CD = CD[lc];
    I.cmException = !!row.cmException; I.shrinkDetail = !!row.shrinkDetail;   // cmException honored only for nominal D ≥ 1/4 (set below)

    // ── fastener ─────────────────────────────────────────────────────────────
    var D = null, Dy = null, Fyb = null, FybSource = '', L = null, T = null, E = null, DH = null, label = '';
    var screwType = null, doubleShear = false, mainSteel = false, toeNail = false, diaphragm = false;
    if (kind === 'bolt') {
      D = num(row.D);
      if (!isNum(D) || !BOLTS.some(function (b) { return Math.abs(b - D) < 1e-9; })) invalid('bolt diameter must be 1/2, 5/8, 3/4, 7/8 or 1 in (Table L1)');
      else { Dy = D; Fyb = 45000; FybSource = 'Table I1 / Table 12A fn 2: bolt 45,000 psi'; }
      doubleShear = row.shear === 'double';
      if (row.shear !== undefined && row.shear !== 'single' && row.shear !== 'double') invalid('bolt shear must be "single" or "double"');
      mainSteel = !!row.mainSteel;
      label = (isNum(D) ? (BOLT_LABEL[String(D)] || D) : '?') + ' in bolt, ' + (doubleShear ? 'double' : 'single') + ' shear';
      I.D = D; I.shear = doubleShear ? 'double' : 'single'; I.mainSteel = mainSteel;
      var boltT = row.demandBasis === 'total' ? row.T_total : row.T;   // §2: the check applies to whichever pair is the input (spec §13.2)
      if (boltT !== null && boltT !== undefined && boltT !== '' && Number(boltT) !== 0) invalid('bolts have no NDS withdrawal value — ' + (row.demandBasis === 'total' ? 'T_total' : 'T') + ' must be blank or 0 (§12.2.4)');
    } else if (kind === 'nail') {
      var nt = row.nailType || 'common', pn = row.penny;
      var nd = NAILS[nt] && NAILS[nt][pn];
      if (!nd) invalid('unsupported nail ' + nt + ' ' + pn + ' (Table L4 common / box / sinker 6d–20d)');
      else { D = nd.D; Dy = D; L = nd.L; DH = nd.H; E = 2 * D; T = null; Fyb = fybBand(D); FybSource = 'Table I1 / Table 12N fn 2 band by nominal D'; }
      toeNail = !!row.toeNail; diaphragm = !!row.diaphragm;
      if (row.mainSteel) invalid('nails into a steel main member are not an NDS configuration');
      label = (pn || '?') + ' ' + nt + ' nail' + (toeNail ? ' (toe-nail)' : '');
      I.nailType = nt; I.penny = pn; I.toeNail = toeNail; I.diaphragm = diaphragm;
    } else if (kind === 'screw') {
      screwType = row.screwType === 'lag' ? 'lag' : 'wood';
      if (row.screwType !== undefined && row.screwType !== 'lag' && row.screwType !== 'wood') invalid('screwType must be "wood" or "lag"');
      if (row.mainSteel) invalid('lag / wood screws into a steel main member are not an NDS configuration');
      L = needNum('L', row.L, { pos: true });
      if (screwType === 'wood') {
        var ws = WOOD_SCREWS[String(row.no)];
        if (!ws) invalid('unsupported wood screw No. ' + row.no + ' (Table L3 No. 6–14)');
        else { D = ws.D; Dy = ws.Dr; DH = ws.DH; E = 2 * D; Fyb = fybBand(D); FybSource = 'Table I1 / Table 12L fn 2 band by nominal D'; if (L !== null) T = Math.max(4 * D, 2 * L / 3); }
        label = 'No. ' + (row.no || '?') + ' wood screw × ' + (L === null ? '?' : L) + ' in';
        I.no = ws ? ws.no : row.no;
      } else {
        D = num(row.D);
        var lg = null;
        if (isNum(D)) for (var li = 0; li < LAGS.length; li++) if (Math.abs(LAGS[li].D - D) < 1e-9) lg = LAGS[li];
        if (!lg) invalid('unsupported lag screw diameter ' + row.D + ' (Table L2 1/4–1 in)');
        else {
          Dy = lg.Dr; E = lg.E; Fyb = fybLag(D); FybSource = 'Table I1 / Table 12J fn 2: ' + Fyb + ' psi for D = ' + lg.label + ' in';
          if (L !== null) {
            if (!lagAvailable(D, L)) invalid('lag ' + lg.label + ' × ' + L + ' in is not a Table L2 size');
            var listed = LAG_T[String(L)];
            if (listed !== undefined) { T = listed; I.T_source = 'Table L2 T for L = ' + L; }
            else { T = Math.min(6, L / 2 + 0.5); I.T_source = 'Table L2 fn 2: T = min(6, L/2 + 1/2) (length not in the table)'; R.warnings.push('lag length ' + L + ' in is not a Table L2 listed length; T = min(6, L/2 + 1/2) per fn 2'); }
          }
        }
        label = (lg ? lg.label : row.D) + ' × ' + (L === null ? '?' : L) + ' in lag screw';
      }
      I.screwType = screwType;
    }
    if (isNum(D) && D > CONST.Dmax + 1e-9) invalid('D > 1 in is outside Tables 12.3.1B / 12.3.3 (D ≤ 1 in)');
    var fybOv = num(row.Fyb_override);
    if (fybOv !== null) { if (!(isNum(fybOv) && fybOv > 0)) invalid('Fyb_override must be > 0'); else { Fyb = fybOv; FybSource = 'row override'; } }
    I.label = label; I.D = D; I.D_yield = Dy; I.Fyb = Fyb; I.FybSource = FybSource; I.L = L; I.T_thread = T; I.E_tip = E; I.DH = DH;
    I.D_H = isNum(DH) ? DH : null;   // head diameter used for pull-through (Table L3/L4); null for lags (hex head) and bolts
    I.coating = null;                // FD "coating" line: no product data in the NDS tables — the page prints "—"
    I.prebored = !!row.prebored;     // D < 1/4 only: selects the "Prebored" column of Commentary Tables C12.1.5.7 / C12.1.6.6
    var geomActive = isNum(D) && D >= 0.25 - 1e-9;
    if (!geomActive) I.cmException = false;   // Table 11.3.3 fn 2 exception is a D ≥ 1/4 row input; D < 1/4 takes 0.7 (spec §11)
    var withdrawalActive = kind !== 'bolt';
    I.geomActive = geomActive; I.withdrawalActive = withdrawalActive;

    // ── members ──────────────────────────────────────────────────────────────
    function resolveWood(m, name) {
      var sp = resolveSpecies(H, m.species);
      sp.errors.forEach(function (e) { invalid(name + ': ' + e); });
      sp.missing.forEach(function (e) { missing.push(name + ': ' + e); });
      var out = { mat: 'wood', species: sp.key, label: sp.label, G: sp.G, E: sp.E, hardwood: !!sp.hardwood, custom: !!sp.custom, esr: sp.esr };
      out.t = needNum(name + ' thickness t', m.t, { pos: true });
      out.w = geomActive ? needNum(name + ' width w', m.w, { pos: true }) : num(m.w);
      var th = num(m.theta); if (th === null) { missing.push(name + ' θ'); } else if (!isNum(th) || th < 0 || th > 90) { invalid(name + ' θ must be 0–90 deg'); th = null; }
      out.theta = th;
      if (isNum(D) && sp.ok && isNum(sp.G)) {
        if (sp.custom) {
          var ft = sp.FeTyped;
          if (D < 0.25) { if (ft.small === null) missing.push(name + ': custom F_e (D < 1/4 in)'); else if (!(isNum(ft.small) && ft.small > 0)) invalid(name + ': custom F_e (D < 1/4) must be > 0'); out.FePar = ft.small; out.FePerp = ft.small; }
          else {
            if (ft.par === null) missing.push(name + ': custom F_e∥'); else if (!(isNum(ft.par) && ft.par > 0)) invalid(name + ': custom F_e∥ must be > 0');
            if (ft.perp === null) missing.push(name + ': custom F_e⊥'); else if (!(isNum(ft.perp) && ft.perp > 0)) invalid(name + ': custom F_e⊥ must be > 0');
            out.FePar = ft.par; out.FePerp = ft.perp;
          }
          out.FeSource = '§12.3.3.3: typed from ' + (sp.esr || 'the evaluation report');
        } else { var fe = feWood(sp.G, D); out.FePar = fe.par; out.FePerp = fe.perp; out.FeSource = 'Table 12.3.3 fn 2 (rounded to 50 psi)' + (D < 0.25 ? ', D < 1/4 in: 16600·G^1.84' : ''); }
      }
      // geometry inputs: required for D ≥ 1/4 (Table 12.5.1 / C_Δ); optional for D < 1/4 (v1.2 advisory check, spec §13.3)
      out.towardEnd = m.towardEnd !== false;
      if (geomActive) {
        out.endDist = needNum(name + ' end distance', m.endDist, { nonneg: true });
        out.edgeDist = needNum(name + ' edge distance', m.edgeDist, { nonneg: true });
        out.loadedEdgeDist = (th !== null && th > 0) ? needNum(name + ' loaded edge distance', m.loadedEdgeDist, { nonneg: true }) : num(m.loadedEdgeDist);   // §12.1: ⊥ component toward one edge for any θ > 0
      } else {
        out.endDist = optNum(name + ' end distance', m.endDist, { nonneg: true });
        out.edgeDist = optNum(name + ' edge distance', m.edgeDist, { nonneg: true });
        out.loadedEdgeDist = num(m.loadedEdgeDist);
      }
      return out;
    }
    function resolveSteel(m, name) {
      var out = { mat: 'steel', species: null, G: null, hardwood: false, custom: false, esr: '' };
      var gauge = m.gauge === undefined || m.gauge === null || m.gauge === '' ? 'plate' : String(m.gauge);
      if (gauge === 'plate') {
        out.t = needNum(name + ' plate thickness t', m.t, { pos: true });
        if (out.t !== null && out.t < 0.25 - 1e-9) invalid(name + ': plate thickness < 1/4 in — pick a gauge (A653) instead');
        out.grade = 'A36'; out.Fe = STEEL.A36.Fe; out.FeSource = STEEL.A36.cite;
      } else if (GAUGES[gauge] !== undefined) { out.t = GAUGES[gauge]; out.grade = 'A653'; out.Fe = STEEL.A653.Fe; out.FeSource = STEEL.A653.cite; }
      else { invalid(name + ': unknown steel gauge "' + gauge + '"'); out.t = null; }
      out.gauge = gauge; out.E = STEEL.E; out.label = out.grade === 'A36' ? 'A36 plate' : (gauge + ' ga A653 Gr 33');
      out.w = geomActive ? needNum(name + ' width w', m.w, { pos: true }) : num(m.w);
      out.theta = null; out.FePar = out.Fe; out.FePerp = out.Fe;
      return out;
    }
    var M, S;
    if (kind === 'bolt' && mainSteel) {
      M = resolveSteel(main, 'main');
      if (side.mat === 'steel') invalid('steel main with steel side is not supported (side must be wood)');
      M.endGrain = false;
    } else { M = resolveWood(main, 'main'); M.endGrain = !!main.endGrain; }
    if (side.mat === 'steel') S = resolveSteel(side, 'side');
    else if (side.mat === 'wood' || side.mat === undefined || side.mat === null) S = resolveWood(side, 'side');
    else { invalid('side.mat must be "wood" or "steel"'); S = resolveWood(side, 'side'); }
    if (toeNail && S.mat === 'steel') invalid('toe-nail requires a wood side member');
    R.members.main = M; R.members.side = S;

    // ── group inputs ─────────────────────────────────────────────────────────
    // v1.2 (spec §13.2): n and rows are active for every fastener type (qty = n·rows). For D < 1/4 a blank n / rows
    // means 1 (v1.1 files never used them) and s / g are optional — they feed only the advisory spacing check (§13.3).
    var n = 1, rows = 1, s = null, g = null;
    if (geomActive) {
      n = needNum('n (fasteners per row)', row.n, { int: true });
      rows = needNum('rows', row.rows, { int: true });
      s = needNum('spacing s', row.s, { nonneg: true });
      g = needNum('row spacing g', row.g, { nonneg: true });
    } else {
      n = num(row.n) === null ? 1 : needNum('n (fasteners per row)', row.n, { int: true });
      rows = num(row.rows) === null ? 1 : needNum('rows', row.rows, { int: true });
      s = optNum('spacing s', row.s, { nonneg: true });
      g = optNum('row spacing g', row.g, { nonneg: true });
    }
    var qty = (n !== null && rows !== null) ? n * rows : null;
    I.n = n; I.rows = rows; I.qty = qty; I.s = s; I.g = g;
    // staggered rows (§11.3.6.2): active only when stagger && rows ≥ 2 && D ≥ 1/4
    var staggerActive = geomActive && !!row.stagger && rows !== null && rows >= 2, offset = null;
    if (staggerActive) {
      offset = needNum('stagger offset', row.offset, { pos: true });
      if (offset !== null && s !== null && offset >= s - 1e-12) invalid('stagger offset must be less than the in-row spacing s');
    }
    I.stagger = staggerActive; I.offset = staggerActive ? offset : null;
    // §11.3.6.2 measures the distance between the CLOSEST fasteners in adjacent rows: min(offset, s − offset)
    var offClosest = (staggerActive && offset !== null && s !== null) ? Math.min(offset, s - offset) : null;
    I.offClosest = offClosest;

    // ── demands (spec §13.2: per-fastener or whole-connection input; the other pair is derived) ──
    var basis = row.demandBasis === 'total' ? 'total' : 'per';
    var V, Tw, Vtot = null, Ttot = null;
    if (basis === 'total') {
      Vtot = needNum('V_total', row.V_total, { nonneg: true });
      Ttot = withdrawalActive ? needNum('T_total', row.T_total, { nonneg: true }) : null;
      V = (Vtot !== null && qty !== null) ? Vtot / qty : null;
      Tw = (Ttot !== null && qty !== null) ? Ttot / qty : null;
    } else {
      V = needNum('V', row.V, { nonneg: true });
      Tw = withdrawalActive ? needNum('T', row.T, { nonneg: true }) : null;
      Vtot = (V !== null && qty !== null) ? V * qty : null;
      Ttot = (Tw !== null && qty !== null) ? Tw * qty : null;
    }
    I.demandBasis = basis; I.V = V; I.T = withdrawalActive ? Tw : null; I.V_total = Vtot; I.T_total = withdrawalActive ? Ttot : null;
    function mkDemand() { return { V: V, T: I.T, V_total: Vtot, T_total: I.T_total, qty: qty, dcV: null, dcT: null, dcComb: null, dc: null, pctV: null, pctT: null, pctComb: null }; }
    function emptyCap() { return { Zp: null, W: null, Wp: null, Wcap_withdrawal: null, WH: null, WHp: null, Wcap: null, withdrawalGov: null, Zalpha: null, alpha: null, Z_total: null, W_total: null }; }

    // ── cites and notes common to every row ─────────────────────────────────
    R.cites.push('NDS 2018 §12.3.1 Table 12.3.1A/B yield-limit equations; Table 12.3.3 fn 2 F_e rounded to the nearest 50 psi');
    R.notes.push('§12.3.1(a)–(d): faces in contact, load ⊥ to fastener axis, fasteners in aligned rows, geometry per §12.5');
    if (kind === 'bolt') { R.notes.push('hole 1/32–1/16 in oversize, washers under head and nut (§12.1.3.2/.3)'); R.notes.push('threads excluded from bearing or ≤ 1/4 of bearing length (§12.3.7.2)'); }
    if (kind === 'screw' && screwType === 'lag') R.notes.push('lead holes §12.1.4.2/.3');
    if (kind === 'screw' && screwType === 'wood') R.notes.push('lead holes §12.1.5.2/.3');
    if (kind === 'nail') R.notes.push('bored holes §12.1.6.2');
    if (M.custom || S.custom) { R.notes.push('SCL properties: engineer\'s envelope from ' + ((M.custom ? M.esr : S.esr) || 'the evaluation report') + ' (§12.3.3.3)'); }

    // invalid / incomplete rows carry no unresolved engineer checks (spec §11)
    if (errs.length) { R.status = 'invalid'; R.unresolved = 0; errs.forEach(function (e) { R.warnings.push('Invalid: ' + e); }); return R; }
    if (missing.length) { R.status = 'incomplete'; R.unresolved = 0; missing.forEach(function (e) { R.warnings.push('Incomplete: ' + e); }); return R; }
    if (M.mat === 'steel' || S.mat === 'steel') { R.notes.push('plate bearing / net section per AISC (not computed)'); R.unresolved += 1; }

    // ── bearing strengths actually used ─────────────────────────────────────
    var Fem, Fes, thetaK = 0;
    if (M.mat === 'steel') Fem = M.Fe;
    else if (M.endGrain && geomActive) { Fem = M.FePerp; R.cites.push('§12.3.3.4 (p.84/98): "Where dowel-type fasteners with D ≥ 1/4" are inserted into the end grain of the main member, with the fastener axis parallel to the wood fibers, F_e⊥ shall be used in the determination of the dowel bearing strength of the main member, F_em."'); }
    else Fem = feAtAngle(M.FePar, M.FePerp, M.theta);
    Fes = S.mat === 'steel' ? S.Fe : feAtAngle(S.FePar, S.FePerp, S.theta);
    M.Fe = Fem; S.Fe = Fes;
    var anyAngle = (M.mat === 'wood' && !M.endGrain && M.theta > 0 && M.theta < 90) || (S.mat === 'wood' && S.theta > 0 && S.theta < 90);
    if (anyAngle) R.cites.push('§12.3.4 Eq. 12.3-11 (p.84/98) Hankinson: F_eθ = F_e∥·F_e⊥ / (F_e∥·sin²θ + F_e⊥·cos²θ) from the rounded ∥/⊥ values, used unrounded; K_θ = 1 + 0.25(θ_max/90) at the actual angle (Table 12.3.1B)');
    if (M.mat === 'wood') thetaK = Math.max(thetaK, M.endGrain ? 90 : M.theta);   // end grain: load ⊥ to the main member's grain
    if (S.mat === 'wood') thetaK = Math.max(thetaK, S.theta);
    if (M.mat === 'wood' && M.endGrain) R.cites.push('K_θ: end-grain main member taken at θ = 90 (load ⊥ to its grain), Table 12.3.1B note');

    // ── lengths (spec §5.3) ──────────────────────────────────────────────────
    var tm = M.t, ts = S.t, Lg = null;
    function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
    if (kind === 'bolt') {
      Lg = { p_tot: null, tip_in: null, p_excl: null, l_m: tm, l_s: ts, p_t: null, p_min: null, exits_main: false, toeNail: false };
    } else if (toeNail) {
      var lsT = Math.min(ts, L / 3), lmRaw = L * COS30 - L / 3, ptRaw = L - L / (3 * COS30);
      Lg = { p_tot: Math.min(ptRaw, tm / COS30), tip_in: null, p_excl: null, l_m: Math.min(lmRaw, tm), l_s: lsT, p_t: Math.min(ptRaw, tm / COS30),
             p_min: 6 * D, exits_main: ptRaw > tm / COS30, toeNail: true, l_m_raw: lmRaw, p_t_raw: ptRaw };
      R.cites.push('§12.3.10.2 toe-nail l_s = min(t_s, L/3); Commentary C12.5.4-1 l_m = L·cos30° − L/3 (capped at t_m); C12.5.4.1 withdrawal p_t = actual nail length in the member holding the point (capped where the nail would exit)');
      if (Lg.p_t < Lg.p_min - 1e-9) R.flags.push('p_min');
      if (Lg.exits_main) R.warnings.push('toe-nail would exit the main member (t_m/cos30° < actual length); lengths capped');
    } else {
      var m0 = ts, m1 = ts + tm;
      var p_tot = overlap(ts, L, m0, m1), tip_in = overlap(L - E, L, m0, m1), p_excl = p_tot - tip_in;
      var thr0 = kind === 'nail' ? 0 : L - T, thr1 = (kind === 'screw' && screwType === 'lag') ? L - E : L;
      var p_t = overlap(thr0, thr1, m0, m1);
      Lg = { p_tot: p_tot, tip_in: tip_in, p_excl: p_excl, l_m: p_tot - tip_in / 2, l_s: ts, p_t: p_t,
             p_min: (screwType === 'lag' ? 4 : 6) * D, exits_main: L > ts + tm + 1e-9, toeNail: false, head_gap: L - ts - tm };
      if (Lg.exits_main) R.warnings.push('fastener exits the main member: L − t_s = ' + f3(L - ts) + ' > t_m = ' + f3(tm) + ' — lengths capped at t_m');   // spec §13.1 wording
      if (screwType === 'lag') { if (p_excl < Lg.p_min - 1e-9) R.flags.push('p_min'); R.cites.push('§12.1.4.6 lag p_min = 4D excluding the tip E; §12.3.5.3 l_m ≤ p − E/2'); }
      else { if (p_tot < Lg.p_min - 1e-9) R.flags.push('p_min'); R.cites.push((kind === 'nail' ? '§12.1.6.4' : '§12.1.5.6') + ' p_min = 6D including the tip; §12.3.5.3 l_m ≤ p − E/2 with E = 2D'); }
      if (Lg.l_m <= 0) R.flags.push('p_min');
    }
    R.lengths = Lg;
    if (R.flags.indexOf('p_min') >= 0) R.warnings.push('penetration below p_min (' + f3(Lg.p_min) + ' in): §12.3.1(d) precondition fails');
    if (withdrawalActive && Tw > 0 && !(Lg.p_t > 1e-12)) { R.flags.push('no_thread_in_main'); R.warnings.push('withdrawal demand but no ' + (kind === 'nail' ? 'fastener' : 'thread') + ' penetration into the main member (p_t = 0): withdrawal capacity undefined'); }

    // l/D from wood members only (Table 12.5.1C/D fn 1)
    var lD = null;
    if (geomActive) {
      var cands = [];
      if (M.mat === 'wood') cands.push(kind === 'bolt' ? Lg.l_m : Lg.p_tot);   // Table 12.5.1C/D fn 1: length of fastener in the wood main member (p_tot; bolts t_m)
      if (S.mat === 'wood') cands.push(doubleShear ? 2 * ts : ts);
      lD = cands.length ? Math.min.apply(null, cands) / D : null;
    }
    Lg.lD = lD;

    // ── geometry: hard minimums, C_Δ, spread (§12.5.1, nominal D ≥ 1/4) ──────
    var Cdelta = 1.0, geom = null;
    var withdrawalOnlyLag = screwType === 'lag' && V === 0 && Tw > 0;
    if (geomActive) {
      geom = { members: [], lD: lD, rule: withdrawalOnlyLag ? 'Table 12.5.1E (lag in withdrawal only)' : 'Tables 12.5.1A–D' };
      var members = [];
      if (M.mat === 'wood') members.push({ name: 'main', m: M });
      if (S.mat === 'wood') members.push({ name: 'side', m: S });
      var ratios = [];
      members.forEach(function (mm) {
        var m = mm.m, gm = { member: mm.name, theta: m.theta };
        if (withdrawalOnlyLag) {
          gm.endMin = 4 * D; gm.edgeMin = 1.5 * D;
          if (m.edgeDist < gm.edgeMin - 1e-9) R.flags.push('geom_edge');
          if (m.endDist < gm.endMin - 1e-9) R.flags.push('geom_end');
        } else {
          // General θ (spec §12.1): end distance interpolated between the θ = 0 and θ = 90 values by θ/90 (Commentary C12.5.1.2);
          // edge = ⊥ rule for any θ > 0; row spacing = max of the ∥ and ⊥ minima; spread = (n−1)·s·sinθ + (rows−1)·g·cosθ.
          var th = m.theta, sinT = Math.sin(th * Math.PI / 180), cosT = Math.cos(th * Math.PI / 180);
          var ed = endDistance(D, th, m.towardEnd, m.hardwood);
          gm.endFull = ed.full; gm.endHalf = ed.half;
          var rowPar = 1.5 * D, rowPerp = lD <= 2 ? 2.5 * D : (lD < 6 ? (5 * lD * D + 10 * D) / 8 : 5 * D);
          if (th === 0) {
            gm.edgeMin = (lD <= 6 || rows < 2) ? 1.5 * D : Math.max(1.5 * D, g / 2); gm.rowMin = rowPar;   // Table 12.5.1C: "½ the spacing between rows" needs two rows
          } else {
            // D5: unloaded edge at 0 < θ < 90 envelopes the ∥ rule (g/2 when l/D > 6 and rows ≥ 2); θ = 90 is the pure ⊥ rule.
            gm.edgeMin = th === 90 ? 1.5 * D : ((lD <= 6 || rows < 2) ? 1.5 * D : Math.max(1.5 * D, g / 2));
            gm.loadedEdgeMin = 4 * D; gm.rowMin = th === 90 ? rowPerp : Math.max(rowPar, rowPerp);
            if (m.loadedEdgeDist < gm.loadedEdgeMin - 1e-9) R.flags.push('geom_edge');
          }
          if (m.edgeDist < gm.edgeMin - 1e-9) R.flags.push('geom_edge');
          if (rows >= 2 && g < gm.rowMin - 1e-9) R.flags.push('geom_row');
          if (m.endDist < gm.endHalf - 1e-9) R.flags.push('geom_end'); else ratios.push(m.endDist / gm.endFull);
          // along-row extent of the group: (n − 1)·s, plus the closest-fastener offset when rows are staggered (§12.5.1.3 outermost fasteners)
          var alongRow = (n - 1) * s + (staggerActive ? offClosest : 0);
          gm.spread = th === 90 ? alongRow : (th === 0 ? (rows - 1) * g : alongRow * sinT + (rows - 1) * g * cosT);
          if (th > 0 && th < 90) { gm.interpolated = true; R.notes.push(mm.name + ' geometry at θ = ' + th + '° by interpolation (end) and the governing of the ∥/⊥ rules (edge, rows) — Commentary C12.5.1.2'); }
        }
        if (gm.spread > CONST.spreadMax + 1e-9) { if (I.shrinkDetail) R.notes.push(mm.name + ' across-grain spread ' + f3(gm.spread) + ' in > 5 in: shrinkage detailing provided (§12.5.1.3 exception)'); else R.flags.push('spread5'); }
        geom.members.push(gm);
      });
      if (withdrawalOnlyLag) { geom.sMin = 4 * D; if (n >= 2 && s < geom.sMin - 1e-9) R.flags.push('geom_spacing'); Cdelta = 1.0; }
      else {
        geom.sFull = 4 * D; geom.sMin = 3 * D;
        if (n >= 2) { if (s < geom.sMin - 1e-9) R.flags.push('geom_spacing'); else ratios.push(s / geom.sFull); }
        Cdelta = Math.min.apply(null, [1].concat(ratios));
      }
      if (S.mat === 'steel' || M.mat === 'steel') R.notes.push('steel plate edge / end / spacing per AISC (§12.1.2.5)');
      geom.Cdelta = Cdelta;
      // dedupe flags
      R.flags = R.flags.filter(function (f, i, a) { return a.indexOf(f) === i; });
      if (R.flags.some(function (f) { return f.indexOf('geom_') === 0; })) R.warnings.push('geometry below a Table 12.5.1 hard minimum (' + R.flags.filter(function (f) { return f.indexOf('geom_') === 0; }).join(', ') + ')');
      if (R.flags.indexOf('spread5') >= 0) R.warnings.push('across-grain spread between outermost fasteners > 5 in without shrinkage detailing (§12.5.1.3)');
    }

    // ── minimum spacing requirements block (spec §13.3, FD "Minimum Spacing Requirements") ──────────────
    // Required values are keyed to the main member's θ / towardEnd / hardwood (the side member when the main is steel).
    // D ≥ 1/4: the very gm objects evaluated above (Tables 12.5.1A–D / E) so the numbers cannot diverge; checks echo the
    //          hard minima that already drive the geom_* flags.
    // D < 1/4: Commentary Table C12.1.5.7 / C12.1.6.6 recommendations (nD by nominal D) by side material and `prebored`;
    //          checks are advisory — warnings only, never a flag, never a status change; blank inputs skip silently.
    var SR = null;
    var keyM = M.mat === 'wood' ? M : (S.mat === 'wood' ? S : null), keyName = keyM === M ? 'main' : 'side';
    if (geomActive && keyM) {
      var gmKey = null; geom.members.forEach(function (gm) { if (gm.member === keyName) gmKey = gm; });
      var checks = [];
      var chk = function (name, req, act) { checks.push({ name: name, required: req, actual: act, ok: isNum(act) && isNum(req) ? act >= req - 1e-9 : null }); };
      if (withdrawalOnlyLag) {
        SR = { basis: 'NDS Table 12.5.1E (lag in withdrawal only, not loaded laterally)', member: keyName,
               a1_par: 4 * D, a2_perp: 4 * D, end_loaded: 4 * D, end_unloaded: 4 * D, edge_loaded: 1.5 * D, edge_unloaded: 1.5 * D,
               rows_inline: 4 * D, rows_staggered: 4 * D, rowsStaggeredNote: 'Table 12.5.1E gives one spacing value (4D); no separate row-spacing value' };
        geom.members.forEach(function (gm) { var mm = gm.member === 'main' ? M : S; chk(gm.member + ' end distance', gm.endMin, mm.endDist); chk(gm.member + ' edge distance', gm.edgeMin, mm.edgeDist); });
        if (n >= 2) chk('spacing in a row s', geom.sMin, s);
      } else {
        SR = { basis: 'NDS Table 12.5.1A–D (C_Δ = 1.0 values; hard minima in checks)', member: keyName,
               a1_par: 4 * D, a2_perp: 4 * D,                                    // Table 12.5.1B ∥ full 4D; attached-member rule (spec §6) 4D
               end_loaded: gmKey.endFull, end_unloaded: 4 * D,                   // Table 12.5.1A full value at the row's θ / towardEnd / hardwood; compression / ⊥ 4D
               edge_loaded: 4 * D, edge_unloaded: gmKey.edgeMin,                 // Table 12.5.1C loaded edge 4D; unloaded 1.5D or the ∥ l/D > 6 g/2 rule
               rows_inline: gmKey.rowMin, rows_staggered: gmKey.rowMin,          // Table 12.5.1D by θ and l/D
               rowsStaggeredNote: 'same as in-line (NDS gives no separate staggered value)' };
        geom.members.forEach(function (gm) {
          var mm = gm.member === 'main' ? M : S;
          chk(gm.member + ' end distance (hard min = C_Δ 0.5 value)', gm.endHalf, mm.endDist);
          chk(gm.member + ' edge distance', gm.edgeMin, mm.edgeDist);
          if (gm.theta > 0) chk(gm.member + ' loaded edge distance', gm.loadedEdgeMin, mm.loadedEdgeDist);
          if (rows >= 2) chk(gm.member + ' row spacing g', gm.rowMin, g);
        });
        if (n >= 2) chk('spacing in a row s (hard min 3D)', geom.sMin, s);
      }
      SR.checks = checks;
    } else if (keyM) {
      var tbl = SMALL_D_SPACING[S.mat === 'steel' ? 'steel' : 'wood'], pb = I.prebored ? 1 : 0;
      var cite = SMALL_D_SPACING.cite[kind === 'nail' ? 'nail' : 'wood'] + ', ' + (I.prebored ? 'prebored' : 'not prebored');
      var mult = { edge: tbl.edge[pb], endT: tbl.endTension[pb], endC: tbl.endCompression[pb], rowPar: tbl.rowPar[pb], rowPerp: tbl.rowPerp[pb], rowsIn: tbl.rowsInline[pb], rowsSt: tbl.rowsStaggered[pb] };
      var thK = keyM.theta, sMult = thK === 0 ? mult.rowPar : (thK === 90 ? mult.rowPerp : Math.max(mult.rowPar, mult.rowPerp));   // ∥ at 0, ⊥ at 90, the larger between
      var endMultOf = function (mm) { return mm.towardEnd ? mult.endT : mult.endC; };
      SR = { basis: 'Commentary Table C12.1.5.7 (wood screws) / C12.1.6.6 (nails), advisory (PDF 268–269)', member: keyName, sideMat: S.mat, prebored: I.prebored,
             a1_par: mult.rowPar * D, a2_perp: mult.rowPerp * D, end_loaded: endMultOf(keyM) * D, end_unloaded: mult.endC * D,
             edge_loaded: mult.edge * D, edge_unloaded: mult.edge * D, rows_inline: mult.rowsIn * D, rows_staggered: mult.rowsSt * D,
             s_required: sMult * D, s_rule: thK === 0 ? '∥ to grain (main θ = 0)' : (thK === 90 ? '⊥ to grain (main θ = 90)' : 'larger of ∥ / ⊥ (main θ = ' + thK + ')'),
             multiples: { edge: mult.edge, endTension: mult.endT, endCompression: mult.endC, rowPar: mult.rowPar, rowPerp: mult.rowPerp, rowsInline: mult.rowsIn, rowsStaggered: mult.rowsSt, s: sMult },
             checks: [] };
      var adv = function (name, k, act) {
        if (!isNum(act)) return;   // older files: geometry not typed for D < 1/4 → skip silently
        var req = k * D, ok = act >= req - 1e-9;
        SR.checks.push({ name: name, required: req, actual: act, ok: ok, mult: k });
        if (!ok) R.warnings.push('advisory spacing: ' + name + ' = ' + f3(act) + ' < ' + k + 'D = ' + f3(req) + ' (' + cite + ')');
      };
      if (n >= 2) adv('s', sMult, s);
      if (rows >= 2) adv('g', mult.rowsIn, g);
      [['main', M], ['side', S]].forEach(function (p) { if (p[1].mat !== 'wood') return; adv(p[0] + ' end distance', endMultOf(p[1]), p[1].endDist); adv(p[0] + ' edge distance', mult.edge, p[1].edgeDist); });
      R.notes.push('spacing for D < 1/4 in per NDS §12.1.5.7 / §12.1.6.5 (sufficient to prevent splitting); Commentary table used as the recommendation');
    }
    R.spacingReq = SR;

    // end-grain withdrawal refusal (nails / wood screws)
    if (withdrawalActive && M.endGrain && screwType !== 'lag' && Tw > 0) { R.flags.push('endgrain_withdrawal'); R.warnings.push((kind === 'nail' ? '§12.2.3.3' : '§12.2.2.3') + ': no withdrawal from end grain (C_eg = 0)'); }

    // ── yield modes ──────────────────────────────────────────────────────────
    var Kt = Ktheta(thetaK), Rd, RdCase;
    if (Dy >= 0.25 - 1e-9) { Rd = { I: 4 * Kt, II: 3.6 * Kt, III: 3.2 * Kt }; RdCase = 'Table 12.3.1B: 0.25 ≤ D ≤ 1 → 4K_θ / 3.6K_θ / 3.2K_θ'; }
    else if (!geomActive) { var kd = KD(Dy); Rd = { I: kd, II: kd, III: kd }; RdCase = 'Table 12.3.1B: D < 0.25 → R_d = K_D = ' + f3(kd) + ' (all modes)'; }
    else { var kd2 = KD(Dy); Rd = { I: kd2 * Kt, II: kd2 * Kt, III: kd2 * Kt }; RdCase = 'Table 12.3.1B fn 1: nominal D ≥ 0.25 with D_r < 0.25 → R_d = K_D·K_θ = ' + f3(kd2) + ' × ' + f3(Kt); }
    I.thetaK = thetaK; I.RdCase = RdCase; I.Fem = Fem; I.Fes = Fes;
    // Penetration-flagged rows (p_min, no_thread_in_main) carry no yield block: l_m may be 0 and the §12.3.1(d) precondition already fails.
    var penFlag = R.flags.indexOf('p_min') >= 0 || R.flags.indexOf('no_thread_in_main') >= 0;
    var Y = null;
    if (!penFlag && Lg.l_m > 0 && Lg.l_s > 0) {
      Y = yieldModes({ D: Dy, lm: Lg.l_m, ls: Lg.l_s, Fem: Fem, Fes: Fes, Fyb: Fyb, Rd: Rd, double: doubleShear });
      R.yield = { Re: Y.Re, Rt: Y.Rt, Ktheta: Kt, KD: Dy < 0.25 ? KD(Dy) : null, Rd: { Im: Rd.I, Is: Rd.I, II: doubleShear ? null : Rd.II, IIIm: doubleShear ? null : Rd.III, IIIs: Rd.III, IV: Rd.III },
                  k1: Y.k1, k2: Y.k2, k3: Y.k3, modes: Y.modes, Z: Y.Z, governing: Y.governing };
    } else R.yield = null;

    // ── C_g (Eq. 11.3-1) ─────────────────────────────────────────────────────
    var Cg = 1.0, cg = null;
    var wGroup = rows >= 2 ? (rows - 1) * g : 3 * D;   // §11.3.6.3 ⊥ equivalent width (physical rows and g, also under stagger)
    // rule 'gross' = t·w (θ = 0 interpretation); 'perp' = t·w_group (θ = 90 interpretation); members at exactly 0 / 90 keep their own rule.
    function memberArea(m, rule) {
      if (m.mat === 'steel') return m.t * m.w;
      if (m.theta === 90) return m.t * wGroup;
      if (m.theta === 0) return m.t * m.w;
      return rule === 'perp' ? m.t * wGroup : m.t * m.w;
    }
    // staggered rows: §11.3.6.2 merge rule
    // merge test on the closest-fastener offset; merged row: n_eff = 2n at the mean spacing s/2, rows_eff = ceil(rows/2).
    var nEff = n, sEff = s, rowsEff = rows, merged = false;
    if (staggerActive) { merged = g < offClosest / 4 - 1e-12; if (merged) { nEff = 2 * n; sEff = s / 2; rowsEff = Math.ceil(rows / 2); } }
    if (geomActive) {
      var angleCg = (M.mat === 'wood' && M.theta > 0 && M.theta < 90) || (S.mat === 'wood' && S.theta > 0 && S.theta < 90);
      var runCg = function (rule, nn, ss) {
        var Am = memberArea(M, rule), As = memberArea(S, rule) * (doubleShear ? 2 : 1), o;
        if (nn >= 2) o = groupAction({ n: nn, s: ss, D: D, Em: M.E, Am: Am, Es: S.E, As: As, metal: M.mat === 'steel' || S.mat === 'steel' });
        else o = { Cg: 1, n: nn, note: 'n = 1 → C_g = 1.0' };
        o.Am = Am; o.As = As; o.rule = rule; o.s = ss; return o;
      };
      var lower = function (a, b) { return (b && (a.Cg === null || (b.Cg !== null && b.Cg < a.Cg))) ? b : a; };
      // area interpretations (angle) × layouts (merged vs separate rows, D3 "most conservative interpretation" guard)
      var cgGross = runCg('gross', nEff, sEff), cgPerp = angleCg ? runCg('perp', nEff, sEff) : null;
      var cgGrossSep = merged ? runCg('gross', n, s) : null, cgPerpSep = (merged && angleCg) ? runCg('perp', n, s) : null;
      cgGross.layout = merged ? 'merged' : 'separate'; if (cgPerp) cgPerp.layout = cgGross.layout;
      var cgMergedBest = lower(cgGross, cgPerp), cgSepBest = cgGrossSep ? lower(cgGrossSep, cgPerpSep) : null;
      if (cgSepBest) cgSepBest.layout = 'separate';
      cg = lower(cgMergedBest, cgSepBest);
      if (angleCg) { cg.interpretations = { gross: { Am: cgGross.Am, As: cgGross.As, Cg: cgGross.Cg }, perp: { Am: cgPerp.Am, As: cgPerp.As, Cg: cgPerp.Cg } }; cg.governingRule = cg.rule; R.notes.push('C_g at an angle: lesser of the ∥ and ⊥ area interpretations (§11.3.6.3)'); }
      Cg = cg.Cg;
      M.A = cg.Am; S.A = cg.As;
      cg.Em = M.E; cg.Es = S.E; cg.n_phys = n; cg.s_phys = s;
      cg.stagger = { stagger: staggerActive, offset: staggerActive ? offset : null, offClosest: offClosest, merged: merged, n_eff: nEff, s_eff: sEff, rows_eff: rowsEff,
                     Cg_merged: merged ? cgMergedBest.Cg : null, Cg_separate: merged ? cgSepBest.Cg : (staggerActive ? cgMergedBest.Cg : null), governingLayout: cg.layout || 'separate' };
      if (staggerActive) {
        cg.staggerCite = '§11.3.6.2 (Fig. 11B): closest-fastener offset ' + f3(offClosest) + ' in; ' + (merged ? 'g = ' + f3(g) + ' < offset/4 = ' + f3(offClosest / 4) + ' → adjacent rows act as one row for C_g: n_eff = 2n = ' + nEff + ', s_eff = s/2 = ' + f3(sEff) + ', rows_eff = ' + rowsEff + '; C_g = min(merged ' + f3(cgMergedBest.Cg) + ', separate ' + f3(cgSepBest.Cg) + ')' : 'g = ' + f3(g) + ' ≥ offset/4 = ' + f3(offClosest / 4) + ' → rows stay separate for C_g');
        if ((M.mat === 'wood' && M.theta > 0) || (S.mat === 'wood' && S.theta > 0)) R.notes.push('§12.6.1 — stagger symmetrically');
      }
      var wGroupUsed = (M.mat === 'wood' && M.theta === 90) || (S.mat === 'wood' && S.theta === 90) || (cg.rule === 'perp');
      if (M.mat === 'wood' && M.theta > 0 && (M.theta === 90 || cg.rule === 'perp')) cg.wGroupMain = wGroup;
      if (S.mat === 'wood' && S.theta > 0 && (S.theta === 90 || cg.rule === 'perp')) cg.wGroupSide = wGroup;
      if (wGroupUsed) cg.wGroupCite = rows >= 2 ? '§11.3.6.3: ⊥-loaded member area = t × overall width of the group, (rows − 1)·g' : '§11.3.6.3: single row → t × minimum ∥-to-grain spacing 3D (Table 12.5.1B)';
      if (anyAngle && n * rows > 1) { R.notes.push('gravity axis of each member must pass through the center of resistance of the fastener group (§12.6.2)'); R.unresolved += 1; }
    } else { M.A = null; S.A = null; }

    // ── adjustment factors ───────────────────────────────────────────────────
    var cmL = cmLateral(H.mcFab, H.mcService, D, I.cmException), cmW = cmWithdrawal(screwType === 'lag' ? 'lag' : (screwType === 'wood' ? 'wood' : kind), H.mcFab, H.mcService, toeNail), cmH = cmPullThrough(H.mcService);
    var Ct = H.Ct;
    var Ceg = (M.mat === 'wood' && M.endGrain) ? CONST.Ceg_lateral : 1.0;
    var Cegw = (M.mat === 'wood' && M.endGrain && screwType === 'lag') ? CONST.Ceg_lag_withdrawal : 1.0;
    var Cdi = (kind === 'nail' && diaphragm) ? CONST.Cdi : 1.0;
    var Ctn = toeNail ? CONST.Ctn_Z : 1.0, CtnW = toeNail ? CONST.Ctn_W : 1.0;
    R.factors = {
      CD: { v: I.CD, cite: 'Table 2.3.2 / §11.3.2: ' + CD_LABEL[lc] + ' (C_D ≤ 1.6 on connections)' },
      CM: { v: cmL.v, cite: cmL.cite },
      CMw: { v: withdrawalActive ? cmW.v : null, cite: withdrawalActive ? cmW.cite : 'n/a (bolt)' },
      CMH: { v: cmH.v, cite: cmH.cite },
      Ct: { v: Ct, cite: 'Table 11.3.4: ' + H.temp + ', in-service ' + H.mcService },
      Cg: { v: Cg, cite: geomActive ? ((nEff >= 2 ? (Cg === null ? cg.reason : 'Eq. 11.3-1 (§11.3.6.1), γ = ' + (cg.metal ? '270,000' : '180,000') + '·D^1.5') : '§11.3.6.1: n = 1 → 1.0') + (staggerActive ? '; ' + cg.staggerCite : '')) : '§11.3.6.1: D < 1/4 in → 1.0', detail: cg },
      Cdelta: { v: Cdelta, cite: geomActive ? '§12.5.1.2 / ' + geom.rule : '§12.5.1.1: D < 1/4 in → 1.0', detail: geom },
      Ceg: { v: Ceg, cite: Ceg < 1 ? '§12.5.2.2: dowel in end grain of the main member → 0.67' : '§12.5.2.2: side grain → 1.0' },
      Cegw: { v: withdrawalActive ? Cegw : null, cite: Cegw < 1 ? '§12.2.1.3 / §12.5.2.1: lag withdrawal from end grain → 0.75' : (withdrawalActive ? 'side grain → 1.0' : 'n/a (bolt)') },
      Cdi: { v: Cdi, cite: Cdi > 1 ? '§12.5.3: nails in diaphragm construction → 1.1' : '§12.5.3: not a diaphragm nail → 1.0' },
      Ctn: { v: Ctn, cite: toeNail ? '§12.5.4.2: toe-nail lateral 0.83 (withdrawal 0.67, §12.5.4.1)' : '§12.5.4: not toe-nailed → 1.0' }
    };
    if (cg && nEff >= 2) R.factors.Cg.detail.metal = M.mat === 'steel' || S.mat === 'steel';

    // ── capacities ───────────────────────────────────────────────────────────
    var Zp = (Y && Cg !== null) ? Y.Z * I.CD * cmL.v * Ct * Cg * Cdelta * Ceg * Cdi * Ctn : null;
    var cap = emptyCap(); cap.Zp = Zp;
    if (withdrawalActive) {
      var wkind = screwType === 'lag' ? 'lag' : (screwType === 'wood' ? 'wood' : 'nail');
      cap.W = withdrawalUnit(wkind, M.G, D);
      cap.Wp = cap.W * I.CD * cmW.v * Ct * Cegw * CtnW;
      cap.Wcap_withdrawal = cap.Wp * Lg.p_t;
      cap.Wcap = cap.Wcap_withdrawal; cap.withdrawalGov = 'withdrawal';
      R.cites.push(wkind === 'lag' ? 'Eq. 12.2-1 W = 1800·G^1.5·D^0.75 (lb/in of thread penetration, tip excluded §12.2.1.2)' : wkind === 'wood' ? 'Eq. 12.2-2 W = 2850·G²·D (lb/in of thread penetration §12.2.2.2)' : 'Eq. 12.2-3 W = 1380·G^2.5·D (lb/in of fastener penetration §12.2.3.1(c))');
      if (wkind !== 'lag' && S.mat === 'wood' && isNum(DH)) {
        var pt = pullThrough(DH, S.G, ts);
        if (ts < 5 / 16 - 1e-9 || ts > 1.5 + 1e-9) R.warnings.push('head pull-through outside Table 12.2F range (t_ns 5/16–1-1/2 in); Eq. 12.2-6 extrapolated');
        cap.WH = pt.WH; cap.WHp = pt.WH * I.CD * cmH.v * Ct; I.WH_eq = pt.eq; Lg.t_ns = ts;
        R.cites.push('§12.2.5.1 Eq. ' + pt.eq + ', D_H = ' + DH + ' in (Table ' + (kind === 'nail' ? 'L4' : 'L3') + '), t_ns = t_s; W\'_H = W_H·C_D·C_M·C_t (Table 11.3.1)');
        if (cap.WHp < cap.Wcap) { cap.Wcap = cap.WHp; cap.withdrawalGov = 'pull-through'; }
      } else if (Tw > 0) {
        R.notes.push('head/washer pull-through per §12.2.5 / §11.1.1.3 not computed' + (wkind === 'lag' ? ' (hex head)' : ' (steel side member)'));
        R.unresolved += 1;
      }
      if (wkind !== 'nail' && Tw > 0) {
        var Ar = Math.PI * Dy * Dy / 4;
        R.notes.push('root-area steel tension: T = ' + Tw + ' lb vs A_r = π·D_r²/4 = ' + Ar.toFixed(4) + ' in² per §11.2.3 (not computed)');
        R.unresolved += 1;
      }
    }
    // connection totals (spec §13.2): qty · per-fastener capacity; null when the per-fastener value is suppressed / n/a
    cap.Z_total = isNum(cap.Zp) ? qty * cap.Zp : null;
    cap.W_total = isNum(cap.Wcap) ? qty * cap.Wcap : null;
    R.capacity = cap;

    // ── status / demand ──────────────────────────────────────────────────────
    R.flags = R.flags.filter(function (f, i, a) { return a.indexOf(f) === i; });
    if (R.flags.length) { R.status = 'fail'; R.capacity = emptyCap(); R.demand = mkDemand(); return R; }
    var dem = mkDemand();
    var Tv = withdrawalActive ? Tw : 0;
    if (V === 0 && Tv === 0) { R.status = 'nodemand'; R.demand = dem; return R; }
    if (V > 0) dem.dcV = V / Zp;
    if (Tv > 0) dem.dcT = Tv / cap.Wcap;
    if (V > 0 && Tv > 0) {
      var cb = combined(kind === 'nail' ? 'nail' : 'screw', V, Tv, Zp, cap.Wcap);
      cap.Zalpha = cb.Zalpha; cap.alpha = cb.alpha; dem.dcComb = cb.dc;
      R.cites.push(kind === 'nail'
        ? '§12.4.2 Eq. 12.4-2 (p.89/103): Z\'_α = (W\'p)Z\' / ((W\'p)cosα + Z\' sinα), p = length of fastener penetration into the main member'
        : '§12.4.1 Eq. 12.4-1 (p.89/103): Z\'_α = (W\'p)Z\' / ((W\'p)cos²α + Z\' sin²α), p = length of thread penetration into the main member');
    }
    dem.dc = Math.max(dem.dcV || 0, dem.dcT || 0, dem.dcComb || 0);
    if (!isFinite(dem.dc)) { R.flags.push('no_thread_in_main'); R.warnings.push('demand / capacity is not finite'); R.status = 'fail'; R.capacity = emptyCap(); R.demand = mkDemand(); return R; }
    // FD "Demand/Resistance %" forms (per fastener and per connection give the same ratio)
    dem.pctV = dem.dcV === null ? null : 100 * dem.dcV;
    dem.pctT = dem.dcT === null ? null : 100 * dem.dcT;
    dem.pctComb = dem.dcComb === null ? null : 100 * dem.dcComb;
    R.demand = dem;
    R.status = dem.dc > 1 + 1e-12 ? 'fail' : 'pass';
    return R;
  }

  // ── compute(state) ─────────────────────────────────────────────────────────
  function compute(state) {
    state = state || defaultState();
    var H = resolveHeader(state.header);
    var result = {
      engine: { name: ENGINE.name, version: ENGINE.version, rev: ENGINE.rev },
      header: {
        speciesKey: H.species, E_override: H.E_override, custom: clone(H.custom || {}), steelGrade: H.steelGrade, mcFab: H.mcFab, mcService: H.mcService, temp: H.temp,
        species: { key: H.speciesResolved.key, label: H.speciesResolved.label, G: H.speciesResolved.G, E: H.speciesResolved.E, hardwood: !!H.speciesResolved.hardwood, custom: !!H.speciesResolved.custom, esr: H.speciesResolved.esr || '' },
        steel: { grade: H.steel.grade, Fe: H.steel.Fe, E: H.steel.E, cite: H.steel.cite },
        Ct: H.Ct, errors: H.errors
      },
      tables: { bolts: [], nails: [], screws: [] },
      summary: { perTable: {}, total: null }
    };
    var kinds = { bolts: 'bolt', nails: 'nail', screws: 'screw' };
    var total = { worstDC: null, worstId: null, counts: { pass: 0, fail: 0, nodemand: 0, incomplete: 0, invalid: 0 }, unresolved: 0, rows: 0 };
    Object.keys(kinds).forEach(function (tk) {
      var arr = Array.isArray(state[tk]) ? state[tk] : [];
      var sum = { worstDC: null, worstId: null, counts: { pass: 0, fail: 0, nodemand: 0, incomplete: 0, invalid: 0 }, unresolved: 0, rows: arr.length };
      arr.forEach(function (row) {
        var r;
        try { r = computeRow(row || {}, kinds[tk], H); }
        catch (e) { r = { id: row && row.id, type: kinds[tk], status: 'invalid', flags: [], warnings: ['Invalid: engine error — ' + String(e && e.message || e)], notes: [], cites: [], unresolved: 0, inputs: {}, members: { main: null, side: null }, lengths: null, yield: null, factors: null, capacity: null, demand: null, spacingReq: null }; }
        if (H.errors.length && r.status !== 'invalid') { r.status = 'invalid'; H.errors.forEach(function (e) { r.warnings.push('Invalid: ' + e); }); }
        result.tables[tk].push(r);
        sum.counts[r.status] += 1; total.counts[r.status] += 1;
        if (r.unresolved > 0) { sum.unresolved += 1; total.unresolved += 1; }
        if (r.demand && isNum(r.demand.dc) && isFinite(r.demand.dc)) {
          if (sum.worstDC === null || r.demand.dc > sum.worstDC) { sum.worstDC = r.demand.dc; sum.worstId = r.id; }
          if (total.worstDC === null || r.demand.dc > total.worstDC) { total.worstDC = r.demand.dc; total.worstId = r.id; }
        }
      });
      result.summary.perTable[tk] = sum;
    });
    total.rows = result.tables.bolts.length + result.tables.nails.length + result.tables.screws.length;
    result.summary.total = total;
    return result;
  }

  /* ===========================================================================
     FIXTURES (spec §8). Every table fixture records table / cell / inputs /
     expected / tol (= half the unit of the cell's last printed digit) and is
     asserted on the unrounded result: |got − expected| ≤ tol + 1e-9.
     Every cell below was read from nds.txt (PDF page in the cell string).
     ========================================================================= */
  var FX;
  function fx(name, meta, got, expected, tol) {
    var ok = typeof expected === 'boolean' ? got === expected : near(got, expected, tol);
    FX.push({ name: name, table: meta.table || '', cell: meta.cell || '', inputs: meta.inputs || null, expected: expected, tol: tol === undefined ? null : tol, got: got, ok: !!ok });
    return ok;
  }
  function fxb(name, meta, cond, gotStr) { FX.push({ name: name, table: meta.table || '', cell: meta.cell || '', inputs: meta.inputs || null, expected: true, tol: null, got: gotStr === undefined ? !!cond : gotStr, ok: !!cond }); return !!cond; }
  function merge(target, o) { Object.keys(o || {}).forEach(function (k) { if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && target[k] && typeof target[k] === 'object') merge(target[k], o[k]); else target[k] = o[k]; }); return target; }
  function mkState(kind, rowOpts, hdr) {
    var st = defaultState(); merge(st.header, hdr || {});
    var row = newRow(kind, { id: 1, screwType: rowOpts && rowOpts.screwType });
    merge(row, rowOpts || {}); st[kind + 's'].push(row); return st;
  }
  function run(kind, rowOpts, hdr) { return compute(mkState(kind, rowOpts, hdr)).tables[kind + 's'][0]; }
  // Bolt with explicit thickness / θ / V; geometry at full-value defaults for the D.
  function boltRow(D, tm, ts, thm, ths, extra) {
    var gd = geomDefaults(D, 0, true), gd90 = geomDefaults(D, 90, true);
    var o = { D: D, V: 100, main: { t: tm, theta: thm, endDist: thm === 90 ? gd90.endDist : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist },
              side: { t: ts, theta: ths, endDist: ths === 90 ? gd90.endDist : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist }, s: gd.s, g: gd.g };
    return merge(o, extra || {});
  }
  function lagRow(D, L, ts, thm, ths, extra) {
    var gd = geomDefaults(D, 0, true), gd90 = geomDefaults(D, 90, true);
    var o = { screwType: 'lag', D: D, L: L, V: 50, T: 0, main: { t: 3.5, theta: thm, endDist: thm === 90 ? gd90.endDist : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist },
              side: { t: ts, theta: ths, endDist: ths === 90 ? gd90.endDist : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist }, s: gd.s, g: gd.g };
    return merge(o, extra || {});
  }

  function runFixtures() {
    FX = [];
    var DFL = { species: 'DFL' }, SPF = { species: 'SPF' }, r, m, i;

    // ── 1. Table 12A (PDF 108–109): bolts single shear, both members G 0.50 (DFL column) ───
    // Table 12A, block t_m = 1-1/2 / t_s = 1-1/2, D = 1/2, G = 0.50 columns: Z∥ 480, Z_s⊥ 300, Z_m⊥ 300, Z⊥ 220.
    // Hand: F_e∥ = 11200·0.5 = 5600; F_e⊥ = 6100·0.5^1.45/√0.5 = 3156 → 3150 (rounded to 50); F_yb 45,000;
    // R_e = 1, R_t = 1, k1 = 0.41421; R_d = 3.6 (II) → Z∥ = 0.41421·0.5·1.5·5600/3.6 = 483.25 (mode II) vs 480.
    // Z_s⊥: F_es = 3150, R_e = 1.7778, K_θ 1.25, k1 = 0.56829 → II = 0.56829·0.5·1.5·3150/4.5 = 298.35 vs 300.
    // Z⊥: both 3150, k1 = 0.41421, II = 0.41421·0.5·1.5·3150/4.5 = 217.46 vs 220.
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), DFL);
    m = { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z∥', inputs: r.inputs };
    fx('12A 1/2 bolt 1.5/1.5 Z∥ = 480', m, r.yield.Z, 480, 5);
    fx('12A 1/2 bolt F_e∥ = 5600 (Table 12.3.3 G 0.50 col F_e∥)', { table: 'Table 12.3.3 p.86/100', cell: 'G 0.50, F_e∥' }, r.inputs.Fem, 5600, 0);
    fx('12A 1/2 bolt R_d II = 3.6', m, r.yield.Rd.II, 3.6, 1e-9);
    fx('12A 1/2 bolt R_d I = 4, III = 3.2', m, r.yield.Rd.Im === 4 && r.yield.Rd.IV === 3.2, true);
    fx('12A 1/2 bolt k1 = 0.41421', m, r.yield.k1, 0.414214, 1e-5);
    fx('12A 1/2 bolt governing mode II', m, r.yield.governing === 'II', true);
    fx('12A 1/2 bolt status pass at V = 100, D/C = 100/483.25 = 0.2069', m, r.demand.dc, 100 / 483.2492, 1e-3);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 90), DFL);
    m = { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z_s⊥', inputs: r.inputs };
    fx('12A 1/2 bolt Z_s⊥ = 300 (side ⊥)', m, r.yield.Z, 300, 5);
    fx('12A 1/2 bolt F_es = F_e⊥(1/2) = 3150', { table: 'Table 12.3.3 p.86/100', cell: 'G 0.50, F_e⊥ D = 1/2' }, r.inputs.Fes, 3150, 0);
    fx('12A 1/2 bolt K_θ = 1.25 with one member at 90', m, r.yield.Ktheta, 1.25, 1e-9);
    fx('12A 1/2 bolt Z_s⊥ governing II', m, r.yield.governing === 'II', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 0), DFL);
    fx('12A 1/2 bolt Z_m⊥ = 300 (main ⊥)', { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z_m⊥' }, r.yield.Z, 300, 5);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 90), DFL);
    m = { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z⊥', inputs: r.inputs };
    fx('12A 1/2 bolt Z⊥ = 220', m, r.yield.Z, 220, 5);
    fx('12A 1/2 bolt Z⊥ governing II, R_d II = 4.5', m, r.yield.governing === 'II' && near(r.yield.Rd.II, 4.5, 1e-9), true);
    // 3/4 bolt, same block: 720 420 420 270 (G 0.50 columns).
    r = run('bolt', boltRow(0.75, 1.5, 1.5, 0, 0), DFL); fx('12A 3/4 bolt 1.5/1.5 Z∥ = 720', { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 3/4, G 0.50, Z∥' }, r.yield.Z, 720, 5);
    r = run('bolt', boltRow(0.75, 1.5, 1.5, 0, 90), DFL); fx('12A 3/4 bolt 1.5/1.5 Z_s⊥ = 420', { table: 'Table 12A p.94/108', cell: 'D 3/4, G 0.50, Z_s⊥' }, r.yield.Z, 420, 5);
    r = run('bolt', boltRow(0.75, 1.5, 1.5, 90, 90), DFL); fx('12A 3/4 bolt 1.5/1.5 Z⊥ = 270', { table: 'Table 12A p.94/108', cell: 'D 3/4, G 0.50, Z⊥' }, r.yield.Z, 270, 5);
    // 3/4 bolt, block t_m = 3-1/2 / t_s = 1-1/2 (4th block of PDF 108): 1200 590 610 510.
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 0, 0), DFL); fx('12A 3/4 bolt 3.5/1.5 Z∥ = 1200', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z∥' }, r.yield.Z, 1200, 5);
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 0, 90), DFL); fx('12A 3/4 bolt 3.5/1.5 Z_s⊥ = 590', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z_s⊥' }, r.yield.Z, 590, 5);
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 90, 0), DFL); fx('12A 3/4 bolt 3.5/1.5 Z_m⊥ = 610', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z_m⊥' }, r.yield.Z, 610, 5);
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 90, 90), DFL); fx('12A 3/4 bolt 3.5/1.5 Z⊥ = 510', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z⊥' }, r.yield.Z, 510, 5);
    // 1 in bolt: block 1.5/1.5: 970 530 530 310; block 3-1/2 / 3-1/2 (6th block): 2260 1230 1230 720.
    r = run('bolt', boltRow(1, 1.5, 1.5, 0, 0), DFL); fx('12A 1 in bolt 1.5/1.5 Z∥ = 970', { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1, G 0.50, Z∥' }, r.yield.Z, 970, 5);
    r = run('bolt', boltRow(1, 1.5, 1.5, 90, 90), DFL); fx('12A 1 in bolt 1.5/1.5 Z⊥ = 310', { table: 'Table 12A p.94/108', cell: 't_m 1-1/2, t_s 1-1/2, D 1, G 0.50, Z⊥' }, r.yield.Z, 310, 5);
    r = run('bolt', boltRow(1, 3.5, 3.5, 0, 0), DFL); fx('12A 1 in bolt 3.5/3.5 Z∥ = 2260', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 3-1/2, D 1, G 0.50, Z∥' }, r.yield.Z, 2260, 5);
    r = run('bolt', boltRow(1, 3.5, 3.5, 0, 90), DFL); fx('12A 1 in bolt 3.5/3.5 Z_s⊥ = 1230', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 3-1/2, D 1, G 0.50, Z_s⊥' }, r.yield.Z, 1230, 5);
    r = run('bolt', boltRow(1, 3.5, 3.5, 90, 90), DFL); fx('12A 1 in bolt 3.5/3.5 Z⊥ = 720', { table: 'Table 12A p.94/108', cell: 't_m 3-1/2, t_s 3-1/2, D 1, G 0.50, Z⊥' }, r.yield.Z, 720, 5);
    // G 0.42 column (SPF): block 1.5/1.5, 1/2 bolt: Z∥ 410, Z⊥ 170 (PDF 109, 2nd G column).
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), SPF); fx('12A 1/2 bolt 1.5/1.5 G 0.42 Z∥ = 410', { table: 'Table 12A p.95/109', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.42, Z∥' }, r.yield.Z, 410, 5);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 90), SPF); fx('12A 1/2 bolt 1.5/1.5 G 0.42 Z⊥ = 170', { table: 'Table 12A p.95/109', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.42, Z⊥' }, r.yield.Z, 170, 5);

    // ── 2. Tables 12B / 12F / 12G and a hand-computed steel main ──────────────
    var steelSide = function (D, tm, thm, extra) { var gd = geomDefaults(D, 0, true); return merge({ D: D, V: 100, main: { t: tm, theta: thm, endDist: thm === 90 ? 4 * D : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist }, side: { mat: 'steel', gauge: 'plate', t: 0.25, w: 3 }, s: gd.s, g: gd.g }, extra || {}); };
    r = run('bolt', steelSide(0.5, 1.5, 0), DFL);
    m = { table: 'Table 12B p.96/110', cell: 't_m 1-1/2, t_s 1/4 A36, D 1/2, G 0.50, Z∥', inputs: r.inputs };
    fx('12B 1/2 bolt t_m 1.5, A36 side: Z∥ = 580', m, r.yield.Z, 580, 5);
    fx('12B F_es = 87,000 (fn 2)', m, r.inputs.Fes, 87000, 0);
    fx('12B steel side: plate-bearing note + unresolved 1', m, r.unresolved === 1 && r.notes.some(function (x) { return x.indexOf('AISC') >= 0; }), true);
    r = run('bolt', steelSide(0.5, 1.5, 90), DFL); fx('12B 1/2 bolt t_m 1.5 Z⊥ = 310', { table: 'Table 12B p.96/110', cell: 't_m 1-1/2, D 1/2, G 0.50, Z⊥' }, r.yield.Z, 310, 5);
    r = run('bolt', steelSide(0.75, 1.5, 0), DFL); fx('12B 3/4 bolt t_m 1.5 Z∥ = 870', { table: 'Table 12B p.96/110', cell: 't_m 1-1/2, D 3/4, G 0.50, Z∥' }, r.yield.Z, 870, 5);
    r = run('bolt', steelSide(1, 3.5, 0), DFL); fx('12B 1 in bolt t_m 3.5 Z∥ = 2270', { table: 'Table 12B p.96/110', cell: 't_m 3-1/2, D 1, G 0.50, Z∥' }, r.yield.Z, 2270, 5);
    // 12F double shear, wood sides: block t_m 1-1/2 / t_s 1-1/2, D 1/2, G 0.50: Z∥ 1050, Z_s⊥ 730, Z_m⊥ 470.
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0, { shear: 'double' }), DFL);
    m = { table: 'Table 12F p.100/114', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z∥', inputs: r.inputs };
    fx('12F 1/2 bolt double shear Z∥ = 1050', m, r.yield.Z, 1050, 5);
    fx('12F double shear: modes II and III_m are null', m, r.yield.modes.II === null && r.yield.modes.IIIm === null, true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 90, { shear: 'double' }), DFL); fx('12F 1/2 bolt double Z_s⊥ = 730', { table: 'Table 12F p.100/114', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z_s⊥' }, r.yield.Z, 730, 5);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 0, { shear: 'double' }), DFL); fx('12F 1/2 bolt double Z_m⊥ = 470', { table: 'Table 12F p.100/114', cell: 't_m 1-1/2, t_s 1-1/2, D 1/2, G 0.50, Z_m⊥' }, r.yield.Z, 470, 5);
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 0, 0, { shear: 'double' }), DFL); fx('12F 3/4 bolt double 3.5/1.5 Z∥ = 2400', { table: 'Table 12F p.100/114', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z∥' }, r.yield.Z, 2400, 5);
    r = run('bolt', boltRow(0.75, 3.5, 1.5, 90, 0, { shear: 'double' }), DFL); fx('12F 3/4 bolt double 3.5/1.5 Z_m⊥ = 1370', { table: 'Table 12F p.100/114', cell: 't_m 3-1/2, t_s 1-1/2, D 3/4, G 0.50, Z_m⊥' }, r.yield.Z, 1370, 5);
    // 12G double shear, 1/4 A36 sides: t_m 1-1/2, D 1/2, G 0.50: 1050 / 470; t_m 3-1/2, D 3/4: 3340 / 1370.
    r = run('bolt', steelSide(0.5, 1.5, 0, { shear: 'double' }), DFL); fx('12G 1/2 bolt double, A36 sides, t_m 1.5 Z∥ = 1050', { table: 'Table 12G p.102/116', cell: 't_m 1-1/2, t_s 1/4, D 1/2, G 0.50, Z∥' }, r.yield.Z, 1050, 5);
    r = run('bolt', steelSide(0.5, 1.5, 90, { shear: 'double' }), DFL); fx('12G 1/2 bolt double t_m 1.5 Z⊥ = 470', { table: 'Table 12G p.102/116', cell: 't_m 1-1/2, D 1/2, G 0.50, Z⊥' }, r.yield.Z, 470, 5);
    r = run('bolt', steelSide(0.75, 3.5, 0, { shear: 'double' }), DFL); fx('12G 3/4 bolt double t_m 3.5 Z∥ = 3340', { table: 'Table 12G p.102/116', cell: 't_m 3-1/2, D 3/4, G 0.50, Z∥' }, r.yield.Z, 3340, 5);
    r = run('bolt', steelSide(0.75, 3.5, 90, { shear: 'double' }), DFL); fx('12G 3/4 bolt double t_m 3.5 Z⊥ = 1370', { table: 'Table 12G p.102/116', cell: 't_m 3-1/2, D 3/4, G 0.50, Z⊥' }, r.yield.Z, 1370, 5);
    // Steel MAIN, single shear (no NDS table). 1/2 bolt, A36 main plate t 1/4 (F_em 87,000), DFL side 1.5 ∥ (F_es 5600), F_yb 45,000.
    // Hand: R_e = 87000/5600 = 15.5357; R_t = 0.25/1.5 = 0.16667;
    // k1 = [√(R_e + 2R_e²(1+R_t+R_t²) + R_t²R_e³) − R_e(1+R_t)]/(1+R_e) = 0.49964;
    // I_m = 0.5·0.25·87000/4 = 2718.75; I_s = 0.5·1.5·5600/4 = 1050; II = 0.49964·0.5·1.5·5600/3.6 = 582.92;
    // k2 = −1 + √(2·16.5357 + 2·45000·32.0714·0.25/(3·87000·0.0625)) = 7.7925 → III_m = 7.7925·0.5·0.25·87000/(32.0714·3.2) = 825.73;
    // k3 = −1 + √(2·16.5357/15.5357 + 2·45000·17.5357·0.25/(3·87000·2.25)) = 0.67350 → III_s = 0.6735·0.5·1.5·87000/(17.5357·3.2) = 783.15;
    // IV = 0.25/3.2·√(2·87000·45000/(3·16.5357)) = 981.52.  Z = 582.92 (II).
    r = run('bolt', merge(boltRow(0.5, 0.25, 1.5, 0, 0), { mainSteel: true, main: { gauge: 'plate', t: 0.25, w: 3 } }), DFL);
    m = { table: 'hand (steel main, no NDS table)', cell: '1/2 bolt, A36 main t 1/4, DFL side 1.5 ∥', inputs: r.inputs };
    fx('steel main: R_e = 15.5357', m, r.yield.Re, 15.5357, 1e-3);
    fx('steel main: k1 = 0.49964', m, r.yield.k1, 0.49964, 1e-4);
    fx('steel main: I_m = 2718.75, I_s = 1050', m, near(r.yield.modes.Im, 2718.75, 1e-6) && near(r.yield.modes.Is, 1050, 1e-6), true);
    fx('steel main: II = 582.92 governs', m, r.yield.Z, 582.9175, 0.01);
    fx('steel main: III_m = 825.73, III_s = 783.15, IV = 981.52', m, near(r.yield.modes.IIIm, 825.7284, 0.01) && near(r.yield.modes.IIIs, 783.1494, 0.01) && near(r.yield.modes.IV, 981.5192, 0.01), true);
    fx('steel main: governing II, status pass', m, r.yield.governing === 'II' && r.status === 'pass', true);
    r = run('bolt', merge(boltRow(0.5, 0.25, 1.5, 0, 0), { mainSteel: true, main: { gauge: 'plate', t: 0.25 }, side: { mat: 'steel', gauge: 'plate', t: 0.25 } }), DFL);
    fx('steel main + steel side → invalid', m, r.status === 'invalid', true);

    // ── 3. Table 12J / 12K lag screws (p = 8D excluding the tip, t_m large) ───
    // 12J (PDF 120), t_s 1/2, D 1/4, G 0.50: Z∥ 120, Z_s⊥ 90, Z_m⊥ 90, Z⊥ 80.
    // Inputs: L = t_s + 8D + E = 0.5 + 2 + 5/32 = 2.65625 (T = min(6, L/2 + 1/2) = 1.828 per L2 fn 2; not needed for Z).
    // Hand: D_r = 0.173, K_D = 10·0.173 + 0.5 = 2.23 (D_r < 0.25), fn 1 → R_d = K_D·K_θ; F_e∥ 5600; F_yb 70,000;
    // p_tot = 2.15625, tip_in = 0.15625, l_m = 2.078125; R_t = 4.15625; k3 = 1.64441 → III_s = 1.64441·0.173·0.5·5600/(3·2.23) = 119.07;
    // IV = 0.173²/2.23·√(2·5600·70000/6) = 153.42; Z = 119.07 (III_s).  ⊥: F_e⊥(1/4) = 6100·0.5^1.45/√0.25 = 4464 → 4450;
    // R_d = 2.23·1.25 = 2.7875; k3 = 1.78682 → III_s = 82.25.
    r = run('screw', lagRow(0.25, 2.65625, 0.5, 0, 0), DFL);
    m = { table: 'Table 12J p.106/120', cell: 't_s 1/2, D 1/4, G 0.50, Z∥', inputs: r.inputs };
    fx('12J 1/4 lag t_s 1/2 Z∥ = 120', m, r.yield.Z, 120, 5);
    fx('12J 1/4 lag p_excl = 8D = 2.0', m, r.lengths.p_excl, 2.0, 1e-9);
    fx('12J 1/4 lag l_m = p_tot − tip_in/2 = 2.078125', m, r.lengths.l_m, 2.078125, 1e-9);
    fx('12J 1/4 lag D_yield = D_r = 0.173, K_D = 2.23', m, near(r.inputs.D_yield, 0.173, 1e-12) && near(r.yield.KD, 2.23, 1e-9), true);
    fx('12J 1/4 lag R_d = K_D·K_θ = 2.23 (fn 1, θ = 0)', m, r.yield.Rd.IIIs, 2.23, 1e-9);
    fx('12J 1/4 lag F_yb = 70,000 (fn 2)', m, r.inputs.Fyb, 70000, 0);
    fx('12J 1/4 lag F_e∥ = 5600 at nominal D', m, r.inputs.Fem, 5600, 0);
    fx('12J 1/4 lag k3 = 1.64441, governing III_s', m, near(r.yield.k3, 1.644409, 1e-5) && r.yield.governing === 'IIIs', true);
    r = run('screw', lagRow(0.25, 2.65625, 0.5, 90, 90), DFL);
    m = { table: 'Table 12J p.106/120', cell: 't_s 1/2, D 1/4, G 0.50, Z⊥', inputs: r.inputs };
    fx('12J 1/4 lag Z⊥ = 80', m, r.yield.Z, 80, 5);
    fx('12J 1/4 lag ⊥: F_e⊥ = 4450 at nominal D = 1/4 (Table 12.3.3 col D = 1/4)', { table: 'Table 12.3.3 p.86/100', cell: 'G 0.50, F_e⊥ D = 1/4' }, r.inputs.Fem, 4450, 0);
    fx('12J 1/4 lag ⊥: R_d = 2.23 × 1.25 = 2.7875', m, r.yield.Rd.IIIs, 2.7875, 1e-9);
    fx('12J 1/4 lag ⊥: governing III_s', m, r.yield.governing === 'IIIs', true);
    r = run('screw', lagRow(0.25, 2.65625, 0.5, 0, 90), DFL); fx('12J 1/4 lag Z_s⊥ = 90', { table: 'Table 12J p.106/120', cell: 't_s 1/2, D 1/4, G 0.50, Z_s⊥' }, r.yield.Z, 90, 5);
    // 3/8 lag, t_s 1/2, G 0.50: 150 100 110 90. L = 0.5 + 3 + 7/32 = 3.71875; D_r 0.265 ≥ 0.25 → 4/3.6/3.2·K_θ; F_yb 45,000.
    r = run('screw', lagRow(0.375, 3.71875, 0.5, 0, 0), DFL);
    m = { table: 'Table 12J p.106/120', cell: 't_s 1/2, D 3/8, G 0.50, Z∥', inputs: r.inputs };
    fx('12J 3/8 lag t_s 1/2 Z∥ = 150', m, r.yield.Z, 150, 5);
    fx('12J 3/8 lag: D_r 0.265 ≥ 0.25 → R_d 4 / 3.6 / 3.2', m, near(r.yield.Rd.Im, 4, 1e-9) && near(r.yield.Rd.II, 3.6, 1e-9) && near(r.yield.Rd.IV, 3.2, 1e-9), true);
    r = run('screw', lagRow(0.375, 3.71875, 0.5, 90, 90), DFL); fx('12J 3/8 lag t_s 1/2 Z⊥ = 90', { table: 'Table 12J p.106/120', cell: 't_s 1/2, D 3/8, G 0.50, Z⊥' }, r.yield.Z, 90, 5);
    // 1/2 lag, t_s 1-1/2, G 0.50: 390 220 270 200. L = 1.5 + 4 + 5/16 = 5.8125.
    r = run('screw', lagRow(0.5, 5.8125, 1.5, 0, 0), DFL); fx('12J 1/2 lag t_s 1-1/2 Z∥ = 390', { table: 'Table 12J p.106/120', cell: 't_s 1-1/2, D 1/2, G 0.50, Z∥' }, r.yield.Z, 390, 5);
    r = run('screw', lagRow(0.5, 5.8125, 1.5, 90, 0), DFL); fx('12J 1/2 lag t_s 1-1/2 Z_m⊥ = 270', { table: 'Table 12J p.106/120', cell: 't_s 1-1/2, D 1/2, G 0.50, Z_m⊥' }, r.yield.Z, 270, 5);
    // 12K (PDF 122): 1/4 A36 side, 1/2 lag, G 0.50: Z∥ 520, Z⊥ 320 (L = 0.25 + 4 + 5/16 = 4.5625);
    //                10 gage (0.134) A653 side, 3/8 lag, G 0.50: Z∥ 220, Z⊥ 140 (L = 0.134 + 3 + 7/32 = 3.35275).
    var lagSteel = function (D, L, gauge, thm) { var gd = geomDefaults(D, 0, true); return { screwType: 'lag', D: D, L: L, V: 50, T: 0, main: { t: 5.5, theta: thm, endDist: thm === 90 ? 4 * D : gd.endDist, edgeDist: gd.edgeDist, loadedEdgeDist: gd.loadedEdgeDist }, side: { mat: 'steel', gauge: gauge, t: 0.25, w: 3 }, s: gd.s, g: gd.g }; };
    r = run('screw', lagSteel(0.5, 4.5625, 'plate', 0), DFL); fx('12K 1/2 lag, 1/4 A36 side Z∥ = 520', { table: 'Table 12K p.108/122', cell: 't_s 1/4 A36, D 1/2, G 0.50, Z∥' }, r.yield.Z, 520, 5);
    r = run('screw', lagSteel(0.5, 4.5625, 'plate', 90), DFL); fx('12K 1/2 lag, 1/4 A36 side Z⊥ = 320', { table: 'Table 12K p.108/122', cell: 't_s 1/4 A36, D 1/2, G 0.50, Z⊥' }, r.yield.Z, 320, 5);
    r = run('screw', lagSteel(0.375, 3.35275, '10', 0), DFL);
    m = { table: 'Table 12K p.108/122', cell: 't_s 0.134 (10 ga), D 3/8, G 0.50, Z∥', inputs: r.inputs };
    fx('12K 3/8 lag, 10 ga A653 side Z∥ = 220', m, r.yield.Z, 220, 5);
    fx('12K 10 ga: t_s = 0.134, F_es = 61,850', m, near(r.lengths.l_s, 0.134, 1e-12) && r.inputs.Fes === 61850, true);
    r = run('screw', lagSteel(0.375, 3.35275, '10', 90), DFL); fx('12K 3/8 lag, 10 ga side Z⊥ = 140', { table: 'Table 12K p.108/122', cell: 't_s 0.134, D 3/8, G 0.50, Z⊥' }, r.yield.Z, 140, 5);

    // ── 4. Table 12L / 12M wood screws (p_tot = 10D including the tip, t_m 3.5) ──
    // 12L (PDF 123), t_s 1/2, G 0.50: No. 10 → 90 (L = 0.5 + 1.9 = 2.4); No. 8 → 73 (L = 2.14); No. 14 → 120 (L = 2.92).
    // Hand No. 10: D 0.190, D_r 0.152 → K_D 2.2; F_e = 16600·0.5^1.84 = 4635 → 4650; F_yb 80,000 (0.177 < D ≤ 0.236);
    // p_tot 1.9, tip_in 0.38, l_m 1.71; R_t 3.42; k3 = 1.67954 → III_s = 1.67954·0.152·0.5·4650/(3·2.2) = 89.93; IV = 116.94.
    var wsRow = function (no, L, ts, extra) { return merge({ screwType: 'wood', no: no, L: L, V: 20, T: 0, main: { t: 3.5, theta: 0 }, side: { t: ts, theta: 0 } }, extra || {}); };
    r = run('screw', wsRow(10, 2.4, 0.5), DFL);
    m = { table: 'Table 12L p.109/123', cell: 't_s 1/2, No. 10 (0.190), G 0.50', inputs: r.inputs };
    fx('12L No. 10 t_s 1/2 Z = 90', m, r.yield.Z, 90, 1);
    fx('12L No. 10: p_tot = 10D = 1.9, l_m = 1.71', m, near(r.lengths.p_tot, 1.9, 1e-9) && near(r.lengths.l_m, 1.71, 1e-9), true);
    fx('12L No. 10: F_e = 4650 (D < 1/4 column)', { table: 'Table 12.3.3 p.86/100', cell: 'G 0.50, F_e D < 1/4' }, r.inputs.Fem, 4650, 0);
    fx('12L No. 10: D_yield = D_r = 0.152, K_D = 2.2, F_yb 80,000', m, near(r.inputs.D_yield, 0.152, 1e-12) && near(r.yield.Rd.IV, 2.2, 1e-9) && r.inputs.Fyb === 80000, true);
    fx('12L No. 10: k3 = 1.67954, governing III_s', m, near(r.yield.k3, 1.679535, 1e-5) && r.yield.governing === 'IIIs', true);
    fx('12L No. 10: thread T = max(4D, 2L/3) = 1.6, p_t = threads ∩ main = 1.6', m, near(r.inputs.T_thread, 1.6, 1e-9) && near(r.lengths.p_t, 1.6, 1e-9), true);
    r = run('screw', wsRow(8, 2.14, 0.5), DFL); fx('12L No. 8 t_s 1/2 Z = 73', { table: 'Table 12L p.109/123', cell: 't_s 1/2, No. 8 (0.164), G 0.50' }, r.yield.Z, 73, 1);
    r = run('screw', wsRow(14, 2.92, 0.5), DFL); fx('12L No. 14 t_s 1/2 Z = 120', { table: 'Table 12L p.109/123', cell: 't_s 1/2, No. 14 (0.242), G 0.50' }, r.yield.Z, 120, 1);
    r = run('screw', wsRow(10, 3.4, 1.5), DFL); fx('12L No. 10 t_s 1-1/2 Z = 117', { table: 'Table 12L p.109/123', cell: 't_s 1-1/2, No. 10, G 0.50' }, r.yield.Z, 117, 1);
    r = run('screw', wsRow(12, 2.66, 0.5), SPF); fx('12L No. 12 t_s 1/2 G 0.42 Z = 91', { table: 'Table 12L p.109/123', cell: 't_s 1/2, No. 12 (0.216), G 0.42' }, r.yield.Z, 91, 1);
    // 12M (PDF 124): 16 gage (0.060) No. 10 G 0.50 → 116 (L = 0.06 + 1.9); 12 gage (0.105) No. 8 → 103 (L = 0.105 + 1.64).
    r = run('screw', wsRow(10, 1.96, 0.06, { side: { mat: 'steel', gauge: '16' } }), DFL); fx('12M No. 10, 16 ga side Z = 116', { table: 'Table 12M p.110/124', cell: 't_s 0.060 (16 ga), No. 10, G 0.50' }, r.yield.Z, 116, 1);
    r = run('screw', wsRow(8, 1.745, 0.105, { side: { mat: 'steel', gauge: '12' } }), DFL); fx('12M No. 8, 12 ga side Z = 103', { table: 'Table 12M p.110/124', cell: 't_s 0.105 (12 ga), No. 8, G 0.50' }, r.yield.Z, 103, 1);

    // ── 5. Table 12N / 12P nails (p = 10D assumed by the table; t_m 3.5 here) ──
    // 12N (PDF 125) G 0.50, t_s 3/4: 6d 72, 8d 90, 10d 105, 16d 121; t_s 1: 72, 97, 118, 141.
    // L from Table L4: 6d 2, 8d 2.5, 10d 3, 16d 3.5. p_tot = L − t_s: at t_s 3/4 → 1.25 / 1.75 / 2.25 / 2.75 (all ≥ 10D);
    // at t_s 1 → 1.0 / 1.5 / 2.0 / 2.5: 6d gives 1.0 < 10D = 1.13 (Table 12N fn 4 "(N)"), yet mode IV governs (no l_m term) so the cell
    // still reproduces (asserted below). Hand 16d t_s 3/4: D 0.162, F_e 4650, F_yb 90,000, K_D 2.2, l_m = 2.75 − 0.162 = 2.588,
    // k3 = −1 + √(4 + 2·90000·3·0.162²/(3·4650·0.5625)) = −1 + √(4 + 1.80604) = 1.40957 → III_s = 1.40957·0.162·0.75·4650/(3·2.2) = 120.66.
    var nailRow = function (penny, ts, extra) { return merge({ nailType: 'common', penny: penny, V: 20, T: 0, main: { t: 3.5, theta: 0 }, side: { t: ts, theta: 0 } }, extra || {}); };
    var cells34 = { '6d': 72, '8d': 90, '10d': 105, '16d': 121 }, cells1 = { '6d': 72, '8d': 97, '10d': 118, '16d': 141 };
    Object.keys(cells34).forEach(function (p) {
      r = run('nail', nailRow(p, 0.75), DFL);
      fx('12N ' + p + ' common t_s 3/4 Z = ' + cells34[p], { table: 'Table 12N p.111/125', cell: 't_s 3/4, common ' + p + ', G 0.50', inputs: r.inputs }, r.yield.Z, cells34[p], 1);
      fx('12N ' + p + ' t_s 3/4: p_tot ≥ 10D, governing III_s/IV', { table: 'Table 12N p.111/125', cell: p }, r.lengths.p_tot >= 10 * r.inputs.D - 1e-9 && (r.yield.governing === 'IIIs' || r.yield.governing === 'IV'), true);
    });
    Object.keys(cells1).forEach(function (p) {
      r = run('nail', nailRow(p, 1), DFL);
      fx('12N ' + p + ' common t_s 1 Z = ' + cells1[p], { table: 'Table 12N p.111/125', cell: 't_s 1, common ' + p + ', G 0.50', inputs: r.inputs }, r.yield.Z, cells1[p], 1);
      fx('12N ' + p + ' t_s 1: governing IV (l_m-independent; 6d has p_tot 1.0 < 10D per fn 4)', { table: 'Table 12N p.111/125', cell: p }, r.yield.governing === 'IV', true);
    });
    r = run('nail', nailRow('16d', 0.75), DFL);
    m = { table: 'Table 12N p.111/125', cell: 't_s 3/4, 16d common', inputs: r.inputs };
    fx('12N 16d: F_e 4650, F_yb 90,000, K_D 2.2 (D 0.162 ≤ 0.17), D_yield = D', m, r.inputs.Fem === 4650 && r.inputs.Fyb === 90000 && near(r.yield.Rd.IV, 2.2, 1e-9) && near(r.inputs.D_yield, 0.162, 1e-12), true);
    fx('12N 16d: k3 = 1.40957, l_m = 2.588', m, near(r.yield.k3, 1.409572, 1e-5) && near(r.lengths.l_m, 2.588, 1e-9), true);
    fx('12N 16d: nail p_t = p_tot = 2.75 (thread interval = full length)', m, r.lengths.p_t, 2.75, 1e-9);
    r = run('nail', nailRow('8d', 0.75, { nailType: 'box' }), DFL); fx('12N 8d box (0.113) t_s 3/4 Z = 72', { table: 'Table 12N p.111/125', cell: 't_s 3/4, box 8d (0.113), G 0.50' }, r.yield.Z, 72, 1);
    r = run('nail', nailRow('16d', 0.75, { nailType: 'box' }), DFL); fx('12N 16d box (0.135) t_s 3/4 Z = 94', { table: 'Table 12N p.111/125', cell: 't_s 3/4, box 16d (0.135), G 0.50' }, r.yield.Z, 94, 1);
    r = run('nail', nailRow('10d', 0.75, { nailType: 'sinker' }), DFL); fx('12N 10d sinker (0.120) t_s 3/4 Z = 80', { table: 'Table 12N p.111/125', cell: 't_s 3/4, sinker 10d (0.120), G 0.50' }, r.yield.Z, 80, 1);
    r = run('nail', nailRow('10d', 1, { nailType: 'sinker' }), DFL); fx('12N 10d sinker t_s 1 Z = 81', { table: 'Table 12N p.111/125', cell: 't_s 1, sinker 10d (0.120), G 0.50' }, r.yield.Z, 81, 1);
    r = run('nail', nailRow('16d', 1.5), SPF); fx('12N 16d common t_s 1-1/2 G 0.42 Z = 120', { table: 'Table 12N p.111/125', cell: 't_s 1-1/2, common 16d, G 0.42' }, r.yield.Z, 120, 1);
    // 12P (PDF 126–127): 16 gage (0.060) 16d common G 0.50 → 138; 10 gage (0.134) 8d common → 117.
    r = run('nail', nailRow('16d', 0.06, { side: { mat: 'steel', gauge: '16' } }), DFL); fx('12P 16d common, 16 ga side Z = 138', { table: 'Table 12P p.112/126', cell: 't_s 0.060 (16 ga), common 16d, G 0.50' }, r.yield.Z, 138, 1);
    r = run('nail', nailRow('8d', 0.134, { side: { mat: 'steel', gauge: '10' } }), DFL); fx('12P 8d common, 10 ga side Z = 117', { table: 'Table 12P p.113/127', cell: 't_s 0.134 (10 ga), common 8d, G 0.50' }, r.yield.Z, 117, 1);

    // ── 6. Withdrawal Tables 12.2A / B / C (lb/in), tol 0.5 ────────────────────
    r = run('screw', lagRow(0.25, 3, 1.5, 0, 0, { T: 10 }), DFL);
    fx('12.2A 1/4 lag G 0.50 W = 225', { table: 'Table 12.2A p.77/91', cell: 'G 0.50, D 1/4', inputs: r.inputs }, r.capacity.W, 225, 0.5);
    r = run('screw', lagRow(0.375, 4, 1.5, 0, 0, { T: 10 }), SPF);   // L 4 so p_excl = 2.28 ≥ 4D = 1.5 (L 3 would fail p_min)
    fx('12.2A 3/8 lag G 0.42 W = 235', { table: 'Table 12.2A p.77/91', cell: 'G 0.42, D 3/8', inputs: r.inputs }, r.capacity.W, 235, 0.5);
    r = run('screw', wsRow(10, 3, 1.5, { T: 10 }), DFL);
    fx('12.2B No. 10 G 0.50 W = 135', { table: 'Table 12.2B p.78/92', cell: 'G 0.50, No. 10', inputs: r.inputs }, r.capacity.W, 135, 0.5);
    r = run('screw', wsRow(8, 3, 1.5, { T: 10 }), SPF);
    fx('12.2B No. 8 G 0.42 W = 82', { table: 'Table 12.2B p.78/92', cell: 'G 0.42, No. 8', inputs: r.inputs }, r.capacity.W, 82, 0.5);
    r = run('nail', nailRow('8d', 1.5, { T: 10 }), DFL);
    fx('12.2C 0.131 (8d common) G 0.50 W = 32', { table: 'Table 12.2C p.79/93', cell: 'G 0.50, D 0.131', inputs: r.inputs }, r.capacity.W, 32, 0.5);
    r = run('nail', nailRow('16d', 1.5, { T: 10 }), SPF);
    fx('12.2C 0.162 (16d common) G 0.42 W = 26', { table: 'Table 12.2C p.79/93', cell: 'G 0.42, D 0.162', inputs: r.inputs }, r.capacity.W, 26, 0.5);
    fx('withdrawal: W\' = W (all factors 1.0), Wcap_withdrawal = W\'·p_t = 25.557·2.0 = 51.11', { table: 'Eq. 12.2-3', cell: '' }, r.capacity.Wcap_withdrawal, 1380 * Math.pow(0.42, 2.5) * 0.162 * 2.0, 1e-6);

    // ── 7. Head pull-through Table 12.2F (PDF 96), tol 0.5 ───────────────────
    // 690·π·0.234·0.5²·0.3125 = 39.63 → 40; t_ns 1 > 2.5·0.312 → 1725·π·0.312²·0.25 = 131.88 → 132; G 0.42 D_H 0.500 t_ns 1.5: 1725·π·0.25·0.1764 = 238.99 → 239.
    fx('12.2F G 0.50 D_H 0.234 t_ns 5/16 → 40 (Eq. 12.2-6a)', { table: 'Table 12.2F p.82/96', cell: 'G 0.50, D_H 0.234, t_ns 5/16' }, pullThrough(0.234, 0.5, 5 / 16).WH, 40, 0.5);
    fx('12.2F G 0.50 D_H 0.312 t_ns 1 → 132 (Eq. 12.2-6b)', { table: 'Table 12.2F p.82/96', cell: 'G 0.50, D_H 0.312, t_ns 1' }, pullThrough(0.312, 0.5, 1).WH, 132, 0.5);
    fx('12.2F G 0.42 D_H 0.500 t_ns 1-1/2 → 239 (Eq. 12.2-6b)', { table: 'Table 12.2F p.82/96', cell: 'G 0.42, D_H 0.500, t_ns 1-1/2' }, pullThrough(0.5, 0.42, 1.5).WH, 239, 0.5);
    r = run('nail', nailRow('10d', 1, { T: 10 }), DFL);   // 10d common D_H 0.312 (Table L4), t_ns = t_s = 1
    m = { table: 'Table 12.2F p.82/96', cell: 'G 0.50, D_H 0.312, t_ns 1 (10d common through a 1 in DFL side)', inputs: r.inputs };
    fx('12.2F via row: 10d common, t_s 1, W_H = 132', m, r.capacity.WH, 132, 0.5);
    fx('12.2F via row: W\'_H = W_H (dry, T100, C_D 1.0); Wcap = min(W\'p_t = 36·2.0 = 71.6, 131.9) → withdrawal governs', m, r.capacity.withdrawalGov === 'withdrawal' && near(r.capacity.Wcap, 1380 * Math.pow(0.5, 2.5) * 0.148 * 2.0, 1e-6), true);
    r = run('nail', nailRow('10d', 0.75, { T: 10 }), DFL);
    fx('12.2F via row: 10d common, t_s 3/4 (≤ 2.5·D_H) → Eq. 12.2-6a, W_H = 127', { table: 'Table 12.2F p.82/96', cell: 'G 0.50, D_H 0.312, t_ns 3/4' }, r.capacity.WH, 127, 0.5);
    // pull-through governs: 6d common (D_H 0.266) through a 5/16 side into 3.5 main, DFL: W_H = 690π·0.266·0.25·0.3125 = 45.04; W'p_t = 24.94·1.6875 = 42.1 → withdrawal still governs;
    // so use a wet in-service case? No — check pull-through governing with a long nail: 20d common (D_H 0.406, L 4) through t_s 5/16: W_H = 690π·0.406·0.25·0.3125 = 68.75; W'·p_t = 1380·0.17678·0.192·3.6875 = 172.7 → W_H governs.
    r = run('nail', nailRow('20d', 0.3125, { T: 10 }), DFL);
    fx('pull-through governs: 20d common through 5/16 side, W\'_H = 68.75 < W\'p_t = 172.7', { table: 'Eq. 12.2-6a', cell: '' }, r.capacity.withdrawalGov === 'pull-through' && near(r.capacity.Wcap, 690 * Math.PI * 0.406 * 0.25 * 0.3125, 1e-6), true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { T: 100 }), DFL);
    fx('lag with T > 0: no pull-through value, note + unresolved (hex head) and root-area note', { table: '§12.2.5 / §11.2.3', cell: '' }, r.capacity.WH === null && r.unresolved === 2 && r.notes.some(function (x) { return x.indexOf('pull-through') >= 0; }) && r.notes.some(function (x) { return x.indexOf('root-area') >= 0; }), true);
    r = run('nail', nailRow('16d', 0.06, { side: { mat: 'steel', gauge: '16' }, T: 10 }), DFL);
    fx('nail into steel side with T > 0: pull-through note + unresolved (plate note too → 2)', { table: '§12.2.5 / §11.1.1.3', cell: '' }, r.capacity.WH === null && r.unresolved === 2, true);
    r = run('nail', nailRow('16d', 1.5, { T: 0 }), DFL);
    fx('nail T = 0: pull-through still computed (D_H 0.344 Table L4), no unresolved', { table: '§12.2.5', cell: '' }, isNum(r.capacity.WH) && r.unresolved === 0, true);

    // ── 8. C_g Tables 11.3.6A / 11.3.6C (D 1, s 4, E 1.4M = SPF), tol 0.005 ────
    // 11.3.6A A_s/A_m = 1, A_s = 12, n = 4 → 0.96. Hand: γ = 180,000; EA = 1.68e7; u = 1 + 180000·2·(2/1.68e7) = 1.042857;
    // m = u − √(u²−1) = 0.746967; R_EA = 1; C_g = [m(1−m^8)/(4[(1+m^4)(1+m) − 1 + m^8])]·[2/(1−m)] = 0.96053.
    var cgRow = function (D, n, s, tm, wm, ts, ws, extra) { var gd = geomDefaults(D, 0, true); return merge({ D: D, V: 100, n: n, rows: 1, s: s, g: gd.g, main: { t: tm, w: wm, theta: 0, endDist: gd.endDist, edgeDist: gd.edgeDist }, side: { t: ts, w: ws, theta: 0, endDist: gd.endDist, edgeDist: gd.edgeDist } }, extra || {}); };
    r = run('bolt', cgRow(1, 4, 4, 1.5, 8, 1.5, 8), SPF);
    m = { table: 'Table 11.3.6A p.70/84', cell: 'A_s/A_m 1, A_s 12, n 4', inputs: r.inputs };
    fx('11.3.6A (1, 12, n 4) C_g = 0.96', m, r.factors.Cg.v, 0.96, 0.005);
    fx('11.3.6A: A_m = A_s = 12, E = 1.4e6, γ = 180,000, u = 1.042857, m = 0.746967', m, near(r.members.main.A, 12, 1e-9) && near(r.members.side.A, 12, 1e-9) && r.members.main.E === 1400000 && near(r.factors.Cg.detail.u, 1.042857, 1e-5) && near(r.factors.Cg.detail.m, 0.746967, 1e-5), true);
    r = run('bolt', cgRow(1, 8, 4, 1.5, 10 / 1.5, 1.5, 5 / 1.5), SPF); fx('11.3.6A (0.5, 5, n 8) C_g = 0.55', { table: 'Table 11.3.6A p.70/84', cell: 'A_s/A_m 0.5, A_s 5, n 8' }, r.factors.Cg.v, 0.55, 0.005);
    r = run('bolt', cgRow(1, 12, 4, 3.5, 64 / 3.5, 3.5, 64 / 3.5), SPF); fx('11.3.6A (1, 64, n 12) C_g = 0.88', { table: 'Table 11.3.6A p.70/84', cell: 'A_s/A_m 1, A_s 64, n 12' }, r.factors.Cg.v, 0.88, 0.005);
    r = run('bolt', cgRow(1, 1, 4, 1.5, 8, 1.5, 8), SPF); fx('n = 1 → C_g = 1.0 regardless of areas', { table: '§11.3.6.1', cell: '' }, r.factors.Cg.v, 1, 1e-12);
    // 11.3.6C A_m/A_s = 12, A_m = 5, n = 6 → 0.62 (E_steel 30e6, γ 270,000). A_s = 5/12 = 0.25 × 1.6667.
    // Hand: E_mA_m = 7e6, E_sA_s = 1.25e7, R_EA = 0.56; u = 1 + 270000·2·(1/7e6 + 1/1.25e7) = 1.120343; m = 0.615201; C_g = 0.62121.
    r = run('bolt', cgRow(1, 6, 4, 1.5, 5 / 1.5, 0.25, 5 / 12 / 0.25, { side: { mat: 'steel', gauge: 'plate' } }), SPF);
    m = { table: 'Table 11.3.6C p.71/85', cell: 'A_m/A_s 12, A_m 5, n 6', inputs: r.inputs };
    fx('11.3.6C (12, 5, n 6) C_g = 0.62', m, r.factors.Cg.v, 0.62, 0.005);
    fx('11.3.6C: E_s = 30e6, γ = 270,000·1^1.5, R_EA = 0.56, m = 0.615201', m, r.members.side.E === 30000000 && near(r.factors.Cg.detail.gamma, 270000, 1e-6) && near(r.factors.Cg.detail.REA, 0.56, 1e-9) && near(r.factors.Cg.detail.m, 0.615201, 1e-5), true);
    r = run('bolt', cgRow(1, 12, 4, 3.5, 40 / 3.5, 0.25, 0.8 / 0.25, { side: { mat: 'steel', gauge: 'plate' } }), SPF); fx('11.3.6C (50, 40, n 12) C_g = 0.51', { table: 'Table 11.3.6C p.71/85', cell: 'A_m/A_s 50, A_m 40, n 12' }, r.factors.Cg.v, 0.51, 0.005);
    // Hand ⊥-member areas (§11.3.6.3): 3/4 bolt, DFL (E 1.6e6), main t 3.5 loaded ⊥ with rows = 2, g = 3 → w_group = (2−1)·3 = 3, A_m = 10.5;
    // side 1.5 × 5.5 ∥ → A_s = 8.25; n = 3, s = 3; γ = 180000·0.75^1.5 = 116,913; E_mA_m = 1.68e7, E_sA_s = 1.32e7, R_EA = 0.785714;
    // u = 1 + 116913·1.5·(1/1.68e7 + 1/1.32e7) = 1.023724; m = 0.804609; C_g = 0.98431.
    // (The ⊥ member's across-grain spread is (n−1)·s = 6 in > 5, so shrinkDetail is set — §12.5.1.3 exception — to keep the row computable.)
    r = run('bolt', merge(boltRow(0.75, 3.5, 1.5, 90, 0), { n: 3, rows: 2, s: 3, g: 3, shrinkDetail: true, main: { w: 9.25, loadedEdgeDist: 3, edgeDist: 1.125, endDist: 3 }, side: { w: 5.5 } }), DFL);
    m = { table: 'hand (§11.3.6.3 ⊥ member, rows = 2)', cell: '3/4 bolt, main ⊥ t 3.5 rows 2 g 3, side ∥ 1.5×5.5, n 3 s 3', inputs: r.inputs };
    fx('⊥ main rows 2: A_m = t·(rows−1)·g = 10.5, A_s = 8.25', m, near(r.members.main.A, 10.5, 1e-9) && near(r.members.side.A, 8.25, 1e-9), true);
    fx('⊥ main rows 2: u = 1.023724, m = 0.804609, R_EA = 0.785714', m, near(r.factors.Cg.detail.u, 1.023724, 1e-5) && near(r.factors.Cg.detail.m, 0.804609, 1e-5) && near(r.factors.Cg.detail.REA, 0.785714, 1e-5), true);
    fx('⊥ main rows 2: C_g = 0.98431', m, r.factors.Cg.v, 0.984311, 1e-5);
    fx('⊥ main rows 2: row spacing g = 3 ≥ min (l/D = 2 → 2.5D = 1.875), spread 6 in noted (shrinkDetail), status pass', m, r.status === 'pass' && r.flags.length === 0 && near(r.factors.Cdelta.detail.members[0].spread, 6, 1e-9) && r.notes.some(function (x) { return x.indexOf('shrinkage') >= 0; }), true);
    // rows = 1 with D 1/2: w_group = 3D = 1.5 (§11.3.6.3 minimum ∥-to-grain spacing, Table 12.5.1B) → A_m = 3.5·1.5 = 5.25; side 8.25; n 2, s 2:
    // γ = 180000·0.5^1.5 = 63,640; E_mA_m = 8.4e6, E_sA_s = 1.32e7, R_EA = 0.636364; u = 1 + 63640·1·(1/8.4e6 + 1/1.32e7) = 1.012397; m = 0.854447; C_g = 0.99729.
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { n: 2, rows: 1, s: 2, main: { w: 9.25, loadedEdgeDist: 2, edgeDist: 0.75, endDist: 2 } }), DFL);
    m = { table: 'hand (§11.3.6.3 ⊥ member, rows = 1)', cell: '1/2 bolt, main ⊥ rows 1 → w_group = 3D = 1.5', inputs: r.inputs };
    fx('⊥ main rows 1: A_m = t·3D = 5.25', m, r.members.main.A, 5.25, 1e-9);
    fx('⊥ main rows 1: C_g = 0.99729 (u 1.012397, m 0.854447, R_EA 0.636364)', m, near(r.factors.Cg.v, 0.997286, 1e-5) && near(r.factors.Cg.detail.m, 0.854447, 1e-5) && near(r.factors.Cg.detail.REA, 0.636364, 1e-5), true);
    fx('⊥ main rows 1: wGroupMain 1.5 and the 3D cite recorded', m, near(r.factors.Cg.detail.wGroupMain, 1.5, 1e-12) && /3D/.test(r.factors.Cg.detail.wGroupCite), true);
    // (4) ∥ edge with l/D > 6 and a single row: no g/2 term — 1/2 bolt 3.5/3.5 (l/D 7), rows 1, edge 0.8 ≥ 1.5D = 0.75 → pass.
    r = run('bolt', merge(boltRow(0.5, 3.5, 3.5, 0, 0), { rows: 1, g: 2, main: { edgeDist: 0.8 }, side: { edgeDist: 0.8 } }), DFL);
    fx('∥ l/D = 7, rows 1: edge min 1.5D only (no g/2), 0.8 passes', { table: 'Table 12.5.1C', cell: '∥ l/D > 6, single row' }, r.status === 'pass' && near(r.factors.Cdelta.detail.members[0].edgeMin, 0.75, 1e-12), true);
    // (2) l/D for non-bolts uses p_tot (fn 1 "length of fastener in wood main member"): 1/2 lag L 4.5625 through 1/4 A36 → p_tot 4.3125 → l/D = 8.625 (l_m would give 8.3125).
    r = run('screw', lagSteel(0.5, 4.5625, 'plate', 0), DFL);
    fx('lag l/D = p_tot/D = 8.625 (steel side excluded)', { table: 'Table 12.5.1C/D fn 1', cell: '' }, r.lengths.lD, 8.625, 1e-9);
    r = run('screw', lagRow(0.5, 5.8125, 1.5, 0, 0), DFL);
    fx('lag with wood side: l/D = min(p_tot 4.3125, t_s 1.5)/D = 3', { table: 'Table 12.5.1C/D fn 1', cell: '' }, r.lengths.lD, 3, 1e-9);
    r = run('bolt', boltRow(0.5, 3.5, 1.5, 0, 0), DFL);
    fx('bolt l/D = min(t_m, t_s)/D = 3 (unchanged)', { table: 'Table 12.5.1C/D fn 1', cell: '' }, r.lengths.lD, 3, 1e-9);
    // (3) Table 12.2F range: t_ns outside 5/16–1-1/2 → warning, value still computed.
    r = run('nail', nailRow('10d', 0.25, { T: 5 }), DFL);
    fx('pull-through t_ns 1/4 < 5/16 → range warning, W_H still computed (Eq. 12.2-6a)', { table: '§12.2.5.1 / Table 12.2F', cell: 't_ns 1/4' }, isNum(r.capacity.WH) && r.warnings.some(function (x) { return x.indexOf('outside Table 12.2F range') >= 0; }), true);
    r = run('nail', nailRow('20d', 2.0, { T: 5 }), DFL);
    fx('pull-through t_ns 2 > 1-1/2 → range warning, W_H computed (Eq. 12.2-6b)', { table: '§12.2.5.1 / Table 12.2F', cell: 't_ns 2' }, isNum(r.capacity.WH) && r.warnings.some(function (x) { return x.indexOf('outside Table 12.2F range') >= 0; }), true);
    r = run('nail', nailRow('10d', 1, { T: 5 }), DFL);
    fx('pull-through t_ns 1 in range → no warning', { table: 'Table 12.2F', cell: 't_ns 1' }, !r.warnings.some(function (x) { return x.indexOf('12.2F') >= 0; }), true);

    // ── 9. Branch matrix ──────────────────────────────────────────────────────
    // I_m governs: 1/2 bolt DFL, t_m 0.5, t_s 1.5 ∥: I_m = 0.5·0.5·5600/4 = 350; II = k1(R_t 1/3 → 0.33333)·0.5·1.5·5600/3.6 = 388.9; III_m = 507.5.
    r = run('bolt', boltRow(0.5, 0.5, 1.5, 0, 0), DFL);
    m = { table: 'hand (mode I_m)', cell: '1/2 bolt t_m 0.5 t_s 1.5', inputs: r.inputs };
    fx('I_m governs: Z = 350', m, r.yield.Z, 350, 1e-6);
    fx('I_m governs: name, k1 = 1/3, II = 388.89', m, r.yield.governing === 'Im' && near(r.yield.k1, 1 / 3, 1e-9) && near(r.yield.modes.II, 388.8889, 1e-3), true);
    // III_m governs: 1/2 bolt DFL, t_m 1.0, t_s 3.5 ∥: I_m = 700; k2 = −1 + √(4 + 2·45000·3·0.25/(3·5600·1)) = −1 + √8.017857 = 1.83158
    // → III_m = 1.83158·0.5·1.0·5600/(3·3.2) = 534.21; k1(R_t 0.2857) = 0.33391 → II = 0.33391·0.5·3.5·5600/3.6 = 909.0; IV = 716.0 → Z = 534.21 (III_m).
    r = run('bolt', boltRow(0.5, 1.0, 3.5, 0, 0), DFL);
    m = { table: 'hand (mode III_m)', cell: '1/2 bolt t_m 1.0 t_s 3.5', inputs: r.inputs };
    fx('III_m governs: Z = 534.21', m, r.yield.Z, 534.2114, 0.001);
    fx('III_m governs: name, k2 = 1.83158, I_m = 700', m, r.yield.governing === 'IIIm' && near(r.yield.k2, 1.831582, 1e-5) && near(r.yield.modes.Im, 700, 1e-9), true);
    // D_r = 0.17 boundary (K_D on the yield diameter): 0.17 → 2.2; just above → 10D + 0.5; No. 12 wood screw D_r 0.171 → 2.21; No. 10 D_r 0.152 → 2.2; lag 1/4 D_r 0.173 → 2.23.
    fx('K_D(0.17) = 2.2', { table: 'Table 12.3.1B p.84/98', cell: 'K_D D ≤ 0.17' }, KD(0.17), 2.2, 1e-12);
    fx('K_D(0.1701) = 2.201', { table: 'Table 12.3.1B p.84/98', cell: 'K_D 0.17 < D < 0.25' }, KD(0.1701), 2.201, 1e-9);
    fx('K_D(0.2499) = 2.999', { table: 'Table 12.3.1B p.84/98', cell: 'K_D 0.17 < D < 0.25' }, KD(0.2499), 2.999, 1e-9);
    r = run('screw', wsRow(12, 3, 1.5), DFL); fx('No. 12 wood screw: D_r 0.171 → K_D = 2.21, F_yb 80,000 by nominal D 0.216', { table: 'Table 12.3.1B / I1', cell: '' }, near(r.yield.KD, 2.21, 1e-9) && r.inputs.Fyb === 80000, true);
    r = run('screw', wsRow(10, 3, 1.5), DFL); fx('No. 10 wood screw: D_r 0.152 → K_D = 2.2', { table: 'Table 12.3.1B', cell: '' }, r.yield.KD, 2.2, 1e-12);
    // nominal 0.25 with D_r < 0.25 (fn 1): 1/4 lag ⊥ → R_d = K_D·K_θ = 2.23·1.25; 5/16 lag D_r 0.227 → K_D 2.77; 3/8 lag D_r 0.265 → 4/3.6/3.2.
    r = run('screw', lagRow(0.3125, 4, 1.5, 90, 90), DFL); fx('5/16 lag ⊥: fn 1 R_d = (10·0.227 + 0.5)·1.25 = 3.4625 all modes', { table: 'Table 12.3.1B fn 1', cell: '' }, near(r.yield.Rd.Im, 3.4625, 1e-9) && near(r.yield.Rd.II, 3.4625, 1e-9) && near(r.yield.Rd.IV, 3.4625, 1e-9), true);
    r = run('screw', lagRow(0.25, 4, 1.5, 0, 0), DFL); fx('1/4 lag: geometry active (nominal D ≥ 0.25) although D_r < 0.25', { table: '§12.5.1.1', cell: '' }, r.inputs.geomActive === true && r.factors.Cdelta.detail !== null, true);
    r = run('screw', wsRow(14, 3, 1.5), DFL); fx('No. 14 wood screw (0.242): geometry and C_g inactive (D < 0.25)', { table: '§12.5.1.1 / §11.3.6.1', cell: '' }, r.inputs.geomActive === false && r.factors.Cg.v === 1 && r.factors.Cdelta.v === 1, true);
    // p_min: lag 1/2 (4D = 2 excl. tip): L = t_s 1.5 + 2 + 5/16 = 3.8125 → p_excl = 2.0 exactly → not fail; L = 3.8025 → fail.
    r = run('screw', lagRow(0.5, 3.8125, 1.5, 0, 0), DFL); fx('lag p_excl = 4D exactly → not fail', { table: '§12.1.4.6', cell: '', inputs: r.inputs }, r.flags.indexOf('p_min') < 0 && near(r.lengths.p_excl, 2.0, 1e-9), true);
    r = run('screw', lagRow(0.5, 3.8025, 1.5, 0, 0), DFL); fx('lag p_excl = 4D − 0.01 → fail p_min, capacities null', { table: '§12.1.4.6', cell: '', inputs: r.inputs }, r.status === 'fail' && r.flags.indexOf('p_min') >= 0 && r.capacity.Zp === null, true);
    // wood screw No. 10 (6D = 1.14): L = 1.5 + 1.14 = 2.64 → p_tot 1.14 → ok; 2.63 → fail.
    r = run('screw', wsRow(10, 2.64, 1.5), DFL); fx('wood screw p_tot = 6D exactly → not fail', { table: '§12.1.5.6', cell: '' }, r.flags.length === 0 && near(r.lengths.p_tot, 1.14, 1e-9), true);
    r = run('screw', wsRow(10, 2.63, 1.5), DFL); fx('wood screw p_tot = 6D − 0.01 → fail p_min', { table: '§12.1.5.6', cell: '' }, r.status === 'fail' && r.flags[0] === 'p_min', true);
    // Codex lag 1/4 × 6 (T 3.5), t_s = t_m = 1.5: threads [2.5, 5.84375] ∩ main [1.5, 3.0] → p_t = 0.5; p_tot = 1.5, tip outside → tip_in 0, p_excl 1.5 ≥ 4D = 1.0; exits_main warning.
    r = run('screw', lagRow(0.25, 6, 1.5, 0, 0, { main: { t: 1.5 }, T: 10 }), DFL);
    m = { table: 'spec §5.3 (Codex case)', cell: '1/4 × 6 lag, t_s = t_m = 1.5', inputs: r.inputs };
    fx('Codex lag: p_t = 0.5 (threads ∩ main)', m, r.lengths.p_t, 0.5, 1e-9);
    fx('Codex lag: p_tot 1.5, tip_in 0, p_excl 1.5, l_m 1.5, exits_main warning, T 3.5 from Table L2', m, near(r.lengths.p_tot, 1.5, 1e-9) && r.lengths.tip_in === 0 && near(r.lengths.p_excl, 1.5, 1e-9) && near(r.lengths.l_m, 1.5, 1e-9) && r.lengths.exits_main === true && r.inputs.T_thread === 3.5 && r.warnings.some(function (x) { return x.indexOf('exits') >= 0; }), true);
    fx('Codex lag: Wcap = W\'·p_t = 225·0.5 = 112.5 lb', m, r.capacity.Wcap, 112.5, 1e-6);
    // threads never reach the main: 1/2 × 12 lag (T 6 → threads [6, 11.6875]), t_s 4, t_m 2 → main [4, 6] → p_t = 0; with T > 0 → fatal no_thread_in_main.
    r = run('screw', lagRow(0.5, 12, 4, 0, 0, { main: { t: 2 }, T: 100 }), DFL);
    m = { table: 'review (1)', cell: '1/2 × 12 lag, t_s 4, t_m 2, T 100', inputs: r.inputs };
    fx('no thread in main with T > 0: fail, flag no_thread_in_main, p_t 0, capacities null, yield null, dc null', m, r.status === 'fail' && r.flags.indexOf('no_thread_in_main') >= 0 && r.lengths.p_t === 0 && r.capacity.Wcap === null && r.capacity.Zp === null && r.yield === null && r.demand.dc === null && r.warnings.some(function (x) { return x.indexOf('p_t = 0') >= 0; }), true);
    r = run('screw', lagRow(0.5, 12, 4, 0, 0, { main: { t: 2 }, T: 0, V: 100 }), DFL);
    fx('same with T = 0: no flag, lateral computes (p_excl 2 ≥ 4D), pass on V', m, r.status === 'pass' && r.flags.length === 0 && r.lengths.p_t === 0 && isNum(r.demand.dc), true);
    (function () { var s3 = defaultState(); s3.screws.push(merge(newRow('screw', { id: 1, screwType: 'lag' }), lagRow(0.5, 12, 4, 0, 0, { main: { t: 2 }, T: 100 }))); s3.screws.push(merge(newRow('screw', { id: 2, screwType: 'lag' }), lagRow(0.5, 4, 1.5, 0, 0, { main: { t: 3.5 }, T: 10, V: 100 }))); var o = compute(s3);
      fxb('summary worstDC stays finite with a no_thread_in_main row present (worst = row 2)', { table: 'review (1)' }, isFinite(o.summary.perTable.screws.worstDC) && o.summary.perTable.screws.worstId === 2 && isFinite(o.summary.total.worstDC), JSON.stringify(o.summary.perTable.screws)); })();
    // nail T_thread is null (no thread-length concept; p_t = full penetration)
    r = run('nail', nailRow('16d', 1.5), DFL); fxb('nail inputs.T_thread is null', { table: 'review (4)' }, r.inputs.T_thread === null && near(r.lengths.p_t, 2.0, 1e-9), String(r.inputs.T_thread));
    // p_min-flagged row carries no yield block (l_m may be 0)
    r = run('screw', lagRow(0.5, 3.8025, 1.5, 0, 0), DFL); fxb('p_min row: yield null, factors present, capacities null', { table: 'review (3)' }, r.yield === null && r.factors !== null && r.capacity.Zp === null, String(r.yield));
    r = run('nail', nailRow('16d', 3.5, { main: { t: 1.5 } }), DFL); fxb('nail fully inside the side member (L = t_s): p_tot 0, l_m 0 → p_min fail, yield null, no NaN', { table: 'review (3)' }, r.status === 'fail' && r.flags.indexOf('p_min') >= 0 && r.lengths.l_m === 0 && r.yield === null, JSON.stringify(r.lengths));
    // C_g guard: s = 0 with n 2 → Eq. 11.3-1 undefined (m = 1) → Cg null with reason; row fails geom_spacing anyway.
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 2, s: 0 }), DFL);
    fxb('C_g with s = 0: v null, cite gives the reason (not the D < 1/4 text), geom_spacing fail', { table: 'review (2)' }, r.status === 'fail' && r.flags.indexOf('geom_spacing') >= 0 && r.factors.Cg.v === null && /undefined/.test(r.factors.Cg.cite) && r.factors.Cg.cite.indexOf('1/4') < 0, r.factors.Cg.cite);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { n: 2, rows: 2, g: 0, main: { w: 9.25 } }), DFL);
    fxb('C_g with g = 0, rows 2, θ 90 (A_m = 0): v null with reason, geom_row fail, Z\' null', { table: 'review (2)' }, r.status === 'fail' && r.flags.indexOf('geom_row') >= 0 && r.factors.Cg.v === null && /undefined/.test(r.factors.Cg.cite) && r.capacity.Zp === null, r.factors.Cg.cite);
    // nail 16d through 1.5 side into 0.75 main → p_tot 0.75 < 6D = 0.972 → fail p_min.
    r = run('nail', nailRow('16d', 1.5, { main: { t: 0.75 } }), DFL);
    fx('16d through 1.5 into 0.75 main: p_tot 0.75 < 6D → fail p_min', { table: '§12.1.6.4', cell: '', inputs: r.inputs }, r.status === 'fail' && r.flags.indexOf('p_min') >= 0 && near(r.lengths.p_tot, 0.75, 1e-9) && r.lengths.exits_main === true, true);
    // wood screw tip partly outside the main: No. 10 L 3 through t_s 1.5 into t_m 1.4 → p_tot 1.4, tip [2.62, 3] ∩ [1.5, 2.9] = 0.28, l_m = 1.4 − 0.14 = 1.26; p_t = [1, 3] ∩ main = 1.4.
    r = run('screw', wsRow(10, 3, 1.5, { main: { t: 1.4 } }), DFL);
    fx('wood screw tip partly outside main: tip_in 0.28, l_m 1.26, p_t 1.4 (tip kept, §12.2.2.2)', { table: '§12.3.5.3 / §12.2.2.2', cell: '' }, near(r.lengths.tip_in, 0.28, 1e-9) && near(r.lengths.l_m, 1.26, 1e-9) && near(r.lengths.p_t, 1.4, 1e-9), true);
    // spacing s: 1/2 bolt, n = 2: 3D − ε fail; 3D → C_Δ 0.75; 4D → 1; 8D → 1 (cap).
    var sp = function (s) { return run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 2, s: s, main: { w: 5.5 }, side: { w: 5.5 } }), DFL); };
    r = sp(1.49); fx('s = 3D − 0.01 → fail geom_spacing', { table: 'Table 12.5.1B', cell: 'min 3D' }, r.status === 'fail' && r.flags.indexOf('geom_spacing') >= 0, true);
    r = sp(1.5); fx('s = 3D → C_Δ = 0.75', { table: '§12.5.1.2(c)', cell: '3D / 4D' }, r.factors.Cdelta.v, 0.75, 1e-12);
    r = sp(2.0); fx('s = 4D → C_Δ = 1.0', { table: '§12.5.1.2(c)', cell: '' }, r.factors.Cdelta.v, 1, 1e-12);
    r = sp(4.0); fx('s = 8D → C_Δ = 1.0 (capped)', { table: '§12.5.1.2', cell: '' }, r.factors.Cdelta.v, 1, 1e-12);
    fx('s = 8D: Z\' = Z·C_g (n 2) with C_Δ 1', { table: 'Table 11.3.1', cell: '' }, r.capacity.Zp, r.yield.Z * r.factors.Cg.v, 1e-9);
    // end distance (∥ tension, softwood 7D full / 3.5D half): 1/2 bolt, main endDist 1.75 → 0.5; 1.74 → fail; away from end (4D/2D): 1.0 → 0.5.
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.75 } }), DFL); fx('end = 3.5D (half) → C_Δ = 0.5', { table: 'Table 12.5.1A', cell: '∥ tension softwood 3.5D / 7D' }, r.factors.Cdelta.v, 0.5, 1e-12);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.74 } }), DFL); fx('end = 3.5D − 0.01 → fail geom_end', { table: 'Table 12.5.1A', cell: '' }, r.status === 'fail' && r.flags.indexOf('geom_end') >= 0, true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 2.625 } }), DFL); fx('end = 5.25D → C_Δ = 0.75', { table: '§12.5.1.2(a)', cell: '' }, r.factors.Cdelta.v, 0.75, 1e-12);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { towardEnd: false, endDist: 1.0 } }), DFL); fx('bearing away from end: 2D / 4D → end 2D gives C_Δ 0.5', { table: 'Table 12.5.1A', cell: '∥ compression 2D / 4D' }, r.factors.Cdelta.v, 0.5, 1e-12);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.75 }, n: 2, s: 1.5 }), DFL); fx('C_Δ = min over end (0.5) and spacing (0.75) = 0.5', { table: '§12.5.1.2', cell: '' }, r.factors.Cdelta.v, 0.5, 1e-12);
    // hardwood (custom) ∥ tension: 5D full / 2.5D half. 1/2 bolt custom hardwood: end 1.25 → 0.5.
    var HW = { species: 'CUSTOM', custom: { name: 'Red Oak (test)', G: 0.67, E: 1800000, Fe_small: 7950, Fe_par: 7500, Fe_perp: 4850, hardwood: true, esr: 'test' } };
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.25 }, side: { endDist: 1.25 } }), HW);
    fx('custom hardwood: end 2.5D → C_Δ 0.5, F_e∥ typed 7500', { table: 'Table 12.5.1A hardwoods', cell: '' }, near(r.factors.Cdelta.v, 0.5, 1e-12) && r.inputs.Fem === 7500 && r.notes.some(function (x) { return x.indexOf('SCL') >= 0; }), true);
    // edge distance hard minimum: 1/2 bolt edgeDist 0.74 → fail geom_edge; ⊥ member loaded edge 1.99 → fail.
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { edgeDist: 0.74 } }), DFL); fx('edge 1.5D − 0.01 → fail geom_edge', { table: 'Table 12.5.1C', cell: '∥ l/D ≤ 6 → 1.5D' }, r.status === 'fail' && r.flags.indexOf('geom_edge') >= 0, true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 90, 0), { main: { loadedEdgeDist: 1.99 } }), DFL); fx('⊥ loaded edge 4D − 0.01 → fail geom_edge', { table: 'Table 12.5.1C', cell: '⊥ loaded edge 4D' }, r.status === 'fail' && r.flags.indexOf('geom_edge') >= 0, true);
    // ∥ edge with l/D > 6: 1/2 bolt t_m 3.5 t_s 3.5 (l/D = 7): rows 2, g = 2 → edge min = max(0.75, 1.0) = 1.0; edge 0.9 → fail; 1.0 → ok.
    r = run('bolt', merge(boltRow(0.5, 3.5, 3.5, 0, 0), { rows: 2, g: 2, main: { edgeDist: 0.9 }, side: { edgeDist: 0.9 } }), DFL); fx('∥ l/D = 7 > 6, g 2: edge min = g/2 = 1.0 → 0.9 fails', { table: 'Table 12.5.1C', cell: '∥ l/D > 6' }, r.status === 'fail' && r.flags.indexOf('geom_edge') >= 0 && near(r.lengths.lD, 7, 1e-9), true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 3.5, 0, 0), { rows: 2, g: 2, main: { edgeDist: 1.0 }, side: { edgeDist: 1.0 } }), DFL); fx('∥ l/D = 7, edge 1.0 → pass', { table: 'Table 12.5.1C', cell: '' }, r.status === 'pass', true);
    // row spacing ⊥: 1/2 bolt main ⊥ t_m 3.5, t_s 1.5 → l/D = 3 → (5·1.5 + 5)/8 = 1.5625; g 1.5 → fail; 1.5625 → ok. ∥ rows: 1.5D = 0.75.
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { rows: 2, g: 1.5, main: { w: 9.25 } }), DFL); fx('⊥ row spacing l/D 3 → (5l + 10D)/8 = 1.5625; g 1.5 fails', { table: 'Table 12.5.1D', cell: '2 < l/D < 6' }, r.status === 'fail' && r.flags.indexOf('geom_row') >= 0, true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { rows: 2, g: 1.5625, main: { w: 9.25 } }), DFL); fx('⊥ row spacing g 1.5625 → pass', { table: 'Table 12.5.1D', cell: '' }, r.status === 'pass', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { rows: 2, g: 0.74 }), DFL); fx('∥ row spacing 1.5D − 0.01 → fail geom_row', { table: 'Table 12.5.1D', cell: '∥ 1.5D' }, r.status === 'fail' && r.flags.indexOf('geom_row') >= 0, true);
    // C_M matrix × (D < 1/4, ≥ 1/4) × (lateral, withdrawal nail, withdrawal lag, pull-through)
    var cmCase = function (fab, svc, cmEx) {
      var hdr = { species: 'DFL', mcFab: fab, mcService: svc };
      var b = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { cmException: !!cmEx }), hdr);
      var nl = run('nail', nailRow('16d', 1.5, { T: 10, cmException: !!cmEx }), hdr);
      var lg = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { T: 10 }), hdr);
      return { bolt: b.factors.CM.v, nailL: nl.factors.CM.v, nailW: nl.factors.CMw.v, lagW: lg.factors.CMw.v, nailH: nl.factors.CMH.v, lagL: lg.factors.CM.v };
    };
    var c = cmCase('dry', 'dry');  fx('C_M dry/dry: all 1.0', { table: 'Table 11.3.3', cell: '≤19 / ≤19' }, c.bolt === 1 && c.nailL === 1 && c.nailW === 1 && c.lagW === 1 && c.nailH === 1 && c.lagL === 1, true, c);
    c = cmCase('wet', 'dry');      fx('C_M wet/dry: bolt 0.4, nail lateral 0.7 (fn 2 D < 1/4), lag lateral 0.4, nail W 0.25, lag W 1.0, pull-through 1.0', { table: 'Table 11.3.3', cell: '>19 / ≤19' }, c.bolt === 0.4 && c.nailL === 0.7 && c.lagL === 0.4 && c.nailW === 0.25 && c.lagW === 1 && c.nailH === 1, true, JSON.stringify(c));
    c = cmCase('wet', 'dry', true); fx('C_M wet/dry with fn 2 exception: bolt 1.0; nail (D < 1/4) ignores cmException → 0.7', { table: 'Table 11.3.3 fn 2', cell: 'exception' }, c.bolt === 1 && c.nailL === 0.7, true, JSON.stringify(c));
    r = run('screw', wsRow(14, 3, 1.5, { cmException: true }), { species: 'DFL', mcFab: 'wet', mcService: 'dry' }); fx('No. 14 wood screw (0.242 < 1/4) with cmException true → C_M 0.7, inputs.cmException false', { table: 'Table 11.3.3 fn 2', cell: 'D < 1/4' }, r.factors.CM.v === 0.7 && r.inputs.cmException === false, true);
    r = run('screw', lagRow(0.25, 4, 1.5, 0, 0, { cmException: true }), { species: 'DFL', mcFab: 'wet', mcService: 'dry' }); fx('1/4 lag (nominal 0.25) with cmException → C_M 1.0', { table: 'Table 11.3.3 fn 2', cell: 'D ≥ 1/4' }, r.factors.CM.v, 1, 1e-12);
    c = cmCase('dry', 'wet');      fx('C_M dry/wet: lateral 0.7 all, nail W 0.25, lag W 0.7, pull-through 0.7', { table: 'Table 11.3.3', cell: 'any / >19' }, c.bolt === 0.7 && c.nailL === 0.7 && c.lagL === 0.7 && c.nailW === 0.25 && c.lagW === 0.7 && c.nailH === 0.7, true, JSON.stringify(c));
    c = cmCase('wet', 'wet');      fx('C_M wet/wet: lateral 0.7, nail W 1.0, lag W 0.7, pull-through 0.7', { table: 'Table 11.3.3', cell: '>19 / >19' }, c.bolt === 0.7 && c.nailL === 0.7 && c.nailW === 1 && c.lagW === 0.7 && c.nailH === 0.7, true, JSON.stringify(c));
    r = run('nail', nailRow('16d', 1.5, { T: 10, toeNail: true }), { species: 'DFL', mcFab: 'wet', mcService: 'dry' });
    fx('toe-nail withdrawal: C_M,w = 1.0 even at wet/dry (§12.5.4.1)', { table: '§12.5.4.1', cell: '' }, r.factors.CMw.v, 1, 1e-12);
    // C_t
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'DFL', temp: 'T125' }); fx('C_t T125 dry = 0.8', { table: 'Table 11.3.4', cell: '100 < T ≤ 125, dry' }, r.factors.Ct.v, 0.8, 1e-12);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'DFL', temp: 'T150', mcService: 'wet' }); fx('C_t T150 wet = 0.5, C_M 0.7 → Z\' = Z·0.35', { table: 'Table 11.3.4', cell: '125 < T ≤ 150, wet' }, near(r.factors.Ct.v, 0.5, 1e-12) && near(r.capacity.Zp, r.yield.Z * 0.35, 1e-9), true);
    // C_D
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { loadCase: 'WE' }), DFL); fx('C_D WE = 1.6, Z\' = 1.6·Z', { table: 'Table 2.3.2', cell: 'ten minutes' }, r.capacity.Zp, r.yield.Z * 1.6, 1e-9);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { loadCase: 'S' }), DFL); fx('C_D S = 1.15', { table: 'Table 2.3.2', cell: 'two months' }, r.factors.CD.v, 1.15, 1e-12);
    // toe-nails: 16d 2x → 2x (l_s 1.1667, l_m 1.5 capped, p_t 1.7321 capped); 8d common L 2.5 into t_m 3.5 (l_m 1.3317, p_t 1.5377, no cap).
    r = run('nail', nailRow('16d', 1.5, { toeNail: true, T: 10, main: { t: 1.5 } }), DFL);
    m = { table: 'spec §5.3 toe-nail (§12.3.10.2, C12.5.4)', cell: '16d common 2x → 2x', inputs: r.inputs };
    fx('toe-nail 16d: l_s = L/3 = 1.16667', m, r.lengths.l_s, 3.5 / 3, 1e-9);
    fx('toe-nail 16d: l_m = min(1.8644, t_m 1.5) = 1.5', m, r.lengths.l_m, 1.5, 1e-9);
    fx('toe-nail 16d: p_t = min(2.1528, 1.5/cos30 = 1.7321) = 1.7321', m, r.lengths.p_t, 1.732051, 1e-6);
    fx('toe-nail 16d: C_tn 0.83 on Z\', 0.67 on W\', p_min 6D = 0.972 met', m, near(r.factors.Ctn.v, 0.83, 1e-12) && near(r.capacity.Wp, 1380 * Math.pow(0.5, 2.5) * 0.162 * 0.67, 1e-9) && r.flags.length === 0, true);
    r = run('nail', nailRow('8d', 1.5, { toeNail: true, T: 10, main: { t: 3.5 } }), DFL);
    m = { table: 'spec §5.3 toe-nail', cell: '8d common L 2.5 into 3.5', inputs: r.inputs };
    fx('toe-nail 8d: l_m = 2.5·cos30 − 2.5/3 = 1.3317 (no cap)', m, r.lengths.l_m, 1.33173, 1e-5);
    fx('toe-nail 8d: p_t = 2.5 − 2.5/(3cos30) = 1.5377 (no cap), l_s = 0.8333', m, near(r.lengths.p_t, 1.53775, 1e-5) && near(r.lengths.l_s, 2.5 / 3, 1e-9), true);
    // end grain
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endGrain: true } }), DFL);
    m = { table: '§12.5.2.2 / §12.3.3.4', cell: '1/2 bolt in end grain', inputs: r.inputs };
    fx('end grain bolt: C_eg = 0.67', m, r.factors.Ceg.v, 0.67, 1e-12);
    fx('end grain bolt: F_em = F_e⊥ = 3150, cite §12.3.3.4 recorded', m, r.inputs.Fem === 3150 && r.cites.some(function (x) { return x.indexOf('12.3.3.4') >= 0; }), true);
    fx('end grain bolt: K_θ = 1.25 (load ⊥ to the end-grain member\'s grain)', m, r.yield.Ktheta, 1.25, 1e-12);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { main: { endGrain: true }, T: 10 }), DFL);
    fx('end grain lag: withdrawal C_eg 0.75, lateral 0.67', { table: '§12.2.1.3 / §12.5.2.2', cell: '' }, near(r.factors.Cegw.v, 0.75, 1e-12) && near(r.factors.Ceg.v, 0.67, 1e-12) && near(r.capacity.Wp, 1800 * Math.pow(0.5, 1.5) * Math.pow(0.5, 0.75) * 0.75, 1e-9), true);
    r = run('nail', nailRow('16d', 1.5, { main: { endGrain: true }, T: 10 }), DFL);
    fx('end grain nail T > 0 → fail endgrain_withdrawal', { table: '§12.2.3.3', cell: '' }, r.status === 'fail' && r.flags.indexOf('endgrain_withdrawal') >= 0, true);
    r = run('nail', nailRow('16d', 1.5, { main: { endGrain: true }, T: 0, V: 20 }), DFL);
    fx('end grain nail T = 0 → lateral only with C_eg 0.67, pass', { table: '§12.5.2.2', cell: '' }, r.status === 'pass' && near(r.factors.Ceg.v, 0.67, 1e-12), true);
    r = run('screw', wsRow(10, 3, 1.5, { main: { endGrain: true }, T: 5 }), DFL);
    fx('end grain wood screw T > 0 → fail endgrain_withdrawal', { table: '§12.2.2.3', cell: '' }, r.status === 'fail' && r.flags.indexOf('endgrain_withdrawal') >= 0, true);
    // status matrix
    r = run('nail', nailRow('16d', 1.5, { V: 0, T: 0 }), DFL); fx('(0, 0) → nodemand, capacities reported', { table: 'spec §2', cell: '' }, r.status === 'nodemand' && isNum(r.capacity.Zp) && isNum(r.capacity.Wcap), true);
    r = run('screw', lagRow(0.5, 3.0, 1.5, 0, 0, { V: 0, T: 0 }), DFL); fx('(0, 0) + short lag (p_excl 1.19 < 2) → fail beats nodemand', { table: 'spec §2', cell: '' }, r.status === 'fail' && r.flags.indexOf('p_min') >= 0, true);
    r = run('nail', nailRow('16d', 1.5, { V: 20, T: null }), DFL); fx('blank T on a nail → incomplete', { table: 'spec §2', cell: '' }, r.status === 'incomplete', true);
    r = run('nail', nailRow('16d', 1.5, { V: null, T: 0 }), DFL); fx('blank V on a nail → incomplete', { table: 'spec §2', cell: '' }, r.status === 'incomplete', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { T: null, V: 400 }), DFL); fx('bolt T null, V 400 → pass on V (Z\' 483)', { table: 'spec §2', cell: '' }, r.status === 'pass' && near(r.demand.dc, 400 / 483.2492, 1e-3), true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { T: null, V: 500 }), DFL); fx('bolt V 500 > Z\' 483 → fail on D/C', { table: 'spec §2', cell: '' }, r.status === 'fail' && r.demand.dc > 1 && r.flags.length === 0, true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { T: 10 }), DFL); fx('bolt T = 10 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { T: 0 }), DFL); fx('bolt T = 0 → fine (pass)', { table: 'spec §2', cell: '' }, r.status === 'pass', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 0 }), DFL); fx('n = 0 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 2.5 }), DFL); fx('n = 2.5 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { w: 0 } }), DFL); fx('w = 0 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'DFL', E_override: 0 }); fx('E_override = 0 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'CUSTOM', custom: { G: 0.5, E: 0, Fe_par: 5600, Fe_perp: 3150 } }); fx('custom E = 0 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'CUSTOM', custom: { G: 0.8, E: 1e6, Fe_par: 5600, Fe_perp: 3150 } }); fx('custom G = 0.8 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'CUSTOM', custom: { G: 0.5, E: 1e6, Fe_par: null, Fe_perp: 3150 } }); fx('custom F_e∥ blank → incomplete', { table: 'spec §2', cell: '' }, r.status === 'incomplete', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 45, 0), DFL); fx('θ = 45 → accepted since v1.1 (spec §12.1), Hankinson F_em 4032', { table: 'spec §12.1', cell: '' }, r.status === 'pass' && near(r.inputs.Fem, 4032, 1e-9), true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { V: -5 }), DFL); fx('V = −5 → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { V: 'abc' }), DFL); fx('V = "abc" → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { D: 1.25 }), DFL); fx('bolt D 1.25 → invalid (not Table L1 / D > 1)', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('screw', lagRow(0.75, 2, 1.5, 0, 0), DFL); fx('lag 3/4 × 2 → invalid (Table L2 availability)', { table: 'Table L2', cell: '' }, r.status === 'invalid', true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { mainSteel: true }), DFL); fx('lag with steel main → invalid', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { side: { mat: 'steel', gauge: 'plate', t: 0.125, w: 3 } }), DFL); fx('steel plate t 1/8 → invalid (pick a gauge)', { table: 'spec §3.1', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { t: null } }), DFL); fx('main t blank → incomplete', { table: 'spec §2', cell: '' }, r.status === 'incomplete', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { t: null }, n: 0 }), DFL); fx('invalid beats incomplete', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(steelSide(0.5, 1.5, 0), { n: 0 }), DFL); fx('invalid steel-side row: unresolved 0 (no AISC note)', { table: 'spec §11', cell: '' }, r.status === 'invalid' && r.unresolved === 0, true);
    r = run('bolt', merge(steelSide(0.5, 1.5, 0), { V: null }), DFL); fx('incomplete steel-side row: unresolved 0', { table: 'spec §11', cell: '' }, r.status === 'incomplete' && r.unresolved === 0, true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { T: 100, V: null, main: { t: 3.5 } }), DFL); fx('incomplete lag with T > 0: unresolved 0', { table: 'spec §11', cell: '' }, r.status === 'incomplete' && r.unresolved === 0, true);
    r = run('nail', nailRow('16d', 1.5, { main: { w: null }, n: null, s: null }), DFL); fx('nail: inactive w / n / s blank are ignored → pass', { table: 'spec §3.1 active-when', cell: '' }, r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { nailType: 'sinker', penny: '6d' }), DFL); fx('sinker 6d → invalid (excluded)', { table: 'Table I1', cell: '' }, r.status === 'invalid', true);
    // spread: one ⊥ row of 4 bolts (1/2) at s = 2 → (4−1)·2 = 6 in → fail spread5; with shrinkDetail → pass + note.
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { n: 4, rows: 1, s: 2, main: { w: 9.25 } }), DFL);
    fx('⊥ row of 4 at s 2 → spread 6 in → fail spread5', { table: '§12.5.1.3', cell: '' }, r.status === 'fail' && r.flags.indexOf('spread5') >= 0 && near(r.factors.Cdelta.detail.members[0].spread, 6, 1e-9), true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 90, 0), { n: 4, rows: 1, s: 2, shrinkDetail: true, main: { w: 9.25 } }), DFL);
    fx('same with shrinkDetail → pass with a note', { table: '§12.5.1.3 exception', cell: '' }, r.status === 'pass' && r.notes.some(function (x) { return x.indexOf('shrinkage') >= 0; }), true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 0, 0), { n: 2, rows: 2, s: 2, g: 5, main: { w: 9.25 }, side: { w: 9.25 } }), DFL);
    fx('two ∥ rows at g = 5 → spread 5 in → pass (limit is > 5)', { table: '§12.5.1.3', cell: '' }, r.status === 'pass' && near(r.factors.Cdelta.detail.members[0].spread, 5, 1e-9), true);
    // Table 12.5.1E: lag in withdrawal only (V = 0, T > 0): edge 1.5D, end 4D, s 4D, C_Δ = 1.
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { V: 0, T: 50, main: { endDist: 2.0 } }), DFL);
    fx('lag withdrawal only: Table 12.5.1E, end 4D = 2 ok, C_Δ 1, dcT = 50/Wcap', { table: 'Table 12.5.1E', cell: '', inputs: r.inputs }, r.status === 'pass' && r.factors.Cdelta.detail.rule.indexOf('12.5.1E') >= 0 && r.factors.Cdelta.v === 1 && near(r.demand.dc, 50 / r.capacity.Wcap, 1e-12), true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { V: 0, T: 50, main: { endDist: 1.9 } }), DFL);
    fx('lag withdrawal only: end 1.9 < 4D → fail geom_end', { table: 'Table 12.5.1E', cell: '' }, r.status === 'fail' && r.flags.indexOf('geom_end') >= 0, true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { V: 0, T: 50, n: 2, s: 1.9 }), DFL);
    fx('lag withdrawal only: s 1.9 < 4D → fail geom_spacing', { table: 'Table 12.5.1E', cell: '' }, r.status === 'fail' && r.flags.indexOf('geom_spacing') >= 0, true);
    // combined discriminator via the test hook: Z' = Wcap = 100, V = T = 50 → nail D/C 1.0 (Eq. 12.4-2); wood screw reaches 1.0 at 70.71 (Eq. 12.4-1).
    // Hand: α = 45°; nail Z'_α = 100·100/(100·0.7071 + 100·0.7071) = 70.71; √(50²+50²) = 70.71 → D/C 1.0.
    // Screw: Z'_α = 100·100/(100·0.5 + 100·0.5) = 100; at V = T = 70.71: √2·70.71 = 100 → D/C 1.0; at 50 → 0.7071.
    var cbN = combined('nail', 50, 50, 100, 100), cbS = combined('screw', 70.7107, 70.7107, 100, 100), cbS50 = combined('screw', 50, 50, 100, 100);
    fx('combined nail Eq. 12.4-2: V = T = 50, Z\' = Wcap = 100 → D/C 1.0', { table: 'Eq. 12.4-2', cell: 'α 45°' }, cbN.dc, 1.0, 1e-9);
    fx('combined nail: Z\'_α = 70.71', { table: 'Eq. 12.4-2', cell: '' }, cbN.Zalpha, 70.7107, 1e-3);
    fx('combined wood screw Eq. 12.4-1: V = T = 70.71 → D/C 1.0', { table: 'Eq. 12.4-1', cell: 'α 45°' }, cbS.dc, 1.0, 1e-5);
    fx('combined wood screw: V = T = 50 → D/C 0.7071 (not 1.0)', { table: 'Eq. 12.4-1', cell: '' }, cbS50.dc, 0.70711, 1e-5);
    fx('combined lag uses the squared form too', { table: 'Eq. 12.4-1', cell: '' }, combined('lag', 50, 50, 100, 100).dc, 0.70711, 1e-5);
    // through rows: nail 16d, t_s 1.5, t_m 3.5, V = T = 20: dcComb = √800 / Zα, dc = max.
    r = run('nail', nailRow('16d', 1.5, { V: 20, T: 20 }), DFL);
    var Zp = r.capacity.Zp, Wc = r.capacity.Wcap, Za = Wc * Zp / (Wc * Math.SQRT1_2 + Zp * Math.SQRT1_2);
    fx('nail row V = T = 20: Z\'_α per Eq. 12.4-2, dc = max(dcV, dcT, dcComb)', { table: 'Eq. 12.4-2', cell: '', inputs: r.inputs }, near(r.capacity.Zalpha, Za, 1e-9) && near(r.demand.dcComb, Math.sqrt(800) / Za, 1e-9) && near(r.demand.dc, Math.max(20 / Zp, 20 / Wc, Math.sqrt(800) / Za), 1e-12) && near(r.capacity.alpha, 45, 1e-9), true);
    r = run('screw', wsRow(10, 3, 1.5, { V: 20, T: 20 }), DFL);
    Zp = r.capacity.Zp; Wc = r.capacity.Wcap; Za = Wc * Zp / (Wc * 0.5 + Zp * 0.5);
    fx('wood screw row V = T = 20: Z\'_α per Eq. 12.4-1 (cos², sin²)', { table: 'Eq. 12.4-1', cell: '' }, near(r.capacity.Zalpha, Za, 1e-9) && near(r.demand.dcComb, Math.sqrt(800) / Za, 1e-9), true);
    // C_di and diaphragm / D/C wiring
    r = run('nail', nailRow('10d', 1.5, { diaphragm: true, V: 50 }), DFL); fx('C_di 1.1 on a diaphragm nail; Z\' = 1.1·Z; dc = 50/Z\'', { table: '§12.5.3', cell: '' }, near(r.factors.Cdi.v, 1.1, 1e-12) && near(r.capacity.Zp, 1.1 * r.yield.Z, 1e-9) && near(r.demand.dc, 50 / r.capacity.Zp, 1e-12), true);
    // F_yb override
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { Fyb_override: 60000 }), DFL); fx('F_yb override 60,000 applied (IV = 0.25/3.2·√(2·5600·60000/6) = 826.8)', { table: '§12.3.6', cell: '' }, r.inputs.Fyb === 60000 && near(r.yield.modes.IV, 0.25 / 3.2 * Math.sqrt(2 * 5600 * 60000 / 6), 1e-6), true);
    // species inherit / override
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { side: { species: 'SP' } }), DFL); fx('side species SP overrides header DFL: F_es = 11200·0.55 = 6150', { table: 'Table 12.3.3', cell: 'G 0.55 F_e∥' }, r.inputs.Fes === 6150 && r.inputs.Fem === 5600, true);
    r = run('bolt', boltRow(1, 1.5, 1.5, 0, 0), { species: 'HF' }); fx('HF: G 0.43 → F_e∥ 4800, E 1.3e6', { table: 'Table 12.3.3 / 12.3.3A', cell: 'G 0.43' }, r.inputs.Fem === 4800 && r.members.main.E === 1300000 && r.members.main.G === 0.43, true);
    r = run('bolt', boltRow(1, 1.5, 1.5, 0, 0), { species: 'SPFS' }); fx('SPF-S: G 0.36 → F_e∥ 4050, F_e⊥(1 in) 1400', { table: 'Table 12.3.3', cell: 'G 0.36' }, r.members.main.FePar === 4050 && r.members.main.FePerp === 1400, true);
    r = run('bolt', boltRow(1, 1.5, 1.5, 0, 0), { species: 'DFS' }); fx('DF-S: G 0.46 → F_e∥ 5150, F_e⊥(1 in) 2000', { table: 'Table 12.3.3', cell: 'G 0.46' }, r.members.main.FePar === 5150 && r.members.main.FePerp === 2000, true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), { species: 'DFL', E_override: 1400000 }); fx('E_override 1.4e6 replaces DFL 1.6e6 (C_g only)', { table: 'spec §3', cell: '' }, r.members.main.E === 1400000 && r.members.main.G === 0.5, true);
    // summary / state plumbing
    var st = defaultState();
    st.bolts.push(merge(newRow('bolt', { id: ++st.rowCnt }), { V: 100 }));
    st.bolts.push(merge(newRow('bolt', { id: ++st.rowCnt }), { V: 5000 }));
    st.nails.push(merge(newRow('nail', { id: ++st.rowCnt }), { V: 0, T: 0 }));
    st.nails.push(merge(newRow('nail', { id: ++st.rowCnt }), { V: null, T: 0 }));
    st.screws.push(merge(newRow('screw', { id: ++st.rowCnt }), { V: 20, T: 20 }));
    st.screws.push(merge(newRow('screw', { id: ++st.rowCnt, screwType: 'lag' }), { V: 100, T: 50, main: { t: 3.5 } }));   // default 1.5 main fails p_min for a 1/2 × 4 lag
    st.screws.push(merge(newRow('screw', { id: ++st.rowCnt }), { V: 20, T: 0, mainSteel: true }));
    var res = compute(st), sm = res.summary;
    fxb('summary: bolts pass 1 / fail 1, worstId = 2', { table: 'spec §7' }, sm.perTable.bolts.counts.pass === 1 && sm.perTable.bolts.counts.fail === 1 && sm.perTable.bolts.worstId === 2, JSON.stringify(sm.perTable.bolts));
    fxb('summary: nails nodemand 1 / incomplete 1', { table: 'spec §7' }, sm.perTable.nails.counts.nodemand === 1 && sm.perTable.nails.counts.incomplete === 1, JSON.stringify(sm.perTable.nails));
    fxb('summary: screws pass 2 / invalid 1, unresolved rows 2 (wood screw T > 0: root area; lag T > 0: pull-through + root area)', { table: 'spec §7' }, sm.perTable.screws.counts.pass === 2 && sm.perTable.screws.counts.invalid === 1 && sm.perTable.screws.unresolved === 2 && res.tables.screws[0].unresolved === 1 && res.tables.screws[1].unresolved === 2, JSON.stringify(sm.perTable.screws));
    fxb('summary total: 7 rows, counts sum, worst D/C from bolt 2', { table: 'spec §7' }, sm.total.rows === 7 && sm.total.counts.pass + sm.total.counts.fail + sm.total.counts.nodemand + sm.total.counts.incomplete + sm.total.counts.invalid === 7 && sm.total.worstId === 2, JSON.stringify(sm.total));
    fxb('result shape: engine / header / tables / summary keys only', { table: 'spec §7' }, Object.keys(res).join(',') === 'engine,header,tables,summary' && res.engine.name === 'wood-connection-schedule' && res.engine.version === 1 && res.header.species.G === 0.5 && res.header.speciesKey === 'DFL' && res.header.steel.Fe === 87000 && res.header.steel.E === 30000000, Object.keys(res).join(','));
    var rr = res.tables.bolts[0];
    fxb('rowResult shape: spec §7 keys', { table: 'spec §7' }, ['id', 'type', 'status', 'flags', 'warnings', 'notes', 'cites', 'unresolved', 'inputs', 'members', 'lengths', 'yield', 'factors', 'capacity', 'demand'].every(function (k) { return rr.hasOwnProperty(k); }) && ['Zp', 'W', 'Wp', 'Wcap_withdrawal', 'WH', 'WHp', 'Wcap', 'withdrawalGov', 'Zalpha', 'alpha'].every(function (k) { return rr.capacity.hasOwnProperty(k); }) && ['CD', 'CM', 'CMw', 'CMH', 'Ct', 'Cg', 'Cdelta', 'Ceg', 'Cegw', 'Cdi', 'Ctn'].every(function (k) { return rr.factors[k] && rr.factors[k].hasOwnProperty('v') && rr.factors[k].hasOwnProperty('cite'); }), Object.keys(rr).join(','));
    var nb = newRow('bolt'), nn = newRow('nail'), ns = newRow('screw'), nlg = newRow('screw', { screwType: 'lag' }), ds = defaultState();
    fxb('newRow(bolt) defaults: 3/4 single, t 1.5 w 5.5 θ 0, n 1 rows 1, s 3 g 1.125, end 5.25 edge 1.125 loaded 3, loadCase L', { table: 'spec §3.1' },
        nb.D === 0.75 && nb.shear === 'single' && nb.mainSteel === false && nb.main.t === 1.5 && nb.main.w === 5.5 && nb.main.theta === 0 && nb.side.mat === 'wood' && nb.side.species === null && nb.n === 1 && nb.rows === 1 && near(nb.s, 3, 1e-12) && near(nb.g, 1.125, 1e-12) && near(nb.main.endDist, 5.25, 1e-12) && near(nb.main.edgeDist, 1.125, 1e-12) && near(nb.main.loadedEdgeDist, 3, 1e-12) && nb.main.towardEnd === true && nb.loadCase === 'L' && nb.V === null && nb.T === null, JSON.stringify(nb));
    fxb('newRow(nail) defaults: 16d common, toeNail / diaphragm false', { table: 'spec §3.1' }, nn.nailType === 'common' && nn.penny === '16d' && nn.toeNail === false && nn.diaphragm === false, JSON.stringify(nn));
    fxb('newRow(screw) defaults: wood No. 10 L 3; lag variant 1/2 × 4', { table: 'spec §3.1' }, ns.screwType === 'wood' && ns.no === 10 && ns.L === 3 && nlg.screwType === 'lag' && nlg.D === 0.5 && nlg.L === 4 && near(nlg.s, 2, 1e-12) && near(nlg.endDist === undefined ? nlg.main.endDist : nlg.main.endDist, 3.5, 1e-12), JSON.stringify(nlg));
    fxb('defaultState: version 1, header defaults, empty tables, rowCnt 0', { table: 'spec §3' }, ds.version === 1 && ds.header.species === 'DFL' && ds.header.E_override === null && ds.header.steelGrade === 'A36' && ds.header.mcFab === 'dry' && ds.header.mcService === 'dry' && ds.header.temp === 'T100' && ds.header.custom.hardwood === false && ds.bolts.length === 0 && ds.nails.length === 0 && ds.screws.length === 0 && ds.rowCnt === 0 && Object.keys(ds).join(',') === 'version,header,bolts,nails,screws,rowCnt', JSON.stringify(ds));
    fxb('default rows compute: bolt pass, nail (V 20 T 0) pass, wood screw pass; default 1/2 × 4 lag into a 1.5 main fails p_min (p_excl 1.5 < 2), passes with t_m 3.5', { table: 'spec §3.1' }, (function () {
      var s2 = defaultState(); s2.bolts.push(merge(newRow('bolt', { id: 1 }), { V: 100 })); s2.nails.push(merge(newRow('nail', { id: 2 }), { V: 20, T: 0 })); s2.screws.push(merge(newRow('screw', { id: 3 }), { V: 20, T: 5 })); s2.screws.push(merge(newRow('screw', { id: 4, screwType: 'lag' }), { V: 100, T: 0 })); s2.screws.push(merge(newRow('screw', { id: 5, screwType: 'lag' }), { V: 100, T: 0, main: { t: 3.5 } }));
      var o = compute(s2); return o.tables.bolts[0].status === 'pass' && o.tables.nails[0].status === 'pass' && o.tables.screws[0].status === 'pass' && o.tables.screws[1].status === 'fail' && o.tables.screws[1].flags[0] === 'p_min' && o.tables.screws[2].status === 'pass';
    })());
    fxb('null state / empty tables compute without throwing', { table: 'spec §1' }, (function () { var o = compute(null); var o2 = compute({ version: 1 }); return o.summary.total.rows === 0 && o2.summary.total.rows === 0; })());
    fxb('DATA.notes records the Table L4 head-diameter reading', { table: 'spec §4' }, DATA.notes.some(function (x) { return x.indexOf('Table L4') >= 0; }));

    // ── 10. v1.1 — intermediate load angles (spec §12.1) ──────────────────────
    // Hankinson at 45°, 1/2 bolt DFL: F_e∥ 5600, F_e⊥ 3150 → 5600·3150/(5600·0.5 + 3150·0.5) = 17,640,000/4375 = 4032 (used unrounded, D6).
    // K_θ = 1 + 0.25·45/90 = 1.125; R_d = 4.5 / 4.05 / 3.6. Both members at 45: R_e = 1, R_t = 1, k1 = 0.41421 → II = 0.41421·0.5·1.5·4032/4.05 = 309.28;
    // I_m = I_s = 0.5·1.5·4032/4.5 = 672; k3 = −1 + √(4 + 2·45000·3·0.25/(3·4032·2.25)) = 1.54562 → III_s = 432.77; IV = 0.25/3.6·√(2·4032·45000/6) = 540.06. Z = 309.28 (II).
    fx('Hankinson 45°: F_e = 5600·3150/4375 = 4032 (unrounded)', { table: 'Eq. 12.3-11', cell: 'DFL 1/2, θ 45' }, feAtAngle(5600, 3150, 45), 4032, 1e-9);
    fx('Hankinson 30°: 5600·2600/(5600·0.25 + 2600·0.75) = 4346.27 (unrounded)', { table: 'Eq. 12.3-11', cell: 'DFL 3/4, θ 30' }, feAtAngle(5600, 2600, 30), 4346.2687, 1e-4);
    fx('Hankinson exact at 0 / 90', { table: 'Eq. 12.3-11', cell: '' }, feAtAngle(5600, 3150, 0) === 5600 && feAtAngle(5600, 3150, 90) === 3150, true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 45, 45), DFL);
    m = { table: 'spec §12.1 (hand)', cell: '1/2 bolt 1.5/1.5, both members θ 45', inputs: r.inputs };
    fx('θ 45 both: F_em = F_es = 4032, K_θ = 1.125', m, near(r.inputs.Fem, 4032, 1e-9) && near(r.inputs.Fes, 4032, 1e-9) && near(r.yield.Ktheta, 1.125, 1e-12), true);
    fx('θ 45 both: R_d = 4.5 / 4.05 / 3.6', m, near(r.yield.Rd.Im, 4.5, 1e-12) && near(r.yield.Rd.II, 4.05, 1e-12) && near(r.yield.Rd.IV, 3.6, 1e-12), true);
    fx('θ 45 both: Z = 309.28 (II), I_m 672, III_s 432.77, IV 540.06', m, near(r.yield.Z, 309.2795, 1e-3) && r.yield.governing === 'II' && near(r.yield.modes.Im, 672, 1e-9) && near(r.yield.modes.IIIs, 432.7724, 1e-3) && near(r.yield.modes.IV, 540.0617, 1e-3), true);
    fx('θ 45 both: Hankinson cite, §12.6.2 note absent for a single fastener (unresolved 0), interpolation note present, status pass', m, r.cites.some(function (x) { return x.indexOf('Hankinson') >= 0; }) && !r.notes.some(function (x) { return x.indexOf('12.6.2') >= 0; }) && r.unresolved === 0 && r.notes.some(function (x) { return x.indexOf('C12.5.1.2') >= 0; }) && r.status === 'pass', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 45, 0), DFL);
    // main 45 / side 0: R_e = 4032/5600 = 0.72, R_t 1, k1 = 0.35481 → II = 0.35481·0.5·1.5·5600/4.05 = 367.96 (II); I_m 672.
    fx('main 45 / side 0: F_em 4032, F_es 5600, K_θ 1.125, Z = 367.96 (II)', { table: 'spec §12.1 (hand)', cell: 'main θ 45, side 0' }, near(r.inputs.Fem, 4032, 1e-9) && r.inputs.Fes === 5600 && near(r.yield.Ktheta, 1.125, 1e-12) && near(r.yield.Z, 367.9552, 1e-3) && r.yield.governing === 'II', true);
    r = run('nail', nailRow('16d', 1.5, { main: { theta: 45 }, side: { theta: 30 } }), DFL);
    fx('nail (D < 1/4) at 45 / 30: F_e 4650 unchanged (no angle), K_θ not applied (R_d = K_D 2.2)', { table: 'Table 12.3.3 / 12.3.1B', cell: 'D < 1/4' }, r.inputs.Fem === 4650 && r.inputs.Fes === 4650 && near(r.yield.Rd.IV, 2.2, 1e-12) && r.status === 'pass', true);
    // end distance interpolation, 1/2 bolt softwood tension: full 3.5 → 2.0 at 90 → 2.75 at 45; half 1.75 → 1.0 → 1.375 at 45.
    var b45 = function (extra) { return run('bolt', merge(boltRow(0.5, 1.5, 1.5, 45, 0), extra || {}), DFL); };
    r = b45({ main: { endDist: 2.75 } }); fx('θ 45 end 2.75 = interpolated full → C_Δ 1.0', { table: 'C12.5.1.2', cell: 'end full 2.75' }, near(r.factors.Cdelta.v, 1, 1e-12) && near(r.factors.Cdelta.detail.members[0].endFull, 2.75, 1e-12) && near(r.factors.Cdelta.detail.members[0].endHalf, 1.375, 1e-12), true);
    r = b45({ main: { endDist: 2.0625 } }); fx('θ 45 end 2.0625 → C_Δ = 2.0625/2.75 = 0.75', { table: 'C12.5.1.2', cell: '' }, r.factors.Cdelta.v, 0.75, 1e-12);
    r = b45({ main: { endDist: 1.375 } }); fx('θ 45 end 1.375 = interpolated half → C_Δ 0.5', { table: 'C12.5.1.2', cell: '' }, r.factors.Cdelta.v, 0.5, 1e-12);
    r = b45({ main: { endDist: 1.37 } }); fx('θ 45 end 1.37 < half → fail geom_end', { table: 'C12.5.1.2', cell: '' }, r.status === 'fail' && r.flags.indexOf('geom_end') >= 0, true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 45, 0), { main: { towardEnd: false, endDist: 2.0 } }), DFL); fx('θ 45 compression (4D/2D at both angles): full stays 2.0 → C_Δ 1', { table: 'Table 12.5.1A', cell: '' }, near(r.factors.Cdelta.v, 1, 1e-12) && near(r.factors.Cdelta.detail.members[0].endFull, 2.0, 1e-12), true);
    // loaded edge active for θ > 0
    r = b45({ main: { loadedEdgeDist: 1.99 } }); fx('θ 45 loaded edge 1.99 < 4D → fail geom_edge', { table: 'Table 12.5.1C', cell: '⊥ rule at θ > 0' }, r.status === 'fail' && r.flags.indexOf('geom_edge') >= 0, true);
    r = b45({ main: { loadedEdgeDist: null } }); fx('θ 45 loaded edge blank → incomplete', { table: 'spec §12.1', cell: '' }, r.status === 'incomplete', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { loadedEdgeDist: null } }), DFL); fx('θ 0 loaded edge blank → still fine (inactive)', { table: 'spec §12.1', cell: '' }, r.status === 'pass', true);
    // row spacing at 45 = max(∥ 1.5D, ⊥ by l/D): 1/2 bolt 3.5/1.5 → l/D 3 → ⊥ 1.5625 governs; g 1.5 fails, 1.5625 passes.
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { rows: 2, g: 1.5, main: { w: 9.25 } }), DFL); fx('θ 45 row spacing min = max(0.75, 1.5625) → g 1.5 fails', { table: 'Table 12.5.1D', cell: 'θ 45' }, r.status === 'fail' && r.flags.indexOf('geom_row') >= 0 && near(r.factors.Cdelta.detail.members[0].rowMin, 1.5625, 1e-12), true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { rows: 2, g: 1.5625, main: { w: 9.25 } }), DFL); fx('θ 45 g 1.5625 → pass', { table: 'Table 12.5.1D', cell: '' }, r.status === 'pass', true);
    // D5: unloaded edge at 45 with l/D > 6 and rows 2 envelopes the ∥ g/2 rule: 1/2 bolt 3.5/3.5 (l/D 7), rows 2, g 4 → edge min = max(0.75, 2.0) = 2.0.
    r = run('bolt', merge(boltRow(0.5, 3.5, 3.5, 45, 0), { rows: 2, g: 4, main: { edgeDist: 1.9, w: 9.25 }, side: { w: 9.25 } }), DFL);
    fx('θ 45, l/D 7, rows 2, g 4: unloaded edge min = g/2 = 2.0 → 1.9 fails geom_edge', { table: 'Table 12.5.1C (D5)', cell: 'θ 45 envelope' }, r.status === 'fail' && r.flags.indexOf('geom_edge') >= 0 && near(r.factors.Cdelta.detail.members[0].edgeMin, 2.0, 1e-12), true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 3.5, 90, 0), { rows: 2, g: 4, main: { edgeDist: 0.75, loadedEdgeDist: 2, endDist: 2, w: 9.25 }, side: { w: 9.25, edgeDist: 2 } }), DFL);   // side (θ 0, l/D 7, rows 2) needs edge g/2 = 2
    fx('θ 90 keeps the pure ⊥ rule: unloaded edge 1.5D = 0.75 ok', { table: 'Table 12.5.1C', cell: 'θ 90' }, r.status === 'pass' && near(r.factors.Cdelta.detail.members[0].edgeMin, 0.75, 1e-12), true);
    // spread at 45: n 3, s 2, rows 2, g 1.5 → (3−1)·2·sin45 + (2−1)·1.5·cos45 = 2.8284 + 1.0607 = 3.889 (≤ 5, pass)
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { n: 3, s: 2, rows: 2, g: 1.5625, main: { w: 9.25 } }), DFL);
    fx('θ 45 spread = 2·2·sin45 + 1.5625·cos45 = 3.933', { table: '§12.5.1.3', cell: 'θ 45' }, r.factors.Cdelta.detail.members[0].spread, 2 * 2 * Math.SQRT1_2 + 1.5625 * Math.SQRT1_2, 1e-9);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { n: 3, s: 2, rows: 2, g: 1.5, main: { w: 9.25 }, shrinkDetail: true }), DFL);
    fx('θ 45 spread with g 1.5 = 3.889 (spec value); §12.6.2 note printed and counted unresolved (n·rows > 1)', { table: '§12.5.1.3 / §12.6.2', cell: '' }, near(r.factors.Cdelta.detail.members[0].spread, 3.889087, 1e-5) && r.notes.some(function (x) { return x.indexOf('12.6.2') >= 0; }) && r.unresolved === 1, true);
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { n: 5, s: 2, rows: 1, main: { w: 9.25 } }), DFL);
    fx('θ 45 spread 4·2·sin45 = 5.657 > 5 → fail spread5', { table: '§12.5.1.3', cell: '' }, r.status === 'fail' && r.flags.indexOf('spread5') >= 0, true);
    // C_g at 45 = min of the two area interpretations. 1/2 bolt DFL, main 3.5 × 5.5 at 45 (gross 19.25; ⊥ equivalent rows 1 → 3D = 1.5 → 5.25), side 1.5 × 5.5 at 0 (8.25), n 2, s 2.
    // γ = 63,640. gross: R_EA = 8.25/19.25 = 0.428571, u = 1 + 63640·1·(1/3.08e7 + 1/1.32e7) = 1.006887, m = 0.889319, C_g = 0.997271.
    // perp: R_EA = 0.636364, u = 1 + 63640·(1/8.4e6 + 1/1.32e7) = 1.012397, m = 0.854447, C_g = 0.997286. min = gross 0.997271.
    r = run('bolt', merge(boltRow(0.5, 3.5, 1.5, 45, 0), { n: 2, s: 2, main: { w: 5.5 } }), DFL);
    m = { table: 'spec §12.1 (hand)', cell: 'C_g at 45: gross vs ⊥ equivalent', inputs: r.inputs };
    fx('C_g at 45: gross interpretation 0.997271 (A_m 19.25)', m, near(r.factors.Cg.detail.interpretations.gross.Cg, 0.997271, 1e-5) && near(r.factors.Cg.detail.interpretations.gross.Am, 19.25, 1e-9), true);
    fx('C_g at 45: ⊥ interpretation 0.997286 (A_m 5.25)', m, near(r.factors.Cg.detail.interpretations.perp.Cg, 0.997286, 1e-5) && near(r.factors.Cg.detail.interpretations.perp.Am, 5.25, 1e-9), true);
    fx('C_g at 45: v = min = 0.997271, governing rule gross, note printed', m, near(r.factors.Cg.v, 0.997271, 1e-5) && r.factors.Cg.detail.governingRule === 'gross' && r.notes.some(function (x) { return x.indexOf('lesser of the ∥ and ⊥') >= 0; }), true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 91, 0), DFL); fx('θ = 91 → invalid', { table: 'spec §12.1', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, -1), DFL); fx('θ = −1 → invalid', { table: 'spec §12.1', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 90), DFL); fx('θ 90 / 90 unchanged: Z⊥ = 220 (12A), no angle notes', { table: 'Table 12A', cell: 'regression' }, near(r.yield.Z, 220, 5) && !r.notes.some(function (x) { return x.indexOf('C12.5.1.2') >= 0; }), true);

    // ── 11. v1.1 — staggered rows (spec §12.2, §11.3.6.2; Fable D1/D3 closest-fastener offset, s_eff = s/2, min(merged, separate)) ──
    // 1/2 bolt DFL, main 3.5 × 5.5 ∥ (A_m 19.25), side 1.5 × 5.5 ∥ (A_s 8.25), γ = 63,640.
    // merged layout: n 2, rows 2, s 8, g 0.75, offset 4 → offClosest = min(4, 8 − 4) = 4, offClosest/4 = 1.0 > g → merged: n_eff 4, s_eff = s/2 = 4, rows_eff 1:
    //   u = 1 + 63640·2·(1/3.08e7 + 1/1.32e7) = 1.013775, m = 0.847223, R_EA 0.428571, C_g(merged) = 0.956757.
    //   separate rows (n 2, s 8): u = 1.027550, m = 0.791206, C_g = 0.989389. min → merged 0.956757.
    // unmerged reference (n 2, s 4, g 1.5, offset 2 → offClosest 2, /4 = 0.5 ≤ g): C_g = 0.994594 = non-stagger value.
    var stg = function (extra) { return run('bolt', merge(boltRow(0.5, 3.5, 1.5, 0, 0), merge({ n: 2, rows: 2, s: 8, g: 0.75, main: { w: 5.5 }, side: { w: 5.5 } }, extra || {})), DFL); };
    r = stg({ stagger: true, offset: 4 });
    m = { table: 'spec §12.2 (hand)', cell: 's 8, offset 4 → offClosest 4; g 0.75 < 1.0 → merged', inputs: r.inputs };
    fx('stagger merged: offClosest 4, n_eff 4, s_eff = s/2 = 4, rows_eff 1, merged true', m, r.factors.Cg.detail.stagger.merged === true && near(r.factors.Cg.detail.stagger.offClosest, 4, 1e-12) && r.factors.Cg.detail.stagger.n_eff === 4 && near(r.factors.Cg.detail.stagger.s_eff, 4, 1e-12) && r.factors.Cg.detail.stagger.rows_eff === 1 && r.factors.Cg.detail.stagger.offset === 4, true);
    fx('stagger merged: C_g = min(merged 0.956757, separate 0.989389) = 0.956757 (u 1.013775, m 0.847223)', m, near(r.factors.Cg.v, 0.956757, 1e-5) && near(r.factors.Cg.detail.stagger.Cg_merged, 0.956757, 1e-5) && near(r.factors.Cg.detail.stagger.Cg_separate, 0.989389, 1e-5) && r.factors.Cg.detail.stagger.governingLayout === 'merged' && near(r.factors.Cg.detail.u, 1.013775, 1e-5) && near(r.factors.Cg.detail.m, 0.847223, 1e-5), true);
    fx('stagger merged: physical checks keep s 8 / g 0.75 (∥ rows 1.5D = 0.75 ok), spread (rows−1)·g = 0.75 at θ 0, cite §11.3.6.2 (Fig. 11B), status pass', m, r.status === 'pass' && near(r.factors.Cdelta.detail.members[0].spread, 0.75, 1e-12) && r.factors.Cg.cite.indexOf('§11.3.6.2 (Fig. 11B)') >= 0, true);
    var ref = stg({ s: 4, g: 1.5 });
    fx('non-stagger reference (n 2, s 4): C_g = 0.994594', { table: 'spec §12.2 (hand)', cell: 'n 2 s 4' }, ref.factors.Cg.v, 0.994594, 1e-5);
    r = stg({ stagger: true, offset: 2.0, s: 4, g: 1.5 });
    fx('stagger unmerged (offClosest 2, g 1.5 ≥ 0.5): C_g equals the non-stagger result, merged false, n_eff 2, s_eff 4', { table: 'spec §12.2', cell: '' }, near(r.factors.Cg.v, ref.factors.Cg.v, 1e-12) && r.factors.Cg.detail.stagger.merged === false && r.factors.Cg.detail.stagger.n_eff === 2 && r.factors.Cg.detail.stagger.s_eff === 4 && near(r.factors.Cg.detail.stagger.offClosest, 2, 1e-12), true);
    r = stg({ stagger: true, offset: 7, s: 8, g: 0.75 });
    fx('offset 7 of s 8 → offClosest = 1 (mirror), /4 = 0.25 ≤ g 0.75 → not merged', { table: '§11.3.6.2 closest fasteners', cell: '' }, near(r.factors.Cg.detail.stagger.offClosest, 1, 1e-12) && r.factors.Cg.detail.stagger.merged === false, true);
    r = stg({ stagger: true, offset: 4, rows: 3 });
    fx('stagger rows 3 merged: rows_eff = ceil(3/2) = 2, n_eff 4, s_eff 4, C_g = min(merged, separate) = 0.956757', { table: 'spec §12.2', cell: 'odd rows' }, r.factors.Cg.detail.stagger.rows_eff === 2 && r.factors.Cg.detail.stagger.n_eff === 4 && near(r.factors.Cg.v, 0.956757, 1e-5), true);
    r = stg({ stagger: true, offset: 8 }); fx('stagger offset = s → invalid', { table: 'spec §12.2', cell: '' }, r.status === 'invalid', true);
    r = stg({ stagger: true, offset: 9 }); fx('stagger offset > s → invalid', { table: 'spec §12.2', cell: '' }, r.status === 'invalid', true);
    r = stg({ stagger: true, offset: 0 }); fx('stagger offset 0 → invalid', { table: 'spec §12.2', cell: '' }, r.status === 'invalid', true);
    r = stg({ stagger: true, offset: null }); fx('stagger offset blank → incomplete', { table: 'spec §12.2', cell: '' }, r.status === 'incomplete', true);
    r = stg({ stagger: true, offset: 4, rows: 1 });
    fx('stagger with rows 1 → inactive: inputs.stagger false, offset null, no merge, n_eff 2', { table: 'spec §12.2', cell: 'inactive' }, r.inputs.stagger === false && r.inputs.offset === null && r.factors.Cg.detail.stagger.merged === false && r.factors.Cg.detail.stagger.n_eff === 2, true);
    r = run('nail', nailRow('16d', 1.5, { stagger: true, offset: 0 }), DFL); fx('stagger on a nail (D < 1/4) ignored → pass', { table: 'spec §12.2', cell: '' }, r.status === 'pass' && r.inputs.stagger === false, true);
    r = stg({ stagger: true, offset: 2, s: 4, main: { theta: 90, w: 9.25, loadedEdgeDist: 2, endDist: 2 }, g: 1.5625 });
    fx('stagger with a ⊥ member: §12.6.1 note; ⊥ equivalent width uses physical (rows−1)·g = 1.5625 (not merged rows)', { table: 'spec §12.2', cell: '' }, r.notes.some(function (x) { return x.indexOf('12.6.1') >= 0; }) && near(r.factors.Cg.detail.wGroupMain, 1.5625, 1e-12) && r.factors.Cg.detail.stagger.merged === false, true);
    // D2: spread with stagger — along-row extent (n − 1)·s + offClosest: θ 90, n 3, s 2.25, rows 2, offset 1.125 → 2·2.25 + 1.125 = 5.625 > 5 → spread5.
    r = stg({ stagger: true, offset: 1.125, n: 3, s: 2.25, g: 1.5625, main: { theta: 90, w: 9.25, loadedEdgeDist: 2, endDist: 2 } });
    fx('spread with stagger at θ 90: 2·2.25 + 1.125 = 5.625 → fail spread5', { table: '§12.5.1.3 (D2)', cell: 'n 3 s 2.25 offset 1.125', inputs: r.inputs }, r.status === 'fail' && r.flags.indexOf('spread5') >= 0 && near(r.factors.Cdelta.detail.members[0].spread, 5.625, 1e-9), true);
    r = stg({ stagger: false, n: 3, s: 2.25, g: 1.5625, main: { theta: 90, w: 9.25, loadedEdgeDist: 2, endDist: 2 } });
    fx('same layout without stagger: spread 4.5 → pass', { table: '§12.5.1.3', cell: '' }, r.status === 'pass' && near(r.factors.Cdelta.detail.members[0].spread, 4.5, 1e-9), true);
    r = stg({ stagger: false, s: 4, g: 1.5 });
    fx('absent / false stagger: detail.stagger inactive, behavior unchanged', { table: 'spec §12', cell: '' }, r.factors.Cg.detail.stagger.stagger === false && near(r.factors.Cg.v, ref.factors.Cg.v, 1e-12), true);
    var gdA = geomDefaults(0.5, 45, true), gdB = geomDefaults(0.5, 90, true), gdC = geomDefaults(0.5, 0, true);
    fx('geomDefaults(0.5, 45, true) endDist = 2.75 (interpolated), g 5D, loaded edge 2, edge 0.75, s 2', { table: 'spec §12.1 / GEOM_INTERP', cell: 'θ 45' }, near(gdA.endDist, 2.75, 1e-12) && near(gdA.g, 2.5, 1e-12) && near(gdA.loadedEdgeDist, 2, 1e-12) && near(gdA.edgeDist, 0.75, 1e-12) && near(gdA.s, 2, 1e-12), true);
    fx('geomDefaults(0.5, 90, true) endDist = 2.0', { table: 'GEOM_INTERP', cell: 'θ 90' }, gdB.endDist, 2.0, 1e-12);
    fx('geomDefaults(0.5, 0, true) endDist = 3.5, g 1.5D = 0.75', { table: 'GEOM_INTERP', cell: 'θ 0' }, near(gdC.endDist, 3.5, 1e-12) && near(gdC.g, 0.75, 1e-12), true);
    fx('geomDefaults compression (towardEnd false) 2.0 at every θ; hardwood tension 45 → 2.5 + (2 − 2.5)/2 = 2.25', { table: 'GEOM_INTERP', cell: '' }, near(geomDefaults(0.5, 45, false).endDist, 2.0, 1e-12) && near(geomDefaults(0.5, 0, false).endDist, 2.0, 1e-12) && near(geomDefaults(0.5, 45, true, true).endDist, 2.25, 1e-12), true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 45, 0), { main: { endDist: geomDefaults(0.5, 45, true).endDist } }), DFL);
    fx('a fresh angled row at the geomDefaults end distance opens at C_Δ = 1.0', { table: 'GEOM_INTERP', cell: '' }, r.factors.Cdelta.v, 1, 1e-12);
    var nr = newRow('bolt'); fxb('newRow carries stagger false / offset null; ENGINE.rev v1.2 (was v1.1), version 1', { table: 'spec §12 / §13' }, nr.stagger === false && nr.offset === null && ENGINE.rev === '2026-09-20 v1.2' && ENGINE.version === 1, ENGINE.rev);

    // ── 12. v1.2 — connection totals, fastener pattern for every type, spacing block, D_H echo (spec §13) ──
    // 12.1 totals: 1/2 bolt DFL 1.5/1.5 ∥, n 3, rows 2 (g 0.75 = 1.5D ok), s 2 = 4D; demandBasis total, V_total 600, T_total 0.
    //   qty = 3·2 = 6 → V = 600/6 = 100 per bolt. Z' = Z·C_g (n 3, s 2; C_Δ 1) — asserted as relations: Z_total = 6·Z', D/C = 100/Z', pctV = 100·D/C.
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 3, rows: 2, s: 2, g: 0.75, V: null, demandBasis: 'total', V_total: 600, T_total: 0 }), DFL);
    m = { table: 'spec §13.2', cell: 'bolt n 3 rows 2, total 600', inputs: r.inputs };
    fx('totals: qty 6, V = 600/6 = 100, V_total 600 echoed, T / T_total null on a bolt', m, r.demand.qty === 6 && near(r.demand.V, 100, 1e-12) && r.demand.V_total === 600 && r.demand.T === null && r.demand.T_total === null && r.inputs.demandBasis === 'total', true);
    fx('totals: Z_total = 6·Z\', W_total null (bolt), status pass', m, near(r.capacity.Z_total, 6 * r.capacity.Zp, 1e-9) && r.capacity.W_total === null && r.status === 'pass' && r.factors.Cg.v < 1, true);
    fx('totals: D/C = 100/Z\', pctV = 100·D/C, pctT / pctComb null', m, near(r.demand.dcV, 100 / r.capacity.Zp, 1e-12) && near(r.demand.pctV, 100 * r.demand.dcV, 1e-9) && r.demand.pctT === null && r.demand.pctComb === null, true);
    fx('totals: per-fastener V typed as null is ignored in total mode', m, r.status === 'pass', true);
    // per basis on a nail with n 2 (v1.2: n / rows active for D < 1/4): V 20, T 5 → V_total 40, T_total 10, qty 2; W_total = 2·Wcap; pct forms.
    r = run('nail', nailRow('16d', 1.5, { n: 2, rows: 1, s: 2.5, V: 20, T: 5 }), DFL);
    m = { table: 'spec §13.2', cell: 'nail n 2, per basis', inputs: r.inputs };
    fx('per basis nail: V_total = 20·2 = 40, T_total = 10, qty 2, demandBasis per', m, near(r.demand.V_total, 40, 1e-12) && near(r.demand.T_total, 10, 1e-12) && r.demand.qty === 2 && r.inputs.demandBasis === 'per', true);
    fx('per basis nail: Z_total = 2·Z\', W_total = 2·Wcap, pctT = 100·T/Wcap, pctComb = 100·dcComb', m, near(r.capacity.Z_total, 2 * r.capacity.Zp, 1e-9) && near(r.capacity.W_total, 2 * r.capacity.Wcap, 1e-9) && near(r.demand.pctT, 100 * 5 / r.capacity.Wcap, 1e-9) && near(r.demand.pctComb, 100 * r.demand.dcComb, 1e-9), true);
    r = run('nail', nailRow('16d', 1.5, { n: 3, rows: 2, s: 2.5, g: 1, demandBasis: 'total', V_total: 120, T_total: 30, V: null, T: null }), DFL);
    fx('total basis nail: qty 6 → V 20, T 5 (same D/C as the per-fastener row above)', { table: 'spec §13.2', cell: 'nail total 120 / 30, qty 6' }, r.demand.qty === 6 && near(r.demand.V, 20, 1e-12) && near(r.demand.T, 5, 1e-12) && r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { demandBasis: 'total', V_total: null, T_total: 0, V: 20, T: 0 }), DFL);
    fx('total mode with V_total blank → incomplete (per-fastener V present but not the input pair)', { table: 'spec §13.2 / §2', cell: '' }, r.status === 'incomplete' && r.warnings.some(function (x) { return x.indexOf('V_total') >= 0; }), true);
    r = run('nail', nailRow('16d', 1.5, { demandBasis: 'total', V_total: 0, T_total: 0 }), DFL);
    fx('total mode (0, 0) → nodemand', { table: 'spec §13.2 / §2', cell: '' }, r.status === 'nodemand', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { demandBasis: 'total', V_total: 100, T_total: 10 }), DFL);
    fx('bolt total mode with T_total 10 → invalid (§12.2.4 check follows the input pair)', { table: 'spec §13.2 / §2', cell: '' }, r.status === 'invalid', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { demandBasis: 'total', V_total: 100, T_total: null, T: 10 }), DFL);
    fx('bolt total mode: stale per-fastener T 10 ignored, T_total blank fine → pass', { table: 'spec §13.2', cell: '' }, r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { n: 0 }), DFL); fx('nail n = 0 → invalid (n active for every type)', { table: 'spec §13.2 / §2', cell: '' }, r.status === 'invalid', true);
    r = run('nail', nailRow('16d', 1.5, { n: null, rows: null }), DFL); fx('nail n / rows blank → 1 (v1.1 files), qty 1, pass', { table: 'spec §13.2 (absent = v1.1)', cell: '' }, r.status === 'pass' && r.demand.qty === 1 && r.inputs.n === 1 && r.inputs.rows === 1, true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: null }), DFL); fx('bolt n blank → still incomplete (D ≥ 1/4)', { table: 'spec §2', cell: '' }, r.status === 'incomplete', true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.0 } }), DFL);   // geom_end fail
    fx('fatal-flag row: demand still carries V_total 100 / qty 1 with null D/C and pct; Z_total / W_total null', { table: 'spec §13.2', cell: 'fail shape' }, r.status === 'fail' && r.demand.qty === 1 && r.demand.V_total === 100 && r.demand.pctV === null && r.capacity.Z_total === null && r.capacity.W_total === null, true);
    // 12.2 spacingReq, D ≥ 1/4 (Table 12.5.1 values via the same gm objects). 1/2 bolt θ 0 tension softwood, 1.5/1.5 (l/D 3):
    //   end_loaded = 7D = 3.5, a1 = 4D = 2.0, edge_unloaded = 1.5D = 0.75 (l/D ≤ 6), rows_inline = 1.5D = 0.75, edge_loaded 4D = 2.0, end_unloaded 4D = 2.0.
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), DFL);
    m = { table: 'spec §13.3 / Tables 12.5.1A–D', cell: '1/2 bolt θ 0 tension', inputs: r.inputs };
    var SRq = r.spacingReq;
    fx('spacingReq bolt θ 0: end_loaded 3.5, a1 2.0, edge_unloaded 0.75, rows_inline 0.75', m, near(SRq.end_loaded, 3.5, 1e-12) && near(SRq.a1_par, 2.0, 1e-12) && near(SRq.edge_unloaded, 0.75, 1e-12) && near(SRq.rows_inline, 0.75, 1e-12), true);
    fx('spacingReq bolt θ 0: a2 2.0, end_unloaded 2.0, edge_loaded 2.0, rows_staggered = in-line, basis text, member main', m, near(SRq.a2_perp, 2.0, 1e-12) && near(SRq.end_unloaded, 2.0, 1e-12) && near(SRq.edge_loaded, 2.0, 1e-12) && near(SRq.rows_staggered, 0.75, 1e-12) && SRq.basis === 'NDS Table 12.5.1A–D (C_Δ = 1.0 values; hard minima in checks)' && SRq.member === 'main', true);
    fx('spacingReq bolt θ 0: checks echo the hard minima (main / side end 1.75, edge 0.75), all ok, no s / g checks at n 1 rows 1', m, SRq.checks.length === 4 && SRq.checks.every(function (c) { return c.ok === true; }) && near(SRq.checks[0].required, 1.75, 1e-12) && near(SRq.checks[1].required, 0.75, 1e-12), true);
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { main: { endDist: 1.74 }, n: 2, s: 1.49 }), DFL);
    fx('spacingReq bolt: failing end 1.74 < 1.75 and s 1.49 < 3D → checks ok false on those lines, flags geom_end / geom_spacing (unchanged)', { table: 'spec §13.3', cell: 'checks mirror flags' }, r.status === 'fail' && r.spacingReq.checks.some(function (c) { return c.name === 'main end distance (hard min = C_Δ 0.5 value)' && c.ok === false; }) && r.spacingReq.checks.some(function (c) { return /spacing in a row/.test(c.name) && c.ok === false && near(c.required, 1.5, 1e-12); }), true);
    // θ 90 (main ⊥, 1.5/1.5 → l/D 3): end 4D = 2.0, edge_loaded 4D = 2.0, rows_inline = (5·1.5 + 5)/8 = 1.5625 (Table 12.5.1D 2 < l/D < 6), edge_unloaded 1.5D.
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 90, 0), DFL);
    m = { table: 'spec §13.3 / Table 12.5.1D', cell: '1/2 bolt main θ 90, l/D 3', inputs: r.inputs };
    fx('spacingReq bolt θ 90: end_loaded 2.0, edge_loaded 2.0, rows_inline 1.5625 (l/D 3), edge_unloaded 0.75', m, near(r.spacingReq.end_loaded, 2.0, 1e-12) && near(r.spacingReq.edge_loaded, 2.0, 1e-12) && near(r.spacingReq.rows_inline, 1.5625, 1e-12) && near(r.spacingReq.edge_unloaded, 0.75, 1e-12), true);
    fx('spacingReq bolt θ 90: main loaded-edge check present (2.0 vs 2.0 ok); rows_inline equals the C_Δ block rowMin', m, r.spacingReq.checks.some(function (c) { return c.name === 'main loaded edge distance' && near(c.required, 2.0, 1e-12) && c.ok === true; }) && near(r.spacingReq.rows_inline, r.factors.Cdelta.detail.members[0].rowMin, 1e-12), true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 45, 0), DFL);
    fx('spacingReq bolt θ 45: end_loaded interpolated 2.75 = C_Δ block endFull', { table: 'spec §13.3 / C12.5.1.2', cell: '' }, near(r.spacingReq.end_loaded, 2.75, 1e-12) && near(r.spacingReq.end_loaded, r.factors.Cdelta.detail.members[0].endFull, 1e-12), true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { V: 0, T: 50, main: { endDist: 2.0 } }), DFL);
    fx('spacingReq lag withdrawal-only: Table 12.5.1E basis, edge 0.75, end 2.0, s 2.0', { table: 'spec §13.3 / Table 12.5.1E', cell: '' }, /12\.5\.1E/.test(r.spacingReq.basis) && near(r.spacingReq.edge_unloaded, 0.75, 1e-12) && near(r.spacingReq.end_loaded, 2.0, 1e-12) && near(r.spacingReq.a1_par, 2.0, 1e-12), true);
    r = run('bolt', merge(boltRow(0.5, 0.25, 1.5, 0, 0), { mainSteel: true, main: { gauge: 'plate', t: 0.25, w: 3 } }), DFL);
    fx('spacingReq steel main: keyed to the side member', { table: 'spec §13.3', cell: '' }, r.spacingReq.member === 'side' && near(r.spacingReq.end_loaded, 3.5, 1e-12), true);
    // 12.3 spacingReq, D < 1/4 — Commentary Table C12.1.6.6 (PDF 269), 16d common D 0.162, wood side, not prebored:
    //   edge 2.5D = 0.405; end tension 15D = 2.43; a1 (∥) 15D = 2.43; a2 (⊥) 10D = 1.62; rows in-line 5D = 0.81, staggered 2.5D = 0.405; end compression 10D = 1.62.
    r = run('nail', nailRow('16d', 1.5), DFL);
    m = { table: 'Commentary Table C12.1.6.6 p.255/269', cell: 'wood side, not prebored, 16d (0.162)', inputs: r.inputs };
    SRq = r.spacingReq;
    fx('C12.1.6.6 wood / not prebored: edge 0.405, end 2.43, a1 2.43, a2 1.62, rows 0.81 / 0.405', m, near(SRq.edge_unloaded, 0.405, 1e-12) && near(SRq.end_loaded, 2.43, 1e-12) && near(SRq.a1_par, 2.43, 1e-12) && near(SRq.a2_perp, 1.62, 1e-12) && near(SRq.rows_inline, 0.81, 1e-12) && near(SRq.rows_staggered, 0.405, 1e-12), true);
    fx('C12.1.6.6: basis text, end_unloaded = compression 1.62, s_required ∥ 2.43 at θ 0, prebored false, wood side', m, SRq.basis === 'Commentary Table C12.1.5.7 (wood screws) / C12.1.6.6 (nails), advisory (PDF 268–269)' && near(SRq.end_unloaded, 1.62, 1e-12) && near(SRq.s_required, 2.43, 1e-12) && SRq.prebored === false && SRq.sideMat === 'wood', true);
    fx('C12.1.6.6: fresh nail row at the v1.2 geomDefaults (end 2.43, edge 0.405) → checks ok, no advisory warning, note printed, status pass', m, r.status === 'pass' && SRq.checks.length === 4 && SRq.checks.every(function (c) { return c.ok; }) && !r.warnings.some(function (x) { return x.indexOf('advisory') >= 0; }) && r.notes.some(function (x) { return x.indexOf('§12.1.5.7 / §12.1.6.5') >= 0; }), true);
    r = run('nail', nailRow('16d', 1.5, { prebored: true }), DFL);
    fx('C12.1.6.6 wood / prebored: end 1.62, a1 1.62, a2 0.81, rows 0.486 / 0.405, edge 0.405', { table: 'Commentary Table C12.1.6.6 p.255/269', cell: 'wood side, prebored' }, near(r.spacingReq.end_loaded, 1.62, 1e-12) && near(r.spacingReq.a1_par, 1.62, 1e-12) && near(r.spacingReq.a2_perp, 0.81, 1e-12) && near(r.spacingReq.rows_inline, 0.486, 1e-12) && near(r.spacingReq.rows_staggered, 0.405, 1e-12) && near(r.spacingReq.edge_unloaded, 0.405, 1e-12) && r.spacingReq.prebored === true, true);
    r = run('nail', nailRow('16d', 0.06, { side: { mat: 'steel', gauge: '16' } }), DFL);
    fx('C12.1.6.6 steel side / not prebored: end 1.62, a1 1.62, a2 0.81, rows 0.486 / 0.405, edge 0.405', { table: 'Commentary Table C12.1.6.6 p.255/269', cell: 'steel side, not prebored' }, near(r.spacingReq.end_loaded, 1.62, 1e-12) && near(r.spacingReq.a1_par, 1.62, 1e-12) && near(r.spacingReq.a2_perp, 0.81, 1e-12) && near(r.spacingReq.rows_inline, 0.486, 1e-12) && near(r.spacingReq.rows_staggered, 0.405, 1e-12) && near(r.spacingReq.edge_unloaded, 0.405, 1e-12) && r.spacingReq.sideMat === 'steel', true);
    r = run('nail', nailRow('16d', 0.06, { side: { mat: 'steel', gauge: '16' }, prebored: true }), DFL);
    fx('C12.1.6.6 steel side / prebored: end 0.81 (5D), compression 0.486 (3D), a1 0.81, a2 0.405, rows 0.405 / 0.405', { table: 'Commentary Table C12.1.6.6 p.255/269', cell: 'steel side, prebored' }, near(r.spacingReq.end_loaded, 0.81, 1e-12) && near(r.spacingReq.end_unloaded, 0.486, 1e-12) && near(r.spacingReq.a1_par, 0.81, 1e-12) && near(r.spacingReq.a2_perp, 0.405, 1e-12) && near(r.spacingReq.rows_inline, 0.405, 1e-12), true);
    // advisory warning: n 2, s 1.0 < 15D = 2.43 → warning with the exact spec text; status unchanged (pass), no flag.
    r = run('nail', nailRow('16d', 1.5, { n: 2, s: 1.0 }), DFL);
    m = { table: 'spec §13.3', cell: 'nail n 2, s 1.0', inputs: r.inputs };
    fx('advisory: s 1.0 < 15D → warning text exact, status pass, flags empty, C_Δ 1', m, r.warnings.indexOf('advisory spacing: s = 1.000 < 15D = 2.430 (Commentary Table C12.1.6.6, not prebored)') >= 0 && r.status === 'pass' && r.flags.length === 0 && r.factors.Cdelta.v === 1, true);
    fx('advisory: check line ok false with required 2.43, actual 1.0', m, r.spacingReq.checks.some(function (c) { return c.name === 's' && c.ok === false && near(c.required, 2.43, 1e-12) && c.actual === 1.0; }), true);
    r = run('nail', nailRow('16d', 1.5, { n: 2, s: 1.0, main: { theta: 90, loadedEdgeDist: 0.405 }, side: { theta: 0 } }), DFL);
    fx('advisory at main θ 90: s rule ⊥ 10D = 1.62 → "s = 1.000 < 10D = 1.620"', { table: 'spec §13.3', cell: '⊥ by main θ' }, near(r.spacingReq.s_required, 1.62, 1e-12) && r.warnings.some(function (x) { return x.indexOf('s = 1.000 < 10D = 1.620') >= 0; }) && r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { n: 2, s: 2.0, main: { theta: 45 }, side: { theta: 0 } }), DFL);
    fx('advisory at main θ 45: the larger (∥ 15D = 2.43) governs → s 2.0 warns', { table: 'spec §13.3', cell: 'intermediate θ → larger' }, near(r.spacingReq.s_required, 2.43, 1e-12) && r.warnings.some(function (x) { return x.indexOf('advisory spacing: s') >= 0; }), true);
    r = run('nail', nailRow('16d', 1.5, { rows: 2, g: 0.5, main: { towardEnd: false, endDist: 1.62 } }), DFL);
    fx('advisory: rows 2 g 0.5 < 5D = 0.81 warns; compression end 10D = 1.62 exactly ok', { table: 'spec §13.3', cell: 'g / compression' }, r.warnings.some(function (x) { return x.indexOf('g = 0.500 < 5D = 0.810') >= 0; }) && near(r.spacingReq.end_loaded, 1.62, 1e-12) && !r.warnings.some(function (x) { return x.indexOf('end distance') >= 0; }) && r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { main: { endDist: 1.0, edgeDist: 0.3 }, side: { endDist: 1.0, edgeDist: 0.3 } }), DFL);
    fx('advisory: main / side end 1.0 < 15D and edge 0.3 < 2.5D → four warnings, status still pass', { table: 'spec §13.3', cell: 'end / edge, both wood members' }, r.warnings.filter(function (x) { return x.indexOf('advisory spacing') === 0; }).length === 4 && r.warnings.some(function (x) { return x === 'advisory spacing: main edge distance = 0.300 < 2.5D = 0.405 (Commentary Table C12.1.6.6, not prebored)'; }) && r.status === 'pass', true);
    r = run('nail', nailRow('16d', 1.5, { n: 2, s: null, g: null, main: { endDist: null, edgeDist: null }, side: { endDist: null, edgeDist: null } }), DFL);
    fx('advisory: blank geometry on a nail (older file) → checks empty, no warnings, block still reports the required values, pass', { table: 'spec §13.3 (older files)', cell: '' }, r.status === 'pass' && r.spacingReq.checks.length === 0 && !r.warnings.some(function (x) { return x.indexOf('advisory') >= 0; }) && near(r.spacingReq.a1_par, 2.43, 1e-12), true);
    r = run('nail', nailRow('16d', 1.5, { s: -1 }), DFL); fx('nail s = −1 → invalid (rejected input, §2)', { table: 'spec §2', cell: '' }, r.status === 'invalid', true);
    r = run('screw', wsRow(10, 3, 1.5, { n: 2, s: 1.0 }), DFL);
    fx('wood screw No. 10 (0.190) advisory cites Table C12.1.5.7: s 1.0 < 15D = 2.85', { table: 'Commentary Table C12.1.5.7 p.254/268', cell: 'wood side, not prebored' }, r.warnings.indexOf('advisory spacing: s = 1.000 < 15D = 2.850 (Commentary Table C12.1.5.7, not prebored)') >= 0 && near(r.spacingReq.edge_unloaded, 0.475, 1e-12) && r.status === 'pass', true);
    fx('geomDefaults for D < 1/4 = Commentary not-prebored wood values: 16d s 2.43, g 0.81, end 2.43 (tension) / 1.62 (compression), edge 0.405; θ 90 s 1.62', { table: 'spec §13.3 / GEOM_INTERP', cell: 'D 0.162' }, (function () { var a = geomDefaults(0.162, 0, true), b = geomDefaults(0.162, 0, false), c9 = geomDefaults(0.162, 90, true); return near(a.s, 2.43, 1e-12) && near(a.g, 0.81, 1e-12) && near(a.endDist, 2.43, 1e-12) && near(b.endDist, 1.62, 1e-12) && near(a.edgeDist, 0.405, 1e-12) && near(c9.s, 1.62, 1e-12); })(), true);
    // 12.4 fastener property echo: D_H (pull-through head diameter) and coating.
    r = run('nail', nailRow('16d', 1.5), DFL); fx('inputs.D_H = 0.344 for 16d common (Table L4), coating null', { table: 'Table L4 p.182/196', cell: '16d common H' }, r.inputs.D_H === 0.344 && r.inputs.coating === null, true);
    r = run('screw', wsRow(10, 3, 1.5), DFL); fx('inputs.D_H = 0.363 for No. 10 wood screw (Table L3)', { table: 'Table L3 p.182/196', cell: 'No. 10 D_H' }, r.inputs.D_H === 0.363, true);
    r = run('screw', lagRow(0.5, 4, 1.5, 0, 0, { main: { t: 3.5 } }), DFL); fx('inputs.D_H null for a lag (hex head)', { table: 'spec §13.4', cell: '' }, r.inputs.D_H === null && r.inputs.coating === null, true);
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), DFL); fx('inputs.D_H null for a bolt', { table: 'spec §13.4', cell: '' }, r.inputs.D_H === null, true);
    // 12.5 exits_main wording (spec §13.1): 16d (L 3.5) through t_s 1.5 into t_m 0.75 → L − t_s = 2.000 > t_m = 0.750.
    r = run('nail', nailRow('16d', 1.5, { main: { t: 0.75 } }), DFL);
    fx('exits_main warning text: "fastener exits the main member: L − t_s = 2.000 > t_m = 0.750 — lengths capped at t_m"', { table: 'spec §13.1', cell: '' }, r.warnings.indexOf('fastener exits the main member: L − t_s = 2.000 > t_m = 0.750 — lengths capped at t_m') >= 0, true);
    // 12.6 newRow / shape
    var n12 = newRow('nail'), b12 = newRow('bolt');
    fxb('newRow carries demandBasis per, V_total / T_total null, prebored false (nail and bolt)', { table: 'spec §13' }, n12.demandBasis === 'per' && n12.V_total === null && n12.T_total === null && n12.prebored === false && b12.demandBasis === 'per' && b12.prebored === false, JSON.stringify({ demandBasis: n12.demandBasis, V_total: n12.V_total, T_total: n12.T_total, prebored: n12.prebored }));
    fxb('newRow(nail) geometry defaults at the Commentary values: s 2.43, g 0.81, end 2.43, edge 0.405', { table: 'spec §13.3' }, near(n12.s, 2.43, 1e-12) && near(n12.g, 0.81, 1e-12) && near(n12.main.endDist, 2.43, 1e-12) && near(n12.main.edgeDist, 0.405, 1e-12), JSON.stringify({ s: n12.s, g: n12.g, end: n12.main.endDist, edge: n12.main.edgeDist }));
    r = run('bolt', boltRow(0.5, 1.5, 1.5, 0, 0), DFL);
    fxb('rowResult v1.2 shape: spacingReq keys, capacity Z_total / W_total, demand V_total / T_total / qty / pct*', { table: 'spec §13' },
        ['basis', 'a1_par', 'a2_perp', 'end_loaded', 'end_unloaded', 'edge_loaded', 'edge_unloaded', 'rows_inline', 'rows_staggered', 'checks'].every(function (k) { return r.spacingReq.hasOwnProperty(k); }) && ['Z_total', 'W_total'].every(function (k) { return r.capacity.hasOwnProperty(k); }) && ['V_total', 'T_total', 'qty', 'pctV', 'pctT', 'pctComb'].every(function (k) { return r.demand.hasOwnProperty(k); }) && r.hasOwnProperty('spacingReq'), Object.keys(r.spacingReq).join(','));
    r = run('bolt', merge(boltRow(0.5, 1.5, 1.5, 0, 0), { n: 0 }), DFL); fxb('invalid row: spacingReq null', { table: 'spec §13.3' }, r.spacingReq === null, String(r.spacingReq));

    var pass = 0, fail = 0;
    FX.forEach(function (f) { if (f.ok) pass++; else fail++; });
    return { pass: pass, fail: fail, total: FX.length, results: FX };
  }

  var WC = {
    ENGINE: ENGINE, DATA: DATA,
    compute: compute, computeRow: computeRow, runFixtures: runFixtures,
    newRow: newRow, defaultState: defaultState, geomDefaults: geomDefaults, resolveHeader: resolveHeader, resolveSpecies: resolveSpecies,
    // test hooks / building blocks
    _combined: combined, _yield: yieldModes, _groupAction: groupAction, _pullThrough: pullThrough, _withdrawalUnit: withdrawalUnit,
    _fe: feWood, _feAtAngle: feAtAngle, _KD: KD, _Ktheta: Ktheta, _cmLateral: cmLateral, _cmWithdrawal: cmWithdrawal, _cmPullThrough: cmPullThrough, _ct: ctFactor,
    clone: clone
  };
  root.WC = WC;
  if (typeof module !== 'undefined' && module.exports) module.exports = WC;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
