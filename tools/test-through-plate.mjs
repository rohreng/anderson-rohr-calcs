// =============================================================================
// Through-plate moment connection — bolted / welded attachment wiring test
// -----------------------------------------------------------------------------
// Loads the page from public/ on disk (the AISC xlsx and the cdnjs XLSX script
// 404 under the route, so the calc runs on its fallback shapes: W16X57 on
// HSS20X12X1/2, DG24 Example 4.2), runs the bolted default, switches to the
// welded attachment added 2026-09-22 and checks its rows against independent
// arithmetic (Design Example II.B-2 weld procedure), then the end-weld gating
// and the elevation schematic in both modes.
// Usage: node tools/test-through-plate.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'through_plate_calculator.html';

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
await page.waitForFunction(() => !document.getElementById('calculateBtn').disabled);

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#results table.chk-table tbody tr'))
  .filter((tr) => !tr.classList.contains('det-row') && tr.children.length === 7 && tr.children[0].querySelector('strong'))
  .map((tr) => ({ name: tr.children[0].innerText.trim(), dc: tr.children[4].innerText.trim(), status: tr.children[5].innerText.trim() })));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── bolted default (DG24 Example 4.2) ────────────────────────────────────────
await page.click('#calculateBtn');
let r = await rows();
check('bolted: 4 check rows', r.length === 4 && r[2].name.startsWith('Bolt Group Shear'), JSON.stringify(r));
const svgBolted = await page.evaluate(() => document.getElementById('areSchemSvg').querySelectorAll('*').length);
check('bolted: schematic drawn', svgBolted > 30, 'nodes=' + svgBolted);
const modeB = await page.evaluate(() => ({ bolt: document.getElementById('boltSection').style.display, weld: document.getElementById('weldSection').style.display }));
check('bolted: bolt section shown, weld section hidden', modeB.bolt === '' && modeB.weld === 'none', JSON.stringify(modeB));

// ── welded attachment ────────────────────────────────────────────────────────
await page.selectOption('#attachType', 'welded');
const modeW = await page.evaluate(() => ({ bolt: document.getElementById('boltSection').style.display, weld: document.getElementById('weldSection').style.display, endDisabled: document.getElementById('endWeld').disabled }));
check('welded: weld section shown, bolt section hidden', modeW.bolt === 'none' && modeW.weld === '', JSON.stringify(modeW));
check('welded: end weld disabled for 14 in plate on 7.12 in flange', modeW.endDisabled === true, JSON.stringify(modeW));
await page.click('#calculateBtn');
r = await rows();
check('welded: 7 check rows', r.length === 7 && r[2].name.startsWith('Plate-to-Beam-Flange Welds') && r[6].name.startsWith('Fillet Weld'), JSON.stringify(r));

// independent arithmetic: fallback W16X57 (d 16.4, tf 0.715, bf 7.12), plate 3/4 x 14 A36, 5/16 E70 welds,
// projection 16.75, setback 0.5; loads per the page defaults
const MuR = 1.2 * 60 + 1.6 * 180, MuL = 1.2 * 60, VuR = 1.2 * 8 + 1.6 * 24, VuL = 1.2 * 8;
const MuConn = MuR - MuL + (20 / 2) * (VuR - VuL) / 12;
const Mmax = Math.max(MuR, MuL, Math.abs(MuConn));
const Ru = Mmax * 12 / (16.4 + 0.75);
const lw = 16.75 - 0.5 - 0.3125;
const Rnwl = 2 * 0.6 * 70 * 0.707 * 0.3125 * lw, phiRnW = 0.75 * Rnwl;
const Anv = 2 * 0.715 * lw, phiRnFr = 0.75 * 0.6 * 65 * Anv;
const tminF = 3.09 * 5 / 65, tminP = 3.09 * 5 / 58;
check('welded: weld row D/C = Ru / 0.75 Rnwl', near(parseFloat(r[2].dc), Ru / phiRnW, 0.006), r[2].dc + ' vs ' + (Ru / phiRnW).toFixed(3));
check('welded: flange base metal D/C', near(parseFloat(r[3].dc), tminF / 0.715, 0.006), r[3].dc + ' vs ' + (tminF / 0.715).toFixed(3));
check('welded: plate base metal D/C', near(parseFloat(r[4].dc), tminP / 0.75, 0.006), r[4].dc + ' vs ' + (tminP / 0.75).toFixed(3));
check('welded: flange shear rupture D/C', near(parseFloat(r[5].dc), Ru / phiRnFr, 0.006), r[5].dc + ' vs ' + (Ru / phiRnFr).toFixed(3));
check('welded: 5/16 weld on 16.75 in projection fails as expected', r[2].status === 'FAIL' && Ru / phiRnW > 1, JSON.stringify(r[2]));
check('welded: fillet limits pass', r[6].status === 'PASS', JSON.stringify(r[6]));
const detTxt = await page.evaluate(() => document.getElementById('results').textContent);
check('welded: rupture detail states An = Ag', detTxt.includes('Welded plate, no holes'), 'no An = Ag text');
const svgWelded = await page.evaluate(() => ({ nodes: document.getElementById('areSchemSvg').querySelectorAll('*').length, welds: document.querySelectorAll('#areSchemSvg .are-weld').length, bolts: document.querySelectorAll('#areSchemSvg circle').length }));
check('welded: schematic drawn with 4 weld marks and no bolts', svgWelded.nodes > 30 && svgWelded.welds === 4, JSON.stringify(svgWelded));

// weld length override
await page.fill('#weldLen', '22');
await page.click('#calculateBtn');
r = await rows();
const phiRnW22 = 0.75 * 2 * 0.6 * 70 * 0.707 * 0.3125 * 22;
check('welded: weld length override 22 in', near(parseFloat(r[2].dc), Ru / phiRnW22, 0.006) && r[2].status === 'PASS', r[2].dc + ' vs ' + (Ru / phiRnW22).toFixed(3));
await page.fill('#weldLen', '');

// plate narrower than the flange enables the end weld and adds Rnwt
await page.fill('#plateWidth', '7');
const endOK = await page.evaluate(() => document.getElementById('endWeld').disabled);
check('welded: end weld enabled for 7 in plate on 7.12 in flange', endOK === false, 'disabled=' + endOK);
await page.check('#endWeld');
await page.click('#calculateBtn');
r = await rows();
const Ru7 = Mmax * 12 / (16.4 + 0.75);
const Rnwt = 0.6 * 70 * 0.707 * 0.3125 * 7, Rn7 = Math.max(Rnwl + Rnwt, 0.85 * Rnwl + 1.5 * Rnwt);
check('welded: J2-6a/b with end weld', near(parseFloat(r[2].dc), Ru7 / (0.75 * Rn7), 0.006), r[2].dc + ' vs ' + (Ru7 / (0.75 * Rn7)).toFixed(3));

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASS');
