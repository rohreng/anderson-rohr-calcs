// =============================================================================
// Adversarial save/load tests  (PLAN.md §5 step 3 + step 6)
// -----------------------------------------------------------------------------
// Two surfaces with zero coverage until now:
//   1. INJECTION — a hostile string in the Project field or in an adapter model
//      reaching the saved file, which travels between engineers.
//   2. REJECTION — the loader's typed error codes, the mismatch block, the
//      rollback, and force-apply. Each is a data-integrity guarantee.
//
// Deliberately NO benign/pre-existing filtering in this file: any console error,
// page error or dialog is a failure. The whole point is that nothing executes.
//
// Assertions are INDEPENDENT of the product's own self-check. buildSnapshot
// asserts the same "no literal </script" property at save time; if that check
// were itself broken, trusting it here would pass both.
// =============================================================================

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = 'http://localhost:3000/Calcs/';
const TIER_A = 'cantilever_plate_deflection_calculator.html';
const TIER_B = 'stacked_shearwall_calculator.html';
const PAYLOAD = '</script><img src=x onerror=alert(1)>';
const TMP = fileURLToPath(new URL('../.qa-tmp/', import.meta.url));
mkdirSync(TMP, { recursive: true });

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? '\n        ' + detail : ''}`);
};

const browser = await chromium.launch({ headless: true });

async function openCalc(ctx, file) {
  const page = await ctx.newPage();
  const noise = [];
  page.on('pageerror', (e) => noise.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') noise.push('console: ' + m.text()); });
  page.on('dialog', async (d) => { noise.push('DIALOG: ' + d.message()); await d.dismiss(); });
  await page.goto(BASE + file, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.waitForFunction(() => window.AREv2?.isReady?.() === true, null, { timeout: 20000 });
  return { page, noise };
}

// Independent inertness assertions on the serialized HTML.
function assertInert(label, html) {
  const withoutState = html.replace(/<script type="application\/json"[^>]*>[\s\S]*?<\/script>/i, '');
  check(`${label}: no literal </script outside the JSON block`, !/<\/script/i.test(withoutState));
  check(`${label}: no inline event-handler attributes`, !/\son[a-z]+\s*=\s*["']/i.test(html));
  check(`${label}: payload stored escaped as \\u003c`, /\\u003c/.test(html));
  check(`${label}: raw payload not present verbatim`, !html.includes(PAYLOAD));
}

// =============================================================================
// TEST A — payload in the Project field
// =============================================================================
for (const file of [TIER_A, TIER_B]) {
  const ctx = await browser.newContext();
  const { page, noise } = await openCalc(ctx, file);

  const snap = await page.evaluate(async (payload) => {
    document.getElementById('areJob').value = payload;
    try { const s = await window.AREv2.buildSnapshot('f'); return { ok: true, html: s.html, filename: s.filename }; }
    catch (e) { return { ok: false, code: e.code || '', message: e.message }; }
  }, PAYLOAD);

  const label = `A/${file.replace('_calculator.html', '')}`;
  check(`${label}: snapshot builds with a hostile Project name`, snap.ok, snap.message);
  if (snap.ok) {
    assertInert(label, snap.html);
    check(`${label}: filename carries no angle brackets`, !/[<>]/.test(snap.filename), snap.filename);

    // Open the saved file offline; nothing may execute or be requested.
    const p = path.join(TMP, 'xss-' + file);
    writeFileSync(p, snap.html, 'utf8');
    const octx = await browser.newContext();
    const opage = await octx.newPage();
    const oNoise = [];
    opage.on('pageerror', (e) => oNoise.push('pageerror: ' + e.message));
    opage.on('console', (m) => { if (m.type() === 'error') oNoise.push('console: ' + m.text()); });
    opage.on('dialog', async (d) => { oNoise.push('DIALOG: ' + d.message()); await d.dismiss(); });
    const requested = [];
    await opage.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('file://')) return r.continue();
      requested.push(u); return r.abort();
    });
    await opage.goto('file://' + p.replace(/\\/g, '/'), { waitUntil: 'load' });
    await opage.waitForTimeout(600);
    const dom = await opage.evaluate(() => ({
      scripts: document.querySelectorAll('script:not([type="application/json"])').length,
      onAttrs: Array.from(document.querySelectorAll('*'))
        .filter((el) => Array.from(el.attributes).some((a) => /^on/i.test(a.name))).length,
      imgs: document.querySelectorAll('img').length,
    }));
    await octx.close();

    check(`${label}: saved file executes no script`, dom.scripts === 0, JSON.stringify(dom));
    check(`${label}: saved file has no on* attributes`, dom.onAttrs === 0);
    check(`${label}: payload did not become an <img> element`, dom.imgs === 0);
    check(`${label}: saved file made no network requests`, requested.length === 0, requested.join(', '));
    check(`${label}: no dialog or console error offline`, oNoise.length === 0, oNoise.join(' | '));

    // Round-trip: the escape must be lossless.
    const rt = await page.evaluate((html) => {
      const st = window.AREv2.parseSnapshot(html);
      const r = window.AREv2.loadFromState(st, { force: true });
      return { project: st.project, ok: r.ok, jobValue: document.getElementById('areJob').value };
    }, snap.html);
    check(`${label}: payload survives round-trip byte-for-byte`, rt.project === PAYLOAD && rt.jobValue === PAYLOAD);
  }
  check(`${label}: no dialog fired on the live page`, !noise.some((n) => n.startsWith('DIALOG')), noise.join(' | '));
  await ctx.close();
}

// =============================================================================
// TEST B — payload in an adapter model string (stacked_shearwall floor name)
// =============================================================================
{
  const ctx = await browser.newContext();
  const { page, noise } = await openCalc(ctx, TIER_B);

  // B1 — a hostile model string now blocks at SAVE TIME (MODEL_INVALID), on
  // the author's machine, symmetric with load. This is the fix for the
  // 2026-08-18 field report: a file must never be born unloadable.
  const res = await page.evaluate(async (payload) => {
    document.getElementById('areJob').value = 'XSS-MODEL';
    floors[0].name = payload;
    render();
    let built = null, buildCode = null;
    try { built = await window.AREv2.buildSnapshot('f'); }
    catch (e) { buildCode = e.code || e.name; }
    return { built: !!built, buildCode, liveName: floors[0].name };
  }, PAYLOAD);

  check('B1: hostile floor name blocks the SAVE with MODEL_INVALID',
        !res.built && res.buildCode === 'MODEL_INVALID', JSON.stringify(res));
  check('B1: no dialog fired while rendering the hostile name',
        !noise.some((n) => n.startsWith('DIALOG')), noise.join(' | '));

  // B2 — a HAND-EDITED file (clean save, payload spliced into the state) must
  // still be rejected at load: the schema is the defence for files that never
  // went through our Save.
  const b2 = await page.evaluate(async (payload) => {
    floors[0].name = 'Level 1';
    render();
    const s = await window.AREv2.buildSnapshot('f');
    const st = window.AREv2.parseSnapshot(s.html);
    st.model.floors[0].name = payload;          // simulate hand-editing the file
    try { window.AREv2.loadFromState(st); return { threw: false }; }
    catch (e) { return { threw: true, code: e.code || e.name }; }
  }, PAYLOAD);
  check('B2: hand-edited hostile model rejected at load with BAD_MODEL',
        b2.threw && b2.code === 'BAD_MODEL', JSON.stringify(b2));

  // B3 — REAL-WORLD labels must round-trip. These are the exact characters from
  // the field report ("GL A6 - A14, & GL A24") plus quotes/apostrophes/dashes
  // engineers actually type. The over-tight allowlist that rejected them is the
  // regression this guards against.
  const REAL = 'GL A6 - A14, & GL A24 (interior wall) — 3\'-6" o.c.';
  const b3 = await page.evaluate(async (name) => {
    floors[0].name = name;
    render();
    let s;
    try { s = await window.AREv2.buildSnapshot('f'); }
    catch (e) { return { saved: false, code: e.code || e.name, message: e.message }; }
    floors[0].name = 'OVERWRITTEN';
    render();
    const st = window.AREv2.parseSnapshot(s.html);
    const r = window.AREv2.loadFromState(st, { force: true });
    return { saved: true, ok: r.ok, name: floors[0].name };
  }, REAL);
  check('B3: real-world label (& , quotes dashes) saves and round-trips',
        b3.saved && b3.ok && b3.name === REAL, JSON.stringify(b3));

  // Control: a pattern-legal name must round-trip, proving the rejection above
  // is the schema working rather than loading being broken outright.
  const control = await page.evaluate(async () => {
    floors[0].name = 'Level 2A';
    render();
    const s = await window.AREv2.buildSnapshot('f');
    floors[0].name = 'CHANGED';
    render();
    const st = window.AREv2.parseSnapshot(s.html);
    const r = window.AREv2.loadFromState(st, { force: true });
    return { ok: r.ok, name: floors[0].name };
  });
  check('B control: a legal floor name round-trips', control.ok && control.name === 'Level 2A',
        JSON.stringify(control));
  await ctx.close();
}

// =============================================================================
// TEST C — rejection / rollback / force  (PLAN.md §5 step 6)
// =============================================================================
{
  const ctx = await browser.newContext();
  const { page } = await openCalc(ctx, TIER_A);

  const good = await page.evaluate(async () => {
    document.getElementById('areJob').value = 'REJECT-TESTS';
    const s = await window.AREv2.buildSnapshot('f');
    return { html: s.html, state: window.AREv2.parseSnapshot(s.html) };
  });

  const cases = await page.evaluate((g) => {
    const out = {};
    const run = (name, fn) => {
      try { const r = fn(); out[name] = { threw: false, res: r && { ok: r.ok, applied: r.applied, rolledBack: !!r.rolledBack } }; }
      catch (e) { out[name] = { threw: true, code: e.code || e.name, msg: e.message }; }
    };
    const clone = () => JSON.parse(JSON.stringify(g.state));

    run('badJson', () => window.AREv2.parseSnapshot('<html><body><script type="application/json" id="are-state">{oops</' + 'script></body></html>'));
    run('badSchema', () => { const s = clone(); s.schema = 'are.snapshot.v9'; return window.AREv2.loadFromState(s); });
    run('wrongCalc', () => { const s = clone(); s.calcFile = 'some_other_calculator.html'; s.calcTitle = 'Some Other'; return window.AREv2.loadFromState(s); });

    // Mismatch must BLOCK and ROLL BACK. Capture a real value first, so we can
    // prove the page was actually restored rather than just flagged.
    const firstKey = Object.keys(g.state.fields)[0];
    const el = document.querySelector(firstKey);
    const before = el ? el.value : null;
    run('mismatchBlocks', () => {
      const s = clone();
      s.fields['#definitely_not_a_real_field_xyz'] = '1';
      return window.AREv2.loadFromState(s);
    });
    out.rollbackValueUnchanged = el ? (el.value === before) : null;

    run('forceApplies', () => {
      const s = clone();
      s.fields['#definitely_not_a_real_field_xyz'] = '1';
      return window.AREv2.loadFromState(s, { force: true });
    });

    // A file carrying a model, loaded into a page whose adapter failed to
    // register: every adapter branch in loadFromState is guarded `if (adapter`,
    // so without the ADAPTER_MISSING gate this would silently drop the model
    // and report success — a wrong record, not an error.
    run('adapterMissing', () => {
      const s = clone();
      s.adapterVersion = 1;
      s.model = { floors: [{ name: 'L2' }] };
      return window.AREv2.loadFromState(s);
    });

    out.fieldCount = Object.keys(g.state.fields).length;
    return out;
  }, good);

  check('C: corrupted JSON -> BAD_JSON', cases.badJson?.threw && cases.badJson.code === 'BAD_JSON', JSON.stringify(cases.badJson));
  check('C: unknown schema -> BAD_SCHEMA', cases.badSchema?.threw && cases.badSchema.code === 'BAD_SCHEMA', JSON.stringify(cases.badSchema));
  check('C: file from another calc -> WRONG_CALC', cases.wrongCalc?.threw && cases.wrongCalc.code === 'WRONG_CALC', JSON.stringify(cases.wrongCalc));
  check('C: field mismatch blocks (ok:false, rolledBack)',
        cases.mismatchBlocks?.res?.ok === false && cases.mismatchBlocks?.res?.rolledBack === true,
        JSON.stringify(cases.mismatchBlocks));
  check('C: rollback actually restored the page value', cases.rollbackValueUnchanged === true);
  check('C: force applies the resolvable fields',
        cases.forceApplies?.res?.ok === true && cases.forceApplies.res.applied === cases.fieldCount,
        JSON.stringify(cases.forceApplies));
  check('C: model file on an adapterless page -> ADAPTER_MISSING',
        cases.adapterMissing?.threw && cases.adapterMissing.code === 'ADAPTER_MISSING',
        JSON.stringify(cases.adapterMissing));
  await ctx.close();
}

// =============================================================================
// TEST D — loadHint reaches the mismatch dialog text
// =============================================================================
{
  const ctx = await browser.newContext();
  const { page } = await openCalc(ctx, TIER_A);

  const d = await page.evaluate(() => {
    const res = { ok: false, mismatches: { missingOnPage: ['#fPu_12'], notInFile: [] }, notices: [] };
    const before = window.AREv2._describeMismatch(res);
    window.AREv2.loadHint('Upload the RISA workbook first, then Load this file again.');
    const withHint = window.AREv2._describeMismatch(res);
    window.AREv2.loadHint('');            // cleared hint must disappear again
    const after = window.AREv2._describeMismatch(res);
    return { before, withHint, after };
  });
  check('D: hint absent until a calc sets one', !d.before.includes('RISA workbook'));
  check('D: loadHint text appears in the mismatch description',
        d.withHint.includes('Upload the RISA workbook first, then Load this file again.'), d.withHint);
  check('D: mismatch list itself is still present alongside the hint',
        d.withHint.includes('#fPu_12'), d.withHint);
  check('D: clearing the hint removes it', !d.after.includes('RISA workbook'));
  await ctx.close();
}

// =============================================================================
// TEST E — attribute URL audit (regression armour; no current calc trips it)
// =============================================================================
{
  const ctx = await browser.newContext();
  const { page } = await openCalc(ctx, TIER_A);

  const e = await page.evaluate(async () => {
    document.getElementById('areJob').value = 'ATTR-AUDIT';
    const tryBuild = async () => {
      try { await window.AREv2.buildSnapshot('f'); return { ok: true }; }
      catch (err) { return { ok: false, code: err.code || '', msg: err.message }; }
    };

    // .invalid never resolves, so no real network traffic leaves the test.
    const img = document.createElement('img');
    img.setAttribute('src', 'https://example.invalid/x.png');
    document.body.appendChild(img);
    const externalImg = await tryBuild();
    img.remove();

    const div = document.createElement('div');
    div.setAttribute('style', 'background:url(https://example.invalid/bg.png)');
    document.body.appendChild(div);
    const externalStyle = await tryBuild();
    div.remove();

    // Control: data: image + fragment url() are the allowed forms — they must
    // still save, proving the audit rejects externals rather than everything.
    const okImg = document.createElement('img');
    okImg.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAAC');
    document.body.appendChild(okImg);
    const frag = document.createElement('div');
    frag.setAttribute('style', 'clip-path:url(#clip)');
    document.body.appendChild(frag);
    const control = await tryBuild();
    okImg.remove(); frag.remove();

    return { externalImg, externalStyle, control };
  });
  check('E: external img[src] fails the save closed (EXTERNAL_ATTR_URL)',
        !e.externalImg.ok && e.externalImg.code === 'EXTERNAL_ATTR_URL', JSON.stringify(e.externalImg));
  check('E: external url() in an inline style fails the save closed',
        !e.externalStyle.ok && e.externalStyle.code === 'EXTERNAL_ATTR_URL', JSON.stringify(e.externalStyle));
  check('E: data: image and url(#fragment) still save', e.control.ok, JSON.stringify(e.control));
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
process.exit(failed.length ? 1 : 0);
