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

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
