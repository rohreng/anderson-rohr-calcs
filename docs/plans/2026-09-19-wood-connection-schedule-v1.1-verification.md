# Wood Connection Schedule v1.1 — engineering verification (angles 0–90°, staggered rows)

Date 2026-09-19 · Verifier: engineering verifier (read-only) · Scope: v1.1 additions only (spec §12; v1 verified separately, SHIP).
Engine `public/Calcs/engines/wood-connections.js` rev `2026-09-19 v1.1` · Page `public/Calcs/wood_connection_schedule_calculator.html`.
NDS 2018 with Commentary (`AWC_NDS2018-withCommentary_20210917.pdf`); page numbers below are PDF pages (printed = PDF − 14).

## Summary verdict: FIX FIRST (D1, D2), then SHIP

The angle work (Hankinson, K_θ, R_d, end-distance interpolation, edge/row envelope, spread formula, two-interpretation C_g) is
correct against the NDS text and the three hand checks reproduce the fixtures to the printed digits. Two stagger items need a
small fix before deploy: the offset is not reduced to the NDS "closest fasteners" distance (D1, conservative but the merged
fixture is built on a layout that does not merge), and the across-grain spread ignores the stagger offset (D2, unconservative by
up to s/2 in the 5 in check). Both are one-line changes plus a fixture rebuild. D3–D6 are low and can follow.
Test suites: `npm run test:wc` 333/333, `node tools/_wc-ui-smoke.mjs` 79/79 (both re-run 2026-09-19).

## Discrepancies

| # | Sev | Where | Finding | Direction | Fix |
|---|-----|-------|---------|-----------|-----|
| D1 | MEDIUM | engine 491–492, 647; fixtures 1390–1398 | §11.3.6.2 (PDF 82) measures "the distance between the closest fasteners in adjacent rows measured parallel to the rows". For fasteners at s in each row, that distance is `min(offset, s − offset) ≤ s/2`. The engine accepts `0 < offset < s` and uses the typed value directly for both the merge test (`g < offset/4`) and `s_eff`. The merged fixture uses s = 4, offset = 3.2: the closest-fastener offset is 0.8, so the merge criterion is g < 0.2, which cannot coexist with the ∥ row minimum 1.5D = 0.75; that layout does not merge under NDS. | Conservative in C_g (engine 0.9649 vs separate 0.9946) but the fixture documents the wrong reading, and for offset in (s/2, s) the engine over-merges and uses an s_eff > s/2. | Use `offClosest = Math.min(offset, s − offset)` for the merge test and s_eff (or validate offset ≤ s/2 with a UI hint); rebuild the merged fixture on a layout that merges, e.g. 1/2 bolt, s = 8, offset = 4, g = 0.75 < 1.0. |
| D2 | LOW–MEDIUM | engine 597 | §12.5.1.3 (PDF 104) limits the ⊥-to-grain distance between the outermost fasteners. With staggered rows the group's along-row extent is `(n − 1)·s + offset`, not `(n − 1)·s`; the engine's `spread = (n−1)·s·sinθ + (rows−1)·g·cosθ` drops the offset. Example, θ = 90, n = 3, s = 2.25, offset 1.125: engine 4.50 in (pass), actual 5.625 in (> 5, should fail). | Unconservative by up to s/2 for ⊥ or angled members with stagger on. | `spread = ((n−1)·s + (staggerActive ? offClosest : 0))·sinθ + (rows−1)·g·cosθ`; add a fixture at θ = 90 with stagger that crosses 5 in only because of the offset. |
| D3 | LOW | engine 647 (`sEff = offset`) | Eq. 11.3-1 (PDF 82) assumes uniform spacing s. A merged row of 2n fasteners has alternating gaps `offset` and `s − offset` (mean s/2). C_g rises as s falls (n 4, D 1/2, A 19.25/8.25: s 0.8 → 0.9908, s 2 → 0.9775, s 4 → 0.9568; Table 11.3.6A fn 2 says the same), so `s_eff = offset < s/2` is the least conservative reading. At the default symmetric stagger (offset = s/2) it is exact. 4000-case sweep (n 2–8, s 1.5–6, D 1/4–1, wood and steel sides): merged C_g never exceeded the separate-row C_g for offset ≥ 0.25·s; it did at 0.1·s (94 % of cases, up to +0.15) but that region is unreachable (merge needs g < offset/4 with g ≥ 1.5D → s > 60D). With `s_eff = s/2` there were no exceedances at any offset. | Slightly unconservative for offset < s/2; also the odd-row "most conservative interpretation" (Fig. 11B, PDF 83) is assumed rather than enforced. | `s_eff = s/2` (uniform-equivalent), or keep `s_eff = offClosest` and guard `C_g = min(C_g merged, C_g separate)`. Either makes the odd-row rule true by construction. |
| D4 | LOW | page 299 | "How to use" still says C_g/C_Δ assume "no stagger (§11.3.6.2 offsets are not modelled)" and "4D for one row". v1.1 models stagger, and the engine uses 3D for the single-row ⊥ width (engine 637, cite "minimum ∥-to-grain spacing 3D (Table 12.5.1B)"; spec §6 says 4D — 3D is the smaller area and therefore the conservative reading of §11.3.6.3, PDF 82). Playwright probe: `helpStale = true`. | Documentation only. | Update the help bullet: stagger per §11.3.6.2, single row width 3D. Align spec §6 to 3D or the engine to 4D (v1 item, out of scope here). |
| D5 | LOW | engine 591 | At 0 < θ < 90 the unloaded edge minimum is the ⊥ value 1.5D only. The ∥ rule (Table 12.5.1C, PDF 105) for l/D > 6 with two or more rows is max(1.5D, g/2), which exceeds 1.5D when g > 3D. The printed note claims "the governing of the ∥/⊥ rules (edge, rows)", which is not strictly true for the unloaded edge in that region. C12.5.1.3 (PDF 278) confirms NDS gives no edge rule at intermediate angles, so this is the engine's own envelope. | Unconservative only for l/D > 6, rows ≥ 2, g > 3D at an intermediate angle. | `edgeMin = max(1.5D, (lD > 6 && rows ≥ 2) ? g/2 : 0)`; loaded edge `max(4D, same)` for 0 < θ < 90. |
| D6 | LOW | engine 168 (`round50` after Hankinson) | Table 12.3.3 fn 2 (PDF 100): "Tabulated values are rounded to the nearest 50 psi" describes the tabulated F_e∥ / F_e⊥; Eq. 12.3-11 (PDF 98) has no rounding step, and Appendix J (PDF 190) prescribes none. Rounding F_eθ moves it ±25 psi (≤ 0.6 %), either direction: DFL 1/2 at 45°, 4032 → 4050 (+0.45 %, unconservative on F_e; Z effect ≤ that). | Sub-1 %, either direction. Not prescribed. | Engineer's call. Dropping the second rounding is the literal reading; keeping it makes F_eθ "table-like". Document whichever is kept in the cite. |

Not a discrepancy but worth a decision: the §12.6.2 requirement ("the gravity axis of each member **shall** pass through the
center of resistance", PDF 106) is printed as a note only. The AISC plate-bearing note counts as an unresolved engineer check
(`R.unresolved += 1`); §12.6.2 could be treated the same way so the row badge shows it.

## Verified table

| # | Item | NDS text (PDF page) | Engine (line) | Result |
|---|------|--------------------|---------------|--------|
| 1a | Hankinson form F_eθ = F_e∥·F_e⊥ / (F_e∥ sin²θ + F_e⊥ cos²θ) | Eq. 12.3-11 §12.3.4 (98); Eq. J-2 (190); C12.3.4 (275) confirms use in each yield equation | `feAtAngle` 165–169 | VERIFIED. Exact at 0 / 90 (early returns). Rounding: see D6. |
| 1b | θ definition for K_θ: maximum angle between load and grain for any member, 0 ≤ θ ≤ 90 | Table 12.3.1B notes (98) | `thetaK = max(M.θ or 90 if end grain, S.θ)` 524–525; `Ktheta` 171 | VERIFIED. K_θ(45) = 1.125. End-grain main member taken at 90 (load ⊥ to its grain) — consistent with §12.3.3.4 using F_e⊥. |
| 1c | R_d at angles: 4K_θ / 3.6K_θ / 3.2K_θ for 0.25 ≤ D ≤ 1; K_D for D < 0.25 (no K_θ); K_D·K_θ for nominal ≥ 0.25 with D_r < 0.25 | Table 12.3.1B + fn 1 (98) | 621–624 | VERIFIED. 45°: 4.5 / 4.05 / 3.6. Nail at 45/30 keeps R_d = 2.2 and F_e unchanged (fixture 1354). |
| 2a | End distance at 0 < θ < 90 interpolated by θ/90 between the θ = 0 tension value (7D / 5D) and the ⊥ value (4D) | C12.5.1.2 (277): "End distances for angle to grain tension loadings may be linearly interpolated from those for perpendicular to grain and tension parallel to grain design values." | `endDistance` 256–260 | VERIFIED for tension. Commentary text supports exactly this. |
| 2b | Same interpolation for compression (4D → 4D) | Table 12.5.1A (104): compression 4D, ⊥ 4D | 256–260 | VERIFIED (trivial, both ends 4D; no interpolation is needed or claimed). Defensible. |
| 2c | Same interpolation for the C_Δ = 0.5 half values | C12.5.1.2 (277): "End distances less than 50 percent of those required for C_Δ = 1.0 are not allowed." | 256–260 | VERIFIED. Linear interpolation of the half values equals 0.5 × the interpolated full value (hand: 1.375 both ways), so the half is exactly the 50 % rule applied to the interpolated full. Defensible. |
| 2d | Spacing in a row 4D full / 3D min at any θ | Table 12.5.1B (104): ∥ 3D / 4D; ⊥ 3D / "required spacing for attached members"; C12.5.1.2 (278) 4D adequate for a wood attached member, steel spacing if steel | 605–607 | VERIFIED. 4D is conservative for a steel attached member (v1 behavior). |
| 2e | Edge at 0 < θ ≤ 90 = ⊥ rule (loaded 4D, unloaded 1.5D) | Table 12.5.1C (105); C12.5.1.3 (278): "NDS 12.5.1 does not provide specific guidance on edge distance requirements for loads applied at angles other than 0° and 90°" | 591–593 | VERIFIED as the spec's envelope, with the l/D > 6, g > 3D gap in D5. Loaded-edge input is active for θ > 0 (fixture 1363–1365). |
| 2f | Row spacing at 0 < θ < 90 = max(∥ 1.5D, ⊥ Table 12.5.1D by l/D) | Table 12.5.1D + fn 1 (105); C12.5.1.3 (278) | 587, 591 | VERIFIED. l/D = 3 → (5·1.5 + 10·0.5)/8 = 1.5625 governs (fixture 1367–1368). Conservative (the ⊥ value is always ≥ 2.5D > 1.5D). |
| 2g | Mandatory text at angled loading not modelled? | §12.5.1.2(b) shear area (103–104); C12.5.1.2 (277): "Requirements in NDS 12.5.1(b) are for members loaded at an angle to the fastener axis" (Fig. 12E, angled member) | n/a | VERIFIED N/A. (b) covers a member cut at an angle to the fastener axis, not a face-perpendicular fastener with load at θ to grain; not ignored. §12.6.2 (106) is printed (672). Fig. 12G/12H are the geometry definitions the tables implement; 12H is the 5 in outer-row limit = spread. Appendix J is non-mandatory; J.3/J.4 (bearing surface ⊥ to the lateral load, θ = load-to-grain) match the engine's use. Envelope is conservative except D5. |
| 3 | Spread ⊥ to grain at θ: (n−1)·s·sinθ + (rows−1)·g·cosθ | §12.5.1.3 (104), Fig. 12H | 597 | VERIFIED without stagger: the projection of an (n−1)s × (rows−1)g rectangle rotated θ onto the ⊥-to-grain axis is exactly this; reduces to (rows−1)g at 0 and (n−1)s at 90. Hand 3.889087 at n 3, s 2, rows 2, g 1.5. With stagger the along-row extent is longer: D2. |
| 4 | C_g at 0 < θ < 90 = min(gross-area, ⊥-equivalent-area) | §11.3.6.3 (82): gross areas; ⊥-loaded member → t × overall group width, one row → minimum ∥ spacing. C11.3.6 (265–266) gives the derivation only; no angle guidance anywhere in §11.3.6 / C11.3.6. | 636–657 | VERIFIED, defensible. Both interpretations are computed on the same n_eff / s_eff and the smaller taken, so the result is ≤ either NDS-literal reading. The only alternative the Commentary offers (C12.3.4, 275: Z_θ from Z∥ and Z⊥ by Eq. J-3) would be no more conservative. Hand: gross 0.997271, ⊥ 0.997286 → 0.997271 (matches fixture 1378–1380). Members at exactly 0 / 90 keep their own rule. |
| 5a | Merge criterion direction: g < (1/4)·(closest longitudinal offset) | §11.3.6.2 (82): "the distance between adjacent rows is less than 1/4 the distance between the closest fasteners in adjacent rows measured parallel to the rows" | 647 `merged = g < offset/4` | VERIFIED direction (row gap compared with a quarter of the longitudinal offset). Offset must be the closest-fastener distance: D1. |
| 5b | s_eff = offset, n_eff = 2n | §11.3.6.2, Fig. 11B (83): "Consider as 2 rows of 8 fasteners" for two staggered rows of 4 | 647 | n_eff = 2n VERIFIED. s_eff = offset is exact for symmetric stagger (offset = s/2, the page default, line 477) and is the least conservative reading otherwise: D3. |
| 5c | Even rows → each pair merges; rows_eff = rows/2 | §11.3.6.2 (82) | 647 `Math.ceil(rows/2)` | VERIFIED. |
| 5d | Odd rows → "most conservative interpretation" | §11.3.6.2 (82); Fig. 11B (83): 3 rows of 4 → "1 row of 8 fasteners and 1 row of 4 fasteners" | 647 (merged n_eff 2n governs the whole group) | VERIFIED as implemented, with the caveat in D3: applying the merged-row C_g to all fasteners is conservative only while C_g(2n, s_eff) ≤ C_g(n, s), which holds throughout the reachable range but is not enforced. |
| 5e | Physical s / g still drive Tables 12.5.1B/D, edge, end, spread | §12.5.1.2(c), 12.5.1.3 (104) | 586–597 use `s`, `g`, `n`, `rows` (not the _eff values) | VERIFIED (fixture 1398), except the spread's along-row extent: D2. |
| 5f | ⊥ equivalent width uses physical (rows−1)·g | §11.3.6.3 (82) "overall width of the fastener group" | 637 | VERIFIED. Stagger does not change the across-row extent (fixture 1412–1413). |
| 5g | §12.6.1 note when stagger is on and a member is loaded off-axis | §12.6.1 (106): stagger symmetrically in members loaded ⊥ to grain; C12.6.1 → C12.5.1.3 (278) | 666 (θ > 0) | VERIFIED (engine prints it for any θ > 0, a superset of the spec's ⊥ case). |
| 5h | Stagger inactive for D < 1/4, rows = 1, or stagger false; offset ≥ s or ≤ 0 invalid; blank incomplete | spec §12.2 | 489–494 | VERIFIED (fixtures 1405–1415). |
| 6 | Suites | — | — | `npm run test:wc` 333 pass / 0 fail; `node tools/_wc-ui-smoke.mjs` ALL PASS (79). |

## Hand checks (independent script, no engine imports: `scratchpad/wc11-hand.mjs`)

**A. θ = 45 both members, 1/2 in bolt, t_m = t_s = 1.5, DFL G 0.50, F_yb 45,000.**
F_e∥ = 11200·0.5 = 5600; F_e⊥ = 6100·0.5^1.45/√0.5 → 3150 (table). Hankinson: 5600·3150/(5600·0.5 + 3150·0.5) = 17,640,000/4375 = 4032.00 → 4050 rounded.
K_θ = 1.125; R_d = 4.5 / 4.05 / 3.6. R_e = 1, R_t = 1, k1 = 0.41421, k3 = 1.54345.
Modes: I_m = I_s = 0.5·1.5·4050/4.5 = 675.0; II = 0.41421·0.5·1.5·4050/4.05 = **310.660**; III_m = III_s = 434.095; IV = 541.266.
**Z = 310.66, mode II** — matches fixture 1349 (310.6602, II). Main 45 / side 0: R_e = 4050/5600 = 0.72321, II = **368.682** — matches fixture 1352.

**B. End distance at 45°, 1/2 in bolt, softwood tension.** full: 3.5 + (2.0 − 3.5)·0.5 = **2.75**; half: 1.75 + (1.0 − 1.75)·0.5 = **1.375** = 0.5 × 2.75.
Hardwood tension 45: 2.25; compression 45: 2.0. Matches fixtures 1357–1361 and geomDefaults 1417.

**C. Merged stagger C_g, 1/2 in bolt, wood/wood, A_m 19.25, A_s 8.25, E 1.6e6, γ = 180,000·0.5^1.5 = 63,639.6.**
n_eff 4, s_eff 3.2: R_EA = 0.428571; u = 1 + 63,639.6·1.6·(1/3.08e7 + 1/1.32e7) = 1.011020; m = 0.862154; **C_g = 0.964868** — matches fixture 1397.
Separate n 2, s 4: u = 1.013775, m = 0.847223, C_g = 0.994594 — matches fixture 1400.
For information (D1/D3): same layout with the closest-fastener offset 0.8 as s_eff → 0.990787; with s_eff = s/2 = 2 → 0.977518.

**D. Others.** C_g at 45 gross 0.997271 / ⊥ 0.997286 (fixtures 1378–1380). Spread at 45, n 3, s 2, rows 2, g 1.5 → 2.828427 + 1.060660 = 3.889087 (fixture 1373).

## Page checks (Playwright, `scratchpad/wc11-page.mjs`, page served from `public/` on disk)

Seeded bolt row driven to θ_main = 45, n 3, rows 2, s 4, g 0.75, stagger on, offset 3.2, details opened:

| Check | Result |
|-------|--------|
| Interpolation note "main geometry at θ = 45° by interpolation (end) and the governing of the ∥/⊥ rules (edge, rows) — Commentary C12.5.1.2" in the details block | present |
| Both C_g interpretations printed (`interpretations.gross.Cg = 0.9524`, `interpretations.perp.Cg = 0.588`) and the "C_g at an angle: lesser of the ∥ and ⊥ area interpretations (§11.3.6.3)" note | present; factor chip reads "∥ areas Cg 0.952 / ⊥ areas 0.588 → perp" |
| Merge detail (`stagger.merged = true`, `n_eff = 6`, `s_eff = 3.2`, `rows_eff = 1`, staggerCite "g = 0.750 < offset/4 = 0.800 → adjacent rows act as one row") and the "rows merged" chip | present |
| §12.6.2 note and §12.6.1 note | both present |
| Print media: every `.wc-det` visible (3 of 3; the 2 with the `hidden` attribute are forced to `display: table-row` by the print rule at line 149) | pass |
| Page errors | none |
| Row status | `fail` (geom_row: g 0.75 < ⊥ row minimum 1.5625 at l/D 3) — expected for the probe layout, not a page defect |
| Help text "offsets are not modelled" still on the page | present → D4 |

## Method notes
- NDS text read from the page-marked dump `scratchpad/nds.txt`; pages cited are PDF pages. Key passages: §11.3.6.2/.3 (82), Fig. 11B (83), Table 12.3.1B and §12.3.4 (98), Table 12.3.3 fn 2 (100), §12.5.1.2–.3 and Tables 12.5.1A/B (103–104), Tables 12.5.1C and 12.5.1D (105), §12.6 (106), Appendix J (190), C11.3.6 (265–266), C12.3.4 (275), C12.5.1.2–.3 (277–278), C12.6 (280).
- No repo file was modified other than this report. Probe scripts live in the session scratchpad.

## Re-verification (2026-09-20, after the D1–D6 fixes)

**Verdict: SHIP.** Suites: `npm run test:wc` 338 pass / 0 fail; `node tools/_wc-ui-smoke.mjs` 82 PASS, ALL PASS.

| # | Fix applied | Code (line) | Re-check | Result |
|---|-------------|-------------|----------|--------|
| D1 | `offClosest = min(offset, s − offset)` drives the merge test and is recorded in `detail.stagger.offClosest`; merged fixture rebuilt on s 8 / offset 4 / g 0.75 | 496–497, 655, 676–679 | g 0.75 < 4/4 = 1.0 → merged; §11.3.6.2 (PDF 82) "closest fasteners" now honored for any typed offset | VERIFIED |
| D2 | along-row extent `(n−1)·s + offClosest` in the spread | 603–604 | hand: θ = 90, n 3, s 2.25, offset 1.125 → 4.5 + 1.125 = 5.625 in > 5 → `spread5` (fixture) | VERIFIED |
| D3 | merged row at `s_eff = s/2`; `C_g = min(merged, separate)` with `Cg_merged`, `Cg_separate`, `governingLayout` recorded | 655, 664–671, 676–677 | hand below; separate n 2, s 8 = 0.989389 > merged, so min = merged | VERIFIED — odd-row "most conservative interpretation" (Fig. 11B) now enforced by construction |
| D4 | help bullet rewritten (stagger per §11.3.6.2, 3D single-row width, angle rules) | page 299 | probe `helpStale = false` | VERIFIED (residual R1 below) |
| D5 | unloaded edge at 0 < θ < 90 = max(1.5D, g/2 when l/D > 6 and rows ≥ 2); θ = 90 stays the pure ⊥ rule | 594–596 | matches Table 12.5.1C ∥ rule (PDF 105) enveloped with the ⊥ loaded-edge 4D | VERIFIED |
| D6 | no rounding after Hankinson; F_e∥ / F_e⊥ inputs remain the 50-psi table values | 164–169 | hand below | VERIFIED — literal Eq. 12.3-11 (PDF 98) |
| — | §12.6.2 note now counts as an unresolved engineer check | 686 | note + `R.unresolved += 1` | VERIFIED |

**Hand checks (independent, `scratchpad/wc11-rehand.mjs`).**
- Merged C_g, 1/2 in bolt wood/wood, A_m 19.25, A_s 8.25, E 1.6e6, γ 63,639.6, n_eff 4, s_eff 4: R_EA 0.428571, u = 1 + 63,639.6·2·(1/3.08e7 + 1/1.32e7) = **1.013775**, m = **0.847223**, **C_g = 0.956757** — matches the coordinator's 0.956757. Separate n 2, s 8: 0.989389.
- θ = 45 both members, unrounded F_eθ = 17,640,000/4375 = **4032.00**: I_m = 672.0, II = 0.41421·0.5·1.5·4032/4.05 = **309.279**, III_s = 432.772, IV = 540.062 → **Z = 309.28, mode II** — matches. Hankinson 30° DFL 3/4: 5600·2600/(1400 + 1950) = **4346.269** — matches the 4346.27 fixture.
- D2 spread: **5.625 in** — matches.

**Page probe (`scratchpad/wc11-page.mjs`, bolt row θ 45, n 3, rows 2, s 8, g 0.75, stagger on, offset 4).** Details block prints the interpolation note, both C_g interpretations (gross 0.9416 / ⊥ 0.5478 → perp), the revised stagger cite "closest-fastener offset 4.000 in; g = 0.750 < offset/4 = 1.000 → … n_eff = 2n = 6, s_eff = s/2 = 4.000, rows_eff = 1; C_g = min(merged 0.548, separate 0.754)", the §12.6.2 and §12.6.1 notes; print media shows all three `.wc-det`; no page errors. Row status `fail` is the expected geom_row for that probe layout (g 0.75 < ⊥ row minimum 1.5625).

**Residual (LOW, documentation only).**
- R1 — page 299 help bullet still describes the spread as "(n − 1)·s·sinθ + (rows − 1)·g·cosθ"; after D2 the along-row term is (n − 1)·s + the closest stagger offset. One-phrase edit; no engine effect.
