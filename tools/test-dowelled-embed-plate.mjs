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
check('fixture assertion count >= 242', fx.total >= 242, 'total=' + fx.total);
const ids = await page.evaluate(() => window.MDEP.FIXTURES.map((f) => f.id));
const empty = ids.filter((id) => !(fx.counts && fx.counts[id] >= 1));
check('every fixture returned at least one assertion', empty.length === 0, 'no assertions: ' + empty.join(', '));
const SPEC_IDS = ['rek09-asd', 'rek09-sd', 'rek10-single', 'min12', 'epoxy', 'gamma13', 'gamma15', 'gr40', 'short-embed', 'nofit', 'mdg-ex9.2-1',
  'weld-fillet-asd', 'weld-fillet-sd', 'weld-flare-noteA', 'weld-flare-gmaw', 'weld-flare-smaw6', 'weld-thin-plate', 'weld-undersize'];
check('every spec §5 fixture id present', SPEC_IDS.every((id) => ids.includes(id)), 'missing: ' + SPEC_IDS.filter((id) => !ids.includes(id)).join(', '));
const order = await page.evaluate(() => window.MDEP.compute(window.MDEP.BASE).checks.map((c) => c.id).join(','));
check('check rows in spec §4.2 order', order === 'tens,dev,kfac,spc,grt,fit,wmet,wbm,wmin,wdev,wreq,tie', order);

// ── UI wiring ────────────────────────────────────────────────────────────────
const SPEC3_IDS = ['code', 'T', 'cmu', 'fm', 'barPos', 'coverIn', 'epoxy', 'bar', 'grade', 'n', 's', 'Le', 'Lp', 'Bp', 'tp', 'Fyp', 'Fup',
  'weldCfg', 'w', 'Lw', 'proc', 'Fexx', 'weldable'];
const missingIds = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), SPEC3_IDS);
check('every spec §3 input id present', missingIds.length === 0, 'missing: ' + missingIds.join(', '));
const dupIds = await page.evaluate(() => { const seen = {}, d = []; document.querySelectorAll('#uiRoot input[id], #uiRoot select[id]').forEach((el) => { if (seen[el.id]) d.push(el.id); seen[el.id] = 1; }); return d; });
check('input ids unique', dupIds.length === 0, 'duplicates: ' + dupIds.join(', '));
const defDiff = await page.evaluate(() => { const i = readInputs(), b = window.MDEP.BASE; return Object.keys(b).filter((k) => String(i[k]) !== String(b[k])).map((k) => k + ': ' + i[k] + ' vs ' + b[k]); });
check('defaults = MDEP.BASE (REK-09 ASD)', defDiff.length === 0, defDiff.join('; '));
check('coverIn hidden while barPos = center', !(await page.isVisible('#coverIn')), 'visible');
check('Lw hidden while weldCfg = fillet', !(await page.isVisible('#Lw')), 'visible');
check('proc hidden while weldCfg = fillet', !(await page.isVisible('#proc')), 'visible');

const sumText = () => page.$eval('#sumOut', (el) => el.textContent);
const rowText = (id, col) => page.$eval(`#chkTb tr[data-id="${id}"] td:nth-child(${col})`, (el) => el.textContent);
const waitSum = (re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('sumOut').textContent), re.source, { timeout: 3000 }).then(() => true, () => false);

await page.click('button.calc-btn');
check('results shown after Run', await page.$eval('#results', (el) => el.classList.contains('show')), 'no .show on #results');
const nRows = await page.$$eval('#chkTb .det-btn', (b) => b.length);
check('>= 7 check rows with ▶ Calc', nRows >= 7, 'rows=' + nRows);
check('banner PASS at defaults', /PASS/.test(await sumText()), await sumText());
const detOk = await page.evaluate(() => { const b = document.querySelector('#chkTb .det-btn'); b.click(); return document.getElementById('det_0').classList.contains('open'); });
check('▶ Calc opens the detail panel', detOk, 'det_0 not open');
check('NOTE status styled (wreq)', await page.$eval('#chkTb tr[data-id="wreq"]', (tr) => !!tr.querySelector('.st-note')), 'no .st-note span');
check('tension row ref visible', /§8\.3\.3\.1/.test(await rowText('tens', 2)), await rowText('tens', 2));

await page.selectOption('#code', 'sd');
await page.fill('#T', '9115');
const sdOk = await page.waitForFunction(() => { const td = document.querySelector('#chkTb tr[data-id="tens"] td:nth-child(4)'); return td && /21,?600/.test(td.textContent); }, null, { timeout: 3000 }).then(() => true, () => false);
check('SD live re-run: tension capacity 21,600', sdOk, sdOk ? '' : await rowText('tens', 4));

await page.fill('#Le', '16');
check('L_e = 16 -> banner FAIL', await waitSum(/FAIL/), await sumText());
await page.fill('#Le', '24');
check('L_e = 24 -> banner PASS again', await waitSum(/PASS/), await sumText());

await page.selectOption('#weldCfg', 'flare');
check('flare shows Lw', await page.isVisible('#Lw'), 'Lw hidden');
check('flare shows proc', await page.isVisible('#proc'), 'proc hidden');
check('flare #4 shows note [a] hint', await page.isVisible('#noteAHint'), 'hint hidden');
await page.selectOption('#bar', '6');
check('flare #6 hides note [a] hint', !(await page.isVisible('#noteAHint')), 'hint visible');
await page.selectOption('#bar', '4');
await page.selectOption('#weldCfg', 'fillet');
check('fillet hides Lw again', !(await page.isVisible('#Lw')), 'Lw visible');

await page.fill('#w', '0.125');
const wFail = await waitSum(/FAIL/);
check('w = 1/8 in -> banner FAIL', wFail, await sumText());
check('governing row is the minimum fillet size', /Minimum fillet size/.test(await sumText()), await sumText());
check('wmin row FAIL', /FAIL/.test(await rowText('wmin', 6)), await rowText('wmin', 6));
await page.fill('#w', '0.25');
await waitSum(/PASS/);

await page.selectOption('#barPos', 'custom');
check('barPos = custom shows coverIn', await page.isVisible('#coverIn'), 'coverIn hidden');
await page.selectOption('#barPos', 'center');
await page.fill('#n', '1');
check('n = 1 disables s', await page.$eval('#s', (el) => el.disabled), 's enabled');
await page.fill('#n', '2');
check('n = 2 enables s', !(await page.$eval('#s', (el) => el.disabled)), 's disabled');

await page.fill('#T', '');
const errShown = await page.waitForFunction(() => { const e = document.getElementById('errOut'); return e.style.display !== 'none' && /tension T/.test(e.textContent); }, null, { timeout: 3000 }).then(() => true, () => false);
check('blank T -> input error shown', errShown, await page.$eval('#errOut', (el) => el.textContent));
await page.fill('#T', '9115');
check('T restored -> results back', await waitSum(/PASS/), await sumText());

await page.fill('#areMark', 'EP-1');
check('mark EP-1 in the summary', await waitSum(/EP-1/), await sumText());

// ── selftest URL ─────────────────────────────────────────────────────────────
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);

await finish();
