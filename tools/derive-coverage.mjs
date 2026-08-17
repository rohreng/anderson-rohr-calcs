// =============================================================================
// Coverage manifest — derive & drift-gate  (PLAN.md §5 step 1)
// -----------------------------------------------------------------------------
// The manifest is authoritative for STRUCTURE — which file carries which script —
// not for classification. Two of its columns (dyn_rows, idless_inputs) are
// documented in PLAN.md as unreliable heuristics, so they WARN and never fail:
// gating on them would manufacture false failures on honest edits.
//
// The structural columns do gate, because each one guards a regression that has
// already happened once in this project:
//   v2         — a calc silently losing its toolbar
//   v1_tag     — a legacy /are-utils.js tag coming back
//   v1_inline  — an inline v1 implementation or React override returning, which
//                makes are-utils-v2's injectToolbar() a silent no-op
//   adapter    — an adapter disappearing, cross-checked at runtime against
//                whether the snapshot actually carries a model
//
// Usage:
//   node tools/derive-coverage.mjs            # check for drift, exit 1 on fail
//   node tools/derive-coverage.mjs --write    # regenerate the CSV
// =============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CALCS_DIR = fileURLToPath(new URL('../public/Calcs/', import.meta.url));
const CSV_PATH = fileURLToPath(new URL('./calc-coverage.csv', import.meta.url));
const EXCLUDE = new Set(['steel-calc-template-eval-review.html']);

export const COLUMNS = [
  'file', 'v2', 'v1_tag', 'v1_inline', 'are_calc_css',
  'own_print', 'dyn_rows', 'idless_inputs', 'react', 'adapter',
];

// Columns whose drift is a real regression. dyn_rows/idless_inputs excluded on
// purpose — see header.
export const GATED = ['v2', 'v1_tag', 'v1_inline', 'are_calc_css', 'own_print', 'react', 'adapter'];
export const ADVISORY = ['dyn_rows', 'idless_inputs'];

// Absolute invariants, independent of the stored CSV.
const INVARIANTS = [
  { col: 'v2', want: 1, msg: 'must load are-utils-v2.js exactly once' },
  { col: 'v1_tag', want: 0, msg: 'must not load the legacy /are-utils.js' },
  { col: 'v1_inline', want: 0, msg: 'must not define its own areSave (inline v1 or React override)' },
];

export function deriveCoverage(dir = CALCS_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.html') && !EXCLUDE.has(f))
    .sort();

  return files.map((file) => {
    const src = readFileSync(path.join(dir, file), 'utf8').replace(/\r/g, '');
    const count = (re) => (src.match(re) || []).length;
    return {
      file,
      v2: count(/<script[^>]*src="\/are-utils-v2\.js"/g),
      v1_tag: count(/<script[^>]*src="\/are-utils\.js"/g),
      v1_inline: count(/function\s+areSave\s*\(|window\.areSave\s*=/g),
      are_calc_css: /are-calc\.css/.test(src) ? 1 : 0,
      own_print: /onclick="[^"]*print|window\.print\(\)/.test(src) ? 1 : 0,
      dyn_rows: /function\s+add[A-Za-z]+\s*\(/.test(src) ? 1 : 0,
      idless_inputs: (src.match(/<(input|select|textarea)[^>]*>/g) || [])
        .filter((t) => !/\bid=/.test(t)).length,
      // React arrives vendored (/vendor/react-*.js) since 2026-08-17; the unpkg
      // pattern is kept so a CDN tag creeping back is still classified as React
      // rather than silently falling out of the column.
      react: /unpkg\.com\/react|\/vendor\/react-/.test(src) ? 1 : 0,
      adapter: count(/AREv2\.registerAdapter\s*\(/g),
    };
  });
}

function toCsv(rows) {
  return COLUMNS.join(',') + '\n' + rows.map((r) => COLUMNS.map((c) => r[c]).join(',')).join('\n') + '\n';
}

function readCsv() {
  let raw;
  try { raw = readFileSync(CSV_PATH, 'utf8'); } catch { return null; }
  const lines = raw.replace(/\r/g, '').trim().split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((l) => {
    const cells = l.split(',');
    const o = { __cells: cells.length };
    header.forEach((h, i) => { o[h] = /^\d+$/.test(cells[i]) ? Number(cells[i]) : cells[i]; });
    return o;
  });
  return { header, rows };
}

/** @returns {{ok:boolean, errors:string[], warnings:string[]}} */
export function checkCoverage() {
  const errors = [];
  const warnings = [];
  const derived = deriveCoverage();

  // Invariants first — these hold regardless of what the CSV says.
  for (const row of derived) {
    for (const inv of INVARIANTS) {
      if (row[inv.col] !== inv.want) {
        errors.push(`${row.file}: ${inv.msg} (${inv.col}=${row[inv.col]}, expected ${inv.want})`);
      }
    }
  }

  const stored = readCsv();
  if (!stored) {
    errors.push('tools/calc-coverage.csv is missing — run: node tools/derive-coverage.mjs --write');
    return { ok: false, errors, warnings, derived };
  }

  // Schema
  if (stored.header.join(',') !== COLUMNS.join(',')) {
    errors.push(`manifest header mismatch\n  stored : ${stored.header.join(',')}\n  derived: ${COLUMNS.join(',')}`);
    return { ok: false, errors, warnings, derived };
  }
  const bad = stored.rows.filter((r) => r.__cells !== COLUMNS.length);
  if (bad.length) errors.push(`${bad.length} manifest row(s) have wrong column count`);
  const seen = new Set();
  for (const r of stored.rows) {
    if (seen.has(r.file)) errors.push(`duplicate manifest row: ${r.file}`);
    seen.add(r.file);
  }

  // Row set
  const dMap = new Map(derived.map((r) => [r.file, r]));
  for (const r of stored.rows) if (!dMap.has(r.file)) errors.push(`manifest lists a file that no longer exists: ${r.file}`);
  for (const r of derived) if (!seen.has(r.file)) errors.push(`calc not in manifest: ${r.file}`);

  // Per-column drift
  for (const s of stored.rows) {
    const d = dMap.get(s.file);
    if (!d) continue;
    for (const col of GATED) {
      if (s[col] !== d[col]) errors.push(`${s.file}: ${col} drifted ${s[col]} -> ${d[col]}`);
    }
    for (const col of ADVISORY) {
      if (s[col] !== d[col]) warnings.push(`${s.file}: ${col} ${s[col]} -> ${d[col]} (advisory heuristic)`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, derived };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('derive-coverage.mjs')) {
  if (process.argv.includes('--write')) {
    const rows = deriveCoverage();
    writeFileSync(CSV_PATH, toCsv(rows), 'utf8');
    console.log(`wrote ${rows.length} rows to tools/calc-coverage.csv`);
    process.exit(0);
  }
  const res = checkCoverage();
  res.warnings.forEach((w) => console.log('WARN  ' + w));
  res.errors.forEach((e) => console.log('FAIL  ' + e));
  console.log(res.ok ? `\nmanifest ok — ${res.derived.length} calcs, ${res.warnings.length} advisory warning(s)`
                     : `\nmanifest FAILED — ${res.errors.length} error(s)`);
  process.exit(res.ok ? 0 : 1);
}
