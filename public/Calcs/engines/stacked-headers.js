/* ============================================================================
   stacked-headers.js — NDS 2018 / ASCE 7-16 ASD engine for the
   "Wood Headers, Jambs & Studs" calculator.  DOM-free and deterministic.

   Loaded by the page:   <script src="/Calcs/engines/stacked-headers.js"></script>
   Loaded by the tests:  vm.runInNewContext(readFileSync(...), sandbox)
   Both get the same global: HDR.

   Public surface (spec 2026-09-14-stacked-headers-fix.md §1):
     HDR.compute(state)      full stack computation
     HDR.validate(state)     blocking errors -> [{path,message}]
     HDR.runFixtures()       {pass,total,lines[]}
     HDR.checkHeader / checkJambPack / checkKing / checkStud
     HDR.calcCL / calcCP / eq393 / combinations
     HDR.ENGINE

   Code basis
     NDS 2018            §3.3.3 (C_L), §3.4.2 (f_v), §3.7.1 (C_P), §3.9.2
                         (Eq. 3.9-3), §3.10 (bearing), §4.3.6 (C_F), §4.3.9 (C_r)
     NDS 2018 Supplement Tables 1B, 4A, 4B
     ASCE 7-16           §2.4.1 ASD combinations, §30.3 (C&C wind, strength level)
     IBC 2021            Table 1604.3 deflection limits
   All checks assume dry service, normal temperature, non-incised, untreated
   sawn lumber: C_M = C_t = C_i = C_T = 1.0.
   ============================================================================ */
(function (root) {
'use strict';

var ENGINE = {
  name: 'stacked-headers',
  version: 2,
  build: '2026-09-14',
  codes: ['NDS 2018', 'NDS 2018 Supplement', 'ASCE 7-16', 'IBC 2021']
};

// ── NDS 2018 Supplement reference design values, No.2 grade, 2"–4" thick ─────
// Table 4A values are tabulated at 12 in nominal width and carry C_F.
// Table 4B (Southern Pine) is already width-specific, so C_F = 1.0.
var NDS_REF = {
  DFL: { name: 'Douglas Fir-Larch No.2', table: '4A',
         Fb: 900, Fv: 180, FcP: 625, Fc: 1350, E: 1600000, Emin: 580000, useCF: true },
  SPF: { name: 'Spruce-Pine-Fir No.2', table: '4A',
         Fb: 875, Fv: 135, FcP: 425, Fc: 1150, E: 1400000, Emin: 510000, useCF: true },
  SYP: { name: 'Southern Pine No.2', table: '4B',
         Fb: { '2x4': 1100, '2x6': 1000, '2x8': 925, '2x10': 800, '2x12': 750 },
         Fv: 175, FcP: 565,
         Fc: { '2x4': 1450, '2x6': 1400, '2x8': 1350, '2x10': 1300, '2x12': 1250 },
         E: 1400000, Emin: 510000, useCF: false }
};
var CF_Fb = { '2x4': 1.5, '2x6': 1.3, '2x8': 1.2, '2x10': 1.1, '2x12': 1.0 };
var CF_Fc = { '2x4': 1.15, '2x6': 1.1, '2x8': 1.05, '2x10': 1.0, '2x12': 1.0 };

// Supplement Table 1B dressed (S4S) sizes. A, S, I computed, never rounded.
var SIZES = ['2x4', '2x6', '2x8', '2x10', '2x12'];
var NOMINAL = { '2x4': [1.5, 3.5], '2x6': [1.5, 5.5], '2x8': [1.5, 7.25],
                '2x10': [1.5, 9.25], '2x12': [1.5, 11.25] };
var LBR = (function () {
  var t = {};
  SIZES.forEach(function (s) {
    var b = NOMINAL[s][0], d = NOMINAL[s][1];
    t[s] = { b: b, d: d, A: b * d, S: b * d * d / 6, I: b * d * d * d / 12,
             Sy: d * b * b / 6, Iy: d * b * b * b / 12 };
  });
  return t;
})();
var PLIES_MAP = { '2x4': 2, '2x6': 3, '2x8': 4 };
var WALL_SIZES = ['2x4', '2x6', '2x8'];

// NDS Table 2.3.2 load duration factors.
var CD = { permanent: 0.9, occupancy: 1.0, snow: 1.15, construction: 1.25, wind: 1.6 };

var KCE = 0.822;   // NDS §3.7.1.5 / §3.9.2 for sawn lumber
var C_COL = 0.8;   // NDS §3.7.1.5, sawn lumber

function ValidationError(issues) {
  var e = new Error('Input errors: ' + issues.map(function (i) { return i.path + ' — ' + i.message; }).join('; '));
  e.name = 'ValidationError';
  e.issues = issues;
  return e;
}
ValidationError.prototype = Object.create(Error.prototype);

function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : (dflt || 0); }
function refFb(sp, sz) { var v = NDS_REF[sp].Fb; return typeof v === 'object' ? v[sz] : v; }
function refFc(sp, sz) { var v = NDS_REF[sp].Fc; return typeof v === 'object' ? v[sz] : v; }
function cfFb(sp, sz) { return NDS_REF[sp].useCF ? CF_Fb[sz] : 1.0; }
function cfFc(sp, sz) { return NDS_REF[sp].useCF ? CF_Fc[sz] : 1.0; }

// ════════════════════════════════════════════════════════════════════════════
// ASCE 7-16 §2.4.1 combination envelope with the NDS Table 2.3.2 C_D that goes
// with each one.  L_r and S are ALTERNATIVES and are never summed.  Rain (R) is
// not an input to this calculator and is not enveloped — state it on the sheet.
// Wind arrives STRENGTH level (ASCE 7-16 §30.3); the 0.6 lives in the factors.
// ════════════════════════════════════════════════════════════════════════════
function combinations(loads, opts) {
  opts = opts || {};
  var L = loads || {};
  var hasLr = num(L.Lr) > 0, hasS = num(L.S) > 0, wind = !!opts.wind;
  var out = [];
  function add(id, tag, f, cd, note) { out.push({ id: id, tag: tag, f: f, CD: cd, note: note || '' }); }
  function skip(id, tag, cd, why) { out.push({ id: id, tag: tag, CD: cd, skipped: true, note: why }); }

  add('1', 'D', { D: 1 }, CD.permanent);
  add('2', 'D+L', { D: 1, L: 1 }, CD.occupancy);
  if (hasLr) add('3a', 'D+Lr', { D: 1, Lr: 1 }, CD.construction);
  else skip('3a', 'D+Lr', CD.construction, 'L_r = 0');
  if (hasS) add('3b', 'D+S', { D: 1, S: 1 }, CD.snow);
  else skip('3b', 'D+S', CD.snow, 'S = 0');
  if (hasLr) add('4a', 'D+0.75L+0.75Lr', { D: 1, L: 0.75, Lr: 0.75 }, CD.construction);
  else skip('4a', 'D+0.75L+0.75Lr', CD.construction, 'L_r = 0');
  if (hasS) add('4b', 'D+0.75L+0.75S', { D: 1, L: 0.75, S: 0.75 }, CD.snow);
  else skip('4b', 'D+0.75L+0.75S', CD.snow, 'S = 0');

  if (!wind) {
    skip('5', 'D+0.6W', CD.wind, 'no wind on this member');
    skip('6', 'D+0.75L+0.75(0.6W)+0.75(Lr or S)', CD.wind, 'no wind on this member');
    skip('7', '0.6D+0.6W', CD.wind, 'no wind on this member');
    return out;
  }
  add('5', 'D+0.6W', { D: 1, W: 0.6 }, CD.wind);
  if (hasLr) add('6a', 'D+0.75L+0.75(0.6W)+0.75Lr', { D: 1, L: 0.75, Lr: 0.75, W: 0.45 }, CD.wind);
  else if (!hasS) add('6', 'D+0.75L+0.75(0.6W)', { D: 1, L: 0.75, W: 0.45 }, CD.wind);
  else skip('6a', 'D+0.75L+0.75(0.6W)+0.75Lr', CD.wind, 'L_r = 0');
  if (hasS) add('6b', 'D+0.75L+0.75(0.6W)+0.75S', { D: 1, L: 0.75, S: 0.75, W: 0.45 }, CD.wind);
  else if (hasLr) skip('6b', 'D+0.75L+0.75(0.6W)+0.75S', CD.wind, 'S = 0');
  add('7', '0.6D+0.6W', { D: 0.6, W: 0.6 }, CD.wind);
  return out;
}

// Gravity magnitude of one combination applied to a {D,L,Lr,S} load set.
function gravityOf(c, L) {
  if (c.skipped) return 0;
  return (c.f.D || 0) * num(L.D) + (c.f.L || 0) * num(L.L) +
         (c.f.Lr || 0) * num(L.Lr) + (c.f.S || 0) * num(L.S);
}
function windFactorOf(c) { return c.skipped ? 0 : (c.f.W || 0); }

// ════════════════════════════════════════════════════════════════════════════
// NDS §3.3.3 — beam stability factor C_L
// ════════════════════════════════════════════════════════════════════════════
// Table 3.3.3, SINGLE SPAN UNIFORMLY DISTRIBUTED LOAD -- the only loading this
// engine applies to a header, so that named row's two branches are the whole
// table here. The 1.84 l_u form is footnote 1, for loadings NOT listed, and the
// concentrated-load rows are not implemented: a published example under one is
// verified by handing calcCL that example's own l_e.
function leTable333(lu, d) {
  var r = lu / d;
  return r < 7
    ? { le: 2.06 * lu, branch: 'lu/d < 7 -> le = 2.06 lu  (Table 3.3.3, single span, UDL)' }
    : { le: 1.63 * lu + 3 * d, branch: 'lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)' };
}

/**
 * Eq. 3.3-6.  R_B is NOT clamped: §3.3.3.7 sets 50 as a limit of applicability,
 * so `ok:false` is returned above it and the caller must refuse the member.
 * `braced` is the §3.3.3.3 continuously-braced compression edge -> C_L = 1.0.
 * `le_override` lets a published example under a loading this engine does not
 * apply (a concentrated load, say) be checked against its own Table 3.3.3 l_e.
 */
function calcCL(Fb_star, Emin, lu_in, d_in, b_in, braced, le_override) {
  if (braced) {
    return { CL: 1.0, ok: true, braced: true, RB: 0, le: 0, lu: lu_in, d: d_in, b: b_in,
             Fb_star: Fb_star, branch: 'compression edge continuously braced (NDS §3.3.3.3) -> C_L = 1.0' };
  }
  if (d_in <= b_in) {
    return { CL: 1.0, ok: true, braced: false, RB: 0, le: 0, lu: lu_in, d: d_in, b: b_in,
             Fb_star: Fb_star, branch: 'd <= b (NDS §3.3.3.1) -> C_L = 1.0' };
  }
  var t = (le_override > 0)
    ? { le: le_override, branch: 'l_e supplied by the caller (loading not in this engine\'s scope)' }
    : leTable333(lu_in, d_in);
  var RB = Math.sqrt(t.le * d_in / (b_in * b_in));
  var FbE = 1.20 * Emin / (RB * RB);
  var ratio = FbE / Fb_star;
  var A = (1 + ratio) / 1.9;
  var CL = Math.min(A - Math.sqrt(A * A - ratio / 0.95), 1.0);
  return { le: t.le, branch: t.branch, lu: lu_in, d: d_in, b: b_in,
           RB: RB, ok: RB <= 50, FbE: FbE, Fb_star: Fb_star, ratio: ratio, CL: CL,
           limit: 'NDS §3.3.3.7 — R_B shall not exceed 50' };
}

// ════════════════════════════════════════════════════════════════════════════
// NDS §3.7.1 — column stability factor C_P (Eq. 3.7-1)
// l_e/d is NOT clamped: §3.7.1.4 sets 50 as a limit of applicability.
// l_e <= 0 means the axis is continuously braced -> C_P = 1.0 on that axis.
// ════════════════════════════════════════════════════════════════════════════
function calcCP(Fc_star, Emin, le_in, d_in) {
  if (!(le_in > 0)) {
    return { CP: 1.0, ok: true, braced: true, le: 0, d: d_in, slen: 0, FcE: Infinity,
             Fc_star: Fc_star, basis: 'axis continuously braced (l_e = 0)' };
  }
  var slen = le_in / d_in;
  var FcE = KCE * Emin / (slen * slen);
  var ratio = FcE / Fc_star;
  var A = (1 + ratio) / (2 * C_COL);
  var CP = Math.min(A - Math.sqrt(A * A - ratio / C_COL), 1.0);
  return { slen: slen, ok: slen <= 50, le: le_in, d: d_in, FcE: FcE, Fc_star: Fc_star,
           ratio: ratio, CP: CP, braced: false,
           limit: 'NDS §3.7.1.4 — l_e/d shall not exceed 50' };
}

// ════════════════════════════════════════════════════════════════════════════
// NDS §3.9.2 Eq. 3.9-3, reduced to uniaxial edgewise bending (f_b2 = 0).
// When f_c >= F_cE1 the member has already buckled: the bending term is
// undefined, NOT zero, so this refuses instead of dropping it (H-17).
// ════════════════════════════════════════════════════════════════════════════
function eq393(fc, Fc_p, fb, Fb_p, FcE1) {
  if (!(Fc_p > 0) || !(Fb_p > 0)) {
    return { ok: false, error: 'zero capacity', ref: 'NDS §3.9.2' };
  }
  // Spec §4: never zero the bending term. At f_c >= F_cE1 the member has
  // buckled and Eq. 3.9-3 is outside its range of applicability, so the check is
  // refused whether or not there is bending in this particular combination.
  if (fc >= FcE1) {
    return { ok: false, FcE1: FcE1, fc: fc,
             error: 'f_c = ' + fc.toFixed(1) + ' psi >= F_cE1 = ' + FcE1.toFixed(1) +
                    ' psi — the member has buckled; Eq. 3.9-3 is not applicable',
             ref: 'NDS §3.9.2' };
  }
  var term1 = Math.pow(fc / Fc_p, 2);
  var den = Fb_p * (1 - fc / FcE1);
  var term2 = fb > 0 ? fb / den : 0;
  return { ok: true, term1: term1, term2: term2, dc: term1 + term2, FcE1: FcE1, den: den };
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER — multi-ply, simple span, uniformly loaded
// ════════════════════════════════════════════════════════════════════════════
/**
 * p = {size, n_plies, span_ft, lu_ft?, species, loads:{D,L,Lr,S} plf,
 *      n_jambs_bearing, Cr?, bracedEdge?, dryInstall?,
 *      deflLiveDenom?, deflTotalDenom?}
 * n_plies multiplies the 1.5 in ply width; A, S and I all scale linearly with
 * b, so a non-integer value expresses any width exactly.
 */
function checkHeader(p) {
  var sz = p.size, sp = p.species, g = LBR[sz], R = NDS_REF[sp];
  var n = num(p.n_plies, 1);
  var b_eff = n * g.b, d = g.d;
  var A_eff = n * g.A, S_eff = n * g.S, I_eff = n * g.I;
  var span_in = num(p.span_ft) * 12;
  var lu_in = (p.lu_ft == null ? num(p.span_ft) : num(p.lu_ft)) * 12;
  var Cr = num(p.Cr, 1.0) || 1.0;                    // §4.3.9 never applies to headers
  var Fb0 = refFb(sp, sz), Fv0 = R.Fv, FcP0 = R.FcP, Emin = R.Emin, E = R.E;
  var cf_b = cfFb(sp, sz);
  var loads = p.loads || {};
  var errors = [];

  var res = {
    member: 'header', size: sz, n_plies: n, species: sp, b_eff: b_eff, d: d,
    A_eff: A_eff, S_eff: S_eff, I_eff: I_eff, span_in: span_in, lu_in: lu_in,
    Cr: Cr, loads: loads, errors: errors, combos: [], ok: true
  };

  // C_L is geometry + C_D only; R_B itself is geometry, so applicability can be
  // settled once, before the envelope.
  var probe = calcCL(Fb0 * 1.0 * cf_b * Cr, Emin, lu_in, d, b_eff, !!p.bracedEdge);
  res.le_in = probe.le; res.le_branch = probe.branch; res.R_B = probe.RB;
  res.R_B_ok = probe.ok;
  if (!probe.ok) {
    errors.push({ code: 'RB_GT_50', ref: 'NDS §3.3.3.7',
      message: 'R_B = ' + probe.RB.toFixed(3) + ' exceeds 50 — beam stability is outside the scope of NDS §3.3.3. Brace the compression edge or use a wider section.' });
    res.ok = false;
    res.status = 'NOT APPLICABLE';
    return res;
  }

  var combos = combinations(loads, { wind: false });
  var best = null;
  combos.forEach(function (c) {
    var rec = { id: c.id, tag: c.tag, CD: c.CD, skipped: !!c.skipped, note: c.note };
    if (c.skipped) { res.combos.push(rec); return; }
    var w = gravityOf(c, loads);
    rec.w = w;
    if (w <= 0) { rec.skipped = true; rec.note = 'zero load'; res.combos.push(rec); return; }
    var M_in = w * num(p.span_ft) * num(p.span_ft) / 8 * 12;
    var V = w * num(p.span_ft) / 2;
    var Fb_star = Fb0 * c.CD * cf_b * Cr;
    var cl = calcCL(Fb_star, Emin, lu_in, d, b_eff, !!p.bracedEdge);
    var Fb_p = Fb_star * cl.CL;
    var Fv_p = Fv0 * c.CD;
    var fb = M_in / S_eff, fv = 1.5 * V / A_eff;
    rec.M_in = M_in; rec.V = V; rec.cl = cl; rec.Fb_star = Fb_star; rec.Fb_p = Fb_p;
    rec.Fv_p = Fv_p; rec.fb = fb; rec.fv = fv;
    rec.dc_b = fb / Fb_p; rec.dc_v = fv / Fv_p;
    rec.gov = Math.max(rec.dc_b, rec.dc_v);
    res.combos.push(rec);
    if (!best || rec.gov > best.gov) best = rec;
  });
  if (!best) {
    res.status = 'NO LOAD'; res.dc_max = 0; res.pass = true; res.governing = null;
    return res;
  }
  res.governing = best;

  // ── Bearing, NDS §3.10.  F_c-perp carries no C_D (Table 2.3.2 fn.1) and no
  // C_b (§3.10.4 — a header bears AT ITS END), so the largest UNFACTORED
  // combination governs, not the one that governs flexure.
  var maxW = 0, maxTag = '';
  res.combos.forEach(function (r) { if (!r.skipped && r.w > maxW) { maxW = r.w; maxTag = r.tag; } });
  var lb = num(p.n_jambs_bearing, 1) * 1.5;
  var A_bear = b_eff * lb;
  var R_bear = maxW * num(p.span_ft) / 2;
  res.bearing = {
    combo: maxTag, w: maxW, R_lb: R_bear, lb_in: lb, A_bear: A_bear,
    Cb: 1.0, Cb_basis: 'C_b = 1.0 — NDS §3.10.4 excludes bearings at the ends of a member',
    fcperp: R_bear / A_bear, FcP_p: FcP0,
    dc: (R_bear / A_bear) / FcP0,
    lb_req_in: R_bear / (FcP0 * b_eff),
    n_jambs_min: minJambsForBearing(R_bear, b_eff, FcP0)
  };

  // ── Deflection, IBC 2021 Table 1604.3.  L_r and S never act together, so the
  // live row is L with the larger of L_r or S.  Footnote (d) permits 0.5D in
  // the total-load row for seasoned lumber used dry.
  var dLive = num(p.deflLiveDenom, 360), dTot = num(p.deflTotalDenom, 240);
  var w_live = Math.max(num(loads.L) + num(loads.Lr), num(loads.L) + num(loads.S));
  var Dfac = p.dryInstall ? 0.5 : 1.0;
  function defl(w_plf) { return 5 * (w_plf / 12) * Math.pow(span_in, 4) / (384 * E * I_eff); }
  var d_live = defl(w_live), d_total = defl(Dfac * num(loads.D) + w_live);
  res.deflection = {
    E: E, I_eff: I_eff, w_live: w_live, w_total: Dfac * num(loads.D) + w_live,
    dryInstall: !!p.dryInstall, D_factor: Dfac,
    live: d_live, live_allow: span_in / dLive, dc_live: d_live / (span_in / dLive),
    total: d_total, total_allow: span_in / dTot, dc_total: d_total / (span_in / dTot),
    live_denom: dLive, total_denom: dTot
  };

  res.dc_max = Math.max(best.gov, res.bearing.dc, res.deflection.dc_live, res.deflection.dc_total);
  res.pass = res.dc_max <= 1.0;
  res.status = res.pass ? 'PASS' : 'FAIL';
  return res;
}

/**
 * Smallest jamb count whose end-bearing area carries the header reaction:
 * A_bear = b_eff x (n x 1.5) and F'_c-perp takes no C_D, so
 *   n >= R / (F_c-perp x b_eff x 1.5).
 * Used both by checkHeader (to report it) and by compute (to start the
 * jamb auto-search there, so the designed pack satisfies bearing as well as
 * axial — VF sizes trimmers by bearing, see PUB-VF-HEADER-BEARING).
 */
function minJambsForBearing(R_lb, b_eff_in, FcP) {
  if (!(R_lb > 0) || !(b_eff_in > 0) || !(FcP > 0)) return 1;
  return Math.max(1, Math.ceil(R_lb / (FcP * b_eff_in * 1.5)));
}

// ════════════════════════════════════════════════════════════════════════════
// JAMB PACK — n x 2x trimmers, concentric axial, both axes checked
// ════════════════════════════════════════════════════════════════════════════
/**
 * p = {size, n, species, P:{D,L,Lr,S} lb, le1_in (strong, top of opening),
 *      le2_in (weak, brace spacing; 0 = continuously braced),
 *      story_in? (disclosure only), plateSpecies?}
 */
function checkJambPack(p) {
  var sz = p.size, sp = p.species, g = LBR[sz], R = NDS_REF[sp];
  var n = Math.max(1, Math.round(num(p.n, 1)));
  var A_tot = n * g.A;
  var Fc0 = refFc(sp, sz), Emin = R.Emin, cf_c = cfFc(sp, sz);
  var P = p.P || {};
  var errors = [];
  var res = { member: 'jamb', size: sz, n: n, species: sp, A_tot: A_tot,
              le1_in: num(p.le1_in), le2_in: num(p.le2_in), P: P,
              errors: errors, combos: [], ok: true, Cr: 1.0 };

  // Slenderness is geometry: settle applicability once.
  var s1 = num(p.le1_in) > 0 ? num(p.le1_in) / g.d : 0;
  var s2 = num(p.le2_in) > 0 ? num(p.le2_in) / g.b : 0;
  res.slenderness = { strong: s1, weak: s2, limit: 50, ok: s1 <= 50 && s2 <= 50,
                      ref: 'NDS §3.7.1.4' };
  if (num(p.story_in) > 0) {
    res.weak_unbraced = { le: num(p.story_in), slen: num(p.story_in) / g.b,
                          ok: num(p.story_in) / g.b <= 50 };
  }
  if (!res.slenderness.ok) {
    errors.push({ code: 'SLEN_GT_50', ref: 'NDS §3.7.1.4',
      message: 'l_e/d = ' + Math.max(s1, s2).toFixed(1) + ' exceeds 50 — column stability is outside the scope of NDS §3.7.1. Add bracing or a larger member.' });
    res.ok = false; res.status = 'NOT APPLICABLE';
    return res;
  }

  var combos = combinations(P, { wind: false });
  var best = null;
  combos.forEach(function (c) {
    var rec = { id: c.id, tag: c.tag, CD: c.CD, skipped: !!c.skipped, note: c.note };
    if (c.skipped) { res.combos.push(rec); return; }
    var Pc = gravityOf(c, P);
    rec.P = Pc;
    if (Pc <= 0) { rec.skipped = true; rec.note = 'zero load'; res.combos.push(rec); return; }
    var Fc_star = Fc0 * c.CD * cf_c;
    var strong = calcCP(Fc_star, Emin, num(p.le1_in), g.d);
    var weak = calcCP(Fc_star, Emin, num(p.le2_in), g.b);
    var govCP = Math.min(weak.CP, strong.CP);
    rec.Fc_star = Fc_star; rec.strong = strong; rec.weak = weak;
    rec.CP = govCP;
    rec.axis = weak.CP <= strong.CP ? (num(p.le2_in) > 0 ? 'weak(braced)' : 'weak') : 'strong';
    rec.Fc_p = Fc_star * govCP;
    rec.fc = Pc / A_tot;
    rec.dc = rec.fc / rec.Fc_p;
    res.combos.push(rec);
    if (!best || rec.dc > best.dc) best = rec;
  });
  if (!best) {
    res.governing = null; res.dc_max = 0; res.pass = true; res.status = 'NO LOAD';
    return res;
  }
  res.governing = best;

  // ── Second bearing interface: jamb pack end grain on the bottom plate.
  // §3.10.4 — bearing at the END of the jamb, so C_b = 1.0; F_c-perp carries no
  // C_D, so the largest unfactored combination governs.
  var maxP = 0, maxTag = '';
  res.combos.forEach(function (r) { if (!r.skipped && r.P > maxP) { maxP = r.P; maxTag = r.tag; } });
  var plateSp = p.plateSpecies || sp;
  res.plateBearing = {
    species: plateSp, combo: maxTag, P_lb: maxP, A_bear: A_tot,
    Cb: 1.0, Cb_basis: 'C_b = 1.0 — NDS §3.10.4, bearing at the end of the jamb',
    fcperp: maxP / A_tot, FcP_p: NDS_REF[plateSp].FcP, dc: (maxP / A_tot) / NDS_REF[plateSp].FcP
  };

  res.dc_max = Math.max(best.dc, res.plateBearing.dc);
  res.pass = res.dc_max <= 1.0;
  res.status = res.pass ? 'PASS' : 'FAIL';
  return res;
}

/**
 * Auto-find the smallest jamb count 1..8 that passes axial AND plate bearing
 * AND the header end bearing that lands on the pack. The bearing minimum is a
 * closed form (minJambsForBearing) and both bearing demands fall as n rises, so
 * starting the search there is the smallest count that satisfies all three.
 * forceCount checks exactly the count the engineer typed, unchanged.
 */
function designJambPack(p) {
  var force = Math.round(num(p.forceCount, 0));
  if (force > 0) {
    var one = checkJambPack(Object.assign({}, p, { n: force }));
    return { chosen: one, tried: [one], auto: false, min_required: one.pass ? force : null };
  }
  var start = Math.min(8, Math.max(1, Math.round(num(p.minCount, 1)) || 1));
  var tried = [], chosen = null;
  for (var n = start; n <= 8; n++) {
    var chk = checkJambPack(Object.assign({}, p, { n: n }));
    tried.push(chk);
    if (chk.pass) { chosen = chk; break; }
    if (chk.status === 'NOT APPLICABLE') { chosen = chk; break; }
  }
  if (!chosen) chosen = tried[tried.length - 1];
  return { chosen: chosen, tried: tried, auto: true, start: start,
           bearing_driven: start > 1, min_required: chosen.pass ? chosen.n : null };
}

// ════════════════════════════════════════════════════════════════════════════
// KING STUD — axial + out-of-plane wind, Eq. 3.9-3, bending about the STRONG
// axis (wind bears on the narrow face).  C_L = 1.0: the compression edge is
// braced by the sheathing.  C_r = 1.0 always: §4.3.9 needs >= 3 members joined
// by a load-distributing element, which a king group is not.
// ════════════════════════════════════════════════════════════════════════════
/**
 * p = {size, species, story_ft, opening_ft, spacing_in, p_strength_psf,
 *      le2_in (weak brace; 0 = sheathed), P:{D,L,Lr,S} lb, plateSpecies?}
 * The number of kings provided is not an input: each one is checked for the
 * whole strip, so the count changes nothing here and stays a display field.
 */
function checkKing(p) {
  return beamColumn({
    kind: 'king',
    size: p.size, species: p.species, story_ft: p.story_ft,
    trib_ft: num(p.opening_ft) / 2 + num(p.spacing_in) / 12 / 2,
    p_strength_psf: p.p_strength_psf,
    le2_in: p.le2_in,
    P: p.P || {},
    Cr: 1.0,
    Cr_basis: 'C_r = 1.0 — NDS §4.3.9 requires 3+ members at <= 24 in o.c. joined by a load-distributing element; a king group is not one',
    plateSpecies: p.plateSpecies,
    deflDenom: 0,            // kings: no deflection limit row (opening head, not a finish)
    windDeflFactor: p.windDeflFactor
  });
}

// ════════════════════════════════════════════════════════════════════════════
// WALL STUD — same beam-column, tributary = the stud spacing, C_r = 1.15 at
// <= 24 in o.c., plus shear, plate bearing and IBC wind deflection.
// ════════════════════════════════════════════════════════════════════════════
/**
 * p = {size, spacing_in, species, story_ft, plf:{D,L,Lr,S}, p_strength_psf,
 *      le2_in, finish:'brittle'|'flexible', plateSpecies?, windDeflFactor?}
 */
function checkStud(p) {
  var s_ft = num(p.spacing_in) / 12;
  var plf = p.plf || {};
  var Cr = num(p.spacing_in) <= 24 ? 1.15 : 1.0;
  var r = beamColumn({
    kind: 'stud',
    size: p.size, species: p.species, story_ft: p.story_ft,
    trib_ft: s_ft,
    p_strength_psf: p.p_strength_psf,
    le2_in: p.le2_in,
    P: { D: num(plf.D) * s_ft, L: num(plf.L) * s_ft, Lr: num(plf.Lr) * s_ft, S: num(plf.S) * s_ft },
    Cr: Cr,
    Cr_basis: Cr === 1.15
      ? 'C_r = 1.15 — NDS §4.3.9: 3+ members, <= 24 in o.c., joined by load-distributing sheathing'
      : 'C_r = 1.0 — spacing exceeds 24 in o.c., NDS §4.3.9 does not apply',
    plateSpecies: p.plateSpecies,
    deflDenom: (p.finish === 'flexible' ? 120 : 240),
    finish: p.finish === 'flexible' ? 'flexible' : 'brittle',
    windDeflFactor: p.windDeflFactor
  });
  r.plf = plf; r.spacing_in = num(p.spacing_in);
  return r;
}

/** Shared beam-column core for kings and wall studs. */
function beamColumn(p) {
  var sz = p.size, sp = p.species, g = LBR[sz], R = NDS_REF[sp];
  var H_ft = num(p.story_ft), H_in = H_ft * 12;
  var Fb0 = refFb(sp, sz), Fc0 = refFc(sp, sz), Fv0 = R.Fv, Emin = R.Emin, E = R.E;
  var cf_b = cfFb(sp, sz), cf_c = cfFc(sp, sz), Cr = p.Cr;
  var P = p.P || {};
  var errors = [];
  // Every king is checked for the WHOLE strip — the wind tributary and the
  // gravity strip are not divided among the kings in the group (spec §4). A
  // second king is redundancy, not a halving of the demand.
  var w_strength = num(p.p_strength_psf) * num(p.trib_ft);        // plf, strength level
  var res = {
    member: p.kind, size: sz, species: sp, A: g.A, Sx: g.S, Ix: g.I, d: g.d, b: g.b,
    story_ft: H_ft, story_in: H_in, trib_ft: num(p.trib_ft),
    p_strength_psf: num(p.p_strength_psf), w_strength_plf: w_strength,
    Cr: Cr, Cr_basis: p.Cr_basis, le2_in: num(p.le2_in),
    P: P, errors: errors, combos: [], ok: true,
    CL: 1.0, CL_basis: 'C_L = 1.0 — compression edge braced by the wall sheathing (NDS §3.3.3.3)'
  };

  var s1 = H_in / g.d;
  var s2 = num(p.le2_in) > 0 ? num(p.le2_in) / g.b : 0;
  res.slenderness = { strong: s1, weak: s2, limit: 50, ok: s1 <= 50 && s2 <= 50, ref: 'NDS §3.7.1.4' };
  if (!res.slenderness.ok) {
    errors.push({ code: 'SLEN_GT_50', ref: 'NDS §3.7.1.4',
      message: 'l_e/d = ' + Math.max(s1, s2).toFixed(1) + ' exceeds 50 — column stability is outside the scope of NDS §3.7.1.' });
    res.ok = false; res.status = 'NOT APPLICABLE';
    return res;
  }

  // F_cE1 for Eq. 3.9-3 is about the axis of BENDING — the strong axis.
  var FcE1 = KCE * Emin / (s1 * s1);
  res.FcE1 = FcE1;

  var combos = combinations(P, { wind: true });
  var best = null;
  combos.forEach(function (c) {
    var rec = { id: c.id, tag: c.tag, CD: c.CD, skipped: !!c.skipped, note: c.note };
    if (c.skipped) { res.combos.push(rec); return; }
    var Pc = gravityOf(c, P);
    var w = windFactorOf(c) * w_strength;
    rec.P = Pc; rec.w = w;
    if (Pc <= 0 && w <= 0) { rec.skipped = true; rec.note = 'zero load'; res.combos.push(rec); return; }
    var Fc_star = Fc0 * c.CD * cf_c;
    var strong = calcCP(Fc_star, Emin, H_in, g.d);
    var weak = calcCP(Fc_star, Emin, num(p.le2_in), g.b);
    var govCP = Math.min(weak.CP, strong.CP);
    var Fc_p = Fc_star * govCP;
    var Fb_star = Fb0 * c.CD * cf_b * Cr;
    var Fb_p = Fb_star * 1.0;                      // C_L = 1.0
    var Fv_p = Fv0 * c.CD;
    var M_in = w * H_ft * H_ft / 8 * 12;
    var V = w * H_ft / 2;
    var fc = Pc / g.A, fb = M_in / g.S, fv = 1.5 * V / g.A;
    var inter = eq393(fc, Fc_p, fb, Fb_p, FcE1);
    rec.Fc_star = Fc_star; rec.strong = strong; rec.weak = weak; rec.CP = govCP;
    rec.axis = weak.braced ? 'strong (weak axis sheathed)'
                           : (weak.CP <= strong.CP ? 'weak' : 'strong');
    rec.Fc_p = Fc_p; rec.Fb_star = Fb_star; rec.Fb_p = Fb_p; rec.Fv_p = Fv_p;
    rec.M_in = M_in; rec.V = V; rec.fc = fc; rec.fb = fb; rec.fv = fv;
    rec.dc_v = Fv_p > 0 ? fv / Fv_p : 0;
    if (!inter.ok) {
      rec.error = inter.error; rec.ref = inter.ref; rec.dc = null; rec.gov = null;
      errors.push({ code: 'FC_GE_FCE1', ref: inter.ref, message: c.tag + ': ' + inter.error });
      res.ok = false;
      res.combos.push(rec);
      return;
    }
    rec.term1 = inter.term1; rec.term2 = inter.term2; rec.dc = inter.dc;
    rec.gov = Math.max(inter.dc, rec.dc_v);
    res.combos.push(rec);
    if (!best || rec.gov > best.gov) best = rec;
  });
  if (!res.ok) { res.status = 'NOT APPLICABLE'; return res; }
  if (!best) {
    res.governing = null; res.dc_max = 0; res.pass = true; res.status = 'NO LOAD';
    return res;
  }
  res.governing = best;

  // ── Plate bearing (NDS §3.10): stud/king end grain on the plate, C_b = 1.0,
  // no C_D on F_c-perp, so the largest unfactored gravity combination governs.
  var maxP = 0, maxTag = '';
  res.combos.forEach(function (r) { if (!r.skipped && r.P > maxP) { maxP = r.P; maxTag = r.tag; } });
  var plateSp = p.plateSpecies || sp;
  res.plateBearing = {
    species: plateSp, combo: maxTag, P_lb: maxP, A_bear: g.A, Cb: 1.0,
    Cb_basis: 'C_b = 1.0 — NDS §3.10.4, bearing at the end of the member',
    fcperp: maxP / g.A, FcP_p: NDS_REF[plateSp].FcP, dc: (maxP / g.A) / NDS_REF[plateSp].FcP
  };

  // ── Wind deflection (IBC 2021 Table 1604.3).  Footnote (f) permits 0.42x the
  // C&C load for the deflection check; 0.6W is the ASD combination value.
  var wf = num(p.windDeflFactor, 0.42);
  var w_defl = wf * w_strength;
  var dd = num(p.deflDenom, 0);
  if (dd > 0) {
    var delta = 5 * (w_defl / 12) * Math.pow(H_in, 4) / (384 * E * g.I);
    res.deflection = {
      factor: wf, w_plf: w_defl, E: E, I: g.I, finish: p.finish,
      delta: delta, allow: H_in / dd, dc: delta / (H_in / dd), denom: dd,
      basis: wf === 0.42
        ? 'IBC 2021 Table 1604.3 fn. (f) — 0.42 x the component and cladding load'
        : 'ASD wind 0.6W'
    };
  }

  res.dc_max = Math.max(best.gov, res.plateBearing.dc,
                        res.deflection ? res.deflection.dc : 0);
  res.pass = res.dc_max <= 1.0;
  res.status = res.pass ? 'PASS' : 'FAIL';
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// STATE — defaults, validation, stack accumulation
// ════════════════════════════════════════════════════════════════════════════
var PAGE_DEFAULTS = {
  species: 'DFL', wallWidth: '2x6', flrHt: 9,
  windOpenW: 25, windStudW: 25,                 // STRENGTH level, ASCE 7-16 §30.3
  weakBraceIn: 48, dryInstall: true, plateSpecies: '', finishType: 'brittle',
  windDeflBasis: 0.42
};
var LV_DEFAULTS = { roofDL: 20, roofLL: 20, snowLoad: 25, floorDL: 15,
                    floorLL1: 40, floorLL2: 100, wall1DL: 15, wall2DL: 25, wall3DL: 10 };

var HEADER_DEFAULTS = {
  label: 'H-1', description: '', span: 8,
  roofTrib: 0, floorTrib1: 0, floorTrib2: 0, wallTrib: 8, wallType: 1,
  dlAdd: 0, llAdd: 0, slAdd: 0,
  openType: 'window', topOfOpening: 6.0,
  trialSz: '2x8', rowWallSz: '2x6', jambSz: '', kingSz: '',
  jambCount: 0, kingCount: 1, studSpacing: 16,
  braced_edge: false, transfer: false, kingAxialExtra: 0
};
var STUD_DEFAULTS = {
  label: 'Stud Row', roofTrib: 0, floorTrib1: 0, floorTrib2: 0,
  wallTrib: 8, wallType: 1, dlAdd: 0, llAdd: 0, slAdd: 0,
  trialSz: '2x6', trialSpacing: 16, finish: ''
};

var _uid = 0;
function uid(prefix) {
  _uid++;
  return (prefix || 'id') + '-' + _uid.toString(36) + '-' +
         Math.floor(Math.random() * 1679616).toString(36);
}

function fillDefaults(obj, defaults) {
  var out = {};
  Object.keys(defaults).forEach(function (k) { out[k] = (obj && obj[k] != null && obj[k] !== '') ? obj[k] : defaults[k]; });
  Object.keys(obj || {}).forEach(function (k) { if (!(k in out)) out[k] = obj[k]; });
  return out;
}

/**
 * Normalize any accepted state (including a v1 model) into engine shape.
 * Headers correlate across floors by `stack_id` (v1 files carry only `label`,
 * so the label becomes the stack id); stud rows correlate by `sid`.
 */
function normalize(state) {
  var s = state || {};
  var out = fillDefaults(s, PAGE_DEFAULTS);
  out.LV = fillDefaults(s.LV || {}, LV_DEFAULTS);
  Object.keys(out.LV).forEach(function (k) { out.LV[k] = num(out.LV[k]); });
  ['flrHt', 'windOpenW', 'windStudW', 'weakBraceIn', 'windDeflBasis'].forEach(function (k) { out[k] = num(out[k]); });
  out.dryInstall = !!out.dryInstall;
  if (!NDS_REF[out.species]) out.species = 'DFL';
  if (!out.plateSpecies || !NDS_REF[out.plateSpecies]) out.plateSpecies = out.species;
  out.finishType = out.finishType === 'flexible' ? 'flexible' : 'brittle';
  out.floors = (s.floors || []).map(function (fl, fi) {
    return {
      id: fl.id != null ? fl.id : fi + 1,
      name: fl.name || ('Floor ' + (fi + 1)),
      exp: fl.exp !== false,
      headers: (fl.headers || []).map(function (h) {
        var r = fillDefaults(h, HEADER_DEFAULTS);
        r.id = h.id && typeof h.id === 'string' ? h.id : uid('h');
        r.stack_id = (h.stack_id && typeof h.stack_id === 'string') ? h.stack_id : String(r.label);
        r.jambSz = WALL_SIZES.indexOf(r.jambSz) >= 0 ? r.jambSz : r.rowWallSz;
        r.kingSz = WALL_SIZES.indexOf(r.kingSz) >= 0 ? r.kingSz : r.rowWallSz;
        r.braced_edge = !!r.braced_edge;
        r.transfer = !!r.transfer;
        ['span', 'roofTrib', 'floorTrib1', 'floorTrib2', 'wallTrib', 'dlAdd', 'llAdd',
         'slAdd', 'topOfOpening', 'jambCount', 'kingCount', 'studSpacing', 'kingAxialExtra']
          .forEach(function (k) { r[k] = num(r[k]); });
        return r;
      }),
      studs: (fl.studs || []).map(function (st, si) {
        var r = fillDefaults(st, STUD_DEFAULTS);
        r.sid = st.sid || ('S' + (si + 1));
        r.id = st.id && typeof st.id === 'string' ? st.id : uid('s');
        ['roofTrib', 'floorTrib1', 'floorTrib2', 'wallTrib', 'dlAdd', 'llAdd', 'slAdd', 'trialSpacing']
          .forEach(function (k) { r[k] = num(r[k]); });
        return r;
      })
    };
  });
  return out;
}

function validate(state) {
  var s = normalize(state), issues = [];
  function bad(path, msg) { issues.push({ path: path, message: msg }); }
  if (!(s.flrHt > 0)) bad('flrHt', 'Floor-to-floor height must be greater than zero.');
  // Checked on the RAW input, not the normalized copy: normalize() coerces with
  // num(), which would quietly turn a blank or a typo into 0 psf.
  var rawLV = (state && state.LV) || {};
  Object.keys(LV_DEFAULTS).forEach(function (k) {
    if (!(k in rawLV)) return;
    var v = parseFloat(rawLV[k]);
    if (!isFinite(v)) bad('LV.' + k, 'Load "' + k + '" is not a number.');
    else if (v < 0) bad('LV.' + k, 'Load "' + k + '" cannot be negative (' + v + ' psf).');
  });
  if (!(s.weakBraceIn >= 0)) bad('weakBraceIn', 'Weak-axis bracing spacing cannot be negative.');
  if (!s.floors.length) bad('floors', 'At least one level is required.');

  var seen = {};                       // stack_id -> [floor indices]
  s.floors.forEach(function (fl, fi) {
    fl.headers.forEach(function (h, hi) {
      var p = 'floors[' + fi + '].headers[' + hi + ']';
      if (!(h.span > 0)) bad(p + '.span', 'Span must be greater than zero.');
      if (!(h.topOfOpening > 0)) bad(p + '.topOfOpening', 'Top of opening must be greater than zero.');
      else if (h.topOfOpening > s.flrHt + 1e-9) {
        bad(p + '.topOfOpening', 'Top of opening (' + h.topOfOpening + ' ft) is above the story height (' +
            s.flrHt + ' ft). Correct the opening height or the story height.');
      }
      if (h.jambCount < 0 || h.jambCount > 8) bad(p + '.jambCount', '# Jambs must be 0 (auto) to 8.');
      if (h.kingCount < 1 || h.kingCount > 4) bad(p + '.kingCount', '# Kings must be 1 to 4.');
      if (!(h.studSpacing > 0)) bad(p + '.studSpacing', 'Stud spacing must be greater than zero.');
      if (!LBR[h.trialSz]) bad(p + '.trialSz', 'Unknown header size "' + h.trialSz + '".');
      (seen[h.stack_id] = seen[h.stack_id] || []).push({ fi: fi, transfer: h.transfer, hi: hi });
    });
    fl.studs.forEach(function (st, si) {
      var p = 'floors[' + fi + '].studs[' + si + ']';
      if (!(st.trialSpacing > 0)) bad(p + '.trialSpacing', 'Stud spacing must be greater than zero.');
      if (!LBR[st.trialSz]) bad(p + '.trialSz', 'Unknown stud size "' + st.trialSz + '".');
    });
  });

  // A header stack that skips a level has no load path unless the level below
  // the gap is explicitly a transfer (H-14 / spec §5).
  Object.keys(seen).forEach(function (sid) {
    var rows = seen[sid];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i].fi !== rows[i - 1].fi + 1 && !rows[i].transfer) {
        bad('floors[' + rows[i].fi + '].headers[' + rows[i].hi + '].stack_id',
            'Header stack "' + sid + '" skips level ' + (rows[i - 1].fi + 1) +
            ' — the load above it has no path down. Add the missing header or mark this row as a transfer.');
      }
    }
  });
  return issues;
}

/** Uniform load on one row (plf), split by ASCE 7-16 load source. */
function rowLoads(r, LV) {
  var wallDL = r.wallType == 2 ? LV.wall2DL : (r.wallType == 3 ? LV.wall3DL : LV.wall1DL);
  return {
    D: wallDL * r.wallTrib + r.roofTrib * LV.roofDL + (r.floorTrib1 + r.floorTrib2) * LV.floorDL + r.dlAdd,
    L: r.floorTrib1 * LV.floorLL1 + r.floorTrib2 * LV.floorLL2 + r.llAdd,
    Lr: r.roofTrib * LV.roofLL,
    S: r.roofTrib * LV.snowLoad + r.slAdd
  };
}
function addLoads(a, b, f) {
  f = f == null ? 1 : f;
  return { D: num(a.D) + f * num(b.D), L: num(a.L) + f * num(b.L),
           Lr: num(a.Lr) + f * num(b.Lr), S: num(a.S) + f * num(b.S) };
}
var ZERO = { D: 0, L: 0, Lr: 0, S: 0 };

// FNV-1a 32-bit over a key-sorted JSON rendering of the state. crypto.subtle is
// deliberately not used: it is async-only and compute() is synchronous.
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ':' + stableStringify(v[k]);
  }).join(',') + '}';
}
function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}
function hashInputs(state) {
  // `exp` is which floors the engineer happens to have expanded — a view flag,
  // not an input. Hashing it would change the record's fingerprint on a click.
  var copy = JSON.parse(JSON.stringify(state));
  (copy.floors || []).forEach(function (f) { delete f.exp; });
  return 'fnv1a32:' + fnv1a(stableStringify(copy));
}

// ════════════════════════════════════════════════════════════════════════════
// compute(state) — the whole stack
// ════════════════════════════════════════════════════════════════════════════
function compute(state) {
  var issues = validate(state);
  if (issues.length) throw ValidationError(issues);
  var s = normalize(state);
  var LV = s.LV;
  var checks = [];
  var out = {
    engine: { name: ENGINE.name, version: ENGINE.version, build: ENGINE.build },
    codes: ENGINE.codes.slice(),
    inputs_hash: hashInputs(s),
    assumptions: {
      weakBraceIn: s.weakBraceIn, dryInstall: s.dryInstall, plateSpecies: s.plateSpecies,
      finishType: s.finishType, species: s.species, windDeflBasis: s.windDeflBasis,
      wind_basis: 'strength level (ASCE 7-16 §30.3); 0.6 applied inside the engine',
      adjustments: 'C_M = C_t = C_i = C_T = 1.0 (dry service, normal temperature, non-incised)',
      rain: 'Rain (R) is not an input and is not enveloped.',
      live_load_reduction: 'none applied (ASCE 7-16 §4.7 / §4.8 not taken)'
    },
    timestamp: new Date().toISOString(),
    floors: [], checks: checks, governing: null, state: s
  };

  // Accumulators keyed by stack id, carried top -> down.
  var jambAbove = {};       // stack_id -> {D,L,Lr,S} lb reaction from above
  var wallAbove = {};       // stack_id -> {D,L,Lr,S} plf wall gravity from above
  var studAbove = {};       // sid      -> {D,L,Lr,S} plf from above

  s.floors.forEach(function (fl, fi) {
    var flOut = { id: fl.id, name: fl.name, index: fi, headers: [], studs: [] };

    fl.headers.forEach(function (h, hi) {
      var own = rowLoads(h, LV);
      var above = jambAbove[h.stack_id] || ZERO;
      var wallAcc = addLoads(own, wallAbove[h.stack_id] || ZERO);
      var n_plies = PLIES_MAP[h.rowWallSz] || 3;

      // Jamb reaction = this header's own reaction + everything from above.
      var jambP = addLoads(above, {
        D: own.D * h.span / 2, L: own.L * h.span / 2,
        Lr: own.Lr * h.span / 2, S: own.S * h.span / 2
      });
      // The header's own reaction lands on the jamb pack end grain, so the pack
      // has to be wide enough to carry it before the axial check is even
      // relevant. Largest UNFACTORED combination governs: F_c-perp takes no C_D.
      var b_eff = n_plies * 1.5;
      var R_bear = 0;
      combinations(own, { wind: false }).forEach(function (c) {
        if (c.skipped) return;
        var w = gravityOf(c, own);
        if (w > R_bear) R_bear = w;
      });
      R_bear = R_bear * h.span / 2;
      var nBear = minJambsForBearing(R_bear, b_eff, NDS_REF[s.species].FcP);

      var jd = designJambPack({
        size: h.jambSz, species: s.species, P: jambP,
        le1_in: h.topOfOpening * 12,          // trimmer runs to the underside of the header
        le2_in: s.weakBraceIn,
        story_in: s.flrHt * 12,
        plateSpecies: s.plateSpecies,
        forceCount: h.jambCount,
        minCount: nBear
      });
      var jamb = jd.chosen;

      // The header bears on the jamb pack, so its bearing length is set by the
      // count designed above (H-12), not hard-coded to one 1.5 in ply.
      var hdr = checkHeader({
        size: h.trialSz, n_plies: n_plies, span_ft: h.span, species: s.species,
        loads: own, n_jambs_bearing: (jamb && jamb.n) || 1, Cr: 1.0,
        bracedEdge: h.braced_edge, dryInstall: s.dryInstall
      });

      // King: half a stud spacing of accumulated wall gravity, no header load.
      var sHalf = h.studSpacing / 12 / 2;
      var kingP = {
        D: wallAcc.D * sHalf + h.kingAxialExtra, L: wallAcc.L * sHalf,
        Lr: wallAcc.Lr * sHalf, S: wallAcc.S * sHalf
      };
      var king = checkKing({
        size: h.kingSz, species: s.species, story_ft: s.flrHt,
        opening_ft: h.span, spacing_in: h.studSpacing,
        p_strength_psf: s.windOpenW, le2_in: s.weakBraceIn,
        P: kingP, plateSpecies: s.plateSpecies,
        windDeflFactor: s.windDeflBasis
      });

      jambAbove[h.stack_id] = jambP;
      wallAbove[h.stack_id] = wallAcc;

      var row = { id: h.id, stack_id: h.stack_id, label: h.label, description: h.description,
                  floor: fl.name, floorIndex: fi, input: h, loads: own, wallAcc: wallAcc,
                  n_jambs_bearing_min: nBear,
                  jambP: jambP, kingP: kingP, n_plies: n_plies,
                  header: hdr, jambDesign: jd, jamb: jamb, king: king };
      row.dc_max = Math.max(hdr.dc_max || 0, jamb ? (jamb.dc_max || 0) : 0, king.dc_max || 0);
      var st = [hdr.status, jamb ? jamb.status : 'PASS', king.status];
      row.pass = st.every(function (x) { return x === 'PASS' || x === 'NO LOAD'; });
      row.status = st.indexOf('NOT APPLICABLE') >= 0 ? 'NOT APPLICABLE' : (row.pass ? 'PASS' : 'FAIL');
      flOut.headers.push(row);
      pushChecks(checks, row);
    });

    fl.studs.forEach(function (st) {
      var own = rowLoads(st, LV);
      var acc = addLoads(own, studAbove[st.sid] || ZERO);
      studAbove[st.sid] = acc;
      var stud = checkStud({
        size: st.trialSz, spacing_in: st.trialSpacing, species: s.species,
        story_ft: s.flrHt, plf: acc, p_strength_psf: s.windStudW,
        le2_in: s.weakBraceIn,
        finish: st.finish || s.finishType,
        plateSpecies: s.plateSpecies, windDeflFactor: s.windDeflBasis
      });
      var row = { id: st.id, sid: st.sid, label: st.label, floor: fl.name, floorIndex: fi,
                  input: st, loads: own, accum: acc, stud: stud,
                  dc_max: stud.dc_max || 0,
                  pass: stud.status === 'PASS' || stud.status === 'NO LOAD', status: stud.status };
      flOut.studs.push(row);
      pushStudChecks(checks, row);
    });

    out.floors.push(flOut);
  });

  var gov = null;
  checks.forEach(function (c) { if (c.dc != null && (!gov || c.dc > gov.dc)) gov = c; });
  out.governing = gov;
  out.pass = checks.every(function (c) { return c.status === 'PASS' || c.status === 'NO LOAD'; });
  out.export = buildExport(s, out);
  return out;
}

function chk(list, o) { list.push(o); return o; }
function st_(dc, errs) { return (errs && errs.length) ? 'NOT APPLICABLE' : (dc <= 1.0 ? 'PASS' : 'FAIL'); }

function pushChecks(list, row) {
  var h = row.header, j = row.jamb, k = row.king, base = row.floor + ' / ' + row.label;
  if (!h.governing) {
    chk(list, { id: row.id + ':hdr', member: base + ' header', combination: '—', demand: null,
                capacity: null, dc: null, status: h.status, errors: h.errors });
  } else {
    var g = h.governing;
    chk(list, { id: row.id + ':hdr:flexure', member: base + ' header flexure', combination: g.tag,
                demand: g.fb, capacity: g.Fb_p, dc: g.dc_b, status: st_(g.dc_b), errors: [] });
    chk(list, { id: row.id + ':hdr:shear', member: base + ' header shear', combination: g.tag,
                demand: g.fv, capacity: g.Fv_p, dc: g.dc_v, status: st_(g.dc_v), errors: [] });
    chk(list, { id: row.id + ':hdr:bearing', member: base + ' header end bearing', combination: h.bearing.combo,
                demand: h.bearing.fcperp, capacity: h.bearing.FcP_p, dc: h.bearing.dc,
                status: st_(h.bearing.dc), errors: [] });
    chk(list, { id: row.id + ':hdr:defl-live', member: base + ' header deflection (live)', combination: 'L + (Lr or S)',
                demand: h.deflection.live, capacity: h.deflection.live_allow, dc: h.deflection.dc_live,
                status: st_(h.deflection.dc_live), errors: [] });
    chk(list, { id: row.id + ':hdr:defl-total', member: base + ' header deflection (total)',
                combination: (h.deflection.dryInstall ? '0.5D' : 'D') + ' + L + (Lr or S)',
                demand: h.deflection.total, capacity: h.deflection.total_allow, dc: h.deflection.dc_total,
                status: st_(h.deflection.dc_total), errors: [] });
  }
  if (j) {
    if (!j.governing) {
      chk(list, { id: row.id + ':jamb', member: base + ' jamb pack', combination: '—', demand: null,
                  capacity: null, dc: null, status: j.status, errors: j.errors });
    } else {
      chk(list, { id: row.id + ':jamb:axial', member: base + ' jamb pack axial', combination: j.governing.tag,
                  demand: j.governing.fc, capacity: j.governing.Fc_p, dc: j.governing.dc,
                  status: st_(j.governing.dc), errors: [] });
      chk(list, { id: row.id + ':jamb:slen', member: base + ' jamb slenderness l_e/d',
                  combination: '—', demand: Math.max(j.slenderness.strong, j.slenderness.weak),
                  capacity: 50, dc: Math.max(j.slenderness.strong, j.slenderness.weak) / 50,
                  status: j.slenderness.ok ? 'PASS' : 'FAIL', errors: [] });
      chk(list, { id: row.id + ':jamb:plate', member: base + ' jamb bearing on plate',
                  combination: j.plateBearing.combo, demand: j.plateBearing.fcperp,
                  capacity: j.plateBearing.FcP_p, dc: j.plateBearing.dc,
                  status: st_(j.plateBearing.dc), errors: [] });
    }
  }
  pushBeamColumnChecks(list, k, base + ' king stud');
}
function pushStudChecks(list, row) { pushBeamColumnChecks(list, row.stud, row.floor + ' / ' + row.label); }

function pushBeamColumnChecks(list, m, base) {
  if (!m) return;
  if (!m.governing) {
    chk(list, { id: base + ':na', member: base, combination: '—', demand: null, capacity: null,
                dc: null, status: m.status, errors: m.errors });
    return;
  }
  var g = m.governing;
  chk(list, { id: base + ':interaction', member: base + ' combined axial + bending (Eq. 3.9-3)',
              combination: g.tag, demand: g.dc, capacity: 1.0, dc: g.dc, status: st_(g.dc), errors: [] });
  chk(list, { id: base + ':shear', member: base + ' shear', combination: g.tag,
              demand: g.fv, capacity: g.Fv_p, dc: g.dc_v, status: st_(g.dc_v), errors: [] });
  chk(list, { id: base + ':slen', member: base + ' slenderness l_e/d', combination: '—',
              demand: Math.max(m.slenderness.strong, m.slenderness.weak), capacity: 50,
              dc: Math.max(m.slenderness.strong, m.slenderness.weak) / 50,
              status: m.slenderness.ok ? 'PASS' : 'FAIL', errors: [] });
  chk(list, { id: base + ':plate', member: base + ' bearing on plate', combination: m.plateBearing.combo,
              demand: m.plateBearing.fcperp, capacity: m.plateBearing.FcP_p, dc: m.plateBearing.dc,
              status: st_(m.plateBearing.dc), errors: [] });
  if (m.deflection) {
    chk(list, { id: base + ':defl', member: base + ' wind deflection', combination: m.deflection.basis,
                demand: m.deflection.delta, capacity: m.deflection.allow, dc: m.deflection.dc,
                status: st_(m.deflection.dc), errors: [] });
  }
}

/** localStorage['areCalcs_foundationExport'] payload, version 2. */
function buildExport(s, out) {
  var fi = out.floors.length - 1;
  if (fi < 0) return null;
  var fl = out.floors[fi];
  return {
    version: 2,
    source: 'stacked-headers',
    floorName: fl.name,
    exported: new Date().toLocaleString(),
    units: 'plf / lb',
    engine: { name: ENGINE.name, version: ENGINE.version, build: ENGINE.build },
    codes: ENGINE.codes.slice(),
    studs: fl.studs.map(function (r) {
      return { id: r.id, label: r.label,
               D: round2(r.accum.D), L: round2(r.accum.L), Lr: round2(r.accum.Lr), S: round2(r.accum.S),
               governing: r.stud && r.stud.governing ? r.stud.governing.tag : null };
    }),
    jambs: fl.headers.map(function (r) {
      return { id: r.id, label: r.label,
               D: round2(r.jambP.D), L: round2(r.jambP.L), Lr: round2(r.jambP.Lr), S: round2(r.jambP.S) };
    })
  };
}
function round2(v) { return Math.round(num(v) * 100) / 100; }

/** Snapshot object for the printed "Calculation record" block (spec §6). */
function snapshot(result) {
  return {
    engine: result.engine, codes: result.codes, inputs_hash: result.inputs_hash,
    assumptions: result.assumptions, timestamp: result.timestamp,
    checks: result.checks.map(function (c) {
      return { id: c.id, member: c.member, combination: c.combination, demand: c.demand,
               capacity: c.capacity, dc: c.dc, status: c.status,
               errors: (c.errors || []).map(function (e) { return e.ref + ' ' + e.message; }) };
    }),
    governing: result.governing
      ? { member: result.governing.member, combination: result.governing.combination,
          dc: result.governing.dc, status: result.governing.status }
      : null
  };
}

// ════════════════════════════════════════════════════════════════════════════
// FIXTURES
// ---------------------------------------------------------------------------
// FIXTURE_DATA below is docs/stacked-wood-qaqc-2026-09/E-fixtures.json verbatim
// (tools/test-stacked-headers.mjs deep-compares the two so it cannot drift).
// The expected values were derived from first principles and from published
// AWC / VF examples BEFORE this engine existed. They are never edited here.
//
// Tolerance: relative 1e-4 on intermediates, 1e-3 on D/C, 1 % on published
// values — OR the rounding bound of the printed fixture literal, whichever is
// looser, because a fixture value is only known to the precision it is printed
// at (0.0024 is any value in [0.00235, 0.00245]).
//
// Where a fixture's inputs describe a condition rather than an engine input,
// the mapping is stated in the fixture line itself:
//   weak_axis:"sheathed" / le2 = 0   -> weakBraceIn = 0 (axis continuously braced)
//   weak_axis:"UNBRACED"             -> weakBraceIn = story height
//   header deflection                -> dryInstall = false (the fixture's total-load
//                                       row carries the full D; IBC Table 1604.3
//                                       fn.(d) 0.5D is the page default, not the
//                                       fixture basis)
//   stud wind deflection             -> windDeflFactor = 0.6 (the fixture uses the
//                                       ASD wind; the page default is the 0.42W
//                                       permitted by IBC Table 1604.3 fn.(f))
// ════════════════════════════════════════════════════════════════════════════
var FIXTURE_DATA = [
 {
  "id": "HDR-DEFAULT-ROOF",
  "kind": "header",
  "provenance": "Calculator shipped defaults read live (roofTrib 10 ft, wallTrib 8 ft @15 psf, roofDL 20 / roofLL 20 / snow 25 psf), 3-ply 2x8 DFL No.2, 8 ft span, 9 ft story. NDS 2018 Sec 3.3.3 / 3.4.2 / 3.10 + ASCE 7-16 Sec 2.4.1 + Table 2.3.2.",
  "inputs": {
   "size": "2x8",
   "n_plies": 3,
   "span_ft": 8.0,
   "lu_ft": 8.0,
   "species": "DFL",
   "D_plf": 320.0,
   "L_plf": 0.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "n_jambs_bearing": 1,
   "Cr": 1.0
  },
  "expected": {
   "governing_combo": "D+S",
   "w_plf": 570.0,
   "C_D": 1.15,
   "M_lb_in": 54720.0,
   "V_lb": 2280.0,
   "le_in": 178.23,
   "le_branch": "lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)",
   "R_B": 7.9882,
   "R_B_le_50": true,
   "F_bE_psi": 10907.2547,
   "C_L": 0.9937,
   "Fb_star_psi": 1242.0,
   "Fb_prime_psi": 1234.1273,
   "fb_psi": 1388.0618,
   "DC_flexure": 1.1247,
   "fv_psi": 104.8276,
   "Fv_prime_psi": 207.0,
   "DC_shear": 0.5064,
   "bearing_lb_in": 1.5,
   "C_b": 1.0,
   "C_b_basis": "1.0 - Sec 3.10.4 excludes bearings at member ends",
   "fcperp_psi": 337.7778,
   "Fcperp_prime_psi": 625.0,
   "DC_bearing": 0.5404,
   "defl_live_in": 0.1008,
   "defl_live_allow_in": 0.2667,
   "defl_total_in": 0.2297,
   "defl_total_allow_in": 0.4,
   "governing_DC": 1.1247,
   "passes": false
  },
  "calculator_today": {
   "w_plf": 770,
   "C_D": 1.0,
   "C_L": 0.9946,
   "fb_psi": 1875.0476,
   "Fb_prime_psi": 1074.1333,
   "DC_flexure": 1.7456,
   "DC_shear": 0.7867,
   "DC_bearing": 0.7301,
   "deflection": "NOT CHECKED"
  }
 },
 {
  "id": "JAMB-DEFAULT-ROOF",
  "kind": "jamb_pack",
  "provenance": "Same defaults; jamb reaction = (D or Lr or S) x span/2. NDS 2018 Sec 3.7.1, Eq. 3.7-1, c=0.8, K_cE=0.822; applicability per Sec 3.7.1.4.",
  "inputs": {
   "size": "2x6",
   "n": 1,
   "P_D_lb": 1280.0,
   "P_L_lb": 0.0,
   "P_Lr_lb": 800.0,
   "P_S_lb": 1000.0,
   "story_ft": 9.0,
   "species": "DFL",
   "weak_axis_brace_in": 48.0,
   "Ke": 1.0
  },
  "expected": {
   "governing_combo": "D+S",
   "P_lb": 2280.0,
   "C_D": 1.15,
   "Fc_star_psi": 1707.75,
   "weak_braced": {
    "le_in": 48.0,
    "le_over_d": 32.0,
    "F_cE_psi": 465.5859,
    "C_P": 0.2552
   },
   "strong": {
    "le_in": 108.0,
    "le_over_d": 19.6364,
    "F_cE_psi": 1236.4532,
    "C_P": 0.5715
   },
   "weak_unbraced_le_over_d": 72.0,
   "weak_unbraced_applicable": false,
   "governing_axis": "weak(braced)",
   "C_P": 0.2552,
   "Fc_prime_psi": 435.7335,
   "fc_psi": 276.3636,
   "DC": 0.6342,
   "min_jambs_required": 1
  },
  "calculator_today": {
   "le_over_d_reported": 50.0,
   "C_P": 0.1249,
   "Fc_prime_psi": 185.41,
   "DC_n1": 2.0135,
   "min_jambs_chosen": 3
  }
 },
 {
  "id": "KING-DEFAULT-ROOF",
  "kind": "king_stud",
  "provenance": "Same defaults. 25 psf is the ASCE 7-16 Ch.30 STRENGTH-level C&C pressure handed over by asce716_cc_wind_calculator.html sendToHeaders(), so the ASD wind is 0.6 x 25 = 15 psf. NDS 2018 Eq. 3.9-3, bending about the STRONG axis.",
  "inputs": {
   "size": "2x6",
   "species": "DFL",
   "story_ft": 9.0,
   "opening_ft": 8.0,
   "stud_spacing_in": 16.0,
   "trib_width_ft": 4.6667,
   "p_strength_psf": 25.0,
   "P_gravity_lb": 0.0,
   "Cr": 1.0,
   "weak_axis": "sheathed"
  },
  "expected": {
   "governing_combo": "D+0.6W",
   "C_D": 1.6,
   "w_ASD_plf": 70.0,
   "M_lb_in": 8505.0,
   "S_x_in3": 7.5625,
   "fb_psi": 1124.6281,
   "Fb_prime_psi": 1872.0,
   "C_P": 0.4478,
   "Fc_prime_psi": 1063.9159,
   "F_cE1_psi": 1236.4532,
   "term1": 0.0,
   "term2": 0.6008,
   "interaction_DC": 0.6008,
   "passes": true
  },
  "calculator_today": {
   "model": "whole trib AREA (18 sf) as one POINT load at 6 ft",
   "S_used_in3": 2.0625,
   "S_axis": "WEAK (d b^2/6)",
   "M_lb_in": 10800.0,
   "fb_psi": 5236.4,
   "Cr": 1.15,
   "interaction_DC": 2.4324
  }
 },
 {
  "id": "STUD-DEFAULT-ROOF",
  "kind": "wall_stud",
  "provenance": "Calculator default stud row \"Exterior Long Side\", loads accumulated floor to floor. NDS 2018 Eq. 3.9-3; C_r = 1.15 per Sec 4.3.9 (>=3 members, 16 in o.c., sheathed). Weak axis braced by sheathing per NDS A.11.3 / Commentary C3.6.7.",
  "inputs": {
   "size": "2x6",
   "spacing_in": 16.0,
   "species": "DFL",
   "story_ft": 9.0,
   "D_plf": 320.0,
   "L_plf": 0.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "p_strength_psf": 25.0,
   "Cr": 1.15,
   "weak_axis": "sheathed"
  },
  "expected": {
   "governing_combo": "D+0.6W",
   "C_D": 1.6,
   "C_P": 0.4478,
   "C_P_axis": "strong (weak axis sheathed)",
   "fc_psi": 51.7172,
   "fb_psi": 321.3223,
   "Fc_prime_psi": 1063.9159,
   "Fb_prime_psi": 2152.8,
   "F_cE1_psi": 1236.4532,
   "term1": 0.0024,
   "term2": 0.1558,
   "interaction_DC": 0.1581,
   "wind_defl_in": 0.0887,
   "wind_defl_allow_L240_in": 0.45,
   "passes": true
  },
  "calculator_today": {
   "C_P": 0.0789,
   "le_over_d_reported": 50.0,
   "le_over_d_true": 72.0,
   "fc_psi": 124.4444,
   "fb_psi": 535.5372,
   "DC_wind": 0.7171,
   "DC_axial_gravity": 0.6712,
   "gov": 0.7171
  }
 },
 {
  "id": "STUD-DEFAULT-3RD",
  "kind": "wall_stud",
  "provenance": "Calculator default stud row \"Exterior Long Side\", loads accumulated floor to floor. NDS 2018 Eq. 3.9-3; C_r = 1.15 per Sec 4.3.9 (>=3 members, 16 in o.c., sheathed). Weak axis braced by sheathing per NDS A.11.3 / Commentary C3.6.7.",
  "inputs": {
   "size": "2x6",
   "spacing_in": 16.0,
   "species": "DFL",
   "story_ft": 9.0,
   "D_plf": 515.0,
   "L_plf": 200.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "p_strength_psf": 25.0,
   "Cr": 1.15,
   "weak_axis": "sheathed"
  },
  "expected": {
   "governing_combo": "D+0.6W",
   "C_D": 1.6,
   "C_P": 0.4478,
   "C_P_axis": "strong (weak axis sheathed)",
   "fc_psi": 83.2323,
   "fb_psi": 321.3223,
   "Fc_prime_psi": 1063.9159,
   "Fb_prime_psi": 2152.8,
   "F_cE1_psi": 1236.4532,
   "term1": 0.0061,
   "term2": 0.16,
   "interaction_DC": 0.1662,
   "wind_defl_in": 0.0887,
   "wind_defl_allow_L240_in": 0.45,
   "passes": true
  },
  "calculator_today": {
   "C_P": 0.0789,
   "le_over_d_reported": 50.0,
   "le_over_d_true": 72.0,
   "fc_psi": 188.2828,
   "fb_psi": 535.5372,
   "DC_wind": 1.3019,
   "DC_axial_gravity": 1.0155,
   "gov": 1.3019
  }
 },
 {
  "id": "STUD-DEFAULT-2ND",
  "kind": "wall_stud",
  "provenance": "Calculator default stud row \"Exterior Long Side\", loads accumulated floor to floor. NDS 2018 Eq. 3.9-3; C_r = 1.15 per Sec 4.3.9 (>=3 members, 16 in o.c., sheathed). Weak axis braced by sheathing per NDS A.11.3 / Commentary C3.6.7.",
  "inputs": {
   "size": "2x6",
   "spacing_in": 16.0,
   "species": "DFL",
   "story_ft": 9.0,
   "D_plf": 710.0,
   "L_plf": 400.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "p_strength_psf": 25.0,
   "Cr": 1.15,
   "weak_axis": "sheathed"
  },
  "expected": {
   "governing_combo": "D+0.6W",
   "C_D": 1.6,
   "C_P": 0.4478,
   "C_P_axis": "strong (weak axis sheathed)",
   "fc_psi": 114.7475,
   "fb_psi": 321.3223,
   "Fc_prime_psi": 1063.9159,
   "Fb_prime_psi": 2152.8,
   "F_cE1_psi": 1236.4532,
   "term1": 0.0116,
   "term2": 0.1645,
   "interaction_DC": 0.1762,
   "wind_defl_in": 0.0887,
   "wind_defl_allow_L240_in": 0.45,
   "passes": true
  },
  "calculator_today": {
   "C_P": 0.0789,
   "le_over_d_reported": 50.0,
   "le_over_d_true": 72.0,
   "fc_psi": 252.1212,
   "fb_psi": 535.5372,
   "DC_wind": 2.1207,
   "DC_axial_gravity": 1.3598,
   "gov": 2.1207
  }
 },
 {
  "id": "JAMB-2X6-9FT",
  "kind": "jamb_pack",
  "provenance": "Case 4: 2x6 jamb pack, weak axis blocked at 48 in vs unbraced full story. Demonstrates that story height must change the answer.",
  "inputs": {
   "size": "2x6",
   "n": 2,
   "story_ft": 9.0,
   "species": "DFL",
   "P_D_lb": 1280.0,
   "P_Lr_lb": 800.0,
   "P_S_lb": 1000.0,
   "weak_axis_brace_in": 48.0
  },
  "expected": {
   "C_P_weak_braced_48in": 0.2552,
   "C_P_strong": 0.5715,
   "C_P_governing": 0.2552,
   "weak_unbraced_le_over_d": 72.0,
   "weak_unbraced_applicable": false,
   "Fc_prime_psi": 435.7335,
   "fc_psi": 138.1818,
   "DC": 0.3171
  },
  "calculator_today": {
   "C_P": 0.1249,
   "le_over_d_reported": 50.0,
   "DC": 1.0068,
   "note": "byte-identical at 9 ft and 10 ft - the le/d clamp saturates above a 6.25 ft story"
  }
 },
 {
  "id": "JAMB-2X6-10FT",
  "kind": "jamb_pack",
  "provenance": "Case 4: 2x6 jamb pack, weak axis blocked at 48 in vs unbraced full story. Demonstrates that story height must change the answer.",
  "inputs": {
   "size": "2x6",
   "n": 2,
   "story_ft": 10.0,
   "species": "DFL",
   "P_D_lb": 1280.0,
   "P_Lr_lb": 800.0,
   "P_S_lb": 1000.0,
   "weak_axis_brace_in": 48.0
  },
  "expected": {
   "C_P_weak_braced_48in": 0.2552,
   "C_P_strong": 0.4915,
   "C_P_governing": 0.2552,
   "weak_unbraced_le_over_d": 80.0,
   "weak_unbraced_applicable": false,
   "Fc_prime_psi": 435.7335,
   "fc_psi": 138.1818,
   "DC": 0.3171
  },
  "calculator_today": {
   "C_P": 0.1249,
   "le_over_d_reported": 50.0,
   "DC": 1.0068,
   "note": "byte-identical at 9 ft and 10 ft - the le/d clamp saturates above a 6.25 ft story"
  }
 },
 {
  "id": "HDR-BAND-2X8-4FT",
  "kind": "header",
  "provenance": "Case 5: Table 3.3.3, single span, uniformly distributed load. lu/d = 6.62. NOTE: the NAMED uniform row has only two branches (<7, >=7); the 1.84 lu form above lu/d = 14.3 is footnote 1, for loading conditions NOT listed.",
  "inputs": {
   "size": "2x8",
   "n_plies": 3,
   "span_ft": 4.0,
   "lu_ft": 4.0,
   "species": "DFL",
   "D_plf": 320.0,
   "L_plf": 0.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "n_jambs_bearing": 1
  },
  "expected": {
   "lu_over_d": 6.6207,
   "le_branch": "lu/d < 7 -> le = 2.06 lu  (Table 3.3.3, single span, UDL)",
   "le_in": 98.88,
   "R_B": 5.9499,
   "R_B_le_50": true,
   "F_bE_psi": 19660.1942,
   "C_L": 0.9967,
   "Fb_prime_psi": 1237.8413,
   "fb_psi": 347.0155,
   "DC_flexure": 0.2803,
   "DC_shear": 0.2532,
   "DC_bearing": 0.2702,
   "defl_total_in": 0.0144,
   "defl_total_allow_in": 0.2,
   "DC_defl_total": 0.0718,
   "governing_DC": 0.2803
  },
  "calculator_today": {
   "le_in": 99.99,
   "R_B": 5.9832,
   "F_bE_psi": 19441.9442,
   "C_L": 0.9971,
   "DC_flexure": 0.4353,
   "gov": 0.4353
  }
 },
 {
  "id": "HDR-BAND-2X10-8FT",
  "kind": "header",
  "provenance": "Case 5: Table 3.3.3, single span, uniformly distributed load. lu/d = 10.38. NOTE: the NAMED uniform row has only two branches (<7, >=7); the 1.84 lu form above lu/d = 14.3 is footnote 1, for loading conditions NOT listed.",
  "inputs": {
   "size": "2x10",
   "n_plies": 3,
   "span_ft": 8.0,
   "lu_ft": 8.0,
   "species": "DFL",
   "D_plf": 320.0,
   "L_plf": 0.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "n_jambs_bearing": 1
  },
  "expected": {
   "lu_over_d": 10.3784,
   "le_branch": "lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)",
   "le_in": 184.23,
   "R_B": 9.1736,
   "R_B_le_50": true,
   "F_bE_psi": 8270.5079,
   "C_L": 0.9922,
   "Fb_prime_psi": 1129.5662,
   "fb_psi": 852.71,
   "DC_flexure": 0.7549,
   "DC_shear": 0.3969,
   "DC_bearing": 0.5404,
   "defl_total_in": 0.1106,
   "defl_total_allow_in": 0.4,
   "DC_defl_total": 0.2766,
   "governing_DC": 0.7549
  },
  "calculator_today": {
   "le_in": 184.23,
   "R_B": 9.1736,
   "F_bE_psi": 8270.5079,
   "C_L": 0.9933,
   "DC_flexure": 1.1714,
   "gov": 1.1714
  }
 },
 {
  "id": "HDR-BAND-2X12-16FT",
  "kind": "header",
  "provenance": "Case 5: Table 3.3.3, single span, uniformly distributed load. lu/d = 17.07. NOTE: the NAMED uniform row has only two branches (<7, >=7); the 1.84 lu form above lu/d = 14.3 is footnote 1, for loading conditions NOT listed.",
  "inputs": {
   "size": "2x12",
   "n_plies": 3,
   "span_ft": 16.0,
   "lu_ft": 16.0,
   "species": "DFL",
   "D_plf": 320.0,
   "L_plf": 0.0,
   "Lr_plf": 200.0,
   "S_plf": 250.0,
   "n_jambs_bearing": 1
  },
  "expected": {
   "lu_over_d": 17.0667,
   "le_branch": "lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)",
   "le_in": 346.71,
   "R_B": 13.8786,
   "R_B_le_50": true,
   "F_bE_psi": 3613.3945,
   "C_L": 0.9808,
   "Fb_prime_psi": 1015.1679,
   "fb_psi": 2305.8963,
   "DC_flexure": 2.2714,
   "DC_shear": 0.6527,
   "DC_bearing": 1.0809,
   "defl_total_in": 0.9838,
   "defl_total_allow_in": 0.8,
   "DC_defl_total": 1.2298,
   "governing_DC": 2.2714
  },
  "calculator_today": {
   "le_in": 346.71,
   "R_B": 10,
   "F_bE_psi": 6960,
   "C_L": 0.9927,
   "DC_flexure": 3.4865,
   "gov": 3.4865
  }
 },
 {
  "id": "HDR-RB-OVER-50-NOT-APPLICABLE",
  "kind": "header_applicability",
  "provenance": "NDS 2018 Sec 3.3.3.7 verbatim: \"The slenderness ratio for bending members, R_B, shall not exceed 50.\" Single-ply 2x12, 24 ft unbraced span.",
  "inputs": {
   "size": "2x12",
   "n_plies": 1,
   "span_ft": 24.0,
   "lu_ft": 24.0,
   "species": "DFL"
  },
  "expected": {
   "le_in": 503.19,
   "le_branch": "lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)",
   "R_B": 50.1592,
   "R_B_le_50": false,
   "result": "NOT APPLICABLE - the engine must refuse, not return a D/C"
  },
  "calculator_today": {
   "R_B_reported": 10.0,
   "C_L": 0.9927,
   "C_L_correct": 0.3009,
   "note": "R_B silently clamped to 10; C_L overstated +230%"
  }
 },
 {
  "id": "STUD-LE-OVER-D-OVER-50-NOT-APPLICABLE",
  "kind": "stud_applicability",
  "provenance": "NDS 2018 Sec 3.7.1.4 verbatim: \"The slenderness ratio for solid columns, le/d, shall not exceed 50, except that during construction le/d shall not exceed 75.\" 2x6 stud, 20 ft unbraced, weak axis, Ke = 1.0.",
  "inputs": {
   "size": "2x6",
   "spacing_in": 16.0,
   "story_ft": 20.0,
   "species": "DFL",
   "axial_plf": 1000.0,
   "p_strength_psf": 25.0,
   "weak_axis": "UNBRACED"
  },
  "expected": {
   "le_in": 240.0,
   "d_in": 1.5,
   "le_over_d": 160.0,
   "le_over_d_le_50": false,
   "result": "NOT APPLICABLE - the engine must refuse, not return a D/C"
  },
  "calculator_today": {
   "le_over_d_reported": 50.0,
   "C_P": 0.1249,
   "DC_axial_gravity": 0.8717,
   "note": "the axial-only check reports PASS at a true le/d of 160"
  }
 },
 {
  "id": "HDR-DEFLECTION-GOVERNS",
  "kind": "header",
  "provenance": "Found by sweeping the live engine: both stress checks pass but IBC Table 1604.3 L/240 total-load does not. SPF has the lowest E (1.4e6). NDS Sec 3.5.1 prescribes no numeric limit and defers to the building code (Sec 1.4.2).",
  "inputs": {
   "size": "2x10",
   "n_plies": 4,
   "span_ft": 28.0,
   "species": "SPF",
   "D_plf": 60.0,
   "L_plf": 0.0,
   "Lr_plf": 0.0,
   "S_plf": 0.0,
   "n_jambs_bearing": 2
  },
  "expected": {
   "governing_combo": "D",
   "C_D": 0.9,
   "DC_flexure": 0.9644,
   "DC_shear": 0.1869,
   "defl_total_in": 1.4978,
   "defl_total_allow_in": 1.4,
   "DC_defl_total": 1.0698,
   "governing_DC": 1.0698,
   "passes": false
  },
  "calculator_today": {
   "gov": 0.865,
   "verdict": "PASS",
   "deflection": "NOT CHECKED"
  }
 },
 {
  "id": "PUB-AWC-E1.2a-CL",
  "kind": "beam_stability",
  "provenance": "AWC \"2015/2018 Structural Wood Design Examples\" Ex. E1.2a, PDF p.15-18 (printed 7-10). DF-L Select Structural 4x16, 20 ft span, concentrated load at center, lateral support at the ends only.",
  "inputs": {
   "Fb_psi": 1500.0,
   "E_psi": 1900000.0,
   "Emin_psi": 690000.0,
   "b_in": 3.5,
   "d_in": 15.25,
   "S_in3": 135.66,
   "I_in4": 1034.0,
   "lu_in": 240.0,
   "C_D": 1.0,
   "C_M": 1.0,
   "C_t": 1.0,
   "C_F": 1.0,
   "C_fu": 1.0,
   "C_r": 1.0,
   "C_i": 1.0,
   "C_T": 1.0,
   "load_pattern": "concentrated at center"
  },
  "published": {
   "lu_over_d": 15.7,
   "le_in": 375.0,
   "table_row": "Single Span Beam, concentrated load at center, lu/d>=7 -> le = 1.37 lu + 3d",
   "R_B": 21.6,
   "F_bE_psi": 1776.0,
   "C_L": 0.876,
   "Fb_prime_psi": 1313.0,
   "M_max_ftlb": 14849.0,
   "P_allow_lb": 2831.0,
   "f_v_psi": 40.0,
   "Fv_prime_psi": 180.0,
   "f_cperp_psi": 116.0,
   "Fcperp_prime_psi": 625.0,
   "C_b": "not used - end bearing",
   "defl_in": 0.44,
   "L_over_delta": 545
  },
  "expected": {
   "le_in": 374.55,
   "R_B": 21.5934,
   "R_B_le_50": true,
   "F_bE_psi": 1775.7703,
   "C_L": 0.8756,
   "Fb_prime_psi": 1313.435
  },
  "calculator_today": {
   "le_in": 436.95,
   "R_B": 10,
   "F_bE_psi": 8280,
   "C_L": 0.9892,
   "note": "calcCL forces the uniform-load row AND clamps R_B to 10; C_L +12.9% vs published"
  }
 },
 {
  "id": "PUB-AWC-E1.4-CP",
  "kind": "column_stability",
  "provenance": "AWC Ex. E1.4, PDF p.31-35 (printed 23-27). No.2 Southern Pine 4x4, 10 ft, pinned (Ke = 1.0), gravity only, C_D = 1.0.",
  "inputs": {
   "Fc_psi": 1450.0,
   "E_psi": 1400000.0,
   "Emin_psi": 510000.0,
   "d_in": 3.5,
   "A_in2": 12.25,
   "le_in": 120.0,
   "c": 0.8,
   "K_cE": 0.822
  },
  "published": {
   "le_over_d": 34.3,
   "F_cE_psi": 357.0,
   "Fc_star_psi": 1450.0,
   "C_P": 0.232,
   "Fc_prime_psi": 336.0,
   "P_allow_lb": 4120.0
  },
  "expected": {
   "le_over_d": 34.2857,
   "le_over_d_le_50": true,
   "F_cE_psi": 356.6281,
   "C_P": 0.2319,
   "Fc_prime_psi": 336.3157,
   "P_allow_lb": 4119.8671
  },
  "calculator_today": {
   "le_over_d": 34.2857,
   "F_cE_psi": 356.6281,
   "C_P": 0.2319,
   "note": "EXACT match - calcCP is correct whenever le/d <= 50; the defect is the clamp alone"
  }
 },
 {
  "id": "PUB-AWC-E1.5a-STUD-CP",
  "kind": "wall_stud",
  "provenance": "AWC Ex. E1.5a, PDF p.36-38 (printed 28-30). No.2 SPF 2x6 stud, 91.5 in, sheathed both faces, D+S. AWC verbatim: \"le2 = 0 ... Strong axis buckling controls. See NDS A.11.3 regarding lateral support of the weak axis due to gypsum sheathing.\"",
  "inputs": {
   "size": "2x6",
   "species": "SPF",
   "Fc_psi": 1150.0,
   "Emin_psi": 510000.0,
   "Fcperp_psi": 425.0,
   "length_in": 91.5,
   "C_D": 1.15,
   "C_F_c": 1.1,
   "le1_in": 91.5,
   "le2_in": 0.0
  },
  "published": {
   "governing_axis": "strong",
   "le1_over_d": 16.636,
   "Fc_star_psi": 1455.0,
   "F_cE_psi": 1515.0,
   "C_P": 0.705,
   "Fc_prime_psi": 1025.0,
   "P_buckling_lb": 8458.0,
   "bearing_lb_in": 1.5,
   "C_b": 1.25,
   "Fcperp_prime_psi": 425.0,
   "P_bearing_lb": 3506.0,
   "P_bearing_with_Cb_lb": 4383.0,
   "governs": "bearing with C_b (interior bearing, not a member end)"
  },
  "expected": {
   "le_over_d": 16.6364,
   "F_cE_psi": 1514.695,
   "C_P": 0.7048,
   "Fc_prime_psi": 1025.2418,
   "P_buckling_lb": 8458.2449
  },
  "calculator_today": {
   "axis": "WEAK, unbraced full height",
   "le_over_d_reported": 50.0,
   "le_over_d_true": 61.0,
   "F_cE_psi": 167.688,
   "C_P": 0.1124,
   "note": "C_P understated 84% vs published"
  }
 },
 {
  "id": "PUB-AWC-E1.7-BEAMCOLUMN",
  "kind": "beam_column",
  "provenance": "AWC Ex. E1.7, PDF p.48-52 (printed 40-44). No.1 Southern Pine 2x6, 9 ft, 4 ft o.c., 25 psf on the narrow face, P = 560 D + 840 S. Load Case 1 D+S+W, C_D = 1.6.",
  "inputs": {
   "size": "2x6",
   "Fb_psi": 1350.0,
   "Fc_psi": 1550.0,
   "Emin_psi": 580000.0,
   "length_ft": 9.0,
   "spacing_ft": 4.0,
   "w_psf": 25.0,
   "P_D_lb": 560.0,
   "P_S_lb": 840.0,
   "C_D": 1.6,
   "C_F": 1.0,
   "C_r": 1.0,
   "C_L": 1.0,
   "le1_in": 108.0,
   "le2_in": 0.0
  },
  "published": {
   "Fc_star_psi": 2480.0,
   "F_cE_psi": 1236.0,
   "C_P": 0.433,
   "Fc_prime_psi": 1073.0,
   "f_c_psi": 170.0,
   "Fb1_prime_psi": 2160.0,
   "M_lb_in": 12150.0,
   "f_b1_psi": 1607.0,
   "term1": 0.0251,
   "term2": 0.8625,
   "eq_3_9_3": 0.89,
   "note": "printed R_B = 16 is rounded from 16.248; F_bE 2636 back-solves to R_B^2 = 264"
  },
  "expected": {
   "F_cE_psi": 1236.4532,
   "C_P": 0.4326,
   "Fc_prime_psi": 1072.8564,
   "f_c_psi": 169.697,
   "Fb1_prime_psi": 2160.0,
   "M_lb_in": 12150.0,
   "f_b1_psi": 1606.6116,
   "term1": 0.025,
   "term2": 0.8621,
   "eq_3_9_3": 0.8871
  },
  "calculator_today": {
   "route": "checkWallStudSingle(\"2x6\", 48, 25, 9, 350, \"SYP\")",
   "C_P": 0.0781,
   "Fc_prime_psi": 187.5251,
   "Fb_prime_psi": 2300,
   "eq_3_9_3": 1.6285,
   "unmappable_inputs": [
    "grade (No.1; the calculator offers No.2 only)",
    "C_r override (AWC 1.0, the calculator forces 1.15)",
    "weak-axis bracing length",
    "per-combination axial load"
   ]
  }
 },
 {
  "id": "PUB-AWC-E1.9-WALLSTUD",
  "kind": "wall_stud",
  "provenance": "AWC Ex. E1.9, PDF p.63-87 (printed 55-79). No.2 Southern Pine 2x8, 16 in o.c., 19 ft balloon-framed, full ASCE 7-16 combination set. Governing MWFRS case LC5a = D + 0.6W.",
  "inputs": {
   "size": "2x8",
   "species": "Southern Pine No.2",
   "Fb_psi": 925.0,
   "Fc_psi": 1350.0,
   "Emin_psi": 510000.0,
   "spacing_in": 16.0,
   "height_ft": 19.0,
   "le_in": 228.0,
   "d1_in": 7.25,
   "C_D": 1.6,
   "C_r": 1.25,
   "C_L": 1.0,
   "P_lb": 483.0,
   "w_plf": 23.08,
   "note_Cr": "AWC uses the SDPWS 3.1.1.1 wall-stud factor 1.25, not the NDS 4.3.9 1.15"
  },
  "published": {
   "F_cE_psi": 424.0,
   "Fc_star_psi": 2160.0,
   "C_P": 0.188,
   "Fc_prime_psi": 405.0,
   "f_c_psi": 44.0,
   "Fb_prime_psi": 1850.0,
   "M_lb_in": 12500.0,
   "f_b_psi": 951.0,
   "eq_3_9_3": 0.59,
   "CC_governs_strength": {
    "f_b_psi": 1400.0,
    "ratio": 0.76,
    "defl_in": 0.84,
    "L_over_delta": 273,
    "limit": "L/180 per IBC Table 1604.3 fn.(f)"
   }
  },
  "expected": {
   "F_cE_psi": 423.8853,
   "C_P": 0.1876,
   "Fc_prime_psi": 405.1749,
   "f_c_psi": 44.4138,
   "Fb_prime_psi": 1850.0,
   "M_lb_in": 12497.82,
   "f_b_psi": 951.0826,
   "eq_3_9_3": 0.5863
  },
  "calculator_today": {
   "route": "checkWallStudSingle(\"2x8\", 16, 17.3, 19, 362.25, \"SYP\")",
   "Fb_ref_psi": 1250.0,
   "C_P": 0.0781,
   "Fc_prime_psi": 187.5251,
   "Fb_prime_psi": 2300,
   "f_b_psi": 950.506,
   "eq_3_9_3": 0.5113,
   "note": "reads 0.511 against a published 0.59 - UNCONSERVATIVE. The inflated SYP F_b (E-9) more than cancels the C_P clamp."
  }
 },
 {
  "id": "PUB-VF-TRIMMER-JAMB",
  "kind": "jamb_pack",
  "provenance": "\"2 - VF Wood Depth Refresher and Solutions.pdf\" p.31. (2) 2x6 DF-L No.2 trimmer studs under an 8 ft header, P = 8.51 kips, 9 ft story.",
  "inputs": {
   "size": "2x6",
   "n": 2,
   "species": "DFL",
   "P_lb": 8510.0,
   "story_ft": 9.0,
   "C_D": 1.0,
   "C_F_c": 1.1
  },
  "published": {
   "f_c_psi": 516.0,
   "C_P": 1.0,
   "Fc_prime_psi": 1485.0,
   "DC": 0.347,
   "verdict": "OK",
   "basis": "C_P = 1.0 - trimmer studs inside a sheathed wall are braced"
  },
  "expected": {
   "f_c_psi": 515.7576,
   "C_P": 1.0,
   "Fc_prime_psi": 1485.0,
   "DC": 0.3473
  },
  "calculator_today": {
   "f_c_psi": 515.7576,
   "C_P": 0.1249,
   "le_over_d_reported": 50.0,
   "le_over_d_true": 72.0,
   "Fc_prime_psi": 185.4134,
   "DC": 2.7817,
   "verdict": "FAIL",
   "note": "calculator D/C is 8.0x the published value"
  }
 },
 {
  "id": "PUB-VF-HEADER-BEARING",
  "kind": "header_bearing",
  "provenance": "\"2 - VF Wood Depth Refresher and Solutions.pdf\" p.26-30. DF-L header over an opening, 8 ft span, D 888 / Lr 350 / S 613 / L 1240 plf.",
  "inputs": {
   "span_ft": 8.0,
   "D_plf": 888.0,
   "L_plf": 1240.0,
   "Lr_plf": 350.0,
   "S_plf": 613.0,
   "b_header_in": 5.5,
   "Fcperp_psi": 625.0
  },
  "published": {
   "governing_combo": "D+L",
   "w_plf": 2128.0,
   "C_D": 1.0,
   "M_kipft": 17.02,
   "bearing_combo": "D+0.75L+0.75(Lr or S)",
   "bearing_w_plf": 2278.0,
   "lb_required_in": 2.65,
   "solution": "(2) 2x6 trimmer studs, l_b = 3 in",
   "note": "C_D is not applied to F_cperp, so the largest UNFACTORED combination governs bearing"
  },
  "expected": {
   "governing_combo": "D+L",
   "w_plf": 2128.0,
   "C_D": 1.0,
   "M_kipft": 17.024,
   "lb_required_in": 2.6508
  },
  "calculator_today": {
   "bearing_lb_in": 1.5,
   "note": "l_b hard-coded to 1.5 in and never linked to the jamb count the same function selects"
  }
 },
 {
  "id": "REF-SYP-TABLE-4B",
  "kind": "reference_values",
  "provenance": "NDS 2018 Supplement Table 4B, PDF p.48-49 (printed 40-41), Southern Pine No.2 (plain sub-grade), 2-4 in thick. Corroborated by AWC E1.4 (4x4: Fc 1450, E 1.4e6, Emin 510,000), E1.8 (2x4: Fb 1100), E1.9 (2x8: Fb 925).",
  "inputs": {
   "species": "SYP",
   "grade": "No.2",
   "thickness": "2-4 in"
  },
  "expected": {
   "Fb_psi": {
    "2x4": 1100,
    "2x6": 1000,
    "2x8": 925,
    "2x10": 800,
    "2x12": 750
   },
   "Fc_psi": {
    "2x4": 1450,
    "2x6": 1400,
    "2x8": 1350,
    "2x10": 1300,
    "2x12": 1250
   },
   "Fv_psi": 175,
   "Fcperp_psi": 565,
   "E_psi": 1400000,
   "Emin_psi": 510000,
   "C_F": "1.0 - Table 4B values already include the size adjustment"
  },
  "calculator_today": {
   "Fb_psi": {
    "2x4": 1500,
    "2x6": 1250,
    "2x8": 1250,
    "2x10": 1050,
    "2x12": 1050
   },
   "Fc_psi": {
    "2x4": 1650,
    "2x6": 1500,
    "2x8": 1500,
    "2x10": 1500,
    "2x12": 1500
   },
   "Fv_psi": 175,
   "Fcperp_psi": 565,
   "E_psi": 1600000,
   "Emin_psi": 580000,
   "useCF": false,
   "Fb_error": {
    "2x4": "+36.4%",
    "2x6": "+25.0%",
    "2x8": "+35.1%",
    "2x10": "+31.2%",
    "2x12": "+40.0%"
   },
   "Fc_error": {
    "2x4": "+13.8%",
    "2x6": "+7.1%",
    "2x8": "+11.1%",
    "2x10": "+15.4%",
    "2x12": "+20.0%"
   },
   "E_error": "+14.3%",
   "Emin_error": "+13.7%",
   "note": "matches no row of Table 4B; E/Emin are the No.2 DENSE sub-grade values"
  }
 }
];

var TOL = { INT: 1e-4, DC: 1e-3, PUB: 0.01 };

function decimals(v) {
  var m = String(v).match(/\.(\d+)$/);
  return m ? m[1].length : 0;
}
function tolFor(expected, rel) {
  return Math.max(rel * Math.abs(expected), 0.5000001 * Math.pow(10, -decimals(expected)));
}
function f3dbg(v) { return (typeof v === 'number' && isFinite(v)) ? v.toFixed(3) : String(v); }
function fmt(v) {
  if (v == null) return String(v);
  if (typeof v !== 'number') return String(v);
  if (!isFinite(v)) return String(v);
  return Math.abs(v) >= 1000 ? v.toFixed(3) : v.toPrecision(8).replace(/0+$/, '').replace(/\.$/, '');
}
function cmp(out, label, actual, expected, rel) {
  var tol = tolFor(expected, rel == null ? TOL.INT : rel);
  var ok = typeof actual === 'number' && isFinite(actual) && Math.abs(actual - expected) <= tol;
  out.push([label, ok, fmt(actual) + ' vs ' + expected + ' (tol ' + tol.toPrecision(3) + ')']);
}
function eq(out, label, actual, expected) {
  out.push([label, actual === expected, String(actual) + ' vs ' + String(expected)]);
}
function has(out, label, str, needle) {
  out.push([label, typeof str === 'string' && str.indexOf(needle) >= 0, String(str)]);
}
function isTrue(out, label, v, detail) { out.push([label, v === true, detail == null ? String(v) : String(detail)]); }

function hdrLoads(i) { return { D: num(i.D_plf), L: num(i.L_plf), Lr: num(i.Lr_plf), S: num(i.S_plf) }; }

var RUNNERS = {

  'HDR-DEFAULT-ROOF': function (F) { return headerFixture(F); },
  'HDR-BAND-2X8-4FT': function (F) { return headerFixture(F); },
  'HDR-BAND-2X10-8FT': function (F) { return headerFixture(F); },
  'HDR-BAND-2X12-16FT': function (F) { return headerFixture(F); },
  'HDR-DEFLECTION-GOVERNS': function (F) { return headerFixture(F); },

  'HDR-RB-OVER-50-NOT-APPLICABLE': function (F) {
    var i = F.inputs, e = F.expected, out = [];
    // Load set is immaterial: R_B is pure geometry. 100 plf keeps the envelope alive.
    var r = checkHeader({ size: i.size, n_plies: i.n_plies, span_ft: i.span_ft, lu_ft: i.lu_ft,
      species: i.species, loads: { D: 100, L: 0, Lr: 0, S: 0 }, n_jambs_bearing: 1, dryInstall: false });
    cmp(out, 'l_e', r.le_in, e.le_in);
    has(out, 'Table 3.3.3 branch', r.le_branch, '1.63 lu + 3d');
    cmp(out, 'R_B', r.R_B, e.R_B);
    eq(out, 'R_B <= 50', r.R_B_ok, e.R_B_le_50);
    eq(out, 'engine refuses (NOT APPLICABLE, no D/C)', r.status + '|' + (r.governing === undefined),
       'NOT APPLICABLE|true');
    has(out, 'cites §3.3.3.7', r.errors.length ? r.errors[0].ref : '', '3.3.3.7');
    return out;
  },

  'JAMB-DEFAULT-ROOF': function (F) {
    var i = F.inputs, e = F.expected, out = [];
    var d = designJambPack({ size: i.size, species: i.species,
      P: { D: i.P_D_lb, L: i.P_L_lb, Lr: i.P_Lr_lb, S: i.P_S_lb },
      le1_in: i.story_ft * 12,          // fixture gives no top-of-opening: l_e1 = story height
      le2_in: i.weak_axis_brace_in, story_in: i.story_ft * 12 });
    var r = d.chosen, g = r.governing;
    eq(out, 'auto-selected jamb count', r.n, e.min_jambs_required);
    eq(out, 'governing combination', g.tag, e.governing_combo);
    cmp(out, 'P', g.P, e.P_lb);
    cmp(out, 'C_D', g.CD, e.C_D);
    cmp(out, 'F*_c', g.Fc_star, e.Fc_star_psi);
    cmp(out, 'weak braced l_e', g.weak.le, e.weak_braced.le_in);
    cmp(out, 'weak braced l_e/d', g.weak.slen, e.weak_braced.le_over_d);
    cmp(out, 'weak braced F_cE', g.weak.FcE, e.weak_braced.F_cE_psi);
    cmp(out, 'weak braced C_P', g.weak.CP, e.weak_braced.C_P);
    cmp(out, 'strong l_e', g.strong.le, e.strong.le_in);
    cmp(out, 'strong l_e/d', g.strong.slen, e.strong.le_over_d);
    cmp(out, 'strong F_cE', g.strong.FcE, e.strong.F_cE_psi);
    cmp(out, 'strong C_P', g.strong.CP, e.strong.C_P);
    cmp(out, 'weak UNBRACED l_e/d (disclosure)', r.weak_unbraced.slen, e.weak_unbraced_le_over_d);
    eq(out, 'weak unbraced would not be applicable', r.weak_unbraced.ok, e.weak_unbraced_applicable);
    eq(out, 'governing axis', g.axis, e.governing_axis);
    cmp(out, 'C_P', g.CP, e.C_P);
    cmp(out, "F'_c", g.Fc_p, e.Fc_prime_psi);
    cmp(out, 'f_c', g.fc, e.fc_psi);
    cmp(out, 'D/C', g.dc, e.DC, TOL.DC);
    return out;
  },

  'JAMB-2X6-9FT': function (F) { return jambBraceFixture(F); },
  'JAMB-2X6-10FT': function (F) { return jambBraceFixture(F); },

  'KING-DEFAULT-ROOF': function (F) {
    var i = F.inputs, e = F.expected, out = [];
    // weak_axis "sheathed" -> le2 = 0 (continuously braced), the AWC E1.5a model.
    var r = checkKing({ size: i.size, species: i.species, story_ft: i.story_ft,
      opening_ft: i.opening_ft, spacing_in: i.stud_spacing_in,
      p_strength_psf: i.p_strength_psf, le2_in: 0,
      P: { D: i.P_gravity_lb, L: 0, Lr: 0, S: 0 } });
    var g = r.governing;
    cmp(out, 'tributary width', r.trib_ft, i.trib_width_ft);
    eq(out, 'governing combination', g.tag, e.governing_combo);
    cmp(out, 'C_D', g.CD, e.C_D);
    cmp(out, 'w (ASD, 0.6 x strength)', g.w, e.w_ASD_plf);
    cmp(out, 'M', g.M_in, e.M_lb_in);
    cmp(out, 'S_x (strong axis)', r.Sx, e.S_x_in3);
    cmp(out, 'f_b', g.fb, e.fb_psi);
    cmp(out, "F'_b", g.Fb_p, e.Fb_prime_psi);
    cmp(out, 'C_P', g.CP, e.C_P);
    cmp(out, "F'_c", g.Fc_p, e.Fc_prime_psi);
    cmp(out, 'F_cE1', r.FcE1, e.F_cE1_psi);
    cmp(out, 'Eq. 3.9-3 term 1', g.term1, e.term1);
    cmp(out, 'Eq. 3.9-3 term 2', g.term2, e.term2, TOL.DC);
    cmp(out, 'Eq. 3.9-3 D/C', g.dc, e.interaction_DC, TOL.DC);
    eq(out, 'passes', r.pass, e.passes);
    eq(out, 'C_r = 1.0 (NDS §4.3.9 not met)', r.Cr, i.Cr);
    return out;
  },

  'STUD-DEFAULT-ROOF': function (F) { return studFixture(F); },
  'STUD-DEFAULT-3RD': function (F) { return studFixture(F); },
  'STUD-DEFAULT-2ND': function (F) { return studFixture(F); },

  'STUD-LE-OVER-D-OVER-50-NOT-APPLICABLE': function (F) {
    var i = F.inputs, e = F.expected, out = [];
    // weak_axis "UNBRACED" -> the brace spacing IS the story height.
    var r = checkStud({ size: i.size, spacing_in: i.spacing_in, species: i.species,
      story_ft: i.story_ft, plf: { D: i.axial_plf, L: 0, Lr: 0, S: 0 },
      p_strength_psf: i.p_strength_psf, le2_in: i.story_ft * 12 });
    cmp(out, 'weak-axis l_e', r.le2_in, e.le_in);
    cmp(out, 'd (weak axis)', r.b, e.d_in);
    cmp(out, 'l_e/d', r.slenderness.weak, e.le_over_d);
    eq(out, 'l_e/d <= 50', r.slenderness.ok, e.le_over_d_le_50);
    eq(out, 'engine refuses (NOT APPLICABLE, no D/C)', r.status + '|' + (r.governing === undefined),
       'NOT APPLICABLE|true');
    has(out, 'cites §3.7.1.4', r.errors.length ? r.errors[0].ref : '', '3.7.1.4');
    return out;
  },

  'PUB-AWC-E1.2a-CL': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    // MAPPING: this example is a CONCENTRATED load at mid-span. Table 3.3.3's
    // concentrated rows are not implemented (headers here are always uniformly
    // loaded), so AWC's own l_e = 375 in is the input and what is verified is
    // the R_B -> F_bE -> Eq. 3.3-6 chain against the published C_L.
    var cl = calcCL(i.Fb_psi * i.C_D * i.C_F, i.Emin_psi, i.lu_in, i.d_in, i.b_in, false, p.le_in);
    cmp(out, 'l_e taken from the published concentrated-load row', cl.le, p.le_in, TOL.PUB);
    cmp(out, 'R_B', cl.RB, e.R_B, TOL.PUB);
    eq(out, 'R_B <= 50', cl.ok, e.R_B_le_50);
    cmp(out, 'F_bE', cl.FbE, e.F_bE_psi, TOL.PUB);
    cmp(out, 'C_L', cl.CL, e.C_L, TOL.PUB);
    cmp(out, "F'_b", cl.Fb_star * cl.CL, e.Fb_prime_psi, TOL.PUB);
    cmp(out, 'C_L vs AWC published', cl.CL, p.C_L, TOL.PUB);
    return out;
  },

  'PUB-AWC-E1.4-CP': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    var cp = calcCP(i.Fc_psi, i.Emin_psi, i.le_in, i.d_in);
    cmp(out, 'l_e/d', cp.slen, e.le_over_d, TOL.PUB);
    eq(out, 'l_e/d <= 50', cp.ok, e.le_over_d_le_50);
    cmp(out, 'F_cE', cp.FcE, e.F_cE_psi, TOL.PUB);
    cmp(out, 'C_P', cp.CP, e.C_P, TOL.PUB);
    cmp(out, "F'_c", i.Fc_psi * cp.CP, e.Fc_prime_psi, TOL.PUB);
    cmp(out, 'P allowable', i.Fc_psi * cp.CP * i.A_in2, e.P_allow_lb, TOL.PUB);
    cmp(out, 'C_P vs AWC published', cp.CP, p.C_P, TOL.PUB);
    return out;
  },

  'PUB-AWC-E1.5a-STUD-CP': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    // le2 = 0 verbatim in AWC: "Strong axis buckling controls."
    var Fc_star = i.Fc_psi * i.C_D * i.C_F_c;
    var cp = calcCP(Fc_star, i.Emin_psi, i.le1_in, LBR[i.size].d);
    cmp(out, 'F*_c', Fc_star, p.Fc_star_psi, TOL.PUB);
    cmp(out, 'l_e/d (strong)', cp.slen, e.le_over_d, TOL.PUB);
    cmp(out, 'F_cE', cp.FcE, e.F_cE_psi, TOL.PUB);
    cmp(out, 'C_P', cp.CP, e.C_P, TOL.PUB);
    cmp(out, "F'_c", Fc_star * cp.CP, e.Fc_prime_psi, TOL.PUB);
    cmp(out, 'P buckling', Fc_star * cp.CP * LBR[i.size].A, e.P_buckling_lb, TOL.PUB);
    cmp(out, 'C_P vs AWC published', cp.CP, p.C_P, TOL.PUB);
    // The weak axis at le2 = 0 must not govern.
    var weak = calcCP(Fc_star, i.Emin_psi, i.le2_in, LBR[i.size].b);
    eq(out, 'weak axis braced -> C_P = 1.0', weak.CP, 1.0);
    return out;
  },

  'PUB-AWC-E1.7-BEAMCOLUMN': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    var g = LBR[i.size];
    var Fc_star = i.Fc_psi * i.C_D * i.C_F;
    var cp = calcCP(Fc_star, i.Emin_psi, i.le1_in, g.d);
    var Fc_p = Fc_star * cp.CP;
    var Fb_p = i.Fb_psi * i.C_D * i.C_F * i.C_r * i.C_L;
    var M_in = i.w_psf * i.spacing_ft * i.length_ft * i.length_ft / 8 * 12;
    var fc = (i.P_D_lb + i.P_S_lb) / g.A, fb = M_in / g.S;
    var r = eq393(fc, Fc_p, fb, Fb_p, cp.FcE);
    cmp(out, 'F_cE', cp.FcE, e.F_cE_psi, TOL.PUB);
    cmp(out, 'C_P', cp.CP, e.C_P, TOL.PUB);
    cmp(out, "F'_c", Fc_p, e.Fc_prime_psi, TOL.PUB);
    cmp(out, 'f_c', fc, e.f_c_psi, TOL.PUB);
    cmp(out, "F'_b1", Fb_p, e.Fb1_prime_psi, TOL.PUB);
    cmp(out, 'M', M_in, e.M_lb_in, TOL.PUB);
    cmp(out, 'f_b1', fb, e.f_b1_psi, TOL.PUB);
    isTrue(out, 'Eq. 3.9-3 applicable', r.ok, r.error || 'ok');
    cmp(out, 'term 1', r.term1, e.term1, TOL.PUB);
    cmp(out, 'term 2', r.term2, e.term2, TOL.PUB);
    cmp(out, 'Eq. 3.9-3', r.dc, e.eq_3_9_3, TOL.PUB);
    cmp(out, 'Eq. 3.9-3 vs AWC published', r.dc, p.eq_3_9_3, TOL.PUB);
    return out;
  },

  'PUB-AWC-E1.9-WALLSTUD': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    var g = LBR[i.size];
    var Fc_star = i.Fc_psi * i.C_D;                    // Southern Pine: C_F = 1.0
    var cp = calcCP(Fc_star, i.Emin_psi, i.le_in, i.d1_in);
    var Fc_p = Fc_star * cp.CP;
    var Fb_p = i.Fb_psi * i.C_D * i.C_r * i.C_L;       // AWC uses the SDPWS 1.25, not NDS 1.15
    var M_in = i.w_plf * i.height_ft * i.height_ft / 8 * 12;
    var fc = i.P_lb / g.A, fb = M_in / g.S;
    var r = eq393(fc, Fc_p, fb, Fb_p, cp.FcE);
    cmp(out, 'F_cE', cp.FcE, e.F_cE_psi, TOL.PUB);
    cmp(out, 'C_P', cp.CP, e.C_P, TOL.PUB);
    cmp(out, "F'_c", Fc_p, e.Fc_prime_psi, TOL.PUB);
    cmp(out, 'f_c', fc, e.f_c_psi, TOL.PUB);
    cmp(out, "F'_b", Fb_p, e.Fb_prime_psi, TOL.PUB);
    cmp(out, 'M', M_in, e.M_lb_in, TOL.PUB);
    cmp(out, 'f_b', fb, e.f_b_psi, TOL.PUB);
    cmp(out, 'Eq. 3.9-3', r.dc, e.eq_3_9_3, TOL.PUB);
    cmp(out, 'Eq. 3.9-3 vs AWC published', r.dc, p.eq_3_9_3, TOL.PUB);
    // The pre-2013 Southern Pine table is what made the old page read 0.511 here.
    cmp(out, 'Table 4B F_b for 2x8 SYP', refFb('SYP', '2x8'), i.Fb_psi);
    return out;
  },

  'PUB-VF-TRIMMER-JAMB': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    // Published basis: C_D = 1.0 and C_P = 1.0 ("trimmer studs inside a sheathed
    // wall are braced"). Mapped as: P entered as floor live L (the §2.4.1
    // combination whose C_D is 1.0) and both axes braced (l_e1 = l_e2 = 0).
    var r = checkJambPack({ size: i.size, n: i.n, species: i.species,
      P: { D: 0, L: i.P_lb, Lr: 0, S: 0 }, le1_in: 0, le2_in: 0, story_in: i.story_ft * 12 });
    var g = r.governing;
    eq(out, 'governing combination (C_D = 1.0)', g.tag, 'D+L');
    cmp(out, 'C_D', g.CD, i.C_D, TOL.PUB);
    cmp(out, 'C_P (both axes braced)', g.CP, e.C_P, TOL.PUB);
    cmp(out, 'f_c', g.fc, e.f_c_psi, TOL.PUB);
    cmp(out, "F'_c", g.Fc_p, e.Fc_prime_psi, TOL.PUB);
    cmp(out, 'D/C', g.dc, e.DC, TOL.PUB);
    cmp(out, 'D/C vs VF published', g.dc, p.DC, TOL.PUB);
    return out;
  },

  'PUB-VF-HEADER-BEARING': function (F) {
    var i = F.inputs, e = F.expected, p = F.published, out = [];
    // n_plies multiplies the 1.5 in ply width, so 5.5/1.5 expresses the VF
    // header's 5.5 in width exactly (A, S and I all scale linearly with b).
    var r = checkHeader({ size: '2x12', n_plies: i.b_header_in / 1.5, span_ft: i.span_ft,
      species: 'DFL', loads: { D: i.D_plf, L: i.L_plf, Lr: i.Lr_plf, S: i.S_plf },
      n_jambs_bearing: 2, dryInstall: false });
    var g = r.governing;
    eq(out, 'governing combination', g.tag, e.governing_combo);
    cmp(out, 'w', g.w, e.w_plf, TOL.PUB);
    cmp(out, 'C_D', g.CD, e.C_D, TOL.PUB);
    cmp(out, 'M (kip-ft)', g.M_in / 12000, e.M_kipft, TOL.PUB);
    // p.bearing_combo is the prose form "D+0.75L+0.75(Lr or S)"; the engine names
    // the alternate it actually enveloped, which here is the S branch.
    has(out, 'bearing governed by the largest UNFACTORED combination (' + p.bearing_combo + ')',
        r.bearing.combo, 'D+0.75L+0.75S');
    cmp(out, 'bearing w', r.bearing.w, p.bearing_w_plf, TOL.PUB);
    cmp(out, 'l_b required', r.bearing.lb_req_in, e.lb_required_in, TOL.PUB);
    cmp(out, 'l_b required vs VF published', r.bearing.lb_req_in, p.lb_required_in, TOL.PUB);
    cmp(out, "F'_cperp carries no C_D", r.bearing.FcP_p, i.Fcperp_psi);
    // VF sizes the trimmers BY BEARING: l_b = 2.65 in over a 5.5 in wide header
    // needs two 1.5 in plies. The auto-designer has to reach the same answer.
    eq(out, 'bearing-driven minimum jamb count', r.bearing.n_jambs_min, 2);
    var jd = designJambPack({ size: '2x6', species: 'DFL',
      P: { D: i.D_plf * i.span_ft / 2, L: i.L_plf * i.span_ft / 2,
           Lr: i.Lr_plf * i.span_ft / 2, S: i.S_plf * i.span_ft / 2 },
      le1_in: 0, le2_in: 0, story_in: 108, minCount: r.bearing.n_jambs_min });
    eq(out, 'auto-find returns the published (2) 2x6 trimmers', jd.chosen.n, 2);
    isTrue(out, 'and that pack passes', jd.chosen.pass, jd.chosen.status);
    has(out, 'published solution', p.solution, '(2) 2x6 trimmer studs');
    return out;
  },

  'REF-SYP-TABLE-4B': function (F) {
    var e = F.expected, out = [], R = NDS_REF.SYP;
    SIZES.forEach(function (s) {
      cmp(out, 'F_b ' + s, R.Fb[s], e.Fb_psi[s]);
      cmp(out, 'F_c ' + s, R.Fc[s], e.Fc_psi[s]);
    });
    cmp(out, 'F_v', R.Fv, e.Fv_psi);
    cmp(out, 'F_cperp', R.FcP, e.Fcperp_psi);
    cmp(out, 'E', R.E, e.E_psi);
    cmp(out, 'E_min', R.Emin, e.Emin_psi);
    eq(out, 'C_F not applied (Table 4B is width-specific)', R.useCF, false);
    return out;
  }
};

// ── shared fixture drivers ──────────────────────────────────────────────────
function headerFixture(F) {
  var i = F.inputs, e = F.expected, out = [];
  var r = checkHeader({ size: i.size, n_plies: i.n_plies, span_ft: i.span_ft,
    lu_ft: i.lu_ft == null ? i.span_ft : i.lu_ft, species: i.species, loads: hdrLoads(i),
    n_jambs_bearing: i.n_jambs_bearing == null ? 1 : i.n_jambs_bearing,
    Cr: i.Cr == null ? 1.0 : i.Cr, dryInstall: false });
  var g = r.governing;
  if (e.governing_combo != null) eq(out, 'governing combination', g.tag, e.governing_combo);
  if (e.w_plf != null) cmp(out, 'w', g.w, e.w_plf);
  if (e.C_D != null) cmp(out, 'C_D', g.CD, e.C_D);
  if (e.M_lb_in != null) cmp(out, 'M', g.M_in, e.M_lb_in);
  if (e.V_lb != null) cmp(out, 'V', g.V, e.V_lb);
  if (e.lu_over_d != null) cmp(out, 'l_u/d', r.lu_in / r.d, e.lu_over_d);
  if (e.le_in != null) cmp(out, 'l_e', r.le_in, e.le_in);
  if (e.le_branch != null) has(out, 'Table 3.3.3 branch', r.le_branch, e.le_branch.indexOf('2.06') >= 0 ? '2.06 lu' : '1.63 lu + 3d');
  if (e.R_B != null) cmp(out, 'R_B', r.R_B, e.R_B);
  if (e.R_B_le_50 != null) eq(out, 'R_B <= 50', r.R_B_ok, e.R_B_le_50);
  if (e.F_bE_psi != null) cmp(out, 'F_bE', g.cl.FbE, e.F_bE_psi);
  if (e.C_L != null) cmp(out, 'C_L', g.cl.CL, e.C_L);
  if (e.Fb_star_psi != null) cmp(out, 'F*_b', g.Fb_star, e.Fb_star_psi);
  if (e.Fb_prime_psi != null) cmp(out, "F'_b", g.Fb_p, e.Fb_prime_psi);
  if (e.fb_psi != null) cmp(out, 'f_b', g.fb, e.fb_psi);
  if (e.DC_flexure != null) cmp(out, 'D/C flexure', g.dc_b, e.DC_flexure, TOL.DC);
  if (e.fv_psi != null) cmp(out, 'f_v', g.fv, e.fv_psi);
  if (e.Fv_prime_psi != null) cmp(out, "F'_v", g.Fv_p, e.Fv_prime_psi);
  if (e.DC_shear != null) cmp(out, 'D/C shear', g.dc_v, e.DC_shear, TOL.DC);
  if (e.bearing_lb_in != null) cmp(out, 'bearing l_b', r.bearing.lb_in, e.bearing_lb_in);
  if (e.C_b != null) cmp(out, 'C_b', r.bearing.Cb, e.C_b);
  if (e.fcperp_psi != null) cmp(out, 'f_cperp', r.bearing.fcperp, e.fcperp_psi);
  if (e.Fcperp_prime_psi != null) cmp(out, "F'_cperp", r.bearing.FcP_p, e.Fcperp_prime_psi);
  if (e.DC_bearing != null) cmp(out, 'D/C bearing', r.bearing.dc, e.DC_bearing, TOL.DC);
  if (e.defl_live_in != null) cmp(out, 'deflection live (dryInstall = false)', r.deflection.live, e.defl_live_in);
  if (e.defl_live_allow_in != null) cmp(out, 'deflection live allowable L/360', r.deflection.live_allow, e.defl_live_allow_in);
  if (e.defl_total_in != null) cmp(out, 'deflection total (dryInstall = false)', r.deflection.total, e.defl_total_in);
  if (e.defl_total_allow_in != null) cmp(out, 'deflection total allowable L/240', r.deflection.total_allow, e.defl_total_allow_in);
  if (e.DC_defl_total != null) cmp(out, 'D/C deflection total', r.deflection.dc_total, e.DC_defl_total, TOL.DC);
  if (e.governing_DC != null) cmp(out, 'governing D/C', r.dc_max, e.governing_DC, TOL.DC);
  if (e.passes != null) eq(out, 'passes', r.pass, e.passes);
  return out;
}

function jambBraceFixture(F) {
  var i = F.inputs, e = F.expected, out = [];
  var r = checkJambPack({ size: i.size, n: i.n, species: i.species,
    P: { D: i.P_D_lb, L: 0, Lr: i.P_Lr_lb, S: i.P_S_lb },
    le1_in: i.story_ft * 12, le2_in: i.weak_axis_brace_in, story_in: i.story_ft * 12 });
  var g = r.governing;
  cmp(out, 'C_P weak braced @ ' + i.weak_axis_brace_in + ' in', g.weak.CP, e.C_P_weak_braced_48in);
  cmp(out, 'C_P strong (l_e = story)', g.strong.CP, e.C_P_strong);
  cmp(out, 'C_P governing', g.CP, e.C_P_governing);
  cmp(out, 'weak UNBRACED l_e/d', r.weak_unbraced.slen, e.weak_unbraced_le_over_d);
  eq(out, 'weak unbraced not applicable', r.weak_unbraced.ok, e.weak_unbraced_applicable);
  cmp(out, "F'_c", g.Fc_p, e.Fc_prime_psi);
  cmp(out, 'f_c', g.fc, e.fc_psi);
  cmp(out, 'D/C', g.dc, e.DC, TOL.DC);
  return out;
}

function studFixture(F) {
  var i = F.inputs, e = F.expected, out = [];
  // weak_axis "sheathed" -> le2 = 0; windDeflFactor 0.6 = the fixture's ASD wind.
  var r = checkStud({ size: i.size, spacing_in: i.spacing_in, species: i.species,
    story_ft: i.story_ft, plf: { D: i.D_plf, L: i.L_plf, Lr: i.Lr_plf, S: i.S_plf },
    p_strength_psf: i.p_strength_psf, le2_in: 0, finish: 'brittle', windDeflFactor: 0.6 });
  var g = r.governing;
  eq(out, 'governing combination', g.tag, e.governing_combo);
  cmp(out, 'C_D', g.CD, e.C_D);
  cmp(out, 'C_P', g.CP, e.C_P);
  eq(out, 'C_P axis', g.axis, e.C_P_axis);
  cmp(out, 'f_c', g.fc, e.fc_psi);
  cmp(out, 'f_b', g.fb, e.fb_psi);
  cmp(out, "F'_c", g.Fc_p, e.Fc_prime_psi);
  cmp(out, "F'_b", g.Fb_p, e.Fb_prime_psi);
  cmp(out, 'F_cE1', r.FcE1, e.F_cE1_psi);
  cmp(out, 'Eq. 3.9-3 term 1', g.term1, e.term1);
  cmp(out, 'Eq. 3.9-3 term 2', g.term2, e.term2, TOL.DC);
  cmp(out, 'Eq. 3.9-3 D/C', g.dc, e.interaction_DC, TOL.DC);
  cmp(out, 'C_r', r.Cr, i.Cr);
  cmp(out, 'wind deflection (0.6W basis)', r.deflection.delta, e.wind_defl_in);
  cmp(out, 'wind deflection allowable H/240', r.deflection.allow, e.wind_defl_allow_L240_in);
  eq(out, 'passes', r.pass, e.passes);
  return out;
}

// ── engine-behaviour fixtures (spec §8: the cases the E set does not cover) ──
function demoState(over) {
  var s = {
    species: 'DFL', wallWidth: '2x6', flrHt: 9, windOpenW: 25, windStudW: 25,
    weakBraceIn: 48, dryInstall: true, plateSpecies: 'DFL', finishType: 'brittle',
    LV: LV_DEFAULTS,
    floors: [
      { id: 1, name: 'Roof', headers: [{ id: 'h1', stack_id: 'H-1', label: 'H-1', span: 8,
          roofTrib: 10, wallTrib: 8, wallType: 1, trialSz: '2x8', rowWallSz: '2x6',
          topOfOpening: 6, jambCount: 0, kingCount: 1, studSpacing: 16 }],
        studs: [{ sid: 'S1', id: 's1', label: 'Exterior Long Side', roofTrib: 10, wallTrib: 8,
          wallType: 1, trialSz: '2x6', trialSpacing: 16 }] },
      { id: 2, name: '3rd Floor', headers: [{ id: 'h2', stack_id: 'H-1', label: 'H-1', span: 8,
          floorTrib1: 5, wallTrib: 8, wallType: 1, trialSz: '2x8', rowWallSz: '2x6',
          topOfOpening: 6, jambCount: 0, kingCount: 1, studSpacing: 16 }],
        studs: [{ sid: 'S1', id: 's2', label: 'Exterior Long Side', floorTrib1: 5, wallTrib: 8,
          wallType: 1, trialSz: '2x6', trialSpacing: 16 }] }
    ]
  };
  return over ? over(JSON.parse(JSON.stringify(s))) : s;
}

var ENGINE_FIXTURES = [
  { id: 'ENG-COMBO-D-ONLY', src: 'spec §3 / NDS Table 2.3.2', run: function () {
      var out = [];
      var r = checkJambPack({ size: '2x6', n: 2, species: 'DFL', P: { D: 5000, L: 0, Lr: 0, S: 0 },
        le1_in: 72, le2_in: 48, story_in: 108 });
      eq(out, 'dead-load-only member governs at combination 1', r.governing.tag, 'D');
      cmp(out, 'C_D = 0.9, not 1.0', r.governing.CD, 0.9);
      var dl = r.combos.filter(function (c) { return c.tag === 'D+L'; })[0];
      isTrue(out, 'D at C_D 0.9 is more severe than D+L at 1.0',
             r.governing.dc > dl.dc, r.governing.dc.toFixed(4) + ' > ' + dl.dc.toFixed(4));
      return out;
    } },
  { id: 'ENG-KING-AXIAL', src: 'spec §4 — kings take half a stud spacing of gravity only', run: function () {
      var out = [], res = compute(demoState());
      var row = res.floors[0].headers[0];
      cmp(out, 'wall gravity D at the roof header', row.wallAcc.D, 320);
      cmp(out, 'king axial D = plf x s/2', row.kingP.D, 320 * (16 / 12) / 2);
      cmp(out, 'king carries no share of the header reaction', row.kingP.D,
          row.wallAcc.D * (16 / 12) / 2);
      isTrue(out, 'jamb pack carries 100 % of the header reaction',
             Math.abs(row.jambP.D - 320 * 8 / 2) < 1e-6, String(row.jambP.D));
      return out;
    } },
  { id: 'ENG-JAMB-LE1', src: "spec §4 — jamb strong axis = top of opening (Nick's decision)", run: function () {
      var out = [], res = compute(demoState());
      var j = res.floors[0].headers[0].jamb;
      cmp(out, 'l_e1 = top of opening (6 ft), not the 9 ft story', j.le1_in, 72);
      var atStory = checkJambPack({ size: '2x6', n: j.n, species: 'DFL', P: j.P,
        le1_in: 108, le2_in: 48, story_in: 108 });
      isTrue(out, 'strong-axis C_P is larger at the shorter trimmer length',
             j.governing.strong.CP > atStory.governing.strong.CP,
             j.governing.strong.CP.toFixed(4) + ' > ' + atStory.governing.strong.CP.toFixed(4));
      eq(out, 'weak axis still governs at 48 in bracing', j.governing.axis, 'weak(braced)');
      return out;
    } },
  { id: 'ENG-CONTINUITY', src: 'spec §5 — a stack that skips a floor is an error', run: function () {
      var out = [];
      var gap = demoState(function (s) {
        s.floors.push({ id: 3, name: '2nd Floor', headers: [{ id: 'h3', stack_id: 'H-1', label: 'H-1',
          span: 8, floorTrib1: 5, wallTrib: 8, wallType: 1, trialSz: '2x8', rowWallSz: '2x6',
          topOfOpening: 6, jambCount: 0, kingCount: 1, studSpacing: 16 }], studs: [] });
        s.floors[1].headers = [];       // delete the middle header -> stack skips a level
        return s;
      });
      var issues = validate(gap);
      isTrue(out, 'gap in a header stack is reported', issues.some(function (i) { return /skips level/.test(i.message); }),
             issues.map(function (i) { return i.message; }).join(' | ') || 'no issues');
      var threw = false;
      try { compute(gap); } catch (e) { threw = e.name === 'ValidationError'; }
      isTrue(out, 'compute refuses the discontinuous stack', threw, String(threw));
      var transfer = JSON.parse(JSON.stringify(gap));
      transfer.floors[2].headers[0].transfer = true;
      eq(out, 'marking the row as a transfer clears it', validate(transfer).length, 0);
      return out;
    } },
  { id: 'ENG-PLIES-FROM-ROW', src: 'spec §4 / H-10 — ply count from the ROW wall size', run: function () {
      var out = [];
      var s = demoState(function (st) { st.wallWidth = '2x6'; st.floors[0].headers[0].rowWallSz = '2x4'; return st; });
      var row = compute(s).floors[0].headers[0];
      eq(out, '2x4 row in a 2x6 page = 2 plies', row.n_plies, 2);
      cmp(out, 'b_eff = 3.0 in', row.header.b_eff, 3.0);
      var s3 = demoState();
      eq(out, '2x6 row = 3 plies', compute(s3).floors[0].headers[0].n_plies, 3);
      return out;
    } },
  { id: 'ENG-TOP-OF-OPENING', src: 'spec §4 — head above the story height is an error', run: function () {
      var out = [];
      var bad = demoState(function (s) { s.floors[0].headers[0].topOfOpening = 10; return s; });
      var issues = validate(bad);
      isTrue(out, 'top of opening above the story height is reported',
             issues.some(function (i) { return /above the story height/.test(i.message); }),
             issues.map(function (i) { return i.message; }).join(' | ') || 'no issues');
      var threw = false;
      try { compute(bad); } catch (e) { threw = e.name === 'ValidationError'; }
      isTrue(out, 'no silent 0.9 x rewrite — compute refuses', threw, String(threw));
      // every page-level load must be a number and not negative
      var neg = demoState(function (x) { x.LV = Object.assign({}, LV_DEFAULTS, { snowLoad: -25 }); return x; });
      isTrue(out, 'a negative psf load is a blocking error',
             validate(neg).some(function (i) { return /cannot be negative/.test(i.message); }),
             validate(neg).map(function (i) { return i.path; }).join(',') || 'no issues');
      var nan = demoState(function (x) { x.LV = Object.assign({}, LV_DEFAULTS, { roofDL: 'twenty' }); return x; });
      isTrue(out, 'a non-numeric psf load is a blocking error',
             validate(nan).some(function (i) { return /is not a number/.test(i.message); }),
             validate(nan).map(function (i) { return i.path; }).join(',') || 'no issues');
      eq(out, 'the shipped loads validate clean', validate(demoState()).length, 0);
      return out;
    } },
  { id: 'ENG-JAMB-BEARING-DESIGN', src: 'spec §4 / reviewer repro — auto-find must satisfy header end bearing', run: function () {
      // 4 ft 2x12 DFL header in a 2x4 wall (2 plies, b_eff = 3.0), 30 ft roof
      // tributary, 2x4 jambs, weak axis continuously braced, head at 2 ft.
      // D = 15x8 + 30x20 = 720 plf, S = 30x25 = 750 plf -> D+S = 1470 plf,
      // R = 1470 x 4/2 = 2940 lb. At ONE 1.5 in trimmer the header end bearing
      // is 2940/(3.0x1.5)/625 = 1.045 FAIL even though axial (0.326) and plate
      // (0.896) both pass; at two it is 0.523.
      var out = [];
      var st = demoState(function (x) {
        x.weakBraceIn = 0;
        x.floors = [x.floors[0]];
        var h = x.floors[0].headers[0];
        h.span = 4; h.roofTrib = 30; h.trialSz = '2x12';
        h.rowWallSz = '2x4'; h.jambSz = '2x4'; h.kingSz = '2x4';
        h.topOfOpening = 2.0; h.jambCount = 0;
        return x;
      });
      var row = compute(st).floors[0].headers[0];
      cmp(out, 'header reaction, largest unfactored combination', row.header.bearing.R_lb, 2940);
      eq(out, 'b_eff from the ROW wall size (2 plies)', row.header.b_eff, 3.0);
      eq(out, 'bearing-driven minimum jamb count', row.n_jambs_bearing_min, 2);
      eq(out, 'auto-find returns 2 jambs', row.jamb.n, 2);
      cmp(out, 'header end bearing D/C at the designed count', row.header.bearing.dc, 0.5227, TOL.DC);
      isTrue(out, 'the designed row passes every check', row.status === 'PASS', row.status + ' ' + f3dbg(row.dc_max));
      // and the count the old auto-find would have returned does NOT pass bearing
      var one = checkHeader({ size: '2x12', n_plies: 2, span_ft: 4, species: 'DFL',
        loads: row.loads, n_jambs_bearing: 1, dryInstall: st.dryInstall });
      cmp(out, 'one jamb would have failed bearing', one.bearing.dc, 1.0453, TOL.DC);
      isTrue(out, 'axial alone would have passed at one jamb — bearing is the driver',
             checkJambPack({ size: '2x4', n: 1, species: 'DFL', P: row.jambP,
                             le1_in: 24, le2_in: 0, story_in: 108 }).pass, 'axial+plate pass at n=1');
      return out;
    } },
  { id: 'ENG-EXPORT-V2', src: 'spec §6 — foundation export payload', run: function () {
      var out = [], x = compute(demoState()).export;
      eq(out, 'version', x.version, 2);
      eq(out, 'units declared', x.units, 'plf / lb');
      eq(out, 'lowest floor exported', x.floorName, '3rd Floor');
      isTrue(out, 'stud rows carry D, L, Lr and S separately',
             x.studs.length > 0 && ['D', 'L', 'Lr', 'S'].every(function (k) { return typeof x.studs[0][k] === 'number'; }),
             JSON.stringify(x.studs[0]));
      isTrue(out, 'jamb point reactions exported', x.jambs.length > 0 && typeof x.jambs[0].D === 'number',
             JSON.stringify(x.jambs[0]));
      isTrue(out, 'governing combination carried', typeof x.studs[0].governing === 'string', String(x.studs[0].governing));
      return out;
    } },
  { id: 'ENG-COMBO-TABLE', src: 'spec §3 — ASCE 7-16 §2.4.1 table', run: function () {
      var out = [];
      var g = combinations({ D: 1, L: 1, Lr: 1, S: 1 }, { wind: false });
      var w = combinations({ D: 1, L: 1, Lr: 1, S: 1 }, { wind: true });
      eq(out, 'headers/jambs: combos 5-7 reported n/a', g.filter(function (c) {
        return ['5', '6', '7'].indexOf(c.id) >= 0 && c.skipped;
      }).length, 3);
      eq(out, 'C_D for D', g[0].CD, 0.9);
      eq(out, 'C_D for D+L', g[1].CD, 1.0);
      eq(out, 'C_D for D+Lr', w.filter(function (c) { return c.tag === 'D+Lr'; })[0].CD, 1.25);
      eq(out, 'C_D for D+S', w.filter(function (c) { return c.tag === 'D+S'; })[0].CD, 1.15);
      eq(out, 'C_D for D+0.6W', w.filter(function (c) { return c.tag === 'D+0.6W'; })[0].CD, 1.6);
      eq(out, '0.6W applied to strength-level wind', w.filter(function (c) { return c.tag === 'D+0.6W'; })[0].f.W, 0.6);
      eq(out, '0.6D+0.6W present', w.filter(function (c) { return c.tag === '0.6D+0.6W'; }).length, 1);
      isTrue(out, 'Lr and S never appear in the same combination',
             w.every(function (c) { return c.skipped || !(c.f.Lr && c.f.S); }), 'ok');
      return out;
    } },
  { id: 'ENG-FC-GE-FCE1', src: 'spec §4 / H-17 — never zero the bending term', run: function () {
      var out = [];
      var r = eq393(1200, 800, 500, 2000, 1000);
      eq(out, 'f_c >= F_cE1 refuses', r.ok, false);
      has(out, 'cites §3.9.2', r.ref, '3.9.2');
      var ok = eq393(100, 800, 500, 2000, 1000);
      isTrue(out, 'bending term retained when applicable', ok.ok && ok.term2 > 0, String(ok.term2));
      return out;
    } }
];

function runFixtures() {
  var lines = [], pass = 0, total = 0;
  function record(id, src, items) {
    items.forEach(function (it) {
      total++; if (it[1]) pass++;
      lines.push((it[1] ? 'PASS ' : 'FAIL ') + id + (src ? ' [' + src + ']' : '') + ' ' + it[0] + '  ->  ' + it[2]);
    });
  }
  FIXTURE_DATA.forEach(function (F) {
    var runner = RUNNERS[F.id], items;
    if (!runner) { record(F.id, F.kind, [['no runner is wired for this fixture', false, F.id]]); return; }
    try { items = runner(F); }
    catch (err) { items = [['runner threw', false, String(err && err.stack ? err.stack.split('\n')[0] : err)]]; }
    record(F.id, F.kind, items);
  });
  ENGINE_FIXTURES.forEach(function (F) {
    var items;
    try { items = F.run(); }
    catch (err) { items = [['runner threw', false, String(err && err.stack ? err.stack.split('\n')[0] : err)]]; }
    record(F.id, F.src, items);
  });
  return { pass: pass, total: total, lines: lines };
}

// ════════════════════════════════════════════════════════════════════════════
var HDR = {
  ENGINE: ENGINE,
  NDS_REF: NDS_REF, CF_Fb: CF_Fb, CF_Fc: CF_Fc, LBR: LBR, SIZES: SIZES,
  WALL_SIZES: WALL_SIZES, PLIES_MAP: PLIES_MAP, CD: CD,
  PAGE_DEFAULTS: PAGE_DEFAULTS, LV_DEFAULTS: LV_DEFAULTS,
  HEADER_DEFAULTS: HEADER_DEFAULTS, STUD_DEFAULTS: STUD_DEFAULTS,
  ValidationError: ValidationError,
  uid: uid, normalize: normalize, validate: validate, compute: compute,
  snapshot: snapshot, hashInputs: hashInputs, rowLoads: rowLoads,
  combinations: combinations, calcCL: calcCL, calcCP: calcCP, eq393: eq393,
  leTable333: leTable333,
  checkHeader: checkHeader, checkJambPack: checkJambPack, designJambPack: designJambPack,
  checkKing: checkKing, checkStud: checkStud, minJambsForBearing: minJambsForBearing,
  FIXTURES: FIXTURE_DATA, ENGINE_FIXTURES: ENGINE_FIXTURES, runFixtures: runFixtures
};
root.HDR = HDR;
if (typeof module !== 'undefined' && module.exports) module.exports = HDR;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
