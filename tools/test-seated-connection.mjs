// =============================================================================
// Seated beam connection calculator — engine + wiring test
// -----------------------------------------------------------------------------
// Runs the in-page fixture set (window.SEAT.runFixtures: AISC Design Examples
// II.A-12A/13/14/15/16/22/23 and PCI Ex. 6.6.7.1, spec §9) in headless Chromium
// with every request fulfilled from public/ on disk, then drives the DOM once
// (defaults = Design Example II.A-14) to prove the UI is wired to the engine.
// Usage: node tools/test-seated-connection.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'seated_beam_connection_calculator.html';

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
const fx = await page.evaluate(() => window.SEAT.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// ── UI wiring: defaults (II.A-14 stiffened, welded) ──────────────────────────
await page.click('button.calc-btn');
const ui = await page.evaluate(() => ({
  banner: document.getElementById('sumOut').textContent,
  rows: document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length,
  lbmin: document.querySelector('#chkTb tr td')?.textContent,
  results: document.getElementById('results').classList.contains('show'),
  svg: document.getElementById('schemSvg').children.length,
}));
check('results shown after Run', ui.results === true, JSON.stringify(ui));
check('check table has rows', ui.rows >= 8, 'rows=' + ui.rows);
check('schematic drawn', ui.svg > 5, 'children=' + ui.svg);

// ── every mode renders without a page error ─────────────────────────────────
for (const seatType of ['angle', 'rect', 'tri']) for (const attach of ['welded', 'bolted']) {
  await page.selectOption('#seatType', seatType);
  await page.selectOption('#attach', attach);
  await page.click('button.calc-btn');
  const n = await page.evaluate(() => document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length);
  check(`mode ${seatType}/${attach} renders rows`, n >= 6, 'rows=' + n);
}

// ── mark binding ──────────────────────────────────────────────────────────────
await page.fill('#areMark', 'SEAT-1');
await page.waitForTimeout(400);
const svgText = await page.evaluate(() => document.getElementById('schemSvg').textContent);
check('mark appears in schematic', svgText.includes('SEAT-1'), svgText.slice(0, 120));

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
