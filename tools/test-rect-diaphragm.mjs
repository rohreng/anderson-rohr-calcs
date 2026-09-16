// =============================================================================
// Rectangular diaphragm — persistence + golden-number test
// -----------------------------------------------------------------------------
// Loads fixtures/lateral/red-bluff/diaphragm-roof-state.json (the are-state of
// the ROOF LEVEL file behind plan F6, identity fields blanked) into the live page in
// headless Chromium with every request fulfilled from public/ on disk.
//
// That file carries the legacy per-row keys #swX_*_25 but no #swX_*_24
// (swIdCounter was never re-indexed on delete), so before the Phase 0 fix
// AREv2.loadFromState rolled back and the toolbar asked "Load it anyway?". The
// test proves: legacy file loads clean through both loadFromState and the real
// toolbar Load button (no dialog), calculate() reproduces the golden reactions,
// a fresh save carries #swJSON as the only sw* key, and a save → load round
// trip rebuilds every row.
// Usage: node tools/test-rect-diaphragm.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/lateral/red-bluff/diaphragm-roof-state.json', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'rectangular_diaphragm_calculator.html';

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

// Golden reactions (lb) for the ROOF fixture: B=120, D=360, Vx=131.31 k,
// Vy=40.86 k. Indexed on the loc-sorted wall list, not input order.
const GOLD_X = [2736].concat(new Array(23).fill(5471)).concat([2736]);      // A1 … A25
const GOLD_Y = [5107, 10215, 10215, 10215, 5107];                             // AA AC BB DB BD
const GOLD_X_LABELS = Array.from({ length: 25 }, (_, i) => 'A' + (i + 1));
const GOLD_Y_LABELS = ['AA', 'AC', 'BB', 'DB', 'BD'];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const dialogs = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.waitForFunction(() => window.AREv2 && window.AREv2.isReady());

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// Rows as the page sees them: label/len/loc read off the .sw-row inputs.
const readRows = () => page.evaluate(() => {
  const rd = (dir) => Array.from(document.querySelectorAll('#sw' + dir + ' .sw-row')).map((r) => ({
    label: r.querySelector('.sw-label').value,
    len: parseFloat(r.querySelector('.sw-len').value),
    loc: parseFloat(r.querySelector('.sw-loc').value)
  }));
  return { X: rd('X'), Y: rd('Y') };
});
const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fixtureRows = JSON.parse(fixture.fields['#swJSON']);

// ── 1. shim installed ───────────────────────────────────────────────────────
const shim = await page.evaluate(() => window.AREv2._diaShim === true);
check('diaphragm load shim installed (AREv2._diaShim)', shim, String(shim));

// ── 2. legacy ROOF file through AREv2.loadFromState: clean, no rollback ─────
const res = await page.evaluate((s) => JSON.parse(JSON.stringify(window.AREv2.loadFromState(s))), fixture);
check('ROOF fixture loadFromState ok:true', res.ok === true && !res.rolledBack, JSON.stringify(res));
check('ROOF fixture: nothing missing on page', res.mismatches.missingOnPage.length === 0, res.mismatches.missingOnPage.join(', '));
check('ROOF fixture: nothing on page not in file', res.mismatches.notInFile.length === 0, res.mismatches.notInFile.join(', '));
let rows = await readRows();
check('ROOF fixture rebuilt 25 X rows + 5 Y rows', rows.X.length === 25 && rows.Y.length === 5, `X=${rows.X.length} Y=${rows.Y.length}`);
check('ROOF fixture rows match #swJSON', sameRows(rows, fixtureRows), JSON.stringify(rows).slice(0, 300));
const geom = await page.evaluate(() => ({ B: document.getElementById('B').value, D: document.getElementById('D').value, Vx: document.getElementById('Vx').value, Vy: document.getElementById('Vy').value }));
check('ROOF fixture geometry/forces restored', geom.B === '120' && geom.D === '360' && geom.Vx === '131.31' && geom.Vy === '40.86', JSON.stringify(geom));
check('ROOF fixture: no dialog', dialogs.length === 0, dialogs.join('\n      '));

// ── 3. golden numbers ───────────────────────────────────────────────────────
const gold = await page.evaluate(() => {
  const B = parseFloat(document.getElementById('B').value), D = parseFloat(document.getElementById('D').value);
  const Vx = parseFloat(document.getElementById('Vx').value), Vy = parseFloat(document.getElementById('Vy').value);
  const rd = (dir) => Array.from(document.querySelectorAll('#sw' + dir + ' .sw-row')).map((r) => ({
    label: r.querySelector('.sw-label').value,
    len: parseFloat(r.querySelector('.sw-len').value) || 1,
    loc: parseFloat(r.querySelector('.sw-loc').value) || 0
  }));
  const wx = window.calcDir(Vx, D, B, rd('X'), 'Wind-X (EW)');
  const wy = window.calcDir(Vy, B, D, rd('Y'), 'Wind-Y (NS)');
  window.calculate();
  return {
    X: wx.reactions.map((r) => r * 1000), Xlab: wx.sws.map((s) => s.label),
    Y: wy.reactions.map((r) => r * 1000), Ylab: wy.sws.map((s) => s.label),
    shown: document.getElementById('results').style.display !== 'none',
    // Line table: SW Line | Location | Length | Reaction R (kips, 2 dp) | v_sw
    wxRows: Array.from(document.querySelectorAll('#wxBody tbody tr')).map((r) => r.cells[0].innerText + '=' + r.cells[3].innerText),
    wyRows: Array.from(document.querySelectorAll('#wyBody tbody tr')).map((r) => r.cells[0].innerText + '=' + r.cells[3].innerText)
  };
});
const within = (got, want) => got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) <= 1);
check('Wind-X reactions: A1/A25 2,736 lb, A2…A24 5,471 lb (±1 lb)', within(gold.X, GOLD_X), gold.X.map((v) => v.toFixed(1)).join(' '));
check('Wind-X reactions indexed on loc-sorted lines A1…A25', gold.Xlab.join(',') === GOLD_X_LABELS.join(','), gold.Xlab.join(','));
check('Wind-Y reactions: AA 5,107 / AC,BB,DB 10,215 / BD 5,107 lb (±1 lb)', within(gold.Y, GOLD_Y), gold.Y.map((v) => v.toFixed(1)).join(' '));
check('Wind-Y reactions indexed on loc-sorted lines AA,AC,BB,DB,BD', gold.Ylab.join(',') === GOLD_Y_LABELS.join(','), gold.Ylab.join(','));
// Rendered R is kips to 2 dp (f2 rounds half up: 10.215 -> 10.22).
const wantX = ['A1=2.74'].concat(GOLD_X_LABELS.slice(1, 24).map((l) => l + '=5.47')).concat(['A25=2.74']).join(' ');
const wantY = 'AA=5.11 AC=10.22 BB=10.22 DB=10.22 BD=5.11';
check('calculate() renders the Wind-X line table (A1=2.74, A2…A24=5.47, A25=2.74 kips)', gold.shown && gold.wxRows.join(' ') === wantX, gold.wxRows.join(' '));
check('calculate() renders the Wind-Y line table (' + wantY + ')', gold.wyRows.join(' ') === wantY, gold.wyRows.join(' '));
check('calculate(): no alert', dialogs.length === 0, dialogs.join('\n      '));

// ── 4. save capture: #swJSON is the only sw* key ────────────────────────────
const cap = await page.evaluate(() => JSON.parse(JSON.stringify(window.AREv2.captureState())));
const swKeys = Object.keys(cap.fields).filter((k) => /^#sw/i.test(k));
check('capture: #swJSON is the only sw* key', swKeys.length === 1 && swKeys[0] === '#swJSON', swKeys.join(', '));
check('capture: no problems', (cap._problems || []).length === 0, (cap._problems || []).join('; '));
check('capture: no row inputs captured by path', Object.keys(cap.fields).every((k) => k.indexOf('path:') !== 0), Object.keys(cap.fields).filter((k) => k.indexOf('path:') === 0).join(', '));

// ── 5. round trip: capture → perturb → loadFromState rebuilds every row ─────
await page.evaluate(() => {
  window.rebuildSWRows('X', [{ label: 'North Wall', len: 60, loc: 120 }, { label: 'South Wall', len: 60, loc: 0 }]);
  window.rebuildSWRows('Y', [{ label: 'East Wall', len: 120, loc: 60 }]);
  window.updateDiagram();
});
rows = await readRows();
check('perturbed page has 2 X + 1 Y rows', rows.X.length === 2 && rows.Y.length === 1, `X=${rows.X.length} Y=${rows.Y.length}`);
const rt = await page.evaluate((s) => JSON.parse(JSON.stringify(window.AREv2.loadFromState(s))), cap);
check('round trip loadFromState ok:true, zero mismatches',
  rt.ok === true && !rt.rolledBack && rt.mismatches.missingOnPage.length === 0 && rt.mismatches.notInFile.length === 0, JSON.stringify(rt));
rows = await readRows();
check('round trip rebuilt 25 X rows + 5 Y rows with the same label/len/loc', sameRows(rows, fixtureRows), JSON.stringify(rows).slice(0, 300));
const cap2 = await page.evaluate(() => JSON.parse(JSON.stringify(window.AREv2.captureState().fields)));
check('round trip: second capture identical to the first', JSON.stringify(cap2) === JSON.stringify(cap.fields), JSON.stringify(cap2).slice(0, 300));

// ── 6. real toolbar Load of the legacy file: no "Load it anyway?" dialog ────
// http://calcs.test is not a secure context, so areLoad() falls through to the
// <input type=file> path, which Playwright can feed through the file chooser.
const legacyHtml = '<!doctype html><html><body><script type="application/json" id="are-state">' +
  JSON.stringify(fixture).replace(/<\//g, '<\\/') + '</' + 'script></body></html>';
await page.evaluate(() => { window.rebuildSWRows('X', [{ label: 'x', len: 1, loc: 0 }]); window.updateDiagram(); });
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#areLoadBtn')]);
await chooser.setFiles({ name: 'legacy-roof.html', mimeType: 'text/html', buffer: Buffer.from(legacyHtml) });
await page.waitForFunction(() => document.querySelectorAll('#swX .sw-row').length === 25, null, { timeout: 5000 }).catch(() => {});
rows = await readRows();
check('toolbar Load of legacy file: 25 X + 5 Y rows, no confirm dialog', sameRows(rows, fixtureRows) && dialogs.length === 0,
  `X=${rows.X.length} Y=${rows.Y.length} dialogs=${JSON.stringify(dialogs)}`);

// ── 7. legacy JSON Load Inputs uses the shared row markup ───────────────────
const legacyJson = {
  _version: 1, _calc: 'diaphragm', projName: '', level: 'Roof', projDate: '2026-09-15', projEng: '',
  B: '120', D: '360', Vx: '131.31', Vy: '40.86', Vx_s: '0', Vy_s: '0',
  swX: fixtureRows.X.map((r) => ({ label: r.label, len: String(r.len), loc: String(r.loc) })),
  swY: fixtureRows.Y.map((r) => ({ label: r.label, len: String(r.len), loc: String(r.loc) }))
};
await page.evaluate(() => { window.rebuildSWRows('X', [{ label: 'x', len: 1, loc: 0 }]); window.updateDiagram(); });
const dialogsBefore = dialogs.length;
await page.setInputFiles('#diaLoadFile', { name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyJson)) });
await page.waitForFunction(() => document.querySelectorAll('#swX .sw-row').length === 25, null, { timeout: 5000 }).catch(() => {});
const lj = await page.evaluate(() => ({
  ignored: Array.from(document.querySelectorAll('.sw-row input')).every((el) => el.hasAttribute('data-are-ignore')),
  inputs: document.querySelectorAll('.sw-row input').length,
  rm: document.querySelectorAll('.sw-row .btn-rm-sw').length,
  swJSON: document.getElementById('swJSON').value
}));
rows = await readRows();
check('JSON Load Inputs rebuilt 25 X + 5 Y rows', sameRows(rows, fixtureRows), JSON.stringify(rows).slice(0, 300));
check('JSON Load Inputs rows carry data-are-ignore and the shared remove button', lj.ignored && lj.inputs === 90 && lj.rm === 30, JSON.stringify(lj).slice(0, 200));
check('JSON Load Inputs mirrored into #swJSON', JSON.stringify(JSON.parse(lj.swJSON)) === JSON.stringify(fixtureRows), lj.swJSON.slice(0, 200));
check('JSON Load Inputs shows its success alert only', dialogs.length === dialogsBefore + 1 && dialogs[dialogsBefore] === 'Inputs loaded successfully.', JSON.stringify(dialogs));

// ── 8. localStorage handoff to the masonry calc still written ───────────────
const ls = await page.evaluate(() => { window.calculate(); return JSON.parse(localStorage.getItem('ARE_diaphragm') || 'null'); });
check('localStorage.ARE_diaphragm written by calculate()', !!ls && ls.B === 120 && ls.D === 360 && ls.gov_v_x > 0, JSON.stringify(ls));

// ── 9. quick send to Stacked Shearwall (Phase 4b): one level, walls from the page ──
// Page state: ROOF fixture rows (25 X + 5 Y), #level Roof, no #mwfrsJSON.
await page.evaluate(() => { localStorage.removeItem('are_lateral_v1'); window.__opened = []; window.open = function (u) { window.__opened.push(u); return {}; }; });
check('quick send button shown after calculate()', await page.$eval('#sendToShearwallBtn', (e) => e.style.display !== 'none'), 'hidden');
await page.click('#swSendBtn');
const qs = await page.evaluate(() => ({ ls: JSON.parse(localStorage.getItem('are_lateral_v1') || 'null'), urls: window.__opened, info: document.getElementById('swSendInfo').textContent, link: getComputedStyle(document.getElementById('swSendLink')).display }));
check('quick send: are_lateral_v1 for the stacked shearwall — one level, 25 X + 5 Y walls',
  !!qs.ls && qs.ls.file === 'stacked_shearwall_calculator.html' && !!qs.ls.record && qs.ls.record.schema === 'are.lateral.v1' && qs.ls.record.levels.length === 1
  && qs.ls.record.levels[0].label === 'Roof' && qs.ls.record.levels[0].walls.X.length === 25 && qs.ls.record.levels[0].walls.Y.length === 5 && qs.ls.record.levels[0].F_wind_x_strength_lb === 131310,
  JSON.stringify(qs.ls).slice(0, 300));
check('quick send: opens stacked_shearwall_calculator.html?src=diaphragm&lat=1', qs.urls.length === 1 && /stacked_shearwall_calculator\.html\?src=diaphragm&lat=1$/.test(qs.urls[0]) && qs.link === 'none', JSON.stringify(qs));
check('quick send: "no story table" warning shown (no #mwfrsJSON on this page)', /no story table/.test(qs.info), qs.info);
await page.evaluate(() => { window.open = function () { return null; }; });
await page.click('#swSendBtn');
const qsb = await page.evaluate(() => { const a = document.getElementById('swSendLink'); return { display: getComputedStyle(a).display, href: a.getAttribute('href') }; });
check('quick send: popup blocked reveals #swSendLink', qsb.display !== 'none' && qsb.href === qs.urls[0], JSON.stringify(qsb));

// ── 10. MWFRS whole-building import (?src=mwfrs&lat=1) ──────────────────────
const MW_RECORD = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/lateral/red-bluff/mwfrs-record.json', import.meta.url)), 'utf8'));
const LAT_KEY = 'are_lateral_v1';
const val = (id) => page.$eval('#' + id, (e) => e.value);
const shown = (id) => page.$eval('#' + id, (e) => getComputedStyle(e).display !== 'none');
const levelOpts = () => page.$$eval('#mwfrsLevel option', (os) => os.map((o) => o.text + (o.selected ? '*' : '')));
const capFields = () => page.evaluate(() => JSON.parse(JSON.stringify(window.AREv2.captureState().fields)));
async function gotoLat(query, seed) {
  // Seed on the current same-origin page so the key is in place before the import IIFE runs.
  await page.evaluate(([k, v]) => { localStorage.removeItem(k); if (v) localStorage.setItem(k, v); }, [LAT_KEY, seed ? JSON.stringify(seed) : '']);
  await page.goto('http://calcs.test/Calcs/' + FILE + query, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.waitForFunction(() => window.AREv2 && window.AREv2.isReady());
}
await gotoLat('', null);
const defaultRows = await readRows();
check('fresh page: 2 X + 2 Y default rows, #loadLevel strength, #mwfrsRow hidden',
  defaultRows.X.length === 2 && defaultRows.Y.length === 2 && (await val('loadLevel')) === 'strength' && !(await shown('mwfrsRow')), JSON.stringify(defaultRows));

const seeded = Object.assign({}, MW_RECORD, { project: '26-064 Red Bluff' });
const dlg0 = dialogs.length;
await gotoLat('?src=mwfrs&lat=1&story=3RD', { record: seeded, ts: Date.now(), file: FILE });
const imp = await page.evaluate(() => ({
  level: document.getElementById('level').value, Vx: document.getElementById('Vx').value, Vy: document.getElementById('Vy').value,
  B: document.getElementById('B').value, D: document.getElementById('D').value, loadLevel: document.getElementById('loadLevel').value,
  json: document.getElementById('mwfrsJSON').value, key: localStorage.getItem('are_lateral_v1'),
  job: document.getElementById('areJob').value, projName: document.getElementById('projName').value,
  banner: getComputedStyle(document.getElementById('importBanner')).display !== 'none', info: document.getElementById('mwfrsInfo').textContent
}));
check('lat import: #mwfrsRow visible, 3 levels, 3RD selected', (await shown('mwfrsRow')) && (await levelOpts()).join(',') === 'Roof,3RD*,2ND', (await levelOpts()).join(','));
check('lat import: #level 3RD, #Vx 79.78, #Vy 20.90, #loadLevel strength', imp.level === '3RD' && imp.Vx === '79.78' && imp.Vy === '20.90' && imp.loadLevel === 'strength', JSON.stringify(imp).slice(0, 200));
check('lat import: B/D from the record (page still had 60/120)', imp.B === '120' && imp.D === '360', `${imp.B} x ${imp.D}`);
check('lat import: wall rows untouched (page defaults)', sameRows(await readRows(), defaultRows), JSON.stringify(await readRows()));
check('lat import: #mwfrsJSON carries the record, localStorage key removed', imp.json.length > 0 && JSON.parse(imp.json).levels.length === 3 && imp.key === null, `json=${imp.json.length} key=${imp.key}`);
check('lat import: #areJob and #projName prefilled from record.project', imp.job === '26-064 Red Bluff' && imp.projName === '26-064 Red Bluff', `${imp.job} / ${imp.projName}`);
check('lat import: banner shown, info names the levels', imp.banner && /3 levels from MWFRS/.test(imp.info), imp.info);
check('lat import: no dialog', dialogs.length === dlg0, JSON.stringify(dialogs.slice(dlg0)));

// ── 11. Mark rule ───────────────────────────────────────────────────────────
// Fresh page + import: mark was blank -> set to the opened level.
check('mark: blank -> "3RD" on import', (await val('areMark')) === '3RD', await val('areMark'));
await page.fill('#areMark', 'ROOF LEVEL');
await page.selectOption('#mwfrsLevel', '1');   // pick 3RD again: mark does not contain "3RD"
check('mark: "ROOF LEVEL" -> "3RD" (does not contain the level)', (await val('areMark')) === '3RD' && /Mark set to 3RD/.test(await page.$eval('#mwfrsInfo', (e) => e.textContent)), await val('areMark'));
await page.fill('#areMark', '3RD LEVEL');
await page.selectOption('#mwfrsLevel', '1');
check('mark: "3RD LEVEL" left alone (already contains the level)', (await val('areMark')) === '3RD LEVEL', await val('areMark'));

// Token match, not substring: "2" is not named by "26-064 ROOF"; "Floor 1" is not named by "Floor 10".
await page.fill('#areMark', '26-064 ROOF');
await page.evaluate(() => {
  const el = document.getElementById('mwfrsJSON'), t = JSON.parse(el.value);
  t.levels[1].label = '2'; el.value = JSON.stringify(t); window.buildLevelSelect();
});
await page.selectOption('#mwfrsLevel', '1');
check('mark: "26-064 ROOF" + level "2" -> "2" (substring "2" is not a token)', (await val('areMark')) === '2' && (await val('level')) === '2', await val('areMark'));
await page.evaluate(() => {
  const el = document.getElementById('mwfrsJSON'), t = JSON.parse(el.value);
  t.levels[1].label = '3RD'; el.value = JSON.stringify(t); window.buildLevelSelect();
});
// Mark left alone -> the results must still be recomputed for the new level (not via the mark autorun).
await page.evaluate(() => window.applyMwfrsLevel(0));   // Roof: 131.31 k
await page.fill('#areMark', '3RD LEVEL');
await page.evaluate(() => window.calculate());
const roofRx = await page.$eval('#wxBody tbody tr', (r) => r.cells[3].innerText);
await page.evaluate(() => window.applyMwfrsLevel(1));   // 3RD: 79.78 k, mark "3RD LEVEL" unchanged
const stale = await page.evaluate(() => ({ mark: document.getElementById('areMark').value, info: document.getElementById('mwfrsInfo').textContent,
  rx: document.querySelector('#wxBody tbody tr').cells[3].innerText, sum: document.getElementById('summaryBody').innerText }));
check('switch with mark left alone: results recomputed for 79.78 k', stale.mark === '3RD LEVEL' && roofRx !== stale.rx && /V_x \(Wind-X\) = 79\.78 kips/.test(stale.sum) && !/131\.31/.test(stale.sum), `mark=${stale.mark} R ${roofRx} -> ${stale.rx}; ${stale.sum.replace(/\s+/g, ' ').slice(0, 160)}`);
check('switch with mark left alone: #mwfrsInfo has no stale "Mark set to"', !/Mark set to/.test(stale.info), stale.info);
// A label with < and & survives buildLevelSelect (escaped in the option, still selectable).
await page.evaluate(() => {
  const el = document.getElementById('mwfrsJSON'), t = JSON.parse(el.value);
  t.levels[2].label = 'A<B & C'; el.value = JSON.stringify(t); window.buildLevelSelect();
});
await page.selectOption('#mwfrsLevel', '2');
const oddLabel = await page.evaluate(() => ({ opt: document.querySelector('#mwfrsLevel option[value="2"]').textContent, html: document.getElementById('mwfrsLevel').innerHTML, level: document.getElementById('level').value, mark: document.getElementById('areMark').value }));
check('label "A<B & C": escaped in the option, selectable, applied to #level and Mark',
  oddLabel.opt === 'A<B & C' && /&lt;B &amp; C/.test(oddLabel.html) && oddLabel.level === 'A<B & C' && oddLabel.mark === 'A<B & C', JSON.stringify(oddLabel));
await page.evaluate(() => {
  const el = document.getElementById('mwfrsJSON'), t = JSON.parse(el.value);
  t.levels[2].label = '2ND'; el.value = JSON.stringify(t); window.buildLevelSelect(); window.applyMwfrsLevel(1);
});
await page.fill('#areMark', '3RD LEVEL');

// ── 12. switching level via the select changes only #level/#Vx/#Vy ─────────
const before = await capFields();
await page.selectOption('#mwfrsLevel', '2');   // 2ND
const after = await capFields();
const SKIP = { '#level': 1, '#Vx': 1, '#Vy': 1, '#mwfrsJSON': 1 };
const changed = Object.keys(after).filter((k) => !SKIP[k] && after[k] !== before[k]);
const missing = Object.keys(before).filter((k) => !(k in after));
check('switch to 2ND: #level/#Vx/#Vy follow the level', after['#level'] === '2ND' && after['#Vx'] === '87.31' && after['#Vy'] === '22.62', `${after['#level']} ${after['#Vx']} ${after['#Vy']}`);
check('switch to 2ND: nothing else in the capture changed', changed.length === 0 && missing.length === 0, changed.concat(missing).join(', '));
check('switch to 2ND: mark "3RD LEVEL" -> "2ND"', (await val('areMark')) === '2ND', await val('areMark'));

// ── 13. nextLevel(): Roof -> 3RD -> 2ND -> stays 2ND ────────────────────────
await page.evaluate(() => window.applyMwfrsLevel(0));
const walk = [await val('level')];
for (let i = 0; i < 3; i++) { await page.evaluate(() => window.nextLevel()); walk.push(await val('level')); }
check('nextLevel(): Roof -> 3RD -> 2ND -> 2ND', walk.join(',') === 'Roof,3RD,2ND,2ND', walk.join(','));

// ── 14. save capture carries #loadLevel/#mwfrsJSON; loading it rebuilds the row ──
const capLat = await page.evaluate(() => JSON.parse(JSON.stringify(window.AREv2.captureState())));
check('capture: #loadLevel and #mwfrsJSON present', capLat.fields['#loadLevel'] === 'strength' && JSON.parse(capLat.fields['#mwfrsJSON']).levels.length === 3, Object.keys(capLat.fields).filter((k) => /loadLevel|mwfrs/.test(k)).join(', '));
check('capture: #mwfrsLevel not captured (data-are-ignore)', !('#mwfrsLevel' in capLat.fields), 'captured');
await gotoLat('', null);
check('fresh page again: #mwfrsRow hidden', !(await shown('mwfrsRow')), 'shown');
const rl = await page.evaluate((s) => JSON.parse(JSON.stringify(window.AREv2.loadFromState(s))), capLat);
check('load capture with #mwfrsJSON: ok, zero mismatches', rl.ok === true && !rl.rolledBack && rl.mismatches.missingOnPage.length === 0 && rl.mismatches.notInFile.length === 0, JSON.stringify(rl));
check('load capture with #mwfrsJSON: #mwfrsRow rebuilt, 3 options, 2ND selected', (await shown('mwfrsRow')) && (await levelOpts()).join(',') === 'Roof,3RD,2ND*', (await levelOpts()).join(','));

// ── 15. ROOF fixture (Phase 0) still loads clean now that the shim defaults the new keys ──
const r0 = await page.evaluate((s) => JSON.parse(JSON.stringify(window.AREv2.loadFromState(s))), fixture);
check('ROOF fixture after Phase 3: ok, missingOnPage/notInFile empty', r0.ok === true && !r0.rolledBack && r0.mismatches.missingOnPage.length === 0 && r0.mismatches.notInFile.length === 0, JSON.stringify(r0.mismatches));
check('ROOF fixture after Phase 3: #loadLevel strength, #mwfrsRow hidden', (await val('loadLevel')) === 'strength' && !(await shown('mwfrsRow')) && (await val('mwfrsJSON')) === '', await val('loadLevel'));

// ── 16. expired key + legacy params -> single-level fallback, rows untouched ──
await gotoLat('?src=mwfrs&lat=1&vx=79782&vy=20904&B=120&D=360&story=3RD', { record: seeded, ts: Date.now() - 11 * 60 * 1000, file: FILE });
const leg = await page.evaluate(() => ({
  level: document.getElementById('level').value, Vx: document.getElementById('Vx').value, Vy: document.getElementById('Vy').value,
  B: document.getElementById('B').value, D: document.getElementById('D').value, loadLevel: document.getElementById('loadLevel').value,
  json: document.getElementById('mwfrsJSON').value, key: localStorage.getItem('are_lateral_v1')
}));
check('legacy fallback: #Vx/#Vy/#B/#D/#level from the URL, #loadLevel strength', leg.Vx === '79.78' && leg.Vy === '20.90' && leg.B === '120' && leg.D === '360' && leg.level === '3RD' && leg.loadLevel === 'strength', JSON.stringify(leg));
check('legacy fallback: #mwfrsRow hidden, #mwfrsJSON empty, stale key removed', !(await shown('mwfrsRow')) && leg.json === '' && leg.key === null, `json=${leg.json.length} key=${leg.key}`);
check('legacy fallback: wall rows NOT overwritten from B/D', sameRows(await readRows(), defaultRows), JSON.stringify(await readRows()));
// lat=1 with no key at all also falls back.
await gotoLat('?src=mwfrs&lat=1&vx=131310&vy=40861&B=120&D=360&story=Roof', null);
check('lat=1 without a key: legacy fallback', (await val('Vx')) === '131.31' && (await val('level')) === 'Roof' && !(await shown('mwfrsRow')), `${await val('Vx')} ${await val('level')} row=${await shown('mwfrsRow')}`);

// ── 17. cross-project guard: #areJob differs -> confirm; declined -> nothing applied ──
// The v1-compatible are_v1_<file> store prefills #areJob at toolbar injection.
await page.evaluate((f) => localStorage.setItem('are_v1_' + f, JSON.stringify({ _job: '26-001 Other Job' })), FILE);
page.removeAllListeners('dialog');
const guardMsgs = [];
page.on('dialog', (d) => { guardMsgs.push(d.message()); d.dismiss(); });
await gotoLat('?src=mwfrs&lat=1&story=3RD', { record: seeded, ts: Date.now(), file: FILE });
check('guard: confirm names both projects', guardMsgs.length === 1 && /26-064 Red Bluff/.test(guardMsgs[0]) && /26-001 Other Job/.test(guardMsgs[0]), JSON.stringify(guardMsgs));
check('guard declined: nothing applied, key consumed', (await val('level')) === '' && (await val('mwfrsJSON')) === '' && !(await shown('mwfrsRow')) && (await page.evaluate(() => localStorage.getItem('are_lateral_v1'))) === null, await val('level'));
page.removeAllListeners('dialog');
page.on('dialog', (d) => { guardMsgs.push(d.message()); d.accept(); });
await gotoLat('?src=mwfrs&lat=1&story=3RD', { record: seeded, ts: Date.now(), file: FILE });
check('guard accepted: applied, #areJob kept', guardMsgs.length === 2 && (await val('level')) === '3RD' && (await val('areJob')) === '26-001 Other Job', `${await val('level')} / ${await val('areJob')}`);
await page.evaluate((f) => localStorage.removeItem('are_v1_' + f), FILE);
page.removeAllListeners('dialog');
page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
