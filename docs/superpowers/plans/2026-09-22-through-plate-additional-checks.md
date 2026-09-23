# Through-Plate Calc — Block Shear, HSS Column Checks, Plate-to-HSS Weld (Plan)

Target: `public/Calcs/through_plate_calculator.html` (as of b3417ae, bolted + welded attachment).
Test: `tools/test-through-plate.mjs` (Playwright, fallback shapes W16X57 / HSS20X12X1/2, 17 checks).
Pattern to borrow: `window.FPHSS` engine + in-page fixtures in `flange_plated_HSS_column_moment_connection_calculator.html`.

Status: PLAN ONLY, **Revision 1** (2026-09-22, after the independent verification appended at the end; see "Revision 1" for the correction list). No calc code changed. Nick's decisions are collected in §10.

Page references: DG24 = *AISC Design Guide 24* PDF, cited as **DG24 p.N (idx I)** where N is the printed page and I the 0-based PDF index (N = I − 6). 360-22 = *ANSI/AISC 360-22* PDF, cited as **360-22 16.1-N (idx I)**.

---

## 1. What the page promises vs. what applies

The results footer says: *"Complete design requires additional limit state checks including block shear, HSS wall plastification (Chapter K limits of applicability), and the plate-to-HSS weld."* After reading Ex. 4.2 and Table 7-2, the honest resolution is:

| Promised | Verdict for a through-plate FR connection (HSS cut and spliced at each plate) | Section |
|---|---|---|
| Block shear | **Applies.** Ex. 4.2 checks two patterns (plate, beam flange). Welded mode needs a different (smaller) set. | §2 |
| HSS wall plastification | **Does not apply.** Table 7-2's "HSS Wall Plastification" rows are for *longitudinal* plates bearing on a continuous HSS face (DG24 p.80–81, idx 86–87). Here the plate is *transverse* to the column axis and the HSS is cut; there is no HSS face loaded out-of-plane. The Chapter K face-plate rows (local yielding of plate through B_e, punching, sidewall yielding/crippling, Q_f) and the Table 7-2A / K1.3 limits of applicability are moot for the same reason. What *does* remain on the column side is (a) an optional cap-plate-type bearing check when the HSS above and below are not the same size, and (b) panel-zone shear in the HSS segment between the plates — which DG24 does not check and which is a judgment call. | §3 |
| Plate-to-HSS weld | **Applies**, and DG24 gives the procedure explicitly (p.44–45, idx 50–51). K5 / Table K5.1 effective lengths do **not** apply (they are for welds to the *face* of a continuous HSS; this is a full-perimeter end weld, every inch bears). | §4 |

Recommendation: replace the footer sentence with the actual row set below and a one-line "not applicable" note for wall plastification, so the page stops promising a check that has no physical meaning here.

---

## 2. Check A — Block shear rupture (AISC 360-22 §J4.3, Eq. J4-5)

**Code:** R_n = 0.60 F_u A_nv + U_bs F_u A_nt ≤ 0.60 F_y A_gv + U_bs F_u A_nt; φ = 0.75, Ω = 2.00 (360-22 16.1-146, idx 213). U_bs = 1.0 (tension uniform in all patterns below; DG24 states this on p.43 and p.44).

**Demand:** the plate force R_u / R_a already computed (Step 3), same as every other plate-side row.

### 2.1 Bolted mode — Ex. 4.2 patterns (DG24 p.43–44, idx 49–50)

Geometry (Fig. 4-4 / text p.41–44): n_L bolt lines across the plate width at gage g (Ex. 4.2: 2 lines, g = 3½ in from Table 1-1 for W16X57), n bolts per line at spacing s (5 @ 3.00), first bolt 3.00 in from the HSS face, plate end edge distance L_e,p = **1¾ in** (the "1w" glyph; confirmed by Lgv = 1¾ + 4(3.00) = 13.75 and by the 53.5 in plate length = 2[1¾ + 5(3.00)] + 20.0 on p.43), beam-end edge distance L_e,b = **2 in** (p.42 and p.44).

Hole for net areas: d_h = standard hole + 1/16 in (B4.3b). The calc already has `holeSize` (1 3/16 in for a 1 in bolt under 360-22 Table J3.3). DG24 (2010) used the 360-10 standard hole 1 1/16 in → 1⅛ in net. See §7 for the consequence.

**A1 — Plate, interior block (Ex. 4.2, governs at 14 in width).** Shear along both outer bolt lines from the plate end, tension across the gage between the two lines nearest the HSS.
- L_gv = L_e,p + (n − 1)s; A_gv = 2 L_gv t_p; A_nv = A_gv − 2(n − ½) d_h t_p
- A_nt,int = [(n_L − 1)g − (n_L − 1) d_h] t_p   (n_L = 2 → (g − d_h) t_p)

**A2 — Plate, exterior blocks.** Same shear planes; tension from each outer line to the plate edge. A_nt,ext = [w_p − (n_L − 1)g − d_h] t_p. Governs when w_p < 2g (narrow plates) — not in Ex. 4.2 but a real case, so compute both and take min. Requires (n_L − 1)g + d_h < w_p (else input error).

**A3 — Beam flange, tips block (Ex. 4.2).** Shear along the bolt lines from the beam end, tension from the outer lines to the flange tips: L_gv = L_e,b + (n − 1)s; A_gv = 2 L_gv t_f; A_nv = A_gv − 2(n − ½) d_h t_f; A_nt = [b_f − (n_L − 1)g − d_h] t_f. Requires (n_L − 1)g + d_h < b_f.
The *interior* pattern is not a free block on the flange — the web sits under it — so it is not checked (say so in the detail panel). This matches DG24, which uses the tips pattern for the flange and the interior pattern for the plate.

**n_L = 3 or 4 lines (calc allows them):** A1/A2/A3 above generalize with (n_L − 1)g as the outer-line spread. Also check the *sub-block between adjacent lines* with proportional demand 2R/n_L against A_nt = (g − d_h)t (same shear planes). Report the governing D/C. Flag in the panel that Ex. 4.2 verifies only n_L = 2.

**Rows:** "Plate Block Shear (bolted)" with the governing pattern named in the capacity cell; "Beam Flange Block Shear (bolted)".

### 2.2 Welded mode — J4.3 along weld lines

Welds are two longitudinal fillets of length l_w per plate per side (existing `W.lw`), at the flange edges when w_p > b_f, at the plate edges when w_p ≤ b_f (existing `W.onFlange`).

**A4 — Plate block, welds on the flange edges (w_p > b_f).** Block = plate strip between the two weld lines, bounded at the beam end: A_gv = A_nv = 2 t_p l_w; A_nt = b_f t_p (U_bs = 1). Valid free block (Comm. Fig. C-J4.2 welded case). R_n is the min of both J4-5 sides; with no holes the yield side 0.6F_y(2t_p l_w) + F_u b_f t_p is the smaller for A36/A572, so the block governs over plate rupture F_u w_p t_p only when 1.2(F_y/F_u) l_w + b_f < w_p (A36: 0.745 l_w + b_f < w_p), i.e. short welds. Let the numbers speak in the panel; cheap; include. (C7)
**Plate, welds on the plate edges (w_p ≤ b_f):** block = whole plate = J4.1(b) rupture already shown → row N/A with note.
**Beam flange, welded:** no free block exists (the strip under the plate is tied to the web; nothing lies outboard of edge welds). J4-4 flange shear rupture at the welds (already implemented) is the governing flange element check, exactly as Design Example II.B-2 does → row N/A with note. Not a code omission; document it.

### 2.3 New inputs (bolted section)
| id | label | default | Ex. 4.2 |
|---|---|---|---|
| `boltGage` | Gage g between bolt lines (in) | 3.5 | 3½ (Table 1-1 W16X57) |
| `beamEndDist` | Beam-end edge distance L_e,b (in) | 2.0 | 2 |
| `firstBoltDist` | HSS face to first bolt (in) | 3.0 | 3.00 (p.41) |
| `edgeDist` (existing) | Plate end edge distance | **1.25 → recommend 1.75** | 1¾ |
| `boltDiameter` (existing) | Bolt diameter | **¾ in (no `selected`) → recommend 1 in** | 1 |

`edgeDist` = 1.25 does not reproduce Ex. 4.2 (bearing L_c = 1.22 in on p.41 needs 1¾ − 17/32). The `boltDiameter` select has no `selected` attribute, so the page opens on ¾ in, not the "Example 4.2 Default" 1 in option (C2). Changing either default changes existing rows and test expectations — Nick's call (§10 Q1).

**Wiring of `beamEndDist` beyond block shear (C4):** `bearingRn(tEl, FuEl)` (line ~1310) uses `edgeDist` for the end-bolt L_c on **both** the plate and the flange. Extend it to `bearingRn(tEl, FuEl, LeEl)` and pass `edgeDist` for the plate, `beamEndDist` for the flange (DG24 p.42: flange L_c = 2 − 17/32 = 1.47 in, R_n end = 82.0 kips). With the page defaults the plate still governs the min, so the existing bearing expectation only moves if the defaults move.

**`firstBoltDist` (C3):** needed for the J4.4 plate-compression length in bolted mode (§3.4) and lets the bolted plate projection be derived: projection = firstBoltDist + (n − 1)s + edgeDist = 3 + 12 + 1.75 = 16.75 in, which is the welded-mode `plateExt` default — show the derived value read-only in the bolted section so the two modes stay consistent.

---

## 3. Check B — "HSS wall plastification" → what the column actually needs

### 3.1 Not applicable (state it on the page)
- **Chord/HSS wall plastification** — Table 7-2 "Longitudinal Plate" and "Longitudinal Through-Plate" rows (Eq. K1-9 / 2×K1-9 form; DG24 p.80–81, idx 86–87). Plate must be longitudinal on a continuous HSS face. Here the HSS is cut and the plate is transverse. N/A.
- **Transverse-plate face rows** (local yielding through B_e Eq. K1-1, punching Eq. K1-2/K1-3, sidewall yielding/crippling/buckling; 360-22 §K1.2a 16.1-159 idx 226; DG24 Table 7-2 p.80 idx 86) — the plate does not bear on a face. N/A. Hence **Table 7-2A / K1.3 limits of applicability** (B/t ≤ 35, F_y ≤ 52, F_y/F_u ≤ 0.8; 360-22 16.1-160 idx 227) are not a gate for any row in this calc. Do not add them as a check; a one-line note is enough.

### 3.2 Applies — column axial force through the plate (cap-plate model), conditionally
DG24 Table 7-2 "Cap-Plate Connections, under Axial Load" (p.81, idx 87): local yielding of sidewalls R_n = 2F_y t(5t_p + N) for 5t_p + N < B, R_n = A F_y for 5t_p + N ≥ B (φ 1.00 / Ω 1.50); local crippling R_n = 1.6t²[1 + 6N/B (t/t_p)^1.5]√(EF_y t_p/t) for 5t_p + N < B (φ 0.75 / Ω 2.00). 360-22 routes this through §K2.3 → Chapter J (16.1-160, idx 227: "l_b ... measured across the width of the HSS in the case of loaded cap plates"), i.e. J10.2 / J10.3 forms (16.1-151, idx 218).

Interpretation: with the **same HSS aligned above and below** (Ex. 4.2), the wall force passes wall-to-wall through t_p in direct bearing — no dispersion, no local yielding/crippling issue; the member check is the column design, not the connection. The check only has content when the HSS above is a **different size** (then the larger segment sees the smaller one's walls as a line load N = t_above dispersed 2.5:1 through t_p) or when the plate is a **column top** with a bearing load.

The select `colAbove` = *same HSS, column continuous* (default, Ex. 4.2) / *different HSS above* / *none — top of column* is now **Phase 1** because §4.1 (C1) needs it for the weld moment split. In Phase 1 the cap-plate rows render N/A with a note for all three values; **Phase 2** adds the bearing rows behind the *different HSS* value (inputs `aboveB`, `aboveH`, `aboveT`) and a bearing-load case for *none*. Judgment: §10 Q2.

### 3.3 Applies — HSS panel-zone shear between the plates (judgment; DG24 silent)
The unbalanced flange force enters each plate as an in-plane horizontal force ΔR = (M_right − M_left)·12/(d + t_p) (Ex. 4.2: (360 − 72)(12)/17.025 = **203 kips** LRFD) and must go into the HSS segment between plates as shear — the panel zone of an FR connection. The two H-walls (parallel to the beam) resist it: J10.6 analogue R_n = 0.60 F_y (2 H t) with φ 0.90 / Ω 1.67 (Eq. J10-9 form, 16.1-154 idx 221), reduce per Eq. J10-10 when αP_r > 0.4 P_y (needs A_g of the HSS: 28.3 in² from the DB, add to fallback). Ex. 4.2: 0.6·46·2·20·0.465 = 513 kips, φR_n = 462 kips, D/C = 0.44. DG24 does not check this. Recommend one **informational/optional row** "HSS Panel-Zone Shear (J10.6 analogue, beyond DG24)" with a toggle default ON; note the column shear V_col is neglected (conservative). §10 Q3.

Note on the *segment* row vs the *weld* share (J3): the panel-zone row itself always uses the full ΔR (the segment between the plates is the panel zone whatever sits above). How much of ΔR the plate-to-HSS *weld* sees is the §4.3 question.

### 3.4 Cheap bonus — plate compression J4.4 (Ex. 4.2 p.40, idx 46)
r = t_p/√12, L_c = `firstBoltDist` (bolted; Ex. 4.2 3.00 in → L_c/r = 16.6, DG24 16.7 with r rounded to 0.180, < 25 → P_n = F_y A_g) or the unwelded length to the start of the flange weld (welded: `setback + weldSize`). (C3: no HSS-face-to-first-bolt input exists today in bolted mode; `plateExt` lives in the hidden weld section.) When ≤ 25 the row equals the yield row; when > 25 use Chapter E (reuse `FPHSS.plateFcr`). One row, ~30 lines. Include in scope since the page says "complete design".

---

## 4. Check C — Plate-to-HSS weld (DG24 Ex. 4.2 p.44–45, idx 50–51; 360-22 §J2.4)

### 4.1 Model
Full-perimeter fillet weld between each through-plate face and the HSS end it caps. Treat the weld as a line group with the HSS perimeter: A_w = 2(B + H)·t_throat; I about the axis parallel to B (moment from the beams bends the column about that axis, extreme fibre at H/2): I = [2H³/12 + 2B(H/2)²]·t_throat (DG24 rounds 3,733 to 3,730 in⁴ per in throat and notes the throat is neglected in the (H/2)² term — reproduce this exactly).
**Moment convention (C1 — the load-bearing correction of this revision).** DG24's ΣM_A on p.39 (idx 45) reads 360 − 72 − **2M_uconn** + (20/2)/12·(48.0 − 9.60) = 0 → M_uconn = **160 kip-ft is the moment in each column segment**, i.e. an equal split of the 320 kip-ft joint unbalance between the HSS above and below (ASD 100 of 200). The calc's `Mu_conn` (line ~1250, `Mu_right − Mu_left + (H/2)(Vu_right − Vu_left)/12`) is the **total** 320 (ASD 200). Feeding 320 into the DG24 weld model gives 15.7 kips/in, D_req 11.3 → ¾ in, D/C 1.41 with ½ in — the fixture would fail and the ½ in answer in the book would look wrong. So:
- `TPC.hssWeld` takes a **per-segment** moment M_seg = share × M_conn,total, with the share set explicitly by `colAbove` (§3.2): *same HSS, continuous* → ½ (DG24 Ex. 4.2; assumes equal stiffness/story heights above and below — say so); *different HSS above* → ½ as well (stiffness-weighted split is Phase 2 if Nick wants it); *none — top of column* → 1.0 (100 % to the segment below). Never halve silently: a column-top through-plate designed with M/2 is 2× unconservative.
- Keep P on the weld = P_conn (346 kips), the axial force below the bottom plate — the maximum any plate-to-HSS weld sees, conservative for the top plate; DG24 does the same.
- Relabel the existing Step 2 display (line ~1466) "M_u,conn — total joint unbalanced moment" and add a line "per column segment (colAbove = …): M_u,seg = 320 × ½ = 160 kip-ft".

Demand per inch (LRFD): f_u = P_u,conn/(A_w/t) + M_u,seg(12)(H/2)/(I/t) = 346/64.0 + 160·12·10/3,733 = 5.41 + 5.14 = **10.5 kips/in** (DG24 10.6 from the rounded I). ASD: 232/64.0 + 100·12·10/3,733 = **6.84 kips/in**.
"On the compression side where they are additive": both terms are compressive on the far wall; the peak resultant is the design value.

**Is the existing R_u screen affected?** R_u = M_max·12/(d + t_p) with M_max = max(|M_u,right|, |M_u,left|, |M_u,conn|). In Ex. 4.2 M_max = 360 (beam-end moment) and R_u = 254 — unaffected. The plate force is physically the beam-end moment divided by the plate lever arm; DG24 uses M_right only. Including the **total** M_conn in the max is conservative (it can exceed the larger beam moment only when the shear-eccentricity term (H/2)(ΔV)/12 is large relative to M_right − M_left, and that term enters the column through the shear tabs, not the flange plates). It is **not a bug**; it is a conservative screen that should stay as-is (total, not segment — using the segment value there would weaken a screen that already does no harm). Recommend: leave the R_u formula alone, relabel the displayed M_conn as above, and note it in the panel. §10 Q8 lets Nick drop the term if he prefers DG24's literal M_right.
Required size D ≥ f_u/(φ·0.60 F_EXX·0.707/16) — Ex. 4.2: 10.6/1.392 = 7.61 → ½ in (ASD 6.84/0.928 = 7.37 → ½ in). The calc has a user weld size and reports D/C = f_u / φr_n with φr_n = 0.75·0.6·F_EXX·0.707·(D/16) (Ex. 4.2, ½ in: 11.14 kips/in → D/C 0.947 LRFD, 0.921 ASD) plus D_req in the panel.

### 4.2 K5 does not apply
Table K5.1 (16.1-171–172, idx 238–239) effective lengths are for welds to the *face* of a continuous rectangular HSS (transverse plate l_e = 2B_e etc.). A cap/through-plate end weld bears uniformly around the cut perimeter; use the elastic A_w / I approach.

### 4.3 Companion checks
- **HSS wall base metal** — Manual Eq. 9-2 single fillet t_min = 3.09 D/F_u,HSS (Ex. 4.2: 3.09·8/58 = 0.426 ≤ 0.465 OK), or equivalently J4.2(b) 0.6 F_u t per inch vs the weld. One row, reuse the existing `tminF` code shape.
- **Plate base metal** — loaded through-thickness by the two welds (HSS above on one face, below on the other): not a shear-rupture-along-an-edge geometry; **no J4 row**. Per verifier J5, print one informational line t_min = 3.09D/F_u,p ≤ t_p (Ex. 4.2: 0.426 ≤ 0.625) in the weld panel to pre-empt the reviewer question.
- **J2.2b limits** — Table J2.4 minimum by thinner part (HSS wall 0.465 → 3/16 in); no J2.2b(b) edge maximum (the weld sits at the end of the wall against the plate face, not along an edge); minimum length 4w trivially met.
- **Geometry** — plate must overhang the HSS to receive the fillet along the H-walls: require w_p ≥ B + 2w (Ex. 4.2 uses 14 in "to permit fillet welding to the HSS", p.39). Error if violated.
- **Optional (judgment, §10 Q4)** — vector-add the in-plane panel-zone shear of §3.3 on the two H-walls. DG24 omits this component. Toggle `weldIncludePZ` default OFF (so the DG24 fixture reproduces) with the alternative shown in the panel either way. **[Re-verification edit — J3 retracted, planner's free body upheld.]** The share of ΔR on the weld does **not** follow `colAbove`. Free body of a plate: ΔR = V_pz (into the segment between the plates) + V_col (story shear in the adjacent column, ≈ M_seg/(h/2) ≈ 160/6.5 ≈ 25 kips for a 13 ft story). The two plates load the segment with an equal-and-opposite couple, so the plate-to-**segment** weld carries ≈ ΔR − V_col ≈ 178 kips whether or not a column continues above; the plate-to-column-above weld carries only V_col. The governing weld is bottom-plate-to-segment (P = P_conn 346, M = M_seg, V = V_pz): with V_col ≈ 25, f_v = 178/40 = 4.45, √(10.55² + 4.45²) = 11.45 → D/C **1.03**; with V_col neglected (the calc does not know the story height), f_v = 203/40 = 5.07, √(10.55² + 5.07²) = 11.7 → D/C **1.05**. Implement `pzShare` = **1.0 always** (full ΔR, conservative); a `Vcol` input to subtract is optional Phase 2. Column top: same rule (V_above = 0 → V_pz = ΔR − V_below ≈ ΔR).

### 4.4 Both attachment modes
P_conn and M_conn are attachment-independent, so this row set is identical in bolted and welded mode. Inputs live in a new always-visible section "Plate-to-HSS Weld".

### 4.5 New inputs
| id | label | default | Ex. 4.2 |
|---|---|---|---|
| `colAbove` | Column above this joint: same HSS, continuous / different HSS / none (top of column) | same | same (M_seg = M_conn/2) |
| `hssWeldSize` | Fillet leg, plate to HSS (in) | 0.5 | ½ |
| `hssWeldFexx` | F_EXX (ksi) | 70 | 70 |
| `weldIncludePZ` | Include panel-zone in-plane shear on the weld (beyond DG24), full ΔR, V_col neglected | off | off |
| `pzCheck` | Show HSS panel-zone shear row | on | — |

`colAbove` sits in the HSS Column Properties block (it is a column-continuity fact, not a weld input) and drives: M_seg share (§4.1) and cap-plate rows (Phase 2, §3.2). It does **not** drive the PZ shear on the weld (§4.3, re-verification).

---

## 5. Where the code goes; refactor question

### 5.1 Recommendation: extract a small DOM-free engine for the *new* checks, leave the existing flow alone
Do **not** rewrite `calculate()`/`generateResults()` into a full FPHSS-style engine now (~1.5 days to port and re-verify 17 tests for no engineering gain). Instead add `window.TPC` (through-plate checks) as a separate `<script>` block above the existing one:

```
TPC.blockShearBolted({tp,wp,Fyp,Fup, tf,bf,Fyb,Fub, nL,n,s,g,dh,LeP,LeB})  -> {plate:{int,ext,gov}, flange:{...}}
TPC.blockShearWelded({tp,wp,Fyp,Fup,bf,lw,onFlange})                       -> {plate:{...}|null}
TPC.segmentShare(colAbove)                                                   -> 0.5 | 1.0   (M_seg only; PZ shear on the weld is always full ΔR)
TPC.hssWeld({B,H,t,Fu_hss,Fu_p,tp,Pu,MuSeg,Pa,MaSeg,w,Fexx,includePZ,dR})     -> {AwT,IT,fu,fa,fv,fres,phirn,rnW,Dreq_L,Dreq_A,dc_L,dc_A,tminHSS,tminPl,...}
TPC.panelZone({H,t,Fy,Ag,Pu,dR})                                             -> {Rn,phiRn,RnW,dc}   (full ΔR, always)
TPC.plateCompression({tp,wp,Fy,Lc})                                          -> {r,Lcr,Pn,...}
TPC.FIXTURES / TPC.runFixtures()   (in-page, `?selftest=1`, same shape as FPHSS)
```
Pure numbers in, numbers out; every function returns the intermediates the detail panel prints. `calculate()` computes `share = TPC.segmentShare(colAbove)`, `Mu_seg = share·Mu_conn`, `Ma_seg = share·Ma_conn`, `dR = (Mu_right − Mu_left)·12/lever` (and the ASD twin), extends `bearingRn` per C4, then calls the TPC functions after Step 7 (bolted) / the `W` block (welded) and passes results through the `generateResults` data object; `generateResults()` gains det-panel builders and pushes rows in this order: after "Bolt Bearing / Tearout" (bolted) or after "Fillet Weld Size & Length Limits" (welded): Plate Block Shear, Beam Flange Block Shear, Plate Compression (J4.4), then a group header "Column Side — HSS" with Plate-to-HSS Weld, HSS Wall Base Metal at Weld, HSS Panel-Zone Shear (optional), Cap-Plate Bearing (Phase 2, N/A by default). Update `allOK`, the `AREv2.publish` governing capacity, the "Analysis Includes" line and the footer note.

Effort of this approach: engine ~0.5 day, wiring + panels ~0.5 day, tests ~0.5 day. A full engine port would add ~1 day with no change to the engineering.

### 5.2 Detail-panel content (per row, same `cref-hdr`/`cbox`/`mrow` idiom)
- Block shear: pattern sketch in words, L_gv, A_gv, A_nv, A_nt with substituted numbers, both sides of J4-5, governing side named, LRFD/ASD lines, and the "why the other pattern is N/A" sentence.
- Weld: A_w/t, I/t with the "(H/2)² throat neglected" note, both demand terms, f_r, D_req (Manual Part 8 form 1.392D / 0.928D generalized to F_EXX), φr_n for the chosen size, base metal t_min, geometry check w_p ≥ B + 2w, and the PZ-inclusive alternative value.
- Panel zone: ΔR derivation, 2Ht, 0.4P_y screen, φR_n.
- Live schematic (`areDrawSchematic`): add the perimeter weld symbol at each plate/HSS interface; no other change.

---

## 6. Section properties
- **Core checks need only** t_p, w_p, b_f, t_f, B, H, t_des — all present in `fallbackBeams` / `fallbackHSS`. Workable gage g is not in the AISC database → user input (default 3.5).
- **Database-loaded path bug to avoid:** for HSS rows the xlsx column `t` (index 21) is the string `'–'`; `tdes` (23) = 0.465, `tnom` (22) = 0.5. `calculate()` currently never reads HSS thickness, so this has been latent. New code must use `hssT = parseFloat(hss.tdes) || parseFloat(hss.t)` (the schematic already does this at line ~995).
- **Panel-zone 0.4P_y screen** needs A_g. The DB path already exposes it as `hss.area` (col 5 = 28.3 in² for HSS20X12X1/2), so the fallback field must be named **`area`** too and read as `parseFloat(hss.area)` on both paths (C6). Values from the v16 xlsx: HSS20X12X1/2 28.3, HSS16X8X1/2 20.9, HSS14X10X1/2 20.9, HSS12X8X3/8 13.2 in². **HSS18X12X5/8 is not in the v16 database**; if the entry is kept, use Manual Table 1-11 A = 32.6 in² (verifier). When `area` is not finite, skip the 0.4P_y screen with a note rather than guessing. Q_f (needs S_x) is **not** needed since no face row applies; do not add S.
- Beam `d`, `bf`, `tf` already flow from the DB; `kdes` not needed.

---

## 7. Verification

### 7.1 Fixtures reproducing Ex. 4.2 (inputs: W16X57 A992, HSS20X12X1/2 A500B, plate 5/8 × 14 A36, **`boltDiameter` = 1.0 set explicitly (page default is ¾ in, C2)**, A325-N, 2 lines × 5 @ 3.00, g 3.5, L_e,p 1.75, L_e,b 2.0, `firstBoltDist` 3.0, `colAbove` = same, loads per page defaults; ½ in E70 HSS weld)

| Quantity | DG24 value | DG24 page | 360-22-exact value (1⅛ std hole → 1 3/16 net) | Fixture assertion |
|---|---|---|---|---|
| P_u,conn / P_a,conn | 346 / 232 kips | p.39 (idx 45) | 345.6 / 232 | ±0.5 (already in calc) |
| M_u,conn total / **per segment** | (320) / **160 kip-ft**; ASD (200) / 100 | p.39 (idx 45), the 2M_uconn term | calc `Mu_conn` = 320; `Mu_seg` = 160 with `colAbove` = same | assert `Mu_seg` 160 ±0.5, `Ma_seg` 100 ±0.5; assert `Mu_seg` = 320 when `colAbove` = none |
| Plate block A_gv / A_nv / A_nt | 17.3 / 11.0 / 1.48 in² | p.43 (idx 49) | 17.19 / 10.51 / 1.445 | see note |
| Plate block R_n, φR_n, R_n/Ω | 460 / 345 / 230 kips | p.43 (idx 49) | 449.5 / 337.1 / 224.7 (rupture side now governs) | 360-22 values ±0.5; DG24 value reproduced only with a test-only hole override (`TPC` accepts `dh` directly, so the fixture passes dh = 1.125 and asserts 457.3 ±1% — DG24's 460 is from rounding A_gv 17.19→17.3, A_nv 10.86→11.0) |
| Flange block A_gv / A_nv / A_nt | 20.0 / 12.8 / 1.78 in² | p.44 (idx 50) | 20.02 / 12.38 / 1.739 | |
| Flange block R_n, φR_n, R_n/Ω | 615 / 461 / 308 kips | p.44 (idx 50) | 595.8 / 446.9 / 297.9 | 360-22 ±0.5; dh = 1.125 override → 614.4 ±0.3% |
| Weld A_w/t, I/t | 64.0 in², 3,730 in⁴ | p.44–45 (idx 50–51) | 64.0 / 3,733 | ±0.1 / ±5 |
| Weld demand LRFD / ASD (M_seg = 160 / 100) | 10.6 / 6.84 kips/in | p.45 (idx 51) | 10.55 / 6.84 | ±0.1 |
| D_req LRFD / ASD | 7.61 / 7.37 sixteenths → ½ in | p.45 (idx 51) | 7.58 / 7.37 | ±0.05 |
| ½ in weld D/C LRFD / ASD | — | — | 0.947 / 0.921 | ±0.005 |
| HSS wall base metal t_min | — | Manual Eq. 9-2 | 0.426 ≤ 0.465 | ±0.001 |
| Plate compression L_c/r | 16.7 < 25 | p.40 (idx 46) | 16.6 (L_c = `firstBoltDist` 3.0) | ±0.1 |
| Flange bearing end bolt (existing row, C4) | L_c 1.47 in, R_n 82.0 kips | p.42 (idx 48) | L_c = 2 − 1.125/2 = 1.4375, R_n = 1.2·1.4375·0.715·65 = 80.2 (360-22 hole) | ±0.5; DG24 hole → 82.0 |
| Rupture (existing row, for reference) | R_n 426, φR_n 320 | p.40 (idx 46) | 421.4 / 316.1 (A_n = 7.266) | already differs by hole size — same policy (C5) |

Policy: assert the 360-22-exact numbers in the shipping fixtures; keep a second fixture with the DG24 hole to prove the arithmetic matches the book. Document the hole-size delta in the panel ("DG24 Ex. 4.2 was written to 360-10 hole sizes").

### 7.2 Hand-calc cases (no published source; compute in the test from first principles like the existing welded checks)
- **W1** welded, w_p = 14 > b_f = 7.12, l_w = 16.75 − 0.5 − 0.3125 = 15.94 in, t_p 0.75: plate block A_gv = A_nv = 23.91, A_nt = 5.34; R_n = min(1141.7, 826.1) = 826.1, φR_n = 619.6 > plate rupture 456.8 → row shown, does not govern.
- **W2** welded, `weldLen` = 6: R_n = 504.1, φR_n = 378.1 — still above rupture; assert value only.
- **W3** welded, w_p = 7 ≤ b_f: plate block row N/A ("same as J4.1(b)"); flange block N/A in all welded cases.
- **W4a** HSS weld, `weldIncludePZ` on, `colAbove` = same (M_seg 160, PZ full ΔR): f_v = 203/40 = 5.07, f = √(10.55² + 5.07²) = 11.71, D/C 1.051 → FAIL with ½ in; 9/16 in (φr_n 12.53) → 0.934 PASS. (Re-verification: the ½-share 0.974 case is withdrawn.)
- **W4b** same with `colAbove` = none: M_seg = 320 → f_u = 346/64 + 320·120/3,733 = 15.69 kips/in, D_req 11.3 → ¾ in, D/C 1.41 with ½ in (PZ off); with PZ on f = √(15.69² + 5.07²) = 16.5, D/C 1.48. Asserts the column-top path is not silently halved (C1).
- **W4c** `colAbove` = different HSS: same numbers as W4a (M_seg share ½), cap-plate rows N/A in Phase 1.
- **W5** geometry error: w_p = 12.5 with ½ in weld (< B + 2w = 13.0) → error message.
- **W6** panel zone: ΔR = 203.0, φR_n = 462.0, D/C 0.44; with P_u,conn raised so αP_r > 0.4P_y (P_y = 46·28.3 = 1302 → need P_u > 521) assert the J10-10 reduction.
- **W7** bolted, 3 lines, g 3.0, w_p 14: sub-block and outer patterns computed; assert the governing pattern label.
- **W8** C4 wiring: `beamEndDist` = 1.25 with `edgeDist` = 1.75 → flange end-bolt L_c = 1.25 − 0.5625 = 0.6875, flange R_n end = 1.2·0.6875·0.715·65 = 38.3 kips. **Re-verification: the min does not switch at t_p 0.625 or 0.75** (plate 755.8 / 907 kips vs flange 2·38.3 + 8·104.6 = 913.3), because only 2 of 10 bolts are end bolts and the flange (0.715, F_u 65) is the stronger element. Assert instead `Rn_brgFlange` = 913.3 ±0.5 directly (it is already in the `generateResults` data object), or run W8 at t_p = 1.0 where the flange governs (flange 997.0 → 913.3 with L_e,b 1.25; plate 1209). Either proves the flange no longer reads `edgeDist`.

### 7.3 Test additions (`tools/test-through-plate.mjs`)
- **Every Ex. 4.2 step first does `page.selectOption('#boltDiameter', '1.0')`** — the page opens on ¾ in (C2). Also set `#plateThickness` 0.625, `#edgeDist` 1.75, `#boltGage` 3.5, `#beamEndDist` 2, `#firstBoltDist` 3, `#colAbove` same.
- Row counts: the harness `rows()` keeps only 7-cell rows with a `<strong>` in cell 0, so **group-header rows are not counted** (C5). Bolted default: 4 → 4 + {2 block shear, 1 compression, weld, HSS base metal, panel zone} = 10 check rows (+ cap-plate row if rendered as an N/A row rather than a note — decide once). Assert names and D/C against inline arithmetic (mirror the existing `near()` style).
- Assert the §7.1 360-22 values from the rendered D/C and from `TPC` directly (`page.evaluate(() => TPC.blockShearBolted({...}))`, `TPC.hssWeld({...})`), and `Mu_seg` 160 / 320 for `colAbove` same / none.
- `?selftest=1` → `TPC.runFixtures()` all pass (fixtures F-BS1, F-BS2, F-W1..W8 above).
- Welded default: 7 → 7 + N check rows; W1–W5 (W4a/b/c drive `#colAbove` and `#weldIncludePZ`).
- C4: assert the bearing row is unchanged at the page defaults (plate governs) and switches per W8.
- Existing 17 checks stay green (if `edgeDist` / `boltDiameter` / `plateThickness` defaults change, update the affected expectations and the header comment — the bolted-default rupture and bolt-shear numbers move from 388.2 / 178.9 to the 1 in values).
- `no page errors` remains last.

---

## 8. Effort, risks

| Item | Effort | Risk |
|---|---|---|
| A. Block shear, bolted + welded, engine + panels + tests | 0.75 day | Pattern generalization for 3–4 lines is my derivation, not Ex. 4.2 — keep the note. `edgeDist` default change ripples into bearing row and test. |
| B. Column side: N/A notes + panel zone + J4.4 compression | 0.5 day | Panel-zone row is beyond DG24 — a reviewer comparing to the book will ask why it is there; the panel must say "beyond DG24". Cap-plate bearing (Phase 2) +0.5 day if wanted. |
| C. Plate-to-HSS weld + base metal + geometry + optional PZ vector | 0.5 day | **M_seg convention (C1):** the weld must use the per-segment moment via `colAbove`; using the calc's total 320 fails the book by 2×, halving silently is 2× unconservative at a column top. PZ shear on the weld is full ΔR (D/C 1.05 with ½ in when the toggle is on) per the re-verification; J3's ½-share is withdrawn. |
| C1/C2 follow-through: `colAbove` select + share plumbing, default fixes (`selected` on 1 in, t_p, L_e), `firstBoltDist`, `bearingRn` extension, test edits | 0.25 day | Default changes move existing test numbers; do them in one commit with the test. |
| Fixtures, `?selftest=1`, test harness, docs, copy to `RE CODING/Steel/` | 0.5 day | Hole-size convention must be explained or the numbers look "wrong" vs DG24. |
| **Total** | **~2.5 days** (+0.5 Phase 2 cap-plate rows) | |

Not in scope: the single-plate shear connection of the beam web to the HSS (Ex. 4.2 p.45–46 uses Table 10-9a) — a separate calc; HSS segment length / shim note (p.46) — text only.

---

## 9. Pre-existing discrepancies noticed (fix or accept, not part of the three checks)
1. Defaults `plateThickness` 0.75 and `edgeDist` 1.25 do not reproduce Ex. 4.2's final design (5/8 in, 1¾ in); R_u shows 251.9 vs 254 and the plate bearing end-bolt L_c is 0.69 vs 1.22 in.
2. **Default bolt is ¾ in** (C2): the `boltDiameter` option labelled "1" (Example 4.2 Default)" has no `selected` attribute. On the page as it opens, A_n is capped at 0.85A_g so the rupture row shows φR_n = 388.2 kips (t_p 0.75) / 323.5 (t_p 0.625) and bolt shear 178.9 kips; the 1 in values (rupture R_n 421.4, φR_n 316.1 at t_p 0.625 — 360-22 hole, vs DG24 426 / 320) appear only after the user picks 1 in. Neither the ¾ in default nor the hole-size delta is explained on the page.
3. `hss.t` is `'–'` when the database loads (§6). Latent today; fatal for any new HSS-thickness math that does not use `tdes`.
4. **`Mu_conn` is the total joint unbalance (320), displayed without saying so** (C1). Harmless where it is used today (the R_u max screen, §4.1), wrong if fed to the weld. Relabel and add the per-segment line.
5. **`bearingRn` uses `edgeDist` for the flange end bolts** (C4). DG24 uses the 2 in beam-end distance for the flange; with the page defaults the plate governs so the row value is unaffected, but the flange number in the panel is wrong.

---

## 10. Open questions for Nick
1. **Defaults:** move `plateThickness` → 0.625, `edgeDist` → 1.75 **and add `selected` to the 1 in bolt** so the page opens on Ex. 4.2's final design (and update the existing test), or keep 0.75 / 1.25 / ¾ in and only document?
2. **Cap-plate bearing rows** (HSS above ≠ HSS below): the `colAbove` select ships in Phase 1 regardless (needed for the weld moment); build the bearing rows now behind its *different HSS* value, or leave them N/A with a note and add later?
3. **Panel-zone shear row** (beyond DG24): include as a normal PASS/FAIL row, informational only, or omit?
4. **Plate-to-HSS weld — PZ shear:** resolved at re-verification: the plate-to-segment weld sees ≈ ΔR − V_col regardless of column continuity, so with `weldIncludePZ` on the calc uses full ΔR (½ in weld D/C 1.05 in Ex. 4.2; 9/16 in passes). Remaining question for Nick: toggle default OFF (DG24 convention, ½ in reproduces the book) or ON (the 9/16 in answer)? A `Vcol` input to subtract the story shear is optional Phase 2.
5. **Hole-size convention on the page:** one sentence in the block shear / rupture panels explaining the 360-10 vs 360-22 standard hole difference — acceptable?
6. **3–4 bolt lines:** keep the generalized patterns with a "verified only for 2 lines" note, or restrict `numRows` to 2 until a reference case exists?
7. **J4.4 plate compression row:** include (cheap, Ex. 4.2 checks it) — yes?
8. **R_u screen:** keep M_max = max(M_right, M_left, |M_conn,total|) as a conservative screen (recommended; unaffected in Ex. 4.2), or drop the M_conn term to match DG24's literal R_u = M_right·12/(d + t_p)?
9. **Moment split for `colAbove` = same / different:** equal split (DG24's 2M_uconn) is what Phase 1 implements; do you want a stiffness-weighted or user-entered share for unequal columns / story heights?

---

## Independent verification (Fable, 2026-09-22)

Method: re-read DG24 Ex. 4.2 (idx 43–52; rendered pages 43/45/51 to PNG to resolve the mangled fraction glyphs and the ΣM_A equation), DG24 Table 7-2 (idx 84–90), 360-22 Table J3.3 (idx 204), J4.3/J4.4 (idx 213), J10.6 (idx 220–221), K2 (idx 227), Table K5.1 (idx 238–239); recomputed every number from the Ex. 4.2 inputs; opened `public/Calcs/aisc-shapes-database-v16.0.xlsx` (sheet "Database v16.0"); ran the live page on the fallback shapes through Playwright (bolted default, then t_p 0.625 / L_e 1.75). No calculator code was changed.

### Items checked

| # | Claim (plan §) | Plan value | Verified value | Source | Status |
|---|---|---|---|---|---|
| 1 | Plate end edge distance L_e,p | 1¾ in (§2.1) | 1¾: 2[1¾ + 5(3)] + 20 = 53.5 and L_c = 1¾ − 17/32 = 1.219 both close | DG24 p.41, 43 (idx 47, 49) | CONFIRMED |
| 2 | Beam-end edge distance L_e,b | 2 in | 2 in, L_c = 2 − 17/32 = 1.47 | p.42 (idx 48) | CONFIRMED |
| 3 | Plate length | 53.5 in | 53.5 | p.43 (idx 49) | CONFIRMED |
| 4 | Bearing L_c end bolt (plate) | 1.22 in | 1.21875 | p.41 (idx 47) | CONFIRMED |
| 5 | Plate block L_gv / A_gv / A_nv / A_nt (DG24) | 13.75 / 17.3 / 11.0 / 1.48 | 13.75 (DG24 rounds to 13.8 → 17.3) / 10.97 / 1.484 | p.43 (idx 49) | CONFIRMED |
| 6 | Plate block R_n / φR_n / R_n/Ω (DG24) | 460 / 345 / 230 | 469 vs 460 → 460 / 345 / 230 | p.43 (idx 49) | CONFIRMED |
| 7 | Plate block, exact with d_h = 1⅛ | 457.3 | 464.0 vs 457.3 → 457.3 | recompute | CONFIRMED |
| 8 | Plate block, 360-22 d_h = 1 3/16 | 449.5 / 337.1 / 224.7; A 17.19 / 10.51 / 1.445 | 449.5 (rupture side) vs 455.1 → 449.5 / 337.1 / 224.7; 17.19 / 10.508 / 1.4453 | recompute | CONFIRMED |
| 9 | Flange block A_gv / A_nv / A_nt (DG24) | 20.0 / 12.8 / 1.78 | 20.02 / 12.78 / 1.784 | p.44 (idx 50) | CONFIRMED |
| 10 | Flange block R_n / φR_n / R_n/Ω (DG24) | 615 / 461 / 308 | 614.9 vs 715.7 → 615 / 461 / 308 | p.44 (idx 50) | CONFIRMED |
| 11 | Flange block exact d_h 1⅛ / 360-22 1 3/16 | 614.4 / 595.8, 446.9, 297.9 | 614.4 / 595.8 (A_nv 12.379, A_nt 1.739), 446.9, 297.9 | recompute | CONFIRMED |
| 12 | 360-22 std hole, 1 in bolt | 1⅛ (net 1 3/16); DG24 used 1 1/16 (net 1⅛) | Table J3.3: "1 → 1⅛; ≥ 1⅛ → d + ⅛". DG24 A_n = 8.75 − 2(1⅛)(⅝) confirms the 1⅛ net | 360-22 16.1-137 (idx 204); DG24 p.40 | CONFIRMED |
| 13 | Existing rupture row, 360-22 hole | 421.6 / 316.2 | A_n = 0.625(14 − 2 × 1.1875) = 7.266; R_n = 421.4, φR_n = 316.1 | recompute | CORRECTED (0.2 kip transcription) |
| 14 | "Rupture row reports 422 kips" on the page (§9.2) | 422 | Live page: φR_n = 388.2 (t_p 0.75) / 323.5 (t_p 0.625) = 0.75·58·0.85A_g. The page default bolt is **¾ in** (no `selected` on the 1 in option, markup line ~392), so A_n is capped at 0.85A_g and bolt shear shows 178.9 kips (= 0.75·54·0.442·10). 422 appears only after the user picks 1 in | live run; markup | CORRECTED |
| 15 | P_u,conn / P_a,conn | 346 / 232 | 345.6 / 232 | p.39 (idx 45) | CONFIRMED |
| 16 | M_u,conn = 160 "already in calc" (§7.1); "DG24 applies the total M_conn to one weld… the moment actually splits… conservative" (§4.1) | 160 = total | DG24 p.39: ΣM_A = 360 − 72 − **2M_uconn** + (20/2)/12·(48 − 9.6) = 0 → M_uconn = 160 is the moment in **each** column segment (equal split above/below of the 320 kip-ft joint unbalance). Calc line 1250 computes M_u,conn = 288 + 32 = **320** (no /2; ASD 200 vs DG24 100) | DG24 p.39 (idx 45); calc line 1250 | **DISPUTED** — correction C1 |
| 17 | Weld A_w/t, I/t | 64.0, 3,733 (DG24 3,730) | 2(12 + 20) = 64.0; 2·20³/12 + 2·12·10² = 3,733.3 | p.44–45 (idx 50–51) | CONFIRMED |
| 18 | Weld demand LRFD / ASD | 10.55 (10.6) / 6.84 kips/in | 346/64 + 160·12·10/3730 = 5.406 + 5.147 = 10.55; 232/64 + 100·120/3730 = 6.84 | p.45 (idx 51) | CONFIRMED with M_conn = 160; with the calc's 320 it is **15.7** → D/C 1.41, D_req 11.3 → ¾ in |
| 19 | D_req | 7.61 / 7.37 → ½ in; 7.58 exact | 10.6/1.392 = 7.61; 6.84/0.928 = 7.37; 10.55/1.392 = 7.58 | p.45 | CONFIRMED |
| 20 | φr_n ½ in, D/C | 11.14; 0.947 / 0.921 | 1.392·8 = 11.14; 10.55/11.14 = 0.947; 6.84/7.424 = 0.921 | recompute | CONFIRMED |
| 21 | HSS base metal t_min | 3.09·8/58 = 0.426 ≤ 0.465 | 0.4262; single fillet (outside face only) is the right Eq. 9-2 form | Manual Eq. 9-2; II.B-2 p. IIB-22/23 | CONFIRMED |
| 22 | PZ vector add | f_v 5.07; 11.7; D/C 1.05 | 203/40 = 5.075; √(10.55² + 5.075²) = 11.71; /11.14 = 1.051 | recompute | CONFIRMED as arithmetic; see J3 |
| 23 | Plate compression L_c/r | 16.7 (16.6 exact) | r = 0.625/√12 = 0.1804; 3.0/0.1804 = 16.6; DG24 3.0/0.180 = 16.7 | p.40 (idx 46) | CONFIRMED |
| 24 | Panel zone ΔR, R_n, φR_n, D/C | 203 / 513 / 462 / 0.44 | (360 − 72)·12/17.025 = 203.0; 0.6·46·2·20·0.465 = 513.4; ×0.90 = 462.1; 0.439 | recompute | CONFIRMED |
| 25 | P_y screen | 46·28.3 = 1302, need P_u > 521 | 1301.8; 0.4P_y = 520.7 | recompute | CONFIRMED |
| 26 | J10.6 form, φ 0.90 / Ω 1.67, J10-10 reduction when αP_r > 0.4P_y | as stated | §J10.6 idx 220–221 | 360-22 16.1-153/154 | CONFIRMED |
| 27 | J4.3: φ 0.75 Ω 2.00, U_bs = 1 uniform | as stated | idx 213 | 360-22 16.1-146 | CONFIRMED |
| 28 | Table 7-2 "HSS Wall Plastification" rows are Longitudinal Plate / Longitudinal Through-Plate only; transverse-plate rows have no plastification check | as stated | Table 7-2 idx 86–87; DG24 p.78: "for transverse plate connections to rectangular HSS… there is no check for the limit state of HSS wall plastification" | DG24 idx 84, 86, 87 | CONFIRMED |
| 29 | Cap-plate rows: local yielding 2F_y t(5t_p + N), A F_y when 5t_p + N ≥ B, φ 1.00/Ω 1.50; crippling 1.6t²[…], φ 0.75/Ω 2.00 | as stated | Table 7-2 idx 87 | DG24 p.81 | CONFIRMED |
| 30 | 360-22 K2.3 routes rectangular-HSS concentrated loads to Chapter J; l_b "measured across the width… loaded cap plates" | as stated | idx 227 | 360-22 16.1-160 | CONFIRMED |
| 31 | K5 / Table K5.1 do not apply | as stated | Table K5.1 rows are T-/cross-/K-connections to a continuous chord face (l_e = 2B_e etc.); a full-perimeter end weld is not among them | 360-22 16.1-171/172 (idx 238–239) | CONFIRMED |
| 32 | Table J2.4 minimum fillet for 0.465 wall | 3/16 in | ¼ < t ≤ ½ → 3/16 | 360-22 Table J2.4 | CONFIRMED |
| 33 | `hss.t` is the string '–' from the xlsx; `tdes` 0.465, `tnom` 0.5 | as stated | Sheet "Database v16.0": col 21 `t` = '–' for every HSS; tdes 0.465; tnom 0.5 | xlsx | CONFIRMED |
| 34 | Fallback A values 28.3 / 20.9 / 20.9 / 13.2; HSS18X12X5/8 absent from v16 | as stated | xlsx: 28.3, 20.9, 20.9, 13.2; HSS18X12X5/8 not found (5 of 6 rows) | xlsx | CONFIRMED (naming note C6) |
| 35 | W1 welded plate block | A 23.91 / 5.34; 1141.7 / 826.1 → 826.1; φ 619.6; rupture 456.8 | 23.906 / 5.34; 1141.6 / 826.1; 619.6; 456.75 | recompute | CONFIRMED |
| 36 | W2 (l_w = 6) | 504.1 / 378.1 | 194.4 + 309.7 = 504.1; 378.1 | recompute | CONFIRMED |
| 37 | W5 geometry | B + 2w = 13.0 | 12 + 1 = 13 | recompute | CONFIRMED |
| 38 | "Governs plate rupture only when 1.2l_w + b_f < w_p" (§2.2) | rupture-side inequality | Block is min of both J4-5 sides; for A36 the yield side is smaller (0.745l_w + b_f < w_p). The inequality as written is not the binding one | algebra | CORRECTED (note only) |
| 39 | Test row count "+1 group header" (§7.3) | counted | `rows()` in the harness keeps only `tr.children.length === 7` with a `<strong>` in cell 0; group-header rows (colspan 6 + 1 = 2 children) are excluded | tools/test-through-plate.mjs | CORRECTED |
| 40 | Bolted J4.4 L_c = "distance from HSS face to first bolt" | Ex. 4.2 3.00 in | No such input exists in bolted mode; `plateExt` (16.75) lives in the hidden weld section. 3.00 = plateExt − L_e,p − (n − 1)s only if plateExt is exposed or a new input is added | markup lines 369–375, 405–422 | CORRECTED (missing input) |
| 41 | Flange bearing edge distance | plan adds `beamEndDist` for block shear only | Existing `bearingRn()` (line 1310) uses `edgeDist` for **both** plate and flange end bolts; DG24 uses 2 in for the flange. The flange bearing row should use the new input too | calc lines 1310–1316 | CORRECTED (wiring) |
| 42 | `window.TPC` pattern vs `FPHSS` | same shape | FPHSS is an in-page IIFE with `FIXTURES`, `runFixtures()`, `?selftest=1` → `document.title`; TPC can mirror it. `page.evaluate(() => TPC.x({...}))` is feasible on the fallback shapes | flange_plated calc lines 789–1424 | CONFIRMED |
| 43 | Effort ~2.25 days | — | Reasonable; add ~0.25 day for C1/C2 (column-continuity select, default fixes, test edits) | — | CONFIRMED |

### Required corrections

**C1 — M_conn convention (engineering; blocks the weld fixture).** DG24's 160 kip-ft is the moment in each column segment from an equal split (the 2M_uconn term in ΣM_A). The calc's `Mu_conn` is the total joint unbalance (320; ASD 200). §4.1's "DG24 applies the total M_conn… conservative" is wrong, and §7.1's "346/160 already in calc" is wrong. Feeding the calc's 320 into the DG24 weld model gives 15.7 kips/in, D_req 11.3 → ¾ in, D/C 1.41 with ½ in — the fixture would fail. Fix: give `TPC.hssWeld` the per-segment moment and make the split explicit — promote the Phase-2 `colAbove` select to Phase 1 with values *continuous above (M/2 per segment, DG24 Ex. 4.2 default)* / *top of column (100% to the segment below)* / *different HSS above*. Do not silently halve; a column-top through-plate designed with M/2 is unconservative by 2×. Also decide whether the existing `Mu_conn` display (line 1466) should be relabelled "joint unbalanced moment" — its only use today is the M_max screen, where 320 is harmless.

**C2 — Default bolt is ¾ in, not 1 in.** Add to §9 and §10 Q1: the `boltDiameter` select has no `selected` attribute, so the page opens with a ¾ in bolt. Every Ex. 4.2 reproduction (block shear, bearing L_c, rupture 421.4) requires `#boltDiameter = '1.0'` in the harness; the §7.3 steps do not set it. Rupture on the page today is 0.85A_g-capped (388.2 / 323.5 φ), not 422.

**C3 — Bolted-mode L_c for J4.4 has no input.** Add `firstBoltDist` (default 3.0) or move `plateExt` to a shared section and derive 3.0 = plateExt − L_e,p − (n − 1)s with an error when it comes out ≤ 0.

**C4 — Flange bearing must use `beamEndDist`.** Extend `bearingRn()` so the flange end-bolt L_c uses L_e,b (2 in) and the plate uses L_e,p. The existing test expectation changes only if the defaults change (with L_e,p 1.75 < L_e,b 2.0 the plate still governs the min).

**C5 — §7.1 numbers:** existing rupture 421.6/316.2 → 421.4/316.1. §7.3 row counts: exclude the group header from `rows()` counts (or extend the helper).

**C6 — Fallback area key.** The DB path already exposes `hss.area` (col 5). Name the fallback field `area`, not `A`, and read `parseFloat(hss.area)` so both paths agree; skip the 0.4P_y screen with a note when it is not finite (HSS18X12X5/8: Manual Table 1-11 A = 32.6 in² if the entry is kept).

**C7 — §2.2 inequality note:** state the governing condition from the min of both J4-5 sides, or drop the inequality and let the numbers speak.

### Engineering judgment — where I differ or would add

- **J1 (agree, subject to C1):** wall-plastification N/A, face rows N/A, K5.1 N/A, DG24 elastic A_w/I weld model — all confirmed against the sources. The through-plate is a cap-plate-type end connection, not a face connection.
- **J2 (agree):** panel-zone shear on 2Ht as an informational row is sound and conservative with V_col neglected; keep the "beyond DG24" label.
- **J3 (partly disagree):** the vector-added PZ shear on the weld (D/C 1.05) puts all of ΔR into one weld; ΔR splits between the HSS above and below the same way the moment does, so with a continuous column f_v per weld ≈ 2.5 kips/in and the ½ in weld passes (√(10.55² + 2.54²) = 10.85, D/C 0.97). Tie the PZ share to the same `colAbove` split as C1 rather than 100% to one weld; keep 100% for the column-top case. Default OFF is fine either way.
- **J4 (agree):** welded-mode block shear set (A4 only; plate-edge welds → J4.1(b); flange has no free block, J4-4 / Eq. 9-2 governs as in II.B-2 pp. IIB-22/23).
- **J5 (minor):** plate base metal at the HSS weld — an informational t_min ≤ t_p line (0.426 ≤ 0.625) costs nothing and pre-empts the reviewer question; not required.
- **J6 (minor):** 3–4 bolt-line generalization is reasonable; keep the "verified for 2 lines only" note (§10 Q6).

VERDICT: REVISE

---

## Revision 1 (response to verification)

Each item below names the correction, what changed, and where it now lives in the plan. Effort moved from ~2.25 to ~2.5 days (§8).

| # | Correction | Resolution | Where |
|---|---|---|---|
| C1 | DG24 M_uconn = 160 is per column segment (2M term in ΣM_A); calc `Mu_conn` = 320 total | Weld takes M_seg = share × M_conn,total; share from new Phase-1 `colAbove` select (same → ½, different → ½, none/top → 1.0); never halved silently; Step 2 display relabelled "total joint unbalanced moment" with a per-segment line. R_u screen analysed: unaffected in Ex. 4.2, conservative in general, not a bug — leave as-is (Q8 offers the DG24-literal alternative). | §3.2, §4.1, §4.5, §5.1, §7.1, §7.2 W4b, §9.4, §10 Q8–Q9 |
| C2 | Page default bolt is ¾ in (no `selected`), so Ex. 4.2 numbers never appear by default | Every fixture and harness step sets `#boltDiameter = '1.0'`; §9.2 rewritten with the live values (388.2 / 323.5 φR_n, 178.9 bolt shear); Q1 extended to add `selected`. | §2.3, §7.1, §7.3, §9.2, §10 Q1 |
| C3 | Bolted J4.4 L_c had no input | New `firstBoltDist` (3.0) in the bolt section; also yields the bolted plate projection 3 + 12 + 1.75 = 16.75 shown read-only. | §2.3, §3.4, §7.1 |
| C4 | `bearingRn` uses `edgeDist` for the flange end bolts | Extend to `bearingRn(tEl, FuEl, LeEl)`; flange uses `beamEndDist` (DG24 L_c 1.47, R_n 82.0 with the DG24 hole; 80.2 with 360-22). Fixture W8 proves the switch. | §2.3, §5.1, §7.1, §7.2 W8, §7.3, §9.5 |
| C5 | Rupture 421.6/316.2 → 421.4/316.1; group-header rows are excluded by `rows()` | Numbers corrected; §7.3 row counts restated without the header (10 check rows bolted). | §7.1, §7.3, §9.2 |
| C6 | Fallback area key must match the DB `area` field | `fallbackHSS[*].area`, read as `parseFloat(hss.area)` on both paths; HSS18X12X5/8 A = 32.6 (Table 1-11) if kept. | §6 |
| C7 | §2.2 inequality quoted the rupture side; yield side governs for A36 | Restated as min of both J4-5 sides: block governs plate rupture only when 1.2(F_y/F_u)l_w + b_f < w_p (A36: 0.745 l_w + b_f < w_p). | §2.2 A4 |
| J3 | PZ shear on the weld should split with `colAbove` like the moment | Implemented as instructed via the same `share` (½ → D/C 0.97, 1.0 → 1.05); panel-zone *row* keeps full ΔR. Dissent recorded: free body gives the plate-to-segment weld ≈ ΔR − V_col regardless of continuity; left to Nick (Q4). | §3.3, §4.3, §7.2 W4a–c, §10 Q4 |
| J5 | Informational plate t_min line at the HSS weld | Added to the weld panel (0.426 ≤ 0.625). | §4.3 |
| — | Effort | +0.25 day for the C1/C2 plumbing and default/test edits → ~2.5 days (+0.5 Phase 2). | §8 |

## Re-verification (Fable, 2026-09-22)

Scope: Revision 1 body edits (§2.2, §2.3, §3.2–3.4, §4.1, §4.3, §4.5, §5.1, §6, §7.1–7.3, §8, §9, §10). Numbers recomputed by hand; W8 checked against the existing `bearingRn()` arithmetic. Two narrow body edits were applied by the verifier and are marked "re-verification" in place (§4.3 PZ paragraph, §4.5 label, §4.5 `colAbove` note, §5.1 signatures, §7.2 W4a/W4c/W8, §8 row C, §10 Q4).

| Item | Plan (Rev 1) | Verified | Status |
|---|---|---|---|
| C1 M_seg convention | M_seg = share × M_conn,total; same/different → ½ (160), none → 1.0 (320); never silent; Step 2 relabel; R_u screen kept | 320 × ½ = 160, ASD 200 × ½ = 100. R_u screen: with the calc's gravity-only, same-sign inputs the total M_conn cannot exceed max(M_r, M_l) unless the (H/2)ΔV/12 term is large; conservative screen, fine. (If sway/opposite-sign moments are ever added, the max-of-total term over-states the plate force by up to 2× — note for that day, not now.) | CONFIRMED |
| C1 column-top numbers | 15.7 kips/in, D_req 11.3, D/C 1.41; with PZ 16.5 / 1.48 | 5.406 + 10.286 = 15.69; /1.392 = 11.27; /11.14 = 1.409; √(15.69² + 5.07²) = 16.49; 1.48 | CONFIRMED |
| ½ in weld D/C | 0.947 / 0.921 | 10.55/11.14; 6.84/7.424 | CONFIRMED |
| C2 default bolt | harness sets `#boltDiameter` '1.0'; §9.2 live values 388.2 / 323.5 / 178.9; Q1 adds `selected` | matches live run | CONFIRMED |
| C3 `firstBoltDist` | 3.0; projection 3 + 12 + 1.75 = 16.75 = welded `plateExt` default | 16.75 | CONFIRMED |
| C4 flange bearing | L_c 1.47, R_n 82.0 (DG24 hole); 1.4375, 80.2 (360-22) | 2 − 17/32 = 1.469, 1.2·1.469·0.715·65 = 81.9; 2 − 0.5625 = 1.4375, 80.17; both < 2.4dtF_u = 111.5 | CONFIRMED |
| C4 fixture W8 | "bearing min must switch to the flange" at L_e,b 1.25 | Does not switch: plate 755.8 (t_p 0.625) / 907 (t_p 0.75) vs flange 2·38.3 + 8·104.6 = 913.3. Edited: assert `Rn_brgFlange` = 913.3 directly, or run at t_p 1.0 (flange governs, 997.0 → 913.3) | CORRECTED (edited in place) |
| C5 | 421.4 / 316.1; group headers excluded; 10 bolted check rows | 4 + 2 + 1 + weld + base metal + PZ = 10 | CONFIRMED |
| C6 | `fallbackHSS[*].area`, `parseFloat(hss.area)`; 32.6 for HSS18X12X5/8 | matches DB field name | CONFIRMED |
| C7 | 1.2(F_y/F_u)l_w + b_f < w_p; A36 0.745 | 1.2·36/58 = 0.7448 | CONFIRMED |
| J5 | plate t_min 0.426 ≤ 0.625 informational | 3.09·8/58 = 0.426 | CONFIRMED |
| J3 / dissent (Q4) | Plan implemented ½-share (0.97) per J3; planner dissented: plate-to-segment weld sees ≈ ΔR − V_col regardless of continuity, D/C ≈ 1.03 | **Dissent upheld; J3 withdrawn.** Horizontal free body of a plate: ΔR = V_pz + V_col. The two plates apply an equal-and-opposite couple to the segment between them, so V_pz ≈ ΔR − V_col with V_col ≈ M_seg/(h/2) ≈ 160/6.5 = 24.6 kips (13 ft story) → 178 kips; the column above sees only V_col. Governing weld = bottom plate to segment (P 346, M_seg 160, V_pz): √(10.55² + 4.45²) = 11.45 → 1.03; V_col neglected → 5.07 → 11.71 → 1.05. The ½-share (2.54 kips/in, 0.974) was wrong — it treated the PZ shear like the column moment. Column top: V_above = 0 so V_pz = ΔR − V_below, same conclusion | CORRECTED (edited in place: `pzShare` = 1.0 always, no `colAbove` coupling; W4a now 1.051 FAIL ½ in / 0.934 PASS 9/16 in) |
| §7.1 fixture table | M_seg 160/100 asserted, 320 for none | consistent with §4.1 | CONFIRMED |
| §3.3 segment row | panel-zone row always full ΔR | correct and now consistent with the weld rule | CONFIRMED |
| Effort | ~2.5 days | reasonable | CONFIRMED |

### Ruling on the dissent and default convention

The planner's free-body argument is correct. Panel-zone shear is not split between the columns above and below the way the joint moment is; it is carried almost entirely by the HSS segment between the plates, and the plate-to-segment weld is the one that sees it (with P_conn and M_seg at the same time at the bottom plate). The calc does not know the story height, so V_col cannot be computed; neglecting it is conservative and is the correct default. Convention: `weldIncludePZ` OFF reproduces DG24 (½ in, D/C 0.947); ON uses full ΔR (D/C 1.05, 9/16 in passes). Whether ON or OFF ships as the default is Nick's call (§10 Q4); the engineering path is now unambiguous either way.

### Remaining corrections

None outstanding. The two items found (W8 non-switch; J3 share) are already edited into the body above and flagged.

VERDICT: APPROVED

---

## Implementation (2026-09-23)

Nick's decisions (2026-09-23): Q1 yes (defaults t_p 5/8, L_e,p 1.75, 1 in bolt selected); Q4 panel-zone shear on the weld ON by default; Q3 panel-zone row is a normal PASS/FAIL row; Q2/Q9 the calc is limited to a **continuous column with the same HSS above and below** — different sizes and column tops are out of spec, so there is no `colAbove` select, M_seg = M_conn/2 always, and the cap-plate rows are dropped (column-side note explains why); Q6 limited to **2 bolt lines** (`numRows` has one option). Q5, Q7, Q8 took the plan's recommendations (hole-size note shown, J4.4 row included, R_u screen unchanged).

What was built in `public/Calcs/through_plate_calculator.html`:
- `window.TPC` DOM-free engine (block shear bolted/welded, plate compression, plate-to-HSS weld, panel zone) with 40 in-page fixtures, `?selftest=1`.
- New inputs `boltGage` 3.5, `beamEndDist` 2, `firstBoltDist` 3, `hssWeldSize` 9/16, `hssWeldFexx` 70, `weldIncludePZ` on. Fallback HSS gained `area`. `bearingRn` takes the edge distance per element (flange uses `beamEndDist`). HSS thickness reads `tdes` first.
- Rows: bolted 10 (adds plate and flange block shear, J4.4, plate-to-HSS weld, HSS wall base metal, panel zone); welded 12 (adds plate block shear at welds or N/A, J4.4, weld, base metal, panel zone). Column-side group header carries the "wall plastification does not apply" note.
- Schematic draws the plate-to-HSS fillet welds at both faces of each plate and the bolts from `firstBoltDist`.
- Default weld is 9/16 in, because with panel-zone shear on the book's 1/2 in weld is D/C 1.05.

Deviation from the plan (engineering): the HSS wall base-metal row is **not** Manual Eq. 9-2 t_min ≤ t. With a 9/16 in weld, t_min = 3.09(9)/58 = 0.480 > 0.465 and the row would fail even though the wall is adequate for the actual demand. Eq. 9-2 is the statement that the wall's shear rupture per inch, 0.75(0.6F_u t), matches the weld capacity; the Manual reduces the weld strength by t/t_min when t < t_min, which is identical to checking the weld demand against 0.75(0.6F_u t) per inch. The row therefore checks the resultant weld demand against φ(0.6F_u t) per inch (J4.2(b)) and shows t_min as a reference line. Ex. 4.2 default: 11.70 / 12.14 = 0.964.

Also found: a through-plate must be at least B + 2w wide, so with the fallback HSS (B ≥ 8 in) the plate is always wider than a W16X57 flange and the welded transverse end weld cannot occur; the page rejects a plate narrower than B + 2w.

Test: `tools/test-through-plate.mjs` rewritten (row values against inline arithmetic, both modes, DG24 1/2 in convention, error paths, selftest), all pass.

## Implementation verification (Fable, 2026-09-23)

Scope: `public/Calcs/through_plate_calculator.html` (diff vs `b3417ae`, ~400 changed lines) and `tools/test-through-plate.mjs`. Every `TPC` formula read against DG24 Ex. 4.2 / 360-22; wiring, both design methods, allOK/govCap, N/A and error paths, save/load, schematic; the xlsx path simulated in-page with the exact object shape `getShapeProperties` builds (`t: '–'`, numeric `tdes`/`area`); `node tools/test-through-plate.mjs` and `?selftest=1` run before and after fixes.

| # | Item | Finding | Status |
|---|---|---|---|
| 1 | `j45` / `blockShearBolted` | R_n = min(0.6F_uA_nv + F_uA_nt, 0.6F_yA_gv + F_uA_nt), U_bs = 1; L_gv = L_e + (n − 1)s, A_nv = A_gv − 2(n − ½)d_h t; interior A_nt = (g − d_h)t, exterior (w_p − g − d_h)t, flange (b_f − g − d_h)t; d_h = std hole + 1/16 (holeSize), bearing keeps stdHole. Fixtures BS-DG24 457.3 / 614.4 and BS-360-22 449.5 / 595.8 match my hand values | OK |
| 2 | `blockShearWelded` | A_gv = A_nv = 2t_p l_w, A_nt = b_f t_p; null when plate on flange → N/A row "same as J4.1(b)" | OK |
| 3 | `plateCompression` | r = t/√12, KL/r with K = 1.0 (DG24), J4-6 when ≤ 25, else E3-2/E3-3 with F_e = π²E/(KL/r)²; φ 0.90 / Ω 1.67. Bolted L = `firstBoltDist` (3.0 → 16.63), welded L = plateExt − l_w (= setback + w with auto length) | OK |
| 4 | `hssWeld` model | A_w/t = 2(B + H) = 64, I/t = 2H³/12 + 2B(H/2)² = 3,733; f = P_conn/A + M_seg(12)(H/2)/I with M_seg = M_conn/2 (160 / 100); PZ f_v = ΔR/(2H) full ΔR; resultant; φr_n = 1.392D (E70), r_n/Ω = 0.928D; D_req; geometry w_p ≥ B + 2w. Fixtures 10.55 / 6.84 / 7.58 / 7.37 / 0.947 / 0.921 / 1.051 / 0.934 all reproduce | OK |
| 5 | **`hssWeld` used the signed M_seg** | With the live load moved to the left beam (legal: DG24 says loads may reverse and the connection is symmetric), M_conn = −320, M_seg = −160 and the moment term subtracted: f fell from 11.70 to 5.08 kips/in, weld D/C 0.93 → 0.41, base metal 0.96 → 0.42, both PASS. Unconservative. **Fixed:** `Math.abs(o.MuSeg/MaSeg)` in the engine; det panel prints \|M_seg\|; fixture W-REV (3 items) and harness check "reversed beam loads give identical rows" added | FIXED |
| 6 | `panelZone` | A = 2Ht, R_n = 0.60F_y A (J10-9 form), φ 0.90 / Ω 1.67, J10-10 factor (1.4 − αP_r/P_y) when αP_r > 0.4P_y with α = 1.0 LRFD on P_u,conn and 1.6 ASD on P_a,conn; P_conn (346, the segment's maximum axial) is the conservative choice; screen skipped with a note when `area` is not finite. 513.4 / 462.1 / 0.439 reproduce | OK |
| 7 | **J10-10 factor unclamped** | P_u = 2000 kips (> 1.4P_y = 1823) gave k = −0.136, φR_n = −63 kips, D/C = −3.22 rendered green PASS. Absurd input, but a pass on a negative capacity must not be possible. **Fixed:** `Math.max(0, 1.4 − αP_r/P_y)` → φR_n = 0, D/C = ∞ → FAIL; fixture item added | FIXED |
| 8 | Base-metal deviation (J4.2(b) per inch instead of Eq. 9-2 t_min ≤ t) | Sound. Eq. 9-2 is exactly 1.392D = 0.75(0.6F_u)t solved for t; checking the actual resultant demand against 0.75(0.6F_u t) per inch (12.14 kips/in for 0.465 A500B) is the underlying check and is what the Manual's t/t_min reduction does. Treating the P/A + Mc/I normal component as shear on the wall is conservative (the wall carries it in direct compression at 0.9F_y t = 19.3 kips/in). J4.2(a) yielding 0.6F_y t·1.0 = 12.8 never governs for A500B/C. 11.70/12.14 = 0.964 reproduces; t_min 0.480 shown as reference | OK (conservative) |
| 9 | Wiring in `calculate()` | Order: existing steps → W block → HSS weld/geometry checks → BS (bolted) / BSW (welded) → PC → HW → PZ → X; ΔR = \|M_r − M_l\|·12/(d + t_p) (LRFD and ASD); `hssT = parseFloat(tdes) || parseFloat(t)`, `hssA = parseFloat(area)`, H/B parsed; `bearingRn(t, F_u, L_e)` with `edgeDist` for the plate and `beamEndDist` for the flange (C4); errors for non-positive inputs, g + d_h vs w_p/b_f, w_p < B + 2w, missing H/B/t_des | OK |
| 10 | LRFD and ASD | Every new row's `ok` is LRFD ∧ ASD; D/C column shows LRFD; det panels print both. `X.allOK` feeds `allOK`; `govCap` adds J4.4 and block shear (kips vs R_u) and correctly leaves out the per-inch weld rows and the ΔR panel-zone row | OK |
| 11 | N/A row path | `na: true` → "—" D/C and N/A status; `X.bsOK` true when `BSW` is null; reachable only with a plate narrower than b_f yet ≥ B + 2w (e.g. HSS6X6 under a W12X40), never with the fallback shapes | OK |
| 12 | Database path | Simulated in-page with the exact xlsx object shape (`t: '–'`, `tdes` 0.465, `area` 28.3, `B` 12, `H` parsed from the label): all 10 rows identical to the fallback run, summary prints t_des = 0.465, no page errors. Round HSS (B = '–') would hit the "H, B and design wall thickness are required" error rather than NaN rows | OK |
| 13 | Save/load | New inputs (`boltGage`, `beamEndDist`, `firstBoltDist`, `hssWeldSize`, `hssWeldFexx`, `weldIncludePZ`) are static ids in always-present sections; `are-utils-v2.js` captures inputs by key and handles checkboxes (`fieldValue`, `freezeFormState`). `numRows` reduced to one option: a saved 3-line record restores to 2 (the only option) — acceptable under the new scope | OK |
| 14 | Defaults (Nick Q1) | t_p 0.625, L_e,p 1.75, 1 in bolt `selected`, g 3.5, L_e,b 2, first bolt 3, 9/16 in E70, PZ on. Page opens on Ex. 4.2 and every row passes (weld 0.93, base metal 0.96) | OK |
| 15 | Schematic | Bolts at `firstBoltDist` + i·s, plate length fb + (n − 1)s + L_e; 8 plate-to-HSS fillet marks (2 plates × 2 faces × 2 sides), 12 total in welded mode | OK |
| 16 | Test harness independence | Inline arithmetic is written from the inputs (J4-5, bearing sum, weld line group, PZ), not from `TPC`; asserts 10 bolted + 12 welded rows by name, Ex. 4.2 all-pass, DG24 ½ in convention 0.947 PASS with PZ off and 1.05 FAIL with PZ on, error paths, notes, schematic marks, selftest title, fixtures. Gap: ASD is asserted only in fixtures (W-DG24, W-PZ), not in rendered rows; the DB path is not reachable (xlsx 404) — covered here by the in-page simulation only | OK (minor gaps noted) |
| 17 | Backslash-hex build trap | No `\<hex>` sequences in the calc (only `±` inside a JS string, which is fine) | OK |
| 18 | Results after fixes | `node tools/test-through-plate.mjs`: 42/42 PASS (was 41); `?selftest=1`: TPC fixtures 44/44 (was 40) | OK |

### Edits made by the verifier

1. `public/Calcs/through_plate_calculator.html`, `TPC.hssWeld`: `Math.abs(o.MuSeg)` / `Math.abs(o.MaSeg)` in the moment term, with a comment (finding 5).
2. Same file, `TPC.panelZone`: J10-10 factor clamped `Math.max(0, 1.4 − αP_r/P_y)` (finding 7).
3. Same file, fixtures: `PZ-DG24` gains "factor clamped at 0 (Pu 2000)"; new fixture `W-REV` (reversed loads give the same f, f_a, D/C).
4. Same file, weld det panel: prints \|M_u,seg\| / \|M_a,seg\| so the substituted line matches the arithmetic.
5. `tools/test-through-plate.mjs`: new check "bolted: reversed beam loads give identical rows" (swaps left/right live moment and shear, compares all 10 rows to 1e-9, swaps back).

No other code changed. Plan items C1–C7, J5 and the re-verification ruling (full ΔR on the weld) are implemented as written; Nick's scope decisions (continuous column, M_seg = M_conn/2, 2 lines, no cap-plate rows) are stated in the input note, the Column Side header and the summary.

VERDICT: SHIP
