# Spec — Stacked Shearwall calculator: SDPWS 2021 / ASCE 7-16 fix (Phase 2, track B)

Repo: `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs`. Target: `public/Calcs/stacked_shearwall_calculator.html` (slug `stacked-shearwall`). Findings being fixed: `docs/stacked-wood-qaqc-2026-09.md` §2–3 (S-1 … S-21, hardware table), appendices `docs/stacked-wood-qaqc-2026-09/B-shearwall-code-audit.md` (citation map at the end), `C-hardware-verification.md`, `D-shearwall-recompute.md`. Registry already `status: "wip"`.

**Files you own:** `public/Calcs/engines/stacked-shearwall.js` (new), `public/Calcs/stacked_shearwall_calculator.html`, `tools/test-stacked-shearwall.mjs` (new). Do not edit any other file. Do not commit. `package.json` already has `"test:sw": "node tools/test-stacked-shearwall.mjs"`.

Code text to verify against (extract with Python `pypdf`, `PYTHONIOENCODING=utf-8`): SDPWS 2021 `C:\Users\nickh\OneDrive - Rohr Engineering\Technical Resources - Documents\Wood\Wood Codes and Technical Guides\Wood Codes\Special Design Provisions for Wind and Seismic.pdf` (§4.1.4 p. 21; §4.3.2.3 p. 35; §4.3.3.4 p. 36; §4.3.5 p. 37+; Table 4.3A/4.3C follow; §4.3.6.4 p. 41). Tables 4.3A/4.3C are raster images in the PDF; the nominal values below were read by the auditors and match the code's existing wind values × 2.

## 1. Architecture

- **Pure engine** `public/Calcs/engines/stacked-shearwall.js`, no DOM, loaded by the page with `<script src>` before the inline script and by Node with `vm`. Global `window.SW`: `SW.compute(state)`, `SW.validate(state)`, `SW.runFixtures()`, `SW.calcCo`, `SW.sumBi`, `SW.storyForces`, `SW.chordForce`, `SW.sheathingCapacity`, `SW.HOLDOWNS`, `SW.STRAPS`, `SW.SHEATHING`, `SW.SILL_CONN`, `SW.ENGINE = {name:"stacked-shearwall", version:2, codes:["SDPWS 2021","NDS 2018","ASCE 7-16"]}`.
- HTML becomes a thin adapter: builds `state`, calls `SW.compute`, renders. Keep look, print CSS, `#areBar`, AREv2 adapter, JSON export/import, gravity-wall DL link. `?selftest=1` runs fixtures.

## 2. State model (v2)

```
{ version:2, sfrs:"A.15"|"A.17"|"B.22"|"B.24", sdc:"A".."F", species:"DFL"|"SP"|"SPF" (framing, G 0.50/0.55/0.42),
  floors: [ top → bottom, each { id, name, h_ft, P_wind_lb, P_seis_lb,   // incremental STRENGTH-level level forces delivered at this level
            walls: [ { id (stable across floors), label, L_ft, h_ft (=floor h), segments_ft:[b1,b2,…], openings:[{w_ft, hc_ft}],
                       sheathing:{ face1:{type:"wsp"|"gyp", thickness, nail, spacing}, face2:null|{…}, blocked:true, insideFaceHoldown:true },
                       endPost:{ n:2, size:"2x6" }, holdown:"hdue"|"strap", sill:{ conn:id, spacing_in }, sillSpecies:"DFL"|"SP"|"SPF",
                       dead:{ w_plf, P_end_lb, source:"manual"|wallId } } ] } ] }
```
Legacy `version:1` files: **refuse** with a message "This record was saved by engine v1 and cannot be reused; re-enter the wall" (Nick confirmed no legacy records exist). Both the JSON import and the AREv2 adapter (`version: 2`) check the version.

## 3. Engine rules

**Loads (ASCE 7-16 §2.4.1 / §2.4.5).** Inputs are incremental strength-level level forces P_j (W and E separately). Two cases run in full: wind (V from 0.6·ΣP_wind) and seismic (V from 0.7·ΣP_seis). Story shear V_k = Σ_{j≥k} P_j; overturning moment about the base of story k, M_k = Σ_{j≥k} P_j·z_{j,k} where z is the height from the base of story k to the top of story j (the level where P_j is delivered). Dead-load resisting moment uses 0.6D. Unit shear pipeline has no dead load. Report the controlling case per check and per wall.

**Sheathing (§4.1.4, §4.3.5, Tables 4.3A / 4.3C).** Store **nominal** v_n per option. ASD wind = v_n/2.0; ASD seismic = v_n/2.8. WSP options (Sheathing grade, blocked): 7/16 in 8d @ 6/4/3 → 670/980/1260; 15/32 in 10d @ 6/4/3 → 870/1290/1680 plf. Gypsum (Table 4.3C, 5/8 in, 6d cooler, blocked, 16 in): @ 7 in 290, @ 4 in 350 (offered **only as face2** of a WSP wall — Nick's decision to keep gypsum). Species factor (Table 4.3A fn. 3, WSP only): × min(1, 1 − (0.5 − G)) → SPF 0.92. Footnote 10: if 10d common **and** `insideFaceHoldown` → × 0.92, and the detail prints which condition fired. Two faces (§4.3.5.4): same system both faces → 2×; WSP + gypsum → per §4.3.5.4.2: **wind** = sum of the two faces; **seismic** = greater of (2 × the smaller) or (the larger). Gypsum aspect limit 2:1, or 3.5:1 for wind only (Table 4.3.3 note 2). Perforated-method caps (§4.3.2.3): combined nominal ≤ 2,435 plf (reject), h ≤ 20 ft (reject), segment at each end (assumption stated). Prerequisite text printed when 10d @ 3 in, any 2 in spacing, two-sided < 6 in, or nominal > 980 plf in SDC D–F: "3x nominal framing at adjoining panel edges, staggered nailing (§4.3.7.1(5))". SFRS/SDC gate: A.15/B.22 (WSP) permitted all SDC; A.17/B.24 (other materials) 35 ft in SDC D, NP in E/F — since the wall's SFRS is WSP the gypsum face is a second-face contribution only; block gypsum as a contributing face when SDC is E or F (state the reason).

**Σb_i and C_o (§4.3.3.4, §4.3.5.6).** For each segment b: h/b > 3.5 → excluded; 2 < h/b ≤ 3.5 → b·(2b/h); else b. Σb_i = Σ of those. A_fhs = h·Σ(unreduced widths). A_o = Σ w·max(hc, h/3) over openings. C_o = min(1, [r/(3 − 2r)]·(L/Σb_i_unreduced)) with r = 1/(1 + A_o/A_fhs). Validate: Σ segments + Σ opening widths ≤ L (allow non-sheathed areas: their area counts in A_o per §4.3.2.3(9) exception — add an optional `unsheathed_ft2` field), L > 0, Σb_i > 0, hc ≤ h.

**Demands.** v_max,k = V_k/(C_o,k·Σb_i,k) (Eq. 4.3-9). Sheathing D/C = v_max/(ASD capacity). Uplift anchorage t_k = v_max,k (plf, §4.3.6.4.2.1) as its own row versus the bottom-plate uplift connector capacity (new input, default "not specified" → row shows demand and "connector required"). Sill shear D/C = v_max/(V_conn/(s/12)). Collector note: v_max carried to the level below (Nick: always).

**Chord force (§4.3.6.1.3, Eq. 4.3-8 form).** T_k = max(0, (M_k − 0.6·M_R,k)/(C_o,k·Σb_i,k)) where M_R,k = Σ_{j≤k} w_dead,j·L²/2 + Σ P_end,j·L (point dead load at the far chord contributes P·L about the tension end; at the near chord 0). Evaluate both directions and both ends (swap which end the point loads act on); report T per end per direction, governing T, and compression C = T + accumulated gravity on the end post. Negative raw T prints "uplift not required by calculation (T_raw = …)".

**End post (NDS §3.7.1).** From `endPost {n, size}` and species: A = n·A_1, F_c (Table 4A/4B No.2: DFL 1350, SP by size 1450/1400/1350/1300/1250, SPF 1150), C_D 1.6, C_F, C_P with strong-axis l_e = story height and weak axis braced (l_e2 = 48 in); f_c = C/A; D/C row.

**Hardware (DF/SP "160" values, already include C_D 1.6, no further increase).**
- HDUE (ESR-2330 Table 2B): HDUE3-SDS3 3,790 (7 SDS ¼×3, 3½ in post, ⅝ in rod); HDUE5-SDS3 5,375 (10, 3½, ⅝); HDUE7-SDS3 7,015 (13, 3½, ⅝ **high-strength**); HDUE9-SDS3.5 9,390 requires member thickness ≥ 4.5 in else **8,425** at 3.5 in (16 SDS, ⅞ rod); HDUE13-SDS3.5 12,950 at 7.25 in thickness, 11,900 at 5.5 in (23 SDS, 1 in rod, heavy hex nut); HDUE17-SDS4.5 17,685 (28 SDS, 6x6 min, 1 in **high-strength** rod). Gate each pick on the end-post thickness/width actually entered; print the rod diameter from the same array (delete the hard-coded HTML schedule and render it from `SW.HOLDOWNS`).
- CMST (ESR-2105 Table 4): CMSTC16 4,690 (50–16d sinker **total, 25 each side**); CMST14 6,475 (56–16d×2½ common total); CMST12 9,215 (74 total). Requires member SG ≥ 0.50 → refuse straps when species is SPF. Straps floor-to-floor only; base level is HDUE.
- Sill connectors, per connector at C_D 1.6: LTP4 715 lb (12–0.131×1½ nails, direction G, C-C-2026; × 0.72 over ⅜ in sheathing, × 0.64 over ½ in — add a sheathing-thickness selector for the LTP4 row; drop the old roof/floor split), 16d common 226 lb (NDS Table 12N 141 × 1.6; label "16d common"), SDS ¼×4½ 304 lb (mixed species) or 400 lb when sill species is DF/SP (Simpson sole-to-rim table), ½ in anchor bolt 1,040 lb and ⅝ in 1,488 lb (NDS Table 12E, 1.5 in DFL/SP sill, 6 in embedment, Z∥ 650/930 × 1.6; for SPF sill use Table 12E G = 0.42 column — read it from the NDS PDF, Chapter 12 — and state it). Anchor bolts and HDUE only at the base level; LTP4/nails/SDS only above it. Unknown ids are hard errors, never positional fallbacks. Plate-washer note (§4.3.6.4.3) printed when nominal > 400 plf. Concrete anchorage (ACI 318 Ch. 17) and anchor-rod steel stated out of scope.

**Structure.** Wall lines correlate across floors by `id`; a wall present below but missing above is fine; a wall missing on an intermediate floor is a validation error unless `transfer:true`. "+ Add Floor" inserts at the **top**; the base level is `floors[floors.length−1]` and is labelled "Base level (foundation)". Base level: HDUE and anchor bolts only.

## 4. Page text

Header tags "SDPWS 2021 · NDS 2018 · ASCE 7-16 · ASD". Replace every citation per the map in appendix B (perforated method §4.3.2.3; aspect ratio §4.3.3.4; C_o §4.3.5.6 Eq. 4.3-6; capacities §4.3.5.2 + §4.1.4; chord force §4.3.6.1.3 Eq. 4.3-8; unit shear §4.3.6.4.1.1 Eq. 4.3-9; uplift t §4.3.6.4.2.1; anchor bolts §4.3.6.4.3). Delete "Column A/B", "C_D = 1.6" labels, "verified vs Excel SW1", "r ≤ 5/6", "α ≥ 20 % recommended". Notes state: perforated-method assumptions (§4.3.2.3 items 2/5/6/7/9), what is not covered (drift, diaphragms, collectors beyond the wall line, concrete anchorage, anchor-rod steel), that inputs are strength-level and the engine applies 0.6W / 0.7E / 0.6D, hardware basis (ESR numbers, catalog edition, DF/SP 160), sheathing grade "Sheathing" not Structural I, blocked construction assumed.

## 5. Tests (write first — TDD)

- Fixtures: `docs/stacked-wood-qaqc-2026-09/D-shearwall-fixtures.json` (7 cases: default model, WoodWorks five-story, divergent C_o·Σb_i two-story, DL relief, negative T, both directions, aspect-ratio, C_o vs Table 4.3.5.6). **Do not edit expected values.** Note the fixture inputs are already-ASD forces P; the engine takes strength-level W or E, so drive the fixture through a "P is 0.6·W" mapping (W = P/0.6 in the wind case) and say so. Add fixtures for: wind vs seismic capacity (335 vs 239.3 plf on 7/16 8d@6), SPF species factor, footnote-10 0.92, WSP + gypsum wind sum and seismic rule, > 2,435 rejection, gypsum in SDC E rejected, HDUE9 at 3.5 in → 8,425, strap refused for SPF, LTP4 sheathing reduction, anchor bolt plf at 20 in (⅝ → 893 plf), v1 file refused, wall-line continuity error, Add Floor at top.
- `tools/test-stacked-shearwall.mjs` (Playwright, pattern of `tools/test-seated-connection.mjs`): fixtures pass === total, zero page errors, UI check on the default model, JSON export/import round trip (v2), v1 import refused with the message, AREv2 round trip, print screenshot to `tools/_out/`.
- `npm run test:sw` must pass.

## 6. Report format

Status; what you built; fixture summary line and Playwright summary; files changed; self-review; concerns; the engine's result for the default model (C_o, v_max, T, hold-down per floor, both cases) so the reviewer can compare with appendix D Case 1.
