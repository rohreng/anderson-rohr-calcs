/*!
 * DeepBeamSTM — strut-and-tie deep beam engine (concrete wall spanning between piers).
 * Implements PLAN.md §§1-5, 7, 10, 11 (funicular arch + constant tie; Case C connected truss).
 *
 * UMD, ZERO DOM access. All lengths internally in INCHES, forces in KIPS, stresses in ksi
 * (except where an ACI expression is written in psi — the psi->kips conversion is explicit).
 * Full precision internally; rounding only in the separate format() helper.
 *
 * Public API:
 *   DeepBeamSTM.run(inputs) -> { status, errors:[...], results:{...} }
 *   DeepBeamSTM.format(x, nd)
 *
 * Test-only options (documented, PLAN §11 / fixtures):
 *   options.pinZ_in          — pin the internal lever arm z (authority validation only; bypasses
 *                              the f_ce crown-sizing iteration; a = 2*(hp - z) from geometry).
 *   options.tieCentroid_in   — override computed bottom-tie centroid (authority validation only).
 *   options.combos           — override load combinations, e.g. [{id:"AS-IS",D:1,L:0}]
 *                              (authority example enters already-factored loads).
 *
 * CODE-TEXT VERIFICATION FLAGS (PLAN "Risks"): the exact ACI 318-19 wording of §9.9.1.1,
 * Table 23.5.1, Table 25.4.3.2, and §25.4.4.1 applicability limits is implemented per the
 * plan's stated intended forms and must be verified against a licensed copy before "ready".
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.DeepBeamSTM = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  // ---------------------------------------------------------------- constants
  var N_UDL = 10;            // PLAN §2: UDL discretized at N = 10 segment centroids
  var N_UDL_OV = 4;          // Case C overhang UDL strip discretization (fixed, documented)
  var ROUTE_TOL = 0.25;      // in — PLAN §1 routing tolerance (fixed, inches)
  var THETA_MIN = 25;        // deg — ACI 318-19 §23.2.7
  var ITER_TOL_PLAN = 0.01;  // in — PLAN §2 convergence criterion |da| < 0.01"
  var ITER_TOL = 1e-9;       // in — engine iterates tighter (still satisfies plan criterion)
  var ITER_MAX = 200;
  var PHI_STM = 0.75, PHI_BRG = 0.65, PHI_SHEAR = 0.75, PHI_FLEX = 0.90;
  var BETA_C = 1.0;          // confinement modifier Table 23.9.2 — conservative 1.0, locked
  var LAMBDA = 1.0;          // normalweight only (locked)
  var PASS_EPS = 1e-6;
  var GEOM_EPS = 1e-9;

  var BARS = {
    "#3": { db: 0.375, Ab: 0.11 }, "#4": { db: 0.5, Ab: 0.20 }, "#5": { db: 0.625, Ab: 0.31 },
    "#6": { db: 0.75, Ab: 0.44 }, "#7": { db: 0.875, Ab: 0.60 }, "#8": { db: 1.0, Ab: 0.79 },
    "#9": { db: 1.128, Ab: 1.00 }, "#10": { db: 1.27, Ab: 1.27 }, "#11": { db: 1.41, Ab: 1.56 }
  };

  // ---------------------------------------------------------------- helpers
  function deg(rad) { return rad * 180 / Math.PI; }
  function rad(d) { return d * Math.PI / 180; }
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function fmt(x, nd) {
    if (!isNum(x)) return String(x);
    var n = (nd === undefined) ? 2 : nd;
    return Number(x.toFixed(n)).toLocaleString("en-US", { maximumFractionDigits: n });
  }
  function cloneJSON(o) { return JSON.parse(JSON.stringify(o)); }

  function err(list, code, message) { list.push({ code: code, message: message }); }

  // ---------------------------------------------------------------- checks
  function checkRow(id, label, aciRef, demand, capacity, opts) {
    opts = opts || {};
    var dcr;
    if (capacity > 0) dcr = demand / capacity;
    else dcr = (demand > 0 ? Infinity : 0);
    var pass = dcr <= 1 + PASS_EPS;
    if (opts.forceFail) pass = false;
    return {
      id: id, label: label, aciRef: aciRef,
      demand: demand, capacity: capacity, dcr: dcr,
      units: opts.units || "",
      governingCombo: null, governingPattern: null,
      contributions: opts.contributions || [],
      nearLimit: (dcr >= 0.95 && dcr <= 1.05),
      pass: pass,
      state: opts.state || "ok",           // "ok" | "detailing does not fit" | "informational"
      informational: !!opts.informational
    };
  }

  // ---------------------------------------------------------------- validation (PLAN §7, §1)
  function normalize(inputs) {
    var errors = [];
    if (!inputs || typeof inputs !== "object") { err(errors, "INPUT", "inputs object required"); return { errors: errors }; }
    var g = inputs.geometry || {}, lo = inputs.loads || {}, mat = inputs.materials || {}, rf = inputs.reinf || {};
    var opts = inputs.options || {};

    function reqNum(v, name, min, max) {
      if (!isNum(v)) { err(errors, "INPUT", name + " must be a finite number"); return 0; }
      if (min !== undefined && v < min) err(errors, "INPUT", name + " must be >= " + min);
      if (max !== undefined && v > max) err(errors, "INPUT", name + " must be <= " + max);
      return v;
    }

    var Lw = reqNum(g.L_w_ft, "geometry.L_w_ft", 1) * 12;
    var xL = reqNum(g.x_L_ft, "geometry.x_L_ft", 0) * 12;
    var xR = reqNum(g.x_R_ft, "geometry.x_R_ft", 0) * 12;
    var lbL = reqNum(g.lb_L_in, "geometry.lb_L_in", 0.5);
    var lbR = reqNum(g.lb_R_in, "geometry.lb_R_in", 0.5);
    var tw = reqNum(g.t_w_in, "geometry.t_w_in", 1);
    var hw = reqNum(g.h_w_ft, "geometry.h_w_ft", 0.5) * 12;
    var hgb = reqNum(g.h_gb_in, "geometry.h_gb_in", 1);
    var bgb = reqNum(g.b_gb_in, "geometry.b_gb_in", 1);
    var eL = isNum(g.e_L_in) ? g.e_L_in : 0;
    var eR = isNum(g.e_R_in) ? g.e_R_in : 0;
    if (eL < 0 || eR < 0) err(errors, "INPUT", "GB extensions e_L/e_R must be >= 0");

    // §1 inequalities
    if (xL < lbL / 2 - GEOM_EPS) err(errors, "GEOM", "x_L >= lb_L/2 required (bearing inside wall footprint)");
    if (xR > Lw - lbR / 2 + GEOM_EPS) err(errors, "GEOM", "x_R <= L_w - lb_R/2 required (bearing inside wall footprint)");
    var Ls = xR - xL;
    if (!(Ls > 0)) err(errors, "GEOM", "span L_s = x_R - x_L must be > 0");
    if (bgb < tw - GEOM_EPS) err(errors, "GEOM", "b_gb >= t_w required");
    // GB anchorage nib: the grade beam MAY extend past the wall end — that nib is the
    // standard detail for developing the tie hook (PLAN §5 / §23.8.3), so it is NOT a
    // geometry error. Only the length past the WALL END is a nib; where the wall itself
    // continues beyond the bearing (outboard strip / Case C overhang) the GB is simply
    // following the wall and is unbounded here.
    // Bound: the SAME limit as the outboard-strip dispersion rule (AUDIT-FIXES E),
    // nib <= min(h_gb, lb) — 45 deg through the GB depth AND landing within the bearing,
    // so the nib's own weight reaches the pier instead of acting as a designed
    // cantilever (which is out of scope).
    var nibL = eL - (xL - lbL / 2), nibR = eR - ((Lw - xR) - lbR / 2);
    var nibLimL = Math.min(hgb, lbL), nibLimR = Math.min(hgb, lbR);
    if (nibL > nibLimL + GEOM_EPS) err(errors, "GEOM", "GB nib past the wall end (" + fmt(nibL, 2) + " in) > min(h_gb, lb) = " + fmt(nibLimL, 2) + " in — becomes a designed cantilever (out of scope): deepen the GB, widen the bearing, or use headed bars");
    if (nibR > nibLimR + GEOM_EPS) err(errors, "GEOM", "GB nib past the wall end (" + fmt(nibR, 2) + " in) > min(h_gb, lb) = " + fmt(nibLimR, 2) + " in — becomes a designed cantilever (out of scope): deepen the GB, widen the bearing, or use headed bars");

    var fc = reqNum(mat.fc_psi, "materials.fc_psi", 2000, 10000);
    var fy = reqNum(mat.fy_ksi, "materials.fy_ksi");
    if (fy !== 40 && fy !== 60) err(errors, "MAT", "fy must be 40 or 60 ksi (Grade 80 excluded)");

    function barGroup(bg, name, defCount, defSize) {
      bg = bg || {};
      var count = isNum(bg.count) ? bg.count : defCount;
      var size = bg.size || defSize;
      if (!BARS[size]) { err(errors, "REINF", name + " bar size unknown: " + size); size = "#8"; }
      if (count < 1 || count !== Math.floor(count)) err(errors, "REINF", name + " count must be a positive integer");
      return { count: count, size: size, db: BARS[size].db, Ab: BARS[size].Ab, As: count * BARS[size].Ab };
    }
    var tieBars = barGroup(rf.tieBars, "tieBars", 4, "#8");
    var topBars = barGroup(rf.topBars, "topBars", 4, "#8");
    // D1 (AUDIT-FIXES): layout formulas (bar c/c spacing disjuncts of Tables 25.4.3.2/25.4.4.3,
    // cb, clear spacing) require at least 2 bars in each chord group.
    if (tieBars.count < 2) err(errors, "INVALID_INPUT", "tieBars.count must be >= 2");
    if (topBars.count < 2) err(errors, "INVALID_INPUT", "topBars.count must be >= 2");
    var coverBot = isNum(rf.cover_bot_in) ? rf.cover_bot_in : 3;
    var coverSide = isNum(rf.cover_side_in) ? rf.cover_side_in : 2;
    var coverTop = isNum(rf.cover_top_in) ? rf.cover_top_in : 2;
    if (coverBot < 0.75 || coverSide < 0.75 || coverTop < 0.75) err(errors, "REINF", "covers must be >= 0.75 in");
    // D2 (AUDIT-FIXES): cover geometry that cannot fit is rejected up front.
    if (coverBot + tieBars.db / 2 >= hgb / 2 - GEOM_EPS)
      err(errors, "INVALID_INPUT", "tie centroid must lie below grade-beam mid-depth (cover_bot + db/2 < h_gb/2)");
    if (2 * coverSide + tieBars.count * tieBars.db > bgb + GEOM_EPS)
      err(errors, "INVALID_INPUT", "tie bars do not fit within b_gb (2*cover_side + count*db > b_gb)");
    if (2 * coverSide + topBars.count * topBars.db > tw + GEOM_EPS)
      err(errors, "INVALID_INPUT", "top bars do not fit within t_w (2*cover_side + count*db > t_w)");

    function webDir(w, name) {
      w = w || {};
      var size = w.size || "#4"; if (!BARS[size]) { err(errors, "REINF", name + " size unknown"); size = "#4"; }
      var s = isNum(w.s_in) ? w.s_in : 12;
      var layers = isNum(w.layers) ? w.layers : 2; // EF default
      if (s <= 0) err(errors, "REINF", name + " spacing must be > 0");
      return { size: size, db: BARS[size].db, Ab: BARS[size].Ab, s: s, layers: layers };
    }
    var webIn = rf.web || {};
    var webV = webDir(webIn.v || webIn, "web.v");
    var webH = webDir(webIn.h || webIn, "web.h");
    // D2 (AUDIT-FIXES): wall must be thick enough for the EF curtains at the ENTERED
    // wall-face cover (default 1.5 in, ACI 20.5.1.3 formed/exposed, #5 and smaller).
    var wallCover = isNum(webIn.cover_in) ? webIn.cover_in : 1.5;
    if (wallCover <= 0) err(errors, "INVALID_INPUT", "wall EF cover must be > 0");
    if (webV.layers >= 2 && tw < 2 * (wallCover + webV.db + webH.db) - GEOM_EPS)
      err(errors, "INVALID_INPUT", "wall too thin for EF web reinforcement (t_w < 2*(cover_wall + db_v + db_h) = " + fmt(2 * (wallCover + webV.db + webH.db), 2) + " in)");

    function anch(a, name) {
      a = a || {};
      var type = a.type || "hook";
      if (type !== "hook" && type !== "headed" && type !== "straight") { err(errors, "REINF", name + ".type must be hook|headed|straight"); type = "hook"; }
      // hook/head-region confining tie config per Tables 25.4.3.2 / 25.4.4.3:
      // { legs, size, s_in } (preferred) or legacy { Ath_in2, s_in } where Ath_in2 = per-set
      // area (legs x Ab). Ath/Att totals are computed from the TIE SPACING via
      // nTies = floor(15*db/s) + 1 (ties within 15db of the hook/head, 25.4.3.3 geometry).
      var ties = null;
      if (a.ties && typeof a.ties === "object") {
        var tset = a.ties;
        var AthSet = null;
        if (isNum(tset.legs) && tset.size && BARS[tset.size]) AthSet = tset.legs * BARS[tset.size].Ab;
        else if (isNum(tset.Ath_in2)) AthSet = tset.Ath_in2;
        var sT = isNum(tset.s_in) ? tset.s_in : null;
        if (AthSet !== null && sT !== null && sT > 0) ties = { AthSet: AthSet, s: sT };
        else if (AthSet !== null || sT !== null) err(errors, "REINF", name + ".ties requires both a tie area (legs+size or Ath_in2) and s_in > 0");
      }
      var headAbrgRatio = isNum(a.headAbrgRatio) ? a.headAbrgRatio : 4;
      var epoxy = !!a.epoxy;
      return { type: type, ties: ties, headAbrgRatio: headAbrgRatio, epoxy: epoxy };
    }
    var anchorage = rf.anchorage || {};
    var anchL = anch(anchorage.left, "anchorage.left");
    var anchR = anch(anchorage.right, "anchorage.right");

    // loads
    var DLs = isNum(lo.DL_super_plf) ? lo.DL_super_plf : 0;
    var LLs = isNum(lo.LL_plf) ? lo.LL_plf : 0;
    if (DLs < 0 || LLs < 0) err(errors, "LOAD", "line loads must be >= 0");
    var wallSW = isNum(lo.wallSW_plf) ? lo.wallSW_plf : 150 * (tw / 12) * (hw / 12); // auto, editable
    var gbSW = isNum(lo.gbSW_plf) ? lo.gbSW_plf : 150 * (bgb * hgb / 144);           // auto, editable
    if (wallSW < 0 || gbSW < 0) err(errors, "LOAD", "self weights must be >= 0");
    var wD_pli = (DLs + wallSW + gbSW) / 12000; // plf -> kip/in
    var wL_pli = LLs / 12000;

    var points = [];
    var plist = lo.pointLoads || [];
    if (plist.length > 6) err(errors, "LOAD", "too many point loads");
    for (var i = 0; i < plist.length; i++) {
      var p = plist[i];
      var x = reqNum(p.x_ft, "pointLoads[" + i + "].x_ft", 0) * 12;
      var w = reqNum(p.width_in, "pointLoads[" + i + "].width_in", 0.5);
      var D = isNum(p.D_kip) ? p.D_kip : 0;
      var L = isNum(p.L_kip) ? p.L_kip : 0;
      if (D < 0 || L < 0) err(errors, "LOAD", "point load components must be >= 0");
      if (x - w / 2 < -GEOM_EPS || x + w / 2 > Lw + GEOM_EPS) err(errors, "LOAD", "pointLoads[" + i + "] footprint must lie on the wall");
      points.push({ id: "P" + (i + 1), x: x, w: w, D: D, L: L });
    }
    // Overlapping user-entered point-load footprints rejected (PLAN §1)
    for (var a1 = 0; a1 < points.length; a1++) for (var b1 = a1 + 1; b1 < points.length; b1++) {
      var pa = points[a1], pb = points[b1];
      if (Math.min(pa.x + pa.w / 2, pb.x + pb.w / 2) - Math.max(pa.x - pa.w / 2, pb.x - pb.w / 2) > 1e-9)
        err(errors, "LOAD", "point loads " + pa.id + " and " + pb.id + " have overlapping footprints (rejected)");
    }

    // test-only options
    var pinZ = isNum(opts.pinZ_in) ? opts.pinZ_in : null;
    var ytOverride = isNum(opts.tieCentroid_in) ? opts.tieCentroid_in : null;
    var combos = opts.combos || [{ id: "1.4D", D: 1.4, L: 0 }, { id: "1.2D+1.6L", D: 1.2, L: 1.6 }];

    if (errors.length) return { errors: errors };

    var h = hw + hgb;
    // bottom-tie centroid from entered bars + cover (single layer assumed; override is test-only)
    var yt = (ytOverride !== null) ? ytOverride : (coverBot + tieBars.db / 2);
    var hp = h - yt;                                  // tie centroid -> top fiber
    var ytTop = coverTop + topBars.db / 2;            // top fiber -> top-bar centroid
    var dEff = h - yt;                                // §9.9.2.1 d from top-of-wall compression fiber
    var dTop = h - ytTop;                             // effective depth for top bars (outboard cantilever)

    var ctx = {
      Lw: Lw, xL: xL, xR: xR, Ls: Ls, lbL: lbL, lbR: lbR, tw: tw, hw: hw, hgb: hgb, bgb: bgb,
      eL: eL, eR: eR, h: h, yt: yt, hp: hp, ytTop: ytTop, zTop: hp - ytTop, dEff: dEff, dTop: dTop,
      fc: fc, fcKsi: fc / 1000, fy: fy,
      tieBars: tieBars, topBars: topBars,
      coverBot: coverBot, coverSide: coverSide, coverTop: coverTop,
      webV: webV, webH: webH, anchL: anchL, anchR: anchR,
      wD_pli: wD_pli, wL_pli: wL_pli, gbSW_pli: gbSW / 12000, points: points,
      pinZ: pinZ, combos: combos,
      tNode: Math.min(tw, bgb)
    };
    return { ctx: ctx, errors: [] };
  }

  // ------------------------------------------------- load classification (PLAN §1)
  function classify(ctx) {
    var errors = [];
    var routed = { L: [], R: [] }, truss = [], over = { L: [], R: [] };
    for (var i = 0; i < ctx.points.length; i++) {
      var p = ctx.points[i];
      var side = null;
      var sides = [{ s: "L", xs: ctx.xL, lb: ctx.lbL }, { s: "R", xs: ctx.xR, lb: ctx.lbR }];
      for (var k = 0; k < 2; k++) {
        var S = sides[k];
        var withinTol = Math.abs(p.x - S.xs) <= ROUTE_TOL + GEOM_EPS;
        var inside = (p.x - p.w / 2 >= S.xs - S.lb / 2 - GEOM_EPS) && (p.x + p.w / 2 <= S.xs + S.lb / 2 + GEOM_EPS);
        if (withinTol && inside) { side = S.s; break; }
      }
      if (side) { p.class = "routed"; p.side = side; routed[side].push(p); }
      else if (p.x > ctx.xL + GEOM_EPS && p.x < ctx.xR - GEOM_EPS) { p.class = "truss"; truss.push(p); }
      else { p.class = "overhang"; p.side = (p.x <= ctx.xL + GEOM_EPS) ? "L" : "R"; over[p.side].push(p); }
    }
    if (truss.length > 3) err(errors, "LOAD", "no more than 3 interior (truss) point loads supported");
    if (over.L.length > 3 || over.R.length > 3) err(errors, "LOAD", "no more than 3 overhang point loads per side supported");

    // Outboard UDL strips (wall end -> support centerline). Dispersion-footprint rule
    // (AUDIT-FIXES E): the strip length o beyond the bearing OUTER face routes only if it
    // can disperse at 45 deg through the GB depth (o <= h_gb) AND land entirely within the
    // bearing width (o <= lb)  =>  o <= min(h_gb, lb).
    function strip(side) {
      var xs = side === "L" ? ctx.xL : ctx.xR;
      var lb = side === "L" ? ctx.lbL : ctx.lbR;
      var len = side === "L" ? ctx.xL : (ctx.Lw - ctx.xR);       // wall end -> centerline
      var o = Math.max(0, len - lb / 2);                          // beyond bearing outer face
      var oLimit = Math.min(ctx.hgb, lb);
      var disperses = o <= oLimit + GEOM_EPS;
      return { side: side, len: len, o: o, oLimit: oLimit, disperses: disperses, lb: lb, xs: xs };
    }
    var stripL = strip("L"), stripR = strip("R");
    var hasUDL = (ctx.wD_pli > 0 || ctx.wL_pli > 0);

    var overSideSet = [];
    if (over.L.length || (hasUDL && !stripL.disperses)) overSideSet.push("L");
    if (over.R.length || (hasUDL && !stripR.disperses)) overSideSet.push("R");
    if (overSideSet.length === 2) {
      var stripCaused = hasUDL && (!stripL.disperses || !stripR.disperses);
      err(errors, "SCOPE", (stripCaused
        ? "outboard wall exceeds dispersion/bearing limit (o > min(h_gb, lb)) — use Case C (single overhang side); "
        : "") + "overhangs on both sides are out of scope (Case C supports one overhang)");
    }

    ctx.routedPts = routed; ctx.trussPts = truss; ctx.overPts = over;
    ctx.stripL = stripL; ctx.stripR = stripR; ctx.hasUDL = hasUDL;
    ctx.overSide = overSideSet.length === 1 ? overSideSet[0] : null;
    ctx.caseC = overSideSet.length === 1;
    // strip participation in Case C: sub-strip beyond the bearing outer face becomes overhang
    // truss load (discretized N_UDL_OV); remainder over the bearing is routed (o = 0 trivially).
    return errors;
  }

  // ------------------------------------------------- beta_s / web reinforcement (§23.5 / §9.9.3.1)
  function webReinf(ctx) {
    var rhoV = ctx.webV.layers * ctx.webV.Ab / (ctx.tw * ctx.webV.s);
    var rhoH = ctx.webH.layers * ctx.webH.Ab / (ctx.tw * ctx.webH.s);
    // Table 23.5.1 (2019 orthogonal-grid form; verify wording at build): 0.0025 each way, s <= 12 in.
    var qualifies = rhoV >= 0.0025 - 1e-12 && rhoH >= 0.0025 - 1e-12 && ctx.webV.s <= 12 + GEOM_EPS && ctx.webH.s <= 12 + GEOM_EPS;
    var betaS = qualifies ? 0.75 : 0.4;
    return { rhoV: rhoV, rhoH: rhoH, qualifies: qualifies, betaS: betaS };
  }

  // ------------------------------------------------- development lengths (ACI 318-19 Ch. 25)
  function psiC(fc) { return fc < 6000 ? fc / 15000 + 0.6 : 1.0; }

  // Developed-bar center-to-center spacing from the entered GB layout (bar count >= 2
  // enforced at input, AUDIT-FIXES D1). Used by the Table 25.4.3.2(b)/25.4.4.3(b) disjuncts.
  function barSpacingCC(ctx, bar) {
    return (ctx.bgb - 2 * ctx.coverSide - bar.db) / (bar.count - 1);
  }
  // Confining-tie area within 15db of the hook/head: Ath(Att) = perSetArea * nTies with
  // nTies = floor(15*db / s) + 1 (25.4.3.3 geometry; AUDIT-FIXES A2/A4). Wide TIE spacing
  // therefore reduces Ath — it can NOT earn the 1.0 factor through the spacing disjunct,
  // which belongs to the developed BARS' own c/c spacing.
  function tieAreaWithin15db(ties, db) {
    var nTies = Math.floor(15 * db / ties.s) + 1;
    return { Ath: ties.AthSet * nTies, nTies: nTies };
  }

  function ldHook(ctx, bar, anchCfg) {
    // ACI 318-19 25.4.3.1: ldh = (fy*psi_e*psi_r*psi_o*psi_c / (55*lambda*sqrt(f'c))) * db^1.5
    // (psi/in units), min max(8db, 6 in). Table 25.4.3.2 psi_r COMPUTED from geometry:
    // 1.0 when (a) Ath >= 0.4*Ahs (ties within 15db) OR (b) hooked-bar c/c spacing >= 6db;
    // else 1.6. NOTE (b) is the spacing of the HOOKED BARS, not the tie spacing.
    var db = bar.db, Ahs = bar.As;
    var psiE = anchCfg.epoxy ? 1.2 : 1.0;
    var sHooked = barSpacingCC(ctx, bar);
    var psiR = 1.6, psiRWhy = "hooked-bar spacing < 6db and no qualifying confining reinforcement (Table 25.4.3.2)";
    var AthInfo = null;
    if (anchCfg.ties) {
      AthInfo = tieAreaWithin15db(anchCfg.ties, db);
      if (AthInfo.Ath >= 0.4 * Ahs - 1e-12) { psiR = 1.0; psiRWhy = "Ath = " + fmt(AthInfo.Ath, 3) + " in2 >= 0.4*Ahs (Table 25.4.3.2(a))"; }
    }
    if (psiR !== 1.0 && sHooked >= 6 * db - 1e-12) { psiR = 1.0; psiRWhy = "hooked-bar c/c spacing " + fmt(sHooked, 3) + " in >= 6db (Table 25.4.3.2(b))"; }
    var psiO = (ctx.coverSide >= 6 * db - 1e-12) ? 1.0 : 1.25; // 25.4.3.2: 1.0 inside column/pier core or side cover >= 6db (conservative-input approach)
    var pC = psiC(ctx.fc);
    var l = (ctx.fy * 1000) * psiE * psiR * psiO * pC / (55 * LAMBDA * Math.sqrt(ctx.fc)) * Math.pow(db, 1.5);
    l = Math.max(l, 8 * db, 6);
    return { l: l, psiE: psiE, psiR: psiR, psiRWhy: psiRWhy, psiO: psiO, psiC: pC, sHooked: sHooked, Ath: AthInfo ? AthInfo.Ath : 0, nTies: AthInfo ? AthInfo.nTies : 0 };
  }

  function ldHead(ctx, bar, anchCfg, ccClear) {
    // ACI 318-19 25.4.4.2: ldt = (fy*psi_e*psi_p*psi_o*psi_c / (75*sqrt(f'c))) * db^1.5
    // (psi/in units), min max(8db, 6 in); 25.4.4.1 applicability enforced (rejected if unmet).
    var db = bar.db, notes = [], applicable = true;
    if (db > BARS["#11"].db + 1e-9) { applicable = false; notes.push("bar larger than #11"); }
    if (anchCfg.headAbrgRatio < 4 - 1e-12) { applicable = false; notes.push("head Abrg < 4Ab"); }
    if (Math.min(ctx.coverBot, ctx.coverSide) < 2 * db - 1e-12) { applicable = false; notes.push("clear cover < 2db"); }
    if (isNum(ccClear) && ccClear < 4 * db - 1e-12) { applicable = false; notes.push("clear bar spacing < 4db"); }
    var psiE = anchCfg.epoxy ? 1.2 : 1.0;
    // Table 25.4.4.3 psi_p: 1.0 when (a) Att >= 0.3*Ahs (ties within 15db) OR
    // (b) HEADED-BAR c/c spacing >= 6db; else 1.6. Same disjunct structure as psi_r.
    var sHeaded = barSpacingCC(ctx, bar);
    var psiP = 1.6, why = "headed-bar spacing < 6db and no qualifying parallel tie reinforcement (Table 25.4.4.3)";
    var AttInfo = null;
    if (anchCfg.ties) {
      AttInfo = tieAreaWithin15db(anchCfg.ties, db);
      if (AttInfo.Ath >= 0.3 * bar.As - 1e-12) { psiP = 1.0; why = "Att = " + fmt(AttInfo.Ath, 3) + " in2 >= 0.3*Ahs (Table 25.4.4.3(a))"; }
    }
    if (psiP !== 1.0 && sHeaded >= 6 * db - 1e-12) { psiP = 1.0; why = "headed-bar c/c spacing " + fmt(sHeaded, 3) + " in >= 6db (Table 25.4.4.3(b))"; }
    var psiO = (ctx.coverSide >= 6 * db - 1e-12) ? 1.0 : 1.25;
    var pC = psiC(ctx.fc);
    var l = (ctx.fy * 1000) * psiE * psiP * psiO * pC / (75 * Math.sqrt(ctx.fc)) * Math.pow(db, 1.5);
    l = Math.max(l, 8 * db, 6);
    return { l: l, applicable: applicable, notes: notes, psiE: psiE, psiP: psiP, psiPWhy: why, psiO: psiO, psiC: pC, sHeaded: sHeaded, Att: AttInfo ? AttInfo.Ath : 0 };
  }

  function ldStraight(ctx, bar, opts) {
    // ACI 318-19 25.4.2.4 with full modifier set; Ktr = 0 (permitted, conservative).
    // psi_e (AUDIT-FIXES A5): epoxy-coated -> 1.5 when clear cover < 3db OR clear spacing
    // < 6db, else 1.2; uncoated 1.0. Product psi_t*psi_e capped at 1.7 (25.4.2.5).
    opts = opts || {};
    var db = bar.db;
    var psiT = opts.top ? 1.3 : 1.0;
    var psiE = 1.0;
    if (opts.epoxy) {
      var congested = (isNum(opts.clearCover) && opts.clearCover < 3 * db - 1e-12) ||
                      (isNum(opts.clearSpacing) && opts.clearSpacing < 6 * db - 1e-12);
      psiE = congested ? 1.5 : 1.2;
    }
    var prod = Math.min(psiT * psiE, 1.7); // cap 25.4.2.5
    var psiS = (db <= BARS["#6"].db + 1e-9) ? 0.8 : 1.0;
    var psiG = 1.0; // Gr 40/60
    var cb = opts.cb;
    var conf = Math.min(2.5, cb / db);
    var l = (3 / 40) * (ctx.fy * 1000 / (LAMBDA * Math.sqrt(ctx.fc))) * (prod * psiS * psiG / conf) * db;
    l = Math.max(l, 12);
    return { l: l, psiT: psiT, psiE: psiE, psiTE: prod, psiS: psiS, psiG: psiG, cb: cb, conf: conf };
  }

  function cbBottom(ctx) {
    var n = ctx.tieBars.count, db = ctx.tieBars.db;
    var cc = n > 1 ? (ctx.bgb - 2 * ctx.coverSide - db) / (n - 1) : Infinity; // center-to-center
    return Math.min(ctx.coverBot + db / 2, ctx.coverSide + db / 2, cc / 2);
  }
  function cbTop(ctx) {
    var n = ctx.topBars.count, db = ctx.topBars.db;
    var cc = n > 1 ? (ctx.tw - 2 * ctx.coverSide - db) / (n - 1) : Infinity;
    if (cc <= 0) cc = Infinity;
    return Math.min(ctx.coverTop + db / 2, ctx.coverSide + db / 2, cc / 2);
  }

  // ------------------------------------------------- linear algebra (Case C joints)
  function solveNormal(A, b, n) {
    // least-squares via normal equations (A: rows x n). Exact for the determinate case.
    var rows = A.length, N = [], r, c, k;
    for (r = 0; r < n; r++) { N.push(new Array(n + 1).fill(0)); }
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) { var s = 0; for (k = 0; k < rows; k++) s += A[k][r] * A[k][c]; N[r][c] = s; }
      var sb = 0; for (k = 0; k < rows; k++) sb += A[k][r] * b[k]; N[r][n] = sb;
    }
    for (c = 0; c < n; c++) {
      var piv = c; for (r = c + 1; r < n; r++) if (Math.abs(N[r][c]) > Math.abs(N[piv][c])) piv = r;
      if (Math.abs(N[piv][c]) < 1e-12) return null;
      var t = N[c]; N[c] = N[piv]; N[piv] = t;
      for (r = 0; r < n; r++) {
        if (r === c) continue;
        var f = N[r][c] / N[c][c];
        for (k = c; k <= n; k++) N[r][k] -= f * N[c][k];
      }
    }
    var x = new Array(n);
    for (r = 0; r < n; r++) x[r] = N[r][n] / N[r][r];
    return x;
  }

  // ------------------------------------------------- build factored truss loads + merge (PLAN §2)
  function buildSpanLoads(ctx, fD, fL, mask) {
    var items = [];
    var w = fD * ctx.wD_pli + (mask.udl ? fL * ctx.wL_pli : 0);
    if (w > 0) {
      var seg = ctx.Ls / N_UDL;
      for (var i = 0; i < N_UDL; i++) {
        items.push({ P: w * seg, x: (i + 0.5) * seg, lo: i * seg, hi: (i + 1) * seg, srcs: ["UDL" + (i + 1)] });
      }
    }
    for (var j = 0; j < ctx.trussPts.length; j++) {
      var p = ctx.trussPts[j];
      var Pf = fD * p.D + (mask.pts[p.id] ? fL * p.L : 0);
      if (Pf <= 0) continue;
      var xi = p.x - ctx.xL;
      items.push({ P: Pf, x: xi, lo: Math.max(0, xi - p.w / 2), hi: Math.min(ctx.Ls, xi + p.w / 2), srcs: [p.id] });
    }
    // merge overlapping footprints -> ONE resultant at force-weighted centroid (PLAN §2)
    var changed = true;
    while (changed) {
      changed = false;
      items.sort(function (a, b) { return a.x - b.x || a.lo - b.lo; });
      for (var k = 0; k + 1 < items.length; k++) {
        var a = items[k], b2 = items[k + 1];
        if (Math.min(a.hi, b2.hi) - Math.max(a.lo, b2.lo) > 1e-9) {
          var P = a.P + b2.P;
          items[k] = { P: P, x: (a.P * a.x + b2.P * b2.x) / P, lo: Math.min(a.lo, b2.lo), hi: Math.max(a.hi, b2.hi), srcs: a.srcs.concat(b2.srcs) };
          items.splice(k + 1, 1);
          changed = true; break;
        }
      }
    }
    for (var m = 0; m < items.length; m++) items[m].w = items[m].hi - items[m].lo;
    return items;
  }

  function momentsAt(items, Ls) {
    var W = 0, Mo = 0;
    for (var i = 0; i < items.length; i++) { W += items[i].P; Mo += items[i].P * items[i].x; }
    var RL = (W * Ls - Mo) / Ls; // = sum P*(Ls-x)/Ls
    var RR = W - RL;
    var M = [];
    for (var k = 0; k < items.length; k++) {
      var mk = RL * items[k].x;
      for (var j = 0; j < k; j++) mk -= items[j].P * (items[k].x - items[j].x);
      M.push(mk);
    }
    return { W: W, RL: RL, RR: RR, M: M };
  }

  // ------------------------------------------------- routed loads (per run)
  function routedForces(ctx, fD, fL) {
    // Routed live load kept ON in all patterns (monotonic for bearing; documented).
    function stripForce(strip) {
      var lenRouted = ctx.caseC && ctx.overSide === strip.side && !strip.disperses
        ? strip.lb / 2                      // Case C: only the part over the bearing routes
        : strip.len;
      var P = (fD * ctx.wD_pli + fL * ctx.wL_pli) * lenRouted;
      // GB anchorage nib beyond the wall end: grade-beam self weight only (no wall and no
      // superimposed DL sits on it), dead load only, dispersed into the bearing.
      // NOTE the datum: e is measured from the bearing OUTER face, so the nib is
      // e - strip.o (o = wall beyond the outer face) — NOT e - strip.len, which is
      // measured to the bearing CENTERLINE and understates the nib by lb/2.
      var nib = Math.max(0, (strip.side === "L" ? ctx.eL : ctx.eR) - strip.o);
      P += fD * ctx.gbSW_pli * nib;
      return { P: P, len: lenRouted, nib: nib };
    }
    var out = { L: { strip: stripForce(ctx.stripL), pts: [] }, R: { strip: stripForce(ctx.stripR), pts: [] } };
    ["L", "R"].forEach(function (s) {
      ctx.routedPts[s].forEach(function (p) {
        out[s].pts.push({ id: p.id, P: fD * p.D + fL * p.L, w: p.w });
      });
      out[s].total = out[s].strip.P;
      out[s].pts.forEach(function (q) { out[s].total += q.P; });
    });
    return out;
  }

  // ------------------------------------------------- chord geometry iteration (PLAN §2)
  function sizeChord(ctx, Mmax, fce) {
    if (ctx.pinZ !== null) {
      var z0 = ctx.pinZ, a0 = 2 * (ctx.hp - z0);
      if (z0 <= 0 || a0 <= 0) return { error: "geometry_infeasible", msg: "pinned z incompatible with section (a <= 0)" };
      return { z: z0, a: a0, iters: 0, pinned: true };
    }
    var a = 0, z = ctx.hp, iters = 0, converged = false;
    while (iters < ITER_MAX) {
      z = ctx.hp - a / 2;
      if (z <= GEOM_EPS) return { error: "geometry_infeasible", msg: "lever arm z <= 0 during crown sizing" };
      var H = Mmax / z;
      var aNew = H / (fce * ctx.tw);
      iters++;
      if (Math.abs(aNew - a) < ITER_TOL) { a = aNew; converged = true; break; }
      a = aNew;
    }
    if (!converged) return { error: "not_converged", msg: "crown-depth fixed point did not converge in " + ITER_MAX + " iterations" };
    z = ctx.hp - a / 2;
    if (z <= 0 || a <= 0 || a >= ctx.h) return { error: "geometry_infeasible", msg: "crown sizing produced invalid a/z" };
    return { z: z, a: a, iters: iters, pinned: false, planTolMet: true };
  }

  // ------------------------------------------------- convex polygon clipping (B1 helper)
  function clipHalfPlane(poly, f) {
    // keep points with f(x,y) <= 0; poly = [[x,y],...] convex, CCW or CW
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var fa = f(a[0], a[1]), fb = f(b[0], b[1]);
      if (fa <= GEOM_EPS) out.push(a);
      if ((fa < -GEOM_EPS && fb > GEOM_EPS) || (fa > GEOM_EPS && fb < -GEOM_EPS)) {
        var t = fa / (fa - fb);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    return out;
  }
  function polyArea(poly) {
    var A = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      A += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(A) / 2;
  }

  // ------------------------------------------------- vertex node construction (PLAN §4, AUDIT-FIXES B1)
  function vertexNode(ctx, v, segL, segR) {
    // Band-bounded smeared node: vertical extent centered on the vertex ordinate, limited by
    // (i) the wall+GB envelope AND (ii) the adjacent compression bands' vertical depths —
    // a node face cannot be wider than the band that delivers its force:
    //   haNode = min( 2*(hp - v.y), 2*(v.y + yt), max(dVert_L, dVert_R) ).
    // Face widths w = w_v*|sin a| + ha_node*|cos a| with the bounded haNode.
    if (ctx.hp - v.y <= GEOM_EPS) return { error: "geometry_infeasible", msg: "arch vertex at/above top of wall" };
    var haEnvTop = 2 * (ctx.hp - v.y);
    var haEnvBot = 2 * (v.y + ctx.yt);
    var haBand = Math.max(segL.dVert, segR.dVert);
    var haNode = Math.min(haEnvTop, haEnvBot, haBand);
    var topGoverned = haEnvTop <= Math.min(haEnvBot, haBand) + GEOM_EPS;
    if (haNode <= GEOM_EPS) return { error: "geometry_infeasible", msg: "vertex node has no available depth" };
    function face(seg) {
      var wf = v.w * Math.abs(Math.sin(seg.alphaRad)) + haNode * Math.abs(Math.cos(seg.alphaRad));
      return { name: "strut(" + seg.id + ")", width: wf, area: wf * ctx.tw, force: seg.F, stress: seg.F / (wf * ctx.tw) };
    }
    var faces = [
      { name: "bearing", width: v.w, area: v.w * ctx.tw, force: v.P, stress: v.P / (v.w * ctx.tw) },
      face(segL), face(segR)
    ];
    // Node polygon = intersection of the two band quadrilaterals (slabs of vertical depth
    // dVert centered on each segment's extended axis line through the vertex) with the
    // vertical strip of width v.w, clipped to the wall+GB envelope (B1).
    var big = ctx.h + haBand;
    var poly = [
      [v.xAbs - v.w / 2, v.yAbs - big], [v.xAbs + v.w / 2, v.yAbs - big],
      [v.xAbs + v.w / 2, v.yAbs + big], [v.xAbs - v.w / 2, v.yAbs + big]
    ];
    [segL, segR].forEach(function (seg) {
      var m = Math.tan(seg.alphaRad);
      var axisY = function (x) { return v.yAbs + m * (x - v.xAbs); }; // axis passes through the vertex
      poly = clipHalfPlane(poly, function (x, y) { return y - (axisY(x) + seg.dVert / 2); }); // y <= axis + d/2
      poly = clipHalfPlane(poly, function (x, y) { return (axisY(x) - seg.dVert / 2) - y; }); // y >= axis - d/2
    });
    poly = clipHalfPlane(poly, function (x, y) { return -y; });          // y >= 0 (bottom of GB)
    poly = clipHalfPlane(poly, function (x, y) { return y - ctx.h; });   // y <= h (top of wall)
    // closure test: intersection must be a non-degenerate closed polygon
    if (poly.length < 3 || polyArea(poly) <= GEOM_EPS)
      return { error: "geometry_infeasible", msg: "vertex node band intersection is empty/degenerate" };
    return { haNode: haNode, haBand: haBand, faces: faces, poly: poly, cls: "CCC", topGoverned: topGoverned };
  }

  // ------------------------------------------------- anchorage per end (PLAN §5 / §23.8.3)
  function anchorageEnd(ctx, side, theta, T, run) {
    var lb = side === "L" ? ctx.lbL : ctx.lbR;
    var e = side === "L" ? ctx.eL : ctx.eR;
    var cfg = side === "L" ? ctx.anchL : ctx.anchR;
    var bar = ctx.tieBars;
    var coverEnd = ctx.coverSide;
    var tanT = Math.tan(rad(theta));
    var xCrit = ctx.yt / tanT;                       // inboard of the bearing inner edge
    var available = xCrit + lb + e - coverEnd;       // along the bar centerline to the bar end
    var req, detail = { type: cfg.type, xCrit_in: xCrit };
    var state = "ok", forceFail = false;
    if (cfg.type === "hook") {
      var hk = ldHook(ctx, bar, cfg);
      req = hk.l; detail.ldh = hk;                    // no excess-reinforcement reduction (25.4.10.2)
    } else if (cfg.type === "headed") {
      var n = bar.count, ccClear = n > 1 ? (ctx.bgb - 2 * ctx.coverSide - bar.db) / (n - 1) - bar.db : Infinity;
      var hd = ldHead(ctx, bar, cfg, ccClear);
      req = hd.l; detail.ldt = hd;
      if (!hd.applicable) { state = "detailing does not fit"; forceFail = true; detail.reject = "ldt applicability (25.4.4.1): " + hd.notes.join("; "); }
    } else {
      var ccB = barSpacingCC(ctx, bar);
      var st = ldStraight(ctx, bar, {
        top: false, epoxy: cfg.epoxy, cb: cbBottom(ctx),
        clearCover: Math.min(ctx.coverBot, ctx.coverSide),
        clearSpacing: ccB - bar.db
      });
      // straight development scaled by demand stress ratio (fs/fy = T/(phi*As*fy)); hooks and
      // heads use full lengths (no reduction, 25.4.10.2). Documented conservatism choice.
      var ratio = Math.min(1, T / (PHI_STM * bar.As * ctx.fy));
      req = Math.max(st.l * ratio, 6); detail.ld = st; detail.stressRatio = ratio;
    }
    detail.required_in = req; detail.available_in = available; detail.theta_deg = theta; detail.T_kip = T;
    return { req: req, avail: available, detail: detail, state: state, forceFail: forceFail };
  }

  // ------------------------------------------------- Case A/B run (PLAN §2)
  function solveAB(ctx, combo, mask, betaInfo) {
    var fce = PHI_STM * 0.85 * betaInfo.betaS * ctx.fcKsi;
    var items = buildSpanLoads(ctx, combo.D, combo.L, mask);
    if (!items.length) return { status: "no_admissible_stm", errors: [{ code: "NO_TRUSS_LOAD", message: "no truss loads between support centerlines (" + combo.id + ")" }] };
    var st = momentsAt(items, ctx.Ls);
    if (st.RL < -1e-9 || st.RR < -1e-9) return { status: "no_admissible_stm", errors: [{ code: "NEG_REACTION", message: "negative reaction (" + combo.id + ")" }] };
    var Mmax = -Infinity, iMax = -1;
    for (var i = 0; i < st.M.length; i++) {
      if (st.M[i] < -1e-6 * Math.max(1, Math.abs(Mmax))) return { status: "no_admissible_stm", errors: [{ code: "NEG_MOMENT", message: "M(x) < 0 within the span (asserted impossible for gravity loads)" }] };
      if (st.M[i] > Mmax) { Mmax = st.M[i]; iMax = i; }
    }
    if (!(Mmax > 0)) return { status: "no_admissible_stm", errors: [{ code: "DEGENERATE", message: "zero moment diagram" }] };

    var chord = sizeChord(ctx, Mmax, fce);
    if (chord.error) return { status: chord.error, errors: [{ code: "CHORD", message: chord.msg + " (" + combo.id + ")" }] };
    var z = chord.z, a = chord.a, H = Mmax / z;

    // funicular polygon
    var verts = [];
    for (var k = 0; k < items.length; k++) {
      verts.push({
        x: items[k].x, y: z * st.M[k] / Mmax, P: items[k].P, w: items[k].w, srcs: items[k].srcs,
        xAbs: ctx.xL + items[k].x, yAbs: 0, id: "V" + (k + 1)
      });
      verts[k].yAbs = ctx.yt + verts[k].y;
    }
    var poly = [{ x: 0, y: 0 }].concat(verts.map(function (v) { return { x: v.x, y: v.y }; })).concat([{ x: ctx.Ls, y: 0 }]);
    var segs = [];
    for (var s2 = 0; s2 + 1 < poly.length; s2++) {
      var dx = poly[s2 + 1].x - poly[s2].x, dy = poly[s2 + 1].y - poly[s2].y;
      if (dx <= GEOM_EPS) return { status: "geometry_infeasible", errors: [{ code: "SEG", message: "degenerate arch segment (zero horizontal run)" }] };
      var al = Math.atan2(dy, dx);
      var F = H / Math.cos(al);
      segs.push({ id: "arch." + s2, x1: poly[s2].x, y1: poly[s2].y, x2: poly[s2 + 1].x, y2: poly[s2 + 1].y, alphaRad: al, alphaDeg: deg(al), F: F, wReq: F / (fce * ctx.tw), dVert: F / (fce * ctx.tw * Math.cos(al)) });
    }
    var thetaL = segs[0].alphaDeg, thetaR = -segs[segs.length - 1].alphaDeg;
    if (thetaL < THETA_MIN - 1e-9 || thetaR < THETA_MIN - 1e-9)
      return { status: "no_admissible_stm", errors: [{ code: "THETA_MIN", message: "springing angle " + fmt(Math.min(thetaL, thetaR), 2) + " deg < 25 deg (ACI 23.2.7) [" + combo.id + "]" }] };

    // support nodes (CCT extended nodal zone)
    var ha = 2 * ctx.yt;
    var wsL = ctx.lbL * Math.sin(rad(thetaL)) + ha * Math.cos(rad(thetaL));
    var wsR = ctx.lbR * Math.sin(rad(thetaR)) + ha * Math.cos(rad(thetaR));
    if (ha > ctx.h) return { status: "geometry_infeasible", errors: [{ code: "NODE", message: "support node back face exceeds member depth" }] };

    // vertex nodes
    var vnodes = [];
    for (var vv = 0; vv < verts.length; vv++) {
      var vn = vertexNode(ctx, verts[vv], segs[vv], segs[vv + 1]);
      if (vn.error) return { status: vn.error, errors: [{ code: "VNODE", message: vn.msg + " at x=" + fmt(verts[vv].xAbs / 12, 2) + " ft [" + combo.id + "]" }] };
      vn.id = "node.vertex." + (vv + 1); vn.v = verts[vv];
      vnodes.push(vn);
    }

    // per-segment available width (from constructed node faces; PLAN §2/§4)
    for (var sg = 0; sg < segs.length; sg++) {
      var availL = (sg === 0) ? wsL : vnodes[sg - 1].faces[2].width;      // face toward this seg
      var availR = (sg === segs.length - 1) ? wsR : vnodes[sg].faces[1].width;
      // for interior segs: at left vertex node (index sg-1) this segment is segR -> faces[2];
      // at right vertex node (index sg) it is segL -> faces[1].
      segs[sg].wAvail = Math.min(availL, availR);
      segs[sg].fitDcr = segs[sg].wReq / segs[sg].wAvail;
      // the sizing step places the crown a/2 below the top of wall, so faces on
      // top-clearance-governed vertices echo the sized width back (DCR = 1.0 by
      // construction, not a load check) — flag so governing selection skips them
      var govL = availL <= availR, govNode = govL ? (sg > 0 ? vnodes[sg - 1] : null) : (sg < segs.length - 1 ? vnodes[sg] : null);
      // AUDIT-FIXES C: sized-to-fit means the top-governed bound echoes the sizing back at
      // DCR = 1.0 exactly — top-governed segments with DCR < 1 are genuine load checks.
      segs[sg].byConstruction = !!(govNode && govNode.topGoverned && Math.abs(segs[sg].fitDcr - 1) <= 1e-6);
    }

    // equilibrium self-checks (closed-form model verified numerically)
    var maxRes = 0, sumP = st.W;
    function segVec(seg, atLeftEnd) {
      // force ON the joint from a compression member = pushes the joint away from the member
      var ux = Math.cos(seg.alphaRad), uy = Math.sin(seg.alphaRad);
      return atLeftEnd ? { x: -seg.F * ux, y: -seg.F * uy } : { x: seg.F * ux, y: seg.F * uy };
    }
    for (var nv = 0; nv < verts.length; nv++) {
      var fl = segVec(segs[nv], false), fr = segVec(segs[nv + 1], true);
      var rx = fl.x + fr.x, ry = fl.y + fr.y - verts[nv].P;
      maxRes = Math.max(maxRes, Math.hypot(rx, ry));
    }
    var f0 = segVec(segs[0], true); // on left support joint
    var resL = Math.hypot(f0.x + H, f0.y - (-st.RL) - 2 * st.RL + st.RL); // tie pulls +H; reaction +RL
    // explicit: sum at left support = seg push (−F cos, −F sin)+ tie (+H,0) + reaction (0,+RL)
    resL = Math.hypot(-segs[0].F * Math.cos(segs[0].alphaRad) + H, -segs[0].F * Math.sin(segs[0].alphaRad) + st.RL);
    var fN = segVec(segs[segs.length - 1], false);
    var resR = Math.hypot(fN.x - H, fN.y + st.RR);
    maxRes = Math.max(maxRes, resL, resR);
    var globalV = st.RL + st.RR - st.W;
    var globalM = st.RR * ctx.Ls; for (var gm = 0; gm < items.length; gm++) globalM -= items[gm].P * items[gm].x;
    var eqTol = 1e-8 * Math.abs(sumP) + 0.001;
    if (maxRes > eqTol || Math.abs(globalV) > eqTol || Math.abs(globalM) > eqTol * ctx.Ls)
      return { status: "not_converged", errors: [{ code: "EQUILIBRIUM", message: "internal equilibrium self-check failed (residual " + maxRes + " kip)" }] };

    var routed = routedForces(ctx, combo.D, combo.L);
    var RbL = st.RL + routed.L.total, RbR = st.RR + routed.R.total;

    return {
      status: "ok", errors: [],
      fce: fce, items: items, st: st, Mmax: Mmax, MmaxX: items[iMax].x, z: z, a: a, H: H, T: H,
      verts: verts, segs: segs, thetaL: thetaL, thetaR: thetaR, ha: ha, wsL: wsL, wsR: wsR,
      vnodes: vnodes, routed: routed, RbL: RbL, RbR: RbR,
      selfChecks: { maxNodeResidual_kip: maxRes, globalV_kip: globalV, globalM_kin: globalM, chordIters: chord.iters }
    };
  }

  // ------------------------------------------------- Case C run (PLAN §3)
  function solveC(ctx, combo, mask, betaInfo) {
    // solved in a frame with the overhang on the LEFT; ctx is pre-mirrored when needed.
    var fce = PHI_STM * 0.85 * betaInfo.betaS * ctx.fcKsi;
    var zt = ctx.zTop; // top-tie centroid above bottom-tie centroid
    if (zt <= GEOM_EPS) return { status: "geometry_infeasible", errors: [{ code: "ZTOP", message: "top tie at/below bottom tie" }] };

    // overhang loads (c measured from the overhang-side support centerline, > 0 outboard)
    var ov = [];
    ctx.overPts.L.forEach(function (p) {
      var Pf = combo.D * p.D + (mask.ov ? combo.L * p.L : 0);
      if (Pf > 0) ov.push({ P: Pf, c: ctx.xL - p.x, w: p.w, src: p.id });
    });
    if (ctx.hasUDL && !ctx.stripL.disperses) {
      // sub-strip beyond the bearing outer face -> N_UDL_OV overhang lumps
      var wo = combo.D * ctx.wD_pli + (mask.udl && mask.ov ? combo.L * ctx.wL_pli : (mask.ov && mask.udl === undefined ? 0 : 0));
      wo = combo.D * ctx.wD_pli + ((mask.udl && mask.ov) ? combo.L * ctx.wL_pli : 0);
      var oLen = ctx.stripL.o;
      if (wo > 0 && oLen > 0) {
        var ds = oLen / N_UDL_OV;
        for (var q = 0; q < N_UDL_OV; q++) {
          // lump q: centroid measured from wall end; c = distance to CL
          var xc = (q + 0.5) * ds;                    // from wall end
          ov.push({ P: wo * ds, c: ctx.xL - xc, w: ds, src: "OVUDL" + (q + 1) });
        }
      }
    }
    ov.sort(function (a, b) { return a.c - b.c; }); // ascending distance from support
    if (!ov.length) return { status: "no_admissible_stm", errors: [{ code: "CASEC_EMPTY", message: "Case C invoked with no overhang truss loads (" + combo.id + ")" }] };
    var Ttop = 0, Vov = 0;
    for (var i = 0; i < ov.length; i++) {
      ov[i].theta = deg(Math.atan2(zt, ov[i].c));
      if (ov[i].theta < THETA_MIN - 1e-9)
        return { status: "no_admissible_stm", errors: [{ code: "THETA_MIN", message: "overhang strut angle " + fmt(ov[i].theta, 2) + " deg < 25 deg" }] };
      ov[i].S = ov[i].P / Math.sin(rad(ov[i].theta));
      ov[i].Hcomp = ov[i].P * ov[i].c / zt;
      Ttop += ov[i].Hcomp; Vov += ov[i].P;
    }
    var Mov = Ttop * zt; // = sum P*c

    // backspan loads
    var items = buildSpanLoads(ctx, combo.D, combo.L, mask);
    if (!items.length) return { status: "no_admissible_stm", errors: [{ code: "NO_BACKSPAN", message: "Case C requires backspan truss loads (" + combo.id + ")" }] };
    var W = 0, Mo = 0;
    items.forEach(function (it) { W += it.P; Mo += it.P * it.x; });
    var RR = (Mo - Mov) / ctx.Ls;
    var RL = W + Vov - RR;
    if (RL < -1e-9 || RR < -1e-9) return { status: "no_admissible_stm", errors: [{ code: "NEG_REACTION", message: "negative reaction (" + combo.id + ")" }] };
    // true moment at each backspan abscissa (includes overhang hogging):
    // M(x) = RL*x - sum_ov P_i*(x + c_i) - sum_span P_j*(x - x_j) = (RL - Vov)*x - Mov - ...
    var M = [];
    for (var k = 0; k < items.length; k++) {
      var mk = (RL - Vov) * items[k].x - Mov;
      for (var j = 0; j < k; j++) mk -= items[j].P * (items[k].x - items[j].x);
      M.push(mk);
    }

    // N_a selection: first backspan load abscissa satisfying all angle guards (PLAN §3.2)
    var sel = null, selErrs = [];
    for (var c1 = 0; c1 < items.length; c1++) {
      var Mc = M[c1];
      if (Mc <= GEOM_EPS) { selErrs.push("M<=0 at candidate " + (c1 + 1)); continue; }
      var HR = Mc / zt, HL = HR + Ttop;
      var ys = [];
      var ok = true, why = "";
      for (var k2 = 0; k2 < items.length; k2++) {
        var y = (k2 <= c1) ? (M[k2] + Mov) / HL : M[k2] / HR;
        if (ctx.hp - y <= GEOM_EPS) { ok = false; why = "polygon vertex at/above top of wall"; break; }
        if (y < -GEOM_EPS) { ok = false; why = "polygon dips below tie"; break; }
        ys.push(y);
      }
      if (!ok) { selErrs.push("cand " + (c1 + 1) + ": " + why); continue; }
      // angles
      var polyPts = [{ x: 0, y: 0 }].concat(items.map(function (it, idx) { return { x: it.x, y: ys[idx] }; })).concat([{ x: ctx.Ls, y: 0 }]);
      var angs = [];
      for (var s3 = 0; s3 + 1 < polyPts.length; s3++) {
        var dx = polyPts[s3 + 1].x - polyPts[s3].x, dy = polyPts[s3 + 1].y - polyPts[s3].y;
        if (dx <= GEOM_EPS) { ok = false; why = "degenerate polygon segment"; break; }
        angs.push(deg(Math.atan2(dy, dx)));
      }
      if (!ok) { selErrs.push("cand " + (c1 + 1) + ": " + why); continue; }
      var thetaL2 = angs[0], thetaR2 = -angs[angs.length - 1];
      // guards: springings vs bottom tie; both polygon segments at N_a vs the horizontal top tie
      var aInto = Math.abs(angs[c1]);     // segment arriving at N_a from the support side
      var aOut = Math.abs(angs[c1 + 1]);  // segment leaving N_a toward the backspan
      if (thetaL2 < THETA_MIN - 1e-9 || thetaR2 < THETA_MIN - 1e-9 || aInto < THETA_MIN - 1e-9 || aOut < THETA_MIN - 1e-9) {
        selErrs.push("cand " + (c1 + 1) + ": angle guard"); continue;
      }
      sel = { iNa: c1, HR: HR, HL: HL, ys: ys, polyPts: polyPts, angs: angs, thetaL: thetaL2, thetaR: thetaR2 };
      break;
    }
    if (!sel) return { status: "no_admissible_stm", errors: [{ code: "NA_SELECT", message: "no admissible anchor vertex N_a (" + selErrs.join(" | ") + ") [" + combo.id + "]" }] };

    // ---- method of joints on the connected truss (PLAN §3.1)
    // nodes: A (overhang-side support), C (far support), ov nodes, backspan vertices
    var nodes = [], members = [];
    function addNode(id, x, y) { nodes.push({ id: id, x: x, y: y, loadY: 0 }); return nodes.length - 1; }
    var iA = addNode("A", 0, 0), iC = addNode("C", ctx.Ls, 0);
    var ovIdx = [];
    for (var o1 = 0; o1 < ov.length; o1++) ovIdx.push(addNode("ov" + (o1 + 1), -ov[o1].c, zt));
    var bsIdx = [];
    for (var b3 = 0; b3 < items.length; b3++) {
      var ni = addNode("bs" + (b3 + 1), items[b3].x, sel.ys[b3]);
      nodes[ni].loadY = -items[b3].P;
      bsIdx.push(ni);
    }
    for (var o2 = 0; o2 < ov.length; o2++) nodes[ovIdx[o2]].loadY = -ov[o2].P;
    function addMember(id, i1, i2, type) { members.push({ id: id, i1: i1, i2: i2, type: type }); }
    // overhang struts
    for (var o3 = 0; o3 < ov.length; o3++) addMember("strut.ov" + (o3 + 1), ovIdx[o3], iA, "strut");
    // segmented top tie: between adjacent overhang nodes (outer->inner) and across the support to N_a
    var iNaNode = bsIdx[sel.iNa];
    for (var o4 = ov.length - 1; o4 >= 1; o4--) addMember("ttop.ov" + (o4 + 1) + "-ov" + o4, ovIdx[o4], ovIdx[o4 - 1], "tie");
    addMember("ttop.ov1-Na", ovIdx[0], iNaNode, "tie");
    // compression polygon
    var chain = [iA].concat(bsIdx).concat([iC]);
    for (var c2 = 0; c2 + 1 < chain.length; c2++) addMember("arch." + c2, chain[c2], chain[c2 + 1], "strut");
    // bottom tie: one uninterrupted two-node member
    addMember("tie.bottom", iA, iC, "tie");

    var m = members.length, jN = nodes.length, r = 3;
    var strict = (m + r === 2 * jN);
    // assemble 2j equations; unknowns: member axials (+tension) then RAy, RCy, RAx
    var nUnk = m + 3, A = [], bb = [];
    for (var n1 = 0; n1 < jN; n1++) { A.push(new Array(nUnk).fill(0), new Array(nUnk).fill(0)); bb.push(0, 0); }
    for (var m1 = 0; m1 < members.length; m1++) {
      var mm = members[m1], p1 = nodes[mm.i1], p2 = nodes[mm.i2];
      var Lm = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      var ux = (p2.x - p1.x) / Lm, uy = (p2.y - p1.y) / Lm;
      A[2 * mm.i1][m1] += ux; A[2 * mm.i1 + 1][m1] += uy;
      A[2 * mm.i2][m1] -= ux; A[2 * mm.i2 + 1][m1] -= uy;
    }
    A[2 * iA][m + 2] = 1;      // RAx
    A[2 * iA + 1][m] = 1;      // RAy
    A[2 * iC + 1][m + 1] = 1;  // RCy
    for (var n2 = 0; n2 < jN; n2++) { bb[2 * n2] = 0; bb[2 * n2 + 1] = -nodes[n2].loadY; }
    var x = solveNormal(A, bb, nUnk);
    if (!x) return { status: "not_converged", errors: [{ code: "SINGULAR", message: "Case C joint system singular" }] };
    var resMax = 0, sumP = W + Vov;
    for (var rr2 = 0; rr2 < A.length; rr2++) {
      var acc = 0; for (var cc2 = 0; cc2 < nUnk; cc2++) acc += A[rr2][cc2] * x[cc2];
      resMax = Math.max(resMax, Math.abs(acc - bb[rr2]));
    }
    var eqTol = 1e-8 * Math.abs(sumP) + 0.001;
    if (resMax > eqTol) return { status: "not_converged", errors: [{ code: "EQUILIBRIUM", message: "Case C joint equilibrium residual " + resMax + " kip exceeds tolerance" }] };
    for (var m2 = 0; m2 < members.length; m2++) {
      members[m2].N = x[m2]; // + tension
      if (members[m2].type === "strut" && members[m2].N > 1e-6 * (1 + Math.abs(sumP)))
        return { status: "no_admissible_stm", errors: [{ code: "SIGN_FLIP", message: "strut " + members[m2].id + " solves to tension" }] };
      if (members[m2].type === "tie" && members[m2].N < -1e-6 * (1 + Math.abs(sumP)))
        return { status: "no_admissible_stm", errors: [{ code: "SIGN_FLIP", message: "tie " + members[m2].id + " solves to compression" }] };
    }
    var RAy = x[m], RCy = x[m + 1];

    // closed-form cross-checks
    function memberByIdC(id) { for (var qq = 0; qq < members.length; qq++) if (members[qq].id === id) return members[qq]; return null; }
    var tieB = memberByIdC("tie.bottom");
    var Tbot = tieB.N;
    // independent end derivations (PLAN §3.4): at A from H_left minus overhang strut horizontals;
    // at C from the far springing thrust.
    var arch0 = memberByIdC("arch.0"), archN = memberByIdC("arch." + (chain.length - 2));
    var HLsolved = -arch0.N * Math.cos(Math.atan2(nodes[chain[1]].y - 0, nodes[chain[1]].x - 0));
    var sumOvH = 0; ov.forEach(function (o) { sumOvH += o.Hcomp; });
    var TbotA = HLsolved - sumOvH;
    var aLast = Math.atan2(0 - nodes[chain[chain.length - 2]].y, ctx.Ls - nodes[chain[chain.length - 2]].x);
    var HRsolved = -archN.N * Math.cos(aLast);
    var TbotC = HRsolved;
    var idTol = 1e-6 * Math.max(1, Math.abs(Tbot)) + 1e-6;
    if (Math.abs(TbotA - TbotC) > Math.max(idTol, eqTol))
      return { status: "not_converged", errors: [{ code: "TIE_IDENTITY", message: "Case C bottom-tie end-force identity violated: " + TbotA + " vs " + TbotC }] };
    if (Math.abs(HLsolved - sel.HL) > 1e-6 * sel.HL + 1e-6 || Math.abs(HRsolved - sel.HR) > 1e-6 * sel.HR + 1e-6)
      return { status: "not_converged", errors: [{ code: "XCHECK", message: "joint solution disagrees with funicular closed form (HL " + HLsolved + " vs " + sel.HL + "; HR " + HRsolved + " vs " + sel.HR + ")" }] };

    // segments for band-fit checks
    var segs = [];
    for (var s4 = 0; s4 + 1 < chain.length; s4++) {
      var pA2 = nodes[chain[s4]], pB2 = nodes[chain[s4 + 1]];
      var al2 = Math.atan2(pB2.y - pA2.y, pB2.x - pA2.x);
      var F2 = -memberByIdC("arch." + s4).N;
      segs.push({ id: "arch." + s4, x1: pA2.x, y1: pA2.y, x2: pB2.x, y2: pB2.y, alphaRad: al2, alphaDeg: deg(al2), F: F2, wReq: F2 / (fce * ctx.tw), dVert: F2 / (fce * ctx.tw * Math.cos(al2)) });
    }
    var thetaL = segs[0].alphaDeg, thetaR = -segs[segs.length - 1].alphaDeg;

    var ha = 2 * ctx.yt;
    var wsR = ctx.lbR * Math.sin(rad(thetaR)) + ha * Math.cos(rad(thetaR));
    // overhang-side support node (B3): ONE physical zone — bearing subdivided in proportion
    // to arriving vertical components; sub-face x-ranges documented for drawing.
    var Vspr = sel.HL * Math.tan(rad(thetaL));
    var Vtot = Vspr + Vov;
    var subFaces = [];
    var lbCursor = 0; // sub-face layout across the bearing, from its outboard (overhang-side) edge
    function pushSub(name, member, lbSub, theta, F) {
      var w2 = lbSub * Math.sin(rad(theta)) + ha * Math.cos(rad(theta));
      subFaces.push({ name: name, member: member, lbSub: lbSub, lbFrom: lbCursor, lbTo: lbCursor + lbSub, width: w2, area: w2 * ctx.tw, force: F, stress: F / (w2 * ctx.tw) });
      lbCursor += lbSub;
      return w2;
    }
    // outboard (overhang) struts land nearest the overhang edge; springing segment inboard
    var wsL_spr;
    ov.forEach(function (o, oi) {
      o.wAvail = pushSub("strut(ov" + (oi + 1) + ")", "strut.ov" + (oi + 1), ctx.lbL * o.P / Vtot, o.theta, o.S);
    });
    wsL_spr = pushSub("strut(springing)", "arch.0", ctx.lbL * Vspr / Vtot, thetaL, segs[0].F);
    // B3: bearing sub-face widths must fit within the bearing (reject overlap)
    var lbSum = 0; subFaces.forEach(function (f) { lbSum += f.lbSub; });
    if (lbSum > ctx.lbL + 1e-9)
      return { status: "geometry_infeasible", errors: [{ code: "SUBFACE_OVERLAP", message: "support bearing sub-faces overlap (sum lbSub = " + fmt(lbSum, 3) + " in > lb = " + fmt(ctx.lbL, 3) + " in) [" + combo.id + "]" }] };
    // B3: top-tie face where T_top crosses the node region — width bounded by 2*ytTop
    var haTopSup = 2 * ctx.ytTop;
    subFaces.push({ name: "top tie face (T_top)", member: "ttop.ov1-Na", lbSub: 0, lbFrom: null, lbTo: null, width: haTopSup, area: haTopSup * ctx.tw, force: Ttop, stress: Ttop / (haTopSup * ctx.tw) });

    // vertex nodes for backspan vertices (N_a gets the tie back face added)
    var vnodes = [];
    for (var vb = 0; vb < items.length; vb++) {
      var vObj = { x: items[vb].x, y: sel.ys[vb], P: items[vb].P, w: items[vb].w, xAbs: ctx.xL + items[vb].x, yAbs: ctx.yt + sel.ys[vb], srcs: items[vb].srcs };
      var vn2 = vertexNode(ctx, vObj, segs[vb], segs[vb + 1]);
      if (vn2.error) return { status: vn2.error, errors: [{ code: "VNODE", message: vn2.msg + " [" + combo.id + "]" }] };
      vn2.v = vObj;
      if (vb === sel.iNa) {
        vn2.id = "node.Na"; vn2.cls = "CCT";
        // B2: tie back face bounded by BOTH the cover geometry (2*ytTop: N_a sits at the
        // top-bar centroid, ytTop below the top of wall) and the adjacent band depths (B1).
        var haTop = Math.min(2 * ctx.ytTop, vn2.haBand);
        if (vObj.yAbs + haTop / 2 > ctx.h + GEOM_EPS)
          return { status: "geometry_infeasible", errors: [{ code: "NA_TIEFACE", message: "N_a tie back face extends above the wall envelope [" + combo.id + "]" }] };
        // closure test including the tie face: the four-face polygon must still close
        var polyNa = clipHalfPlane(vn2.poly, function (x, y) { return y - (vObj.yAbs + haTop / 2); });
        if (polyNa.length < 3 || polyArea(polyNa) <= GEOM_EPS)
          return { status: "geometry_infeasible", errors: [{ code: "NA_CLOSURE", message: "N_a nodal zone does not close with the tie back face [" + combo.id + "]" }] };
        vn2.poly = polyNa;
        vn2.faces.push({ name: "tie back face (T_top)", width: haTop, area: haTop * ctx.tw, force: Ttop, stress: Ttop / (haTop * ctx.tw) });
      } else vn2.id = "node.vertex." + (vb + 1);
      vnodes.push(vn2);
    }
    for (var sg2 = 0; sg2 < segs.length; sg2++) {
      var avL = (sg2 === 0) ? wsL_spr : vnodes[sg2 - 1].faces[2].width;
      var avR = (sg2 === segs.length - 1) ? wsR : vnodes[sg2].faces[1].width;
      segs[sg2].wAvail = Math.min(avL, avR);
      segs[sg2].fitDcr = segs[sg2].wReq / segs[sg2].wAvail;
      var govL2 = avL <= avR, govNode2 = govL2 ? (sg2 > 0 ? vnodes[sg2 - 1] : null) : (sg2 < segs.length - 1 ? vnodes[sg2] : null);
      // AUDIT-FIXES C: same sized-to-fit predicate as Cases A/B (|fitDcr - 1| <= 1e-6)
      segs[sg2].byConstruction = !!(govNode2 && govNode2.topGoverned && Math.abs(segs[sg2].fitDcr - 1) <= 1e-6);
    }

    var routed = routedForces(ctx, combo.D, combo.L);
    var RbL = RAy + routed.L.total, RbR = RCy + routed.R.total;

    // global checks
    var globalV = RAy + RCy - sumP;
    if (Math.abs(globalV) > eqTol) return { status: "not_converged", errors: [{ code: "EQUILIBRIUM", message: "Case C global vertical equilibrium failed" }] };

    return {
      status: "ok", errors: [],
      fce: fce, items: items, Mmax: Math.max.apply(null, M), MmaxX: items[M.indexOf(Math.max.apply(null, M))].x,
      M: M, Mov: Mov, z: zt, a: null, H: sel.HL, T: Tbot, zt: zt,
      ov: ov, Ttop: Ttop, Tbot: Tbot, TbotA: TbotA, TbotC: TbotC, HL: sel.HL, HR: sel.HR,
      iNa: sel.iNa, NaX: items[sel.iNa].x, ys: sel.ys,
      segs: segs, thetaL: thetaL, thetaR: thetaR, ha: ha, wsL: wsL_spr, wsR: wsR,
      vnodes: vnodes, subFaces: subFaces, members: members, nodes: nodes,
      RL: RAy, RR: RCy, W: W + Vov, routed: routed, RbL: RbL, RbR: RbR,
      determinacy: { m: m, r: r, j: jN, strict: strict },
      selfChecks: { maxNodeResidual_kip: resMax, globalV_kip: globalV, globalM_kin: 0, tieIdentityDelta_kip: Math.abs(TbotA - TbotC) }
    };
  }

  // ------------------------------------------------- checks assembly (PLAN §5)
  function buildChecks(ctx, combo, mask, betaInfo, run) {
    var checks = [];
    var fnNode = function (betaN) { return PHI_STM * 0.85 * BETA_C * betaN * ctx.fcKsi; };
    var caseC = ctx.caseC;

    // deep-beam applicability — exact §9.9.1.1 boolean
    var ln = ctx.Ls - ctx.lbL / 2 - ctx.lbR / 2;
    var clauseA = ln <= 4 * ctx.h + 1e-9;
    var clauseB = false, minLoadDist = Infinity;
    var allPts = ctx.trussPts.concat(ctx.overPts.L, ctx.overPts.R);
    allPts.forEach(function (p) {
      var dl = Math.abs(p.x - (ctx.xL + ctx.lbL / 2));
      var dr = Math.abs((ctx.xR - ctx.lbR / 2) - p.x);
      var d = Math.min(dl, dr);
      minLoadDist = Math.min(minLoadDist, d);
      if (d <= 2 * ctx.h + 1e-9) clauseB = true;
    });
    var appRow = checkRow("applicability", "Deep-beam applicability (ln ≤ 4h or concentrated load within 2h)", "ACI 318-19 9.9.1.1 / 23.1",
      clauseA ? ln : (clauseB ? minLoadDist : ln), clauseA ? 4 * ctx.h : (clauseB ? 2 * ctx.h : 4 * ctx.h),
      { units: "in", contributions: [{ source: "clause", value: clauseA ? "(a) ln<=4h" : (clauseB ? "(b) concentrated load within 2h" : "none — NOT a deep beam") }] });
    appRow.pass = clauseA || clauseB;
    checks.push(appRow);

    // bottom tie
    checks.push(checkRow("tie.bottom", "Bottom tie φFnt ≥ T", "ACI 318-19 23.7.2 / 23.8.2",
      run.T, PHI_STM * ctx.tieBars.As * ctx.fy,
      { units: "kip", contributions: (run.items || []).map(function (it) { return { source: it.srcs.join("+"), value: it.P }; }) }));

    // strut band fit (AUDIT-FIXES C) — TWO rows:
    //  1. strut.fit        load-governed: max fitDcr over segments NOT sized-to-fit by construction
    //  2. strut.fit.crown  informational: crown segment(s) whose DCR = 1.0 by construction
    var worst = null, crown = null;
    run.segs.forEach(function (s) {
      if (s.byConstruction) { if (!crown || s.fitDcr > crown.fitDcr) crown = s; }
      else if (!worst || s.fitDcr > worst.fitDcr) worst = s;
    });
    if (!worst) run.segs.forEach(function (s) { if (!worst || s.fitDcr > worst.fitDcr) worst = s; });
    checks.push(checkRow("strut.fit", "Arch band fit (load-governed segment " + worst.id + ")", "ACI 318-19 23.4.3 / 23.5",
      worst.wReq, worst.wAvail,
      { units: "in", contributions: run.segs.map(function (s) { return { source: s.id + (s.byConstruction ? " (sized-to-fit by construction)" : ""), value: s.fitDcr, wReq: s.wReq, wAvail: s.wAvail, F: s.F, alphaDeg: s.alphaDeg }; }) }));
    if (crown) {
      var crownRow = checkRow("strut.fit.crown",
        "Crown band — sized to fit (informational): DCR ≈ 1.0 by construction — crown depth a is sized to the design stress and placed a/2 below the top of wall (segment " + crown.id + ")",
        "ACI 318-19 23.4.3 / 23.5 (sizing step)",
        crown.wReq, crown.wAvail,
        { units: "in", informational: true, state: "informational" });
      crownRow.pass = true;
      crownRow.nearLimit = false;
      checks.push(crownRow);
    }

    // support nodes
    function supportNodeCheck(side, ws, theta, lb, R_bearing, Fspr) {
      var betaN = 0.8; // CCT
      var lim = fnNode(betaN);
      var faces = [
        { name: "bearing", width: lb, area: lb * ctx.tNode, stress: R_bearing / (lb * ctx.tNode) },
        { name: "strut", width: ws, area: ws * ctx.tw, stress: Fspr / (ws * ctx.tw) },
        { name: "back (tie)", width: run.ha, area: run.ha * ctx.tNode, stress: run.T / (run.ha * ctx.tNode) }
      ];
      var wf = faces[0]; faces.forEach(function (f) { f.dcr = f.stress / lim; if (f.dcr > wf.dcr) wf = f; });
      var row = checkRow("node.support." + side, "Support nodal zone " + side + " (CCT, governing face: " + wf.name + ")", "ACI 318-19 23.9 / Table 23.9.2",
        wf.stress, lim, { units: "ksi", contributions: faces });
      checks.push(row);
      return faces;
    }
    // B4 FBD split: the NODE bearing face is equilibrated by the truss members alone
    // (bearing = strut vertical components; tie horizontal = strut horizontal), so it
    // carries the TRUSS reaction only. Loads routed directly to the pier bypass the node;
    // they stay in the separate §22.8 bearing check and its FBD chain (R_truss + routed).
    var facesL, facesR;
    if (!caseC) {
      facesL = supportNodeCheck("L", run.wsL, run.thetaL, ctx.lbL, run.st.RL, run.segs[0].F);
      facesR = supportNodeCheck("R", run.wsR, run.thetaR, ctx.lbR, run.st.RR, run.segs[run.segs.length - 1].F);
    } else {
      // overhang-side support: multi-face subdivided node (PLAN §3.5/§4)
      var betaNo = 0.8, limO = fnNode(betaNo);
      var facesO = run.subFaces.map(function (f) { return { name: f.name, width: f.width, area: f.area, stress: f.stress, dcr: f.stress / limO }; });
      facesO.push({ name: "bearing", width: ctx.lbL, area: ctx.lbL * ctx.tNode, stress: run.RL / (ctx.lbL * ctx.tNode), dcr: run.RL / (ctx.lbL * ctx.tNode) / limO });
      facesO.push({ name: "back (tie)", width: run.ha, area: run.ha * ctx.tNode, stress: run.Tbot / (run.ha * ctx.tNode), dcr: run.Tbot / (run.ha * ctx.tNode) / limO });
      var wfO = facesO[0]; facesO.forEach(function (f) { if (f.dcr > wfO.dcr) wfO = f; });
      checks.push(checkRow("node.support.L", "Overhang-side support nodal zone (subdivided multi-face, governing: " + wfO.name + ")", "ACI 318-19 23.9 / Table 23.9.2",
        wfO.stress, limO, { units: "ksi", contributions: facesO }));
      facesR = supportNodeCheck("R", run.wsR, run.thetaR, ctx.lbR, run.RR, run.segs[run.segs.length - 1].F);
    }

    // vertex nodes (incl N_a in Case C)
    var wv = null, wvNode = null;
    run.vnodes.forEach(function (vn) {
      var betaN = vn.cls === "CCC" ? 1.0 : (vn.cls === "CCT" ? 0.8 : 0.6);
      var lim = fnNode(betaN);
      vn.faces.forEach(function (f) { f.dcr = f.stress / lim; if (!wv || f.dcr > wv.dcr) { wv = f; wvNode = vn; } });
      vn.lim = lim;
    });
    if (wv) {
      var vid = (wvNode.id === "node.Na") ? "node.Na" : "node.vertex";
      checks.push(checkRow(vid, "Arch vertex node (" + wvNode.id + ", " + wvNode.cls + ", governing face: " + wv.name + ")", "ACI 318-19 23.9 / Table 23.9.2",
        wv.stress, wvNode.lim, {
          units: "ksi",
          contributions: run.vnodes.map(function (vn) { return { source: vn.id, cls: vn.cls, faces: vn.faces.map(function (f) { return { name: f.name, width: f.width, stress: f.stress, dcr: f.dcr }; }) }; })
        }));
      if (caseC && wvNode.id !== "node.Na") {
        // ensure the N_a node is also reported explicitly
        var na = null; run.vnodes.forEach(function (vn) { if (vn.id === "node.Na") na = vn; });
        if (na) {
          var wna = na.faces[0]; na.faces.forEach(function (f) { if (f.dcr > wna.dcr) wna = f; });
          checks.push(checkRow("node.Na", "Anchor vertex N_a nodal zone (CCT, governing face: " + wna.name + ")", "ACI 318-19 23.9 / Table 23.9.2",
            wna.stress, na.lim, { units: "ksi", contributions: na.faces }));
        }
      }
    }

    // pier bearing (§22.8) — separate from node strength; demand includes routed loads
    // (B4 FBD chain: bearing check keeps R_truss + routed; the node bearing face above
    // carries the truss reaction only).
    var brgCap = function (lb) { return PHI_BRG * 0.85 * ctx.fcKsi * lb * ctx.tNode; };
    // F1: flag when routed live load exists — it is kept ON in every LL pattern
    // (monotonic for bearing), so pattern labels alone would understate the demand basis.
    function routedLLExists(s) {
      var stripLen = run.routed[s].strip.len;
      if (ctx.wL_pli > 0 && stripLen > GEOM_EPS) return true;
      return ctx.routedPts[s].some(function (p) { return p.L > 0; });
    }
    var llTagL = routedLLExists("L") ? " (routed LL always applied)" : "";
    var llTagR = routedLLExists("R") ? " (routed LL always applied)" : "";
    checks.push(checkRow("bearing.L", "Pier bearing L (R + routed)" + llTagL, "ACI 318-19 22.8",
      run.RbL, brgCap(ctx.lbL), { units: "kip", contributions: [{ source: "R_truss", value: caseC ? run.RL : run.st.RL }, { source: "routed", value: run.routed.L.total }] }));
    checks.push(checkRow("bearing.R", "Pier bearing R (R + routed)" + llTagR, "ACI 318-19 22.8",
      run.RbR, brgCap(ctx.lbR), { units: "kip", contributions: [{ source: "R_truss", value: caseC ? run.RR : run.st.RR }, { source: "routed", value: run.routed.R.total }] }));
    // routed-load FBD chain: top bearing per routed point load
    ["L", "R"].forEach(function (s) {
      run.routed[s].pts.forEach(function (p) {
        checks.push(checkRow("bearing.topload." + p.id, "Routed load " + p.id + " top bearing on wall", "ACI 318-19 22.8",
          p.P, PHI_BRG * 0.85 * ctx.fcKsi * p.w * ctx.tw, { units: "kip" }));
      });
    });

    // anchorage (per end)
    var anL = anchorageEnd(ctx, "L", run.thetaL, caseC ? run.Tbot : run.T, run);
    var anR = anchorageEnd(ctx, "R", run.thetaR, caseC ? run.Tbot : run.T, run);
    checks.push(checkRow("anchorage.L", "Bottom-tie anchorage, left end (" + ctx.anchL.type + ")", "ACI 318-19 23.8.3 + Ch. 25",
      anL.req, anL.avail, { units: "in", contributions: [anL.detail], state: anL.state, forceFail: anL.forceFail }));
    checks.push(checkRow("anchorage.R", "Bottom-tie anchorage, right end (" + ctx.anchR.type + ")", "ACI 318-19 23.8.3 + Ch. 25",
      anR.req, anR.avail, { units: "in", contributions: [anR.detail], state: anR.state, forceFail: anR.forceFail }));
    run.anchorage = { left: anL.detail, right: anR.detail };

    if (caseC) {
      // top tie segments
      var maxT = null;
      run.members.forEach(function (mm) { if (mm.id.indexOf("ttop.") === 0 && (!maxT || mm.N > maxT.N)) maxT = mm; });
      checks.push(checkRow("tie.top", "Top tie segments (governing: " + maxT.id + ")", "ACI 318-19 23.7.2 / 23.8.2",
        maxT.N, PHI_STM * ctx.topBars.As * ctx.fy,
        { units: "kip", contributions: run.members.filter(function (mm) { return mm.id.indexOf("ttop.") === 0; }).map(function (mm) { return { source: mm.id, value: mm.N }; }) }));
      // overhang strut fit
      var wo2 = null;
      run.ov.forEach(function (o, oi) {
        o.wReq = o.S / (run.fce * ctx.tw);
        var haTop = 2 * ctx.ytTop;
        var wTopFace = o.w * Math.sin(rad(o.theta)) + haTop * Math.cos(rad(o.theta));
        o.wAvailMin = Math.min(o.wAvail, wTopFace);
        o.fitDcr = o.wReq / o.wAvailMin;
        if (!wo2 || o.fitDcr > wo2.fitDcr) wo2 = { id: "strut.ov" + (oi + 1), fitDcr: o.fitDcr, wReq: o.wReq, wAvail: o.wAvailMin };
      });
      checks.push(checkRow("strut.overhang", "Overhang strut fit (governing: " + wo2.id + ")", "ACI 318-19 23.4.3",
        wo2.wReq, wo2.wAvail, { units: "in", contributions: run.ov.map(function (o, oi) { return { source: "strut.ov" + (oi + 1), value: o.fitDcr, theta: o.theta, S: o.S }; }) }));
      // strut-tie angle checks (already guarded; reported)
      var minAng = Infinity;
      run.ov.forEach(function (o) { minAng = Math.min(minAng, o.theta); });
      minAng = Math.min(minAng, run.thetaL, run.thetaR, Math.abs(run.segs[run.iNa].alphaDeg), Math.abs(run.segs[run.iNa + 1].alphaDeg));
      checks.push(checkRow("angles.strutTie", "Minimum strut-tie angle", "ACI 318-19 23.2.7", THETA_MIN, minAng, { units: "deg" }));
      // free-end anchorage of the top tie (straight bars, stress-ratio scaled)
      var outer = run.ov[run.ov.length - 1];
      var segOuterId = run.ov.length >= 2 ? "ttop.ov" + run.ov.length + "-ov" + (run.ov.length - 1) : "ttop.ov1-Na";
      var Touter = 0;
      run.members.forEach(function (mm) { if (mm.id === segOuterId) Touter = mm.N; });
      var stT = ldStraight(ctx, ctx.topBars, { top: true, epoxy: false, cb: cbTop(ctx) });
      var ratioT = Math.min(1, Touter / (PHI_STM * ctx.topBars.As * ctx.fy));
      var reqFree = Math.max(stT.l * ratioT, 6);
      var availFree = (ctx.xL - outer.c) - ctx.coverSide; // node abscissa to wall end
      checks.push(checkRow("anchorage.freeEnd", "Top tie free-end development (outermost overhang node)", "ACI 318-19 25.4.2",
        reqFree, availFree, { units: "in", contributions: [{ source: "ld", value: stT.l, stressRatio: ratioT, segment: segOuterId }] }));
      run.anchorage.freeEnd = { required_in: reqFree, available_in: availFree, ld: stT.l, stressRatio: ratioT };
      // top-bar cutoff beyond N_a: max(d, 12db) plus development of remaining stress (25.4.2)
      var ratioNa = Math.min(1, run.Ttop / (PHI_STM * ctx.topBars.As * ctx.fy));
      var reqCut = Math.max(ctx.dTop, 12 * ctx.topBars.db) + stT.l * ratioNa;
      var availCut = (ctx.Lw - (ctx.xL + run.NaX)) - ctx.coverSide;
      checks.push(checkRow("anchorage.topCutoff", "Top-bar cutoff beyond N_a: max(d,12db) + development", "ACI 318-19 25.4.2 + PLAN §3.6",
        reqCut, availCut, { units: "in", contributions: [{ source: "max(d,12db)", value: Math.max(ctx.dTop, 12 * ctx.topBars.db) }, { source: "ld*ratio", value: stT.l * ratioNa }] }));
      run.anchorage.topCutoff = { required_in: reqCut, available_in: availCut };
      // bottom tie end-force identity (physics self-check, reported)
      var idRow = checkRow("tie.identity", "Case C bottom-tie end-force identity (T_bot,A = T_bot,C)", "PLAN §3.4 (statics identity)",
        Math.abs(run.TbotA - run.TbotC), 0.001 + 1e-6 * Math.abs(run.Tbot), { units: "kip", informational: true });
      idRow.state = "informational";
      checks.push(idRow);
    }

    // web reinforcement — BOTH reported separately (PLAN §5)
    var d5 = Math.min(ctx.dEff / 5, 12);
    var rhoMin = Math.min(betaInfo.rhoV, betaInfo.rhoH);
    var webRow = checkRow("web.min.9931", "Distributed web reinforcement minimums", "ACI 318-19 9.9.3.1",
      0.0025, rhoMin, { units: "ratio", contributions: [{ source: "rho_v", value: betaInfo.rhoV }, { source: "rho_h", value: betaInfo.rhoH }, { source: "s_max_allowed", value: d5 }] });
    if (ctx.webV.s > d5 + GEOM_EPS || ctx.webH.s > d5 + GEOM_EPS) { webRow.pass = false; webRow.state = "detailing does not fit"; }
    checks.push(webRow);
    var qRow = checkRow("web.qual.2351", "Table 23.5.1 βs qualification (" + (betaInfo.qualifies ? "βs = 0.75" : "βs = 0.4") + ")", "ACI 318-19 23.5 / Table 23.5.1",
      0.0025, rhoMin, { units: "ratio", informational: true });
    qRow.pass = true; qRow.state = "informational";
    checks.push(qRow);

    // global shear cap — explicit psi -> kips conversion
    var Vu = caseC ? Math.max(run.RL, run.RR) : Math.max(run.st.RL, run.st.RR);
    var Vcap = PHI_SHEAR * 10 * Math.sqrt(ctx.fc) * ctx.tw * ctx.dEff / 1000; // sqrt(psi)*in^2 = lb -> /1000 kips
    checks.push(checkRow("shear.cap", "Global shear cap Vu ≤ φ·10√f'c·bw·d", "ACI 318-19 9.9.2.1",
      Vu, Vcap, { units: "kip", contributions: [{ source: "sqrt(fc)_psi", value: Math.sqrt(ctx.fc) }, { source: "d_in", value: ctx.dEff }] }));

    // outboard strip mini load path (PLAN §1) — echoed in results, not only input help
    ["L", "R"].forEach(function (s) {
      var strip = s === "L" ? ctx.stripL : ctx.stripR;
      var isOverhangSide = caseC && s === "L"; // ctx pre-mirrored: overhang always L internally
      var wRun = combo.D * ctx.wD_pli + (mask.udl ? combo.L * ctx.wL_pli : 0);
      var dispRow = checkRow("strip." + s + ".dispersion", "Outboard strip " + s + " 45° dispersion/bearing footprint (o ≤ min(h_gb, lb))", "PLAN §1 (routing rule, AUDIT-FIXES E)",
        strip.o, strip.oLimit, { units: "in", contributions: [{ source: "strip_len", value: strip.len }, { source: "beyond_outer_face", value: strip.o }, { source: "h_gb", value: ctx.hgb }, { source: "lb", value: strip.lb }, { source: "limit_min(h_gb,lb)", value: strip.oLimit }] });
      if (isOverhangSide && !strip.disperses) { dispRow.pass = false; dispRow.state = "informational"; dispRow.informational = true; dispRow.label += " (FAILS — modeled as Case C overhang)"; }
      checks.push(dispRow);
      if (!isOverhangSide || strip.disperses) {
        var oEff = strip.o, Mu = wRun * oEff * oEff / 2, Vu2 = wRun * oEff;
        var aW = ctx.topBars.As * ctx.fy / (0.85 * ctx.fcKsi * ctx.tw);
        var phiMn = PHI_FLEX * ctx.topBars.As * ctx.fy * (ctx.dTop - aW / 2);
        checks.push(checkRow("strip." + s + ".moment", "Routed strip " + s + " cantilever moment vs top bars", "ACI 318-19 22.3 (via PLAN §1)",
          Mu, phiMn, { units: "kip-in" }));
        var phiVc = PHI_SHEAR * 2 * LAMBDA * Math.sqrt(ctx.fc) * ctx.tw * ctx.dTop / 1000;
        checks.push(checkRow("strip." + s + ".shear", "Routed strip " + s + " one-way shear at support face (no d-offset)", "ACI 318-19 22.5",
          Vu2, phiVc, { units: "kip" }));
        var stT2 = ldStraight(ctx, ctx.topBars, { top: true, epoxy: false, cb: cbTop(ctx) });
        var ratio2 = phiMn > 0 ? Math.min(1, Mu / phiMn) : 0;
        var reqDev = Math.max(stT2.l * ratio2, oEff > 0 ? 6 : 0);
        var availDev = (s === "L") ? (ctx.Lw - (ctx.xL - ctx.lbL / 2)) - ctx.coverSide : (ctx.xR + ctx.lbR / 2) - ctx.coverSide;
        checks.push(checkRow("strip." + s + ".dev", "Routed strip " + s + " top-bar development past support face", "ACI 318-19 25.4.2",
          reqDev, availDev, { units: "in", contributions: [{ source: "ld", value: stT2.l, stressRatio: ratio2 }] }));
      }
    });

    // detailing fit (PLAN §5 last row) — failures are "detailing does not fit"
    var n = ctx.tieBars.count, dbb = ctx.tieBars.db;
    if (n > 1) {
      var clear = (ctx.bgb - 2 * ctx.coverSide - n * dbb) / (n - 1);
      var minClear = Math.max(1, dbb);
      var spRow = checkRow("detailing.gbSpacing", "Tie bar clear spacing in b_gb", "ACI 318-19 25.2",
        minClear, clear, { units: "in" });
      if (!spRow.pass) spRow.state = "detailing does not fit";
      checks.push(spRow);
    }
    ["L", "R"].forEach(function (s) {
      var cfg = s === "L" ? ctx.anchL : ctx.anchR;
      if (cfg.type === "hook") {
        var reqV = 16 * dbb; // 12db tail + 4db bend outer radius (documented approximation)
        var availV = ctx.hgb - ctx.yt - ctx.coverBot;
        var hkRow = checkRow("detailing.hookTail." + s, "90° hook tail fits in h_gb (" + s + ")", "ACI 318-19 25.3",
          reqV, availV, { units: "in" });
        if (!hkRow.pass) hkRow.state = "detailing does not fit";
        checks.push(hkRow);
      }
      if (cfg.type === "headed") {
        var hdRow = checkRow("detailing.headClearance." + s, "Headed bar clearances (" + s + ")", "ACI 318-19 25.4.4.1",
          2 * dbb, Math.min(ctx.coverBot, ctx.coverSide), { units: "in" });
        if (!hdRow.pass) hdRow.state = "detailing does not fit";
        checks.push(hdRow);
      }
    });
    var efRow = checkRow("detailing.wallEF", "Wall EF bar spacing ≤ min(d/5, 12 in)", "ACI 318-19 9.9.3.1",
      Math.max(ctx.webV.s, ctx.webH.s), d5, { units: "in" });
    if (!efRow.pass) efRow.state = "detailing does not fit";
    checks.push(efRow);

    return checks;
  }

  // ------------------------------------------------- model for the drawing layer
  function buildModel(ctx, combo, mask, run, betaInfo) {
    var caseC = ctx.caseC;
    var model = {
      combo: combo.id, pattern: maskId(mask), caseLabel: caseC ? "C" : (isSymmetric(ctx) ? "A" : "B"),
      Ls_in: ctx.Ls, h_in: ctx.h, hp_in: ctx.hp, yt_in: ctx.yt, z_in: run.z, a_in: run.a,
      H_kip: run.H, T_kip: run.T, Mmax_kin: run.Mmax, MmaxX_in: run.MmaxX,
      wu_klf: (combo.D * ctx.wD_pli + (mask.udl ? combo.L * ctx.wL_pli : 0)) * 12,
      thetaL_deg: run.thetaL, thetaR_deg: run.thetaR,
      AsTie_in2: ctx.tieBars.As, AsTop_in2: ctx.topBars.As,
      betaS: betaInfo.betaS, fce_ksi: run.fce,
      ha_in: run.ha, wsL_in: run.wsL, wsR_in: run.wsR,
      RtL_kip: caseC ? run.RL : run.st.RL, RtR_kip: caseC ? run.RR : run.st.RR,
      RbL_kip: run.RbL, RbR_kip: run.RbR,
      nodes: [], members: [], arch: [], bands: [], nodePolygons: [],
      anchorage: run.anchorage, routed: run.routed, selfChecks: run.selfChecks
    };
    var x0 = ctx.xL, yTie = ctx.yt;
    if (!caseC) {
      model.nodes.push({ id: "SL", x: x0, y: yTie, type: "support" });
      model.arch.push({ x: x0, y: yTie });
      run.verts.forEach(function (v, i) {
        model.nodes.push({ id: "V" + (i + 1), x: v.xAbs, y: v.yAbs, type: "vertex" });
        model.arch.push({ x: v.xAbs, y: v.yAbs });
      });
      model.nodes.push({ id: "SR", x: ctx.xR, y: yTie, type: "support" });
      model.arch.push({ x: ctx.xR, y: yTie });
      run.segs.forEach(function (s, i) {
        var from = i === 0 ? "SL" : "V" + i, to = i === run.segs.length - 1 ? "SR" : "V" + (i + 1);
        model.members.push({ id: s.id, type: "strut", from: from, to: to, force_kip: -s.F });
        model.bands.push({ segId: s.id, wReq_in: s.wReq, dVert_in: s.dVert, wAvail_in: s.wAvail, fitDcr: s.fitDcr, alphaDeg: s.alphaDeg });
      });
      model.members.push({ id: "tie.bottom", type: "tie", from: "SL", to: "SR", force_kip: run.T });
      run.verts.forEach(function (v, i) {
        model.members.push({ id: "vert." + (i + 1), type: "vertical", from: "V" + (i + 1) + "top", to: "V" + (i + 1), force_kip: -v.P, width_in: v.w, srcs: v.srcs });
      });
      run.vnodes.forEach(function (vn) {
        model.nodePolygons.push({ id: vn.id, cls: vn.cls, poly: vn.poly, faces: vn.faces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.area, stress_ksi: f.stress, dcr: f.dcr }; }) });
      });
    } else {
      model.overhangSide = ctx.mirrored ? "right" : "left";
      model.zTop_in = run.zt; model.Ttop_kip = run.Ttop; model.Tbot_kip = run.Tbot;
      model.HL_kip = run.HL; model.HR_kip = run.HR;
      model.Na = { x: x0 + run.NaX, y: yTie + run.zt, xSpan_in: run.NaX };
      model.determinacy = run.determinacy;
      run.nodes.forEach(function (nd) {
        model.nodes.push({ id: nd.id, x: x0 + nd.x, y: yTie + nd.y, type: nd.id === "A" || nd.id === "C" ? "support" : (nd.id.indexOf("ov") === 0 ? "overhang" : "vertex") });
      });
      model.arch.push({ x: x0, y: yTie });
      run.segs.forEach(function (s) { model.arch.push({ x: x0 + s.x2, y: yTie + s.y2 }); });
      run.members.forEach(function (mm) {
        model.members.push({ id: mm.id, type: mm.type, from: run.nodes[mm.i1].id, to: run.nodes[mm.i2].id, force_kip: mm.N });
      });
      run.segs.forEach(function (s) {
        model.bands.push({ segId: s.id, wReq_in: s.wReq, dVert_in: s.dVert, wAvail_in: s.wAvail, fitDcr: s.fitDcr, alphaDeg: s.alphaDeg });
      });
      run.vnodes.forEach(function (vn) {
        model.nodePolygons.push({ id: vn.id, cls: vn.cls, poly: vn.poly, faces: vn.faces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.area, stress_ksi: f.stress, dcr: f.dcr }; }) });
      });
      model.nodePolygons.push({
        id: "node.support.ov", cls: "CCT-multiface",
        poly: [[x0 - ctx.lbL / 2, 0], [x0 + ctx.lbL / 2, 0], [x0 + ctx.lbL / 2, run.ha], [x0 - ctx.lbL / 2, run.ha]],
        // B3: sub-face layout documented for drawing — lbFrom/lbTo measured across the
        // bearing from its outboard (overhang-side) edge; the top-tie face has no bearing strip.
        faces: run.subFaces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.area, stress_ksi: f.stress, lbSub_in: f.lbSub, lbFrom_in: f.lbFrom, lbTo_in: f.lbTo }; })
      });
    }
    // support node polygons (both cases; simple rectangles bearing x ha for drawing)
    model.nodePolygons.push({
      id: "node.support.L", cls: caseC ? "CCT-multiface" : "CCT",
      poly: [[ctx.xL - ctx.lbL / 2, 0], [ctx.xL + ctx.lbL / 2, 0], [ctx.xL + ctx.lbL / 2, run.ha], [ctx.xL - ctx.lbL / 2, run.ha]],
      faces: [{ name: "bearing", width_in: ctx.lbL, Acn_in2: ctx.lbL * ctx.tNode }, { name: "strut", width_in: run.wsL, Acn_in2: run.wsL * ctx.tw }, { name: "back (tie)", width_in: run.ha, Acn_in2: run.ha * ctx.tNode }]
    });
    model.nodePolygons.push({
      id: "node.support.R", cls: "CCT",
      poly: [[ctx.xR - ctx.lbR / 2, 0], [ctx.xR + ctx.lbR / 2, 0], [ctx.xR + ctx.lbR / 2, run.ha], [ctx.xR - ctx.lbR / 2, run.ha]],
      faces: [{ name: "bearing", width_in: ctx.lbR, Acn_in2: ctx.lbR * ctx.tNode }, { name: "strut", width_in: run.wsR, Acn_in2: run.wsR * ctx.tw }, { name: "back (tie)", width_in: run.ha, Acn_in2: run.ha * ctx.tNode }]
    });
    return model;
  }

  function isSymmetric(ctx) {
    if (Math.abs(ctx.xL - (ctx.Lw - ctx.xR)) > 1e-9) return false;
    if (Math.abs(ctx.lbL - ctx.lbR) > 1e-9 || Math.abs(ctx.eL - ctx.eR) > 1e-9) return false;
    if (ctx.points.length === 0) return true;
    var pts = ctx.points.slice().map(function (p) { return { x: p.x, D: p.D, L: p.L, w: p.w }; });
    for (var i = 0; i < pts.length; i++) {
      var mir = ctx.Lw - pts[i].x, found = false;
      for (var j = 0; j < pts.length; j++) {
        if (Math.abs(pts[j].x - mir) < 1e-6 && Math.abs(pts[j].D - pts[i].D) < 1e-9 && Math.abs(pts[j].L - pts[i].L) < 1e-9) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  // ------------------------------------------------- patterns
  function liveComponents(ctx) {
    var comps = [];
    if (ctx.wL_pli > 0) comps.push({ id: "udl" });
    ctx.trussPts.forEach(function (p) { if (p.L > 0) comps.push({ id: p.id }); });
    var ovLL = false;
    ["L", "R"].forEach(function (s) { ctx.overPts[s].forEach(function (p) { if (p.L > 0) ovLL = true; }); });
    if (ctx.caseC && (ovLL || (ctx.wL_pli > 0 && !ctx.stripL.disperses))) comps.push({ id: "ov" });
    return comps;
  }
  function maskFromBits(comps, bits) {
    var mask = { udl: false, pts: {}, ov: false, bits: [] };
    comps.forEach(function (c, i) {
      var on = !!(bits & (1 << i));
      mask.bits.push(c.id + (on ? ":1" : ":0"));
      if (c.id === "udl") mask.udl = on;
      else if (c.id === "ov") mask.ov = on;
      else mask.pts[c.id] = on;
    });
    return mask;
  }
  function maskAllOn(comps) { return maskFromBits(comps, (1 << comps.length) - 1); }
  function maskId(mask) { return mask.bits.length ? "LL[" + mask.bits.join(",") + "]" : "D-only"; }

  // ------------------------------------------------- mirror (Case C right overhang)
  function mirrorCtx(ctx) {
    var m = cloneJSON(ctx);
    m.xL = ctx.Lw - ctx.xR; m.xR = ctx.Lw - ctx.xL;
    m.lbL = ctx.lbR; m.lbR = ctx.lbL; m.eL = ctx.eR; m.eR = ctx.eL;
    m.anchL = ctx.anchR; m.anchR = ctx.anchL;
    m.points = ctx.points.map(function (p) { var q = cloneJSON(p); q.x = ctx.Lw - p.x; return q; });
    m.mirrored = true;
    return m;
  }
  function unmirrorX(x, Lw) { return Lw - x; }
  function unmirrorModel(model, Lw) {
    model.nodes.forEach(function (n) { n.x = unmirrorX(n.x, Lw); });
    model.arch.forEach(function (p) { p.x = unmirrorX(p.x, Lw); });
    model.arch.reverse();
    model.nodePolygons.forEach(function (np) {
      np.poly.forEach(function (pt) { pt[0] = unmirrorX(pt[0], Lw); });
      if (np.id === "node.support.L") np.id = "node.support.R.__tmp";
      else if (np.id === "node.support.R") np.id = "node.support.L";
    });
    model.nodePolygons.forEach(function (np) { if (np.id === "node.support.R.__tmp") np.id = "node.support.R"; });
    if (model.Na) { model.Na.x = unmirrorX(model.Na.x, Lw); }
    if (model.MmaxX_in !== undefined) model.MmaxX_in = model.Ls_in - model.MmaxX_in;
    if (model.Na && model.Na.xSpan_in !== undefined) model.Na.xSpan_in = model.Ls_in - model.Na.xSpan_in;
    var t;
    t = model.thetaL_deg; model.thetaL_deg = model.thetaR_deg; model.thetaR_deg = t;
    t = model.RtL_kip; model.RtL_kip = model.RtR_kip; model.RtR_kip = t;
    t = model.RbL_kip; model.RbL_kip = model.RbR_kip; model.RbR_kip = t;
    t = model.wsL_in; model.wsL_in = model.wsR_in; model.wsR_in = t;
    if (model.anchorage) { t = model.anchorage.left; model.anchorage.left = model.anchorage.right; model.anchorage.right = t; }
    if (model.routed) { t = model.routed.L; model.routed.L = model.routed.R; model.routed.R = t; }
    return model;
  }
  function unmirrorCheckId(id) {
    if (/\.L($|\.)/.test(id)) return id.replace(/\.L($|\.)/, ".R$1");
    if (/\.R($|\.)/.test(id)) return id.replace(/\.R($|\.)/, ".L$1");
    return id;
  }

  // ------------------------------------------------- run()
  function run(inputs) {
    var norm = normalize(inputs);
    if (norm.errors.length) return { status: "invalid_input", errors: norm.errors, results: null };
    var ctx = norm.ctx;
    var clsErrs = classify(ctx);
    if (clsErrs.length) return { status: "invalid_input", errors: clsErrs, results: null };

    if (ctx.caseC && ctx.overSide === "R") {
      var mctx = mirrorCtx(ctx);
      var e2 = classify(mctx);
      if (e2.length) return { status: "invalid_input", errors: e2, results: null };
      mctx.mirrored = true;
      ctx = mctx;
      if (!(ctx.caseC && ctx.overSide === "L")) return { status: "invalid_input", errors: [{ code: "MIRROR", message: "internal: mirror classification failed" }], results: null };
    }

    var betaInfo = webReinf(ctx);
    var comps = liveComponents(ctx);
    var runs = [];
    for (var c = 0; c < ctx.combos.length; c++) {
      var combo = ctx.combos[c];
      var masks = [];
      if (combo.L > 0 && comps.length) {
        for (var b = 0; b < (1 << comps.length); b++) masks.push(maskFromBits(comps, b));
      } else masks.push(maskFromBits([], 0)); // 1.4D carries no LL patterns (noted)
      for (var mI = 0; mI < masks.length; mI++) {
        var mk = masks[mI];
        var sol = ctx.caseC ? solveC(ctx, combo, mk, betaInfo) : solveAB(ctx, combo, mk, betaInfo);
        if (sol.status !== "ok") {
          // a run with zero truss load under an all-off pattern is legitimately skipped
          if (sol.errors.length && sol.errors[0].code === "NO_TRUSS_LOAD" && (mk.bits.length && !anyOn(mk))) continue;
          return { status: sol.status, errors: sol.errors.map(function (e) { e.combo = combo.id; e.pattern = maskId(mk); return e; }), results: null };
        }
        sol.combo = combo; sol.mask = mk;
        sol.checks = buildChecks(ctx, combo, mk, betaInfo, sol);
        runs.push(sol);
      }
    }
    function anyOn(mask) { return mask.udl || mask.ov || Object.keys(mask.pts).some(function (k) { return mask.pts[k]; }); }
    if (!runs.length) return { status: "no_admissible_stm", errors: [{ code: "NO_RUNS", message: "no computable combination/pattern" }], results: null };

    // envelope per check id
    var env = {};
    runs.forEach(function (r2) {
      r2.checks.forEach(function (ch) {
        var key = ch.id;
        // envelope on DCR; among numerically equal DCRs keep the larger absolute demand
        // (deterministic — matters for rows whose DCR is 1.0 by construction, e.g. strut.fit.crown)
        var tie = env[key] && Math.abs(ch.dcr - env[key].dcr) <= 1e-12 && ch.demand > env[key].demand + 1e-15;
        if (!env[key] || ch.dcr > env[key].dcr + 1e-15 || tie) {
          var row = cloneJSON(ch);
          row.governingCombo = r2.combo.id;
          row.governingPattern = maskId(r2.mask);
          env[key] = row;
        }
      });
    });
    var checks = Object.keys(env).map(function (k) { return env[k]; });

    // reference model: combo with max total factored load, all-live-on pattern
    var ref = null, refScore = -Infinity;
    runs.forEach(function (r2) {
      var full = comps.length === 0 || (r2.combo.L > 0 ? r2.mask.bits.every(function (b2) { return /:1$/.test(b2); }) : true);
      if (!full && r2.combo.L > 0) return;
      var score = r2.combo.D + r2.combo.L;
      var W = ctx.caseC ? r2.W : r2.st.W;
      if (W > refScore) { refScore = W; ref = r2; }
    });
    if (!ref) ref = runs[runs.length - 1];
    var model = buildModel(ctx, ref.combo, ref.mask, ref, betaInfo);
    // F2: min tie steel for D/C = 1.0 computed HERE (engine), from the ENVELOPED governing
    // tie demand — the UI renders this verbatim and performs no arithmetic of its own.
    if (env["tie.bottom"]) model.AsReq_tie_in2 = env["tie.bottom"].demand / (PHI_STM * ctx.fy);

    var patterns = runs.map(function (r2) {
      return {
        combo: r2.combo.id, pattern: maskId(r2.mask),
        Mmax_kin: r2.Mmax, MmaxX_in: ctx.mirrored ? ctx.Ls - r2.MmaxX : r2.MmaxX,
        H_kip: r2.H, T_kip: r2.T, z_in: r2.z, a_in: r2.a,
        thetaL_deg: ctx.mirrored ? r2.thetaR : r2.thetaL, thetaR_deg: ctx.mirrored ? r2.thetaL : r2.thetaR,
        RtL_kip: ctx.mirrored ? (ctx.caseC ? r2.RR : r2.st.RR) : (ctx.caseC ? r2.RL : r2.st.RL),
        RtR_kip: ctx.mirrored ? (ctx.caseC ? r2.RL : r2.st.RL) : (ctx.caseC ? r2.RR : r2.st.RR)
      };
    });

    if (ctx.mirrored) {
      unmirrorModel(model, ctx.Lw);
      checks.forEach(function (ch) { ch.id = unmirrorCheckId(ch.id); });
    }

    var states = [];
    checks.forEach(function (ch) { if (ch.state === "detailing does not fit" && states.indexOf(ch.state) < 0) states.push(ch.state); });
    var governing = null;
    checks.forEach(function (ch) { if (!ch.informational && (!governing || ch.dcr > governing.dcr)) governing = ch; });
    var allPass = checks.every(function (ch) { return ch.informational || ch.pass; });

    return {
      status: "ok",
      errors: [],
      results: {
        caseLabel: model.caseLabel,
        betaS: { value: betaInfo.betaS, qualifies: betaInfo.qualifies, rhoV: betaInfo.rhoV, rhoH: betaInfo.rhoH },
        combosRun: ctx.combos.map(function (cb) { return cb.id; }),
        patterns: patterns,
        checks: checks,
        summary: { pass: allPass && states.length === 0, governing: governing ? { id: governing.id, dcr: governing.dcr } : null, states: states },
        model: model
      }
    };
  }

  return { run: run, format: fmt, VERSION: VERSION };
});
