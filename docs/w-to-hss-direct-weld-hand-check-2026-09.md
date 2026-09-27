# W-Beam Directly Welded to HSS Column — hand-check record

Date: 2026-09-27. Calculator: `public/Calcs/W_beam_to_HSS_column_calculator.html` (slug `w-to-hss-column`, engine `window.DWHSS`).
Spec: `docs/superpowers/specs/2026-09-27-w-to-hss-direct-weld-merge-design.md`. Plan: `docs/superpowers/plans/2026-09-27-w-to-hss-direct-weld-merge.md`.

Every engine value below was produced by `DWHSS.compute` on the page (headless Chromium, 2026-09-27), not re-typed from the fixtures. Hand values are computed longhand from the formulas in spec §4. Units: in, kips, ksi, kip-ft.

## 1. Reference verification (copied from spec §2)

| Ref | Claim in handoff | Verified? | Where / result |
|---|---|---|---|
| R1 DG24 1st ed (2010) §4.4, Ex 4.3 pp. 30, 46–48 | fit-on-flat step `bf ≤ B − 3t`; local yielding K1-2 (360-05/10 numbering), φ 0.95, Rn 70.8 k, φRn 67.3 k, φMn 88.1 kip-ft; punching skipped (bf < 0.85B); sidewall skipped (β ≠ 1.0) | **Yes** | local PDF `Technical Resources/Steel/Reference/AISC DESIGN GUIDE (DSG)/DG24-Hollow Structural Section Connections.pdf` is the **1st edition**; text matches. §7.1 p. 77 states the directly welded connection is "semi-rigid or partially restrained (PR)". Table 7-2 p. 80: punching when 0.85B ≤ Bp ≤ B − 2t; sidewall rows "when β = 1.0"; crippling K1-5 (φ 0.75) and buckling K1-6 (φ 0.90) carry Qf. |
| R2 DG24 2nd ed (2024) §6.4, Ex 6.3 pp. 124–125, 145–150 | flange wider than B permitted without trimming, credited width capped at B; PR classification | **Partly** | Not in Nick's library (AISC members download free at aisc.org/dg). STI review by Packer (July 2024, fetched) confirms: 2nd ed conforms to 360-22 + 16th Ed Manual, Chapter 6 covers the directly welded connection "which normally only qualifies as PR", Chapter 3 says kds may not be used for a single-sided fillet on a rectangular-HSS wall in tension, Chapter 8 tabulates six limit states for plate-to-rectangular HSS. Page numbers and the "no trimming" sentence are **unverified**. |
| R3/R4 AISC 360-22 §K1, K2.3, K5 | K1-1 = Be, K1-7 = end distance, K2.3 routes to Chapter J; no "Table K1.3A" | **Yes** | local PDF `AISC 2022/…a360-22w.pdf` pp. 16.1-159/160/171; Comm. K1/K2 pp. 16.1-529 to 531: branch width > 85% of chord → J10.2/J10.3/J10.5 sidewall limit states; < 85% → face bending and shear; yield-line φ = 1.00; WF-beam-to-HSS PR connections modeled as two transverse plates. |
| R5 Steel Interchange Jan 2014 | β = 1 cap, flange wider than HSS, effective weld width, fatigue caveat | **No** | AISC now redirects the PDF URL to its archive index; studylib mirror returns 403. Treat as unverified; the β ≤ 1.0 cap follows directly from the 360-22 K1.1 definition and limits (0.25 ≤ β ≤ 1.0), so the calculator does not depend on this reference. |
| R6 STI "Welding in HSS Corners" (2022) | flare-bevel groove at corners, throat per Table J2.2, R = 2t when unknown, root gap limits | **Yes** (fetched) | Effective throat from 360-22 Table J2.2 (flare-bevel: 5/16 R SMAW/FCAW-S/SAW, 5/8 R GMAW/FCAW-G; note: R < 3/8 in → use only the reinforcing fillet); R assumed 2t; welds must be filled flush or throat reduced by underfill. |
| R7 STI "HSS Moment Connection Design Examples: Transverse Flange Plates" (July 2025) | current-edition workflow | **Yes** (fetched) | HSS12x8x1/2 A500C, PL 3/8 × 6½, cross-connection, Pu 500 k, Mu 45 kip-ft. Published values reproduced by this design's formulas: Be 4.68 in; plate local yielding φRn 79.1 k (φ 0.90, J4-1); face plastification φRn 96.7 k (φ 1.00, Manual Part 9 yield line with Qf 0.918); punching 115.9 k; sidewall yielding 179.6 k (tw = 2t); weld le = 2Be = 9.37 in, φRn 52.2 k (¼ in fillet, no kds). |
| R8 STI "Wide-Flange Beam to HSS Column Moment Connections" (Ericksen, Oct 2014) | load path face → sidewalls, keep flat/bf ratio near 1 | **Yes** (fetched PDF) | Confirms; no equations. |
| SEU Jan 2014 (Olson) directly welded example | HSS8x8x3/8 A1085 + W16x36, Mu 66 kip-ft | **Yes** (fetched PDF) | φRn local yielding 58.4 k, punching applicable, Bep 3.28 in, φRn 79.3 k (φ 0.95, 360-10). Reproduced (79.2 k). |

DG24 1st ed Ex 4.3 was re-read from the local PDF for this record (pp. 46–48); the book values in §2(a) are quoted from that text.

## 2. Hand calculations against published values

### (a) DG24 1st ed Example 4.3 — W16X57 on HSS10X10X1/2 (fixture F1, legacy φ, CJP)

Inputs: HSS10X10X1/2 A500 Gr B (B = H = 10, t = 0.465, A = 17.2, Fy 46, Fu 58); W16X57 A992 (d 16.4, bf 7.12, tf 0.715, Fyb 50, Fub 65); Mu 60 kip-ft (26-003 demand; the book computes capacity only).

| Step | Hand calculation | Published (DG24) | Engine |
|---|---|---|---|
| Flat width | B − 3t = 10 − 3(0.465) = 8.605 in; bf 7.12 ≤ 8.605 → on the flat | 8.61 in, o.k. | 8.605, cls `flat` |
| β | bf/B = 7.12/10 = 0.712 | 0.712 | 0.712 |
| B/t | 10/0.465 = 21.505 | 21.5 | 21.505 |
| Be (Eq. K1-1) | (10/21.505)·(46·0.465)/(50·0.715)·7.12 = 0.4650 × 0.5983 × 7.12 = 1.981 in | not printed (implied 70.8/(50·0.715) = 1.980) | 1.981 |
| Rn | Fyb·tf·Be = 50 × 0.715 × 1.981 = 70.82 k | 70.8 k | 70.82 |
| φRn | 0.95 × 70.82 = 67.28 k | 67.3 k | 67.28 |
| Lever | d − tf = 16.4 − 0.715 = 15.685 in | 15.7 in | 15.685 |
| φMn | 67.28 × 15.685/12 = 87.94 kip-ft | 88.1 kip-ft | 87.94 |
| Punching | 7.12 < 0.85B = 8.50 → not required | skipped | TPS INFO, φRn 98.17 shown, excluded |
| Sidewalls | β = 0.712 < 0.85 → not required | skipped (1st ed rule: β = 1.0 only) | TSY/CSC INFO, φRn 179.78 / 374.39 shown, excluded |
| Face plastification | Fy t²[2η/(1−β) + 4/√(1−β)]Qf = 46(0.465)²[2(0.0715)/0.288 + 4/√0.288](1.0) = 9.946 × 7.950 = 79.07 k, φ 1.00 | not in DG24 1st ed Table 7-2 | TPL 79.07, applicable, D/C 0.581, not governing |
| Material ratios | Fy/Fu = 46/58 = 0.793; Fyb/Fub = 50/65 = 0.769 | 0.793, 0.769 | LIM PASS |

**Rounding 88.1 vs 87.94.** The book rounds the lever arm to 15.7 in (exact 15.685, +0.10 %) and φRn to 67.3 k (exact 67.277, +0.03 %): 67.3 × 15.7/12 = 88.05 → 88.1 kip-ft. The engine carries full precision. The 0.16 kip-ft (0.2 %) difference is rounding only. The engine reports φMn = Mu/max D/C = 60/0.68231 = 87.94; this equals φRn × (d − tf)/12 because flange local yielding governs and Puf is linear in Mu.

### (b) STI July 2025 — PL 3/8 × 6½ to HSS12x8x1/2 (fixture F5, 360-22, ¼ in fillet both faces, no kds)

Inputs: HSS12x8x1/2 A500 Gr C (connecting face B = 8, H = 12, t = 0.465, A = 17.2, S = 55.6, Fy 50, Fu 62); plate modelled as the beam flange (bf = 6.5, tf = 0.375, Fyb 50, Fub 65 engine default); cross (X) connection; column Pu 500 k, Mu 45 kip-ft; Mu chosen as 46.7 × 17.625/12 so that Puf = 46.7 k.

| Step | Hand calculation | Published (STI) | Engine |
|---|---|---|---|
| β | 6.5/8 = 0.8125 | 0.8125 | 0.8125 |
| Be | (10/17.204)·(50·0.465)/(50·0.375)·6.5 = 0.5813 × 1.240 × 6.5 = 4.685 in | 4.68 in | 4.685 |
| Plate local yielding (LY) | 0.90 × 50 × 0.375 × 4.685 = 0.90 × 87.84 = 79.06 k | 79.1 k | 79.06 |
| U (Eq. K1-6) | 500/(50·17.2) + 12·45/(50·55.6) = 0.5814 + 0.1942 = 0.7756 | 0.776 | 0.7756 |
| Qf (Eq. K1-4) | 1.3 − 0.4(0.7756)/0.8125 = 0.918 | 0.918 | 0.918 |
| Face plastification (PL) | η = 0.375/8 = 0.0469; 50(0.465)²[2(0.0469)/0.1875 + 4/√0.1875](0.918) = 10.811 × 9.738 × 0.918 = 96.66 k, φ 1.00 | 96.7 k | 96.66 |
| Punching (PS) | Bep = (10/17.204)(6.5) = 3.778; 0.6 × 50 × 0.465 × (2·0.375 + 2·3.778) = 13.95 × 8.306 = 115.87 k | 115.9 k | 115.87 (INFO: bfc 6.5 < 0.85B = 6.8, not required) |
| Sidewall yielding (SY) | k = 1.5t = 0.6975; 2 × 50 × 0.465 × (5·0.6975 + 0.375) = 46.5 × 3.8625 = 179.61 k | 179.6 k | 179.61 (INFO: β 0.8125 < 0.85) |
| Weld metal | le = 2Be = 9.370 in; 0.75 × 0.60 × 70 × 0.707 × 0.25 × 9.370 = 0.75 × 69.56 = 52.17 k | 52.2 k | 52.17 |
| Flange (plate) base metal | 0.75 × 0.60 × Fub × tf × Be = 0.75 × 0.60 × 65 × 0.375 × 4.685 = 51.39 k | **not checked by STI** | 51.39, caps the W row |
| HSS wall base metal | 0.75 × 0.60 × 62 × 0.465 × 9.370 = 121.56 k | not checked | 121.56, not governing |

The engine adds the Manual Part 9 base-metal cap: one plate thickness carries the shear from both fillets over Be, so the plate shear rupture strength (51.39 k) is below the weld metal strength (52.17 k). The W row therefore reports 51.39 k, D/C = 46.7/51.39 = 0.909, and governs. The WBF row agrees: tmin = 6.19 × D/Fub = 6.19 × 4/65 = 0.381 in > tf = 0.375 in (INFO, "base metal governs the weld row"). STI's 52.2 k is reproduced exactly as the weld metal value; the 1.5 % lower cap is an additional check, not a disagreement. LIM passes with the §K1.3 note exemption for A500 Gr C (Fy/Fu = 50/62 = 0.806). Engine φMn = 75.47 kip-ft, banner PASS.

### (c) SEU January 2014 (Olson) — W16x36 on HSS8x8x3/8 A1085 (fixture F6, legacy φ, CJP)

Inputs: HSS 8 × 8, t = 0.375 (A1085 design thickness = nominal), A 10.4, S 24.9, Fy 50, Fu 65; W16X36 (d 15.9, bf 6.99, tf 0.43, Fyb 50); Mu 66 kip-ft.

| Step | Hand calculation | Published (SEU) | Engine |
|---|---|---|---|
| Puf | 66 × 12/(15.9 − 0.43) = 792/15.47 = 51.20 k | 51.2 k | 51.20 |
| Be | (10/21.333)·(50·0.375)/(50·0.43)·6.99 = 0.4688 × 0.8721 × 6.99 = 2.857 in | — | 2.857 |
| Local yielding | 0.95 × 50 × 0.43 × 2.857 = 0.95 × 61.44 = 58.36 k | 58.4 k | 58.36 |
| Punching band | 0.85B = 6.80 ≤ bf 6.99 ≤ B − 2t = 7.25 → applicable | applicable | TPS applicable |
| Bep (Eq. K1-2) | (10/21.333)(6.99) = 3.277 in | 3.28 in | 3.277 |
| Punching | 0.95 × 0.6 × 50 × 0.375 × (2·0.43 + 2·3.277) = 0.95 × 11.25 × 7.413 = 79.23 k | 79.3 k | 79.23 |

SEU rounds Bep to 3.28 in: 0.95 × 11.25 × (0.86 + 6.56) = 79.30 k. The engine value (79.23) differs by rounding only. The engine also finds what the article does not discuss: flat = 8 − 3(0.375) = 6.875 in < bf = 6.99 in, so the flange reaches the corner radius by 0.0575 in per side (GEO REVIEW, and the CJP row REVIEW for the corner joint preparation). β = 0.874 ≥ 0.85 makes the sidewall rows applicable (SY 121.59 k, SC 241.33 k), neither governing. Engine φMn = 75.24 kip-ft governed by flange local yielding, tension flange (D/C 0.877), banner REVIEW.

## 3. 26-003-KAALO reconciliation

Record: `Technical Resources/Steel/Reference/26-003-KAALO - W-Beam Directly Welded to HSS Column - JST@ GLN6 LOW ROOF - 2026-09-23.html` (copy: `tools/fixtures/26-003-KAALO-w-to-hss-legacy-2026-09-23.html`). Fields: W16X57, Fyb 50, HSS10X10X1/2, Fy 46, Mu 60. The other inputs take the page defaults: Fub 65, Fu 58, Pu = Mu,col = 0, T-connection, column continuous, Vu 20, CJP.

| Result | Legacy (DG24 1st ed φ) | AISC 360-22 (default) |
|---|---|---|
| Governing | Beam flange local yielding — tension flange | Beam flange local yielding — tension flange |
| φ on flange local yielding through Be | 0.95 | 0.90 |
| φRn, flange local yielding | 67.28 k | 63.74 k |
| Max D/C (Puf = 45.90 k) | 0.6823 | 0.7202 |
| **φMn** | **87.94 kip-ft** (record: 87.94) | **83.31 kip-ft** |
| Banner | PASS | PASS |

The change is the resistance factor alone: 87.94 × 0.90/0.95 = 83.31 kip-ft (−5.3 %). The spec and plan state 83.27 kip-ft; the engine value is 83.31, and both display as 83.3 in the banner. The harness tolerance (±0.05) admits both.

Every row for that geometry (Puf = 45.90 k on each flange):

| Row | Limit state | Applicability at this geometry | φRn legacy (k) | φRn 360-22 (k) | D/C 360-22 | Status |
|---|---|---|---|---|---|---|
| TLY / CLY | Beam flange local yielding | always | 67.28 | 63.74 | 0.720 | PASS, governs |
| TPL / CPL | HSS face plastification (Qf 1.0) | β = 0.712 ≤ 0.85, applicable | 79.07 | 79.07 | 0.581 | PASS |
| TPS / CPS | HSS punching | bfc 7.12 < 0.85B = 8.50, not required | 98.17 | 103.33 | 0.444 | INFO |
| TSY / CSY | Sidewall local yielding | β < 0.85, not required | 179.78 | 179.78 | 0.255 | INFO |
| CSC | Sidewall crippling (T) | β < 0.85, not required | 374.39 | 374.39 | 0.123 | INFO |
| W | Flange weld | CJP develops the flange | — | — | — | INFO |
| GEO / LIM / END / QF | classification, §K1.3 limits, end distance, U = 0 → Qf 1.0 | — | — | — | — | INFO / PASS / INFO / INFO |
| STIFF / SHEAR / CAP | PR, web shear separate, φMn vs φbMpx 393.75 | — | — | — | — | INFO |

A forced toolbar Load of the record (file chooser, "Load anyway" on the mismatch confirm) is automated in `tools/test-w-to-hss.mjs`: it confirms the page hydrates W16X57 / HSS10X10X1/2 / Mu 60, shows 83.3 kip-ft in 360-22 mode and φMn 87.94 (banner 87.9) in legacy mode.

## 4. The 6-in handoff case (fixture F3)

Custom HSS 6 × 6 × 0.465 (A 9.74, S 16.1, Fy 46, Fu 58); custom beam d 12, bf 5.5, tf 0.5, tw 0.3; Mu 40 kip-ft; Puf = 40 × 12/11.5 = 41.74 k; 360-22.

- Classification. Flat = 6 − 3(0.465) = 4.605 in < bf 5.5 ≤ B 6: the flange reaches the corners. Overlap = (5.5 − 4.605)/2 = 0.4475 in per side. β = 5.5/6 = 0.917. GEO REVIEW (corner-region weld detail required); never a FAIL from geometry alone.
- Punching not required: bfc 5.5 > B − 2t = 5.07, above the 0.85B–(B − 2t) band. Face plastification not required: β > 0.85. Both are shown as INFO (φRn 122.24 and 157.71 k).
- Sidewalls govern the HSS side (β ≥ 0.85): SY = 2 × 46 × 0.465 × (5 × 0.6975 + 0.5) = 170.59 k (D/C 0.245); SC (T) = 397.30 k (D/C 0.105).
- Beam flange: Be = (10/12.903)(46 × 0.465)/(50 × 0.5)(5.5) = 3.647 in; φRn = 0.90 × 50 × 0.5 × 3.647 = 82.06 k (D/C 0.509).
- Corner weld. R = 2t = 0.93 in ≥ 3/8 in, so the corner portion is credited as a flare-bevel groove weld with effective throat E = 5/16 R = 0.29 in (SMAW/FCAW-S/SAW; GMAW/FCAW-G would give 5/8 R = 0.58 in). Per face, 0.895 in of the credited length is in the corners and 2.752 in is on the flat (Be = 3.647 in allocated from the flange edges inward).
- Weld results. 5/16 fillet, top face only: 0.75 × 0.6 × 70 × (0.221 × 2.752 + 0.2906 × 0.895) = 27.35 k, D/C 1.526 FAIL. Both faces: weld metal 54.69 k, capped by flange base metal 53.34 k, D/C 0.783, banner REVIEW; kds does not help because base metal governs. CJP: φMn 78.64 kip-ft (flange local yielding governs), banner REVIEW for the corner.

What the engineer must still detail for this case: the joint preparation through the corner radius (a CJP or flare-bevel through the radius is not prequalified), the actual corner radius where it differs from 2t, root opening and fill-flush requirements (STI 2022), weld inspection, and the web shear tab.

## 5. What the calculator leaves to the engineer

- Beam web shear connection (single-plate shear tab to the HSS wall, Manual Part 10): Vu is reported only.
- Rotational stiffness: the connection is classified PR (DG24 1st ed §7.1, 2nd ed Ch. 6). FR stiffness is not computed.
- Fatigue (AISC 360-22 Appendix 3) and seismic qualification (AISC 341 / 358): not addressed.
- Corner joint preparation and inspection when bf > B − 3t: the calculator credits the flare-bevel throat from Table J2.2 and flags REVIEW; the detail, root opening, backing and NDT are the engineer's.
- Column member design (HSS axial + flexure): only the chord-stress interaction U and Qf are used here; U > 1.0 is flagged REVIEW.
- DG24 2nd ed (2024) page references and the "no trimming" statement for flanges wider than B are unverified (edition not in the library).
- Steel Interchange January 2014 was not retrievable; nothing in the calculator depends on it.

## 6. How to run the tests

- `npm run test:wthss` — headless Chromium: 81 engine fixtures (`DWHSS.runFixtures()`), UI wiring, schematic, and the forced legacy-record load of 26-003-KAALO.
- Open the page with `?selftest=1` (`/Calcs/W_beam_to_HSS_column_calculator.html?selftest=1`): the fixture report prints on the page and the tab title reads `SELFTEST PASS n/n`.
- `npm run qa` chains `test:wthss` with the rest of the suite.
