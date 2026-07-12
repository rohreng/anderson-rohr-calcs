// Promote wall fixtures to enforced benchmarks after the RWALL-3..7 / URWALL-3..5 fixes (2026-07-11).
import fs from 'node:fs';
const p = new URL('../../public/dev/audit-fixtures/fixtures.json', import.meta.url);
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const F = j.fixtures || j;
const by = (c, i) => F.find(x => x.calc === c && x.id === i);

// REK-05 in-plane: example uses No.4@40; new Anv model needs the real spacing.
let f = by('masonry_reinforced_wall_asd', 'rek-05-asd-inplane');
f.inputs.sOOP = 40;
f.benchmark_status = 'benchmark';
f.note = 'RWALL-3 FIXED: partial-grout Anv incl. grouted cells (REK-05 basis, Anv=968 in² at No.4@40). fv f\'m-independent so fm=2000 acceptable.';

// REK-02 OOP: drivable now (fm 1750 + ultimate-wind convention).
f = by('masonry_reinforced_wall_asd', 'rek-02-asd-oop');
f.benchmark_status = 'benchmark';
delete f.blocking_value;
f.note = 'RWALL-4/5/7 FIXED. wWind is ULTIMATE C&C (x0.6 internal). M asserted at 3% tol: calc simple-span 410.88 vs MDG 400 (MDG includes parapet reaction relief) - conservative, disclosed. fv asserted at calc V=102.7 basis (13.52); MDG 13.95 uses parapet-augmented V=106; the Anv=7.60 area basis (the finding) reproduces exactly.';
f.inputs.wWind = 21.4;
f.expected = [
  { label: 'wind x0.6 strip load (MDG 12.84)', expected_value: 12.84, actual_pattern: '0\\.6 × 21\\.4 = ([\\d.]+) psf', relative_tolerance_percent: 0.5 },
  { label: 'OOP shear area Anv (MDG 7.6)', expected_value: 7.6, actual_pattern: '12×3\\.80 = ([\\d.]+) in', relative_tolerance_percent: 0.5 },
  { label: 'OOP shear stress fv (calc V basis; MDG 13.95 at V=106)', expected_value: 13.52, actual_pattern: '/7\\.60 = ([\\d.]+) psi', relative_tolerance_percent: 0.5 },
  { label: 'allowable Fb (MDG=788)', expected_value: 788, actual_pattern: '[\\d.]+ psi / ([\\d.]+) psi fb / Fb \\(masonry\\)', relative_tolerance_percent: 0.5 },
  { label: 'total OOP moment (MDG=400; simple-span conservative)', expected_value: 400, actual_pattern: '([\\d.]+) lb·ft/ft Total OOP Moment', relative_tolerance_percent: 3.0 }
];
f.shown_values = [{ label: 'service strip load', display: '12.84' }];
f.shown_work = ['8.3.2', '0.6'];

// REK-03 axial: drivable now.
f = by('masonry_reinforced_wall_asd', 'rek-03-asd-axial');
f.benchmark_status = 'benchmark';
delete f.blocking_value;
f.note = 'RWALL-6 resolved: TMS Eq. 8-16 coefficient IS 0.30 (original finding\'s 0.25 was a misciting - verified tms_full.txt:7301); real fixes were partial-grout An/In/r (NCMA TEK 14-1B basis, eta=0.867 documented) and dropping untied 0.65AstFs per MDG REK-03. Pa=16357 vs MDG 16300 (0.35%).';
f.inputs.sOOP = 40;
f.inputs.dOOP = 3.8;
f.expected = [
  { label: 'allowable axial Pa (MDG=16,300)', expected_value: 16300, actual_pattern: 'Pa = ([\\d,]+) lb/ft', relative_tolerance_percent: 0.5 }
];
f.shown_values = [
  { label: 'partial-grout An', display: '42.78' },
  { label: 'slenderness h/r', display: '72.97' }
];
f.shown_work = ['8-16'];

// URWALL: enforced; Fb fix ripples unity 0.28 -> 0.27; new limit-state assertions.
f = by('unreinforced_cmu_wall_asd', 'urwall-6in-hand');
f.benchmark_status = 'benchmark';
f.note = 'URWALL-3/4/5 FIXED: Fb=f\'m/3 (500.0), Pe/4 buckling check (e=0 disclosed), OOP shear check per §8.2.6/MDG 11.3-1. Unity expected moved 0.28->0.27 as the direct arithmetic consequence of correcting Fb (fb/Fb term shrinks).';
const u = f.expected.find(x => x.label === 'combined compression unity');
u.expected_value = 0.27;
f.expected.push(
  { label: 'buckling quarter-Pe (hand 37,240)', expected_value: 37239.5, actual_pattern: '¼Pe = ([\\d,.]+) plf', relative_tolerance_percent: 0.5 },
  { label: 'OOP shear stress fv (hand 7.0)', expected_value: 7.0, actual_pattern: 'fv = ([\\d.]+) psi', relative_tolerance_percent: 1.0 },
  { label: 'OOP shear allowable Fv (hand 55.8)', expected_value: 55.8, actual_pattern: 'Governs: Fv = min\\([^)]+\\) = ([\\d.]+) psi', relative_tolerance_percent: 0.5 }
);
f.shown_work.push('8-14', '8.2.6');

// Guard: all patterns compile, none backslash-stripped.
for (const x of F) for (const e of x.expected || []) {
  new RegExp(e.actual_pattern, 'i');
  if (/\(\[d[.,]\]/.test(e.actual_pattern)) throw new Error(`mangled: ${x.calc}/${x.id}: ${e.actual_pattern}`);
}
fs.writeFileSync(p, JSON.stringify(j, null, 1));
console.log('promoted; statuses:', F.map(x => x.calc + '/' + x.id + ':' + (x.benchmark_status || '')).filter(s => s.includes('wall')).join(' | '));
