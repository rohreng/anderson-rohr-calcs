// =============================================================================
// Spike: is the File System Access API usable inside the calc <iframe>?
// -----------------------------------------------------------------------------
// PLAN.md gates the whole remembered-folder design on this. The production calc
// iframe (app/(main)/calcs/[slug]/page.tsx) is same-origin, unsandboxed, with no
// Permissions-Policy header. Spec says that is allowed; this proves it.
//
// Method: click a button INSIDE the frame with a trusted Playwright click (real
// transient activation), then read the structured verdict the page records.
//   • promise still pending after 1200ms  -> native dialog opened  -> PERMITTED
//   • SecurityError                        -> BLOCKED
//
// A cross-origin NEGATIVE CONTROL runs first. 127.0.0.1 and localhost are
// different origins to the browser but the same dev server, so the control must
// report BLOCKED. If it does not, the detection method cannot see blocking and
// a PERMITTED result from the real case would be meaningless.
//
// Usage:  node tools/spike-fsa-iframe.mjs          (headed, default)
//         node tools/spike-fsa-iframe.mjs --headless
// =============================================================================

import { chromium } from 'playwright';

const HEADLESS = process.argv.includes('--headless');
const BASE_SAME = 'http://localhost:3000';
const BASE_XO = 'http://127.0.0.1:3000';

async function runCase({ browser, url, label, expect }) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const frame = page.frameLocator('#frame');
  const button = frame.locator('#dir');
  await button.waitFor({ state: 'visible', timeout: 10000 });

  // Trusted click -> real transient user activation.
  await button.click();

  // Give the 1200ms pending-detector time to fire.
  await page.waitForTimeout(2200);

  const result = await page
    .frames()
    .find((f) => f.url().includes('fsa-inner.html'))
    .evaluate(() => ({
      verdict: window.__fsa?.verdict ?? null,
      detail: window.__fsa?.detail ?? null,
      activation: window.__fsa?.activation ?? null,
      framed: window.top !== window.self,
      origin: location.origin,
      apiPresent: typeof window.showDirectoryPicker,
    }));

  await context.close();

  const pass = result.verdict === expect;
  return { label, url, expect, pass, consoleErrors, ...result };
}

function line(r) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  return [
    `${mark}  ${r.label}`,
    `      url        : ${r.url}`,
    `      framed     : ${r.framed}   origin: ${r.origin}`,
    `      activation : ${r.activation}   showDirectoryPicker: ${r.apiPresent}`,
    `      expected   : ${r.expect}`,
    `      verdict    : ${r.verdict}  (${r.detail})`,
  ].join('\n');
}

const browser = await chromium.launch({ headless: HEADLESS });
console.log(`\nFSA-in-iframe spike — ${HEADLESS ? 'headless' : 'headed'} chromium\n${'='.repeat(64)}\n`);

const control = await runCase({
  browser,
  url: `${BASE_XO}/dev/fsa-spike-xo.html`,
  label: 'NEGATIVE CONTROL — cross-origin iframe (must be BLOCKED)',
  expect: 'BLOCKED',
});
console.log(line(control), '\n');

const real = await runCase({
  browser,
  url: `${BASE_SAME}/dev/fsa-spike.html`,
  label: 'REAL CASE — same-origin unsandboxed iframe (calc equivalent)',
  expect: 'PERMITTED',
});
console.log(line(real), '\n');

await browser.close();

console.log('='.repeat(64));
if (!control.pass) {
  console.log('INVALID: the negative control did not report BLOCKED.');
  console.log('The detection method cannot distinguish blocked from permitted,');
  console.log('so the real-case result proves nothing. Do not rely on it.');
  process.exit(2);
}
if (!real.pass) {
  console.log('RESULT: FSA is BLOCKED in the calc iframe.');
  console.log('The remembered-folder design collapses to plain downloads.');
  process.exit(1);
}
console.log('RESULT: FSA is PERMITTED in the same-origin calc iframe,');
console.log('and the negative control confirms the test can detect blocking.');
console.log('PLAN.md gate cleared — the directory-handle design stands.');
process.exit(0);
