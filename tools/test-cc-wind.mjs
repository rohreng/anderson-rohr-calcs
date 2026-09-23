// Components & Cladding wind regression harness.
// --capture-unmodified freezes the original 7-16 calc and its toolbar state.
// --phase0 checks the corrected 7-16 calc; --capture freezes that result.
// With no flag, compare the corrected baseline and run edition checks.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIX_DIR = fileURLToPath(new URL('../fixtures/cc-wind/', import.meta.url));
const FILE = 'asce716_cc_wind_calculator.html';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const TOL = 1e-9;
const MODES = new Map([['--capture-unmodified', 'unmodified'], ['--phase0', 'phase0'], ['--capture', 'capture']]);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && !MODES.has(args[0]))) {
  console.error('Usage: node tools/test-cc-wind.mjs [--capture-unmodified|--phase0|--capture]');
  process.exit(1);
}
const mode = args.length ? MODES.get(args[0]) : 'default';

// The ten input rows in plan §9.2. Preserve case names in the fixtures.
const CASES = [
  { name: 'b1-walls-2A-default', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 32 },
  { name: 'b2-walls-only', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: 'none', oh: false, A: 32 },
  { name: 'b3-walls-2A-oh-A200', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: true, A: 200 },
  { name: 'b4-walls-2B-B-A50', V: 120, exp: 'B', h: 30, minDim: 40, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2B', oh: false, A: 50 },
  { name: 'b5-walls-2D-oh-A10', V: 115, exp: 'C', h: 25, minDim: 60, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2D', oh: true, A: 10 },
  { name: 'b6-walls-5A-oh-D-A75', V: 130, exp: 'D', h: 18, minDim: 80, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-5A', oh: true, A: 75 },
  { name: 'b7-walls-2A-parapet3', V: 115, exp: 'C', h: 20, minDim: 50, hp: 3, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 32 },
  { name: 'b8-high-walls-roof-h80', V: 115, exp: 'C', h: 80, minDim: 100, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.6-1-wall', roofFig: '30.6-1-roof', oh: false, A: 32 },
  { name: 'b9-high-parapet4-pe', V: 115, exp: 'C', h: 80, minDim: 100, hp: 4, Kd: 0.85, Kzt: 1, GCpi: 0.55, wallFig: '30.6-1-wall', roofFig: '30.6-1-roof', oh: false, A: 100 },
  { name: 'b10-walls-2A-A600-Kzt', V: 150, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1.2, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 600 },
];

// Independent transcription of plan §4.2; the browser's GCP object is not used
// to generate expected coefficients or pressures.
const WPOS = [[10, 1], [500, .7]], WHPOS = [[20, .9], [500, .6]];
const P2A = [[10, .3], [100, .2]], P2B = [[2, .7], [100, .3]], P2D = [[10, .9], [100, .5]], P5A = [[10, .3], [100, .2]];
const B1 = [[20, -2], [100, -.5]], B2 = [[10, -3], [250, -1]];
const D1 = [[10, -1.8], [100, -.8]], D2 = [[10, -2], [200, -1]];
const Z = (name, pos, neg, oh = false) => ({ name, pos, neg, oh });
const HIGH_W = [Z('Wall Zone 4', WHPOS, [[20, -.9], [500, -.7]]), Z('Wall Zone 5', WHPOS, [[20, -1.8], [500, -1]])];
const HIGH_R = [Z('Roof Zone 1', null, [[10, -1.4], [500, -.9]]), Z('Roof Zone 2', null, [[10, -2.3], [500, -1.6]]), Z('Roof Zone 3', null, [[10, -3.2], [500, -2.3]])];
const CURVES = {
  '30.3-1': [Z('Zone 4', WPOS, [[10, -1.1], [500, -.8]]), Z('Zone 5', WPOS, [[10, -1.4], [500, -.8]])],
  '30.3-2A': [
    Z('Zone 1', P2A, [[10, -1.7], [500, -1]]), Z('Zone 1′', P2A, [[100, -.9], [1000, -.4]]),
    Z('Zone 2', P2A, [[10, -2.3], [500, -1.4]]), Z('Zone 3', P2A, [[10, -3.2], [500, -1.4]]),
    Z('Overhang 1/1′', null, [[10, -1.7], [100, -1.6], [500, -1]], true),
    Z('Overhang 2', null, [[10, -2.3], [500, -1.1]], true), Z('Overhang 3', null, [[10, -3.2], [500, -1.1]], true)],
  '30.3-2B': [
    Z('Zone 1', P2B, B1), Z('Zone 2e', P2B, B1), Z('Zone 2r', P2B, B2), Z('Zone 2n', P2B, B2),
    Z('Zone 3r', P2B, [[10, -3.6], [100, -1.8]]), Z('Zone 3e', P2B, B2),
    Z('Overhang 1/2e', null, [[20, -2.5], [100, -1.5]], true),
    Z('Overhang 2n/2r', null, [[10, -3.5], [250, -2]], true),
    Z('Overhang 3e', null, [[10, -4.1], [100, -2.3]], true),
    Z('Overhang 3r', null, [[10, -4.7], [250, -1.5]], true)],
  '30.3-2D': [
    Z('Zone 1', P2D, D1), Z('Zone 2e', P2D, D1), Z('Zone 2r', P2D, D1),
    Z('Zone 2n', P2D, D2), Z('Zone 3r', P2D, D2), Z('Zone 3e', P2D, [[2, -3.2], [300, -1]]),
    Z('Overhang 1/2e/2r', null, [[10, -2.6], [100, -1.6]], true),
    Z('Overhang 2n/3r', null, [[10, -2.8], [200, -1.8]], true),
    Z('Overhang 3e', null, [[2, -4], [300, -1.8]], true)],
  '30.3-5A': [
    Z('Zone 1', P5A, [[10, -1.1], [100, -1.1]]), Z('Zone 2', P5A, [[10, -1.3], [100, -1.2]]),
    Z('Zone 2′', P5A, [[10, -1.6], [100, -1.5]]), Z('Zone 3', P5A, [[10, -1.8], [100, -1.2]]),
    Z('Zone 3′', P5A, [[10, -2.6], [100, -1.6]])],
  '30.6-1': [...HIGH_W, ...HIGH_R], '30.6-1-wall': HIGH_W, '30.6-1-roof': HIGH_R,
};
function interpSeg(seg, A) {
  const x = Math.log10(Math.max(A, 10));
  if (x <= Math.log10(seg[0][0])) return seg[0][1];
  if (x >= Math.log10(seg.at(-1)[0])) return seg.at(-1)[1];
  for (let i = 0; i < seg.length - 1; i++) {
    const x0 = Math.log10(seg[i][0]), x1 = Math.log10(seg[i + 1][0]);
    if (x >= x0 && x <= x1) return seg[i][1] + (seg[i + 1][1] - seg[i][1]) * (x - x0) / (x1 - x0);
  }
  throw new Error('unreachable breakpoint interval');
}
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

// Fixed display expectations from plan §4.6, independent of CURVES arithmetic.
// Normal row: name | GCp+ | GCp− | p+ | p− | governing.
const N = s => s.split('|');
// Parapet row: name | net GCp | case A | case B | governing.
const P = s => s.split('|');
const R1 = [
  N('Zone 4|0.911|-1.011|28.3|-30.8|30.8'), N('Zone 5|0.911|-1.222|28.3|-36.3|36.3'),
  N('Zone 1|0.249|-1.492|11.1|-43.3|43.3'), N('Zone 1′|0.249|-0.900|11.1|-28.0|28.0'),
  N('Zone 2|0.249|-2.032|11.1|-57.3|57.3'), N('Zone 3|0.249|-2.665|11.1|-73.7|73.7')];
const R3 = [
  N('Zone 4|0.770|-0.870|24.6|-27.2|27.2'), N('Zone 5|0.770|-0.941|24.6|-29.0|29.0'),
  N('Zone 1|0.200|-1.164|9.8|-34.8|34.8'), N('Zone 1′|0.200|-0.749|9.8|-24.1|24.1'),
  N('Zone 2|0.200|-1.611|9.8|-46.4|46.4'), N('Zone 3|0.200|-1.822|9.8|-51.8|51.8'),
  N('Overhang 1/1′|—|-1.342|—|-39.4|39.4'), N('Overhang 2|—|-1.381|—|-40.4|40.4'),
  N('Overhang 3|—|-1.592|—|-45.9|45.9')];
const R4 = [
  N('Zone 4|0.877|-0.977|23.2|-25.4|25.4'), N('Zone 5|0.877|-1.153|23.2|-29.2|29.2'),
  N('Zone 1|0.371|-1.146|12.1|-29.1|29.1'), N('Zone 2e|0.371|-1.146|12.1|-29.1|29.1'),
  N('Zone 2r|0.371|-2.000|12.1|-47.8|47.8'), N('Zone 2n|0.371|-2.000|12.1|-47.8|47.8'),
  N('Zone 3r|0.371|-2.342|12.1|-55.3|55.3'), N('Zone 3e|0.371|-2.000|12.1|-47.8|47.8')];
const R5 = [
  N('Zone 4|1.000|-1.100|31.9|-34.6|34.6'), N('Zone 5|1.000|-1.400|31.9|-42.7|42.7'),
  ...['Zone 1', 'Zone 2e', 'Zone 2r'].map(n => N(`${n}|0.900|-1.800|29.2|-53.6|53.6`)),
  ...['Zone 2n', 'Zone 3r'].map(n => N(`${n}|0.900|-2.000|29.2|-59.0|59.0`)),
  N('Zone 3e|0.900|-2.493|29.2|-72.3|72.3'),
  N('Overhang 1/2e/2r|—|-2.600|—|-75.2|75.2'), N('Overhang 2n/3r|—|-2.800|—|-80.6|80.6'),
  N('Overhang 3e|—|-3.293|—|-94.0|94.0')];
const R6 = [
  N('Zone 4|0.845|-0.945|40.0|-43.9|43.9'), N('Zone 5|0.845|-1.091|40.0|-49.5|49.5'),
  N('Zone 1|0.212|-1.100|15.3|-49.9|49.9'), N('Zone 2|0.212|-1.212|15.3|-54.3|54.3'),
  N('Zone 2′|0.212|-1.512|15.3|-66.0|66.0'), N('Zone 3|0.212|-1.275|15.3|-56.7|56.7'),
  N('Zone 3′|0.212|-1.725|15.3|-74.3|74.3')];
const R8 = [
  N('Wall Zone 4|0.856|-0.871|36.1|-36.6|36.6'), N('Wall Zone 5|0.856|-1.683|36.1|-64.9|64.9'),
  N('Roof Zone 1|—|-1.251|—|-49.8|49.8'), N('Roof Zone 2|—|-2.092|—|-79.1|79.1'),
  N('Roof Zone 3|—|-2.932|—|-108.4|108.4')];
const R9 = [
  N('Wall Zone 4|0.750|-0.800|45.3|-47.0|47.0'), N('Wall Zone 5|0.750|-1.400|45.3|-67.9|67.9'),
  P('Zone 4 — Parapet|2.638|92.8|54.5|92.8'), P('Zone 5 — Parapet|3.420|120.3|75.6|120.3'),
  N('Roof Zone 1|—|-1.106|—|-57.7|57.7'), N('Roof Zone 2|—|-1.888|—|-84.9|84.9'),
  N('Roof Zone 3|—|-2.670|—|-112.1|112.1')];
const R10 = [
  N('Zone 4|0.700|-0.800|46.5|-51.8|51.8'), N('Zone 5|0.700|-0.800|46.5|-51.8|51.8'),
  N('Zone 1|0.200|-1.000|20.1|-62.4|62.4'), N('Zone 1′|0.200|-0.511|20.1|-36.5|36.5'),
  N('Zone 2|0.200|-1.400|20.1|-83.5|83.5'), N('Zone 3|0.200|-1.400|20.1|-83.5|83.5')];
const PHASE0 = {
  'b1-walls-2A-default': { Kh: .90, qh: 25.8998, a: 5, rows: R1 },
  'b2-walls-only': { Kh: .90, qh: 25.8998, a: 5, rows: R1.slice(0, 2) },
  'b3-walls-2A-oh-A200': { Kh: .90, qh: 25.8998, a: 5, rows: R3 },
  'b4-walls-2B-B-A50': { Kh: .70, qh: 21.9341, a: 4, rows: R4 },
  'b5-walls-2D-oh-A10': { Kh: .94, qh: 27.0509, a: 6, rows: R5 },
  'b6-walls-5A-oh-D-A75': { Kh: 1.06, qh: 38.9809, a: 7.2, rows: R6 },
  'b7-walls-2A-parapet3': { Kh: .90, KhPar: .924, qh: 25.8998, qp: 26.5905, a: 5, rows: [
    ...R1.slice(0, 2), P('Zone 4 — Parapet|2.943|78.3|51.1|78.3'),
    P('Zone 5 — Parapet|3.576|95.1|56.7|95.1'), ...R1.slice(2)] },
  'b8-high-walls-roof-h80': { Kh: 1.21, qh: 34.8209, a: 10, rows: R8 },
  'b9-high-parapet4-pe': { Kh: 1.21, KhPar: 1.222, qh: 34.8209, qp: 35.1662, a: 10, rows: R9 },
  'b10-walls-2A-A600-Kzt': { Kh: .90, qh: 52.8768, a: 5, rows: R10 },
};

const failures = [];
function check(label, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
function diff(exp, act, path, out, allow = []) {
  if (allow.some(re => re.test(path))) return;
  if (typeof exp === 'number') {
    if (typeof act !== 'number' || Math.abs(exp - act) > TOL) out.push(`${path}: ${exp} → ${act}`);
  } else if (exp === null || typeof exp !== 'object') {
    if (exp !== act) out.push(`${path}: ${JSON.stringify(exp)} → ${JSON.stringify(act)}`);
  } else if (Array.isArray(exp)) {
    if (!Array.isArray(act) || act.length !== exp.length) { out.push(`${path}: length ${exp.length} → ${act?.length}`); return; }
    exp.forEach((v, i) => diff(v, act[i], `${path}[${i}]`, out, allow));
  } else {
    if (act === null || typeof act !== 'object') { out.push(`${path}: object → ${JSON.stringify(act)}`); return; }
    Object.keys(exp).forEach(k => diff(exp[k], act[k], `${path}.${k}`, out, allow));
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
await page.route('**/*', route => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});

async function fresh() {
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.evaluate(() => localStorage.removeItem('ARE_cc_wind'));
}
async function snapshot() { return page.evaluate(() => {
  const ls = JSON.parse(localStorage.getItem('ARE_cc_wind') || 'null');
  if (ls) { delete ls.saved; if (ls.revit) delete ls.revit.generatedAt; }
  const rows = Array.from(document.querySelectorAll('#prsBody tr:not(.det-row)')).map(tr => Array.from(tr.cells).slice(0, 7).map(td => td.innerText.trim()));
  const dem = {};
  document.querySelectorAll('#demOut .dem-card').forEach(c => { dem[c.querySelector('.l').innerText.split('\n')[0].trim()] = c.querySelector('.v').innerText.trim(); });
  return { ls, rows, dem, ref: document.getElementById('refTableOut').innerText.replace(/\s+/g, ' ').trim(),
    last: window.__ccLast ? JSON.parse(JSON.stringify(window.__ccLast)) : null };
}); }
async function runCase(c) {
  await fresh();
  for (const k of ['V', 'h', 'minDim', 'hp', 'Kd', 'Kzt']) await page.fill('#' + k, String(c[k]));
  for (const k of ['exp', 'GCpi', 'wallFig', 'roofFig']) await page.selectOption('#' + k, String(c[k]));
  await page.selectOption('#overhangs', c.oh ? 'yes' : 'no');
  // The span/tributary handlers recalculate the area; set the requested area last.
  await page.fill('#effArea', String(c.A));
  await page.click('button.calc-btn');
  await page.waitForSelector('#results.show');
  return snapshot();
}

function verifyPhase0(c, s) {
  const e = PHASE0[c.name], rowBad = [], mathBad = [], lsBad = [];
  if (s.rows.length !== e.rows.length) rowBad.push(`row count ${s.rows.length} vs ${e.rows.length}`);
  e.rows.forEach((want, i) => {
    const row = s.rows[i];
    if (!row) return;
    const parapet = want[0].includes('Parapet');
    const got = parapet
      ? [row[0].replace(/\s*§30\.8$/, ''), row[2].replace('Net GCp: ', ''), row[3].replace('A: ', ''), row[4].replace('B: ', ''), row[5]]
      : [row[0].replace(/ \(overhang\)$/, ''), ...row.slice(2, 7)];
    want.forEach((v, j) => { if (got[j] !== v) rowBad.push(`${want[0]} column ${j}: expected ${v}, got ${got[j]}`); });
  });
  if (s.dem['Zone dim. a'] !== `${e.a.toFixed(1)} ft`) rowBad.push(`a: expected ${e.a.toFixed(1)} ft, got ${s.dem['Zone dim. a']}`);
  if (s.dem['qh (psf)'] !== e.qh.toFixed(2)) rowBad.push(`qh card: expected ${e.qh.toFixed(2)}, got ${s.dem['qh (psf)']}`);
  if (e.qp !== undefined && s.dem['qp (psf)'] !== e.qp.toFixed(2)) rowBad.push(`qp card: expected ${e.qp.toFixed(2)}, got ${s.dem['qp (psf)']}`);
  check(`${c.name}: §4.6 rows, qh and a`, rowBad.length === 0, rowBad.join('\n      '));

  const last = s.last, qh = .00256 * e.Kh * c.Kzt * c.Kd * c.V * c.V;
  if (!last || !Array.isArray(last.zones)) { check(`${c.name}: full precision snapshot`, false, 'window.__ccLast missing'); return; }
  for (const [key, val, tol] of [['Kh', e.Kh, 1e-9], ['qhDisp', qh, 1e-6], ['qEff', qh, 1e-6], ['a', e.a, 1e-9], ['A', c.A, 1e-9], ['Ke', 1, 1e-9]]) {
    if (!near(last[key], val, tol)) mathBad.push(`${key}: expected ${val}, got ${last[key]}`);
  }
  const qp = c.hp ? .00256 * e.KhPar * c.Kzt * c.Kd * c.V * c.V : 0;
  if (!near(last.qpDisp, qp, 1e-6) || !near(last.qpEff, qp, 1e-6)) mathBad.push(`parapet q: expected ${qp}, got ${last.qpDisp}/${last.qpEff}`);
  if (c.hp && !near(last.khRow[c.exp === 'B' ? 1 : c.exp === 'C' ? 2 : 3], e.Kh, 1e-9)) mathBad.push('interpolated khRow differs from Kh');
  if (last.edition !== '7-16' || last.theta !== null || last.wallFig !== c.wallFig || last.roofFig !== c.roofFig || last.inclOH !== c.oh) mathBad.push('snapshot metadata differs from inputs');
  if (last.zones.length !== e.rows.length) mathBad.push(`zones length ${last.zones.length} vs ${e.rows.length}`);
  const expectCurves = [c.wallFig, c.roofFig].filter(k => k !== 'none').flatMap(k => CURVES[k].filter(z => !z.oh || c.oh).map(z => ({ ...z, figKey: k })));
  last.zones.forEach((z, i) => {
    if (z.isParapet) {
      const n = z.name.includes('4') ? 4 : 5;
      const wall = CURVES[c.wallFig].find(x => new RegExp(`Zone ${n}$`).test(x.name));
      const roof = [c.roofFig, c.wallFig].filter(k => k !== 'none').flatMap(k => CURVES[k])
        .filter(x => !x.oh && new RegExp(`Zone ${n === 4 ? 2 : 3}`).test(x.name));
      const wp = interpSeg(wall.pos, c.A), wn = interpSeg(wall.neg, c.A);
      const rn = roof.length ? Math.min(...roof.map(x => interpSeg(x.neg, c.A))) : null;
      const netA = rn === null ? null : wp + Math.abs(rn), netB = wp + Math.abs(wn);
      const a = netA === null ? null : qp * netA, b = qp * netB;
      const t = z.terms || {};
      for (const [key, val, tol] of [['wallPosGCp', wp, 1e-9], ['wallNegGCp', wn, 1e-9], ['roofNegGCp', rn, 1e-9],
        ['netGCp_A', netA, 1e-9], ['netGCp_B', netB, 1e-9], ['caseA', a, 1e-6], ['caseB', b, 1e-6]]) {
        if (val === null ? t[key] !== null : !near(t[key], val, tol)) mathBad.push(`${z.name}.${key}: expected ${val}, got ${t[key]}`);
      }
      if (!near(z.govP, Math.max(a ?? 0, b), 1e-6) || t.govCase !== (a !== null && a > b ? 'A' : 'B')) mathBad.push(`${z.name}: governing parapet case`);
      if (z.gcpPos !== null || z.gcpNeg !== null || z.pPos !== null || z.pNeg !== null) mathBad.push(`${z.name}: parapet pressure fields should be null`);
      return;
    }
    const curve = expectCurves.find(x => x.figKey === z.figKey && x.name === z.name);
    if (!curve) { mathBad.push(`${z.name}: no harness curve for ${z.figKey}`); return; }
    const gp = curve.pos ? interpSeg(curve.pos, c.A) : null, gn = interpSeg(curve.neg, c.A);
    const pp = gp === null ? null : qh * (gp + c.GCpi), pn = qh * (gn - c.GCpi);
    for (const [key, val, tol] of [['gcpPos', gp, 1e-9], ['gcpNeg', gn, 1e-9], ['pPos', pp, 1e-6], ['pNeg', pn, 1e-6]]) {
      if (val === null ? z[key] !== null : !near(z[key], val, tol)) mathBad.push(`${z.name}.${key}: expected ${val}, got ${z[key]}`);
    }
    if (!near(z.govP, Math.max(Math.abs(pp ?? 0), Math.abs(pn)), 1e-6) || z.oh !== curve.oh) mathBad.push(`${z.name}: governing pressure or overhang flag`);
  });
  check(`${c.name}: independent §4.2 GCp and full precision p`, mathBad.length === 0, mathBad.join('\n      '));

  const saved = s.ls?.allZones || [], included = last.zones.filter(z => !z.oh);
  if (saved.length !== included.length) lsBad.push(`allZones length ${saved.length} vs ${included.length}`);
  included.forEach((z, i) => {
    const v = saved[i], want = e.rows.find(r => r[0] === z.name);
    if (!v || v.name !== z.name || !want) { lsBad.push(`allZones[${i}] name ${v?.name} vs ${z.name}`); return; }
    const par = z.isParapet, p = par ? [null, null, Number(want[4])] : [want[3] === '—' ? null : Number(want[3]), Number(want[4]), Number(want[5])];
    for (const [key, val] of [['pPos', p[0]], ['pNeg', p[1]], ['govP', p[2]]]) {
      if (val === null ? v[key] !== null : !near(v[key], val, .050001)) lsBad.push(`allZones[${i}].${key}: expected ${val}, got ${v[key]}`);
    }
  });
  check(`${c.name}: localStorage allZones matches displayed values`, lsBad.length === 0, lsBad.join('\n      '));
}

async function verifyLegacy(b1) {
  const legacy = JSON.parse(readFileSync(FIX_DIR + 'legacy-state.json', 'utf8'));
  check('legacy state predates edition, Ke and theta', ['#edition', '#Ke', '#theta'].every(k => !(k in legacy.fields)));
  await fresh();
  const load = await page.evaluate(state => AREv2.loadFromState(state), legacy);
  check('legacy state loads without rollback or mismatches', load.ok === true && !load.rolledBack
    && load.mismatches.missingOnPage.length === 0 && load.mismatches.notInFile.length === 0, JSON.stringify(load));
  await page.click('button.calc-btn');
  const out = [];
  diff(b1, await snapshot(), 'root', out);
  check('legacy state reproduces b1 Phase 0 snapshot', out.length === 0, out.slice(0, 15).join('\n      '));
}

async function verifyTables() {
  const live = await page.evaluate(() => ({
    curves: Object.fromEntries(Object.entries(GCP).map(([k, fig]) =>
      [k, fig.zones.map(z => ({ name: z.name, pos: z.pos, neg: z.neg, oh: !!z.oh }))])),
    kz: [250, 300, 350, 400, 450, 500, 600].map(h => getKhTableRow(h)),
  }));
  const want = Object.fromEntries(Object.entries(CURVES).map(([k, zones]) =>
    [k, zones.map(z => ({ name: z.name, pos: z.pos, neg: z.neg, oh: z.oh }))]));
  const out = [];
  diff(want, live.curves, 'GCP', out);
  check('Phase 0 tables: every §4.2 breakpoint and zone order', out.length === 0, out.slice(0, 20).join('\n      '));
  const kzWant = [[250, 1.28, 1.53, 1.68], [300, 1.35, 1.59, 1.73], [350, 1.41, 1.64, 1.78],
    [400, 1.47, 1.69, 1.82], [450, 1.52, 1.73, 1.86], [500, 1.56, 1.77, 1.89], [500, 1.56, 1.77, 1.89]];
  check('Phase 0 Kz: rows 250–500 ft and clamp', JSON.stringify(live.kz) === JSON.stringify(kzWant), JSON.stringify(live.kz));
  const khProbes = [[18, 'D', 1.03 + 3 / 5 * (1.08 - 1.03)], [23, 'C', .90 + 3 / 5 * (.94 - .90)],
    [84, 'C', 1.21 + 4 / 10 * (1.24 - 1.21)], [35, 'B', .70 + 5 / 10 * (.76 - .70)], [600, 'C', 1.77]];
  const khValues = await page.evaluate(items => items.map(([h, exp]) => getKh(h, exp)), khProbes);
  check('Phase 0 Kz: Note 3 interpolation at h and parapet top',
    khProbes.every((x, i) => near(khValues[i], x[2], 1e-9)), JSON.stringify({ khProbes, khValues }));
  const probes = Object.entries(CURVES).flatMap(([fig, zones]) => zones.flatMap(z => [2, 10, 20, 32, 50, 75, 100, 200, 250, 300, 500, 600, 1000]
    .map(A => ({ fig, name: z.name, A, pos: z.pos, neg: z.neg }))));
  const actual = await page.evaluate(items => items.map(x => ({
    pos: gcpAt(GCP[x.fig].zones.find(z => z.name === x.name).pos, x.A),
    neg: gcpAt(GCP[x.fig].zones.find(z => z.name === x.name).neg, x.A),
  })), probes);
  const bad = [];
  probes.forEach((x, i) => {
    const pos = x.pos ? interpSeg(x.pos, x.A) : null, neg = interpSeg(x.neg, x.A);
    if ((pos === null ? actual[i].pos !== null : !near(actual[i].pos, pos, 1e-9)) || !near(actual[i].neg, neg, 1e-9))
      bad.push(`${x.fig} ${x.name} at ${x.A} sf: ${JSON.stringify(actual[i])} vs ${JSON.stringify({ pos, neg })}`);
  });
  check(`Phase 0 interpolation: ${probes.length} curve probes at 1e-9`, bad.length === 0, bad.slice(0, 15).join('\n      '));
}

async function verifySweep() {
  await fresh();
  const opts = await page.evaluate(() => ({
    walls: Array.from(document.querySelectorAll('#wallFig option')).filter(o => !o.disabled).map(o => o.value),
    roofs: Array.from(document.querySelectorAll('#roofFig option')).filter(o => !o.disabled).map(o => o.value),
  }));
  const bad = [];
  let n = 0;
  for (const wall of opts.walls) for (const roof of opts.roofs) for (const oh of ['no', 'yes']) {
    if (wall === 'none' && roof === 'none') continue;
    await page.selectOption('#wallFig', wall);
    await page.selectOption('#roofFig', roof);
    await page.selectOption('#overhangs', oh);
    await page.click('button.calc-btn');
    const state = await page.evaluate(() => ({ txt: document.getElementById('results').innerText, zones: window.__ccLast?.zones.length }));
    n++;
    if (/NaN|undefined/.test(state.txt) || !state.zones || state.txt.length < 200) bad.push(`${wall}/${roof}/${oh}: ${state.zones} zones`);
  }
  check(`Phase 0 sweep: ${n} wall × roof × overhang combinations render`, n === 34 && bad.length === 0, bad.join('\n      '));
}

// ── ASCE 7-22 (plan §9.4 / §9.5). Expected values are typed constants, hand-checked
// from the §7 tables; T15 uses the Note 3 interpolated Kh at the 23 ft parapet top (0.924).
const T1 = { V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, A: 32, wallFig: '22:30.3-1', roofFig: 'none', oh: false };
async function runCase22(c) {
  await fresh();
  await page.selectOption('#edition', c.edition || '7-22');
  for (const k of ['V', 'h', 'minDim', 'hp']) await page.fill('#' + k, String(c[k]));
  await page.fill('#Ke', String(c.Ke ?? 1));
  await page.selectOption('#exp', c.exp);
  await page.selectOption('#GCpi', '0.18');
  await page.selectOption('#wallFig', c.wallFig);
  await page.selectOption('#roofFig', c.roofFig);
  if (c.theta !== undefined) await page.fill('#theta', String(c.theta));
  await page.selectOption('#overhangs', c.oh ? 'yes' : 'no');
  await page.fill('#effArea', String(c.A));
  await page.click('button.calc-btn');
  await page.waitForSelector('#results.show');
  return snapshot();
}
function zp(s, name) { return s.last.zones.find(z => z.name === name); }
function expectP(label, s, want) {
  const bad = [];
  for (const [name, pos, neg] of want) {
    const z = zp(s, name);
    if (!z) { bad.push(`${name}: missing`); continue; }
    if (pos !== null && !near(z.pPos, pos, 1e-3)) bad.push(`${name} p+: expected ${pos}, got ${z.pPos}`);
    if (neg !== null && !near(z.pNeg, neg, 1e-3)) bad.push(`${name} p−: expected ${neg}, got ${z.pNeg}`);
  }
  check(label, bad.length === 0, bad.join('\n      '));
}
async function verify722() {
  let s = await runCase22(T1);
  expectP('T1 7-22 walls A 32', s, [['Zone 4', 28.252, -30.842], ['Zone 5', 28.252, -36.301]]);
  check('T1 qh card excludes Kd (30.47)', s.dem['qh (psf)'] === '30.47' && s.last.edition === '7-22'
    && near(s.last.qhDisp, .00256 * .90 * 115 * 115, 1e-9) && near(s.last.qEff, .00256 * .90 * 115 * 115 * .85, 1e-9), JSON.stringify(s.dem));
  const det = await page.evaluate(() => Array.from(document.querySelectorAll('.calc-det')).map(d => d.innerHTML));
  const step2 = det[0].split('Step 3')[0].split('Step 2')[1] || '', step4 = det[0].split('Step 4')[1] || '';
  check('7-22 detail: Step 2 has no Kd, Step 4 applies Kd', !/K<sub>d<\/sub>/.test(step2) && /K<sub>d<\/sub>/.test(step4), step2.slice(0, 300));
  const txt22 = await page.evaluate(() => document.getElementById('results').innerText + ' ' + Array.from(document.querySelectorAll('.calc-det')).map(d => d.textContent).join(' '));
  const leak = ['7-16', '30.5-1', '30.8-1', '30.9-1'].filter(x => txt22.includes(x));
  check('7-22 results carry no 7-16 references', leak.length === 0, leak.join(', '));

  s = await runCase22({ ...T1, A: 100 });
  expectP('T2 7-22 walls A 100', s, [['Zone 4', 25.988, -28.578], ['Zone 5', 25.988, -31.775]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2A' });
  expectP('T3 7-22 Fig 30.3-2A A 32', s, [['Zone 1', 11.124, -43.301], ['Zone 1′', 11.124, -27.972], ['Zone 2', 11.124, -57.301], ['Zone 3', 11.124, -73.680]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2A', oh: true, A: 200 });
  expectP('T4 7-22 Fig 30.3-2A overhang curves A 200', s, [['Overhang 1/1′', null, -39.409], ['Overhang 2', null, -40.431], ['Overhang 3', null, -45.891]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2A', A: 600 });
  expectP('T5 7-22 Zone 1′ A 600', s, [['Zone 1′', null, -17.895]]);
  const T6 = { V: 120, exp: 'B', h: 30, minDim: 40, hp: 0, A: 50, wallFig: '22:30.3-1', roofFig: '22:30.3-2B', oh: false };
  s = await runCase22(T6);
  expectP('T6 7-22 Fig 30.3-2B Exp B A 50', s, [['Zone 1', 13.573, -32.248], ['Zone 2', 13.573, -43.137], ['Zone 3', 13.573, -55.315]]);
  s = await runCase22({ ...T6, oh: true });
  expectP('T7 7-22 §30.7 sum-rule overhangs', s, [['Overhang 1', null, -51.474], ['Overhang 2', null, -62.364], ['Overhang 3', null, -74.541]]);
  check('T7 sum-rule terms: roof − wall(+)', near(zp(s, 'Overhang 1').terms.wallPos, .87658, 1e-5) && near(zp(s, 'Overhang 1').gcpNeg, -2.16678, 1e-5),
    JSON.stringify(zp(s, 'Overhang 1')));
  s = await runCase22({ ...T1, roofFig: '22:30.3-2C', A: 150 });
  expectP('T8 7-22 Fig 30.3-2C A 150', s, [['Zone 1', 13.178, -27.123], ['Zone 2', 13.178, -35.742], ['Zone 3', 13.178, -40.922]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2D', A: 10 });
  expectP('T9 7-22 Fig 30.3-2D A 10', s, [['Zone 1', 27.972, -51.282], ['Zone 2', 27.972, -56.462], ['Zone 3', 27.972, -69.412]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2D', A: 600 });
  expectP('T9 7-22 Fig 30.3-2D A 600', s, [['Zone 1', 17.612, -25.382], ['Zone 2', 17.612, -30.562], ['Zone 3', 17.612, -30.562]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2E' });
  expectP('T10 7-22 Fig 30.3-2E A 32', s, [['Zone 1', 17.559, -41.226], ['Zone 2', 17.559, -55.760], ['Zone 3', 17.559, -59.934]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2F' });
  expectP('T11 7-22 Fig 30.3-2F A 32', s, [['Zone 1', null, -33.072], ['Zone 2', null, -43.378], ['Zone 3', null, -43.378]]);
  check('T11 #thetaRow hidden for 2F', await page.$eval('#thetaRow', e => getComputedStyle(e).display === 'none'));
  s = await runCase22({ ...T1, roofFig: '22:30.3-2G', theta: 36 });
  expectP('T12 7-22 Fig 30.3-2G Note 6 θ 36', s, [['Zone 1', null, -33.058], ['Zone 2', null, -40.788], ['Zone 3', null, -45.942]]);
  check('T12 #thetaRow visible for 2G; t = 0.5', await page.$eval('#thetaRow', e => getComputedStyle(e).display !== 'none')
    && near(zp(s, 'Zone 1').terms.t, .5, 1e-12) && s.last.theta === 36);
  const rt = await page.evaluate(() => AREv2.captureState());
  const z12 = s.last.zones;
  s = await runCase22({ ...T1, roofFig: '22:30.3-2G', theta: 45 });
  expectP('T12 θ 45 = Fig 30.3-2G', s, [['Zone 3', null, -48.505]]);
  s = await runCase22({ ...T1, roofFig: '22:30.3-5A', oh: true });
  expectP('T13 7-22 Fig 30.3-5A A 32', s, [['Zone 1', 11.124, -33.152], ['Zone 2', 11.124, -37.023], ['Zone 2′', 11.124, -44.793], ['Zone 3', 11.124, -43.432], ['Zone 3′', 11.124, -58.918]]);
  check('T13 five sum-rule overhang rows', s.last.zones.filter(z => z.oh).length === 5, s.last.zones.map(z => z.name).join(', '));
  s = await runCase22({ V: 115, exp: 'C', h: 80, minDim: 100, hp: 0, A: 32, wallFig: '22:30.4-1-wall', roofFig: '22:30.4-1-roof', oh: false });
  expectP('T14 7-22 Fig 30.4-1 h 80', s, [['Wall Zone 4', 36.081, -36.590], ['Wall Zone 5', 36.081, -64.878], ['Roof Zone 1', null, -49.840], ['Roof Zone 2', null, -79.109], ['Roof Zone 3', null, -108.377]]);
  check('T14 a = 10.0 ft', s.dem['Zone dim. a'] === '10.0 ft', s.dem['Zone dim. a']);
  s = await runCase22({ ...T1, roofFig: '22:30.3-2A', hp: 3 });
  const p4 = zp(s, 'Zone 4 — Parapet'), p5 = zp(s, 'Zone 5 — Parapet');
  check('T15 7-22 parapet, qp at 23 ft (Kh 0.924), Kd in p', !!p4 && !!p5 && near(s.last.qpEff, 26.5905024, 1e-6)
    && near(p4.terms.caseA, 78.261, 1e-3) && near(p4.terms.caseB, 51.096, 1e-3) && p4.terms.govCase === 'A'
    && near(p5.terms.caseA, 95.077, 1e-3) && near(p5.terms.caseB, 56.702, 1e-3) && p5.terms.govCase === 'A', JSON.stringify([p4?.terms, p5?.terms]));
  const parRow = s.rows.find(r => r[0].startsWith('Zone 4 — Parapet'));
  check('T15 parapet row cites §30.6 / Fig 30.6-1', !!parRow && /§30\.6/.test(parRow[0]) && /Fig 30\.6-1/.test(parRow[1]), JSON.stringify(parRow));
  s = await runCase22({ ...T1, exp: 'B', h: 40 });
  expectP('T16 7-22 Table 26.10-1 Exp B h 40 (Kh 0.74)', s, [['Zone 4', 23.229, -25.359], ['Zone 5', 23.229, -29.848]]);
  s = await runCase22({ ...T1, exp: 'B', h: 40, edition: '7-16', wallFig: '30.3-1' });
  check('T16 7-16 counterpart card 21.87 (Kh 0.76, Kd in q)', s.dem['qh (psf)'] === '21.87', s.dem['qh (psf)']);
  s = await runCase22({ ...T1, Ke: .93 });
  expectP('T17 7-22 Ke 0.93', s, [['Zone 5', null, -33.760]]);
  check('T17 qh card 28.34', s.dem['qh (psf)'] === '28.34' && s.dem['Ke'] === '0.930', JSON.stringify(s.dem));
  s = await runCase22({ ...T1, Ke: .93, edition: '7-16', wallFig: '30.3-1' });
  check('T17 7-16 with Ke 0.93 card 24.09', s.dem['qh (psf)'] === '24.09', s.dem['qh (psf)']);

  // §9.5 UI / state
  await fresh();
  const ui16 = await page.evaluate(() => ({
    ed: document.getElementById('edition').value, title: document.title, h1: document.querySelector('h1').innerText,
    hidden22: Array.from(document.querySelectorAll('option[data-ed="7-22"]')).every(o => o.hidden && o.disabled),
    theta: getComputedStyle(document.getElementById('thetaRow')).display }));
  check('default edition 7-16, 7-22 options hidden+disabled, θ hidden', ui16.ed === '7-16' && /ASCE 7-16/.test(ui16.title) && /ASCE 7-16/.test(ui16.h1)
    && ui16.hidden22 && ui16.theta === 'none', JSON.stringify(ui16));
  await page.click('button.calc-btn');
  const txt16 = await page.evaluate(() => document.getElementById('results').innerText);
  const leak16 = ['7-22', '30.4-1', 'Kd['].filter(x => txt16.includes(x));
  check('7-16 results carry no 7-22 references', leak16.length === 0, leak16.join(', '));
  await page.selectOption('#edition', '7-22');
  const ui22 = await page.evaluate(() => ({ wall: document.getElementById('wallFig').value, roof: document.getElementById('roofFig').value, title: document.title,
    hidden16: Array.from(document.querySelectorAll('option[data-ed="7-16"]')).every(o => o.hidden && o.disabled),
    gcpi: document.querySelector('#GCpi option[value="0.18"]').textContent }));
  check('switch to 7-22 resets figures, hides 7-16 options, relabels GCpi', ui22.wall === '22:30.3-1' && ui22.roof === 'none'
    && /ASCE 7-22/.test(ui22.title) && ui22.hidden16 && /Partially Open/.test(ui22.gcpi), JSON.stringify(ui22));

  // Legacy file into a page holding 7-22 state
  await fresh();
  await page.selectOption('#edition', '7-22');
  await page.fill('#Ke', '0.9');
  await page.evaluate(() => { document.getElementById('theta').value = '30'; });
  const legacy = JSON.parse(readFileSync(FIX_DIR + 'legacy-state.json', 'utf8'));
  const load = await page.evaluate(st => AREv2.loadFromState(st), legacy);
  const after = await page.evaluate(() => ({ ed: document.getElementById('edition').value, Ke: document.getElementById('Ke').value, th: document.getElementById('theta').value }));
  check('legacy file loads as 7-16 (Ke 1.00, θ 45) without rollback', load.ok === true && !load.rolledBack
    && load.mismatches.missingOnPage.length === 0 && load.mismatches.notInFile.length === 0
    && after.ed === '7-16' && after.Ke === '1.00' && after.th === '45', JSON.stringify({ load, after }));
  await page.click('button.calc-btn');
  const base = JSON.parse(readFileSync(FIX_DIR + 'baseline.json', 'utf8')).cases;
  const out = [];
  diff(base['b1-walls-2A-default'], await snapshot(), 'root', out);
  check('legacy file reproduces baseline b1', out.length === 0, out.slice(0, 10).join('\n      '));

  // Round trip of the T12 state
  await fresh();
  const load2 = await page.evaluate(st => AREv2.loadFromState(st), rt);
  const rtIn = await page.evaluate(() => ({ ed: document.getElementById('edition').value, roof: document.getElementById('roofFig').value, th: document.getElementById('theta').value }));
  await page.click('button.calc-btn');
  const rtOut = [];
  diff(z12, (await snapshot()).last.zones, 'zones', rtOut);
  check('7-22 save/load round trip (2G, θ 36) reproduces zones', load2.ok === true && !load2.rolledBack && rtIn.ed === '7-22'
    && rtIn.roof === '22:30.3-2G' && rtIn.th === '36' && rtOut.length === 0, JSON.stringify({ load2, rtIn, rtOut: rtOut.slice(0, 5) }));
  check('#sendZoneSel excluded from saved state', await page.evaluate(() => document.getElementById('sendZoneSel').hasAttribute('data-are-ignore')
    && !('#sendZoneSel' in AREv2.captureState().fields)));
  const pay = await page.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('ARE_cc_wind')), rv: buildRevitCCPayload() }));
  check('localStorage and Revit payload carry the edition', pay.ls.edition === '7-22' && pay.rv.inputs.edition === '7-22'
    && pay.rv.schema === 'are.cc.wind.v1' && pay.rv.code === 'ASCE 7-22' && pay.rv.inputs.theta_deg === 36, JSON.stringify({ ls: pay.ls.edition, inputs: pay.rv.inputs }));

  // 7-22 sweep: every enabled wall × roof × overhang, with a 3 ft parapet
  await fresh();
  await page.selectOption('#edition', '7-22');
  await page.fill('#hp', '3');
  const opts = await page.evaluate(() => ({
    walls: Array.from(document.querySelectorAll('#wallFig option')).filter(o => !o.disabled).map(o => o.value),
    roofs: Array.from(document.querySelectorAll('#roofFig option')).filter(o => !o.disabled).map(o => o.value) }));
  const OH = { '22:30.3-2A': 3, '22:30.3-5A': 5, '22:30.4-1-roof': 3 };
  const bad = [];
  let n = 0;
  for (const wall of opts.walls) for (const roof of opts.roofs) for (const oh of ['no', 'yes']) {
    if (wall === 'none' && roof === 'none') continue;
    await page.selectOption('#wallFig', wall);
    await page.selectOption('#roofFig', roof);
    await page.selectOption('#overhangs', oh);
    await page.click('button.calc-btn');
    const st = await page.evaluate(() => ({ txt: document.getElementById('results').innerText, zones: window.__ccLast?.zones || [] }));
    n++;
    const ohN = st.zones.filter(z => z.oh).length, want = oh === 'yes' && roof !== 'none' ? (OH[roof] ?? 3) : 0;
    if (/NaN|undefined/.test(st.txt) || !st.zones.length || ohN !== want) bad.push(`${wall}/${roof}/${oh}: ${st.zones.length} zones, ${ohN} overhang rows (want ${want})`);
  }
  check(`7-22 sweep: ${n} wall × roof × overhang combinations (hp 3) render`, n === 58 && bad.length === 0, bad.join('\n      '));
}

try {
  const results = {};
  let legacyState;
  for (const c of CASES) {
    results[c.name] = await runCase(c);
    check(c.name + ': result and saved zones', !!results[c.name].ls && results[c.name].rows.length > 0,
      JSON.stringify(results[c.name]).slice(0, 300));
    if (c === CASES[0] && mode === 'unmodified') legacyState = await page.evaluate(() => AREv2.captureState());
  }

  if (mode === 'unmodified' || mode === 'capture') {
    mkdirSync(FIX_DIR, { recursive: true });
    const name = mode === 'unmodified' ? 'baseline-unmodified.json' : 'baseline.json';
    if (!failures.length && !pageErrors.length) {
      writeFileSync(FIX_DIR + name, JSON.stringify({ capturedAt: new Date().toISOString(), cases: results }, null, 1) + '\n');
      console.log('baseline written: ' + FIX_DIR + name);
      if (mode === 'unmodified') {
        check('legacy state excludes future fields', !!legacyState && ['#edition', '#Ke', '#theta'].every(k => !(k in legacyState.fields)), JSON.stringify(legacyState?.fields));
        if (!failures.length) {
          writeFileSync(FIX_DIR + 'legacy-state.json', JSON.stringify(legacyState, null, 1) + '\n');
          console.log('legacy state written: ' + FIX_DIR + 'legacy-state.json');
        }
      }
    }
  } else if (mode === 'default') {
    const base = JSON.parse(readFileSync(FIX_DIR + 'baseline.json', 'utf8')).cases;
    for (const c of CASES) {
      const out = [];
      diff(base[c.name], results[c.name], 'root', out);
      check('baseline ' + c.name, out.length === 0, out.slice(0, 12).join('\n      '));
    }
    await verify722();
    await verifySweep();
  } else {
    for (const c of CASES) verifyPhase0(c, results[c.name]);
    await verifyTables();
    await verifyLegacy(results[CASES[0].name]);
    await verifySweep();
  }
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
} catch (e) {
  check('harness run', false, String(e.stack || e));
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
