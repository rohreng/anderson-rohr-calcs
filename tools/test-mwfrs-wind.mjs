// =============================================================================
// MWFRS wind calculator — regression + merge harness
// -----------------------------------------------------------------------------
// Usage: node tools/test-mwfrs-wind.mjs            compare against baseline + new-behavior checks
//        node tools/test-mwfrs-wind.mjs --capture  (re)write fixtures/mwfrs-wind/baseline.json
//
// Baseline = window.__mwfrsLast + buildRevitWindPayload() for four walled cases,
// captured from the calc BEFORE the open-building merge (2026-09-15). The only
// baseline paths allowed to differ after the merge are the parallel-to-ridge
// roof block of the two sloped cases (agreed fix: Fig. 27.3-1 zone table applies
// for wind parallel to the ridge), the roofType label sloped→gablehip, and the
// Wind-X roof block of enclosed-flat-3story-parapet (h/L = 0.667: Gate 1 finding
// L-02 — flatRoofCp must interpolate toward the h/L ≥ 1.0 zone table). Revit
// roof/governing fields follow whichever roof block changed.
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIX_DIR = fileURLToPath(new URL('../fixtures/mwfrs-wind/', import.meta.url));
const FIX = FIX_DIR + 'baseline.json';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'asce716_mwfrs_calculator.html';
const CAPTURE = process.argv.includes('--capture');
const TOL = 1e-9;

// Four walled cases. roof:'sloped' maps to the legacy option before the merge and to 'gablehip' after.
const CASES = [
  { name: 'enclosed-flat-3story-parapet', encl: 'enclosed', roof: 'flat',   theta: 0,  hp: 3, V: 115, exp: 'C', B: 60,  D: 120, h: 40, stories: [14, 13, 13] },
  { name: 'enclosed-sloped20-2story',     encl: 'enclosed', roof: 'sloped', theta: 20, hp: 0, V: 120, exp: 'B', B: 50,  D: 80,  h: 30, stories: [15, 15] },
  { name: 'partial-flat-1story-parapet',  encl: 'partial',  roof: 'flat',   theta: 0,  hp: 2, V: 130, exp: 'D', B: 100, D: 200, h: 24, stories: [24] },
  { name: 'partial-sloped35-3story',      encl: 'partial',  roof: 'sloped', theta: 35, hp: 0, V: 115, exp: 'C', B: 40,  D: 90,  h: 36, stories: [12, 12, 12] },
];
// Paths that may legitimately differ from baseline for the sloped cases (see header).
const ALLOW_SLOPED = [/^root\.last\.roofType$/, /^root\.last\.roofY(\.|$)/, /^root\.revit\.inputs\.roofType$/, /^root\.revit\.roof(\.|$)/, /^root\.revit\.revit(\.|$)/];
const ALLOW_HL = [/^root\.last\.roofX(\.|$)/, /^root\.revit\.roof(\.|$)/, /^root\.revit\.revit(\.|$)/];   // L-02: only case 1 has h/L > 0.5 in a zone-table direction
const ALLOW = { 'enclosed-sloped20-2story': ALLOW_SLOPED, 'partial-sloped35-3story': ALLOW_SLOPED, 'enclosed-flat-3story-parapet': ALLOW_HL };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
async function fresh() {
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
}
async function setIf(sel, val) { if (await page.$(sel)) await page.selectOption(sel, val); }
async function fillIf(sel, val) { if (await page.$(sel)) await page.fill(sel, String(val)); }
async function setStories(list) {
  for (let i = 1; i < list.length; i++) await page.click('.btn-add-floor');
  const shs = await page.$$('#storyRows .sh');
  for (let i = 0; i < list.length; i++) await shs[i].fill(String(list[i]));
}
async function snapshot() {
  return page.evaluate(() => ({
    last: JSON.parse(JSON.stringify(window.__mwfrsLast)),
    revit: (() => { const p = buildRevitWindPayload(); if (p) delete p.generatedAt; return p; })(),
  }));
}
async function runWalled(c) {
  await fresh();
  const legacy = (await page.$('#roofType option[value="sloped"]')) !== null;
  await page.fill('#V', String(c.V)); await page.selectOption('#exp', c.exp); await page.selectOption('#encl', c.encl);
  await page.fill('#B', String(c.B)); await page.fill('#D', String(c.D)); await page.fill('#h', String(c.h)); await page.fill('#hp', String(c.hp));
  await page.selectOption('#roofType', c.roof === 'sloped' ? (legacy ? 'sloped' : 'gablehip') : c.roof);
  if (c.roof === 'sloped') { await setIf('#roofAngleMode', 'deg'); await page.fill('#theta', String(c.theta)); }
  await setStories(c.stories);
  await page.click('button.calc-btn');
  return snapshot();
}
// Walk expected (baseline) and require every path to exist and match in actual.
function diff(exp, act, path, out, allow) {
  if (allow.some((re) => re.test(path))) return;
  if (typeof exp === 'number') {
    if (typeof act !== 'number' || Math.abs(exp - act) > TOL) out.push(`${path}: ${exp} → ${act}`);
  } else if (exp === null || typeof exp !== 'object') {
    if (exp !== act) out.push(`${path}: ${JSON.stringify(exp)} → ${JSON.stringify(act)}`);
  } else if (Array.isArray(exp)) {
    if (!Array.isArray(act) || act.length !== exp.length) { out.push(`${path}: length ${exp.length} → ${act && act.length}`); return; }
    exp.forEach((v, i) => diff(v, act[i], `${path}[${i}]`, out, allow));
  } else {
    if (act === null || typeof act !== 'object') { out.push(`${path}: object → ${JSON.stringify(act)}`); return; }
    Object.keys(exp).forEach((k) => diff(exp[k], act[k], `${path}.${k}`, out, allow));
  }
}

// ── 1. baseline capture / compare ───────────────────────────────────────────
const results = {};
for (const c of CASES) results[c.name] = await runWalled(c);
if (CAPTURE) {
  if (!existsSync(FIX_DIR)) mkdirSync(FIX_DIR, { recursive: true });
  writeFileSync(FIX, JSON.stringify({ capturedAt: new Date().toISOString(), cases: results }, null, 1));
  console.log('baseline written: ' + FIX);
} else {
  const base = JSON.parse(readFileSync(FIX, 'utf8')).cases;
  for (const c of CASES) {
    const out = [];
    diff(base[c.name], results[c.name], 'root', out, ALLOW[c.name] || []);
    check(`baseline ${c.name}`, out.length === 0, out.slice(0, 12).join('\n      '));
  }
}
check('no page errors (baseline cases)', pageErrors.length === 0, pageErrors.join('\n      '));

if (!CAPTURE) {
  // ── 2. parallel-to-ridge fix on the sloped cases (ridge along D → Wind-Y parallel) ──
  // Independent constants: Fig. 27.3-1 zone table, Cp1 by zone, Cp2 = -0.18; p = qh·G·Cp ∓ qh·GCpi.
  for (const c of CASES.filter((x) => x.roof === 'sloped')) {
    const r = results[c.name].last, ry = r.roofY, GCpi = c.encl === 'enclosed' ? 0.18 : 0.55;
    check(`${c.name}: Wind-Y roof uses zone table`, ry && ry.type === 'flat', JSON.stringify(ry && ry.type));
    const cp1 = { '0–h/2': -0.9, 'h/2–h': -0.9, 'h–2h': -0.5, '>2h': -0.3 };
    const bad = [];
    (ry.zones || []).forEach((z) => {
      const eA = r.qh * 0.85 * cp1[z.zone] - r.qh * GCpi, eB = r.qh * 0.85 * (-0.18) + r.qh * GCpi;
      if (Math.abs(z.pA - eA) > 1e-6 || Math.abs(z.pB - eB) > 1e-6) bad.push(`${z.zone}: pA ${z.pA} vs ${eA}, pB ${z.pB} vs ${eB}`);
    });
    check(`${c.name}: Wind-Y zone pressures`, bad.length === 0, bad.join('\n      '));
  }

  // ── 2b. L-02: enclosed-flat case, Wind-X h/L = 40/60 = 0.667 → per-zone interpolation between
  //        the h/L ≤ 0.5 table (−0.9, −0.9, −0.5, −0.3) and the h/L ≥ 1.0 table (0–h/2: −1.3, >h/2: −0.7)
  {
    const r = results['enclosed-flat-3story-parapet'].last, rx = r.roofX;
    const tt = (40 / 60 - 0.5) / 0.5;
    const exp1 = { '0–h/2': -0.9 + tt * (-1.3 + 0.9), 'h/2–h': -0.9 + tt * (-0.7 + 0.9), 'h–2h': -0.5 + tt * (-0.7 + 0.5) };
    const bad = [];
    check('L-02: Wind-X has 3 zones (L = 2h)', rx.zones.length === 3, JSON.stringify(rx.zones.map((z) => z.zone)));
    rx.zones.forEach((z) => {
      const eA = r.qh * 0.85 * exp1[z.zone] - r.qh * 0.18, eB = r.qh * 0.85 * (-0.18) + r.qh * 0.18;
      if (Math.abs(z.Cp1 - exp1[z.zone]) > 1e-9 || Math.abs(z.pA - eA) > 1e-6 || Math.abs(z.pB - eB) > 1e-6) bad.push(`${z.zone}: Cp1 ${z.Cp1} vs ${exp1[z.zone]}, pA ${z.pA} vs ${eA}`);
    });
    check('L-02: Wind-X interpolated zone Cp/pressures', bad.length === 0, bad.join('\n      '));
    const ry = r.roofY;   // h/L = 40/120 = 0.333 → unchanged ≤ 0.5 table
    check('L-02: Wind-Y (h/L 0.33) unchanged', ry.zones.length === 4 && Math.abs(ry.zones[0].Cp1 + 0.9) < 1e-9, JSON.stringify(ry.zones.map((z) => z.Cp1)));
  }

  // ── 3. open path — pitched, clear, θ = 15°, ridge along D ────────────────
  // Independent: Kz(20 ft, C) = 0.90 (Table 26.10-1); qh = 0.00256·Kz·Kzt·Kd·Ke·V²;
  // Fig. 27.3-5 θ=15° clear: A (CNW 1.1, CNL -0.4), B (0.1, -1.1); Fig. 27.3-7 clear: ≤h A -0.8 B 0.8, h–2h A -0.6 B 0.5, >2h A -0.3 B 0.3.
  await fresh();
  await page.fill('#V', '115'); await page.selectOption('#exp', 'C'); await page.selectOption('#encl', 'open');
  await page.fill('#B', '40'); await page.fill('#D', '100'); await page.fill('#h', '20');
  await page.selectOption('#freeRoofShape', 'pitched'); await page.selectOption('#windFlow', 'clear');
  await page.selectOption('#ridgeDir', 'D'); await page.selectOption('#roofAngleMode', 'deg'); await page.fill('#theta', '15');
  await page.fill('#numFrames', '4'); await page.fill('#AsArea', '0');
  await page.click('button.calc-btn');
  const o = await snapshot();
  const qh = 0.00256 * 0.90 * 1.0 * 0.85 * 1.0 * 115 * 115, G = 0.85;
  check('open: qh', Math.abs(o.last.qh - qh) < 1e-6, `${o.last.qh} vs ${qh}`);
  const rows = o.last.open.rows;
  const expRows = [['A', 1.1, -0.4], ['B', 0.1, -1.1]];
  check('open: two CN rows (0°,180°)', rows.length === 2, JSON.stringify(rows));
  expRows.forEach(([k, w, l], i) => {
    const r = rows[i] || {};
    check(`open: case ${k} CN/p`, r.kase === k && Math.abs(r.CNW - w) < 1e-9 && Math.abs(r.CNL - l) < 1e-9
      && Math.abs(r.pW - qh * G * w) < 1e-6 && Math.abs(r.pL - qh * G * l) < 1e-6, JSON.stringify(r));
  });
  const tr = o.last.open.trans, expTr = [[-0.8, 0.8], [-0.6, 0.5], [-0.3, 0.3]];
  check('open: three transverse zones', tr.length === 3, JSON.stringify(tr));
  expTr.forEach(([a, b], i) => {
    const z = tr[i] || {};
    check(`open: transverse zone ${i}`, Math.abs(z.A - a) < 1e-9 && Math.abs(z.B - b) < 1e-9
      && Math.abs(z.pA - qh * G * a) < 1e-6 && Math.abs(z.pB - qh * G * b) < 1e-6, JSON.stringify(z));
  });
  check('open: h/L', Math.abs(o.last.open.hL - 20 / 40) < 1e-9, String(o.last.open.hL));
  check('open: walled blocks hidden', await page.evaluate(() =>
    ['wxBlk', 'wyBlk', 'roofBlk', 'sendBlk', 'parapetBlk'].every((id) => document.getElementById(id).style.display === 'none')), 'a walled block is visible');
  check('open: open blocks shown', await page.evaluate(() =>
    ['openBlk', 'openTransBlk', 'frameBlk', 'minBlk'].every((id) => document.getElementById(id).style.display !== 'none')), 'an open block is hidden');
  check('open: revit payload null', o.revit === null, JSON.stringify(o.revit));

  // §28.3.5 — independent recompute with typed constants (Fig. 28.3-1 LC B: 5 = 0.40, 6 = -0.29, 5E = 0.61, 6E = -0.43)
  const f = o.last.frame;
  const Wp = 40, Lr = 100, h = 20, th = 15 * Math.PI / 180;
  const rise = (Wp / 2) * Math.tan(th), eave = h - rise / 2, AE = Wp * eave + 0.5 * Wp * rise;
  const least = Math.min(Wp, Lr), a = Math.max(Math.min(0.1 * least, 0.4 * h), Math.max(0.04 * least, 3));
  const Aedge = a * eave + 0.5 * a * a * Math.tan(th), Abulk = AE - Aedge;   // S-09: strip width a, full height to the roof line
  const gW = (0.40 * Abulk + 0.61 * Aedge) / AE, gL = (-0.29 * Abulk - 0.43 * Aedge) / AE;
  const KB = 1.8 - 0.01 * Wp, KS = 0.60 + 0.073 * (4 - 3) + 1.25 * Math.pow(0, 1.8);
  const F = qh * (gW - gL) * KB * KS * AE;
  check('frame: present for open pitched', !!f, 'frame is null');
  if (f) {
    check('frame: AE', Math.abs(f.AE - AE) < 1e-6, `${f.AE} vs ${AE}`);
    check('frame: a', Math.abs(f.a - a) < 1e-9, `${f.a} vs ${a}`);
    check('frame: KB, KS', Math.abs(f.KB - KB) < 1e-9 && Math.abs(f.KS - KS) < 1e-9, `${f.KB},${f.KS} vs ${KB},${KS}`);
    check('frame: Aedge (incl. gable sliver)', Math.abs(f.Aedge - Aedge) < 1e-6, `${f.Aedge} vs ${Aedge}`);
    check('frame: F', Math.abs(f.F - F) < 1e-4, `${f.F} vs ${F}`);
  }

  // S-01: §28.3.5 in Exposure B with h < 30 ft uses Kz = 0.70 (Table 26.10-1 fn. a), not the Ch. 27 table value
  await page.selectOption('#exp', 'B'); await page.fill('#h', '18');
  await page.click('button.calc-btn');
  const oB = await snapshot();
  const qh28 = 0.00256 * 0.70 * 1.0 * 0.85 * 1.0 * 115 * 115;
  check('frame: Exp B h<30 uses Kz 0.70', oB.last.frame && Math.abs(oB.last.frame.qh - qh28) < 1e-6, JSON.stringify(oB.last.frame && oB.last.frame.qh) + ' vs ' + qh28);
  check('frame: Exp B page qh still Table 26.10-1', Math.abs(oB.last.qh - 0.00256 * (0.57 + (0.62 - 0.57) * 3 / 5) * 0.85 * 115 * 115) < 1e-6, String(oB.last.qh));
  await page.selectOption('#exp', 'C'); await page.fill('#h', '20'); await page.click('button.calc-btn');

  try {
    // ── 4. save/load round-trip on the open case ─────────────────────────────
    const saved = await page.evaluate(() => collectInputsMWFRS());
    await fresh();
    await page.evaluate((d) => { applyInputsMWFRS(d); calculate(); }, saved);
    const o2 = await snapshot();
    const rt = []; diff(o.last, o2.last, 'last', rt, []);
    check('round-trip: open case identical', rt.length === 0, rt.slice(0, 8).join('\n      '));

    // ── 5. legacy save file (roofType 'sloped') loads as gablehip ───────────
    await fresh();
    await page.evaluate(() => applyInputsMWFRS({ _version: 1, _calc: 'mwfrs', V: '120', exp: 'B', encl: 'enclosed', Kzt: '1', Ke: '1', B: '50', D: '80', h: '30', roofType: 'sloped', theta: '20', hp: '0', stories: [{ label: 'Roof', h: '15' }, { label: 'Floor 1', h: '15' }] }));
    check('legacy: roofType mapped', (await page.$eval('#roofType', (e) => e.value)) === 'gablehip', 'not gablehip');
    check('legacy: theta row visible', await page.$eval('#thetaRow', (e) => e.style.display !== 'none'), 'theta hidden');
    await page.click('button.calc-btn');
    const o3 = await snapshot();
    const lg = []; diff(results['enclosed-sloped20-2story'].last, o3.last, 'last', lg, []);
    check('legacy: matches the gablehip case', lg.length === 0, lg.slice(0, 8).join('\n      '));
  } catch (e) {
    check('round-trip/legacy (Task 5 functions)', false, String(e.message || e).split('\n')[0]);
  }

  // ── 6. UI sweep — every enclosure × roof combination renders, no NaN ────
  const combos = [];
  for (const encl of ['enclosed', 'partial', 'partialOpen']) for (const rt2 of ['flat', 'gablehip', 'monoslope', 'mansard']) combos.push({ encl, roofType: rt2 });
  for (const shape of ['monoslope', 'pitched', 'troughed']) for (const flow of ['clear', 'obstructed']) combos.push({ encl: 'open', shape, flow });
  for (const cb of combos) {
    await fresh();
    await page.selectOption('#encl', cb.encl);
    if (cb.roofType) await page.selectOption('#roofType', cb.roofType);
    if (cb.shape) { await page.selectOption('#freeRoofShape', cb.shape); await page.selectOption('#windFlow', cb.flow); }
    await page.click('button.calc-btn');
    const txt = await page.$eval('#results', (e) => e.innerText);
    check(`sweep ${JSON.stringify(cb)}`, !/NaN|undefined/.test(txt) && txt.length > 200, txt.slice(0, 160));
  }
  check('no page errors (all)', pageErrors.length === 0, pageErrors.join('\n      '));
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
