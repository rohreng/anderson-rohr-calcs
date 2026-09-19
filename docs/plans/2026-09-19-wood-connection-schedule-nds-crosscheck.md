# NDS 2018 cross-check — Wood Connection Schedule plan
_Fable, 2026-09-19. Source: `AWC_NDS2018-withCommentary_20210917.pdf` (313 pp) and `AWC_NDS2018-Supplement_20210917.pdf` (86 pp). Page cites are **printed page (PDF page)**; printed = PDF − 14 in the main volume. Supplement cites are PDF pages. Every value below was read from the PDF text, not memory; tabulated Z cells were additionally reproduced with the yield equations (see C.7)._

Plan reviewed: `docs/plans/2026-09-19-wood-connection-schedule-plan.md`.

---

## (A) Plan statements CONFIRMED

| # | Plan statement | Clause / table | Page | Verified text or values |
|---|---|---|---|---|
| A1 | Species G from Table 12.3.3A | Table 12.3.3A | 87 (101) | Sawn: DFL 0.50, DFL(N) 0.49, DF-South 0.46, HF 0.43, HF(N) 0.46, SPF 0.42, SPF(S) 0.36, SP 0.55, Mixed SP 0.51, Red Oak 0.67, Western Woods 0.36 (full list in E1). Fn 1: G on oven-dry weight and volume; MSR/MEL grades have their own G. |
| A2 | Appendix L: L1 bolts, L2 lags (D, D_r, E, T), L3 wood screws (D, D_r), L4 nails (D, L) | Tables L1–L4 | 180–182 (194–196) | Confirmed; full dims in E3–E6. L2 lists T, S and T−E per length. L3 fn 6 and L4 fn 2: tip E may be taken as 2D. |
| A3 | F_yb by diameter band, lag 1/4 = 70 ksi, 5/16 = 60 ksi, ≥3/8 = 45 ksi, bolt 45 ksi | Appendix Table I1 | **175 (189)** (plan gives no page; the table is not on the Appendix I first page 173) | "Bolt, lag screw (with D ≥ 3/8"), drift pin ... 45,000". Nail/spike/lag/wood screw: 0.099–0.142 → 100,000; 0.142–0.177 → 90,000; 0.177–0.236 → 80,000; 0.236–0.273 → 70,000; 0.273–0.344 → 60,000; 0.344–0.375 → 45,000. 1/4 (0.250) → 70k, 5/16 (0.3125) → 60k, 3/8 → 45k, consistent with Table 12J/12K fn 2. |
| A4 | Steel F_e: A36 87,000; A653 SS Gr 33 61,850 | Table 12B/12D/12G/12I/12K fn 2 (87,000); 12K/12M/12P/12T fn 2 (61,850); basis Appendix I.2 | 96–104 (110–118), 108–113 (122–127); I.2 at 173 (187) | I.2: "Design values in Tables 12B, 12D, 12G, 12I, 12K, 12M, 12P, and 12T are for 1/4" ASTM A 36 steel plate or 3 gage and thinner ASTM A 653, Grade 33 steel plate ... nominal bearing strengths of 2.4 F_u and 2.2 F_u ... divided by 1.6." 2.4·58,000/1.6 = 87,000; 2.2·45,000/1.6 = 61,875 → tabulated 61,850. **Clause cite in plan is wrong — see B2.** |
| A5 | Steel E = 30,000 ksi for C_g | Table 11.3.6C header | 71 (85) | "For D = 1", s = 4", E_wood = 1,400,000 psi, E_steel = 30,000,000 psi". **Table number in plan is wrong — see B1.** |
| A6 | Dowel bearing: D < 1/4 F_e = 16,600 G^1.84; D ≥ 1/4 F_e∥ = 11,200 G, F_e⊥ = 6,100 G^1.45 / √D | Table 12.3.3 fn 2 | 86 (100) | "F_e∥ = 11200G; F_e⊥ = (6100G^1.45)/(D)^0.5; F_e for D < 1/4" = 16600 G^1.84; Tabulated values are rounded to the nearest 50 psi." Table columns: 0.31 ≤ G ≤ 0.73; D = 1/4 … 1". §12.3.3.1: use Table 12.3.3 for sawn lumber; §12.3.3.3: SCL F_e from manufacturer/ESR (so "Custom" species must also take typed F_e, not G-derived — see D9). |
| A7 | Hankinson Eq. 12.3-11 | §12.3.4 | 84 (98) | F_eθ = F_e∥ F_e⊥ / (F_e∥ sin²θ + F_e⊥ cos²θ); θ = angle between load and grain. (Also Appendix J Eq. J-2, p.176 (190).) |
| A8 | Yield limit equations Table 12.3.1A, modes and k1/k2/k3 | Table 12.3.1A | 83 (97) | Single shear: I_m (12.3-1) D l_m F_em/R_d; I_s (12.3-2) D l_s F_es/R_d; II (12.3-3) k1 D l_s F_es/R_d; III_m (12.3-4) k2 D l_m F_em/((1+2R_e)R_d); III_s (12.3-5) k3 D l_s F_em/((2+R_e)R_d); IV (12.3-6) D²/R_d · √(2F_em F_yb/(3(1+R_e))). Double shear: I_m (12.3-7) same; I_s (12.3-8) 2D l_s F_es/R_d; III_s (12.3-9) 2k3 D l_s F_em/((2+R_e)R_d); IV (12.3-10) 2D²/R_d √(…). k1 = [√(R_e + 2R_e²(1+R_t+R_t²) + R_t²R_e³) − R_e(1+R_t)]/(1+R_e); k2 = −1 + √(2(1+R_e) + 2F_yb(1+2R_e)D²/(3F_em l_m²)); k3 = −1 + √(2(1+R_e)/R_e + 2F_yb(2+R_e)D²/(3F_em l_s²)). R_e = F_em/F_es, R_t = l_m/l_s. "D = diameter, in. (see 12.3.7)". |
| A9 | R_d Table 12.3.1B, K_θ, K_D | Table 12.3.1B | 84 (98) | 0.25" ≤ D ≤ 1": I_m, I_s 4K_θ; II 3.6K_θ; III_m, III_s, IV 3.2K_θ. D < 0.25": all modes K_D (fn 1). K_θ = 1 + 0.25(θ/90); θ = max angle load-to-grain (0–90°) for any member. K_D = 2.2 for D ≤ 0.17"; 10D + 0.5 for 0.17" < D < 0.25". Fn 1: "For threaded fasteners where nominal diameter (see Appendix L) is greater than or equal to 0.25" and root diameter is less than 0.25", R_d = K_D K_θ." |
| A10 | Bolts: l = member thickness | Fig. 12B/12C | 84 (98) | t_s = l_s, t_m = l_m shown for single and double shear. §12.3.5.1: bearing length is length of dowel bearing perpendicular to load. |
| A11 | Penetration minima: nails 6D §12.1.6.4, wood screws 6D §12.1.5.6, lags 4D §12.1.4.6 | as cited | 74–75 (88–89) | Section numbers correct. Text quoted in C1. |
| A12 | Reduced-penetration scaling: nails/wood screws p/10D (6D ≤ p < 10D), lags p/8D (4D ≤ p < 8D) | 12J/12K fn 3; 12L/12M fn 3; 12N/12P fn 3 | 106–113 (120–127) | 12J/K fn 3: "Where the lag screw penetration, p, is less than 8D but not less than 4D, tabulated lateral design values, Z, shall be multiplied by p/8D or lateral design values shall be calculated using the provisions of 12.3 for the reduced penetration." 12L/M and 12N/P fn 3: same wording with 10D / 6D. Below p_min: §12.3.1(d) precondition fails → equations do not apply (plan's FAIL flag is right). |
| A13 | Withdrawal: lag 1800 G^1.5 D^0.75 (12.2-1); wood screw 2850 G² D (12.2-2); nail 1380 G^2.5 D (12.2-3); bolts none | §12.2.1.1, §12.2.2.1, §12.2.3.1(a) | 76–77 (90–91) | Exact. Units lb/in of (thread) penetration. Also 12.2-4 stainless nail 465 G^1.5 D and 12.2-5 ring-shank 1800 G² D (not in scope). §12.2.4: drift bolts/pins by §11.1.1.3 only — bolts have no W. |
| A14 | Z' = Z·C_D·C_M·C_t·C_g·C_Δ·C_eg·C_di·C_tn; W' = W·C_D·C_M·C_t·C_eg·C_tn | Table 11.3.1 | 66 (80) | Dowel-type lateral row: C_D C_M C_t C_g C_Δ − C_eg − C_di C_tn (dashes = penetration-depth C_d and metal-side-plate C_st do NOT apply to dowel fasteners in NDS 2018 — confirms dropping the spreadsheet's C_d). Withdrawal row (nails, spikes, lag screws, wood screws, drift pins): C_D C_M² C_t − − − C_eg − − C_tn. Fn 1: C_D ≤ 1.6 for connections. Fn 2: C_M does not apply to toe-nails in withdrawal. |
| A15 | C_D values 0.9/1.0/1.15/1.25/1.6; impact 2.0 excluded for connections | Table 2.3.2 + fn 2; §11.3.2 | 11 (25); 66 (80) | Table: Permanent 0.9, Ten years 1.0, Two months 1.15, Seven days 1.25, Ten minutes 1.6, Impact 2.0. Fn 2: "Load duration factors greater than 1.6 shall not be used in the design of connections or wood structural panels." §11.3.2: "C_D ≤ 1.6 ... The impact load duration factor shall not apply to connections." Also not applied when metal strength governs (§11.2.3). |
| A16 | C_M Table 11.3.3, C_t Table 11.3.4 | as cited | 67 (81) | Values in E8/E9. |
| A17 | C_eg = 0.67 lateral in end grain | §12.5.2.2 | 91 (105) | "Where dowel-type fasteners are inserted in the end grain of the main member, with the fastener axis parallel to the wood fibers, reference lateral design values, Z, shall be multiplied by the end grain factor, C_eg = 0.67." (Applies to all dowel types incl. bolts, not only lags/screws/nails.) Also §12.3.3.4: for D ≥ 1/4" in end grain use F_e⊥ for F_em. |
| A18 | C_di = 1.1 nails in diaphragms | §12.5.3 | 91 (105) | "nails or spikes ... diaphragm construction ... C_di = 1.1" (permitted, nails/spikes only). |
| A19 | C_tn = 0.83 lateral, 0.67 withdrawal | §12.5.4.2, §12.5.4.1 | 91 (105) | Exact. §12.5.4.1 adds "The wet service factor, C_M, shall not apply." |
| A20 | Toe-nail driven at 30°, started L/3 from end | §12.1.6.3 | 75 (89) | "driven at an angle of approximately 30° with the member and started approximately 1/3 the length of the nail from the member end (see Figure 12A)." Bearing lengths are NOT in this clause — see B5. |
| A21 | Combined load Eq. 12.4-1 lags/wood screws; Eq. 12.4-2 nails | §12.4.1, §12.4.2 | 89 (103) | 12.4-1: Z'_α = (W'p)Z' / ((W'p)cos²α + Z' sin²α), p = length of **thread** penetration into main member. 12.4-2: Z'_α = (W'p)Z' / ((W'p)cosα + Z' sinα), p = length of **fastener** penetration into main member. α = angle between wood surface and load (α = 90° is pure withdrawal). |
| A22 | C_g for D ≥ 1/4 from n, A_m, A_s, s, E_m, E_s; D < 1/4 → 1.0 | §11.3.6.1 (not 12.3.6 — B1) | 68 (82) | Eq. 11.3-1: C_g = [ m(1−m^2n) / ( n[(1+R_EA m^n)(1+m) − 1 + m^2n] ) ] · [(1+R_EA)/(1−m)]; R_EA = lesser of E_sA_s/E_mA_m or E_mA_m/E_sA_s; m = u − √(u²−1); u = 1 + γ(s/2)(1/(E_mA_m) + 1/(E_sA_s)); γ = 180,000 D^1.5 wood-to-wood, 270,000 D^1.5 wood-to-metal (**γ is missing from the plan — D2**). "C_g = 1.0 for dowel type fasteners with D < 1/4"". Applies to "dowel-type fasteners with D ≤ 1" in a row". |
| A23 | Geometry Tables 12.5.1A (end), B (spacing in row), C (edge), D (row spacing) | as cited | 90–91 (104–105) | Contents in E10. |
| A24 | Double-shear bolts with two steel side plates: equations apply with l_s = plate thickness | Table 12G (sawn/SCL main, 1/4" A36 sides), Table 12I (glulam main) | 102–104 (116–118) | Tables exist; footnote 2 "F_e of 87,000 psi for ASTM A36 steel". Steel-main double shear (two wood sides on one steel plate) has no table; equations still apply (§12.3.1 has no restriction) but no fixture — plan's "likely exclude" is reasonable. |
| A25 | Table list: bolts 12A–12I; lags 12J/12K; wood screws 12L/12M; nails 12N–12R; §12.3.2 | §12.3.2; Ch.12 TOC | 83 (97); 73 (87) | Confirmed. Configurations in E11. |

---

## (B) Plan statements WRONG or MISNUMBERED

| # | Plan says | NDS 2018 says | Page |
|---|---|---|---|
| B1 | "C_g: Eq. 12.3-1 ... (Tables 12.3.6A–D are the fixtures); D < 1/4 in → 1.0 (§12.3.6.1)"; "Steel E = 30,000 ksi (Table 12.3.6 basis)" | Group action is **§11.3.6, Eq. 11.3-1, Tables 11.3.6A–D** (Chapter 11). §12.3.6 is "Dowel Bending Yield Strength"; Eq. 12.3-1 is yield Mode I_m; there is no Table 12.3.6. Only 11.3.6A (bolt/lag, wood sides) and 11.3.6C (bolt/lag, steel sides) are dowel-fastener fixtures; 11.3.6B/D are split ring / shear plate. Basis: A: D = 1", s = 4", E = 1,400,000 psi; C: D = 1", s = 4", E_wood = 1,400,000, E_steel = 30,000,000. A fn 2 / C fn 1: tabulated values are conservative for D < 1", s < 4", E > 1.4M. | 68–72 (82–86) |
| B2 | "Steel F_e: §12.3.3.1 — hot-rolled A36 87,000 psi; cold-formed ASTM A653 SS Gr 33 61,850 psi" | §12.3.3.1 only says wood F_e comes from Table 12.3.3. Steel F_e is not in any clause; it appears in Table 12B/12D/12G/12I/12K footnote 2 (87,000, A36, t_s = 1/4") and Table 12K/12M/12P/12T footnote 2 (61,850, A653 Gr 33, t_s < 1/4"), with the derivation in non-mandatory Appendix I.2 (2.4F_u/1.6 and 2.2F_u/1.6). Cite the table footnotes + I.2. §11.2.3 governs metal parts generally. | 96–113 (110–127); 173 (187) |
| B3 | "lag: penetration excluding the tip per §12.1.4.6 / §12.3.5" for l_m | §12.1.4.6 defines only p_min (4D, excluding E). Bearing length is **§12.3.5.3**: "the dowel bearing length, l_s or l_m, shall not exceed the length of fastener penetration, p ... Where p includes the length of a tapered tip, E, the dowel bearing length ... shall not exceed p − E/2. (a) For lag screws, E is permitted to be taken from Appendix L, Table L2. (b) For wood screws, nails, and spikes, E is permitted to be taken as 2D." Resolution in C1. | 85 (99) |
| B4 | "Penetration from L: p = L − t_side (− E for lags)" (single p used for min check, scaling, l_m and withdrawal) | Four different lengths are needed for lags; two for wood screws/nails. See C1 for the exact set. | 74–77, 85 |
| B5 | "toe-nail geometry per §12.1.6.3: l_s = L/3, p = L·cos30° − L/3" | §12.1.6.3 is the driving rule only (30°, L/3). l_s = min(t_s, L/3) is **§12.3.10.2** ("For toe-nailed connections, the minimum of t_s or L/3 shall be used for l_s"). l_m = L cos30° − L/3 is **Commentary Eq. C12.5.4-1** (non-mandatory, Fig. C12.5.4-1), and is a bearing length l_m, not a penetration p. Withdrawal penetration for toe-nails is the vertical projection p_t per Fig. C12.5.4-1. | 88 (102); C 265–266 (279–280) |
| B6 | "W' = W·C_D·C_M·C_t·C_eg·C_tn" applied with C_eg to all three types | For withdrawal, C_eg = 0.75 applies to **lag screws only** (§12.2.1.3, §12.5.2.1). Wood screws (§12.2.2.3) and nails (§12.2.3.3) "shall not be loaded in withdrawal from end grain of wood (C_eg = 0.0)". Plan's out-of-scope note covers this, but the row must hard-fail, not apply 0.67/0.75. | 76–78 (90–92); 91 (105) |
| B7 | "C_tn (0.83 lateral, 0.67 withdrawal)" | Also: "The wet service factor, C_M, shall not apply" to toe-nails in withdrawal (§12.5.4.1; Table 11.3.1 fn 2). Engine must force C_M = 1.0 on W' when toe-nailed. | 91 (105); 66 (80) |
| B8 | "Geometry minima ... Tables 12.5.1A–D — bolts and lags only" | Applicability keys on **D ≥ 1/4"** (§12.5.1.1: D < 1/4" → C_Δ = 1.0; §12.5.1.2/.3 for D ≥ 1/4"), not on fastener type. A No. 14 wood screw (0.242) and SDS (0.242) are exempt; a 1/4" lag is not. Also Table 12.5.1E (lags in withdrawal only, not laterally loaded): edge 1.5D, end 4D, spacing 4D. Nails/wood screws: §12.1.5.7 / §12.1.6.5 "sufficient to prevent splitting" (no numbers; Commentary Table C12.1.5.7 is advisory). | 89–91 (103–105) |
| B9 | "C_Δ = smaller of end-distance and spacing ratios (linear between minimum for reduced and full value)" | §12.5.1.2(a): C_Δ = actual end distance / minimum end distance for C_Δ = 1.0, valid only when actual ≥ minimum for C_Δ = 0.5 (Table 12.5.1A). (c): C_Δ = actual spacing / minimum spacing for C_Δ = 1.0, valid only when actual ≥ "minimum spacing" (3D, Table 12.5.1B). Below those floors the connection is not permitted (Commentary C12.5.1.2: "End distances less than 50 percent ... are not allowed"; "Reduced spacings less than 75 percent ... are not allowed"). Not a linear interpolation between two C_Δ values; it is a straight ratio with a floor. Smallest C_Δ for any fastener applies to the whole group. (b) shear-area branch is for members at an angle to the fastener axis — out of scope, say so. | 89–90 (103–104); C 263–264 (277–278) |
| B10 | "F_yb: Appendix Table I1" (page not given) | Table I1 is on printed p.175 (PDF 189), inside Appendix I.5 "Threaded Fasteners". Appendix I is non-mandatory; the normative F_yb source is the Z-table footnotes (§12.3.6.1). Values match (A3). | 175 (189) |
| B11 | "Table 12J–12N footnotes" for reduced penetration | Footnote 3 of 12J, 12K, 12L, 12M, 12N, **12P** (12P is the nail/steel table; 12O does not exist). | 106–113 (120–127) |
| B12 | "C_Δ ... edge distance below the Table 12.5.1C minimum = FAIL flag" | Correct in effect; note §12.5.1.3 makes edge distance and row spacing (Tables 12.5.1C/D) hard requirements with no C_Δ reduction, and adds: perpendicular-to-grain distance between outermost fasteners ≤ 5" (sawn lumber) unless detailed for shrinkage. | 90 (104) |
| B13 | "Steel member position: bolts/lags none / side / main" | A lag screw with a **steel main member** is not an NDS configuration (threads must be in wood; Tables 12J/12K are wood main only; §12.1.4.2 lead holes). Restrict lags to none/side. Bolts: side (Tables 12B/12D/12G/12I fixtures) or main (equations only, no fixture). | 74 (88); 106–108 (120–122) |

---

## (C) Open questions RESOLVED

### C1. Lag screw penetration, l_m, and "p − E vs p − E/2"
Clause text:
- §12.1.4.6 (p.74/88): "The minimum length of lag screw penetration, p_min, **not including the length of the tapered tip, E**, of the lag screw into the main member of single shear connections and the side members of double shear connections shall be 4D."
- §12.1.5.6 (p.75/89): "The minimum length of wood screw penetration, p_min, **including the length of the tapered tip** where part of the penetration into the main member ... shall be 6D."
- §12.1.6.4 (p.75/89): nails — same wording, "including the length of the tapered tip", 6D.
- §12.3.5.3 (p.85/99): "the dowel bearing length, l_s or l_m, shall not exceed the length of fastener penetration, p, into the wood member. Where p includes the length of a tapered tip, E, the dowel bearing length, l_s or l_m, shall not exceed **p − E/2**. (a) For lag screws, E is permitted to be taken from Appendix L, Table L2. (b) For wood screws, nails, and spikes, E is permitted to be taken as 2D."
- §12.2.1.2 (p.76/90): lag withdrawal "multiplied by the length of thread penetration, p_t, into a wood member, **excluding the length of the tapered tip**."
- §12.2.2.2 (p.76/90): wood screw withdrawal "multiplied by the length of thread penetration, p_t, into the wood member" (no tip exclusion stated).
- §12.2.3.1(c) (p.77/91): nail withdrawal "multiplied by the length of fastener penetration, p_t".
- Table 12J/12K fn 4 (p.106–108): "The length of lag screw penetration, p, not including the length of the tapered tip, E ... shall not be less than 4D." Table header: "p ... equal to 8D" — i.e. the lag tables' p **excludes** E.
- §12.4.1 (p.89/103): combined-load p = "length of thread penetration into the main member"; §12.4.2: "length of fastener penetration into the main member".

Engine rule (with p_tot = L − t_s = physical embedment including the tip):

| Fastener | p_min check | Reduced-penetration factor | l_m (yield eqs) | p_t (withdrawal, lb/in × p_t) | p in Eq. 12.4-x |
|---|---|---|---|---|---|
| Lag | p_tot − E ≥ 4D (§12.1.4.6) | (p_tot − E)/8D if < 8D (12J fn 3, p excl. tip) | p_tot − E/2 (§12.3.5.3; equals p_excl + E/2) | thread in main member excl. tip = min(T, p_tot) − E; Table L2 lists T − E directly (§12.2.1.2) | same as p_t (§12.4.1 "thread penetration") |
| Wood screw | p_tot ≥ 6D (§12.1.5.6, tip included) | p_tot/10D if < 10D (12L fn 3) | p_tot − D (E = 2D, §12.3.5.3(b)) | thread in member = min(T, p_tot), T ≥ max(4D, 2L/3) (Table L3 fn 3); no tip exclusion stated | thread penetration (§12.4.1) |
| Nail | p_tot ≥ 6D (§12.1.6.4, tip included) | p_tot/10D if < 10D (12N/12P fn 3) | p_tot − D (E = 2D) | p_tot (§12.2.3.1(c)) | fastener penetration (§12.4.2) |

So: **neither "p − E" nor "p − E/2" alone is right for lags.** p − E is the code-defined penetration for the 4D check and the p/8D scaling; p − E/2 is the bearing length l_m. For withdrawal the tip is excluded (p − E capped at thread length). Fixture note: every tabulated 12J/12L/12N cell I reproduced is governed by Mode III_s or IV (no l_m term), so the tables cannot discriminate these conventions numerically; the rule is from the clause text. Commentary C12.3.5.3 (p.261/275) confirms the p − E/2 approximation follows TR-12.

### C2. D vs D_r in the yield equations
- §12.3.7.1 (p.85/99): "Where used in Tables 12.3.1A and 12.3.1B, the fastener diameter shall be taken as: (a) D for smooth shank nails and deformed shank nails in accordance with ASTM F1667, (b) D for unthreaded full-body diameter fasteners, and (c) D_r for reduced body diameter fasteners or threaded fasteners except as provided in 12.3.7.2."
- §12.3.7.2: "For threaded full-body fasteners (see Appendix L), D shall be permitted to be used in lieu of D_r where the bearing length of the threads does not exceed 1/4 of the full bearing length in the member holding the threads."
- Appendix I.5 (p.175/189): "Reference lateral design values for reduced body diameter lag screw and rolled thread wood screw connections are based on root diameter, D_r ... For bolted connections, reference tabulated lateral design values are based on diameter, D." Table 12J/12K fn 2: "reduced body diameter" lag screws; 12L/12M fn 2: "rolled thread wood screws".
- Table 12.3.1B fn 1: nominal D ≥ 0.25 with D_r < 0.25 → R_d = K_D K_θ, with K_D evaluated on the Table 12.3.1A/B diameter, i.e. D_r.

Engine rule: nails → D everywhere. Wood screws and lags → D_r in Eq. 12.3-1…12.3-10, in k1/k2/k3, and in K_D; bolts → D. Everything **outside** Tables 12.3.1A/B uses nominal D: Table 12.3.3 F_e column selection and the F_e⊥ √D term, the D < 1/4" tests for C_g (§11.3.6.1), C_Δ (§12.5.1.1), C_M (Table 11.3.3 fn 2), the p_min multiples, the geometry multiples (xD), F_yb bands (Table I1 / fn 2 by D), and the withdrawal equations (D in 12.2-1/-2/-3 is nominal; Table 12.2A/B columns are nominal D / screw number).

Numeric proof (my reproduction, G = 0.50, t_s = 1/2"): 1/4" lag, F_e∥ = 5,600 (nominal-D column), yield D = D_r = 0.173, R_d = (10·0.173 + 0.5)·K_θ = 2.23 → Z∥ = 119.1 vs Table 12J **120**; Z⊥ (K_θ = 1.25, F_e⊥ at D = 1/4 = 4,450) = 82.4 vs **80**. Using D = 0.25 in the yield equations gives 230 (wrong); using 4/3.6/3.2 gives 83 (wrong). No. 10 wood screw (D_r = 0.152, K_D = 2.2, F_e = 4,650, F_yb = 80k) → 89.9 vs Table 12L **90**; with D = 0.190 → 122 (wrong).

### C3. Steel E for C_g
No clause value. Table 11.3.6C header (p.71/85): "E_steel = 30,000,000 psi". Use 30,000,000 psi and cite the table basis. γ = 270,000 D^1.5 for wood-to-metal (§11.3.6.1). For steel side plates A_s = sum of plate gross areas (§11.3.6.3 "gross cross-sectional areas of side members"); table 11.3.6C is indexed by A_m/A_s = 12…50.

### C4. Which E for wood in C_g
§11.3.6.1 defines E_m, E_s as "modulus of elasticity of main/side member, psi" — the reference E (not E_min) of the member's grade. Supplement values in E12. Recommendation: header species dropdown sets G (Table 12.3.3A) and a default E equal to the **No. 2 grade** of that species (DFL 1,600,000; DF-South 1,200,000; HF 1,300,000; SPF 1,400,000; SPF-South 1,100,000; SP 1,400,000), with an editable E cell. Fixture harness passes E = 1,400,000 explicitly to reproduce Tables 11.3.6A/C. C_g is weakly sensitive to E (enters only through u via γs/2·(1/EA)); Table 11.3.6A fn 2 notes values are conservative for E > 1.4M.

### C5. Nails into steel side plates (Table 12P)
Table 12P (p.112–113 / 126–127): "for sawn lumber or SCL with ASTM 653, Grade 33 steel side plate"; fn 2: "F_e of 61,850 psi for ASTM A653, Grade 33 steel and nail bending yield strengths, F_yb, of 100,000 psi for 0.099" ≤ D ≤ 0.142", 90,000 psi for 0.142" < D ≤ 0.177", 80,000 psi for 0.177" < D ≤ 0.236", 70,000 psi for 0.236" < D ≤ 0.273"." **F_yb does not change** with a steel side. Gauge rows: 20 ga 0.036, 18 ga 0.048, 16 ga 0.060, 14 ga 0.075, 12 ga 0.105, 11 ga 0.120, 10 ga 0.134, 7 ga 0.179, 3 ga 0.239 (same list in 12M; 12K lags: 14/12/11/10/7/3 ga A653 plus 1/4" A36). l_s = plate thickness.

### C6. Impact C_D
Table 2.3.2 fn 2 + §11.3.2: C_D ≤ 1.6 for connections; impact does not apply. Confirmed (A15).

### C7. Fixture reproduction results (yield equations vs tables)
| Table / cell | Inputs | Computed | Table |
|---|---|---|---|
| 12A 1/2" bolt, t_m = t_s = 1.5, G = 0.50 | F_e∥ 5,600; F_e⊥ 3,150 (rounded to 50); F_yb 45k; R_d 4/3.6/3.2 (×1.25 for ⊥) | Z∥ 483 (II), Z_s⊥ 298 (II), Z⊥ 217 (II) | 480 / 300 / 220 |
| 12J 1/4" lag, t_s = 1/2, G = 0.50 | see C2 | 119 (III_s) / 82 (III_s) | 120 / 80 |
| 12L No. 10, t_s = 1/2, G = 0.50 | see C2 | 90 (III_s) | 90 |
| 12N 6d/8d/10d/16d common, t_s = 3/4, G = 0.50 | F_e 4,650; K_D 2.2; F_yb 100/100/90/90k; D nominal | 72 / 90 / 105 / 121 | 72 / 90 / 105 / 121 |
| 12N same, t_s = 1 | | 72 (IV) / 97 (IV) / 118 (IV) / 141 (IV) | 72 / 97 / 118 / 141 |
Use Table 12.3.3 F_e rounded to the nearest 50 psi (fn 2) in fixtures; the ±1 lb tolerance in the plan is too tight for the tables (rounded to 10 lb) — use ±0.5 of the table's rounding step (±5 lb for Z tables, ±0.5 lb for 12.2A–C, ±0.005 for C_g).

---

## (D) MISSING from the plan (code requires for these fastener types)

| # | Item | Clause | Page |
|---|---|---|---|
| D1 | **Diameter cap D ≤ 1"**: Table 12.3.1B and Table 12.3.3 are for 0.25" ≤ D ≤ 1"; §11.3.6.1 C_g for D ≤ 1". Reject D > 1". | 84 (98), 86 (100), 68 (82) | |
| D2 | **γ load/slip modulus** for C_g: 180,000 D^1.5 wood-to-wood; 270,000 D^1.5 wood-to-metal. Not in plan. | §11.3.6.1 | 68 (82) |
| D3 | **C_g row definition and staggered rows**: fasteners in adjacent rows staggered with row spacing < 1/4 of the in-row spacing count as one row; even/odd row rules (Fig. 11B). **Perpendicular-to-grain equivalent area** A = thickness × overall width of the fastener group (single row: min parallel-to-grain spacing). Gross areas, no net-section deduction. | §11.3.6.2, §11.3.6.3 | 68 (82) |
| D4 | **Bolt hole size** 1/32" to 1/16" oversize; washers/plates under head and nut (Table L6 cut washers). Notes/flags only. | §12.1.3.2, §12.1.3.3 | 74 (88) |
| D5 | **Lead holes**: lags §12.1.4.2 (shank clearance = shank D; thread lead 65–85 % / 60–75 % / 40–70 % of D by G); not required for ≤ 3/8" lags in withdrawal, G ≤ 0.5 (§12.1.4.3); wood screws §12.1.5.2/.3; nails bored holes ≤ 90 % / 75 % of D (§12.1.6.2). Notes on the printout. | 74–75 (88–89) | |
| D6 | **l/D for edge distance and row spacing**: Table 12.5.1C fn 1 / 12.5.1D fn 1: l/D = lesser of l_m/D (fastener length in wood main member) and total l_s/D (total in wood side members). Parallel edge: 1.5D if l/D ≤ 6, else max(1.5D, ½ row spacing). Perpendicular row spacing: 2.5D (l/D ≤ 2), (5l + 10D)/8 (2 < l/D < 6), 5D (l/D ≥ 6). Plan lists the tables but not the l/D dependency; the row needs l/D. | 91 (105) | |
| D7 | **Max 5" across grain** between outermost fasteners in sawn lumber unless shrinkage detailing (§12.5.1.3); glulam limits Table 12.5.1F. Flag. | 90 (104) | |
| D8 | **Perpendicular-to-grain spacing for C_Δ = 1.0** is "required spacing for attached members" (Table 12.5.1B) — no number. Engine needs a stated rule (e.g. C_Δ(spacing) = 1.0 for perpendicular loading when s ≥ 3D, and the parallel-loaded attached member governs its own spacing check). Also end distance for perpendicular loading 2D/4D and tension-parallel end distance depends on **softwood vs hardwood** (3.5D/7D vs 2.5D/5D) — species data needs a hardwood flag (all six plan species are softwoods; "Custom" needs the flag). | 90 (104) | |
| D9 | **SCL F_e**: §12.3.3.3 — F_e for structural composite lumber from manufacturer/ESR, not Table 12.3.3. "Custom (LSL/LVL/PSL)" must accept typed F_e∥ and F_e⊥ (or equivalent G per the ESR), not only G and E. | 84 (98) | |
| D10 | **Lag/wood screw thread length**: T (Table L2, fn 2: T = min(6", L/2 + 0.5") — table lists T and T − E per L); wood screw T ≥ max(4D, 2L/3), cut thread ≈ 2L/3 (Table L3 fn 2/3). Needed for p_t (C1) and for the §12.3.7.2 D-vs-D_r test if ever offered. Bolts: Table L1 T = 2D + 1/4 (L ≤ 6), 2D + 1/2 (L > 6) — irrelevant since bolts use D. | 180–182 (194–196) | |
| D11 | **Lag/wood screw tensile net section** in withdrawal shall not be exceeded (root D_r) — metal check per §11.2.3; no NDS factors apply. Either add a steel-tension check or flag it. | §12.2.1.4, §12.2.2.5 | 76 (90) |
| D12 | **Metal governs → no wood factors**: when capacity is controlled by metal strength, C_D etc. are not applied (§11.2.3, §11.3.2). Relevant if the engine ever reports a steel-plate bearing/net-section check. | 65–66 (79–80) | |
| D13 | **Table 12.2A/B/C ranges**: equations are valid "within the range of specific gravities, G, and ... diameters, D, given in" the tables: G 0.31–0.73; lags 1/4"–1-1/4"; wood screws No. 6–24; nails 0.092"–0.375". Reject out-of-range. | 76–79 (90–93) | |
| D14 | **Nail C_M** for D < 1/4": lateral C_M = 0.7 when fabricated > 19 % and in-service ≤ 19 % (Table 11.3.3 fn 2), not 0.4; nail **withdrawal** C_M = 0.25 for the mixed cases and 1.0 for wet/wet (Table 11.3.3). Plan's single header C_M cannot represent this; the engine must derive C_M per row from (fastener type, D, load type, MC at fabrication, MC in service). | 67 (81) | |
| D15 | **C_M = 1.0 exception** for D ≥ 1/4" fabricated wet: one fastener, or a single row parallel to grain, or separate splice plates per row (Table 11.3.3 fn 2). Needs row inputs (rows, splice plates). | 67 (81) | |
| D16 | **Multiple shear planes / asymmetric double shear** are out of scope (plan says so): §12.3.8, §12.3.9. **Load at angle to fastener axis** (§12.3.10.1) also out of scope — state it. | 88 (102) | |
| D17 | **Toe-nail withdrawal**: C_M shall not apply (B7); toe-nail p_t is the vertically projected length in the member holding the point (Fig. C12.5.4-1). | 91 (105); C 266 (280) | |
| D18 | **Table 12.5.1E** for lags loaded in withdrawal only (edge 1.5D, end 4D, spacing 4D) — plan's geometry inputs are lateral-only. | 91 (105) | |
| D19 | **Precondition list** §12.3.1(a)–(d): faces in contact, load perpendicular to dowel axis, geometry per 12.5, p ≥ p_min. Print as assumptions. | 83 (97) | |

---

## (E) Data appendix (engine constants, with page cites)

### E1. Table 12.3.3A assigned specific gravities G — sawn species (p.87 / PDF 101)
Alaska Cedar 0.47; Alaska Hemlock 0.46; Alaska Spruce 0.41; Alaska Yellow Cedar 0.46; Aspen 0.39; Balsam Fir 0.36; Beech-Birch-Hickory 0.71; Coast Sitka Spruce 0.39; Cottonwood 0.41; **Douglas Fir-Larch 0.50**; Douglas Fir-Larch (North) 0.49; **Douglas Fir-South 0.46**; Eastern Hemlock 0.41; Eastern Hemlock-Balsam Fir 0.36; Eastern Hemlock-Tamarack 0.41; Eastern Hemlock-Tamarack (North) 0.47; Eastern Softwoods 0.36; Eastern Spruce 0.41; Eastern White Pine 0.36; Engelmann Spruce-Lodgepole Pine 0.38; **Hem-Fir 0.43**; Hem-Fir (North) 0.46; Mixed Maple 0.55; Mixed Oak 0.68; Mixed Southern Pine 0.51; Mountain Hemlock 0.47; Northern Pine 0.42; Northern Red Oak 0.68; Northern Species 0.35; Northern White Cedar 0.31; Ponderosa Pine 0.43; Red Maple 0.58; Red Oak 0.67; Red Pine 0.44; Redwood 0.37; Sitka Spruce 0.43; **Southern Pine 0.55**; **Spruce-Pine-Fir 0.42**; **Spruce-Pine-Fir (South) 0.36**; Western Cedars 0.36; Western Cedars (North) 0.35; Western Hemlock 0.47; Western Hemlock (North) 0.46; Western Juniper 0.42; Western White Pine 0.40; Western Woods 0.36; White Oak 0.73; Yellow Poplar 0.43.
MSR/MEL (right column, same page): DFL E ≤ 1.9M 0.50, 2.0M 0.51, 2.1M 0.52, 2.2M 0.53, 2.3M 0.54, 2.4M 0.55; HF 1.5M 0.43 … 2.4M 0.52 (+0.01 per 100 ksi); SP ≤ 1.7M 0.55, ≥ 1.8M 0.57; SPF ≤ 1.7M 0.42, 1.8–1.9M 0.46, ≥ 2.0M 0.50; SPF(S) ≤ 1.1M 0.36, 1.2–1.9M 0.42, ≥ 2.0M 0.50; DF-South all 0.46.
Hardwood flag (for Table 12.5.1A tension end distance): Beech-Birch-Hickory, Mixed Maple, Mixed Oak, Northern Red Oak, Red Maple, Red Oak, White Oak, Yellow Poplar, Aspen, Cottonwood are hardwoods; the six plan species are softwoods.

### E2. Table I1 F_yb (p.175 / PDF 189)
Bolt, lag screw D ≥ 3/8", drift pin (SAE J429 Gr 1): 45,000. Common/box/sinker nail, spike, lag screw, wood screw (low–medium carbon): 0.099 ≤ D ≤ 0.142 → 100,000; 0.142 < D ≤ 0.177 → 90,000; 0.177 < D ≤ 0.236 → 80,000; 0.236 < D ≤ 0.273 → 70,000; 0.273 < D ≤ 0.344 → 60,000; 0.344 < D ≤ 0.375 → 45,000. Hardened nails incl. post-frame RS: 0.120–0.142 → 130,000; 0.142–0.192 → 115,000; 0.192–0.207 → 100,000. Bands are on nominal D.

### E3. Table L1 hex bolts (p.180 / PDF 194)
D: 1/4, 5/16, 3/8, 1/2, 5/8, 3/4, 7/8, 1. D_r: 0.189, 0.245, 0.298, 0.406, 0.514, 0.627, 0.739, 0.847. T (L ≤ 6): 3/4, 7/8, 1, 1-1/4, 1-1/2, 1-3/4, 2, 2-1/4; (L > 6): 1, 1-1/8, 1-1/4, 1-1/2, 1-3/4, 2, 2-1/4, 2-1/2. (7/16" is not in L1; Table 12.3.3 does list 7/16.)

### E4. Table L2 hex lag screws (p.181 / PDF 195)
| D | 1/4 | 5/16 | 3/8 | 7/16 | 1/2 | 5/8 | 3/4 | 7/8 | 1 | 1-1/8 | 1-1/4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D_r | 0.173 | 0.227 | 0.265 | 0.328 | 0.371 | 0.471 | 0.579 | 0.683 | 0.780 | 0.887 | 1.012 |
| E (tip) | 5/32 | 3/16 | 7/32 | 9/32 | 5/16 | 13/32 | 1/2 | 19/32 | 11/16 | 25/32 | 7/8 |
| N (thr/in) | 10 | 9 | 7 | 7 | 6 | 5 | 4-1/2 | 4 | 3-1/2 | 3-1/4 | 3-1/4 |
T (min thread length) by L: L=1: 3/4; 1-1/2: 1-1/4; 2: 1-1/2; 2-1/2: 1-3/4; 3: 2; 4: 2-1/2; 5: 3; 6: 3-1/2; 7: 4; 8: 4-1/2; 9: 5; 10: 5-1/2; 11: 6; 12: 6. S = L − T. Fn 2: T = min(6, L/2 + 0.5); threads may extend up to full L. Fn 1: reduced-body shank ≈ D_r. Available D by L: L ≤ 1-1/2: 1/4–1/2; L = 2–2-1/2: 1/4–5/8; L = 3: 1/4–1; L ≥ 4: all.

### E5. Table L3 wood screws (p.182 / PDF 196)
| No. | 6 | 7 | 8 | 9 | 10 | 12 | 14 | 16 | 18 | 20 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D | 0.138 | 0.151 | 0.164 | 0.177 | 0.190 | 0.216 | 0.242 | 0.268 | 0.294 | 0.320 | 0.372 |
| D_r | 0.113 | 0.122 | 0.131 | 0.142 | 0.152 | 0.171 | 0.196 | 0.209 | 0.232 | 0.255 | 0.298 |
| D_H | 0.262 | 0.287 | 0.312 | 0.337 | 0.363 | 0.414 | 0.480 | 0.515 | 0.602 | 0.616 | 0.724 |
Fn 2: cut-thread T ≈ 2L/3. Fn 3: T ≥ max(4D, 2L/3). Fn 6: tip E = 2D. Tables 12L/12M cover No. 6–14 only; Table 12.2B covers No. 6–24.

### E6. Table L4 nails (p.182 / PDF 196) — D / L / H
| | 6d | 7d | 8d | 10d | 12d | 16d | 20d | 30d | 40d | 50d | 60d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Common D | 0.113 | 0.113 | 0.131 | 0.148 | 0.148 | 0.162 | 0.192 | 0.207 | 0.225 | 0.244 | 0.263 |
| Common L | 2 | 2-1/4 | 2-1/2 | 3 | 3-1/4 | 3-1/2 | 4 | 4-1/2 | 5 | 5-1/2 | 6 |
| Box D | 0.099 | 0.099 | 0.113 | 0.128 | 0.128 | 0.135 | 0.148 | 0.148 | 0.162 | – | – |
| Box L | 2 | 2-1/4 | 2-1/2 | 3 | 3-1/4 | 3-1/2 | 4 | 4-1/2 | 5 | – | – |
| Sinker D | 0.092 | 0.099 | 0.113 | 0.120 | 0.135 | 0.148 | 0.177 | 0.192 | 0.207 | – | 0.244 |
| Sinker L | 1-7/8 | 2-1/8 | 2-3/8 | 2-7/8 | 3-1/8 | 3-1/4 | 3-3/4 | 4-1/4 | 4-3/4 | – | 5-3/4 |
Head H (common): 0.266, 0.266, 0.281, 0.312, 0.312, 0.344, 0.406, 0.438, 0.469, 0.500, 0.531. Fn 2: tip E = 2D.

### E7. Steel side plates (Tables 12K/12M/12P fn 2, p.108–113 / PDF 122–127; Appendix I.2 p.173 / PDF 187)
A36, t = 1/4": F_e = 87,000 psi. A653 SS Gr 33, t < 1/4": F_e = 61,850 psi. Gauges: 20 → 0.036, 18 → 0.048, 16 → 0.060, 14 → 0.075, 12 → 0.105, 11 → 0.120, 10 → 0.134, 7 → 0.179, 3 → 0.239 (12M/12P all nine; 12K: 14/12/11/10/7/3 + 1/4" A36). E_steel = 30,000,000 psi (Table 11.3.6C). γ_wood-metal = 270,000 D^1.5.

### E8. Table 11.3.3 C_M (p.67 / PDF 81)
Lateral, dowel-type: fab ≤ 19 % / in-service ≤ 19 % → 1.0; fab > 19 % / ≤ 19 % → 0.4 (fn 2: 0.7 for D < 1/4"; 1.0 if one fastener, or one row parallel to grain, or separate splice plates per row); any / > 19 % → 0.7. Withdrawal, lag & wood screws: any / ≤ 19 % → 1.0; any / > 19 % → 0.7. Withdrawal, nails: ≤19/≤19 → 1.0; >19/≤19 → 0.25; ≤19/>19 → 0.25; >19/>19 → 1.0 (fn 3: RSRS/PF ring shank 1.0). Toe-nail withdrawal: C_M not applied (§12.5.4.1).

### E9. Table 11.3.4 C_t (p.67 / PDF 81)
T ≤ 100 °F: 1.0; 100 < T ≤ 125: dry 0.8, wet 0.7; 125 < T ≤ 150: dry 0.7, wet 0.5.

### E10. Geometry (D ≥ 1/4" only), Tables 12.5.1A–E (p.90–91 / PDF 104–105)
- **12.5.1A end distance** (min for C_Δ = 0.5 / for C_Δ = 1.0): perpendicular to grain 2D / 4D; parallel compression (bearing away from end) 2D / 4D; parallel tension (bearing toward end) softwoods 3.5D / 7D, hardwoods 2.5D / 5D.
- **12.5.1B spacing in a row** (minimum / for C_Δ = 1.0): parallel 3D / 4D; perpendicular 3D / "required spacing for attached members".
- **12.5.1C edge distance** (hard minimum): parallel, l/D ≤ 6: 1.5D; l/D > 6: greater of 1.5D or ½ row spacing; perpendicular: loaded edge 4D, unloaded edge 1.5D. Fn 1: l/D = lesser of l_m/D and total l_s/D. Fn 2: no heavy/medium concentrated loads hung below the neutral axis without reinforcement.
- **12.5.1D spacing between rows** (hard minimum): parallel 1.5D; perpendicular: l/D ≤ 2: 2.5D; 2 < l/D < 6: (5l + 10D)/8; l/D ≥ 6: 5D. Same l/D definition.
- **12.5.1E lags in withdrawal only**: edge 1.5D, end 4D, spacing 4D.
- **C_Δ rule** (§12.5.1.2): C_Δ = actual / (minimum for C_Δ = 1.0), permitted only when actual ≥ the C_Δ = 0.5 end distance or ≥ 3D spacing; take the smallest C_Δ over (a) end distance and (c) spacing, apply to all fasteners in the group; D < 1/4" → 1.0 (§12.5.1.1).
- Toe-nail: §12.1.6.3 30°, L/3 from end; §12.3.10.2 l_s = min(t_s, L/3); Commentary C12.5.4-1 l_m = L cos30° − L/3.

### E11. Z-table configurations for fixtures (Ch.12 p.94–117 / PDF 108–131)
| Table | Fastener | Config | Columns | Basis |
|---|---|---|---|---|
| 12A | bolts | single shear, sawn/SCL, both members same G; t_s = 1-1/2 … | Z∥, Z_s⊥, Z_m⊥, Z⊥ | F_yb 45,000, full-body D |
| 12B | bolts | single shear, sawn/SCL main + 1/4" A36 side | Z∥, Z⊥ | F_e 87,000 |
| 12C | bolts | single shear, glulam main + sawn side same G | Z∥, Z_s⊥, Z_m⊥, Z⊥ | |
| 12D | bolts | single shear, glulam main + 1/4" A36 side | Z∥, Z⊥ | |
| 12E | bolts | single shear, wood side on concrete main (F_e 7,500 psi, 6" embed) | Z∥, Z⊥ | out of scope |
| 12F | bolts | double shear, sawn/SCL, all same G | Z∥, Z_s⊥, Z_m⊥ | |
| 12G | bolts | double shear, sawn/SCL main + 1/4" A36 sides | Z∥, Z⊥ | |
| 12H | bolts | double shear, glulam main + sawn sides | Z∥, Z_s⊥, Z_m⊥ | |
| 12I | bolts | double shear, glulam main + 1/4" A36 sides | Z∥, Z⊥ | |
| 12J | lags | single shear, sawn/SCL, same G, p = 8D, t_s = 1/2 … 3-1/2 | Z∥, Z_s⊥, Z_m⊥, Z⊥ | reduced-body (D_r); F_yb 70/60/45k |
| 12K | lags | single shear, A653 Gr 33 side (t_s < 1/4) or A36 (1/4), p = 8D | Z∥, Z⊥ | F_e 61,850 / 87,000 |
| 12L | wood screws No. 6–14 | single shear, sawn/SCL, same G, p = 10D, t_s = 1/2, 5/8, 3/4, 1, 1-1/4, 1-1/2 | Z | rolled thread (D_r) |
| 12M | wood screws | single shear, A653 Gr 33 side (20–3 ga), p = 10D | Z | |
| 12N | common/box/sinker nails | single shear, sawn/SCL, same G, p = 10D; t_s blocks incl. 3/4, 1, 1-1/4, 1-1/2 …; "(N)" fn 4 = length insufficient for 10D | Z | D nominal; F_yb by band |
| 12P | nails | single shear, A653 Gr 33 side (20–3 ga), p = 10D | Z | F_e 61,850 |
| 12Q/12R | nails | WSP side G = 0.50 / 0.42 | Z | out of scope |
| 12S/12T | post-frame RS nails | wood / A653 side | Z | out of scope |
G columns in 12A/12J/12L/12N: 0.67, 0.55, 0.50, 0.49, 0.46, 0.43, 0.42, 0.37, 0.36, 0.35 (12A also 0.55/0.50/0.49/0.46/0.67 … per page). Withdrawal fixtures: Table 12.2A lags (G 0.31–0.73 × D 1/4–1-1/4), 12.2B wood screws (No. 6–24), 12.2C nails (0.092–0.375) — p.77–79 / PDF 91–93. C_g fixtures: Table 11.3.6A (A_s/A_m 0.5 and 1; A_s 5–64; n 2–12) and 11.3.6C (A_m/A_s 12–50; A_m 5–200) — p.70–71 / PDF 84–85.

### E12. Supplement E (reference modulus, psi) — Table 4A (PDF p.42–45) and Table 4B (PDF p.48)
| Species (G) | SS | No.1&Btr | No.1 | No.2 | No.3 / Stud | Constr | Std | Util |
|---|---|---|---|---|---|---|---|---|
| Douglas Fir-Larch (0.50) | 1,900,000 | 1,800,000 | 1,700,000 | 1,600,000 | 1,400,000 | 1,500,000 | 1,400,000 | 1,300,000 |
| Douglas Fir-South (0.46) | 1,400,000 | – | 1,300,000 | 1,200,000 | 1,100,000 | 1,200,000 | 1,100,000 | 1,000,000 |
| Hem-Fir (0.43) | 1,600,000 | 1,500,000 | 1,500,000 | 1,300,000 | 1,200,000 | 1,300,000 | 1,200,000 | 1,100,000 |
| Spruce-Pine-Fir (0.42) | 1,500,000 | – | 1,400,000 (No.1/No.2) | 1,400,000 | 1,200,000 | 1,300,000 | 1,200,000 | 1,100,000 |
| Spruce-Pine-Fir (South) (0.36) | 1,300,000 | – | 1,200,000 | 1,100,000 | 1,000,000 | 1,000,000 | 900,000 | 900,000 |
| Southern Pine, 2–4" thick, all widths (0.55) | 1,800,000 (Dense SS 1,900,000; Non-Dense SS 1,600,000) | – | 1,600,000 (Dense 1,800,000; ND 1,400,000) | 1,400,000 (Dense 1,600,000; ND 1,300,000) | 1,300,000 | 1,400,000 | 1,200,000 | 1,200,000 |
Recommended default for C_g: No. 2 (bold column) with an editable cell; fixtures use 1,400,000 (Table 11.3.6 basis).

### E13. Misc constants
- K_θ = 1 + 0.25(θ/90); K_D = 2.2 (D ≤ 0.17"), 10D + 0.5 (0.17 < D < 0.25) — Table 12.3.1B p.84 (98).
- C_eg: lateral 0.67 (§12.5.2.2); lag withdrawal 0.75 (§12.2.1.3); wood screw / nail withdrawal from end grain prohibited (§12.2.2.3, §12.2.3.3).
- C_di = 1.1 (§12.5.3); C_tn = 0.83 Z / 0.67 W (§12.5.4).
- Bolt hole oversize 1/32"–1/16" (§12.1.3.2).
- 12.1.6.4 exception: clinched double-shear nails D ≤ 0.148, side ≥ 3/8", extend ≥ 3D — not needed.
