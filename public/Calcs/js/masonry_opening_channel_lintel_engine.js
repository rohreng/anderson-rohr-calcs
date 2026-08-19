/* =============================================================================
   Steel Channel Lintel at a New Opening in Existing Masonry — CHECK ENGINE
   AISC 360-22 (LRFD) + TMS 402-22 (strength design)

   Anderson Rohr Engineering · built to PLAN-CHANNEL-LINTEL.md rev 12
   (grilled, 7 Codex adversarial rounds, 2 Fable verification passes)
   Cross-check round 1 fixes C1–C6 applied — see PLAN-CHANNEL-LINTEL-REVIEW-LOG.md

   PURE FUNCTIONS ONLY — no DOM access. UI reads inputs, calls run(), renders.

   ARE STEEL CALCULATION STANDARD: every check carries a `steps` array of
   {sym, sub, val} lines — symbolic equation, substituted numbers, result — so
   the full derivation from load accumulation to resultant force is reviewable.
   ---------------------------------------------------------------------------
   TWO MODES (plan §Two modes):
     compositeMode = false   DEFAULT. Only mode that can produce a PASS.
     compositeMode = true    INFORMATIONAL ONLY. Cannot pass, cannot optimise.
   ---------------------------------------------------------------------------
   LOAD COMBINATION ENVELOPE (C1): every strength check is evaluated under EVERY
   ASCE 7-22 LRFD combination and reports its OWN maximum DCR together with the
   combination that produced it. Within one combination all demands — w_u, w_W,
   P_rod, T_w, ΔF, M_ux, M_y, V, R, rod forces, masonry forces — derive from that
   combination's factors, so H1-1b pairs M_ux and M_y from the same combination.
   Service-level checks (TMS 4.6 gravity deflection, 0.42W wind deflection) are
   NOT part of the factored loop and keep their service basis.
   ---------------------------------------------------------------------------
   CONNECTOR LAYOUT: two rows, STAGGERED by default — top row at s o.c., bottom
   row at s o.c. offset s/2. Rod pitch along the span is s/rows, so with s = 16"
   there is a rod in every 8" CMU cell, alternating high/low.
   ============================================================================= */
(function (root) {
  'use strict';

  var E_STEEL = 29000.0;

  function num(v, d) { var x = parseFloat(v); return isFinite(x) ? x : d; }
  function sq(x) { return x * x; }

  // ── derivation recorder: the ARE algebra-style calc line ──────────────────
  function Steps() { this.lines = []; }
  Steps.prototype.eq = function (label, sym, sub, val, unit, ref) {
    this.lines.push({ kind: 'eq', label: label, sym: sym, sub: sub, val: val, unit: unit || '', ref: ref || '' });
    return this;
  };
  Steps.prototype.txt = function (t) { this.lines.push({ kind: 'txt', text: t }); return this; };
  Steps.prototype.head = function (t) { this.lines.push({ kind: 'head', text: t }); return this; };
  Steps.prototype.out = function () { return this.lines; };
  function S() { return new Steps(); }
  function n(x, d) { if (!isFinite(x)) return '∞'; return x.toFixed(d == null ? 3 : d); }

  function chk(group, name, ref, demand, cap, unit, note, steps) {
    var dcr = (cap > 0) ? demand / cap : (demand > 0 ? Infinity : 0);
    return { group: group, name: name, ref: ref, demand: demand, capacity: cap,
             unit: unit || '', dcr: dcr, pass: dcr <= 1.0 + 1e-9,
             note: note || '', steps: steps || [], combo: '' };
  }
  function info(group, name, ref, demand, cap, unit, note, steps) {
    var r = chk(group, name, ref, demand, cap, unit, note, steps);
    r.informational = true; r.pass = null;
    return r;
  }
  // Stamp the governing load combination onto a finished check row. Every
  // factored check carries `combo` as a field AND states it in the note, so a
  // reviewer reading either the table or the printed row sees which combination
  // produced the reported DCR.
  function stamp(row, label) {
    row.combo = label;
    row.note = (row.note ? row.note + ' · ' : '') + 'governs at ' + label;
    return row;
  }
  function stampService(row, basis) {
    row.combo = basis;
    row.note = (row.note ? row.note + ' · ' : '') + basis + ' — not a factored combination';
    return row;
  }

  var FIELDS = ['W','A','d','bf','tf','tw','xbar','eo','Ix','Sx','Zx','rx',
                'Iy','Sy','Zy','ry','J','Cw','ro','H'];
  function section(label) {
    var db = root.CHANNEL_DB;
    if (!db || !db[label]) return null;
    var v = db[label], o = { label: label };
    for (var i = 0; i < FIELDS.length; i++) o[FIELDS[i]] = v[i];
    return o;
  }
  function allSections() {
    var db = root.CHANNEL_DB, out = [];
    for (var k in db) if (db.hasOwnProperty(k)) out.push(section(k));
    out.sort(function (a, b) { return a.W - b.W; });
    return out;
  }

  var CMU = { 8:  { t: 7.625,  tfs: 1.25  },
              10: { t: 9.625,  tfs: 1.375 },
              12: { t: 11.625, tfs: 1.50  } };
  var CELL = 8.0;

  var RODS = {
    'A307':    { Fy: 36,  Fu: 60,  Fnv: 27, Fnt: 45,  note: 'F_y customary — A307 specifies F_u only' },
    'A449':    { Fy: 92,  Fu: 120, Fnv: 54, Fnt: 90,  note: 'quenched & tempered — not generically field-weldable' },
    'A193-B7': { Fy: 105, Fu: 125, Fnv: 54, Fnt: 90,  note: 'alloy — not generically field-weldable' }
  };

  var COMBOS = [
    ['1.4D',              1.4, 0.0, 0.0, 0.0,  0.0],
    ['1.2D+1.6L+0.5Lr',   1.2, 1.6, 0.5, 0.0,  0.0],
    ['1.2D+1.6L+0.5S',    1.2, 1.6, 0.0, 0.5,  0.0],
    ['1.2D+1.6Lr+L',      1.2, 1.0, 1.6, 0.0,  0.0],
    ['1.2D+1.6S+L',       1.2, 1.0, 0.0, 1.6,  0.0],
    ['1.2D+1.0W+L+0.5Lr', 1.2, 1.0, 0.5, 0.0,  1.0],
    ['1.2D+1.0W+L+0.5S',  1.2, 1.0, 0.0, 0.5,  1.0],
    ['1.2D-1.0W+L+0.5Lr', 1.2, 1.0, 0.5, 0.0, -1.0],
    ['0.9D+1.0W',         0.9, 0.0, 0.0, 0.0,  1.0],
    ['0.9D-1.0W',         0.9, 0.0, 0.0, 0.0, -1.0]
  ];

  function assembleLoads(inp, sec) {
    var wWall = inp.w_cmu * inp.H_above / 1000.0;
    if (inp.archingReduction) wWall *= (inp.archingFactor || 1.0);
    var tribSum = (inp.trib_L || 0) + (inp.trib_R || 0);
    var wD = wWall + (inp.q_D || 0) * tribSum / 1000.0;
    var wL = (inp.q_L || 0) * tribSum / 1000.0;
    var wLr = (inp.q_Lr || 0) * tribSum / 1000.0;
    var wS = (inp.q_S || 0) * tribSum / 1000.0;
    var swPair = 2 * sec.W / 1000.0;
    wD += swPair;
    var hTrib = (inp.h_trib_ft != null && inp.h_trib_ft !== '')
              ? num(inp.h_trib_ft, 0) : (inp.H_above / 2.0 + sec.d / 24.0);
    var wW = Math.abs(inp.p_psf) * hTrib / 1000.0;
    return { wD: wD, wL: wL, wLr: wLr, wS: wS, wW: wW, hTrib: hTrib,
             wWall: wWall, swPair: swPair, tribSum: tribSum,
             wServiceGrav: wD + wL, L: inp.L_ft };
  }

  function beamActions(w_klf, patches, L_ft) {
    var L = L_ft * 12.0, w = w_klf / 12.0;
    var M = w * L * L / 8.0, V = w * L / 2.0;
    for (var i = 0; i < (patches || []).length; i++) {
      var p = patches[i];
      var a = Math.max(0, Math.min(L, p.a_in)), ln = Math.max(0.001, p.len_in);
      var c = a + ln / 2.0, P = p.P, R1 = P * (L - c) / L;
      M += R1 * c - P * ln / 8.0;
      V = Math.max(V, R1, P - R1);
    }
    return { M: M, V: V };
  }

  /* C5 — TMS 402-22 §5.1.1.1 concentrated-load dispersion, with the code's
     TERMINATIONS applied. The provision permits a 2:1 (vertical:horizontal)
     spread from the bearing, but the dispersion must terminate at the FIRST of
     several limits. The prior build used `bearing + 2·h/3`, which reads the full
     wall height above and therefore returns up to 2× the permitted length.

     Modelled here:
       · dispersion depth capped at HALF the available wall height above the
         load,        h_eff = h_above / 2
       · per-side spread = h_eff / 3   (the 1/3 horizontal run of the 2:1 wedge)
       · total patch  len = bearing + 2·(h_eff/3)
       · total patch capped at the centre-to-centre distance to the nearest
         adjacent concentrated load when more than one is present

     NOT modelled — must be checked by hand before point loads are relied on:
       · truncation at a movement joint
       · truncation at the end of the wall
       · truncation at an adjacent opening
       · independent per-side termination (this routine applies the SAME spread
         to both sides; a load near one truncation gets a short side and a long
         side, which this does not represent)
     A runtime warning states all four whenever any point load is supplied. */
  function dispersePatches(list, warn) {
    var out = [], i, j, dmin;
    list = list || [];
    for (i = 0; i < list.length; i++) {
      var pt = list[i];
      var brg = Math.max(0, num(pt.bearing_in, 0));
      var h_above = Math.max(0, num(pt.h_above_in, 0));
      var h_eff = h_above / 2.0;              // half-height termination
      var spread = h_eff / 3.0;               // per side, 2:1 dispersion
      out.push({ a_in: num(pt.x_in, 0), x_in: num(pt.x_in, 0), P: num(pt.P_kip, 0),
                 len_in: Math.max(0.001, brg + 2.0 * spread),
                 brg: brg, h_eff: h_eff, spread: spread, capped: false });
    }
    for (i = 0; i < out.length; i++) {
      dmin = Infinity;
      for (j = 0; j < out.length; j++)
        if (j !== i) dmin = Math.min(dmin, Math.abs(out[j].x_in - out[i].x_in));
      if (isFinite(dmin) && dmin < out[i].len_in) {
        out[i].len_in = Math.max(0.001, dmin);   // centre-to-centre cap
        out[i].capped = true;
      }
    }
    if (out.length && warn)
      warn.push('POINT LOADS: TMS 402-22 §5.1.1.1 dispersion is applied with the half-height ' +
                'termination (h_eff = h_above/2) and the centre-to-centre cap only. Truncation at ' +
                'movement joints, wall ends and adjacent openings, and INDEPENDENT per-side ' +
                'termination, are NOT modelled — verify the effective bearing length by hand.');
    return out;
  }

  function channelStrength(sec, Fy, Lb_in, Cb) {
    var Zx = sec.Zx, Sx = sec.Sx, Iy = sec.Iy, Cw = sec.Cw, J = sec.J;
    var ry = sec.ry, d = sec.d, tf = sec.tf, tw = sec.tw;
    var Mp = Fy * Zx, ho = d - tf;
    var c = (ho / 2.0) * Math.sqrt(Iy / Cw);
    var rts = Math.sqrt(Math.sqrt(Iy * Cw) / Sx);
    var Lp = 1.76 * ry * Math.sqrt(E_STEEL / Fy);
    var term = (J * c) / (Sx * ho);
    var Lr = 1.95 * rts * (E_STEEL / (0.7 * Fy)) *
             Math.sqrt(term + Math.sqrt(sq(term) + 6.76 * sq(0.7 * Fy / E_STEEL)));
    var Mn, mode;
    if (Lb_in <= Lp) { Mn = Mp; mode = 'F2.1 yielding (L_b ≤ L_p)'; }
    else if (Lb_in <= Lr) {
      Mn = Math.min(Cb * (Mp - (Mp - 0.7 * Fy * Sx) * (Lb_in - Lp) / (Lr - Lp)), Mp);
      mode = 'F2.2 inelastic LTB (L_p < L_b ≤ L_r)';
    } else {
      var Fcr = (Cb * Math.PI * Math.PI * E_STEEL / sq(Lb_in / rts)) *
                Math.sqrt(1 + 0.078 * term * sq(Lb_in / rts));
      Mn = Math.min(Fcr * Sx, Mp); mode = 'F2.2 elastic LTB (L_b > L_r)';
    }
    var Mny = Math.min(Fy * sec.Zy, 1.6 * Fy * sec.Sy);
    var Aw = d * tw, kv = 5.34, htw = (d - 2 * tf) / tw;
    var lim = 1.10 * Math.sqrt(kv * E_STEEL / Fy);
    var Cv1 = (htw <= lim) ? 1.0 : lim / htw;
    var Vn = 0.6 * Fy * Aw * Cv1;
    return { Mp: Mp, Lp: Lp, Lr: Lr, c: c, rts: rts, ho: ho, term: term, mode: mode,
             Aw: Aw, Cv1: Cv1, htw: htw, lim: lim, Mny: Mny, Mn: Mn, Vn: Vn,
             phiMnx: 0.90 * Mn, phiMny: 0.90 * Mny, phiVn: 0.90 * Vn };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  function run(input) {
    var inp = {}, kk, i, j;
    for (kk in input) if (input.hasOwnProperty(kk)) inp[kk] = input[kk];

    var sec = section(inp.section);
    if (!sec) return { error: 'Unknown section: ' + inp.section };

    var cmu = CMU[inp.t_nom] || CMU[8];
    var t = cmu.t, tfs = num(inp.t_fs_in, cmu.tfs);
    var L_in = inp.L_ft * 12.0;
    var Fy = num(inp.Fy, 36);
    var compositeMode = !!inp.compositeMode;
    var rows = Math.max(1, num(inp.rows, 2));
    var s = num(inp.s_in, 16);
    var staggered = (inp.staggered === undefined) ? true : !!inp.staggered;
    // TWO different lengths, conflated on the first build:
    //   trib_rod = s / n_rows  — load tributary carried by ONE rod. Same either
    //              way: staggering moves rods along the span, it does not change
    //              how much each one carries.
    //   pitch    — rod-to-rod distance ALONG THE SPAN. Staggered: s/n_rows, so
    //              supports occur twice as often. In-line: s, because both rods
    //              share one station. Drives the bond-beam span only.
    var trib_rod = s / rows;
    var pitch = staggered ? s / rows : s;
    var offset = staggered ? s / rows : 0;

    var loads = assembleLoads(inp, sec);
    var checks = [], warn = [];

    // ── LOAD ACCUMULATION ───────────────────────────────────────────────────
    var LA = S();
    LA.head('Wall load above the opening');
    LA.eq('Wall line load', 'w_wall = w_cmu × H_above',
      n(inp.w_cmu, 0) + ' psf × ' + n(inp.H_above, 2) + ' ft', n(loads.wWall * 1000, 1), 'plf',
      'full rectangle — TMS 402-22 has no lintel arching provision');
    LA.head('Superimposed line loads');
    LA.eq('Tributary width', 'B_trib = B_L + B_R',
      n(inp.trib_L || 0, 2) + ' + ' + n(inp.trib_R || 0, 2), n(loads.tribSum, 2), 'ft');
    LA.eq('Dead', 'w_D,sup = q_D × B_trib',
      n(inp.q_D || 0, 0) + ' × ' + n(loads.tribSum, 2), n((inp.q_D || 0) * loads.tribSum, 1), 'plf');
    LA.eq('Live', 'w_L = q_L × B_trib',
      n(inp.q_L || 0, 0) + ' × ' + n(loads.tribSum, 2), n(loads.wL * 1000, 1), 'plf');
    LA.eq('Roof live', 'w_Lr = q_Lr × B_trib',
      n(inp.q_Lr || 0, 0) + ' × ' + n(loads.tribSum, 2), n(loads.wLr * 1000, 1), 'plf');
    LA.eq('Snow', 'w_S = q_S × B_trib',
      n(inp.q_S || 0, 0) + ' × ' + n(loads.tribSum, 2), n(loads.wS * 1000, 1), 'plf');
    LA.head('Steel self weight');
    LA.eq('Both channels', 'w_sw = 2 × W_ch', '2 × ' + n(sec.W, 1) + ' plf',
      n(loads.swPair * 1000, 1), 'plf');
    LA.head('Service totals, both channels');
    LA.eq('Total dead', 'w_D = w_wall + w_D,sup + w_sw',
      n(loads.wWall * 1000, 1) + ' + ' + n((inp.q_D || 0) * loads.tribSum, 1) + ' + ' + n(loads.swPair * 1000, 1),
      n(loads.wD * 1000, 1), 'plf');
    LA.eq('Service D+L', 'w_serv = w_D + w_L',
      n(loads.wD * 1000, 1) + ' + ' + n(loads.wL * 1000, 1), n(loads.wServiceGrav * 1000, 1), 'plf',
      'used for the TMS 4.6 deflection check');
    LA.head('Out-of-plane wind, both channels');
    LA.eq('Tributary height', 'h_trib', (inp.h_trib_ft !== '' && inp.h_trib_ft != null)
      ? 'user input' : 'H_above/2 + d/2', n(loads.hTrib, 2), 'ft');
    LA.eq('Wind line load', 'w_W = p × h_trib',
      n(Math.abs(inp.p_psf), 0) + ' psf × ' + n(loads.hTrib, 2) + ' ft', n(loads.wW * 1000, 1), 'plf',
      'strength level, ASCE 7 C&C');

    var patches = dispersePatches(inp.pointLoads, warn);

    // ── layout ───────────────────────────────────────────────────────────────
    var LAY = S();
    LAY.head('Rod layout');
    LAY.eq('Rows', 'n_rows', '', n(rows, 0), '');
    LAY.eq('Row spacing', 's', 'each row', n(s, 0), 'in');
    LAY.txt(staggered
      ? '<b>STAGGERED.</b> Bottom row offset ' + n(offset, 0) + '&quot; horizontally from the top row, so rods alternate high–low along the span.'
      : '<b>IN-LINE.</b> Both rows share the same station — a vertical pair every ' + n(s, 0) + '&quot;.');
    LAY.eq('Rod pitch along span', staggered ? 'p = s / n_rows' : 'p = s',
      staggered ? (n(s, 0) + ' / ' + n(rows, 0)) : n(s, 0), n(pitch, 1), 'in',
      staggered ? ('one rod every ' + n(pitch, 0) + '&quot; — matches the ' + CELL + '&quot; CMU cell module, a rod in every cell')
                : 'two rods share each station');
    if (staggered && Math.abs(pitch - CELL) > 1e-6)
      warn.push('Staggered pitch is ' + n(pitch, 1) + '" but the CMU cell module is ' + CELL +
                '" — rods will not land in every cell. Use s = ' + (CELL * rows) + '" for a rod per cell.');
    if (!staggered)
      warn.push('Rows are IN-LINE, not staggered. Both rods share a station, which concentrates ' +
                'breakout cones and quadruples the bond-beam moment between supports.');

    // ── composite geometry (gated) ───────────────────────────────────────────
    var z_ch = t / 2.0 + sec.xbar;
    var I_comp = 2.0 * (sec.Iy + sec.A * sq(z_ch));
    var I_nc = 2.0 * sec.Iy, Qc = sec.A * z_ch;
    var slipLever = 2.0 * (sec.xbar - sec.tw / 2.0);
    var c_h = num(inp.c_h_in, 0.0625);
    var comp = { active: compositeMode, z_ch: z_ch, I_comp: I_comp, I_nc: I_nc, Q: Qc,
                 q: 0, N_ch: 0, My_ch: 0, slipLever: slipLever, c_h: c_h };

    // ── channel strength (combination-independent) ───────────────────────────
    var Lb = num(inp.Lb_in, L_in), LbUser = (inp.Lb_in != null && inp.Lb_in !== '');
    // C3 — C_b = 1.14 is the simple-span UDL value and is only defensible when
    // L_b IS the full span, i.e. the moment diagram over the segment is the full
    // parabola. When the engineer names a shorter L_b, the governing interior
    // segment sits near the peak of the diagram and approaches UNIFORM moment,
    // for which C_b = 1.0. Taking 1.0 there is the conservative reading.
    var Cb = (LbUser && Lb < L_in) ? 1.0 : 1.14;
    var cs = channelStrength(sec, Fy, Lb, Cb);

    if (sec.d > inp.H_above * 12.0)
      warn.push('Channel depth ' + sec.d + '" exceeds the wall height above the opening.');
    if (Math.abs(s % CELL) > 1e-6)
      warn.push('Row spacing ' + s + '" is not a multiple of ' + CELL + '" — rods must land in grouted cells.');
    if (!inp.bondBeam)
      warn.push('CONDITION OF USE NOT MET: a continuous reinforced grouted bond beam spanning the ' +
                'opening is required. Gravity transfer between rods is checked through it.');
    if (LbUser && Lb < L_in)
      warn.push('L_b = ' + (Lb / 12).toFixed(2) + ' ft is an ENGINEER-SPECIFIED bracing assumption, below ' +
                'the ' + (L_in / 12).toFixed(1) + ' ft full span. AISC Appendix 6 brace strength and ' +
                'stiffness are NOT verified by this calculator — justify it.');
    if (inp.fm_basis === 'assumed')
      warn.push("f'm is ASSUMED, not established by test or prism. State the basis on the drawings.");

    // ── connector geometry and capacities (combination-independent) ──────────
    var tw = sec.tw, Lg = t + tw;
    var g = num(inp.g_in, 12), db_ = num(inp.d_b, 0.75);
    var Ab = Math.PI * sq(db_) / 4.0, Srod = Math.PI * Math.pow(db_, 3) / 32.0;
    var rod = RODS[inp.rodGrade] || RODS['A307'];
    var Fy_rod = num(inp.rodFy, rod.Fy), Fu_rod = rod.Fu;
    var fm_ksi = inp.fm_psi / 1000.0;
    var Lc_grav = Math.min(t, num(inp.Lc_grav_in, t));
    var e_sc = sec.eo + tw / 2.0;
    var Lu = Math.max(tw / 2.0, num(inp.Lu_in, tw / 2.0));
    var Lc = Math.max(0.001, Math.min(t, Lg - 2 * Lu));
    var sstar = sq(Lc) / (4.0 * Lg);

    comp.w_slip = inp.weldedConnector ? 0
      : (slipLever > 0 ? (c_h / slipLever) * (24.0 * E_STEEL * I_nc / Math.pow(L_in, 3)) * 12.0 : Infinity);
    comp.engaged = comp.w_slip < loads.wW;

    var phi_rn_shear = 0.75 * rod.Fnv * Ab;
    var lc = Math.max(0.1, num(inp.lc_in, 1.5 * db_ - db_ / 2.0));
    var Fu_ch = num(inp.Fu_channel, 58.0);
    var phi_rn_brg = 0.75 * Math.min(1.2 * lc * tw * Fu_ch, 2.4 * db_ * tw * Fu_ch);

    var Abr = db_ * t;
    var phiBn_brg = 0.60 * 0.8 * fm_ksi * Abr;
    var phiBvnc = 0.50 * 1750 * Math.pow(inp.fm_psi * Ab, 0.25) / 1000.0;
    function breakout(lbe) {
      if (!(lbe > 0)) return Infinity;
      return 0.50 * 4.0 * (Math.PI * sq(lbe) / 2.0) * Math.sqrt(inp.fm_psi) / 1000.0;
    }
    var phiBvnb_up = breakout(num(inp.lbe_up_in, 0)), phiBvnb_dn = breakout(num(inp.lbe_dn_in, 0));
    var phiBvnb = Math.min(phiBvnb_up, phiBvnb_dn);
    // C6 — TMS 9.1.6.3.2 applies the f_u ≤ min(1.9 f_y, 125 ksi) cap to the SHEAR
    // equations as well as to Eq. 9-2 tension; mirror the cap used below.
    var fu_cap = Math.min(Fu_rod, 1.9 * Fy_rod, 125.0);
    var phiBvns = 0.65 * 0.6 * Ab * fu_cap;
    var A_wsh = num(inp.washer_in2, 9.0 - Math.PI * sq(db_ + 0.0625) / 4.0);
    var phiBans = 0.75 * Ab * fu_cap;
    var phiFaceShell = 0.60 * 0.8 * fm_ksi * A_wsh;
    var phiBan = Math.min(phiBans, phiFaceShell);
    var phiBvn = Math.min(phiBvnc, phiBvnb, phiBvns);
    var f_g_allow = 0.60 * 0.8 * fm_ksi;

    // ── bond beam geometry (combination-independent) ────────────────────────
    var bbSpan = pitch;
    // d_bb = t − 2 is a WALL-THICKNESS stand-in for the effective depth of the
    // bond-beam band, not a computed d. It is conservative ONLY because the plan
    // mandates a multi-course reinforced band, whose real effective depth (taken
    // vertically through the band) is larger than the wall thickness. If the band
    // is ever reduced to a single course this stand-in must be replaced.
    // NOT CHECKED: TMS 9.3.3.2.2.1 (M_n ≥ 1.3·M_cr) and its 9.3.3.2.2.2 exemption
    // (A_s ≥ 4/3 A_s,req). At the shipping A_s,req values the 0.40 in² default
    // exceeds 4/3·A_s,req by orders of magnitude and is expected to satisfy the
    // exemption, but that is an expectation, not a computed check.
    var d_bb = t - 2.0;
    var As_prov = num(inp.bb_As_in2, 0.40);

    // ── jamb bolt group (C2) ────────────────────────────────────────────────
    // ELASTIC VECTOR METHOD. Bolts sit on a line running INTO the pier from the
    // opening face: x_i = jamb_edge + (i−1)·jamb_pitch. The channel reaction R is
    // delivered in the web plane at x = 0 (the opening face), consistent with the
    // clear-span model used for M and V. The group therefore carries R plus a
    // moment R·e_group about its own centroid, e_group = x̄.
    //   direct     f_d = R / n
    //   moment     f_m = R · e_group · |x_max − x̄| / Σ(x_i − x̄)²
    //   extreme    V_j = f_d + f_m          (both components vertical, collinear)
    // Adding bolts lengthens the line, which RAISES e_group; the extreme force
    // falls only as ≈ 1/n + 3/(n+1) for the default 4"/8" layout, not as 1/n.
    var nJ = Math.max(1, Math.round(num(inp.jamb_n, 4)));
    var jPitch = Math.max(0.001, num(inp.jamb_pitch_in, 8));   // NEW input, default 8"
    var jEdge = Math.max(0, num(inp.jamb_edge_in, 4));         // NEW input, default 4"
    var jx = [], jSum = 0;
    for (i = 0; i < nJ; i++) { jx.push(jEdge + i * jPitch); jSum += jx[i]; }
    var jXbar = jSum / nJ, jSumD2 = 0;
    for (i = 0; i < nJ; i++) jSumD2 += sq(jx[i] - jXbar);
    var jDmax = Math.abs(jx[nJ - 1] - jXbar);
    var jambFactor = 1.0 / nJ + ((jSumD2 > 1e-9) ? (jXbar * jDmax / jSumD2) : 0.0);
    if (nJ < 2)
      warn.push('A single jamb bolt cannot develop the group moment R·e_group = ' +
                n(jXbar, 1) + '" × R. The eccentric term is reported as zero — use at least two bolts.');
    var capJ = Math.min(phi_rn_shear * 2, phiBvn);

    // ── sharing ratios ──────────────────────────────────────────────────────
    // The 50/50 gravity split is FORCED BY STATICS, not chosen: the grout patch
    // is centred between the two webs and the rod is a determinate two-support
    // member, so half the tributary load lands on each channel. A 100/0 entry is
    // therefore an envelope, not a redistribution — it conservatively DOUBLES the
    // CHANNEL demands only. Per-plane rod shear (V_y = P_rod/2), the rod's own
    // gravity moment and the jamb reaction are fixed by rod statics and
    // deliberately do NOT scale with α_grav; the UI discloses that.
    var gShare = Math.max(0.5, Math.min(1.0, num(inp.gravitySplit, 0.5)));
    var wShare = Math.max(0.5, Math.min(1.0, num(inp.windSplit, 0.5)));

    // ═══ C1 — FULL LOAD-COMBINATION ENVELOPE ═════════════════════════════════
    // Every demand below is a pure function of ONE combination's factors, so all
    // demands used in any single check row are mutually consistent.
    function demandsFor(C) {
      var fW = C[5], aW = Math.abs(fW);
      var wu = C[1] * loads.wD + C[2] * loads.wL + C[3] * loads.wLr + C[4] * loads.wS;
      var ww = fW * loads.wW;
      var pair = beamActions(wu, patches, inp.L_ft);
      var wu_ch = wu * gShare;
      var act = beamActions(wu_ch, patches.map(function (p) {
        return { a_in: p.a_in, len_in: p.len_in, P: p.P * gShare }; }), inp.L_ft);
      var Mux = act.M, Vux = act.V;

      var w_w = aW * loads.wW;
      var M_w_total = (w_w / 12.0) * sq(L_in) / 8.0;
      var V_w_total = (w_w / 12.0) * L_in / 2.0;

      var q = 0, N_ch = 0, My_comp = 0, V_x = 0, k = 0, M_wind = 0;
      if (compositeMode) {
        q = V_w_total * Qc / I_comp;
        N_ch = M_w_total * sec.A * z_ch / I_comp;
        My_comp = M_w_total * sec.Iy / I_comp;
        V_x = q * trib_rod;
        k = 4.0 * V_x * Lg / sq(Lc);
        M_wind = V_x * (Lu + sstar / 2.0);
      }
      var My_ch = compositeMode ? My_comp : (M_w_total * wShare);
      var h1 = Mux / cs.phiMnx + My_ch / cs.phiMny;

      var P_rod = wu * (trib_rod / 12.0);
      var V_y = P_rod / 2.0;
      var M_grav = (P_rod / 2.0) * (Lg / 2.0 - Lc_grav / 4.0);
      var T_w = aW * Math.abs(inp.p_psf) * loads.hTrib * (trib_rod / 12.0) / 1000.0;
      var dF = (wu_ch / 12.0) * s * e_sc / g;
      var N_rod = T_w + dF;

      var M_res = Math.sqrt(sq(M_wind) + sq(M_grav));
      var V_res = Math.sqrt(sq(V_x) + sq(V_y));
      // V_mas — the rod's TOTAL force on the grout. In the shipping (non-composite)
      // branch V_x = 0 and this is simply P_rod, which is exact.
      // COMPOSITE branch only: V_x·n_rows is a crude STAND-IN for the resultant of
      // the grout couple. Against the true resultant 2·V_x·L_g/L_c it is 5.6% LOW
      // at rows = 2 and 89% HIGH at rows = 4. That error is tolerated solely
      // because the composite branch is informational and can never return a PASS.
      var V_mas = Math.sqrt(sq(V_x * rows) + sq(P_rod));
      var sigma = N_rod / Ab + M_res / Srod;
      var tau = 4.0 * V_res / (3.0 * Ab);
      var vm = Math.sqrt(sq(sigma) + 3.0 * sq(tau));

      var frv = V_res / Ab;
      var Fnt_p = Math.min(1.3 * rod.Fnt - (rod.Fnt / (0.75 * rod.Fnv)) * frv, rod.Fnt);
      var capTS = 0.75 * Math.max(0, Fnt_p) * Ab;
      var i98 = Math.pow(N_rod / phiBan, 5 / 3) + Math.pow(V_mas / phiBvn, 5 / 3);

      var M_bb = (wu / 12.0) * sq(bbSpan) / 10.0;
      var As_req = M_bb / (0.9 * 60.0 * 0.9 * d_bb);

      var R_total = (wu / 12.0) * L_in / 2.0;
      var Vj_avg = R_total / nJ;
      var Vj_ecc = R_total * jambFactor;
      var f_g = compositeMode ? k / db_ : 0;

      var D = { label: C[0], factors: C, aW: aW, wu: wu, ww: ww, wu_ch: wu_ch,
                Mpair: pair.M, Vpair: pair.V, Mux: Mux, Vux: Vux,
                w_w: w_w, M_w_total: M_w_total, V_w_total: V_w_total,
                q: q, N_ch: N_ch, My_comp: My_comp, My_ch: My_ch, h1: h1,
                P_rod: P_rod, V_y: V_y, M_grav: M_grav, T_w: T_w, dF: dF, N_rod: N_rod,
                V_x: V_x, k: k, M_wind: M_wind, M_res: M_res, V_res: V_res, V_mas: V_mas,
                sigma: sigma, tau: tau, vm: vm, frv: frv, Fnt_p: Fnt_p, capTS: capTS,
                i98: i98, M_bb: M_bb, As_req: As_req,
                R_total: R_total, Vj_avg: Vj_avg, Vj: Vj_ecc, f_g: f_g };
      D.C = {
        F2:    { d: Mux,    c: cs.phiMnx },
        V:     { d: Vux,    c: cs.phiVn },
        F6:    { d: My_ch,  c: cs.phiMny },
        H1:    { d: h1,     c: 1.0 },
        rodVM: { d: vm,     c: 0.90 * Fy_rod },
        rodSh: { d: V_res,  c: phi_rn_shear },
        rodBr: { d: V_res,  c: phi_rn_brg },
        masBr: { d: V_mas,  c: phiBn_brg },
        masCr: { d: V_mas,  c: phiBvnc },
        masBo: { d: V_mas,  c: phiBvnb },
        masTn: { d: N_rod,  c: phiBan },
        mas98: { d: i98,    c: 1.0 },
        rodTS: { d: N_rod,  c: capTS },
        bb:    { d: As_req, c: As_prov },
        jamb:  { d: Vj_ecc, c: capJ },
        grout: { d: f_g,    c: f_g_allow }
      };
      return D;
    }

    function dcrIn(D, key) {
      var p = D.C[key];
      return (p.c > 0) ? p.d / p.c : (p.d > 0 ? Infinity : 0);
    }

    var E = [], comboRows = [];
    for (i = 0; i < COMBOS.length; i++) {
      var D_i = demandsFor(COMBOS[i]);
      E.push(D_i);
      comboRows.push({ label: D_i.label, wu: D_i.wu, ww: D_i.ww, M: D_i.Mpair });
    }
    // Per-check envelope: the combination that maximises THIS check's DCR.
    function govFor(key) {
      var b = E[0], bd = dcrIn(E[0], key), d;
      for (var q = 1; q < E.length; q++) {
        d = dcrIn(E[q], key);
        if (d > bd) { bd = d; b = E[q]; }
      }
      return b;
    }
    // Overall governing combination = the one driving the worst FACTORED check.
    // Reported in `combo`, marked in the combination table, and used as the basis
    // for the scalar `demands` / `connector` / `composite` reporting blocks so
    // those blocks stay internally consistent with `combo`.
    var factoredKeys = ['F2','V','F6','H1','rodVM','rodSh','rodBr','masBr','masCr',
                        'masTn','mas98','rodTS','bb','jamb'];
    if (isFinite(phiBvnb)) factoredKeys.push('masBo');
    if (compositeMode) factoredKeys.push('grout');
    var RC = E[0], rcDcr = -1;
    for (i = 0; i < E.length; i++) {
      for (j = 0; j < factoredKeys.length; j++) {
        var dd = dcrIn(E[i], factoredKeys[j]);
        if (dd > rcDcr) { rcDcr = dd; RC = E[i]; }
      }
    }

    LA.head('ASCE 7-22 LRFD combinations (klf on the pair)');
    LA.txt('<b>Every strength check below is evaluated under ALL ten combinations</b> and reports its ' +
           'own maximum DCR with the combination that produced it. The marker names the combination ' +
           'driving the worst factored check overall.');
    comboRows.forEach(function (cr) {
      LA.eq(cr.label + (cr.label === RC.label ? '  ← GOVERNS OVERALL' : ''), 'w_u', '',
        n(cr.wu, 4), 'klf', cr.ww ? ('w_W = ' + n(cr.ww, 4) + ' klf') : '');
    });

    LA.head('Distribution to one channel — at ' + RC.label);
    LA.eq('Sharing ratio', 'α_grav', 'statics forces 50/50; higher values are a channel-only envelope',
      n(gShare, 2), '');
    LA.eq('Factored, one channel', 'w_u,ch = α_grav × w_u',
      n(gShare, 2) + ' × ' + n(RC.wu, 4), n(RC.wu_ch, 4), 'klf');
    LA.eq('Design moment', 'M_ux = w_u,ch · L² / 8',
      n(RC.wu_ch / 12, 5) + ' × ' + n(L_in, 0) + '² / 8', n(RC.Mux, 1), 'kip-in',
      '= ' + n(RC.Mux / 12, 1) + ' kip-ft');
    LA.eq('Design shear', 'V_ux = w_u,ch · L / 2',
      n(RC.wu_ch / 12, 5) + ' × ' + n(L_in, 0) + ' / 2', n(RC.Vux, 2), 'kip');
    LA.eq('Wind moment, pair', 'M_w = w_W · L² / 8',
      n(RC.w_w / 12, 5) + ' × ' + n(L_in, 0) + '² / 8', n(RC.M_w_total, 1), 'kip-in');
    LA.eq('Wind shear, pair', 'V_w = w_W · L / 2',
      n(RC.w_w / 12, 5) + ' × ' + n(L_in, 0) + ' / 2', n(RC.V_w_total, 2), 'kip');

    if (compositeMode) { comp.q = RC.q; comp.N_ch = RC.N_ch; comp.My_ch = RC.My_comp; }

    // ═══ CHECKS — each at its own governing combination ══════════════════════
    var gF2 = govFor('F2');
    var sF = S();
    sF.txt('Governing load combination: <b>' + gF2.label + '</b> (w_u = ' + n(gF2.wu, 4) +
           ' klf on the pair), enveloped over all ten.');
    sF.head('Section classification and LTB parameters');
    sF.eq('Plastic moment', 'M_p = F_y · Z_x', n(Fy, 0) + ' × ' + n(sec.Zx, 1), n(cs.Mp, 1), 'kip-in', 'AISC F2.1');
    sF.eq('Flange centroid distance', 'h_o = d − t_f', n(sec.d, 2) + ' − ' + n(sec.tf, 3), n(cs.ho, 3), 'in');
    sF.eq('Channel c factor', 'c = (h_o/2)·√(I_y / C_w)',
      '(' + n(cs.ho, 3) + '/2)·√(' + n(sec.Iy, 2) + '/' + n(sec.Cw, 0) + ')', n(cs.c, 4), '',
      'AISC Eq. F2-8b — channels, NOT c = 1');
    sF.eq('Effective radius', 'r_ts = √(√(I_y·C_w)/S_x)', '', n(cs.rts, 3), 'in');
    sF.eq('Limit L_p', 'L_p = 1.76·r_y·√(E/F_y)',
      '1.76×' + n(sec.ry, 3) + '×√(29000/' + n(Fy, 0) + ')', n(cs.Lp, 2), 'in');
    sF.eq('Limit L_r', 'L_r  (AISC Eq. F2-6)', '', n(cs.Lr, 2), 'in');
    sF.eq('Unbraced length', 'L_b', LbUser ? 'ENGINEER-SPECIFIED' : 'full span, default', n(Lb, 1), 'in');
    sF.txt('Governing regime: <b>' + cs.mode + '</b>, C_b = ' + n(Cb, 2) +
      (Cb === 1.14 ? ' (UDL over the full span, simple span).'
                   : ' (L_b below the full span — the governing interior segment approaches uniform moment).'));
    sF.eq('Nominal', 'M_n', '', n(cs.Mn, 1), 'kip-in');
    sF.eq('ALLOWABLE', 'φ_b·M_n = 0.90·M_n', '0.90 × ' + n(cs.Mn, 1), n(cs.phiMnx, 1), 'kip-in',
      '= ' + n(cs.phiMnx / 12, 1) + ' kip-ft');
    sF.eq('DEMAND', 'M_ux = α_grav·w_u·L²/8',
      n(gF2.wu_ch / 12, 5) + ' × ' + n(L_in, 0) + '² / 8', n(gF2.Mux, 1), 'kip-in',
      '= ' + n(gF2.Mux / 12, 1) + ' kip-ft');
    checks.push(stamp(chk('Channel', 'Flexure, strong axis (gravity)', 'AISC 360-22 F2', gF2.Mux, cs.phiMnx, 'kip-in',
      'L_b = ' + (Lb / 12).toFixed(2) + ' ft' + (LbUser ? ' (engineer-specified)' : ' = full span, default'), sF.out()), gF2.label));

    var gV = govFor('V');
    var sV = S();
    sV.txt('Governing load combination: <b>' + gV.label + '</b>.');
    sV.eq('Web area', 'A_w = d × t_w', n(sec.d, 2) + ' × ' + n(sec.tw, 3), n(cs.Aw, 3), 'in²', 'gross');
    sV.eq('Web slenderness', 'h/t_w = (d − 2t_f)/t_w', '', n(cs.htw, 2), '');
    sV.eq('Limit', '1.10·√(k_v·E/F_y), k_v = 5.34', '', n(cs.lim, 2), '');
    sV.eq('Web shear coefficient', 'C_v1', cs.htw <= cs.lim ? 'h/t_w ≤ limit' : 'limit/(h/t_w)', n(cs.Cv1, 3), '', 'Eq. G2-3');
    sV.eq('Nominal', 'V_n = 0.6·F_y·A_w·C_v1',
      '0.6×' + n(Fy, 0) + '×' + n(cs.Aw, 3) + '×' + n(cs.Cv1, 3), n(cs.Vn, 1), 'kip');
    sV.eq('ALLOWABLE', 'φ_v·V_n = 0.90·V_n', '0.90 × ' + n(cs.Vn, 1), n(cs.phiVn, 1), 'kip');
    sV.eq('DEMAND', 'V_ux = α_grav·w_u·L/2',
      n(gV.wu_ch / 12, 5) + ' × ' + n(L_in, 0) + ' / 2', n(gV.Vux, 2), 'kip');
    checks.push(stamp(chk('Channel', 'Shear', 'AISC 360-22 G2', gV.Vux, cs.phiVn, 'kip', 'gross web', sV.out()), gV.label));

    var gF6 = govFor('F6');
    var sY = S();
    sY.txt('Governing load combination: <b>' + gF6.label + '</b> (wind factor ' + n(gF6.aW, 1) + ').');
    sY.eq('Yield limit', 'M_p,y = F_y·Z_y', n(Fy, 0) + '×' + n(sec.Zy, 2), n(Fy * sec.Zy, 1), 'kip-in');
    sY.eq('Shape-factor cap', '1.6·F_y·S_y', '1.6×' + n(Fy, 0) + '×' + n(sec.Sy, 2),
      n(1.6 * Fy * sec.Sy, 1), 'kip-in', 'S_y is the SMALLER value for a channel');
    sY.eq('Nominal', 'M_ny = min(above)', '', n(cs.Mny, 1), 'kip-in', 'AISC F6');
    sY.eq('ALLOWABLE', 'φ·M_ny', '0.90 × ' + n(cs.Mny, 1), n(cs.phiMny, 1), 'kip-in');
    sY.eq('Wind moment, pair', 'M_w = |f_W|·w_W·L²/8', n(gF6.w_w / 12, 5) + '×' + n(L_in, 0) + '²/8',
      n(gF6.M_w_total, 1), 'kip-in');
    sY.eq('Sharing ratio', 'α_wind', '', n(wShare, 2), '');
    sY.eq('DEMAND', compositeMode ? 'M_y,ch = M_w·I_y/I_comp' : 'M_y,ch = α_wind · M_w',
      compositeMode ? '' : (n(wShare, 2) + ' × ' + n(gF6.M_w_total, 1)), n(gF6.My_ch, 1), 'kip-in');
    checks.push(stamp(chk('Channel', 'Flexure, weak axis (wind)', 'AISC 360-22 F6', gF6.My_ch, cs.phiMny, 'kip-in',
      compositeMode ? 'composite decomposition' : 'non-composite share', sY.out()), gF6.label));

    var gH1 = govFor('H1');
    var sH = S();
    sH.txt('Governing load combination: <b>' + gH1.label + '</b>. M_ux and M_y,ch are taken from the ' +
           'SAME combination — no mixing of a gravity-governed moment with a wind-governed one.');
    sH.txt(compositeMode ? 'Composite mode: axial couple present.'
      : 'Non-composite: <b>P_r = 0</b>, so H1-1 reduces to the biaxial moment sum.');
    sH.eq('DEMAND / ALLOWABLE', 'M_rx/M_cx + M_ry/M_cy ≤ 1.0',
      n(gH1.Mux, 1) + '/' + n(cs.phiMnx, 1) + ' + ' + n(gH1.My_ch, 1) + '/' + n(cs.phiMny, 1), n(gH1.h1, 3), '',
      'AISC Eq. H1-1b');
    checks.push(stamp(chk('Channel', 'Combined biaxial interaction', 'AISC 360-22 H1-1b', gH1.h1, 1.0, '',
      compositeMode ? 'P_r from composite couple' : 'P_r = 0', sH.out()), gH1.label));

    // ── CONNECTOR ────────────────────────────────────────────────────────────
    var gVM = govFor('rodVM');
    var sR = S();
    sR.txt('Governing load combination: <b>' + gVM.label + '</b>, enveloped over all ten.');
    sR.head('Rod tributary and gravity actions');
    sR.eq('Grip', 'L_g = t + t_w', n(t, 3) + ' + ' + n(tw, 3), n(Lg, 3), 'in', 'mid-web to mid-web');
    sR.eq('Rod tributary', 'a_rod = s / n_rows', n(s, 0) + '/' + n(rows, 0), n(trib_rod, 1), 'in',
      'unchanged by staggering — staggering moves rods along the span, it does not change what each carries');
    sR.eq('Rod pitch along span', staggered ? 'p = s/n_rows (staggered)' : 'p = s (in-line)',
      '', n(pitch, 1), 'in', 'drives the bond-beam span only');
    sR.eq('Gravity per rod', 'P_rod = w_u · a_rod',
      n(gVM.wu / 12, 5) + ' × ' + n(trib_rod, 1), n(gVM.P_rod, 4), 'kip');
    sR.eq('Per shear plane', 'V_y = P_rod / 2', n(gVM.P_rod, 4) + ' / 2', n(gVM.V_y, 4), 'kip',
      'load enters between the webs and splits — fixed by rod statics, does not scale with α_grav');
    sR.eq('Grout contact (gravity)', 'L_c,grav', 'ordinary installation, annulus grouted solid', n(Lc_grav, 3), 'in');
    sR.eq('Gravity-plane rod moment', 'M_grav = (P_rod/2)·(L_g/2 − L_c/4)',
      '(' + n(gVM.P_rod, 4) + '/2)·(' + n(Lg, 3) + '/2 − ' + n(Lc_grav, 3) + '/4)', n(gVM.M_grav, 4), 'kip-in');
    sR.head('Out-of-plane tension');
    sR.eq('Wind tension branch', 'T_w = |f_W|·p_wind · h_trib · a_rod',
      n(gVM.aW, 1) + '×' + n(Math.abs(inp.p_psf), 0) + '×' + n(loads.hTrib, 2) + '×' + n(trib_rod / 12, 3),
      n(gVM.T_w, 4), 'kip', 'suction, at this combination’s wind factor');
    sR.eq('Shear-centre eccentricity', 'e = e_o + t_w/2', n(sec.eo, 3) + ' + ' + n(tw / 2, 3), n(e_sc, 4), 'in');
    sR.eq('Torsion couple', 'ΔF = w_u,ch·s·e / g',
      n(gVM.wu_ch / 12, 5) + '×' + n(s, 0) + '×' + n(e_sc, 3) + '/' + n(g, 0), n(gVM.dF, 4), 'kip',
      'TOP row tension; bottom row bears. Both channels tension the same rod — the torques reinforce.');
    if (staggered) sR.txt('Staggered: the couple forms between a top rod and the adjacent bottom rod ' +
      n(offset, 0) + '&quot; along the span. Magnitude unchanged; the channel web spans that offset locally.');
    sR.eq('Rod axial', 'N_rod = T_w + ΔF', n(gVM.T_w, 4) + ' + ' + n(gVM.dF, 4), n(gVM.N_rod, 4), 'kip');
    sR.head('Composite longitudinal terms');
    if (compositeMode) {
      sR.eq('Shear flow', 'q = V_w·Q/I_comp',
        n(gVM.V_w_total, 2) + '×' + n(Qc, 2) + '/' + n(I_comp, 1), n(gVM.q, 4), 'kip/in');
      sR.eq('Per rod', 'V_x = q · a_rod', n(gVM.q, 4) + '×' + n(trib_rod, 1), n(gVM.V_x, 4), 'kip',
        'FULL value per plane — channel-to-channel, not halved');
      sR.eq('Grout contact', 'L_c = min(t, L_g − 2L_u)', 'L_u = ' + n(Lu, 3), n(Lc, 3), 'in');
      sR.eq('Grout reaction', 'k = 4·V_x·L_g / L_c²',
        '4×' + n(gVM.V_x, 3) + '×' + n(Lg, 3) + '/' + n(Lc, 3) + '²', n(gVM.k, 4), 'kip/in');
      sR.eq('Max-moment location', 's* = L_c²/(4L_g)', '', n(sstar, 4), 'in');
      sR.eq('Wind-plane rod moment', 'M_wind = V_x·(L_u + s*/2)',
        n(gVM.V_x, 3) + '×(' + n(Lu, 3) + ' + ' + n(sstar, 3) + '/2)', n(gVM.M_wind, 4), 'kip-in');
    } else {
      sR.txt('<b>Non-composite mode: q = V_x = k = M_wind = 0 identically.</b> Gravity actions only.');
    }
    sR.head('Combined rod stress');
    sR.eq('Resultant moment', 'M_res = √(M_wind² + M_grav²)',
      '√(' + n(gVM.M_wind, 3) + '² + ' + n(gVM.M_grav, 3) + '²)', n(gVM.M_res, 4), 'kip-in', 'biaxial');
    sR.eq('Resultant shear', 'V_res = √(V_x² + V_y²)',
      '√(' + n(gVM.V_x, 3) + '² + ' + n(gVM.V_y, 3) + '²)', n(gVM.V_res, 4), 'kip');
    sR.eq('Section modulus', 'S_rod = πd³/32', 'π×' + n(db_, 3) + '³/32', n(Srod, 5), 'in³');
    sR.eq('Rod area', 'A_b = πd²/4', 'π×' + n(db_, 3) + '²/4', n(Ab, 4), 'in²');
    sR.eq('Normal stress', 'σ = N_rod/A_b + M_res/S_rod',
      n(gVM.N_rod, 4) + '/' + n(Ab, 4) + ' + ' + n(gVM.M_res, 4) + '/' + n(Srod, 5), n(gVM.sigma, 2), 'ksi');
    sR.eq('Shear stress', 'τ = 4V_res/(3A_b)', '4×' + n(gVM.V_res, 4) + '/(3×' + n(Ab, 4) + ')',
      n(gVM.tau, 2), 'ksi', 'exact max for a solid circular section');
    sR.eq('DEMAND, von Mises', '√(σ² + 3τ²)',
      '√(' + n(gVM.sigma, 2) + '² + 3×' + n(gVM.tau, 2) + '²)', n(gVM.vm, 2), 'ksi');
    sR.eq('ALLOWABLE', 'φ·F_y = 0.90·F_y', '0.90 × ' + n(Fy_rod, 0), n(0.9 * Fy_rod, 2), 'ksi', rod.note);
    checks.push(stamp(chk('Connector', 'Rod combined action (von Mises)', 'AISC 360-22 / elastic',
      gVM.vm, 0.90 * Fy_rod, 'ksi', 'biaxial bending + shear + axial', sR.out()), gVM.label));

    var gRS = govFor('rodSh');
    var sS = S();
    sS.txt('Governing load combination: <b>' + gRS.label + '</b>.');
    sS.eq('Nominal shear stress', 'F_nv', inp.rodGrade + ', threads included', n(rod.Fnv, 0), 'ksi', 'AISC Table J3.2');
    sS.eq('ALLOWABLE per plane', 'φ·r_n = 0.75·F_nv·A_b',
      '0.75×' + n(rod.Fnv, 0) + '×' + n(Ab, 4), n(phi_rn_shear, 3), 'kip');
    sS.eq('DEMAND per plane', 'V_res', '', n(gRS.V_res, 4), 'kip');
    checks.push(stamp(chk('Connector', 'Rod shear, per plane', 'AISC 360-22 J3.6', gRS.V_res, phi_rn_shear, 'kip', '', sS.out()), gRS.label));

    var gRB = govFor('rodBr');
    var sB = S();
    sB.txt('Governing load combination: <b>' + gRB.label + '</b>.');
    sB.eq('Clear distance', 'l_c', '', n(lc, 3), 'in');
    sB.eq('Tearout', '1.2·l_c·t_w·F_u', '1.2×' + n(lc, 3) + '×' + n(tw, 3) + '×' + n(Fu_ch, 0),
      n(1.2 * lc * tw * Fu_ch, 3), 'kip');
    sB.eq('Bearing', '2.4·d_b·t_w·F_u', '2.4×' + n(db_, 3) + '×' + n(tw, 3) + '×' + n(Fu_ch, 0),
      n(2.4 * db_ * tw * Fu_ch, 3), 'kip');
    sB.eq('ALLOWABLE', 'φ·r_n = 0.75·min(above)', '', n(phi_rn_brg, 3), 'kip');
    sB.eq('DEMAND', 'V_res', '', n(gRB.V_res, 4), 'kip');
    checks.push(stamp(chk('Connector', 'Bearing/tearout on channel web', 'AISC 360-22 J3.10', gRB.V_res, phi_rn_brg, 'kip', '', sB.out()), gRB.label));

    var gMB = govFor('masBr');
    var sM = S();
    sM.txt('Governing load combination: <b>' + gMB.label + '</b>.');
    sM.txt('Masonry demand is the rod’s <b>total force on the grout</b>, not the halved per-plane steel shear.');
    sM.eq('DEMAND', 'V_mas = √((V_x·n_rows)² + P_rod²)',
      '√((' + n(gMB.V_x, 3) + '×' + n(rows, 0) + ')² + ' + n(gMB.P_rod, 4) + '²)', n(gMB.V_mas, 4), 'kip');
    sM.eq('Bearing area', 'A_br = d_b × t', n(db_, 3) + '×' + n(t, 3), n(Abr, 3), 'in²',
      'TMS 4.4.4, A₂ enhancement not taken');
    sM.eq('ALLOWABLE', 'φ·B_n = 0.60·(0.8·f′m)·A_br',
      '0.60×0.8×' + n(fm_ksi, 3) + '×' + n(Abr, 3), n(phiBn_brg, 3), 'kip', 'TMS 9.1.8, φ per 9.1.4.2');
    if (compositeMode)
      sM.txt('COMPOSITE branch only: V_x·n_rows is a <b>stand-in</b> for the grout-couple resultant ' +
             '(2·V_x·L_g/L_c) — 5.6% low at n_rows = 2, 89% high at n_rows = 4. Tolerated only because ' +
             'this branch is informational.');
    checks.push(stamp(chk('Masonry', 'Bearing on rod', 'TMS 402-22 9.1.8 / 9.1.4.2', gMB.V_mas, phiBn_brg, 'kip', '', sM.out()), gMB.label));

    var gMC = govFor('masCr');
    var sC = S();
    sC.txt('Governing load combination: <b>' + gMC.label + '</b>.');
    sC.eq('Nominal crushing', 'B_vnc = 1750·(f′m·A_b)^0.25',
      '1750×(' + n(inp.fm_psi, 0) + '×' + n(Ab, 4) + ')^0.25', n(phiBvnc / 0.5 * 1000, 0), 'lb', 'TMS Eq. 9-5');
    sC.eq('ALLOWABLE', 'φ·B_vnc, φ = 0.50', '', n(phiBvnc, 3), 'kip', 'TMS 9.1.4.1(d)');
    sC.txt('<b>No thickness term</b> — unlike 9.1.8 bearing this does not grow with wall thickness, which is why the minimum of the two must govern.');
    sC.eq('DEMAND', 'V_mas', '', n(gMC.V_mas, 4), 'kip');
    checks.push(stamp(chk('Masonry', 'Crushing at rod', 'TMS 402-22 Eq. 9-5', gMC.V_mas, phiBvnc, 'kip', '', sC.out()), gMC.label));

    if (isFinite(phiBvnb)) {
      var gBO = govFor('masBo');
      var sK = S();
      sK.txt('Governing load combination: <b>' + gBO.label + '</b>.');
      sK.txt('Evaluated in BOTH gravity directions; the minimum governs.');
      sK.eq('Upward', 'φ·B_vnb = 0.50·4·A_pv·√f′m', 'l_be = ' + n(num(inp.lbe_up_in, 0), 2) + '"',
        isFinite(phiBvnb_up) ? n(phiBvnb_up, 3) : 'n/a', 'kip');
      sK.eq('Downward (to soffit)', 'φ·B_vnb', 'l_be = ' + n(num(inp.lbe_dn_in, 0), 2) + '"',
        isFinite(phiBvnb_dn) ? n(phiBvnb_dn, 3) : 'n/a', 'kip');
      sK.eq('ALLOWABLE', 'φ·B_vnb = min(up, down)', '', n(phiBvnb, 3), 'kip');
      if (staggered) sK.txt('Staggering <b>reduces</b> breakout-cone overlap relative to an in-line pair at one station.');
      sK.eq('DEMAND', 'V_mas', '', n(gBO.V_mas, 4), 'kip');
      checks.push(stamp(chk('Masonry', 'Shear breakout at rod', 'TMS 402-22 Eq. 9-4', gBO.V_mas, phiBvnb, 'kip', '', sK.out()), gBO.label));
    }

    var gMT = govFor('masTn');
    var sT = S();
    sT.txt('Governing load combination: <b>' + gMT.label + '</b>.');
    sT.eq('Rod steel', 'B_ans = A_b·f_u,  f_u ≤ min(1.9f_y, 125)',
      n(Ab, 4) + '×' + n(fu_cap, 0), n(phiBans / 0.75, 3), 'kip', 'TMS Eq. 9-2');
    sT.eq('  with φ = 0.75', 'φ·B_ans', '', n(phiBans, 3), 'kip');
    sT.eq('Washer footprint', 'A_wsh', '', n(A_wsh, 2), 'in²');
    sT.eq('Face-shell bearing', 'φ·(0.8f′m)·A_wsh', '0.60×0.8×' + n(fm_ksi, 3) + '×' + n(A_wsh, 2),
      n(phiFaceShell, 3), 'kip');
    sT.eq('ALLOWABLE', 'B_an = min(above)', '', n(phiBan, 3), 'kip');
    sT.txt('<b>Eq. 9-1 (masonry breakout in tension) and Eq. 9-6 (anchor pryout) are NOT credited — ' +
           'because neither mechanism exists for a THRU-BOLTED rod, not because A_pt is hard to compute.</b> ' +
           'The rod is clamped through the full wall with a washer and channel on each face. Rod tension is ' +
           'reacted by the FAR washer and channel bearing the far face of the wall in compression; that limit ' +
           'state is precisely the face-shell bearing term already taken in the min() above. A tension ' +
           'breakout cone cannot form because there is no embedded head pulling a prism toward a free surface, ' +
           'and pryout would require rotating a grout prism out of a face that the far washer and channel hold ' +
           'in place. Independently, TMS 402-22 §6.3.2 and §6.3.3 require the projected areas A_pt and A_pv to ' +
           'be reduced by the area of open cells, open heads joints and overlapping projected areas: for a rod ' +
           'passing through hollow cells, unit webs and bed joints those deductions drive A_pt toward zero, so ' +
           'Eq. 9-1 would contribute essentially nothing even if the mechanism were credited.');
    sT.eq('DEMAND', 'N_rod', '', n(gMT.N_rod, 4), 'kip');
    checks.push(stamp(chk('Masonry', 'Rod tension (B_an)', 'TMS Eq. 9-2 + washer bearing', gMT.N_rod, phiBan, 'kip', '', sT.out()), gMT.label));

    var g98 = govFor('mas98');
    var s98 = S();
    s98.txt('Governing load combination: <b>' + g98.label + '</b>. N_rod and V_mas are taken from the ' +
            'SAME combination.');
    s98.eq('Shear allowable', 'B_vn = min(Eq. 9-4, 9-5, 9-7)', '', n(phiBvn, 3), 'kip');
    s98.eq('DEMAND / ALLOWABLE', '(b_au/B_an)^(5/3) + (b_vu/B_vn)^(5/3) ≤ 1',
      '(' + n(g98.N_rod, 3) + '/' + n(phiBan, 3) + ')^1.667 + (' + n(g98.V_mas, 3) + '/' + n(phiBvn, 3) + ')^1.667',
      n(g98.i98, 4), '', 'TMS Eq. 9-8');
    checks.push(stamp(chk('Masonry', 'Tension + shear interaction', 'TMS 402-22 Eq. 9-8', g98.i98, 1.0, '',
      'masonry side', s98.out()), g98.label));

    var gTS = govFor('rodTS');
    var sJ = S();
    sJ.txt('Governing load combination: <b>' + gTS.label + '</b>.');
    sJ.eq('Required shear stress', 'f_rv = V_res/A_b', n(gTS.V_res, 4) + '/' + n(Ab, 4), n(gTS.frv, 2), 'ksi');
    sJ.eq('Modified tensile', "F′_nt = 1.3F_nt − (F_nt/φF_nv)·f_rv ≤ F_nt", '', n(gTS.Fnt_p, 2), 'ksi', 'AISC Eq. J3-3a');
    sJ.eq('ALLOWABLE', 'φ·F′_nt·A_b', '0.75×' + n(gTS.Fnt_p, 2) + '×' + n(Ab, 4),
      n(gTS.capTS, 3), 'kip');
    sJ.eq('DEMAND', 'N_rod', '', n(gTS.N_rod, 4), 'kip');
    checks.push(stamp(chk('Connector', 'Rod tension + shear', 'AISC 360-22 J3.7', gTS.N_rod,
      gTS.capTS, 'kip', 'steel side, distinct from Eq. 9-8', sJ.out()), gTS.label));

    if (compositeMode) {
      var gGr = govFor('grout');
      var sG = S();
      sG.txt('Governing load combination: <b>' + gGr.label + '</b>.');
      sG.eq('DEMAND, peak grout pressure', 'f_g = k / d_b', n(gGr.k, 4) + '/' + n(db_, 3), n(gGr.f_g, 3), 'ksi');
      sG.eq('ALLOWABLE', 'φ·(0.8·f′m)', '0.60×0.8×' + n(fm_ksi, 3), n(f_g_allow, 3), 'ksi');
      sG.txt('k is independent of d_b, so f_g scales as 1/d_b: <b>rod diameter and spacing relieve grout bearing; rod grade does not.</b>');
      checks.push(stamp(info('Composite (informational)', 'Grout bearing from couple', 'TMS 402-22 9.1.8',
        gGr.f_g, f_g_allow, 'ksi', 'k = ' + n(gGr.k, 3) + ' kip/in', sG.out()), gGr.label));
    }

    // ── bond beam ────────────────────────────────────────────────────────────
    var gBB = govFor('bb');
    var sBB = S();
    sBB.txt('Governing load combination: <b>' + gBB.label + '</b>.');
    sBB.eq('Clear span between rod supports', 'L_bb = p',
      staggered ? ('staggered — supports every ' + n(pitch, 1) + '&quot;') : ('in-line — supports every ' + n(s, 0) + '&quot;'),
      n(bbSpan, 1), 'in');
    if (staggered) sBB.txt('Staggering <b>quarters</b> this moment relative to an in-line layout at the same row spacing.');
    sBB.eq('Design moment', 'M_bb = w_u·L_bb²/10',
      n(gBB.wu / 12, 5) + '×' + n(bbSpan, 1) + '²/10', n(gBB.M_bb, 3), 'kip-in', 'continuous-span envelope');
    sBB.eq('Effective depth', 'd_bb ≈ t − 2', n(t, 3) + ' − 2', n(d_bb, 2), 'in',
      'wall-thickness stand-in — conservative only because the plan mandates the multi-course reinforced band');
    sBB.eq('DEMAND, steel area', 'A_s,req = M_bb/(φ·f_y·0.9d)',
      n(gBB.M_bb, 3) + '/(0.9×60×0.9×' + n(d_bb, 2) + ')', n(gBB.As_req, 4), 'in²', 'j·d = 0.9d simplification');
    sBB.eq('ALLOWABLE, provided', 'A_s,prov', '', n(As_prov, 3), 'in²');
    sBB.txt('NOT CHECKED: TMS 402-22 9.3.3.2.2.1 (M_n ≥ 1.3·M_cr) and the 9.3.3.2.2.2 exemption for ' +
            'reinforcement at least one-third in excess of that required. The 0.40 in² default is expected ' +
            'to satisfy the exemption at these A_s,req values — confirm it if A_s,prov is reduced.');
    checks.push(stamp(chk('Bond beam', 'Flexure between rod columns', 'TMS 402-22 9.3', gBB.As_req, As_prov, 'in²', '', sBB.out()), gBB.label));

    // ── jamb ─────────────────────────────────────────────────────────────────
    var gJ = govFor('jamb');
    var sJb = S();
    sJb.txt('Governing load combination: <b>' + gJ.label + '</b>.');
    sJb.eq('End reaction, pair', 'R = w_u·L/2', n(gJ.wu / 12, 5) + '×' + n(L_in, 0) + '/2', n(gJ.R_total, 2), 'kip');
    sJb.eq('Bolts each end', 'n_j', '', n(nJ, 0), '');
    sJb.eq('Bolt pitch', 'p_j', 'along the pier', n(jPitch, 1), 'in');
    sJb.eq('First bolt from opening face', 'x_1', '', n(jEdge, 1), 'in');
    sJb.eq('Group centroid', 'x̄ = Σx_i / n_j',
      n(jSum, 1) + '/' + n(nJ, 0), n(jXbar, 2), 'in', 'measured from the opening face');
    sJb.eq('Group eccentricity', 'e_group = x̄ − 0', 'R acts in the web plane at x = 0', n(jXbar, 2), 'in');
    sJb.eq('Polar term', 'Σ(x_i − x̄)²', '', n(jSumD2, 1), 'in²');
    sJb.eq('Extreme bolt lever', '|x_max − x̄|', '', n(jDmax, 2), 'in');
    sJb.eq('Direct component', 'f_d = R / n_j', n(gJ.R_total, 2) + '/' + n(nJ, 0), n(gJ.Vj_avg, 3), 'kip',
      'the simple average — NOT the design value');
    sJb.eq('Moment component', 'f_m = R·e_group·|x_max − x̄| / Σ(x_i − x̄)²',
      n(gJ.R_total, 2) + '×' + n(jXbar, 2) + '×' + n(jDmax, 2) + '/' + n(jSumD2, 1),
      n(gJ.Vj - gJ.Vj_avg, 3), 'kip');
    sJb.eq('DEMAND, extreme bolt', 'V_j = f_d + f_m',
      n(gJ.Vj_avg, 3) + ' + ' + n(gJ.Vj - gJ.Vj_avg, 3), n(gJ.Vj, 3), 'kip',
      '= ' + n(jambFactor, 3) + '·R — eccentricity amplifies R/n_j by ' + n(jambFactor * nJ, 2) + '×');
    sJb.eq('Steel, double shear', '2·φr_n', '2×' + n(phi_rn_shear, 3), n(2 * phi_rn_shear, 3), 'kip');
    sJb.eq('Masonry', 'B_vn = min(9-4, 9-5, 9-7)', '', n(phiBvn, 3), 'kip');
    sJb.eq('ALLOWABLE', 'min(steel, masonry)', '', n(capJ, 3), 'kip');
    sJb.txt('<b>Elastic vector method.</b> Bolts on a line into the pier at x_i = x_1 + (i−1)·p_j; the ' +
            'reaction is delivered in the web plane at the opening face, so the group carries R plus ' +
            'R·e_group. Adding bolts lengthens the line and RAISES e_group, so the extreme-bolt force ' +
            'falls far more slowly than R/n_j. Reaction unbalance between the two ends (plan item 32) ' +
            'is still not modelled.');
    checks.push(stamp(chk('Jamb', 'Bolt group, vertical reaction (elastic vector)', 'TMS 9.1.6 / AISC J3',
      gJ.Vj, capJ, 'kip', 'e_group = ' + n(jXbar, 1) + '"', sJb.out()), gJ.label));

    // ── deflection — SERVICE LEVEL, outside the factored envelope ────────────
    var ws = loads.wServiceGrav / 12.0;
    var dG = 5 * ws * Math.pow(L_in, 4) / (384 * E_STEEL * 2 * sec.Ix);
    var sDG = S();
    sDG.txt('Service-level check — <b>not</b> part of the LRFD combination envelope.');
    sDG.eq('Service load, pair', 'w_serv = D + L', 'unfactored', n(loads.wServiceGrav * 1000, 1), 'plf');
    sDG.eq('Pair stiffness', '2·I_x', '2×' + n(sec.Ix, 1), n(2 * sec.Ix, 1), 'in⁴');
    sDG.eq('DEMAND', 'δ = 5wL⁴/(384·E·2I_x)',
      '5×' + n(ws, 5) + '×' + n(L_in, 0) + '⁴/(384×29000×' + n(2 * sec.Ix, 1) + ')', n(dG, 4), 'in');
    sDG.eq('ALLOWABLE', 'L/600', n(L_in, 0) + '/600', n(L_in / 600, 4), 'in', 'TMS 402-22 §4.6, mandated');
    checks.push(stampService(chk('Deflection', 'Gravity, service D+L', 'TMS 402-22 4.6', dG, L_in / 600.0, 'in', '', sDG.out()),
      'service D+L'));

    var dW, sDW = S();
    sDW.txt('Service-level check — <b>not</b> part of the LRFD combination envelope.');
    sDW.eq('Service wind factor', '0.42·W', 'IBC Table 1604.3 note (f)', 0.42, '');
    if (compositeMode && comp.w_slip > 0 && comp.w_slip < loads.wW) {
      dW = 5 * (0.42 * comp.w_slip / 12.0) * Math.pow(L_in, 4) / (384 * E_STEEL * I_nc) +
           5 * (0.42 * (loads.wW - comp.w_slip) / 12.0) * Math.pow(L_in, 4) / (384 * E_STEEL * I_comp);
      sDW.txt('STAGED: pure I_comp may never be substituted while w_slip &gt; 0.');
      sDW.eq('Transition load', 'w_slip', '', n(comp.w_slip, 4), 'klf');
    } else {
      var Iuse = (compositeMode && comp.engaged) ? I_comp : I_nc;
      dW = 5 * (0.42 * loads.wW / 12.0) * Math.pow(L_in, 4) / (384 * E_STEEL * Iuse);
      sDW.eq('Stiffness used', compositeMode && comp.engaged ? 'I_comp' : '2·I_y (non-composite)', '', n(Iuse, 1), 'in⁴');
    }
    sDW.eq('DEMAND', 'δ_w = 5(0.42w_W)L⁴/(384·E·I)', '', n(dW, 4), 'in');
    sDW.eq('ALLOWABLE', 'L/240', n(L_in, 0) + '/240', n(L_in / 240, 4), 'in',
      'IBC Table 1604.3, exterior wall with brittle finish — project criteria may be stricter');
    checks.push(stampService(chk('Deflection', 'Wind, 0.42W', 'IBC Table 1604.3 note (f)', dW, L_in / 240.0, 'in', '', sDW.out()),
      'service 0.42W'));

    // C4 — composite mode carries NO verdict. Every row is informational and the
    // top-level `pass` is null, so no caller can read a PASS out of a branch
    // whose connection this calculator does not design.
    if (compositeMode) {
      for (i = 0; i < checks.length; i++) { checks[i].informational = true; checks[i].pass = null; }
    }

    var real = checks.filter(function (c) { return !c.informational; });
    var pool = real.length ? real : checks;
    var gov = pool.reduce(function (a, b) { return (b.dcr > a.dcr) ? b : a; }, pool[0]);

    return {
      ok: true,
      pass: compositeMode ? null : real.every(function (c) { return c.pass; }),
      governing: gov, checks: checks,
      warnings: warn,
      mode: compositeMode ? 'COMPOSITE (informational only — cannot pass)' : 'NON-COMPOSITE (default)',
      compositeMode: compositeMode,
      section: sec, geo: { t: t, tfs: tfs, Lg: Lg, H_above: inp.H_above, L_ft: inp.L_ft, t_nom: inp.t_nom },
      loads: loads,
      combo: { label: RC.label, wu: RC.wu, ww: RC.ww, M: RC.Mpair, V: RC.Vpair, dcr: rcDcr },
      comboRows: comboRows,
      layout: { s: s, rows: rows, staggered: staggered, pitch: pitch, trib_rod: trib_rod,
                offset: offset, g: g, d_b: db_, cell: CELL },
      jamb: { n: nJ, pitch: jPitch, edge: jEdge, x: jx, xbar: jXbar, sumD2: jSumD2,
              dmax: jDmax, factor: jambFactor, R: RC.R_total, Vj_avg: RC.Vj_avg, Vj: RC.Vj,
              capacity: capJ },
      loadAccum: LA.out(), layoutSteps: LAY.out(),
      demands: { Mux: RC.Mux, Vux: RC.Vux, M_w_total: RC.M_w_total, V_w_total: RC.V_w_total,
                 My_ch: RC.My_ch, N_ch: compositeMode ? RC.N_ch : 0, h1: RC.h1 },
      composite: comp,
      connector: { P_rod: RC.P_rod, V_y: RC.V_y, V_x: RC.V_x, V_res: RC.V_res, V_mas: RC.V_mas,
                   T_w: RC.T_w, dF: RC.dF, N_rod: RC.N_rod, e_sc: e_sc,
                   M_grav: RC.M_grav, M_wind: RC.M_wind, M_res: RC.M_res,
                   k: RC.k, Lc: compositeMode ? Lc : 0, sstar: compositeMode ? sstar : 0,
                   Lg: Lg, Ab: Ab, Srod: Srod,
                   sigma: RC.sigma, tau: RC.tau, vm: RC.vm, phiFy_rod: 0.90 * Fy_rod,
                   phi_rn_shear: phi_rn_shear, phi_rn_brg: phi_rn_brg, phiBn_brg: phiBn_brg,
                   phiBvnc: phiBvnc, phiBvnb: phiBvnb, phiBvn: phiBvn, phiBan: phiBan,
                   f_g: RC.f_g },
      strength: cs, Lb: Lb, Cb: Cb,
      deflection: { gravity: dG, wind: dW, I_comp: I_comp, I_nc: I_nc, ratio: I_comp / I_nc }
    };
  }

  function optimise(input) {
    var base = {}, k;
    for (k in input) if (input.hasOwnProperty(k)) base[k] = input[k];
    base.compositeMode = false;
    var spacings = [48, 40, 32, 24, 16, 8];
    // C2 — jamb_n is now sized against the ECCENTRIC bolt-group model. Adding
    // bolts lengthens the line and raises e_group = x̄, so the extreme-bolt force
    // falls only as ≈ 1/n + 3/(n+1) for the default 4"/8" layout, not as 1/n.
    // The search is therefore CAPPED at 12 bolts; if nothing inside the cap
    // passes, the best candidate found is reported on results.best rather than
    // extending the search. `results` itself stays PASSING-ONLY so the UI's
    // "passing combinations" table cannot list a failing row.
    var jambs = [base.jamb_n || 4, 5, 6, 8, 10, 12]
      .filter(function (x, i, a) { return a.indexOf(x) === i; })
      .sort(function (a, b) { return a - b; });
    var results = [], secs = allSections(), best = null;
    for (var i = 0; i < secs.length; i++) {
      var found = null;
      for (var j = 0; j < spacings.length && !found; j++) {
        for (var m = 0; m < jambs.length && !found; m++) {
          var trial = {}, q;
          for (q in base) if (base.hasOwnProperty(q)) trial[q] = base[q];
          trial.section = secs[i].label; trial.s_in = spacings[j]; trial.jamb_n = jambs[m];
          trial.g_in = Math.min(base.g_in || 12, Math.max(3, secs[i].d - 6));
          var r = run(trial);
          if (!r.ok || !r.governing) continue;
          var cand = { section: secs[i].label, W: secs[i].W, s: spacings[j], jamb_n: jambs[m],
                       g: trial.g_in, pitch: r.layout.pitch, dcr: r.governing.dcr,
                       governing: r.governing.name };
          if (!best || cand.dcr < best.dcr) best = cand;
          if (r.pass === true) found = cand;
        }
      }
      if (found) results.push(found);
    }
    results.sort(function (a, b) { return a.W - b.W || a.dcr - b.dcr; });
    results.best = best;   // non-index property — does not affect results.length
    return results;
  }

  root.AREChannelLintel = { run: run, optimise: optimise, section: section,
                            allSections: allSections, CMU: CMU, RODS: RODS, COMBOS: COMBOS, FIELDS: FIELDS };
})(typeof module !== 'undefined' && module.exports ? global : window);

if (typeof module !== 'undefined' && module.exports) module.exports = global.AREChannelLintel;
