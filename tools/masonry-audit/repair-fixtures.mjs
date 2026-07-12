// One-shot repair: shell-mangled regex escapes, stale statuses (2026-07-11 takeover).
import fs from 'node:fs';
const p = new URL('../../public/dev/audit-fixtures/fixtures.json', import.meta.url);
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const F = j.fixtures || j;
const by = (c, i) => F.find(x => x.calc === c && x.id === i);

// 1. Repair backslash-stripped patterns (written via shell heredoc, escapes eaten).
const fix = (c, i, label, pattern) => {
  const f = by(c, i);
  const e = f.expected.find(x => x.label === label);
  if (e) e.actual_pattern = pattern;
};
fix('masonry_reinforced_wall_asd', 'rek-05-asd-inplane', 'in-plane shear stress fv (MDG=16.6)',
  '([\\d.]+) psi / [\\d.]+ psi fv / Fv \\(in-plane\\)');
fix('masonry_reinforced_wall_asd', 'rek-05-asd-inplane', 'in-plane total V sanity (MDG=16.1k)',
  '([\\d.]+) kips \\(L');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'net flexural tension fnet (governing)', 'fnet = ([\\d.]+) psi');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'allowable flexural tension Ft (Type S hollow)', 'Ft = ([\\d.]+) psi');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'axial stress fa', '([\\d.]+) psi Actual Axial');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'allowable axial Fa (Eq 8-11)', '([\\d.]+) psi Allow\\. Axial');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'flexural stress fb', '([\\d.]+) psi Actual Flexural');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'allowable flexural Fb (Eq 8-13 = fm/3)', '([\\d.]+) psi Allow\\. Flexural');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'wind moment M', 'M = ([\\d.]+) ft-lb/ft');
fix('unreinforced_cmu_wall_asd', 'urwall-6in-hand', 'combined compression unity', '([\\d.]+) Combined Unity');

fix('masonry_anchor', 'rek-08-asd', 'REK-08 masonry tension', 'Ba,mas = ([\\d.]+) kip');

// 2. lintel/jamb REK-04 is drivable now (direct M/V/P mode exists) — clear stale status.
const lj = by('masonry_lintel_jamb', 'rek-04-asd');
lj.benchmark_status = 'benchmark';
delete lj.blocking_value;
// its pattern was written in the same mangled batch — repair it too
lj.expected = [{ label: 'REK-04 target M', expected_value: 39775,
  actual_pattern: 'Direct ASD demands: M = ([\\d,]+) lb', relative_tolerance_percent: 0.5 }];

// Final guard: every pattern compiles and none is still backslash-stripped.
for (const f of F) for (const e of f.expected || []) {
  new RegExp(e.actual_pattern, 'i'); // throws on invalid
  if (/\(\[d[.,]\]/.test(e.actual_pattern)) throw new Error(`still-mangled pattern in ${f.calc}/${f.id}: ${e.actual_pattern}`);
}

fs.writeFileSync(p, JSON.stringify(j, null, 1));
console.log('fixtures repaired:', F.length);
