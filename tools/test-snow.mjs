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
const renderIssues = [];
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
function checkNumbers(label, actual, expected, tol = 0.01) {
  const bad = [];
  for (const [key, value] of Object.entries(expected)) {
    const got = key.split('.').reduce((v, part) => v?.[part], actual);
    if (!near(got, value, tol)) bad.push(`${key}: expected ${value}, got ${got}`);
  }
  check(label, bad.length === 0, bad.join('\n      '));
}
async function last() { return page.evaluate(() => JSON.parse(JSON.stringify(window.__snowLast))); }
async function runSnowCase(opts) {
  await fresh();
  if (opts.edition === '7-22') await select('edition', '7-22');
  for (const [id, value] of Object.entries(opts.fill || {})) await fill(id, value);
  for (const [id, value] of Object.entries(opts.select || {})) await select(id, value);
  if (opts.check) for (const id of opts.check) {
    if (await page.locator('#' + id).isVisible()) await page.locator('#' + id).check();
    else await page.evaluate((key) => {
      const el = document.getElementById(key);
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles:true }));
    }, id);
  }
  if (opts.rows) await setRows(opts.rows);
  if (opts.sources) await chooseSources(opts.sources[0], opts.sources[1], opts.sources[2] || {});
  const bad = await page.evaluate(() =>
    ['basicCalcsTable', 'configurations-table', 'joist-perp-content', 'joist-parallel-content']
      .filter((id) => /\b(?:NaN|undefined)\b/.test(document.getElementById(id).textContent)));
  if (bad.length) renderIssues.push(`${opts.edition || '7-16'} pg ${opts.fill?.pg ?? 'default'}: ${bad.join(', ')}`);
  return last();
}
async function noBadOutput(label) {
  const bad = await page.evaluate(() =>
    ['basicCalcsTable', 'configurations-table', 'joist-perp-content', 'joist-parallel-content']
      .filter((id) => /\b(?:NaN|undefined)\b/.test(document.getElementById(id).textContent)));
  check(label, bad.length === 0, bad.join(', '));
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
      basic: document.getElementById('basicCalcsTable').innerText,
      caption: document.getElementById('driftCaption').textContent,
    }));
    check('R1 7-16 references and labels', labels.title === 'Snow Load Calculator - ASCE 7-16'
      && labels.badge === 'ASCE 7-16'
      && /ASCE 7-16 Eq\. 7\.3-1/.test(labels.basic)
      && /Table 7\.3-1/.test(labels.basic) && /Table 7\.3-2/.test(labels.basic)
      && /ASCE 7-16 Fig\. 7\.6-1/.test(labels.caption)
      && !/ASCE 7-22|strength level|Table 7-2|Table 7-3|Fig\. 7-9/.test(labels.basic + labels.caption), JSON.stringify(labels));
    const source = readFileSync(join(PUBLIC_DIR, 'Calcs', FILE), 'utf8');
    const dynamicSelects = [...source.matchAll(/<select\b[^>]*>/g)].filter((m) => m[0].includes('${') && !m[0].includes('cfgType_'));
    check('S1 source: old figure gone and dynamic selects ignored', !source.includes('Fig. 7-9')
      && dynamicSelects.every((m) => m[0].includes('data-are-ignore')), dynamicSelects.map((m) => m[0]).join('\n'));
    await page.evaluate(() => runCalcs());
    const published16 = await page.evaluate(() => JSON.parse(localStorage.getItem('are_hub_v1') || '[]')
      .filter((r) => r.file === 'snow_load_calculator.html'));
    check('7-16 published labels and values', published16.length === 3
      && published16.every((r) => r.label.includes('(ASCE 7-16)'))
      && near(published16.find((r) => r.symbol === 'pf')?.value, 4.998, 1e-9), JSON.stringify(published16));

    // L1: a genuine pre-edition toolbar file must acquire all new static keys.
    await fresh(); await select('edition', '7-22'); await fill('w2', '0.5');
    const legacyFile = JSON.parse(readFileSync(LEGACY, 'utf8'));
    const legacyResult = await page.evaluate((state) => AREv2.loadFromState(state), legacyFile);
    const legacyFields = await page.evaluate(() => ({
      edition: document.getElementById('edition').value, w2: document.getElementById('w2').value,
      riskCat: document.getElementById('riskCat').value, slopeRise: document.getElementById('slopeRise').value,
    }));
    check('L1 legacy 7-16 toolbar state loads without mismatches', legacyResult.ok === true && !legacyResult.rolledBack
      && legacyResult.mismatches.missingOnPage.length === 0 && legacyResult.mismatches.notInFile.length === 0
      && JSON.stringify(legacyFields) === JSON.stringify({ edition:'7-16', w2:'', riskCat:'II', slopeRise:'0' }),
      JSON.stringify({ legacyResult, legacyFields }));
    const legacyDiff = [];
    diff(base['b1-lowsnow'], await snapshot(), 'root', legacyDiff, allowed('b1-lowsnow'));
    check('L1 legacy snapshot matches b1 under Phase 0 ALLOW', legacyDiff.length === 0, legacyDiff.slice(0, 12).join('\n      '));

    // V1: inspect the actual wrapper display styles, including the Rroof subpanel.
    await fresh();
    const visible = () => page.evaluate(() => {
      const show = (id) => {
        const e = document.getElementById(id);
        return getComputedStyle(e.closest('.ed16,.ed22') || e).display !== 'none';
      };
      return { is:show('is'), ct:show('ct'), slipperyR:show('slipperyR'),
        riskCat:show('riskCat'), ct22:show('ct22'), w2:show('w2'),
        rroof:getComputedStyle(document.getElementById('rroofWrap')).display !== 'none',
        badge:document.querySelector('.badge').textContent.trim(), title:document.title };
    });
    const v16 = await visible();
    await select('edition', '7-22'); const v22 = await visible();
    await select('ct22', '1.2'); const v22select = await visible();
    check('V1 edition controls and title', v16.is && v16.ct && v16.slipperyR && !v16.riskCat && !v16.ct22 && !v16.w2
      && !v16.rroof && v16.badge === 'ASCE 7-16' && !v22.is && !v22.ct && !v22.slipperyR
      && v22.riskCat && v22.ct22 && v22.w2 && v22.rroof && v22.badge === 'ASCE 7-22'
      && !v22select.rroof && v16.title === 'Snow Load Calculator - ASCE 7-16' && v22.title === 'Snow Load Calculator - ASCE 7-22',
      JSON.stringify({ v16, v22, v22select }));

    const c1 = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:30, w2:0.55 }, rows:[] });
    checkNumbers('C1 flat heated roof', c1.basics, { ct:1.14, pf:23.94, gamma:17.9, hb:1.337, pm:30 });
    check('C1 strength, table Ct, separate minimum', c1.edition === '7-22' && c1.basics.ctSource === 'table733'
      && c1.basics.level === 'strength' && c1.basics.pmApplies && !c1.basics.rosApplies && c1.drifts.length === 0);
    const ref22 = await page.$eval('#basicCalcsTable', (e) => e.innerText);
    check('R1 7-22 refs and strength caption', /ASCE 7-22 Eq\. 7\.3-1/.test(ref22)
      && /Tables 7\.3-2 \/ 7\.3-3/.test(ref22) && /Eq\. 7\.6-1/.test(ref22)
      && /strength level/.test(ref22) && /0\.7S/.test(ref22) && !/7-16|\bIs\b/.test(ref22), ref22.slice(0, 500));
    const pg22 = await page.evaluate(() => ({ label:document.getElementById('pgLabel').textContent,
      note:document.getElementById('pg22Note').textContent }));
    check('7-22 pg Risk Category and §7.2 note', /Risk Category II.*strength level/.test(pg22.label)
      && /10 psf.*100 ft.*5 psf.*300 ft/.test(pg22.note), JSON.stringify(pg22));
    await page.evaluate(() => runCalcs());
    const published22 = await page.evaluate(() => JSON.parse(localStorage.getItem('are_hub_v1') || '[]')
      .filter((r) => r.file === 'snow_load_calculator.html'));
    check('7-22 published labels and strength values', published22.length === 3
      && published22.every((r) => r.label.includes('(ASCE 7-22, strength level)'))
      && near(published22.find((r) => r.symbol === 'pf')?.value, 23.94, 1e-9), JSON.stringify(published22));
    await noBadOutput('E1 C1 output');

    const c2 = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:30, w2:0.55 },
      rows:[{ type:'parapet', hr:4, lu:60 }], sources:['0',''] });
    checkNumbers('C2 parapet drift', { ...c2.basics, d:c2.drifts[0] },
      { pf:23.94, 'd.hc':2.663, 'd.hcHbRatio':1.991, 'd.hd':3.147,
        'd.driftHeight':2.360, 'd.W':18.88, 'd.pd':42.24, 'd.totalPressure':66.18 });
    const c2joist = await page.evaluate(() => ({ u:parseFloat(document.getElementById('perp-uniform-load').textContent),
      t:parseFloat(document.getElementById('perp-triangular-peak').textContent) }));
    checkNumbers('C2 perpendicular joist loads (display rounded to 0.1 plf)', c2joist, { u:47.88, t:84.49 }, 0.06);
    await noBadOutput('E1 C2 output');

    const c3opts = { edition:'7-22', fill:{ pg:40, rroof:30, w2:0.5 }, select:{ ce:'0.9' },
      rows:[{ type:'leeward', hr:10, lu:100 }] };
    const c3 = await runSnowCase(c3opts);
    checkNumbers('C3 leeward drift', { ...c3.basics, d:c3.drifts[0] },
      { ct:1.13, pf:28.48, gamma:19.2, hb:1.483, 'd.hc':8.517, 'd.hd':3.727,
        'd.W':14.91, 'd.pd':71.55, 'd.totalPressure':100.03 });
    const c3state = await page.evaluate(() => AREv2.captureState());
    await fresh(); const c3load = await page.evaluate((state) => AREv2.loadFromState(state), c3state);
    const c3diff = [];
    diff(c3, await last(), 'root', c3diff);
    check('L2 7-22 toolbar round trip', c3load.ok === true && !c3load.rolledBack && c3diff.length === 0
      && (await page.$eval('#edition', (e) => e.value)) === '7-22'
      && (await page.$eval('#w2', (e) => e.value)) === '0.5', JSON.stringify({ c3load, diff:c3diff.slice(0, 10) }));
    await noBadOutput('E1 C3 output');

    const c4 = await runSnowCase({ ...c3opts, rows:[{ type:'windward', hr:10, lu:240 }] });
    checkNumbers('C4 windward drift', { ...c4.basics, d:c4.drifts[0] },
      { 'd.hd':5.063, 'd.driftHeight':3.797, 'd.W':30.38, 'd.pd':72.91, 'd.totalPressure':101.38 });
    const c5 = await runSnowCase({ edition:'7-22', fill:{ pg:60, w2:0.65 },
      select:{ riskCat:'IV', ct22:'1.2' }, rows:[{ type:'leeward', hr:3, lu:150 }] });
    checkNumbers('C5 leeward cap', { ...c5.basics, d:c5.drifts[0] },
      { pf:50.4, gamma:21.8, hb:2.312, pm:40, 'd.hc':0.688, 'd.hcHbRatio':0.298,
        'd.hd':5.853, 'd.driftHeight':0.688, 'd.W':5.50, 'd.pd':15, 'd.totalPressure':65.40 });
    const c6 = await runSnowCase({ edition:'7-22', fill:{ pg:40, w2:0.55 },
      select:{ ct22:'1.2' }, rows:[{ type:'parapet', hr:3, lu:120 }] });
    checkNumbers('C6 windward taller than hc', { ...c6.basics, d:c6.drifts[0] },
      { pf:33.6, gamma:19.2, hb:1.75, 'd.hc':1.25, 'd.hd':4.3075,
        'd.driftHeight':1.25, 'd.W':66.80, 'd.pd':24, 'd.totalPressure':57.60 });
    const c7 = await runSnowCase({ edition:'7-22', fill:{ pg:20, rroof:20, w2:0.35 },
      rows:[{ type:'parapet', hr:1, lu:50 }] });
    checkNumbers('C7 hc/hb gate', { ...c7.basics, d:c7.drifts[0] },
      { ct:1.11, pf:15.54, gamma:16.6, hb:0.936, 'd.hc':0.064,
        'd.hcHbRatio':0.068, 'd.driftHeight':0, 'd.W':0, 'd.pd':0, 'd.totalPressure':15.54 });

    const c8 = await runSnowCase({ ...c3opts, fill:{ pg:40, rroof:30, w2:'' }, sources:['0','0'] });
    const c8text = await page.$eval('#configurations-table', (e) => e.innerText);
    const c8joist = await page.evaluate(() => ({ perp:document.getElementById('perp-triangular-peak').textContent,
      par:document.getElementById('parallel-max-joist-load').textContent }));
    check('C8 W2 blank guard and visible warning', c8.basics.w2Missing === true
      && c8.drifts.every((d) => d.driftHeight === 0 && d.W === 0 && d.pd === 0 && near(d.totalPressure, c8.basics.pf, 1e-9))
      && /W2.*required/.test(c8text) && c8joist.perp === '0.0 plf' && c8joist.par === '0.0 plf',
      JSON.stringify({ c8:c8.drifts, c8text, c8joist }));
    await noBadOutput('E1 C8 W2 blank output');

    const c9 = await page.evaluate(() => [[27.5,20],[30,55],[5,60],[80,50],[35,25]]
      .map(([pg,r]) => ctFromTable733(pg,r)));
    check('C9 Ct interpolation edges', [1.065,1.20,1.20,1.18,1.0825].every((v,i) => near(c9[i],v,1e-9)), JSON.stringify(c9));

    const c10 = await runSnowCase({ edition:'7-22', fill:{ pg:32, w2:0.35, slopeRise:0.25, eaveRidgeW:100 },
      select:{ riskCat:'IV', ct22:'1.2' }, rows:[] });
    checkNumbers('C10 rain-on-snow and minimum', c10.basics,
      { theta:1.19, cs:1, ps:26.88, ros:34.88, pm:32 });
    check('C10 cases are separate', c10.basics.rosApplies && c10.basics.pmApplies && !c10.basics.unbal.applies
      && c10.basics.panel === 'c');
    await noBadOutput('E1 C10 output');
    const c10old = await runSnowCase({ fill:{ pg:32, slopeRise:0.25, eaveRidgeW:100 },
      select:{ ct:'1.2', is:'1.2' }, rows:[] });
    checkNumbers('C10 7-16 counterpart minimum', c10old.basics, { pm:24 });
    check('C10 7-16 rain-on-snow not applicable', c10old.basics.pmApplies && !c10old.basics.rosApplies);
    await noBadOutput('E1 C10 7-16 output');

    const c11 = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:30, w2:0.55, slopeRise:6, eaveRidgeW:30 },
      rows:[] });
    checkNumbers('C11 sloped roof and unbalanced surcharge', c11.basics,
      { theta:26.57, ct:1.14, cs:1, ps:23.94, 'unbal.windward':7.18,
        'unbal.hd':2.469, 'unbal.surcharge':31.25, 'unbal.extent':9.31,
        'unbal.leewardPeak':55.19 });
    check('C11 case gates', c11.basics.panel === 'b' && !c11.basics.pmApplies
      && !c11.basics.rosApplies && c11.basics.unbal.applies);
    await noBadOutput('E1 C11 output');
    const c11old = await runSnowCase({ fill:{ pg:30, slopeRise:6, eaveRidgeW:30 },
      select:{ ct:'1.1', is:'1.0' }, rows:[] });
    checkNumbers('C11 7-16 counterpart', c11old.basics,
      { cs:1, ps:23.1, 'unbal.hd':1.860, 'unbal.surcharge':23.54,
        'unbal.extent':7.02, 'unbal.leewardPeak':46.64 });
    check('C11 7-16 cold panel', c11old.basics.panel === 'b' && c11old.basics.unbal.applies);
    await noBadOutput('E1 C11 7-16 output');

    const c12 = await runSnowCase({ edition:'7-22', fill:{ pg:40, w2:0.45, slopeRise:8, eaveRidgeW:24 },
      select:{ ce:'0.9', ct22:'1.2', roofSurface:'slippery' }, rows:[] });
    checkNumbers('C12 cold slippery slope', c12.basics,
      { theta:33.69, pf:30.24, cs:0.660, ps:19.96, hb:1.040 });
    check('C12 unbalanced and pm gates', c12.basics.panel === 'c' && !c12.basics.unbal.applies && !c12.basics.pmApplies);
    await noBadOutput('E1 C12 output');

    const c13 = await runSnowCase({ edition:'7-22', fill:{ pg:25, w2:0.35, slopeRise:4, eaveRidgeW:16 },
      select:{ riskCat:'I', ct22:'1.2' }, check:['gableSimple'], rows:[] });
    checkNumbers('C13 simple gable, no Is', c13.basics,
      { theta:18.43, 'unbal.leeward':25, 'unbal.windward':0 });
    check('C13 simple case gates', c13.basics.unbal.applies && !c13.basics.pmApplies
      && c13.basics.unbal.surcharge === null);
    await noBadOutput('E1 C13 output');
    const c13old = await runSnowCase({ fill:{ pg:25, slopeRise:4, eaveRidgeW:16 },
      select:{ ct:'1.2', is:'0.8' }, check:['gableSimple'], rows:[] });
    checkNumbers('C13 7-16 counterpart Ipg', c13old.basics, { 'unbal.leeward':20, 'unbal.windward':0 });
    await noBadOutput('E1 C13 7-16 output');

    const c14 = await runSnowCase({ fill:{ pg:30, slopeRise:12 },
      select:{ ct:'1.0', is:'1.0', roofSurface:'slippery' }, rows:[] });
    checkNumbers('C14 7-16 warm slippery R gate off', c14.basics, { theta:45, cs:0.625 });
    const c14on = await runSnowCase({ fill:{ pg:30, slopeRise:12 },
      select:{ ct:'1.0', is:'1.0', roofSurface:'slippery' }, check:['slipperyR'], rows:[] });
    checkNumbers('C14 7-16 warm slippery R gate on', c14on.basics, { cs:0.3846 }, 5e-4);
    const c14new = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:30, w2:0.35, slopeRise:12 },
      select:{ roofSurface:'slippery' }, rows:[] });
    // Table 7.3-3 (p0123): pg 30 / Rroof 30 → Ct 1.14 (panel b, slippery knee 10°).
    checkNumbers('C14 7-22 Table 7.3-3 at Rroof 30', c14new.basics,
      { ct:1.14, cs:0.4166666666666667 }, 5e-4);
    // Rroof 20 → Ct 1.05 (panel a). 7-22 Fig. 7.4-1(a) has one "All Surfaces" curve
    // (knee 30°, zero at 70°): slippery gets no reduction → Cs = 1 − 15/40 = 0.625.
    const c14r20 = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:20, w2:0.35, slopeRise:12 },
      select:{ roofSurface:'slippery' }, rows:[] });
    checkNumbers('C14 7-22 warm roof: slippery uses All Surfaces curve', c14r20.basics, { ct:1.05, cs:0.625 }, 5e-4);
    const c14r20Checked = await runSnowCase({ edition:'7-22', fill:{ pg:30, rroof:20, w2:0.35, slopeRise:12 },
      select:{ roofSurface:'slippery' }, check:['slipperyR'], rows:[] });
    checkNumbers('C14 7-22 ignores 7-16 R checkbox', c14r20Checked.basics, { ct:1.05, cs:0.625 }, 5e-4);
    await noBadOutput('E1 C14 output');
    check('E1 all 7-22 and 7-16 cases have clean output', renderIssues.length === 0, renderIssues.join('\n      '));
  }
  check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
} catch (e) {
  check('harness run', false, String(e.stack || e));
} finally {
  await browser.close();
}
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
