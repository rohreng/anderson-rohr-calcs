// Fix the two wall assertion patterns to match actual rendered text (file-based: shell layers eat backslashes).
import fs from 'node:fs';
const p = new URL('../../public/dev/audit-fixtures/fixtures.json', import.meta.url);
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const F = j.fixtures || j;
const e1 = F.find(x => x.id === 'rek-02-asd-oop').expected.find(x => x.label.startsWith('wind x0.6'));
e1.actual_pattern = '×0\\.6→([\\d.]+) service';
const e2 = F.find(x => x.id === 'urwall-6in-hand').expected.find(x => x.label.startsWith('OOP shear allowable'));
e2.actual_pattern = 'psi Fv = ([\\d.]+) psi';
for (const x of F) for (const e of x.expected || []) {
  new RegExp(e.actual_pattern, 'i');
  if (/\(\[d[.,]\]/.test(e.actual_pattern)) throw new Error(`mangled: ${x.calc}/${x.id}`);
}
fs.writeFileSync(p, JSON.stringify(j, null, 1));
console.log('ok:', e1.actual_pattern, '|', e2.actual_pattern);
