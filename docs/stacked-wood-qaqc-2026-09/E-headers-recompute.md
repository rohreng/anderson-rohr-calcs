# E — Independent NDS 2018 recompute: stacked headers, jambs, king studs, wall studs

**Target** `public/Calcs/stacked_headers_studs_calculator.html` (1,288 lines, 79,187 bytes) — read-only.
**Live read** `tools/_qaqc-stacked-headers-live.mjs` (scratch; serves `public/` through `page.route`,
loads `http://calcs.test/Calcs/stacked_headers_studs_calculator.html`, waits for `#areBar`, then calls
`checkOneHeader` / `checkJambGroup` / `designJambs` / `designKingStud` / `checkWallStudSingle` /
`calcCL` / `calcCP` directly via `page.evaluate`). **Zero page errors and zero dialogs** across every
probe set — the only console entries are three 404s for assets that live outside `public/`.
**Recompute** `scratchpad/phase1/E_nds2018.py`, written from the NDS text (not from the page source),
driven by `E_compare.py` and `E_published.py`; fixtures by `E_fixtures.py` / `E_fixtures_pub.py`.

**Validation of the recompute itself:** before comparing anything to the calculator, the recompute was
run against five published worked examples and reproduces every one to 3–4 significant figures
(AWC E1.2a C_L 0.8756 vs 0.876; E1.4 C_P 0.2319 vs 0.232; E1.5a C_P 0.7048 vs 0.705;
E1.7 Eq. 3.9-3 0.8871 vs 0.89; E1.9 Eq. 3.9-3 0.5863 vs 0.59).

---

## 1. Summary (5 lines)

1. **No — the calculator does not reproduce the published examples.** On AWC E1.2a it returns
   C_L = 0.9892 against a published 0.876 (**+12.9%**); on AWC E1.5a it returns C_P = 0.1124 against
   0.705 (**−84%**); on the VF trimmer-stud problem it returns D/C 2.782 against a published 0.347
   (**8.0×**); on AWC E1.9 it returns Eq. 3.9-3 = 0.511 against 0.59 (**−13%, unconservative**).
2. Four **seal-blockers**: `calcCP` clamps `l_e/d` to 50 instead of rejecting the member per §3.7.1.4;
   `calcCL` clamps `R_B` to **10** instead of the §3.3.3.7 limit of **50** (C_L overstated up to +230%,
   and never able to fall below ≈0.99 for any input the page accepts); the Southern Pine reference
   table overstates F_b by **25–40%** at every width against Supplement Table 4B; and `designKingStud`
   bends the king stud about its **weak** axis.
3. Three **must-fixes** in the load engine: roof live and snow are *added* to the same member
   (+35.1%, forbidden by ASCE 7-16 §2.4.1); headers and jambs are pinned at `C_D = 1.0` (−13% under
   snow but **+11.1% unconservative** for dead-load-only members, where C_D = 0.9); and **deflection
   is never computed** — `I` and `E` are in the data tables and referenced nowhere in the file.
4. The divergences run in **both directions at once and do not cancel predictably**: the same engine
   is 8.0× conservative on a published jamb stud and 13% unconservative on a published wall stud, two
   examples apart.
5. `calcCP` itself is **exactly correct** whenever `l_e/d ≤ 50` (AWC E1.4 reproduces to 4 significant
   figures), and the `LBR` geometry table is exact in all 15 entries — the defects are localised to
   the clamps, the species table, the axis choice, and the load/combination engine.

---

## 2. Formulas, section ids, reference pages, inputs

### Code basis

| Item | Source (file, page) | Value adopted |
|---|---|---|
| l_e for bending members | NDS 2018 w/ Commentary, **Table 3.3.3**, PDF p.30 (printed 16) | Single span, UDL: `l_u/d < 7 → 2.06 l_u`; `l_u/d ≥ 7 → 1.63 l_u + 3d`. **Only two branches.** The three-branch form with `1.84 l_u` above `l_u/d = 14.3` is **footnote 1**, which applies *only* to "loading conditions not specified in Table 3.3.3" |
| R_B | **§3.3.3.6**, Eq. 3.3-5, PDF p.31 | `R_B = sqrt(l_e d / b²)` |
| R_B limit | **§3.3.3.7**, PDF p.31 | verbatim: "The slenderness ratio for bending members, R_B, **shall not exceed 50**." No construction relaxation |
| C_L | **§3.3.3.8**, Eq. 3.3-6, PDF p.31 | `F_bE = 1.20 E'_min / R_B²`; `A = (1+F_bE/F_b*)/1.9`; `C_L = A − sqrt(A² − (F_bE/F_b*)/0.95)` |
| C_L = 1.0 shortcuts | §3.3.3.1/.2/.3 and **§4.4.1.2**, PDF p.29, 45 | `d ≤ b`; or compression edge supported throughout with ends restrained; or `2 < d/b ≤ 4` with ends held in position |
| f_v | **§3.4.2**, Eq. 3.4-2, PDF p.31 | `f_v = 3V/(2bd)` |
| Shear relief | **§3.4.3.1(a)**, PDF p.31 | UDL within `d` of the support face may be ignored — *not* taken in this recompute (conservative) |
| C_P | **§3.7.1.5**, Eq. 3.7-1, PDF p.35 | `F_cE = 0.822 E'_min/(l_e/d)²`; `A = (1+F_cE/F_c*)/(2c)`; `C_P = A − sqrt(A² − (F_cE/F_c*)/c)`; **c = 0.8** sawn |
| C_P limit | **§3.7.1.4**, PDF p.35 | verbatim: "The slenderness ratio for solid columns, l_e/d, **shall not exceed 50**, except that during construction l_e/d shall not exceed 75." Commentary C3.7.1.5 confirms Eq. 3.7-1 remains *valid* above 50 — the 50 is a code prohibition, not a numerical boundary |
| Weak-axis bracing | **Commentary C3.6.7**, PDF p.220, and **NDS A.11.3** | "wood structural panels, fiberboard, hardboard, gypsumboard, or other sheathing materials provide adequate lateral support of the stud across its thickness when properly fastened" |
| Eq. 3.9-3 | **§3.9.2**, PDF p.36-37 | `(f_c/F'_c)² + f_b1/[F'_b1(1 − f_c/F_cE1)] + f_b2/[F'_b2(1 − f_c/F_cE2 − (f_b1/F_bE)²)] ≤ 1.0`, with `F_cE1 = 0.822 E'_min/(l_e1/d1)²` about the **edgewise bending** axis |
| C_b | **§3.10.4**, Eq. 3.10-2 and Table 3.10.4, PDF p.38 | `C_b = (l_b+0.375)/l_b`, **but** F_c⊥ "apply to bearings of **any length at the ends of a member**" — so a header bearing on its jambs gets **C_b = 1.0**. `C_b = 1.25` at `l_b = 1.5 in` only away from member ends |
| C_r | **§4.3.9**, PDF p.44 | 1.15 where members are "**not less than three in number**", in contact or ≤ 24 in o.c., and "joined by floor, roof or other load distributing elements". **F_b only** |
| C_D | **Table 2.3.2**, PDF p.25 | permanent 0.9 · ten years 1.0 · two months (snow) 1.15 · seven days (roof live) 1.25 · ten minutes (wind) 1.6. Footnote 1: C_D does **not** apply to E, E_min or F_c⊥ |
| Combinations | **ASCE 7-16 §2.4.1** (NDS §1.4.4 defers to the code) | D; D+L; D+(L_r **or** S); D+0.75L+0.75(L_r **or** S); D+0.6W; D+0.75L+0.75(0.6W)+0.75(L_r or S); 0.6D+0.6W |
| Deflection | **§3.5.1**, PDF p.33, and **§1.4.2**, PDF p.17 | NDS prescribes **no numeric limit** and defers to the building code; IBC Table 1604.3 used (L/360 live, L/240 total). AWC E1.3 verbatim: "The specification does not include specific deflection limits for roofs" |
| DFL / SPF No.2 values | **Supplement Table 4A**, PDF p.42, p.45 | DFL: 900/575/180/625/1350/1.6e6/580,000. SPF (combined No.1/No.2 row): 875/450/135/425/1150/1.4e6/510,000 |
| Size factor C_F | **Supplement Table 4A adj. factors**, PDF p.40 | F_b: 1.5/1.3/1.2/1.1/1.0 · F_c: 1.15/1.10/1.05/1.00/1.00 for 2x4…2x12 |
| SP No.2 values | **Supplement Table 4B**, PDF p.48-49 | see **E-3** |

**Verified against the page as shipped:** the `LBR` table is exact in all 15 entries
(`A = bd`, `S = bd²/6`, `I = bd³/12`); `NDS_REF.DFL` and `NDS_REF.SPF` match Table 4A exactly;
`CF_Fb` and `CF_Fc` match the Table 4A adjustment-factor block exactly; `SYP.useCF = false` is
correct because Table 4B values already contain the size adjustment. `NDS_REF.SYP`'s F_b, F_c, E and
E_min do not — see E-3.

### Calculator inputs used (read live, not assumed)

```
species DFL (first <option>, no `selected`)      wallWidth 2x6 -> PLIES_MAP = 3 plies
flrHt 9 ft        windOpen 25 psf        windStud 25 psf
LV = {roofDL 20, roofLL 20, snowLoad 25, floorDL 15, floorLL1 40, floorLL2 100,
      wall1DL 15, wall2DL 25, wall3DL 10}  psf
floors = [Roof, 3rd Floor, 2nd Floor];  headers: [] on every floor until addHeader() is called
addHeader(0) template: span 8 ft, roofTrib 10, floorTrib1 0, wallTrib 8, wallType 1,
      trialSz 2x8, rowWallSz 2x6, jambCount 0 (auto), kingCount 1, topOfOpening 6.0, kingAxial 0
stud row S1 "Exterior Long Side": roof level roofTrib 10, lower levels floorTrib1 5,
      wallTrib 8, wallType 1, 2x6 @ 16 in o.c.; spacing <select> offers 12 / 16 / 24 only
```

Derived roof-level header loads: `D = 15·8 + 10·20 = 320 plf`, `L_r = 10·20 = 200 plf`,
`S = 10·25 = 250 plf`, `L = 0`.

---

## 3. Case tables

### Case 1 — calculator defaults, Roof header H-1 (3-ply 2x8 DFL, 8 ft span)

Recompute governing combination **D + S**, `w = 570 plf`, `C_D = 1.15`.
Calculator: `w = 770 plf` (D + L_r + S), `C_D = 1.0`.

| Quantity | Recompute | Calculator | Published | Delta % | Note |
|---|---|---|---|---|---|
| w_total (plf) | 570 | 770 | — | **+35.1%** | calculator adds L_r **and** S (E-5) |
| C_D | 1.15 | 1.00 | — | −13.0% | Table 2.3.2; hard-coded (E-6) |
| M (lb·in) | 54,720 | 73,920 | — | +35.1% | `570·8²/8·12` |
| V (lb) | 2,280 | 3,080 | — | +35.1% | `570·8/2` |
| l_u/d | 13.24 | 13.24 | — | 0.0% | `96/7.25` → the `≥ 7` branch |
| l_e (in) | 178.23 | 178.23 | — | 0.0% | `1.63·96 + 3·7.25` — **calculator is correct here** |
| R_B | 7.988 | 7.988 | — | 0.0% | below the clamp |
| F_bE (psi) | 10,907 | 10,907 | — | 0.0% | `1.20·580,000/63.81` |
| C_L | 0.9937 | 0.9946 | — | +0.1% | |
| F_b* (psi) | 1,242 | 1,080 | — | −13.0% | `900·1.15·1.2` vs `900·1.0·1.2` |
| F'_b (psi) | 1,234.1 | 1,074.1 | — | −13.0% | |
| f_b (psi) | 1,388.1 | 1,875.0 | — | +35.1% | |
| **D/C flexure** | **1.125** | **1.746** | — | **+55.2%** | both FAIL |
| f_v (psi) | 104.8 | 141.6 | — | +35.1% | `1.5V/A_eff` |
| F'_v (psi) | 207 | 180 | — | −13.0% | |
| D/C shear | 0.506 | 0.787 | — | +55.4% | |
| bearing l_b (in) | 1.5 | 1.5 | — | 0.0% | calculator hard-codes it (E-11) |
| C_b | 1.00 | 1.00 | — | 0.0% | correct — §3.10.4 excludes member ends |
| f_c⊥ (psi) | 337.8 | 456.3 | — | +35.1% | |
| F'_c⊥ (psi) | 625 | 625 | — | 0.0% | no C_D on F_c⊥ (Table 2.3.2 fn.1) |
| D/C bearing | 0.540 | 0.730 | — | +35.1% | |
| Δ_live (in) | 0.1008 | **not computed** | — | — | allow `L/360 = 0.2667` (E-7) |
| Δ_total (in) | 0.2297 | **not computed** | — | — | allow `L/240 = 0.4000` (E-7) |
| **Governing D/C** | **1.125** | **1.746** | — | **+55.2%** | |

**Jamb pack** (P_D 1,280 / P_Lr 800 / P_S 1,000 lb → governing D+S, P = 2,280 lb, C_D = 1.15):

| n | Recompute C_P | Recompute F'_c | Recompute f_c | Recompute D/C | Calc C_P | Calc f_c | Calc D/C |
|---|---|---|---|---|---|---|---|
| 1 | 0.2552 (weak, blocked @48 in) | 435.7 | 276.4 | **0.634 PASS** | 0.1249 | 373.3 | **2.014 FAIL** |
| 2 | 0.2552 | 435.7 | 138.2 | 0.317 PASS | 0.1249 | 186.7 | 1.007 FAIL |
| 3 | 0.2552 | 435.7 | 92.1 | 0.211 PASS | 0.1249 | 124.4 | 0.671 PASS |

Recompute selects **1 jamb**; the calculator's auto-search selects **3**. Both the
weak-axis-braced C_P (0.2552) and the strong-axis C_P (0.5715) are far above the clamped 0.1249.
At the calculator's own stated `l_e/d = 72` the correct C_P is **0.0642** — so the clamp is
**+94.5% unconservative relative to the model the calculator claims to be using**.

**King stud** (2x6, 9 ft, 8 ft opening, kingAxial = 0, 25 psf):

| Quantity | Recompute | Calculator | Published | Delta % | Note |
|---|---|---|---|---|---|
| wind model | uniform `w` over the full height | whole trib **area** as one point load at 6 ft | — | — | E-13 |
| trib width | 4.667 ft (`8/2 + 1.333/2`) | n/a — area 18 ft² | — | — | spacing/2 strip dropped |
| w_ASD (plf) | 70.0 (`0.6·25·4.667`) | n/a | — | — | E-10 |
| M (lb·in) | 8,505 | 10,800 | — | +27.0% | |
| S used (in³) | 7.5625 (**S_x**) | 2.0625 (**S_y** = `d b²/6`) | — | **−72.7%** | **E-4** |
| f_b (psi) | 1,124.6 | 5,236.4 | — | **+365.6%** | |
| C_r | 1.00 | 1.15 | — | +15.0% | §4.3.9 needs ≥ 3 members (E-8) |
| F'_b (psi) | 1,872 | 2,152.8 | — | +15.0% | |
| **Eq. 3.9-3** | **0.601** | **2.432** | — | **+304.9%** | recompute PASS, calculator FAIL |

If the 25 psf input were already an ASD (0.6W) pressure, the recompute gives **1.001** — still 2.4×
below the calculator.

**Wall studs**, 2x6 @ 16 in o.c., 9 ft, accumulated floor to floor:

| Floor | D / L / L_r / S (plf) | Rec. C_P | Rec. f_c | Rec. f_b | Rec. D/C | Calc C_P | Calc f_c | Calc f_b | Calc D/C |
|---|---|---|---|---|---|---|---|---|---|
| Roof | 320 / 0 / 200 / 250 | 0.4478 | 51.7 | 321.3 | **0.158 PASS** | 0.0789 | 124.4 | 535.5 | **0.717 PASS** |
| 3rd Floor | 515 / 200 / 200 / 250 | 0.4478 | 83.2 | 321.3 | **0.166 PASS** | 0.0789 | 188.3 | 535.5 | **1.302 FAIL** |
| 2nd Floor | 710 / 400 / 200 / 250 | 0.4478 | 114.7 | 321.3 | **0.176 PASS** | 0.0789 | 252.1 | 535.5 | **2.121 FAIL** |

Recompute governing combination is D + 0.6W (C_D = 1.6) at all three levels; wind deflection
0.089 in against L/240 = 0.450 in. The shipped default sheet **fails its own stud rows on two of
three floors** on a wall that is at 18% of capacity.

### Case 2 — published examples through `calcCL` / `calcCP` directly

**2a · AWC Ex. E1.2a**, PDF p.15-18 (printed 7-10) — DF-L Select Structural 4x16, 20 ft, concentrated
load at centre, lateral support at the ends only.
Inputs: F_b 1500, E 1,900,000, E_min 690,000, b 3.5, d 15.25, S 135.66 in³, I 1034 in⁴, l_u 240 in,
all C factors 1.0.

| Quantity | Recompute | Calculator | Published | Δ% rec vs pub | Note |
|---|---|---|---|---|---|
| Table 3.3.3 row | concentrated @ ctr, `l_u/d ≥ 7` | **uniform row only** | concentrated @ ctr, `l_u/d ≥ 7` | — | no load-pattern input exists |
| l_e (in) | 374.6 | 436.9 | 375 | −0.12% | calculator forces `1.63l_u+3d` |
| R_B | 21.593 | **10.000** | 21.6 | −0.03% | calculator clamps to 10 |
| R_B ≤ 50 (§3.3.3.7) | yes | **not tested** | yes | — | |
| F_bE (psi) | 1,776 | 8,280 | 1,776 | −0.01% | |
| **C_L** | **0.8756** | **0.9892** | **0.876** | **−0.04%** | **calculator +12.9% vs published** |
| F'_b (psi) | 1,313 | 1,484 | 1,313 | +0.03% | |
| M_max (ft·lb) | 14,849 | — | 14,849 | −0.00% | |
| P allowable (lb) | 2,831 | — | 2,831 | −0.01% | |

Published shear `f_v = 40 psi` vs `F'_v = 180`; bearing `f_c⊥ = 116` vs `F'_c⊥ = 625` with
**C_b not used** (E1.2a verbatim: *"NDS Section 4.3.12 allows F_c⊥ to be increased by C_b … That
increase was not used in this example."*); deflection 0.44 in, L/Δ = 545.

**2b · AWC Ex. E1.4**, PDF p.31-35 — No.2 Southern Pine 4x4 column, 10 ft, pinned, C_D = 1.0.

| Quantity | Recompute | Calculator | Published | Δ% |
|---|---|---|---|---|
| l_e/d | 34.286 | 34.286 | 34.3 | −0.04% |
| F_cE (psi) | 356.6 | 356.6 | 357 | −0.10% |
| C_P | 0.2319 | 0.2319 | 0.232 | −0.03% |
| F'_c (psi) | 336.3 | 336.3 | 336 | +0.09% |
| P allowable (lb) | 4,120 | 4,120 | 4,120 | −0.00% |

**`calcCP` is exactly correct whenever `l_e/d ≤ 50`.** The engine defect is the clamp, nothing else.

**2c · AWC Ex. E1.5a**, PDF p.36-38 — No.2 SPF 2x6 stud, 91.5 in, sheathed both faces, D+S.
AWC verbatim: *"l_e2 = 0 … Strong axis buckling controls. See NDS A.11.3 regarding lateral support
of the weak axis due to gypsum sheathing."*

| Quantity | Recompute | Calculator | Published | Δ% rec vs pub |
|---|---|---|---|---|
| governing axis | strong (weak sheathed) | **WEAK, unbraced full height** | strong (weak sheathed) | — |
| d used (in) | 5.5 | **1.5** | 5.5 | 0.00% |
| l_e/d | 16.636 | **50.0** (true 61.0) | 16.636 | 0.00% |
| F_c* (psi) | 1,455 | 1,455 | 1,455 | −0.02% |
| F_cE (psi) | 1,515 | 167.7 | 1,515 | −0.02% |
| **C_P** | **0.7048** | **0.1124** | **0.705** | −0.03% |
| F'_c (psi) | 1,025 | 163.5 | 1,025 | +0.02% |
| P buckling (lb) | 8,458 | 1,349 | 8,458 | +0.00% |

Calculator understates C_P by **84%**. Published bearing check (an *interior* bearing, so C_b does
apply): `l_b = 1.5 in → C_b = 1.25`, `P_bearing = 3,506 lb`, `P_bearing,increased = 4,383 lb`,
labelled "Controlling Value" — a bearing limit state the calculator does not check for studs at all.

### Case 3 — published beam-column / stud / header problems through the calculator's routines

**3a · AWC Ex. E1.7**, PDF p.48-52 — No.1 SP 2x6 beam-column, 9 ft, 4 ft o.c., 25 psf on the narrow
face, P = 560 D + 840 S. Load Case 1 (D+S+W, C_D = 1.6).

| Quantity | Recompute | Calculator | Published | Δ% rec vs pub |
|---|---|---|---|---|
| l_e1 (in) | 108 (d = 5.5, l_e2 = 0 per A.11.3) | 108 (d = 1.5) | 108 | 0.00% |
| F_c* (psi) | 2,480 | — | 2,480 | 0.00% |
| F_cE (psi) | 1,236 | — | 1,236 | +0.04% |
| C_P | 0.4326 | **0.0781** | 0.433 | −0.09% |
| F'_c (psi) | 1,073 | **187.5** | 1,073 | −0.01% |
| f_c (psi) | 169.7 | 169.7 | 170 | −0.18% |
| C_L | 1.0 | 1.0 | 1.0 | — |
| F'_b1 (psi) | 2,160 (C_r = 1.0) | **2,300** (C_r forced 1.15) | 2,160 | 0.00% |
| M (lb·in) | 12,150 | — | 12,150 | 0.00% |
| f_b1 (psi) | 1,607 | 1,606.6 | 1,607 | −0.02% |
| term 1 | 0.0250 | — | 0.0251 | — |
| term 2 | 0.8621 | — | 0.8625 | −0.04% |
| **Eq. 3.9-3** | **0.8871** | **1.6285 FAIL** | **0.89** | **−0.32%** |

Calculator is **+83%** against the published value. *Inputs that cannot be mapped:* grade (E1.7 is
**No.1**; the calculator offers No.2 only), a C_r override (AWC uses 1.0), a weak-axis bracing
length, and a per-combination axial load. AWC's printed `R_B = 16` is rounded from 16.248 —
F_bE = 2636 back-solves to `R_B² = 264`.

**3b · AWC Ex. E1.9**, PDF p.63-87 — No.2 Southern Pine 2x8, 16 in o.c., 19 ft balloon-framed, full
ASCE 7-16 set. Governing MWFRS case LC5a = D + 0.6W, P = 483 lb, C_D = 1.6.

| Quantity | Recompute | Calculator | Published | Δ% rec vs pub |
|---|---|---|---|---|
| l_e/d | 31.448 (d = 7.25) | **50.0** (true 152) | 31.45 | −0.01% |
| F_cE (psi) | 423.9 | — | 424 | −0.03% |
| C_P | 0.1876 | 0.0781 | 0.188 | −0.22% |
| F'_c (psi) | 405.2 | 187.5 | 405 | +0.04% |
| f_c (psi) | 44.41 | 44.41 | 44 | +0.94% |
| **F_b reference (psi)** | **925** (Table 4B, 8 in, No.2) | **1,250** | **925** | **0.00%** |
| F'_b (psi) | 1,850 (C_r 1.25) | **2,300** | 1,850 | 0.00% |
| M (lb·in) | 12,500 | — | 12,500 | −0.02% |
| f_b (psi) | 951.1 | 950.5 | 951 | +0.01% |
| **Eq. 3.9-3** | **0.5863** | **0.5113** | **0.59** | **−0.63%** |

**The calculator reads 0.511 against a published 0.59 — 13% unconservative.** The inflated Southern
Pine F_b (E-3, +35% at 2x8) and the forced C_r more than cancel the C_P clamp. AWC also reports the
C&C case governs strength at `f_b/F'_b = 0.76`, with a C&C wind deflection of 0.84 in
(L/Δ = 273 > L/180). Note AWC uses **C_r = 1.25** here, the SDPWS §3.1.1.1 wall-stud factor, not the
NDS §4.3.9 value of 1.15.

**3c · "2 - VF Wood Depth Refresher and Solutions.pdf"** p.26-31 — DF-L header over an opening,
8 ft span, and its trimmer (jamb) studs. Published loads D 888 / L_r 350 / S 613 / L 1240 plf.

Combination envelope — published vs recompute:

| Combination | w (plf) | C_D | w/C_D | |
|---|---|---|---|---|
| D | 888.0 | 0.90 | 986.7 | |
| **D+L** | **2,128.0** | **1.00** | **2,128.0** | **governs — matches the published "critical loading condition" LC2** |
| D+L_r | 1,238.0 | 1.25 | 990.4 | |
| D+0.75L+0.75L_r | 2,080.5 | 1.25 | 1,664.4 | |
| D+S | 1,501.0 | 1.15 | 1,305.2 | |
| D+0.75L+0.75S | 2,277.8 | 1.15 | 1,980.7 | |

Published `M_max = 17.02 kip·ft`; recompute `17.02 kip·ft`.

Bearing — the published method, which the calculator does not implement:
*"Since the load duration factor, C_D, is not applied to F_c⊥', Use LC4"* →
`l_b required = R/(b·F'_c⊥) = 2278 plf × 4 ft / (5.5 in × 625 psi) = 2.65 in` →
*"Therefore, use (2) 2x6 trimmer studs, l_b = 3 in."* **The jamb count is set by the bearing
requirement.** The calculator hard-codes `l_b = 1.5 in` and never links the two (E-11).

Trimmer stud, directly mappable onto `checkJambGroup(2, 8510, 'DFL', '2x6', 9)`:

| | f_c (psi) | C_P | F'_c (psi) | D/C | Verdict |
|---|---|---|---|---|---|
| **Published** | 516 | **1.0** (studs in a sheathed wall) | 1,485 | **0.347** | OK |
| **Recompute** | 515.8 | 1.0 | 1,485 | **0.347** | OK — exact |
| **Calculator** | 515.8 | **0.1249** (l_e/d reported 50.0, true 72.0) | **185.4** | **2.782** | **FAIL** |

**Calculator D/C is 8.0× the published value.**

**3d · "3 - VF Wood Breadth Workshop Solutions.pdf"** p.26-30 — DF-L No.1 2x4 stud, 8 ft, 24 in o.c.

Published `r = max(l_e1/d, l_e2/b) = 27.4` → **strong axis governs** (96/3.5 = 27.43), a fourth
published source bracing the weak axis.

| Quantity | Recompute | Published |
|---|---|---|
| l_e/d | 27.43 | 27.4 |
| F_cE (psi) | 677.4 | 677 |
| F_c* (psi) | 2,760 | 2,760 |
| C_P | 0.2315 | 0.23 |
| F'_c (psi) | 638.9 | 639 |
| f_b (psi) | 1,253.9 | 1,254 |
| F'_b (psi) | 2,760 | 2,760 |
| Eq. 3.9-3 | 0.0142 + 0.5119 = **0.5261** | **0.53** |

*Source defects, flagged not fixed:* p.26 states W = 20 psf but the solution table and all arithmetic
use 33 psf; `C_F,c` is printed as 1.2 but 1.15 is used throughout (`1725/1500 = 1.15`). Secondary
check only. The grade (No.1) is again unavailable in the calculator.

### Case 4 — 2x6 jamb pack, 9 ft vs 10 ft, braced vs unbraced weak axis

| Story | n | Rec. C_P weak @48 in | Rec. C_P strong | Rec. governing C_P | Rec. D/C | Calc C_P | Calc l_e/d **reported** | **True** weak l_e/d | Calc D/C |
|---|---|---|---|---|---|---|---|---|---|
| 9 ft | 1 | 0.2552 | 0.5715 | 0.2552 | 0.634 | 0.1249 | 50.0 | **72.0** | 2.014 |
| 9 ft | 2 | 0.2552 | 0.5715 | 0.2552 | 0.317 | 0.1249 | 50.0 | 72.0 | 1.007 |
| 9 ft | 3 | 0.2552 | 0.5715 | 0.2552 | 0.211 | 0.1249 | 50.0 | 72.0 | 0.671 |
| 10 ft | 1 | 0.2552 | 0.4915 | 0.2552 | 0.634 | 0.1249 | 50.0 | **80.0** | 2.014 |
| 10 ft | 2 | 0.2552 | 0.4915 | 0.2552 | 0.317 | 0.1249 | 50.0 | 80.0 | 1.007 |
| 10 ft | 3 | 0.2552 | 0.4915 | 0.2552 | 0.211 | 0.1249 | 50.0 | 80.0 | 0.671 |

**The calculator returns byte-identical numbers at 9 ft and 10 ft.** `l_e/d` saturates the clamp at
any story ≥ 6.25 ft (`75/1.5 = 50`), so *Floor-to-Floor Height* has **no effect whatsoever** on jamb
or wall-stud axial capacity for any real wall. Confirmed directly:
`calcCP(1350, 580000, 1.0, 1.1, 108, 1.5)` and `calcCP(…, 120, 1.5)` both return
`{slen: 50, FcE: 190.704, CP: 0.124857}`.

### Case 5 — headers across the Table 3.3.3 bands (DFL, 3-ply, D 320 / L_r 200 / S 250 plf)

| Case | l_u/d | Correct branch | l_e rec | l_e calc | Δ% l_e | R_B rec | R_B calc | C_L rec | C_L calc | Δ% C_L | D/C_b rec | D/C_b calc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2x8 3-ply, 4 ft | 6.62 | `< 7` → 2.06 l_u | 98.88 | 99.99 | **+1.1%** | 5.950 | 5.983 | 0.99665 | 0.99708 | +0.04% | 0.280 | 0.435 |
| 2x10 3-ply, 8 ft | 10.38 | `≥ 7` → 1.63 l_u + 3d | 184.23 | 184.23 | 0.0% | 9.174 | 9.174 | 0.99215 | 0.99330 | +0.12% | 0.755 | 1.171 |
| 2x12 3-ply, 16 ft | 17.07 | `≥ 7` → 1.63 l_u + 3d | 346.71 | 346.71 | 0.0% | **13.879** | **10.000** | 0.98084 | 0.99269 | **+1.21%** | 2.271 | 3.487 |

Two separate C_L issues, and the reference work settled which is which:

* **The `l_u/d ≥ 7` branch is correct as coded.** The named Table 3.3.3 row for a uniformly loaded
  single span has only two branches; the `1.84 l_u` form is footnote 1, for *unlisted* loading
  conditions. Only the `l_u/d < 7` branch (`2.06 l_u`) is missing, and there the error is
  **+1.1% and conservative** — the two expressions cross at `l_u/d = 6.96`. Minor (E-12).
* **The `R_B ≤ 10` clamp is the real defect** and first bites in the 16 ft row: `R_B` 13.879 → 10.000,
  `F_bE` 3,613 → 6,960 psi.

Deflection on the 16 ft row: `Δ_total = 0.984 in` vs `L/240 = 0.800 in` → **deflection D/C 1.23**,
not reported.

### Case 6 — R_B clamp exposure (NDS §3.3.3.7)

| Member | l_u | R_B true | C_L correct | C_L engine | Overstatement |
|---|---|---|---|---|---|
| 2x12 2-ply | 20 ft | 23.05 | 0.9208 | 0.9927 | **+7.8%** |
| 2x12 2-ply | 24 ft | 25.08 | 0.8858 | 0.9927 | **+12.1%** |
| 2x12 1-ply | 16 ft | 41.64 | 0.4299 | 0.9927 | **+130.9%** |
| 2x12 1-ply | 24 ft | 50.16 | 0.3009 | 0.9927 | **+229.9%** — and `R_B > 50`, so not applicable at all |
| 4x16 Sel Str (AWC E1.2a) | 20 ft | 23.96 | 0.876 (published) | 0.9892 | **+12.9%** |

`Math.min(…, 10)` floors `F_bE` at `1.20·580,000/100 = 6,960 psi` for DFL, against `F_b*` of
900–1,350 psi. The ratio never falls below ≈5, so **C_L can never drop below ≈0.99 for any input the
page accepts.** The beam-stability check is, in effect, switched off.

### Case 7 — l_e/d > 50 applicability failure (NDS §3.7.1.4)

`checkWallStudSingle('2x6', 16, 25, 20, 1000, 'DFL')` — a 20 ft unbraced 2x6:

| Quantity | Correct | Calculator |
|---|---|---|
| l_e (in) | 240 | 240 |
| l_e/d | **160** | **reported as 50.0** |
| §3.7.1.4 satisfied | **No** | not tested |
| Result | **NOT APPLICABLE — must refuse** | C_P = 0.1249, axial D/C = **0.872 → PASS** |

`checkJambGroup(1, 4000, 'DFL', '2x4', 12)` likewise reports `l_e/d = 50.0` against a true 96.0.

The UI compounds it: the row rendered beside every jamb result is
`Slenderness L_e/d ≤ 50 · §3.7.1.4` with the demand printed as `jc.cp.slen` — **the already-clamped
value**. It therefore reads `50.0 / 50 = 1.00 → PASS` for every input at every story height. **That
check cannot fail.**

---

## 4. Expected-value fixtures

Full machine-readable set: **22 fixtures** in `scratchpad/phase1/E-fixtures.json`
(`E-fixtures-core.json` + `E-fixtures-pub.json`), generated by `E_fixtures.py` / `E_fixtures_pub.py`.
Schema: `{id, kind, provenance, inputs, published?, expected, calculator_today}`.

IDs: `HDR-DEFAULT-ROOF` · `JAMB-DEFAULT-ROOF` · `KING-DEFAULT-ROOF` · `STUD-DEFAULT-ROOF` ·
`STUD-DEFAULT-3RD` · `STUD-DEFAULT-2ND` · `JAMB-2X6-9FT` · `JAMB-2X6-10FT` · `HDR-BAND-2X8-4FT` ·
`HDR-BAND-2X10-8FT` · `HDR-BAND-2X12-16FT` · `HDR-RB-OVER-50-NOT-APPLICABLE` ·
`STUD-LE-OVER-D-OVER-50-NOT-APPLICABLE` · `HDR-DEFLECTION-GOVERNS` · `PUB-AWC-E1.2a-CL` ·
`PUB-AWC-E1.4-CP` · `PUB-AWC-E1.5a-STUD-CP` · `PUB-AWC-E1.7-BEAMCOLUMN` · `PUB-AWC-E1.9-WALLSTUD` ·
`PUB-VF-TRIMMER-JAMB` · `PUB-VF-HEADER-BEARING` · `REF-SYP-TABLE-4B`

Abridged:

```json
[
 {"id":"HDR-DEFAULT-ROOF","kind":"header",
  "provenance":"Calculator shipped defaults read live; NDS 2018 Sec 3.3.3/3.4.2/3.10 + ASCE 7-16 Sec 2.4.1 + Table 2.3.2",
  "inputs":{"size":"2x8","n_plies":3,"span_ft":8.0,"lu_ft":8.0,"species":"DFL",
            "D_plf":320.0,"L_plf":0.0,"Lr_plf":200.0,"S_plf":250.0,"n_jambs_bearing":1,"Cr":1.0},
  "expected":{"governing_combo":"D+S","w_plf":570.0,"C_D":1.15,"M_lb_in":54720.0,"V_lb":2280.0,
              "le_in":178.23,"le_branch":"lu/d >= 7 -> le = 1.63 lu + 3d (Table 3.3.3, single span, UDL)",
              "R_B":7.9882,"R_B_le_50":true,"F_bE_psi":10907.2547,"C_L":0.9937,
              "Fb_star_psi":1242.0,"Fb_prime_psi":1234.1273,"fb_psi":1388.0618,"DC_flexure":1.1247,
              "fv_psi":104.8276,"Fv_prime_psi":207.0,"DC_shear":0.5064,
              "bearing_lb_in":1.5,"C_b":1.0,"C_b_basis":"1.0 - Sec 3.10.4 excludes bearings at member ends",
              "fcperp_psi":337.7778,"Fcperp_prime_psi":625.0,"DC_bearing":0.5404,
              "defl_live_in":0.1008,"defl_live_allow_in":0.2667,
              "defl_total_in":0.2297,"defl_total_allow_in":0.4,
              "governing_DC":1.1247,"passes":false},
  "calculator_today":{"w_plf":770,"C_D":1.0,"C_L":0.9946,"fb_psi":1875.0,"Fb_prime_psi":1074.1333,
                      "DC_flexure":1.7456,"DC_shear":0.7867,"DC_bearing":0.7301,
                      "deflection":"NOT CHECKED"}},

 {"id":"JAMB-DEFAULT-ROOF","kind":"jamb_pack",
  "provenance":"Same defaults; NDS 2018 Sec 3.7.1 Eq. 3.7-1, c=0.8, K_cE=0.822; applicability per Sec 3.7.1.4",
  "inputs":{"size":"2x6","n":1,"P_D_lb":1280.0,"P_L_lb":0.0,"P_Lr_lb":800.0,"P_S_lb":1000.0,
            "story_ft":9.0,"species":"DFL","weak_axis_brace_in":48.0,"Ke":1.0},
  "expected":{"governing_combo":"D+S","P_lb":2280.0,"C_D":1.15,"Fc_star_psi":1707.75,
              "weak_braced":{"le_in":48.0,"le_over_d":32.0,"F_cE_psi":465.5859,"C_P":0.2552},
              "strong":{"le_in":108.0,"le_over_d":19.6364,"F_cE_psi":1236.4532,"C_P":0.5715},
              "weak_unbraced_le_over_d":72.0,"weak_unbraced_applicable":false,
              "governing_axis":"weak(braced)","C_P":0.2552,"Fc_prime_psi":435.7,
              "fc_psi":276.3636,"DC":0.6342,"min_jambs_required":1},
  "calculator_today":{"le_over_d_reported":50.0,"C_P":0.1249,"Fc_prime_psi":185.41,
                      "DC_n1":2.0135,"min_jambs_chosen":3}},

 {"id":"KING-DEFAULT-ROOF","kind":"king_stud",
  "provenance":"25 psf is the ASCE 7-16 Ch.30 STRENGTH-level C&C pressure handed over by
                asce716_cc_wind_calculator.html sendToHeaders(); ASD wind = 0.6 x 25 = 15 psf.
                NDS 2018 Eq. 3.9-3, bending about the STRONG axis",
  "inputs":{"size":"2x6","species":"DFL","story_ft":9.0,"opening_ft":8.0,"stud_spacing_in":16.0,
            "trib_width_ft":4.6667,"p_strength_psf":25.0,"P_gravity_lb":0.0,"Cr":1.0,
            "weak_axis":"sheathed"},
  "expected":{"governing_combo":"D+0.6W","C_D":1.6,"w_ASD_plf":70.0,"M_lb_in":8505.0,
              "S_x_in3":7.5625,"fb_psi":1124.6281,"Fb_prime_psi":1872.0,"C_P":0.4478,
              "Fc_prime_psi":1063.9159,"F_cE1_psi":1236.4532,
              "term1":0.0,"term2":0.6008,"interaction_DC":0.6008,"passes":true},
  "calculator_today":{"model":"whole trib AREA (18 sf) as one POINT load at 6 ft",
                      "S_used_in3":2.0625,"S_axis":"WEAK (d b^2/6)","M_lb_in":10800.0,
                      "fb_psi":5236.4,"Cr":1.15,"interaction_DC":2.4324}},

 {"id":"STUD-DEFAULT-2ND","kind":"wall_stud",
  "provenance":"Default row 'Exterior Long Side' accumulated to the 2nd Floor; NDS 2018 Eq. 3.9-3;
                C_r=1.15 per Sec 4.3.9; weak axis braced by sheathing per NDS A.11.3 / C3.6.7",
  "inputs":{"size":"2x6","spacing_in":16.0,"species":"DFL","story_ft":9.0,
            "D_plf":710.0,"L_plf":400.0,"Lr_plf":200.0,"S_plf":250.0,
            "p_strength_psf":25.0,"Cr":1.15,"weak_axis":"sheathed"},
  "expected":{"governing_combo":"D+0.6W","C_D":1.6,"C_P":0.4478,
              "C_P_axis":"strong (weak axis sheathed)","fc_psi":114.6667,"fb_psi":321.3223,
              "Fc_prime_psi":1063.9159,"Fb_prime_psi":2152.8,"F_cE1_psi":1236.4532,
              "term1":0.0116,"term2":0.1645,"interaction_DC":0.1762,
              "wind_defl_in":0.0891,"wind_defl_allow_L240_in":0.45,"passes":true},
  "calculator_today":{"C_P":0.0789,"le_over_d_reported":50.0,"le_over_d_true":72.0,
                      "fc_psi":252.1212,"fb_psi":535.5372,"DC_wind":2.1207,
                      "DC_axial_gravity":1.3598,"gov":2.1207}},

 {"id":"JAMB-2X6-9FT","kind":"jamb_pack",
  "inputs":{"size":"2x6","n":2,"story_ft":9.0,"species":"DFL",
            "P_D_lb":1280.0,"P_Lr_lb":800.0,"P_S_lb":1000.0,"weak_axis_brace_in":48.0},
  "expected":{"C_P_weak_braced_48in":0.2552,"C_P_strong":0.5715,"C_P_governing":0.2552,
              "weak_unbraced_le_over_d":72.0,"weak_unbraced_applicable":false,
              "Fc_prime_psi":435.7,"fc_psi":138.1818,"DC":0.3171},
  "calculator_today":{"C_P":0.1249,"le_over_d_reported":50.0,"DC":1.0068,
    "note":"byte-identical at 9 ft and 10 ft - the le/d clamp saturates above a 6.25 ft story"}},

 {"id":"JAMB-2X6-10FT","kind":"jamb_pack",
  "inputs":{"size":"2x6","n":2,"story_ft":10.0,"species":"DFL",
            "P_D_lb":1280.0,"P_Lr_lb":800.0,"P_S_lb":1000.0,"weak_axis_brace_in":48.0},
  "expected":{"C_P_weak_braced_48in":0.2552,"C_P_strong":0.4915,"C_P_governing":0.2552,
              "weak_unbraced_le_over_d":80.0,"weak_unbraced_applicable":false,
              "Fc_prime_psi":435.7,"fc_psi":138.1818,"DC":0.3171},
  "calculator_today":{"C_P":0.1249,"le_over_d_reported":50.0,"DC":1.0068}},

 {"id":"HDR-BAND-2X8-4FT","kind":"header",
  "provenance":"Table 3.3.3, single span UDL, lu/d = 6.62 -> the 2.06 lu branch",
  "inputs":{"size":"2x8","n_plies":3,"span_ft":4.0,"lu_ft":4.0,"species":"DFL",
            "D_plf":320.0,"L_plf":0.0,"Lr_plf":200.0,"S_plf":250.0,"n_jambs_bearing":1},
  "expected":{"lu_over_d":6.6207,"le_branch":"lu/d < 7 -> le = 2.06 lu","le_in":98.88,
              "R_B":5.9497,"R_B_le_50":true,"F_bE_psi":19660.0,"C_L":0.9967,
              "DC_flexure":0.2803,"DC_shear":0.2532,"DC_bearing":0.5404,"governing_DC":0.2803},
  "calculator_today":{"le_in":99.99,"R_B":5.9832,"F_bE_psi":19442.0,"C_L":0.9971,
                      "DC_flexure":0.4353,"gov":0.4353}},

 {"id":"HDR-BAND-2X10-8FT","kind":"header",
  "provenance":"Table 3.3.3, single span UDL, lu/d = 10.38 -> the 1.63 lu + 3d branch",
  "inputs":{"size":"2x10","n_plies":3,"span_ft":8.0,"lu_ft":8.0,"species":"DFL",
            "D_plf":320.0,"L_plf":0.0,"Lr_plf":200.0,"S_plf":250.0,"n_jambs_bearing":1},
  "expected":{"lu_over_d":10.3784,"le_branch":"lu/d >= 7 -> le = 1.63 lu + 3d","le_in":184.23,
              "R_B":9.1736,"R_B_le_50":true,"F_bE_psi":8270.5,"C_L":0.9922,
              "DC_flexure":0.7549,"DC_shear":0.3966,"DC_bearing":0.5404,"governing_DC":0.7549},
  "calculator_today":{"le_in":184.23,"R_B":9.1736,"F_bE_psi":8270.5,"C_L":0.9933,
                      "DC_flexure":1.1714,"gov":1.1714}},

 {"id":"HDR-BAND-2X12-16FT","kind":"header",
  "provenance":"Table 3.3.3, single span UDL, lu/d = 17.07. NOTE: the NAMED uniform row has only
                two branches; the 1.84 lu form above lu/d = 14.3 is footnote 1, for loading
                conditions NOT listed.  First row where the engine's R_B <= 10 clamp bites.",
  "inputs":{"size":"2x12","n_plies":3,"span_ft":16.0,"lu_ft":16.0,"species":"DFL",
            "D_plf":320.0,"L_plf":0.0,"Lr_plf":200.0,"S_plf":250.0,"n_jambs_bearing":1},
  "expected":{"lu_over_d":17.0667,"le_branch":"lu/d >= 7 -> le = 1.63 lu + 3d","le_in":346.71,
              "R_B":13.8786,"R_B_le_50":true,"F_bE_psi":3613.3945,"C_L":0.9808,
              "Fb_prime_psi":1015.1679,"fb_psi":2305.8963,"DC_flexure":2.2714,
              "DC_shear":0.6527,"DC_bearing":1.0809,
              "defl_total_in":0.9838,"defl_total_allow_in":0.8,"DC_defl_total":1.2298,
              "governing_DC":2.2714},
  "calculator_today":{"le_in":346.71,"R_B":10.0,"F_bE_psi":6960.0,"C_L":0.9927,
                      "DC_flexure":3.4865,"gov":3.4865}},

 {"id":"HDR-RB-OVER-50-NOT-APPLICABLE","kind":"header_applicability",
  "provenance":"NDS 2018 Sec 3.3.3.7 verbatim: 'The slenderness ratio for bending members, R_B,
                shall not exceed 50.'  Single-ply 2x12, 24 ft unbraced span.",
  "inputs":{"size":"2x12","n_plies":1,"span_ft":24.0,"lu_ft":24.0,"species":"DFL"},
  "expected":{"le_in":503.19,"le_branch":"lu/d >= 7 -> le = 1.63 lu + 3d","R_B":50.1592,
              "R_B_le_50":false,
              "result":"NOT APPLICABLE - the engine must refuse, not return a D/C"},
  "calculator_today":{"R_B_reported":10.0,"C_L":0.9927,"C_L_correct":0.3009,
                      "note":"R_B silently clamped to 10; C_L overstated +230%"}},

 {"id":"STUD-LE-OVER-D-OVER-50-NOT-APPLICABLE","kind":"stud_applicability",
  "provenance":"NDS 2018 Sec 3.7.1.4 verbatim: 'The slenderness ratio for solid columns, le/d,
                shall not exceed 50, except that during construction le/d shall not exceed 75.'",
  "inputs":{"size":"2x6","spacing_in":16.0,"story_ft":20.0,"species":"DFL",
            "axial_plf":1000.0,"p_strength_psf":25.0,"weak_axis":"UNBRACED"},
  "expected":{"le_in":240.0,"d_in":1.5,"le_over_d":160.0,"le_over_d_le_50":false,
              "result":"NOT APPLICABLE - the engine must refuse, not return a D/C"},
  "calculator_today":{"le_over_d_reported":50.0,"C_P":0.1249,"DC_axial_gravity":0.8717,
                      "note":"the axial-only check reports PASS at a true le/d of 160"}},

 {"id":"HDR-DEFLECTION-GOVERNS","kind":"header",
  "provenance":"Found by sweeping the live engine: both stress checks pass but IBC Table 1604.3
                L/240 total-load does not.  SPF has the lowest E (1.4e6).  NDS Sec 3.5.1
                prescribes no numeric limit and defers to the building code (Sec 1.4.2).",
  "inputs":{"size":"2x10","n_plies":4,"span_ft":28.0,"species":"SPF",
            "D_plf":60.0,"L_plf":0.0,"Lr_plf":0.0,"S_plf":0.0,"n_jambs_bearing":2},
  "expected":{"governing_combo":"D","C_D":0.9,"DC_flexure":0.9644,"DC_shear":0.1869,
              "defl_total_in":1.4978,"defl_total_allow_in":1.4,"DC_defl_total":1.0698,
              "governing_DC":1.0698,"passes":false},
  "calculator_today":{"gov":0.865,"verdict":"PASS","deflection":"NOT CHECKED"}},

 {"id":"PUB-AWC-E1.2a-CL","kind":"beam_stability",
  "provenance":"AWC '2015/2018 Structural Wood Design Examples' Ex. E1.2a, PDF p.15-18
                (printed 7-10).  DF-L Select Structural 4x16, 20 ft, concentrated load at center,
                lateral support at the ends only.",
  "inputs":{"Fb_psi":1500.0,"E_psi":1900000.0,"Emin_psi":690000.0,"b_in":3.5,"d_in":15.25,
            "S_in3":135.66,"I_in4":1034.0,"lu_in":240.0,"C_D":1.0,"C_M":1.0,"C_t":1.0,
            "C_F":1.0,"C_fu":1.0,"C_r":1.0,"C_i":1.0,"C_T":1.0,
            "load_pattern":"concentrated at center"},
  "published":{"lu_over_d":15.7,"le_in":375.0,
    "table_row":"Single Span Beam, concentrated load at center, lu/d>=7 -> le = 1.37 lu + 3d",
    "R_B":21.6,"F_bE_psi":1776.0,"C_L":0.876,"Fb_prime_psi":1313.0,"M_max_ftlb":14849.0,
    "P_allow_lb":2831.0,"f_v_psi":40.0,"Fv_prime_psi":180.0,"f_cperp_psi":116.0,
    "Fcperp_prime_psi":625.0,"C_b":"not used - end bearing","defl_in":0.44,"L_over_delta":545},
  "expected":{"le_in":374.55,"R_B":21.5934,"R_B_le_50":true,"F_bE_psi":1775.8,
              "C_L":0.8756,"Fb_prime_psi":1313.5},
  "calculator_today":{"le_in":436.95,"R_B":10.0,"F_bE_psi":8280.0,"C_L":0.9892,
    "note":"calcCL forces the uniform-load row AND clamps R_B to 10; C_L +12.9% vs published"}},

 {"id":"PUB-AWC-E1.4-CP","kind":"column_stability",
  "provenance":"AWC Ex. E1.4, PDF p.31-35 (printed 23-27).  No.2 Southern Pine 4x4, 10 ft,
                pinned (Ke = 1.0), gravity only, C_D = 1.0.",
  "inputs":{"Fc_psi":1450.0,"E_psi":1400000.0,"Emin_psi":510000.0,"d_in":3.5,"A_in2":12.25,
            "le_in":120.0,"c":0.8,"K_cE":0.822},
  "published":{"le_over_d":34.3,"F_cE_psi":357.0,"Fc_star_psi":1450.0,"C_P":0.232,
               "Fc_prime_psi":336.0,"P_allow_lb":4120.0},
  "expected":{"le_over_d":34.2857,"le_over_d_le_50":true,"F_cE_psi":356.6,"C_P":0.2319,
              "Fc_prime_psi":336.3,"P_allow_lb":4119.6},
  "calculator_today":{"le_over_d":34.2857,"F_cE_psi":356.6,"C_P":0.2319,
    "note":"EXACT match - calcCP is correct whenever le/d <= 50; the defect is the clamp alone"}},

 {"id":"PUB-AWC-E1.5a-STUD-CP","kind":"wall_stud",
  "provenance":"AWC Ex. E1.5a, PDF p.36-38 (printed 28-30).  No.2 SPF 2x6 stud, 91.5 in, sheathed
                both faces, D+S.  AWC verbatim: 'le2 = 0 ... Strong axis buckling controls.  See
                NDS A.11.3 regarding lateral support of the weak axis due to gypsum sheathing.'",
  "inputs":{"size":"2x6","species":"SPF","Fc_psi":1150.0,"Emin_psi":510000.0,"Fcperp_psi":425.0,
            "length_in":91.5,"C_D":1.15,"C_F_c":1.1,"le1_in":91.5,"le2_in":0.0},
  "published":{"governing_axis":"strong","le1_over_d":16.636,"Fc_star_psi":1455.0,
    "F_cE_psi":1515.0,"C_P":0.705,"Fc_prime_psi":1025.0,"P_buckling_lb":8458.0,
    "bearing_lb_in":1.5,"C_b":1.25,"Fcperp_prime_psi":425.0,"P_bearing_lb":3506.0,
    "P_bearing_with_Cb_lb":4383.0,
    "governs":"bearing with C_b (interior bearing, not a member end)"},
  "expected":{"le_over_d":16.6364,"F_cE_psi":1514.7,"C_P":0.7048,"Fc_prime_psi":1025.3,
              "P_buckling_lb":8458.5},
  "calculator_today":{"axis":"WEAK, unbraced full height","le_over_d_reported":50.0,
    "le_over_d_true":61.0,"F_cE_psi":167.7,"C_P":0.1124,
    "note":"C_P understated 84% vs published"}},

 {"id":"PUB-AWC-E1.7-BEAMCOLUMN","kind":"beam_column",
  "provenance":"AWC Ex. E1.7, PDF p.48-52 (printed 40-44).  No.1 Southern Pine 2x6, 9 ft,
                4 ft o.c., 25 psf on the narrow face, P = 560 D + 840 S.  LC1 D+S+W, C_D = 1.6.",
  "inputs":{"size":"2x6","Fb_psi":1350.0,"Fc_psi":1550.0,"Emin_psi":580000.0,"length_ft":9.0,
            "spacing_ft":4.0,"w_psf":25.0,"P_D_lb":560.0,"P_S_lb":840.0,"C_D":1.6,"C_F":1.0,
            "C_r":1.0,"C_L":1.0,"le1_in":108.0,"le2_in":0.0},
  "published":{"Fc_star_psi":2480.0,"F_cE_psi":1236.0,"C_P":0.433,"Fc_prime_psi":1073.0,
    "f_c_psi":170.0,"Fb1_prime_psi":2160.0,"M_lb_in":12150.0,"f_b1_psi":1607.0,
    "term1":0.0251,"term2":0.8625,"eq_3_9_3":0.89,
    "note":"printed R_B = 16 is rounded from 16.248; F_bE 2636 back-solves to R_B^2 = 264"},
  "expected":{"F_cE_psi":1236.4532,"C_P":0.4326,"Fc_prime_psi":1072.7,"f_c_psi":169.697,
              "Fb1_prime_psi":2160.0,"M_lb_in":12150.0,"f_b1_psi":1606.6,
              "term1":0.025,"term2":0.8621,"eq_3_9_3":0.8871},
  "calculator_today":{"route":"checkWallStudSingle('2x6', 48, 25, 9, 350, 'SYP')",
    "C_P":0.0781,"Fc_prime_psi":187.5,"Fb_prime_psi":2300.0,"eq_3_9_3":1.6285,
    "unmappable_inputs":["grade (No.1; the calculator offers No.2 only)",
                         "C_r override (AWC 1.0, the calculator forces 1.15)",
                         "weak-axis bracing length","per-combination axial load"]}},

 {"id":"PUB-AWC-E1.9-WALLSTUD","kind":"wall_stud",
  "provenance":"AWC Ex. E1.9, PDF p.63-87 (printed 55-79).  No.2 Southern Pine 2x8, 16 in o.c.,
                19 ft balloon-framed, full ASCE 7-16 set.  Governing MWFRS case LC5a = D + 0.6W.",
  "inputs":{"size":"2x8","species":"Southern Pine No.2","Fb_psi":925.0,"Fc_psi":1350.0,
            "Emin_psi":510000.0,"spacing_in":16.0,"height_ft":19.0,"le_in":228.0,"d1_in":7.25,
            "C_D":1.6,"C_r":1.25,"C_L":1.0,"P_lb":483.0,"w_plf":23.08,
            "note_Cr":"AWC uses the SDPWS 3.1.1.1 wall-stud factor 1.25, not the NDS 4.3.9 1.15"},
  "published":{"F_cE_psi":424.0,"Fc_star_psi":2160.0,"C_P":0.188,"Fc_prime_psi":405.0,
    "f_c_psi":44.0,"Fb_prime_psi":1850.0,"M_lb_in":12500.0,"f_b_psi":951.0,"eq_3_9_3":0.59,
    "CC_governs_strength":{"f_b_psi":1400.0,"ratio":0.76,"defl_in":0.84,"L_over_delta":273,
                           "limit":"L/180 per IBC Table 1604.3 fn.(f)"}},
  "expected":{"F_cE_psi":423.86,"C_P":0.1876,"Fc_prime_psi":405.2,"f_c_psi":44.4138,
              "Fb_prime_psi":1850.0,"M_lb_in":12499.4,"f_b_psi":951.1,"eq_3_9_3":0.5863},
  "calculator_today":{"route":"checkWallStudSingle('2x8', 16, 17.3, 19, 362.25, 'SYP')",
    "Fb_ref_psi":1250.0,"C_P":0.0781,"Fc_prime_psi":187.5,"Fb_prime_psi":2300.0,
    "f_b_psi":950.5,"eq_3_9_3":0.5113,
    "note":"reads 0.511 against a published 0.59 - UNCONSERVATIVE.  The inflated SYP F_b (E-3)
            more than cancels the C_P clamp."}},

 {"id":"PUB-VF-TRIMMER-JAMB","kind":"jamb_pack",
  "provenance":"'2 - VF Wood Depth Refresher and Solutions.pdf' p.31.  (2) 2x6 DF-L No.2 trimmer
                studs under an 8 ft header, P = 8.51 kips, 9 ft story.",
  "inputs":{"size":"2x6","n":2,"species":"DFL","P_lb":8510.0,"story_ft":9.0,"C_D":1.0,"C_F_c":1.1},
  "published":{"f_c_psi":516.0,"C_P":1.0,"Fc_prime_psi":1485.0,"DC":0.347,"verdict":"OK",
    "basis":"C_P = 1.0 - trimmer studs inside a sheathed wall are braced"},
  "expected":{"f_c_psi":515.7576,"C_P":1.0,"Fc_prime_psi":1485.0,"DC":0.3473},
  "calculator_today":{"f_c_psi":515.7576,"C_P":0.1249,"le_over_d_reported":50.0,
    "le_over_d_true":72.0,"Fc_prime_psi":185.4134,"DC":2.7817,"verdict":"FAIL",
    "note":"calculator D/C is 8.0x the published value"}},

 {"id":"PUB-VF-HEADER-BEARING","kind":"header_bearing",
  "provenance":"'2 - VF Wood Depth Refresher and Solutions.pdf' p.26-30.  DF-L header over an
                opening, 8 ft span, D 888 / Lr 350 / S 613 / L 1240 plf.",
  "inputs":{"span_ft":8.0,"D_plf":888.0,"L_plf":1240.0,"Lr_plf":350.0,"S_plf":613.0,
            "b_header_in":5.5,"Fcperp_psi":625.0},
  "published":{"governing_combo":"D+L","w_plf":2128.0,"C_D":1.0,"M_kipft":17.02,
    "bearing_combo":"D+0.75L+0.75(Lr or S)","bearing_w_plf":2278.0,"lb_required_in":2.65,
    "solution":"(2) 2x6 trimmer studs, l_b = 3 in",
    "note":"C_D is not applied to F_cperp, so the largest UNFACTORED combination governs bearing"},
  "expected":{"governing_combo":"D+L","w_plf":2128.0,"C_D":1.0,"M_kipft":17.024,
              "lb_required_in":2.6503},
  "calculator_today":{"bearing_lb_in":1.5,
    "note":"l_b hard-coded to 1.5 in and never linked to the jamb count the same function selects"}},

 {"id":"REF-SYP-TABLE-4B","kind":"reference_values",
  "provenance":"NDS 2018 Supplement Table 4B, PDF p.48-49 (printed 40-41), Southern Pine No.2
                (plain sub-grade), 2-4 in thick.  Corroborated by AWC E1.4 (4x4: Fc 1450,
                E 1.4e6, Emin 510,000), E1.8 (2x4: Fb 1100), E1.9 (2x8: Fb 925).",
  "inputs":{"species":"SYP","grade":"No.2","thickness":"2-4 in"},
  "expected":{"Fb_psi":{"2x4":1100,"2x6":1000,"2x8":925,"2x10":800,"2x12":750},
              "Fc_psi":{"2x4":1450,"2x6":1400,"2x8":1350,"2x10":1300,"2x12":1250},
              "Fv_psi":175,"Fcperp_psi":565,"E_psi":1400000,"Emin_psi":510000,
              "C_F":"1.0 - Table 4B values already include the size adjustment"},
  "calculator_today":{"Fb_psi":{"2x4":1500,"2x6":1250,"2x8":1250,"2x10":1050,"2x12":1050},
    "Fc_psi":{"2x4":1650,"2x6":1500,"2x8":1500,"2x10":1500,"2x12":1500},
    "Fv_psi":175,"Fcperp_psi":565,"E_psi":1600000,"Emin_psi":580000,"useCF":false,
    "Fb_error":{"2x4":"+36.4%","2x6":"+25.0%","2x8":"+35.1%","2x10":"+31.2%","2x12":"+40.0%"},
    "Fc_error":{"2x4":"+13.8%","2x6":"+7.1%","2x8":"+11.1%","2x10":"+15.4%","2x12":"+20.0%"},
    "E_error":"+14.3%","Emin_error":"+13.7%",
    "note":"matches no row of Table 4B; E/Emin are the No.2 DENSE sub-grade values"}}
]
```

---

## 5. Findings

### E-1 — `calcCP` clamps `l_e/d` to 50 instead of rejecting the member — **SEAL-BLOCKER**

`calcCP`, line 412: `var c=0.8, KcE=0.822, slen=Math.min(Le_in/d_in,50);`

NDS §3.7.1.4, verbatim: *"The slenderness ratio for solid columns, l_e/d, shall not exceed 50,
except that during construction l_e/d shall not exceed 75."* Commentary C3.7.1.5 confirms Eq. 3.7-1
remains numerically valid above 50 — so the 50 is a **code prohibition**, and substituting a false
slenderness is the one response the Specification does not permit.

Evidence:
* `checkWallStudSingle('2x6', 16, 25, 20, 1000, 'DFL')` — a 20 ft unbraced 2x6, true `l_e/d` = 160 —
  returns `cp_g.slen = 50`, `C_P = 0.12486`, gravity axial D/C = **0.8717 → PASS**.
* `checkJambGroup(1, 4000, 'DFL', '2x4', 12)` reports `l_e/d = 50.0` against a true 96.0.
* The UI row `Slenderness L_e/d ≤ 50 · §3.7.1.4` prints `jc.cp.slen`, the **already-clamped** value,
  so the demand/capacity is permanently `50/50 = 1.00` and **the check can never fail**.
* Because the clamp saturates at any story ≥ 6.25 ft, **`flrHt` has no effect** on jamb or stud axial
  capacity: 9 ft and 10 ft return byte-identical results (Case 4).
* At the calculator's own stated model (`l_e/d = 72` for a 9 ft 2x6 weak axis) the correct C_P is
  **0.0642**; the clamp gives 0.1249 — **+94.5% unconservative against its own assumption**.

**Fix:** compute `slen = Le_in/d_in` unclamped; if `slen > 50`, return an explicit
`NOT APPLICABLE (NDS 3.7.1.4)` state that propagates to a FAIL banner, and drive the slenderness UI
row off the unclamped value.

### E-2 — `calcCL` clamps `R_B` to 10; the NDS limit is 50 — **SEAL-BLOCKER**

`calcCL`, line 404: `var RB = Math.min(Math.sqrt(le*d_in/(b_in*b_in)), 10);`

NDS §3.3.3.7, verbatim: *"The slenderness ratio for bending members, R_B, shall not exceed 50."*
The literal `10` appears to be a transposition of `50`.

Evidence:
* **AWC Ex. E1.2a** (PDF p.15-18), fed identical F_b / E_min / geometry: the engine returns
  `R_B = 10.000` and `C_L = 0.9892` against a published `R_B = 21.6`, `C_L = 0.876` —
  **+12.9% unconservative on a published AWC example.**
* `F_bE` is floored at `1.20·580,000/100 = 6,960 psi` for DFL, against `F_b*` of 900–1,350 psi. The
  ratio never falls below ≈5, so **C_L can never drop below ≈0.99 for any input the page accepts.**
  The beam-stability check is effectively switched off.
* Single-ply 2x12 at 24 ft: correct `C_L = 0.3009`, engine `0.9927` — **+230%**, and `R_B = 50.16`
  exceeds §3.3.3.7 so the member is outside Chapter 3 entirely.

**Fix:** `Math.min(..., 50)`, and return a `NOT APPLICABLE (NDS 3.3.3.7)` state above 50.

### E-3 — Southern Pine reference values overstate F_b by 25–40% — **SEAL-BLOCKER**

`NDS_REF.SYP` (lines 362-368) ships:

| Size | F_b shipped | F_b Table 4B No.2 | Δ | F_c shipped | F_c Table 4B | Δ |
|---|---|---|---|---|---|---|
| 2x4 | 1500 | **1100** | **+36.4%** | 1650 | 1450 | +13.8% |
| 2x6 | 1250 | **1000** | **+25.0%** | 1500 | 1400 | +7.1% |
| 2x8 | 1250 | **925** | **+35.1%** | 1500 | 1350 | +11.1% |
| 2x10 | 1050 | **800** | **+31.2%** | 1500 | 1300 | +15.4% |
| 2x12 | 1050 | **750** | **+40.0%** | 1500 | 1250 | +20.0% |

plus `E = 1,600,000` against **1,400,000** (+14.3%) and `E_min = 580,000` against **510,000**
(+13.7%) — and E_min drives both C_L and C_P. `F_v = 175` and `F_c⊥ = 565` are correct;
`useCF: false` is correct because Table 4B values already contain the size adjustment.

Source: NDS 2018 Supplement Table 4B, PDF p.48-49 (printed 40-41). Corroborated independently by
three AWC worked examples that state their Table 4B row: **E1.4** (4x4 No.2: F_c 1450, E 1.4e6,
E_min 510,000), **E1.8** (2x4 No.2: F_b 1100), **E1.9** (2x8 No.2: F_b 925).

The shipped row matches **no** row of Table 4B. The E/E_min pair (1.6e6 / 580,000) are the **No.2
Dense** sub-grade values, while the F_b values are higher than any plain No.2 row at every width.
The UI badge reads "NDS 2018 — No. 2 Grade".

Demonstrated end to end: on AWC E1.9 the calculator returns Eq. 3.9-3 = **0.5113** against a
published **0.59** — the inflated F_b (+35% at 2x8) and the forced C_r more than cancel the C_P
clamp, leaving the sheet **13% unconservative on a published AWC wall stud.**

**Fix:** replace the SYP F_b, F_c, E and E_min entries with the Table 4B No.2 values above.

### E-4 — `designKingStud` bends the king stud about the weak axis — **SEAL-BLOCKER**

`designKingStud`, line ~492: `var S_weak = lb.d*lb.b*lb.b/6;` then `fb_k = M_max_in/S_weak`.

Out-of-plane wind bends a stud about its **strong** axis. For a 2x6 the engine uses
`S = 2.0625 in³` where `S_x = 7.5625 in³` — a 3.67× understatement. The companion
`FcE_k = 0.822*Emin/Math.pow(Le_in/lb.b,2)` is likewise taken about the weak axis, so the §3.9.2
amplification term is on the wrong axis too.

Evidence: shipped defaults give `f_b = 5,236 psi` and Eq. 3.9-3 = **2.4324 FAIL**; the recompute
gives `f_b = 1,125 psi` and **0.6008 PASS** — a **+305%** error. The default sheet fails its own
king stud on a wall that is at 60% of capacity. AWC E1.7 and E1.9 both bend the stud about `d`.

**Fix:** use `S_x = b d²/6` and `F_cE1 = 0.822 E'_min/(l_e/d)²` with `d` = member depth. `C_L = 1.0`
remains correct because the compression edge is sheathed (§3.3.3.3 / §4.4.1.2(b)).

### E-5 — roof live load and snow are added to the same member — **MUST-FIX**

`calcLoads` / `calcStudLoads` build `llPlf` from `roofTrib·roofLL` **and** `slPlf` from
`roofTrib·snowLoad`; `checkOneHeader` then sums `w_total = w_DL + w_LL + w_SL`.
ASCE 7-16 §2.4.1 combinations 3 and 4 read `D + (L_r **or** S **or** R)` — they are alternatives.

Evidence: the shipped defaults give `w = 320 + 200 + 250 = 770 plf` where the governing correct value
is `D + S = 570 plf` — **+35.1%** on M, V, f_b, f_v, f_c⊥ and on every accumulated jamb and stud
axial load. The published VF header example (Case 3c) enumerates the combinations correctly and
picks the largest; the recompute reproduces its choice (D+L at 2,128 plf) exactly.

**Fix:** envelope the ASCE 7-16 §2.4.1 combinations and carry the governing one, rather than summing
all load classes. Pair each combination with its own C_D (E-6).

### E-6 — headers and jambs are pinned at `C_D = 1.0` — **MUST-FIX**

`checkOneHeader` line 421 and `checkJambGroup` line 442 both hard-code `Cd = 1.0`.
NDS Table 2.3.2: permanent 0.9 / ten-year 1.0 / two-month (snow) 1.15 / seven-day (roof live) 1.25.

Evidence: for the default snow-governed header the correct `C_D = 1.15`, so the calculator is 13.0%
low on F'_b, F'_v and F'_c — conservative. But for a **dead-load-dominated** member `C_D = 0.9`, so
the calculator is **+11.1% unconservative**: fixture `HDR-DEFLECTION-GOVERNS` (4-ply 2x10 SPF, 28 ft,
D = 60 plf) reads gov D/C 0.865 PASS where the correct flexural D/C is 0.9644.

**Fix:** derive C_D from the governing combination found in E-5. Keep C_D off E, E_min and F_c⊥
(Table 2.3.2 footnote 1) — the calculator already does this correctly for F_c⊥.

### E-7 — deflection is never computed — **MUST-FIX**

`grep` for `\.I\b`, `sp_data\.E\b`, `deflect`, `L/360`, `L/240` over the whole file returns **zero
hits**. `LBR[*].I` and `NDS_REF[*].E` are dead data. There is no serviceability check and no
disclosure that one is missing.

NDS §3.5.1 prescribes no numeric limit and §1.4.2 defers to the building code; IBC Table 1604.3
applies. AWC E1.2a, E1.3 and E1.9 and the VF header example all compute deflection explicitly.

Evidence: fixture `HDR-DEFLECTION-GOVERNS` — the calculator reports gov D/C 0.865 **PASS** while
`Δ_total = 1.498 in` against `L/240 = 1.400 in` (D/C 1.07). Honest scope: a sweep of 3,780 header
cases through the live engine found the calculator's own inflated stress check masks the gap across
most of the practical range (1 of 1,404 floor-header cases and 3 of 507 long-span cases pass stress
while failing deflection). That masking is an accident of E-5 and E-6 and **disappears the moment
they are fixed**. Case 5's 16 ft 2x12 row has a deflection D/C of 1.23.

**Fix:** add `Δ = 5 w L⁴/(384 E I_eff)` for the live and total cases with IBC Table 1604.3 limits,
and a wind deflection check for the studs (AWC E1.9 uses L/180 with the IBC 1604 fn.(f) factor).

### E-8 — `C_r = 1.15` applied to king studs — **MUST-FIX**

`designKingStud` line ~490: `var Cd=1.6, Cr=1.15;` then `Fb_p = Fb*Cd*CFb*1.0*Cr`.

NDS §4.3.9 permits C_r only where members are "**not less than three in number**", in contact or at
≤ 24 in o.c., and joined by a load-distributing element. A king stud group is typically 1–2 members,
and the page's own `kingCount` field **defaults to 1**.

Evidence: `F'_b = 2,152.8 psi` instead of 1,872 — **15% unconservative** on the bending term of
Eq. 3.9-3. AWC E1.7, a genuine 4 ft o.c. beam-column, uses `C_r = 1.0`.

Wall studs are fine: the spacing `<select>` offers only 12 / 16 / 24 in, so C_r = 1.15 is always
justified there.

**Fix:** `Cr = (kingCount >= 3) ? 1.15 : 1.0`.

### E-9 — jambs and studs are modelled as weak-axis unbraced over the full story — **MUST-FIX**

`checkJambGroup`: `Le_in = flrHt_ft*12; cp = calcCP(..., Le_in, lb.b)` — buckling about the 1.5 in
dimension over the whole story. `checkWallStudSingle` does the same for its C_P.

Four independent published sources brace the weak axis with the sheathing:
* **AWC E1.5a**: *"l_e2 = 0 … Strong axis buckling controls. See NDS A.11.3 regarding lateral
  support of the weak axis due to gypsum sheathing."*
* **AWC E1.7**: *"L_e2 can be assumed to equal 0 per NDS A.11.3."*
* **AWC E1.9**: *"Assume gypsum wallboard is adequately connected to the studs and provides lateral
  support (NDS A.11.3)"* — `d1 = d = 7.25 in`.
* **VF Breadth stud**: `r = max(l_e1/d, l_e2/b) = 27.4` — the strong axis governs.
* NDS **Commentary C3.6.7**: *"Experience has shown that wood structural panels, fiberboard,
  hardboard, gypsumboard, or other sheathing materials provide adequate lateral support of the stud
  across its thickness when properly fastened."*

Evidence: on AWC E1.5a the calculator returns C_P = 0.1124 against a published 0.705 (**−84%**); on
the VF trimmer-stud problem it returns D/C 2.782 against a published 0.347 (**8.0×**), and it selects
3 jamb studs where 1 suffices. The page's note box states the assumption ("K_e = 1.0 weak-axis C_P")
but a stated wrong assumption is still a wrong answer — and E-1's clamp then hides its consequences.

**Fix:** take the governing C_P as `min(weak-axis with a user-entered bracing interval, strong-axis
over the story height)`, defaulting the weak-axis brace to the sheathing (or to blocking at 48 in for
an unsheathed condition), and expose the bracing interval as an input.

### E-10 — strength-level C&C wind pressure used directly as an ASD demand — **MUST-FIX**

`asce716_cc_wind_calculator.html` `sendToHeaders()` passes `govP` — the raw ASCE 7-16 Ch. 30
pressure `p = q_h[(GC_p) − (GC_pi)]`, a **strength-level** value — into `?windOpen=&windStud=`.
`designKingStud` and `checkWallStudSingle` apply it unfactored with `C_D = 1.6`. ASD requires
`0.6W`. The input labels read only "Wind on Openings (psf)" / "Wind on Wall Studs (psf)" and the
banner says "gov. |p|", so nothing tells the user which level is expected.

Evidence: the default 25 psf should enter the ASD checks as 15 psf — the wind bending demand is
**1.67× too high**. Conservative, but silently inconsistent with the 0.75 / 0.45 pairing the
combinations require, and it will surprise anyone who reconciles the two sheets.

Additionally, both stud routines combine the **full unfactored** D + L_r + S axial with the full wind
at `C_D = 1.6`. AWC E1.7 does use a simplified `D+S+W` at C_D = 1.6, so the *shape* has precedent —
but AWC E1.9, the rigorous wall-stud example, uses the full ASCE 7-16 list with 0.6 built into q_h
and 0.75 pairing. The calculator does neither consistently: it uses the E1.7 shape and feeds it an
E1.9-level pressure.

**Fix:** relabel the inputs as strength-level and apply 0.6 internally (or accept ASD pressures and
say so on the sheet), and envelope the real combinations for the axial term.

### E-11 — header bearing length hard-coded to 1.5 in, not linked to the jamb count — **SHOULD-FIX**

`checkOneHeader`: `var A_bear = b_eff*1.5;` and the UI prints `L_b = 1.5"`.

The published VF header example runs the check the other way round: *"l_b required = R/(b·F'_c⊥) =
2278 plf × 4 ft / (5.5 in × 625 psi) = 2.65 in. Therefore, use (2) 2x6 trimmer studs, l_b = 3 in."*
**The jamb count is set by the bearing requirement.** The calculator selects a jamb count in
`designJambs` on the same row and never feeds it back to the bearing check, so the bearing demand is
overstated by up to the jamb count (3× in the default case: D/C 0.730 reported vs 0.540 correct).

Note `C_b = 1.0` **is correct** for a header end bearing — §3.10.4 applies C_b only to bearings
"less than 6 in in length and not nearer than 3 in to the end of a member", and AWC E1.2a confirms
it for exactly this condition. C_b = 1.25 *does* apply to the stud-on-plate bearing that AWC E1.5a
identifies as its controlling limit state, which the calculator does not check at all.

**Fix:** `l_b = n_jambs · 1.5` taken from the jamb result; add a stud bearing check with C_b.

### E-12 — `calcCL` omits the `l_u/d < 7` branch of Table 3.3.3 — **SHOULD-FIX**

`calcCL` always uses `le = 1.63*lu + 3*d`. Table 3.3.3's named "Single Span Beam, uniformly
distributed load" row requires `2.06 l_u` below `l_u/d = 7`.

Scope, now that the reference text is in hand: the named row has **only two branches** — the
three-branch form with `1.84 l_u` above `l_u/d = 14.3` is **footnote 1**, for loading conditions *not
listed* in the table, so the calculator's `≥ 7` branch is **correct as coded** and my initial reading
of this was wrong. The only real gap is the `< 7` branch, where the two expressions cross at
`l_u/d = 6.96` and the worst error inside the calculator's usable geometry is **+1.1% on l_e and
conservative** (Case 5, 2x8 at 4 ft). A correctness item on a sheet that cites §3.3.3, not a
numerical risk.

Separately, `calcCL` implements only the uniform-load row — there is no load-pattern input, so AWC
E1.2a's concentrated-load case (`1.37 l_u + 3d`) cannot be expressed. That is a scope limit rather
than an error, since `checkOneHeader` only accepts a uniform plf.

**Fix:** branch on `l_u/d` for the `< 7` case.

### E-13 — the king-stud wind model is a point load and drops the stud's own tributary strip — **SHOULD-FIX**

`trib_area = (opening_ft/2)*(flr_ft/2)`, `F_wind = trib_area * windOpen_psf`, applied as a single
point load at `top_of_opening`. The correct demand is the **uniform** pressure over
`trib = opening/2 + spacing/2` acting over the full story height (`M = w h²/8`), because the stud
spans floor to floor while the header delivers its reaction over the opening half-width.

Evidence: `M = 10,800 lb·in` against a correct 8,505 (**+27%**) before the axis error in E-4. The
`spacing/2` strip (0.667 ft of 4.667 ft, 14%) is dropped entirely. `if(a_in>L_in) a_in=L_in*0.9;`
also silently rewrites a user's top-of-opening input instead of flagging it.

### E-14 — `FcE_k` uses the unclamped slenderness while `C_P` uses the clamped one — **SHOULD-FIX**

In `designKingStud`, `cp = calcCP(..., Le_in, lb.b)` returns `slen = 50` (clamped), but two lines
later `FcE_k = 0.822*Emin/Math.pow(Le_in/lb.b,2)` uses the true ratio of 72, giving
`F_cE = 91.97 psi` against `cp.FcE = 190.70 psi`. The same quantity is computed two ways inside one
function. Internally inconsistent regardless of which is right; fixing E-1 and E-4 removes it.

### E-15 — disclosure items

* Wall studs pass at `gov_dc <= 0.96` — an undisclosed 4% margin. Headers, jambs and king studs use
  1.0. Inconsistent.
* No shear check on wall studs (`checkWallStudSingle` computes no `f_v`). Never governs, but the
  sheet does not say so.
* `kingAxial` defaults to **0**, so the king stud is checked for wind alone unless the user types a
  gravity load and the `(f_c/F'_c)²` term is identically zero. The default should be the stud
  tributary gravity.
* The engineering-notes box says *"Verify load combinations per **ASCE 7-22** §2.4"* while the wind
  feed is the ASCE 7-16 C&C calculator and every published reference here is ASCE 7-16.
* `wallTrib` defaults to **8 ft** while `flrHt` defaults to **9 ft** — the wall self-weight strip and
  the buckling length disagree by a foot out of the box.
* `checkOneHeader` neglects §3.4.3.1(a) (UDL within `d` of the support may be ignored for shear).
  Conservative; no action needed, but it explains part of the shear D/C. AWC E1.3 applies it.
* Only No.2 grade and 2x sizes exist. AWC E1.7 (No.1), the VF header (No.1 Beam & Stringer 6x14/6x16)
  and the VF stud (No.1) cannot be expressed. Worth stating as a scope limit on the sheet.
* Correctly modelled, and worth keeping: `calcLoads` accumulates the **jamb** reaction floor to floor
  but not the header plf — right for aligned openings, since upper jamb loads bypass the lower
  header. No C_M / C_t / C_i, correctly disclosed in the assumptions callout.

---

## 6. Reproduction

```
# live read (from the repo root)
node tools/_qaqc-stacked-headers-live.mjs <out.json>

# recompute
python scratchpad/phase1/E_compare.py       # cases 1, 4, 5, 6, 7
python scratchpad/phase1/E_published.py     # cases 2, 3 vs the published examples
python scratchpad/phase1/E_fixtures.py      # -> E-fixtures-core.json
python scratchpad/phase1/E_fixtures_pub.py  # -> E-fixtures-pub.json
```

**Source caveats carried forward from the reference extraction**
`AWC_Examples2015_20190821_ABDI-Electronic.pdf` and `NDS - Wood Design Solved Examples.pdf` are the
**same 132-page AWC publication** — they are one source, not two. `LF WOOD BREADTH - SOLUTIONS.pdf`
contains only lateral-force problems and was not usable. The Supplement Table 4A/4B grade labels and
numbers extract as separate text blocks, so the mapping is a reconstruction — validated against four
AWC worked examples that state their own table rows, but any single value leaned on should be read
off the printed page. Equations 3.3-6, 3.7-1, 3.9-3 and 3.9-4 extract as broken glyphs and were
reconstructed, then confirmed numerically against E1.7 and E1.8. The VF Breadth stud example
contains an internal wind-pressure contradiction (20 psf stated, 33 psf used) and a printed
`C_F,c = 1.2` where 1.15 is used; the VF Depth header example checks bending and shear on a 6x14 and
then switches to a 6x16 for deflection and bearing without re-running bending or shear.
