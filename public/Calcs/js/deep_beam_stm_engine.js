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
 *   TEST-ONLY OPTIONS ARE GUARDED (R4.7): pinZ_in / tieCentroid_in / tieWidthLimit are honored
 *   ONLY when the engine is loaded as a CommonJS module (the Node fixture harness) or when the
 *   caller sets options.allowTestOnly === true. Under the shipped browser build they are
 *   REJECTED with INVALID_INPUT naming the option, so a future JSON-import path on the page
 *   cannot silently disable a code check. When they ARE applied the engine echoes them in
 *   results.model.testOnlyOptions so they are never silent.
 *
 *   options.tieWidthLimit    — DEFAULTS TO TRUE. Set false to DISABLE the ACI 318-19 §23.8.2
 *                              effective-tie-width cap (w_t = 2*ybar_t, uncapped). Test-only,
 *                              and used in exactly one place: the FHWA-NHI-17-071 authority
 *                              example is an AASHTO LRFD §5.8.2 example, AASHTO has no §23.8.2
 *                              equivalent, and its published node geometry uses the full
 *                              2*ybar_t back face. Consequence: that fixture does NOT validate
 *                              the §23.8.2 band feature — tie_width_band.json does, and is the
 *                              only evidence for it. See the comment block at the
 *                              tieWidthLimit line in tools/test-deep-beam-stm.mjs.
 *
 * CODE-TEXT VERIFICATION FLAGS (PLAN "Risks" + FEATURES-v2 §R4.6): the exact ACI 318-19 wording
 * of each of the following is implemented per the plan's stated intended forms and MUST be
 * verified against a licensed copy before the registry entry may claim "ready":
 *   - §9.9.1.1                deep-beam applicability (both clauses)
 *   - Table 23.5.1            beta_s for struts with distributed reinforcement
 *   - Table 25.4.3.2          psi_r for hooked bars (both disjuncts)
 *   - §25.4.4.1               headed-bar applicability limits
 *   - §23.8.2                 effective tie width w_t <= F_nt/(f_ce*b_s). Some printings carry
 *                             the w_t,max form in commentary R23.8.1 rather than in the section
 *                             body; the wording AND its placement must both be confirmed.
 *   - §9.7.3.8.4              flexural bar extension max(d, 12db) past the cut-off point
 *                             (used ONLY as the informational B-region comparison row)
 *   - §25.5.2                 Class B tension lap = 1.3*ld (bottom-bar splice over the piers)
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

    // ---- FEATURE 2 / F2.1 — Case D geometry is DERIVED, not entered ------------------------
    // Equal spans, equal bearings. Pier CLs at x_i = l_b/2 + i*L (i = 0..nSpans);
    // L_w = nSpans*L + l_b, so the wall ends flush with the outer bearing faces and the strip
    // from each end-pier CL to the wall end (length l_b/2) has o = 0 BY CONSTRUCTION — it lies
    // outside the CL-to-CL analysis span and routes straight into the end bearing.
    var cD = inputs.caseD || null;
    if (cD) {
      var nSpD = cD.nSpans, LspD = cD.L_ft, lbD = cD.lb_in;
      if (!isNum(nSpD) || nSpD !== Math.floor(nSpD) || nSpD < 2 || nSpD > 5)
        err(errors, "INPUT", "caseD.nSpans must be an integer 2..5");
      if (!isNum(LspD) || LspD <= 0) err(errors, "INPUT", "caseD.L_ft must be > 0");
      if (!isNum(lbD) || lbD < 0.5) err(errors, "INPUT", "caseD.lb_in must be >= 0.5");
      if ((isNum(g.e_L_in) && g.e_L_in > 0) || (isNum(g.e_R_in) && g.e_R_in > 0))
        err(errors, "SCOPE", "Case D does not support grade-beam extensions, outboard strips or overhangs (F2.1) — set e_L_in = e_R_in = 0");
      if (((inputs.loads || {}).pointLoads || []).length)
        err(errors, "SCOPE", "Case D takes one midspan point load per span through caseD.spanPoint[]; loads.pointLoads is not supported (F2.1)");
      if (errors.length) return { errors: errors };
      var LwD = nSpD * LspD * 12 + lbD;
      var gD = {};
      for (var gk in g) if (Object.prototype.hasOwnProperty.call(g, gk)) gD[gk] = g[gk];
      gD.L_w_ft = LwD / 12;
      gD.x_L_ft = (lbD / 2) / 12;
      gD.x_R_ft = (LwD - lbD / 2) / 12;
      gD.lb_L_in = lbD; gD.lb_R_in = lbD; gD.e_L_in = 0; gD.e_R_in = 0;
      g = gD;
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
      return { count: count, rowCount: count, size: size, db: BARS[size].db, Ab: BARS[size].Ab, As: count * BARS[size].Ab };
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

    // ---- F1.2 multi-layer tie input (OPTIONAL; overrides tieBars when present) --------------
    // reinf.tieLayers = [ { count, size, y_in }, ... ], y_in = layer centroid above the BOTTOM
    // of the grade beam. A_s = sum of layers, ybar_t = area-weighted centroid. Without this the
    // §23.8.2 band-membership test is true by construction (one layer is always its own centroid).
    // Validation: >= 2 bars per layer, every layer inside the GB less covers (bottom clear cover
    // = cover_bot_in, top-of-GB clear cover = cover_top_in), layers ordered bottom -> top, no
    // duplicate y. Aggregate governing bar size = the largest db present (governs development
    // and detailing); rowCount = the largest single-layer count (governs in-row bar spacing).
    var tieLayers = null;
    if (Array.isArray(rf.tieLayers) && rf.tieLayers.length) {
      tieLayers = [];
      var sumAsL = 0, sumAsYL = 0, govDbL = 0, govSizeL = null, rowCountL = 0, prevYL = -Infinity;
      for (var tl = 0; tl < rf.tieLayers.length; tl++) {
        var Ly = rf.tieLayers[tl] || {};
        var lname = "tieLayers[" + tl + "]";
        var lsize = Ly.size || "#8";
        if (!BARS[lsize]) { err(errors, "REINF", lname + " bar size unknown: " + lsize); lsize = "#8"; }
        var lcount = isNum(Ly.count) ? Ly.count : 0;
        if (lcount < 2 || lcount !== Math.floor(lcount)) err(errors, "INVALID_INPUT", lname + ".count must be an integer >= 2");
        var ldb = BARS[lsize].db, lAs = lcount * BARS[lsize].Ab;
        var ly = Ly.y_in;
        if (!isNum(ly)) { err(errors, "INVALID_INPUT", lname + ".y_in required (layer centroid above bottom of grade beam)"); ly = 0; }
        else {
          var loLim = coverBot + ldb / 2, hiLim = hgb - coverTop - ldb / 2;
          if (ly < loLim - GEOM_EPS || ly > hiLim + GEOM_EPS)
            err(errors, "INVALID_INPUT", lname + ".y_in = " + fmt(ly, 4) + " in must lie between " + fmt(loLim, 4) + " and " + fmt(hiLim, 4) + " in (inside the grade beam less covers)");
          if (ly <= prevYL + GEOM_EPS)
            err(errors, "INVALID_INPUT", lname + ".y_in must be strictly greater than the previous layer (layers ordered bottom to top, no duplicate y)");
          prevYL = ly;
        }
        if (2 * coverSide + lcount * ldb > bgb + GEOM_EPS)
          err(errors, "INVALID_INPUT", lname + " bars do not fit within b_gb (2*cover_side + count*db > b_gb)");
        tieLayers.push({ count: lcount, size: lsize, db: ldb, Ab: BARS[lsize].Ab, As: lAs, y: ly });
        sumAsL += lAs; sumAsYL += lAs * ly;
        if (ldb > govDbL) { govDbL = ldb; govSizeL = lsize; }
        if (lcount > rowCountL) rowCountL = lcount;
      }
      if (sumAsL > 0) {
        tieBars = {
          count: tieLayers.reduce(function (s, L) { return s + L.count; }, 0),
          rowCount: rowCountL, size: govSizeL, db: govDbL, Ab: BARS[govSizeL].Ab,
          As: sumAsL, layers: tieLayers, ybar: sumAsYL / sumAsL
        };
      }
    }
    var tieRowN = tieBars.rowCount || tieBars.count;

    // D2 (AUDIT-FIXES): cover geometry that cannot fit is rejected up front. The GB mid-depth
    // rule is a BOTTOM-LAYER fit rule (the lowest layer must clear the bottom cover and sit in
    // the lower half); a multi-layer tie may legitimately have its CENTROID above mid-depth —
    // that is exactly the configuration the F1.4 band check is there to judge.
    if (coverBot + (tieLayers ? tieLayers[0].db : tieBars.db) / 2 >= hgb / 2 - GEOM_EPS)
      err(errors, "INVALID_INPUT", "tie centroid must lie below grade-beam mid-depth (cover_bot + db/2 < h_gb/2)");
    // R4.3 — the cover-based test above only proves a bottom layer COULD fit low; with
    // reinf.tieLayers the engineer states the actual y of each layer, and nothing forced the
    // LOWEST one to be low. Without this guard a single layer at y = 20 in a 24 in grade beam,
    // or a two-layer tie at y = 13/21, returns `ok` with tie.width PASS — a tie band nowhere
    // near the bearing, reported as passing, and reachable straight from the shipped UI. The
    // bottom tie is the funicular chord that anchors into the CCT nodal zone directly above the
    // bearing; its lowest layer must sit in the lower half of the grade beam for that node (and
    // for lever arm z = h - ybar_t) to mean anything.
    if (tieLayers && tieLayers[0].y >= hgb / 2 - GEOM_EPS)
      err(errors, "INVALID_INPUT", "lowest tie layer y_in = " + fmt(tieLayers[0].y, 4) + " in must lie below grade-beam mid-depth (h_gb/2 = " +
        fmt(hgb / 2, 4) + " in). The bottom tie anchors into the nodal zone above the bearing, so its lowest layer has to be in the lower half of the grade beam — lower the first layer, or model the upper steel as a separate tie.");
    if (2 * coverSide + tieRowN * tieBars.db > bgb + GEOM_EPS)
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

    // ---- R4.7 test-only option GUARD -------------------------------------------------------
    // pinZ_in / tieCentroid_in / tieWidthLimit bypass or disable real code checks. They exist for
    // the authority-validation harness only, and until now were honored from ANY caller's
    // inputs.options — unreachable from today's UI, but a future "import a saved input JSON"
    // path on the page would have silently accepted `{"options":{"tieWidthLimit":false}}` and
    // switched off §23.8.2. Gate them on the load context: the CommonJS branch of the UMD
    // wrapper is the Node fixture harness; the browser build gets `module === undefined` and
    // rejects. A deliberate non-Node caller can still opt in with options.allowTestOnly = true.
    // No DOM is touched — this is the same `typeof module` test the UMD wrapper already uses.
    // "combos" is the most dangerous of the set and was ungated until verification round 2:
    // left open it silently replaces BOTH ACI Table 5.3.1 combinations, so a caller could run
    // the entire calculator unfactored and still receive a green summary.
    var TEST_ONLY_OPTS = ["pinZ_in", "tieCentroid_in", "tieWidthLimit", "combos"];
    var testOptsUsed = [];
    for (var to = 0; to < TEST_ONLY_OPTS.length; to++) {
      if (opts[TEST_ONLY_OPTS[to]] !== undefined) testOptsUsed.push(TEST_ONLY_OPTS[to]);
    }
    var testOptsAllowed = (typeof module === "object" && module !== null && !!module.exports) || opts.allowTestOnly === true;
    if (testOptsUsed.length && !testOptsAllowed) {
      err(errors, "INVALID_INPUT", "test-only option(s) " + testOptsUsed.join(", ") +
        " are not accepted from this caller. They bypass or disable code checks (pinZ_in bypasses the f_ce crown sizing, tieCentroid_in overrides the computed tie centroid, tieWidthLimit disables the ACI 318-19 23.8.2 effective-tie-width cap, combos replaces the ACI Table 5.3.1 load combinations) and are reserved for the fixture harness.");
    }
    var pinZ = (testOptsAllowed && isNum(opts.pinZ_in)) ? opts.pinZ_in : null;
    var ytOverride = (testOptsAllowed && isNum(opts.tieCentroid_in)) ? opts.tieCentroid_in : null;
    var combos = (testOptsAllowed && opts.combos) || [{ id: "1.4D", D: 1.4, L: 0 }, { id: "1.2D+1.6L", D: 1.2, L: 1.6 }];

    if (errors.length) return { errors: errors };

    var h = hw + hgb;
    // bottom-tie centroid: area-weighted over tieLayers when given, else single layer from
    // cover + db/2 (test-only override wins).
    var yt = (ytOverride !== null) ? ytOverride : (tieBars.ybar !== undefined ? tieBars.ybar : (coverBot + tieBars.db / 2));
    var hp = h - yt;                                  // tie centroid -> top fiber
    var ytTop = coverTop + topBars.db / 2;            // top fiber -> top-bar centroid
    var dEff = h - yt;                                // §9.9.2.1 d from top-of-wall compression fiber
    var dTop = h - ytTop;                             // effective depth for top bars (outboard cantilever)

    // ---- F1.3 §23.8.2 effective tie width ----------------------------------------------------
    // Applies to NODE-ANCHORED ties only (F1.1): the bottom tie at each end pier (all cases) and
    // the Case C top tie. It does NOT apply to the Case D distributed negative chord, which
    // terminates at no node — that chord is governed by F2.4b instead.
    //   w_t,phys = 2*ybar          (symmetric extended nodal zone — the existing ha)
    //   w_t,max  = F_nt/(f_ce*b_s), F_nt = As*fy NOMINAL (no phi)
    //   f_ce     = 0.85*beta_n*beta_c*f'c, beta_n = 0.8 (CCT), beta_c LOCKED at 1.0 — that lock
    //              is why the F1.5 collapse identity (back-face DCR == tie DCR) is EXACT.
    //   b_s      = min(t_w, b_gb) for the bottom tie (in the grade beam); t_w for the top tie.
    //   w_t,gov  = min(w_t,phys, w_t,max)   -> propagated to ha, w_s, node polygons AND to the
    //              anchorage critical section xCrit = (w_t,gov/2)/tan(theta).
    var capTieWidth = !(testOptsAllowed && opts.tieWidthLimit === false);
    function makeTieBand(As, yBar, bs) {
      var fceNode = 0.85 * 0.8 * BETA_C * (fc / 1000);
      var Fnt = As * fy;
      var wtMax = Fnt / (fceNode * bs);
      var wtPhys = 2 * yBar;
      return {
        ybar: yBar, As: As, Fnt: Fnt, fce: fceNode, bs: bs,
        wtPhys: wtPhys, wtMax: wtMax,
        wtGov: capTieWidth ? Math.min(wtPhys, wtMax) : wtPhys,
        capped: capTieWidth && (wtPhys > wtMax + 1e-12),
        limitApplied: capTieWidth
      };
    }
    var tNodeCalc = Math.min(tw, bgb);
    var tieBand = makeTieBand(tieBars.As, yt, tNodeCalc);
    var topBand = makeTieBand(topBars.As, ytTop, tw);

    // ---- F2.1 / F2.4b — Case D loads + negative chord ---------------------------------------
    var caseD = null;
    if (cD) {
      var nSp = cD.nSpans, L_in = cD.L_ft * 12;
      var spIn = cD.spanPoint || [];
      if (spIn.length && spIn.length !== nSp)
        err(errors, "INPUT", "caseD.spanPoint must have exactly nSpans entries (one midspan point load per span)");
      var spanPoint = [];
      for (var si = 0; si < nSp; si++) {
        var sPt = spIn[si] || {};
        var sD = isNum(sPt.D_kip) ? sPt.D_kip : 0, sL = isNum(sPt.L_kip) ? sPt.L_kip : 0;
        if (sD < 0 || sL < 0) err(errors, "LOAD", "caseD.spanPoint[" + si + "] components must be >= 0");
        spanPoint.push({ D: sD, L: sL });
      }
      var nc = cD.negChord || {};
      var negDepth = isNum(nc.depth_in) ? nc.depth_in : 0;
      if (negDepth < 0) err(errors, "INPUT", "caseD.negChord.depth_in must be >= 0");
      // F2.4b distribution limit, in place of the band check (F1.1): counting steel deeper than
      // 0.25h drops the centroid so far that zNeg collapses and the model stops being
      // representative. Counting deeper steel is already self-penalizing (y_neg down ->
      // zNeg down -> Tneg up); this is the hard stop.
      if (negDepth > 0.25 * h + GEOM_EPS)
        err(errors, "INPUT", "caseD.negChord.depth_in = " + fmt(negDepth, 2) + " in exceeds the distribution limit 0.25h = " +
          fmt(0.25 * h, 2) + " in — reduce the counted depth, or add concentrated top bars nearer the top of the wall (F2.4b)");
      var negParts = [], AsNeg = 0, AsNegY = 0, dbNeg = 0;
      if (nc.useWallEF && negDepth > 0) {
        // smeared EF horizontal wall steel over `depth_in` from the top of the wall:
        // As = layers * Ab * (depth/s); a uniform smear has its centroid at depth/2.
        var AsEF = webH.layers * webH.Ab * (negDepth / webH.s);
        negParts.push({ src: "wall EF horizontal " + webH.size + "@" + fmt(webH.s, 2) + " over " + fmt(negDepth, 2) + " in", As: AsEF, y: h - negDepth / 2, db: webH.db });
        AsNeg += AsEF; AsNegY += AsEF * (h - negDepth / 2);
        if (webH.db > dbNeg) dbNeg = webH.db;
      }
      var ab = nc.addBars || null;
      if (ab && isNum(ab.count) && ab.count > 0) {
        var abSize = ab.size || "#5";
        if (!BARS[abSize]) { err(errors, "REINF", "caseD.negChord.addBars size unknown: " + abSize); abSize = "#5"; }
        if (ab.count !== Math.floor(ab.count) || ab.count < 2)
          err(errors, "INVALID_INPUT", "caseD.negChord.addBars.count must be an integer >= 2");
        var abDepth = isNum(ab.depth_from_top_in) ? ab.depth_from_top_in : (wallCover + BARS[abSize].db / 2);
        if (abDepth < wallCover + BARS[abSize].db / 2 - GEOM_EPS)
          err(errors, "INVALID_INPUT", "caseD.negChord.addBars.depth_from_top_in must be >= wall cover + db/2 = " + fmt(wallCover + BARS[abSize].db / 2, 3) + " in");
        if (abDepth > 0.25 * h + GEOM_EPS)
          err(errors, "INPUT", "caseD.negChord.addBars.depth_from_top_in exceeds the 0.25h distribution limit (F2.4b)");
        if (2 * wallCover + ab.count * BARS[abSize].db > tw + GEOM_EPS)
          err(errors, "INVALID_INPUT", "caseD.negChord.addBars do not fit within t_w");
        var AsAdd = ab.count * BARS[abSize].Ab;
        negParts.push({ src: ab.count + "-" + abSize + " @ " + fmt(abDepth, 2) + " in below top of wall", As: AsAdd, y: h - abDepth, db: BARS[abSize].db });
        AsNeg += AsAdd; AsNegY += AsAdd * (h - abDepth);
        if (BARS[abSize].db > dbNeg) dbNeg = BARS[abSize].db;
      }
      if (!(AsNeg > 0))
        err(errors, "INPUT", "Case D requires negative-moment reinforcement over the interior piers — set caseD.negChord.useWallEF with depth_in > 0 and/or caseD.negChord.addBars");
      caseD = {
        nSpans: nSp, L: L_in, lb: cD.lb_in, spanPoint: spanPoint,
        negChord: {
          parts: negParts, As: AsNeg, y: AsNeg > 0 ? AsNegY / AsNeg : 0, db: dbNeg,
          depth_in: negDepth, useWallEF: !!nc.useWallEF,
          extension_in: isNum(nc.extension_in) ? nc.extension_in : 0
        },
        pierX: []
      };
      for (var pi = 0; pi <= nSp; pi++) caseD.pierX.push(cD.lb_in / 2 + pi * L_in);
    }
    if (errors.length) return { errors: errors };   // Case D validation is raised after `h` exists

    var ctx = {
      Lw: Lw, xL: xL, xR: xR, Ls: Ls, lbL: lbL, lbR: lbR, tw: tw, hw: hw, hgb: hgb, bgb: bgb,
      eL: eL, eR: eR, h: h, yt: yt, hp: hp, ytTop: ytTop, zTop: hp - ytTop, dEff: dEff, dTop: dTop,
      fc: fc, fcKsi: fc / 1000, fy: fy,
      tieBars: tieBars, topBars: topBars,
      coverBot: coverBot, coverSide: coverSide, coverTop: coverTop,
      webV: webV, webH: webH, anchL: anchL, anchR: anchR,
      wD_pli: wD_pli, wL_pli: wL_pli, gbSW_pli: gbSW / 12000, points: points,
      pinZ: pinZ, combos: combos,
      tieBand: tieBand, topBand: topBand,
      caseD: caseD, wallCover: wallCover,
      tNode: tNodeCalc,
      // R4.7: echoed so an applied test-only option is never silent (see the header block).
      testOnlyOptions: testOptsUsed.slice()
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
  // (rowCount = bars in ONE layer; for a multi-layer tie the c/c spacing of the developed bars
  //  is an in-row quantity, not a total-count quantity.)
  function barSpacingCC(ctx, bar) {
    var n = bar.rowCount || bar.count;
    return (ctx.bgb - 2 * ctx.coverSide - bar.db) / (n - 1);
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
    var n = ctx.tieBars.rowCount || ctx.tieBars.count, db = ctx.tieBars.db;
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
    // F1.3(3): the critical section is the exit of the bar centroid from the EXTENDED NODAL
    // ZONE, whose half-height is w_t,gov/2 — NOT ybar_t. When §23.8.2 caps the node width the
    // zone shrinks and the critical section moves toward the bearing, REDUCING available
    // embedment. Uncapped (w_t,gov = 2*ybar_t) this reduces identically to ybar_t/tan(theta).
    var xCrit = (ctx.tieBand.wtGov / 2) / tanT;      // inboard of the bearing inner edge
    var available = xCrit + lb + e - coverEnd;       // along the bar centerline to the bar end
    var req, detail = { type: cfg.type, xCrit_in: xCrit };
    var state = "ok", forceFail = false;
    if (cfg.type === "hook") {
      var hk = ldHook(ctx, bar, cfg);
      req = hk.l; detail.ldh = hk;                    // no excess-reinforcement reduction (25.4.10.2)
    } else if (cfg.type === "headed") {
      var n = bar.rowCount || bar.count, ccClear = n > 1 ? (ctx.bgb - 2 * ctx.coverSide - bar.db) / (n - 1) - bar.db : Infinity;
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

    // support nodes (CCT extended nodal zone) — back-face height limited by §23.8.2 (F1.3)
    var ha = ctx.tieBand.wtGov;
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

    var ha = ctx.tieBand.wtGov;   // §23.8.2-limited back-face height (F1.3)
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
    // B3: top-tie face where T_top crosses the node region — width bounded by 2*ytTop and,
    // per F1.1/F1.3, by the §23.8.2 effective tie width of the TOP tie (node-anchored here).
    var haTopSup = ctx.topBand.wtGov;
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
        // B2: tie back face bounded by the cover geometry (2*ytTop: N_a sits at the top-bar
        // centroid, ytTop below the top of wall), the §23.8.2 effective tie width of the top
        // tie (F1.3 — same capping as the bottom tie), and the adjacent band depths (B1).
        var haTop = Math.min(ctx.topBand.wtGov, vn2.haBand);
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

  // =========================================================================================
  // CASE D — continuous spans over piers (FEATURE 2)
  // =========================================================================================
  //
  // results.model SHAPE FOR THE DRAWING LAYER (consumed by the UI/graphics agent).
  // Everything below hangs off  results.model.caseD  and is in INCHES / KIPS / KSI, full
  // precision.  x is absolute along the wall (0 = left end of wall), y is above the bottom of
  // the grade beam.  All enveloped quantities carry the governing combo + pattern.
  //
  //   model.caseD = {
  //     nSpans, L_in, lb_in, h_in, pierX_in: [x_0 .. x_n],       // pier CENTERLINES
  //     endStrip: { len_in, o_in, note },                        // l_b/2 strip routed to the end bearing
  //     scopeNote: [ ...strings... ],                            // F2.6, must be rendered
  //     spans: [ {                                               // one per span, left to right
  //       index, x0_in, x1_in,                                   // pier CL to pier CL
  //       Mpos_env_kin, Mpos_x_in, Mpos_combo, Mpos_pattern,     // ENVELOPED positive moment
  //       Tpos_kip, Tpos_combo, Tpos_pattern,                    // ENVELOPED bottom-tie force
  //       zPos_in, aPos_in, Mss_kin, MposDesign_kin, floorGoverns,   // from the Tpos-governing run
  //          // floorGoverns = "elastic envelope" | "capacity-consistent floor" | "0.5*M_ss floor"
  //       phiMn_neg_L_kin, phiMn_neg_R_kin,                      // what the PROVIDED neg. steel delivers
  //       VfaceL_kip, VfaceR_kip,                                // ENVELOPED shear at each support face
  //       MA_ref_kin, MB_ref_kin, wu_ref_klf, Pu_ref_kip         // reference-run span-end moments/loads
  //     } ],
  //     supports: [ {                                            // one per pier, left to right
  //       index, x_in, type: "end" | "interior",
  //       governingCombo, governingPattern,                      // the run everything below comes from
  //       AsNeg_in2, yNeg_in,
  //       Mneg_kin, Tneg_kip, aNeg_in, zNeg_in,                  // negative chord, governing run
  //       R_elastic_kip, R_floor_kip, R_used_kip, R_bearing_kip, // F2.4c reaction floor + routed strip
  //       theta_end_deg,                                         // end piers only: atan(R_end/Tpos)
  //       diagonals: [ { side:"L"|"R", V_kip, H_kip, theta_deg, F_kip, ws_in, stress_ksi, dcr } ],
  //       node: { id, cls, lim_ksi, combo, pattern,
  //               faces:[{name,width_in,Acn_in2,force_kip,stress_ksi,dcr}] },
  //       sumV_kip, sumH_kip,                                    // interior nodes: closure residuals
  //       Mneg_env_kin, Mneg_combo, Mneg_pattern,                // <= 0 (hogging), ENVELOPED scalars
  //       Tneg_env_kip, Tneg_combo, Tneg_pattern,
  //       R_used_env_kip, R_bearing_env_kip
  //     } ],
  //   A support's governing run is the one with the heaviest BEARING demand — a physical,
  //   monotone criterion. Everything geometric for that pier comes from that single run, so the
  //   drawing is always a real load case; the *_env fields carry the independent maxima. The
  //   CHECK ROWS are enveloped separately on DCR and are unaffected by this reporting choice.
  //     negChord: {
  //       As_in2, y_in, db_in, depth_in, useWallEF, parts:[{src,As,y}],
  //       extension_provided_in,
  //       extensions: [ { pier, side, x_infl_in, noInflection, ld_in,
  //                       devShift_ld_in,        // max(ld, 12db)  — governing (D-region)
  //                       devShift_d_in,         // max(d, 12db)   — §9.7.3.8.4 B-region compare
  //                       req_devRule_in, req_ld_in,
  //                       required_in,           // governing requirement, ld-based
  //                       required_bregion_in,   // informational B-region comparison
  //                       provided_in, governs } ]
  //     },
  //     diagram: { x_in:[...], Mmin_kin:[...], Mmax_kin:[...] },  // moment ENVELOPE for plotting
  //     inflections: [ { x_in, pier, side } ],                    // envelope zero-crossings
  //     lap: { classB_in, ld_in, note },                          // bottom-bar Class B lap over piers
  //     reference: { combo, pattern, R_kip:[...], Msup_kin:[...] }
  //   }
  //
  // ---- F2.2 exact elastic analysis, prismatic, rotational DOF at each of nSpans+1 supports.
  // Slope-deflection with k = 2EI/L (EI = 1) and member-end moments POSITIVE COUNTERCLOCKWISE:
  //   M_ij = k*(2*th_i + th_j) + FEM_ij,   FEM_ij = -F_i,  FEM_ji = +F_i,
  //   F_i  = w_i*L^2/12 + P_i*L/8      (UDL + MIDSPAN point load fixed-end moments)
  // Joint equilibrium: sum of arriving end moments = 0 (ends are simple: single term = 0).
  // Mapping to the sagging-positive beam convention: M_A(span i) = M_{i,i+1},
  // M_B(span i) = -M_{i+1,i}. Verified against the textbook coefficients (F2.8): 2 equal spans
  // UDL -> M- = wL^2/8, M+ = 9/128 wL^2, R_int = 1.25wL, R_end = 0.375wL; 3 equal spans ->
  // 0.100/0.080/0.025 wL^2.
  //
  // STATED ASSUMPTION (F2.2): flexure-only. Shear flexibility at ln/h ~ 1.6 reduces continuity,
  // which reduces M- and increases M+ (handled by the F2.4a floor) and raises end reactions
  // toward the simple-span value (handled by the F2.4c reaction floor).
  // ---- R4.2 INDEPENDENT CROSS-CHECK of the moment distribution -----------------------------
  // The direct-stiffness path above is a DISPLACEMENT method: unknown rotations, slope-deflection
  // end moments, shears from those end moments, reactions from those shears. Every statics
  // residual computed downstream of it (sum-V, sum-M, the interior-node sum-V/sum-H) is satisfied
  // IDENTICALLY for ANY set of end moments, right or wrong — pick any M values, derive the shears
  // from them, and the free body closes. So none of those residuals can detect a wrong moment
  // distribution (a mis-signed or mis-scaled fixed-end moment, a bad stiffness term, a bad
  // b-vector). They are model-consistency statements, not checks.
  //
  // This function re-derives the support moments by the FORCE method — Clapeyron's three-moment
  // equation — which shares no code and no formulation with the stiffness solve. For equal
  // prismatic spans of length L with simple ends (M_0 = M_n = 0), sagging-positive support
  // moments, and the free (simply-supported) bending-moment diagram of each span:
  //
  //   M_{i-1}*L + 2*M_i*(L + L) + M_{i+1}*L = -6*A_left*xbar_left/L - 6*A_right*xbar_right/L
  //
  // with the areas taken about the FAR end of each span. For a UDL, A = wL^3/12 with the
  // centroid at L/2, so the term is 6*(wL^3/12)*(L/2)/L = wL^3/4. For a MIDSPAN point load,
  // A = PL^2/8 with the centroid at L/2, so the term is 3PL^2/8. Dividing through by L:
  //
  //   M_{i-1} + 4*M_i + M_{i+1} = -[ w_{i-1}L^2/4 + 3P_{i-1}L/8 + w_i L^2/4 + 3P_i L/8 ]
  //
  // Sanity (closed form, both reproduced by the tridiagonal solve below):
  //   2 equal spans, UDL:      4*M_1 = -wL^2/2            -> M_1 = -wL^2/8       (= F2.8(1))
  //   3 equal spans, UDL:      5*M_1 = -wL^2/2 (symmetry) -> M_1 = -0.100wL^2    (= F2.8(2))
  //   2 equal spans, midspan P: 4*M_1 = -3PL^2/4          -> M_1 = -3PL/16       (textbook)
  //
  // Reactions are then rebuilt from THOSE moments and compared against the shear-assembled
  // reactions.
  //
  // WHAT THIS CATCHES THAT NOTHING ELSE DOES — fixed-end-moment MAGNITUDE errors. Changing the
  // UDL FEM from wL^2/12 to wL^2/10, or the midspan-point FEM from PL/8 to PL/6, produces a
  // self-consistent-but-wrong moment distribution: jointRes, globalV, globalM and the
  // interior-node ΣV/ΣH all stay at exactly zero while this residual moves to tens of kips
  // (mutation-verified: wL^2/10 gives maxR = 14.97 kip against a ~1e-13 kip clean run).
  //
  // WHAT IT DOES NOT ADD (verified by mutation, corrected after verification round 2 — the
  // earlier comment here overclaimed): a FLIPPED FEM sign or a bad b-vector term trips the
  // EQUILIBRIUM (jointRes) guard first, and kk = 1/L instead of 2/L changes NOTHING at all,
  // because uniform stiffness scaling cancels in K·θ = F — there is no error there to detect.
  function threeMomentCheck(n, L, w, P, R, Msup, tol) {
    var i, k;
    var M3 = new Array(n + 1).fill(0);
    var m = n - 1;                                   // interior unknowns M_1 .. M_{n-1}
    if (m > 0) {
      // tridiagonal [1, 4, 1] solved by the Thomas algorithm — deliberately NOT solveNormal(),
      // so the cross-check shares no solver with the stiffness path either.
      var a = [], bdi = [], c = [], d = [];
      for (i = 1; i <= m; i++) {
        a.push(i === 1 ? 0 : 1); bdi.push(4); c.push(i === m ? 0 : 1);
        d.push(-(w[i - 1] * L * L / 4 + 3 * P[i - 1] * L / 8 + w[i] * L * L / 4 + 3 * P[i] * L / 8));
      }
      var cp = new Array(m), dp = new Array(m);
      cp[0] = c[0] / bdi[0]; dp[0] = d[0] / bdi[0];
      for (k = 1; k < m; k++) {
        var den = bdi[k] - a[k] * cp[k - 1];
        if (Math.abs(den) < 1e-12) return { error: "three-moment system singular" };
        cp[k] = c[k] / den; dp[k] = (d[k] - a[k] * dp[k - 1]) / den;
      }
      var x = new Array(m);
      x[m - 1] = dp[m - 1];
      for (k = m - 2; k >= 0; k--) x[k] = dp[k] - cp[k] * x[k + 1];
      for (i = 1; i <= n; i++) if (i < n) M3[i] = x[i - 1];
    }
    // reactions rebuilt from the independent support moments (F2.5.13 / R4.2 form):
    //   R_i = SUM over adjacent spans of [ wL/2 + P/2 -/+ (M_far - M_near)/L ]
    var R3 = new Array(n + 1).fill(0);
    for (i = 0; i <= n; i++) {
      if (i > 0) R3[i] += w[i - 1] * L / 2 + P[i - 1] / 2 - (M3[i] - M3[i - 1]) / L;
      if (i < n) R3[i] += w[i] * L / 2 + P[i] / 2 + (M3[i + 1] - M3[i]) / L;
    }
    var maxR = 0, maxM = 0;
    for (i = 0; i <= n; i++) {
      maxR = Math.max(maxR, Math.abs(R3[i] - R[i]));
      maxM = Math.max(maxM, Math.abs(M3[i] - Msup[i]));
    }
    return { M3: M3, R3: R3, maxR: maxR, maxM: maxM, tol: tol, ok: maxR <= tol };
  }

  function solveD(ctx, combo, mask, betaInfo) {
    var cd = ctx.caseD, n = cd.nSpans, L = cd.L, lb = cd.lb;
    var fce = PHI_STM * 0.85 * betaInfo.betaS * ctx.fcKsi;   // design stress for chord/strut sizing
    var i, k;

    // ---- factored per-span loads (each span's LL toggles as a unit, F2.3)
    var w = [], P = [], F = [];
    for (i = 0; i < n; i++) {
      var on = !!(mask.spans && mask.spans["sp" + (i + 1)]);
      w.push(combo.D * ctx.wD_pli + (on ? combo.L * ctx.wL_pli : 0));
      P.push(combo.D * cd.spanPoint[i].D + (on ? combo.L * cd.spanPoint[i].L : 0));
      F.push(w[i] * L * L / 12 + P[i] * L / 8);
    }

    // ---- direct stiffness in the rotations
    var nd = n + 1, kk = 2 / L;
    var A = [], b = [];
    for (i = 0; i < nd; i++) { A.push(new Array(nd).fill(0)); b.push(0); }
    // node 0
    A[0][0] += 2 * kk; A[0][1] += kk; b[0] += F[0];
    // interior nodes
    for (i = 1; i < n; i++) {
      A[i][i - 1] += kk; A[i][i] += 2 * kk;          // right end of span i-1
      A[i][i] += 2 * kk; A[i][i + 1] += kk;          // left end of span i
      b[i] += F[i] - F[i - 1];
    }
    // node n
    A[n][n - 1] += kk; A[n][n] += 2 * kk; b[n] += -F[n - 1];
    var th = solveNormal(A, b, nd);
    if (!th) return { status: "not_converged", errors: [{ code: "SINGULAR", message: "Case D stiffness system singular (" + combo.id + ")" }] };

    // ---- end moments -> sagging-positive span-end moments
    var MA = [], MB = [], Msup = new Array(nd).fill(0);
    for (i = 0; i < n; i++) {
      MA.push(kk * (2 * th[i] + th[i + 1]) - F[i]);
      MB.push(-(kk * (th[i] + 2 * th[i + 1]) + F[i]));
    }
    Msup[0] = MA[0]; Msup[n] = MB[n - 1];
    for (i = 1; i < n; i++) Msup[i] = MB[i - 1];
    // joint-equilibrium self-check (F2.5.13): the two adjacent spans must report the same
    // support moment, and the simple ends must report zero.
    var jointRes = Math.max(Math.abs(MA[0]), Math.abs(MB[n - 1]));
    for (i = 1; i < n; i++) jointRes = Math.max(jointRes, Math.abs(MB[i - 1] - MA[i]));

    // ---- shears at the span ends and support reactions
    var VL = [], VR = [], R = new Array(nd).fill(0), Wtot = 0;
    for (i = 0; i < n; i++) {
      var Vss = w[i] * L / 2 + P[i] / 2;
      VL.push(Vss + (MB[i] - MA[i]) / L);
      VR.push(Vss - (MB[i] - MA[i]) / L);
      Wtot += w[i] * L + P[i];
    }
    if (!(Wtot > 0)) return { status: "no_admissible_stm", errors: [{ code: "NO_TRUSS_LOAD", message: "no load on any span (" + combo.id + ")" }] };
    R[0] = VL[0]; R[n] = VR[n - 1];
    for (i = 1; i < n; i++) R[i] = VR[i - 1] + VL[i];
    var globalV = 0; for (i = 0; i < nd; i++) globalV += R[i];
    globalV -= Wtot;
    var globalM = 0;                                   // moments about the left pier CL
    for (i = 0; i < nd; i++) globalM += R[i] * (i * L);
    for (i = 0; i < n; i++) globalM -= w[i] * L * (i * L + L / 2) + P[i] * (i * L + L / 2);
    var eqTolD = 1e-8 * Math.abs(Wtot) + 0.001;
    if (jointRes > eqTolD || Math.abs(globalV) > eqTolD || Math.abs(globalM) > eqTolD * L)
      return { status: "not_converged", errors: [{ code: "EQUILIBRIUM", message: "Case D statics self-check failed (joint " + jointRes + ", V " + globalV + ", M " + globalM + ") [" + combo.id + "]" }] };
    // R4.2: the LOAD-BEARING statics assertion. globalV above is identically zero (R is assembled
    // from the same span shears it is summed against) and so is the interior-node closure below;
    // this one is not — it re-derives the support moments by the three-moment (force) method and
    // rebuilds the reactions from them. See threeMomentCheck() for what would trip it.
    var xchk = threeMomentCheck(n, L, w, P, R, Msup, eqTolD);
    if (xchk.error || !xchk.ok || Math.abs(xchk.maxM) > eqTolD * L)
      return {
        status: "not_converged", errors: [{
          code: "REACTION_CROSSCHECK", message: "Case D reaction cross-check failed: reactions rebuilt from an independent three-moment (force-method) solution differ from the shear-assembled reactions by " +
            (xchk.error ? xchk.error : fmt(xchk.maxR, 6) + " kip (support-moment difference " + fmt(xchk.maxM, 6) + " kip-in) — the elastic moment distribution is not self-consistent [" + combo.id + "]")
        }]
      };
    // F2.5(14): a patterned live load on a lightly dead-loaded continuous member can produce a
    // genuine negative end reaction. Name BOTH the pier and the governing pattern.
    for (i = 0; i < nd; i++) if (R[i] < -1e-9)
      return {
        status: "no_admissible_stm", errors: [{
          code: "NEG_REACTION", message: "uplift at pier " + i + " (reaction " + fmt(R[i], 2) + " kip) under combination " +
            combo.id + ", live-load pattern " + maskId(mask) +
            " — this model assumes every pier stays in bearing. A tension connection at the pier is out of scope: add dead load, change the pier layout, or design that connection separately."
        }]
      };

    // ---- M(x) within a span: M = M_A*(1-xi) + M_B*xi + M_ss(x)
    function Mx(i2, x) {
      var xi = x / L;
      var mss = w[i2] * x * (L - x) / 2 + (x <= L / 2 ? P[i2] * x / 2 : P[i2] * (L - x) / 2);
      return MA[i2] * (1 - xi) + MB[i2] * xi + mss;
    }
    // ---- positive-moment maximum per span: stationary points + midspan kink + dense sweep
    var Mpos = [], MposX = [];
    for (i = 0; i < n; i++) {
      var cand = [0, L / 2, L], slope = (MB[i] - MA[i]) / L;
      if (w[i] > 0) {
        var xa = L / 2 + slope / w[i] + P[i] / (2 * w[i]);   // left half branch
        var xb = L / 2 + slope / w[i] - P[i] / (2 * w[i]);   // right half branch
        if (xa > 0 && xa < L / 2) cand.push(xa);
        if (xb > L / 2 && xb < L) cand.push(xb);
      }
      for (k = 0; k <= 200; k++) cand.push(k * L / 200);
      var best = -Infinity, bestX = 0;
      for (k = 0; k < cand.length; k++) { var mv = Mx(i, cand[k]); if (mv > best) { best = mv; bestX = cand[k]; } }
      Mpos.push(Math.max(0, best)); MposX.push(bestX);
    }

    // ---- F2.4b negative chord at each support (no band check — see F1.1)
    function sizeNeg(M) {
      // a- = Tneg/(f_ce*b_gb) on the GRADE BEAM width; zNeg = y_neg - a-/2, iterated.
      var yN = ctx.caseD.negChord.y, a = 0, z = yN, it = 0;
      if (M <= 0) return { T: 0, a: 0, z: yN, iters: 0 };
      while (it < ITER_MAX) {
        z = yN - a / 2;
        if (z <= GEOM_EPS) return { error: "geometry_infeasible", msg: "negative-chord lever arm zNeg <= 0" };
        var T = M / z, aNew = T / (fce * ctx.bgb);
        it++;
        if (Math.abs(aNew - a) < ITER_TOL) { a = aNew; z = yN - a / 2; return { T: M / z, a: a, z: z, iters: it }; }
        a = aNew;
      }
      return { error: "not_converged", msg: "negative-chord depth a- did not converge" };
    }
    var neg = [];
    for (i = 0; i <= n; i++) {
      var Mn = -Math.min(0, Msup[i]);                 // magnitude of the hogging moment
      var sn = sizeNeg(Mn);
      if (sn.error) return { status: sn.error, errors: [{ code: "NEGCHORD", message: sn.msg + " at pier " + i + " [" + combo.id + "]" }] };
      if (sn.a > ctx.hgb + GEOM_EPS)
        return {
          status: "geometry_infeasible", errors: [{
            code: "NEG_A_GT_HGB", message: "negative compression block a- = " + fmt(sn.a, 2) +
              " in exceeds the grade-beam depth h_gb = " + fmt(ctx.hgb, 2) + " in at pier " + i + " — deepen the grade beam, widen it, or add negative reinforcement [" + combo.id + "]"
          }]
        };
      neg.push({ M: Mn, T: sn.T, a: sn.a, z: sn.z });
    }

    // ---- F2.4a positive chord per span, with the CAPACITY-CONSISTENT floor
    // Tpos >= [ M_ss - 0.5*(phiMn,neg,L + phiMn,neg,R) ] / zPos   (lower-bound-theorem form:
    // continuity relief may only be claimed up to what the PROVIDED negative steel can deliver),
    // and additionally Tpos >= 0.5*M_ss/zPos. zPos is iterated AT the floored force.
    var AsNeg = ctx.caseD.negChord.As;
    var pos = [];
    for (i = 0; i < n; i++) {
      var Mss = w[i] * L * L / 8 + P[i] * L / 4;
      var phiMnL = (i === 0) ? 0 : PHI_STM * AsNeg * ctx.fy * neg[i].z;
      var phiMnR = (i === n - 1) ? 0 : PHI_STM * AsNeg * ctx.fy * neg[i + 1].z;
      var Mcap = Math.max(0, Mss - 0.5 * (phiMnL + phiMnR));
      var M50 = 0.5 * Mss;
      var Mdes = Mpos[i], gov = "elastic envelope";
      if (Mcap > Mdes + 1e-12) { Mdes = Mcap; gov = "capacity-consistent floor"; }
      if (M50 > Mdes + 1e-12) { Mdes = M50; gov = "0.5*M_ss floor"; }
      if (!(Mdes > 0)) { pos.push({ M: 0, Mss: Mss, Mdes: 0, gov: gov, T: 0, a: 0, z: ctx.hp, phiMnL: phiMnL, phiMnR: phiMnR }); continue; }
      var ch = sizeChord(ctx, Mdes, fce);
      if (ch.error) return { status: ch.error, errors: [{ code: "CHORD", message: ch.msg + " in span " + (i + 1) + " [" + combo.id + "]" }] };
      pos.push({ M: Mpos[i], Mss: Mss, Mdes: Mdes, gov: gov, T: Mdes / ch.z, a: ch.a, z: ch.z, phiMnL: phiMnL, phiMnR: phiMnR });
    }

    // ---- F2.4c reaction floor at the END piers (consistent with the F2.4a moment floor)
    var Rfloor = new Array(nd).fill(0), Rused = R.slice();
    Rfloor[0] = w[0] * L / 2 + P[0] / 2 - 0.5 * neg[1].M / L;
    Rfloor[n] = w[n - 1] * L / 2 + P[n - 1] / 2 - 0.5 * neg[n - 1].M / L;
    Rused[0] = Math.max(R[0], Rfloor[0]);
    Rused[n] = Math.max(R[n], Rfloor[n]);

    // ---- F2.5(7) end-pier springing angle: theta_end = atan(R_end / Tpos) — the funicular
    // springing identity, which is exactly what makes the Cases A/B node + anchorage machinery
    // callable here unchanged.
    var thetaEnd = [null, null];
    thetaEnd[0] = pos[0].T > 0 ? deg(Math.atan2(Rused[0], pos[0].T)) : 90;
    thetaEnd[1] = pos[n - 1].T > 0 ? deg(Math.atan2(Rused[n], pos[n - 1].T)) : 90;

    // ---- F2.5(6) diagonal struts per span-half, and F2.5(8) interior nodes
    var haEnd = ctx.tieBand.wtGov;
    function diagonal(side, V, H, ha) {
      if (!(V > GEOM_EPS)) return { side: side, V: 0, H: H, theta: 90, F: 0, ws: lb, stress: 0, dcr: 0 };
      var t = deg(Math.atan2(V, Math.max(H, 0)));
      var Fd = V / Math.sin(rad(t));
      var ws = lb * Math.sin(rad(t)) + ha * Math.cos(rad(t));
      return { side: side, V: V, H: H, theta: t, F: Fd, ws: ws, stress: Fd / (ws * ctx.tw), dcr: (Fd / (ws * ctx.tw)) / fce };
    }
    var supports = [], minAngle = Infinity;
    for (i = 0; i <= n; i++) {
      var sup = { index: i, type: (i === 0 || i === n) ? "end" : "interior", diagonals: [] };
      if (i === 0) {
        sup.diagonals.push(diagonal("R", Rused[0], pos[0].T, haEnd));
        sup.theta_end = thetaEnd[0];
      } else if (i === n) {
        sup.diagonals.push(diagonal("L", Rused[n], pos[n - 1].T, haEnd));
        sup.theta_end = thetaEnd[1];
      } else {
        // both diagonals use the SAME chord force C- = Tneg at this support, so each delivers a
        // horizontal component of exactly Tneg — which is what closes sum-H below.
        sup.diagonals.push(diagonal("L", VR[i - 1], neg[i].T, neg[i].a));
        sup.diagonals.push(diagonal("R", VL[i], neg[i].T, neg[i].a));
      }
      sup.diagonals.forEach(function (d) { minAngle = Math.min(minAngle, d.theta); });
      supports.push(sup);
    }

    var lim = { CCT: PHI_STM * 0.85 * BETA_C * 0.8 * ctx.fcKsi, CCC: PHI_STM * 0.85 * BETA_C * 1.0 * ctx.fcKsi };
    var closeMax = 0;
    for (i = 0; i <= n; i++) {
      var s2 = supports[i], faces = [];
      if (s2.type === "end") {
        // CCT: bearing (TRUSS reaction only — B4 FBD split; routed load stays in the §22.8
        // bearing check), springing strut at theta_end, tie back face at the §23.8.2 width.
        var dg = s2.diagonals[0];
        faces.push({ name: "bearing", width: lb, Acn: lb * ctx.tNode, force: Rused[i], stress: Rused[i] / (lb * ctx.tNode) });
        faces.push({ name: "strut (springing)", width: dg.ws, Acn: dg.ws * ctx.tw, force: dg.F, stress: dg.F / (dg.ws * ctx.tw) });
        var Tend = (i === 0) ? pos[0].T : pos[n - 1].T;
        faces.push({ name: "back (tie)", width: haEnd, Acn: haEnd * ctx.tNode, force: Tend, stress: Tend / (haEnd * ctx.tNode) });
        s2.node = { id: "node.pier." + i, cls: "CCT", faces: faces, lim: lim.CCT };
      } else {
        // CCC (verified: nothing tensile enters — the negative chord is remote at the TOP of the
        // wall). Faces: bearing up, the two diagonals, and the two bottom-chord compressions.
        var dL = s2.diagonals[0], dR = s2.diagonals[1], aN = neg[i].a, Tn = neg[i].T;
        faces.push({ name: "bearing", width: lb, Acn: lb * ctx.tNode, force: R[i], stress: R[i] / (lb * ctx.tNode) });
        faces.push({ name: "strut (diagonal L)", width: dL.ws, Acn: dL.ws * ctx.tw, force: dL.F, stress: dL.stress });
        faces.push({ name: "strut (diagonal R)", width: dR.ws, Acn: dR.ws * ctx.tw, force: dR.F, stress: dR.stress });
        // F2.5(8) Rev 3 — EACH FACE ON ITS OWN THICKNESS. The horizontal bottom-chord faces are
        // checked on b_gb: the negative compression chord lives in the grade beam, is delivered
        // ALONG the grade beam into the pier, and is not confined by the thinner wall above it.
        // The diagonals above use t_w because those struts run through the wall.
        // Rev 2 ALSO checked the same force squeezed onto t_w. That was wrong: with a- sized on
        // b_gb at f_ce, that face's DCR was exactly beta_s*(b_gb/t_w) — load-independent, 1.500
        // for a 24 in grade beam on a 12 in wall, i.e. a false failure on every Case D run.
        // It is removed. The wall -> grade-beam width transition across the node is a STATED
        // MODELLING ASSUMPTION (reported in the node derivation), not a check.
        faces.push({ name: "chord (bottom compression, on b_gb — sized-to-fit)", width: aN, Acn: aN * ctx.bgb, force: Tn, stress: aN > 0 ? Tn / (aN * ctx.bgb) : 0, byConstruction: true });
        // R4.2 — HONEST LABEL. These two residuals CLOSE BY CONSTRUCTION and are reported as
        // model-consistency statements, not as checks: R[i] is assembled as VR[i-1] + VL[i], the
        // very quantities subtracted here, so sumV is identically zero; and both diagonals take
        // their horizontal component from the SAME chord force Tn, so sumH is float noise. They
        // confirm the node was assembled the way the model says it was — nothing more. The
        // load-bearing assertions are the three-moment reaction cross-check above, jointRes and
        // globalM.
        var sumV = R[i] - dL.V - dR.V;
        var HL = dL.V / Math.tan(rad(dL.theta)), HR = dR.V / Math.tan(rad(dR.theta));
        var sumH = (HL - HR) + (Tn - Tn);
        s2.sumV = sumV; s2.sumH = sumH; s2.HL = HL; s2.HR = HR;
        closeMax = Math.max(closeMax, Math.abs(sumV), Math.abs(sumH));
        s2.node = { id: "node.pier." + i, cls: "CCC", faces: faces, lim: lim.CCC };
      }
      s2.node.faces.forEach(function (f) { f.dcr = f.stress / s2.node.lim; });
    }
    if (closeMax > eqTolD)
      return { status: "not_converged", errors: [{ code: "NODE_CLOSURE", message: "Case D interior node equilibrium residual " + closeMax + " kip exceeds tolerance [" + combo.id + "]" }] };

    // ---- bearing demands. The l_b/2 wall strip outboard of each END pier CL routes straight
    // into that bearing (o = 0 by construction, F2.1); interior piers take the full reaction.
    var routed = routedForces(ctx, combo.D, combo.L);
    var Rbrg = new Array(nd).fill(0);
    for (i = 0; i <= n; i++) Rbrg[i] = (i === 0) ? Rused[0] + routed.L.total : (i === n ? Rused[n] + routed.R.total : R[i]);

    var TposMax = 0, aPosMax = 0, zPosMin = Infinity, MposMax = 0, MposMaxX = 0;
    for (i = 0; i < n; i++) {
      if (pos[i].T > TposMax) TposMax = pos[i].T;
      if (pos[i].a > aPosMax) aPosMax = pos[i].a;
      if (pos[i].z < zPosMin) zPosMin = pos[i].z;
      if (pos[i].M > MposMax) { MposMax = pos[i].M; MposMaxX = cd.pierX[i] + MposX[i]; }
    }
    var TnegMax = 0, iNegMax = 0;
    for (i = 0; i <= n; i++) if (neg[i].T > TnegMax) { TnegMax = neg[i].T; iNegMax = i; }

    return {
      status: "ok", errors: [], caseD: true,
      fce: fce, w: w, P: P, MA: MA, MB: MB, Msup: Msup, VL: VL, VR: VR,
      R: R, Rfloor: Rfloor, Rused: Rused, Rbrg: Rbrg, routed: routed,
      pos: pos, neg: neg, supports: supports, Mx: Mx, MposX: MposX,
      thetaEnd: thetaEnd, minAngle: minAngle, TnegMax: TnegMax, iNegMax: iNegMax,
      // generic fields consumed by run()/patterns/reference-model selection
      Mmax: MposMax, MmaxX: MposMaxX, z: zPosMin, a: aPosMax, H: TposMax, T: TposMax,
      ha: ctx.tieBand.wtGov, wsL: supports[0].diagonals[0].ws, wsR: supports[n].diagonals[0].ws,
      thetaL: thetaEnd[0], thetaR: thetaEnd[1],
      st: { RL: Rused[0], RR: Rused[n], W: Wtot },
      RbL: Rbrg[0], RbR: Rbrg[n],
      xchk: xchk,
      selfChecks: {
        maxNodeResidual_kip: Math.max(closeMax, jointRes), globalV_kip: globalV, globalM_kin: globalM,
        interiorNodeClosure_kip: closeMax,
        // R4.2: the independent one. The three above all close by construction in Case D.
        reactionCrossCheck_kip: xchk.maxR, momentCrossCheck_kin: xchk.maxM, crossCheckTol_kip: eqTolD
      }
    };
  }

  // ---- F2.5(10) negative-moment ENVELOPE (max over ALL combos/patterns) and its zero
  // crossings. This MUST come from the envelope, not from the all-loaded pattern: with an
  // adjacent span loaded and this one bare, the hogging region reaches further into the span.
  var NEG_SAMPLES = 400;
  function negEnvelope(ctx, sols) {
    var cd = ctx.caseD, n = cd.nSpans, L = cd.L;
    var spans = [];
    for (var i = 0; i < n; i++) {
      var xs = [], mn = [], mx = [];
      for (var k = 0; k <= NEG_SAMPLES; k++) {
        var x = k * L / NEG_SAMPLES, lo = Infinity, hi = -Infinity;
        for (var s = 0; s < sols.length; s++) {
          var v = sols[s].Mx(i, x);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        xs.push(x); mn.push(lo); mx.push(hi);
      }
      spans.push({ xs: xs, Mmin: mn, Mmax: mx });
    }
    // crossing search from a support into a span; dir = +1 (rightwards from support i into
    // span i) or -1 (leftwards from support i into span i-1).
    function cross(spanIdx, fromLeft) {
      var sp = spans[spanIdx], m = sp.Mmin, N = m.length;
      var seq = [];
      for (var k = 0; k < N; k++) seq.push(fromLeft ? k : N - 1 - k);
      if (!(m[seq[0]] < 0)) return { x: 0, none: false };     // already non-negative at the face
      for (var q = 1; q < N; q++) {
        var a = seq[q - 1], b2 = seq[q];
        if (m[b2] >= 0) {
          var t = m[a] / (m[a] - m[b2]);
          var xa = sp.xs[a], xb = sp.xs[b2];
          var xz = xa + t * (xb - xa);
          return { x: Math.abs(xz - (fromLeft ? 0 : L)), none: false };
        }
      }
      return { x: L, none: true };                            // hogging over the whole span
    }
    return { spans: spans, cross: cross };
  }

  // ------------------------------------------------- F1.4 tie effective-width row
  // ALWAYS informational (F1.4): it is excluded from governing-DCR and near-limit selection.
  // demand = w_t,gov, capacity = w_t,max, dcr = w_t,gov/w_t,max <= 1 BY CONSTRUCTION — w_t,phys
  // goes in contributions, never in demand, because a dcr > 1 on a passing row would corrupt
  // the summary's governing-DCR selection. `pass` reflects BAND MEMBERSHIP ONLY.
  // Failing (rather than silently discounting out-of-band steel) is deliberate: auto-discounting
  // cascades (As -> F_nt -> w_t,max -> band) and hides the required fix from the engineer.
  function tieWidthRow(ctx) {
    var tb = ctx.tieBand;
    var lo = tb.ybar - tb.wtGov / 2, hi = tb.ybar + tb.wtGov / 2;
    var layers = ctx.tieBars.layers;
    var contributions = [
      { source: "w_t,phys = 2*ybar_t", value: tb.wtPhys },
      { source: "ybar_t (area-weighted)", value: tb.ybar },
      { source: "F_nt = As*fy (NOMINAL, no phi)", value: tb.Fnt },
      { source: "f_ce = 0.85*beta_n(0.8, CCT)*beta_c(1.0)*f'c", value: tb.fce },
      { source: "b_s = min(t_w, b_gb)", value: tb.bs },
      { source: "band [lo, hi] above bottom of GB", value: "[" + fmt(lo, 4) + ", " + fmt(hi, 4) + "] in" }
    ];
    var outside = [];
    if (layers && layers.length > 1) {
      layers.forEach(function (Ly, i) {
        var d = (Ly.y < lo) ? (lo - Ly.y) : (Ly.y > hi ? Ly.y - hi : 0);
        var tag = "layer " + (i + 1) + " (" + Ly.count + "-" + Ly.size + " @ y = " + fmt(Ly.y, 4) + " in)";
        contributions.push({ source: tag, value: d > 1e-9 ? "OUTSIDE band by " + fmt(d, 4) + " in" : "inside band" });
        if (d > 1e-9) outside.push(tag + " lies " + fmt(d, 4) + " in " + (Ly.y < lo ? "below" : "above") + " the band");
      });
    } else {
      contributions.push({ source: "single layer — inside band by construction", value: tb.ybar });
    }
    var row = checkRow("tie.width",
      "Tie effective width w_t ≤ w_t,max" + (tb.capped ? " (node width capped to w_t,max)" : ""),
      "ACI 318-19 23.8.2", tb.wtGov, tb.wtMax,
      { units: "in", informational: true, state: "informational", contributions: contributions });
    row.capped = tb.capped;
    row.nearLimit = false;
    row.pass = (outside.length === 0);
    if (outside.length) {
      row.message = "counted tie steel lies outside the effective tie width band [" + fmt(lo, 4) + ", " + fmt(hi, 4) +
        "] in: " + outside.join("; ") + ". Move the layers together, add steel (larger F_nt widens w_t,max), or model them as separate ties.";
      row.contributions.push({ source: "band membership", value: row.message });
    }
    return row;
  }

  // F1.5 mandatory anti-circularity disclosure. When the back face is capped to w_t,max the
  // back-face stress is T/(w_t,max*b_s) = f_ce*(T/F_nt), so the back-face DCR equals EXACTLY
  // the tie-strength DCR T/(0.75*As*fy) (beta_c is locked at 1.0, which makes it exact).
  // The two rows stop being independent checks and the node row must say so.
  function discloseCollapse(ctx, row) {
    if (!ctx.tieBand.capped) return row;
    row.collapsedOntoTie = true;
    row.contributions = (row.contributions || []).concat([{
      source: "anti-circularity disclosure (ACI 318-19 23.8.2)",
      value: "back face capped to w_t,max: stress = T/(w_t,max*b_s) = f_ce*(T/F_nt), so this face's DCR equals EXACTLY the tie-strength DCR T/(0.75*As*fy) — the node back face is no longer an independent check."
    }]);
    return row;
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
    // F1: §23.8.2 effective tie width of the node-anchored bottom tie
    checks.push(tieWidthRow(ctx));

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
      discloseCollapse(ctx, row);
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
      checks.push(discloseCollapse(ctx, checkRow("node.support.L", "Overhang-side support nodal zone (subdivided multi-face, governing: " + wfO.name + ")", "ACI 318-19 23.9 / Table 23.9.2",
        wfO.stress, limO, { units: "ksi", contributions: facesO })));
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
        var haTop = ctx.topBand.wtGov;   // §23.8.2-limited top-tie node face (F1.3)
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
    pushWebRows(ctx, betaInfo, checks);

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
    pushDetailingRows(ctx, checks);

    return checks;
  }

  // ---- shared row builders (identical text/order for every case) ----------------------------
  function pushWebRows(ctx, betaInfo, checks) {
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
    return checks;
  }

  function pushDetailingRows(ctx, checks) {
    var d5 = Math.min(ctx.dEff / 5, 12);
    var n = ctx.tieBars.rowCount || ctx.tieBars.count, dbb = ctx.tieBars.db;
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

  // ------------------------------------------------- Case D checks (F2.5)
  function buildChecksD(ctx, combo, mask, betaInfo, run, envInfo) {
    var checks = [], cd = ctx.caseD, n = cd.nSpans, L = cd.L, lb = cd.lb;
    var i;

    // (1) deep-beam applicability per span (§9.9.1.1), clear span between BEARING FACES
    var ln = L - lb;
    var clauseA = ln <= 4 * ctx.h + 1e-9;
    var hasPt = false;
    for (i = 0; i < n; i++) if (run.P[i] > 0) hasPt = true;
    var loadDist = L / 2 - lb / 2;                       // midspan load to the nearest bearing face
    var clauseB = hasPt && loadDist <= 2 * ctx.h + 1e-9;
    var appRow = checkRow("applicability", "Deep-beam applicability per span (ln ≤ 4h or concentrated load within 2h)", "ACI 318-19 9.9.1.1 / 23.1",
      clauseA ? ln : (clauseB ? loadDist : ln), clauseA ? 4 * ctx.h : (clauseB ? 2 * ctx.h : 4 * ctx.h),
      { units: "in", contributions: [{ source: "clause", value: clauseA ? "(a) ln<=4h" : (clauseB ? "(b) concentrated load within 2h" : "none — NOT a deep beam") }, { source: "ln = L - lb (all spans equal)", value: ln }] });
    appRow.pass = clauseA || clauseB;
    checks.push(appRow);

    // (2) bottom tie + F1 band check
    var iT = 0; for (i = 0; i < n; i++) if (run.pos[i].T > run.pos[iT].T) iT = i;
    checks.push(checkRow("tie.bottom", "Bottom tie φFnt ≥ Tpos (governing span " + (iT + 1) + ")", "ACI 318-19 23.7.2 / 23.8.2",
      run.pos[iT].T, PHI_STM * ctx.tieBars.As * ctx.fy,
      {
        units: "kip", contributions: run.pos.map(function (p, j) {
          return { source: "span " + (j + 1) + " (" + p.gov + ")", value: p.T, Mpos_kin: p.M, Mss_kin: p.Mss, Mdesign_kin: p.Mdes, z_in: p.z, a_in: p.a, phiMn_neg_L: p.phiMnL, phiMn_neg_R: p.phiMnR };
        })
      }));
    checks.push(tieWidthRow(ctx));

    // (3) negative chord — NO band check (F1.1: it terminates at no node; F2.4b governs)
    var negRow = checkRow("tie.negative", "Negative chord φFnt ≥ Tneg (governing pier " + run.iNegMax + ")", "ACI 318-19 23.7.2",
      run.TnegMax, PHI_STM * cd.negChord.As * ctx.fy,
      {
        units: "kip", contributions: [
          { source: "As,neg", value: cd.negChord.As },
          { source: "y_neg (above bottom of GB)", value: cd.negChord.y },
          { source: "zNeg", value: run.neg[run.iNegMax].z },
          { source: "a- (on b_gb)", value: run.neg[run.iNegMax].a },
          { source: "M- (hogging)", value: run.neg[run.iNegMax].M },
          { source: "no §23.8.2 band check (F1.1)", value: "the negative chord is a distributed tension field running THROUGH the interior piers; it anchors into no nodal zone, so there is no back face to limit. Distribution is governed instead by depth_in ≤ 0.25h (F2.4b)." }
        ].concat(cd.negChord.parts.map(function (p) { return { source: p.src, value: p.As, y_in: p.y }; }))
      });
    checks.push(negRow);

    // (4) positive compression chord fits the wall envelope
    var iA = 0; for (i = 0; i < n; i++) if (run.pos[i].a > run.pos[iA].a) iA = i;
    checks.push(checkRow("chord.pos.fit", "Positive compression chord a⁺ within the wall (span " + (iA + 1) + ")", "ACI 318-19 23.4.3",
      run.pos[iA].a, ctx.hw, { units: "in", contributions: [{ source: "a+ = Tpos/(f_ce*t_w)", value: run.pos[iA].a }, { source: "z+", value: run.pos[iA].z }, { source: "f_ce (design)", value: run.fce }] }));

    // (5) negative compression chord: a- ≤ h_gb, on b_gb. The STRESS equals f_ce exactly
    // because a- IS sized at f_ce — it is reported, not used as the DCR (that would be a
    // DCR = 1.0 by construction; same disclosure pattern as the crown row, AUDIT-FIXES C).
    var iAn = 0; for (i = 0; i <= n; i++) if (run.neg[i].a > run.neg[iAn].a) iAn = i;
    checks.push(checkRow("chord.neg.fit", "Negative compression chord a⁻ ≤ h_gb (pier " + iAn + ")", "ACI 318-19 23.4.3",
      run.neg[iAn].a, ctx.hgb, {
        units: "in", contributions: [
          { source: "a- = Tneg/(f_ce*b_gb)", value: run.neg[iAn].a },
          { source: "stress on b_gb = f_ce by the sizing step (not an independent check)", value: run.fce },
          { source: "zNeg", value: run.neg[iAn].z }
        ]
      }));

    // (6) diagonal struts §23.4.3 — the shear transfer Cases A/B get from the arch band
    var wd = null;
    run.supports.forEach(function (s) {
      s.diagonals.forEach(function (d) {
        if (!wd || d.dcr > wd.d.dcr) wd = { s: s, d: d };
      });
    });
    checks.push(checkRow("strut.diagonal", "Diagonal strut (pier " + wd.s.index + ", side " + wd.d.side + ", " + wd.s.type + ")", "ACI 318-19 23.4.3",
      wd.d.stress, run.fce, {
        units: "ksi", contributions: [].concat.apply([], run.supports.map(function (s) {
          return s.diagonals.map(function (d) {
            return { source: "pier " + s.index + " " + d.side + " (" + s.type + ")", value: d.dcr, V_kip: d.V, H_kip: d.H, theta_deg: d.theta, F_kip: d.F, ws_in: d.ws, stress_ksi: d.stress };
          });
        }))
      }));

    // §23.2.7 minimum angle across every diagonal (end springings included via theta_end)
    checks.push(checkRow("angles.strutTie", "Minimum strut-tie angle", "ACI 318-19 23.2.7",
      THETA_MIN, run.minAngle, { units: "deg", contributions: [{ source: "theta_end L", value: run.thetaEnd[0] }, { source: "theta_end R", value: run.thetaEnd[1] }] }));

    // (7)+(8) nodes at every pier
    run.supports.forEach(function (s) {
      // R4.1 — governing-face selection SKIPS faces that are sized-to-fit by construction, and
      // falls back to them only if EVERY face is by-construction. Same pattern the crown band row
      // already uses (AUDIT-FIXES §C): a face whose DCR is fixed by the sizing step carries no
      // load information, so letting it win the max() puts a load-INDEPENDENT floor (here exactly
      // beta_s) into the row demand and, through summary.governing, into the whole calculation.
      // Under light load the chord face used to report 0.750 while the real load faces sat at
      // 0.19/0.11. The by-construction face stays in `contributions` and gets its own disclosure
      // line — nothing is hidden; it is simply not eligible to be called "governing".
      var loadFaces = s.node.faces.filter(function (f) { return !f.byConstruction; });
      var pool = loadFaces.length ? loadFaces : s.node.faces;
      var byCon = s.node.faces.filter(function (f) { return f.byConstruction; });
      var wf = pool[0];
      pool.forEach(function (f) { if (f.dcr > wf.dcr) wf = f; });
      var id = (s.index === 0) ? "node.support.L" : (s.index === cd.nSpans ? "node.support.R" : "node.interior." + s.index);
      var lbl = (s.type === "end")
        ? "End-pier nodal zone " + (s.index === 0 ? "L" : "R") + " (CCT, governing face: " + wf.name + ")"
        : "Interior pier nodal zone " + s.index + " (CCC, governing load-bearing face: " + wf.name + ")";
      var row = checkRow(id, lbl, "ACI 318-19 23.9 / Table 23.9.2", wf.stress, s.node.lim,
        { units: "ksi", contributions: s.node.faces.slice() });
      row.governingFace = wf.name;
      if (byCon.length) {
        // R4.1 disclosure line — the by-construction face(s), reported and excluded.
        row.byConstructionFaces = byCon.map(function (f) { return f.name; });
        row.contributions.push({
          source: "disclosure — face(s) sized to fit, EXCLUDED from governing-face selection",
          value: byCon.map(function (f) {
            return f.name + ": stress = " + fmt(f.stress, 4) + " ksi, DCR = " + fmt(f.dcr, 4);
          }).join("; ") + ". a⁻ IS sized at f_ce = φ·0.85·β_s·f'c and then checked against the CCC limit φ·0.85·1.0·f'c, so this face reads exactly β_s = " +
            fmt(betaInfo.betaS, 3) + " in EVERY run whatever the load. It is a sizing identity, not a demand, so it is reported here and excluded from the governing-face max() (AUDIT-FIXES §C pattern) — otherwise every interior-node row would carry a load-independent floor of β_s and could reach summary.governing. The governing face above is chosen from the load-bearing faces (bearing, diagonals) only."
        });
      }
      if (s.type === "end") discloseCollapse(ctx, row);
      else row.contributions.push({
        source: "face thicknesses + stated modelling assumption (F2.5.8)",
        value: "Each face is checked on ITS OWN thickness: the horizontal bottom-chord faces on b_gb = " + fmt(ctx.bgb, 2) +
          " in (the negative compression chord lives in the grade beam and is delivered along it into the pier — the thinner wall above does not confine it, and a⁻ is sized on the same width); the diagonal strut faces on t_w = " + fmt(ctx.tw, 2) +
          " in (those struts run through the wall); the bearing face on min(t_w, b_gb) = " + fmt(ctx.tNode, 2) +
          " in, the same conservative node interface width Cases A/B use and the same width as the §22.8 bearing row. " +
          "The t_w -> b_gb width transition across the node (wall " + fmt(ctx.tw, 2) + " in into grade beam " + fmt(ctx.bgb, 2) +
          " in) is a STATED MODELLING ASSUMPTION, not a check: the model assumes the chord force spreads into the full grade-beam width within the node region. " +
          "The chord face reads exactly β_s = " + fmt(betaInfo.betaS, 3) + " by construction (a⁻ is sized at f_ce = φ·0.85·β_s·f'c and checked against the CCC limit φ·0.85·1.0·f'c), so it can never govern — it is flagged byConstruction and excluded from the governing-face selection above (R4.1); the bearing and diagonal faces are the load-governed ones."
      });
      checks.push(row);
    });

    // R4.2 (a) — THE LOAD-BEARING STATICS ASSERTION. Reactions rebuilt from support moments that
    // were re-derived by the three-moment (force) method — a different formulation, a different
    // solver, no shared code with the direct-stiffness path — and compared against the reactions
    // assembled from the span shears. Unlike ΣV/ΣH below this residual is NOT identically zero:
    // a wrong fixed-end moment, a wrong stiffness term or a flipped FEM sign moves it to tens of
    // kips while leaving every other residual in this engine at exactly zero.
    var xcRow = checkRow("statics.reactionCrossCheck",
      "Reaction cross-check — reactions re-derived from an independent three-moment (force-method) solution",
      "statics (F2.5.13 / R4.2)",
      run.selfChecks.reactionCrossCheck_kip, run.selfChecks.crossCheckTol_kip,
      {
        units: "kip", contributions: [
          {
            source: "why this one has teeth",
            value: "The direct-stiffness solve is a DISPLACEMENT method; every statics residual computed downstream of it (ΣV, ΣM, the interior-node ΣV/ΣH) closes identically for ANY set of end moments, right or wrong, because the shears are derived FROM those moments. This row instead re-solves the support moments with Clapeyron's three-moment equation (M_{i-1} + 4M_i + M_{i+1} = −[w_{i-1}L²/4 + 3P_{i-1}L/8 + w_i L²/4 + 3P_i L/8], simple ends) and rebuilds R_i = Σ_adjacent [wL/2 + P/2 ∓ (M_far − M_near)/L] from them. A mis-scaled or mis-signed fixed-end moment, or a bad stiffness/b-vector term, trips this and nothing else."
          },
          { source: "max |R (three-moment) − R (shear-assembled)|", value: run.selfChecks.reactionCrossCheck_kip },
          { source: "max |M_sup (three-moment) − M_sup (stiffness)|, kip-in", value: run.selfChecks.momentCrossCheck_kin },
          { source: "tolerance", value: run.selfChecks.crossCheckTol_kip }
        ].concat(run.xchk.R3.map(function (r3, ii) {
          return { source: "pier " + ii, value: r3, R_assembled_kip: run.R[ii], Msup_threeMoment_kin: run.xchk.M3[ii], Msup_stiffness_kin: run.Msup[ii] };
        }))
      });
    checks.push(xcRow);

    // R4.2 (b) — the ΣV/ΣH row, relabelled honestly. It is retained because it documents how the
    // interior node was assembled, but it CANNOT fail and is not evidence of anything.
    var closeRow = checkRow("node.interior.closure",
      "Interior node ΣV/ΣH — closes by construction (model consistency, not a check)", "statics (F2.5.8)",
      run.selfChecks.interiorNodeClosure_kip, 1e-8 * Math.abs(run.st.W) + 0.001,
      {
        units: "kip", informational: true, state: "informational",
        contributions: [{
          source: "why this is not a check",
          value: "ΣV = R_i − V_L − V_R is identically zero because R_i is ASSEMBLED as V_L + V_R from those same span shears, and ΣH is float noise because both diagonals take their horizontal component from the same chord force C⁻ = Tneg. The same is true of results.model.selfChecks.globalV_kip. These confirm the node was built the way the model says it was — they are model-consistency statements, not verification. The load-bearing assertions are: statics.reactionCrossCheck (independent three-moment reaction cross-check), the joint-equilibrium residual (adjacent spans must report the same support moment) and globalM (moment about the left pier CL, which is NOT identically zero because it re-integrates the applied loads)."
        }].concat(run.supports.filter(function (s) { return s.type === "interior"; }).map(function (s) {
          return { source: "pier " + s.index, sumV_kip: s.sumV, sumH_kip: s.sumH, R_kip: run.R[s.index], H_L: s.HL, H_R: s.HR, C_chord: run.neg[s.index].T };
        }))
      });
    closeRow.nearLimit = false;
    checks.push(closeRow);

    // (9) bearing at every pier (§22.8), end and interior reported separately
    var brgCapD = PHI_BRG * 0.85 * ctx.fcKsi * lb * ctx.tNode;
    var llTag = (ctx.wL_pli > 0) ? " (routed LL always applied)" : "";
    for (i = 0; i <= n; i++) {
      var isEnd = (i === 0 || i === n);
      var rtd = isEnd ? (i === 0 ? run.routed.L.total : run.routed.R.total) : 0;
      checks.push(checkRow("bearing.pier." + i, "Pier bearing " + i + (isEnd ? " (end: R_end + routed l_b/2 strip)" : " (interior)") + (isEnd ? llTag : ""), "ACI 318-19 22.8",
        run.Rbrg[i], brgCapD, {
          units: "kip", contributions: [
            { source: "R_elastic", value: run.R[i] },
            { source: "R_floor (F2.4c)", value: isEnd ? run.Rfloor[i] : 0 },
            { source: "R_used", value: run.Rused[i] },
            { source: "routed", value: rtd }
          ]
        }));
    }

    // (7) end-pier bottom-tie anchorage — Cases A/B machinery, callable because theta_end exists
    var anL = anchorageEnd(ctx, "L", run.thetaEnd[0], run.pos[0].T, run);
    var anR = anchorageEnd(ctx, "R", run.thetaEnd[1], run.pos[n - 1].T, run);
    checks.push(checkRow("anchorage.L", "Bottom-tie anchorage, left end pier (" + ctx.anchL.type + ")", "ACI 318-19 23.8.3 + Ch. 25",
      anL.req, anL.avail, { units: "in", contributions: [anL.detail], state: anL.state, forceFail: anL.forceFail }));
    checks.push(checkRow("anchorage.R", "Bottom-tie anchorage, right end pier (" + ctx.anchR.type + ")", "ACI 318-19 23.8.3 + Ch. 25",
      anR.req, anR.avail, { units: "in", contributions: [anR.detail], state: anR.state, forceFail: anR.forceFail }));
    run.anchorage = { left: anL.detail, right: anR.detail };

    // (10) top-steel extension past each interior pier, from the NEGATIVE-MOMENT ENVELOPE
    var ext = envInfo.extensions, worstExt = null, worstBreg = null;
    ext.forEach(function (e) {
      if (!worstExt || e.required > worstExt.required) worstExt = e;
      if (!worstBreg || e.required_bregion > worstBreg.required_bregion) worstBreg = e;
    });
    var extRow = checkRow("topsteel.extension", "Top-steel extension past interior piers (envelope inflection + max(ℓd, 12db); ℓd from the pier face)", "ACI 318-19 23.8.3 + Ch. 25",
      worstExt.required, cd.negChord.extension_in, {
        units: "in", contributions: [
          { source: "shift past the cut-off point", value: "max(ℓd, 12db) = max(" + fmt(ext[0].ld, 3) + ", " + fmt(12 * (cd.negChord.db || ctx.webH.db), 3) + ") = " + fmt(ext[0].devShift_ld, 3) + " in — develop the bar for its force (D-region: the STM models the load path directly, and x_infl already carries the worst pattern)" }
        ].concat(ext.map(function (e) {
          return {
            source: "pier " + e.pier + " side " + e.side + (e.noInflection ? " — NO INFLECTION in the span" : ""),
            value: e.required, x_infl_in: e.x_infl, devRule_in: e.req_devRule, ld_rule_in: e.req_ld, governs: e.governs,
            note: e.noInflection
              ? "the negative-moment envelope never returns to zero in this span (an adjacent span loaded, this one bare): top steel is required across the FULL span plus development past the next pier"
              : "x_infl is the zero crossing of the negative-moment ENVELOPE (max over all combos and patterns), not of the all-loaded pattern"
          };
        }))
      });
    checks.push(extRow);
    // §9.7.3.8.4 B-region comparison — INFORMATIONAL only (F2.5.10 Rev 3). Reported so the
    // engineer can see the flexural-member cut-off rule and overrule if they prefer it; it is
    // excluded from governing-DCR and near-limit selection.
    var bregRow = checkRow("topsteel.extension.bregion",
      "Top-steel extension — §9.7.3.8.4 B-region comparison (x_infl + max(d, 12db)), informational",
      "ACI 318-19 9.7.3.8.4 (comparison only)",
      worstBreg.required_bregion, cd.negChord.extension_in, {
        units: "in", informational: true, state: "informational",
        contributions: [
          // R4.7 NIT-8: this label used to print max(d, 12db) under a "d = y_neg =" caption via a
          // ternary whose else-branch (printing 0) was unreachable, since devShift_d is defined as
          // max(d, 12db) and is therefore always >= 12db. Both quantities are now named correctly.
          {
            source: "why this is not the governing rule",
            value: "§9.7.3.8.4's d-shift accounts for tension shift from diagonal cracking in a B-region. In a D-region the strut-and-tie model carries the load path explicitly and x_infl comes from the negative-moment ENVELOPE, so the shift is max(ℓd, 12db). Here d = y_neg = " +
              fmt(cd.negChord.y, 2) + " in and 12db = " + fmt(12 * (cd.negChord.db || ctx.webH.db), 2) +
              " in, so the B-region shift max(d, 12db) = " + fmt(ext[0].devShift_d, 2) + " in on a " + fmt(ctx.h / 12, 2) + " ft deep member."
          },
          { source: "governing (ℓd-based) requirement", value: worstExt.required },
          { source: "B-region (d-based) comparison", value: worstBreg.required_bregion }
        ].concat(ext.map(function (e) {
          return { source: "pier " + e.pier + " side " + e.side, value: e.required_bregion, x_infl_in: e.x_infl, noInflection: e.noInflection };
        }))
      });
    bregRow.pass = true;
    bregRow.nearLimit = false;
    checks.push(bregRow);

    // (11) bottom-bar continuity + Class B lap note
    var lapRow = checkRow("detailing.bottomContinuity", "Bottom bars run through the interior piers — no ℓdh required there; Class B tension lap over the piers", "ACI 318-19 25.5.2 / 23.8.3",
      envInfo.lap.classB, envInfo.lap.classB, {
        units: "in", informational: true, state: "informational",
        contributions: [
          { source: "interior piers", value: "the bottom tie is continuous through every interior pier — it terminates only at the two END piers, where ℓdh/ℓdt/ℓd is checked (anchorage.L / anchorage.R). No hook development is required at an interior pier." },
          { source: "ℓd (straight, bottom bars)", value: envInfo.lap.ld },
          { source: "Class B lap = 1.3ℓd", value: envInfo.lap.classB },
          { source: "splice location", value: "lap over the interior piers, where the bottom fiber is in COMPRESSION under the negative moment" }
        ]
      });
    lapRow.pass = true; lapRow.nearLimit = false;
    checks.push(lapRow);

    // end-strip routing disclosure (F2.1)
    var stripRow = checkRow("caseD.endStrip", "Wall strip outboard of each end-pier CL routes to that bearing (o = 0 by construction)", "PLAN §1 routing rule (F2.1)",
      0, Math.min(ctx.hgb, lb), {
        units: "in", informational: true, state: "informational",
        contributions: [{ source: "strip length (CL to wall end)", value: lb / 2 }, { source: "beyond the bearing outer face", value: 0 }, { source: "note", value: "L_w = nSpans*L + l_b puts the wall end flush with the outer bearing face, so the strip lies entirely over the bearing: it is outside the CL-to-CL analysis span and is added to the end-pier bearing demand." }]
      });
    stripRow.pass = true; stripRow.nearLimit = false;
    checks.push(stripRow);

    // F2.6 scope note (must render in results)
    var scopeRow = checkRow("caseD.scope", "Case D scope and exclusions", "PLAN / FEATURES-v2 F2.6",
      0, 1, { units: "", informational: true, state: "informational", contributions: CASE_D_SCOPE.map(function (s) { return { source: "note", value: s }; }) });
    scopeRow.pass = true; scopeRow.nearLimit = false;
    checks.push(scopeRow);

    // (12) web reinforcement + global shear cap (per span, larger adjacent reaction) + detailing
    pushWebRows(ctx, betaInfo, checks);
    var Vu = 0;
    for (i = 0; i <= n; i++) Vu = Math.max(Vu, (i === 0 || i === n) ? run.Rused[i] : run.R[i]);
    var Vcap = PHI_SHEAR * 10 * Math.sqrt(ctx.fc) * ctx.tw * ctx.dEff / 1000;
    checks.push(checkRow("shear.cap", "Global shear cap Vu ≤ φ·10√f'c·bw·d (per span, larger adjacent reaction)", "ACI 318-19 9.9.2.1",
      Vu, Vcap, { units: "kip", contributions: [{ source: "sqrt(fc)_psi", value: Math.sqrt(ctx.fc) }, { source: "d_in", value: ctx.dEff }] }));
    pushDetailingRows(ctx, checks);

    return checks;
  }

  var CASE_D_SCOPE = [
    "Case D computes chord forces from the ELASTIC moment envelope and checks ties, chords, diagonal struts, nodes at every pier, bearing and development.",
    "It does NOT construct a full multi-span funicular polygon.",
    "Out of scope: unequal spans; more than one point load per span; outboard strips / overhangs; moving loads.",
    "Also out of scope, and disclosed rather than left silent: crack control and serviceability on the top-of-wall tension face that Case D introduces.",
    "Analysis is flexure-only (F2.2). Shear flexibility at ln/h ≈ 1.6 reduces continuity: elastic M⁻ is therefore conservative, elastic M⁺ is not (handled by the F2.4a capacity-consistent floor) and elastic end reactions are not (handled by the F2.4c reaction floor)."
  ];

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
      tieBand: ctx.tieBand, topBand: ctx.topBand,
      ha_in: run.ha, wsL_in: run.wsL, wsR_in: run.wsR,
      RtL_kip: caseC ? run.RL : run.st.RL, RtR_kip: caseC ? run.RR : run.st.RR,
      RbL_kip: run.RbL, RbR_kip: run.RbR,
      nodes: [], members: [], arch: [], bands: [], nodePolygons: [],
      anchorage: run.anchorage, routed: run.routed, selfChecks: run.selfChecks
    };
    var x0 = ctx.xL, yTie = ctx.yt;
    // R4.4 — extended nodal zone = the §23.8.2 band centred on the tie centroid (see the note at
    // the support-node polygons below). Declared here because the Case C overhang-support polygon
    // uses it too.
    var nzLo = ctx.yt - run.ha / 2, nzHi = ctx.yt + run.ha / 2;
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
        poly: [[x0 - ctx.lbL / 2, nzLo], [x0 + ctx.lbL / 2, nzLo], [x0 + ctx.lbL / 2, nzHi], [x0 - ctx.lbL / 2, nzHi]],
        // B3: sub-face layout documented for drawing — lbFrom/lbTo measured across the
        // bearing from its outboard (overhang-side) edge; the top-tie face has no bearing strip.
        faces: run.subFaces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.area, stress_ksi: f.stress, lbSub_in: f.lbSub, lbFrom_in: f.lbFrom, lbTo_in: f.lbTo }; })
      });
    }
    // support node polygons (both cases; simple rectangles bearing x ha for drawing).
    // R4.4: the extended nodal zone is the §23.8.2 band CENTRED ON THE TIE CENTROID, i.e.
    // [ybar_t - w_t,gov/2, ybar_t + w_t,gov/2] — NOT [0, ha]. Uncapped, w_t,gov = 2*ybar_t and the
    // two are identical (the default case is bit-for-bit unchanged). CAPPED, the zone is smaller
    // than 2*ybar_t and no longer reaches the bottom of the grade beam; drawing it as [0, h_a]
    // put its top edge at w_t,gov instead of ybar_t + w_t,gov/2 and overstated the zone.
    var nzLo = ctx.yt - run.ha / 2, nzHi = ctx.yt + run.ha / 2;
    model.nodeBand = { lo_in: nzLo, hi_in: nzHi, ybar_in: ctx.yt, wtGov_in: run.ha, capped: !!ctx.tieBand.capped };
    model.nodePolygons.push({
      id: "node.support.L", cls: caseC ? "CCT-multiface" : "CCT",
      poly: [[ctx.xL - ctx.lbL / 2, nzLo], [ctx.xL + ctx.lbL / 2, nzLo], [ctx.xL + ctx.lbL / 2, nzHi], [ctx.xL - ctx.lbL / 2, nzHi]],
      faces: [{ name: "bearing", width_in: ctx.lbL, Acn_in2: ctx.lbL * ctx.tNode }, { name: "strut", width_in: run.wsL, Acn_in2: run.wsL * ctx.tw }, { name: "back (tie)", width_in: run.ha, Acn_in2: run.ha * ctx.tNode }]
    });
    model.nodePolygons.push({
      id: "node.support.R", cls: "CCT",
      poly: [[ctx.xR - ctx.lbR / 2, nzLo], [ctx.xR + ctx.lbR / 2, nzLo], [ctx.xR + ctx.lbR / 2, nzHi], [ctx.xR - ctx.lbR / 2, nzHi]],
      faces: [{ name: "bearing", width_in: ctx.lbR, Acn_in2: ctx.lbR * ctx.tNode }, { name: "strut", width_in: run.wsR, Acn_in2: run.wsR * ctx.tw }, { name: "back (tie)", width_in: run.ha, Acn_in2: run.ha * ctx.tNode }]
    });
    return model;
  }

  // ---- Case D cross-run envelope work: inflection positions, required top-steel extension,
  // Class B lap, and the sampled moment envelope for the drawing layer.
  function caseDEnvelope(ctx, sols) {
    var cd = ctx.caseD, n = cd.nSpans, L = cd.L, lb = cd.lb;
    var envs = negEnvelope(ctx, sols);
    // development of the negative (top) steel: straight bars, psi_t = 1.3
    var dbN = cd.negChord.db || ctx.webH.db;
    var cbN = Math.min(ctx.wallCover + dbN / 2, ctx.webH.s / 2);
    var ldN = ldStraight(ctx, { db: dbN }, { top: true, epoxy: false, cb: cbN }).l;
    var dNeg = cd.negChord.y;                       // d to the negative steel (compression at the GB bottom)
    // F2.5(10) Rev 3: the governing shift past the point the bar is no longer required is
    // max(ld, 12db) — develop the bar for its force. §9.7.3.8.4's max(d, 12db) is a B-REGION
    // rule whose d-shift covers tension shift from diagonal cracking; in a D-region the STM
    // models the load path directly and the envelope-based x_infl already carries the worst
    // live-load pattern. On a 16 ft deep member d ~ 182 in, so the B-region form produced a
    // ~260 in requirement that governed the summary of every Case D run. It is retained as an
    // INFORMATIONAL comparison so the engineer can see it and overrule.
    var devLd = Math.max(ldN, 12 * dbN);            // Rev 3 governing shift
    var devD = Math.max(dNeg, 12 * dbN);            // §9.7.3.8.4 B-region comparison (informational)
    var extensions = [], inflections = [];
    for (var p = 1; p < n; p++) {
      [{ side: "L", span: p - 1, fromLeft: false }, { side: "R", span: p, fromLeft: true }].forEach(function (sd) {
        var c = envs.cross(sd.span, sd.fromLeft);
        var reqDev = c.none ? (L + ldN) : (c.x + devLd);
        var reqLd = lb / 2 + ldN;
        var required = Math.max(reqDev, reqLd);
        // no inflection -> top steel runs the full span anyway, so the d-shift adds nothing
        var bregion = c.none ? (L + ldN) : Math.max(c.x + devD, reqLd);
        extensions.push({
          pier: p, side: sd.side, x_infl: c.none ? null : c.x, noInflection: !!c.none,
          ld: ldN, devShift_ld: devLd, devShift_d: devD,
          req_devRule: reqDev, req_ld: reqLd, required: required, required_bregion: bregion,
          provided: cd.negChord.extension_in,
          governs: c.none ? "full span (no inflection) + ℓd past the next pier" : (reqDev >= reqLd ? "x_infl + max(ℓd, 12db)" : "ℓd from the pier face")
        });
        if (!c.none) inflections.push({ x_in: cd.pierX[p] + (sd.side === "R" ? c.x : -c.x), pier: p, side: sd.side });
      });
    }
    var ldBot = ldStraight(ctx, ctx.tieBars, {
      top: false, epoxy: false, cb: cbBottom(ctx),
      clearCover: Math.min(ctx.coverBot, ctx.coverSide),
      clearSpacing: barSpacingCC(ctx, ctx.tieBars) - ctx.tieBars.db
    }).l;
    // ---- per-span / per-support ENVELOPES across every combo and pattern.
    // Scalars (moments, tie forces, reactions) are enveloped independently — each is a monotone
    // demand. Geometry that must stay mutually consistent (zPos/aPos, aNeg/zNeg, the diagonals
    // and the node faces) is reported from a SINGLE governing run, so the drawing layer always
    // has a real, self-consistent load case rather than a mix.
    function pick(best, cand, val, better) { return (!best || better(val, best.v)) ? { v: val, r: cand } : best; }
    var gt = function (a, b) { return a > b; }, lt = function (a, b) { return a < b; };
    var spanEnv = [], supEnv = [];
    for (var s1 = 0; s1 < n; s1++) {
      var bMpos = null, bT = null, bVL = null, bVR = null;
      sols.forEach(function (r) {
        bMpos = pick(bMpos, r, r.pos[s1].M, gt);
        bT = pick(bT, r, r.pos[s1].T, gt);
        bVL = pick(bVL, r, r.VL[s1], gt);
        bVR = pick(bVR, r, r.VR[s1], gt);
      });
      spanEnv.push({ Mpos: bMpos, T: bT, VL: bVL, VR: bVR });
    }
    for (var s2 = 0; s2 <= n; s2++) {
      var bMneg = null, bTn = null, bRu = null, bRb = null;
      sols.forEach(function (r) {
        bMneg = pick(bMneg, r, r.Msup[s2], lt);
        bTn = pick(bTn, r, r.neg[s2].T, gt);
        bRu = pick(bRu, r, r.Rused[s2], gt);
        // the support's REPORTING run: heaviest bearing demand. A physical, monotone criterion —
        // deliberately NOT "max node-face DCR", because the interior chord face reads exactly
        // beta_s by construction in EVERY run (it is sized at f_ce), so that tie would be decided
        // by last-bit iteration noise instead of by load. R4.1 additionally excludes that face
        // from the governing-face selection inside each row.
        bRb = pick(bRb, r, r.Rbrg[s2], gt);
      });
      supEnv.push({ Mneg: bMneg, T: bTn, Rused: bRu, Rbrg: bRb, gov: bRb.r });
    }
    return {
      envs: envs, extensions: extensions, inflections: inflections,
      spanEnv: spanEnv, supEnv: supEnv,
      lap: { ld: ldBot, classB: 1.3 * ldBot }
    };
  }

  function buildModelD(ctx, combo, mask, run, betaInfo, envInfo) {
    var cd = ctx.caseD, n = cd.nSpans, L = cd.L, i;
    var model = {
      combo: combo.id, pattern: maskId(mask), caseLabel: "D",
      Ls_in: cd.pierX[n] - cd.pierX[0], h_in: ctx.h, hp_in: ctx.hp, yt_in: ctx.yt,
      z_in: run.z, a_in: run.a, H_kip: run.H, T_kip: run.T,
      Mmax_kin: run.Mmax, MmaxX_in: run.MmaxX,
      wu_klf: run.w[0] * 12,
      thetaL_deg: run.thetaL, thetaR_deg: run.thetaR,
      AsTie_in2: ctx.tieBars.As, AsTop_in2: ctx.topBars.As,
      betaS: betaInfo.betaS, fce_ksi: run.fce,
      tieBand: ctx.tieBand, topBand: ctx.topBand,
      ha_in: run.ha, wsL_in: run.wsL, wsR_in: run.wsR,
      RtL_kip: run.Rused[0], RtR_kip: run.Rused[n],
      RbL_kip: run.Rbrg[0], RbR_kip: run.Rbrg[n],
      nodes: [], members: [], arch: [], bands: [], nodePolygons: [],
      anchorage: run.anchorage, routed: run.routed, selfChecks: run.selfChecks
    };
    var yTie = ctx.yt;
    model.nodeBand = { lo_in: ctx.yt - run.ha / 2, hi_in: ctx.yt + run.ha / 2, ybar_in: ctx.yt, wtGov_in: run.ha, capped: !!ctx.tieBand.capped };
    var spans = [], supports = [];
    var tag = function (r) { return { combo: r.combo.id, pattern: maskId(r.mask) }; };
    for (i = 0; i < n; i++) {
      var se = envInfo.spanEnv[i], gT = se.T.r;      // Tpos-governing run: one consistent case
      spans.push({
        index: i, x0_in: cd.pierX[i], x1_in: cd.pierX[i + 1],
        Mpos_env_kin: se.Mpos.v, Mpos_x_in: cd.pierX[i] + se.Mpos.r.MposX[i],
        Mpos_combo: tag(se.Mpos.r).combo, Mpos_pattern: tag(se.Mpos.r).pattern,
        Tpos_kip: se.T.v, Tpos_combo: tag(gT).combo, Tpos_pattern: tag(gT).pattern,
        zPos_in: gT.pos[i].z, aPos_in: gT.pos[i].a,
        Mss_kin: gT.pos[i].Mss, MposDesign_kin: gT.pos[i].Mdes, floorGoverns: gT.pos[i].gov,
        phiMn_neg_L_kin: gT.pos[i].phiMnL, phiMn_neg_R_kin: gT.pos[i].phiMnR,
        VfaceL_kip: se.VL.v, VfaceR_kip: se.VR.v,
        MA_ref_kin: run.MA[i], MB_ref_kin: run.MB[i], wu_ref_klf: run.w[i] * 12, Pu_ref_kip: run.P[i]
      });
      model.members.push({ id: "tie.bottom.span" + (i + 1), type: "tie", from: "P" + i, to: "P" + (i + 1), force_kip: se.T.v });
    }
    for (i = 0; i <= n; i++) {
      var pe = envInfo.supEnv[i];
      var gR = pe.gov;                                // ONE governing run: heaviest bearing demand
      var s = gR.supports[i];
      supports.push({
        index: i, x_in: cd.pierX[i], type: s.type,
        governingCombo: tag(gR).combo, governingPattern: tag(gR).pattern,
        AsNeg_in2: cd.negChord.As, yNeg_in: cd.negChord.y,
        // --- from the governing run (a single, self-consistent load case) ---
        Mneg_kin: gR.Msup[i], Tneg_kip: gR.neg[i].T, aNeg_in: gR.neg[i].a, zNeg_in: gR.neg[i].z,
        R_elastic_kip: gR.R[i], R_floor_kip: gR.Rfloor[i], R_used_kip: gR.Rused[i], R_bearing_kip: gR.Rbrg[i],
        theta_end_deg: s.theta_end === undefined ? null : s.theta_end,
        sumV_kip: s.sumV === undefined ? null : s.sumV,
        sumH_kip: s.sumH === undefined ? null : s.sumH,
        diagonals: s.diagonals.map(function (d) {
          return { side: d.side, V_kip: d.V, H_kip: d.H, theta_deg: d.theta, F_kip: d.F, ws_in: d.ws, stress_ksi: d.stress, dcr: d.dcr };
        }),
        node: {
          id: s.node.id, cls: s.node.cls, lim_ksi: s.node.lim,
          combo: tag(gR).combo, pattern: tag(gR).pattern,
          faces: s.node.faces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.Acn, force_kip: f.force, stress_ksi: f.stress, dcr: f.dcr, byConstruction: !!f.byConstruction }; })
        },
        // --- enveloped scalars (each independently maximised over every combo and pattern) ---
        Mneg_env_kin: pe.Mneg.v, Mneg_combo: tag(pe.Mneg.r).combo, Mneg_pattern: tag(pe.Mneg.r).pattern,
        Tneg_env_kip: pe.T.v, Tneg_combo: tag(pe.T.r).combo, Tneg_pattern: tag(pe.T.r).pattern,
        R_used_env_kip: pe.Rused.v, R_bearing_env_kip: pe.Rbrg.v
      });
      // R4.4 — an END pier carries the bottom-tie back face, so its extended nodal zone is the
      // §23.8.2 band CENTRED ON THE TIE: [ybar_t - w_t,gov/2, ybar_t + w_t,gov/2]. Uncapped this
      // is [0, 2*ybar_t] exactly as before. An INTERIOR pier has no tie face — its node is the
      // negative-chord compression block a⁻ bearing on the bottom of the grade beam, so it keeps
      // [0, a⁻].
      var polyLo = (s.type === "end") ? (ctx.yt - run.ha / 2) : 0;
      var polyHi = (s.type === "end") ? (ctx.yt + run.ha / 2) : gR.neg[i].a;
      model.nodes.push({ id: "P" + i, x: cd.pierX[i], y: yTie, type: s.type === "end" ? "support" : "interior support" });
      model.nodePolygons.push({
        id: s.node.id, cls: s.node.cls,
        poly: [[cd.pierX[i] - cd.lb / 2, polyLo], [cd.pierX[i] + cd.lb / 2, polyLo], [cd.pierX[i] + cd.lb / 2, polyHi], [cd.pierX[i] - cd.lb / 2, polyHi]],
        faces: s.node.faces.map(function (f) { return { name: f.name, width_in: f.width, Acn_in2: f.Acn, stress_ksi: f.stress, dcr: f.dcr, byConstruction: !!f.byConstruction }; })
      });
      s.diagonals.forEach(function (d) {
        model.members.push({ id: "strut.diag." + i + "." + d.side, type: "strut", from: "P" + i, to: (d.side === "L" ? "span" + i : "span" + (i + 1)), force_kip: -d.F, theta_deg: d.theta, ws_in: d.ws });
      });
    }
    // sampled moment ENVELOPE across the whole beam, for the diagram beneath the elevation
    var dx = [], dmin = [], dmax = [];
    for (i = 0; i < n; i++) {
      var sp = envInfo.envs.spans[i];
      for (var k = 0; k < sp.xs.length; k++) {
        if (i > 0 && k === 0) continue;             // avoid duplicating the shared pier abscissa
        dx.push(cd.pierX[i] + sp.xs[k]); dmin.push(sp.Mmin[k]); dmax.push(sp.Mmax[k]);
      }
    }
    model.caseD = {
      nSpans: n, L_in: L, lb_in: cd.lb, h_in: ctx.h, pierX_in: cd.pierX.slice(),
      endStrip: { len_in: cd.lb / 2, o_in: 0, note: "L_w = nSpans*L + l_b, so the strip from each end-pier CL to the wall end lies entirely over the bearing (o = 0) and routes into it; it is outside the CL-to-CL analysis span." },
      scopeNote: CASE_D_SCOPE.slice(),
      spans: spans, supports: supports,
      negChord: {
        As_in2: cd.negChord.As, y_in: cd.negChord.y, db_in: cd.negChord.db,
        depth_in: cd.negChord.depth_in, useWallEF: cd.negChord.useWallEF,
        depthLimit_in: 0.25 * ctx.h,
        parts: cd.negChord.parts.map(function (p) { return { src: p.src, As_in2: p.As, y_in: p.y }; }),
        extension_provided_in: cd.negChord.extension_in,
        extensions: envInfo.extensions.map(function (e) {
          return {
            pier: e.pier, side: e.side, x_infl_in: e.x_infl, noInflection: e.noInflection,
            ld_in: e.ld, devShift_ld_in: e.devShift_ld, devShift_d_in: e.devShift_d,
            req_devRule_in: e.req_devRule, req_ld_in: e.req_ld,
            required_in: e.required, required_bregion_in: e.required_bregion,
            provided_in: e.provided, governs: e.governs
          };
        })
      },
      diagram: { x_in: dx, Mmin_kin: dmin, Mmax_kin: dmax },
      inflections: envInfo.inflections.slice(),
      lap: { ld_in: envInfo.lap.ld, classB_in: envInfo.lap.classB, note: "Class B tension lap for the continuous bottom bars, spliced over the interior piers where the bottom fiber is in compression." },
      reference: { combo: combo.id, pattern: maskId(mask), R_kip: run.R.slice(), Rused_kip: run.Rused.slice(), Msup_kin: run.Msup.slice() }
    };
    if (ctx.caseD) model.AsReq_tie_in2 = run.T / (PHI_STM * ctx.fy);
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
    if (ctx.caseD) {
      // F2.3: each SPAN's live load toggles as a unit (its UDL-LL and its midspan point-LL
      // together) — verified sufficient for the enveloped M+, |M-| and reactions under gravity;
      // toggling the two independently adds nothing. 1.4D carries no patterns, so the run count
      // is 2^nSpans + 1 <= 33.
      for (var d = 0; d < ctx.caseD.nSpans; d++) {
        if (ctx.wL_pli > 0 || ctx.caseD.spanPoint[d].L > 0) comps.push({ id: "sp" + (d + 1), kind: "span" });
      }
      return comps;
    }
    if (ctx.wL_pli > 0) comps.push({ id: "udl" });
    ctx.trussPts.forEach(function (p) { if (p.L > 0) comps.push({ id: p.id }); });
    var ovLL = false;
    ["L", "R"].forEach(function (s) { ctx.overPts[s].forEach(function (p) { if (p.L > 0) ovLL = true; }); });
    if (ctx.caseC && (ovLL || (ctx.wL_pli > 0 && !ctx.stripL.disperses))) comps.push({ id: "ov" });
    return comps;
  }
  function maskFromBits(comps, bits) {
    var mask = { udl: false, pts: {}, spans: {}, ov: false, bits: [] };
    comps.forEach(function (c, i) {
      var on = !!(bits & (1 << i));
      mask.bits.push(c.id + (on ? ":1" : ":0"));
      if (c.kind === "span") mask.spans[c.id] = on;
      else if (c.id === "udl") mask.udl = on;
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
        var sol = ctx.caseD ? solveD(ctx, combo, mk, betaInfo)
          : (ctx.caseC ? solveC(ctx, combo, mk, betaInfo) : solveAB(ctx, combo, mk, betaInfo));
        if (sol.status !== "ok") {
          // a run with zero truss load under an all-off pattern is legitimately skipped
          // a run with zero load is legitimately skipped: an all-off LL pattern (A/B/C), or any
          // Case D combo whose factored load is zero (e.g. a LL-only verification combo).
          if (sol.errors.length && sol.errors[0].code === "NO_TRUSS_LOAD" && (ctx.caseD || (mk.bits.length && !anyOn(mk)))) continue;
          return { status: sol.status, errors: sol.errors.map(function (e) { e.combo = combo.id; e.pattern = maskId(mk); return e; }), results: null };
        }
        sol.combo = combo; sol.mask = mk;
        runs.push(sol);
      }
    }
    function anyOn(mask) {
      return mask.udl || mask.ov ||
        Object.keys(mask.pts).some(function (k) { return mask.pts[k]; }) ||
        Object.keys(mask.spans || {}).some(function (k) { return mask.spans[k]; });
    }
    if (!runs.length) return { status: "no_admissible_stm", errors: [{ code: "NO_RUNS", message: "no computable combination/pattern" }], results: null };

    // F2.5(10): the top-steel extension needs the negative-moment ENVELOPE, which only exists
    // once EVERY combo/pattern has been solved — so Case D builds its check rows in a second
    // pass. Cases A/B/C have no cross-run dependency; the deferral is behaviourally identical.
    var envInfo = ctx.caseD ? caseDEnvelope(ctx, runs) : null;
    runs.forEach(function (r0) {
      r0.checks = ctx.caseD
        ? buildChecksD(ctx, r0.combo, r0.mask, betaInfo, r0, envInfo)
        : buildChecks(ctx, r0.combo, r0.mask, betaInfo, r0);
    });

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
    var model = ctx.caseD
      ? buildModelD(ctx, ref.combo, ref.mask, ref, betaInfo, envInfo)
      : buildModel(ctx, ref.combo, ref.mask, ref, betaInfo);
    // F2: min tie steel for D/C = 1.0 computed HERE (engine), from the ENVELOPED governing
    // tie demand — the UI renders this verbatim and performs no arithmetic of its own.
    if (env["tie.bottom"]) model.AsReq_tie_in2 = env["tie.bottom"].demand / (PHI_STM * ctx.fy);
    // R4.7: an applied test-only option is echoed on the model so it can never be silent.
    if (ctx.testOnlyOptions && ctx.testOnlyOptions.length) model.testOnlyOptions = ctx.testOnlyOptions.slice();

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
