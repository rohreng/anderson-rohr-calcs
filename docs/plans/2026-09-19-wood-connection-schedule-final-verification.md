# Wood Connection Schedule — final engineering verification (shipped code vs NDS 2018)

_Fable, 2026-09-19. Independent, read-only verification of `public/Calcs/engines/wood-connections.js` (rev `2026-09-19 v1`, 1283 lines) and `public/Calcs/wood_connection_schedule_calculator.html` against `AWC_NDS2018-withCommentary_20210917.pdf` (page cites are **printed (PDF)**; printed = PDF − 14) and `AWC_NDS2018-Supplement_20210917.pdf` (PDF pages). Every number below was read from the PDF text extraction (`nds.txt`) or the PDF pages themselves, not from memory. Prior plan cross-check: `docs/plans/2026-09-19-wood-connection-schedule-nds-crosscheck.md`. Spec: `docs/superpowers/specs/2026-09-19-wood-connection-schedule-spec.md`._

Runs performed: `npm run test:wc` → **277 pass / 0 fail**; `node tools/_wc-ui-smoke.mjs` → **ALL PASS** (exit 0); a scripted Playwright session entering Nick's spreadsheet case through the page DOM (details below); a script reproducing **all 473 cells of Table 12.3.3** with `WC._fe` (0 mismatches); every Z-table, withdrawal-table, pull-through-table and C_g-table cell the fixtures assert was located in the PDF text and matched (§ Verified items).

---

## 1. Summary verdict — **SHIP**

The engine implements NDS 2018 Chapters 11–12 for bolts, lag screws, wood screws and nails as the code text reads. Every constant in `WC.DATA` matches its table; the yield-limit equations, R_d, F_e (incl. the 50 psi rounding), the length/penetration rules, withdrawal, pull-through, the Table 11.3.1 factor chains, C_M/C_t/C_D, C_g (Eq. 11.3-1 + Tables 11.3.6A/C), C_Δ (§12.5.1 ratio rule with the hard floors), C_eg/C_di/C_tn and the §12.4 combined-load equations are coded as written and reproduce the tabulated values. The page shows the intermediate values an engineer needs to check a row by hand, prints every details block, and round-trips through the adapter.

Six low-severity items are listed below. None changes a governing capacity in a normal case; none is unconservative by more than a threshold effect. They are follow-ups, not blockers. Items 1 and 3 are the two worth patching before wide use (a spec/code contradiction and a wording mismatch in the l/D input).

---

## 2. Discrepancies

| # | Sev | Item | NDS text | Code | What to change |
|---|---|---|---|---|---|
| 1 | Low (doc ≠ code) | **`cmException` for D < 1/4** | Table 11.3.3 fn 2 (p.67/81): "C_M = 0.7 for dowel-type fasteners with D < 1/4"." then "C_M = 1.0 for dowel-type fastener connections with: 1) one fastener only, or 2) … single row parallel to grain, or 3) … separate splice plates". The 1.0 clause has no diameter restriction; which clause governs a single wet-fabricated nail is not stated. | Spec §11 says the exception "takes precedence over the D < 1/4 → 0.7 rule". Engine line 399 does the opposite: `if (!geomActive) I.cmException = false;` and fixtures (lines 1129–1130) lock in 0.7. The page hides the checkbox for D < 1/4 (HTML line 709, inside `if(big)`). | Code is the conservative reading and is internally consistent (UI + engine + fixtures). Amend spec §11 to match the code (0.7 governs for D < 1/4), or, if Nick wants the 1.0 reading, change line 399 and expose the checkbox for nails/wood screws. Do not leave the contract contradicting the build. |
| 2 | Low (interpretation) | **C_g single-row width for a ⊥-loaded member = 4D** | §11.3.6.3 (p.68/82): "Where only one row of fasteners is used, the width of the fastener group shall be the minimum parallel to grain spacing of the fasteners." Commentary C11.3.6 (p.251–252 / 265–266) adds nothing numeric. The literal "minimum spacing" in Table 12.5.1B is **3D**; the C_Δ = 1.0 value is 4D; for a ⊥-loaded member the parallel-to-grain spacing is the Table 12.5.1D row spacing (2.5D–5D). | Lines 609, 620–621: `rows >= 2 ? (rows − 1)·g : 4·D`. | Quantified with `WC._groupAction` (1.5 in main, 1.5 × 5.5 side, s = 4D): n = 2–3 (all the §12.5.1.3 5 in spread rule allows in a ⊥ row without shrinkage detailing): 4D vs 3D differs < 1.5 %; n = 8, D = 1 in: 0.647 vs 0.561. Either adopt 3D (the literal "minimum spacing") or keep 4D and state the reading in the cite string. Not blocking. |
| 3 | Low | **l/D for Tables 12.5.1C/D uses the bearing length, not the fastener length** | Table 12.5.1C fn 1 / 12.5.1D fn 1 (p.91/105): "(a) length of fastener in wood main member/D = l_m/D; (b) total length of fastener in wood side member(s)/D". | Line 532 `cands.push(Lg.l_m)` where `l_m = p_tot − tip_in/2` (§12.3.5.3 bearing length). Identical for bolts (l_m = t_m) and for any fastener whose tip is outside the main; differs by E/2 (≤ 11/32 in for a 1 in lag) when the tip is inside the main. | Push `Lg.p_tot` for non-bolts. A smaller l/D can only move the edge-distance rule from "max(1.5D, g/2)" back to 1.5D at l/D = 6, or lower the ⊥ row-spacing minimum below l/D = 2 / 6 — unconservative direction, threshold-only effect. |
| 4 | Low (UI label) | **Details block labels p_t "(threads in main)" for nails** | §12.2.3.1(c) (p.77/91): nail withdrawal uses "length of fastener penetration, p_t" — nails have no thread length; the engine correctly sets `T_thread = null` and `p_t = p_tot`. | HTML line 773 label string. | Label "p_t (withdrawal penetration in main)" or switch the wording by type. Cosmetic. |
| 5 | Low | **Table 12.2F range not enforced for pull-through** | §12.2.5.1 (p.78/92): W_H "within the range of fastener head diameters, D_H, and net side member thicknesses, t_ns, given in Table 12.2F" — t_ns 5/16 … 1-1/2, D_H 0.234 … 0.500 (p.82/96). | `pullThrough()` (lines 220–223) evaluates Eq. 12.2-6a/b for any t_s. Every offered head is inside 0.250–0.480. Eq. 12.2-6b is constant above 2.5 D_H, so t_s > 1.5 is harmless; t_s < 5/16 extrapolates 6a linearly. | Add a warning when a wood side member is thinner than 5/16 in and T > 0. Also note (Commentary C12.2.5.1, p.259/273): t_ns is measured from the bottom of a counter-bored hole — the engine uses full t_s (flush heads). |
| 6 | Low (edge case) | **∥ edge-distance minimum uses g/2 with rows = 1** | Table 12.5.1C (p.91/105): l/D > 6 → "1.5D or ½ the spacing between rows, whichever is greater". With one row there is no row spacing. | Line 564 `Math.max(1.5·D, g/2)` regardless of `rows`. Defaults keep g = 1.5D so the default result is 1.5D; a user-typed large g with rows = 1 inflates the hard minimum and can throw `geom_edge`. | Use `rows >= 2 ? Math.max(1.5D, g/2) : 1.5D`. Conservative as is. |

Not discrepancies (checked and accepted):
- **K_θ = 1.25 for an end-grain main member** (spec §11, line 496). Table 12.3.1B (p.84/98) defines θ as "maximum angle between the direction of load and the direction of grain … for any member"; a lateral load on a dowel whose axis is parallel to the grain is 90° to that member's grain. Literal and conservative on top of F_e⊥ (§12.3.3.4) and C_eg = 0.67 (§12.5.2.2). Recorded in `cites`.
- **No p/8D–p/10D scaling** in the engine. Tables 12J/12K fn 3, 12L/12M fn 3, 12N/12P fn 3 (PDF 120, 123, 125): "…tabulated lateral design values, Z, shall be multiplied by p/8D [p/10D] **or lateral design values shall be calculated using the provisions of 12.3 for the reduced penetration**." §12.3.1 (p.83/97) only requires p ≥ p_min. The engine takes the second branch with actual l_m, and reproduces every 12J/12L/12N cell at p = 8D / 10D (fixtures lines 873–961; cells located in the PDF text, § 3 below).
- **Combined load uses W_cap = min(W′p_t, W′_H) in Eq. 12.4-1/-2** rather than W′p alone (lines 660, 687). Conservative extension; the NDS equations predate the pull-through clause.

---

## 3. Verified items

| Item | Clause / table (printed/PDF) | Code | Result |
|---|---|---|---|
| Species G: DFL 0.50, DFS 0.46, HF 0.43, SPF 0.42, SPFS 0.36, SP 0.55; all softwood | Table 12.3.3A 87/101 | lines 66–73 | VERIFIED |
| Species E (No. 2): DFL 1.6M, DFS 1.2M, HF 1.3M, SPF 1.4M (No.1/No.2), SPFS 1.1M, SP 1.4M | Supplement Table 4A PDF 42–45, Table 4B PDF 48 (read as images) | lines 66–73 | VERIFIED |
| Steel F_e 87,000 (A36, t ≥ 1/4) / 61,850 (A653 Gr 33, gauge); E_steel 30,000,000 | Table 12B/12K fn 2; 12M/12P fn 2; App. I.2 173/187; Table 11.3.6C header 71/85 | lines 75–79, 434–447 | VERIFIED |
| Gauges 20→0.036 … 3→0.239 | Table 12P 112/126 (and 12K/12M) | line 80 | VERIFIED |
| Nail D, L, H — common 6d–20d, box 6d–20d, sinker 7d–20d; tip E = 2D; sinker 6d excluded (0.092 < 0.099 band) | Table L4 182/196 (all H read directly: box 8d 0.297, 20d 0.375; sinker 7d 0.250, 8d 0.266, 10d 0.281, 12d 0.312, 16d 0.344, 20d 0.375) | lines 82–89 | VERIFIED |
| Wood screws No. 6–14 D, D_r, D_H; T = max(4D, 2L/3); E = 2D | Table L3 182/196 fn 2/3/6 | lines 91–95, 373 | VERIFIED |
| Lags D_r, E for 1/4–1; T by L (14 lengths); fn 2 T = min(6, L/2 + 1/2); availability by L | Table L2 181/195 | lines 97–105, 383–388 | VERIFIED |
| Bolts 1/2–1, full body, D used throughout | Table L1 180/194; §12.3.7.1(b) 85/99 | lines 106, 349 | VERIFIED |
| F_yb bands (nails/wood screws by nominal D; lags 1/4 70k, 5/16 60k, ≥ 3/8 45k; bolts 45k) | Table I1 175/189; Z-table fn 2 | lines 109–111 | VERIFIED |
| C_D 0.9/1.0/1.15/1.25/1.6; ≤ 1.6 for connections | Table 2.3.2 11/25 fn 2; §11.3.2 66/80 | line 112 | VERIFIED ("Lr" is labelled roof live/construction — Table 2.3.2 lists "Construction Load" for seven days) |
| C_M lateral: (dry,dry) 1.0; (wet,dry) 0.4 → 0.7 for D < 1/4, 1.0 with fn 2 exception; (·,wet) 0.7. Withdrawal lag/wood screw: service wet 0.7. Nails: same/same 1.0, mixed 0.25. Pull-through: service wet 0.7. Toe-nail withdrawal C_M = 1.0 | Table 11.3.3 67/81 + fn 2; Table 11.3.1 fn 2; §12.5.4.1 91/105 | lines 133–153 | VERIFIED (see D1 for the D < 1/4 + exception case) |
| C_t 1.0 / 0.8, 0.7 / 0.7, 0.5 by in-service moisture | Table 11.3.4 67/81 | line 114 | VERIFIED |
| F_e: D < 1/4 16600 G^1.84; ∥ 11200 G; ⊥ 6100 G^1.45/√D; rounded to nearest 50 psi | Table 12.3.3 86/100 fn 2 | lines 157–160 | VERIFIED — all 473 table cells reproduced exactly |
| §12.3.3.4 end grain, D ≥ 1/4 → F_e⊥ for F_em | 84/98 | line 492 | VERIFIED |
| SCL: typed F_e (custom species) | §12.3.3.3 84/98 | lines 414–422 | VERIFIED |
| Yield equations 12.3-1…-10, k1/k2/k3, R_e, R_t | Table 12.3.1A 83/97 | lines 166–194 | VERIFIED (12A/12B/12F/12G/12J/12K/12L/12M/12N/12P cells reproduced) |
| R_d: 4K_θ/3.6K_θ/3.2K_θ for 0.25 ≤ D ≤ 1; K_D all modes for D < 0.25; fn 1 nominal ≥ 0.25 with D_r < 0.25 → K_D·K_θ; K_θ = 1 + 0.25(θ/90); K_D = 2.2 (D ≤ 0.17), 10D + 0.5 | Table 12.3.1B 84/98 | lines 161–162, 591–594 | VERIFIED |
| D vs D_r: nails and bolts D; lags and wood screws D_r in Tables 12.3.1A/B (incl. K_D); nominal D everywhere else | §12.3.7.1 85/99; App. I.5 175/189 | lines 360, 373, 382 | VERIFIED |
| D ≤ 1 in cap | Tables 12.3.1B/12.3.3; §11.3.6.1 | line 394 | VERIFIED |
| Lengths: p_min lag 4D excl. tip; wood screw / nail 6D incl. tip | §12.1.4.6 74/88; §12.1.5.6, §12.1.6.4 75/89 | lines 518–521 | VERIFIED |
| l_m ≤ p − E/2 (E from L2 for lags, 2D otherwise); interval intersection (side [0,t_s], main [t_s,t_s+t_m], tip [L−E,L], threads lag [L−T, L−E] / wood screw [L−T, L] / nail [0, L]) | §12.3.5.3 85/99 | lines 502–523 | VERIFIED (Codex 1/4 × 6 lag case p_t = 0.5; tip-partly-outside case; nail exiting main) |
| Withdrawal p_t: lag thread penetration excl. tip; wood screw thread penetration (no tip exclusion stated); nail fastener penetration | §12.2.1.2, §12.2.2.2 76/90; §12.2.3.1(c) 77/91 | line 515–516 | VERIFIED |
| Toe-nail: l_s = min(t_s, L/3); l_m = L cos30° − L/3 (capped at t_m); p_t = actual nail length in the member = L − L/(3 cos30°) (capped at t_m/cos30°); p_min on p_t | §12.1.6.3 75/89; §12.3.10.2 88/102; Comm. C12.5.4.1/.2 Eq. C12.5.4-1/-2, Fig. C12.5.4-1 266/280 | lines 505–511 | VERIFIED (geometry is self-consistent: vertical projection of 0.615 L = L cos30° − L/3) |
| W: lag 1800 G^1.5 D^0.75; wood screw 2850 G² D; nail 1380 G^2.5 D; bolts none | Eq. 12.2-1/-2/-3 76–77/90–91; §12.2.4 | lines 214–219, 355 | VERIFIED (12.2A: 225, 235; 12.2B: 135, 82; 12.2C: 32, 26 located on 77–79/91–93) |
| End grain withdrawal: lag C_eg 0.75; wood screw / nail prohibited (C_eg 0) | §12.2.1.3, §12.2.2.3, §12.2.3.3; §12.5.2.1 | lines 588, 628 | VERIFIED |
| Pull-through Eq. 12.2-6a/b; G = side member; Table 12.2F 40/132/239/127 | §12.2.5.1 78–82/92–96 | lines 220–223, 656–660 | VERIFIED |
| Z′ and W′ chains; W′_H = W_H C_D C_M C_t | Table 11.3.1 66/80 | lines 647, 652, 658 | VERIFIED |
| C_g Eq. 11.3-1, γ 180,000/270,000 D^1.5, R_EA, u, m; n = 1 → 1.0; D < 1/4 → 1.0; A_s = Σ side areas (double shear ×2); gross areas; ⊥ member t × group width | §11.3.6.1–.3 68/82; Tables 11.3.6A (0.96, 0.55, 0.88) / 11.3.6C (0.62, 0.51) 70–71/84–85 | lines 197–211, 607–622 | VERIFIED (single-row width: D2) |
| C_Δ: D < 1/4 → 1.0; ratio = actual / (min for C_Δ = 1.0) for end distance and in-row spacing; floors (Table 12.5.1A C_Δ = 0.5 column; 3D spacing) are hard fails; smallest applies to the group; Table 12.5.1A softwood/hardwood 3.5D/7D, 2.5D/5D, ⊥ and compression 2D/4D; 12.5.1B 3D/4D; 12.5.1C edge 1.5D / max(1.5D, g/2) / loaded 4D / unloaded 1.5D; 12.5.1D 1.5D / 2.5D, (5l+10D)/8, 5D; 5 in across-grain limit; 12.5.1E for withdrawal-only lags | §12.5.1.1–.3 89–90/103–104; Tables 12.5.1A–E 90–91/104–105; Comm. C12.5.1.2 (end < 50 % and spacing < 75 % "not allowed") 263/277 | lines 539–585 | VERIFIED (l/D source: D3; g/2 with rows = 1: D6) |
| C_eg 0.67 lateral (all dowel types), C_di 1.1 (nails), C_tn 0.83 / 0.67 | §12.5.2.2, §12.5.3, §12.5.4 91/105 | lines 115–116, 627–630 | VERIFIED |
| Combined: Eq. 12.4-1 (cos², sin²) lags/wood screws; Eq. 12.4-2 (cos, sin) nails; α = angle between wood surface and load = atan2(T, V) | §12.4.1/.2 89/103 | lines 225–230, 687 | VERIFIED |
| Spec §11: end-grain K_θ = 90°; non-listed lag L → T = min(6, L/2 + 1/2) with warning; `main.species` null inherits; withdrawal-only lag skips the 5 in rule; invalid/incomplete carry no unresolved count | — | lines 496, 387, 540–573, 485–486 | VERIFIED (cmException precedence: D1) |
| Preconditions §12.3.1(a)–(d) printed as a note; bolt hole/washer, lead-hole, bored-hole, §12.3.7.2, root-area tension, AISC plate notes | §12.3.1 83/97; §12.1.3–.6; §12.2.1.4/.2.5; §11.2.3 | lines 476–487, 662–669 | VERIFIED |

Fixture cells located in the PDF text (all match the fixture constants): 12A p108 blocks 1-1/2/1-1/2 (480 300 300 220; 720 420 420 270; 970 530 530 310), 3-1/2/1-1/2 (1200 590 610 510), 3-1/2/3-1/2 (2260 1230 1230 720); 12A p109 G 0.42 (410 240 240 170); 12B p110 (580/310, 870, 2270); 12F p114 (1050 730 470; 2400 … 1370); 12G p116 (1050/470; 3340/1370); 12J p120 (120 90 90 80; 150 100 110 90; 390 220 270 200); 12K p122 (1/4 A36 1/2 lag 520/320; 10 ga 3/8 lag 220/140); 12L p123 (90, 73, 120, 117, 91); 12M p124 (116, 103); 12N p125 (72 90 105 121; 72 97 118 141; box 72/94; sinker 80/81; 16d G 0.42 t_s 1-1/2 120); 12P p126–127 (138, 117); 12.2A–C; 12.2F; 11.3.6A/C.

---

## 4. Spreadsheet case reconciliation

Spreadsheet `_ NDS_11.3.1_Lateral_design_values_Z.xlsx`, sheet "NDS 11.3.1 Lateral Design (Z)" (formulas read with openpyxl): nail, D = 0.162, not threaded (D_r := D), F_yb 90,000 (band 0.142–0.177), l_m = 2.0 (typed), l_s = 1.5, G_m = G_s = 0.42, θ_m = 0, θ_s = 90, F_e = 16600·0.42^1.84 = **3364.24 unrounded**, R_d = 2.2 all modes (its formula correctly ignores K_θ for D_r ≤ 0.17), R_e = 1, R_t = 1.333, k1 0.4916, k2 1.0859, k3 1.1504 → modes I_m 495.5, I_s 371.6, II 182.7, III_m 179.3, III_s 142.5, **IV 119.84** → Z = 119.84 (mode IV).

The "Adjustment Factors" sheet cell F20 = **127** is a typed constant, not linked to the Z sheet (the live Z is 119.84); I20 = Z′ = 1.6 × 127 × C_M 1 × **C_t 0.7** × C_g 1 × C_Δ 1 × C_eg 1 × C_di 1 × **C_tn 0.83** = **118.06**. So the 127/118 pair is stale and carries a temperature factor and a toe-nail factor that were typed into that sheet.

Engine, same case through the page (header SPF; 16d common; main θ 0, t 1.5; side θ 90, t 1.5; load case WE; dry/dry; T100):

| Quantity | Spreadsheet | Engine | Why different |
|---|---|---|---|
| F_em = F_es | 3364.24 | **3350** | Table 12.3.3 fn 2 rounds to the nearest 50 psi (table cell G 0.42, D < 1/4 = 3350) |
| l_m | 2.0 (typed) | **1.5** | The engine derives l_m from L = 3.5, t_s = 1.5 and t_m = 1.5: the nail exits a 2x main (warning shown), so p_tot = 1.5 and the tip is outside the main (tip_in = 0, l_m = p_tot). l_m = 2.0 would need a main ≥ 2.0 in thick (then l_m = 2.0 − 0.162 = 1.838 by §12.3.5.3, not 2.0) |
| K_θ | 1.25 (computed, unused) | 1.25 (computed, unused) | R_d = K_D = 2.2 for D < 0.25 (Table 12.3.1B) — both agree |
| Governing mode | IV | IV | Mode IV has no l_m term, so the l_m difference does not change Z |
| Z | 119.84 | **119.59** | Entirely the F_e rounding: 119.84 × √(3350/3364.24) = 119.59 |
| Z′ (C_D 1.6, all else 1.0) | 191.7 (= 1.6 × 119.84) | **191.3** | same |
| Z′ as the sheet shows | 118.06 | — | stale Z = 127 with C_t 0.7 and C_tn 0.83 typed into the factor sheet |

Non-governing modes with the engine's F_e and l_m = 2.0 (checked with `WC._yield`): I_m 493.4, II 181.9, III_m 178.6, III_s 141.96 — the spreadsheet's 495.5 / 182.7 / 179.3 / 142.5 differ only by the F_e rounding. Note the spreadsheet's F_yb bands are off the NDS (Q7 uses 0.273–0.32 → 60,000 and > 0.32 → 45,000; Table I1 is 0.273–0.344 / 0.344–0.375) — irrelevant to this case, wrong for 20d–40d sizes.

Engine reads for the row: Z′ = 191 lb, W_cap = 61 lb (withdrawal, W′·p_t = 40.9 × 1.5), W_H′ = 181 lb, D/C = 100/191.3 = 0.523 PASS. The spreadsheet has no withdrawal or pull-through for this row.

---

## 5. Page checks

- `node tools/_wc-ui-smoke.mjs`: ALL PASS (structure, add/dup/del/undo/move, focus, option lists = `WC.DATA`, header → engine, adapter round-trip, version gate, hostile ids, print, no page/console errors).
- Scripted session (route-from-disk, headless Chromium), Nick's case entered through the DOM selects/inputs (`#species`, `#wc_1_side_theta`, `#wc_1_main_t`, `#wc_1_side_t`, `#wc_1_V`, `#wc_1_T`, `#wc_1_loadCase`): state received every edit; summary row `16d common | 191 | 61 | 0.52 | PASS` plus the exit-main warning; details block lists D, D_yield, F_yb 90,000 (Table I1), L 3.5, tip E 0.324, members (G 0.42, E 1,400,000, F_e 3,350, θ 0°/90°), lengths (p_tot 1.5, tip 0, l_m 1.5, l_s 1.5, p_t 1.5, p_min 0.972), R_e 1, R_t 1, K_θ 1.25, K_D 2.2, k1/k2/k3, all six modes with R_d 2.2 and "IV ◀ governs 119.6", factor table with cites, "Z′ 191 lb = 119.6 × 1.600 × 1.000 × …", W 25.6 lb/in, W′ 40.9, W′·p_t 61, W_H 113, W_H′ 181, W_cap 61 (withdrawal governs), demand block, flags/notes/cites. All values equal the engine result.
- Print: `page.emulateMedia({media:'print'})` → every `.wc-det` computed `display: table-row`, zero visible buttons.
- Round trip: `__WC_ADAPTER.getModel()` → keys `version,bolts,nails,screws,rowCnt` (no header, as specified) → `setModel(copy)` → `getModel()` identical string; rendered summary row identical before/after. `AREv2.captureState()` → `loadFromState()` restores the header species (SPF) and the row's side θ 90.
- No page errors.
- Cosmetic: D4 (p_t label for nails).

---

## 6. Residual cautions for the engineer (stated by the tool, not computed)

1. **Wood member capacity at the connection is not checked**: net-section tension, row tear-out and group tear-out (Appendix E), shear at bolted beam supports (§3.4.3.3), bearing of the member. The schedule is a fastener check only.
2. **Steel parts**: plate bearing, net section, block shear, bolt shear/tension per AISC; C_D does not apply when metal governs (§11.2.3, §11.3.2). Flagged as `unresolved` on the row.
3. **Lag / wood screw root-area tension** under withdrawal (§12.2.1.4, §12.2.2.5): the row prints T and A_r but does not compare them.
4. **Head/washer pull-through** for hex-head lags and steel side members (§12.2.5 / §11.1.1.3) is not computed; for counter-bored heads t_ns is measured from the bottom of the hole (Comm. C12.2.5.1) — the engine uses full t_s.
5. **Nail and wood screw spacing** (D < 1/4): "sufficient to prevent splitting" (§12.1.5.7, §12.1.6.5) has no numeric check; Commentary Table C12.1.5.7 is advisory.
6. **Configurations outside scope**: multiple shear planes, asymmetric three-member (§12.3.8/.9), load at an angle to the fastener axis (§12.3.10.1), clinched double-shear nails (§12.1.6.4 exception), drift pins, CLT, WSP side members (Tables 12Q/12R), glulam (Table 12.5.1F limits), stainless/ring-shank nails, LRFD.
7. **Group action row definition**: n = fasteners per row aligned with the load, no stagger (§11.3.6.2 staggered-row rule not applied); E is the species No. 2 reference E unless overridden.
8. **C_M fn 2 exception** is a checkbox for D ≥ 1/4 only (one fastener / one row ∥ grain / separate splice plates); the engine does not infer it from n = 1.
9. **Moisture and temperature** are header-wide; a schedule mixing interior and exposed connections needs two files.
10. **Fire-retardant-treated wood** (§11.3.5) and preservative-treated C_D limits are not represented.
11. **Eccentricity** (§11.1.3, C12.6.2): the gravity axes are assumed to pass through the centroid of the group.
12. "Lr" load case maps to C_D = 1.25 (Table 2.3.2 "Seven days — Construction Load"); confirm the roof live load duration assumption on the project.
