// =============================================================================
// W-beam directly welded to HSS column — engine + wiring test
// Runs window.DWHSS.runFixtures() (DG24 Ex 4.3, SEU 2014, STI 2025, handoff
// 6-in cases) in headless Chromium with every request served from public/,
// then drives the DOM and the ?selftest=1 path.  Usage: node tools/test-w-to-hss.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'W_beam_to_HSS_column_calculator.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
// Dialogs are failures except inside the legacy-record load test, which sets
// acceptDialogs to collect and accept the mismatch confirm.
let acceptDialogs = null;
page.on('dialog', (d) => {
  if (acceptDialogs) { acceptDialogs.push(d.message()); d.accept(); return; }
  pageErrors.push('DIALOG: ' + d.message()); d.dismiss();
});
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// ── engine fixtures ──────────────────────────────────────────────────────────
const fx = await page.evaluate(() => window.DWHSS.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// UI wiring checks are appended in Task 2 below this line.
// ── UI wiring: defaults = DG24 Ex 4.3 / 26-003 record, 360-22 mode, CJP ──────
await page.click('button.calc-btn');
const ui = await page.evaluate(() => ({
  banner: document.getElementById('sumOut').textContent,
  rows: document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length,
  sections: document.querySelectorAll('#chkTb tr.sect-row').length,
  results: document.getElementById('results').classList.contains('show'),
  svg: document.getElementById('schemSvg').querySelectorAll('*').length,   // AREDraw nests shapes in 4 layer groups
  cards: document.querySelectorAll('#demOut .dem-card').length,
}));
check('results shown after Run', ui.results === true, JSON.stringify(ui));
check('check table has 5 sections', ui.sections === 5, 'sections=' + ui.sections);
check('check table has rows', ui.rows >= 14, 'rows=' + ui.rows);
check('demand cards rendered', ui.cards >= 7, 'cards=' + ui.cards);
check('schematic drawn', ui.svg > 10, 'children=' + ui.svg);
check('banner is PASS on the defaults', /PASS/.test(ui.banner), ui.banner);
check('banner never says All Checks Pass', !/All Checks Pass/i.test(ui.banner), ui.banner);
const same = await page.evaluate(() => { const res = window.DWHSS.compute(readInputs()); return { ok: res.ok, maxDC: res.maxDC, inText: document.getElementById('sumOut').textContent.includes(res.maxDC.toFixed(3)), phiMn: res.vals.phiMn }; });
check('banner reports the engine max D/C', same.ok && same.inText, JSON.stringify(same));
check('default phiMn is 83.3 kip-ft (360-22 phi 0.90)', Math.abs(same.phiMn - 83.27) < 0.05, String(same.phiMn));
check('banner names the governing flange', ui.banner.includes('local yielding (uneven load distribution) \u2014 tension flange'), ui.banner);
const capTxt = await page.evaluate(() => document.getElementById('chkTb').textContent);
check('CAP row names the governing flange', /governed by Beam flange local yielding[^]*tension flange/.test(capTxt), capTxt.slice(-400));
const fr = await page.evaluate(() => [0.3125, 0.25, 0.75, 1, 1.25, 1.5625, 0.66].map((w) => window.DWHSS.frac16(w)));
check('DWHSS.frac16 formats sixteenths incl. >= 1 in', JSON.stringify(fr) === JSON.stringify(['5/16', '1/4', '3/4', '1', '1-1/4', '1-9/16', '0.660']), JSON.stringify(fr));
// legacy mode reproduces the 26-003 record
await page.selectOption('#code', 'dg24-1');
await page.waitForTimeout(400);
const leg = await page.evaluate(() => window.DWHSS.compute(readInputs()).vals.phiMn);
check('legacy mode phiMn 87.94', Math.abs(leg - 87.94) < 0.05, String(leg));
await page.selectOption('#code', '360-22');
// live re-run
await page.fill('#Mu', '150');
await page.waitForTimeout(400);
const live = await page.evaluate(() => document.getElementById('sumOut').textContent.includes('150.0 kip-ft'));
check('inputs re-run live after the first run', live, 'banner did not follow Mu edit');
await page.fill('#Mu', '60');
// fillet mode shows weld rows; kds disabled with one face
await page.selectOption('#weldType', 'fillet');
await page.waitForTimeout(400);
const wf = await page.evaluate(() => ({ shown: !!document.querySelector('#chkTb td') && document.getElementById('chkTb').textContent.includes('fillet welds'), kdsDisabled: document.getElementById('kds').disabled, wDisabled: document.getElementById('weldW').disabled }));
check('fillet rows render', wf.shown, JSON.stringify(wf));
check('kds disabled with one face', wf.kdsDisabled === true, JSON.stringify(wf));
await page.selectOption('#weldFaces', '2');
await page.waitForTimeout(300);
check('kds enabled with two faces', await page.evaluate(() => !document.getElementById('kds').disabled), 'kds still disabled');
await page.check('#kds');
await page.selectOption('#weldFaces', '1');
await page.waitForTimeout(300);
const kd = await page.evaluate(() => ({ dis: document.getElementById('kds').disabled, chk: document.getElementById('kds').checked }));
check('kds unchecked when it becomes disabled (one face)', kd.dis && !kd.chk, JSON.stringify(kd));
await page.selectOption('#weldFaces', '2'); await page.check('#kds');
await page.selectOption('#weldType', 'cjp');
await page.waitForTimeout(300);
const kc = await page.evaluate(() => document.getElementById('kds').checked);
check('kds unchecked when CJP is selected', kc === false, 'kds still checked under CJP');
await page.selectOption('#weldType', 'fillet'); await page.selectOption('#weldFaces', '1');
await page.selectOption('#weldType', 'cjp');
// custom sections
await page.selectOption('#hsec', 'custom');
await page.fill('#cB', '6'); await page.fill('#cH', '6'); await page.fill('#ct', '0.465'); await page.fill('#cA', '9.74'); await page.fill('#cS', '16.1');
await page.selectOption('#wsec', 'custom');
await page.fill('#bd', '12'); await page.fill('#bbf', '5.5'); await page.fill('#btf', '0.5'); await page.fill('#btw', '0.3'); await page.fill('#bZx', '40');
await page.click('button.calc-btn');
const geo = await page.evaluate(() => ({ txt: document.getElementById('geoOut').textContent, banner: document.getElementById('sumOut').textContent }));
check('corner classification callout', /corner/i.test(geo.txt) && /0\.44[78]/.test(geo.txt), geo.txt);
check('banner REVIEW for corner case', /REVIEW/.test(geo.banner), geo.banner);
// error path
await page.fill('#cB', '1');
await page.waitForTimeout(400);
const err = await page.evaluate(() => ({ err: document.getElementById('errOut').textContent, shown: document.getElementById('results').classList.contains('show') }));
check('error box for B <= 3t', err.err.includes('exceed 3t') && !err.shown, JSON.stringify(err));
// section selects fill fields
await page.selectOption('#hsec', 'HSS10X10X1/2');
await page.selectOption('#wsec', 'W16X57');
await page.click('button.calc-btn');
const sel = await page.evaluate(() => ({ B: document.getElementById('cB').value, t: document.getElementById('ct').value, d: document.getElementById('bd').value, shown: document.getElementById('results').classList.contains('show') }));
check('HSS select fills B and t', sel.B === '10' && sel.t === '0.465', JSON.stringify(sel));
check('W select fills d', sel.d === '16.4' && sel.shown, JSON.stringify(sel));
// every mode renders
for (const connType of ['T', 'X']) for (const code of ['360-22', 'dg24-1']) {
  await page.selectOption('#connType', connType); await page.selectOption('#code', code);
  await page.click('button.calc-btn');
  const ok = await page.evaluate(() => document.getElementById('results').classList.contains('show'));
  check(`mode ${connType}/${code} renders`, ok, 'results not shown');
}
// legacy record field ids still exist (26-003 snapshot hydrates)
const ids = await page.evaluate(() => ['wsec','Fyb','hsec','Fy','Mu'].every((id) => !!document.getElementById(id)));
check('legacy snapshot field ids present', ids, 'missing one of #wsec #Fyb #hsec #Fy #Mu');
// selftest URL
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);

// ── schematic reflects geometry ─────────────────────────────────────────────
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.click('button.calc-btn');
const svgTxt = await page.evaluate(() => document.getElementById('schemSvg').textContent);
check('schematic caption no longer cites Eq. K1-7', !/K1-7/.test(svgTxt), svgTxt.slice(0, 200));
check('schematic shows the flat width', /B\s*[−-]\s*3t/.test(svgTxt), svgTxt.slice(0, 300));
check('schematic weld label follows input (CJP)', /CJP/.test(svgTxt), svgTxt.slice(0, 300));

// ── legacy 26-003 record: the real toolbar Load path (file chooser + mismatch confirm) ──
// showOpenFilePicker is removed so areLoad() takes its <input type=file>
// fallback, which Playwright's filechooser event can feed; the confirm is
// accepted (= "Load anyway"). Record copied verbatim from Technical Resources/Steel/Reference.
const LEGACY = fileURLToPath(new URL('./fixtures/26-003-KAALO-w-to-hss-legacy-2026-09-23.html', import.meta.url));
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.evaluate(() => { try { delete window.showOpenFilePicker; } catch (e) {} if ('showOpenFilePicker' in window) window.showOpenFilePicker = undefined; });
acceptDialogs = [];
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#areLoadBtn')]);
await chooser.setFiles(LEGACY);
await page.waitForFunction(() => document.getElementById('results').classList.contains('show'), null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(300);
const dlg = acceptDialogs; acceptDialogs = null;
check('legacy load shows exactly one mismatch confirm', dlg.length === 1, JSON.stringify(dlg));
check('mismatch confirm lists the new fields and carries the load hint', dlg.length === 1 && /not in the file/.test(dlg[0]) && /carry only the sections, Fy, Fyb and Mu/.test(dlg[0]), dlg[0] || '');
const lg = await page.evaluate(() => ({ w: document.getElementById('wsec').value, h: document.getElementById('hsec').value, mu: document.getElementById('Mu').value, fy: document.getElementById('Fy').value, fyb: document.getElementById('Fyb').value,
  bf: document.getElementById('bbf').value, t: document.getElementById('ct').value, code: document.getElementById('code').value, banner: document.getElementById('sumOut').textContent }));
check('legacy record hydrates W16X57 / HSS10X10X1/2 / Mu 60 / Fy 46 / Fyb 50', lg.w === 'W16X57' && lg.h === 'HSS10X10X1/2' && +lg.mu === 60 && +lg.fy === 46 && +lg.fyb === 50 && lg.bf === '7.12' && lg.t === '0.465', JSON.stringify(lg));
check('legacy record runs in 360-22 mode: banner 83.3 kip-ft', lg.code === '360-22' && /83\.3 kip-ft/.test(lg.banner), lg.banner);
await page.selectOption('#code', 'dg24-1');
await page.waitForTimeout(500);
const lg2 = await page.evaluate(() => ({ phiMn: window.DWHSS.compute(readInputs()).vals.phiMn, banner: document.getElementById('sumOut').textContent }));
check('legacy record in legacy code mode: phiMn 87.94, banner 87.9', Math.abs(lg2.phiMn - 87.94) < 0.005 && /87\.9 kip-ft/.test(lg2.banner), JSON.stringify(lg2));

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASS');
