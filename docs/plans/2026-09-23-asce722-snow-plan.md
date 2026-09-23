# ASCE 7-22 edition switch — Snow Load Calculator (2026-09-23) — FROZEN

Implementation spec for `public/Calcs/snow_load_calculator.html`. Implementer has zero context: every number, section, table and equation below was read from the ASCE 7-16 / 7-22 text and page images and is to be entered as written. Nothing here is open; §1 lists the decisions already taken.

Line numbers are against the file as read 2026-09-23 (2012 lines). Paths are under `public/` unless noted.

Sources: `…/scratchpad/asce716/ch07.txt` + rendered pages `asce716/png/p0106–p0121.png` (ASCE 7-16 Ch. 7, PDF pp. 106-121); `…/scratchpad/asce722/ch07.txt`, `c07.txt`, `ch01.txt` + `asce722/png/p0116–p0131.png` (ASCE 7-22 Ch. 7, pp. 55-70).

---

## 1. Decisions (Nick, 2026-09-23)

| # | Decision |
|---|---|
| D1 | Build **Phase 0 + Phase A + Phase B** in this pass: Phase 0 corrects the live 7-16 path; Phase A adds the 7-22 edition on the existing scope; Phase B adds sloped-roof Cs, minimum low-slope load pm, rain-on-snow and unbalanced gable for both editions. |
| D2 | **7-22 loads are presented at strength level only.** No ASD 0.7 conversion anywhere in the outputs or code; one caption tells the user 1.0S (LRFD) / 0.7S (ASD) apply in the combinations. |
| D3 | **W2** is a required 7-22 input: blank → drifts and unbalanced surcharge are not computed (zeros + visible warning). No silent default. |
| D4 | 7-22 windward / parapet drift when 0.75hd > hc: height = hc, width = 8·(0.75hd)²/hc (area-equivalent, consistent with the 7-16 4hd²/hc treatment), no 8hc cap. |
| D5 | 7-22 "Table 7.4-1" (cited in §7.4.1) does not exist in the standard: a text search of the full ASCE 7-22 PDF finds the string only in the §7.4.1 sentence itself; pages p0116-p0131 (Ch. 7 complete) contain no such table. The Cs panel rule is 7-22 §7.4.4 (last paragraph); the 7-16 warm-roof R-value gate is not carried into 7-22. |
| D6 | pg entry: the user types the single pg for the selected Risk Category as the ASCE Hazard Tool reports it. `#riskCat` drives pm,max and labels only. |
| D7 | The existing 7-16 drift path is an ASCE 7-10 remnant (Fig. 7-9 form, lu floor 25 ft, no Is). It is **fixed in Phase 0** to ASCE 7-16 Fig. 7.6-1 exactly, with an explicit baseline ALLOW list and hand-checked new values (§7.2). |
| D8 | `<title>` stays "Snow Load Calculator - ASCE 7-10" (it feeds `AREv2.snapshotName`, are-utils-v2.js :1213 — changing it renames every saved file). Only the badge text changes. |

## 2. What the calc implements today (read of the file)

| Ch. 7 item | Implemented? | Where |
|---|---|---|
| Flat-roof pf = 0.7·Ce·Ct·Is·pg (Eq. 7.3-1) | Yes | `calculateBasics()` :896-909; `#factor` input is the 0.7 |
| Ce (Table 7.3-1) | Yes, 6-option select | `#ce` :500-507 (label says "Table 7-2", a 7-10 number) |
| Ct (Table 7.3-2) | Yes, 5-option select incl. 1.1 | `#ct` :511-517 (label "Table 7-3", 7-10 number) |
| Is (Table 1.5-2) | Yes | `#is` :521-526 |
| γ = min(0.13pg+14, 30) (Eq. 7.7-1) | Yes | :903 |
| hb = pf/γ | Yes (pf, not ps — no slope block) | :906 |
| Drift height hd | Yes, **wrong edition**: hd = 0.43·lu^(1/3)·(pg+10)^(1/4) − 1.5 with lu floor 25 ft, no Is ("ASCE 7 Fig. 7-9" = 7-10) | `calculateDrift()` :926-928 |
| Leeward / windward / parapet drift, hc/hb ≥ 0.2 gate, 0.75hd, w = 4h or 4h²/hc, cap 8hc (same rule all types), pd = γ·h | Yes | :917-958 |
| pm (§7.3.4), Cs / ps (§7.4), rain-on-snow (§7.10), unbalanced (§7.6.1) | No | Phase B |
| Sliding (§7.9), adjacent structures (§7.7.2), intersecting drifts (§7.7.3), leeward 60 % cap, projection exception (§7.8) | No | non-goal |
| Joist perpendicular / parallel | Yes (mechanics) | :1106-1312 |
| Output refs printed | "ASCE 7-16 Eq. 7.3-1 / Eq. 7.7-1 / §7.7.1" | `renderBasicCalcsTable()` :983-996 |
| Toolbar | AREv2 (`/are-utils-v2.js`), `runCalcs()` :1322, `#configData` mirror :548 / :1316-1319, `AREv2.publish` :2001-2005 | |

## 3. Phase 0 — correct the live ASCE 7-16 path

Verified from ASCE 7-16 Fig. 7.6-1 (page image p0116, equation zoomed at 300 dpi) and §7.7.1 / §7.8 / §7.6.1 text:

- **Fig. 7.6-1 equation:** hd/√Is = (0.43·∛lu·∜(pg + 10)) − 1.5, i.e. **hd = √Is · (0.43·lu^(1/3)·(pg+10)^(1/4) − 1.5)**.
- **Fig. 7.6-1 notes:** "If lu < 20 ft, use lu = 20 ft, except hd for this small fetch case need not be taken greater than √(Is·pg·lu/4γ) where lu is the actual fetch distance, not the minimum fetch of 20 ft."
- §7.7.1: leeward hd "directly from Fig. 7.6-1 using the length of the upper roof and the Snow Importance Factor from Table 1.5-2"; windward = ¾ of the Fig. 7.6-1 hd with the lower-roof length; if the height ≤ hc → w = 4hd, else height = hc and w = 4hd²/hc; w ≤ 8hc. The rule is stated once for "this height" (leeward and windward alike) — the existing width code is correct.
- §7.8: parapets / projections use the §7.7.1 method at 0.75hd (existing).

Phase 0 code (the 7-16 branch of `ED['7-16'].hd`, §4.3):

```js
hd: (pg, lu, W2, gamma, Is) => {
  const luE = Math.max(lu, 20);
  let hd = Math.sqrt(Is) * (0.43 * Math.pow(luE, 1/3) * Math.pow(pg + 10, 1/4) - 1.5);
  if (lu < 20) hd = Math.min(hd, Math.sqrt(Is * pg * lu / (4 * gamma)));   // small-fetch cap, actual lu
  return Math.max(hd, 0);
}
```

Other Phase 0 corrections (labels only): `#ce` label "Table 7-2" → "Table 7.3-1"; `#ct` label "Table 7-3" → "Table 7.3-2"; explanation list :830-831 → the 7-16 equation and the 20 ft note; drift-table caption "ASCE 7-16 Fig. 7.6-1 (lu ≥ 20 ft; small-fetch cap √(Is·pg·lu/4γ))"; badge :461 "ASCE 7-10 / 7-16" → "ASCE 7-16"; code comment :926 "Fig. 7-9" → "Fig. 7.6-1".

`calculateBasics()` (pf, γ, hb) and the width / pd logic are **not** changed by Phase 0; only `hd` changes, so every baseline difference traces to `hd` (§7.2 gives the expected new numbers).

## 4. Edition switch mechanics

### 4.1 Control

Static DOM, inside the Input Parameters card above the pg row (:480):

```html
<div class="form-group"><div class="form-row form-row-2">
  <div><label>Code edition</label>
    <select id="edition">
      <option value="7-16" selected>ASCE 7-16</option>
      <option value="7-22">ASCE 7-22</option>
    </select></div>
  <div id="riskCatWrap" class="ed22"><label>Risk Category — ASCE 7-22 Table 1.5-1</label>
    <select id="riskCat"><option value="I">I</option><option value="II" selected>II</option><option value="III">III</option><option value="IV">IV</option></select></div>
</div></div>
```

Static elements only (no `data-are-ignore`): they must persist so the edition rides in saved state. `getEdition()` = `document.getElementById('edition').value === '7-22' ? '7-22' : '7-16'`.

### 4.2 7-22-only inputs (static DOM, class `ed22`, hidden in 7-16)

| id | Type | Default | Purpose |
|---|---|---|---|
| `#riskCat` | select I/II/III/IV | II | pm,max (Table 7.3-4); pg label "pg — ASCE Hazard Tool, Risk Category {rc} (strength level)" |
| `#ct22` | select: `r` "Heated, unventilated roof — Table 7.3-3 (R-value)"; `1.2` "Unheated / open-air / kept just above freezing (40–50 °F) / cold ventilated roof meeting the energy code (Table 7.3-2)"; `1.3` "Freezer building"; `0.85` "Continuously heated greenhouse, R < 2.0 or U > 0.5" | `r` | 7-22 Ct source |
| `#rroof` | number, step 1, min 0 | 30 | Rroof (h·ft²·°F/Btu) for Table 7.3-3; wrapper shown only when `#ct22` = `r` |
| `#w2` | number, step 0.05, min 0.1, max 0.9, placeholder "0.25–0.65 (Fig. 7.6-1)" | *blank* | Winter wind parameter (Fig. 7.6-1 / Hazard Tool / Table 7.2-1 Alaska). Required for drifts and the unbalanced surcharge (D3). |

7-16-only (class `ed16`, hidden in 7-22): the `#is` wrapper (:519-527), the `#ct` wrapper (:509-518), and Phase B `#slipperyR`. All elements stay in the DOM in both modes (wrapper `display:none`) so saved-state key sets are stable and old files never hit `missingOnPage`.

`applyEditionVisibility()` runs on `#edition` / `#ct22` `change` and on load: sets `body.ed-7-16` / `body.ed-7-22`, toggles the `#rroof` wrapper, sets the badge text ("ASCE 7-16" / "ASCE 7-22"), then `updateDisplay()`. CSS: `.ed16,.ed22{display:none} body.ed-7-16 .ed16{display:block} body.ed-7-22 .ed22{display:block}`.

### 4.3 Edition-keyed data structure

Above `getInputs` (:885):

```js
const ED = {
  '7-16': {
    label: 'ASCE 7-16', usesIs: true,
    ref: { pf:'ASCE 7-16 Eq. 7.3-1', ce:'ASCE 7-16 Table 7.3-1', ct:'ASCE 7-16 Table 7.3-2', is:'ASCE 7-16 Table 1.5-2 / §7.3.3',
           gamma:'ASCE 7-16 Eq. 7.7-1', hb:'ASCE 7-16 §7.7.1', hd:'ASCE 7-16 Fig. 7.6-1', drift:'ASCE 7-16 §7.7.1', parapet:'ASCE 7-16 §7.8',
           pm:'ASCE 7-16 §7.3.4', ros:'ASCE 7-16 §7.10', cs:'ASCE 7-16 Fig. 7.4-1 / §7.4.1–7.4.2', unbal:'ASCE 7-16 §7.6.1 / Fig. 7.6-2', w2:null, level:null },
    hd: /* Phase 0 function, §3 */,
    windwardWidth: null,                                   // null → the §7.7.1 4h / 4h²/hc / 8hc rule for every type
    pmMax: null,                                           // pm = Is·pg (pg ≤ 20) else 20·Is
    ros: { pgLimit: () => 20, surcharge: 5 },
    csPanel: (ct) => ct <= 1.0 ? 'a' : (ct < 1.2 ? 'b' : 'c'),   // Fig. 7.4-1: 7-2a warm Ct ≤ 1.0; 7-2b cold Ct = 1.1; 7-2c Ct ≥ 1.2
    warmSlipperyNeedsR: true,                              // Fig. 7.4-1a dashed line only with R ≥ 30 unvent. / R ≥ 20 vent. (§7.4.1)
    unbalLuMin: 20,                                        // §7.6.1 "For W less than 20 ft, use W = lu = 20 ft in Fig. 7.6-1"
    unbalSimpleLeeward: (pg, Is) => Is * pg                // §7.6.1 "equal to Ipg"
  },
  '7-22': {
    label: 'ASCE 7-22', usesIs: false,
    ref: { pf:'ASCE 7-22 Eq. 7.3-1', ce:'ASCE 7-22 Table 7.3-1', ct:'ASCE 7-22 Tables 7.3-2 / 7.3-3', is:null,
           gamma:'ASCE 7-22 Eq. 7.7-1', hb:'ASCE 7-22 §7.7.1', hd:'ASCE 7-22 Eq. 7.6-1', drift:'ASCE 7-22 §7.7.1', parapet:'ASCE 7-22 §7.8',
           pm:'ASCE 7-22 §7.3.3 / Table 7.3-4', ros:'ASCE 7-22 §7.10', cs:'ASCE 7-22 Fig. 7.4-1 / §7.4.4', unbal:'ASCE 7-22 §7.6.1 / Fig. 7.6-2',
           w2:'ASCE 7-22 Fig. 7.6-1', level:'ASCE 7-22 C7.2' },
    hd: (pg, lu, W2, gamma) => 1.5 * Math.sqrt(Math.pow(pg, 0.74) * Math.pow(lu, 0.70) * Math.pow(W2, 1.7) / gamma),   // Eq. 7.6-1
    windwardWidth: (h, hc) => h <= hc ? 8 * h : 8 * h * h / hc,   // §7.7.1 "eight times the windward drift height"; h > hc per D4
    pmMax: { I: 25, II: 30, III: 35, IV: 40 },                     // Table 7.3-4
    ros: { pgLimit: (rc) => ({ I: 25, II: 30, III: 35, IV: 40 })[rc], surcharge: 8 },   // §7.10
    csPanel: (ct) => ct <= 1.1 ? 'a' : (ct < 1.2 ? 'b' : 'c'),   // §7.4.4 last paragraph
    warmSlipperyNeedsR: false,                                     // D5
    unbalLuMin: 0,                                                 // no floor (C7.7: "these limits are no longer needed")
    unbalSimpleLeeward: (pg, Is) => pg                             // §7.6.1 "equal to pg"
  }
};
const CT_733 = {   // ASCE 7-22 Table 7.3-3 (page image p0123)
  pg: [10, 20, 30, 40, 50, 60, 70],          // columns ≤10 … ≥70 psf
  r:  [20, 30, 40, 50],                      // rows ≤20 … 50 h·ft²·°F/Btu; > 50 → 1.20 (fn. b)
  ct: [[1.20, 1.11, 1.05, 1.01, 1.00, 1.00, 1.00],
       [1.20, 1.17, 1.14, 1.13, 1.12, 1.11, 1.10],
       [1.20, 1.19, 1.17, 1.16, 1.16, 1.15, 1.15],
       [1.20, 1.20, 1.19, 1.19, 1.19, 1.18, 1.18]]
};
```

`ctFromTable733(pg, R)`: `R > 50` → 1.20; clamp pg to [10, 70] and R to [20, 50]; linear interpolation along pg within each R row, then along R (fn. a). Checks: (30, 30) → 1.14; (40, 30) → 1.13; (27.5, 20) → 1.065; (42.9, 20) → 1.0071; (35, 25) → 1.0825; (5, 60) → 1.20; (80, 55) → 1.20.

### 4.4 Calculation contract

`getInputs()` (:885-893) adds `edition, riskCat, ct22, rroof, w2 (NaN when blank)` and the Phase B inputs (§5). In 7-22 `is` is forced to 1 and Ct is resolved:

```
ct = edition === '7-16' ? inputs.ct : (inputs.ct22 === 'r' ? ctFromTable733(pg, rroof) : parseFloat(inputs.ct22))
```

`calculateBasics()` keeps `{pf, gamma, hb}`. 7-16: `pf = inputs.factor * inputs.ce * inputs.ct * inputs.is * inputs.pg` **exactly as at :900** (operation order matters at the 1e-9 baseline tolerance). 7-22: `pf = inputs.factor * inputs.ce * ct * inputs.pg`. Added keys (additive; the baseline diff walks expected keys only): `edition, ct, ctSource ('select'|'table733'), level ('service'|'strength'), w2, w2Missing, theta, cs, ps, pm, pmApplies, ros, rosApplies, unbal` (§5). `hb = ps / gamma` (ps = pf at zero slope → baseline unchanged).

`calculateDrift(config, basics)` keeps `{hc, hcHbRatio, driftHeight, W, pd, totalPressure}`; adds `hd` (raw), `hDrift` (before the hc cap), `note`:

```
hc = max(hr − hb, 0); ratio = hb > 0 ? hc/hb : 0
if edition === '7-22' && !(w2 > 0): driftHeight = W = pd = 0; note = 'W2 required'; totalPressure = ps; return
if ratio >= 0.2:
  hd = ED[ed].hd(pg, lu, w2, gamma, is)
  h  = type === 'leeward' ? hd : 0.75 * hd;  h = max(h, 0)
  if ED[ed].windwardWidth && type !== 'leeward':
      driftHeight = min(h, hc); W = ED[ed].windwardWidth(h, hc); pd = gamma * driftHeight
  else (7-16 all types, 7-22 leeward) — existing :941-958 verbatim:
      W = h <= hc ? 4h : 4h²/hc; W = min(W, 8hc); pd = h < hc ? gamma*h : gamma*hc; driftHeight = min(h, hc)
totalPressure = pd + basics.ps
```

**Strength-level presentation (D2).** In 7-22 every load printed (pf, ps, pm, rain-on-snow, unbalanced, pd, totals, joist plf / reactions / moments, diagram callouts, `AREv2.publish`) is the equation value; no 0.7 factor in code. Caption at the top of the Basic Calculations card in 7-22 mode: "ASCE 7-22 snow loads are strength level: use 1.0S in LRFD combinations; ASD combinations apply 0.7S (C7.2)." Nothing printed in 7-16.

`window.__snowLast` (set at the end of `updateDisplay`): `{ edition, inputs, basics, drifts: configurations.map((c) => ({ ...c, ...calculateDrift(c, basics) })), refs: ED[ed].ref }`.

### 4.5 Save / load

- New inputs are static and persisted automatically.
- Legacy shim (pattern: `asce716_mwfrs_calculator.html` :1959-1985 `installMwfrsShim`): wrap `AREv2.loadFromState`; for `state.calcFile === 'snow_load_calculator.html'`, inject defaults for keys absent from `state.fields` whose element exists: `{ '#edition':'7-16', '#riskCat':'II', '#ct22':'r', '#rroof':'30', '#w2':'', '#slopeRise':'0', '#roofSurface':'other', '#slipperyR':false, '#eaveRidgeW':'', '#gableSimple':false }`. Old files load as 7-16, `ok:true`, no `rolledBack`, no mismatches. Guard `AREv2._snowShim`.
- `#edition` handler on `change` (the toolbar restore fires `change`).
- **Do not** add `data-are-ignore` to the existing per-row `#cfgType_i` / `#cfgHr_i` / `#cfgLu_i` controls (:1049-1061) — they are in every saved file's key set. No new calc-time selects are needed; any that are added must carry `data-are-ignore`.

### 4.6 References and labels

`renderBasicCalcsTable()` (:975-1014): refs from `ED[ed].ref`; pf substitution drops "× Is" in 7-22 and prints the resolved Ct with source ("Ct = 1.14 — Table 7.3-3, Rroof 30, pg 30"); rows added: Ct, W2 (7-22), Cs / ps, pm, rain-on-snow, unbalanced (§5); 7-22 strength caption. Configurations table caption: 7-16 "Drift height: ASCE 7-16 Fig. 7.6-1 (lu ≥ 20 ft; small-fetch cap)"; 7-22 "Drift height: ASCE 7-22 Eq. 7.6-1, W2 = {w2}". Explanations card (:824-833): two `<ul>`s toggled by `.ed16` / `.ed22`. `AREv2.publish` (:2001-2005): labels get " (ASCE 7-16)" / " (ASCE 7-22, strength level)"; values unchanged. 7-22 pg row gets the informational §7.2 exception note (pg ≤ 10 psf with lu ≤ 100 ft, or pg ≤ 5 psf with lu ≤ 300 ft → provisions need not be considered); no gating.

## 5. Phase B — sloped / minimum / rain-on-snow / unbalanced (both editions)

New card "Roof Geometry (balanced-load cases)" under Input Parameters; static, persisted:

| id | Type | Default | Note |
|---|---|---|---|
| `#slopeRise` | number ≥ 0, step 0.25 | 0 | rise per 12; θ = atan(rise/12) deg; S = 12/rise |
| `#roofSurface` | select `other` / `slippery` | other | "unobstructed slippery surface with space below the eaves" (§7.4 text, both editions) |
| `#slipperyR` | checkbox, class `ed16` | off | 7-16 §7.4.1 warm-roof gate: unventilated R ≥ 30 or ventilated R ≥ 20 (Fig. 7.4-1a note) |
| `#eaveRidgeW` | number ≥ 0 | blank | W, eave-to-ridge (ft); blank → rain-on-snow and unbalanced report "n/a — enter W" |
| `#gableSimple` | checkbox | off | "simply supported prismatic members spanning ridge to eave" (W ≤ 20 ft rule) |

Computations in `calculateBasics()` (additive keys; at slope 0 and W blank every case is "n/a" and ps = pf, so the 7-16 baseline is unchanged):

```
theta = atan(rise/12)·180/π
panel = ED[ed].csPanel(ct)
slipperyOK = surface === 'slippery' && !(ED[ed].warmSlipperyNeedsR && panel === 'a' && !slipperyR)
knee = slipperyOK ? {a:5, b:10, c:15}[panel] : {a:30, b:37.5, c:45}[panel]      // Fig. 7.4-1 (both editions, image-verified)
cs = theta <= knee ? 1 : (theta >= 70 ? 0 : 1 − (theta − knee)/(70 − knee))
ps = cs·pf
pmApplies = theta < 15                                                            // monoslope / hip / gable
pm = 7-16: (pg <= 20 ? is·pg : 20·is) ; 7-22: min(pg, pmMax[rc])
rosApplies = pg > 0 && pg <= ED[ed].ros.pgLimit(rc) && W > 0 && theta < W/50
ros = ps + ED[ed].ros.surcharge                                                   // balanced case only
unbalApplies = W > 0 && theta > 2.38 && theta <= 30.2
  if W <= 20 && gableSimple: leeward = ED[ed].unbalSimpleLeeward(pg, is); windward = 0; surcharge = extent = null
  else: luU = max(W, ED[ed].unbalLuMin); hdU = ED[ed].hd(pg, luU, w2, gamma, is)  (7-22 with W2 blank → w2Missing, unbal not computed)
        S = 12/rise; windward = 0.3·ps; surcharge = hdU·γ/√S; extent = 8·hdU·√S/3 (from the ridge); leewardPeak = ps + surcharge
```

Rendered as `chk-table` rows with edition refs; each non-applying case prints "n/a — {reason}". Minimum, rain-on-snow, unbalanced and drift are separate cases and are never summed (§7.3.3/7.3.4, §7.10, §7.9).

## 6. Change table (7-16 → 7-22)

| # | Item | ASCE 7-16 | ASCE 7-22 | 7-22 ref | Code location |
|---|---|---|---|---|---|
| 1 | Ground snow load pg | 50-yr MRI map, one value; Is applied | Strength-level, risk-targeted, **one value per Risk Category** from the ASCE Design Ground Snow Load Geodatabase / Hazard Tool (Figs. 7.2-1A–D, Table 7.2-1 Alaska); case-study sites need Table 1.3-1 reliability + AHJ approval | §7.2, C7.2 | `#pg` label, `#riskCat` (D6) |
| 2 | Importance factor Is | Table 1.5-2 (0.8/1.0/1.1/1.2) in pf, pm, Fig. 7.6-1, deck load Is·pg | **Eliminated** (Table 1.5-2 lists only seismic Ie; "Snow importance factors have also been eliminated", C7.2) | §7.3, Table 1.5-2, C7.2 | `usesIs:false`; `#is` hidden, forced 1 |
| 3 | Load level | Service level: LRFD 1.6S, ASD 1.0S | Strength level: LRFD **1.0S**, ASD **0.7S** ("The 0.7 factor is intended to provide roughly equivalent strength when design follows ASD … inverse of 1.5 rounded to 0.7") | C7.2 | caption only (D2) |
| 4 | Flat-roof load | pf = 0.7·Ce·Ct·Is·pg | pf = 0.7·Ce·Ct·pg | Eq. 7.3-1 | `calculateBasics()` |
| 5 | Ce | Table 7.3-1: B 0.9/1.0/1.2; C 0.9/1.0/1.1; D 0.8/0.9/1.0; above tree line 0.7/0.8/NA; Alaska no trees 0.7/0.8/NA | **Unchanged** values and footnotes | Table 7.3-1 (p0122) | `#ce` options unchanged |
| 6 | Ct | Table 7.3-2: 1.0 all others; **1.1** kept just above freezing / cold ventilated R > 25; 1.2 unheated & open-air; 1.3 freezer; 0.85 greenhouse R < 2 | Table 7.3-2: "all structures except as follows" → **Table 7.3-3 by pg × Rroof (1.00–1.20)**; **1.2** unheated, open-air, kept just above freezing (40–50 °F), cold ventilated roofs meeting the energy code; 1.3 freezer; 0.85 greenhouse R < 2.0 or U > 0.5. No 1.1 row. Table 7.3-3 grid in §4.3; fn. a interpolate; fn. b Rroof > 50 → 1.2 | §7.3.2, Tables 7.3-2 / 7.3-3 (p0122, p0123) | `#ct22`, `#rroof`, `CT_733` |
| 7 | γ | 0.13pg + 14 ≤ 30 pcf | **Unchanged** | Eq. 7.7-1 | :903 |
| 8 | hb | ps/γ | **Unchanged** | §7.7.1 | :906 |
| 9 | Drift height hd | Fig. 7.6-1: hd = √Is·(0.43·∛lu·∜(pg+10) − 1.5); lu ≥ 20 ft; small-fetch cap √(Is·pg·lu/4γ) | **hd = 1.5·√(pg^0.74·lu^0.70·W2^1.7/γ)** (Eq. 7.6-1, p0126); no lu minimum. Verified: Ex. 1 (pg 30, lu 30, W2 0.55, γ 17.9) → 2.469 (text 2.46); Ex. 3 leeward (pg 32, lu 100, W2 0.5, γ 19) → 3.449 (text 3.4). Ex. 3 windward prints 4.55 for lu 240; the equation gives 4.686 (4.55 corresponds to lu ≈ 220) — commentary inconsistency, equation governs | Eq. 7.6-1, §7.7.1, C7.6.1, C7.7 | `ED[…].hd` |
| 10 | Winter wind parameter W2 | — | New: percent of Oct–Apr time with wind > 10 mph; Fig. 7.6-1 map (contours 0.25–0.65) / Hazard Tool / Table 7.2-1 Alaska (0.1–0.9); above tree line or special wind regions use local records (C7.6.1) | §7.1.2, Fig. 7.6-1 (p0127) | `#w2` (D3) |
| 11 | Leeward geometry | h ≤ hc → w = 4hd; else h = hc, w = 4hd²/hc; w ≤ 8hc; hd ≤ 60 % lower-roof length | **Unchanged** | §7.7.1 | existing branch |
| 12 | Windward / parapet width | 0.75hd; same 4h / 4h²/hc / 8hc rule | 0.75hd; **w = 8 × windward height (= 6hd)** — Ex. 3: 0.75·4.55 = 3.41 → 27.3 ft. h > hc: D4 | §7.7.1, §7.8, C7.14 Ex. 3 | `windwardWidth` |
| 13 | Parapet / projection lu, exception | upwind length / greater of up- and downwind; side < 15 ft or ≥ 2 ft clear → none | **Unchanged** | §7.8 | n/a |
| 14 | hc/hb < 0.2 gate | not required | **Unchanged** | §7.7.1 | :925 |
| 15 | Minimum low-slope pm | pg ≤ 20 → Is·pg; else 20·Is; slopes < 15° (curved < 10°) | **pm = pg if pg ≤ pm,max else pm,max**; Table 7.3-4 = 25/30/35/40 psf for RC I–IV; same slope gates; separate case | §7.3.3, Table 7.3-4 (p0123) | Phase B |
| 16 | Rain-on-snow | pg ≤ 20 (≠ 0), θ < W/50 → **+5 psf** | **pg ≤ pm,max (Table 7.3-4)**, ≠ 0, θ < W/50 → **+8 psf**, balanced case only. C7.10: ¼:12, W 100, pg 32, RC IV → ps 24.6 + 8 = 32.6 governs over pm 32 | §7.10, C7.10 | Phase B |
| 17 | Cs, Fig. 7.4-1 | 7-2a warm Ct ≤ 1.0 (dashed slippery line needs R ≥ 30 unvent. / R ≥ 20 vent.); 7-2b cold Ct = 1.1; 7-2c Ct ≥ 1.2 (p0114) | Same three graphs re-keyed **(a) Ct ≤ 1.1; (b) 1.1 < Ct < 1.2; (c) Ct ≥ 1.2** (§7.4.4, p0124). Knees: all other surfaces 30° / 37.5° / 45°; slippery 5° / 10° / 15°; zero at 70° (p0123). "Table 7.4-1" does not exist (D5) | §7.4, §7.4.4, Fig. 7.4-1 | Phase B `csPanel` |
| 18 | Unbalanced gable/hip | 2.38° < θ ≤ 30.2°; W ≤ 20 ft simple → leeward **Is·pg**; else 0.3ps / ps + hdγ/√S over 8hd√S/3, hd from Fig. 7.6-1 with lu = W, **W < 20 → lu = 20** | Same gates; W ≤ 20 case leeward = **pg** (text; Fig. 7.6-2 image still prints "I·pg" — text governs); hd from **Eq. 7.6-1 with lu = W, no floor**. Ex. 1: 6:12, W 30 → 31.1 psf over 9.3 ft | §7.6.1, Fig. 7.6-2, C7.14 Ex. 1 | Phase B |
| 19 | Sliding | 0.4pf·W over 15 ft | **Unchanged** | §7.9 | non-goal |
| 20 | Adjacent structures, intersecting drifts, open-frame, ponding | — | Unchanged | §7.7.2, 7.7.3, 7.13 | non-goal |
| 21 | Ground-level accumulation surfaces | Is·pg | pg | §7.2 | label only |
| 22 | Exemption thresholds | — | New: pg ≤ 10 with lu ≤ 100 ft, or pg ≤ 5 with lu ≤ 300 ft | §7.2 | note only |

## 7. Harness — `tools/test-snow.mjs` + `fixtures/snow/`

House pattern: `tools/test-mwfrs-wind.mjs` (Playwright chromium, `page.route` serving `public/`, `check()`, `diff()` at `TOL = 1e-9`, `--capture`, exit 1 on failure). `FILE = 'snow_load_calculator.html'`; `fresh()` = goto + `waitForSelector('#areBar')`. Config rows are driven through `#cfgType_i` (`selectOption`), `#cfgHr_i` / `#cfgLu_i` (`fill`, fires `change` → `updateDisplay()`), the `Add Configuration` button and the row `Remove` buttons. Joist sources via `selectOption('#perp-drift-source', idx)` / `'#parallel-drift-source'`.

### 7.1 Snapshot (pre-existing globals only, so it runs before and after every phase)

```js
async function snapshot() {
  return page.evaluate(() => {
    const b = calculateBasics();
    const txt = (id) => document.getElementById(id).textContent.trim();
    const val = (id) => document.getElementById(id).value;
    return {
      basics: { pf: b.pf, gamma: b.gamma, hb: b.hb },
      drifts: configurations.map((c) => { const d = calculateDrift(c, b);
        return { name: c.name, type: c.type, hr: c.hr, lu: c.lu, hc: d.hc, hcHbRatio: d.hcHbRatio, driftHeight: d.driftHeight, W: d.W, pd: d.pd, totalPressure: d.totalPressure }; }),
      perp: { pd: val('perp-drift-load'), pf: val('perp-balanced-load'), W: val('perp-drift-width'), u: txt('perp-uniform-load'), t: txt('perp-triangular-peak'), RL: txt('perp-left-reaction'), RR: txt('perp-right-reaction'), M: txt('perp-moment') },
      par: { max: val('parallel-max-load'), pf: val('parallel-roof-snow'), W: txt('parallel-drift-width'), n: txt('parallel-num-joists'), mj: txt('parallel-max-joist-load'), dlll: txt('parallel-total-dl-ll'), ll: txt('parallel-total-ll'), rows: document.getElementById('parallel-joists-table').innerText },
      table: document.getElementById('configurations-table').innerText,
      basicsHtml: document.getElementById('basicCalcsTable').innerText
    };
  });
}
```

### 7.2 Baseline (captured from the **unmodified** calc; Phase 0 differences are the only ALLOW list)

| Case | Inputs (7-16) |
|---|---|
| `b0-defaults` | page defaults: pg 42.9, factor 0.7, Ce 1.0, Ct 1.0, Is 1.0, six stock configurations; perp source 4 (Leeward Drift), spacing 24, length 20, peak right; parallel source 0, distance 0.5, spacing 6, DL 19 |
| `b1-lowsnow` | pg 25, Ce 0.9, Ct 1.1, Is 1.1; rows: 0 parapet hr 1.5 lu 40; 1 leeward hr 12 lu 60; 2 windward hr 12 lu 30; remove rows 3-5; perp source 1, length 30, peak left; parallel source 2, spacing 4, DL 15 |
| `b2-heavy-smallfetch` | pg 70, Ce 1.2, Ct 1.2, Is 1.2; rows: 0 parapet hr 5 lu 4 (small-fetch cap); 1 leeward hr 6 lu 200; remove rows 2-5; perp source 0; parallel source 1 |
| `b3-light` | pg 15, Ce 0.7, Ct 0.85, Is 0.8; row 0 windward hr 4 lu 100; remove rows 1-5; perp source 0 spacing 16 length 24; parallel source 0 spacing 8 |

Also captured at step 0: `fixtures/snow/legacy-716-state.json` = `AREv2.captureState()` on the `b1` inputs (a genuine pre-edition snapshot).

**Basics (unchanged by every phase):** b0 pf 30.03, γ 19.577, hb 1.5339 · b1 pf 19.0575, γ 17.25, hb 1.1048 · b2 pf 84.672, γ 23.1, hb 3.6655 · b3 pf 4.998, γ 15.95, hb 0.3134.

**Phase 0 ALLOW list** = `root.drifts[i].{driftHeight,W,pd,totalPressure}` for the rows listed below, plus `root.table`, `root.basicsHtml`, `root.perp.*`, `root.par.*` for those cases (the joist tabs consume pd/W; the tables carry captions). `root.basics.*`, `root.drifts[i].{hc,hcHbRatio}` and every row not listed must still match at 1e-9. Old → new (hand-checked from §3; γ as above):

| Case / row | Old (7-10 form) | New (7-16 Fig. 7.6-1) |
|---|---|---|
| b0 rows 0, 1, 5 (lu 15.25 → 20; Is 1) | hd 1.8909, h 1.4182, W 5.6726, pd 27.763, total 57.793 | hd = 0.43·20^⅓·52.9^¼ − 1.5 = **1.6478**; 0.75hd **1.2359** ≤ hc; W **4.9434**; pd 19.577·1.2359 = **24.194**; total **54.224**. Cap √(42.9·15.25/(4·19.577)) = 2.89 does not bind |
| b0 rows 2, 3 (lu 28), 4 (lu 82) | — | **unchanged** (lu ≥ 25 and Is = 1 → identical arithmetic) |
| b1 row 0 (parapet 1.5/40, Is 1.1) | hd 2.0769 | hd = √1.1·(0.43·40^⅓·35^¼ − 1.5) = **2.1783**; 0.75hd 1.6337 > hc 0.3952 → W = min(4h²/hc, 8hc) = 8hc = **3.1617**, pd = γhc = **6.8175**, total 25.875 — **only the raw hd changes; snapshot paths unchanged** |
| b1 row 1 (leeward 12/60) | hd 2.5945, W 10.378, pd 44.755, total 63.813 | hd **2.7212**, W **10.8846**, pd **46.940**, total **65.997** |
| b1 row 2 (windward 12/30) | hd 1.7498, h 1.3124, W 5.2495, pd 22.638, total 41.696 | hd **1.8352**, h **1.3764**, W **5.5057**, pd **23.743**, total **42.801** |
| b2 row 0 (parapet 5/4, Is 1.2) | hd 2.2603, h 1.6952, W 8.6134, pd 30.828, total 115.50 | uncapped √1.2·(0.43·20^⅓·80^¼ − 1.5) = 2.1807; cap √(1.2·70·4/(4·23.1)) = **1.9069** binds → hd 1.9069, h **1.4302** > hc 1.3345 → height hc, W = 4·1.4302²/1.3345 = **6.1308** (< 8hc 10.676), pd = 23.1·1.3345 = **30.828** (unchanged), total 115.50 (unchanged) — **W changes** |
| b2 row 1 (leeward 6/200) | hd 6.0206 | hd √1.2·(0.43·200^⅓·80^¼ − 1.5) = **6.5952** > hc 2.3345 → W = 8hc 18.676, pd 53.928, total 138.60 — **snapshot paths unchanged** |
| b3 row 0 (windward 4/100, Is 0.8) | hd 2.9629, h 2.2222, W 8.8888, pd 35.444, total 40.442 | hd √0.8·(0.43·100^⅓·25^¼ − 1.5) = **2.6501**, h **1.9876**, W **7.9504**, pd **31.702**, total **36.700** |

The harness asserts the new values above explicitly (Phase 0 checks P1–P4, tolerance 5e-4) in addition to the ALLOW-listed diff; the ALLOW row table is fixed: `{ 'b0-defaults': [0, 1, 5], 'b1-lowsnow': [1, 2], 'b2-heavy-smallfetch': [0], 'b3-light': [0] }`.

### 7.3 Structural checks (skipped under `--capture`)

- **L1 legacy load**: `fresh()`; set `#edition` 7-22, `#w2` 0.5; `AREv2.loadFromState(legacy)` → `ok === true`, `!rolledBack`, `missingOnPage.length === 0`, `notInFile.length === 0`; `#edition` reads `7-16`, `#w2` `''`, `#riskCat` `II`, `#slopeRise` `0`; snapshot equals `baseline.b1` under the Phase 0 ALLOW list.
- **L2 round trip**: case C3 → `captureState()` → `fresh()` → `loadFromState` → `__snowLast` identical (diff, no ALLOW); `#edition` `7-22`, `#w2` `0.5`.
- **V1 visibility (computed style)**: 7-16 shows `#is` / `#ct` / `#slipperyR` wrappers and hides `#riskCat/#ct22/#rroof/#w2`; 7-22 inverse; `#ct22 = 1.2` hides `#rroof`. Badge "ASCE 7-16" / "ASCE 7-22". `<title>` unchanged.
- **R1 refs**: 7-22 Basic Calcs text contains "ASCE 7-22 Eq. 7.3-1", "Tables 7.3-2 / 7.3-3", "Eq. 7.6-1", "strength level", "0.7S"; no "7-16", no "Is". 7-16 text contains "ASCE 7-16", "Fig. 7.6-1", "Table 7.3-1", "Table 7.3-2"; no "7-22", "strength level", "Table 7-2", "Table 7-3", "Fig. 7-9".
- **E1**: no page errors; no `NaN` / `undefined` in `#basicCalcsTable`, `#configurations-table`, joist tabs for every case incl. W2 blank.
- **S1 source grep**: every `<select` inside a template literal in `updateConfigurationsTable` / `updateDisplay` other than the pre-existing `cfgType_` one carries `data-are-ignore`; the string `Fig. 7-9` is gone.

### 7.4 ASCE 7-22 hand-checked cases (tolerance ±0.01 psf / ft; internally compare to the same formulas at 1e-9)

Common: factor 0.7, `#edition` 7-22, slope 0, W blank unless stated. All values strength level (D2). "Ct(R, pg)" = Table 7.3-3 interpolation.

**C1 — flat roof, heated unventilated (Ex. 1 basis).** pg 30, RC II, Ce 1.0, `#ct22` r, Rroof 30, W2 0.55, no configs.
Ct(30,30) = 1.14. pf = 0.7·1.0·1.14·30 = **23.94**. γ = **17.9**. hb = **1.337**. `basics.ct = 1.14`, `ctSource = 'table733'`, `level = 'strength'`. pm applies (θ 0 < 15°) = min(30, 30) = **30** (separate case). Rain-on-snow n/a (W blank).

**C2 — parapet drift (§7.8; width 8 × 0.75hd).** C1 + parapet hr 4.0, lu 60.
hc = **2.663**; hc/hb = **1.991**. hd = 1.5·√(30^0.74·60^0.70·0.55^1.7/17.9) = **3.147**. 0.75hd = **2.360** ≤ hc → driftHeight 2.360; W = 8·2.360 = **18.88** (7-16 rule would give 9.44); pd = 17.9·2.360 = **42.24**; total **66.18**. Perp tab (source 0, spacing 24, length 20): uniform 23.94·2 = **47.88** plf, peak 42.24·2 = **84.49** plf.

**C3 — leeward drift (Ex. 3 high-roof basis).** pg 40, RC II, Ce 0.9, r / Rroof 30, W2 0.5; leeward hr 10, lu 100.
Ct(40,30) = 1.13. pf = **28.48**; γ = **19.2**; hb = **1.483**; hc = **8.517**. hd = 1.5·√(40^0.74·100^0.70·0.5^1.7/19.2) = **3.727** ≤ hc → W = **14.91**; pd = **71.55**; total **100.03**.

**C4 — windward drift.** C3 inputs; windward hr 10, lu 240.
hd = **5.063**; 0.75hd = **3.797** ≤ hc → W = 8·3.797 = **30.38**; pd = **72.91**; total **101.38** (windward governs, as in Ex. 3).

**C5 — leeward, hd > hc, 8hc cap.** pg 60, RC IV, Ce 1.0, `#ct22` 1.2, W2 0.65; leeward hr 3.0, lu 150.
pf = **50.4**; γ = **21.8**; hb = **2.312**; hc = **0.688**; hc/hb = **0.298**. hd = **5.853** > hc → driftHeight **0.688**; W = min(4·5.853²/0.688 = 199.2, 8·0.688) = **5.50**; pd = **15.00**; total **65.40**. pm = min(60, 40) = **40**.

**C6 — windward taller than hc (D4).** pg 40, RC II, Ce 1.0, `#ct22` 1.2, W2 0.55; parapet hr 3.0, lu 120.
pf = 0.7·1.2·40 = **33.6**; γ 19.2; hb = **1.750**; hc = **1.250**; hc/hb 0.714. hd = 1.5·√(40^0.74·120^0.70·0.55^1.7/19.2) = **4.3075**; 0.75hd = **3.231** > hc → driftHeight **1.250**; W = 8·3.231²/1.250 = **66.80**; pd = 19.2·1.250 = **24.00**; total **57.60**.

**C7 — hc/hb < 0.2.** pg 20, RC II, Ce 1.0, r / Rroof 20, W2 0.35; parapet hr 1.0, lu 50.
Ct(20,20) = 1.11; pf = **15.54**; γ **16.6**; hb **0.936**; hc **0.064**; ratio **0.068** → driftHeight 0, W 0, pd 0, total **15.54**.

**C8 — W2 blank guard (D3).** C3 inputs with `#w2` ''. `basics.w2Missing === true`; every drift row 0 / 0 / 0 / total = pf; an element whose text contains "W2" and "required"; joist tabs 0 drift; no page error.

**C9 — Ct interpolation edges.** (27.5, R 20) → **1.065** (Ex. 2 prints 1.07); (30, R 55) → **1.20**; (5, R 60) → **1.20**; (80, R 50) → **1.18**; (35, R 25) → **1.0825**.

**C10 — rain-on-snow + minimum (C7.10 example).** pg 32, RC IV, Ce 1.0, `#ct22` 1.2, W2 0.35, slopeRise 0.25, surface other, W 100.
θ = **1.19°**; panel c (Ct ≥ 1.2), knee 45° → Cs **1.0**; ps = pf = **26.88**; W/50 = 2.0° > 1.19° and pg 32 ≤ pm,max 40 → ros = **34.88**; pm applies = min(32, 40) = **32**; unbalanced n/a (θ < 2.38°). Same inputs in 7-16 (Ct select 1.2, Is 1.2): pm = 20·1.2 = **24**; rain-on-snow n/a (pg 32 > 20).

**C11 — sloped warm roof + unbalanced (Ex. 1).** pg 30, RC II, Ce 1.0, r / Rroof 30, W2 0.55, slopeRise 6, surface other, W 30, gableSimple off.
θ = **26.57°**; Ct 1.14 → panel b, knee 37.5° → Cs **1.0**; ps **23.94**; pm n/a (θ ≥ 15°); rain-on-snow n/a (26.57° > 0.6°); unbalanced applies: windward 0.3·23.94 = **7.18**; hd(lu 30) = **2.469**; S = 2 → surcharge 2.469·17.9/√2 = **31.25** (text 31.1); extent 8·2.469·√2/3 = **9.31** ft; leeward peak **55.19**. Same inputs in 7-16 (Ct 1.1, Is 1.0): panel b, Cs 1.0, ps = 0.7·1.1·30 = **23.1**; hd = 0.43·30^⅓·40^¼ − 1.5 = **1.860**; surcharge 1.860·17.9/√2 = **23.54**; extent **7.02** ft; leeward peak **46.64**.

**C12 — sloped cold slippery, unbalanced gate.** pg 40, RC II, Ce 0.9, `#ct22` 1.2, W2 0.45, slopeRise 8, surface slippery, W 24.
θ = **33.69°**; panel c slippery knee 15° → Cs = 1 − 18.69/55 = **0.660**; pf **30.24**; ps **19.96**; hb = 19.96/19.2 = **1.040**; unbalanced n/a (θ > 30.2°); pm n/a.

**C13 — W ≤ 20 ft simple gable, Is removal.** pg 25, RC I, Ce 1.0, `#ct22` 1.2, W2 0.35, slopeRise 4, W 16, gableSimple on.
θ **18.43°**; unbalanced: leeward uniform = pg = **25**, windward **0**; pm n/a. Same inputs in 7-16 with Is 0.8: leeward = **20** ("Ipg").

**C14 — 7-16 warm-roof slippery R gate (Phase B, 7-16).** pg 30, Ce 1.0, Ct 1.0, Is 1.0, slopeRise 12 (θ 45°), surface slippery: `#slipperyR` off → solid line, Cs = 1 − 15/40 = **0.625**; on → dashed, Cs = 1 − 40/65 = **0.3846**. Same inputs in 7-22 (r / Rroof 30 → Ct 1.05, panel a): slippery Cs **0.3846** regardless of the checkbox (D5).

## 8. Implementation steps (in order)

0. **Baseline first.** Add `tools/test-snow.mjs` and `fixtures/snow/`; run `node tools/test-snow.mjs --capture` on the unmodified calc → `baseline.json`, `legacy-716-state.json`. Commit before any calc change.
1. **Phase 0** (§3): `ED` skeleton with the corrected 7-16 `hd`; `calculateDrift` calls it; labels / badge / explanations / comment fixed. Run the harness: baseline diff passes under the ALLOW list and P1–P4 pass.
2. `CT_733`, `ctFromTable733`, `getEdition`, `applyEditionVisibility`; `#edition` / `#riskCat` row; `.ed22` inputs (`#ct22`, `#rroof`, `#w2`); `.ed16` wrappers around `#ct` and `#is`; CSS.
3. Extend `getInputs()`, `calculateBasics()`, `calculateDrift()` per §4.4 (7-16 expressions untouched).
4. `renderBasicCalcsTable()`: edition refs, new rows, strength caption.
5. `updateConfigurationsTable()` / `updateDropdowns()`: drift caption; W2-required warning row.
6. Explanations card: `.ed16` / `.ed22` lists.
7. `DOMContentLoaded` (:1356-1377): add `edition, riskCat, ct22, rroof, w2, slopeRise, roofSurface, slipperyR, eaveRidgeW, gableSimple` to the listener list; `#edition` / `#ct22` `change` → `applyEditionVisibility()`; call it before the initial `updateDisplay()`.
8. `window.__snowLast`.
9. Legacy shim (§4.5) in a new `<script>` after the AREv2 hook (:1992-2011).
10. `AREv2.publish` labels; `#pg` 7-22 label and §7.2 note.
11. **Phase B** card, computations, rows (§5).
12. `package.json`: `"test:snow": "node tools/test-snow.mjs"`; append `&& npm run test:snow` to `qa`.
13. `node tools/test-snow.mjs` → ALL PASS; `npm run qa:toolbar`, `npm run qa:roundtrip` still pass for this calc.

Not touched: other calcs, `are-utils-v2.js`, `app/lib/calcs.ts`, `<title>`.

## 9. Proof

```
node tools/test-snow.mjs --capture      # step 0 only, unmodified calc → fixtures/snow/baseline.json + legacy-716-state.json
node tools/test-snow.mjs                # after: baseline b0–b3 under the Phase 0 ALLOW list, P1–P4, L1/L2, V1, R1, E1, S1, C1–C14 → "ALL PASS", exit 0
npm run test:snow
npm run qa:toolbar && npm run qa:roundtrip
```

Acceptance: `fixtures/snow/baseline.json` is added in the step-0 commit and never modified afterwards.

## 10. Non-goals

Sliding snow (§7.9), adjacent structures (§7.7.2), intersecting drifts (§7.7.3), leeward 60 % lower-roof cap, roof-projection 15 ft / 2 ft exception, curved / sawtooth / dome roofs, partial loading (§7.5), ice dams (§7.4.4), open-frame equipment (§7.13), ponding; Hazard Tool lookup of pg or W2; SI units; any ASD conversion; `<title>` change; `data-are-ignore` on the existing per-row config controls.
