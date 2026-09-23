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
    walls: Array.from(document.querySelectorAll('#wallFig option')).map(o => o.value),
    roofs: Array.from(document.querySelectorAll('#roofFig option')).map(o => o.value),
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
