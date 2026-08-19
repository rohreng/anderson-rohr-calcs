/* =============================================================================
   Verification fixtures — Steel Channel Lintel at a New Opening in Masonry
   Run headless:  node public/Calcs/js/channel_lintel_fixtures.js
   Plan: PLAN-CHANNEL-LINTEL.md rev 12, Phase 11 fixtures A / B / C
   Re-pinned after cross-check round 1 fixes C1–C6 (PLAN-CHANNEL-LINTEL-REVIEW-LOG.md).

   PINNING RULE: every number asserted below is HAND-DERIVED in the comment that
   precedes it and only then confirmed against the engine. No pinned value was
   read off engine output.

   WHAT CHANGED UNDER C1–C6, and what the reader must NOT carry over from the
   pre-fix suite:
     · There is no longer a single "governing combination" applied to every check.
       Each check row is enveloped over all ten ASCE 7-22 combinations and carries
       its own `combo` field. On the reference case 1.4D governs the gravity-side
       checks (F2, shear, rod von Mises, masonry bearing, bond beam, jamb) while
       1.2D+1.0W+L+0.5Lr governs the wind-side ones (F6, H1-1b). `r.combo` is now
       only the combination driving the WORST factored check overall.
     · THE REFERENCE CASE NO LONGER PASSES. With the elastic-vector jamb model (C2)
       the fixture-default jamb_n = 4 group is at DCR 4.264 and the run returns
       pass === false. That is pinned below as intended behaviour, not tolerated as
       a known break: the old R/n jamb model was the defect.
     · Composite mode returns pass === null with every row informational (C4), so
       "composite passed" is not expressible.
   ============================================================================= */
'use strict';
var path = require('path'), fs = require('fs');
global.window = global;
// channel_db.js is a browser <script> file: eval it and hoist onto global so the
// engine's root.CHANNEL_DB lookup resolves the same way it does in the page.
(0, eval)(fs.readFileSync(path.join(__dirname, 'channel_db.js'), 'utf8'));
var ENG = require('./masonry_opening_channel_lintel_engine.js');

var pass = 0, fail = 0, lines = [];
function ok(name, cond, detail) {
  if (cond) { pass++; lines.push('  PASS  ' + name + (detail ? '   [' + detail + ']' : '')); }
  else { fail++; lines.push('  FAIL  ' + name + (detail ? '   [' + detail + ']' : '')); }
}
function near(name, got, want, tolPct, unit) {
  var d = Math.abs(got - want) / (Math.abs(want) || 1) * 100;
  ok(name, d <= tolPct, got.toFixed(4) + ' vs ' + want + (unit || '') + ' (' + d.toFixed(2) + '%)');
}
function hd(s) { lines.push(''); lines.push('== ' + s + ' ' + '='.repeat(Math.max(0, 68 - s.length))); }

// ── reference input: the Tedds LINTEL 1 job ────────────────────────────────
function refInput(over) {
  var b = {
    L_ft: 28, t_nom: 8, H_above: 16, H_total_ft: 28,
    section: 'MC18X42.7', Fy: 36, Fu_channel: 58,
    w_cmu: 70, q_D: 0, q_L: 0, q_Lr: 0, q_S: 0, trib_L: 0, trib_R: 0,
    pointLoads: [],
    p_psf: 30, h_trib_ft: 5,
    rows: 2, g_in: 12, s_in: 16, d_b: 0.75, rodGrade: 'A307',
    fm_psi: 1900, fm_basis: 'assumed', bondBeam: true,
    lbe_up_in: 0, lbe_dn_in: 0,
    gravitySplit: 0.5, windSplit: 0.5,
    jamb_n: 4, bb_As_in2: 0.40,
    staggered: true,
    compositeMode: false
  };
  for (var k in (over || {})) b[k] = over[k];
  return b;
}

// ═══════════════════════════════════════════════════════════════════════════
hd('S1 catalog integrity');
var secs = ENG.allSections();
ok('72 C + MC shapes present', secs.length === 72, secs.length + ' shapes');
var mc = ENG.section('MC18X42.7');
var anch = { A: 12.6, d: 18.0, tw: 0.45, xbar: 0.877, eo: 0.969, Ix: 554, Iy: 14.3, Sy: 4.64, J: 1.23, Cw: 852 };
var aok = true, adet = [];
for (var f in anch) if (Math.abs(mc[f] - anch[f]) > 1e-6) { aok = false; adet.push(f + '=' + mc[f]); }
ok('MC18X42.7 startup anchor (10 values)', aok, adet.join(' ') || 'exact');

// e_o datum: shear-centre formula referenced to back of web, all 72 shapes
var worst = 0, worstN = '';
secs.forEach(function (s) {
  var bp = s.bf - s.tw / 2, h = s.d - s.tf;
  var pred = 3 * s.tf * bp * bp / (6 * bp * s.tf + h * s.tw) - s.tw / 2;
  var err = Math.abs(pred - s.eo) / s.eo * 100;
  if (err > worst) { worst = err; worstN = s.label; }
});
ok('e_o datum verified across all 72 shapes (<1%)', worst < 1.0,
   'worst ' + worst.toFixed(2) + '% at ' + worstN);

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE A — Tedds reference reproduction (SPLIT per Phase 0 gate)');
lines.push('  Phase 0 could NOT reconcile the Tedds load assembly: M_u = 72.7 k-ft');
lines.push('  back-solves to w = 0.7418 klf, while 1.2*(1120/2 + 42.7) = 0.7235 klf (-2.5%).');
lines.push('  Best fit is Tedds\' own displayed member UDL 0.57 klf + self weight (-0.64%),');
lines.push('  so the residual lives in a Tedds input step not visible in the export.');
lines.push('  The fixture is therefore FORMALLY SPLIT, as the plan requires. No claim of');
lines.push('  "2% reference reproduction" may be made in the UI or the docs.');

// A1 — assert against Tedds' own member load path
var A1w = 1.2 * (0.570 + 13.0 * 490 / 144 / 1000);
near('A1  M_u from Tedds member UDL', A1w * 28 * 28 / 8, 72.7, 2.0, ' k-ft');

// A2 — our own assembly from first principles, delta documented not hidden.
// Compared on TEDDS' OWN combination (1.2D) and TEDDS' OWN bracing assumption
// (full lateral restraint, L_b = 0), so the comparison isolates load assembly.
var rA = ENG.run(refInput({ p_psf: 0, Lb_in: 0 }));
var w12 = 1.2 * rA.loads.wD, Mu12 = (w12 * 0.5) * 28 * 28 / 8;
// C1 note: `rA.combo` is now the combination driving the WORST factored check
// overall, not the one applied to every check. The A2 comparison is deliberately
// run at 1.2D — Tedds' own combination — so the printed w_u must be the 1.2D
// value, NOT rA.combo.wu. (Before C1 the two happened to coincide; they no
// longer do, and printing rA.combo.wu here would report 1.6876 klf against a
// moment computed from 1.2D.)
lines.push('  A0  NOTE: 1.4D at ' + (1.4 * rA.loads.wD).toFixed(4) + ' klf governs our gravity checks ' +
           '(F2 combo = ' + rA.checks.filter(function (x) { return x.name === 'Flexure, strong axis (gravity)'; })[0].combo + ').');
lines.push('      Tedds checked only 1.2D+1.6SL and so never ran 1.4D — an under-check in the reference.');
var MuKft = Mu12;
lines.push('  A2  our assembly at 1.2D: w_u = ' + w12.toFixed(4) + ' klf (pair), per channel ' +
           (w12 * 0.5).toFixed(4) + ' klf  ->  M_u = ' + MuKft.toFixed(2) + ' k-ft');
lines.push('      documented delta vs Tedds 72.7 k-ft = ' +
           ((MuKft / 72.7 - 1) * 100).toFixed(2) + '%  (NOT absorbed — this is the open gate)');
ok('A2  our 1.2D assembly is self-consistent and reported', MuKft > 60 && MuKft < 80, MuKft.toFixed(2) + ' k-ft');

// Tedds cross-checks that DO reproduce
var csA = rA.strength;
near('A3  phi*Mn,x at full restraint (Tedds 202.8 k-ft)', csA.phiMnx / 12, 202.8, 2.0, ' k-ft');
var rFull = ENG.run(refInput({ p_psf: 0 }));
lines.push('  A3b at the DEFAULT full-span L_b, phi*Mn,x drops to ' +
           (rFull.strength.phiMnx / 12).toFixed(1) + ' k-ft — a ' +
           (csA.phiMnx / rFull.strength.phiMnx).toFixed(1) + 'x penalty. Tedds assumed full');
lines.push('      lateral restraint and never showed the assumption. This calculator makes');
lines.push('      the engineer state L_b explicitly and warns when it is below the full span.');
near('A4  phi*Vn (Tedds 157.5 kip)', csA.phiVn, 157.5, 2.0, ' kip');

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 15a — DEFAULT-MODE ZERO ASSERTION (guards the shipping branch)');
// Reference fixture uses L_b = rod spacing, the bracing assumption the reference
// detail implies, stated explicitly rather than assumed silently.
var rD = ENG.run(refInput({ Lb_in: 16 }));
var c = rD.composite, cn = rD.connector;
ok('compositeMode reported false', rD.compositeMode === false, rD.mode);
ok('q  = 0 exactly', c.q === 0);
ok('N_ch = 0 exactly', c.N_ch === 0);
ok('V_x = 0 exactly', cn.V_x === 0);
ok('k   = 0 exactly', cn.k === 0);
ok('M_wind_rod = 0 exactly', cn.M_wind === 0);
ok('no grout-couple bearing demand', cn.f_g === 0);
ok('rod demand is gravity + T_w + dF only',
   cn.M_res === cn.M_grav && cn.V_res === cn.V_y,
   'M_res=' + cn.M_res.toFixed(4) + ' V_res=' + cn.V_res.toFixed(4));

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 15b — NON-COMPOSITE REFERENCE FIXTURE (pinned, post-envelope)');
function rowOf(r, nm) { return r.checks.filter(function (x) { return x.name === nm; })[0]; }
function dcrOf(r, nm) { var f = rowOf(r, nm); return f ? f.dcr : NaN; }
function comboOf(r, nm) { var f = rowOf(r, nm); return f ? f.combo : '(missing)'; }

/* HAND DERIVATION — reference case, MC18X42.7, t = 7.625, L = 28 ft = 336 in,
   s = 16 staggered, rows = 2, g = 12, 3/4" A307, f'm = 1900, w_cmu = 70,
   H_above = 16 ft, p = 30 psf over 5 ft trib, L_b = 16 in, 50/50 sharing.

   LOADS (pair)
     w_wall = 70 psf x 16 ft            = 1.1200 klf
     w_sw   = 2 x 42.7 plf              = 0.0854 klf
     w_D                                = 1.2054 klf
     w_W    = 30 psf x 5 ft             = 0.1500 klf

   SECTION (AISC v16)  A 12.6, d 18.0, t_w 0.45, x̄ 0.877, e_o 0.969,
     I_x 554, S_x 61.5, Z_x 75.1, I_y 14.3, S_y 4.64, Z_y 8.82, r_y 1.07

   ── 1.4D BRANCH (governs every gravity-side check) ────────────────────────
     w_u      = 1.4 x 1.2054                       = 1.68756 klf  (pair)
     w_u,ch   = 0.5 x 1.68756                      = 0.843780 klf
     L_b = 16 in < L_p = 53.45 in  ->  F2.1 yielding, M_n = M_p
     M_p      = 36 x 75.1                          = 2703.6 kip-in
     phi.M_n  = 0.90 x 2703.6                      = 2433.24 kip-in
     M_ux     = (0.843780/12) x 336^2 / 8
              = 0.0703150 x 14112                  = 992.285 kip-in (= 82.69 k-ft)
     F2 DCR   = 992.285 / 2433.24                  = 0.40780
     V_ux     = 0.0703150 x 336/2                  = 11.8129 kip
     phi.V_n  = 157.464  (fixture A4)
     V  DCR   = 11.8129 / 157.464                  = 0.07502

   ── ROD, at 1.4D (wind factor 0, so T_w = 0) ──────────────────────────────
     a_rod    = s / n_rows = 16/2                  = 8 in
     P_rod    = 1.68756 x 8/12                     = 1.125040 kip
     V_y      = P_rod / 2                          = 0.562520 kip
     L_g      = 7.625 + 0.45                       = 8.075 in ; L_c,grav = t = 7.625
     M_grav   = 0.562520 x (8.075/2 - 7.625/4)
              = 0.562520 x 2.13125                 = 1.198873 kip-in
     e        = e_o + t_w/2 = 0.969 + 0.225        = 1.194 in
     dF       = (0.843780/12) x 16 x 1.194 / 12    = 0.111941 kip
     N_rod    = T_w + dF = 0 + 0.111941            = 0.111941 kip
     A_b      = pi x 0.75^2 / 4                    = 0.4417865 in^2
     S_rod    = pi x 0.75^3 / 32                   = 0.0414175 in^3
     sigma    = 0.111941/0.4417865 + 1.198873/0.0414175
              = 0.25338 + 28.9460                  = 29.1994 ksi
     tau      = 4 x 0.562520 / (3 x 0.4417865)     = 1.69771 ksi
     vM       = sqrt(29.1994^2 + 3 x 1.69771^2)
              = sqrt(852.606 + 8.6467) = sqrt(861.253) = 29.3471 ksi
     allow    = 0.90 x 36                          = 32.40 ksi
     vM DCR   = 29.3471 / 32.40                    = 0.90577       <- was 0.783
     (cross-check: at 1.2D+1.0W, sigma 25.25 / tau 1.455 -> vM 25.380 -> 0.7833,
      which is exactly the stale pin. 1.4D beats it by 15.6%.)

   ── MASONRY BEARING ON ROD, at 1.4D ───────────────────────────────────────
     V_mas    = P_rod (V_x = 0 non-composite)      = 1.125040 kip
     A_br     = d_b x t = 0.75 x 7.625             = 5.71875 in^2
     phi.B_n  = 0.60 x 0.8 x 1.900 x 5.71875       = 5.215500 kip
     DCR      = 1.125040 / 5.215500                = 0.21571       <- was 0.185

   ── WIND SIDE, at 1.2D+1.0W+L+0.5Lr (a DIFFERENT combination) ─────────────
     w_W      = 1.0 x 0.150                        = 0.150 klf
     M_w      = (0.150/12) x 336^2 / 8             = 176.40 kip-in
     M_y,ch   = 0.50 x 176.40                      = 88.200 kip-in
     M_ny     = min(F_y Z_y, 1.6 F_y S_y)
              = min(36x8.82, 1.6x36x4.64)
              = min(317.52, 267.264)               = 267.264 kip-in
     phi.M_ny = 0.90 x 267.264                     = 240.538 kip-in
     F6 DCR   = 88.200 / 240.538                   = 0.36668
     w_u,ch   = 0.5 x 1.2 x 1.2054                 = 0.723240 klf
     M_ux     = (0.723240/12) x 14112              = 850.525 kip-in
     H1-1b    = 850.525/2433.24 + 0.36668
              = 0.34955 + 0.36668                  = 0.71623

   ── SERVICE (outside the factored envelope, unchanged by C1) ──────────────
     d_grav   = 5 x (1.2054/12) x 336^4 / (384 x 29000 x 2 x 554)
              = 6.40143e9 / 1.2338688e10           = 0.518809 in
     allow    = 336/600                            = 0.560 in  -> DCR 0.92645
     d_wind   = 5 x (0.42x0.150/12) x 336^4 / (384 x 29000 x 28.6)
              = 3.345695e8 / 3.184896e8            = 1.050489 in
     allow    = 336/240                            = 1.400 in  -> DCR 0.75035    */
near('F2 flexure DCR (1.4D)', dcrOf(rD, 'Flexure, strong axis (gravity)'), 0.4078, 0.1, '');
near('shear DCR (1.4D)', dcrOf(rD, 'Shear'), 0.0750, 0.2, '');
near('gravity deflection DCR (service D+L)', dcrOf(rD, 'Gravity, service D+L'), 0.9264, 0.1, '');
near('wind deflection DCR (service 0.42W)', dcrOf(rD, 'Wind, 0.42W'), 0.7503, 0.1, '');
near('wind flexure DCR (F6)', dcrOf(rD, 'Flexure, weak axis (wind)'), 0.3667, 0.1, '');
near('H1-1b interaction', dcrOf(rD, 'Combined biaxial interaction'), 0.7162, 0.1, '');
near('rod bending vM DCR', dcrOf(rD, 'Rod combined action (von Mises)'), 0.9058, 0.1, '');
near('grout bearing DCR', dcrOf(rD, 'Bearing on rod'), 0.2157, 0.1, '');

/* GOVERNING CHECK AND VERDICT — pinned as a FAILURE, by design.
   Jamb group, elastic vector, at 1.4D (R scales with w_u; the amplification
   factor is combination-independent, so 1.4D maximises this check too):
     R        = (1.68756/12) x 336/2               = 23.6258 kip  (pair)
     n_j = 4, x_1 = 4", p_j = 8"  ->  x_i = 4, 12, 20, 28
     x̄        = 16 in                              (= e_group)
     S(x_i-x̄)^2 = 144 + 16 + 16 + 144              = 320 in^2
     |x_max-x̄| = 12 in
     factor   = 1/4 + (16 x 12)/320 = 0.25 + 0.600 = 0.850
     V_j      = 0.850 x 23.6258                    = 20.0819 kip
     capacity = min(2 x phi.r_n, B_vn)
       2 x phi.r_n = 2 x 0.75 x 27 x 0.4417865     = 17.8924 kip
       B_vn = phi.B_vnc = 0.50 x 1750 x (1900 x 0.4417865)^0.25 / 1000
            = 0.875 x 839.394^0.25 = 0.875 x 5.38259 = 4.70977 kip  (governs)
     DCR      = 20.0819 / 4.70977                  = 4.26389  ->  FAIL           */
near('governing DCR (jamb group, 1.4D)', rD.governing.dcr, 4.2639, 0.1, '');
ok('governing check is the JAMB BOLT GROUP, not deflection',
   rD.governing.name === 'Bolt group, vertical reaction (elastic vector)', rD.governing.name);
ok('reference case now FAILS (pass === false, not true and not null)',
   rD.pass === false, 'pass = ' + rD.pass);
ok('overall governing combination is 1.4D', rD.combo.label === '1.4D', rD.combo.label);
lines.push('  governing check: ' + rD.governing.name + ' at DCR ' + rD.governing.dcr.toFixed(3) +
           '   verdict: ' + (rD.pass ? 'PASS' : 'FAIL'));
lines.push('  overall governing combination: ' + rD.combo.label + '   sharing: 50/50');
lines.push('  NOT a regression: the fixture default jamb_n = 4 is understrength under the');
lines.push('  C2 elastic-vector jamb model. The pre-C2 R/n model reported 1.075 here and the');
lines.push('  pre-C1 single-combo run reported it at 1.2D+1.0W. Both were wrong.');

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C — derived-quantity assertions');
var z = rD.composite.z_ch, Ic = rD.composite.I_comp;
near('z_ch = t/2 + xbar', z, 4.690, 0.1, ' in');
near('I_comp', Ic, 582.8, 0.5, ' in^4');
near('I_comp / 2Iy ratio', rD.deflection.ratio, 20.4, 1, 'x');
near('slip lever 2(xbar - tw/2)', rD.composite.slipLever, 1.304, 0.5, ' in');
near('shear-centre e = eo + tw/2', cn.e_sc, 1.194, 0.5, ' in');
near('dF*g = w_ch*s*e  (torsion statics)', cn.dF * 12, (rD.combo.wu * 0.5 / 12) * 16 * cn.e_sc, 0.01, '');

// composite decomposition closes: 2*N*z + 2*My = M_w
var rC = ENG.run(refInput({ compositeMode: true }));
var cc = rC.composite;
near('decomposition closure 2*N*z + 2*My = M_w',
     2 * cc.N_ch * cc.z_ch + 2 * cc.My_ch, rC.demands.M_w_total, 0.001, ' kip-in');
ok('composite mode cannot pass (no verdict on informational rows)',
   rC.checks.some(function (x) { return x.informational === true && x.pass === null; }),
   rC.mode);

// rod-on-grout closed form bounds
hd('FIXTURE C — rod-on-grout closed form (composite branch)');
var t8 = 7.625, twx = 0.45, Lg = t8 + twx, Vx = 1.704;
function Mrod(Lu, cap) {
  var Lc = cap ? Math.min(t8, Lg - 2 * Lu) : (Lg - 2 * Lu);
  var ss = Lc * Lc / (4 * Lg);
  return Vx * (Lu + ss / 2);
}
// MATHEMATICAL bound (uncapped) — verifies the closed form only.
near('math bound L_u=0 -> V_x*L_g/8', Mrod(0, false), Vx * Lg / 8, 0.5, ' kip-in');
near('math bound L_u=L_g/2 -> V_x*L_g/2', Mrod(Lg / 2, false), Vx * Lg / 2, 0.5, ' kip-in');
// PHYSICAL bound — grout exists only across t, so L_c <= t and L_u >= t_w/2.
near('physical bound L_u = t_w/2', Mrod(twx / 2, true), 1.917, 1.5, ' kip-in');
ok('L_c capped at t (grout does not exist through the webs)',
   Math.abs(Math.min(t8, Lg - 2 * (twx / 2)) - t8) < 1e-9);

// monotonicity / degenerate
hd('FIXTURE C — monotonicity and degenerate cases');
var rZeroWind = ENG.run(refInput({ p_psf: 0 }));
ok('p = 0 -> weak-axis wind demand vanishes', rZeroWind.demands.My_ch === 0);
ok('q -> 0 as V_w -> 0', ENG.run(refInput({ p_psf: 0, compositeMode: true })).composite.q === 0);

var t12 = ENG.run(refInput({ t_nom: 12 })), t8r = rD;
var cr8 = t8r.checks.filter(function (x) { return x.name === 'Crushing at rod'; })[0];
var cr12 = t12.checks.filter(function (x) { return x.name === 'Crushing at rod'; })[0];
ok('Eq. 9-5 crushing is FLAT in wall thickness (locks correction #4)',
   Math.abs(cr8.capacity - cr12.capacity) < 1e-9,
   cr8.capacity.toFixed(4) + ' vs ' + cr12.capacity.toFixed(4) + ' kip');
var br8 = t8r.checks.filter(function (x) { return x.name === 'Bearing on rod'; })[0];
var br12 = t12.checks.filter(function (x) { return x.name === 'Bearing on rod'; })[0];
ok('TMS 9.1.8 bearing DOES scale with t (the over-credit being guarded)',
   br12.capacity > br8.capacity * 1.4,
   br8.capacity.toFixed(3) + ' -> ' + br12.capacity.toFixed(3) + ' kip');

// breakout scaling on an uncapped isolated geometry
var b1 = ENG.run(refInput({ lbe_dn_in: 4 })), b2 = ENG.run(refInput({ lbe_dn_in: 8 }));
function cap(r, n) { var x = r.checks.filter(function (q) { return q.name === n; })[0]; return x ? x.capacity : NaN; }
near('doubling l_be quadruples Eq. 9-4 (uncapped isolated)',
     cap(b2, 'Shear breakout at rod') / cap(b1, 'Shear breakout at rod'), 4.0, 0.5, 'x');

// row-count scaling
var r2 = ENG.run(refInput({ compositeMode: true }));
var r4 = ENG.run(refInput({ compositeMode: true, rows: 4 }));
near('doubling rows halves per-rod V_x', r4.connector.V_x, r2.connector.V_x / 2, 0.5, ' kip');

// Eq 9-8 unity point
var u = Math.pow(0.6597, 5 / 3) * 2;
near('Eq. 9-8 unity point (0.6597 each -> 1.000)', u, 1.0, 0.5, '');

// spacing relief
hd('FIXTURE C 15c — connector governance (spacing vs diameter vs grade)');
var s8 = ENG.run(refInput({ s_in: 8 }));
lines.push('  s=16 rod vM DCR ' + dcrOf(rD, 'Rod combined action (von Mises)').toFixed(3) +
           '   s=8 rod vM DCR ' + dcrOf(s8, 'Rod combined action (von Mises)').toFixed(3));
ok('halving spacing reduces rod bending DCR',
   dcrOf(s8, 'Rod combined action (von Mises)') < dcrOf(rD, 'Rod combined action (von Mises)'));
var d125 = ENG.run(refInput({ d_b: 1.25 }));
ok('larger diameter reduces rod vM DCR (diameter IS a lever)',
   dcrOf(d125, 'Rod combined action (von Mises)') < dcrOf(rD, 'Rod combined action (von Mises)'));

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 16 — STAGGERED rod layout');
var stg = ENG.run(refInput({ Lb_in: 16, staggered: true }));
var inl = ENG.run(refInput({ Lb_in: 16, staggered: false }));
near('staggered rod pitch = s/rows', stg.layout.pitch, 8.0, 0.01, ' in');
near('staggered offset between rows', stg.layout.offset, 8.0, 0.01, ' in');
ok('pitch matches the 8" CMU cell module - a rod in every cell',
   Math.abs(stg.layout.pitch - stg.layout.cell) < 1e-9,
   'pitch ' + stg.layout.pitch + '" vs cell ' + stg.layout.cell + '"');
near('in-line pitch = s', inl.layout.pitch, 16.0, 0.01, ' in');
near('P_rod IDENTICAL staggered vs in-line', stg.connector.P_rod, inl.connector.P_rod, 0.01, ' kip');
near('torsion couple dF IDENTICAL staggered vs in-line', stg.connector.dF, inl.connector.dF, 0.01, ' kip');
var bbS = stg.checks.filter(function (x) { return x.name === 'Flexure between rod columns'; })[0];
var bbI = inl.checks.filter(function (x) { return x.name === 'Flexure between rod columns'; })[0];
near('staggering quarters the bond-beam demand', bbI.demand / bbS.demand, 4.0, 0.5, 'x');
ok('in-line layout raises a warning', inl.warnings.some(function (w) { return /IN-LINE/.test(w); }));
ok('staggered layout raises no stagger warning',
   !stg.warnings.some(function (w) { return /IN-LINE|will not land/.test(w); }));

hd('FIXTURE C 17 — ARE calc standard: demand + allowable algebra on every check');
ok('load accumulation recorded', stg.loadAccum && stg.loadAccum.length > 12,
   (stg.loadAccum || []).length + ' lines');
ok('layout derivation recorded', stg.layoutSteps && stg.layoutSteps.length >= 4,
   (stg.layoutSteps || []).length + ' lines');
var noSteps = stg.checks.filter(function (c) { return !c.steps || !c.steps.length; });
ok('every check carries algebra steps', noSteps.length === 0,
   noSteps.length ? noSteps.map(function (c) { return c.name; }).join('; ')
                  : 'all ' + stg.checks.length + ' checks');
var noDem = stg.checks.filter(function (c) {
  return !c.steps.some(function (l) { return l.kind === 'eq' && l.label.indexOf('DEMAND') >= 0; }); });
ok('every check states a DEMAND line', noDem.length === 0,
   noDem.map(function (c) { return c.name; }).join('; ') || 'ok');
var noAll = stg.checks.filter(function (c) {
  return !c.steps.some(function (l) { return l.kind === 'eq' && l.label.indexOf('ALLOWABLE') >= 0; }); });
ok('every check states an ALLOWABLE line', noAll.length === 0,
   noAll.map(function (c) { return c.name; }).join('; ') || 'ok');
ok('all 10 ASCE 7-22 combinations tabulated', stg.comboRows.length === 10, stg.comboRows.length + '');
var symOK = stg.loadAccum.filter(function (l) { return l.kind === 'eq' && l.sym; }).length;
ok('load accumulation is algebra-style (symbol + substitution + result)', symOK >= 10, symOK + ' equations');

// staged slip
hd('FIXTURE C 14 — staged slip');
var stdHole = ENG.run(refInput({ compositeMode: true, c_h_in: 0.0625 }));
near('w_slip at standard 1/16" hole', stdHole.composite.w_slip, 0.302, 3, ' klf');
ok('standard holes do NOT engage at 30 psf', stdHole.composite.engaged === false,
   'w_slip ' + stdHole.composite.w_slip.toFixed(3) + ' vs w_w ' + stdHole.loads.wW.toFixed(3));
var reamed = ENG.run(refInput({ compositeMode: true, c_h_in: 0.03125 }));
ok('reamed 1/32" ALSO does not engage (the rev-8 detail failed here)',
   reamed.composite.engaged === false,
   'w_slip ' + reamed.composite.w_slip.toFixed(3));
var welded = ENG.run(refInput({ compositeMode: true, weldedConnector: true }));
ok('qualified weld has w_slip = 0, no staged term', welded.composite.w_slip === 0);

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 18 — C1 LOAD-COMBINATION ENVELOPE (per-check, not per-run)');
/* The pre-C1 engine scored the ten combinations ONCE with a heuristic and
   evaluated every check at that single winner. With any nonzero wind, 1.2D+1.0W
   beat 1.4D, so 1.4D — which governs gravity — never reached a strength check.
   The signature of a true per-check envelope is therefore that TWO CHECKS IN THE
   SAME RUN REPORT DIFFERENT GOVERNING COMBINATIONS. A single-combo engine cannot
   produce that, whatever its heuristic.

   HAND DERIVATION, reference case (full arithmetic in the 15b block above):

     F2 strong-axis flexure — demand M_ux = 0.5 w_u L^2/8, no wind term, so the
     DCR is monotone in w_u and the largest w_u wins outright:
       1.4D                 w_u = 1.4  x 1.2054 = 1.68756 klf   <- max
       1.2D+1.6L+0.5Lr      w_u = 1.2  x 1.2054 = 1.44648 klf   (w_L = w_Lr = 0)
       1.2D+1.0W+L+0.5Lr    w_u = 1.2  x 1.2054 = 1.44648 klf
       0.9D+/-1.0W          w_u = 0.9  x 1.2054 = 1.08486 klf
     -> F2 governs at 1.4D:  M_ux = (0.843780/12) x 336^2/8 = 992.285 kip-in
                             DCR  = 992.285 / 2433.24        = 0.40780

     F6 weak-axis flexure — demand M_y,ch = alpha_wind x |f_W| w_W L^2/8 depends
     ONLY on the wind factor, which is zero for 1.4D and every gravity-only
     combination. Any |f_W| = 1.0 combination gives the same maximum; the engine
     keeps the first one reached, 1.2D+1.0W+L+0.5Lr:
       M_y,ch = 0.50 x (0.150/12) x 336^2/8 = 88.200 kip-in
       DCR    = 88.200 / 240.538            = 0.36668
     At 1.4D the F6 DCR is identically 0, so a run that reported F6 at 1.4D would
     be declaring the weak-axis check satisfied by not loading it.                */
var f2Row = rowOf(rD, 'Flexure, strong axis (gravity)');
var f6Row = rowOf(rD, 'Flexure, weak axis (wind)');
ok('F2 governing combination is 1.4D', f2Row.combo === '1.4D', f2Row.combo);
near('F2 DCR at its own governing combination', f2Row.dcr, 0.4078, 0.1, '');
ok('F6 governing combination is a WIND combination',
   /W/.test(f6Row.combo) && f6Row.combo !== '1.4D', f6Row.combo);
near('F6 DCR at its own governing combination', f6Row.dcr, 0.3667, 0.1, '');
ok('F2 and F6 are governed by DIFFERENT combinations (impossible pre-C1)',
   f2Row.combo !== f6Row.combo, f2Row.combo + '  vs  ' + f6Row.combo);
ok('every factored check carries a non-empty combo field',
   rD.checks.filter(function (x) { return !x.combo; }).length === 0,
   rD.checks.filter(function (x) { return !x.combo; }).map(function (x) { return x.name; }).join('; ') || 'all 16');
// Service rows are stamped with their service basis, not a factored combination.
ok('service deflection rows are stamped service, not factored',
   rowOf(rD, 'Gravity, service D+L').combo === 'service D+L' &&
   rowOf(rD, 'Wind, 0.42W').combo === 'service 0.42W');
// A reported DCR must equal that check's maximum over all ten, so no factored
// row may be lower than its value at any single combination. Cross-check the
// gravity-side rows against a run in which wind is switched off entirely: with
// p = 0 the wind combinations collapse onto 1.2D and 0.9D, both below 1.4D, so
// the gravity-side DCRs must be UNCHANGED. If any check were still pinned to a
// single run-level combination, killing the wind would move them.
var rNoWind = ENG.run(refInput({ Lb_in: 16, p_psf: 0 }));
near('F2 DCR unchanged when wind is removed (already enveloped at 1.4D)',
     dcrOf(rNoWind, 'Flexure, strong axis (gravity)'), 0.4078, 0.1, '');
near('rod vM DCR unchanged when wind is removed', dcrOf(rNoWind, 'Rod combined action (von Mises)'), 0.9058, 0.1, '');
ok('F6 DCR does collapse to zero without wind', dcrOf(rNoWind, 'Flexure, weak axis (wind)') === 0);
lines.push('  F2 -> ' + f2Row.combo + ' at DCR ' + f2Row.dcr.toFixed(4) +
           '     F6 -> ' + f6Row.combo + ' at DCR ' + f6Row.dcr.toFixed(4));

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 19 — C2 JAMB BOLT GROUP, ELASTIC VECTOR METHOD');
/* The bolts sit on a line running into the pier, x_i = a + (i-1)p measured from
   the opening face; the channel reaction R is delivered in the web plane at
   x = 0. The group therefore carries R plus R.e_group about its own centroid,
   e_group = x-bar. Extreme-bolt force, both components vertical and collinear:

     V_j = R/n + R.e_group.|x_max - x-bar| / SUM(x_i - x-bar)^2 = k(n,a,p).R

   CLOSED FORM (derived once, used for every case below). With
   x-bar = a + p(n-1)/2, |x_max - x-bar| = p(n-1)/2 and
   SUM(x_i - x-bar)^2 = p^2.n(n^2-1)/12:

     k = 1/n + [a + p(n-1)/2].[p(n-1)/2] . 12/(p^2 n(n^2-1))
       = 1/n + 6a/(p.n(n+1)) + 3(n-1)/(n(n+1))

   Two consequences the R/n model cannot express, both asserted below:
     (i)  k depends on a and p ONLY through the RATIO a/p. Scaling the whole
          group uniformly leaves the extreme-bolt force unchanged.
     (ii) k falls as a/p falls. Moving the first bolt toward the opening face
          shortens e_group relative to the group's polar resistance.
   NOTE: the intuition "shrink the group and the demand drops" is FALSE as
   stated — halving a and p together changes nothing (i), and halving p ALONE
   raises k to 1.000 because e_group shrinks slower than the polar term. Only the
   edge distance is a one-way lever. Pinned here so the wrong intuition cannot be
   re-introduced.

   ── n = 4, a = 4, p = 8 (fixture default) ────────────────────────────────
     x_i          = 4, 12, 20, 28              x-bar = 16 in
     SUM d^2      = 144+16+16+144              = 320 in^2      |x_max-x-bar| = 12
     k            = 0.25 + (16x12)/320         = 0.25 + 0.600  = 0.850
     R (1.4D)     = (1.68756/12) x 336/2       = 23.6258 kip
     V_j          = 0.850 x 23.6258            = 20.0819 kip
     R/n would be 23.6258/4 = 5.9065 kip — the elastic vector is 3.40x that.

   ── n = 5, a = 4, p = 8 ──────────────────────────────────────────────────
     x_i          = 4, 12, 20, 28, 36          x-bar = 20 in
     SUM d^2      = 256+64+0+64+256            = 640 in^2      |x_max-x-bar| = 16
     k            = 0.20 + (20x16)/640         = 0.20 + 0.500  = 0.700
     V_j          = 0.700 x 23.6258            = 16.5381 kip
     Adding a 5th bolt cuts the force by only 17.6%, not the 20% of R/n, because
     the line got longer: closed form gives k(5)/k(4) = 0.700/0.850 = 0.8235.

   ── capacity and DCR (capacity is combination- and layout-independent) ────
     cap    = min(2 x 0.75 x 27 x 0.4417865, 0.50x1750x(1900x0.4417865)^0.25/1000)
            = min(17.8924, 4.70977)            = 4.70977 kip  (Eq. 9-5 crushing)
     n = 4  DCR = 20.0819 / 4.70977            = 4.26389   FAIL
     n = 5  DCR = 16.5381 / 4.70977            = 3.51144   FAIL

   ── edge-distance lever, n = 4, a = 2, p = 8 ─────────────────────────────
     x_i = 2, 10, 18, 26   x-bar = 14   SUM d^2 = 320   |x_max-x-bar| = 12
     k   = 0.25 + (14x12)/320 = 0.25 + 0.525   = 0.775   (was 0.850)
     check against the closed form: 0.25 + 6(2)/(8x4x5) + 3(3)/(4x5)
                                  = 0.25 + 0.075 + 0.450 = 0.775  OK
     DCR = 0.775 x 23.6258 / 4.70977           = 3.88766

   ── uniform-scaling invariance, n = 4, a = 2, p = 4 (a/p unchanged at 1/2) ─
     x_i = 2, 6, 10, 14    x-bar = 8    SUM d^2 = 80    |x_max-x-bar| = 6
     k   = 0.25 + (8x6)/80 = 0.25 + 0.600      = 0.850  — identical to a=4,p=8

   ── pitch alone is NOT a lever, n = 4, a = 4, p = 4 ───────────────────────
     x_i = 4, 8, 12, 16    x-bar = 10   SUM d^2 = 80    |x_max-x-bar| = 6
     k   = 0.25 + (10x6)/80 = 0.25 + 0.750     = 1.000  — WORSE than 0.850      */
var j4 = ENG.run(refInput({ Lb_in: 16, jamb_n: 4 }));
var j5 = ENG.run(refInput({ Lb_in: 16, jamb_n: 5 }));
near('n = 4 amplification factor k', j4.jamb.factor, 0.850, 0.01, '');
near('n = 5 amplification factor k', j5.jamb.factor, 0.700, 0.01, '');
near('n = 4 extreme-bolt force V_j', j4.jamb.Vj, 20.0819, 0.05, ' kip');
near('n = 5 extreme-bolt force V_j', j5.jamb.Vj, 16.5381, 0.05, ' kip');
near('end reaction R at 1.4D', j4.jamb.R, 23.6258, 0.05, ' kip');
near('jamb capacity = Eq. 9-5 crushing', j4.jamb.capacity, 4.70977, 0.05, ' kip');
near('n = 4 jamb DCR', dcrOf(j4, 'Bolt group, vertical reaction (elastic vector)'), 4.2639, 0.05, '');
near('n = 5 jamb DCR', dcrOf(j5, 'Bolt group, vertical reaction (elastic vector)'), 3.5114, 0.05, '');
ok('the fifth bolt buys only 17.6%, not the 20% of R/n',
   Math.abs(j5.jamb.factor / j4.jamb.factor - 0.700 / 0.850) < 1e-9,
   'k5/k4 = ' + (j5.jamb.factor / j4.jamb.factor).toFixed(4));
near('elastic vector is 3.40x the naive R/n at n = 4', j4.jamb.Vj / j4.jamb.Vj_avg, 3.400, 0.05, 'x');
// jamb is enveloped like everything else: R scales with w_u and k is constant,
// so 1.4D must govern this check too.
ok('jamb check governs at 1.4D', comboOf(j4, 'Bolt group, vertical reaction (elastic vector)') === '1.4D',
   comboOf(j4, 'Bolt group, vertical reaction (elastic vector)'));
// (ii) edge distance is a one-way lever — DCR drops when the first bolt moves in.
var jEdge2 = ENG.run(refInput({ Lb_in: 16, jamb_edge_in: 2 }));
near('a = 2, p = 8 amplification factor k', jEdge2.jamb.factor, 0.775, 0.01, '');
near('a = 2, p = 8 jamb DCR', dcrOf(jEdge2, 'Bolt group, vertical reaction (elastic vector)'), 3.88766, 0.05, '');
ok('shrinking the edge distance LOWERS the jamb DCR',
   dcrOf(jEdge2, 'Bolt group, vertical reaction (elastic vector)') <
   dcrOf(j4, 'Bolt group, vertical reaction (elastic vector)'),
   '3.888 < 4.264');
// (i) uniform scaling of the whole group is a no-op.
var jHalf = ENG.run(refInput({ Lb_in: 16, jamb_edge_in: 2, jamb_pitch_in: 4 }));
near('halving BOTH a and p leaves k unchanged (a/p invariant)', jHalf.jamb.factor, 0.850, 0.01, '');
near('  and leaves the DCR unchanged', dcrOf(jHalf, 'Bolt group, vertical reaction (elastic vector)'), 4.2639, 0.05, '');
// pitch alone runs the wrong way — pinned so it is not "optimised" by mistake.
var jPitch4 = ENG.run(refInput({ Lb_in: 16, jamb_pitch_in: 4 }));
near('a = 4, p = 4 amplification factor k (WORSE, not better)', jPitch4.jamb.factor, 1.000, 0.01, '');
ok('shrinking the pitch ALONE raises the jamb DCR',
   dcrOf(jPitch4, 'Bolt group, vertical reaction (elastic vector)') >
   dcrOf(j4, 'Bolt group, vertical reaction (elastic vector)'),
   jPitch4.jamb.factor.toFixed(3) + ' vs ' + j4.jamb.factor.toFixed(3));
// closed form k = 1/n + 6a/(p.n(n+1)) + 3(n-1)/(n(n+1)) reproduced across the grid
var kBad = [];
[[4, 4, 8], [5, 4, 8], [4, 2, 8], [4, 2, 4], [4, 4, 4], [6, 4, 8], [8, 3, 12], [12, 6, 8]]
  .forEach(function (cse) {
    var N = cse[0], a = cse[1], p = cse[2];
    var kHand = 1 / N + 6 * a / (p * N * (N + 1)) + 3 * (N - 1) / (N * (N + 1));
    var kEng = ENG.run(refInput({ Lb_in: 16, jamb_n: N, jamb_edge_in: a, jamb_pitch_in: p })).jamb.factor;
    if (Math.abs(kEng - kHand) > 1e-9) kBad.push('n=' + N + ',a=' + a + ',p=' + p +
      ' hand ' + kHand.toFixed(6) + ' eng ' + kEng.toFixed(6));
  });
ok('closed form k = 1/n + 6a/(p n(n+1)) + 3(n-1)/(n(n+1)) matches on 8 layouts',
   kBad.length === 0, kBad.join(' | ') || 'all 8 exact');

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 20 — C4 COMPOSITE GATE (no verdict is expressible)');
/* Composite mode models a connection this calculator does not design. Before C4
   the top-level `pass` was computed with no compositeMode gate, and a run with
   {compositeMode:true, p_psf:5, s_in:8, d_b:1.25, jamb_n:12} returned pass:true
   while `mode` said "cannot pass". No arithmetic is pinned here — the assertion
   is a STRUCTURAL one: pass must be null (never true, and never false either,
   because a false verdict is still a verdict), and every row must be
   informational with pass === null so no per-row green badge can render.        */
var gate = ENG.run(refInput({ compositeMode: true }));
ok('composite: r.pass is null (strictly — not true, not false)',
   gate.pass === null, 'pass = ' + JSON.stringify(gate.pass));
ok('composite: r.pass !== true', gate.pass !== true);
var notInfo = gate.checks.filter(function (x) { return x.informational !== true; });
ok('composite: EVERY check row is informational === true', notInfo.length === 0,
   notInfo.map(function (x) { return x.name; }).join('; ') || 'all ' + gate.checks.length + ' rows');
var notNull = gate.checks.filter(function (x) { return x.pass !== null; });
ok('composite: EVERY check row carries pass === null', notNull.length === 0,
   notNull.map(function (x) { return x.name; }).join('; ') || 'all ' + gate.checks.length + ' rows');
ok('composite: mode string says it cannot pass', /cannot pass/.test(gate.mode), gate.mode);
// The exact counterexample from the review log, re-run: it must no longer pass.
var gate2 = ENG.run(refInput({ compositeMode: true, p_psf: 5, s_in: 8, d_b: 1.25, jamb_n: 12 }));
ok('review-log counterexample {p=5, s=8, d_b=1.25, jamb_n=12} no longer returns pass:true',
   gate2.pass === null, 'pass = ' + JSON.stringify(gate2.pass));
ok('  and every one of its rows is informational',
   gate2.checks.every(function (x) { return x.informational === true && x.pass === null; }),
   gate2.checks.length + ' rows');
// The non-composite branch must still deliver a real boolean verdict.
ok('non-composite still returns a boolean verdict (the gate is not blanket)',
   typeof rD.pass === 'boolean', 'pass = ' + rD.pass);

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 21 — C3 C_b BRANCH (1.0 on an engineer-specified L_b)');
/* C_b = 1.14 is the simple-span UDL value and is only defensible when L_b IS the
   full span. When the engineer names a shorter L_b the governing interior segment
   sits near the peak of the moment diagram and approaches UNIFORM moment, for
   which C_b = 1.0. The hardcoded 1.14 was 14.0% unconservative wherever the
   inelastic-LTB branch was not M_p-capped.

   HAND DERIVATION — MC18X42.7, F_y = 36, L_b = 120 in (between L_p and L_r):

     M_p    = 36 x 75.1                                    = 2703.6 kip-in
     h_o    = 18 - 0.625                                   = 17.375 in
     c      = (17.375/2).sqrt(14.3/852) = 8.6875 x 0.1295532 = 1.125444
     r_ts   = sqrt(sqrt(14.3x852)/61.5) = sqrt(110.3793/61.5)
            = sqrt(1.794785)                               = 1.339696 in
     L_p    = 1.76 x 1.07 x sqrt(29000/36)
            = 1.8832 x 28.382311                           = 53.4496 in
     term   = J.c/(S_x.h_o) = 1.23x1.125444/(61.5x17.375)
            = 1.384296 / 1068.5625                         = 0.00129544
     L_r    = 1.95 x 1.339696 x (29000/25.2)
              x sqrt(0.00129544 + sqrt(0.00129544^2 + 6.76x(25.2/29000)^2))
            = 2.6124072 x 1150.79365 x sqrt(0.00389979)
            = 3006.342 x 0.0624483                         = 187.741 in
     L_p = 53.45 < L_b = 120 < L_r = 187.74  ->  F2-2 inelastic LTB.

     AISC Eq. F2-2, C_b OUTSIDE the bracket; the channel c factor enters only
     through L_r and L_p:
       M_n = C_b.[M_p - (M_p - 0.7 F_y S_x)(L_b - L_p)/(L_r - L_p)]  <=  M_p
       0.7 F_y S_x     = 0.7 x 36 x 61.5                   = 1549.8 kip-in
       M_p - 0.7F_yS_x = 2703.6 - 1549.8                   = 1153.8 kip-in
       (L_b-L_p)/(L_r-L_p) = (120-53.4496)/(187.741-53.4496)
                           = 66.5504 / 134.2913            = 0.495567
       bracket = 2703.6 - 1153.8 x 0.495567 = 2703.6 - 571.786 = 2131.81 kip-in

     C_b = 1.00 ->  M_n = 1.00 x 2131.81 = 2131.81 kip-in  (< M_p, not capped)
                    phi.M_n = 0.90 x 2131.81               = 1918.63 kip-in
                                                           = 159.89 kip-ft
     C_b = 1.14 ->  M_n = 1.14 x 2131.81 = 2430.26 kip-in  (< M_p 2703.6, so the
                    M_p cap does NOT hide the error) -> phi.M_n = 2187.24 kip-in
     The stale branch would have credited 2430.26/2131.81 = 1.140, i.e. 14.0%
     more capacity than the uniform-moment segment can carry.                    */
var rCb = ENG.run(refInput({ Lb_in: 120 }));
var csCb = rCb.strength;
near('L_p (hand 53.4496 in)', csCb.Lp, 53.4496, 0.05, ' in');
near('L_r (hand 187.741 in)', csCb.Lr, 187.741, 0.1, ' in');
ok('L_b = 120 sits strictly inside L_p .. L_r (inelastic LTB branch)',
   csCb.Lp < 120 && 120 < csCb.Lr && /inelastic/.test(csCb.mode), csCb.mode);
ok('C_b = 1.0 on an engineer-specified L_b below the full span', rCb.Cb === 1.0, 'C_b = ' + rCb.Cb);
near('M_n at C_b = 1.0 (hand 2131.81 kip-in)', csCb.Mn, 2131.81, 0.1, ' kip-in');
near('phi.M_n at C_b = 1.0 (hand 1918.63 kip-in)', csCb.phiMnx, 1918.63, 0.1, ' kip-in');
ok('M_n is NOT the C_b = 1.14 value 2430.26 (and is not M_p-capped either)',
   Math.abs(csCb.Mn - 2430.26) > 200 && csCb.Mn < csCb.Mp - 1,
   csCb.Mn.toFixed(1) + ' vs 2430.3 (1.14) and M_p ' + csCb.Mp.toFixed(1));
// 1.14 x the returned M_n must land on the hand-derived stale value 2430.26,
// which is what confirms the ONLY difference between the branches is C_b — the
// bracket itself is unchanged, so the stale branch was 14.0% high, full stop.
near('1.14 x M_n reproduces the stale 2430.26 (so C_b is the only difference)',
     1.14 * csCb.Mn, 2430.26, 0.1, ' kip-in');
// The 1.14 branch must survive where it IS defensible: L_b = the full span.
var rCbFull = ENG.run(refInput({}));                    // no Lb_in -> full span default
var rCbEq = ENG.run(refInput({ Lb_in: 28 * 12 }));      // L_b stated AS the full span
ok('C_b = 1.14 at the full-span default', rCbFull.Cb === 1.14, 'C_b = ' + rCbFull.Cb);
ok('C_b = 1.14 when L_b is stated equal to the full span', rCbEq.Cb === 1.14, 'C_b = ' + rCbEq.Cb);
// And the reference case (L_b = 16 < L_p) is on the plastic branch, so C3 cannot
// have moved it: M_n = M_p either way.
near('reference L_b = 16 unaffected by C3 (M_n = M_p = 2703.6)', rD.strength.Mn, 2703.6, 0.05, ' kip-in');

// ═══════════════════════════════════════════════════════════════════════════
hd('FIXTURE C 22 — C6 f_u CAP ON TMS Eq. 9-7 STEEL SHEAR');
/* TMS 402-22 9.1.6.3.2 applies f_u <= min(1.9 f_y, 125 ksi) to the SHEAR
   equations as well as to Eq. 9-2 tension. The pre-C6 engine used the raw grade
   F_u in Eq. 9-7 only. Inert for the three built-in grades; it bites the moment
   an engineer enters a low custom rod f_y.

   HAND DERIVATION — 3/4" rod, A_b = pi x 0.75^2/4 = 0.4417865 in^2.

     DEFAULT A307 (F_y 36, F_u 60):
       f_u,eff  = min(60, 1.9x36 = 68.4, 125)             = 60 ksi  (cap inert)
       phi.B_vns = 0.65 x 0.6 x 0.4417865 x 60            = 10.3378 kip
       phi.B_vnc = 0.50 x 1750 x (1900x0.4417865)^0.25/1000
                 = 0.875 x 839.394^0.25 = 0.875 x 5.38259 = 4.70977 kip
       B_vn = min(9-4 = inf, 9-5 = 4.70977, 9-7 = 10.3378) = 4.70977 kip
       -> masonry crushing governs; the steel term is nowhere near.

     CUSTOM rodFy = 10 ksi (same A307 grade F_u = 60):
       f_u,eff  = min(60, 1.9x10 = 19, 125)               = 19 ksi   <- CAP BITES
       phi.B_vns = 0.65 x 0.6 x 0.4417865 x 19
                 = 0.39 x 8.3939435                       = 3.27364 kip
       uncapped it would have been 10.3378 kip — a 3.16x over-credit
       B_vn = min(inf, 4.70977, 3.27364)                  = 3.27364 kip
       -> Eq. 9-7 steel shear now GOVERNS B_vn, which is the whole point: the cap
          has to be able to change the answer, not just be present.
       Eq. 9-2 tension picks up the same cap:
       phi.B_ans = 0.75 x 0.4417865 x 19                  = 6.29546 kip          */
var lowFy = ENG.run(refInput({ Lb_in: 16, rodFy: 10 }));
var refFy = rD;
near('default A307: phi.B_vn = Eq. 9-5 crushing 4.70977 kip', refFy.connector.phiBvn, 4.70977, 0.05, ' kip');
near('default A307: phi.B_vnc 4.70977 kip', refFy.connector.phiBvnc, 4.70977, 0.05, ' kip');
// The cap is INERT at A307 because 1.9 f_y = 68.4 exceeds F_u = 60, so Eq. 9-7
// must equal the raw-F_u value 10.3378 kip and B_vn must equal crushing exactly.
near('default A307: Eq. 9-7 steel term is the uncapped 10.3378 kip',
     0.65 * 0.6 * refFy.connector.Ab * Math.min(60, 1.9 * 36, 125), 10.3378, 0.05, ' kip');
ok('default A307: the f_u cap is inert (1.9 f_y = 68.4 > F_u = 60), so B_vn = crushing exactly',
   Math.abs(refFy.connector.phiBvn - refFy.connector.phiBvnc) < 1e-12 &&
   refFy.connector.phiBvnc < 0.65 * 0.6 * refFy.connector.Ab * 60,
   'B_vn = phi.B_vnc = ' + refFy.connector.phiBvn.toFixed(4) + ' kip < 10.3378');
near('rodFy = 10: phi.B_vns uses f_u,eff = 19 ksi -> 3.27364 kip',
     0.65 * 0.6 * lowFy.connector.Ab * 19, 3.27364, 0.05, ' kip');
near('rodFy = 10: phi.B_vn falls to the capped steel-shear value 3.27364 kip',
     lowFy.connector.phiBvn, 3.27364, 0.05, ' kip');
ok('rodFy = 10: Eq. 9-7 steel shear now GOVERNS B_vn (below Eq. 9-5 crushing)',
   lowFy.connector.phiBvn < lowFy.connector.phiBvnc - 1e-9,
   lowFy.connector.phiBvn.toFixed(4) + ' < ' + lowFy.connector.phiBvnc.toFixed(4) + ' kip');
ok('rodFy = 10: the raw grade F_u = 60 (10.3378 kip) is NOT used',
   Math.abs(lowFy.connector.phiBvn - 10.3378) > 1e-3, lowFy.connector.phiBvn.toFixed(4) + ' kip');
near('rodFy = 10: uncapped would have over-credited Eq. 9-7 by 3.16x',
     10.3378 / lowFy.connector.phiBvn, 3.158, 0.5, 'x');
near('rodFy = 10: Eq. 9-2 tension picks up the same cap -> 6.29546 kip',
     0.75 * lowFy.connector.Ab * 19, 6.29546, 0.05, ' kip');
ok('rodFy = 10: phi.B_an is the capped Eq. 9-2 term, not face-shell bearing',
   Math.abs(lowFy.connector.phiBan - 6.29546) < 0.01, lowFy.connector.phiBan.toFixed(4) + ' kip');
// The capped B_vn propagates: the jamb capacity is min(steel double shear, B_vn).
near('capped B_vn propagates to the jamb capacity', lowFy.jamb.capacity, 3.27364, 0.05, ' kip');

// ═══════════════════════════════════════════════════════════════════════════
hd('RESULT');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
console.log(lines.join('\n'));
process.exit(fail ? 1 : 0);
