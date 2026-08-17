// Verify the toolbar actually initializes on every calc, and that exactly one
// toolbar exists. The failure this guards against is silent: are-utils-v2's
// injectToolbar() bails on `if (document.getElementById('areBar')) return;`, so
// a leftover inline-v1 bar makes the v2 script a no-op with no error anywhere.
//
// Usage: node tools/verify-toolbar.mjs [file.html ...]   (default: all 55)
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { isBenign, isPreexisting } from './known-issues.mjs';
import { fileURLToPath } from 'node:url';

// middleware.ts's matcher uses `js(?!on)`, so .json is routed THROUGH Clerk
// auth. A harness context has no session, so /data/*.json 404s even though the
// file exists on disk. Serve it directly rather than authenticating — it also
// makes the harness deterministic and offline-capable.
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
async function serveStaticJson(page) {
  await page.route('**/data/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      route.fulfill({ status: 200, contentType: 'application/json',
                      body: readFileSync(PUBLIC_DIR + name) });
    } catch { route.continue(); }
  });
}

const CALCS_DIR = new URL('../public/Calcs/', import.meta.url);
const EXCLUDE = new Set(['steel-calc-template-eval-review.html']);

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(CALCS_DIR).filter((f) => f.endsWith('.html') && !EXCLUDE.has(f));


const browser = await chromium.launch({ headless: true });
const rows = [];

for (const file of files) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await serveStaticJson(page);
  const errs = [];
  const benign = [];
  const push = (m) => ((isBenign(m) || isPreexisting(file, m)) ? benign : errs).push(m);
  page.on('pageerror', (e) => push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') push(m.text()); });
  // Only same-origin failures are this app's problem. External CDNs (Google
  // Fonts, unpkg) flake in sandboxes; the snapshot's offline test asserts
  // separately that a SAVED file makes no external requests at all.
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith('http://localhost:3000')) {
      push(`HTTP ${r.status()} ${r.url()}`);
    }
  });

  let state = {};
  try {
    await page.goto(`http://localhost:3000/Calcs/${file}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => ({
      bars: document.querySelectorAll('.are-bar, #areBar').length,
      saveBtn: !!document.getElementById('areSaveBtn'),
      saveIsSnapshot: typeof window.areSave === 'function' &&
                      !/localStorage/.test(String(window.areSave)),
      hasBuildSnapshot: typeof window.AREv2?.buildSnapshot === 'function',
      legacyPrintButtons: document.querySelectorAll('[onclick*="window.print()"]').length,
      ready: window.AREv2?.isReady?.() ?? null,
    }));
  } catch (e) {
    errs.push('NAV: ' + e.message);
  }
  await ctx.close();

  const ok = state.bars === 1 && state.saveBtn && state.saveIsSnapshot &&
             state.hasBuildSnapshot && errs.length === 0;
  rows.push({ file, ok, ...state, errs: errs.slice(0, 2), benign: benign.length });
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('CALC', 52) + pad('BARS', 6) + pad('SAVE', 6) + pad('SNAP', 6) + pad('OLDPRINT', 10) + 'STATUS');
console.log('-'.repeat(92));
let fails = 0;
for (const r of rows) {
  if (!r.ok) fails++;
  console.log(
    pad(r.file, 52) + pad(r.bars ?? '-', 6) + pad(r.saveBtn ? 'y' : 'n', 6) +
    pad(r.saveIsSnapshot ? 'y' : 'n', 6) + pad(r.legacyPrintButtons ?? '-', 10) +
    (r.ok ? ('ok' + (r.benign ? ` (${r.benign} benign warn)` : '')) : 'FAIL ' + (r.errs.join(' | ').slice(0, 90) || 'assertions'))
  );
}
console.log('-'.repeat(92));
console.log(`${rows.length - fails}/${rows.length} passed\n`);
process.exit(fails ? 1 : 0);
