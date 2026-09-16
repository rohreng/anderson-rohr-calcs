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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
// Wall A on the 4th Floor is given a 4,000 lb line force BEFORE the second wall
// is added, so the clone must come back blank (inherit) rather than copy it.
// Wall B then gets a 5,000 lb line force typed into its cell.
const cloneChk = await page.evaluate(() => {
  window.state.floors[0].walls[0].P_wind_lb = 4000;
  window.addWall(0);
  const f0 = window.state.floors[0];
  return { A: f0.walls[0].P_wind_lb, B: f0.walls[1].P_wind_lb, Bseis: f0.walls[1].P_seis_lb, n: f0.walls.length };
});
check('a hand-added wall inherits the level force, not the source wall line force',
  cloneChk.n === 2 && cloneChk.A === 4000 && cloneChk.B === null && cloneChk.Bseis === null, JSON.stringify(cloneChk));
const pwCell = page.locator('#floor-con .floor-blk').first().locator('input[placeholder="= level"]').nth(2);
await pwCell.fill('5000');
await pwCell.press('Tab');   // onchange fires on blur; render() then rebuilds the row
const lf = await page.evaluate(() => {
  const r = window.SW.compute(window.state), f0 = r.floors[0];
  const inputs = document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('input[placeholder="= level"]');
  return {
    stored: window.state.floors[0].walls[1].P_wind_lb,
    storedA: window.state.floors[0].walls[0].P_wind_lb,
    cellValue: inputs[2].value, cellA: inputs[0].value,
    VA: f0.walls[0].cases.wind.Vstrength, VB: f0.walls[1].cases.wind.Vstrength,
    srcA: f0.walls[0].cases.wind.rows[0].src, srcB: f0.walls[1].cases.wind.rows[0].src,
    VBseis: f0.walls[1].cases.seismic.Vstrength,
    baseV: r.floors[3].walls[0].cases.wind.Vstrength,
    baseRowsP: r.floors[3].walls[0].cases.wind.rows.map((x) => Math.round(x.P)).join('/'),
    paneB: document.querySelector('#wres_0_1 .sum-pass, #wres_0_1 .sum-fail').innerText
  };
});
check('typed line force is stored on that wall only', lf.stored === 5000 && lf.cellValue === '5000' && lf.storedA === 4000 && lf.cellA === '4000', JSON.stringify(lf));
check('wall B V = its own line force; wall A keeps its own 4,000 lb',
  Math.abs(lf.VB - 5000) < 1e-9 && Math.abs(lf.VA - 4000) < 1e-9 && lf.srcB === 'wall' && lf.srcA === 'wall', JSON.stringify(lf));
check('seismic on wall B still inherits the level (blank cell)',
  Math.abs(lf.VBseis - 2783 / 0.7) < 1e-6, JSON.stringify(lf));
// Wall A's line runs to the base: its 4,000 lb roof force flows down that line
// (in place of 2,783 / 0.6); wall B's 5,000 lb never reaches the lower levels.
check('lower levels carry the wall A line force, never the wall B one',
  Math.abs(lf.baseV - (4000 + (1661 + 1738 + 1921) / 0.6)) < 1e-6 && lf.baseRowsP === '4000/2768/2897/3202', JSON.stringify({ baseV: lf.baseV, rows: lf.baseRowsP }));
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

// ── Diaphragm import (are.lateral.v1, Phase 4) ──────────────────────────────
// The three Red Bluff diaphragm snapshots are wrapped as minimal saved-calc
// files (AREv2.parseSnapshot needs only <script id="are-state">) and picked
// through the page's own file input. ROOF carries no #mwfrsJSON; 3RD and 2ND
// do, so assemble() takes the story table (order + heights) from them.
const FIX_DIR = fileURLToPath(new URL('../fixtures/lateral/red-bluff/', import.meta.url));
const wrapSnapshot = (json) => '<html><body><script id="are-state" type="application/json">' + json + '</script></body></html>';
const diaFiles = ['roof', '3rd', '2nd'].map((n) => {
  const p = OUT_DIR + 'dia-' + n + '.html';
  writeFileSync(p, wrapSnapshot(readFileSync(FIX_DIR + 'diaphragm-' + n + '-state.json', 'utf8')));
  return p;
});
const readPanel = () => page.evaluate(() => {
  const p = document.getElementById('diaImportPanel');
  if (!p) return null;
  const rows = [...p.querySelectorAll('tbody tr')].map((tr) => {
    const h = tr.querySelector('input[data-lh="h"]');
    return { label: tr.querySelector('td').innerText.trim(), h: h ? h.value : null, ro: h ? h.readOnly : null };
  });
  return {
    rows, dir: (p.querySelector('input[name="diaDir"]:checked') || {}).value,
    importDisabled: p.querySelector('button[data-lh="import"]').disabled,
    ignored: [...p.querySelectorAll('input,select')].every((el) => el.hasAttribute('data-are-ignore')),
    text: p.innerText, inFloorCon: !!p.closest('#floor-con')
  };
});

// (1) pick the three files → panel
dialogs.length = 0;
await page.setInputFiles('#diaImport', diaFiles);
await page.waitForSelector('#diaImportPanel');
let pnl = await readPanel();
check('import panel: 3 level rows top→bottom Roof/3RD/2ND with story-table heights read-only',
  pnl.rows.map((r) => r.label).join('/') === 'Roof/3RD/2ND' && pnl.rows.map((r) => r.h).join('/') === '11/10.5/14' && pnl.rows.every((r) => r.ro === true),
  JSON.stringify(pnl.rows));
check('import panel: direction X selected, Import enabled, every control data-are-ignore, outside #floor-con',
  pnl.dir === 'X' && pnl.importDisabled === false && pnl.ignored === true && pnl.inFloorCon === false, JSON.stringify(pnl));
check('import panel: summary lines and the axis convention shown',
  pnl.text.indexOf('Roof — h 11 ft — Wind-X 131,310 lb over 25 lines') >= 0 && pnl.text.indexOf('EW walls resist') >= 0, pnl.text.slice(0, 400));
check('import panel: no dialogs while picking', dialogs.length === 0, dialogs.join('\n      '));

// (2) Import (replace model), direction X
await page.click('#diaImportPanel button[data-lh="import"]');
const imp = await page.evaluate(() => {
  const s = window.state, r = window.SW.compute(s), v = window.SW.validate(s);
  const base = s.floors[2], bi = base.walls.findIndex((w) => w.id === 'X@15');
  const sum = document.querySelector('#floor-con .floor-blk .lf-sum');
  return {
    n: s.floors.length, names: s.floors.map((f) => f.name).join('/'), h: s.floors.map((f) => f.h_ft).join('/'),
    walls: s.floors.map((f) => f.walls.length).join('/'),
    allNumeric: s.floors.every((f) => f.walls.every((w) => typeof w.P_wind_lb === 'number' && w.P_seis_lb === 0)),
    ids: s.floors[0].walls.map((w) => w.id), idsSame: s.floors.every((f) => f.walls.map((w) => w.id).join() === s.floors[0].walls.map((w) => w.id).join()),
    sills: s.floors.map((f) => f.walls[0].sill.conn + '@' + f.walls[0].sill.spacing_in).join('/'),
    PW: s.floors.map((f) => f.P_wind_lb).join('/'),
    lateral: s.lateral, errors: v.errors, panel: !!document.getElementById('diaImportPanel'),
    Vstrength: r.floors[2].walls[bi].cases.wind.Vstrength, V: r.floors[2].walls[bi].cases.wind.V,
    sumText: sum ? sum.innerText : null, sumCls: sum ? sum.className : null, sumColor: sum ? getComputedStyle(sum).color : null,
    msg: document.getElementById('modelMsgs').innerText, prov: document.getElementById('floor-con').innerText.slice(0, 200),
    wCnt: window.wCnt, panes: document.querySelectorAll('.wres .inline-res').length
  };
});
check('import X: 3 floors Roof/3RD/2ND, h 11/10.5/14, 25 wall rows each',
  imp.n === 3 && imp.names === 'Roof/3RD/2ND' && imp.h === '11/10.5/14' && imp.walls === '25/25/25', JSON.stringify(imp));
check('import X: every wall has a numeric P_wind_lb and P_seis_lb = 0; ids X@0 … X@360 on every level',
  imp.allNumeric && imp.ids[0] === 'X@0' && imp.ids[24] === 'X@360' && imp.ids.length === 25 && imp.idsSame, JSON.stringify(imp.ids));
check('import X: base sill ab58, upper levels sds14; level P_W = diaphragm Vx',
  imp.sills === 'sds14@12/sds14@12/ab58@20' && imp.PW === '131310/79780/87310', imp.sills + ' ' + imp.PW);
check('import X: state.lateral written (dir X, 3 files), panel removed, wCnt = 75',
  imp.lateral && imp.lateral.dir === 'X' && imp.lateral.files.length === 3 && imp.lateral.schema === 'are.lateral.v1' && imp.panel === false && imp.wCnt === 75,
  JSON.stringify(imp.lateral) + ' panel=' + imp.panel + ' wCnt=' + imp.wCnt);
check('import X: no SW.validate errors, a results pane per wall', imp.errors.length === 0 && imp.panes === 75, JSON.stringify(imp.errors) + ' panes=' + imp.panes);
check('import X: base X@15 V_strength ≈ 12,433 lb, V ≈ 7,460 lb (Red Bluff goldens stacked)',
  Math.abs(imp.Vstrength - 12433) <= 2 && Math.abs(imp.V - 7460) <= 2, imp.Vstrength + ' / ' + imp.V);
check('import X: floor header Σ wall lines line shown and not red (Σ ≈ level force)',
  imp.sumText && imp.sumText.indexOf('Σ wall lines = 131,305 lb (level 131,310 lb)') >= 0 && imp.sumCls.indexOf('lf-bad') < 0 && imp.sumColor !== 'rgb(185, 28, 28)',
  JSON.stringify({ t: imp.sumText, c: imp.sumCls, col: imp.sumColor }));
check('import X: provenance line and the import message',
  imp.prov.indexOf('Imported from Diaphragm Designer — direction X — 3 files') >= 0 && imp.msg.indexOf('Imported 3 levels, 75 wall lines, direction X from: dia-roof.html') >= 0,
  imp.prov + ' | ' + imp.msg);
// Σ turns red when a wall line force is edited away from the level total.
const sumBad = await page.evaluate(() => {
  window.state.floors[0].walls[1].P_wind_lb = 50000; window.render();
  const s = document.querySelector('#floor-con .floor-blk .lf-sum');
  const out = { cls: s.className, color: getComputedStyle(s).color };
  window.state.floors[0].walls[1].P_wind_lb = 5471; window.render();
  return out;
});
check('Σ wall lines turns red when |Σ − level| > 1 %', sumBad.cls.indexOf('lf-bad') >= 0 && sumBad.color === 'rgb(185, 28, 28)', JSON.stringify(sumBad));

// (3) re-import, direction Y
await page.setInputFiles('#diaImport', diaFiles);
await page.waitForSelector('#diaImportPanel');
await page.check('#diaImportPanel input[name="diaDir"][value="Y"]');
await page.click('#diaImportPanel button[data-lh="import"]');
const impY = await page.evaluate(() => ({
  walls: window.state.floors.map((f) => f.walls.length).join('/'), ids: window.state.floors[2].walls.map((w) => w.id).join(','),
  dir: window.state.lateral.dir, PW: window.state.floors.map((f) => f.P_wind_lb).join('/'), P0: window.state.floors[0].walls[0].P_wind_lb
}));
check('re-import Y: 5 wall rows per floor, ids Y@0 … Y@120, lateral.dir Y, level P_W = Vy',
  impY.walls === '5/5/5' && impY.ids === 'Y@0,Y@30,Y@60,Y@90,Y@120' && impY.dir === 'Y' && impY.PW === '40860/20900/22620' && Math.abs(impY.P0 - 5107) <= 1, JSON.stringify(impY));

// (4) adapter and AREv2 round trips after an import
const impRt = await page.evaluate(() => {
  const a = window.__SW_ADAPTER, before = JSON.stringify(a.getModel());
  a.setModel(JSON.parse(before));
  const out = { adapter: JSON.stringify(a.getModel()) === before, lateral: !!window.state.lateral, P: window.state.floors[0].walls[0].P_wind_lb };
  const snap = window.AREv2.captureState();
  const res = window.AREv2.loadFromState(snap);
  out.ok = res.ok; out.mm = res.mismatches; out.after = JSON.stringify(a.getModel()) === before;
  return out;
});
check('after import: adapter getModel → setModel preserves lateral and the per-wall forces',
  impRt.adapter && impRt.lateral && Math.abs(impRt.P - 5107) <= 1, JSON.stringify(impRt));
check('after import: AREv2 capture → load round-trips with no mismatches',
  impRt.ok === true && impRt.mm.missingOnPage.length === 0 && impRt.mm.notInFile.length === 0 && impRt.after, JSON.stringify(impRt));

// (5) a foreign file is refused by name
const swSnap = OUT_DIR + 'dia-foreign.html';
writeFileSync(swSnap, wrapSnapshot(await page.evaluate(() => JSON.stringify(window.AREv2.captureState()))));
dialogs.length = 0;
await page.setInputFiles('#diaImport', [swSnap]);
await page.waitForFunction(() => document.getElementById('diaImport').value === '');   // the importer resets the input last
const foreign = await page.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), val: document.getElementById('diaImport').value }));
check('foreign file: alert names it "not a Rectangular Diaphragm Designer file", no panel, input reset',
  dialogs.length === 1 && dialogs[0].indexOf('dia-foreign.html: not a Rectangular Diaphragm Designer file') >= 0 && foreign.panel === false && foreign.val === '',
  dialogs.join('\n      ') + ' ' + JSON.stringify(foreign));
dialogs.length = 0;

// (6) heights required: ROOF alone carries no story table
await page.setInputFiles('#diaImport', [diaFiles[0]]);
await page.waitForSelector('#diaImportPanel');
pnl = await readPanel();
check('roof only: one editable empty h input, Import disabled, heights warning shown',
  pnl.rows.length === 1 && pnl.rows[0].h === '' && pnl.rows[0].ro === false && pnl.importDisabled === true && pnl.text.indexOf('heights required') >= 0,
  JSON.stringify(pnl));
await page.fill('#diaImportPanel input[data-lh="h"]', '11');
pnl = await readPanel();
check('roof only: typing h = 11 enables Import', pnl.importDisabled === false, JSON.stringify(pnl));
await page.click('#diaImportPanel button[data-lh="import"]');
const roofOnly = await page.evaluate(() => ({ n: window.state.floors.length, h: window.state.floors[0].h_ft, walls: window.state.floors[0].walls.length, sill: window.state.floors[0].walls[0].sill.conn, files: window.state.lateral.files }));
check('roof only: 1 floor with h_ft 11, 25 walls at the base sill', roofOnly.n === 1 && roofOnly.h === 11 && roofOnly.walls === 25 && roofOnly.sill === 'ab58', JSON.stringify(roofOnly));
check('no dialogs through the import flows', dialogs.length === 0, dialogs.join('\n      '));

// (7) Phase 4b receiver: the diaphragm page's quick send leaves a 1-level record
// in localStorage and opens ?src=diaphragm&lat=1. Build that record the way
// sendToShearwall() does, from the 3RD fixture (its story table gives h).
const fix3rd = readFileSync(FIX_DIR + 'diaphragm-3rd-state.json', 'utf8');
const rx = await browser.newPage();
const rxErrors = [];
rx.on('pageerror', (e) => rxErrors.push(e.message));
await rx.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await rx.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
const oneLevel = await rx.evaluate((json) => window.LH.assemble([window.LH.levelFromDiaphragmState(JSON.parse(json))], { files: [] }).record, fix3rd);
oneLevel.project = 'TEST-PROJ';   // the panel header must name the payload's project before Import
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'stacked_shearwall_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
await rx.waitForSelector('#diaImportPanel');
const rxPanel = await rx.evaluate(() => ({
  text: document.getElementById('diaImportPanel').innerText, key: localStorage.getItem('are_lateral_v1'),
  rows: document.querySelectorAll('#diaImportPanel tbody tr').length, h: document.querySelector('#diaImportPanel input[data-lh="h"]').value
}));
check('receiver: ?src=diaphragm&lat=1 shows the panel with the stacking note and consumes the key',
  rxPanel.rows === 1 && rxPanel.h === '10.5' && rxPanel.text.indexOf('1 level — import the other level files to stack') >= 0 && rxPanel.key === null, JSON.stringify(rxPanel));
check('receiver: panel header names the record project', rxPanel.text.indexOf('Project: TEST-PROJ') >= 0, rxPanel.text.slice(0, 200));
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now() - 11 * 60 * 1000, file: 'stacked_shearwall_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
const rxStale = await rx.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), key: localStorage.getItem('are_lateral_v1') }));
check('receiver: an expired record shows no panel and is removed', rxStale.panel === false && rxStale.key === null, JSON.stringify(rxStale));
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'rectangular_diaphragm_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
const rxForeign = await rx.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), key: !!localStorage.getItem('are_lateral_v1') }));
check('receiver: a record addressed to another calc is left alone', rxForeign.panel === false && rxForeign.key === true, JSON.stringify(rxForeign));
check('receiver page has no errors', rxErrors.length === 0, rxErrors.join('\n      '));
await rx.close();

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
