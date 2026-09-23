// =============================================================================
// Flange-plated moment connection to HSS column — engine + wiring test
// -----------------------------------------------------------------------------
// Runs the in-page fixture set (window.FPHSS.runFixtures: Design Example II.B-2,
// DG24 Example 4.3 and hand calcs, spec §6) in headless Chromium with every
// request fulfilled from public/ on disk, then drives the DOM (defaults =
// Example II.B-2 beam side on an HSS10x10x1/2) to prove the UI is wired to the
// engine, and cycles the mode-changing inputs for page errors.
// Usage: node tools/test-flange-plated-hss.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'flange_plated_HSS_column_moment_connection_calculator.html';

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
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// ── engine fixtures ──────────────────────────────────────────────────────────
const fx = await page.evaluate(() => window.FPHSS.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// ── UI wiring: defaults ──────────────────────────────────────────────────────
await page.click('button.calc-btn');
const ui = await page.evaluate(() => ({
  banner: document.getElementById('sumOut').textContent,
  rows: document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length,
  sections: document.querySelectorAll('#chkTb tr.sect-row').length,
  results: document.getElementById('results').classList.contains('show'),
  svg: document.getElementById('schemSvg').children.length,
  cards: document.querySelectorAll('#demOut .dem-card').length,
  bottomEndWeldDisabled: document.getElementById('endWeldB').disabled,
  topEndWeldDisabled: document.getElementById('endWeldT').disabled,
}));
check('results shown after Run', ui.results === true, JSON.stringify(ui));
check('check table has 4 sections', ui.sections === 4, 'sections=' + ui.sections);
check('check table has rows', ui.rows >= 28, 'rows=' + ui.rows);
check('demand cards rendered', ui.cards >= 8, 'cards=' + ui.cards);
check('schematic drawn', ui.svg > 10, 'children=' + ui.svg);
check('bottom end-weld disabled (plate wider than flange)', ui.bottomEndWeldDisabled === true, JSON.stringify(ui));
check('top end-weld enabled (plate on flange)', ui.topEndWeldDisabled === false, JSON.stringify(ui));

// UI values match the engine for the same inputs
const same = await page.evaluate(() => {
  const inp = readInputs(); const res = window.FPHSS.compute(inp);
  const txt = document.getElementById('sumOut').textContent;
  return { ok: res.ok, maxDC: res.maxDC, inText: txt.includes(res.maxDC.toFixed(3)) };
});
check('banner reports the engine max D/C', same.ok && same.inText, JSON.stringify(same));

// live re-run: editing an input after a run updates the banner without a click
await page.fill('#Mu', '150');
await page.waitForTimeout(400);
const live = await page.evaluate(() => document.getElementById('sumOut').textContent.includes('150.0 kip-ft'));
check('inputs re-run live after the first run', live, 'banner did not follow Mu edit');
await page.fill('#Mu', '252');
await page.waitForTimeout(400);

// error path: plate wider than the column
await page.fill('#BpT', '11');
await page.waitForTimeout(400);
const err = await page.evaluate(() => ({
  err: document.getElementById('errOut').textContent,
  shown: document.getElementById('results').classList.contains('show'),
}));
check('error box for plate wider than column', err.err.includes('wider than the column') && !err.shown, JSON.stringify(err));
await page.fill('#BpT', '6');
await page.waitForTimeout(400);

// ── every mode renders without a page error ─────────────────────────────────
for (const connType of ['T', 'X']) for (const dir of [true, false]) {
  await page.selectOption('#connType', connType);
  const cb = await page.$('#dirCol');
  if ((await cb.isChecked()) !== dir) await cb.click();
  await page.click('button.calc-btn');
  const ok = await page.evaluate(() => document.getElementById('results').classList.contains('show'));
  check(`mode ${connType}/${dir ? 'dir' : 'nodir'} renders`, ok, 'results not shown');
}
// section selects drive the fields
await page.selectOption('#hsec', 'HSS10X10X3/8');
await page.selectOption('#wsec', 'W16X57');
await page.click('button.calc-btn');
const sel = await page.evaluate(() => ({ B: document.getElementById('cB').value, t: document.getElementById('ct').value, d: document.getElementById('bd').value, shown: document.getElementById('results').classList.contains('show') }));
check('HSS select fills B and t', sel.B === '10' && sel.t === '0.349', JSON.stringify(sel));
check('W select fills d', sel.d === '16.4' && sel.shown, JSON.stringify(sel));

// ── selftest URL ────────────────────────────────────────────────────────────
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASS');
