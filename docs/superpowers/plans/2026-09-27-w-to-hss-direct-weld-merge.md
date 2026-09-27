# W-Beam Directly Welded to HSS Column — merge implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three overlapping DG24 Example 4.3 calculators with one calculator that runs every applicable AISC 360-22 / DG24 limit state for a W-beam directly welded to a rectangular HSS column, including flanges wider than the workable flat or wider than the HSS.

**Architecture:** One vanilla-JS page `public/Calcs/W_beam_to_HSS_column_calculator.html` rewritten in the pattern of `flange_plated_HSS_column_moment_connection_calculator.html`: DOM-free engine `window.DWHSS` (compute + validate + fixtures), UI layer, Playwright harness `tools/test-w-to-hss.mjs`. `are-draw.js` gets a small update to its existing `renderWToHss`. The two React calcs are deleted and redirected.

**Tech Stack:** Plain HTML/JS (no React), `are-utils-v2.js` toolbar, `are-draw.js` schematic, Playwright harness run with `node`, Next.js registry `app/lib/calcs.ts`.

**Spec:** `docs/superpowers/specs/2026-09-27-w-to-hss-direct-weld-merge-design.md` (read it first; formulas, φ table and fixtures live there).

**Repo facts the implementer must know**
- Repo working tree: `C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs`. Git: `git --git-dir=/tmp/are-git …` (its `core.worktree` is the OneDrive folder). Do **not** use the in-place `.git` (stale branch). Commit locally; **never push**.
- Pre-existing dirty/untracked files to leave alone and never stage: `PLAN-STACKED-WOOD-QAQC-REVIEW-LOG.md`, `.parcelb-evidence.mjs`, `PLAN-CALC-LABEL.md`, `tools/_*.mjs`.
- Pattern file to copy from: `public/Calcs/flange_plated_HSS_column_moment_connection_calculator.html` (CSS block lines 1–225, engine helpers `mk/H/R/I/V/SEP/DC/END`, `W_DB` lines 236–494 and `HSS_DB` lines 495–787 tables, `fillSections/onBeamChange/onColChange/readInputs/run/draw/runSelftest/init` UI functions after line 1210, toolbar script tag `<script src="/are-utils-v2.js" data-no-theme></script>` last).
- Pattern test: `tools/test-flange-plated-hss.mjs` (routes every request to `public/` on disk, runs `runFixtures()`, drives the DOM, checks `?selftest=1` title).
- `W_DB[label] = [A, d, bf, tf, tw, kdes, Zx, Sx]`; `HSS_DB[label] = [A, H, B, t_des, t_nom, b/t, h/t, Sx, Ix]`.
- Windows paths: use forward slashes inside any file content (Tailwind build trap).

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `public/Calcs/W_beam_to_HSS_column_calculator.html` | rewrite | engine + fixtures + UI (single file, FPHSS pattern) |
| `tools/test-w-to-hss.mjs` | create | Playwright: fixtures, UI wiring, modes, selftest |
| `package.json` | modify | `test:wthss` script, add to `qa` chain |
| `public/are-draw.js` | modify `renderWToHss` (≈ lines 1345–1437) | caption/weld label from state, flat + corner + projection in the section view |
| `public/Calcs/directly_welded_HSS_connection_calculator.html` | delete | duplicate |
| `public/Calcs/hss_connection_complete_calculator.html` | delete | duplicate |
| `app/lib/calcs.ts` | modify (entries at ≈ 295–350) | one entry, relabeled; two entries removed |
| `public/are-utils-v2.js` | modify (`HSS_FAMILY`, `CALC_SLUG_MAP`, `injectHSSChooser`) | drop the two slugs, one directly welded branch |
| `next.config.ts` | modify | permanent redirects for the two retired slugs |
| `tools/calc-coverage.csv` | regenerate | `node tools/derive-coverage.mjs --write` |
| `docs/calc-state-spec.md` | modify line 27 | citation text |
| `docs/w-to-hss-direct-weld-hand-check-2026-09.md` | create | hand-check record |
| `RE CODING/Steel/W_beam_to_HSS_column_calculator.html` | copy | Nick's Steel folder copy |

---

### Task 1: Engine, fixtures and harness (no UI yet)

**Files:**
- Rewrite: `public/Calcs/W_beam_to_HSS_column_calculator.html`
- Create: `tools/test-w-to-hss.mjs`
- Modify: `package.json` scripts

- [ ] **Step 1: Create the harness first (it fails until the engine exists)**

Create `tools/test-w-to-hss.mjs`:

```js
// =============================================================================
// W-beam directly welded to HSS column — engine + wiring test
// Runs window.DWHSS.runFixtures() (DG24 Ex 4.3, SEU 2014, STI 2025, handoff
// 6-in cases) in headless Chromium with every request served from public/,
// then drives the DOM and the ?selftest=1 path.  Usage: node tools/test-w-to-hss.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'W_beam_to_HSS_column_calculator.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('dialog', (d) => { pageErrors.push('DIALOG: ' + d.message()); d.dismiss(); });
await page.route('**/*', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^\//, '');
  try {
    const ext = p.split('.').pop();
    route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body: readFileSync(PUBLIC_DIR + p) });
  } catch { route.fulfill({ status: 404, body: '' }); }
});
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');

const failures = [];
function check(label, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      ' + detail));
  if (!ok) failures.push(label);
}

// ── engine fixtures ──────────────────────────────────────────────────────────
const fx = await page.evaluate(() => window.DWHSS.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// UI wiring checks are appended in Task 2 below this line.
// __UI_CHECKS__

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nALL PASS');
```

Add to `package.json` scripts: `"test:wthss": "node tools/test-w-to-hss.mjs",` and append ` && npm run test:wthss` to the end of the `"qa"` script.

- [ ] **Step 2: Run the harness to confirm it fails**

Run: `npm run test:wthss`
Expected: fails (`window.DWHSS` undefined, or `#areBar` timeout because the old page has no toolbar id) — either is the expected red.

- [ ] **Step 3: Write the new page skeleton with the engine**

Replace the whole file `public/Calcs/W_beam_to_HSS_column_calculator.html`. Structure, in order:

1. `<head>`: title `W-Beam Directly Welded to HSS Column`, copy the complete `<style>` block from the FPHSS file (lines 8–225) so classes `blk g3 ig calc-btn results summary sum-pass sum-fail sum-review err-box prop-table chk-table sect-row det-row dem-grid dem-card pass fail na review info dc-bar dc-fill dc-cell note-box review-box mfr mrow calc-det det-btn cref-hdr ceq cval csep cbox` exist.
2. `<body>` with `<div class="container">` header (h1, subtitle "Flange-couple moment transfer — beam flange local yielding, HSS face plastification and punching, sidewall yielding/crippling/buckling, welds", ref tags `AISC 360-22 Ch. J & K`, `DG24 1st ed Ex 4.3`, `DG24 2nd ed Ch. 6`, `STI 2025`), a `<div class="schema-wrap"><svg id="schemSvg" …></svg></div>`, a placeholder `<div class="content" id="uiRoot"></div>` (Task 2 fills it), `<pre id="selftest-result" style="display:none"></pre>`.
3. `<script>` helpers `f1 f2 f3 f4 fr ov`, then `W_DB` and `HSS_DB` copied **verbatim** from the FPHSS file.
4. `<script>` the engine below.
5. `<script src="/are-draw.js"></script>` then `<script src="/are-utils-v2.js" data-no-theme></script>` (Task 2 adds the UI script between them).

Engine (complete; the implementer keeps the same identifiers because Task 2, the fixtures and the tests use them):

```js
/* ============================================================
   DWHSS engine — DOM-free. window.DWHSS.compute(inp) -> result.
   inp: { code:'360-22'|'dg24-1',
          beam:{label,d,bf,tf,tw,Fy,Fu,Zx}, Mu, Vu,
          col:{label,H,B,t,A,S,Fy,Fu,Pu,Mu}, connType:'T'|'X', lend:null|num,
          weld:{type:'cjp'|'fillet', w, faces:1|2, proc:'smaw'|'gmaw', Fexx, kds:bool} }
   ============================================================ */
window.DWHSS = (function(){
  'use strict';
  var E = 29000;
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function minFillet(t){ return t<=0.25?0.125 : t<=0.5?0.1875 : t<=0.75?0.25 : 0.3125; }   // Table J2.4
  function maxFillet(t){ return t<0.25 ? t : t-0.0625; }                                    // J2.2b(b)
  function frac16(w){ var s=w*16; return (Math.abs(s-Math.round(s))<1e-6 ? Math.round(s) : f2(s))+'/16'; }
  function H(t){ return '<div class="cref-hdr">'+t+'</div><div class="cbox">'; }
  function R(h){ return '<div class="mrow">'+h+'</div>'; }
  function I(h){ return '<div class="mrow ind">'+h+'</div>'; }
  function V(x,u){ return '<span class="cval">'+x+(u?' '+u:'')+'</span>'; }
  function SEP(){ return '<hr class="csep">'; }
  function DC(dem,cap,dc){ return SEP()+R('D/C = '+fr(dem,cap)+' = '+V(f3(dc)))+'</div>'; }
  function END(){ return '</div>'; }

  var PHI = {
    '360-22': {LY:0.90, PL:1.00, PS:1.00, SY:1.00, SC:0.75, SB:0.90, W:0.75},
    'dg24-1': {LY:0.95, PL:1.00, PS:0.95, SY:1.00, SC:0.75, SB:0.90, W:0.75}
  };

  // status rules: opts.status forces; else PASS/FAIL from dc; informational rows never enter max D/C
  function mk(section,id,name,ref,demand,capacity,dc,det,opts){
    opts = opts||{};
    var status, note = opts.note||'';
    if (opts.status){ status = opts.status; if (status==='INFO' && dc!==null && isFinite(dc) && dc>1.0 && opts.warnOver) status = 'REVIEW'; }
    else if (dc===null || !isFinite(dc)) status = 'N/A';
    else { status = dc<0 ? 'REVIEW' : (dc<=1.0 ? 'PASS' : 'FAIL'); if (dc<0) note += ' (negative capacity — check inputs)'; }
    return {section:section, id:id, name:name, ref:ref, demand:demand, capacity:capacity,
            dc:(dc===null||!isFinite(dc))?null:dc, status:status, note:note, det:det, informational:!!opts.informational};
  }

  function validate(inp){
    var err=[]; function req(v,l){ if(!isNum(v)||v<=0) err.push(l+' must be a positive number.'); }
    function nonneg(v,l){ if(!isNum(v)||v<0) err.push(l+' must be a number >= 0.'); }
    var b=inp.beam, c=inp.col, w=inp.weld;
    if (!PHI[inp.code]) err.push('Unknown code basis.');
    req(b.d,'Beam d'); req(b.bf,'Beam b_f'); req(b.tf,'Beam t_f'); req(b.tw,'Beam t_w'); req(b.Fy,'Beam F_y'); req(b.Fu,'Beam F_u'); nonneg(b.Zx,'Beam Z_x');
    req(inp.Mu,'M_u'); nonneg(inp.Vu,'V_u');
    req(c.H,'Column H'); req(c.B,'Column B'); req(c.t,'Column t_des'); req(c.A,'Column A'); req(c.S,'Column S'); req(c.Fy,'Column F_y'); req(c.Fu,'Column F_u');
    nonneg(c.Pu,'Column P_u'); nonneg(c.Mu,'Column M_u');
    if (isNum(c.B)&&isNum(c.t)&&c.B<=3*c.t) err.push('Column B must exceed 3t.');
    if (isNum(c.H)&&isNum(c.t)&&c.H<=3*c.t) err.push('Column H must exceed 3t.');
    if (isNum(b.d)&&isNum(b.tf)&&b.d<=b.tf) err.push('Beam d must exceed t_f.');
    if (inp.lend!==null && (!isNum(inp.lend)||inp.lend<0)) err.push('End distance must be blank or a number >= 0.');
    if (inp.connType!=='T' && inp.connType!=='X') err.push('Connection type must be T or X.');
    if (w.type!=='cjp' && w.type!=='fillet') err.push('Weld type must be CJP or fillet.');
    if (w.type==='fillet'){ req(w.w,'Fillet size'); req(w.Fexx,'F_EXX'); if (w.faces!==1&&w.faces!==2) err.push('Weld faces must be 1 or 2.'); }
    return err;
  }

  function effBe(c, Fyb, tf, bfc){ var Bt=c.B/c.t, v=(10/Bt)*(c.Fy*c.t/(Fyb*tf))*bfc; return {Bt:Bt, raw:v, Be:Math.min(v,bfc), capped:v>bfc}; }
  function effBep(c, bfc){ var Bt=c.B/c.t, v=(10/Bt)*bfc; return {Bt:Bt, raw:v, Bep:Math.min(v,bfc), capped:v>bfc}; }
  function chordQf(c, beta){ var U=c.Pu/(c.Fy*c.A)+c.Mu*12/(c.Fy*c.S); if (U<=0) return {U:U, raw:1, Qf:1, tension:true};
    var raw=1.3-0.4*U/beta; return {U:U, raw:raw, Qf:Math.max(0.4,Math.min(1.0,raw)), tension:false}; }

  function compute(inp){
    var errors = validate(inp);
    if (errors.length) return {ok:false, errors:errors, checks:[], vals:{}, maxDC:null, governing:'', governingId:'', banner:'ERROR'};
    var C=[], v={}, b=inp.beam, c=inp.col, w=inp.weld, phi=PHI[inp.code], legacy=inp.code==='dg24-1';
    var edn = legacy ? 'DG24 1st ed Table 7-2 / AISC 360-10' : 'AISC 360-22';

    // ---- geometry
    var flat=c.B-3*c.t, bfc=Math.min(b.bf,c.B), beta=bfc/c.B;
    var overlap=Math.max(0,Math.min(b.bf,c.B)-flat)/2, proj=Math.max(0,b.bf-c.B)/2;
    var cls = b.bf<=flat+1e-9 ? 'flat' : (b.bf<=c.B+1e-9 ? 'corner' : 'beyond');
    var lever=b.d-b.tf, Puf=inp.Mu*12/lever, Bt=c.B/c.t, Ht=c.H/c.t, k=1.5*c.t, eta=b.tf/c.B;
    var be=effBe(c,b.Fy,b.tf,bfc), bep=effBep(c,bfc), qf=chordQf(c,beta);
    var endReq = c.B*(1-beta), endApp = beta<=0.85+1e-9, endViol = inp.lend!==null && endApp && inp.lend<endReq-1e-9, endRed = endViol?0.5:1.0;
    Object.assign(v,{flat:flat,bfc:bfc,beta:beta,overlap:overlap,proj:proj,cls:cls,lever:lever,Puf:Puf,Bt:Bt,Ht:Ht,k:k,eta:eta,be:be,bep:bep,qf:qf,endReq:endReq,endApp:endApp,endViol:endViol,endRed:endRed,legacy:legacy});

    var SEC_G='Geometry &amp; applicability';
    // GEO
    var gdet = H('Flange width vs. HSS face (DG24 1st ed &sect;4.4 / Ex 4.3; 2nd ed Ch. 6)')
      +R('Workable flat B &minus; 3t = '+f2(c.B)+' &minus; 3 &times; '+f3(c.t)+' = '+V(f3(flat),'in')+'; overall width B = '+f2(c.B)+' in; b<sub>f</sub> = '+f3(b.bf)+' in')
      +R('Credited width b<sub>fc</sub> = min(b<sub>f</sub>, B) = '+V(f3(bfc),'in')+'; &beta; = b<sub>fc</sub>/B = '+V(f3(beta)));
    if (cls==='flat') gdet += R('b<sub>f</sub> &le; B &minus; 3t: the flange sits on the flat; fillet welds are on the flat.');
    if (cls==='corner') gdet += R('B &minus; 3t &lt; b<sub>f</sub> &le; B: the flange overlaps the corner radius by '+V(f3(overlap),'in')+' each side. Welds in the corner region are flare-bevel groove welds (Table J2.2); specify the joint preparation, root gap and inspection.');
    if (cls==='beyond') gdet += R('b<sub>f</sub> &gt; B: the flange projects '+V(f3(proj),'in')+' past each sidewall. Width credited in the transverse-plate model is capped at B (&beta; = 1.0); the projection carries no connection strength. Corner overlap '+f3(overlap)+' in each side.');
    gdet += END();
    C.push(mk(SEC_G,'GEO','Flange width classification','DG24 Ex 4.3 &middot; AISC 360-22 &sect;K1.1 (&beta; &le; 1.0)',
      'b<sub>f</sub> = '+f3(b.bf)+' in', cls==='flat'?'on the flat (B &minus; 3t = '+f2(flat)+' in)':cls==='corner'?'corner overlap '+f3(overlap)+' in/side':'projects '+f3(proj)+' in/side beyond B', null, gdet,
      {status:cls==='flat'?'INFO':'REVIEW', note:cls==='flat'?'':cls==='corner'?'corner-region weld detail required':'flange wider than HSS: credited width capped at B, weld/end detail required', informational:true}));
    // LIM
    var lim=[['B/t = '+f1(Bt)+' &le; 35',Bt<=35],['H/t = '+f1(Ht)+' &le; 35',Ht<=35],['0.25 &le; &beta; = '+f3(beta)+' &le; 1.0',beta>=0.25-1e-9&&beta<=1+1e-9],
      ['F<sub>y</sub> = '+f1(c.Fy)+' &le; 52 ksi',c.Fy<=52],['F<sub>y</sub>/F<sub>u</sub> = '+f3(c.Fy/c.Fu)+' &le; 0.8',c.Fy/c.Fu<=0.8+1e-9],
      ['F<sub>yb</sub> = '+f1(b.Fy)+' &le; 52 ksi',b.Fy<=52],['F<sub>yb</sub>/F<sub>ub</sub> = '+f3(b.Fy/b.Fu)+' &le; 0.8',b.Fy/b.Fu<=0.8+1e-9]];
    var limOK=lim.every(function(x){return x[1];}); v.limOK=limOK;
    C.push(mk(SEC_G,'LIM','Limits of applicability','AISC 360-22 &sect;K1.3 &middot; DG24 Table 7-2A','&beta; = '+f3(beta)+', B/t = '+f1(Bt), limOK?'all limits met':'outside limits', null,
      H('AISC 360-22 &sect;K1.3 limits of applicability (Chapter K parameters, Q<sub>f</sub>)')+lim.map(function(x){return R(x[0]+(x[1]?' &mdash; o.k.':' &mdash; <b>not met</b>'));}).join('')+R('Outside these limits the Chapter K parameters are not validated; design by rational analysis (&sect;K1).')+END(),
      {status:limOK?'PASS':'REVIEW', note:limOK?'':lim.filter(function(x){return !x[1];}).map(function(x){return x[0].replace(/<[^>]+>/g,'');}).join('; '), informational:true}));
    // END
    var edet=H('AISC 360-22 &sect;K1.4 Eq. K1-7 &mdash; minimum end distance to an unreinforced column end')
      +R('l<sub>end</sub> &ge; B(1 &minus; &beta;) = '+f2(c.B)+' &times; (1 &minus; '+f3(beta)+') = '+V(f3(endReq),'in')+(endApp?' (applies for &beta; &le; 0.85)':' &mdash; not required for &beta; &gt; 0.85'))
      +R(inp.lend===null?'Column continuous through the connection or end distance adequate (input blank).':'Provided l<sub>end</sub> = '+f2(inp.lend)+' in'+(endViol?' &lt; required &rarr; <b>available strengths reduced 50 %</b>':' &mdash; o.k.'))+END();
    C.push(mk(SEC_G,'END','End distance to column end','AISC 360-22 &sect;K1.4 Eq. K1-7', inp.lend===null?'continuous':'l<sub>end</sub> = '+f2(inp.lend)+' in', endApp?'&ge; '+f3(endReq)+' in':'not required', null, edet,
      {status:endViol?'REVIEW':'INFO', note:endViol?'50 % reduction applied to HSS rows':'', informational:true}));
    // QF
    C.push(mk(SEC_G,'QF','Chord-stress interaction Q<sub>f</sub>','AISC 360-22 &sect;K1.3 Eq. K1-4, K1-6','U = '+f3(qf.U),'Q<sub>f</sub> = '+f3(qf.Qf), null,
      H('AISC 360-22 &sect;K1.3(c)(1) &mdash; rectangular HSS, transverse plate')
      +R('U = P<sub>u</sub>/(F<sub>y</sub>A) + M<sub>u</sub>&times;12/(F<sub>y</sub>S) = '+fr(f1(c.Pu),f1(c.Fy)+' &times; '+f2(c.A))+' + '+fr(f1(c.Mu)+' &times; 12',f1(c.Fy)+' &times; '+f2(c.S))+' = '+V(f3(qf.U)))
      +R(qf.tension?'Connecting face in tension &rarr; Q<sub>f</sub> = 1.0':'Q<sub>f</sub> = 1.3 &minus; 0.4U/&beta; = 1.3 &minus; 0.4 &times; '+f3(qf.U)+'/'+f3(beta)+' = '+f3(qf.raw)+' &rarr; 0.4 &le; Q<sub>f</sub> &le; 1.0 &rarr; '+V(f3(qf.Qf)))
      +R('Q<sub>f</sub> multiplies face plastification and sidewall crippling/buckling (DG24 Table 7-2).')+END(), {status:'INFO', informational:true}));

    // ---- flange rows (tension and compression)
    function flange(isTop){
      var SEC = isTop?'Tension flange':'Compression flange', tag=isTop?'T':'C', out={};
      var redNote = endViol ? ' &times; 0.5 (end distance)' : '';
      // LY
      var RnLY=b.Fy*b.tf*be.Be, phiLY=phi.LY*RnLY*endRed; out.RnLY=RnLY; out.phiLY=phiLY;
      C.push(mk(SEC,tag+'LY','Beam flange local yielding (uneven load distribution)', legacy?'DG24 Table 7-2 (Spec. Eq. K1-2), &phi; = 0.95':'AISC 360-22 &sect;K1.2a Eq. K1-1, &sect;K2.3 &rarr; '+(isTop?'&sect;J4.1 Eq. J4-1':'&sect;J4.4 Eq. J4-6')+', &phi; = 0.90',
        'P<sub>uf</sub> = '+f1(Puf)+' kips','&phi;R<sub>n</sub> = '+f1(phiLY)+' kips', Puf/phiLY,
        H('Local yielding of the beam flange treated as a transverse plate ('+edn+')')
        +R('Eq. K1-1: B<sub>e</sub> = '+fr('10','B/t')+'&middot;'+fr('F<sub>y</sub>t','F<sub>yb</sub>t<sub>f</sub>')+'&middot;b<sub>fc</sub> = '+fr('10',f2(Bt))+' &times; '+fr(f1(c.Fy)+' &times; '+f3(c.t),f1(b.Fy)+' &times; '+f3(b.tf))+' &times; '+f3(bfc)+' = '+f3(be.raw)+(be.capped?' &gt; b<sub>fc</sub> &rarr; B<sub>e</sub> = ':' &rarr; B<sub>e</sub> = ')+V(f3(be.Be),'in'))
        +R('R<sub>n</sub> = F<sub>yb</sub> t<sub>f</sub> B<sub>e</sub> = '+f1(b.Fy)+' &times; '+f3(b.tf)+' &times; '+f3(be.Be)+' = '+V(f1(RnLY),'kips')+' (upper bound F<sub>yb</sub>t<sub>f</sub>b<sub>fc</sub> = '+f1(b.Fy*b.tf*bfc)+' kips)')
        +R('&phi;R<sub>n</sub> = '+f2(phi.LY)+' &times; '+f1(RnLY)+redNote+' = '+V(f1(phiLY),'kips'))+DC(f1(Puf),f1(phiLY),Puf/phiLY), {note:'B<sub>e</sub> = '+f3(be.Be)+' of '+f3(bfc)+' in effective'}));
      // PL
      var plApp = beta<=0.85+1e-9, RnPL = beta<1-1e-9 ? c.Fy*c.t*c.t*(2*eta/(1-beta)+4/Math.sqrt(1-beta))*qf.Qf : Infinity, phiPL=phi.PL*RnPL*endRed;
      out.plApp=plApp; out.RnPL=RnPL; out.phiPL=phiPL;
      var dpl=H('HSS connecting-face plastification &mdash; yield-line mechanism (AISC 360-22 &sect;J10.10, Comm. K1; 16th Ed Manual Part 9; form of 360-10 Eq. K2-7)')
        +R('&beta; = '+f3(beta)+(plApp?' &le; 0.85 &rarr; <b>applicable</b>':' &gt; 0.85 &rarr; <b>not required</b> (load goes to the sidewalls; yield line is non-critical, Comm. K1)')+'; &eta; = t<sub>f</sub>/B = '+f3(eta));
      if (isFinite(RnPL)) dpl += R('R<sub>n</sub> = F<sub>y</sub>t&sup2;[2&eta;/(1&minus;&beta;) + 4/&radic;(1&minus;&beta;)]Q<sub>f</sub> = '+f1(c.Fy)+' &times; '+f3(c.t)+'&sup2; &times; ['+f3(2*eta/(1-beta))+' + '+f3(4/Math.sqrt(1-beta))+'] &times; '+f3(qf.Qf)+' = '+V(f1(RnPL),'kips'))
        +R('&phi;R<sub>n</sub> = 1.00 &times; '+f1(RnPL)+redNote+' = '+V(f1(phiPL),'kips'))+(legacy?R('Not tabulated in DG24 1st ed Table 7-2 (omitted as non-governing in practical cases); shown for completeness.'):'')+DC(f1(Puf),f1(phiPL),Puf/phiPL);
      else dpl += R('&beta; = 1.0: the mechanism does not form; the sidewall rows govern.')+END();
      C.push(mk(SEC,tag+'PL','HSS face plastification (yield line)','AISC 360-22 &sect;J10.10 / Comm. K1 &middot; Manual Pt. 9 &middot; STI 2025, &phi; = 1.00',
        'P<sub>uf</sub> = '+f1(Puf)+' kips', isFinite(phiPL)?'&phi;R<sub>n</sub> = '+f1(phiPL)+' kips':'&mdash;', isFinite(phiPL)?Puf/phiPL:null, dpl,
        plApp?{}:{status:isFinite(phiPL)?'INFO':'N/A', note:'not required: &beta; &gt; 0.85', informational:true}));
      // PS
      var pLo=0.85*c.B, pHi=c.B-2*c.t, psApp = bfc>=pLo-1e-9 && bfc<=pHi+1e-9;
      var RnPS=0.6*c.Fy*c.t*(2*b.tf+2*bep.Bep), phiPS=phi.PS*RnPS*endRed; out.psApp=psApp; out.RnPS=RnPS; out.phiPS=phiPS;
      C.push(mk(SEC,tag+'PS','HSS shear yielding (punching)', legacy?'DG24 Table 7-2 (Spec. Eq. K1-3), &phi; = 0.95':'AISC 360-22 &sect;K1.2a Eq. K1-2, &sect;J4.2(a) Eq. J4-3, Comm. Table C-K1.1, &phi; = 1.00',
        'P<sub>uf</sub> = '+f1(Puf)+' kips','&phi;R<sub>n</sub> = '+f1(phiPS)+' kips', Puf/phiPS,
        H('Punching shear on the effective perimeter, applicable when 0.85B &le; b<sub>fc</sub> &le; B &minus; 2t')
        +R('0.85B = '+f2(pLo)+' in; B &minus; 2t = '+f2(pHi)+' in; b<sub>fc</sub> = '+f3(bfc)+' in &rarr; '+(psApp?'<b>applicable</b>':'<b>not required</b>'+(bfc<pLo?' (b<sub>fc</sub> &lt; 0.85B: the face flexes; flange local yielding / plastification govern)':' (b<sub>fc</sub> &gt; B &minus; 2t: load delivered to the sidewalls)')))
        +R('Eq. K1-2: B<sub>ep</sub> = '+fr('10','B/t')+'&middot;b<sub>fc</sub> = '+fr('10',f2(Bt))+' &times; '+f3(bfc)+' = '+f3(bep.raw)+(bep.capped?' &gt; b<sub>fc</sub> &rarr; ':' &rarr; ')+V(f3(bep.Bep),'in'))
        +R('R<sub>n</sub> = 0.6F<sub>y</sub>t(2t<sub>f</sub> + 2B<sub>ep</sub>) = 0.6 &times; '+f1(c.Fy)+' &times; '+f3(c.t)+' &times; (2 &times; '+f3(b.tf)+' + 2 &times; '+f3(bep.Bep)+') = '+V(f1(RnPS),'kips'))
        +R('&phi;R<sub>n</sub> = '+f2(phi.PS)+' &times; '+f1(RnPS)+redNote+' = '+V(f1(phiPS),'kips'))+DC(f1(Puf),f1(phiPS),Puf/phiPS),
        psApp?{}:{status:'INFO', note:bfc<pLo?'not required: b<sub>fc</sub> &lt; 0.85B':'not required: b<sub>fc</sub> &gt; B &minus; 2t', informational:true}));
      // SY
      var swApp = beta>=0.85-1e-9, RnSY=2*c.Fy*c.t*(5*k+b.tf), phiSY=phi.SY*RnSY*endRed; out.swApp=swApp; out.RnSY=RnSY; out.phiSY=phiSY;
      C.push(mk(SEC,tag+'SY','HSS sidewall local yielding','AISC 360-22 &sect;J10.2 Eq. J10-2 (two walls) &middot; DG24 Table 7-2 (Spec. Eq. K1-4), &phi; = 1.00',
        'P<sub>uf</sub> = '+f1(Puf)+' kips','&phi;R<sub>n</sub> = '+f1(phiSY)+' kips', Puf/phiSY,
        H('Sidewall local yielding, applicable when &beta; &ge; 0.85 (Comm. K2: branch wider than 85 % of the chord loads the sidewalls; DG24 1st ed tabulates &beta; = 1.0)')
        +R('&beta; = '+f3(beta)+(swApp?' &ge; 0.85 &rarr; <b>applicable</b>':' &lt; 0.85 &rarr; <b>not required</b> (face carries the load)'))
        +R('k = 1.5t = '+f3(k)+' in; bearing length l<sub>b</sub> = t<sub>f</sub> = '+f3(b.tf)+' in')
        +R('R<sub>n</sub> = 2F<sub>y</sub>t(5k + l<sub>b</sub>) = 2 &times; '+f1(c.Fy)+' &times; '+f3(c.t)+' &times; (5 &times; '+f3(k)+' + '+f3(b.tf)+') = '+V(f1(RnSY),'kips'))
        +R('&phi;R<sub>n</sub> = 1.00 &times; '+f1(RnSY)+redNote+' = '+V(f1(phiSY),'kips'))+DC(f1(Puf),f1(phiSY),Puf/phiSY),
        swApp?{}:{status:'INFO', note:'not required: &beta; &lt; 0.85', informational:true}));
      // SC / SB (compression flange only)
      if (!isTop){
        var isX=inp.connType==='X', Hf=c.H-3*c.t, sq=Math.sqrt(E*c.Fy);
        var RnSC = isX ? 48*Math.pow(c.t,3)/Hf*sq*qf.Qf : 1.6*c.t*c.t*(1+3*b.tf/Hf)*sq*qf.Qf;
        var phF = isX?phi.SB:phi.SC, phiSC=phF*RnSC*endRed; out.isX=isX; out.RnSC=RnSC; out.phiSC=phiSC;
        var dsc=H(isX?'Sidewall local buckling, cross-connection (AISC 360-22 &sect;J10.5 Eq. J10-8, two walls; DG24 Table 7-2 Spec. Eq. K1-6)':'Sidewall local crippling, T-connection (AISC 360-22 &sect;J10.3 Eq. J10-4 with t<sub>w</sub> = t<sub>f</sub> = t, two walls; DG24 Table 7-2 Spec. Eq. K1-5)')
          +R('&beta; = '+f3(beta)+(swApp?' &ge; 0.85 &rarr; <b>applicable</b>':' &lt; 0.85 &rarr; <b>not required</b>')+'; H &minus; 3t = '+f2(Hf)+' in; '+ov('EF<sub>y</sub>')+' = '+f1(sq)+' ksi; Q<sub>f</sub> = '+f3(qf.Qf))
          +(isX?R('R<sub>n</sub> = 48t&sup3;/(H &minus; 3t)&middot;'+ov('EF<sub>y</sub>')+'&middot;Q<sub>f</sub> = '+V(f1(RnSC),'kips')):R('R<sub>n</sub> = 1.6t&sup2;[1 + 3t<sub>f</sub>/(H &minus; 3t)]'+ov('EF<sub>y</sub>')+'Q<sub>f</sub> = 1.6 &times; '+f3(c.t)+'&sup2; &times; [1 + 3 &times; '+f3(b.tf)+'/'+f2(Hf)+'] &times; '+f1(sq)+' &times; '+f3(qf.Qf)+' = '+V(f1(RnSC),'kips')))
          +R('&phi;R<sub>n</sub> = '+f2(phF)+' &times; '+f1(RnSC)+redNote+' = '+V(f1(phiSC),'kips'))+DC(f1(Puf),f1(phiSC),Puf/phiSC);
        C.push(mk(SEC,'CSC', isX?'HSS sidewall local buckling (cross-connection)':'HSS sidewall local crippling (T-connection)', isX?'AISC 360-22 &sect;J10.5 Eq. J10-8 &middot; Eq. K1-4, &phi; = 0.90':'AISC 360-22 &sect;J10.3 Eq. J10-4 &middot; Eq. K1-4, &phi; = 0.75',
          'P<sub>uf</sub> = '+f1(Puf)+' kips','&phi;R<sub>n</sub> = '+f1(phiSC)+' kips', Puf/phiSC, dsc, swApp?{note:'Q<sub>f</sub> = '+f3(qf.Qf)}:{status:'INFO', note:'not required: &beta; &lt; 0.85', informational:true}));
      }
      return out;
    }
    v.top=flange(true); v.bot=flange(false);

    // ---- welds
    var SEC_W='Flange-to-HSS welds';
    if (w.type==='cjp'){
      C.push(mk(SEC_W,'W','Flange-to-HSS weld','AISC 360-22 &sect;J2.1a, Table J2.5 (CJP: base metal governs)','P<sub>uf</sub> = '+f1(Puf)+' kips','CJP groove weld', null,
        H('Complete-joint-penetration groove weld, beam flange to HSS face')+R('A CJP weld develops the connected flange; the flange local-yielding row (B<sub>e</sub>) governs the weld line. Backing, access and the corner joint must be detailed per AWS D1.1.')
        +(cls!=='flat'?R('<b>The flange reaches the HSS corner radius:</b> a CJP groove through the corner is not a prequalified detail; specify a flare-bevel groove weld (Table J2.2 throat, R = 2t = '+f3(2*c.t)+' in) or trim and stiffen. Engineer to detail.'):'')+END(),
        {status:cls==='flat'?'INFO':'REVIEW', note:cls==='flat'?'develops the flange':'corner joint preparation to be specified', informational:true}));
      v.weld={type:'cjp'};
    } else {
      var Rr=2*c.t, Ecor = Rr>=0.375-1e-9 ? (w.proc==='gmaw'?0.625:0.3125)*Rr : 0;
      var Lflat=Math.min(bfc,flat), Lcor=bfc-Lflat, LcorE=Math.min(Lcor,be.Be), LflatE=be.Be-LcorE;
      var kds = (w.kds && w.faces===2) ? 1.5 : 1.0, D=w.w*16;
      var RnW = w.faces*0.6*w.Fexx*(0.707*w.w*LflatE+Ecor*LcorE)*kds, phiW=phi.W*RnW, le=w.faces*be.Be;
      var cornerUncredited = Lcor>1e-9 && Ecor===0;
      v.weld={type:'fillet',R:Rr,Ecor:Ecor,Lflat:Lflat,Lcor:Lcor,LcorE:LcorE,LflatE:LflatE,kds:kds,le:le,RnW:RnW,phiW:phiW,D:D};
      var dw=H('AISC 360-22 &sect;J2.4 fillet welds &middot; &sect;K5 Table K5.1 Eq. K5-4 effective length (l<sub>e</sub> = 2B<sub>e</sub> for welds both faces)')
        +R('Effective length per face = B<sub>e</sub> = '+f3(be.Be)+' in, allocated from the flange edges (stiff sidewall regions) inward: corner portion '+f3(LcorE)+' in, flat portion '+f3(LflatE)+' in; faces = '+w.faces+' &rarr; l<sub>e</sub> = '+V(f3(le),'in'))
        +R('Flat: fillet throat 0.707w = 0.707 &times; '+f4(w.w)+' = '+f4(0.707*w.w)+' in. Corner: flare-bevel groove, R = 2t = '+f3(Rr)+' in &rarr; '+(Ecor>0?'throat (Table J2.2, '+(w.proc==='gmaw'?'5/8':'5/16')+'R) = '+f4(Ecor)+' in':'R &lt; 3/8 in: no flare-bevel throat credited (Table J2.2 note)'))
        +R('k<sub>ds</sub> = '+f2(kds)+(w.kds&&w.faces!==2?' (directional increase not permitted for a single-sided fillet on the tension flange; DG24 2nd ed Ch. 3, &sect;J2.4(a)(3))':''))
        +R('R<sub>n</sub> = faces &times; 0.60F<sub>EXX</sub>(0.707w&middot;l<sub>flat,e</sub> + E&middot;l<sub>corner,e</sub>)k<sub>ds</sub> = '+w.faces+' &times; 0.60 &times; '+f1(w.Fexx)+' &times; ('+f4(0.707*w.w)+' &times; '+f3(LflatE)+' + '+f4(Ecor)+' &times; '+f3(LcorE)+') &times; '+f2(kds)+' = '+V(f1(RnW),'kips'))
        +R('&phi;R<sub>n</sub> = 0.75 &times; '+f1(RnW)+' = '+V(f1(phiW),'kips'))+DC(f1(Puf),f1(phiW),Puf/phiW);
      C.push(mk(SEC_W,'W','Flange-to-HSS fillet welds','AISC 360-22 &sect;J2.4 &middot; &sect;K5 Eq. K5-4, &phi; = 0.75','P<sub>uf</sub> = '+f1(Puf)+' kips','&phi;R<sub>n</sub> = '+f1(phiW)+' kips', Puf/phiW, dw,
        {note:frac16(w.w)+' in fillet, '+(w.faces===2?'both faces':'top face only')+', l<sub>e</sub> = '+f3(le)+' in'+(cornerUncredited?'; corner not credited':'')}));
      if (cornerUncredited) C.push(mk(SEC_W,'WCOR','Corner-region weld','AISC 360-22 Table J2.2','R = 2t = '+f3(Rr)+' in','&lt; 3/8 in', null,
        H('Flare-bevel groove welds')+R('For R &lt; 3/8 in Table J2.2 permits only the reinforcing fillet on a filled-flush joint; the corner overlap of '+f3(overlap)+' in per side is not credited above. Engineer to detail or trim.')+END(), {status:'REVIEW', note:'corner region not credited', informational:true}));
      var tminH=3.09*D/c.Fu, tminF=(w.faces===2?6.19:3.09)*D/b.Fu; v.weld.tminH=tminH; v.weld.tminF=tminF;
      C.push(mk(SEC_W,'WBH','HSS wall base metal at the weld','AISC Manual Eq. 9-2','t<sub>min</sub> = '+f3(tminH)+' in','t = '+f3(c.t)+' in', tminH/c.t,
        H('AISC Manual Eq. 9-2 &mdash; HSS wall under a single fillet line')+R('t<sub>min</sub> = 3.09D/F<sub>u</sub> = 3.09 &times; '+f2(D)+'/'+f1(c.Fu)+' = '+V(f3(tminH),'in')+' &le; t = '+f3(c.t)+' in')+DC(f3(tminH),f3(c.t),tminH/c.t)));
      C.push(mk(SEC_W,'WBF','Beam flange base metal at the weld','AISC Manual Eq. '+(w.faces===2?'9-3':'9-2'),'t<sub>min</sub> = '+f3(tminF)+' in','t<sub>f</sub> = '+f3(b.tf)+' in', tminF/b.tf,
        H('AISC Manual Eq. '+(w.faces===2?'9-3 &mdash; flange loaded by fillets on both faces':'9-2 &mdash; flange with a fillet on one face'))+R('t<sub>min</sub> = '+(w.faces===2?'6.19':'3.09')+'D/F<sub>u</sub> = '+(w.faces===2?'6.19':'3.09')+' &times; '+f2(D)+'/'+f1(b.Fu)+' = '+V(f3(tminF),'in')+' &le; t<sub>f</sub> = '+f3(b.tf)+' in')+DC(f3(tminF),f3(b.tf),tminF/b.tf)));
      var tThin=Math.min(b.tf,c.t), wmin=minFillet(tThin), wmax=maxFillet(b.tf), okMin=w.w>=wmin-1e-9, okMax=w.w<=wmax+1e-9, okLen=be.Be>=4*w.w;
      C.push(mk(SEC_W,'WLIM','Fillet size limits','AISC 360-22 Table J2.4 &middot; &sect;J2.2b','w = '+frac16(w.w)+' in','min '+frac16(wmin)+' &middot; max '+frac16(wmax)+' in', null,
        H('AISC 360-22 &sect;J2.2b fillet weld limitations')+R('Thinner part t = '+f3(tThin)+' in &rarr; Table J2.4 minimum w = '+V(frac16(wmin),'in')+(okMin?' &mdash; o.k.':' &mdash; <b>not met</b>'))
        +R('Weld along the flange end (t<sub>f</sub> = '+f3(b.tf)+' in) &rarr; &sect;J2.2b(b) maximum w = '+V(frac16(wmax),'in')+(okMax?' &mdash; o.k.':' &mdash; <b>exceeded</b>'))
        +R('Minimum length 4w = '+f2(4*w.w)+' in &le; effective length '+f3(be.Be)+' in'+(okLen?' &mdash; o.k.':' &mdash; <b>not met</b>'))+END(),
        {status:(okMin&&okMax&&okLen)?'PASS':'REVIEW', note:(okMin&&okMax&&okLen)?'':'outside &sect;J2.2b limits', informational:true}));
    }

    // ---- design status rows
    var SEC_S='Design status';
    C.push(mk(SEC_S,'STIFF','Rotational stiffness classification','DG24 1st ed &sect;7.1 &middot; 2nd ed Ch. 6 &middot; AISC 360-22 &sect;B3.4b','&mdash;','PR (partially restrained)', null,
      H('Connection classification')+R('DG24 treats the directly welded W-beam-to-HSS connection as a pair of transverse plates and classifies it as semi-rigid / partially restrained. FR stiffness is <b>not verified</b> by this calculator; if the frame analysis assumes an FR joint, verify stiffness separately (&sect;B3.4b).')+END(), {status:'INFO', note:'FR stiffness not verified', informational:true}));
    C.push(mk(SEC_S,'SHEAR','Beam web shear connection','AISC Manual Part 10 (single-plate to HSS wall)','V<sub>u</sub> = '+f1(inp.Vu)+' kips','designed separately', null,
      H('Shear transfer')+R('The flange couple carries M<sub>u</sub> only. Design the web shear connection (single-plate shear tab welded to the HSS wall, Manual Part 10 / DG24 Ch. 5) for V<sub>u</sub> = '+f1(inp.Vu)+' kips in a separate calculation.')+END(), {status:'INFO', informational:true}));

    // ---- summary
    var maxDC=0, governing='', governingId='';
    C.forEach(function(ch){ if(!ch.informational && ch.dc!==null && ch.dc>maxDC){ maxDC=ch.dc; governing=ch.name; governingId=ch.id; } });
    var anyFail=C.some(function(ch){return ch.status==='FAIL';}), anyRev=C.some(function(ch){return ch.status==='REVIEW';});
    var banner = anyFail?'FAIL':anyRev?'REVIEW':'PASS';
    v.phiMn = maxDC>0 ? inp.Mu/maxDC : Infinity;
    v.phiMpx = isNum(b.Zx)&&b.Zx>0 ? 0.90*b.Fy*b.Zx/12 : null;
    C.push(mk(SEC_S,'CAP','Connection flexural strength vs. beam','DG24 Ex 4.3 closing note','&phi;M<sub>n,conn</sub> = '+f1(v.phiMn)+' kip-ft', v.phiMpx!==null?'&phi;<sub>b</sub>M<sub>px</sub> = '+f1(v.phiMpx)+' kip-ft':'&mdash;', null,
      H('Flexural strength comparison')+R('&phi;M<sub>n,conn</sub> = M<sub>u</sub>/(max D/C) = '+f1(inp.Mu)+'/'+f3(maxDC)+' = '+V(f1(v.phiMn),'kip-ft')+' governed by '+governing)
      +(v.phiMpx!==null?R('Beam &phi;<sub>b</sub>M<sub>px</sub> = 0.90 &times; '+f1(b.Fy)+' &times; '+f1(b.Zx)+'/12 = '+V(f1(v.phiMpx),'kip-ft')+' &rarr; connection develops '+f1(100*v.phiMn/v.phiMpx)+' % of the beam (DG24: the full flexural strength of the W-shape is seldom achievable).'):'')+END(), {status:'INFO', informational:true}));
    return {ok:true, errors:[], checks:C, vals:v, maxDC:maxDC, governing:governing, governingId:governingId, banner:banner};
  }

  // ---- fixtures (spec §5)
  function merge(a,b){ var o={}; Object.keys(a).forEach(function(k){ o[k]=(a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))?merge(a[k],{}):a[k]; });
    Object.keys(b||{}).forEach(function(k){ o[k]=(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&o[k]&&typeof o[k]==='object')?merge(o[k],b[k]):b[k]; }); return o; }
  var W16X57={label:'W16X57', d:16.4, bf:7.12, tf:0.715, tw:0.43, Fy:50, Fu:65, Zx:105};
  var HSS10={label:'HSS10X10X1/2', H:10, B:10, t:0.465, A:17.2, S:51.2, Fy:46, Fu:58, Pu:0, Mu:0};
  var HSS6={label:'custom', H:6, B:6, t:0.465, A:9.74, S:16.1, Fy:46, Fu:58, Pu:0, Mu:0};
  var CJP={type:'cjp', w:0.3125, faces:1, proc:'smaw', Fexx:70, kds:false};
  var FIL={type:'fillet', w:0.3125, faces:1, proc:'smaw', Fexx:70, kds:false};
  var BASE={code:'dg24-1', beam:W16X57, Mu:60, Vu:20, col:HSS10, connType:'T', lend:null, weld:CJP};
  function near(l,got,want,tol){ return [l, Math.abs(got-want)<=tol, f4(got)+' vs '+want+' (±'+tol+')']; }
  function is(l,got,want){ return [l, got===want, String(got)+' vs '+String(want)]; }
  function row(res,id){ for (var i=0;i<res.checks.length;i++) if (res.checks[i].id===id) return res.checks[i]; return null; }
  var FIXTURES=[
    {id:'F1', src:'DG24 1st ed Ex 4.3 pp. 46-48, legacy phi', inp:BASE, expect:function(r){ var v=r.vals; return [
      near('flat B-3t', v.flat, 8.605, 0.001), is('class flat', v.cls, 'flat'), near('beta', v.beta, 0.712, 0.001), near('Puf (Mu 60)', v.Puf, 45.90, 0.01),
      near('B_e', v.be.Be, 1.981, 0.002), near('R_n local yielding', v.top.RnLY, 70.8, 0.05), near('phiR_n local yielding (0.95)', v.top.phiLY, 67.28, 0.02),
      is('punching not required', v.top.psApp, false), is('punching row INFO', row(r,'TPS').status, 'INFO'), is('sidewall not required', v.top.swApp, false), is('sidewall row INFO', row(r,'TSY').status, 'INFO'),
      near('phiMn legacy 87.9', v.phiMn, 87.94, 0.05), is('governing LY', r.governingId, 'TLY'), is('banner PASS', r.banner, 'PASS'), is('limits met', row(r,'LIM').status, 'PASS')
    ]; }},
    {id:'F2', src:'Ex 4.3 in 360-22 mode, Pu = 600 kips, 5/16 fillet one face', inp:merge(BASE,{code:'360-22', col:{Pu:600}, weld:FIL}), expect:function(r){ var v=r.vals; return [
      near('phiR_n local yielding (0.90)', v.top.phiLY, 63.74, 0.02), near('U', v.qf.U, 0.7583, 0.001), near('Q_f', v.qf.Qf, 0.874, 0.001),
      is('plastification applicable', v.top.plApp, true), near('phiR_n plastification', v.top.phiPL, 69.11, 0.05), is('plastification not governing', r.governingId!=='TPL', true),
      near('weld l_e = B_e', v.weld.le, 1.981, 0.002), near('phiR_n weld', v.weld.phiW, 13.79, 0.02), is('weld governs', r.governingId, 'W'), near('t_min HSS', v.weld.tminH, 0.2664, 0.001), is('banner FAIL', r.banner, 'FAIL')
    ]; }},
    {id:'F3', src:'handoff 6-in HSS, b_f 5.5 in', inp:merge(BASE,{code:'360-22', beam:{label:'custom', d:12, bf:5.5, tf:0.5, tw:0.3, Zx:40}, Mu:40, col:HSS6, weld:FIL}), expect:function(r){ var v=r.vals; return [
      near('flat', v.flat, 4.605, 0.001), is('class corner', v.cls, 'corner'), near('overlap per side', v.overlap, 0.4475, 0.001), near('beta', v.beta, 0.9167, 0.001),
      is('punching not required (bfc > B-2t)', v.top.psApp, false), is('plastification not required', v.top.plApp, false), is('sidewalls applicable', v.top.swApp, true),
      near('flare-bevel throat', v.weld.Ecor, 0.2906, 0.001), near('corner length', v.weld.Lcor, 0.895, 0.001), near('phiR_n weld', v.weld.phiW, 27.35, 0.05),
      is('GEO row REVIEW not FAIL', row(r,'GEO').status, 'REVIEW'), is('no FAIL from geometry rows', ['GEO','LIM','END'].every(function(id){return row(r,id).status!=='FAIL';}), true)
    ]; }},
    {id:'F4', src:'W16X57 on 6-in HSS: flange beyond B', inp:merge(BASE,{code:'360-22', Mu:40, col:HSS6, weld:FIL}), expect:function(r){ var v=r.vals; return [
      is('class beyond', v.cls, 'beyond'), near('credited width', v.bfc, 6.0, 1e-9), near('beta capped', v.beta, 1.0, 1e-9), near('projection per side', v.proj, 0.56, 0.001),
      near('B_e', v.be.Be, 2.782, 0.002), is('GEO REVIEW', row(r,'GEO').status, 'REVIEW'), is('plastification N/A at beta 1', row(r,'TPL').status, 'N/A')
    ]; }},
    {id:'F5', src:'STI July 2025 transverse flange plate example (HSS12x8x1/2, PL 3/8 x 6.5)', inp:merge(BASE,{code:'360-22', beam:{label:'custom', d:18, bf:6.5, tf:0.375, tw:0.3, Zx:100}, Mu:46.7*17.625/12,
      col:{label:'custom', H:12, B:8, t:0.465, A:17.2, S:55.6, Fy:50, Fu:62, Pu:500, Mu:45}, connType:'X', weld:{type:'fillet', w:0.25, faces:2, proc:'smaw', Fexx:70, kds:false}}), expect:function(r){ var v=r.vals; return [
      near('Puf', v.Puf, 46.7, 0.01), near('B_e', v.be.Be, 4.685, 0.005), near('phiR_n plate local yielding 79.1', v.top.phiLY, 79.06, 0.05),
      near('U', v.qf.U, 0.7756, 0.001), near('Q_f 0.918', v.qf.Qf, 0.918, 0.001), near('phiR_n plastification 96.7', v.top.phiPL, 96.66, 0.05),
      near('R_n punching 115.9', v.top.RnPS, 115.87, 0.05), near('R_n sidewall yielding 179.6', v.top.RnSY, 179.6, 0.05), is('sidewall INFO at beta 0.8125', row(r,'TSY').status, 'INFO'),
      near('l_e = 2B_e 9.37', v.weld.le, 9.37, 0.005), near('phiR_n weld 52.2', v.weld.phiW, 52.17, 0.05), is('cross-connection buckling row', v.bot.isX, true)
    ]; }},
    {id:'F6', src:'SEU Jan 2014 (Olson) HSS8x8x3/8 A1085 + W16x36, Mu 66, legacy phi', inp:merge(BASE,{beam:{label:'W16X36', d:15.9, bf:6.99, tf:0.43, tw:0.295, Fy:50, Fu:65, Zx:64}, Mu:66,
      col:{label:'custom', H:8, B:8, t:0.375, A:10.4, S:24.9, Fy:50, Fu:65}}), expect:function(r){ var v=r.vals; return [
      near('Puf 51', v.Puf, 51.2, 0.05), near('phiR_n local yielding 58.4', v.top.phiLY, 58.36, 0.05), is('punching applicable', v.top.psApp, true), near('B_ep 3.28', v.bep.Bep, 3.277, 0.005), near('phiR_n punching 79.3', v.top.phiPS, 79.23, 0.1)
    ]; }},
    {id:'F7', src:'validation', inp:merge(BASE,{beam:{bf:0}, weld:{type:'fillet', w:0}, col:{B:1}}), expect:function(r){ return [ is('rejected', r.ok, false), is('three messages', r.errors.length>=3, true) ]; }},
    {id:'F8', src:'end distance, 360-22 Eq. K1-7', inp:merge(BASE,{code:'360-22', lend:1.0}), expect:function(r){ var v=r.vals; return [
      near('required end distance', v.endReq, 2.88, 0.001), is('violated', v.endViol, true), near('phiR_n LY halved', v.top.phiLY, 31.87, 0.02), is('END row REVIEW', row(r,'END').status, 'REVIEW')
    ]; }}
  ];
  function runFixtures(){
    var lines=[], pass=0, total=0;
    FIXTURES.forEach(function(fx){
      var res, items=[], threw=false;
      try { res=compute(fx.inp); } catch(cerr){ threw=true; items=[['compute threw: '+String(cerr), false, String(cerr)]]; }
      if (!threw){ try { items=fx.expect(res); } catch(err){ items=[['expect threw', false, String(err)]]; } }
      items.forEach(function(it){ total++; if (it[1]) pass++; lines.push((it[1]?'PASS ':'FAIL ')+fx.id+' ['+fx.src+'] '+it[0]+'  ->  '+it[2]); });
    });
    return {pass:pass, total:total, lines:lines};
  }
  return {compute:compute, validate:validate, effBe:effBe, effBep:effBep, chordQf:chordQf, minFillet:minFillet, maxFillet:maxFillet, PHI:PHI, BASE:merge(BASE,{}), FIXTURES:FIXTURES, merge:merge, runFixtures:runFixtures};
})();
```

Note for F2: `merge` copies nested objects, so `col:{Pu:600}` keeps the other HSS10 values. Note for F1: `phiMn` uses `Mu/maxDC` where maxDC = Puf/φRnLY, so the value equals φRnLY·lever/12 = 67.28 × 15.685/12 = 87.94.

- [ ] **Step 4: Run the harness until the fixtures pass**

Run: `npm run test:wthss`
Expected: `PASS engine fixtures N/N` (N ≈ 60) and `ALL PASS`. If a fixture misses by rounding, recheck the formula against spec §4 before touching the expected value; the expected values were computed independently (spec §5) and the F5 values match STI's published numbers.

- [ ] **Step 5: Commit**

```bash
git --git-dir=/tmp/are-git add public/Calcs/W_beam_to_HSS_column_calculator.html tools/test-w-to-hss.mjs package.json
git --git-dir=/tmp/are-git commit -m "feat(w-to-hss): DWHSS engine with full DG24/360-22 limit-state suite and fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: UI layer, schematic hook, save/load ids

**Files:**
- Modify: `public/Calcs/W_beam_to_HSS_column_calculator.html` (fill `#uiRoot` markup, add UI script)
- Modify: `tools/test-w-to-hss.mjs` (replace the `// __UI_CHECKS__` marker)

- [ ] **Step 1: Add UI wiring checks to the harness (they fail until the UI exists)**

Replace `// __UI_CHECKS__` with:

```js
// ── UI wiring: defaults = DG24 Ex 4.3 / 26-003 record, 360-22 mode, CJP ──────
await page.click('button.calc-btn');
const ui = await page.evaluate(() => ({
  banner: document.getElementById('sumOut').textContent,
  rows: document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length,
  sections: document.querySelectorAll('#chkTb tr.sect-row').length,
  results: document.getElementById('results').classList.contains('show'),
  svg: document.getElementById('schemSvg').children.length,
  cards: document.querySelectorAll('#demOut .dem-card').length,
}));
check('results shown after Run', ui.results === true, JSON.stringify(ui));
check('check table has 5 sections', ui.sections === 5, 'sections=' + ui.sections);
check('check table has rows', ui.rows >= 14, 'rows=' + ui.rows);
check('demand cards rendered', ui.cards >= 7, 'cards=' + ui.cards);
check('schematic drawn', ui.svg > 10, 'children=' + ui.svg);
check('banner is PASS on the defaults', /PASS/.test(ui.banner), ui.banner);
check('banner never says All Checks Pass', !/All Checks Pass/i.test(ui.banner), ui.banner);
const same = await page.evaluate(() => { const res = window.DWHSS.compute(readInputs()); return { ok: res.ok, maxDC: res.maxDC, inText: document.getElementById('sumOut').textContent.includes(res.maxDC.toFixed(3)), phiMn: res.vals.phiMn }; });
check('banner reports the engine max D/C', same.ok && same.inText, JSON.stringify(same));
check('default phiMn is 83.3 kip-ft (360-22 phi 0.90)', Math.abs(same.phiMn - 83.27) < 0.05, String(same.phiMn));
// legacy mode reproduces the 26-003 record
await page.selectOption('#code', 'dg24-1');
await page.waitForTimeout(400);
const leg = await page.evaluate(() => window.DWHSS.compute(readInputs()).vals.phiMn);
check('legacy mode phiMn 87.94', Math.abs(leg - 87.94) < 0.05, String(leg));
await page.selectOption('#code', '360-22');
// live re-run
await page.fill('#Mu', '150');
await page.waitForTimeout(400);
const live = await page.evaluate(() => document.getElementById('sumOut').textContent.includes('150.0 kip-ft'));
check('inputs re-run live after the first run', live, 'banner did not follow Mu edit');
await page.fill('#Mu', '60');
// fillet mode shows weld rows; kds disabled with one face
await page.selectOption('#weldType', 'fillet');
await page.waitForTimeout(400);
const wf = await page.evaluate(() => ({ shown: !!document.querySelector('#chkTb td') && document.getElementById('chkTb').textContent.includes('fillet welds'), kdsDisabled: document.getElementById('kds').disabled, wDisabled: document.getElementById('weldW').disabled }));
check('fillet rows render', wf.shown, JSON.stringify(wf));
check('kds disabled with one face', wf.kdsDisabled === true, JSON.stringify(wf));
await page.selectOption('#weldFaces', '2');
await page.waitForTimeout(300);
check('kds enabled with two faces', await page.evaluate(() => !document.getElementById('kds').disabled), 'kds still disabled');
await page.selectOption('#weldType', 'cjp');
// custom sections
await page.selectOption('#hsec', 'custom');
await page.fill('#cB', '6'); await page.fill('#cH', '6'); await page.fill('#ct', '0.465'); await page.fill('#cA', '9.74'); await page.fill('#cS', '16.1');
await page.selectOption('#wsec', 'custom');
await page.fill('#bd', '12'); await page.fill('#bbf', '5.5'); await page.fill('#btf', '0.5'); await page.fill('#btw', '0.3'); await page.fill('#bZx', '40');
await page.click('button.calc-btn');
const geo = await page.evaluate(() => ({ txt: document.getElementById('geoOut').textContent, banner: document.getElementById('sumOut').textContent }));
check('corner classification callout', /corner/i.test(geo.txt) && /0\.44[78]/.test(geo.txt), geo.txt);
check('banner REVIEW for corner case', /REVIEW/.test(geo.banner), geo.banner);
// error path
await page.fill('#cB', '1');
await page.waitForTimeout(400);
const err = await page.evaluate(() => ({ err: document.getElementById('errOut').textContent, shown: document.getElementById('results').classList.contains('show') }));
check('error box for B <= 3t', err.err.includes('exceed 3t') && !err.shown, JSON.stringify(err));
// section selects fill fields
await page.selectOption('#hsec', 'HSS10X10X1/2');
await page.selectOption('#wsec', 'W16X57');
await page.click('button.calc-btn');
const sel = await page.evaluate(() => ({ B: document.getElementById('cB').value, t: document.getElementById('ct').value, d: document.getElementById('bd').value, shown: document.getElementById('results').classList.contains('show') }));
check('HSS select fills B and t', sel.B === '10' && sel.t === '0.465', JSON.stringify(sel));
check('W select fills d', sel.d === '16.4' && sel.shown, JSON.stringify(sel));
// every mode renders
for (const connType of ['T', 'X']) for (const code of ['360-22', 'dg24-1']) {
  await page.selectOption('#connType', connType); await page.selectOption('#code', code);
  await page.click('button.calc-btn');
  const ok = await page.evaluate(() => document.getElementById('results').classList.contains('show'));
  check(`mode ${connType}/${code} renders`, ok, 'results not shown');
}
// legacy record field ids still exist (26-003 snapshot hydrates)
const ids = await page.evaluate(() => ['wsec','Fyb','hsec','Fy','Mu'].every((id) => !!document.getElementById(id)));
check('legacy snapshot field ids present', ids, 'missing one of #wsec #Fyb #hsec #Fy #Mu');
// selftest URL
await page.goto('http://calcs.test/Calcs/' + FILE + '?selftest=1', { waitUntil: 'load' });
await page.waitForSelector('#areBar');
const title = await page.title();
check('selftest title', /^SELFTEST PASS \d+\/\d+$/.test(title), title);
```

- [ ] **Step 2: Run the harness to see the UI checks fail**

Run: `npm run test:wthss` — expected: engine fixtures PASS, UI checks FAIL (no `button.calc-btn`).

- [ ] **Step 3: Build the UI**

Inside `#uiRoot` (replace the placeholder div's contents) add, following the FPHSS markup style (`.blk` > `h2` + `.g3` grid of `.ig` label/input pairs):

Block 0 "Code basis": `<select id="code">` options `360-22` "AISC 360-22 / DG24 2nd ed (default)", `dg24-1` "DG24 1st ed / AISC 360-10 (legacy φ 0.95)".

Block 1 "Beam (W-shape)": `<select id="wsec" class="member-select">` (options from `W_DB` keys + `custom`), read-only-unless-custom fields `bd, bbf, btf, btw, bZx` (ids exactly), `Fyb` (50), `Fub` (65). Keep the ids `wsec`, `Fyb`.

Block 2 "HSS column": `<select id="hsec" class="member-select">` (`HSS_DB` keys + `custom`), fields `cH, cB, ct, cA, cS`; grade select `<select id="grade">` with options `A500B` (46/58), `A500C` (50/62), `A1085` (50/65), `custom` writing `Fy`, `Fu` inputs (ids `Fy`, `Fu`); `Pu` (0), `McolU` (0); `<select id="connType">` T/X; `lend` (blank = adequate). Keep the ids `hsec`, `Fy`.

Block 3 "Demands": `Mu` (60), `Vu` (20).

Block 4 "Flange-to-HSS weld": `<select id="weldType">` cjp|fillet (default cjp); `weldW` (0.3125), `<select id="weldFaces">` 1|2 (default 1), `<select id="weldProc">` smaw|gmaw, `Fexx` (70), `<input type="checkbox" id="kds">`. Disable `weldW, weldFaces, weldProc, Fexx, kds` when type is cjp; disable `kds` when faces = 1.

Then: `<button class="calc-btn" onclick="run()">▶ Run All Checks</button>`, `<div id="errOut" class="err-box" style="display:none"></div>`, `<div id="results" class="results">` containing `<div id="sumOut" class="summary"></div>`, `<div class="blk"><h2>Flange width vs. HSS face</h2><div id="geoOut"></div></div>`, `<div class="blk"><h2>Design demands</h2><div id="demOut"></div></div>`, the check table (`<table class="chk-table"><thead>…</thead><tbody id="chkTb"></tbody></table>` with columns Check | Code reference | Demand | Capacity | D/C | Status | Detail), and the notes box:

Notes box bullets (verbatim intent, wording may be tightened):
- Basis: beam flanges treated as a pair of transverse plates on the HSS face (AISC 360-22 Comm. K2; DG24 1st ed §4.4/§7.1 and Ex 4.3; DG24 2nd ed Ch. 6). Puf = 12Mu/(d − tf).
- Edition map: DG24 1st ed Table 7-2 Eqs. K1-2/K1-3/K1-4/K1-5/K1-6 are 360-10 numbers. In 360-22 they are §K1.2a Eq. K1-1/K1-2 (effective widths), §J4 (yielding, shear), §J10.2/J10.3/J10.5 (sidewalls), Qf §K1.3 Eq. K1-4/K1-6, end distance §K1.4 Eq. K1-7. There is no Eq. K1-7 yielding check and no Table K1.3A.
- Applicability bands: punching 0.85B ≤ bfc ≤ B − 2t; sidewalls β ≥ 0.85 (Comm. K2); plastification β ≤ 0.85. Rows outside their band are shown as INFO and excluded from the governing D/C.
- Flange wider than the flat or than B: see the classification row; credited width capped at B; corner welds are flare-bevel groove welds (Table J2.2, R = 2t; STI "Welding in HSS Corners"). Reference to DG24 2nd ed Ex 6.3 per the 2026-09-23 handoff, not verified against a copy.
- This connection is PR; FR stiffness, the web shear connection, fatigue (Appendix 3) and seismic (AISC 341/358) qualification are outside this calculator.

UI script (place after the engine, before `/are-draw.js`), mirroring FPHSS function names: `$`, `numv`, `optv`, `toggleDet`, `fillSections()` (populates `wsec`/`hsec` selects sorted like FPHSS's `fillSections`, plus a `custom` option), `onBeamChange()` (custom → enable fields; else write `W_DB` values: d, bf, tf, tw, Zx and set read-only), `onColChange()` (custom → enable `cH cB ct cA cS`; else write H, B, t_des, A, Sx), `onGradeChange()`, `applyWeldMode()`, `onInputChanged()` (re-run live after the first run), `readInputs()` returning the exact `inp` shape (`lend: optv('lend')`, `weld.faces: +$('weldFaces').value`, `weld.kds: $('kds').checked`), `card(v,l)`, `draw(res)` (builds the AREDraw state below), `run()` (validate → errors to `#errOut`; else banner, cards, geometry callout `#geoOut`, table with `sect-row` per section in order Geometry & applicability | Tension flange | Compression flange | Flange-to-HSS welds | Design status, detail rows, `AREv2.publish([...])` with Mu/phiMn/Puf like the old page, mark via `AREv2.getMarkHTML()`), `runSelftest()` (sets `document.title` to `SELFTEST PASS n/n` or `SELFTEST FAIL n/n` and prints lines into `#selftest-result`), `init()` (fillSections, defaults W16X57 / HSS10X10X1/2 / A500B, attach `input`/`change` listeners that ignore elements inside `#areBar, .are-bar, .are-hub`, run selftest when `?selftest=1`).

Banner text rules: `<h3>` = `✔ PASS — flange-couple checks` | `⚠ REVIEW — engineer items flagged` | `✘ FAIL — one or more checks exceed 1.0`; `<p>` = `Max D/C = x.xxx (governing row) · φMn = … kip-ft · W16X57 on HSS10X10X1/2, Mu = 60.0 kip-ft` and a second line `Web shear connection and frame stiffness are designed separately.` Status cell classes: PASS→`pass`, FAIL→`fail`, REVIEW→`review`, INFO→`info`, N/A→`na`. Rows with `informational` show D/C in grey when present.

AREDraw state built in `draw(res)`:
```js
var state={ schema:'are.calc.v1', calcType:'w-to-hss-column',
  member:{type:'beam', section:wKey||'W16X57', material:{Fy:inp.beam.Fy}},
  demands:{Mu:inp.Mu},
  connection:{ column:{section:hKey||'HSS10X10X1/2', Fy:inp.col.Fy}, beamFy:inp.beam.Fy,
    weldSize: inp.weld.type==='cjp' ? 'CJP' : frac16(inp.weld.w)+'"',
    caption: 'AISC 360-22 Ch. J/K · DG24 — directly welded flange couple, governing: '+res.governing,
    geometry:{flat:res.vals.flat, overlap:res.vals.overlap, proj:res.vals.proj, cls:res.vals.cls} } };
AREDraw.renderConnection($('schemSvg'), state, {resolvedGeometry:resolvedGeometry});
```
where `resolvedGeometry[wKey]={d,bf,tf,tw}` and `resolvedGeometry[hKey]={H,B,t}` from the current inputs (for custom sections use keys `'W-CUSTOM'` / `'HSS-CUSTOM'` and pass those as the section labels).

- [ ] **Step 4: Run the harness until everything passes**

Run: `npm run test:wthss` — expected `ALL PASS`. Then open the page through the static server for a visual check: add a launch entry if missing (`.claude/launch.json` config `are-calcs-static`: `python tools/nocache_server.py 4188 public`), load `http://localhost:4188/Calcs/W_beam_to_HSS_column_calculator.html`, confirm the toolbar, the schematic and the table render, and screenshot for the record.

- [ ] **Step 5: Commit**

```bash
git --git-dir=/tmp/are-git add public/Calcs/W_beam_to_HSS_column_calculator.html tools/test-w-to-hss.mjs
git --git-dir=/tmp/are-git commit -m "feat(w-to-hss): UI for the merged directly welded calculator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Schematic update in are-draw.js

**Files:**
- Modify: `public/are-draw.js` function `renderWToHss` (≈ lines 1345–1437)

- [ ] **Step 1: Add a check to the harness**

Append to `tools/test-w-to-hss.mjs` before the `no page errors` line:

```js
// ── schematic reflects geometry ─────────────────────────────────────────────
await page.goto('http://calcs.test/Calcs/' + FILE, { waitUntil: 'load' });
await page.waitForSelector('#areBar');
await page.click('button.calc-btn');
const svgTxt = await page.evaluate(() => document.getElementById('schemSvg').textContent);
check('schematic caption no longer cites Eq. K1-7', !/K1-7/.test(svgTxt), svgTxt.slice(0, 200));
check('schematic shows the flat width', /B\s*[−-]\s*3t/.test(svgTxt), svgTxt.slice(0, 300));
check('schematic weld label follows input (CJP)', /CJP/.test(svgTxt), svgTxt.slice(0, 300));
```

Run `npm run test:wthss` — expected: these three FAIL.

- [ ] **Step 2: Edit `renderWToHss`**

In `public/are-draw.js`:
1. Read `var conn = state.connection || {}, geo = conn.geometry || null, weldLbl = conn.weldSize || 'FW';` at the top of the function.
2. Replace the two `weldFillet(... { size: '5/16', ...})` calls with `{ size: weldLbl, side: 'left', tag: false }`.
3. In the section view after the `bp = bf` dimension add:
```js
var flat = geo && geo.flat != null ? geo.flat : (col.B - 3 * col.t);
dimLine(vS, -flat / 2, col.H / 2 + bandH, flat / 2, col.H / 2 + bandH, 'B − 3t = ' + fmtIn(flat), { off: -32 });
if (geo && geo.overlap > 0) {
  var bw = Math.min(beam.bf, col.B) / 2;
  plate(vS, -bw, col.H / 2, geo.overlap, bandH, { highlight: true, hatch: true });
  plate(vS, bw - geo.overlap, col.H / 2, geo.overlap, bandH, { highlight: true, hatch: true });
  leader(vS, bw - geo.overlap / 2, col.H / 2 + bandH, 30, -14, 'corner overlap ' + fmtIn(geo.overlap), { color: st.dim });
}
if (geo && geo.proj > 0) {
  vS.add(rectWorld(vS, col.B / 2, col.H / 2, geo.proj, bandH, { fill: 'none', stroke: st.dim, sw: st.lwObjectThin, dash: '4,3' }), 'dim');
  vS.add(rectWorld(vS, -col.B / 2 - geo.proj, col.H / 2, geo.proj, bandH, { fill: 'none', stroke: st.dim, sw: st.lwObjectThin, dash: '4,3' }), 'dim');
  leader(vS, col.B / 2 + geo.proj / 2, col.H / 2 + bandH, 34, -30, 'projection ' + fmtIn(geo.proj) + ' (not credited)', { color: st.dim });
}
```
Check the local helper signatures (`plate`, `rectWorld`, `leader`, `dimLine`) in the same file before using an option they do not support (e.g. if `rectWorld` has no `dash` option, set `stroke-dasharray` on the returned element instead).
4. Replace the caption line with `captionBox(dwg, st, state, conn.caption || 'AISC 360-22 Ch. J/K · DG24 — directly welded flange couple');`.

Do not change any other renderer. The base-plate and HSS-branch calcs share this file.

- [ ] **Step 3: Run the harness and the sibling tests**

Run: `npm run test:wthss && npm run test:fphss && npm run test:tp` — expected all `ALL PASS`.

- [ ] **Step 4: Commit**

```bash
git --git-dir=/tmp/are-git add public/are-draw.js tools/test-w-to-hss.mjs
git --git-dir=/tmp/are-git commit -m "feat(are-draw): w-to-hss schematic shows flat width, corner overlap, projection; caption from state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Retire the duplicates, registry, redirects, docs

**Files:**
- Delete: `public/Calcs/directly_welded_HSS_connection_calculator.html`, `public/Calcs/hss_connection_complete_calculator.html`
- Modify: `app/lib/calcs.ts` (≈ lines 295–350), `public/are-utils-v2.js` (`HSS_FAMILY`, `CALC_SLUG_MAP`, `injectHSSChooser`), `next.config.ts`, `docs/calc-state-spec.md:27`
- Regenerate: `tools/calc-coverage.csv`
- Copy: `C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/Steel/W_beam_to_HSS_column_calculator.html`

- [ ] **Step 1: Registry entry**

In `app/lib/calcs.ts` replace the `w-to-hss-column` entry with:
```ts
  {
    slug: "w-to-hss-column",
    label: "W-Beam Directly Welded to HSS Column",
    subtitle: "Flange couple on the HSS face — flange local yielding, face plastification & punching, sidewall yielding/crippling/buckling, welds; flange wider than the flat or than B",
    htmlFile: "/Calcs/W_beam_to_HSS_column_calculator.html",
    category: "Connections",
    spec: "AISC 360-22 / DG24",
    status: "ready",
    group: "HSS Connections",
    keywords: ["W-shape", "HSS", "column", "moment", "directly welded", "flange", "local yielding", "plastification", "punching", "sidewall", "crippling", "Be", "K1-1", "K5-4", "Qf", "DG24", "Example 4.3", "Example 6.3", "AISC 360-22", "flare bevel"],
    material: "Steel",
    calcType: "Connections",
    icon: "hss-joint",
  },
```
and delete the `directly-welded-hss` and `hss-connection-complete` entries entirely.

- [ ] **Step 2: are-utils-v2.js**

Remove the two files from `HSS_FAMILY` and `CALC_SLUG_MAP`. In `injectHSSChooser` replace the two directly-welded branches with one:
```js
      + '<div class="ahc-branch"><div class="ahc-label">W-beam moment connection, flanges welded directly to the HSS column face — full limit-state suite (flange local yielding, face plastification/punching, sidewalls, welds; DG24 Ex 4.3 / 2nd ed Ch. 6)</div>'
      + '<a class="ahc-link" href="/calcs/w-to-hss-column" target="_top">W-Beam Directly Welded to HSS Column</a></div>'
```
and add the flange-plated link if it is missing: `<a class="ahc-link" href="/calcs/flange-plated-hss-moment" target="_top">Flange-Plated Moment Connection</a>` under a label "Welded top/bottom flange plates on the HSS face (Ex. II.B-2 + DG24 Table 7-2)".

- [ ] **Step 3: Redirects**

`next.config.ts`:
```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      { source: "/calcs/directly-welded-hss", destination: "/calcs/w-to-hss-column", permanent: true },
      { source: "/calcs/hss-connection-complete", destination: "/calcs/w-to-hss-column", permanent: true },
    ];
  },
};
```

- [ ] **Step 4: Delete the files, regenerate the manifest, fix the doc line, copy to Steel**

```bash
git --git-dir=/tmp/are-git rm public/Calcs/directly_welded_HSS_connection_calculator.html public/Calcs/hss_connection_complete_calculator.html
node tools/derive-coverage.mjs --write
cp public/Calcs/W_beam_to_HSS_column_calculator.html "C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/Steel/W_beam_to_HSS_column_calculator.html"
```
`docs/calc-state-spec.md` line 27: change the reference cell to `AISC 360-22 Ch. J/K, DG24 (flange couple)`.
Grep the repo (excluding `.next`, `node_modules`, `PLAN*.md`, `.parcelb-evidence.mjs`, `tools/qa-report.md`) for `directly_welded_HSS_connection|hss_connection_complete|directly-welded-hss|hss-connection-complete|K1-7` and fix any live reference (docs/are-draw-guide.md may mention the caption — update the text there too).

- [ ] **Step 5: Build and QA**

Run: `npm run lint && npm run build` — expected clean (the removed slugs must not be referenced by any page). Then `npm run qa` — expected all steps pass (the roundtrip step rewrites `tools/qa-report.md`; include it in the commit).

- [ ] **Step 6: Commit**

```bash
git --git-dir=/tmp/are-git add app/lib/calcs.ts public/are-utils-v2.js next.config.ts tools/calc-coverage.csv tools/qa-report.md docs/calc-state-spec.md docs/are-draw-guide.md
git --git-dir=/tmp/are-git commit -m "refactor(hss): retire the two React DG24 Ex 4.3 calcs; single W-to-HSS entry with redirects

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Hand-check record and final verification

**Files:**
- Create: `docs/w-to-hss-direct-weld-hand-check-2026-09.md`

- [ ] **Step 1: Write the hand-check record**

Contents: the reference-verification table from spec §2; for F1, F5, F6 a line-by-line hand calculation with the published value beside the engine value; the 26-003-KAALO reconciliation (legacy 87.94 kip-ft → 360-22 83.27 kip-ft, reason: φ 0.95 → 0.90 on flange local yielding through Be; all other rows non-governing for that geometry, list their φRn); the 6-in handoff case narrative (classification, what the engineer must still detail); the list of items the calculator still leaves to the engineer (web shear, FR stiffness, fatigue/seismic, corner joint preparation, DG24 2nd ed page references unverified).

- [ ] **Step 2: Full verification**

Run: `npm run test:wthss && npm run qa && npm run build` — all green. Load the page on the static server, run the 26-003 inputs in both code modes and confirm 83.3 / 87.9 kip-ft in the banner. Save one calculation through the toolbar to the scratchpad and confirm the saved HTML reloads (hydration keeps `#wsec #Fyb #hsec #Fy #Mu`).

- [ ] **Step 3: Commit**

```bash
git --git-dir=/tmp/are-git add docs/w-to-hss-direct-weld-hand-check-2026-09.md
git --git-dir=/tmp/are-git commit -m "docs(w-to-hss): hand-check record and reference verification

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do **not** push. Nick reviews, then deploys with the are-calcs-deploy skill.

---

## Self-review

- Spec coverage: §3.1 file/URL (Task 1, 4), §3.2 pattern (Task 1, 2), §3.3 code basis (engine PHI, UI `#code`), §3.4 width handling (GEO row, bfc/β, weld corner model), §3.5 every limit state computed (flange() rows with INFO outside band), §3.6 banner (run()), §3.7 weld default CJP (UI), §3.8 commit not push (each task), §4.5 informational rows (END, QF, STIFF, SHEAR, CAP), §5 fixtures (FIXTURES), §6 UI (Task 2), §7 are-draw (Task 3), §8 retirement (Task 4), hand check (Task 5).
- Identifiers used consistently: `window.DWHSS`, `compute`, `runFixtures`, `readInputs`, ids `code wsec bd bbf btf btw bZx Fyb Fub hsec cH cB ct cA cS grade Fy Fu Pu McolU connType lend Mu Vu weldType weldW weldFaces weldProc Fexx kds`, outputs `errOut results sumOut geoOut demOut chkTb schemSvg selftest-result`, row ids `GEO LIM END QF TLY TPL TPS TSY CLY CPL CPS CSY CSC W WCOR WBH WBF WLIM STIFF SHEAR CAP`.
