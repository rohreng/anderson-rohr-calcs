# Masonry audit decision register — 2026-07

Status: frozen audit inputs. These are constraints, not defects. Source hierarchy: calculator engineering notes and the frozen Rev 5 plan govern; the obsolete embed-plate action plan does not override them.

## DR-01 — Embed plate

embed_plate: Apt bearing-area deduction = one circular-segment half-lens per neighboring anchor (in-row c=Sx/2, cross-row c=d/2, diagonal c=g/2) per TMS §6.3.2 — the action-plan's "×2" is obsolete; plate bending uses the bolt-tension model M = 0.5·T_row·a (K=0.5), NOT a V·e cantilever; nt (threads/in) is intentionally under-the-hood UNC coarse by diameter; k=3/4 one-third stress increase applied per-case on all demand sides. The HTML's own engineering-notes section is authoritative over refs/Masonry/embed_plate_calculator_action_plan.md.

Locked audit expectations: one half-lens per neighbor; K=0.5; diameter-selected UNC coarse threads; k applied once and to every demand side. Source: frozen plan and the authoritative engineering-notes section in `embed_plate_beam_bearing_calculator.html`.

## DR-02 — Lintel/jamb

lintel/jamb: jamb combined check is a cracked-section P+M solver per TMS §8.3.4.2.2 (fa/Fa+fb/Fb unity is prohibited for reinforced masonry — do not reinstate it); ¼Pe slender cap = Eq. 8-10 and Pe = Eq. 8-14 in TMS 402-22 numbering; Fa = 0.30·f'm for reinforced (Eq. 8-16) with the 0.65·Ast·Fs steel term deliberately neglected (conservative, disclosed); cover_jamb default 3.81" (= b/2 centered bars); deflection uses an L≤8d waiver gate with a manual-check warning above (deliberately no auto I_eff); wind input is ULTIMATE C&C psf with ×0.6 applied exactly once.

Locked audit expectations: cracked-section P+M; Eq. 8-10/8-14 numbering; Fa=0.30f'm with disclosed steel-term omission; centered 3.81 in cover; L≤8d waiver/manual warning; one 0.6 conversion. Source: frozen plan and the existing lintel/jamb calculator notes.

## DR-03 — Governing sources and tolerance

TMS 402/602-22 governs equation form and applicability. MDG 2022 worked examples are the only numerical oracle in this round. Tolerance is the unrounded internal value versus MDG printed value within displayed precision or 0.5% relative, whichever is looser; any governing conclusion flip is a CALC ERROR. Unit conversions, display rounding, and loop mechanics are exempt from shown-work findings.

## DR-03 — Engineer-of-record rulings, fix phase (Nick, 2026-07-11)

1. **MAB-1 basis:** headed-bolt masonry crushing uses the MDG example's bolt-area basis — the TMS Eq. 6-7 net tensile stress area (0.142 in² for 1/2-13 UNC) — matching MDG 9.3-11's intent. The prior 0.127 in² (root-area) basis is superseded.
2. **RWALL benchmark mapping:** the reinforced-wall calc maps to REK-02 (out-of-plane flexure/shear), REK-03 (loadbearing axial+flexure), and REK-05 (in-plane shear design).
3. **URWALL benchmark:** MDG Table 11.3.1 (Allowable Stresses for Unreinforced Masonry) equations, with hand-calculated wall forces from standard statics (M=wh²/8, V=wh/2). Hand-derived benchmarks explicitly authorized for this calc (amends the round's "no hand derivations" bound). MDG Example 11.3-2 documents the identical method.
4. **EMBED verification:** no MDG example exists; a documented hand check of every calculation plus a global methodology overview is the accepted verification (docs/embed-plate-hand-check-2026-07.md). DR-01 methodology remains law; the hand check verifies the implementation.

**New findings discovered while building the ruling benchmarks (PENDING EOR RULING — not yet fixed):** the reinforced-wall calc's partial-grout section model uses face-shell-only area for An/I/r and BOTH shear planes (in-plane fv +52% vs MDG Anv basis; OOP shear under-predicted ~4×, unconservative), applies no 0.6 factor to the OOP wind moment inside the "0.6W" combo, and uses 0.30·f'm (vs TMS 0.25) in allowable axial (unconservative); f'm=1,750 not selectable. The unreinforced-wall calc codes Fb as 0.33·f'm vs f'm/3 (minor, conservative), has no Pe/4 buckling check and no OOP shear check, and caps h/t at 20. These are recorded in the rek-02/03/05-asd-* and urwall-6in-hand fixtures with benchmark_status pending_eor_ruling / benchmark_not_drivable.

## DR-04 — Anchor-group overlap deduction: pairwise lenses superseded by exact tributary partition (2026-08-05)

**Amends DR-01's "one half-lens per neighbor" locked expectation and the pairwise-lens framing in docs/anchor-groups-hand-check-2026-07.md.**

The pairwise lens subtraction (`Apt = πlb² − segNear − segFar − Σ circSeg(lb, c/2)`) is first-order inclusion–exclusion, truncated. Where 3+ breakout cones share a region (lb exceeding the minimum-enclosing-circle radius of some anchor triple), that region is deducted multiple times. This is not merely conservative: computed A_pt can DECREASE as embedment increases. Reproduced 2026-08-05 on a 12″ CMU 2×3 group (o1=3.5″, g=5″, s=8″): lb 5.00″→6.656″ dropped governing A_pt from 43.56 to 7.90 in² and flipped a passing connection (max D/C 0.600) to FAIL (7.826). The July audit harness asserted conservatism in sign only (`A_pairwise ≤ A_exact + ε`); it saw pairwise areas as low as 0.2% of exact and passed.

**Ruling implemented in `masonry_anchor_calculator.html` (discrete and continuous paths):** each anchor's A_pt,i / A_pv,i is its exact Voronoi tributary area — the part of its own projected cone closer to it than to any other anchor (midplane at c/2 toward each neighbor), clipped at the wall faces — computed closed-form (circle ∩ convex polygon; no numerical integration). Properties: Σ A_pt,i equals the true union of the group's cones (no portion of masonry counted more than once, per §6.3.2, and none deducted more than once); each area is monotone non-decreasing in embedment; degenerates to the pairwise result where overlaps are disjoint. The July "verification oracle, not the design value" framing of the tributary integrator is overturned: the tributary partition IS the design value; the adaptive integrator in `tools/anchor-groups/geometry.js` remains the independent oracle. Harness now asserts the two-sided match `|A_design − A_exact| ≤ ε`, positivity (conservative rejections are failures), and monotonicity (run-all.js, 2026-08-05).

**Status of siblings:** `masonry_anchor_bolt_calculator.html` (group mode) and `embed_plate_beam_bearing_calculator.html` (grid mode) still use the pairwise construction — same defect family, pending the same conversion (EOR to schedule). DR-01's locked half-lens expectation for the embed plate stands until that conversion lands.
