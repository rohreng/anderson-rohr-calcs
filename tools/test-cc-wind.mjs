// Components & Cladding wind regression harness.
// --capture-unmodified freezes the original 7-16 calc and its toolbar state.
// --phase0 checks the corrected 7-16 calc; --capture freezes that result.
// With no flag, compare the corrected baseline and run edition checks.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIX_DIR = fileURLToPath(new URL('../fixtures/cc-wind/', import.meta.url));
const FILE = 'asce716_cc_wind_calculator.html';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const TOL = 1e-9;
const MODES = new Map([['--capture-unmodified', 'unmodified'], ['--phase0', 'phase0'], ['--capture', 'capture']]);
const args = process.argv.slice(2);
if (args.length > 1 || (args.length && !MODES.has(args[0]))) {
  console.error('Usage: node tools/test-cc-wind.mjs [--capture-unmodified|--phase0|--capture]');
  process.exit(1);
}
const mode = args.length ? MODES.get(args[0]) : 'default';

// The ten input rows in plan §9.2. Preserve case names in the fixtures.
const CASES = [
  { name: 'b1-walls-2A-default', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 32 },
  { name: 'b2-walls-only', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: 'none', oh: false, A: 32 },
  { name: 'b3-walls-2A-oh-A200', V: 115, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: true, A: 200 },
  { name: 'b4-walls-2B-B-A50', V: 120, exp: 'B', h: 30, minDim: 40, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2B', oh: false, A: 50 },
  { name: 'b5-walls-2D-oh-A10', V: 115, exp: 'C', h: 25, minDim: 60, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2D', oh: true, A: 10 },
  { name: 'b6-walls-5A-oh-D-A75', V: 130, exp: 'D', h: 18, minDim: 80, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-5A', oh: true, A: 75 },
  { name: 'b7-walls-2A-parapet3', V: 115, exp: 'C', h: 20, minDim: 50, hp: 3, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 32 },
  { name: 'b8-high-walls-roof-h80', V: 115, exp: 'C', h: 80, minDim: 100, hp: 0, Kd: 0.85, Kzt: 1, GCpi: 0.18, wallFig: '30.6-1-wall', roofFig: '30.6-1-roof', oh: false, A: 32 },
  { name: 'b9-high-parapet4-pe', V: 115, exp: 'C', h: 80, minDim: 100, hp: 4, Kd: 0.85, Kzt: 1, GCpi: 0.55, wallFig: '30.6-1-wall', roofFig: '30.6-1-roof', oh: false, A: 100 },
  { name: 'b10-walls-2A-A600-Kzt', V: 150, exp: 'C', h: 20, minDim: 50, hp: 0, Kd: 0.85, Kzt: 1.2, GCpi: 0.18, wallFig: '30.3-1', roofFig: '30.3-2A', oh: false, A: 600 },
];

const failures = [];
function check(label, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
function diff(exp, act, path, out, allow = []) {
  if (allow.some(re => re.test(path))) return;
  if (typeof exp === 'number') {
    if (typeof act !== 'number' || Math.abs(exp - act) > TOL) out.push(`${path}: ${exp} → ${act}`);
  } else if (exp === null || typeof exp !== 'object') {
    if (exp !== act) out.push(`${path}: ${JSON.stringify(exp)} → ${JSON.stringify(act)}`);
  } else if (Array.isArray(exp)) {
    if (!Array.isArray(act) || act.length !== exp.length) { out.push(`${path}: length ${exp.length} → ${act?.length}`); return; }
    exp.forEach((v, i) => diff(v, act[i], `${path}[${i}]`, out, allow));
  } else {
    if (act === null || typeof act !== 'object') { out.push(`${path}: object → ${JSON.stringify(act)}`); return; }
    Object.keys(exp).forEach(k => diff(exp[k], act[k], `${path}.${k}`, out, allow));
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('dialog', d => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
await page.route('**/*', route => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});

async function fresh() {
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.evaluate(() => localStorage.removeItem('ARE_cc_wind'));
}
async function snapshot() { return page.evaluate(() => {
  const ls = JSON.parse(localStorage.getItem('ARE_cc_wind') || 'null');
  if (ls) { delete ls.saved; if (ls.revit) delete ls.revit.generatedAt; }
  const rows = Array.from(document.querySelectorAll('#prsBody tr:not(.det-row)')).map(tr => Array.from(tr.cells).slice(0, 7).map(td => td.innerText.trim()));
  const dem = {};
  document.querySelectorAll('#demOut .dem-card').forEach(c => { dem[c.querySelector('.l').innerText.split('\n')[0].trim()] = c.querySelector('.v').innerText.trim(); });
  return { ls, rows, dem, ref: document.getElementById('refTableOut').innerText.replace(/\s+/g, ' ').trim(),
    last: window.__ccLast ? JSON.parse(JSON.stringify(window.__ccLast)) : null };
}); }
async function runCase(c) {
  await fresh();
  for (const k of ['V', 'h', 'minDim', 'hp', 'Kd', 'Kzt']) await page.fill('#' + k, String(c[k]));
  for (const k of ['exp', 'GCpi', 'wallFig', 'roofFig']) await page.selectOption('#' + k, String(c[k]));
  await page.selectOption('#overhangs', c.oh ? 'yes' : 'no');
  // The span/tributary handlers recalculate the area; set the requested area last.
  await page.fill('#effArea', String(c.A));
  await page.click('button.calc-btn');
  await page.waitForSelector('#results.show');
  return snapshot();
}

try {
  const results = {};
  let legacyState;
  for (const c of CASES) {
    results[c.name] = await runCase(c);
    check(c.name + ': result and saved zones', !!results[c.name].ls && results[c.name].rows.length > 0,
      JSON.stringify(results[c.name]).slice(0, 300));
    if (c === CASES[0] && mode === 'unmodified') legacyState = await page.evaluate(() => AREv2.captureState());
  }

  if (mode === 'unmodified' || mode === 'capture') {
    mkdirSync(FIX_DIR, { recursive: true });
    const name = mode === 'unmodified' ? 'baseline-unmodified.json' : 'baseline.json';
    if (!failures.length && !pageErrors.length) {
      writeFileSync(FIX_DIR + name, JSON.stringify({ capturedAt: new Date().toISOString(), cases: results }, null, 1) + '\n');
      console.log('baseline written: ' + FIX_DIR + name);
      if (mode === 'unmodified') {
        check('legacy state excludes future fields', !!legacyState && ['#edition', '#Ke', '#theta'].every(k => !(k in legacyState.fields)), JSON.stringify(legacyState?.fields));
        if (!failures.length) {
          writeFileSync(FIX_DIR + 'legacy-state.json', JSON.stringify(legacyState, null, 1) + '\n');
          console.log('legacy state written: ' + FIX_DIR + 'legacy-state.json');
        }
      }
    }
  } else if (mode === 'default') {
    const base = JSON.parse(readFileSync(FIX_DIR + 'baseline.json', 'utf8')).cases;
    for (const c of CASES) {
      const out = [];
      diff(base[c.name], results[c.name], 'root', out);
      check('baseline ' + c.name, out.length === 0, out.slice(0, 12).join('\n      '));
    }
  } else {
    check('Phase 0 exposes window.__ccLast for every baseline case',
      CASES.every(c => Array.isArray(results[c.name].last?.zones)), 'Run after Phase 0 calc edits');
  }
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
} catch (e) {
  check('harness run', false, String(e.stack || e));
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
