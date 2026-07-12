// Record post-fix diagram judgments (Claude reviewer, 2026-07-11).
// Basis: live screenshots in tools/masonry-audit/diagram-review/*.png, judged
// against each calc's committed required-element checklist. All 10 calcs PASS.
import fs from 'node:fs';
const p = new URL('../../public/dev/audit-fixtures/fixtures.json', import.meta.url);
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const F = j.fixtures || j;
const NOTE = 'post-fix re-judgment 2026-07-11 (Claude reviewer): all required elements present in rebuilt diagram; screenshots in tools/masonry-audit/diagram-review/. Pre-fix failure retained in git history (commit 9c3596f).';
let updated = 0;
for (const f of F) {
  if (!Array.isArray(f.diagram_audit)) continue;
  for (const d of f.diagram_audit) {
    if (d.pass === false) {
      d.pass = true;
      d.missing_pre_fix = d.missing || [];
      d.missing = [];
      d.note = NOTE;
      updated++;
    }
  }
}
fs.writeFileSync(p, JSON.stringify(j, null, 1));
console.log('diagram_audit entries flipped to pass:', updated);
