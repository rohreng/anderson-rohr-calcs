/* =============================================================================
   RD engine — rectangular diaphragm force distribution to shearwall lines.
   DOM-free.  window.RD.analyze(inputs) -> { wx, wy, sx, sy } | { fatal: [] }.

   Shared by rectangular_diaphragm_calculator.html (the page's calcDir is this
   function) and engines/lateral-handoff.js, so the stacked shearwall import
   recomputes reactions from a saved diaphragm snapshot with the same code the
   page used to print them.

   Model: the diaphragm is a beam of span L_along carrying the uniform load
   w = V / L_along, plus (roof wind only) partial UDLs from stepped parapets.
     1 line : R = V (no moment equilibrium; M = w·L²/8 reference only).
     2 lines: statics about (0,0), overhangs included.  A line past the
              resultant can carry a NEGATIVE reaction — nothing is clamped.
     3+ lines: simple spans between adjacent lines; each overhang is a
              cantilever on its end span (v2 — v1 sent the whole overhang
              load to the end line, which broke ΣM₀).  Every load segment in
              span [a, b] (or its overhang) splits by lever arm:
              R_a += F (b − c)/s,  R_b += F (c − a)/s.
   Global ΣF = 0 and ΣM₀ = 0 hold for every 2+ line layout (see .moment).
   Layouts with ≤ 2 lines, or 3+ lines with the end lines at exactly 0 and
   L_along, and no steps, run the v1 arithmetic verbatim (bitwise-identical).

   Units: V in kips, lengths in ft, reactions in kips, unit shears in kip/ft,
   moments in kip·ft.  Parapet pressure in psf; step forces returned in kips.

   Stepped parapets (ASCE 7-16 §27.3.4, plan 2026-09-23 R2/R12/R18/R20):
     o.parapet = { qp_psf, GCpn_ww: 1.5, GCpn_lw: 1.0, h_typ_ft, h_max_ft,
                   commonBase: true, roofFlat: true|null, asdFactor: 1,
                   steps: [{ label, face: 'N'|'S'|'E'|'W', start_ft, width_ft,
                             h_ft, active? }] }
     N/S-face steps load Wind-Y (start_ft from the W corner, face length B);
     E/W-face steps load Wind-X (start_ft from the S corner, face length D).
     Δh = max(0, h − h_typ);  F = GC · q_p · Δh · width / 1000  (kips).
     Two physical cases per stepped direction: Wind-Y fromN / fromS, Wind-X
     fromW / fromE.  A step on the windward face gets GCpn_ww (1.5), on the
     leeward face |GCpn_lw| (1.0); both act in the wind sense of that case.
     Load basis: q_p is STRENGTH level (from the MWFRS).  asdFactor (default
     1) multiplies every step force — an ASD-entered page passes 0.6 to DISPLAY
     ASD step forces beside its ASD baseline; any export/handoff converts the
     baseline to strength and passes asdFactor 1 (never ÷0.6 a step).
     Seismic runs never get steps.
   ========================================================================== */
(function (root) {
  'use strict';

  var ENGINE = { name: 'rect-diaphragm', version: 2 };
  var TOL = 1e-9;

  function near(a, b) { return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b)); }
  function fin(v) { return typeof v === 'number' ? isFinite(v) : (v !== null && v !== '' && v !== undefined && isFinite(+v)); }

  // ── load bookkeeping ─────────────────────────────────────────────────────
  // loads: [{item, kind:'udl'|'step', p, q, qk (k/ft), F (k), c (centroid)}]
  function buildLoads(V, L_along, steps) {
    var loads = [{ item: 'Diaphragm UDL (w·L)', kind: 'udl', p: 0, q: L_along, qk: V / L_along, F: V, c: L_along / 2 }];
    (steps || []).forEach(function (s, i) {
      var F = +s.F || 0, p = +s.start || 0, wd = +s.width || 0;
      if (!(wd > 0) || F === 0) return;
      loads.push({ item: s.label || ('Step ' + (i + 1)), kind: 'step', index: i, p: p, q: p + wd, qk: F / wd, F: F, c: p + wd / 2 });
    });
    return loads;
  }

  // Moment-about-(0,0) table.  Loads and reactions are both positive in the
  // load sense (a resisting reaction is +).  check = Σreactions − Σloads.
  function momentTable(loads, sws, reactions) {
    var rows = [], sumF = 0, sumM = 0, sumR = 0, sumRx = 0;
    loads.forEach(function (l) {
      rows.push({ item: l.item, kind: 'load', F: l.F, x: l.c, Fx: l.F * l.c });
      sumF += l.F; sumM += l.F * l.c;
    });
    sws.forEach(function (sw, i) {
      var R = reactions[i];
      rows.push({ item: sw.label, kind: 'reaction', F: R, x: sw.loc, Fx: R * sw.loc });
      sumR += R; sumRx += R * sw.loc;
    });
    var checkF = sumR - sumF, checkM = sumRx - sumM;
    var ok = Math.abs(checkF) <= 1e-9 * Math.max(1, Math.abs(sumF)) && Math.abs(checkM) <= 1e-9 * Math.max(1, Math.abs(sumM));
    var t = { about: 0, rows: rows, sumF: sumF, sumM: sumM, sumR: sumR, sumRx: sumRx, checkF: checkF, checkM: checkM, ok: ok };
    if (sws.length === 1) t.note = 'single wall line — moment equilibrium not available (R = V)';
    return t;
  }

  // Split every load into segments per span region (span 0 takes the left
  // overhang, the last span the right) and apply the lever-arm split.
  function spanSplit(loads, sws) {
    var n = sws.length, spans = [], R = [];
    for (var i = 0; i < n; i++) R.push(0);
    for (var k = 0; k < n - 1; k++) spans.push({ k: k, a: sws[k].loc, b: sws[k + 1].loc, s: sws[k + 1].loc - sws[k].loc, Ra: 0, Rb: 0, segments: [] });
    // regions: (-inf, l0] -> span 0 (left overhang), [l_j, l_j+1] -> span j,
    // [l_n-1, +inf) -> last span (right overhang)
    var regions = [{ span: 0, lo: -Infinity, hi: sws[0].loc, overhang: true }];
    for (var j = 0; j < n - 1; j++) regions.push({ span: j, lo: sws[j].loc, hi: sws[j + 1].loc, overhang: false });
    regions.push({ span: n - 2, lo: sws[n - 1].loc, hi: Infinity, overhang: true });
    loads.forEach(function (l) {
      l.segments = [];
      for (var r = 0; r < regions.length; r++) {
        var rg = regions[r], k2 = rg.span, sp = spans[k2];
        var p = Math.max(l.p, rg.lo), q = Math.min(l.q, rg.hi);
        if (!(q > p)) continue;
        var F = l.qk * (q - p), c = (p + q) / 2;
        var ra = F * (sp.b - c) / sp.s, rb = F * (c - sp.a) / sp.s;
        var seg = { span: k2, item: l.item, kind: l.kind, p: p, q: q, F: F, c: c, Ra: ra, Rb: rb, overhang: rg.overhang };
        sp.segments.push(seg); l.segments.push(seg);
        sp.Ra += ra; sp.Rb += rb; R[k2] += ra; R[k2 + 1] += rb;
      }
    });
    return { reactions: R, spans: spans };
  }

  // Global shear/moment from reactions + partial UDLs.  Valid for 2 lines and
  // for the 3+ line simple-span model (every span is self-equilibrated, so the
  // global diagram equals the per-span diagrams, cantilevers included).
  function diagram(loads, sws, reactions) {
    function loadLeft(x) {
      var s = 0;
      loads.forEach(function (l) { var len = Math.min(x, l.q) - l.p; if (len > 0) s += l.qk * len; });
      return s;
    }
    function Vat(x, incl) {
      var r = 0;
      sws.forEach(function (sw, i) { if (sw.loc < x || (incl && sw.loc === x)) r += reactions[i]; });
      return r - loadLeft(x);
    }
    function Mat(x) {
      var m = 0;
      sws.forEach(function (sw, i) { if (sw.loc < x) m += reactions[i] * (x - sw.loc); });
      loads.forEach(function (l) {
        var e = Math.min(x, l.q), len = e - l.p;
        if (len > 0) m -= l.qk * len * (x - (l.p + e) / 2);
      });
      return m;
    }
    var xs = [];
    function addX(v) { for (var i = 0; i < xs.length; i++) if (xs[i] === v) return; xs.push(v); }
    loads.forEach(function (l) { addX(l.p); addX(l.q); });
    sws.forEach(function (sw) { addX(sw.loc); });
    xs.sort(function (a, b) { return a - b; });

    var pts = [], Vmax = 0, Mmax = 0, xM = xs[0], Mpos = 0, Mneg = 0, vZeros = [];
    function takeM(x) {
      var m = Mat(x);
      if (Math.abs(m) > Mmax) { Mmax = Math.abs(m); xM = x; }
      if (m > Mpos) Mpos = m;
      if (m < Mneg) Mneg = m;
      return m;
    }
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i], vl = Vat(x, false), vr = Vat(x, true);
      Vmax = Math.max(Vmax, Math.abs(vl), Math.abs(vr));
      pts.push({ x: x, V_left: vl, V_right: vr, M: takeM(x) });
      if (i < xs.length - 1) {
        var x2 = xs[i + 1], v1 = vr, v2 = Vat(x2, false);
        if ((v1 > 0 && v2 < 0) || (v1 < 0 && v2 > 0)) {
          var xz = x + v1 / (v1 - v2) * (x2 - x);
          vZeros.push(xz);
          pts.push({ x: xz, V_left: 0, V_right: 0, M: takeM(xz), vZero: true });
        }
      }
    }
    pts.sort(function (a, b) { return a.x - b.x; });
    return { points: pts, Vmax: Vmax, Mmax: Mmax, x_Mmax: xM, M_pos: Mpos, M_neg: Mneg, vZeros: vZeros };
  }

  // v1 arithmetic, verbatim (bitwise-identical results).  Used when there are
  // no steps and the layout has no 3+ line overhang.
  function legacy(V, L_along, B_perp, sws) {
    var w = V / L_along;
    var reactions;
    if (sws.length === 1) {
      reactions = [V];
    } else if (sws.length === 2) {
      var a = sws[0].loc, b2 = sws[1].loc;
      var span = b2 - a;
      var R2 = w * L_along * (L_along / 2 - a) / span;
      var R1 = V - R2;
      reactions = [R1, R2];
    } else {
      reactions = [];
      for (var i = 0; i < sws.length; i++) {
        var locPrev = i === 0 ? 0 : ((sws[i].loc + sws[i - 1].loc) / 2);
        var locNext = i === sws.length - 1 ? L_along : ((sws[i].loc + sws[i + 1].loc) / 2);
        reactions.push(w * (locNext - locPrev));
      }
    }
    var M_design, M_note, Vmax_beam;
    if (sws.length === 1) {
      M_design = V * L_along / 8;
      M_note = 'single wall line — M shown as w·L²/8 reference value; verify load path';
      Vmax_beam = V;
    } else if (sws.length === 2) {
      var aL = sws[0].loc, bL = sws[1].loc;
      var spanL = bL - aL;
      var R_l = reactions[0], R_r = reactions[1];
      var x0 = R_l / w - aL;
      x0 = Math.max(0, Math.min(spanL, x0));
      var M_pos = R_l * x0 - w * (aL + x0) * (aL + x0) / 2;
      var M_negL = w * aL * aL / 2;
      var M_negR = w * (L_along - bL) * (L_along - bL) / 2;
      M_design = Math.max(Math.abs(M_pos), M_negL, M_negR);
      M_note = (aL <= 0.001 && Math.abs(bL - L_along) <= 0.001)
        ? 'M = w·L²/8 (supports at diaphragm ends)'
        : 'asymmetric wall locations — M from beam analysis incl. overhang moments';
      Vmax_beam = Math.max(
        Math.abs(w * aL),
        Math.abs(R_l - w * aL),
        Math.abs(R_r - w * (L_along - bL)),
        Math.abs(w * (L_along - bL))
      );
    } else {
      var aM = sws[0].loc, bM = sws[sws.length - 1].loc;
      M_design = Math.max(w * aM * aM / 2, w * (L_along - bM) * (L_along - bM) / 2);
      Vmax_beam = 0;
      for (var k = 0; k < sws.length; k++) {
        var pm = k === 0 ? 0 : ((sws[k].loc + sws[k - 1].loc) / 2);
        var nm = k === sws.length - 1 ? L_along : ((sws[k].loc + sws[k + 1].loc) / 2);
        Vmax_beam = Math.max(Vmax_beam, w * (sws[k].loc - pm), w * (nm - sws[k].loc));
        if (k > 0) {
          var sp = sws[k].loc - sws[k - 1].loc;
          M_design = Math.max(M_design, w * sp * sp / 8);
        }
      }
      M_note = 'multi-line (tributary) — M = max of w·s²/8 per span + overhangs (simplified; verify with continuous-beam analysis if critical)';
    }
    return { w: w, reactions: reactions, M_design: M_design, M_note: M_note, Vmax_beam: Vmax_beam };
  }

  // dir label, V: baseline (UDL) force (kips), L_along: span along the wind
  // (ft), B_perp: chord depth (ft), swRows: [{label, len, loc}],
  // opts.steps: [{label, start, width, F (kips)}] — partial UDLs in the same
  // sense as V.  Returns the v1 keys (V = TOTAL incl. steps) plus
  // V_udl, V_steps, steps[], moment{}, diagram{}, spans[] (3+ lines), model.
  function calcDir(V, L_along, B_perp, swRows, dirLabel, opts) {
    opts = opts || {};
    var sws = swRows.map(function (r) { return { label: r.label, len: r.len, loc: r.loc }; });
    sws.sort(function (a, b) { return a.loc - b.loc; });
    var n = sws.length;
    var loads = buildLoads(V, L_along, opts.steps);
    var stepLoads = loads.filter(function (l) { return l.kind === 'step'; });
    var V_steps = stepLoads.reduce(function (s, l) { return s + l.F; }, 0);
    var Vtot = V + V_steps;
    var overhang3 = n >= 3 && (sws[0].loc !== 0 || sws[n - 1].loc !== L_along);

    var reactions, M_design, M_note, Vmax_beam, w, spans = null, dg = null, model;
    if (!stepLoads.length && !overhang3) {
      var lg = legacy(V, L_along, B_perp, sws);
      w = lg.w; reactions = lg.reactions; M_design = lg.M_design; M_note = lg.M_note; Vmax_beam = lg.Vmax_beam;
      model = n >= 3 ? 'simple-spans' : (n === 2 ? 'two-line-statics' : 'single-line');
      if (n >= 3) spans = spanSplit(loads, sws).spans;
      if (n >= 2) dg = diagram(loads, sws, reactions);
    } else {
      w = V / L_along;
      if (n === 1) {
        reactions = [Vtot];
        M_design = Vtot * L_along / 8;
        M_note = 'single wall line — M shown as w·L²/8 reference value; verify load path';
        Vmax_beam = Vtot;
        model = 'single-line';
      } else if (n === 2) {
        var a = sws[0].loc, b = sws[1].loc, sumM0 = 0;
        loads.forEach(function (l) { sumM0 += l.F * l.c; });
        var Rb = (sumM0 - Vtot * a) / (b - a);
        reactions = [Vtot - Rb, Rb];
        loads.forEach(function (l) {   // single span: record segments for display
          var F = l.F, c = l.c;
          l.segments = [{ span: 0, item: l.item, kind: l.kind, p: l.p, q: l.q, F: F, c: c, Ra: F * (b - c) / (b - a), Rb: F * (c - a) / (b - a), overhang: (c < a || c > b) }];
        });
        dg = diagram(loads, sws, reactions);
        M_design = dg.Mmax; Vmax_beam = dg.Vmax;
        M_note = 'two lines, statics about (0,0) incl. parapet steps — M = max |M| at shear zeros and supports';
        model = 'two-line-statics';
      } else {
        var sp = spanSplit(loads, sws);
        reactions = sp.reactions; spans = sp.spans;
        dg = diagram(loads, sws, reactions);
        M_design = dg.Mmax; Vmax_beam = dg.Vmax;
        M_note = 'multi-line — simple spans between adjacent lines, overhangs cantilevered on the end spans (verify with continuous-beam analysis if critical)';
        model = 'simple-spans';
      }
    }

    var unitShears = sws.map(function (sw, i) { return reactions[i] / sw.len; });
    var chord_T = M_design / B_perp;
    var v_dia = Vmax_beam / B_perp;

    var out = {
      label: dirLabel,
      V: Vtot,
      L_along: L_along,
      B_perp: B_perp,
      w: w,
      sws: sws,
      reactions: reactions,
      unitShears: unitShears,
      M_max: M_design,
      M_note: M_note,
      Vmax_beam: Vmax_beam,
      chord_T: chord_T,
      v_dia: v_dia,
      V_udl: V,
      V_steps: V_steps,
      steps: stepLoads.map(function (l) {
        return { label: l.item, index: l.index, start: l.p, end: l.q, width: l.q - l.p, F: l.F, w_klf: l.qk, x: l.c, segments: l.segments || [] };
      }),
      moment: momentTable(loads, sws, reactions),
      diagram: dg,
      model: model
    };
    if (spans) out.spans = spans;
    return out;
  }

  // ── parapet steps ────────────────────────────────────────────────────────
  var FACE_DIR = { N: 'Y', S: 'Y', E: 'X', W: 'X' };
  var FACE_ORIGIN = { N: 'W corner', S: 'W corner', E: 'S corner', W: 'S corner' };

  // parapet (see header), B = EW building dimension, D = NS dimension (ft).
  // -> { qp_psf, GCpn_ww, GCpn_lw, h_typ_ft, h_max_ft, asdFactor,
  //      steps:[{index, label, face, dir, start_ft, width_ft, end_ft, h_ft,
  //              dh_ft, x_ft, faceLen_ft, F_ww_k, F_lw_k, active}],
  //      X:[active steps], Y:[active steps], anyActive, fatal:[msgs] }
  // active = not switched off (active !== false), valid face, width > 0,
  // Δh > 0.  Fatal checks apply only when at least one step is active.
  function stepForces(parapet, B, D) {
    parapet = parapet || {};
    var qp = +parapet.qp_psf;
    var GCww = fin(parapet.GCpn_ww) ? Math.abs(+parapet.GCpn_ww) : 1.5;
    var GClw = fin(parapet.GCpn_lw) ? Math.abs(+parapet.GCpn_lw) : 1.0;
    var hMax = fin(parapet.h_max_ft) ? +parapet.h_max_ft : NaN;
    var hTyp = fin(parapet.h_typ_ft) ? +parapet.h_typ_ft : hMax;   // blank typical = h_p,max
    var k = fin(parapet.asdFactor) ? +parapet.asdFactor : 1;
    var qpOk = qp > 0 && isFinite(qp);
    var fatal = [], steps = [], X = [], Y = [];

    (parapet.steps || []).forEach(function (s, i) {
      var face = String(s.face == null ? '' : s.face).trim().toUpperCase();
      var dir = FACE_DIR[face] || null;
      var start = +s.start_ft || 0, width = +s.width_ft || 0, h = +s.h_ft || 0;
      var dh = isFinite(hTyp) ? Math.max(0, h - hTyp) : Math.max(0, h);
      var faceLen = dir === 'Y' ? +B : (dir === 'X' ? +D : NaN);
      var F1 = qpOk ? GCww * qp * dh * width * k / 1000 : 0;
      var F2 = qpOk ? GClw * qp * dh * width * k / 1000 : 0;
      var st = {
        index: i, label: (s.label != null && String(s.label).trim()) ? String(s.label) : ('Step ' + (i + 1)),
        face: face, dir: dir, origin: FACE_ORIGIN[face] || null,
        start_ft: start, width_ft: width, end_ft: start + width, h_ft: h, dh_ft: dh, x_ft: start + width / 2,
        faceLen_ft: faceLen, F_ww_k: F1, F_lw_k: F2,
        active: s.active !== false && width > 0 && dh > 0
      };
      steps.push(st);
      if (s.active === false) return;
      var nm = st.label + ' (' + (face || '?') + ' face)';
      if (!dir && width > 0 && dh > 0) { fatal.push(nm + ': face must be N, S, E or W.'); st.active = false; return; }
      if (fin(hMax) && h > hMax + TOL) fatal.push(nm + ': step height ' + h + ' ft exceeds the maximum parapet height h_p,max = ' + hMax + ' ft that q_p was evaluated at — re-run the MWFRS with a higher maximum parapet.');
      if (!st.active) return;
      if (start < -TOL || start + width > faceLen + TOL * Math.max(1, faceLen)) {
        fatal.push(nm + ': runs past the face — ' + start + ' to ' + (start + width) + ' ft from the ' + st.origin + ', face length ' + faceLen + ' ft.');
      }
      (dir === 'X' ? X : Y).push(st);
    });

    var anyActive = X.length + Y.length > 0;
    if (anyActive) {
      if (!qpOk) fatal.push('Stepped parapets: q_p (psf) must be > 0.');
      if (!(hMax > 0)) fatal.push('Stepped parapets: maximum parapet height h_p,max is required.');
      else if (hTyp > hMax + TOL) fatal.push('Stepped parapets: typical parapet height ' + hTyp + ' ft exceeds h_p,max = ' + hMax + ' ft.');
      if (parapet.commonBase !== true) fatal.push('Stepped parapets require all parapet bases at roof datum h (parapet top = h + height) — confirm the common-base checkbox.');
      if (parapet.roofFlat === false) fatal.push('Stepped parapets require a flat roof (common base) — sloped roofs stay on the MWFRS typical-parapet path.');
    }
    return { qp_psf: qp, GCpn_ww: GCww, GCpn_lw: GClw, h_typ_ft: hTyp, h_max_ft: hMax, asdFactor: k,
      steps: steps, X: X, Y: Y, anyActive: anyActive, fatal: fatal };
  }

  var CASES = {
    X: [{ id: 'fromW', windward: 'W', leeward: 'E', text: 'wind from W' }, { id: 'fromE', windward: 'E', leeward: 'W', text: 'wind from E' }],
    Y: [{ id: 'fromN', windward: 'N', leeward: 'S', text: 'wind from N' }, { id: 'fromS', windward: 'S', leeward: 'N', text: 'wind from S' }]
  };

  function govOf(cases, get) {
    var best = -Infinity;
    cases.forEach(function (c) { best = Math.max(best, get(c)); });
    return { value: best, cases: cases.filter(function (c) { return near(get(c), best); }).map(function (c) { return c.id; }) };
  }

  // One direction.  No active steps -> calcDir (single result, no cases).
  function dirResult(dir, V, L_along, B_perp, rows, label, active) {
    if (!active || !active.length) return calcDir(V, L_along, B_perp, rows, label);
    var cases = CASES[dir].map(function (cs) {
      var steps = active.map(function (st) {
        var ww = st.face === cs.windward;
        return { label: st.label, start: st.start_ft, width: st.width_ft, F: ww ? st.F_ww_k : st.F_lw_k,
          face: st.face, GC_role: ww ? 'windward' : 'leeward' };
      });
      var r = calcDir(V, L_along, B_perp, rows, label + ' — ' + cs.text, { steps: steps });
      r.steps.forEach(function (s) { s.face = steps[s.index].face; s.GC_role = steps[s.index].GC_role; });
      r.id = cs.id; r.windward = cs.windward; r.leeward = cs.leeward;
      r.V_total = r.V; r.Vmax = r.Vmax_beam; r.Mmax = r.M_max;
      return r;
    });
    var sws = cases[0].sws;
    var env = {
      reactions: sws.map(function (sw, j) {
        var g = govOf(cases, function (c) { return Math.abs(c.reactions[j]); });
        var neg = cases.some(function (c) { return g.cases.indexOf(c.id) >= 0 && c.reactions[j] < 0; });
        var first = cases.filter(function (c) { return c.id === g.cases[0]; })[0];
        return { label: sw.label, loc: sw.loc, len: sw.len, abs: g.value, sign: neg ? -1 : 1,
          value: first.reactions[j], governing_cases: g.cases };
      }),
      Vmax: govOf(cases, function (c) { return c.Vmax_beam; }),
      Mmax: govOf(cases, function (c) { return c.M_max; }),
      chord_T: govOf(cases, function (c) { return c.chord_T; }),
      v_dia: govOf(cases, function (c) { return c.v_dia; }),
      V_total: govOf(cases, function (c) { return c.V; })
    };
    return {
      label: label, dir: dir, stepped: true,
      V_udl: V, L_along: L_along, B_perp: B_perp, w: V / L_along, sws: sws,
      steps: active, cases: cases, envelope: env
    };
  }

  // The page's calculate() wiring: Wind-X is EW wind, N/S walls (the X rows)
  // resist, the diaphragm spans D between them and B is the chord depth;
  // Wind-Y is the mirror.  Seismic reuses the geometry and is null at V = 0.
  // With o.parapet: returns { fatal: [msgs] } (GLOBAL — no wx/wy/sx/sy) when
  // any validation fails; otherwise wx/wy are stepped results where that
  // direction has active steps, plus parapet: stepForces(...) output.
  function analyze(o) {
    var Vx = +o.Vx || 0, Vy = +o.Vy || 0, Vx_s = +o.Vx_s || 0, Vy_s = +o.Vy_s || 0;
    var B = +o.B, D = +o.D, swX = o.swX || [], swY = o.swY || [];
    var par = o.parapet ? stepForces(o.parapet, B, D) : null;
    if (par) {
      var fatal = par.fatal.slice();
      if (par.X.length && swX.length < 2) fatal.push('Wind-X: eccentric parapet step needs ≥ 2 shearwall lines (N/S walls); rotational restraint not modeled.');
      if (par.Y.length && swY.length < 2) fatal.push('Wind-Y: eccentric parapet step needs ≥ 2 shearwall lines (E/W walls); rotational restraint not modeled.');
      if (fatal.length) return { fatal: fatal };
    }
    var res = {
      wx: dirResult('X', Vx, D, B, swX, 'Wind-X (EW)', par && par.X),
      wy: dirResult('Y', Vy, B, D, swY, 'Wind-Y (NS)', par && par.Y),
      sx: Vx_s > 0 ? calcDir(Vx_s, D, B, swX, 'Seismic-X (EW)') : null,
      sy: Vy_s > 0 ? calcDir(Vy_s, B, D, swY, 'Seismic-Y (NS)') : null
    };
    if (par) res.parapet = par;
    return res;
  }

  // Two lines at the same location give a zero lever arm (Infinity reaction).
  // Returns { ok, dupes: [loc, ...] } — the page wraps this in its alert.
  function checkSwLocs(sws) {
    var dupes = [];
    if (sws && sws.length >= 2) {
      var locs = sws.map(function (s) { return s.loc; });
      locs.forEach(function (v, i) {
        if (locs.indexOf(v) !== i && dupes.indexOf(v) < 0) dupes.push(v);
      });
    }
    return { ok: dupes.length === 0, dupes: dupes };
  }

  var RD = { ENGINE: ENGINE, calcDir: calcDir, analyze: analyze, stepForces: stepForces, checkSwLocs: checkSwLocs, CASES: CASES };
  root.RD = RD;
  if (typeof module !== 'undefined' && module.exports) module.exports = RD;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
