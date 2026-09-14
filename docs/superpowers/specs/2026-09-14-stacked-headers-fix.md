# Spec — Stacked Headers & Studs calculator: NDS 2018 / ASCE 7-16 fix (Phase 2, track A)

Repo: `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs` (Next.js static site; calculators are standalone HTML under `public/Calcs/`). Target: `public/Calcs/stacked_headers_studs_calculator.html` (slug `stacked-headers`). Findings being fixed: `docs/stacked-wood-qaqc-2026-09.md` §1 (H-1 … H-19), appendices `docs/stacked-wood-qaqc-2026-09/A-headers-code-audit.md` and `E-headers-recompute.md`. Registry entry already flipped to `status: "wip"`, `spec: "NDS 2018"`.

**Files you own:** `public/Calcs/engines/stacked-headers.js` (new), `public/Calcs/stacked_headers_studs_calculator.html`, `tools/test-stacked-headers.mjs` (new), and the foundation-export reader block in `public/Calcs/headers_gradebeam_pier_calculator.html` (~lines 617–648 only). Do not edit any other file. Do not commit (the controller commits). `package.json` already has `"test:hdr": "node tools/test-stacked-headers.mjs"`.

## 1. Architecture

- **Pure engine** in `public/Calcs/engines/stacked-headers.js`, no DOM, loaded by the page with `<script src="/Calcs/engines/stacked-headers.js"></script>` **before** the page's inline script, and loaded by Node tests with `vm.runInNewContext` (or `new Function`) from the same file so page and tests run identical code. Expose one global `window.HDR` (in Node: the sandbox object) with:
  - `HDR.compute(state) → result` — full stack computation, pure, deterministic.
  - `HDR.validate(state) → [{path, message}]` — blocking errors; `compute` throws `HDR.ValidationError` carrying that list if any.
  - `HDR.runFixtures() → {pass, total, lines[]}` — runs the pinned fixtures (below).
  - `HDR.checkHeader`, `HDR.checkJambPack`, `HDR.checkKing`, `HDR.checkStud`, `HDR.calcCL`, `HDR.calcCP`, `HDR.combinations` — exported for tests.
  - `HDR.ENGINE = {name:"stacked-headers", version:2, codes:["NDS 2018","NDS 2018 Supplement","ASCE 7-16","IBC 2021"]}`.
- The HTML keeps its UI but becomes a thin adapter: it builds `state` from the inputs, calls `HDR.compute`, and renders. Keep the existing look, table layout, resizable columns, print CSS, `#areBar` toolbar, AREv2 adapter registration, and the Export-to-Foundation button. `?selftest=1` in the URL runs `HDR.runFixtures()` and shows pass/total in a banner.
- Keep the existing state model (`floors[].headers[]`, `floors[].studs[]`, `LV` psf inputs, species, per-row sizes) but add the fields listed in §6.

## 2. Reference design values (NDS 2018 Supplement)

Replace `NDS_REF` with (psi; No.2 grade; dry service):

| Species | F_b by size | F_v | F_c⊥ | F_c by size | E | E_min | C_F applies |
|---|---|---|---|---|---|---|---|
| DFL (Table 4A) | 900 all sizes | 180 | 625 | 1350 all sizes | 1,600,000 | 580,000 | yes |
| SPF (Table 4A) | 875 all sizes | 135 | 425 | 1150 all sizes | 1,400,000 | 510,000 | yes |
| SYP (Table 4B, by size class) | 2x4 1100 · 2x6 1000 · 2x8 925 · 2x10 800 · 2x12 750 | 175 | 565 | 2x4 1450 · 2x6 1400 · 2x8 1350 · 2x10 1300 · 2x12 1250 | 1,400,000 | 510,000 | no |

`CF_Fb = {2x4:1.5, 2x6:1.3, 2x8:1.2, 2x10:1.1, 2x12:1.0}`, `CF_Fc = {1.15, 1.1, 1.05, 1.0, 1.0}` (unchanged, correct). `LBR` section table unchanged (correct). Add plate species selector (default = wall species) for plate F_c⊥. C_M = C_t = C_i = 1.0 (dry service, normal temperature, non-incised) — state in the notes. C_D does not apply to E, E_min or F_c⊥ (Table 2.3.2 fn. 1).

## 3. Load combinations (ASCE 7-16 §2.4.1) and C_D (NDS Table 2.3.2)

Every load component is carried separately down the stack: D, L (floor), L_r (roof live), S (snow), W (wind). Roof L_r and S are **alternatives**, never summed. Rain is not an input (say so). Combination table, evaluated for every member; report the governing one by D/C:

| # | Combination | C_D |
|---|---|---|
| 1 | D | 0.9 |
| 2 | D + L | 1.0 |
| 3a | D + L_r | 1.25 |
| 3b | D + S | 1.15 |
| 4a | D + 0.75L + 0.75L_r | 1.25 |
| 4b | D + 0.75L + 0.75S | 1.15 |
| 5 | D + 0.6W | 1.6 |
| 6a | D + 0.75L + 0.75(0.6W) + 0.75L_r | 1.6 |
| 6b | D + 0.75L + 0.75(0.6W) + 0.75S | 1.6 |
| 7 | 0.6D + 0.6W | 1.6 |

Headers and jambs have no wind term → combos 1–4 only (5–7 reported "n/a"). Kings and wall studs: all. Wind inputs are **strength-level** psf (label them "W, strength level (ASCE 7-16 §30.3)"); the engine applies 0.6. The C&C wind calculator already sends strength-level; leave its `sendToHeaders` alone.

## 4. Member checks

**Header (multi-ply, simple span, uniform load).** `n_plies` from the **row's** wall size (`rowWallSz`: 2x4→2, 2x6→3, 2x8→4), not the page-level select. b_eff = n·1.5, A = n·A_1, S = n·S_1, I = n·I_1. For each combination: w, M = wL²/8, V = wL/2; f_b = M/S, f_v = 1.5V/A. C_L per §3.3.3: l_u = span; l_e = 2.06 l_u if l_u/d < 7 else 1.63 l_u + 3d (Table 3.3.3 single span uniform load — only these two branches); R_B = √(l_e d/b²) **unclamped**; if R_B > 50 → applicability error "NDS §3.3.3.7"; F_bE = 1.20 E_min/R_B²; F*_b = F_b·C_D·C_F; Eq. 3.3-6. Per-row checkbox "Compression edge continuously braced (§3.3.3.3)" → C_L = 1.0. No C_r on headers. F'_b = F_b·C_D·C_F·C_L; F'_v = F_v·C_D. Bearing at header ends: l_b = n_jambs·1.5 (from the jamb result of the same row), A_bear = l_b·b_eff, C_b = 1.0 (§3.10.4, member end), F'_c⊥ = F_c⊥ (no C_D), demand R = max over combos of the **unfactored-by-C_D** reaction (bearing has no C_D, so the largest combination load governs). Deflection (IBC 2021 Table 1604.3): Δ = 5wL⁴/(384 E I); rows Δ(L or L_r or S, the largest) ≤ L/360 and Δ(D + L or D + L_r or D + S, largest) ≤ L/240; a page-level "dry at installation" checkbox (default on) substitutes 0.5D in the total-load row per footnote d. Shear taken at the reaction (conservative; note it).

**Jamb pack (n × 2x, axial).** P per combination = accumulated header reactions above + this header's reaction (D, L, L_r, S separately). Unbraced lengths: **strong axis l_e1 = top-of-opening height** (trimmer length, Nick's decision), **weak axis l_e2 = weak-axis bracing spacing input (default 48 in)**. Compute C_P for both axes (§3.7.1, c = 0.8, F_cE = 0.822 E_min/(l_e/d)²), retain both; governing C_P = smaller; any l_e/d > 50 → applicability error "NDS §3.7.1.4" (no clamp). F'_c = F_c·C_D·C_F·C_P. f_c = P/(n·A_1). Auto-find n = 1…8 re-runs the envelope. C_r = 1.0. Second bearing interface: jamb pack end grain on the bottom plate, A = n·A_1, plate F_c⊥ from plate species, C_b = 1.0. Concentric loading stated as an assumption.

**King stud.** Axial P = accumulated wall gravity plf (D, L, L_r, S separately, from the stud row that owns this wall) × (stud spacing / 2) — kings take half a stud spacing of gravity **only**; jambs carry the header reaction (Nick's decision). Wind: uniform w = 0.6·p·(opening/2 + spacing/2) over the full story height, simply supported; M = w h²/8. Bending about the **strong** axis: S_x = b d²/6, F_cE1 = 0.822 E_min/(h/d)²; C_L = 1.0 (sheathed compression edge); C_r = 1.0 (kings never meet §4.3.9); weak-axis C_P with l_e2 = bracing spacing input; governing C_P = smaller of the two axes. Eq. 3.9-3: (f_c/F'_c)² + f_b/(F'_b(1 − f_c/F_cE1)) ≤ 1.0; if f_c ≥ F_cE1 → applicability error, never zero the term. Top-of-opening > story height → validation error (no 0.9L rewrite). Remove the manual "King Axial" cell (or keep as an "additional axial" override, default 0, clearly labelled).

**Wall stud.** Same as king with trib = spacing; C_r = 1.15 when spacing ≤ 24 in (predicate printed in the detail: "3+ members, ≤ 24 in o.c., load-distributing sheathing"); pass limit **1.0**; add f_v = 1.5V/A vs F'_v row; add wind deflection Δ = 5 w_s h⁴/(384 E I) with w_s at 0.42·p (IBC Table 1604.3 fn. f) ≤ H/240 (brittle finish) or H/120 (flexible), finish type page-level selector default brittle.

**Slenderness row** for every compression member prints the **true** l_e/d per axis and fails above 50.

## 5. Accumulation and stacking

- Header stacks and stud rows correlate across floors by a stable `id` (generate `uid()` on creation; migrate existing labels to ids on load), not by label text. A stack that skips a floor is a validation error unless the row is marked `transfer:true`.
- Deleting a header on a floor removes only that row; the engine then reports the continuity error for floors below rather than silently dropping load.
- Each header row accumulates the jamb reactions (D, L, L_r, S) of the header directly above with the same stack id; each stud row accumulates the stud-row loads above with the same id.
- Any change to species, wall width, story height, wind, or LV inputs clears rendered result panels (or re-renders) so stale PASS panels never remain.

## 6. State, persistence, export

- AREv2 adapter → `version: 2`. New fields: per header `{id, stack_id, braced_edge:false, jambSz, jambCount, kingSz, kingCount, topOfOpening, kingAxialExtra:0}`; per stud row `{id, spacing, size, finish}`; page-level `{weakBraceIn:48, dryInstall:true, plateSpecies, finishType:"brittle"}`; wind inputs `{windOpenW, windStudW}` (strength level). Loading a v1 record: map labels → ids, default the new fields, and show a banner "Loaded from engine v1 inputs; results recomputed with engine v2 (NDS 2018 / ASCE 7-16)". Check how `are-utils-v2.js` (`registerAdapter`, ~line 686, and the version check ~line 1501) treats a version mismatch and implement the migration inside the adapter's `setModel` so old files still open.
- Every result carries a snapshot object `{engine:{name,version,build}, codes[], inputs_hash (SHA-256 of the normalized state, use `crypto.subtle` when available else a simple FNV-1a hex), assumptions{weakBraceIn, dryInstall, plateSpecies, finishType, species}, checks[]{id, member, combination, demand, capacity, dc, status, errors[]}, governing{}, timestamp}` — render it into a collapsed "Calculation record" block that prints.
- Foundation export (`localStorage['areCalcs_foundationExport']`) → `{version:2, source, floorName, exported, units:"plf / lb", studs:[{id,label,D,L,Lr,S, governing}], jambs:[{id,label,D,L,Lr,S}]}`. Update the reader in `headers_gradebeam_pier_calculator.html` to accept v1 (`dlPlf/llPlf/slPlf`, merged as before) **and** v2 (keep L and S separate if its zone model can; if it cannot, pass `L` and `S` through as before but do not drop `Lr`; document what you did).

## 7. Page text

- Tags: "NDS 2018 · ASCE 7-16 · IBC 2021 · ASD". Remove every "ASCE 7-22".
- Engineering Notes rewritten to state: combination envelope with per-combination C_D; strength-level wind with 0.6 applied; weak-axis bracing at 48 in default (blocking or sheathing; construction note on the drawings); strong-axis lengths (header span, trimmer height, story height); no C_r on headers or kings, 1.15 on wall studs at ≤ 24 in; C_L unbraced unless the braced box is checked; equal ply load sharing with no ply-fastening design; header self-weight must be typed into DL add; no live-load reduction; C_M = C_t = C_i = 1.0; deflection limits used; rain not included; No.2 grade, 2x sizes only; concrete/foundation out of scope.

## 8. Tests (write these first — TDD)

- Fixtures: `docs/stacked-wood-qaqc-2026-09/E-fixtures.json` (22 cases with provenance, including `HDR-RB-OVER-50-NOT-APPLICABLE`, `STUD-LE-OVER-D-OVER-50-NOT-APPLICABLE`, `HDR-DEFLECTION-GOVERNS`, the AWC and VF published cases). Embed them (or load them) in `HDR.runFixtures()`. **Do not edit expected values.** Where a fixture's inputs assume the old king model or `weak_axis:"sheathed"` (l_e2 = 0), map to the engine input that reproduces that condition (e.g. weakBraceIn = 0 → weak axis fully braced) and say so in the fixture line. Engine arithmetic tolerance 1e-4 relative on intermediates, 1e-3 on D/C; published values ≤ 1 %. Add fixtures for: combination governing switch (D-only member at C_D 0.9), king axial = plf × s/2, jamb l_e1 = top of opening vs story height, continuity error, ply count from row size, v1 → v2 migration, export v2 payload.
- `tools/test-stacked-headers.mjs` (Playwright, copy the harness pattern in `tools/test-seated-connection.mjs`): loads the page via `page.route`, asserts `HDR.runFixtures()` pass === total, asserts page errors = 0, exercises the UI (add header, Check, read D/C cells), round-trips the AREv2 state, loads a hand-written v1 record and checks the banner + migrated ids, reads `areCalcs_foundationExport` and asserts version 2 fields, and screenshots desktop + print media to `tools/_out/` (create dir; `_out` is scratch).
- `npm run test:hdr` must pass. Also run `npm run qa:roundtrip` if it exists and report.

## 9. Report format

Status (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT); what you built; test output (paste the fixture summary line and the Playwright summary); files changed; self-review; concerns. Quote the engine's shipped-default result for the roof header, jamb pack, king and stud rows so the reviewer can compare with appendix E Case 1.
