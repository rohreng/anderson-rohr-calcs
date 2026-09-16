// =============================================================================
// Lateral handoff — are.lateral.v1 builder / parser test (pure node, no browser)
// -----------------------------------------------------------------------------
// Requires the three DOM-free engines (RD, LH, SW) and runs them against the
// Red Bluff fixtures in fixtures/lateral/red-bluff/:
//   mwfrs-record.json          expected MWFRS-stage record (Roof / 3RD / 2ND)
//   diaphragm-roof-state.json  Nick's ROOF file are-state (legacy gapped row
//                              keys + authoritative #swJSON, no #mwfrsJSON)
//   diaphragm-3rd-state.json   synthesized: #level 3RD, #mwfrsJSON, #loadLevel
//   diaphragm-2nd-state.json   synthesized: #level 2ND, #mwfrsJSON, #loadLevel
//   expected.json              strength-level reaction goldens per line
// Proves: the parser accepts both snapshot shapes, reactions match the goldens
// to +/-1 lb, assembly orders levels by the story table, the shearwall state it
// builds validates and computes the stacked line force, and every validation
// rule in the plan (Decision B) fires where it should.
// Usage: node tools/test-lateral-handoff.mjs
// =============================================================================
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RD = require('../public/Calcs/engines/rect-diaphragm.js');
const LH = require('../public/Calcs/engines/lateral-handoff.js');
const SW = require('../public/Calcs/engines/stacked-shearwall.js');

const FX = fileURLToPath(new URL('../fixtures/lateral/red-bluff/', import.meta.url));
const load = (f) => JSON.parse(readFileSync(FX + f, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const roofState = load('diaphragm-roof-state.json');
const thirdState = load('diaphragm-3rd-state.json');
const secondState = load('diaphragm-2nd-state.json');
const mwfrsRecord = load('mwfrs-record.json');
const expected = load('expected.json');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
function throwsWith(fn, re) {
  try { fn(); return { threw: false, msg: '(no throw)' }; }
  catch (e) { return { threw: re.test(String(e && e.message || e)), msg: String(e && e.message || e) }; }
}
const within = (got, want, tol) => got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) <= tol);
const sum = (a) => a.reduce((s, v) => s + v, 0);
const has = (list, re) => list.some((s) => re.test(s));

// ── 0. engines load ─────────────────────────────────────────────────────────
check('RD engine loads (rect-diaphragm v1)', RD && RD.ENGINE && RD.ENGINE.name === 'rect-diaphragm' && RD.ENGINE.version === 1, JSON.stringify(RD && RD.ENGINE));
check('LH engine tag', LH.ENGINE && LH.ENGINE.name === 'lateral-handoff' && LH.ENGINE.version === 1, JSON.stringify(LH.ENGINE));
check('LH constants', LH.SCHEMA === 'are.lateral.v1' && LH.WIND_FACTOR === 0.6 && LH.SEIS_FACTOR === 0.7 && LH.LOC_TOL_FT === 0.5,
  JSON.stringify([LH.SCHEMA, LH.WIND_FACTOR, LH.SEIS_FACTOR, LH.LOC_TOL_FT]));
check('wallId rounds to 0.1 ft, trailing-zero free', LH.wallId('X', 15) === 'X@15' && LH.wallId('Y', 45.26) === 'Y@45.3' && LH.wallId('X', 0) === 'X@0' && LH.wallId('X', 360.04) === 'X@360',
  [LH.wallId('X', 15), LH.wallId('Y', 45.26), LH.wallId('X', 0), LH.wallId('X', 360.04)].join(' '));

// ── 1. RD.checkSwLocs / RD.analyze ──────────────────────────────────────────
const dup = RD.checkSwLocs([{ label: 'a', len: 10, loc: 0 }, { label: 'b', len: 10, loc: 60 }, { label: 'c', len: 10, loc: 60 }]);
check('RD.checkSwLocs reports the duplicate location', dup.ok === false && dup.dupes.length === 1 && dup.dupes[0] === 60, JSON.stringify(dup));
check('RD.checkSwLocs ok on distinct locations', RD.checkSwLocs([{ loc: 0 }, { loc: 60 }]).ok === true && RD.checkSwLocs([{ loc: 5 }]).ok === true, '');
const roofRows = JSON.parse(roofState.fields['#swJSON']);
const an = RD.analyze({ B: 120, D: 360, Vx: 131.31, Vy: 40.86, Vx_s: 0, Vy_s: 0, swX: roofRows.X, swY: roofRows.Y });
check('RD.analyze: wx spans D with X rows, wy spans B with Y rows, seismic null at 0',
  an.wx.L_along === 360 && an.wx.B_perp === 120 && an.wx.sws.length === 25 && an.wy.L_along === 120 && an.wy.B_perp === 360 && an.wy.sws.length === 5 && an.sx === null && an.sy === null,
  JSON.stringify({ wxL: an.wx.L_along, wxB: an.wx.B_perp, wyL: an.wy.L_along, wyB: an.wy.B_perp, sx: an.sx, sy: an.sy }));
const anS = RD.analyze({ B: 120, D: 360, Vx: 131.31, Vy: 40.86, Vx_s: 50, Vy_s: 0, swX: roofRows.X, swY: roofRows.Y });
check('RD.analyze: seismic-X computed when Vx_s > 0', anS.sx && anS.sx.V === 50 && anS.sy === null, JSON.stringify({ sx: anS.sx && anS.sx.V, sy: anS.sy }));

// ── 2. fromMwfrs ────────────────────────────────────────────────────────────
// Synthetic MWFRS rows: F_net / V_cum as the page prints them (the page sums
// unrounded F_net, so V_cum is carried, not re-summed: 131315.4 + 79782.6 = 211098).
function mwRows(F, V, par) {
  return F.map((f, i) => ({ label: ['Roof', '3RD', '2ND'][i], F_net: f, F_parapet: i === 0 ? par : 0, V_cum: V[i] }));
}
const fm = LH.fromMwfrs({
  B: 120, D: 360, h: 35.5, hp: 4.5,
  stories: [{ label: 'Roof', sh: '11' }, { label: '3RD', sh: '10.5' }, { label: '2ND', sh: '14' }],
  wx: { rows: mwRows([131315, 79782, 87306], [131315, 211098, 298403], 87160) }, wy: { rows: mwRows([40861, 20904, 22618], [40861, 61765, 84383], 29053) },
  project: '', meta: mwfrsRecord.source.mwfrs
});
check('fromMwfrs produces the expected MWFRS-stage record', JSON.stringify(fm) === JSON.stringify(mwfrsRecord), JSON.stringify(fm).slice(0, 400));
check('fromMwfrs record has no walls', fm.levels.every((l) => !('walls' in l)), '');

// ── 3. levelFromDiaphragmState — ROOF (legacy shape) ────────────────────────
const gold = (label) => expected.levels[label];
const roofRes = LH.levelFromDiaphragmState(roofState);
const rx = roofRes.level.walls.X.map((w) => w.R_wind_strength_lb), ry = roofRes.level.walls.Y.map((w) => w.R_wind_strength_lb);
check('ROOF: parser accepts the legacy file (gapped #sw*_* keys, #swJSON authoritative)', roofRes.level.label === 'Roof' && roofRes.level.walls.X.length === 25 && roofRes.level.walls.Y.length === 5,
  JSON.stringify({ X: roofRes.level.walls.X.length, Y: roofRes.level.walls.Y.length }));
check('ROOF: Wind-X reactions A1/A25 2,736, A2..A24 5,471 (+/-1 lb)', within(rx, gold('Roof').X, 1), rx.join(' '));
check('ROOF: Wind-Y reactions AA 5,107 / AC,BB,DB 10,215 / BD 5,107 (+/-1 lb)', within(ry, gold('Roof').Y, 1), ry.join(' '));
check('ROOF: F_wind_* = round(#V x 1000)', roofRes.level.F_wind_x_strength_lb === 131310 && roofRes.level.F_wind_y_strength_lb === 40860,
  JSON.stringify([roofRes.level.F_wind_x_strength_lb, roofRes.level.F_wind_y_strength_lb]));
check('ROOF: seismic 0, wall ids by loc, labels carried', roofRes.level.F_seis_x_strength_lb === 0 && roofRes.level.walls.X[1].id === 'X@15' && roofRes.level.walls.X[1].label === 'A2' && roofRes.level.walls.Y[3].id === 'Y@90' && roofRes.level.walls.X.every((w) => w.R_seis_strength_lb === 0),
  JSON.stringify(roofRes.level.walls.X[1]));
check('ROOF: no story table, loadLevel defaulted with a warning', roofRes.storyTable === null && has(roofRes.warnings, /loadLevel|load level/i), JSON.stringify(roofRes.warnings));
check('ROOF: B_ft/D_ft/project on the result', roofRes.B_ft === 120 && roofRes.D_ft === 360 && roofRes.project === '', JSON.stringify([roofRes.B_ft, roofRes.D_ft, roofRes.project]));
check('ROOF: sum R per direction = F within 0.1 %', Math.abs(sum(rx) - 131310) <= 131.31 && Math.abs(sum(ry) - 40860) <= 40.86, `${sum(rx)} ${sum(ry)}`);

// pre-Phase-0 shape: only #sw*_* keys (gap at n = 24) — reconstruct rows
const legacy = clone(roofState); delete legacy.fields['#swJSON'];
const legRes = LH.levelFromDiaphragmState(legacy);
check('pre-Phase-0 file: rows reconstructed from gapped #sw*_* keys (25 X + 5 Y, sorted by n)',
  legRes.level.walls.X.length === 25 && legRes.level.walls.Y.length === 5 && legRes.level.walls.X[24].label === 'A25' && legRes.level.walls.X[24].loc_ft === 360,
  JSON.stringify({ X: legRes.level.walls.X.length, last: legRes.level.walls.X[24] }));
check('pre-Phase-0 file: same reactions as the #swJSON path', JSON.stringify(legRes.level.walls) === JSON.stringify(roofRes.level.walls), '');

// ── 4. 3RD / 2ND with story table ───────────────────────────────────────────
const thirdRes = LH.levelFromDiaphragmState(thirdState);
const secondRes = LH.levelFromDiaphragmState(secondState);
[['3RD', thirdRes], ['2ND', secondRes]].forEach(([lab, r]) => {
  const x = r.level.walls.X.map((w) => w.R_wind_strength_lb), y = r.level.walls.Y.map((w) => w.R_wind_strength_lb);
  check(`${lab}: Wind-X reactions ends ${gold(lab).X[0]} / interior ${gold(lab).X[1]} (+/-1 lb)`, within(x, gold(lab).X, 1), x.join(' '));
  check(`${lab}: Wind-Y reactions ends ${gold(lab).Y[0]} / interior ${gold(lab).Y[1]} (+/-1 lb)`, within(y, gold(lab).Y, 1), y.join(' '));
  check(`${lab}: story table parsed from #mwfrsJSON, no loadLevel warning, no force warning`, r.storyTable && r.storyTable.levels.length === 3 && r.warnings.length === 0, JSON.stringify(r.warnings));
  check(`${lab}: sum R = F within 0.1 %`, Math.abs(sum(x) - r.level.F_wind_x_strength_lb) <= r.level.F_wind_x_strength_lb / 1000 && Math.abs(sum(y) - r.level.F_wind_y_strength_lb) <= r.level.F_wind_y_strength_lb / 1000, `${sum(x)} vs ${r.level.F_wind_x_strength_lb}`);
});

// ── 5. assemble — mixed: ROOF without table + 3RD/2ND with it ───────────────
const files = ['26-038-HNR - Red Bluff Hotel - Rectangular Diaphragm Designer - ROOF LEVEL - 2026-09-15.html', 'x - 3RD.html', 'x - 2ND.html'];
const asm = LH.assemble([secondRes, roofRes, thirdRes], { files: [files[2], files[0], files[1]] });
check('assemble: no errors', asm.errors.length === 0 && asm.record, JSON.stringify(asm.errors));
const rec = asm.record;
check('assemble: ordering follows the story table found in 3RD (Roof, 3RD, 2ND), index 0..2', rec.levels.map((l) => l.label).join(',') === 'Roof,3RD,2ND' && rec.levels.map((l) => l.index).join(',') === '0,1,2',
  rec.levels.map((l) => l.label + ':' + l.index).join(' '));
check('assemble: sh_ft 11 / 10.5 / 14 from the table', rec.levels.map((l) => l.sh_ft).join(',') === '11,10.5,14', rec.levels.map((l) => l.sh_ft).join(','));
check('assemble: schema / loadLevel / geometry / files', rec.schema === 'are.lateral.v1' && rec.loadLevel === 'strength' && rec.geometry.B_ft === 120 && rec.geometry.D_ft === 360 && rec.geometry.h_ft === 35.5 && rec.geometry.hp_ft === 4.5 && rec.source.files.length === 3 && rec.source.files[0] === files[2],
  JSON.stringify({ g: rec.geometry, f: rec.source.files }));
check('assemble: levels carry walls in both directions', rec.levels.every((l) => l.walls.X.length === 25 && l.walls.Y.length === 5), '');
check('assemble: V_cum recomputed top -> bottom', rec.levels[2].V_cum_x_strength_lb === 131310 + 79780 + 87310, String(rec.levels[2].V_cum_x_strength_lb));
check('assemble: roof warnings carried (loadLevel default)', has(asm.warnings, /loadLevel|load level/i), JSON.stringify(asm.warnings));

// ── 6. toShearwallState dir X ───────────────────────────────────────────────
const swX = LH.toShearwallState(rec, { dir: 'X', sfrs: 'A.15', sdc: 'D', species: 'DFL', files: files });
// Wall labels and floor names go through the adapter's stringPattern strip (< > control chars, <= 120).
{
  const dirty = JSON.parse(JSON.stringify(rec));
  dirty.levels[0].walls.X[0].label = 'A<2>';
  dirty.levels[0].label = 'R\u0001oof<b>';
  const sw = LH.toShearwallState(dirty, { dir: 'X' });
  check('toShearwallState strips < > and control chars from wall labels and floor names', sw.floors[0].walls[0].label === 'A2' && sw.floors[0].name === 'Roofb', JSON.stringify([sw.floors[0].walls[0].label, sw.floors[0].name]));
}
check('toShearwallState X: version 2, 3 floors, 25 walls each', swX.version === 2 && swX.floors.length === 3 && swX.floors.every((f) => f.walls.length === 25), JSON.stringify(swX.floors.map((f) => f.walls.length)));
check('toShearwallState X: h_ft 11 / 10.5 / 14, names Roof/3RD/2ND, ids 1..3', swX.floors.map((f) => f.h_ft).join(',') === '11,10.5,14' && swX.floors.map((f) => f.name).join(',') === 'Roof,3RD,2ND' && swX.floors.map((f) => f.id).join(',') === '1,2,3',
  JSON.stringify(swX.floors.map((f) => [f.id, f.name, f.h_ft])));
check('toShearwallState X: floor P_wind_lb = F_wind_x, P_seis_lb = 0', swX.floors.map((f) => f.P_wind_lb).join(',') === '131310,79780,87310' && swX.floors.every((f) => f.P_seis_lb === 0), swX.floors.map((f) => f.P_wind_lb).join(','));
const allWalls = swX.floors.flatMap((f) => f.walls);
check('toShearwallState X: every wall numeric P_wind_lb, P_seis_lb === 0, dir X, loc_ft, L_ft = segment', allWalls.every((w) => typeof w.P_wind_lb === 'number' && isFinite(w.P_wind_lb) && w.P_seis_lb === 0 && w.dir === 'X' && typeof w.loc_ft === 'number' && w.segments_ft.length === 1 && w.segments_ft[0] === w.L_ft && typeof w.h_ft === 'number'),
  JSON.stringify(allWalls[0]));
check('toShearwallState X: wall P_wind_lb = line reaction (Roof A2 5,471; 2ND A1 1,819)', swX.floors[0].walls[1].P_wind_lb === 5471 && swX.floors[2].walls[0].P_wind_lb === 1819, JSON.stringify([swX.floors[0].walls[1].P_wind_lb, swX.floors[2].walls[0].P_wind_lb]));
check('toShearwallState X: base sill ab58 @ 20, others sds14 @ 12', swX.floors[2].walls.every((w) => w.sill.conn === 'ab58' && w.sill.spacing_in === 20) && swX.floors.slice(0, 2).every((f) => f.walls.every((w) => w.sill.conn === 'sds14' && w.sill.spacing_in === 12)),
  JSON.stringify([swX.floors[0].walls[0].sill, swX.floors[2].walls[0].sill]));
check('toShearwallState X: no typ / no merge — 25 distinct ids per floor', swX.floors.every((f) => new Set(f.walls.map((w) => w.id)).size === 25 && f.walls.every((w) => !('typ' in w))), '');
check('toShearwallState X: lateral provenance', swX.lateral && swX.lateral.schema === 'are.lateral.v1' && swX.lateral.dir === 'X' && Array.isArray(swX.lateral.files) && swX.lateral.files.length === 3 && typeof swX.lateral.importedAt === 'string' && swX.sfrs === 'A.15' && swX.sdc === 'D' && swX.species === 'DFL',
  JSON.stringify(swX.lateral));
check('toShearwallState X: file names are basenames <= 120 chars without < >', swX.lateral.files.every((f) => f.length <= 120 && !/[<>\\/]/.test(f)), JSON.stringify(swX.lateral.files));
const vX = SW.validate(swX);
check('SW.validate ok on the X state', vX.ok === true, JSON.stringify(vX.errors));
const cX = SW.compute(swX);
const base15 = cX.floors[2].walls.filter((w) => w.id === 'X@15')[0];
check('SW.compute base X@15 wind Vstrength = 5,471 + 3,324 + 3,638 = 12,433 (+/-2)', base15 && Math.abs(base15.cases.wind.Vstrength - expected.base_X15.Vstrength) <= 2, base15 && String(base15.cases.wind.Vstrength));
check('SW.compute base X@15 wind V = 7,460 (0.6W, +/-2)', base15 && Math.abs(base15.cases.wind.V - expected.base_X15.V) <= 2, base15 && String(base15.cases.wind.V));
check('SW.compute base X@15 rows all src wall', base15 && base15.cases.wind.rows.every((r) => r.src === 'wall'), base15 && JSON.stringify(base15.cases.wind.rows.map((r) => r.src)));

// dir Y
const swY = LH.toShearwallState(rec, { dir: 'Y' });
check('toShearwallState Y: 5 walls per floor, lateral.dir Y, floor P_wind_lb = F_wind_y', swY.floors.every((f) => f.walls.length === 5) && swY.lateral.dir === 'Y' && swY.floors[0].P_wind_lb === 40860 && swY.floors[0].walls[1].P_wind_lb === 10215,
  JSON.stringify(swY.floors.map((f) => [f.walls.length, f.P_wind_lb])));
check('SW.validate ok on the Y state', SW.validate(swY).ok === true, JSON.stringify(SW.validate(swY).errors));
const bad = throwsWith(() => LH.toShearwallState(rec, { dir: 'Z' }), /dir/i);
check('toShearwallState rejects dir Z', bad.threw, bad.msg);

// ── 7. summarize ────────────────────────────────────────────────────────────
const lines = LH.summarize(rec, asm.warnings);
check('summarize: one line per level + warnings', lines.length === 3 + asm.warnings.length && /^Roof — h 11 ft — Wind-X 131,310 lb over 25 lines \(Σ 131,3\d\d\) — Wind-Y 40,860 lb over 5 lines \(Σ 40,8\d\d\)$/.test(lines[0]), JSON.stringify(lines));
check('summarize: MWFRS-stage record (no walls) summarizes', LH.summarize(mwfrsRecord).length === 3 && /Roof — h 11 ft — Wind-X 131,315 lb — Wind-Y 40,861 lb/.test(LH.summarize(mwfrsRecord)[0]), JSON.stringify(LH.summarize(mwfrsRecord)));

// ── 8. asd load level converts ÷0.6 wind, ÷0.7 seismic ─────────────────────
const asdState = clone(thirdState);
asdState.fields['#loadLevel'] = 'asd'; asdState.fields['#Vx'] = '47.868'; asdState.fields['#Vy'] = '12.54'; asdState.fields['#Vx_s'] = '35'; asdState.fields['#Vy_s'] = '0';
const asdRes = LH.levelFromDiaphragmState(asdState);
check('asd: F_wind_x = 47.868 / 0.6 = 79,780; F_seis_x = 35 / 0.7 = 50,000', asdRes.level.F_wind_x_strength_lb === 79780 && asdRes.level.F_seis_x_strength_lb === 50000 && asdRes.level.F_wind_y_strength_lb === 20900,
  JSON.stringify([asdRes.level.F_wind_x_strength_lb, asdRes.level.F_seis_x_strength_lb, asdRes.level.F_wind_y_strength_lb]));
check('asd: reactions converted (interior X 3,324 wind; 50,000/24 = 2,083 seismic)', Math.abs(asdRes.level.walls.X[1].R_wind_strength_lb - 3324) <= 1 && Math.abs(asdRes.level.walls.X[1].R_seis_strength_lb - 50000 / 24) <= 1,
  JSON.stringify(asdRes.level.walls.X[1]));
check('asd: seismic-Y stays 0 when #Vy_s is 0', asdRes.level.F_seis_y_strength_lb === 0 && asdRes.level.walls.Y.every((w) => w.R_seis_strength_lb === 0), '');
const badLL = throwsWith(() => { const s = clone(thirdState); s.fields['#loadLevel'] = 'lrfd'; LH.levelFromDiaphragmState(s); }, /loadLevel/i);
check('unknown #loadLevel throws', badLL.threw, badLL.msg);

// ── 9. validation rules ─────────────────────────────────────────────────────
// B/D mismatch
const bdState = clone(secondState); bdState.fields['#B'] = '121';
const bdAsm = LH.assemble([roofRes, thirdRes, LH.levelFromDiaphragmState(bdState)]);
check('B/D mismatch across files -> error, no record', bdAsm.errors.length > 0 && has(bdAsm.errors, /B_ft|B =|B\b/) && bdAsm.record === null, JSON.stringify(bdAsm.errors));
// missing level
const missAsm = LH.assemble([roofRes, secondRes]);
check('missing level (table has 3RD, files Roof + 2ND) -> warning, 2 levels', missAsm.errors.length === 0 && has(missAsm.warnings, /3RD not imported/) && missAsm.record.levels.length === 2 && missAsm.record.levels[1].sh_ft === 14,
  JSON.stringify(missAsm.warnings));
// file whose label is not in the table
const strayState = clone(secondState); strayState.fields['#level'] = 'MEZZ';
const strayAsm = LH.assemble([roofRes, thirdRes, LH.levelFromDiaphragmState(strayState)]);
check('file label not in the story table -> error', has(strayAsm.errors, /MEZZ/), JSON.stringify(strayAsm.errors));
// duplicate labels
const dupAsm = LH.assemble([roofRes, thirdRes, LH.levelFromDiaphragmState(clone(thirdState))]);
check('duplicate level labels -> error', has(dupAsm.errors, /duplicate/i), JSON.stringify(dupAsm.errors));
// project mismatch -> warning; record.project = first non-blank
const projA = clone(thirdState); projA.project = '26-038-HNR - Red Bluff Hotel';
const projB = clone(secondState); projB.project = '26-999-XYZ';
const projAsm = LH.assemble([roofRes, LH.levelFromDiaphragmState(projA), LH.levelFromDiaphragmState(projB)]);
check('project mismatch -> warning only, record.project = first non-blank', projAsm.errors.length === 0 && has(projAsm.warnings, /26-999-XYZ/) && projAsm.record.project === '26-038-HNR - Red Bluff Hotel', JSON.stringify(projAsm.warnings));
// wall present at 3RD only starts there
const extraState = clone(thirdState);
{ const rows = JSON.parse(extraState.fields['#swJSON']); rows.X.push({ label: 'A99', len: 12, loc: 52 }); extraState.fields['#swJSON'] = JSON.stringify(rows); }
const extraRes = LH.levelFromDiaphragmState(extraState);
const extraAsm = LH.assemble([roofRes, extraRes, secondRes]);
const extraSW = LH.toShearwallState(extraAsm.record, { dir: 'X' });
check('wall present at 3RD only: 26 walls at 3RD, 25 elsewhere, SW.validate ok', extraSW.floors.map((f) => f.walls.length).join(',') === '25,26,25' && SW.validate(extraSW).ok === true, JSON.stringify(SW.validate(extraSW).errors));
// label-only difference does not split a line
const renState = clone(thirdState);
{ const rows = JSON.parse(renState.fields['#swJSON']); rows.X[1].label = 'A2x'; renState.fields['#swJSON'] = JSON.stringify(rows); }
const renAsm = LH.assemble([roofRes, LH.levelFromDiaphragmState(renState), secondRes]);
check('label-only difference (A2 -> A2x at 3RD, same loc) keeps id X@15', renAsm.record.levels[1].walls.X[1].id === 'X@15' && renAsm.record.levels[1].walls.X[1].label === 'A2x' && renAsm.record.levels[0].walls.X[1].id === 'X@15', JSON.stringify(renAsm.record.levels[1].walls.X[1]));
// loc within tolerance unifies to one id across levels
const tolState = clone(thirdState);
{ const rows = JSON.parse(tolState.fields['#swJSON']); rows.X[1].loc = 15.3; tolState.fields['#swJSON'] = JSON.stringify(rows); }
const tolAsm = LH.assemble([roofRes, LH.levelFromDiaphragmState(tolState), secondRes]);
check('loc 15.3 at 3RD vs 15 elsewhere (within 0.5 ft) -> same id X@15', tolAsm.record.levels[1].walls.X[1].id === 'X@15' && tolAsm.record.levels[1].walls.X[1].loc_ft === 15.3, JSON.stringify(tolAsm.record.levels[1].walls.X[1]));
check('nonzero-distance stacking is reported', has(tolAsm.warnings, /3RD "A2" at 15\.3 ft stacked on X@15/), JSON.stringify(tolAsm.warnings));
check('exact-loc stacking is silent', !has(asm.warnings, /stacked on/), JSON.stringify(asm.warnings));
// two lines on ONE level within LOC_TOL_FT -> parser refuses (they would stack as one line)
const nearDup = throwsWith(() => { const s2 = clone(thirdState); const r = JSON.parse(s2.fields['#swJSON']); r.X.push({ label: 'A2b', len: 20, loc: 15.4 }); s2.fields['#swJSON'] = JSON.stringify(r); LH.levelFromDiaphragmState(s2); }, /"A2" \(15 ft\) and "A2b" \(15\.4 ft\) are within 0\.5 ft/);
check('two lines on one level 15 / 15.4 ft -> throws (would stack as one line)', nearDup.threw, nearDup.msg);
const nearDup2 = throwsWith(() => { const s2 = clone(thirdState); const r = JSON.parse(s2.fields['#swJSON']); r.X[1].loc = 15.02; r.X.push({ label: 'A2b', len: 20, loc: 15.04 }); s2.fields['#swJSON'] = JSON.stringify(r); LH.levelFromDiaphragmState(s2); }, /within 0\.5 ft/);
check('two lines on one level 15.02 / 15.04 ft (same wallId) -> throws', nearDup2.threw, nearDup2.msg);
// unifyIds itself refuses a hand-built level whose walls resolve to one id
const handRes = clone(thirdRes); handRes.level.walls.X.push({ id: 'X@15.4', label: 'A2b', L_ft: 20, loc_ft: 15.4, R_wind_strength_lb: 1, R_seis_strength_lb: 0 });
const handAsm = LH.assemble([roofRes, handRes, secondRes]);
check('assemble: two walls on one level resolving to one id -> error, no record', has(handAsm.errors, /"A2" and "A2b" both resolve to X@15/) && handAsm.record === null, JSON.stringify(handAsm.errors));
// a second file carrying a DIFFERENT story table -> warning naming the file used
const altTable = clone(mwfrsRecord); altTable.levels[1].sh_ft = 12;
const altState = clone(secondState); altState.fields['#mwfrsJSON'] = JSON.stringify(altTable);
const altAsm = LH.assemble([roofRes, thirdRes, LH.levelFromDiaphragmState(altState)], { files: ['roof.html', 'third.html', 'second.html'] });
check('story tables disagree across files -> warning names the file used and the difference', altAsm.errors.length === 0 && has(altAsm.warnings, /Story table in second\.html differs from the one used \(third\.html\): 3RD sh_ft 12 vs 10\.5/) && altAsm.record.levels[1].sh_ft === 10.5, JSON.stringify(altAsm.warnings));
check('story tables agree -> no table warning', !has(asm.warnings, /Story table in/), JSON.stringify(asm.warnings));
// malformed embedded JSON
const badMw = clone(thirdState); badMw.fields['#mwfrsJSON'] = '{not json';
const badMwRes = LH.levelFromDiaphragmState(badMw);
check('invalid #mwfrsJSON -> warning, storyTable null, level still parsed', badMwRes.storyTable === null && has(badMwRes.warnings, /#mwfrsJSON/) && badMwRes.level.walls.X.length === 25, JSON.stringify(badMwRes.warnings));
const badSw = throwsWith(() => { const s2 = clone(thirdState); s2.fields['#swJSON'] = '{not json'; LH.levelFromDiaphragmState(s2); }, /#swJSON/);
check('invalid #swJSON -> throws', badSw.threw, badSw.msg);
// negative reaction: 2 lines at 0 and 20 of L = 120 -> R2 = 360w, R1 = -240w
const negState = clone(roofState);
negState.fields['#swJSON'] = JSON.stringify({ X: [{ label: 'N1', len: 20, loc: 0 }, { label: 'N2', len: 20, loc: 20 }], Y: roofRows.Y });
negState.fields['#Vx'] = '120'; negState.fields['#B'] = '120'; negState.fields['#D'] = '120';
const negRes = LH.levelFromDiaphragmState(negState);
const n1 = negRes.level.walls.X[0], n2 = negRes.level.walls.X[1];
check('negative reaction: |R1| = 240,000 with sign -1, R2 = 360,000, warning names N1', n1.R_wind_strength_lb === 240000 && n1.sign === -1 && n2.R_wind_strength_lb === 360000 && n2.sign === undefined && has(negRes.warnings, /N1/),
  JSON.stringify({ n1, n2, w: negRes.warnings }));
const negSW = LH.toShearwallState(LH.assemble([negRes], { heights: [11] }).record, { dir: 'X' }).floors[0].walls;
check('negative reaction: sign -1 carried onto the SW wall, absent otherwise', negSW[0].sign === -1 && !('sign' in negSW[1]), JSON.stringify(negSW.map((w) => w.sign)));
// no story table anywhere + no heights -> sh_ft null, toShearwallState throws; with heights -> works
const noTab = LH.assemble([roofRes, LH.levelFromDiaphragmState((() => { const s = clone(thirdState); delete s.fields['#mwfrsJSON']; return s; })())]);
check('no story table: input order, sh_ft null, heights warning', noTab.errors.length === 0 && noTab.record.levels.every((l) => l.sh_ft === null) && has(noTab.warnings, /no story table/i) && noTab.record.geometry.h_ft === null,
  JSON.stringify(noTab.warnings));
const noTabThrow = throwsWith(() => LH.toShearwallState(noTab.record, { dir: 'X' }), /height/i);
check('no story table + no heights: toShearwallState throws', noTabThrow.threw, noTabThrow.msg);
const withH = LH.assemble([roofRes, LH.levelFromDiaphragmState((() => { const s = clone(thirdState); delete s.fields['#mwfrsJSON']; return s; })())], { heights: [11, '10.5'] });
check('no story table + opts.heights: sh_ft 11 / 10.5 and toShearwallState works', withH.record.levels.map((l) => l.sh_ft).join(',') === '11,10.5' && SW.validate(LH.toShearwallState(withH.record, { dir: 'X' })).ok === true, JSON.stringify(withH.record.levels.map((l) => l.sh_ft)));
check('no story table + opts.heights: "using supplied heights" note, no "heights required" warning', has(withH.warnings, /using supplied heights/) && !has(withH.warnings, /heights required/), JSON.stringify(withH.warnings));
const unsafeFiles = LH.toShearwallState(withH.record, { dir: 'X', files: ['C:\\x\\a<b>' + String.fromCharCode(7) + 'c.html'] }).lateral.files;
check('safeName strips the path, < > and control characters', unsafeFiles[0] === 'abc.html', JSON.stringify(unsafeFiles));
const partH = LH.assemble([roofRes, LH.levelFromDiaphragmState((() => { const s = clone(thirdState); delete s.fields['#mwfrsJSON']; return s; })())], { heights: [11, 0] });
check('no story table + bad height: that level sh_ft null', partH.record.levels[0].sh_ft === 11 && partH.record.levels[1].sh_ft === null, JSON.stringify(partH.record.levels.map((l) => l.sh_ft)));
// #level blank -> error
const blankLvl = throwsWith(() => { const s = clone(roofState); s.fields['#level'] = '  '; LH.levelFromDiaphragmState(s); }, /level/i);
check('#level blank -> throws', blankLvl.threw, blankLvl.msg);
// duplicate loc -> error
const dupLoc = throwsWith(() => { const s = clone(roofState); const r = JSON.parse(s.fields['#swJSON']); r.Y[1].loc = 0; s.fields['#swJSON'] = JSON.stringify(r); LH.levelFromDiaphragmState(s); }, /duplicate/i);
check('duplicate loc within a direction -> throws', dupLoc.threw, dupLoc.msg);
// wrong calcFile -> error
const wrongFile = throwsWith(() => LH.levelFromDiaphragmState(load('mwfrs-state.json')), /calcFile|rectangular_diaphragm/i);
check('wrong calcFile -> throws', wrongFile.threw, wrongFile.msg);
// Vx differing from the story table by 5 % -> warning only
const offState = clone(thirdState); offState.fields['#Vx'] = (79.782 * 1.05).toFixed(2);
const offRes = LH.levelFromDiaphragmState(offState);
check('Vx 5 % off the story table -> warning only', has(offRes.warnings, /3RD.*Wind-X|Wind-X.*3RD/i) && offRes.level.F_wind_x_strength_lb === Math.round(parseFloat(offState.fields['#Vx']) * 1000), JSON.stringify(offRes.warnings));
// LH never touches SW outside toShearwallState: a fresh module instance without SW still parses/assembles
{
  const key = require.resolve('../public/Calcs/engines/lateral-handoff.js');
  const swKey = require.resolve('../public/Calcs/engines/stacked-shearwall.js');
  const saved = require.cache[swKey]; delete require.cache[key]; delete require.cache[swKey];
  let ok = false, msg = '';
  try {
    const LH2 = require('../public/Calcs/engines/lateral-handoff.js');
    const r2 = LH2.assemble([LH2.levelFromDiaphragmState(thirdState)]);
    ok = r2.errors.length === 0 && !!r2.record && !require.cache[swKey];
    msg = 'SW loaded during parse/assemble: ' + !!require.cache[swKey];
  } catch (e) { msg = String(e); }
  delete require.cache[key]; delete require.cache[swKey]; if (saved) require.cache[swKey] = saved;
  check('levelFromDiaphragmState / assemble never load SW', ok, msg);
}

if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
