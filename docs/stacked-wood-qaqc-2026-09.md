# Stacked Headers & Studs / Stacked Shearwall — NDS 2018 · SDPWS 2021 · ASCE 7-16 QAQC

_Phase 1 (review only) — 2026-09-14. Integrated and arbitrated by Claude from six parallel audits (A–F, appendices in `docs/stacked-wood-qaqc-2026-09/`). No production calculator file was changed. Plan: `PLAN-STACKED-WOOD-QAQC.md` (Rev. 3, Codex-approved)._

## Verdict

**Neither calculator meets the code it cites. Both need the fix phase before any output is relied on.**

- **Stacked Headers & Studs** — 8 seal-blockers. The Southern Pine table is the pre-2013 set (F_b +25–40 %), beam stability is switched off by an R_B clamp of 10 (limit is 50), column slenderness is clamped at 50 so the slenderness row can never fail and floor height has no effect, and the king stud is bent about the wrong axis with a default axial load of zero. On AWC's own published wall-stud example (E1.9) the page reads D/C 0.51 where the book says 0.59.
- **Stacked Shearwall** — 8 seal-blockers. `calcCo` returns the SDPWS intermediate ratio r, not C_o; story shear is summed as plf across floors with different denominators (a two-story case reports 1,119 plf against a true 1,610 plf and flips FAIL to PASS); the Wind / Seismic selector is a dead input, so seismic walls get 1.40× the permitted sheathing capacity; gypsum-only and > 2,435 plf sheathing are offered for a method that forbids them; anchor-bolt sill capacity is 5/3 high; ΣL_i = 0 prints "All PASS".
- **Hardware** — every HDUE and CMST value matches the current ESR exactly. LTP4 600 / 667 lb cannot be traced to any published rating. Anchor bolts exceed the NDS Table 12E wood-side capacity by 74 %.

**Scope of this verdict.** Strength-level member and connection checks against the sections named below. Shear wall deflection / drift, diaphragm and collector design, concrete anchorage (ACI 318 Ch. 17), anchor-rod steel, and construction-stage stability are outside it.

## Phase 0 record

| Item | Value |
|---|---|
| NDS 2018 + Commentary | `Technical Resources - Documents\Wood\Wood Codes and Technical Guides\Wood Codes\NDS - 2018\AWC_NDS2018-withCommentary_20210917.pdf` |
| NDS 2018 Supplement | `...\NDS - 2018\AWC_NDS2018-Supplement_20210917.pdf` (Tables 4A, 4B) |
| SDPWS 2021 + Commentary | `...\Wood Codes\Special Design Provisions for Wind and Seismic.pdf` (approved 2020-07-22) |
| ASCE 7-16 | `Technical Resources - Documents\Analysis\ASCE 7-16.pdf` |
| Hardware | ESR-2330 (HDUE, reissued May 2026), ESR-2105 (CMST, Jan 2026), ESR-2236 (SDS), ESR-3096 (LTP4), Simpson C-C-2026 catalog, C-F-14 fastener guide |
| Benchmarks | WoodWorks *Five-Story Wood-Frame Structure over Podium Slab* (Dec 2017); AWC *Structural Wood Design Examples* 2015/2018 (E1.2a, E1.4, E1.5a, E1.7, E1.9); VF Wood Depth / Breadth solutions; Excel `NEW SHEAR WALL Design Template (3 & 4 Story).xlsx` (arithmetic only) |
| Not on server | NDS 2024, ASCE 7-22, IBC 2024 (deltas informational, §7) |
| Deploy path | `/tmp/are-git` (Git Bash), `core.worktree` = OneDrive repo, verified this session |

## Reviewer arbitration

Three disagreements between auditors were settled against the standard text, not by vote.

| Question | Auditors | Settled | Where verified |
|---|---|---|---|
| SDPWS 2021 seismic ASD divisor | B: 2.8 · D: "2.0 for both, difference is in the nominal" | **2.8 seismic (§4.1.4.1), 2.0 wind (§4.1.4.2)**. D's reading is the 2015 two-column layout; the 2021 table has one nominal column. | SDPWS 2021 PDF p. 21 |
| Uplift anchorage between hold-downs | Plan: t = V h / (C_o Σb_i) · D: t = v_max | **t = v_max (plf)** — "a uniform uplift force, t, equal to the maximum unit shear force induced by the design load, v_max". Plan corrected. | SDPWS 2021 PDF p. 41, §4.3.6.4.2.1 |
| Table 3.3.3 effective length, uniform load | A and plan: three branches incl. 1.84 l_u above 14.3 · E: two branches | **Two branches** (2.06 l_u below l_u/d = 7; 1.63 l_u + 3d at or above). The 1.84 l_u form is footnote 1 for loadings not listed. A's H-4 is downgraded to a +1.1 % conservative gap in the < 7 branch. Plan corrected. | NDS 2018 PDF p. 29 |
| ASCE 7-16 Table 12.2-1 wood rows | Plan: A.15/A.16/B.22/B.23 · B: A.15/A.17/B.22/B.24 | **B is right**; A.16 / B.23 are cold-formed steel. Plan corrected. | ASCE 7-16 Table 12.2-1 |
| C_b on header end bearing | A, E, plan agree | C_b = 1.0 at member ends (§3.10.4); C_b = 1.25 applies to the stud-on-plate interior bearing the page does not check. | NDS §3.10.4, AWC E1.2a / E1.5a |

Spot-checked by the reviewer on the source lines: R_B clamp (`:404`), l_e/d clamp (`:412`), slenderness row fed the clamped value (`:691`), king axial default 0 (`:664, :864`), page-level ply count (`:653`), dead `designCase` (`:220, :972, :978, :1010` only), anchor-rod diameters JS vs table (`:362–367` vs `:274–279`), anchor-bolt `Vconn` (`:396–397`). All present as reported.

## 1. Stacked Headers & Studs — findings

Severity: **SB** seal-blocker (a passing result can be unsafe) · **MF** must-fix (wrong vs code, usually conservative) · **SF** should-fix (missing check / wrong citation) · **D** disclosure. Source audits in brackets.

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| H-1 | SB | Southern Pine No.2 table is the pre-2013 set [A H-1, E-3] | F_b 1500/1250/1250/1050/1050 vs Table 4B 1100/1000/925/800/750 (+25 to +40 %); F_c +7 to +20 %; E 1.6M vs 1.4M; E_min 580k vs 510k. AWC E1.9: page 0.511 vs published 0.59, **13 % unconservative** | Replace with Table 4B No.2 by size class; keep F_v 175, F_c⊥ 565 |
| H-2 | SB | DFL 2x4 F_b = 1000 [A H-2] | Table 4A No.2 = 900 for every size (1000 is No.1). +11 % on F'_b for 2x4 | `'2x4':900` |
| H-3 | SB | `calcCL` clamps R_B at **10**; §3.3.3.7 limit is 50 [A H-3, E-2] | C_L can never fall below ≈ 0.99. AWC E1.2a: 0.989 vs 0.876 (+12.9 %). 2-ply 2x12 at 20 ft: +7.8 %; single 2x12 at 24 ft: +230 % and R_B = 50.2 (not applicable) | `Math.min(…, 50)`; R_B > 50 → applicability failure |
| H-4 | SB | `calcCP` clamps l_e/d at 50 and the "Slenderness ≤ 50" row prints the clamped value [A H-5/H-6, E-1] | Row reads 50/50 = 1.00 PASS at a true l_e/d of 80 (2x6 jamb, 10 ft) or 160 (20 ft stud). Floor height has **no effect** on any jamb or stud result above 6.25 ft. Against its own weak-axis model the C_P is 2.0–2.5× high | Unclamped ratio; > 50 → blocking "NOT APPLICABLE (§3.7.1.4)" |
| H-5 | SB | King stud bent about the **weak** axis, wind as a point load at the head, stud strip dropped, 0.9L clamp [A H-8/H-9, E-4, E-13] | S = d b²/6 (2.06 in³) instead of b d²/6 (7.56 in³); F_cE on b. Trib (open/2)(h/2) as one point load: M 27 % low on a 6 ft opening, f_b 0.53× correct at an 8.5 ft head; but S error makes default f_b 3.67× high → default king FAILS at 60 % of capacity. Head above story silently moved to 0.9 h | Uniform w = 0.6 p (opening/2 + s/2) over story height; S_x and F_cE1 on d; C_L = 1.0 (sheathed edge); head > h is a validation error |
| H-6 | SB | King axial defaults to **0**; C_r = 1.15 on a 1-member king [A H-10/H-11, E-8] | Eq. 3.9-3 runs with f_c = 0 and prints PASS; §4.3.9 needs ≥ 3 members. F'_b 15 % high | Axial from stud tributary gravity (override only); C_r = 1.0 for kings and jambs |
| H-7 | MF | No ASCE 7-16 §2.4.1 envelope; L_r **and** S summed; C_D hard 1.0 / 1.6; D-only members at 1.0 not 0.9; 0.6D + 0.6W never run [A H-12/H-14, E-5/E-6] | Defaults: 770 plf where D + S = 570 (+35 %); D-only 4-ply 2x10 SPF 28 ft reads 0.865 PASS, correct flexure 0.964 (+11 % unconservative); stud wind case is D + L + S + W, not a code combination | Combination table with per-combination C_D (plan item 7); D, L, L_r, S carried separately down the stack |
| H-8 | MF | Jambs and studs: weak axis unbraced over the full story [A H-7, E-9] | AWC E1.5a: C_P 0.112 vs 0.705 (−84 %); VF trimmer: D/C 2.78 vs 0.347 (8.0×), page picks 3 jambs where 1 suffices. Four published sources and NDS A.11.3 brace the weak axis | Weak-axis bracing input (default 48 in), strong axis over story; both axes retained; governing = smaller C_P (Nick's decision) |
| H-9 | MF | Wind pressure basis undeclared; C&C calc `sendToHeaders` passes **strength-level** §30.3 pressure used unfactored [A H-13, E-10] | 25 psf enters ASD checks at 25, not 15 psf (1.67×). Conservative but not the code combination; `asce716_cc_wind_calculator.html:1786–1794` must change in the same pass | Label "strength-level W", apply 0.6 in the engine |
| H-10 | MF | Header ply count from the **page-level** wall select; jambs/kings from the per-row cell [A H-19] | Row at 2x4 with page at 2x6 → 3-ply (4.5 in) header in a 3.5 in wall; b_eff 50 % wide on flexure, shear, bearing | `n_plies` from `rowWallSz` |
| H-11 | MF | No deflection check; `LBR[].I` and `E` are dead data [A H-18, E-7] | 3-ply 2x12 at 16 ft: Δ_total 0.98 in vs L/240 = 0.80 (D/C 1.23), not reported. Masked today by the inflated stress check; unmasked once H-7 is fixed | IBC 2021 Table 1604.3 rows (L/360 live; L/240 D + L, 0.5D option); stud wind deflection H/240 or H/120 at 0.42W |
| H-12 | SF | Bearing area = b × 1.5 regardless of jamb count; no plate bearing under jamb pack or studs; C_b = 1.0 at ends is correct [A H-16/H-17, E-11] | Default: D/C 0.730 reported vs 0.540 at the chosen jamb count. VF header sets the jamb count **by** bearing (l_b = 2.65 in → 2 trimmers). Stud-on-plate bearing (C_b = 1.25) governs AWC E1.5a and is absent | l_b = n_jambs × 1.5; plate F_c⊥ rows for jamb pack and stud with plate species |
| H-13 | SF | Wall-stud pass limit 0.96 [A H-15] | Undocumented house margin printed as a code check | 1.0 (Nick's decision) |
| H-14 | SF | Stacks matched by label text; deleting a mid-stack header drops every floor above; species / width / height changes do not re-render stale panels [A H-20, H-24] | `delHeader` splices one floor; `addFloor` copies labels; no listener on `species` | Stable IDs, continuity validation, re-render on any engine input |
| H-15 | SF | Foundation export has no version, merges L + S into one "LL" on receipt, omits jamb point reactions, units undeclared [A H-22] | `headers_gradebeam_pier_calculator.html:617–648` does `llTotal = llPlf + slPlf` | Payload v2 with D / L / L_r / S, governing combination, jamb reactions; reader accepts v1 and v2 |
| H-16 | SF | Table 3.3.3 l_u/d < 7 branch (2.06 l_u) missing [E-12; A H-4 corrected] | +1.1 % on l_e, conservative, at 3-ply 2x8 / 4 ft | Branch on l_u/d < 7 |
| H-17 | SF | Eq. 3.9-3 bending term silently zeroed when f_c ≥ F_cE; king F_cE computed two ways in one function [A H-21, E-14] | Failure mode printed wrong; `cp.FcE` 190.7 vs `FcE_k` 92.0 psi for the same member | Applicability error when f_c ≥ F_cE1; one F_cE |
| H-18 | SF | Page and registry cite **ASCE 7-22**; wind feed and baseline are 7-16 [A H-23] | `:234`, `:341`, `app/lib/calcs.ts:398` | ASCE 7-16 |
| H-19 | D | State on the sheet: equal ply load sharing with no ply fastening design; no live-load reduction; C_M = C_t = C_i = 1.0; door-head fallback is dead code (`:663`); detail-panel id collision at 11+ headers (`:648`); AREv2 v1 has no engine / code stamp; `wallTrib` 8 ft vs `flrHt` 9 ft; no stud shear row; No.2 and 2x sizes only [A H-26…H-32, E-15] | — | Note box + Phase 2 items 17–20 |

**Confirmed correct (verified against the standard, not just read):** `LBR` section properties (all 15 entries); `CF_Fb` / `CF_Fc` vs Table 4A size-factor block; `useCF:false` for SYP; all SPF No.2 values; DFL F_v / F_c⊥ / F_c / E / E_min; Eq. 3.3-6 and Eq. 3.7-1 algebra; c = 0.8; K_cE = 0.822; F_bE = 1.20 E'_min / R_B²; F*_b and F*_c factor sets; f_v = 1.5 V/A; V at the reaction (conservative); no C_D and no C_b on F'_c⊥; Eq. 3.9-3 uniaxial form; wall-stud F_cE on d and S on the strong axis; C_r = 1.15 on wall studs at ≤ 24 in; jamb reaction (not header plf) accumulated floor to floor; `designJambs` fallback reports FAIL rather than silent success. `calcCP` reproduces AWC E1.4 to four figures whenever l_e/d ≤ 50.

## 2. Stacked Shearwall — findings

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| S-1 | SB | Seismic not implemented: `designCase` and `species` are export-only; every capacity is nominal ÷ 2.0 [B S-1/S-6, D-5] | §4.1.4.1 requires ÷ 2.8 for seismic → **1.40×** overstated (7/16 8d@6: 335 vs 239 plf). SPF framing needs the Table 4.3A SG factor 0.92 → with seismic **1.52×**. Proved live: engine output byte-identical for wind and seismic | Nominal stored per row; ÷ 2.0 or 2.8 at use; SG factor from species; separate W and E inputs (plan item 11) |
| S-2 | SB | `calcCo` returns SDPWS's intermediate **r**, not C_o [B S-2, D-1] | Code = 1/(1 + A_o/A_fhs) = r. C_o = [r/(3 − 2r)]·(L/Σb_i). Table 4.3.5.6 at 20 % / 30 %: 0.91 vs code 0.40. Sweep: **+10.7 % unconservative** at 70 % sheathed, −189 % at 15 %; crossover ≈ 60–65 % sheathed. Shipped default 1 % unconservative. The Excel the notes cite **has** the second step (column H) | `r/(3−2r)·(L/Σb_i)`, cap 1.0, A_o from an opening schedule with h/3 minimum |
| S-3 | SB | `v_total` sums plf across stories with different C_o·Σb_i [B S-3, D-2] | Two-story case (80 % over 40 % sheathed): 1,119 plf reported, **1,610 plf true** (−30.5 %) — sheathing D/C 0.87 PASS should be 1.25 FAIL. §4.3.6.4.4: sum of **forces**. Inherited from the spreadsheet (`J19 = I19 + J9`). The overturning loop in the same function accumulates force-first and is correct | V_k = Σ P_j, then v_k = V_k / (C_o,k Σb_i,k) |
| S-4 | SB | Gypsum-only sheathing and two > 2,435 plf options offered for the perforated method [B S-4/S-5, D-11] | §4.3.2.3: "sheathed on one or both sides with wood structural panel"; item 4 caps nominal at 2,435 plf. `osb1532_2_4` = 2,580, `osb1532_2_3` = 3,360 nominal | Remove gypsum-only; gypsum only as WSP opposite face (§4.3.5.4.2) or drop; reject v_n > 2,435 |
| S-5 | SB | Aggregate ΣL_i; no segment list; §4.3.3.4 aspect-ratio rule cannot be applied; A_fhs conflated with Σb_i [B S-8/S-9, D-4] | Piers 8 / 4 / 3 / 2.5 ft at h = 10: naive 17.5 ft, correct **13.0 ft** (−25.7 %) → v and T 26 % under. Commentary C4.3.5.6: A_fhs is **unreduced** | `b_i[]` per wall; exclude > 3.5:1; × 2b_i/h above 2:1; A_fhs from unreduced widths |
| S-6 | SB | Anchor-bolt sill capacity 5/3 high, and the per-bolt basis itself exceeds NDS [D-6, C] | `Vconn` 1,813 / 2,587 = spreadsheet per-bolt 1,088 / 1,552 × 20/12; `sillVall` divides by spacing again → ⅝ in @ 20 in reports 1,552 plf, source basis 931 plf. NDS Table 12E (1.5 in DFL sill, 6 in embed) × 1.6 = **1,040 / 1,488 lb** per bolt → 893 plf | Derive from Table 12E yield modes (plan item 12); concrete anchorage out of scope by statement |
| S-7 | SB | ΣL_i = 0, L = 0 or ΣL_i > L → "✔ All PASS" with every demand zeroed [B S-10] | HTML `min` not enforced on change; import and `setModel` bypass it | Central `validate(state)` |
| S-8 | SB | Load basis undeclared; no 0.6W / 0.7E; 0.6 hard-coded on dead load only; `v_this` has no code meaning [B S-11, D-10, D-16] | User entering strength-level W gets 1.67× demand; entering cumulative story shears (as WoodWorks publishes) double-counts | Strength-level incremental W and E per floor, factored in the engine (plan item 11); legacy records blocked until re-assigned |
| S-9 | MF | Dead-load relief is a **force** subtracted from a **moment**; `dl_override` added unfactored [B S-12, D-3] | Short by L/2: 151× on the 302 ft default, 20× on a 40 ft wall. Case 3-DL: T = 28,930 "EXCEEDS HDUE17" vs correct 3,220 lb → HDUE3 | Unfactored components; 0.6 once; M_R = w L²/2 (uniform) + 0.6 P_D on the chord (point); labels in lb·ft |
| S-10 | MF | Table 4.3A footnote 10 factor 0.92 (10d common + hold-down on inside face of end post) absent [B S-7] | 435 → 400, 645 → 593, 840 → 773 plf whenever the predicate holds — the normal HDUE detail | Boolean input; apply to 10d rows; print the trigger |
| S-11 | MF | §4.3.6.4.2.1 uplift anchorage t = v_max absent; §4.3.6.4.3 plate-washer note absent [B S-13, D-7] | Case 4: T clamps to 0 under dead load yet t = 114 plf is still required | Fifth row: t vs bottom-plate uplift capacity; washer note above 400 plf nominal |
| S-12 | MF | Hardware look-up "first T_all ≥ T" with no prerequisite gate; free-text end post; no end-post compression check [B S-14, C] | HDUE9 9,390 lb needs member **thickness** ≥ 4.5 in (3.5 in → 8,425); HDUE13 12,950 is the 7.25 in thickness column; HDUE17 note omits "high-strength anchor bolt"; CMST nail counts are **totals**, labelled "per side"; CMST needs SG ≥ 0.50 | Structured end post; gate on catalog prerequisites; §3.7.1 C_P row for the end post |
| S-13 | MF | Anchor-rod diameters disagree between `HOLDOWNS[]` and the printed schedule on 4 of 6 rows [B S-15] | HDUE3/5/7: JS ⅝ vs table ½; HDUE9: ⅞ vs ¾. ESR-2330 Table 2A confirms the JS values | Render the table from `HOLDOWNS[]` |
| S-14 | MF | T never clamped at 0; negative T selects HDUE3; one direction, one end [B S-23, D-8] | Live: `dl_override` = +403,200 → T = −13,703 lb printed, HDUE3 selected | T = max(0, …) both ends, both directions; report C separately |
| S-15 | SF | LTP4 600 / 667 lb untraceable; "16d" = box nail (165 lb), not common (226 lb); SDS ¼×4½ 304 lb is the mixed-species row (DF/SP = 400 lb); three C_D bases in one table [C, D-15] | C-C-2026 LTP4: 715 nailed / 910 SD (G, C_D 1.6), 580 / 800 (H). 600 × 12/16 = 450 plf and 667 → 500 plf look back-solved | Nick to identify the LTP4 source or adopt catalog G/H values; label nail type; species-driven SDS value |
| S-16 | SF | "r ≤ 5/6 maximum opening" gate cited to §4.3.3.4 has **no basis** in SDPWS 2021; h/3 minimum opening height not applied; openings lumped as one rectangle [B S-22, D-12/D-13] | Full-text search: no "5/6" anywhere in the standard (it is the top row of the pre-2015 table). Real limits are §4.3.2.3 items 4 and 8 | Replace with §4.3.2.3 set; opening schedule with h/3 floor; keep h_o ≤ h validation |
| S-17 | SF | ~13 citations use 2015 numbering or the wrong 2021 section; "Column A/B", "C_D = 1.6" labels, "NDS 2018 ASD" subtitle, "verified vs Excel SW1" as basis [B S-19/S-20/S-25] | Map in appendix B (perforated §4.3.2.3; aspect §4.3.3.4; C_o §4.3.5.6 Eq. 4.3-6; chord force §4.3.6.1.3 Eq. 4.3-8; unit shear §4.3.6.4.1.1 Eq. 4.3-9; uplift §4.3.6.4.2.1; bolts §4.3.6.4.3) | Re-tag; delete two-column language |
| S-18 | SF | Every connector offered on every floor; unknown ids fall back positionally (`SILL_CONN[3]`, `SHEATHING[4]`); wall lines correlated by array index with fallback to index 0; "+ Add Floor" appends at the **bottom** and silently demotes the 1st floor [B S-16/S-17/S-18] | Adding a floor to a checked 4-story model flips the old ground floor to strap-eligible and puts an `sds14` sill on the foundation | Foundation flag per connector; hard error on unknown ids; stable wall IDs; explicit base level |
| S-19 | SF | Blocked construction, 3x framing / staggered nailing (§4.3.7.1(5), fn. 6) and stud spacing prerequisites neither asked nor printed [B S-21] | `osb1532_1_3` and both `osb1532_2_*` trigger the 3x rule; > 980 plf nominal triggers it in SDC D–F | Blocked flag; adjoining-edge framing width; print the prerequisite |
| S-20 | SF | `importProject` ignores `version`; a v1 record lacks W/E, load basis, segments, SFRS/SDC, blocked flag, applied species, opening list, inside-face flag [B S-24] | — | Plan item 20 |
| S-21 | D | State: §4.3.2.3 items 2/5/6/7/9 as assumptions; "not covered" list; chord lever arm is C_o Σb_i per code (WoodWorks segmented d is 7–10 % lower — disclosure, not a violation); two display-only seismic cells (230 → 240, 360 → 350) become live once S-1 is fixed [B S-26/S-27, D-9, D-14] | — | Note box |

**Confirmed correct:** all six WSP entries = Table 4.3A *Sheathing*-grade nominal ÷ 2.0 for wind; two-sided = 2× for identical systems (§4.3.5.4.1); gypsum values trace to Table 4.3C blocked / 16 in; `sillVall` units; v_max as the demand for both sheathing and sill shear; `H(j,k)` places each level force at the top of its story and the overturning numerator reduces exactly to Eq. 4.3-8 for one story; force-first overturning accumulation (which is why S-3 is an internal inconsistency); Eq. 4.3-8 (C_o Σb_i lever arm) is the right chord-force form for a perforated wall; `xe()` escaping on all `innerHTML` paths; print CSS expands details.

## 3. Hardware verification (DF/SP, Simpson "160" basis)

| Device | Code | Verified | Source | Δ | Prerequisite the calc must enforce |
|---|---|---|---|---|---|
| HDUE3/5/7-SDS3 | 3,790 / 5,375 / 7,015 | same | ESR-2330 T2B | 0 | 3½ in post; HDUE7 high-strength anchor bolt |
| HDUE9-SDS3.5 | 9,390 | 9,390 at thickness ≥ 4.5 in (**8,425** at 3.5 in) | ESR-2330 T2B | 0* | member thickness, ⅞ in rod |
| HDUE13-SDS3.5 | 12,950 | 12,950 at 7.25 in thickness (11,900 at 5.5; 13,110 for 6x6) | ESR-2330 T2B | 0* | thickness; heavy hex nut |
| HDUE17-SDS4.5 | 17,685 | same, 6x6 **and** high-strength anchor bolt | ESR-2330 T2B fn. 7, 11 | 0 | note missing in calc |
| CMSTC16 / CMST14 / CMST12 | 4,690 / 6,475 / 9,215 | same, C_D 1.6 embedded | ESR-2105 T4 | 0 | nail counts are totals (½ each side); SG ≥ 0.50 |
| LTP4 roof / floor | 600 / 667 | **not confirmed** — 715 (nails, G, 1.6) / 910 (SD9); 580 / 800 | C-C-2026 p. 309, ESR-3096 T6 | — | 0.72× / 0.64× over ⅜ / ½ in sheathing |
| 16d nail | 160 | 165 (16d **box** × 1.6); common = 226 | NDS Table 12N | −3 % | label the nail |
| SDS ¼ × 4½ | 304 | 304 = 190 × 1.6 (mixed species row); DF/SP = 250 × 1.6 = **400** | C-F-14 p. 321 | −24 % | species |
| ½ in anchor bolt | 1,813 | **1,040** (Z∥ 650 × 1.6) | NDS Table 12E, mode III_s | **+74 %** | 1.5 in DFL sill, 6 in embed, plate washer |
| ⅝ in anchor bolt | 2,587 | **1,488** (Z∥ 930 × 1.6) | NDS Table 12E | **+74 %** | as above |

\* correct only at the stated thickness. Independent yield-mode recompute (TR-12 equations, F_em 7,500 psi concrete, F_es 5,600 psi, F_yb 45 ksi) reproduces Table 12E within 3 % and confirms mode III_s (sill-plate bearing plus one hinge) governs.

## 4. Independent recompute — evidence

**Headers / studs (appendix E).** The Python recompute was validated first against five AWC examples (C_L 0.8756 vs 0.876; C_P 0.2319 vs 0.232 and 0.7048 vs 0.705; Eq. 3.9-3 0.8871 vs 0.89 and 0.5863 vs 0.59). Then the live page:

| Case | Published | Recompute | Calculator | Reading |
|---|---|---|---|---|
| AWC E1.2a 4x16, 20 ft — C_L | 0.876 | 0.8756 | **0.989** | +12.9 %, R_B clamp |
| AWC E1.5a 2x6 SPF stud — C_P | 0.705 | 0.7048 | **0.112** | −84 %, weak axis unbraced + clamp |
| AWC E1.7 2x6 beam-column — Eq. 3.9-3 | 0.89 | 0.887 | **1.63 FAIL** | +83 %, C_P + forced C_r |
| AWC E1.9 2x8 SYP wall stud — Eq. 3.9-3 | 0.59 | 0.586 | **0.511** | **−13 %, unconservative** (H-1 outweighs H-4) |
| VF trimmer (2) 2x6 under 8 ft header — D/C | 0.347 | 0.347 | **2.78 FAIL** | 8.0×, picks 3 jambs where 1 passes |
| Default roof header 3-ply 2x8 / 8 ft — governing D/C | — | 1.125 (D + S, C_D 1.15) | 1.746 (D + L_r + S, C_D 1.0) | +55 % |
| Default king stud — Eq. 3.9-3 | — | 0.601 | 2.43 FAIL | +305 % |
| Default stud rows, 2nd floor | — | 0.176 | 2.12 FAIL | page fails a wall at 18 % of capacity |

22 expected-value fixtures with provenance: `docs/stacked-wood-qaqc-2026-09/E-fixtures.json`.

**Shearwall (appendix D).** Recompute reproduces WoodWorks §6 (pp. 33–46) to ≤ 0.21 % on M_OT, v, M_R and T. The calculator reproduces WoodWorks unit shear to 0.0 % — but only because that wall is segmented, opening-free and constant-length, the one arrangement where S-2 and S-3 both vanish. Diagnostic two-story case:

| Quantity | Recompute | Calculator | Δ |
|---|---|---|---|
| C_o lower story | 0.5435 (table 0.55) | 0.4545 (= r) | −16 % |
| v_max lower story | **1,610 plf** | **1,119 plf** | **−30.5 %** |
| Sheathing D/C (1,290 plf) | **1.25 FAIL** | **0.87 PASS** | state change |
| T lower story with 200 plf DL | 3,220 lb → HDUE3 | 28,930 lb → "EXCEEDS HDUE17" | 9.0× |

7 fixtures with provenance: `docs/stacked-wood-qaqc-2026-09/D-shearwall-fixtures.json`.

## 5. Decisions for Nick before Phase 2

Answer by number. Recommendation first.

1. **Wind input basis (H-9).** Strength-level W typed, 0.6 applied in the engine, and the C&C calculator's `sendToHeaders` left as-is since it already sends strength-level. Agree?
2. **King stud axial (H-6).** Kings carry the stud tributary gravity only; the jamb pack takes 100 % of the header reaction. Agree?
3. **Jamb strong-axis unbraced length (H-8).** Floor height (your Q4 decision, conservative) rather than top-of-opening (the trimmer's physical length). Keep floor height?
4. **C_r on wall studs.** Grant 1.15 at ≤ 24 in o.c. with the predicate printed, no "sheathed" checkbox. Agree?
5. **Roof L_r and S inputs (H-7).** Keep both fields, enveloped as alternatives (never summed). Agree?
6. **C_o correction effect (S-2).** The fix moves results both ways (some walls newly pass, 60–90 % sheathed walls with tall openings newly fail by up to 11 %). Are there issued projects that used this calculator and should be re-checked? List them if so.
7. **Dead-load relief model (S-9).** Uniform wall dead load as M_R = 0.6 · w L²/2 plus 0.6 · P_D for point loads at the chord, both entered unfactored, both directions. Agree?
8. **Legacy shearwall records (S-8).** Hard-block until each floor's force is re-entered as W or E strength-level. Agree, knowing every saved record will need re-entry?
9. **Gypsum (S-4).** Recommend dropping gypsum from this calculator entirely rather than carrying the §4.3.5.4.2 opposite-face branch. Agree?
10. **Add Floor ordering (S-18).** Add at the top with an explicit base-level flag. Agree?
11. **LTP4 (S-15).** Where did 600 / 667 lb come from? If unknown, adopt catalog values (715 nailed / 910 SD9, G direction) with the sheathing-thickness reduction.
12. **SDS value (S-15).** Keep 304 lb (mixed species) as the default and switch to 400 lb only when the sill species selector says DF/SP. Agree?
13. **Anchor bolts (S-6).** NDS Table 12E × 1.6 (1,040 / 1,488 lb per bolt) as the wood-side basis, concrete anchorage stated out of scope. Agree?
14. **Collector nuance (C4.3.6.4.4).** Always carry v_max to the floor below (conservative). Agree?
15. **Which findings to act on.** Default: every SB and MF, plus SF items H-12…H-18 and S-15…S-20, plus the disclosures as note-box text. Strike anything you want left.

## 6. Edition deltas (informational, appendix F)

- **SDPWS 2015 → 2021 is a present-day gap**, not a future one: the page still uses 2015 wording. Single nominal column; ÷ 2.0 wind / ÷ 2.8 seismic; gypsum seismic ASD ≈ 70 % of 2015; new 0.92 footnote-10 factor; single C_o equation; new §4.3.2.3 limitation list; SDC D–F vertical strength-distribution rule (relevant to stacked walls, not yet in either calculator).
- **NDS 2024**: shear design reformatted to force basis (same numbers); "extensive changes" to multi-ply connections in Ch. 12 (not confirmable from public text); fire chapter aligned to the 2024 FDS. No public evidence of DFL / SP / SPF No.2 design-value changes (2024 Supplement errata touch Hem-Fir(N) only).
- **ASCE 7-22**: ASD snow term becomes 0.7S with importance factor removed and risk-targeted ground snow maps — the header calculator's snow input and combination table would change; K_d moved out of q_z (structure, not magnitude); C&C wall pressures same or slightly lower; seismic via multi-period spectrum and nine site classes.
- **IBC 2024** delivers NDS 2024 and ASCE 7-22; SDPWS stays 2021; Table 1604.3 footnote d unchanged as far as could be confirmed.

## 7. Appendices

`docs/stacked-wood-qaqc-2026-09/`: A-headers-code-audit.md · B-shearwall-code-audit.md (with the citation map) · C-hardware-verification.md · D-shearwall-recompute.md + D-shearwall-fixtures.json + D-psw-recompute.py · E-headers-recompute.md + E-fixtures*.json + E-nds2018-recompute.py · F-edition-deltas.md. Live-read harnesses (scratch, untracked): `tools/_qaqc-stacked-headers-live.mjs`, `tools/_qaqc-stacked-shearwall-live.mjs`.
