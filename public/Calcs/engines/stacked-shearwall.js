/* =============================================================================
   SW engine — stacked shear walls, perforated or segmented per wall,
   SDPWS 2021 / NDS 2018 / ASCE 7-16.
   DOM-free.  window.SW.compute(state) -> result.

   Code basis (every clause verified against the AWC PDF, not from memory):
     SDPWS 2021 §4.1.4.1   ASD seismic = nominal / 2.8
     SDPWS 2021 §4.1.4.2   ASD wind    = nominal / 2.0
     SDPWS 2021 §4.3.2.1   individual full-height wall segments (segmented method; 2015 §4.3.5.1)
     SDPWS 2021 §4.3.2.3   perforated shear wall limitations (items 2,4,6,7,8,9)
     SDPWS 2021 §4.3.3.1 / Table 4.3.3  maximum aspect ratio 3.5:1, blocked WSP (2015 §4.3.4.1 / Table 4.3.4)
     SDPWS 2021 §4.3.3.4   perforated shear wall segment aspect ratios, Sigma b_i
     SDPWS 2021 §4.3.5.5.1 Exc. 1  segmented: distribution proportional to design capacity, 2b/h on
                           h/b > 2:1, "need not be further reduced by 4.3.3.2" (2015 §4.3.3.4.1 Exc. 1);
                           the same rule splits a wall line's force between its walls (equal rigidity)
     SDPWS 2021 §4.3.6.1.2 Eq. 4.3-7  segment chord T = C = v·h, lever b_i (2015 same)
     SDPWS 2021 §4.3.6.4.2 uplift anchorage at the ends of each (segmented) shear wall
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
     NDS 2018 §12.2.3.1 / Table 12.2C  nail withdrawal W (lb/in); §12.1.6.4 p_min = 6D
     NDS 2018 §12.2.2 / Table 12.2B    wood-screw withdrawal (SDS as a No. 14, ESR-2236 §4.1.3)
     NDS 2018 §12.4.1 / §12.4.2        combined lateral + withdrawal, Eq. 12.4-1 / 12.4-2
     NDS 2018 Table 12N fn. 3          Z x p/10D where 6D <= p < 10D
     NDS 2018 Table 2.3.2 / 11.3.1     C_D 1.6 on connections; no C_D on F_c-perp (Table 4.3.1)
     NDS Supplement Tables 4A / 4B     F_c-perp for the sill plate-washer bearing check

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
  // FcP = F_c⊥ (psi), same tables and grade — Supplement PDF p. 42 (DF-L, printed
  // p. 34), p. 45 (SPF, printed p. 37), p. 48 (SP No. 2, 2"–4" wide, printed p. 40).
  // No C_D on F_c⊥ (NDS Table 4.3.1; Table 2.3.2 fn. 1).
  var SPECIES = {
    DFL: { id: 'DFL', label: 'Douglas Fir-Larch', G: 0.50, Emin: 580000, FcP: 625, Fc: { '2x4': 1350, '2x6': 1350, '2x8': 1350, '2x10': 1350, '2x12': 1350, '4x4': 1350, '4x6': 1350, '4x8': 1350, '6x6': 1350 }, sizeFactor: true, table: 'NDS Table 4A (No. 2)' },
    SP:  { id: 'SP',  label: 'Southern Pine',     G: 0.55, Emin: 580000, FcP: 565, Fc: { '2x4': 1450, '2x6': 1400, '2x8': 1350, '2x10': 1300, '2x12': 1250, '4x4': 1450, '4x6': 1400, '4x8': 1350, '6x6': 1400 }, sizeFactor: false, table: 'NDS Table 4B (No. 2, size factors incorporated)' },
    SPF: { id: 'SPF', label: 'Spruce-Pine-Fir',   G: 0.42, Emin: 510000, FcP: 425, Fc: { '2x4': 1150, '2x6': 1150, '2x8': 1150, '2x10': 1150, '2x12': 1150, '4x4': 1150, '4x6': 1150, '4x8': 1150, '6x6': 1150 }, sizeFactor: true, table: 'NDS Table 4A (No. 2)' }
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

  // ── nails, NDS 2018 Table L4 (PDF p. 196) ──────────────────────────────────
  // D × L from Table L4. W = reference withdrawal, lb per inch of penetration,
  // Table 12.2C (PDF p. 93, printed p. 79) at the G of the RECEIVING member,
  // keyed by species id (SP G 0.55 / DFL 0.50 / SPF 0.42). Z = reference lateral
  // value, Table 12N (PDF p. 125, printed p. 111), t_s = 1½" side member, both
  // members of the same G; the 8d rows at t_s = 1½" carry Table 12N fn. 4 (the
  // nail is too short for 10D), so fn. 3's p/10D factor is applied in computeWall.
  var NAILS = {
    '16d':    { id: '16d',    label: '16d common nails', D: 0.162, L: 3.5, W: { SP: 50, DFL: 40, SPF: 26 }, Z: { SP: 154, DFL: 141, SPF: 120 } },
    '10d':    { id: '10d',    label: '10d common nails', D: 0.148, L: 3.0, W: { SP: 46, DFL: 36, SPF: 23 }, Z: { SP: 128, DFL: 118, SPF: 100 } },
    '8d':     { id: '8d',     label: '8d common nails',  D: 0.131, L: 2.5, W: { SP: 41, DFL: 32, SPF: 21 }, Z: { SP: 106, DFL: 97,  SPF: 82 } },
    '16dbox': { id: '16dbox', label: '16d box nails',    D: 0.135, L: 3.5, W: { SP: 42, DFL: 33, SPF: 21 }, Z: { SP: 113, DFL: 103, SPF: 88 } },
    '10dbox': { id: '10dbox', label: '10d box nails',    D: 0.128, L: 3.0, W: { SP: 40, DFL: 31, SPF: 20 }, Z: { SP: 101, DFL: 93,  SPF: 79 } },
    '8dbox':  { id: '8dbox',  label: '8d box nails',     D: 0.113, L: 2.5, W: { SP: 35, DFL: 28, SPF: 18 }, Z: { SP: 79,  DFL: 72,  SPF: 61 } }
  };
  var PLATE_THK = 1.5;          // the bottom plate the fastener passes through, in
  var SUBFLOOR_THK = 0.75;      // assumed under the plate on every floor above the base, in
  var CD_CONN = 1.6;            // NDS Table 2.3.2, wind / earthquake; fn. 2 caps connections at 1.6
  // Fastener length in inches as a printable fraction (3.5 -> 3½").
  function fracIn(x) {
    var w = Math.floor(x + 1e-9), f = x - w, t = f > 0.74 ? '¾' : (f > 0.49 ? '½' : (f > 0.24 ? '¼' : ''));
    return (w || !t ? String(w) : '') + t + '"';
  }

  // ── sill / bottom-plate shear connectors, per connector at C_D = 1.6 ───────
  // `bySillSpecies` is keyed by the SILL species, except rows flagged `minG`
  // (nails, `sds14`), which the engine reads at the LOWER-G of sill and framing
  // species — `minGWhy` says why; computeWall prints which governed.
  // Nail rows are built from NAILS: Z × 1.6, rounded to the lb (the 16d row keeps
  // its 226 / 246 / 192). Every row also carries what the uplift check needs:
  // `nail` (NAILS key), `screw` (thread / pull-through data) or `D` (bolt dia.).
  function nailRow(key) {
    var nl = NAILS[key], v = {};
    Object.keys(nl.Z).forEach(function (sp) { v[sp] = Math.round(nl.Z[sp] * CD_CONN); });
    return {
      id: key, label: nl.label, defaultSpacing: 16, base: false, nail: key,
      minG: true, minGWhy: 'NDS Table 12N is for both members of identical specific gravity',
      bySillSpecies: v,
      basis: 'NDS 2018 Table 12N, ' + nl.label.replace(' nails', '') + ' (D = ' + f3(nl.D) + '", L = ' + nl.L + '", Table L4), t_s = 1½": Z = '
        + nl.Z.DFL + ' lb (G = 0.50 DF-L) / ' + nl.Z.SP + ' lb (G = 0.55 SP) / ' + nl.Z.SPF + ' lb (G = 0.42 SPF) × C_D 1.6; the lower G of sill and framing species is used; × p/10D where the penetration p is under 10D (fn. 3)'
    };
  }
  var SILL_CONN = [
    { id: 'ltp4', label: 'LTP4 lateral tie plate', defaultSpacing: 16, base: false, sheathingReduction: true,
      bySillSpecies: { DFL: 715, SP: 715, SPF: 615 },
      basis: 'Simpson C-C-2026 p. 310, LTP4 with 12 — 0.131×1½ nails, direction G, "(160)" column: 715 lb DF/SP, 615 lb SPF/HF' },
    nailRow('16d'), nailRow('10d'), nailRow('8d'), nailRow('16dbox'), nailRow('10dbox'), nailRow('8dbox'),
    { id: 'sds14', label: 'SDS ¼×4½ screws', defaultSpacing: 12, base: false,
      minG: true, minGWhy: 'the Simpson sole-to-rim table gives the SPF/HF value where either member is SPF/HF',
      bySillSpecies: { DFL: 400, SP: 400, SPF: 304 },
      basis: 'Sole-plate-to-rim SDS table, 250 lb DF/SP-to-DF/SP, 190 lb where either member (sill or framing) is SPF/HF, × C_D 1.6 — September 2026 QAQC appendix C §6 (source not located in C-C-2026; p. 377 gives 350 lb DF/SP / 250 lb SPF/HF for a 1½" wood side plate at C_D 1.0, full thread penetration, note 2)',
      // Withdrawal: SDS is a No. 14 wood screw (ESR-2236 §4.1.3, not on disk) —
      // NDS Table 12.2B (PDF p. 92) No. 14 column by the G of the RECEIVING member.
      // C-C-2026 p. 377 (SDS25412, 2¾" thread) tabulates 475 lb DF/SP and 330 lb
      // SPF/HF at C_D 1.0 (= 172.7 / 120 lb/in) and its note 4 uses 172 and 121
      // lb/in; the catalog has no separate SP column, so SP reads 208 from the NDS.
      // Note 5 of the same page caps withdrawal through a WOOD side plate (the
      // bottom plate the head bears on) at 345 lb DF/SP / 240 lb SPF/HF at C_D 1.0
      // — head pull-through, keyed by the SILL species (W_H takes C_D, Table 11.3.1).
      screw: { L: 4.5, thread: 2.75, D: 0.242, W: { SP: 208, DFL: 172, SPF: 121 }, pullThrough: { DFL: 345, SP: 345, SPF: 240 } } },
    { id: 'ab12', label: '½" anchor bolt', defaultSpacing: 20, base: true, D: 0.5,
      bySillSpecies: { DFL: 1040, SP: 1040, SPF: 944 },
      basis: 'NDS 2018 Table 12E, 1½" sill to concrete, 6" embedment, Z∥ = 650 lb (G = 0.50) / 590 lb (G = 0.42) × C_D 1.6' },
    { id: 'ab58', label: '⅝" anchor bolt', defaultSpacing: 20, base: true, D: 0.625,
      bySillSpecies: { DFL: 1488, SP: 1488, SPF: 1360 },
      basis: 'NDS 2018 Table 12E, 1½" sill to concrete, 6" embedment, Z∥ = 930 lb (G = 0.50) / 850 lb (G = 0.42) × C_D 1.6' }
  ];
  // SDPWS 2021 §4.3.6.4.3 plate washer: 0.229" × 3" × 3" minimum; hole = bolt D + 1/16".
  var WASHER = { t: 0.229, side: 3, holeOver: 1 / 16 };
  // Default penetration into the receiving member (nails / SDS, else null):
  // fastener length less the 1½" plate, less a ¾" subfloor on every floor above
  // the base (the plate sits on the subfloor there; at the base it sits on the
  // foundation). The user overrides it in the Uplift cell; the calc prints
  // which one it used and asks for the default to be verified.
  function fastenerLength(sc) { return sc && sc.nail ? NAILS[sc.nail].L : (sc && sc.screw ? sc.screw.L : NaN); }
  function penetrationDefault(sc, isBase) {
    var L = fastenerLength(sc);
    if (!isFinite(L)) return null;
    return L - PLATE_THK - (isBase ? 0 : SUBFLOOR_THK);
  }
  function penetrationDefaultText(sc, isBase) {
    return 'default: ' + fracIn(fastenerLength(sc)) + (sc.nail ? ' nail' : ' screw') + ' − 1½" plate' + (isBase ? '' : ' − ¾" subfloor') + ' — verify';
  }
  // The one penetration rule for a nail / SDS sill fastener, whatever the wall's
  // method or uplift source: p = the entered value, else the printed default;
  // a typed value must be a finite number > 0; p may not be under 6D (nails NDS
  // §12.1.6.4, wood screws §12.1.5.6 — SDS 6D = 1.452"). The same fastener
  // carries the sill shear (Table 12N fn. 3 allows p/10D only for 6D ≤ p < 10D),
  // so validate() applies it to every wall and upliftCapacity() reuses it so the
  // wording cannot drift. Returns { p, entered, text, errors } (p null when the
  // connector has no penetration).
  function penetrationCheck(w, sc, isBase) {
    var out = { p: null, entered: false, text: '', errors: [] };
    if (!sc || !(sc.nail || sc.screw)) return out;
    var raw = w.uplift ? w.uplift.penetration_in : null;
    var pIn = num(raw, NaN);
    if (raw !== null && raw !== undefined && raw !== '' && !(isFinite(pIn) && pIn > 0)) {
      out.errors.push('fastener penetration must be a number greater than zero (leave blank to use the printed default).');
    }
    out.entered = isFinite(pIn) && pIn > 0;
    out.p = out.entered ? pIn : penetrationDefault(sc, isBase);
    out.text = out.entered ? 'entered' : penetrationDefaultText(sc, isBase);
    var D = sc.nail ? NAILS[sc.nail].D : sc.screw.D;
    if (out.p + 1e-9 < 6 * D) {
      out.errors.push('penetration p = ' + f2(out.p) + '" (' + out.text + ') is less than the minimum 6D = ' + f3(6 * D) + '" for a '
        + (sc.nail ? NAILS[sc.nail].label.replace(' nails', ' nail') + ' (NDS §12.1.6.4).' : 'No. 14 wood screw (NDS §12.1.5.6).'));
    }
    return out;
  }
  // Simpson C-C-2026 p. 310 fn. 3: 0.72x over 3/8" WSP, 0.64x over 1/2" WSP.
  var LTP4_SHEATHING = { none: { f: 1.00, label: 'nailed direct to framing' }, '0.375': { f: 0.72, label: 'over ⅜" sheathing' }, '0.5': { f: 0.64, label: 'over ½" sheathing' } };

  function findSill(id) { for (var i = 0; i < SILL_CONN.length; i++) if (SILL_CONN[i].id === id) return SILL_CONN[i]; return null; }

  // =========================================================================
  // Wall normalisation — one shape for every wall the engine or page touches
  // =========================================================================
  // Non-mutating. Fills the keys added after v2 shipped so an older saved file
  // computes as soon as it loads:
  //   method            absent -> 'perforated' (Phase C reads it; harmless now)
  //   uplift.source     absent -> 'manual' when the old typed capacity_plf is a
  //                     finite number, else 'sill' (capacity from the sill connection)
  //   uplift.penetration_in  absent -> null = not entered; upliftCapacity() and
  //                     computeWall() then use penetrationDefault() and say so
  //   uplift.washer_in  absent -> 3 (SDPWS §4.3.6.4.3 minimum plate washer)
  // A wall that already carries every key comes back byte-identical (same key
  // order), so adapter round trips of a current model are unchanged.
  function normalizeWall(w) {
    var o = clone(w || {});
    if (o.method !== 'segmented') o.method = 'perforated';
    var u = o.uplift && typeof o.uplift === 'object' ? o.uplift : {};
    var cap = num(u.capacity_plf, NaN);
    var src = u.source === 'manual' || u.source === 'sill' ? u.source : (isFinite(cap) ? 'manual' : 'sill');
    var sc = findSill(o.sill && o.sill.conn);
    o.uplift = {
      source: src,
      penetration_in: u.penetration_in === undefined || u.penetration_in === null ? null : num(u.penetration_in, null),
      washer_in: u.washer_in === undefined ? WASHER.side : (u.washer_in === null ? null : num(u.washer_in, null)),
      capacity_plf: isFinite(cap) ? cap : null,
      label: typeof u.label === 'string' ? u.label : ''
    };
    return o;
  }

  // =========================================================================
  // Bottom-plate uplift capacity — SDPWS §4.3.6.4.2.1 demand t = v_max, wood-
  // side capacity from the same fasteners that carry the sill shear
  // =========================================================================
  // speciesId = framing (the RECEIVING member the fastener is driven into);
  // sillSpeciesId = the bottom plate (the side member the head bears on);
  // isBase picks the penetration default (no subfloor at the base). t_plf, when
  // given, fills T_req per anchor bolt (also under a Manual source). Returns
  //   { source, kind: 'nail'|'screw'|'bolt'|'manual'|'none', plf, perFastener, W, p,
  //     pEntered, pText, pDefault, pThread, Wp, pullThrough, CD, spacing, basis,
  //     factors[], notes[], errors[], needs, T_req, washer }
  // plf === null with `needs` set means the row reads "specify"; errors[] holds
  // a code violation (validate() reports the same 6D rules as model errors).
  function upliftCapacity(w, speciesId, sillSpeciesId, isBase, t_plf) {
    var u = w.uplift || {}, sc = findSill(w.sill && w.sill.conn);
    var spacing = num(w.sill && w.sill.spacing_in, sc ? sc.defaultSpacing : NaN);
    var perFt = spacing > 0 ? spacing / 12 : NaN;   // feet of wall per fastener
    var sp = SPECIES[speciesId], sillSp = SPECIES[sillSpeciesId] || sp;
    var out = { source: u.source === 'manual' ? 'manual' : 'sill', conn: sc ? sc.id : null, kind: null, species: speciesId, sillSpecies: sillSp ? sillSp.id : null,
                plf: null, perFastener: null, W: null, p: null, pEntered: false, pText: '', pDefault: penetrationDefault(sc, isBase), pThread: null, Wp: null, pullThrough: null,
                CD: CD_CONN, spacing: spacing, basis: '', factors: [], notes: [], errors: [], needs: null, label: '', T_req: null, washer: null };
    if (out.source === 'manual') {
      var cap = num(u.capacity_plf, NaN);
      out.kind = 'manual'; out.label = u.label || '';
      if (isFinite(cap) && cap > 0) { out.plf = cap; out.basis = 'Manual entry' + (out.label ? ' — ' + out.label : '') + '; the connector and its basis are outside this calculation'; }
      else out.needs = 'capacity';
      // The rod / concrete demand does not depend on the wood-side source.
      if (sc && sc.base && isFinite(t_plf) && perFt > 0) out.T_req = t_plf * perFt;
      return out;
    }
    if (!sc || !sp) { out.kind = 'none'; out.needs = 'connector'; return out; }
    // Penetration: the entered value, else the default (printed as such); the
    // 6D / typed-value rules come from penetrationCheck().
    var pc = penetrationCheck(w, sc, isBase);
    out.pEntered = pc.entered;
    var p = pc.p;
    out.pText = pc.text;

    if (sc.nail) {
      // NDS §12.2.3.1 Eq. 12.2-3 / Table 12.2C: W (lb/in) at the receiving member's G, × penetration × C_D.
      var nl = NAILS[sc.nail];
      out.kind = 'nail'; out.W = nl.W[speciesId]; out.D = nl.D; out.p = p;
      if (pc.errors.length) { out.errors = pc.errors.slice(); return out; }
      out.Wp = out.W * p;
      out.perFastener = out.Wp * CD_CONN;
      out.plf = perFt > 0 ? out.perFastener / perFt : NaN;
      out.basis = 'NDS 2018 Table 12.2C (PDF p. 93): W = ' + out.W + ' lb/in for D = ' + f3(nl.D) + '" at G = ' + f2(sp.G) + ' (' + sp.label + ', the receiving member) × p = ' + f2(p) + '" (' + out.pText + ') × C_D 1.6 (Table 2.3.2) = ' + f1(out.perFastener) + ' lb per nail';
      out.factors.push({ f: CD_CONN, why: 'C_D = 1.6, wind / earthquake (NDS Table 2.3.2)' });
      if (out.pEntered && Math.abs(p - out.pDefault) > 1e-9) out.notes.push('Penetration entered (' + f2(p) + '") differs from the ' + penetrationDefaultText(sc, isBase).replace(' — verify', '') + ' (' + f2(out.pDefault) + '").');
      return out;
    }
    if (sc.screw) {
      // ESR-2236 §4.1.3 classifies SDS as a No. 14 wood screw -> NDS Table 12.2B
      // at the receiving member's G, over the thread in the main member (≤ the
      // 2¾" thread length); head pull-through through the wood bottom plate is
      // capped per C-C-2026 p. 377 note 5, by the SILL species.
      var sw = sc.screw;
      out.kind = 'screw'; out.W = sw.W[speciesId]; out.D = sw.D; out.p = p;
      if (pc.errors.length) { out.errors = pc.errors.slice(); return out; }
      out.pThread = Math.min(sw.thread, p);
      out.Wp = out.W * out.pThread;
      var pt = sw.pullThrough[sillSpeciesId] || sw.pullThrough.DFL;
      out.pullThrough = pt * CD_CONN;
      var withdrawal = out.Wp * CD_CONN;
      out.perFastener = Math.min(withdrawal, out.pullThrough);
      out.plf = perFt > 0 ? out.perFastener / perFt : NaN;
      out.basis = 'NDS 2018 Table 12.2B (PDF p. 92), No. 14 wood screw (ESR-2236 §4.1.3, not on disk; C-C-2026 p. 377 note 4 uses the same 172 / 121 lb/in): W = ' + out.W + ' lb/in at G = ' + f2(sp.G)
        + ' (' + sp.label + ', the receiving member) × thread in the main member p_t = min(2¾", p = ' + f2(p) + '" (' + out.pText + ')) = ' + f2(out.pThread) + '" × C_D 1.6 = ' + f1(withdrawal) + ' lb'
        + '; head pull-through through the ' + sillSp.label + ' bottom plate ≤ ' + pt + ' lb × 1.6 = ' + f1(out.pullThrough) + ' lb (C-C-2026 p. 377 note 5)'
        + ' — ' + (out.pullThrough + 1e-9 < withdrawal ? 'pull-through governs' : 'withdrawal governs') + ', ' + f1(out.perFastener) + ' lb per screw';
      out.factors.push({ f: CD_CONN, why: 'C_D = 1.6, wind / earthquake (NDS Table 2.3.2; C-C-2026 p. 377 note 3)' });
      if (out.pullThrough + 1e-9 < withdrawal) out.factors.push({ f: out.pullThrough / withdrawal, why: 'head pull-through cap, wood side plate (C-C-2026 p. 377 note 5)' });
      if (p + 1e-9 < sw.thread) out.notes.push('Only ' + f2(p) + '" of the 2¾" thread is in the receiving member.');
      if (speciesId === 'SP') out.notes.push('C-C-2026 p. 377 has no separate SP column (DF/SP 475 lb = G 0.50 basis); the NDS Table 12.2B value at G 0.55 is used, as ESR-2236 §4.1.3 directs.');
      return out;
    }
    if (sc.base && isFinite(sc.D)) {
      // Anchor bolt: the wood-side check is plate-washer bearing on the sill,
      // F_c⊥ (no C_D, NDS Table 4.3.1) × net washer area. The rod and the
      // concrete are reported as a demand, T_req = t × s/12 per bolt, for the
      // separate ACI 318 Ch. 17 / rod-steel check.
      var side = u.washer_in === undefined ? WASHER.side : num(u.washer_in, NaN);
      out.kind = 'bolt';
      if (!(isFinite(side) && side > 0)) { out.needs = 'washer'; return out; }
      var hole = sc.D + WASHER.holeOver;
      var Anet = side * side - Math.PI / 4 * hole * hole;
      if (!(Anet > 0)) { out.errors.push('plate washer ' + f2(side) + '" square is not larger than the ' + f4(hole) + '" bolt hole.'); return out; }
      var capBolt = sillSp.FcP * Anet;
      out.washer = { side: side, t: WASHER.t, D: sc.D, hole: hole, Anet: Anet, FcP: sillSp.FcP, cap: capBolt, species: sillSp.id };
      out.perFastener = capBolt;
      out.plf = perFt > 0 ? capBolt / perFt : NaN;
      out.T_req = isFinite(t_plf) && perFt > 0 ? t_plf * perFt : null;
      out.basis = 'Sill plate-washer bearing: F_c⊥ = ' + sillSp.FcP + ' psi (' + sillSp.label + ' sill, NDS Supplement ' + (sillSp.id === 'SP' ? 'Table 4B' : 'Table 4A') + ' No. 2; no C_D, NDS Table 4.3.1)'
        + ' × A_net = ' + f2(side) + '² − π/4·(' + f3(sc.D) + ' + 1/16)² = ' + f3(Anet) + ' in² = ' + f1(capBolt) + ' lb per bolt (0.229" plate washer, SDPWS §4.3.6.4.3, round hole D + 1/16"; a slotted washer per §4.3.6.4.3, D + 3/16" × 1¾", reduces A_net about 10 %; bearing area factor C_b not applied)';
      if (side + 1e-9 < WASHER.side) out.errors.push('plate washer ' + f2(side) + '" square is smaller than the 0.229" × 3" × 3" minimum of SDPWS §4.3.6.4.3.');
      return out;
    }
    // LTP4 (or any other connector without a withdrawal rating).
    out.kind = 'none'; out.needs = 'connector';
    out.notes.push(sc.label + ' is not rated for uplift (C-C-2026 p. 310 tabulates the F1 / F2 shear directions only) — set the uplift source to Manual, or use a nail or SDS sill connection.');
    return out;
  }

  // =========================================================================
  // Combined lateral + withdrawal on one fastener — NDS §12.4
  // =========================================================================
  // At full-height sheathing the same bottom-plate fastener carries v_max in
  // shear (§4.3.6.4.1.1) and t = v_max in withdrawal (§4.3.6.4.2.1), so the
  // resultant sits at α = 45° to the wood surface. Eq. 12.4-2 (nails) and
  // Eq. 12.4-1 (wood screws, which SDS are per ESR-2236 §4.1.3):
  //   Z'_α = (W'p)·Z' / ((W'p)·cos²α + Z'·sin²α)
  // Zconn = the sill-shear value per fastener (C_D 1.6, p/10D applied); Wp = the
  // uplift value per fastener from upliftCapacity(). Not for anchor bolts
  // (no NDS interaction for bolt tension) or LTP4.
  function combinedCheck(kind, Zconn, Wp, vmax, spacing) {
    var alpha = 45, c2 = 0.5, s2 = 0.5;   // cos²45 = sin²45 = 0.5
    var perFt = spacing / 12;
    var Zalpha = (Wp > 0 && Zconn > 0) ? (Wp * Zconn) / (Wp * c2 + Zconn * s2) : 0;
    var R = Math.SQRT2 * vmax * perFt;              // resultant per fastener, lb
    var vAllow = perFt > 0 ? Zalpha / perFt / Math.SQRT2 : NaN;   // v_max the fastener allows, plf
    return {
      kind: kind, eq: kind === 'nail' ? 'Eq. 12.4-2' : 'Eq. 12.4-1', ref: 'NDS 2018 §12.4.' + (kind === 'nail' ? '2' : '1'),
      alpha: alpha, Zconn: Zconn, Wp: Wp, Zalpha: Zalpha, spacing: spacing,
      demand: R, capacity: Zalpha, dc: Zalpha > 0 ? R / Zalpha : Infinity, vAllow: vAllow
    };
  }

  // =========================================================================
  // Geometry — Sigma b_i (§4.3.3.4) and C_o (§4.3.5.6)
  // =========================================================================
  // Per segment: h/b > 3.5 excluded; 2 < h/b <= 3.5 multiplied by 2b/h; else full.
  // The same Σ b_i·(2b/h) is the segmented method's Σb_eff of §4.3.5.5.1 Exc. 1
  // (2015 §4.3.3.4.1 Exc. 1) — there validate() has already refused h/b > 3.5,
  // so `f` = bEff/b is the per-segment capacity factor (1, or 2b/h) it prints.
  function sumBi(segments, h) {
    var rows = [], sum = 0, raw = 0;
    (segments || []).forEach(function (b0) {
      var b = num(b0, 0), hb = b > 0 ? h / b : Infinity, bEff, rule;
      if (!(b > 0)) { bEff = 0; rule = 'ignored, b = 0'; }
      else if (hb > 3.5 + 1e-9) { bEff = 0; rule = 'excluded, h/b > 3.5'; }
      else if (hb > 2 + 1e-9) { bEff = b * (2 * b / h); rule = '× 2b/h'; }
      else { bEff = b; rule = 'full'; }
      sum += bEff; raw += Math.max(b, 0);
      rows.push({ b: b, hOverB: hb, bEff: bEff, rule: rule, f: b > 0 ? bEff / b : 0 });
    });
    return { segments: rows, sumBi: sum, sumBiRaw: raw };
  }
  // "8, 8, 4" — segment widths for messages, no trailing zeros.
  function fmtSegs(segments) {
    return (segments || []).map(function (b) { var n = num(b, 0); return String(Math.round(n * 100) / 100); }).join(', ');
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
  // Wall lines — several walls sharing one line force
  // =========================================================================
  // A wall's line is its `line` key, or its own id when the key is absent or
  // blank (old files, the diaphragm import: one line = one wall). Walls with
  // the same key on one floor share that line's force; stacking stays by id.
  function lineKey(w) {
    var k = w && w.line;
    if (typeof k === 'string') { k = k.replace(/^\s+|\s+$/g, ''); if (k) return k; }
    return String(w && w.id);
  }
  // The line force at level j: the first wall of the line at that level with a
  // finite P_wind_lb / P_seis_lb (src 'wall'), else NaN so the caller falls
  // back to the level force. validate() refuses two walls of one line at one
  // level with different finite values, so "first" is not a choice.
  function lineForce(floors, j, key, fld) {
    var list = floors[j].walls || [];
    for (var i = 0; i < list.length; i++) {
      if (lineKey(list[i]) !== key) continue;
      var P = num(list[i][fld], NaN);
      if (isFinite(P)) return P;
    }
    return NaN;
  }
  // Share of the line force taken by each wall at each level, once per floor
  // per line (computeWall() reads it, never recomputes it): s_i = cap_i / Σcap
  // over the line's walls present at that level, cap_i = the wall's design
  // capacity from geometry alone — C_o·Σb_i (perforated) or Σb_eff
  // (segmented), i.e. computeGeometry().lever. Equal-length opening-free walls
  // split by length; differing C_o or aspect-ratio factors split by capacity
  // (SDPWS §4.3.5.5.1 Exc. 1; 2015 §4.3.3.4.1 Exc. 1), which is the
  // equal-rigidity assumption stated exactly: every wall of the line carries
  // the same unit shear. Returns lines[j][key] = { key, walls: [{id, cap,
  // share}], sumCap }. A line whose caps are all zero (validate() has already
  // refused it) splits evenly rather than divide by zero.
  function lineShares(floors) {
    return floors.map(function (fl) {
      var h = num(fl.h_ft, 0), byKey = {};
      (fl.walls || []).forEach(function (w0) {
        var w = normalizeWall(w0), key = lineKey(w);
        var lever = computeGeometry(w, h, num(w.L_ft, 0)).geom.lever;
        var cap = isFinite(lever) && lever > 0 ? lever : 0;
        (byKey[key] = byKey[key] || { key: key, walls: [], sumCap: 0 }).walls.push({ id: w.id, cap: cap, share: 1 });
        byKey[key].sumCap += cap;
      });
      Object.keys(byKey).forEach(function (key) {
        var ln = byKey[key];
        ln.walls.forEach(function (x) { x.share = ln.sumCap > 0 ? x.cap / ln.sumCap : 1 / ln.walls.length; });
      });
      return byKey;
    });
  }
  // The share of wall `id` at level j from a lineShares() table; 1 when the
  // wall is alone on its line (or absent — the caller skips those levels).
  function shareAt(lines, floors, j, id) {
    var w = wallAt(floors, j, id);
    if (!w) return 1;
    var ln = lines[j][lineKey(w)];
    if (!ln) return 1;
    for (var i = 0; i < ln.walls.length; i++) if (ln.walls[i].id === id) return ln.walls[i].share;
    return 1;
  }

  // =========================================================================
  // Story forces — §4.3.6.4.4 sums FORCES, then converts once per story
  // =========================================================================
  // floors are ordered top -> bottom.  P_j is the incremental strength-level
  // force delivered at level j.  V_k = factor * sum_{j<=k} P_j.
  // M_k = factor * sum_{j<=k} P_j * z_{j,k}, z = sum of story heights j..k.
  // When wallId is given, P_j is that wall's LINE force at level j — the first
  // wall of the line with a finite P_wind_lb / P_seis_lb (src 'wall'), else the
  // level force (src 'level') — times the wall's share of the line, shareOf(j)
  // (rows carry `share`, and src 'line' when it is under 1; `Pline` is the
  // force before the split). No shareOf = one wall per line, share 1. A wall
  // absent at level j contributes nothing: `present` defaults to
  // wallPresence(floors, wallId) so the export is safe standalone.
  function storyForces(floors, caseKey, present, wallId, shareOf) {
    if (wallId != null && !present) present = wallPresence(floors, wallId);
    var lc = LOAD[caseKey], out = [], fld = caseKey === 'wind' ? 'P_wind_lb' : 'P_seis_lb';
    for (var k = 0; k < floors.length; k++) {
      var V = 0, M = 0, rows = [];
      for (var j = 0; j <= k; j++) {
        if (present && !present(j)) continue;
        var wj = wallId != null ? wallAt(floors, j, wallId) : null;
        var Pw = wj ? lineForce(floors, j, lineKey(wj), fld) : NaN;
        var src = isFinite(Pw) ? 'wall' : 'level';
        var Pline = src === 'wall' ? Pw : (num(floors[j][fld], 0) || 0);
        var s = shareOf ? shareOf(j) : 1;
        if (!(isFinite(s) && s >= 0)) s = 1;
        if (s < 1 - 1e-12) src = 'line';
        var P = Pline * s;
        var z = 0;
        for (var i = j; i <= k; i++) z += num(floors[i].h_ft, 0) || 0;
        V += P; M += P * z;
        rows.push({ level: floors[j].name, P: P, Pfac: lc.factor * P, z: z, m: lc.factor * P * z, src: src, share: s, Pline: Pline });
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
    // Method and segment count down the stack. A segmented wall stacks segment
    // i on segment i (the per-segment overturning of §4.3.6.4.4 accumulates
    // that way), so the count must match on every level the wall exists;
    // widths may differ (warning). One method per wall line: a perforated wall
    // above a segmented one has no per-segment shares to hand down.
    Object.keys(seen).forEach(function (id) {
      var levels = seen[id].map(function (fi) { return { fi: fi, w: normalizeWall(wallAt(floors, fi, id)) }; });
      var seg = levels.filter(function (x) { return x.w.method === 'segmented'; });
      if (!seg.length) return;
      var perf = levels.filter(function (x) { return x.w.method !== 'segmented'; });
      if (perf.length) {
        errors.push('Wall line "' + id + '" is segmented at ' + floors[seg[0].fi].name + ' but perforated at ' + floors[perf[0].fi].name
          + ' — use one method on every level of a wall line.');
        return;
      }
      var top = seg[0], nTop = (top.w.segments_ft || []).length, wTop = fmtSegs(top.w.segments_ft);
      for (var i = 1; i < seg.length; i++) {
        var lv = seg[i], nLv = (lv.w.segments_ft || []).length, wLv = fmtSegs(lv.w.segments_ft);
        if (nLv !== nTop) {
          errors.push('Wall line "' + id + '" is segmented with ' + nTop + ' segments at ' + floors[top.fi].name + ' but ' + nLv + ' segments at ' + floors[lv.fi].name
            + ' — segment i above must land on segment i below. Enter the same segment count on every level (the "Copy walls to levels below" button copies the geometry down).');
        } else if (wLv !== wTop) {
          warnings.push('Wall line "' + id + '": segment widths differ between ' + floors[top.fi].name + ' (' + wTop + ' ft) and ' + floors[lv.fi].name + ' (' + wLv + ' ft) — segment i above lands on segment i below; its overturning is Σ over the stories of V_i,m·h_m — the story shear of the segment at the share of that story (§4.3.6.4.4).');
        }
      }
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
      // §4.3.2.3(8) is a perforated limitation; a level of segmented walls has no height cap here.
      var anyPerforated = (fl.walls || []).some(function (w0) { return normalizeWall(w0).method !== 'segmented'; });
      if (h > 20 + 1e-9 && anyPerforated) errors.push(where + ': perforated shear wall height h = ' + f1(h) + ' ft exceeds the 20 ft limit of SDPWS §4.3.2.3(8).');
      if (!isFinite(num(fl.P_wind_lb, 0)) || !isFinite(num(fl.P_seis_lb, 0))) errors.push(where + ': level forces must be numbers.');
      // Walls of one line carry ONE line force: two finite values more than
      // 1 lb apart on the same line at this level would leave the split
      // undefined (the page keeps them in sync; a hand-edited file may not).
      var byLine = {};
      (fl.walls || []).forEach(function (w0) { var key = lineKey(w0); (byLine[key] = byLine[key] || []).push(w0); });
      Object.keys(byLine).forEach(function (key) {
        if (byLine[key].length < 2) return;
        [['P_wind_lb', 'P_W'], ['P_seis_lb', 'P_E']].forEach(function (fk) {
          var first = null;
          byLine[key].forEach(function (w0) {
            var pv = num(w0[fk[0]], NaN);
            if (!isFinite(pv)) return;
            if (first === null) { first = { w: w0, P: pv }; return; }
            if (Math.abs(pv - first.P) > 1 + 1e-9) {
              errors.push(where + ': line "' + key + '" carries two different ' + fk[1] + ' line forces — ' + (first.w.label || first.w.id) + ' ' + f1(first.P) + ' lb and ' + (w0.label || w0.id) + ' ' + f1(pv) + ' lb. Every wall of a line carries the same line force; the split between the walls is by design capacity.');
            }
          });
        });
      });
      (fl.walls || []).forEach(function (w0) {
        var w = normalizeWall(w0);
        var seg = w.method === 'segmented';
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
        if (!(segSum > 0)) errors.push(tag + ': at least one full-height ' + (seg ? 'shear wall segment' : 'perforated shear wall segment') + ' is required (Σb_i = 0).');
        var sb = sumBi(segs, h);
        if (seg) {
          // Segmented: every segment is a shear wall in its own right, so one
          // past Table 4.3.3's 3.5:1 (blocked WSP) is not a shear wall at all —
          // there is no Σb_i to drop it from. The 2015 edition's Table 4.3.4 is identical.
          sb.segments.forEach(function (s, si) {
            if (s.b > 0 && s.hOverB > 3.5 + 1e-9) errors.push(tag + ': segment ' + (si + 1) + ' (b = ' + f2(s.b) + ' ft) has h/b = ' + f2(s.hOverB) + ' > 3.5 and is not a shear wall (SDPWS 2021 Table 4.3.3, blocked wood structural panels; 2015 Table 4.3.4). Widen it, or leave it out of the segment list (it then counts as an opening).');
          });
        } else if (segSum > 0 && !(sb.sumBi > 0)) errors.push(tag + ': every segment has h/b > 3.5 and is excluded by SDPWS §4.3.3.4 — Σb_i = 0.');
        var opW = 0;
        (w.openings || []).forEach(function (o) {
          var ow = num(o.w_ft, 0), oh = num(o.hc_ft, 0);
          opW += Math.max(ow, 0);
          if (!(ow > 0)) errors.push(tag + ': opening width must be greater than zero.');
          if (oh > h + 1e-9) errors.push(tag + ': clear opening height ' + f2(oh) + ' ft exceeds the wall height ' + f2(h) + ' ft.');
        });
        if (segSum + opW > L + 1e-6) errors.push(tag + ': Σ segments (' + f2(segSum) + ' ft) + Σ opening widths (' + f2(opW) + ' ft) = ' + f2(segSum + opW) + ' ft exceeds L = ' + f2(L) + ' ft.');
        // A negative unsheathed area would reduce A_o and raise C_o — refuse it
        // rather than let openingArea() add it straight into the total. The
        // segmented method has no A_o and ignores the field.
        var unsh = num(w.unsheathed_ft2, 0);
        if (!seg && isFinite(unsh) && unsh < 0) errors.push(tag + ': unsheathed area ' + f2(unsh) + ' ft² cannot be negative (SDPWS §4.3.2.3(9) Exception adds to A_o).');
        if (!w.sheathing || !w.sheathing.face1) errors.push(tag + ': face 1 sheathing is required.');
        else {
          var s1 = findSheathing(w.sheathing.face1);
          if (!s1) errors.push(tag + ': unknown face 1 sheathing option.');
          else if (s1.type !== 'wsp') errors.push(tag + (seg
            ? ': a segmented wall under SFRS A.15 / B.22 and the §4.3.5.5.1 Exc. 1 distribution must be sheathed with wood structural panel sheathing. Gypsum is permitted only as the opposite face.'
            : ': a perforated shear wall must be sheathed with wood structural panel sheathing (SDPWS §4.3.2.3). Gypsum is permitted only as the opposite face.'));
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
        // Penetration of a nail / SDS sill fastener — every wall, every method,
        // every uplift source (the same fastener carries the sill shear): a
        // typed value must be a number > 0 and p may not be under 6D.
        var pc = sc ? penetrationCheck(w, sc, fi === floors.length - 1) : { errors: [] };
        pc.errors.forEach(function (e) { errors.push(tag + ': ' + e); });
        // Uplift inputs: a blank washer / manual plf is "specify" on the check
        // row, not an error; a washer under the §4.3.6.4.3 minimum is. Perforated
        // walls only — §4.3.6.4.2.1 is the perforated uplift; a segmented wall
        // anchors its segment ends (§4.3.6.4.2) and has no row.
        if (sc && !seg && w.uplift.source !== 'manual') {
          var up = upliftCapacity(w, state.species, SPECIES[w.sillSpecies] ? w.sillSpecies : state.species, fi === floors.length - 1);
          up.errors.forEach(function (e) { if (pc.errors.indexOf(e) < 0) errors.push(tag + ': ' + e); });
        }
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
    res.notes.push('Story shear is accumulated as FORCE and converted once at each story with that story’s C_o·Σb_i (perforated) or Σb_eff (segmented) (SDPWS §4.3.6.4.4, §4.3.6.4.1.1).');
    // Only when the feature is in use, so an untouched model prints no note about it.
    var anyLineForce = floors.some(function (fl) {
      return (fl.walls || []).some(function (w) { return isFinite(num(w.P_wind_lb, NaN)) || isFinite(num(w.P_seis_lb, NaN)); });
    });
    if (anyLineForce) res.notes.push('Wall-line forces, where entered, replace the level force for that line.');
    // Line shares once per floor per line; the note only when some line holds
    // more than one wall, so a one-wall-per-line model prints nothing new.
    var lines = lineShares(floors);
    var anySplit = lines.some(function (byKey) { return Object.keys(byKey).some(function (key) { return byKey[key].walls.length > 1; }); });
    if (anySplit) res.notes.push('Wall lines with several walls: the line force at each level is split between the walls present there in proportion to design capacity from geometry — C_o·Σb_i (perforated) or Σb_eff (segmented) — so every wall of the line carries the same unit shear (SDPWS §4.3.5.5.1 Exc. 1; 2015 §4.3.3.4.1 Exc. 1). Equal-length opening-free walls split by length. The Diaphragm Designer delivers one force per line; the split into walls happens here.');
    // Method notes only for the methods in use, so a one-method model prints one.
    var methods = { perforated: false, segmented: false };
    floors.forEach(function (fl) { (fl.walls || []).forEach(function (w) { methods[normalizeWall(w).method] = true; }); });
    if (methods.perforated) res.notes.push('Perforated shear wall method (per-wall Method = perforated): a perforated shear wall segment is present at each end of every wall line (§4.3.2.3(2)); top-of-wall and bottom-of-wall elevations are uniform (§4.3.2.3(7)); collectors run the full length of the wall (§4.3.2.3(6)); sheathed areas that are not the tabulated assembly are counted in A_o (§4.3.2.3(9) Exception).');
    if (methods.segmented) res.notes.push('Segmented method (per-wall Method = segmented): each b_i is an individual full-height shear wall (§4.3.2.1; 2015 §4.3.5.1) with its own hold-down pair; story shear is distributed in proportion to design capacity with 2b/h on segments of h/b > 2:1 (§4.3.5.5.1 Exc. 1; 2015 §4.3.3.4.1 Exc. 1), so the sheathing check is v_eff = V/Σb_eff ≤ v_ASD; openings are gaps between segments and the unsheathed-area entry is ignored; no §4.3.6.4.2.1 uniform uplift (segment ends are anchored per §4.3.6.4.2); segment i stacks on segment i (§4.3.6.4.4).');
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
        var wres = computeWall(state, floors, k, wi, { sp: sp, sdc: sdc, gypBlockedBySDC: gypBlockedBySDC, res: res, lines: lines });
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

  // =========================================================================
  // Geometry per wall
  // =========================================================================
  // Perforated: Σb_i (§4.3.3.4), A_o, C_o (§4.3.5.6) and the lever C_o·Σb_i.
  // Segmented (SDPWS 2021 §4.3.2.1 individual full-height segments; 2015
  // §4.3.5.1): Σb_eff = Σ b_i·f_i with f_i = 1, or 2b_i/h for 2 < h/b ≤ 3.5
  // (§4.3.5.5.1 Exc. 1; 2015 §4.3.3.4.1 Exc. 1 — "need not be further reduced
  // by 4.3.3.2"), and each segment's share b_i·f_i/Σb_eff of the story shear.
  // Both return one shape: v = V/lever reads `lever` (C_o·Σb_i, or Σb_eff so
  // that v_eff = V/Σb_eff), the gypsum gate reads `maxHoverB`. The segmented
  // C_o / A_o / r are null — never a number that could pass for one.
  function computeGeometry(w, h, L) {
    var sb = sumBi(w.segments_ft, h), msgs = [];
    // Governing aspect ratio for the gypsum gate: the maximum h/b over ALL
    // segments, including any already excluded from Σb_i by §4.3.3.4.
    // Conservative — a tall narrow pier that contributes nothing to Σb_i still
    // disqualifies the gypsum face — and it keeps the gate independent of
    // which segments happened to survive the aspect-ratio reduction.
    var maxHoverB = sb.segments.reduce(function (a, s) { return Math.max(a, isFinite(s.hOverB) ? s.hOverB : 0); }, 0);
    if (w.method === 'segmented') {
      var segs = sb.segments.map(function (s, i) {
        return { i: i, b: s.b, hOverB: s.hOverB, bEff: s.bEff, f: s.f, rule: s.rule, share: sb.sumBi > 0 ? s.bEff / sb.sumBi : 0 };
      });
      return { messages: msgs, geom: {
        method: 'segmented', segments: segs, sumBi: sb.sumBi, sumBiRaw: sb.sumBiRaw,
        Afhs: null, Awall: h * L, openings: [], unsheathed: 0, Ao: null, r: null, Co: null,
        lever: sb.sumBi, maxHoverB: maxHoverB
      } };
    }
    var oa = openingArea(w.openings, h, w.unsheathed_ft2);
    var Co = calcCo(L, sb.sumBiRaw, oa.Ao, h);
    var r = calcR(sb.sumBiRaw, oa.Ao, h);
    if (oa.rows.some(function (o) { return o.floored; })) {
      msgs.push('One or more openings are shorter than h/3; an opening height of h/3 = ' + f2(h / 3) + ' ft was used in A_o (SDPWS Eq. 4.3-6).');
    }
    return { messages: msgs, geom: {
      method: 'perforated', segments: sb.segments, sumBi: sb.sumBi, sumBiRaw: sb.sumBiRaw,
      Afhs: h * sb.sumBiRaw, Awall: h * L, openings: oa.rows, unsheathed: oa.unsheathed,
      Ao: oa.Ao, r: r, Co: Co, lever: Co * sb.sumBi, maxHoverB: maxHoverB
    } };
  }

  // =========================================================================
  // Forces per wall — both load cases in full
  // =========================================================================
  // Story shear V and overturning M for this wall line come from storyForces()
  // (forces summed, §4.3.6.4.4). Perforated: v_max = V/(C_o·Σb_i) (Eq. 4.3-9),
  // T from Eq. 4.3-8 with the dead-load M_R of every level down to this one.
  // Segmented: v_eff = V/Σb_eff and V_i,m = V_m·share_i,m — the cumulative
  // factored story shear through story m at THAT story's share. The segment's
  // overturning is the sum over the stories of its own story shear times the
  // story height, M_i,k = Σ_{m≤k} V_i,m·h_m (one load path for shear and moment;
  // segment i above hands its shear to segment i below, why validate() pins
  // the count). T_i = max(0, (M_i − 0.6 M_R,i)/b_i) about the compression toe
  // of the segment (Eq. 4.3-7 form, lever b_i). M_R,i: w·b_i²/2 on every
  // segment, the point dead load P_end·b_i on segment 1 End 1 only.
  // A wall sharing its line takes its share of each level's line force inside
  // storyForces() (shareOf), once: the rows' Pfac already carry it, so Vrun,
  // the segment moments and the perforated M follow without a second factor.
  function computeForces(floors, k, w, geom, cap, shareOf) {
    var present = wallPresence(floors, w.id), segmented = geom.method === 'segmented', lever = geom.lever;
    var cases = {};
    ['wind', 'seismic'].forEach(function (caseKey) {
      var sf = storyForces(floors, caseKey, present, w.id, shareOf)[k];
      var vmax = lever > 0 ? sf.V / lever : NaN;

      // Dead-load resisting moment, cumulative from the top down to this level.
      var MR1 = 0, MR2 = 0, dlRows = [], ri = 0, Vrun = 0;
      var acc = segmented ? geom.segments.map(function () { return { M: 0, MR1: 0, MR2: 0, grav1: 0 }; }) : null;
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
        if (segmented) {
          // storyForces() pushed one row per level where the wall is present,
          // in the same order as this loop, so sf.rows[ri] is level j; Vrun is
          // the factored story shear through level j.
          var row = sf.rows[ri++], hj = num(floors[j].h_ft, 0) || 0, sbj = sumBi(wj.segments_ft, hj);
          Vrun += row.Pfac;
          acc.forEach(function (a, i) {
            var sj = sbj.segments[i], bj = sj ? sj.b : 0;
            var shareJ = sj && sbj.sumBi > 0 ? sj.bEff / sbj.sumBi : 0;
            a.M += Vrun * shareJ * hj;
            var mU = (d.w_plf || 0) * bj * bj / 2, mP = i === 0 ? (d.P_end_lb || 0) * bj : 0;
            a.MR1 += mU + mP; a.MR2 += mU;
            if (i === 0) a.grav1 += d.P_end_lb || 0;
          });
        }
      }
      var base = {
        key: caseKey, label: LOAD[caseKey].label, factor: LOAD[caseKey].factor, ref: LOAD[caseKey].ref,
        V: sf.V, Vstrength: sf.Pstrength, M: sf.M, Mstrength: sf.Mstrength, rows: sf.rows, vmax: vmax, dlRows: dlRows,
        asd: cap[caseKey].asd, dcSheathing: cap[caseKey].asd > 0 ? vmax / cap[caseKey].asd : Infinity
      };
      if (!segmented) {
        var e1 = chordForce(sf.M, MR1, lever), e2 = chordForce(sf.M, MR2, lever);
        // Accumulated gravity carried by each end post (1.0D on the post).
        var grav1 = dlRows.reduce(function (a, x) { return a + x.P_end_lb; }, 0), grav2 = 0;
        var Cbase = lever > 0 ? sf.M / lever : NaN;   // overturning compression, no dead-load relief
        var ends = [
          { end: 1, label: 'End 1', MR: MR1, T: e1.T, Traw: e1.Traw, grav: grav1, C: Cbase + grav1 },
          { end: 2, label: 'End 2', MR: MR2, T: e2.T, Traw: e2.Traw, grav: grav2, C: Cbase + grav2 }
        ];
        base.t = vmax; base.ends = ends; base.Cot = Cbase;
        base.Tgov = Math.max(ends[0].T, ends[1].T); base.Cgov = Math.max(ends[0].C, ends[1].C);
        base.endGov = ends[0].T >= ends[1].T ? 1 : 2;
        cases[caseKey] = base;
        return;
      }
      var segRes = geom.segments.map(function (s, i) {
        var a = acc[i], b = s.b, Vi = sf.V * s.share;
        var se1 = chordForce(a.M, a.MR1, b), se2 = chordForce(a.M, a.MR2, b);
        var Cot = b > 0 ? a.M / b : NaN;
        var sEnds = [
          { end: 1, label: 'End 1', MR: a.MR1, T: se1.T, Traw: se1.Traw, grav: a.grav1, C: Cot + a.grav1 },
          { end: 2, label: 'End 2', MR: a.MR2, T: se2.T, Traw: se2.Traw, grav: 0, C: Cot }
        ];
        return { i: i, b: b, f: s.f, share: s.share, V: Vi, v: b > 0 ? Vi / b : NaN, M: a.M, Cot: Cot, ends: sEnds,
                 Tgov: Math.max(sEnds[0].T, sEnds[1].T), Cgov: Math.max(sEnds[0].C, sEnds[1].C), endGov: sEnds[0].T >= sEnds[1].T ? 1 : 2 };
      });
      base.t = null; base.ends = []; base.Cot = NaN; base.endGov = null; base.segments = segRes;
      base.Tgov = segRes.reduce(function (m, s) { return Math.max(m, s.Tgov); }, 0);
      base.Cgov = segRes.reduce(function (m, s) { return Math.max(m, s.Cgov); }, -Infinity);
      base.vSeg = segRes.reduce(function (m, s) { return Math.max(m, isFinite(s.v) ? s.v : 0); }, 0);
      cases[caseKey] = base;
    });
    return cases;
  }

  // Hold-down selection for one tension demand: coil strap above the base
  // when asked for, else the lightest HDUE whose catalog column carries a value
  // for this end post and species (C-C-2026 p. 61).
  function selectHoldown(hdType, T, postInfo, speciesId, ctx) {
    var hardware = { type: hdType };
    if (hdType === 'strap') {
      var strap = null;
      for (var si = 0; si < STRAPS.length; si++) if (STRAPS[si].Tall >= T) { strap = STRAPS[si]; break; }
      hardware.device = strap; hardware.capacity = strap ? strap.Tall : 0;
      hardware.label = strap ? strap.name : 'Exceeds CMST12 (9,215 lb)';
      hardware.detail = strap ? strap.nails + ' — ' + strap.esr : '';
      return hardware;
    }
    var hdCol = HD_COLUMN[speciesId];   // catalog column name, for the labels
    var pick = null;
    for (var hi = 0; hi < HOLDOWNS.length; hi++) {
      var capH = holdownCapacity(HOLDOWNS[hi], postInfo.thk, postInfo.width, speciesId);
      if (capH > 0 && capH >= T) { pick = { hd: HOLDOWNS[hi], cap: capH }; break; }
    }
    hardware.device = pick ? pick.hd : null; hardware.capacity = pick ? pick.cap : 0; hardware.column = hdCol;
    if (!pick) {
      // Name the largest device the end post and species actually permit, not the largest in the catalogue.
      var best = null;
      HOLDOWNS.forEach(function (hd) {
        var c = holdownCapacity(hd, postInfo.thk, postInfo.width, speciesId);
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
    return hardware;
  }

  function computeWall(state, floors, k, wi, ctx) {
    var n = floors.length, fl = floors[k], w = normalizeWall(fl.walls[wi]), h = num(fl.h_ft, 0);
    var isBase = k === n - 1, segmented = w.method === 'segmented';
    var out = { id: w.id, label: w.label || w.id, L_ft: num(w.L_ft, 0), h_ft: h, base: isBase, method: w.method, messages: [], errors: [], checks: [] };

    // ── geometry ────────────────────────────────────────────────────────────
    var cg = computeGeometry(w, h, out.L_ft);
    out.geom = cg.geom;
    cg.messages.forEach(function (m) { out.messages.push(m); });

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

    // §4.3.2.3(4) — combined nominal unit shear capacity <= 2,435 plf (perforated only).
    var vnMax = Math.max(cap.wind.vn || 0, cap.seismic.vn || 0);
    cap.nominalMax = vnMax;
    if (!segmented && vnMax > 2435 + 1e-9) {
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

    // ── this wall's share of its line, from the table built once in compute() ─
    var lines = ctx.lines || lineShares(floors), lineK = lineKey(w), ln = lines[k][lineK];
    var mine = ln ? ln.walls.filter(function (x) { return x.id === w.id; })[0] : null;
    out.line = { key: lineK, walls: ln ? ln.walls.length : 1, share: mine ? mine.share : 1, cap: mine ? mine.cap : out.geom.lever, sumCap: ln ? ln.sumCap : out.geom.lever };
    var shareOf = function (j) { return shareAt(lines, floors, j, w.id); };

    // ── story forces for this wall line ─────────────────────────────────────
    var cases = computeForces(floors, k, w, out.geom, cap, shareOf);
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
    out.gov = { shear: govShear.key, vmax: govV.vmax, vmaxCase: govV.key, t: govV.t, T: govT.Tgov, Tcase: govT.key, C: govC.Cgov, Ccase: govC.key };
    if (segmented) {
      // Sill demand is the largest per-segment unit shear (v_i = v_eff·f_i ≤ v_eff).
      var govS = govBy(function (c) { return c.vSeg; });
      out.gov.vSeg = govS.vSeg; out.gov.vSegCase = govS.key;
    }

    // ── hardware ────────────────────────────────────────────────────────────
    var postInfo = endPostCheck(w.endPost, state.species, h, out.gov.C);
    out.endPost = postInfo;
    var hdType = isBase ? 'hdue' : (w.holdown === 'strap' ? 'strap' : 'hdue');
    var hardware;
    if (!segmented) {
      hardware = selectHoldown(hdType, out.gov.T, postInfo, state.species, ctx);
    } else {
      // One hold-down pair and one end-post check per segment; the wall's row
      // reports the governing (largest-T) segment's device and passes only
      // when every segment's device qualifies.
      out.segments = out.geom.segments.map(function (s, i) {
        var cw = cases.wind.segments[i], cs = cases.seismic.segments[i];
        var vCase = cases[out.gov.vmaxCase].segments[i];
        function govEnd(e) {
          var a = cw.ends[e], b = cs.ends[e];
          var tolT = 1e-6 * Math.max(1, Math.abs(a.T), Math.abs(b.T)), tolC = 1e-6 * Math.max(1, Math.abs(a.C), Math.abs(b.C));
          var tc = b.T > a.T + tolT ? cs : cw, cc = b.C > a.C + tolC ? cs : cw;
          return { end: e + 1, label: 'End ' + (e + 1), T: tc.ends[e].T, Traw: tc.ends[e].Traw, MR: tc.ends[e].MR, Tcase: tc === cs ? 'seismic' : 'wind',
                   C: cc.ends[e].C, grav: cc.ends[e].grav, Ccase: cc === cs ? 'seismic' : 'wind' };
        }
        var ends = [govEnd(0), govEnd(1)];
        var Ti = Math.max(ends[0].T, ends[1].T), Ci = Math.max(ends[0].C, ends[1].C);
        var eT = ends[0].T >= ends[1].T ? ends[0] : ends[1], eC = ends[0].C >= ends[1].C ? ends[0] : ends[1];
        var post = endPostCheck(w.endPost, state.species, h, Ci);
        return { i: i, n: i + 1, b: s.b, hOverB: s.hOverB, bEff: s.bEff, f: s.f, share: s.share,
                 V: vCase.V, v: vCase.v, M: cases[eT.Tcase].segments[i].M, ends: ends,
                 T: Ti, Tcase: eT.Tcase, endGov: eT.end, C: Ci, Ccase: eC.Ccase,
                 holdown: selectHoldown(hdType, Ti, post, state.species, ctx), endPost: post };
      });
      var govSeg = out.segments.reduce(function (g, s) { return s.T > g.T + 1e-9 ? s : g; }, out.segments[0]);
      hardware = clone(govSeg.holdown);
      hardware.segment = govSeg.n;
      hardware.allPass = out.segments.every(function (s) { return s.T <= 0 || (s.holdown.capacity > 0 && s.T <= s.holdown.capacity); });
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
    // Table 12N fn. 3: Z is tabulated at p = 10D; where 6D <= p < 10D multiply by
    // p/10D (fn. 4 flags the 8d rows at t_s = 1½" — the nail cannot reach 10D).
    // The penetration is the uplift input; blank falls back to the connector default.
    // Blank falls back to the connector default (subfloor assumed above the base).
    var pcS = penetrationCheck(w, scObj, isBase);
    var penFactor = 1, penUsed = pcS.p, penEntered = pcS.entered;
    if (scObj.nail) {
      var nlS = NAILS[scObj.nail];
      penFactor = Math.min(1, penUsed / (10 * nlS.D));
      if (penFactor < 1 - 1e-9) {
        sillNotes.push('Penetration p = ' + f2(penUsed) + '" (' + (penEntered ? 'entered' : penetrationDefaultText(scObj, isBase)) + ') is under 10D = ' + f2(10 * nlS.D) + '": Z × p/10D = ' + f4(penFactor) + ' (NDS Table 12N fn. 3' + (nlS.L - PLATE_THK < 10 * nlS.D ? ', fn. 4' : '') + ').');
        Vconn = Vconn * penFactor;
      }
      sillNotes.push('A nail through the plate and subfloor into the rim or plate below is not the two-member Table 12N case; the tabulated value is used as-is.');
    }
    if (scObj.screw && penUsed + 1e-9 < scObj.screw.thread) {
      sillNotes.push('SDS shear value assumes full thread penetration into the main member (C-C-2026 p. 377 note 2); p = ' + f2(penUsed) + '" (' + (penEntered ? 'entered' : penetrationDefaultText(scObj, isBase)) + ') leaves ' + f2(scObj.screw.thread - penUsed) + '" of thread in the plate.');
    }
    var spacing = num(w.sill.spacing_in, scObj.defaultSpacing);
    var sillPlf = spacing > 0 ? Vconn / (spacing / 12) : NaN;
    out.sill = { conn: scObj, Vconn: Vconn, spacing: spacing, plf: sillPlf, species: sillSpecies, valueSpecies: valSpecies, nailGov: nailGov, notes: sillNotes, basis: scObj.basis, penFactor: penFactor, penetration: penUsed, penEntered: penEntered };
    if (isBase) {
      // §4.3.6.4.3: the plate washer itself is unconditional; only the
      // extend-to-within-½"-of-the-edge clause is gated on 400 plf.
      out.messages.push('A steel plate washer not less than 0.229" × 3" × 3" is required under each foundation anchor bolt nut (SDPWS §4.3.6.4.3).'
        + (out.cap.nominalMax > 400
            ? ' Nominal unit shear capacity is ' + f1(out.cap.nominalMax) + ' plf > 400 plf, so the plate washer must also extend to within ½" of the edge of the bottom plate on the sheathed side(s).'
            : ''));
    }

    // Distributed uplift at the bottom plate, §4.3.6.4.2.1 — capacity from the
    // sill connection (nail / SDS withdrawal, plate-washer bearing at anchor
    // bolts) or the manual plf. Perforated walls only (§4.3.6.4.2.1 names the
    // perforated method; the segmented method anchors its ends, §4.3.6.4.2, so
    // it has neither this nor the NDS §12.4 combined row).
    var perforated = !segmented;
    var up = null;
    out.uplift = null; out.combined = null;
    if (perforated) {
      up = upliftCapacity(w, state.species, sillSpecies, isBase, out.gov.t);
      up.errors.forEach(function (e) { out.errors.push('Bottom-plate uplift: ' + e); });
      out.uplift = up;
      // NDS §12.4 combined shear + uplift on the same nail / screw, at 45°.
      if (up.source === 'sill' && (up.kind === 'nail' || up.kind === 'screw') && up.perFastener > 0) {
        out.combined = combinedCheck(up.kind, Vconn, up.perFastener, out.gov.vmax, spacing);
      }
    }

    // ── check rows ──────────────────────────────────────────────────────────
    var checks = [];
    checks.push(perforated ? {
      id: 'sheathing', label: 'Sheathing unit shear', ref: 'SDPWS §4.3.6.4.1.1 Eq. 4.3-9; §4.3.5.2 + §4.1.4',
      demand: govShear.vmax, demandTxt: 'v_max = ' + f1(govShear.vmax) + ' plf',
      capacity: govShear.asd, capacityTxt: 'v_ASD = ' + f1(govShear.asd) + ' plf',
      dc: govShear.dcSheathing, pass: govShear.dcSheathing <= 1.0, caseKey: govShear.key
    } : {
      // v_i ≤ f_i·v_ASD on every segment reduces to v_eff ≤ v_ASD (v_i = v_eff·f_i).
      id: 'sheathing', label: 'Sheathing unit shear', ref: 'SDPWS §4.3.5.5.1 Exc. 1 (2015 §4.3.3.4.1 Exc. 1); §4.3.5.2 + §4.1.4',
      demand: govShear.vmax, demandTxt: 'v_eff = V/Σb_eff = ' + f1(govShear.vmax) + ' plf (v_i = v_eff·f_i ≤ f_i·v_ASD on every segment)',
      capacity: govShear.asd, capacityTxt: 'v_ASD = ' + f1(govShear.asd) + ' plf',
      dc: govShear.dcSheathing, pass: govShear.dcSheathing <= 1.0, caseKey: govShear.key
    });
    if (perforated) {
      checks.push({
        id: 'holdown', label: 'Chord tension / hold-down', ref: 'SDPWS §4.3.6.1.3 Eq. 4.3-8',
        demand: out.gov.T, demandTxt: 'T = ' + f1(out.gov.T) + ' lb',
        capacity: hardware.capacity, capacityTxt: hardware.label + (hardware.capacity ? ' — T_all = ' + f1(hardware.capacity) + ' lb' : ''),
        dc: out.gov.T <= 0 ? 0 : (hardware.capacity > 0 ? out.gov.T / hardware.capacity : Infinity),
        pass: out.gov.T <= 0 ? true : (hardware.capacity > 0 && out.gov.T <= hardware.capacity), caseKey: govT.key,
        na: out.gov.T <= 0
      });
    } else {
      checks.push({
        id: 'holdown', label: 'Segment chord tension / hold-downs', ref: 'SDPWS §4.3.6.1.2 Eq. 4.3-7; §4.3.6.4.2; §4.3.6.4.4',
        demand: out.gov.T, demandTxt: 'max T_i = ' + f1(out.gov.T) + ' lb (segment ' + hardware.segment + ')',
        capacity: hardware.capacity, capacityTxt: hardware.label + (hardware.capacity ? ' — T_all = ' + f1(hardware.capacity) + ' lb' : '') + ' at segment ' + hardware.segment + '; each segment listed below',
        dc: out.gov.T <= 0 ? 0 : (hardware.capacity > 0 ? out.gov.T / hardware.capacity : Infinity),
        pass: out.gov.T <= 0 ? true : hardware.allPass, caseKey: govT.key,
        na: out.gov.T <= 0
      });
    }
    if (out.gov.T <= 0) {
      var allEnds = perforated
        ? [cases.wind.ends[0], cases.wind.ends[1], cases.seismic.ends[0], cases.seismic.ends[1]]
        : out.segments.reduce(function (a, s) { return a.concat(s.ends); }, []);
      var rawGov = allEnds.reduce(function (m, e) { return Math.min(m, e.Traw); }, Infinity);
      var rawMax = allEnds.reduce(function (m, e) { return Math.max(m, e.Traw); }, -Infinity);
      out.messages.push(perforated
        ? 'Uplift not required by calculation (T_raw = ' + f1(rawMax) + ' lb at the governing end; dead load governs). The uniform uplift t = ' + f1(out.gov.t) + ' plf of §4.3.6.4.2.1 is still required at the bottom plate.'
        : 'Uplift not required by calculation (T_raw = ' + f1(rawMax) + ' lb at the governing segment end; dead load governs, §4.3.6.4.2).');
      out.TrawMin = rawGov;
    }
    if (perforated) {
      var upPlf = isFinite(up.plf) && up.plf > 0 ? up.plf : null;
      var upTxt;
      if (up.kind === 'bolt' && upPlf !== null) upTxt = f2(up.washer.side) + '" × ' + f2(up.washer.side) + '" × 0.229" plate washer, A_net ' + f2(up.washer.Anet) + ' in² × F_c⊥ ' + up.washer.FcP + ' psi = ' + f1(up.washer.cap) + ' lb per bolt @ ' + f1(spacing) + '" o.c. — ' + f1(upPlf) + ' plf';
      else if (up.kind === 'nail' && upPlf !== null) upTxt = scObj.label + ' @ ' + f1(spacing) + '" o.c. — W ' + up.W + ' lb/in × p = ' + f2(up.p) + ' in (' + up.pText + ') × C_D 1.6 = ' + f1(up.perFastener) + ' lb per nail — ' + f1(upPlf) + ' plf';
      else if (up.kind === 'screw' && upPlf !== null) upTxt = scObj.label + ' @ ' + f1(spacing) + '" o.c. — p = ' + f2(up.p) + ' in (' + up.pText + ') → p_t ' + f2(up.pThread) + '"; ' + (up.pullThrough + 1e-9 < up.Wp * CD_CONN ? 'head pull-through ' : 'W ' + up.W + ' lb/in × p_t × C_D 1.6 = ') + f1(up.perFastener) + ' lb per screw — ' + f1(upPlf) + ' plf';
      else if (up.kind === 'manual' && upPlf !== null) upTxt = (up.label ? up.label + ' — ' : 'manual — ') + f1(upPlf) + ' plf';
      else if (up.needs === 'penetration') upTxt = 'penetration required — not specified';
      else if (up.needs === 'washer') upTxt = 'plate washer size required — not specified';
      else if (up.kind === 'none' && scObj.id === 'ltp4') upTxt = 'LTP4 is not rated for uplift — set the uplift source to Manual, or use a nail or SDS sill connection';
      else upTxt = 'connector required — not specified';
      var isBolt = up.kind === 'bolt';
      checks.push({
        id: 'uplift',
        label: isBolt ? 'Sill plate washer bearing (uplift)' : 'Bottom-plate uniform uplift, t = v_max',
        ref: 'SDPWS §4.3.6.4.2.1' + (isBolt ? '; §4.3.6.4.3; NDS Supp. Table 4A/4B' : (up.kind === 'nail' ? '; NDS §12.2.3.1 Table 12.2C' : (up.kind === 'screw' ? '; NDS §12.2.2 Table 12.2B' : ''))),
        demand: out.gov.t,
        demandTxt: 't = ' + f1(out.gov.t) + ' plf' + (up.T_req !== null ? ' → T_req = t × s/12 = ' + f1(up.T_req) + ' lb per bolt — verify anchor rod / concrete for T_req = ' + f1(up.T_req) + ' lb per bolt' : ''),
        capacity: upPlf, capacityTxt: upTxt,
        dc: upPlf ? out.gov.t / upPlf : NaN, pass: upPlf === null ? null : out.gov.t <= upPlf, caseKey: out.gov.vmaxCase,
        req: upPlf === null, T_req: up.T_req
      });
      if (out.combined) {
        var cb = out.combined;
        checks.push({
          id: 'combined', label: 'Combined shear + uplift on the bottom-plate fastener', ref: cb.ref + ' ' + cb.eq,
          demand: cb.demand, demandTxt: 'R = √(v_max² + t²) × s/12 = ' + f1(cb.demand) + ' lb per ' + (cb.kind === 'nail' ? 'nail' : 'screw') + ' at α = 45°',
          capacity: cb.Zalpha, capacityTxt: "Z'_α = " + f1(cb.Zalpha) + ' lb (Z\' ' + f1(cb.Zconn) + ', W\'p ' + f1(cb.Wp) + ') — v_max ≤ ' + f1(cb.vAllow) + ' plf',
          dc: cb.dc, pass: cb.dc <= 1.0, caseKey: out.gov.vmaxCase
        });
      }
    }
    // Sill demand: v_max for a perforated wall; the largest v_i for a segmented one.
    var vSill = perforated ? out.gov.vmax : out.gov.vSeg, vSillCase = perforated ? out.gov.vmaxCase : out.gov.vSegCase;
    checks.push({
      id: 'sill', label: 'Sill / bottom-plate shear anchorage', ref: (perforated ? 'SDPWS §4.3.6.4.1.1' : 'SDPWS §4.3.6.4.1') + (isBase ? '; §4.3.6.4.3' : ''),
      demand: vSill, demandTxt: (perforated ? 'v_max = ' : 'max v_i = ') + f1(vSill) + ' plf',
      capacity: sillPlf, capacityTxt: scObj.label + ' @ ' + f1(spacing) + '" o.c.' + (penUsed !== null ? ' (p = ' + f2(penUsed) + ' in' + (penEntered ? '' : ', default') + (penFactor < 1 - 1e-9 ? ', Z × ' + f3(penFactor) : '') + ')' : '') + ' — ' + f1(sillPlf) + ' plf',
      dc: sillPlf > 0 ? vSill / sillPlf : Infinity, pass: sillPlf > 0 && vSill <= sillPlf, caseKey: vSillCase
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

    // Collector note — the unit shear is carried into the level below on every wall line.
    if (perforated) {
      out.messages.push('Collector / load path: v_max = ' + f1(out.gov.vmax) + ' plf (' + out.gov.vmaxCase + ') is transmitted into the top of this wall, out of its base at full-height sheathing, and into the collectors connecting the segments; it is carried to the level below (SDPWS §4.3.6.4.1.1, §4.3.6.4.4).');
    } else {
      out.messages.push('Collector / load path: v_eff = ' + f1(out.gov.vmax) + ' plf (' + out.gov.vmaxCase + '); collectors deliver V_i = V·b_i·f_i/Σb_eff at v_i = v_eff·f_i into each segment (SDPWS §4.3.2.1(3), §4.3.5.5.1 Exc. 1), and each segment carries its shear and overturning to the segment below it (§4.3.6.4.1, §4.3.6.4.4).');
    }
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
  // Every key normalizeWall() would add is set here, in the same order, so a
  // default wall round-trips through the adapter byte-identical.
  function defaultWall(o) {
    o = o || {};
    var sillId = o.sill || 'sds14';
    return {
      id: o.id || 'w1', label: o.label || 'Wall Line A', L_ft: o.L_ft, h_ft: o.h_ft,
      segments_ft: o.segments_ft, openings: o.openings || [], unsheathed_ft2: 0,
      sheathing: { face1: { type: 'wsp', thickness: '7/16', nail: '8d common', spacing: 6 }, face2: null, blocked: true, insideFaceHoldown: false },
      endPost: { n: 2, size: '2x6' }, holdown: o.holdown || 'hdue',
      sill: { conn: sillId, spacing_in: o.spacing || 12, sheathing: 'none' },
      sillSpecies: 'DFL', dead: { w_plf: 0, P_end_lb: 0, source: 'manual' },
      uplift: { source: 'sill', penetration_in: null, washer_in: WASHER.side, capacity_plf: null, label: '' },
      transfer: false,
      P_wind_lb: null, P_seis_lb: null,   // line-force override; null = inherit the level force
      method: 'perforated'
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
        if (s.method) wall.method = s.method;
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
    { id: 'SW40', src: 'uplift at the base by default — plate-washer bearing on the ⅝" anchor bolts', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 3), row = a.checks.filter(function (c) { return c.id === 'uplift'; })[0];
        return [['row shows the demand', near(row.demand, 70.29, 0.02), f2(row.demand)],
                ['row is the washer-bearing check', row.label === 'Sill plate washer bearing (uplift)' && a.uplift.kind === 'bolt', row.label],
                ['3" washer, ⅝" bolt: A_net = 9 − π/4·0.6875² = 8.629 in² × 625 psi = 5,393.0 lb per bolt', near(a.uplift.washer.Anet, 8.629, 0.001) && near(a.uplift.washer.cap, 5393.0, 0.1), f3(a.uplift.washer.Anet) + ' / ' + f1(a.uplift.washer.cap)],
                ['@ 20" = 3,235.8 plf, passes', near(row.capacity, 3235.8, 0.1) && row.pass === true, f1(row.capacity) + ' ' + String(row.pass)],
                ['T_req = 70.29 × 20/12 = 117.1 lb per bolt, reported for the rod / concrete check', near(row.T_req, 117.14, 0.05) && row.demandTxt.indexOf('verify anchor rod / concrete for T_req = 117.1 lb per bolt') >= 0, row.demandTxt],
                ['no combined row at an anchor bolt', !a.checks.some(function (c) { return c.id === 'combined'; }) && a.combined === null, a.checks.map(function (c) { return c.id; }).join(',')],
                ['5 check rows in order (no combined row at a bolt)', a.checks.map(function (c) { return c.id; }).join(',') === 'sheathing,holdown,uplift,sill,endpost', a.checks.map(function (c) { return c.id; }).join(',')]]; } },
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
          st.floors[0].walls[0].uplift.penetration_in = 2.0;   // entered: full 10D penetration, so Z is the tabulated value
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
                ['basis cites p. 310 and both columns', a.sill.basis.indexOf('p. 310') >= 0 && a.sill.basis.indexOf('615') >= 0, a.sill.basis]]; } },

    // ── Bottom-plate uplift from the sill connection (NDS 12.2C / 12.2B / 12.4) ──
    // CASE_UP: one story, L 40 with no openings (C_o = 1, Σb_i = 40), so
    // v_max = t = P_ASD / 40 exactly. CASE_HD2 is the same wall over a base
    // story, for the above-base connectors.
    { id: 'SW51', src: 'NDS Table 12.2C — 16d common nail withdrawal at the receiving (framing) G; default p = L − 1½" plate − ¾" subfloor above the base', run: function () {
        var mk = function (species, conn, spacing, p) {
          var st = mkState(CASE_HD2); st.species = species;
          st.floors[0].walls[0].sill = { conn: conn || '16d', spacing_in: spacing || 16, sheathing: 'none' }; st.floors[0].walls[0].sillSpecies = 'DFL';
          st.floors[0].walls[0].uplift = { source: 'sill', penetration_in: p === undefined ? null : p, washer_in: 3, capacity_plf: null, label: '' };
          return compute(st); };
        var old = mkState(CASE_HD2); old.floors[0].walls[0].sill = { conn: '16d', spacing_in: 16, sheathing: 'none' }; old.floors[0].walls[0].uplift = { capacity_plf: null, label: '' };
        var e8dDflt = mkState(CASE_HD2); e8dDflt.floors[0].walls[0].sill = { conn: '8d', spacing_in: 16, sheathing: 'none' };
        return { dfl: mk('DFL'), spf: mk('SPF'), sp: mk('SP'), typed: mk('DFL', '16d', 16, 2.0), typedSpf: mk('SPF', '16d', 16, 2.0), typedSp: mk('SP', '16d', 16, 2.0),
                 e8d: mk('DFL', '8d', 16, 1.0), e8dp: mk('DFL', '8d', 16, 1.31), e8dDflt: validate(e8dDflt), old: compute(old),
                 pBase: penetrationDefault(findSill('16d'), true), pAbove: penetrationDefault(findSill('16d'), false), nailRows: SILL_CONN.filter(function (s) { return s.nail; }).length }; },
      expect: function (r) { var a = W(r.dfl, 0), b = W(r.spf, 0), c = W(r.sp, 0), t = W(r.typed, 0), ts = W(r.typedSpf, 0), tp = W(r.typedSp, 0), d = W(r.e8d, 0), e = W(r.e8dp, 0), o = W(r.old, 0);
        var row = function (w) { return w.checks.filter(function (x) { return x.id === 'uplift'; })[0]; };
        var sillRow = function (w) { return w.checks.filter(function (x) { return x.id === 'sill'; })[0]; };
        return [['default penetration: 3½ − 1½ − ¾ = 1.25" above the base, 2.0" at the base', near(r.pAbove, 1.25, 1e-9) && near(r.pBase, 2.0, 1e-9) && near(a.uplift.pDefault, 1.25, 1e-9) && a.uplift.pEntered === false, r.pAbove + ' / ' + r.pBase],
                ['DFL default: W 40 × p 1.25 × 1.6 = 80.0 lb per nail → 60.0 plf @ 16"', a.uplift.kind === 'nail' && a.uplift.W === 40 && near(a.uplift.perFastener, 80.0, 0.01) && near(a.uplift.plf, 60.0, 0.01) && near(row(a).capacity, 60.0, 0.01), f1(a.uplift.perFastener) + ' / ' + f1(a.uplift.plf)],
                ['row text prints the assumption: "p = 1.25 in (default: 3½" nail − 1½" plate − ¾" subfloor — verify)"', row(a).capacityTxt.indexOf('p = 1.25 in (default: 3½" nail − 1½" plate − ¾" subfloor — verify)') >= 0 && row(a).pass === true, row(a).capacityTxt],
                ['SPF framing default: W 26 → 52.0 lb → 39.0 plf; SP: W 50 → 100.0 lb → 75.0 plf', b.uplift.W === 26 && near(b.uplift.plf, 39.0, 0.01) && c.uplift.W === 50 && near(c.uplift.plf, 75.0, 0.01), f1(b.uplift.plf) + ' / ' + f1(c.uplift.plf)],
                ['default shear: p 1.25 < 10D 1.62 → Z × 0.7716 = 174.4 lb, 130.8 plf; sill row prints "p = 1.25 in, default, Z × 0.772"', near(a.sill.penFactor, 1.25 / 1.62, 1e-6) && near(a.sill.Vconn, 226 * 1.25 / 1.62, 0.01) && sillRow(a).capacityTxt.indexOf('(p = 1.25 in, default, Z × 0.772)') >= 0, f1(a.sill.Vconn) + ' | ' + sillRow(a).capacityTxt],
                ['typed p = 2.0 (entered): W 40 × 2.0 × 1.6 = 128.0 lb → 96.0 plf; SPF 62.4; SP 120.0', near(t.uplift.perFastener, 128.0, 0.01) && near(t.uplift.plf, 96.0, 0.01) && near(ts.uplift.plf, 62.4, 0.01) && near(tp.uplift.plf, 120.0, 0.01) && t.uplift.pEntered === true && row(t).capacityTxt.indexOf('p = 2.00 in (entered)') >= 0, row(t).capacityTxt],
                ['typed p = 2.0: shear stays 226 lb / 169.5 plf, sill row prints p without "default"', near(t.sill.Vconn, 226, 1e-9) && near(t.sill.plf, 169.5, 1e-6) && t.sill.penFactor === 1 && sillRow(t).capacityTxt.indexOf('(p = 2.00 in)') >= 0, sillRow(t).capacityTxt],
                ['basis cites Table 12.2C, the receiving member and C_D 1.6', a.uplift.basis.indexOf('Table 12.2C') >= 0 && a.uplift.basis.indexOf('receiving member') >= 0 && a.uplift.basis.indexOf('C_D 1.6') >= 0, a.uplift.basis],
                ['old file {capacity_plf:null} computes at the default (60.0 plf, "verify"), no "specify"', row(o).pass === true && near(row(o).capacity, 60.0, 0.01) && o.uplift.source === 'sill' && row(o).capacityTxt.indexOf('verify') >= 0, row(o).capacityTxt],
                ['sill note discloses the plate + subfloor + rim path is not the two-member Table 12N case', a.sill.notes.some(function (x) { return x.indexOf('not the two-member Table 12N case') >= 0; }), a.sill.notes.join(' | ')],
                ['8d common at the default (2½ − 1½ − ¾ = 0.25" < 6D 0.786") is refused, message names §12.1.6.4 and the default', r.e8dDflt.ok === false && r.e8dDflt.errors.some(function (x) { return x.indexOf('p = 0.25"') >= 0 && x.indexOf('default') >= 0 && x.indexOf('§12.1.6.4') >= 0; }), r.e8dDflt.errors.join(' | ')],
                ['8d common typed p = 1.0 @ 16: W 32 × 1.0 × 1.6 = 51.2 lb, 38.4 plf', d.uplift.W === 32 && near(d.uplift.p, 1.0, 1e-9) && near(d.uplift.perFastener, 51.2, 0.01) && near(d.uplift.plf, 38.4, 0.01), f1(d.uplift.perFastener)],
                ['8d common shear at p 1.0: Z 97 × 1.6 = 155 × 1.0/1.31 → 118.3 lb (Table 12N fn. 3 / fn. 4)', near(d.sill.penFactor, 1 / 1.31, 1e-6) && near(d.sill.Vconn, 155 / 1.31, 0.01) && d.sill.notes.some(function (x) { return x.indexOf('fn. 3, fn. 4') >= 0; }), f1(d.sill.Vconn) + ' ' + d.sill.notes.join(' | ')],
                ['8d common at p = 1.31" (= 10D): full 155 lb', near(e.sill.Vconn, 155, 1e-9) && e.sill.penFactor === 1, f1(e.sill.Vconn)],
                ['six nail rows in SILL_CONN', r.nailRows === 6, String(r.nailRows)]]; } },
    { id: 'SW52', src: 'NDS Table 12.2B No. 14 / C-C-2026 p. 377 — SDS ¼×4½ withdrawal, 2¾" thread, head pull-through cap, §12.1.5.6 6D', run: function () {
        var mk = function (species, sillSpecies, p) {
          var st = mkState(CASE_HD2); st.species = species;
          st.floors[0].walls[0].sillSpecies = sillSpecies;
          if (p !== undefined) st.floors[0].walls[0].uplift.penetration_in = p;
          return compute(st); };
        var tooShort = mkState(CASE_HD2); tooShort.floors[0].walls[0].uplift.penetration_in = 1.4;
        return { dfl: mk('DFL', 'DFL'), dfl3: mk('DFL', 'DFL', 3.0), spfBoth: mk('SPF', 'SPF'), spfFrame: mk('SPF', 'DFL'), spfFrame3: mk('SPF', 'DFL', 3.0), sp: mk('SP', 'SP', 3.0), short: mk('DFL', 'DFL', 1.5), tooShort: validate(tooShort) }; },
      expect: function (r) { var a = W(r.dfl, 0), a3 = W(r.dfl3, 0), b = W(r.spfBoth, 0), c = W(r.spfFrame, 0), c3 = W(r.spfFrame3, 0), d = W(r.sp, 0), e = W(r.short, 0);
        var row = function (w) { return w.checks.filter(function (x) { return x.id === 'uplift'; })[0]; };
        return [['DFL default: p = 4½ − 1½ − ¾ = 2.25 → p_thread 2.25; W 172 × 2.25 × 1.6 = 619.2 lb withdrawal; cap 552.0 governs → 552.0 plf @ 12"', a.uplift.kind === 'screw' && near(a.uplift.pDefault, 2.25, 1e-9) && near(a.uplift.pThread, 2.25, 1e-9) && near(a.uplift.Wp * 1.6, 619.2, 0.01) && near(a.uplift.perFastener, 552.0, 0.01) && near(a.uplift.plf, 552.0, 0.01), f1(a.uplift.Wp * 1.6) + ' / ' + f1(a.uplift.perFastener)],
                ['row text prints "p = 2.25 in (default: 4½" screw − 1½" plate − ¾" subfloor — verify)"', row(a).capacityTxt.indexOf('p = 2.25 in (default: 4½" screw − 1½" plate − ¾" subfloor — verify)') >= 0, row(a).capacityTxt],
                ['sill note: SDS shear value assumes full thread penetration (C-C-2026 p. 377 note 2)', a.sill.notes.some(function (x) { return x.indexOf('assumes full thread penetration into the main member (C-C-2026 p. 377 note 2)') >= 0; }) && !a3.sill.notes.some(function (x) { return x.indexOf('full thread') >= 0; }), a.sill.notes.join(' | ')],
                ['typed p = 3.0 (entered): p_thread 2.75; W 172 × 2.75 × 1.6 = 756.8 lb withdrawal', near(a3.uplift.pThread, 2.75, 1e-9) && near(a3.uplift.Wp * 1.6, 756.8, 0.01) && a3.uplift.pEntered === true, f1(a3.uplift.Wp * 1.6)],
                ['DFL sill: head pull-through 345 × 1.6 = 552.0 lb governs → 552.0 plf', near(a3.uplift.pullThrough, 552.0, 0.01) && near(a3.uplift.perFastener, 552.0, 0.01) && near(a3.uplift.plf, 552.0, 0.01), f1(a3.uplift.perFastener) + ' / ' + f1(a3.uplift.plf)],
                ['SPF framing, DFL sill, p 3.0: W 121 × 2.75 × 1.6 = 532.4 lb withdrawal governs (cap 552)', c3.uplift.W === 121 && near(c3.uplift.perFastener, 532.4, 0.01) && near(c3.uplift.plf, 532.4, 0.01), f1(c3.uplift.perFastener)],
                ['SPF framing, DFL sill, default p 2.25: 121 × 2.25 × 1.6 = 435.6 lb', near(c.uplift.perFastener, 435.6, 0.01), f1(c.uplift.perFastener)],
                ['SPF sill: pull-through 240 × 1.6 = 384.0 lb governs', near(b.uplift.pullThrough, 384.0, 0.01) && near(b.uplift.perFastener, 384.0, 0.01), f1(b.uplift.perFastener)],
                ['SP framing, p 3.0: W 208 (Table 12.2B) → 915.2 lb withdrawal, capped at 552.0; note names the catalog DF/SP column', d.uplift.W === 208 && near(d.uplift.Wp * 1.6, 915.2, 0.01) && near(d.uplift.perFastener, 552.0, 0.01) && d.uplift.notes.some(function (x) { return x.indexOf('no separate SP column') >= 0; }), f1(d.uplift.perFastener) + ' ' + d.uplift.notes.join(' | ')],
                ['p = 1.5" (≥ 6D 1.452) → p_thread 1.5: 172 × 1.5 × 1.6 = 412.8 lb governs', near(e.uplift.pThread, 1.5, 1e-9) && near(e.uplift.perFastener, 412.8, 0.01), f1(e.uplift.perFastener)],
                ['p = 1.4" < 6D = 1.452" refused, message names §12.1.5.6', r.tooShort.ok === false && r.tooShort.errors.some(function (x) { return x.indexOf('6D = 1.452"') >= 0 && x.indexOf('§12.1.5.6') >= 0; }), r.tooShort.errors.join(' | ')],
                ['basis cites Table 12.2B, ESR-2236 §4.1.3, C-C-2026 p. 377 notes 4 and 5', ['Table 12.2B', 'ESR-2236 §4.1.3', 'p. 377 note 4', 'p. 377 note 5'].every(function (k) { return a.uplift.basis.indexOf(k) >= 0; }), a.uplift.basis],
                ['pull-through factor listed when it governs', a.uplift.factors.some(function (f) { return f.why.indexOf('pull-through') >= 0; }) && !c.uplift.factors.some(function (f) { return f.why.indexOf('pull-through') >= 0; }), a.uplift.factors.map(function (f) { return f.why; }).join(' | ')],
                ['SDS shear basis names the QAQC appendix and the p. 377 wood-side-plate values', a.sill.basis.indexOf('appendix C §6') >= 0 && a.sill.basis.indexOf('350 lb DF/SP / 250 lb SPF/HF') >= 0, a.sill.basis]]; } },
    { id: 'SW53', src: 'NDS §12.4 Eq. 12.4-2 / 12.4-1 — combined shear + uplift on the bottom-plate fastener at 45°', run: function () {
        // P_ASD = 3,000 lb on the 40 ft opening-free wall -> v_max = t = 75 plf.
        var nail = mkState(CASE_HD2); nail.floors[0].P_wind_lb = 3000 / 0.6; nail.floors[0].P_seis_lb = 3000 / 0.7;
        nail.floors[0].walls[0].sill = { conn: '16d', spacing_in: 16, sheathing: 'none' }; nail.floors[0].walls[0].uplift.penetration_in = 2.0;
        var sds = mkState(CASE_HD2); sds.floors[0].P_wind_lb = 3000 / 0.6; sds.floors[0].P_seis_lb = 3000 / 0.7;
        var manual = mkState(CASE_HD2); manual.floors[0].walls[0].sill = { conn: '16d', spacing_in: 16, sheathing: 'none' }; manual.floors[0].walls[0].uplift = { source: 'manual', capacity_plf: 200, label: 'x' };
        return { nail: compute(nail), sds: compute(sds), manual: compute(manual), unit: combinedCheck('nail', 226, 128, 75, 16), raw: combinedCheck('screw', 400, 756.8, 75, 12) }; },
      expect: function (r) { var a = W(r.nail, 0), b = W(r.sds, 0), m = W(r.manual, 0), u = r.unit;
        var ids = function (w) { return w.checks.map(function (c) { return c.id; }).join(','); };
        var row = function (w) { return w.checks.filter(function (x) { return x.id === 'combined'; })[0]; };
        return [['16d DFL @ 16: Z\' 226, W\'p 128 → Z\'_45 = 2·128·226/(128+226) = 163.4 lb', near(u.Zalpha, 163.43, 0.05) && near(a.combined.Zalpha, 163.43, 0.05), f2(a.combined.Zalpha)],
                ['allowable v_max = 163.4/(16/12)/√2 = 86.7 plf (governs over shear 169.5 and uplift 96.0)', near(a.combined.vAllow, 86.67, 0.05) && a.combined.vAllow < a.uplift.plf && a.combined.vAllow < a.sill.plf, f2(a.combined.vAllow)],
                ['v_max = 75 plf: R = √2·75·(16/12) = 141.4 lb, D/C = 0.865, passes; the shear and uplift rows also pass', near(a.gov.vmax, 75, 1e-6) && near(row(a).demand, 141.42, 0.05) && near(row(a).dc, 0.8654, 0.001) && row(a).pass === true, f2(row(a).demand) + ' / ' + f4(row(a).dc)],
                ['rows in order sheathing, holdown, uplift, combined, sill, endpost', ids(a) === 'sheathing,holdown,uplift,combined,sill,endpost', ids(a)],
                ['combined row cites Eq. 12.4-2 for nails, α = 45°', row(a).ref.indexOf('§12.4.2') >= 0 && row(a).ref.indexOf('Eq. 12.4-2') >= 0 && a.combined.alpha === 45, row(a).ref],
                ['SDS DFL @ 12: Z\' 400, W\'p 552 (pull-through) → Z\'_45 = 463.9 lb, v_max ≤ 328.0 plf; Eq. 12.4-1', near(b.combined.Zalpha, 463.87, 0.05) && near(b.combined.vAllow, 328.0, 0.05) && row(b).ref.indexOf('Eq. 12.4-1') >= 0, f2(b.combined.Zalpha) + ' / ' + f2(b.combined.vAllow)],
                ['SDS at the uncapped 756.8 lb withdrawal would give 523.4 lb / 370.1 plf', near(r.raw.Zalpha, 523.37, 0.05) && near(r.raw.vAllow, 370.08, 0.05), f2(r.raw.Zalpha) + ' / ' + f2(r.raw.vAllow)],
                ['no combined row when the uplift source is manual', m.combined === null && ids(m) === 'sheathing,holdown,uplift,sill,endpost', ids(m)]]; } },
    { id: 'SW54', src: 'Sill plate-washer bearing at the anchor bolts — F_c⊥ × A_net vs T_req = t × s/12', run: function () {
        var mk = function (conn, sillSpecies, side) {
          var st = mkState(CASE_UP); st.floors[0].walls[0].sill = { conn: conn, spacing_in: 20, sheathing: 'none' }; st.floors[0].walls[0].sillSpecies = sillSpecies;
          if (side !== undefined) st.floors[0].walls[0].uplift.washer_in = side;
          return compute(st); };
        var small = mkState(CASE_UP); small.floors[0].walls[0].uplift.washer_in = 2.5;
        var blank = mkState(CASE_UP); blank.floors[0].walls[0].uplift.washer_in = null;
        return { dfl: mk('ab58', 'DFL'), spf: mk('ab58', 'SPF'), sp: mk('ab58', 'SP'), half: mk('ab12', 'DFL'), big: mk('ab58', 'DFL', 4), small: validate(small), blank: compute(blank) }; },
      expect: function (r) { var a = W(r.dfl, 0), b = W(r.spf, 0), c = W(r.sp, 0), d = W(r.half, 0), e = W(r.big, 0), bl = W(r.blank, 0);
        var row = function (w) { return w.checks.filter(function (x) { return x.id === 'uplift'; })[0]; };
        return [['t = v_max = 300 plf on the 40 ft wall (C_o = 1)', near(a.gov.t, 300, 1e-6) && near(a.geom.Co, 1, 1e-9), f2(a.gov.t)],
                ['⅝" bolt, 3" washer: hole 0.6875", A_net = 9 − π/4·0.6875² = 8.629 in²', near(a.uplift.washer.hole, 0.6875, 1e-9) && near(a.uplift.washer.Anet, 8.6288, 0.001), f4(a.uplift.washer.Anet)],
                ['DFL sill: 625 × 8.629 = 5,393.0 lb per bolt → 3,235.8 plf @ 20"', near(a.uplift.washer.cap, 5393.0, 0.1) && near(a.uplift.plf, 3235.8, 0.1), f1(a.uplift.washer.cap) + ' / ' + f1(a.uplift.plf)],
                ['T_req = 300 × 20/12 = 500.0 lb per bolt; row passes; label "Sill plate washer bearing (uplift)"', near(a.uplift.T_req, 500, 1e-6) && row(a).pass === true && row(a).label === 'Sill plate washer bearing (uplift)', row(a).label + ' ' + f1(a.uplift.T_req)],
                ['demand line: "verify anchor rod / concrete for T_req = 500.0 lb per bolt"', row(a).demandTxt.indexOf('verify anchor rod / concrete for T_req = 500.0 lb per bolt') >= 0, row(a).demandTxt],
                ['SPF sill: 425 × 8.629 = 3,667.2 lb', near(b.uplift.washer.cap, 3667.2, 0.1) && b.uplift.washer.FcP === 425, f1(b.uplift.washer.cap)],
                ['SP sill: 565 × 8.629 = 4,875.3 lb, basis names Table 4B', near(c.uplift.washer.cap, 4875.3, 0.1) && c.uplift.basis.indexOf('Table 4B') >= 0, f1(c.uplift.washer.cap)],
                ['½" bolt: hole 0.5625", A_net 8.751 in² → 5,469.7 lb', near(d.uplift.washer.Anet, 8.7515, 0.001) && near(d.uplift.washer.cap, 5469.7, 0.1), f1(d.uplift.washer.cap)],
                ['4" washer: A_net 15.629 in² → 9,768.0 lb', near(e.uplift.washer.Anet, 15.6288, 0.001) && near(e.uplift.washer.cap, 9768.0, 0.1), f1(e.uplift.washer.cap)],
                ['basis: no C_D on F_c⊥ (Table 4.3.1), SDPWS §4.3.6.4.3 washer', a.uplift.basis.indexOf('no C_D') >= 0 && a.uplift.basis.indexOf('§4.3.6.4.3') >= 0, a.uplift.basis],
                ['2.5" washer refused (below the §4.3.6.4.3 minimum)', r.small.ok === false && r.small.errors.some(function (x) { return x.indexOf('smaller than the 0.229" × 3" × 3" minimum') >= 0; }), r.small.errors.join(' | ')],
                ['blank washer → "specify", no combined row', row(bl).pass === null && row(bl).capacityTxt.indexOf('plate washer size required') >= 0 && bl.combined === null, row(bl).capacityTxt]]; } },
    { id: 'SW55', src: 'NDS §12.1.6.4 6D gate; old-file compatibility; LTP4 and blank manual → "specify"', run: function () {
        var short = mkState(CASE_HD2); short.floors[0].walls[0].sill = { conn: '16d', spacing_in: 16, sheathing: 'none' }; short.floors[0].walls[0].uplift.penetration_in = 0.9;
        var ok = mkState(CASE_HD2); ok.floors[0].walls[0].sill = { conn: '16d', spacing_in: 16, sheathing: 'none' }; ok.floors[0].walls[0].uplift.penetration_in = 0.972;
        var oldM = mkState(CASE1); oldM.floors[3].walls[0].uplift = { capacity_plf: 500, label: 'x' };
        var oldN = mkState(CASE1); oldN.floors[0].walls[0].uplift = { capacity_plf: null, label: '' }; delete oldN.floors[0].walls[0].method;
        var ltp = mkState(CASE_HD2); ltp.floors[0].walls[0].sill = { conn: 'ltp4', spacing_in: 16, sheathing: 'none' };
        var manualBlank = mkState(CASE_HD2); manualBlank.floors[0].walls[0].uplift = { source: 'manual', penetration_in: 3, washer_in: 3, capacity_plf: null, label: '' };
        var blankPen = mkState(CASE_HD2); blankPen.floors[0].walls[0].uplift.penetration_in = null;
        var normN = normalizeWall(oldN.floors[0].walls[0]), normM = normalizeWall(oldM.floors[3].walls[0]);
        var dw = defaultWall({ L_ft: 40, h_ft: 10, segments_ft: [40], sill: 'ab58', spacing: 20 });
        return { short: validate(short), ok: compute(ok), oldM: compute(oldM), oldN: compute(oldN), ltp: compute(ltp), manualBlank: compute(manualBlank), blankPen: compute(blankPen),
                 normN: normN, normM: normM, rawN: oldN.floors[0].walls[0], dwSame: JSON.stringify(normalizeWall(dw)) === JSON.stringify(dw) }; },
      expect: function (r) {
        var row = function (res, k) { return W(res, k).checks.filter(function (x) { return x.id === 'uplift'; })[0]; };
        return [['16d at p = 0.9" < 6D = 0.972" refused, message names §12.1.6.4', r.short.ok === false && r.short.errors.some(function (x) { return x.indexOf('less than the minimum 6D = 0.972"') >= 0 && x.indexOf('§12.1.6.4') >= 0; }), r.short.errors.join(' | ')],
                ['16d at p = 0.972" (= 6D) accepted: 40 × 0.972 × 1.6 = 62.2 lb; shear × 0.972/1.62 = 0.6', r.ok.ok === true && near(W(r.ok, 0).uplift.perFastener, 62.208, 0.01) && near(W(r.ok, 0).sill.penFactor, 0.6, 1e-9), f2(W(r.ok, 0).uplift.perFastener) + ' ' + f4(W(r.ok, 0).sill.penFactor)],
                ['old file {capacity_plf:500, label:x} → manual, 500 plf, D/C = 70.29/500 = 0.1406 as before', r.normM.uplift.source === 'manual' && r.normM.uplift.capacity_plf === 500 && near(row(r.oldM, 3).dc, 0.1406, 0.0002) && row(r.oldM, 3).capacityTxt.indexOf('x — 500.0 plf') >= 0, row(r.oldM, 3).capacityTxt + ' ' + f4(row(r.oldM, 3).dc)],
                ['old file {capacity_plf:null} → source sill, penetration null (not entered → default at compute), washer 3, method perforated', r.normN.uplift.source === 'sill' && r.normN.uplift.penetration_in === null && r.normN.uplift.washer_in === 3 && r.normN.method === 'perforated', JSON.stringify(r.normN.uplift) + ' ' + r.normN.method],
                ['manual 500 plf on the base anchor bolts still reports T_req = 117.1 lb per bolt', near(row(r.oldM, 3).T_req, 117.14, 0.05) && row(r.oldM, 3).demandTxt.indexOf('verify anchor rod / concrete for T_req = 117.1 lb per bolt') >= 0, row(r.oldM, 3).demandTxt],
                ['normalizeWall does not mutate its input', r.rawN.uplift.source === undefined && r.rawN.method === undefined, JSON.stringify(r.rawN.uplift)],
                ['old {capacity_plf:null} SDS wall computes (552.0 plf), not "specify"', row(r.oldN, 0).pass !== null && near(row(r.oldN, 0).capacity, 552.0, 0.01), row(r.oldN, 0).capacityTxt],
                ['a default wall round-trips normalizeWall byte-identical', r.dwSame === true, String(r.dwSame)],
                ['LTP4: uplift row "specify" with the not-rated message, no combined row', row(r.ltp, 0).pass === null && row(r.ltp, 0).capacityTxt.indexOf('LTP4 is not rated for uplift') >= 0 && W(r.ltp, 0).combined === null, row(r.ltp, 0).capacityTxt],
                ['manual with a blank plf → "specify"', row(r.manualBlank, 0).pass === null && row(r.manualBlank, 0).capacityTxt.indexOf('not specified') >= 0 && W(r.manualBlank, 0).combined === null, row(r.manualBlank, 0).capacityTxt],
                ['blank penetration computes at the default with "default … verify" (no "specify")', row(r.blankPen, 0).pass === true && row(r.blankPen, 0).capacityTxt.indexOf('default: 4½" screw − 1½" plate − ¾" subfloor — verify') >= 0 && r.blankPen.ok === true, row(r.blankPen, 0).capacityTxt]]; } },

    // ── Segmented method: SDPWS 2021 §4.3.2.1 individual full-height segments,
    //    §4.3.5.5.1 Exc. 1 capacity-proportional distribution with 2b/h
    //    (2015 §4.3.5.1 / §4.3.3.4.1 Exc. 1, identical wording) ─────────────
    // Worked by hand (plan Decision C): h 10, b = 8 / 8 / 4, W = 8,000 lb strength
    // -> V = 4,800 lb. f = 1 / 1 / 2·4/10 = 0.8; Σb_eff = 8 + 8 + 3.2 = 19.2 ft;
    // v_eff = 4,800/19.2 = 250.0 plf; V_i = 250 × 8 / 8 / 3.2 = 2,000 / 2,000 / 800
    // lb; v_3 = 800/4 = 200 plf = 0.8 × 250; T_1 = 2,000 × 10/8 = 2,500 lb,
    // T_3 = 800 × 10/4 = 2,000 lb (Eq. 4.3-7, no dead load).
    { id: 'SW56', src: 'SDPWS §4.3.5.5.1 Exc. 1 — segmented [8, 8, 4] at h 10, V = 4,800 lb', run: function () { return compute(mkState(CASE_SEG)); },
      expect: function (r) { var a = W(r, 0), s = a.segments, c = a.cases.wind, ids = a.checks.map(function (x) { return x.id; }).join(',');
        return [['method segmented, 3 segments, no C_o / A_o', a.method === 'segmented' && s.length === 3 && a.geom.Co === null && a.geom.Ao === null, a.method + ' ' + s.length],
                ['f = 1 / 1 / 0.8 (2b/h on h/b = 2.5)', near(s[0].f, 1, 1e-9) && near(s[1].f, 1, 1e-9) && near(s[2].f, 0.8, 1e-9) && near(s[2].hOverB, 2.5, 1e-9), s.map(function (x) { return f3(x.f); }).join('/')],
                ['Σb_eff = 19.2 ft', near(a.geom.sumBi, 19.2, 1e-9), f2(a.geom.sumBi)],
                ['v_eff = 250.0 plf (sheathing row demand)', near(c.vmax, 250, 1e-6) && near(a.gov.vmax, 250, 1e-6) && near(byId(a, 'sheathing').demand, 250, 1e-6), f2(c.vmax) + ' ' + f2(byId(a, 'sheathing').demand)],
                ['V_i = 2,000 / 2,000 / 800 lb', near(s[0].V, 2000, 1e-6) && near(s[1].V, 2000, 1e-6) && near(s[2].V, 800, 1e-6), s.map(function (x) { return f1(x.V); }).join('/')],
                ['v_i = 250 / 250 / 200 plf; sill row demand = max v_i = 250', near(s[2].v, 200, 1e-6) && near(s[0].v, 250, 1e-6) && near(byId(a, 'sill').demand, 250, 1e-6), s.map(function (x) { return f1(x.v); }).join('/')],
                ['T_1 = 2,500 lb, T_3 = 2,000 lb; governing T = 2,500', near(s[0].T, 2500, 1e-6) && near(s[2].T, 2000, 1e-6) && near(a.gov.T, 2500, 1e-6) && near(byId(a, 'holdown').demand, 2500, 1e-6), s.map(function (x) { return f1(x.T); }).join('/')],
                ['C_1 = 2,500 lb (no gravity), end post checked on max C', near(s[0].C, 2500, 1e-6) && near(a.gov.C, 2500, 1e-6) && near(a.endPost.fc, 2500 / a.endPost.A, 1e-9), f1(a.gov.C)],
                ['hold-down per segment: HDUE3 / HDUE3 / HDUE3, row capacity from the governing segment', s.every(function (x) { return x.holdown.label === 'HDUE3-SDS3'; }) && a.holdown.label === 'HDUE3-SDS3', s.map(function (x) { return x.holdown.label; }).join('/')],
                ['rows: sheathing, holdown, sill, endpost — no uplift, no combined; uplift / combined null', ids === 'sheathing,holdown,sill,endpost' && a.uplift === null && a.combined === null, ids],
                ['no error; collector note names v_i into each segment', r.ok === true && a.messages.some(function (m) { return m.indexOf('into each segment') >= 0; }), r.errors.join(' | ') || 'ok']]; } },
    { id: 'SW57', src: 'SDPWS Table 4.3.3 (2015 Table 4.3.4) — segmented h/b > 3.5 refused', run: function () {
        var st = mkState(CASE_SEG); st.floors[0].walls[0].segments_ft = [8, 2.5]; return validate(st); },
      expect: function (v) {
        return [['refused, message names h/b = 4.00 and Table 4.3.3', v.ok === false && v.errors.some(function (e) { return e.indexOf('h/b = 4.00') >= 0 && e.indexOf('Table 4.3.3') >= 0; }), v.errors.join(' | ') || '(none)']]; } },
    // WoodWorks five-over-one §6 as a segmented wall: v = 0.7 F/l (Table 7,
    // p. 35) and M_OT (Table 8, p. 40, strength level, cumulative Σ F_j·z).
    { id: 'SW58', src: 'WoodWorks Dec-2017 Tables 7 / 8 — CASE2 run as segmented', run: function () {
        var st = mkState(CASE2); st.floors.forEach(function (fl) { fl.walls[0].method = 'segmented'; }); return compute(st); },
      expect: function (r) {
        var want = [313.5, 586.6, 793.9, 932.1, 1001.2], out = [];
        want.forEach(function (v, i) {
          var a = W(r, i), c = a.cases.seismic;
          out.push(['level ' + (i + 1) + ' v_eff = ' + f1(v) + ' plf', near(c.vmax, v, v * 0.0025) && near(a.segments[0].v, v, v * 0.0025), f2(c.vmax)]);
        });
        var b = W(r, 4), cs = b.cases.seismic;
        out.push(['base M_OT = 1,502.75 ft-k strength (Table 8) within 0.3 %', near(cs.Mstrength, 1502750, 1502750 * 0.003), f1(cs.Mstrength)]);
        out.push(['base segment M = 0.7 × M_OT, share 1.0, T = M/b', near(b.segments[0].M, 0.7 * 1502750, 0.7 * 1502750 * 0.003) && near(b.segments[0].share, 1, 1e-9) && near(b.segments[0].T, 0.7 * 1502750 / 29, 0.7 * 1502750 / 29 * 0.003), f1(b.segments[0].M) + ' ' + f1(b.segments[0].T)]);
        out.push(['no model error (2,435 plf cap and h ≤ 20 ft are perforated-only)', r.ok === true, r.errors.join(' | ') || 'ok']);
        return out; } },
    // LOCKED decision 6: same segment count on every level; widths may differ.
    { id: 'SW59', src: 'segmented stacking — segment count must match; widths may differ', run: function () {
        var bad = mkState(CASE_SEG2); bad.floors[1].walls[0].segments_ft = [8, 8];
        var warn = mkState(CASE_SEG2); warn.floors[1].walls[0].segments_ft = [8, 8, 6];
        var mixed = mkState(CASE_SEG2); mixed.floors[1].walls[0].method = 'perforated';
        return { bad: validate(bad), warn: compute(warn), mixed: validate(mixed) }; },
      expect: function (r) { var lw = W(r.warn, 1);
        return [['3 over 2 refused, names the "Copy walls to levels below" button', r.bad.ok === false && r.bad.errors.some(function (e) { return e.indexOf('3 segments') >= 0 && e.indexOf('2 segments') >= 0 && e.indexOf('Copy walls to levels below') >= 0; }), r.bad.errors.join(' | ') || '(none)'],
                ['[8, 8, 4] over [8, 8, 6] accepted with a widths warning naming both', r.warn.ok === true && r.warn.warnings.some(function (x) { return x.indexOf('8, 8, 4') >= 0 && x.indexOf('8, 8, 6') >= 0; }), r.warn.warnings.join(' | ') || '(none)'],
                // Lower level: V = 4,800 + 4,800 = 9,600 lb over Σb_eff = 8 + 8 + 6 = 22 ft (h/b = 1.67, f = 1);
                // segment 3 M = Σ V_i,m·h_m = 10 × (3.2/19.2) × 4,800 + 10 × (6/22) × 9,600
                // = 8,000 + 26,181.8 = 34,181.8 ft-lb (its story shear at each story's own share).
                ['lower level v_eff = 9,600/22 = 436.4 plf; segment 3 M = Σ V_i,m·h_m = 34,181.8 ft-lb', near(lw.cases.wind.vmax, 9600 / 22, 1e-6) && near(lw.segments[2].M, 10 * (3.2 / 19.2) * 4800 + 10 * (6 / 22) * 9600, 1e-6), f2(lw.cases.wind.vmax) + ' ' + f1(lw.segments[2].M)],
                ['perforated over segmented on one line refused', r.mixed.ok === false && r.mixed.errors.some(function (e) { return e.indexOf('one method') >= 0; }), r.mixed.errors.join(' | ') || '(none)']]; } },
    // Perforated walls are untouched by the branch: same rows, no segments key,
    // and the default model still round-trips. (The full guard is the diff of
    // runFixtures() SW1–SW55 against the pre-Phase-C output.)
    { id: 'SW60', src: 'perforated path unchanged by the method branch', run: function () { return compute(mkState(CASE1)); },
      expect: function (r) { var a = W(r, 0), b = W(r, 3);
        return [['perforated: no segments key, uplift + combined rows kept', a.segments === undefined && a.method === 'perforated' && a.checks.map(function (x) { return x.id; }).join(',') === 'sheathing,holdown,uplift,combined,sill,endpost', a.checks.map(function (x) { return x.id; }).join(',')],
                ['perforated base: C_o 0.6703, uplift row present', near(b.geom.Co, 0.6703, 0.0002) && !!byId(b, 'uplift'), f4(b.geom.Co)]]; } },
    // The 6D minimum and the typed-value rule apply to every wall (the sill
    // shear fastener is the same one), not only where the uplift row exists.
    { id: 'SW61', src: 'NDS §12.1.6.4 / §12.1.5.6 — penetration rules on segmented and manual-source walls', run: function () {
        var mk = function (conn, sp, pen, src) { var st = mkState(CASE_SEG2); var w = st.floors[0].walls[0]; w.sill = { conn: conn, spacing_in: sp, sheathing: 'none' }; w.uplift.penetration_in = pen; if (src) w.uplift.source = src; return st; };
        var e8 = mk('8d', 16, null), sds = mk('sds14', 12, 1.4), ok16 = mk('16d', 16, 0.972), neg = mk('16d', 16, -1);
        var manual = mkState(CASE_HD2); manual.floors[0].walls[0].sill = { conn: '8d', spacing_in: 16, sheathing: 'none' }; manual.floors[0].walls[0].uplift.source = 'manual'; manual.floors[0].walls[0].uplift.capacity_plf = 500;
        var negP = mkState(CASE_HD2); negP.floors[0].walls[0].uplift.penetration_in = -1;
        return { e8: validate(e8), sds: validate(sds), ok16: compute(ok16), neg: validate(neg), manual: validate(manual), negP: validate(negP) }; },
      expect: function (r) { var w16 = W(r.ok16, 0);
        return [['segmented + 8d at the default p = 0.25" refused, names §12.1.6.4', r.e8.ok === false && r.e8.errors.some(function (e) { return e.indexOf('p = 0.25"') >= 0 && e.indexOf('§12.1.6.4') >= 0; }), r.e8.errors.join(' | ') || '(none)'],
                ['segmented + SDS p = 1.4" < 6D = 1.452" refused, names §12.1.5.6', r.sds.ok === false && r.sds.errors.some(function (e) { return e.indexOf('6D = 1.452"') >= 0 && e.indexOf('§12.1.5.6') >= 0; }), r.sds.errors.join(' | ') || '(none)'],
                ['segmented + 16d p = 0.972" (= 6D) accepted, sill Z × p/10D = 0.6, gov.t null, no uplift row', r.ok16.ok === true && near(w16.sill.penFactor, 0.6, 1e-9) && w16.gov.t === null && !byId(w16, 'uplift'), f4(w16.sill.penFactor) + ' ' + String(w16.gov.t)],
                ['typed p = −1 refused on a segmented wall (no silent fallback to the default)', r.neg.ok === false && r.neg.errors.some(function (e) { return e.indexOf('must be a number greater than zero') >= 0; }), r.neg.errors.join(' | ') || '(none)'],
                ['manual uplift source + 8d at the default still refused (the shear fastener is the same nail)', r.manual.ok === false && r.manual.errors.some(function (e) { return e.indexOf('§12.1.6.4') >= 0; }), r.manual.errors.join(' | ') || '(none)'],
                ['typed p = −1 refused on a perforated SDS wall, once (no duplicate from upliftCapacity)', r.negP.ok === false && r.negP.errors.filter(function (e) { return e.indexOf('must be a number greater than zero') >= 0; }).length === 1, r.negP.errors.join(' | ') || '(none)']]; } },

    // ── Wall lines with several walls (plan Decision D, LOCKED 5): the line
    //    force splits by design capacity from geometry, C_o·Σb_i or Σb_eff,
    //    so every wall of the line sees the same unit shear ─────────────────
    // Worked by hand: line "A1", 20 ft + 30 ft opening-free (C_o 1), h 10,
    // P_W = 10,000/0.6 on both -> ASD line shear 10,000 lb; shares 20/50 = 0.4
    // and 30/50 = 0.6; V_i = 4,000 / 6,000 lb; v = 4,000/20 = 6,000/30 = 200 plf.
    { id: 'SW62', src: 'line A1: 20 ft + 30 ft opening-free, V_line 10,000 lb ASD', run: function () {
        var st = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 10000 }]);
        return { r: compute(st), one: compute(mkState(CASE1)) }; },
      expect: function (o) { var r = o.r, a = W(r, 0), b = r.floors[0].walls[1];
        return [['model ok', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['shares 0.4 / 0.6 from cap 20 / 30 of Σ 50 ft', near(a.line.share, 0.4, 1e-9) && near(b.line.share, 0.6, 1e-9) && near(a.line.cap, 20, 1e-9) && near(b.line.cap, 30, 1e-9) && near(a.line.sumCap, 50, 1e-9), f3(a.line.share) + '/' + f3(b.line.share)],
                ['out.line = {key A1, walls 2}', a.line.key === 'A1' && a.line.walls === 2 && b.line.key === 'A1' && b.line.walls === 2, JSON.stringify(a.line)],
                ['V_i = 4,000 / 6,000 lb', near(a.cases.wind.V, 4000, 1e-6) && near(b.cases.wind.V, 6000, 1e-6), f1(a.cases.wind.V) + '/' + f1(b.cases.wind.V)],
                ['v = 200 plf on both walls', near(a.cases.wind.vmax, 200, 1e-9) && near(b.cases.wind.vmax, 200, 1e-9), f2(a.cases.wind.vmax) + '/' + f2(b.cases.wind.vmax)],
                ['rows: src line, share 0.4, P = 0.4 × 16,667 = 6,667 lb, Pline 16,667', a.cases.wind.rows[0].src === 'line' && near(a.cases.wind.rows[0].share, 0.4, 1e-9) && near(a.cases.wind.rows[0].P, 10000 / 0.6 * 0.4, 1e-6) && near(a.cases.wind.rows[0].Pline, 10000 / 0.6, 1e-6), JSON.stringify(a.cases.wind.rows[0])],
                ['T = V·h/lever: 4,000 × 10 / 20 = 2,000 lb on A, 6,000 × 10 / 30 = 2,000 lb on B (same, as equal unit shear demands)', near(a.gov.T, 2000, 1e-6) && near(b.gov.T, 2000, 1e-6), f1(a.gov.T) + '/' + f1(b.gov.T)],
                ['seismic (no line force) inherits the level P_E = 0 on both, share still applied', a.cases.seismic.rows[0].src === 'line' && near(a.cases.seismic.V, 0, 1e-9), JSON.stringify(a.cases.seismic.rows[0])],
                ['notes carry the line-share rule; a one-wall-per-line model does not', r.notes.some(function (n) { return n.indexOf('several walls') >= 0 && n.indexOf('§4.3.5.5.1 Exc. 1') >= 0; }) && !o.one.notes.some(function (n) { return n.indexOf('several walls') >= 0; }), r.notes.filter(function (n) { return n.indexOf('several walls') >= 0; }).join(' | ')],
                ['a lone wall: line = own id, walls 1, share 1, rows src wall / level as before', W(o.one, 0).line.key === 'w1' && W(o.one, 0).line.walls === 1 && W(o.one, 0).line.share === 1 && W(o.one, 0).cases.wind.rows[0].src === 'level' && W(o.one, 0).cases.wind.rows[0].share === 1, JSON.stringify(W(o.one, 0).line)]]; } },
    // Different C_o on one line: A = L 40, Σb_i 32, one 8 × 7 opening at h 10
    // -> A_o = 56, A_fhs = 320, r = 320/376 = 0.851064, C_o = 0.655738 × 1.25 =
    // 0.819672, cap 26.2295 ft; B = 20 ft opening-free, cap 20. Σcap 46.2295;
    // s_A = 0.56738, s_B = 0.43262; v = 10,000/46.2295 = 216.31 plf on both;
    // V_A = 5,673.8, V_B = 4,326.2 lb. (Plain length proportioning would put
    // 6,667 lb on A at 254 plf and 3,333 lb on B at 167 plf — not equal rigidity.)
    { id: 'SW63', src: 'line A1: two perforated walls with different C_o — capacity split, equal v_max', run: function () {
        return compute(mkLine([{ id: 'A', L: 40, segments: [32], openings: [[8, 7]], P: 10000 }, { id: 'B', L: 20, P: 10000 }])); },
      expect: function (r) { var a = W(r, 0), b = r.floors[0].walls[1], capA = 0.819672 * 32;
        return [['model ok', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['A: C_o 0.8197, cap C_o·Σb_i = 26.23 ft; B: cap 20 ft', near(a.geom.Co, 0.819672, 1e-5) && near(a.line.cap, capA, 1e-3) && near(b.line.cap, 20, 1e-9), f4(a.geom.Co) + ' ' + f3(a.line.cap)],
                ['shares 0.5674 / 0.4326 = cap ratio', near(a.line.share, capA / (capA + 20), 1e-5) && near(b.line.share, 20 / (capA + 20), 1e-5) && near(a.line.share + b.line.share, 1, 1e-12), f4(a.line.share) + '/' + f4(b.line.share)],
                ['V_A = 5,673.8 lb, V_B = 4,326.2 lb', near(a.cases.wind.V, 5673.8, 0.1) && near(b.cases.wind.V, 4326.2, 0.1), f1(a.cases.wind.V) + '/' + f1(b.cases.wind.V)],
                ['v_max = 216.3 plf on both (equal unit shear across the line)', near(a.cases.wind.vmax, 216.31, 0.01) && near(a.cases.wind.vmax, b.cases.wind.vmax, 1e-9), f2(a.cases.wind.vmax) + '/' + f2(b.cases.wind.vmax)]]; } },
    { id: 'SW64', src: 'line A1: two different line forces on one line refused; blank inherits; 1 lb tolerance', run: function () {
        var bad = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 12000 }]);
        var inherit = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: null }]);
        var tol = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 10000 + 0.6 * 0.9 }]);
        var seis = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 10000 }]);
        seis.floors[0].walls[0].P_seis_lb = 100; seis.floors[0].walls[1].P_seis_lb = 300;
        return { bad: validate(bad), inherit: compute(inherit), tol: validate(tol), seis: validate(seis) }; },
      expect: function (o) { var b = o.inherit.floors[0].walls[1];
        return [['P_W 16,667 vs 20,000 lb refused; message names line "A1" and both values', o.bad.ok === false && o.bad.errors.some(function (e) { return e.indexOf('line "A1"') >= 0 && e.indexOf('P_W') >= 0 && e.indexOf('16666.7 lb') >= 0 && e.indexOf('20000.0 lb') >= 0; }), o.bad.errors.join(' | ') || '(none)'],
                ['B blank inherits the line force from A (src line, Pline 16,667), V_B = 6,000 lb', o.inherit.ok === true && b.cases.wind.rows[0].src === 'line' && near(b.cases.wind.rows[0].Pline, 10000 / 0.6, 1e-6) && near(b.cases.wind.V, 6000, 1e-6), JSON.stringify(b.cases.wind.rows[0])],
                ['0.9 lb apart accepted (tolerance 1 lb)', o.tol.ok === true, o.tol.errors.join(' | ') || 'ok'],
                ['P_E 100 vs 300 lb refused too, named P_E', o.seis.ok === false && o.seis.errors.some(function (e) { return e.indexOf('P_E') >= 0 && e.indexOf('line "A1"') >= 0; }), o.seis.errors.join(' | ') || '(none)']]; } },
    // Stacks. (a) B exists at the roof only: at the base A is alone on the line
    // (share 1) and takes the whole base force; its roof share stays 0.4.
    // V_A,base = 0.6 × (16,667 × 0.4 + 8,333 × 1) = 4,000 + 5,000 = 9,000 lb;
    // M_A,base = 4,000 × 20 + 5,000 × 10 = 130,000 ft-lb (force-based, z from
    // each level); T = 130,000/20 = 6,500 lb (C_o 1, lever 20).
    // (b) shares differ between levels: roof 20 + 30 (0.4 / 0.6), base 20 + 20
    // (0.5 / 0.5), P_W = 10,000/0.6 at both levels on both walls. Perforated:
    // V_A = 4,000 + 5,000 = 9,000, M_A = 130,000, T_A = 6,500; V_B = 6,000 +
    // 5,000 = 11,000, M_B = 6,000 × 20 + 5,000 × 10 = 170,000, T_B = 8,500.
    // Segmented A = [10, 10] on both levels (f 1, segment shares 0.5): Vrun form
    // M_1 = Σ V_1,m·h_m = 4,000 × 0.5 × 10 + 9,000 × 0.5 × 10 = 65,000 ft-lb,
    // T_1 = 65,000/10 = 6,500 lb.
    { id: 'SW65', src: 'line A1 down a stack: wall absent below (share 1); shares differing by level, cumulative V and M', run: function () {
        var gone = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 10000 }], [{ id: 'A', L: 20, P: 5000 }]);
        var perf = mkLine([{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 30, P: 10000 }], [{ id: 'A', L: 20, P: 10000 }, { id: 'B', L: 20, P: 10000 }]);
        var seg = mkLine([{ id: 'A', L: 20, segments: [10, 10], method: 'segmented', P: 10000 }, { id: 'B', L: 30, method: 'segmented', P: 10000 }],
                         [{ id: 'A', L: 20, segments: [10, 10], method: 'segmented', P: 10000 }, { id: 'B', L: 20, method: 'segmented', P: 10000 }]);
        return { gone: compute(gone), perf: compute(perf), seg: compute(seg) }; },
      expect: function (o) {
        var gA = o.gone.floors[1].walls[0], pA = o.perf.floors[1].walls[0], pB = o.perf.floors[1].walls[1], sA = o.seg.floors[1].walls[0];
        return [['(a) ok; roof shares 0.4 / 0.6, base A alone: share 1, walls 1', o.gone.ok === true && near(W(o.gone, 0).line.share, 0.4, 1e-9) && gA.line.share === 1 && gA.line.walls === 1, JSON.stringify(gA.line)],
                ['(a) base A rows: roof share 0.4 (src line), base share 1 (src wall); V = 9,000 lb', gA.cases.wind.rows.map(function (x) { return x.src + ':' + f3(x.share); }).join('/') === 'line:0.400/wall:1.000' && near(gA.cases.wind.V, 9000, 1e-6), gA.cases.wind.rows.map(function (x) { return x.src + ':' + f3(x.share); }).join('/') + ' ' + f1(gA.cases.wind.V)],
                ['(a) base A M = 130,000 ft-lb, T = 6,500 lb', near(gA.cases.wind.M, 130000, 1e-6) && near(gA.gov.T, 6500, 1e-6), f1(gA.cases.wind.M) + ' ' + f1(gA.gov.T)],
                ['(b) perforated: base shares 0.5 / 0.5, roof 0.4 / 0.6', near(pA.line.share, 0.5, 1e-9) && near(pB.line.share, 0.5, 1e-9) && near(W(o.perf, 0).line.share, 0.4, 1e-9), f3(pA.line.share) + '/' + f3(pB.line.share)],
                ['(b) perforated A: V = 9,000, M = 130,000, T = 6,500; B: V = 11,000, M = 170,000, T = 8,500', near(pA.cases.wind.V, 9000, 1e-6) && near(pA.cases.wind.M, 130000, 1e-6) && near(pA.gov.T, 6500, 1e-6) && near(pB.cases.wind.V, 11000, 1e-6) && near(pB.cases.wind.M, 170000, 1e-6) && near(pB.gov.T, 8500, 1e-6), [pA.cases.wind.V, pA.cases.wind.M, pA.gov.T, pB.cases.wind.V, pB.cases.wind.M, pB.gov.T].map(f1).join('/')],
                ['(b) segmented A: V = 9,000; segment 1 M = Σ V_1,m·h_m = 65,000 ft-lb, T_1 = 6,500 lb', o.seg.ok === true && near(sA.cases.wind.V, 9000, 1e-6) && near(sA.segments[0].M, 65000, 1e-6) && near(sA.segments[0].T, 6500, 1e-6), f1(sA.cases.wind.V) + ' ' + f1(sA.segments[0].M) + ' ' + f1(sA.segments[0].T)]]; } },
    // Construction is per line on the page (method fans out), but the engine
    // only needs each wall's lever: a segmented [10, 10] (Σb_eff 20) beside the
    // SW63 perforated wall (cap 26.2295) splits 0.43262 / 0.56738 and both see
    // v = 216.31 plf (v_eff on A, v_max on B).
    { id: 'SW66', src: 'line A1: segmented + perforated pair — split from lever regardless of method', run: function () {
        return compute(mkLine([{ id: 'A', L: 20, segments: [10, 10], method: 'segmented', P: 10000 }, { id: 'B', L: 40, segments: [32], openings: [[8, 7]], P: 10000 }])); },
      expect: function (r) { var a = W(r, 0), b = r.floors[0].walls[1], capB = 0.819672 * 32;
        return [['model ok (mixed methods on one line, one method per stack)', r.ok === true, r.errors.join(' | ') || 'ok'],
                ['shares 0.4326 (Σb_eff 20) / 0.5674 (C_o·Σb_i 26.23)', near(a.line.share, 20 / (20 + capB), 1e-5) && near(b.line.share, capB / (20 + capB), 1e-5), f4(a.line.share) + '/' + f4(b.line.share)],
                ['v_eff,A = v_max,B = 216.3 plf', near(a.cases.wind.vmax, 216.31, 0.01) && near(a.cases.wind.vmax, b.cases.wind.vmax, 1e-9), f2(a.cases.wind.vmax) + '/' + f2(b.cases.wind.vmax)],
                ['A segments: V_i = 0.5 × 4,326.2 = 2,163.1 lb each', near(a.segments[0].V, 0.5 * 20 / (20 + capB) * 10000, 0.1) && near(a.segments[1].V, a.segments[0].V, 1e-9), f1(a.segments[0].V)]]; } }
  ];
  function byId(w, id) { return w.checks.filter(function (c) { return c.id === id; })[0]; }

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
  // Uplift probes: an opening-free 40 ft wall (C_o = 1, Σb_i = L) so v_max = t
  // = P_ASD / 40. CASE_UP is a single base story at t = 300 plf; CASE_HD2 puts
  // the same wall (P = 1,000 lb ASD) over BASE_STORY for the above-base connectors.
  var CASE_UP = { stories: [{ name: 'Base', h: 10.0, P: 12000, L: 40, segments: [40], openings: [], sill: 'ab58', spacing: 20 }] };
  var CASE_HD2 = { stories: [
    { name: 'Upper', h: 10.0, P: 1000, L: 40, segments: [40], openings: [], sill: 'sds14', spacing: 12 },
    BASE_STORY
  ] };
  // Segmented probes: P = 4,800 lb ASD on three individual full-height segments
  // 8 / 8 / 4 ft (h/b 1.25 / 1.25 / 2.5) — the plan's worked case; CASE_SEG2
  // stacks the same wall over itself for the count / width rules.
  var CASE_SEG = { stories: [{ name: 'Base', h: 10.0, P: 4800, L: 20, segments: [8, 8, 4], openings: [], sill: 'ab58', spacing: 20, method: 'segmented' }] };
  var CASE_SEG2 = { stories: [
    { name: 'Roof', h: 10.0, P: 4800, L: 20, segments: [8, 8, 4], openings: [], sill: 'sds14', spacing: 12, method: 'segmented' },
    { name: 'Base', h: 10.0, P: 4800, L: 22, segments: [8, 8, 4], openings: [], sill: 'ab58', spacing: 20, method: 'segmented' }
  ] };
  // Wall-line fixtures (SW62–SW66): line "A1" on one level (base, h 10) or two
  // (roof sds14 over base ab58), level forces 0. Each wall spec { id, L,
  // segments, openings, method, P }: P is the ASD line force the wall carries
  // (strength = P/0.6 in P_wind_lb), null = blank (inherit).
  function mkLine(roofWalls, baseWalls) {
    var roof = { name: 'Roof', h: 10.0, P: 0, L: 20, segments: [20], openings: [], sill: 'sds14', spacing: 12 };
    var base = { name: 'Base', h: 10.0, P: 0, L: 20, segments: [20], openings: [], sill: 'ab58', spacing: 20 };
    var st = mkState({ stories: baseWalls ? [roof, base] : [base] });
    [roofWalls, baseWalls].forEach(function (specs, fi) {
      if (!specs) return;
      var tpl = st.floors[fi].walls[0];
      st.floors[fi].walls = specs.map(function (o) {
        var w = clone(tpl);
        w.id = o.id; w.label = o.id; w.line = 'A1';
        w.L_ft = o.L; w.segments_ft = o.segments || [o.L];
        w.openings = (o.openings || []).map(function (x) { return { w_ft: x[0], hc_ft: x[1] }; });
        if (o.method) w.method = o.method;
        w.P_wind_lb = o.P === null || o.P === undefined ? null : o.P / 0.6;
        w.P_seis_lb = null;
        return w;
      });
    });
    return st;
  }
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
    SHEATHING: SHEATHING, HOLDOWNS: HOLDOWNS, STRAPS: STRAPS, SILL_CONN: SILL_CONN, NAILS: NAILS, WASHER: WASHER,
    LTP4_SHEATHING: LTP4_SHEATHING, STRAP_MIN_G: STRAP_MIN_G, HD_COLUMN: HD_COLUMN, CD_CONN: CD_CONN,
    compute: compute, validate: validate, runFixtures: runFixtures, FIXTURES: FIXTURES,
    normalizeWall: normalizeWall, upliftCapacity: upliftCapacity, combinedCheck: combinedCheck, penetrationDefault: penetrationDefault, penetrationDefaultText: penetrationDefaultText, penetrationCheck: penetrationCheck,
    calcCo: calcCo, calcR: calcR, sumBi: sumBi, openingArea: openingArea,
    storyForces: storyForces, chordForce: chordForce, lineKey: lineKey, lineShares: lineShares,
    sheathingCapacity: sheathingCapacity, combineFaces: combineFaces,
    holdownCapacity: holdownCapacity, holdownSpeciesCovered: holdownSpeciesCovered, endPostCheck: endPostCheck,
    findSheathing: findSheathing, findSill: findSill, sheathingLabel: sheathingLabel,
    resolveDead: resolveDead, defaultState: defaultState, defaultWall: defaultWall,
    clone: clone
  };
  root.SW = SW;
  if (typeof module !== 'undefined' && module.exports) module.exports = SW;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
