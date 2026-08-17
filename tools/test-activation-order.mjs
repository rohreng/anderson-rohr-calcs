// =============================================================================
// Transient-activation ordering test  (PLAN.md §5, Rev. 6)
// -----------------------------------------------------------------------------
// Picker calls and requestPermission() require transient user activation, and
// activation is consumed once an `await` chain returns. So the Save click
// handler MUST acquire its destination synchronously, before building the
// snapshot. A refactor that reintroduces an await ahead of the picker breaks
// saving for every engineer, silently, with a SecurityError.
//
// Playwright cannot drive a native folder dialog — but it can stub the pickers
// and assert navigator.userActivation.isActive AT CALL TIME, plus the call
// order. That is the property that actually matters.
//
// Covers both activation-sensitive branches:
//   1. first-time save            -> showDirectoryPicker()
//   2. remembered handle, lapsed  -> requestPermission()
// =============================================================================

import { chromium } from 'playwright';

const URL = 'http://localhost:3000/Calcs/cantilever_plate_deflection_calculator.html';
const browser = await chromium.launch({ headless: true });
const failures = [];

async function run(label, install) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.waitForFunction(() => window.AREv2?.isReady?.() === true, null, { timeout: 15000 });
  await page.evaluate(install);
  await page.evaluate(() => { document.getElementById('areJob').value = 'ACTIVATION-TEST'; });

  // A REAL click — the only way to get genuine transient activation.
  await page.click('#areSaveBtn');
  await page.waitForTimeout(1500);

  const log = await page.evaluate(() => window.__activationLog);
  await ctx.close();
  return { label, log };
}

// 1. First-time save: no stored handle -> showDirectoryPicker must be called
//    while activation is still live.
const first = await run('first-time showDirectoryPicker', () => {
  window.__activationLog = [];
  const rec = (name) => {
    window.__activationLog.push({
      call: name,
      active: navigator.userActivation ? navigator.userActivation.isActive : null,
      at: performance.now(),
    });
  };
  window.showDirectoryPicker = async () => {
    rec('showDirectoryPicker');
    const err = new Error('stubbed'); err.name = 'AbortError'; throw err;
  };
});

// 2. Remembered handle whose permission has lapsed -> requestPermission must be
//    called while activation is still live.
const lapsed = await run('lapsed-grant requestPermission', () => {
  window.__activationLog = [];
  const rec = (name) => {
    window.__activationLog.push({
      call: name,
      active: navigator.userActivation ? navigator.userActivation.isActive : null,
      at: performance.now(),
    });
  };
  // Force the "remembered handle" branch by planting one on the module's cache
  // via the same path init uses: a fake handle whose permission is 'prompt'.
  const fake = {
    kind: 'directory',
    queryPermission: async () => 'prompt',
    requestPermission: async () => { rec('requestPermission'); return 'denied'; },
    getFileHandle: async () => { throw new Error('should not reach'); },
  };
  window.showDirectoryPicker = async () => {
    rec('showDirectoryPicker');
    const err = new Error('stubbed'); err.name = 'AbortError'; throw err;
  };
  // AREv2 keeps the handle privately; re-enter through the documented seam.
  if (window.AREv2 && AREv2._setDirHandleForTest) AREv2._setDirHandleForTest(fake);
  else window.__noSeam = true;
});

// 3. Permission prompt resolves 'denied', then the fallback picker throws
//    SecurityError — the prompt already consumed the click's activation, so
//    this is what genuinely happens on a lapsed grant. The old behavior mapped
//    that SecurityError to the anchor-download fallback: the engineer expected
//    the project folder and silently got Downloads. Assert the fix: NO download
//    is produced and the "click Save again" retry message is shown instead.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const downloads = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  await page.waitForFunction(() => window.AREv2?.isReady?.() === true, null, { timeout: 15000 });
  await page.evaluate(() => {
    window.__calls = [];
    const fake = {
      kind: 'directory',
      queryPermission: async () => 'prompt',
      requestPermission: async () => { window.__calls.push('requestPermission'); return 'denied'; },
      getFileHandle: async () => { throw new Error('should not reach the write path'); },
    };
    window.showDirectoryPicker = async () => {
      window.__calls.push('showDirectoryPicker');
      const err = new Error('Must be handling a user gesture to show a file picker.');
      err.name = 'SecurityError'; throw err;
    };
    AREv2._setDirHandleForTest(fake);
    document.getElementById('areJob').value = 'DENIED-TEST';
  });
  await page.click('#areSaveBtn');
  await page.waitForTimeout(2500);       // destination rejects fast; toast is up for 6s
  const out = await page.evaluate(() => ({
    calls: window.__calls,
    toast: (document.getElementById('areToast') || {}).textContent || '',
  }));
  await ctx.close();

  if (downloads.length) {
    failures.push(`denied-grant: a download WAS produced (${downloads.join(', ')}) — ` +
                  'the SecurityError fell through to the download fallback');
  }
  if (!/click Save again/.test(out.toast)) {
    failures.push(`denied-grant: retry message not shown — toast was "${out.toast}"`);
  }
  if (out.calls.join(',') !== 'requestPermission,showDirectoryPicker') {
    failures.push(`denied-grant: unexpected call sequence ${out.calls.join(',')}`);
  }
  console.log(`  denied-grant retry: calls=${out.calls.join(',')} downloads=${downloads.length} toast="${out.toast}"`);
}

for (const r of [first, lapsed]) {
  const log = r.log || [];
  if (!log.length) {
    failures.push(`${r.label}: picker was never called`);
    continue;
  }
  const first = log[0];
  if (first.active !== true) {
    failures.push(`${r.label}: ${first.call} ran WITHOUT transient activation — ` +
                  `an await was introduced before it`);
  }
  console.log(`  ${r.label}: ${first.call} activation=${first.active}`);
}

await browser.close();

if (failures.length) {
  console.log('\nFAIL');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nActivation ordering holds: pickers run inside the click, before any await.');
process.exit(0);
