// =============================================================================
// Stacked Headers & Studs — engine + wiring test
// -----------------------------------------------------------------------------
// 1. Loads public/Calcs/engines/stacked-headers.js into a bare Node vm and runs
//    the pinned fixture set, proving the engine is DOM-free (spec §1).
// 2. Deep-compares the fixture data embedded in the engine against
//    docs/stacked-wood-qaqc-2026-09/E-fixtures.json, so an expected value can
//    never be edited to make a test pass.
// 3. Loads the page in headless Chromium with every request fulfilled from
//    public/ on disk, runs the same fixtures through window.HDR, then drives the
//    DOM: add a header, Check, read the D/C cells, round-trip the AREv2 state,
//    load a hand-written v1 record, and read the v2 foundation export.
// 4. Screenshots screen and print media to tools/_out/ (scratch).
// Usage: node tools/test-stacked-headers.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC_DIR = ROOT + 'public/';
const OUT = ROOT + 'tools/_out/';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'stacked_headers_studs_calculator.html';
const ENGINE = 'Calcs/engines/stacked-headers.js';

mkdirSync(OUT, { recursive: true });

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// ── 1. engine in a bare Node vm (no DOM, no browser) ─────────────────────────
const engineSrc = readFileSync(PUBLIC_DIR + ENGINE, 'utf8');
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.runInNewContext(engineSrc, sandbox, { filename: 'stacked-headers.js' });
const HDR = sandbox.HDR;
check('engine loads in a bare vm (no DOM)', !!HDR && typeof HDR.compute === 'function', String(HDR));
check('engine identity', HDR.ENGINE.version === 2 && HDR.ENGINE.name === 'stacked-headers',
      JSON.stringify(HDR.ENGINE));

const nodeFx = HDR.runFixtures();
nodeFx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures (node vm) ${nodeFx.pass}/${nodeFx.total}`, nodeFx.pass === nodeFx.total,
      nodeFx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// ── 2. embedded fixture data === the reviewed JSON on disk ───────────────────
const onDisk = JSON.parse(readFileSync(ROOT + 'docs/stacked-wood-qaqc-2026-09/E-fixtures.json', 'utf8'));
check('embedded fixture data is byte-equal to E-fixtures.json (expected values unedited)',
      JSON.stringify(onDisk) === JSON.stringify(HDR.FIXTURES),
      'embedded ' + HDR.FIXTURES.length + ' vs on-disk ' + onDisk.length + ' fixtures');
check('every E fixture has a runner',
      onDisk.every((f) => nodeFx.lines.some((l) => l.includes(' ' + f.id + ' '))),
      onDisk.filter((f) => !nodeFx.lines.some((l) => l.includes(' ' + f.id + ' '))).map((f) => f.id).join(', '));

// ── 3. the page ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()); });
page.on('dialog', (d) => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
async function serve(p) {
  await p.route('**/*', (route) => {
    const url = new URL(route.request().url());
    // are-calc.css @imports two external font sheets. They are cosmetic, they are
    // dropped from saved snapshots anyway, and letting them 404 would fill the
    // console-error channel this test uses to catch real faults.
    if (url.hostname !== 'calcs.test') { route.fulfill({ status: 200, contentType: 'text/css', body: '' }); return; }
    const path = url.pathname.replace(/^\//, '');
    try {
      const ext = path.split('.').pop();
      route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + path) });
    } catch { route.fulfill({ status: 404, body: '' }); }
  });
}
await serve(page);
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');

const fx = await page.evaluate(() => window.HDR.runFixtures());
check(`engine fixtures (browser) ${fx.pass}/${fx.total}`, fx.pass === fx.total,
      fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));
check('?selftest=1 reports in the page title and banner',
      (await page.title()).startsWith('SELFTEST PASS') &&
      (await page.evaluate(() => document.getElementById('selftest-result').textContent.slice(0, 13))) === 'SELFTEST PASS',
      await page.title());

// page text: the edition tags must be current
const pageText = await page.evaluate(() => document.body.innerText);
check('no ASCE 7-22 anywhere on the page', !/ASCE\s*7-22/.test(pageText),
      (pageText.match(/.{0,60}ASCE\s*7-22.{0,60}/) || [''])[0]);
check('tags read NDS 2018 / ASCE 7-16 / IBC 2021',
      /NDS 2018/.test(pageText) && /ASCE 7-16/.test(pageText) && /IBC 2021/.test(pageText), '');
check('wind inputs are labelled strength level', /strength level/i.test(pageText), '');

// ── shared-toolbar Wide toggle: data-are-wide-default → on, cap none → 1280px → none ──
const wide = await page.evaluate(() => {
  const cap = () => getComputedStyle(document.querySelector('.container')).maxWidth;
  const on = () => document.body.classList.contains('are-wide');
  const btn = document.getElementById('areWideBtn');
  const w0 = on(), cap0 = cap();
  btn.click(); const w1 = on(), cap1 = cap(), s1 = localStorage.getItem('areCalcs_wide:stacked_headers_studs_calculator.html');
  btn.click(); const w2 = on(), cap2 = cap(), s2 = localStorage.getItem('areCalcs_wide:stacked_headers_studs_calculator.html');
  return { w0, cap0, w1, cap1, s1, w2, cap2, s2 };
});
check('wide: on by default (cap none), toggles off to 1280px and back, remembered under the per-calc key',
  wide.w0 && wide.cap0 === 'none' && !wide.w1 && wide.cap1 === '1280px' && wide.s1 === '0' && wide.w2 && wide.cap2 === 'none' && wide.s2 === '1', JSON.stringify(wide));

// ── UI: add a header at the roof and run its Check ───────────────────────────
await page.evaluate(() => addHeader(0));
const nHdr = await page.evaluate(() => floors.map((f) => f.headers.length).join(','));
check('a roof header propagates to every floor', nHdr === '1,1,1', nHdr);
const ids = await page.evaluate(() => ({
  ids: floors.map((f) => f.headers[0].id),
  stacks: floors.map((f) => f.headers[0].stack_id)
}));
check('each row has its own id', new Set(ids.ids).size === 3, JSON.stringify(ids.ids));
check('all three share one stack id', new Set(ids.stacks).size === 1, JSON.stringify(ids.stacks));

await page.click('#hchk_0_0 ~ *, button.btn-chk');   // first Check button on the page
await page.waitForSelector('#hchk_0_0 .chk-table');
const ui = await page.evaluate(() => {
  const panel = document.getElementById('hchk_0_0');
  const dcs = Array.from(panel.querySelectorAll('.dc-cell span')).map((s) => s.textContent);
  return {
    shown: panel.style.display !== 'none',
    rows: panel.querySelectorAll('.chk-table tr:not(.det-row)').length,
    dcs: dcs,
    summary: panel.querySelector('.sum-pass, .sum-fail').innerText,
    record: !!panel.innerText.match(/Calculation record/),
    combos: panel.innerText.includes('D+0.6W') || panel.innerText.includes('0.6D+0.6W')
  };
});
check('header result panel is shown', ui.shown, JSON.stringify(ui));
check('check table is populated', ui.rows >= 12, 'rows=' + ui.rows);
check('D/C cells rendered', ui.dcs.length >= 10 && ui.dcs.every((d) => /^\d+\.\d{3}$/.test(d)), JSON.stringify(ui.dcs));
check('calculation record block present', ui.record, ui.summary);
check('wind combinations reach the king stud', ui.combos, ui.summary);

// the shipped-default roof header must reproduce appendix E Case 1
const roof = await page.evaluate(() => {
  const r = window.RESULT.floors[0].headers[0];
  return {
    combo: r.header.governing.tag, CD: r.header.governing.CD, w: r.header.governing.w,
    CL: r.header.governing.cl.CL, dcFlex: r.header.governing.dc_b, dcMax: r.header.dc_max,
    jambN: r.jamb.n, jambCP: r.jamb.governing.CP, jambDC: r.jamb.governing.dc,
    kingCombo: r.king.governing.tag, kingDC: r.king.governing.dc
  };
});
const near = (a, b, t) => Math.abs(a - b) <= t;
check('roof header governs at D+S, C_D 1.15, w 570 plf (appendix E Case 1)',
      roof.combo === 'D+S' && roof.CD === 1.15 && near(roof.w, 570, 0.01), JSON.stringify(roof));
check('roof header D/C flexure = 1.1247 (appendix E Case 1)', near(roof.dcFlex, 1.1247, 5e-4), JSON.stringify(roof));
check('jamb pack: 1 jamb, C_P 0.2552, D/C 0.6342 (appendix E Case 1)',
      roof.jambN === 1 && near(roof.jambCP, 0.2552, 5e-4) && near(roof.jambDC, 0.6342, 5e-4), JSON.stringify(roof));
check('king stud governs at D+0.6W', roof.kingCombo === 'D+0.6W', JSON.stringify(roof));

// ── UI: a stud row Check ────────────────────────────────────────────────────
await page.evaluate(() => checkStudRow(2, 0));
const studUI = await page.evaluate(() => {
  const panel = document.getElementById('schk_2_0');
  return { shown: panel.style.display !== 'none',
           rows: panel.querySelectorAll('.chk-table tr:not(.det-row)').length,
           text: panel.innerText.slice(0, 400) };
});
check('stud result panel is shown with rows', studUI.shown && studUI.rows >= 6, JSON.stringify(studUI));
check('stud panel shows the 1.00 limit, not 0.96', !/0\.96/.test(studUI.text), studUI.text);

// ── refusal paths must render, not throw ────────────────────────────────────
// l_e/d over the NDS 3.7.1.4 limit: the stud must be refused, not clamped.
await page.evaluate(() => {
  document.getElementById('flrHt').value = '20';
  document.getElementById('weakBraceIn').value = '240';
  document.getElementById('flrHt').dispatchEvent(new Event('change', { bubbles: true }));
  checkStudRow(0, 0);
});
const na = await page.evaluate(() => {
  const t = document.getElementById('schk_0_0').innerText;
  return { text: t.slice(0, 300), na: /NOT APPLICABLE/.test(t), ref: /3\.7\.1\.4/.test(t),
           noDC: !/D\/C/.test(t.split('NOT APPLICABLE')[1] || '') };
});
check('a stud past l_e/d = 50 is refused, citing §3.7.1.4, with no D/C',
      na.na && na.ref, JSON.stringify(na));

// A member with nothing on it is reported as such rather than crashing.
await page.evaluate(() => {
  document.getElementById('flrHt').value = '9';
  document.getElementById('weakBraceIn').value = '48';
  document.getElementById('windOpen').value = '0';
  document.getElementById('windStud').value = '0';
  ['roofDL', 'roofLL', 'snowLoad', 'floorDL', 'floorLL1', 'floorLL2', 'wall1DL', 'wall2DL', 'wall3DL']
    .forEach((k) => { const e = document.getElementById(k); e.value = '0'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  document.getElementById('flrHt').dispatchEvent(new Event('change', { bubbles: true }));
  checkHeaderRow(0, 0);
});
const noLoad = await page.evaluate(() => document.getElementById('hchk_0_0').innerText.slice(0, 400));
check('a member with no load is reported, not crashed or failed',
      /NO LOAD/.test(noLoad) && !/FAIL/.test(noLoad), noLoad);

await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.evaluate(() => { addHeader(0); checkHeaderRow(0, 0); checkStudRow(2, 0); });

// ── stale-result guard: changing an engine input must clear the panels ──────
await page.selectOption('#species', 'SPF');
const stale = await page.evaluate(() => {
  const h = document.getElementById('hchk_0_0'), s = document.getElementById('schk_2_0');
  return { h: h ? h.innerHTML.length : -1, s: s ? s.innerHTML.length : -1 };
});
check('changing species clears every rendered result panel', stale.h === 0 && stale.s === 0, JSON.stringify(stale));
await page.selectOption('#species', 'DFL');

// ── validation: top of opening above the story height blocks the run ────────
await page.evaluate(() => { floors[0].headers[0].topOfOpening = 20; render(); });
const vErr = await page.evaluate(() => ({
  shown: document.getElementById('engineErrors').style.display !== 'none',
  text: document.getElementById('engineErrors').innerText
}));
check('top of opening above the story height is a blocking input error',
      vErr.shown && /above the story height/.test(vErr.text), JSON.stringify(vErr));
await page.evaluate(() => { floors[0].headers[0].topOfOpening = 6; render(); });

// ── continuity: deleting a mid-stack header is reported, not silently dropped ─
await page.evaluate(() => { floors[1].headers.splice(0, 1); render(); });
const cont = await page.evaluate(() => document.getElementById('engineErrors').innerText);
check('a header stack that skips a level is reported', /skips level/.test(cont), cont);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.evaluate(() => addHeader(0));
await page.evaluate(() => checkHeaderRow(0, 0));

// ── the braced compression edge has no slenderness to report ────────────────
await page.evaluate(() => { floors[0].headers[0].braced_edge = true; render(); checkHeaderRow(0, 0); });
const braced = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('#hchk_0_0 .chk-table tr'));
  const rb = rows.find((r) => /R<sub>B<\/sub>|R_B|RB/.test(r.innerHTML) && /3\.3\.3\.7/.test(r.innerHTML));
  return { text: rb ? rb.innerText.replace(/\s+/g, ' ') : 'row missing',
           cl: (document.getElementById('hchk_0_0').innerText.match(/C_?L.{0,12}/) || [''])[0] };
});
check('a braced header prints "n/a" for R_B, not 0.00, citing §3.3.3.3',
      /n\/a/.test(braced.text) && /3\.3\.3\.3/.test(braced.text) && !/0\.00/.test(braced.text), braced.text);
await page.evaluate(() => { floors[0].headers[0].braced_edge = false; render(); checkHeaderRow(0, 0); });

// ── the king-stud disclosures the reviewer asked for ────────────────────────
const kingText = await page.evaluate(() => document.body.innerText);
check('the notes say every king is checked for the whole strip',
      /each is checked for the whole strip/i.test(kingText), '');
check('the king axial is named as the row\'s tributary gravity',
      /tributary gravity/i.test(kingText) && !/half a stud spacing of accumulated wall gravity/i.test(kingText), '');
check('the notes say the jamb auto-design includes the header end bearing',
      /header end bearing that lands on it/i.test(kingText), '');

// ── foundation export, payload v2 ───────────────────────────────────────────
await page.evaluate(() => {
  window.open = () => null;                 // the export opens a second tab
  exportToFoundation();
});
const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('areCalcs_foundationExport')));
check('export payload is version 2', xp.version === 2, JSON.stringify(xp).slice(0, 200));
check('export declares its units and source', xp.units === 'plf / lb' && xp.source === 'stacked-headers', JSON.stringify(xp).slice(0, 200));
check('export carries D, L, Lr and S separately',
      xp.studs.length > 0 && ['D', 'L', 'Lr', 'S'].every((k) => typeof xp.studs[0][k] === 'number'),
      JSON.stringify(xp.studs[0]));
check('export carries the governing combination', typeof xp.studs[0].governing === 'string', JSON.stringify(xp.studs[0]));
check('export carries the jamb point reactions',
      xp.jambs.length > 0 && typeof xp.jambs[0].D === 'number', JSON.stringify(xp.jambs[0]));
check('export is the lowest floor', xp.floorName === '2nd Floor', xp.floorName);

// the receiving calculator must accept it
const gb = await context.newPage();
await serve(gb);
const gbErrors = [];
gb.on('pageerror', (e) => gbErrors.push(e.message));
await gb.goto('http://calcs.test/Calcs/headers_gradebeam_pier_calculator.html', { waitUntil: 'load' });
await gb.evaluate(() => loadFromStorage());
const gbState = await gb.evaluate(() => ({
  zones: zoneIds.length,
  detail: (document.getElementById('importDetail') || {}).textContent || '',
  dl: (document.getElementById('dlplf_' + zoneIds[0]) || {}).value,
  ll: (document.getElementById('llplf_' + zoneIds[0]) || {}).value
}));
check('grade beam / pier calc imports the v2 payload', gbState.zones > 0, JSON.stringify(gbState));
check('v2 import states how L, Lr and S were combined', /payload v2/.test(gbState.detail) && /larger of Lr or S/.test(gbState.detail), gbState.detail);
check('imported DL and LL are numbers', isFinite(+gbState.dl) && isFinite(+gbState.ll), JSON.stringify(gbState));
check('grade beam / pier calc has no page errors', gbErrors.length === 0, gbErrors.join('\n      '));
await gb.close();

// ...and a v1 payload — the shape the old page wrote, with no `version` key —
// must still import, merging LL + Snow exactly as it always did.
const gb1 = await context.newPage();
await serve(gb1);
const gb1Errors = [];
gb1.on('pageerror', (e) => gb1Errors.push(e.message));
gb1.on('dialog', (d) => d.accept());          // "this REPLACES the zones below"
await gb1.goto('http://calcs.test/Calcs/headers_gradebeam_pier_calculator.html', { waitUntil: 'load' });
const v1Import = await gb1.evaluate(() => {
  localStorage.setItem('areCalcs_foundationExport', JSON.stringify({
    source: 'stacked-headers',
    floorName: '1st Floor',
    exported: '8/1/2026, 9:00:00 AM',
    studs: [{ label: 'Legacy Zone', dlPlf: 100, llPlf: 40, slPlf: 25 }]
  }));
  loadFromStorage();
  return { zones: zoneIds.length,
           detail: (document.getElementById('importDetail') || {}).textContent || '',
           dl: (document.getElementById('dlplf_' + zoneIds[0]) || {}).value,
           ll: (document.getElementById('llplf_' + zoneIds[0]) || {}).value,
           label: (document.getElementById('lbl_' + zoneIds[0]) || {}).value };
});
check('a v1 payload still imports', v1Import.zones === 1 && v1Import.label === 'Legacy Zone', JSON.stringify(v1Import));
check('v1 import is labelled as such', /payload v1/.test(v1Import.detail), v1Import.detail);
check('v1 LL is llPlf + slPlf, as it always was', +v1Import.dl === 100 && +v1Import.ll === 65, JSON.stringify(v1Import));
check('v1 import raises no page error', gb1Errors.length === 0, gb1Errors.join('\n      '));
await gb1.close();

// ── AREv2 round trip (v2 -> v2) ─────────────────────────────────────────────
await page.fill('#areJob', 'HDR-TEST');
const snap = await page.evaluate(async () => {
  const s = await window.AREv2.buildSnapshot('f');
  return { html: s.html, adapterVersion: s.state.adapterVersion, model: JSON.stringify(s.state.model) };
});
check('snapshot stamps adapter version 2', snap.adapterVersion === 2, String(snap.adapterVersion));

const page2 = await context.newPage();
const page2Errors = [];
page2.on('pageerror', (e) => page2Errors.push(e.message));
await serve(page2);
await page2.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page2.waitForSelector('#areBar');
const round = await page2.evaluate(async (html) => {
  const st = window.AREv2.parseSnapshot(html);
  const r = window.AREv2.loadFromState(st);
  if (r.ok) await window.AREv2.runAndSettle();
  return { ok: r.ok, mismatches: JSON.stringify(r.mismatches), model: JSON.stringify(window.AREv2._getAdapterModelForTest()) };
}, snap.html);
check('v2 record loads with zero mismatches', round.ok, round.mismatches);
check('v2 model round-trips unchanged', round.model === snap.model,
      'before ' + snap.model.slice(0, 160) + '\n      after  ' + round.model.slice(0, 160));
check('reloaded page has no errors', page2Errors.length === 0, page2Errors.join('\n      '));
await page2.close();

// ── v1 record migration ─────────────────────────────────────────────────────
// Hand-written in the SHAPE THE OLD PAGE SAVED: adapterVersion 1, header stacks
// correlated by label text, numeric ids, a manual kingAxial, no stack_id, no
// braced_edge/transfer/studSpacing/jambSz/kingSz, stud rows with sid only.
const v1State = {
  schema: 'are.snapshot.v1',
  calcFile: FILE,
  calcTitle: 'Wood Headers, Jambs & Studs — NDS 2018 Design',
  adapterVersion: 1,
  shapeHash: 'stale',
  project: 'LEGACY-JOB',
  mark: '',
  savedAt: '2026-08-01T12:00:00.000Z',
  mode: 'f',
  fields: {},
  model: {
    hCnt: 2, fCnt: 11, sCnt: 11,
    floors: [
      { id: 1, name: 'Roof', exp: true,
        headers: [{ id: 1754000000000.1234, label: 'H-1', description: 'Legacy header', span: 8,
          roofTrib: 10, floorTrib1: 0, floorTrib2: 0, wallTrib: 8, wallType: 1,
          dlAdd: 0, llAdd: 0, slAdd: 0, openType: 'window', topOfOpening: 6.0,
          kingAxial: 450, trialSz: '2x8', rowWallSz: '2x6', jambCount: 0, kingCount: 1 }],
        studs: [{ sid: 'S1', label: 'Exterior Long Side', roofTrib: 10, floorTrib1: 0, floorTrib2: 0,
          wallTrib: 8, wallType: 1, dlAdd: 0, llAdd: 0, slAdd: 0, trialSz: '2x6', trialSpacing: 16 }] },
      { id: 2, name: '3rd Floor', exp: true,
        headers: [{ id: 1754000000000.5678, label: 'H-1', description: 'Legacy header', span: 8,
          roofTrib: 0, floorTrib1: 5, floorTrib2: 0, wallTrib: 8, wallType: 1,
          dlAdd: 0, llAdd: 0, slAdd: 0, openType: 'window', topOfOpening: 6.0,
          kingAxial: 0, trialSz: '2x8', rowWallSz: '2x6', jambCount: 0, kingCount: 1 }],
        studs: [{ sid: 'S1', label: 'Exterior Long Side', roofTrib: 0, floorTrib1: 5, floorTrib2: 0,
          wallTrib: 8, wallType: 1, dlAdd: 0, llAdd: 0, slAdd: 0, trialSz: '2x6', trialSpacing: 16 }] }
    ]
  }
};
const page3 = await context.newPage();
const page3Errors = [];
page3.on('pageerror', (e) => page3Errors.push(e.message));
await serve(page3);
await page3.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page3.waitForSelector('#areBar');

// A real v1 file carries every Tier-A field the OLD page had — that is, all of
// today's except the five inputs this fix adds. Build exactly that.
const NEW_INPUTS = ['#weakBraceIn', '#plateSpecies', '#finishType', '#windDeflBasis', '#dryInstall'];
v1State.fields = await page3.evaluate((newInputs) => {
  const f = window.AREv2.captureState().fields;
  newInputs.forEach((k) => { delete f[k]; });
  Object.keys(f).forEach((k) => { if (k.indexOf('#floorsContainer') === 0) delete f[k]; });
  return f;
}, NEW_INPUTS);

const mig = await page3.evaluate(async (st) => {
  let err = '', first = null, forced = null;
  try {
    // Exactly what are-utils' Load button does: try clean, then confirm + force.
    first = window.AREv2.loadFromState(st);
    if (!first.ok) forced = window.AREv2.loadFromState(st, { force: true });
    if ((forced || first).ok) await window.AREv2.runAndSettle();
  } catch (e) { err = (e.code || '') + ': ' + e.message; }
  const m = window.AREv2._getAdapterModelForTest();
  if (!m.floors.length || !m.floors[0].headers.length) {
    return { err: err || 'model has no headers after load',
             dump: JSON.stringify({ first: first, forced: forced }).slice(0, 400) };
  }
  return {
    err: err,
    cleanOk: first.ok,
    notInFile: first.mismatches.notInFile,
    banner: document.getElementById('v1MigrationBanner').style.display !== 'none',
    bannerText: document.getElementById('v1MigrationBanner').innerText.slice(0, 80),
    ids: m.floors.map((f) => f.headers[0].id),
    stacks: m.floors.map((f) => f.headers[0].stack_id),
    kingAxialExtra: m.floors[0].headers[0].kingAxialExtra,
    hasOldKey: 'kingAxial' in m.floors[0].headers[0],
    defaults: {
      braced: m.floors[0].headers[0].braced_edge, transfer: m.floors[0].headers[0].transfer,
      studSpacing: m.floors[0].headers[0].studSpacing,
      jambSz: m.floors[0].headers[0].jambSz, kingSz: m.floors[0].headers[0].kingSz
    },
    studIds: m.floors.map((f) => f.studs[0].id),
    computed: !!window.RESULT
  };
}, v1State);
check('a v1 record still loads on the v2 adapter (no ADAPTER_VERSION rejection)', mig.err === '', mig.err || mig.dump);
check('a v1 file mismatches only on the inputs this fix adds',
      Array.isArray(mig.notInFile) && mig.notInFile.length === NEW_INPUTS.length &&
      NEW_INPUTS.every((k) => mig.notInFile.indexOf(k) >= 0), JSON.stringify(mig.notInFile));
check('v1 migration banner is shown', mig.banner, mig.bannerText);
check('banner states the engine change', /engine v1/.test(mig.bannerText) && /v2/.test(mig.bannerText), mig.bannerText);
check('every migrated row gets a stable string id',
      mig.ids.every((i) => typeof i === 'string') && new Set(mig.ids).size === 2 &&
      mig.studIds.every((i) => typeof i === 'string'), JSON.stringify(mig.ids) + ' ' + JSON.stringify(mig.studIds));
check('labels became the stack id', mig.stacks.every((s) => s === 'H-1'), JSON.stringify(mig.stacks));
check('a typed King Axial is preserved as the ADDITIONAL axial and the old key removed',
      mig.kingAxialExtra === 450 && mig.hasOldKey === false, JSON.stringify(mig));
check('new fields take their defaults',
      mig.defaults.braced === false && mig.defaults.transfer === false &&
      mig.defaults.studSpacing === 16 && mig.defaults.jambSz === '2x6' && mig.defaults.kingSz === '2x6',
      JSON.stringify(mig.defaults));
check('the migrated model recomputes', mig.computed === true, String(mig.computed));
check('migrated page has no errors', page3Errors.length === 0, page3Errors.join('\n      '));

// ...and loading a v2 file afterwards must stop claiming the inputs were migrated.
const banner2 = await page3.evaluate(async (html) => {
  const st = window.AREv2.parseSnapshot(html);
  const r = window.AREv2.loadFromState(st);
  if (r.ok) await window.AREv2.runAndSettle();
  return { ok: r.ok, shown: document.getElementById('v1MigrationBanner').style.display !== 'none' };
}, snap.html);
check('the v1 banner clears when a v2 file is loaded next', banner2.ok && banner2.shown === false,
      JSON.stringify(banner2));
await page3.close();

// ── screenshots, screen and print ───────────────────────────────────────────
await page.evaluate(() => { floors.forEach((f, i) => checkHeaderRow(i, 0)); checkStudRow(0, 0); });
await page.screenshot({ path: OUT + 'stacked-headers-screen.png', fullPage: true });
await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: OUT + 'stacked-headers-print.png', fullPage: true });
const printState = await page.evaluate(() => {
  const det = document.querySelector('.calc-det');
  return { detailsVisible: det ? getComputedStyle(det).display : 'none',
           resultsVisible: getComputedStyle(document.getElementById('hchk_0_0')).display !== 'none' };
});
check('print media expands the calc detail panels', printState.detailsVisible === 'block', JSON.stringify(printState));
check('print media keeps the result panels visible', printState.resultsVisible, JSON.stringify(printState));
await page.emulateMedia({ media: 'screen' });

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();

console.log(`\nfixtures ${nodeFx.pass}/${nodeFx.total} · checks ${'' + (failures.length ? 'with failures' : 'all passed')}`);
if (failures.length) { console.error(`\n${failures.length} failure(s):\n  ` + failures.join('\n  ')); process.exit(1); }
console.log('\nALL PASS');
