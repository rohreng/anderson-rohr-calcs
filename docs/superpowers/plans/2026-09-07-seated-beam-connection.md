# Seated Beam Connection Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `public/Calcs/seated_beam_connection_calculator.html`, an ARE web calc for unstiffened, rectangular-stiffened and triangular-stiffened beam seats welded or bolted to a steel support, per AISC 360-22 and the Manual Part 10 / Part 15 procedures, verified against AISC Design Examples II.A-12A/13/14/15/16/22/23 and PCI Ex. 6.6.7.1.

**Architecture:** One self-contained HTML file. Script block 1 = `W_DB` (copied from the HSS-column-bearing calc). Script block 2 = DOM-free engine `window.SEAT` (`compute(inp)`, `FIXTURES`, `runFixtures()`), which both the page's `?selftest=1` runner and a Playwright node test call. Script block 3 = UI (read inputs, show/hide by mode, render, SVG schematic). Last script = `/are-utils-v2.js` (toolbar, Mark/Project, save/load).

**Tech Stack:** plain HTML/CSS/ES5-style JS (no build), Playwright (already a devDependency, used by `tools/test-apa-panel.mjs`), Node 20 test scripts, Next.js registry in `app/lib/calcs.ts`.

**Repo:** `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs` (call it `$R`). Spec: `docs/superpowers/specs/2026-09-07-seated-beam-connection-design.md`. Git: the in-place `.git` sits on a stale feature branch — do **not** commit there. Commits go through the work tree at `/tmp/are-git` (on `main`): copy changed files into it, commit there (Task 8). Until then, save files in `$R` only.

---

## File map

| File | Responsibility |
|---|---|
| `public/Calcs/seated_beam_connection_calculator.html` | the calculator (create) |
| `tools/test-seated-connection.mjs` | node/Playwright fixture test (create) |
| `package.json` | add `test:seat`, append to `qa` (modify) |
| `app/lib/calcs.ts` | registry entry (modify, insert after the `hss-column-bearing-on-beam` entry, ~line 241) |
| `tools/calc-coverage.csv` | regenerate (modify via script) |
| `docs/seated-connection-hand-check-2026-09.md` | fixture provenance (create) |
| `OneDrive - Rohr Engineering/RE CODING/Steel/seated_beam_connection_calculator.html` | copy for Nick's folder (create) |

---

### Task 1: HTML skeleton with all inputs

**Files:**
- Create: `public/Calcs/seated_beam_connection_calculator.html`
- Read for copying: `public/Calcs/hss_column_bearing_on_beam_calculator.html` lines 1–92 (`<!DOCTYPE>` through `</style>`) and lines 319–428 (`let W_DB = {…};`)

- [ ] **Step 1: Create the file head**

Copy lines 1–92 of the HSS-column-bearing calc verbatim into the new file, then change the `<title>` to:

```html
<title>Seated Beam Connection</title>
```

Add inside the `<style>` block, just before `</style>`:

```css
.mode-hide{display:none!important}
.eq-note{font-size:.8em;color:#555;margin-top:6px}
#selftest-result{display:none;white-space:pre-wrap;font-family:Consolas,monospace;font-size:.78em;background:#111827;color:#d1d5db;padding:12px;border-radius:8px;margin-top:16px}
```

- [ ] **Step 2: Write the body markup**

Append after `</head>`:

```html
<body>
<div class="container">
  <div class="header">
    <h1>Seated Beam Connection</h1>
    <p>Unstiffened seat angle &middot; rectangular stiffened seat &middot; triangular (bracket-plate) stiffened seat &mdash; welded or bolted to a column flange, column web or girder web</p>
    <div class="ref-tags">
      <span class="tag">AISC 360-22 LRFD</span>
      <span class="tag">&sect;J2.4 &sect;J3 &sect;J4 &sect;J10</span>
      <span class="tag">Manual Part 10 &middot; Tables 10-5 to 10-8</span>
      <span class="tag">Manual Part 15 &middot; Eq. 15-1 to 15-18</span>
      <span class="tag">Design Examples II.A-12 to 16, 22, 23</span>
    </div>
  </div>
  <div class="toolbar"></div>
  <div class="content">

    <div class="schema-wrap">
      <svg id="schemSvg" viewBox="0 0 1000 400" width="100%" style="max-height:400px" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>

    <div class="blk">
      <h2>1. Configuration</h2>
      <div class="g3">
        <div class="ig"><label>Seat type</label>
          <select id="seatType" onchange="onModeChange()">
            <option value="angle">Unstiffened seat angle (Manual Part 10)</option>
            <option value="rect" selected>Rectangular stiffened seat (Manual Part 10)</option>
            <option value="tri">Triangular stiffened seat (Manual Part 15 bracket plate)</option>
          </select></div>
        <div class="ig"><label>Attachment to support</label>
          <select id="attach" onchange="onModeChange()">
            <option value="welded" selected>Welded</option>
            <option value="bolted">Bolted</option>
          </select></div>
        <div class="ig"><label>Support</label>
          <select id="support" onchange="onModeChange()">
            <option value="colFlange" selected>Column flange</option>
            <option value="colWeb">Column web</option>
            <option value="beamWeb">Girder / beam web</option>
          </select></div>
        <div class="ig"><label>Support thickness at seat, t<sub>sup</sub> <span class="unit">(in)</span></label><input type="number" id="supT" value="0.710" step="0.005"></div>
        <div class="ig"><label>F<sub>u</sub> support <span class="unit">(ksi)</span></label><input type="number" id="FuSup" value="65"></div>
      </div>
      <label class="chk-inline" id="bothSidesWrap"><input type="checkbox" id="bothSides"> Seats on both sides of the web (doubles the base-metal demand, Manual Eq. 9-3)</label>
    </div>

    <div class="blk">
      <h2>2. Supported Beam <span class="badge">A992, F<sub>y</sub>=50 default</span></h2>
      <div class="g3">
        <div class="ig"><label>W-Section</label>
          <select id="wsec" onchange="onBeamChange()"><option value="custom">&mdash; Custom (enter below) &mdash;</option></select></div>
        <div class="ig"><label>d <span class="unit">(in)</span></label><input type="number" id="bd" value="21.1" step="0.01"></div>
        <div class="ig"><label>t<sub>w</sub> <span class="unit">(in)</span></label><input type="number" id="btw" value="0.430" step="0.005"></div>
        <div class="ig"><label>t<sub>f</sub> <span class="unit">(in)</span></label><input type="number" id="btf" value="0.685" step="0.005"></div>
        <div class="ig"><label>k<sub>des</sub> <span class="unit">(in)</span></label><input type="number" id="bkdes" value="1.19" step="0.005"></div>
        <div class="ig"><label>b<sub>f</sub> <span class="unit">(in)</span></label><input type="number" id="bbf" value="8.27" step="0.01"></div>
        <div class="ig"><label>F<sub>y</sub> beam <span class="unit">(ksi)</span></label><input type="number" id="FyBeam" value="50"></div>
        <div class="ig"><label>F<sub>u</sub> beam <span class="unit">(ksi)</span></label><input type="number" id="FuBeam" value="65"></div>
      </div>
      <div class="g3" style="margin-top:12px">
        <div class="ig"><label>R<sub>u</sub> factored end reaction <span class="unit">(kips)</span></label><input type="number" id="Ru" value="125" step="0.1"></div>
        <div class="ig"><label>Setback, beam end to support face <span class="unit">(in)</span></label><input type="number" id="setback" value="0.5" step="0.125"></div>
        <div class="ig"><label>Possible underrun <span class="unit">(in)</span></label><input type="number" id="underrun" value="0.25" step="0.125"></div>
      </div>
      <div id="wHint" class="subnote">Reaction is at the beam end, so the end-of-member branches of &sect;J10.2 and &sect;J10.3 apply. Setback + underrun = 3/4 in. is the Manual Part 10 assumption.</div>
    </div>

    <div class="blk" id="blkAngle">
      <h2>3. Seat Angle <span class="badge">Manual Tables 10-5 / 10-6</span></h2>
      <div class="g3">
        <div class="ig"><label>Vertical leg <span class="unit">(in)</span></label><input type="number" id="angLeg" value="8" step="0.5"></div>
        <div class="ig"><label>Outstanding leg, OSL <span class="unit">(in)</span></label><input type="number" id="angOSL" value="4" step="0.5"></div>
        <div class="ig"><label>Thickness t <span class="unit">(in)</span></label><input type="number" id="angT" value="0.625" step="0.0625"></div>
        <div class="ig"><label>Angle length L <span class="unit">(in)</span></label><input type="number" id="angL" value="8" step="0.5"></div>
        <div class="ig"><label>l<sub>b,req</sub> for OSL flexure <span class="unit">(in, blank = l<sub>b,min</sub>)</span></label><input type="number" id="lbReq" value="" step="0.0625" placeholder="auto"></div>
      </div>
      <div class="subnote">Critical section for OSL bending at the toe of the fillet, 3/8 in. from the face of the vertical leg; reaction at the midpoint of l<sub>b,req</sub> measured from the beam end (Manual Part 10).</div>
    </div>

    <div class="blk" id="blkStiff">
      <h2>3. Stiffened Seat <span class="badge" id="stiffBadge">Manual Part 15</span></h2>
      <div class="g3">
        <div class="ig"><label>Stiffener projection W (= b) <span class="unit">(in)</span></label><input type="number" id="stW" value="7" step="0.25"></div>
        <div class="ig" id="igStL"><label>Stiffener length L (vertical) <span class="unit">(in)</span></label><input type="number" id="stL" value="15" step="0.5"></div>
        <div class="ig" id="igStA"><label>Stiffener height a at support <span class="unit">(in)</span></label><input type="number" id="stA" value="15" step="0.5"></div>
        <div class="ig"><label>Stiffener thickness t <span class="unit">(in)</span></label><input type="number" id="stT" value="0.625" step="0.0625"></div>
        <div class="ig"><label>Number of stiffener plates</label><input type="number" id="stN" value="1" min="1" step="1"></div>
        <div class="ig"><label>Seat plate thickness <span class="unit">(in)</span></label><input type="number" id="spT" value="0.375" step="0.0625"></div>
        <div class="ig"><label>Seat plate width (along support) <span class="unit">(in)</span></label><input type="number" id="spB" value="9" step="0.5"></div>
      </div>
      <div class="subnote" id="stiffNote"></div>
    </div>

    <div class="blk">
      <h2>4. Seat Material &amp; Load Position</h2>
      <div class="g3">
        <div class="ig"><label>F<sub>y</sub> seat / stiffener <span class="unit">(ksi)</span></label><input type="number" id="FySeat" value="36"></div>
        <div class="ig"><label>F<sub>u</sub> seat / stiffener <span class="unit">(ksi)</span></label><input type="number" id="FuSeat" value="58"></div>
        <div class="ig"><label>Reaction eccentricity e from support face <span class="unit">(in, blank = 0.8&times;projection)</span></label><input type="number" id="eSeat" value="" step="0.05" placeholder="auto"></div>
      </div>
      <div class="subnote">Manual Part 10 places the reaction at 0.8&times;W for stiffened seats (rotation moves the contact toward the seat edge); the same 0.8&times;OSL reproduces Table 10-6 weld strengths for seat angles.</div>
    </div>

    <div class="blk" id="blkWeld">
      <h2>5. Welds to Support <span class="badge">&sect;J2.4, E70XX default</span></h2>
      <div class="g3">
        <div class="ig"><label>Fillet leg size w <span class="unit">(in)</span></label><input type="number" id="wSize" value="0.3125" step="0.0625"></div>
        <div class="ig"><label>F<sub>EXX</sub> <span class="unit">(ksi)</span></label><input type="number" id="Fexx" value="70"></div>
        <div class="ig"><label>Vertical weld length per line <span class="unit">(in, blank = vertical dimension)</span></label><input type="number" id="wLen" value="" step="0.25" placeholder="auto"></div>
        <div class="ig"><label>Top return per line <span class="unit">(in, blank = 0.2&times;length)</span></label><input type="number" id="wRet" value="" step="0.25" placeholder="auto"></div>
      </div>
      <label class="chk-inline"><input type="checkbox" id="wDir"> Apply &sect;J2.4 directional strength increase to the resultant</label>
      <div class="subnote">Two L-shaped weld lines (one each side of the stiffener, or one at each end of the angle's vertical leg): vertical length plus a top return. Elastic line-weld model, bending stress at the top fiber (compression side bears on the support), shear on the vertical welds. This is the basis of Manual Tables 10-6 and 10-8 (Blodgett &sect;5.3).</div>
    </div>

    <div class="blk" id="blkBolt">
      <h2>6. Bolts to Support <span class="badge">&sect;J3, shear only per Manual Part 10</span></h2>
      <div class="g3">
        <div class="ig"><label>Bolt grade / thread condition</label>
          <select id="bGrade">
            <option value="A307">A307</option>
            <option value="A-N" selected>Group A (A325), N</option>
            <option value="A-X">Group A (A325), X</option>
            <option value="B-N">Group B (A490), N</option>
            <option value="B-X">Group B (A490), X</option>
          </select></div>
        <div class="ig"><label>Diameter d<sub>b</sub> <span class="unit">(in)</span></label><input type="number" id="bDia" value="0.75" step="0.125"></div>
        <div class="ig"><label>Number of bolts</label><input type="number" id="bN" value="4" min="1" step="1"></div>
        <div class="ig"><label>Rows (vertical)</label><input type="number" id="bRows" value="2" min="1" step="1"></div>
        <div class="ig"><label>Vertical pitch s <span class="unit">(in)</span></label><input type="number" id="bPitch" value="3" step="0.25"></div>
        <div class="ig"><label>Gage g <span class="unit">(in)</span></label><input type="number" id="bGage" value="5.5" step="0.25"></div>
        <div class="ig"><label>Edge distance to loaded (top) edge of seat element, l<sub>e</sub> <span class="unit">(in)</span></label><input type="number" id="bLe" value="1.25" step="0.125"></div>
        <div class="ig"><label>Edge distance on support <span class="unit">(in, blank = not near an edge)</span></label><input type="number" id="bLeSup" value="" step="0.125" placeholder="none"></div>
      </div>
      <label class="chk-inline"><input type="checkbox" id="bTension"> Add bolt tension from R<sub>u</sub>&middot;e (elastic, neutral axis at bottom edge, &sect;J3.7) &mdash; Manual practice is shear only</label>
    </div>

    <button class="calc-btn" onclick="run()">Run All Checks</button>
    <div id="errOut"></div>

    <div class="results" id="results">
      <div id="sumOut"></div>
      <div class="dem-grid" id="demOut"></div>
      <div class="blk"><h2>Section Properties</h2><div id="propOut"></div></div>
      <div class="blk">
        <h2>Design Checks</h2>
        <table class="chk-table">
          <thead><tr><th>Check</th><th>Reference</th><th>Demand</th><th>Capacity</th><th>D/C</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody id="chkTb"></tbody>
        </table>
        <div id="reviewOut"></div>
      </div>
      <div class="note-box" id="noteOut"></div>
      <div class="footer-prov"><b>Basis.</b> AISC 360-22 LRFD; AISC Steel Construction Manual Part 10 (seated connections) and Part 15 (bracket plates) as documented in AISC Design Examples v15.1 II.A-12A, 13, 14, 15, 16, 22, 23; table strengths reverse-checked against those examples. PCI Design Handbook 7th Ed. Eq. 6-47/6-48 shown as a reference row only. Not checked: top stability angle, beam-to-seat bolts, column-web local limits for stiffened seats on webs, seat plate bending, ASD.</div>
    </div>
    <pre id="selftest-result"></pre>
  </div>
</div>
```

- [ ] **Step 3: Add the W_DB script block**

Append after the container `</div>`:

```html
<script>
/* AISC v16.0 W-shapes: W_DB[label] = [A, d, bf, tf, tw, kdes, Zx, h, Sx] — copied verbatim from hss_column_bearing_on_beam_calculator.html */
```

then paste lines 319–428 of `hss_column_bearing_on_beam_calculator.html` (the `let W_DB = { … };` object) verbatim, then `</script>`.

- [ ] **Step 4: Add placeholder engine and UI script tags and the utils tag**

```html
<script>
/* ENGINE — filled in Task 2 */
</script>
<script>
/* UI — filled in Task 4 */
</script>
<script src="/are-utils-v2.js" data-no-theme></script>
</body>
</html>
```

- [ ] **Step 5: Verify the file parses**

Run from `$R`:
```bash
node -e "const s=require('fs').readFileSync('public/Calcs/seated_beam_connection_calculator.html','utf8'); const m=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)]; m.forEach((x,i)=>new Function(x[1])); console.log('scripts ok:', m.length, 'W_DB shapes:', (s.match(/^  \"W\d+X\d+\":\[/gm)||[]).length)"
```
Expected: `scripts ok: 3 W_DB shapes: 108`

---

### Task 2: Engine `window.SEAT`

**Files:**
- Modify: `public/Calcs/seated_beam_connection_calculator.html` (replace the `/* ENGINE */` script block)

- [ ] **Step 1: Write the engine**

Replace the engine `<script>` contents with:

```js
/* ============================================================
   SEAT engine — DOM-free. window.SEAT.compute(inp) -> result.
   inp shape (all numbers, inches/kips/ksi):
   { seatType:'angle'|'rect'|'tri', attach:'welded'|'bolted',
     support:'colFlange'|'colWeb'|'beamWeb', bothSides:bool,
     beam:{label,d,tw,tf,kdes,bf,Fy,Fu}, Ru, setback, underrun,
     FySeat, FuSeat, eSeat:null|num,
     angle:{leg,osl,t,L}, lbReq:null|num,
     st:{W,L,A,t,n}, sp:{t,B},
     weld:{w,Fexx,len:null|num,ret:null|num,dir:bool}, sup:{t,Fu},
     bolt:{grade,d,n,rows,pitch,gage,le,leSup:null|num,tension:bool} }
   ============================================================ */
function f1(v){return isFinite(v)?v.toFixed(1):'N/A'}
function f2(v){return isFinite(v)?v.toFixed(2):'N/A'}
function f3(v){return isFinite(v)?v.toFixed(3):'N/A'}
function f4(v){return isFinite(v)?v.toFixed(4):'N/A'}
function fr(n,d){return '<span class="mfr"><span class="mn">'+n+'</span><span class="md">'+d+'</span></span>'}
function ov(x){return '&radic;<span style="text-decoration:overline;padding:0 3px">'+x+'</span>'}

window.SEAT = (function(){
  'use strict';
  var E = 29000;
  var BOLT = {
    'A307': {label:'ASTM A307',                                  Fnt:45,  Fnv:27},
    'A-N':  {label:'Group A (A325/F1852), threads included (N)', Fnt:90,  Fnv:54},
    'A-X':  {label:'Group A (A325/F1852), threads excluded (X)', Fnt:90,  Fnv:68},
    'B-N':  {label:'Group B (A490/F2280), threads included (N)', Fnt:113, Fnv:68},
    'B-X':  {label:'Group B (A490/F2280), threads excluded (X)', Fnt:113, Fnv:84}
  };
  function holeDia(d){ if (d <= 0.875+1e-9) return d+0.0625; if (d <= 1.0+1e-9) return 1.125; return d+0.125; }
  function minFillet(t){ return t<=0.25?0.125 : t<=0.5?0.1875 : t<=0.75?0.25 : 0.3125; }
  function maxFillet(t){ return t<0.25 ? t : t-0.0625; }
  function sixteenths(w){ return w*16; }
  function isNum(v){ return typeof v==='number' && isFinite(v); }

  // ---- detail-panel helpers
  function H(t){ return '<div class="cref-hdr">'+t+'</div><div class="cbox">'; }
  function R(h){ return '<div class="mrow">'+h+'</div>'; }
  function I(h){ return '<div class="mrow ind">'+h+'</div>'; }
  function V(x,u){ return '<span class="cval">'+x+(u?' '+u:'')+'</span>'; }
  function SEP(){ return '<hr class="csep">'; }
  function DC(dem,cap,dc){ return SEP()+R('D/C = '+fr(dem,cap)+' = '+V(f3(dc)))+'</div>'; }
  function END(){ return '</div>'; }

  function mk(section,id,name,ref,demand,capacity,dc,det,opts){
    opts = opts||{};
    var status;
    if (opts.status) status = opts.status;
    else if (dc===null || !isFinite(dc)) status = 'N/A';
    else status = dc<=1.0 ? 'PASS' : 'FAIL';
    return {section:section, id:id, name:name, ref:ref, demand:demand, capacity:capacity,
            dc:(dc===null||!isFinite(dc))?null:dc, status:status, note:opts.note||'', det:det, informational:!!opts.informational};
  }

  // ---- validation
  function validate(inp){
    var err = [];
    function req(v,label){ if (!isNum(v) || v<=0) err.push(label+' must be a positive number.'); }
    var b = inp.beam;
    req(b.d,'Beam d'); req(b.tw,'Beam t_w'); req(b.tf,'Beam t_f'); req(b.kdes,'Beam k_des'); req(b.Fy,'Beam F_y'); req(b.Fu,'Beam F_u');
    req(inp.Ru,'R_u');
    if (!isNum(inp.setback)||inp.setback<0) err.push('Setback must be a number >= 0.');
    if (!isNum(inp.underrun)||inp.underrun<0) err.push('Underrun must be a number >= 0.');
    req(inp.FySeat,'Seat F_y'); req(inp.FuSeat,'Seat F_u');
    if (inp.eSeat!==null && (!isNum(inp.eSeat)||inp.eSeat<=0)) err.push('Eccentricity e must be blank or a positive number.');
    var ext = inp.setback+inp.underrun;
    if (inp.seatType==='angle'){
      req(inp.angle.leg,'Vertical leg'); req(inp.angle.osl,'Outstanding leg'); req(inp.angle.t,'Angle thickness'); req(inp.angle.L,'Angle length');
      if (isNum(inp.angle.osl) && inp.angle.osl<=ext) err.push('Outstanding leg must exceed setback + underrun ('+f3(ext)+' in).');
      if (inp.lbReq!==null && (!isNum(inp.lbReq)||inp.lbReq<=0)) err.push('l_b,req must be blank or positive.');
    } else {
      req(inp.st.W,'Stiffener projection W'); req(inp.st.t,'Stiffener thickness');
      if (inp.seatType==='rect') req(inp.st.L,'Stiffener length L'); else req(inp.st.A,'Stiffener height a');
      if (!isNum(inp.st.n)||inp.st.n<1||inp.st.n%1) err.push('Number of stiffener plates must be an integer >= 1.');
      if (isNum(inp.st.W) && inp.st.W<=ext) err.push('Stiffener projection W must exceed setback + underrun ('+f3(ext)+' in).');
    }
    if (inp.attach==='welded'){
      req(inp.weld.w,'Weld size'); req(inp.weld.Fexx,'F_EXX'); req(inp.sup.t,'Support thickness'); req(inp.sup.Fu,'Support F_u');
      if (inp.weld.len!==null && (!isNum(inp.weld.len)||inp.weld.len<=0)) err.push('Weld length must be blank or positive.');
      if (inp.weld.ret!==null && (!isNum(inp.weld.ret)||inp.weld.ret<0)) err.push('Weld return must be blank or >= 0.');
    } else {
      var bo = inp.bolt;
      if (!BOLT[bo.grade]) err.push('Unknown bolt grade.');
      req(bo.d,'Bolt diameter'); req(bo.pitch,'Bolt pitch'); req(bo.le,'Bolt edge distance'); req(inp.sup.t,'Support thickness'); req(inp.sup.Fu,'Support F_u');
      if (!isNum(bo.n)||bo.n<1||bo.n%1) err.push('Number of bolts must be an integer >= 1.');
      if (!isNum(bo.rows)||bo.rows<1||bo.rows%1) err.push('Rows must be an integer >= 1.');
      if (isNum(bo.n)&&isNum(bo.rows)&&bo.rows>0&&(bo.n/bo.rows)%1) err.push('Bolts per row (n / rows) must be a whole number.');
      if (isNum(bo.d)&&isNum(bo.le)&&bo.le<=holeDia(bo.d)/2) err.push('Edge distance must exceed half the hole diameter.');
      if (bo.leSup!==null && (!isNum(bo.leSup)||bo.leSup<=0)) err.push('Support edge distance must be blank or positive.');
    }
    return err;
  }

  // ---- AISC 360-22 J10.2 / J10.3, end-of-member branches
  function beamBearing(b, Ru){
    var Fy=b.Fy, tw=b.tw, tf=b.tf, d=b.d, k=b.kdes;
    var R1 = 2.5*k*Fy*tw, R2 = Fy*tw;                        // phi = 1.00
    var lbWLY = Math.max(0, (Ru-R1)/R2);
    var K = Math.sqrt(E*Fy*tf/tw), rho = Math.pow(tw/tf,1.5), phi = 0.75;
    var base = phi*0.40*tw*tw*K;
    var x = Ru/base - 1;
    var lb5a = x>0 ? x*d/(3*rho) : 0;
    var lb5b = x>0 ? (x/rho+0.2)*d/4 : 0;
    var lbWLC, branch;
    if (x<=0){ lbWLC=0; branch='none (R_u below the l_b = 0 strength)'; }
    else if (lb5a/d<=0.2){ lbWLC=lb5a; branch='J10-5a (l_b/d &le; 0.2)'; }
    else if (lb5b/d>0.2){ lbWLC=lb5b; branch='J10-5b (l_b/d &gt; 0.2)'; }
    else { lbWLC=Math.max(lb5a,lb5b); branch='J10-5a/5b envelope'; }
    var lbMin = Math.max(lbWLY, lbWLC, k);
    return {R1:R1,R2:R2,lbWLY:lbWLY,K:K,rho:rho,base:base,x:x,lb5a:lb5a,lb5b:lb5b,lbWLC:lbWLC,branch:branch,lbMin:lbMin};
  }
  function wlyEnd(b, lb){ return 1.00*b.Fy*b.tw*(2.5*b.kdes+lb); }
  function wlcEnd(b, lb){
    var K=Math.sqrt(E*b.Fy*b.tf/b.tw), rho=Math.pow(b.tw/b.tf,1.5), r=lb/b.d;
    var term = r<=0.2 ? 3*r*rho : (4*r-0.2)*rho;
    return {phiRn:0.75*0.40*b.tw*b.tw*(1+term)*K, eq:(r<=0.2?'J10-5a':'J10-5b'), term:term, K:K, rho:rho, r:r};
  }

  // ---- elastic L-shaped weld group (basis of Manual Tables 10-6 / 10-8)
  function weldGroup(l, h, e, Ru, w, Fexx, dir){
    var ybar = (l*l/2 + h*l)/(l+h);
    var Iw = l*l*l/12 + l*Math.pow(l/2-ybar,2) + h*Math.pow(l-ybar,2);
    var cTop = l-ybar, Stop = Iw/cTop, S = 2*Stop, Av = 2*l;
    var fb = Ru*e/S, fv = Ru/Av, frr = Math.sqrt(fb*fb+fv*fv);
    var theta = Math.atan2(fb,fv)*180/Math.PI;
    var kt = dir ? 1+0.5*Math.pow(Math.sin(theta*Math.PI/180),1.5) : 1;
    var unit = 0.75*0.6*Fexx*0.707;              // kip/in per inch of leg
    var phirn = unit*w*kt;
    var Dreq = 16*frr/(unit*kt);
    var phiRn = frr>0 ? phirn/(frr/Ru) : Infinity;
    return {ybar:ybar,I:Iw,cTop:cTop,Stop:Stop,S:S,Av:Av,fb:fb,fv:fv,fr:frr,theta:theta,kt:kt,unit:unit,phirn:phirn,Dreq:Dreq,phiRn:phiRn,dc:frr/phirn};
  }

  // ---- Part 15 bracket-plate local buckling
  function bracketQ(bp, ap, t, Fy){
    var lam = (bp/t)*Math.sqrt(Fy)/(5*Math.sqrt(475+1120*Math.pow(bp/ap,2)));
    var Q = lam<=0.70 ? 1.0 : lam<=1.41 ? 1.34-0.486*lam : 1.30/(lam*lam);
    return {lam:lam, Q:Q, Fcr:Q*Fy, regime: lam<=0.70?'&lambda; &le; 0.70 &rarr; Q = 1.0 (Eq. 15-13 yielding)' : lam<=1.41?'0.70 &lt; &lambda; &le; 1.41 &rarr; Q = 1.34 &minus; 0.486&lambda; (Eq. 15-15)':'&lambda; &gt; 1.41 &rarr; Q = 1.30/&lambda;&sup2; (Eq. 15-16)'};
  }

  function compute(inp){
    var errors = validate(inp);
    if (errors.length) return {ok:false, errors:errors, checks:[], vals:{}};
    var C = [], vals = {};
    var st=inp.seatType, at=inp.attach, b=inp.beam, Ru=inp.Ru, ext=inp.setback+inp.underrun;
    var Fy=inp.FySeat, Fu=inp.FuSeat;
    var isAngle=st==='angle', isRect=st==='rect', isTri=st==='tri';
    var proj = isAngle ? inp.angle.osl : inp.st.W;
    var vlen = isAngle ? inp.angle.leg : (isRect ? inp.st.L : inp.st.A);
    var tSeat = isAngle ? inp.angle.t : inp.st.t;
    var nPl = isAngle ? 1 : inp.st.n;
    var e = inp.eSeat!==null ? inp.eSeat : 0.8*proj;
    vals.e=e; vals.eAuto=inp.eSeat===null; vals.proj=proj; vals.vlen=vlen; vals.tSeat=tSeat; vals.nPl=nPl;

    // ===== 1. Beam
    var bb = beamBearing(b, Ru);
    var lbProv = proj-ext;
    vals.bb=bb; vals.lbProv=lbProv;
    var det = H('AISC 360-22 &sect;J10.2 / &sect;J10.3 &mdash; minimum bearing length at the beam end (Manual Eq. 9-46, 9-48, 9-49 form)')
      + R('Web local yielding, Eq. J10-3 (&phi; = 1.00): l<sub>b,min</sub> = '+fr('R<sub>u</sub>','F<sub>yw</sub>t<sub>w</sub>')+' &minus; 2.5k<sub>des</sub>')
      + I('= '+fr(f2(Ru),f2(b.Fy)+' &times; '+f3(b.tw))+' &minus; 2.5 &times; '+f3(b.kdes)+' = '+V(f3(bb.lbWLY),'in')+(bb.lbWLY===0?' (negative &rarr; 0)':''))
      + R('Web local crippling, Eq. J10-5a/b (&phi; = 0.75): K = '+ov('EF<sub>yw</sub>t<sub>f</sub>/t<sub>w</sub>')+' = '+f1(bb.K)+' ksi, (t<sub>w</sub>/t<sub>f</sub>)<sup>1.5</sup> = '+f4(bb.rho))
      + I('R<sub>u</sub>/(&phi;0.40t<sub>w</sub>&sup2;K) &minus; 1 = '+fr(f2(Ru),f2(bb.base))+' &minus; 1 = '+f4(bb.x))
      + I('J10-5a: l<sub>b</sub> = '+f4(bb.x)+' &times; d / [3(t<sub>w</sub>/t<sub>f</sub>)<sup>1.5</sup>] = '+f3(bb.lb5a)+' in (l<sub>b</sub>/d = '+f3(bb.lb5a/b.d)+')')
      + I('J10-5b: l<sub>b</sub> = ['+f4(bb.x)+'/(t<sub>w</sub>/t<sub>f</sub>)<sup>1.5</sup> + 0.2] &times; d/4 = '+f3(bb.lb5b)+' in (l<sub>b</sub>/d = '+f3(bb.lb5b/b.d)+')')
      + I('Governing branch: '+bb.branch+' &rarr; l<sub>b,WLC</sub> = '+V(f3(bb.lbWLC),'in'))
      + R('l<sub>b,min</sub> = max(l<sub>b,WLY</sub>, l<sub>b,WLC</sub>, k<sub>des</sub>) = max('+f3(bb.lbWLY)+', '+f3(bb.lbWLC)+', '+f3(b.kdes)+') = '+V(f3(bb.lbMin),'in'))
      + R('Bearing provided = projection &minus; setback &minus; underrun = '+f3(proj)+' &minus; '+f3(ext)+' = '+V(f3(lbProv),'in'))
      + DC('l<sub>b,min</sub> = '+f3(bb.lbMin), 'l<sub>b,prov</sub> = '+f3(lbProv), bb.lbMin/lbProv);
    C.push(mk('Supported beam','lbmin','Bearing length l<sub>b</sub>','AISC 360-22 &sect;J10.2, &sect;J10.3; Manual Part 10','l<sub>b,min</sub> = '+f3(bb.lbMin)+' in','l<sub>b,prov</sub> = '+f3(lbProv)+' in',bb.lbMin/lbProv,det,{note:bb.branch}));

    var wly = wlyEnd(b, lbProv);
    det = H('AISC 360-22 &sect;J10.2 Eq. J10-3 &mdash; web local yielding at l<sub>b</sub> = '+f3(lbProv)+' in (end of member)')
      + R('&phi;R<sub>n</sub> = 1.00 &times; F<sub>yw</sub>t<sub>w</sub>(2.5k<sub>des</sub> + l<sub>b</sub>)')
      + I('= 1.00 &times; '+f2(b.Fy)+' &times; '+f3(b.tw)+' &times; (2.5 &times; '+f3(b.kdes)+' + '+f3(lbProv)+') = '+V(f2(wly),'kips'))
      + DC('R<sub>u</sub> = '+f2(Ru),'&phi;R<sub>n</sub> = '+f2(wly),Ru/wly);
    C.push(mk('Supported beam','wly','Web local yielding','AISC 360-22 &sect;J10.2','R<sub>u</sub> = '+f2(Ru)+' k','&phi;R<sub>n</sub> = '+f2(wly)+' k',Ru/wly,det));

    var wlc = wlcEnd(b, lbProv);
    det = H('AISC 360-22 &sect;J10.3 Eq. '+wlc.eq+' &mdash; web local crippling at l<sub>b</sub> = '+f3(lbProv)+' in (end of member, l<sub>b</sub>/d = '+f3(wlc.r)+')')
      + R('&phi;R<sub>n</sub> = 0.75 &times; 0.40t<sub>w</sub>&sup2;[1 + '+(wlc.r<=0.2?'3(l<sub>b</sub>/d)':'(4l<sub>b</sub>/d &minus; 0.2)')+'(t<sub>w</sub>/t<sub>f</sub>)<sup>1.5</sup>]'+ov('EF<sub>yw</sub>t<sub>f</sub>/t<sub>w</sub>')+'Q<sub>f</sub>')
      + I('= 0.75 &times; 0.40 &times; '+f3(b.tw)+'&sup2; &times; [1 + '+f4(wlc.term)+'] &times; '+f1(wlc.K)+' &times; 1.0 = '+V(f2(wlc.phiRn),'kips'))
      + DC('R<sub>u</sub> = '+f2(Ru),'&phi;R<sub>n</sub> = '+f2(wlc.phiRn),Ru/wlc.phiRn);
    C.push(mk('Supported beam','wlc','Web local crippling','AISC 360-22 &sect;J10.3','R<sub>u</sub> = '+f2(Ru)+' k','&phi;R<sub>n</sub> = '+f2(wlc.phiRn)+' k',Ru/wlc.phiRn,det,{note:wlc.eq}));

    // ===== 2. Seat
    var P = Ru/nPl;
    if (isAngle){
      var A=inp.angle, lbReq = inp.lbReq!==null ? inp.lbReq : bb.lbMin;
      var ef = ext + lbReq/2 - A.t - 0.375;
      var phiMn = 0.90*Fy*A.L*A.t*A.t/4, Mu = Ru*ef;
      vals.lbReq=lbReq; vals.ef=ef; vals.phiMnOSL=phiMn; vals.phiRnOSL = ef>0 ? phiMn/ef : Infinity;
      det = H('AISC Manual Part 10, Tables 10-5/10-6 basis &mdash; outstanding leg flexural yielding at the toe of the fillet')
        + R('e<sub>f</sub> = setback + underrun + l<sub>b,req</sub>/2 &minus; t &minus; 3/8 = '+f3(ext)+' + '+f3(lbReq)+'/2 &minus; '+f3(A.t)+' &minus; 0.375 = '+V(f4(ef),'in'))
        + R('M<sub>u</sub> = R<sub>u</sub>e<sub>f</sub> = '+f2(Ru)+' &times; '+f4(ef)+' = '+V(f2(Mu),'kip-in'))
        + R('&phi;M<sub>n</sub> = 0.90F<sub>y</sub>Lt&sup2;/4 = 0.90 &times; '+f1(Fy)+' &times; '+f2(A.L)+' &times; '+f3(A.t)+'&sup2;/4 = '+V(f2(phiMn),'kip-in'))
        + R('Equivalent seat strength &phi;R<sub>n</sub> = &phi;M<sub>n</sub>/e<sub>f</sub> = '+V(f1(vals.phiRnOSL),'kips')+' (compare Table 10-5/10-6)')
        + (ef>0 ? DC('M<sub>u</sub> = '+f2(Mu),'&phi;M<sub>n</sub> = '+f2(phiMn),Mu/phiMn) : SEP()+R('e<sub>f</sub> &le; 0: critical section lies inside the fillet &rarr; flexure does not govern')+END());
      C.push(mk('Seat angle','oslFlex','Outstanding leg flexural yielding','AISC Manual Part 10 (Table 10-5/10-6)','M<sub>u</sub> = '+f2(Mu)+' k-in','&phi;M<sub>n</sub> = '+f2(phiMn)+' k-in', ef>0?Mu/phiMn:null, det, ef>0?{}:{status:'N/A',note:'e_f <= 0'}));
      var phiVn = 1.00*0.6*Fy*A.L*A.t;
      det = H('AISC 360-22 &sect;J4.2 Eq. J4-3 &mdash; outstanding leg shear yielding')
        + R('&phi;V<sub>n</sub> = 1.00 &times; 0.6F<sub>y</sub>Lt = 0.6 &times; '+f1(Fy)+' &times; '+f2(A.L)+' &times; '+f3(A.t)+' = '+V(f2(phiVn),'kips'))
        + DC('R<sub>u</sub> = '+f2(Ru),'&phi;V<sub>n</sub> = '+f2(phiVn),Ru/phiVn);
      C.push(mk('Seat angle','oslShear','Outstanding leg shear yielding','AISC 360-22 &sect;J4.2','R<sub>u</sub> = '+f2(Ru)+' k','&phi;V<sub>n</sub> = '+f2(phiVn)+' k',Ru/phiVn,det));
      var oslNeed = lbReq+ext;
      det = H('AISC Manual Part 10 &mdash; outstanding leg length')
        + R('Required OSL = l<sub>b,req</sub> + setback + underrun = '+f3(lbReq)+' + '+f3(ext)+' = '+V(f3(oslNeed),'in'))
        + DC('required '+f3(oslNeed),'OSL = '+f3(A.osl),oslNeed/A.osl);
      C.push(mk('Seat angle','oslLen','Outstanding leg length','AISC Manual Part 10','req. '+f3(oslNeed)+' in','OSL = '+f3(A.osl)+' in',oslNeed/A.osl,det));
      if (A.L < b.bf) C.push(mk('Seat angle','angLenNote','Angle length vs beam flange','AISC Manual Part 10','L = '+f2(A.L)+' in','b<sub>f</sub> = '+f2(b.bf)+' in',null,H('Detailing note')+R('Seat angle is shorter than the beam flange width. Acceptable when the beam-to-seat bolts fit the gage; confirm detailing.')+END(),{status:'INFO',note:'detailing',informational:true}));
    } else {
      var S=inp.st;
      var Wneed = bb.lbMin+ext;
      det = H('AISC Manual Part 10 &mdash; required stiffener width (Design Example II.A-14 form)')
        + R('W<sub>min</sub> = l<sub>b,min</sub> + setback + underrun = '+f3(bb.lbMin)+' + '+f3(ext)+' = '+V(f3(Wneed),'in'))
        + R('Check l<sub>b</sub>/d = (W &minus; '+f3(ext)+')/d = '+f3(lbProv/b.d)+' vs. crippling branch: '+bb.branch)
        + DC('W<sub>min</sub> = '+f3(Wneed),'W = '+f3(S.W),Wneed/S.W);
      C.push(mk('Stiffened seat','stW','Stiffener width W','AISC Manual Part 10','W<sub>min</sub> = '+f3(Wneed)+' in','W = '+f3(S.W)+' in',Wneed/S.W,det));
      var tWeb = b.tw*b.Fy/Fy;
      det = H('AISC Manual Part 10 &mdash; stiffener thickness not less than the beam web, adjusted for yield strength')
        + R('t<sub>min</sub> = t<sub>w</sub>(F<sub>y,beam</sub>/F<sub>y,stiff</sub>) = '+f3(b.tw)+' &times; '+f1(b.Fy)+'/'+f1(Fy)+' = '+V(f3(tWeb),'in'))
        + DC('t<sub>min</sub> = '+f3(tWeb),'t = '+f3(S.t),tWeb/S.t);
      C.push(mk('Stiffened seat','stTweb','Stiffener thickness vs beam web','AISC Manual Part 10','t<sub>min</sub> = '+f3(tWeb)+' in','t = '+f3(S.t)+' in',tWeb/S.t,det));
      if (at==='welded'){
        var w=inp.weld.w, Fexx=inp.weld.Fexx, tDev, rule;
        if (Math.abs(Fexx-70)<1e-9 && Fy<=36+1e-9){ tDev=2*w; rule='F<sub>y</sub> &le; 36 ksi, E70: t<sub>min</sub> = 2w'; }
        else if (Math.abs(Fexx-70)<1e-9 && Fy<=50+1e-9){ tDev=1.5*w; rule='36 &lt; F<sub>y</sub> &le; 50 ksi, E70: t<sub>min</sub> = 1.5w'; }
        else { tDev=1.0605*Fexx*w/Fy; rule='general: t<sub>min</sub> = 2(0.75)(0.6F<sub>EXX</sub>)(0.707w)/(1.0 &times; 0.6F<sub>y</sub>) = 1.0605F<sub>EXX</sub>w/F<sub>y</sub>'; }
        det = H('AISC Manual Part 10 &mdash; stiffener thickness to develop the two-sided seat-plate / stiffener welds')
          + R('Two fillets of leg w develop 2 &times; 0.75(0.6F<sub>EXX</sub>)(0.707w) = '+f2(2*0.75*0.6*Fexx*0.707)+'w kip/in; base metal shear yielding 1.0 &times; 0.6F<sub>y</sub>t = '+f2(0.6*Fy)+'t kip/in &rarr; t = '+f3(1.0605*Fexx/Fy)+'w')
          + R('Manual rule applied: '+rule+' = '+V(f4(tDev),'in'))
          + DC('t<sub>min</sub> = '+f4(tDev),'t = '+f3(S.t),tDev/S.t);
        C.push(mk('Stiffened seat','stTweld','Stiffener thickness to develop welds','AISC Manual Part 10','t<sub>min</sub> = '+f3(tDev)+' in','t = '+f3(S.t)+' in',tDev/S.t,det));
      }
      if (isRect){
        var phiVr = 1.00*0.6*Fy*S.t*S.L*nPl, MuR = Ru*e, phiMr = 0.90*Fy*S.t*S.L*S.L/4*nPl;
        det = H('AISC 360-22 &sect;J4.2 Eq. J4-3 &mdash; stiffener shear yielding ('+nPl+' plate'+(nPl>1?'s':'')+')')
          + R('&phi;V<sub>n</sub> = 1.00 &times; 0.6F<sub>y</sub>tL &times; n = 0.6 &times; '+f1(Fy)+' &times; '+f3(S.t)+' &times; '+f2(S.L)+' &times; '+nPl+' = '+V(f2(phiVr),'kips'))
          + DC('R<sub>u</sub> = '+f2(Ru),'&phi;V<sub>n</sub> = '+f2(phiVr),Ru/phiVr);
        C.push(mk('Stiffened seat','rectShear','Stiffener shear yielding','AISC 360-22 &sect;J4.2','R<sub>u</sub> = '+f2(Ru)+' k','&phi;V<sub>n</sub> = '+f2(phiVr)+' k',Ru/phiVr,det));
        det = H('AISC Manual Eq. 15-2 form &mdash; stiffener flexural yielding at the support face, reaction at e = '+f3(e)+' in')
          + R('M<sub>u</sub> = R<sub>u</sub>e = '+f2(Ru)+' &times; '+f3(e)+' = '+V(f2(MuR),'kip-in'))
          + R('&phi;M<sub>n</sub> = 0.90F<sub>y</sub>(tL&sup2;/4) &times; n = 0.90 &times; '+f1(Fy)+' &times; '+f3(S.t)+' &times; '+f2(S.L)+'&sup2;/4 &times; '+nPl+' = '+V(f2(phiMr),'kip-in'))
          + DC('M<sub>u</sub> = '+f2(MuR),'&phi;M<sub>n</sub> = '+f2(phiMr),MuR/phiMr);
        C.push(mk('Stiffened seat','rectFlex','Stiffener flexural yielding at support','AISC Manual Part 10 / Eq. 15-2','M<sub>u</sub> = '+f2(MuR)+' k-in','&phi;M<sub>n</sub> = '+f2(phiMr)+' k-in',MuR/phiMr,det));
      }
      if (isTri){
        var a=S.A, bw=S.W, t=S.t;
        var th=Math.atan(bw/a), thd=th*180/Math.PI, ap=a/Math.cos(th), bp=a*Math.sin(th);
        var q = bracketQ(bp, ap, t, Fy);
        vals.tri = {theta:thd, ap:ap, bp:bp, lam:q.lam, Q:q.Q, Fcr:q.Fcr};
        var geo = R('&theta; = tan<sup>-1</sup>(b/a) = tan<sup>-1</sup>('+f2(bw)+'/'+f2(a)+') = '+f1(thd)+'&deg;; a&prime; = a/cos&theta; = '+f2(ap)+' in (Eq. 15-17); b&prime; = a sin&theta; = '+f2(bp)+' in');
        var phiVa = 1.00*0.6*Fy*t*a*nPl;
        det = H('AISC 360-22 &sect;J4.2 Eq. J4-3 &mdash; Section A-A (at support face) shear yielding, '+nPl+' plate'+(nPl>1?'s':''))+geo
          + R('&phi;V<sub>n</sub> = 1.00 &times; 0.6F<sub>y</sub>ta &times; n = 0.6 &times; '+f1(Fy)+' &times; '+f3(t)+' &times; '+f2(a)+' &times; '+nPl+' = '+V(f2(phiVa),'kips'))
          + DC('R<sub>u</sub> = '+f2(Ru),'&phi;V<sub>n</sub> = '+f2(phiVa),Ru/phiVa);
        C.push(mk('Stiffened seat','triShearA','Section A-A shear yielding','AISC 360-22 &sect;J4.2; Manual Part 15','R<sub>u</sub> = '+f2(Ru)+' k','&phi;V<sub>n</sub> = '+f2(phiVa)+' k',Ru/phiVa,det));
        var MuA = Ru*e, phiMa = 0.90*Fy*t*a*a/4*nPl;
        det = H('AISC Manual Eq. 15-1, 15-2 &mdash; Section A-A flexural yielding')+geo
          + R('M<sub>u</sub> = P<sub>u</sub>e = '+f2(Ru)+' &times; '+f3(e)+' = '+V(f2(MuA),'kip-in'))
          + R('&phi;M<sub>n</sub> = 0.90F<sub>y</sub>Z &times; n, Z = ta&sup2;/4 = '+f3(t)+' &times; '+f2(a)+'&sup2;/4 = '+f2(t*a*a/4)+' in&sup3; &rarr; &phi;M<sub>n</sub> = '+V(f2(phiMa),'kip-in'))
          + DC('M<sub>u</sub> = '+f2(MuA),'&phi;M<sub>n</sub> = '+f2(phiMa),MuA/phiMa);
        C.push(mk('Stiffened seat','triFlexA','Section A-A flexural yielding','AISC Manual Eq. 15-1, 15-2','M<sub>u</sub> = '+f2(MuA)+' k-in','&phi;M<sub>n</sub> = '+f2(phiMa)+' k-in',MuA/phiMa,det));
        var VuB = Ru*Math.sin(th), phiVb = 1.00*0.6*Fy*t*bp*nPl;
        det = H('AISC Manual Eq. 15-6, 15-7 &mdash; Section B-B (perpendicular to free edge) shear yielding')+geo
          + R('V<sub>u</sub> = P<sub>u</sub>sin&theta; = '+f2(Ru)+' &times; sin '+f1(thd)+'&deg; = '+V(f2(VuB),'kips'))
          + R('&phi;V<sub>n</sub> = 1.00 &times; 0.6F<sub>y</sub>tb&prime; &times; n = 0.6 &times; '+f1(Fy)+' &times; '+f3(t)+' &times; '+f2(bp)+' &times; '+nPl+' = '+V(f2(phiVb),'kips'))
          + DC('V<sub>u</sub> = '+f2(VuB),'&phi;V<sub>n</sub> = '+f2(phiVb),VuB/phiVb);
        C.push(mk('Stiffened seat','triShearB','Section B-B shear yielding','AISC Manual Eq. 15-6, 15-7','V<sub>u</sub> = '+f2(VuB)+' k','&phi;V<sub>n</sub> = '+f2(phiVb)+' k',VuB/phiVb,det));
        det = H('AISC Manual Eq. 15-13 to 15-18 &mdash; local yielding / local buckling of the free edge')+geo
          + R('&lambda; = '+fr('(b&prime;/t)'+ov('F<sub>y</sub>'),'5'+ov('475 + 1120(b&prime;/a&prime;)&sup2;'))+' = '+fr('('+f2(bp)+'/'+f3(t)+')'+ov(f1(Fy)),'5'+ov('475 + 1120('+f2(bp)+'/'+f2(ap)+')&sup2;'))+' = '+V(f3(q.lam)))
          + R(q.regime+' &rarr; Q = '+V(f3(q.Q)))
          + R('F<sub>cr</sub> = QF<sub>y</sub> = '+f3(q.Q)+' &times; '+f1(Fy)+' = '+V(f2(q.Fcr),'ksi')+(q.Q<1?' &mdash; local buckling governs over yielding':' &mdash; yielding governs'))+END();
        C.push(mk('Stiffened seat','triQ','Free-edge local buckling, F<sub>cr</sub> = QF<sub>y</sub>','AISC Manual Eq. 15-14 to 15-18','&lambda; = '+f3(q.lam),'Q = '+f3(q.Q)+', F<sub>cr</sub> = '+f2(q.Fcr)+' ksi',null,det,{status:'INFO',note:q.Q<1?'buckling governs (feeds next row)':'yielding governs',informational:true}));
        var NuB = Ru*Math.cos(th), phiNb = 0.90*q.Fcr*t*bp*nPl;
        var MuB = Ru*e - NuB*bp/2, phiMb = 0.90*q.Fcr*t*bp*bp/4*nPl;
        var inter = NuB/phiNb + MuB/phiMb;
        vals.tri.NuB=NuB; vals.tri.phiNb=phiNb; vals.tri.MuB=MuB; vals.tri.phiMb=phiMb; vals.tri.inter=inter;
        det = H('AISC Manual Eq. 15-8 to 15-12 &mdash; Section B-B normal force + flexure interaction (Eq. 15-10)')+geo
          + R('N<sub>u</sub> = P<sub>u</sub>cos&theta; = '+f2(Ru)+' &times; cos '+f1(thd)+'&deg; = '+V(f2(NuB),'kips')+' (Eq. 15-9)')
          + R('&phi;N<sub>n</sub> = 0.90F<sub>cr</sub>tb&prime; &times; n = 0.90 &times; '+f2(q.Fcr)+' &times; '+f3(t)+' &times; '+f2(bp)+' &times; '+nPl+' = '+V(f2(phiNb),'kips')+' (Eq. 15-11)')
          + R('M<sub>u</sub> = P<sub>u</sub>e &minus; N<sub>u</sub>b&prime;/2 = '+f2(Ru)+' &times; '+f3(e)+' &minus; '+f2(NuB)+' &times; '+f2(bp)+'/2 = '+V(f2(MuB),'kip-in')+' (Eq. 15-8)')
          + R('&phi;M<sub>n</sub> = 0.90F<sub>cr</sub>tb&prime;&sup2;/4 &times; n = 0.90 &times; '+f2(q.Fcr)+' &times; '+f3(t)+' &times; '+f2(bp)+'&sup2;/4 &times; '+nPl+' = '+V(f2(phiMb),'kip-in')+' (Eq. 15-12)')
          + SEP()+R('N<sub>u</sub>/&phi;N<sub>n</sub> + M<sub>u</sub>/&phi;M<sub>n</sub> = '+fr(f2(NuB),f2(phiNb))+' + '+fr(f2(MuB),f2(phiMb))+' = '+f3(NuB/phiNb)+' + '+f3(MuB/phiMb)+' = '+V(f3(inter))+' &le; 1.0')+END();
        C.push(mk('Stiffened seat','triInter','Section B-B normal + flexure interaction','AISC Manual Eq. 15-8 to 15-12','N<sub>u</sub> = '+f2(NuB)+' k, M<sub>u</sub> = '+f2(MuB)+' k-in','&phi;N<sub>n</sub> = '+f2(phiNb)+' k, &phi;M<sub>n</sub> = '+f2(phiMb)+' k-in',inter,det));
        var ba = bw/a, z = 1.39-2.2*ba+1.27*ba*ba-0.25*ba*ba*ba, phiVz = 0.85*Fy*z*bw*t*nPl;
        var btLim = (ba>=0.75&&ba<=1.0) ? 250/Math.sqrt(Fy) : (ba>1.0&&ba<=2.0) ? 250*ba/Math.sqrt(Fy) : NaN;
        vals.tri.z=z; vals.tri.phiVz=phiVz;
        det = H('PCI Design Handbook 7th Ed. &sect;6.6.6 Eq. 6-47 to 6-50 (Salmon&ndash;Johnson free-edge yield) &mdash; reference only')
          + R('z = 1.39 &minus; 2.2(b/a) + 1.27(b/a)&sup2; &minus; 0.25(b/a)&sup3;, b/a = '+f3(ba)+' &rarr; z = '+V(f3(z)))
          + R('&phi;V<sub>n</sub> = 0.85F<sub>y</sub>zbt &times; n = 0.85 &times; '+f1(Fy)+' &times; '+f3(z)+' &times; '+f2(bw)+' &times; '+f3(t)+' &times; '+nPl+' = '+V(f2(phiVz),'kips'))
          + R('Free-edge yield limits: '+(isFinite(btLim)?('b/t = '+f1(bw/t)+' vs. limit '+f1(btLim)+(bw/t<=btLim?' &mdash; OK':' &mdash; exceeded')):'b/a outside 0.75&ndash;2.0: PCI method not applicable'))
          + DC('R<sub>u</sub> = '+f2(Ru),'&phi;V<sub>n</sub> = '+f2(phiVz),Ru/phiVz);
        C.push(mk('Stiffened seat','pciZ','PCI &sect;6.6.6 cross-check (reference)','PCI DH 7th Ed. Eq. 6-47, 6-48','R<sub>u</sub> = '+f2(Ru)+' k','&phi;V<sub>n</sub> = '+f2(phiVz)+' k',Ru/phiVz,det,{status:'INFO',note:'reference only, not a design check',informational:true}));
      }
      var retMin = 0.2*vlen;
      C.push(mk('Stiffened seat','spWeldNote','Seat plate welds (detailing)','AISC Manual Part 10, Fig. 10-10','&ge; 0.2L = '+f2(retMin)+' in each side','stiffener-to-seat weld &ge; seat-to-support weld',null,
        H('AISC Manual Part 10 detailing rules')+R('Seat-plate-to-support weld each side of the stiffener &ge; 0.2L = '+f2(retMin)+' in. The weld between seat plate and stiffener must be at least as strong as the weld between seat plate and support: same size, both sides of the stiffener, length = W each side. Seat plate width '+f2(inp.sp.B)+' in must clear the beam-to-seat bolts.')+END(),{status:'INFO',note:'detailing',informational:true}));
    }

    // ===== 3. Attachment
    if (at==='welded'){
      var W=inp.weld, l = W.len!==null ? W.len : vlen, h = W.ret!==null ? W.ret : 0.2*l;
      var wg = weldGroup(l, h, e, Ru, W.w, W.Fexx, W.dir);
      vals.weld = {l:l,h:h,wg:wg};
      var tableRef = isAngle ? 'Manual Table 10-6' : 'Manual Table 10-8';
      det = H('AISC 360-22 &sect;J2.4 with the Manual Part 10 seat weld model ('+tableRef+' basis, Blodgett &sect;5.3): two L-shaped lines, l = '+f2(l)+' in vertical + h = '+f2(h)+' in top return each')
        + R('Line properties per L (unit throat): &#563; = (l&sup2;/2 + hl)/(l + h) = '+f3(wg.ybar)+' in from bottom; I = l&sup3;/12 + l(l/2 &minus; &#563;)&sup2; + h(l &minus; &#563;)&sup2; = '+f1(wg.I)+' in&sup3;; c<sub>top</sub> = '+f3(wg.cTop)+' in; S<sub>top</sub> = '+f2(wg.Stop)+' in&sup2;')
        + R('Group: S = 2S<sub>top</sub> = '+f2(wg.S)+' in&sup2;, shear length A<sub>v</sub> = 2l = '+f2(wg.Av)+' in (vertical welds; compression side bears on the support)')
        + R('f<sub>b</sub> = R<sub>u</sub>e/S = '+f2(Ru)+' &times; '+f3(e)+'/'+f2(wg.S)+' = '+f3(wg.fb)+' kip/in; f<sub>v</sub> = R<sub>u</sub>/A<sub>v</sub> = '+f3(wg.fv)+' kip/in')
        + R('f<sub>r</sub> = '+ov('f<sub>b</sub>&sup2; + f<sub>v</sub>&sup2;')+' = '+V(f3(wg.fr),'kip/in')+' at &theta; = '+f1(wg.theta)+'&deg; from the weld axis')
        + R('&phi;r<sub>n</sub> = 0.75(0.6F<sub>EXX</sub>)(0.707w)'+(W.dir?'(1 + 0.5sin<sup>1.5</sup>&theta;)':'')+' = 0.75 &times; 0.6 &times; '+f1(W.Fexx)+' &times; 0.707 &times; '+f4(W.w)+(W.dir?' &times; '+f3(wg.kt):'')+' = '+V(f3(wg.phirn),'kip/in'))
        + R('Required leg D = 16f<sub>r</sub>/[0.75(0.6F<sub>EXX</sub>)(0.707)'+(W.dir?'k<sub>t</sub>':'')+'] = '+f2(wg.Dreq)+' sixteenths; equivalent group strength &phi;R<sub>n</sub> = '+f1(wg.phiRn)+' kips (compare '+tableRef+')')
        + DC('f<sub>r</sub> = '+f3(wg.fr),'&phi;r<sub>n</sub> = '+f3(wg.phirn),wg.dc);
      C.push(mk('Welds to support','weldMain',(isAngle?'Seat angle':'Stiffener')+' to support weld','AISC 360-22 &sect;J2.4; Manual Part 10','f<sub>r</sub> = '+f3(wg.fr)+' k/in','&phi;r<sub>n</sub> = '+f3(wg.phirn)+' k/in',wg.dc,det,{note:'e = '+f2(e)+' in, D<sub>req</sub> = '+f1(wg.Dreq)+'/16'}));
      var tThin = Math.min(tSeat, inp.sup.t), wMin = minFillet(tThin), wMax = maxFillet(tSeat);
      det = H('AISC 360-22 Table J2.4 and &sect;J2.2b(b) &mdash; fillet size limits')
        + R('Thinner part joined = '+f3(tThin)+' in &rarr; minimum fillet = '+V(f4(wMin),'in'))
        + R('Along the edge of the '+f3(tSeat)+' in seat element: maximum fillet = '+(tSeat<0.25?'t':'t &minus; 1/16')+' = '+V(f4(wMax),'in'))
        + R('Provided w = '+f4(W.w)+' in &rarr; '+(W.w<wMin-1e-9?'below minimum':W.w>wMax+1e-9?'above maximum':'within limits'))+END();
      var szOK = W.w>=wMin-1e-9 && W.w<=wMax+1e-9;
      C.push(mk('Welds to support','weldSize','Fillet size limits','AISC 360-22 Table J2.4, &sect;J2.2b','w = '+f4(W.w)+' in',f4(wMin)+' &le; w &le; '+f4(wMax)+' in',null,det,{status:szOK?'PASS':'REVIEW',note:szOK?'':'adjust weld size',informational:true}));
      var D = sixteenths(W.w), kSup = inp.bothSides?6.19:3.09, tSupMin = kSup*D/inp.sup.Fu;
      det = H('AISC Manual Eq. 9-'+(inp.bothSides?'3':'2')+' &mdash; support base metal to develop the '+(inp.bothSides?'two-sided':'one-sided')+' weld (Design Example II.A-15 form)')
        + R('t<sub>min</sub> = '+f2(kSup)+'D/F<sub>u</sub> = '+f2(kSup)+' &times; '+f1(D)+'/'+f1(inp.sup.Fu)+' = '+V(f3(tSupMin),'in'))
        + DC('t<sub>min</sub> = '+f3(tSupMin),'t<sub>sup</sub> = '+f3(inp.sup.t),tSupMin/inp.sup.t);
      C.push(mk('Support','supBM','Support base metal at weld','AISC Manual Eq. 9-2 / 9-3','t<sub>min</sub> = '+f3(tSupMin)+' in','t<sub>sup</sub> = '+f3(inp.sup.t)+' in',tSupMin/inp.sup.t,det,{note:inp.bothSides?'seats both sides':''}));
      var kSeat = isAngle?3.09:6.19, tSeatMin = kSeat*D/Fu;
      det = H('AISC Manual Eq. 9-'+(isAngle?'2':'3')+' &mdash; seat element base metal at the weld ('+(isAngle?'single-sided weld on the vertical leg':'stiffener welded both sides')+')')
        + R('t<sub>min</sub> = '+f2(kSeat)+'D/F<sub>u</sub> = '+f2(kSeat)+' &times; '+f1(D)+'/'+f1(Fu)+' = '+V(f3(tSeatMin),'in'))
        + DC('t<sub>min</sub> = '+f3(tSeatMin),'t = '+f3(tSeat),tSeatMin/tSeat);
      C.push(mk('Welds to support','seatBM','Seat element base metal at weld','AISC Manual Eq. 9-2 / 9-3','t<sub>min</sub> = '+f3(tSeatMin)+' in','t = '+f3(tSeat)+' in',tSeatMin/tSeat,det));
      if (!isAngle && h < 0.2*vlen-1e-9) C.push(mk('Welds to support','retNote','Seat plate return length','AISC Manual Part 10','h = '+f2(h)+' in','&ge; 0.2L = '+f2(0.2*vlen)+' in',null,H('Detailing note')+R('Return (seat-plate-to-support weld each side of the stiffener) is below the Manual minimum of 0.2L.')+END(),{status:'REVIEW',note:'increase return',informational:true}));
    } else {
      var Bo=inp.bolt, G=BOLT[Bo.grade], Ab=Math.PI*Bo.d*Bo.d/4, dh=holeDia(Bo.d), perRow=Bo.n/Bo.rows;
      var phiRv = 0.75*G.Fnv*Ab, phiRvG = phiRv*Bo.n;
      vals.bolt = {Ab:Ab,dh:dh,phiRv:phiRv,phiRvG:phiRvG};
      det = H('AISC 360-22 &sect;J3.6 Eq. J3-1 &mdash; bolt shear, '+G.label+' (Table J3.2 F<sub>nv</sub> = '+G.Fnv+' ksi)')
        + R('A<sub>b</sub> = &pi;d&sup2;/4 = '+f4(Ab)+' in&sup2;; &phi;r<sub>n</sub> = 0.75F<sub>nv</sub>A<sub>b</sub> = 0.75 &times; '+G.Fnv+' &times; '+f4(Ab)+' = '+f2(phiRv)+' kips/bolt')
        + R('Group (Manual Tables 10-5 / 10-7 practice: shear only, eccentricity neglected): &phi;R<sub>n</sub> = '+Bo.n+' &times; '+f2(phiRv)+' = '+V(f1(phiRvG),'kips'))
        + DC('R<sub>u</sub> = '+f2(Ru),'&phi;R<sub>n</sub> = '+f1(phiRvG),Ru/phiRvG);
      C.push(mk('Bolts to support','boltShear','Bolt shear','AISC 360-22 &sect;J3.6','R<sub>u</sub> = '+f2(Ru)+' k','&phi;R<sub>n</sub> = '+f1(phiRvG)+' k',Ru/phiRvG,det));
      function bearing(tp, Fup, le, label, ref){
        var brg = 2.4*Bo.d*tp*Fup, lcE = le!==null ? le-dh/2 : null, lcI = Bo.pitch-dh;
        var rEdge = le!==null ? Math.min(brg, 1.2*lcE*tp*Fup) : brg;
        var rInt = Bo.rows>1 ? Math.min(brg, 1.2*lcI*tp*Fup) : 0;
        var Rn = perRow*(rEdge + (Bo.rows-1)*rInt), phiRn = 0.75*Rn;
        var d = H('AISC 360-22 &sect;J3.10 Eq. J3-6a, J3-6c (deformation at service load a consideration) &mdash; '+label)
          + R('Hole d<sub>h</sub> = '+f4(dh)+' in (Table J3.3); bearing per bolt 2.4dtF<sub>u</sub> = 2.4 &times; '+f3(Bo.d)+' &times; '+f3(tp)+' &times; '+f1(Fup)+' = '+f2(brg)+' kips')
          + (le!==null ? R('Edge row: l<sub>c</sub> = l<sub>e</sub> &minus; d<sub>h</sub>/2 = '+f3(le)+' &minus; '+f4(dh/2)+' = '+f3(lcE)+' in; tearout 1.2l<sub>c</sub>tF<sub>u</sub> = '+f2(1.2*lcE*tp*Fup)+' kips &rarr; r<sub>n</sub> = '+f2(rEdge)+' kips/bolt') : R('Edge row: not near an edge &rarr; r<sub>n</sub> = bearing = '+f2(rEdge)+' kips/bolt'))
          + (Bo.rows>1 ? R('Interior rows: l<sub>c</sub> = s &minus; d<sub>h</sub> = '+f3(Bo.pitch)+' &minus; '+f4(dh)+' = '+f3(lcI)+' in; tearout = '+f2(1.2*lcI*tp*Fup)+' kips &rarr; r<sub>n</sub> = '+f2(rInt)+' kips/bolt') : '')
          + R('&phi;R<sub>n</sub> = 0.75 &times; '+perRow+' &times; ['+f2(rEdge)+' + '+(Bo.rows-1)+' &times; '+f2(rInt)+'] = '+V(f1(phiRn),'kips'))
          + DC('R<sub>u</sub> = '+f2(Ru),'&phi;R<sub>n</sub> = '+f1(phiRn),Ru/phiRn);
        return {phiRn:phiRn, det:d};
      }
      var bs = bearing(tSeat, Fu, Bo.le, 'seat element (t = '+f3(tSeat)+' in)');
      C.push(mk('Bolts to support','brgSeat','Bearing / tearout on seat element','AISC 360-22 &sect;J3.10','R<sub>u</sub> = '+f2(Ru)+' k','&phi;R<sub>n</sub> = '+f1(bs.phiRn)+' k',Ru/bs.phiRn,bs.det));
      var bsup = bearing(inp.sup.t, inp.sup.Fu, Bo.leSup, 'support (t = '+f3(inp.sup.t)+' in)');
      C.push(mk('Support','brgSup','Bearing / tearout on support','AISC 360-22 &sect;J3.10','R<sub>u</sub> = '+f2(Ru)+' k','&phi;R<sub>n</sub> = '+f1(bsup.phiRn)+' k',Ru/bsup.phiRn,bsup.det));
      if (Bo.tension){
        var M = Ru*e, ys=[], sum2=0, i;
        for (i=0;i<Bo.rows;i++){ var y = vlen-Bo.le-i*Bo.pitch; ys.push(y); sum2 += y*y; }
        var yTop = ys[0], Tmax = M*yTop/(perRow*sum2);
        var frv = Ru/(Bo.n*Ab), Fnt2 = Math.min(G.Fnt, 1.3*G.Fnt - G.Fnt*frv/(0.75*G.Fnv)), phiRt = 0.75*Fnt2*Ab;
        var okRows = ys.every(function(y){return y>0;});
        det = H('AISC 360-22 &sect;J3.7 Eq. J3-3a &mdash; optional bolt tension from R<sub>u</sub>e (elastic distribution, neutral axis at the bottom edge of the seat element, no prying)')
          + R('M = R<sub>u</sub>e = '+f2(Ru)+' &times; '+f3(e)+' = '+f2(M)+' kip-in; row heights above bottom edge y<sub>i</sub> = '+ys.map(f2).join(', ')+' in; &Sigma;y&sup2; = '+f2(sum2)+' in&sup2;')
          + R('T<sub>max</sub> = My<sub>top</sub>/(bolts per row &times; &Sigma;y&sup2;) = '+f2(M)+' &times; '+f2(yTop)+'/('+perRow+' &times; '+f2(sum2)+') = '+V(f2(Tmax),'kips/bolt'))
          + R('f<sub>rv</sub> = R<sub>u</sub>/(nA<sub>b</sub>) = '+f2(frv)+' ksi; F&prime;<sub>nt</sub> = 1.3F<sub>nt</sub> &minus; F<sub>nt</sub>f<sub>rv</sub>/(&phi;F<sub>nv</sub>) = 1.3 &times; '+G.Fnt+' &minus; '+G.Fnt+' &times; '+f2(frv)+'/(0.75 &times; '+G.Fnv+') = '+f2(Fnt2)+' ksi &le; F<sub>nt</sub>')
          + R('&phi;r<sub>nt</sub> = 0.75F&prime;<sub>nt</sub>A<sub>b</sub> = '+V(f2(phiRt),'kips/bolt'))
          + (okRows ? DC('T<sub>max</sub> = '+f2(Tmax),'&phi;r<sub>nt</sub> = '+f2(phiRt),Tmax/phiRt) : SEP()+R('A bolt row falls below the bottom edge: check l<sub>e</sub>, pitch and rows.')+END());
        C.push(mk('Bolts to support','boltTen','Bolt tension + shear (optional)','AISC 360-22 &sect;J3.7','T<sub>max</sub> = '+f2(Tmax)+' k/bolt','&phi;r<sub>nt</sub> = '+f2(phiRt)+' k/bolt',okRows?Tmax/phiRt:null,det,okRows?{note:'prying not evaluated'}:{status:'N/A',note:'row geometry invalid'}));
      }
    }

    // ===== summary
    var maxDC = 0, gov = null, anyFail = false, anyReview = false;
    C.forEach(function(c){
      if (c.status==='FAIL') anyFail = true;
      if (c.status==='REVIEW') anyReview = true;
      if (!c.informational && c.dc!==null && c.dc>maxDC){ maxDC=c.dc; gov=c; }
    });
    var banner = anyFail ? 'FAIL' : anyReview ? 'REVIEW' : 'PASS';
    return {ok:true, errors:[], checks:C, vals:vals, maxDC:maxDC, governing:gov?gov.name:'', governingId:gov?gov.id:'', banner:banner};
  }

  // ---- fixtures (spec §9). Each: {id, src, inp:{overrides on BASE}, expect:function(res,get)->[label, ok, detail]}
  var BASE = {
    seatType:'rect', attach:'welded', support:'colFlange', bothSides:false,
    beam:{label:'W21X68', d:21.1, tw:0.430, tf:0.685, kdes:1.19, bf:8.27, Fy:50, Fu:65},
    Ru:125, setback:0.5, underrun:0.25, FySeat:36, FuSeat:58, eSeat:null,
    angle:{leg:8, osl:4, t:0.625, L:8}, lbReq:null,
    st:{W:7, L:15, A:15, t:0.625, n:1}, sp:{t:0.375, B:9},
    weld:{w:0.3125, Fexx:70, len:null, ret:null, dir:false}, sup:{t:0.710, Fu:65},
    bolt:{grade:'A-N', d:0.75, n:4, rows:2, pitch:3, gage:5.5, le:1.25, leSup:null, tension:false}
  };
  function merge(base, over){
    var out = {};
    Object.keys(base).forEach(function(k){ out[k] = (base[k] && typeof base[k]==='object' && !Array.isArray(base[k])) ? merge(base[k], (over&&over[k])||{}) : base[k]; });
    Object.keys(over||{}).forEach(function(k){ if (!(base[k] && typeof base[k]==='object' && !Array.isArray(base[k]))) out[k] = over[k]; });
    return out;
  }
  function near(a,b,tol){ return isFinite(a) && Math.abs(a-b)<=tol; }
  function within(a,lo,hi){ return isFinite(a) && a>=lo && a<=hi; }
  function get(res,id){ for (var i=0;i<res.checks.length;i++) if (res.checks[i].id===id) return res.checks[i]; return null; }
  function capNum(c){ return c ? parseFloat(String(c.capacity).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')) : NaN; }

  var W16X50 = {label:'W16X50', d:16.3, tw:0.380, tf:0.630, kdes:1.03, bf:7.07, Fy:50, Fu:65};
  var W21X62 = {label:'W21X62', d:21.0, tw:0.400, tf:0.615, kdes:1.12, bf:8.24, Fy:50, Fu:65};
  var W14X38 = {label:'W14X38', d:14.1, tw:0.310, tf:0.515, kdes:0.915, bf:6.77, Fy:50, Fu:65};

  var FIXTURES = [
    {id:'F1', src:'II.A-12A', inp:{seatType:'angle', attach:'bolted', support:'colWeb', beam:W16X50, Ru:54.8, angle:{leg:6, osl:4, t:0.625, L:8}, lbReq:1.0625, sup:{t:0.440, Fu:65}, bolt:{le:3}},
      expect:function(r){ return [['lb,WLY = 0.311', near(r.vals.bb.lbWLY,0.311,0.01), f4(r.vals.bb.lbWLY)], ['lb,min = 1.03', near(r.vals.bb.lbMin,1.03,0.01), f4(r.vals.bb.lbMin)]]; }},
    {id:'F2', src:'II.A-12A', inp:{seatType:'angle', attach:'bolted', support:'colWeb', beam:W16X50, Ru:54.8, angle:{leg:6, osl:4, t:0.625, L:8}, lbReq:1.0625, sup:{t:0.440, Fu:65}, bolt:{le:3}},
      expect:function(r){ return [['OSL flexure phiRn = 90.0', near(r.vals.phiRnOSL,90.0,0.3), f2(r.vals.phiRnOSL)]]; }},
    {id:'F3', src:'II.A-12A', inp:{seatType:'angle', attach:'bolted', support:'colWeb', beam:W16X50, Ru:54.8, angle:{leg:6, osl:4, t:0.625, L:8}, lbReq:1.0625, sup:{t:0.440, Fu:65}, bolt:{le:3}},
      expect:function(r){ return [['bolt shear 71.6', near(r.vals.bolt.phiRvG,71.6,0.5), f2(r.vals.bolt.phiRvG)], ['bearing angle 196', near(capNum(get(r,'brgSeat')),196,0.5), get(r,'brgSeat').capacity], ['bearing support 155 (0.75 x 205.9 = 154.4; example rounds 206 x 0.75)', near(capNum(get(r,'brgSup')),155,0.7), get(r,'brgSup').capacity]]; }},
    {id:'F4', src:'II.A-13', inp:{seatType:'angle', attach:'welded', beam:W21X62, Ru:54.8, angle:{leg:8, osl:4, t:0.625, L:8}, lbReq:1.125, sup:{t:0.645, Fu:65}, weld:{w:0.3125, len:8, ret:1.6}, eSeat:3.2},
      expect:function(r){ return [['lb,min = 1.12', near(r.vals.bb.lbMin,1.12,0.01), f4(r.vals.bb.lbMin)], ['OSL flexure 81.0', near(r.vals.phiRnOSL,81.0,0.3), f2(r.vals.phiRnOSL)]]; }},
    {id:'F5', src:'II.A-13', inp:{seatType:'angle', attach:'welded', beam:W21X62, Ru:54.8, angle:{leg:8, osl:4, t:0.625, L:8}, lbReq:1.125, sup:{t:0.645, Fu:65}, weld:{w:0.3125, len:8, ret:1.6}, eSeat:3.2},
      expect:function(r){ return [['seat weld phiRn 66.0-67.5 (Table 10-6: 66.7)', within(r.vals.weld.wg.phiRn,66.0,67.5), f2(r.vals.weld.wg.phiRn)]]; }},
    {id:'F6', src:'II.A-16', inp:{seatType:'angle', attach:'welded', beam:W14X38, Ru:51.4, angle:{leg:7, osl:4, t:0.625, L:6}, lbReq:0.915, sup:{t:0.605, Fu:65}, weld:{w:0.3125, len:7, ret:1.4}, eSeat:3.2},
      expect:function(r){ return [['seat weld phiRn 52.8-54.0 (Table 10-6: 53.4)', within(r.vals.weld.wg.phiRn,52.8,54.0), f2(r.vals.weld.wg.phiRn)]]; }},
    {id:'F7', src:'II.A-14', inp:{seatType:'rect'},
      expect:function(r){ var bb=r.vals.bb; return [['W,min crippling 6.93 (J10-5b)', near(bb.lbWLC+0.75,6.93,0.03)&&bb.branch.indexOf('5b')>=0, f3(bb.lbWLC+0.75)+' '+bb.branch], ['W,min yielding 3.59', near(bb.lbWLY+0.75,3.59,0.03), f3(bb.lbWLY+0.75)], ['lb/d = 0.296', near(r.vals.lbProv/21.1,0.296,0.002), f4(r.vals.lbProv/21.1)]]; }},
    {id:'F8', src:'II.A-14', inp:{seatType:'rect', weld:{ret:3}},
      expect:function(r){ return [['stiffener weld phiRn 130-139 (Table 10-8: 139; vertical-weld shear gives 130.8)', within(r.vals.weld.wg.phiRn,130,139), f2(r.vals.weld.wg.phiRn)], ['t,min 2w = 0.625', near(capNum(get(r,'stTweld')),0.625,0.001)||near(parseFloat(String(get(r,'stTweld').demand).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')),0.625,0.001), get(r,'stTweld').demand], ['t,min web = 0.597', near(parseFloat(String(get(r,'stTweb').demand).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')),0.597,0.001), get(r,'stTweb').demand]]; }},
    {id:'F9', src:'II.A-15', inp:{seatType:'rect', support:'colWeb', sup:{t:0.440, Fu:65}},
      expect:function(r){ var one = parseFloat(String(get(r,'supBM').demand).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')); return [['t,min one-sided 0.238', near(one,0.238,0.003), f4(one)]]; }},
    {id:'F9b', src:'II.A-15', inp:{seatType:'rect', support:'colWeb', bothSides:true, sup:{t:0.440, Fu:65}},
      expect:function(r){ var two = parseFloat(String(get(r,'supBM').demand).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')); return [['t,min both sides 0.476', near(two,0.476,0.003), f4(two)]]; }},
    {id:'F10', src:'II.A-23', inp:{seatType:'tri', Ru:54, st:{W:11.5, A:18, t:0.375, n:2}, eSeat:8.25, weld:{w:0.1875}},
      expect:function(r){ var t=r.vals.tri, c; var out=[
        ['theta 32.6', near(t.theta,32.6,0.1), f2(t.theta)], ['a\' 21.4', near(t.ap,21.4,0.1), f2(t.ap)], ['b\' 9.70', near(t.bp,9.70,0.05), f2(t.bp)],
        ['A-A phiMn 1970', near(capNum(get(r,'triFlexA')),1970,20), get(r,'triFlexA').capacity], ['A-A Mu 446', near(54*8.25,446,1), '445.5'],
        ['B-B Vu 29.1', near(parseFloat(String(get(r,'triShearB').demand).replace(/<[^>]+>/g,'').replace(/^[^=]*=\s*/,'')),29.1,0.3), get(r,'triShearB').demand], ['B-B phiVn 157', near(capNum(get(r,'triShearB')),157,1.6), get(r,'triShearB').capacity],
        ['lambda 1.17', near(t.lam,1.17,0.012), f3(t.lam)], ['Q 0.771', near(t.Q,0.771,0.008), f3(t.Q)], ['Fcr 27.8', near(t.Fcr,27.8,0.3), f2(t.Fcr)],
        ['Nu 45.5', near(t.NuB,45.5,0.5), f2(t.NuB)], ['phiNn 182', near(t.phiNb,182,2), f2(t.phiNb)], ['Mu,BB 225', near(t.MuB,225,2.5), f2(t.MuB)], ['phiMn,BB 441', near(t.phiMb,441,4.5), f2(t.phiMb)], ['interaction 0.760', near(t.inter,0.760,0.008), f3(t.inter)]];
        return out; }},
    {id:'F11', src:'II.A-22', inp:{seatType:'tri', Ru:36, st:{W:15.25, A:20, t:0.375, n:1}, eSeat:9.25},
      expect:function(r){ var t=r.vals.tri; return [['lambda 1.43', near(t.lam,1.43,0.015), f3(t.lam)], ['Q 0.636', near(t.Q,0.636,0.007), f3(t.Q)], ['Fcr 22.9', near(t.Fcr,22.9,0.25), f2(t.Fcr)]]; }},
    {id:'F12', src:'PCI 6.6.7.1', inp:{seatType:'tri', st:{W:8, A:10, t:0.375, n:1}},
      expect:function(r){ var t=r.vals.tri; return [['z 0.315', near(t.z,0.315,0.002), f4(t.z)], ['PCI phiVn 28.9', near(t.phiVz,28.9,0.1), f2(t.phiVz)]]; }},
    {id:'F13', src:'baseline', inp:{},
      expect:function(r){ return [['defaults compute without error', r.ok===true, r.ok?'ok':r.errors.join('; ')], ['baseline banner not FAIL', r.banner!=='FAIL', r.banner+' maxDC='+f3(r.maxDC)]]; }},
    {id:'F14', src:'NaN guard', inp:{Ru:NaN},
      expect:function(r){ return [['NaN Ru blocked', r.ok===false && r.errors.length>0, r.errors.join('; ')]]; }}
  ];
  function runFixtures(){
    var lines=[], pass=0, total=0;
    FIXTURES.forEach(function(fx){
      var res = compute(merge(BASE, fx.inp));
      var items;
      try { items = fx.expect(res); } catch(err){ items = [['expect threw', false, String(err)]]; }
      items.forEach(function(it){ total++; if (it[1]) pass++; lines.push((it[1]?'PASS ':'FAIL ')+fx.id+' ['+fx.src+'] '+it[0]+'  ->  '+it[2]); });
    });
    return {pass:pass, total:total, lines:lines};
  }

  return {compute:compute, validate:validate, beamBearing:beamBearing, weldGroup:weldGroup, bracketQ:bracketQ, BOLT:BOLT, holeDia:holeDia, BASE:BASE, FIXTURES:FIXTURES, merge:merge, runFixtures:runFixtures};
})();
```

- [ ] **Step 2: Syntax check**

Run from `$R`:
```bash
node -e "const s=require('fs').readFileSync('public/Calcs/seated_beam_connection_calculator.html','utf8'); const m=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)]; global.window={}; new Function(m[0][1])(); new Function(m[1][1])(); const r=window.SEAT.runFixtures(); console.log(r.lines.join('\n')); console.log(r.pass+'/'+r.total)"
```
Expected: every line `PASS …`, final `N/N` with N ≥ 40. If a fixture fails, the arithmetic in the engine is wrong — fix the engine, not the tolerance, unless the tolerance in spec §9 was misread.

---

### Task 3: Node test and npm scripts

**Files:**
- Create: `tools/test-seated-connection.mjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the test**

```js
// =============================================================================
// Seated beam connection calculator — engine + wiring test
// -----------------------------------------------------------------------------
// Runs the in-page fixture set (window.SEAT.runFixtures: AISC Design Examples
// II.A-12A/13/14/15/16/22/23 and PCI Ex. 6.6.7.1, spec §9) in headless Chromium
// with every request fulfilled from public/ on disk, then drives the DOM once
// (defaults = Design Example II.A-14) to prove the UI is wired to the engine.
// Usage: node tools/test-seated-connection.mjs
// =============================================================================
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json' };
const FILE = 'seated_beam_connection_calculator.html';

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
const fx = await page.evaluate(() => window.SEAT.runFixtures());
fx.lines.forEach((l) => console.log('  ' + l));
check(`engine fixtures ${fx.pass}/${fx.total}`, fx.pass === fx.total, fx.lines.filter((l) => l.startsWith('FAIL')).join('\n      '));

// ── UI wiring: defaults (II.A-14 stiffened, welded) ──────────────────────────
await page.click('button.calc-btn');
const ui = await page.evaluate(() => ({
  banner: document.getElementById('sumOut').textContent,
  rows: document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length,
  lbmin: document.querySelector('#chkTb tr td')?.textContent,
  results: document.getElementById('results').classList.contains('show'),
  svg: document.getElementById('schemSvg').children.length,
}));
check('results shown after Run', ui.results === true, JSON.stringify(ui));
check('check table has rows', ui.rows >= 8, 'rows=' + ui.rows);
check('schematic drawn', ui.svg > 5, 'children=' + ui.svg);

// ── every mode renders without a page error ─────────────────────────────────
for (const seatType of ['angle', 'rect', 'tri']) for (const attach of ['welded', 'bolted']) {
  await page.selectOption('#seatType', seatType);
  await page.selectOption('#attach', attach);
  await page.click('button.calc-btn');
  const n = await page.evaluate(() => document.querySelectorAll('#chkTb tr:not(.det-row):not(.sect-row)').length);
  check(`mode ${seatType}/${attach} renders rows`, n >= 6, 'rows=' + n);
}

// ── mark binding ──────────────────────────────────────────────────────────────
await page.fill('#areMark', 'SEAT-1');
await page.waitForTimeout(400);
const svgText = await page.evaluate(() => document.getElementById('schemSvg').textContent);
check('mark appears in schematic', svgText.includes('SEAT-1'), svgText.slice(0, 120));

check('no page errors', pageErrors.length === 0, pageErrors.join('\n      '));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nALL PASS');
```

- [ ] **Step 2: Add scripts**

In `package.json`, after the `"test:apa"` line add:
```json
    "test:seat": "node tools/test-seated-connection.mjs",
```
and change the `"qa"` script to end with `&& npm run test:seat`.

- [ ] **Step 3: Run the test (expected to fail on UI wiring until Task 4)**

Run from `$R`: `npm run test:seat`
Expected now: engine fixtures PASS; `results shown after Run` FAIL (no `run()` yet). After Task 4 and 5: `ALL PASS`.

---

### Task 4: UI script (inputs, mode toggles, render)

**Files:**
- Modify: `public/Calcs/seated_beam_connection_calculator.html` (replace the `/* UI */` script block)

- [ ] **Step 1: Write the UI script**

```js
/* ===================== UI ===================== */
function $(id){ return document.getElementById(id); }
function numv(id){ var v=parseFloat($(id).value); return isFinite(v)?v:NaN; }
function optv(id){ var s=$(id).value; if (s===''||s===null) return null; var v=parseFloat(s); return isFinite(v)?v:NaN; }
function toggleDet(i){var el=$('det_'+i);var b=$('dbtn_'+i);var o=el.classList.toggle('open');b.textContent=o?'\u25BE Calc':'\u25B6 Calc'}

function fillBeams(){
  var sel=$('wsec'), keys=Object.keys(W_DB).sort(function(a,b){
    var pa=a.match(/W(\d+)X(\d+)/), pb=b.match(/W(\d+)X(\d+)/);
    return (+pa[1]-+pb[1]) || (+pa[2]-+pb[2]); });
  keys.forEach(function(k){ var o=document.createElement('option'); o.value=k; o.textContent=k; sel.appendChild(o); });
  sel.value='W21X68';
}
function onBeamChange(){
  var k=$('wsec').value; if (k==='custom') return;
  var r=W_DB[k]; if (!r) return;
  $('bd').value=r[1]; $('bbf').value=r[2]; $('btf').value=r[3]; $('btw').value=r[4]; $('bkdes').value=r[5];
  draw();
}
function onModeChange(){
  var st=$('seatType').value, at=$('attach').value, su=$('support').value;
  $('blkAngle').classList.toggle('mode-hide', st!=='angle');
  $('blkStiff').classList.toggle('mode-hide', st==='angle');
  $('igStL').classList.toggle('mode-hide', st!=='rect');
  $('igStA').classList.toggle('mode-hide', st!=='tri');
  $('stiffBadge').textContent = st==='rect' ? 'Manual Part 10, Tables 10-7 / 10-8' : 'Manual Part 15 bracket plate, Ex. II.A-23';
  $('stiffNote').innerHTML = st==='rect'
    ? 'Rectangular stiffener plate below the seat plate. Strength is governed by the Manual thickness rules; shear and flexure at the support face are also reported.'
    : 'Triangular stiffener: height a along the support, projection b = W at the seat. Free edge is the hypotenuse; Section B-B is perpendicular to it (Manual Fig. 15-2).';
  $('blkWeld').classList.toggle('mode-hide', at!=='welded');
  $('blkBolt').classList.toggle('mode-hide', at!=='bolted');
  $('bothSidesWrap').classList.toggle('mode-hide', su==='colFlange');
  if (su==='colFlange') $('bothSides').checked=false;
  draw();
}
function readInputs(){
  return {
    seatType:$('seatType').value, attach:$('attach').value, support:$('support').value, bothSides:$('bothSides').checked,
    beam:{label:$('wsec').value, d:numv('bd'), tw:numv('btw'), tf:numv('btf'), kdes:numv('bkdes'), bf:numv('bbf'), Fy:numv('FyBeam'), Fu:numv('FuBeam')},
    Ru:numv('Ru'), setback:numv('setback'), underrun:numv('underrun'),
    FySeat:numv('FySeat'), FuSeat:numv('FuSeat'), eSeat:optv('eSeat'),
    angle:{leg:numv('angLeg'), osl:numv('angOSL'), t:numv('angT'), L:numv('angL')}, lbReq:optv('lbReq'),
    st:{W:numv('stW'), L:numv('stL'), A:numv('stA'), t:numv('stT'), n:numv('stN')}, sp:{t:numv('spT'), B:numv('spB')},
    weld:{w:numv('wSize'), Fexx:numv('Fexx'), len:optv('wLen'), ret:optv('wRet'), dir:$('wDir').checked}, sup:{t:numv('supT'), Fu:numv('FuSup')},
    bolt:{grade:$('bGrade').value, d:numv('bDia'), n:numv('bN'), rows:numv('bRows'), pitch:numv('bPitch'), gage:numv('bGage'), le:numv('bLe'), leSup:optv('bLeSup'), tension:$('bTension').checked}
  };
}
function card(v,l){ return '<div class="dem-card"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>'; }
function run(){
  var inp=readInputs(), res=SEAT.compute(inp);
  var errOut=$('errOut'), results=$('results');
  if (!res.ok){
    errOut.innerHTML='<div class="err-box"><h3>Input errors &mdash; fix before running</h3><ul>'+res.errors.map(function(e){return '<li>'+e+'</li>';}).join('')+'</ul></div>';
    results.classList.remove('show'); return;
  }
  errOut.innerHTML='';
  var mark = (window.AREv2 && AREv2.getMarkHTML) ? AREv2.getMarkHTML() : '';
  var cls = res.banner==='PASS'?'sum-pass':res.banner==='FAIL'?'sum-fail':'sum-review';
  $('sumOut').innerHTML='<div class="summary '+cls+'"><h3>'+(mark?mark+' &mdash; ':'')+'Seated connection: '+res.banner+'</h3><div>Governing: <b>'+res.governing+'</b> &mdash; max D/C = <b>'+f3(res.maxDC)+'</b>'+(res.banner==='REVIEW'?' &mdash; advisory rows need engineer judgment':'')+'</div></div>';
  var v=res.vals, cards='';
  cards+=card(f1(inp.Ru)+' k','R<sub>u</sub>')+card(f3(v.bb.lbMin)+' in','l<sub>b,min</sub> (J10)')+card(f3(v.lbProv)+' in','l<sub>b</sub> provided')+card(f2(v.e)+' in','e from support'+(v.eAuto?' (0.8&times;proj.)':''));
  if (v.weld) cards+=card(f3(v.weld.wg.fr)+' k/in','weld resultant f<sub>r</sub>')+card(f1(v.weld.wg.Dreq)+'/16','required fillet');
  if (v.bolt) cards+=card(f2(inp.Ru/inp.bolt.n)+' k','shear per bolt');
  if (v.tri) cards+=card(f1(v.tri.theta)+'&deg;','&theta; free edge')+card(f3(v.tri.lam),'&lambda; (Eq. 15-18)')+card(f1(v.tri.Fcr)+' ksi','F<sub>cr</sub> = QF<sub>y</sub>');
  $('demOut').innerHTML=cards;
  var b=inp.beam, seatDesc = inp.seatType==='angle' ? 'L'+inp.angle.leg+'&times;'+inp.angle.osl+'&times;'+f3(inp.angle.t)+' &times; '+inp.angle.L+' in long' : (inp.seatType==='rect'?'PL '+f3(inp.st.t)+'&times;'+inp.st.W+'&times;'+inp.st.L:'Triangular PL '+f3(inp.st.t)+', a = '+inp.st.A+', b = '+inp.st.W)+' &times; '+inp.st.n+' plate(s); seat PL '+f3(inp.sp.t)+'&times;'+inp.sp.B;
  $('propOut').innerHTML='<table class="prop-table"><tr><th>Item</th><th>Value</th></tr>'
    +'<tr><td>Beam</td><td>'+b.label+' &mdash; d = '+b.d+', t<sub>w</sub> = '+b.tw+', t<sub>f</sub> = '+b.tf+', k<sub>des</sub> = '+b.kdes+', b<sub>f</sub> = '+b.bf+' in; F<sub>y</sub> = '+b.Fy+', F<sub>u</sub> = '+b.Fu+' ksi</td></tr>'
    +'<tr><td>Seat</td><td>'+seatDesc+'; F<sub>y</sub> = '+inp.FySeat+', F<sub>u</sub> = '+inp.FuSeat+' ksi</td></tr>'
    +'<tr><td>Support</td><td>'+$('support').options[$('support').selectedIndex].text+', t = '+f3(inp.sup.t)+' in, F<sub>u</sub> = '+inp.sup.Fu+' ksi'+(inp.bothSides?', seats both sides':'')+'</td></tr>'
    +'<tr><td>Attachment</td><td>'+(inp.attach==='welded' ? f4(inp.weld.w)+' in fillet, E'+inp.weld.Fexx+', l = '+f2(v.weld.l)+' in + return '+f2(v.weld.h)+' in per line' : inp.bolt.n+' &times; '+f3(inp.bolt.d)+' in '+SEAT.BOLT[inp.bolt.grade].label+', '+inp.bolt.rows+' row(s) @ '+inp.bolt.pitch+' in')+'</td></tr>'
    +'</table>';
  var tb=$('chkTb'), sections=[], idx=0; tb.innerHTML='';
  res.checks.forEach(function(c){
    if (sections.indexOf(c.section)===-1){ sections.push(c.section); tb.innerHTML+='<tr class="sect-row"><td colspan="7">'+c.section+'</td></tr>'; }
    var dcCell, stxt;
    var sMap={PASS:'<span class="pass">PASS</span>',FAIL:'<span class="fail">FAIL</span>',REVIEW:'<span class="review">REVIEW</span>','N/A':'<span class="na">N/A</span>',INFO:'<span class="na">INFO</span>'};
    stxt=sMap[c.status]||c.status;
    if (c.dc===null){ dcCell='<span class="na">&mdash;</span>'; }
    else { var col=c.dc<=0.8?'#16a34a':c.dc<=1.0?'#d97706':'#dc2626'; var pct=Math.min(c.dc*100,150);
      dcCell='<div class="dc-cell"><span style="color:'+col+';font-weight:700">'+f3(c.dc)+'</span><div class="dc-bar"><div class="dc-fill" style="width:'+pct+'%;background:'+col+'"></div></div></div>'; }
    tb.innerHTML+='<tr><td><strong>'+c.name+'</strong>'+(c.note?'<div class="eq-note">'+c.note+'</div>':'')+'</td><td><code>'+c.ref+'</code></td><td>'+c.demand+'</td><td>'+c.capacity+'</td><td>'+dcCell+'</td><td>'+stxt+'</td><td><button class="det-btn" id="dbtn_'+idx+'" onclick="toggleDet('+idx+')">\u25B6 Calc</button></td></tr>'
      +'<tr class="det-row"><td colspan="7"><div class="calc-det" id="det_'+idx+'">'+c.det+'</div></td></tr>';
    idx++;
  });
  var rev=res.checks.filter(function(c){return c.status==='REVIEW';});
  $('reviewOut').innerHTML = rev.length ? '<div class="review-box"><h3>Advisory items ('+rev.length+')</h3><ul>'+rev.map(function(c){return '<li><b>'+c.name+'</b>'+(c.note?' &mdash; '+c.note:'')+'</li>';}).join('')+'</ul></div>' : '';
  $('noteOut').innerHTML='<b>Assumptions and limits</b><ul>'
    +'<li>Reaction at the beam end; setback '+f2(inp.setback)+' in plus '+f2(inp.underrun)+' in underrun (Manual Part 10 uses 1/2 + 1/4 in).</li>'
    +'<li>Reaction eccentricity e = '+f2(v.e)+' in from the support face'+(v.eAuto?' = 0.8 &times; projection (Manual Part 10 assumption: end rotation shifts the contact toward the seat edge)':' (user value)')+'.</li>'
    +(inp.attach==='welded' ? '<li>Weld model: two L-shaped lines, elastic, bending resisted at the top (tension) fiber with the compression side bearing on the support, shear on the vertical welds only, no directional increase unless selected. Reproduces Manual Tables 10-6 and 10-8 within the tolerances recorded in docs/seated-connection-hand-check-2026-09.md.</li>' : '<li>Bolts checked for shear only per Manual Tables 10-5 / 10-7 practice'+(inp.bolt.tension?', plus the optional elastic tension check (no prying)':'')+'.</li>')
    +(inp.seatType==='tri' ? '<li>Triangular stiffener per Manual Part 15 bracket-plate equations (Ex. II.A-23). PCI Eq. 6-47/6-48 shown for reference only.</li>' : '')
    +'<li>Not checked here: top stability angle (use L4&times;4&times;1/4 with two bolts or 3/16 in fillet per Manual Part 10), beam-to-seat bolts, column-web local yielding/crippling and the Sputo&ndash;Ellifritt (1991) limits for stiffened seats on column webs, seat plate bending, beam flange block shear (structural integrity, Ex. II.A-12B), ASD.</li>'
    +'</ul>';
  results.classList.add('show');
  draw(res);
  if (window.AREv2 && AREv2.publish) AREv2.publish([
    {symbol:'Ru', label:'Beam end reaction', value:inp.Ru, unit:'kips', kind:'load'},
    {symbol:'lb_min', label:'Minimum bearing length', value:v.bb.lbMin, unit:'in', kind:'geometry'},
    {symbol:'DC_max', label:'Governing D/C', value:res.maxDC, unit:'', kind:'ratio'}
  ]);
}
function runSelftest(){
  var r=SEAT.runFixtures(), ok=r.pass===r.total, title=(ok?'SELFTEST PASS ':'SELFTEST FAIL ')+r.pass+'/'+r.total;
  document.title=title; var pre=$('selftest-result'); pre.style.display='block'; pre.textContent=title+'\n'+r.lines.join('\n'); console.log(title); console.log(r.lines.join('\n'));
}
(function init(){
  fillBeams(); onBeamChange(); onModeChange();
  ['bd','btw','btf','bkdes','bbf','angLeg','angOSL','angT','angL','stW','stL','stA','stT','stN','spT','spB','eSeat','wLen','wRet','bLe','bPitch','bRows','bN','setback','underrun','Ru'].forEach(function(id){ var el=$(id); if (el) el.addEventListener('input', function(){ draw(); }); });
  // the are-utils toolbar (loaded after this script) owns #areMark; delegate so the schematic title follows Mark edits
  document.addEventListener('input', function(ev){ if (ev.target && ev.target.id==='areMark') draw(); });
  try { if (new URLSearchParams(window.location.search).get('selftest')==='1') runSelftest(); } catch(e){}
})();
```

Note `draw()` is defined in Task 5; until then add a temporary `function draw(){}` at the top of this block and remove it in Task 5.

- [ ] **Step 2: Run the node test**

Run from `$R`: `npm run test:seat`
Expected: engine PASS, `results shown after Run` PASS, `schematic drawn` FAIL (stub), mode rows PASS.

---

### Task 5: Schematic SVG

**Files:**
- Modify: `public/Calcs/seated_beam_connection_calculator.html` (UI block: replace the stub `draw`)

- [ ] **Step 1: Write `draw(res)`**

```js
function draw(res){
  var svg=$('schemSvg'); if (!svg) return;
  var st=$('seatType').value, at=$('attach').value;
  var proj = st==='angle' ? numv('angOSL') : numv('stW');
  var vlen = st==='angle' ? numv('angLeg') : (st==='rect' ? numv('stL') : numv('stA'));
  var tS = st==='angle' ? numv('angT') : numv('stT');
  var d = numv('bd'), sb=numv('setback'), ur=numv('underrun');
  if (![proj,vlen,tS,d].every(isFinite)) { svg.innerHTML=''; return; }
  var e = optv('eSeat'); if (e===null||!isFinite(e)) e=0.8*proj;
  // scale: fit (proj + 2.2*proj beam stub) wide and (vlen + d*0.9) tall into 560x330
  var sc = Math.min(560/(proj*3.4), 330/(vlen+0.9*d+1.5));
  var X0=200, Yseat=60+0.9*d*sc;        // support face x, seat top y
  var s='';
  var mark=(window.AREv2&&AREv2.getMark)?AREv2.getMark():'';
  s+='<text x="20" y="28" font-size="15" font-weight="700" fill="#1e3c72">'+(mark?mark+' \u2014 ':'')+'Seated connection \u2014 elevation</text>';
  // support (hatched band left of X0)
  s+='<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#64748b" stroke-width="1.5"/></pattern></defs>';
  s+='<rect x="'+(X0-40)+'" y="40" width="40" height="330" fill="url(#hatch)" stroke="#334155"/>';
  // beam stub: bottom flange on seat top
  var bx=X0+sb*sc, bw=proj*2.3*sc, tf=Math.max(4,numv('btf')*sc), tw=Math.max(3,numv('btw')*sc);
  s+='<rect x="'+bx+'" y="'+(Yseat-d*sc)+'" width="'+bw+'" height="'+tf+'" fill="#cbd5e1" stroke="#334155"/>';
  s+='<rect x="'+bx+'" y="'+(Yseat-tf)+'" width="'+bw+'" height="'+tf+'" fill="#cbd5e1" stroke="#334155"/>';
  s+='<rect x="'+(bx+bw/2-tw/2)+'" y="'+(Yseat-d*sc+tf)+'" width="'+tw+'" height="'+(d*sc-2*tf)+'" fill="#e2e8f0" stroke="#334155"/>';
  s+='<line x1="'+(bx+ur*sc)+'" y1="'+(Yseat-d*sc-6)+'" x2="'+(bx+ur*sc)+'" y2="'+(Yseat+6)+'" stroke="#94a3b8" stroke-dasharray="4 3"/>';
  // seat
  var ts=Math.max(3,tS*sc);
  if (st==='angle'){
    s+='<rect x="'+X0+'" y="'+Yseat+'" width="'+(proj*sc)+'" height="'+ts+'" fill="#fde68a" stroke="#92400e"/>';
    s+='<rect x="'+X0+'" y="'+Yseat+'" width="'+ts+'" height="'+(vlen*sc)+'" fill="#fde68a" stroke="#92400e"/>';
  } else {
    var spt=Math.max(3,numv('spT')*sc);
    s+='<rect x="'+X0+'" y="'+Yseat+'" width="'+(proj*sc)+'" height="'+spt+'" fill="#fde68a" stroke="#92400e"/>';
    if (st==='rect') s+='<rect x="'+X0+'" y="'+(Yseat+spt)+'" width="'+(proj*sc)+'" height="'+(vlen*sc)+'" fill="#fcd34d" stroke="#92400e"/>';
    else s+='<polygon points="'+X0+','+(Yseat+spt)+' '+(X0+proj*sc)+','+(Yseat+spt)+' '+X0+','+(Yseat+spt+vlen*sc)+'" fill="#fcd34d" stroke="#92400e"/>';
    if (st==='tri'){ var th=Math.atan(proj/vlen); var mx=X0+proj*sc/2, my=Yseat+spt+vlen*sc/2; var nx=Math.cos(th), ny=Math.sin(th);
      s+='<line x1="'+(mx-nx*40)+'" y1="'+(my-ny*40)+'" x2="'+(mx+nx*40)+'" y2="'+(my+ny*40)+'" stroke="#7c3aed" stroke-dasharray="5 3"/><text x="'+(mx+nx*46)+'" y="'+(my+ny*46)+'" font-size="11" fill="#7c3aed">B-B</text>'; }
  }
  // attachment symbols
  if (at==='welded'){
    var l=optv('wLen'); if (l===null||!isFinite(l)) l=vlen; var h=optv('wRet'); if (h===null||!isFinite(h)) h=0.2*l;
    var y0 = st==='angle' ? Yseat : Yseat+Math.max(3,numv('spT')*sc);
    s+='<line x1="'+X0+'" y1="'+y0+'" x2="'+X0+'" y2="'+(y0+l*sc)+'" stroke="#dc2626" stroke-width="4"/>';
    s+='<line x1="'+X0+'" y1="'+y0+'" x2="'+(X0+h*sc)+'" y2="'+y0+'" stroke="#dc2626" stroke-width="4"/>';
    s+='<text x="'+(X0-8)+'" y="'+(y0+l*sc/2)+'" font-size="11" fill="#dc2626" text-anchor="end">l = '+f2(l)+'"</text>';
    s+='<text x="'+(X0+h*sc+4)+'" y="'+(y0-4)+'" font-size="11" fill="#dc2626">h = '+f2(h)+'"</text>';
  } else {
    var rows=numv('bRows')||1, pitch=numv('bPitch')||3, le=numv('bLe')||1.25, r, yb;
    for (r=0;r<rows;r++){ yb = st==='angle' ? Yseat+(le+r*pitch)*sc : Yseat+Math.max(3,numv('spT')*sc)+(le+r*pitch)*sc;
      s+='<circle cx="'+(X0+ts/2)+'" cy="'+yb+'" r="5" fill="#1e3c72"/><line x1="'+(X0-40)+'" y1="'+yb+'" x2="'+(X0+ts)+'" y2="'+yb+'" stroke="#1e3c72" stroke-width="2"/>'; }
  }
  // reaction arrow at e
  var ax=X0+e*sc;
  s+='<line x1="'+ax+'" y1="'+(Yseat-d*sc-60)+'" x2="'+ax+'" y2="'+(Yseat-d*sc-8)+'" stroke="#c42b2b" stroke-width="3" marker-end="url(#arr)"/>';
  s+='<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto"><path d="M0,0 L8,0 L4,8 z" fill="#c42b2b"/></marker></defs>';
  s+='<text x="'+(ax+6)+'" y="'+(Yseat-d*sc-40)+'" font-size="13" fill="#c42b2b" font-weight="700">R<tspan font-size="9" dy="3">u</tspan><tspan dy="-3"> = '+f1(numv('Ru'))+' k</tspan></text>';
  // dimensions
  var yd=Yseat+ts+(st==='angle'?vlen:vlen)*sc+24;
  s+='<line x1="'+X0+'" y1="'+yd+'" x2="'+(X0+proj*sc)+'" y2="'+yd+'" stroke="#334155"/><text x="'+(X0+proj*sc/2)+'" y="'+(yd+14)+'" font-size="11" text-anchor="middle">'+(st==='angle'?'OSL':'W')+' = '+f2(proj)+'"</text>';
  s+='<line x1="'+X0+'" y1="'+(yd+30)+'" x2="'+ax+'" y2="'+(yd+30)+'" stroke="#c42b2b"/><text x="'+((X0+ax)/2)+'" y="'+(yd+44)+'" font-size="11" text-anchor="middle" fill="#c42b2b">e = '+f2(e)+'"</text>';
  s+='<line x1="'+(X0+proj*sc+16)+'" y1="'+Yseat+'" x2="'+(X0+proj*sc+16)+'" y2="'+(Yseat+ts+vlen*sc)+'" stroke="#334155"/><text x="'+(X0+proj*sc+22)+'" y="'+(Yseat+vlen*sc/2)+'" font-size="11">'+(st==='tri'?'a':st==='rect'?'L':'leg')+' = '+f2(vlen)+'"</text>';
  // section panel (right)
  var px=700, py=80, ps=Math.min(220/(proj+2), 200/(vlen+1));
  s+='<text x="'+px+'" y="'+(py-20)+'" font-size="13" font-weight="700" fill="#1e3c72">Section through seat</text>';
  var bfw=numv('bbf')*ps, spw=(st==='angle'?numv('angL'):numv('spB'))*ps;
  s+='<rect x="'+(px+110-bfw/2)+'" y="'+(py)+'" width="'+bfw+'" height="'+Math.max(3,numv('btf')*ps)+'" fill="#cbd5e1" stroke="#334155"/>';
  s+='<rect x="'+(px+110-spw/2)+'" y="'+(py+Math.max(3,numv('btf')*ps))+'" width="'+spw+'" height="'+Math.max(3,(st==='angle'?tS:numv('spT'))*ps)+'" fill="#fde68a" stroke="#92400e"/>';
  if (st!=='angle'){ var n=numv('stN')||1, k, gap=spw/(n+1);
    for (k=1;k<=n;k++) s+='<rect x="'+(px+110-spw/2+k*gap-tS*ps/2)+'" y="'+(py+Math.max(3,numv('btf')*ps)+Math.max(3,numv('spT')*ps))+'" width="'+Math.max(3,tS*ps)+'" height="'+(vlen*ps)+'" fill="#fcd34d" stroke="#92400e"/>'; }
  else s+='<rect x="'+(px+110-spw/2)+'" y="'+(py+Math.max(3,numv('btf')*ps)+Math.max(3,tS*ps))+'" width="'+spw+'" height="'+(vlen*ps)+'" fill="none" stroke="#92400e" stroke-dasharray="3 3"/>';
  svg.innerHTML=s;
}
```

Remove the temporary `function draw(){}` stub.

- [ ] **Step 2: Run the node test**

Run from `$R`: `npm run test:seat`
Expected: `ALL PASS`.

---

### Task 6: Browser verification

- [ ] **Step 1: Serve and open**

From the session cwd, `preview_start` launches `wri-calc-static` (python `http.server` on port 4188 rooted at `public/`). Navigate to `http://localhost:4188/Calcs/seated_beam_connection_calculator.html`.

- [ ] **Step 2: Check**

Read console (`read_console_messages`, errors only) → expect none. Click Run All Checks; `read_page` → banner PASS with governing "Stiffener to support weld" near D/C 0.95 (II.A-14: 125/131). Switch seat type to Unstiffened, attachment Bolted, Run → banner renders; switch to Triangular Welded, Run. Load `?selftest=1` → title `SELFTEST PASS n/n`. Screenshot the default run for the user.

- [ ] **Step 3: Resize to mobile once** (`resize_window` preset mobile) and confirm no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), then reset to desktop.

---

### Task 7: Registration, coverage, docs, copy

**Files:**
- Modify: `app/lib/calcs.ts` (insert after the `hss-column-bearing-on-beam` object, i.e. after its closing `},` ~line 241)
- Modify: `tools/calc-coverage.csv` (regenerate)
- Create: `docs/seated-connection-hand-check-2026-09.md`
- Create: `…/RE CODING/Steel/seated_beam_connection_calculator.html` (copy)

- [ ] **Step 1: calcs.ts entry** (file is CRLF — keep line endings; insert with an editor that preserves them)

```ts
  {
    slug: "seated-beam-connection",
    label: "Seated Beam Connection",
    subtitle: "Unstiffened angle, rectangular or triangular stiffened seat — welded or bolted to column flange/web or girder web · Manual Part 10 & 15",
    htmlFile: "/Calcs/seated_beam_connection_calculator.html",
    category: "Connections",
    spec: "AISC 360-22",
    status: "ready",
    keywords: ["seat", "seated connection", "seat angle", "stiffened seat", "triangular stiffener", "bracket plate", "Part 10", "Part 15", "Table 10-6", "Table 10-8", "J10", "web local yielding", "web local crippling", "PCI stiffener"],
    material: "Steel",
    calcType: "Connections",
    icon: "channel-bearing",
  },
```

- [ ] **Step 2: Regenerate coverage**

Run from `$R`: `node tools/derive-coverage.mjs --write && node tools/derive-coverage.mjs`
Expected: a new row `seated_beam_connection_calculator.html,1,0,0,…,0` and the second command exits 0.

- [ ] **Step 3: Hand-check doc**

Write `docs/seated-connection-hand-check-2026-09.md` containing the fixture table from spec §9 with a column "Design Example page" (IIA-124 to 147 for II.A-12A…16, IIA-217 to 229 for II.A-22/23, PCI 6-44) and the reverse-engineering note for Tables 10-6 and 10-8 (L-shaped elastic weld model, 0.8×projection, top fiber, vertical-weld shear; 66.9 vs 66.7, 53.5 vs 53.4, 131 vs 139).

- [ ] **Step 4: Copy to the Steel folder**

```bash
cp "$R/public/Calcs/seated_beam_connection_calculator.html" "/c/Users/nickh/OneDrive - Rohr Engineering/RE CODING/Steel/"
```

- [ ] **Step 5: Lint and qa**

Run from `$R`: `npm run lint` (expect clean for `app/lib/calcs.ts`) and `npm run qa:manifest && npm run test:seat` (expect exit 0).

---

### Task 8: Commit via the main work tree

- [ ] **Step 1: Copy into `/tmp/are-git` and commit**

```bash
W=/tmp/are-git; R="/c/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs"
cp "$R/public/Calcs/seated_beam_connection_calculator.html" "$W/public/Calcs/"
cp "$R/tools/test-seated-connection.mjs" "$W/tools/"
cp "$R/tools/calc-coverage.csv" "$W/tools/"
cp "$R/package.json" "$W/"
cp "$R/app/lib/calcs.ts" "$W/app/lib/"
mkdir -p "$W/docs/superpowers/specs" "$W/docs/superpowers/plans"
cp "$R/docs/seated-connection-hand-check-2026-09.md" "$W/docs/"
cp "$R/docs/superpowers/specs/2026-09-07-seated-beam-connection-design.md" "$W/docs/superpowers/specs/"
cp "$R/docs/superpowers/plans/2026-09-07-seated-beam-connection.md" "$W/docs/superpowers/plans/"
cd "$W" && git add -A public/Calcs/seated_beam_connection_calculator.html tools/test-seated-connection.mjs tools/calc-coverage.csv package.json app/lib/calcs.ts docs/seated-connection-hand-check-2026-09.md docs/superpowers && git diff --cached --stat
```

Before committing, check `git diff --cached package.json app/lib/calcs.ts` shows only the intended lines (the in-place repo's `package.json`/`calcs.ts` may carry unrelated local edits from the stale branch — if so, apply only the seat entry and script line by hand in `$W`).

```bash
git commit -m "feat(calcs): seated beam connection calculator (AISC Manual Part 10/15, verified vs Design Examples II.A-12–16, 22, 23)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do not push; deployment is Nick's call (`are-calcs-deploy`).
