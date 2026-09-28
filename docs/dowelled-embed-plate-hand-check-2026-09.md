# Dowelled Embed Plate — Tension Dowels — hand-check record

Date: 2026-09-27. Calculator: `public/Calcs/masonry_dowelled_embed_plate_calculator.html` (slug `masonry-dowelled-embed-plate`, engine `window.MDEP`).
Spec: `docs/superpowers/specs/2026-09-27-dowelled-embed-plate-design.md`. Plan: `docs/superpowers/plans/2026-09-27-dowelled-embed-plate.md`.

This record is written before the engine exists (plan Task 1). Every hand value below is computed longhand from the formulas in spec §4.1 and the provisions quoted in §1. The engine column reads "pending Task 2"; Task 2 fills it from `MDEP.compute` on the page and must never tune a fixture to the engine. Units: in, lb, psi.

Revised 2026-09-27 for the rulings in spec commit 7a6e28e (see §2): plate base metal now checks shear yielding (Eq. J4-3) beside shear rupture, the `wmin` row is INFO for `flare`, and `min12` runs at T = 0.

Sources read for this record (text extraction with poppler `pdftotext -layout`, 2026-09-27):

- TMS 402/602-22: `Technical Resources - Documents/Masonry/TMS-402-602-22.pdf`
- MDG 2022: `Technical Resources - Documents/Masonry/Masonry-Designers-Guide-2022_2023-09-26.pdf`
- AISC 360-22: `Technical Resources - Documents/Steel/Reference/AISC 2022/Specificaitons for Structural Steel Buildings (ANSI-AISC 360-22) a360-22w.pdf` (printed page numbers 16.1-xxx)

## 1. Reference verification (spec §9)

| Item | Spec claim | Verified? | Where / result |
|---|---|---|---|
| Eq. 6-2, K, γ, 12 in floor, epoxy ×1.5 | TMS 402-22 §6.1.6.3.1, PDF p. 96 | **Yes** | Code text PDF p. 96 (printed C-78). The commentary sentence that the epoxy increase does not apply to the 12 in minimum is on the next page, PDF p. 97 (C-79). Quotes below. |
| No 72·d_b cap | full-text search | **Yes, absent** | Searched the full 410-page extract for "72" near d_b / bar; only hits are an unrelated 72 in maximum (bond-beam spacing), a phone number and a reference year. |
| F_s = 32,000 (Gr 60), 20,000 (Gr 40/50) | §8.3.3.1, PDF p. 148 | **Yes** | PDF p. 148 (C-130): (a) Grade 40 or Grade 50: 20,000 psi; (b) Grade 60: 32,000 psi. |
| φ = 0.90 tension-controlled | Table 9.1.4, PDF p. 157 | **Yes** | PDF p. 157 (C-139): ε_t ≥ 0.003 + ε_ty, tension-controlled, φ = 0.90. MDG REK-09 SD writes φT_n = 0.9·A_s·f_y. See note O1. |
| A706 / CE submittal / AWS D1.4 | §6.1.7.3.1, PDF p. 101; TMS 602 Art. 3.4 B.7 | **Yes** | PDF p. 101 (C-83): welding shall conform to AWS D1.4/D1.4M; bars to be welded shall conform to ASTM A706 or carry a chemical-analysis and carbon-equivalent submittal. TMS 602 Art. 3.4 B.7 (printed S-68, PDF p. 370): splice welds in conformance with AWS D1.4. |
| Bar table | Table CC-6.1.3, PDF p. 89 | **Yes** | PDF p. 89 (C-71): #3 0.375/0.11 through #11 1.410/1.56, matches spec §3.4 exactly. |
| REK-09 ASD | MDG PDF p. 745 | **Yes** | Printed 19-76. T = 5,216 lb; T_all = 2 × 0.2 × 32,000 = 12,800 lb; K least of edge 3.56, clear 2.5, 9d_b 4.5 → 2.5; l_d = 18.6 in < 24 in. Figure: two straight #4 bars at 3½ + 3 + 3½ = 10 in, 24 in embedment, "Weldable Deformed Bar". |
| REK-09 SD | MDG PDF p. 814 | **Yes** | Printed 19-145. T_u = 9,115 lb; φT_n = 0.9 × 2 × 0.2 × 60,000 = 21,600 lb; same K = 2.5 and l_d = 18.6 in. The SD text calls item 2 "clear spacing between adjacent splices (dowels will be spliced to wall vertical No. 4 bars …)". |
| REK-10 | MDG PDF p. 746 | **Yes** | Printed 19-77. K = 7.63/2 − 0.50/2 = 3.57 in (< 9d_b = 4.5); l_d = 13.1 in ≥ 12 in. |
| Eq. J2-4, F_nw = 0.60F_EXX, φ 0.75, Ω 2.00 | §J2.4 Eq. J2-4 printed 16.1-130; Table J2.5 printed 16.1-131 to 132 | **Yes** | Eq. J2-2/J2-3/J2-4 and k_ds on 16.1-130; the PJP/flare-groove shear row (φ = 0.75, Ω = 2.00, 0.60F_EXX) is on 16.1-131 and the fillet-weld shear row (same φ, Ω and F_nw, effective area per J2.2a) on 16.1-132. |
| Flare-bevel throat 5/8 R, 5/16 R, note [a] | Table J2.2, printed 16.1-126 | **Yes** | Quote below. |
| Fillet effective throat | §J2.2a | **Yes** | 16.1-126: "the shortest distance from the root to the face of the diagrammatic weld" → 0.707w for equal legs. |
| Minimum fillet size | Table J2.4, printed 16.1-128 | **Yes** | Quote below. |
| Base metal shear yielding and rupture | §J4.2 Eqs. J4-3, J4-4, printed 16.1-146 | **Yes** | J4-3 (foot of 16.1-145): R_n = 0.60F_y·A_gv, φ = 1.00, Ω = 1.50. J4-4 (16.1-146): R_n = 0.60F_u·A_nv, φ = 0.75, Ω = 2.00. §J4.2 takes the lower value. |
| Table J2.4 exemption | §J2.2b(a) | **Yes** | 16.1-127: the minimum-size limitations "do not apply to fillet weld reinforcements of groove welds." |

### Quoted provisions

**TMS 402-22 §6.1.6.3.1** (PDF p. 96, printed C-78):

- Floor: "shall be determined by Equation 6-2, but shall not be less than 12 in. (305 mm)."
- Eq. 6-2: `l_d = 0.13·d_b²·f_y·γ / (K·√f'm)`
- K: "K shall not exceed the smallest of the following: the minimum masonry cover, the clear perpendicular spacing between adjacent reinforcement splices, and 9db."
- γ tiers: "γ = 1.0 for No. 3 (M#10) through No. 5 (M#16) bars and deformed wires; γ = 1.3 for No. 6 (M#19) through No. 7 (M#22) bars; and γ = 1.5 for No. 8 (M#25) and larger bars."
- Epoxy: "Development length of epoxy-coated bars and deformed wires embedded in grout shall be taken as 150 percent of the length determined by Equation 6-2."
- Commentary (PDF p. 97, C-79): "The 50 percent increase in development length for epoxy-coated bars does not apply to the 12 in. (305 mm) minimum."

**AISC 360-22 Table J2.2** (printed 16.1-126), Effective Throat of Flare Groove Welds:

| Welding Process | Flare-Bevel-Groove[a] | Flare-V-Groove |
|---|---|---|
| GMAW and FCAW-G | 5/8 R | 3/4 R |
| SMAW and FCAW-S | 5/16 R | 5/8 R |
| SAW | 5/16 R | 1/2 R |

"R = radius of joint surface (is permitted to be assumed equal to 2t for HSS, where t is the design wall thickness), in. (mm)"
"[a]For flare-bevel-groove with R < 3/8 in. (10 mm), use only reinforcing fillet weld on filled flush joint."

**AISC 360-22 Table J2.4** (printed 16.1-128), Minimum Size of Fillet Welds:

| Material Thickness of Thinner Part Joined, in. (mm) | Minimum Size of Fillet Weld,[a] in. (mm) |
|---|---|
| To 1/4 (6) inclusive | 1/8 (3) |
| Over 1/4 (6) to 1/2 (13) | 3/16 (5) |
| Over 1/2 (13) to 3/4 (19) | 1/4 (6) |
| Over 3/4 (19) | 5/16 (8) |

"[a]Leg dimension of fillet welds. When non-low hydrogen electrodes are used, single pass welds must be used."

## 2. Discrepancies and rulings

All three items from the first issue of this record were ruled on in spec commit 7a6e28e.

- **D1. §J4.2 shear yielding: accepted.** The `wbm` row is now the lesser of shear yielding, Eq. J4-3 (0.60·F_yp·t_p·L_wt, φ = 1.00, Ω = 1.50, new input `Fyp` default 36,000 psi), and shear rupture, Eq. J4-4 (0.60·F_up·t_p·L_wt, φ = 0.75, Ω = 2.00). With no holes A_gv = A_nv, so for A36 yielding governs in both methods: ASD 0.60 × 36/1.50 = 14.4 ksi < 0.60 × 58/2.00 = 17.4 ksi; LRFD 21.6 < 26.1 ksi. Every weld fixture in §3.3 now carries both values.
- **D2. §J2.2b(a) exemption: accepted.** §J2.2b(a) (16.1-127) exempts "fillet weld reinforcements of groove welds" from the Table J2.4 minimum sizes. For `flare`, `wmin` is now an INFO row with no D/C. When note [a] applies it reads "§J2.2b(a): minimum size does not apply to fillet reinforcement of groove welds"; otherwise it reads "no fillet in this configuration". It is excluded from `maxDC`.
- **D3. Page citations:** the spec now matches the text. One residual item: Eq. J4-3 sits at the foot of 16.1-145, while the spec cites both J4-3 and J4-4 on 16.1-146. Separately, the MDG Ex 9.2-1 page in `tools/masonry-audit/build-fixtures.mjs` (9-6; the example is on 9-7) is outside this change.

## 3. Hand calculations against published values

Common quantities: √1750 = 41.833 psi; √2000 = 44.721 psi. Wall t (8 in) = 7.625, (12 in) = 11.625. Center cover = t/2 − d_b/2.

### 3.1 Development and dowel tension

| Fixture | Inputs changed from defaults | d_b, γ, f_y | 0.13·d_b²·f_y·γ (lb) | cover / clear / 9d_b → K | K·√f'm | Eq. 6-2 → l_d | Other | Published | Engine |
|---|---|---|---|---|---|---|---|---|---|
| `rek09-asd` | none | 0.5, 1.0, 60,000 | 0.13 × 0.25 × 60,000 = 1,950 | 3.5625 / 2.5 / 4.5 → **2.5 clear** | 2.5 × 41.833 = 104.58 | 1,950/104.58 = **18.646** | T_all = 2 × 0.2 × 32,000 = **12,800**; tens D/C 5,216/12,800 = 0.408; dev D/C 18.646/24 = **0.777** | T_all 12,800; K 2.5; l_d 18.6 (19-76) | pending Task 2 |
| `rek09-sd` | code sd, T 9,115 | same | 1,950 | same → 2.5 | 104.58 | **18.646** | φT_n = 0.90 × 2 × 0.2 × 60,000 = **21,600**; tens D/C 0.422 | T_u 9,115; φT_n 21,600; l_d 18.6 (19-145) | pending Task 2 |
| `rek10-single` | n 1 | 0.5, 1.0, 60,000 | 1,950 | 3.5625 / — / 4.5 → **3.5625 cover** | 3.5625 × 41.833 = 149.03 | 1,950/149.03 = **13.085** (≥ 12, floor not governing) | T_all = 6,400; tens D/C 0.815 | K 3.57; l_d 13.1 (19-77) | pending Task 2 |
| `min12` | #3, n 1, f'm 2,000, **T 0** | 0.375, 1.0, 60,000 | 0.13 × 0.140625 × 60,000 = 1,096.9 | 3.625 / — / 3.375 → **3.375 9d_b** | 3.375 × 44.721 = 150.93 | 1,096.9/150.93 = **7.267** < 12 → l_d = **12.00**, floor governs | dev D/C 12/24 = 0.500; T = 0, so tension D/C 0.000 | — | pending Task 2 |
| `epoxy` | epoxy on | 0.5, 1.0, 60,000 | 1,950 | → 2.5 | 104.58 | 18.646 × 1.5 = **27.968** | dev D/C 27.968/24 = **1.165 FAIL** | — | pending Task 2 |
| `gamma13` | #6, n 1, L_e 60 | 0.75, **1.3**, 60,000 | 0.13 × 0.5625 × 60,000 × 1.3 = 5,703.75 | 3.4375 / — / 6.75 → **3.4375 cover** | 3.4375 × 41.833 = 143.80 | 5,703.75/143.80 = **39.664** | dev D/C 0.661 | — | pending Task 2 |
| `gamma15` | #8, n 1, 12 in CMU, L_e 90 | 1.0, **1.5**, 60,000 | 0.13 × 1.0 × 60,000 × 1.5 = 11,700 | 5.3125 / — / 9.0 → **5.3125 cover** | 5.3125 × 41.833 = 222.24 | 11,700/222.24 = **52.646** | dev D/C 0.585 | — | pending Task 2 |
| `gr40` | grade 40 | 0.5, 1.0, **40,000** | 0.13 × 0.25 × 40,000 = 1,300 | → 2.5 clear | 104.58 | 1,300/104.58 = **12.430** | T_all = 2 × 0.2 × 20,000 = **8,000**; tens D/C 0.652 | — | pending Task 2 |
| `short-embed` | L_e 16 | as REK-09 | 1,950 | → 2.5 | 104.58 | 18.646 | dev D/C 18.646/16 = **1.165 FAIL**, governs | — | pending Task 2 |
| `nofit` | L_p 3 | — | — | — | — | — | e_p = (3 − 1 × 3)/2 = **0 < d_b 0.5** → validation error naming the plate | — | pending Task 2 |
| `mdg-ex9.2-1` | #5, n 1, f'm 2,000, L_e 24 | 0.625, 1.0, 60,000 | 0.13 × 0.390625 × 60,000 = 3,046.9 | 3.5 / — / 5.625 → **3.5 cover** | 3.5 × 44.721 = 156.52 | 3,046.9/156.52 = **19.466** | dev D/C 0.811 | 19.5 (MDG Ex 9.2-1, 9-7) | pending Task 2 |

Rounding notes:

- MDG writes t = 7.63 in. REK-09 prints cover 3.56 and REK-10 prints 3.57 (both from 7.63/2 − 0.25 = 3.565); the spec uses 7.625 → 3.5625. REK-09 is unaffected (clear spacing governs). REK-10: 1,950/(3.57 × 41.833) = 13.057 vs 13.085 with 3.5625; both print as 13.1.
- Spec §5 records 13.084 for REK-10; the value is 13.0846, which rounds to 13.085. The difference is 0.001 in (0.01 %); the fixture's "≈ 13.08" holds either way.
- All development values agree with the task's required results within 0.01 %: 18.646, 13.085, 12.00, 27.97, 39.66, 52.65, 12.43, 19.47.

### 3.2 Bar-to-plate weld (defaults: w = 1/4, F_EXX 70,000, F_yp 36,000, F_up 58,000, t_p = 1/2, T/n = 5,216/2 = 2,608 lb ASD)

F_nw = 0.60 × 70,000 = 42,000 psi. ASD R_n/2.00; SD 0.75R_n. Table J2.4 thinner part = min(t_p, d_b).

| Fixture | Config | L_wt (in) | t_e (in) | A_we (in²) | R_nw (lb) | Capacity per bar (lb) | T/n (lb) | wmet D/C | w_min, D/C | wdev = cap/TbarCap | Engine |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `weld-fillet-asd` | fillet all around #4 | π × 0.5 = **1.5708** | 0.707 × 0.25 = **0.17675** | 0.17675 × 1.5708 = **0.2776** | 42,000 × 0.2776 = **11,661** | /2.00 = **5,830** | 2,608 | **0.447** | min(0.5, 0.5) = 0.5 → **3/16**, 0.1875/0.25 = 0.75 PASS | 5,830/(0.2 × 32,000 = 6,400) = **0.911 → NO** | pending Task 2 |
| `weld-fillet-sd` | same, SD, T 9,115 | 1.5708 | 0.17675 | 0.2776 | 11,661 | ×0.75 = **8,746** | 4,557.5 | **0.521** | 3/16, 0.75 | 8,746/(0.9 × 0.2 × 60,000 = 10,800) = **0.810 → NO** | pending Task 2 |
| `weld-flare-noteA` | flare, SMAW, #4, L_w 4 | 2 × 4 = **8** | R = 0.25 < 0.375 → note [a]: 0.707 × 0.25 = **0.17675** (5/16 R = 0.078 not used) | 0.17675 × 8 = **1.414** | 42,000 × 1.414 = **59,388** | /2.00 = **29,694** | 2,608 | 0.088 | INFO, no D/C: "§J2.2b(a): minimum size does not apply to fillet reinforcement of groove welds" (Table J2.4 would give 3/16) | 29,694/6,400 = 4.640 → YES | pending Task 2 |
| `weld-flare-gmaw` | flare, GMAW, #6, n 1, L_w 4 | 8 | R = 0.375, not < 3/8 → 5/8 × 0.375 = **0.234375** | 0.234375 × 8 = **1.875** | 42,000 × 1.875 = **78,750** | /2.00 = **39,375** | 5,216 | 5,216/39,375 = **0.132** | INFO, no D/C: "no fillet in this configuration" | 39,375/(0.44 × 32,000 = 14,080) = 2.797 → YES | pending Task 2 |
| `weld-flare-smaw6` | flare, SMAW, #6, n 1, L_w 4 | 8 | 5/16 × 0.375 = **0.1171875** | 0.9375 | 42,000 × 0.9375 = **39,375** | /2.00 = **19,687.5** | 5,216 | 0.265 | INFO, no D/C: "no fillet in this configuration" | 19,687.5/14,080 = 1.398 → YES | pending Task 2 |
| `weld-thin-plate` | fillet, t_p 3/16, w 1/8 | 1.5708 | 0.707 × 0.125 = 0.088375 | 0.13882 | 5,830 | /2.00 = **2,915** | 2,608 | **0.895** | min(0.1875, 0.5) = 0.1875 ≤ 1/4 → **1/8**, 0.125/0.125 = **1.000 PASS** | 2,915/6,400 = 0.456 → NO | pending Task 2 |
| `weld-undersize` | fillet, t_p 1/2, w 1/8 | 1.5708 | 0.088375 | 0.13882 | 5,830 | 2,915 | 2,608 | 0.895 | 0.5 → **3/16**, 0.1875/0.125 = **1.500 FAIL**, governs | 0.456 → NO | pending Task 2 |
| `flare-default` | flare, SMAW, #4, L_w 3 (the default) | 2 × 3 = **6** | note [a]: 0.707 × 0.25 = **0.17675** | 0.17675 × 6 = **1.0605** | 0.60 × 70,000 × 0.17675 × 6 = **44,541** | /2.00 = **22,270.5** | 2,608 | 2,608/22,270.5 = **0.117** | INFO (§J2.2b(a)) | 22,270.5/6,400 = 3.480 → YES | PASS |
| `flare-leg-interior` | flare, SMAW, #4, n 3, s 2.5, L_p 12, L_w 3 | 2 × 3 = **6** | **0.17675** | **1.0605** | **44,541** | **22,270.5** | 5,216/3 = 1,738.7 | 1,738.7/22,270.5 = **0.078** | INFO (§J2.2b(a)) | 3.480 → YES | PASS |
| `flare-single-long` | flare, SMAW, #4, n 1, L_w 6 | 2 × 6 = **12** | **0.17675** | 0.17675 × 12 = **2.121** | 42,000 × 2.121 = **89,082** | /2.00 = **44,541** | 5,216 | 5,216/44,541 = **0.117** | INFO (§J2.2b(a)) | 44,541/6,400 = 6.960 → YES | PASS |

### 3.3 Plate base metal at the weld (spec `wbm`, lesser of Eq. J4-3 and Eq. J4-4)

A = t_p × L_wt. Yielding R_nBMy = 0.60 × 36,000 × A (ASD /1.50, SD ×1.00). Rupture R_nBMr = 0.60 × 58,000 × A (ASD /2.00, SD ×0.75). Yielding governs every fixture (`bmGov = 'yield'`).

| Fixture | A (in²) | R_nBMy (lb) | Yield cap. (lb) | R_nBMr (lb) | Rupture cap. (lb) | Governing cap. (lb) | T/n (lb) | wbm D/C | Engine |
|---|---|---|---|---|---|---|---|---|---|
| `weld-fillet-asd` (ASD) | 0.5 × 1.5708 = 0.7854 | 21,600 × 0.7854 = **16,965** | /1.50 = **11,310** | 34,800 × 0.7854 = 27,332 | /2.00 = 13,666 | **11,310** yield | 2,608 | **0.231** | pending Task 2 |
| `weld-fillet-sd` (SD) | 0.7854 | 16,965 | ×1.00 = **16,965** | 27,332 | ×0.75 = 20,499 | **16,965** yield | 4,557.5 | **0.269** | pending Task 2 |
| `weld-flare-noteA` (ASD) | 0.5 × 8 = 4.0 | 86,400 | 57,600 | 139,200 | 69,600 | **57,600** yield | 2,608 | 0.045 | pending Task 2 |
| `weld-flare-gmaw` / `weld-flare-smaw6` (ASD) | 4.0 | 86,400 | 57,600 | 139,200 | 69,600 | **57,600** yield | 5,216 | 0.091 | pending Task 2 |
| `weld-thin-plate` (ASD) | 0.1875 × 1.5708 = 0.2945 | 6,362 | 4,241 | 10,249 | 5,125 | **4,241** yield | 2,608 | 0.615 | pending Task 2 |
| `weld-undersize` (ASD) | 0.7854 | 16,965 | 11,310 | 27,332 | 13,666 | **11,310** yield | 2,608 | 0.231 | pending Task 2 |
| `flare-default` (ASD) | 0.5 × 6 = 3.0 | 21,600 × 3.0 = **64,800** | /1.50 = **43,200** | 34,800 × 3.0 = 104,400 | /2.00 = 52,200 | **43,200** yield | 2,608 | **0.060** | PASS |
| `flare-leg-interior` (ASD) | 3.0 | 64,800 | 43,200 | 104,400 | 52,200 | **43,200** yield | 1,738.7 | **0.040** | PASS |
| `flare-single-long` (ASD) | 0.5 × 12 = 6.0 | 129,600 | 86,400 | 208,800 | 104,400 | **86,400** yield | 5,216 | **0.060** | PASS |

### 3.4 Placement rows and banner for every fixture (for the Task 2 harness)

`spc`: max(d_b, 1)/clear = 1/2.5 = 0.400 for every n = 2 case; N/A for n = 1. `grt`: cap = (t − 2t_fs)/3; 8 in: (7.625 − 2.5)/3 = 1.708 in; 12 in: (11.625 − 2.5)/3 = 3.042 in. `fit`: e_p = 3.5 (n = 2) or 5.0 (n = 1) ≥ 1.5d_b in every fixture, so INFO. `wbm` is the yield-governed D/C from §3.3 (ASD T/n/11,310 or SD T/n/16,965 per #4 fillet). Banner = FAIL if any of `tens, dev, spc, grt, wmet, wbm` > 1.0, or `wmin` > 1.0 for `fillet`; for `flare`, `wmin` is INFO and not in `maxDC`.

| Fixture | tens | dev | spc | grt | wmet | wbm | wmin | Max D/C, governing | Banner |
|---|---|---|---|---|---|---|---|---|---|
| `rek09-asd` | 0.408 | 0.777 | 0.400 | 0.293 | 0.447 | 0.231 | 0.750 | 0.777 `dev` | PASS |
| `rek09-sd` | 0.422 | 0.777 | 0.400 | 0.293 | 0.521 | 0.269 | 0.750 | 0.777 `dev` | PASS |
| `rek10-single` | 0.815 | 0.545 | N/A | 0.293 | 0.895 | 0.461 | 0.750 | 0.895 `wmet` | PASS |
| `min12` (T = 0) | 0.000 | 0.500 | N/A | 0.220 | 0.000 | 0.000 | 0.750 | 0.750 `wmin` | PASS (wdev 4,373/3,520 = 1.242, YES) |
| `epoxy` | 0.408 | **1.165** | 0.400 | 0.293 | 0.447 | 0.231 | 0.750 | 1.165 `dev` | FAIL |
| `gamma13` | 0.370 | 0.661 | N/A | 0.439 | 0.596 | 0.307 | 0.750 | 0.750 `wmin` | PASS |
| `gamma15` | 0.206 | 0.585 | N/A | 0.329 | 0.447 | 0.231 | 0.750 | 0.750 `wmin` | PASS |
| `gr40` | 0.652 | 0.518 | 0.400 | 0.293 | 0.447 | 0.231 | 0.750 | 0.750 `wmin` | PASS (wdev 5,830/4,000 = 1.458, YES) |
| `short-embed` | 0.408 | **1.165** | 0.400 | 0.293 | 0.447 | 0.231 | 0.750 | 1.165 `dev` | FAIL |
| `nofit` | — | — | — | — | — | — | — | — | validation error |
| `mdg-ex9.2-1` | 0.526 | 0.811 | N/A | 0.366 | 0.716 | 0.369 | 0.750 | 0.811 `dev` | PASS |
| `weld-fillet-asd` | as `rek09-asd` | | | | | | | 0.777 `dev` | PASS |
| `weld-fillet-sd` | as `rek09-sd` | | | | | | | 0.777 `dev` | PASS |
| `weld-flare-noteA` | 0.408 | 0.777 | 0.400 | 0.293 | 0.088 | 0.045 | INFO (§J2.2b(a)) | 0.777 `dev` | PASS |
| `weld-flare-gmaw` | 0.370 | 0.661 | N/A | 0.439 | 0.132 | 0.091 | INFO (no fillet) | 0.661 `dev` | PASS |
| `weld-flare-smaw6` | 0.370 | 0.661 | N/A | 0.439 | 0.265 | 0.091 | INFO (no fillet) | 0.661 `dev` | PASS |
| `weld-thin-plate` | 0.408 | 0.777 | 0.400 | 0.293 | 0.895 | 0.615 | 1.000 | 1.000 `wmin` | PASS |
| `weld-undersize` | 0.408 | 0.777 | 0.400 | 0.293 | 0.895 | 0.231 | **1.500** | 1.500 `wmin` | FAIL |
| `flare-default` | 0.408 | 0.777 | 0.400 | 0.293 | 0.117 | 0.060 | INFO (§J2.2b(a)) | 0.777 `dev` | PASS |
| `flare-leg-interior` | 5,216/(3 × 0.2 × 32,000 = 19,200) = **0.272** | clear = 2.5 − 0.5 = 2.0; K = min(3.5625, 2.0, 4.5) = **2.0 clear**; l_d = 1,950/(2.0 × 41.833) = **23.307**; 23.307/24 = **0.971** | 1/2.0 = **0.500** | 0.293 | 0.078 | 0.040 | INFO (§J2.2b(a)) | 0.971 `dev` | PASS |
| `flare-single-long` | 0.815 | 13.085/24 = 0.545 | N/A | 0.293 | 0.117 | 0.060 | INFO (§J2.2b(a)) | 0.815 `tens` | PASS |

### 3.5 Flare-leg warnings (spec §4.3; the leg lies along L_p toward the nearer plate end)

e_p = (L_p − (n − 1)·s)/2. The overhang check (L_w > e_p) runs for n ≥ 2 only; the interior check (L_w > s) for n ≥ 3 only.

| Fixture | e_p (in) | 2L_w vs L_p | L_w vs e_p | L_w vs s | Warnings |
|---|---|---|---|---|---|
| `flare-default` | (10 − 3)/2 = 3.5 | 6 < 10 | 3 ≤ 3.5 | n = 2, not checked | **0** |
| `flare-leg-overhang` | 3.5 | 8 < 10 | **4 > 3.5**, overhang | n = 2, not checked | **1** |
| `flare-long` | 3.5 | **12 > 10** | **6 > 3.5**, overhang | n = 2, not checked | **2** |
| `flare-single-long` | (10 − 0)/2 = 5 | **12 > 10** | 6 > 5, suppressed (n = 1) | n = 1, not checked | **1** |
| `flare-leg-interior` | (12 − 2 × 2.5)/2 = 3.5 | 6 < 12 | 3 ≤ 3.5 | **3 > 2.5**, interior | **1** |

## 4. Other observations (not discrepancies)

- **O1. φ for the dowels.** Table 9.1.4 is the φ table for reinforced members in flexure and axial load. §9.1.4.1(a) (PDF p. 156, C-138) gives φ = 0.75 for anchor-bolt steel in tension. The dowels are deformed bars developed by bond, not anchor bolts, and MDG REK-09 SD uses 0.90, so the spec follows the MDG.
- **O2. K uses the dowel clear spacing.** The code phrase is "clear perpendicular spacing between adjacent reinforcement splices". Both MDG versions use the dowel clear spacing (3 − 0.5 = 2.5 in); the SD text justifies it because each dowel is spliced to a wall vertical. Spec §4.1 matches the MDG.
- **O3. Fillet length around the bar.** §J2.2a (16.1-127) is written for fillet welds in holes and slots: the effective length is taken along the centerline of the throat plane, which lies outside the bar surface. Applying it to a fillet around a bar butted to the plate face is an analogy; either way L = π·d_b, measured at the bar surface, is conservative.
- **O4. Flare weld load direction.** The spec uses the Table J2.5 shear row (φ 0.75, Ω 2.00). If a bent dowel loads the flare weld in tension normal to its axis, the PJP tension-normal row applies (φ 0.80, Ω 1.88, same 0.60F_EXX). The spec value is the lower of the two either way.
- **O5. §J2.2b(c) minimum fillet length 4w.** π × 0.5 = 1.571 in ≥ 4 × 0.25 = 1.0 in; the #3 all-around fillet (1.178 in) also passes. Not a spec check; noted only.
- **O6. §6.1.3.2.3, d_b ≤ 1/8 of the least nominal member thickness** (PDF p. 89) is not a spec check. 8 in wall → d_b ≤ 1.0 in; every fixture complies (`gamma15`, #8 in a 12 in wall: 1.0 ≤ 1.5). §6.1.3.2.4 (one-third of the grout space) and §6.1.4.1 (clear ≥ d_b and ≥ 1 in) are as the spec states.
- **O7. MDG detail.** The REK-09 figure shows straight bars butted to the plate underside with no weld shown. The `fillet` configuration matches it. The `flare` configuration is an ARE addition.

## 5. Items left to the engineer

- Welding procedure, qualification, preheat and inspection per AWS D1.4/D1.4M are the fabricator's. The calc checks AISC 360-22 §J2 strength only. AWS D1.4 has its own flare-groove effective weld sizes for bars. That document is not in the library, so the Table J2.2 throats used here have not been compared with it.
- k_ds is taken as 1.0 on the all-around fillet. Eq. J2-5 would give up to 1.5 for the transverse load. This is conservative and deliberate.
- The weld does not develop the dowel at the default (ASD 5,830 < 6,400 lb; SD 8,746 < 10,800 lb, `wdev` NO) with a 1/4 fillet all around a #4 bar. For full development, increase w or use the flare detail on a #6 or larger bar.
- Plate F_yp and F_up for plates other than A36: the `wbm` row uses the values as entered.
- Vertical reinforcement in the adjacent cell(s), lapped to the dowels, carries T to the foundation (MDG REK-09 §5, REK-10). Size the lap with `masonry-lap-length`.
- Beam bearing on the plate, masonry bearing, anchor and dowel shear: `embed-plate-beam-bearing` / `masonry-bearing-uplift`.
- Plate flexure between dowels and at the plate ends is not checked.
- Headed studs or anchor bolts in place of dowels: `masonry-anchor-bolt`.
- There is no reduction of l_d for excess reinforcement: TMS 402-22 has none, and the design intent is full development.

## 6. How to run the tests

- `npm run test:mdep`: headless Chromium runs `MDEP.runFixtures()` (every row in §3), then the UI wiring, code toggle, weld config, Mark and selftest checks.
- Open `/Calcs/masonry_dowelled_embed_plate_calculator.html?selftest=1`. The fixture report prints on the page and the tab title reads `SELFTEST PASS n/n`.
- `npm run qa` chains `test:mdep` with the rest of the suite.

## 7. Notes for Task 2

- D1–D3 are resolved in spec commit 7a6e28e (§2). Implement `RnBMy`, `RnBMr`, `Rcap_bm` = the lesser, and `bmGov`; for `flare`, set `wminApplies` false and make `wmin` INFO.
- `min12` runs at T = 0. It isolates the 12 in floor, and its banner is PASS: the tension and weld D/C rows read 0.000, and `wmin` (0.750) is the largest D/C.
