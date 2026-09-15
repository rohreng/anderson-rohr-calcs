# MWFRS Open / Partially Open Building Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the live MWFRS calc so its enclosure dropdown covers Enclosed / Partially Enclosed / Partially Open / Open, with the open-building path (free-roof CN, Fig. 27.3-7 transverse case, §28.3.5 frame force) merged in from Nick's standalone source file — without changing any existing enclosed/partially-enclosed number except the agreed parallel-to-ridge roof fix.

**Architecture:** One HTML file (`public/Calcs/asce716_mwfrs_calculator.html`) keeps its existing engine. New pure functions (`openRoofCN`, `openTransverseCN`, `longFrameForce`, `cnRow`) and data tables are added beside the existing ones; `calculate()` branches on `encl === 'open'`. A Playwright harness captures a baseline from the untouched calc first and is the regression gate for every later task. Two Fable-agent QAQC gates bracket the code work.

**Tech Stack:** Static HTML + vanilla JS (ES5 style, `var`/`function`, matching the file), Playwright (already in `node_modules`) for the harness, Next.js registry in `app/lib/calcs.ts`. Git commits go through `/tmp/are-git` (its `core.worktree` is the OneDrive repo; the in-place `.git` is stale).

**Spec:** `docs/superpowers/specs/2026-09-15-mwfrs-open-building-merge-design.md`

**Paths used below** (all relative to `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\` unless absolute):
- CALC = `public/Calcs/asce716_mwfrs_calculator.html`
- SOURCE = `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ASCE\ASCE 7-16 Ch27 Pt1 Wind Loading Calculator - html.html`
- PDF = `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ASCE\ASCE 7-16.pdf`
- Git: `git -C /tmp/are-git <cmd>` from Bash (Git Bash). Paths in `git add` are repo-relative.

---

## File map

| File | Change |
|---|---|
| `tools/test-mwfrs-wind.mjs` | **Create.** Playwright harness: `--capture` writes baseline; default run compares baseline, checks parallel-ridge fix, open path, §28.3.5, save/load round-trip, legacy load, UI sweep. |
| `fixtures/mwfrs-wind/baseline.json` | **Create** (by harness) from the untouched calc. |
| `docs/mwfrs-open-qaqc-2026-09.md` | **Create** (by Gate 1 agent), appended by Gate 2 agent. |
| CALC | **Modify.** Inputs, engine additions, open-path render, save/load, URL prefill, header. |
| `app/lib/calcs.ts:58-70` | **Modify.** Subtitle + keywords for `mwfrs-wind`. |

Merged input IDs (existing kept, new added):

| id | values / default | shown when |
|---|---|---|
| `encl` | `enclosed` (default), `partial`, `partialOpen`, `open` | always |
| `groundElev` | number, ft, default 0 → writes `Ke` | always |
| `Ke` | existing, now an override | always |
| `roofType` | `flat`, `gablehip` (default), `monoslope`, `mansard` | walled |
| `freeRoofShape` | `monoslope`, `pitched` (default), `troughed` | open |
| `windFlow` | `clear` (default), `obstructed` | open |
| `ridgeDir` | `D` (default; ridge runs along D/NS), `B` | walled non-flat, or open |
| `roofAngleMode` | `deg` (default), `pitch` | walled non-flat, or open |
| `theta` | existing, min 0 max 80, default 18 | angle mode deg |
| `pitchRise` | default 4 | angle mode pitch |
| `hp` | existing | walled |
| `numFrames` | default 4 | §28.3.5 eligible |
| `AsArea` | default 0, ft² | §28.3.5 eligible |

Direction convention (unchanged): Wind-X = wind along EW, L = B, B⊥ = D. Wind-Y = wind along NS, L = D, B⊥ = B. With `ridgeDir = 'D'` the ridge runs NS, so **Wind-X is normal to the ridge** and Wind-Y is parallel. With `ridgeDir = 'B'` it is the reverse.

---

### Task 0: Baseline regression harness (run against the UNTOUCHED calc)

**Files:**
- Create: `tools/test-mwfrs-wind.mjs`
- Create: `fixtures/mwfrs-wind/baseline.json` (generated)

- [ ] **Step 1: Write the harness**

```js
// =============================================================================
// MWFRS wind calculator — regression + merge harness
// -----------------------------------------------------------------------------
// Usage: node tools/test-mwfrs-wind.mjs            compare against baseline + new-behavior checks
//        node tools/test-mwfrs-wind.mjs --capture  (re)write fixtures/mwfrs-wind/baseline.json
//
// Baseline = window.__mwfrsLast + buildRevitWindPayload() for four walled cases,
// captured from the calc BEFORE the open-building merge (2026-09-15). The only
// baseline paths allowed to differ after the merge are the parallel-to-ridge
// roof block of the two sloped cases (agreed fix: Fig. 27.3-1 zone table applies
// for wind parallel to the ridge) and the roofType label sloped→gablehip.
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const FIX_DIR = fileURLToPath(new URL('../fixtures/mwfrs-wind/', import.meta.url));
const FIX = FIX_DIR + 'baseline.json';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'asce716_mwfrs_calculator.html';
const CAPTURE = process.argv.includes('--capture');
const TOL = 1e-9;

// Four walled cases. roof:'sloped' maps to the legacy option before the merge and to 'gablehip' after.
const CASES = [
  { name: 'enclosed-flat-3story-parapet', encl: 'enclosed', roof: 'flat',   theta: 0,  hp: 3, V: 115, exp: 'C', B: 60,  D: 120, h: 40, stories: [14, 13, 13] },
  { name: 'enclosed-sloped20-2story',     encl: 'enclosed', roof: 'sloped', theta: 20, hp: 0, V: 120, exp: 'B', B: 50,  D: 80,  h: 30, stories: [15, 15] },
  { name: 'partial-flat-1story-parapet',  encl: 'partial',  roof: 'flat',   theta: 0,  hp: 2, V: 130, exp: 'D', B: 100, D: 200, h: 24, stories: [24] },
  { name: 'partial-sloped35-3story',      encl: 'partial',  roof: 'sloped', theta: 35, hp: 0, V: 115, exp: 'C', B: 40,  D: 90,  h: 36, stories: [12, 12, 12] },
];
// Paths that may legitimately differ from baseline for the sloped cases (see header).
const ALLOW_SLOPED = [/^last\.roofType$/, /^last\.roofY(\.|$)/, /^revit\.inputs\.roofType$/, /^revit\.roof(\.|$)/];

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
async function fresh() {
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
}
async function setIf(sel, val) { if (await page.$(sel)) await page.selectOption(sel, val); }
async function fillIf(sel, val) { if (await page.$(sel)) await page.fill(sel, String(val)); }
async function setStories(list) {
  for (let i = 1; i < list.length; i++) await page.click('.btn-add-floor');
  const shs = await page.$$('#storyRows .sh');
  for (let i = 0; i < list.length; i++) await shs[i].fill(String(list[i]));
}
async function snapshot() {
  return page.evaluate(() => ({
    last: JSON.parse(JSON.stringify(window.__mwfrsLast)),
    revit: (() => { const p = buildRevitWindPayload(); if (p) delete p.generatedAt; return p; })(),
  }));
}
async function runWalled(c) {
  await fresh();
  const legacy = (await page.$('#roofType option[value="sloped"]')) !== null;
  await page.fill('#V', String(c.V)); await page.selectOption('#exp', c.exp); await page.selectOption('#encl', c.encl);
  await page.fill('#B', String(c.B)); await page.fill('#D', String(c.D)); await page.fill('#h', String(c.h)); await page.fill('#hp', String(c.hp));
  await page.selectOption('#roofType', c.roof === 'sloped' ? (legacy ? 'sloped' : 'gablehip') : c.roof);
  if (c.roof === 'sloped') { await setIf('#roofAngleMode', 'deg'); await page.fill('#theta', String(c.theta)); }
  await setStories(c.stories);
  await page.click('button.calc-btn');
  return snapshot();
}
// Walk expected (baseline) and require every path to exist and match in actual.
function diff(exp, act, path, out, allow) {
  if (allow.some((re) => re.test(path))) return;
  if (typeof exp === 'number') {
    if (typeof act !== 'number' || Math.abs(exp - act) > TOL) out.push(`${path}: ${exp} → ${act}`);
  } else if (exp === null || typeof exp !== 'object') {
    if (exp !== act) out.push(`${path}: ${JSON.stringify(exp)} → ${JSON.stringify(act)}`);
  } else if (Array.isArray(exp)) {
    if (!Array.isArray(act) || act.length !== exp.length) { out.push(`${path}: length ${exp.length} → ${act && act.length}`); return; }
    exp.forEach((v, i) => diff(v, act[i], `${path}[${i}]`, out, allow));
  } else {
    if (act === null || typeof act !== 'object') { out.push(`${path}: object → ${JSON.stringify(act)}`); return; }
    Object.keys(exp).forEach((k) => diff(exp[k], act[k], `${path}.${k}`, out, allow));
  }
}

// ── 1. baseline capture / compare ───────────────────────────────────────────
const results = {};
for (const c of CASES) results[c.name] = await runWalled(c);
if (CAPTURE) {
  if (!existsSync(FIX_DIR)) mkdirSync(FIX_DIR, { recursive: true });
  writeFileSync(FIX, JSON.stringify({ capturedAt: new Date().toISOString(), cases: results }, null, 1));
  console.log('baseline written: ' + FIX);
} else {
  const base = JSON.parse(readFileSync(FIX, 'utf8')).cases;
  for (const c of CASES) {
    const out = [];
    diff(base[c.name], results[c.name], '', out, c.roof === 'sloped' ? ALLOW_SLOPED : []);
    check(`baseline ${c.name}`, out.length === 0, out.slice(0, 12).join('\n      '));
  }
}
check('no page errors (baseline cases)', pageErrors.length === 0, pageErrors.join('\n      '));

if (!CAPTURE) {
  // ── 2. parallel-to-ridge fix on the sloped cases (ridge along D → Wind-Y parallel) ──
  // Independent constants: Fig. 27.3-1 zone table, Cp1 by zone, Cp2 = -0.18; p = qh·G·Cp ∓ qh·GCpi.
  for (const c of CASES.filter((x) => x.roof === 'sloped')) {
    const r = results[c.name].last, ry = r.roofY, GCpi = c.encl === 'enclosed' ? 0.18 : 0.55;
    check(`${c.name}: Wind-Y roof uses zone table`, ry && ry.type === 'flat', JSON.stringify(ry && ry.type));
    const cp1 = { '0–h/2': -0.9, 'h/2–h': -0.9, 'h–2h': -0.5, '>2h': -0.3 };
    const bad = [];
    (ry.zones || []).forEach((z) => {
      const eA = r.qh * 0.85 * cp1[z.zone] - r.qh * GCpi, eB = r.qh * 0.85 * (-0.18) + r.qh * GCpi;
      if (Math.abs(z.pA - eA) > 1e-6 || Math.abs(z.pB - eB) > 1e-6) bad.push(`${z.zone}: pA ${z.pA} vs ${eA}, pB ${z.pB} vs ${eB}`);
    });
    check(`${c.name}: Wind-Y zone pressures`, bad.length === 0, bad.join('\n      '));
  }

  // ── 3. open path — pitched, clear, θ = 15°, ridge along D ────────────────
  // Independent: Kz(20 ft, C) = 0.90 (Table 26.10-1); qh = 0.00256·Kz·Kzt·Kd·Ke·V²;
  // Fig. 27.3-5 θ=15° clear: A (CNW 1.1, CNL -0.4), B (0.1, -1.1); Fig. 27.3-7 clear: ≤h A -0.8 B 0.8, h–2h A -0.6 B 0.5, >2h A -0.3 B 0.3.
  await fresh();
  await page.fill('#V', '115'); await page.selectOption('#exp', 'C'); await page.selectOption('#encl', 'open');
  await page.fill('#B', '40'); await page.fill('#D', '100'); await page.fill('#h', '20');
  await page.selectOption('#freeRoofShape', 'pitched'); await page.selectOption('#windFlow', 'clear');
  await page.selectOption('#ridgeDir', 'D'); await page.selectOption('#roofAngleMode', 'deg'); await page.fill('#theta', '15');
  await page.fill('#numFrames', '4'); await page.fill('#AsArea', '0');
  await page.click('button.calc-btn');
  const o = await snapshot();
  const qh = 0.00256 * 0.90 * 1.0 * 0.85 * 1.0 * 115 * 115, G = 0.85;
  check('open: qh', Math.abs(o.last.qh - qh) < 1e-6, `${o.last.qh} vs ${qh}`);
  const rows = o.last.open.rows;
  const expRows = [['A', 1.1, -0.4], ['B', 0.1, -1.1]];
  check('open: two CN rows (0°,180°)', rows.length === 2, JSON.stringify(rows));
  expRows.forEach(([k, w, l], i) => {
    const r = rows[i] || {};
    check(`open: case ${k} CN/p`, r.kase === k && Math.abs(r.CNW - w) < 1e-9 && Math.abs(r.CNL - l) < 1e-9
      && Math.abs(r.pW - qh * G * w) < 1e-6 && Math.abs(r.pL - qh * G * l) < 1e-6, JSON.stringify(r));
  });
  const tr = o.last.open.trans, expTr = [[-0.8, 0.8], [-0.6, 0.5], [-0.3, 0.3]];
  check('open: three transverse zones', tr.length === 3, JSON.stringify(tr));
  expTr.forEach(([a, b], i) => {
    const z = tr[i] || {};
    check(`open: transverse zone ${i}`, Math.abs(z.A - a) < 1e-9 && Math.abs(z.B - b) < 1e-9
      && Math.abs(z.pA - qh * G * a) < 1e-6 && Math.abs(z.pB - qh * G * b) < 1e-6, JSON.stringify(z));
  });
  check('open: h/L', Math.abs(o.last.open.hL - 20 / 40) < 1e-9, String(o.last.open.hL));
  check('open: walled blocks hidden', await page.evaluate(() =>
    ['wxBlk', 'wyBlk', 'roofBlk', 'sendBlk', 'parapetBlk'].every((id) => document.getElementById(id).style.display === 'none')), 'a walled block is visible');
  check('open: open blocks shown', await page.evaluate(() =>
    ['openBlk', 'openTransBlk', 'frameBlk', 'minBlk'].every((id) => document.getElementById(id).style.display !== 'none')), 'an open block is hidden');
  check('open: revit payload null', o.revit === null, JSON.stringify(o.revit));

  // §28.3.5 — independent recompute with typed constants (Fig. 28.3-1 LC B: 5 = 0.40, 6 = -0.29, 5E = 0.61, 6E = -0.43)
  const f = o.last.frame;
  const Wp = 40, Lr = 100, h = 20, th = 15 * Math.PI / 180;
  const rise = (Wp / 2) * Math.tan(th), eave = h - rise / 2, AE = Wp * eave + 0.5 * Wp * rise;
  const least = Math.min(Wp, Lr), a = Math.max(Math.min(0.1 * least, 0.4 * h), Math.max(0.04 * least, 3));
  const Aedge = a * eave, Abulk = AE - Aedge;
  const gW = (0.40 * Abulk + 0.61 * Aedge) / AE, gL = (-0.29 * Abulk - 0.43 * Aedge) / AE;
  const KB = 1.8 - 0.01 * Wp, KS = 0.60 + 0.073 * (4 - 3) + 1.25 * Math.pow(0, 1.8);
  const F = qh * (gW - gL) * KB * KS * AE;
  check('frame: present for open pitched', !!f, 'frame is null');
  if (f) {
    check('frame: AE', Math.abs(f.AE - AE) < 1e-6, `${f.AE} vs ${AE}`);
    check('frame: a', Math.abs(f.a - a) < 1e-9, `${f.a} vs ${a}`);
    check('frame: KB, KS', Math.abs(f.KB - KB) < 1e-9 && Math.abs(f.KS - KS) < 1e-9, `${f.KB},${f.KS} vs ${KB},${KS}`);
    check('frame: F', Math.abs(f.F - F) < 1e-4, `${f.F} vs ${F}`);
  }

  // ── 4. save/load round-trip on the open case ─────────────────────────────
  const saved = await page.evaluate(() => collectInputsMWFRS());
  await fresh();
  await page.evaluate((d) => { applyInputsMWFRS(d); calculate(); }, saved);
  const o2 = await snapshot();
  const rt = []; diff(o.last, o2.last, 'last', rt, []);
  check('round-trip: open case identical', rt.length === 0, rt.slice(0, 8).join('\n      '));

  // ── 5. legacy save file (roofType 'sloped') loads as gablehip ───────────
  await fresh();
  await page.evaluate(() => applyInputsMWFRS({ _version: 1, _calc: 'mwfrs', V: '120', exp: 'B', encl: 'enclosed', Kzt: '1', Ke: '1', B: '50', D: '80', h: '30', roofType: 'sloped', theta: '20', hp: '0', stories: [{ label: 'Roof', h: '15' }, { label: 'Floor 1', h: '15' }] }));
  check('legacy: roofType mapped', (await page.$eval('#roofType', (e) => e.value)) === 'gablehip', 'not gablehip');
  check('legacy: theta row visible', await page.$eval('#thetaRow', (e) => e.style.display !== 'none'), 'theta hidden');
  await page.click('button.calc-btn');
  const o3 = await snapshot();
  const lg = []; diff(results['enclosed-sloped20-2story'].last, o3.last, 'last', lg, []);
  check('legacy: matches the gablehip case', lg.length === 0, lg.slice(0, 8).join('\n      '));

  // ── 6. UI sweep — every enclosure × roof combination renders, no NaN ────
  const combos = [];
  for (const encl of ['enclosed', 'partial', 'partialOpen']) for (const rt2 of ['flat', 'gablehip', 'monoslope', 'mansard']) combos.push({ encl, roofType: rt2 });
  for (const shape of ['monoslope', 'pitched', 'troughed']) for (const flow of ['clear', 'obstructed']) combos.push({ encl: 'open', shape, flow });
  for (const cb of combos) {
    await fresh();
    await page.selectOption('#encl', cb.encl);
    if (cb.roofType) await page.selectOption('#roofType', cb.roofType);
    if (cb.shape) { await page.selectOption('#freeRoofShape', cb.shape); await page.selectOption('#windFlow', cb.flow); }
    await page.click('button.calc-btn');
    const txt = await page.$eval('#results', (e) => e.innerText);
    check(`sweep ${JSON.stringify(cb)}`, !/NaN|undefined/.test(txt) && txt.length > 200, txt.slice(0, 160));
  }
  check('no page errors (all)', pageErrors.length === 0, pageErrors.join('\n      '));
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
```

- [ ] **Step 2: Capture the baseline from the untouched calc**

Run (Bash, from the repo folder):
```bash
cd "/c/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs" && node tools/test-mwfrs-wind.mjs --capture
```
Expected: `baseline written: .../fixtures/mwfrs-wind/baseline.json` and `PASS no page errors (baseline cases)` then `ALL PASS`.

- [ ] **Step 3: Sanity-check the baseline content**

```bash
node -e "const b=require('./fixtures/mwfrs-wind/baseline.json');for(const k in b.cases){const l=b.cases[k].last;console.log(k,'qh',l.qh.toFixed(2),'VbX',l.wx.rows.at(-1).V_cum.toFixed(0),'roofY',l.roofY.type)}"
```
Expected: four lines; sloped cases show `roofY sloped`, flat cases `roofY flat`; qh non-zero.

- [ ] **Step 4: Commit**

```bash
git -C /tmp/are-git add tools/test-mwfrs-wind.mjs fixtures/mwfrs-wind/baseline.json docs/superpowers/specs/2026-09-15-mwfrs-open-building-merge-design.md docs/superpowers/plans/2026-09-15-mwfrs-open-building-merge.md
git -C /tmp/are-git commit -m "test(calcs): MWFRS wind regression harness + pre-merge baseline; open-building merge spec/plan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1: Gate 1 — Fable agent QAQC of the source file (blocking)

**Files:**
- Create: `docs/mwfrs-open-qaqc-2026-09.md` (written by the agent)

- [ ] **Step 1: Dispatch the agent** (Agent tool, `model: "fable"`, `run_in_background: false`)

Prompt:

```
You are QAQC-ing a structural wind-load calculator against ASCE 7-16 before its logic is merged into a production calc. Be adversarial and exact. Do not modify any file except the report you write.

FILES
- SOURCE (new open-building calc): C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ASCE\ASCE 7-16 Ch27 Pt1 Wind Loading Calculator - html.html  (JS starts at line 411)
- LIVE calc whose Fig. 27.3-1 tables also feed the merge: C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\public\Calcs\asce716_mwfrs_calculator.html  (KZ_TABLE ~line 233, ROOF_CP_SLOPED ~line 246, getKz/qz/lerpCpLW/flatRoofCp/slopedRoofCp lines 265-348)
- CODE: C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ASCE\ASCE 7-16.pdf (66 MB). Locate pages by searching text, e.g. with Python: `from pypdf import PdfReader` and scan page.extract_text() for "27.3-4", "26.13-1", "28.3.5". Read the located pages with the Read tool `pages` parameter. Figures are images; read the printed coefficient tables carefully and quote them.

VERIFY, item by item, quoting the code value and the file value:
1. Table 26.13-1 GCpi for all four enclosure classes (SOURCE `GCPI`).
2. Table 26.9-1 / Eq. for Ke: SOURCE uses Ke = exp(-0.0000362·z_g). Confirm against the table values at 0, 1000, 2000, 3000, 4000, 5000, 6000 ft.
3. Table 26.11-1 α, z_g, z_min (SOURCE `EXPOSURE`) and Eq. 26.10-1 velocity pressure (SOURCE `qCalc`). Also confirm LIVE `KZ_TABLE` (Table 26.10-1) row by row for B, C, D.
4. Fig. 27.3-1: wall Cp (windward 0.8; leeward vs L/B; side −0.7); roof Cp for wind normal to ridge θ ≥ 10° at h/L ≤ 0.25, 0.5, ≥ 1.0 for every θ row (10,15,20,25,30,35,45,≥60) — check BOTH SOURCE `ROOF_WINDWARD`/`ROOF_LEEWARD` and LIVE `ROOF_CP_SLOPED`. Flag the LIVE θ = 60 row specifically (it stores 0.34; the figure says windward Cp = 0.01θ for θ ≥ 60 — confirm). Confirm the zone table for θ < 10 / wind parallel to ridge (h/L ≤ 0.5 and ≥ 1.0) and Notes 3, 4 (monoslope), 6 (mansard), and the note on treating h/L between tabulated values. State exactly what Fig. 27.3-1 says for wind PARALLEL to the ridge on a pitched roof.
5. Figs. 27.3-4 (monoslope), 27.3-5 (pitched), 27.3-6 (troughed): every CN value for every θ row, clear and obstructed, cases A and B, γ = 0 and 180 (SOURCE `CN_MONO`, `CN_PITCHED`, `CN_TROUGHED`). Confirm the θ < 7.5° note and the interpolation note. Confirm the h/L applicability range.
6. Fig. 27.3-7 (γ = 90°, 270°): zone boundaries and CN A/B, clear/obstructed (SOURCE `CN_TRANSVERSE`).
7. §27.3.2 / Eq. 27.3-2: p = qh·G·CN for open buildings; confirm G = 0.85 is what §26.11.1 allows for rigid buildings, and which q is used (qh at mean roof height).
8. §28.3.5 in full: applicability (enclosure classes, roof form, θ limit, frame arrangement), Eq. 28.3-3 and 28.3-4, definition of AE, AS, φ, n, B, KB, KS, and exactly how GCpf windward/leeward are taken from Fig. 28.3-1 Load Case B (zones 5, 6, 5E, 6E and the geometry of the end zones — width, height, whether they occur at both edges). Compare with SOURCE `runLongFrame` (edge area = a × eave height; a per the notation; qh at mean roof height). State whether SOURCE's edge-zone area is right and, if not, give the correct expression.
9. §27.1.5 minimum design wind loads for walled and for open buildings, and Fig. 27.3-8 load cases 1–4 (SOURCE lines 384-400).
10. Parapet §27.3.5 Eq. 27.3-3 GCpn = +1.5 / −1.0 and q_p at the top of the parapet (SOURCE and LIVE).
11. SOURCE's hEff rule (`theta > 10 ? h : eaveH`) — quote the Fig. 27.3-1 / §26.2 definition of h and say whether the rule is correct (note the ≤ vs <).

HAND-CHECK three open cases end-to-end with the code equations (show every intermediate number):
 A. Open, monoslope free roof, clear, θ = 15°, V = 115 mph, Exp C, Kzt = 1, Kd = 0.85, ground elev 0, h = 20 ft, roof 40 ft along-wind × 100 ft ridge. Report CN and p for γ = 0/180, A/B, and Fig. 27.3-7 zones.
 B. Open, pitched, obstructed, θ = 22.5°, V = 130, Exp D, h = 18, 50 ft × 120 ft. Also §28.3.5 F with n = 5 frames, AS = 0.
 C. Open, troughed, clear, θ = 10° (between table rows), V = 115, Exp B, h = 25, 60 ft × 80 ft.
Then open SOURCE in a headless browser if you can (node + playwright is in the ARE repo node_modules: `import { chromium } from 'playwright'`; serve the file with file:// URL) and compare its displayed numbers to your hand values. If you cannot run a browser, compute by reading the JS and say so.

OUTPUT: write C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\docs\mwfrs-open-qaqc-2026-09.md with:
 - "Gate 1 — source file" heading, date 2026-09-15
 - A findings table: ID, severity (BLOCKER = wrong number/logic that changes a design pressure; MAJOR = wrong applicability/limit; MINOR = label/note), code reference (section/figure/table + PDF page), file + line, what the file has, what the code says, fix.
 - The three hand checks with all intermediates.
 - A short "verified correct" list of everything that matched.
Return the findings table in your final message too.
```

- [ ] **Step 2: Read the report and decide each finding**

Open `docs/mwfrs-open-qaqc-2026-09.md`. For every BLOCKER/MAJOR, decide the fix and note it in the "Decision" column you add to the table (fix-in-merge / not-applicable-with-reason). Anything that changes the engine code in Tasks 3–4 is applied there — in particular:
- §28.3.5 edge-zone geometry (item 8) → `longFrameForce` in Task 3.
- LIVE `ROOF_CP_SLOPED` θ = 60 row (item 4) → fix the table in Task 3 if confirmed (baseline cases use 20° and 35°, so the regression stays valid).
- hEff rule (item 11) → the merged calc keeps `h` as the single mean-roof-height input; if the agent confirms θ ≤ 10 should use eave height, add a note in the roof block, no new input.

- [ ] **Step 3: Commit the report**

```bash
git -C /tmp/are-git add docs/mwfrs-open-qaqc-2026-09.md
git -C /tmp/are-git commit -m "docs(calcs): MWFRS open-building QAQC — Gate 1 findings on the source file

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Inputs — enclosure, roof, ridge, angle mode, elevation, frame inputs

**Files:**
- Modify: CALC lines 86-89 (header), 116-137 (wind parameters), 142-163 (geometry), 355-358 (`toggleRoofInputs`)

- [ ] **Step 1: Header text**

Replace
```html
  <div class="sub">Chapter 27, Part 1 — Directional Procedure, All Heights | Enclosed &amp; Partially Enclosed Buildings</div>
```
with
```html
  <div class="sub">Chapter 27, Part 1 — Directional Procedure, All Heights | Enclosed, Partially Enclosed, Partially Open &amp; Open Buildings (free roofs per Figs. 27.3-4 to 27.3-7, §28.3.5 frames)</div>
```

- [ ] **Step 2: Wind parameters block — enclosure options, ground elevation**

Replace the `#encl` select and the `#Ke` input:
```html
      <div class="ig">
        <label>Enclosure Classification</label>
        <select id="encl" onchange="toggleRoofInputs()">
          <option value="enclosed" selected>Enclosed</option>
          <option value="partial">Partially Enclosed</option>
          <option value="partialOpen">Partially Open</option>
          <option value="open">Open (free roof)</option>
        </select>
      </div>
      <div class="ig"><label>Kzt (Topo Factor)</label><input type="number" id="Kzt" value="1.00" min="1" max="3" step="0.01"/></div>
      <div class="ig"><label>Ground Elev. (ft)</label><input type="number" id="groundElev" value="0" min="-1000" max="12000" step="10" oninput="updateKeFromElev()"/></div>
      <div class="ig"><label>Ke (Ground Elev. Factor)</label><input type="number" id="Ke" value="1.00" min="0.6" max="1.05" step="0.001"/></div>
    </div>
    <div class="ref">Kd = 0.85 (Table 26.6-1, Buildings) | G = 0.85 (§26.11.1, Rigid) | Eq. 26.10-1: q = 0.00256·Kz·Kzt·Kd·Ke·V² | Ke = e<sup>−0.0000362·z<sub>g</sub></sup> (Table 26.9-1) — computed from ground elevation, editable | GCpi per Table 26.13-1: Enclosed ±0.18, Partially Enclosed ±0.55, Partially Open ±0.18, Open 0</div>
```

- [ ] **Step 3: Geometry block — roof type, free-roof shape, ridge, angle, parapet, frames**

Replace the geometry `.row`s (from `<div class="row">` containing `#B` through the `#hp` row, keeping the `.ref` line and `#mwfrsDiagWrap`) with:
```html
    <div class="row">
      <div class="ig"><label>Width B (ft) — EW</label><input type="number" id="B" value="60" min="10" step="1" oninput="drawMWFRSDiagram()"/></div>
      <div class="ig"><label>Depth D (ft) — NS</label><input type="number" id="D" value="120" min="10" step="1" oninput="drawMWFRSDiagram()"/></div>
      <div class="ig"><label>Mean Roof Height h (ft)</label><input type="number" id="h" value="40" min="5" step="1" oninput="drawMWFRSDiagram()"/></div>
      <div class="ig" id="closedRoofGroup">
        <label>Roof Type</label>
        <select id="roofType" onchange="toggleRoofInputs()">
          <option value="flat">Flat / Low-slope (θ &lt; 10°)</option>
          <option value="gablehip">Gable / Hip</option>
          <option value="monoslope">Monoslope</option>
          <option value="mansard">Mansard</option>
        </select>
      </div>
      <div class="ig" id="openRoofGroup" style="display:none">
        <label>Free Roof Shape</label>
        <select id="freeRoofShape" onchange="toggleRoofInputs()">
          <option value="monoslope">Monoslope</option>
          <option value="pitched" selected>Pitched</option>
          <option value="troughed">Troughed</option>
        </select>
      </div>
      <div class="ig" id="windFlowGroup" style="display:none">
        <label>Wind Flow (Figs. 27.3-4/5/6)</label>
        <select id="windFlow">
          <option value="clear" selected>Clear (≤ 50% blocked)</option>
          <option value="obstructed">Obstructed (&gt; 50% blocked)</option>
        </select>
      </div>
    </div>
    <div class="row" id="ridgeAngleRow">
      <div class="ig" id="ridgeRow">
        <label>Ridge Runs Along</label>
        <select id="ridgeDir">
          <option value="D" selected>Depth D (NS) — Wind-X normal to ridge</option>
          <option value="B">Width B (EW) — Wind-Y normal to ridge</option>
        </select>
      </div>
      <div class="ig" id="angleModeRow">
        <label>Roof Angle Input</label>
        <select id="roofAngleMode" onchange="toggleRoofInputs()">
          <option value="deg" selected>Degrees</option>
          <option value="pitch">Pitch (rise / 12)</option>
        </select>
      </div>
      <div class="ig" id="thetaRow"><label>Roof Angle θ (deg)</label><input type="number" id="theta" value="18" min="0" max="80" step="0.5"/></div>
      <div class="ig" id="pitchRow" style="display:none"><label>Rise per 12 <span id="pitchThetaOut" style="font-weight:400;color:#718096"></span></label><input type="number" id="pitchRise" value="4" min="0" max="24" step="0.5" oninput="toggleRoofInputs()"/></div>
    </div>
    <div class="row">
      <div class="ig" id="hpRow"><label>Parapet Height hp (ft) <span style="font-weight:400;color:#718096">(0 = none)</span></label><input type="number" id="hp" value="3" min="0" step="0.5" oninput="drawMWFRSDiagram()"/></div>
      <div class="ig" id="frameRowN" style="display:none"><label>Transverse Frames n (§28.3.5)</label><input type="number" id="numFrames" value="4" min="3" step="1"/></div>
      <div class="ig" id="frameRowAs" style="display:none"><label>End-Wall Solid Area A<sub>S</sub> (ft²)</label><input type="number" id="AsArea" value="0" min="0" step="1"/></div>
    </div>
```
Leave the following `.ref` line and `#mwfrsDiagWrap` unchanged.

- [ ] **Step 4: Replace `toggleRoofInputs()` and add helpers** (UI HELPERS section, replaces the 4-line function)

```js
function isOpenEncl(){ return document.getElementById('encl').value==='open'; }
function getRoofType(){ var rt=document.getElementById('roofType').value; return rt==='sloped'?'gablehip':rt; }
function getTheta(){
  if(!isOpenEncl() && getRoofType()==='flat') return 0;
  if(document.getElementById('roofAngleMode').value==='pitch'){
    var rise=parseFloat(document.getElementById('pitchRise').value)||0;
    return Math.atan(rise/12)*180/Math.PI;
  }
  return parseFloat(document.getElementById('theta').value)||0;
}
// §28.3.5 applies to open or partially enclosed buildings with transverse frames and a pitched roof
function frameEligible(){
  var encl=document.getElementById('encl').value;
  var pitched=isOpenEncl()?document.getElementById('freeRoofShape').value==='pitched':getRoofType()==='gablehip';
  return (encl==='open'||encl==='partial')&&pitched;
}
function updateKeFromElev(){
  var zg=parseFloat(document.getElementById('groundElev').value)||0;
  document.getElementById('Ke').value=Math.exp(-0.0000362*zg).toFixed(3);
}
function toggleRoofInputs(){
  var open=isOpenEncl(), rt=getRoofType();
  var show=function(id,on){ var el=document.getElementById(id); if(el) el.style.display=on?'':'none'; };
  show('closedRoofGroup',!open); show('openRoofGroup',open); show('windFlowGroup',open);
  var angled=open||rt!=='flat';
  show('ridgeRow',angled); show('angleModeRow',angled);
  var mode=document.getElementById('roofAngleMode').value;
  show('thetaRow',angled&&mode==='deg'); show('pitchRow',angled&&mode==='pitch');
  show('hpRow',!open);
  var fe=frameEligible(); show('frameRowN',fe); show('frameRowAs',fe);
  var rise=parseFloat(document.getElementById('pitchRise').value)||0;
  document.getElementById('pitchThetaOut').textContent='(θ = '+f2(Math.atan(rise/12)*180/Math.PI)+'°)';
}
```

- [ ] **Step 5: Run the harness — baseline must still pass**

```bash
node tools/test-mwfrs-wind.mjs
```
Expected: `PASS baseline …` ×4 (no engine change yet). The open-path and later checks FAIL — that is expected until Tasks 3–5. Confirm specifically there is no `FAIL baseline`.

- [ ] **Step 6: Commit**

```bash
git -C /tmp/are-git add public/Calcs/asce716_mwfrs_calculator.html
git -C /tmp/are-git commit -m "feat(calcs): MWFRS wind — enclosure/roof/ridge/elevation/frame inputs for open-building merge (UI only)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Engine — data tables, open-path functions, ridge-aware roof Cp

**Files:**
- Modify: CALC constants section (after `ROOF_CP_SLOPED`, ~line 257) and `calculate()` (~lines 387-606)

- [ ] **Step 1: Add data tables after `ROOF_CP_SLOPED`**

Apply any Gate 1 corrections to these values before pasting (the numbers below are the SOURCE file's, transcribed).
```js
// Table 26.13-1 — internal pressure coefficient by enclosure class
var GCPI_MAP={enclosed:0.18, partial:0.55, partialOpen:0.18, open:0};

// Figs. 27.3-4/5/6 — free-roof net pressure coefficients CN (open buildings)
// CN_MONO rows: A/B = [CNW,CNL clear γ=0 | CNW,CNL obstructed γ=0 | CNW,CNL clear γ=180 | CNW,CNL obstructed γ=180]
var CN_MONO={
  0:    {A:[1.2,0.3,-0.5,-1.2, 1.2,0.3,-0.5,-1.2],  B:[-1.1,-0.1,-1.1,-0.6, -1.1,-0.1,-1.1,-0.6]},
  7.5:  {A:[-0.6,-1.0,-1.0,-1.5, 0.9,1.5,-0.2,-1.2], B:[-1.4,0.0,-1.7,-0.8, 1.6,0.3,0.8,-0.3]},
  15:   {A:[-0.9,-1.3,-1.1,-1.5, 1.3,1.6,0.4,-1.1],  B:[-1.9,0.0,-2.1,-0.6, 1.8,0.6,1.2,-0.3]},
  22.5: {A:[-1.5,-1.6,-1.5,-1.7, 1.7,1.8,0.5,-1.0],  B:[-2.4,-0.3,-2.3,-0.9, 2.2,0.7,1.3,0.0]},
  30:   {A:[-1.8,-1.8,-1.5,-1.8, 2.1,2.1,0.6,-1.0],  B:[-2.5,-0.5,-2.3,-1.1, 2.6,1.0,1.6,0.1]},
  37.5: {A:[-1.8,-1.8,-1.5,-1.8, 2.1,2.2,0.7,-0.9],  B:[-2.4,-0.6,-2.2,-1.1, 2.7,1.1,1.9,0.3]},
  45:   {A:[-1.6,-1.8,-1.3,-1.8, 2.2,2.5,0.8,-0.9],  B:[-2.3,-0.7,-1.9,-1.2, 2.6,1.4,2.1,0.4]}
};
// CN_PITCHED / CN_TROUGHED rows: A/B = [CNW,CNL clear | CNW,CNL obstructed]; same for γ = 0 and 180
var CN_PITCHED={
  7.5:  {A:[1.1,-0.3,-1.6,-1.0], B:[0.2,-1.2,-0.9,-1.7]},
  15:   {A:[1.1,-0.4,-1.2,-1.0], B:[0.1,-1.1,-0.6,-1.6]},
  22.5: {A:[1.1,0.1,-1.2,-1.2],  B:[-0.1,-0.8,-0.8,-1.7]},
  30:   {A:[1.3,0.3,-0.7,-0.7],  B:[-0.1,-0.9,-0.2,-1.1]},
  37.5: {A:[1.3,0.6,-0.6,-0.6],  B:[-0.2,-0.6,-0.3,-0.9]},
  45:   {A:[1.1,0.9,-0.5,-0.5],  B:[-0.3,-0.5,-0.3,-0.7]}
};
var CN_TROUGHED={
  7.5:  {A:[-1.1,0.3,-1.6,-0.5], B:[-0.2,1.2,-0.9,-0.8]},
  15:   {A:[-1.1,0.4,-1.2,-0.5], B:[0.1,1.1,-0.6,-0.8]},
  22.5: {A:[-1.1,-0.1,-1.2,-0.6],B:[-0.1,0.8,-0.8,-0.8]},
  30:   {A:[-1.3,-0.3,-1.4,-0.4],B:[-0.1,0.9,-0.2,-0.5]},
  37.5: {A:[-1.3,-0.6,-1.4,-0.3],B:[0.2,0.6,-0.3,-0.4]},
  45:   {A:[-1.1,-0.9,-1.2,-0.3],B:[0.3,0.5,-0.3,-0.4]}
};
// Fig. 27.3-7 — wind parallel to ridge (γ = 90°, 270°), all free-roof shapes; zones by distance from windward edge
var CN_TRANSVERSE=[
  {zone:'≤ h',      A:{clear:-0.8, obs:-1.2}, B:{clear:0.8, obs:0.5}},
  {zone:'> h, ≤ 2h', A:{clear:-0.6, obs:-0.9}, B:{clear:0.5, obs:0.5}},
  {zone:'> 2h',      A:{clear:-0.3, obs:-0.6}, B:{clear:0.3, obs:0.3}}
];
// Fig. 28.3-1, Load Case B (wind parallel to ridge): zones 5, 6, 5E, 6E — used by §28.3.5
var GCPF_LC_B={z5:0.40, z6:-0.29, z5E:0.61, z6E:-0.43};
```

- [ ] **Step 2: Add the open-path functions after `slopedRoofCp()`**

```js
// ─── OPEN BUILDING (FREE ROOF) ────────────────────────────────────────────────
function lerp(x,x0,x1,y0,y1){ if(x1===x0) return y0; return y0+(y1-y0)*(x-x0)/(x1-x0); }

// Linear interpolation on θ between the tabulated rows of a CN table; clamps to the table range.
function cnRow(table, th){
  var keys=Object.keys(table).map(Number).sort(function(a,b){return a-b;});
  var t=Math.max(keys[0],Math.min(keys[keys.length-1],th));
  for(var i=0;i<keys.length-1;i++){
    if(t>=keys[i]&&t<=keys[i+1]){
      var r0=table[keys[i]], r1=table[keys[i+1]], k0=keys[i], k1=keys[i+1];
      var ip=function(a0,a1){ return a0.map(function(v,k){ return lerp(t,k0,k1,v,a1[k]); }); };
      return {A:ip(r0.A,r1.A), B:ip(r0.B,r1.B)};
    }
  }
  return table[keys[0]];
}

// Figs. 27.3-4/5/6 — rows for wind normal to ridge. Returns [{gamma,kase,CNW,CNL,note}]
function openRoofCN(shape, flow, theta){
  var out=[];
  var push=function(g,k,w,l,note){ out.push({gamma:g,kase:k,CNW:w,CNL:l,note:note||''}); };
  if(shape==='monoslope'){
    var row=cnRow(CN_MONO, theta<7.5?0:theta);
    var ix=flow==='clear'?[0,1,4,5]:[2,3,6,7];
    push('0°','A',row.A[ix[0]],row.A[ix[1]]);   push('0°','B',row.B[ix[0]],row.B[ix[1]]);
    push('180°','A',row.A[ix[2]],row.A[ix[3]]); push('180°','B',row.B[ix[2]],row.B[ix[3]]);
  } else {
    var ix2=flow==='clear'?[0,1]:[2,3];
    if(theta<7.5){
      var r0=CN_MONO[0], n='θ < 7.5°: monoslope 0° coefficients apply (Figs. 27.3-5/6 Note 3)';
      push('0°, 180°','A',r0.A[ix2[0]],r0.A[ix2[1]],n); push('0°, 180°','B',r0.B[ix2[0]],r0.B[ix2[1]],n);
    } else {
      var row2=cnRow(shape==='pitched'?CN_PITCHED:CN_TROUGHED, theta);
      push('0°, 180°','A',row2.A[ix2[0]],row2.A[ix2[1]]); push('0°, 180°','B',row2.B[ix2[0]],row2.B[ix2[1]]);
    }
  }
  return out;
}

// Fig. 27.3-7 — wind parallel to ridge. Returns [{zone,A,B}]
function openTransverseCN(flow){
  return CN_TRANSVERSE.map(function(z){
    return {zone:z.zone, A:flow==='clear'?z.A.clear:z.A.obs, B:flow==='clear'?z.B.clear:z.B.obs};
  });
}

// §28.3.5 — longitudinal force on transverse frames, Eqs. 28.3-3 / 28.3-4.
// o = {Wperp (width normal to ridge), Lridge (length along ridge), h (mean roof ht), theta, n, AS, qh}
// Gable end-wall geometry: rise = (Wperp/2)·tanθ, eave = h − rise/2, AE = Wperp·eave + ½·Wperp·rise.
// Edge zone area per Fig. 28.3-1 LC B end zones — APPLY GATE 1 FINDING (item 8) HERE if it differs from a × eave.
function longFrameForce(o){
  var rise=(o.Wperp/2)*Math.tan(o.theta*Math.PI/180);
  var eaveH=o.h-rise/2;
  var AE=o.Wperp*eaveH+0.5*o.Wperp*rise;
  var least=Math.min(o.Wperp,o.Lridge);
  var a=Math.max(Math.min(0.1*least,0.4*o.h), Math.max(0.04*least,3));
  var Aedge=a*eaveH, Abulk=Math.max(AE-Aedge,0);
  var gcpfW=(GCPF_LC_B.z5*Abulk+GCPF_LC_B.z5E*Aedge)/AE;
  var gcpfL=(GCPF_LC_B.z6*Abulk+GCPF_LC_B.z6E*Aedge)/AE;
  var KB=o.Wperp<100?1.8-0.01*o.Wperp:0.8;
  var n=Math.max(3,o.n||3), phi=AE>0?(o.AS||0)/AE:0;
  var KS=0.60+0.073*(n-3)+1.25*Math.pow(phi,1.8);
  var p=o.qh*(gcpfW-gcpfL)*KB*KS;
  return {Wperp:o.Wperp,Lridge:o.Lridge,theta:o.theta,rise:rise,eaveH:eaveH,AE:AE,a:a,Aedge:Aedge,Abulk:Abulk,
          gcpfW:gcpfW,gcpfL:gcpfL,KB:KB,KS:KS,n:n,AS:o.AS||0,phi:phi,qh:o.qh,p:p,F:p*AE};
}
```

- [ ] **Step 3: Fix the LIVE `ROOF_CP_SLOPED` θ = 60 row only if Gate 1 confirmed it** — windward Cp = 0.01·θ = 0.60 at θ = 60 for all h/L:
```js
  [60,  [ 0.6, 0.6,-0.6], [ 0.6, 0.6,-0.6], [ 0.6, 0.6,-0.6]]
```

- [ ] **Step 4: Rewire input gathering at the top of `calculate()`**

Replace
```js
  var encl=document.getElementById('encl').value;
  ...
  var roofType=document.getElementById('roofType').value;
  var theta=roofType==='sloped'?(parseFloat(document.getElementById('theta').value)||18):0;
  var hp=parseFloat(document.getElementById('hp').value)||0;
```
with
```js
  var encl=document.getElementById('encl').value;
  var isOpen=encl==='open';
  ...
  var roofType=getRoofType();
  var theta=getTheta();
  var hp=isOpen?0:(parseFloat(document.getElementById('hp').value)||0);
  var ridgeDir=document.getElementById('ridgeDir').value;           // 'D' → ridge runs NS → Wind-X normal to ridge
  var normalX=(ridgeDir==='D');
  var groundElev=parseFloat(document.getElementById('groundElev').value)||0;
```
and replace
```js
  var GCpi = encl==='enclosed'?0.18:0.55;
```
with
```js
  var GCpi = GCPI_MAP[encl]!==undefined?GCPI_MAP[encl]:0.18;
```

- [ ] **Step 5: Ridge-aware walled roof pressures**

Change the signature and the branch condition of `getRoofPressures`:
```js
  function getRoofPressures(L, Bperp, qhv, dirLabel, normalToRidge){
    if(roofType==='flat'||theta<10||!normalToRidge){
      var zones=flatRoofCp(hVal,L);
      var out=[];
      zones.forEach(function(z){
        var p_caseA=qhv*G*z.Cp1 - qhv*GCpi;
        var p_caseB=qhv*G*z.Cp2 + qhv*GCpi;
        out.push({zone:z.zone, from:z.from, to:z.to, Cp1:z.Cp1, Cp2:z.Cp2, pA:p_caseA, pB:p_caseB});
      });
      var why = roofType==='flat' ? 'flat' : (theta<10 ? 'lowslope' : 'parallel');
      return {type:'flat', why:why, zones:out, dir:dirLabel, L:L};
    } else {
      // …existing sloped body unchanged…, add roofType to the returned object:
      return {
        type:'sloped', roofType:roofType, theta:theta, hL:hL,
        Cp_WW_low:Cp_WW_low, Cp_WW_high:Cp_WW_high, Cp_LW:Cp_LW_r,
        p_WW_A_low:p_WW_A_low, p_WW_A_high:p_WW_A_high, p_LW_A:p_LW_A,
        p_WW_B_low:p_WW_B_low, p_WW_B_high:p_WW_B_high, p_LW_B:p_LW_B,
        dir:dirLabel, L:L
      };
    }
  }

  var roofX=getRoofPressures(B, Ddim, qh_val, 'Wind-X (L='+f1(B)+'ft)', normalX);
  var roofY=getRoofPressures(Ddim, B, qh_val, 'Wind-Y (L='+f1(Ddim)+'ft)', !normalX);
```

- [ ] **Step 6: Open-path branch and §28.3.5 in `calculate()`**

Insert immediately after `var Kh=getKz(hVal,exp);` (before the story elevation code):
```js
  // ─── §28.3.5 longitudinal frame force (open + pitched free roof, or partially enclosed + gable) ──
  var Wperp = normalX ? B : Ddim, Lridge = normalX ? Ddim : B;
  var frame = (frameEligible() && theta>0 && theta<45)
    ? longFrameForce({Wperp:Wperp, Lridge:Lridge, h:hVal, theta:theta,
                      n:parseInt(document.getElementById('numFrames').value)||3,
                      AS:parseFloat(document.getElementById('AsArea').value)||0, qh:qh_val})
    : null;

  // ─── OPEN BUILDING PATH — free roof only, no walls / story shears / parapet ──
  if(isOpen){
    var shape=document.getElementById('freeRoofShape').value;
    var flow=document.getElementById('windFlow').value;
    var open={
      shape:shape, flow:flow, theta:theta, Wperp:Wperp, Lridge:Lridge, hL:hVal/Wperp,
      normalLabel: normalX ? 'Wind-X (EW)' : 'Wind-Y (NS)',
      parallelLabel: normalX ? 'Wind-Y (NS)' : 'Wind-X (EW)',
      rows: openRoofCN(shape,flow,theta).map(function(r){ r.pW=qh_val*G*r.CNW; r.pL=qh_val*G*r.CNL; return r; }),
      trans: openTransverseCN(flow).map(function(z){ z.pA=qh_val*G*z.A; z.pB=qh_val*G*z.B; return z; })
    };
    document.getElementById('results').style.display='block';
    setBlk('wxBlk',false); setBlk('wyBlk',false); setBlk('roofBlk',false); setBlk('sendBlk',false); setBlk('parapetBlk',false);
    setBlk('openBlk',true); setBlk('openTransBlk',true); setBlk('frameBlk',true); setBlk('minBlk',true);
    renderParams(V,exp,encl,Kzt,Ke,GCpi,qh_val,Kh,B,Ddim,hVal,roofType,theta,hp,{open:open,ridgeDir:ridgeDir,groundElev:groundElev});
    renderOpen(open, document.getElementById('openBody'), document.getElementById('openTransBody'));
    renderFrame(frame, document.getElementById('frameBody'), true);
    renderMinLoads(true, document.getElementById('minBody'));
    if (typeof AREv2!=='undefined') {
      var _pMin=1e9,_pMax=-1e9;
      open.rows.forEach(function(r){ _pMin=Math.min(_pMin,r.pW,r.pL); _pMax=Math.max(_pMax,r.pW,r.pL); });
      open.trans.forEach(function(z){ _pMin=Math.min(_pMin,z.pA,z.pB); _pMax=Math.max(_pMax,z.pA,z.pB); });
      var pub=[
        {symbol:'qh', label:'Velocity pressure at h', value:qh_val, unit:'psf', kind:'pressure'},
        {symbol:'pRoof', label:'Max free-roof uplift', value:_pMin, unit:'psf', kind:'pressure'},
        {symbol:'pRoofDown', label:'Max free-roof downward', value:_pMax, unit:'psf', kind:'pressure'}
      ];
      if(frame) pub.push({symbol:'Flong', label:'Longitudinal frame force F (§28.3.5)', value:frame.F/1000, unit:'kips', kind:'shear'});
      AREv2.publish(pub);
    }
    drawMWFRSDiagram();
    window.__mwfrsLast={V:V, exp:exp, encl:encl, Kzt:Kzt, Ke:Ke, B:B, D:Ddim, h:hVal, roofType:null, theta:theta, hp:0, GCpi:GCpi, qh:qh_val,
                        ridgeDir:ridgeDir, open:open, frame:frame, wx:null, wy:null, roofX:null, roofY:null, parapet:null};
    try{ localStorage.removeItem('ARE_mwfrs_wind'); }catch(e){}
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
```
In the walled render section, replace
```js
  document.getElementById('results').style.display='block';
  document.getElementById('parapetBlk').style.display=parapetData?'':'none';

  renderParams(V,exp,encl,Kzt,Ke,GCpi,qh_val,Kh,B,Ddim,hVal,roofType,theta,hp);
```
with
```js
  document.getElementById('results').style.display='block';
  setBlk('wxBlk',true); setBlk('wyBlk',true); setBlk('roofBlk',true); setBlk('sendBlk',true);
  setBlk('parapetBlk',!!parapetData); setBlk('openBlk',false); setBlk('openTransBlk',false);
  setBlk('frameBlk',!!frame); setBlk('minBlk',true);
  renderParams(V,exp,encl,Kzt,Ke,GCpi,qh_val,Kh,B,Ddim,hVal,roofType,theta,hp,{ridgeDir:ridgeDir,groundElev:groundElev});
  renderFrame(frame, document.getElementById('frameBody'), false);
  renderMinLoads(false, document.getElementById('minBody'));
```
and extend the stash line:
```js
  window.__mwfrsLast = {V:V, exp:exp, encl:encl, Kzt:Kzt, Ke:Ke, B:B, D:Ddim, h:hVal, roofType:roofType, theta:theta, hp:hp, GCpi:GCpi, qh:qh_val, wx:wx, wy:wy, roofX:roofX, roofY:roofY, parapet:parapetData, ridgeDir:ridgeDir, frame:frame, open:null};
```
Guard the localStorage publish:
```js
  try{ var _rp=buildRevitWindPayload(); if(_rp) localStorage.setItem('ARE_mwfrs_wind', JSON.stringify(_rp)); }catch(e){}
```

- [ ] **Step 7: Add `setBlk` to the UI helpers**

```js
function setBlk(id, show){ var el=document.getElementById(id); if(el) el.style.display=show?'':'none'; }
```

- [ ] **Step 8: Run the harness** — baseline still passes; open-path checks fail only on the missing render functions (page errors) until Task 4.

```bash
node tools/test-mwfrs-wind.mjs 2>&1 | grep -E "baseline|page errors"
```
Expected: four `PASS baseline`.

- [ ] **Step 9: Commit**

```bash
git -C /tmp/are-git add public/Calcs/asce716_mwfrs_calculator.html
git -C /tmp/are-git commit -m "feat(calcs): MWFRS wind — open-building engine (Figs. 27.3-4..7 CN, §28.3.5 frame force), GCpi table, ridge-aware roof Cp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Render — result blocks, params, roof labels, Revit guard

**Files:**
- Modify: CALC results markup (~lines 187-231), `renderParams` (~608), `renderRoof` (~731), `buildRevitWindPayload`/`exportRevitWind`/`copyRevitWind` (~1306-1465)

- [ ] **Step 1: Results markup — add ids and new blocks**

Give the existing result blocks ids and append four blocks. Replace the results section with:
```html
<div id="results" style="display:none">
  <div class="blk">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Design Parameters Summary</span><span class="tog">▶</span></div>
    <div class="blk-body" id="paramSummary"></div>
  </div>
  <div class="blk" id="wxBlk">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Wind-X Direction (Wind Along EW — L=Width, B=Depth)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="wxBody"></div>
  </div>
  <div class="blk" id="wyBlk">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Wind-Y Direction (Wind Along NS — L=Depth, B=Width)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="wyBody"></div>
  </div>
  <div class="blk" id="parapetBlk" style="display:none">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Parapet Pressures (§27.3.5)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="parapetBody"></div>
  </div>
  <div class="blk" id="roofBlk">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Roof Pressures (Both Directions)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="roofBody"></div>
  </div>
  <div class="blk" id="openBlk" style="display:none">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Free Roof Pressures — Wind Normal to Ridge (γ = 0°, 180°; Figs. 27.3-4/5/6, Eq. 27.3-2)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="openBody"></div>
  </div>
  <div class="blk" id="openTransBlk" style="display:none">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Free Roof Pressures — Wind Parallel to Ridge (γ = 90°, 270°; Fig. 27.3-7)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="openTransBody"></div>
  </div>
  <div class="blk" id="frameBlk" style="display:none">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Longitudinal Wind on Transverse Frames (§28.3.5, Eqs. 28.3-3 &amp; 28.3-4)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="frameBody"></div>
  </div>
  <div class="blk" id="minBlk" style="display:none">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Minimum Design Wind Loads &amp; Load Cases (§27.1.5, Fig. 27.3-8)</span><span class="tog">▶</span></div>
    <div class="blk-body" id="minBody"></div>
  </div>
  <div class="blk" id="sendBlk">
    <div class="blk-hd open" onclick="togBlk(this)"><span>Send Story Shears to Other Calculators</span><span class="tog">▶</span></div>
    <div class="blk-body" id="sendBody"></div>
  </div>
</div><!-- /results -->
```

- [ ] **Step 2: `renderParams` — enclosure/roof labels, ridge, elevation**

Replace the function with:
```js
var ENCL_LABEL={enclosed:'Enclosed', partial:'Partially Enclosed', partialOpen:'Partially Open', open:'Open'};
var ROOF_LABEL={flat:'Flat / Low-slope', gablehip:'Gable / Hip', monoslope:'Monoslope', mansard:'Mansard'};
function renderParams(V,exp,encl,Kzt,Ke,GCpi,qh,Kh,B,Ddim,h,rType,theta,hp,x){
  x=x||{};
  var roofTxt = x.open
    ? x.open.shape.charAt(0).toUpperCase()+x.open.shape.slice(1)+' free roof, '+x.open.flow+', θ='+f1(theta)+'°'
    : (rType==='flat' ? ROOF_LABEL.flat : ROOF_LABEL[rType]+' θ='+f1(theta)+'°');
  var html='<div class="kv">'
    +'<div class="kv-item">V = <span>'+V+' mph</span></div>'
    +'<div class="kv-item">Exposure = <span>'+exp+'</span></div>'
    +'<div class="kv-item">Enclosure = <span>'+(ENCL_LABEL[encl]||encl)+'</span></div>'
    +'<div class="kv-item">Kzt = <span>'+f2(Kzt)+'</span></div>'
    +'<div class="kv-item">Ke = <span>'+f3(Ke)+'</span>'+(x.groundElev?' (z<sub>g</sub>='+f1(x.groundElev)+' ft)':'')+'</div>'
    +'<div class="kv-item">Kd = <span>'+f2(Kd)+'</span></div>'
    +'<div class="kv-item">G = <span>'+f2(G)+'</span></div>'
    +'<div class="kv-item">GCpi = <span>'+(GCpi?'±'+f2(GCpi):'0 (open)')+'</span></div>'
    +'<div class="kv-item">Kh = <span>'+f3(Kh)+'</span></div>'
    +'<div class="kv-item">qh = <span>'+f2(qh)+' psf</span></div>'
    +'<div class="kv-item">Building: <span>'+f1(B)+'×'+f1(Ddim)+'ft</span></div>'
    +'<div class="kv-item">h = <span>'+f1(h)+' ft</span></div>'
    +'<div class="kv-item">Roof = <span>'+roofTxt+'</span></div>';
  if(x.ridgeDir && (x.open || rType!=='flat')) html+='<div class="kv-item">Ridge along <span>'+(x.ridgeDir==='D'?'D (NS) — Wind-X normal':'B (EW) — Wind-Y normal')+'</span></div>';
  if(hp>0) html+='<div class="kv-item">Parapet hp = <span>'+f1(hp)+' ft</span></div>';
  html+='</div>';
  html+='<div class="ref" style="margin-top:4px">qh = 0.00256 × Kh × Kzt × Kd × Ke × V² = 0.00256 × '+f3(Kh)+' × '+f2(Kzt)+' × '+f2(Kd)+' × '+f3(Ke)+' × '+V+'² = '+f2(qh)+' psf</div>';
  document.getElementById('paramSummary').innerHTML=html;
}
```

- [ ] **Step 3: `renderRoof` — zone-table reason and monoslope/mansard labels**

In the `flat` branch replace the first `<p class="ref">` line with:
```js
      var why = r.why==='parallel' ? 'Wind parallel to ridge — Fig. 27.3-1 zone table applies for all θ'
              : r.why==='lowslope' ? 'Low-slope roof (θ < 10°) — zone table, Fig. 27.3-1'
              : 'Flat/Low-slope roof (θ<10°) — Cp from Fig. 27.3-1';
      html+='<p class="ref" style="margin-bottom:6px">'+why+' | p = qh·G·Cp ± qh·GCpi | Negative = uplift/suction</p>';
```
In the `sloped` branch replace the `<p class="ref">` line and the three row labels:
```js
      var note = r.roofType==='monoslope' ? 'Monoslope: entire roof is windward OR leeward (Fig. 27.3-1 Note 4) — check both rows'
               : r.roofType==='mansard'   ? 'Mansard: top horizontal + leeward slope treated as leeward (Fig. 27.3-1 Note 6)'
               : 'Gable/Hip — wind normal to ridge';
      html+='<p class="ref" style="margin-bottom:6px">'+note+' | θ='+f1(r.theta)+'° | h/L = '+f1(r.hL)+' | Fig. 27.3-1 bilinear interpolation | p = qh·G·Cp ± qh·GCpi</p>';
      var wwLbl = r.roofType==='monoslope' ? 'Entire roof as WW' : r.roofType==='mansard' ? 'WW slope' : 'WW Roof';
      var lwLbl = r.roofType==='monoslope' ? 'Entire roof as LW' : r.roofType==='mansard' ? 'Top + LW slope' : 'LW Roof';
```
then use `wwLbl+' (low)'`, `wwLbl+' (high)'`, `lwLbl` in the three `<td>` labels.

- [ ] **Step 4: New render functions** (after `renderRoof`)

```js
function renderOpen(o, bodyN, bodyT){
  var warn = (o.hL<0.25||o.hL>1.0)
    ? '<div class="warn">h/L = '+f2(o.hL)+' is outside 0.25 ≤ h/L ≤ 1.0 — Figs. 27.3-4/5/6 do not apply directly; verify by other means.</div>' : '';
  var html=warn+'<div class="kv">'
    +'<div class="kv-item">Normal-to-ridge direction = <span>'+o.normalLabel+'</span></div>'
    +'<div class="kv-item">L (along-wind, normal to ridge) = <span>'+f1(o.Wperp)+' ft</span></div>'
    +'<div class="kv-item">h/L = <span>'+f2(o.hL)+'</span></div>'
    +'<div class="kv-item">Shape = <span>'+o.shape+'</span></div>'
    +'<div class="kv-item">Flow = <span>'+o.flow+'</span></div>'
    +'<div class="kv-item">θ = <span>'+f1(o.theta)+'°</span></div>'
    +'</div>';
  html+='<table class="res-tbl"><thead><tr><th>γ</th><th>Load Case</th><th>C<sub>NW</sub></th><th>C<sub>NL</sub></th><th>p<sub>W</sub> = qh·G·C<sub>NW</sub> (psf)</th><th>p<sub>L</sub> = qh·G·C<sub>NL</sub> (psf)</th></tr></thead><tbody>';
  o.rows.forEach(function(r){
    html+='<tr><td>'+r.gamma+'</td><td>'+r.kase+'</td><td>'+f2(r.CNW)+'</td><td>'+f2(r.CNL)+'</td>'
      +'<td style="font-weight:700;color:'+(r.pW<0?'#dc2626':'#1e3c72')+'">'+f1(r.pW)+'</td>'
      +'<td style="font-weight:700;color:'+(r.pL<0?'#dc2626':'#1e3c72')+'">'+f1(r.pL)+'</td></tr>';
  });
  html+='</tbody></table>';
  var notes=o.rows.filter(function(r){return r.note;}).map(function(r){return r.note;});
  html+='<div class="ref" style="margin-top:4px">CNW = windward half, CNL = leeward half of the roof (monoslope: γ = 0° wind into the low eave, γ = 180° into the high eave). Positive = toward the surface (down on top face), negative = uplift. Load cases A and B are both required. Linear interpolation on θ between tabulated rows. '+(notes.length?notes[0]+'. ':'')+'Ref: Figs. 27.3-4/5/6, Eq. 27.3-2, G = 0.85</div>';
  bodyN.innerHTML=html;

  var t='<div class="kv"><div class="kv-item">Parallel-to-ridge direction = <span>'+o.parallelLabel+'</span></div><div class="kv-item">h = <span>zone breakpoints at h and 2h from the windward edge</span></div></div>';
  t+='<table class="res-tbl"><thead><tr><th>Distance from Windward Edge</th><th>Case A C<sub>N</sub></th><th>p<sub>A</sub> (psf)</th><th>Case B C<sub>N</sub></th><th>p<sub>B</sub> (psf)</th></tr></thead><tbody>';
  o.trans.forEach(function(z){
    t+='<tr><td>'+z.zone+'</td><td>'+f2(z.A)+'</td><td style="font-weight:700;color:#dc2626">'+f1(z.pA)+'</td><td>'+f2(z.B)+'</td><td style="font-weight:700;color:#1e3c72">'+f1(z.pB)+'</td></tr>';
  });
  t+='</tbody></table><div class="ref" style="margin-top:4px">Fig. 27.3-7 applies to all free-roof shapes for γ = 90°, 270°; CN applies to the full roof width. Ref: Eq. 27.3-2</div>';
  bodyT.innerHTML=t;
}

function renderFrame(fr, body, isOpen){
  if(!fr){
    body.innerHTML='<div class="ref">§28.3.5 not applicable: requires an open or partially enclosed building with transverse frames and a pitched (gable) roof, 0° &lt; θ &lt; 45°.</div>';
    return;
  }
  var html='<div class="kv">'
    +'<div class="kv-item">B (normal to ridge) = <span>'+f1(fr.Wperp)+' ft</span></div>'
    +'<div class="kv-item">Eave ht = <span>'+f1(fr.eaveH)+' ft</span></div>'
    +'<div class="kv-item">Rise = <span>'+f1(fr.rise)+' ft</span></div>'
    +'<div class="kv-item">A<sub>E</sub> = <span>'+f1(fr.AE)+' ft²</span></div>'
    +'<div class="kv-item">a = <span>'+f2(fr.a)+' ft</span></div>'
    +'<div class="kv-item">A<sub>edge</sub> = <span>'+f1(fr.Aedge)+' ft²</span></div>'
    +'<div class="kv-item">n = <span>'+fr.n+'</span></div>'
    +'<div class="kv-item">A<sub>S</sub> = <span>'+f1(fr.AS)+' ft²</span></div>'
    +'<div class="kv-item">φ = A<sub>S</sub>/A<sub>E</sub> = <span>'+f3(fr.phi)+'</span></div>'
    +'</div>';
  html+='<table class="res-tbl"><thead><tr><th>(GCpf)<sub>WW</sub></th><th>(GCpf)<sub>LW</sub></th><th>K<sub>B</sub></th><th>K<sub>S</sub></th><th>qh (psf)</th><th>p = qh[(GCpf)<sub>WW</sub>−(GCpf)<sub>LW</sub>]K<sub>B</sub>K<sub>S</sub> (psf)</th><th>F = p·A<sub>E</sub></th></tr></thead><tbody>'
    +'<tr><td>'+f3(fr.gcpfW)+'</td><td>'+f3(fr.gcpfL)+'</td><td>'+f3(fr.KB)+'</td><td>'+f3(fr.KS)+'</td><td>'+f2(fr.qh)+'</td>'
    +'<td style="font-weight:700;color:#1e3c72">'+f1(fr.p)+'</td><td style="font-weight:700;color:#0369a1">'+fi(fr.F)+' lb ('+f2(fr.F/1000)+' kips)</td></tr></tbody></table>';
  html+='<div class="ref" style="margin-top:4px">Eq. 28.3-3: F = qh[(GCpf)<sub>WW</sub> − (GCpf)<sub>LW</sub>]K<sub>B</sub>K<sub>S</sub>A<sub>E</sub> | Eq. 28.3-4: K<sub>S</sub> = 0.60 + 0.073(n−3) + 1.25φ<sup>1.8</sup> | K<sub>B</sub> = 1.8 − 0.01B (B &lt; 100 ft), 0.8 (B ≥ 100 ft) | GCpf from Fig. 28.3-1 Load Case B zones 5/6 (bulk) and 5E/6E (end zone, width a) area-weighted over A<sub>E</sub> | F is the total longitudinal force resisted by the MWFRS bracing (apply per §28.3.5 at the end-wall / frame line)'
    +(isOpen?'':' | Partially enclosed gable building: this force is in addition to the wall pressures above')+'</div>';
  body.innerHTML=html;
}

function renderMinLoads(isOpen, body){
  var html = isOpen
    ? '<div class="kv"><div class="kv-item">Min. design force (open) = <span>16 psf × A<sub>f</sub></span></div></div>'
      +'<div class="ref">§27.1.5: the design wind force for open buildings shall be not less than 16 psf multiplied by A<sub>f</sub> (area of the roof projected on a vertical plane normal to the wind).</div>'
    : '<div class="kv"><div class="kv-item">Min. wall pressure = <span>16 psf</span></div><div class="kv-item">Min. roof pressure = <span>8 psf</span></div></div>'
      +'<div class="ref">§27.1.5: MWFRS load shall be not less than 16 psf × wall area plus 8 psf × roof area projected on a vertical plane normal to the wind, applied simultaneously.</div>';
  html+='<div class="ref" style="margin-top:8px"><b>Design load cases (Fig. 27.3-8)</b> — MWFRS of buildings of all heights: '
    +'<b>Case 1</b> full pressure on each principal axis separately; '
    +'<b>Case 2</b> 75% of Case 1 with torsional moment M<sub>T</sub> = 0.75(P<sub>WX</sub>+P<sub>LX</sub>)B<sub>X</sub>e<sub>X</sub> (e = ±0.15B); '
    +'<b>Case 3</b> 75% of Case 1 on both axes simultaneously; '
    +'<b>Case 4</b> 75% of Case 2 on both axes simultaneously. '
    +'Buildings meeting §27.3.5 exception (D.1.1) need only Cases 1 and 3.</div>';
  body.innerHTML=html;
}
```

- [ ] **Step 5: Revit export guard**

At the top of `buildRevitWindPayload()` after `if(typeof L==='undefined'||!L) return null;` add:
```js
  if(L.encl==='open'||!L.wx) return null;   // free-roof pressures are not in the Revit payload (spec: out of scope)
```
In `exportRevitWind()` and `copyRevitWind()` replace `if(!payload){ alert('Run Calculate first.'); return; }` with:
```js
  if(!payload){ alert(window.__mwfrsLast&&window.__mwfrsLast.encl==='open' ? 'Revit export covers walled buildings only — not available for Open (free roof).' : 'Run Calculate first.'); return; }
```

- [ ] **Step 6: Run the harness**

```bash
node tools/test-mwfrs-wind.mjs
```
Expected: all `baseline`, `Wind-Y roof uses zone table`, `Wind-Y zone pressures`, `open:` and `frame:` checks PASS; `sweep` all PASS; `round-trip` and `legacy` still FAIL (Task 5).

- [ ] **Step 7: Commit**

```bash
git -C /tmp/are-git add public/Calcs/asce716_mwfrs_calculator.html
git -C /tmp/are-git commit -m "feat(calcs): MWFRS wind — open-building result blocks, §28.3.5 frame block, min loads/load cases, roof labels, Revit guard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Save / load, URL prefill, legacy mapping

**Files:**
- Modify: CALC `saveInputsMWFRS` (~1267), `loadInputsMWFRS` (~1467), DOMContentLoaded prefill (~1515)

- [ ] **Step 1: Split save into collect + download**

Replace `saveInputsMWFRS` with:
```js
var MWFRS_INPUT_IDS=['V','exp','encl','Kzt','groundElev','Ke','B','D','h','roofType','freeRoofShape','windFlow','ridgeDir','roofAngleMode','theta','pitchRise','hp','numFrames','AsArea'];
function collectInputsMWFRS(){
  var storyRows=document.getElementById('storyRows').children;
  var stories=[];
  for(var i=0;i<storyRows.length;i++){
    stories.push({ label: storyRows[i].querySelector('input[type=text]').value, h: storyRows[i].querySelector('.sh').value });
  }
  var data={ _version:2, _calc:'mwfrs',
    projName: document.getElementById('projName').value,
    projNum:  document.getElementById('projNum').value,
    projDate: document.getElementById('projDate').value,
    projEng:  document.getElementById('projEng').value,
    stories: stories };
  MWFRS_INPUT_IDS.forEach(function(id){ data[id]=document.getElementById(id).value; });
  return data;
}
function saveInputsMWFRS(){
  var data=collectInputsMWFRS();
  var proj=data.projName||data.projNum||'mwfrs';
  var fname=proj.replace(/[^a-z0-9_\-]/gi,'_').replace(/_+/g,'_')+'_mwfrs.json';
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=fname;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 2: Split load into apply + file reader**

Replace `loadInputsMWFRS` with:
```js
// Applies a saved input object (v1 or v2). v1 files carry roofType 'sloped' → gablehip; missing v2 keys keep the page default.
function applyInputsMWFRS(d){
  if(d._calc!=='mwfrs') throw new Error('This file is not an MWFRS calculator save file.');
  var set=function(id,v){var el=document.getElementById(id);if(el&&v!==undefined&&v!==null)el.value=v;};
  set('projName',d.projName); set('projNum',d.projNum); set('projDate',d.projDate); set('projEng',d.projEng);
  MWFRS_INPUT_IDS.forEach(function(id){ set(id, id==='roofType'&&d.roofType==='sloped'?'gablehip':d[id]); });
  if(d.groundElev===undefined) set('groundElev', 0);   // v1: Ke was a direct input; keep it, do not overwrite from elevation
  toggleRoofInputs();
  if(d.stories&&d.stories.length){
    var container=document.getElementById('storyRows');
    container.innerHTML='';
    d.stories.forEach(function(s,i){
      var div=document.createElement('div');
      div.className='story-row row'; div.dataset.idx=i;
      div.innerHTML='<div class="ig" style="flex:0 0 70px"><label>Story</label>'
        +'<input type="text" value="'+s.label+'" '+(i===0?'readonly ':'')+'style="background:#f7fafc"/></div>'
        +'<div class="ig"><label>Floor-to-Floor Height (ft)</label>'
        +'<input type="number" class="sh" value="'+s.h+'" min="1" step="0.5"/></div>'
        +'<button class="det-btn btn-x" onclick="removeStory(this)" style="margin-top:18px">✕</button>';
      container.appendChild(div);
    });
  }
  drawMWFRSDiagram();
}
function loadInputsMWFRS(input){
  var file=input.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{ applyInputsMWFRS(JSON.parse(e.target.result)); alert('Inputs loaded successfully.'); }
    catch(err){ alert('Error reading file: '+err.message); }
  };
  reader.readAsText(file);
  input.value='';
}
```

- [ ] **Step 3: URL prefill — new keys and legacy roofType**

Replace the prefill loop's key list and add the mapping:
```js
  ['projName','projNum','projEng'].concat(MWFRS_INPUT_IDS).forEach(function(key){
    if(qp.has(key)){
      var val=qp.get(key);
      if(val!==null&&val!==''){
        var el=document.getElementById(key);
        if(el) el.value=(key==='roofType'&&val==='sloped')?'gablehip':val;
      }
    }
  });
```

- [ ] **Step 4: Run the full harness**

```bash
node tools/test-mwfrs-wind.mjs
```
Expected: `ALL PASS`.

- [ ] **Step 5: Manual check in the Browser pane** — open `http://localhost:3000/calc/mwfrs-wind` via `preview_start` (dev server `npm run dev` in `.claude/launch.json` if present, else add it), switch Enclosure to Open, calculate, screenshot; switch to Partially Enclosed + Gable/Hip, calculate, confirm the §28.3.5 block appears under the walled results; print preview shows no hidden-block gaps.

- [ ] **Step 6: Commit**

```bash
git -C /tmp/are-git add public/Calcs/asce716_mwfrs_calculator.html
git -C /tmp/are-git commit -m "feat(calcs): MWFRS wind — v2 save/load (collect/apply), legacy sloped→gablehip, URL prefill for new inputs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Registry entry

**Files:**
- Modify: `app/lib/calcs.ts:58-70`

- [ ] **Step 1: Update subtitle, spec, keywords**

```ts
  {
    slug: "mwfrs-wind",
    label: "MWFRS Wind Pressure",
    subtitle: "Directional Procedure, all heights — enclosed, partially enclosed, partially open & open (free roof CN, §28.3.5 frames); story shears, parapet",
    htmlFile: "/Calcs/asce716_mwfrs_calculator.html",
    category: "Wind / Loads",
    spec: "ASCE 7-16 Ch.27 Pt.1 / §28.3.5",
    status: "ready",
    keywords: ["MWFRS", "wind", "pressure", "story shear", "parapet", "directional procedure", "Cp", "CN", "GCpi", "velocity", "exposure", "building", "ASCE 7", "lateral force", "open building", "partially open", "free roof", "monoslope", "pitched", "troughed", "canopy", "transverse frames", "28.3.5", "mansard", "gable", "hip"],
    material: "Loads",
    calcType: "Lateral Loads",
    icon: "wind-building",
  },
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```
Expected: no errors (or only pre-existing ones unrelated to `calcs.ts`).

- [ ] **Step 3: Commit**

```bash
git -C /tmp/are-git add app/lib/calcs.ts
git -C /tmp/are-git commit -m "feat(calcs): registry — MWFRS wind covers open/partially open buildings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Gate 2 — Fable agent QAQC of the merged calc (blocking)

- [ ] **Step 1: Dispatch the agent** (Agent tool, `model: "fable"`, `run_in_background: false`)

Prompt:

```
You are the pre-deploy QAQC gate for a merged structural wind calculator. Be adversarial. Do not edit the calculator; write only the report section described below.

CALC: C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\public\Calcs\asce716_mwfrs_calculator.html
SPEC: ...\docs\superpowers\specs\2026-09-15-mwfrs-open-building-merge-design.md
GATE 1 REPORT: ...\docs\mwfrs-open-qaqc-2026-09.md (read first — confirm every BLOCKER/MAJOR marked fix-in-merge is actually fixed in CALC)
CODE: C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ASCE\ASCE 7-16.pdf
HARNESS: node tools/test-mwfrs-wind.mjs (run from the repo folder; must print ALL PASS — include its output in the report)
BROWSER: playwright is in node_modules; serve CALC the way tools/test-mwfrs-wind.mjs does (route every request to public/ on disk) so /are-utils-v2.js and /are-draw.js load.

DO
1. Run the harness. Paste the summary lines.
2. Hand-check end-to-end against the rendered page (not just the JS):
   a. Enclosed, gable/hip θ=20°, ridge along D, V=120 Exp B, B=50 D=80 h=30, 2 stories 15/15, no parapet — verify every wall pressure, roof pressure in BOTH directions (Wind-X normal → Fig. 27.3-1 sloped table; Wind-Y parallel → zone table), story shears, base shear.
   b. Open, monoslope, obstructed, θ=10° (between rows 7.5 and 15), ridge along B, V=115 Exp C, B=80 D=30 h=18 — verify Ke from elevation 2500 ft, qh, all CN rows for γ=0/180 A/B, Fig. 27.3-7 zones, and that Wind-Y is reported as normal to ridge.
   c. Partially enclosed, gable θ=25°, ridge along D, V=130 Exp D, B=60 D=150 h=28, 3 stories, parapet 0, n=6 frames, AS=400 ft² — verify wall/roof/story shear AND the §28.3.5 F block (KB, KS with φ, GCpf area weighting per Gate 1's confirmed geometry).
3. UI walk: every enclosure × roof-type (walled) and shape × flow (open) — after Calculate, list which result blocks are visible; confirm hidden blocks for Open are wx/wy/roof/parapet/send and shown are open/openTrans/frame(when pitched)/min; confirm Partially Open shows the walled set with GCpi ±0.18; no NaN/undefined anywhere in #results innerText; no console errors.
4. Save → Load: call collectInputsMWFRS() on the open case, reload, applyInputsMWFRS(), Calculate, and diff window.__mwfrsLast. Also load a v1 object {_calc:'mwfrs', roofType:'sloped', theta:'20', ...} and confirm roofType becomes gablehip and theta row is visible.
5. Revit: on an enclosed case, buildRevitWindPayload() must equal fixtures/mwfrs-wind/baseline.json → cases[...].revit apart from generatedAt; on the open case it must be null and Export must alert the walled-only message.
6. Print: page.pdf() the open case and the enclosed case; confirm no empty gaps from hidden blocks and the toolbar is not printed.

OUTPUT: append a "Gate 2 — merged calc (2026-09-15)" section to docs/mwfrs-open-qaqc-2026-09.md with: harness output, findings table (same columns as Gate 1 plus Decision), the three hand checks with intermediates, the UI-walk visibility matrix, and a final line "GATE 2: PASS" or "GATE 2: FAIL — n blockers". Return the findings table and the final line in your last message.
```

- [ ] **Step 2: Fix findings, re-run**

For each BLOCKER/MAJOR: fix in CALC, run `node tools/test-mwfrs-wind.mjs` (must stay ALL PASS; if a fix legitimately changes a hand-checked open value, update the typed constants in the harness with the code reference in a comment). Re-dispatch Gate 2 with `SendMessage` to the same agent ("re-check items X, Y after fixes") until it returns `GATE 2: PASS`.

- [ ] **Step 3: Commit**

```bash
git -C /tmp/are-git add public/Calcs/asce716_mwfrs_calculator.html tools/test-mwfrs-wind.mjs docs/mwfrs-open-qaqc-2026-09.md
git -C /tmp/are-git commit -m "fix(calcs): MWFRS wind — Gate 2 QAQC fixes; QAQC report

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Deploy (after Nick's go)

- [ ] **Step 1: Report to Nick** — one message: Gate 2 result, the findings that were fixed, anything left open, and ask for go.

- [ ] **Step 2: Deploy** — invoke the `anthropic-skills:are-calcs-deploy` skill. It commits/pushes from the repo and confirms the Vercel deploy. Confirm `https://calcs.andersonrohr.com/calc/mwfrs-wind` loads the new enclosure options.

- [ ] **Step 3: Update memory** — write `~/.claude/projects/C--Users-nickh-Claude/memory/mwfrs-open-building-merge.md` (type: project) with the deploy commit, the harness path, the ridge-orientation decision, and any open items; add the index line to `MEMORY.md`.

---

## Self-review

- Spec coverage: inputs (Task 2), GCpi/roof Cp/open path/§28.3.5/min loads (Tasks 3–4), save/load compatibility (Task 5), regression guard (Task 0 + every task), Gate 1 (Task 1), Gate 2 (Task 7), deploy (Task 8), registry (Task 6). Out-of-scope items untouched.
- Names used consistently: `getRoofType`, `getTheta`, `frameEligible`, `isOpenEncl`, `toggleRoofInputs`, `updateKeFromElev`, `setBlk`, `openRoofCN`, `openTransverseCN`, `longFrameForce`, `cnRow`, `lerp`, `renderOpen`, `renderFrame`, `renderMinLoads`, `collectInputsMWFRS`, `applyInputsMWFRS`, `MWFRS_INPUT_IDS`, `GCPI_MAP`, `GCPF_LC_B`; result object keys `open.rows[].{gamma,kase,CNW,CNL,pW,pL}`, `open.trans[].{zone,A,B,pA,pB}`, `frame.{AE,a,KB,KS,F,...}`; block ids `wxBlk wyBlk parapetBlk roofBlk openBlk openTransBlk frameBlk minBlk sendBlk`.
- Conditional-on-Gate-1 items are called out explicitly (§28.3.5 edge geometry, θ = 60 row, hEff note) rather than left vague.
