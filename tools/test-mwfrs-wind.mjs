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
// Paths that legitimately differ on every run (the calc stamps today's date).
const ALLOW_ALWAYS = [/^root\.revit\.project\.date$/];
function diff(exp, act, path, out, allow) {
  if (ALLOW_ALWAYS.some((re) => re.test(path)) || allow.some((re) => re.test(path))) return;
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

// ── shared-toolbar Wide toggle: no data-are-wide-default here → narrow (1280px) by default ──
const wide = await page.evaluate(() => ({
  btn: !!document.getElementById('areWideBtn'),
  on: document.body.classList.contains('are-wide'),
  cap: getComputedStyle(document.querySelector('.container')).maxWidth,
  stored: localStorage.getItem('areCalcs_wide:asce716_mwfrs_calculator.html'),
}));
check('wide: button present, default OFF on a calc without data-are-wide-default (cap 1280px, no are-wide class)',
  wide.btn && !wide.on && wide.cap === '1280px' && wide.stored === null, JSON.stringify(wide));

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
    check('legacy: theta row visible', await page.$eval('#thetaRow', (e) => getComputedStyle(e).display !== 'none'), 'theta hidden');
    await page.click('button.calc-btn');
    const o3 = await snapshot();
    const lg = []; diff(results['enclosed-sloped20-2story'].last, o3.last, 'last', lg, []);
    check('legacy: matches the gablehip case', lg.length === 0, lg.slice(0, 8).join('\n      '));
  } catch (e) {
    check('round-trip/legacy (Task 5 functions)', false, String(e.message || e).split('\n')[0]);
  }

  try {
    // ── 5b. G2-01: AREv2 toolbar save/load of the open case (captureState → loadFromState) ──
    // The #diaStory send select is built by calculate() for walled runs only and carries
    // data-are-ignore; an Open snapshot must load ok with no reverse-diff rollback.
    await fresh();
    await page.fill('#V', '115'); await page.selectOption('#exp', 'C'); await page.selectOption('#encl', 'open');
    await page.fill('#B', '40'); await page.fill('#D', '100'); await page.fill('#h', '20');
    await page.selectOption('#freeRoofShape', 'pitched'); await page.selectOption('#windFlow', 'clear');
    await page.selectOption('#ridgeDir', 'D'); await page.selectOption('#roofAngleMode', 'deg'); await page.fill('#theta', '15');
    await page.fill('#numFrames', '4'); await page.fill('#AsArea', '0');
    await page.click('button.calc-btn');
    const tbSnap = await page.evaluate(() => AREv2.captureState());
    await fresh();
    const tbRes = await page.evaluate((s) => JSON.parse(JSON.stringify(AREv2.loadFromState(s))), tbSnap);
    await page.evaluate(() => calculate());
    const o4 = await snapshot();
    const tb = []; diff(o.last, o4.last, 'last', tb, []);
    check('toolbar round-trip: open case identical', tbRes.ok === true && !tbRes.rolledBack && tb.length === 0,
      JSON.stringify(tbRes) + (tb.length ? '\n      ' + tb.slice(0, 8).join('\n      ') : ''));
  } catch (e) {
    check('toolbar round-trip: open case identical', false, String(e.message || e).split('\n')[0]);
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
  // ── 7. input-row visibility by COMPUTED style (are-theme-v2 forces .ig display:flex !important) ──
  const vis = (id) => page.$eval('#' + id, (e) => getComputedStyle(e).display !== 'none');
  await fresh();
  await page.selectOption('#encl', 'enclosed'); await page.selectOption('#roofType', 'flat');
  check('vis enclosed/flat: theta, ridge, angle, frame hidden; hp shown',
    !(await vis('thetaRow')) && !(await vis('ridgeRow')) && !(await vis('angleModeRow')) && !(await vis('frameRowN')) && (await vis('hpRow')), 'computed display wrong');
  await page.selectOption('#roofType', 'gablehip');
  check('vis enclosed/gablehip: theta+ridge shown, frame hidden', (await vis('thetaRow')) && (await vis('ridgeRow')) && !(await vis('frameRowN')), 'computed display wrong');
  await page.selectOption('#roofAngleMode', 'pitch');
  check('vis pitch mode: rise shown, theta hidden', (await vis('pitchRow')) && !(await vis('thetaRow')), 'computed display wrong');
  await page.selectOption('#encl', 'partial');
  check('vis partial/gablehip: frame rows shown', (await vis('frameRowN')) && (await vis('frameRowAs')), 'computed display wrong');
  await page.selectOption('#encl', 'open');
  check('vis open: hp + closed roof hidden; free roof, flow, ridge, frame shown',
    !(await vis('hpRow')) && !(await vis('closedRoofGroup')) && (await vis('openRoofGroup')) && (await vis('windFlowGroup')) && (await vis('ridgeRow')) && (await vis('frameRowN')), 'computed display wrong');
  await page.selectOption('#freeRoofShape', 'monoslope');
  check('vis open/monoslope: frame rows hidden', !(await vis('frameRowN')), 'computed display wrong');

  // ── 8. lateral handoff (Phase 3): buildLateralPayload + the single Diaphragm Designer send ──
  {
    const c = CASES[0];   // enclosed-flat-3story-parapet: stories 14/13/13, B 60, D 120
    const snap = await runWalled(c);
    const lat = await page.evaluate(() => JSON.parse(JSON.stringify(buildLateralPayload())));
    check('lateral: schema are.lateral.v1', !!lat && lat.schema === 'are.lateral.v1', JSON.stringify(lat).slice(0, 200));
    check('lateral: one level per story', !!lat && lat.levels.length === c.stories.length, String(lat && lat.levels.length));
    const badLv = [];
    (lat ? lat.levels : []).forEach((lv, i) => {
      const rx = snap.last.wx.rows[i], ry = snap.last.wy.rows[i];
      if (lv.label !== rx.label) badLv.push(`${i}: label ${lv.label} vs ${rx.label}`);
      if (lv.F_wind_x_strength_lb !== Math.round(rx.F_net)) badLv.push(`${i}: Fx ${lv.F_wind_x_strength_lb} vs ${Math.round(rx.F_net)}`);
      if (lv.F_wind_y_strength_lb !== Math.round(ry.F_net)) badLv.push(`${i}: Fy ${lv.F_wind_y_strength_lb} vs ${Math.round(ry.F_net)}`);
      if (lv.F_parapet_x_strength_lb !== Math.round(rx.F_parapet || 0)) badLv.push(`${i}: parapet ${lv.F_parapet_x_strength_lb} vs ${Math.round(rx.F_parapet || 0)}`);
      if (lv.V_cum_x_strength_lb !== Math.round(rx.V_cum)) badLv.push(`${i}: Vcum ${lv.V_cum_x_strength_lb} vs ${Math.round(rx.V_cum)}`);
      if (lv.sh_ft !== c.stories[i]) badLv.push(`${i}: sh ${lv.sh_ft} vs ${c.stories[i]}`);
    });
    check('lateral: level F_net / F_parapet / V_cum / sh match __mwfrsLast + story inputs', badLv.length === 0, badLv.join('\n      '));
    check('lateral: geometry B/D/h/hp', !!lat && lat.geometry.B_ft === c.B && lat.geometry.D_ft === c.D && lat.geometry.h_ft === c.h && lat.geometry.hp_ft === c.hp, JSON.stringify(lat && lat.geometry));
    check('lateral: meta from the inputs', !!lat && lat.source.mwfrs.calcFile === FILE && lat.source.mwfrs.V_mph === c.V && lat.source.mwfrs.exposure === c.exp && lat.source.mwfrs.enclosure === c.encl, JSON.stringify(lat && lat.source));
    // D1: Project Information rides as titleblock metadata (sanitized, toolbar Project unchanged).
    const tb = await page.evaluate(() => {
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('projName', 'Red <Bluff> Hotel'); set('projNum', '26-038-HNR'); set('projEng', 'NH'); set('projDate', '2026-09-14');
      const r = buildLateralPayload();
      set('projName', ''); set('projNum', ''); set('projEng', '');
      return r && r.titleblock;
    });
    check('lateral: titleblock carries job no. / name / engineer / date (sanitized)',
      !!tb && tb.jobNumber === '26-038-HNR' && tb.projectName === 'Red Bluff Hotel' && tb.engineer === 'NH' && tb.date === '2026-09-14', JSON.stringify(tb));
    const ui = await page.evaluate(() => {
      const sel = document.querySelector('#sendBody #diaStory'), a = document.getElementById('diaSendLink');
      return {
        diaStory: !!sel, ignored: !!sel && sel.hasAttribute('data-are-ignore'),
        opts: sel ? Array.from(sel.options).map((o) => o.text) : [],
        dead: ['sendDir', 'sendStory', 'diaStoryX', 'diaStoryY'].filter((id) => document.getElementById(id)),
        link: a ? getComputedStyle(a).display : 'missing'
      };
    });
    check('send panel: one #diaStory select (data-are-ignore), one option per story, Roof first',
      ui.diaStory && ui.ignored && ui.opts.length === 3 && ui.opts[0] === 'Roof', JSON.stringify(ui));
    check('send panel: #sendDir/#sendStory/#diaStoryX/#diaStoryY gone', ui.dead.length === 0, ui.dead.join(', '));
    check('send panel: popup-fallback link hidden by default', ui.link === 'none', ui.link);
    // Click with window.open stubbed: localStorage record + URL for the chosen level.
    await page.evaluate(() => { localStorage.removeItem('are_lateral_v1'); window.__opened = []; window.open = function (u) { window.__opened.push(u); return {}; }; });
    await page.selectOption('#diaStory', '1');
    await page.click('#diaSendBtn');
    const sent = await page.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('are_lateral_v1') || 'null'), urls: window.__opened, link: getComputedStyle(document.getElementById('diaSendLink')).display }));
    check('send: localStorage.are_lateral_v1 written for the diaphragm file',
      !!sent.ls && sent.ls.file === 'rectangular_diaphragm_calculator.html' && !!sent.ls.record && sent.ls.record.schema === 'are.lateral.v1' && sent.ls.record.levels.length === 3 && Date.now() - sent.ls.ts < 60000, JSON.stringify(sent.ls).slice(0, 200));
    check('send: staged record carries the four-key titleblock', !!sent.ls && !!sent.ls.record.titleblock && ['projectName', 'jobNumber', 'engineer', 'date'].every((k) => typeof sent.ls.record.titleblock[k] === 'string'), JSON.stringify(sent.ls && sent.ls.record.titleblock));
    const u = sent.urls[0] || '';
    check('send: URL carries lat=1 + legacy vx/vy/B/D/story for the chosen level',
      sent.urls.length === 1 && /rectangular_diaphragm_calculator\.html\?src=mwfrs&lat=1&/.test(u) && u.indexOf('&vx=' + Math.round(snap.last.wx.rows[1].F_net)) > 0 && u.indexOf('&vy=' + Math.round(snap.last.wy.rows[1].F_net)) > 0 && u.indexOf('&B=60&D=120') > 0 && /&story=Floor(%20|\+)1$/.test(u), u);
    check('send: link stays hidden when the popup opened', sent.link === 'none', sent.link);
    // Popup blocked: window.open returns null -> the link is revealed with the same URL.
    await page.evaluate(() => { window.open = function () { return null; }; });
    await page.click('#diaSendBtn');
    const blocked = await page.evaluate(() => { const a = document.getElementById('diaSendLink'); return { display: getComputedStyle(a).display, href: a.getAttribute('href'), target: a.target }; });
    check('send: popup blocked reveals #diaSendLink with the URL', blocked.display !== 'none' && blocked.href === u && blocked.target === '_blank', JSON.stringify(blocked));
    // Open building: no story rows -> null payload (caller alerts, like the Revit export).
    await fresh();
    await page.selectOption('#encl', 'open'); await page.click('button.calc-btn');
    check('lateral: open building -> null payload', (await page.evaluate(() => buildLateralPayload())) === null, 'not null');
    // Static: the dead shearwall send is gone from the source.
    const src = readFileSync(PUBLIC_DIR + 'Calcs/' + FILE, 'utf8');
    const deadSrc = ['sendDir', 'sendStory', 'diaStoryX', 'diaStoryY', 'updateSendPreview', 'doSendShear'].filter((w) => src.indexOf(w) >= 0);
    check('source: no sendDir/sendStory/diaStoryX/diaStoryY/updateSendPreview/doSendShear', deadSrc.length === 0, deadSrc.join(', '));
  }

  // ── 9. P5.1: reindexStories() keeps user-typed story labels ─────────────
  // Only a blank label or one still on the auto pattern (Roof / Floor n) is
  // renumbered on add/remove; '3RD' / '2ND' survive. Row i's auto label is
  // 'Floor i' (row 0 = Roof), so a new fourth row reads 'Floor 3'.
  {
    await fresh();
    await setStories([14, 13, 13]);
    const labels = async () => (await page.$$eval('#storyRows input[type=text]', (els) => els.map((e) => e.value))).join(',');
    const inputs = await page.$$('#storyRows input[type=text]');
    await inputs[1].fill('3RD'); await inputs[2].fill('2ND');
    await page.click('.btn-add-floor');
    check('labels: add keeps Roof/3RD/2ND, new row auto Floor 3', (await labels()) === 'Roof,3RD,2ND,Floor 3', await labels());
    await page.$$eval('#storyRows .btn-x', (bs) => bs[bs.length - 1].click());
    check('labels: remove keeps Roof/3RD/2ND', (await labels()) === 'Roof,3RD,2ND', await labels());
    // Auto labels still renumber: blank the 3RD row, add a row, then remove row 1.
    await (await page.$$('#storyRows input[type=text]'))[1].fill('');
    await page.click('.btn-add-floor');
    check('labels: blank row refilled with its auto label', (await labels()) === 'Roof,Floor 1,2ND,Floor 3', await labels());
    await page.$$eval('#storyRows .btn-x', (bs) => bs[1].click());
    check('labels: remove Floor 1 -> 2ND stays, last auto row renumbers to Floor 2', (await labels()) === 'Roof,2ND,Floor 2', await labels());
    await page.click('button.calc-btn');
    const lat9 = await page.evaluate(() => buildLateralPayload().levels.map((l) => l.label).join(','));
    check('labels: lateral payload carries the kept labels', lat9 === 'Roof,2ND,Floor 2', lat9);
  }

  // ── 10. parapet steps plan 2026-09-23 (WP-2): typical parapet height, payload, legacy loaders ──
  try {
    const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
    // 10a. blank #hpTyp = max: the baseline case carries hpTyp = hp and the additive parapet keys.
    const c0 = results['enclosed-flat-3story-parapet'].last, p0 = c0.parapet;
    check('hpTyp blank: __mwfrsLast.hpTyp = hp, parapet.hp_typ = hp_max = 3', c0.hpTyp === 3 && p0.hp_typ === 3 && p0.hp_max === 3 && p0.z_p === 43,
      JSON.stringify({ hpTyp: c0.hpTyp, hp_typ: p0.hp_typ, hp_max: p0.hp_max, z_p: p0.z_p }));
    check('hpTyp blank: pp_ww 1.5qp, pp_lw 1.0qp (magnitude), pp_net 2.5qp, w_typ 2.5qp*3',
      near(p0.pp_ww, 1.5 * p0.qp, 1e-12) && near(p0.pp_lw, p0.qp, 1e-12) && near(p0.pp_net, 2.5 * p0.qp, 1e-12) && near(p0.w_typ_plf, 7.5 * p0.qp, 1e-9),
      JSON.stringify(p0));

    // 10b. hp 3, hpTyp 2 -> F_parapet x 2/3 (both directions), qp unchanged, roof F_net and V_cum drop by F_par/3.
    const snap2 = await (async () => {
      await fresh();
      const c = CASES[0];
      await page.fill('#V', String(c.V)); await page.selectOption('#exp', c.exp); await page.selectOption('#encl', c.encl);
      await page.fill('#B', String(c.B)); await page.fill('#D', String(c.D)); await page.fill('#h', String(c.h)); await page.fill('#hp', '3');
      await page.fill('#hpTyp', '2');
      await setStories(c.stories);
      await page.click('button.calc-btn');
      return snapshot();
    })();
    const L2 = snap2.last, bad2 = [];
    ['wx', 'wy'].forEach((d) => {
      const b = c0[d].rows[0], a = L2[d].rows[0];
      if (!near(a.F_parapet, b.F_parapet * 2 / 3, 1e-6)) bad2.push(`${d} F_parapet ${a.F_parapet} vs ${b.F_parapet * 2 / 3}`);
      if (!near(a.F_net, b.F_net - b.F_parapet / 3, 1e-6)) bad2.push(`${d} F_net ${a.F_net} vs ${b.F_net - b.F_parapet / 3}`);
      const n = a.V_cum, m = c0[d].rows[c0[d].rows.length - 1].V_cum - b.F_parapet / 3, last = L2[d].rows[L2[d].rows.length - 1].V_cum;
      if (!near(last, m, 1e-6)) bad2.push(`${d} base V ${last} vs ${m} (${n})`);
    });
    if (L2.parapet.qp !== c0.parapet.qp || L2.parapet.z_p !== 43) bad2.push(`qp ${L2.parapet.qp} vs ${c0.parapet.qp}, z_p ${L2.parapet.z_p}`);
    if (L2.hpTyp !== 2 || L2.parapet.hp_typ !== 2 || L2.parapet.hp_max !== 3 || L2.hp !== 3) bad2.push(`hpTyp ${L2.hpTyp}, hp_typ ${L2.parapet.hp_typ}, hp_max ${L2.parapet.hp_max}`);
    check('hpTyp 2 / hp 3: F_parapet x 2/3, q_p and z_p unchanged', bad2.length === 0, bad2.join('\n      '));
    const par2 = await page.$eval('#parapetBody', (e) => e.innerText);
    check('hpTyp 2: parapet block shows h_p,typ, w_typ and the Diaphragm Designer step note',
      /2\.0 ft/.test(par2) && /Diaphragm Designer/.test(par2) && /flat roofs only/.test(par2) && !/NaN|undefined/.test(par2), par2.slice(0, 300));
    check('hpTyp 2: Revit payload additive keys', snap2.revit.parapet.hp_ft === 3 && snap2.revit.parapet.hp_max_ft === 3 && snap2.revit.parapet.hp_typ_ft === 2 && snap2.revit.inputs.parapet_typ_ft === 2,
      JSON.stringify(snap2.revit.parapet));
    // hpTyp above hp is capped at hp (typical cannot exceed max).
    await page.fill('#hpTyp', '5'); await page.click('button.calc-btn');
    const capped = await page.evaluate(() => ({ t: window.__mwfrsLast.parapet.hp_typ, warn: /capped/.test(document.getElementById('parapetBody').innerText) }));
    check('hpTyp > hp: capped at hp with a warning', capped.t === 3 && capped.warn, JSON.stringify(capped));

    // 10c. Red Bluff (fixtures/lateral/red-bluff/mwfrs-state.json, h 35.5, hp 4.5) with hpTyp 3 — old state loaded
    //      through the toolbar path, then hpTyp set. Independent: Kz(40 ft, B) = 0.76, Ke 0.984, V 115.
    const RB = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/lateral/red-bluff/mwfrs-state.json', import.meta.url)), 'utf8'));
    check('fixture: Red Bluff state predates #hpTyp', !Object.prototype.hasOwnProperty.call(RB.fields, '#hpTyp'), 'fixture already has #hpTyp');
    await fresh();
    await page.fill('#hpTyp', '2');   // page holds a typical height; the old file must clear it
    const rbRes = await page.evaluate((s) => JSON.parse(JSON.stringify(AREv2.loadFromState(s))), RB);
    const rbAfter = await page.evaluate(() => ({ hpTyp: document.getElementById('hpTyp').value, hp: document.getElementById('hp').value }));
    check('old state (no #hpTyp) into a page holding hpTyp 2: ok, no rollback, no mismatch, #hpTyp reset to blank',
      rbRes.ok === true && !rbRes.rolledBack && rbRes.mismatches.missingOnPage.length === 0 && rbRes.mismatches.notInFile.length === 0 && rbAfter.hpTyp === '' && rbAfter.hp === '4.5',
      JSON.stringify({ rbRes, rbAfter }));
    await page.evaluate(() => calculate());
    const rbMax = await page.evaluate(() => ({ x: window.__mwfrsLast.wx.rows[0].F_parapet, y: window.__mwfrsLast.wy.rows[0].F_parapet }));
    check('old Red Bluff state reproduces the fixture parapet forces (87,160 / 29,053 lb)', Math.round(rbMax.x) === 87160 && Math.round(rbMax.y) === 29053, JSON.stringify(rbMax));
    await page.fill('#hpTyp', '3'); await page.click('button.calc-btn');
    const rb = await page.evaluate(() => {
      const L = window.__mwfrsLast;
      let passed = null;
      const orig = LH.fromMwfrs;
      LH.fromMwfrs = function (o) { passed = JSON.parse(JSON.stringify({ hp: o.hp, hpTyp: o.hpTyp, parapet: o.parapet, roofType: o.roofType, theta: o.theta })); return orig.apply(this, arguments); };
      let rec;
      try { rec = JSON.parse(JSON.stringify(buildLateralPayload())); } finally { LH.fromMwfrs = orig; }
      return { Fx: L.wx.rows[0].F_parapet, Fy: L.wy.rows[0].F_parapet, p: L.parapet, passed, rec };
    });
    const qpRB = 0.00256 * 0.76 * 1.0 * 0.85 * 0.984 * 115 * 115;
    check('Red Bluff hpTyp 3: F_par,x ~ 58,106.8 lb, F_par,y ~ 19,368.9 lb',
      near(rb.Fx, 58106.8, 0.5) && near(rb.Fy, 19368.9, 0.5) && near(rb.Fx, 2.5 * qpRB * 3 * 360, 1e-6) && near(rb.Fy, 2.5 * qpRB * 3 * 120, 1e-6), `${rb.Fx} / ${rb.Fy}`);
    check('Red Bluff hpTyp 3: q_p 21.52 at z_p 40, p_ww 32.2816, p_lw 21.52, p_net 53.80, w_typ 161.408',
      near(rb.p.qp, qpRB, 1e-9) && rb.p.z_p === 40 && near(rb.p.pp_ww, 32.2816, 5e-4) && near(rb.p.pp_lw, qpRB, 1e-9) && near(rb.p.pp_net, 53.80, 5e-3) && near(rb.p.w_typ_plf, 161.408, 5e-3),
      JSON.stringify(rb.p));

    // 10d. handoff payload: the object passed to LH.fromMwfrs and the returned record both carry the parapet block.
    const KEYS = ['hp_max_ft', 'hp_typ_ft', 'z_p_ft', 'qp_psf', 'GCpn_ww', 'GCpn_lw', 'pp_ww_psf', 'pp_lw_psf', 'pp_net_psf', 'w_typ_plf', 'roofType', 'roof_theta_deg', 'roofFlat'];
    const pp = rb.passed && rb.passed.parapet;
    check('payload: fromMwfrs input carries hpTyp 3, roofType/theta and parapet with exactly the contract keys',
      !!pp && rb.passed.hpTyp === 3 && rb.passed.hp === 4.5 && rb.passed.roofType === 'flat' && rb.passed.theta === 0
      && JSON.stringify(Object.keys(pp).sort()) === JSON.stringify(KEYS.slice().sort()),
      JSON.stringify(rb.passed));
    check('payload: parapet values (strength, q_p at h + h_p,max; GCpn 1.5 / 1.0; flat)',
      !!pp && pp.hp_max_ft === 4.5 && pp.hp_typ_ft === 3 && pp.z_p_ft === 40 && near(pp.qp_psf, qpRB, 1e-9) && pp.GCpn_ww === 1.5 && pp.GCpn_lw === 1.0
      && near(pp.pp_ww_psf, 1.5 * qpRB, 1e-9) && near(pp.pp_lw_psf, qpRB, 1e-9) && near(pp.pp_net_psf, 2.5 * qpRB, 1e-9) && near(pp.w_typ_plf, 7.5 * qpRB, 1e-9)
      && pp.roofType === 'flat' && pp.roof_theta_deg === 0 && pp.roofFlat === true, JSON.stringify(pp));
    check('payload: returned record carries parapet + geometry.hp_typ_ft 3 (levels unchanged in shape)',
      !!rb.rec && !!rb.rec.parapet && rb.rec.parapet.hp_typ_ft === 3 && rb.rec.geometry.hp_typ_ft === 3 && rb.rec.geometry.hp_ft === 4.5
      && rb.rec.levels[0].F_parapet_x_strength_lb === Math.round(rb.Fx), JSON.stringify(rb.rec && { parapet: rb.rec.parapet, geometry: rb.rec.geometry }));
    // gable roof: parapet block says not flat (R20 gate lives on the Diaphragm).
    await page.selectOption('#roofType', 'gablehip'); await page.selectOption('#roofAngleMode', 'deg'); await page.fill('#theta', '5');
    await page.click('button.calc-btn');
    const gb = await page.evaluate(() => buildLateralPayload().parapet);
    check('payload: gable/hip roof -> roofFlat false, roofType gablehip, theta carried', !!gb && gb.roofFlat === false && gb.roofType === 'gablehip' && gb.roof_theta_deg === 5, JSON.stringify(gb));
    // hp = 0 -> parapet null, hp_typ_ft 0.
    await page.fill('#hp', '0'); await page.click('button.calc-btn');
    const np = await page.evaluate(() => { const r = buildLateralPayload(); return { parapet: r.parapet, g: r.geometry }; });
    check('payload: hp 0 -> parapet null, geometry.hp_typ_ft 0', np.parapet === null && np.g.hp_typ_ft === 0, JSON.stringify(np));

    // 10e. new-format toolbar round trip keeps hpTyp.
    await fresh();
    await page.fill('#hp', '4'); await page.fill('#hpTyp', '2.5'); await page.click('button.calc-btn');
    const newSnap = await page.evaluate(() => AREv2.captureState());
    await fresh();
    const nRes = await page.evaluate((s) => JSON.parse(JSON.stringify(AREv2.loadFromState(s))), newSnap);
    const nVal = await page.$eval('#hpTyp', (e) => e.value);
    check('toolbar round trip: #hpTyp captured and restored', newSnap.fields['#hpTyp'] === '2.5' && nRes.ok === true && !nRes.rolledBack && nVal === '2.5', JSON.stringify({ f: newSnap.fields['#hpTyp'], nRes, nVal }));

    // 10f. legacy JSON (applyInputsMWFRS) without hpTyp resets a held value; with hpTyp restores it.
    await fresh();
    await page.fill('#hpTyp', '2');
    const legacyObj = { _version: 2, _calc: 'mwfrs', V: '115', exp: 'B', encl: 'enclosed', Kzt: '1', Ke: '0.984', groundElev: '459', B: '120', D: '360', h: '35.5', roofType: 'flat', hp: '4.5', stories: [{ label: 'Roof', h: '11' }, { label: '3RD', h: '10.5' }, { label: '2ND', h: '14' }] };
    await page.evaluate((d) => applyInputsMWFRS(d), legacyObj);
    const lj = await page.evaluate(() => { calculate(); return { v: document.getElementById('hpTyp').value, Fx: window.__mwfrsLast.wx.rows[0].F_parapet }; });
    check('legacy JSON (no hpTyp) into a page holding hpTyp 2: #hpTyp reset to blank, typical = max', lj.v === '' && Math.round(lj.Fx) === 87160, JSON.stringify(lj));
    const saved10 = await page.evaluate(() => { document.getElementById('hpTyp').value = '3'; return collectInputsMWFRS(); });
    await fresh();
    await page.evaluate((d) => { applyInputsMWFRS(d); calculate(); }, saved10);
    const lj2 = await page.evaluate(() => ({ v: document.getElementById('hpTyp').value, Fx: window.__mwfrsLast.wx.rows[0].F_parapet }));
    check('JSON save/load carries hpTyp', saved10.hpTyp === '3' && lj2.v === '3' && near(lj2.Fx, 58106.8, 0.5), JSON.stringify(lj2));

    // 10g. #hpTypRow visibility mirrors #hpRow.
    await fresh();
    await page.selectOption('#encl', 'enclosed');
    const shown = await vis('hpTypRow');
    await page.selectOption('#encl', 'open');
    const hidden = !(await vis('hpTypRow')) && !(await vis('hpRow'));
    await page.selectOption('#encl', 'partial');
    check('vis: #hpTypRow shown when walled, hidden for open (mirrors #hpRow)', shown && hidden && (await vis('hpTypRow')), `shown ${shown}, hidden ${hidden}`);

    // 10h. nomenclature: no "along EW/NS" phrasing in the DOM (inputs, results, drawings).
    await fresh();
    await page.fill('#hp', '3'); await page.click('button.calc-btn');
    const domTxt = await page.evaluate(() => document.body.innerText + ' ' + Array.from(document.querySelectorAll('svg text, option, label, .blk-hd')).map((e) => e.textContent).join(' '));
    check('nomenclature: no "along EW/NS" in DOM text', !/along\s+(the\s+)?(EW|NS)(?![A-Za-z])/i.test(domTxt), (domTxt.match(/.{0,40}along\s+(the\s+)?(EW|NS).{0,40}/i) || [''])[0]);
    check('nomenclature: approved Wind-X / Wind-Y wording present',
      domTxt.indexOf('Wind-X:') >= 0 && domTxt.indexOf('wind E–W, normal to the E and W faces') >= 0 && domTxt.indexOf('resisted in-plane by the N and S shearwalls (EW walls)') >= 0
      && domTxt.indexOf('wind N–S, normal to the N and S faces') >= 0 && domTxt.indexOf('resisted in-plane by the E and W shearwalls (NS walls)') >= 0, 'wording missing');
  } catch (e) {
    check('parapet steps WP-2 block', false, String(e.message || e).split('\n')[0]);
  }
  check('no page errors (all)', pageErrors.length === 0, pageErrors.join('\n      '));
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
