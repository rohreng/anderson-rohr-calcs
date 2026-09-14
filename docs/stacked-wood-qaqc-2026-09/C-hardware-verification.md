# Connector Hardware Allowable Load Verification
### `stacked_shearwall_calculator.html` (lines 361–398) vs. Simpson Strong-Tie catalog / ICC-ES ESRs / NDS 2018
Basis: Douglas Fir-Larch / Southern Pine framing, published ASD allowable with wind/seismic duration increase already applied (Simpson "160" / C_D = 1.6). No further adjustment applied.

**Read-only verification — no calc file was modified.**

---

## 1. Summary Table

| Device | Code value | Verified value (DF/SP, 160) | Source | Delta % | Prerequisites the calc must enforce | Governing mode |
|---|---|---|---|---|---|---|
| HDUE3-SDS3 | 3,790 lb | **3,790 lb** | ESR-2330 (reissued May 2026) Table 2B | 0% | 7 SDS ¼x3", 3½" min post width, 5/8" AB | Wood/screw assembly (Table 2C steel-only = 4,380 lb, higher) |
| HDUE5-SDS3 | 5,375 lb | **5,375 lb** | ESR-2330 Table 2B | 0% | 10 SDS ¼x3", 3½" min width, 5/8" AB | Wood/screw assembly (steel-only = 7,085 lb) |
| HDUE7-SDS3 | 7,015 lb | **7,015 lb** (footnote 11) | ESR-2330 Table 2B | 0% | 13 SDS ¼x3", 3½" min width, 5/8" AB, **high-strength anchor bolt required** | Wood/screw assembly (steel-only = 7,470 lb; close margin) |
| HDUE9-SDS3.5 | 9,390 lb | **9,390 lb** — *but only if wood member thickness ≥ 4.5"* | ESR-2330 Table 2B | 0% (at correct thickness) | 16 SDS ¼x3.5", 7/8" AB, **member thickness ≥4.5"** (at 3.5" thickness only 8,425 lb is permitted) | Wood/screw assembly (steel-only = 9,845 lb) |
| HDUE13-SDS3.5 | 12,950 lb | **12,950 lb** — *at wood member thickness = 7.25"*, not "5½" width" | ESR-2330 Table 2B | 0% (at correct thickness) | 23 SDS ¼x3.5", 1" AB, **heavy hex nut required**, member **thickness 7.25"** (at 5.5" thickness only 11,900 lb; the 5.5"-width/6x6 column actually gives 13,110 lb — a different geometry than the tabulated 12,950) | Wood/screw assembly (steel-only = 13,645 lb) |
| HDUE17-SDS4.5 | 17,685 lb | **17,685 lb** (footnote 11) | ESR-2330 Table 2B | 0% | 28 SDS ¼x4.5", 1" AB, min width 5½" (6x6) **and high-strength anchor bolt required** — calc's note field is blank, omitting the anchor-bolt callout | Wood/screw assembly (steel-only = 24,260 lb) |
| CMSTC16 | 4,690 lb | **4,690 lb** | ESR-2105 (reissued Jan 2026) Table 4 | 0% | 50–16d sinker **total** (25 per side, not "50 per side" as labeled) | Connection/nail strength governs (steel strap = 4,805 lb) |
| CMST14 | 6,475 lb | **6,475 lb** | ESR-2105 Table 4 | 0% | 56–16d×2½" common **total** (28 per side) | Connection/nail strength governs (steel = 6,550 lb) |
| CMST12 | 9,215 lb | **9,215 lb** | ESR-2105 Table 4 | 0% | 74–16d×2½" common **total** (37 per side) | Connection/nail strength governs (steel = 9,430 lb) |
| LTP4 (Roof) | 600 lb | **Not confirmed** — closest published values: 715 lb (12–0.131x1.5 nails, "G" dir., CD=1.25/1.6) or 910 lb (12–SD9 screws) | Simpson C-C-2026 catalog p.309 / ESR-3096 Table 6 | n/a | See note below | n/a |
| LTP4 (Floor) | 667 lb | **Not confirmed** — closest published values: 580 lb (CD=1.0, nails) or 800 lb (SD screws, "H" dir., constant) | Simpson C-C-2026 catalog p.309 / ESR-3096 Table 6 | n/a | See note below | n/a |
| 16d nail | 160 lb | **164.8 lb** (16d **box**, D=0.135", ×1.6) — NOT 16d common (225.6 lb) | NDS 2018 Table 12N | ≈ -3% (box) / -29% (vs. common) | Calc's generic "16d Nails" label should specify box vs. common | Not stated in Table 12N (combined yield-mode value) |
| SDS ¼"x4½" | 304 lb | **304.0 lb exact** — but this is the mixed-species (one member SPF/HF) value; pure DF/SP = 400 lb | Simpson C-F-14/C-C catalog p.321, "Sole-to-Rim Connections" table, SDS25412 | -24% vs. pure DF/SP | Value assumes at least one connected member is SPF/HF, not DF/SP as the calc basis requires | Wood-bearing (AC233 test-based, parallel-to-grain) |
| ½" Anchor Bolt | 1,813 lb | **1,040 lb** (NDS Table 12E, Z∥=650 lb × 1.6) | NDS 2018 Table 12E, sawn lumber/SCL to concrete | **+74%** (code is unconservative vs. NDS wood-bearing capacity) | See discussion §5 | Wood bearing in sill plate + bolt bending (Mode IIIs) |
| ⅝" Anchor Bolt | 2,587 lb | **1,488 lb** (NDS Table 12E, Z∥=930 lb × 1.6) | NDS 2018 Table 12E | **+74%** (code is unconservative vs. NDS wood-bearing capacity) | See discussion §5 | Wood bearing in sill plate + bolt bending (Mode IIIs) |

**Bottom line:** The HOLDOWNS and STRAPS arrays are exact, verbatim matches to the current (2026-reissued) ESR-2330 and ESR-2105 tables — excellent. The SILL_CONN array is where problems concentrate: the two anchor-bolt values are ~74% higher than a straight NDS Table 12E calculation supports (a real conservatism/safety question), the LTP4 values do not match any published Simpson table I could locate, and the SDS-screw and 16d-nail values, while numerically close to *some* published number, correspond to a lower-bound/mixed-species or box-nail case rather than pure DF/SP common-nail values.

---

## 2. HOLDOWNS — ESR-2330 (Simpson Strong-Tie Screw Hold-Down Connectors, reissued May 2026, subject to renewal Jan 2027)

Source used: `https://icc-es.org/wp-content/uploads/report-directory/ESR-2330.pdf` (fetched and parsed directly — the direct WebFetch failed to render the PDF text, so the file was downloaded and parsed with `pypdf`).

Table 2A (dimensions/fasteners) and Table 2B (allowable tension loads) were read directly. All six HDUE values coded in the calc (3,790 / 5,375 / 7,015 / 9,390 / 12,950 / 17,685) match Table 2B **exactly**, including the SDS screw sizes and quantities, and anchor bolt diameters match Table 2A exactly (5/8", 5/8", 5/8", 7/8", 1", 1").

Key nuance in Table 2B: allowable loads are tabulated against **wood member thickness** (the dimension parallel to the long axis of the SDS screws — effectively how deep a post you have, not just its face width), in columns for 3", 3.5", 4.5", 5.5", 7.25", and a final "5.5(7)" column that requires 6x6-minimum **width** per footnote 7. This is a different variable than the "min width" the calc surfaces in its `post` field:

- **HDUE9-SDS3.5**: the coded 9,390 lb value is only valid at wood member **thickness ≥ 4.5"**. At the more common 3.5"-thickness post, ESR-2330 permits only **8,425 lb**. The calc's `post` note ("3½″ min width") does not communicate this — thickness and width are two different dimensions and only thickness governs the load step from 8,425→9,390.
- **HDUE13-SDS3.5**: the coded 12,950 lb value sits at the **7.25" thickness** column, not the "5.5(7)" [6x6-width] column (which is actually **13,110 lb**, a different value for a different post configuration). At 5.5" thickness the value drops to 11,900 lb. The calc's post note "5½″ min width" therefore doesn't match the geometry that actually produces 12,950 lb.
- **HDUE17-SDS4.5**: the coded 17,685 lb value requires footnote 7 (6x6 minimum width) **and** footnote 11 (high-strength anchor bolt required). The calc's `post` field correctly flags the 6x6 requirement ("5½″ (6×6 for max load)") but the `note` field is blank — it should also say "high-strength anchor bolt required," matching how the calc already handles this exact footnote for HDUE7.
- **HDUE7-SDS3**: footnote 11 (high-strength anchor bolt) correctly reflected in the calc's note field ("Hi-str. anchor bolt req'd").
- **HDUE13-SDS3.5**: footnote 10 (heavy hex nut) correctly reflected ("Heavy hex nut req'd").

Table 2C (steel-device-only capacity, used for ASCE 7 §12.11.2.2.2 wall-anchorage checks, not shear-wall holdown checks) is higher than the Table 2B assembly value in every case, confirming the wood/screw assembly (not the bare steel hold-down body) governs the tabulated numbers used in the calc.

Discontinued-HDU note in the calc is accurate — ESR-2330 §3.1.1 states HDU hold-downs are discontinued and HDUE is the direct replacement (per Simpson's own bulletin, also independently found: `bradleyengineeringinc.com/.../One-for-One-Replacement-for-Discontinued-HDUs.pdf`).

---

## 3. STRAPS — ESR-2105 (Simpson Strong-Tie Straps, reissued Jan 2026, subject to renewal Jan 2027)

Source used: `https://icc-es.org/wp-content/uploads/report-directory/ESR-2105.pdf`, Table 4 ("Allowable Tension Loads for the CS and CMST Series Coil Straps and the CMSTC16 Coil Tie Strap").

| Model | Nails | Connection strength (Cd=1.6) | Steel strength | Governs |
|---|---|---|---|---|
| CMST12 | 74–16d×2½" common (or 86–10d×2½") | 9,215 lb | 9,430 lb | Connection |
| CMST14 | 56–16d×2½" common (or 66–10d×2½") | 6,475 lb | 6,550 lb | Connection |
| CMSTC16 | 50–16d sinker | 4,690 lb | 4,805 lb | Connection |

All three match the calc's `Tall` values exactly. Footnote 4 of Table 4 confirms these connection-strength values are derived from the NDS §12.3.1 yield-mode equations with the strap treated as the side member (Fes = 2.2 Fu/CD), **and already include the CD = 1.6 load-duration factor** — no further adjustment should be applied, consistent with the task's stated basis.

**Labeling issue (not a load-value issue):** ESR-2105 footnote 1 states the tabulated nail count is the **total** for the connection, with **one half installed in each wood member** forming the splice. The calc's `nails` strings read "50–16d sinker **per side**," "56–16d×2½ common **per side**," "74–16d×2½ common **per side**" — this wording, taken literally, implies double the actual total nail count (e.g., that CMSTC16 needs 100 nails total, not 50). The tabulated *loads* are unaffected (they are correct), but the fastener-schedule text is misleading and should read "total (½ each side)" rather than "per side."

---

## 4. LTP4 — could not confirm 600 / 667 lb

Two independent current sources were checked for the LTP4 lateral tie plate:

1. **Simpson C-C-2026 catalog** (`Wood Construction Connectors`, p. 309–310, downloaded directly via curl from buildsite.com after WebFetch was blocked with a 403): Table row for LTP4 (12 fasteners each side):
   - (12) 0.131"x1½" nails: **G = 580 (Cd=1.0) / 715 (Cd=1.25) / 715 (Cd=1.6)**; **H = 525 (constant, all Cd)**
   - (12) #9x1½" SD screws: **G = 910 (constant)**; **H = 800 (constant)**
   - Footnote: over 3/8" WSP sheathing, use 0.72× listed load; over 1/2" WSP, use 0.64× listed load (unless 2½" fasteners are used, which achieve full load through sheathing).
2. **ESR-3096** (`https://www.buildsite.com/pdf/simpsonstrongtie/LTP4LTP5A34A35-Framing-Angles-Plates-ICC-ES-Evaluation-2970378.pdf`), Table 6 — LTP4 Framing Connector: only the SD9-screw option is ICC-ES evaluated (nail-based values don't require an ESR since they're plain NDS nail values): **G = 910, H = 800, constant across CD = 1.0 through 1.6** (fastener/screw-shear governs, not wood, so no duration benefit applies).

Neither source produces 600 or 667 lb under any fastener/direction/duration combination I could find, going back through the C-C-2017/2019 lineage as far as I could retrieve (older catalog links returned 404/stub pages). Notably: **600 × (16/12) = 800** and **667 × (16/12) ≈ 889** don't line up either; but working backward from the calc's own `sillVall()` formula at the coded `defaultSpacing:16`, Vconn=600 → 450 plf, and Vconn=667 → 500.25 ≈ **500 plf**. These round plf numbers (450 and 500) look like the actual design targets, back-solved into a "per-connector at 16" o.c." number to fit the array's `{Vconn, defaultSpacing}` structure — rather than being lifted from a specific catalog line. **I cannot confirm 600/667 against any current Simpson-published LTP4 rating and recommend treating this pair as unverified** until Nick can point to the specific source (a superseded catalog edition, a different Simpson product, or an internally-derived plf target) — or replace them with the current catalog's G/H values (715 lb nailed / 910 lb SD-screw at Cd=1.6, 580/910 lb at Cd=1.0) as applicable to the actual installation being modeled.

---

## 5. 16d nail — NDS 2018 Table 12N

Source: `AWC_NDS2018-withCommentary_20210917.pdf`, Table 12N ("Common, Box, or Sinker Steel Wire Nails: Reference Lateral Design Values, Z, for Single Shear (two member) Connections"), side member thickness ts = 1.5", G = 0.50 (Douglas Fir-Larch) column.

| Nail type | Diameter D | Z (Cd = 1.0) | Z × 1.6 |
|---|---|---|---|
| 16d common | 0.162" | 141 lb | **225.6 lb** |
| 16d sinker | 0.148" | 118 lb | **188.8 lb** |
| 16d box | 0.135" | 103 lb | **164.8 lb** |

The code's value of **160 lb** is closest (within 3%, conservative) to a **16d box nail**, not the 16d common nail that "16d Nails" most naturally implies in shear-wall practice. If 16d common nails are actually intended (and typically are, for sill-to-floor-framing toe-nail or face-nail connections), the true single-shear allowable at Cd=1.6 is **225.6 lb — 41% higher** than what the calc uses. This makes the calc conservative (safe) if common nails are field-installed, but the array should be relabeled to state which nail subtype (box vs. common vs. sinker) the 160 lb value is actually for, since "16d Nails" as currently labeled is ambiguous and a user could reasonably assume it represents 16d common capacity.

---

## 6. SDS ¼" x 4½" screw — Simpson catalog / ESR-2236

ESR-2236 (`https://icc-es.org/wp-content/uploads/report-directory/ESR-2236.pdf`) Table 3 gives the generic wood-to-wood single-shear reference lateral value (unadjusted, before CD): **Z = 350 lb** for the 4½" screw with a 1.5" wood side member and both members ≥ 0.50 SG (i.e., pure DF/SP) — ×1.6 = **560 lb**.

However, the calc's SILL_CONN application (sole/sill plate fastened to a rim board below) matches a **specific, more restrictive Simpson catalog table** exactly in configuration: "SDS – Allowable Shear Values for Sole-to-Rim Connections" (Simpson C-F-14/Fastening Systems Technical Guide, p. 321 — downloaded directly, `https://d29c95q8mcesvj.cloudfront.net/wysiwyg/pdf/SDS25412_Catalog.pdf`):

| Rim board | Sole plate | Allowable (Cd=1.0) |
|---|---|---|
| 2x DF/SP | DF/SP | 250 lb |
| 2x DF/SP or 2x SPF/HF | **either member SPF/HF** | **190 lb** |

**190 × 1.6 = 304.0 lb exactly**, matching the calc's coded value to the decimal. This confirms the derivation and duration factor precisely — but it is the **mixed-species / lower-bound** row, not the pure-DF/SP row. Pure DF/SP-to-DF/SP sole-to-rim capacity is **250 × 1.6 = 400 lb**, 24% higher than the code's value. Under the stated verification basis (DF/SP framing throughout), the code's SDS value is conservative by about 24% — safe, but inconsistent with the calculator's stated all-DF/SP basis, and worth flagging so Nick can decide whether 304 lb (safety margin for mixed framing) or 400 lb (pure DF/SP, matching the stated basis) is the intended design value.

---

## 7. Anchor bolts, wood-to-concrete — NDS 2018 Table 12E + independent yield-mode check

### 7.1 Table 12E as published
`AWC_NDS2018-withCommentary_20210917.pdf`, Table 12E ("Bolts: Reference Lateral Design Values, Z, for Single Shear (two member) Connections — for sawn lumber or SCL to concrete"). Footnote 3: **"Fe = 7,500 psi for concrete with minimum f'c = 2,500 psi."** Footnote 4: **"Six inch anchor embedment assumed."** Row for side member (sill plate) thickness = 1½", embedment ≥6.0", Douglas Fir-Larch G=0.50 column:

| Bolt dia. | Z∥ (Cd=1.0) | Z⊥ (Cd=1.0) |
|---|---|---|
| ½" | 650 lb | 380 lb |
| 5/8" | 930 lb | 530 lb |

Applying Cd = 1.6 (parallel-to-grain, the governing direction for a sill-plate shear connection):

- ½": 650 × 1.6 = **1,040 lb**
- 5/8": 930 × 1.6 = **1,488 lb**

### 7.2 Independent yield-limit check
Per NDS §12.3.1/Table 12.3.1A, and cross-checked against AWC Technical Report 12 ("General Dowel Equations for Calculating Lateral Connection Values," `web-media.awc.org/.../AWC-TR12-1510.pdf`) using the fundamental quadratic dowel equations (Table 1-1) rather than the simplified k-factor shortcuts, with:

- Fem (concrete) = 7,500 psi (Table 12E footnote 3)
- Fes (DFL, parallel to grain, G=0.50) = 5,600 psi (NDS Table 12.3.3: Fe∥ = 11,200G = 11,200×0.50 = 5,600 psi — confirmed directly from the table)
- Fyb = 45,000 psi (typical anchor-bolt bending yield per NDS Appendix I.4 commentary)
- ts = 1.5", lm (embedment) = 6.0", Rd = 4.0 (Im, Is) / 3.6 (II) / 3.2 (IIIm, IIIs, IV), no gap

Computed yield loads (Z, Cd=1.0):

| Mode | ½" bolt | 5/8" bolt |
|---|---|---|
| Im (main/concrete bearing) | 5,625 | 7,031 |
| Is (side/wood bearing) | 1,050 | 1,313 |
| II | 2,011 | 2,514 |
| IIIm | 2,327 | 2,942 |
| **IIIs (governs)** | **631** | **902** |
| IV | 766 | 1,197 |

This independently reproduces the published Table 12E values (650 / 930) within about 3% (the small residual is attributable to NDS's own intermediate rounding), and confirms the governing failure mode is **IIIs — wood bearing failure in the 1.5" sill plate combined with one plastic hinge forming in the bolt within the concrete** — i.e., the connection is wood-controlled, not concrete- or steel-controlled, for this thin a sill plate.

### 7.3 Comparison to the code values — flag for follow-up
| | Code (Vconn) | NDS Table 12E × 1.6 | Delta |
|---|---|---|---|
| ½" AB | 1,813 lb | 1,040 lb | **+74.3%** |
| 5/8" AB | 2,587 lb | 1,488 lb | **+73.9%** |

The code's anchor-bolt values are roughly **1.74× higher, consistently, for both diameters**, than the NDS single-shear wood-bearing capacity of a 1.5" DF/SP sill plate. I checked and ruled out the more common explanations:
- **Thicker sill plate:** even at ts = 3.5" (the thickest side-member row published in Table 12E), Z∥ for ½" bolt is only 770 lb (×1.6 = 1,232 lb) — still 32% short of 1,813.
- **Double shear:** wood-to-concrete anchorage is inherently single shear (concrete is not a symmetric two-sided member); there is no NDS double-shear table for this case.
- **Perpendicular-to-grain governing:** Z⊥ values are lower, not higher, so this doesn't explain the gap either.

I could not identify a published table (NDS, ESR, or Simpson) that produces 1,813/2,587 lb for these bolt sizes in a wood sill-plate-to-concrete application. Given the consistent ~1.74× ratio across both diameters, this reads as a deliberate alternate derivation (e.g., a steel-bolt-shear-capacity check, a proprietary expansion/epoxy anchor table governed by concrete breakout rather than NDS wood bearing, or a value carried over from a different assumption such as a thicker built-up sill) rather than a simple lookup error — but I cannot confirm which, and I'm not willing to guess. **This is the highest-priority open item**: if the field condition is genuinely a single 1.5"-thick DF/SP sill plate bolted to a 6"-embedment anchor with no additional bearing plate/washer enhancement, the NDS Table 12E wood-bearing capacity (1,040 / 1,488 lb) governs per code, and the calc's values would be unconservative by roughly 43% (1 − 1/1.74) relative to that limit state.

---

## Sources

- ESR-2330 (Simpson Strong-Tie Screw Hold-Down Connectors), reissued May 2026 — `https://icc-es.org/wp-content/uploads/report-directory/ESR-2330.pdf`
- ESR-2105 (Simpson Strong-Tie Straps), reissued Jan 2026 — `https://icc-es.org/wp-content/uploads/report-directory/ESR-2105.pdf`
- ESR-2236 (Simpson Strong-Tie SDS Screws) — `https://icc-es.org/wp-content/uploads/report-directory/ESR-2236.pdf`
- ESR-3096 (Simpson Strong-Tie L, A34/A35, LTP4/LTP5, and related framing connectors) — `https://www.buildsite.com/pdf/simpsonstrongtie/LTP4LTP5A34A35-Framing-Angles-Plates-ICC-ES-Evaluation-2970378.pdf`
- Simpson Strong-Tie Wood Construction Connectors catalog, C-C-2026 — `https://www.buildsite.com/pdf/simpsonstrongtie/LTP4LTP5A34A35-Framing-Angles-Plates-Product-Data-2969626.pdf`
- Simpson Strong-Tie Fastening Systems catalog, C-F-14 (SDS Heavy-Duty Connector Screw load tables) — `https://d29c95q8mcesvj.cloudfront.net/wysiwyg/pdf/SDS25412_Catalog.pdf`
- AWC NDS 2018 with Commentary — `C:\Users\nickh\OneDrive - Rohr Engineering\Technical Resources - Documents\Wood\Wood Codes and Technical Guides\Wood Codes\NDS - 2018\AWC_NDS2018-withCommentary_20210917.pdf` (Tables 12N, 12E, 12.3.1A, 12.3.1B, 12.3.3)
- AWC Technical Report 12, "General Dowel Equations for Calculating Lateral Connection Values" — `https://web-media.awc.org/wp-content/uploads/2021/12/17210714/AWC-TR12-1510.pdf`
- Calc source reviewed (read-only): `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\public\Calcs\stacked_shearwall_calculator.html`, lines 361–400
