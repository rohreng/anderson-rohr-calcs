// =============================================================================
// Dowelled embed plate (tension dowels in grouted CMU) — engine + wiring test
// Runs window.MDEP.runFixtures() (MDG 2022 REK-09 ASD/SD, REK-10, Ex 9.2-1,
// Eq. 6-2 tiers, AISC 360-22 §J2 bar-to-plate weld cases) in headless Chromium
// with every request served from public/, then the DOM and the ?selftest=1 path.
// Usage: node tools/test-dowelled-embed-plate.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'masonry_dowelled_embed_plate_calculator.html';

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

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
async function finish() {
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
  await browser.close();
  if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
  console.log('\nALL PASS');
  process.exit(0);
}

const resp = await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
check('calc page served', resp && resp.status() === 200, 'status ' + (resp && resp.status()) + ' for public/Calcs/' + FILE);
if (!resp || resp.status() !== 200) await finish();
await page.waitForSelector('#areBar');

// ── engine fixtures ──────────────────────────────────────────────────────────
const fx = await page.evaluate(() => window.MDEP.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));
check('fixture assertion count >= 198', fx.total >= 198, 'total=' + fx.total);
const ids = await page.evaluate(() => window.MDEP.FIXTURES.map((f) => f.id));
const empty = ids.filter((id) => !(fx.counts && fx.counts[id] >= 1));
check('every fixture returned at least one assertion', empty.length === 0, 'no assertions: ' + empty.join(', '));
const SPEC_IDS = ['rek09-asd', 'rek09-sd', 'rek10-single', 'min12', 'epoxy', 'gamma13', 'gamma15', 'gr40', 'short-embed', 'nofit', 'mdg-ex9.2-1',
  'weld-fillet-asd', 'weld-fillet-sd', 'weld-flare-noteA', 'weld-flare-gmaw', 'weld-flare-smaw6', 'weld-thin-plate', 'weld-undersize'];
check('every spec §5 fixture id present', SPEC_IDS.every((id) => ids.includes(id)), 'missing: ' + SPEC_IDS.filter((id) => !ids.includes(id)).join(', '));
const order = await page.evaluate(() => window.MDEP.compute(window.MDEP.BASE).checks.map((c) => c.id).join(','));
check('check rows in spec §4.2 order', order === 'tens,dev,kfac,spc,grt,fit,wmet,wbm,wmin,wdev,wreq,tie', order);

// ── UI wiring [pending Task 3: input blocks, Run, results table] ─────────────
// Task 3 replaces this block with the plan's Task 3 Step 3 checks.
const hasRun = await page.$('button.calc-btn');
check('UI wiring [pending Task 3]: Run button present', !!hasRun, 'no button.calc-btn yet (UI stub)');

// ── selftest URL ─────────────────────────────────────────────────────────────
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);

await finish();
