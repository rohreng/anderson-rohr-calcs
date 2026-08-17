// =============================================================================
// ARE calc save/load QA harness  (PLAN.md §5)
// -----------------------------------------------------------------------------
// For every calc: fill deterministically, exercise dynamic rows, run, snapshot,
// reload into a FRESH page on the ORDINARY non-force path requiring ZERO
// mismatches, and diff normalized results. Also asserts snapshot inertness and
// that a saved file opens with no network access at all.
//
//   node tools/qa-calc-roundtrip.mjs                 # all 55
//   node tools/qa-calc-roundtrip.mjs foo.html bar.html
//   node tools/qa-calc-roundtrip.mjs --no-offline    # skip the offline pass
// =============================================================================

import { chromium } from 'playwright';
import { checkCoverage, deriveCoverage } from './derive-coverage.mjs';
import { SCENARIO_SOURCE } from './delete-scenarios.mjs';
import { PREEXISTING, isBenign } from './known-issues.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const CALCS_DIR = path.join(PUBLIC_DIR, 'Calcs');
const TMP = fileURLToPath(new URL('../.qa-tmp/', import.meta.url));
const EXCLUDE = new Set(['steel-calc-template-eval-review.html']);
const BASE = 'http://localhost:3000';

const argv = process.argv.slice(2);
const SKIP_OFFLINE = argv.includes('--no-offline');
const named = argv.filter((a) => !a.startsWith('--'));
const files = named.length
  ? named
  : readdirSync(CALCS_DIR).filter((f) => f.endsWith('.html') && !EXCLUDE.has(f)).sort();


// middleware.ts routes .json through Clerk (`js(?!on)` in its matcher), so a
// session-less harness 404s on /data/*.json. Serve from disk instead of
// weakening auth for a test.
async function serveStaticJson(page) {
  await page.route('**/data/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      route.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(PUBLIC_DIR + name) });
    } catch { route.continue(); }
  });
}

function attachErrors(page, errs) {
  const push = (m) => { if (!isBenign(m)) errs.push(m); };
  page.on('pageerror', (e) => push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') push(m.text()); });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) push(`HTTP ${r.status()} ${r.url()}`);
  });
}

// Deterministic fill + dynamic-row exercise, run entirely in page context.
async function fillPage(page, seed) {
  return page.evaluate(async (seed) => {
    const job = document.getElementById('areJob');
    if (job) job.value = 'QA-TEST';

    // Exercise dynamic lists: click every add-style button twice so row-bearing
    // containers are non-empty and non-default.
    const addButtons = Array.from(document.querySelectorAll('button,[onclick]')).filter((b) => {
      const oc = b.getAttribute('onclick') || '';
      return /^\s*add[A-Za-z]*\(/.test(oc) || /^\+?\s*add/i.test((b.textContent || '').trim());
    });
    let clicks = 0;
    for (const b of addButtons.slice(0, 6)) {
      for (let i = 0; i < 2; i++) { try { b.click(); clicks++; } catch (e) {} }
    }
    await new Promise((r) => setTimeout(r, 250));

    let n = 0, k = seed;
    const rnd = () => { k = (k * 1103515245 + 12345) & 0x7fffffff; return (k % 1000) / 1000; };
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!window.AREv2._isPersistableField(el)) return;
      if (el.disabled || el.readOnly) return;          // don't fight derived fields
      if (el.tagName === 'SELECT') {
        if (el.options.length > 1) { el.selectedIndex = 1 + Math.floor(rnd() * (el.options.length - 1)); n++; }
      } else if (el.type === 'checkbox') {
        el.checked = !el.checked; n++;
      } else if (el.type !== 'radio') {
        const raw = el.value;
        const v = parseFloat(raw);
        if (isFinite(v) && v !== 0) {
          // Preserve integer-ness: several calcs validate counts (stud rows per
          // rib, bolt counts) and throw on a fractional value. Perturbing an
          // integer into a decimal tests nothing real and breaks the calc.
          const isInt = /^-?\d+$/.test(String(raw).trim()) || el.step === '1';
          const scaled = v * (1 + rnd() * 0.2);
          el.value = String(isInt ? Math.max(1, Math.round(scaled)) : Math.round(scaled * 1000) / 1000);
          n++;
        }
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return { filled: n, addButtons: addButtons.length, clicks };
  }, seed);
}

// Normalized SEMANTIC results: not numbers alone. Labels, statuses, units and
// section presence all matter — a snapshot that silently drops a FAIL badge must
// not pass because the numbers happened to match.
async function capture(page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('.are-bar, .are-hub, .are-hub-fab, .are-results-bar, .are-toast')
         .forEach((n) => n.remove());
    const text = (clone.innerText || '').replace(/\s+/g, ' ').trim();
    const statuses = Array.from(clone.querySelectorAll('*'))
      .map((n) => (n.childElementCount === 0 ? (n.textContent || '').trim() : ''))
      .filter((t) => /^(PASS|FAIL|OK|NG|N\/A)$/i.test(t));
    const sections = Array.from(clone.querySelectorAll('h1,h2,h3,h4,.sub-head,.sec-head'))
      .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { text, statuses: statuses.join('|'), sections: sections.join('|') };
  });
}

// Capture repeatedly until two consecutive reads agree. Distinguishes "the
// harness looked too early" (settles after a retry) from "this calc never
// stops mutating" (reported as unstable, which is a real finding).
async function stableCapture(page, tries = 4, waitMs = 500) {
  let prev = await capture(page);
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(waitMs);
    const next = await capture(page);
    if (next.text === prev.text && next.statuses === prev.statuses && next.sections === prev.sections) {
      return { ...next, stable: true, reads: i + 2 };
    }
    prev = next;
  }
  return { ...prev, stable: false, reads: tries + 1 };
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) {
    return `@${i}\n    before: …${a.slice(Math.max(0, i - 70), i + 70)}…\n    after : …${b.slice(Math.max(0, i - 70), i + 70)}…`;
  }
  return a.length === b.length ? '(identical)' : `length ${a.length} vs ${b.length}`;
}

try { rmSync(TMP, { recursive: true, force: true }); } catch {}
mkdirSync(TMP, { recursive: true });

// ── Stage 0: manifest drift gate (PLAN.md §5 step 1) ────────────────────────
// Runs before any Playwright work so a structural regression fails in seconds
// rather than after a 10-minute sweep.
const coverage = checkCoverage();
coverage.warnings.forEach((w) => console.log('WARN  ' + w));
if (!coverage.ok) {
  coverage.errors.forEach((e) => console.log('FAIL  ' + e));
  console.log('\nManifest gate failed — aborting before the browser run.');
  process.exit(2);
}
const MANIFEST = new Map(deriveCoverage().map((r) => [r.file, r]));
const warnNote = coverage.warnings.length ? `, ${coverage.warnings.length} advisory warning(s)` : '';
console.log(`manifest ok — ${MANIFEST.size} calcs${warnNote}\n`);

const browser = await chromium.launch({ headless: true });
const results = [];

for (const file of files) {
  const row = { file, stage: 'load', ok: false, notes: [] };
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  await serveStaticJson(page);
  attachErrors(page, errs);

  try {
    await page.goto(`${BASE}/Calcs/${file}`, { waitUntil: 'load', timeout: 40000 });
    await page.waitForSelector('#areBar', { timeout: 15000 });
    // A defined readiness signal that never resolves means the calc is not in a
    // testable state — that is a failure, not something to shrug past.
    await page.waitForFunction(() => window.AREv2?.isReady?.() !== false, null, { timeout: 25000 });

    const fill = await fillPage(page, 12345);
    row.filled = fill.filled; row.addButtons = fill.addButtons;

    // React calcs: their inputs are model-owned (ownedFields ['#root']) so the
    // generic fill skips them, and a plain DOM value write would not update
    // component state anyway. Drive them the way a user does — native value
    // setter + bubbling change so React's delegated onChange fires — otherwise
    // the round trip only ever exercises the default selections.
    if (MANIFEST.get(file)?.react === 1) {
      row.reactFilled = await page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('#root select').forEach((el) => {
          const real = Array.from(el.options).filter((o) => o.value !== '');
          if (real.length < 2) return;
          const pick = real[Math.floor(real.length / 2)];   // deterministic non-default
          if (pick.value === el.value) return;
          const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
          desc.set.call(el, pick.value);
          el.dispatchEvent(new Event('change', { bubbles: true }));
          n++;
        });
        return n;
      });
      await page.waitForTimeout(300);
      // Model equality is the only strong post-reload criterion here — selected
      // option VALUES never appear in innerText.
      row.modelBefore = await page.evaluate(() => JSON.stringify(window.AREv2._getAdapterModelForTest()));
    }

    // DELETE-A-MIDDLE-ROW scenario (PLAN.md §5 step 2). Sentinels, not counts —
    // a count check passes on regenerated defaults and proves nothing.
    const scenarioSrc = SCENARIO_SOURCE[file];
    if (scenarioSrc) {
      const sc = await page.evaluate((src) => {
        try { return { ok: true, ...(0, eval)('(' + src + ')')() }; }
        catch (e) { return { ok: false, message: e.message }; }
      }, scenarioSrc);
      if (!sc.ok) { row.notes.push('delete scenario threw: ' + sc.message); throw new Error('scenario'); }
      // A renamed/no-op remove function must fail loudly, not pass silently.
      if (!(sc.rowsAfter < sc.rowsBefore)) {
        row.notes.push(`delete scenario removed nothing (${sc.rowsBefore} -> ${sc.rowsAfter})`);
        throw new Error('scenario');
      }
      row.scenario = { before: sc.rowsBefore, after: sc.rowsAfter, sentinels: sc.sentinels };
      await page.waitForTimeout(200);
      row.modelBefore = await page.evaluate(() => JSON.stringify(window.AREv2._getAdapterModelForTest()));
    }

    await page.evaluate(() => window.AREv2.runAndSettle());
    const before = await stableCapture(page);
    if (!before.stable) row.notes.push('WARNING: page never settled before snapshot');

    row.stage = 'snapshot';
    const snap = await page.evaluate(async (m) => {
      try { const s = await window.AREv2.buildSnapshot(m);
            return { ok: true, filename: s.filename, html: s.html, fields: Object.keys(s.state.fields).length,
                     hasModel: s.state.model != null }; }
      catch (e) { return { ok: false, code: e.code || '', message: e.message }; }
    }, 'f');
    if (!snap.ok) { row.notes.push(`buildSnapshot [${snap.code}] ${snap.message}`); throw new Error('snapshot'); }
    row.fields = snap.fields; row.kb = Math.round(snap.html.length / 1024); row.hasModel = snap.hasModel;

    // ANTI-VACUOUS FLOOR. A pass with almost nothing captured is not a pass — it
    // is a calc the harness never actually exercised. This is exactly how the two
    // React calcs "passed" with 2 fields each while their UI had not rendered.
    const mf = MANIFEST.get(file);
    if (snap.fields < 3 && !snap.hasModel) {
      row.notes.push(`only ${snap.fields} field(s) captured and no model — the calc was not exercised`);
      throw new Error('vacuous');
    }
    // The React calcs' whole tree is adapter-owned (#root), so fields is
    // legitimately 0 — but then the MODEL must exist and must be non-default,
    // or this is the 2-fields-while-the-UI-never-rendered vacuous pass again.
    if (mf && mf.react === 1) {
      if (!snap.hasModel) {
        row.notes.push('React calc snapshot carries no adapter model — the component never registered');
        throw new Error('vacuous');
      }
      if (!row.reactFilled) {
        row.notes.push('React calc: no select could be driven — the UI never rendered');
        throw new Error('vacuous');
      }
    }
    // An adapter that failed to register (stale cache, JS error) would silently
    // drop the whole model and still pass Tier A. Cross-check declaration vs fact.
    if (mf && mf.adapter > 0 && !snap.hasModel) {
      row.notes.push('declares an adapter but the snapshot carries no model — registerAdapter did not run');
      throw new Error('adapter');
    }

    // Inertness
    const stripped = snap.html.replace(/<script type="application\/json"[^>]*>[\s\S]*?<\/script>/i, '');
    const inert = {
      state: snap.html.includes('id="are-state"'),
      noScript: !/<script/i.test(stripped),
      noLink: !/<link[^>]+rel="stylesheet"/i.test(snap.html),
      noOn: !/\son[a-z]+\s*=\s*["']/i.test(snap.html),
      csp: snap.html.includes('Content-Security-Policy'),
    };
    row.inert = inert;
    if (!Object.values(inert).every(Boolean)) {
      row.notes.push('inertness: ' + JSON.stringify(inert));
      throw new Error('inert');
    }

    // Reload into a FRESH page — ordinary non-force path, zero mismatches.
    row.stage = 'reload';
    const page2 = await ctx.newPage();
    await serveStaticJson(page2);
    attachErrors(page2, errs);
    await page2.goto(`${BASE}/Calcs/${file}`, { waitUntil: 'load', timeout: 40000 });
    await page2.waitForSelector('#areBar', { timeout: 15000 });
    await page2.waitForFunction(() => window.AREv2?.isReady?.() !== false, null, { timeout: 25000 });

    const load = await page2.evaluate(async (html) => {
      try {
        const st = window.AREv2.parseSnapshot(html);
        const r = window.AREv2.loadFromState(st);
        if (r.ok) await window.AREv2.runAndSettle();
        return { ok: r.ok, applied: r.applied,
                 missing: r.mismatches.missingOnPage.slice(0, 6),
                 extra: r.mismatches.notInFile.slice(0, 6),
                 missingN: r.mismatches.missingOnPage.length,
                 extraN: r.mismatches.notInFile.length };
      } catch (e) { return { threw: true, code: e.code || '', message: e.message }; }
    }, snap.html);
    row.load = load;
    if (load.threw) { row.notes.push(`load threw [${load.code}] ${load.message}`); throw new Error('load'); }
    if (!load.ok) {
      row.notes.push(`mismatch: ${load.missingN} in-file-not-on-page ${JSON.stringify(load.missing)}, ` +
                     `${load.extraN} on-page-not-in-file ${JSON.stringify(load.extra)}`);
      throw new Error('mismatch');
    }

    const after = await stableCapture(page2);
    if (!after.stable) row.notes.push('WARNING: page never settled after reload');

    if (row.scenario) {
      // Model equality is the real criterion. Sentinels living in input VALUES
      // never appear in innerText, so a text diff would call a perfectly
      // restored row set "missing".
      const modelAfter = await page2.evaluate(() => JSON.stringify(window.AREv2._getAdapterModelForTest()));
      if (row.modelBefore && row.modelBefore !== 'null') {
        if (modelAfter !== row.modelBefore) {
          row.notes.push('post-delete model did not round-trip' +
                         '\n      before: ' + String(row.modelBefore).slice(0, 220) +
                         '\n      after : ' + String(modelAfter).slice(0, 220));
          throw new Error('scenario');
        }
      } else {
        // No adapter — the surviving sentinels must at least appear in the text.
        const missing = row.scenario.sentinels.filter((v) => !after.text.includes(String(v)));
        if (missing.length) {
          row.notes.push(`surviving sentinels missing after reload: ${missing.join(', ')}`);
          throw new Error('scenario');
        }
      }
    }
    // React calcs: the restored adapter model must equal the saved one exactly.
    if (!row.scenario && row.modelBefore) {
      const modelAfter = await page2.evaluate(() => JSON.stringify(window.AREv2._getAdapterModelForTest()));
      if (modelAfter !== row.modelBefore) {
        row.notes.push('adapter model did not round-trip' +
                       '\n      before: ' + String(row.modelBefore).slice(0, 220) +
                       '\n      after : ' + String(modelAfter).slice(0, 220));
        throw new Error('model');
      }
    }

    row.stage = 'diff';
    // Compare with ALL whitespace removed. Rebuilt rows (adapter setModel using
    // innerHTML) carry no inter-tag whitespace, while the page's original
    // hand-written markup does, so innerText differs by spaces alone even when
    // every value, label and status is identical. Values/labels/statuses are
    // still fully compared; only spacing is forgiven.
    const squash = (t) => t.replace(/\s+/g, '');
    if (squash(after.text) !== squash(before.text)) {
      row.notes.push('results text differs ' + firstDiff(before.text, after.text));
      throw new Error('diff');
    }
    if (after.statuses !== before.statuses) { row.notes.push('PASS/FAIL statuses differ'); throw new Error('diff'); }
    if (after.sections !== before.sections) { row.notes.push('section set differs'); throw new Error('diff'); }

    // Offline: the saved file must render with no network access whatsoever.
    if (!SKIP_OFFLINE) {
      row.stage = 'offline';
      const p = path.join(TMP, file);
      writeFileSync(p, snap.html, 'utf8');
      const octx = await browser.newContext();
      const opage = await octx.newPage();
      const requested = [];
      await opage.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith('file://')) return route.continue();
        requested.push(u);
        return route.abort();
      });
      await opage.goto('file://' + p.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 30000 });
      const rendered = await opage.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim().length);

      // PRINT-MODE ASSERTION. The saved record must actually honour its own
      // Summary/Full radios. This is the check whose absence let a broken print
      // system pass 55/55: expandAll()'s inline `!important` was baked into the
      // clone and outranked the snapshot stylesheet, so every Summary rendered
      // as a Full Calc.
      const modes = await opage.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.det-row'));
        if (!rows.length) return { skipped: true };
        const vis = () => rows.filter((r) => getComputedStyle(r).display !== 'none').length;
        const s = document.getElementById('are-mode-s');
        const f = document.getElementById('are-mode-f');
        if (!s || !f) return { missingRadios: true };
        f.checked = true; s.checked = false;
        const full = vis();
        s.checked = true; f.checked = false;
        const summary = vis();
        return { total: rows.length, full, summary };
      });
      row.printModes = modes;
      if (modes.missingRadios) { row.notes.push('snapshot has no print-mode radios'); throw new Error('printmode'); }
      if (!modes.skipped) {
        if (modes.full === 0) { row.notes.push(`Full mode shows 0 of ${modes.total} detail rows`); throw new Error('printmode'); }
        if (modes.summary >= modes.full) {
          row.notes.push(`Summary does not hide detail rows (${modes.summary} visible vs ${modes.full} in Full)`);
          throw new Error('printmode');
        }
      }
      const naked = await opage.evaluate(() => Array.from(document.querySelectorAll('input[type=radio][name=are-mode]'))
        .filter((r) => { const s = getComputedStyle(r); return s.display !== 'none' && s.opacity !== '0' && r.getBoundingClientRect().left > -1000; }).length);
      if (naked) { row.notes.push(`${naked} print-mode radio(s) visible in the record`); throw new Error('printmode'); }
      await octx.close();
      row.offlineRequests = requested.length;
      row.offlineChars = rendered;
      if (requested.length) { row.notes.push(`offline made ${requested.length} request(s): ${requested.slice(0, 3).join(', ')}`); throw new Error('offline'); }
      if (rendered < 200) { row.notes.push(`offline rendered only ${rendered} chars`); throw new Error('offline'); }
    }

    const known = PREEXISTING[file] || [];
    const preexisting = errs.filter((e) => known.some((re) => re.test(e)));
    const real = errs.filter((e) => !known.some((re) => re.test(e)));
    row.preexisting = preexisting.length;
    if (real.length) { row.stage = 'errors'; row.notes.push('errors: ' + real.slice(0, 2).join(' | ')); throw new Error('errors'); }
    row.ok = true;
    row.stage = 'done';
  } catch (e) {
    if (!row.notes.length) row.notes.push(e.message);
  }

  await ctx.close();
  results.push(row);
  const mark = row.ok ? (row.preexisting ? 'ok* ' : 'ok  ') : 'FAIL';
  console.log(`${mark} ${row.file.padEnd(52)} ${String(row.fields ?? '-').padStart(4)} fields  ` +
              `${String(row.kb ?? '-').padStart(4)} KB  ${row.ok ? '' : '[' + row.stage + '] ' + row.notes[0]}`);
}

await browser.close();

const pass = results.filter((r) => r.ok).length;
const byStage = {};
for (const r of results) if (!r.ok) (byStage[r.stage] ||= []).push(r);

let md = `# ARE calc save/load QA report\n\n`;
md += `Run: ${new Date().toISOString()}\n\n`;
md += `**${pass}/${results.length} passed.**\n\n`;
md += `| Calc | Fields | KB | Model | Offline reqs | Result |\n|---|---|---|---|---|---|\n`;
for (const r of results) {
  md += `| ${r.file} | ${r.fields ?? '-'} | ${r.kb ?? '-'} | ${r.hasModel ? 'yes' : '-'} | ${r.offlineRequests ?? '-'} | ` +
        `${r.ok ? 'pass' : '**FAIL** (' + r.stage + ') ' + r.notes[0].replace(/\|/g, '\\|').slice(0, 220)} |\n`;
}
if (Object.keys(byStage).length) {
  md += `\n## Failures by stage\n\n`;
  for (const [stage, rows] of Object.entries(byStage)) {
    md += `### ${stage} (${rows.length})\n\n`;
    for (const r of rows) md += `- **${r.file}** — ${r.notes.join('; ')}\n`;
    md += '\n';
  }
}
writeFileSync(fileURLToPath(new URL('./qa-report.md', import.meta.url)), md, 'utf8');

console.log(`\n${pass}/${results.length} passed — tools/qa-report.md written`);
for (const [stage, rows] of Object.entries(byStage)) {
  console.log(`  ${stage}: ${rows.map((r) => r.file.replace('_calculator.html', '')).join(', ')}`);
}
process.exit(pass === results.length ? 0 : 1);
