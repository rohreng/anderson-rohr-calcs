# ASCE 7-22 edition switch — MWFRS wind calculator

**Date:** 2026-09-23  **Status:** frozen spec, awaiting Nick's answers to §8 (implementation may start; §8 items are isolated)
**Calc:** `public/Calcs/asce716_mwfrs_calculator.html` (file name does not change — it is the toolbar `calcFile` key and the lateral-handoff `meta.calcFile`)
**Harness:** `tools/test-mwfrs-wind.mjs`, fixture `fixtures/mwfrs-wind/baseline.json` (untouched)
**Code text used:** ASCE 7-22 Ch. 26 (PDF 322–341), Ch. 27 (342–353), Ch. 28 (354–358); ASCE 7-16 Ch. 26–28 for the diff. Every figure/table value below was read from the 7-22 page image, not from text extraction: Table 26.10-1 (p.338), Table 26.6-1 (p.335), Fig. 27.3-1 (pp.344–345), Fig. 27.3-5 (p.349), Fig. 27.3-6 (p.350), Fig. 27.3-7 (p.351), Fig. 28.3-1 (p.356). PDF page = printed page + 61 for 7-22.

---

## 1. Goal

Add **ASCE 7-22** as a second code edition next to ASCE 7-16 in the MWFRS calc. One `<select id="codeEd">` drives every edition-dependent number and every printed code reference. Default stays **7-16**; the 62-check harness baseline stays green byte-for-byte; saved files carry the edition and old files load as 7-16.

What actually changes numerically in 7-22 for this calc (verified, see §3):

1. **Table 26.10-1 K_z** — Exposure B values change for z ≥ 40 ft, Exposure C at 140 / 180 / 200 ft, Exposure D unchanged. Table now runs to 500 ft.
2. **K_d moves out of q_z** (Eq. 26.10-1 is `0.00256 K_z K_zt K_e V²`) and into every pressure equation: Eqs. 27.3-1, 27.3-2, 27.3-3, 28.3-3. The *product* is unchanged; the displayed q_z, q_h, q_p differ by 1/0.85.
3. **Section / figure / note renumbering** — §28.3.5 → §28.3.7, Fig. 28.3-1 "Load Case B" → "Load Case 2", Fig. 28.3-2 (geometry) → Fig. 28.3-3, Fig. 27.3-1 notes 4/6/7 → (none)/5/6, Fig. 27.3-4 θ = 0° row → "<7.5°" row, Fig. 27.3-7 title loses "(0.25 ≤ h/L ≤ 1.0)".
4. One coefficient cell prints differently: Fig. 27.3-6 (troughed) θ = 30°, Case B, clear, C_NW = **+0.1** in 7-22 vs −0.1 in 7-16 (§8 Q1).

Everything else the calc uses is identical in both editions: wall C_p, roof C_p (all cells incl. 0.01θ / 0.8 and footnotes a, b), zone table, C_N for monoslope / pitched / Fig. 27.3-7, GC_pf zones 5/6/5E/6E, K_B / K_S, strip width a, Table 26.6-1 K_d = 0.85, G = 0.85 (§26.11.1), Table 26.9-1 K_e, Table 26.13-1 GC_pi, §27.1.5 minimums, §27.3.4 parapet GC_pn ±1.5/−1.0, Fig. 27.3-8 load cases, Table 26.10-1 footnote (K_z = 0.70 in Ch. 28 Exp B z < 30 ft).

---

## 2. Edition switch mechanics

### 2.1 UI
- In the **Wind Parameters** block, first control in the row (before `#V`):
  ```html
  <div class="ig"><label>Code Edition</label>
    <select id="codeEd" onchange="applyEditionLabels()">
      <option value="7-16" selected>ASCE 7-16</option>
      <option value="7-22">ASCE 7-22</option>
    </select></div>
  ```
  It is a real input (captured by the AREv2 toolbar, saved in the JSON file, URL-prefillable). It is **not** built by `calculate()`, so no `data-are-ignore`.
- `#V` label becomes `Wind Speed V (mph) — Fig. 26.5-1 of the selected edition` (7-22 maps differ from 7-16; V stays user-entered).

### 2.2 Data structure (single source of truth)
Replace the loose constants `KZ_TABLE`, and the hard-coded label strings, with one edition-keyed object. Everything edition-dependent lives here; **no `if (edition === ...)` outside `CODE`, `ed()`, `getKz`, `qz` and `applyEditionLabels`**.

```js
var CODE = {
  '7-16': {
    key: '7-16', name: 'ASCE 7-16',
    kdInQ: true,                       // Eq. 26.10-1 includes Kd; pressures use q directly
    KZ: [ /* Table 26.10-1 (7-16), rows [z, B, C, D], 0..500 ft — see §3 item 1 */ ],
    ALPHA_ZG: { B:[7.0,1200], C:[9.5,900], D:[11.5,700] },   // Table 26.11-1, documentation only (Note 1 formula 2.01(z/zg)^(2/α)); calc interpolates the table (Note 3)
    CN_TROUGHED_30B_CNW_CLEAR: -0.1,   // Fig. 27.3-6 as printed in 7-16
    fig2737_hL: true,                  // Fig. 27.3-7 title carries (0.25 ≤ h/L ≤ 1.0)
    L: { /* label strings, §2.4 */ }
  },
  '7-22': {
    key: '7-22', name: 'ASCE 7-22',
    kdInQ: false,                      // Eq. 26.10-1 has no Kd; Kd multiplies every pressure (Eqs. 27.3-1/2/3, 28.3-3)
    KZ: [ /* Table 26.10-1 (7-22), §3 item 1 */ ],
    ALPHA_ZG: { B:[7.5,3280], C:[9.8,2460], D:[11.5,1935] },  // Table 26.11-1 (7-22); Note 1 formula is 2.41(z/zg)^(2/α), Kz = 2.41 for zg < z ≤ 3,280 ft — documentation only
    CN_TROUGHED_30B_CNW_CLEAR: 0.1,    // Fig. 27.3-6 as printed in 7-22 (§8 Q1)
    fig2737_hL: false,
    L: { /* §2.4 */ }
  }
};
function ed(){ var s=document.getElementById('codeEd'); return CODE[s&&s.value]||CODE['7-16']; }
```

`Kd = 0.85` and `G = 0.85` stay module constants (same in both editions).

### 2.3 Where the edition enters the arithmetic
- `getKz(z, exp, E)` — interpolates `E.KZ` (add the `E` parameter; every caller passes it). Clamp above the last row (500 ft) instead of 200 ft.
- `qz(z, Kzt, Ke, V, exp, E)` — `0.00256*Kz*Kzt*Ke*V*V * (E.kdInQ ? Kd : 1)`.
- In `calculate()` at the top: `var E = ed(); var KDP = E.kdInQ ? 1 : Kd;` (`KDP` = "K_d in p"). **Every** pressure expression multiplies by `KDP`:
  - walls: `qz_i*KDP*G*Cp_WW ∓ qh_val*KDP*GCpi`, `qh_val*KDP*G*Cp_LW ± qh_val*KDP*GCpi`, `qh_val*KDP*G*Cp_SW`, `p_net = qz_i*KDP*G*Cp_WW − qh_val*KDP*G*Cp_LW`
  - roofs (`getRoofPressures`): `qhv*KDP*G*Cp ∓ qhv*KDP*GCpi`
  - parapet: `pp_WW = qp*KDP*1.5`, `pp_LW = qp*KDP*(−1.0)`, `pp_ww/pp_lw/pp_net/w_typ_plf` likewise (`pp_net = 2.5*qp*KDP`)
  - open: `r.pW = qh_val*KDP*G*r.CNW` etc., transverse `z.pA = qh_val*KDP*G*z.A`
  - frame: `longFrameForce` gets `o.Kdp` (default 1) and computes `p = o.qh*o.Kdp*(gcpfW−gcpfL)*KB*KS`; `qh28 = 0.00256*Kh28*Kzt*Ke*V*V*(E.kdInQ?Kd:1)`
- For 7-16, `KDP = 1` and `qz` includes K_d → every stored number is bit-identical to today (baseline).
- For 7-22 the stored `qz`, `qh`, `qp`, `frame.qh` are the 7-22 velocity pressures (no K_d) and every p / F carries K_d explicitly.

### 2.4 Labels — `applyEditionLabels()` + `E.L`
Called on `DOMContentLoaded` (after URL prefill), on `#codeEd` change, and at the end of `applyInputsMWFRS()`; `calculate()` also reads `E.L` when rendering. Static elements get ids so the function can set them. Full string table:

| id / render site | 7-16 (current text) | 7-22 |
|---|---|---|
| `document.title` | `ASCE 7-16 MWFRS Wind — Directional Procedure` | `ASCE 7-22 MWFRS Wind — Directional Procedure` |
| `.header h1` (`#hdrTitle`) | `ASCE 7-16 MWFRS Wind Pressure Calculator` | `ASCE 7-22 MWFRS Wind Pressure Calculator` |
| `.header .sub` (`#hdrSub`) | `… free roofs per Figs. 27.3-4 to 27.3-7, §28.3.5 frames)` | `… free roofs per Figs. 27.3-4 to 27.3-7, §28.3.7 frames)` |
| Wind Parameters ref line (`#windRef`) | `Kd = 0.85 (Table 26.6-1, Buildings) \| G = 0.85 (§26.11.1, Rigid) \| Eq. 26.10-1: q = 0.00256·Kz·Kzt·Kd·Ke·V² \| Ke = e^−0.0000362·zg (Table 26.9-1) …` | `Kd = 0.85 (Table 26.6-1, Buildings — applied in the pressure equations, Eqs. 27.3-1/2/3, 28.3-3) \| G = 0.85 (§26.11.1, Rigid) \| Eq. 26.10-1: q = 0.00256·Kz·Kzt·Ke·V² \| Ke = e^−0.0000362·ze (Table 26.9-1, Note 2) …` (GCpi tail unchanged) |
| `#frameRowN label` | `Transverse Frames n (§28.3.5)` | `Transverse Frames n (§28.3.7)` |
| `#frameBlk .blk-hd span` | `Longitudinal Wind on Transverse Frames (§28.3.5, Eqs. 28.3-3 & 28.3-4)` | `… (§28.3.7, Eqs. 28.3-3 & 28.3-4)` |
| `#openBlk .blk-hd span` | `… Figs. 27.3-4/5/6, Eq. 27.3-2)` | same |
| `renderParams` q line | `qh = 0.00256 × Kh × Kzt × Kd × Ke × V² = …` (with the Kd factor printed) | `qh = 0.00256 × Kh × Kzt × Ke × V² = …` (no Kd factor); add kv-item `Code = ASCE 7-22` in both editions (`Code = ASCE 7-16`) |
| `renderDir` heading / ref | `Wall Pressures — Design Pressures p = q·G·Cp ± qh·GCpi` … `WW = qz·G·Cp,WW − qh·(+GCpi)` … `Net P_lat = WW − Cp,LW·qh·G` | `p = q·Kd·G·Cp ± qh·Kd·GCpi (Eq. 27.3-1)` … `WW = qz·Kd·G·Cp,WW − qh·Kd·(+GCpi)` … `Net P_lat = WW − Cp,LW·qh·Kd·G` |
| `renderDir` table headers `qz (psf)` | `qz (psf)` | `qz (psf, no Kd)` |
| `renderRoof` flat ref | `p = qh·G·Cp ± qh·GCpi` | `p = qh·Kd·G·Cp ± qh·Kd·GCpi` |
| `renderRoof` monoslope note | `Monoslope: entire roof is windward OR leeward (Fig. 27.3-1 Note 4) — check both rows` | `Monoslope: entire roof is windward OR leeward (Fig. 27.3-1 monoslope elevations) — check both rows` (7-22 has no such note; the diagram carries it) |
| `renderRoof` mansard note | `… (Fig. 27.3-1 Note 6)` | `… (Fig. 27.3-1 Note 5)` |
| `renderParapet` ref | `§27.3.4: pp = qp·GCpn` | `§27.3.4: pp = qp·Kd·GCpn (Eq. 27.3-3)` |
| `renderParapet` kv | `p_p,net = 2.5 q_p` / `w_typ = 2.5 q_p h_p,typ` | `p_p,net = 2.5 Kd q_p` / `w_typ = 2.5 Kd q_p h_p,typ` |
| `renderDir` story-shear ref | `Parapet F = (pp,WW − pp,LW) × h_p,typ × B⊥ (§27.3.4 …)` | same (Kd is inside pp) |
| `renderOpen` table header | `p_W = qh·G·C_NW (psf)` | `p_W = qh·Kd·G·C_NW (psf)` (both columns) |
| `renderOpen` θ < 7.5° note | `θ < 7.5°: monoslope 0° coefficients apply (Fig. 27.3-4 Note 3)` / `(Figs. 27.3-5/6 Note 3)` | `θ < 7.5°: Fig. 27.3-4 "<7.5°" row applies` / `θ < 7.5°: Fig. 27.3-4 "<7.5°" row applies (Figs. 27.3-5/6 Note 3)` |
| `renderOpen` ref tail | `Ref: Figs. 27.3-4/5/6, Eq. 27.3-2, G = 0.85` | `Ref: Figs. 27.3-4/5/6, Eq. 27.3-2 (p = qh·Kd·G·CN), G = 0.85` |
| `renderOpen` warn90 | `… outside 0.25 ≤ h/L ≤ 1.0 — Fig. 27.3-7 does not apply directly; verify by other means.` | `… outside 0.25 ≤ h/L ≤ 1.0 — the Figs. 27.3-4/5/6 range; Fig. 27.3-7 (7-22) states no h/L limit (Fig. 27.3-4 Note 4 sends 0.05 ≤ h/L < 0.25, θ < 5° roofs here). Verify.` — rendered with class `ref`, not `warn`, in 7-22 (§8 Q2) |
| `renderFrame` not-applicable / geometry text | `§28.3.5 not …` | `§28.3.7 not …` |
| `renderFrame` ref | `Eq. 28.3-3: F = qh[(GCpf)WW − (GCpf)LW]KBKSAE … GCpf from Fig. 28.3-1 Load Case B zones 5/6 … 5E/6E` | `Eq. 28.3-3: p = qh·Kd[(GCpf)WW − (GCpf)LW]KBKS, Eq. 28.3-4: F = p·AE … GCpf from Fig. 28.3-1 Load Case 2 zones 5/6 … 5E/6E (geometry Fig. 28.3-3)` |
| `renderFrame` table header | `p = qh[(GCpf)WW−(GCpf)LW]KBKS (psf)` | `p = qh·Kd[(GCpf)WW−(GCpf)LW]KBKS (psf)` |
| `renderMinLoads` | `§27.1.5 …`, `§27.3.5 exception (D.1.1)` | `§27.1.5 …` (same), `§27.3.5 exception (Appendix D §D.1)`; append for 7-22 only: `Risk Category III/IV buildings also require tornado loads per Chapter 32 (§26.1.1) — not computed here.` |
| `AREv2.publish` Flong label | `Longitudinal frame force F (§28.3.5)` | `… (§28.3.7)` |
| `drawMWFRSDiagram` view title | `Wind-X Elevation (wind E–W) — MWFRS (ASCE 7-16 Ch. 27)` | `… (ASCE 7-22 Ch. 27)` |
| Geometry ref line (`#geomRef`) `§27.3.4`, `§26.2` | unchanged | unchanged (same numbers in 7-22) |

Rule: after the change, `grep -n "7-16\|28\.3\.5\|Case B" asce716_mwfrs_calculator.html` must hit only (a) `CODE['7-16']` strings, (b) comments, (c) the AREv2 shim's `calcFile` string, (d) the CN_MONO/GCPF comments. No user-visible text may hard-code an edition.

### 2.5 State, save/load, handoff
- `MWFRS_INPUT_IDS`: add `'codeEd'` (first). `collectInputsMWFRS` then saves it; `_version` → 3.
- `applyInputsMWFRS(d)`: after the id loop, `if (d.codeEd===undefined||!CODE[d.codeEd]) set('codeEd','7-16');` then `applyEditionLabels()` before `toggleRoofInputs()`.
- URL prefill: automatic through `MWFRS_INPUT_IDS`; call `applyEditionLabels()` after the prefill loop (before `toggleRoofInputs()`).
- Toolbar legacy-state shim (bottom `<script>`, `installMwfrsShim`): `DEFAULTS = { '#hpTyp': '', '#codeEd': '7-16' }`. Without this every pre-existing toolbar snapshot (e.g. `fixtures/lateral/red-bluff/mwfrs-state.json`, which has no `#codeEd`) rolls back as `notInFile`.
- `window.__mwfrsLast`: add `code: E.key`, `Kd: Kd`, `qIncludesKd: E.kdInQ` (additive keys; the baseline diff walks expected keys only).
- `buildRevitWindPayload()` `inputs`: add `code: E.name`, `q_includes_Kd: E.kdInQ`; keep `Kd: 0.85`. `qh_psf` stays "the edition's q_h" — document in the comment.
- `buildLateralPayload()` `meta`: add `code: E.name` (→ `record.source.mwfrs.code`). **are.lateral.v1 contract unchanged** — additive key inside `source.mwfrs`, which `LH.fromMwfrs` copies verbatim (`source: { mwfrs: o.meta || null }`). Readers (`rectangular_diaphragm_calculator.html`, stacked shearwall) ignore unknown keys. Forces are strength-level lb in both editions, so nothing downstream changes numerically; the diaphragm calc's own "ASCE 7-16 §27.3.4" parapet-step labels are out of scope (§7). `engines/lateral-handoff.js` is **not** edited.

---

## 3. Change table

| # | Item | ASCE 7-16 (calc today) | ASCE 7-22 | 7-22 ref | Code location |
|---|---|---|---|---|---|
| 1 | K_z table | `KZ_TABLE` 0–200 ft; B 0.57 0.57 0.62 0.66 0.70 **0.76 0.81 0.85 0.89 0.93 0.96 0.99 1.04 1.09 1.13 1.17 1.20**; C 0.85 0.85 0.90 0.94 0.98 1.04 1.09 1.13 1.17 1.21 1.24 1.26 1.31 **1.36** 1.39 **1.43 1.46**; D 1.03 1.03 1.08 1.12 1.16 1.22 1.27 1.31 1.34 1.38 1.40 1.43 1.48 1.52 1.55 1.58 1.61. 7-16 also has 250–500 ft rows the calc omits: B 1.28 1.35 1.41 1.47 1.52 1.56; C 1.53 1.59 1.64 1.69 1.73 1.77; D 1.68 1.73 1.78 1.82 1.86 1.89 | rows z = 0,15,20,25,30,40,50,60,70,80,90,100,120,140,160,180,200,250,300,350,400,450,500: **B** 0.57 0.57 0.62 0.66 0.70 **0.74 0.79 0.83 0.86 0.90 0.92 0.95 1.00 1.04 1.08 1.11 1.14 1.21 1.27 1.33 1.38 1.42 1.46**; **C** 0.85 0.85 0.90 0.94 0.98 1.04 1.09 1.13 1.17 1.21 1.24 1.26 1.31 **1.34** 1.39 **1.41 1.44** 1.51 1.57 1.62 1.66 1.70 1.74; **D** 1.03 1.03 1.08 1.12 1.16 1.22 1.27 1.31 1.34 1.38 1.40 1.43 1.48 1.52 1.55 1.58 1.61 1.68 1.73 1.78 1.82 1.86 1.89. Footnote unchanged: 0.70 in Ch. 28, Exp B, z < 30 ft | Table 26.10-1 (PDF 338) | `CODE['7-16'].KZ`, `CODE['7-22'].KZ`; `getKz(z,exp,E)`. Both tables carry the 250–500 rows (7-16 rows from 7-16 Table 26.10-1 PDF 323); clamp at 500. Baseline cases are all ≤ 43 ft, unaffected. |
| 2 | K_z Note 1 formula (documentation only) | 2.01(z/z_g)^(2/α), 2.01(15/z_g)^(2/α) for z < 15; Table 26.11-1 α/z_g B 7.0/1,200, C 9.5/900, D 11.5/700 | **2.41**(z/z_g)^(2/α), 2.41(15/z_g)^(2/α) for z < 15, **K_z = 2.41 for z_g < z ≤ 3,280 ft**; Table 26.11-1 B 7.5/3,280, C 9.8/2,460, D 11.5/1,935 | Table 26.10-1 Note 1; Table 26.11-1 (PDF 339) | `CODE[*].ALPHA_ZG` comment. Calc interpolates the table (Note 3) in both editions; formula not used. |
| 3 | Velocity pressure | Eq. 26.10-1 `q = 0.00256 Kz Kzt Kd Ke V²` (`qz()` multiplies by `Kd`) | Eq. 26.10-1 `q = 0.00256 Kz Kzt Ke V²` (no K_d) | §26.10.2, Eq. 26.10-1 (PDF 338) | `qz(z,Kzt,Ke,V,exp,E)`; `E.kdInQ` |
| 4 | Wall / roof pressure | Eq. 27.3-1 `p = qGCp − qi(GCpi)` | Eq. 27.3-1 `p = q Kd G Cp − qi Kd (GCpi)` | §27.3.1 (PDF 342) | `calcDir`, `getRoofPressures` × `KDP` |
| 5 | Free-roof pressure | Eq. 27.3-2 `p = qh G CN` | `p = qh Kd G CN` | §27.3.2 (PDF 347) | open path `rows` / `trans` × `KDP` |
| 6 | Parapet | Eq. 27.3-3 `pp = qp (GCpn)`, GC_pn +1.5 / −1.0 | `pp = qp Kd (GCpn)`, same GC_pn | §27.3.4 (PDF 347) | parapet block × `KDP` |
| 7 | Transverse-frame longitudinal force | §28.3.5, Eq. 28.3-3 `p = qh[(GCpf)ww − (GCpf)lw]KBKS`, Eq. 28.3-4 `F = pAE`; Fig. 28.3-1 **Load Case B** 5 = 0.40, 6 = −0.29, 5E = 0.61, 6E = −0.43; geometry Fig. 28.3-2 | **§28.3.7**, Eq. 28.3-3 `p = qh Kd [(GCpf)ww − (GCpf)lw] KB KS`; Eq. 28.3-4 same; Fig. 28.3-1 **Load Case 2** 5 = 0.40, 6 = −0.29, 5E = 0.61, 6E = −0.43 (identical); geometry **Fig. 28.3-3**; K_B, K_S, φ, n ≥ 3, θ < 45° identical. (7-22 §27.3.2 still says "Section 28.3.5" and §28.3.7 says "Section 27.4.3" — stale cross-references in the 7-22 print; cite §28.3.7.) | §28.3.7 (PDF 355–358), Fig. 28.3-1 (PDF 356) | `longFrameForce` × `o.Kdp`; `GCPF_LC_B` unchanged (rename comment to "LC B (7-16) / LC 2 (7-22)"); labels §2.4 |
| 8 | Ch. 28 K_z floor | Table 26.10-1 fn. a: 0.70 Exp B z < 30 ft in Chapter 28 | identical (`*` footnote) | Table 26.10-1 (PDF 338) | `Kh28` unchanged, uses `E.KZ` otherwise |
| 9 | Fig. 27.3-1 walls | WW 0.8 (q_z); LW −0.5 / −0.3 / −0.2 at L/B 0–1 / 2 / ≥4; SW −0.7 (q_h) | identical | Fig. 27.3-1 (PDF 345) | `lerpCpLW`, `Cp_WW`, `Cp_SW` unchanged |
| 10 | Fig. 27.3-1 roof, normal to ridge θ ≥ 10° | `ROOF_CP_SLOPED` rows 10–80 incl. 0.01θ, footnotes a/b, blank = 0.0 | identical cell-for-cell (windward ≤0.25: −0.7/−0.18, −0.5/0.0a, −0.3/0.2, −0.2/0.3, −0.2/0.3, 0.0a/0.4, 0.4, 0.6, 0.01θ, 0.8; 0.5: −0.9/−0.18, −0.7/−0.18, −0.4/0.0a, −0.3/0.2, −0.2/0.2, −0.2/0.3, 0.0a/0.4 …; ≥1.0: −1.3b/−0.18, −1.0/−0.18, −0.7/−0.18, −0.5/0.0a, −0.3/0.2, −0.2/0.2, 0.0a/0.3 …; leeward 10° −0.3/−0.5/−0.7, 15° −0.5/−0.5/−0.6, ≥20° −0.6) | Fig. 27.3-1 (PDF 345) | unchanged |
| 11 | Fig. 27.3-1 zone table (θ < 10° normal, parallel all θ) | h/L ≤ 0.5: −0.9, −0.9, −0.5, −0.3 / −0.18; ≥ 1.0: −1.3b, −0.7 / −0.18; fn. b area reduction 1.0 / 0.9 / 0.8 | identical | Fig. 27.3-1 (PDF 345) | `flatRoofCp` unchanged |
| 12 | Fig. 27.3-1 notes | 2 interpolation, 3 two values, **4 monoslope entire roof**, 6 mansard, 7 horizontal shear | 2, 3 same text; **no monoslope note** (elevations "Windward Roof Pressure" / "Leeward Roof Pressure" carry it); 4 parapets; **5 mansard**; **6 horizontal shear** | Fig. 27.3-1 (PDF 345) | `renderRoof` note strings via `E.L` |
| 13 | Fig. 27.3-4 monoslope C_N | `CN_MONO` rows 0, 7.5 … 45; row "0°"; Note 3 "θ < 7.5° use 0° row"; Note 5 h/L 0.05–0.25 θ < 5° → Fig. 27.3-7 | identical values; row is labelled **"<7.5°"**; Note 3 interpolation 7.5–45; **Note 4** "0.05 ≤ h/L < 0.25 and θ < 5°, use Fig. 27.3-7" | Fig. 27.3-4 (PDF 348) | values unchanged; note strings via `E.L` |
| 14 | Fig. 27.3-5 pitched C_N | `CN_PITCHED` | identical (all 48 cells checked) | Fig. 27.3-5 (PDF 349) | unchanged |
| 15 | Fig. 27.3-6 troughed C_N | `CN_TROUGHED`; 30° B clear C_NW = **−0.1** | identical **except** 30° Case B clear C_NW prints **+0.1** | Fig. 27.3-6 (PDF 350, image read at 3× zoom; 22.5° B in the same column prints −0.1, so the missing sign at 30° is not a rendering loss) | `openRoofCN`: after `cnRow(...)` is not enough (interpolation) — build the table per edition: `function cnTroughed(E){ var t=JSON.parse(JSON.stringify(CN_TROUGHED)); t[30].B[0]=E.CN_TROUGHED_30B_CNW_CLEAR; return t; }` and pass `cnTroughed(E)` to `cnRow`. §8 Q1. |
| 16 | Fig. 27.3-7 along-ridge C_N | `CN_TRANSVERSE`; title "(0.25 ≤ h/L ≤ 1.0)" | identical values; title has **no h/L range**; θ ≤ 45° | Fig. 27.3-7 (PDF 351) | values unchanged; `warn90` severity/wording via `E.fig2737_hL` (§8 Q2) |
| 17 | GC_pi | Table 26.13-1 ±0.18 / ±0.55 / ±0.18 / 0.00 | identical | Table 26.13-1 (PDF 341) | `GCPI_MAP` unchanged |
| 18 | K_d | Table 26.6-1 Buildings MWFRS 0.85 | identical | Table 26.6-1 (PDF 335) | `Kd` unchanged |
| 19 | G | §26.11.1 rigid 0.85 | identical | §26.11.1 (PDF 338) | `G` unchanged |
| 20 | K_e | Table 26.9-1 0 → 1.00 … 6,000 → 0.80; Note 2 `e^(−0.0000362 z_g)` | identical values; symbol **z_e**; "permitted to take K_e = 1 for all elevations" | §26.9, Table 26.9-1 (PDF 336) | `updateKeFromElev` unchanged; ref-line symbol via `E.L` |
| 21 | K_zt | Fig. 26.8-1 (user input) | identical table (checked K1/K2/K3 values) | Fig. 26.8-1 (PDF 337) | unchanged |
| 22 | Exposure definitions | §26.7.3 B: ≤ 30 ft → 1,500 ft; > 30 ft → 2,600 ft or 20h; D: 5,000 ft or 20h; 600 ft/20h transition | identical | §26.7.3 (PDF 335–336) | none (user selects) |
| 23 | Min. loads | §27.1.5 16 psf walls + 8 psf roof; open 16 psf × A_f | identical | §27.1.5 (PDF 342) | `renderMinLoads` unchanged except §2.4 strings |
| 24 | Load cases | Fig. 27.3-8 Cases 1–4; §27.3.5 exception Appendix D | identical; exception text "Section D.1 of Appendix D" | §27.3.5, Fig. 27.3-8 (PDF 352–353) | label only |
| 25 | h definition | §26.2 mean roof height; eave for θ ≤ 10° | identical | §26.2 (PDF 324) | none |
| 26 | Tornado | — | §26.1.1: Risk Cat. III/IV also designed for Ch. 32 tornado loads | §26.1.1 (PDF 322) | 7-22-only note in `renderMinLoads` (§2.4). Out of scope otherwise. |
| 27 | Elevated buildings | — | §27.3.1.1 new | — | out of scope; no note |
| 28 | Wind speed maps | Fig. 26.5-1A–D | new maps | §26.5 | V stays user-entered; `#V` label per §2.1 |
| 29 | Strip width a exception (least dim > 300 ft, θ 0–7° → a ≤ 0.8h) | in 7-16 Fig. 28.3-1 notation, not implemented | same in 7-22 | Fig. 28.3-1 notation | pre-existing gap, both editions; note only in `longFrameForce` comment (§7) |

---

## 4. Implementation steps (ordered)

1. **`CODE` object** (replace `KZ_TABLE` block, lines ~279–287). Type both `KZ` arrays from §3 item 1 (23 rows each, `[z,B,C,D]`). Add `ALPHA_ZG`, `kdInQ`, `CN_TROUGHED_30B_CNW_CLEAR`, `fig2737_hL`, and the `L` label map from §2.4. Add `ed()`.
2. **`getKz(z,exp,E)`**: `var rows=E.KZ;` clamp `z>=rows[rows.length-1][0]`. **`qz(z,Kzt,Ke,V,exp,E)`**: multiply by `(E.kdInQ?Kd:1)`. Update the two call sites in the parapet block, `qh_val`, `Kh`, `calcDir` rows, and `drawMWFRSDiagram` if it calls either (it does not today).
3. **`calculate()`**: `var E=ed(), KDP=E.kdInQ?1:Kd;` after the input gather. Apply `KDP` at every pressure expression listed in §2.3 (walls 5 expressions + `p_net`; roof 2 flat + 6 sloped; parapet 6; open `pW/pL/pA/pB`; `qh28`; pass `Kdp:KDP` into `longFrameForce`). `longFrameForce`: `var kdp=o.Kdp||1; var p=o.qh*kdp*(gcpfW-gcpfL)*KB*KS;` and return `Kdp:kdp`.
4. **Troughed table per edition** (§3 item 15): `openRoofCN(shape,flow,theta,E)`; the troughed branch calls `cnRow(cnTroughed(E),theta)`.
5. **`__mwfrsLast`** both paths: add `code:E.key, Kd:Kd, qIncludesKd:E.kdInQ`.
6. **Render functions** take `E` (or call `ed()` at entry) and use `E.L.*` for every string in §2.4. `renderParams` prints `Code = ASCE 7-xx` and the q_h formula line without the `× Kd` factor for 7-22. `renderFrame` uses `fr.Kdp` in the header text only when `fr.Kdp!==1`.
7. **`applyEditionLabels()`**: set `document.title`, `#hdrTitle`, `#hdrSub`, `#windRef`, `#frameRowN label`, `#frameBlk .blk-hd span`, the `#V` label. Wire: `#codeEd onchange`, DOMContentLoaded after prefill, end of `applyInputsMWFRS`. Also call `drawMWFRSDiagram()` from the onchange (view title carries the edition).
8. **Save/load**: `MWFRS_INPUT_IDS.unshift('codeEd')`; `_version:3`; `applyInputsMWFRS` default `'7-16'` when missing/unknown; shim `DEFAULTS['#codeEd']='7-16'`.
9. **Payloads**: Revit `inputs.code`, `inputs.q_includes_Kd`; lateral `meta.code`. Comment in `buildRevitWindPayload` that `qh_psf` follows the edition's Eq. 26.10-1.
10. **Comments**: update the `GCPF_LC_B` comment ("Fig. 28.3-1 Load Case B (7-16) = Load Case 2 (7-22)"), the `longFrameForce` header (§28.3.5 / §28.3.7), and note the strip-width exception (§3 item 29).
11. **Harness** (§5). Run `node tools/test-mwfrs-wind.mjs` → all 62 existing checks + new §5 checks pass.
12. Deploy per the usual `are-calcs-deploy` flow (not part of this spec).

Do not touch: `engines/lateral-handoff.js`, `rectangular_diaphragm_calculator.html`, `are-utils-v2.js`, any other calc, `fixtures/mwfrs-wind/baseline.json`.

---

## 5. Harness additions (7-22) — `tools/test-mwfrs-wind.mjs`

### 5.1 Mechanics (no baseline disturbance)
- `runWalled(c)`: after `fresh()`, add `if (c.code) await page.selectOption('#codeEd', c.code);`. `CASES` unchanged (no `code` key → default 7-16 → baseline identical).
- New block **`// ── 11. ASCE 7-22 edition ──`** after block 10, inside `if (!CAPTURE)`, wrapped in `try/catch` like block 10. All expectations are typed constants below (same style as blocks 2–3), computed independently (`Kd = 0.85`, `G = 0.85`, `KDP = 0.85`, 7-22 Table 26.10-1, `q = 0.00256·Kz·V²` with K_zt = K_e = 1).
- Tolerances: coefficients 1e-9, pressures 5e-3 psf, forces 1 lb, q 1e-3 psf (values below are rounded; the harness compares against the full-precision expression written inline, e.g. `0.00256*0.74*115*115`).
- Fresh-page default: `check('7-22: default edition is 7-16', (await page.$eval('#codeEd', e=>e.value)) === '7-16')`.

### 5.2 Cases and expected values

Notation: `qh` = 7-22 velocity pressure (no K_d); wall `p_net = qz·0.85·0.85·0.8 − qh·0.85·0.85·Cp,LW`; `F = p_net·h_trib·B⊥`; zone `pA = qh·0.85·0.85·Cp1 − qh·0.85·GCpi`, `pB = qh·0.85·0.85·(−0.18) + qh·0.85·GCpi`; parapet `F_par = 2.5·qp·0.85·hp·B⊥`.

**C1 — Enclosed, flat, Exp B, V 115, B 60, D 120, h 40, hp 3 (typ blank), stories 14/13/13.** (walled, Exp B change)
- K_h(40, B) = **0.74** (7-16: 0.76). qh = 0.00256·0.74·13,225 = **25.053** psf. Story mids 33 / 19.5 / 6.5 ft → K_z 0.70+0.04·0.3 = **0.712**, 0.57+0.05·0.9 = **0.615**, **0.57**; qz **24.106 / 20.821 / 19.298**.
- Wind-X (L/B 0.5 → Cp,LW −0.5): p_net = 24.106·0.578 + 25.053·0.36125 = 13.933 + 9.050 = **22.984**; 21.085; 20.205 psf. pWW_A = 13.933 − 25.053·0.153 = **10.100**; pWW_B **17.766**; pLW_A = −9.050 + 3.833 = **−5.217**; pSW **−12.671**.
- Parapet: z_p 43 → K_p = 0.74+0.05·0.3 = **0.755**, qp = 0.00256·0.755·13,225 = **25.561**; F_par,X = 2.5·25.561·0.85·3·120 = **19,554** lb; F_par,Y = **9,777** lb.
- Wind-X F: roof 22.984·7·120 + 19,554 = **38,860**; F1 21.085·13.5·120 = **34,158**; F2 20.205·13·120 = **31,519**; base V = **104,538** lb. Wind-Y (Cp,LW −0.3): p_net 19.363 / 17.465 / 16.585 → F **17,910 / 14,147 / 12,936**, base **44,993** lb.
- Roof Wind-X (h/L 0.667, t = ⅓): Cp1 −1.0333 / −0.8333 / −0.5667 → pA **−22.538 / −18.917 / −14.090**, pB **+0.575**. Wind-Y (h/L 0.333): −0.9/−0.9/−0.5/−0.3 → **−20.124 / −20.124 / −12.884 / −9.263**.
- Also assert `last.code==='7-22'`, `last.qIncludesKd===false`, `revit.inputs.code==='ASCE 7-22'`, `buildLateralPayload().source.mwfrs.code==='ASCE 7-22'`.

**C2 — Enclosed, flat, Exp C, V 115, B 100, D 150, h 180, hp 4, stories 6 × 30.** (taller, Exp C change)
- K_h(180, C) = **1.41** (7-16: 1.43). qh = **47.737**. Mids 165 / 135 / 105 / 75 / 45 / 15 → K_z 1.39+0.02·0.25 = **1.395**, 1.31+0.03·0.75 = **1.3325**, 1.26+0.05·0.25 = **1.2725**, 1.17+0.04·0.5 = **1.19**, 1.04+0.05·0.5 = **1.065**, **0.85**; qz 47.229 / 45.113 / 43.082 / 40.289 / 36.057 / 28.778.
- Parapet z_p 184 → K_p = 1.41+0.03·0.2 = **1.416**, qp **47.940**; F_par,X = 2.5·47.940·0.85·4·150 = **61,124**; F_par,Y **40,749** lb.
- Wind-X (L/B 0.667, −0.5): p_net 44.543 / 43.320 / 42.146 / 40.532 / 38.086 / 33.878 → F **161,346 / 194,942 / 189,658 / 182,393 / 171,386 / 152,453**; base **1,052,178** lb. Wind-Y (L/B 1.5 → −0.4): p_net 41.094 / 39.871 / 38.697 / 37.083 / 34.637 / 30.429 → F **102,391 / 119,614 / 116,092 / 111,248 / 103,910 / 91,288**; base **644,543** lb.
- Roof: both directions h/L ≥ 1 → two zones: Wind-X 0–90 / 90–100, Wind-Y 0–90 / 90–150; Cp1 −1.3 / −0.7 → pA **−52.141 / −31.447**, pB **+1.096**.

**C3 — Partially Enclosed, Gable/Hip 25°, ridge along D, Exp D, V 130, B 60, D 150, h 28, stories 10/9/9, hp 0, n 6, A_S 400.** (partially enclosed + §28.3.7; Exp D unchanged → **edition-invariance check**: every p / F / V_cum equals the 7-16 run of the same inputs within 1e-6, and `qh_22 = qh_16 / 0.85`.)
- K_h(28, D) = 1.12+0.04·0.6 = **1.144**; qh = 0.00256·1.144·16,900 = **49.494** (7-16: 42.070). GCpi 0.55.
- Wind-X (−0.5): pWW_A/B **4.469 / 50.746**, pLW_A **+5.259**, pSW **−25.032**, p_net **45.487 / 43.637 / 43.637**, F **34,115 / 62,182 / 58,909**, base **155,207** lb. Wind-Y (L/B 2.5 → −0.275): p_net 37.441 / 35.591 / 35.591, F **11,232 / 20,287 / 19,219**, base **50,738** lb.
- Roof Wind-X normal (h/L 0.4667, t 0.8667, row 25°): Cp **−0.2867 / +0.2133 / −0.60**; pA **−33.389 / −15.510 / −44.594**; pB **+12.887 / +30.767 / +1.683**. Wind-Y parallel (L 150, h/L 0.187): −0.9/−0.9/−0.5/−0.3 → pA **−55.322 / −55.322 / −41.018 / −33.866**, pB **+16.702**.
- Frame (§28.3.7): rise 13.989, eave 21.005, A_E **1,680.0**, a **6.0**, A_edge **134.43**, (GCpf)ww **0.4168**, lw **−0.3012**, K_B **1.20**, φ **0.2381**, K_S **0.9134**; p = 49.494·0.85·0.7180·1.20·0.9134 = **33.109** psf; F = **55,624** lb (identical to 7-16 QAQC case (c)). `frame.qh` = 49.494, `frame.Kdp` = 0.85.

**C4 — Open, pitched, clear, θ 22.5°, ridge along D, Exp B, V 120, B 50, D 120, h 40, n 5, A_S 0.** (open/free roof, Exp B change)
- K_h(40, B) = **0.74**; qh = 0.00256·0.74·14,400 = **27.279**; qh·Kd·G = 19.709. h/L = 0.8, h/L₉₀ = 0.333 (no warnings).
- Fig. 27.3-5 22.5° clear: A 1.1 / 0.1 → pW **+21.680**, pL **+1.971**; B −0.1 / −0.8 → **−1.971 / −15.767**.
- Fig. 27.3-7 clear, zones 0–40 / 40–80 / 80–120: A −0.8/−0.6/−0.3 → **−15.767 / −11.826 / −5.913**; B 0.8/0.5/0.3 → **+15.767 / +9.855 / +5.913**.
- Frame (h ≥ 30 → no 0.70 floor, `kzFloor false`): rise 10.355, eave 34.822, A_E **2,000.0**, a **5.0**, A_edge **179.29**, gW **0.41883**, gL **−0.30255**, K_B **1.30**, K_S **0.746**; p = 27.279·0.85·0.72138·1.3·0.746 = **16.222** psf; F = **32,443** lb.
- `revit === null`, `buildLateralPayload() === null` (unchanged behaviour).

**C5 — Enclosed, flat, Exp C, V 115, B 100, D 200, h 18, hp 2, one story 18 ft.** (low-rise, Exp C ≤ 120 ft unchanged → invariance check vs the 7-16 run)
- K_h(18, C) = 0.85+0.05·0.6 = **0.88**; qh **29.793** (7-16: 25.324). Mid 9 ft → K_z 0.85, qz 28.778. K_p(20) 0.90, qp **30.470**; F_par,X = 2.5·30.470·0.85·2·200 = **25,900**; F_par,Y **12,950**.
- Wind-X (−0.5): p_net **27.396**, F = 27.396·9·200 + 25,900 = **75,213** lb. Wind-Y (L/B 2 → −0.3): p_net **23.091**, F **33,732** lb.
- Roof Wind-X (L 100, h/L 0.18): zones 0–9 / 9–18 / 18–36 / 36–100 → pA **−23.931 / −23.931 / −15.321 / −11.016**, pB **+0.684**.

**C6 — Partially Open, Monoslope 12°, ridge along B (Wind-Y normal), Exp B, V 110, B 80, D 50, h 60, stories 4 × 15, hp 0.** (partially open, mid-rise Exp B, sloped normal + zone-table parallel)
- K_h(60, B) = **0.83** (7-16: 0.85); qh **25.710**. Mids 52.5 / 37.5 / 22.5 / 7.5 → K_z 0.79+0.04·0.25 = **0.80**, 0.70+0.04·0.75 = **0.73**, 0.62+0.04·0.5 = **0.64**, **0.57**; qz 24.781 / 22.613 / 19.825 / 17.656. GCpi 0.18.
- Wind-X (L 80, B⊥ 50, L/B 1.6 → Cp,LW −0.38): p_net 21.382 / 20.129 / 18.517 / 17.264 → F **8,018 / 15,097 / 13,888 / 12,948**, base **49,951** lb. Wind-Y (L 50, B⊥ 80, −0.5): p_net 23.611 / 22.358 / 20.746 / 19.493 → F **14,167 / 26,829 / 24,896 / 23,392**, base **89,283** lb.
- Roof Wind-Y normal (h/L 1.2 → ≥ 1.0 column, θ 12° → t 0.4 between rows 10 and 15): Cp **−1.18 / −0.18 / −0.66**; pA **−25.853 / −7.277 / −16.194**; pB **−17.986 / +0.590 / −8.326**. Wind-X parallel (L 80, h/L 0.75, t 0.5): Cp1 **−1.1 / −0.8 / −0.6** over 0–30 / 30–60 / 60–80 → pA **−24.367 / −18.794 / −15.079**, pB **+0.590**.

### 5.3 Label / state checks (same block)
- After a 7-22 walled run: `document.title` and `#results` innerText contain `7-22`, `§28.3.7`, `Load Case 2`, `Code = ASCE 7-22`; contain none of `7-16`, `28.3.5`, `Case B`. After a fresh 7-16 run the reverse (`7-16`, `28.3.5`, `Load Case B` present; `7-22`, `28.3.7` absent). Exclude the `calcFile` string by testing `#results` + `.header` text, not page source.
- Fig. 27.3-1 note text: 7-22 monoslope run shows `monoslope elevations`, mansard run shows `Note 5`; 7-16 shows `Note 4` / `Note 6`.
- `collectInputsMWFRS().codeEd === '7-22'` after selecting; JSON round trip restores it and `calculate()` reproduces C1 (`diff` against the C1 snapshot, no allow-list).
- `applyInputsMWFRS(legacyObj)` (the existing block-10f object, no `codeEd`) into a page holding 7-22 → `#codeEd` = `7-16`, header text reverts.
- Toolbar: `AREv2.captureState()` on a 7-22 run has `fields['#codeEd']==='7-22'`; `loadFromState` on a fresh page → `ok`, no rollback, `#codeEd` = 7-22. Red Bluff fixture (`fixtures/lateral/red-bluff/mwfrs-state.json`, no `#codeEd`) into a page holding 7-22 → `ok`, `notInFile.length===0`, `#codeEd` = `7-16` (extends existing check 10c; the assertion there `notInFile.length === 0` is what the shim default protects).
- URL prefill `?codeEd=7-22` → header shows 7-22 before any Calculate.
- Sweep: repeat the 18-combination render sweep (block 6) once with `#codeEd` = 7-22 — no `NaN`/`undefined`.
- Source grep (static, like the `deadSrc` check): user-visible edition strings only inside `CODE[...]`: assert the count of `7-16` occurrences outside the `var CODE = {` … `};` span and outside comments equals the two allowed (`calcFile` in the shim, `meta.calcFile`) — implement as: strip `//`-comments, extract the `CODE` block, count `/ASCE 7-16|§28\.3\.5|Load Case B/` in the remainder → expect 0.

Expected new check count ≈ 40; the 62 existing checks are untouched.

---

## 6. Proof

```
cd "<repo>" && node tools/test-mwfrs-wind.mjs
```
Must end `ALL PASS` with zero page errors: the 4 baseline diffs (fixture unchanged, no new allow-list entries), all existing blocks, and block 11. `--capture` is **not** run.

---

## 7. Non-goals

- No change to the Diaphragm Designer, Stacked Shearwall, C&C calc, or `engines/*.js` (their "ASCE 7-16" labels stay; the lateral record carries `source.mwfrs.code` so they can switch later).
- No renaming of the HTML file.
- Tornado loads (Ch. 32), elevated buildings (§27.3.1.1), flexible-building G_f, K_zt calculation, wind-speed lookup, Ch. 28 envelope procedure proper, C&C — not added.
- K_z Note 1 power-law formula not implemented (table interpolation, Note 3, both editions).
- Strip-width exception for least dimension > 300 ft (Fig. 28.3-1 notation) — pre-existing, both editions, comment only.
- Fig. 27.3-1 footnote b area reduction — still not applied (conservative, both editions).
- Fascia / inverted parapet on free roofs — still note only.
- `K_e` symbol z_g → z_e is a label change only.

---

## 8. Decisions (Nick, 2026-09-23) — FROZEN

D1 = use each edition's printed value (7-22 +0.1) AND show a `ref` note in the 7-22 troughed output that 7-16 printed −0.1. D2 = spec default (warn in 7-16, informational ref in 7-22). D3 = extend K_z to 500 ft in BOTH editions. All loads strength level (unchanged).

Original questions, for the record:

1. **Fig. 27.3-6 (troughed), θ = 30°, Case B, clear, C_NW.** 7-16 prints −0.1; the 7-22 page prints +0.1 (image checked at 3× — the 22.5° B cell in the same column prints its minus sign). Spec default: use each edition's printed value (`CODE['7-22'].CN_TROUGHED_30B_CNW_CLEAR = 0.1`). Alternative: keep −0.1 for both and note the discrepancy. Case A (−1.3) governs uplift at 30° either way; the difference is 0.2·q_h·K_d·G on the windward half of Case B only.
2. **Fig. 27.3-7 h/L range warning.** 7-22 drops "(0.25 ≤ h/L ≤ 1.0)" from the Fig. 27.3-7 title; the range still appears on Figs. 27.3-4/5/6 (which define h) and Fig. 27.3-4 Note 4 sends 0.05 ≤ h/L < 0.25, θ < 5° roofs to Fig. 27.3-7. Spec default: keep the check in both editions, render it as a `warn` in 7-16 and as an informational `ref` line in 7-22. Alternative: drop it for 7-22.
3. **K_z above 200 ft (both editions).** The live calc silently clamps K_z at the 200 ft row; both editions tabulate to 500 ft. Spec includes the 250–500 ft rows for 7-16 as well (7-16 Table 26.10-1, PDF 323) — baseline unaffected (all cases ≤ 43 ft) but it changes 7-16 results for h > 200 ft. Confirm, or restrict the extension to 7-22.
