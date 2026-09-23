// Snow Load Calculator regression harness.
// Usage: node tools/test-snow.mjs --capture  (once, on the unmodified calc)
//        node tools/test-snow.mjs            (after Phase 0 and later stages)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIX_DIR = fileURLToPath(new URL('../fixtures/snow/', import.meta.url));
const BASELINE = join(FIX_DIR, 'baseline.json');
const LEGACY = join(FIX_DIR, 'legacy-716-state.json');
const FILE = 'snow_load_calculator.html';
const CAPTURE = process.argv.includes('--capture');
const TOL = 1e-9;
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const CASES = ['b0-defaults', 'b1-lowsnow', 'b2-heavy-smallfetch', 'b3-light'];
const CASE_ROWS = {
  'b0-defaults': [['parapet', 3.5, 15.25], ['parapet', 10, 15.25], ['parapet', 3.5, 28], ['parapet', 10, 28], ['leeward', 10, 82], ['windward', 10, 15.25]],
  'b1-lowsnow': [['parapet', 1.5, 40], ['leeward', 12, 60], ['windward', 12, 30]],
  'b2-heavy-smallfetch': [['parapet', 5, 4], ['leeward', 6, 200]],
  'b3-light': [['windward', 4, 100]],
};
const CASE_SOURCES = {
  'b0-defaults': ['4', '0'], 'b1-lowsnow': ['1', '2'],
  'b2-heavy-smallfetch': ['0', '1'], 'b3-light': ['0', '0'],
};
const ALLOW_ROWS = {
  'b0-defaults': [0, 1, 5],
  'b1-lowsnow': [1, 2],
  'b2-heavy-smallfetch': [0],
  'b3-light': [0],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const failures = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(join(PUBLIC_DIR, p)) });
  } catch {
    route.fulfill({ status: 404, body: '' });
  }
});

function check(label, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
async function fresh() {
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
}
async function fill(id, value) { await page.fill('#' + id, String(value)); }
async function select(id, value) { await page.selectOption('#' + id, String(value)); }
async function changeFill(id, value) {
  await fill(id, value);
  await page.locator('#' + id).dispatchEvent('change');
}
async function setRows(rows) {
  // Remove from the end so the surviving row indexes are stable.
  while (await page.evaluate(() => configurations.length) > rows.length) {
    await page.locator('#configurations-table button.btn-danger').last().click();
  }
  while (await page.evaluate(() => configurations.length) < rows.length) {
    await page.getByRole('button', { name: 'Add Configuration' }).click();
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    await select(`cfgType_${i}`, row.type);
    await changeFill(`cfgHr_${i}`, row.hr);
    await changeFill(`cfgLu_${i}`, row.lu);
  }
}
async function chooseSources(perp, parallel, opts = {}) {
  await page.locator('.tab').nth(1).click();
  if (opts.perpSpacing !== undefined) await changeFill('perp-spacing', opts.perpSpacing);
  if (opts.perpLength !== undefined) await changeFill('perp-length', opts.perpLength);
  if (opts.peak !== undefined) await select('perp-peak-location', opts.peak);
  await page.locator('.tab').nth(2).click();
  if (opts.parSpacing !== undefined) await changeFill('parallel-spacing', opts.parSpacing);
  if (opts.deadLoad !== undefined) await changeFill('parallel-dead-load', opts.deadLoad);
  // Switching tabs rebuilds both source selects, so select them after returning
  // to the drift tab. Force dispatches change for the hidden joist controls.
  await page.locator('.tab').nth(0).click();
  await page.locator('#parallel-drift-source').selectOption(parallel, { force: true });
  await page.locator('#perp-drift-source').selectOption(perp, { force: true });
}

// This intentionally uses only globals and DOM IDs that existed before Phase 0.
async function snapshot() {
  return page.evaluate(() => {
    const b = calculateBasics();
    const txt = (id) => document.getElementById(id).textContent.trim();
    const val = (id) => document.getElementById(id).value;
    return {
      basics: { pf: b.pf, gamma: b.gamma, hb: b.hb },
      drifts: configurations.map((c) => { const d = calculateDrift(c, b);
        return { name: c.name, type: c.type, hr: c.hr, lu: c.lu, hc: d.hc, hcHbRatio: d.hcHbRatio, driftHeight: d.driftHeight, W: d.W, pd: d.pd, totalPressure: d.totalPressure }; }),
      perp: { pd: val('perp-drift-load'), pf: val('perp-balanced-load'), W: val('perp-drift-width'), u: txt('perp-uniform-load'), t: txt('perp-triangular-peak'), RL: txt('perp-left-reaction'), RR: txt('perp-right-reaction'), M: txt('perp-moment') },
      par: { max: val('parallel-max-load'), pf: val('parallel-roof-snow'), W: txt('parallel-drift-width'), n: txt('parallel-num-joists'), mj: txt('parallel-max-joist-load'), dlll: txt('parallel-total-dl-ll'), ll: txt('parallel-total-ll'), rows: document.getElementById('parallel-joists-table').innerText },
      table: document.getElementById('configurations-table').innerText,
      basicsHtml: document.getElementById('basicCalcsTable').innerText
    };
  });
}

async function runCase(name) {
  await fresh();
  if (name === 'b0-defaults') {
    await chooseSources('4', '0');
  } else if (name === 'b1-lowsnow') {
    await fill('pg', 25); await select('ce', '0.9'); await select('ct', '1.1'); await select('is', '1.1');
    await setRows([
      { type: 'parapet', hr: 1.5, lu: 40 },
      { type: 'leeward', hr: 12, lu: 60 },
      { type: 'windward', hr: 12, lu: 30 },
    ]);
    await chooseSources('1', '2', { perpLength: 30, peak: 'left', parSpacing: 4, deadLoad: 15 });
  } else if (name === 'b2-heavy-smallfetch') {
    await fill('pg', 70); await select('ce', '1.2'); await select('ct', '1.2'); await select('is', '1.2');
    await setRows([
      { type: 'parapet', hr: 5, lu: 4 },
      { type: 'leeward', hr: 6, lu: 200 },
    ]);
    await chooseSources('0', '1');
  } else if (name === 'b3-light') {
    await fill('pg', 15); await select('ce', '0.7'); await select('ct', '0.85'); await select('is', '0.8');
    await setRows([{ type: 'windward', hr: 4, lu: 100 }]);
    await chooseSources('0', '0', { perpSpacing: 16, perpLength: 24, parSpacing: 8 });
  }
  return snapshot();
}

// Compare expected keys only: later phases add fields to calculation objects.
function diff(exp, act, path, out, allow = []) {
  if (allow.some((re) => re.test(path))) return;
  if (typeof exp === 'number') {
    if (typeof act !== 'number' || !Number.isFinite(act) || Math.abs(exp - act) > TOL) out.push(`${path}: ${exp} → ${act}`);
  } else if (exp === null || typeof exp !== 'object') {
    if (exp !== act) out.push(`${path}: ${JSON.stringify(exp)} → ${JSON.stringify(act)}`);
  } else if (Array.isArray(exp)) {
    if (!Array.isArray(act) || act.length !== exp.length) { out.push(`${path}: length ${exp.length} → ${act?.length}`); return; }
    exp.forEach((v, i) => diff(v, act[i], `${path}[${i}]`, out, allow));
  } else {
    if (act === null || typeof act !== 'object') { out.push(`${path}: object → ${JSON.stringify(act)}`); return; }
    Object.keys(exp).forEach((k) => diff(exp[k], act[k], `${path}.${k}`, out, allow));
  }
}
function allowed(name) {
  return [
    /^root\.table$/, /^root\.basicsHtml$/, /^root\.perp\./, /^root\.par\./,
    ...ALLOW_ROWS[name].flatMap((i) => ['driftHeight', 'W', 'pd', 'totalPressure'].map((key) => new RegExp(`^root\\.drifts\\[${i}\\]\\.${key}$`))),
  ];
}
function near(a, b, tol = 5e-4) { return typeof a === 'number' && Math.abs(a - b) <= tol; }

try {
  const results = {};
  let legacy;
  for (const name of CASES) {
    results[name] = await runCase(name);
    const rows = results[name].drifts;
    const sources = await page.evaluate(() => [document.getElementById('perp-drift-source').value, document.getElementById('parallel-drift-source').value]);
    check(`${name}: case inputs and snapshot`, rows.length === CASE_ROWS[name].length
      && rows.every((r, i) => r.type === CASE_ROWS[name][i][0] && r.hr === CASE_ROWS[name][i][1] && r.lu === CASE_ROWS[name][i][2])
      && sources[0] === CASE_SOURCES[name][0] && sources[1] === CASE_SOURCES[name][1]
      && results[name].table.length > 0 && results[name].basicsHtml.length > 0,
      JSON.stringify({ rows: rows.map((r) => [r.type, r.hr, r.lu]), sources }));
    if (name === 'b1-lowsnow') legacy = await page.evaluate(() => AREv2.captureState());
  }

  if (CAPTURE) {
    check('capture uses the pre-edition calculator', await page.locator('#edition').count() === 0);
    if (failures.length === 0) {
      mkdirSync(FIX_DIR, { recursive: true });
      writeFileSync(BASELINE, JSON.stringify({ capturedAt: new Date().toISOString(), cases: results }, null, 2) + '\n');
      writeFileSync(LEGACY, JSON.stringify(legacy, null, 2) + '\n');
      console.log('baseline written: ' + BASELINE);
      console.log('legacy state written: ' + LEGACY);
    }
  } else {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')).cases;
    for (const name of CASES) {
      const out = [];
      diff(base[name], results[name], 'root', out, allowed(name));
      check(`baseline ${name} (Phase 0 ALLOW)`, out.length === 0, out.slice(0, 15).join('\n      '));
    }
    // P1–P4: independent ASCE 7-16 Fig. 7.6-1 values from the frozen spec.
    const d0 = results['b0-defaults'].drifts;
    check('P1 b0 small fetch, rows 0/1/5', [0, 1, 5].every((i) => near(d0[i].driftHeight, 1.2359) && near(d0[i].W, 4.9434) && near(d0[i].pd, 24.194, 0.005)));
    const d1 = results['b1-lowsnow'].drifts;
    check('P2 b1 leeward and windward', near(d1[1].driftHeight, 2.7212) && near(d1[1].W, 10.8846) && near(d1[1].pd, 46.940, 0.005)
      && near(d1[2].driftHeight, 1.3764) && near(d1[2].W, 5.5057) && near(d1[2].pd, 23.743, 0.005));
    const d2 = results['b2-heavy-smallfetch'].drifts[0];
    check('P3 b2 small-fetch cap', near(d2.driftHeight, 1.4302) && near(d2.W, 6.1308) && near(d2.pd, 30.828, 0.005));
    const d3 = results['b3-light'].drifts[0];
    check('P4 b3 Is 0.8', near(d3.driftHeight, 1.9876) && near(d3.W, 7.9504) && near(d3.pd, 31.702, 0.005));
  }
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
} catch (e) {
  check('harness run', false, String(e.stack || e));
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
