// =============================================================================
// Stacked shearwall — screen fit + print / PDF test (WP-2, 2026-09-22 plan)
// -----------------------------------------------------------------------------
// Headless Chromium, every request fulfilled from public/ on disk (so
// /are-utils-v2.js and /are-theme-v2.css load exactly as on the site — the
// theme's !important input rules are what clipped the cells, so a test without
// them proves nothing).
//   Screen (2048 px viewport, wide mode, 100 % zoom): no page-level horizontal
//   scroll, every wall table fits its scroller, "10.5" fits the level h box,
//   "(2)" fits the ply select, a column drag moves only that column, the first
//   column and the results panes stay pinned when the table scrolls, the D/C
//   bar carries its 1.0 tick and legend.
//   Print: the toolbar's injected @page is suppressed on this page only, the
//   page's tabloid-landscape @page wins, the wall table fits the printable
//   width under print media, and page.pdf({preferCSSPageSize}) is 17 × 11 in
//   (MediaBox 1224 × 792 pt). Writes tools/_out/sw-print.pdf and, when
//   pdftoppm is on PATH, tools/_out/sw-print-p1.png.
// Usage: node tools/test-sw-print.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('./_out/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'stacked_shearwall_calculator.html';
// Tabloid landscape less the page's .45 in side margins: 16.1 in × 96 px/in.
const PRINT_W = Math.floor((17 - 2 * 0.45) * 96);
mkdirSync(OUT_DIR, { recursive: true });

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

const browser = await chromium.launch({ headless: true });
async function open(file, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.route('**/*', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      const ext = p.split('.').pop();
      route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
    } catch { route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('http://calcs.test/Calcs/' + file, { waitUntil: 'load' });
  await page.waitForSelector('#areBar');
  return page;
}

// Text-fit probe: does the control's current text fit inside its content box?
// Selects also lose the drop-down arrow (Chromium menulist ≈ 16 px incl. its gap).
const FIT_FN = `(el, arrow) => {
  const cs = getComputedStyle(el);
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  const txt = el.tagName === 'SELECT' ? el.options[el.selectedIndex].text : el.value;
  const need = cv.measureText(txt).width;
  const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (el.tagName === 'SELECT' ? arrow : 0);
  return { txt, need: +need.toFixed(1), avail: +avail.toFixed(1), fits: need <= avail, font: cs.fontSize, pad: cs.paddingLeft + ' ' + cs.paddingRight, w: el.clientWidth };
}`;

// ── Screen at 2048 × 1100 (2560 × 1440 at 125 %), and at 2031 (the same window
// less a 17 px classic scrollbar — headless Chromium draws none) ──────────────
for (const vw of [2048, 2031]) {
  const page = await open(FILE, { width: vw, height: 1100 });
  await page.waitForSelector('#wres_0_0 .inline-res');
  const m = await page.evaluate(() => {
    const scs = [...document.querySelectorAll('#floor-con .tbl-scroll')];
    return {
      wide: document.body.classList.contains('are-wide'),
      docScroll: document.documentElement.scrollWidth, docClient: document.documentElement.clientWidth,
      tables: scs.map((s) => ({ scroll: s.scrollWidth, client: s.clientWidth, table: Math.round(s.querySelector('.wall-table').getBoundingClientRect().width) })),
      cols: document.querySelector('#floor-con .wall-table thead').querySelectorAll('th').length
    };
  });
  const t0 = m.tables[0];
  console.log(`  @${vw}: page scrollWidth ${m.docScroll} / clientWidth ${m.docClient}; wall table ${t0.table} px in a ${t0.client} px scroller (scrollWidth ${t0.scroll}); ${m.cols} columns`);
  check(`@${vw}: wide mode on by default`, m.wide === true, JSON.stringify(m));
  check(`@${vw}: no page-level horizontal scroll`, m.docScroll <= m.docClient, JSON.stringify(m));
  check(`@${vw}: every wall table fits its scroller (all columns visible, no inner scroll)`, m.tables.every((t) => t.scroll <= t.client), JSON.stringify(m.tables));

  if (vw !== 2048) { await page.context().close(); continue; }

  // S5 / S8 — "10.5" in the level h box, "(2)" in the ply select
  const fit = await page.evaluate(`(() => {
    const fit = ${FIT_FN};
    window.state.floors[0].h_ft = 10.5; window.state.floors[0].walls[0].endPost.n = 2; window.render();
    const hdr = document.querySelector('#floor-con .floor-blk .floor-hdr input.ti[type=number]');
    const ply = document.querySelector('#floor-con .wall-table tbody tr td:nth-child(13) select');
    return { h: fit(hdr, 0), ply: fit(ply, 16) };
  })()`);
  check('"10.5" fully visible in the level h box', fit.h.txt === '10.5' && fit.h.fits, JSON.stringify(fit.h));
  check('"(2)" fully visible in the end-post ply select', fit.ply.txt === '(2)' && fit.ply.fits, JSON.stringify(fit.ply));
  await page.screenshot({ path: OUT_DIR + 'sw-screen-2048.png', clip: { x: 0, y: 0, width: 2048, height: 1100 } });
  const hdrBox = await page.locator('#floor-con .floor-blk').first().boundingBox();
  await page.screenshot({ path: OUT_DIR + 'sw-screen-2048-level1.png', clip: { x: hdrBox.x, y: hdrBox.y, width: hdrBox.width, height: Math.min(hdrBox.height, 260) } });

  // S2 — dragging one grip moves only that column
  const before = await page.evaluate(() => [...document.querySelector('#floor-con .wall-table thead tr').children].map((th) => th.getBoundingClientRect().width));
  const tblBefore = await page.evaluate(() => document.querySelector('#floor-con .wall-table').getBoundingClientRect().width);
  const grip = await page.locator('#floor-con .wall-table thead th[data-ck="l_ft"] .col-grip').first().boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 20, grip.y + grip.height / 2, { steps: 4 });
  await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = await page.evaluate(() => [...document.querySelector('#floor-con .wall-table thead tr').children].map((th) => th.getBoundingClientRect().width));
  const tblAfter = await page.evaluate(() => document.querySelector('#floor-con .wall-table').getBoundingClientRect().width);
  const moved = after.map((w, i) => Math.round(w - before[i]));
  const others = moved.filter((d, i) => i !== 2);
  check('drag L (ft) grip +40 px: that column +40, every other column unchanged, table +40',
    Math.abs(moved[2] - 40) <= 1 && others.every((d) => d === 0) && Math.abs(tblAfter - tblBefore - 40) <= 1, JSON.stringify({ moved, tblBefore, tblAfter }));
  const stored = await page.evaluate(() => ({ v2: localStorage.getItem('areCalcs_sw_colWidths_v2'), v1: localStorage.getItem('areCalcs_sw_colWidths') }));
  check('widths persist under the bumped key areCalcs_sw_colWidths_v2', /"l_ft":\d+/.test(stored.v2 || '') && stored.v1 === null, JSON.stringify(stored));
  await page.evaluate(() => window.resetColW());

  // S3 — capacity bar: 1.0 tick at 2/3, tooltip, header legend
  const bar = await page.evaluate(() => {
    const cell = document.querySelector('#wres_0_0 .dc-cell');
    const tick = cell && cell.querySelector('.dc-tick');
    const bar = cell && cell.querySelector('.dc-bar');
    const hdr = [...document.querySelectorAll('#wres_0_0 .chk-tbl th')].map((t) => t.textContent).join('|');
    return { tick: !!tick, pos: tick && bar ? (tick.getBoundingClientRect().left + 1 - bar.getBoundingClientRect().left) / bar.getBoundingClientRect().width : null,
             title: cell && cell.getAttribute('title'), hdr };
  });
  check('D/C bar: 1.0 tick at 66.7 % of the bar, tooltip names the 0–1.5 scale, header legend',
    bar.tick && Math.abs(bar.pos - 2 / 3) < 0.02 && /0 to 1\.5/.test(bar.title || '') && /tick marks D\/C = 1\.0/.test(bar.title || '') && /D\/C \(bar 0–1\.5 · \| = 1\.0\)/.test(bar.hdr), JSON.stringify(bar));
  check('no page errors @2048', page.errors.length === 0, page.errors.join('\n      '));
  await page.context().close();
}

// ── Sticky first column + pinned results panes when the table does scroll ────
{
  const page = await open(FILE, { width: 1400, height: 900 });
  await page.waitForSelector('#wres_0_0 .inline-res');
  const st = await page.evaluate(async () => {
    const sc = document.querySelector('#floor-con .tbl-scroll');
    sc.scrollLeft = 300;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const L = sc.getBoundingClientRect().left + sc.clientLeft;
    const th = sc.querySelector('thead th').getBoundingClientRect().left;
    const td = sc.querySelector('tbody tr td').getBoundingClientRect().left;
    const pane = sc.querySelector('.wres').getBoundingClientRect();
    return { scrolled: sc.scrollLeft, L, th, td, paneLeft: pane.left, paneW: Math.round(pane.width), client: sc.clientWidth, docScroll: document.documentElement.scrollWidth, docClient: document.documentElement.clientWidth };
  });
  check('@1400: table scrolls inside its wrapper, not the page', st.scrolled === 300 && st.docScroll <= st.docClient, JSON.stringify(st));
  check('@1400 scrolled 300 px: wall-label column stays pinned at the left edge', Math.abs(st.th - st.L) <= 1 && Math.abs(st.td - st.L) <= 1, JSON.stringify(st));
  check('@1400 scrolled 300 px: results pane pinned at the left edge, scroller-wide', Math.abs(st.paneLeft - st.L) <= 1 && Math.abs(st.paneW - st.client) <= 1, JSON.stringify(st));
  await page.context().close();
}

// ── The @page gate is attribute-scoped: another calc keeps letter portrait ───
{
  const page = await open('stacked_headers_studs_calculator.html', { width: 1400, height: 900 });
  const css = await page.evaluate(() => document.getElementById('are-print-v2').textContent);
  check('other calcs unchanged: #are-print-v2 still carries @page letter portrait (stacked headers/studs)', /@page\{margin:\.75in;size:letter portrait\}\}/.test(css), css.slice(-160));
  await page.context().close();
}

// ── Print ────────────────────────────────────────────────────────────────────
{
  const page = await open(FILE, { width: PRINT_W, height: 1000 });
  await page.waitForSelector('#wres_0_0 .inline-res');
  const inj = await page.evaluate(() => document.getElementById('are-print-v2').textContent);
  check('this calc: no @page in the injected #are-print-v2 (data-are-print-page)', inj.indexOf('@page') < 0 && /@media print\{/.test(inj), inj.slice(-160));
  const pageRule = await page.evaluate(() => {
    // Last @page in document order wins; report every one with its sheet.
    const out = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      const walk = (list) => { for (const r of list) { if (r.type === 6) out.push((sh.ownerNode && (sh.ownerNode.id || sh.ownerNode.getAttribute('href'))) + ' ' + r.cssText); else if (r.cssRules) walk(r.cssRules); } };
      walk(rules);
    }
    return out;
  });
  console.log('  @page rules in cascade order:\n    ' + pageRule.join('\n    '));
  check('the last @page in the cascade is this page\'s tabloid landscape', /size: 17in 11in/.test(pageRule[pageRule.length - 1] || ''), pageRule.join(' || '));

  await page.emulateMedia({ media: 'print' });
  const pm = await page.evaluate(() => {
    const tbls = [...document.querySelectorAll('#floor-con .wall-table')];
    const t0 = tbls[0];
    const vis = (el) => el && getComputedStyle(el).display !== 'none';
    const pv = [...t0.querySelectorAll('tbody tr:first-child .pv')].map((s) => s.textContent);
    return {
      docScroll: document.documentElement.scrollWidth, docClient: document.documentElement.clientWidth,
      widths: tbls.map((t) => Math.round(t.getBoundingClientRect().right)),
      scrolls: [...document.querySelectorAll('#floor-con .tbl-scroll')].map((s) => s.scrollWidth - s.clientWidth),
      actHidden: !vis(t0.querySelector('th.col-act')) && !vis(t0.querySelector('td.col-act')),
      ctlHidden: !vis(t0.querySelector('.ti')),
      pvShown: vis(t0.querySelector('.pv')), pv,
      font: getComputedStyle(t0).fontSize,
      chk: getComputedStyle(document.querySelector('.chk-tbl')).display,
      det: getComputedStyle(document.querySelector('.calc-det')).display,
      pane: getComputedStyle(document.querySelector('.wres')).position
    };
  });
  console.log(`  print media @${PRINT_W}px: page scrollWidth ${pm.docScroll}, wall-table right edges ${pm.widths.join('/')}, table font ${pm.font}`);
  check(`print: wall tables fit the ${PRINT_W} px printable width (no clipping, no scroller)`, pm.docScroll <= PRINT_W && pm.widths.every((r) => r <= PRINT_W) && pm.scrolls.every((d) => d <= 0), JSON.stringify(pm));
  check('print: Actions column hidden, controls replaced by their values', pm.actHidden && pm.ctlHidden && pm.pvShown && pm.pv.length >= 15 && pm.pv.some((t) => /WSP|OSB|Plywood|sheath/i.test(t)), JSON.stringify(pm.pv));
  check('print: results static, check tables and calc details shown', pm.pane === 'static' && pm.chk === 'table' && pm.det === 'block', JSON.stringify(pm));
  await page.screenshot({ path: OUT_DIR + 'sw-print-media.png', fullPage: false });
  // page.pdf() renders with whatever media is emulated — reset to the default
  // (print) rather than 'screen', or the PDF would be a screen capture.
  await page.emulateMedia({ media: null });

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(OUT_DIR + 'sw-print.pdf', pdf);
  const txt = pdf.toString('latin1');
  const boxes = [...txt.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => m.slice(1).map(Number));
  const pages = (txt.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  console.log(`  PDF: ${pages} page(s), MediaBox ${JSON.stringify(boxes[0])} -> tools/_out/sw-print.pdf`);
  check('PDF MediaBox [0 0 1224 792] (17 × 11 in) on every page', boxes.length > 0 && boxes.every((b) => b[0] === 0 && b[1] === 0 && Math.round(b[2]) === 1224 && Math.round(b[3]) === 792), JSON.stringify(boxes.slice(0, 3)));
  check('PDF has pages', pages >= 1, 'pages=' + pages);
  check('no page errors (print)', page.errors.length === 0, page.errors.join('\n      '));
  await page.context().close();

  const tp = spawnSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '2', OUT_DIR + 'sw-print.pdf', OUT_DIR + 'sw-print-p'], { encoding: 'utf8' });
  if (tp.status === 0) console.log('  page images -> tools/_out/sw-print-p-1.png, sw-print-p-2.png');
  else console.log('  (pdftoppm not available — PDF page images skipped)');
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
