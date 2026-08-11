# Smoke Checklist — Deep Beam Strut-and-Tie Calculator

Page: `/Calcs/deep_beam_stm_calculator.html` (registry slug `deep-beam-stm`, status `wip` until sign-off).
Run this checklist before any deploy that touches the calculator page, the engine, or `are-draw.js`.
Per PLAN.md §6, every execution is logged in the table at the bottom (date / operator / result).

Prerequisite: `npm run test:stm` is green (233 comparisons, 0 failures expected).

## Steps

1. **Open the page** at `http://localhost:3000/Calcs/deep_beam_stm_calculator.html` (or the deployed URL). It must auto-calculate with the PLAN §10 defaults — the page never opens empty: drawing, summary banner, demand cards, and check table all populated without pressing the button.
2. **Verify the default solve** against the published benchmark (PLAN §10 / `fixtures/deep-beam-stm/default_case.json`):
   - Tie force card **T ≈ 99.4 k**; springing angle **θ ≈ 67.2° both ends**; wu = 18.20 klf; M_max ≈ 1,538 k-ft; R_truss = 236.6 k; R_bearing = 259.3 k per side; z ≈ 15.5 ft.
   - Solved case echoes **A**; βs = 0.75 (Table 23.5.1 qualified).
   - Routed-strip echo note is present (22.7 k per side) and the `strip.*` mini-load-path rows appear.
3. **Verify the known honest failure**: with default hooks (no confining ties), both anchorage rows show **DCR 1.082 FAIL** (ℓdh = 31.87 in required vs 29.46 in available), banner reads "One or More Checks Fail", governing check `anchorage.L` [1.2D+1.6L]. Expand the anchorage Calc row — ψe = 1.00, ψr = 1.60, ψo = 1.25, ψc = 0.80 substituted, critical section at x_crit ≈ 1.5 in inboard of the bearing inner face.
4. **Flip both end anchorages to Headed bar** — banner flips to "All Checks Pass"; anchorage DCR ≈ 0.79 both ends; head glyphs replace hook glyphs on the elevation. Flip back to hooks afterward.
5. **Case B**: select Case B, enable P1 (50D + 25L at 14.25 ft, 12 in bearing). Result stays `ok`, banner updates, the point-load arrow appears on the elevation, and check governing patterns show `P1` live-load bits. Disable P1.
6. **Case C** (fixture-mirrored admissible configuration — heavy-UDL Case C is legitimately "no admissible STM"; the input hint explains why):
   - Geometry: L_w 34, x_R 32, lb 24/24, t_w 12, h_w 10, GB 24×24, e_L 96, e_R 12.
   - Loads: DL_super 0, LL 0; check "Override auto self-weight" and set both self-weights to 0.
   - Case C: side Left, overhang length 9 ft; overhang point load ON: D 30, L 0, 5.1667 ft from wall end, 8 in bearing.
   - Point-load rows (visible in Case C): P1 ON — D 30, L 0, x 1.3333 ft, w 8 in; P2 ON — D 90, L 0, x 16.6667 ft, w 12 in.
   - Expect: solved case **C (overhang left)**; T_bot demand 28 k (D/C 0.197); top tie governing `ttop.ov1-Na` 42 k; θ_spr ≈ 56.3° / 36.9°; **free-end development DCR 1.288 honest FAIL**; tie end-force identity row INFO ≈ 0; N_a marker, overhang struts, and top tie drawn.
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
