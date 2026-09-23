// =============================================================================
// RD engine (engines/rect-diaphragm.js) v2 — pure node test, no browser.
// -----------------------------------------------------------------------------
// Proves (plan docs/plans/2026-09-23-parapet-steps-plan.md, WP-1, R1-R20):
//   1. v1 arithmetic preserved bitwise for layouts without steps and without a
//      3+ line overhang (frozen copy of the v1 calcDir below), incl. the Red
//      Bluff levels read through LH.levelFromDiaphragmState.
//   2. R1/R19 overhang fix: walls 10/30/60 -> 11.25/11.25/7.5; global ΣF = 0
//      and ΣM0 = 0 for every 2+ line layout, with or without steps; diagrams
//      close (M = 0 at the free ends and at the 3+ line interior hinges).
//   3. Hand fixtures (a) (b) (c), opposite-face envelope, R13 negative
//      reactions, R18 split governing cases, ASD factor, direction mapping.
//   4. Fatal validation (R10/R20) and seismic without steps.
// Usage: node tools/test-rect-diaphragm-engine.mjs
// =============================================================================
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RD = require('../public/Calcs/engines/rect-diaphragm.js');
const LH = require('../public/Calcs/engines/lateral-handoff.js');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const allClose = (a, b, tol = 1e-6) => a.length === b.length && a.every((v, i) => close(v, b[i], tol));
const J = (o) => JSON.stringify(o);

// ── frozen v1 calcDir (verbatim from engine v1, 2026-09-23) ───────────────────
function calcDirV1(V, L_along, B_perp, swRows, dirLabel){
  var w = V / L_along; // kip/ft
  var sws = swRows.map(function(r){return {label:r.label, len:r.len, loc:r.loc};});
  sws.sort(function(a,b){return a.loc-b.loc;});
  var reactions;
  if(sws.length===1){
    reactions = [V];
  } else if(sws.length===2){
    var a=sws[0].loc, b2=sws[1].loc;
    var span=b2-a;
    var R2 = w * L_along * (L_along/2 - a) / span;
    var R1 = V - R2;
    reactions = [R1, R2];
  } else {
    reactions = [];
    for(var i=0;i<sws.length;i++){
      var locPrev = i===0?0:((sws[i].loc+sws[i-1].loc)/2);
      var locNext = i===sws.length-1?L_along:((sws[i].loc+sws[i+1].loc)/2);
      reactions.push(w*(locNext-locPrev));
    }
  }
  var unitShears = sws.map(function(sw,i){ return reactions[i]/sw.len; });
  var M_design, M_note, Vmax_beam;
  if(sws.length===1){
    M_design = V*L_along/8;
    M_note = 'single wall line — M shown as w·L²/8 reference value; verify load path';
    Vmax_beam = V;
  } else if(sws.length===2){
    var aL=sws[0].loc, bL=sws[1].loc;
    var spanL=bL-aL;
    var R_l=reactions[0], R_r=reactions[1];
    var x0 = R_l/w - aL;
    x0 = Math.max(0, Math.min(spanL, x0));
    var M_pos = R_l*x0 - w*(aL+x0)*(aL+x0)/2;
    var M_negL = w*aL*aL/2;
    var M_negR = w*(L_along-bL)*(L_along-bL)/2;
    M_design = Math.max(Math.abs(M_pos), M_negL, M_negR);
    M_note = (aL<=0.001 && Math.abs(bL-L_along)<=0.001)
      ? 'M = w·L²/8 (supports at diaphragm ends)'
      : 'asymmetric wall locations — M from beam analysis incl. overhang moments';
    Vmax_beam = Math.max(
      Math.abs(w*aL),
      Math.abs(R_l - w*aL),
      Math.abs(R_r - w*(L_along-bL)),
      Math.abs(w*(L_along-bL))
    );
  } else {
    var aM=sws[0].loc, bM=sws[sws.length-1].loc;
    M_design = Math.max(w*aM*aM/2, w*(L_along-bM)*(L_along-bM)/2);
    Vmax_beam = 0;
    for(var k=0;k<sws.length;k++){
      var pm = k===0?0:((sws[k].loc+sws[k-1].loc)/2);
      var nm = k===sws.length-1?L_along:((sws[k].loc+sws[k+1].loc)/2);
      Vmax_beam = Math.max(Vmax_beam, w*(sws[k].loc-pm), w*(nm-sws[k].loc));
      if(k>0){
        var sp = sws[k].loc - sws[k-1].loc;
        M_design = Math.max(M_design, w*sp*sp/8);
      }
    }
    M_note = 'multi-line (tributary) — M = max of w·s²/8 per span + overhangs (simplified; verify with continuous-beam analysis if critical)';
  }
  var chord_T = M_design / B_perp;
  var v_dia = Vmax_beam / B_perp;
  return { label: dirLabel, V: V, L_along: L_along, B_perp: B_perp, w: w, sws: sws, reactions: reactions,
    unitShears: unitShears, M_max: M_design, M_note: M_note, Vmax_beam: Vmax_beam, chord_T: chord_T, v_dia: v_dia };
}
const V1_KEYS = ['label', 'V', 'L_along', 'B_perp', 'w', 'M_max', 'M_note', 'Vmax_beam', 'chord_T', 'v_dia'];
function bitwiseSame(a, b) {
  for (const k of V1_KEYS) if (!Object.is(a[k], b[k])) return `${k}: ${a[k]} vs ${b[k]}`;
  for (const k of ['reactions', 'unitShears']) {
    if (a[k].length !== b[k].length || a[k].some((v, i) => !Object.is(v, b[k][i]))) return `${k}: ${J(a[k])} vs ${J(b[k])}`;
  }
  if (J(a.sws) !== J(b.sws)) return 'sws differ';
  return '';
}

// Independent statics helpers for the checks below.
function Mat(res, loads, x) {
  let m = 0;
  res.sws.forEach((sw, i) => { if (sw.loc < x) m += res.reactions[i] * (x - sw.loc); });
  loads.forEach(([p, q, qk]) => { const e = Math.min(x, q), len = e - p; if (len > 0) m -= qk * len * (x - (p + e) / 2); });
  return m;
}
function loadsOf(res) {
  const out = [[0, res.L_along, res.V_udl / res.L_along]];
  (res.steps || []).forEach((s) => out.push([s.start, s.end, s.F / s.width]));
  return out;
}
function sampledMax(res) {
  const loads = loadsOf(res);
  const lo = Math.min(0, ...res.sws.map((s) => s.loc)), hi = Math.max(res.L_along, ...res.sws.map((s) => s.loc));
  const xs = res.sws.map((s) => s.loc);
  loads.forEach(([p, q]) => xs.push(p, q));
  for (let i = 0; i <= 4000; i++) xs.push(lo + (hi - lo) * i / 4000);
  return Math.max(...xs.map((x) => Math.abs(Mat(res, loads, x))));
}
// Equilibrium + diagram closure for one result (2+ lines).
function statics(res) {
  const msg = [];
  if (!res.moment.ok) msg.push(`moment table checkF ${res.moment.checkF} checkM ${res.moment.checkM}`);
  const sR = res.reactions.reduce((s, v) => s + v, 0);
  if (!close(sR, res.V, 1e-9)) msg.push(`ΣR ${sR} != V ${res.V}`);
  const loads = loadsOf(res);
  const hi = Math.max(res.L_along, ...res.sws.map((s) => s.loc)) + 1;
  const Mend = Mat(res, loads, hi);
  if (Math.abs(Mend) > 1e-7 * Math.max(1, res.V * res.L_along)) msg.push(`M past the right end ${Mend}`);
  if (res.sws.length >= 3) {
    for (let k = 1; k < res.sws.length - 1; k++) {
      const m = Mat(res, loads, res.sws[k].loc);
      if (Math.abs(m) > 1e-7 * Math.max(1, res.V * res.L_along)) msg.push(`M at interior line ${res.sws[k].loc} = ${m} (hinge expected)`);
    }
  }
  const smp = sampledMax(res);
  if (res.M_max < smp - 1e-7 * Math.max(1, smp)) msg.push(`M_max ${res.M_max} < sampled ${smp}`);
  if (res.M_max > smp * 1.001 + 1e-6) msg.push(`M_max ${res.M_max} > sampled ${smp}`);
  return msg.join('; ');
}

// Deterministic PRNG.
let seed = 20260923;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const r1 = (a, b) => Math.round((a + (b - a) * rnd()) * 10) / 10;

// ── 0. tag ────────────────────────────────────────────────────────────────
check('RD engine v2', RD.ENGINE.name === 'rect-diaphragm' && RD.ENGINE.version === 2, J(RD.ENGINE));
check('RD exports analyze / calcDir / stepForces / checkSwLocs', ['analyze', 'calcDir', 'stepForces', 'checkSwLocs'].every((k) => typeof RD[k] === 'function'), Object.keys(RD).join(','));

// ── 1. bitwise v1 equality — Red Bluff through LH ─────────────────────────
const FX = fileURLToPath(new URL('../fixtures/lateral/red-bluff/', import.meta.url));
const captured = [];
const realAnalyze = RD.analyze;
RD.analyze = function (o) { captured.push(JSON.parse(JSON.stringify(o))); return realAnalyze(o); };
for (const f of ['diaphragm-roof-state.json', 'diaphragm-3rd-state.json', 'diaphragm-2nd-state.json']) {
  LH.levelFromDiaphragmState(JSON.parse(readFileSync(FX + f, 'utf8')));
}
RD.analyze = realAnalyze;
check('Red Bluff: captured 3 levels', captured.length === 3, String(captured.length));
let rbDiff = [], rbOver = [];
captured.forEach((o, li) => {
  const an = RD.analyze(o);
  const pairs = [
    [an.wx, calcDirV1(o.Vx, o.D, o.B, o.swX, 'Wind-X (EW)'), o.swX],
    [an.wy, calcDirV1(o.Vy, o.B, o.D, o.swY, 'Wind-Y (NS)'), o.swY]
  ];
  if (o.Vx_s > 0) pairs.push([an.sx, calcDirV1(o.Vx_s, o.D, o.B, o.swX, 'Seismic-X (EW)'), o.swX]);
  if (o.Vy_s > 0) pairs.push([an.sy, calcDirV1(o.Vy_s, o.B, o.D, o.swY, 'Seismic-Y (NS)'), o.swY]);
  pairs.forEach(([n, v1, rows], pi) => {
    const locs = rows.map((r) => r.loc).sort((a, b) => a - b);
    const L = n.L_along;
    if (locs.length >= 3 && (locs[0] !== 0 || locs[locs.length - 1] !== L)) { rbOver.push(`level ${li} dir ${pi}`); return; }
    const d = bitwiseSame(n, v1);
    if (d) rbDiff.push(`level ${li} dir ${pi}: ${d}`);
    if (n.cases) rbDiff.push(`level ${li} dir ${pi}: unexpected cases`);
  });
});
check('Red Bluff: every direction bitwise-identical to v1', rbDiff.length === 0, rbDiff.join(' | '));
check('Red Bluff: no 3+ line overhang layouts (goldens unaffected by R1)', rbOver.length === 0, rbOver.join(', '));

// ── 1b. bitwise v1 equality — random layouts without 3+ overhang ──────────
{
  const bad = [];
  let count = 0;
  for (let t = 0; t < 60; t++) {
    const L = r1(20, 300), Bp = r1(20, 200), V = r1(1, 80);
    const n = 1 + Math.floor(rnd() * 5);
    let locs;
    if (n <= 2) {
      locs = []; while (locs.length < n) { const v = r1(-0.2 * L, 1.2 * L); if (!locs.includes(v)) locs.push(v); }
    } else {
      locs = [0, L]; while (locs.length < n) { const v = r1(1, L - 1); if (!locs.includes(v)) locs.push(v); }
    }
    const rows = locs.map((loc, i) => ({ label: 'L' + i, len: r1(5, 60), loc }));
    rows.reverse();   // unsorted input
    const d = bitwiseSame(RD.calcDir(V, L, Bp, rows, 'T'), calcDirV1(V, L, Bp, rows, 'T'));
    if (d) bad.push(`#${t} n=${n}: ${d}`);
    count++;
  }
  check(`random ${count} no-overhang layouts bitwise-identical to v1`, bad.length === 0, bad.slice(0, 5).join(' | '));
}

// ── 2. R1 / R19 overhang fix ──────────────────────────────────────────────
{
  const rows = [{ label: 'A', len: 20, loc: 10 }, { label: 'B', len: 20, loc: 30 }, { label: 'C', len: 20, loc: 60 }];
  const r = RD.calcDir(30, 60, 120, rows, 'Wind-Y (NS)');
  const v1 = calcDirV1(30, 60, 120, rows, 'x');
  check('R1: v1 gave 10/12.5/7.5 (ΣRx 925 — the defect)', allClose(v1.reactions, [10, 12.5, 7.5]), J(v1.reactions));
  check('R1: walls 10/30/60, L 60, w 0.5 -> 11.25/11.25/7.5', allClose(r.reactions, [11.25, 11.25, 7.5], 1e-12), J(r.reactions));
  check('R1: ΣR = 30, ΣR·x = 900 (table sumRx), checks zero', close(r.moment.sumR, 30, 1e-12) && close(r.moment.sumRx, 900, 1e-12) && r.moment.ok && close(r.moment.sumM, 900, 1e-12), J(r.moment));
  check('R1: no cases on an unstepped result', r.cases === undefined && r.V === 30 && r.V_udl === 30 && r.V_steps === 0, '');
  check('R1: Vmax 7.5, Mmax 56.25 at 45', close(r.Vmax_beam, 7.5) && close(r.M_max, 56.25) && close(r.diagram.x_Mmax, 45), `${r.Vmax_beam} ${r.M_max} ${r.diagram.x_Mmax}`);
  check('R1: shear zeros 22.5 and 45, support moment −25 at 10', allClose(r.diagram.vZeros, [22.5, 45]) && close(r.diagram.points.find((p) => p.x === 10).M, -25) && close(r.diagram.M_neg, -25), J(r.diagram.vZeros) + ' ' + r.diagram.M_neg);
  check('R1: chord T = M/B, v = V/B', close(r.chord_T, 56.25 / 120) && close(r.v_dia, 7.5 / 120), '');
  check('R1: spans[] with the cantilever segment on span 0', r.spans.length === 2 && r.spans[0].segments.some((s) => s.overhang && close(s.Ra, 6.25) && close(s.Rb, -1.25)), J(r.spans[0].segments));
  check('R1: statics/diagram closure', statics(r) === '', statics(r));
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, Vx: 10, swX: [{ label: 'S', len: 30, loc: 0 }, { label: 'N', len: 30, loc: 120 }], swY: rows });
  check('R19: analyze without parapet applies R1 on the unstepped result', allClose(an.wy.reactions, [11.25, 11.25, 7.5]) && !an.wy.cases && !an.parapet && !an.fatal, J(an.wy.reactions));
}

// ── 2b. random equilibrium, overhangs and steps, 2 and 3+ lines ───────────
{
  const bad = [];
  for (let t = 0; t < 120; t++) {
    const L = r1(30, 240), Bp = r1(20, 200), V = r1(1, 60);
    const n = 2 + Math.floor(rnd() * 4);
    const locs = []; while (locs.length < n) { const v = r1(-0.1 * L, 1.1 * L); if (!locs.some((x) => Math.abs(x - v) < 0.5)) locs.push(v); }
    const rows = locs.map((loc, i) => ({ label: 'L' + i, len: r1(5, 60), loc }));
    const steps = [];
    const ns = Math.floor(rnd() * 4);
    for (let s = 0; s < ns; s++) { const st = r1(0, L * 0.9); steps.push({ label: 'S' + s, start: st, width: Math.max(0.5, r1(0.5, L - st)), F: r1(0.1, 6) }); }
    const r = RD.calcDir(V, L, Bp, rows, 'T', { steps });
    const m = statics(r);
    if (m) bad.push(`#${t} n=${n} steps=${ns}: ${m}`);
  }
  check('random 120 layouts (overhangs, 0-3 steps): ΣF = 0, ΣM0 = 0, diagrams close, M_max = sampled max', bad.length === 0, bad.slice(0, 4).join(' | '));
}

// ── 3. hand fixtures ──────────────────────────────────────────────────────
const W60 = (locs) => locs.map((loc, i) => ({ label: ['W', 'Int', 'E', 'X4'][i] + '@' + loc, len: 40, loc }));
const PAR = (steps, extra = {}) => Object.assign({ qp_psf: 30, GCpn_ww: 1.5, GCpn_lw: 1.0, h_typ_ft: 3, h_max_ft: 6, commonBase: true, roofFlat: true, steps }, extra);
const SX = [{ label: 'S', len: 60, loc: 0 }, { label: 'N', len: 60, loc: 120 }];
const caseOf = (res, id) => res.cases.find((c) => c.id === id);

// stepForces
{
  const sf = RD.stepForces(PAR([{ label: 'P1', face: 'n', start_ft: 10, width_ft: 20, h_ft: 6 }]), 60, 120);
  const s = sf.steps[0];
  check('stepForces: face n -> N, Wind-Y, Δh 3, x̄ 20, F_ww 2.7 k (45 psf), F_lw 1.8 k (30 psf)',
    s.face === 'N' && s.dir === 'Y' && s.dh_ft === 3 && s.x_ft === 20 && close(s.F_ww_k, 2.7, 1e-12) && close(s.F_lw_k, 1.8, 1e-12) && s.active && sf.Y.length === 1 && sf.X.length === 0 && sf.fatal.length === 0 && s.faceLen_ft === 60 && s.origin === 'W corner', J(s));
  const sf2 = RD.stepForces(PAR([{ face: 'E', start_ft: 0, width_ft: 10, h_ft: 5 }], { h_typ_ft: '' }), 60, 120);
  check('stepForces: blank h_typ = h_max (Δh 0 -> inactive); E face -> Wind-X, face length D, origin S corner', sf2.h_typ_ft === 6 && sf2.steps[0].dir === 'X' && sf2.steps[0].faceLen_ft === 120 && sf2.steps[0].origin === 'S corner' && !sf2.steps[0].active && !sf2.anyActive && sf2.fatal.length === 0, J(sf2));
  const sf3 = RD.stepForces(PAR([{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }], { GCpn_lw: -1, asdFactor: 0.6 }), 60, 120);
  check('stepForces: GCpn_lw −1 taken as 1.0; asdFactor 0.6 -> 1.62 / 1.08 k', close(sf3.steps[0].F_ww_k, 1.62, 1e-12) && close(sf3.steps[0].F_lw_k, 1.08, 1e-12) && sf3.GCpn_lw === 1, J(sf3.steps[0]));
}

// (a) 2 lines W@0 E@60
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, Vx: 20, swX: SX, swY: W60([0, 60]), parapet: PAR([{ label: 'P1', face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }]) });
  const y = an.wy, n = caseOf(y, 'fromN'), s = caseOf(y, 'fromS');
  check('(a) Wind-Y stepped: cases fromN, fromS; Wind-X unstepped (no cases)', y.stepped === true && y.cases.map((c) => c.id).join() === 'fromN,fromS' && !an.wx.cases && an.wx.V === 20, '');
  check('(a) fromN (N face windward, 45 psf): R 16.80 / 15.90, V_total 32.7', allClose(n.reactions, [16.8, 15.9], 1e-12) && close(n.V_total, 32.7, 1e-12) && n.steps[0].GC_role === 'windward' && close(n.steps[0].F, 2.7, 1e-12), J(n.reactions));
  check('(a) fromN: ΣM0 954, V-zero 28.5827, M 252.6378, Vmax 16.80, v 140.0 plf, T 2.1053',
    close(n.moment.sumM, 954, 1e-12) && close(n.diagram.vZeros[0], 28.582677, 1e-6) && close(n.M_max, 252.637795, 1e-8) && close(n.Mmax, 252.6378, 1e-6) && close(n.Vmax, 16.8, 1e-12) && close(n.v_dia * 1000, 140, 1e-12) && close(n.chord_T, 2.105315, 1e-6),
    `${n.diagram.vZeros} ${n.M_max} ${n.Vmax} ${n.v_dia} ${n.chord_T}`);
  check('(a) fromN moment table rows: UDL 30 @ 30, step 2.7 @ 20, reactions; checks 0',
    n.moment.rows.length === 4 && n.moment.rows[1].kind === 'load' && close(n.moment.rows[1].Fx, 54, 1e-12) && n.moment.rows[3].kind === 'reaction' && close(n.moment.rows[3].Fx, 954, 1e-12) && n.moment.ok, J(n.moment.rows));
  check('(a) fromS (N face leeward, 30 psf): R 16.20 / 15.60, V_total 31.8', allClose(s.reactions, [16.2, 15.6], 1e-12) && close(s.V_total, 31.8, 1e-12) && s.steps[0].GC_role === 'leeward', J(s.reactions));
  const e = y.envelope;
  check('(a) envelope: single N-face step governs in fromN everywhere (R, V, M, T, v, V_total)',
    e.reactions.every((r) => r.governing_cases.join() === 'fromN' && r.sign === 1) && close(e.reactions[0].abs, 16.8, 1e-12) && close(e.reactions[1].abs, 15.9, 1e-12)
    && ['Vmax', 'Mmax', 'chord_T', 'v_dia', 'V_total'].every((k) => e[k].cases.join() === 'fromN') && close(e.Mmax.value, 252.637795, 1e-8), J(e));
  const base = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 60]) }).wy;
  check('(a) without the step: M 225.0, v 125.0 plf, T 1.875', close(base.M_max, 225) && close(base.v_dia * 1000, 125) && close(base.chord_T, 1.875) && !base.cases, '');
  check('(a) analyze echoes parapet (stepForces output)', an.parapet && an.parapet.Y.length === 1 && an.parapet.qp_psf === 30, '');
}

// (b) 3 lines, step [10,30]
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 30, 60]), parapet: PAR([{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }]) });
  const n = caseOf(an.wy, 'fromN');
  const base = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 30, 60]) }).wy;
  check('(b) no steps: 7.5 / 15.0 / 7.5', allClose(base.reactions, [7.5, 15, 7.5], 1e-12), J(base.reactions));
  check('(b) fromN: 8.40 / 16.80 / 7.50, span-1 M 68.1024, Vmax 9.30, v 77.5 plf, T 0.567520',
    allClose(n.reactions, [8.4, 16.8, 7.5], 1e-12) && close(n.M_max, 68.102362, 1e-7) && close(n.Vmax, 9.3, 1e-12) && close(n.v_dia * 1000, 77.5, 1e-12) && close(n.chord_T, 0.567520, 1e-6) && allClose(n.diagram.vZeros, [15.354331, 45], 1e-6),
    `${J(n.reactions)} ${n.M_max} ${n.Vmax} ${J(n.diagram.vZeros)}`);
  check('(b) statics', statics(n) === '' && statics(caseOf(an.wy, 'fromS')) === '', statics(n));
  check('(b) envelope governed by fromN', an.wy.envelope.Mmax.cases.join() === 'fromN' && an.wy.envelope.reactions[0].governing_cases.join() === 'fromN', J(an.wy.envelope.Mmax));
}

// (c) straddling step [20,40]
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 30, 60]), parapet: PAR([{ face: 'N', start_ft: 20, width_ft: 20, h_ft: 6 }]) });
  const n = caseOf(an.wy, 'fromN');
  check('(c) fromN: 7.725 / 17.25 / 7.725, M 59.6756 (both spans), Vmax 8.625, v 71.875 plf',
    allClose(n.reactions, [7.725, 17.25, 7.725], 1e-12) && close(n.M_max, 59.675625, 1e-9) && close(n.Vmax, 8.625, 1e-12) && close(n.v_dia * 1000, 71.875, 1e-12) && allClose(n.diagram.vZeros, [15.45, 44.55], 1e-9),
    `${J(n.reactions)} ${n.M_max} ${n.Vmax} ${J(n.diagram.vZeros)}`);
  check('(c) step split into two span segments', n.steps[0].segments.length === 2 && close(n.steps[0].segments[0].F, 1.35, 1e-12) && close(n.steps[0].segments[1].F, 1.35, 1e-12), J(n.steps[0].segments));
}

// Opposite-face envelope (Codex R2/R15): supports 10/50, N [0,10] and S [50,60], Δh 6
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([10, 50]),
    parapet: PAR([{ label: 'PN', face: 'N', start_ft: 0, width_ft: 10, h_ft: 9 }, { label: 'PS', face: 'S', start_ft: 50, width_ft: 10, h_ft: 9 }], { h_max_ft: 9 }) });
  const y = an.wy, n = caseOf(y, 'fromN'), s = caseOf(y, 'fromS'), e = y.envelope;
  check('opposite: fromN 17.8125 / 16.6875 (34.50), fromS 16.6875 / 17.8125 (34.50)',
    allClose(n.reactions, [17.8125, 16.6875], 1e-12) && allClose(s.reactions, [16.6875, 17.8125], 1e-12) && close(n.V, 34.5, 1e-12) && close(s.V, 34.5, 1e-12), `${J(n.reactions)} ${J(s.reactions)}`);
  check('opposite: shear zeros 30.225 / 29.775; ΣM0 1012.5 / 1057.5', close(n.diagram.vZeros[0], 30.225, 1e-9) && close(s.diagram.vZeros[0], 29.775, 1e-9) && close(n.moment.sumM, 1012.5, 1e-12) && close(s.moment.sumM, 1057.5, 1e-12), `${n.diagram.vZeros} ${s.diagram.vZeros}`);
  check('opposite: envelope 17.8125 (fromN) / 17.8125 (fromS)', close(e.reactions[0].abs, 17.8125, 1e-12) && e.reactions[0].governing_cases.join() === 'fromN' && close(e.reactions[1].abs, 17.8125, 1e-12) && e.reactions[1].governing_cases.join() === 'fromS', J(e.reactions));
  check('opposite: Mmax 63.76265625 and Vmax 10.1125, ties list both cases',
    close(e.Mmax.value, 63.76265625, 1e-10) && e.Mmax.cases.join() === 'fromN,fromS' && close(e.Vmax.value, 10.1125, 1e-10) && e.Vmax.cases.join() === 'fromN,fromS' && e.chord_T.cases.join() === 'fromN,fromS' && e.V_total.cases.join() === 'fromN,fromS', J([e.Mmax, e.Vmax]));
  check('opposite: both cases in equilibrium', statics(n) === '' && statics(s) === '', statics(n) + statics(s));
}

// R13 negative reactions: supports 0/20, N [0,20], Δh 3
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 20]), parapet: PAR([{ face: 'N', start_ft: 0, width_ft: 20, h_ft: 6 }]) });
  const n = caseOf(an.wy, 'fromN'), s = caseOf(an.wy, 'fromS'), e = an.wy.envelope;
  check('R13: fromN −13.65 / 46.35 (32.70), fromS −14.10 / 45.90 (31.80)',
    allClose(n.reactions, [-13.65, 46.35], 1e-12) && allClose(s.reactions, [-14.1, 45.9], 1e-12) && close(n.V, 32.7, 1e-12) && close(s.V, 31.8, 1e-12), `${J(n.reactions)} ${J(s.reactions)}`);
  check('R13: envelope 14.10 (−, fromS) / 46.35 (+, fromN); signed value kept',
    close(e.reactions[0].abs, 14.1, 1e-12) && e.reactions[0].sign === -1 && e.reactions[0].governing_cases.join() === 'fromS' && close(e.reactions[0].value, -14.1, 1e-12)
    && close(e.reactions[1].abs, 46.35, 1e-12) && e.reactions[1].sign === 1 && e.reactions[1].governing_cases.join() === 'fromN', J(e.reactions));
  check('R13: per-case equality ΣR = V_total and ΣM0 = 0', n.moment.ok && s.moment.ok && statics(n) === '' && statics(s) === '', '');
  check('R13: envelope magnitudes do not sum to either case total (by design)', !close(e.reactions[0].abs * e.reactions[0].sign + e.reactions[1].abs, n.V, 1e-6) && e.V_total.cases.join() === 'fromN' && close(e.V_total.value, 32.7, 1e-12), '');
}

// R18 split governing cases: supports 10/50, N [0,10], Δh 6
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([10, 50]), parapet: PAR([{ face: 'N', start_ft: 0, width_ft: 10, h_ft: 9 }], { h_max_ft: 9 }) });
  const n = caseOf(an.wy, 'fromN'), s = caseOf(an.wy, 'fromS'), e = an.wy.envelope;
  check('R18: fromN Vmax 10.3375 / M 68.36390625; fromS Vmax 10.2250 / M 70.550625',
    close(n.Vmax, 10.3375, 1e-12) && close(n.Mmax, 68.36390625, 1e-10) && close(s.Vmax, 10.225, 1e-12) && close(s.Mmax, 70.550625, 1e-10), `${n.Vmax} ${n.Mmax} ${s.Vmax} ${s.Mmax}`);
  check('R18: envelope Vmax 10.3375 [fromN], Mmax 70.550625 [fromS], chord_T 0.587921875 [fromS]',
    close(e.Vmax.value, 10.3375, 1e-12) && e.Vmax.cases.join() === 'fromN' && close(e.Mmax.value, 70.550625, 1e-10) && e.Mmax.cases.join() === 'fromS'
    && close(e.chord_T.value, 0.587921875, 1e-10) && e.chord_T.cases.join() === 'fromS', J([e.Vmax, e.Mmax, e.chord_T]));
}

// R4 ASD display factor (fixture a at ASD: baseline 18 k)
{
  const asd = RD.analyze({ B: 60, D: 120, Vy: 18, swX: SX, swY: W60([0, 60]), parapet: PAR([{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }], { asdFactor: 0.6 }) });
  const str = RD.analyze({ B: 60, D: 120, Vy: 18 / 0.6, swX: SX, swY: W60([0, 60]), parapet: PAR([{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }]) });
  const a = caseOf(asd.wy, 'fromN'), s = caseOf(str.wy, 'fromN');
  check('R4: ASD display 18 + 1.62 = 19.62 k, R 10.08 / 9.54', close(a.V, 19.62, 1e-12) && allClose(a.reactions, [10.08, 9.54], 1e-12) && close(a.V_steps, 1.62, 1e-12), `${a.V} ${J(a.reactions)}`);
  check('R4: strength export 32.70 k, R 16.80 / 15.90 (step never ÷0.6)', close(s.V, 32.7, 1e-12) && allClose(s.reactions, [16.8, 15.9], 1e-12), `${s.V} ${J(s.reactions)}`);
}

// Direction mapping: E/W faces -> Wind-X, start from S corner, span D
{
  const an = RD.analyze({ B: 60, D: 120, Vx: 60, Vy: 30, swX: SX, swY: W60([0, 60]), parapet: PAR([{ face: 'W', start_ft: 30, width_ft: 20, h_ft: 6 }]) });
  const w = caseOf(an.wx, 'fromW'), e = caseOf(an.wx, 'fromE');
  // Wind-X: w 0.5 over D = 120; step F 2.7 (fromW) at y = 40 from S; supports S@0, N@120.
  check('W-face step -> Wind-X cases fromW / fromE; Wind-Y unstepped', an.wx.stepped && an.wx.cases.map((c) => c.id).join() === 'fromW,fromE' && !an.wy.cases, '');
  check('W-face step: fromW R_N = (60·60 + 2.7·40)/120 = 30.9, R_S = 62.7 − 30.9 = 31.8',
    allClose(w.reactions, [31.8, 30.9], 1e-12) && w.steps[0].GC_role === 'windward', J(w.reactions));
  check('W-face step: fromE V_total 61.8, windward E', close(e.V, 61.8, 1e-12) && e.windward === 'E' && e.steps[0].GC_role === 'leeward', `${e.V}`);
}

// Seismic: no steps
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, Vy_s: 12, Vx_s: 5, swX: SX, swY: W60([0, 60]), parapet: PAR([{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 }]) });
  check('seismic runs carry no steps (single result, V = V_s)', an.sy && !an.sy.cases && an.sy.V === 12 && an.sy.V_steps === 0 && an.sx && !an.sx.cases && an.sx.V === 5, J({ V: an.sy.V, st: an.sy.V_steps }));
  check('unstepped direction carries the moment table (display)', an.wx.moment && an.wx.moment.rows.length === 3 && an.wx.moment.ok, J(an.wx.moment));
  const one = RD.calcDir(10, 60, 30, [{ label: 'only', len: 20, loc: 25 }], 'T');
  check('single line: moment table present with note, no diagram', one.moment.rows.length === 2 && !!one.moment.note && one.diagram === null && one.reactions[0] === 10, J(one.moment));
}

// Inactive / zero steps
{
  const an = RD.analyze({ B: 60, D: 120, Vy: 30, swX: SX, swY: W60([0, 30, 60]),
    parapet: { qp_psf: 30, h_typ_ft: 3, h_max_ft: 6, steps: [{ face: 'N', start_ft: 10, width_ft: 20, h_ft: 3 }, { face: 'S', start_ft: 10, width_ft: 20, h_ft: 6, active: false }] } });
  check('zero-Δh and active:false steps: no fatal (commonBase not needed), no cases, v1 numbers', !an.fatal && !an.wy.cases && allClose(an.wy.reactions, [7.5, 15, 7.5], 0), J(an.fatal || an.wy.reactions));
}

// ── 4. fatal validation ───────────────────────────────────────────────────
{
  const base = { B: 60, D: 120, Vy: 30, Vx: 20, swX: SX, swY: W60([0, 60]) };
  const step = { label: 'P1', face: 'N', start_ft: 10, width_ft: 20, h_ft: 6 };
  const fat = (o) => RD.analyze(Object.assign({}, base, o));
  const isFatal = (r, re) => Array.isArray(r.fatal) && r.fatal.some((m) => re.test(m)) && r.wx === undefined && r.wy === undefined;

  let r = fat({ swY: W60([30]), parapet: PAR([step]) });
  check('fatal: active step with 1 Wind-Y line', isFatal(r, /Wind-Y.*≥ 2 shearwall lines/), J(r));
  r = fat({ swY: [], parapet: PAR([step]) });
  check('fatal: active step with 0 Wind-Y lines', isFatal(r, /Wind-Y.*≥ 2/), J(r));
  r = fat({ swX: W60([60]), parapet: PAR([{ face: 'E', start_ft: 0, width_ft: 20, h_ft: 6 }]) });
  check('fatal: E-face step with 1 Wind-X line', isFatal(r, /Wind-X.*≥ 2/), J(r));
  r = fat({ swY: W60([30]), parapet: PAR([{ face: 'E', start_ft: 0, width_ft: 20, h_ft: 6 }]) });
  check('no fatal: 1 Wind-Y line when only Wind-X has steps', !r.fatal && r.wx.cases && !r.wy.cases, J(r.fatal));
  r = fat({ parapet: PAR([Object.assign({}, step, { h_ft: 6.5 })]) });
  check('fatal: h_step 6.5 > h_max 6', isFatal(r, /exceeds the maximum parapet height/), J(r));
  r = fat({ parapet: PAR([step], { commonBase: false }) });
  check('fatal: commonBase false', isFatal(r, /common-base/), J(r));
  r = fat({ parapet: PAR([step], { commonBase: undefined }) });
  check('fatal: commonBase missing', isFatal(r, /common-base/), J(r));
  r = fat({ parapet: PAR([step], { commonBase: 'true' }) });
  check('fatal: commonBase must be boolean true', isFatal(r, /common-base/), J(r));
  r = fat({ parapet: PAR([step], { roofFlat: false }) });
  check('fatal: roofFlat false', isFatal(r, /flat roof/), J(r));
  r = fat({ parapet: PAR([step], { roofFlat: null }) });
  check('no fatal: roofFlat null (no MWFRS record) with commonBase true', !r.fatal && r.wy.cases, J(r.fatal));
  r = fat({ parapet: PAR([Object.assign({}, step, { start_ft: 50, width_ft: 20 })]) });
  check('fatal: N step 50-70 runs past face length B 60', isFatal(r, /runs past the face/), J(r));
  r = fat({ parapet: PAR([{ face: 'W', start_ft: 110, width_ft: 20, h_ft: 6 }]) });
  check('fatal: W step 110-130 runs past face length D 120', isFatal(r, /runs past the face.*120/), J(r));
  r = fat({ parapet: PAR([Object.assign({}, step, { start_ft: -1 })]) });
  check('fatal: negative start', isFatal(r, /runs past the face/), J(r));
  r = fat({ parapet: PAR([Object.assign({}, step, { start_ft: 40, width_ft: 20 })]) });
  check('no fatal: step ending exactly at the face end', !r.fatal && r.wy.cases, J(r.fatal));
  r = fat({ parapet: PAR([Object.assign({}, step, { face: 'Q' })]) });
  check('fatal: bad face', isFatal(r, /face must be N, S, E or W/), J(r));
  r = fat({ parapet: PAR([step], { qp_psf: 0 }) });
  check('fatal: q_p 0 with an active step', isFatal(r, /q_p/), J(r));
  r = fat({ parapet: PAR([step], { h_max_ft: '' , h_typ_ft: 3 }) });
  check('fatal: h_max missing with an active step', isFatal(r, /h_p,max is required/), J(r));
  r = fat({ swY: W60([30]), parapet: PAR([step], { commonBase: false, roofFlat: false }) });
  check('fatal: several messages collected together', r.fatal && r.fatal.length === 3, J(r.fatal));
}

console.log('\n' + (failures.length ? failures.length + ' FAILED' : 'ALL PASS'));
process.exit(failures.length ? 1 : 0);
