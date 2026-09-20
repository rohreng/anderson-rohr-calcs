# Plan Review Log: Wood Connection Schedule calculator
Act 1 (grill) complete — plan locked with the user 2026-09-19. MAX_ROUNDS=5.
PLAN_FILE = docs/plans/2026-09-19-wood-connection-schedule-plan.md
Pre-Act-2 step (Nick's request): Fable cross-check of the plan against the NDS 2018 PDF on the server.

## Pre-Act-2 — Fable NDS cross-check (2026-09-19)
Report: docs/plans/2026-09-19-wood-connection-schedule-nds-crosscheck.md. 13 wrong/misnumbered
items (C_g is Ch. 11; steel F_e from table footnotes; l_m = p − E/2; D_r rules; C_Δ ratio-with-floor;
end-grain withdrawal prohibitions; lag-into-steel-main invalid) and 19 missing items folded into plan rev 2.

## Round 1 — Codex (gpt-6-astra, codex-cli 0.155.1, thread 01a0bbcd-ddaa-7902-9a6f-4775eaa1eddb)
The plan still has material problems, including errors in the crosscheck. I read the requested files and made no changes. References below use **P** for the [plan](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-plan.md>) and **XC** for the [crosscheck](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-nds-crosscheck.md>).

1. **Unsafe: `C_Δ` has no upper bound.** P §4 specifies the minimum of two actual/required ratios; end distance `14D` and spacing `8D` could produce `C_Δ = 2`, doubling capacity.  
   **Fix:** Use `min(1, endRatio, spacingRatio)` after enforcing every geometry minimum.

2. **Unsafe: penetration can extend beyond the wood.** `p_tot = L − t_s` ignores receiving-member thickness. A 3½-inch 16d nail through a 1½-inch side into ¾-inch wood gets credited with 2 inches of penetration, although only ¾ inch is available—below `6D`.  
   **Fix:** Derive bearing and thread engagement from intersections with actual member boundaries, accounting for tips and threads that exit the wood.

3. **Unsafe: withdrawal omits head pull-through.** P reports `W′p_t` as capacity without checking the head pulling through the side member; the existing shearwall SDS implementation already includes this limit. NDS §12.2.5 explicitly provides head pull-through design. [NDS Chapter 12](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20210928_AWCWebsite_Chapter12.pdf)  
   **Fix:** Add head/washer geometry and pull-through or steel pull-over checks, and let the weakest applicable limit govern withdrawal.

4. **Unsafe: SDS cannot inherit the generic No. 14 rules.** The ESR equivalence is for withdrawal; lateral design has its own `F_yb`, dimensions, material limits, penetration and spacing requirements. Generic screw thread length also overcredits SDS25412: 3 inches versus its actual 2¾ inches. [ESR-2236 §§4.1.3–4.1.6, Table 1](https://cdn-v2.icc-es.org/wp-content/uploads/report-directory/ESR-2236.pdf)  
   **Fix:** Implement a separately versioned SDS product model with ESR restrictions and fixtures, or defer SDS.

5. **Wrong crosscheck: toe-nail withdrawal penetration is not the vertical projection.** XC B5/D17 and P §4 confuse the lengths: Commentary C12.5.4.1 permits actual nail length in the receiving member for withdrawal; C12.5.4.2 uses the projected length for lateral bearing. [NDS Commentary, p.266](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20200827_AWCWebsite_Commentary.pdf)  
   **Fix:** Specify separate toe-nail formulas for actual penetration, projected bearing length and minimum penetration, with a worked fixture.

6. **Double-shear lags are insufficiently defined.** `L − t_s` describes a two-member joint, while XC C1 expressly places the double-shear lag penetration requirement in the side members. The plan never defines near/far-side engagement, symmetry, thread location or the physical lag detail with steel sides.  
   **Fix:** Restrict initial double shear to symmetric through-bolts, or define and independently verify the complete three-member lag geometry.

7. **Penetration reduction is counted twice as written.** P combines yield equations using actual shortened bearing length with `p/8D` or `p/10D`; XC A12 quotes these as alternative calculation methods.  
   **Fix:** Use actual-length yield equations without table-footnote scaling, reserving scaling for a separate table-lookup method.

8. **End-grain rules were incompletely transferred.** XC A17 includes bolts in lateral `C_eg = 0.67` and requires `F_em = F_e⊥` for nominal `D ≥ ¼`; P’s factor bullet omits bolts and its bearing-strength bullet omits the override.  
   **Fix:** Encode installation orientation separately and apply both end-grain rules; prohibit nail/screw withdrawal only when withdrawal is demanded.

9. **Steel thickness can incorrectly relax wood spacing.** P uses `min(l_m, Σl_s)` for geometry while setting steel `l_s` to plate thickness; a thin plate can therefore select the least restrictive branch. The commentary says only wood-member ratios participate. [NDS Commentary C12.5.1.3](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20200827_AWCWebsite_Commentary.pdf)  
   **Fix:** Calculate geometry `l/D` from wood members only, separately from yield-equation bearing lengths.

10. **The blanket perpendicular-spacing rule is unjustified.** XC D8’s suggested `s ≥ 3D ⇒ C_Δ,s = 1` becomes an engine rule without covering both members perpendicular or steel attachments; the commentary discusses `4D` for the former and applicable steel spacing for the latter. [NDS Commentary C12.5.1.2](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20200827_AWCWebsite_Commentary.pdf)  
    **Fix:** Define attached-member-specific spacing requirements instead of universally granting full capacity at `3D`.

11. **`C_g` inputs do not determine the promised calculation.** There is no explicit stagger arrangement, odd/even-row algorithm, single-row perpendicular equivalent-width rule, or summed side-member area for double shear. XC C3/D3 supplies information missing from P.  
    **Fix:** Freeze a supported layout model and explicit formulas for effective fastener count, spacing and each member’s gross/equivalent area, including `n = 1`.

12. **Member properties and directions are underspecified.** Only main-member species is defined, although `F_es`, `E_s` and side-member geometry are needed; using DFL properties for an SPF side can overstate capacity. Arbitrary Hankinson angles also lack corresponding geometry rules.  
    **Fix:** Define properties and geometry per member, with explicit inheritance, and constrain unsupported angle/material combinations.

13. **A single custom/SCL property set is inadequate for the whole schedule.** Header `F_e∥/F_e⊥` values have no product, diameter or installation-face scope, and typed `G` has no stated withdrawal qualification.  
    **Fix:** Require product/report-specific property definitions applicable to each fastener and orientation, or limit SCL to verified presets.

14. **The metal-tension note mixes group demand and one-fastener capacity.** P compares per-fastener `T × n` with one root area, despite defining `n` as fasteners per row; its `0.75F_uA_r` also lacks an established ASD basis. NDS §11.2.3 refers to applicable metal design procedures. [NDS §11.2.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
    **Fix:** Compare consistent per-fastener quantities using a cited ASD resistance, or print the demand and an explicit unresolved metal check.

15. **Zero, blank and unsupported demands have no contract.** `atan(T/V)` fails at `(0,0)`; zero withdrawal capacity gives `0/0` for valid shear-only rows; bolt withdrawal might be silently ignored; blank inputs could become zero and PASS.  
    **Fix:** Define finite-number validation, distinct blank/zero semantics, pure-load branches, bolt-withdrawal rejection and explicit invalid/incomplete statuses.

16. **Units and load level are not frozen.** P uses pounds and psi, the Revit contract uses kips and ksi, and the shearwall precedent receives strength-level forces and applies ASD reductions. “ASD only” does not resolve the input convention.  
    **Fix:** Specify fields such as `V_asd_lb`, `T_asd_lb`, `E_psi` and `length_in`, with no implicit demand factoring.

17. **The state-envelope reference is ambiguous.** `docs/calc-state-spec.md` §9 explicitly separates wood browser adapters from `are.calc.v1`; actual toolbar persistence uses `are.snapshot.v1`. Dynamic schedule rows need an adapter, not generic DOM capture.  
    **Fix:** Explicitly adopt §9 and define adapter version, owned DOM, `getModel/setModel/runAndSettle`, validation and authoritative ownership of header inputs.

18. **The parallel-build contract is not yet reviewable.** The named spec does not exist; stable row IDs, duplicate/reorder behavior, defaults, inactive fields, engine exports, error paths and result-key names remain unspecified.  
    **Fix:** Make a frozen contract with representative input/result JSON and round-trip examples a prerequisite to parallel implementation.

19. **The data appendix is not safe to copy verbatim.** It offers a 0.092-inch 6d sinker but starts `F_yb` coverage at 0.099; it also includes lag sizes above the engine’s global 1-inch cap while advertising their withdrawal range. Full species coverage lacks corresponding E defaults.  
    **Fix:** Publish one validated supported-product matrix and reject selections lacking complete, cited properties.

20. **The registry step will fail type checking.** [`CalcMeta.status`](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/app/lib/calcs.ts:4>) accepts `ready | wip | planned`, not `draft`; required `subtitle`, `calcType` and `icon` are also absent from the planned entry.  
    **Fix:** Use an existing status and specify a complete registry object.

21. **The closest precedent contains a dangerous interaction bug.** [`stacked-shearwall.js:437`](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/stacked-shearwall.js:437>) uses squared trigonometric terms for nails too, despite labeling their result Eq.12.4-2; XC A21 correctly distinguishes the formulas.  
    **Fix:** Add an independent fixture with `Z′ = W′p = 100 lb`: equal-component nail loading reaches its limit at `V = T = 50 lb`, versus approximately `70.71 lb` for screws.

22. **Fixture tolerances can hide meaningful errors.** Blanket ±5 lb is inappropriate for integer-pound nail/screw cells such as `72`; XC E11 lists configurations, not complete expected cells, and the spreadsheet’s `127 lb` lacks reproducible inputs.  
    **Fix:** Record exact cell coordinates, full inputs, expected values and cell-specific precision, plus independently calculated intermediate values.

23. **Table matches leave major branches untested.** Missing explicit cases include `I_m`/`III_m` governing penetration, wood-sided double shear/Table 12F, steel main, toe-nails, end grain, every moisture combination, geometry floors, and nominal/root diameter transitions.  
    **Fix:** Add a branch matrix with boundary tests around `D_r = 0.17`, nominal/root `0.25`, penetration minima, spacing minima and zero demand.

24. **The UI verification and audit record are too weak.** “Nick’s real case” will not test fresh-page restores after row deletion/reordering or changing fastener types; print CSS cannot expand derivations absent from the DOM. Worst-D/C summaries can also conceal invalid rows or outstanding checks.  
    **Fix:** Require actual toolbar round trips and saved/printed-output tests, and record engine revision, resolved inputs, intermediate factors, governing checks and unresolved-check counts.

The simplest implementation path is an actual-geometry yield engine with a frozen browser-adapter contract, initially excluding SDS and double-shear lags until their separate rules and fixtures are complete.

VERDICT: REVISE
### Claude's response (round 1 → plan rev 3)
Accepted (plan changed): 1 C_Δ capped at 1.0 with hard minimums first · 2 p_tot = min(L − t_s, t_m), exits_main warning ·
3 optional W_H head pull-through (§12.2.5) with unresolved-check count when absent · 4 SDS deferred to v2 (flagged for
Nick's sign-off since Q1 scope included it) · 5 toe-nail lengths split (l_s, l_m projected, p_t actual) and pinned in the
spec against the PDF, with a fixture · 6 double shear = bolts only; double-shear lags deferred · 7 actual-geometry yield
engine, no p/8D–p/10D footnote scaling, tables reproduced at p = 8D/10D as fixtures (Fable re-verifies the reading) ·
8 end grain: C_eg 0.67 for bolts too, F_em = F_e⊥ for D ≥ 1/4; withdrawal prohibition only when T > 0 · 9 geometry l/D
from wood members only · 10 s_full = 4D for every configuration, 3D floor (commentary 4D for both-⊥; steel spacing is
the engineer's AISC check) · 11 frozen C_g layout model (parallel rows, equal n, stagger merge rule, area formulas,
n = 1 → 1.0) · 12 per-row side species with own G/E/F_e, default = main; intermediate angles use ⊥ geometry rules ·
14 metal tension printed as demand + A_r, no capacity number · 15 blank ≠ zero, incomplete/invalid/pass/fail statuses,
bolt T → invalid, atan2 · 16 units and ASD-level per-fastener lb frozen · 17 Tier-B adapter per calc-state-spec §9,
header inputs Tier-A, runAndSettle re-reads · 18 spec with representative JSON is a prerequisite, written by Claude ·
19 supported-product matrix (0.092 sinker and >1 in lags excluded; No. 16–24 wood screws v2) · 20 status `wip`, full
registry object · 21 combined-load discriminator fixture (nails linear, screws squared) + side task for the shearwall
line · 22 cell-specific tolerances with coordinates and intermediates · 23 branch matrix · 24 real toolbar round-trip
tests after delete/reorder/type change, details always in the DOM, summary counts unresolved rows.
Partially accepted: 13 — one Custom (SCL) slot with typed F_e∥/F_e⊥/G/E + ESR text is kept (a second product is v2);
"per-product, per-face property definitions" rejected as disproportionate for a one-office schedule tool — the ESR line
is printed so the reviewer sees the basis.
Rejected: none outright.

## Round 2 — Codex
Rev 3 substantially addresses prior findings **1, 4, 6–9, 14, 16–19, 21, and 23–24** at the plan level. The contract gate, ASD units, restricted double shear, interaction fixture, and save/load testing are now explicit.

Material problems remain. Line references below are to the [revised plan](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-plan.md>). No files were changed.

1. **Penetration clipping still overstates threaded engagement — prior finding 2, lines 111–120.**  
   Capping `p_tot` does not locate the threads. For a ¼ × 6-inch lag with 3½-inch threads, through a 1½-inch side into a 1½-inch main member, only **0.5 inch** of threads intersects the main member. The proposed formula credits **1.34375 inches**. It also subtracts the whole tip even when the tip is outside the wood.  
   **Fix:** Calculate thread engagement by interval intersection: `max(0, min(L−E, t_s+t_m)−max(L−T, t_s))`, and separately handle bearing/tip overlap—or reject exiting threaded fasteners in v1.

2. **The intermediate-angle shortcut is not conservative — prior finding 12, lines 95–97.**  
   Perpendicular end-distance requirements are smaller than parallel softwood tension requirements: full-value `4D` versus `7D`. Switching a nearly parallel load to the perpendicular geometry rules can therefore increase capacity. Intermediate-angle `C_g` area selection is also undefined.  
   **Fix:** Restrict v1 to 0°/90°, or specify and verify an angle-dependent geometry/area method before enabling intermediate angles.

3. **The new stagger algorithm does not implement the cited rule — prior finding 11, lines 160–169.**  
   NDS compares row separation with one-quarter of the **closest longitudinal offset between adjacent-row fasteners**, not one-quarter of in-row spacing. For half-staggering, that threshold is `s/8`, not `s/4`. Effective spacing is unspecified, odd rows gain phantom fasteners under `ceil(rows/2) × 2n`, and the `n = 1` shortcut can conflict with merging. [NDS §11.3.6.2](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Remove staggered layouts from v1, or define actual offsets, effective row memberships and spacings, then test even/odd arrangements.

4. **The perpendicular `C_g` equivalent-area rule mixes coordinate directions — prior finding 11, lines 165–167.**  
   Rows are defined parallel to load, so when load is perpendicular to grain, in-row `s` is also perpendicular to grain; it cannot simply stand in for the clause’s minimum **parallel-to-grain** spacing in the single-row case. [NDS §11.3.6.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Define layout axes and equivalent width explicitly for each member, including the single-row case, and add a perpendicular-member fixture.

5. **The SCL concern remains misunderstood — prior finding 13, lines 57–61 and 141–143.**  
   One product slot is adequate. The problem is reusing its property pair across different diameters and installation faces without an applicability rule. The small-diameter path also needs a single `F_e`, but the custom interface supplies only `F_e∥` and `F_e⊥`. An ESR text label does not define that mapping.  
   **Fix:** Add row-specific, diameter/face-qualified bearing properties, or require an explicitly documented conservative property envelope covering every permitted row.

6. **Head pull-through is only partly resolved — prior finding 3, lines 152–156.**  
   An optional manual value with an unresolved-check count is workable, but the plan still leaves its adjustment rules undecided. Pull-through has its own moisture factor; using nail-withdrawal moisture logic would be wrong. Steel pull-over also needs a distinct resistance basis. [NDS Tables 11.3.1 and 11.3.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Freeze the input’s source, applicability and reference/adjusted basis; use separate pull-through factors and a separately identified steel pull-over cap.

7. **Toe-nail geometry remains unbounded — prior finding 5, lines 128–134.**  
   The actual-versus-projected distinction is now correct, but `l_m = L cos30° − L/3` still ignores receiving-member boundaries. A 3½-inch nail gives `l_m ≈ 1.864 inches`, exceeding a 1½-inch receiving thickness. The “whichever the PDF says” wording also leaves an already-resolvable contract choice open. [NDS Commentary C12.5.4.1–.2](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20200827_AWCWebsite_Commentary.pdf)  
   **Fix:** Freeze actual withdrawal penetration and projected lateral bearing separately, bounded by the physical joint, and make the proposed toe-nail fixture test that boundary.

8. **New: the five-inch spread restriction can still produce PASS with only a warning — line 185.**  
   The exception requires shrinkage detailing; the state contains no detailing qualification. A warning alone cannot establish compliance. [NDS §12.5.1.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Require a documented detailing exception or return an unresolved/nonpassing geometry check when the limit is exceeded.

9. **New: bolts always using nominal diameter needs an applicability restriction — lines 137–140.**  
   The blanket rule admits threaded bearing configurations without testing the qualification quoted in XC C2: nominal diameter substitution depends on thread engagement.  
   **Fix:** Restrict bolts to qualified full-body bearing configurations, or model thread engagement and apply §12.3.7.2.

10. **The registry still will not type-check — prior finding 20, line 242.**  
    `status: "wip"` is fixed, but `calcType: "Wood Connections"` is not in the current [`CalcMeta.calcType` union](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/app/lib/calcs.ts:16>).  
    **Fix:** Use `calcType: "Connections"`.

11. **Blank/zero behavior remains contradictory — prior finding 15, lines 188–193 versus 217.**  
    The engine text makes both *blank* demands incomplete, while the fixture matrix makes numeric `(0,0)` incomplete. Behavior for one blank component and negative demands is still unspecified.  
    **Fix:** Freeze a demand truth table covering null/null, zero/zero, one missing component, pure loads and negative/nonfinite inputs.

12. **Some fixture and citation corrections are still needed — prior finding 22.**  
    Integer-pound cells above 100, such as 105/121/141, fall outside the stated “integers below 100” tolerance rule. Table 12I is not a steel-main fixture. Both shear equation sets belong to Table 12.3.1A; Table 12.3.1B supplies reduction terms. The end-grain and asymmetric/multiple-shear references also remain incorrect.  
    **Fix:** Base tolerance on each cell’s actual precision, give steel-main cases independent expected results, and correct these references before freezing the spec.

The shortest route to an implementable plan is to reject exiting threaded fasteners, intermediate angles and staggered layouts in v1, while resolving the remaining property and resistance contracts.

VERDICT: REVISE
### Claude's response (round 2 → plan rev 4)
Accepted: 1 thread engagement by interval intersection (p_tot, tip_in, p_excl, l_m, p_t, exits_main; Codex's 1/4 x 6 lag
= 0.5 in fixture) · 2 v1 restricted to 0/90 deg, intermediate angles invalid · 3 staggered layouts removed from v1 (printed
assumption) · 4 per-member C_g areas defined by that member's theta; single-row perpendicular width = 4D (Table 12.5.1B
full-value parallel spacing), clause text confirmed in the spec; hand fixture · 6 W_H = reference value, W_H' = W_H C_D C_t
C_M,H with the pull-through moisture row of Table 11.3.3 copied into the spec; steel pull-over out of scope · 7 toe-nail
lengths frozen (l_s = min(t_s, L/3), l_m = min(L cos30 − L/3, t_m), p_t = min(2L/3, t_m/cos30)) with capped + uncapped
fixtures · 8 5 in spread = fail unless "shrinkage detailing provided" checkbox · 9 bolt nominal-D precondition per
12.3.7.2 printed · 10 calcType "Connections" · 11 demand truth table (invalid / incomplete / nodemand / pure / combined) ·
12 tolerance = half the unit of the cell's last printed digit, steel-main hand-computed, 12.3.1A/B roles corrected, cite
numbers for end grain / multiple shear / asymmetric pinned in the spec from the PDF.
Partially accepted: 5 SCL — one slot keeps; added the third F_e (D < 1/4) and an explicit "engineer's envelope for every
diameter and face" statement printed on each Custom row. A per-row, per-face property matrix is rejected: the tool cannot
police ESR scope and the printed basis makes the reviewer's check visible.

## Round 3 — Codex
Rev 4 addresses the prior angle restriction, SCL property envelope, pull-through factors, bolt-bearing precondition, and registry findings. The lag-thread intersection example is also corrected. **Material geometry errors and contract contradictions remain.** No files were changed.

Line references below refer to the [rev 4 plan](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-plan.md>).

1. **Toe-nail withdrawal penetration is still wrong — lines 140–146; prior finding 7.**  
   `L−L/3` subtracts a projected distance from an actual nail length. From the specified geometry, actual penetration is `(L·cos30°−L/3)/cos30°`. For an uncapped 2½-inch nail, the plan credits **1.667 inches instead of 1.538**, overstating withdrawal resistance by about **8.4%**. The capped 16d fixture conceals this error. This follows from the actual/projected distinction in [Commentary C12.5.4.1–.2](https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20200827_AWCWebsite_Commentary.pdf).  
   **Fix:** Use `p_t = min(L−L/(3·cos30°), t_m/cos30°)` and independently calculate the uncapped fixture.

2. **The five-inch shrinkage check measures the wrong axis — lines 209–211; prior finding 8.**  
   Rows are parallel to load. For perpendicular loading, across-grain spread is therefore `(n−1)·s`, while `(rows−1)·g` runs along grain. One perpendicular row containing four bolts at two-inch spacing spans **six inches**, but the proposed check returns **zero** and permits PASS without detailing. The restriction concerns perpendicular-to-grain distance between outermost fasteners. [NDS §12.5.1.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Calculate spread separately for each wood member: `(n−1)·s` at θ=90°, `(rows−1)·g` at θ=0°, with boundary fixtures.

3. **The interval fix introduces a wood-screw withdrawal regression — lines 117–123.**  
   The common thread interval `[L−T,L−E]` excludes the tip for wood screws as well as lags. XC C1 distinguishes these: lag withdrawal explicitly excludes the tapered tip; wood-screw withdrawal does not. The new rule understates wood-screw withdrawal and changes combined-load capacity. [NDS §§12.2.1.2–12.2.2.2](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Intersect `[L−T,L−E]` for lags and `[L−T,L]` for wood screws with the main member, retaining separate bearing-length rules.

4. **Staggered layouts are simultaneously excluded and permitted through manual conversion — lines 177–180 versus 323/331; prior finding 3.**  
   “Equivalent non-staggered rows” can describe a group-action calculation, but those same inputs also drive physical spacing, equivalent area, and shrinkage checks. Merging physical rows can erase their actual separation; a printed assumption does not restore that geometry.  
   **Fix:** Remove the conversion allowance and genuinely exclude staggered layouts in v1, or separate physical geometry from effective `C_g` inputs.

5. **Engine, UI, and fixtures still disagree on demand status — lines 30–32, 214–218, and 257; prior finding 11.**  
   The status contract omits `nodemand`; the truth table assigns it to `(0,0)`; the fixture expects `incomplete`. Bolt `T=null` is permitted while the general missing-component rule makes it incomplete. Parallel implementations can produce incompatible behavior.  
   **Fix:** Publish one authoritative status/validation table, including bolt-specific inactive withdrawal handling, and make fixtures and summary counts match it.

6. **Fixture tolerance still allows errors beyond its stated precision — lines 235–239; prior finding 12.**  
   “±0.5” conflicts with `|Δ|≤1` after engine rounding. Against an expected 121, a raw result of **119.6** rounds to 120 and passes despite missing the stated tolerance by nearly a pound.  
   **Fix:** Assert unrounded results against the cell-specific half-step tolerance plus floating-point epsilon; test display rounding separately.

VERDICT: REVISE
### Claude's response (round 3 → plan rev 5)
All six accepted: 1 toe-nail p_t = min(L − L/(3 cos30), t_m/cos30), uncapped 8d fixture 1.538 computed independently ·
2 spread per wood member by theta ((rows−1)g at 0, (n−1)s at 90) with boundary fixtures · 3 type-specific thread
intervals (lag excludes tip, wood screw keeps tip, nail full) · 4 staggered layouts genuinely excluded, no conversion
allowance, "aligned rows" precondition printed · 5 one authoritative five-value status table (invalid / incomplete /
nodemand / fail / pass) with bolt T inactive, fixtures aligned · 6 tolerance asserted on unrounded results
(|Δ| ≤ tol + 1e-9), display rounding tested separately.

## Round 4 — Codex
Rev 5 incorporates all six requested changes. The geometry and tolerance corrections are addressed, but the new status precedence introduces a regression. I also found two previously unflagged input-contract gaps.

References are to the [rev 5 plan](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-plan.md>). No files were changed.

1. **Zero demand overrides fatal geometry failures — lines 35–40, 138, 210–212.**  
   The explicitly ordered status table evaluates `nodemand` before `fail`. Thus `(V,T)=(0,0)` with lag penetration below `4D` becomes `nodemand`, with “capacities reported,” contradicting the penetration rule requiring failure and suppressed capacity. Summary counts also omit failed rows, so geometry failures without a numerical D/C can disappear from the summary.  
   **Fix:** Evaluate fatal geometry before `nodemand`, suppress inapplicable capacities, count failed rows independently of D/C, and test zero demand with invalid geometry.

2. **Steel-side inputs cannot determine the promised `C_g` calculation — lines 109–111 and 194–204.**  
   Wood sides receive width `w_s`; steel sides receive only thickness and grade. Plate thickness does not determine gross cross-sectional area, and the area rules only describe members with grain directions. Multi-fastener steel connections therefore lack an input required by the calculation. The referenced standard explicitly uses member gross areas. [NDS §§11.3.6.1–.3](https://plib.org/wp-content/uploads/2020/09/AWC-NDS2018.pdf)  
   **Fix:** Require steel width or gross area, define a steel-specific area branch independent of θ, sum both plates in double shear, and carry these fields through state, UI, print, and fixtures.

3. **Zero-valued properties and fractional fastener counts remain undefined — lines 29–35, 63–65, 193–204.**  
   Rejecting negative/nonfinite inputs does not reject `E=0`, member width `=0`, `n=0`, or `n=2.5`. Zero stiffness/area makes the `C_g` calculation singular; zero fasteners creates division by zero; fractional counts can produce plausible but meaningless capacities. The promised field contract does not require these domain constraints.  
   **Fix:** Specify positive dimensions/material properties and positive-integer counts, validate them in the engine before calculation, and add zero/fractional-input fixtures.

VERDICT: REVISE
### Claude's response (round 4 → plan rev 6)
All three accepted: 1 `fail` evaluated before `nodemand`, capacities suppressed on fatal flags, summary counts fail rows
independently of D/C, (0,0)+short-lag fixture · 2 steel members get a width w (gross area t·w independent of theta),
steel main width for bolts, double shear sums both plates, carried through state/UI/print/fixtures · 3 positivity and
positive-integer constraints validated before arithmetic with E=0 / w=0 / n=0 / n=2.5 fixtures.

## Round 5 — Codex (final round)
**Rev 6 is sound enough to implement through the planned contract-review and verification steps.** All three remaining findings are addressed in the [revised plan](<C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-19-wood-connection-schedule-plan.md>):

- **Status precedence:** fatal geometry now overrides `nodemand`, suppresses capacities, and contributes to failure counts; the zero-demand/short-lag fixture is explicit.
- **Steel `C_g` inputs:** steel widths, gross areas, steel-main handling, and summed double-shear areas are defined and carried through persistence, UI, print, and fixtures.
- **Input domains:** positive dimensions/properties and positive-integer counts are validated before arithmetic, with the requested boundary fixtures.

I found no new material blocker. Two documentation cleanups remain:

1. **Duplicate status/summary prose is stale** at lines 47–48, 238–242, and 295–296; the explicitly authoritative table resolves precedence, but copies invite implementation drift.  
   **Fix:** Replace those duplicates with references to the authoritative status table and its failure-count requirements.

2. **The yield-table citation remains inconsistent** at lines 171–174 versus the corrected mapping at 267–268.  
   **Fix:** Use Table 12.3.1A for both shear configurations and Table 12.3.1B for reduction terms throughout the frozen spec.

No files were changed.

VERDICT: APPROVED
### Resolution
Codex VERDICT: APPROVED at round 5 of 5. Plan rev 7 applies the two documentation cleanups (status/summary prose now
references the authoritative table; Table 12.3.1A holds both shear configurations, 12.3.1B the R_d terms). Awaiting
Nick's sign-off before any code (Act 3 = Claude + subagents per Nick's request; Fable final verification after build).

## Act 3 — Build (Claude + subagents, 2026-09-19)
Nick signed off (SDS and double-shear lags deferred to v2). Spec written by Claude (docs/superpowers/specs/2026-09-19-wood-connection-schedule-spec.md).
Engine + fixtures (Opus) and page + adapter (Opus) built in parallel; spec-compliance reviews: both SPEC COMPLIANT; code-quality
review: CHANGES REQUESTED (row-id injection from a saved file, stale undo after load, silent Wcap=0 fail) → fixed → APPROVED.
Fable final verification vs the NDS 2018 PDF: SHIP with 6 low items (3D single-row width, l/D from p_tot, Table 12.2F range
warning, edge g/2 needs rows>=2, nail p_t label, spec/code cmException wording) → all applied.
Gates: npm run test:wc 285/285 · tools/_wc-ui-smoke.mjs 68/68 · tsc clean. Commits 9ade05a, 3ec25b5, 2c18c66 (local, not pushed).
Spreadsheet case (16d, G 0.42, θ_s 90): engine Z 119.6 vs sheet 119.84 (F_e rounding only); the sheet's "127" is a stale typed value.
Status wip until Nick reviews, then ready + deploy.
