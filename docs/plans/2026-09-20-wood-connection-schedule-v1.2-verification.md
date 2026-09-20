# Wood Connection Schedule v1.2 — engineering verification (FD-style totals and minimum spacing block)

Date 2026-09-20 · Verifier: engineering verifier (read-only) · Scope: v1.2 additions only (spec §13; v1 and v1.1 verified separately).
Engine `public/Calcs/engines/wood-connections.js` rev `2026-09-20 v1.2` · Page `public/Calcs/wood_connection_schedule_calculator.html`.
NDS 2018 with Commentary (`AWC_NDS2018-withCommentary_20210917.pdf`); page numbers are PDF pages (printed = PDF − 14).
Target format: Simpson Strong-Tie Fastener Designer report `calculation result.pdf` (3 × WSV3S screws, DFL 1.5 / 3.5, F_x 100, F_z 400).

## Summary verdict: SHIP

No discrepancy against the NDS text or the spec. The Commentary spacing table is transcribed exactly, the D ≥ 1/4 block reads the
same `gm` objects the C_Δ block evaluates (no second implementation), totals are qty × the per-fastener adjusted values with C_g
already inside Z′ (no double counting; C_g = 1.0 for D < 1/4 per §11.3.6.1), and the page prints the nine FD sections in order
with ✓ / ⚠ / ✗ marks. Three LOW observations (L1–L3) are cosmetic or conservative and can follow.
Suites re-run 2026-09-20: `npm run test:wc` 387/387, `node tools/_wc-ui-smoke.mjs` ALL PASS, plus a scratch Playwright drive
(11/11, script in the verifier scratchpad, not committed).

## Discrepancies

None blocking.

| # | Sev | Where | Observation | Direction | Suggested handling |
|---|-----|-------|-------------|-----------|--------------------|
| L1 | LOW | engine 727, page 921 (`spacingLineFor`) | For D < 1/4 the `stagger` input is not offered (stagger is gated on `geomActive`), so `g` is always checked against the in-line value (5D / 3D wood, 3D / 2.5D steel). The staggered value (2.5D) is printed on its own line with "—" actual and never used in a check. | Conservative (in-line ≥ staggered in every cell). | Either expose a `stagger` checkbox for nails / wood screws that switches the g check to `rowsStaggered`, or note "in-line value used" on the staggered line. |
| L2 | LOW | engine 700–703 | At θ = 90 (⊥ loading) the block reports `end_loaded = end_unloaded = 4D` and the page labels the first "end distance, loaded end". Table 12.5.1A has one ⊥ row (4D full / 2D half); there is no loaded end under ⊥ loading. Values are right; the label is borrowed from the ∥ case. | Cosmetic. | Print "end distance (⊥ loading)" when the keyed member is at θ = 90, or leave as is. |
| L3 | LOW | page 1056–1062 | Combined loading prints α, Z′_α and √(V² + T²) **per fastener**. The FD report prints the combined pair at the connection level (412 lb vs 597 lb). The ratio is identical, so nothing is wrong; it is a presentation gap (see "Gaps vs FD"). | Cosmetic. | Add `qty × Z′_α` and √(V_total² + T_total²) lines under the per-fastener ones. |

## Verified table

| # | Item | Engine / page | NDS basis | Result |
|---|------|---------------|-----------|--------|
| 1 | `DATA.SMALL_D_SPACING` wood side, not prebored / prebored: edge 2.5D / 2.5D; end tension 15D / 10D; end compression 10D / 5D; in-row ∥ 15D / 10D, ⊥ 10D / 5D; rows in-line 5D / 3D, staggered 2.5D / 2.5D | engine 129–133 | Commentary Table C12.1.5.7 (PDF 268) and Table C12.1.6.6 (PDF 269), identical cells | VERIFIED, every cell |
| 1 | Steel side, not prebored / prebored: edge 2.5D / 2.5D; end tension 10D / 5D; compression 5D / 3D; in-row ∥ 10D / 5D, ⊥ 5D / 2.5D; rows in-line 3D / 2.5D, staggered 2.5D / 2.5D | engine 131 | same tables, steel-side halves | VERIFIED, every cell |
| 1 | ∥ vs ⊥ keyed by the main member θ (0 → `rowPar`, 90 → `rowPerp`, between → the larger, which is always ∥); the side member is used only when the main is steel. Tension vs compression by each wood member's own `towardEnd` for its check line; the block's `end_loaded` by the keyed member's `towardEnd` | engine 709–728 | §12.1.5.7 / §12.1.6.5 give no numbers below 1/4 in; Commentary tables "may be used" (C12.1.5.7, C12.1.6.5) | VERIFIED |
| 1 | Advisory only: `R.warnings.push('advisory spacing: …')`, no `R.flags`, `checks[].ok` false → page ⚠ (`td.warn`), status unchanged. Playwright: nail n 2, s 1.0 → one warning, `warn: 1, bad: 0`, status identical before / after | engine 722–726, page 940 | spec §13.3 | VERIFIED |
| 2 | D ≥ 1/4 block reuses the C_Δ `gm` object of the keyed member: `end_loaded = gmKey.endFull`, `edge_unloaded = gmKey.edgeMin`, `rows_inline = rows_staggered = gmKey.rowMin`; constants `a1_par 4D` (= `geom.sFull`), `a2_perp 4D` (spec §6 attached-member rule), `end_unloaded 4D`, `edge_loaded 4D` (= `gm.loadedEdgeMin`) | engine 690–706 vs 636–662 | Tables 12.5.1A–D (PDF 104–105) | VERIFIED, single source |
| 2 | Interpolated end at θ 45: `spacingReq.end_loaded 2.75 === Cdelta.detail.members[0].endFull 2.75`; θ 90 rows: `rows_inline 1.5625 === rowMin` with l/D 3 → (5·1.5 + 10·0.5)/8 | hand run I | Table 12.5.1D ⊥, 2 < l/D < 6; Commentary C12.5.1.2 interpolation (v1.1) | VERIFIED |
| 2 | Withdrawal-only lag (V 0, T > 0): basis "Table 12.5.1E", edge 1.5D 0.75, end 4D 2.0, spacing 4D 2.0 for 1/2 in; checks echo `endMin / edgeMin / sMin` | engine 685–689, hand run J | Table 12.5.1E (PDF 105) | VERIFIED |
| 2 | `checks[]` echo the hard minima that drive `geom_*` (end = C_Δ 0.5 value, edge, loaded edge at θ > 0, g at rows ≥ 2, s 3D at n ≥ 2); page prints the C_Δ = 1.0 value with "(min x.xxx)" beside it and ✗ when below | engine 697–706; Playwright bolt main end 1.0 → `bad: 1`, `geom_end`, fail | §12.5.1.2 / Tables 12.5.1A–D | VERIFIED |
| 3 | `qty = n · rows`; D < 1/4 blank n / rows → 1 (v1.1 files); D ≥ 1/4 needNum | engine 510–525 | spec §13.2 | VERIFIED |
| 3 | Total basis: `V = V_total / qty`, `T = T_total / qty`; per basis: `V_total = V · qty`. `needNum` on the input pair only: blank V_total → incomplete, negative → invalid, 0 / 0 → nodemand (hand runs F1–F3) | engine 538–551 | spec §2, §13.2 | VERIFIED |
| 3 | `Z_total = qty · Zp`, `W_total = qty · Wcap`, null when the per-fastener value is null; on a fatal flag `emptyCap()` clears both | engine 849–850, 856 | — | VERIFIED |
| 3 | `pctV / pctT / pctComb = 100 · dc*`, null when the ratio is null; computed after the finite guard | engine 871–873 | FD "Demand/Resistance %" | VERIFIED |
| 3 | Bolts never take T: the §12.2.4 check reads `row.T_total` when `demandBasis === 'total'`, else `row.T` (hand run E: T_total 10 → invalid); `withdrawalActive` false → `I.T`, `I.T_total`, `W_total` null; page `sanitizeRows` nulls T / T_total on bolts | engine 396–397, 551; page 411 | §12.2.4 | VERIFIED |
| 3 | Page toggle carries the demand across (V_total = V · qty or V = V_total / qty) so D/C is unchanged; Playwright: per V 100 (qty 2) → total 200, engine V 100, dc equal to 1e-12; typed V_total 450 → V 225, chip "= 225 lb each of 2", summary 450, pctV = 100·dcV | page 518–524; Playwright | spec §13.2 | VERIFIED |
| 4 | Z′ = Z · C_D · C_M · C_t · C_g · C_Δ · C_eg · C_di · C_tn per fastener; Z_total = qty · Z′ | engine 823, 849 | §11.3.6.1 (PDF 82): reference lateral design values for dowel-type fasteners in a row "shall be multiplied by" C_g; C11.3.6 (PDF 265–266): C_g exists because group capacity "was not directly proportional to the number of fasteners" — the factor is the correction that makes n × (Z · C_g) the row value. Multiplying the already-reduced Z′ by qty is the intended use; nothing is applied twice. | VERIFIED, no double count |
| 4 | Nails / wood screws: `geomActive` false → `Cg = 1.0`, cite "§11.3.6.1: D < 1/4 in → 1.0"; hand run G (16d, n 3, rows 2): C_g 1.0, Z_total 845.4 = 6 × 140.9, W_total 355.7 = 6 × 59.28 | engine 754, 813 | §11.3.6.1 "C_g = 1.0 for dowel type fasteners with D < 1/4"" (PDF 82) | VERIFIED, no missing reduction |
| 4 | Rows: C_g is a per-row factor (n = fasteners in a row); each row gets the same C_g, so qty · Z′ = rows · (n · Z′) is the NDS reading; the ⊥ member area uses (rows − 1)·g (§11.3.6.3, v1) | engine 755, 771 | §11.3.6.1 "n = number of fasteners in a row" | VERIFIED |
| 5 | Hand checks | below | | VERIFIED |
| 6 | Page: details h4 order = Fastener properties · Adjustment factors · Penetration · Fastener pattern · Minimum spacing requirements · Withdrawal · Lateral · Combined loading (§12.4) · Notes, engineer checks and flags · Cites | page 971–1074; Playwright | spec §13.5 / FD p.4–5 | VERIFIED |
| 6 | Spacing table: 8 requirement lines, required / actual / mark columns, basis line with side material, prebored state, keyed member and "advisory: ⚠ never fails the row" for D < 1/4; ✓ on the four default-geometry lines; ⚠ for the advisory miss; ✗ for a Table 12.5.1 hard-minimum miss with "(min 1.750)" printed beside the C_Δ = 1.0 value 3.500 | page 933–961; Playwright | | VERIFIED |
| 6 | Lateral section prints Z_total = qty × Z′, "demand V per fastener / V_total", Demand / Resistance %; Withdrawal section the W_total / T_total pair; bolts print "n/a" for Withdrawal and Combined | page 1012–1065 | | VERIFIED |
| 6 | Print media: `#schedule .wc-det, #schedule .wc-det[hidden] { display: table-row !important }`; Playwright `emulateMedia print` → all three `.wc-det` computed `table-row` | page 165 | | VERIFIED |
| 6 | Inputs: "Side Member A" / "Main Member B" group titles, E (psi) read-only chip from species, shear planes on bolts, prebored checkbox on D < 1/4 only, t / w tooltips | page 736–830 | spec §13.1, §13.6 | VERIFIED |
| — | `inputs.D_H` 0.344 (16d), 0.363 (No. 10), null for lag / bolt; `coating: null` printed "— no product data" | fixtures 1650–1653; page 974, 980 | Table L3 / L4 | VERIFIED (fixtures) |

## Hand checks

All by nominal D; engine values from `WC.compute` on `newRow` + `defaultState` (DFL), independent of the fixture helpers.

**16d common, D 0.162, wood side, not prebored, main θ 0, towardEnd (Table C12.1.6.6, PDF 269)**

| line | multiple | hand | engine | |
|------|----------|------|--------|-|
| end distance, tension ∥ | 15D | 2.430 | `end_loaded` 2.43 | ✓ |
| in-row ∥ a1 | 15D | 2.430 | `a1_par` 2.43, `s_required` 2.43 | ✓ |
| in-row ⊥ a2 | 10D | 1.620 | `a2_perp` 1.62 | ✓ |
| end distance, compression | 10D | 1.620 | `end_unloaded` 1.62 | ✓ |
| rows in-line | 5D | 0.810 | `rows_inline` 0.81 | ✓ |
| rows staggered | 2.5D | 0.405 | `rows_staggered` 0.405 | ✓ |
| edge | 2.5D | 0.405 | `edge_unloaded` = `edge_loaded` 0.405 | ✓ |

Prebored: end 10D = 1.620, a1 10D = 1.620, a2 5D = 0.810, rows 3D = 0.486 / 2.5D = 0.405, edge 0.405 — engine 1.62 / 1.62 / 0.81 / 0.486 / 0.405 / 0.405 ✓.
Steel side, not prebored: end 10D = 1.620, compression 5D = 0.810, a1 1.620, a2 5D = 0.810, rows 3D = 0.486 / 0.405, edge 0.405 — engine matches, `sideMat: "steel"` ✓.
Advisory trip: n 2, s 1.0 → warning "advisory spacing: s = 1.000 < 15D = 2.430 (Commentary Table C12.1.6.6, not prebored)", `checks[0].ok false`, no flag ✓.

**1/2 in bolt, θ 0, tension (toward end), softwood (DFL), t_m = t_s = 1.5 (l/D 3)**

| line | rule | hand | engine | |
|------|------|------|--------|-|
| end, loaded (C_Δ = 1.0) | Table 12.5.1A softwood tension 7D | 3.500 | `end_loaded` 3.5; check hard min 3.5D = 1.75 | ✓ |
| a1 ∥ | Table 12.5.1B full 4D | 2.000 | `a1_par` 2.0; check hard min 3D = 1.5 | ✓ |
| edge, unloaded | Table 12.5.1C ∥, l/D 3 ≤ 6 → 1.5D | 0.750 | `edge_unloaded` 0.75 | ✓ |
| rows | Table 12.5.1D ∥ 1.5D | 0.750 | `rows_inline` = `rows_staggered` 0.75 | ✓ |
| end, unloaded / a2 / loaded edge | 4D | 2.000 | 2.0 / 2.0 / 2.0 | ✓ |

θ 90: end 4D = 2.0, loaded edge 4D = 2.0, rows (5·1.5 + 10·0.5)/8 = 1.5625, unloaded edge 0.75 — engine 2.0 / 2.0 / 1.5625 / 0.75 ✓.
θ 45: end 3.5 + (2.0 − 3.5)·45/90 = 2.75 = `Cdelta.detail.members[0].endFull` ✓.

**Totals (hand run D)** — same bolt, n 3, rows 2, s 2.0, g 0.75, `demandBasis total`, V_total 600: qty 6, V 100, C_g 0.9968 (< 1, Eq. 11.3-1), Z′ 481.7, Z_total 2890.3 = 6 × 481.7 ✓, dcV 0.2076, pctV 20.76 = 100 × dcV ✓, T / T_total / W_total null ✓.
**Nail totals (hand run G)** — 16d, V 20, T 5, n 3, rows 2: qty 6, C_g 1.0, Z_total 845.4 = 6 × 140.9, W_total 355.7 = 6 × 59.28, V_total 120, T_total 30, pctT 8.43, pctComb 22.63 = 100 × dc ✓.

## Gaps vs the FD report (per-connection output the page still lacks)

Tested values for proprietary screws (W_tested, W_Max, Z_tested, "(Tested)" spacing) are out of scope and not listed.

1. **Geometry sketch.** FD pages 2–3 draw the pattern in 3D and in plan with the required a1 / End,1 / End,2 / Edge,1 / Edge,2 dimensions. The page has no figure (no `<svg>` / `<canvas>`); the spacing table carries the same numbers as text.
2. **Sub-status badges.** FD prints four pass chips per fastener — Connection, Penetration, Distance, Quantity — beside the overall "Passed". The page has one status and the reasons live in the notes / flags list.
3. **Combined loading at the connection level** (L3): FD prints "Total Combined Demand Loads Z′ = 412.31 lb" and "Total Adjusted Design Value Z′_α = 597 lb"; the page prints the per-fastener pair only.
4. **Demand / Resistance line format.** FD prints "400 lb / 635 lb = 62.99 %" on one line; the page prints the demand pair on one line and the % on the next. Same numbers.
5. **Corrosion resistance / coating** (FD "Coating: Yellow-Zinc Coated", "Corrosion Resistance: Low"). Page prints "— no product data"; needs a product table, not NDS.
6. **Unadjusted per-fastener withdrawal value** (FD "NDS Withdrawal Design Value W_P = 141 lb" = W · p_t before adjustment). Page prints W (lb/in), W′ (lb/in), W′ · p_t and W_cap; the W · p_t intermediate is not on its own line.
7. **Input echo block.** FD opens with an "Input" panel (design method, shear planes, connection type, installation type, both members with E, adjustment-factor inputs, rows / qty). The page's inputs row carries the same fields in the FD order, but they print as form controls rather than as a labelled echo table; the printed sheet is legible (print CSS strips the control chrome) but is not the FD table layout.

Everything else in the FD per-connection output — fastener properties (D, D_r, D_H, L, thread T, F_yb), adjustment factors, penetration p and p_min, fastener pattern (n per row, rows, qty), minimum spacing requirements (a1, a2, loaded / unloaded end, loaded / unloaded edge), withdrawal (p_t, W_H, W per fastener, W_total, %), lateral (l_m, l_s, F_em, F_es, R_e, R_t, six modes with R_d and Z, Z_min, Z′, Z_total, %) and the combined section — is present, with more intermediates than FD prints.
