// Proves the workflow Nick described: build up a grade-beam job, DELETE A ZONE
// FROM THE MIDDLE, save that step, and reload it exactly. Count-replay cannot
// do this — the surviving zone ids have a gap (z1,z3,z4) and every saved cell id
// (len_z4, dlplf_z4 ...) must still resolve on reload.
import { chromium } from 'playwright';
const U = 'http://localhost:3000/Calcs/headers_gradebeam_pier_calculator.html';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();

const p1 = await ctx.newPage();
await p1.goto(U, { waitUntil: 'load' });
await p1.waitForSelector('#areBar');
await p1.waitForTimeout(800);

const built = await p1.evaluate(() => {
  document.getElementById('areJob').value = 'DELETE-MIDDLE';
  while (zoneIds.length < 4) addZone();
  // Give each zone a distinguishable load so a mis-mapped restore is visible.
  zoneIds.forEach((id, i) => {
    document.getElementById('lbl_' + id).value = 'ZONE-' + (i + 1);
    document.getElementById('dlplf_' + id).value = String(100 * (i + 1));
    updateZoneRow(id);
  });
  removeZone(zoneIds[1]);            // delete the MIDDLE zone -> gap in ids
  document.getElementById('gbCount').value = 3;
  buildGBTable();
  return { ids: zoneIds.slice(), labels: zoneIds.map((id) => document.getElementById('lbl_' + id).value),
           dls: zoneIds.map((id) => document.getElementById('dlplf_' + id).value) };
});
await p1.evaluate(() => window.AREv2.runAndSettle());
const snap = await p1.evaluate(async () => (await window.AREv2.buildSnapshot('f')).html);
console.log('saved   :', JSON.stringify(built));

const p2 = await ctx.newPage();
await p2.goto(U, { waitUntil: 'load' });
await p2.waitForSelector('#areBar');
await p2.waitForTimeout(800);
const out = await p2.evaluate(async (html) => {
  const st = window.AREv2.parseSnapshot(html);
  const r = window.AREv2.loadFromState(st);          // ORDINARY path, no force
  if (r.ok) await window.AREv2.runAndSettle();
  return { ok: r.ok, applied: r.applied,
           missing: r.mismatches.missingOnPage.slice(0, 5),
           extra: r.mismatches.notInFile.slice(0, 5),
           ids: zoneIds.slice(),
           labels: zoneIds.map((id) => (document.getElementById('lbl_' + id) || {}).value),
           dls: zoneIds.map((id) => (document.getElementById('dlplf_' + id) || {}).value) };
}, snap);
console.log('reloaded:', JSON.stringify(out));
await b.close();

const same = JSON.stringify([built.ids, built.labels, built.dls]) === JSON.stringify([out.ids, out.labels, out.dls]);
console.log(same && out.ok ? '\nPASS — middle-zone deletion round-trips exactly.' : '\nFAIL — deletion did not round-trip.');
process.exit(same && out.ok ? 0 : 1);
