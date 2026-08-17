# Audit Fix Specification — deep-beam-stm (Codex audit 2026-08-11)

Working file, excluded from deploy commit (like PLAN.md). Each item: audit finding → the DECIDED fix (arbiter: Claude). Implement exactly; where this spec corrects the auditor's suggested fix, the spec wins (reasons noted).

## A. Development-length formulas (engine `ldHook` / `ldHead` / `ldStraight`)

**A1 (audit #5, BLOCKER-class).** Hook: implement ACI 318-19 §25.4.3.1 exactly:
`ldh = (fy·ψe·ψr·ψo·ψc / (55·λ·√f'c)) · db^1.5` (units psi, in), minimum `max(8db, 6 in)`.
ψe = 1.2 epoxy / 1.0; ψc = f'c/15,000 + 0.6 ≤ 1.0 (f'c < 6,000), 1.0 otherwise; ψo per §25.4.3.2 (1.0 for hooks inside column/pier core or with side cover ≥ 6db, else 1.25 — keep the existing conservative-input approach but verify the branch); λ = 1.0 (locked). The exponent change is the fix; keep everything else that is already correct.

**A2 (audit #7).** ψr per Table 25.4.3.2 — the audit's suggested "s ≤ 6db" is NOT the code condition; implement the actual table:
ψr = 1.0 when (a) Ath ≥ 0.4·Ahs, OR (b) **center-to-center spacing of the HOOKED BARS ≥ 6db** (NOT tie spacing). Else ψr = 1.6.
- Hooked-bar c/c spacing: compute from entered GB width, side cover, and tie-bar count: s_hooked = (bgb − 2·coverSide − db)/(count − 1). (Requires ≥ 2 bars — see D1.)
- Ath: from the entered hook-region tie config = tieLegs · tieArea · nTies, with nTies = floor(15·db / tieSpacing) + 1 (ties within 15db of the hook, §25.4.3.3 geometry). Ahs = As of the hooked bars being developed.
- Result: wide TIE spacing reduces Ath → cannot earn 1.0 through (a); widely spaced hooked BARS legitimately earn 1.0 through (b). Add an adverse fixture proving tieSpacing = 100 in does NOT earn ψr = 1.0 when s_hooked < 6db.

**A3 (audit #6).** Headed: §25.4.4.2: `ldt = (fy·ψe·ψp·ψo·ψc / (75·√f'c)) · db^1.5`, min `max(8db, 6 in)`. Same exponent fix. Keep all §25.4.4.1 applicability limits already enforced.

**A4 (audit #8).** ψp per Table 25.4.4.3: ψp = 1.0 when Att ≥ 0.3·Ahs OR **c/c spacing of the HEADED BARS ≥ 6db**; else 1.6. Same computation pattern as A2 (Att from tie config, headed-bar spacing from bar layout). Adverse fixture as in A2.

**A5 (audit #9).** Straight-bar ψe: 1.5 when (clear cover < 3db OR clear spacing < 6db), else 1.2 for epoxy; 1.0 uncoated; enforce cap ψt·ψe ≤ 1.7. Clear cover/spacing from entered geometry (bottom cover, side cover, bar layout).

## B. Node geometry (engine `vertexNode`, Case C nodes)

**B1 (audit #1).** Vertex nodes claim faces up to ~131 in because vertical extent is bounded only by the envelope. Add the physical band bound:
`haNode = min( 2·(hp − v.y), 2·(v.y + yt), max(dVert_L, dVert_R) )`
where dVert are the adjacent segments' vertical band depths. Face widths stay `v.w·|sinα| + haNode·|cosα|` with the bounded haNode. Node polygon = intersection of the two band quadrilaterals with the vertical strip of width v.w — implement the intersection, return it as `poly`, and fail with "geometry infeasible" if it is empty/degenerate (closure test). Rationale: a node face cannot be wider than the compression band that delivers its force; interior smeared nodes then read consistently with the band-fit checks instead of overstating capacity.

**B2 (audit #2).** N_a (Case C): same B1 construction PLUS the tie back face: haTop = min(2·ytTop-distance-to-top, band bound as B1). Closure test must include the tie face (the four-face polygon must close within the wall envelope); reject → "geometry infeasible".

**B3 (audit #3).** Case C support node: construct one physical zone: bearing sub-face widths lbSub must satisfy Σ lbSub ≤ lb (reject overlap → "geometry infeasible"); add the top-tie face where T_top crosses the node region (force T_top, width = 2·ytTop bound, stress checked); bottom-tie back face already present. Document the sub-face layout in the returned node object for drawing.

**B4 (audit #11).** Cases A/B support node equilibrium with routed loads: the NODE bearing face carries the TRUSS reaction only (node is equilibrated: bearing = strut vertical + 0, tie horizontal = strut horizontal). The routed load stays in the separate §22.8 bearing check and its FBD chain (which keeps R_truss + routed). Add a comment stating the FBD split; do not double-count.

## C. Band-fit reporting (audit #4 — replaces the crown-exclusion approach)

Two check rows instead of one:
- `strut.fit` "Arch band fit (load-governed segment X)": governing = max fitDcr over segments with `!byConstruction`. Normal pass/fail/nearLimit behavior.
- `strut.fit.crown` "Crown band — sized to fit (informational)": present only when ≥1 byConstruction segment exists; demand/capacity = that segment's wReq/wAvail; DCR displayed; `pass = true`; `nearLimit = false`; label text includes "DCR ≈ 1.0 by construction — crown depth a is sized to the design stress and placed a/2 below the top of wall". byConstruction predicate: top-governed bound AND |fitDcr − 1| ≤ 1e-6 (unchanged).
The physical envelope is unchanged; nothing is hidden; the load-governed row is the actionable one.

## D. Validation (audit #12)

**D1.** Engine: reject tieBars.count < 2 and topBars.count < 2 (INVALID_INPUT). **D2.** Reject cover geometry that cannot fit: coverBottom + db/2 ≥ hgb/2, coverSide·2 + db·count > bgb (bars don't fit), wall EF cover vs tw. **D3.** Mirror as HTML min/step attributes and hint text.

## E. Routed-strip rule (audit #10)

Qualify an outboard strip as routed ONLY if `o ≤ min(hgb, lb)` — 45° dispersion through the GB depth AND landing entirely within the bearing width (the plan's "projected footprint within the bearing footprint", made concrete). Update the input-error message ("outboard wall exceeds dispersion/bearing limit — use Case C") and the results echo. Default case: o = 15 in ≤ min(24, 30) — still routes. Boundary fixture: o just above the limit → input error directing to Case C.

## F. Observability / UI (audits #15, #16)

**F1.** Bearing-check governing pattern labels append " (routed LL always applied)" whenever routed live load exists. **F2.** Engine returns `results.model.AsReq_tie_in2 = T/(0.75·fy)`; UI renders it verbatim in both places it currently computes it (HTML ~722–726, ~949–963). Remove the UI-side arithmetic.

## G. Educational prose (audit #17)

In the calculator HTML Why-boxes: (1) replace "superposes ten load paths" with a correct sentence: one funicular polygon constructed through the lumped resultants of the UDL (N = 10) plus point loads; (2) restrict "extended nodal zone" construction claims to the support nodes (where it is actually built); describe vertex nodes as band-bounded smeared nodes (after B1 that is accurate). Keep everything else.

## H. Fixtures & tests (audits #13, #14)

Add fixtures with INDEPENDENT hand-computed expected values (show the arithmetic in `comments`; do not copy engine output):
1. ldh for #5, #8, #11 — unconfined (ψr 1.6) and confined (ψr 1.0 via each disjunct separately), f'c 3,000/fy 60: e.g. #8 unconfined: ldh = (60,000·1.0·1.6·1.25·0.8/(55·54.77))·1.0^1.5 = 31.87 in (matches current default — the exponent is invisible at db = 1.0, which is WHY the bug survived; state this in the comment).
2. ldt headed #8 with applicability pass and a rejected config.
3. Straight-bar epoxy congested (ψe 1.5) vs clear (1.2), cap check.
4. Adverse confinement: tieSpacing = 100 in with s_hooked < 6db must give ψr = 1.6 (A2).
5. Vertex-node cap: a case where the old code gave face > band depth; assert new haNode bound.
6. Routed-strip boundary (E).
7. Crown informational row present + load-governed row governs (C).
8. Existing fixtures: update ONLY expectations legitimately changed by these fixes (band-governing row, anchorage values unchanged at db = 1.0, node face widths where capped). Justify every changed expected value in its comment. No tolerance widening.

## I. Housekeeping (audit #18)

`fixtures/deep-beam-stm/verified-links.json`: add `"omitted_from_html": true` (with note) to the concrete.org preview entry.

## Acceptance

`npm run test:stm` fully green with the new fixtures; no unrelated behavior changes; engine remains DOM-free UMD; shared files untouched (are-draw.js, are-calc.css, other calcs); PLAN.md/PLAN-REVIEW-LOG.md/AUDIT-FIXES.md not modified.
