// =============================================================================
// Stacked shearwall views — SWV.elevationSVG / SWV.planSVG (pure node)
// -----------------------------------------------------------------------------
// docs/plans/2026-09-30-shearwall-views-plan.md Phase 2. Requires the two
// DOM-free UMD engines (SW, SWV) and proves, on the shipped default model, a
// segmented wall, a stack with a transfer gap / a wall ending above the base,
// positioned openings, hand-built plans and the Red Bluff import:
//   - finite viewBox, no NaN / undefined / Infinity anywhere in the SVG;
//   - element counts (story boxes, segments, openings, ghosts, plan walls);
//   - every numeric label's data-v equals the engine value its data-k names
//     (into res, or "plan:" into SW.planModel) within 0.05;
//   - statics: the drawn T / C / V are exactly the engine's End 1 / End 2
//     fields for the load direction (T at End 1 and C at End 2 for →,
//     swapped for ←; per segment on a segmented wall);
//   - the notes / stamps the plan requires, and escaped text.
// Usage: node tools/test-sw-views.mjs
// =============================================================================
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SW = require('../public/Calcs/engines/stacked-shearwall.js');
const SWV = require('../public/Calcs/engines/sw-views.js');
const RD = require('../public/Calcs/engines/rect-diaphragm.js');
const LH = require('../public/Calcs/engines/lateral-handoff.js');
void RD;

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── SVG helpers ─────────────────────────────────────────────────────────────
const labels = (svg) => [...svg.matchAll(/data-q="([^"]*)" data-v="([^"]*)" data-k="([^"]*)"/g)].map((m) => ({ q: m[1], v: Number(m[2]), k: m[3].replace(/&quot;/g, '"').replace(/&amp;/g, '&') }));
function resolve(k, res, plan, state) {
  let o = res, p = k;
  if (k.startsWith('plan:')) { o = plan; p = k.slice(5); }
  else if (k.startsWith('state:')) { o = state; p = k.slice(6); }
  for (const part of p.split('.')) { if (o == null) return undefined; o = o[/^[0-9]+$/.test(part) ? Number(part) : part]; }
  return o;
}
function mismatches(svg, res, plan, state) {
  return labels(svg).filter((l) => { const e = resolve(l.k, res, plan, state); return !(typeof e === 'number' && isFinite(e) && Math.abs(e - l.v) <= 0.05); })
    .map((l) => `${l.q} ${l.k} drawn ${l.v} engine ${resolve(l.k, res, plan, state)}`);
}
function viewBoxOk(svg) {
  const m = svg.match(/viewBox="([^"]*)"/);
  if (!m) return false;
  const v = m[1].split(' ').map(Number);
  return v.length === 4 && v.every((x) => isFinite(x)) && v[2] > 0 && v[3] > 0;
}
const clean = (svg) => !/NaN|undefined|Infinity/.test(svg);
const count = (svg, re) => (svg.match(re) || []).length;
// A drawing is sound when it has a finite viewBox, no NaN, and every label ties to the engine.
function sound(tag, svg, res, plan, state) {
  const mm = mismatches(svg, res, plan, state);
  check(`${tag}: finite viewBox, no NaN / undefined / Infinity, ${labels(svg).length} labels all = engine (±0.05)`,
    svg.length > 0 && viewBoxOk(svg) && clean(svg) && labels(svg).length > 0 && mm.length === 0,
    (viewBoxOk(svg) ? '' : 'bad viewBox; ') + (clean(svg) ? '' : 'NaN/undefined in SVG; ') + mm.slice(0, 5).join(' | '));
}

// ── 1. default model (the shipped four-story wall line, CASE1) ─────────────
const def = SW.defaultState();
const res = SW.compute(def);
check('default model computes ok', res.ok === true, res.errors.join(' | '));
for (const ck of ['gov', 'wind', 'seismic']) {
  for (const dirSign of [1, -1]) {
    const e = SWV.elevationSVG(res, def, { id: 'w1', caseKey: ck, dirSign });
    const tag = `default elevation ${ck} ${dirSign === 1 ? '→' : '←'}`;
    sound(tag, e.svg, res, null);
    check(`${tag}: 4 story boxes, 4 segments, 4 openings, 4 level groups data-fi 0..3 data-wi 0, no ghosts`,
      count(e.svg, /class="sw-box"/g) === 4 && count(e.svg, /<rect class="sw-seg/g) === 4 && count(e.svg, /<rect class="sw-open/g) === 4 && count(e.svg, /class="sw-ghost"/g) === 0
      && [0, 1, 2, 3].every((k) => e.svg.includes(`class="sw-level" data-wall="w1" data-fi="${k}" data-wi="0"`)),
      `boxes ${count(e.svg, /class="sw-box"/g)} segs ${count(e.svg, /<rect class="sw-seg/g)} opens ${count(e.svg, /<rect class="sw-open/g)}`);
    // Statics: T / C / V drawn are the engine's fields for this direction.
    const c = e.caseKey, L = labels(e.svg), tEnd = dirSign === 1 ? 0 : 1, cEnd = 1 - tEnd;
    const Ts = L.filter((l) => l.q === 'T'), Cs = L.filter((l) => l.q === 'C'), Vs = L.filter((l) => l.q === 'V');
    const okT = Ts.length === 4 && Ts.every((l, k) => l.k === `floors.${k}.walls.0.cases.${c}.ends.${tEnd}.T` && Math.abs(l.v - res.floors[k].walls[0].cases[c].ends[tEnd].T) <= 0.05);
    const okC = Cs.length === 4 && Cs.every((l, k) => l.k === `floors.${k}.walls.0.cases.${c}.ends.${cEnd}.C` && Math.abs(l.v - res.floors[k].walls[0].cases[c].ends[cEnd].C) <= 0.05);
    const okV = Vs.length === 4 && Vs.every((l, k) => l.k === `floors.${k}.walls.0.cases.${c}.V` && Math.abs(l.v - res.floors[k].walls[0].cases[c].V) <= 0.05);
    check(`${tag}: statics — T at End ${tEnd + 1} = ends[${tEnd}].T, C at End ${cEnd + 1} = ends[${cEnd}].C, V = cases.${c}.V on every level`, okT && okC && okV,
      JSON.stringify({ T: Ts.map((l) => l.k + '=' + l.v), C: Cs.map((l) => l.k + '=' + l.v) }));
  }
}
{
  const e = SWV.elevationSVG(res, def, { id: 'w1' });
  const L = labels(e.svg);
  const base = (q) => L.filter((l) => l.q === q && l.k.startsWith('floors.3.'))[0];
  check('gov resolves to the base wall\'s v_max case (wind) and names 0.6W', e.caseKey === 'wind' && res.floors[3].walls[0].gov.vmaxCase === 'wind' && e.svg.includes('Governing v_max case (base-level governing case, drawn on every level): Wind (0.6W)'), e.caseKey);
  check('base labels: v_max = 70.29 plf, T = 1,806.8 lb, t = 70.29 plf (asserted SW4 values)', e.svg.includes('70.29 plf') && e.svg.includes('1,806.8 lb') && Math.abs(base('vmax').v - 70.29) <= 0.005 && Math.abs(base('T').v - 1806.8) <= 0.05 && base('t') && Math.abs(base('t').v - 70.29) <= 0.005,
    JSON.stringify([base('vmax'), base('T'), base('t')]));
  check('base T_req per bolt = uplift.T_req', base('T_req') && Math.abs(base('T_req').v - res.floors[3].walls[0].uplift.T_req) <= 0.05, JSON.stringify(base('T_req')));
  const Ps = L.filter((l) => l.q === 'P');
  check('story increments 0.6W: 4 P labels = rows[k].Pfac = the published ASD 2,783 / 1,661 / 1,738 / 1,921 lb', Ps.length === 4
    && Ps.every((l, k) => l.k === `floors.${k}.walls.0.cases.wind.rows.${k}.Pfac` && Math.abs(l.v - [2783, 1661, 1738, 1921][k]) <= 0.05), Ps.map((l) => l.v).join(','));
  check('states C excludes dead-load relief; T includes 0.6D', /C = overturning compression \+ gravity on the end post, with no dead-load relief; T includes the 0\.6D/.test(e.svg), '');
  check('stamp LAYOUT ORDER ASSUMED (no opening positions)', e.svg.includes('LAYOUT ORDER ASSUMED') && e.layoutStamp === 'assumed', e.layoutStamp);
  check('hold-down and sill named on the base level', e.svg.includes('Hold-down: HDUE3-SDS3') && e.svg.includes('⅝&quot; anchor bolt @ 20.0&quot; o.c.'), '');
  const s = SWV.elevationSVG(res, def, { id: 'w1', caseKey: 'seismic' });
  check('seismic case names 0.7E', s.caseKey === 'seismic' && s.svg.includes('Seismic (0.7E)') && s.svg.includes('>0.7E '), '');
  const h = SWV.elevationSVG(res, def, { id: 'w1', pxW: 900, pxH: 1400 });
  sound('default elevation pxW 900 × pxH 1400', h.svg, res, null);
  check('pxW honoured', /viewBox="0 0 900 /.test(h.svg), h.svg.slice(0, 200));
  const miss = SWV.elevationSVG(res, def, { id: 'nope' });
  check('unknown wall id -> empty svg + warning', miss.svg === '' && /not in the model/.test(miss.warnings[0]), JSON.stringify(miss.warnings));
  const bad = clone(def); bad.floors[0].walls[0].L_ft = 0;
  const rb = SW.compute(bad), eb = SWV.elevationSVG(rb, bad, {});
  check('failed compute -> empty svg + warning', rb.ok === false && eb.svg === '' && eb.warnings.length === 1, JSON.stringify(eb.warnings));
}

// ── 2. segmented wall: per-segment T / C ────────────────────────────────────
function oneStory(o) {
  const w = SW.defaultWall({ id: o.id || 'S', label: o.label || 'S', L_ft: o.L, h_ft: o.h || 10, segments_ft: o.segs, openings: o.ops || [], sill: 'ab58', spacing: 20 });
  if (o.method) w.method = o.method;
  return { version: 2, sfrs: 'A.15', sdc: 'D', species: 'DFL', floors: [{ id: 1, name: 'Base', h_ft: o.h || 10, P_wind_lb: o.P / 0.6, P_seis_lb: o.P / 0.7, walls: [w] }] };
}
{
  const st = oneStory({ L: 22, segs: [8, 8, 4], ops: [{ w_ft: 2, hc_ft: 7 }], P: 4800, method: 'segmented' });
  const r = SW.compute(st);
  check('segmented [8, 8, 4] computes ok', r.ok === true, r.errors.join(' | '));
  for (const dirSign of [1, -1]) {
    const e = SWV.elevationSVG(r, st, { id: 'S', caseKey: 'seismic', dirSign });
    sound(`segmented elevation ${dirSign === 1 ? '→' : '←'}`, e.svg, r, null, st);
    const L = labels(e.svg), tEnd = dirSign === 1 ? 0 : 1, cEnd = 1 - tEnd;
    const Ts = L.filter((l) => l.q === 'T'), Cs = L.filter((l) => l.q === 'C');
    const segs = r.floors[0].walls[0].cases.seismic.segments;
    check(`segmented ${dirSign === 1 ? '→' : '←'}: 3 T + 3 C, each = segments[i].ends[${tEnd}].T / ends[${cEnd}].C`,
      Ts.length === 3 && Cs.length === 3 && Ts.every((l, i) => l.k === `floors.0.walls.0.cases.seismic.segments.${i}.ends.${tEnd}.T` && Math.abs(l.v - segs[i].ends[tEnd].T) <= 0.05)
      && Cs.every((l, i) => l.k === `floors.0.walls.0.cases.seismic.segments.${i}.ends.${cEnd}.C` && Math.abs(l.v - segs[i].ends[cEnd].C) <= 0.05), JSON.stringify(Ts.concat(Cs)));
  }
  const e = SWV.elevationSVG(r, st, { id: 'S' });
  check('segmented: v_eff label, × 2b/h tag on the 4 ft segment, no t row', e.svg.includes('v_eff = ') && e.svg.includes('× 2b/h (h/b ') && !labels(e.svg).some((l) => l.q === 't'), '');
  check('segmented: the 2 × 7 gap labelled from the input (state:), no A_o / h/3 outline', labels(e.svg).some((l) => l.q === 'w' && l.k === 'state:floors.0.walls.0.openings.0.w_ft' && l.v === 2) && !e.svg.includes('sw-h3'), '');
}

// ── 3. stacks: transfer gap, wall ending above the base ─────────────────────
{
  const st = { version: 2, sfrs: 'A.15', sdc: 'D', species: 'DFL', floors: [
    { id: 1, name: 'Roof', h_ft: 9, P_wind_lb: 1000 / 0.6, P_seis_lb: 1000 / 0.7, walls: [] },
    { id: 2, name: 'Mid', h_ft: 10, P_wind_lb: 1000 / 0.6, P_seis_lb: 1000 / 0.7, walls: [] },
    { id: 3, name: 'Base', h_ft: 11, P_wind_lb: 1000 / 0.6, P_seis_lb: 1000 / 0.7, walls: [] }] };
  const mk = (id, k, line, extra) => Object.assign(SW.defaultWall({ id, label: id, L_ft: 20, h_ft: st.floors[k].h_ft, segments_ft: [20], sill: k === 2 ? 'ab58' : 'sds14', spacing: k === 2 ? 20 : 12 }), { line }, extra || {});
  [0, 1, 2].forEach((k) => st.floors[k].walls.push(mk('A', k, 'A1')));
  st.floors[0].walls.push(mk('B', 0, 'A1'), mk('C', 0, 'C'));
  st.floors[2].walls.push(mk('C', 2, 'C', { transfer: true }));
  const r = SW.compute(st);
  check('stack model computes ok', r.ok === true, r.errors.join(' | '));
  const eb = SWV.elevationSVG(r, st, { id: 'B' });
  sound('stack B elevation', eb.svg, r, null);
  check('B (roof only, line A1 continues): 1 box, 2 ghosts, "shear is collected into line A1 … overturning stops"', count(eb.svg, /class="sw-box"/g) === 1 && count(eb.svg, /class="sw-ghost"/g) === 2 && eb.svg.includes('its shear is collected into line A1 and carried by the walls below; its overturning stops'), '');
  const ec = SWV.elevationSVG(r, st, { id: 'C' });
  sound('stack C elevation', ec.svg, r, null);
  check('C (transfer gap at Mid): 2 boxes, 1 ghost, transfer note; base group data-wi 1', count(ec.svg, /class="sw-box"/g) === 2 && count(ec.svg, /class="sw-ghost"/g) === 1 && ec.svg.includes('transfer declared on the wall below') && ec.svg.includes('data-wall="C" data-fi="2" data-wi="1"'), '');
  const ea = SWV.elevationSVG(r, st, { id: 'A' });
  sound('stack A elevation', ea.svg, r, null);
  check('A roof row carries the line share (A1 split with B at the roof)', labels(ea.svg).some((l) => l.q === 'share' && l.k === 'floors.0.walls.0.cases.wind.rows.0.share'), '');
  check('elevations of a one-segment opening-free wall carry no layout stamp', ea.layoutStamp === null && !ea.svg.includes('ASSUMED'), String(ea.layoutStamp));
}

// ── 4. opening positions: exact / partial / assumed stamps ──────────────────
{
  const exact = oneStory({ L: 30, segs: [10, 8, 6], ops: [{ w_ft: 3, hc_ft: 7, x_ft: 10 }, { w_ft: 3, hc_ft: 7, x_ft: 21 }], P: 3000 });
  const partial = oneStory({ L: 27, segs: [10, 10], ops: [{ w_ft: 4, hc_ft: 7, x_ft: 10 }, { w_ft: 3, hc_ft: 2 }], P: 3000 });
  const narrow = oneStory({ L: 30, segs: [10, 16], ops: [{ w_ft: 4, hc_ft: 7, x_ft: 12 }], P: 3000 });
  const re = SW.compute(exact), rp = SW.compute(partial), rn = SW.compute(narrow);
  const ee = SWV.elevationSVG(re, exact, {}), ep = SWV.elevationSVG(rp, partial, {}), en = SWV.elevationSVG(rn, narrow, {});
  sound('positioned (exact) elevation', ee.svg, re, null);
  sound('partial elevation', ep.svg, rp, null);
  sound('b-does-not-fit elevation', en.svg, rn, null);
  check('exact: no stamp; 3 segments, 2 openings drawn', ee.layoutStamp === null && !ee.svg.includes('ASSUMED') && count(ee.svg, /<rect class="sw-seg/g) === 3 && count(ee.svg, /<rect class="sw-open/g) === 2, String(ee.layoutStamp));
  check('partial: SOME OPENING POSITIONS ASSUMED; 2 ft opening floored to h/3 (dashed h/3 outline + label)', ep.layoutStamp === 'partial' && ep.svg.includes('SOME OPENING POSITIONS ASSUMED') && count(ep.svg, /class="sw-h3"/g) === 1 && labels(ep.svg).some((l) => l.q === 'hEff'), String(ep.layoutStamp));
  // Review: segmented [10, 8, 6] with one 3 × 7 opening at 10 ft in L 30 has 2
  // solid pieces for 3 segments — the calc has 3 hold-down pairs, so the
  // drawing must show 3 (segment 3 past End 2, red, with its T / C).
  const cnt = oneStory({ L: 30, segs: [10, 8, 6], ops: [{ w_ft: 3, hc_ft: 7, x_ft: 10 }], P: 3000, method: 'segmented' });
  const rc = SW.compute(cnt), ec = SWV.elevationSVG(rc, cnt, { caseKey: 'wind' });
  sound('segmented, 2 pieces for 3 segments', ec.svg, rc, null, cnt);
  const segRows = labels(ec.svg).filter((l) => l.q === 'T');
  check('2 pieces for 3 segments: 3 segments drawn (segment 3 sw-bad past End 2), 3 T / C labels = segments[i], "not placed" named, warning returned',
    rc.ok === true && count(ec.svg, /<rect class="sw-seg/g) === 3 && /<rect class="sw-seg sw-bad"/.test(ec.svg) && segRows.length === 3
    && segRows.every((l, i) => l.k === `floors.0.walls.0.cases.wind.segments.${i}.ends.0.T`) && ec.svg.includes('not placed — drawn past End 2') && ec.warnings.some((w) => /segment 3 drawn past End 2/.test(w)), JSON.stringify(ec.warnings));
  // Per-segment labels: one row each, never on one line (no overlap on narrow segments).
  const ys = [...ec.svg.matchAll(/<text class="sw-t sw-reactt[^"]*" x="[-0-9.]+" y="([-0-9.]+)"/g)].map((m) => Number(m[1]));
  check('per-segment T / C labels on 3 distinct rows, 11 px apart', ys.length === 3 && new Set(ys).size === 3 && Math.abs(ys[1] - ys[0] - 11) < 0.2 && Math.abs(ys[2] - ys[1] - 11) < 0.2, JSON.stringify(ys));
  // Pieces outside 0..L widen the drawn extent: nothing is drawn outside the viewBox.
  const neg = oneStory({ L: 30, segs: [10, 12], ops: [{ w_ft: 3, hc_ft: 7, x_ft: -2 }, { w_ft: 3, hc_ft: 7, x_ft: 28 }], P: 3000 });
  const rn2 = SW.compute(neg), en2 = SWV.elevationSVG(rn2, neg, {});
  const vb = en2.svg.match(/viewBox="0 0 ([0-9.]+) /), W = vb ? Number(vb[1]) : 0;
  const xs = [...en2.svg.matchAll(/<rect class="[^"]*" x="([-0-9.]+)" y="[-0-9.]+" width="([-0-9.]+)"/g)].map((m) => [Number(m[1]), Number(m[1]) + Number(m[2])]);
  sound('opening at x = −2 and one past L', en2.svg, rn2, null);
  check('opening at x = −2 ft and one running past L: every rect inside the drawing band (left margin 92 px … viewBox ' + W + ' − right margin 118 px)', rn2.ok === true && xs.length > 0 && xs.every((x) => x[0] >= 91.9 && x[1] <= W - 117.9) && en2.warnings.some((w) => /starts before End 1/.test(w)), JSON.stringify(xs));
  check('b does not fit: segment drawn sw-bad with a tag, warning returned', /class="sw-seg sw-bad"/.test(en.svg) && en.svg.includes('b does not fit') && en.warnings.some((w) => /b_i does not fit/.test(w)), JSON.stringify(en.warnings));
}

// ── 5. plan view ────────────────────────────────────────────────────────────
{
  const st = { version: 2, sfrs: 'A.15', sdc: 'D', species: 'DFL', plan: { B_ft: 100, D_ft: 50 }, floors: [
    { id: 1, name: 'Roof', h_ft: 10, P_wind_lb: 3000 / 0.6, P_seis_lb: 0, walls: [] },
    { id: 2, name: 'Base', h_ft: 10, P_wind_lb: 3000 / 0.6, P_seis_lb: 0, walls: [] }] };
  const mk = (id, k, o) => Object.assign(SW.defaultWall({ id, label: o.label || id, L_ft: o.L, h_ft: 10, segments_ft: [o.L], sill: k === 1 ? 'ab58' : 'sds14', spacing: k === 1 ? 20 : 12 }), o.x || {});
  [0, 1].forEach((k) => {
    st.floors[k].walls.push(mk('A', k, { L: 20, x: { line: 'A1', dir: 'X', loc_ft: 10, start_ft: 5, P_wind_lb: 10000 / 0.6 } }));
    st.floors[k].walls.push(mk('B', k, { L: 30, x: { line: 'A1', dir: 'X', loc_ft: 10, P_wind_lb: 10000 / 0.6 } }));
    st.floors[k].walls.push(mk('N', k, { L: 25, x: { dir: 'X', loc_ft: 50, start_ft: 0 } }));
    st.floors[k].walls.push(mk('W', k, { L: 50, x: { dir: 'Y', loc_ft: 0, start_ft: 0 } }));
    st.floors[k].walls.push(mk('C', k, { L: 10, label: '<b>&"C' }));
  });
  const r = SW.compute(st), plan = SW.planModel(st, r);
  check('plan model computes ok', r.ok === true && plan && plan.levels.length === 2, r.errors.join(' | '));
  for (const k of [0, 1]) {
    for (const ck of ['gov', 'wind']) {
      const p = SWV.planSVG(plan, k, { caseKey: ck, showEnds: true });
      sound(`plan level ${k} ${ck} (ends on)`, p.svg, r, plan);
      const lv = plan.levels[k];
      check(`plan level ${k} ${ck}: 4 located wall groups + 1 strip group, data-fi ${k}, data-wi 0..4`,
        count(p.svg, /class="sw-wall sw-pw /g) === 4 && count(p.svg, /class="sw-wall sw-strip /g) === 1 && ['A', 'B', 'N', 'W', 'C'].every((id, wi) => p.svg.includes(`data-wall="${id}" data-fi="${k}" data-wi="${wi}"`)), '');
      // Σ reads sum[ck] of the case the view drew; only walls whose line carries an entered force count.
      const pc = p.caseKey, sm = lv.sum[pc];
      const sumL = labels(p.svg).filter((l) => l.q === 'sumV')[0], VL = labels(p.svg).filter((l) => l.q === 'V');
      const entered = VL.filter((l) => { const wi = Number(l.k.split('.')[3]); return !lv.walls[wi].inherits[pc]; });
      const sumDrawn = entered.reduce((a, l) => a + l.v, 0);
      check(`plan level ${k} ${ck}: Σ label = sum.${pc}.sumV = Σ drawn V of the entered-force walls (A, B) = ${sm.sumV.toFixed(1)} lb; 3 inheriting walls named, not in Σ`,
        sumL && VL.length === 5 && entered.length === 2 && Math.abs(sumL.v - sumDrawn) <= 0.05 && Math.abs(sumL.v - sm.sumV) <= 0.05 && sm.nInherit === 3 && p.svg.includes('3 walls inherit the level force — not in Σ'), JSON.stringify(sumL) + ' ' + sumDrawn);
      check(`plan level ${k} ${ck}: line A1 chip = V_A + V_B, T/C at both ends of every located wall (8 T, 8 C)`,
        labels(p.svg).some((l) => l.q === 'Vline' && Math.abs(l.v - (lv.walls[0].cases.wind.V + lv.walls[1].cases.wind.V)) <= 0.05)
        && labels(p.svg).filter((l) => l.q === 'T').length === 8 && labels(p.svg).filter((l) => l.q === 'C').length === 8, '');
    }
  }
  const p0 = SWV.planSVG(plan, 1, {});
  check('plan: T/C markers off by default', !labels(p0.svg).some((l) => l.q === 'T' || l.q === 'C'), '');
  check('plan: centred wall B dotted + note; B × D label; N/S/E/W', /class="sw-wall sw-pw sw-(pass|fail) sw-centred"/.test(p0.svg) && p0.svg.includes('Dotted: no start_ft') && labels(p0.svg).some((l) => l.q === 'B' && l.v === 100) && ['>N<', '>S<', '>E<', '>W<'].every((s) => p0.svg.includes(s)), '');
  check('plan: text escaped (label <b>&"C)', p0.svg.includes('&lt;b&gt;&amp;&quot;C') && !p0.svg.includes('<b>'), '');
  check('plan: Y wall W drawn vertical (x1 = x2)', /data-wall="W"[^>]*><line class="sw-wline" x1="([0-9.]+)" y1="[0-9.]+" x2="\1"/.test(p0.svg), '');
  const pr = labels(p0.svg).find((l) => l.q === 'sumV');
  // Base: line A1 carries 10,000 + 10,000 = 20,000 lb (entered); N, W, C
  // inherit the level force and are left out -> Σ 20,000 lb vs level 6,000 lb:
  // a real mismatch (the entered line force exceeds the level), so red.
  check('plan base: Σ wall V = 20,000 lb (line A1 only) vs level 6,000 lb; header flagged', Math.abs(pr.v - 20000) <= 0.05 && Math.abs(plan.levels[1].sum.wind.Vlevel - 6000) <= 1e-6 && /sw-sub sw-sum-off/.test(p0.svg), JSON.stringify(pr));
  // Orientation, numerically: north up (loc 10 below loc 50 on screen), x = M + (start − ext.x0)·s, M 70, s = 620 px / 100 ft.
  const wl = (id) => { const m = p0.svg.match(new RegExp('data-wall="' + id + '"[^>]*><line class="sw-wline" x1="([-0-9.]+)" y1="([-0-9.]+)" x2="([-0-9.]+)" y2="([-0-9.]+)"')); return m ? m.slice(1).map(Number) : null; };
  const lA = wl('A'), lN = wl('N'), lW = wl('W'), s6 = 620 / 100;
  check('plan orientation: A (loc 10) pixel y > N (loc 50) pixel y; A x0 = 70 + (5 − 0)·6.2 = 101, x1 = 70 + 25·6.2 = 225; W (Y wall at x 0) vertical, End 1 (south) lower on screen',
    lA && lN && lW && lA[1] > lN[1] && Math.abs(lA[0] - (70 + 5 * s6)) <= 0.1 && Math.abs(lA[2] - (70 + 25 * s6)) <= 0.1 && Math.abs(lA[1] - (96 + (50 - 10) * s6)) <= 0.1 && lW[0] === lW[2] && Math.abs(lW[0] - 70) <= 0.1 && lW[1] > lW[3],
    JSON.stringify({ lA, lN, lW }));
  // Review input: one level P_W 5,000, two X walls at loc 0 / 10, blank line forces -> no false red.
  {
    const q = { version: 2, sfrs: 'A.15', sdc: 'D', species: 'DFL', floors: [{ id: 1, name: 'Base', h_ft: 10, P_wind_lb: 5000, P_seis_lb: 0, walls: [
      Object.assign(SW.defaultWall({ id: 'P', label: 'P', L_ft: 20, h_ft: 10, segments_ft: [20], sill: 'ab58', spacing: 20 }), { dir: 'X', loc_ft: 0 }),
      Object.assign(SW.defaultWall({ id: 'Q', label: 'Q', L_ft: 20, h_ft: 10, segments_ft: [20], sill: 'ab58', spacing: 20 }), { dir: 'X', loc_ft: 10 })] }] };
    const rq = SW.compute(q), pq = SW.planModel(q, rq), sq = SWV.planSVG(pq, 0, {});
    sound('plan, every wall inheriting', sq.svg, rq, pq);
    check('plan, both walls inherit P_W 5,000: no Σ label, "no Σ check", header not red', pq.levels[0].sum.wind.check === false && !labels(sq.svg).some((l) => l.q === 'sumV') && sq.svg.includes('no Σ check') && !sq.svg.includes('sw-sum-off'), sq.svg.slice(0, 600));
  }
  const nb = clone(st); delete nb.plan;
  const plan2 = SW.planModel(nb, SW.compute(nb)), p2 = SWV.planSVG(plan2, 0, {});
  sound('plan without B × D', p2.svg, SW.compute(nb), plan2);
  check('plan without B × D: extents from the walls, note shown', plan2.extents.source === 'walls' && p2.svg.includes('Building B × D not entered'), JSON.stringify(plan2.extents));
  check('planSVG on a missing level -> empty + warning', SWV.planSVG(plan, 9, {}).svg === '', '');
  const ee = SWV.elevationSVG(r, st, { id: 'C' });
  check('elevation: text escaped (label <b>&"C)', ee.svg.includes('&lt;b&gt;&amp;&quot;C') && !ee.svg.includes('<b>'), '');
}

// ── 6. Red Bluff import (26-038): 3 levels × 25 X walls ─────────────────────
{
  const FX = fileURLToPath(new URL('../fixtures/lateral/red-bluff/', import.meta.url));
  const load = (f) => JSON.parse(readFileSync(FX + f, 'utf8'));
  const lv = ['diaphragm-roof-state.json', 'diaphragm-3rd-state.json', 'diaphragm-2nd-state.json'].map((f) => LH.levelFromDiaphragmState(load(f)));
  const asm = LH.assemble([lv[2], lv[0], lv[1]], { files: ['a - 2ND.html', 'a - ROOF.html', 'a - 3RD.html'] });
  const st = LH.toShearwallState(asm.record, { dir: 'X' });
  st.plan = { B_ft: asm.record.geometry.B_ft, D_ft: asm.record.geometry.D_ft };
  const r = SW.compute(st), plan = SW.planModel(st, r);
  check('Red Bluff X computes ok; 3 levels × 25 walls in the plan model', r.ok === true && plan.levels.every((l) => l.walls.length === 25), r.errors.slice(0, 3).join(' | '));
  const t0 = Date.now();
  let allOk = true, detail = '';
  for (let k = 0; k < 3; k++) {
    const p = SWV.planSVG(plan, k, { showEnds: true });
    const mm = mismatches(p.svg, r, plan);
    if (!(viewBoxOk(p.svg) && clean(p.svg) && mm.length === 0 && count(p.svg, /class="sw-wall sw-pw /g) === 25)) { allOk = false; detail += `level ${k}: ${mm.slice(0, 3).join(' | ')} `; }
  }
  r.stackIds.forEach((id) => {
    const e = SWV.elevationSVG(r, st, { id });
    const mm = mismatches(e.svg, r, null);
    if (!(viewBoxOk(e.svg) && clean(e.svg) && mm.length === 0)) { allOk = false; detail += `${id}: ${mm.slice(0, 3).join(' | ')} `; }
  });
  const ms = Date.now() - t0;
  check(`Red Bluff: 3 plans + ${r.stackIds.length} elevations sound, every label = engine (${ms} ms)`, allOk, detail);
  const x15 = r.stackIds.find((id) => id === 'X@15');
  const e15 = SWV.elevationSVG(r, st, { id: x15 });
  const bV = labels(e15.svg).filter((l) => l.q === 'V' && l.k.startsWith('floors.2.'))[0];
  check('Red Bluff X@15 base V label = 7,459.8 lb (plan Phase 4 number, unchanged)', bV && Math.abs(bV.v - 7459.8) <= 0.05, JSON.stringify(bV));
  const pr = plan.levels[2].sum.wind;
  check('Red Bluff base Σ wall V (signed) = 0.6 × Σ level forces within 1 %', Math.abs(pr.sumV - pr.Vlevel) <= 0.01 * pr.Vlevel, `${pr.sumV} vs ${pr.Vlevel}`);
}

if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
