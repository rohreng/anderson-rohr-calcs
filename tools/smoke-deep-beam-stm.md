# Smoke Checklist — Deep Beam Strut-and-Tie Calculator

Page: `/Calcs/deep_beam_stm_calculator.html` (registry slug `deep-beam-stm`, status `ready`; the standing gate is Nick's verification of the ACI clauses flagged in the engine header against his licensed copy).
Run this checklist before any deploy that touches the calculator page, the engine, or `are-draw.js`.
Per PLAN.md §6, every execution is logged in the table at the bottom (date / operator / result).

Prerequisite: `npm run test:stm` is green (716 comparisons, 0 failures, 15 documented skips expected).

## What the green fixture suite does NOT prove (FEATURES-v2 §R4.8)

A green `npm run test:stm` is evidence about the ENGINE'S ARITHMETIC ONLY. Read it with these
exclusions in front of you, because none of them is covered by any fixture:

1. **Print output.** No fixture and no browser step in this checklist below exercises the printed
   page beyond step 11's visual pass. Pagination, page breaks inside the check table, and whether
   the elevation and section both land legibly on paper are verified by eye or not at all.
2. **The exact ACI 318-19 code text.** The engine implements the *intended forms* of §9.9.1.1,
   Table 23.5.1, Table 25.4.3.2, §25.4.4.1, **§23.8.2**, **§9.7.3.8.4** and **§25.5.2** as stated
   in PLAN.md and FEATURES-v2. The fixtures verify that the engine computes those forms correctly;
   they cannot verify that the forms match the published wording. §23.8.2 needs particular care —
   in some printings the w_t,max limit appears as commentary R23.8.1 rather than in the section
   body, and the placement changes whether it is mandatory. **All seven must be checked against a
   licensed copy before the registry entry may claim `ready`.** The list is repeated in the engine
   header block.
3. **§23.8.2 has exactly one evidence fixture.** `authority_example.json` (FHWA-NHI-17-071 Ex. 1)
   is an AASHTO LRFD §5.8.2 example and is run with the §23.8.2 cap DISABLED, by documented design
   — AASHTO builds its CCT back face from 2×(distance to the tie centroid) with no F_nt/(f_ce·b_s)
   limit, so leaving the cap on would mix two codes inside one comparison. That fixture therefore
   provides **no** evidence for the effective-tie-width feature and must never be cited for it.
   `tie_width_band.json` is the sole evidence: uncapped (default), capped, cap propagation to h_a /
   node back-face stress / x_crit, the multi-layer band FAILURE, the multi-layer in-band PASS, the
   R4.3 lower-half rejections, and the Case C top-tie touchpoints. `case_d_continuous.json`
   run `R4_5_capped_tie_case_d` adds the Case D interaction.
4. **Case D statics residuals are not all checks.** ΣV, ΣM about the left pier and the interior-node
   ΣV/ΣH close BY CONSTRUCTION in a continuous-beam solve — the shears are derived from the end
   moments, so they close for any moment distribution, right or wrong. Only
   `statics.reactionCrossCheck` (reactions rebuilt from an independent three-moment / force-method
   solution) and the joint-equilibrium residual can detect a bad moment distribution. Do not read a
   zero ΣV as verification of the analysis.
5. **Drawing correctness beyond the label audit.** The label audit proves no clipped or overlapping
   labels. It does not prove any drawn geometry is right. The R4.4 nodal-zone and critical-section
   positions were verified by measuring the emitted SVG path coordinates against hand-computed
   model inches (step 4b below); everything else on the elevation is verified by eye.
6. **Serviceability.** No crack-control or deflection check exists anywhere in this calculator, and
   Case D creates a top-of-wall tension face that has none. Disclosed in the scope note, not checked.

## Steps

1. **Open the page** at `http://localhost:3000/Calcs/deep_beam_stm_calculator.html` (or the deployed URL). It must auto-calculate with the PLAN §10 defaults — the page never opens empty: drawing, summary banner, demand cards, and check table all populated without pressing the button.
2. **Verify the default solve** against the published benchmark (PLAN §10 / `fixtures/deep-beam-stm/default_case.json`):
   - Tie force card **T ≈ 99.4 k**; springing angle **θ ≈ 67.2° both ends**; wu = 18.20 klf; M_max ≈ 1,538 k-ft; R_truss = 236.6 k; R_bearing = 259.3 k per side; z ≈ 15.5 ft.
   - Solved case echoes **A**; βs = 0.75 (Table 23.5.1 qualified).
   - Routed-strip echo note is present (22.7 k per side) and the `strip.*` mini-load-path rows appear.
3. **Verify the default anchorage result**: with default hooks both anchorage rows show **DCR 0.676 PASS** (ℓdh = 19.92 in required vs 29.46 in available); the banner reads "All Checks Pass" with `detailing.wallEF` governing at 1.000 (the #4@12" EF wall steel sits exactly at the §9.9.3.1 12 in spacing limit). Expand the anchorage Calc row — ψe = 1.00, **ψr = 1.00**, ψo = 1.25, ψc = 0.80, critical section x_crit ≈ 1.46 in inboard of the bearing inner face.
   > STALE-STEP NOTE (corrected 2026-08-11): this step previously expected DCR 1.082 FAIL. That figure came from a misapplied ψr — the ≥ 6d_b disjunct of Table 25.4.3.2 was being tested against *tie* spacing instead of *hooked-bar* spacing — and was corrected in the implementation audit. The current 0.676 rides on that table, which is on the licensed-text verification list. If Nick's reading differs, the unconfined result reverts toward 1.08 and hook confinement or headed bars become the fix. Do not treat a PASS here as independent of that open item.
4. **Flip both end anchorages to Headed bar** — anchorage DCR drops further (ℓdt < ℓdh at these bar sizes); head glyphs replace hook glyphs on the elevation. Flip back to hooks afterward.
4b. **Capped tie — §23.8.2 propagation to the DRAWING (R4.4).** Set the bottom tie to 3-#7. Expect
   `tie.width` CAPPED with w_t,gov = 4.4118 in; anchorage available drops 29.46 → 28.92 in; the
   anchorage derivation reads `x_crit = (w_t,gov/2)/tanθ = (4.4118/2)/tanθ` and adds "uncapped it
   would be 1.43 in, so the cap costs 0.51 in of available embedment" — **not** the unconditional
   `y_t/tanθ` wording. On the elevation, the extended-nodal-zone rectangle must be CENTRED ON THE
   TIE, spanning y = 1.23 → 5.64 in above the bottom of the grade beam, not 0 → 4.41. Verify by
   measuring the SVG if in doubt: the zone path reads `M150.00,434.99 … 426.74` against a grade-beam
   datum of py 437.30 and 1.8713 px/in. Restore 4-#8; the zone must return to y = 0 → 7.00 in
   (path `M150.00,437.30 … 424.20`) and every default number must return exactly.
5. **Case B**: select Case B, enable P1 (50D + 25L at 14.25 ft, 12 in bearing). Result stays `ok`, banner updates, the point-load arrow appears on the elevation, and check governing patterns show `P1` live-load bits. Disable P1.
6. **Case C** (fixture-mirrored admissible configuration — heavy-UDL Case C is legitimately "no admissible STM"; the input hint explains why):
   - Geometry: L_w 34, x_R 32, lb 24/24, t_w 12, h_w 10, GB 24×24, e_L 96, e_R 12.
   - Loads: DL_super 0, LL 0; check "Override auto self-weight" and set both self-weights to 0.
   - Case C: side Left, overhang length 9 ft; overhang point load ON: D 30, L 0, 5.1667 ft from wall end, 8 in bearing.
   - Point-load rows (visible in Case C): P1 ON — D 30, L 0, x 1.3333 ft, w 8 in; P2 ON — D 90, L 0, x 16.6667 ft, w 12 in.
   - Expect: solved case **C (overhang left)**; T_bot demand 28 k (D/C 0.197); top tie governing `ttop.ov1-Na` 42 k; θ_spr ≈ 56.3° / 36.9°; **free-end development DCR 1.288 honest FAIL**; tie end-force identity row INFO ≈ 0; N_a marker, overhang struts, and top tie drawn.
6b. **Case D + the R4.1/R4.2 rows.** Select Case D (defaults otherwise). Expect the interior-pier row
   to read "**governing load-bearing face: bearing**" — never the chord face, and never a D/C of
   exactly β_s. Expand it: the sized-to-fit chord face must appear in the face table AND as an
   explicit "excluded from the governing-face selection" disclosure. The summary's self-check line
   must name the three-moment reaction cross-check and state that ΣV and the node closure close by
   construction. `statics.reactionCrossCheck` appears as a real (non-INFO) row at D/C 0.000;
   `node.interior.closure` appears as INFO and is titled "closes by construction (model
   consistency, not a check)".
6c. **Tie layers — R4.3 lower-half guard.** Switch the tie to Layers, 2 layers, y = 13 and 21 in a
   24 in grade beam. Expect **Invalid Input**, the engine message verbatim ("lowest tie layer
   y_in = 13 in must lie below grade-beam mid-depth…"), the client-side advisory mirroring it, and
   the SVG blanked to the watermark. Repeat with a single layer at y = 20 — same rejection. Then set
   y = 3.44 and 10: the run must be accepted, `tie.width` INFO + CAPPED at D/C 1.000 and **PASS**
   (both layers inside the band [2.31, 11.13] in). Restore the single-layer tie.
7. **Invalid input blanking**: set x_L = 0.5 ft (violates x_L ≥ lb_L/2). Banner shows the distinct "Invalid Input" state, the engine's error renders **verbatim** in the message box, and the SVG blanks to the "INVALID INPUT — no drawing" watermark. Restore x_L = 1.25; the drawing returns.
8. **Console**: open DevTools — no JavaScript errors from the calculator page during steps 1–7 (the Next.js dev shell's own requests excluded).
9. **Label audit**: the status line under the drawing reads "label audit: N labels — PASS (no clips, no overlaps)" after every state exercised above. A FAIL here reports the offending label pair — never silently.
10. **Mobile width**: at 375 px viewport, the page has no horizontal body scroll (the check table scrolls inside its own container), the drawing scales down, and the audit still passes.
11. **Print preview**: Ctrl+P — the calc button and audit line are hidden, the SVG scales to page width, input blocks and results print legibly.

## Execution log

| Date | Operator | Result |
|---|---|---|
| 2026-08-11 | Claude (build integration) | Steps 1–10 PASS (browser-automated: defaults T=99.4 k / θ=67.2°, anchorage 1.082 FAIL honest, headed→PASS 0.79, Case B ok, Case C fixture config ok w/ free-end 1.288 FAIL, invalid blanks w/ watermark, console clean, audits PASS all states, 375 px clean). Step 11 print verified by CSS review only (spike-proven print rules) — interactive print preview pending first manual run. |
| 2026-08-11 | Claude (main session, post band-fit fix) | PASS — defaults T=99.4 k θ=67.2°, anchorage 1.082 honest fail, band-fit governing now arch.0 @ 0.491 (crown sized-to-fit excluded), console clean, 233/233 fixtures |
| 2026-08-11 | Claude (post Codex full audit: 20 findings fixed, re-audit CLEAN) | PASS — 312/312 fixtures; default anchorage now 0.676 PASS (correct ψr via 6.33" hooked-bar spacing ≥ 6db — VERIFY vs licensed Table 25.4.3.2); governing check wallEF spacing 1.000 (at 12" limit); dual band-fit rows; console clean |
| 2026-08-11 | Claude + Fable pre-deploy verification | PASS — GB anchorage nib fix. e_L=3 accepted (was wrongly rejected), available 29.46→32.46 in, unconfined-hook DCR 1.082→0.982 PASS; nib renders both ends, label audit 20 labels clean, console clean. 325/325 fixtures. Fable VERIFY: PASS (caught+fixed a datum bug in the nib self-weight term first). |
| 2026-08-13 | Claude (Fable verification round 1 fixes, §R4.1–R4.8) | PASS — `npm run test:stm` **716/716, 0 failures, 15 documented skips** (was 632); `npx next build` clean; fresh-tab console **zero messages**. **DEFAULT CASE A BIT-IDENTICAL**: T = 99.41577884230226 k, h_a = 7.000 in, x_crit = 1.4603235958489489 in, anchorage D/C = 0.6760680630162922, governing `detailing.wallEF` 1.000, label audit 20 labels PASS, nodal-zone path unchanged at model y = 0 → 7.00 in. **R4.1** — interior-pier rows now read "governing load-bearing face: bearing"; `textbook_2span` 1.434375 ksi / D/C 0.750 (chord) → 1.0395486111 ksi / D/C 0.5435548 (bearing), `wide_grade_beam` 0.750 → 0.5633805; new light-load fixture `R4_1_light_load_interior_node` (self weight only) reads 0.1784314 where the chord face still sits at 0.750 — a 4.2× correction, and the by-construction face is demoted to a disclosure line, still reported. **R4.2** — new `statics.reactionCrossCheck` row: support moments re-derived by Clapeyron's three-moment equation (force method, own tridiagonal solver, no shared code with the direct-stiffness path) and reactions rebuilt from them; residual 0 against 1.01e-3 kip. Fixture documents the perturbation that trips it (FEM wL²/12 → wL²/10 gives M₁ = −14,011.45 instead of −11,676.21, stiffness R_end 104.7865 vs three-moment 112.27125 = 7.485 kip residual) while ΣV, ΣM, jointRes and the node closure all stay exactly zero. `node.interior.closure` relabelled "closes by construction (model consistency, not a check)" with the reason on the row. **R4.3** — `tieLayers[0].y ≥ h_gb/2` rejected in the engine and mirrored in `clientWarnings`; both of Fable's configurations (single @ y = 20, two layers @ 13/21 in a 24 in GB) now return INVALID_INPUT in the shipped UI with the SVG blanked; a legitimate low two-layer tie (3-#7 @ 3.4375 + 3-#7 @ 10) is fixtured PASSING, capped, band [2.3070, 11.1305]. **R4.4** — `x_crit` prose is conditioned on `capped` and the drawn nodal zone is centred on the tie; measured from the emitted SVG at 3-#7: zone y = 1.2316 → 5.6434 in (was 0 → 4.4118) and the critical section at 0.9267 in, not the old 1.4441 in. **R4.5** — `R4_5_capped_tie_case_d` exercises h_a, θ_end, the end diagonal w_s (30.7899 → 30.1215 in), the end-node back face, the F1.5 collapse identity inside Case D (node D/C = tie D/C = 0.4323480 exactly) and the capped `x_crit`; multi-layer in-band PASS added. **R4.6** — licensed-text verification list extended to §23.8.2, §9.7.3.8.4, §25.5.2 with the R23.8.1-placement caveat. **R4.7** — b-region label prints d, 12d_b and max(d,12d_b) separately (unreachable ternary removed); the …230259 T literals corrected to …230226 and the "verbatim" claim replaced with the reason for the last-two-digit difference; test-only options are now REJECTED from a browser caller (verified live: `{options:{tieWidthLimit:false}}` → INVALID_INPUT naming the option; `allowTestOnly:true` honours it AND echoes `model.testOnlyOptions`). **R4.8** — coverage statement added at the top of this file. Case D verified drawing at default and with a capped 3-#7 tie (label audit 24 labels PASS, end-node "COLLAPSED ONTO TIE CHECK" badge, interior node still bearing-governed). 375 px: zero horizontal body scroll in A, D and with tie layers. NOT verified this pass: print preview (CSS review only, as before); the licensed ACI text for all seven flagged clauses. |
| 2026-08-13 | Claude (v2 UI integration: Case D + multi-layer tie) | PASS — `npm run test:stm` 632/632, `npx next build` clean. Default Case A unchanged: T = 99.4 k, θ = 67.2° both ends, wu 18.20 klf, M_max 1537.7 k-ft, R_b 259.3 k, all checks pass, label audit 20 labels PASS. Case D 2/3/4/5 spans all solve and draw (multi-span elevation, per-span tie force envelope, top-chord zones with required-vs-provided extension dimensioned, envelope inflection marks, diagonal strut bands, pier nodal zones, moment-envelope panel, full-height section with the negative chord in the upper wall); label audit PASS at every span count (24/28/33/38 labels) — three overlap defects found and fixed during the run (ext-dim vs distributed-load label, adjacent pier reaction labels, diagonal callout vs edge dimension). Engine scope note rendered verbatim from `results.model.caseD.scopeNote`. Informational rows (`tie.width`, `topsteel.extension.bregion`, `node.interior.closure`, `detailing.bottomContinuity`, `caseD.endStrip`, `caseD.scope`, Case C `strip.*.dispersion`) render with the INFO treatment and are never painted as capacity failures; an informational row the engine marks `pass:false` gets an ATTENTION badge plus the engine's message verbatim. `capped` and `collapsedOntoTie` surface as row badges and as a disclosure at the TOP of the derivation. Multi-layer tie 3-#7 @ y = 3.44 + 3-#7 @ y = 21.56: `tie.width` INFO+ATTENTION, CAPPED, band [8.0882, 16.9118] in, both layers 4.6482 in outside — and both support-node rows carry COLLAPSED ONTO TIE CHECK. Uplift (Case D, DL_super 0 / LL 20000 plf): `no_admissible_stm`, SVG blanks to the watermark, engine message verbatim, check table and scope note cleared. Case C fixture config re-verified unchanged (T_bot 28 k, θ 56.3°/36.9°, free-end 1.288 FAIL). Console clean across every case, span count and tie-layer count (fresh tab, zero messages). 375 px: zero horizontal body scroll in Cases A/B/C/D and with tie layers. Defect found and fixed: enabling 3 or 4 tie layers used to produce an INVALID_INPUT (unordered default y values) — the layer count change now re-spaces them. NOT done in this pass: registry subtitle/keywords in `app/lib/calcs.ts` (outside the single-file scope of this task); anchorage required/available dimension pair is not drawn on the Case D elevation (the `anchorage.L/R` rows and derivations carry it) to keep the label audit clean. |
| 2026-08-11 | Claude + Fable rounds 1–2 (v2 features) | PASS — 716/716 fixtures, next build clean. F1 tie band (§23.8.2) + F2 Case D continuous shipped. Round 1 FAIL (3 MAJOR: fake governing face, tautological closure assertion, tieLayers lower-half gap) → fixed → round 2 PASS. Post-round-2: gated options.combos (was ungated — could silently run the calc unfactored), corrected overclaimed mutation prose, refreshed stale steps 3–4. NOT proven: print output; licensed ACI text for 7 flagged clauses (Table 25.4.3.2 is the one with teeth). |
