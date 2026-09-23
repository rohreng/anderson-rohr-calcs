// =============================================================================
// Through-plate moment connection — wiring + value test
// -----------------------------------------------------------------------------
// Loads the page from public/ on disk (the AISC xlsx and the cdnjs XLSX script
// 404 under the route, so the calc runs on its fallback shapes: W16X57 on
// HSS20X12X1/2, DG24 Example 4.2). Defaults since 2026-09-23 are Ex. 4.2's final
// design: PL 5/8 x 14 A36, 1 in A325-N, 2 lines x 5 @ 3, g 3.5, L_e,p 1.75,
// L_e,b 2, 3 in to the first bolt, 9/16 in plate-to-HSS weld with panel-zone
// shear included. Checks every row against independent arithmetic, in both
// attachment modes, plus the TPC engine fixtures (?selftest=1).
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
async function open(q = '') {
  await page.goto('http://calcs.test/Calcs/' + FILE + q, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.waitForFunction(() => !document.getElementById('calculateBtn').disabled);
}
await open();

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#results table.chk-table tbody tr'))
  .filter((tr) => !tr.classList.contains('det-row') && tr.children.length === 7 && tr.children[0].querySelector('strong'))
  .map((tr) => ({ name: tr.children[0].innerText.trim(), dc: parseFloat(tr.children[4].innerText), status: tr.children[5].innerText.trim() })));
const byName = (r, n) => r.find((x) => x.name.startsWith(n)) || { name: n + ' (missing)', dc: NaN, status: '' };
const near = (a, b, tol = 0.006) => Math.abs(a - b) <= tol;
function dc(r, n, want, tol) { const x = byName(r, n); check(`${mode}: ${n} D/C ${want.toFixed(3)}`, near(x.dc, want, tol), JSON.stringify(x)); }
let mode = 'bolted';

// ── independent arithmetic, Ex. 4.2 on the fallback shapes ──────────────────
const d = 16.4, tf = 0.715, bf = 7.12, tp = 0.625, wp = 14, H = 20, B = 12, t = 0.465, Ag = 28.3;
const MuR = 1.2 * 60 + 1.6 * 180, MuL = 1.2 * 60, VuR = 1.2 * 8 + 1.6 * 24, VuL = 1.2 * 8, PuTop = 1.2 * 48 + 1.6 * 144;
const MuConn = MuR - MuL + (H / 2) * (VuR - VuL) / 12, MuSeg = MuConn / 2, PuConn = VuL + VuR + PuTop;
const lever = d + tp, Ru = Math.max(MuR, MuL, Math.abs(MuConn)) * 12 / lever, dRu = (MuR - MuL) * 12 / lever;
const dh = 1.1875, per16 = 0.75 * 0.6 * 70 * 0.707 / 16;
const j45 = (Fu, Fy, Agv, Anv, Ant) => Math.min(0.6 * Fu * Anv + Fu * Ant, 0.6 * Fy * Agv + Fu * Ant);
const fW = PuConn / (2 * (B + H)) + MuSeg * 12 * (H / 2) / (2 * H ** 3 / 12 + 2 * B * (H / 2) ** 2);
const fV = dRu / (2 * H), fR = Math.hypot(fW, fV);

// ── bolted default ──────────────────────────────────────────────────────────
await page.click('#calculateBtn');
let r = await rows();
check('bolted: 10 check rows', r.length === 10, JSON.stringify(r.map((x) => x.name)));
check('bolted: M_conn 320 total, 160 per segment', near(MuConn, 320, 1e-9) && near(MuSeg, 160, 1e-9), `${MuConn} / ${MuSeg}`);
dc(r, 'Plate Tensile Yielding', Ru / (0.9 * 36 * tp * wp));
dc(r, 'Plate Tensile Rupture', Ru / (0.75 * 58 * tp * (wp - 2 * dh)));
dc(r, 'Bolt Group Shear', Ru / (0.75 * 54 * Math.PI / 4 * 10));
const brg = (tEl, Fu, Le) => 2 * Math.min(1.2 * (Le - 0.5625) * tEl * Fu, 2.4 * tEl * Fu) + 8 * Math.min(1.2 * 1.875 * tEl * Fu, 2.4 * tEl * Fu);
dc(r, 'Bolt Bearing', Ru / (0.75 * Math.min(brg(tp, 58, 1.75), brg(tf, 65, 2.0))));
const Agv = 2 * 13.75 * tp, Anv = Agv - 9 * dh * tp;
dc(r, 'Plate Block Shear', Ru / (0.75 * j45(58, 36, Agv, Anv, (3.5 - dh) * tp)));
const AgvF = 2 * 14 * tf, AnvF = AgvF - 9 * dh * tf;
dc(r, 'Beam Flange Block Shear', Ru / (0.75 * j45(65, 50, AgvF, AnvF, (bf - 3.5 - dh) * tf)));
dc(r, 'Compression Plate', Ru / (0.9 * 36 * tp * wp));
dc(r, 'Plate-to-HSS Weld', fR / (per16 * 9));
dc(r, 'HSS Wall Base Metal', fR / (0.75 * 0.6 * 58 * t));
dc(r, 'HSS Panel-Zone Shear', dRu / (0.9 * 0.6 * 46 * 2 * H * t));
check('bolted: Ex. 4.2 default passes all rows', r.every((x) => x.status === 'PASS'), JSON.stringify(r.filter((x) => x.status !== 'PASS')));
const txt = await page.evaluate(() => document.getElementById('results').textContent);
check('bolted: hole-size note present', txt.includes('360-10 hole sizes'), 'no hole note');
check('bolted: column-side note present', txt.includes('does not apply'), 'no column note');
check('bolted: per-segment moment line', txt.includes('160.0 kip-ft'), 'no M_seg line');
const svgB = await page.evaluate(() => ({ welds: document.querySelectorAll('#areSchemSvg .are-weld').length }));
check('bolted: 8 plate-to-HSS weld marks', svgB.welds === 8, JSON.stringify(svgB));

// DG24 convention: 1/2 in weld, panel-zone shear off -> D/C 0.947
await page.fill('#hssWeldSize', '0.5');
await page.uncheck('#weldIncludePZ');
await page.click('#calculateBtn');
r = await rows();
// the table shows D/C to 2 decimals; the exact 0.947 is asserted in the TPC fixture W-DG24
dc(r, 'Plate-to-HSS Weld', fW / (per16 * 8));
check('bolted: DG24 1/2 in weld passes without panel-zone shear', byName(r, 'Plate-to-HSS Weld').status === 'PASS', JSON.stringify(byName(r, 'Plate-to-HSS Weld')));
await page.check('#weldIncludePZ');
await page.click('#calculateBtn');
r = await rows();
check('bolted: 1/2 in weld with panel-zone shear fails at 1.05', near(byName(r, 'Plate-to-HSS Weld').dc, 1.051, 0.004) && byName(r, 'Plate-to-HSS Weld').status === 'FAIL', JSON.stringify(byName(r, 'Plate-to-HSS Weld')));
await page.fill('#hssWeldSize', '0.5625');

// reversed beam loads (live load on the LEFT beam): every row must be unchanged — the weld
// moment term uses |M_seg| (verifier fix 2026-09-23; before it the weld D/C fell from 0.93 to 0.41)
await page.click('#calculateBtn');
const baseRows = await rows();
const swap = async () => { for (const [a, b] of [['#momentLiveLeft', '#momentLiveRight'], ['#shearLiveLeft', '#shearLiveRight']]) {
  const va = await page.inputValue(a), vb = await page.inputValue(b); await page.fill(a, vb); await page.fill(b, va); } };
await swap();
await page.click('#calculateBtn');
r = await rows();
check('bolted: reversed beam loads give identical rows', r.length === baseRows.length && r.every((x, i) => x.name === baseRows[i].name && near(x.dc, baseRows[i].dc, 1e-9) && x.status === baseRows[i].status),
  JSON.stringify(r.map((x) => x.dc)) + ' vs ' + JSON.stringify(baseRows.map((x) => x.dc)));
await swap();

// narrow gage error
await page.fill('#boltGage', '7');
await page.click('#calculateBtn');
let err = await page.evaluate(() => document.getElementById('results').textContent);
check('bolted: gage + hole wider than the flange is rejected', err.includes('g + d_h'), err.slice(0, 120));
await page.fill('#boltGage', '3.5');

// ── welded attachment ────────────────────────────────────────────────────────
mode = 'welded';
await page.selectOption('#attachType', 'welded');
const modeW = await page.evaluate(() => ({ bolt: document.getElementById('boltSection').style.display, weld: document.getElementById('weldSection').style.display, endDisabled: document.getElementById('endWeld').disabled }));
check('welded: weld section shown, bolt section hidden', modeW.bolt === 'none' && modeW.weld === '', JSON.stringify(modeW));
check('welded: end weld disabled for 14 in plate on 7.12 in flange', modeW.endDisabled === true, JSON.stringify(modeW));
await page.click('#calculateBtn');
r = await rows();
check('welded: 12 check rows', r.length === 12, JSON.stringify(r.map((x) => x.name)));
const lw = 16.75 - 0.5 - 0.3125;
const Rnwl = 2 * 0.6 * 70 * 0.707 * 0.3125 * lw;
dc(r, 'Plate-to-Beam-Flange Welds', Ru / (0.75 * Rnwl));
dc(r, 'Beam Flange Base Metal', (3.09 * 5 / 65) / tf);
dc(r, 'Plate Base Metal', (3.09 * 5 / 58) / tp);
dc(r, 'Beam Flange Shear Rupture', Ru / (0.75 * 0.6 * 65 * 2 * tf * lw));
dc(r, 'Plate Block Shear at Welds', Ru / (0.75 * j45(58, 36, 2 * tp * lw, 2 * tp * lw, bf * tp)));
dc(r, 'Compression Plate', Ru / (0.9 * 36 * tp * wp));
dc(r, 'Plate-to-HSS Weld', fR / (per16 * 9));
check('welded: 5/16 weld on 16.75 in projection fails as expected', byName(r, 'Plate-to-Beam-Flange Welds').status === 'FAIL', JSON.stringify(byName(r, 'Plate-to-Beam-Flange Welds')));
check('welded: fillet limits pass', byName(r, 'Fillet Weld').status === 'PASS', JSON.stringify(byName(r, 'Fillet Weld')));
const txtW = await page.evaluate(() => document.getElementById('results').textContent);
check('welded: rupture detail states An = Ag', txtW.includes('Welded plate, no holes'), 'no An = Ag text');
const svgW = await page.evaluate(() => ({ welds: document.querySelectorAll('#areSchemSvg .are-weld').length }));
check('welded: 4 flange + 8 HSS weld marks', svgW.welds === 12, JSON.stringify(svgW));

// weld length override passes the flange weld
await page.fill('#weldLen', '22');
await page.click('#calculateBtn');
r = await rows();
dc(r, 'Plate-to-Beam-Flange Welds', Ru / (0.75 * 2 * 0.6 * 70 * 0.707 * 0.3125 * 22));
check('welded: 22 in weld passes', byName(r, 'Plate-to-Beam-Flange Welds').status === 'PASS', JSON.stringify(byName(r, 'Plate-to-Beam-Flange Welds')));
await page.fill('#weldLen', '');

// a plate narrower than the HSS cannot be welded around it
await page.fill('#plateWidth', '7');
await page.click('#calculateBtn');
err = await page.evaluate(() => document.getElementById('results').textContent);
check('welded: plate narrower than B + 2w is rejected', err.includes('B + 2w'), err.slice(0, 120));

// ── engine fixtures via ?selftest=1 ─────────────────────────────────────────
await open('?selftest=1');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);
const fx = await page.evaluate(() => window.TPC.runFixtures());
check(`TPC fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASS');
