// =============================================================================
// Wood Connection Schedule — UI smoke (scratch, underscore prefix)
// -----------------------------------------------------------------------------
// Loads public/Calcs/wood_connection_schedule_calculator.html in headless
// Chromium with every request fulfilled from public/ on disk (no server), then
// checks: no page errors, the toolbar, three schedule tables with the seeded
// example rows, add / duplicate / delete / undo / move, typing keeps focus and
// caret, the AREv2 adapter round-trips and refuses version 2, header edits reach
// the engine, and the details rows are visible under print media.
// Usage: node tools/_wc-ui-smoke.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('./_out/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'wood_connection_schedule_calculator.html';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const notFound = [];
page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });
page.on('dialog', (d) => d.dismiss());
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.waitForSelector('#schedule section[data-table]');

// upd() defers its full re-render to a macrotask so Tab can land first; yield one macrotask after scripted edits
const tick = () => page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
async function ev(fn, arg) { const r = await page.evaluate(fn, arg); await tick(); return r; }
const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

const hasEngine = await page.evaluate(() => !!(window.WC && typeof WC.compute === 'function'));
check('engine window.WC present', hasEngine, 'engines/wood-connections.js missing or did not expose WC');

// ── structure ────────────────────────────────────────────────────────────────
const s0 = await page.evaluate(() => ({
  sections: [...document.querySelectorAll('#schedule section[data-table]')].map((s) => s.getAttribute('data-table')),
  tbodies: document.querySelectorAll('#schedule tbody[data-row-id]').length,
  rowsPerTable: [...document.querySelectorAll('#schedule section[data-table]')].map((s) => s.querySelectorAll('tbody[data-row-id]').length),
  triplet: [...document.querySelectorAll('#schedule tbody[data-row-id]')].every((tb) => tb.querySelector('tr.wc-sum') && tb.querySelector('tr.wc-in') && tb.querySelector('tr.wc-det')),
  detHidden: [...document.querySelectorAll('#schedule tr.wc-det')].every((tr) => tr.hasAttribute('hidden')),
  hdr: ['species', 'E_override', 'custom_name', 'custom_G', 'custom_E', 'custom_Fe_small', 'custom_Fe_par', 'custom_Fe_perp', 'custom_hardwood', 'custom_esr', 'steelGrade', 'mcFab', 'mcService', 'temp'].filter((id) => !document.getElementById(id)),
  customHidden: document.getElementById('customBlk').hasAttribute('hidden') && getComputedStyle(document.getElementById('customBlk')).display === 'none',
  summary: document.querySelector('#summary').innerText,
  engRev: document.getElementById('engRev').textContent,
  stateVersion: window.__WC_STATE && window.__WC_STATE.version,
  statuses: [...document.querySelectorAll('#schedule tbody[data-row-id] .st')].map((e) => e.textContent),
  adapterHook: !!window.__WC_ADAPTER,
  areAdapter: !!(window.AREv2 && AREv2.getAdapter && AREv2.getAdapter() === window.__WC_ADAPTER),
  errBox: document.querySelectorAll('#modelMsgs .err-box').length
}));
check('three sections bolts/nails/screws', s0.sections.join(',') === 'bolts,nails,screws', s0.sections.join(','));
check('one seeded row per table', s0.rowsPerTable.join(',') === '1,1,1', s0.rowsPerTable.join(','));
check('each connection is a tbody with wc-sum / wc-in / wc-det rows', s0.triplet && s0.tbodies === 3, JSON.stringify(s0));
check('details rows hidden on screen by default', s0.detHidden, '');
check('header Tier-A ids present', s0.hdr.length === 0, 'missing ' + s0.hdr.join(','));
check('custom block hidden for a stock species', s0.customHidden, '');
check('adapter registered with AREv2 and exposed as __WC_ADAPTER', s0.adapterHook && s0.areAdapter, JSON.stringify(s0));
check('no engine error box', s0.errBox === 0, s0.summary);
if (hasEngine) {
  check('engine rev printed in the header', /engine \S/.test(s0.engRev), s0.engRev);
  const rev = await page.evaluate(() => window.WC.ENGINE.rev);
  check('summary block names the engine rev and the worst D/C column', s0.summary.indexOf(rev) >= 0 && /worst d\/c/i.test(s0.summary), s0.summary.slice(0, 300));
  check('seeded rows resolve to a status (no "no result")', s0.statuses.length === 3 && s0.statuses.every((s) => /^(PASS|FAIL|NODEMAND|INCOMPLETE|INVALID)$/.test(s)), s0.statuses.join(','));
  console.log('      seeded statuses: ' + s0.statuses.join(', '));
}

// ── active-when rendering ────────────────────────────────────────────────────
const aw = await page.evaluate(() => {
  const st = window.__WC_STATE;
  const bolt = st.bolts[0], nail = st.nails[0], lag = st.screws[0];
  const q = (id, p) => !!document.getElementById('wc_' + id + '_' + p.replace(/\./g, '_'));
  return {
    boltT: q(bolt.id, 'T'), boltN: q(bolt.id, 'n'), boltS: q(bolt.id, 's'), boltEnd: q(bolt.id, 'main.endDist'), boltW: q(bolt.id, 'main.w'), boltShear: q(bolt.id, 'shear'), boltMainSteel: q(bolt.id, 'mainSteel'), boltToe: q(bolt.id, 'toeNail'), boltLoaded: q(bolt.id, 'main.loadedEdgeDist'),
    nailT: q(nail.id, 'T'), nailN: q(nail.id, 'n'), nailW: q(nail.id, 'main.w'), nailToe: q(nail.id, 'toeNail'), nailDia: q(nail.id, 'diaphragm'), nailEnd: q(nail.id, 'main.endDist'), nailPenny: q(nail.id, 'penny'), nailNA: !!document.querySelector('#schedule tbody[data-row-id="' + nail.id + '"] .wc-f.na'),
    lagT: q(lag.id, 'T'), lagN: q(lag.id, 'n'), lagD: q(lag.id, 'D'), lagL: q(lag.id, 'L'), lagEnd: q(lag.id, 'side.endDist'), lagS: q(lag.id, 's'),
    lagGeom: { s: lag.s, g: lag.g, end: lag.main.endDist, edge: lag.main.edgeDist, le: lag.main.loadedEdgeDist },
    boltGeom: { D: bolt.D, s: bolt.s, g: bolt.g, end: bolt.main.endDist, edge: bolt.main.edgeDist }
  };
});
check('bolt row: no T, has n/s/endDist/w/shear/mainSteel, no toe-nail, no loaded edge at θ=0',
  !aw.boltT && aw.boltN && aw.boltS && aw.boltEnd && aw.boltW && aw.boltShear && aw.boltMainSteel && !aw.boltToe && !aw.boltLoaded, JSON.stringify(aw));
check('nail row (v1.2): has T/toe-nail/diaphragm/penny, n and endDist (pattern + advisory spacing), no w (C_g only), shows an n/a chip',
  aw.nailT && aw.nailToe && aw.nailDia && aw.nailPenny && aw.nailN && !aw.nailW && aw.nailEnd && aw.nailNA, JSON.stringify(aw));
check('lag row: has T, n, D, L, s, side endDist', aw.lagT && aw.lagN && aw.lagD && aw.lagL && aw.lagS && aw.lagEnd, JSON.stringify(aw));
check('seeded 1/2 in bolt geometry defaults 4D/1.5D/7D/1.5D', aw.boltGeom.D === 0.5 && aw.boltGeom.s === 2 && aw.boltGeom.g === 0.75 && aw.boltGeom.end === 3.5 && aw.boltGeom.edge === 0.75, JSON.stringify(aw.boltGeom));
check('seeded 1/2 x 4 lag geometry defaults', aw.lagGeom.s === 2 && aw.lagGeom.g === 0.75 && aw.lagGeom.end === 3.5 && aw.lagGeom.edge === 0.75 && aw.lagGeom.le === 2, JSON.stringify(aw.lagGeom));

// ── typing keeps focus + caret; live cells update ────────────────────────────
const nailId = await page.evaluate(() => window.__WC_STATE.nails[0].id);
await page.click('#wc_' + nailId + '_V');
await page.keyboard.press('Control+A');
await page.keyboard.type('123.5', { delay: 20 });
const typ = await page.evaluate((id) => ({
  active: document.activeElement && document.activeElement.id,
  value: document.getElementById('wc_' + id + '_V').value,
  stateV: window.__WC_STATE.nails[0].V
}), nailId);
check('typing V keeps focus, the DOM value and updates state live', typ.active === 'wc_' + nailId + '_V' && typ.value === '123.5' && typ.stateV === 123.5, JSON.stringify(typ));
await page.keyboard.press('Tab');
await tick();
const tab = await page.evaluate((id) => ({ active: document.activeElement && document.activeElement.id, stateV: window.__WC_STATE.nails[0].V, dom: !!document.getElementById('wc_' + id + '_V') }), nailId);
check('Tab after a change commits, re-renders and lands on the next input', tab.active === 'wc_' + nailId + '_T' && tab.stateV === 123.5 && tab.dom, JSON.stringify(tab));
// caret restore on a text field
await page.click('#wc_' + nailId + '_desc');
await page.keyboard.press('End');
await page.keyboard.type(' ledger', { delay: 15 });
const car = await page.evaluate((id) => { const el = document.getElementById('wc_' + id + '_desc'); return { active: document.activeElement.id, caretAtEnd: el.selectionStart === el.value.length, desc: window.__WC_STATE.nails[0].desc }; }, nailId);
check('typing in description keeps focus with the caret at the end', car.active === 'wc_' + nailId + '_desc' && car.caretAtEnd && /ledger$/.test(car.desc), JSON.stringify(car));
// a select change in the sub-row re-renders and keeps focus on that select
await page.focus('#wc_' + nailId + '_main_theta');
await page.fill('#wc_' + nailId + '_main_theta', '90');
await page.keyboard.press('Enter');
await tick();
const sel = await page.evaluate((id) => ({ active: document.activeElement.id, theta: window.__WC_STATE.nails[0].main.theta }), nailId);
check('θ typed + Enter writes a number to state and keeps focus after the rebuild', sel.theta === 90 && sel.active === 'wc_' + nailId + '_main_theta', JSON.stringify(sel));
// desc sanitising
await ev((id) => updS(id, 'desc', 'a <b> ' + 'x'.repeat(200)), nailId);
const san = await page.evaluate(() => window.__WC_STATE.nails[0].desc);
check('desc strips <> and caps at 120 chars', san.indexOf('<') < 0 && san.length === 120, san.length + ' ' + san.slice(0, 10));

// ── row operations ───────────────────────────────────────────────────────────
await page.click('#schedule section[data-table="bolts"] .btn-add');
let ops = await page.evaluate(() => ({ n: window.__WC_STATE.bolts.length, ids: window.__WC_STATE.bolts.map((r) => r.id), cnt: window.__WC_STATE.rowCnt, dom: document.querySelectorAll('#schedule section[data-table="bolts"] tbody[data-row-id]').length, focus: document.activeElement.id }));
check('add bolt: 2 rows, new id = rowCnt, focus on the new description', ops.n === 2 && ops.dom === 2 && ops.ids[1] === ops.cnt && ops.focus === 'wc_' + ops.cnt + '_desc', JSON.stringify(ops));
const b0 = ops.ids[0], b1 = ops.ids[1];
await page.evaluate((id) => dupRow(id), b0);
ops = await page.evaluate(() => ({ ids: window.__WC_STATE.bolts.map((r) => r.id), cnt: window.__WC_STATE.rowCnt, desc: window.__WC_STATE.bolts.map((r) => r.desc) }));
check('duplicate inserts after the source with a fresh id', ops.ids.length === 3 && ops.ids[1] === ops.cnt && ops.ids[0] === b0 && ops.ids[2] === b1 && ops.desc[0] === ops.desc[1], JSON.stringify(ops));
const dupId = ops.ids[1];
await page.evaluate((id) => moveRow(id, 1), dupId);
ops = await page.evaluate(() => ({ ids: window.__WC_STATE.bolts.map((r) => r.id), dom: [...document.querySelectorAll('#schedule section[data-table="bolts"] tbody[data-row-id]')].map((tb) => +tb.getAttribute('data-row-id')) }));
check('move down reorders state and DOM alike', ops.ids.join(',') === [b0, b1, dupId].join(',') && ops.dom.join(',') === ops.ids.join(','), JSON.stringify(ops));
await page.evaluate((id) => moveRow(id, -1), dupId);
await page.evaluate((id) => moveRow(id, -1), dupId);
ops = await page.evaluate(() => window.__WC_STATE.bolts.map((r) => r.id));
check('move up twice puts it first; a further move up is a no-op', ops.join(',') === [dupId, b0, b1].join(','), ops.join(','));
await page.evaluate((id) => moveRow(id, -1), dupId);
ops = await page.evaluate(() => window.__WC_STATE.bolts.map((r) => r.id));
check('move up at the top is a no-op', ops.join(',') === [dupId, b0, b1].join(','), ops.join(','));
await page.evaluate((id) => delRow(id), dupId);
ops = await page.evaluate(() => ({ ids: window.__WC_STATE.bolts.map((r) => r.id), undo: !!document.querySelector('#schedule section[data-table="bolts"] .btn-undo'), cnt: window.__WC_STATE.rowCnt }));
check('delete removes the row and offers undo', ops.ids.join(',') === [b0, b1].join(',') && ops.undo, JSON.stringify(ops));
await page.click('#schedule section[data-table="bolts"] .btn-undo');
ops = await page.evaluate(() => ({ ids: window.__WC_STATE.bolts.map((r) => r.id), undo: !!document.querySelector('#schedule section[data-table="bolts"] .btn-undo'), cnt: window.__WC_STATE.rowCnt }));
check('undo restores the row at its index; ids are never reused', ops.ids.join(',') === [dupId, b0, b1].join(',') && !ops.undo && ops.cnt === dupId, JSON.stringify(ops));
await page.evaluate((id) => delRow(id), dupId);
await page.evaluate((id) => delRow(id), b1);
ops = await page.evaluate(() => window.__WC_STATE.bolts.map((r) => r.id));
check('back to one bolt', ops.join(',') === String(b0), ops.join(','));

// ── details toggle ───────────────────────────────────────────────────────────
await page.click('#schedule tbody[data-row-id="' + b0 + '"] button.det');
let det = await page.evaluate((id) => { const tr = document.querySelector('#schedule tbody[data-row-id="' + id + '"] tr.wc-det'); return { hidden: tr.hasAttribute('hidden'), text: tr.innerText.length, hasModes: /yield mode/i.test(tr.innerText) && tr.innerText.indexOf('Adjustment factors') >= 0 && tr.innerText.indexOf('Lateral') >= 0 }; }, b0);
check('details toggle reveals the block with the yield modes (Lateral) and the factor chain', !det.hidden && det.hasModes, JSON.stringify(det));
await page.click('#schedule tbody[data-row-id="' + b0 + '"] button.det');
det = await page.evaluate((id) => document.querySelector('#schedule tbody[data-row-id="' + id + '"] tr.wc-det').hasAttribute('hidden'), b0);
check('details toggle hides it again', det === true, '');

// ── coupling rules ───────────────────────────────────────────────────────────
const lagId = await page.evaluate(() => window.__WC_STATE.screws[0].id);
await ev((id) => updSel(id, 'D', '1'), lagId);
let cp = await page.evaluate(() => ({ D: window.__WC_STATE.screws[0].D, L: window.__WC_STATE.screws[0].L, s: window.__WC_STATE.screws[0].s, end: window.__WC_STATE.screws[0].main.endDist }));
check('lag D → 1 in keeps L 4 (available) and moves untouched geometry defaults to the new D (s 4, end 7)', cp.D === 1 && cp.L === 4 && cp.s === 4 && cp.end === 7, JSON.stringify(cp));
await ev((id) => updN(id, 's', '5'), lagId);
await ev((id) => updSel(id, 'D', '0.5'), lagId);
cp = await page.evaluate(() => ({ D: window.__WC_STATE.screws[0].D, s: window.__WC_STATE.screws[0].s, end: window.__WC_STATE.screws[0].main.endDist }));
check('an edited s (5) survives a D change; untouched end distance follows (3.5)', cp.D === 0.5 && cp.s === 5 && cp.end === 3.5, JSON.stringify(cp));
await ev((id) => updSel(id, 'L', '1.5'), lagId);
await ev((id) => updSel(id, 'D', '0.75'), lagId);
cp = await page.evaluate(() => ({ D: window.__WC_STATE.screws[0].D, L: window.__WC_STATE.screws[0].L, opts: [...document.getElementById('wc_' + window.__WC_STATE.screws[0].id + '_L').options].map((o) => o.value) }));
check('lag 3/4 with L 1.5 (not in Table L2) bumps L to the first available length (3) and filters the L options', cp.D === 0.75 && cp.L === 3 && cp.opts.indexOf('1.5') < 0 && cp.opts.indexOf('3') >= 0, JSON.stringify(cp));
await ev((id) => updSel(id, 'screwType', 'wood'), lagId);
cp = await page.evaluate(() => { const r = window.__WC_STATE.screws[0]; return { t: r.screwType, no: r.no, L: r.L, hasN: !!document.getElementById('wc_' + r.id + '_n'), hasNo: !!document.getElementById('wc_' + r.id + '_no') }; });
check('screw → wood: No. present, n still rendered (v1.2: n / rows for every type)', cp.t === 'wood' && cp.no === 10 && cp.hasNo && cp.hasN, JSON.stringify(cp));
await ev((id) => updSel(id, 'screwType', 'lag'), lagId);
cp = await page.evaluate(() => { const r = window.__WC_STATE.screws[0]; return { t: r.screwType, D: r.D, L: r.L, s: r.s, n: r.n, hasN: !!document.getElementById('wc_' + r.id + '_n') }; });
check('screw → lag: D/L restored, geometry reset to defaults for that D, n visible', cp.t === 'lag' && cp.D === 0.75 && cp.s === 3 && cp.n === 1 && cp.hasN, JSON.stringify(cp));
await ev((id) => updB(id, 'mainSteel', true), b0);
cp = await page.evaluate((id) => { const r = window.__WC_STATE.bolts[0]; return { ms: r.mainSteel, side: r.side.mat, gauge: r.main.gauge, sideSel: !!document.getElementById('wc_' + id + '_side_mat'), mainT: !!document.getElementById('wc_' + id + '_main_t'), mainGauge: !!document.getElementById('wc_' + id + '_main_gauge'), mainTheta: !!document.getElementById('wc_' + id + '_main_theta') }; }, b0);
check('bolt steel main forces a wood side (no side material select), shows main gauge + plate t, hides main θ', cp.ms && cp.side === 'wood' && cp.gauge === 'plate' && !cp.sideSel && cp.mainT && cp.mainGauge && !cp.mainTheta, JSON.stringify(cp));
await ev((id) => updB(id, 'mainSteel', false), b0);
await ev((id) => updSel(id, 'side.mat', 'steel'), b0);
cp = await page.evaluate((id) => { const r = window.__WC_STATE.bolts[0]; return { ms: r.mainSteel, side: r.side.mat, gauge: r.side.gauge, gaugeSel: !!document.getElementById('wc_' + id + '_side_gauge'), sideT: !!document.getElementById('wc_' + id + '_side_t'), sideTheta: !!document.getElementById('wc_' + id + '_side_theta') }; }, b0);
check('bolt steel side: gauge select, plate t shown, no side θ', cp.side === 'steel' && cp.gauge === 'plate' && cp.gaugeSel && cp.sideT && !cp.sideTheta && !cp.ms, JSON.stringify(cp));
await ev((id) => updSel(id, 'side.gauge', '12'), b0);
cp = await page.evaluate((id) => ({ gauge: window.__WC_STATE.bolts[0].side.gauge, sideT: !!document.getElementById('wc_' + id + '_side_t') }), b0);
check('gauge 12 stays a string in state and hides the typed t', cp.gauge === '12' && !cp.sideT, JSON.stringify(cp));
await ev((id) => updSel(id, 'side.mat', 'wood'), b0);

// ── header → state → engine ──────────────────────────────────────────────────
await page.selectOption('#species', 'CUSTOM');
let hd = await page.evaluate(() => ({ sp: window.__WC_STATE.header.species, shown: !document.getElementById('customBlk').hasAttribute('hidden') && getComputedStyle(document.getElementById('customBlk')).display !== 'none' }));
check('species CUSTOM shows the custom block and reaches state', hd.sp === 'CUSTOM' && hd.shown, JSON.stringify(hd));
await page.fill('#custom_G', '0.5');
await page.selectOption('#species', 'SPF');
await page.selectOption('#mcService', 'wet');
await page.fill('#E_override', '1500000');
hd = await page.evaluate(() => ({ h: window.__WC_STATE.header, hidden: document.getElementById('customBlk').hasAttribute('hidden') }));
check('header edits land in state.header (SPF, wet, E override 1.5e6, custom G kept)', hd.h.species === 'SPF' && hd.h.mcService === 'wet' && hd.h.E_override === 1500000 && hd.h.custom.G === 0.5 && hd.hidden, JSON.stringify(hd));
if (hasEngine) {
  const cm = await page.evaluate(() => { const r = window.WC.compute(window.__WC_STATE); const n = r.tables.nails[0]; return { CM: n.factors.CM.v, G: r.header.species.G, key: r.header.speciesKey, resolvedLine: document.getElementById('hdrResolved').innerText }; });
  check('resolved line in the header block prints the species G', /G = 0\.42/.test(cm.resolvedLine), cm.resolvedLine);
  check('engine sees the header: wet service C_M 0.7 on the nail, header.species resolved SPF G 0.42, header.speciesKey SPF', Math.abs(cm.CM - 0.7) < 1e-9 && Math.abs(cm.G - 0.42) < 1e-9 && cm.key === 'SPF', JSON.stringify(cm));
}
await page.selectOption('#mcService', 'dry');
await page.fill('#E_override', '');
await page.selectOption('#species', 'DFL');

// ── adapter round trip ───────────────────────────────────────────────────────
const rt = await page.evaluate(() => {
  const a = window.__WC_ADAPTER, out = {};
  const m = a.getModel();
  out.keys = Object.keys(m).sort().join(',');
  out.noHeader = !('header' in m);
  out.detached = (m.bolts !== window.__WC_STATE.bolts);
  const before = JSON.stringify(m);
  a.setModel(JSON.parse(before));
  out.roundTrip = JSON.stringify(a.getModel()) === before;
  out.viaAre = window.AREv2 && AREv2.getAdapter ? JSON.stringify(AREv2.getAdapter().getModel()) === before : null;
  try { a.setModel({ version: 2, bolts: [], nails: [], screws: [], rowCnt: 0 }); out.v2 = 'accepted'; } catch (e) { out.v2 = e.message; }
  try { a.setModel({ version: 1, bolts: 'x', nails: [], screws: [], rowCnt: 0 }); out.badArr = 'accepted'; } catch (e) { out.badArr = e.message; }
  out.stillIntact = JSON.stringify(a.getModel()) === before;
  out.dom = document.querySelectorAll('#schedule tbody[data-row-id]').length;
  // rowCnt is never below the largest id in the loaded file
  const m2 = JSON.parse(before); m2.rowCnt = 0; a.setModel(m2);
  out.rowCntHealed = a.getModel().rowCnt === Math.max(...[...m2.bolts, ...m2.nails, ...m2.screws].map((r) => r.id));
  a.setModel(JSON.parse(before));
  return out;
});
check('getModel: {version,bolts,nails,screws,rowCnt}, deep copy, no header', rt.keys === 'bolts,nails,rowCnt,screws,version' && rt.noHeader && rt.detached, JSON.stringify(rt));
check('getModel → setModel → identical getModel (and via AREv2.getAdapter)', rt.roundTrip && rt.viaAre === true, JSON.stringify(rt));
check('setModel refuses version 2 with a clear error and leaves the model intact', /version|format/i.test(rt.v2) && rt.v2 !== 'accepted' && rt.stillIntact, JSON.stringify(rt));
check('setModel refuses a non-array table', rt.badArr !== 'accepted', rt.badArr);
check('setModel heals rowCnt below the largest id', rt.rowCntHealed, JSON.stringify(rt));

// ── hostile / malformed models are sanitised on load ────────────────────────
const bad = await page.evaluate(() => {
  const a = window.__WC_ADAPTER, keep = JSON.stringify(a.getModel());
  const bolt = JSON.parse(keep).bolts[0], nail = JSON.parse(keep).nails[0], lag = JSON.parse(keep).screws[0];
  const evil = 'x" data-x="pwned" onclick="window.__pwned=1';   // passes the schema pattern (no < >)
  const m = { version: 1, rowCnt: 2,
    bolts: [Object.assign({}, bolt, { id: evil, T: 250 }), null, 'junk', Object.assign({}, bolt, { id: 2, main: null })],
    nails: [Object.assign({}, nail, { id: 2 }), Object.assign({}, nail, { id: 2.5 }), Object.assign({}, nail, {})],
    screws: [Object.assign({}, lag, { id: 'NaN' }), [1, 2]] };
  delete m.nails[2].id;
  delRow(window.__WC_STATE.nails[0].id);              // leave a stale undo behind
  const undoBefore = !!document.querySelector('#schedule .btn-undo');
  a.setModel(m);
  const st = window.__WC_STATE;
  const ids = [...st.bolts, ...st.nails, ...st.screws].map((r) => r.id);
  const out = {
    undoBefore,
    undoAfter: !!document.querySelector('#schedule .btn-undo'),
    counts: [st.bolts.length, st.nails.length, st.screws.length].join(','),
    idsInt: ids.every((i) => Number.isInteger(i) && i > 0),
    idsUnique: new Set(ids).size === ids.length,
    rowCnt: st.rowCnt, maxId: Math.max(...ids),
    boltT: st.bolts.map((r) => r.T).join(','),
    boltMain: typeof st.bolts[1].main === 'object' && st.bolts[1].main !== null,
    pwned: window.__pwned === 1 || document.querySelector('[data-x]') !== null || document.body.innerHTML.indexOf('pwned') >= 0,
    domIds: [...document.querySelectorAll('#schedule tbody[data-row-id]')].map((tb) => tb.getAttribute('data-row-id')).join(','),
    statuses: [...document.querySelectorAll('#schedule tbody[data-row-id] .st')].map((e) => e.textContent).join(','),
    getModelOk: JSON.stringify(a.getModel()).indexOf('pwned') < 0
  };
  a.setModel(JSON.parse(keep));
  return out;
});
check('setModel drops null / string / array rows and keeps the plain objects (2 bolts, 3 nails, 1 screw)', bad.counts === '2,3,1', JSON.stringify(bad));
check('every loaded id is a unique positive integer; string / fractional / duplicate / missing ids are reassigned from ++rowCnt', bad.idsInt && bad.idsUnique && bad.rowCnt === bad.maxId, JSON.stringify(bad));
check('a hostile string id never reaches the DOM (no attribute injection, no handler execution)', !bad.pwned && bad.getModelOk && bad.domIds.split(',').every((x) => /^\d+$/.test(x)), JSON.stringify(bad));
check('bolt rows loaded with T > 0 have T dropped to null (no uneditable invalid); null main is rebuilt', bad.boltT === ',' && bad.boltMain && !/INVALID/.test(bad.statuses), JSON.stringify(bad));
check('a stale undo is cleared by setModel', bad.undoBefore && !bad.undoAfter, JSON.stringify(bad));

// ── row buttons have ids and keep focus through the rebuild ─────────────────
const bid = await page.evaluate(() => window.__WC_STATE.bolts[0].id);
await page.click('#schedule section[data-table="bolts"] .btn-add');
await page.focus('#wc_' + bid + '_mv_dn');
await page.keyboard.press('Enter');
await tick();
const fb = await page.evaluate((id) => ({ active: document.activeElement.id, order: window.__WC_STATE.bolts.map((r) => r.id).join(','), btns: ['det', 'mv_up', 'mv_dn', 'dup', 'del'].every((k) => !!document.getElementById('wc_' + id + '_' + k)), add: !!document.getElementById('wc_add_bolts') }), bid);
check('row buttons carry ids (det/mv_up/mv_dn/dup/del, add) and focus stays on the pressed button after the rebuild', fb.btns && fb.add && fb.active === 'wc_' + bid + '_mv_dn' && fb.order.split(',')[1] === String(bid), JSON.stringify(fb));
await page.evaluate((id) => { moveRow(id, -1); delRow(window.__WC_STATE.bolts[1].id); }, bid);
await tick();

// ── product lists come from WC.DATA, not page copies ─────────────────────────
const dd = await page.evaluate(() => {
  const D = window.WC.DATA, st = window.__WC_STATE, lag = st.screws[0], bolt = st.bolts[0], nail = st.nails[0];
  const opts = (id) => [...document.getElementById(id).options].map((o) => o.value);
  return {
    boltD: opts('wc_' + bolt.id + '_D').join(',') === D.BOLTS.join(','),
    boltLabels: [...document.getElementById('wc_' + bolt.id + '_D').options].map((o) => o.text).join(',') === D.BOLTS.map((d) => D.BOLT_LABEL[d]).join(','),
    lagD: opts('wc_' + lag.id + '_D').join(',') === D.LAGS.map((l) => l.D).join(','),
    lagL: opts('wc_' + lag.id + '_L').join(',') === D.LAG_LENGTHS.filter((L) => D.lagAvailable(lag.D, L)).join(','),
    penny: opts('wc_' + nail.id + '_penny').join(',') === Object.keys(D.NAILS[nail.nailType]).join(','),
    nailTypes: opts('wc_' + nail.id + '_nailType').join(',') === Object.keys(D.NAILS).join(','),
    species: opts('species').join(',') === Object.keys(D.SPECIES).concat(['CUSTOM']).join(','),
    loadCases: opts('wc_' + nail.id + '_loadCase').join(',') === Object.keys(D.CD).join(',')
  };
});
await page.evaluate(() => updSel(window.__WC_STATE.bolts[0].id, 'side.mat', 'steel'));
await tick();
const dg = await page.evaluate(() => { const bolt = window.__WC_STATE.bolts[0], D = window.WC.DATA; const v = [...document.getElementById('wc_' + bolt.id + '_side_gauge').options].map((o) => o.value); updSel(bolt.id, 'side.mat', 'wood'); return v.join(',') === Object.keys(D.GAUGES).map(Number).sort((a, b) => a - b).map(String).concat(['plate']).join(','); });
await tick();
check('bolt D / lag D / lag L (filtered by DATA.lagAvailable) / penny / nail type / species / load case / gauge options equal WC.DATA', dd.boltD && dd.boltLabels && dd.lagD && dd.lagL && dd.penny && dd.nailTypes && dd.species && dd.loadCases && dg, JSON.stringify(dd) + ' gauges=' + dg);
await page.evaluate(() => { const n = window.__WC_STATE.nails[0]; updSel(n.id, 'nailType', 'sinker'); });
await tick();
const sk = await page.evaluate(() => { const n = window.__WC_STATE.nails[0]; const v = { t: n.nailType, p: n.penny, opts: [...document.getElementById('wc_' + n.id + '_penny').options].map((o) => o.value).join(',') }; updSel(n.id, 'nailType', 'common'); return v; });
await tick();
check('sinker keeps 16d (in Table L4) and its penny list has no 6d, straight from DATA.NAILS.sinker', sk.t === 'sinker' && sk.p === '16d' && sk.opts.split(',').indexOf('6d') < 0, JSON.stringify(sk));

// AREv2 snapshot capture → load (Tier A + Tier B together)
const snap = await page.evaluate(() => {
  const s = AREv2.captureState();
  return { adapterVersion: s.adapterVersion, hasModel: !!s.model, ownedLeak: Object.keys(s.fields || {}).filter((k) => k.indexOf('#wc_') === 0), hdrKeys: Object.keys(s.fields || {}).filter((k) => /^#(species|mcFab|mcService|temp|steelGrade|E_override|custom_)/.test(k)).length };
});
check('AREv2.captureState carries the model (adapter v1) and captures the header as Tier-A fields, none of the #wc_ inputs', snap.adapterVersion === 1 && snap.hasModel && snap.ownedLeak.length === 0 && snap.hdrKeys >= 14, JSON.stringify(snap));
const load = await page.evaluate(() => {
  const s = AREv2.captureState();
  // mutate the page, then load the snapshot back
  addRow('nails'); addRow('screws');
  document.getElementById('mcFab').value = 'wet';
  hdrChanged();
  const res = AREv2.loadFromState(s);
  return { ok: res.ok, nails: window.__WC_STATE.nails.length, screws: window.__WC_STATE.screws.length, mcFab: window.__WC_STATE.header.mcFab, dom: document.querySelectorAll('#schedule tbody[data-row-id]').length, notices: res.notices };
});
check('AREv2.loadFromState restores the schedule and the header (runAndSettle re-read)', load.ok && load.nails === 1 && load.screws === 1 && load.mcFab === 'dry' && load.dom === 3, JSON.stringify(load));

// ── invalid / incomplete reasons reach the summary row ───────────────────────
const nid = await page.evaluate(() => window.__WC_STATE.nails[0].id);
await ev((id) => updN(id, 'V', ''), nid);
let rs = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); return { st: tb.querySelector('.st').textContent, msgs: tb.querySelector('.wc-c-status').innerText }; }, nid);
check('blank V → INCOMPLETE with the engine reason in the summary row', rs.st === 'INCOMPLETE' && /incomplete/i.test(rs.msgs) && /Incomplete: V/.test(rs.msgs), JSON.stringify(rs));
await ev((id) => updN(id, 'V', '100'), nid);
await ev((id) => updN(id, 'main.t', '-1'), nid);
rs = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); return { st: tb.querySelector('.st').textContent, msgs: tb.querySelector('.wc-c-status').innerText }; }, nid);
check('negative t → INVALID with the engine reason in the summary row', rs.st === 'INVALID' && /invalid/i.test(rs.msgs), JSON.stringify(rs));
await ev((id) => updN(id, 'main.t', '1.5'), nid);
rs = await page.evaluate((id) => document.querySelector('#schedule tbody[data-row-id="' + id + '"] .st').textContent, nid);
check('restored nail passes again', rs === 'PASS', rs);

// ── details labels / n-a reasons ─────────────────────────────────────────────
const lbl = await page.evaluate(() => {
  const st = window.__WC_STATE, det = (id) => document.querySelector('#schedule tbody[data-row-id="' + id + '"] tr.wc-det').innerText;
  return { nail: det(st.nails[0].id), lag: det(st.screws[0].id) };
});
check('p_t is labelled "penetration in main" for nails and "threads in main" for lags', /p_?t \(penetration in main/i.test(lbl.nail.replace(/\s+/g, ' ')) && /p_?t \(threads in main\)/i.test(lbl.lag.replace(/\s+/g, ' ')), JSON.stringify({ nail: lbl.nail.match(/p.?t \([^)]*\)/i), lag: lbl.lag.match(/p.?t \([^)]*\)/i) }));
const bg = await page.evaluate(() => window.__WC_STATE.bolts[0].id);
await ev((id) => { updN(id, 'n', '2'); updN(id, 's', '0'); }, bg);
const cg = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); const r = window.WC.compute(window.__WC_STATE).tables.bolts[0]; return { cite: r.factors.Cg.cite, v: r.factors.Cg.v, fac: tb.querySelector('.wc-fac').innerText.replace(/\s+/g, ' '), det: tb.querySelector('tr.wc-det').innerText.replace(/\s+/g, ' ') }; }, bg);
check('C_g null with an engine reason on a D ≥ 1/4 row prints that reason, not "D < 1/4 in"', cg.v === null && cg.cite.length > 0 && cg.fac.indexOf(cg.cite) >= 0 && cg.det.indexOf(cg.cite) >= 0 && cg.fac.indexOf('D < 1/4 in') < 0, JSON.stringify(cg).slice(0, 400));
await ev((id) => { updN(id, 's', '2'); updN(id, 'n', '1'); }, bg);

// ── v1.1: intermediate load angle + staggered rows ───────────────────────────
const v11 = await page.evaluate(() => window.WC.ENGINE.rev);
check('engine rev is 2026-09-20 v1.2', v11 === '2026-09-20 v1.2', v11);
const ab = await page.evaluate(() => window.__WC_STATE.bolts[0].id);
let an = await page.evaluate((id) => ({ isNumber: document.getElementById('wc_' + id + '_main_theta').type === 'number', q0: !!document.getElementById('wc_' + id + '_main_theta_0'), q90: !!document.getElementById('wc_' + id + '_main_theta_90'), loaded: !!document.getElementById('wc_' + id + '_main_loadedEdgeDist'), label: document.querySelector('label:has(#wc_' + id + '_main_theta) > span').innerText }), ab);
check('θ is a numeric input with 0° / 90° quick buttons, loaded edge hidden at θ = 0', an.isNumber && an.q0 && an.q90 && !an.loaded && /θ load to grain/.test(an.label), JSON.stringify(an));
await ev((id) => updN(id, 'main.theta', '45'), ab);
an = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); const r = window.WC.compute(window.__WC_STATE).tables.bolts[0]; return { theta: window.__WC_STATE.bolts[0].main.theta, loaded: !!document.getElementById('wc_' + id + '_main_loadedEdgeDist'), fac: tb.querySelector('.wc-fac').innerText.replace(/\s+/g, ' '), K: r.yield.Ktheta, status: r.status, end: window.__WC_STATE.bolts[0].main.endDist, notes: (r.notes || []).join(' | ') }; }, ab);
check('θ_main = 45 → loaded-edge input appears, K_θ chip reads 1.125, row still computes', an.theta === 45 && an.loaded && /Kθ 1\.125/.test(an.fac) && Math.abs(an.K - 1.125) < 1e-9 && an.status !== 'invalid', JSON.stringify(an).slice(0, 500));
console.log('      end distance re-defaulted at θ = 45: ' + an.end + ' (engine geomDefaults interpolates: ' + (await page.evaluate(() => GEOM_INTERP)) + ')');
await page.click('#wc_' + ab + '_main_theta_90');
await tick();
an = await page.evaluate((id) => ({ theta: window.__WC_STATE.bolts[0].main.theta, on: document.getElementById('wc_' + id + '_main_theta_90').classList.contains('on') }), ab);
check('90° quick button sets θ = 90 and lights up', an.theta === 90 && an.on, JSON.stringify(an));
await ev((id) => updN(id, 'main.theta', '45'), ab);
await ev((id) => { updN(id, 'n', '2'); updN(id, 'rows', '2'); updN(id, 's', '8'); updN(id, 'g', '0.75'); }, ab);
await ev((id) => updB(id, 'stagger', true), ab);
let sg = await page.evaluate((id) => ({ stagger: window.__WC_STATE.bolts[0].stagger, offset: window.__WC_STATE.bolts[0].offset, s: window.__WC_STATE.bolts[0].s, input: !!document.getElementById('wc_' + id + '_offset'), val: document.getElementById('wc_' + id + '_offset') && document.getElementById('wc_' + id + '_offset').value }), ab);
check('stagger checked with rows = 2 → offset input appears defaulting to s/2', sg.stagger && sg.input && sg.offset === sg.s / 2 && +sg.val === sg.s / 2, JSON.stringify(sg));
await ev((id) => updN(id, 'offset', String(window.__WC_STATE.bolts[0].s)), ab);
sg = await page.evaluate((id) => ({ st: document.querySelector('#schedule tbody[data-row-id="' + id + '"] .st').textContent, msgs: document.querySelector('#schedule tbody[data-row-id="' + id + '"] .wc-c-status').innerText }), ab);
check('offset ≥ s → row INVALID with the engine reason shown', sg.st === 'INVALID' && /offset/i.test(sg.msgs), JSON.stringify(sg));
await ev((id) => updN(id, 'offset', '4'), ab);
sg = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); const r = window.WC.compute(window.__WC_STATE).tables.bolts[0]; const d = r.factors && r.factors.Cg && r.factors.Cg.detail; const st = d && d.stagger; return { st: r.status, merged: !!(st && st.merged), stg: st, Cg: r.factors.Cg.v, offClosest: r.inputs.offClosest, fac: tb.querySelector('.wc-fac').innerText.replace(/\s+/g, ' '), det: tb.querySelector('tr.wc-det').innerText.replace(/\s+/g, ' '), notes: (r.notes || []).join(' | ') }; }, ab);
console.log('      stagger s 8 / offset 4 / g 0.75: status ' + sg.st + ', merged ' + sg.merged + ', C_g ' + sg.Cg);
check('engine merged case (s 8, offset 4, g 0.75): offClosest 4, n_eff 4, s_eff 4 (= s/2), rows_eff 1, C_g = min(merged, separate) with merged governing',
  sg.merged && sg.offClosest === 4 && sg.stg.n_eff === 4 && sg.stg.s_eff === 4 && sg.stg.rows_eff === 1 && sg.stg.governingLayout === 'merged' && Math.abs(sg.Cg - Math.min(sg.stg.Cg_merged, sg.stg.Cg_separate)) < 1e-12, JSON.stringify(sg.stg));
check('C_g chip names the governing layout and both C_g values', /rows merged/.test(sg.fac) && /merged 0\.\d{3} \/ separate 0\.\d{3}, merged governs/.test(sg.fac), sg.fac);
check('C_g detail (merged / n_eff / s_eff / rows_eff, both angle interpretations) is printed in the details block; merge + angle chip in the factor group', /n_eff/.test(sg.det) && /rows_eff/.test(sg.det) && /interpretations\.gross\.Cg/.test(sg.det) && /interpretations\.perp\.Cg/.test(sg.det) && (!sg.merged || /rows merged/.test(sg.fac)) && /at an angle: /.test(sg.fac), JSON.stringify(sg).slice(0, 600));
check('§12.6.2 note (angle + group) and §12.6.1 stagger note from the engine reach the details block', /12\.6\.2/.test(sg.det) && /12\.6\.1/.test(sg.det), sg.notes);
// typed offset above s/2 is folded to the closest-fastener offset and the chip says so
await ev((id) => updN(id, 'offset', '6'), ab);
sg = await page.evaluate((id) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + id + '"]'); const r = window.WC.compute(window.__WC_STATE).tables.bolts[0]; return { off: r.factors.Cg.detail.stagger.offset, close: r.factors.Cg.detail.stagger.offClosest, merged: r.factors.Cg.detail.stagger.merged, fac: tb.querySelector('.wc-fac').innerText.replace(/\s+/g, ' ') }; }, ab);
check('offset 6 on s 8 → offClosest 2 (g 0.75 ≥ 0.5: rows separate); chip shows "typed offset 6 → closest 2"', sg.off === 6 && sg.close === 2 && sg.merged === false && /typed offset 6\.000 → closest 2\.000/.test(sg.fac) && /rows separate/.test(sg.fac), sg.fac);
await ev((id) => updN(id, 'offset', '4'), ab);
const rt2 = await page.evaluate(() => { const a = window.__WC_ADAPTER, m = a.getModel(), before = JSON.stringify(m); a.setModel(JSON.parse(before)); const b = a.getModel().bolts[0]; return { same: JSON.stringify(a.getModel()) === before, theta: b.main.theta, stagger: b.stagger, offset: b.offset }; });
check('adapter round trip preserves θ = 45, stagger = true and the offset', rt2.same && rt2.theta === 45 && rt2.stagger === true && rt2.offset === 4, JSON.stringify(rt2));
await ev((id) => updB(id, 'stagger', false), ab);
sg = await page.evaluate((id) => ({ input: !!document.getElementById('wc_' + id + '_offset'), stagger: window.__WC_STATE.bolts[0].stagger, st: document.querySelector('#schedule tbody[data-row-id="' + id + '"] .st').textContent }), ab);
check('unchecking stagger removes the offset input and the row is valid again', !sg.input && sg.stagger === false && sg.st !== 'INVALID', JSON.stringify(sg));
await ev((id) => { updN(id, 'n', '1'); updN(id, 'rows', '1'); updN(id, 's', '2'); updN(id, 'main.theta', '0'); }, ab);
const bad2 = await page.evaluate(() => { const a = window.__WC_ADAPTER, keep = JSON.stringify(a.getModel()); const m = JSON.parse(keep); m.bolts[0].stagger = 'yes'; m.bolts[0].offset = 'x'; a.setModel(m); const b = a.getModel().bolts[0]; const out = { stagger: b.stagger, offset: b.offset }; a.setModel(JSON.parse(keep)); return out; });
check('sanitizeRows coerces stagger to a boolean and a non-numeric offset to null', bad2.stagger === true && bad2.offset === null, JSON.stringify(bad2));

// ── v1.2: Simpson Fastener Designer parity (spec §13) ────────────────────────
const nid2 = await page.evaluate(() => window.__WC_STATE.nails[0].id);
const bid2 = await page.evaluate(() => window.__WC_STATE.bolts[0].id);
const lid2 = await page.evaluate(() => window.__WC_STATE.screws[0].id);
const txt = (s) => s.replace(/\s+/g, ' ').trim();
await ev((id) => { updSel(id, 'D', '0.5'); updSel(id, 'L', '4'); }, lid2);   // back to the seeded 1/2 × 4 lag (2x to 4x, V 200 / T 100)
await ev((id) => updN(id, 'main.theta', '0'), nid2);                          // the θ test above left the nail at 90 (s default 10D); back to ∥
// open the three details rows: innerText of a hidden row carries no cell separators
await page.evaluate(({ b, n, l }) => [b, n, l].forEach((id) => { if (!openDet[id]) toggleDet(id); }), { b: bid2, n: nid2, l: lid2 });
// 13.1 labels + tooltips, member block names and the §13.6 group order
const lb = await page.evaluate(({ n, b }) => {
  const lab = (id, p) => { const el = document.getElementById('wc_' + id + '_' + p); const l = el && el.closest('label'); return l ? { text: l.querySelector('span').innerText, title: l.getAttribute('title') || '', inTitle: el.getAttribute('title') || '' } : null; };
  const grps = (id) => [...document.querySelectorAll('#schedule tbody[data-row-id="' + id + '"] tr.wc-in .wc-grp-t')].map((e) => e.textContent.trim());   // textContent: the CSS uppercases
  return { nt: lab(n, 'main_t'), st: lab(n, 'side_t'), bw: lab(b, 'main_w'), nw: !!document.getElementById('wc_' + n + '_main_w'), grpsN: grps(n), grpsB: grps(b) };
}, { n: nid2, b: bid2 });
check('t / w labels read "t — along fastener (in)" / "w — across fastener (in)" with the ledger tooltip on t',
  lb.nt && /^t — along fastener \(in\)$/.test(lb.nt.text) && /ledger/.test(lb.nt.title) && /3\.5 for a 2x4/.test(lb.nt.inTitle) && lb.st && /along fastener/.test(lb.st.text) && lb.bw && /^w — across fastener \(in\)$/.test(lb.bw.text) && /C_g/.test(lb.bw.title) && !lb.nw, JSON.stringify(lb));
check('input groups in the FD order: Fastener · Load · Side Member A · Main Member B · Pattern · Factors',
  lb.grpsN.length === 6 && /^Fastener$/.test(lb.grpsN[0]) && /^Load/.test(lb.grpsN[1]) && /^Side Member A/.test(lb.grpsN[2]) && /^Main Member B$/.test(lb.grpsN[3]) && /^Pattern$/.test(lb.grpsN[4]) && /^Factors/.test(lb.grpsN[5]) && lb.grpsB.join('|') === lb.grpsN.join('|'), JSON.stringify(lb.grpsN));
// 13.2 summary columns, qty, demand basis toggle
const sc = await page.evaluate(({ n }) => {
  const sec = document.querySelector('#schedule section[data-table="nails"]');
  const ths = [...sec.querySelectorAll('thead th')].map((e) => e.textContent.trim());
  const tb = sec.querySelector('tbody[data-row-id="' + n + '"]');
  const st = window.__WC_STATE.nails[0], r = window.WC.compute(window.__WC_STATE).tables.nails[0];
  return { ths, qty: tb.querySelector('td.wc-c-qty').innerText, vtot: tb.querySelector('td.wc-c-vtot').innerText, ttot: tb.querySelector('td.wc-c-ttot').innerText, ztot: tb.querySelector('td.wc-c-ztot').innerText, wtot: tb.querySelector('td.wc-c-wtot').innerText,
    n: st.n, rows: st.rows, V: st.V, basis: st.demandBasis, rq: r.demand.qty, rVt: r.demand.V_total, rZt: r.capacity.Z_total, rZp: r.capacity.Zp,
    hasV: !!document.getElementById('wc_' + n + '_V'), hasVt: !!document.getElementById('wc_' + n + '_V_total'), roVt: (document.getElementById('wc_' + n + '_V_total_ro') || {}).innerText, roV: !!document.getElementById('wc_' + n + '_V_ro'),
    segPer: document.getElementById('wc_' + n + '_demandBasis_per').classList.contains('on'), segTot: document.getElementById('wc_' + n + '_demandBasis_total').classList.contains('on'),
    boltThs: [...document.querySelectorAll('#schedule section[data-table="bolts"] thead th')].map((e) => e.textContent.trim()) };
}, { n: nid2 });
check('summary columns: # · Description · Fastener · qty · V_total · T_total · Z_total · W_total · D/C · Status (bolts drop T_total / W_total)',
  sc.ths.join('|') === '#|Description|Fastener|qty|Vtotal (lb)|Ttotal (lb)|Ztotal (lb)|Wtotal (lb)|D/C|Status|' && sc.boltThs.join('|') === '#|Description|Fastener|qty|Vtotal (lb)|Ztotal (lb)|D/C|Status|', JSON.stringify([sc.ths, sc.boltThs]));
check('seeded nail: qty 2 (n 2 × rows 1), V_total = V·qty = 200 in the summary row and the read-only chip, Z_total = qty·Z′ from the engine',
  sc.qty === '2' && sc.n === 2 && sc.rows === 1 && sc.V === 100 && sc.rq === 2 && sc.rVt === 200 && sc.vtot === '200' && /= 200 lb \(100 × 2\)/.test(txt(sc.roVt)) && Math.abs(sc.rZt - 2 * sc.rZp) < 1e-9 && sc.ztot.replace(/,/g, '') === String(Math.round(sc.rZt)), JSON.stringify(sc));
check('per-fastener mode: V input editable, V_total absent (read-only chip instead), segmented toggle lit on "per fastener"',
  sc.basis === 'per' && sc.hasV && !sc.hasVt && !sc.roV && sc.segPer && !sc.segTot, JSON.stringify(sc));
const dcBefore = await page.evaluate(() => window.WC.compute(window.__WC_STATE).tables.nails[0].demand.dc);
await page.click('#wc_' + nid2 + '_demandBasis_total');
await tick();
let tg = await page.evaluate(({ n }) => {
  const st = window.__WC_STATE.nails[0], r = window.WC.compute(window.__WC_STATE).tables.nails[0];
  return { basis: st.demandBasis, Vt: st.V_total, Tt: st.T_total, hasV: !!document.getElementById('wc_' + n + '_V'), hasVt: !!document.getElementById('wc_' + n + '_V_total'), vtVal: (document.getElementById('wc_' + n + '_V_total') || {}).value, roV: (document.getElementById('wc_' + n + '_V_ro') || {}).innerText, rV: r.demand.V, rVt: r.demand.V_total, dc: r.demand.dc, segTot: document.getElementById('wc_' + n + '_demandBasis_total').classList.contains('on'), vtot: document.querySelector('#schedule tbody[data-row-id="' + n + '"] td.wc-c-vtot').innerText };
}, { n: nid2 });
check('toggle → total: V_total input (200) editable, V read-only "= 100 lb each of 2", engine V 100, D/C unchanged',
  tg.basis === 'total' && tg.Vt === 200 && tg.Tt === 0 && !tg.hasV && tg.hasVt && tg.vtVal === '200' && /= 100 lb each of 2/.test(txt(tg.roV)) && tg.rV === 100 && tg.rVt === 200 && Math.abs(tg.dc - dcBefore) < 1e-12 && tg.segTot && tg.vtot === '200', JSON.stringify(tg));
await ev((id) => updN(id, 'V_total', '400', true), nid2);
tg = await page.evaluate(({ n }) => { const r = window.WC.compute(window.__WC_STATE).tables.nails[0]; return { rV: r.demand.V, dc: r.demand.dc, roV: (document.getElementById('wc_' + n + '_V_ro') || {}).innerText, vtot: document.querySelector('#schedule tbody[data-row-id="' + n + '"] td.wc-c-vtot').innerText }; }, { n: nid2 });
check('live-typed V_total 400 → per-fastener chip "= 200 lb each of 2", summary V_total 400, D/C doubles (patchLive, no rebuild)',
  tg.rV === 200 && Math.abs(tg.dc - 2 * dcBefore) < 1e-12 && /= 200 lb each of 2/.test(txt(tg.roV)) && tg.vtot === '400', JSON.stringify(tg));
await page.click('#wc_' + nid2 + '_demandBasis_per');
await tick();
tg = await page.evaluate(({ n }) => { const st = window.__WC_STATE.nails[0]; return { basis: st.demandBasis, V: st.V, hasV: !!document.getElementById('wc_' + n + '_V'), roVt: (document.getElementById('wc_' + n + '_V_total_ro') || {}).innerText }; }, { n: nid2 });
check('toggle back → per: V = V_total / qty = 200, V input back, V_total chip "= 400 lb (200 × 2)"', tg.basis === 'per' && tg.V === 200 && tg.hasV && /= 400 lb \(200 × 2\)/.test(txt(tg.roVt)), JSON.stringify(tg));
await ev((id) => updN(id, 'V', '100'), nid2);
// 13.5 details order + section content
const dord = await page.evaluate(({ b, n, l }) => {
  const h4 = (id) => [...document.querySelectorAll('#schedule tbody[data-row-id="' + id + '"] tr.wc-det .wc-d h4')].map((e) => e.innerText.replace(/\s+/g, ' ').trim());
  const det = (id) => document.querySelector('#schedule tbody[data-row-id="' + id + '"] tr.wc-det').innerText.replace(/\s+/g, ' ');
  return { b: h4(b), n: h4(n), l: h4(l), nt: det(n), lt: det(l), bt: det(b) };
}, { b: bid2, n: nid2, l: lid2 });
const ORDER = ['Fastener properties', 'Adjustment factors', 'Penetration', 'Fastener pattern', 'Minimum spacing requirements', 'Withdrawal', 'Lateral', 'Combined loading', 'Notes, engineer checks'];
const inOrder = (h) => ORDER.every((t, i) => h[i] && h[i].indexOf(t) === 0);
check('details sections in the §13.5 order for bolt, nail and lag (Fastener properties → … → Combined → Notes)', inOrder(dord.b) && inOrder(dord.n) && inOrder(dord.l), JSON.stringify(dord.b));
check('Fastener properties prints D_H for the nail, "—" for the lag head, coating "—", F_yb with its source', /D_?H.*0\.344 in/.test(dord.nt) && /DH \(head\) — hex head/.test(dord.lt) && /coating — no product data/.test(dord.nt) && /Fyb 90,000 psi Table I1/.test(dord.nt), dord.nt.slice(0, 400));
check('Withdrawal and Lateral sections end with W_total / Z_total and a "Demand / Resistance" percentage (lag V 200 / T 100: three percentages incl. combined); nail T = 0 prints "—" for withdrawal',
  /Wtotal = qty × Wcap [\d,]+ lb/.test(dord.lt) && /Ztotal = qty × Z′ [\d,]+ lb/.test(dord.lt) && (dord.lt.match(/Demand \/ Resistance [\d.]+ %/g) || []).length === 3 && /Wtotal = qty × Wcap [\d,]+ lb demand T per fastener \/ Ttotal 0 \/ 0 lb Demand \/ Resistance —/.test(dord.nt), dord.lt.slice(dord.lt.indexOf('Withdrawal'), dord.lt.indexOf('Withdrawal') + 900));
check('Combined section shows α, the equation (12.4-1 for the lag), Z′_α, the combined demand and its percentage; D/C governing line', /α = atan\(T \/ V\) 26\.6°/.test(dord.lt) && /Eq\. 12\.4-1/.test(dord.lt) && /Z′α [\d,]+ lb/.test(dord.lt) && /√\(V² \+ T²\) per fastener 224 lb/.test(dord.lt) && /D\/C governing [\d.]+ — PASS/.test(dord.lt), dord.lt.slice(-700));
check('Combined section on a bolt reads n/a (no withdrawal)', /Combined loading[^]*n\/a — no withdrawal on bolts/.test(dord.bt), dord.bt.slice(-300));
// 13.3 minimum spacing requirements table — bolt (hard minima) and nail (advisory)
const spB = await page.evaluate(({ b }) => {
  const h = [...document.querySelectorAll('#schedule tbody[data-row-id="' + b + '"] tr.wc-det .wc-d h4')].find((e) => /Minimum spacing/.test(e.innerText));
  const tbl = h.parentElement.querySelector('table');
  const rows = [...tbl.querySelectorAll('tr')].slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim()));
  const r = window.WC.compute(window.__WC_STATE).tables.bolts[0];
  return { basis: h.parentElement.querySelector('.cite').innerText, rows, sr: r.spacingReq, oks: tbl.querySelectorAll('td.ok').length, warns: tbl.querySelectorAll('td.warn').length, bads: tbl.querySelectorAll('td.bad').length };
}, { b: bid2 });
const LINES = ['spacing in a row, ∥ to grain a1', 'spacing in a row, ⊥ to grain a2', 'end distance, loaded end', 'end distance, unloaded end', 'edge distance, loaded edge', 'edge distance, unloaded edge', 'between rows, in-line', 'between rows, staggered'];
const firstCells = spB.rows.map((r) => r[0]);
check('bolt spacing table: basis line Table 12.5.1A–D, all 8 requirement lines present in order, required values from result.spacingReq (a1 2.0, end loaded 3.5, edge unloaded 0.75, rows 0.75)',
  /Table 12\.5\.1A/.test(spB.basis) && LINES.every((l, i) => firstCells.some((c) => c.indexOf(l) === 0)) && LINES.map((l) => firstCells.findIndex((c) => c.indexOf(l) === 0)).every((v, i, a) => i === 0 || v > a[i - 1])
  && spB.rows.find((r) => r[0].indexOf(LINES[0]) === 0)[1].indexOf('2.000 in') === 0 && spB.rows.find((r) => r[0].indexOf(LINES[2]) === 0)[1].indexOf('3.500 in') === 0 && spB.rows.find((r) => r[0].indexOf(LINES[5]) === 0)[1].indexOf('0.750 in') === 0 && spB.rows.find((r) => r[0].indexOf(LINES[6]) === 0)[1].indexOf('0.750 in') === 0, JSON.stringify(spB.rows));
check('bolt spacing table: main / side end + edge checks filed under their lines with actual and ✓ (4 checks, 0 ⚠, 0 ✗), the hard minimum printed beside the C_Δ = 1.0 value',
  spB.sr.checks.length === 4 && spB.oks === 4 && spB.warns === 0 && spB.bads === 0 && spB.rows.some((r) => r[0].indexOf(LINES[2]) === 0 && /main end distance/.test(r[0]) && /\(min 1\.750\)/.test(r[1]) && r[2] === '3.500 in'), JSON.stringify(spB.rows));
const spN = await page.evaluate(({ n }) => {
  const h = [...document.querySelectorAll('#schedule tbody[data-row-id="' + n + '"] tr.wc-det .wc-d h4')].find((e) => /Minimum spacing/.test(e.innerText));
  const tbl = h.parentElement.querySelector('table');
  const r = window.WC.compute(window.__WC_STATE).tables.nails[0], st = window.__WC_STATE.nails[0];
  return { basis: h.parentElement.querySelector('.cite').innerText, oks: tbl.querySelectorAll('td.ok').length, warns: tbl.querySelectorAll('td.warn').length, bads: tbl.querySelectorAll('td.bad').length, checks: r.spacingReq.checks.length, s: st.s, g: st.g, end: st.main.endDist, edge: st.main.edgeDist, status: r.status, adv: r.warnings.filter((w) => /advisory/.test(w)).length, prebored: !!document.getElementById('wc_' + n + '_prebored') };
}, { n: nid2 });
check('seeded 16d nail: advisory basis (Commentary C12.1.6.6, wood side, not prebored), defaults s 2.43 / g 0.81 / end 2.43 / edge 0.405 from the engine, 5 checks all ✓, no advisory warning',
  /Commentary Table C12\.1\.5\.7/.test(spN.basis) && /wood side member, not prebored/.test(spN.basis) && /advisory/.test(spN.basis) && Math.abs(spN.s - 2.43) < 1e-9 && Math.abs(spN.g - 0.81) < 1e-9 && Math.abs(spN.end - 2.43) < 1e-9 && Math.abs(spN.edge - 0.405) < 1e-9 && spN.checks === 5 && spN.oks === 5 && spN.warns === 0 && spN.bads === 0 && spN.adv === 0 && spN.status === 'pass', JSON.stringify(spN));
await ev((id) => updN(id, 's', '1'), nid2);
const spN2 = await page.evaluate(({ n }) => {
  const tb = document.querySelector('#schedule tbody[data-row-id="' + n + '"]');
  const h = [...tb.querySelectorAll('tr.wc-det .wc-d h4')].find((e) => /Minimum spacing/.test(e.innerText));
  const tbl = h.parentElement.querySelector('table');
  const row = [...tbl.querySelectorAll('tr')].find((tr) => /spacing in a row, ∥/.test(tr.innerText));
  return { warns: tbl.querySelectorAll('td.warn').length, bads: tbl.querySelectorAll('td.bad').length, st: tb.querySelector('.st').textContent, msgs: tb.querySelector('.wc-c-status').innerText, rowTxt: row && row.innerText.replace(/\s+/g, ' ') };
}, { n: nid2 });
check('nail s = 1.0 < 15D: the a1 line shows required 2.430 / actual 1.000 / ⚠ (advisory, not ✗), status still PASS, advisory warning in the summary row',
  spN2.warns === 1 && spN2.bads === 0 && spN2.st === 'PASS' && /advisory spacing: s = 1\.000 < 15D = 2\.430/.test(spN2.msgs) && /2\.430 in 1\.000 in/.test(spN2.rowTxt), JSON.stringify(spN2));
await ev((id) => updN(id, 's', '2.43'), nid2);
// prebored checkbox: nails and wood screws only
await ev((id) => updSel(id, 'screwType', 'wood'), lid2);
const pb = await page.evaluate(({ n, b, l }) => ({ nail: !!document.getElementById('wc_' + n + '_prebored'), bolt: !!document.getElementById('wc_' + b + '_prebored'), ws: !!document.getElementById('wc_' + l + '_prebored'), wsS: window.__WC_STATE.screws[0].s, wsD: window.WC.DATA.WOOD_SCREWS['10'].D }), { n: nid2, b: bid2, l: lid2 });
await ev((id) => updB(id, 'prebored', true), lid2);
const pb2 = await page.evaluate(({ l }) => { const r = window.WC.compute(window.__WC_STATE).tables.screws[0]; return { pre: window.__WC_STATE.screws[0].prebored, basis: r.spacingReq.basis, srPre: r.spacingReq.prebored, a1: r.spacingReq.a1_par, det: document.querySelector('#schedule tbody[data-row-id="' + l + '"] tr.wc-det').innerText.replace(/\s+/g, ' ') }; }, { l: lid2 });
check('prebored checkbox on the nail and the wood screw only (not the bolt); wood-screw geometry re-defaulted to 15D on the switch from lag',
  pb.nail && pb.ws && !pb.bolt && Math.abs(pb.wsS - 15 * pb.wsD) < 1e-9, JSON.stringify(pb));
check('prebored → engine spacingReq.prebored true, a1 = 10D, the details basis line says "prebored"', pb2.pre === true && pb2.srPre === true && Math.abs(pb2.a1 - 1.9) < 1e-9 && /wood side member, prebored/.test(pb2.det), JSON.stringify(pb2).slice(0, 300));
await ev((id) => updB(id, 'prebored', false), lid2);
await ev((id) => updSel(id, 'screwType', 'lag'), lid2);
const lagPb = await page.evaluate(({ l }) => ({ pre: !!document.getElementById('wc_' + l + '_prebored'), D: window.__WC_STATE.screws[0].D, L: window.__WC_STATE.screws[0].L }), { l: lid2 });
check('back to lag: no prebored checkbox', !lagPb.pre && lagPb.D === 0.5, JSON.stringify(lagPb));
// exits-main warning in the summary row (fastener cell chip + status message)
await ev((id) => updN(id, 'main.t', '1'), lid2);
const ex = await page.evaluate(({ l }) => { const tb = document.querySelector('#schedule tbody[data-row-id="' + l + '"]'); const r = window.WC.compute(window.__WC_STATE).tables.screws[0]; return { exits: r.lengths.exits_main, chip: tb.querySelector('td.wc-c-fast .wc-exit'), chipTitle: (tb.querySelector('td.wc-c-fast .wc-exit') || {}).title, msgs: tb.querySelector('.wc-c-status').innerText, pen: [...tb.querySelectorAll('tr.wc-det h4')].find((e) => /Penetration/.test(e.innerText)).parentElement.innerText.replace(/\s+/g, ' ') }; }, { l: lid2 });
check('lag 1/2 × 4 into t_s 1.5 + t_m 1 → exits-main: ⚠ chip in the summary fastener cell (title = engine warning) and the warning in the status cell; Penetration section prints the line',
  ex.exits === true && !!ex.chip && /exits the main member/.test(ex.chipTitle) && /exits the main member/.test(ex.msgs) && /exits main member: yes — fastener exits the main member/.test(ex.pen), JSON.stringify(ex).slice(0, 500));
await ev((id) => updN(id, 'main.t', '3.5'), lid2);
// E read-only chip from the engine members
const eo = await page.evaluate(({ n }) => ({ main: (document.getElementById('wc_' + n + '_main_E_ro') || {}).innerText, side: (document.getElementById('wc_' + n + '_side_E_ro') || {}).innerText }), { n: nid2 });
check('member blocks print E read-only from the species (1,600,000 psi DFL)', /1,600,000/.test(eo.main || '') && /1,600,000/.test(eo.side || ''), JSON.stringify(eo));
// round trip + sanitising of the v1.2 fields
const rt3 = await page.evaluate(({ n }) => {
  const a = window.__WC_ADAPTER;
  upd(n, 'demandBasis', 'total'); updN(n, 'V_total', '360'); updB(n, 'prebored', true);
  const before = JSON.stringify(a.getModel());
  a.setModel(JSON.parse(before));
  const r = a.getModel().nails[0], out = { same: JSON.stringify(a.getModel()) === before, basis: r.demandBasis, Vt: r.V_total, pre: r.prebored, V: window.WC.compute(window.__WC_STATE).tables.nails[0].demand.V };
  const m = JSON.parse(before); m.nails[0].demandBasis = 'bogus'; m.nails[0].V_total = 'x'; m.nails[0].T_total = '12'; m.nails[0].prebored = 'yes'; m.bolts[0].T_total = 99;
  a.setModel(m);
  const s = a.getModel();
  out.coerced = { basis: s.nails[0].demandBasis, Vt: s.nails[0].V_total, Tt: s.nails[0].T_total, pre: s.nails[0].prebored, boltTt: s.bolts[0].T_total };
  a.setModel(JSON.parse(before));
  upd(n, 'demandBasis', 'per'); updN(n, 'V', '100'); updB(n, 'prebored', false);
  return out;
}, { n: nid2 });
check('adapter round trip preserves demandBasis total, V_total 360 (engine V 180 each of 2) and prebored', rt3.same && rt3.basis === 'total' && rt3.Vt === 360 && rt3.pre === true && rt3.V === 180, JSON.stringify(rt3));
check('sanitizeRows coerces demandBasis → per, V_total/T_total → number|null, prebored → bool, bolt T_total → null', rt3.coerced.basis === 'per' && rt3.coerced.Vt === null && rt3.coerced.Tt === null && rt3.coerced.pre === true && rt3.coerced.boltTt === null, JSON.stringify(rt3.coerced));
const fin = await page.evaluate(() => ({ V: window.__WC_STATE.nails[0].V, basis: window.__WC_STATE.nails[0].demandBasis, st: [...document.querySelectorAll('#schedule tbody[data-row-id] .st')].map((e) => e.textContent).join(',') }));
check('nail restored to per-fastener V 100 and every seeded row passes before the print check', fin.V === 100 && fin.basis === 'per' && /^PASS,PASS,PASS/.test(fin.st), JSON.stringify(fin));
await page.evaluate(({ b, n, l }) => [b, n, l].forEach((id) => { if (openDet[id]) toggleDet(id); }), { b: bid2, n: nid2, l: lid2 });

// ── print media ──────────────────────────────────────────────────────────────
await page.emulateMedia({ media: 'print' });
const pr = await page.evaluate(() => ({
  detVisible: [...document.querySelectorAll('#schedule tr.wc-det')].every((tr) => getComputedStyle(tr).display !== 'none'),
  btnHidden: [...document.querySelectorAll('#schedule .wc-btns, #schedule .btn-add, #printBtn')].every((b) => getComputedStyle(b).display === 'none'),
  breaks: [...document.querySelectorAll('#schedule section')].slice(1).every((s) => /page|always/.test(getComputedStyle(s).breakBefore + getComputedStyle(s).pageBreakBefore)),
  summaryLast: (() => { const c = document.querySelector('.content'); const kids = [...c.children]; return kids.indexOf(document.getElementById('summary')) > kids.indexOf(document.getElementById('schedule')); })()
}));
check('print: every .wc-det visible, buttons hidden, page break before each later section, summary after the tables', pr.detVisible && pr.btnHidden && pr.breaks && pr.summaryLast, JSON.stringify(pr));
await page.emulateMedia({ media: 'screen' });
await page.screenshot({ path: OUT_DIR + 'wc-ui-smoke.png', fullPage: true });

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
const realConsole = consoleErrors.filter((t) => !/Failed to load resource/.test(t));
check('no console errors (404s for external font CSS are expected offline: ' + notFound.map((u) => new URL(u).host).join(', ') + ')', realConsole.length === 0, realConsole.join('\n      '));
check('every 404 is an external host, nothing under /Calcs or /are-*', notFound.every((u) => new URL(u).host !== 'calcs.test'), notFound.join('\n      '));

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
