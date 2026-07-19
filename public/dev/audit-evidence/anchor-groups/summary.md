# Anchor-groups verification — Phase 5 rollup

Branch `feature/anchor-groups` · baseline `483408b` · date 2026-07-19
Three changed calcs: `masonry_anchor_calculator.html` (TOW plf/discrete),
`embed_plate_beam_bearing_calculator.html` (rows×cols grid),
`masonry_anchor_bolt_calculator.html` (SD bolt group).

**Status: DONE — no concerns. No calc HTML or `tools/` file was modified.**

## How it was driven
Deployed pages served from `public/` (`tools/nocache_server.py :8799`) and driven
in **headless Chrome (installed browser) via the DevTools Protocol** — controlled
input-setting, preset clicks, `runCalcs()`/`runCalc()`, console capture, banner/
diagram inspection, and clipped-element PNG screenshots. Raw output is
`smoke-raw.json`; scored results `smoke-matrix.json`.

## 1. Arrow-direction visual proof — VERDICT: PASS
Full detail + per-image findings in `arrow-directions-proof/ARROW-PROOF.md`.
Screenshots were **visually inspected**, not just DOM-asserted.
- **Embed preset picker:** all 5 thumbnails show **V down** and **P as the ⊙
  out-of-page symbol** — no sideways purple arrows. The **6-anchor preset is
  vertical 3×2 (3 rows high × 2 wide)**, labelled 3×2.
- **Embed elevation:** **V vertical-down** at the beam-bearing line; **P
  horizontal, away from the wall face.**
- **Embed wall-face, 3×2 active:** **6 anchors in 3 rows × 2 columns**, V down,
  P ⊙ "(out)"; governing-anchor highlight (GOV T @ middle row) agrees with banner.
- **TOW discrete 1×4 section:** **T up out of the wall top**; **V horizontal**
  toward the loaded face. **Plan:** 4 anchors @ s=8", governing tension (R1C2) and
  shear (R1C1) anchors highlighted, matching the per-anchor table.
- **No arrow defects found.**

## 2. Smoke matrix — 25/25 PASS, 0 non-benign console errors, all diagrams paint
The only console entry anywhere was a single `/favicon.ico` 404 on the session's
first page load (Chrome auto-requests it; no calc references a favicon) — benign.
Full data in `smoke-matrix.json`.

| Calc | Case | Result |
|------|------|--------|
| TOW | plf defaults | PASS · D/C 0.600 (plf mode preserved) |
| TOW | discrete 1×4 @8, T=V=13 (overload demo) | correctly FAILs · Eq 8-8 interaction = 3.530 ≈ expected 3.53 |
| TOW | discrete 2×4, b=11.625, o1=2.5, g=6.625, s=6 | correctly FAILs · N=8, section+plan paint |
| TOW | discrete gate unchecked | hard error — applicability gate not confirmed |
| TOW | discrete 1×6, φ=0.5, Lb=8, s=5.5 | Apt≤0 hard error naming the killing overlap lenses |
| TOW | discrete 1×6, s=3, b=11.625, lbe=6, Lb=5 | Apv≤0 hard error naming the same-row half-lens overlaps |
| TOW | discrete T-only (V=0) | PASS · D/C 0.729 (tension governs) |
| TOW | discrete V-only (T=0) | correctly FAILs · D/C 2.940 (shear governs) |
| Embed | preset 1 / 2V / 2H / 2×2 / 3×2 | all compute + paint; 3×2 → middle-row Ba governs (P/N-only rule) |
| Embed | manual 2×3 via selectors (Wp=16 to fit) | PASS · D/C 0.885 — manual grid entry still allowed |
| Embed | Hp=8 with 3 rows | min-gauge hard error (r=2.00" not > 2") |
| Embed | fit-guard violation (cols3, Sx6, Wp8) | column-fit hard error (14.65" > Wp 8") |
| Embed | arm≤0 mechanism (1 row, ac forces Case1 arm<0) | mechanism hard error (Case 1 arm = -1.00") |
| SD | N=1 defaults | PASS · IR 0.219; per-bolt basis |
| SD | N=4 s=8, group-totals basis | PASS · IR 0.023; header prints "Group totals ÷ N", governing = interior bolt |
| SD | blank spacing, N=4 | hard error — spacing required for a multi-bolt group |
| SD | user-excluded mode (pryout off) | PASS · banner lists "Modes excluded by user: Eq. 9-6 pryout" |

All guard/error cases fire with the expected named-deduction / mechanism / gate
messages; all pass/fail verdicts are engineering-sensible.

## 3. Intentional deltas — every default-render diff explained
`intentional-deltas.md` enumerates each non-numeric default-render difference vs
`483408b` and tags it to a PLAN-ANCHOR-GROUPS.md section. No unexplained delta.
Shared libs (`are-utils-v2.js`, `are-draw.js`, `are-state-loader.js`,
`are-theme-v2.css`) are byte-identical to baseline (additive-only holds; a
sandbox-only false toolbar delta was identified and excluded).

## 4. Pre-existing evidence (left by prior agent, part of this commit)
- `regression-invariants.json` — engineering-value invariants (default inputs).
- `property-report.json` — property harness: 1500 seeded geometries, pass=true,
  0 unit failures, all per-anchor Apt_pairwise ≤ Apt_exact.
Both being validated separately; included per instruction.

## Bottom line
Arrow-proof PASS (visually verified). Smoke 25/25 PASS with all guards firing.
All deltas intentional and plan-traceable. Ready for Nick's sign-off / deploy.
