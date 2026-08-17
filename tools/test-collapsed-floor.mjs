// =============================================================================
// Collapsed-floor save  (PLAN.md §2.3)
// -----------------------------------------------------------------------------
// stacked_headers_studs RENDERS CONDITIONALLY: render() wraps each floor's
// header/stud tables in `if(fl.exp){...}`, so a collapsed floor is absent from
// the DOM entirely — not hidden. Snapshot CSS cannot reveal what was never
// rendered, so a record saved with a floor collapsed would silently omit it.
// adapter.expandAll() materializes everything before capture and restores the
// engineer's view afterwards. Nothing tested that until now.
// =============================================================================
import { chromium } from 'playwright';

const U = 'http://localhost:3000/Calcs/stacked_headers_studs_calculator.html';
const SENTINEL = '86753.09';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.goto(U, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.waitForTimeout(800);

const out = await page.evaluate(async (sentinel) => {
  document.getElementById('areJob').value = 'COLLAPSED-FLOOR';

  // Put a sentinel inside floor index 1, then COLLAPSE that floor.
  addHeader(1);
  render();
  floors[1].headers[0].w = sentinel;
  render();
  floors[1].exp = false;
  render();

  const domHasSentinelWhileCollapsed = document.body.innerHTML.includes(sentinel);
  const s = await window.AREv2.buildSnapshot('f');

  return {
    domHasSentinelWhileCollapsed,
    snapshotHasSentinel: s.html.includes(sentinel),
    modelHasSentinel: JSON.stringify(s.state.model).includes(sentinel),
    liveStillCollapsed: floors[1].exp === false,
    html: s.html,
  };
}, SENTINEL);

console.log('collapsed floor present in live DOM :', out.domHasSentinelWhileCollapsed, '(expected false)');
console.log('sentinel captured in snapshot HTML  :', out.snapshotHasSentinel, '(expected true)');
console.log('sentinel captured in model          :', out.modelHasSentinel, '(expected true)');
console.log('live view restored to collapsed     :', out.liveStillCollapsed, '(expected true)');

// And it must reload.
const p2 = await ctx.newPage();
await p2.goto(U, { waitUntil: 'load' });
await p2.waitForSelector('#areBar');
await p2.waitForTimeout(800);
const rt = await p2.evaluate(async (args) => {
  const st = window.AREv2.parseSnapshot(args.html);
  const r = window.AREv2.loadFromState(st);
  if (r.ok) await window.AREv2.runAndSettle();
  return { ok: r.ok, sentinelBack: JSON.stringify(floors).includes(args.sentinel),
           collapsedPreserved: floors[1] && floors[1].exp === false };
}, { html: out.html, sentinel: SENTINEL });
console.log('reload ok / sentinel / collapsed    :', rt.ok, rt.sentinelBack, rt.collapsedPreserved);

await b.close();
const pass = out.domHasSentinelWhileCollapsed === false && out.snapshotHasSentinel && out.modelHasSentinel &&
             out.liveStillCollapsed && rt.ok && rt.sentinelBack && rt.collapsedPreserved;
console.log(pass ? '\nPASS — collapsed-floor data is captured, the view is restored, and it reloads.'
                 : '\nFAIL — collapsed-floor handling is broken.');
process.exit(pass ? 0 : 1);
