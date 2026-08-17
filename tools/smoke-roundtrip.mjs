// Quick round-trip smoke test on a single Tier-A calc, ahead of the full
// 55-calc harness. Usage: node tools/smoke-roundtrip.mjs [calcFile.html]
import { chromium } from 'playwright';

const FILE = process.argv[2] || 'cantilever_plate_deflection_calculator.html';
const URL = `http://localhost:3000/Calcs/${FILE}`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('#areBar', { timeout: 10000 });

// Fill: project + perturb every persistable numeric input deterministically.
const filled = await page.evaluate(() => {
  document.getElementById('areJob').value = 'QA-TEST';
  let n = 0;
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!window.AREv2._isPersistableField(el)) return;
    if (el.tagName === 'SELECT') {
      if (el.options.length > 1) { el.selectedIndex = Math.min(1, el.options.length - 1); n++; }
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !el.checked; n++;
    } else if (el.type === 'number' || /^[\d.]+$/.test(el.value || '')) {
      const v = parseFloat(el.value);
      if (isFinite(v)) { el.value = String(Math.round(v * 1.07 * 1000) / 1000); n++; }
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return n;
});

await page.evaluate(() => window.AREv2.runAndSettle());

const baseline = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

const snap = await page.evaluate(async () => {
  try {
    const s = await window.AREv2.buildSnapshot('f');
    return { ok: true, filename: s.filename, html: s.html, fieldCount: Object.keys(s.state.fields).length };
  } catch (e) {
    return { ok: false, code: e.code || '', message: e.message };
  }
});

console.log(`\ncalc            : ${FILE}`);
console.log(`fields filled   : ${filled}`);
if (!snap.ok) {
  console.log(`buildSnapshot   : FAILED [${snap.code}] ${snap.message}`);
  await browser.close();
  process.exit(1);
}
console.log(`buildSnapshot   : ok — "${snap.filename}"`);
console.log(`captured fields : ${snap.fieldCount}`);
console.log(`snapshot size   : ${(snap.html.length / 1024).toFixed(0)} KB`);

// Inertness assertions
const inert = {
  hasState: snap.html.includes('id="are-state"'),
  noScriptSrc: !/<script[^>]+src=/i.test(snap.html),
  noExternalLink: !/<link[^>]+rel="stylesheet"/i.test(snap.html),
  noOnAttr: !/\son[a-z]+\s*=\s*["']/i.test(snap.html),
  hasCsp: snap.html.includes('Content-Security-Policy'),
};
console.log('inertness       :', JSON.stringify(inert));

// Reload into a fresh page and require ZERO mismatches on the normal path.
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errors.push('p2 pageerror: ' + e.message));
await page2.goto(URL, { waitUntil: 'load' });
await page2.waitForSelector('#areBar', { timeout: 10000 });

const load = await page2.evaluate(async (html) => {
  try {
    const state = window.AREv2.parseSnapshot(html);
    const res = window.AREv2.loadFromState(state);
    await window.AREv2.runAndSettle();
    return {
      ok: res.ok,
      applied: res.applied,
      missingOnPage: res.mismatches.missingOnPage,
      notInFile: res.mismatches.notInFile,
      notices: res.notices,
    };
  } catch (e) {
    return { threw: true, code: e.code || '', message: e.message };
  }
}, snap.html);

console.log('load            :', JSON.stringify(load));

const after = await page2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const identical = after === baseline;
console.log(`results match   : ${identical}`);
if (!identical) {
  for (let i = 0; i < Math.max(baseline.length, after.length); i++) {
    if (baseline[i] !== after[i]) {
      console.log(`  first diff @${i}:\n    baseline: …${baseline.slice(Math.max(0, i - 60), i + 60)}…\n    after   : …${after.slice(Math.max(0, i - 60), i + 60)}…`);
      break;
    }
  }
}
if (errors.length) console.log('page errors     :', errors.slice(0, 6));

await browser.close();
process.exit(load.ok && identical && inert.hasState && inert.noScriptSrc ? 0 : 1);
