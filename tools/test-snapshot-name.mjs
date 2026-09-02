// =============================================================================
// Saved-filename length test
// -----------------------------------------------------------------------------
// Windows caps a full path at MAX_PATH (260). When the save dialog cannot fit
// <folder>\<name>.html inside that, it hands Chrome an 8.3 / \?\ path and
// Chrome's File System Access blocklist refuses it with the misleading
// "can't open files in this folder because it contains system files" dialog.
// A real project folder was 163 chars deep; the generated filename was 117.
//
// AREv2.snapshotName() must therefore keep the basename (no extension) at or
// under 90 characters, trimming the least important segment first, and must
// drop a plain " - " subtitle from the calc title the way it already drops
// em-dash / en-dash / pipe subtitles.
//
// No dev server needed: every request is fulfilled from public/ on disk.
// Usage: node tools/test-snapshot-name.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://calcs.test/Calcs/beam_calculator.html', { waitUntil: 'load' });
await page.waitForSelector('#areBar');

const failures = [];
function check(label, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : `\n      got:      ${JSON.stringify(actual)}\n      expected: ${typeof expected === 'function' ? '(predicate)' : JSON.stringify(expected)}`));
  if (!ok) failures.push(label);
}

const name = (args) => page.evaluate((a) => window.AREv2.snapshotName(a), args);
const DATE = '2026-09-01';

// 1. Existing behaviour is unchanged for a short name (em-dash subtitle dropped).
check('short name keeps the pre-existing format',
  await name({ project: '25-010-RLV', title: 'Holdown Spread Footing Design — Shearwall Uplift', mark: 'SW-4', date: DATE }),
  '25-010-RLV - Holdown Spread Footing Design - SW-4 - ' + DATE);

// 2. Blank mark emits no empty token.
check('blank mark is omitted',
  await name({ project: '25-010-RLV', title: 'Snow Load Calculator', mark: '', date: DATE }),
  '25-010-RLV - Snow Load Calculator - ' + DATE);

// 3. A plain " - " subtitle is dropped like the dash/pipe ones.
check('plain " - " subtitle is dropped',
  await name({ project: '26-038-HNR', title: 'PCI Beam Design Calculator - Design Aid 15.1.3', mark: 'B1', date: DATE }),
  '26-038-HNR - PCI Beam Design Calculator - B1 - ' + DATE);

// 4. Hyphenated words without surrounding spaces are not a subtitle break.
check('hyphenated words survive',
  await name({ project: '26-038-HNR', title: 'Through-Plate Connection Calculator - AISC Database Integration', mark: '', date: DATE }),
  '26-038-HNR - Through-Plate Connection Calculator - ' + DATE);
check('"ASCE 7-16" survives',
  await name({ project: '26-038-HNR', title: 'ASCE 7-16 MWFRS Wind — Directional Procedure', mark: '', date: DATE }),
  '26-038-HNR - ASCE 7-16 MWFRS Wind - ' + DATE);

// 5. The real failing case (folder was 163 chars): basename must fit 90.
const real = await name({ project: '26-038-HNR - Red Bluff Hote', title: 'PCI Beam Design Calculator - Design Aid 15.1.3', mark: 'BRICK CORBEL AT ROOM', date: DATE });
check('real failing case is <= 90 chars', real, (s) => typeof s === 'string' && s.length <= 90);
check('real failing case still ends with the date', real, (s) => typeof s === 'string' && s.endsWith(' - ' + DATE));
check('real failing case still starts with the project number', real, (s) => typeof s === 'string' && s.startsWith('26-038-HNR'));
check('real failing case keeps the mark', real, (s) => typeof s === 'string' && s.indexOf('BRICK CORBEL') !== -1);
console.log('      real case -> ' + JSON.stringify(real) + ' (' + (real ? real.length : 'n/a') + ')');

// 6. Absurd inputs still fit and cut on word boundaries, never mid-word.
const long = await name({ project: 'P'.repeat(60) + ' Project With A Very Long Client Name', title: 'Some Very Long Calculator Title That Goes On And On Forever', mark: 'MARK WITH MANY WORDS IN IT FOR SURE', date: DATE });
check('absurd inputs still <= 90', long, (s) => typeof s === 'string' && s.length <= 90);
check('no dangling separator after a cut', long, (s) => typeof s === 'string' && !/ -  - | - $|^ - /.test(s) && !/\s{2,}/.test(s));

// 6b. A stem shorter than 18 chars is useless on its own ("Masonry", "HSS
//     Column"): keep pulling in the next segment until it is long enough.
check('short stem pulls in the next segment',
  await name({ project: '26-038-HNR', title: 'Masonry — Headed Anchor Bolt (Shear Connection)', mark: '', date: DATE }),
  '26-038-HNR - Masonry - Headed Anchor Bolt (Shear Connection) - ' + DATE);
check('short stem stops once it is long enough',
  await name({ project: '26-038-HNR', title: 'Embed Plate — Beam Bearing at CMU Face — ASD | TMS 402-22', mark: '', date: DATE }),
  '26-038-HNR - Embed Plate - Beam Bearing at CMU Face - ' + DATE);
check('two channel-beam calcs no longer collide',
  await name({ project: '26-038-HNR', title: 'Channel Beam – HSS Brace Connection Calculator', mark: '', date: DATE }),
  '26-038-HNR - Channel Beam - HSS Brace Connection Calculator - ' + DATE);
check('extended stem still obeys the cap',
  await name({ project: '26-038-HNR - Red Bluff Hotel', title: 'HSS Column — Brace Gusset Plate Connection Calculator', mark: 'BRACE AT GL B LEVEL 2', date: DATE }),
  (s) => typeof s === 'string' && s.length <= 90 && s.indexOf('HSS Column - Brace') !== -1);

check('a cut never leaves a dangling "&"',
  await name({ project: '26-038-HNR - Red Bluff Hote', title: 'ASCE 7-16 Components & Cladding Wind Pressure', mark: 'BRICK CORBEL AT ROOM', date: DATE }),
  (s) => typeof s === 'string' && s.indexOf(' & - ') === -1 && s.indexOf('ASCE 7-16 Components - ') !== -1);

// 7. The toolbar path uses the same builder: suggestedName for Save-as.
check('snapshotBasename delegates (document.title of beam calc)',
  await page.evaluate(() => { document.getElementById('areJob').value = '26-038-HNR - Red Bluff Hote'; document.getElementById('areMark').value = 'BRICK CORBEL AT ROOM'; return window.AREv2._snapshotBasenameForTest(); }),
  (s) => typeof s === 'string' && s.length <= 90 && s.indexOf('Design Aid') === -1);

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
