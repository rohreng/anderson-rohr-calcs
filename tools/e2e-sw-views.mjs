// =============================================================================
// Stacked shearwall views — end-to-end on the real 26-038 Red Bluff file
// -----------------------------------------------------------------------------
// docs/plans/2026-09-30-shearwall-views-plan.md Phase 4. Headless Chromium,
// every request fulfilled from public/ on disk. Loads Nick's saved Stacked
// Shearwall file (tools/_out/e2e/, X direction, 3 levels × 25 walls, saved
// before the views existed — no `plan`, no start_ft) through the toolbar Load,
// then:
//   - the model and X@15's base numbers are as saved (V 7,459.8 lb ASD,
//     Vstrength 12,433 lb) and every drawn label equals the engine;
//   - the plan places all 25 walls (imported dir / loc_ft, centred along the
//     line) with the level Σ in the header;
//   - B × D 120 × 360 and start_ft 0 on X@15 typed into the plan panel's
//     position editor: X@15 is drawn 0–20 ft along the building on every
//     level, the building rectangle is drawn, and no result moves;
//   - the position and B × D survive the adapter's getModel -> setModel;
//   - print: every level's plan + the selected elevation, 17 × 11 PDF, page
//     count reported; screenshots at desktop and phone width.
// Writes tools/_out/sw-views-*.png and tools/_out/sw-views-redbluff.pdf.
// Usage: node tools/e2e-sw-views.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('./_out/', import.meta.url));
const RB_FILE = OUT_DIR + 'e2e/26-038-HNR - Red Bluff Hotel - Stacked Shearwall Designer - 2026-09-16.html';
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'stacked_shearwall_calculator.html';
mkdirSync(OUT_DIR, { recursive: true });

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}
if (!existsSync(RB_FILE)) { console.error('Missing ' + RB_FILE); process.exit(1); }

const browser = await chromium.launch({ headless: true });
async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = []; page.dialogs = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss(); });
  await page.route('**/*', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\//, '');
    try {
      route.fulfill({ status: 200, contentType: MIME[p.split('.').pop()] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
    } catch { route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.AREv2 && window.AREv2.isReady(), null, { timeout: 15000 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#areLoadBtn')]);
  await fc.setFiles(RB_FILE);
  await page.waitForFunction(() => window.state.floors.length === 3 && document.querySelector('#swvPlanSvg svg'), null, { timeout: 15000 });
  return page;
}
// Every numeric label's data-v against the engine path in data-k (as test-sw-views.mjs).
const LABELS_FN = `(sel) => {
  const res = window._vres, plan = window._vplan, st = window.state;
  const bad = [], all = [...document.querySelectorAll(sel + ' [data-v]')];
  all.forEach((t) => {
    let k = t.getAttribute('data-k'), o = res;
    if (k.startsWith('plan:')) { o = plan; k = k.slice(5); } else if (k.startsWith('state:')) { o = st; k = k.slice(6); }
    for (const part of k.split('.')) { if (o == null) break; o = o[/^[0-9]+$/.test(part) ? Number(part) : part]; }
    if (!(typeof o === 'number' && Math.abs(o - Number(t.getAttribute('data-v'))) <= 0.05)) bad.push(t.getAttribute('data-q') + ' ' + t.getAttribute('data-k') + ' ' + t.getAttribute('data-v') + ' vs ' + o);
  });
  return { n: all.length, bad };
}`;

const page = await open({ width: 1600, height: 1000 });

// ── the file as saved ────────────────────────────────────────────────────────
const m0 = await page.evaluate(() => {
  const s = window.state, r = window.SW.compute(s), base = s.floors.length - 1;
  const bi = s.floors[base].walls.findIndex((w) => w.id === 'X@15');
  const rb = r.floors[base].walls[bi];
  return {
    levels: s.floors.map((f) => f.name + ':' + f.walls.length), plan: s.plan === undefined ? 'undefined' : s.plan,
    dir: s.lateral && s.lateral.dir, located: s.floors.every((f) => f.walls.every((w) => (w.dir === 'X' || w.dir === 'Y') && typeof w.loc_ft === 'number')),
    V: rb.cases.wind.V, Vs: rb.cases.wind.Vstrength, L: rb.L_ft, errors: r.errors.length, bi,
    stacks: r.stackIds.length, views: !!document.querySelector('#swViews') && !document.querySelector('#floor-con #swViews')
  };
});
console.log('  loaded: ' + JSON.stringify(m0));
check('Red Bluff file loads: 3 levels × 25 walls, direction X, no model errors, walls carry dir / loc_ft, no plan key yet',
  m0.levels.join(',') === 'Roof:25,3RD:25,2ND:25' && m0.dir === 'X' && m0.errors === 0 && m0.located && (m0.plan === null || m0.plan === 'undefined'), JSON.stringify(m0));
check('X@15 base: V = 7,459.8 lb (0.6W), Vstrength = 12,433 lb', Math.abs(m0.V - 7459.8) < 0.05 && Math.abs(m0.Vs - 12433) < 0.5, JSON.stringify(m0));
check('views block present, outside #floor-con, 25 walls in the wall selector', m0.views && m0.stacks === 25 && await page.evaluate(() => document.querySelectorAll('#swvWall option').length) === 25, JSON.stringify(m0));

// ── elevation of X@15 ────────────────────────────────────────────────────────
await page.selectOption('#swvWall', 'X@15');
const el = await page.evaluate(() => {
  const svg = document.querySelector('#swvElevSvg svg');
  const base = [...svg.querySelectorAll('g.sw-level')].find((g) => g.getAttribute('data-fi') === '2');
  const q = (g, name) => { const t = g && g.querySelector('[data-q="' + name + '"]'); return t ? Number(t.getAttribute('data-v')) : null; };
  return { title: svg.getAttribute('aria-label'), levels: svg.querySelectorAll('g.sw-level').length, V: q(base, 'V'), L: q(base, 'L'), T: q(base, 'T'), C: q(base, 'C'), stored: localStorage.getItem('areCalcs_sw_views') };
});
const elLbl = await page.evaluate(`(${LABELS_FN})('#swvElevSvg')`);
check('elevation of X@15: 3 story boxes, base V label 7,459.8 lb, L 20 ft', el.levels === 3 && Math.abs(el.V - 7459.8) < 0.05 && el.L === 20, JSON.stringify(el));
check(`elevation: all ${elLbl.n} labels = engine (±0.05)`, elLbl.n > 20 && elLbl.bad.length === 0, elLbl.bad.slice(0, 5).join(' | '));
check('selected wall remembered per browser (localStorage), not in the model', /"wall":"X@15"/.test(el.stored || '') && await page.evaluate(() => !('view' in window.__SW_ADAPTER.getModel())), el.stored);

// ── plan before positions: 25 walls centred on their lines ───────────────────
const p0 = await page.evaluate(() => {
  const svg = document.querySelector('#swvPlanSvg svg');
  return { walls: svg.querySelectorAll('g.sw-pw').length, centred: svg.querySelectorAll('g.sw-centred').length, strip: svg.querySelectorAll('g.sw-strip').length,
    sumV: Number(svg.querySelector('[data-q="sumV"]').getAttribute('data-v')), Vlevel: Number(svg.querySelector('[data-q="Vlevel"]').getAttribute('data-v')), bldg: !!svg.querySelector('.sw-bldg'),
    sel: [...svg.querySelectorAll('.swv-sel')].map((g) => g.getAttribute('data-wall')) };
});
const p0Lbl = await page.evaluate(`(${LABELS_FN})('#swvPlanSvg')`);
check('plan (base): 25 located walls, all centred (no start_ft), no strip, no building yet; X@15 highlighted', p0.walls === 25 && p0.centred === 25 && p0.strip === 0 && !p0.bldg && p0.sel.join() === 'X@15', JSON.stringify(p0));
check('plan (base): Σ wall V vs level V in the header (0.6 × 298,400 lb)', Math.abs(p0.Vlevel - 0.6 * (131310 + 79780 + 87310)) < 0.5 && isFinite(p0.sumV), JSON.stringify(p0));
check(`plan: all ${p0Lbl.n} labels = engine (±0.05)`, p0Lbl.n > 50 && p0Lbl.bad.length === 0, p0Lbl.bad.slice(0, 5).join(' | '));

// Set + fire change in one page task: drawViews() rebuilds #swvPos on change/resize, so a
// separate fill and dispatch can hit a detached input.
const setPos = (sel, val) => page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, val]);
// ── B × D 120 × 360 and start_ft 0 on X@15, typed into the position editor ───
const before = await page.evaluate(() => JSON.stringify(window.SW.compute(window.state).floors.map((f) => f.walls.map((w) => [w.cases.wind.V, w.cases.wind.vmax, w.cases.wind.Tgov]))));
await setPos('#swvPos input[data-plan="B_ft"]', '120');
await setPos('#swvPos input[data-plan="D_ft"]', '360');
await setPos('#swvPos input[data-pos="start_ft"]', '0');
const p1 = await page.evaluate(() => {
  const s = window.state, pm = window.SW.planModel(s, window.SW.compute(s));
  const x15 = pm.levels.map((lv) => lv.walls.filter((w) => w.id === 'X@15').map((w) => [w.placed, w.x0, w.x1, w.y0])[0]);
  const svg = document.querySelector('#swvPlanSvg svg'), b = svg.querySelector('.sw-bldg');
  const g = svg.querySelector('g[data-wall="X@15"] .sw-wline');
  const bx = +b.getAttribute('x'), bw = +b.getAttribute('width');
  return { plan: s.plan, starts: s.floors.map((f) => f.walls.filter((w) => w.id === 'X@15').map((w) => w.start_ft)[0]), x15,
    others: s.floors.every((f) => f.walls.every((w) => w.id === 'X@15' || !('start_ft' in w))),
    bar: { x1: (+g.getAttribute('x1') - bx) / bw * 120, x2: (+g.getAttribute('x2') - bx) / bw * 120 }, exact: svg.querySelectorAll('g.sw-pw:not(.sw-centred)').length,
    B: Number(svg.querySelector('[data-q="B"]').getAttribute('data-v')), D: Number(svg.querySelector('[data-q="D"]').getAttribute('data-v')),
    editor: [...document.querySelectorAll('#swvPos input')].map((i) => i.getAttribute('data-pos') || i.getAttribute('data-plan')).join(',') + '=' + [...document.querySelectorAll('#swvPos input')].map((i) => i.value).join(',') };
});
console.log('  after edit: ' + JSON.stringify(p1));
check('editor: state.plan = {B_ft 120, D_ft 360}; start_ft 0 on X@15 at every level, no other wall touched', JSON.stringify(p1.plan) === '{"B_ft":120,"D_ft":360}' && p1.starts.every((v) => v === 0) && p1.others, JSON.stringify(p1));
check('planModel: X@15 exact at x 0–20 ft, y 15 ft on every level', p1.x15.every((w) => w && w[0] === 'exact' && w[1] === 0 && w[2] === 20 && w[3] === 15), JSON.stringify(p1.x15));
check('plan SVG: building 120 × 360 drawn and labelled; X@15 bar spans 0–20 ft of it; one wall exact, 24 centred', Math.abs(p1.bar.x1) < 0.05 && Math.abs(p1.bar.x2 - 20) < 0.05 && p1.B === 120 && p1.D === 360 && p1.exact === 1, JSON.stringify(p1));
check('editor shows the values back', /loc_ft,start_ft,B_ft,D_ft=15,0,120,360/.test(p1.editor), p1.editor);
const after = await page.evaluate(() => JSON.stringify(window.SW.compute(window.state).floors.map((f) => f.walls.map((w) => [w.cases.wind.V, w.cases.wind.vmax, w.cases.wind.Tgov]))));
check('no result moves with the position / building edits (V, v_max, T on all 75 walls)', before === after, 'results changed');

// ── adapter round trip of the new keys ──────────────────────────────────────
const rt = await page.evaluate(() => {
  const a = window.__SW_ADAPTER, m = JSON.parse(JSON.stringify(a.getModel()));
  a.setModel(JSON.parse(JSON.stringify(m)));
  const s = window.state;
  return { plan: a.getModel().plan, start: s.floors.map((f) => f.walls.find((w) => w.id === 'X@15').start_ft), viaAre: window.AREv2._getAdapterModelForTest().plan,
    V: window.SW.compute(s).floors[2].walls.find((w) => w.id === 'X@15').cases.wind.V };
});
check('getModel -> setModel keeps plan {120, 360} and start_ft 0; X@15 base V still 7,459.8 lb', JSON.stringify(rt.plan) === '{"B_ft":120,"D_ft":360}' && JSON.stringify(rt.viaAre) === JSON.stringify(rt.plan) && rt.start.every((v) => v === 0) && Math.abs(rt.V - 7459.8) < 0.05, JSON.stringify(rt));

// ── plan click on another wall ───────────────────────────────────────────────
const tgt = await page.evaluate(() => { const g = document.querySelectorAll('#swvPlanSvg g.sw-pw')[3]; return { id: g.getAttribute('data-wall'), fi: g.getAttribute('data-fi'), wi: g.getAttribute('data-wi') }; });
// A dense plan: the line's centre can sit under a neighbour's label, so the
// click is dispatched on the line itself (a real mouse click is in test-stacked-shearwall.mjs).
await page.locator('#swvPlanSvg g.sw-pw[data-wall="' + tgt.id + '"] .sw-wline').dispatchEvent('click');
// The theme scrolls smoothly (html{scroll-behavior:smooth}): wait for the row to arrive.
await page.waitForFunction((t) => { const r = document.getElementById('wres_' + t.fi + '_' + t.wi).getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, tgt, { timeout: 8000 }).catch(() => {});
const clk = await page.evaluate((t) => {
  const row = document.getElementById('wres_' + t.fi + '_' + t.wi).getBoundingClientRect();
  return { wall: document.getElementById('swvWall').value, title: document.querySelector('#swvElevSvg svg').getAttribute('aria-label'), rowTop: Math.round(row.top), rowBottom: Math.round(row.bottom), vh: innerHeight, scrollY: Math.round(scrollY) };
}, tgt);
check('plan click on ' + tgt.id + ': wall selector + elevation follow, its results row scrolled into view', clk.wall === tgt.id && clk.title.indexOf(tgt.id) >= 0 && clk.rowTop < clk.vh && clk.rowBottom > 0 && clk.scrollY > 0, JSON.stringify(clk));
await page.selectOption('#swvWall', 'X@15');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

// ── screenshots (desktop) ────────────────────────────────────────────────────
await page.locator('#swViews').screenshot({ path: OUT_DIR + 'sw-views-redbluff-1600.png' });
await page.click('#swViews [data-mode="plan"]');
await page.selectOption('#swvLevel', '0');
await page.locator('#swViews').screenshot({ path: OUT_DIR + 'sw-views-redbluff-plan-roof-1600.png' });
await page.click('#swViews [data-mode="both"]');
await page.selectOption('#swvLevel', '2');
const scr = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check('@1600: no page-level horizontal scroll', scr.sw <= scr.cw, JSON.stringify(scr));

// ── print ───────────────────────────────────────────────────────────────────
await page.emulateMedia({ media: 'print' });
const pr = await page.evaluate(() => {
  const vis = (e) => !!e && getComputedStyle(e).display !== 'none';
  const svgs = [...document.querySelectorAll('#swViews svg.sw-view')].filter((s) => s.getBoundingClientRect().height > 0);
  return { plans: document.querySelectorAll('#swvPrintPlans svg.sw-plan').length, plansShown: vis(document.getElementById('swvPrintPlans')), elev: vis(document.getElementById('swvElev')),
    bar: vis(document.getElementById('swvBar')), pos: vis(document.getElementById('swvPos')), live: vis(document.getElementById('swvPlan')),
    maxH: Math.max(...svgs.map((s) => s.getBoundingClientRect().height)) };
});
check('print: 3 level plans + X@15 elevation shown; controls, editor and the live plan hidden; every drawing ≤ 9.2 in tall', pr.plans === 3 && pr.plansShown && pr.elev && !pr.bar && !pr.pos && !pr.live && pr.maxH <= 9.2 * 96 + 1, JSON.stringify(pr));
await page.emulateMedia({ media: null });
const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
writeFileSync(OUT_DIR + 'sw-views-redbluff.pdf', pdf);
const txt = pdf.toString('latin1');
const boxes = [...txt.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((mm) => mm.slice(1).map(Number));
const pages = (txt.match(/\/Type\s*\/Page(?!s)/g) || []).length;
console.log(`  PDF: ${pages} page(s) -> tools/_out/sw-views-redbluff.pdf`);
check('PDF 17 × 11 (MediaBox 1224 × 792) on every page', boxes.length > 0 && boxes.every((b) => Math.round(b[2]) === 1224 && Math.round(b[3]) === 792), JSON.stringify(boxes.slice(0, 2)));
check('PDF has pages', pages >= 3, 'pages=' + pages);
check('no page errors, no dialogs (desktop)', page.errors.length === 0 && page.dialogs.length === 0, page.errors.concat(page.dialogs).join('\n      '));
await page.context().close();

// ── phone width ─────────────────────────────────────────────────────────────
const ph = await open({ width: 400, height: 900 });
const phm = await ph.evaluate(() => {
  const host = document.getElementById('swViews').getBoundingClientRect();
  const sw1 = document.documentElement.scrollWidth;
  document.getElementById('swViews').style.display = 'none';
  const sw0 = document.documentElement.scrollWidth;
  document.getElementById('swViews').style.display = '';
  return { right: host.right, cw: document.documentElement.clientWidth, sw1, sw0 };
});
check('@400: the views block fits the viewport and adds no page-level horizontal scroll', phm.right <= phm.cw && phm.sw1 === phm.sw0, JSON.stringify(phm));
await ph.locator('#swViews').screenshot({ path: OUT_DIR + 'sw-views-redbluff-400.png' });
check('no page errors, no dialogs (phone)', ph.errors.length === 0 && ph.dialogs.length === 0, ph.errors.concat(ph.dialogs).join('\n      '));
await ph.context().close();
console.log('  screenshots -> tools/_out/sw-views-redbluff-1600.png, sw-views-redbluff-plan-roof-1600.png, sw-views-redbluff-400.png');

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
