# ASCE 7-22 edition option — pre-deploy verification (MWFRS + Snow)

Date: 2026-09-23
Scope: commits 196e5b6 (MWFRS 7-22), d5754fd / 775443b / 17282e4 (Snow harness, 7-16 drift fix, 7-22 + Phase B) on top of origin/main 6d71f33.
Out of scope: C&C commits adaae76 / 44b6dd4.
Method: every 7-22 provision checked against the ASCE 7-22 PDF text and rendered figure pages (not the plan docs); 7-16 checked the same way; five MWFRS and eleven snow scenarios driven through the live pages with Playwright and compared to independent hand calcs written from the code text; all four harnesses run.

## Verdict: SHIP-WITH-FIXES

No BLOCKER and no MAJOR. Every 7-22 number the two calculators produce matches the code text and the hand calcs to the last digit. The fixes are labels a building official would notice (one wrong edition string in the snow page title / print header / saved-file title, and one engineering-judgment rule that is not flagged as such in the UI). They are one-line edits; deploy after them.

## 1. Engineering correctness vs. the code text

### MWFRS (asce716_mwfrs_calculator.html)

| Item | Code source | Result |
|---|---|---|
| Table 26.10-1 Kz, 7-22, Exp B/C/D, 0–500 ft | 7-22 p. 277 (text extract) | All 23 rows x 3 exposures match (B: 0.74 @40 … 1.46 @500; C: 1.34 @140, 1.41 @180, 1.44 @200 … 1.74 @500; D unchanged). |
| Table 26.10-1 Kz, 7-16, 250–500 ft rows (7-16 fix) | 7-16 p. 268 | 1.28/1.53/1.68, 1.35/1.59/1.73, 1.41/1.64/1.78, 1.47/1.69/1.82, 1.52/1.73/1.86, 1.56/1.77/1.89 — match. |
| Kz footnote a (Exp B, z < 30 ft → 0.70 in Chapter 28) | both editions | Carried for both editions (qh28). Verified in M4. |
| Eq. 26.10-1 (7-22 has no Kd) | 7-22 §26.10.2 | `qz()` omits Kd when `kdInQ:false`. |
| Eq. 27.3-1 p = qKdGCp − qiKd(GCpi) | 7-22 p. 282 | Kd applied to both external and internal terms (walls, roof zones, sloped roof). |
| Eq. 27.3-2 p = qhKdGCN (open) | 7-22 p. 286 | Applied to normal-to-ridge rows and Fig. 27.3-7 zones. |
| Eq. 27.3-3 pp = qpKd(GCpn) (parapet) | 7-22 p. 286 | Applied; pp_net = 2.5·Kd·qp; label updated. |
| Eq. 28.3-3 p = qhKd[(GCpf)ww − (GCpf)lw]KBKS, Eq. 28.3-4 F = p·AE, §28.3.7 | 7-22 p. 294–296 | Applied (`Kdp`), section renumbered §28.3.5 → §28.3.7, "Load Case B" → "Load Case 2". GCpf LC2 zones 5/6/5E/6E = 0.40/−0.29/0.61/−0.43 match Fig. 28.3-1. |
| Table 26.6-1 Kd = 0.85 buildings MWFRS | 7-22 p. 274 | Unchanged, correct. |
| Table 26.9-1 Ke Note 2 (ze) | 7-22 p. 275 | Label correct. |
| Table 26.13-1 GCpi | 7-22 p. 279 | ±0.18 / ±0.55 / ±0.18 / 0 unchanged, correct. |
| Fig. 27.3-1 notes: monoslope (7-16 Note 4, gone in 7-22), mansard (7-16 Note 6 → 7-22 Note 5) | rendered p. 331 (7-16), p. 345 (7-22) | Labels correct per edition. |
| Fig. 27.3-4 "<7.5°" row (7-22) vs "0°" row (7-16) | rendered p. 348 | Values identical to CN_MONO[0]; label correct. All 7 θ rows x 16 CN values of CN_MONO match the 7-22 figure. |
| Fig. 27.3-6 troughed, θ = 30°, Case B, clear CNW | rendered p. 350 (7-22), p. 336 (7-16) | 7-22 prints +0.1, 7-16 prints −0.1. Implemented per edition with a printed note. All other troughed values identical in both editions and match the table. |
| Fig. 27.3-7 h/L limit | rendered p. 351 (7-22), p. 337 (7-16) | 7-22 title has no 0.25 ≤ h/L ≤ 1.0 limit and no Note 5; 7-16 has both. Calc downgrades the out-of-range message from warning to note in 7-22 and cites Fig. 27.3-4 Note 4. Correct. |
| §27.3.5 exception citation | 7-22 p. 291 "Section D.1 of Appendix D"; 7-16 "D1.1" | Correct per edition. |
| §27.1.5 minimum loads 16 / 8 / 16 psf | 7-22 p. 280 | Unchanged, correct. |
| Tornado note (RC III/IV, Chapter 32) | 7-22 §26.1.1 p. 322 | Correct; §26.1.1 says "as applicable" (Chapter 32 limits it to the tornado-prone region). See N-6. |

### Snow (snow_load_calculator.html)

| Item | Code source | Result |
|---|---|---|
| Eq. 7.3-1 pf = 0.7CeCtpg (no Is, strength level) | 7-22 p. 61 | Correct; Is forced to 1 in 7-22 path, select hidden. |
| Table 7.3-1 Ce | 7-22 p. 61 | Unchanged from 7-16, correct. |
| Table 7.3-2 Ct (1.2 unheated etc., 1.3 freezer, 0.85 greenhouse, "all others → Table 7.3-3") | 7-22 p. 61 | Correct. |
| Table 7.3-3 Ct (R x pg), bilinear interpolation, R > 50 → 1.2, ≤ 20 row, pg ≤ 10 / ≥ 70 columns | 7-22 p. 62 rendered | All 28 cells match; interpolation checked at pg 25 / R 40 → 1.18 and pg 42.9 / R 30 → 1.1271. |
| §7.3.3 / Table 7.3-4 pm = min(pg, pm,max by RC) for θ < 15° | 7-22 p. 61–62 | Correct (25/30/35/40). 7-16 pm = Is·pg (pg ≤ 20) else 20·Is, correct. |
| Fig. 7.4-1 Cs panels (7-22): (a) Ct ≤ 1.1 single All Surfaces curve 30°–70°; (b) 1.1 < Ct < 1.2 slippery 10°, other 37.5°; (c) Ct ≥ 1.2 slippery 15°, other 45° | 7-22 p. 62 rendered + §7.4.4 p. 63 | Correct. The earlier planners' error (a separate 5° slippery curve in panel (a)) is not present. |
| Fig. 7.4-1 (7-16): (a) Ct ≤ 1.0 slippery 5° with R gate, other 30°; (b) Ct = 1.1; (c) Ct ≥ 1.2 | 7-16 p. 114 rendered, §7.4.1–7.4.2 | Correct incl. the R ≥ 30 / R ≥ 20 gate checkbox. |
| §7.10 rain-on-snow (7-22): pg ≤ pm,max (by RC), not zero, θ < W/50 → +8 psf on the balanced case | 7-22 p. 68 | Correct. 7-16: pg ≤ 20, +5 psf, correct. |
| §7.6.1 unbalanced: 2.38° < θ ≤ 30.2°; W ≤ 20 ft simple → leeward pg (7-22) / Is·pg (7-16), windward 0; otherwise 0.3ps / ps + hdγ/√S over 8hd√S/3, hd with lu = W | 7-22 p. 64; 7-16 p. 112 | Correct. 7-22 uses lu = W with no minimum; 7-16 uses lu ≥ 20 ft. |
| Eq. 7.6-1 hd = 1.5·√(pg^0.74·lu^0.70·W2^1.7/γ) | 7-22 p. 65 | Correct. |
| Eq. 7.7-1 γ = min(0.13pg + 14, 30) | both | Correct. |
| hb = ps/γ | 7-22 §7.7.1, 7-16 §7.7.1 | Both editions say ps; the change from pf to ps is correct and invisible at θ = 0. |
| §7.7.1 hc/hb < 0.2 → no drift | both | Correct. |
| §7.7.1 leeward (7-22): hd ≤ hc → w = 4hd, h = hd; hd > hc → w = 4hd²/hc, h = hc; w ≤ 8hc | 7-22 p. 65 | Correct. |
| §7.7.1 windward / §7.8 parapet (7-22): h = 0.75hd, w = 8 x (0.75hd) = 6hd; parapet lu = roof length upwind | 7-22 p. 65 | Correct for 0.75hd ≤ hc. For 0.75hd > hc the calc uses h = hc and w = 8(0.75hd)²/hc (Nick's D4). The printed text has no such branch (it says only "eight times the windward drift height"); D4 preserves the drift cross-section and is conservative relative to a literal 6hd truncated at hc. Acceptable engineering judgment, but it must be stated in the output (M-2). |
| 7-16 Fig. 7.6-1 (775443b fix): hd = √Is·(0.43·lu^⅓·(pg+10)^¼ − 1.5); lu < 20 ft → use 20 ft, hd need not exceed √(Is·pg·lu/4γ) with the actual lu; 25 ft floor removed | 7-16 p. 116 rendered | Correct. Verified numerically on b2 (pg 70, lu 4, Is 1.2 → cap 1.9069 governs). |
| 7-16 §7.7.1 width rule "this height" applies to windward and leeward alike (4h / 4h²/hc / 8hc) | 7-16 p. 114 | Correct, unchanged. |
| §7.2 exception note (pg ≤ 10 & lu ≤ 100; pg ≤ 5 & lu ≤ 300) | 7-22 p. 61 | Correct. |
| Strength-level note (1.0S LRFD, 0.7S ASD) | 7-22 Ch. 2 / C7.2 | Correct. |

## 2. 7-16 user sees no unintended change

- MWFRS: `fixtures/mwfrs-wind/baseline.json` is untouched by these commits and all four baseline cases PASS byte-for-byte (`node tools/test-mwfrs-wind.mjs`). Every 7-16 expression is the pre-commit expression multiplied by `KDP = 1`. The only 7-16 behavioural change is Kz above 200 ft (previously clamped at the 200 ft row; now Table 26.10-1 to 500 ft) — intentional.
- Snow: the harness baseline was captured on the unmodified calc (d5754fd) and the 7-16 path passes with differences confined to the rows whose hd legitimately changes under the Fig. 7.6-1 fix (Is factor, 20 ft fetch, small-fetch cap). I re-derived the allowed-row list independently: rows with lu ≥ 20 and Is = 1.0 are unchanged; rows where hd changed but the drift is hc-capped and w = 8hc-capped change only in the displayed (pre-cap) height. The harness encodes exactly this. Default page (pg 42.9, Is 1.0, θ = 0) gives pf = 30.03 and hb = pf/γ as before.
- 7-16 operation order in pf is preserved verbatim (`factor*ce*ct*is*pg`), so floating-point results are identical.

## 3. Edition switching, files, toolbar, handoff

- Switching the edition with results shown re-runs `calculate()` (MWFRS) / `updateDisplay()` (Snow); results, title, h1, sub-header, reference strip, diagram title, and result-table formulas all switch. Verified: after switching to 7-22, `window.__mwfrsLast.code = '7-22'`, qh 29.93 → 35.21 (raw), and the rendered results contain zero "7-16" strings except the intentional troughed-CNW note.
- MWFRS save file: `_version` 2 → 3 with `codeEd`; v3 round-trips (7-22 restored); a v2 file without `codeEd` loads as 7-16. AREv2 snapshot round-trips 7-22; a snapshot lacking `#codeEd` defaults to 7-16 via the loadFromState shim (`ok:true`, no problems).
- Snow: AREv2 snapshot round-trips 7-22 (edition, Ct 7.3-3 controls visible); `fixtures/snow/legacy-716-state.json` (pre-edition file, `#is 1.1`, `#ct 1.1`) loads `ok:true` as 7-16 with pf 19.06 / hb 1.105 — identical to the pre-commit calc except the intentional drift fix.
- Lateral handoff (are.lateral.v1): `parapet.qp_psf` and Revit `qh_psf` / `qp_psf` stay Kd-inclusive in both editions (30.36 psf in M1 for both), so `engines/rect-diaphragm.js`, which never applies Kd, produces the same parapet forces. The raw Eq. 26.10-1 values ride in the additive `qp_eq2610_psf` / `qh_eq2610_psf` and the edition in `source.mwfrs.code`. `npm run test:lat` and `npm run test:dia` PASS unchanged.
- Print: MWFRS print header follows the edition. Snow print header does not — see M-1.

## 4. Hand-calc scenarios (calc value / hand value)

MWFRS (V, Exp, Kzt = Ke = 1):

| Case | Quantity | 7-16 calc / hand | 7-22 calc / hand |
|---|---|---|---|
| M1 enclosed flat, C, B 60, D 120, h 40, hp 3, stories 14/13/13, V 115 | qh (psf) | 29.929 / 29.929 | 35.210 / 35.210 (raw, no Kd) |
| | WW Case B, story 0 (z 33) | 24.917 / 24.917 | 24.917 / 24.917 |
| | net p_lat story 0 | 32.249 / 32.249 | 32.249 / 32.249 |
| | qp @ 43 ft; pp,net = 2.5·Kd·qp | 30.36; 75.90 / 75.90 | 35.72; 75.90 / 75.90 |
| | Wind-X roof zone 0–h/2, Case A (h/L 0.667 interpolated) | −31.675 / −31.675 | −31.675 / −31.675 |
| | Revit qh_psf / qp_psf (Kd-inclusive) | 29.9 / 30.4 | 29.9 / 30.4 |
| M2 enclosed flat, B, B 80, D 150, h 60, 4 x 15 ft, V 110 | Kh; qh | 0.85; 22.380 / 22.380 | 0.83; 25.710 / 25.710 |
| | Kz @ 52.5 / 37.5 ft | 0.82 / 0.745 | 0.80 / 0.73 (hand identical) |
| | WW Case B story 0 | 18.710 / 18.710 | 18.257 / 18.257 |
| M3 open troughed 30°, clear, C, h 20, W 40, L 80, V 115 | qh | 25.90 / 25.90 | 30.47 / 30.47 |
| | Case B pW (CNW −0.1 / +0.1) | −2.201 / −2.201 | +2.201 / +2.201 |
| | Case A pW, pL | −28.619, −6.604 (hand same) | −28.619, −6.604 (hand same) |
| M4 open pitched 20°, clear, B, h 24, W 40, L 100, n 4, AS 200, V 115 | qh (Kh 0.652); qh28 (Kz 0.70) | 18.763; 20.144 (hand same) | 22.074; 23.699 (hand same) |
| | AE, a, KB, KS, (GCpf)ww, (GCpf)lw | 960, 4, 1.4, 0.747, 0.418, −0.302 (hand same) | same |
| | p; F | 15.189 psf; 14,582 lb (hand same) | 15.189; 14,582 (hand same) |
| M5 partially enclosed gable 20°, C, h 30, B 50, D 80, V 120 | qh; WW low Case A; LW Case A / B | 30.708; −28.896; −32.55 / +1.228 (hand same) | 36.127; −28.896; −32.55 / +1.228 (hand same) |

Snow (all values psf / ft; hand calcs from the code text):

| Case | Quantity | calc / hand |
|---|---|---|
| N1 7-22, RC II, pg 30, Ce 1.0, R 30, W2 0.45, flat | Ct; pf; γ; hb | 1.14; 23.94; 17.9; 1.3374 (hand same) |
| | leeward hr 10, lu 100: hd, w, pd | 3.1727, 12.69, 56.79 (hand same) |
| | parapet hr 3, lu 60: hd 2.653, 0.75hd 1.99 > hc 1.663 → h, w, pd | 1.663, 19.05, 29.76 (hand same, D4 rule; literal text 6hd = 15.92) |
| | windward hr 2, lu 40: h, w, pd | 0.663, 36.00, 11.86 (hand same) |
| N1 7-16, Ct 1.1, Is 1.0 | leeward hd, w, pd; parapet w, pd | 3.519, 14.08, 63.00; 9.83, 30.6 (hand same) |
| N2 7-22, pg 20, Ce 0.9, Ct 1.2, 4:12, W 30, W2 0.35 | ps; hd(lu 30); surcharge; leeward peak; extent | 15.12; 1.5027; 14.40; 29.52; 6.94 ft (hand same) |
| N2 7-16 | hd(lu 30); surcharge; peak; extent | 1.627; 15.59; 30.71; 7.51 (hand same) |
| N3 7-22, RC III, pg 25, R 40, W2 0.5, ¼:12, W 100 | Ct; pf; ROS; pm | 1.18; 20.65; 28.65; 25 (hand same) |
| | leeward hr 6, lu 15 (no 20 ft floor in 7-22): hd, w, pd | 1.701, 6.80, 29.34 (hand same) |
| N3 7-16, Ct 1.1, Is 1.1 | pf; pm; ROS; leeward lu 15 hd | 21.175; 22; n/a (pg > 20); 1.404 (hand same) |
| N4 7-16, pg 70, Ce Ct Is 1.2, parapet hr 5 lu 4 | hd (small-fetch cap √(Is·pg·lu/4γ)) ; pd | 1.9069; 30.83 (hand same) |
| N5 7-22, W2 blank | drifts | 0, red "W2 required" row, total = ps (as decided) |
| N6 slippery 6:12 (26.57°), pg 30 | 7-22 Ct 1.14 → panel (b) knee 10°: Cs | 0.7239 (hand same) |
| | 7-16 Ct 1.0, R gate met → knee 5°: Cs | 0.6682 (hand same) |
| N7 simple gable W 18 ft, pg 30 | leeward: 7-16 Is·pg (Is 1.1) / 7-22 pg | 33 / 30 (hand same) |

## 5. Harness tails

`node tools/test-mwfrs-wind.mjs` — 153 PASS, 0 FAIL
```
PASS 7-22 sweep: all 18 enclosure/roof combinations render
PASS 7-22 source: edition-specific printed references live in CODE
PASS no page errors (all)
ALL PASS
```
`node tools/test-snow.mjs` — 68 PASS, 0 FAIL
```
PASS E1 C14 output
PASS E1 all 7-22 and 7-16 cases have clean output
PASS no page errors
ALL PASS
```
`npm run test:lat` — 134 PASS, 0 FAIL
```
PASS old ROOF / 3RD / 2ND: level keys unchanged, walls carry no sign_wind / case_wind / sign_seis, record has no parapet key
PASS assemble: a stepped wall stacked onto a nearby id (Y@0.3 -> Y@0) has its case reactions re-keyed
ALL PASS
```
`npm run test:dia` — 138 PASS, 0 FAIL
```
PASS nomenclature: result headers use the approved Wind-X / Wind-Y wording
PASS R9 chords: Wind-X NS-running at E/W edges, Wind-Y EW-running at N/S edges
ALL PASS
```

## 6. Findings

### BLOCKER
None.

### MAJOR
None.

### MINOR

**M-1 Snow page title still says "ASCE 7-10".**
`public/Calcs/snow_load_calculator.html` line 6: `<title>Snow Load Calculator - ASCE 7-10</title>`. `document.title` is never updated by `applyEditionVisibility()`, so the browser tab, the printed page header/footer, and the AREv2 saved-file `calcTitle` (see `fixtures/snow/legacy-716-state.json`) all read "ASCE 7-10" in both editions. A building official reading a 7-22 print will see 7-10 in the header.
Fix: set `<title>Snow Load Calculator - ASCE 7-16</title>` and add `document.title = 'Snow Load Calculator - ' + ED[ed].label;` inside `applyEditionVisibility()` (next to the badge update, ~line 1005).

**M-2 7-22 windward/parapet width for 0.75hd > hc is an engineering-judgment rule and is not labelled as such.**
`snow_load_calculator.html` ~line 959 `windwardWidth: (h, hc) => h <= hc ? 8 * h : 8 * h * h / hc`. ASCE 7-22 §7.7.1 (p. 65) states only "the drift width shall be taken as eight times the windward drift height (8(0.75hd) = 6hd)"; the hc branch is Nick's decision D4 (area-equivalent, conservative). The 7-22 explanation list and the drift-table caption do not mention it, so a reviewer comparing to the text will see a wider drift than 6hd with no stated basis (N1 parapet: 19.05 ft vs 15.92 ft).
Fix: add one line to the `.ed22` explanation list (~line 873): "Windward / parapet drift width = 8 × (0.75hd) (§7.7.1). Where 0.75hd > hc the height is taken as hc and the width as 8(0.75hd)²/hc to preserve the drift cross-section (engineering judgment; conservative relative to the printed 6hd)."

**M-3 Drift-height column is uncapped in 7-16 and capped in 7-22.**
`calculateDrift()` ~line 1117: `driftHeight = inputs.edition === '7-16' ? hDrift : Math.min(hDrift, hc)`. In 7-16 the "Drift Height (ft)" column can print a value larger than hc (N1 parapet: 2.05 ft shown, hc 1.71, pd = γ·1.71) while pd is correctly γ·hc. This was pre-existing and was kept deliberately to preserve baseline parity, but it reads as an inconsistency once the two editions sit side by side, and §7.7.1 says "the drift height shall equal hc" in that case.
Fix (optional now, recommended before the next snow release): show `Math.min(hDrift, hc)` in both editions and re-capture the baseline rows the harness already lists under `ALLOW_CAPPED_HEIGHT`.

### NOTE

**N-1 Downstream Diaphragm Designer labels.** `rectangular_diaphragm_calculator.html` lines 110, 262, 917 hard-code "ASCE 7-16 §27.3.4" and print "From the MWFRS record: q_p = 30.36 psf" — the Kd-inclusive value — while a 7-22 MWFRS print shows qp = 35.72 psf (raw) and pp = qp·Kd·GCpn. Forces are identical (verified), but the two printouts quote different q_p numbers for the same job. The record carries `source.mwfrs.code` and `parapet.qp_eq2610_psf`, so the diaphragm can label "q_p·Kd (ASCE 7-22)" when it is next touched. Outside these commits.

**N-2 7-16 unbalanced surcharge with W < 20 ft.** `calculateBasics()` passes `luU = max(W, 20)` into `ED['7-16'].hd`, which then never sees `lu < 20`, so the Fig. 7.6-1 small-fetch cap √(Is·pg·lu/4γ) is not applied to the unbalanced hd. The cap is a "need not be taken greater than" reduction, so the result is conservative, not wrong. Passing `W` directly would apply it.

**N-3 Leeward "need not be taken as larger than 60% of the length of the lower level roof"** (7-16 and 7-22 §7.7.1) is not implemented; the calc has no lower-roof length input. Optional reduction; omission is conservative. Worth a one-line note in the explanation block.

**N-4 pm, rain-on-snow and unbalanced results appear only in the Basic Calculations table.** The drift table, the drift diagram and both joist tabs use ps + drift only; the three separate load cases are informational. This is correct per §7.3.3 / §7.10 (separate cases, not combined with drift), but the Basic Calculations row text should say "not carried into the joist analysis" so nobody assumes the joist tab enveloped them.

**N-5 W2 input accepts 0.1–0.9 with placeholder "0.25–0.65 (Fig. 7.6-1)".** Alaska Table 7.2-1 has W2 from 0.1 to 0.9, so the range is right; the placeholder is only the CONUS map range. Fine as is.

**N-6 Tornado note wording.** `CODE['7-22'].L.tornado` says RC III/IV "also require tornado loads per Chapter 32 (§26.1.1)". §26.1.1 says "as applicable"; Chapter 32 applies only inside the tornado-prone region. Suggest appending "where the site is in the tornado-prone region (Fig. 32.1-1)".

**N-7 7-16 harness allowed-row list is sound.** I re-derived which baseline rows must change under the Fig. 7.6-1 fix (lu < 20 ft or Is ≠ 1.0, and among those, only the displayed pre-cap height where pd and w are hc-capped). The `ALLOW_ROWS` / `ALLOW_CAPPED_HEIGHT` sets in `tools/test-snow.mjs` are exactly that set, so the "ALL PASS" is meaningful and not a blanket allowance.

**N-8 MWFRS troughed note intentionally mentions 7-16 in 7-22 mode.** The only "7-16" string in a 7-22 results pane is the Fig. 27.3-6 CNW note ("ASCE 7-22 prints +0.1; ASCE 7-16 prints −0.1"). Correct and useful; keep.

## 7. Deploy-readiness summary

Numbers: correct in both editions for every provision checked, including the two spec errata the workflow caught earlier (Cs single curve, troughed CNW sign). Labels: correct except the snow `<title>` (M-1). Warnings: W2-blank warning present and drift/unbalanced suppressed as decided; strength-level note present; §7.2 exception note present. Files: legacy saves load as 7-16; new saves carry the edition. Handoff: q fields Kd-inclusive as decided; raw values additive; lateral and diaphragm suites unchanged.

Apply M-1 and M-2 (two one-line edits), re-run `npm run test:snow`, then deploy.
