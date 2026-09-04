// =============================================================================
// APA panel uniform-load calculator — engine + wiring test
// -----------------------------------------------------------------------------
// Asserts the pure engine (window.APA.compute) against the two worked examples
// in APA Technical Note Q225J (Dec 2024) pp. 15–16, the Table 5 "3-Span to
// 2-Span" case the original calc omitted, a Table 4 sanded-plywood case, the wet
// service case, panel self-weight from D510 Table 13, and the dead-load-exceeds-
// allowable edge case. Then drives the DOM once (selects + Run button) to prove
// the UI is wired to the same numbers, and that the Mark binding renders.
//
// No dev server needed: every request is fulfilled from public/ on disk.
// Usage: node tools/test-apa-panel.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'apa_panel_uniform_load_calculator.html';

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
function check(label, actual, expected, tol) {
  let ok;
  if (typeof expected === 'function') ok = expected(actual);
  else if (typeof expected === 'number' && typeof tol === 'number') ok = Math.abs(actual - expected) <= tol;
  else ok = actual === expected;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : `\n      got:      ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`));
  if (!ok) failures.push(label);
}
const compute = (inp) => page.evaluate((i) => window.APA.compute(i), inp);
const base = { species: '1', grade: 'AA', spanCond: 'tabulated', duration: 'normal', moisture: 'dry',
               liveDefl: 'L360', totalDefl: 'L240', deadInput: 10, live: 40, inclSelfWt: false };

// ── Q225J Example 1: Rated Sheathing 32/16 plywood, perp, 16" o.c., floor ─────
{
  const r = await compute({ ...base, cat: '1a', rating: '32/16', thickness: '15/32', axis: 'perp', spacing: 16 });
  check('Ex1 ok', r.ok, true);
  check('Ex1 raw L/360', r.raw.L360, 205);
  check('Ex1 raw L/240', r.raw.L240, 307);
  check('Ex1 raw L/180', r.raw.L180, 409);
  check('Ex1 raw bending', r.raw.Bending, 173);
  check('Ex1 raw shear', r.raw.Shear, 276);
  check('Ex1 tabulated basis is 3-span', r.base, 3);
  check('Ex1 allowable total = 173 psf (bending)', r.allowTotal, 173, 1e-9);
  check('Ex1 total governed by Bending', r.allowTotalSrc, 'Bending');
  check('Ex1 allowable live = 163 psf (total − dead)', r.allowLive, 163, 1e-9);
  check('Ex1 live governed by Total − Dead', r.allowLiveSrc, 'Total − Dead');
  check('Ex1 D/C total = 50/173', r.dcTotal, 50 / 173, 1e-9);
  check('Ex1 passes', r.pass, true);
}

// ── Q225J Example 2: OSB Sturd-I-Floor 24 o.c., perp, 32" o.c., single span, snow ──
{
  const r = await compute({ ...base, cat: '2c', rating: '24 o.c.', thickness: '23/32', axis: 'perp', spacing: 32,
                            spanCond: 'single', duration: 'twoMonth', liveDefl: 'L240', totalDefl: 'L180', live: 30 });
  check('Ex2 ok', r.ok, true);
  check('Ex2 raw L/360/L/240/L/180/B/S', [r.raw.L360, r.raw.L240, r.raw.L180, r.raw.Bending, r.raw.Shear].join(','), '52,78,104,90,164');
  check('Ex2 basis 3-span → 3-to-1 factors', r.spanKey, '3to1');
  check('Ex2 adjusted L/360 ≈ 28', Math.round(r.adj.L360), 28);
  check('Ex2 adjusted L/240 ≈ 41', Math.round(r.adj.L240), 41);
  check('Ex2 adjusted L/180 ≈ 55', Math.round(r.adj.L180), 55);
  check('Ex2 adjusted bending ≈ 83 (×1.15×0.80)', Math.round(r.adj.Bending), 83);
  check('Ex2 adjusted shear ≈ 226 (×1.15×1.20)', Math.round(r.adj.Shear), 226);
  check('Ex2 allowable total ≈ 55 psf (L/180)', Math.round(r.allowTotal), 55);
  check('Ex2 total governed by L180', r.allowTotalSrc, 'L180');
  check('Ex2 allowable live ≈ 41 psf (L/240)', Math.round(r.allowLive), 41);
  check('Ex2 live governed by L240', r.allowLiveSrc, 'L240');
  check('Ex2 exact live = 78×0.53', r.allowLive, 78 * 0.53, 1e-9);
}

// ── Table 5 "3-Span to 2-Span" (omitted from the original calc) ────────────────
{
  const r = await compute({ ...base, cat: '1a', rating: '48/24', thickness: '23/32', axis: 'perp', spacing: 24, spanCond: 'two' });
  check('3→2 key', r.spanKey, '3to2');
  check('3→2 L/360 = 191×1.28', r.adj.L360, 191 * 1.28, 1e-9);
  check('3→2 bending = 194×0.80', r.adj.Bending, 194 * 0.80, 1e-9);
  check('3→2 shear = 267×0.96', r.adj.Shear, 267 * 0.96, 1e-9);
  const r2 = await compute({ ...base, cat: '1a', rating: '48/24', thickness: '23/32', axis: 'perp', spacing: 36, spanCond: 'two' });
  check('two-span at 36" (basis already 2-span) → no adjustment', r2.spanKey === null && r2.adj.L360 === 67, true);
  const r3 = await compute({ ...base, cat: '1a', rating: '48/24', thickness: '23/32', axis: 'perp', spacing: 36, spanCond: 'single' });
  check('single span at 36" → 2-to-1 (defl 0.42)', r3.spanKey === '2to1' && Math.abs(r3.adj.L360 - 67 * 0.42) < 1e-9, true);
  const r4 = await compute({ ...base, cat: '1a', rating: '48/24', thickness: '23/32', axis: 'para', spacing: 24, spanCond: 'single' });
  check('parallel 24" basis 2-span → 2-to-1', r4.base === 2 && r4.spanKey === '2to1', true);
  const r5 = await compute({ ...base, cat: '1a', rating: '48/24', thickness: '23/32', axis: 'para', spacing: 16, spanCond: 'single' });
  check('parallel 16" basis 3-span → 3-to-1', r5.base === 3 && r5.spanKey === '3to1', true);
}

// ── Table 3 + Table 4 sanded plywood ──────────────────────────────────────────
{
  const r = await compute({ ...base, cat: '3', rating: '3/4', thickness: '3/4', axis: 'perp', spacing: 24, species: '2', grade: 'Other' });
  check('sanded G2 Other: stiffness 0.83', r.adj.L360, 154 * 0.83, 1e-9);
  check('sanded G2 Other: bending 0.61', r.adj.Bending, 170 * 0.61, 1e-9);
  check('sanded G2 Other: shear 1.00', r.adj.Shear, 320, 1e-9);
  const m = await compute({ ...base, cat: '3', rating: '3/4', thickness: '3/4', axis: 'perp', spacing: 24, species: '2', grade: 'Marine' });
  check('Marine + Group 2 rejected (Table 4 NA)', !m.ok && /Marine/.test(m.error), true);
  const si = await compute({ ...base, cat: '3', rating: '3/4', thickness: '3/4', axis: 'para', spacing: 16, species: 'SI', grade: 'AA' });
  check('Structural I parallel A-A: 1.40 on all three', [si.deflMult, si.bendMult, si.shearMult].join(','), '1.4,1.4,1.4');
  const thin = await compute({ ...base, cat: '3', rating: '1/4', thickness: '1/4', axis: 'para', spacing: 12 });
  check('1/4" sanded parallel: no published values → error, not throw', !thin.ok && /no uniform-load values/.test(thin.error), true);
}

// ── Wet service, duration, self-weight, dead-load edge ─────────────────────────
{
  const w = await compute({ ...base, cat: '1a', rating: '24/0', thickness: '3/8', axis: 'perp', spacing: 24, moisture: 'wet' });
  check('wet: deflection ×0.85', w.adj.L360, 29 * 0.85, 1e-9);
  check('wet: bending ×0.75', w.adj.Bending, 52 * 0.75, 1e-9);
  check('wet: shear ×0.75', w.adj.Shear, 138 * 0.75, 1e-9);
  const d = await compute({ ...base, cat: '1a', rating: '24/0', thickness: '3/8', axis: 'perp', spacing: 24, duration: 'windEQ' });
  check('C_D=1.60 applies to bending/shear only', d.adj.L360 === 29 && Math.abs(d.adj.Bending - 52 * 1.6) < 1e-9, true);
  const sw = await compute({ ...base, cat: '1a', rating: '32/16', thickness: '15/32', axis: 'perp', spacing: 16, inclSelfWt: true });
  check('self-weight 15/32 plywood = 1.4 psf (D510 T13)', sw.selfWt, 1.4, 1e-9);
  check('dead = 10 + 1.4', sw.dead, 11.4, 1e-9);
  const swo = await compute({ ...base, cat: '2a', rating: '48/24', thickness: '7/8', axis: 'perp', spacing: 48, inclSelfWt: true });
  check('self-weight 7/8 OSB = 2.9 psf', swo.selfWt, 2.9, 1e-9);
  const edge = await compute({ ...base, cat: '1a', rating: '32/16', thickness: '15/32', axis: 'perp', spacing: 16, deadInput: 200, live: 0 });
  check('dead > allowable: total FAILS', edge.passTotal, false);
  check('dead > allowable: live check reports ∞ and FAILS (was "—" in original)', !isFinite(edge.dcLive) && edge.passLive === false && edge.pass === false, true);
}

// ── DOM wiring: drive Example 1 through the selects and Run button ─────────────
{
  await page.selectOption('#cat', '1a');
  await page.selectOption('#rating', '32/16');
  await page.selectOption('#axis', 'perp');
  await page.selectOption('#spacing', '16');
  await page.selectOption('#spanCond', 'tabulated');
  await page.selectOption('#duration', 'normal');
  await page.selectOption('#liveDefl', 'L360');
  await page.selectOption('#totalDefl', 'L240');
  await page.fill('#deadLoad', '10');
  await page.fill('#liveLoad', '40');
  await page.fill('#areMark', 'F-2 @ GL B');
  await page.dispatchEvent('#areMark', 'input');
  await page.click('button.calc-btn');
  await page.waitForTimeout(600);
  const ui = await page.evaluate(() => ({
    shown: document.getElementById('results').classList.contains('show'),
    sum: document.getElementById('sumBox').textContent,
    cards: Array.from(document.querySelectorAll('.dem-card .v')).map((n) => n.textContent),
    statuses: Array.from(document.querySelectorAll('#chkTb .pass, #chkTb .fail')).map((n) => n.textContent),
    hdrMark: document.querySelector('.hdr-mark').textContent,
    err: document.getElementById('errBox').classList.contains('show'),
  }));
  check('UI: results shown', ui.shown, true);
  check('UI: summary Max D/C = 0.289', /Max D\/C = 0\.289/.test(ui.sum), true);
  check('UI: summary carries the mark', /F-2 @ GL B/.test(ui.sum), true);
  check('UI: demand cards 10 / 40 / 50 / 173 / 163', ui.cards.join('|'), '10.0|40.0|50.0|173.0|163.0');
  check('UI: both checks PASS', ui.statuses.join(','), 'PASS,PASS');
  check('UI: header mark binding', ui.hdrMark, 'Mark: F-2 @ GL B');
  check('UI: no error box', ui.err, false);

  // Invalid combination → inline error, no dialog
  await page.selectOption('#cat', '3');
  await page.selectOption('#rating', '1/4');
  await page.selectOption('#axis', 'para');
  await page.click('button.calc-btn');
  await page.waitForTimeout(300);
  const e = await page.evaluate(() => ({
    err: document.getElementById('errBox').classList.contains('show'),
    txt: document.getElementById('errBox').textContent,
    shown: document.getElementById('results').classList.contains('show'),
  }));
  check('UI: unsupported orientation → inline error shown', e.err && /no uniform-load values|valid support spacing/.test(e.txt), true);
  check('UI: results hidden on error', e.shown, false);

  // Marine is disabled for Group 2 in the UI
  await page.selectOption('#cat', '3');
  await page.selectOption('#species', '2');
  const marineDisabled = await page.evaluate(() => document.querySelector('#grade option[value="Marine"]').disabled);
  check('UI: Marine option disabled for Group 2', marineDisabled, true);
}

check('no page errors or dialogs', pageErrors.join(' | '), '');

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall APA panel checks passed');
process.exit(failures.length ? 1 : 0);
