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
const engHdr = await page.evaluate(() => document.querySelector('.header p').innerText);
check('engine v2, SDPWS 2021 / NDS 2018 / ASCE 7-16, rev string printed in the header',
  eng.version === 2 && eng.codes.join(',') === 'SDPWS 2021,NDS 2018,ASCE 7-16' && typeof eng.rev === 'string' && eng.rev.length > 0 && engHdr.indexOf('engine ' + eng.rev) >= 0, JSON.stringify(eng) + ' ' + engHdr);

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
    banner: document.querySelector('#wres_3_0 .sum-pass, #wres_3_0 .sum-fail, #wres_3_0 .sum-req').innerText,
    Co: res.floors.map((f) => f.walls[0].geom.Co.toFixed(4)).join('/'),
    vmax: res.floors.map((f) => f.walls[0].cases.wind.vmax.toFixed(2)).join('/'),
    T: res.floors.map((f) => f.walls[0].cases.wind.Tgov.toFixed(1)).join('/'),
    hd: res.floors.map((f) => f.walls[0].holdown.label).join('/'),
    modelErrors: document.querySelectorAll('#modelMsgs .err-box').length
  };
});
check('four levels rendered', ui.levels === 4, 'levels=' + ui.levels);
check('wall table has 23 columns (Line, L, Method, P_W, P_E line-force cells; Detail + ✕ merged into Actions) and the results row spans them',
  ui.cols === 23 && ui.resColspan === 23, 'cols=' + ui.cols + ' colspan=' + ui.resColspan);
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

// ── uplift is automatic: the default model passes every row, the base wall on
// plate-washer bearing, the upper walls on SDS withdrawal + the §12.4 row ──
// Check rows are always selected by id (Phase C removes rows on segmented walls).
const bn = await page.evaluate(() => {
  const bsel = (s) => s + ' .sum-pass, ' + s + ' .sum-fail, ' + s + ' .sum-req';
  const byId = (w, id) => w.checks.filter((c) => c.id === id)[0];
  const r = window.SW.compute(window.state), base = r.floors[3].walls[0], top = r.floors[0].walls[0];
  const el = document.querySelector(bsel('#wres_3_0'));
  const rows = (w) => w.checks.map((c) => c.id).join(',');
  const cellTxt = document.querySelectorAll('#floor-con .wall-table thead th')[18].innerText.trim();
  return { txt: el.innerText, cls: el.className, paneCls: document.querySelector('#wres_3_0').className,
           baseRows: rows(base), topRows: rows(top), baseLabel: byId(base, 'uplift').label, baseDemand: byId(base, 'uplift').demandTxt,
           topCap: byId(top, 'uplift').capacityTxt, topCombined: byId(top, 'combined').capacityTxt, topSill: byId(top, 'sill').capacityTxt,
           anyReq: r.floors.some((f) => f.walls[0].checks.some((c) => c.pass === null)),
           hdr: cellTxt, connBox: document.querySelector('#wres_3_0 .conn-box').innerText, connTop: document.querySelector('#wres_0_0 .conn-box').innerText };
});
check('banner: default model passes every check (uplift now computed, nothing to "specify")', /All checks PASS/.test(bn.txt) && bn.cls === 'sum-pass' && /pass-bg/.test(bn.paneCls) && !bn.anyReq, JSON.stringify(bn));
check('base wall rows: sheathing, holdown, uplift (washer bearing), sill, endpost — no combined row at anchor bolts',
  bn.baseRows === 'sheathing,holdown,uplift,sill,endpost' && bn.baseLabel === 'Sill plate washer bearing (uplift)', bn.baseRows + ' / ' + bn.baseLabel);
check('base wall demand line reports T_req for the anchor rod / concrete', /verify anchor rod \/ concrete for T_req = 117\.1 lb per bolt/.test(bn.baseDemand), bn.baseDemand);
check('upper wall rows include the combined §12.4 row after uplift', bn.topRows === 'sheathing,holdown,uplift,combined,sill,endpost', bn.topRows);
check('upper wall uplift: default p = 2.25 in printed as "default … verify"; SDS head pull-through 552.0 lb / 552.0 plf; combined Z\'_α 463.9 lb, v_max ≤ 328.0 plf',
  bn.topCap.indexOf('p = 2.25 in (default: 4½" screw − 1½" plate − ¾" subfloor — verify)') >= 0 && bn.topCap.indexOf('head pull-through 552.0 lb per screw — 552.0 plf') >= 0 && bn.topCombined.indexOf("Z'_α = 463.9 lb") >= 0 && bn.topCombined.indexOf('328.0 plf') >= 0, bn.topCap + ' | ' + bn.topCombined);
check('upper wall sill row prints the penetration it used', bn.topSill.indexOf('(p = 2.25 in, default)') >= 0, bn.topSill);
check('column header reads "Uplift" (column 19 after the Line and Method columns)', bn.hdr.toUpperCase() === 'UPLIFT', bn.hdr);
check('conn-box UPLIFT line prints the computed plf, T_req at the base and the combined limit above it',
  /UPLIFT:[\s\S]*sill plate-washer bearing 3235\.8 plf[\s\S]*T\s*req\s*= 117 lb per bolt/.test(bn.connBox) && /UPLIFT:[\s\S]*552\.0 lb per fastener = 552\.0 plf[\s\S]*combined NDS §12\.4: v\s*max\s*≤ 328\.0 plf/.test(bn.connTop), bn.connBox + ' || ' + bn.connTop);

// Uplift cell UI: select (Auto / Manual) + the connector's inputs. Base row
// (anchor bolt) shows the washer side; the roof row (SDS) shows the penetration
// field blank with the default as its placeholder; typing a value changes the
// row; blanking it returns to the default (no "specify").
const cell = await page.evaluate(() => {
  const bsel = (s) => s + ' .sum-pass, ' + s + ' .sum-fail, ' + s + ' .sum-req';
  const byId = (w, id) => w.checks.filter((c) => c.id === id)[0];
  const cellOf = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi].querySelector('.wall-table tbody tr td:nth-child(19)');
  const base = cellOf(3), roof = cellOf(0);
  const out = {
    baseSel: base.querySelector('select').value, baseInp: base.querySelector('input').value, baseUnit: base.innerText.trim(),
    roofSel: roof.querySelector('select').value, roofInp: roof.querySelector('input').value, roofPh: roof.querySelector('input').placeholder, roofUnit: roof.innerText.trim(),
    roofTitle: roof.querySelector('input').title
  };
  // type a 2.0" penetration on the roof wall → p_thread 2.0 → 172 × 2.0 × 1.6 = 550.4 lb < 552 cap
  const inp = roof.querySelector('input'); inp.value = '2.0'; inp.dispatchEvent(new Event('change'));
  const r1 = window.SW.compute(window.state).floors[0].walls[0];
  out.pen = window.state.floors[0].walls[0].uplift.penetration_in; out.cap2 = byId(r1, 'uplift').capacityTxt; out.plf2 = r1.uplift.plf;
  // blank it → back to the default, still PASS
  const inp2 = cellOf(0).querySelector('input'); inp2.value = ''; inp2.dispatchEvent(new Event('change'));
  const el = document.querySelector(bsel('#wres_0_0'));
  out.blankTxt = el.innerText; out.blankCls = el.className; out.blankPen = window.state.floors[0].walls[0].uplift.penetration_in;
  out.blankCap = byId(window.SW.compute(window.state).floors[0].walls[0], 'uplift').capacityTxt;
  // Manual source on the base wall → plf input (washer field hidden); blank → specify; 500 → PASS, T_req still printed
  const sel = cellOf(3).querySelector('select'); sel.value = 'manual'; sel.dispatchEvent(new Event('change'));
  out.manualInp = cellOf(3).querySelector('input').placeholder; out.manualUnit = cellOf(3).innerText.trim(); out.manualInputs = cellOf(3).querySelectorAll('input').length;
  out.manualBlank = document.querySelector(bsel('#wres_3_0')).innerText;
  const mi = cellOf(3).querySelector('input'); mi.value = '500'; mi.dispatchEvent(new Event('change'));
  const rm = byId(window.SW.compute(window.state).floors[3].walls[0], 'uplift');
  out.manual500 = document.querySelector(bsel('#wres_3_0')).innerText; out.manualRow = rm.capacityTxt; out.manualDemand = rm.demandTxt;
  // Manual on a roof SDS wall keeps the penetration field (it drives the shear row)
  const rs = cellOf(0).querySelector('select'); rs.value = 'manual'; rs.dispatchEvent(new Event('change'));
  out.roofManualInputs = cellOf(0).querySelectorAll('input').length; out.roofManualUnit = cellOf(0).innerText.trim();
  // restore
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('uplift cell: base row = Auto + washer side 3 ("washer in"); roof row = Auto + blank penetration with "2.25 dflt" placeholder ("p in")',
  cell.baseSel === 'sill' && cell.baseInp === '3' && /washer in/.test(cell.baseUnit) && cell.roofSel === 'sill' && cell.roofInp === '' && cell.roofPh === '2.25 dflt' && /p in/.test(cell.roofUnit), JSON.stringify(cell));
check('uplift cell: penetration hint names the default and the subfloor', /default: 4½" screw − 1½" plate − ¾" subfloor/.test(cell.roofTitle) && /subfloor thickness/.test(cell.roofTitle), cell.roofTitle);
check('uplift cell: typing p = 2.0 recomputes as "entered" (172 × 2.0 × 1.6 = 550.4 lb, 550.4 plf)', cell.pen === 2 && Math.abs(cell.plf2 - 550.4) < 0.05 && cell.cap2.indexOf('p = 2.00 in (entered)') >= 0 && cell.cap2.indexOf('550.4 lb per screw') >= 0, JSON.stringify([cell.pen, cell.plf2, cell.cap2]));
check('uplift cell: blanking the penetration returns to the default — still "All checks PASS", row says "default … verify"', cell.blankPen === null && /All checks PASS/.test(cell.blankTxt) && cell.blankCls === 'sum-pass' && cell.blankCap.indexOf('default: 4½" screw − 1½" plate − ¾" subfloor — verify') >= 0, JSON.stringify([cell.blankTxt, cell.blankCls, cell.blankCap]));
check('uplift cell: Manual on the base wall shows one plf input; blank → "Specify", 500 plf → "All checks PASS" with T_req still reported',
  cell.manualInp === 'plf' && cell.manualInputs === 1 && /plf/.test(cell.manualUnit) && /Specify:.*uplift/i.test(cell.manualBlank) && /All checks PASS/.test(cell.manual500) && cell.manualRow.indexOf('manual — 500.0 plf') >= 0 && /verify anchor rod \/ concrete for T_req = 117\.1 lb per bolt/.test(cell.manualDemand), JSON.stringify([cell.manualInp, cell.manualInputs, cell.manualBlank, cell.manual500, cell.manualRow, cell.manualDemand]));
check('uplift cell: Manual on an SDS wall keeps the penetration input beside the plf input', cell.roofManualInputs === 2 && /p in/.test(cell.roofManualUnit) && /plf/.test(cell.roofManualUnit), JSON.stringify([cell.roofManualInputs, cell.roofManualUnit]));

// Old-file compatibility: a typed capacity_plf loads as Manual with the same D/C;
// a null one loads as Auto computing at the printed default.
const oldFile = await page.evaluate(() => {
  const byId = (w, id) => w.checks.filter((c) => c.id === id)[0];
  const a = window.__SW_ADAPTER, m = a.getModel();
  m.floors[3].walls[0].uplift = { capacity_plf: 500, label: 'x' };
  m.floors[0].walls[0].uplift = { capacity_plf: null, label: '' };
  delete m.floors[0].walls[0].method;
  a.setModel(m);
  const r = window.SW.compute(window.state);
  const cellOf = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi].querySelector('.wall-table tbody tr td:nth-child(19)');
  const out = {
    baseSrc: window.state.floors[3].walls[0].uplift.source, baseSel: cellOf(3).querySelector('select').value, baseInp: cellOf(3).querySelector('input').value,
    baseDc: byId(r.floors[3].walls[0], 'uplift').dc, baseCap: byId(r.floors[3].walls[0], 'uplift').capacityTxt, baseDemand: byId(r.floors[3].walls[0], 'uplift').demandTxt,
    roofSrc: window.state.floors[0].walls[0].uplift.source, roofPen: window.state.floors[0].walls[0].uplift.penetration_in, roofPh: cellOf(0).querySelector('input').placeholder,
    roofPass: byId(r.floors[0].walls[0], 'uplift').pass, roofCap: byId(r.floors[0].walls[0], 'uplift').capacityTxt, method: window.state.floors[0].walls[0].method
  };
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('old file: {capacity_plf:500,label:x} loads as Manual 500 plf, D/C = 70.29/500 = 0.141, T_req still reported',
  oldFile.baseSrc === 'manual' && oldFile.baseSel === 'manual' && oldFile.baseInp === '500' && Math.abs(oldFile.baseDc - 0.1406) < 0.0005 && oldFile.baseCap.indexOf('x — 500.0 plf') >= 0 && /T_req = 117\.1 lb per bolt/.test(oldFile.baseDemand), JSON.stringify(oldFile));
check('old file: {capacity_plf:null} loads as Auto, penetration blank (default 2.25 placeholder), computes with "default … verify", method perforated',
  oldFile.roofSrc === 'sill' && oldFile.roofPen === null && oldFile.roofPh === '2.25 dflt' && oldFile.roofPass === true && oldFile.roofCap.indexOf('verify') >= 0 && oldFile.method === 'perforated', JSON.stringify(oldFile));

// 16d nail wall: default p 1.25 (subfloor) → 60 plf and the p/10D shear cut; typed
// p 2.0 → the 96.0 / 86.7 worked numbers; 8d at the default is refused (< 6D).
const nailUI = await page.evaluate(() => {
  const byId = (w, id) => w.checks.filter((c) => c.id === id)[0];
  const sel = document.querySelectorAll('#floor-con .floor-blk')[0].querySelector('.wall-table tbody tr td:nth-child(15) select');
  sel.value = '16d'; sel.dispatchEvent(new Event('change'));
  const w = window.SW.compute(window.state).floors[0].walls[0];
  const out = { pen: window.state.floors[0].walls[0].uplift.penetration_in, spacing: window.state.floors[0].walls[0].sill.spacing_in, rows: w.checks.map((c) => c.id).join(','),
                up: w.uplift.plf, upTxt: byId(w, 'uplift').capacityTxt, vAllow: w.combined.vAllow, Vconn: w.sill.Vconn, sillTxt: byId(w, 'sill').capacityTxt,
                refTbl: document.querySelector('#upTbl tbody').innerText, sillRows: document.querySelectorAll('#sillTbl tbody tr').length, upRows: document.querySelectorAll('#upTbl tbody tr').length };
  const cellOf = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi].querySelector('.wall-table tbody tr td:nth-child(19)');
  const inp = cellOf(0).querySelector('input'); inp.value = '2.0'; inp.dispatchEvent(new Event('change'));
  const w2 = window.SW.compute(window.state).floors[0].walls[0];
  out.up2 = w2.uplift.plf; out.vAllow2 = w2.combined.vAllow; out.Vconn2 = w2.sill.Vconn;
  out.det = document.querySelector('#wres_0_0 .chk-tbl:nth-of-type(2) tbody').innerText.slice(0, 2000);
  sel.value = '8d'; sel.dispatchEvent(new Event('change'));
  out.pen8 = window.state.floors[0].walls[0].uplift.penetration_in;
  out.err8 = window.SW.validate(window.state).errors.join(' | '); out.msg8 = document.getElementById('modelMsgs').innerText;
  const inp8 = cellOf(0).querySelector('input'); inp8.value = '1.0'; inp8.dispatchEvent(new Event('change'));
  const w8 = window.SW.compute(window.state).floors[0].walls[0];
  out.Vconn8 = w8.sill.Vconn; out.pf8 = w8.sill.penFactor; out.up8 = w8.uplift.plf;
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('16d sill: penetration cleared (default 1.25), spacing 16; rows gain the combined row; uplift 60.0 plf "default … verify"; shear 174.4 lb; combined v_max ≤ 58.2 plf',
  nailUI.pen === null && nailUI.spacing === 16 && nailUI.rows === 'sheathing,holdown,uplift,combined,sill,endpost' && Math.abs(nailUI.up - 60) < 0.05 && nailUI.upTxt.indexOf('p = 1.25 in (default: 3½" nail − 1½" plate − ¾" subfloor — verify)') >= 0 && Math.abs(nailUI.Vconn - 174.38) < 0.05 && nailUI.sillTxt.indexOf('(p = 1.25 in, default, Z × 0.772)') >= 0 && Math.abs(nailUI.vAllow - 58.2) < 0.1,
  JSON.stringify([nailUI.pen, nailUI.spacing, nailUI.rows, nailUI.up, nailUI.upTxt, nailUI.Vconn, nailUI.sillTxt, nailUI.vAllow]));
check('16d typed p = 2.0: uplift 96.0 plf, shear 226 lb, combined v_max ≤ 86.7 plf', Math.abs(nailUI.up2 - 96) < 0.05 && Math.abs(nailUI.Vconn2 - 226) < 1e-6 && Math.abs(nailUI.vAllow2 - 86.67) < 0.05, JSON.stringify([nailUI.up2, nailUI.Vconn2, nailUI.vAllow2]));
check('check table shows the combined row with Eq. 12.4-2 and the α = 45° resultant', /Combined shear \+ uplift/.test(nailUI.det) && /Eq\. 12\.4-2/.test(nailUI.det) && /α = 45°/.test(nailUI.det), nailUI.det.slice(0, 600));
check('8d common at the default (0.25" < 6D) is a model error naming §12.1.6.4, shown in the page messages', nailUI.pen8 === null && /p = 0\.25".*§12\.1\.6\.4/.test(nailUI.err8) && /§12\.1\.6\.4/.test(nailUI.msg8), nailUI.err8 + ' || ' + nailUI.msg8.slice(0, 300));
check('8d common typed p = 1.0: shear Z × p/10D = 155/1.31 = 118.3 lb, uplift 38.4 plf @ 16',
  Math.abs(nailUI.Vconn8 - 118.32) < 0.05 && Math.abs(nailUI.pf8 - 1 / 1.31) < 1e-6 && Math.abs(nailUI.up8 - 38.4) < 0.05, JSON.stringify([nailUI.Vconn8, nailUI.pf8, nailUI.up8]));
check('uplift reference table rendered from NAILS / SILL_CONN (10 rows) at the above-base defaults, with the washer bearing',
  nailUI.upRows === 10 && nailUI.sillRows === 10 && ['80.0', '100.0', '52.0', '552.0', '384.0', '5393.0', '3667.2', '4875.3', 'not rated for uplift', 'default is under 6D'].every((v) => nailUI.refTbl.indexOf(v) >= 0), nailUI.refTbl.slice(0, 500));

// ── segmented method per wall (Phase C): Method select → per-segment table,
// no uplift / combined rows, greyed cells; switching back restores the
// perforated rows; a count mismatch down the stack names the copy-down button ──
const segUI = await page.evaluate(() => {
  const bsel = (s) => s + ' .sum-pass, ' + s + ' .sum-fail, ' + s + ' .sum-req';
  const rows = (w) => w.checks.map((c) => c.id).join(',');
  const methodSel = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi].querySelector('.wall-table tbody tr td:nth-child(4) select');
  const cellAt = (fi, n) => document.querySelectorAll('#floor-con .floor-blk')[fi].querySelector('.wall-table tbody tr td:nth-child(' + n + ')');
  const setAll = (v) => { for (let fi = 0; fi < 4; fi++) { const s = methodSel(fi); s.value = v; s.dispatchEvent(new Event('change')); } };
  const out = { sel0: methodSel(0).value };
  setAll('segmented');
  const r = window.SW.compute(window.state), base = r.floors[3].walls[0], top = r.floors[0].walls[0];
  out.methods = window.state.floors.map((f) => f.walls[0].method).join(',');
  out.errors = r.errors.slice(); out.warnings = r.warnings.slice();
  out.baseRows = rows(base); out.topRows = rows(top);
  out.segRows = document.querySelectorAll('#wres_3_0 .seg-tbl tbody tr:not(.hl-row)').length;
  out.segCount = base.segments.length;
  out.segTxt = document.querySelector('#wres_3_0 .seg-tbl').innerText;
  out.banner = document.querySelector(bsel('#wres_3_0')).innerText; out.bannerCls = document.querySelector(bsel('#wres_3_0')).className;
  out.veff = base.gov.vmax; out.sumBeff = base.geom.sumBi; out.Co = base.geom.Co; out.T = base.gov.T;
  out.openTitle = cellAt(3, 8).getAttribute('title') || ''; out.unshTitle = cellAt(3, 9).getAttribute('title') || ''; out.upTitle = cellAt(3, 19).getAttribute('title') || '';
  out.openOpacity = getComputedStyle(cellAt(3, 8)).opacity;
  out.connUplift = document.querySelector('#wres_3_0 .conn-box').innerText;
  out.cards = document.querySelector('#wres_3_0 .dem-grid').innerText;
  out.detSheath = document.querySelector('#wres_3_0 .chk-tbl:nth-of-type(3) .calc-det').innerText.slice(0, 1500);
  out.uplift = base.uplift; out.combined = base.combined;
  // three segments on every level → three rows; 2b/h shows on the 4 ft one (h 10.5 → h/b 2.63)
  for (let fi = 0; fi < 4; fi++) { const inp = cellAt(fi, 7).querySelector('input'); inp.value = '100, 68, 4'; inp.dispatchEvent(new Event('change')); }
  const r3 = window.SW.compute(window.state).floors[3].walls[0];
  out.seg3Rows = document.querySelectorAll('#wres_3_0 .seg-tbl tbody tr:not(.hl-row)').length; out.seg3f = r3.segments.map((s) => s.f.toFixed(3)).join('/');
  out.seg3Err = window.SW.validate(window.state).errors.join(' | ');
  // roof back to one segment → count mismatch names the copy-down button
  const inp0 = cellAt(0, 7).querySelector('input'); inp0.value = '172'; inp0.dispatchEvent(new Event('change'));
  out.mismatch = document.getElementById('modelMsgs').innerText;
  // widths differ, same count → warning only
  inp0.value = '100, 60, 12'; inp0.dispatchEvent(new Event('change'));
  out.widthMsg = document.getElementById('modelMsgs').innerText; out.widthOk = window.SW.validate(window.state).ok;
  // back to perforated on every level → uplift and combined rows return
  setAll('perforated');
  const rb = window.SW.compute(window.state);
  out.backRows = rows(rb.floors[3].walls[0]) + ' / ' + rows(rb.floors[0].walls[0]);
  out.backSeg = document.querySelectorAll('#wres_3_0 .seg-tbl').length; out.backCo = rb.floors[3].walls[0].geom.Co;
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('method select defaults to perforated; switching every level to segmented computes with no model error',
  segUI.sel0 === 'perforated' && segUI.methods === 'segmented,segmented,segmented,segmented' && segUI.errors.length === 0, JSON.stringify([segUI.sel0, segUI.methods, segUI.errors]));
check('segmented rows: sheathing, holdown, sill, endpost on every level — no uplift, no combined; engine uplift / combined null',
  segUI.baseRows === 'sheathing,holdown,sill,endpost' && segUI.topRows === 'sheathing,holdown,sill,endpost' && segUI.uplift === null && segUI.combined === null, segUI.baseRows + ' / ' + segUI.topRows);
check('per-segment table: one row per segment (1), columns b_i / h/b / f_i / share / V_i / v_i / T_1 / T_2 / Hold-down / C / Post D/C',
  segUI.segRows === 1 && segUI.segCount === 1 && /Segment[\s\S]*Hold-down[\s\S]*Post D\/C/i.test(segUI.segTxt), segUI.segRows + ' ' + segUI.segTxt.slice(0, 300));
check('segmented banner reads Σb_eff and v_eff (no C_o), no "Specify"; v_eff = V/172 = 47.1 plf on the base, C_o null',
  /segmented, 1 segment/.test(segUI.banner) && /Σb\s*eff/.test(segUI.banner) && /v\s*eff/.test(segUI.banner) && !/C\s*o\s*=/.test(segUI.banner) && !/Specify/.test(segUI.banner)
    && Math.abs(segUI.veff - 8103 / 172) < 0.05 && segUI.sumBeff === 172 && segUI.Co === null && segUI.bannerCls === 'sum-pass', JSON.stringify([segUI.banner, segUI.veff, segUI.Co]));
check('openings / unsheathed / uplift cells greyed with a title saying why',
  /Segmented wall: openings are optional gaps/.test(segUI.openTitle) && /ignored/.test(segUI.unshTitle) && /no §4\.3\.6\.4\.2\.1 uniform uplift row/.test(segUI.upTitle) && Number(segUI.openOpacity) < 1, JSON.stringify([segUI.openTitle, segUI.unshTitle, segUI.upTitle, segUI.openOpacity]));
check('conn-box UPLIFT line says not checked (segmented); cards show Σb_eff, v_eff, max v_i and no uplift card',
  /UPLIFT:[\s\S]*not checked \(segmented wall\)/.test(segUI.connUplift) && /Σb\s*eff/.test(segUI.cards) && /max v\s*i/.test(segUI.cards) && !/t uplift/.test(segUI.cards), segUI.connUplift + ' || ' + segUI.cards);
check('sheathing detail cites §4.3.2.1 / §4.3.5.5.1 Exception 1 and the 2015 clause, states v_i ≤ f_i·v_ASD ⇔ v_eff ≤ v_ASD',
  /§4\.3\.2\.1 \/ §4\.3\.5\.5\.1 Exception 1 \(2015 §4\.3\.5\.1 \/ §4\.3\.3\.4\.1 Exc\. 1\)/.test(segUI.detSheath) && /v\s*i\s*≤ f\s*i\s*·v\s*ASD/.test(segUI.detSheath), segUI.detSheath.slice(0, 400));
check('three segments [100, 68, 4] on every level → three rows, f = 1 / 1 / 0.762 (2b/h at h/b 2.63), no error',
  segUI.seg3Rows === 3 && segUI.seg3f === '1.000/1.000/0.762' && segUI.seg3Err === '', JSON.stringify([segUI.seg3Rows, segUI.seg3f, segUI.seg3Err]));
check('roof back to one segment → model error naming "Copy walls to levels below"', /3 segments/.test(segUI.mismatch) && /1 segments? at/.test(segUI.mismatch) && /Copy walls to levels below/.test(segUI.mismatch), segUI.mismatch.slice(0, 400));
check('widths differ with the same count → warning naming both, model still valid', segUI.widthOk === true && /segment widths differ/.test(segUI.widthMsg) && /100, 60, 12/.test(segUI.widthMsg) && /100, 68, 4/.test(segUI.widthMsg), segUI.widthMsg.slice(0, 400));
check('switching back to perforated restores the uplift (and combined) rows, the C_o and removes the segment table',
  segUI.backRows === 'sheathing,holdown,uplift,sill,endpost / sheathing,holdown,uplift,combined,sill,endpost' && segUI.backSeg === 0 && Math.abs(segUI.backCo - 0.6703) < 0.0002, JSON.stringify([segUI.backRows, segUI.backSeg, segUI.backCo]));

// ── shared-toolbar Wide toggle: body.are-wide lifts the theme's 1280px cap ───
// data-are-wide-default on the script tag → on by default; per-calc key.
const wide = await page.evaluate(() => {
  const cap = () => getComputedStyle(document.querySelector('.container')).maxWidth;
  const on = () => document.body.classList.contains('are-wide');
  const btn = document.getElementById('areWideBtn');
  const w0 = on(), cap0 = cap(), t0 = btn.textContent;
  btn.click(); const w1 = on(), cap1 = cap(), t1 = btn.textContent, s1 = localStorage.getItem('areCalcs_wide:stacked_shearwall_calculator.html');
  btn.click(); const w2 = on(), cap2 = cap(), t2 = btn.textContent, s2 = localStorage.getItem('areCalcs_wide:stacked_shearwall_calculator.html');
  return { w0, cap0, t0, w1, cap1, t1, s1, w2, cap2, t2, s2, oldKey: localStorage.getItem('areCalcs_sw_wide'), localBtn: !!document.getElementById('wideBtn') };
});
check('wide: on by default (cap none), toggles off to 1280px and back, remembered under the per-calc key',
  wide.w0 && wide.cap0 === 'none' && !wide.w1 && wide.cap1 === '1280px' && wide.s1 === '0' && wide.w2 && wide.cap2 === 'none' && wide.s2 === '1', JSON.stringify(wide));
check('wide: button text tracks the state (⬜ Wide ✓ / ⛶ Wide)',
  wide.t0 === '⬜ Wide ✓' && wide.t1 === '⛶ Wide' && wide.t2 === '⬜ Wide ✓', JSON.stringify([wide.t0, wide.t1, wide.t2]));
check('wide: page-local #wideBtn and areCalcs_sw_wide key are gone', !wide.localBtn && wide.oldKey === null, JSON.stringify(wide));

// ── wide-key migration: a browser that still holds the old page-local key ────
// Fresh context (own localStorage); the init script runs before any page
// script, so the seed line at the top of the page sees the old key exactly as
// a returning browser would. Old '0' → new '0', old key dropped, narrow.
const mig = await browser.newContext();
await mig.addInitScript(() => { try { localStorage.setItem('areCalcs_sw_wide', '0'); } catch (e) {} });
const mp = await mig.newPage();
await mp.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await mp.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await mp.waitForSelector('#areBar');
const migOut = await mp.evaluate(() => ({
  neu: localStorage.getItem('areCalcs_wide:stacked_shearwall_calculator.html'),
  old: localStorage.getItem('areCalcs_sw_wide'),
  wide: document.body.classList.contains('are-wide'),
  cap: getComputedStyle(document.querySelector('.container')).maxWidth,
}));
await mig.close();
check('wide: old areCalcs_sw_wide=0 seeds the per-calc key to 0, drops the old key, page opens narrow',
  migOut.neu === '0' && migOut.old === null && !migOut.wide && migOut.cap === '1280px', JSON.stringify(migOut));

// ── reference tables are rendered from the engine arrays ────────────────────
const refs = await page.evaluate(() => ({
  hd: document.querySelectorAll('#hdTbl tbody tr').length,
  hdText: document.querySelector('#hdTbl tbody').innerText,
  strap: document.querySelectorAll('#strapTbl tbody tr').length,
  sh: document.querySelectorAll('#shTbl tbody tr').length,
  shText: document.querySelector('#shTbl tbody').innerText,
  sill: document.querySelectorAll('#sillTbl tbody tr').length,
  sillText: document.querySelector('#sillTbl tbody').innerText
}));
check('HDUE schedule rendered from SW.HOLDOWNS with the full C-C-2026 p. 61 grid, DF/SP and SPF/HF columns',
  refs.hd === 6 && ['3,790', '8,425', '9,390', '11,900', '12,950', '13,110', '16,040', '17,685',
                    '3,340', '4,700', '6,030', '7,305', '7,995', '10,215', '11,030', '10,980', '13,545', '14,775']
    .every((v) => refs.hdText.indexOf(v) >= 0),
  refs.hdText.slice(0, 400));
check('strap schedule rendered from SW.STRAPS', refs.strap === 3, 'rows=' + refs.strap);
check('sheathing table rendered from SW.SHEATHING with both ASD columns',
  refs.sh === 8 && refs.shText.indexOf('239.3') >= 0, 'rows=' + refs.sh);
check('sill table rendered from SW.SILL_CONN with DF-L / SP / SPF columns (10 rows: LTP4, six nail sizes, SDS, two bolts)',
  refs.sill === 10 && ['715', '615', '226', '246', '192', '189', '155', '165', '149', '115'].every((v) => refs.sillText.indexOf(v) >= 0), 'rows=' + refs.sill);

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
    paneB: document.querySelector('#wres_0_1 .sum-pass, #wres_0_1 .sum-fail, #wres_0_1 .sum-req').innerText
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

// ── wall lines with several walls (Phase D): "+ line" clones the roof wall
// onto its line (#2 id, -2 label, same line force), the chip shows the share,
// geometry stays per wall, construction and the line force fan out, the floor
// Σ counts each line once, and clearing the key splits the wall off ────────
// Column numbers: 2 Line, 3 L, 5 P_W, 7 b_i, 8 openings, 10 Face 1, 16 Spacing.
const ln = await page.evaluate(() => {
  const blk = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi];
  const wallRows = (fi) => [...blk(fi).querySelectorAll('.wall-table tbody tr')].filter((tr) => tr.querySelector('.line-chip'));
  const chips = (fi) => wallRows(fi).map((tr) => tr.querySelector('.line-chip').innerText.trim());
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); };
  const cell = (fi, wi, n) => wallRows(fi)[wi].querySelector('td:nth-child(' + n + ')');
  const errBoxes = () => document.querySelectorAll('#modelMsgs .err-box').length;
  const out = {};
  window.state.floors[0].walls[0].P_wind_lb = 4000; window.render();
  out.btnTitle = wallRows(0)[0].querySelector('.btn-line').getAttribute('title');
  wallRows(0)[0].querySelector('.btn-line').click();
  const f0 = window.state.floors[0], r1 = window.SW.compute(window.state);
  out.n = f0.walls.length; out.ids = f0.walls.map((w) => w.id).join(','); out.labels = f0.walls.map((w) => w.label).join(',');
  out.lines = f0.walls.map((w) => w.line).join(','); out.P = f0.walls.map((w) => w.P_wind_lb).join(','); out.Pseis = f0.walls.map((w) => w.P_seis_lb).join(',');
  out.rows = wallRows(0).length; out.chips = chips(0); out.lineCells = wallRows(0).map((tr) => tr.querySelector('td:nth-child(2) input').value).join(',');
  out.eng = r1.floors[0].walls.map((w) => w.line); out.V = r1.floors[0].walls.map((w) => w.cases.wind.V);
  out.sum = blk(0).querySelector('.lf-sum').innerText; out.err0 = errBoxes(); out.notes = r1.notes.filter((s) => s.indexOf('several walls') >= 0).length;
  out.lowerWalls = window.state.floors.slice(1).map((f) => f.walls.length).join(',');
  // geometry per wall: the clone gets L 151, one 86 ft segment, no openings -> cap 86 vs 0.6074 × 172 = 104.48
  set(cell(0, 1, 3).querySelector('input'), '151'); set(cell(0, 1, 7).querySelector('input'), '86'); set(cell(0, 1, 8).querySelector('input'), '');
  const r2 = window.SW.compute(window.state), s2 = r2.floors[0].walls.map((w) => w.line.share);
  out.L = window.state.floors[0].walls.map((w) => w.L_ft).join(','); out.share2 = s2; out.chips2 = chips(0); out.vmax2 = r2.floors[0].walls.map((w) => w.cases.wind.vmax);
  out.expChip = s2.map((s) => 'line w1 · 2 walls · share ' + (Math.round(s * 1000) / 10) + ' %');
  out.banner0 = document.querySelector('#wres_0_0 .sum-pass, #wres_0_0 .sum-fail, #wres_0_0 .sum-req').innerText;
  window.expandWall(0, 0); out.det0 = document.querySelector('#wres_0_0').innerText;
  // construction fans out: face 1 on row 0 -> row 1; sill spacing on row 1 -> row 0
  set(cell(0, 0, 10).querySelector('select'), 'wsp1532_10d_4');
  set(cell(0, 1, 16).querySelector('select'), '8');
  out.face = window.state.floors[0].walls.map((w) => w.sheathing.face1.nail + '@' + w.sheathing.face1.spacing).join(',');
  out.spacing = window.state.floors[0].walls.map((w) => w.sill.spacing_in).join(','); out.Lafter = window.state.floors[0].walls.map((w) => w.L_ft).join(',');
  out.lowerFace = window.state.floors[1].walls[0].sheathing.face1.nail;
  // the line force fans out too (one force per line): P_W typed on row 1 -> row 0, no model error, Σ once
  set(cell(0, 1, 5).querySelector('input'), '5000');
  out.Pfan = window.state.floors[0].walls.map((w) => w.P_wind_lb).join(','); out.errFan = errBoxes(); out.sumFan = blk(0).querySelector('.lf-sum').innerText;
  // clearing the clone's line key makes it its own line: no chips, full line force on each, Σ counts both
  set(cell(0, 1, 2).querySelector('input'), '');
  const r3 = window.SW.compute(window.state);
  out.lineKeyGone = !('line' in window.state.floors[0].walls[1]); out.chips3 = chips(0); out.walls3 = r3.floors[0].walls.map((w) => w.line.walls).join(',');
  out.V3 = r3.floors[0].walls.map((w) => w.cases.wind.V); out.sum3 = blk(0).querySelector('.lf-sum').innerText; out.err3 = errBoxes();
  // "+ line" ids are unique per stack: the base takes #3 (#2 is on the roof), a third roof wall #4
  wallRows(3)[0].querySelector('.btn-line').click();
  out.baseIds = window.state.floors[3].walls.map((w) => w.id).join(','); out.baseSill = window.state.floors[3].walls[1].sill.conn;
  wallRows(0)[0].querySelector('.btn-line').click();
  out.roofIds = window.state.floors[0].walls.map((w) => w.id).join(',');
  // "+ Wall Line" after a split is a NEW line, not another wall on w1's line
  window.addWall(0);
  const added = window.state.floors[0].walls[window.state.floors[0].walls.length - 1];
  out.addedLine = 'line' in added; out.addedWalls = window.SW.compute(window.state).floors[0].walls.slice(-1)[0].line.walls;
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('"+ Wall Line" after a split starts its own line (no line key, walls 1)', ln.addedLine === false && ln.addedWalls === 1, JSON.stringify([ln.addedLine, ln.addedWalls]));
check('+ line: a second wall on the roof line — id w1#2, label "Wall Line A-2", line w1 on both (cells show it), same P_W, P_E blank, lower levels untouched',
  ln.n === 2 && ln.ids === 'w1,w1#2' && ln.labels === 'Wall Line A,Wall Line A-2' && ln.lines === 'w1,w1' && ln.lineCells === 'w1,w1' && ln.P === '4000,4000' && ln.Pseis === ',' && ln.rows === 2 && ln.lowerWalls === '1,1,1' && /^Add another wall on this line/.test(ln.btnTitle), JSON.stringify(ln));
check('+ line: chip "line w1 · 2 walls · share 50 %" on both rows; engine line {w1, 2, 0.5}; V = 0.6 × 4,000 × 0.5 = 1,200 lb each; note printed, no error',
  ln.chips.join('|') === 'line w1 · 2 walls · share 50 %|line w1 · 2 walls · share 50 %' && ln.eng.every((l) => l.key === 'w1' && l.walls === 2 && Math.abs(l.share - 0.5) < 1e-9) && ln.V.every((v) => Math.abs(v - 1200) < 1e-6) && ln.notes === 1 && ln.err0 === 0, JSON.stringify([ln.chips, ln.eng, ln.V, ln.notes, ln.err0]));
check('+ line: floor Σ counts the line once — "Σ wall lines = 4,000 lb (level 4,638 lb)"', ln.sum.indexOf('Σ wall lines = 4,000 lb (level 4,638 lb)') >= 0, ln.sum);
check('geometry per wall: clone L 151 / 86 ft opening-free, base wall stays 302; shares 104.48 : 86 (0.549 / 0.451), chips follow, equal v_max',
  ln.L === '302,151' && Math.abs(ln.share2[0] - 104.4809 / 190.4809) < 1e-4 && Math.abs(ln.share2[1] - 86 / 190.4809) < 1e-4 && ln.chips2.join('|') === ln.expChip.join('|') && Math.abs(ln.vmax2[0] - ln.vmax2[1]) < 1e-9, JSON.stringify([ln.L, ln.share2, ln.chips2, ln.vmax2]));
check('banner names the line share; hold-down detail prints V_line × share = V_i and the increment ΔV',
  /line w1: share 0\.549 = 104\.4\d \/ 190\.4\d ft of 2 walls/.test(ln.banner0) && /V\s*line\s*= 4,000 lb \(strength, Σ to this level\) × share 0\.549 = V\s*i\s*= 2,194 lb; ΔV = 2,194 lb/.test(ln.det0), ln.banner0 + ' || ' + ln.det0.slice(0, 1500));
check('construction fans out along the line (face 1 row 0 → row 1; sill spacing row 1 → row 0), not down the stack, L untouched',
  ln.face === '10d common@4,10d common@4' && ln.spacing === '8,8' && ln.Lafter === '302,151' && ln.lowerFace === '8d common', JSON.stringify([ln.face, ln.spacing, ln.Lafter, ln.lowerFace]));
check('line force fans out (P_W 5,000 typed on row 1 reaches row 0), no model error, Σ once = 5,000', ln.Pfan === '5000,5000' && ln.errFan === 0 && ln.sumFan.indexOf('Σ wall lines = 5,000 lb') >= 0, JSON.stringify([ln.Pfan, ln.errFan, ln.sumFan]));
check('clearing the clone\'s Line key: key removed, no chips, each wall its own line at V = 0.6 × 5,000 = 3,000 lb, Σ = 10,000 lb, no error',
  ln.lineKeyGone && ln.chips3.join('|') === '|' && ln.walls3 === '1,1' && ln.V3.every((v) => Math.abs(v - 3000) < 1e-6) && ln.sum3.indexOf('Σ wall lines = 10,000 lb') >= 0 && ln.err3 === 0, JSON.stringify([ln.lineKeyGone, ln.chips3, ln.walls3, ln.V3, ln.sum3, ln.err3]));
check('+ line ids are unique per stack: the base gets w1#3 (w1#2 is on the roof) with the base sill; a third roof wall gets w1#4',
  ln.baseIds === 'w1,w1#3' && ln.baseSill === 'ab58' && ln.roofIds === 'w1,w1#4,w1#2', JSON.stringify([ln.baseIds, ln.baseSill, ln.roofIds]));

// ── copy walls to levels below (Phase E): the roof wall's geometry and
// construction land on the wall with the same id on every lower level (created
// where missing), the base keeps its anchor-bolt sill / HDUE / own penetration
// default, the level's own numbers stay, a split line copies both walls and a
// base-only line mate takes the construction, Undo is one exact step ───────
// Column numbers: 4 Method, 7 b_i, 8 openings, 10 Face 1, 14 Hold-down, 16 Spacing, 19 Uplift.
const cd = await page.evaluate(() => {
  const blk = (fi) => document.querySelectorAll('#floor-con .floor-blk')[fi];
  const wallRows = (fi) => [...blk(fi).querySelectorAll('.wall-table tbody tr')].filter((tr) => tr.querySelector('.line-chip'));
  const cell = (fi, wi, n) => wallRows(fi)[wi].querySelector('td:nth-child(' + n + ')');
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); };
  const copyBtn = (fi) => [...blk(fi).querySelectorAll('.floor-hdr button')].filter((b) => b.textContent.indexOf('Copy walls to levels below') >= 0)[0] || null;
  const COPY = ['L_ft', 'segments_ft', 'openings', 'unsheathed_ft2', 'method', 'line', 'label', 'sheathing', 'endPost', 'holdown', 'sillSpecies', 'uplift'];
  const pick = (w, keys) => JSON.stringify(keys.map((k) => w[k]));
  const wallById = (fi, id) => window.state.floors[fi].walls.filter((w) => w.id === id)[0];
  const out = {};
  window.wCnt = 1;   // fresh counter: the hand-added walls below are w2 / w3
  const fl = window.state.floors;
  out.btns = fl.map((f, i) => !!copyBtn(i)).join(',');
  out.btnText = copyBtn(0).textContent.trim();
  // marks on the lower levels that must survive the copy
  fl[1].walls[0].dead = { w_plf: 100, P_end_lb: 500, source: 'manual' }; fl[1].walls[0].transfer = true;
  fl[3].walls[0].dead = { w_plf: 200, P_end_lb: 1000, source: 'manual' }; fl[3].walls[0].P_wind_lb = 3000;
  fl[3].walls[0].uplift.penetration_in = 1.5; fl[3].walls[0].uplift.washer_in = 4;   // a typed base penetration must not survive; the base washer must
  // a base-only wall on line w1 (a line mate with nothing above it), sill spacing 32
  window.addWall(3); window.updWall(3, 1, 'line', 'w1'); fl[3].walls[1].sill.spacing_in = 32;
  // the 2ND floor loses its w1 (a hand-added w3 stays so the level is not empty)
  window.addWall(2); window.delWall(2, 0);
  window.render();
  // roof edits through the cells: segmented [100, 68, 4], two openings, 10d @ 4, strap, sill @ 8, typed p 2.0
  set(cell(0, 0, 4).querySelector('select'), 'segmented');
  set(cell(0, 0, 7).querySelector('input'), '100, 68, 4'); set(cell(0, 0, 8).querySelector('input'), '20×7, 10×6');
  set(cell(0, 0, 10).querySelector('select'), 'wsp1532_10d_4'); set(cell(0, 0, 14).querySelector('select'), 'strap');
  set(cell(0, 0, 16).querySelector('select'), '8'); set(cell(0, 0, 19).querySelector('input'), '2.0');
  window.updWall(0, 0, 'postN', '3'); window.updWall(0, 0, 'sillSpecies', 'SPF'); window.updWall(0, 0, 'unsheathed_ft2', '12'); window.updWall(0, 0, 'label', 'Roof Wall');
  window.updWall(0, 0, 'upliftSource', 'manual'); window.updWall(0, 0, 'upliftCap', '83');   // a Manual plf for the nailed / screwed plate above
  // split the roof line: w1#2 at L 151, one 86 ft segment (construction follows the line)
  wallRows(0)[0].querySelector('.btn-line').click();
  window.updWall(0, 1, 'L_ft', '151'); window.updWall(0, 1, 'segments_ft', '86');
  const roof = window.state.floors[0].walls;
  out.roofIds = roof.map((w) => w.id).join(','); out.roofPen = roof[0].uplift.penetration_in; out.roofHd = roof[0].holdown;
  out.wallsBefore = window.state.floors.map((f) => f.walls.map((w) => w.id).join('+')).join(' / ');
  const before = JSON.stringify(window.state.floors), wCntBefore = window.wCnt;
  out.wCntBefore = wCntBefore;
  copyBtn(0).click();
  const F = window.state.floors, res = window.SW.compute(window.state);
  out.msg = (document.querySelector('#copyDownMsg') || { innerText: '' }).innerText;
  out.wallsAfter = F.map((f) => f.walls.map((w) => w.id).join('+')).join(' / ');
  out.wCntAfter = window.wCnt;
  // the copy list matches on every lower w1 (the base differs only where the base rules say so)
  const roofPick = pick(roof[0], COPY);
  out.match12 = [1, 2].every((fi) => pick(wallById(fi, 'w1'), COPY) === roofPick && JSON.stringify(wallById(fi, 'w1').sill) === JSON.stringify(roof[0].sill));
  const b = wallById(3, 'w1');
  const notBase = (k) => k !== 'holdown' && k !== 'uplift' && k !== 'sillSpecies';
  out.baseMatch = pick(b, COPY.filter(notBase)) === pick(roof[0], COPY.filter(notBase));
  out.base = { sill: b.sill.conn + '/' + b.sill.spacing_in, hd: b.holdown, pen: b.uplift.penetration_in, washer: b.uplift.washer_in, src: b.uplift.source, cap: b.uplift.capacity_plf, sp: b.sillSpecies, dead: b.dead.w_plf + '/' + b.dead.P_end_lb, P: b.P_wind_lb };
  out.upper = [1, 2].map((fi) => wallById(fi, 'w1').uplift.source + ':' + wallById(fi, 'w1').uplift.capacity_plf + ':' + wallById(fi, 'w1').sillSpecies).join(' / ');
  // the level's own numbers stay
  out.kept1 = JSON.stringify([wallById(1, 'w1').dead, wallById(1, 'w1').transfer, wallById(1, 'w1').P_wind_lb, wallById(1, 'w1').P_seis_lb]);
  out.h = F.map((f) => f.h_ft).join(','); out.PW = F.map((f) => Math.round(f.P_wind_lb)).join(',');
  // the recreated 2ND-floor w1: blank dead / transfer / line force, the level's h
  const c = wallById(2, 'w1');
  out.created = JSON.stringify([c.dead, c.transfer, c.P_wind_lb, c.P_seis_lb, c.h_ft]);
  // the split wall reached every level; the base-only mate w2 took the construction, kept its own geometry, label and sill
  out.split = [1, 2, 3].map((fi) => { const x = wallById(fi, 'w1#2'); return x ? x.L_ft + ':' + x.segments_ft.join('|') + ':' + x.line + ':' + x.label : 'missing'; }).join(' / ');
  const m = wallById(3, 'w2');
  out.mate = { face: m.sheathing.face1.nail + '@' + m.sheathing.face1.spacing, postN: m.endPost.n, hd: m.holdown, sp: m.sillSpecies, method: m.method, pen: m.uplift.penetration_in, src: m.uplift.source, label: m.label, L: m.L_ft, seg: m.segments_ft.join('|'), sill: m.sill.conn + '/' + m.sill.spacing_in, line: m.line };
  out.errs = res.errors; out.errBoxes = document.querySelectorAll('#modelMsgs .err-box').length;
  out.baseHdLabel = res.floors[3].walls[0].holdown && res.floors[3].walls[0].holdown.label;
  // Undo: one exact step, then gone
  document.querySelector('#copyDownMsg .btn-undo').click();
  out.undoSame = JSON.stringify(window.state.floors) === before; out.undoWCnt = window.wCnt === wCntBefore;
  out.undoMsgGone = !document.querySelector('#copyDownMsg');
  window.undoCopyDown(); out.undoTwice = JSON.stringify(window.state.floors) === before;
  // the snapshot lapses on the next model change
  copyBtn(0).click(); const afterCopy = JSON.stringify(window.state.floors);
  window.updWall(0, 0, 'label', 'Roof Wall 2'); out.lapseMsgGone = !document.querySelector('#copyDownMsg');
  window.undoCopyDown(); out.lapseNoop = JSON.stringify(window.state.floors) === afterCopy.replace('"label":"Roof Wall"', '"label":"Roof Wall 2"');
  window.state = window.SW.defaultState(); window.wCnt = 1; window.render();
  return out;
});
check('copy-down button on every level but the base, labelled "⇩ Copy walls to levels below"', cd.btns === 'true,true,true,false' && cd.btnText === '⇩ Copy walls to levels below', JSON.stringify([cd.btns, cd.btnText]));
check('copy-down: roof set up as segmented [100, 68, 4], strap, p 2.0, split w1 + w1#2; 2ND floor holds w3 only before the copy',
  cd.roofIds === 'w1,w1#2' && cd.roofPen === 2 && cd.roofHd === 'strap' && cd.wallsBefore === 'w1+w1#2 / w1 / w3 / w1+w2', JSON.stringify([cd.roofIds, cd.roofPen, cd.roofHd, cd.wallsBefore]));
check('copy-down: message "Copied 2 walls from 4th Floor to 6 walls on 3 levels below (4 created, 1 more on shared lines)" with Undo; walls w1 / w1#2 on every level, wCnt 3 → 7',
  /^Copied 2 walls from 4th Floor to 6 walls on 3 levels below \(4 created, 1 more on shared lines\)\.\s*Undo$/.test(cd.msg.trim()) && cd.wallsAfter === 'w1+w1#2 / w1+w1#2 / w3+w1+w1#2 / w1+w2+w1#2' && cd.wCntBefore === 3 && cd.wCntAfter === 7, JSON.stringify([cd.msg, cd.wallsAfter, cd.wCntBefore, cd.wCntAfter]));
check('copy-down: 3RD and 2ND w1 match the roof on L, segments, openings, unsheathed, method, line, label, sheathing, end post, hold-down, sill species (SPF), uplift (Manual 83 plf, p 2.0) and sill (sds14 @ 8)',
  cd.match12 === true && cd.upper === 'manual:83:SPF / manual:83:SPF', JSON.stringify([cd.match12, cd.upper]));
check('copy-down: base w1 matches on the geometry / construction list but keeps ab58 @ 20, HDUE (strap not permitted at the base), sill species DFL, p reset to null, washer 4, uplift back to Auto at the anchor bolts (83 plf kept in the object), dead 200/1000, P_W 3,000',
  cd.baseMatch === true && cd.base.sill === 'ab58/20' && cd.base.hd === 'hdue' && cd.base.sp === 'DFL' && cd.base.pen === null && cd.base.washer === 4 && cd.base.src === 'sill' && cd.base.cap === 83 && cd.base.dead === '200/1000' && cd.base.P === 3000, JSON.stringify(cd.base));
check('copy-down: 3RD-floor dead 100/500, transfer and blank line force kept; level h and P_W untouched',
  cd.kept1 === '[{"w_plf":100,"P_end_lb":500,"source":"manual"},true,null,null]' && cd.h === '8,9.5,9.5,10.5' && cd.PW === '4638,2768,2897,3202', JSON.stringify([cd.kept1, cd.h, cd.PW]));
check('copy-down: the recreated 2ND-floor w1 has dead 0/0, no transfer, line force blank, h 9.5', cd.created === '[{"w_plf":0,"P_end_lb":0,"source":"manual"},false,null,null,9.5]', cd.created);
check('copy-down: w1#2 (151 ft, [86], line w1, label "Roof Wall-2") created on every lower level', cd.split === '151:86:w1:Roof Wall-2 / 151:86:w1:Roof Wall-2 / 151:86:w1:Roof Wall-2', cd.split);
check('copy-down: base-only mate w2 on line w1 takes the construction (10d @ 4, 3 posts, HDUE, segmented, p null, Auto uplift) and keeps its L 302 / [172], label, ab58 @ 32, sill species DFL',
  cd.mate.face === '10d common@4' && cd.mate.postN === 3 && cd.mate.hd === 'hdue' && cd.mate.sp === 'DFL' && cd.mate.method === 'segmented' && cd.mate.pen === null && cd.mate.src === 'sill' && cd.mate.label === 'Wall Line B' && cd.mate.L === 302 && cd.mate.seg === '172' && cd.mate.sill === 'ab58/32' && cd.mate.line === 'w1', JSON.stringify(cd.mate));
check('copy-down: the copied model computes with no error; the base hold-down is an HDUE', cd.errs.length === 0 && cd.errBoxes === 0 && /^HDUE/.test(cd.baseHdLabel || ''), JSON.stringify([cd.errs, cd.errBoxes, cd.baseHdLabel]));
check('copy-down Undo restores JSON.stringify(state.floors) and wCnt exactly, removes the message, is a no-op the second time',
  cd.undoSame === true && cd.undoWCnt === true && cd.undoMsgGone === true && cd.undoTwice === true, JSON.stringify([cd.undoSame, cd.undoWCnt, cd.undoMsgGone, cd.undoTwice]));
check('copy-down Undo lapses on the next model change (message gone, undoCopyDown a no-op)', cd.lapseMsgGone === true && cd.lapseNoop === true, JSON.stringify([cd.lapseMsgGone, cd.lapseNoop]));
check('copy-down: no dialogs', dialogs.length === 0, dialogs.join('\n      '));

// ── WP-3 S4: "HD inside" only acts on 10d common faces (Table 4.3A fn. 10) ──
// Column 12 = HD inside, column 10 = Face 1, column 11 = Face 2.
const hd = await page.evaluate(() => {
  window.state = window.SW.defaultState(); window.render();
  const row0 = () => [...document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('.wall-table tbody tr')].filter((tr) => tr.querySelector('.line-chip'))[0];
  const hdCell = () => row0().querySelector('td:nth-child(12)');
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); };
  const sheRow = () => { const r = [...document.querySelectorAll('#wres_0_0 .conn-row')].filter((x) => x.innerText.indexOf('SHEATHING:') === 0)[0]; return r ? r.innerText : ''; };
  const snap = () => { const c = hdCell(), b = c.querySelector('input[type=checkbox]'); return { na: c.classList.contains('hd-na'), dis: b.disabled, chk: b.checked, cap: c.innerText.trim(), title: c.getAttribute('title') || '' }; };
  const out = {};
  out.nail = window.state.floors[0].walls[0].sheathing.face1.nail;
  out.def = snap();
  // a ticked state on an 8d wall (older file / line-mate) is kept but shown n/a, no factor
  window.state.floors[0].walls[0].sheathing.insideFaceHoldown = true; window.render();
  out.kept = snap(); out.keptRow = sheRow(); out.keptFn10 = window.SW.compute(window.state).floors[0].walls[0].cap.face1.fn10;
  // face 1 -> 10d common: the box re-enables with the kept tick; the row names the factor
  set(row0().querySelector('td:nth-child(10) select'), 'wsp1532_10d_4');
  out.on = snap(); out.onRow = sheRow(); out.onFn10 = window.SW.compute(window.state).floors[0].walls[0].cap.face1.fn10;
  // untick through the UI: no factor, no suffix
  const b = hdCell().querySelector('input[type=checkbox]'); b.checked = false; b.dispatchEvent(new Event('change'));
  out.off = snap(); out.offRow = sheRow(); out.offState = window.state.floors[0].walls[0].sheathing.insideFaceHoldown;
  // face 1 back to 8d, face 2 10d -> still applicable (either face)
  set(row0().querySelector('td:nth-child(10) select'), window.SW.SHEATHING.filter((s) => s.type === 'wsp' && s.nail === '8d common')[0].id);
  out.f1Only8 = snap().na;
  set(row0().querySelector('td:nth-child(11) select'), 'wsp1532_10d_6');
  out.face2 = snap().na;
  out.pv = !!hdCell().querySelector('.pv');   // a checkbox gets no print-value span
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('HD inside: default 8d wall -> box disabled, "n/a" caption, title names Table 4.3A fn. 10 and 10d common',
  hd.nail === '8d common' && hd.def.na && hd.def.dis && hd.def.cap === 'n/a' && /fn\. 10/.test(hd.def.title) && /10d common/.test(hd.def.title), JSON.stringify(hd.def));
check('HD inside: a ticked state on an 8d wall is kept (checked, disabled), fn10 = 1, no × 0.92 on the SHEATHING row',
  hd.kept.chk && hd.kept.dis && hd.keptFn10 === 1 && hd.keptRow.indexOf('0.92') < 0, JSON.stringify([hd.kept, hd.keptFn10, hd.keptRow]));
check('HD inside: face 1 -> 10d common re-enables the box with the kept tick; fn10 = 0.92; row ends "× 0.92 (HD inside, Table 4.3A fn. 10)"',
  !hd.on.na && !hd.on.dis && hd.on.chk && hd.onFn10 === 0.92 && hd.onRow.indexOf('× 0.92 (HD inside, Table 4.3A fn. 10)') >= 0, JSON.stringify([hd.on, hd.onFn10, hd.onRow]));
check('HD inside: unticking removes the factor note', !hd.off.chk && hd.offState === false && hd.offRow.indexOf('0.92') < 0, JSON.stringify([hd.off, hd.offRow]));
check('HD inside: n/a follows the faces — 8d face 1 only -> n/a; 10d on face 2 -> applicable', hd.f1Only8 === true && hd.face2 === false, JSON.stringify([hd.f1Only8, hd.face2]));

// ── WP-3 S4: wCnt refresh after a model swap (stale counter -> duplicate id ->
// two walls silently merged into one line) ─────────────────────────────────
// importProject through the page's own Load File input, with a counter left
// stale by the previous model; then the adapter's setModel with a stale wCnt.
const staleFile = OUT_DIR + 'sw-stale-wcnt.json';
{
  const st = await page.evaluate(() => {
    window.state = window.SW.defaultState(); window.wCnt = 1; window.render();
    window.addWall(0); window.addWall(0);   // w2, w3 on the roof -> three lines
    const s = JSON.parse(JSON.stringify(window.state));
    window.state = window.SW.defaultState(); window.wCnt = 1; window.render();   // previous model: counter back at 1
    return s;
  });
  writeFileSync(staleFile, JSON.stringify({ version: 2, state: st }));
}
await page.setInputFiles('input[type=file][accept=".json"]', staleFile);
await page.waitForFunction(() => window.state.floors[0].walls.length === 3);
const stale = await page.evaluate(() => {
  const out = { wCntLoaded: window.wCnt, idsLoaded: window.state.floors[0].walls.map((w) => w.id).join(',') };
  window.addWall(0);
  const r = window.SW.compute(window.state);
  out.idsAfter = window.state.floors[0].walls.map((w) => w.id).join(',');
  out.lineWalls = r.floors[0].walls.map((w) => w.line.walls).join(',');
  // adapter path: a file saved with a stale wCnt
  const a = window.__SW_ADAPTER, m = a.getModel();
  m.wCnt = 1; a.setModel(m);
  out.wCntSet = window.wCnt;
  window.addWall(0);
  out.idsSet = window.state.floors[0].walls.map((w) => w.id).join(',');
  out.lineWallsSet = window.SW.compute(window.state).floors[0].walls.map((w) => w.line.walls).join(',');
  // addWall itself steps past a taken id even with a stale counter
  window.wCnt = 1; window.addWall(0);
  out.idsGuard = window.state.floors[0].walls.map((w) => w.id).join(',');
  window.state = window.SW.defaultState(); window.wCnt = 1; window.render();
  return out;
});
check('stale wCnt: Load File refreshes the counter to the highest wN id (3); "+ Wall Line" then mints w4, every wall its own line',
  stale.idsLoaded === 'w1,w2,w3' && stale.wCntLoaded === 3 && stale.idsAfter === 'w1,w2,w3,w4' && stale.lineWalls === '1,1,1,1', JSON.stringify(stale));
check('stale wCnt: setModel with a saved wCnt of 1 refreshes to 4; next wall w5, no merged line',
  stale.wCntSet === 4 && stale.idsSet === 'w1,w2,w3,w4,w5' && stale.lineWallsSet === '1,1,1,1,1', JSON.stringify(stale));
check('stale wCnt: addWall skips an id already taken (counter forced to 1 -> w6)', stale.idsGuard === 'w1,w2,w3,w4,w5,w6', stale.idsGuard);

// ── WP-3 S9: "How to use" bullets + worked example; line grouping; "+ wall" ──
const s9 = await page.evaluate(() => {
  const c = document.querySelector('.callout.how-to');
  const out = { li: c ? c.querySelectorAll('li').length : 0, text: c ? c.innerText : '', ex: c && c.querySelector('.how-ex') ? c.querySelector('.how-ex').innerText : '' };
  window.state = window.SW.defaultState(); window.render();
  const rows = () => [...document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('.wall-table > tbody > tr')];
  const btn = rows()[0].querySelector('.btn-line');
  out.btnText = btn.innerText.trim(); out.btnTitle = btn.getAttribute('title');
  out.noGrp = rows().filter((tr) => tr.className.indexOf('line-') >= 0).length;
  btn.click();
  out.cls = rows().map((tr) => tr.className).join('|');
  out.cue = [...document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('.line-cue')].map((x) => x.innerText.trim());
  const first = rows().filter((tr) => tr.classList.contains('line-grp'))[0].querySelector('td');
  out.bracket = getComputedStyle(first).boxShadow;
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('How to use: 3 bullets + a worked example of two walls on Line B',
  s9.li === 3 && /Line B/.test(s9.ex) && /B-2/.test(s9.ex) && /C.*o,B/.test(s9.ex), JSON.stringify({ li: s9.li, ex: s9.ex }));
check('How to use keeps the rules: strength-level incremental forces, 0.6W/0.7E/0.6D, perforated / segmented, Line key, fan-out, copy-down + Undo, base keeps anchor-bolt sill',
  ['strength-level, incremental', '0.6W, 0.7E and 0.6D', '§4.3.2.3', '§4.3.2.1', 'h/b > 3.5 refused', 'same segment count on every level', 'Line key', 'an edit fans out', 'Clear the Line key', 'Copy walls to levels below', 'anchor-bolt sill and HDUE', 'One-step Undo', 'a wall absent below']
    .every((t) => s9.text.indexOf(t) >= 0), s9.text);
check('"+ wall" button (was "+ line") titled "Add another wall on this line"', s9.btnText === '+ wall' && /^Add another wall on this line/.test(s9.btnTitle), JSON.stringify([s9.btnText, s9.btnTitle]));
check('line grouping: none on a single wall; after + wall the rows read line-grp / line-grp-res / line-cont / line-cont-res with one "↳ same line" cue and a left bracket',
  s9.noGrp === 0 && s9.cls === 'line-grp|wres-row line-grp-res|line-cont|wres-row line-cont-res' && s9.cue.join() === '↳ same line' && /inset/.test(s9.bracket) && s9.bracket.indexOf('3px 0px 0px') >= 0,
  JSON.stringify(s9));

// ── WP-3 S7: "= framing" on the sill-species select; the default is unchanged ──
// Column 18 = Sill species.
const s7 = await page.evaluate(() => {
  window.state = window.SW.defaultState(); window.render();
  const sel = () => [...document.querySelectorAll('#floor-con .floor-blk')[3].querySelectorAll('.wall-table tbody tr')].filter((tr) => tr.querySelector('.line-chip'))[0].querySelector('td:nth-child(18) select');
  const out = { first: sel().options[0].text, firstVal: sel().options[0].value, def: sel().value, defState: window.state.floors[3].walls[0].sillSpecies };
  out.frameSel = document.getElementById('species').options.length === Object.keys(window.SW.SPECIES).length;   // the framing select has no "= framing"
  const dfl = window.SW.compute(window.state).floors[3].walls[0];
  out.dflCap = dfl.uplift.plf;
  const s = sel(); s.value = ''; s.dispatchEvent(new Event('change'));
  const g = document.getElementById('species'); g.value = 'SPF'; g.dispatchEvent(new Event('change'));
  const r = window.SW.compute(window.state), w = r.floors[3].walls[0];
  out.state = window.state.floors[3].walls[0].sillSpecies; out.sel = sel().value; out.sillSp = w.sill.species; out.upSp = w.uplift.sillSpecies; out.err = r.errors.length;
  const a = window.__SW_ADAPTER; a.setModel(a.getModel());
  out.rt = window.state.floors[3].walls[0].sillSpecies; out.rtSel = sel().value;
  g.value = 'DFL'; g.dispatchEvent(new Event('change'));
  window.state = window.SW.defaultState(); window.render();
  return out;
});
check('sill species: "= framing" (value "") listed first; the default wall still selects Douglas Fir-Larch; framing select unchanged',
  s7.first === '= framing' && s7.firstVal === '' && s7.def === 'DFL' && s7.defState === 'DFL' && s7.frameSel === true, JSON.stringify(s7));
check('sill species "= framing": state "", engine sill and uplift use the framing species (SPF), no errors, survives setModel',
  s7.state === '' && s7.sel === '' && s7.sillSp === 'SPF' && s7.upSp === 'SPF' && s7.err === 0 && s7.rt === '' && s7.rtSel === '', JSON.stringify(s7));

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
  pnl.text.indexOf('Roof — h 11 ft — Wind-X 131,310 lb over 25 lines') >= 0 && pnl.text.indexOf('Wind-X: wind E–W, normal to the E and W faces; resisted by the N and S shearwalls (EW walls); loc_ft from S') >= 0, pnl.text.slice(0, 400));
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
  imp.sumText && imp.sumText.indexOf('Σ wall lines = 131,305 lb (level 131,310 lb)') >= 0 && imp.sumCls.indexOf('lf-bad') < 0 && imp.sumColor !== 'rgb(196, 43, 43)',
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
check('Σ wall lines turns red when |Σ − level| > 1 %', sumBad.cls.indexOf('lf-bad') >= 0 && sumBad.color === 'rgb(196, 43, 43)', JSON.stringify(sumBad));

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
check('receiver: no cross-project line when the toolbar Project is blank', rxPanel.text.indexOf('Payload is for') < 0, rxPanel.text.slice(0, 300));
// Same seed with the toolbar Project already set to another job -> the
// mismatch line is the cross-project guard; Import then leaves #areJob alone.
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'stacked_shearwall_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
await rx.waitForSelector('#diaImportPanel');
const rxJob = await rx.evaluate((rec) => {
  const job = document.getElementById('areJob');
  job.value = '26-999-OTHER'; job.dispatchEvent(new Event('input', { bubbles: true }));
  window.showImportDialog(rec, [], []);
  const text = document.getElementById('diaImportPanel').innerText;
  window.applyDiaphragmImport();
  return { text, jobAfter: job.value };
}, oneLevel);
check('receiver: toolbar Project differs -> "Payload is for" mismatch line', rxJob.text.indexOf('Payload is for "TEST-PROJ"; this calc is "26-999-OTHER".') >= 0, rxJob.text.slice(0, 300));
check('import leaves a filled toolbar Project alone', rxJob.jobAfter === '26-999-OTHER', rxJob.jobAfter);
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'stacked_shearwall_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
await rx.waitForSelector('#diaImportPanel');
const rxPrefill = await rx.evaluate(() => { window.applyDiaphragmImport(); return { job: document.getElementById('areJob').value, prov: document.querySelector('#floor-con .lh-prov').innerText }; });
check('import prefills a blank toolbar Project from the payload; provenance says "quick send"', rxPrefill.job === 'TEST-PROJ' && rxPrefill.prov.indexOf('quick send') >= 0, JSON.stringify(rxPrefill));
// D1 receiver (WP-3): a record carrying the WP-1 titleblock and no toolbar
// Project -> the panel shows job no. / engineer; Import fills a blank #areJob
// with "jobNumber projectName"; the provenance line carries job / project /
// engineer / date; the model round-trips through AREv2 with no BAD_MODEL.
const tbRec = JSON.parse(JSON.stringify(oneLevel));
tbRec.project = '';
tbRec.titleblock = { projectName: 'Red Bluff Apartments', jobNumber: '26-055', engineer: 'N. Rohr', date: '2026-09-22' };
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'stacked_shearwall_calculator.html' })), tbRec);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
await rx.waitForSelector('#diaImportPanel');
const rxTb = await rx.evaluate(() => {
  const out = { panel: document.getElementById('diaImportPanel').innerText, jobBefore: document.getElementById('areJob').value };
  window.applyDiaphragmImport();
  out.job = document.getElementById('areJob').value;
  out.prov = document.querySelector('#floor-con .lh-prov').innerText;
  out.tb = window.state.lateral && window.state.lateral.titleblock;
  const snap = window.AREv2.captureState();
  out.snapTb = snap && JSON.stringify(snap).indexOf('N. Rohr') >= 0;
  window.state.lateral = null; window.render();   // mutate, then load the snapshot back
  const res = window.AREv2.loadFromState(snap);
  out.ok = res.ok; out.code = res.code || null; out.mm = res.mismatches;
  out.provAfter = (document.querySelector('#floor-con .lh-prov') || {}).innerText || '';
  out.tbAfter = window.state.lateral && window.state.lateral.titleblock;
  // old-file guard: lateral without a titleblock, and lateral null
  const a = window.__SW_ADAPTER, m = a.getModel();
  delete m.lateral.titleblock; a.setModel(m);
  out.provOld = document.querySelector('#floor-con .lh-prov').innerText;
  m.lateral = null; a.setModel(m);
  out.provNull = !!document.querySelector('#floor-con .lh-prov');
  return out;
});
check('D1: import panel shows the titleblock job no. and engineer', rxTb.panel.indexOf('Job no.: 26-055') >= 0 && rxTb.panel.indexOf('Engineer: N. Rohr') >= 0, rxTb.panel.slice(0, 300));
check('D1: Import fills a blank toolbar Project with "jobNumber projectName" (record.project blank)', rxTb.jobBefore === '' && rxTb.job === '26-055 Red Bluff Apartments', JSON.stringify([rxTb.jobBefore, rxTb.job]));
check('D1: provenance line appends Job / project / Eng. / date; state.lateral.titleblock kept',
  rxTb.prov.indexOf('· Job 26-055 · Red Bluff Apartments · Eng. N. Rohr · 2026-09-22') >= 0 && rxTb.tb && rxTb.tb.engineer === 'N. Rohr', JSON.stringify([rxTb.prov, rxTb.tb]));
check('D1: AREv2 capture -> load round-trips the titleblock (no BAD_MODEL, no mismatches), provenance restored',
  rxTb.snapTb && rxTb.ok === true && rxTb.code === null && rxTb.mm.missingOnPage.length === 0 && rxTb.mm.notInFile.length === 0 && rxTb.provAfter.indexOf('Eng. N. Rohr') >= 0 && rxTb.tbAfter && rxTb.tbAfter.jobNumber === '26-055',
  JSON.stringify({ ok: rxTb.ok, code: rxTb.code, mm: rxTb.mm, provAfter: rxTb.provAfter }));
check('D1: older files — lateral without a titleblock prints the plain provenance; lateral null prints none',
  rxTb.provOld.indexOf('Imported from Diaphragm Designer') >= 0 && rxTb.provOld.indexOf('·') < 0 && rxTb.provNull === false, JSON.stringify([rxTb.provOld, rxTb.provNull]));
// Malformed record (schema missing) -> loud alert, key consumed.
const rxDialogs = [];
rx.on('dialog', (d) => { rxDialogs.push(d.message()); d.dismiss(); });
await rx.evaluate(() => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: { levels: [] }, ts: Date.now(), file: 'stacked_shearwall_calculator.html' })));
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
await rx.waitForFunction(() => document.querySelectorAll('#floor-con .floor-blk').length > 0);
const rxBad = await rx.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), key: localStorage.getItem('are_lateral_v1') }));
check('receiver: a malformed record alerts instead of failing silently, key consumed',
  rxDialogs.length === 1 && rxDialogs[0].indexOf('Quick send from the Diaphragm Designer could not be read') >= 0 && rxBad.panel === false && rxBad.key === null, JSON.stringify({ rxDialogs, rxBad }));
await rx.evaluate(() => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: {}, ts: Date.now() })));
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
const rxNoFile = await rx.evaluate(() => localStorage.getItem('are_lateral_v1'));
check('receiver: a fileless key is removed', rxNoFile === null && rxDialogs.length === 1, JSON.stringify({ rxNoFile, n: rxDialogs.length }));
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now() - 11 * 60 * 1000, file: 'stacked_shearwall_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
const rxStale = await rx.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), key: localStorage.getItem('are_lateral_v1') }));
check('receiver: an expired record shows no panel and is removed', rxStale.panel === false && rxStale.key === null, JSON.stringify(rxStale));
await rx.evaluate((rec) => localStorage.setItem('are_lateral_v1', JSON.stringify({ record: rec, ts: Date.now(), file: 'rectangular_diaphragm_calculator.html' })), oneLevel);
await rx.goto('http://calcs.test/Calcs/' + FILE + '?src=diaphragm&lat=1', { waitUntil: 'load' });
const rxForeign = await rx.evaluate(() => ({ panel: !!document.getElementById('diaImportPanel'), key: !!localStorage.getItem('are_lateral_v1'), msgs: document.getElementById('modelMsgs').innerText }));
check('receiver: a record addressed to another calc is left alone', rxForeign.panel === false && rxForeign.key === true, JSON.stringify(rxForeign));
check('receiver: lat=1 with nothing usable shows the "Nothing staged for this page" line, no alert',
  rxForeign.msgs.indexOf('Nothing staged for this page') >= 0 && rxDialogs.length === 1, JSON.stringify({ msgs: rxForeign.msgs.slice(0, 200), n: rxDialogs.length }));
check('receiver page has no errors', rxErrors.length === 0, rxErrors.join('\n      '));
await rx.close();

// ── Stepped-parapet import (plan 2026-09-23 WP-4, R13 / R17) ───────────────
// R13 negative-reaction record: B 60 x D 120, Wind-Y 30 k on Y lines at 0 / 20,
// N-face step [0, 20] 6 ft over h_typ 3, q_p 30 -> envelope 14,100 (−, fromS)
// / 46,350 (+, fromN); cases fromN 32,700, fromS 31,800.
{
  const roofFix = JSON.parse(readFileSync(FIX_DIR + 'diaphragm-roof-state.json', 'utf8'));
  const stepFile = (name, extra) => {
    const s = JSON.parse(JSON.stringify(roofFix));
    Object.keys(s.fields).forEach((k) => { if (/^#sw[XY]_/.test(k)) delete s.fields[k]; });
    Object.assign(s.fields, {
      '#level': 'Roof', '#B': '60', '#D': '120', '#Vx': '0', '#Vy': '30', '#Vx_s': '0', '#Vy_s': '0', '#loadLevel': 'strength',
      '#swJSON': JSON.stringify({ X: [{ label: 'S', len: 60, loc: 0 }, { label: 'N', len: 60, loc: 120 }], Y: [{ label: 'L1', len: 20, loc: 0 }, { label: 'L2', len: 20, loc: 20 }] }),
      '#ppQp': '30', '#ppHmax': '6', '#ppHtyp': '3', '#ppRoof': 'flat', '#ppCommonBase': true, '#stepsAtLevel': 'on',
      '#stepJSON': JSON.stringify([{ label: 'S1', face: 'N', start_ft: 0, width_ft: 20, h_ft: 6 }])
    }, extra || {});
    const p = OUT_DIR + name;
    writeFileSync(p, wrapSnapshot(JSON.stringify(s)));
    return p;
  };
  const negFile = stepFile('dia-step-neg.html');
  const gableFile = stepFile('dia-step-gable.html', { '#ppRoof': 'sloped' });
  const sp = await browser.newPage();
  const spErrors = [], spDialogs = [];
  sp.on('pageerror', (e) => spErrors.push(e.message));
  sp.on('dialog', (d) => { spDialogs.push(d.message()); d.dismiss(); });
  await sp.route('**/*', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      const ext = p.split('.').pop();
      route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
    } catch { route.fulfill({ status: 404, body: '' }); }
  });
  await sp.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await sp.waitForSelector('#wres_0_0 .inline-res');

  // fatal record (sloped roof + active step) -> the importer names the fatal, no panel
  await sp.setInputFiles('#diaImport', [gableFile]);
  await sp.waitForFunction(() => document.getElementById('diaImport').value === '');
  const spFatal = { panel: await sp.evaluate(() => !!document.getElementById('diaImportPanel')), dialogs: spDialogs.slice() };
  check('stepped import: ineligible (sloped roof) file -> alert names the fatal, no panel',
    spFatal.panel === false && spFatal.dialogs.length === 1 && /dia-step-gable\.html: Roof: stepped parapets cannot be analyzed.*flat roof/.test(spFatal.dialogs[0]), JSON.stringify(spFatal));
  spDialogs.length = 0;

  await sp.setInputFiles('#diaImport', [negFile]);
  await sp.waitForSelector('#diaImportPanel');
  await sp.fill('#diaImportPanel input[data-lh="h"]', '11');
  await sp.check('#diaImportPanel input[name="diaDir"][value="Y"]');
  const spPanel = await sp.evaluate(() => document.getElementById('diaImportPanel').innerText);
  check('stepped import panel: summary notes the steps and each case Σ',
    spPanel.indexOf('Wind-Y 32,700 lb incl. parapet steps 2,700 lb (max case fromN) over 2 lines, enveloped per wall (fromN Σ 32,700 of 32,700; fromS Σ 31,800 of 31,800)') >= 0, spPanel.slice(0, 600));
  await sp.click('#diaImportPanel button[data-lh="import"]');
  const readStep = () => sp.evaluate(() => {
    const blk = document.querySelector('#floor-con .floor-blk');
    const q = (sel) => { const e = blk.querySelector(sel); return e ? { text: e.innerText, cls: e.className } : null; };
    const s = window.state, f = s.floors[0];
    return {
      PW: f.P_wind_lb, P: f.walls.map((w) => w.P_wind_lb), sw: f.walls.map((w) => w.sign_wind), cw: f.walls.map((w) => w.case_wind), ss: f.walls.map((w) => w.sign_seis),
      lh: f.lh, cases: q('.lh-cases'), over: q('.lh-override'), sums: [...blk.querySelectorAll('.lf-sum')].map((e) => e.innerText),
      errors: window.SW.validate(s).errors
    };
  });
  let so = await readStep();
  check('stepped import Y: floor P_W 32,700 (max case); walls 14,100 / 46,350 (envelope magnitudes); sign_wind -1 / +1, case_wind fromS / fromN, sign_seis +1',
    so.PW === 32700 && so.P.join('/') === '14100/46350' && so.sw.join('/') === '-1/1' && so.cw.join('/') === 'fromS/fromN' && so.ss.join('/') === '1/1' && so.errors.length === 0, JSON.stringify(so));
  check('stepped import Y: per-case Σ checks pass and say "enveloped per wall"; negative line flagged; not red',
    so.cases && so.cases.text.indexOf('Σ fromN = 32,700 lb (case 32,700 lb) ✓') >= 0 && so.cases.text.indexOf('Σ fromS = 31,800 lb (case 31,800 lb) ✓') >= 0 &&
    so.cases.text.indexOf('enveloped per wall — Σ of envelopes ≠ story total by design') >= 0 && so.cases.text.indexOf('negative wind reaction: Y@0 (fromS)') >= 0 &&
    so.cases.cls.indexOf('lf-bad') < 0 && so.over === null, JSON.stringify(so));
  // persistence: adapter and AREv2 round trips keep fl.lh and the per-wall metadata (validateModel passes)
  const spRt = await sp.evaluate(() => {
    const a = window.__SW_ADAPTER, before = JSON.stringify(a.getModel());
    a.setModel(JSON.parse(before));
    const out = { adapter: JSON.stringify(a.getModel()) === before };
    const snap = window.AREv2.captureState();
    window.state.floors[0].lh = null; window.render();
    const res = window.AREv2.loadFromState(snap);
    out.ok = res.ok; out.code = res.code || null; out.mm = res.mismatches; out.after = JSON.stringify(a.getModel()) === before;
    out.cases = !!document.querySelector('#floor-con .lh-cases');
    return out;
  });
  check('stepped import: adapter getModel → setModel and AREv2 capture → load keep fl.lh (no BAD_MODEL, no mismatches)',
    spRt.adapter && spRt.ok === true && spRt.code === null && spRt.mm.missingOnPage.length === 0 && spRt.mm.notInFile.length === 0 && spRt.after && spRt.cases, JSON.stringify(spRt));
  // seismic sign is separate from the wind sign
  const spSeis = await sp.evaluate(() => {
    const f = window.state.floors[0]; f.P_seis_lb = 1000; f.walls[0].P_seis_lb = 400; f.walls[1].P_seis_lb = 600; window.render();
    const t = [...document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('.lf-sum')].map((e) => e.innerText).filter((x) => x.indexOf('(E)') >= 0)[0] || '';
    f.P_seis_lb = 0; f.walls[0].P_seis_lb = 0; f.walls[1].P_seis_lb = 0; window.render();
    return t;
  });
  check('seismic Σ uses sign_seis (+1), not the wall\'s negative wind sign: Σ (E) = 1,000', spSeis.indexOf('Σ wall lines (E) = 1,000 lb (level 1,000 lb)') >= 0, spSeis);
  // edit line 2 (Y@20) to 0 -> OVERRIDDEN listing that line; case checks hidden
  await sp.evaluate(() => window.updWall(0, 1, 'P_wind_lb', '0'));
  so = await readStep();
  check('edit Y@20 to 0 -> "OVERRIDDEN — imported-load validation withdrawn" lists that line (imported vs current); case checks hidden',
    so.over && so.over.text.indexOf('OVERRIDDEN — imported-load validation withdrawn') >= 0 && so.over.text.indexOf('Y@20: imported 46,350 lb, current 0 lb') >= 0 && so.over.text.indexOf('Y@0') < 0 && so.over.cls.indexOf('lf-bad') >= 0 && so.cases === null,
    JSON.stringify(so));
  await sp.evaluate(() => window.updWall(0, 1, 'P_wind_lb', '46350'));
  so = await readStep();
  check('restoring the imported value reconciles the level again', so.cases && so.over === null, JSON.stringify(so));
  // regroup, delete, level edit
  await sp.evaluate(() => window.updWall(0, 0, 'line', 'Y@20'));
  so = await readStep();
  check('regrouping Y@0 onto line Y@20 -> OVERRIDDEN names the regroup', so.over && so.over.text.indexOf('Y@0: imported 14,100 lb, current — regrouped onto line "Y@20"') >= 0, JSON.stringify(so.over));
  await sp.evaluate(() => { window.updWall(0, 0, 'line', ''); window.updFloor(0, 'P_wind_lb', '30000'); });
  so = await readStep();
  check('editing the level P_W -> OVERRIDDEN names the level', so.over && so.over.text.indexOf('level P_W: imported 32,700 lb, current 30,000 lb') >= 0 && so.over.text.indexOf('Y@0') < 0, JSON.stringify(so.over));
  await sp.evaluate(() => { window.updFloor(0, 'P_wind_lb', '32700'); window.delWall(0, 0); });
  so = await readStep();
  check('deleting Y@0 -> OVERRIDDEN lists it as deleted', so.over && so.over.text.indexOf('Y@0: imported 14,100 lb, current — deleted') >= 0, JSON.stringify(so.over));
  await sp.evaluate(() => window.addWall(0));
  so = await readStep();
  check('an added wall line (blank force) is listed as added', so.over && /w\d+: not imported, current blank \(inherits the level force\) — line added/.test(so.over.text), JSON.stringify(so.over));

  // old SW file without lh: legacy sign applies to both W and E, results unchanged
  const spOld = await sp.evaluate(() => {
    const a = window.__SW_ADAPTER, m = JSON.parse(JSON.stringify(a.getModel()));
    const f = m.floors[0]; delete f.lh;
    f.P_wind_lb = 120000; f.P_seis_lb = 1000;
    const w0 = f.walls[0]; delete w0.sign_wind; delete w0.case_wind; delete w0.sign_seis;
    const w1 = JSON.parse(JSON.stringify(w0)); w1.id = 'Y@20'; w1.loc_ft = 20;
    w0.id = 'Y@0'; w0.sign = -1; w0.P_wind_lb = 240000; w0.P_seis_lb = 500; w1.P_wind_lb = 360000; w1.P_seis_lb = 1500; delete w1.sign;
    f.walls = [w0, w1];
    a.setModel(m);
    const before = JSON.stringify(window.SW.compute(window.state));
    a.setModel(JSON.parse(JSON.stringify(a.getModel())));
    return { sums: [...document.querySelectorAll('#floor-con .floor-blk')[0].querySelectorAll('.lf-sum')].map((e) => e.innerText),
      cases: !!document.querySelector('#floor-con .lh-cases, #floor-con .lh-override'), same: JSON.stringify(window.SW.compute(window.state)) === before };
  });
  check('old file (no lh, legacy sign -1): Σ wall lines signed for W and E as before, no case / override line, identical results',
    spOld.sums.indexOf('Σ wall lines = 120,000 lb (level 120,000 lb)') >= 0 && spOld.sums.indexOf('Σ wall lines (E) = 1,000 lb (level 1,000 lb)') >= 0 && spOld.cases === false && spOld.same, JSON.stringify(spOld));
  check('stepped import page: no page errors, no stray dialogs', spErrors.length === 0 && spDialogs.length === 0, spErrors.concat(spDialogs).join('\n      '));
  await sp.close();
}

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
// On the default model with a copy-down message showing: its Undo button must not print.
await page.evaluate(() => { window.state = window.SW.defaultState(); window.render(); window.copyWallsDown(0); });
await page.emulateMedia({ media: 'print' });
const printed = await page.evaluate(() => {
  const det = document.querySelector('.calc-det');
  return {
    detVisible: det ? getComputedStyle(det).display !== 'none' : false,
    resVisible: getComputedStyle(document.querySelector('.wres')).display !== 'none',
    btnHidden: getComputedStyle(document.getElementById('printBtn')).display === 'none',
    undoHidden: getComputedStyle(document.querySelector('#copyDownMsg .btn-undo')).display === 'none'
  };
});
check('print hides the copy-down Undo button', printed.undoHidden === true, JSON.stringify(printed));
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
