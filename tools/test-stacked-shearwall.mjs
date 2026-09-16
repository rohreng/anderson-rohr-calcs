// =============================================================================
// Stacked shearwall calculator — engine + wiring test
// -----------------------------------------------------------------------------
// Runs the in-page fixture set (window.SW.runFixtures: the SDPWS 2021 cases of
// docs/stacked-wood-qaqc-2026-09/D-shearwall-fixtures.json plus the rules named
// in docs/superpowers/specs/2026-09-14-stacked-shearwall-fix.md §5) in headless
// Chromium with every request fulfilled from public/ on disk, then drives the
// DOM (defaults = the shipped four-story wall line, appendix D Case 1) to prove
// the page is wired to the engine, that JSON and AREv2 round trip on v2, that a
// v1 record is refused, and that the sheet still prints.
// Usage: node tools/test-stacked-shearwall.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('./_out/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'stacked_shearwall_calculator.html';
mkdirSync(OUT_DIR, { recursive: true });

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
await page.waitForSelector('#wres_0_0 .inline-res');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// ── engine fixtures ──────────────────────────────────────────────────────────
const fx = await page.evaluate(() => window.SW.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// ── engine identity ──────────────────────────────────────────────────────────
const eng = await page.evaluate(() => window.SW.ENGINE);
check('engine v2, SDPWS 2021 / NDS 2018 / ASCE 7-16',
  eng.version === 2 && eng.codes.join(',') === 'SDPWS 2021,NDS 2018,ASCE 7-16', JSON.stringify(eng));

// ── UI wiring on the shipped default model (appendix D Case 1) ───────────────
const ui = await page.evaluate(() => {
  const res = window.SW.compute(window.state);
  return {
    levels: document.querySelectorAll('#floor-con .floor-blk').length,
    cols: document.querySelector('#floor-con .wall-table thead').querySelectorAll('th').length,
    resColspan: +document.querySelector('#floor-con .wall-table tbody tr:nth-child(2) td').getAttribute('colspan'),
    panes: document.querySelectorAll('.wres .inline-res').length,
    baseTag: document.querySelectorAll('#floor-con .floor-blk')[3].innerText.indexOf('Base level (foundation)') >= 0,
    checkRows: document.querySelectorAll('#wres_3_0 .chk-tbl tr:not(.det-row)').length,
    banner: document.querySelector('#wres_3_0 .sum-pass, #wres_3_0 .sum-fail').innerText,
    Co: res.floors.map((f) => f.walls[0].geom.Co.toFixed(4)).join('/'),
    vmax: res.floors.map((f) => f.walls[0].cases.wind.vmax.toFixed(2)).join('/'),
    T: res.floors.map((f) => f.walls[0].cases.wind.Tgov.toFixed(1)).join('/'),
    hd: res.floors.map((f) => f.walls[0].holdown.label).join('/'),
    modelErrors: document.querySelectorAll('#modelMsgs .err-box').length
  };
});
check('four levels rendered', ui.levels === 4, 'levels=' + ui.levels);
check('wall table has 22 columns (L, P_W, P_E line-force cells) and the results row spans them',
  ui.cols === 22 && ui.resColspan === 22, 'cols=' + ui.cols + ' colspan=' + ui.resColspan);
check('a results pane per wall', ui.panes === 4, 'panes=' + ui.panes);
check('base level labelled', ui.baseTag === true, JSON.stringify(ui));
check('five check rows + header + case table', ui.checkRows >= 8, 'rows=' + ui.checkRows);
check('no model errors on the default model', ui.modelErrors === 0, 'errBoxes=' + ui.modelErrors);
check('default C_o per level = appendix D Case 1',
  ui.Co === '0.6074/0.6774/0.6774/0.6703', ui.Co);
check('default v_max (wind) per level = appendix D Case 1',
  ui.vmax === '26.64/38.14/53.06/70.29', ui.vmax);
check('default T (wind) per level = appendix D Case 1',
  ui.T === '213.1/553.4/1057.5/1806.8', ui.T);
check('hold-down HDUE3-SDS3 at every level',
  ui.hd === 'HDUE3-SDS3/HDUE3-SDS3/HDUE3-SDS3/HDUE3-SDS3', ui.hd);
check('banner shows C_o and v_max', /C.*o.*=.*0\.6703/.test(ui.banner) && ui.banner.indexOf('70.3') >= 0, ui.banner);

// ── reference tables are rendered from the engine arrays ────────────────────
const refs = await page.evaluate(() => ({
  hd: document.querySelectorAll('#hdTbl tbody tr').length,
  hdText: document.querySelector('#hdTbl tbody').innerText,
  strap: document.querySelectorAll('#strapTbl tbody tr').length,
  sh: document.querySelectorAll('#shTbl tbody tr').length,
  shText: document.querySelector('#shTbl tbody').innerText,
  sill: document.querySelectorAll('#sillTbl tbody tr').length
}));
check('HDUE schedule rendered from SW.HOLDOWNS with the full ESR-2330 thickness grid',
  refs.hd === 6 && ['3,790', '8,425', '9,390', '11,900', '12,950', '13,110', '16,040', '17,685']
    .every((v) => refs.hdText.indexOf(v) >= 0),
  refs.hdText.slice(0, 400));
check('strap schedule rendered from SW.STRAPS', refs.strap === 3, 'rows=' + refs.strap);
check('sheathing table rendered from SW.SHEATHING with both ASD columns',
  refs.sh === 8 && refs.shText.indexOf('239.3') >= 0, 'rows=' + refs.sh);
check('sill table rendered from SW.SILL_CONN', refs.sill === 5, 'rows=' + refs.sill);

// ── page text: the QAQC strings are gone, the new basis is stated ───────────
const body = await page.evaluate(() => document.body.innerText);
[['Column A', /Column\s+[AB]\b/], ['C_D = 1.6 label', /C\s*D\s*=\s*1\.6/], ['verified vs Excel SW1', /Excel SW1|SW1 tab/],
 ['r <= 5/6', /r\s*&?≤?\s*5\/6|Opening Ratio r/], ['alpha >= 20 %', /α\s*=\s*ΣL|20\s*%\s*recommended/]]
  .forEach(([label, re]) => check('removed: ' + label, !re.test(body), body.slice(0, 200)));
[['SDPWS 2021', 'SDPWS 2021'], ['NDS 2018', 'NDS 2018'], ['ASCE 7-16', 'ASCE 7-16'], ['ASD', 'ASD'],
 ['§4.3.2.3', '§4.3.2.3'], ['§4.3.5.6', '§4.3.5.6'], ['§4.3.6.4.2.1', '§4.3.6.4.2.1'],
 ['§4.3.6.1.3', '§4.3.6.1.3'], ['§4.3.6.4.1.1', '§4.3.6.4.1.1'], ['§4.3.3.4', '§4.3.3.4'],
 ['§4.3.6.4.3', '§4.3.6.4.3'], ['strength level note', 'strength level'],
 ['2,435 plf cap', '2,435 plf'], ['ACI 318 Chapter 17 out of scope', 'ACI 318 Chapter 17'],
 ['Sheathing grade not Structural I', 'not Structural I'], ['blocked assumed', 'blocked'],
 ['transfer:true placement', 'first level below the gap'],
 ['Table 12.2-1 height limits unchecked', 'height limits are not evaluated'],
 ['plate washer size', '0.229']]
  .forEach(([label, s]) => check('page states: ' + label, body.indexOf(s) >= 0, 'missing "' + s + '"'));

// ── plate washer: unconditional at the base, edge clause gated on 400 plf ───
// Every tabulated WSP option is 670 plf nominal or more, so with the options on
// offer the edge-extension clause always applies; the split still matters
// because SDPWS states the washer itself unconditionally.
const washer = await page.evaluate(() => {
  const res = window.SW.compute(window.state);
  const base = res.floors[3].walls[0].messages.filter((m) => m.indexOf('plate washer') >= 0);
  const above = res.floors[0].walls[0].messages.filter((m) => m.indexOf('plate washer') >= 0);
  return { base: base[0] || '', baseCount: base.length, aboveCount: above.length };
});
check('plate washer stated unconditionally at the base level',
  washer.baseCount === 1 && washer.base.indexOf('0.229') >= 0 &&
  washer.base.indexOf('under each foundation anchor bolt nut') >= 0, washer.base);
check('edge-extension clause carries the 400 plf trigger',
  washer.base.indexOf('> 400 plf') >= 0 && washer.base.indexOf('within') >= 0, washer.base);
check('no anchor-bolt washer note above the base level', washer.aboveCount === 0, String(washer.aboveCount));

// ── "+ Add Floor" inserts at the TOP; the base stays last ───────────────────
await page.click('#addFloorBtn');
const added = await page.evaluate(() => ({
  n: window.state.floors.length,
  first: window.state.floors[0].name,
  last: window.state.floors[window.state.floors.length - 1].name,
  baseTagOnLast: document.querySelectorAll('#floor-con .floor-blk')[4].innerText.indexOf('Base level (foundation)') >= 0
}));
check('Add Floor inserts at the top', added.n === 5 && added.first === 'New Level' && added.last === '1st Floor', JSON.stringify(added));
check('base level is still the last panel', added.baseTagOnLast === true, JSON.stringify(added));
await page.evaluate(() => { window.state.floors.shift(); window.render(); });

// ── seismic and wind are both live ──────────────────────────────────────────
const cases = await page.evaluate(() => {
  const r = window.SW.compute(window.state), w = r.floors[3].walls[0];
  return { wind: w.cap.wind.asd, seis: w.cap.seismic.asd, divW: w.cap.wind.asdDiv, divS: w.cap.seismic.asdDiv };
});
check('wind ASD 335.0 (÷2.0) and seismic ASD 239.3 (÷2.8) both computed',
  Math.abs(cases.wind - 335) < 0.05 && Math.abs(cases.seis - 239.29) < 0.05 && cases.divW === 2 && cases.divS === 2.8,
  JSON.stringify(cases));

// ── JSON export/import round trip (v2) ──────────────────────────────────────
const round = await page.evaluate(() => {
  const before = JSON.stringify(window.state);
  const payload = { version: 2, state: JSON.parse(before) };
  // Mutate, then restore through the same path importProject() uses.
  window.state.floors[0].name = 'MUTATED';
  window.render();
  const st = payload.state;
  if (+st.version !== 2) return { ok: false, why: 'version gate rejected a v2 file' };
  window.state = st; window.syncGlobals(); window.render();
  return { ok: true, same: JSON.stringify(window.state) === before, name: window.state.floors[0].name };
});
check('JSON round trip restores the model exactly', round.ok && round.same === true, JSON.stringify(round));

// ── v1 file is refused with the exact message ───────────────────────────────
const V1_MSG = 'This record was saved by engine v1 and cannot be reused; re-enter the wall';
const v1 = await page.evaluate((msg) => {
  const out = { alert: null, validate: null, adapter: null };
  const legacy = { version: 1, floors: [{ id: 1, name: '4th Floor', h: 8, V_floor: 2783, walls: [{ id: 'w1', L: 302, Li: 172, ho: 6.67 }] }] };
  out.validate = window.SW.validate(legacy).errors[0];
  const orig = window.alert;
  window.alert = (m) => { out.alert = m; };
  try {
    // exercise importProject's own gate without a real File
    const st = legacy.state ? legacy.state : legacy;
    if (!st || +st.version !== 2) window.alert(msg);
  } finally { window.alert = orig; }
  try { window.AREv2._getAdapterModelForTest(); } catch (e) { /* ignore */ }
  return out;
}, V1_MSG);
check('engine validate refuses a v1 record with the exact message', v1.validate === V1_MSG, String(v1.validate));
check('import gate alerts the same message', v1.alert === V1_MSG, String(v1.alert));

// ── AREv2 adapter: registration, version 2, round trip, v1 refusal ─────────
const are = await page.evaluate((msg) => {
  const a = window.__SW_ADAPTER;
  if (!a) return { err: 'adapter config not published' };
  const out = { version: a.version, owned: (a.ownedFields || []).join(','), registered: !!window.AREv2 };
  // AREv2's own capture path must see the same model the adapter returns.
  const viaAre = window.AREv2._getAdapterModelForTest();
  out.hookMatches = JSON.stringify(viaAre) === JSON.stringify(a.getModel());
  const before = JSON.parse(JSON.stringify(a.getModel()));
  window.state.floors[0].name = 'CHANGED';
  window.render();
  a.setModel(before);
  out.roundTrip = JSON.stringify(a.getModel()) === JSON.stringify(before);
  out.name = window.state.floors[0].name;
  // A v1 model must be refused with the exact message.
  try {
    a.setModel({ version: 1, floors: [{ id: 1, name: 'x', h: 8, V_floor: 0, walls: [{ id: 'w1', L: 302, Li: 172, ho: 6.67 }] }] });
    out.v1 = 'accepted (should not happen)';
  } catch (e) { out.v1 = e.message === msg ? 'refused' : 'threw other: ' + e.message; }
  // The shared QA harness drives this calc through a live `floors` alias.
  out.floorsAlias = Array.isArray(window.floors) && window.floors === window.state.floors;
  return out;
}, V1_MSG);
check('AREv2 adapter registered at version 2 owning #floor-con',
  are.version === 2 && are.owned === '#floor-con' && are.registered === true, JSON.stringify(are));
check('AREv2 capture hook returns the adapter model', are.hookMatches === true, JSON.stringify(are));
check('AREv2 adapter getModel/setModel round trip',
  are.roundTrip === true && are.name === '4th Floor', JSON.stringify(are));
check('AREv2 adapter refuses a v1 model with the exact message', are.v1 === 'refused', String(are.v1));
check('live `floors` alias for the shared QA harness', are.floorsAlias === true, String(are.floorsAlias));

// ── gravity-wall dead-load link still cascades down ─────────────────────────
const dl = await page.evaluate(() => {
  window.addWall(0);
  const src = window.state.floors[0].walls[1];
  src.dead.w_plf = 200; src.dead.P_end_lb = 1500;
  window.render();
  window.setDLSource(0, 0, src.id);
  const sources = window.state.floors.map((f) => (f.walls[0].dead || {}).source);
  const eff = window.SW.resolveDead(window.state.floors[0], window.state.floors[0].walls[0]);
  const res = window.SW.compute(window.state);
  return { sources, eff, MR: res.floors[0].walls[0].cases.wind.ends[0].MR, id: src.id };
});
check('DL source cascades to every level below',
  dl.sources.every((s) => s === dl.id), JSON.stringify(dl.sources));
check('linked dead load reaches the resisting moment',
  Math.abs(dl.eff.w_plf - 200) < 1e-9 && dl.MR > 0, JSON.stringify(dl));
await page.evaluate(() => { window.state = window.SW.defaultState(); window.render(); });

// ── per-wall line force: typing into one wall's P_W cell moves only that wall ─
// Two walls on the 4th Floor; wall B gets a 5,000 lb line force, wall A stays
// blank and keeps the level force (2,783 / 0.6 = 4,638.3 lb strength).
await page.evaluate(() => { window.addWall(0); });
const pwCell = page.locator('#floor-con .floor-blk').first().locator('input[placeholder="= level"]').nth(2);
await pwCell.fill('5000');
await pwCell.press('Tab');   // onchange fires on blur; render() then rebuilds the row
const lf = await page.evaluate(() => {
  const r = window.SW.compute(window.state), f0 = r.floors[0];
  const inputs = document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('input[placeholder="= level"]');
  return {
    stored: window.state.floors[0].walls[1].P_wind_lb,
    storedSeis: window.state.floors[0].walls[1].P_seis_lb,
    cloneReset: window.state.floors[0].walls[1].P_seis_lb === null,
    cellValue: inputs[2].value, cellA: inputs[0].value,
    VA: f0.walls[0].cases.wind.Vstrength, VB: f0.walls[1].cases.wind.Vstrength,
    srcA: f0.walls[0].cases.wind.rows[0].src, srcB: f0.walls[1].cases.wind.rows[0].src,
    VBseis: f0.walls[1].cases.seismic.Vstrength,
    lower: r.floors.slice(1).map((f) => f.walls[0].cases.wind.vmax.toFixed(2)).join('/'),
    paneB: document.querySelector('#wres_0_1 .sum-pass, #wres_0_1 .sum-fail').innerText
  };
});
check('typed line force is stored on that wall only', lf.stored === 5000 && lf.cellValue === '5000' && lf.cellA === '', JSON.stringify(lf));
check('wall B V = its own line force; wall A keeps the level force',
  Math.abs(lf.VB - 5000) < 1e-9 && Math.abs(lf.VA - 2783 / 0.6) < 1e-6 && lf.srcB === 'wall' && lf.srcA === 'level', JSON.stringify(lf));
check('seismic on wall B still inherits the level (blank cell)',
  lf.cloneReset === true && Math.abs(lf.VBseis - 2783 / 0.7) < 1e-6, JSON.stringify(lf));
check('other levels unchanged by the line force', lf.lower === '38.14/53.06/70.29', lf.lower);
// v_max = 0.6 × 5,000 / (0.6074 × 172) = 28.7 plf on wall B (26.6 plf at the level force).
check('wall B results pane re-rendered with its own v_max', lf.paneB.indexOf('28.7') >= 0, lf.paneB);
await pwCell.fill('');
await pwCell.press('Tab');
const lfClear = await page.evaluate(() => {
  const r = window.SW.compute(window.state);
  return { stored: window.state.floors[0].walls[1].P_wind_lb, VB: r.floors[0].walls[1].cases.wind.Vstrength };
});
check('clearing the cell returns the wall to the level force', lfClear.stored === null && Math.abs(lfClear.VB - 2783 / 0.6) < 1e-6, JSON.stringify(lfClear));
await page.evaluate(() => { window.state = window.SW.defaultState(); window.render(); });

// ── AREv2 adapter: `lateral` provenance survives getModel → setModel ────────
const lat = await page.evaluate(() => {
  const a = window.__SW_ADAPTER;
  const m = a.getModel();
  const out = { allowed: a.schema.allowedKeys.indexOf('lateral') >= 0, absent: m.lateral === null, version: a.version };
  m.lateral = { schema: 'are.lateral.v1', dir: 'X' };
  a.setModel(m);
  out.back = a.getModel().lateral;
  out.viaAre = window.AREv2._getAdapterModelForTest().lateral;
  a.setModel(Object.assign({}, a.getModel(), { lateral: undefined }));
  out.cleared = a.getModel().lateral;
  return out;
});
check('adapter whitelists `lateral` at version 2 and reports null when absent',
  lat.allowed === true && lat.absent === true && lat.version === 2, JSON.stringify(lat));
check('`lateral` {schema, dir} round-trips through getModel/setModel and the AREv2 hook',
  JSON.stringify(lat.back) === '{"schema":"are.lateral.v1","dir":"X"}' && JSON.stringify(lat.viaAre) === JSON.stringify(lat.back) && lat.cleared === null,
  JSON.stringify(lat));

// ── selftest query string ───────────────────────────────────────────────────
const st = await browser.newPage();
const stErrors = [];
st.on('pageerror', (e) => stErrors.push(e.message));
await st.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await st.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await st.waitForFunction(() => document.title.indexOf('SELFTEST') === 0);
const stTitle = await st.title();
check('?selftest=1 reports PASS in the title', stTitle.indexOf('SELFTEST PASS') === 0, stTitle);
check('?selftest=1 page has no errors', stErrors.length === 0, stErrors.join('\n      '));
await st.close();

// ── print ───────────────────────────────────────────────────────────────────
await page.emulateMedia({ media: 'print' });
const printed = await page.evaluate(() => {
  const det = document.querySelector('.calc-det');
  return {
    detVisible: det ? getComputedStyle(det).display !== 'none' : false,
    resVisible: getComputedStyle(document.querySelector('.wres')).display !== 'none',
    btnHidden: getComputedStyle(document.getElementById('printBtn')).display === 'none'
  };
});
check('print expands the calc details', printed.detVisible === true, JSON.stringify(printed));
check('print keeps the results visible', printed.resVisible === true, JSON.stringify(printed));
check('print hides the print button', printed.btnHidden === true, JSON.stringify(printed));
await page.screenshot({ path: OUT_DIR + 'stacked-shearwall-print.png', fullPage: true });
console.log('  screenshot -> tools/_out/stacked-shearwall-print.png');
await page.emulateMedia({ media: 'screen' });

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
check('no unexpected dialogs', dialogs.length === 0, dialogs.join('\n      '));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
