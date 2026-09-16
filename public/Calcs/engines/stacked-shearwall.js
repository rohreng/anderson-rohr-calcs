/* =============================================================================
   SW engine — stacked perforated shear walls, SDPWS 2021 / NDS 2018 / ASCE 7-16.
   DOM-free.  window.SW.compute(state) -> result.

   Code basis (every clause verified against the AWC PDF, not from memory):
     SDPWS 2021 §4.1.4.1   ASD seismic = nominal / 2.8
     SDPWS 2021 §4.1.4.2   ASD wind    = nominal / 2.0
     SDPWS 2021 §4.3.2.3   perforated shear wall limitations (items 2,4,6,7,8,9)
     SDPWS 2021 §4.3.3.4   perforated shear wall segment aspect ratios, Sigma b_i
     SDPWS 2021 §4.3.5.2   nominal unit shear capacities, Tables 4.3A / 4.3C
     SDPWS 2021 §4.3.5.4.1 similar sheathing both faces -> 2x
     SDPWS 2021 §4.3.5.4.2 dissimilar sheathing -> greater of 2x smaller / larger;
                           wind exception for WSP + gypsum -> sum of both faces
     SDPWS 2021 §4.3.5.6   C_o, Table 4.3.5.6 (Eq. 4.3-6 defines A_fhs, A_o, A_wall)
     SDPWS 2021 §4.3.6.1.3 tension / compression chords of perforated shear walls
     SDPWS 2021 §4.3.6.4.1.1 v_max (Eq. 4.3-9)
     SDPWS 2021 §4.3.6.4.2.1 uniform uplift t = v_max at the bottom plate
     SDPWS 2021 §4.3.6.4.3 anchor bolt plate washers (nominal > 400 plf)
     SDPWS 2021 §4.3.6.4.4 load path — sum of FORCES contributed by each story
     SDPWS 2021 §4.3.7.1(5) 3x framing + staggered nailing triggers
     Table 4.3A fn.3  specific gravity adjustment = [1 - (0.5 - G)] <= 1
     Table 4.3A fn.6  both faces, spacing < 6 in -> offset joints or 3x + stagger
     Table 4.3A fn.10 10d common + hold-down on the inside face of the end post -> 0.92
     Table 4.3.3 n.2  gypsum h/b may be 3.5:1 for wind design (2:1 otherwise)
     ASCE 7-16 §2.4.1 / §2.4.5   0.6W, 0.7E, 0.6D
     NDS 2018 §3.7.1  column stability, Table 12E (bolts to concrete), Table 12N (nails)

   Inputs are STRENGTH-level level forces.  The engine applies 0.6W / 0.7E / 0.6D.
   ========================================================================== */
(function (root) {
  'use strict';

  // ── numeric helpers ────────────────────────────────────────────────────────
  function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : (dflt === undefined ? NaN : dflt); }
  function near(a, b, tol) { return isFinite(a) && Math.abs(a - b) <= tol; }
  function f1(v) { return isFinite(v) ? v.toFixed(1) : 'n/a'; }
  function f2(v) { return isFinite(v) ? v.toFixed(2) : 'n/a'; }
  function f3(v) { return isFinite(v) ? v.toFixed(3) : 'n/a'; }
  function f4(v) { return isFinite(v) ? v.toFixed(4) : 'n/a'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var ENGINE = { name: 'stacked-shearwall', version: 2, codes: ['SDPWS 2021', 'NDS 2018', 'ASCE 7-16'] };

  // ── load factors, ASCE 7-16 §2.4.1 (0.6W) / §2.4.5 (0.7E) / 0.6D ──────────
  var LOAD = {
    wind:    { key: 'wind',    label: 'Wind',    factor: 0.6, asdDiv: 2.0, ref: 'ASCE 7-16 §2.4.1 (0.6W); SDPWS §4.1.4.2' },
    seismic: { key: 'seismic', label: 'Seismic', factor: 0.7, asdDiv: 2.8, ref: 'ASCE 7-16 §2.4.5 (0.7E); SDPWS §4.1.4.1' }
  };
  var DEAD_FACTOR = 0.6;   // 0.6D resisting, ASCE 7-16 §2.4.1 combination 7

  // ── framing species ────────────────────────────────────────────────────────
  // G from NDS 2018 Table 12.3.3A; F_c / E_min from NDS Supplement Table 4A / 4B, No. 2.
  var SPECIES = {
    DFL: { id: 'DFL', label: 'Douglas Fir-Larch', G: 0.50, Emin: 580000, Fc: { '2x4': 1350, '2x6': 1350, '2x8': 1350, '2x10': 1350, '2x12': 1350, '4x4': 1350, '4x6': 1350, '4x8': 1350, '6x6': 1350 }, sizeFactor: true, table: 'NDS Table 4A (No. 2)' },
    SP:  { id: 'SP',  label: 'Southern Pine',     G: 0.55, Emin: 580000, Fc: { '2x4': 1450, '2x6': 1400, '2x8': 1350, '2x10': 1300, '2x12': 1250, '4x4': 1450, '4x6': 1400, '4x8': 1350, '6x6': 1400 }, sizeFactor: false, table: 'NDS Table 4B (No. 2, size factors incorporated)' },
    SPF: { id: 'SPF', label: 'Spruce-Pine-Fir',   G: 0.42, Emin: 510000, Fc: { '2x4': 1150, '2x6': 1150, '2x8': 1150, '2x10': 1150, '2x12': 1150, '4x4': 1150, '4x6': 1150, '4x8': 1150, '6x6': 1150 }, sizeFactor: true, table: 'NDS Table 4A (No. 2)' }
  };
  // NDS Supplement Table 4A size factor C_F for F_c (dimension lumber, 2" thick).
  var CF_FC = { '2x4': 1.15, '2x6': 1.10, '2x8': 1.05, '2x10': 1.00, '2x12': 0.90 };
  // Actual dressed dimensions: thickness (parallel to hold-down screws) x width.
  var POST_SIZES = {
    '2x4': { t: 1.5, d: 3.5 }, '2x6': { t: 1.5, d: 5.5 }, '2x8': { t: 1.5, d: 7.25 },
    '2x10': { t: 1.5, d: 9.25 }, '2x12': { t: 1.5, d: 11.25 },
    '4x4': { t: 3.5, d: 3.5 }, '4x6': { t: 3.5, d: 5.5 }, '4x8': { t: 3.5, d: 7.25 },
    '6x6': { t: 5.5, d: 5.5 }
  };

  // ── ASCE 7-16 Table 12.2-1 seismic force-resisting systems offered ─────────
  var SFRS = {
    'A.15': { id: 'A.15', label: 'A.15 Bearing wall — light-frame (wood) walls sheathed with wood structural panels rated for shear resistance', R: 6.5, wsp: true, limits: { D: null, E: null, F: null } },
    'A.17': { id: 'A.17', label: 'A.17 Bearing wall — light-frame walls with shear panels of all other materials', R: 2.0, wsp: false, limits: { D: 35, E: 'NP', F: 'NP' } },
    'B.22': { id: 'B.22', label: 'B.22 Building frame — light-frame (wood) walls sheathed with wood structural panels rated for shear resistance', R: 7.0, wsp: true, limits: { D: null, E: null, F: null } },
    'B.24': { id: 'B.24', label: 'B.24 Building frame — light-frame walls with shear panels of all other materials', R: 2.5, wsp: false, limits: { D: 35, E: 'NP', F: 'NP' } }
  };

  // ── sheathing, NOMINAL unit shear capacity (plf) ───────────────────────────
  // SDPWS 2021 Table 4.3A, "Sheathing" grade wood structural panel, blocked,
  // 2" nominal framing, nails at the stated panel-edge spacing.
  // SDPWS 2021 Table 4.3C, 5/8" gypsum wallboard, blocked, 16" stud spacing.
  var SHEATHING = [
    { id: 'wsp716_8d_6',    type: 'wsp', thickness: '7/16', nail: '8d common',  spacing: 6, vn: 670,  table: 'Table 4.3A' },
    { id: 'wsp716_8d_4',    type: 'wsp', thickness: '7/16', nail: '8d common',  spacing: 4, vn: 980,  table: 'Table 4.3A' },
    { id: 'wsp716_8d_3',    type: 'wsp', thickness: '7/16', nail: '8d common',  spacing: 3, vn: 1260, table: 'Table 4.3A' },
    { id: 'wsp1532_10d_6',  type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 6, vn: 870,  table: 'Table 4.3A' },
    { id: 'wsp1532_10d_4',  type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4, vn: 1290, table: 'Table 4.3A' },
    { id: 'wsp1532_10d_3',  type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 3, vn: 1680, table: 'Table 4.3A' },
    { id: 'gyp58_6d_7',     type: 'gyp', thickness: '5/8',  nail: '6d cooler',  spacing: 7, vn: 290,  table: 'Table 4.3C' },
    { id: 'gyp58_6d_4',     type: 'gyp', thickness: '5/8',  nail: '6d cooler',  spacing: 4, vn: 350,  table: 'Table 4.3C' }
  ];
  function sheathingLabel(o) { return o.thickness + '" ' + (o.type === 'gyp' ? 'gypsum wallboard' : 'WSP sheathing') + ', ' + o.nail + ' @ ' + o.spacing + '" o.c.'; }
  function findSheathing(face) {
    if (!face) return null;
    for (var i = 0; i < SHEATHING.length; i++) {
      var s = SHEATHING[i];
      if (face.id && face.id === s.id) return s;
      if (!face.id && s.type === face.type && s.thickness === String(face.thickness) &&
          s.nail === face.nail && num(face.spacing) === s.spacing) return s;
    }
    return null;
  }

  // ── hold-downs, Simpson C-C-2026 p. 61, "Allowable Tension Loads (160)" ──
  // Allowable tension is tabulated against the minimum WOOD MEMBER SIZE, thickness
  // × width — thickness is the dimension parallel to the SDS screws, i.e. the
  // built-up thickness of the end post. The catalog carries a DF/SP column and an
  // SPF/HF column: DFL and SP read DF/SP, SPF reads SPF/HF (`bySpecies`). The
  // DF/SP column is identical to ICC-ES ESR-2330 Table 2B (ESR not on disk):
  // the 3 / 3.5 / 4.5 / 5.5 / 7.25 thickness steps apply at footnote 6's minimum
  // member WIDTH of 3½"; the "5.5(7)" column carries a higher value at the same
  // thickness but requires footnote 7's 5½" minimum width (6x6 nominal) — that is
  // `wideStep`. Each species entry is { steps: [{ t, T }], wideStep?: { t, w, T } }.
  // Catalog fn. 3 (hi-strength anchor rod) is printed on the DF/SP cells 7,015
  // and 17,685 only; the ESR-2330 rod notes are kept on the row regardless.
  var HD_COLUMN = { DFL: 'DF/SP', SP: 'DF/SP', SPF: 'SPF/HF' };   // catalog column read by each framing species
  function hdCols(dfsp, spf) { return { DFL: dfsp, SP: dfsp, SPF: spf }; }
  var HOLDOWNS = [
    { name: 'HDUE3-SDS3',    sds: '7 — SDS ¼×3',   rod: '⅝"',        minWidth: 3.5, note: '',
      bySpecies: hdCols({ steps: [{ t: 3.0, T: 3790 }] }, { steps: [{ t: 3.0, T: 3340 }] }) },
    { name: 'HDUE5-SDS3',    sds: '10 — SDS ¼×3',  rod: '⅝"',        minWidth: 3.5, note: '',
      bySpecies: hdCols({ steps: [{ t: 3.0, T: 5375 }] }, { steps: [{ t: 3.0, T: 4700 }] }) },
    { name: 'HDUE7-SDS3',    sds: '13 — SDS ¼×3',  rod: '⅝" hi-str', minWidth: 3.5, note: 'High-strength anchor rod required (ESR-2330 Table 2B fn. 11; C-C-2026 p. 61 fn. 3 on the DF/SP value)',
      bySpecies: hdCols({ steps: [{ t: 3.0, T: 7015 }] }, { steps: [{ t: 3.0, T: 6030 }] }) },
    { name: 'HDUE9-SDS3.5',  sds: '16 — SDS ¼×3½', rod: '⅞"',        minWidth: 3.5, note: 'No 3" thickness column; DF/SP 8,425 lb at 3½", 9,390 lb at member thickness ≥ 4½" (SPF/HF 7,305 / 7,995 lb)',
      bySpecies: hdCols({ steps: [{ t: 3.5, T: 8425 }, { t: 4.5, T: 9390 }] }, { steps: [{ t: 3.5, T: 7305 }, { t: 4.5, T: 7995 }] }) },
    { name: 'HDUE13-SDS3.5', sds: '23 — SDS ¼×3½', rod: '1"',        minWidth: 3.5, note: 'Heavy hex anchor nut required (C-C-2026 p. 61 fn. 4; ESR-2330 fn. 10, not on disk); DF/SP 11,900 lb at 5½" thickness, 12,950 lb at 7¼", 13,110 lb on a 6×6 (5½ × 5½ member size, C-C-2026 p. 61; ESR-2330 fn. 7); SPF/HF 10,215 / 11,030 / 10,980 lb',
      bySpecies: hdCols({ steps: [{ t: 5.5, T: 11900 }, { t: 7.25, T: 12950 }], wideStep: { t: 5.5, w: 5.5, T: 13110 } },
                        { steps: [{ t: 5.5, T: 10215 }, { t: 7.25, T: 11030 }], wideStep: { t: 5.5, w: 5.5, T: 10980 } }) },
    { name: 'HDUE17-SDS4.5', sds: '28 — SDS ¼×4½', rod: '1" hi-str', minWidth: 3.5, note: 'DF/SP 16,040 lb at 5½" or 7¼" thickness, 17,685 lb on a 6×6 (5½ × 5½ member size, C-C-2026 p. 61; ESR-2330 fn. 7) with a high-strength anchor rod (C-C-2026 p. 61 fn. 3; ESR-2330 fn. 11); SPF/HF 13,545 / 14,775 lb',
      bySpecies: hdCols({ steps: [{ t: 5.5, T: 16040 }], wideStep: { t: 5.5, w: 5.5, T: 17685 } },
                        { steps: [{ t: 5.5, T: 13545 }], wideStep: { t: 5.5, w: 5.5, T: 14775 } }) }
  ];
  // Allowable tension for a given end-post thickness, width and framing species,
  // or 0 if the catalog has no column for the species, or the post does not reach
  // the lowest tabulated thickness / footnote 6's minimum width.
  function holdownCapacity(hd, thk, width, speciesId) {
    var col = hd.bySpecies[speciesId];
    if (!col) return 0;
    if (isFinite(width) && width + 1e-9 < hd.minWidth) return 0;
    var cap = 0;
    for (var i = 0; i < col.steps.length; i++) if (thk + 1e-9 >= col.steps[i].t) cap = col.steps[i].T;
    // "5.5(7)" column — same thickness, higher value, 6x6 minimum width.
    var ws = col.wideStep;
    if (ws && thk + 1e-9 >= ws.t && isFinite(width) && width + 1e-9 >= ws.w) cap = Math.max(cap, ws.T);
    return cap;
  }
  // True when at least one HDUE row carries a value for the species.
  function holdownSpeciesCovered(speciesId) {
    for (var i = 0; i < HOLDOWNS.length; i++) if (HOLDOWNS[i].bySpecies[speciesId]) return true;
    return false;
  }

  // ── coil straps, Simpson ESR-2105 Table 4 (C_D = 1.6 included) ─────────────
  // Nail counts are the TOTAL for the splice, half into each member (fn. 1).
  var STRAPS = [
    { name: 'CMSTC16', Tall: 4690, nails: '50 — 16d sinker total (25 each side)',        esr: 'ESR-2105 Table 4' },
    { name: 'CMST14',  Tall: 6475, nails: '56 — 16d×2½ common total (28 each side)', esr: 'ESR-2105 Table 4' },
    { name: 'CMST12',  Tall: 9215, nails: '74 — 16d×2½ common total (37 each side)', esr: 'ESR-2105 Table 4' }
  ];
  var STRAP_MIN_G = 0.50;   // ESR-2105: minimum member specific gravity 0.50

  // ── sill / bottom-plate shear connectors, per connector at C_D = 1.6 ───────
  // `bySillSpecies` is keyed by the SILL species, except rows flagged `minG`
  // (`16d`, `sds14`), which the engine reads at the LOWER-G of sill and framing
  // species — `minGWhy` says why; computeWall prints which governed.
  var SILL_CONN = [
    { id: 'ltp4', label: 'LTP4 lateral tie plate', defaultSpacing: 16, base: false, sheathingReduction: true,
      bySillSpecies: { DFL: 715, SP: 715, SPF: 615 },
      basis: 'Simpson C-C-2026 p. 310, LTP4 with 12 — 0.131×1½ nails, direction G, "(160)" column: 715 lb DF/SP, 615 lb SPF/HF' },
    { id: '16d', label: '16d common nails', defaultSpacing: 16, base: false,
      minG: true, minGWhy: 'NDS Table 12N is for both members of identical specific gravity',
      bySillSpecies: { DFL: 226, SP: 246, SPF: 192 },
      basis: 'NDS 2018 Table 12N, 16d common (D = 0.162", Table L4), t_s = 1½": Z = 141 lb (G = 0.50 DF-L) / 154 lb (G = 0.55 SP) / 120 lb (G = 0.42 SPF) × C_D 1.6; the lower G of sill and framing species is used' },
    { id: 'sds14', label: 'SDS ¼×4½ screws', defaultSpacing: 12, base: false,
      minG: true, minGWhy: 'the Simpson sole-to-rim table gives the SPF/HF value where either member is SPF/HF',
      bySillSpecies: { DFL: 400, SP: 400, SPF: 304 },
      basis: 'Simpson sole-to-rim table: 250 lb DF/SP-to-DF/SP, 190 lb where either member (sill or framing) is SPF/HF, × C_D 1.6' },
    { id: 'ab12', label: '½" anchor bolt', defaultSpacing: 20, base: true,
      bySillSpecies: { DFL: 1040, SP: 1040, SPF: 944 },
      basis: 'NDS 2018 Table 12E, 1½" sill to concrete, 6" embedment, Z∥ = 650 lb (G = 0.50) / 590 lb (G = 0.42) × C_D 1.6' },
    { id: 'ab58', label: '⅝" anchor bolt', defaultSpacing: 20, base: true,
      bySillSpecies: { DFL: 1488, SP: 1488, SPF: 1360 },
      basis: 'NDS 2018 Table 12E, 1½" sill to concrete, 6" embedment, Z∥ = 930 lb (G = 0.50) / 850 lb (G = 0.42) × C_D 1.6' }
  ];
  // Simpson C-C-2026 p. 310 fn. 3: 0.72x over 3/8" WSP, 0.64x over 1/2" WSP.
  var LTP4_SHEATHING = { none: { f: 1.00, label: 'nailed direct to framing' }, '0.375': { f: 0.72, label: 'over ⅜" sheathing' }, '0.5': { f: 0.64, label: 'over ½" sheathing' } };

  function findSill(id) { for (var i = 0; i < SILL_CONN.length; i++) if (SILL_CONN[i].id === id) return SILL_CONN[i]; return null; }

  // =========================================================================
  // Geometry — Sigma b_i (§4.3.3.4) and C_o (§4.3.5.6)
  // =========================================================================
  // Per segment: h/b > 3.5 excluded; 2 < h/b <= 3.5 multiplied by 2b/h; else full.
  function sumBi(segments, h) {
    var rows = [], sum = 0, raw = 0;
    (segments || []).forEach(function (b0) {
      var b = num(b0, 0), hb = b > 0 ? h / b : Infinity, bEff, rule;
      if (!(b > 0)) { bEff = 0; rule = 'ignored, b = 0'; }
      else if (hb > 3.5 + 1e-9) { bEff = 0; rule = 'excluded, h/b > 3.5'; }
      else if (hb > 2 + 1e-9) { bEff = b * (2 * b / h); rule = '× 2b/h'; }
      else { bEff = b; rule = 'full'; }
      sum += bEff; raw += Math.max(b, 0);
      rows.push({ b: b, hOverB: hb, bEff: bEff, rule: rule });
    });
    return { segments: rows, sumBi: sum, sumBiRaw: raw };
  }

  // A_o = sum(width x max(clear height, h/3)) + unsheathed areas (§4.3.2.3(9) exc.)
  function openingArea(openings, h, unsheathed) {
    var Ao = num(unsheathed, 0) || 0, rows = [];
    (openings || []).forEach(function (o) {
      var w = num(o.w_ft, 0), hc = num(o.hc_ft, 0), hEff = Math.max(hc, h / 3), a = w * hEff;
      Ao += a;
      rows.push({ w: w, hc: hc, hEff: hEff, area: a, floored: hEff > hc + 1e-9 });
    });
    return { Ao: Ao, rows: rows, unsheathed: num(unsheathed, 0) || 0 };
  }

  // C_o = min(1, [r/(3-2r)] x (L / Sigma b_i,unreduced)), r = 1/(1 + A_o/A_fhs).
  // A_fhs = h x Sigma of the UNREDUCED full-height sheathing widths (Eq. 4.3-6).
  function calcCo(L, sumBiRaw, Ao, h) {
    if (!(L > 0) || !(sumBiRaw > 0) || !(h > 0)) return NaN;
    var Afhs = h * sumBiRaw;
    var r = 1 / (1 + Ao / Afhs);
    return Math.min(1, (r / (3 - 2 * r)) * (L / sumBiRaw));
  }
  function calcR(sumBiRaw, Ao, h) {
    if (!(sumBiRaw > 0) || !(h > 0)) return NaN;
    return 1 / (1 + Ao / (h * sumBiRaw));
  }

  // =========================================================================
  // Story forces — §4.3.6.4.4 sums FORCES, then converts once per story
  // =========================================================================
  // floors are ordered top -> bottom.  P_j is the incremental strength-level
  // force delivered at level j.  V_k = factor * sum_{j<=k} P_j.
  // M_k = factor * sum_{j<=k} P_j * z_{j,k}, z = sum of story heights j..k.
  // When wallId is given, P_j is that wall line's own P_wind_lb / P_seis_lb at
  // level j where it is a finite number (src 'wall'); otherwise the level force
  // (src 'level').  A wall absent at level j contributes nothing: `present`
  // defaults to wallPresence(floors, wallId) so the export is safe standalone.
  function storyForces(floors, caseKey, present, wallId) {
    if (wallId != null && !present) present = wallPresence(floors, wallId);
    var lc = LOAD[caseKey], out = [], fld = caseKey === 'wind' ? 'P_wind_lb' : 'P_seis_lb';
    for (var k = 0; k < floors.length; k++) {
      var V = 0, M = 0, rows = [];
      for (var j = 0; j <= k; j++) {
        if (present && !present(j)) continue;
        var wj = wallId != null ? wallAt(floors, j, wallId) : null;
        var Pw = wj ? num(wj[fld], NaN) : NaN;
        var src = isFinite(Pw) ? 'wall' : 'level';
        var P = src === 'wall' ? Pw : (num(floors[j][fld], 0) || 0);
        var z = 0;
        for (var i = j; i <= k; i++) z += num(floors[i].h_ft, 0) || 0;
        V += P; M += P * z;
        rows.push({ level: floors[j].name, P: P, Pfac: lc.factor * P, z: z, m: lc.factor * P * z, src: src });
      }
      out.push({ Pstrength: V, V: lc.factor * V, M: lc.factor * M, Mstrength: M, rows: rows, factor: lc.factor });
    }
    return out;
  }

  // =========================================================================
  // Chord force — §4.3.6.1.3, Eq. 4.3-8 form
  // =========================================================================
  // T = max(0, (M - 0.6 M_R) / (C_o Sigma b_i)).  M_R is taken about the
  // compression toe: a uniform dead load contributes w L^2/2 in both directions,
  // a point dead load at the chord contributes P L when that chord is the tension
  // end and 0 when it is the compression end.
  function chordForce(M, MR, lever) {
    if (!(lever > 0)) return { T: NaN, Traw: NaN, lever: lever };
    var Traw = (M - DEAD_FACTOR * MR) / lever;
    return { T: Math.max(0, Traw), Traw: Traw, lever: lever };
  }

  // =========================================================================
  // Sheathing capacity — nominal per face, then combined, then ASD
  // =========================================================================
  // face: {type, thickness, nail, spacing} (or {id}).  Returns nominal plf.
  function sheathingCapacity(face, opts) {
    opts = opts || {};
    var s = findSheathing(face);
    if (!s) return { ok: false, error: 'Unknown sheathing option: ' + JSON.stringify(face) };
    var factors = [], vn = s.vn;
    // Table 4.3A fn. 3 — specific gravity adjustment, wood structural panels only.
    var sg = 1;
    if (s.type === 'wsp') {
      var G = opts.G;
      if (isFinite(G)) sg = Math.min(1, 1 - (0.5 - G));
      if (sg !== 1) factors.push({ f: sg, why: 'Specific gravity adjustment [1 − (0.5 − G)] = ' + f2(sg) + ' for G = ' + f2(G) + ' (Table 4.3A fn. 3)' });
    }
    vn *= sg;
    // Table 4.3A fn. 10 — 10d common nails with the hold-down on the inside face.
    var fn10 = 1;
    if (s.nail === '10d common' && opts.insideFaceHoldown) {
      fn10 = 0.92;
      factors.push({ f: 0.92, why: '10d common nails with the hold-down attached to the inside face of the end post — × 0.92 (Table 4.3A fn. 10)' });
    }
    vn *= fn10;
    return { ok: true, opt: s, label: sheathingLabel(s), vnTable: s.vn, sg: sg, fn10: fn10, vn: vn, factors: factors };
  }

  // Combine the two faces for one design case.  Returns {vn, rule, ref}.
  function combineFaces(f1cap, f2cap, caseKey) {
    if (!f2cap) return { vn: f1cap.vn, rule: 'single-sided', ref: 'SDPWS §4.3.5.2' };
    var same = f1cap.opt.id === f2cap.opt.id;
    if (same) return { vn: 2 * f1cap.vn, rule: 'similar sheathing both faces — 2 × one face', ref: 'SDPWS §4.3.5.4.1' };
    var mixWspGyp = (f1cap.opt.type === 'wsp' && f2cap.opt.type === 'gyp') || (f1cap.opt.type === 'gyp' && f2cap.opt.type === 'wsp');
    if (mixWspGyp && caseKey === 'wind') {
      return { vn: f1cap.vn + f2cap.vn, rule: 'wind: WSP + gypsum — sum of both faces', ref: 'SDPWS §4.3.5.4.2 Exception' };
    }
    var lo = Math.min(f1cap.vn, f2cap.vn), hi = Math.max(f1cap.vn, f2cap.vn);
    return { vn: Math.max(2 * lo, hi), rule: 'dissimilar sheathing — greater of 2 × smaller (' + f1(2 * lo) + ') and larger (' + f1(hi) + ')', ref: 'SDPWS §4.3.5.4.2' };
  }

  // =========================================================================
  // End post — NDS 2018 §3.7.1
  // =========================================================================
  // `post` is {n, size}; ids are validated by validate() before compute() runs,
  // so a bad id here means the function was called directly. Refuse rather than
  // silently fall back to DF-L 2x6 and return a plausible but wrong F'_c.
  function endPostCheck(post, speciesId, h_ft, C_lb) {
    var sp = SPECIES[speciesId];
    if (!sp) throw new Error('endPostCheck: unknown species id "' + speciesId + '" (expected ' + Object.keys(SPECIES).join(', ') + ')');
    var size = post && post.size;
    var dim = POST_SIZES[size];
    if (!dim) throw new Error('endPostCheck: unknown end post size "' + size + '" (expected ' + Object.keys(POST_SIZES).join(', ') + ')');
    var n = Math.max(1, Math.round(num(post && post.n, 2) || 2));
    var thk = n * dim.t, width = dim.d;
    var A = thk * width;
    var Fc = sp.Fc[size] || sp.Fc['2x6'];
    var CD = 1.6;
    var CF = sp.sizeFactor && CF_FC[size] ? CF_FC[size] : 1.0;
    var FcStar = Fc * CD * CF;
    // Strong axis (in the plane of the wall, depth = width) unbraced over the story
    // height; weak axis (out of plane, depth = built-up thickness) braced at 48 in.
    var le1 = (num(h_ft, 0) || 0) * 12, le2 = 48;
    var s1 = width > 0 ? le1 / width : Infinity, s2 = thk > 0 ? le2 / thk : Infinity;
    var slend = Math.max(s1, s2), dGov = s1 >= s2 ? width : thk, leGov = s1 >= s2 ? le1 : le2;
    // NDS 2018 Eq. 3.7-1: F_cE = 0.822 E'_min/(l_e/d)^2. The 0.822 is K_cE for
    // visually graded sawn lumber (NDS §3.7.1.5 / Appendix H).
    var FcE = slend > 0 ? 0.822 * sp.Emin / (slend * slend) : Infinity;
    // c = 0.8 for sawn lumber (NDS §3.7.1.5); 0.85 for round poles and 0.9 for
    // glulam and structural composite lumber, neither of which is offered here.
    var c = 0.8, ratio = FcE / FcStar;
    var CP = (1 + ratio) / (2 * c) - Math.sqrt(Math.pow((1 + ratio) / (2 * c), 2) - ratio / c);
    var FcPrime = FcStar * CP;
    var fc = A > 0 ? C_lb / A : Infinity;
    return {
      size: size, n: n, label: '(' + n + ') ' + size, thk: thk, width: width, A: A,
      Fc: Fc, CD: CD, CF: CF, FcStar: FcStar, Emin: sp.Emin, le1: le1, le2: le2,
      slend: slend, leGov: leGov, dGov: dGov, FcE: FcE, CP: CP, FcPrime: FcPrime,
      fc: fc, dc: FcPrime > 0 ? fc / FcPrime : Infinity, speciesTable: sp.table,
      slendOK: slend <= 50
    };
  }

  // =========================================================================
  // Validation
  // =========================================================================
  // The single wording for a legacy record, shared by validate(), the page's
  // JSON import and the AREv2 adapter's setModel so the three cannot drift.
  var V1_REFUSAL = 'This record was saved by engine v1 and cannot be reused; re-enter the wall';

  function validate(state) {
    var errors = [], warnings = [];
    if (!state || typeof state !== 'object') { return { ok: false, errors: ['No model supplied.'], warnings: warnings }; }
    if (num(state.version, 0) !== 2) {
      return { ok: false, errors: [V1_REFUSAL], warnings: warnings };
    }
    var floors = state.floors;
    if (!Array.isArray(floors) || !floors.length) { return { ok: false, errors: ['Model contains no levels.'], warnings: warnings }; }
    if (!SFRS[state.sfrs]) warnings.push('Unknown SFRS "' + state.sfrs + '" — ASCE 7-16 Table 12.2-1 system limits not checked.');
    if (!SPECIES[state.species]) errors.push('Unknown framing species "' + state.species + '".');

    // Wall-line continuity by id (§4.3.6.4.4 load path).
    var seen = {};
    floors.forEach(function (fl, fi) {
      (fl.walls || []).forEach(function (w) { (seen[w.id] = seen[w.id] || []).push(fi); });
    });
    Object.keys(seen).forEach(function (id) {
      var idx = seen[id], lo = Math.min.apply(null, idx), hi = Math.max.apply(null, idx);
      if (hi - lo + 1 === idx.length) return;
      var missing = [], declared = true;
      for (var i = lo; i <= hi; i++) {
        if (idx.indexOf(i) >= 0) continue;
        missing.push(floors[i].name || ('level ' + i));
        // Allowed only where the wall at the first level BELOW the gap declares
        // transfer:true — that is the wall receiving the discontinuous load path.
        var below = null;
        for (var j = i + 1; j <= hi; j++) {
          var wl = (floors[j].walls || []).filter(function (x) { return x.id === id; })[0];
          if (wl) { below = wl; break; }
        }
        if (!(below && below.transfer === true)) declared = false;
      }
      if (!declared) {
        errors.push('Wall line "' + id + '" is missing at ' + missing.join(', ') +
          ' but present above and below. Add the wall at that level, or set transfer = true on the wall below the gap to declare a discontinuous load path (SDPWS §4.3.6.4.4).');
      } else {
        warnings.push('Wall line "' + id + '" is discontinuous at ' + missing.join(', ') + ' — transfer = true declared; the transfer element is outside the scope of this calculation.');
      }
    });

    floors.forEach(function (fl, fi) {
      var h = num(fl.h_ft, 0);
      var where = (fl.name || 'Level ' + (fi + 1));
      if (!(h > 0)) errors.push(where + ': wall height must be greater than zero.');
      if (h > 20 + 1e-9) errors.push(where + ': perforated shear wall height h = ' + f1(h) + ' ft exceeds the 20 ft limit of SDPWS §4.3.2.3(8).');
      if (!isFinite(num(fl.P_wind_lb, 0)) || !isFinite(num(fl.P_seis_lb, 0))) errors.push(where + ': level forces must be numbers.');
      (fl.walls || []).forEach(function (w) {
        var tag = where + ' / ' + (w.label || w.id);
        var L = num(w.L_ft, 0);
        if (!(L > 0)) errors.push(tag + ': wall length L must be greater than zero.');
        // Optional line-force override: null / undefined / '' inherit the level
        // force; anything else must be a finite number >= 0.
        ['P_wind_lb', 'P_seis_lb'].forEach(function (fld) {
          var pv = w[fld];
          if (pv === null || pv === undefined || pv === '') return;
          var pn = num(pv, NaN);
          if (!isFinite(pn) || pn < 0) errors.push(tag + ': wall-line forces must be numbers ≥ 0 (leave blank to use the level force).');
        });
        var segs = (w.segments_ft || []).map(function (x) { return num(x, 0); });
        // A negative width would otherwise be clamped to zero in sumBi() and in
        // the Σ-vs-L check and pass silently; refuse it the way an opening is.
        segs.forEach(function (b) {
          if (!(b > 0)) errors.push(tag + ': full-height segment width b_i = ' + f2(b) + ' ft must be greater than zero.');
        });
        var segSum = segs.reduce(function (a, b) { return a + Math.max(b, 0); }, 0);
        if (!(segSum > 0)) errors.push(tag + ': at least one full-height perforated shear wall segment is required (Σb_i = 0).');
        var sb = sumBi(segs, h);
        if (segSum > 0 && !(sb.sumBi > 0)) errors.push(tag + ': every segment has h/b > 3.5 and is excluded by SDPWS §4.3.3.4 — Σb_i = 0.');
        var opW = 0;
        (w.openings || []).forEach(function (o) {
          var ow = num(o.w_ft, 0), oh = num(o.hc_ft, 0);
          opW += Math.max(ow, 0);
          if (!(ow > 0)) errors.push(tag + ': opening width must be greater than zero.');
          if (oh > h + 1e-9) errors.push(tag + ': clear opening height ' + f2(oh) + ' ft exceeds the wall height ' + f2(h) + ' ft.');
        });
        if (segSum + opW > L + 1e-6) errors.push(tag + ': Σ segments (' + f2(segSum) + ' ft) + Σ opening widths (' + f2(opW) + ' ft) = ' + f2(segSum + opW) + ' ft exceeds L = ' + f2(L) + ' ft.');
        // A negative unsheathed area would reduce A_o and raise C_o — refuse it
        // rather than let openingArea() add it straight into the total.
        var unsh = num(w.unsheathed_ft2, 0);
        if (isFinite(unsh) && unsh < 0) errors.push(tag + ': unsheathed area ' + f2(unsh) + ' ft² cannot be negative (SDPWS §4.3.2.3(9) Exception adds to A_o).');
        if (!w.sheathing || !w.sheathing.face1) errors.push(tag + ': face 1 sheathing is required.');
        else {
          var s1 = findSheathing(w.sheathing.face1);
          if (!s1) errors.push(tag + ': unknown face 1 sheathing option.');
          else if (s1.type !== 'wsp') errors.push(tag + ': a perforated shear wall must be sheathed with wood structural panel sheathing (SDPWS §4.3.2.3). Gypsum is permitted only as the opposite face.');
          if (w.sheathing.face2) {
            var s2 = findSheathing(w.sheathing.face2);
            if (!s2) errors.push(tag + ': unknown face 2 sheathing option.');
          }
        }
        var sc = findSill(w.sill && w.sill.conn);
        if (!sc) errors.push(tag + ': unknown sill connector id "' + (w.sill && w.sill.conn) + '".');
        else {
          var isBase = fi === floors.length - 1;
          if (sc.base && !isBase) errors.push(tag + ': ' + sc.label + ' is a foundation connector and may only be used at the base level.');
          if (!sc.base && isBase) errors.push(tag + ': ' + sc.label + ' cannot anchor a sill plate to the foundation — use an anchor bolt at the base level.');
        }
        if (!(num(w.sill && w.sill.spacing_in, 0) > 0)) errors.push(tag + ': sill connector spacing must be greater than zero.');
        if (w.holdown === 'strap') {
          if (fi === floors.length - 1) errors.push(tag + ': coil straps are floor-to-floor only; the base level requires an HDUE hold-down to the foundation.');
          var G = (SPECIES[state.species] || SPECIES.DFL).G;
          if (G + 1e-9 < STRAP_MIN_G) errors.push(tag + ': coil straps require framing with specific gravity ≥ 0.50 (ESR-2105); ' + (SPECIES[state.species] || SPECIES.DFL).label + ' has G = ' + f2(G) + '.');
        } else if (SPECIES[state.species] && !holdownSpeciesCovered(state.species)) {
          // Unreachable with the C-C-2026 table (every row carries DF/SP and SPF/HF); kept for a species without a catalog column.
          errors.push(tag + ': no HDUE hold-down value is on file for ' + SPECIES[state.species].label + ' framing — supply the Simpson catalog column for that species or change the framing species.');
        }
        if (!POST_SIZES[w.endPost && w.endPost.size]) errors.push(tag + ': unknown end post size "' + (w.endPost && w.endPost.size) + '".');
      });
    });
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  // =========================================================================
  // compute
  // =========================================================================
  function compute(state) {
    var v = validate(state);
    var res = {
      ok: v.ok, errors: v.errors.slice(), warnings: v.warnings.slice(), notes: [],
      engine: ENGINE, sfrs: SFRS[state && state.sfrs] || null, sdc: state && state.sdc,
      species: SPECIES[state && state.species] || null, floors: []
    };
    if (!v.ok) return res;

    var floors = state.floors, n = floors.length;
    var sp = SPECIES[state.species], sdc = String(state.sdc || 'D').toUpperCase();
    var sfrs = SFRS[state.sfrs];
    var gypBlockedBySDC = (sdc === 'E' || sdc === 'F');

    res.notes.push('Level forces are STRENGTH level. The engine applies 0.6W (ASCE 7-16 §2.4.1), 0.7E (§2.4.5) and 0.6D for the resisting moment.');
    res.notes.push('Story shear is accumulated as FORCE and converted once at each story with that story’s C_o·Σb_i (SDPWS §4.3.6.4.4, §4.3.6.4.1.1).');
    // Only when the feature is in use, so an untouched model prints no note about it.
    var anyLineForce = floors.some(function (fl) {
      return (fl.walls || []).some(function (w) { return isFinite(num(w.P_wind_lb, NaN)) || isFinite(num(w.P_seis_lb, NaN)); });
    });
    if (anyLineForce) res.notes.push('Wall-line forces, where entered, replace the level force for that line.');
    res.notes.push('Perforated shear wall method assumed: a perforated shear wall segment is present at each end of every wall line (§4.3.2.3(2)); top-of-wall and bottom-of-wall elevations are uniform (§4.3.2.3(7)); collectors run the full length of the wall (§4.3.2.3(6)); sheathed areas that are not the tabulated assembly are counted in A_o (§4.3.2.3(9) Exception).');
    if (sfrs && !sfrs.wsp) res.warnings.push('SFRS ' + sfrs.id + ' is "shear panels of all other materials" — ASCE 7-16 Table 12.2-1 limits it to 35 ft in SDC D and does not permit it in SDC E or F. The wood structural panel systems are A.15 / B.22.');
    if (sfrs && !sfrs.wsp && (sdc === 'E' || sdc === 'F')) res.errors.push('SFRS ' + sfrs.id + ' is not permitted in SDC ' + sdc + ' (ASCE 7-16 Table 12.2-1). Select A.15 or B.22.');

    // Story forces are built per wall line inside computeWall(), because a wall
    // may start part way down the stack and only the levels where it exists
    // contribute to its story shear.
    for (var k = 0; k < n; k++) {
      var fl = floors[k], h = num(fl.h_ft, 0);
      var fr = {
        index: k, id: fl.id, name: fl.name, h_ft: h, base: k === n - 1,
        levelLabel: k === n - 1 ? 'Base level (foundation)' : fl.name,
        P_wind_lb: num(fl.P_wind_lb, 0) || 0, P_seis_lb: num(fl.P_seis_lb, 0) || 0, walls: []
      };
      for (var wi = 0; wi < (fl.walls || []).length; wi++) {
        var wres = computeWall(state, floors, k, wi, { sp: sp, sdc: sdc, gypBlockedBySDC: gypBlockedBySDC, res: res });
        // Wall-level code violations are model errors, not advisory notes.
        wres.errors.forEach(function (e) { res.errors.push(fr.name + ' / ' + wres.label + ': ' + e); });
        fr.walls.push(wres);
      }
      res.floors.push(fr);
    }
    res.ok = res.errors.length === 0;
    return res;
  }

  function wallPresence(floors, id) {
    return function (j) { return (floors[j].walls || []).some(function (w) { return w.id === id; }); };
  }
  function wallAt(floors, j, id) {
    var list = floors[j].walls || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function computeWall(state, floors, k, wi, ctx) {
    var n = floors.length, fl = floors[k], w = fl.walls[wi], h = num(fl.h_ft, 0);
    var isBase = k === n - 1;
    var out = { id: w.id, label: w.label || w.id, L_ft: num(w.L_ft, 0), h_ft: h, base: isBase, messages: [], errors: [], checks: [] };

    // ── geometry ────────────────────────────────────────────────────────────
    var sb = sumBi(w.segments_ft, h);
    var oa = openingArea(w.openings, h, w.unsheathed_ft2);
    var Co = calcCo(out.L_ft, sb.sumBiRaw, oa.Ao, h);
    var r = calcR(sb.sumBiRaw, oa.Ao, h);
    var lever = Co * sb.sumBi;
    out.geom = {
      segments: sb.segments, sumBi: sb.sumBi, sumBiRaw: sb.sumBiRaw,
      Afhs: h * sb.sumBiRaw, Awall: h * out.L_ft, openings: oa.rows, unsheathed: oa.unsheathed,
      Ao: oa.Ao, r: r, Co: Co, lever: lever,
      // Governing aspect ratio for the gypsum gate below: the maximum h/b over
      // ALL segments, including any already excluded from Σb_i by §4.3.3.4.
      // Conservative — a tall narrow pier that contributes nothing to Σb_i still
      // disqualifies the gypsum face — and it keeps the gate independent of
      // which segments happened to survive the aspect-ratio reduction.
      maxHoverB: sb.segments.reduce(function (a, s) { return Math.max(a, isFinite(s.hOverB) ? s.hOverB : 0); }, 0)
    };
    if (oa.rows.some(function (o) { return o.floored; })) {
      out.messages.push('One or more openings are shorter than h/3; an opening height of h/3 = ' + f2(h / 3) + ' ft was used in A_o (SDPWS Eq. 4.3-6).');
    }

    // ── sheathing capacity ──────────────────────────────────────────────────
    var opts = { G: ctx.sp.G, insideFaceHoldown: !!(w.sheathing && w.sheathing.insideFaceHoldown) };
    var c1 = sheathingCapacity(w.sheathing.face1, opts);
    var c2 = w.sheathing.face2 ? sheathingCapacity(w.sheathing.face2, opts) : null;
    var cap = { face1: c1, face2: c2, faceNotes: [], prereqs: [] };

    // Gypsum face gating.
    var gypDropped = null;
    function gypLimit(caseKey) {
      // Table 4.3.3 note 2: 2:1, or 3.5:1 for wind design of a blocked WSP wall
      // with gypsum wallboard on the opposite side.
      return caseKey === 'wind' ? 3.5 : 2.0;
    }
    ['wind', 'seismic'].forEach(function (caseKey) {
      var use2 = c2;
      var drop = null;
      if (c2 && c2.ok && c2.opt.type === 'gyp') {
        if (ctx.gypBlockedBySDC) drop = 'Gypsum wallboard is not counted as a contributing face in SDC ' + ctx.sdc + ' — ASCE 7-16 Table 12.2-1 does not permit "shear panels of all other materials" (A.17/B.24) in SDC E or F.';
        else if (out.geom.maxHoverB > gypLimit(caseKey) + 1e-9) drop = 'Gypsum face not counted for ' + caseKey + ': the governing segment aspect ratio h/b = ' + f2(out.geom.maxHoverB) + ':1 exceeds the ' + f1(gypLimit(caseKey)) + ':1 limit of SDPWS Table 4.3.3' + (caseKey === 'wind' ? ' note 2' : '') + '.';
        if (drop) { use2 = null; if (!gypDropped || gypDropped !== drop) gypDropped = drop; }
      }
      if (!c1.ok) { cap[caseKey] = { vn: NaN, asd: NaN, rule: 'invalid', ref: '' }; return; }
      var comb = combineFaces(c1, use2 && use2.ok ? use2 : null, caseKey);
      cap[caseKey] = { vn: comb.vn, rule: comb.rule, ref: comb.ref, asd: comb.vn / LOAD[caseKey].asdDiv, asdDiv: LOAD[caseKey].asdDiv, face2Used: !!(use2 && use2.ok), dropped: drop };
    });
    if (gypDropped) cap.faceNotes.push(gypDropped);

    // §4.3.2.3(4) — combined nominal unit shear capacity <= 2,435 plf.
    var vnMax = Math.max(cap.wind.vn || 0, cap.seismic.vn || 0);
    cap.nominalMax = vnMax;
    if (vnMax > 2435 + 1e-9) {
      out.errors.push('Combined nominal unit shear capacity ' + f1(vnMax) + ' plf exceeds the 2,435 plf limit for perforated shear walls (SDPWS §4.3.2.3(4)). Choose a lighter sheathing schedule or design the wall by another method.');
    }

    // §4.3.7.1(5) and Table 4.3A fn. 6 — 3x framing / staggered nailing triggers.
    var faces = [c1].concat(c2 ? [c2] : []).filter(function (f) { return f && f.ok; });
    var trig = [];
    faces.forEach(function (f) {
      if (f.opt.spacing <= 2) trig.push('nail spacing of 2" o.c. at adjoining panel edges (§4.3.7.1(5)(a))');
      if (f.opt.nail === '10d common' && f.opt.spacing <= 3) trig.push('10d common nails at 3" o.c. or less (§4.3.7.1(5)(b))');
      if (f.vn > 980 + 1e-9 && ['D', 'E', 'F'].indexOf(ctx.sdc) >= 0) trig.push('nominal unit shear capacity ' + f1(f.vn) + ' plf on one side exceeds 980 plf in SDC ' + ctx.sdc + ' (§4.3.7.1(5)(c))');
    });
    if (faces.length === 2 && faces.some(function (f) { return f.opt.spacing < 6; })) {
      trig.push('panels on both faces with nail spacing less than 6" o.c. (Table 4.3A fn. 6 — offset panel joints, or 3x framing with staggered nailing)');
    }
    if (trig.length) {
      cap.prereqs = trig;
      out.messages.push('3x nominal framing at adjoining panel edges, staggered nailing (§4.3.7.1(5)) — triggered by: ' + trig.join('; ') + '.');
    }
    out.cap = cap;

    // ── story forces for this wall line ─────────────────────────────────────
    var present = wallPresence(floors, w.id);
    var cases = {};
    ['wind', 'seismic'].forEach(function (caseKey) {
      var sf = storyForces(floors, caseKey, present, w.id)[k];
      var vmax = lever > 0 ? sf.V / lever : NaN;

      // Dead-load resisting moment, cumulative from the top down to this level.
      var MR1 = 0, MR2 = 0, dlRows = [];
      for (var j = 0; j <= k; j++) {
        var wj = wallAt(floors, j, w.id);
        if (!wj) continue;
        var d = resolveDead(floors[j], wj);
        var Lj = num(wj.L_ft, 0) || 0;
        var mUni = (d.w_plf || 0) * Lj * Lj / 2;
        var mPt = (d.P_end_lb || 0) * Lj;
        MR1 += mUni + mPt;   // tension chord at End 1 — the point load resists with arm L
        MR2 += mUni;         // tension chord at End 2 — the point load sits at the toe
        dlRows.push({ level: floors[j].name, w_plf: d.w_plf || 0, P_end_lb: d.P_end_lb || 0, L: Lj, mUni: mUni, mPt: mPt, source: d.source });
      }
      var e1 = chordForce(sf.M, MR1, lever), e2 = chordForce(sf.M, MR2, lever);
      // Accumulated gravity carried by each end post (1.0D on the post).
      var grav1 = dlRows.reduce(function (a, x) { return a + x.P_end_lb; }, 0), grav2 = 0;
      var Cbase = lever > 0 ? sf.M / lever : NaN;   // overturning compression, no dead-load relief
      var ends = [
        { end: 1, label: 'End 1', MR: MR1, T: e1.T, Traw: e1.Traw, grav: grav1, C: Cbase + grav1 },
        { end: 2, label: 'End 2', MR: MR2, T: e2.T, Traw: e2.Traw, grav: grav2, C: Cbase + grav2 }
      ];
      var Tgov = Math.max(ends[0].T, ends[1].T);
      var Cgov = Math.max(ends[0].C, ends[1].C);
      cases[caseKey] = {
        key: caseKey, label: LOAD[caseKey].label, factor: LOAD[caseKey].factor, ref: LOAD[caseKey].ref,
        V: sf.V, Vstrength: sf.Pstrength, M: sf.M, Mstrength: sf.Mstrength, rows: sf.rows,
        vmax: vmax, t: vmax, ends: ends, Tgov: Tgov, Cgov: Cgov, Cot: Cbase, dlRows: dlRows,
        endGov: ends[0].T >= ends[1].T ? 1 : 2,
        asd: cap[caseKey].asd, dcSheathing: cap[caseKey].asd > 0 ? vmax / cap[caseKey].asd : Infinity
      };
    });
    out.cases = cases;

    // Governing case for each quantity. Wind wins a tie (within 1e-6 relative)
    // so that a model whose two cases land on the same ASD force reports stably.
    function govBy(pick) {
      var a = pick(cases.wind), b = pick(cases.seismic);
      var tol = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
      return (b > a + tol) ? cases.seismic : cases.wind;
    }
    var govShear = govBy(function (c) { return c.dcSheathing; });
    var govV = govBy(function (c) { return c.vmax; });
    var govT = govBy(function (c) { return c.Tgov; });
    var govC = govBy(function (c) { return c.Cgov; });
    out.gov = { shear: govShear.key, vmax: govV.vmax, vmaxCase: govV.key, t: govV.vmax, T: govT.Tgov, Tcase: govT.key, C: govC.Cgov, Ccase: govC.key };

    // ── hardware ────────────────────────────────────────────────────────────
    var postInfo = endPostCheck(w.endPost, state.species, h, out.gov.C);
    out.endPost = postInfo;

    var hdType = isBase ? 'hdue' : (w.holdown === 'strap' ? 'strap' : 'hdue');
    var hardware = { type: hdType };
    if (hdType === 'strap') {
      var strap = null;
      for (var si = 0; si < STRAPS.length; si++) if (STRAPS[si].Tall >= out.gov.T) { strap = STRAPS[si]; break; }
      hardware.device = strap; hardware.capacity = strap ? strap.Tall : 0;
      hardware.label = strap ? strap.name : 'Exceeds CMST12 (9,215 lb)';
      hardware.detail = strap ? strap.nails + ' — ' + strap.esr : '';
    } else {
      var hdCol = HD_COLUMN[state.species];   // catalog column name, for the labels
      var pick = null;
      for (var hi = 0; hi < HOLDOWNS.length; hi++) {
        var capH = holdownCapacity(HOLDOWNS[hi], postInfo.thk, postInfo.width, state.species);
        if (capH > 0 && capH >= out.gov.T) { pick = { hd: HOLDOWNS[hi], cap: capH }; break; }
      }
      hardware.device = pick ? pick.hd : null; hardware.capacity = pick ? pick.cap : 0; hardware.column = hdCol;
      if (!pick) {
        // Name the largest device the end post and species actually permit, not the largest in the catalogue.
        var best = null;
        HOLDOWNS.forEach(function (hd) {
          var c = holdownCapacity(hd, postInfo.thk, postInfo.width, state.species);
          if (c > 0 && (!best || c > best.cap)) best = { hd: hd, cap: c };
        });
        hardware.bestAvailable = best;
        hardware.label = best
          ? 'Exceeds ' + best.hd.name + ' (' + f1(best.cap) + ' lb, ' + hdCol + ') — the largest hold-down permitted on a ' + f2(postInfo.thk) + '" × ' + f2(postInfo.width) + '" ' + ctx.sp.label + ' end post'
          : 'No HDUE qualifies on a ' + f2(postInfo.thk) + '" × ' + f2(postInfo.width) + '" ' + ctx.sp.label + ' end post — the lightest HDUE needs 3" member thickness × 3½" width (C-C-2026 p. 61)';
      } else {
        hardware.label = pick.hd.name;
      }
      hardware.detail = pick ? (pick.hd.sds + ', ' + pick.hd.rod + ' dia. anchor rod — ' + hdCol + ' column, C-C-2026 p. 61' + (pick.hd.note ? ' — ' + pick.hd.note : '')) : '';
      hardware.rod = pick ? pick.hd.rod : '';
    }
    out.holdown = hardware;

    // Sill shear connector.
    var scObj = findSill(w.sill.conn);
    var sillSpecies = SPECIES[w.sillSpecies] ? w.sillSpecies : state.species;
    var sillNotes = [];
    // `minG` rows (16d: Table 12N is for both members of identical G; SDS: the
    // sole-to-rim table drops to the SPF/HF value where either member is SPF/HF):
    // the lower G of the sill species and the framing species governs. Other
    // connectors are tabulated against the sill member and read the sill species.
    var valSpecies = sillSpecies, nailGov = '';
    if (scObj.minG) {
      var Gsill = SPECIES[sillSpecies].G, Gfrm = ctx.sp.G;
      valSpecies = Gfrm + 1e-9 < Gsill ? state.species : sillSpecies;
      nailGov = Gfrm + 1e-9 < Gsill ? 'framing' : (Gsill + 1e-9 < Gfrm ? 'sill' : 'both');
      sillNotes.push('Value at the lower specific gravity: ' + SPECIES[valSpecies].label + ' G = ' + f2(SPECIES[valSpecies].G)
        + (nailGov === 'both' ? ' (sill and framing alike)' : ' (' + nailGov + ' species governs; ' + (nailGov === 'sill' ? ctx.sp.label + ' framing G = ' + f2(Gfrm) : SPECIES[sillSpecies].label + ' sill G = ' + f2(Gsill)) + ')')
        + ' — ' + scObj.minGWhy + '.');
    }
    var Vconn = scObj.bySillSpecies ? scObj.bySillSpecies[valSpecies] : scObj.Vconn;
    if (scObj.sheathingReduction) {
      var key = String((w.sill && w.sill.sheathing) || 'none');
      var red = LTP4_SHEATHING[key] || LTP4_SHEATHING.none;
      Vconn = Vconn * red.f;
      sillNotes.push('LTP4 ' + red.label + (red.f !== 1 ? ' — × ' + f2(red.f) + ' (Simpson C-C-2026 footnote)' : ''));
    }
    var spacing = num(w.sill.spacing_in, scObj.defaultSpacing);
    var sillPlf = spacing > 0 ? Vconn / (spacing / 12) : NaN;
    out.sill = { conn: scObj, Vconn: Vconn, spacing: spacing, plf: sillPlf, species: sillSpecies, valueSpecies: valSpecies, nailGov: nailGov, notes: sillNotes, basis: scObj.basis };
    if (isBase) {
      // §4.3.6.4.3: the plate washer itself is unconditional; only the
      // extend-to-within-½"-of-the-edge clause is gated on 400 plf.
      out.messages.push('A steel plate washer not less than 0.229" × 3" × 3" is required under each foundation anchor bolt nut (SDPWS §4.3.6.4.3).'
        + (out.cap.nominalMax > 400
            ? ' Nominal unit shear capacity is ' + f1(out.cap.nominalMax) + ' plf > 400 plf, so the plate washer must also extend to within ½" of the edge of the bottom plate on the sheathed side(s).'
            : ''));
    }

    // Distributed uplift connector, §4.3.6.4.2.1.
    var upCap = w.uplift && isFinite(num(w.uplift.capacity_plf, NaN)) ? num(w.uplift.capacity_plf, NaN) : null;
    out.uplift = { capacity_plf: upCap, label: (w.uplift && w.uplift.label) || '' };

    // ── check rows ──────────────────────────────────────────────────────────
    var checks = [];
    checks.push({
      id: 'sheathing', label: 'Sheathing unit shear', ref: 'SDPWS §4.3.6.4.1.1 Eq. 4.3-9; §4.3.5.2 + §4.1.4',
      demand: govShear.vmax, demandTxt: 'v_max = ' + f1(govShear.vmax) + ' plf',
      capacity: govShear.asd, capacityTxt: 'v_ASD = ' + f1(govShear.asd) + ' plf',
      dc: govShear.dcSheathing, pass: govShear.dcSheathing <= 1.0, caseKey: govShear.key
    });
    checks.push({
      id: 'holdown', label: 'Chord tension / hold-down', ref: 'SDPWS §4.3.6.1.3 Eq. 4.3-8',
      demand: out.gov.T, demandTxt: 'T = ' + f1(out.gov.T) + ' lb',
      capacity: hardware.capacity, capacityTxt: hardware.label + (hardware.capacity ? ' — T_all = ' + f1(hardware.capacity) + ' lb' : ''),
      dc: out.gov.T <= 0 ? 0 : (hardware.capacity > 0 ? out.gov.T / hardware.capacity : Infinity),
      pass: out.gov.T <= 0 ? true : (hardware.capacity > 0 && out.gov.T <= hardware.capacity), caseKey: govT.key,
      na: out.gov.T <= 0
    });
    if (out.gov.T <= 0) {
      var rawGov = Math.min(cases.wind.ends[0].Traw, cases.wind.ends[1].Traw, cases.seismic.ends[0].Traw, cases.seismic.ends[1].Traw);
      var rawMax = Math.max(cases.wind.ends[0].Traw, cases.wind.ends[1].Traw, cases.seismic.ends[0].Traw, cases.seismic.ends[1].Traw);
      out.messages.push('Uplift not required by calculation (T_raw = ' + f1(rawMax) + ' lb at the governing end; dead load governs). The uniform uplift t = ' + f1(out.gov.t) + ' plf of §4.3.6.4.2.1 is still required at the bottom plate.');
      out.TrawMin = rawGov;
    }
    checks.push({
      id: 'uplift', label: 'Bottom-plate uniform uplift, t = v_max', ref: 'SDPWS §4.3.6.4.2.1',
      demand: out.gov.t, demandTxt: 't = ' + f1(out.gov.t) + ' plf',
      capacity: upCap, capacityTxt: upCap === null ? 'connector required — not specified' : (out.uplift.label ? out.uplift.label + ' — ' : '') + f1(upCap) + ' plf',
      dc: upCap ? out.gov.t / upCap : NaN, pass: upCap === null ? null : out.gov.t <= upCap, caseKey: out.gov.vmaxCase,
      req: upCap === null
    });
    checks.push({
      id: 'sill', label: 'Sill / bottom-plate shear anchorage', ref: 'SDPWS §4.3.6.4.1.1' + (isBase ? '; §4.3.6.4.3' : ''),
      demand: out.gov.vmax, demandTxt: 'v_max = ' + f1(out.gov.vmax) + ' plf',
      capacity: sillPlf, capacityTxt: scObj.label + ' @ ' + f1(spacing) + '" o.c. — ' + f1(sillPlf) + ' plf',
      dc: sillPlf > 0 ? out.gov.vmax / sillPlf : Infinity, pass: sillPlf > 0 && out.gov.vmax <= sillPlf, caseKey: out.gov.vmaxCase
    });
    checks.push({
      id: 'endpost', label: 'End post compression', ref: 'NDS 2018 §3.7.1',
      demand: postInfo.fc, demandTxt: 'f_c = ' + f1(postInfo.fc) + ' psi (C = ' + f1(out.gov.C) + ' lb)',
      capacity: postInfo.FcPrime, capacityTxt: "F'_c = " + f1(postInfo.FcPrime) + ' psi',
      dc: postInfo.dc, pass: postInfo.dc <= 1.0 && postInfo.slendOK, caseKey: out.gov.Ccase
    });
    if (!postInfo.slendOK) out.messages.push('End post slenderness l_e/d = ' + f1(postInfo.slend) + ' exceeds the NDS §3.7.1.4 limit of 50.');
    out.checks = checks;
    out.allPass = checks.every(function (c) { return c.pass === true; }) && out.errors.length === 0;

    // Collector note — v_max is carried into the level below on every wall line.
    out.messages.push('Collector / load path: v_max = ' + f1(out.gov.vmax) + ' plf (' + out.gov.vmaxCase + ') is transmitted into the top of this wall, out of its base at full-height sheathing, and into the collectors connecting the segments; it is carried to the level below (SDPWS §4.3.6.4.1.1, §4.3.6.4.4).');
    return out;
  }

  // Dead load may be linked to another wall line on the same level.
  function resolveDead(floor, wall) {
    var d = wall.dead || {};
    if (d.source && d.source !== 'manual') {
      var src = (floor.walls || []).filter(function (x) { return x.id === d.source; })[0];
      if (src && src.dead) return { w_plf: num(src.dead.w_plf, 0) || 0, P_end_lb: num(src.dead.P_end_lb, 0) || 0, source: src.label || src.id };
    }
    return { w_plf: num(d.w_plf, 0) || 0, P_end_lb: num(d.P_end_lb, 0) || 0, source: 'manual' };
  }

  // =========================================================================
  // Default model — the calculator's shipped four-story wall line
  // (docs/stacked-wood-qaqc-2026-09/D-shearwall-fixtures.json case 1).
  // The published ASD level forces are 2,783 / 1,661 / 1,738 / 1,921 lb; the
  // engine takes strength level, so W = P / 0.6.
  // =========================================================================
  function defaultWall(o) {
    o = o || {};
    return {
      id: o.id || 'w1', label: o.label || 'Wall Line A', L_ft: o.L_ft, h_ft: o.h_ft,
      segments_ft: o.segments_ft, openings: o.openings || [], unsheathed_ft2: 0,
      sheathing: { face1: { type: 'wsp', thickness: '7/16', nail: '8d common', spacing: 6 }, face2: null, blocked: true, insideFaceHoldown: false },
      endPost: { n: 2, size: '2x6' }, holdown: o.holdown || 'hdue',
      sill: { conn: o.sill || 'sds14', spacing_in: o.spacing || 12, sheathing: 'none' },
      sillSpecies: 'DFL', dead: { w_plf: 0, P_end_lb: 0, source: 'manual' },
      uplift: { capacity_plf: null, label: '' }, transfer: false,
      P_wind_lb: null, P_seis_lb: null   // line-force override; null = inherit the level force
    };
  }
  function defaultState() {
    var mk = function (id, name, h, P, ho, sill, spacing) {
      return {
        id: id, name: name, h_ft: h, P_wind_lb: P / 0.6, P_seis_lb: P / 0.7,
        walls: [defaultWall({ L_ft: 302, h_ft: h, segments_ft: [172], openings: [{ w_ft: 130, hc_ft: ho }], sill: sill, spacing: spacing })]
      };
    };
    return {
      version: 2, sfrs: 'A.15', sdc: 'D', species: 'DFL',
      floors: [
        mk(1, '4th Floor', 8.0, 2783, 6.67, 'sds14', 12),
        mk(2, '3rd Floor', 9.5, 1661, 6.67, 'sds14', 12),
        mk(3, '2nd Floor', 9.5, 1738, 6.67, 'sds14', 12),
        mk(4, '1st Floor', 10.5, 1921, 7.50, 'ab58', 20)
      ]
    };
  }

  // =========================================================================
  // Fixtures — docs/stacked-wood-qaqc-2026-09/D-shearwall-fixtures.json
  // plus the cases named in docs/superpowers/specs/2026-09-14-stacked-shearwall-fix.md §5.
  // Fixture level forces P are already ASD; the engine takes strength level, so
  // every fixture is driven through W = P / 0.6 in the wind case and E = P / 0.7
  // in the seismic case.
  // =========================================================================
  function mkState(o) {
    return {
      version: 2, sfrs: o.sfrs || 'A.15', sdc: o.sdc || 'D', species: o.species || 'DFL',
      floors: o.stories.map(function (s, i) {
        var wall = defaultWall({
          L_ft: s.L, h_ft: s.h, segments_ft: s.segments,
          openings: (s.openings || []).map(function (x) { return { w_ft: x[0], hc_ft: x[1] }; }),
          sill: s.sill || (i === o.stories.length - 1 ? 'ab58' : 'sds14'),
          spacing: s.spacing || (i === o.stories.length - 1 ? 20 : 12)
        });
        wall.dead = { w_plf: s.w || 0, P_end_lb: s.Pend || 0, source: 'manual' };
        if (s.face1) wall.sheathing.face1 = s.face1;
        if (s.face2) wall.sheathing.face2 = s.face2;
        if (s.insideFaceHoldown) wall.sheathing.insideFaceHoldown = true;
        if (s.endPost) wall.endPost = s.endPost;
        if (s.holdown) wall.holdown = s.holdown;
        if (s.sillSheathing) wall.sill.sheathing = s.sillSheathing;
        if (s.sillSpecies) wall.sillSpecies = s.sillSpecies;
        return {
          id: i + 1, name: s.name, h_ft: s.h,
          P_wind_lb: (s.P || 0) / 0.6, P_seis_lb: (s.P || 0) / 0.7, walls: [wall]
        };
      })
    };
  }
  function W(res, k) { return res.floors[k].walls[0]; }

  var FIXTURES = [
    // ── Case 1: the calculator's shipped default model ────────────────────
    { id: 'SW1', src: 'D fixtures case1 (4th Floor)', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 0), c = a.cases.wind;
        return [['Σb_i = 172.0 ft', near(a.geom.sumBi, 172.0, 0.01), f2(a.geom.sumBi)],
                ['A_o = 867.1 sf', near(a.geom.Ao, 867.1, 0.1), f2(a.geom.Ao)],
                ['r = 0.6134', near(a.geom.r, 0.6134, 0.0002), f4(a.geom.r)],
                ['C_o = 0.6074', near(a.geom.Co, 0.6074, 0.0002), f4(a.geom.Co)],
                ['V_story = 2,783 lb', near(c.V, 2783, 1), f1(c.V)],
                ['M = 22,264 ft-lb', near(c.M, 22264, 2), f1(c.M)],
                ['v_max = 26.64 plf', near(c.vmax, 26.64, 0.02), f2(c.vmax)],
                ['t = 26.64 plf', near(c.t, 26.64, 0.02), f2(c.t)],
                ['T = 213.1 lb', near(c.Tgov, 213.1, 0.2), f1(c.Tgov)],
                ['hold-down HDUE3-SDS3', a.holdown.label === 'HDUE3-SDS3', a.holdown.label]]; } },
    { id: 'SW2', src: 'D fixtures case1 (3rd Floor)', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 1), c = a.cases.wind;
        return [['C_o = 0.6774', near(a.geom.Co, 0.6774, 0.0002), f4(a.geom.Co)],
                ['V_story = 4,444 lb', near(c.V, 4444, 1), f1(c.V)],
                ['M = 64,482 ft-lb', near(c.M, 64482, 2), f1(c.M)],
                ['v_max = 38.14 plf', near(c.vmax, 38.14, 0.02), f2(c.vmax)],
                ['T = 553.4 lb', near(c.Tgov, 553.4, 0.2), f1(c.Tgov)]]; } },
    { id: 'SW3', src: 'D fixtures case1 (2nd Floor)', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 2), c = a.cases.wind;
        return [['C_o = 0.6774', near(a.geom.Co, 0.6774, 0.0002), f4(a.geom.Co)],
                ['V_story = 6,182 lb', near(c.V, 6182, 1), f1(c.V)],
                ['M = 123,211 ft-lb', near(c.M, 123211, 3), f1(c.M)],
                ['v_max = 53.06 plf', near(c.vmax, 53.06, 0.02), f2(c.vmax)],
                ['T = 1,057.5 lb', near(c.Tgov, 1057.5, 0.5), f1(c.Tgov)]]; } },
    { id: 'SW4', src: 'D fixtures case1 (1st Floor / base)', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 3), c = a.cases.wind;
        return [['A_o = 975.0 sf', near(a.geom.Ao, 975.0, 0.1), f2(a.geom.Ao)],
                ['C_o = 0.6703', near(a.geom.Co, 0.6703, 0.0002), f4(a.geom.Co)],
                ['V_story = 8,103 lb', near(c.V, 8103, 1), f1(c.V)],
                ['M = 208,292.5 ft-lb', near(c.M, 208292.5, 3), f1(c.M)],
                ['v_max = 70.29 plf', near(c.vmax, 70.29, 0.02), f2(c.vmax)],
                ['t = 70.29 plf', near(c.t, 70.29, 0.02), f2(c.t)],
                ['T = 1,806.8 lb', near(c.Tgov, 1806.8, 0.5), f1(c.Tgov)],
                ['hold-down HDUE3-SDS3', a.holdown.label === 'HDUE3-SDS3', a.holdown.label],
                ['base level flagged', a.base === true, String(a.base)]]; } },

    // ── Case 2: WoodWorks five-over-one, §6 (segmented, C_o = 1.0) ─────────
    // Only v is a fair comparison; the published T uses a chord lever arm d and
    // the (0.6 - 0.14 S_DS) vertical term, neither of which this method uses.
    { id: 'SW5', src: 'WoodWorks Dec-2017 p.35 Table 7', run: function () { return compute(mkState(CASE2)); },
      expect: function (r) {
        var want = [313.5, 586.6, 793.9, 932.1, 1001.2], out = [];
        want.forEach(function (v, i) {
          var a = W(r, i), c = a.cases.seismic;
          out.push(['level ' + (i + 1) + ' v_ASD = ' + f1(v) + ' plf', near(c.vmax, v, v * 0.0025), f2(c.vmax)]);
        });
        out.push(['C_o = 1.000 (no openings)', near(W(r, 0).geom.Co, 1.0, 1e-9), f4(W(r, 0).geom.Co)]);
        return out; } },

    // ── Case 3: divergent C_o*Sigma b_i — the force-first regression guard ──
    // The fixture's trial sheathing (15/32 two-sided 10d @ 4") is 2,580 plf
    // nominal and is rejected by §4.3.2.3(4); see SW14. The structural
    // quantities below are what this case exists to guard.
    { id: 'SW6', src: 'D fixtures case3 (Upper)', run: function () { return compute(mkState(CASE3)); },
      expect: function (r) { var a = W(r, 0), c = a.cases.wind;
        return [['Σb_i = 32.0 ft', near(a.geom.sumBi, 32.0, 0.01), f2(a.geom.sumBi)],
                ['A_o = 56.0 sf', near(a.geom.Ao, 56.0, 0.01), f2(a.geom.Ao)],
                ['r = 0.8511', near(a.geom.r, 0.8511, 0.0002), f4(a.geom.r)],
                ['C_o = 0.8197', near(a.geom.Co, 0.8197, 0.0002), f4(a.geom.Co)],
                ['V_story = 8,000 lb', near(c.V, 8000, 1), f1(c.V)],
                ['M = 80,000 ft-lb', near(c.M, 80000, 1), f1(c.M)],
                ['v_max = 305.00 plf', near(c.vmax, 305.0, 0.05), f2(c.vmax)],
                ['T = 3,050.0 lb', near(c.Tgov, 3050.0, 1), f1(c.Tgov)]]; } },
    { id: 'SW7', src: 'D fixtures case3 (Lower) — force-first accumulation', run: function () { return compute(mkState(CASE3)); },
      expect: function (r) { var a = W(r, 1), c = a.cases.wind;
        return [['Σb_i = 16.0 ft', near(a.geom.sumBi, 16.0, 0.01), f2(a.geom.sumBi)],
                ['A_o = 192.0 sf', near(a.geom.Ao, 192.0, 0.01), f2(a.geom.Ao)],
                ['C_o = 0.5435', near(a.geom.Co, 0.5435, 0.0002), f4(a.geom.Co)],
                ['V_story = 14,000 lb (sum of FORCES, §4.3.6.4.4)', near(c.V, 14000, 1), f1(c.V)],
                ['M = 220,000 ft-lb', near(c.M, 220000, 1), f1(c.M)],
                ['v_max = 1,610.00 plf (NOT the 1,118.75 plf of a plf-summing engine)', near(c.vmax, 1610.0, 0.5), f2(c.vmax)],
                ['t = 1,610.00 plf', near(c.t, 1610.0, 0.5), f2(c.t)],
                ['T = 25,300 lb', near(c.Tgov, 25300.0, 5), f1(c.Tgov)],
                ['T exceeds every HDUE the end post permits', a.holdown.label.indexOf('Exceeds ') === 0 && a.checks.filter(function (x) { return x.id === 'holdown'; })[0].pass === false, a.holdown.label]]; } },

    // ── Case 3-DL: dead-load resisting MOMENT (the L/2 lever) ──────────────
    { id: 'SW8', src: 'D fixtures case3DL', run: function () { return compute(mkState(CASE3DL)); },
      expect: function (r) { var u = W(r, 0).cases.wind, l = W(r, 1).cases.wind;
        return [['Upper M_R = 160,000 ft-lb', near(u.ends[0].MR, 160000, 1), f1(u.ends[0].MR)],
                ['Upper T_raw = −610.0 lb', near(u.ends[0].Traw, -610.0, 1), f1(u.ends[0].Traw)],
                ['Upper T = 0 (clamped)', near(u.Tgov, 0, 1e-9), f1(u.Tgov)],
                ['Upper hold-down not required', W(r, 0).checks.filter(function (c) { return c.id === 'holdown'; })[0].na === true, String(W(r, 0).checks.filter(function (c) { return c.id === 'holdown'; })[0].na)],
                ['Lower M_R = 320,000 ft-lb', near(l.ends[0].MR, 320000, 1), f1(l.ends[0].MR)],
                ['Lower T = 3,220.0 lb', near(l.Tgov, 3220.0, 2), f1(l.Tgov)],
                ['Lower hold-down HDUE3-SDS3', W(r, 1).holdown.label === 'HDUE3-SDS3', W(r, 1).holdown.label]]; } },

    // ── Case 4: negative T clamps at zero, t still required ────────────────
    { id: 'SW9', src: 'D fixtures case4', run: function () { return compute(mkState(CASE4)); },
      expect: function (r) { var a = W(r, 0), c = a.cases.wind;
        return [['lever C_o·Σb_i = 26.230 ft', near(a.geom.lever, 26.230, 0.005), f4(a.geom.lever)],
                ['M = 30,000 ft-lb', near(c.M, 30000, 1), f1(c.M)],
                ['M_R = 672,000 ft-lb', near(c.ends[0].MR, 672000, 1), f1(c.ends[0].MR)],
                ['T_raw = −14,228.2 lb', near(c.ends[0].Traw, -14228.2, 2), f1(c.ends[0].Traw)],
                ['T = 0 (clamped, never negative)', near(c.Tgov, 0, 1e-9), f1(c.Tgov)],
                ['t = 114.38 plf still required', near(c.t, 114.38, 0.02), f2(c.t)],
                ['uplift row present', a.checks.some(function (x) { return x.id === 'uplift'; }), 'rows: ' + a.checks.map(function (x) { return x.id; }).join(',')]]; } },

    // ── Case 5: both directions, asymmetric point dead load ───────────────
    // Fixture input M_R,+ = 80,000 ft-lb about the far end; with the engine's
    // P_end * L rule and L = 40 ft that is a 2,000 lb chord load.
    { id: 'SW10', src: 'D fixtures case5', run: function () { return compute(mkState(CASE5)); },
      expect: function (r) { var a = W(r, 0), c = a.cases.wind, e1 = c.ends[0], e2 = c.ends[1];
        return [['End 1 M_R = 80,000 ft-lb', near(e1.MR, 80000, 1), f1(e1.MR)],
                ['End 2 M_R = 0', near(e2.MR, 0, 1e-9), f1(e2.MR)],
                ['T+ raw = −686.2 lb', near(e1.Traw, -686.2, 1), f1(e1.Traw)],
                ['T+ = 0', near(e1.T, 0, 1e-9), f1(e1.T)],
                ['T− = 1,143.8 lb', near(e2.T, 1143.8, 1), f1(e2.T)],
                ['governing T = 1,143.8 lb', near(c.Tgov, 1143.8, 1), f1(c.Tgov)],
                ['governing end = 2', c.endGov === 2, String(c.endGov)],
                ['hold-down HDUE3-SDS3', a.holdown.label === 'HDUE3-SDS3', a.holdown.label]]; } },

    // ── Case 6: §4.3.3.4 aspect ratio treatment of Sigma b_i ───────────────
    { id: 'SW11', src: 'D fixtures case6', run: function () { return sumBi([8.0, 4.0, 3.0, 2.5], 10.0); },
      expect: function (s) {
        return [['b = 8.0 full', near(s.segments[0].bEff, 8.00, 0.005) && s.segments[0].rule === 'full', f2(s.segments[0].bEff)],
                ['b = 4.0 → 3.20 (× 2b/h)', near(s.segments[1].bEff, 3.20, 0.005) && s.segments[1].rule === '× 2b/h', f2(s.segments[1].bEff)],
                ['b = 3.0 → 1.80 (× 2b/h)', near(s.segments[2].bEff, 1.80, 0.005) && s.segments[2].rule === '× 2b/h', f2(s.segments[2].bEff)],
                ['b = 2.5 excluded, h/b = 4.0 > 3.5', near(s.segments[3].bEff, 0, 1e-9) && s.segments[3].rule.indexOf('excluded') === 0, f2(s.segments[3].bEff)],
                ['Σb_i effective = 13.00 ft (naive 17.50)', near(s.sumBi, 13.00, 0.005), f2(s.sumBi)],
                ['Σb_i unreduced = 17.50 ft', near(s.sumBiRaw, 17.50, 0.005), f2(s.sumBiRaw)]]; } },

    // ── Case 7: closed-form C_o lands on SDPWS Table 4.3.5.6 ──────────────
    { id: 'SW12', src: 'D fixtures case7 / SDPWS Table 4.3.5.6', run: function () { return null; },
      expect: function () {
        var L = 40, h = 10, out = [];
        [[0.10, 0.500, 0.69], [0.20, 0.500, 0.7143], [0.30, 2 / 3, 0.5882], [0.50, 1.000, 0.5000], [0.90, 1.000, 0.8333], [1.00, 1.000, 1.0000]]
          .forEach(function (p) {
            var sbi = L * p[0], ho = h * p[1], Ao = ho * (L - sbi);
            var Co = calcCo(L, sbi, Ao, h);
            out.push([(p[0] * 100) + ' % full height, h_o/h = ' + f2(p[1]) + ' → C_o = ' + f4(p[2]), near(Co, p[2], 0.01), f4(Co)]);
          });
        return out; } },

    // ── Sheathing capacity rules ──────────────────────────────────────────
    { id: 'SW13', src: 'SDPWS §4.1.4.1 / §4.1.4.2', run: function () { return compute(mkState(CASE_SHEATH({}))); },
      expect: function (r) { var a = W(r, 0);
        return [['7/16 8d@6 nominal 670 plf', near(a.cap.wind.vn, 670, 0.1), f1(a.cap.wind.vn)],
                ['wind ASD = 670/2.0 = 335.0 plf', near(a.cap.wind.asd, 335.0, 0.05), f2(a.cap.wind.asd)],
                ['seismic ASD = 670/2.8 = 239.3 plf', near(a.cap.seismic.asd, 239.29, 0.05), f2(a.cap.seismic.asd)]]; } },
    { id: 'SW14', src: 'SDPWS §4.3.2.3(4)', run: function () { return compute(mkState(CASE_SHEATH({ species: 'DFL', face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 }, face2: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } }))); },
      expect: function (r) { var a = W(r, 0);
        return [['combined nominal 2,580 plf', near(a.cap.nominalMax, 2580, 1), f1(a.cap.nominalMax)],
                ['rejected: exceeds 2,435 plf', a.errors.some(function (e) { return e.indexOf('2,435') >= 0; }), a.errors.join(' | ') || '(no error)'],
                ['model not ok', r.ok === false, String(r.ok)]]; } },
    { id: 'SW15', src: 'SDPWS Table 4.3A fn. 3 (SPF, G = 0.42)', run: function () { return compute(mkState(CASE_SHEATH({ species: 'SPF' }))); },
      expect: function (r) { var a = W(r, 0);
        return [['SG factor = 0.92', near(a.cap.face1.sg, 0.92, 1e-9), f2(a.cap.face1.sg)],
                ['nominal 670 × 0.92 = 616.4 plf', near(a.cap.wind.vn, 616.4, 0.1), f1(a.cap.wind.vn)],
                ['wind ASD = 308.2 plf', near(a.cap.wind.asd, 308.2, 0.05), f2(a.cap.wind.asd)]]; } },
    { id: 'SW16', src: 'SDPWS Table 4.3A fn. 10', run: function () { return compute(mkState(CASE_SHEATH({ face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 6 }, insideFaceHoldown: true }))); },
      expect: function (r) { var a = W(r, 0);
        return [['fn. 10 factor = 0.92', near(a.cap.face1.fn10, 0.92, 1e-9), f2(a.cap.face1.fn10)],
                ['nominal 870 × 0.92 = 800.4 plf', near(a.cap.wind.vn, 800.4, 0.1), f1(a.cap.wind.vn)],
                ['condition named in the detail', a.cap.face1.factors.some(function (x) { return x.why.indexOf('fn. 10') >= 0; }), a.cap.face1.factors.map(function (x) { return x.why; }).join(' | ')]]; } },
    { id: 'SW17', src: 'SDPWS §4.3.5.4.2 + Exception (WSP + gypsum)', run: function () { return compute(mkState(CASE_SHEATH({ face2: { type: 'gyp', thickness: '5/8', nail: '6d cooler', spacing: 7 } }))); },
      expect: function (r) { var a = W(r, 0);
        return [['wind nominal = 670 + 290 = 960 plf (sum)', near(a.cap.wind.vn, 960, 0.1), f1(a.cap.wind.vn)],
                ['wind ASD = 480.0 plf', near(a.cap.wind.asd, 480.0, 0.05), f2(a.cap.wind.asd)],
                ['seismic nominal = max(2×290, 670) = 670 plf', near(a.cap.seismic.vn, 670, 0.1), f1(a.cap.seismic.vn)],
                ['seismic ASD = 239.3 plf', near(a.cap.seismic.asd, 239.29, 0.05), f2(a.cap.seismic.asd)]]; } },
    { id: 'SW18', src: 'ASCE 7-16 Table 12.2-1 — gypsum in SDC E', run: function () { return compute(mkState(CASE_SHEATH({ sdc: 'E', face2: { type: 'gyp', thickness: '5/8', nail: '6d cooler', spacing: 7 } }))); },
      expect: function (r) { var a = W(r, 0);
        return [['gypsum face not counted', a.cap.wind.face2Used === false, String(a.cap.wind.face2Used)],
                ['wind nominal falls back to 670 plf', near(a.cap.wind.vn, 670, 0.1), f1(a.cap.wind.vn)],
                ['reason stated', a.cap.faceNotes.some(function (x) { return x.indexOf('SDC E') >= 0; }), a.cap.faceNotes.join(' | ') || '(none)']]; } },

    // ── Hardware ──────────────────────────────────────────────────────────
    // Every value below is the C-C-2026 p. 61 HDUE "Minimum Wood Member Size
    // Thickness x Width" grid, DF/SP column (identical to ESR-2330 Table 2B:
    // columns 3 / 3.5 / 4.5 / 5.5 / 7.25 / 5.5(7), footnote 6 minimum width 3½"
    // on the plain columns, footnote 7 minimum width 5½" on 5.5(7)).
    { id: 'SW19', src: 'C-C-2026 p. 61 / ESR-2330 Table 2B — thickness / width grid, DF/SP', run: function () { return null; },
      expect: function () {
        var hd3 = HOLDOWNS[0], hd5 = HOLDOWNS[1], hd7 = HOLDOWNS[2], hd9 = HOLDOWNS[3], hd13 = HOLDOWNS[4], hd17 = HOLDOWNS[5];
        return [['HDUE3 at 3" thickness = 3,790 lb (the 3" column exists)', holdownCapacity(hd3, 3.0, 5.5, 'DFL') === 3790, String(holdownCapacity(hd3, 3.0, 5.5, 'DFL'))],
                ['HDUE5 at 3" thickness = 5,375 lb', holdownCapacity(hd5, 3.0, 5.5, 'DFL') === 5375, String(holdownCapacity(hd5, 3.0, 5.5, 'DFL'))],
                ['HDUE7 at 3" thickness = 7,015 lb', holdownCapacity(hd7, 3.0, 5.5, 'DFL') === 7015, String(holdownCapacity(hd7, 3.0, 5.5, 'DFL'))],
                ['HDUE9 at 3" thickness = 0 (no 3" column)', holdownCapacity(hd9, 3.0, 5.5, 'DFL') === 0, String(holdownCapacity(hd9, 3.0, 5.5, 'DFL'))],
                ['HDUE9 at 3½" thickness = 8,425 lb', holdownCapacity(hd9, 3.5, 5.5, 'DFL') === 8425, String(holdownCapacity(hd9, 3.5, 5.5, 'DFL'))],
                ['HDUE9 at 4½" thickness = 9,390 lb', holdownCapacity(hd9, 4.5, 5.5, 'DFL') === 9390, String(holdownCapacity(hd9, 4.5, 5.5, 'DFL'))],
                ['HDUE13 at 5½" thickness, 3½" width = 11,900 lb', holdownCapacity(hd13, 5.5, 3.5, 'DFL') === 11900, String(holdownCapacity(hd13, 5.5, 3.5, 'DFL'))],
                ['HDUE13 at 7¼" thickness, 3½" width = 12,950 lb', holdownCapacity(hd13, 7.25, 3.5, 'DFL') === 12950, String(holdownCapacity(hd13, 7.25, 3.5, 'DFL'))],
                ['HDUE13 on a 6×6 (5½" thick × 5½" wide) = 13,110 lb', holdownCapacity(hd13, 5.5, 5.5, 'DFL') === 13110, String(holdownCapacity(hd13, 5.5, 5.5, 'DFL'))],
                ['HDUE17 at 5½" thickness, 3½" width = 16,040 lb', holdownCapacity(hd17, 5.5, 3.5, 'DFL') === 16040, String(holdownCapacity(hd17, 5.5, 3.5, 'DFL'))],
                ['HDUE17 at 7¼" thickness, 3½" width = 16,040 lb', holdownCapacity(hd17, 7.25, 3.5, 'DFL') === 16040, String(holdownCapacity(hd17, 7.25, 3.5, 'DFL'))],
                ['HDUE17 on a 6×6 (5½" thick × 5½" wide) = 17,685 lb', holdownCapacity(hd17, 5.5, 5.5, 'DFL') === 17685, String(holdownCapacity(hd17, 5.5, 5.5, 'DFL'))],
                ['below footnote 6’s 3½" minimum width nothing qualifies', holdownCapacity(hd3, 5.5, 3.0, 'DFL') === 0, String(holdownCapacity(hd3, 5.5, 3.0, 'DFL'))],
                ['SP reads the same DF/SP column (HDUE13 6×6 = 13,110 lb)', holdownCapacity(hd13, 5.5, 5.5, 'SP') === 13110, String(holdownCapacity(hd13, 5.5, 5.5, 'SP'))]]; } },
    { id: 'SW20', src: 'ESR-2330 Table 2B — HDUE9 pick on a 4x6 post', run: function () {
        var st = mkState(CASE_HD); st.floors[0].walls[0].endPost = { n: 1, size: '4x6' }; return compute(st); },
      expect: function (r) { var a = W(r, 0);
        return [['end post thickness 3½"', near(a.endPost.thk, 3.5, 1e-9), f2(a.endPost.thk)],
                ['HDUE9-SDS3.5 selected', a.holdown.label === 'HDUE9-SDS3.5', a.holdown.label],
                ['capacity 8,425 lb (not 9,390)', near(a.holdown.capacity, 8425, 1), f1(a.holdown.capacity)],
                ['rod ⅞" printed from the array', a.holdown.rod === '⅞"', a.holdown.rod]]; } },
    { id: 'SW21', src: 'ESR-2105 — straps need G ≥ 0.50', run: function () {
        var st = mkState(CASE3); st.species = 'SPF'; st.floors[0].walls[0].holdown = 'strap'; return compute(st); },
      expect: function (r) {
        return [['strap refused for SPF', r.errors.some(function (e) { return e.indexOf('specific gravity') >= 0; }), r.errors.join(' | ') || '(none)'],
                ['model not ok', r.ok === false, String(r.ok)]]; } },
    { id: 'SW22', src: 'ESR-2105 — strap accepted for DF-L above the base', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].holdown = 'strap'; return compute(st); },
      expect: function (r) { var a = W(r, 0);
        return [['CMST14 for T = 3,050 lb? CMSTC16 governs', a.holdown.label === 'CMSTC16', a.holdown.label],
                ['nail count stated as a total', a.holdown.detail.indexOf('total') >= 0, a.holdown.detail]]; } },
    { id: 'SW23', src: 'Simpson C-C-2026 — LTP4 sheathing reduction', run: function () {
        var mk = function (thk) { var st = mkState(CASE_HD); st.floors[0].walls[0].sill = { conn: 'ltp4', spacing_in: 16, sheathing: thk }; return compute(st); };
        return { none: mk('none'), t38: mk('0.375'), t12: mk('0.5') }; },
      expect: function (r) {
        return [['LTP4 direct to framing = 715 lb', near(W(r.none, 0).sill.Vconn, 715, 0.5), f1(W(r.none, 0).sill.Vconn)],
                ['over ⅜" sheathing × 0.72 = 514.8 lb', near(W(r.t38, 0).sill.Vconn, 514.8, 0.5), f1(W(r.t38, 0).sill.Vconn)],
                ['over ½" sheathing × 0.64 = 457.6 lb', near(W(r.t12, 0).sill.Vconn, 457.6, 0.5), f1(W(r.t12, 0).sill.Vconn)]]; } },
    { id: 'SW24', src: 'NDS 2018 Table 12E — anchor bolt plf', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 3);
        return [['⅝" AB = 1,488 lb/bolt (930 × 1.6)', near(a.sill.Vconn, 1488, 1), f1(a.sill.Vconn)],
                ['@ 20" o.c. = 892.8 plf', near(a.sill.plf, 892.8, 0.5), f2(a.sill.plf)],
                ['basis stated', a.sill.basis.indexOf('Table 12E') >= 0, a.sill.basis]]; } },
    { id: 'SW25', src: 'NDS 2018 Table 12E — SPF sill (G = 0.42)', run: function () {
        var st = mkState(CASE1); st.floors[3].walls[0].sillSpecies = 'SPF'; return compute(st); },
      expect: function (r) { var a = W(r, 3);
        return [['⅝" AB in an SPF sill = 1,360 lb (850 × 1.6)', near(a.sill.Vconn, 1360, 1), f1(a.sill.Vconn)],
                ['@ 20" o.c. = 816.0 plf', near(a.sill.plf, 816.0, 0.5), f2(a.sill.plf)]]; } },
    { id: 'SW26', src: 'SDPWS §4.3.6.4.3 / connector placement', run: function () {
        var st = mkState(CASE1); st.floors[0].walls[0].sill = { conn: 'ab58', spacing_in: 20, sheathing: 'none' }; return compute(st); },
      expect: function (r) {
        return [['anchor bolt refused above the base level', r.errors.some(function (e) { return e.indexOf('foundation connector') >= 0; }), r.errors.join(' | ') || '(none)']]; } },
    { id: 'SW27', src: 'SDPWS §4.3.6.4.3 plate washer note', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 3);
        return [['plate washer note printed (nominal 670 > 400 plf)', a.messages.some(function (m) { return m.indexOf('plate washer') >= 0; }), a.messages.join(' | ')]]; } },

    // ── Validation ────────────────────────────────────────────────────────
    { id: 'SW28', src: 'engine v1 record refused', run: function () { var st = mkState(CASE1); st.version = 1; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false, String(v.ok)],
                ['exact message', v.errors[0] === V1_REFUSAL, v.errors[0]],
                ['wording exported once as SW.V1_REFUSAL', V1_REFUSAL === 'This record was saved by engine v1 and cannot be reused; re-enter the wall', V1_REFUSAL]]; } },
    { id: 'SW28b', src: 'negative geometry refused', run: function () {
        var neg = mkState(CASE3); neg.floors[0].walls[0].segments_ft = [32, -4];
        var unsh = mkState(CASE3); unsh.floors[0].walls[0].unsheathed_ft2 = -50;
        var zero = mkState(CASE3); zero.floors[0].walls[0].segments_ft = [32, 0];
        return { neg: validate(neg), unsh: validate(unsh), zero: validate(zero) }; },
      expect: function (v) {
        return [['negative segment width refused', v.neg.ok === false && v.neg.errors.some(function (e) { return e.indexOf('segment width b_i') >= 0; }), v.neg.errors.join(' | ') || '(none)'],
                ['zero segment width refused', v.zero.ok === false && v.zero.errors.some(function (e) { return e.indexOf('segment width b_i') >= 0; }), v.zero.errors.join(' | ') || '(none)'],
                ['negative unsheathed area refused', v.unsh.ok === false && v.unsh.errors.some(function (e) { return e.indexOf('cannot be negative') >= 0; }), v.unsh.errors.join(' | ') || '(none)']]; } },
    { id: 'SW28c', src: 'endPostCheck refuses unknown ids', run: function () {
        var out = {};
        try { endPostCheck({ n: 2, size: '2x6' }, 'XYZ', 10, 1000); out.species = 'accepted'; }
        catch (e) { out.species = e.message; }
        try { endPostCheck({ n: 2, size: '3x9' }, 'DFL', 10, 1000); out.size = 'accepted'; }
        catch (e) { out.size = e.message; }
        return out; },
      expect: function (o) {
        return [['unknown species throws instead of falling back to DF-L', o.species.indexOf('unknown species id') >= 0, o.species],
                ['unknown post size throws instead of falling back to 2x6', o.size.indexOf('unknown end post size') >= 0, o.size]]; } },
    { id: 'SW29', src: 'wall-line continuity', run: function () {
        var st = mkState(CASE1); st.floors[1].walls = []; return validate(st); },
      expect: function (v) {
        return [['gap is an error', v.ok === false && v.errors.some(function (e) { return e.indexOf('missing at') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW30', src: 'wall-line continuity — transfer:true', run: function () {
        var st = mkState(CASE1); st.floors[1].walls = []; st.floors[2].walls[0].transfer = true; return validate(st); },
      expect: function (v) {
        return [['transfer:true accepted', v.ok === true, v.errors.join(' | ') || 'ok'],
                ['warning raised', v.warnings.some(function (x) { return x.indexOf('discontinuous') >= 0; }), v.warnings.join(' | ') || '(none)']]; } },
    { id: 'SW31', src: 'Σb_i = 0 refused', run: function () {
        var st = mkState(CASE1); st.floors[0].walls[0].segments_ft = []; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false && v.errors.some(function (e) { return e.indexOf('Σb_i = 0') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW32', src: 'segments + openings > L refused', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].segments_ft = [36]; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false && v.errors.some(function (e) { return e.indexOf('exceeds L') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW33', src: 'SDPWS §4.3.2.3(8) h ≤ 20 ft', run: function () {
        var st = mkState(CASE3); st.floors[0].h_ft = 22; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false && v.errors.some(function (e) { return e.indexOf('20 ft limit') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW34', src: 'clear opening height ≤ h', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].openings = [{ w_ft: 8, hc_ft: 12 }]; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false && v.errors.some(function (e) { return e.indexOf('exceeds the wall height') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW35', src: 'SDPWS Eq. 4.3-6 h/3 minimum opening height', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].openings = [{ w_ft: 8, hc_ft: 2 }]; return compute(st); },
      expect: function (r) { var a = W(r, 0);
        return [['A_o uses h/3 = 3.33 ft, A_o = 26.67 sf', near(a.geom.Ao, 26.667, 0.01), f3(a.geom.Ao)],
                ['note printed', a.messages.some(function (m) { return m.indexOf('h/3') >= 0; }), a.messages.join(' | ')]]; } },
    { id: 'SW36', src: 'SDPWS §4.3.2.3(9) Exception — unsheathed area in A_o', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].unsheathed_ft2 = 20; return compute(st); },
      expect: function (r) { var a = W(r, 0);
        return [['A_o = 56 + 20 = 76 sf', near(a.geom.Ao, 76.0, 0.01), f2(a.geom.Ao)]]; } },
    { id: 'SW37', src: 'gypsum cannot be face 1 (SDPWS §4.3.2.3)', run: function () {
        var st = mkState(CASE3); st.floors[0].walls[0].sheathing.face1 = { type: 'gyp', thickness: '5/8', nail: '6d cooler', spacing: 7 }; return validate(st); },
      expect: function (v) {
        return [['refused', v.ok === false && v.errors.some(function (e) { return e.indexOf('wood structural panel') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    { id: 'SW38', src: 'SDPWS §4.3.7.1(5) prerequisite text', run: function () {
        return compute(mkState(CASE_SHEATH({ sdc: 'D', face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 3 } }))); },
      expect: function (r) { var a = W(r, 0);
        return [['3x framing / staggered nailing printed', a.messages.some(function (m) { return m.indexOf('3x nominal framing') >= 0; }), a.messages.join(' | ')],
                ['10d @ 3" trigger named', a.cap.prereqs.some(function (p) { return p.indexOf('10d common') >= 0; }), a.cap.prereqs.join(' | ')],
                ['> 980 plf in SDC D named', a.cap.prereqs.some(function (p) { return p.indexOf('980 plf') >= 0; }), a.cap.prereqs.join(' | ')]]; } },
    { id: 'SW39', src: 'controlling case reported per wall', run: function () {
        var st = mkState(CASE3);
        st.floors.forEach(function (f) { f.P_seis_lb = f.P_wind_lb * 3; });
        return compute(st); },
      expect: function (r) { var a = W(r, 1);
        return [['seismic governs the shear check', a.checks.filter(function (c) { return c.id === 'sheathing'; })[0].caseKey === 'seismic', a.checks.filter(function (c) { return c.id === 'sheathing'; })[0].caseKey],
                ['seismic governs T', a.gov.Tcase === 'seismic', a.gov.Tcase]]; } },
    { id: 'SW40', src: 'uplift connector default', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var row = W(r, 3).checks.filter(function (c) { return c.id === 'uplift'; })[0];
        return [['row shows the demand', near(row.demand, 70.29, 0.02), f2(row.demand)],
                ['"connector required" when not specified', row.capacityTxt.indexOf('connector required') >= 0, row.capacityTxt],
                ['not counted as a pass', row.pass === null, String(row.pass)]]; } },
    { id: 'SW41', src: 'NDS §3.7.1 end post', run: function () { return compute(mkState(CASE3)); },
      expect: function (r) { var p = W(r, 1).endPost;
        return [['(2) 2x6 → A = 3.00" × 5.50" = 16.50 in²', near(p.A, 16.50, 0.01), f2(p.A)],
                ['C_F = 1.10 for 2x6 DF-L', near(p.CF, 1.10, 1e-9), f2(p.CF)],
                ["F_c* = 1350 × 1.6 × 1.10 = 2,376 psi", near(p.FcStar, 2376, 1), f1(p.FcStar)],
                ['C_P computed and ≤ 1', p.CP > 0 && p.CP <= 1, f4(p.CP)],
                ['slenderness ≤ 50', p.slendOK === true, f1(p.slend)]]; } },
    { id: 'SW43', src: 'SDPWS Table 4.3.3 note 2 — gypsum aspect ratio', run: function () {
        var gyp = { type: 'gyp', thickness: '5/8', nail: '6d cooler', spacing: 7 };
        return { a: compute(mkState(CASE_SHEATH({ face2: gyp, segments: [4] }))),          // max h/b = 2.5
                 b: compute(mkState(CASE_SHEATH({ face2: gyp, segments: [8, 2.5] }))) }; }, // max h/b = 4.0
      expect: function (r) { var a = W(r.a, 0), b = W(r.b, 0);
        return [['h/b = 2.5: gypsum counted for wind (3.5:1 limit) → 960 plf', near(a.cap.wind.vn, 960, 0.1), f1(a.cap.wind.vn)],
                ['h/b = 2.5: gypsum dropped for seismic (2:1 limit) → 670 plf', near(a.cap.seismic.vn, 670, 0.1), f1(a.cap.seismic.vn)],
                ['seismic reason names the aspect ratio', a.cap.faceNotes.some(function (x) { return x.indexOf('aspect ratio') >= 0; }), a.cap.faceNotes.join(' | ') || '(none)'],
                ['h/b = 4.0: gypsum dropped for wind as well → 670 plf', near(b.cap.wind.vn, 670, 0.1), f1(b.cap.wind.vn)],
                ['h/b = 4.0: Σb_i still 8.0 ft (2.5 ft segment excluded)', near(b.geom.sumBi, 8.0, 0.01), f2(b.geom.sumBi)]]; } },
    { id: 'SW42', src: 'default model computes clean', run: function () { return compute(defaultState()); },
      expect: function (r) {
        return [['no errors', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['4 levels', r.floors.length === 4, String(r.floors.length)],
                ['base level labelled', r.floors[3].levelLabel === 'Base level (foundation)', r.floors[3].levelLabel],
                ['C_o 0.6074 / 0.6774 / 0.6774 / 0.6703', r.floors.map(function (f) { return f.walls[0].geom.Co.toFixed(4); }).join('/') === '0.6074/0.6774/0.6774/0.6703', r.floors.map(function (f) { return f.walls[0].geom.Co.toFixed(4); }).join('/')]]; } },

    // ── Per-wall line force override (lateral handoff Phase 1) ────────────
    // A wall's own P_wind_lb / P_seis_lb, where a finite number, replaces the
    // level force for that line at that level; null / absent inherits the level.
    { id: 'SW44', src: 'line force override — two walls, one floor', run: function () {
        var st = mkState(CASE3);
        st.floors.forEach(function (f) { var b = clone(f.walls[0]); b.id = 'w2'; b.label = 'Wall Line B'; f.walls.push(b); });
        // Upper: A = 5,000 / B = 3,000; Lower: A = 4,000 / B = 2,000 (strength, wind).
        st.floors[0].walls[0].P_wind_lb = 5000; st.floors[0].walls[1].P_wind_lb = 3000;
        st.floors[1].walls[0].P_wind_lb = 4000; st.floors[1].walls[1].P_wind_lb = 2000;
        return compute(st); },
      expect: function (r) { var a = r.floors[1].walls[0].cases.wind, b = r.floors[1].walls[1].cases.wind;
        return [['model ok', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['wall A: ΣP = 5,000 + 4,000 = 9,000 lb (not the level total)', near(a.Vstrength, 9000, 1e-6), f1(a.Vstrength)],
                ['wall B: ΣP = 3,000 + 2,000 = 5,000 lb', near(b.Vstrength, 5000, 1e-6), f1(b.Vstrength)],
                ['wall A: V = 0.6 × 9,000 = 5,400 lb', near(a.V, 5400, 1e-6), f1(a.V)],
                ['wall B rows tagged src = wall', b.rows.every(function (x) { return x.src === 'wall'; }), b.rows.map(function (x) { return x.src; }).join(',')],
                ['seismic still inherits the level (no override)', near(r.floors[1].walls[1].cases.seismic.Vstrength, (8000 + 6000) / 0.7, 1e-6), f1(r.floors[1].walls[1].cases.seismic.Vstrength)]]; } },
    { id: 'SW45', src: 'line force override at the roof, inherit at the base', run: function () {
        var st = mkState(CASE3);
        st.floors[0].walls[0].P_wind_lb = 5000;      // roof: line force
        st.floors[1].walls[0].P_wind_lb = null;      // base: inherit 6,000 / 0.6
        return compute(st); },
      expect: function (r) { var c = r.floors[1].walls[0].cases.wind;
        return [['ΣP = 5,000 + 10,000 = 15,000 lb (mixed sum)', near(c.Vstrength, 5000 + 6000 / 0.6, 1e-6), f1(c.Vstrength)],
                ['row src = wall / level', c.rows.map(function (x) { return x.src; }).join('/') === 'wall/level', c.rows.map(function (x) { return x.src; }).join('/')],
                ['roof wall unchanged by the base', near(r.floors[0].walls[0].cases.wind.Vstrength, 5000, 1e-6), f1(r.floors[0].walls[0].cases.wind.Vstrength)]]; } },
    { id: 'SW46', src: 'line force override across a transfer gap', run: function () {
        var st = mkState(CASE1);
        st.floors[1].walls = [];                     // wall absent at the 3rd Floor
        st.floors[2].walls[0].transfer = true;       // declared on the wall below the gap
        st.floors[0].walls[0].P_wind_lb = 1000;
        st.floors[2].walls[0].P_wind_lb = 2000;
        st.floors[3].walls[0].P_wind_lb = 3000;
        return compute(st); },
      expect: function (r) { var c = r.floors[3].walls[0].cases.wind;
        return [['model ok (transfer declared)', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['only present levels sum: 1,000 + 2,000 + 3,000 = 6,000 lb', near(c.Vstrength, 6000, 1e-6), f1(c.Vstrength)],
                ['three rows, the gap level absent', c.rows.length === 3 && c.rows.every(function (x) { return x.level !== '3rd Floor'; }), c.rows.map(function (x) { return x.level; }).join(',')]]; } },
    { id: 'SW47', src: 'line force override must be a finite number', run: function () {
        var bad = mkState(CASE3); bad.floors[0].walls[0].P_wind_lb = 'abc';
        var neg = mkState(CASE3); neg.floors[0].walls[0].P_seis_lb = -1;
        var blank = mkState(CASE3); blank.floors[0].walls[0].P_wind_lb = ''; blank.floors[1].walls[0].P_seis_lb = undefined;
        return { bad: validate(bad), neg: validate(neg), blank: validate(blank) }; },
      expect: function (v) {
        return [['"abc" refused', v.bad.ok === false && v.bad.errors.some(function (e) { return e.indexOf('wall-line force') >= 0; }), v.bad.errors.join(' | ') || '(none)'],
                ['negative refused', v.neg.ok === false && v.neg.errors.some(function (e) { return e.indexOf('wall-line force') >= 0; }), v.neg.errors.join(' | ') || '(none)'],
                ['blank / undefined inherit and pass', v.blank.ok === true, v.blank.errors.join(' | ') || 'ok']]; } },

    // ── Species-dependent hardware (C-C-2026 p. 61 / p. 310, NDS Table 12N) ──
    { id: 'SW48', src: 'NDS Table 12N 16d / Simpson SDS — value by the lower G of sill and framing', run: function () {
        var mk = function (species, sillSpecies, conn) {
          var st = mkState(CASE_HD); st.species = species;
          st.floors[0].walls[0].sill = { conn: conn || '16d', spacing_in: conn ? 12 : 16, sheathing: 'none' }; st.floors[0].walls[0].sillSpecies = sillSpecies;
          return compute(st); };
        return { spfSill: mk('DFL', 'SPF'), spfFrame: mk('SPF', 'DFL'), sp: mk('SP', 'SP'), spSillDflFrame: mk('DFL', 'SP'), dfl: mk('DFL', 'DFL'),
                 sdsSpfFrame: mk('SPF', 'DFL', 'sds14'), sdsSpfSill: mk('DFL', 'SPF', 'sds14'), sdsSp: mk('SP', 'DFL', 'sds14') }; },
      expect: function (r) {
        var a = W(r.spfSill, 0), b = W(r.spfFrame, 0), c = W(r.sp, 0), d = W(r.spSillDflFrame, 0), e = W(r.dfl, 0);
        var f = W(r.sdsSpfFrame, 0), g = W(r.sdsSpfSill, 0), k = W(r.sdsSp, 0);
        return [['SDS ¼×4½: DFL sill on SPF framing = 304 lb (either member SPF/HF), 304.0 plf @ 12"', near(f.sill.Vconn, 304, 1e-9) && near(f.sill.plf, 304, 1e-6) && f.sill.nailGov === 'framing', f1(f.sill.Vconn) + ' ' + f.sill.nailGov],
                ['SDS ¼×4½: SPF sill on DFL framing = 304 lb', near(g.sill.Vconn, 304, 1e-9) && g.sill.nailGov === 'sill', f1(g.sill.Vconn) + ' ' + g.sill.nailGov],
                ['SDS ¼×4½: DFL sill on SP framing = 400 lb (DF/SP row, DFL governs)', near(k.sill.Vconn, 400, 1e-9) && k.sill.valueSpecies === 'DFL', f1(k.sill.Vconn) + ' ' + k.sill.valueSpecies],
                ['SDS note names the sole-to-rim rule', f.sill.notes.some(function (x) { return x.indexOf('either member is SPF/HF') >= 0; }), f.sill.notes.join(' | ')],['SPF sill on DFL framing: 120 × 1.6 = 192 lb per nail', near(a.sill.Vconn, 192, 1e-9), f1(a.sill.Vconn)],
                ['@ 16" o.c. = 144.0 plf', near(a.sill.plf, 144.0, 1e-6), f2(a.sill.plf)],
                ['sill species governs, printed', a.sill.nailGov === 'sill' && a.sill.valueSpecies === 'SPF' && a.sill.notes.some(function (x) { return x.indexOf('sill species governs') >= 0; }), a.sill.notes.join(' | ')],
                ['DFL sill on SPF framing: framing governs, 192 lb', near(b.sill.Vconn, 192, 1e-9) && b.sill.nailGov === 'framing', f1(b.sill.Vconn) + ' ' + b.sill.nailGov],
                ['SP sill on SP framing: 154 × 1.6 = 246 lb (was 226)', near(c.sill.Vconn, 246, 1e-9) && c.sill.nailGov === 'both', f1(c.sill.Vconn) + ' ' + c.sill.nailGov],
                ['SP sill on DFL framing: 226 lb (DFL governs)', near(d.sill.Vconn, 226, 1e-9) && d.sill.valueSpecies === 'DFL', f1(d.sill.Vconn) + ' ' + d.sill.valueSpecies],
                ['DFL / DFL: 141 × 1.6 = 226 lb, 169.5 plf unchanged', near(e.sill.Vconn, 226, 1e-9) && near(e.sill.plf, 169.5, 1e-6), f1(e.sill.Vconn) + ' / ' + f2(e.sill.plf)],
                ['basis names Table 12N and the three G values', e.sill.basis.indexOf('Table 12N') >= 0 && e.sill.basis.indexOf('154') >= 0 && e.sill.basis.indexOf('120') >= 0, e.sill.basis]]; } },
    { id: 'SW49', src: 'C-C-2026 p. 61 — HDUE on SPF framing reads the SPF/HF column', run: function () {
        // P = 9,400 lb ASD puts T = 3,583.75 lb between HDUE3's SPF/HF (3,340) and DF/SP (3,790) values.
        var mk = function (species) { var st = mkState(CASE_HD); st.species = species; st.floors[0].P_wind_lb = 9400 / 0.6; st.floors[0].P_seis_lb = 9400 / 0.7; return compute(st); };
        var big = mkState(CASE_HD); big.species = 'SPF';   // T = 8,006 lb: no SPF/HF value on a 3" post reaches it
        return { r: mk('SPF'), dfl: mk('DFL'), big: compute(big), hd5: HOLDOWNS[1], hd13: HOLDOWNS[4], hd17: HOLDOWNS[5] }; },
      expect: function (o) { var a = W(o.r, 0), b = W(o.big, 0), d = W(o.dfl, 0);
        return [['model ok — SPF is covered, no refusal', o.r.ok === true, o.r.errors.join(' | ') || 'ok'],
                ['T = 3,583.75 lb between 3,340 (HDUE3 SPF/HF) and 3,790 (HDUE3 DF/SP)', near(a.gov.T, 3583.75, 0.01), f2(a.gov.T)],
                ['same wall on DFL framing: HDUE3-SDS3 at 3,790 lb', d.holdown.label === 'HDUE3-SDS3' && near(d.holdown.capacity, 3790, 1e-9) && d.holdown.column === 'DF/SP', d.holdown.label + ' ' + f1(d.holdown.capacity)],
                ['on SPF framing: HDUE3 (3,340) is short → HDUE5-SDS3', a.holdown.label === 'HDUE5-SDS3', a.holdown.label],
                ['capacity 4,700 lb (SPF/HF at 3" thickness), not 5,375', near(a.holdown.capacity, 4700, 1e-9) && a.holdown.column === 'SPF/HF', f1(a.holdown.capacity) + ' ' + a.holdown.column],
                ['detail names the SPF/HF column and p. 61', a.holdown.detail.indexOf('SPF/HF') >= 0 && a.holdown.detail.indexOf('p. 61') >= 0, a.holdown.detail],
                ['HDUE5 at 3" thickness = 4,700 lb SPF/HF', holdownCapacity(o.hd5, 3.0, 5.5, 'SPF') === 4700, String(holdownCapacity(o.hd5, 3.0, 5.5, 'SPF'))],
                ['HDUE13 SPF/HF 10,215 / 11,030 / 10,980 (6×6)', holdownCapacity(o.hd13, 5.5, 3.5, 'SPF') === 10215 && holdownCapacity(o.hd13, 7.25, 3.5, 'SPF') === 11030 && holdownCapacity(o.hd13, 5.5, 5.5, 'SPF') === 10980,
                  [holdownCapacity(o.hd13, 5.5, 3.5, 'SPF'), holdownCapacity(o.hd13, 7.25, 3.5, 'SPF'), holdownCapacity(o.hd13, 5.5, 5.5, 'SPF')].join('/')],
                ['HDUE13 SPF/HF on a 7¼" × 5½" post = 11,030 (7¼" step beats the 6×6 value)', holdownCapacity(o.hd13, 7.25, 5.5, 'SPF') === 11030, String(holdownCapacity(o.hd13, 7.25, 5.5, 'SPF'))],
                ['HDUE17 SPF/HF 13,545 / 14,775 (6×6)', holdownCapacity(o.hd17, 5.5, 3.5, 'SPF') === 13545 && holdownCapacity(o.hd17, 5.5, 5.5, 'SPF') === 14775,
                  holdownCapacity(o.hd17, 5.5, 3.5, 'SPF') + '/' + holdownCapacity(o.hd17, 5.5, 5.5, 'SPF')],
                ['over-capacity label names the SPF/HF column and the species', b.holdown.label.indexOf('Exceeds HDUE7-SDS3 (6030.0 lb, SPF/HF)') === 0 && b.holdown.label.indexOf('Spruce-Pine-Fir end post') > 0, b.holdown.label],
                ['SPF steps are lower than DF/SP on every row', HOLDOWNS.every(function (hd) { return hd.bySpecies.SPF.steps.every(function (st, i) { return st.T < hd.bySpecies.DFL.steps[i].T && st.t === hd.bySpecies.DFL.steps[i].t; }); }), 'ok'],
                ['every row carries a column for every species', ['DFL', 'SP', 'SPF'].every(holdownSpeciesCovered), 'ok']]; } },
    { id: 'SW50', src: 'C-C-2026 p. 310 — LTP4 on an SPF sill reads the SPF/HF column', run: function () {
        var mk = function (sillSpecies, thk) { var st = mkState(CASE_HD); st.floors[0].walls[0].sill = { conn: 'ltp4', spacing_in: 16, sheathing: thk }; st.floors[0].walls[0].sillSpecies = sillSpecies; return compute(st); };
        return { spf: mk('SPF', 'none'), spf38: mk('SPF', '0.375'), sp: mk('SP', 'none') }; },
      expect: function (r) { var a = W(r.spf, 0), b = W(r.spf38, 0), c = W(r.sp, 0);
        return [['model ok — no refusal', r.spf.ok === true, r.spf.errors.join(' | ') || 'ok'],
                ['LTP4 SPF/HF direct to framing = 615 lb', near(a.sill.Vconn, 615, 1e-9), f1(a.sill.Vconn)],
                ['@ 16" o.c. = 461.25 plf', near(a.sill.plf, 461.25, 1e-6), f2(a.sill.plf)],
                ['over ⅜" sheathing × 0.72 = 442.8 lb', near(b.sill.Vconn, 442.8, 1e-9), f1(b.sill.Vconn)],
                ['SP sill = 715 lb (DF/SP column)', near(c.sill.Vconn, 715, 1e-9), f1(c.sill.Vconn)],
                ['basis cites p. 310 and both columns', a.sill.basis.indexOf('p. 310') >= 0 && a.sill.basis.indexOf('615') >= 0, a.sill.basis]]; } }
  ];

  // Fixture input models.
  var CASE1 = { stories: [
    { name: '4th Floor', h: 8.0, P: 2783, L: 302, segments: [172], openings: [[130, 6.67]] },
    { name: '3rd Floor', h: 9.5, P: 1661, L: 302, segments: [172], openings: [[130, 6.67]] },
    { name: '2nd Floor', h: 9.5, P: 1738, L: 302, segments: [172], openings: [[130, 6.67]] },
    { name: '1st Floor', h: 10.5, P: 1921, L: 302, segments: [172], openings: [[130, 7.50]] }
  ] };
  var CASE2 = { stories: [
    { name: 'Roof', h: 10, P: 0.7 * 12989, L: 29, segments: [29], openings: [], face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } },
    { name: '6th Floor', h: 10, P: 0.7 * 11311, L: 29, segments: [29], openings: [], face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } },
    { name: '5th Floor', h: 10, P: 0.7 * 8590, L: 29, segments: [29], openings: [], face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } },
    { name: '4th Floor', h: 10, P: 0.7 * 5727, L: 29, segments: [29], openings: [], face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } },
    { name: '3rd Floor', h: 10, P: 0.7 * 2863, L: 29, segments: [29], openings: [], face1: { type: 'wsp', thickness: '15/32', nail: '10d common', spacing: 4 } }
  ] };
  var CASE3 = { stories: [
    { name: 'Upper', h: 10.0, P: 8000, L: 40, segments: [32], openings: [[8, 7.0]] },
    { name: 'Lower', h: 10.0, P: 6000, L: 40, segments: [16], openings: [[24, 8.0]] }
  ] };
  var CASE3DL = { stories: [
    { name: 'Upper', h: 10.0, P: 8000, L: 40, segments: [32], openings: [[8, 7.0]], w: 200 },
    { name: 'Lower', h: 10.0, P: 6000, L: 40, segments: [16], openings: [[24, 8.0]], w: 200 }
  ] };
  var CASE4 = { stories: [{ name: 'Single', h: 10.0, P: 3000, L: 40, segments: [32], openings: [[8, 7.0]], w: 840 }] };
  var CASE5 = { stories: [{ name: 'Single', h: 10.0, P: 3000, L: 40, segments: [32], openings: [[8, 7.0]], Pend: 2000 }] };
  // Two-story probes: the wall under test is the upper level, so that the
  // above-base connectors (LTP4 / 16d / SDS) and coil straps are legal there.
  // P = 21,000 lb ASD puts T between the HDUE7 and HDUE9 steps.
  var BASE_STORY = { name: 'Base', h: 10.0, P: 0, L: 40, segments: [32], openings: [[8, 7.0]], sill: 'ab58', spacing: 20 };
  var CASE_HD = { stories: [
    { name: 'Upper', h: 10.0, P: 21000, L: 40, segments: [32], openings: [[8, 7.0]], sill: 'sds14', spacing: 12 },
    BASE_STORY
  ] };
  function CASE_SHEATH(o) {
    var s = { name: 'Upper', h: 10.0, P: 1000, L: 40, segments: o.segments || [32], openings: [[8, 7.0]], sill: 'sds14', spacing: 12 };
    if (o.face1) s.face1 = o.face1;
    if (o.face2) s.face2 = o.face2;
    if (o.insideFaceHoldown) s.insideFaceHoldown = true;
    return { stories: [s, BASE_STORY], species: o.species || 'DFL', sdc: o.sdc || 'D' };
  }

  function runFixtures() {
    var lines = [], pass = 0, total = 0;
    FIXTURES.forEach(function (fx) {
      var r, items, threw = false;
      try { r = fx.run(); } catch (e) { threw = true; items = [['run threw: ' + String(e), false, String(e)]]; }
      if (!threw) { try { items = fx.expect(r); } catch (e2) { items = [['expect threw', false, String(e2 && e2.stack || e2)]]; } }
      items.forEach(function (it) { total++; if (it[1]) pass++; lines.push((it[1] ? 'PASS ' : 'FAIL ') + fx.id + ' [' + fx.src + '] ' + it[0] + '  ->  ' + it[2]); });
    });
    return { pass: pass, total: total, lines: lines };
  }

  var SW = {
    ENGINE: ENGINE, LOAD: LOAD, DEAD_FACTOR: DEAD_FACTOR, V1_REFUSAL: V1_REFUSAL,
    SPECIES: SPECIES, SFRS: SFRS, POST_SIZES: POST_SIZES, CF_FC: CF_FC,
    SHEATHING: SHEATHING, HOLDOWNS: HOLDOWNS, STRAPS: STRAPS, SILL_CONN: SILL_CONN,
    LTP4_SHEATHING: LTP4_SHEATHING, STRAP_MIN_G: STRAP_MIN_G, HD_COLUMN: HD_COLUMN,
    compute: compute, validate: validate, runFixtures: runFixtures, FIXTURES: FIXTURES,
    calcCo: calcCo, calcR: calcR, sumBi: sumBi, openingArea: openingArea,
    storyForces: storyForces, chordForce: chordForce,
    sheathingCapacity: sheathingCapacity, combineFaces: combineFaces,
    holdownCapacity: holdownCapacity, holdownSpeciesCovered: holdownSpeciesCovered, endPostCheck: endPostCheck,
    findSheathing: findSheathing, findSill: findSill, sheathingLabel: sheathingLabel,
    resolveDead: resolveDead, defaultState: defaultState, defaultWall: defaultWall,
    clone: clone
  };
  root.SW = SW;
  if (typeof module !== 'undefined' && module.exports) module.exports = SW;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
