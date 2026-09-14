# D — Stacked perforated shear wall: independent recompute vs live calculator vs WoodWorks

Target: `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\public\Calcs\stacked_shearwall_calculator.html`
Read-only. Nothing under `public/` or `app/` was modified.

Artifacts written
- Recompute engine: `…\scratchpad\phase1\psw.py`
- Case runner: `…\scratchpad\phase1\cases.py` → `recompute_out.txt`
- WoodWorks case: `…\scratchpad\phase1\case2_woodworks.py` → `case2_out.txt`
- Fixture dump: `…\scratchpad\phase1\fixtures.py` → `fixtures.json`
- Live read (scratch, underscore-prefixed): `…\anderson-rohr-calcs\tools\_qaqc-stacked-shearwall-live.mjs`

Units resolved from the code, not assumed: the wall table headers are `L (ft)`, `ΣLi (ft)`, `ho (ft)`, and
`denom = wall.Li*Co` is printed as "ft". **L = 302 ft and ΣLi = 172 ft are feet** — a 302-ft-long wall line
with 172 ft of full-height sheathing.

---

## 1. Five-line summary

1. The calculator reproduces the WoodWorks arithmetic **exactly** where it is exercised — unit shear matches
   Table 7 to 0.0 % — but only because that example is a *segmented, opening-free, constant-length* wall, which
   is the single degenerate arrangement in which the calculator's two structural errors both vanish.
2. `calcCo()` returns SDPWS's **intermediate sheathing area ratio `r`, not `C_o`**; the required
   `× L_tot/Σb_i` multiplier of SDPWS 2021 Eq. 4.3-5 is missing. On the default model this is only −1 to −3.6 %,
   but the error sweeps from **+10.7 % unconservative** (70 % sheathing, full-height openings) to **−189 %**
   (grossly conservative, 15 % sheathing, small openings).
3. `v_total` is built by **summing plf across stories** instead of accumulating force and dividing once by that
   story's `C_o·Σb_i`. In Case 3 (upper story 80 % sheathed, lower 40 %) this under-reports the base unit shear
   by **30.5 %** — 1,118.8 plf reported against a true 1,610 plf — which flips the sheathing check from
   **D/C 1.25 FAIL to 0.87 PASS**.
4. The dead-load term `0.6·DL_psf·trib_DL·L` is a **force subtracted from a moment**; it is short by the `L/2`
   lever arm, so it under-credits dead load by a factor of `L/2` (20× on a 40-ft wall, 151× on the 302-ft
   default). Conservative in sign, but it makes the DL inputs effectively inert — Case 3-DL returns
   T = 28,930 lb ("EXCEEDS HDUE17") where the correct answer is 3,220 lb (HDUE3).
5. Separate from the mechanics: the `Wind / Seismic` selector is a **dead input** (proved live — engine output
   byte-identical either way, sheathing always the wind column); the two anchor-bolt sill rows overstate
   capacity by exactly **5/3** (a per-bolt value from the source spreadsheet copied into a plf column and
   back-solved); and the SDPWS-required **distributed uplift check `t = v_max`** (§4.3.6.4.2.1) is absent.

---

## 2. Case tables

Delta % = (Calculator − Recompute) / Recompute × 100. Positive delta on `v` or `T` = calculator conservative.

### Case 1 — the calculator's default model, exactly as it loads
4 floors, L = 302 ft, Σb_i = 172 ft, h_o = 6.67 ft (1st floor 7.5 ft), h = 8.0 / 9.5 / 9.5 / 10.5 ft,
V_floor = 2,783 / 1,661 / 1,738 / 1,921 lb. Calculator column read live out of `calcFloorData(fi,0)`.

| Quantity | Floor | Recompute | Calculator (live) | WoodWorks | Delta % | Note |
|---|---|---|---|---|---|---|
| C_o | 4th | 0.6074 | 0.6134 | n/a | **+0.99** | Table 4.3.5.6 interp. 0.6115 — recompute matches, calculator does not |
| C_o | 3rd | 0.6774 | 0.6533 | n/a | **−3.56** | table 0.6795 |
| C_o | 2nd | 0.6774 | 0.6533 | n/a | **−3.56** | table 0.6795 |
| C_o | 1st | 0.6703 | 0.6494 | n/a | **−3.11** | table 0.6732 |
| Σb_i eff. (ft) | all | 172.00 | 172.00 | n/a | 0 | calculator has no pier list; cannot apply §4.3.3.4 |
| A_o (sf) | 4th–2nd | 867.1 | *(implicit)* | n/a | — | 6.67 × 130; calculator never forms A_o |
| A_o (sf) | 1st | 975.0 | *(implicit)* | n/a | — | 7.50 × 130 |
| V_story (lb) | 4th→1st | 2,783 / 4,444 / 6,182 / 8,103 | *(never formed)* | n/a | — | calculator works in plf, not force |
| M (ft-lb) | 4th | 22,264 | 22,264 | n/a | 0.00 | overturning numerator identical |
| M (ft-lb) | 3rd | 64,482 | 64,482 | n/a | 0.00 | |
| M (ft-lb) | 2nd | 123,211 | 123,211 | n/a | 0.00 | |
| M (ft-lb) | 1st | 208,292 | 208,293 | n/a | 0.00 | |
| v_max (plf) | 4th | 26.64 | 26.38 | n/a | **−0.98** | calculator `v_total` |
| v_max (plf) | 3rd | 38.14 | 41.16 | n/a | **+7.91** | |
| v_max (plf) | 2nd | 53.06 | 56.62 | n/a | **+6.72** | |
| v_max (plf) | 1st | 70.29 | 73.82 | n/a | **+5.03** | |
| T (lb) | 4th | 213.1 | 211.0 | n/a | **−0.98** | |
| T (lb) | 3rd | 553.4 | 573.8 | n/a | **+3.69** | |
| T (lb) | 2nd | 1,057.5 | 1,096.5 | n/a | **+3.69** | |
| T (lb) | 1st | 1,806.8 | 1,864.8 | n/a | **+3.21** | |
| Hold-down | all | HDUE3-SDS3 | HDUE3-SDS3 | n/a | — | same pick; loads are tiny |
| Sheathing D/C | 1st | 0.210 | 0.220 | n/a | +4.8 | 7/16 OSB 1-side 8d@6, V_all 335 plf |
| Sill D/C | 1st | 0.0453 | 0.0476 | n/a | +5.1 | both at the calculator's stated 1,552 plf |
| Sill D/C | 1st | **0.0755** | 0.0476 | n/a | **−37** | at the corrected 931 plf capacity — see D-6 |
| t = v_max (plf) | 1st | 70.29 | **not computed** | n/a | — | SDPWS 2021 §4.3.6.4.2.1 required, absent |

Net on this model the calculator lands 3–8 % conservative — but by cancellation of two errors of opposite sign,
not by being right. The default model is also so lightly loaded (max D/C 0.22) that no check can change state.

### Case 2 — WoodWorks five-over-one, §6, PDF pp. 33–46 (printed pp. 31–44)

The published wall is a **segmented** shear wall, 29.0 ft out-to-out, no openings, five stories at 10.0 ft.
SDPWS-2008 / ASCE 7-10, seismic, S_DS = 1.206.

Recompute vs published (my Python, independent of both the calculator and the spreadsheet):

| Quantity | Level | Recompute | Calculator | WoodWorks | Delta % (recomp vs WW) | Note |
|---|---|---|---|---|---|---|
| M_OT (ft-lb) | Roof | 129,890 | 90,923 (ASD) | 129,887 | **+0.002** | Tbl 8, p.40 |
| M_OT (ft-lb) | 6th | 372,890 | 261,023 (ASD) | 372,889 | **0.000** | |
| M_OT (ft-lb) | 5th | 701,790 | 491,253 (ASD) | 701,789 | **0.000** | |
| M_OT (ft-lb) | 4th | 1,087,960 | 761,572 (ASD) | 1,087,954 | **+0.001** | |
| M_OT (ft-lb) | 3rd | 1,502,760 | 1,051,932 (ASD) | 1,502,751 | **+0.001** | |
| v ASD (plf) | Roof | 313.5 | **313.53** | 314 | −0.15 | Tbl 7, p.35 |
| v ASD (plf) | 6th | 586.6 | **586.55** | 587 | −0.08 | |
| v ASD (plf) | 5th | 793.9 | **793.90** | 794 | −0.01 | |
| v ASD (plf) | 4th | 932.1 | **932.13** | 932 | +0.01 | |
| v ASD (plf) | 3rd | 1,001.2 | **1,001.24** | 1,001 | +0.02 | |
| M_R (ft-lb) | Roof | 65,598 | n/a | 65,598 | **0.000** | w_cum·L²/2, w = 156 plf |
| M_R (ft-lb) | 3rd | 889,778 | n/a | 889,778 | **0.000** | w_cum = 2,116 plf |
| T ASD (lb) | Roof | 2,317 | 3,135 | 2,319 | −0.11 | Tbl 10, p.42 |
| T ASD (lb) | 6th | 5,322 | 9,001 | 5,333 | −0.21 | |
| T ASD (lb) | 5th | 10,844 | 16,940 | 10,864 | −0.19 | |
| T ASD (lb) | 4th | 17,741 | 26,261 | 17,770 | −0.16 | |
| T ASD (lb) | 3rd | 25,723 | 36,274 | 25,758 | −0.13 | |

**The recompute reproduces WoodWorks to within 0.21 % on every published quantity** (residual is their rounding
of (0.6 − 0.14 S_DS) to 0.43 and of the table entries).

**The calculator's `v_total` reproduces WoodWorks Table 7 to 0.0 %** — but that is not evidence the stacked
logic is right. Every story here has the same `C_o·Σb_i` = 1.0 × 29 ft, and summing `P_j/(C_o·Σb_i)` over j is
then algebraically identical to `(ΣP_j)/(C_o·Σb_i)`. Case 3 breaks the tie.

Inputs that **cannot** be mapped onto the calculator (this is why T runs 35–69 % high):

| Missing input | WoodWorks value | Calculator |
|---|---|---|
| Chord lever arm `d` (tension rod → compression post centroid) | 27.04 / 27.04 / 26.31 / 26.31 / 25.98 ft | hard-wired to `C_o·ΣL_i` = 29.00 ft (−6.8 % to −10.4 % on T) |
| Seismic ASD factor 0.7 on E | applied in Tbl 7 & 10 | none; user must pre-factor V_floor by hand, and nothing says so |
| S_DS vertical term `(0.6 − 0.14 S_DS)` = 0.43 | ASCE 7-10 Eq. 8 | fixed at 0.6 |
| Dead load as a resisting **moment** with wall self-weight per story | M_R = w_cum·L²/2, w = 156 → 2,116 plf | `0.6·DL_psf·trib_DL·L` (a force, see D-3) |
| Structural I sheathing grade | 15/32 Str. I, 10d, 340 plf ASD seismic | only "Sheathing" grade, wind column only |
| Segmented method | this is a segmented wall | only perforated; entering L = ΣL_i, h_o = 0 forces C_o = 1.0, which happens to be correct |

Isolating the lever arm alone (T = 0.7·M_OT/d, no DL): 3,135 vs 3,363 lb at the roof (−6.8 %), 36,274 vs
40,490 lb at the 3rd floor (−10.4 %) — i.e. once dead load is entered correctly, the calculator would still be
7–10 % **unconservative** on chord tension because it assumes the chords sit at the extreme fibres.

### Case 3 — two stories where `C_o·Σb_i` differs (the diagnostic case)

Upper: h = 10, P = 8,000 lb, L = 40, Σb_i = 32 (80 %), h_o = 7.
Lower: h = 10, P = 6,000 lb, L = 40, Σb_i = 16 (40 %), h_o = 8.
Trial sheathing 15/32 OSB 2-side 10d@4 (V_all = 1,290 plf).

| Quantity | Story | Recompute | Calculator (live) | Delta % | Note |
|---|---|---|---|---|---|
| A_o (sf) | Upper | 56.0 | implicit | — | 7 × 8 |
| A_o (sf) | Lower | 192.0 | implicit | — | 8 × 24 |
| r | Upper | 0.8511 | 0.8511 | 0.00 | calculator's "C_o" **is** r |
| r | Lower | 0.4545 | 0.4545 | 0.00 | |
| C_o | Upper | **0.8197** | 0.8511 | **+3.8** | table 0.8180 |
| C_o | Lower | **0.5435** | 0.4545 | **−16.4** | table 0.5500 |
| V_story (lb) | Lower | 14,000 | never formed | — | |
| v_max (plf) | Upper | 305.00 | 293.75 | **−3.7** | |
| v_max (plf) | Lower | **1,610.00** | **1,118.75** | **−30.5** | see decomposition below |
| Sheathing D/C | Lower | **1.248 FAIL** | **0.867 PASS** | — | **check changes state** |
| M (ft-lb) | Lower | 220,000 | 220,000 | 0.00 | |
| T (lb) | Lower | 25,300 | 30,250 | +19.6 | both "EXCEEDS HDUE17" here |
| t = v_max (plf) | Lower | 1,610 | not computed | — | §4.3.6.4.2.1 |

Decomposition of the −30.5 % at the lower story (V_story = 14,000 lb, Σb_i = 16 ft):

| Variant | v (plf) | vs correct |
|---|---|---|
| (a) calculator as built — sum of plf, `C_o` = r | 1,118.75 | **−30.5 %** |
| (b) force-first accumulation, calculator's `C_o` = r | 1,925.00 | +19.6 % |
| (c) force-first accumulation, SDPWS `C_o` — correct | **1,610.00** | — |

`(a) vs (b)` isolates the plf-summing error at **−41.9 %**; `(b) vs (c)` isolates the `C_o` error at **+19.6 %**.
They partially cancel here, which is exactly why the default model looks benign.

### Case 3-DL — same wall, DL = 20 psf × 10 ft trib = 200 plf on both stories

| Quantity | Story | Recompute | Calculator (live) | Note |
|---|---|---|---|---|
| M_R (ft-lb) | Upper | 160,000 | — | (Σw)·L²/2 = 200 × 40²/2 |
| M_R (ft-lb) | Lower | 320,000 | — | Σw = 400 plf |
| DL term used | Upper | 0.6 × 160,000 = 96,000 ft-lb | 0.6·20·10·40 = **4,800** | short by the L/2 = 20 ft lever |
| DL term used | Lower | 0.6 × 320,000 = 192,000 ft-lb | **9,600** (cumulative) | |
| T (lb) | Upper | 0 (raw −610) | 2,761 | |
| T (lb) | Lower | **3,220 → HDUE3-SDS3** | **28,930 → EXCEEDS HDUE17** | **9.0× ; different design outcome** |

### Case 4 — negative T (dead load governs), single story
h = 10, P = 3,000 lb, L = 40, Σb_i = 32, h_o = 7, DL = 60 psf × 14 ft = 840 plf.

| Quantity | Recompute | Calculator (live) | Note |
|---|---|---|---|
| M (ft-lb) | 30,000 | 9,840 (numerator after DL) | |
| M_R (ft-lb) | 672,000 | — | 840 × 40²/2 |
| T raw (lb) | **−14,228** | +361 | |
| T reported (lb) | **0** (clamped) | 361 | recompute clamps per SDPWS; hold-down not required for uplift |
| t = v_max (plf) | **114.4** | not computed | still required at the bottom plate |
| Hold-down | none required for uplift | HDUE3-SDS3 | |

Forcing the true resisting moment in through `dl_override` (+403,200 lb·ft) makes the live calculator return
**T = −13,703 lb** with no clamp, and `selectHoldown(−13703)` still returns HDUE3-SDS3 — a negative tension is
printed on the output sheet.

### Case 5 — both directions, dead load delivered at one end only
Same wall, M = 30,000 ft-lb, C_o·Σb_i = 26.230 ft. A 4,000 lb point dead load at one chord (M_R = 80,000 ft-lb
about the far end).

| Direction | Recompute T (lb) | Calculator |
|---|---|---|
| + (tension chord at the loaded end) | (30,000 − 0.6 × 80,000)/26.230 = **0** | 1,144 (no DL entered) or 0 (via override) |
| − (tension chord at the unloaded end) | (30,000 − 0)/26.230 = **1,143.8** | same single number — no direction switch |

The calculator has one DL field per wall per floor and no push/pull toggle, so an asymmetric wall is reported
with whichever direction the user happens to enter.

### Case 6 — SDPWS 2021 §4.3.3.4 aspect ratio, h = 10 ft, piers 8 / 4 / 3 / 2.5 ft

| b_i (ft) | h/b | b_eff (ft) | Rule |
|---|---|---|---|
| 8.0 | 1.25 | 8.00 | full |
| 4.0 | 2.50 | 3.20 | × 2b_i/h |
| 3.0 | 3.33 | 1.80 | × 2b_i/h |
| 2.5 | 4.00 | 0.00 | excluded, h/b > 3.5 |
| **Σ** | | **13.00** | vs naive 17.50 — **−25.7 %** |

The calculator takes `ΣLi` as a single typed number with no pier breakdown, so it can neither apply nor warn
about this rule. A user typing the tape measurement gets a 26 % overstated `Σb_i`, which propagates as a 26 %
understatement of `v` and `T`.

### Sensitivity sweep — where `C_o` = r diverges (L = 40 ft, h = 10 ft, A_o = h_o·(L − Σb_i))

`v under %` positive = calculator **under**-reports unit shear (unconservative).

| % full-ht | h_o/h | r = C_o,calc | C_o SDPWS | C_o Table 4.3.5.6 | v under % |
|---|---|---|---|---|---|
| 15 % | 0.33 | 0.3462 | 1.0000 | 1.0000 | −188.9 |
| 15 % | 1.00 | 0.1500 | 0.3704 | 0.3700 | −146.9 |
| 30 % | 0.50 | 0.4615 | 0.7407 | 0.7400 | −60.5 |
| 50 % | 0.67 | 0.6000 | 0.6667 | 0.6700 | −11.1 |
| 50 % | 1.00 | 0.5000 | 0.5000 | 0.5000 | 0.0 |
| 70 % | 0.83 | 0.7368 | 0.6897 | 0.6900 | **+6.4** |
| 70 % | 1.00 | 0.7000 | 0.6250 | 0.6300 | **+10.7** |
| 90 % | 0.83 | 0.9153 | 0.8696 | 0.8700 | **+5.0** |
| 90 % | 1.00 | 0.9000 | 0.8333 | 0.8300 | **+7.4** |

My `C_o` matches SDPWS Table 4.3.5.6 to within the table's own two-decimal rounding at every point.
The calculator's does not, and crosses from grossly conservative to unconservative at roughly 60–65 %
full-height sheathing — which is the normal range for a residential party wall.

---

## 3. Formulas, sources, page numbers

### SDPWS (verbatim from the AWC PDFs on disk)

Source A: `…\Wood Codes\Special Design Provisions for Wind and Seismic.pdf` — **SDPWS 2021 Edition**, © 2020.
Source B: `…\Wood Codes\NDS - 2015\AWC_SDPWS-2015-withCommentary_1510_dnd.pdf` — SDPWS 2015 w/ Commentary.
The 2021 equation images do not extract; the 2015 text does, and the 2021 renumbering is confirmed from its
running text. The two editions carry the identical equation.

SDPWS 2015 §4.3.3.5 = **SDPWS 2021 §4.3.5.6**, "Shear Capacity of Perforated Shear Walls":

```
C_o = [ r / (3 − 2r) ] × [ L_tot / Σ L_i ]                          (2015 Eq. 4.3-5)
r   = 1 / ( 1 + A_o / ( h · Σ L_i ) )                               (2015 Eq. 4.3-6)
```
2021 restates the same relation in areas — Table 4.3.5.6 footnote 1: *"Definitions of A_fhs, A_o, and A_wall
are provided in Eqn. 4.3-6"* — with A_fhs = h·Σb_i and A_wall = h·L_tot, i.e. `L_tot/Σb_i = A_wall/A_fhs`.

2015 definition of A_o, verbatim: *"total area of openings in the perforated shear wall where individual
opening areas are calculated as the opening width times the clear opening height, ft². Where sheathing is not
applied to framing above or below the opening, these areas shall be included in the total area of openings.
**Where the opening height is less than h/3, an opening height of h/3 shall be used**."*

SDPWS 2021 §4.3.3.4, verbatim: *"Portions of walls with aspect ratios exceeding 3.5:1 shall not be considered
in the sum of shear wall segments, Σb_i. In the design of perforated shear walls, the length of each perforated
shear wall segment with an aspect ratio greater than 2:1 shall be multiplied by 2b_i/h for the purposes of
determining b_i and Σb_i. The provisions of Section 4.3.3.2 and the exceptions to Section 4.3.5.5.1 shall not
apply to perforated shear wall segments."*

SDPWS 2021 §4.3.6.4.1.1 — in-plane shear anchorage for PSW: the maximum unit shear `v_max` *"transmitted into
the top of a perforated shear wall, out of the base of the perforated shear wall at full height sheathing, and
into collectors connecting shear wall segments."*

SDPWS 2021 §4.3.6.4.2.1 — uplift anchorage for PSW: *"perforated shear wall bottom plates at full height
sheathing shall be anchored for a uniform uplift force, t, equal to the maximum unit shear force induced by the
design load, v_max, determined in 4.3.6.4.1.1."* → **t = v_max, in plf.**
(The brief's `t_k = V_k·h_k/(C_o,k·Σb_i,k)` is the *end* tension for a single story, not the distributed `t`.)

SDPWS 2021 §4.3.6.1.3 — "Tension and Compression Chords of Perforated Shear Walls": T and C at **each story
level**, each end of each PSW.
SDPWS 2021 §4.3.6.4.4 — "Load Path": *"Elements resisting shear wall forces contributed by multiple stories
shall be designed for the sum of **forces** contributed by each story."* (forces, not unit shears — this is the
clause Case 3 violates.)

SDPWS 2021 §4.3.2.3 perforated shear wall limitations, relevant items: (2) a PSW segment at each end;
(3) §4.3.3.4 aspect ratios apply; (4) **nominal unit shear capacity ≤ 2,435 plf**; (7) uniform top-of-wall and
bottom-of-wall elevations; (8) **h ≤ 20 ft**.

ASD reduction: SDPWS Table 4.3A gives *nominal* capacities in a Seismic column (v_s) and a Wind column (v_w),
with v_w ≈ 1.4·v_s, and the ASD reduction factor is **2.0 for both**. Confirmed by WoodWorks Table 7 note a
(PDF p.35): *"Allowable shear values are obtained by taking the nominal unit shear capacities in … SDPWS-2008
Table 4.3A and dividing by the ASD reduction factor of 2.0."* — **the brief's "ASD seismic = nominal/2.8" is
not SDPWS**; 2.8 is not used anywhere in SDPWS 2021 §4.3.

### Story mechanics used in the recompute

```
V_k = Σ_{j ≥ k} P_j                                   (P_j = incremental level force)
M_k = Σ_{j ≥ k} P_j · z_{j,k}  =  Σ_{m ≥ k} V_m · h_m
v_k = V_k / (C_o,k · Σb_i,k)                          [plf]   4.3.6.4.1.1
t_k = v_k                                             [plf]   4.3.6.4.2.1
T_k = ( M_k − 0.6·M_R,k ) / (C_o,k · Σb_i,k) ≥ 0      [lb]    4.3.6.1.3
M_R,k = (Σ_{j ≤ k} w_j) · L² / 2     for dead load uniform over the wall
```
The identity `Σ P_j·z_j ≡ Σ V_m·h_m` is what WoodWorks uses, and both forms are reproduced above.

### WoodWorks page numbers
`…\Wood Design Examples and Webinars\Five-Story-Wood-Frame-Structure-over-Podium-Slab-WoodWorks-Dec-2017.pdf`
(PDF page = printed page + 2)

| PDF p. | Printed p. | Content |
|---|---|---|
| 33 | 31 | §6 header, "segmented shear wall", 29.0 ft out-to-out, 10.0 ft floors, h/w = 0.34 |
| 34 | 32 | Figure 7; **Table 6** distribution of seismic forces F5…F1 (cumulative story shears, strength) |
| 35 | 33 | §6b sheathing & nailing; **Table 7** ASD v = F_total(0.7)/l ; note a = ASD reduction factor 2.0; §6c cumulative overturning |
| 36 | 34 | M_OT accumulation formulas level by level; §6d/6e IBC and ASCE 7-10 load combinations |
| 37 | 35 | §6f chords; dead loads W_Roof 56 plf, W_Floor 390 plf, W_Wall 100 plf |
| 38–39 | 36–37 | Figures 8/9/10, distance d, compression combinations |
| 40 | 38 | **Table 8** M_OT, P_D+L, d′, d, compression demand; Table 9 chord members |
| 41–42 | 39–40 | Column stability; §6h **Table 10** M_R, d, M_OT, ASD uplift = (M_OT×0.7 − 0.43 M_R)/d |
| 43 | 41 | **Table 10A** IBC alternate combinations — shows a **negative differential load (−439 lb)** at the 6th floor |
| 44–45 | 42–43 | §6i **Table 11** rod sizes/elongations; Table 12 bearing plates |

### Excel SW1 formulas, verbatim
`…\Wood Spreadsheets\NEW SHEAR WALL Design Template (3 & 4 Story).xlsx`, sheet **`SWX - 4 Story Full Wall`**
(columns: B = L, C = h, D = force in part, E = ΣL_i, F = r, H = C_o, I = v, J = v_total, K = DL, L = uplift T)

```
B17  CUMULATIVE SHEAR        =B7+B16                 ; B27 =B17+B26 ; B37 =B36+B27
E19  ΣLi                     =B19-3.5                ; E39 =B39-(3*2)
F9   "% full height sheath."  =1/(1+(G9*(B9-E9))/(C9*E9))          ← this is SDPWS r
H9   Co                       =(F9/(3-2*F9))*(B9/E9)               ← r/(3-2r) × L/ΣLi
I9   v (plf)                  =D9/(H9*E9)
J9   v,total                  =I9      ; J19 =I19+J9 ; J29 =I29+J19 ; J39 =I39+J29
K9   DL resisting uplift      =(15 * 8)+ 37                        (= 157 plf)
L9   UPLIFT T, roof           =(D9*C9)/(E9*H9)-((B9*K9*B9/2)/B9)
L19  UPLIFT T, 3rd            =((D19*C19)+(D9*(C9+C19)))/(E19*H19)
L29  UPLIFT T, 2nd            =((D29*C29)+(D19*(C19+C29))+(D9*(C9+C19+C29)))/(E29*H29)
L39  UPLIFT T, 1st            =((D39*C39)+(D29*(C29+C39))+(D19*(C19+C29+C39))
                                 +(D9*(C9+C19+C29+C39)))/(E39*H39)
```
Sheet **`Co Calc.`** does the same two-step and cross-checks it against a transcription of SDPWS
Table 4.3.5.6 (B54:G63) that matches the code table cell for cell:
```
D8  r   =1/(1+(D3/(D6*D7)))
D9  Co  =(D8/(3-(2*D8)))*(D4/D7)
```
Three observations that matter:

- **The spreadsheet has the `× L/ΣL_i` step (column H). The calculator's `calcCo()` stops at column F and
  returns it as `C_o`.** The calculator's own engineering note claims the method was "verified against SW1
  tab"; the overturning numerator and the `ΣL_i × C_o` denominator shape were copied faithfully — the wrong
  column was wired into the denominator.
- The plf-summing (`J19 = I19 + J9`) **is** inherited from the spreadsheet. It is wrong there too, just small,
  because that workbook's stories happen to have nearly equal `C_o·ΣL_i` (45.5 × 0.9757 vs 43 × 0.9266).
- The dead-load relief term `L9` is `(B9·K9·B9/2)/B9` = `w·L/2`, a **force** with no 0.6 factor, applied at the
  roof only (L19/L29/L39 carry no DL term at all). It is a loose approximation of `0.6·M_R/(C_o·ΣL_i)` that
  happens to be close when `C_o·ΣL_i ≈ L`. The calculator did not copy this; it invented `0.6·DL·trib·L`,
  which is the same dimensional class of error with an extra factor of ~L/2 missing.
- `Co Calc.` D9 returns **1.4241** for its sample wall — the closed form is **not capped at 1.0**. With the
  h/3 minimum opening height enforced and A_o taken as h_o·(L − Σb_i), `C_o ≤ 1.0` falls out automatically;
  with real per-opening areas it does not, and must be clamped.

---

## 4. Expected-value fixture list

Provenance keys: `HAND` = derived by hand from SDPWS 2021 §4.3.5.6 / §4.3.3.4 / §4.3.6, arithmetic in
`scratchpad\phase1\psw.py`; `WW p.N` = WoodWorks Dec-2017 PDF page N.

```json
{
  "_meta": {
    "code": "SDPWS 2021 (AWC), 4.3.3.4 / 4.3.5.6 / 4.3.6.1.3 / 4.3.6.4.1.1 / 4.3.6.4.2.1 / 4.3.6.4.4",
    "units": "L, sum_bi, h, h_o in ft; A_o in sf; P and V in lb; M in ft-lb; v and t in plf; T in lb",
    "sign": "T clamped at 0; both directions must be run when dead load is not symmetric",
    "C_o": "C_o = [r/(3-2r)] * (L_tot/sum_bi), r = 1/(1 + A_o/(h*sum_bi)); cap C_o at 1.0",
    "A_o": "sum(width * max(clear_height, h/3)); unsheathed areas above/below openings included",
    "sum_bi": "exclude piers with h/b > 3.5; multiply pier length by 2b/h when 2 < h/b <= 3.5"
  },

  "case1_calculator_default": {
    "provenance": "HAND, SDPWS 2021 4.3.5.6 + 4.3.6; inputs = the calculator's shipped default model",
    "inputs": {
      "stories_top_down": [
        {"name":"4th Floor","h":8.0,"P":2783,"L":302,"segments":[172],"openings":[[130,6.67]],"w_DL":0},
        {"name":"3rd Floor","h":9.5,"P":1661,"L":302,"segments":[172],"openings":[[130,6.67]],"w_DL":0},
        {"name":"2nd Floor","h":9.5,"P":1738,"L":302,"segments":[172],"openings":[[130,6.67]],"w_DL":0},
        {"name":"1st Floor","h":10.5,"P":1921,"L":302,"segments":[172],"openings":[[130,7.50]],"w_DL":0}
      ],
      "sheathing_Vall_plf": 335, "sill_Vall_plf": [304,304,304,931]
    },
    "expected": [
      {"level":"4th Floor","sum_bi":172.0,"A_o":867.1,"r":0.6134,"C_o":0.6074,"V_story":2783,"M":22264,   "v_max":26.64,"t":26.64,"T":213.1,  "holdown":"HDUE3-SDS3"},
      {"level":"3rd Floor","sum_bi":172.0,"A_o":867.1,"r":0.6533,"C_o":0.6774,"V_story":4444,"M":64482,   "v_max":38.14,"t":38.14,"T":553.4,  "holdown":"HDUE3-SDS3"},
      {"level":"2nd Floor","sum_bi":172.0,"A_o":867.1,"r":0.6533,"C_o":0.6774,"V_story":6182,"M":123211,  "v_max":53.06,"t":53.06,"T":1057.5, "holdown":"HDUE3-SDS3"},
      {"level":"1st Floor","sum_bi":172.0,"A_o":975.0,"r":0.6494,"C_o":0.6703,"V_story":8103,"M":208292.5,"v_max":70.29,"t":70.29,"T":1806.8, "holdown":"HDUE3-SDS3"}
    ],
    "cross_check": "C_o from Table 4.3.5.6 bilinear interpolation = 0.6115 / 0.6795 / 0.6795 / 0.6732",
    "calculator_today": {"C_o":[0.6134,0.6533,0.6533,0.6494],"v_total":[26.38,41.16,56.62,73.82],"T":[211.0,573.8,1096.5,1864.8]}
  },

  "case2_woodworks_five_over_one": {
    "provenance": "WW p.34 Table 6, p.35 Table 7, p.40 Table 8, p.42 Table 10; SDPWS-2008/ASCE 7-10, S_DS=1.206",
    "inputs": {
      "L":29.0, "segments":[29.0], "openings":[], "h_per_story":10.0, "n_stories":5,
      "P_incremental_strength":[12989,11311,8590,5727,2863],
      "E_to_ASD":0.7, "dead_load_factor":"0.6 - 0.14*S_DS = 0.43",
      "w_cum_plf":[156,646,1136,1626,2116],
      "d_chord_ft":[27.04,27.04,26.31,26.31,25.98]
    },
    "expected": [
      {"level":"Roof",     "V_story":12989,"M_OT":129890, "M_R":65598, "v_ASD":313.5, "T_ASD":2317,  "WW_published":{"M_OT":129887,"v":314,"T":2319}},
      {"level":"6th Floor","V_story":24300,"M_OT":372890, "M_R":271643,"v_ASD":586.6, "T_ASD":5322,  "WW_published":{"M_OT":372889,"v":587,"T":5333}},
      {"level":"5th Floor","V_story":32890,"M_OT":701790, "M_R":477688,"v_ASD":793.9, "T_ASD":10844, "WW_published":{"M_OT":701789,"v":794,"T":10864}},
      {"level":"4th Floor","V_story":38617,"M_OT":1087960,"M_R":683733,"v_ASD":932.1, "T_ASD":17741, "WW_published":{"M_OT":1087954,"v":932,"T":17770}},
      {"level":"3rd Floor","V_story":41480,"M_OT":1502760,"M_R":889778,"v_ASD":1001.2,"T_ASD":25723, "WW_published":{"M_OT":1502751,"v":1001,"T":25758}}
    ],
    "C_o": 1.0,
    "note": "Unmappable today: chord lever arm d, the 0.7 E factor, the S_DS vertical term, Structural I sheathing, and DL as a moment. Only v is a fair comparison; the calculator matches it to 0.0%.",
    "tolerance_pct": 0.25
  },

  "case3_divergent_Co_sumbi": {
    "provenance": "HAND, SDPWS 2021 4.3.5.6 + 4.3.6.4.4 (sum of FORCES per story)",
    "inputs": {"stories_top_down":[
      {"name":"Upper","h":10.0,"P":8000,"L":40,"segments":[32],"openings":[[8,7.0]],"w_DL":0},
      {"name":"Lower","h":10.0,"P":6000,"L":40,"segments":[16],"openings":[[24,8.0]],"w_DL":0}],
      "sheathing_Vall_plf":1290},
    "expected": [
      {"level":"Upper","sum_bi":32.0,"A_o":56.0, "r":0.8511,"C_o":0.8197,"V_story":8000, "M":80000, "v_max":305.00, "t":305.00, "T":3050.0, "sheathing_DC":0.236},
      {"level":"Lower","sum_bi":16.0,"A_o":192.0,"r":0.4545,"C_o":0.5435,"V_story":14000,"M":220000,"v_max":1610.00,"t":1610.00,"T":25300.0,"sheathing_DC":1.248,"verdict":"FAIL"}
    ],
    "cross_check": "Table 4.3.5.6 interpolation = 0.8180 / 0.5500",
    "calculator_today": {"C_o":[0.8511,0.4545],"v_total":[293.75,1118.75],"T":[2937.5,30250.0],"sheathing_DC":[0.228,0.867],"verdict":"PASS"},
    "purpose": "regression guard for force-first accumulation; MUST fail on any plf-summing engine"
  },

  "case3DL_dead_load_relief": {
    "provenance": "HAND; M_R = (sum w) * L^2/2 per WW p.42 Table 10 convention",
    "inputs": {"stories_top_down":[
      {"name":"Upper","h":10.0,"P":8000,"L":40,"segments":[32],"openings":[[8,7.0]],"w_DL":200},
      {"name":"Lower","h":10.0,"P":6000,"L":40,"segments":[16],"openings":[[24,8.0]],"w_DL":200}]},
    "expected": [
      {"level":"Upper","M":80000, "M_R":160000,"T_unclamped":-610.0,"T":0.0,   "holdown":"none required for uplift"},
      {"level":"Lower","M":220000,"M_R":320000,"T_unclamped":3220.0,"T":3220.0,"holdown":"HDUE3-SDS3"}
    ],
    "calculator_today": {"T":[2761.2,28930.0],"holdown":["HDUE3-SDS3","EXCEEDS HDUE17"]},
    "purpose": "regression guard for the L/2 lever arm on the dead-load resisting moment"
  },

  "case4_negative_T": {
    "provenance": "HAND; negative-differential precedent WW p.43 Table 10A (-439 lb at the 6th floor)",
    "inputs": {"stories_top_down":[
      {"name":"Single","h":10.0,"P":3000,"L":40,"segments":[32],"openings":[[8,7.0]],"w_DL":840}]},
    "expected": [
      {"level":"Single","C_o":0.8197,"lever_ft":26.230,"M":30000,"M_R":672000,
       "T_unclamped":-14228.2,"T":0.0,"t":114.38,
       "holdown":"none required for uplift; t = 114.4 plf still required at the bottom plate"}
    ],
    "calculator_today": {"T":361.3,"holdown":"HDUE3-SDS3","note":"with dl_override=+403200 returns T = -13703.4 lb, unclamped"},
    "purpose": "T must clamp at 0 and must never be reported negative"
  },

  "case5_both_directions": {
    "provenance": "HAND; asymmetric dead load, 4,000 lb at one chord, M_R = 80,000 ft-lb about the far end",
    "inputs": {"h":10.0,"P":3000,"L":40,"segments":[32],"openings":[[8,7.0]],
               "M_R_plus_ftlb":80000,"M_R_minus_ftlb":0},
    "expected": {"C_o":0.8197,"lever_ft":26.230,"M":30000,
                 "T_plus":0.0,"T_plus_unclamped":-686.2,"T_minus":1143.8,
                 "governing_T":1143.8,"holdown":"HDUE3-SDS3 both ends"},
    "calculator_today": "single value only; no direction switch",
    "purpose": "both ends of a perforated shear wall must be designed (SDPWS 4.3.6.1.3)"
  },

  "case6_aspect_ratio_sum_bi": {
    "provenance": "HAND, SDPWS 2021 4.3.3.4 verbatim",
    "inputs": {"h":10.0,"b_i":[8.0,4.0,3.0,2.5]},
    "expected": {"naive_sum":17.5,
      "per_pier":[{"b":8.0,"h_over_b":1.25,"b_eff":8.00,"rule":"full"},
                  {"b":4.0,"h_over_b":2.50,"b_eff":3.20,"rule":"x 2b/h"},
                  {"b":3.0,"h_over_b":3.33,"b_eff":1.80,"rule":"x 2b/h"},
                  {"b":2.5,"h_over_b":4.00,"b_eff":0.00,"rule":"excluded, h/b > 3.5"}],
      "sum_bi_effective":13.00},
    "calculator_today": "no pier list; sum_bi is a single typed number, rule cannot be applied",
    "purpose": "engine must take a pier list, not a pre-summed length"
  },

  "case7_C_o_table_agreement": {
    "provenance": "SDPWS 2021 Table 4.3.5.6 (identical to 2015 Table 4.3.3.5), transcribed and verified against the Excel 'Co Calc.' sheet B54:G63",
    "inputs": "A_o = h_o * (L - sum_bi), L = 40, h = 10",
    "expected_pairs": [
      {"pct_full_height":0.10,"h_o_over_h":0.500,"C_o":0.69},
      {"pct_full_height":0.20,"h_o_over_h":0.500,"C_o":0.7143,"table":0.71},
      {"pct_full_height":0.30,"h_o_over_h":0.667,"C_o":0.5882,"table":0.59},
      {"pct_full_height":0.50,"h_o_over_h":1.000,"C_o":0.5000,"table":0.50},
      {"pct_full_height":0.90,"h_o_over_h":1.000,"C_o":0.8333,"table":0.83},
      {"pct_full_height":1.00,"h_o_over_h":1.000,"C_o":1.0000,"table":1.00}
    ],
    "tolerance": "within the table's own 0.01 rounding",
    "purpose": "closed-form C_o must land on the code table; calculator's C_o does not"
  }
}
```

---

## 5. Findings

### D-1 — `calcCo()` returns SDPWS's intermediate `r`, not `C_o` — **seal-blocker**

`stacked_shearwall_calculator.html:425-431`:
```js
function calcCo(L, Li, ho, h){
  var alpha=Li/L, r=(h>0)?ho/h:0;
  return 1.0/(1.0+r*(1.0-alpha)/alpha);
}
```
With A_o = h_o(L − ΣL_i) this expression is algebraically identical to SDPWS Eq. 4.3-6, `r = 1/(1 + A_o/(h·ΣL_i))`
— the **sheathing area ratio**. Eq. 4.3-5 then requires `C_o = [r/(3−2r)]·(L_tot/ΣL_i)`, which the code never
applies. The very spreadsheet the calculator's own notes cite as its verification source does apply it
(`SWX - 4 Story Full Wall` column F = r, column H = C_o), and the Excel `Co Calc.` sheet cross-checks column H
against a transcription of SDPWS Table 4.3.5.6. Sweep above: from −189 % (grossly conservative, sparsely
sheathed walls) to **+10.7 % unconservative** at 70 % full-height sheathing with full-height openings. The
error changes sign at roughly 60–65 % full-height sheathing, which is the normal range for a residential party
wall. In Case 3 the two stories land on opposite sides of that crossover — the 80 %-sheathed upper story is
3.7 % unconservative in `v`, the 40 %-sheathed lower story 19.6 % conservative — so the sign of the error is
not predictable from the inputs a user sees.
**Fix:** `var r=1/(1+(ho*(L-Li))/(h*Li)); return Math.min((r/(3-2*r))*(L/Li), 1.0);` — and rename the displayed
`r = h_o/h` card, which is a different `r` again and collides with the code symbol.

### D-2 — `v_total` sums plf across stories instead of accumulating force — **seal-blocker**

`stacked_shearwall_calculator.html:439-447`:
```js
for(var j=0;j<=fi;j++){ … v_total+=flj.V_floor/(Coj*wj.Li); }
```
SDPWS 2021 §4.3.6.4.4 requires the **sum of forces** contributed by each story; §4.3.6.4.1.1 then converts once,
at that story, with that story's `C_o·Σb_i`. Summing unit shears is only equivalent when `C_o·Σb_i` is constant
over the height. Case 3: reported 1,118.75 plf against a true 1,610.00 plf, **−30.5 %**, and the sheathing check
flips from D/C 1.248 FAIL to 0.867 PASS. The error is inherited verbatim from the source spreadsheet
(`J19 = I19 + J9`), where it is masked because the stories there are nearly identical.
**Fix:** accumulate `V_story += floors[j].V_floor` over `j ≤ fi`, then `v_total = V_story/(Co_fi*Li_fi)`.

### D-3 — dead-load term is a force subtracted from a moment (missing the `L/2` lever) — **must-fix**

`stacked_shearwall_calculator.html:470`:
```js
var DL_j = 0.6*_srcDL*_srcTrib*(wj.L||0) + (wj.dl_override||0);
var contrib = Vj*H_jk - DL_j;   // lb·ft − lb
```
`0.6·psf·ft·ft` = lb. It is subtracted from `V·H` in lb·ft, and the `dl_override` field is explicitly labelled
`lb·ft` in the same code, so the numerator is intended to be a moment. The resisting moment for a load uniform
over the wall is `0.6·w·L²/2`; the code is short by `L/2` — **20× on a 40-ft wall, 151× on the shipped 302-ft
default**. WoodWorks Table 10 (p.42) and the M_R cross-check above confirm `M_R = w_cum·L²/2` to 0.000 %.
Case 3-DL: reported T = 28,930 lb → "EXCEEDS HDUE17" where the correct answer is 3,220 lb → HDUE3-SDS3.
Conservative in sign, but it silently renders the DL and Trib columns useless and drives hold-down selection to
the top of the schedule.
**Fix:** `var DL_j = 0.6*_srcDL*_srcTrib*(wj.L||0)*(wj.L||0)/2 + (wj.dl_override||0);` and label the column
"DL resisting moment".

### D-4 — no `Σb_i` aspect-ratio treatment, no pier list — **must-fix**

`ΣLi` is a single typed number (`render()` line ~890). SDPWS 2021 §4.3.3.4 requires per-pier treatment:
exclude `h/b > 3.5`, multiply by `2b_i/h` for `2 < h/b ≤ 3.5`. Case 6: a tape-measure sum of 17.5 ft is
13.00 ft effective, **−25.7 %**, propagating directly to `v` and `T`. Nothing in the UI, hint text, or the
engineering notes tells the user to pre-reduce.
**Fix:** take a comma-separated pier list, compute `Σb_i` in the engine, and show the per-pier reduction table.

### D-5 — `Wind / Seismic` selector is a dead input — **must-fix**

`#designCase` is read only by `exportProject()`/`importProject()` (lines 972, 978, 1010). Proved live: setting
it to `seismic` and firing `change` leaves `calcFloorData(0,0)` byte-identical, and `getSheathingObj()` still
returns the wind-column `Vall`. The reference table on the page carries a "V_s Seismic ASD" column that the
engine can never reach. A user who selects Seismic gets wind allowables — e.g. 15/32 OSB 1-side 10d@6 checked
at **435 plf** instead of **310 plf**, a 1.40× overstatement of capacity.
**Fix:** give each `SHEATHING` row a `Vs` field and select on `#designCase`; or delete the selector.

### D-6 — anchor-bolt sill capacities overstated by exactly 5/3 — **seal-blocker**

`SILL_CONN` lines 394-397: `{id:'ab12', Vconn:1813, defaultSpacing:20}`, `{id:'ab58', Vconn:2587, defaultSpacing:20}`.
The source spreadsheet states per-bolt allowables: *"1/2" Anchor Bolt Vall = 1088lb per bolt"* and
*"5/8" Anchor Bolt Vall = 1552lb per bolt"*, used as `=1552/(R39/12)` → plf. The calculator's values are those
per-bolt numbers multiplied by 20/12: `1088 × 20/12 = 1813.33`, `1552 × 20/12 = 2586.67` — exact. The per-bolt
value was copied into the plf column and `Vconn` back-solved, so `sillVall()` divides by the spacing a second
time. **Capacity is 1.667× high at every spacing**, including the 1st-floor default (`ab58 @ 20"` reports
1,552 plf where the source basis gives 931 plf). This is the foundation sill anchorage on a stacked wall.
Neither 1,813 nor 2,587 lb is defensible as an NDS bolt value in a 1½" DF sill on concrete (~1,280 and
~1,650 lb at C_D = 1.6).
**Fix:** `Vconn` → 1088 and 1552 (or re-derive from NDS Table 12E with an explicit C_D), and state the basis.

### D-7 — SDPWS §4.3.6.4.2.1 distributed uplift `t = v_max` is not checked — **must-fix**

`checkWall()` runs four checks: sheathing, hold-down, sill shear, opening ratio. SDPWS 2021 §4.3.6.4.2.1
additionally requires the PSW bottom plate at full-height sheathing to be anchored for a **uniform uplift
force `t` equal to `v_max`** — a distinct, mandatory check with a distinct connector (the sill shear connector
does not resist uplift). Case 4 shows the case that matters: T clamps to zero under dead load, yet
`t = 114.4 plf` is still required. Perforated walls fail here in practice.
**Fix:** add a fifth row, `t = v_total` plf vs the uplift capacity of the chosen bottom-plate anchorage.

### D-8 — `T` is never clamped at zero and a negative `T` still selects a hold-down — **should-fix**

`stacked_shearwall_calculator.html:483`: `var T=denom>0?OTM_num/denom:0;` — no floor at zero.
`selectHoldown()` (line 487) returns `HOLDOWNS[0]` for any negative argument. Proved live: with
`dl_override = +403,200` the sheet prints **T = −13,703 lb** and selects HDUE3-SDS3. Once D-3 is fixed the
negative branch becomes routine (WoodWorks Table 10A, p.43, shows exactly this: a −439 lb differential).
**Fix:** `T = Math.max(T, 0)` and print "uplift not required — dead load governs (T_raw = … lb)".

### D-9 — chord lever arm hard-wired to `C_o·ΣL_i`; no `d` input — **should-fix**

`denom = wall.Li*Co`. The real lever is the distance between the tension rod and the compression-post centroid.
WoodWorks uses `d` = 25.98–27.04 ft against a 29.0 ft wall; against that example the calculator is **6.8 % to
10.4 % unconservative** on `T` for this reason alone. On a perforated wall the SDPWS chord equation does use
`C_o·Σb_i`, so this is a modelling disclosure rather than a code violation — but it should be stated on the
output, and an optional `d` override would let the tool reproduce a published example.

### D-10 — no ASD/strength convention on `V_floor`, and no per-story force check — **should-fix**

The hint text says only *"Enter V_floor = the diaphragm shear delivered to this wall line at each level"*.
It does not say ASD or strength, and it does not say incremental or cumulative (the OTM loop implies
incremental). WoodWorks Table 6 publishes **cumulative** story shears, so a user copying a published table
straight in will double-count. The calculator also applies no `0.7` (seismic ASD) or `0.6` (wind ASD) factor
anywhere, and has no `S_DS` input for the `(0.6 − 0.14 S_DS)` vertical term.
**Fix:** label the column "V_floor — ASD, incremental force at this level (lb)" and add a note; optionally an
ASD/strength toggle with the 0.7 factor.

### D-11 — two sheathing options exceed the SDPWS §4.3.2.3(4) PSW cap of 2,435 plf nominal — **should-fix**

Proved live from `SHEATHING`:

| Option | ASD (plf) | Nominal = ×2.0 | Cap |
|---|---|---|---|
| 15/32" OSB 2-side 10d@4" | 1,290 | 2,580 | 2,435 |
| 15/32" OSB 2-side 10d@3" | 1,680 | 3,360 | 2,435 |

Both are selectable with no warning. (Case 3's trial sheathing was one of them, deliberately.)
**Fix:** flag or disable options with `Vall*2 > 2435` when the perforated method is in use.

### D-12 — `A_o` ignores the `h/3` minimum opening height, and openings are modelled as one lumped rectangle — **should-fix**

SDPWS 2015 §4.3.3.5 / 2021 Eq. 4.3-6: *"Where the opening height is less than h/3, an opening height of h/3
shall be used,"* and unsheathed areas above/below an opening must be added to `A_o`. The calculator forms
`A_o` only implicitly as `h_o,max·(L − ΣL_i)`, which is the table's worst-case assumption — conservative for a
wall whose openings really are all at `h_o,max`, and impossible to sharpen for a wall with mixed opening sizes.
It also means `h_o = 0` yields `C_o = 1.0` with no `h/3` floor. Note that the h/3 rule is what keeps
`C_o ≤ 1.0`; the source spreadsheet's `Co Calc.` sheet, which takes real opening areas, returns **1.4241** with
no cap.
**Fix:** take an opening schedule (width × clear height), apply the h/3 floor, and clamp `C_o` at 1.0.

### D-13 — the `r ≤ 5/6` gate is a house rule presented as a code limit — **disclosure**

`checkWall()` reports *"FAIL — Opening too tall for perforated method"* for `h_o/h > 5/6`, cited to
"SDPWS 2021 §4.3.3.4". Table 4.3.5.6 tabulates `C_o` all the way to `h_o = h` (last column, 8'-0" for an 8 ft
wall), and §4.3.3.4 is the aspect-ratio section, not the opening-height section. Proved live at
`h_o/h = 0.95` → FAIL. The gate is conservative and defensible as an office rule; it should be labelled as one.
Related: the check-table reference cells cite "§4.3.3.4" for `C_o` (it is §4.3.5.6 / Table 4.3.5.6) and
"§4.3.6.4" for the sill plate (that section is *Shear Wall Anchorage and Load Path*; the applicable clause is
§4.3.6.4.1.1) — mis-citations that will be read off the calc sheet by a reviewer.

### D-14 — two seismic reference values in the sheathing table are wrong — **disclosure**

Checked against SDPWS Table 4.3A (2015 text extracted; 2021 values unchanged for these rows), "Sheathing"
grade, ASD = nominal/2.0:

| Row | Wind nominal / ASD | Calculator wind | Seismic nominal / ASD | Calculator seismic |
|---|---|---|---|---|
| 7/16" 8d @ 6" | 670 / 335 | 335 ✓ | 480 / **240** | **230** ✗ |
| 7/16" 8d @ 4" | 980 / 490 | 490 ✓ | 700 / **350** | **360** ✗ |
| 7/16" 8d @ 3" | 1260 / 630 | 630 ✓ | 900 / 450 | 450 ✓ |
| 15/32" 10d @ 6" | 870 / 435 | 435 ✓ | 620 / 310 | 310 ✓ |
| 15/32" 10d @ 4" | 1290 / 645 | 645 ✓ | 920 / 460 | 460 ✓ |
| 15/32" 10d @ 3" | 1680 / 840 | 840 ✓ | 1200 / 600 | 600 ✓ |

Every wind value is exactly right. Two seismic cells are off (240→230, 350→360); they are display-only today
because of D-5, but they become live the moment D-5 is fixed. Also: the page's own badge reads
"SDPWS 2021 Table 4.3A ÷ 2.0 = ASD Allow." — correct, and worth keeping, because **SDPWS uses an ASD reduction
factor of 2.0 for both wind and seismic**; the wind/seismic difference lives in the nominal values
(`v_w ≈ 1.4 v_s`), not in the divisor.

### D-15 — sill connector `C_D` treatment is inconsistent — **disclosure**

`16d` at 160 lb is the spreadsheet's 120 lb × 1.33; `SDS ¼×4½` at 304 lb is 190 × 1.6 (the spreadsheet states
this); the LTP4 rows use Simpson catalogue values (600/667) rather than the spreadsheet's 575. Three different
bases in one table, none stated on the sheet. State `C_D` per row, or normalise.

### D-16 — `v this floor` is displayed but has no code meaning — **disclosure**

`v_this = V_floor/(C_o·ΣL_i)` uses the *incremental* level force, so it is neither the story unit shear nor
anything SDPWS defines. It leads the summary banner and gets its own demand card, while `v_total` — the only
quantity any check uses — sits third. On a five-story wall a reviewer reading the banner sees 69 plf at the
bottom story of a wall carrying 1,001 plf. Relabel or drop it.

---

## 6. Live run — no page errors

`node tools/_qaqc-stacked-shearwall-live.mjs` from the repo root. Zero `pageerror`, zero uncaught exceptions,
zero dialogs across five models. The only non-200 responses are three external webfont requests
(`fonts.googleapis.com` ×2, `fonts.cdnfonts.com`) which the offline `page.route` handler 404s by design —
harness artifacts, not calculator faults.
