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
// §7.2 overlooked that the existing driftHeight result is the height before
// the hc cap. These two heights change, although their W/pd/total stay fixed.
const ALLOW_CAPPED_HEIGHT = {
  'b1-lowsnow': [0],
  'b2-heavy-smallfetch': [1],
};
const PHASE0_EXPECTED = {
  'b0-defaults': {
    0: { hd: 1.6478, h: 1.2359, W: 4.9434, pd: 24.194, total: 54.224 },
    1: { hd: 1.6478, h: 1.2359, W: 4.9434, pd: 24.194, total: 54.224 },
    5: { hd: 1.6478, h: 1.2359, W: 4.9434, pd: 24.194, total: 54.224 },
  },
  'b1-lowsnow': {
    1: { hd: 2.7212, h: 2.7212, W: 10.8846, pd: 46.940, total: 65.997 },
    2: { hd: 1.8352, h: 1.3764, W: 5.5057, pd: 23.743, total: 42.801 },
  },
  'b2-heavy-smallfetch': {
    0: { hd: 1.9069, h: 1.4302, W: 6.1308, pd: 30.828, total: 115.50 },
  },
  'b3-light': {
    0: { hd: 2.6501, h: 1.9876, W: 7.9504, pd: 31.702, total: 36.700 },
  },
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
    ...(ALLOW_CAPPED_HEIGHT[name] || []).map((i) => new RegExp(`^root\\.drifts\\[${i}\\]\\.driftHeight$`)),
  ];
}
function near(a, b, tol = 5e-4) { return typeof a === 'number' && Math.abs(a - b) <= tol; }
function checkPhase0(label, name, results, rawHd) {
  const bad = [];
  for (const [index, expected] of Object.entries(PHASE0_EXPECTED[name])) {
    const d = results[name].drifts[Number(index)];
    const actual = { hd: rawHd[name][index], h: d.driftHeight, W: d.W, pd: d.pd, total: d.totalPressure };
    for (const [key, value] of Object.entries(expected)) {
      if (!near(actual[key], value)) bad.push(`row ${index} ${key}: expected ${value}, got ${actual[key]}`);
    }
  }
  check(label, bad.length === 0, bad.join('\n      '));
}

try {
  const results = {};
  const rawHd = {};
  const outputText = {};
  let legacy;
  for (const name of CASES) {
    results[name] = await runCase(name);
    if (!CAPTURE) rawHd[name] = await page.evaluate(() => {
      const inputs = getInputs(), basics = calculateBasics();
      return configurations.map((c) => ED['7-16'].hd(inputs.pg, c.lu, null, basics.gamma, inputs.is));
    });
    if (!CAPTURE) outputText[name] = await page.evaluate(() =>
      ['basicCalcsTable', 'configurations-table', 'joist-perp-content', 'joist-parallel-content']
        .map((id) => document.getElementById(id).textContent).join(' '));
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
    // P1–P4: every fully allowed drift row has the hand-checked values in §7.2.
    checkPhase0('P1 b0 small fetch, rows 0/1/5', 'b0-defaults', results, rawHd);
    checkPhase0('P2 b1 leeward and windward', 'b1-lowsnow', results, rawHd);
    checkPhase0('P3 b2 small-fetch cap', 'b2-heavy-smallfetch', results, rawHd);
    checkPhase0('P4 b3 Is 0.8', 'b3-light', results, rawHd);
    check('P2 capped b1 row 0 height (W/pd unchanged)', near(rawHd['b1-lowsnow'][0], 2.1783)
      && near(results['b1-lowsnow'].drifts[0].driftHeight, 1.6337));
    check('P3 capped b2 row 1 height (W/pd unchanged)', near(rawHd['b2-heavy-smallfetch'][1], 6.5952)
      && near(results['b2-heavy-smallfetch'].drifts[1].driftHeight, 6.5952));
    check('E1 no NaN or undefined in calculation and joist output', CASES.every((name) => !/\b(?:NaN|undefined)\b/.test(outputText[name])));
    const labels = await page.evaluate(() => ({
      title: document.title,
      badge: document.querySelector('.badge').textContent.trim(),
      text: document.body.textContent,
      caption: document.querySelector('.table-container table caption')?.textContent || '',
    }));
    check('R1 Phase 0: 7-16 references and labels', labels.title === 'Snow Load Calculator - ASCE 7-10'
      && labels.badge === 'ASCE 7-16'
      && /ASCE 7-16 Eq\. 7\.3-1/.test(labels.text)
      && /Table 7\.3-1/.test(labels.text) && /Table 7\.3-2/.test(labels.text)
      && /ASCE 7-16 Fig\. 7\.6-1/.test(labels.caption)
      && !/ASCE 7-22|strength level|Table 7-2|Table 7-3|Fig\. 7-9/.test(labels.text));
    const source = readFileSync(join(PUBLIC_DIR, 'Calcs', FILE), 'utf8');
    check('S1 Phase 0: old figure and fetch floor removed', !/Fig\. 7-9|Math\.max\(lu,\s*25\)/.test(source)
      && source.includes("ED['7-16'].hd(inputs.pg, lu, null, gamma, inputs.is)"));
    check('Phase 0 scope: no edition UI', await page.locator('#edition, #w2, #riskCat').count() === 0);
  }
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
} catch (e) {
  check('harness run', false, String(e.stack || e));
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
