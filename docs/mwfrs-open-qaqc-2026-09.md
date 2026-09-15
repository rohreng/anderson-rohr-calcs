# MWFRS open-building merge — QAQC

## Gate 1 — source file (2026-09-15)

**SOURCE:** `RE CODING\ASCE\ASCE 7-16 Ch27 Pt1 Wind Loading Calculator - html.html` (JS from line 411)
**LIVE:** `public/Calcs/asce716_mwfrs_calculator.html`
**CODE:** ASCE/SEI 7-16 (`RE CODING\ASCE\ASCE 7-16.pdf`). Page references are given as *PDF page (printed page)*; printed = PDF − 55.

Method: every constant table in SOURCE and the Fig. 27.3-1 / Table 26.10-1 tables in LIVE were read against the figure images (Read tool, plus 3x crops of Fig. 27.3-1, 27.3-7 and Fig. 28.3-1 Load Case B) and cross-checked against pypdf text extraction. Three open-building cases were hand-computed and then run in headless Chromium (`tools/_gate1-source.mjs`, deleted after use) against SOURCE.

Severity: **BLOCKER** = wrong number/logic that changes a design pressure; **MAJOR** = wrong applicability/limit; **MINOR** = label/note.

### Findings

| ID | Sev. | Code reference | File : line | What the file has | What the code says | Fix |
|---|---|---|---|---|---|---|
| S-01 | BLOCKER | Table 26.10-1 footnote *a*, PDF 323 (p.268); §28.3.5, PDF 369 (p.314) | SOURCE : 848 (`qh28 = qCalc(h, exp, …)`) via `Kz()` 525-530 | §28.3.5 q<sub>h</sub> uses the Note 1 power-law K<sub>z</sub> for every exposure (Exp B, h = 18 ft → K<sub>z</sub> = 0.605, q<sub>h</sub> = 22.27 psf) | "Use 0.70 in Chapter 28, Exposure B, when z < 30 ft (9.1 m)." §28.3.5 is Chapter 28. | In `runLongFrame` only: `Kz28 = (exp==='B' && h<30) ? 0.70 : Kz(h,exp)`. Case B in Exp B: F = 13,894 lb (file) vs 16,063 lb (code), −13.5%. |
| L-01 | BLOCKER | Fig. 27.3-1, ≥60° column + footnote *c*, PDF 331 (p.276) | LIVE : 256 (`[60, [0.34,0.34,-0.6] ×3]`), 310-311 clamp, 155 input max 60 | Windward C<sub>p</sub> at θ = 60° stored as 0.34; θ clamped to 60 | "≥60<sup>c</sup>: 0.01 θ" for all h/L (= 0.60 at 60°, 0.80 at 80°); footnote c: "For roof slopes greater than 80°, use C<sub>p</sub> = 0.8." | Row: `[60, [0.6,0.6,-0.6], [0.6,0.6,-0.6], [0.6,0.6,-0.6]]`; for 60 ≤ θ ≤ 80 use 0.01θ; θ > 80 use 0.8; raise input max to 90. Interpolation 45→60 is currently *decreasing* (0.4→0.34; at 50° file gives 0.38, code 0.467). Also between 45° and 60° the first (negative/zero) series has no value → assume 0.0 (Note 2), not an interpolated positive. |
| L-02 | BLOCKER | Fig. 27.3-1 zone table, h/L ≥ 1.0 rows, PDF 331 (p.276) | LIVE : 294-304 `flatRoofCp(h,L)` | Always returns the h/L ≤ 0.5 zones (−0.9, −0.9, −0.5, −0.3 / −0.18) regardless of h/L | h/L ≥ 1.0: "0 to h/2: −1.3<sup>b</sup>, −0.18; >h/2: −0.7, −0.18". Note 2 permits linear interpolation in h/L between 0.5 and 1.0. | Branch on h/L: ≤ 0.5 → 4-zone table; ≥ 1.0 → 2-zone table; between → interpolate (or step to the ≥1.0 table as SOURCE does, conservative). A 40 ft tall × 40 ft along-wind building gets −0.9 instead of −1.3 (31% under on the windward h/2 zone). |
| L-03 | BLOCKER | Fig. 27.3-1 zone table heading "Normal to Ridge for θ < 10° **and Parallel to Ridge for All θ**", PDF 331 (p.276) | LIVE : 533-566 (`getRoofPressures` uses `slopedRoofCp` for both `roofX` and `roofY`) | Sloped (θ ≥ 10°) roof gets the *normal-to-ridge* windward/leeward table in **both** wind directions; no ridge-orientation input | For wind parallel to the ridge on any pitched roof, C<sub>p</sub> comes from the zone table (by horizontal distance from the windward edge, L = along-wind = ridge length, h/L ≤ 0.5 vs ≥ 1.0). The windward/leeward table applies only to wind normal to the ridge. | Add a ridge-direction input (ridge ∥ X or ∥ Y). Normal-to-ridge direction → `slopedRoofCp`; parallel direction → zone table with L = ridge length. |
| S-02 | BLOCKER (closed path) | Fig. 27.3-1 Note 4, PDF 331 (p.276) | SOURCE : 683-689 | Monoslope reports one C<sub>p</sub> (`A ?? B`, i.e., the first series only) labelled "windward/leeward surface"; monoslope with θ < 10° also bypasses the zone table | "For monoslope roofs, entire roof surface is either a windward or leeward surface." Note 3: where two values are listed the roof shall be designed for both. | Output three rows: windward value 1, windward value 2, leeward (e.g., θ = 18.4°, h/L = 0.5: −0.50 / −0.06 / −0.60; file shows −0.50 only and misses the −0.60 suction). Route θ < 10° monoslope to the zone table. Not in the open merge scope, but do not port this branch as-is. |
| S-03 / L-04 | BLOCKER (narrow: 35° < θ < 45°, h/L ≤ 0.25) | Fig. 27.3-1 Note 2 and footnote *a*, PDF 331 (p.276) | SOURCE : 435 (series A ends at 35°), 686-699 (`interpSeries` → `null`); LIVE : 254-255 (interpolates 0.0 → 0.4) | At h/L ≤ 0.25 the first series is 0.0<sup>a</sup> at 35° and blank at 45°. LIVE interpolates 0.0→0.4 (0.2 at 40°). SOURCE returns `null` and **drops the row** at h/L ≤ 0.25 (only 0.4 shown). | "Where no value of the same sign is given, assume 0.0 for interpolation purposes." → first design value = 0.0 for 35° < θ < 45° at h/L ≤ 0.25; both values must be designed for (Note 3). | Treat a blank cell as 0.0 explicitly in both files. Effect: windward-roof suction case is −0.18q<sub>h</sub> (C<sub>p</sub> = 0 with +GC<sub>pi</sub>); LIVE gives −0.01q<sub>h</sub>, SOURCE gives nothing. |
| S-04 | MAJOR | §28.3.5 (title: "…with Transverse Frames and Pitched Roofs"), PDF 369 (p.314); Fig. 28.3-2 | SOURCE : 820 (`eligible = (Open \|\| PartiallyEnclosed) && theta < 45`) | §28.3.5 card runs for monoslope and troughed free roofs (Case A monoslope produced F = 17.7 kips using a gable-triangle A<sub>E</sub>) | Applies to "an open or partially enclosed building with transverse frames and a pitched roof (θ < 45°)". A<sub>E</sub> is the gable end-wall area (Fig. 28.3-2). | Gate on roof form: open → `freeRoofShape==='pitched'`; partially enclosed → `roofType==='gablehip'`. Hide the card otherwise. |
| S-05 | MAJOR | Figs. 27.3-4/5/6 Notation "h = Mean roof height" and diagrams (h to mid-slope), PDF 334-336 (pp.279-281); §26.2 MEAN ROOF HEIGHT, PDF 302 (p.247) | SOURCE : 590 (`hEff = theta > 10 ? h : eaveH`), 638 (`runOpenBuilding(L, W, hEff, …)`) | For an open free roof with θ ≤ 10° the calc silently substitutes eave height for h in q<sub>h</sub>, h/L, and the Fig. 27.3-7 zone widths. Probe (Case C with eaveH = 16): q<sub>h</sub> = 16.85 psf instead of 19.14 psf (−12%), h/L 0.27 instead of 0.42, transverse zones shrink to 16/32 ft. | §26.2: eave height is "permitted" for θ ≤ 10°; the free-roof figures define h as mean roof height with no eave exception, and for a troughed roof the eave is the *high* point (eave > mean). | For open buildings pass the mean roof height `h` (not `hEff`) to `runOpenBuilding`. If the eave substitution is kept for enclosed roofs, say so in the h label and never apply it to free roofs. |
| S-07 | MAJOR | Fig. 27.3-7 title "(0.25 ≤ h/L ≤ 1.0)", Notation "L = Horizontal dimension of roof, measured in the along-wind direction", PDF 337 (p.282) | SOURCE : 742-745 (`hL = hEff / W` only) | h/L applicability is checked only for γ = 0/180 (L = W). For γ = 90/270, L = ridge length; Case A gives h/L = 20/100 = 0.20 and Case B 18/120 = 0.15 — outside range with no warning. | Fig. 27.3-7 carries the same 0.25–1.0 applicability with L along-wind (= ridge length). Note 5: monoslope θ < 5°, γ = 0, 0.05 ≤ h/L ≤ 0.25 may use the Fig. 27.3-7 values. | Compute and display h/L<sub>90</sub> = h/L<sub>ridge</sub> on the transverse card with the same range warning. Optionally implement Note 5. |
| S-08 | MAJOR (closed path) | Fig. 27.3-1 zone table "Parallel to Ridge for All θ", PDF 331 (p.276) | SOURCE : 613-618, 659-736 | Closed-building results cover the normal-to-ridge direction only (L/B = W/L, h/L = h/W). No parallel-to-ridge wall or roof case. | Both principal directions must be designed (Fig. 27.3-8 Case 1); the along-ridge roof case uses the zone table with L = ridge length. | Keep LIVE's two-direction structure in the merge; fix L-03 so the parallel direction uses the zone table. |
| S-06 | MINOR | §27.3.2 "(θ ≤ 45°)", PDF 329 (p.274) vs §28.3.5 "(θ < 45°)", PDF 369 (p.314); Fig. 27.3-5 title "θ ≤ 45°" | SOURCE : 820 (`theta < 45`), 354 label | Card hidden at θ = 45.0° exactly | The two sections disagree; §27.3.2 and Fig. 27.3-5 include 45°. | Use `theta <= 45` (includes the input max). |
| S-09 | MINOR (F +0.3%) | Fig. 28.3-1 Load Case B diagrams, PDF 367 (p.312) (5E/6E strip width **a**; 1E/4E strips are 2a); §28.3.5 "average windward end wall pressure" | SOURCE : 838 (`Aedge = a * eaveH`) | Edge strip = a × eave height; omits the gable sliver above the eave within the strip | Zone 5E (and 6E) is the end-wall strip of width *a* at the windward corner, full height to the roof line, one per end wall per load pattern (Note 3: each corner in turn). Area-weighting 5/5E and 6/6E is the correct reading of "average … end wall pressure". | `Aedge = a*eaveH + 0.5*a*a*Math.tan(theta)` (valid for a ≤ B/2). Case B: 64.11 → 69.29 ft²; F = 24,403 → 24,472 lb. The strip width *a* in the file is **correct**. |
| S-11 | MINOR | Fig. 27.3-1 Note 2 | SOURCE : 475-481 (`interpHL`), 461-464 | When series A terminates, `null` is coerced to 0 by `interpLin` arithmetic for 0.25 < h/L < 0.5 (accidentally matches "assume 0.0"), and dropped at h/L ≤ 0.25 (S-03). | — | Replace `null` with an explicit 0.0 for blank cells; keep the row. |
| S-12 | MINOR | Table 26.10-1 Note 1 | SOURCE : 527 | `zEff` computed and never used (`zmin` is a gust-effect constant, not a K<sub>z</sub> floor) | K<sub>z</sub> = 2.01(15/z<sub>g</sub>)<sup>2/α</sup> for z < 15 ft | Delete line 527. |
| S-13 | MINOR | Fig. 27.3-1 ≥60° column | SOURCE : 176 (`max="45"`), 434-441 (no ≥60 column) | Closed roofs > 45° cannot be entered; table lacks 0.01θ column | 0.01θ for θ ≥ 60°, 0.8 for θ > 80° | Add the column and raise the closed-roof input cap (open free roofs stay ≤ 45° per Figs. 27.3-4/5/6). |
| S-14 | MINOR | §27.1.5, PDF 328 (p.273) | SOURCE : 388-390 | 16 psf × A<sub>f</sub> for open buildings is displayed as text only; A<sub>f</sub> not computed or compared. 16/8 psf shown for "partially open" too. | "…enclosed or partially enclosed building… 16 lb/ft² × wall area and 8 lb/ft² × roof area projected onto a vertical plane… The design wind force for open buildings shall be not less than 16 lb/ft² multiplied by the area A<sub>f</sub>." A<sub>f</sub> = area of open buildings normal to the wind or projected on a plane normal to the wind (§26.3). | Compute A<sub>f</sub> (projected roof area per direction) and show the 16 psf × A<sub>f</sub> floor next to the resultant of the C<sub>N</sub> pressures. Applying 16/8 to partially open is conservative; keep, but note it. |
| S-15 | MINOR | §27.3.2 second paragraph, PDF 329 (p.274) | SOURCE : runOpenBuilding | Fascia panels on free roofs with θ ≤ 5° ("inverted parapet", §27.3.4 with q<sub>p</sub> = q<sub>h</sub>) not covered | "…the fascia panel shall be considered an inverted parapet… determined using Section 27.3.5 [sic], with q<sub>p</sub> equal to q<sub>h</sub>." | Add a note or a fascia-height input. |
| S-17 | MINOR | Fig. 27.3-1 Notation, PDF 330 (p.275) | SOURCE : 184 (hint) | "h is used for θ ≥ 10°; eave height is used for θ ≤ 10°" (overlap at 10°) | "h = Mean roof height… except that eave height shall be used for θ ≤ 10 degrees." Code at line 590 uses eave at exactly 10° (correct). | Hint: "θ > 10° → h; θ ≤ 10° → eave height". |
| L-05 | MINOR | §27.3.4 Parapets (Eq. 27.3-3), PDF 329 (p.274) | LIVE : 507 comment | "§27.3.5: pp = qp × GCpn" | Parapets are §27.3.4; §27.3.5 is Design Wind Load Cases. | Fix the comment/label. |
| L-06 | MINOR | §26.2 / §26.3 h definition, PDF 302-303 (pp.247-248); Figs. 27.3-4 to 27.3-7 | LIVE : 147 (single "Mean Roof Height h" input, no eave input) | Acceptable as-is for enclosed buildings **if** the user enters eave height when θ ≤ 10°; nothing tells them to. | "h = mean roof height… except that eave height shall be used for roof angle θ less than or equal to 10°" (§26.3). Free-roof figures: h = mean roof height. | Merged calc note under h: "Enter mean roof height. For enclosed roofs with θ ≤ 10°, enter the eave height (Fig. 27.3-1 notation). For open free roofs always enter the mean roof height (Figs. 27.3-4 to 27.3-7)." |
| L-07 | MINOR | Fig. 27.3-1 footnote *b* | LIVE : 298, 301; SOURCE : 456 | −1.3 area reduction (≤100 ft² 1.0, 250 ft² 0.9, ≥1,000 ft² 0.8) not applied | Optional reduction | Conservative; note it. |
| L-08 | MINOR | Table 26.13-1, PDF 326 (p.271) | LIVE : 128-131, 411 | Only Enclosed (±0.18) and Partially Enclosed (±0.55) offered | Partially open = ±0.18; Open = 0.00 | Add "Partially open" (±0.18) when merging; open = 0 with C<sub>N</sub> path. |

### Gate 1 decisions (controller, 2026-09-15)

| ID | Decision | Where |
|---|---|---|
| S-01 | Fix in merge — §28.3.5 qh uses Kz = 0.70 for Exposure B when h < 30 ft (Table 26.10-1 fn. a). | Task 3 `longFrameForce` caller |
| L-01 | Fix in merge — ROOF_CP_SLOPED row 60 → [0.6,0.6,−0.6]×3, add row 80 → [0.8,0.8,−0.6]×3; clamp θ at 80 (>80 → 0.8). Baseline cases are 20°/35°, unaffected. | Task 3 |
| L-02 | Fix in merge — `flatRoofCp(h,L)` branches on h/L: ≤0.5 four-zone table; ≥1.0 two-zone (−1.3 / −0.7); 0.5–1.0 linear interpolation per zone. Changes baseline case `enclosed-flat-3story-parapet` Wind-X roof (h/L = 0.667) — allowlisted with a hand-checked expectation in the harness. | Task 3 + harness |
| L-03 | Fix in merge (approved by Nick) — ridge-direction input; parallel direction uses the zone table. | Tasks 2–3 |
| S-02 | Superseded — merged calc keeps LIVE's two-value windward + leeward output; monoslope/mansard labelled per Notes 4/6. | Task 4 |
| S-03 / L-04 | Fix in merge — ROOF_CP_SLOPED row 45, h/L ≤ 0.25 → [0.0, 0.4, −0.6] (blank = 0.0). 45→60 interpolates 0.0→0.6 on the first value. | Task 3 |
| S-04 | Already in plan — `frameEligible()` gates on pitched free roof / gable-hip. | Task 2 |
| S-05 | Already in plan — merged calc uses the single mean-roof-height input h for the open path. | — |
| S-06 | Fix in merge — §28.3.5 eligibility θ ≤ 45. | Task 3 |
| S-07 | Fix in merge — open object carries hL90 = h / Lridge; renderOpen warns when either h/L is outside 0.25–1.0. | Tasks 3–4 |
| S-08 | Already in plan — two-direction structure retained. | — |
| S-09 | Fix in merge — Aedge = a·eaveH + 0.5·a²·tanθ. Harness constants updated. | Task 3 + harness |
| S-11, S-12, S-13, S-17 | Not applicable — SOURCE-internal; merged calc does not reuse that code (S-13 covered by L-01). | — |
| S-14 | Note only — min-load block states 16 psf × Af for open buildings and defines Af; not computed. | Task 4 |
| S-15 | Note only — fascia case (θ ≤ 5°) mentioned in the open block ref line. | Task 4 |
| L-05 | Fix in merge — parapet references relabelled §27.3.4. | Task 4 |
| L-06 | Fix in merge — note under the geometry block: h = mean roof height; eave height for θ ≤ 10° on walled buildings; free roofs use mean h. | Task 2 |
| L-07 | Note only — −1.3 area reduction (fn. b) not applied, conservative. | Task 4 |
| L-08 | Already in plan. | Task 2 |

### Hand checks (code equations and figure values)

Common: K<sub>d</sub> = 0.85, K<sub>zt</sub> = 1.0, K<sub>e</sub> = e<sup>−0.0000362·0</sup> = 1.000, G = 0.85 (§26.11.1). q = 0.00256 K<sub>z</sub> K<sub>zt</sub> K<sub>d</sub> K<sub>e</sub> V² (Eq. 26.10-1). p = q<sub>h</sub> G C<sub>N</sub> (Eq. 27.3-2). Two q<sub>h</sub> values are carried: Table 26.10-1 (interpolated) and the Note 1 formula K<sub>z</sub> = 2.01(z/z<sub>g</sub>)<sup>2/α</sup> that SOURCE uses.

#### A. Open, monoslope, clear, θ = 15°, V = 115, Exp C, h = 20 ft, L = 40 ft along-wind, ridge 100 ft

- K<sub>z</sub>(20, C): table 0.90; formula 2.01(20/900)<sup>2/9.5</sup> = 0.9019.
- q<sub>h</sub> = 0.00256 × 0.90 × 1 × 0.85 × 1 × 115² = **25.90 psf** (formula K<sub>z</sub>: 25.95 psf). q<sub>h</sub>G = 22.015 (22.061).
- h/L = 20/40 = 0.50 (in range). h/L for γ = 90/270 = 20/100 = 0.20 (outside 0.25–1.0, S-07).
- Fig. 27.3-4, θ = 15°, clear: γ=0 A: C<sub>NW</sub> −0.9, C<sub>NL</sub> −1.3; B: −1.9, 0.0. γ=180 A: 1.3, 1.6; B: 1.8, 0.6.

| γ / case | C<sub>NW</sub> | C<sub>NL</sub> | p<sub>W</sub> (psf, table q<sub>h</sub>) | p<sub>L</sub> | p<sub>W</sub> (formula q<sub>h</sub>) | p<sub>L</sub> |
|---|---|---|---|---|---|---|
| 0 A | −0.9 | −1.3 | −19.81 | −28.62 | −19.85 | −28.68 |
| 0 B | −1.9 | 0.0 | −41.83 | 0.00 | −41.92 | 0.00 |
| 180 A | 1.3 | 1.6 | +28.62 | +35.22 | +28.68 | +35.30 |
| 180 B | 1.8 | 0.6 | +39.63 | +13.21 | +39.71 | +13.24 |

- Fig. 27.3-7 (clear), zones by distance from windward edge, h = 20: ≤h (0–20 ft) A −0.8 → −17.61 (−17.65); B 0.8 → +17.61 (+17.65). h–2h (20–40) A −0.6 → −13.21 (−13.24); B 0.5 → +11.01 (+11.03). >2h (40–100) A −0.3 → −6.60 (−6.62); B 0.3 → +6.60 (+6.62).

#### B. Open, pitched, obstructed, θ = 22.5°, V = 130, Exp D, h = 18 ft, L = 50 ft normal to ridge, ridge 120 ft; §28.3.5 with n = 5, A<sub>S</sub> = 0

- K<sub>z</sub>(18, D): table 1.03 + (1.08−1.03)(3/5) = 1.060; formula 2.01(18/700)<sup>2/11.5</sup> = 1.0634.
- q<sub>h</sub> = 0.00256 × 1.060 × 0.85 × 130² = **38.98 psf** (formula: 39.11 psf). q<sub>h</sub>G = 33.134 (33.241).
- h/L = 18/50 = 0.36 (in range); transverse h/L = 18/120 = 0.15 (outside range).
- Fig. 27.3-5, θ = 22.5°, obstructed: A: −1.2, −1.2; B: −0.8, −1.7 (γ = 0 and 180 identical).

| case | C<sub>NW</sub> | C<sub>NL</sub> | p<sub>W</sub> (table) | p<sub>L</sub> | p<sub>W</sub> (formula) | p<sub>L</sub> |
|---|---|---|---|---|---|---|
| A | −1.2 | −1.2 | −39.76 | −39.76 | −39.89 | −39.89 |
| B | −0.8 | −1.7 | −26.51 | −56.33 | −26.59 | −56.51 |

- Fig. 27.3-7 (obstructed), h = 18: ≤h A −1.2 → −39.76 (−39.89); B 0.5 → +16.57 (+16.62). h–2h A −0.9 → −29.82 (−29.92); B 0.5 → +16.57. >2h A −0.6 → −19.88 (−19.94); B 0.3 → +9.94 (+9.97).

§28.3.5 (Eqs. 28.3-3, 28.3-4). Eave height taken so that the mean roof height is 18 ft: rise = 25·tan 22.5° = 10.355 ft; eave = 18 − 5.178 = 12.822 ft.
- A<sub>E</sub> = 50 × 12.822 + ½ × 50 × 10.355 = 641.1 + 258.9 = **900.0 ft²**.
- a = min(0.1 × 50 = 5, 0.4 × 18 = 7.2) = 5; ≥ max(0.04 × 50 = 2, 3) → **a = 5.0 ft**.
- K<sub>B</sub> = 1.8 − 0.01 × 50 = **1.30**. φ = 0/900 = 0. K<sub>S</sub> = 0.60 + 0.073(5−3) + 1.25·0<sup>1.8</sup> = **0.746**.
- GC<sub>pf</sub> Load Case B: 5 = 0.40, 5E = 0.61, 6 = −0.29, 6E = −0.43.

| Edge-area basis | A<sub>5E</sub> (ft²) | (GC<sub>pf</sub>)<sub>ww</sub> | (GC<sub>pf</sub>)<sub>lw</sub> | Δ | q<sub>h</sub> | p (psf) | F (lb) |
|---|---|---|---|---|---|---|---|
| SOURCE a·eave (formula q<sub>h</sub>) | 64.11 | (0.40·835.89 + 0.61·64.11)/900 = 0.41496 | (−0.29·835.89 − 0.43·64.11)/900 = −0.29997 | 0.71493 | 39.11 | 27.11 | **24,403** |
| SOURCE a·eave (table q<sub>h</sub>) | 64.11 | 0.41496 | −0.29997 | 0.71493 | 38.98 | 27.03 | 24,324 |
| Correct a·eave + ½a²tanθ (formula q<sub>h</sub>) | 69.29 | 0.41617 | −0.30078 | 0.71695 | 39.11 | 27.19 | **24,472** |
| Correct (table q<sub>h</sub>) | 69.29 | 0.41617 | −0.30078 | 0.71695 | 38.98 | 27.10 | 24,393 |

Same case in Exposure B (probe for S-01): SOURCE K<sub>z</sub> = 0.605, q<sub>h</sub> = 22.27 psf, F = 13,894 lb. Table 26.10-1 footnote a (Chapter 28, Exp B, z < 30 ft): K<sub>z</sub> = 0.70, q<sub>h</sub> = 25.74 psf, p = 17.85 psf, **F = 16,063 lb** (file is 13.5% low).

#### C. Open, troughed, clear, θ = 10°, V = 115, Exp B, h = 25 ft, L = 60 ft normal to ridge, ridge 80 ft

- K<sub>z</sub>(25, B): table 0.66; formula 2.01(25/1200)<sup>2/7</sup> = 0.6650.
- q<sub>h</sub> = 0.00256 × 0.66 × 0.85 × 115² = **18.99 psf** (formula: 19.14 psf). q<sub>h</sub>G = 16.144 (16.267).
- h/L = 25/60 = 0.417; transverse h/L = 25/80 = 0.313 (both in range).
- Fig. 27.3-6, clear, θ = 10° → linear interpolation between 7.5° and 15° rows, t = (10 − 7.5)/7.5 = 1/3:
  - A: C<sub>NW</sub> = −1.1 + (−1.1 − (−1.1))/3 = **−1.100**; C<sub>NL</sub> = 0.3 + (0.4 − 0.3)/3 = **+0.333**.
  - B: C<sub>NW</sub> = −0.2 + (0.1 − (−0.2))/3 = **−0.100**; C<sub>NL</sub> = 1.2 + (1.1 − 1.2)/3 = **+1.167**.

| case | C<sub>NW</sub> | C<sub>NL</sub> | p<sub>W</sub> (table) | p<sub>L</sub> | p<sub>W</sub> (formula) | p<sub>L</sub> |
|---|---|---|---|---|---|---|
| A | −1.100 | +0.333 | −17.76 | +5.38 | −17.89 | +5.42 |
| B | −0.100 | +1.167 | −1.61 | +18.83 | −1.63 | +18.98 |

- Fig. 27.3-7 (clear), h = 25: ≤h A −0.8 → −12.92 (−13.01); B 0.8 → +12.92 (+13.01). h–2h (25–50) A −0.6 → −9.69 (−9.76); B 0.5 → +8.07 (+8.13). >2h (50–80) A −0.3 → −4.84 (−4.88); B 0.3 → +4.84 (+4.88).

### Browser comparison (SOURCE in headless Chromium, playwright, `file://` load, inputs set by id, `change` dispatched, `button.calc-btn` clicked)

| Case | SOURCE displayed | Hand (formula q<sub>h</sub>) | Match |
|---|---|---|---|
| A | K<sub>h</sub> 0.902, q<sub>h</sub> 25.95; C<sub>N</sub> 0A −0.90/−1.30, 0B −1.90/0.00, 180A 1.30/1.60, 180B 1.80/0.60; p 0A −19.85/−28.68, 0B −41.92/+0.00, 180A +28.68/+35.30, 180B +39.71/+13.24; γ90: −17.65/+17.65, −13.24/+11.03, −6.62/+6.62 | identical | Yes |
| B | K<sub>h</sub> 1.063, q<sub>h</sub> 39.11; A −1.20/−1.20 → −39.89/−39.89; B −0.80/−1.70 → −26.59/−56.51; γ90: −39.89/+16.62, −29.92/+16.62, −19.94/+9.97; §28.3.5: A<sub>E</sub> 900.0, a 5.00, A<sub>edge</sub> 64.1, GC<sub>pf</sub> +0.415/−0.300, K<sub>B</sub> 1.300, K<sub>S</sub> 0.746, p +27.11, F +24,402.77 lb | identical to the "SOURCE a·eave" row; correct F = 24,472 lb (S-09) | Yes (to its own formula) |
| C (eaveH set = 25) | K<sub>h</sub> 0.665, q<sub>h</sub> 19.14; A −1.10/0.33 → −17.89/+5.42; B −0.10/1.17 → −1.63/+18.98; γ90: −13.01/+13.01, −9.76/+8.13, −4.88/+4.88 | identical | Yes |
| C (eaveH left at 16) | h reported 16.0 ft, K<sub>h</sub> 0.585, q<sub>h</sub> 16.85; p A −15.75/+4.77, B −1.43/+16.71; γ90 zones 16/32 ft | h should be 25 (mean roof height) | **No** → S-05 |
| A, B, C | §28.3.5 card shown as applicable for monoslope (F 17.7 k) and troughed (F 20.5 k) free roofs | §28.3.5 is for pitched roofs | **No** → S-04 |
| B in Exp B | q<sub>h</sub> 22.27 (K<sub>z</sub> 0.605), F 13,894 lb | K<sub>z</sub> = 0.70 → F 16,063 lb | **No** → S-01 |

SOURCE's K<sub>z</sub> is the Table 26.10-1 Note 1 formula, not the tabulated value; it runs 0.2% (Exp C, 20 ft) to 0.8% (Exp B, 25 ft) above the table. Both are permitted for Chapter 27 (Note 1); only the Chapter 28 / Exposure B / z < 30 ft footnote is a hard requirement (S-01).

### Verified correct (matched the code, item by item)

1. **Table 26.13-1** (PDF 326): Enclosed +0.18/−0.18; Partially enclosed +0.55/−0.55; Partially open +0.18/−0.18; Open 0.00 — SOURCE `GCPI` 424-429 exact. LIVE enclosed/partial values exact (partially open not offered, L-08).
2. **Table 26.9-1** (PDF 323): 0 → 1.00, 1,000 → 0.96, 2,000 → 0.93, 3,000 → 0.90, 4,000 → 0.86, 5,000 → 0.83, 6,000 → 0.80; Note 2 formula K<sub>e</sub> = e<sup>−0.0000362 z<sub>g</sub></sup>. SOURCE line 589 matches the formula; formula reproduces every table value (0.9644, 0.9302, 0.8971, 0.8652, 0.8344, 0.8048). <0 and >6,000 ft go to the formula, which SOURCE does.
3. **Table 26.11-1** (PDF 324): B α 7.0, z<sub>g</sub> 1,200, z<sub>min</sub> 30; C 9.5, 900, 15; D 11.5, 700, 7 — SOURCE `EXPOSURE` exact.
4. **Table 26.10-1 Note 1** K<sub>z</sub> = 2.01(z/z<sub>g</sub>)<sup>2/α</sup> for 15 ≤ z ≤ z<sub>g</sub>, = 2.01(15/z<sub>g</sub>)<sup>2/α</sup> for z < 15 — SOURCE `Kz()` 528-529 exact. **Eq. 26.10-1** q<sub>z</sub> = 0.00256 K<sub>z</sub> K<sub>zt</sub> K<sub>d</sub> K<sub>e</sub> V² — SOURCE `qCalc` and LIVE `qz` exact.
5. **Table 26.10-1** all 17 rows (0–15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200 ft) × B/C/D — LIVE `KZ_TABLE` exact (B 0.57…1.20; C 0.85…1.46; D 1.03…1.61). Linear interpolation per Note 3.
6. **§26.11.1**: "The gust-effect factor for a rigid building or other structure is permitted to be taken as 0.85." G = 0.85 in both files.
7. **Fig. 27.3-1 walls** (PDF 331): windward 0.8 with q<sub>z</sub>; leeward −0.5 (L/B 0–1), −0.3 (2), −0.2 (≥4) with q<sub>h</sub>; sidewall −0.7 with q<sub>h</sub>. SOURCE 663-669 and LIVE `lerpCpLW` exact including interpolation.
8. **Fig. 27.3-1 roof, normal to ridge, θ ≥ 10°**, all 24 windward cells for θ = 10, 15, 20, 25, 30, 35, 45 at h/L ≤ 0.25 / 0.5 / ≥ 1.0 and all 9 leeward cells (−0.3, −0.5, −0.6 / −0.5, −0.5, −0.6 / −0.7, −0.6, −0.6): SOURCE `ROOF_WINDWARD`/`ROOF_LEEWARD` exact; LIVE `ROOF_CP_SLOPED` rows 10–45 exact (the 45° / ≤0.25 pair stored as [0.4, 0.4] is equivalent to the single listed 0.4; the θ = 60 row is wrong, L-01).
9. **Fig. 27.3-1 zone table** (θ < 10° normal to ridge, and parallel to ridge for all θ): h/L ≤ 0.5: 0–h/2 −0.9/−0.18; h/2–h −0.9/−0.18; h–2h −0.5/−0.18; >2h −0.3/−0.18. h/L ≥ 1.0: 0–h/2 −1.3<sup>b</sup>/−0.18; >h/2 −0.7/−0.18. SOURCE `ROOF_ZONE` exact for both buckets (step to the ≥1.0 table for 0.5 < h/L < 1.0 is conservative). LIVE has only the ≤0.5 bucket (L-02).
10. **Fig. 27.3-1 Notes** as printed: 2 (interpolate L/B, h/L, θ; same sign only; assume 0.0 where none), 3 (two values → design for both; h/L interpolation between like signs), 4 (monoslope: entire roof is windward or leeward), 6 (mansard: top horizontal and leeward inclined surfaces are leeward), 7 (horizontal shear not less than neglecting roof, except moment frames). SOURCE's method notes (691, 711) and mansard note (708) state these correctly.
11. **What Fig. 27.3-1 says for wind parallel to the ridge**: the zone table applies "Parallel to Ridge for All θ" — C<sub>p</sub> by horizontal distance from the windward edge (item 9), with L = along-wind dimension (the ridge length) and h = mean roof height (eave height if θ ≤ 10°); the windward/leeward table is for wind normal to the ridge only.
12. **Fig. 27.3-4** (PDF 334) all 7 θ rows × 16 values (A/B × clear/obstructed × γ 0/180) — SOURCE `CN_MONO` exact. Note 3 (interpolate 7.5°–45°; θ < 7.5° use 0°) implemented at 774.
13. **Fig. 27.3-5** (PDF 335) all 6 rows × 8 values — SOURCE `CN_PITCHED` exact. **Fig. 27.3-6** (PDF 336) all 6 rows × 8 values — SOURCE `CN_TROUGHED` exact. Note 3 (θ < 7.5° → monoslope coefficients, which at θ < 7.5° are the 0° row) implemented at 786-790; γ = 0 and 180 share one table (figure heading "γ = 0°, 180°").
14. **Figs. 27.3-4/5/6** applicability 0.25 ≤ h/L ≤ 1.0, θ ≤ 45°; L = horizontal dimension of roof in the along-wind direction; h = mean roof height. SOURCE range warning 742-745 correct for γ = 0/180.
15. **Fig. 27.3-7** (PDF 337): zones ≤h / >h,≤2h / >2h; A clear −0.8, −0.6, −0.3; A obstructed −1.2, −0.9, −0.6; B clear 0.8, 0.5, 0.3; B obstructed 0.5, 0.5, 0.3 — SOURCE `CN_TRANSVERSE` exact; applied to all shapes.
16. **§27.3.2 / Eq. 27.3-2** p = q<sub>h</sub> G C<sub>N</sub>, q<sub>h</sub> at mean roof height using the exposure giving the highest loads, G from §26.11 — SOURCE 769, 805 exact; no GC<sub>pi</sub> term (Table 26.13-1 open = 0.00).
17. **§28.3.5 / Eqs. 28.3-3, 28.3-4**: p = q<sub>h</sub>[(GC<sub>pf</sub>)<sub>ww</sub> − (GC<sub>pf</sub>)<sub>lw</sub>]K<sub>B</sub>K<sub>S</sub>; F = pA<sub>E</sub>; K<sub>B</sub> = 1.8 − 0.01B (B < 100) / 0.8; K<sub>S</sub> = 0.60 + 0.073(n − 3) + 1.25φ<sup>1.8</sup>; φ = A<sub>S</sub>/A<sub>E</sub>; n ≥ 3; B = width perpendicular to ridge; A<sub>E</sub> = end wall area as if fully enclosed (rectangle + gable). SOURCE 826-850 exact. **Fig. 28.3-1 Load Case B** (PDF 368): zone 5 = 0.40, 6 = −0.29, 5E = 0.61, 6E = −0.43, constant for θ 0–90 — SOURCE `GCPF_LC_B` exact. Edge strip width *a* per notation (10% least dim or 0.4h, not less than 4% or 3 ft) — SOURCE 835-837 exact. Area-weighted average of 5/5E and 6/6E, strip at one (windward) corner per end wall, is the correct reading; only the gable sliver is missing (S-09).
18. **§27.1.5** (PDF 328) 16 psf × wall area and 8 psf × projected roof area, simultaneously, for enclosed/partially enclosed; 16 psf × A<sub>f</sub> for open — SOURCE 388-390 text correct.
19. **Fig. 27.3-8** (PDF 338) Cases 1–4 as printed (Case 2: 0.75P with M<sub>T</sub> = 0.75(P<sub>WX</sub> + P<sub>LX</sub>)B<sub>X</sub>e<sub>X</sub>, e = ±0.15B; Case 4: 0.563P on both axes) and the §27.3.5 exception for Appendix D §D1.1 (Cases 1 and 3 only) — SOURCE 392-399 correct.
20. **§27.3.4 / Eq. 27.3-3** parapets: p<sub>p</sub> = q<sub>p</sub>(GC<sub>pn</sub>), q<sub>p</sub> at the top of the parapet, +1.5 windward, −1.0 leeward — SOURCE 607-608, 647-648 and LIVE 504-513 exact. LIVE's net parapet force (1.5 + 1.0)q<sub>p</sub>h<sub>p</sub>B<sub>⊥</sub> at the roof diaphragm is the correct combination.
21. **h definition**: §26.2 "MEAN ROOF HEIGHT, h: The average of the roof eave height and the height to the highest point on the roof surface, except that, for roof angles of less than or equal to 10°, the mean roof height is permitted to be taken as the roof eave height." §26.3: "h = mean roof height … except that eave height shall be used for roof angle θ less than or equal to 10°." Fig. 27.3-1 and Fig. 28.3-1 notation: "eave height shall be used for θ ≤ 10°." SOURCE `theta > 10 ? h : eaveH` (590) is correct including the ≤ (only Fig. 28.5-1, not used here, says "< 10°"). LIVE's single h input is acceptable with the L-06 note.
22. **Ground elevation**: SOURCE K<sub>e</sub> formula; LIVE takes K<sub>e</sub> as an input (0.8–1.0) — both consistent with Table 26.9-1 Notes 1–3.

## Gate 2 — merged calc (2026-09-15)

**CALC:** `public/Calcs/asce716_mwfrs_calculator.html` at `302ad5a` (merge commits 43fa991..302ad5a). **CODE:** ASCE 7-16 PDF, page numbers as in Gate 1. **Method:** harness run; every constant table in CALC re-read against the figure images (Fig. 27.3-1 PDF 331, Figs. 27.3-4/5 PDF 334-335, Fig. 27.3-7 PDF 337, Fig. 28.3-1 LC B PDF 368, §28.3.5 PDF 369; CN_TROUGHED is byte-identical to SOURCE, which Gate 1 verified against PDF 336); six cases hand-computed in an independent script with constants typed from the PDF (own interpolation code, no calc functions), then driven in headless Chromium (`tools/_gate2.mjs`, deleted) with the harness's route-to-`public/` setup and compared against both `window.__mwfrsLast` and the rendered table text.

### Harness

`node tools/test-mwfrs-wind.mjs` → **62 PASS, 0 FAIL, `ALL PASS`** (4 baseline cases, no page errors, parallel-to-ridge ×2, L-02 ×3, open ×12, frame ×7 incl. S-01 ×2, round-trip, legacy ×3, sweep ×18, visibility ×6).

### Gate 1 decision verification

| ID | Verified where (CALC line) | Evidence |
|---|---|---|
| S-01 | 608-610 `Kh28 = (exp==='B' && hVal<30) ? 0.70 : Kh`, `qh28`; passed to `longFrameForce` at 618 | Case (d): frame block q<sub>h</sub> = 18.43 psf (K<sub>h</sub> 0.700) while page q<sub>h</sub> = 15.27 psf (K<sub>h</sub> 0.580). Harness S-01 checks pass. |
| L-01 | 299-300 rows 60 → 0.6, 80 → 0.8; 396-397 clamp to the 80 row; input `max="80"` at 192 | Case (f) θ = 70° → windward 0.70 / 0.70, leeward −0.60. (θ > 80° cannot be entered; the clamp gives 0.8 = footnote c.) |
| L-02 | 379-390 `flatRoofCp` interpolates each zone between the ≤0.5 and ≥1.0 tables | Case (e): 40×40×40 → −1.3 (0–h/2), −0.7 (h/2–h), two zones; 60×120×40 Wind-X → −1.033 / −0.833 / −0.567, Wind-Y (0.333) unchanged four-zone. |
| L-03 | 178-183 `#ridgeDir`; 586-587 `normalX`; 776 `!normalToRidge` → zone table; 808-809 | Case (a) Wind-Y (parallel, L = 80, h/L = 0.375) renders the zone table; case (b) ridge along B → "Normal-to-ridge direction = Wind-Y (NS)". |
| S-03 / L-04 | 298 row 45, h/L ≤ 0.25 → `[0.0, 0.4, −0.6]` | Case (f) θ = 40°, h/L = 0.15 → windward (low) 0.00, (high) 0.40, leeward −0.60. |
| S-06 | 612 `theta>0 && theta<=45` | Code read. |
| S-07 | 626 `hL90: hVal/Lridge`; 1035-1036 `warn90` | Case (b) h/L<sub>90</sub> = 0.225 → "h/L = 0.23 … outside 0.25 ≤ h/L ≤ 1.0 — Fig. 27.3-7 does not apply directly" rendered; case (d) 0.178 same. |
| S-09 | 493 `Aedge = a*eaveH + 0.5*a*a*tanθ` | Case (c) A<sub>edge</sub> = 134.43 ft², case (d) 53.33 ft² — both match hand. |
| L-05 | 243 block title "Parapet Pressures (§27.3.4)"; 749 comment; 955, 958, 980 | grep: "27.3.5" now appears only in the Fig. 27.3-8 / Appendix D exception (1106), which is correct. |
| L-06 | 200 geometry note (mean h; eave for walled θ ≤ 10°; free roofs mean h) | Rendered under Building Geometry, prints. |
| S-04 | 521-525 `frameEligible()` | UI walk: frame block visible only for Partially Enclosed + Gable/Hip and Open + Pitched. |
| S-05 | 603 `qz(hVal…)`, 626 `hL: hVal/Wperp` | Open path uses the single mean-roof-height input. |
| S-08 | 740-741 `calcDir` ×2; 808-809 `getRoofPressures` ×2 | Both directions rendered for every walled case. |
| L-08 | 132 option "Partially Open"; 304 `GCPI_MAP.partialOpen = 0.18` | UI walk: Partially Open × 4 roof types → "GCpi = ±0.18". |
| S-14 / S-15 / L-07 / S-02 (notes) | 1097-1098 (16 psf × A<sub>f</sub>, A<sub>f</sub> defined); 1054 (fascia / inverted parapet); 992 (fn. b not applied); 1005-1010 (Note 4 / Note 6 labels) | Rendered in the walk. |

### Findings

| ID | Sev. | Reference | File : line | What the file has | What it should be | Fix |
|---|---|---|---|---|---|---|
| G2-01 | MAJOR | Spec "Both paths keep … are-utils toolbar … save/load"; `are-utils-v2.js` 1479-1630 (`loadFromState`), 856 (`data-are-ignore`) | CALC 1892-1909 (adapter `setModel` → `calculate()`), 1127-1148 (`renderSend` selects) | **Toolbar Load of any Open-building snapshot is rejected and rolled back.** `loadFromState` runs `adapter.setModel()` → `calculate()` on the page's *current* inputs before the file's fields are applied; on a fresh page that is an Enclosed run, which materializes `#sendDir`, `#sendStory`, `#diaStoryX`, `#diaStoryY`. An Open snapshot carries no such keys (`captureState` on case (b): 23 fields, no send controls) → `notInFile` mismatch → `ok:false, rolledBack:true`. Probed three ways (fresh page; page that had already run a walled calc; snapshot captured before Calculate) — all roll back. The rollback then calls `setModel(backup)` → `calculate()` while the file's Open inputs are still in the DOM and only afterwards restores the input values, so the page is left showing **Open results (openBlk visible, `__mwfrsLast.encl='open'`, q<sub>h</sub> 23.12) above Enclosed default inputs (60×120×40)** — the inconsistent record the loader's own comments say it exists to prevent. `{force:true}` gives the mirror image (Open inputs, Enclosed results). A walled snapshot (case (a)) loads `ok:true, applied:27`. | Open snapshots load like walled ones. | Add `data-are-ignore` to the four result-derived selects built in `renderSend` (they are rebuilt by `calculate()` and carry no user data); are-utils then excludes them from capture and from the reverse diff. Add a toolbar `captureState()` → `loadFromState()` → `runAndSettle()` round trip for an Open case (and a walled case captured before Calculate, which fails the same way today) to the harness. The adapter block is byte-identical pre/post merge — the mechanism is pre-existing, but every Open snapshot hits it. |
| G2-02 | MAJOR | Fig. 27.3-4 diagrams, PDF 334 (p.279) | CALC 1054 | "monoslope: γ = 0° wind into the low eave, γ = 180° into the high eave" | The γ = 0° sketch has the wind arriving at the **high** eave (roof falls away from the wind; θ is drawn at the low, leeward end); γ = 180° arrives at the low eave. The C<sub>N</sub> values in the calc are correct (verified cell by cell) — the note tells the engineer to put the γ = 0° pattern on the wrong edge, which is the whole point of listing γ. | Swap: "γ = 0° wind into the high eave, γ = 180° into the low eave". |
| G2-03 | MINOR | Table 26.9-1; commit c55d3a3 ("URL prefill for new inputs") | CALC 1840-1848 | `?groundElev=5000` sets `#groundElev` = 5000 but `#Ke` stays 1.00 (`updateKeFromElev` is only wired to `oninput`) | K<sub>e</sub> = 0.834 | After the prefill loop: `if (qp.has('groundElev') && !qp.has('Ke')) updateKeFromElev();`. Conservative direction (K<sub>e</sub> ≤ 1), prefill path only. |
| G2-04 | MINOR | Table 26.10-1 fn. a | CALC 1090 | §28.3.5 ref line always prints "Kh = … (Exposure B, h < 30 ft → Kz = 0.70 per Table 26.10-1 fn. a)" — case (c) shows "Kh = 1.144 (Exposure B, h < 30 ft → …)" in Exposure D | State the footnote only when it was applied; otherwise "Kh per Table 26.10-1" | Conditional on the footnote having been applied (store a flag in `longFrameForce` or pass `exp`/`h` to `renderFrame`). |
| G2-05 | MINOR | Fig. 27.3-7, zones by distance from the windward edge along L = ridge length | CALC 475-479, 1057-1061 | Zones "> h, ≤ 2h" and "> 2h" are listed even when the ridge is shorter than them: L<sub>ridge</sub> = 30 ft, h = 20 ft → "> 2h" (beyond 40 ft) shown for a 30 ft roof | Only zones that exist on the roof; show the ft bounds (0–h, h–2h, >2h in ft) as the walled zone table does | Filter `from < Lridge`, clamp `to`, print bounds. |
| G2-06 | MINOR | §28.3.5 geometry guard (commit 301386c) | CALC 815 `setBlk('frameBlk',!!frame)`, 1068-1069 | For a walled Gable/Hip with h ≤ rise/2 the "§28.3.5 not evaluated: … eave height is positive" warning is written into a block that is hidden — never seen (probe: Partially Enclosed, 30°, B = 60, h = 5 → `frame:null`, `frameBlk` display none) | Warning visible | `setBlk('frameBlk', !!frame || frameReason==='geometry')`. |
| G2-07 | MINOR | Figs. 27.3-4 to 27.3-7 (free roof, no walls) | CALC 1211-1349 `drawMWFRSDiagram` | For Open the diagram draws two walls, "+p, WW" / "−p, LW" wall arrows and the caption "Fig. 27.3-1 \| Cp,WW = +0.8 (qz) \| Cp,LW per L/B" (prints on p.2 of the case (b) PDF) | A free roof on columns with the C<sub>N</sub> uplift/downward arrows, caption Figs. 27.3-4 to 27.3-7 | Branch on `isOpenEncl()`; at minimum drop the wall arrows/caption. (Pre-existing: pitched walled roofs are also drawn flat.) |
| G2-08 | MINOR | Fig. 27.3-1 Note 2 (interpolation on h/L) | CALC 1008 `f1(r.hL)` | Sloped-roof note prints h/L to one decimal: case (c) h/L = 0.467 → "h/L = 0.5"; case (f) 0.15 → "0.2" — reads as if the 0.5 column were used unmodified | Two or three decimals | `f2(r.hL)` (the wall tables already use `f2` for L/B). |
| G2-09 | MINOR | — | CALC 662 | `var cumH=hVal;` unused (`stories` at 591-597 is also gathered before the Open early-return and unused there — harmless) | — | Delete 662. |
| G2-10 | MINOR (harness) | — | `tools/test-mwfrs-wind.mjs` 232 | `legacy: theta row visible` reads `e.style.display`, which the class-based toggle never sets → always passes; no toolbar save/load round trip (see G2-01) | Computed style; toolbar round trip | `getComputedStyle(e).display !== 'none'`; add `captureState`/`loadFromState` cases. |
| G2-11 | MINOR (pre-existing, print) | — | CALC 11-12 + `are-theme-v2.css` | `.header h1` prints navy-on-navy (illegible) on page 1 of both PDFs; the AREv2 RESULTS chip row splits across a page break (case (b) p.5 has one orphan chip) | Legible title; keep the chip row together | Theme print rule for `.header h1`; `break-inside: avoid` on the results bar. Not merge-related. |

No BLOCKER: every design pressure, coefficient, K<sub>z</sub>, K<sub>e</sub>, story shear and §28.3.5 quantity checked matches the code and the hand values.

### Hand checks (constants typed from the PDF; page values from `__mwfrsLast` and the rendered tables)

Common: K<sub>d</sub> = 0.85, G = 0.85, q = 0.00256 K<sub>z</sub> K<sub>zt</sub> K<sub>d</sub> K<sub>e</sub> V² (Eq. 26.10-1); walls WW = q<sub>z</sub>G(0.8) ∓ q<sub>h</sub>GC<sub>pi</sub>, LW = q<sub>h</sub>GC<sub>p,LW</sub> ± q<sub>h</sub>GC<sub>pi</sub>, SW = q<sub>h</sub>G(−0.7); p<sub>net</sub> = q<sub>z</sub>G(0.8) − q<sub>h</sub>GC<sub>p,LW</sub>; F = p<sub>net</sub> × h<sub>trib</sub> × B<sub>⊥</sub>.

**(a) Enclosed, Gable/Hip θ = 20°, ridge along D, V = 120, Exp B, K<sub>zt</sub> = 1, z<sub>g</sub> = 0 (K<sub>e</sub> = 1.000), B = 50, D = 80, h = 30, stories 15/15, h<sub>p</sub> = 0.** K<sub>h</sub>(30, B) = 0.70 → q<sub>h</sub> = 0.00256 × 0.70 × 0.85 × 120² = **21.934 psf** (page 21.93). Story mids 22.5 ft (K<sub>z</sub> 0.64, q<sub>z</sub> 20.054) and 7.5 ft (0.57, 17.861). GC<sub>pi</sub> ±0.18 → q<sub>h</sub>GC<sub>pi</sub> = 3.948.

| Dir | L/B → C<sub>p,LW</sub> | Story | WW A | WW B | LW A | LW B | SW | p<sub>net</sub> | F (lb) | V<sub>cum</sub> (lb) |
|---|---|---|---|---|---|---|---|---|---|---|
| X (L 50, B<sub>⊥</sub> 80) | 0.625 → −0.50 | Roof | 9.689 (9.7) | 17.585 (17.6) | −5.374 (−5.4) | −13.270 | −13.051 (−13.1) | 22.959 (23.0) | 13,775 (13.78 k) | 13,775 |
| | | Floor 1 | 8.197 (8.2) | 16.093 (16.1) | −5.374 | −13.270 | −13.051 | 21.467 (21.5) | 25,761 (25.76 k) | **39,536 (39.54 k)** |
| Y (L 80, B<sub>⊥</sub> 50) | 1.6 → −0.38 | Roof | 9.689 | 17.585 | −3.137 (−3.1) | −11.033 | −13.051 | 20.721 (20.7) | 7,771 (7.77 k) | 7,771 |
| | | Floor 1 | 8.197 | 16.093 | −3.137 | −11.033 | −13.051 | 19.230 (19.2) | 14,422 (14.42 k) | **22,193 (22.19 k)** |

Roof, Wind-X normal to ridge (h/L = 30/50 = 0.6, column t = 0.2 between 0.5 and ≥1.0, θ row 20): C<sub>p</sub> = −0.4 + 0.2(−0.3) = **−0.46**; 0.0 + 0.2(−0.18) = **−0.036**; leeward **−0.60**. p<sub>A</sub> = q<sub>h</sub>G C<sub>p</sub> − 3.948 → **−12.524 / −4.619 / −15.135**; p<sub>B</sub> → −4.628 / +3.277 / −7.238. Page: −0.46 / −0.04 / −0.60; −12.5 / −4.6 / −15.1; −4.6 / 3.3 / −7.2 ✓.
Roof, Wind-Y parallel to ridge (zone table, L = 80, h/L = 0.375 ≤ 0.5): 0–15 ft −0.9 → **−20.728**; 15–30 −0.9 → −20.728; 30–60 −0.5 → −13.270; 60–80 −0.3 → −9.541; Case B = q<sub>h</sub>(0.18 − 0.153) = +0.592 all zones. Page: −20.7 / −20.7 / −13.3 / −9.5; 0.6 ✓.
Baseline `enclosed-sloped20-2story`: walls, story shears, q<sub>h</sub>, roofX identical to 1e-9; the only differences are `roofType` "sloped"→"gablehip", `roofY` (now the zone table) and the new keys `ridgeDir`, `frame:null`, `open:null`, `roofX.roofType` — exactly the allowlisted set.

**(b) Open, monoslope, obstructed, θ = 10°, ridge along B, V = 115, Exp C, z<sub>g</sub> = 2,500 ft, B = 80, D = 30, h = 18.** K<sub>e</sub> = e<sup>−0.0000362 × 2500</sup> = 0.91347 → field shows **0.913** (3 dp) and the calc uses 0.913 (page shows "Ke = 0.913 (zg = 2500.0 ft)"). K<sub>h</sub>(18, C) = 0.85 + 0.05 × 3/5 = **0.880** → q<sub>h</sub> = 0.00256 × 0.88 × 0.85 × 0.913 × 115² = **23.121 psf** (page 23.12). q<sub>h</sub>G = 19.653. Ridge along B → normal-to-ridge = Wind-Y, L = D = 30 → h/L = **0.60** (in range); L<sub>ridge</sub> = 80 → h/L<sub>90</sub> = **0.225** → warning expected and rendered. θ = 10° → t = (10 − 7.5)/7.5 = 1/3 between the 7.5° and 15° rows of Fig. 27.3-4, obstructed:

| γ / case | C<sub>NW</sub> | C<sub>NL</sub> | p<sub>W</sub> | p<sub>L</sub> | page |
|---|---|---|---|---|---|
| 0° A | −1.0 + (−1.1 + 1.0)/3 = **−1.033** | −1.5 | −20.308 | −29.479 | −1.03 / −1.50 / −20.3 / −29.5 ✓ |
| 0° B | −1.7 + (−2.1 + 1.7)/3 = **−1.833** | −0.8 + (−0.6 + 0.8)/3 = **−0.733** | −36.030 | −14.412 | −1.83 / −0.73 / −36.0 / −14.4 ✓ |
| 180° A | −0.2 + (0.4 + 0.2)/3 = **0.000** | −1.2 + (−1.1 + 1.2)/3 = **−1.167** | 0.000 | −22.928 | 0.00 / −1.17 / 0.0 / −22.9 ✓ |
| 180° B | 0.8 + (1.2 − 0.8)/3 = **0.933** | −0.3 | 18.343 | −5.896 | 0.93 / −0.30 / 18.3 / −5.9 ✓ |

Fig. 27.3-7 obstructed, zones 0–18 / 18–36 / 36–80 ft: A −1.2 → −23.583, −0.9 → −17.688, −0.6 → −11.792; B 0.5 → +9.826, 0.5 → +9.826, 0.3 → +5.896. Page: −23.6 / −17.7 / −11.8; 9.8 / 9.8 / 5.9 ✓. Frame block: "§28.3.5 not applicable" (monoslope) ✓. GC<sub>pi</sub> "0 (open)" ✓. `buildRevitWindPayload()` → null, `localStorage.ARE_mwfrs_wind` → null ✓.

**(c) Partially Enclosed, Gable/Hip θ = 25°, ridge along D, V = 130, Exp D, B = 60, D = 150, h = 28, stories 10/9/9, h<sub>p</sub> = 0, n = 6, A<sub>S</sub> = 400 ft².** K<sub>h</sub>(28, D) = 1.12 + 0.04 × 3/5 = **1.144** → q<sub>h</sub> = **42.070 psf** (page 42.07). GC<sub>pi</sub> ±0.55 → q<sub>h</sub>GC<sub>pi</sub> = 23.138. Story mids 23 (K<sub>z</sub> 1.104, q<sub>z</sub> 40.599), 13.5 (1.03, 37.878), 4.5 (1.03, 37.878).

| Dir | C<sub>p,LW</sub> | Story | WW A | WW B | LW A | SW | p<sub>net</sub> | F (lb) | V<sub>cum</sub> |
|---|---|---|---|---|---|---|---|---|---|
| X (L 60, B<sub>⊥</sub> 150, L/B 0.4) | −0.50 | Roof / F1 / F2 | 4.469 / 2.618 / 2.618 | 50.746 / 48.895 / 48.895 | +5.259 | −25.032 | 45.487 / 43.637 / 43.637 | 34,115 / 62,182 / 58,909 | 34,115 / 96,297 / **155,207 (155.21 k)** |
| Y (L 150, B<sub>⊥</sub> 60, L/B 2.5) | −0.3 + 0.1 × 0.5/2 = −0.275 | Roof / F1 / F2 | same | same | +13.305 | −25.032 | 37.441 / 35.591 / 35.591 | 11,232 / 20,287 / 19,219 | 11,232 / 31,519 / **50,738 (50.74 k)** |

Page: 4.5 / 50.7 / 5.3 / −25.0 / 45.5 …; 34.12 / 62.18 / 58.91 → 155.21 k; Wind-Y −0.28, 13.3, 37.4 …; 11.23 / 20.29 / 19.22 → 50.74 k ✓ (all).
Roof, Wind-X normal (h/L = 28/60 = 0.4667, t = 0.8667 between the ≤0.25 and 0.5 columns, θ row 25): C<sub>p</sub> = −0.2 + 0.8667(−0.1) = **−0.2867**; 0.3 + 0.8667(−0.1) = **0.2133**; −0.60. p<sub>A</sub> = −33.390 / −15.510 / −44.594; p<sub>B</sub> = +12.887 / +30.767 / +1.683. Page −0.29 / 0.21 / −0.60; −33.4 / −15.5 / −44.6; 12.9 / 30.8 / 1.7 ✓ (note prints "h/L = 0.5", G2-08).
Roof, Wind-Y parallel (L = 150, h/L = 0.187): 0–14 −0.9 → −55.322; 14–28 −0.9; 28–56 −0.5 → −41.018; 56–150 −0.3 → −33.866; Case B +16.702. Page −55.3 / −55.3 / −41.0 / −33.9; 16.7 ✓.
§28.3.5: rise = 30 tan 25° = **13.989 ft**; eave = 28 − 6.995 = **21.005 ft**; A<sub>E</sub> = 60 × 21.005 + ½ × 60 × 13.989 = 1,260.3 + 419.7 = **1,680.0 ft²**; a = max(min(0.1 × 60, 0.4 × 28), max(0.04 × 60, 3)) = max(min(6, 11.2), 3) = **6.0 ft**; A<sub>edge</sub> = 6 × 21.005 + ½ × 36 × tan 25° = 126.03 + 8.39 = **134.43 ft²** (S-09); A<sub>bulk</sub> = 1,545.57. (GC<sub>pf</sub>)<sub>ww</sub> = (0.40 × 1,545.57 + 0.61 × 134.43)/1,680 = **0.4168**; (GC<sub>pf</sub>)<sub>lw</sub> = (−0.29 × 1,545.57 − 0.43 × 134.43)/1,680 = **−0.3012**; K<sub>B</sub> = 1.8 − 0.6 = **1.20**; φ = 400/1,680 = **0.2381**; K<sub>S</sub> = 0.60 + 0.073 × 3 + 1.25 × 0.2381<sup>1.8</sup> = 0.819 + 0.0944 = **0.9134**; q<sub>h</sub> = 42.070 (Exp D, no K<sub>z</sub> floor); p = 42.070 × 0.7180 × 1.20 × 0.9134 = **33.109 psf**; F = 33.109 × 1,680 = **55,624 lb**. Page: 14.0 / 21.0 / 1680.0 / 6.00 / 134.4 / 0.238 / 0.417 / −0.301 / 1.200 / 0.913 / 42.07 / 33.1 / 55,624 lb (55.62 kips) ✓. Frame block visible, "in addition to the wall pressures above" ✓.

**(d) Open, pitched, clear, 4:12 (pitch mode), ridge along D, V = 110, Exp B, B = 40, D = 90, h = 16, n = 5, A<sub>S</sub> = 0.** θ = atan(4/12) = **18.435°** (label "(θ = 18.43°)", summary "θ=18.4°"). K<sub>z</sub>(16, B) = 0.57 + 0.05/5 = **0.58** → page q<sub>h</sub> = 0.00256 × 0.58 × 0.85 × 110² = **15.271 psf** (page 15.27, K<sub>h</sub> 0.580). §28.3.5: K<sub>z</sub> = **0.70** (fn. a) → q<sub>h,28</sub> = 0.00256 × 0.70 × 0.85 × 110² = **18.431 psf** (frame block 18.43, "Kh = 0.700") — both numbers confirmed on the same page. C<sub>N</sub> (Fig. 27.3-5 clear, t = 0.458 between 15° and 22.5°): A 1.1 / −0.4 + 0.458 × 0.5 = **−0.171**; B 0.1 − 0.458 × 0.2 = **0.0084** / −1.1 + 0.458 × 0.3 = **−0.963**. p (q<sub>h</sub>G = 12.980): A 14.278 / −2.220; B 0.109 / −12.495. Page 1.10 / −0.17 / 14.3 / −2.2; 0.01 / −0.96 / 0.1 / −12.5 ✓. Fig. 27.3-7 clear: −10.384 / −7.788 / −3.894; +10.384 / +6.490 / +3.894 → page −10.4 / −7.8 / −3.9; 10.4 / 6.5 / 3.9 ✓. h/L = 0.40; h/L<sub>90</sub> = 0.178 → warning ✓. Frame: rise = 20 × 1/3 = 6.667; eave 12.667; A<sub>E</sub> = 506.67 + 133.33 = **640.0**; a = max(min(4, 6.4), max(1.6, 3)) = **4.0**; A<sub>edge</sub> = 50.667 + 2.667 = **53.33**; GC<sub>pf</sub> **0.4175 / −0.3017**; K<sub>B</sub> **1.40**; K<sub>S</sub> = 0.60 + 0.146 = **0.746**; p = 18.431 × 0.7192 × 1.4 × 0.746 = **13.843**; F = **8,860 lb**. Page 6.7 / 12.7 / 640.0 / 4.00 / 53.3 / 0.418 / −0.302 / 1.400 / 0.746 / 18.43 / 13.8 / 8,860 lb ✓.

**(e) Enclosed, Flat, V = 115, Exp C, h = 40.** K<sub>z</sub>(40, C) = 1.04 → q<sub>h</sub> = **29.929 psf**; Case B = +0.808 all zones. 40×40 (h/L = 1.0 both ways): two zones, 0–20 ft C<sub>p</sub> **−1.3** → −38.458; 20–40 **−0.7** → −23.195. Page −1.30 / −0.70; −38.5 / −23.2, both directions ✓. 60×120: Wind-X (h/L = 0.667, t = ⅓) 0–20 −0.9 + ⅓(−0.4) = **−1.033** → −31.675; 20–40 −0.9 + ⅓(0.2) = **−0.833** → −26.587; 40–60 −0.5 + ⅓(−0.2) = **−0.567** → −19.803 (>2h zone starts at 80 > L, dropped). Wind-Y (h/L = 0.333): −0.9 / −0.9 / −0.5 / −0.3 → −28.283 / −28.283 / −18.107 / −13.019. Page −1.03 / −0.83 / −0.57; −31.7 / −26.6 / −19.8; −0.90 / −0.90 / −0.50 / −0.30 ✓.

**(f) Enclosed, Gable/Hip, B = D = 200, h = 30 (h/L = 0.15 ≤ 0.25), V = 115, Exp C.** K<sub>z</sub>(30, C) = 0.98 → q<sub>h</sub> = 28.202; q<sub>h</sub>GC<sub>pi</sub> = 5.076. θ = 40°: rows 35 and 45 at h/L ≤ 0.25 are both [0.0, 0.4, −0.6] → **0.00 / 0.40 / −0.60**; p<sub>A</sub> = −5.076 / +4.512 / −19.459; p<sub>B</sub> = +5.076 / +14.665 / −9.307. Page 0.00 / 0.40 / −0.60; −5.1 / 4.5 / −19.5; 5.1 / 14.7 / −9.3 ✓ (S-03/L-04). θ = 70°: rows 60 (0.6) and 80 (0.8), t = 0.5 → **0.70 / 0.70 / −0.60**; p<sub>A</sub> = +11.704 / +11.704 / −19.459. Page 0.70 / 0.70 / −0.60; 11.7 / 11.7 / −19.5 ✓ (L-01).

### UI walk (headless Chromium, computed styles after Calculate; defaults h<sub>p</sub> = 3, θ = 18°, 60×120×40)

| Enclosure × roof | Result blocks visible | Input rows visible | GCpi | Note | NaN / errors |
|---|---|---|---|---|---|
| Enclosed / Partially Enclosed / Partially Open × Flat | wx, wy, parapet, roof, min, send | closedRoofGroup, hpRow | ±0.18 / ±0.55 / ±0.18 | — | none |
| … × Gable/Hip | wx, wy, parapet, roof, min, send (+ **frame** for Partially Enclosed only) | closedRoofGroup, ridgeRow, angleModeRow, thetaRow, hpRow (+ frameRowN, frameRowAs for Partially Enclosed only) | as above | — | none |
| … × Monoslope | wx, wy, parapet, roof, min, send | closedRoofGroup, ridgeRow, angleModeRow, thetaRow, hpRow | as above | "Note 4" label present, rows "Entire roof as WW / LW" | none |
| … × Mansard | same | same | as above | "Note 6" label present, rows "WW slope / Top + LW slope" | none |
| Open × Monoslope / Troughed × Clear / Obstructed | open, openTrans, frame (text "not applicable"), min | openRoofGroup, windFlowGroup, ridgeRow, angleModeRow, thetaRow | 0 (open) | — | none |
| Open × Pitched × Clear / Obstructed | open, openTrans, **frame (computed)**, min | as above + frameRowN, frameRowAs | 0 (open) | — | none |

Hidden for every Open combination: wxBlk, wyBlk, roofBlk, parapetBlk, sendBlk, hpRow, closedRoofGroup ✓. Pitch mode: pitchRow shown, thetaRow hidden ✓. `#results` innerText free of "NaN"/"undefined" in all 18 combinations and all 8 hand-check runs. Console: zero errors other than 404s for the two external Google-font sheets `are-calc.css` imports (not on disk under the harness route); zero `pageerror`, zero dialogs. Open with θ = 50°: warning "θ = 50.0° exceeds the 45° limit …" rendered and C<sub>N</sub> clamped to the 45° row ✓.

### Save / load

- `collectInputsMWFRS()` on case (b) → reload → `applyInputsMWFRS(saved)` → Calculate: `__mwfrsLast` deep-diff **0 differences** (K<sub>e</sub> 0.913 and z<sub>g</sub> 2,500 both restored).
- Legacy v1 object (`roofType:'sloped'`, no `groundElev`): `#roofType` = **gablehip**, `#thetaRow` computed display ≠ none, `#groundElev` = 0, `#Ke` = 1 (kept from the file, not overwritten); Calculate → deep-diff vs case (a) **0 differences**.
- AREv2 toolbar: the file picker cannot be driven headlessly, so the state path was exercised directly — `AREv2.captureState()` → fresh page → `AREv2.loadFromState(state)` (what `loadFromHtml` calls). Walled case (a): `ok:true, applied:27`, inputs restored. Open case (b): **rejected and rolled back** — see **G2-01**. The toolbar Save itself (snapshot .html download) was not exercised.

### Revit

- Case (a) `buildRevitWindPayload()` vs baseline `cases["enclosed-sloped20-2story"].revit` (minus `generatedAt`): 10 differing paths, all in the expected set — `inputs.roofType` "sloped"→"gablehip"; `roof.directions[1]` type "sloped"→"flat", `theta_deg` dropped, zones 3→4 (Wind-Y is now the zone table); `roof.governing_uplift_psf` −15.1→**−20.7** and its zone "Wind-X / Leeward (Case A)"→"Wind-Y (L=80.0ft) / 0–h/2 (Case A)" (q<sub>h</sub>G(−0.9) − q<sub>h</sub>(0.18) = −20.73); `roof.governing_down_psf` 5.8→**3.3** and zone → "Wind-X / Windward (high) (Case B)" (the +0.1 Wind-Y windward value no longer exists; the largest positive is Wind-X WW-high Case B, +3.28); `revit.ARE_G_Wind_psf` 15.1→20.7 and `revit.ARE_G_WindDown_psf` 5.8→3.3 follow. `qh_psf`, `walls.*`, `parapet`, every other `inputs.*` and `roof.directions[0]` identical.
- Case (b): payload **null**; `localStorage.getItem('ARE_mwfrs_wind')` **null** (removed by the Open path even after a walled run in the same origin).

### Print (`page.pdf`, Letter, print media)

- Case (b) `gate2_case_b.pdf` (5 pp.): p.1 project / wind parameters; p.2 geometry + diagram + story heights; p.3 parameters + free-roof normal table; p.4 parallel table with the h/L warning, frame ("not applicable"), minimum loads, RESULTS chips; p.5 one orphan chip. The hidden blocks (wx, wy, roof, parapet, send) are absent with no gaps. The ARE toolbar `#areBar` does not print (only are-calc.css's attribution header line); the Print button, Calculate button and Save/Load/Revit buttons do not print. Diagram shows walls and wall arrows for the free roof (G2-07).
- Case (a) `gate2_case_a.pdf` (7 pp.): same structure; Wind-X, Wind-Y, roof (both tables), minimum loads, send-block base shears, RESULTS chips. Parapet block absent (h<sub>p</sub> = 0), no gap. Frame block absent (Enclosed). `.header h1` illegible in both (G2-11, theme, pre-existing).

### Stale text / dead code sweep

No "Enclosed & Partially Enclosed"-only wording remains (header line 89 lists all four classes). Parapet references are §27.3.4 throughout; "§27.3.5" appears only as the Fig. 27.3-8 / Appendix D exception. `'sloped'` survives only as the internal roof-object / Revit `type` tag and the legacy-file mapping (intended). Dead: `cumH` (G2-09). Misleading notes: G2-02, G2-04, G2-07, G2-08.

**GATE 2: PASS** — 0 blockers; 2 MAJOR (G2-01 toolbar Load of Open snapshots, G2-02 reversed γ note) recommended before deploy, 9 MINOR.
